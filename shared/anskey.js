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

  /**
   * 一題有沒有「還沒換掉的明碼答案」。
   */
  function isPlain(item) {
    return !!item && item.correct !== undefined && item.correct !== null;
  }

  /* ── 答錯說明的加密（段落閱讀模式，老師 2026-11-06）──────────────
     ★ 新的作答形式答錯時要「公布正解＋理由」，理由裡一定寫著正解。
       說明要是用明碼放在資料檔，前面把答案換成雜湊就白做了（F12 一開就讀得到）。
     ⇒ 用「這一題的正解」當鑰匙把說明鎖起來：
         seal(題目, 正解文字, 說明) → 一串亂碼
         open(題目, 正解文字, 亂碼) → 說明
       引擎是在學生答錯之後，才用 find() 反查正解、再打開說明。
     ⚠️ 防護等級和答案雜湊**一樣**（不會更好、也不會更差）：
        會寫程式的人本來就能用 find() 四次反查答案，也就能打開說明；
        擋的是「隨手 F12 讀一眼」和網頁 AI 直接讀到。 */
  function keystream(key, n) {
    var out = [], h = (parseInt(fnv(key + '::ex'), 36) >>> 0) || 0x9e3779b9;   // 0 會讓 xorshift 卡死
    for (var i = 0; i < n; i++) {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;   // xorshift32
      out.push(h & 255);
    }
    return out;
  }
  function b64e(bin) { return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'); }
  function b64d(s)   { return typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); }
  function seal(q, correctText, plain) {
    var bin = unescape(encodeURIComponent(String(plain == null ? '' : plain)));   // UTF-8 位元組
    var ks = keystream(of(q, correctText), bin.length), out = '';
    for (var i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ ks[i]);
    return b64e(out);
  }
  /** 打不開（正解不對、資料壞掉）回空字串 —— 不可以丟例外卡住答題 */
  function open(q, correctText, sealed) {
    try {
      var bin = b64d(String(sealed || '')), ks = keystream(of(q, correctText), bin.length), out = '';
      for (var i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ ks[i]);
      return decodeURIComponent(escape(out));
    } catch (e) { return ''; }
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
    of: of, check: check, find: find, isPlain: isPlain,
    seal: seal, open: open,
    _norm: norm, _fnv: fnv
  };
  __lockGlobal(global, 'ANSKEY', global.ANSKEY);

  /* node 也要用得到 */
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ANSKEY;

})(typeof window !== 'undefined' ? window : globalThis);
