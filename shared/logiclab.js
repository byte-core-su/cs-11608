/* =====================================================================
   條件判斷實驗室（第 4 關 小鳥吃蟲）
   ---------------------------------------------------------------------
   ★ 來歷
     玩法取自 11502/logic.html（一支 Minecraft 風格的「邏輯挑戰」）：
       讀一段「如果…那麼」，先預測它會做哪個動作，答對得分、答錯扣血，
       卡住可以按「慢動作重看」一步一步推理。
     ⚠️ 內容**沒有**照抄。原本用的是 x、y 兩個沒有來由的數字；
        這裡換成第 4 關自己的世界（小鳥、蟲、滑鼠），
        判斷式也換成學生等一下真的要拼的那幾塊積木。
     ⇒ logic.html 已刪。

   ★ 為什麼第 4 關需要這一段
     第 4 關的判斷只用到「且」（碰到顏色 且 滑鼠鍵被按下）。
     但條件判斷還有「或」和「不成立」—— 課本第 4 章沒有獨立範例，
     系統裡也沒有任何地方教。少了那兩個，學生對條件的理解是缺一半的。
     ⚠️ 而「或」正是第 4 關拼圖最容易拿錯的那一塊誘餌 ——
        在這裡先弄懂它和「且」差在哪，等一下才不會是用猜的。

   ★ 為什麼要「先預測，再看答案」
     直接給真值表的話，學生會背表。
     先押一個答案、押錯扣體力，他才會真的去想「這個條件到底成不成立」。

   用法：
     LOGICLAB.mount(host, { need: 5, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-12-logiclab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /* 偵測值：都是小鳥吃蟲裡真的看得到的東西。
     ⚠️ 用數字不用真假 —— 只有真假的話總共才四種組合，
        玩兩局就背起來了，而背起來的東西不是理解。 */
  var SENSORS = {
    dist: { name: '嘴巴離蟲的距離', unit: '點', max: 10 },
    hold: { name: '滑鼠按住的時間', unit: '秒', max: 10 }
  };

  /* 三種條件。每一種都寫成第 4 關看得懂的句子。
     ⚠️ 這些字串會直接進 innerHTML，所以「<」「>」一律用 &lt; &gt; ——
        寫成 '距離 < 3' 的話，瀏覽器會把「< 3　<b>」當成一個標籤開頭。 */
  var FORMS = [
    { type: 'and', text: '距離 &lt; 3　<b>且</b>　按住 &gt; 0',
      left: '距離 &lt; 3', right: '按住 &gt; 0',
      L: function (v) { return v.dist < 3; },
      R: function (v) { return v.hold > 0; },
      rule: '「且」要<b>兩邊都成立</b>，整個條件才成立。',
      real: '第 4 關就是用這個：嘴巴碰到蟲<b>而且</b>按著滑鼠，才算吃到。' },
    { type: 'or', text: '距離 &lt; 3　<b>或</b>　按住 &gt; 7',
      left: '距離 &lt; 3', right: '按住 &gt; 7',
      L: function (v) { return v.dist < 3; },
      R: function (v) { return v.hold > 7; },
      rule: '「或」只要<b>一邊成立</b>，整個條件就成立。',
      real: '⚠️ 第 4 關<b>不能</b>用這個：只要按著滑鼠就吃得到，沒碰到也算。' },
    { type: 'not', text: '「距離 = %n」<b>不成立</b>',
      left: '距離 = %n', right: null,
      L: function (v, n) { return v.dist === n; },
      R: null,
      rule: '「不成立」把結果<b>整個反過來</b>：對變錯、錯變對。',
      real: '想成「還沒碰到的時候」—— 條件反過來，做的事也就反過來。' }
  ];

  /* 小鳥可以做的事。那麼一個、否則一個。 */
  var ACTIONS = [
    { yes: '造型換成 小鳥彎腰', no: '造型換成 小鳥站立' },
    { yes: '分身刪除（吃掉這隻蟲）', no: '繼續飛' },
    { yes: '播放音效 啾', no: '什麼都不做' }
  ];

  /** 出一題。rnd 可以換掉（測試要固定結果時用）。 */
  function makeQuest(opts, rnd) {
    opts = opts || {};
    rnd = rnd || Math.random;
    var f = FORMS[opts.type ? idxOf(opts.type) : Math.floor(rnd() * FORMS.length)];
    var v = { dist: Math.floor(rnd() * 11), hold: Math.floor(rnd() * 11) };
    var n = 2 + Math.floor(rnd() * 6);                     // 「不成立」要比的那個數
    var arch = opts.arch || (rnd() < 0.5 ? 'basic' : 'advanced');
    var act = ACTIONS[Math.floor(rnd() * ACTIONS.length)];
    return { form: f, vars: v, n: n, arch: arch, act: act,
             met: evalCond(f, v, n),
             text: f.text.replace('%n', n) };
  }
  function idxOf(t) {
    for (var i = 0; i < FORMS.length; i++) if (FORMS[i].type === t) return i;
    return 0;
  }

  /** 這個條件成不成立 */
  function evalCond(f, v, n) {
    if (f.type === 'and') return f.L(v) && f.R(v);
    if (f.type === 'or') return f.L(v) || f.R(v);
    return !f.L(v, n);                                     // not
  }

  /**
   * 程式會做哪件事。
   * ★ 基礎版（如果…那麼）條件不成立時**什麼都不做** ——
   *   這正是第 4 關「只寫那麼不寫否則」的後果，
   *   在這裡先讓學生看見一次。
   */
  function actionOf(q) {
    if (q.met) return q.act.yes;
    return q.arch === 'advanced' ? q.act.no : '（什麼都不做）';
  }

  /**
   * 慢動作：一步一步推。
   * 「且」「或」三步（左邊 → 右邊 → 合起來）；「不成立」兩步。
   * ★ 每一步都要學生自己回答對錯 —— 直接列出來就變成看答案。
   */
  function traceSteps(q) {
    var v = q.vars, f = q.form, out = [];
    if (f.type === 'not') {
      out.push({ q: '距離是 ' + v.dist + '。「距離 = ' + q.n + '」成立嗎？',
                 ans: f.L(v, q.n),
                 why: '距離 ' + v.dist + (f.L(v, q.n) ? ' 就是 ' : ' 不是 ') + q.n + '。' });
      out.push({ q: '加上「不成立」要把結果<b>反過來</b>。整個條件成立嗎？',
                 ans: q.met,
                 why: f.rule });
      return out;
    }
    out.push({ q: '距離是 ' + v.dist + '。「' + f.left + '」成立嗎？',
               ans: f.L(v), why: '左邊那一半只看距離。' });
    out.push({ q: '按住了 ' + v.hold + ' 秒。「' + f.right + '」成立嗎？',
               ans: f.R(v), why: '右邊那一半只看時間。' });
    out.push({ q: '兩邊的答案都有了。整個條件成立嗎？',
               ans: q.met, why: f.rule });
    return out;
  }

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.lg{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.lg-tip{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.lg-tip b{color:#6d28d9}',
    '.lg-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:11px}',
    '.lg-bar span{font-size:13px;font-weight:700;color:#64748b}',
    '.lg-bar b{font-size:16px;letter-spacing:2px}',
    '.lg-sense{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}',
    '.lg-sense div{background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;',
    '  padding:6px 13px;font-size:13px;font-weight:700;color:#475569}',
    '.lg-sense div b{font-size:19px;color:#7c3aed;margin-left:5px}',
    '.lg-code{background:#0f172a;border-radius:10px;padding:11px 14px;margin-bottom:10px;',
    '  font-size:14px;line-height:2;color:#e2e8f0}',
    '.lg-code .c{color:#c4b5fd;font-weight:700}',
    '.lg-code .a{color:#86efac}',
    '.lg-code .b{color:#fca5a5}',
    '.lg-code .dim{color:#64748b;font-size:12.5px}',
    '.lg-pick{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px}',
    '.lg-pick button{flex:1;min-width:150px;background:#fff;border:2px solid #a78bfa;',
    '  color:#5b21b6;border-radius:11px;padding:11px 13px;font-size:13.5px;font-weight:700;',
    '  cursor:pointer;font-family:inherit;line-height:1.6}',
    '.lg-pick button:hover{background:#f5f3ff}',
    '.lg-msg{font-size:13.5px;line-height:1.85;padding:9px 12px;border-radius:9px;margin-bottom:9px}',
    '.lg-msg.good{background:#dcfce7;color:#166534}',
    '.lg-msg.bad{background:#fee2e2;color:#991b1b}',
    '.lg-btn{background:#7c3aed;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.lg-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.lg-slow{background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;',
    '  padding:10px 13px;margin-bottom:9px;font-size:13px;line-height:1.9}',
    '.lg-slow .yn{display:flex;gap:7px;margin-top:6px}',
    '.lg-slow .yn button{background:#fff;border:2px solid #a78bfa;color:#5b21b6;',
    '  border-radius:8px;padding:4px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.lg-book{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}',
    '.lg-book div{flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;',
    '  border-radius:9px;padding:7px 10px;font-size:12px;line-height:1.75;color:#64748b}',
    '.lg-book div.on{background:#f5f3ff;border-color:#c4b5fd;color:#5b21b6}',
    '.lg-book b{color:#6d28d9}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）───────── */
    '.lg-big .lg-tip{font-size:14.5px;padding:14px 17px}',
    '.lg-big .lg-bar span{font-size:14.5px}',
    '.lg-big .lg-bar b{font-size:22px;letter-spacing:3px}',
    '.lg-big .lg-sense div{padding:11px 20px;font-size:14.5px;border-width:3px}',
    '.lg-big .lg-sense div b{font-size:28px}',
    /* 程式碼是這一段的主角 —— 學生要讀的就是它 */
    '.lg-big .lg-code{font-size:18px;line-height:2.1;padding:18px 22px}',
    '.lg-big .lg-code .dim{font-size:14px}',
    '.lg-big .lg-pick button{padding:16px 18px;font-size:15.5px;min-width:190px}',
    '.lg-big .lg-msg{font-size:15px;padding:13px 16px;min-height:58px}',
    '.lg-big .lg-btn{padding:11px 20px;font-size:15px}',
    '.lg-big .lg-slow{font-size:14.5px;padding:13px 16px}',
    '.lg-big .lg-slow .yn button{padding:7px 20px;font-size:14.5px}',
    '.lg-big .lg-book div{font-size:13px;padding:10px 13px;min-width:170px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('lg-style')) return;
    var s = document.createElement('style');
    s.id = 'lg-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var need = opts.need || 5;         // 吃到幾隻蟲算過關
    var maxHp = opts.hp || 5;

    var worms = 0, hp = maxHp, passed = false;
    var q = null, answered = false, slowAt = -1, slowOk = 0;
    /* ★ 三種條件都要遇過才算走完 —— 只練「且」的話，
       「或」和「不成立」等於沒教。 */
    var seen = { and: false, or: false, not: false };

    host.className = 'lg' + (opts.big ? ' lg-big' : '');
    next();

    function next() {
      q = makeQuest(pickType());
      answered = false; slowAt = -1; slowOk = 0;
      render();
    }
    /* 還沒遇過的那幾種優先出 —— 不然隨機可能一直給同一種。 */
    function pickType() {
      var miss = Object.keys(seen).filter(function (k) { return !seen[k]; });
      if (miss.length && Math.random() < 0.75) {
        return { type: miss[Math.floor(Math.random() * miss.length)] };
      }
      return {};
    }

    function render(msg, kind) {
      var f = q.form;
      host.innerHTML =
        '<div class="lg-tip">🧭 <b>條件判斷實驗室</b>　' +
        '讀下面這段程式，<b>先猜</b>小鳥會做哪一件事，再按下去。' +
        '<div style="font-size:12.5px;color:#64748b;margin-top:5px">' +
        '猜對吃到一隻蟲 🐛，猜錯少一格體力 ❤️。卡住就按「慢動作重看」。</div></div>' +

        '<div class="lg-bar">' +
        '<span>吃到的蟲</span><b>' + rep('🐛', worms, need) + '</b>' +
        '<span>體力</span><b>' + rep('❤️', hp, maxHp) + '</b></div>' +

        '<div class="lg-sense">' +
        '<div>' + SENSORS.dist.name + '<b>' + q.vars.dist + '</b></div>' +
        '<div>' + SENSORS.hold.name + '<b>' + q.vars.hold + '</b></div></div>' +

        '<div class="lg-code">' +
        '<div><span class="c">如果</span> 〈' + q.text + '〉 <span class="c">那麼</span></div>' +
        '<div>　<span class="a">' + esc(q.act.yes) + '</span></div>' +
        (q.arch === 'advanced'
          ? '<div><span class="c">否則</span></div><div>　<span class="b">' +
            esc(q.act.no) + '</span></div>'
          : '<div class="dim">（沒有「否則」—— 條件不成立時什麼都不做）</div>') +
        '</div>' +

        (msg ? '<div class="lg-msg ' + kind + '">' + msg + '</div>' : '') +
        (slowAt >= 0 ? slowHtml() : '') +

        (answered
          ? '<button class="lg-btn" id="lg-next">下一題 →</button>'
          : '<div class="lg-pick">' +
            '<button data-pick="yes">' + esc(q.act.yes) + '</button>' +
            '<button data-pick="no">' +
            esc(q.arch === 'advanced' ? q.act.no : '什麼都不做') + '</button></div>' +
            (slowAt < 0
              ? '<button class="lg-btn ghost" id="lg-slow">🐢 慢動作重看（一步一步推）</button>'
              : '')) +

        bookHtml(f.type);

      var b;
      if ((b = host.querySelector('#lg-next'))) b.onclick = next;
      if ((b = host.querySelector('#lg-slow'))) b.onclick = function () { slowAt = 0; render(); };
      [].forEach.call(host.querySelectorAll('[data-pick]'), function (el) {
        el.onclick = function () { answer(el.dataset.pick === 'yes'); };
      });
      [].forEach.call(host.querySelectorAll('[data-yn]'), function (el) {
        el.onclick = function () { slowAnswer(el.dataset.yn === 'y'); };
      });
    }

    function rep(ch, n, max) {
      var s = '';
      for (var i = 0; i < max; i++) s += (i < n ? ch : '🖤');
      return s;
    }

    /* 邏輯寶典：三種條件的說明，目前這一題那一格會亮起來。 */
    function bookHtml(now) {
      return '<div class="lg-book">' + FORMS.map(function (f) {
        var label = f.type === 'and' ? '且' : (f.type === 'or' ? '或' : '不成立');
        return '<div' + (f.type === now ? ' class="on"' : '') + '>' +
               '<b>' + label + '</b>　' + f.rule +
               (f.type === now ? '<br>' + f.real : '') + '</div>';
      }).join('') + '</div>';
    }

    function slowHtml() {
      var st = traceSteps(q);
      var out = '<div class="lg-slow">';
      for (var i = 0; i < st.length && i <= slowAt; i++) {
        out += '<div>' + (i < slowAt ? '✔ ' : '') + st[i].q + '</div>';
        if (i < slowAt) {
          out += '<div style="color:#6d28d9;font-weight:700">→ ' +
                 (st[i].ans ? '成立' : '不成立') + '　<span style="font-weight:400;color:#64748b">' +
                 st[i].why + '</span></div>';
        } else {
          out += '<div class="yn"><button data-yn="y">成立</button>' +
                 '<button data-yn="n">不成立</button></div>';
        }
      }
      if (slowAt >= st.length) {
        out += '<div style="color:#6d28d9;font-weight:700">推完了 —— ' +
               '整個條件<b>' + (q.met ? '成立' : '不成立') + '</b>。回上面選一個動作。</div>';
      }
      return out + '</div>';
    }

    function slowAnswer(yes) {
      var st = traceSteps(q);
      if (slowAt >= st.length) return;
      if (yes === st[slowAt].ans) { slowAt++; slowOk++; render(); }
      else {
        /* ⚠️ 慢動作裡答錯**不扣體力** —— 這裡是在幫他想，不是考試。
           扣的話學生就不敢按這顆按鈕了，而最需要它的正是不敢按的那個。 */
        render('這一步再想一下。' + st[slowAt].why, 'bad');
      }
    }

    function answer(pickYes) {
      if (answered) return;
      answered = true;
      seen[q.form.type] = true;
      var right = (pickYes === q.met);
      if (right) {
        worms = Math.min(worms + 1, need);
        render('✔ 對了 —— 條件<b>' + (q.met ? '成立' : '不成立') + '</b>，' +
               '所以小鳥「' + esc(actionOf(q)) + '」。<br>' + q.form.real + '　🐛 +1', 'good');
      } else {
        hp = Math.max(hp - 1, 0);
        render('✘ 條件其實<b>' + (q.met ? '成立' : '不成立') + '</b> —— ' +
               '小鳥會「' + esc(actionOf(q)) + '」。<br>' + q.form.rule +
               '<br>❤️ −1' + (hp === 0 ? '（體力空了，但還是可以繼續練）' : ''), 'bad');
      }
      check();
    }

    function check() {
      if (passed) return;
      if (worms < need) return;
      var miss = Object.keys(seen).filter(function (k) { return !seen[k]; });
      if (miss.length) return;                 // 三種都要遇過
      passed = true;
      if (opts.onPass) opts.onPass();
    }

    return {
      destroy: function () { host.innerHTML = ''; },
      _state: function () {
        return { worms: worms, hp: hp, passed: passed, seen: seen,
                 type: q && q.form.type, met: q && q.met, arch: q && q.arch,
                 answered: answered, slowAt: slowAt };
      }
    };
  }

  /** 這一步的目標與過關標準（說明見 searchlab.js 的同名函式）。 */
  function goal(lab) {
    var need = (lab && lab.need) || 5;
    return {
      why: '這一關的拼圖只用到「且」，但條件判斷還有「或」和「不成立」。' +
           '少了那兩個，你對條件的理解是缺一半的 —— ' +
           '而「或」正是等一下拼圖最容易拿錯的那一塊誘餌。',
      pass: '吃到 <b>' + need + ' 隻蟲</b>，而且「且」「或」「不成立」<b>三種都遇過</b>。' +
            '<br>（答錯會扣體力，但按「慢動作重看」一步一步推的時候<b>不扣</b>。）'
    };
  }

  global.LOGICLAB = {
    goal: goal,
    VERSION: VERSION,
    FORMS: FORMS,
    SENSORS: SENSORS,
    mount: mount,
    _makeQuest: makeQuest,
    _evalCond: evalCond,
    _actionOf: actionOf,
    _traceSteps: traceSteps
  };
})(typeof window !== 'undefined' ? window : this);
