/* =====================================================================
   實驗室的驗收挑戰（第 6～10 關）
   ---------------------------------------------------------------------
   ★ 為什麼在「自由玩」之後還要一關挑戰
     自由玩的通過條件是「照規則走完」—— 那證明他**會操作**，
     但不代表他**懂原理**。真正的證據是：
       他能不能在動手之前，先說出「這一題要比幾次」。
     猜得中，表示他腦子裡真的有那個過程在跑。

   ★ 三個難度（三顆星）
     ⭐   預測次數：先猜這一題要比幾次，再走一遍對答案
     ⭐⭐  零失誤　：換一題，全程不能點錯
     ⭐⭐⭐ 最壞情況：不實際走，直接答「這種資料量最壞要比幾次」
     ⚠️ 難度是**累積**的：拿到第 3 顆表示前兩關也過了。

   ⚠️⚠️ 這三顆星**不是**系統的星數。
      系統裡星星只有兩組，而且各有唯一的寫入者：
        🧩 作品星 unitStars —— 上傳 .sb3 和範例比對（Apps Script 寫入）
        🧠 概念星         —— 由 quiz 的分數現算，沒有第二份資料
      再開第三組會讓 hub 的分母錯掉，也會讓「這顆星是誰給的」說不清楚。
      ⇒ 這裡的三顆星是**挑戰徽章**，畫在證書上，
        另外記在 modules.scratch.lab 給老師看，不進任何星數統計。

   用法（由各實驗室自己呼叫）：
     LABTEST.certificate(level, { title, lines })   → 證書的 HTML
     LABTEST.css                                    → 樣式（各實驗室併進自己的 CSS）
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-12-labtest';

  /* 三個難度的名字與說明。各實驗室的題目不同，但難度的意義一致。 */
  var LEVELS = [
    { n: 1, name: '預測次數', icon: '🎯',
      why: '動手之前先說出「要比幾次」—— 猜得中，表示你腦子裡真的有那個過程在跑。' },
    { n: 2, name: '零失誤', icon: '✨',
      why: '換一題，全程不能點錯。會操作和不會出錯是兩件事。' },
    { n: 3, name: '最壞情況', icon: '🏔️',
      why: '不必真的走。直接說出「這種資料量最壞要比幾次」—— 那才是演算法的性質。' }
  ];

  /** 拿到幾顆星（0～3）。⚠️ 累積制：第 3 關過了就是三顆。 */
  function starsOf(cleared) {
    var n = 0;
    for (var i = 0; i < LEVELS.length; i++) if (cleared[LEVELS[i].n]) n = LEVELS[i].n;
    return n;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /**
   * 證書。
   * ★ 三顆星畫出來，但**沒拿到的畫成空心** ——
   *   只畫拿到的幾顆，學生不會知道自己還差什麼。
   * ⚠️ 這張是給學生看的成就，不是成績單。
   *    所以只講他做到了什麼，不講他錯過幾次。
   */
  function certificate(level, opts) {
    opts = opts || {};
    /* ★ single：這個實驗室的挑戰**只有一關**（目前是第 5 關的找最小值）。
       ⚠️ 不分開處理的話會出兩個錯，而且都是靜默的：
          ① 星星畫成 ★☆☆ —— 學生以為自己只拿了三分之一，實際上他全過了
          ② 結尾寫「再挑戰下一關，就能把證書升級」——
             叫他去找一個**不存在**的下一關，他會在畫面上找很久
       ⇒ single 的時候只畫一顆星、只列那一關，文案也換掉。 */
    var single = !!opts.single;
    var list = single ? [LEVELS[0]] : LEVELS;
    var stars = '';
    if (single) stars = '★';
    else for (var i = 1; i <= 3; i++) stars += (i <= level ? '★' : '☆');
    var rank = single ? '' : (['', '銅', '銀', '金'][level] || '');
    return '<div class="lt-cert lt-r' + level + '">' +
      '<div class="lt-stars">' + stars + '</div>' +
      '<div class="lt-rank">' + rank + (single ? '' : '牌　') + esc(opts.title || '演算法挑戰') + '</div>' +
      '<ul class="lt-list">' + list.map(function (L) {
        var got = L.n <= level;
        return '<li class="' + (got ? 'got' : '') + '">' +
               (got ? '✔ ' : '○ ') + L.icon + ' ' + L.name +
               '<span>' + L.why + '</span></li>';
      }).join('') + '</ul>' +
      (single
        ? '<div class="lt-more">這一關是前導關，挑戰只有這一題 —— 過了就是過了。</div>'
        : (level < 3
            ? '<div class="lt-more">再挑戰下一關，就能把證書升級。</div>'
            : '<div class="lt-more">三關全過 —— 這個演算法你是真的懂了。</div>'))
      + '</div>';
  }

  var css = [
    '.lt-cert{border:3px solid #cbd5e1;border-radius:14px;padding:14px 16px;margin-top:12px;',
    '  background:#fff}',
    '.lt-r1{border-color:#d6a06a;background:#fdf6ef}',
    '.lt-r2{border-color:#a3b1c2;background:#f6f8fb}',
    '.lt-r3{border-color:#e0b23c;background:#fffbeb}',
    '.lt-stars{font-size:30px;letter-spacing:5px;color:#e0b23c;line-height:1.2}',
    '.lt-rank{font-size:16px;font-weight:900;color:#334155;margin:2px 0 8px}',
    '.lt-list{list-style:none;margin:0;padding:0}',
    '.lt-list li{font-size:12.5px;line-height:1.75;color:#94a3b8;padding:3px 0}',
    '.lt-list li.got{color:#334155;font-weight:700}',
    '.lt-list li span{display:block;font-weight:400;font-size:12px;color:#94a3b8}',
    '.lt-more{font-size:12.5px;color:#64748b;margin-top:8px}',
    /* 挑戰本體 */
    '.lt-box{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;',
    '  padding:12px 15px;margin-top:12px}',
    '.lt-box .h{font-size:14px;font-weight:900;color:#92400e;margin-bottom:5px}',
    '.lt-box .q{font-size:13.5px;line-height:1.85;color:#78350f;margin-bottom:9px}',
    '.lt-box .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.lt-box input{width:92px;padding:8px 10px;border:2px solid #fcd34d;border-radius:9px;',
    '  font-size:16px;font-weight:700;font-family:inherit;color:#78350f;text-align:center}',
    '.lt-box button{background:#f59e0b;color:#fff;border:0;border-radius:9px;padding:9px 16px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.lt-box button:hover{background:#d97706}',
    '.lt-box button.ghost{background:#fff;border:2px solid #fcd34d;color:#92400e}',
    '.lt-say{font-size:13px;line-height:1.85;margin-top:9px;padding:9px 12px;border-radius:9px;',
    '  min-height:44px}',
    '.lt-say.good{background:#dcfce7;color:#166534}',
    '.lt-say.bad{background:#fee2e2;color:#991b1b}',
    '.lt-say.info{background:#fef3c7;color:#92400e}',
    /* 放大版 */
    '.qs-big .lt-box,.sl-big .lt-box{padding:16px 19px}',
    '.qs-big .lt-box .h,.sl-big .lt-box .h{font-size:16px}',
    '.qs-big .lt-box .q,.sl-big .lt-box .q{font-size:15px}',
    '.qs-big .lt-box input,.sl-big .lt-box input{font-size:19px;padding:10px 12px;width:110px}',
    '.qs-big .lt-box button,.sl-big .lt-box button{padding:11px 20px;font-size:15px}',
    '.qs-big .lt-say,.sl-big .lt-say{font-size:15px;min-height:54px}',
    '.qs-big .lt-stars,.sl-big .lt-stars{font-size:38px}',
    '.qs-big .lt-list li,.sl-big .lt-list li{font-size:13.5px}'
  ].join('');

  global.LABTEST = {
    VERSION: VERSION,
    LEVELS: LEVELS,
    css: css,
    starsOf: starsOf,
    certificate: certificate
  };
})(typeof window !== 'undefined' ? window : this);
