/* =====================================================================
   現在是哪一個學期 —— 決定之後載入那一學期的設定
   ---------------------------------------------------------------------
   每個網頁都這樣開頭（course/、shared/ 底下的頁面）：
       <script src="../config.js"></script>       全站設定 window.SITE
       <script src="../shared/term.js"></script>  ← 這一支：選學期，接著載入 ../{學期}/config.js
   之後的 <script> 就拿得到 window.CONFIG（全站設定＋那一學期的設定，合在一起、凍結）。

   ★ 學期怎麼決定（前面的優先）
     ① 網址帶 ?term=11502            —— 入口、教師後台切換學期時用
     ② 這個分頁剛才選的（sessionStorage）—— 在同一個分頁裡換頁不會跑掉
     ③ 這台電腦上次選的（localStorage）
     ④ 依日期：SITE.TERMS 裡 START 在今天以前、最近的那一個（都還沒到就用第一個）
     不在 SITE.TERMS 裡的代號一律不理 —— 網址亂改只會退回 ②～④。
   ★ 選定之後記進 ② ③：之後這個分頁的每一頁都是同一學期。

   ★ 學期資料夾的 config.js 只寫那一學期自己的東西，用 defineTerm({...}) 交給這裡，
     這裡補上共用的部分（集合名稱、學號檢查…）、和全站設定合併、凍結成 window.CONFIG。

   ★ 那一學期的題庫、關卡資料：TERMSEL.include('content/social.js') 會載入 ../{學期}/content/social.js
     （要放在 config 之後、用到它的 <script> 之前，和一般的 <script src> 一樣是依序執行）。
   ===================================================================== */
