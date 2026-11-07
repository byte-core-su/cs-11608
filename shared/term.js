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
    url: function (path, id) { return ROOT + path + (String(path).indexOf('?') >= 0 ? '&' : '?') + 'term=' + encodeURIComponent(id || current); }
  };
  lock(global, 'TERMSEL', global.TERMSEL);

  /* 載入這一學期的設定（defineTerm 會在裡面被呼叫） */
  if (current) include('config.js');
})(window);
