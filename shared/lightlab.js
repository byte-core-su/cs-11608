/* =====================================================================
   迎賓走廊：三個概念的檢核（5016B 第二節）
   ---------------------------------------------------------------------
   骨架和其他節相同：**先講你認為會怎樣 → 再執行 → 說對了才算**（引擎在 shared/labkit.js）。

     A 換算（能預測）　給一組對應設定與距離，先答「第幾顆會亮」再播放
     B 狀態（能解釋）　位置模式少了「把上一顆關掉」，選錯直接跑給他看；最後用自己的話說
     C 反向（能調整）　自己填出四個數字，做到指定的效果

   這一支不計星，完成狀態由頁面記錄。
   ===================================================================== */
(function (global) {
  'use strict';

  var N_LED = 8;                 // 燈條有幾顆（WS2812B 八顆）

  function LK() {
    if (!global.LABKIT) throw new Error('lightlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function MAP() {
    if (!global.MAPLAB) throw new Error('lightlab 需要 shared/maplab.js（請先載入它）');
    return global.MAPLAB;
  }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

  /* ── A：先猜「第幾顆會亮」───────────────────────────
     隨機三件事：距離的尺、方向、量到的距離（方向固定的話，「越近越右邊」就變成背口訣）。
     出題要自己驗過：答案要是 1～8 的整數，而且不落在正中間（那個位置正反向同值）。 */
  function caseA(rng, prev) {
    var c = null;
    for (var g = 0; g < 60; g++) {
      /* 距離上限必須是 **7 的倍數**：1→8 是八顆燈、中間只有七格間隔，
         否則 d×7/hi 永遠除不盡，長不出乾淨的位置。 */
      var hi = [35, 42, 56, 70][ri(rng, 0, 3)];
      var rev = rng() < 0.5;
      var spots = [];
      for (var d = 1; d < hi; d++) {
        var v = rev ? MAP().mapv(d, hi, 0, 1, N_LED) : MAP().mapv(d, 0, hi, 1, N_LED);
        var f = MAP().mapv(d, 0, hi, 1, N_LED);
        var b = MAP().mapv(d, hi, 0, 1, N_LED);
        /* 正反兩個方向都要是整數 —— 答成反向時才是另一個乾淨的數字，看得出錯在方向 */
        if (v === Math.round(v) && f === Math.round(f) && b === Math.round(b) && f !== b) {
          spots.push({ d: d, ans: v, other: rev ? f : b });
        }
      }
      if (!spots.length) continue;
      var s = spots[ri(rng, 0, spots.length - 1)];
      c = { hi: hi, rev: rev, d: s.d, answer: s.ans, other: s.other };
      if (!prev || c.hi !== prev.hi || c.rev !== prev.rev || c.d !== prev.d) return c;
    }
    return c;
  }
  /** A 的設定寫成一行給學生看。 */
  function textA(c) {
    return '燈號 ← 對應（距離，' + (c.rev ? c.hi + '→0' : '0→' + c.hi) + '，1→' + N_LED + '）';
  }
  function judgeA(pred, c) {
    var n = Number(String(pred).trim());
    return { ok: String(pred).trim() !== '' && isFinite(n) && n === c.answer,
             answer: c.answer, other: c.other };
  }
  function sayA(pred, c) {
    var n = Number(String(pred).trim());
    if (n === c.other)
      return '⚠️ 你算的是**方向相反**的那一種。再看一次那一行：' +
             (c.rev ? '距離 ' + c.hi + ' 對到 0' : '距離 0 對到 0') +
             '，所以距離越大，燈號越' + (c.rev ? '小' : '大') + '。';
    return '再對一次兩把尺：距離的尺是 ' +
           (c.rev ? c.hi + '→0' : '0→' + c.hi) + '，燈號的尺是 1→' + N_LED + '。';
  }

  /* ── B：三組情境，少的都是「把上一顆關掉」─────────────
     延續第一節的「狀態」：程式不記得上一次亮的是哪一顆。
     「走過的都留著」不是壞掉，那是另一種做法（長度條）—— 教材比較區塊說兩種都對，
     所以 B 的措辭是「這一支要做的是位置，可是它現在做出來的是長度」，而不是「這樣是錯的」。
     兩個錯的選項都能執行、而且執行後看得出錯在哪。 */
  var CASES_B = [
    { key: 'hall', thing: '上一顆是哪一顆',
      code: '重複無限次｜燈號 ← 對應(距離,55→0,1→8)、設定第(燈號)顆 = 白、等 0.4 秒',
      symptom: '這一支要做的是「現在走到哪」，可是人往前走，燈卻一顆一顆留著，最後整條都亮 —— 變成「有多近」了。',
      fixes: [
        { key: 'off', good: true,
          text: '等 0.4 秒之後，把第（燈號）顆設回不亮',
          after: '亮完就關掉，畫面上永遠只有一顆亮著 —— 這才是「位置」。' +
                 '（⚠️ 反過來說：想做「長度」那種效果，就是**故意不關**。兩種都對，看你要哪一種。）' },
        { key: 'fast', good: false,
          text: '把「等 0.4 秒」改成「等 0.05 秒」',
          after: '跑得比較快，但每一顆還是留在那裡 —— 整條一樣會全亮，只是全亮得更快。' },
        { key: 'dim', good: false,
          text: '把亮度從 50 調成 10，讓它不要那麼刺眼',
          after: '整條變暗了，但還是整條 —— 亮度和「留不留著」是兩件事。' }
      ] },
    { key: 'car', thing: '上一格是哪一格',
      code: '重複無限次｜格子 ← 對應(距離,80→0,1→8)、設定第(格子)格 = 紅、等 0.3 秒',
      symptom: '這一支要做的是「現在到哪一格」，可是車子慢慢倒車，紅格卻越積越多 —— 看不出現在剩多少空間。',
      fixes: [
        { key: 'off', good: true,
          text: '亮完之後，把第（格子）格設回不亮',
          after: '每次只留下現在這一格 —— 駕駛一眼就看得出還剩多少。' },
        { key: 'all', good: false,
          text: '改成「先把整條設成不亮，再亮第（格子）格」',
          after: '⚠️ 這樣其實會動，而且畫面是對的！但整條重畫八顆，' +
                 '車子動得快的時候會看到閃爍 —— 而我們只需要關掉一顆。' },
        { key: 'wait', good: false,
          text: '把「等 0.3 秒」拿掉，讓它反應更快',
          after: '反應是快了，但格子照樣越積越多 —— 而且快到看不清楚。' }
      ] },
    { key: 'batt', thing: '上一格是哪一格',
      code: '重複無限次｜格數 ← 對應(電量,0→100,1→8)、設定第(格數)格 = 綠、等 0.5 秒',
      symptom: '這一支要做的是「指針在哪一格」，可是電量從 100 掉到 20，指示條卻整排都綠 —— 看起來像滿電。',
      fixes: [
        { key: 'off', good: true,
          text: '亮完之後，把第（格數）格設回不亮',
          after: '只留現在這一格 —— 電量掉下來，亮的位置就往左移。' },
        { key: 'color', good: false,
          text: '電量低的時候把顏色改成紅色',
          after: '顏色是變了，但整排還是全亮 —— 換顏色救不了「留著」這件事。' },
        { key: 'more', good: false,
          text: '改成「電量越高，亮的格子越多」',
          after: '⚠️ 這是另一種做法（長度條），本來也可以 —— ' +
                 '但它得每次重畫整條。這一題要修的是「位置」這種畫法。' }
      ] }
  ];
  function caseB(rng, prev) { return LK().pick(rng, CASES_B, prev); }

  /* B 的第三階段：用自己的話說。full: 1 —— 講到任何一個就算過。 */
  var SAY = {
    need: [
      { name: '不關掉的話走過的會留著',
        any: ['留', '累積', '都亮', '全亮', '整條', '整排', '越來越多', '不會暗', '疊', '沒關'] },
      { name: '我們要的是「現在在哪一顆」',
        any: ['一顆', '一格', '只亮', '位置', '哪一顆', '哪一格', '上一顆', '上一格', '前一顆', '現在'] }
    ],
    min: 8,
    full: 1
  };
  function saySpec(c) {
    c = c || CASES_B[0];
    var good = c.fixes.filter(function (f) { return f.good; })[0] || {};
    return { need: SAY.need, full: SAY.full, min: SAY.min,
             q: '為什麼亮完之後要把它關掉？',
             /* 抽到哪一組就比哪一組的抄襲來源 */
             src: ['為什麼亮完之後要把它關掉', good.text || '', good.after || '', c.symptom] };
  }
  function judgeSay(text, c) { return LK().judgeSay(text, saySpec(c)); }

  /* ── C：自己填出四個數字 ────────────────────────────
     目標隨機（越近越亮／越近越暗），背不起來。
     判定分三種錯，回饋才講得清楚該往哪裡調：方向反了／沒有用滿整條／格式不對。 */
  function caseC(rng, prev) {
    for (var g = 0; g < 30; g++) {
      var c = { hi: [40, 50, 55, 60, 80][ri(rng, 0, 4)],
                out: [100, 200, 255][ri(rng, 0, 2)],
                near: rng() < 0.5 };   // true＝越近越亮
      if (!prev || c.hi !== prev.hi || c.near !== prev.near) return c;
    }
    return c;
  }
  /** 學生填的四個數字：距離從 a 到 b、輸出從 x 到 y。 */
  function judgeC(a, b, x, y, c) {
    var n = [a, b, x, y].map(function (v) { return Number(String(v).trim()); });
    if (n.some(function (v) { return !isFinite(v); }) ||
        [a, b, x, y].some(function (v) { return String(v).trim() === ''; }))
      return { ok: false, how: 'bad' };
    /* 用滿：距離兩端要是 0 與 hi，輸出兩端要是 0 與 out（順序不拘） */
    var dOk = Math.min(n[0], n[1]) === 0 && Math.max(n[0], n[1]) === c.hi;
    var oOk = Math.min(n[2], n[3]) === 0 && Math.max(n[2], n[3]) === c.out;
    if (!dOk || !oOk) return { ok: false, how: 'range' };
    /* 方向：把最近（距離 0）餵進去，看輸出是大還是小 */
    var atNear = MAP().mapv(0, n[0], n[1], n[2], n[3]);
    var atFar  = MAP().mapv(c.hi, n[0], n[1], n[2], n[3]);
    var bright = atNear > atFar;
    if (bright !== c.near) return { ok: false, how: 'dir' };
    return { ok: true, how: 'fit' };
  }
  function sayC(r, c) {
    if (r.how === 'fit')   return '對了 —— ' + (c.near ? '手靠近，燈就亮起來。' : '手靠近，燈反而暗下來。');
    if (r.how === 'dir')   return '⛔ **方向反了**。⚠️ 注意：燈一樣會亮，所以光看畫面看不出來 ——' +
                                  '要把手靠近才會發現。把距離那一邊的兩個數字對調看看。';
    if (r.how === 'range') return '⛔ 沒有**用滿**。距離要從 0 到 ' + c.hi +
                                  '、輸出要從 0 到 ' + c.out + ' —— 少用一段，燈就永遠亮不到最亮。';
    return '四格都要填數字。';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.ll-strip{display:flex;gap:6px;justify-content:center;margin:14px 0;' +
    'background:#0f172a;padding:12px 14px;border-radius:14px}' +
  '.ll-led{width:34px;height:34px;border-radius:50%;background:#1e293b;' +
    'border:2px solid #334155;transition:background .12s,box-shadow .12s;' +
    'font-size:11px;font-weight:900;color:#475569;text-align:center;line-height:32px}' +
  '.ll-led.on{background:#fef3c7;border-color:#fbbf24;color:#92400e;' +
    'box-shadow:0 0 12px 3px rgba(251,191,36,.55)}' +
  '.ll-led.was{background:#78350f;border-color:#92400e;color:#fed7aa}' +
  '.ll-cap{text-align:center;font-size:13px;color:#64748b;font-weight:700;margin-top:-6px}' +
  '.ll-four{display:flex;gap:8px;align-items:center;flex-wrap:wrap;' +
    'font-weight:900;font-size:15px;margin:10px 0}' +
  '.ll-n{width:74px;font-size:18px;font-weight:900;padding:9px 6px;' +
    'border:2px solid #cbd5e1;border-radius:10px;text-align:center}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('lightlab-css')) return;
    var st = document.createElement('style');
    st.id = 'lightlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /** 畫一條燈條。on＝現在亮的那一顆（1～8，0 表示都不亮）；was＝殘留的那些 */
  function stripHtml(on, was, cap) {
    var out = '<div class="ll-strip">';
    for (var i = 1; i <= N_LED; i++) {
      var cls = (i === on) ? 'on' : ((was && was.indexOf(i) >= 0) ? 'was' : '');
      out += '<div class="ll-led ' + cls + '">' + i + '</div>';
    }
    return out + '</div>' + (cap ? '<div class="ll-cap">' + LK().esc(cap) + '</div>' : '');
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc;
    var rng = (global.ULTRALAB ? global.ULTRALAB.rngFrom(opts.seed) : Math.random);
    var step = 'A';
    var done = { A: false, B: false, C: false };
    var tries = { A: 0, B: 0, C: 0 };
    var aCase = caseA(rng, null), bCase = caseB(rng, null), cCase = caseC(rng, null);
    /* B 的三個階段：選 → 先講 → 說出來 */
    var bPicked = false, bFix = null, sayText = '';

    function tabs() {
      return LK().tabsHtml(['A', 'B', 'C'],
        { A: 'A 換算', B: 'B 只留一顆', C: 'C 自己調' }, step, done);
    }
    function view(inner, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + inner +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + LK().md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }

    /* ── A ── */
    function viewA(msg, cls, showOn) {
      view(
        '<div class="dl-ask">程式裡寫的是：<br>' +
        '<span style="font-family:monospace;font-size:14px">' + esc(textA(aCase)) + '</span><br>' +
        '現在量到的距離是 <b>' + aCase.d + '</b> 公分。<br>' +
        '⚠️ 先講：<b>第幾顆</b>燈會亮？</div>' +
        '<div class="dl-row"><input class="dl-num" id="ll-pred" placeholder="?"> 顆 ' +
        '<button class="dl-go" id="ll-runA">送出並播放</button></div>' +
        /* 燈條一開始就畫出來（全暗）：學生猜的時候才有東西可以指著數 */
        stripHtml(showOn || 0, null,
                  showOn ? '實際亮的是第 ' + showOn + ' 顆' : '按下去才會亮 —— 先自己數數看'),
        msg, cls);
    }
    function doA() {
      tries.A++;
      var pred = el.querySelector('#ll-pred').value;
      var j = judgeA(pred, aCase);
      if (j.ok) {
        done.A = true; step = 'B';
        viewB('✅ A 完成：你算對了，而且是**先講再看**。', 'good');
        return;
      }
      var msg = sayA(pred, aCase);
      var old = aCase;
      aCase = caseA(rng, aCase);      // 猜錯換一題
      viewA(msg + '　**換一題**再試一次。', 'bad', old.answer);
    }

    /* ── B ── 三階段 */
    function goodFix() { return bCase.fixes.filter(function (f) { return f.good; })[0]; }
    function viewB(msg, cls) {
      var head =
        '<div class="dl-ask">下面這段程式<b>少了「' + esc(bCase.thing) + '」這個資訊</b>：<br>' +
        '<span style="font-family:monospace;font-size:14px">' + esc(bCase.code) + '</span><br>' +
        esc(bCase.symptom) + '你會怎麼修？</div>' +
        stripHtml(0, [1, 2, 3, 4, 5], '⚠️ 走過的都留著了');
      if (bFix) {
        var opts2 = bCase.fixes.slice().sort(function () { return rng() - 0.5; });
        return view(head +
          '<div class="dl-note">你選的是：<b>' + esc(bFix.text) + '</b></div>' +
          '<div class="dl-ask" style="margin-top:14px">⚠️ 先講：<b>執行之後會看到什麼？</b></div>' +
          opts2.map(function (f) {
            return '<button class="dl-opt" data-pred="' + f.key + '">' + esc(f.after) + '</button>';
          }).join(''), msg, cls);
      }
      view(head +
        (bPicked
          ? '<div class="dl-note">✅ 你選的是：<b>' + esc(goodFix().text) + '</b></div>' +
            stripHtml(4, null, '修好之後：永遠只有一顆亮著') +
            LK().sayHtml({ q: saySpec(bCase).q, text: sayText })
          : bCase.fixes.slice().sort(function () { return rng() - 0.5; }).map(function (f) {
              return '<button class="dl-opt" data-fix="' + f.key + '">' + esc(f.text) + '</button>';
            }).join('')),
        msg, cls);
    }
    function doB(key) {
      tries.B++;
      bFix = bCase.fixes.filter(function (x) { return x.key === key; })[0] || null;
      viewB('', '');       // 還不執行，先問「你認為會發生什麼」
    }
    function doPred(key) {
      var f = bFix, predOk = (key === f.key);
      bFix = null;
      if (f.good && predOk) { bPicked = true; return viewB('✅ 你不但修對了，也**說得出**會發生什麼。　**最後一步**：說說看為什麼。', 'good'); }
      var msg = '執行結果：' + f.after;
      if (!predOk) msg += '　⚠️ 你猜的不是這個 —— **先想清楚再按**。';
      bCase = caseB(rng, bCase);
      viewB(msg + '　**換一個東西**試試看。', 'bad');
    }
    function doSay() {
      var box = el.querySelector('#dl-say');
      sayText = box ? box.value : '';
      var res = judgeSay(sayText, bCase);
      if (res.level !== 'none') return passB(res);
      viewB('⚠️ 再想一次：如果不把上一顆關掉，畫面上會**累積**成什麼樣子？' +
            '（那種累積本身沒有壞 —— 只是這一支要的不是它。）', 'bad');
    }
    function passB(res) {
      done.B = true; step = 'C';
      if (typeof opts.onSay === 'function') opts.onSay(sayText, res);
      viewC('✅ B 完成：' + (res.why || '你說得出為什麼要關掉上一顆。'), 'good');
    }

    /* ── C ── */
    function viewC(msg, cls) {
      view(
        '<div class="dl-ask">🎛️ 目標：<b>手' + (cCase.near ? '越靠近，燈越亮' : '越靠近，燈反而越暗') +
        '</b>，而且要<b>用滿整條</b>（最暗 0、最亮 ' + cCase.out + '）。<br>' +
        '距離量得到的範圍是 0～' + cCase.hi + ' 公分。⚠️ 四格都要自己填。</div>' +
        '<div class="ll-four">亮度 ← 對應（距離，' +
          '<input class="ll-n" id="ll-a" placeholder="?">→<input class="ll-n" id="ll-b" placeholder="?">，' +
          '<input class="ll-n" id="ll-x" placeholder="?">→<input class="ll-n" id="ll-y" placeholder="?">）' +
        '</div>' +
        '<div class="dl-row"><button class="dl-go" id="ll-runC">送出並執行</button></div>',
        msg, cls);
    }
    function doC() {
      tries.C++;
      var r = judgeC(el.querySelector('#ll-a').value, el.querySelector('#ll-b').value,
                     el.querySelector('#ll-x').value, el.querySelector('#ll-y').value, cCase);
      if (!r.ok) { viewC(sayC(r, cCase), 'bad'); return; }
      done.C = true;
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">🎉 三個檢核都完成了！<br>' +
        '你證明了三件事：**算得出**距離會換成第幾顆、**說得出**為什麼要關掉上一顆、' +
        '**自己調得出**兩把尺的方向與範圍。</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
    }

    function bind() {
      var a = el.querySelector('#ll-runA'); if (a) a.addEventListener('click', doA);
      var c = el.querySelector('#ll-runC'); if (c) c.addEventListener('click', doC);
      var s = el.querySelector('#dl-runB'); if (s) s.addEventListener('click', doSay);
      var t = el.querySelector('#dl-say');
      if (t) t.addEventListener('input', function () { sayText = t.value; });
      el.querySelectorAll('[data-fix]').forEach(function (b) {
        b.addEventListener('click', function () { doB(b.getAttribute('data-fix')); });
      });
      el.querySelectorAll('[data-pred]').forEach(function (b) {
        b.addEventListener('click', function () { doPred(b.getAttribute('data-pred')); });
      });
    }

    viewA('');
    return { step: function () { return step; }, tries: function () { return tries; },
             say: function () { return sayText; },
             aCase: function () { return aCase; }, bCase: function () { return bCase; },
             cCase: function () { return cCase; }, bFix: function () { return bFix; } };
  }

  global.LIGHTLAB = {
    N_LED: N_LED, CASES_B: CASES_B, SAY: SAY,
    caseA: caseA, textA: textA, judgeA: judgeA, sayA: sayA,
    caseB: caseB, judgeSay: judgeSay,
    caseC: caseC, judgeC: judgeC, sayC: sayC,
    mount: mount
  };

})(window);
