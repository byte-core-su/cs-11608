/* =====================================================================
   闖關排行賽的題庫：從章節測驗（content/ethics.js）抽出來
   ---------------------------------------------------------------------
   ★ 排行賽的對錯由 Apps Script 判，所以它要有自己的一份題庫 ——
     不能讓學生的瀏覽器告訴它「這一題是什麼、答案是什麼」。
     老師在教師後台「🏆 排行賽」按「匯入題庫」：老師的瀏覽器用這一支
     把 ethics.js 裡的題目抽出來，送給 Apps Script 存進 {TERM}-grader/arena_bank。
     ⇒ 改了 ethics.js 的題目，回後台再按一次「匯入題庫」就好，不必跑任何指令。
   ★ 抽法（gas/arena.test.js 會檢查）：
     · 同一題會出現在小節與整章挑戰 ⇒ 用 QSTAT.id 合併成一題（和題目分析頁同一把鑰匙）
     · units ＝ 參賽資格要通關的章節：每一章的小節，接著那一章的整章挑戰
   ⚠️ 內容和 ethics.js 一樣（題目、選項、答案雜湊），沒有多洩漏任何東西。
   用法：ARENABANK.build(window.QUIZ_CONTENT, window.QSTAT, term) → { module, term, count, units, items }
   ===================================================================== */
(function (global) {
  'use strict';
  function build(C, QSTAT, term) {
    var byId = {}, order = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o.q === 'string' && Array.isArray(o.options)) {
        var id = QSTAT.id(o.q);
        if (id && !byId[id] && o.a) { byId[id] = { id: id, q: o.q, options: o.options.slice(), a: o.a }; order.push(id); }
        return;
      }
      Object.keys(o).forEach(function (k) { walk(o[k]); });
    })((C || {}).chapters);
    var items = order.sort().map(function (k) { return byId[k]; });
    var units = [];
    ((C || {}).chapters || []).forEach(function (ch) {
      (ch.sections || []).forEach(function (s) { units.push(s.id); });
      if (ch.challenge) units.push(ch.challenge.id);
    });
    return { module: (C || {}).moduleId || 'ethics', term: String(term || ''), count: items.length, units: units, items: items };
  }
  global.ARENABANK = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ARENABANK;
})(typeof window !== 'undefined' ? window : this);
