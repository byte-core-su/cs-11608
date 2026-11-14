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

  /* 各模組的星數上限（進度條的分母）寫在 {學期}/config.js 的 MODULES[].maxStars 與 SUBJECTS[].max */

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

  /* ── 🧠 概念星（下學期 Scratch 每一關的概念檢測）──────────────
     ★ 兩組星星，各自算各自的：
         🧩 作品星（unitStars）—— 上傳 .sb3 和範例比對，Apps Script 寫入
         🧠 概念星 —— 概念檢測五題開放式作答，講到幾題（本機關鍵字判定，shared/answer.js）
     ⚠️ 概念星不寫進 unitStars，也不另外存：每次讀進度時從 modules.scratch.quiz 的分數**現算**，
        沒有第二份資料，就沒有兩份會不一致的問題。
     ⚠️ 概念檢測可以一直重寫到過為止，而且是學生端自己寫的 —— 它是「成就」，不是「通行證」。 */
  QUIZ_PASS: 3,          // 五題講到幾題才能往下走（＝第 1 顆概念星）
  QUIZ_FULL: 4,          // 講到幾題才拿得到第 2 顆概念星（五題全講到＝3 顆）

  /** 這一關的概念星（0～3）。沒考過就是 0 —— 那不是懲罰，是還沒做。 */
  quizStars: function (quiz, unitId) {
    var q = (quiz || {})[unitId];
    var n = q && typeof q.score === 'number' ? q.score : -1;
    if (n < 0) return 0;
    if (n >= 5) return 3;
    if (n >= this.QUIZ_FULL) return 2;
    if (n >= this.QUIZ_PASS) return 1;
    return 0;
  },

  /** 概念星的總數與拿到星的關數 */
  quizTotal: function (quiz) {
    var total = 0, done = 0, self = this;
    Object.keys(quiz || {}).forEach(function (k) {
      var s = self.quizStars(quiz, k);
      if (s > 0) { total += s; done++; }
    });
    return { stars: total, done: done };
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
     ★★ 各模組的「目前星數」—— 全站唯一算法（2026-11-09 統一）
     -------------------------------------------------------------------
     把「一個模組現在有幾顆星」收進 GRADING.moduleStars(mods, key, history)，
     所有頁面都問它，不要在各頁各自寫一套。
       · ethics    ：優先加總 units[ch].star；沒 units 或加起來比 stars 少時用 stars 兜底
       · thinking  ：加總 units[id].star + history 裡還沒進 units 的通關關卡，與 stars 取較大值
       · flowchart ：max(stars, units.length × 2) ＋ 圖片加分（imgUnits）
       · scratch   ：優先加總 unitStars[u]（>0）；空的時候才退回 stars
       · concept   ：由 modules.scratch.quiz 現算（quizTotal）
     =================================================================== */
  STAR_MODULES: ['ethics', 'thinking', 'flowchart', 'scratch', 'concept'],

  moduleStars: function (mods, key, history) {
    mods = mods || {};
    if (key === 'concept') {
      return this.quizTotal((mods.scratch || {}).quiz).stars;
    }
    var d = mods[key] || {};
    var own = Object.prototype.hasOwnProperty;
    var st = Number(d.stars) || 0, k, v, sum, n;
    if (key === 'ethics' && d.units && typeof d.units === 'object') {
      sum = 0; n = 0;
      for (k in d.units) {
        if (!own.call(d.units, k)) continue;
        v = Math.min(3, Number(d.units[k] && d.units[k].star) || 0);
        if (v > 0) { sum += v; n++; }
      }
      if (n) st = sum;
    } else if (key === 'thinking') {
      var seen = {}, cnt = 0;
      var mark = function (id) { if (id != null && !seen[String(id)]) { seen[String(id)] = 1; cnt++; } };
      (Array.isArray(history) ? history : []).forEach(function (h) {
        if (h && h.module === 'thinking') mark(h.challenge != null ? h.challenge : h.unit);
      });
      if (d.units && typeof d.units === 'object' && !Array.isArray(d.units)) {
        for (k in d.units) if (own.call(d.units, k) && (Number(d.units[k] && d.units[k].star) || 0) > 0) mark(k);
      }
      cnt = Math.max(cnt, Number(d.level) || 0);
      if (cnt) st = this.thinkingStars(cnt);
    } else if (key === 'flowchart' && Array.isArray(d.units) && d.units.length) {
      var u = {};
      d.units.forEach(function (x) { u[String(x)] = 1; });
      st = this.flowchartStars(Object.keys(u).length);
    } else if (key === 'scratch' && d.unitStars && typeof d.unitStars === 'object') {
      sum = 0; n = 0;
      for (k in d.unitStars) {
        if (!own.call(d.unitStars, k)) continue;
        v = Number(d.unitStars[k]) || 0;
        if (v > 0) { sum += v; n++; }
      }
      if (n) st = sum;
    }
    var cap = { ethics: 30, thinking: 20, flowchart: 20, scratch: 30 }[key];
    if (cap != null) st = Math.min(st, cap);
    var b = this.starsWithBonus({ modules: mods }), self = this;
    if (key === 'flowchart') {
      if (Array.isArray(d.units) && d.units.length) {
        var fu = d.units.map(String);
        st += Object.keys(d.imgUnits || {}).filter(function (id) { return d.imgUnits[id] && fu.indexOf(String(id)) >= 0; }).length * (self.BONUS.img || 1);
      } else st += b.flowchartBonus || 0;
    }
    if (key === 'scratch' && self.BONUS.vid) {
      if (d.unitStars && typeof d.unitStars === 'object' && Object.keys(d.unitStars).length) {
        st += Object.keys(d.vidUnits || {}).filter(function (id) { return d.vidUnits[id] && (Number(d.unitStars[id]) || 0) > 0; }).length * self.BONUS.vid;
      } else st += b.scratchBonus || 0;
    }
    return st;
  },

  /** 一個學生「所有模組加起來」的總星數（預設算該學期 SUBJECTS 的那些模組） */
  totalStars: function (doc, keys) {
    var p = doc || {}, mods = p.modules || {};
    var hist = this.statHistory(p);
    var list = keys;
    if (!list) {
      var subs = ((typeof window !== 'undefined' && window.CONFIG && window.CONFIG.SUBJECTS) || []);
      list = subs.length ? subs.map(function (s) { return s.key; }) : this.STAR_MODULES;
    }
    var sum = 0, self = this;
    list.forEach(function (k) { sum += self.moduleStars(mods, k, hist); });
    return sum;
  },

  /* ── 單一關卡「通關了沒／幾顆星」（含 history 救援，與 moduleStars 對齊）── */
  unitCleared: function (mods, key, unitId, history) {
    if (key === 'scratch') {
      var m = (mods || {}).scratch || {};
      if (!this.GATE.needsUpload(unitId)) return !!(m.play || {})[unitId];
      return (Number((m.unitStars || {})[unitId]) || 0) >= this.GATE.PASS_STARS;
    }
    return this.unitStar(mods, key, unitId, history) > 0;
  },
  unitStar: function (mods, key, unitId, history) {
    var m = (mods || {})[key] || {};
    if (key === 'ethics') {
      var u = (m.units || {})[unitId];
      return Math.min(3, Number(u && u.star) || 0);
    }
    if (key === 'thinking') {
      var hit = (Array.isArray(history) ? history : []).some(function (h) {
        return h && h.module === 'thinking' && String(h.challenge != null ? h.challenge : h.unit) === String(unitId);
      }) || (!Array.isArray(m.units) && (Number(((m.units || {})[unitId] || {}).star) || 0) > 0);
      return hit ? this.thinkingStars(1) : 0;
    }
    if (key === 'flowchart') {
      var done = (Array.isArray(m.units) ? m.units : []).map(String).indexOf(String(unitId)) >= 0;
      var fb = (m.imgUnits || {})[unitId] ? (this.BONUS.img || 1) : 0;
      return done ? this.FLOWCHART_PER_UNIT + fb : 0;
    }
    if (key === 'scratch') {
      var st = Number((m.unitStars || {})[unitId]) || 0;
      var vb = (this.BONUS.vid && (m.vidUnits || {})[unitId]) ? this.BONUS.vid : 0;
      return st + (st > 0 ? vb : 0);
    }
    if (key === 'concept') {
      return this.quizStars((mods.scratch || {}).quiz, String(unitId));
    }
    return 0;
  },

  /* ===================================================================
     一關算「通關」了沒（程式設計十關全部開放，這只用在顯示與晨星勇者的開放條件）
       流程圖排對；有接 Apps Script 評分（GRADER_URL）的話再加上作品 ≥ 2⭐。
     =================================================================== */
  GATE: {
    PASS_STARS: 2,
    /** 這一關要不要上傳程式作品（{學期}/config.js 的 NO_UPLOAD 列出不必上傳的關卡） */
    needsUpload: function (unitId) {
      var c = ((typeof window !== 'undefined' && window.CONFIG) || {});
      return (c.NO_UPLOAD || []).indexOf(String(unitId)) < 0;
    },
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
