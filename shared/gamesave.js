/* =====================================================================
   遊戲存檔（晨星勇者，程式設計十關都完成後開放）
   ---------------------------------------------------------------------
   · 存在學生自己的 {TERM}-progress/{學號} 的 games.morningstar 欄位
     （不在 modules 裡 —— 星數只加 modules，所以遊戲不會變成星星、不影響成績）
   · 只用雲端，不留本機備援；存不進去時畫面會講出來
   · 不算星、教師端不顯示
   開放條件：10 個單元都「通關」（GRADING.GATE.cleared）。

   存檔內容（games.morningstar）：
     { v:1,
       trained: true/false,         新手訓練完成過（第一次不能跳過序章）
       save: {v:2, area, …} | null, 遊戲本身的 snapshot()（每章開頭一份）
       cards: { add:1, ins:1, … },  收集過的觀念卡（跨每一輪累積，只增不減）
       clears: [ {at, time, lv, kills, deaths, gold, maxHp, cards} … ]  最近 20 次通關
       clearCount: n,               總通關次數
       updatedAt }
   ⚠️ 寫入一律用 mergeFields:['games.morningstar'] 整欄覆寫 ——
      一般的 merge 會把舊存檔的 talked／quests 和新的一輪「合併」，重新開始的人會被當成已經跟 NPC 說過話。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-10-09-gamesave';
  var KEY = 'morningstar';
  var CLEARS_CAP = 20;
  var CARD_KEYS = ['add', 'ins', 'replace', 'del', 'has', 'index', 'sum', 'judge',
                   'avg', 'random', 'scope', 'collide', 'clone', 'sync'];

  function blank() {
    return { v: 1, trained: false, save: null, cards: {}, clears: [], clearCount: 0 };
  }

  function num(x, d) { x = Number(x); return isFinite(x) ? x : (d || 0); }

  /** 從雲端讀回來的東西一律先整理過（欄位缺了、型別錯了都補成預設值）。 */
  function normalize(raw) {
    var r = blank();
    if (!raw || typeof raw !== 'object') return r;
    r.trained = raw.trained === true;
    r.save = (raw.save && typeof raw.save === 'object' && raw.save.v === 2) ? raw.save : null;
    if (raw.cards && typeof raw.cards === 'object') {
      CARD_KEYS.forEach(function (k) { if (raw.cards[k]) r.cards[k] = 1; });
    }
    if (Array.isArray(raw.clears)) {
      r.clears = raw.clears.filter(function (c) { return c && typeof c === 'object'; }).slice(-CLEARS_CAP);
    }
    r.clearCount = Math.max(num(raw.clearCount), r.clears.length);
    return r;
  }

  /** 把這一輪拿到的卡併進收藏（只增不減）。回傳有沒有新卡。 */
  function addCards(rec, cards) {
    var added = false;
    CARD_KEYS.forEach(function (k) {
      if (cards && cards[k] && !rec.cards[k]) { rec.cards[k] = 1; added = true; }
    });
    return added;
  }

  /** 記一次通關（win() 裡呼叫）。 */
  function addClear(rec, P, now) {
    var c = {
      at: now || Date.now(),
      time: Math.round(num(P && P.time)),
      lv: num(P && P.lv, 1), kills: num(P && P.kills), deaths: num(P && P.deaths),
      gold: num(P && P.gold), maxHp: num(P && P.maxHp),
      cards: CARD_KEYS.filter(function (k) { return P && P.cards && P.cards[k]; }).length
    };
    rec.clears = rec.clears.concat([c]).slice(-CLEARS_CAP);
    rec.clearCount = num(rec.clearCount) + 1;
    return c;
  }

  /**
   * 十關都通關了嗎（開放條件）。
   * @param units      FLOW_UNITS（要有 id）
   * @param flowDone   { 單元id: true }  流程圖排對的
   * @param unitStars  { 單元id: 星數 }  作品星
   * @param GATE       GRADING.GATE
   * 回傳 { ok, done, total }
   */
  function unlocked(units, flowDone, unitStars, GATE) {
    units = units || [];
    var done = 0;
    for (var i = 0; i < units.length; i++) {
      if (GATE && GATE.cleared(units[i].id, flowDone || {}, unitStars || {})) done++;
    }
    var total = units.length;
    return { ok: total > 0 && done === total, done: done, total: total };
  }

  /**
   * 存檔管理：讀一次、之後每次改動延遲一下再整份寫回去。
   *   opts.load()        → Promise<原始資料 | undefined>（讀不到就丟例外）
   *   opts.write(rec)    → Promise（寫不進去就丟例外）
   *   opts.onState(s, why)  s = 'loading' | 'ok' | 'saving' | 'error'
   *   opts.delay         延遲毫秒（預設 800；同一段時間內的多次改動只寫一次）
   *   opts.timer         換掉 setTimeout／clearTimeout 用（測試）
   */
  function createStore(opts) {
    opts = opts || {};
    var rec = blank();
    var loaded = false, timer = null, pending = false, writing = null;
    var T = opts.timer || { set: function (f, ms) { return setTimeout(f, ms); }, clear: function (h) { clearTimeout(h); } };
    var delay = opts.delay == null ? 800 : opts.delay;
    function state(s, why) { try { if (opts.onState) opts.onState(s, why || ''); } catch (e) {} }

    function load() {
      state('loading');
      return Promise.resolve().then(function () { return opts.load(); }).then(function (raw) {
        rec = normalize(raw); loaded = true; state('ok'); return rec;
      }, function (e) {
        loaded = false; state('error', '讀不到雲端存檔：' + ((e && (e.code || e.message)) || e));
        throw e;
      });
    }

    function flush() {
      if (timer) { T.clear(timer); timer = null; }
      if (!loaded || !pending) return writing || Promise.resolve();
      pending = false;
      var snap = JSON.parse(JSON.stringify(rec));
      snap.updatedAt = Date.now();
      state('saving');
      writing = Promise.resolve().then(function () { return opts.write(snap); }).then(function () {
        writing = null; if (!pending) state('ok');
      }, function (e) {
        writing = null; pending = true;      // 下一次改動時再試一次
        state('error', '存檔沒有存進雲端：' + ((e && (e.code || e.message)) || e));
      });
      return writing;
    }

    /** 改存檔：fn(rec) 直接改內容；改完延遲寫回。讀檔失敗時不寫（避免用空白存檔蓋掉雲端那份）。 */
    function update(fn) {
      if (!loaded) return false;
      fn(rec);
      pending = true;
      if (timer) T.clear(timer);
      timer = T.set(flush, delay);
      return true;
    }

    return {
      load: load, flush: flush, update: update,
      get: function () { return rec; }
    };
  }

  global.GAMESAVE = {
    VERSION: VERSION, KEY: KEY, CLEARS_CAP: CLEARS_CAP, CARD_KEYS: CARD_KEYS,
    blank: blank, normalize: normalize, addCards: addCards, addClear: addClear,
    unlocked: unlocked, createStore: createStore
  };
})(typeof window !== 'undefined' ? window : this);
