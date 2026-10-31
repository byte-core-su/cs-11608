/* =====================================================================
   選擇題的答案：不要用明碼放在網頁裡
   ---------------------------------------------------------------------
   題庫若寫成 { q, options, correct: 2 }，學生按 F12 或在 Console 打 QUIZ_CONTENT 就看得到答案。
   所以把 correct（第幾個選項）換成 a（一段雜湊）：
       a = FNV-1a( 題目文字 ＋ 正確選項的文字 ＋ SALT )
   答題時對**學生選的那個選項**算一次雜湊，對得起來就是答對。

   ⚠️ 這是「不可讀」，**不是「不可破」**：雜湊函式和 SALT 都在前端，
      對四個選項各算一次就能反推出答案（教師端的題目分析頁正是這樣反查的）。
      它擋的是「隨手按 F12 看一眼」，擋不住會寫程式的人。

   答案雜湊和 QSTAT.id（題目 → 統計用的 id）用不同的字串算，兩件事不共用一把鑰匙。

   用法：
     ANSKEY.of(q, optionText)          → 雜湊字串
     ANSKEY.check(q, optionText, a)    → true / false
     ANSKEY.find(q, options, a)        → 正確選項的索引（教師端反查用，找不到回 -1）
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-anskey';

  /* ⚠️ SALT 在前端，學生看得到 —— 它的作用不是保密，
     而是讓答案雜湊和 QSTAT 的題目 id **算出來不一樣**，
     免得有人拿題目 id 當答案用（那會變成另一種洩漏）。 */
  var SALT = 'ans::115';

  /** 正規化：去標籤、去空白與標點 —— 排版改一個空格不該讓答案對不上 */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, '')
      .replace(/[\s，。、？！：；「」（）()·,.?!:;"']/g, '');
  }

  /** FNV-1a 32 位元 → 36 進位（和 qstat.js 同一種，但吃的字串不同） */
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  function of(q, optionText) {
    return fnv(norm(q) + '||' + norm(optionText) + '||' + SALT);
  }

  function check(q, optionText, a) {
    if (!a) return false;
    return of(q, optionText) === String(a);
  }

  /**
   * 反查正確選項的索引。
   * ⚠️ 教師端的統計頁要顯示「哪一個才是對的」，只能這樣做。
   *    這也正好說明了上面那句「不可破」的但書 ——
   *    四次雜湊就能反推，所以它擋的是隨手看，不是有心人。
   */
  function find(q, options, a) {
    for (var i = 0; i < (options || []).length; i++) {
      if (check(q, options[i], a)) return i;
    }
    return -1;
  }

  /* 🔒 鎖住：載入完就凍結，window 上這個名字也不能再指向別的東西 ——
     擋的是在 Console 把判對錯的函式換成「永遠回答對」。
     ⚠️ 只擋「網頁載入之後」才動手的；搶在載入之前的（例如使用者腳本）擋不住，前端只能做到這裡。
     同一頁載入兩次時保留第一份，不報錯。 */
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

  global.ANSKEY = {
    VERSION: VERSION,
    of: of, check: check, find: find,
    _norm: norm, _fnv: fnv
  };
  __lockGlobal(global, 'ANSKEY', global.ANSKEY);

  /* node 也要用得到 */
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ANSKEY;

})(typeof window !== 'undefined' ? window : globalThis);
