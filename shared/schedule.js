/* =====================================================================
   課表與停課：算「某一週，這個班有哪幾天上課」
   ---------------------------------------------------------------------
   資料存在 {TERM}-config/schedule：

     base : { "星期-節次": "班級" }        例 { "3-2": "801" } = 週三第 2 節上 801
     off  : { "YYYY-MM-DD": ["3-2", …] }   該日期哪幾節停課
     move : { "YYYY-MM-DD": { "3-2": "5-4" } } 該週把某節課調到別的時段
     open_json : 模組的開放日（見下面 moduleOpen）

   用途：每週分數「有登入但沒拿星 → 基本分，缺席 → 0 分」，出席照**該班上課日**判定。
   教師端（每週評分）和學生端（本週成績卡）都呼叫這一支，規則只有一份。

   學生端讀得到這份課表：firestore.rules 開了**單筆、唯讀、只限 schedule 這一份**的例外。
   ===================================================================== */
(function (global) {
  'use strict';

  var PERIODS = 7;                    // 一天七節
  var WEEK_MS = 7 * 86400000;

  /** 這個日期所在那一週的星期一（00:00） */
  function mondayOf(d) {
    var x = new Date(d);
    var wd = (x.getDay() + 6) % 7;    // 星期一 = 0
    x.setHours(0, 0, 0, 0);
    return new Date(x.getTime() - wd * 86400000);
  }

  /** Date → 'YYYY-MM-DD'（用本地時間，和老師看到的日期一致） */
  function key(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /** 這一週的星期 wd（1～5）是幾號 */
  function dateOf(monday, wd) {
    return new Date(monday.getTime() + (wd - 1) * 86400000);
  }

  /**
   * 某一週的某一格是哪個班的課、有沒有停課。
   * ⚠️ 調課（move）是「這一週的事」：move 的鍵是日期，
   *    所以判斷「從別處調來」時，要確認來源那一格的日期也落在同一週，
   *    否則上上週的一次調課會影響到這一週。
   */
  function cellInfo(sched, monday, wd, period) {
    sched = sched || {};
    var base = sched.base || {}, off = sched.off || {}, move = sched.move || {};
    var slot = wd + '-' + period;
    var dateKey = key(dateOf(monday, wd));

    var movedAway = Object.keys(move[dateKey] || {}).some(function (from) {
      return from === slot;
    });

    var movedIn = null;
    Object.keys(move).forEach(function (dk) {
      var mp = move[dk] || {};
      Object.keys(mp).forEach(function (from) {
        if (mp[from] !== slot) return;
        var wdFrom = Number(String(from).split('-')[0]);
        if (key(dateOf(monday, wdFrom)) === dk) movedIn = base[from] || null;
      });
    });

    var cls = movedIn || (movedAway ? null : (base[slot] || null));
    return { cls: cls, off: (off[dateKey] || []).indexOf(slot) >= 0,
             slot: slot, dateKey: dateKey,
             movedIn: !!movedIn, movedAway: movedAway };
  }

  /**
   * 這一週這個班有哪幾天要上課（'YYYY-MM-DD' 陣列，可能不只一天）。
   * 全部停課或那一週沒課 → 空陣列。
   * @param weekStart 那一週裡的任何一天都可以（會自己找星期一）
   */
  function classDatesOfWeek(sched, cls, weekStart) {
    var monday = mondayOf(weekStart);
    var out = [];
    for (var wd = 1; wd <= 5; wd++) {
      for (var p = 1; p <= PERIODS; p++) {
        var info = cellInfo(sched, monday, wd, p);
        if (info.cls === cls && !info.off) {
          var k = key(dateOf(monday, wd));
          if (out.indexOf(k) < 0) out.push(k);
        }
      }
    }
    return out;
  }

  /**
   * 這一週算不算「有出席」：該班上課日裡，有任何一天在 attendance 裡。
   * @param attendance { 'YYYY-MM-DD': 時間戳 }（hub 每日首次登入寫的）
   * 這是「那天有沒有登入系統」，不是點名：人來了但沒登入算缺席；不是上課日登入也不算。
   */
  function attended(sched, cls, weekStart, attendance) {
    var days = classDatesOfWeek(sched, cls, weekStart);
    var att = attendance || {};
    return days.some(function (d) { return !!att[d]; });
  }

  /**
   * 這一週的分數
   *   有拿星       → base + 星數 × per（上限 100）
   *   0 星但有出席 → base（人來了、也登入了，只是這節沒拿到星）
   *   0 星又缺席   → 0
   * 學生端與教師端一律呼叫這一支，同一個學生在兩個畫面才會看到同一個分數。
   */
  function weekScore(stars, wasHere, base, per) {
    var s = Number(stars) || 0;
    var b = Number(base), p = Number(per);
    if (!isFinite(b)) b = 60;
    if (!isFinite(p)) p = 4;
    if (s > 0) return Math.min(100, b + s * p);
    return wasHere ? b : 0;
  }

  /**
   * 某班從 from 到 to（含兩端）每一節課的明細 —— 給教師端「班級上課日」查詢用。
   * 回傳 [{ date:'YYYY-MM-DD', wd:1～5, period, slot, off, movedIn }]，照日期、節次排好。
   *   off     ：這一節停課（照樣列出來，畫面上標灰）
   *   movedIn ：這一節是從同一週別的時段調過來的
   * 判斷每一格「是誰的課」一律走 cellInfo（和每週評分、出席同一份規則）；被調走的那一格不會重複列。
   */
  function classLessons(sched, cls, from, to) {
    cls = String(cls || '');
    var out = [];
    if (!cls) return out;
    var end = new Date(to); end.setHours(0, 0, 0, 0);
    var start = new Date(from); start.setHours(0, 0, 0, 0);
    if (isNaN(start) || isNaN(end) || start > end) return out;
    for (var mon = mondayOf(start); mon <= end; mon = new Date(mon.getTime() + WEEK_MS)) {
      for (var wd = 1; wd <= 5; wd++) {
        var day = dateOf(mon, wd);
        if (day < start || day > end) continue;
        for (var p = 1; p <= PERIODS; p++) {
          var info = cellInfo(sched, mon, wd, p);
          if (info.cls !== cls) continue;
          out.push({ date: info.dateKey, wd: wd, period: p, slot: info.slot,
                     off: info.off, movedIn: info.movedIn });
        }
      }
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     模組的開放日
     ══════════════════════════════════════════════════════════
     還沒到開放日的模組，在闖關基地畫成灰色、點不進去，並寫明預計哪一天開放。
     存在 {TERM}-config/schedule 的 open_json 欄位（JSON 字串，例如 { "arduino": "2026-11-30" }）：
       學生端讀得到的 config 只有 schedule 這一份，所以放在這裡（hub 本來就會讀，不多花一次讀取）；
       用 JSON 字串而不是巢狀 map，寫入時一次覆蓋整份。
     讀不到課表時一律當成**已開放**（寧可看到還沒完成的頁面，也不要整班進不去）。
     ⚠️ 這是把入口藏起來，不是把頁面鎖起來（知道網址的人照樣打得開）。 */
  function openMap(sched) {
    var raw = (sched || {}).open_json;
    if (!raw) return {};
    try { var o = JSON.parse(raw); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }

  /** 這個模組的開放日（'YYYY-MM-DD'）；沒設定回空字串 */
  function openDateOf(sched, moduleId) {
    var d = openMap(sched)[String(moduleId || '')];
    return (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : '';
  }

  /** 現在可以進去了嗎？沒設定、設錯、讀不到 → 一律可以。 */
  function moduleOpen(sched, moduleId, now) {
    var d = openDateOf(sched, moduleId);
    if (!d) return true;
    var t = new Date(d + 'T00:00:00');
    if (isNaN(t)) return true;                 // 日期壞掉也不要擋人
    var n = now ? new Date(now) : new Date();
    n.setHours(0, 0, 0, 0);
    return n.getTime() >= t.getTime();         // 當天就算開放
  }

  /** 給學生看的那一句：'預計於 2026/11/30 開放' */
  function openLabel(sched, moduleId) {
    var d = openDateOf(sched, moduleId);
    return d ? ('預計於 ' + d.replace(/-/g, '/') + ' 開放') : '';
  }

  global.SCHEDULE = {
    PERIODS: PERIODS, WEEK_MS: WEEK_MS,
    mondayOf: mondayOf, key: key, dateOf: dateOf,
    cellInfo: cellInfo, classDatesOfWeek: classDatesOfWeek, classLessons: classLessons,
    attended: attended, weekScore: weekScore,
    openMap: openMap, openDateOf: openDateOf,
    moduleOpen: moduleOpen, openLabel: openLabel
  };

})(window);
