/* =====================================================================
   無段風扇：三個概念的檢核（5016B 第三節）
   ---------------------------------------------------------------------
   重點：風扇的轉動與可變電阻的讀取轉換。
   骨架和其他節相同：**先講你認為會怎樣 → 再執行 → 說對了才算**（引擎在 shared/labkit.js）。

     A 讀取轉換（能預測）　旋鈕在某個位置，先答「轉速是多少」再執行
     B 範圍（能解釋）　　　下限寫成 0 → 風扇不會反轉，中間也不停了
     C 自己調（能調整）　　填出兩個數字，做到指定的效果

   這一節的核心是**負數**：程式寫的是「轉速 ← 類比對應（A7，−250，250）」，
   所以旋鈕**正中間 = 0 = 停**，往兩邊各是正轉與反轉。
   「類比對應」是專用積木，只填下限與上限兩個數字（不必自己處理 0～1023）。
   ===================================================================== */
(function (global) {
  'use strict';

  var LO = -250, HI = 250;       // 課本那組：類比對應（A7，−250，250）
  var PIN = 'A7';

  function LK() {
    if (!global.LABKIT) throw new Error('fanlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

  /** 旋鈕轉到 pct%（0＝最左、100＝最右）時，類比對應吐出什麼。 */
  function speedAt(pct, lo, hi) {
    lo = (lo === undefined) ? LO : lo;
    hi = (hi === undefined) ? HI : hi;
    return Math.round(lo + (hi - lo) * pct / 100);
  }
  /** 那個轉速代表什麼：反轉／停／正轉 */
  function stateOf(v) {
    if (v === 0) return 'stop';
    return v < 0 ? 'back' : 'fwd';
  }
  function sayState(v) {
    var s = stateOf(v);
    return s === 'stop' ? '■ 停止' : (s === 'back' ? '◀ 反轉' : '正轉 ▶');
  }

  /* ── A：旋鈕在這裡，轉速是多少？ ─────────────────────
     只取 5% 的倍數（一定整除、好念），避開兩端。
     中間那個 0 最重要：旋鈕在正中間馬達是**停的**，學生最容易以為那是「一半的速度」。 */
  function caseA(rng, prev) {
    var spots = [];
    for (var p = 5; p <= 95; p += 5) spots.push(p);
    for (var g = 0; g < 40; g++) {
      var pct = spots[Math.floor(rng() * spots.length) % spots.length];
      var v = speedAt(pct);
      var c = { pct: pct, answer: v, state: stateOf(v) };
      if (!prev || c.pct !== prev.pct) return c;
    }
    return { pct: 50, answer: 0, state: 'stop' };
  }
  function judgeA(pred, c) {
    var t = String(pred).trim();
    var n = Number(t);
    return { ok: t !== '' && isFinite(n) && n === c.answer, answer: c.answer };
  }
  /** 回饋要指出是哪一種想錯，不是只說數字不對 */
  function sayA(pred, c) {
    var t = String(pred).trim(), n = Number(t);
    /* 最常見：把它當成 0～250 來算（忘了下限是負的） */
    if (isFinite(n) && n === Math.round(HI * c.pct / 100))
      return '⚠️ 你是照 **0 到 ' + HI + '** 算的。再看一次那一行：' +
             '下限是 **' + LO + '**，是**負的** —— 所以旋鈕在左半邊時，轉速會是負數。';
    if (isFinite(n) && n === Math.abs(c.answer) && c.answer < 0)
      return '⚠️ 大小對了，但**少了負號**。負號不是裝飾 —— 它代表馬達**往反方向轉**。';
    if (c.state === 'stop')
      return '⚠️ 旋鈕停在正中間。從 ' + LO + ' 走到 ' + HI + '，正中間會是哪個數字？';
    return '從 ' + LO + '（最左）走到 ' + HI + '（最右），旋鈕在 ' + c.pct +
           '% 的位置，會落在哪裡？';
  }

  /* ── B：三組情境，壞的都是「下限沒有寫成負的」───────── */
  var CASES_B = [
    { key: 'fan', thing: '下限',
      code: '重複無限次｜轉速 ← 類比對應（A7，<b>0</b>，250）、設定馬達 = 轉速',
      symptom: '這一支要做的是「中間停、兩邊反轉」，可是風扇**永遠只往同一邊轉**，' +
               '而且要把旋鈕轉到**最左邊**才停得下來。',
      fixes: [
        { key: 'neg', good: true,
          text: '把下限從 0 改成 −250',
          after: '旋鈕轉到正中間就停了，往兩邊各是正轉和反轉 —— 這才是我們要的。' +
                 '（⚠️ 反過來說：如果你要的是「只往一邊轉、轉到底才最快」，那 0 就是對的。）' },
        { key: 'half', good: false,
          text: '把上限從 250 改成 125，讓它慢一點',
          after: '整體變慢了，但還是只往同一邊轉，中間也還是不會停 —— 快慢和方向是兩件事。' },
        { key: 'swap', good: false,
          text: '把 0 和 250 對調，寫成 (250, 0)',
          after: '⚠️ 這樣會動，但**整個反過來**：旋鈕往右轉反而變慢。' +
                 '而且還是不會反轉 —— 因為兩個數字都不是負的。' }
      ] },
    { key: 'car', thing: '下限',
      code: '重複無限次｜速度 ← 類比對應（A7，<b>0</b>，250）、設定馬達 = 速度',
      symptom: '這一支要做的是遙控車「前進／停／後退」，可是車子**只會前進**，' +
               '油門收到底才停 —— 完全倒不了車。',
      fixes: [
        { key: 'neg', good: true,
          text: '把下限從 0 改成 −250',
          after: '扳機推到中間是停，往前推前進、往後拉後退 —— 這才是遙控車該有的手感。' },
        { key: 'wait', good: false,
          text: '加一個「等待 0.5 秒」讓它反應慢一點',
          after: '只是變遲鈍，倒車還是倒不了 —— 那和「能不能給負數」沒有關係。' },
        { key: 'motor', good: false,
          text: '換一顆比較大的馬達',
          after: '力氣變大了，但方向還是只有一個 —— 問題不在馬達，在那個 0。' }
      ] },
    { key: 'lift', thing: '下限',
      code: '重複無限次｜升降 ← 類比對應（A7，<b>0</b>，250）、設定馬達 = 升降',
      symptom: '這一支要做的是升降台「上升／停/下降」，可是台子**只會往上**，' +
               '而且要把旋鈕轉到底才停。',
      fixes: [
        { key: 'neg', good: true,
          text: '把下限從 0 改成 −250',
          after: '旋鈕在中間就停住，往一邊上升、往另一邊下降 —— 這才停得住。' },
        { key: 'stop', good: false,
          text: '加一個「停止」按鈕',
          after: '⚠️ 這樣確實停得下來，但**下降還是做不到** —— ' +
                 '而且本來就該用旋鈕停，多一顆按鈕是繞路。' },
        { key: 'range', good: false,
          text: '把上限改成 500，讓它力氣更大',
          after: '⚠️ 馬達吃不到 500（上限就是 250），而且方向的問題完全沒解決。' }
      ] }
  ];
  function caseB(rng, prev) { return LK().pick(rng, CASES_B, prev); }

  /* B 的第三階段：用自己的話說 */
  var SAY = {
    need: [
      { name: '負數代表反方向',
        any: ['負', '反轉', '反方向', '倒', '反過來', '另一邊', '反著'] },
      { name: '中間才會是 0（停）',
        any: ['中間', '0', '停', '零', '不動', '不會轉'] }
    ],
    min: 8,
    full: 1
  };
  function saySpec(c) {
    c = c || CASES_B[0];
    var good = c.fixes.filter(function (f) { return f.good; })[0] || {};
    return { need: SAY.need, full: SAY.full, min: SAY.min,
             q: '為什麼下限要寫成負的？',
             src: ['為什麼下限要寫成負的', good.text || '', good.after || '', c.symptom] };
  }
  function judgeSay(text, c) { return LK().judgeSay(text, saySpec(c)); }

  /* ── C：自己填兩個數字 ──────────────────────────────
     目標隨機，背不起來：
         both   中間停、兩邊都會轉（−250～250）
         oneway 只往一邊轉、轉到底最快（0～250）
         rev    只往反邊轉（−250～0）
     判定分得出「對調」「方向不對」「沒用滿」。 */
  var GOALS = [
    { key: 'both',   want: [-250, 250],
      text: '旋鈕**中間停**，往一邊正轉、往另一邊反轉，兩邊都要能到最快' },
    { key: 'oneway', want: [0, 250],
      text: '**只往一個方向**轉：旋鈕最左邊停住，轉到最右邊最快' },
    { key: 'rev',    want: [-250, 0],
      text: '**只往反方向**轉：旋鈕最右邊停住，轉到最左邊反轉最快' }
  ];
  function caseC(rng, prev) { return LK().pick(rng, GOALS, prev); }
  function judgeC(lo, hi, c) {
    var a = String(lo).trim(), b = String(hi).trim();
    var n1 = Number(a), n2 = Number(b);
    if (a === '' || b === '' || !isFinite(n1) || !isFinite(n2))
      return { ok: false, how: 'bad' };
    if (n1 === c.want[0] && n2 === c.want[1]) return { ok: true, how: 'fit' };
    /* 對調：會動，但整個反過來 */
    if (n1 === c.want[1] && n2 === c.want[0]) return { ok: false, how: 'swap' };
    /* 方向對但沒用滿（例如 −100～100） */
    var sameSign = (n1 < 0) === (c.want[0] < 0) && (n2 > 0) === (c.want[1] > 0);
    if (sameSign) return { ok: false, how: 'range' };
    return { ok: false, how: 'dir' };
  }
  function sayC(r, c) {
    if (r.how === 'fit')  return '✅ 對了 —— ' + c.text.replace(/\*\*/g, '');
    if (r.how === 'swap')
      return '⛔ 兩個數字**對調**了。這樣馬達會動，但方向整個反過來：' +
             '旋鈕往右轉反而變慢。';
    if (r.how === 'range')
      return '⛔ 方向對了，但**沒有用滿** —— 馬達收得到的最大是 250，' +
             '寫小一點就永遠轉不到最快。';
    if (r.how === 'dir')
      return '⛔ 方向不對。⚠️ 先想清楚：這一題要**停在哪裡**？' +
             '停的那一端要填 0，會轉的那一端才填 250 或 −250。';
    return '兩格都要填數字。';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.fn-stage{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:12px 0}' +
  '.fn-knob{width:100%;height:34px;margin:6px 0 2px;accent-color:#f59e0b;cursor:pointer}' +
  '.fn-tick{display:flex;justify-content:space-between;font-size:12px;font-weight:900;color:#94a3b8}' +
  '.fn-val{text-align:center;font-size:32px;font-weight:900;margin:8px 0 2px}' +
  '.fn-val.stop{color:#475569}.fn-val.fwd{color:#047857}.fn-val.back{color:#be123c}' +
  '.fn-state{text-align:center;font-size:15px;font-weight:900;color:#64748b;margin-bottom:6px}' +
  '.fn-fan{text-align:center;font-size:46px;line-height:1}' +
  '.fn-n{font-size:20px;font-weight:900;width:110px;padding:10px 12px;' +
    'border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.fn-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;' +
    'font-weight:900;font-size:15px}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('fanlab-css')) return;
    var st = document.createElement('style');
    st.id = 'fanlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  /** 風扇圖（labkit 那顆會轉的風扇）＋轉速數字＋狀態 */
  function fanHtml(v) {
    var s = stateOf(v);
    return LK().fanHtml(v, HI) +
           '<div class="fn-val ' + s + '">' + v + '</div>' +
           '<div class="fn-state">' + sayState(v) + '</div>';
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
    var bPicked = false, bFix = null, sayText = '';

    function tabs() {
      return LK().tabsHtml(['A', 'B', 'C'],
        { A: 'A 讀取轉換', B: 'B 為什麼要負的', C: 'C 自己調範圍' }, step, done);
    }
    function view(inner, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + inner +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + LK().md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }

    /* ── A ── */
    function viewA(msg, cls, show) {
      view(
        '<div class="dl-ask">程式裡寫的是：<br>' +
        '<span style="font-family:monospace;font-size:14px">轉速 ← 類比對應（' + PIN +
          '，' + LO + '，' + HI + '）</span><br>' +
        '旋鈕現在轉到 <b>' + aCase.pct + '%</b>（0%＝最左、100%＝最右）。<br>' +
        '⚠️ 先講：<b>轉速</b>會是多少？</div>' +
        '<div class="fn-stage">' +
          '<div class="fn-tick"><span>最左 0%</span><span>中間 50%</span><span>最右 100%</span></div>' +
          (show ? fanHtml(aCase.answer)
                : '<div class="fn-fan">❓</div><div class="fn-state">按下去才知道</div>') +
        '</div>' +
        '<div class="dl-row"><input class="dl-num" id="fn-pred" placeholder="?"> ' +
        '<button class="dl-go" id="fn-runA">送出並執行</button></div>',
        msg, cls);
    }
    function doA() {
      tries.A++;
      var j = judgeA(el.querySelector('#fn-pred').value, aCase);
      if (j.ok) {
        done.A = true; step = 'B';
        viewB('✅ A 完成：' + aCase.pct + '% → ' + aCase.answer + '（' +
              sayState(aCase.answer) + '）。', 'good');
        return;
      }
      var msg = sayA(el.querySelector('#fn-pred').value, aCase);
      var old = aCase;
      aCase = caseA(rng, aCase);        // 猜錯換一題
      viewA('', 'bad', false);
      /* 先把剛才那一題的答案畫出來，只說「錯了」學不到東西 */
      el.querySelector('.fn-stage').innerHTML =
        '<div class="fn-tick"><span>剛才那一題：' + old.pct + '%</span><span></span><span></span></div>' +
        fanHtml(old.answer);
      var d = document.createElement('div');
      d.className = 'dl-msg bad'; d.innerHTML = LK().md(msg + '　**換一題**再試一次。');
      el.querySelector('.dl-wrap').appendChild(d);
    }

    /* ── B ── 三階段：選修法 → 先講會發生什麼 → 用自己的話說 */
    function goodFix() { return bCase.fixes.filter(function (f) { return f.good; })[0]; }
    function viewB(msg, cls) {
      var head =
        '<div class="dl-ask">下面這段程式的<b>' + esc(bCase.thing) + '寫成 0</b>：<br>' +
        '<span style="font-family:monospace;font-size:14px">' + bCase.code + '</span><br>' +
        esc(bCase.symptom) + '你會怎麼修？</div>';
      if (bFix) {
        var o2 = bCase.fixes.slice().sort(function () { return rng() - 0.5; });
        return view(head +
          '<div class="dl-note">你選的是：<b>' + esc(bFix.text) + '</b></div>' +
          '<div class="dl-ask" style="margin-top:14px">⚠️ 先講：<b>執行之後會看到什麼？</b></div>' +
          o2.map(function (f) {
            return '<button class="dl-opt" data-pred="' + f.key + '">' + esc(f.after) + '</button>';
          }).join(''), msg, cls);
      }
      view(head +
        (bPicked
          ? '<div class="dl-note">✅ 你選的是：<b>' + esc(goodFix().text) + '</b></div>' +
            LK().sayHtml({ q: saySpec(bCase).q, text: sayText })
          : bCase.fixes.slice().sort(function () { return rng() - 0.5; }).map(function (f) {
              return '<button class="dl-opt" data-fix="' + f.key + '">' + esc(f.text) + '</button>';
            }).join('')),
        msg, cls);
    }
    function doB(key) {
      tries.B++;
      bFix = bCase.fixes.filter(function (x) { return x.key === key; })[0] || null;
      viewB('', '');            // 還不執行，先問「你認為會發生什麼」
    }
    function doPred(key) {
      var f = bFix, predOk = (key === f.key);
      bFix = null;
      if (f.good && predOk) {
        bPicked = true;
        return viewB('✅ 你不但修對了，也**說得出**會發生什麼。　**最後一步**：說說看為什麼。', 'good');
      }
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
      viewB('⚠️ 再想一次：如果下限是 0，旋鈕轉到**正中間**會得到什麼數字？' +
            '那個數字代表馬達在做什麼？', 'bad');
    }
    function passB(res) {
      done.B = true; step = 'C';
      if (typeof opts.onSay === 'function') opts.onSay(sayText, res);
      viewC('✅ B 完成：' + (res.why || '你說得出為什麼下限要寫成負的。'), 'good');
    }

    /* ── C ── */
    function viewC(msg, cls) {
      view(
        '<div class="dl-ask">🎚️ 目標：' + LK().md(cCase.text) + '<br>' +
        '⚠️ 兩格都要自己填（馬達收得到的最大是 ' + HI + '）。</div>' +
        '<div class="fn-row">轉速 ← 類比對應（' + PIN + '，' +
          '<input class="fn-n" id="fn-lo" placeholder="下限">，' +
          '<input class="fn-n" id="fn-hi" placeholder="上限">）</div>' +
        '<div class="dl-row"><button class="dl-go" id="fn-runC">送出並執行</button></div>',
        msg, cls);
    }
    function doC() {
      tries.C++;
      var r = judgeC(el.querySelector('#fn-lo').value, el.querySelector('#fn-hi').value, cCase);
      if (!r.ok) { viewC(sayC(r, cCase), 'bad'); return; }
      done.C = true;
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">' + LK().md(
          '🎉 三個檢核都完成了！\n你證明了三件事：**算得出**旋鈕轉到哪會得到什麼轉速、' +
          '**說得出**為什麼下限要是負的、**自己調得出**兩個數字做到指定的效果。'
        ).replace(/\n/g, '<br>') + '</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
    }

    function bind() {
      var a = el.querySelector('#fn-runA'); if (a) a.addEventListener('click', doA);
      var c = el.querySelector('#fn-runC'); if (c) c.addEventListener('click', doC);
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

    viewA('', '', false);
    return { step: function () { return step; }, tries: function () { return tries; },
             say: function () { return sayText; },
             aCase: function () { return aCase; }, bCase: function () { return bCase; },
             cCase: function () { return cCase; }, bFix: function () { return bFix; } };
  }

  global.FANLAB = {
    LO: LO, HI: HI, PIN: PIN, CASES_B: CASES_B, GOALS: GOALS, SAY: SAY,
    speedAt: speedAt, stateOf: stateOf, sayState: sayState,
    caseA: caseA, judgeA: judgeA, sayA: sayA,
    caseB: caseB, judgeSay: judgeSay,
    caseC: caseC, judgeC: judgeC, sayC: sayC,
    mount: mount
  };

})(window);
