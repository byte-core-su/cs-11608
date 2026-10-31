/* =====================================================================
   換算（對應）暖身關卡 —— 5016B 第二節「迎賓走廊」
   ---------------------------------------------------------------------
   這一節不再教超音波原理（第一節教過了），距離只是輸入來源，
   要練的是「拿到那個數字之後怎麼換算」，強調**反向**換算。

   四個節點：
     ① 兩把尺要對齊　　正向，數字刻意好算
     ② 把箭頭轉過來　　反向，自己算出值（先拉一遍體驗）
     ③ 哪一個才是「越近越亮」　選出正確寫法
     ④ 除不盡的時候　　用課本真正那組（55→1、1→8）算一次

   為什麼 ②③ 都在講反向：真正的程式寫的是 對應(距離, 55→1, 1→200) —— 輸入範圍是倒過來的。
   學生最常寫成 1→55，結果變成「越遠越亮」，而畫面上「燈會亮」看起來像是成功了 ——
   這種錯自己看不出來，只有把兩種寫法擺在一起才發現。

   ①②③ 的數字一律取「整除」的組合（不要讓學生卡在除法，而不是卡在概念）；
   第 ④ 個節點刻意除不盡 —— 漂亮數字和實機不一樣，那個落差要正面講。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('maplab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  /** 亂數：沿用暖身那一套 seed（同一個 seed 全班同題）。 */
  function rngFrom(seed) {
    if (global.ULTRALAB && global.ULTRALAB.rngFrom) return global.ULTRALAB.rngFrom(seed);
    return Math.random;
  }

  /* ── 換算本身 ────────────────────────────────────────
     Scratch 的「對應」積木：對應(值, 從a→從b, 到c→到d)
     ⚠️ 從a→從b 可以是**倒過來的**（55→1），那正是這一節的重點。 */
  function mapv(v, a, b, c, d) {
    if (a === b) return c;
    return c + (v - a) * (d - c) / (b - a);
  }

  /* 好算的範圍組合。★ 每一組都保證「中點」與題目用到的值都是整數。 */
  var RANGES = [
    { hi: 50,  out: 100 },     // 倍率 2
    { hi: 20,  out: 100 },     // 倍率 5
    { hi: 40,  out: 200 },     // 倍率 5
    { hi: 100, out: 200 },     // 倍率 2
    /* ⚠️ 這兩組**除不盡**（倍率 10/3）—— 刻意留著。
       全部都是整數倍的話，下面那支 cleanSpots() 就永遠篩不掉東西，
       等於一段沒作用的程式（而下一個人會以為它在保護什麼）。
       有了這兩組，「只出算得出整數的位置」才是真的在做事。 */
    { hi: 30,  out: 100 },
    { hi: 60,  out: 200 }
  ];

  /* 這把尺上，哪些距離換算出來是**整數**：整把尺掃過一遍，
     只留正向與反向都算得出整數的位置，而且排除兩端（0 和滿格太好猜）。 */
  function cleanSpots(hi, out) {
    var list = [];
    for (var d = 1; d < hi; d++) {
      var f = mapv(d, 0, hi, 0, out), b = mapv(d, hi, 0, 0, out);
      if (f === Math.round(f) && b === Math.round(b)) list.push(d);
    }
    return list;
  }

  /* ── ④ 除不盡的時候 ──────────────────────────────
     課本那組 對應(距離, 55→1, 1→8) 的 55 個整數距離裡，只有頭尾兩個算得出整數。
     出題只取**小數部分 0.15～0.45** 的距離：
       ① 小數 < 0.5 時，「無條件捨去」和「四捨五入」答案一樣，不必替機器的取法背書
       ② 小數太小（< 0.15）看起來像整數，學生會以為「本來就整除」 */
  /* ② 的拖曳體驗用這一把固定的示範尺（拉上方數值，下方數值反向改變）。
     出題時會把這一組排除 —— 不然學生在體驗裡拉到題目那個距離，答案就直接讀出來了。 */
  var PLAY = { hi: 50, out: 100 };

  var REAL = { hi: 55, out: 8 };          // 課本那組：對應(距離, 55→1, 1→8)
  function realMap(d) { return mapv(d, REAL.hi, 1, 1, REAL.out); }
  function spotsD() {
    var list = [];
    for (var d = 2; d < REAL.hi; d++) {
      var v = realMap(d), f = v - Math.floor(v);
      if (f >= 0.15 && f <= 0.45) list.push(d);
    }
    return list;
  }

  /** 出一題。node = 1／2／3／4；prev 是上一題（換一題時不要重複）。 */
  function caseFor(node, rng, prev) {
    var c = null;
    for (var g = 0; g < 60; g++) {
      var r = RANGES[Math.floor(rng() * RANGES.length) % RANGES.length];
      if (node === 4) {
        /* ④ 用**課本真正那組**出題 —— 這一關的重點就是「它除不盡」。 */
        var ds = spotsD();
        var dd = ds[Math.floor(rng() * ds.length) % ds.length];
        c = { hi: REAL.hi, out: REAL.out, d: dd, rev: true, real: true,
              raw: realMap(dd), answer: 'floor' };
      } else if (node === 3) {
        /* ③ 選出「越近越亮」的寫法。三個選項都是真的能執行的設定。 */
        c = { hi: r.hi, out: r.out, rev: true, answer: 'rev' };
      } else {
        /* ⚠️ ② 不出「體驗用的那一把尺」—— 見 PLAY 的說明。 */
        if (node === 2 && r.hi === PLAY.hi && r.out === PLAY.out) continue;
        var spots = cleanSpots(r.hi, r.out);
        if (!spots.length) continue;
        var d = spots[Math.floor(rng() * spots.length) % spots.length];
        var rev = (node === 2);
        c = { hi: r.hi, out: r.out, d: d, rev: rev,
              answer: rev ? mapv(d, r.hi, 0, 0, r.out) : mapv(d, 0, r.hi, 0, r.out) };
        /* ⚠️ 正向和反向剛好同值的位置要丟掉（正中間就是這樣）——
           那種題目答對了，完全不代表他知道箭頭轉過來。 */
        if (rev && c.answer === mapv(d, 0, r.hi, 0, r.out)) continue;
      }
      if (!prev || JSON.stringify(c) !== JSON.stringify(prev)) return c;
    }
    return c;
  }

  /** ③ 的三個選項。★ 錯的那兩個都要「看起來會動」—— 燈確實會亮，只是亮錯。 */
  function optsFor(c) {
    return [
      { k: 'rev',  t: '對應（距離，' + c.hi + '→0，0→' + c.out + '）',
        why: '距離大的時候對到 0，距離小的時候對到 ' + c.out + ' —— 這就是越近越亮。' },
      { k: 'fwd',  t: '對應（距離，0→' + c.hi + '，0→' + c.out + '）',
        why: '這是**越遠越亮**。燈一樣會亮，所以光看畫面看不出錯 —— 要把手靠近才會發現。' },
      { k: 'half', t: '對應（距離，0→' + c.hi + '，' + c.out + '→0）',
        why: '把**輸出**倒過來，效果和把輸入倒過來一樣 —— 也是越近越亮。' +
             '⚠️ 但這一關要練的是改輸入那一邊：程式裡寫的是 55→1。' }
    ];
  }

  /** ④ 的三個選項。★ 兩個錯的都是學生真的會想到的。 */
  function optsD(c) {
    var n = Math.floor(c.raw);
    return [
      { k: 'floor', t: '機器會自己把小數去掉，亮第 ' + n + ' 顆' },
      { k: 'none',  t: '一顆都不亮 —— 因為根本沒有「第 ' + c.raw.toFixed(1) + ' 顆」' },
      { k: 'both',  t: '第 ' + n + ' 顆和第 ' + (n + 1) + ' 顆一起亮，各亮一點點' }
    ];
  }

  function judge(node, c, ans) {
    if (node === 4) return String(ans) === 'floor';
    if (node === 3) return String(ans) === 'rev';
    var n = Number(String(ans).trim());
    return isFinite(n) && String(ans).trim() !== '' && n === c.answer;
  }

  /* ── 接回數學課 ──────────────────────────────────────
     只有 ① 是正比。**② 不是反比**：② 是 y = out − (out/hi)·x，一條往下走的直線；反比是 y = k/x。
       （hi=50、out=100：我們的② 距離 10 → 80、20 → 60；真的反比 10 → 80、20 → 40）
     「遞減＝反比」正是學生最常見的誤解之一，教材寫成反比會強化它。
     用詞：不用「遞減」「一次函數」（還沒教到），也不說反比；
     用「往下走的直線」「每多 1 公分固定少同樣多」。 */
  function mathNote(node, c) {
    if (node === 1)
      return '★ 這就是數學課的**正比**：距離變兩倍，換算出來的值也變兩倍。';
    if (node === 2) {
      var step = c.out / c.hi;
      var per = (step === Math.round(step))
        ? '距離每多 1 公分，值就固定少 ' + step
        : '距離每多 1 公分，值就固定少同樣多';
      return '這一條也是**直線**，只是往下走：' + per + '。<br>' +
             '⚠️ 注意：這**不是**數學課的反比。反比是「距離變兩倍，值變一半」；' +
             '這裡是「每多 1 公分，少的量都一樣」—— 是兩回事。';
    }
    return '';
  }

  /** 提示要**點破那個錯**，不可以直接給答案。 */
  function hintFor(node, c, ans) {
    var n = Number(String(ans).trim());
    if (node === 1) {
      if (isFinite(n) && n === Math.round(mapv(c.d, c.hi, 0, 0, c.out)))
        return '你算的是**反向**的那一種。這一題是正向（0→' + c.hi + '，兩條配對線平行）：' +
               '距離越大，出來的數字也越大。';
      return '兩把尺是對齊的：距離走了幾分之幾，出來的數字就走幾分之幾。' +
             '距離 ' + c.d + ' 走到 ' + c.hi + ' 的幾分之幾？';
    }
    if (node === 2) {
      if (isFinite(n) && n === Math.round(mapv(c.d, 0, c.hi, 0, c.out)))
        return '⚠️ 這是**正向**的答案。這一題是反向的（' + c.hi + '→0，配對線交叉）：' +
               '距離越大，出來的數字反而越小。';
      return '這一題是反向的：距離 ' + c.hi + ' 對到 0，距離 0 對到 ' + c.out + '。' +
             '那 ' + c.d + ' 會對到哪裡？';
    }
    if (node === 4) {
      if (String(ans) === 'none')
        return '⚠️ 不會「都不亮」—— 燈條照樣會亮，老師實機測過位置是對的。' +
               '再想想：機器拿到一個帶小數的編號時，最省事的做法是什麼？';
      if (String(ans) === 'both')
        return '燈珠沒辦法「亮一半」到隔壁那一顆 —— 它要嘛亮、要嘛不亮。' +
               '所以那個小數一定要先變成一個**整數的編號**。';
      return '燈條只有第 1、2、3… 顆。那個小數最後會變成哪一個編號？';
    }
    if (String(ans) === 'fwd')
      return '⚠️ 這一個是**越遠越亮**。⚠️ 注意：燈一樣會亮 —— ' +
             '所以光看畫面是對的，要把手靠近才會發現整個反了。';
    if (String(ans) === 'half')
      return '效果確實是越近越亮，但你動的是**輸出**那一邊。' +
             '再看一次：程式裡倒過來的是哪一邊？';
    return '想想看：手靠近的時候距離**變小**，而我們要燈**變亮**。';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.mp-wrap{font-size:15px}' +
  '.mp-q{font-size:16px;font-weight:900;color:#0f172a;line-height:1.9;margin-bottom:10px}' +
  '.mp-rulers{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:18px 16px 12px;margin:12px 0}' +
  '.mp-ruler{position:relative;height:52px;margin:2px 0 6px}' +
  '.mp-line{position:absolute;left:0;right:0;top:26px;height:6px;border-radius:3px;background:#cbd5e1}' +
  '.mp-line.out{background:#a5b4fc}' +
  /* 換算出來的值靠近兩端時不和說明文字重疊：
     ① 說明文字自己佔一行（不放在絕對定位那一層）
     ② 數字靠兩端時改成貼邊對齊（.at-l／.at-r），不用 translateX(-50%) 跑出框外 */
  '.mp-cap{font-size:12px;font-weight:900;color:#64748b;margin-bottom:2px}' +
  '.mp-end{position:absolute;top:36px;font-size:12px;font-weight:900;color:#94a3b8}' +
  '.mp-end.l{left:0}.mp-end.r{right:0}' +
  '.mp-pin{position:absolute;top:14px;width:2px;height:30px;background:#0891b2}' +
  '.mp-pin.out{background:#4f46e5}' +
  '.mp-pin b{position:absolute;left:50%;transform:translateX(-50%);top:-15px;' +
    'font-size:13px;font-weight:900;color:#0891b2;white-space:nowrap}' +
  /* 靠左端／右端時不置中，改成貼齊那一邊 —— 不然一半會跑到框外。 */
  '.mp-pin.at-l b{left:0;transform:none}' +
  '.mp-pin.at-r b{left:auto;right:0;transform:none}' +
  '.mp-pin.out b{color:#4f46e5}' +
  '.mp-pin.ask b{color:#b45309}' +
  '.mp-pin.ask{background:#f59e0b}' +
  /* 兩把尺中間那塊連線。★ 反向 = 兩條配對線交叉成 X（見 rulersHtml 的說明）。 */
  '.mp-link{display:block;width:100%;height:26px}' +
  '.mp-pair{stroke:#94a3b8;stroke-width:2;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}' +
  '.mp-now{stroke:#0891b2;stroke-width:3;vector-effect:non-scaling-stroke}' +
  '.mp-note{font-size:12px;font-weight:900;color:#64748b;text-align:center;margin:2px 0 6px}' +
  '.mp-rev{color:#b45309}' +
  '.mp-in{font-size:20px;font-weight:900;width:120px;padding:10px 12px;' +
    'border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.mp-go{background:#0891b2;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;' +
    'border:none;border-radius:12px;cursor:pointer}' +
  '.mp-opt{display:block;width:100%;text-align:left;padding:13px 15px;margin-bottom:8px;' +
    'border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:16px;' +
    'font-weight:800;cursor:pointer;font-family:monospace}' +
  '.mp-opt:hover{border-color:#0891b2;background:#ecfeff}' +
  '.mp-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;' +
    'font-weight:700;line-height:1.9}' +
  '.mp-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.mp-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.mp-play{width:100%;height:34px;margin:2px 0 4px;accent-color:#0891b2;cursor:pointer}' +
  '.mp-tick{display:flex;justify-content:space-between;font-size:12px;font-weight:900;' +
    'color:#94a3b8;margin-top:-4px}' +
  '.mp-goal{display:flex;gap:8px;justify-content:center;margin:10px 0 4px;flex-wrap:wrap}' +
  '.mp-goal span{font-size:13px;font-weight:900;padding:5px 12px;border-radius:999px;' +
    'background:#f1f5f9;color:#94a3b8;border:2px solid #e2e8f0}' +
  '.mp-goal span.ok{background:#ecfdf5;color:#047857;border-color:#6ee7b7}' +
  '.mp-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.mp-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.mp-dot.on{background:#0891b2}.mp-dot.ok{background:#10b981}';

  function ensureCss() {
    if (document.getElementById('maplab-css')) return;
    var st = document.createElement('style');
    st.id = 'maplab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* 兩把尺 ＋ 中間的連線。
     兩把尺**一律左小右大**（和數學課的數線一致），反向改用**交叉的配對線**表示：
         正向 → 0 接 0、hi 接 out，兩條線平行
         反向 → 0 接 out、hi 接 0，兩條線交叉成 X
     還沒作答時不畫那條連線（它落在哪裡就是答案），只畫兩端的配對線看得出方向。 */
  function rulersHtml(c, showOut) {
    var pos = c.hi ? (c.d / c.hi) * 100 : 0;
    var outP = c.out ? (c.answer / c.out) * 100 : 0;   // 兩把尺都是左小右大
    var edge = function (p) { return p < 12 ? ' at-l' : (p > 88 ? ' at-r' : ''); };
    /* 兩端怎麼配對：正向平行、反向交叉。 */
    var pair = c.rev
      ? '<line x1="0" y1="0" x2="100" y2="26" class="mp-pair"/>' +
        '<line x1="100" y1="0" x2="0" y2="26" class="mp-pair"/>'
      : '<line x1="0" y1="0" x2="0" y2="26" class="mp-pair"/>' +
        '<line x1="100" y1="0" x2="100" y2="26" class="mp-pair"/>';
    var link = showOut
      ? '<line x1="' + pos + '" y1="0" x2="' + outP + '" y2="26" class="mp-now"/>'
      : '';
    return '<div class="mp-rulers">' +
      '<div class="mp-cap">距離（公分）</div>' +
      '<div class="mp-ruler">' +
        '<div class="mp-line"></div>' +
        '<div class="mp-end l">0</div><div class="mp-end r">' + c.hi + '</div>' +
        '<div class="mp-pin' + edge(pos) + '" style="left:' + pos + '%"><b>' +
          c.d + '</b></div>' +
      '</div>' +
      '<svg class="mp-link" viewBox="0 0 100 26" preserveAspectRatio="none">' +
        pair + link + '</svg>' +
      '<div class="mp-note">' + (c.rev
        ? '⚠️ <b>反向</b>：0 接到 ' + c.out + '、' + c.hi + ' 接到 0 —— 兩條線<b>交叉</b>了'
        : '正向：0 接 0、' + c.hi + ' 接 ' + c.out + ' —— 兩條線是平行的') + '</div>' +
      '<div class="mp-cap">換算出來的值' + (showOut ? '' : ' = ？') + '</div>' +
      '<div class="mp-ruler">' +
        '<div class="mp-line out"></div>' +
        '<div class="mp-end l">0</div><div class="mp-end r">' + c.out + '</div>' +
        (showOut
          ? '<div class="mp-pin out' + edge(outP) + '" style="left:' + outP + '%"><b>' +
            c.answer + '</b></div>'
          : '') +
      '</div>' +
    '</div>';
  }

  function dots(node, done) {
    return '<div class="mp-dots">' + [1, 2, 3, 4].map(function (n) {
      return '<div class="mp-dot ' + (done >= n ? 'ok' : (node === n ? 'on' : '')) + '"></div>';
    }).join('') + '</div>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var rng = rngFrom(opts.seed);
    var node = 1, tries = 0, c = caseFor(1, rng, null);
    /* ② 進到填空之前先拉一遍，兩端都碰過才放行（拉一下就跳過的話，看不到「反向」的全貌） */
    var played = false, touched = { lo: false, hi: false }, playD = Math.round(PLAY.hi / 2);


    function view(msg, cls, showOut) {
      var body;
      if (node === 4) {
        var listD = optsD(c).slice().sort(function () { return rng() - 0.5; });
        body = '<div class="mp-q">最後一題 —— 這次用<b>課本真正那組</b>：<br>' +
               '<span style="font-family:monospace">對應（距離，55→1，1→8）</span>，' +
               '量到的距離是 <b>' + c.d + '</b> 公分。<br>' +
               '算出來是 <b style="color:#b45309">' + c.raw.toFixed(3) + '…</b>' +
               '<span class="mp-rev">（除不盡）</span><br>' +
               '⚠️ 可是燈條只有第 1、2、3… 顆，<b>沒有「第 ' + c.raw.toFixed(1) + ' 顆」</b>。' +
               '那會發生什麼事？</div>' +
               listD.map(function (o) {
                 return '<button class="mp-opt" data-k="' + o.k + '">' + esc(o.t) + '</button>';
               }).join('');
      } else if (node === 3) {
        var list = optsFor(c).slice().sort(function () { return rng() - 0.5; });
        body = '<div class="mp-q">🔦 我們要做「<b>手越靠近，燈越亮</b>」。<br>' +
               '距離是 0～' + c.hi + ' 公分，亮度是 0～' + c.out + '。<br>' +
               '⚠️ 下面哪一個寫法才對？</div>' +
               list.map(function (o) {
                 return '<button class="mp-opt" data-k="' + o.k + '">' + esc(o.t) + '</button>';
               }).join('');
      } else if (node === 1) {
        body = '<div class="mp-q">「對應」在做的事，就是<b>把一把尺換成另一把尺</b>。<br>' +
               '距離的尺是 0～' + c.hi + '，換算出來的尺是 0～' + c.out + '。<br>' +
               '⚠️ 距離走到 <b>' + c.d + '</b> 的時候，換算出來是多少？</div>' +
               rulersHtml(c, false) +
               '<div><input class="mp-in" id="mp-ans" placeholder="?"> ' +
               '<button class="mp-go" id="mp-run">送出</button></div>';
      } else if (node === 2 && !played) {
        /* ── 拉桿體驗（不判對錯，只讓他看見）────────────── */
        body = '<div class="mp-q">先<b>拉拉看</b>：這一把尺是<b>反向</b>的 —— ' +
               '上面往右拉（距離變遠），下面的數字會往<b>左</b>跑（值變小）。<br>' +
               '⚠️ 兩端都拉到，才能進到下一題。</div>' +
               '<input type="range" class="mp-play" id="mp-slider" min="0" max="' +
                 PLAY.hi + '" step="1" value="' + playD + '">' +
               '<div class="mp-tick"><span>近 0</span><span>遠 ' + PLAY.hi + '</span></div>' +
               '<div id="mp-stage">' + rulersHtml(playCase(), true) + '</div>' +
               '<div class="mp-goal">' +
                 '<span id="mp-g-lo" class="' + (touched.lo ? 'ok' : '') + '">' +
                   (touched.lo ? '✅ ' : '') + '拉到最近</span>' +
                 '<span id="mp-g-hi" class="' + (touched.hi ? 'ok' : '') + '">' +
                   (touched.hi ? '✅ ' : '') + '拉到最遠</span>' +
               '</div>' +
               '<div style="text-align:center"><button class="mp-go" id="mp-done"' +
                 (touched.lo && touched.hi ? '' : ' disabled') + '>我看懂了，出題</button></div>';
      } else {
        /* 用詞和畫面一致：畫面上是交叉的配對線，不是箭頭 */
        body = '<div class="mp-q">這一次是<b>反向</b>的：距離 ' + c.hi + ' 對到 <b>0</b>、' +
               '距離 0 對到 <b>' + c.out + '</b> —— 兩條配對線<b>交叉</b>了。<br>' +
               '⚠️ 那距離 <b>' + c.d + '</b> 的時候，換算出來是多少？</div>' +
               rulersHtml(c, false) +
               '<div><input class="mp-in" id="mp-ans" placeholder="?"> ' +
               '<button class="mp-go" id="mp-run">送出</button></div>';
      }
      el.innerHTML = '<div class="mp-wrap">' + dots(node, node - 1) + body +
        (msg ? '<div class="mp-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') +
        (showOut ? rulersHtml(c, true) : '') + '</div>';
      bind();
    }

    /** 體驗用的那一題（固定的示範尺，反向）。 */
    function playCase() {
      return { hi: PLAY.hi, out: PLAY.out, d: playD, rev: true,
               answer: mapv(playD, PLAY.hi, 0, 0, PLAY.out) };
    }
    /* ⚠️ 拖曳時**只更新尺標那一塊**，不可以整個重畫 ——
       重畫會讓拉桿失焦，手指還按著就斷掉了。 */
    function onDrag(v) {
      playD = Number(v);
      var st = el.querySelector('#mp-stage');
      if (st) st.innerHTML = rulersHtml(playCase(), true);
      if (playD <= PLAY.hi * 0.1) touched.lo = true;
      if (playD >= PLAY.hi * 0.9) touched.hi = true;
      ['lo', 'hi'].forEach(function (k) {
        var g = el.querySelector('#mp-g-' + k);
        if (g && touched[k] && !/✅/.test(g.textContent)) {
          g.className = 'ok'; g.textContent = '✅ ' + g.textContent;
        }
      });
      var b = el.querySelector('#mp-done');
      if (b) b.disabled = !(touched.lo && touched.hi);
    }

    function answer(ans) {
      tries++;
      if (judge(node, c, ans)) {
        if (node === 4) {
          el.innerHTML = '<div class="mp-wrap">' + dots(4, 4) +
            '<div class="mp-msg good">🎉 暖身完成！<br>' +
            '你會了四件事：兩把尺**要對齊**（那就是數學課的**正比**）、' +
            '配對線**可以交叉**（那是往下走的直線，⚠️ 不是反比）、' +
            '「越近越亮」靠的就是那個交叉，' +
            '而**除不盡是常態** —— 機器會自己處理掉小數，你不必特地去取整數。<br>' +
            '⚠️ 記住：方向寫反了，燈**照樣會亮** —— 要靠近才看得出來。</div></div>';
          if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
          return;
        }
        var note = mathNote(node, c);
        node++;
        c = caseFor(node, rng, c);
        view('✅ 對了！' + (note ? '<br>' + note : ''), 'good');
        return;
      }
      /* ★ 答錯換一題 —— 但先把這一題的答案畫出來，讓他看到尺是怎麼對的。 */
      var msg = hintFor(node, c, ans);
      var old = c;
      c = caseFor(node, rng, c);
      el.innerHTML = '<div class="mp-wrap">' + dots(node, node - 1) +
        '<div class="mp-msg bad">' + md(msg) + '</div>' +
        rulersHtml(old, true) +
        '<div class="mp-q" style="margin-top:14px">⚠️ 換一題再試一次。</div></div>';
      /* ⚠️ 不可以直接把新題目畫出來 —— 他還沒看完剛才那張圖。
         加一顆按鈕，由他決定什麼時候往下。 */
      var b = document.createElement('button');
      b.className = 'mp-go'; b.textContent = '下一題';
      b.addEventListener('click', function () { view('', ''); });
      el.querySelector('.mp-wrap').appendChild(b);
    }

    function bind() {
      var sl = el.querySelector('#mp-slider');
      if (sl) sl.addEventListener('input', function () { onDrag(sl.value); });
      var dn = el.querySelector('#mp-done');
      if (dn) dn.addEventListener('click', function () { played = true; view('', ''); });
      var r = el.querySelector('#mp-run');
      if (r) r.addEventListener('click', function () {
        answer(el.querySelector('#mp-ans').value);
      });
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () { answer(b.getAttribute('data-k')); });
      });
    }

    view('', '');
    return { node: function () { return node; }, tries: function () { return tries; },
             here: function () { return c; } };
  }

  global.MAPLAB = {
    mapv: mapv, RANGES: RANGES, rngFrom: rngFrom,
    caseFor: caseFor, optsFor: optsFor, optsD: optsD, realMap: realMap, REAL: REAL,
    mathNote: mathNote,
    judge: judge, hintFor: hintFor,
    mount: mount
  };

})(window);