(function (global) {
  'use strict';

  var SITE = global.SITE || {};
  var LIST = (SITE.TERMS || []).filter(function (t) { return t && /^[\w-]{1,20}$/.test(String(t.id || '')); });
  var KEY = 'cs-term';

  /* 這一支的位置 ⇒ 網站根目錄（根目錄的頁面和 course/、shared/ 底下的頁面都用同一支） */
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var all = document.getElementsByTagName('script'); s = all[all.length - 1].src; }
    return String(s || '').replace(/shared\/term\.js(\?.*)?$/, '');
  })();

  function valid(id) { return LIST.some(function (t) { return t.id === id; }); }
  function info(id) { return LIST.filter(function (t) { return t.id === id; })[0] || null; }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** 依日期：START 在今天以前、最近的那一個；都還沒到就用第一個 */
  function byDate(today) {
    var t = ymd(today || new Date()), pick = LIST[0] ? LIST[0].id : '';
    LIST.forEach(function (x) { if (x.START && String(x.START) <= t) pick = x.id; });
    return pick;
  }
  function read(store) { try { return global[store].getItem(KEY) || ''; } catch (e) { return ''; } }
  function write(id) {
    try { global.sessionStorage.setItem(KEY, id); } catch (e) {}
    try { global.localStorage.setItem(KEY, id); } catch (e) {}
  }

  var fromUrl = '';
  try { fromUrl = new URLSearchParams(global.location.search).get('term') || ''; } catch (e) {}
  var current = [fromUrl, read('sessionStorage'), read('localStorage')].filter(valid)[0] || byDate();
  if (current) write(current);

  /* 學期資料夾的 config.js 呼叫這一支 */
  global.defineTerm = function (data) {
    if (global.CONFIG) return;                       // 同一頁載入兩次：保留第一份
    var t = info(data.TERM) || { id: data.TERM, name: data.TERM, short: data.TERM };
    var cfg = {};
    Object.keys(SITE).forEach(function (k) { cfg[k] = SITE[k]; });
    Object.keys(data || {}).forEach(function (k) { cfg[k] = data[k]; });
    cfg.TERM_NAME = t.name;
    cfg.TERM_SHORT = t.short;
    cfg.TERM_START = cfg.TERM_START || t.START;
    cfg.HUB_PAGE = cfg.HUB_PAGE || 'hub.html';
    cfg.COLLECTIONS = Object.assign({
      PROGRESS: data.TERM + '-progress',
      CONFIG:   data.TERM + '-config',
      THINKING: data.TERM + '-thinking',
      ROSTER:   'roster'
    }, data.COLLECTIONS || {});
    // 學號格式檢查（所有頁面共用這一個，格式在全站設定的 SCHOOL.SID_PATTERN）
    cfg.isSid = function (v) {
      try { return new RegExp(this.SCHOOL.SID_PATTERN).test(String(v || '')); }
      catch (e) { return /^\d{7}$/.test(String(v || '')); }
    };
    // 由單元代號取得關卡編號（1 起算；找不到回 0）
    cfg.unitNo = function (id) {
      var i = (this.UNITS || []).findIndex(function (u) { return u[0] === id; });
      return i >= 0 ? i + 1 : 0;
    };
    lock(global, 'CONFIG', cfg);
  };

  /* 🔒 鎖住：判分、計星、設定都是掛在 window 上的物件，網頁是**用的當下**才去讀 ——
       在 Console 打一行把設定或判分函式換掉，之後每一題都算答對。
     ★ 作法：載入完就**凍結**（裡面的函式、數字一個都改不了），
       而且 window 上這個名字**不能再指向別的東西**。
     ⚠️ 這擋的是「網頁載入之後」才動手的（Console、書籤小工具、大部分 AI 寫的腳本）。
        搶在網頁載入**之前**就動手的（Tampermonkey 設 document-start）照樣擋不住 ——
        前端能做的只到這裡，見 shared/anskey.js 開頭。 */
  function lock(g, name, obj) {
    (function freeze(o) {
      if (!o || (typeof o !== 'object' && typeof o !== 'function') || Object.isFrozen(o)) return;
      Object.freeze(o);
      Object.getOwnPropertyNames(o).forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(o, k);
        if (d && 'value' in d) freeze(d.value);
      });
    })(obj);
    try { Object.defineProperty(g, name, { value: obj, writable: false, configurable: false, enumerable: true }); }
    catch (e) { /* 已經鎖過：保留第一份 */ }
  }

  function include(path) {
    if (!current) return;
    /* 防快取：GitHub Pages 會叫瀏覽器快取 10 分鐘，改了設定或題庫之後要等很久才看得到 ——
       這裡帶一個「每 10 分鐘換一次」的版本號，最多舊 10 分鐘（不必每次都重抓）。 */
    var v = Math.floor(Date.now() / 600000);
    document.write('<scr' + 'ipt src="' + ROOT + current + '/' + path + '?v=' + v + '"></scr' + 'ipt>');
  }

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 各學期航線的目的地群島介紹（Dodo Airlines 機場櫃台展示用，不影響任何課程教材文字） */
  var FLIGHT_ROUTES = {
    '11501': {
      flightNo: 'DAL-1151',
      gate: 'GATE A1',
      archipelago: '初階科技探險群島（上學期之島）',
      weather: '☀️ 晴朗微風 · 適合果園採收與木工造船',
      colorBadge: 'bg-sky-600 text-white',
      accentBorder: 'border-sky-400',
      btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200',
      orvillePitch: '「DAL-1151 上學期航線」會飛往『初階科技探險群島』！島上有資訊倫理果園、運算思維遊樂園、流程圖與 Scratch 蒸氣峽谷，以及 5016B 智慧家居燈塔喔！',
      islands: [
        { icon: '⚖️', name: '資訊倫理果園島', sub: '網路禮儀、PAPA 理論、著作權與資安（10 章節）' },
        { icon: '🧠', name: '運算思維遊樂園島', sub: '跳格子、任意門、滑梯公園等 10 座邏輯遊樂設施' },
        { icon: '🐱', name: '流程圖＆Scratch 蒸氣島', sub: '清單學習機、音階前導、排流程圖與 10 關程式' },
        { icon: '💡', name: '智慧家居 5016B 科技島', sub: '感應、換算、調速、RGB 混色 5 節創客機電實驗' }
      ]
    },
    '11502': {
      flightNo: 'DAL-1152',
      gate: 'GATE B2',
      archipelago: '進階創客探險群島（下學期之島）',
      weather: '🌤️ 碧海晴空 · 適合演算法解謎與專題研發',
      colorBadge: 'bg-emerald-600 text-white',
      accentBorder: 'border-emerald-400',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200',
      orvillePitch: '「DAL-1152 下學期航線」會飛往『進階創客探險群島』！包含媒體與社會議題果園、二期思維樂園、Scratch 排序與搜尋演算法峽谷，以及 Arduino 專題島！',
      islands: [
        { icon: '📡', name: '媒體與社會議題果園島', sub: '媒體素養、資訊失序、言論自由、霸凌防治與演算法' },
        { icon: '🧠', name: '運算思維二期樂園島', sub: '智慧選卡、必勝棋局、變數謎題等 10 座進階謎題' },
        { icon: '🧩', name: 'Scratch 演算法積木島', sub: '自訂函式、選擇/插入排序、循序/二元搜尋 10 關' },
        { icon: '🤖', name: 'Arduino 智慧專題科技島', sub: '五節課 PBL 專題探究、感測器與硬體互動模擬' }
      ]
    }
  };

  /**
   * 在指定容器內渲染「🦤 Dodo Airlines 水上機場・航廈搭機櫃台」完整場景
   * @param {HTMLElement} hostEl
   * @param {Object} [opts] { targetPath: 'course/hub.html', isModal: false, onClose: fn, showTeacherLink: false }
   */
  function renderAirportCounter(hostEl, opts) {
    if (!hostEl) return;
    opts = opts || {};
    var targetPath = opts.targetPath || 'course/hub.html';
    var schoolObj = (SITE.SCHOOL || {});
    var schoolTitle = [schoolObj.NAME, schoolObj.GRADE].filter(Boolean).join(' ') || '資訊科技探險群島';
    var byDateId = byDate();
    var activeTermId = current || byDateId;

    var cardsHtml = LIST.map(function (t, idx) {
      var route = FLIGHT_ROUTES[t.id] || FLIGHT_ROUTES[idx === 0 ? '11501' : '11502'];
      var isCurrent = (t.id === activeTermId);
      var isRecommendedByDate = (t.id === byDateId);
      var destHref = ROOT + targetPath + (String(targetPath).indexOf('?') >= 0 ? '&' : '?') + 'term=' + encodeURIComponent(t.id);

      var islandsListHtml = route.islands.map(function (isl) {
        return '<div class="flex items-start gap-2.5 bg-slate-50/90 border border-slate-200/80 rounded-xl px-3 py-2">'
          + '<span class="text-xl leading-none mt-0.5 shrink-0">' + isl.icon + '</span>'
          + '<div class="min-w-0 text-left">'
          +   '<div class="text-xs sm:text-sm font-black text-slate-800 truncate">' + escHtml(isl.name) + '</div>'
          +   '<div class="text-[11px] font-bold text-slate-500 leading-snug">' + escHtml(isl.sub) + '</div>'
          + '</div>'
          + '</div>';
      }).join('');

      return ''
        + '<div class="dal-boarding-pass ' + (isCurrent ? 'is-current-term' : '') + ' flex flex-col justify-between" data-route-card="' + escHtml(t.id) + '">'
        +   '<div class="p-4 sm:p-5">'
        +     '<div class="flex items-center justify-between gap-2 flex-wrap mb-3">'
        +       '<div class="flex items-center gap-1.5">'
        +         '<span class="text-[11px] font-black px-2.5 py-0.5 rounded-full ' + route.colorBadge + '">' + escHtml(route.gate) + ' · ' + escHtml(route.flightNo) + '</span>'
        +         (isRecommendedByDate ? '<span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">📅 本學期推薦</span>' : '')
        +       '</div>'
        +       (isCurrent && opts.isModal
                  ? '<span class="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">📍 目前所在群島</span>'
                  : '<span class="text-[11px] font-mono font-bold text-slate-400">BOARDING PASS</span>')
        +     '</div>'
        +     '<div class="text-left mb-3">'
        +       '<div class="text-xs font-extrabold text-amber-700">' + escHtml(t.name) + '（' + escHtml(t.short || t.id) + '）</div>'
        +       '<h3 class="text-lg sm:text-xl font-black text-slate-900 leading-snug mt-0.5">🏝️ ' + escHtml(route.archipelago) + '</h3>'
        +       '<div class="text-[11px] font-bold text-slate-500 mt-1">' + escHtml(route.weather) + '</div>'
        +     '</div>'
        +     '<div class="text-left mb-1">'
        +       '<div class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">🗺️ 航線停靠的 4 座主題小島：</div>'
        +       '<div class="grid grid-cols-1 gap-1.5">' + islandsListHtml + '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="dal-pass-perforation bg-amber-50/60 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">'
        +     '<div class="text-left">'
        +       '<div class="text-[10px] font-mono font-bold text-slate-400 uppercase">SEAPLANE TERMINAL</div>'
        +       '<div class="text-xs font-black text-slate-700">🦤 莫里櫃台簽發 · 自由往返</div>'
        +     '</div>'
        +     '<button type="button" data-board-term="' + escHtml(t.id) + '" data-board-href="' + escHtml(destHref) + '" '
        +       'class="dal-board-btn px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition transform active:scale-95 cursor-pointer ' + route.btnClass + '">'
        +       (isCurrent && opts.isModal ? '✈️ 重新登島 (' + escHtml(t.short || t.id) + ')' : '✈️ 辦理登機・飛往此島 →')
        +     '</button>'
        +   '</div>'
        + '</div>';
    }).join('');

    var closeBtnHtml = opts.isModal
      ? '<button type="button" data-dal-close class="px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-600 text-xs font-black cursor-pointer transition">✕ 留在目前島嶼</button>'
      : '';

    var teacherFooterHtml = opts.showTeacherLink
      ? '<div class="bg-amber-100/70 border-t-2 border-amber-200 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-stone-600 flex-wrap gap-2">'
        + '<span>🍃 ' + escHtml(schoolTitle) + ' · Dodo Airlines 跨學期水上航線總站</span>'
        + '<a href="' + escHtml(ROOT + 'course/teacher.html?term=' + encodeURIComponent(activeTermId)) + '" class="underline hover:text-amber-900 font-black">🛠️ 教師管理後台入口 →</a>'
        + '</div>'
      : '';

    hostEl.innerHTML = ''
      + '<div class="dal-terminal-shell w-full max-w-5xl mx-auto">'
      +   '<div class="dal-departure-board flex flex-col sm:flex-row sm:items-center justify-between gap-2">'
      +     '<div class="flex items-center gap-2.5 flex-wrap">'
      +       '<span class="text-2xl">✈️</span>'
      +       '<div>'
      +         '<div class="flex items-center gap-2 flex-wrap">'
      +           '<span class="dal-flap-cell text-xs sm:text-sm">DODO AIRLINES</span>'
      +           '<span class="text-xs font-black text-sky-300 tracking-wider">' + escHtml(schoolTitle) + ' · 水上機場搭機櫃台</span>'
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +     '<div class="flex items-center gap-2 flex-wrap">'
      +       '<span class="dal-flap-cell text-[11px]" style="color:#4ade80">STATUS: BOARDING 準點登機中</span>'
      +       closeBtnHtml
      +     '</div>'
      +   '</div>'
      +   '<div class="dal-counter-stage p-4 sm:p-6">'
      +     '<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">'
      +       '<div class="lg:col-span-7 bg-amber-50/95 border-4 border-amber-800 rounded-2xl p-4 shadow-xl relative">'
      +         '<div class="flex items-start gap-3.5">'
      +           '<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-sky-200 to-sky-400 border-3 border-amber-800 flex flex-col items-center justify-center shrink-0 shadow-inner relative">'
      +             '<span class="text-3xl sm:text-4xl leading-none">🦤</span>'
      +             '<span class="text-[10px] font-black bg-amber-800 text-amber-100 px-1.5 py-0.2 rounded-full mt-1">地勤 莫里</span>'
      +           '</div>'
      +           '<div class="min-w-0 flex-1 text-left">'
      +             '<div class="inline-flex items-center gap-1.5 bg-sky-700 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1">'
      +               '<span>🎙️ Dodo Airlines 機場櫃檯廣播</span>'
      +             '</div>'
      +             '<p id="dal-orville-speech" class="text-xs sm:text-sm font-black text-amber-950 leading-relaxed">'
      +               '歡迎光臨 Dodo Airlines 水上機場搭機櫃台！歐拉～我是櫃台地勤莫里！請問今天想搭乘「上學期航線」還是「下學期航線」前往哪一座探險群島呢？請點選下方登機證蓋章出發！'
      +             '</p>'
      +           '</div>'
      +         '</div>'
      +         '<div class="mt-3 pt-2.5 border-t-2 border-dashed border-amber-300 flex items-center justify-between text-[11px] font-extrabold text-amber-900 flex-wrap gap-2">'
      +           '<div class="flex items-center gap-3 flex-wrap">'
      +             '<span>🛂 島民護照查驗處</span>'
      +             '<span>🌍 跨學期雙群島直飛</span>'
      +             '<span>🧳 星星與學習紀錄自動同步保存</span>'
      +           '</div>'
      +           '<span class="text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full">免費水上包機</span>'
      +         '</div>'
      +       '</div>'
      +       '<div class="lg:col-span-5 flex flex-col items-center justify-center">'
      +         '<div class="w-full bg-gradient-to-b from-sky-300 via-sky-200 to-cyan-500 rounded-2xl border-4 border-sky-900 p-3 shadow-inner relative overflow-hidden" style="min-height:148px">'
      +           '<div class="absolute top-2 left-3 text-[10px] font-black text-sky-950 bg-white/80 px-2 py-0.5 rounded-full">🌅 停機坪觀景窗 · 羅德里機長待命中</div>'
      +           '<svg viewBox="0 0 320 130" class="w-full h-32 sm:h-36">'
      +             '<g class="dal-cloud-svg">'
      +               '<ellipse cx="65" cy="30" rx="22" ry="9" fill="#ffffff" opacity="0.88"/>'
      +               '<ellipse cx="78" cy="27" rx="16" ry="8" fill="#ffffff" opacity="0.88"/>'
      +               '<ellipse cx="245" cy="24" rx="24" ry="8" fill="#ffffff" opacity="0.85"/>'
      +             '</g>'
      +             '<path d="M18,92 Q45,62 78,92 Z" fill="#15803d" opacity="0.75"/>'
      +             '<path d="M245,92 Q278,58 308,92 Z" fill="#0f766e" opacity="0.75"/>'
      +             '<rect x="0" y="90" width="320" height="40" fill="#0284c7"/>'
      +             '<path d="M0,98 Q40,93 80,98 T160,98 T240,98 T320,98" stroke="#7dd3fc" stroke-width="2.5" fill="none"/>'
      +             '<rect x="10" y="80" width="68" height="8" rx="3" fill="#92400e" stroke="#451a03" stroke-width="1.5"/>'
      +             '<rect x="22" y="88" width="6" height="18" fill="#78350f"/>'
      +             '<rect x="58" y="88" width="6" height="18" fill="#78350f"/>'
      +             '<g id="dal-seaplane-actor" class="dal-seaplane-svg">'
      +               '<rect x="122" y="92" width="64" height="9" rx="4.5" fill="#0369a1" stroke="#0c4a6e" stroke-width="1.5"/>'
      +               '<line x1="140" y1="80" x2="136" y2="92" stroke="#334155" stroke-width="2.5"/>'
      +               '<line x1="168" y1="80" x2="172" y2="92" stroke="#334155" stroke-width="2.5"/>'
      +               '<path d="M102,68 L118,50 L126,68 Z" fill="#0284c7" stroke="#0c4a6e" stroke-width="1.5"/>'
      +               '<rect x="115" y="60" width="72" height="24" rx="10" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>'
      +               '<rect x="118" y="70" width="66" height="6" fill="#0284c7"/>'
      +               '<path d="M158,62 L178,62 L183,70 L158,70 Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>'
      +               '<rect x="128" y="53" width="52" height="7" rx="3.5" fill="#0284c7" stroke="#0c4a6e" stroke-width="1.5"/>'
      +               '<circle cx="190" cy="72" r="4" fill="#dc2626"/>'
      +               '<rect x="188" y="56" width="4" height="32" rx="2" fill="#334155" class="dal-propeller"/>'
      +             '</g>'
      +           '</svg>'
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="p-4 sm:p-6 bg-gradient-to-b from-amber-50/70 to-stone-100/80">'
      +     '<div class="grid grid-cols-1 md:grid-cols-2 gap-5">'
      +       cardsHtml
      +     '</div>'
      +   '</div>'
      +   teacherFooterHtml
      + '</div>';

    var speechEl = hostEl.querySelector('#dal-orville-speech');
    var planeActor = hostEl.querySelector('#dal-seaplane-actor');

    var routeCards = hostEl.querySelectorAll('[data-route-card]');
    for (var i = 0; i < routeCards.length; i++) {
      (function (cardEl) {
        var rId = cardEl.getAttribute('data-route-card');
        var routeInfo = FLIGHT_ROUTES[rId];
        cardEl.addEventListener('mouseenter', function () {
          if (speechEl && routeInfo && !hostEl.dataset.boardingLocked) {
            speechEl.textContent = routeInfo.orvillePitch;
          }
        });
      })(routeCards[i]);
    }

    var closeBtn = hostEl.querySelector('[data-dal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (typeof opts.onClose === 'function') opts.onClose();
      });
    }

    var boardBtns = hostEl.querySelectorAll('[data-board-term]');
    for (var b = 0; b < boardBtns.length; b++) {
      boardBtns[b].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var chosenTerm = btn.getAttribute('data-board-term');
        var destUrl = btn.getAttribute('data-board-href');
        if (!chosenTerm || hostEl.dataset.boardingLocked) return;
        hostEl.dataset.boardingLocked = '1';

        if (valid(chosenTerm)) write(chosenTerm);

        var passCard = btn.closest('.dal-boarding-pass');
        if (passCard) {
          var stamp = document.createElement('div');
          stamp.className = 'dal-stamp-seal';
          stamp.innerHTML = '🦤 DODO AIRLINES<br>准予登機 APPROVED';
          passCard.appendChild(stamp);
        }

        var routeInfo = FLIGHT_ROUTES[chosenTerm] || {};
        if (speechEl) {
          speechEl.textContent = '叮咚！已為您蓋上「' + (routeInfo.flightNo || chosenTerm) + '」登機章！羅德里機長已啟動螺旋槳，正在起飛前往【' + (routeInfo.archipelago || chosenTerm) + '】——祝您探險愉快！';
        }
        btn.textContent = '✈️ 水上飛機起飛中…';
        if (planeActor) {
          planeActor.classList.add('is-taking-off');
        }

        setTimeout(function () {
          global.location.href = destUrl;
        }, 780);
      });
    }
  }

  /**
   * 在任何頁面彈出「🦤 Dodo Airlines 水上機場・上下學期航線切換櫃台」浮動場景視窗
   */
  function openAirportModal(opts) {
    opts = opts || {};
    var existing = document.getElementById('dal-airport-modal');
    if (existing) existing.remove();

    var backdrop = document.createElement('div');
    backdrop.id = 'dal-airport-modal';
    backdrop.className = 'ac-float-backdrop';
    backdrop.style.zIndex = '95';
    backdrop.style.padding = '24px 12px';
    backdrop.style.overflowY = 'auto';

    var mountBox = document.createElement('div');
    mountBox.className = 'w-full max-w-5xl my-auto pop';
    backdrop.appendChild(mountBox);
    document.body.appendChild(backdrop);

    function closeModal() {
      backdrop.remove();
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });

    renderAirportCounter(mountBox, {
      targetPath: opts.targetPath || 'course/hub.html',
      isModal: true,
      showTeacherLink: false,
      onClose: closeModal
    });
  }

  global.TERMSEL = {
    current: current,
    list: LIST.map(function (t) { return { id: t.id, name: t.name, short: t.short, START: t.START }; }),
    info: info,
    byDate: byDate,
    root: ROOT,
    include: include,
    /** 換學期：記下來（呼叫端自己決定要不要重新載入頁面） */
    choose: function (id) { if (valid(id)) write(id); return valid(id); },
    /** 帶著學期的網址：TERMSEL.url('course/hub.html', '11502') */
    url: function (path, id) { return ROOT + path + (String(path).indexOf('?') >= 0 ? '&' : '?') + 'term=' + encodeURIComponent(id || current); },
    renderAirportCounter: renderAirportCounter,
    openAirportModal: openAirportModal
  };
  lock(global, 'TERMSEL', global.TERMSEL);

  /* 載入這一學期的設定（defineTerm 會在裡面被呼叫） */
  if (current) include('config.js');
})(window);
