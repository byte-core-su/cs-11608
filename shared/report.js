/* =====================================================================
   進度回報（單一來源）
   ---------------------------------------------------------------------
   章節測驗通關時呼叫這裡寫入 `{TERM}-progress/{學號}`，hub 的 onSnapshot 就會即時亮燈。
   不要各頁自己拼 Firestore 路徑。

   資料格式：
     modules.{id} = { status, stars, score, level, units, total, qstat, source, updatedAt }
     history[]    = { module, unit, stars(這一次新增幾顆), got, score, at, … }   ← 用 arrayUnion 追加

   ---------------------------------------------------------------------
   用法：各頁 SDK 版本不同，所以由頁面自己注入 Firestore 函式（一次就好）

     REPORT.configure({ db, doc, getDoc, setDoc, arrayUnion });
     await REPORT.unit('ethics', '1-2', { star: 3, score: 92, extra: {…} });   // 完成一個小單元
     await REPORT.qstat('ethics', { 題id: {n, ok} });                          // 逐題統計
   ===================================================================== */
(function (global) {
  'use strict';

  // 集合名稱一律由 config.js 決定，這支不寫死任何學期編號
  var CFG = global.CONFIG || {};
  var COL = (CFG.COLLECTIONS && CFG.COLLECTIONS.PROGRESS)
            || ((CFG.TERM || '11501') + '-progress');
  var fb = null;              // { db, doc, getDoc, setDoc, arrayUnion }

  /** 各模組的星數上限（與 hub 的 MODULES[].maxStars 一致） */
  var MAX = {
    ethics: 30,      // 10 章節 × 最多 3 星
    thinking: 20, flowchart: 20, scratch: 30
  };

  /** 累加型模組的「小關總數」：全部完成才算整個模組通關（只過 1 個章節就顯示「已通關」會誤導學生）。
      config.js 可以用 UNITS_TOTAL 覆寫。 */
  var UNITS_TOTAL = Object.assign({
    ethics: 10,     // 8 個小節 + 2 個整章挑戰
    thinking: 10,
    flowchart: 10,
    scratch: 10
  }, CFG.UNITS_TOTAL || {});

  /** history 陣列的長度上限：超過就把最舊的丟掉，避免單一文件無限長大 */
  var HISTORY_CAP = CFG.HISTORY_CAP || 400;

  function configure(deps) { fb = deps; }

  function ready() {
    if (!fb) { console.warn('[REPORT] 尚未 configure()，這次回報略過'); return false; }
    if (!global.SSO || !SSO.sid()) { console.warn('[REPORT] 取不到學號，這次回報略過'); return false; }
    if (global.SSO && SSO.embedded()) return false;   // iframe 內由外層頁負責
    return true;
  }

  function ref() { return fb.doc(fb.db, COL, SSO.sid()); }

  async function readDoc() {
    try {
      var snap = await fb.getDoc(ref());
      return snap.exists() ? (snap.data() || {}) : {};
    } catch (e) { console.error('[REPORT] 讀取進度失敗', e); return {}; }
  }

  /** 把 modules 的 stars 加總成 totalStars */
  function sumStars(modules) {
    var t = 0;
    for (var k in (modules || {})) t += Number(modules[k] && modules[k].stars) || 0;
    return t;
  }

  /** 共用寫入：合併 modules.{id}、追加 history、更新 totalStars */
  async function write(moduleId, patch, historyEntry) {
    if (!ready()) return null;

    var now = Date.now();
    var me  = (global.SSO && SSO.me && SSO.me()) || {};
    var cur = await readDoc();
    var modules = cur.modules || {};

    modules[moduleId] = Object.assign({}, modules[moduleId], patch, {
      source: patch.source || 'auto',
      updatedAt: now
    });

    /* 只寫這一個模組（setDoc 有 merge:true，巢狀的 map 會深層合併）：
       寫回整份 modules 的話，會把這段時間別人（例如 Apps Script 寫的作品星）剛寫的值蓋回去。
       totalStars 用手上這份算，它只是給人看的摘要，不是任何判定的依據。 */
    var own = {};
    own[moduleId] = modules[moduleId];
    var payload = {
      studentId: SSO.sid(),
      modules: own,
      totalStars: sumStars(modules),
      updatedAt: now
    };
    if (me.name) payload.name = me.name;
    if (historyEntry) {
      var entry = Object.assign({ module: moduleId, at: now }, historyEntry);
      var old   = cur.history || [];
      if (old.length >= HISTORY_CAP) {
        // 滿了就整批重寫：留最新的 CAP-1 筆再接上這次（arrayUnion 只能加不能刪）
        old = old.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        payload.history = old.slice(old.length - (HISTORY_CAP - 1)).concat([entry]);
      } else {
        payload.history = fb.arrayUnion(entry);
      }
    }

    try {
      await fb.setDoc(ref(), payload, { merge: true });   // ★ 一定要 merge
      return modules[moduleId];
    } catch (e) {
      console.error('[REPORT] 寫入進度失敗', e);
      return null;
    }
  }

  /**
   * ② 累加型：完成一個小單元
   *    同一單元重複挑戰只保留最佳成績；stars 為各單元最佳星數的總和。
   * @param {string} moduleId
   * @param {string} unitId   章節或關卡代號，例如 '5-2'、'2-1-1'
   * @param {Object} opts     { star: 0–3, score: 0–100 }
   */
  async function unit(moduleId, unitId, opts) {
    if (!ready()) return null;
    opts = opts || {};

    var star  = Number(opts.star)  || 0;
    var score = Number(opts.score) || 0;
    // opts.extra：這次挑戰的額外資訊（耗時、答對題數、每題秒數…），只寫進 history 供事後檢視，
    // 不影響星數與通關判定。
    var extra = opts.extra || {};

    var cur  = await readDoc();
    var mod  = (cur.modules && cur.modules[moduleId]) || {};
    var best = Object.assign({}, mod.units);      // { '5-1': {star, score}, ... }

    var prev = best[unitId];
    // 只在更好時才覆蓋（避免重考考差把星星洗掉）
    if (!prev || star > (prev.star || 0) || (star === (prev.star || 0) && score > (prev.score || 0))) {
      best[unitId] = { star: star, score: score };
    }

    /* history 的 stars 是「這一次**新增**了幾顆」，不是這次考幾顆：
       每週分數把 history 的 stars 加起來，記這次考幾顆的話，同一章重考一次就會重複加分。
       got 留著這次實際考幾顆，供日後查明細。 */
    var gain = Math.max(0, star - ((prev && prev.star) || 0));

    var total = 0, done = 0, sumScore = 0;
    for (var k in best) {
      total += Number(best[k].star) || 0;
      sumScore += Number(best[k].score) || 0;
      if ((Number(best[k].star) || 0) > 0) done++;
    }
    var cap   = MAX[moduleId] || 3;
    var need  = UNITS_TOTAL[moduleId] || 1;

    // ★ 只有「全部小關都完成」才算整個模組通關；
    //   做了一部分是「進行中」，一關都沒過是「尚未開始」。
    var status = done >= need ? 'pass' : (done > 0 ? 'in-progress' : 'todo');

    return write(moduleId, {
      status: status,
      units:  best,
      level:  done,
      total:  need,
      stars:  Math.min(total, cap),
      score:  done ? Math.round(sumScore / done) : 0
    }, Object.assign({ stars: gain, got: star, score: score, unit: unitId }, extra));
  }

  /**
   * ③ 逐題統計：把這一次挑戰的 { 題id: {n, ok} } 累加進去。
   *
   * 和 unit() 分開：unit() 是「成績」（只留最好的一次、影響星數與通關）；
   * 統計是「次數」—— 永遠累加、不影響任何判定，
   * 而且答錯太多被導去學習警示的人沒有成績，卻最需要被統計到。
   * 這裡不寫 history、不動 stars、不動 status —— 只加 qstat 這一格。
   */
  async function qstat(moduleId, add) {
    if (!ready() || !global.QSTAT) return null;
    if (!add || !Object.keys(add).length) return null;
    var cur = await readDoc();
    var mod = (cur.modules && cur.modules[moduleId]) || {};
    return write(moduleId, { qstat: global.QSTAT.merge(mod.qstat, add) });
  }

  /** 讀出某模組目前的狀態（畫面要顯示已通關單元時用） */
  async function get(moduleId) {
    if (!ready()) return null;
    var cur = await readDoc();
    return (cur.modules && cur.modules[moduleId]) || null;
  }

  /**
   * 讀出闖關紀錄
   * @param {string} moduleId  只取這個模組的紀錄
   * @param {string} [unitId]  再限定某個單元／章節；省略就取整個模組
   * @returns {Promise<Array>} 由新到舊排序
   */
  async function history(moduleId, unitId) {
    if (!ready()) return [];
    var cur = await readDoc();
    return (cur.history || [])
      .filter(function (h) {
        return h.module === moduleId && (unitId === undefined || h.unit === unitId);
      })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }

  /* 🔒 鎖住：載入完就凍結，window 上這個名字也不能再指向別的東西 ——
     擋的是在 Console 把回報函式換掉。只擋「網頁載入之後」才動手的；同一頁載入兩次時保留第一份。 */
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

  global.REPORT = {
    configure: configure,
    unit: unit,
    qstat: qstat,
    get: get,
    history: history,
    MAX: MAX,
    UNITS_TOTAL: UNITS_TOTAL,
    COLLECTION: COL
  };
  __lockGlobal(global, 'REPORT', global.REPORT);
})(window);
