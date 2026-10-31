/* =====================================================================
   題目統計：哪幾題全班一直錯
   ---------------------------------------------------------------------
   回答「這一節我下次該重講什麼？」—— 「這次挑戰答對 85%」說不出學生不懂的是哪一件事。

   題目沒有 id，而是**由題目文字算出 id**：
     · 同一題出現在「節」和「整章挑戰」裡會自動合併
     · 插入題目、調整順序都不影響既有統計，資料檔一個字都不用改
   代價：改寫題目文字＝變成一道新題目（舊統計對不上）。教師端會把「找不到對應題目」的幾筆
   單獨列出來，而不是安靜地丟掉。

   存在學生自己的進度文件 modules.{模組}.qstat = { 題id: { n, ok } }，教師端讀的時候再加總。
   不另開「全班共用」的集合 —— 學生寫得進去的共用文件，任何一個人都可以把全班的資料洗掉。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-qstat';

  /* 一份 qstat 最多記幾題。300 題全記也才 300 個 key，
     這個上限是防「題庫被改寫很多次、舊 id 一直累積」。 */
  var CAP = 600;

  /** 把題目文字正規化：去掉標籤、空白、標點 —— 只留下真正的字。
      ★ 排版改動（多一個空格、換一個全形逗號）不該讓統計歸零。 */
  function norm(q) {
    return String(q == null ? '' : q)
      .replace(/<[^>]*>/g, '')
      .replace(/[\s，。、？！：；「」（）()·,.?!:;"']/g, '');
  }

  /**
   * 題目文字 → 短 id（FNV-1a 32 位元，轉成 36 進位）。
   * 這是雜湊，理論上可能撞號（目前題庫沒有撞號）。
   */
  function id(q) {
    var s = norm(q);
    if (!s) return '';
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      /* >>> 0 一定要留：JS 的位元運算是有號 32 位元，
         少了它 h 會變成負數，同一段文字在不同引擎上可能算出不同結果。 */
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return 'q' + h.toString(36);
  }

  /** 累加一次作答。map 會被就地修改並回傳。 */
  function bump(map, q, ok) {
    map = map || {};
    var k = id(q);
    if (!k) return map;
    var e = map[k] || { n: 0, ok: 0 };
    e.n++;
    if (ok) e.ok++;
    map[k] = e;
    return map;
  }

  /** 兩份相加（學生舊的 ＋ 這次新的，或全班每個人的）。不改動輸入。 */
  function merge(a, b) {
    var out = {}, k;
    for (k in (a || {})) if (has(a, k)) out[k] = { n: num(a[k].n), ok: num(a[k].ok) };
    for (k in (b || {})) {
      if (!has(b, k)) continue;
      var e = out[k] || { n: 0, ok: 0 };
      out[k] = { n: e.n + num(b[k].n), ok: e.ok + num(b[k].ok) };
    }
    return trim(out);
  }

  /** 超過上限就丟掉「被抽到最少次」的那些 —— 它們的統計本來就最不可信。 */
  function trim(map) {
    var keys = Object.keys(map);
    if (keys.length <= CAP) return map;
    keys.sort(function (x, y) { return map[y].n - map[x].n; });
    var out = {};
    keys.slice(0, CAP).forEach(function (k) { out[k] = map[k]; });
    return out;
  }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function num(x) { return Number(x) || 0; }

  /**
   * 從 QUIZ_CONTENT 建出「id → 這是哪一題」的對照表。
   * ★ 同一題出現在多個地方（節、整章挑戰）只留一筆，
   *   但 where 會把所有出處都記下來 —— 你要回去改題目時得找得到它。
   */
  function bank(content) {
    var out = {};
    (((content || {}).chapters) || []).forEach(function (ch) {
      var add = function (list, where) {
        (list || []).forEach(function (it) {
          var k = id(it.q);
          if (!k) return;
          /* 題庫裡只有答案雜湊（a），教師端拿四個選項各算一次反查「哪一個才是對的」。
             （有明碼 correct 的舊題庫照舊用它。） */
          var ci = (it.correct != null) ? it.correct
                 : (global.ANSKEY ? global.ANSKEY.find(it.q, it.options, it.a) : -1);
          if (!out[k]) out[k] = { id: k, q: it.q, options: it.options, correct: ci, where: [] };
          if (out[k].where.indexOf(where) < 0) out[k].where.push(where);
        });
      };
      (ch.sections || []).forEach(function (s) { add(s.questions, s.title || s.id); });
      if (ch.challenge) add(ch.challenge.questions, (ch.title || ch.id) + '（整章挑戰）');
    });
    return out;
  }

  /**
   * 排行：全班加總之後，最常錯的排前面。
   *
   * ⚠️ 分母的意思要講清楚：n 是「這一題被抽到幾次」，
   *    不是「幾個學生做過」。題目是從該節題庫隨機抽的，答錯還會重新洗牌
   *    （避免背題序），所以同一個學生可能遇到同一題好幾次。
   *    ⇒ 這份排行拿來看「哪幾題全班一直卡住」很準；
   *      拿來當考卷的鑑別度指標則不對。
   *
   * @param {Object} total  全班加總後的 { id: {n, ok} }
   * @param {Object} bk     bank() 的產物
   * @param {number} minN   少於幾次就不排（樣本太少的名次沒有意義）
   */
  function rank(total, bk, minN) {
    minN = minN == null ? 5 : minN;
    var out = [];
    for (var k in (total || {})) {
      if (!has(total, k)) continue;
      var e = total[k];
      var n = num(e.n);
      if (n < minN) continue;
      var q = bk && bk[k];
      out.push({
        id: k,
        n: n,
        ok: num(e.ok),
        rate: n ? Math.round(num(e.ok) / n * 100) : 0,
        q: q ? q.q : null,             // null = 題庫裡找不到（題目被改寫過）
        options: q ? q.options : null,
        correct: q ? q.correct : null,
        where: q ? q.where : []
      });
    }
    /* 答對率低的排前面；一樣低的話，被抽到比較多次的排前面
       —— 那一題影響到的人比較多。 */
    out.sort(function (a, b) { return a.rate - b.rate || b.n - a.n; });
    return out;
  }

  /**
   * 依班級分開加總。
   * ★ 為什麼一定要分班看
     801 和 802 上的是同一節課、同一份題庫，但常錯的題目往往不一樣 ——
     全校加總會把兩班的差異抹平，而那個差異正是「這一班要補什麼」。
   * @param {Array} students  [{ id, name, cls, qstat }]
   * @return {Object} { 班級: { 題id: {n, ok} } }，另含 '' 這個 key = 全部
   */
  function byClass(students) {
    var out = { '': {} };
    (students || []).forEach(function (s) {
      var c = String(s.cls || '未分班');
      out[c] = merge(out[c], s.qstat);
      out[''] = merge(out[''], s.qstat);
    });
    return out;
  }

  /** 這個學生在這一題上的表現（教師端點進某一題時用） */
  function forQuestion(perStudent, qid, cls) {
    var out = [];
    (perStudent || []).forEach(function (s) {
      if (cls && String(s.cls || '未分班') !== cls) return;
      var e = (s.qstat || {})[qid];
      if (!e || !num(e.n)) return;
      out.push({
        id: s.id, name: s.name, cls: s.cls,
        n: num(e.n), ok: num(e.ok),
        rate: Math.round(num(e.ok) / num(e.n) * 100)
      });
    });
    out.sort(function (a, b) { return a.rate - b.rate || b.n - a.n; });
    return out;
  }

  /* 🔒 鎖住：載入完就凍結，window 上這個名字也不能再指向別的東西 ——
     擋的是在 Console 把函式換掉。只擋「網頁載入之後」才動手的；同一頁載入兩次時保留第一份。 */
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

  global.QSTAT = {
    VERSION: VERSION,
    CAP: CAP,
    id: id,
    _norm: norm,
    bump: bump,
    merge: merge,
    bank: bank,
    rank: rank,
    byClass: byClass,
    forQuestion: forQuestion
  };
  __lockGlobal(global, 'QSTAT', global.QSTAT);

})(typeof window !== 'undefined' ? window : this);
