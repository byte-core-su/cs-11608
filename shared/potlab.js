/* =====================================================================
   可變電阻：原理 ＋ 接線練習（5016B 第三節「無段風扇」暖身）
   ---------------------------------------------------------------------
   開發板上沒有可變電阻，要學生自己接到 A7 —— 五節課裡第一次自己接線，
   所以暖身的重點不只是「知道原理」，是**接對**。

   接線對照（面對旋鈕方向）：
       開發板 G（接地）→ 可變電阻 腳 1
       開發板 P（電源）→ 可變電阻 腳 3
       開發板 S（訊號）→ 可變電阻 腳 2   ★ 中間那支＝刷片
   學生最自然的錯是「G-P-S 照順序對 1-2-3」—— 那會把**電源接到刷片上**。

   三個節點：
     ① 原理　　可變電阻在做什麼（轉旋鈕看讀值 ＋ 概念題）
     ② 接線　　連連看：把 G／P／S 接到對的腳
     ③ 接錯會怎樣　三選一（大圖選項）

   接回第二節：可變電阻本身就是**一把尺**（0～1023），又是「兩把尺對齊」。
   ===================================================================== */
(function (global) {
  'use strict';

  var ADC_MAX = 1023;            // 類比輸入的解析度（0～1023）
  var PIN = 'A7';                // 訊號接 A7

  /* 接線對照。★ 這一份是**唯一的來源** —— 畫面、判定、回饋都讀它。 */
  var WIRING = [
    { hole: 'G', name: '接地', leg: 1, why: '電阻的一端接到地（0V）' },
    { hole: 'P', name: '電源', leg: 3, why: '電阻的另一端接到電源' },
    { hole: 'S', name: '訊號', leg: 2, why: '★ 中間那支是**刷片**，旋鈕轉的就是它' }
  ];
  var LEGS = [1, 2, 3];

  function LK() {
    if (!global.LABKIT) throw new Error('potlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function rngFrom(seed) {
    if (global.ULTRALAB && global.ULTRALAB.rngFrom) return global.ULTRALAB.rngFrom(seed);
    return Math.random;
  }

  /** 旋鈕轉到某個比例時讀到的數字。★ 就是分壓：轉到幾分之幾，就讀到幾分之幾。 */
  function readAt(pct) {
    return Math.round(ADC_MAX * Math.max(0, Math.min(100, pct)) / 100);
  }

  /** ② 判接線：三條線都要接對。回傳哪幾條錯了。 */
  function judgeWire(pick) {
    pick = pick || {};
    var wrong = WIRING.filter(function (w) { return Number(pick[w.hole]) !== w.leg; });
    /* ⚠️ 沒接完不算錯，只是還沒好 —— 兩者的回饋要分開。 */
    var done = WIRING.every(function (w) { return pick[w.hole]; });
    return { ok: done && wrong.length === 0, done: done,
             wrong: wrong.map(function (w) { return w.hole; }) };
  }
  /** 接錯時的回饋。★ 要指出**是什麼後果**，不是只說「錯了」。 */
  function sayWire(pick) {
    var r = judgeWire(pick);
    if (r.ok) return '✅ 三條都對了。';
    if (!r.done) return '還有線沒接完 —— 三個孔都要接到一支腳。';
    /* ★★ 最危險、也最常見的那一種：電源接到刷片上。 */
    if (Number(pick.S) !== 2 && Number(pick.P) === 2)
      return '⚠️⚠️ 你把**電源接到中間那支腳**了。中間是**刷片** —— ' +
             '旋鈕一轉，它和接地之間的電阻會變得很小，' +
             '等於把電源直接接到地。⚠️ 這樣會**發熱**，先拔掉再重接。';
    if (Number(pick.S) !== 2)
      return '⚠️ 訊號（S）沒有接到中間那支腳。' +
             '兩端那兩支是**固定不動**的，旋鈕怎麼轉它們都一樣 —— ' +
             '要讀出「轉到哪裡」，只能接刷片。';
    /* S 對了但 G／P 顛倒 —— 這一種不會壞，只是方向相反。 */
    return '⚠️ 訊號接對了（中間那支），但**接地和電源接反了**。' +
           '這樣讀到的數字會倒過來：往右轉反而變小。' +
           '⚠️ 它不會壞掉，所以光看接線看不出問題 —— 要轉一下才發現。';
  }

  /* ③ 接錯會怎樣。★ 三個選項都是真的會發生的事。 */
  function optsWhy() {
    return [
      { k: 'wiper', good: true,
        t: '訊號接到兩端那兩支的其中一支',
        after: '讀到的數字**完全不會變** —— 那兩支是固定的，旋鈕怎麼轉都一樣。' },
      { k: 'swap', good: false,
        t: '接地和電源對調',
        after: '會動，但**方向相反**：往右轉數字反而變小。⚠️ 不會壞，所以很難發現。' },
      { k: 'power', good: false,
        t: '電源接到中間那支腳',
        after: '⚠️ 旋鈕轉到底時，等於把電源直接接到地 —— 會發熱。' }
    ];
  }
  /** ③ 的題目：問「哪一種接法會讓數字完全不會變」。 */
  function judgeWhy(ans) { return String(ans) === 'wiper'; }
  function sayWhy(ans) {
    if (String(ans) === 'swap')
      return '對調會讓數字**倒過來**，但它還是會變。再想一次：' +
             '哪一種接法會讓旋鈕轉了**完全沒反應**？';
    if (String(ans) === 'power')
      return '那一種很危險（會發熱），但數字還是會變。' +
             '這一題問的是「**完全不會變**」的那一種。';
    return '想想看：三支腳裡，哪兩支是旋鈕轉了也不會動的？';
  }

  /* ① 原理的概念題。★ 隨機挑一組（正解只有一個，但問法會換）。 */
  var Q1 = [
    { q: '旋鈕往右轉到底，A7 讀到的數字會是多少？',
      opts: [{ k: 'max', good: true, t: String(ADC_MAX) + '（最大）' },
             { k: 'zero', good: false, t: '0' },
             { k: 'half', good: false, t: '一半（約 512）' }],
      why: '刷片滑到最上面，量到的就是整條電阻的電壓 —— 也就是滿格。' },
    { q: '旋鈕轉到**正中間**，讀到的數字大約是多少？',
      opts: [{ k: 'half', good: true, t: '約 512（一半）' },
             { k: 'max', good: false, t: String(ADC_MAX) },
             { k: 'zero', good: false, t: '0' }],
      why: '刷片停在一半的位置，量到的就是一半的電壓。' },
    { q: '可變電阻真正在做的事情是什麼？',
      opts: [{ k: 'split', good: true, t: '把電壓**按比例切一段**出來給程式讀' },
             { k: 'gen', good: false, t: '自己產生電' },
             { k: 'count', good: false, t: '數旋鈕轉了幾圈' }],
      why: '它不產生電，也不計數 —— 它只是把既有的電壓分掉一部分。' }
  ];
  function caseQ1(rng, prev) { return LK().pick(rng, Q1, prev, function (x) { return x.q; }); }

  /* ═══ 畫面 ═══════════════════════════════════════════
     ① 真的會轉的旋鈕　② 上下對照的連連看（點兩下連一條線）　③ 每個選項配一張大圖 */
  var CSS = '' +
  '.pt-wrap{font-size:15px}' +
  '.pt-q{font-size:16px;font-weight:900;color:#0f172a;line-height:1.9;margin-bottom:10px}' +
  '.pt-stage{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:12px 0}' +
  /* ── ① 旋鈕（真的會轉，和實物的操作感一致）─────── */
  /* ★ .pt-dial 的基本樣式已經搬到 shared/labkit.js 的 .lk-dial（第四節共用）。 */
  '.pt-hint{text-align:center;font-size:13px;font-weight:900;color:#94a3b8;margin-top:2px}' +
  '.pt-read{text-align:center;font-size:30px;font-weight:900;color:#0f172a;margin:8px 0 2px}' +
  '.pt-read span{font-size:14px;color:#64748b}' +
  /* 分壓那條尺（旋鈕轉的時候跟著動）*/
  '.pt-bar{position:relative;height:22px;border-radius:11px;margin:22px 8px 8px;' +
    'background:linear-gradient(90deg,#334155,#f59e0b)}' +
  '.pt-end{position:absolute;top:28px;font-size:12px;font-weight:900;color:#64748b}' +
  '.pt-end.l{left:0}.pt-end.r{right:0}' +
  '.pt-wiper{position:absolute;top:-12px;width:4px;height:46px;background:#0891b2;border-radius:2px}' +
  '.pt-wiper b{position:absolute;left:50%;transform:translateX(-50%);top:-19px;' +
    'font-size:13px;font-weight:900;color:#0891b2;white-space:nowrap}' +
  '.pt-wiper.at-l b{left:0;transform:none}' +
  '.pt-wiper.at-r b{left:auto;right:0;transform:none}' +
  /* ── ② 連連看 ────────────────────────────────── */
  '.pt-link{display:block;width:100%;max-width:520px;margin:0 auto;touch-action:manipulation}' +
  '.pt-node{cursor:pointer}' +
  '.pt-node circle{transition:fill .12s,stroke .12s}' +
  '.pt-node.sel circle{fill:#fde68a;stroke:#d97706;stroke-width:4}' +
  '.pt-wireline{stroke:#0891b2;stroke-width:5;stroke-linecap:round}' +
  '.pt-legend{text-align:center;font-size:13px;font-weight:900;color:#64748b;margin-top:4px}' +
/* ── ③ 大圖選項 ────────────────────────────────── */
  '.pt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:10px 0}' +
  '.pt-card{border:2px solid #e2e8f0;border-radius:14px;background:#fff;padding:12px;' +
    'cursor:pointer;text-align:center}' +
  '.pt-card:hover{border-color:#0891b2;background:#ecfeff}' +
  '.pt-card svg{width:100%;height:120px}' +
  '.pt-card div{font-size:15px;font-weight:900;color:#0f172a;line-height:1.7;margin-top:6px}' +
  '.pt-go{background:#0891b2;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;' +
    'border:none;border-radius:12px;cursor:pointer}' +
  '.pt-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;' +
    'border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;' +
    'font-weight:800;cursor:pointer}' +
  '.pt-opt:hover{border-color:#0891b2;background:#ecfeff}' +
  '.pt-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;' +
    'font-weight:700;line-height:1.9}' +
  '.pt-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.pt-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.pt-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.pt-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.pt-dot.on{background:#0891b2}.pt-dot.ok{background:#10b981}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('potlab-css')) return;
    var st = document.createElement('style');
    st.id = 'potlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* 旋鈕的幾何與拖曳**都在 shared/labkit.js**（第四節也要用同一個）。
     ⚠️ 這裡只留三個薄薄的別名 —— 幾何不可以有兩份。 */
  function angleOf(pct) { return LK().dialAngle(pct); }

  /** ① 的旋鈕（SVG，會跟著轉）。★ 畫的人是 labkit，這裡只指定名字。 */
  function dialHtml(pct) {
    return LK().dialSvg(pct, { cls: 'pt-dial', needleId: 'pt-needle', legs: true });
  }

  /** 分壓那條尺 */
  function barHtml(pct) {
    var edge = pct < 12 ? ' at-l' : (pct > 88 ? ' at-r' : '');
    return '<div class="pt-bar">' +
      '<div class="pt-end l">腳 1（接地 0V）</div>' +
      '<div class="pt-end r">腳 3（電源）</div>' +
      '<div class="pt-wiper' + edge + '" style="left:' + pct + '%"><b>腳 2 刷片</b></div>' +
      '</div>';
  }

  /* ── ② 連連看的座標 ────────────────────────────
     開發板在上（孔 G P S 由左到右），可變電阻在下（腳 1 2 3 由左到右）。
     正解的 P→3 和 S→2 會**交叉**，「照順序接」是三條直的 —— 那個差別就是這一關要學生看見的。 */
  var HOLE_X = { G: 130, P: 200, S: 270 }, HOLE_Y = 62;
  var LEG_X = { 1: 130, 2: 200, 3: 270 }, LEG_Y = 168;

  function linkHtml(pick, sel) {
    var lines = WIRING.map(function (w) {
      var leg = Number(pick[w.hole]);
      if (!leg) return '';
      return '<line class="pt-wireline" x1="' + HOLE_X[w.hole] + '" y1="' + HOLE_Y +
             '" x2="' + LEG_X[leg] + '" y2="' + LEG_Y + '"/>';
    }).join('');
    var holes = WIRING.map(function (w) {
      return '<g class="pt-node' + (sel === 'hole' + w.hole ? ' sel' : '') + '" data-hole="' + w.hole + '">' +
        '<circle cx="' + HOLE_X[w.hole] + '" cy="' + HOLE_Y + '" r="17" fill="#0f172a" stroke="#334155" stroke-width="3"/>' +
        '<text x="' + HOLE_X[w.hole] + '" y="' + (HOLE_Y + 6) + '" text-anchor="middle" font-size="17" ' +
        'font-weight="900" fill="#fff">' + w.hole + '</text>' +
        '<text x="' + HOLE_X[w.hole] + '" y="' + (HOLE_Y - 26) + '" text-anchor="middle" font-size="12" ' +
        'font-weight="900" fill="' + (w.hole === 'S' ? '#0891b2' : '#64748b') + '">' +
        w.name + (w.hole === 'S' ? '（' + PIN + '）' : '') + '</text></g>';
    }).join('');
    var legs = LEGS.map(function (n) {
      return '<g class="pt-node' + (sel === 'leg' + n ? ' sel' : '') + '" data-leg="' + n + '">' +
        '<circle cx="' + LEG_X[n] + '" cy="' + LEG_Y + '" r="15" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3"/>' +
        '<text x="' + LEG_X[n] + '" y="' + (LEG_Y + 6) + '" text-anchor="middle" font-size="17" ' +
        'font-weight="900" fill="#0f172a">' + n + '</text></g>';
    }).join('');
    return '<svg class="pt-link" viewBox="0 0 400 300">' +
      /* ── 開發板（上）── */
      '<text x="200" y="20" text-anchor="middle" font-size="13" font-weight="900" fill="#94a3b8">開發板</text>' +
      '<rect x="76" y="30" width="248" height="64" rx="10" fill="none" stroke="#cbd5e1" stroke-width="3"/>' +
      /* 板子上那一組三支腳印著 A7：標在整組旁邊，「訊號」那一個孔也註明（真正接到 A7 的是 S） */
      '<rect x="84" y="50" width="38" height="26" rx="7" fill="#0891b2"/>' +
      '<text x="103" y="68" text-anchor="middle" font-size="15" font-weight="900" fill="#fff">' +
        PIN + '</text>' +
      '<line x1="122" y1="63" x2="' + (HOLE_X.G - 19) + '" y2="63" ' +
        'stroke="#0891b2" stroke-width="2" stroke-dasharray="3 3"/>' +
      holes +
      lines +
      /* ── 可變電阻（下）：腳朝上，本體與旋鈕軸在下 ── */
      legs +
      '<line x1="130" y1="183" x2="130" y2="196" stroke="#94a3b8" stroke-width="5"/>' +
      '<line x1="200" y1="183" x2="200" y2="194" stroke="#94a3b8" stroke-width="5"/>' +
      '<line x1="270" y1="183" x2="270" y2="196" stroke="#94a3b8" stroke-width="5"/>' +
      '<circle cx="200" cy="240" r="46" fill="#e7e5e4" stroke="#78716c" stroke-width="4"/>' +
      '<text x="200" y="246" text-anchor="middle" font-size="14" font-weight="900" fill="#78716c">10K</text>' +
      '<rect x="188" y="284" width="24" height="14" rx="5" fill="#a8a29e"/>' +
      '<text x="316" y="246" text-anchor="middle" font-size="13" font-weight="900" fill="#94a3b8">可變電阻</text>' +
    '</svg>';
  }

/* ── ③ 三張大圖 ────────────────────────────────── */
  function miniHtml(kind) {
    /* 一顆簡化的可變電阻 ＋ 三條線，用顏色標出接到哪。 */
    var w = { wiper: { 1: '#0891b2', 2: '#94a3b8', 3: '#94a3b8' },
              swap:  { 1: '#dc2626', 2: '#0891b2', 3: '#16a34a' },
              power: { 1: '#16a34a', 2: '#dc2626', 3: '#94a3b8' } }[kind];
    return '<svg viewBox="0 0 120 100">' +
      '<circle cx="60" cy="34" r="24" fill="#e7e5e4" stroke="#78716c" stroke-width="3"/>' +
      '<circle cx="60" cy="34" r="7" fill="#a8a29e"/>' +
      [1, 2, 3].map(function (n) {
        var x = 36 + (n - 1) * 24;
        return '<line x1="' + x + '" y1="56" x2="' + x + '" y2="84" stroke="' + w[n] +
               '" stroke-width="6" stroke-linecap="round"/>' +
               '<text x="' + x + '" y="96" text-anchor="middle" font-size="11" ' +
               'font-weight="900" fill="#64748b">' + n + '</text>';
      }).join('') +
    '</svg>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var rng = rngFrom(opts.seed);
    var node = 1, tries = 0;
    var pct = 50, turned = { lo: false, hi: false };
    var q1 = caseQ1(rng, null);
    var pick = { G: '', P: '', S: '' };
    var sel = null;                 // 連連看：現在選了哪一顆（'holeG' / 'leg2'）

    function dots(n, done) {
      return '<div class="pt-dots">' + [1, 2, 3].map(function (i) {
        return '<div class="pt-dot ' + (done >= i ? 'ok' : (n === i ? 'on' : '')) + '"></div>';
      }).join('') + '</div>';
    }
    function stageHtml() {
      return '<div id="pt-dial">' + dialHtml(pct) + '</div>' +
             '<div class="pt-hint">↻ 按住旋鈕<b>轉一圈</b>看看（滾輪、方向鍵也可以）</div>' +
             '<div class="pt-read" id="pt-read">' + readAt(pct) +
               ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span></div>' +
             '<div id="pt-bar">' + barHtml(pct) + '</div>';
    }

    function view(msg, cls) {
      var body;
      if (node === 1) {
        var list = q1.opts.slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">🎛️ 可變電阻裡面是<b>一條電阻</b>，兩端接電源和接地，' +
          '中間有一支會滑動的<b>刷片</b>。<br>' +
          '旋鈕在轉的，就是那支刷片 —— 它滑到哪裡，就把電壓<b>按比例切一段</b>出來。<br>' +
          '⚠️ 先轉轉看（兩端都要轉到），再回答問題。</div>' +
          '<div class="pt-stage">' + stageHtml() + '</div>' +
          (turned.lo && turned.hi
            ? '<div class="pt-q">' + q1.q + '</div>' +
              list.map(function (o) {
                return '<button class="pt-opt" data-k="' + o.k + '">' + esc(o.t) + '</button>';
              }).join('')
            : '<div class="pt-msg bad">⚠️ 兩端都轉到才會出題　' +
              '<span id="pt-goal-lo">' + (turned.lo ? '✅' : '⬜') + ' 轉到最左</span>　' +
              '<span id="pt-goal-hi">' + (turned.hi ? '✅' : '⬜') + ' 轉到最右</span>' +
              /* 用轉的比拉的難，留兩顆「直接轉到底」的按鈕給拖不順的人用 */
              '<div style="margin-top:8px">' +
                '<button class="pt-go" id="pt-jl" style="padding:7px 14px;font-size:13px">' +
                  '⟲ 直接轉到最左</button> ' +
                '<button class="pt-go" id="pt-jr" style="padding:7px 14px;font-size:13px">' +
                  '直接轉到最右 ⟳</button></div>' +
              '</div>');
      } else if (node === 2) {
        /* 連連看：點一個孔、再點一支腳，就連一條線 */
        body =
          '<div class="pt-q">🔌 這一節的可變電阻<b>不在模組上</b>，要自己接三條線。<br>' +
          '⚠️ 點一下開發板的孔，再點一下要接的那支腳 —— 就連起來了。<br>' +
          '（面對旋鈕，三支腳由左到右是 <b>1</b>、<b>2</b>、<b>3</b>；' +
          '<b>中間那支是刷片</b>。）</div>' +
          '<div class="pt-stage">' + linkHtml(pick, sel) +
            '<div class="pt-legend">已接 ' +
              WIRING.filter(function (w) { return pick[w.hole]; }).length +
              ' ／ 3 條' +
              (WIRING.filter(function (w) { return pick[w.hole]; }).length
                ? '　·　再點同一個孔可以拆掉重接' : '') +
            '</div>' +
          '</div>' +
          '<div style="text-align:center"><button class="pt-go" id="pt-run">接好了，檢查</button></div>';
      } else {
        var lw = optsWhy().slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">最後一題 —— 下面哪一種接錯，會讓旋鈕轉了<b>數字完全不會變</b>？<br>' +
          '<span style="font-size:13px;color:#64748b;font-weight:700">' +
          '（圖上藍色＝訊號、綠色＝電源、紅色＝接地、灰色＝沒接）</span></div>' +
          '<div class="pt-cards">' + lw.map(function (o) {
            return '<div class="pt-card" data-w="' + o.k + '">' + miniHtml(o.k) +
                   '<div>' + esc(o.t) + '</div></div>';
          }).join('') + '</div>';
      }
      el.innerHTML = '<div class="pt-wrap">' + dots(node, node - 1) + body +
        (msg ? '<div class="pt-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    /* ⚠️ 轉動時只改指針的 transform，SVG 元素從頭到尾不換：
       重畫會換掉正在被拖曳的 SVG，監聽器和 pointer capture 跟著消失，
       變成「滑鼠只能點第一下」。 */
    function paint() {
      var g = el.querySelector('#pt-needle');
      if (g) g.setAttribute('transform', 'rotate(' + angleOf(pct) + ' 60 60)');
      var b = el.querySelector('#pt-bar');  if (b) b.innerHTML = barHtml(pct);
      var r = el.querySelector('#pt-read');
      if (r) r.innerHTML = readAt(pct) + ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span>';
      var lo = el.querySelector('#pt-goal-lo'), hi = el.querySelector('#pt-goal-hi');
      if (lo) lo.textContent = (turned.lo ? '✅' : '⬜') + ' 轉到最左';
      if (hi) hi.textContent = (turned.hi ? '✅' : '⬜') + ' 轉到最右';
    }
    /* 手指還按著的時候不可以重畫整頁 —— 一樣會把 SVG 換掉。
       ⇒ 記下來，放開之後再畫。 */
    var dialH = null, needView = false;
    function dragging() { return !!(dialH && dialH.dragging()); }
    function setPct(v) {
      var was = turned.lo && turned.hi;
      pct = Math.max(0, Math.min(100, v));
      if (pct <= 5) turned.lo = true;
      if (pct >= 95) turned.hi = true;
      paint();
      if (!was && turned.lo && turned.hi) {
        if (dragging()) { needView = true; return; }
        view('', '');
      }
    }

    function bind() {
      /* ── ① 旋鈕：拖曳／滾輪／方向鍵，都在 labkit ── */
      dialH = LK().dialBind(el.querySelector('.pt-dial'), {
        get: function () { return pct; },
        set: setPct,
        /* 放開之後才重畫（拖曳中重畫會把 SVG 換掉）。 */
        onRelease: function () { if (needView) { needView = false; view('', ''); } }
      });
      /* ── ② 連連看：點孔 → 點腳 ── */
      el.querySelectorAll('[data-hole]').forEach(function (g) {
        g.addEventListener('click', function () { tapHole(g.getAttribute('data-hole')); });
      });
      el.querySelectorAll('[data-leg]').forEach(function (g) {
        g.addEventListener('click', function () { tapLeg(g.getAttribute('data-leg')); });
      });
      var jl = el.querySelector('#pt-jl');
      if (jl) jl.addEventListener('click', function () { setPct(0); });
      var jr = el.querySelector('#pt-jr');
      if (jr) jr.addEventListener('click', function () { setPct(100); });
      var run = el.querySelector('#pt-run');
      if (run) run.addEventListener('click', doWire);
      /* ── ①③ 的選項 ── */
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () { doQ1(b.getAttribute('data-k')); });
      });
      el.querySelectorAll('[data-w]').forEach(function (b) {
        b.addEventListener('click', function () { doWhy(b.getAttribute('data-w')); });
      });
    }

    /* 點孔：
       · 已經接過 → 拆掉，並且選起來等著接新的一支腳（「我要改這一條」一步到位）
       · 還沒接 → 選起來（再點一次取消）。 */
    function tapHole(h) {
      if (pick[h]) { pick[h] = ''; sel = 'hole' + h; view('', ''); return; }
      sel = (sel === 'hole' + h) ? null : 'hole' + h;
      view('', '');
    }
    /* 點腳：如果已經選了一個孔就連起來。
       ⚠️ 一支腳只能接一個孔 —— 接第二條的話，前一條要自動拆掉，
          不然畫面上會出現「一支腳兩條線」，那在實物上做不到。 */
    function tapLeg(n) {
      if (sel && sel.indexOf('hole') === 0) {
        var h = sel.slice(4);
        WIRING.forEach(function (w) {
          if (String(pick[w.hole]) === String(n)) pick[w.hole] = '';
        });
        pick[h] = String(n);
        sel = null;
      } else {
        sel = (sel === 'leg' + n) ? null : 'leg' + n;
      }
      view('', '');
    }

    function doQ1(k) {
      tries++;
      var o = q1.opts.filter(function (x) { return x.k === k; })[0];
      if (o && o.good) {
        node = 2;
        view('✅ 對了：' + q1.why + '<br>' +
             '★ 也就是說，可變電阻就是**一把 0～' + ADC_MAX + ' 的尺** —— ' +
             '和上一節那兩把尺是同一件事。', 'good');
        return;
      }
      var old = q1;
      q1 = caseQ1(rng, q1);       // ★ 答錯換一題
      view('⚠️ 不對。' + old.why + '　**換一題**再試一次。', 'bad');
    }

    function doWire() {
      tries++;
      var r = judgeWire(pick);
      if (r.ok) {
        node = 3;
        view('✅ 接對了！★ 記住這一組：G→1、P→3、**S→2（中間那支）**。<br>' +
             '⚠️ 注意剛才那三條線 —— **P 和 S 是交叉的**。' +
             '照順序接（G-P-S 對 1-2-3）三條線會是直的，那就錯了。', 'good');
        return;
      }
      view(sayWire(pick), 'bad');
    }

    function doWhy(k) {
      tries++;
      if (judgeWhy(k)) {
        el.innerHTML = '<div class="pt-wrap">' + dots(3, 3) +
          '<div class="pt-msg good">' + md(
            '🎉 暖身完成！\n你會了三件事：可變電阻是**把電壓按比例切一段**、' +
            '**S 一定要接中間那支刷片**、而接到兩端的話**旋鈕轉了也沒反應**。\n' +
            '⚠️ 上機前再檢查一次：G→1、P→3、S→2。'
          ).replace(/\n/g, '<br>') + '</div></div>';
        if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
        return;
      }
      view(sayWhy(k), 'bad');
    }

    view('', '');
    return { node: function () { return node; }, tries: function () { return tries; },
             pct: function () { return pct; }, pick: function () { return pick; },
             q1: function () { return q1; },
             tapHole: tapHole, tapLeg: tapLeg, setPct: setPct };
  }

  global.POTLAB = {
    ADC_MAX: ADC_MAX, PIN: PIN, WIRING: WIRING, LEGS: LEGS, Q1: Q1,
    readAt: readAt, judgeWire: judgeWire, sayWire: sayWire,
    /* ⚠️ 這裡不再自己寫一個 SWEEP = 270 —— 那個數字只能有一份，
       要拿去 LABKIT.DIAL_SWEEP。 */
    angleOf: angleOf,
    HOLE_X: HOLE_X, HOLE_Y: HOLE_Y, LEG_X: LEG_X, LEG_Y: LEG_Y,
    optsWhy: optsWhy, judgeWhy: judgeWhy, sayWhy: sayWhy, caseQ1: caseQ1,
    mount: mount
  };

})(window);
