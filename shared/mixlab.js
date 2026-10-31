/* =====================================================================
   情境照明：三個概念的檢核（5016B 第四節）
   ---------------------------------------------------------------------
   重點：R G B 三原色的混色原理（色相換算的公式不解釋）。
   骨架和其他節相同（引擎在 shared/labkit.js）：
     A 能預測　給三個數字，先講**看起來會是什麼顏色**，再執行
     B 能解釋　三組情境，壞的都是**上限寫成 255**
     C 能調整　自己填「類比對應」的兩個數字，做到指定的變色範圍

   A 刻意和暖身**方向相反**：暖身是「給顏色，你去調數字」（有即時預覽）；
   這裡是「給數字，你先說會是什麼顏色」（沒有預覽）。方向一樣的話就只是再做一次。

   B 針對這門課最容易混的地方 —— 出現過三個不同的範圍：
     0～1023　A7 讀到的原始值（第三節）
     0～255 　每一盞燈的亮度（紅綠藍）
     0～359 　色環轉一圈（色相）
   把 359 寫成 255 不會報錯，只是顏色少了一截 —— 這種「能動但不對」的錯，說得出原因才算懂。
   ===================================================================== */
(function (global) {
  'use strict';

  var PIN = 'A7';
  var HUE_MAX = 359;             // 色環一圈：類比對應（A7，0，359）
  var LEVEL = 255;               // 每一盞燈的亮度上限
  var ADC_MAX = 1023;            // A7 讀到的原始值（第三節那把尺）

  function LK() {
    if (!global.LABKIT) throw new Error('mixlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function rngFrom(seed) {
    if (global.ULTRALAB && global.ULTRALAB.rngFrom) return global.ULTRALAB.rngFrom(seed);
    return Math.random;
  }

  /* ── A：給三個數字 → 先講會是什麼顏色 ─────────────────
     每個錯的選項都是學生真的會選的：
        紅＋綠 → 咖啡色（顏料的直覺）
        三盞全開 → 黑色（以為會互相抵消）
        三盞全關 → 白色（以為「沒設定」就是預設白） */
  var A_CASES = [
    { key: 'yellow', rgb: [255, 255, 0], name: '黃色',
      wrong: ['咖啡色', '橙色', '綠色'],
      why: '紅光＋綠光＝**黃光**。⚠️ 顏料的紅加綠會變濁，光不是 —— 光是加上去的。' },
    { key: 'cyan', rgb: [0, 255, 255], name: '青色',
      wrong: ['深藍色', '綠色', '白色'],
      why: '綠光＋藍光＝**青色**（天空藍那種），而且比單獨一盞更亮。' },
    { key: 'magenta', rgb: [255, 0, 255], name: '洋紅色',
      wrong: ['紫黑色', '紅色', '藍色'],
      why: '紅光＋藍光＝**洋紅**（桃紅色）。' },
    { key: 'white', rgb: [255, 255, 255], name: '白色',
      wrong: ['黑色', '灰色', '咖啡色'],
      why: '★ 三盞全開＝**白光**。這是光和顏料差最多的地方 —— 顏料三色混在一起是濁黑的。' },
    { key: 'black', rgb: [0, 0, 0], name: '不亮（黑）',
      wrong: ['白色', '灰色', '紅色'],
      why: '⚠️ 黑色不是一種光，是**沒有光**。三盞都關掉，燈就是不亮。' }
  ];
  function caseA(rng, prev) { return LK().pick(rng, A_CASES, prev); }
  function optsA(c, rng) {
    var list = [{ t: c.name, good: true }].concat(c.wrong.map(function (w) {
      return { t: w, good: false };
    }));
    /* 洗牌：正解不可以永遠在第一個 */
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  function judgeA(pick, c) { return pick === c.name; }
  function sayA(pick, c) {
    /* 顏料那一族的錯要點名，不然學生只會覺得「我猜錯了」 */
    if (/咖啡|濁|灰/.test(String(pick)))
      return '⛔ 那是**顏料**的規矩 —— 顏料越混越暗。' +
             '燈是把光**加上去**的，越混越亮。';
    if (String(pick) === '黑色' || String(pick) === '不亮（黑）')
      return '⛔ 三盞燈開著不會互相抵消 —— 光沒有「負的」。' +
             '要黑的只有一個辦法：三盞**都關掉**。';
    if (String(pick) === '白色')
      return '⛔ 白光要**三盞都開**才會出現。少開一盞就偏成別的顏色了。';
    return '⛔ 再看一次那三個數字：**哪幾盞是開著的**？把它們的光加起來會是什麼？';
  }

  /* ── B：三組情境，壞的都是「上限寫成 255」───────────
     症狀刻意是「能動，但少了一截」：不會報錯，只能靠「說得出為什麼」來檢核。 */
  var CASES_B = [
    { key: 'mood', thing: '上限',
      code: '重複無限次｜色相 ← 類比對應（A7，0，<b>255</b>）、燈條顏色 ← 色相',
      symptom: '這一支要做的是氣氛燈「旋鈕轉一圈，顏色也繞一圈回到紅色」，' +
               '可是旋鈕**轉到底了，顏色卻停在洋紅**，紅色一直回不來。',
      fixes: [
        { key: 'max', good: true,
          text: '把上限從 255 改成 359',
          after: '旋鈕轉到底時剛好繞完整個色環回到紅色 —— 這才是「轉一圈」。' },
        { key: 'lo', good: false,
          text: '把下限從 0 改成 1',
          after: '幾乎沒有差別 —— 少的那一截在**後面**，不在前面。' },
        { key: 'bright', good: false,
          text: '把燈條調亮一點',
          after: '⚠️ 變亮了，但**顏色還是走不完** —— 亮度和色環是兩件事。' }
      ] },
    { key: 'sign', thing: '上限',
      code: '重複無限次｜色相 ← 類比對應（A7，0，<b>255</b>）、招牌顏色 ← 色相',
      symptom: '這一支要做的是招牌「旋鈕慢慢轉，七彩跑一輪」，' +
               '可是**紅色和粉紅色那一段永遠出不來**，轉到底就沒了。',
      fixes: [
        { key: 'max', good: true,
          text: '把上限從 255 改成 359',
          after: '色環最後那一段（洋紅回到紅）補回來了，七彩才真的跑完一輪。' },
        { key: 'speed', good: false,
          text: '加一個「等待 0.1 秒」讓它轉慢一點',
          after: '只是變慢，**能到的顏色還是那些** —— 走不到的地方不會因為慢就走到。' },
        { key: 'swap', good: false,
          text: '把 0 和 255 對調，寫成 (255, 0)',
          after: '⚠️ 顏色會**反著跑**（從洋紅倒回紅），但能到的範圍一樣少一截。' }
      ] },
    { key: 'night', thing: '上限',
      code: '重複無限次｜色相 ← 類比對應（A7，0，<b>255</b>）、夜燈顏色 ← 色相',
      symptom: '這一支要做的是夜燈「想調成什麼顏色都可以」，' +
               '可是不管怎麼轉，**就是調不出紅色**，最紅只能到橙色。',
      fixes: [
        { key: 'max', good: true,
          text: '把上限從 255 改成 359',
          after: '整個色環都到得了，紅色自然就調得出來了。' },
        { key: 'led', good: false,
          text: '換一條紅色比較亮的燈條',
          after: '⚠️ 燈條本來就做得出紅色 —— 是**那個數字沒讓它走到那裡**。' },
        { key: 'level', good: false,
          text: '把上限改成 1023（A7 讀到的最大值）',
          after: '⚠️ 這是把**讀到的範圍**當成色環的範圍。色環一圈只有 0～359，' +
                 '寫 1023 會讓顏色繞好幾圈，轉一點點就跳掉。' }
      ] }
  ];
  function caseB(rng, prev) { return LK().pick(rng, CASES_B, prev); }

  /* B 的第三階段：用自己的話說 */
  var SAY = {
    need: [
      { name: '色環一圈是 0～359',
        any: ['359', '360', '一圈', '色環', '繞', '一輪', '整圈'] },
      { name: '255 是亮度的範圍，不是角度',
        any: ['255', '亮度', '不一樣', '不同', '深淺', '每一盞', '三個數字', '搞混'] }
    ],
    min: 8,
    full: 1
  };
  function saySpec(c) {
    c = c || CASES_B[0];
    var good = c.fixes.filter(function (f) { return f.good; })[0] || {};
    return { need: SAY.need, full: SAY.full, min: SAY.min,
             q: '為什麼上限要寫 ' + HUE_MAX + '，不是 ' + LEVEL + '？',
             src: ['為什麼上限要寫 359 不是 255', good.text || '', good.after || '', c.symptom] };
  }
  function judgeSay(text, c) { return LK().judgeSay(text, saySpec(c)); }

  /* ── C：自己填「類比對應」的兩個數字 ─────────────────
     目標隨機，背不起來。判定分得出「超過一圈」「對調」「把亮度 255 當上限」「範圍不夠」。 */
  var GOALS = [
    { key: 'full', want: [0, 359],
      text: '旋鈕轉一圈，顏色**繞完整個色環**再回到紅色' },
    { key: 'warm', want: [0, 60],
      text: '只在**紅色到黃色之間**變化（暖色系夜燈，不要出現藍綠）' },
    { key: 'half', want: [0, 180],
      text: '旋鈕轉到底剛好走**半圈**：從紅色變到青色' }
  ];
  function caseC(rng, prev) { return LK().pick(rng, GOALS, prev); }
  function judgeC(lo, hi, c) {
    var a = String(lo).trim(), b = String(hi).trim();
    var n1 = Number(a), n2 = Number(b);
    if (a === '' || b === '' || !isFinite(n1) || !isFinite(n2))
      return { ok: false, how: 'bad' };
    if (n1 === c.want[0] && n2 === c.want[1]) return { ok: true, how: 'fit' };
    if (n1 === c.want[1] && n2 === c.want[0]) return { ok: false, how: 'swap' };
    /* 超過 359：顏色會繞好幾圈，轉一點點就跳掉 */
    if (n2 > HUE_MAX || n1 > HUE_MAX) return { ok: false, how: 'over' };
    /* 把亮度的 255 拿來當色環上限（B 講過的那個錯） */
    if (n2 === LEVEL) return { ok: false, how: 'level' };
    return { ok: false, how: 'range' };
  }
  function sayC(r, c) {
    if (r.how === 'fit') return '✅ 對了 —— ' + c.text.replace(/\*\*/g, '');
    if (r.how === 'swap')
      return '⛔ 兩個數字**對調**了。顏色會**反著跑**（往右轉反而倒回去）。';
    if (r.how === 'over')
      return '⛔ 超過 ' + HUE_MAX + ' 了。色環一圈就是 0～' + HUE_MAX + ' —— ' +
             '寫更大只會讓顏色**繞好幾圈**，旋鈕轉一點點顏色就跳掉。';
    if (r.how === 'level')
      return '⛔ ' + LEVEL + ' 是**每一盞燈的亮度**上限，不是色環的角度。' +
             '（B 那一題就是這個錯。）';
    if (r.how === 'range')
      return '⛔ 範圍不對。⚠️ 先想清楚：這一題要走**多少度**？' +
             '整圈是 ' + HUE_MAX + '、半圈是 180、紅到黃大約是 60。';
    return '兩格都要填數字。';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.mx-nums{display:flex;gap:10px;justify-content:center;margin:12px 0}' +
  '.mx-num{text-align:center;font-weight:900;font-size:15px;padding:9px 14px;border-radius:12px;' +
    'border:2px solid #e2e8f0;min-width:74px}' +
  '.mx-num.r{color:#ef4444;border-color:#fecaca}' +
  '.mx-num.g{color:#16a34a;border-color:#bbf7d0}' +
  '.mx-num.b{color:#2563eb;border-color:#bfdbfe}' +
  '.mx-num span{display:block;font-size:12px;color:#94a3b8;font-weight:800}' +
  '.mx-stage{background:#0f172a;border-radius:14px;padding:16px;margin:12px 0}' +
  '.mx-strip{display:flex;gap:5px;justify-content:center}' +
  '.mx-led{width:30px;height:30px;border-radius:50%;border:2px solid #334155}' +
  '.mx-hint{text-align:center;color:#94a3b8;font-weight:900;font-size:15px;margin-top:8px}' +
  '.mx-row{text-align:center;font-family:monospace;font-size:15px;font-weight:900;margin:12px 0}' +
  '.mx-n{width:90px;font-size:17px;font-weight:900;padding:8px 10px;text-align:center;' +
    'border:2px solid #cbd5e1;border-radius:10px;font-family:inherit}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('mixlab-css')) return;
    var st = document.createElement('style');
    st.id = 'mixlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function hex(rgb) {
    return '#' + rgb.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }
  function stripHtml(rgb, show) {
    var c = show ? hex(rgb) : '#1e293b';
    var leds = '';
    for (var i = 0; i < 8; i++) {
      leds += '<div class="mx-led" style="background:' + c +
        (show && c !== '#000000' ? ';box-shadow:0 0 14px ' + c : '') + '"></div>';
    }
    return '<div class="mx-stage"><div class="mx-strip">' + leds + '</div>' +
      '<div class="mx-hint">' + (show ? '執行結果' : '按下去才知道') + '</div></div>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc;
    var rng = rngFrom(opts.seed);
    var step = 'A';
    var done = { A: false, B: false, C: false };
    var tries = { A: 0, B: 0, C: 0 };
    var aCase = caseA(rng, null), bCase = caseB(rng, null), cCase = caseC(rng, null);
    var bPicked = false, bFix = null, sayText = '';

    function tabs() {
      return LK().tabsHtml(['A', 'B', 'C'],
        { A: 'A 混出什麼色', B: 'B 為什麼是 359', C: 'C 自己調範圍' }, step, done);
    }
    function view(inner, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + inner +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + LK().md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }

    /* ── A ── */
    function viewA(msg, cls, show) {
      var list = optsA(aCase, rng);
      view(
        '<div class="dl-ask">程式把燈條的三盞燈設成這樣：</div>' +
        '<div class="mx-nums">' +
          '<div class="mx-num r"><span>紅</span>' + aCase.rgb[0] + '</div>' +
          '<div class="mx-num g"><span>綠</span>' + aCase.rgb[1] + '</div>' +
          '<div class="mx-num b"><span>藍</span>' + aCase.rgb[2] + '</div>' +
        '</div>' +
        stripHtml(aCase.rgb, !!show) +
        '<div class="dl-ask">⚠️ 先講：燈條看起來會是<b>什麼顏色</b>？</div>' +
        list.map(function (o) {
          return '<button class="dl-opt" data-a="' + esc(o.t) + '">' + esc(o.t) + '</button>';
        }).join(''),
        msg, cls);
    }
    function doA(pick) {
      tries.A++;
      if (judgeA(pick, aCase)) {
        done.A = true; step = 'B';
        viewB('✅ A 完成：' + aCase.why, 'good');
        return;
      }
      var msg = sayA(pick, aCase);
      var old = aCase;
      aCase = caseA(rng, aCase);          // 猜錯換一題
      viewA('', 'bad', false);
      /* 先把剛才那一題的答案畫出來，只說「錯了」學不到東西 */
      var d = document.createElement('div');
      d.className = 'dl-msg bad';
      d.innerHTML = LK().md(msg + '　剛才那一題的答案是**' + old.name + '**。' +
                            old.why + '　**換一題**再試一次。');
      el.querySelector('.dl-wrap').appendChild(d);
    }

    /* ── B ── 三階段：選修法 → 先講會發生什麼 → 用自己的話說 */
    function goodFix() { return bCase.fixes.filter(function (f) { return f.good; })[0]; }
    function viewB(msg, cls) {
      var head =
        '<div class="dl-ask">下面這段程式的<b>' + esc(bCase.thing) + '寫成 ' + LEVEL + '</b>：<br>' +
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
      viewB('⚠️ 再想一次：這門課出現過三個範圍 —— ' +
            '**' + ADC_MAX + '**（A7 讀到的）、**' + LEVEL + '**（每一盞燈的亮度）、' +
            '**' + HUE_MAX + '**（色環一圈）。色相要用哪一個？為什麼？', 'bad');
    }
    function passB(res) {
      done.B = true; step = 'C';
      viewC('✅ B 完成：' + (res.why || '你說得出色環一圈是 0～' + HUE_MAX +
            '，和亮度的 0～' + LEVEL + ' 是兩回事。'), 'good');
      if (typeof opts.onSay === 'function') opts.onSay(sayText, res);
    }

    /* ── C ── */
    function viewC(msg, cls) {
      view(
        '<div class="dl-ask">🎚️ 目標：' + LK().md(cCase.text) + '<br>' +
        '⚠️ 兩格都要自己填（色環一圈是 0～' + HUE_MAX + '）。</div>' +
        '<div class="mx-row">色相 ← 類比對應（' + PIN + '，' +
          '<input class="mx-n" id="mx-lo" placeholder="下限">，' +
          '<input class="mx-n" id="mx-hi" placeholder="上限">）</div>' +
        '<div class="dl-row"><button class="dl-go" id="mx-runC">送出並執行</button></div>',
        msg, cls);
    }
    function doC() {
      tries.C++;
      var r = judgeC(el.querySelector('#mx-lo').value, el.querySelector('#mx-hi').value, cCase);
      if (!r.ok) { viewC(sayC(r, cCase), 'bad'); return; }
      done.C = true;
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">' + LK().md(
          '🎉 三個檢核都完成了！\n你證明了三件事：**看得出**三個數字會混成什麼顏色、' +
          '**說得出**色環的 ' + HUE_MAX + ' 為什麼不是亮度的 ' + LEVEL + '、' +
          '**自己調得出**兩個數字做到指定的變色範圍。'
        ).replace(/\n/g, '<br>') + '</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
    }

    function bind() {
      var c = el.querySelector('#mx-runC'); if (c) c.addEventListener('click', doC);
      var s = el.querySelector('#dl-runB'); if (s) s.addEventListener('click', doSay);
      var t = el.querySelector('#dl-say');
      if (t) t.addEventListener('input', function () { sayText = t.value; });
      el.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', function () { doA(b.getAttribute('data-a')); });
      });
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

  global.MIXLAB = {
    PIN: PIN, HUE_MAX: HUE_MAX, LEVEL: LEVEL, ADC_MAX: ADC_MAX,
    A_CASES: A_CASES, CASES_B: CASES_B, GOALS: GOALS, SAY: SAY,
    hex: hex, caseA: caseA, optsA: optsA, judgeA: judgeA, sayA: sayA,
    caseB: caseB, judgeSay: judgeSay,
    caseC: caseC, judgeC: judgeC, sayC: sayC,
    mount: mount
  };

})(window);
