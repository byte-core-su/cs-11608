/* =====================================================================
   全站共用計分規則（單一來源）
   ---------------------------------------------------------------------
   學生端與教師端都載入這一支、呼叫 window.GRADING，不要在各頁自行寫死門檻。
   改這裡，學生端與教師端（含「重算星星」）都會一起套用。
   ===================================================================== */
window.GRADING = {
  /* 資訊倫理：依「單一章節最佳正確率(%)」給星（各章累加）
     三星 ≥ 90%、二星 ≥ 75%、一星 < 75%（完成即至少 1 星） */
  ethicsStar: function (rate) {
    rate = Number(rate) || 0;
    if (rate >= 90) return 3;
    if (rate >= 75) return 2;
    return 1;
  },

  // 運算思維：每完成一小關 +2 星（10 關滿 20 星）
  thinkingStars: function (completedCount) {
    return (Number(completedCount) || 0) * 2;
  },

  // 流程圖：每排完一關 +2 星（10 關滿 20 星）
  FLOWCHART_PER_UNIT: 2,
  flowchartStars: function (completedCount) {
    return (Number(completedCount) || 0) * this.FLOWCHART_PER_UNIT;
  },

  /* ===================================================================
     流程圖圖片加分（老師人工審核後給）
     -------------------------------------------------------------------
     學生把流程圖轉成的圖片交到 Classroom，老師在「📥 繳交審核」看過才給：每關 +1★
     （排對 2★ ＋ 交圖 1★ ＝ 單關最高 3★）。

     加分存在學生寫不到的欄位，顯示時才和自動星相加：
       modules.flowchart.imgUnits = { '2-1-1A': { at: 時間, by: '老師email' } }
     若寫進自動星那一格，學生下次通關時整格會被自己的自動值覆蓋，加分就默默消失。
     用物件而不是陣列：同一關重複審核不會變成兩筆，也記得住時間與是誰給的。
     =================================================================== */
  BONUS: { img: 1 },

  /** 這個模組拿到幾顆加分星（加分的關數 × 每關加分） */
  bonusStars: function (unitsMap, kind) {
    var per = this.BONUS[kind || 'img'];
    if (per == null) per = 1;
    var n = 0;
    for (var k in (unitsMap || {})) {
      if (Object.prototype.hasOwnProperty.call(unitsMap, k) && unitsMap[k]) n++;
    }
    return n * per;
  },

  /**
   * 各模組的星數上限（進度條的分母）。
   * 作品星由 Apps Script 比對範本給（config.js 的 GRADER_URL），單關最高 3★；
   * 沒設 GRADER_URL ＝ 作品星拿不到，分母就不算它（不然進度條永遠到不了 100%）。
   */
  moduleMax: function (units) {
    units = units || 10;
    var cfg = ((typeof window !== 'undefined' && window.CONFIG) || {});
    return {
      flowchart: units * (this.FLOWCHART_PER_UNIT + this.BONUS.img),
      scratch:   cfg.GRADER_URL ? units * 3 : 0
    };
  },

  /**
   * 從一份 progress 文件算出「顯示用」的各模組星數（含加分）。
   * 教師端與學生端都用這一支，不要各自把加分再加一次或漏加。
   */
  starsWithBonus: function (progress) {
    var m = (progress || {}).modules || {};
    var flow = m.flowchart || {}, scr = m.scratch || {};
    var flowBonus = this.bonusStars(flow.imgUnits, 'img');
    return {
      flowchart: (Number(flow.stars) || 0) + flowBonus,
      scratch:   Number(scr.stars) || 0,
      bonus:     flowBonus,
      flowchartBonus: flowBonus
    };
  },

  /* ── 加分的合理性檢查（繳交審核用）─────────────────────
     學生要先把流程圖排對，才生得出流程圖圖片。所以
       「流程圖還沒排對，卻交了圖」「圖的繳交時間比排對的時間還早」
     都代表哪裡不對（交錯關卡、交了舊檔…）。只警告、不硬擋，最後決定權在老師。 */

  /** 這一關流程圖排對了沒、什麼時候排對的 */
  baseFor: function (progress, unitId) {
    var p = progress || {}, m = p.modules || {};
    var at = 0;
    (p.history || []).forEach(function (h) {
      if (h && h.module === 'flowchart' && h.unit === unitId) at = Math.max(at, Number(h.at) || 0);
    });
    var done = ((m.flowchart || {}).units || []).indexOf(unitId) >= 0;
    return { done: done, stars: done ? this.FLOWCHART_PER_UNIT : 0,
             label: done ? '流程圖已排對' : '流程圖還沒排對', at: at };
  },

  /** 給這一分之前有什麼值得先看一眼的？回空字串＝沒問題。submittedAt 是 Classroom 的繳交時間（毫秒）。 */
  bonusWarning: function (base, submittedAt) {
    base = base || {};
    if (!base.done) return '這一關的原始分數還沒拿到（' + (base.label || '') + '）';
    var sub = Number(submittedAt) || 0;
    if (base.at && sub && sub < base.at) return '附件的時間比完成時間還早 —— 交的可能是別關或舊的檔案';
    return '';
  },

  /** 這一關的圖片加分給過了嗎 */
  hasBonus: function (unitsMap, unitId) {
    return !!((unitsMap || {})[unitId]);
  },

  /** 由「各單元最佳星數」算出作品星總數與拿到星的關數（0 星不算） */
  scratchTotal: function (unitStars) {
    var total = 0, done = 0;
    for (var k in (unitStars || {})) {
      var s = Number(unitStars[k]) || 0;
      if (s > 0) { total += s; done++; }
    }
    return { stars: total, done: done };
  },

  /** 拿來「算星數成長」的歷程（每週評分、成長曲線、即時看板、hub 本週星數都用這一份） */
  statHistory: function (doc) {
    return Array.isArray((doc || {}).history) ? doc.history : [];
  },

  /* ===================================================================
     一關算「通關」了沒（程式設計十關全部開放，這只用在顯示與晨星勇者的開放條件）
       流程圖排對；有接 Apps Script 評分（GRADER_URL）的話再加上作品 ≥ 2⭐。
     =================================================================== */
  GATE: {
    PASS_STARS: 2,
    cleared: function (unitId, flowDone, unitStars) {
      var flow = !!(flowDone || {})[unitId];
      var g = ((typeof window !== 'undefined' && window.CONFIG) || {}).GRADER_URL;
      return g ? (flow && (Number((unitStars || {})[unitId]) || 0) >= this.PASS_STARS) : flow;
    }
  }
};

(function () {
  /* 🔒 鎖住：載入完就凍結，window 上這個名字也不能再指向別的東西 ——
     擋的是在 Console 把計分函式換掉。只擋「網頁載入之後」才動手的；同一頁載入兩次時保留第一份。 */
  function __lockGlobal(g, name, obj) {
    (function freeze(o) {
      if (!o || (typeof o !== 'object' && typeof o !== 'function') || Object.isFrozen(o)) return;
      Object.freeze(o);
      Object.getOwnPropertyNames(o).forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(o, k);
        if (d && 'value' in d) freeze(d.value);
      });
    })(obj);
    try {
      Object.defineProperty(g, name, { value: obj, writable: false, configurable: false, enumerable: true });
    } catch (e) { /* 已經鎖過：保留第一份 */ }
  }
  __lockGlobal(window, 'GRADING', window.GRADING);
})();
