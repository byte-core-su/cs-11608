/* =====================================================================
   闖關排行賽：教師端的排名整理（純邏輯，不碰畫面、不碰資料庫）
   ---------------------------------------------------------------------
   學生看得到的排行只有前 30 名的學號（走 Apps Script）；
   老師要看的是**全部**參賽者：班級、座號、姓名、玩了幾場、離開畫面、超時、像腳本的場次。
   資料直接從 Firestore 讀（規則開給老師讀 {TERM}-arena-board／-arena-runs）。
   ⚠️ 排序規則必須和 gas/grader.gs 的 arenaRanking 一樣：分數高 → 用時短 → 先達成。
   用法（瀏覽器與 node 都能跑）：
     ARENARANK.build(boardById, runs, rosterById, today) → [列…]
     ARENARANK.classes(rows) → ['801', '802', …]
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-10-06-arenarank';

  /** 和 Apps Script 的 arenaRanking 同一個比較：分數高 → 用時短 → 先達成 */
  function cmp(a, b) {
    return (b.score - a.score) || (a.seconds - b.seconds)
        || String(a.at || '').localeCompare(String(b.at || ''));
  }

  /**
   * @param boardById  { 學號: {best:{score,seconds,at,correct,max_tier}, days:{日期:次數}} }
   * @param runs       [ {sid, score, correct, total, max_tier, seconds, swaps, robot, at, day, steps} ]
   * @param rosterById { 學號: {cls, no, name} }
   * @param today      'YYYY-MM-DD'（台灣時間，和 Apps Script 記的日期同一種寫法）
   */
  function build(boardById, runs, rosterById, today) {
    var by = {};
    function row(sid) {
      sid = String(sid || '');
      if (!by[sid]) {
        var r = (rosterById || {})[sid] || {};
        by[sid] = { sid: sid, cls: String(r.cls || ''), no: String(r.no || ''), name: String(r.name || ''),
                    best: null, rank: null, clsRank: null, todayUsed: 0,
                    runs: 0, todayRuns: 0, robot: 0, leaves: 0, timeouts: 0, lastAt: '' };
      }
      return by[sid];
    }
    Object.keys(boardById || {}).forEach(function (sid) {
      var d = boardById[sid] || {}, e = row(sid);
      var b = d.best;
      if (b && b.score != null) {
        e.best = { score: Number(b.score) || 0, seconds: Number(b.seconds) || 0, at: String(b.at || ''),
                   correct: b.correct, max_tier: b.max_tier };
      }
      e.todayUsed = Number(((d.days || {})[today]) || 0);
    });
    (runs || []).forEach(function (r) {
      if (!r || !r.sid) return;
      var e = row(r.sid);
      e.runs++;
      if (r.day === today) e.todayRuns++;
      if (r.robot) e.robot++;
      e.leaves += Number(r.swaps) || 0;
      (r.steps || []).forEach(function (s) {
        if (s && (s.why === 'timeout' || s.why === 'late')) e.timeouts++;
      });
      if (String(r.at || '') > e.lastAt) e.lastAt = String(r.at || '');
    });
    var rows = Object.keys(by).map(function (k) { return by[k]; });
    var ranked = rows.filter(function (e) { return e.best; })
      .sort(function (a, b) { return cmp(a.best, b.best); });
    ranked.forEach(function (e, i) { e.rank = i + 1; });
    /* 班內名次：同樣的排序，只在同一班裡數 */
    var perCls = {};
    ranked.forEach(function (e) {
      perCls[e.cls] = (perCls[e.cls] || 0) + 1;
      e.clsRank = perCls[e.cls];
    });
    var rest = rows.filter(function (e) { return !e.best; })
      .sort(function (a, b) { return a.sid.localeCompare(b.sid); });
    return ranked.concat(rest);
  }

  function classes(rows) {
    var s = {};
    (rows || []).forEach(function (r) { if (r.cls) s[r.cls] = 1; });
    return Object.keys(s).sort();
  }

  /** 台灣的今天（Apps Script 用的是台灣時間） */
  function todayTW(nowMs) {
    return new Date((nowMs == null ? Date.now() : nowMs) + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  global.ARENARANK = { VERSION: VERSION, build: build, classes: classes, todayTW: todayTW, cmp: cmp };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ARENARANK;
})(typeof window !== 'undefined' ? window : this);
