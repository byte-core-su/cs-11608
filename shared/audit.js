/* =====================================================================
   可疑紀錄偵測（教師端「🔍 可疑紀錄」用）—— 純邏輯，不碰畫面、不碰資料庫
   ---------------------------------------------------------------------
   瀏覽器裡擋不住使用者腳本：送到學生瀏覽器的東西都讀得到，瀏覽器送出去的東西也都能偽造。
   擋不住的東西至少要**看得到**。這一支只做「比對」，不擋任何人、不改任何資料。

   章節測驗的作答過程：
     quiz-engine.js 通關時一定會把耗時（duration）和每題秒數（pace）一起寫進 history。
     直接呼叫 REPORT.unit(…) 寫進去的那一筆不會有 ⇒ 沒有作答過程的通關紀錄，就不是從測驗畫面來的。
     另外：連最慢的一題都在 1 秒內 ＝ 像腳本。

   ⚠️ 這些都是「提醒你去看」，**不是判定**，畫面上一律寫成「值得看一下」，不要寫成「作弊」。

   用法（瀏覽器與 node 都能跑）：
     AUDIT.quiz(progressById)   → [{ sid, unit, at, kind:'robot'|'no-trace', … }]
     AUDIT.isRobotPace(pace)    → true／false
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-10-23';

  /** 連最慢的一題都在 1 秒內（而且題數夠多）。
      不看平均、看最慢那一題：真的很熟的學生也可能很快，但人一定有長尾，腳本每題都一樣快。 */
  function isRobotPace(p) {
    return !!(p && p.max != null && Number(p.max) <= 1 && (Number(p.n) || 0) >= 5);
  }

  /** 這一筆 history 是不是章節測驗的通關紀錄 */
  function isQuizEntry(h) {
    return !!(h && h.module === 'ethics');
  }

  /**
   * 章節測驗：沒有作答過程的通關紀錄、像腳本的作答速度。
   * @param {Object} progressById  學號 → {TERM}-progress 文件
   */
  function quiz(progressById) {
    var out = [];
    Object.keys(progressById || {}).forEach(function (sid) {
      var hist = (progressById[sid] || {}).history || [];
      hist.forEach(function (h) {
        if (!isQuizEntry(h)) return;
        var unit = h.unit || '';
        var at = Number(h.at) || 0;
        if (isRobotPace(h.pace)) {
          out.push({ sid: sid, unit: unit, at: at, kind: 'robot', pace: h.pace, score: h.score });
          return;
        }
        if (h.duration == null && h.pace == null) {
          out.push({ sid: sid, unit: unit, at: at, kind: 'no-trace', score: h.score, got: h.got });
        }
      });
    });
    return out;
  }

  global.AUDIT = {
    VERSION: VERSION,
    quiz: quiz,
    isRobotPace: isRobotPace
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.AUDIT;
})(typeof window !== 'undefined' ? window : this);
