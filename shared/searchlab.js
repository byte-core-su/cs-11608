/* =====================================================================
   搜尋實驗室（第 8～10 關共用一份）
   ---------------------------------------------------------------------
   ★ 為什麼是「操作」不是「拼圖」
     第 4 章那四關學的是「怎麼寫」，主角是程式拼圖。
     第 6 章這幾關學的是「這個演算法在做什麼」——
     把循序搜尋做成一支要拼的 Scratch 程式，學生會忙著找積木，
     而「從第一個開始，一個一個往下比」那件事反而看不見。
     ⇒ 所以這裡讓他**自己動手找一次**，再回頭看程式。

   ★ 課本的例子就是這裡的預設題（翰林 114 資科 2 下 6-3-1，p.204）
       原始資料　8、5、10、1、7　　目標資料　10
       第 1 回合　取出第 1 個元素 8，不是目標資料 10
       第 2 回合　取出第 2 個元素 5，不是目標資料 10
       第 3 回合　取出第 3 個元素 10，找到目標資料
     學生在網站上操作的、課本上讀到的，必須是同一組數字 ——
     不一樣的話，他會以為是兩件事。

   ⚠️ 這個實驗室真正在擋的只有一件事：**不准跳著點**。
      能亂點的話，學生會直接點中目標然後說「我找到了」——
      那是「用眼睛找」，不是循序搜尋。
      「循序」兩個字的全部意思就是「不能跳」，所以那是唯一要擋的。

   ⚠️ 找不到也要走得完。
      課本明講「直到找到所要的元素**或所有資料均尋找完**為止」。
      只出找得到的題目，學生永遠不會遇到「查無此資料」那條路 ——
      而那條路正是迴圈結束條件的來源。
      ⇒ 所以出題時會刻意留一部分是找不到的（見 makeCase）。

   用法：
     SEARCHLAB.mount(host, { mode:'sequential', items:[...], target: 10, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-searchlab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /**
   * 循序搜尋：這一步只能點第 next 個（0 起算）。
   * ★ 錯的時候不告訴他該點哪一個 —— 講了就變成照指示按，
   *   而「下一個是誰」正是這一關要他自己記住的事。
   */
  function checkSequential(list, next, i) {
    if (!list.length) return { ok: false, msg: '沒有資料可以找。' };
    if (i === next) return { ok: true, msg: '' };
    if (i < next) {
      return { ok: false,
               msg: '這一項<b>已經比過了</b>。循序搜尋不會回頭 —— 往下一項。' };
    }
    return { ok: false,
             msg: '不可以跳。循序搜尋是<b>從第一個開始、一個接一個</b>往下比，' +
                  '中間不能略過 —— 跳著找那是用眼睛找，不是演算法。' };
  }

  /**
   * 走一步的結果：找到了？還是繼續？還是找完了都沒有？
   * ★ 回傳的 done 是「這一輪結束了」，found 才是「有沒有找到」。
   *   兩個分開，因為「找完了沒找到」也是一種結束 —— 而那是課本要教的那一條。
   */
  function stepResult(list, target, i) {
    var hit = String(list[i]) === String(target);
    var last = (i >= list.length - 1);
    return { found: hit, done: hit || last, at: i };
  }

  /** 循序搜尋一定會比幾次（找到就停；找不到就是全部長度） */
  function countSequential(list, target) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]) === String(target)) return i + 1;
    }
    return list.length;
  }

  /* ── 二元搜尋（課本 6-3-2）─────────────────────────
     ⚠️ 這裡的位置一律用**課本的講法**：第 1 項是 1，不是 0。
        程式裡改成 0 起算的話，學生算出「(1+13)÷2＝7」
        卻要點第 8 格 —— 他會以為自己算錯。 */

  /** 二分位置 =（開始＋結束）÷2，取整數部分（無條件捨去，課本 p.208） */
  function midOf(lo, hi) { return Math.floor((lo + hi) / 2); }

  /**
   * 這一回合只能點二分位置。
   * ★ 算錯了不告訴他答案 —— 「（開始＋結束）÷2」正是這一關要他會的事。
   */
  function checkMid(lo, hi, i) {
    if (lo > hi) return { ok: false, msg: '範圍已經空了。' };
    if (i < lo || i > hi) {
      return { ok: false,
               msg: '這一項<b>已經被排除</b>了。這一回合只能在' +
                    '第 ' + lo + ' ～ ' + hi + ' 項之間找。' };
    }
    if (i === midOf(lo, hi)) return { ok: true, msg: '' };
    return { ok: false,
             msg: '不是這一項。二元搜尋每一回合都要點<b>正中間</b>那一項 —— ' +
                  '（開始位置＋結束位置）÷ 2，除不盡就取整數部分。' };
  }

  /** 比完之後該往哪一邊。'hit' 就是找到了 */
  function sideOf(value, target) {
    var v = Number(value), t = Number(target);
    if (v === t) return 'hit';
    return (v < t) ? 'right' : 'left';      // 中間值比較小 → 目標在右半
  }

  /**
   * 砍掉一半。
   * ⚠️ 新範圍**不包含**這一回合的二分位置（課本 p.207 教學叮嚀）——
   *    包含進去的話，同一格會被比第二次，範圍永遠縮不完。
   */
  function narrow(lo, hi, mid, side) {
    return (side === 'right') ? { lo: mid + 1, hi: hi } : { lo: lo, hi: mid - 1 };
  }

  /** 範圍空了（開始位置大於結束位置）＝ 查無此資料 */
  function empty(lo, hi) { return lo > hi; }

  /** 二元搜尋一定會比幾次（找到就停；找不到就是砍到範圍空掉） */
  function countBinary(list, target) {
    var lo = 1, hi = list.length, n = 0;
    while (lo <= hi) {
      var m = midOf(lo, hi);
      n++;
      var s = sideOf(list[m - 1], target);
      if (s === 'hit') return n;
      var r = narrow(lo, hi, m, s);
      lo = r.lo; hi = r.hi;
    }
    return n;
  }

  /* ── 大比拼（第 10 關）─────────────────────────────
     ★ 第 8、9 關各自都走完了，但學生還是不會有感覺 ——
       13 筆資料，4 次對 9 次，差距不夠大。
       這一關要問的是：**資料變成 1000 筆呢？**
       課本第 203 頁的開場就是這個（5 個一眼看到、100 個來不及）。

     ⚠️ 這裡刻意**不教 log**。國中生不必碰對數。
        砍半這件事他在第 9 關已經做過了 —— 這一關只是讓他
        一直砍下去、自己數按了幾次。數出來的就是答案。

     ⚠️ 循序那一邊不給他按。1000 筆要按 1000 次 ——
        而且「最壞就是全部比一遍」本來就一望即知，
        真正反直覺的是二元那個小得離譜的數字。 */

  /** 比完中間那筆之後還剩幾筆（新範圍不含中間那筆，和第 9 關同一條規則） */
  function afterCut(n) { return Math.ceil((n - 1) / 2); }

  /**
   * 二元搜尋最壞情況要比幾次 —— 一直砍到範圍空掉為止。
   * ★ 對得起課本的兩題：50 筆 → 6 次、1024 筆 → 11 次（p.220 習題）。
   */
  function worstBinary(n) {
    var c = 0;
    while (n > 0) { c++; n = afterCut(n); }
    return c;
  }

  /** 循序搜尋最壞情況：全部比一遍（找不到，或目標在最後一筆） */
  function worstSequential(n) { return n; }

  /* 大比拼要跑的幾種資料量。
     13 是課本 6-3-2 那一列；50 與 1024 是課本習題直接問過的數字。 */
  /* ⚠️⚠️ 2026-08-17 老師：「數字太小不符合關卡名稱『資料大爆炸』」。
     原本是 [13, 50, 100, 1024] —— 最大按 11 下就砍完，
     學生只會覺得「喔，比較少」。
     ★ 真正有意思的是**大數字**：一百萬筆按 20 下、一億筆按 27 下。
       「按 20 下就砍完一百萬筆」是他自己按出來的，比看動畫強得多，
       而 20～27 下也不會按到煩。
     ★ 13 留著：那是課本的例子（p.204 那一列），概念檢測也在問它。 */
  var SIZES = [13, 1024, 1000000, 100000000];
  /* 逐次動畫跑得動的上限。★ 超過就改用「時間比例」的賽跑 ——
     一百萬次逐次畫要 100 分鐘，那不是慢，是根本跑不完。 */
  var RACE_MAX = 2000;
  /* 一排格子畫幾個。★ 資料量超過這個數就**一格代表好幾筆** ——
     1024 個格子擠在一起是一片灰，看不出「砍掉一半」。
     ⚠️ 但也不可以因此就不畫（那是 2026-08-18 老師說「只有一個動畫嗎」的原因：
        四種資料量裡只有 13 筆畫得出格子，另外三種只剩兩條進度條）。 */
  var CELL_MAX = 60;
  /* 賽跑總長（秒）：大資料量沒辦法逐次畫，改成「總共跑這麼久」。 */
  var RACE_SEC = 6;
  /* ★★ 逐次畫的時候，每一次比較要停多久。
     ⚠️ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
        —— 動畫其實有跑，但 13 筆 × 6 毫秒 = **0.08 秒**，
           整段格子動畫在眨眼之前就結束了，畫面上只留下最後一格。
        ★ 而且偏偏只有 13 筆畫得出格子 → 唯一有畫面的那一種，也是唯一看不到的。
     ⇒ 逐次模式改用這個速度（13 筆 ≈ 3 秒）。
        大資料量仍然走 RACE_SEC 的時間比例，不受這個數影響。 */
  var CELL_MS = 240;
  /* 二元那一邊至少要跑這麼久。
     ⚠️ 一億筆的二元只有 27 次 —— 照循序的步進畫完只要 0.16 秒，
        「每次砍一半」那幾刀學生一次都沒看到。
     ★ 它仍然遠比循序早結束（1.8 秒 vs 6 秒），那個落差還在。 */
  var BIN_SEC = 1.8;
  /* 時間換算的前提：假設電腦每秒比這麼多次。
     ⚠️ 這個數字要出現在畫面上 —— 不寫的話那些秒數是憑空冒出來的。
     ★ 放模組頂層有兩個理由：① 設定集中，改一個地方
        ② 宣告在任何 render()／body() 之前 —— 那是 undefined.test.js 在盯的規則
          （常數宣告在第一次繪製之後，畫面上就會出現「最少 undefined 字」那種東西）。 */
  var PER_SEC = 1000000;

  /* ── 每一種資料量的生活場景 ────────────────────────────
     ★ 老師 2026-08-17：「排隊似乎不是實際應用例子，請改成適用大數量的
       生活實例，並以明顯的標示 —— 不然與所有字相同，看不出目前操作的是
       什麼場景應用中。」
     ⚠️ 舊的說法是「在 1000 個人裡找一個人，大家按身高排好」——
        一億個人排隊給你找？那不是真實應用，是為了舉例而舉例。
     ★ 換成**真的會這樣做**的場景：這四個都是「資料先排好、
       所以查得快」的日常例子（那正是資料庫索引在做的事）。
     ⚠️ 每個場景要有自己的**量詞**：「1 億筆」很抽象，
        「1 億首歌」學生一聽就知道那是什麼規模。 */
  var SCENES = {
    13:        { icon: '📖', name: '課本的例子',
                 unit: '個數字', what: '課本 p.204 那一列 13 個數字',
                 ask: '找出其中一個數字' },
    /* ⚠️ 2026-08-17 老師：「全校座號表？沒有這種實例」——說得對。
       學校查座號是「幾年幾班幾號」直接定位，根本不必搜尋。
       ★ 換成**紙本字典**：翻到中間看一眼、決定往前還是往後翻 ——
         那是二元搜尋最經典、而且真的有人在做的生活實例。 */
    1024:      { icon: '📕', name: '紙本字典',
                 unit: '頁', what: '一本 1,024 頁的國語辭典（本來就照筆畫排好）',
                 ask: '翻到某一個字在的那一頁' },
    1000000:   { icon: '📚', name: '圖書館藏書',
                 unit: '本書', what: '市立圖書館的 100 萬本藏書（照書名排好）',
                 ask: '找出某一本書在哪一櫃' },
    100000000: { icon: '🎵', name: '音樂 App',
                 unit: '首歌', what: '音樂 App 裡的 1 億首歌（照歌名排好）',
                 ask: '找出你要聽的那一首' }
  };
  function sceneOf(n) {
    return SCENES[n] || { icon: '📦', name: '自己出的題', unit: '筆資料',
                          what: '你自己填的 ' + n + ' 筆資料', ask: '找出其中一筆' };
  }

  /**
   * 出題。
   *   course:'hit'  → 課本 p.204 那一題：8、5、10、1、7 找 10（第 3 回合找到）
   *   course:'miss' → 課本 p.205 那一題：同一列資料找 9（五回合都沒有）
   * ★ 課本用**同一列資料**示範找得到與找不到，這裡照抄 ——
   *   換一列資料的話，「差別只在目標」這件事就看不出來了。
   * ⚠️ 資料**故意不排序** —— 循序搜尋的長處就是「不必先排序」，
   *    給他一列排好的資料，他會以為兩件事有關係。
   * ⚠️ 隨機題有三分之一是找不到的（見檔案開頭的說明）。
   */
  function makeCase(opts) {
    opts = opts || {};
    var binary = (opts.mode === 'binary');

    if (opts.course) {
      /* 課本 6-3-2 的那一列（13 個已排序的數字，p.208～p.211）：
           找 67 → 4 回合找到；找 40 → 4 回合之後範圍空掉，查無此數字 */
      if (binary) {
        return { items: [12, 13, 27, 34, 39, 42, 58, 60, 67, 71, 88, 92, 95],
                 target: opts.course === 'miss' ? 40 : 67 };
      }
      return { items: [8, 5, 10, 1, 7], target: opts.course === 'miss' ? 9 : 10 };
    }

    /* ★★ 資料量要**每題不同**。
       ⚠️ 2026-08-17 老師回報：原本寫死 binary→13、sequential→8，
          所以「換一題」拿到的永遠是 13 項 ——
          第一次的中間項**永遠是第 7 項**，學生背位置就好，不必真的算
          （開始位置＋結束位置）÷ 2。
       ★★ 而且 13 是奇數，(1+13)÷2 = 7 剛好整除 ——
          學生因此**永遠碰不到**「除不盡取整數部分」那件事，
          而那正是這個公式最容易錯的地方。
       ⇒ 隨機題從下面這組挑，**故意奇偶都有**。
          課本那一題（opts.course）不受影響，維持 13 筆，學生對得回課本。 */
    var SIZES = binary ? [8, 9, 11, 12, 14, 15] : [6, 7, 8, 9, 10];
    var n = opts.size || SIZES[Math.floor(Math.random() * SIZES.length)];
    var a = [], seen = {};
    while (a.length < n) {
      var v = 1 + Math.floor(Math.random() * 99);
      if (!seen[v]) { seen[v] = 1; a.push(v); }   // 不重複，免得「第幾個」有兩個答案
    }

    if (binary) {
      /* ⚠️ 二元搜尋的資料**一定要排序** —— 那是它的前提，不是巧合。
         給一列沒排序的資料，砍掉的那一半可能正好裝著目標。 */
      a.sort(function (x, y) { return x - y; });
    } else {
      /* 反過來：循序搜尋的資料排好了就打散。
         給他一列排好的，他會以為循序搜尋也要先排序。 */
      var tries = 0;
      while (isSorted(a) && tries++ < 20) a.sort(function () { return Math.random() - 0.5; });
    }

    var miss = (opts.miss != null) ? opts.miss : (Math.random() < 0.34);
    if (miss) {
      var t = 0;
      do { t = 1 + Math.floor(Math.random() * 99); } while (seen[t]);
      return { items: a, target: t };
    }
    return { items: a, target: a[Math.floor(Math.random() * a.length)] };
  }

  function isSorted(a) {
    for (var i = 1; i < a.length; i++) {
      if (Number(a[i - 1]) > Number(a[i])) return false;
    }
    return true;
  }

  /* ── 逐步示範：按「下一步」慢慢看一遍 ─────────────────
     ★ 為什麼是「求助」而不是「開場」
       這個實驗室本來就是要學生**自己動手**（不准跳、自己算二分位置）。
       一開場就先放示範，他會照著示範按 —— 那就沒有在想了。
       ⇒ 示範收在一顆按鈕後面，卡住才看。
         和第 4 關條件判斷實驗室的「慢動作重看」是同一個設計。

     ★ 為什麼每一步都要有一句話
       只有畫面在動、沒有解說的話，學生看到的是格子在變色 ——
       他知道「有事情在發生」，但不知道發生的是什麼。

     ⚠️ 示範用的一定是**課本那一組數字**（8、5、10、1、7 找 10；
        13 個數字找 67）—— 學生手上的書就是這樣寫的。 */
  function demoSteps(mode, items, target) {
    var out = [];
    if (mode === 'binary') {
      var lo = 1, hi = items.length, n = 0;
      out.push({ lo: lo, hi: hi, mid: 0, n: 0,
                 note: '資料<b>已經由小到大排好</b>了 —— 這是二元搜尋的前提。' +
                       '開始位置 1、結束位置 ' + hi + '，要找 <b>' + target + '</b>。' });
      while (lo <= hi) {
        var m = midOf(lo, hi), v = items[m - 1];
        n++;
        out.push({ lo: lo, hi: hi, mid: m, n: n,
                   note: '第 ' + n + ' 回合：位置 =（' + lo + '＋' + hi + '）÷ 2 = ' +
                         fmt((lo + hi) / 2) + ' → 取整數部分 <b>' + m + '</b>。' +
                         '第 ' + m + ' 項是 <b>' + v + '</b>。' });
        var side = sideOf(v, target);
        if (side === 'hit') {
          out.push({ lo: lo, hi: hi, mid: m, n: n, done: true, found: true,
                     note: '<b>' + v + ' = ' + target + '，找到了！</b>只比了 ' + n + ' 次 —— ' +
                           '同一列資料用循序搜尋要比 ' + countSequential(items, target) + ' 次。' });
          return out;
        }
        var r = narrow(lo, hi, m, side);
        out.push({ lo: r.lo, hi: r.hi, mid: m, n: n,
                   note: v + (side === 'right' ? ' 比 ' + target + ' <b>小</b> —— 目標只可能在<b>右邊</b>，'
                                               : ' 比 ' + target + ' <b>大</b> —— 目標只可能在<b>左邊</b>，') +
                         '另一半連同第 ' + m + ' 項整個<b>砍掉</b>。' +
                         (r.lo > r.hi ? '' : '剩下第 ' + r.lo + ' ～ ' + r.hi + ' 項（' +
                          (r.hi - r.lo + 1) + ' 筆）。') });
        lo = r.lo; hi = r.hi;
      }
      out.push({ lo: lo, hi: hi, mid: 0, n: n, done: true, found: false,
                 note: '開始位置（' + lo + '）已經<b>大於</b>結束位置（' + hi + '）—— ' +
                       '範圍空了，<b>查無此資料</b>。迴圈就是走到這裡才停的。' });
      return out;
    }
    /* 循序：從第 1 項一格一格往下 */
    out.push({ at: 0, n: 0,
               note: '循序搜尋：從<b>第 1 項</b>開始，一項一項往右比。要找 <b>' + target + '</b>。' });
    for (var i = 0; i < items.length; i++) {
      var hit = String(items[i]) === String(target);
      out.push({ at: i + 1, n: i + 1, done: hit || (i === items.length - 1), found: hit,
                 note: hit
                   ? '第 ' + (i + 1) + ' 項是 <b>' + items[i] + '</b>　＝　目標 ' + target +
                     ' —— <b>找到了，停。</b>後面那幾項不必再比。'
                   : '第 ' + (i + 1) + ' 項是 <b>' + items[i] + '</b>　≠　目標 ' + target +
                     (i === items.length - 1
                       ? ' —— 全部比完了都沒有，<b>查無此資料</b>。'
                       : ' —— 不是它，往下一個。') });
      if (hit) break;
    }
    return out;
  }
  /* 10.5 這種要印得出來（Math 直接印會變 10.5，但整數要印 7 不是 7.0） */
  function fmt(x) { return (Math.round(x * 10) / 10); }

  /* ── 驗收挑戰的三關 ───────────────────────────────
     ⚠️ 每一關考的東西不一樣，不是同一件事考三次：
       ⭐   預測：這一題**實際**要比幾次（要在腦子裡跑一遍）
       ⭐⭐  零失誤：換一題，全程不能點錯（會操作 ≠ 不出錯）
       ⭐⭐⭐ 最壞情況：這種資料量**最多**要比幾次（那是演算法的性質，
             和某一題無關 —— 這一關不必真的走）
     ★ 第 3 關的答案就是第 10 關「搜尋大比拼」在算的東西，
       兩關互相接得上。 */
  var TESTS = {
    sequential: {
      worstSize: 12,
      worstAsk: '一列有 <b>12</b> 筆資料（沒有排序）。用循序搜尋法找一個目標，' +
                '<b>最壞</b>的情況要比幾次？',
      worstWhy: '最壞就是目標在最後一項、或根本不在裡面 —— 兩種都得把 12 筆全部比過。',
      worstAns: function (n) { return worstSequential(n); }
    },
    binary: {
      worstSize: 15,
      worstAsk: '一列有 <b>15</b> 筆<b>已經排好序</b>的資料。用二元搜尋法找一個目標，' +
                '<b>最壞</b>的情況要比幾次？',
      worstWhy: '15 → 7 → 3 → 1 → 空，一直砍一半，砍四次範圍就空了。',
      worstAns: function (n) { return worstBinary(n); }
    }
  };

  /** 這一題實際會比幾次（挑戰第 1 關的答案） */
  function realCount(mode, items, target) {
    return (mode === 'binary') ? countBinary(items, target)
                               : countSequential(items, target);
  }

  /* ── 說明文案 ─────────────────────────────────────── */
  var INFO = {
    sequential: {
      name: '循序搜尋法', icon: '🔍',
      /* ⚠️ 用詞一律跟課本：「項」不是「格」。
         畫面上的標籤是「第 N 項」，說明卻寫「第 1 格」的話，
         學生會以為那是兩個不同的東西。 */
      rule: '從<b>第 1 項</b>開始，一項一項往右點，' +
            '把它和目標比一比 —— <b>不可以跳</b>。',
      why: '從第一個元素開始取出，<span class="hl">依序逐個與目標資料比較</span>，' +
           '直到<span class="hl">找到所要的元素，或所有資料都找完</span>為止。',
      life: '交換禮物要選第一個挑的人：<span class="hl">從 1 號開始，一個一個問</span>他的紙牌是幾號，' +
            '問到那個數字為止。'
    },
    binary: {
      name: '二元搜尋法', icon: '✂️',
      rule: '資料<b>已經排好序</b>。每一回合點<b>正中間</b>那一項 —— ' +
            '<b>位置</b> =（開始位置＋結束位置）÷ 2，除不盡取整數部分 —— 再決定砍掉哪一半。' +
            '<span style="color:#94a3b8">（課本上把這個位置叫「二分位置」）</span>',
      why: '對已排序的資料折半搜尋：<span class="hl">比中間值大就取右半部，比中間值小就取左半部</span>，' +
           '每一回合待搜尋的資料量<span class="hl">馬上少一半</span>。',
      /* ⚠️ 生活案例照課本 6-3 —— 交換禮物要選第一個挑禮物的人，
         學藝股長提的方法二：老師從 1～1000 指定一個數字，
         同學輪流說出範圍**中間位置**的數字，每回合範圍砍一半。
         ★ 第 8 關用的是同一個情境的方法一（依座號一個一個比）——
           兩關同情境不同方法，差別才看得出來。
         （猜數字是課本的補充資源，留著當第二個說法。） */
      life: '交換禮物選第一個挑的人，方法二：老師從 <span class="hl-b">1～1000</span> 指定一個數字，'
          + '同學輪流說出<span class="hl">範圍中間位置</span>的數字，說完範圍就砍掉一半。'
          + '和猜數字一樣：對方說 1～100，你先猜 50，他說「太小」，'
          + '1～50 就全部不必猜了。'
    },
    /* ★ 老師 2026-08-18：「這裡面要加上畫重點標注」。
       ⚠️ 這三行是學生進到這一步看到的**第一段字** —— 讀純文字時眼睛是滑過去的。
       ★ 和排序那一邊同一組筆（theme.css）：黃＝重點、藍＝數量。
       ⚠️ 操作說明（按哪一顆、按到什麼時候）維持 <b> —— 那是指示，不是重點。
          真正要畫的是「每比一次就少掉一半」和「資料愈多差距愈誇張」。 */
    compare: {
      name: '搜尋大比拼', icon: '⚖️',
      rule: '選一個資料量，然後一直按<b>「比一次，砍掉一半」</b>，' +
            '直到範圍空掉 —— <span class="hl">按了幾下，就是二元搜尋最多要比幾次</span>。',
      why: '循序搜尋最壞要把資料<span class="hl">全部比一遍</span>；' +
           '二元搜尋<span class="hl">每比一次就少掉一半</span>。' +
           '資料愈多，兩者的差距愈誇張。',
      /* ⚠️ 2026-08-17 換掉舊的說法（「1000 個人排好隊」）——
         一億個人排隊給你找不是真實應用，是為了舉例而舉例。
         ★ 換成真的會這樣做的：音樂 App 的歌單本來就照歌名排好，
           所以你打第一個字就跳出來。 */
      /* ⚠️ 這一行只畫**一處**：整段的上限是四處，
         而 why 那一行的「全部比一遍 vs 每次少一半」是這一步的核心對比，
         那兩處不能讓。這裡留數量就好 —— 有感的是「1 億」這個量級。 */
      life: '音樂 App 裡有 <span class="hl-b">1 億首歌</span>。一首一首聽過去要聽到明年；' +
            '因為歌名<b>排好序</b>了，打幾個字就跳出來 —— 那就是二元搜尋在做的事。'
    }
  };

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.qs{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.qs-tip{background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.qs-tip b{color:#0e7490}',
    '.qs-sub{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:6px}',
    '.qs-goal{display:flex;align-items:center;gap:9px;margin-bottom:11px;flex-wrap:wrap}',
    '.qs-goal .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.qs-target{padding:7px 15px;border:2px solid #f59e0b;background:#fffbeb;',
    '  border-radius:10px;font-size:17px;font-weight:900;color:#b45309}',
    '.qs-count{font-size:12.5px;color:#0e7490;font-weight:700}',
    '.qs-row{display:flex;align-items:flex-end;gap:7px;margin-bottom:10px;flex-wrap:wrap}',
    '.qs-box{display:flex;flex-direction:column;align-items:center;gap:3px}',
    '.qs-idx{font-size:10.5px;color:#94a3b8;font-weight:700}',
    '.qs-cell{min-width:46px;padding:11px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:16px;font-weight:700;font-family:inherit;color:#334155;',
    '  cursor:pointer;transition:.12s}',
    '.qs-cell:hover{border-color:#06b6d4;background:#ecfeff}',
    /* 比過但不是目標：灰掉。★ 灰掉的格子仍然看得到數字 ——
       「我剛剛比過哪些」是學生數比較次數的依據。 */
    '.qs-cell.past{border-color:#e2e8f0;background:#f8fafc;color:#cbd5e1;cursor:default}',
    '.qs-cell.past:hover{background:#f8fafc;border-color:#e2e8f0}',
    '.qs-cell.now{border-color:#06b6d4;background:#cffafe;transform:translateY(-3px)}',
    '.qs-cell.hit{border-color:#22c55e;background:#dcfce7;color:#166534;cursor:default}',
    /* 出錯一律紅色（三支實驗室一致）。⚠️ 要排在其他狀態後面，
       不然閃爍會被 now／cut 蓋掉，學生點錯卻沒有任何反應。 */
    '.qs-cell.bad{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    /* 二元搜尋：被砍掉的那一半整個劃掉。
       ★ 劃掉但不刪除 —— 學生要看得見「這一刀砍掉了多少」，
         那正是二元搜尋和循序搜尋的差別。 */
    '.qs-cell.cut{border-color:#f1f5f9;background:#f8fafc;color:#e2e8f0;',
    '  text-decoration:line-through;cursor:default}',
    '.qs-cell.cut:hover{background:#f8fafc;border-color:#f1f5f9}',
    '.qs-range{font-size:12.5px;color:#0e7490;font-weight:700;margin-bottom:8px}',
    '.qs-range b{color:#155e75}',
    '.qs-side{display:flex;gap:9px;margin-top:10px;flex-wrap:wrap}',
    '.qs-side button{background:#fff;border:2px solid #06b6d4;color:#0e7490;border-radius:9px;',
    '  padding:8px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-side button:hover{background:#ecfeff}',
    /* ── 「按這裡」的區塊（和 sortlab 的 .sl-go 是同一件事）──────
       ⚠️ 老師 2026-08-18 是對排序那顆說「太不明顯，找很久才發現」，
          但這一邊是同一種毛病、只是輕一級：
          🏁 那顆和上面的「資料量」按鈕長得一模一樣（都是白底外框），
          在一排看起來一樣的按鈕裡，主要動作等於沒有主要動作。
       ★ 兩個實驗室是**上下疊在同一頁**的 —— 入口的樣子要一致，
         不然學生在排序那邊學會的「找紫色大按鈕」，到搜尋這邊就失效了。 */
    '.qs-go{background:#ecfeff;border:2px dashed #67e8f9;border-radius:14px;',
    '  padding:15px 14px;margin:13px 0;text-align:center}',
    '.qs-go button{background:#0891b2;color:#fff;border:0;border-radius:11px;',
    '  padding:14px 26px;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;',
    '  box-shadow:0 3px 0 #155e75;letter-spacing:.5px}',
    '.qs-go button:hover{background:#0e7490}',
    '.qs-go button:active{transform:translateY(2px);box-shadow:0 1px 0 #155e75}',
    '.qs-go .cap{font-size:12.5px;font-weight:700;color:#0e7490;line-height:1.8;margin-top:9px}',
    '@keyframes qs-breathe{0%,100%{box-shadow:0 3px 0 #155e75,0 0 0 0 rgba(8,145,178,.5)}',
    '  50%{box-shadow:0 3px 0 #155e75,0 0 0 12px rgba(8,145,178,0)}}',
    '.qs-go button{animation:qs-breathe 2.4s ease-out infinite}',
    '@media (prefers-reduced-motion:reduce){.qs-go button{animation:none}}',
    /* 大比拼 */
    '.qs-pick{display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap;align-items:center}',
    '.qs-pick .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.qs-pick button{background:#fff;border:2px solid #cbd5e1;color:#334155;border-radius:9px;',
    '  padding:6px 13px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-pick button:hover{border-color:#06b6d4;background:#ecfeff}',
    '.qs-pick button.on{border-color:#06b6d4;background:#cffafe;color:#0e7490}',
    '.qs-pick button.ok{border-color:#86efac;background:#dcfce7;color:#166534}',
    /* ── 砍一半的畫面（2026-08-17：老師說點下去感受不夠強烈）────
       ★ 三件事：範圍條崩塌＋抖一下、大字報排除幾筆、循序搜尋的同步進度。
       ⚠️ 兩條用同一個量度（還剩幾筆沒找），不然沒得比。 */
    /* 場景橫幅：★ 要一眼看出「現在在找什麼」。
       ⚠️ 和內文一樣的字級等於沒有標示（老師 2026-08-17 指出的正是這件事）。 */
    '.qs-scene{display:flex;gap:11px;align-items:center;background:#0e7490;color:#fff;',
    '  border-radius:12px;padding:10px 14px;margin-bottom:11px}',
    '.qs-scene .ic{font-size:30px;line-height:1;flex:0 0 auto}',
    '.qs-scene .tx{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.qs-scene b{font-size:16px;font-weight:900;letter-spacing:.02em}',
    '.qs-scene .sub{font-size:12.5px;line-height:1.65;color:#cffafe}',
    '.qs-cut{margin-bottom:11px}',
    '.qs-cut .boom{font-size:20px;font-weight:900;color:#b45309;line-height:1.5;',
    '  margin-bottom:9px}',
    '.qs-cut .boom b{font-size:27px;color:#c2410c}',
    '.qs-cut .boom.idle{font-size:14px;font-weight:700;color:#64748b}',
    '.qs-two .row{margin-bottom:8px}',
    '.qs-two .lb{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;font-weight:800;color:#475569;margin-bottom:3px}',
    '.qs-two .lb span{font-family:ui-monospace,monospace;font-size:13px;color:#334155}',
    '.qs-two .bar{background:#e2e8f0;border-radius:7px;height:18px;overflow:hidden}',
    '.qs-two .fill{height:100%;border-radius:7px;transition:width .38s cubic-bezier(.4,0,.2,1)}',
    '.qs-two .me .fill{background:#06b6d4}',
    '.qs-two .seq .fill{background:#f59e0b}',
    /* 震動：範圍條被砍的時候抖一下。★ 每次重畫都是新元素，所以會自己重播。
       ⚠️ 只抖 0.22 秒 —— 再久會拖慢節奏，而學生一節課要按幾十下。 */
    '@keyframes qsHit{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}',
    '  55%{transform:translateX(4px)}80%{transform:translateX(-2px)}}',
    '.qs-two .fill.hit{animation:qsHit .22s ease-out}',
    /* 量級的參考尺：★ 那條細到看不見的線就是重點。 */
    /* 還差什麼：★ 條件有幾項，畫面上就要有幾個勾。 */
    '.qs-todo{background:#fff;border:2px solid #a5f3fc;border-radius:12px;',
    '  padding:9px 13px;margin-bottom:11px}',
    '.qs-todo .th{font-size:12.5px;font-weight:900;color:#0e7490;margin-bottom:5px}',
    '.qs-todo ul{list-style:none;margin:0;padding:0}',
    '.qs-todo li{display:flex;justify-content:space-between;gap:10px;align-items:baseline;',
    '  font-size:13px;line-height:1.95;color:#64748b}',
    '.qs-todo li span{font-size:11.5px;color:#94a3b8;flex:0 0 auto}',
    '.qs-todo li.half{color:#b45309}',
    '.qs-todo li.half span{color:#d97706;font-weight:700}',
    '.qs-todo li.ok{color:#166534}',
    '.qs-todo li.ok span{color:#16a34a}',
    '.qs-scale{margin:2px 0 8px}',
    '.qs-scale .mini{background:#f1f5f9;border-radius:5px;height:9px;overflow:hidden}',
    '.qs-scale .seg{height:100%;background:#94a3b8;border-radius:5px;min-width:2px}',
    '.qs-scale .cap{font-size:11.5px;color:#64748b;line-height:1.7;margin-top:3px}',
    '.qs-scale .cap b{color:#b45309}',
    '.qs-cnt{font-size:13px;color:#475569;line-height:1.8}',
    '.qs-cnt b{color:#0e7490;font-size:15px}',
    '.qs-cnt.big{margin-top:9px;font-size:14px;font-weight:700;color:#155e75}',
    /* ⚠️ 會暈車的人要能關掉 —— 系統設定裡開了「減少動態效果」就不要動。 */
    '@media (prefers-reduced-motion:reduce){',
    '  .qs-two .fill{transition:none}.qs-two .fill.hit{animation:none}}',
    '.qs-left{font-size:15px;font-weight:700;color:#155e75;margin-bottom:10px}',
    '.qs-left b{font-size:22px;color:#0e7490}',
    /* ── 賽跑（老師 2026-08-17）────────────────────────────
       ★ 為什麼要有這一段
         原本這一步是「一直按『比一次砍一半』，按完四種資料量就過」。
         1024 筆按 **11 下**就結束了 —— 學生體驗到的只有**快的那一邊**；
         循序搜尋那 1024 次他一次都沒有經歷過，只是表格上的一個數字。
         ⇒ 差距當然沒感覺。
       ★ 所以讓循序搜尋**當場跑給他看**：計數器跳、進度條爬，而他要等。
         那個等待就是這一步的教學內容。
       ⚠️⚠️ 動畫的速度是**放慢過的**（真的電腦一秒可以比幾百萬次）。
          畫面上一定要講出來，不然學生會以為電腦搜尋要跑好幾秒。
          ★ 要強調的是：**兩邊的比例是真的**。 */
    '.qs-race{margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;',
    '  border-radius:12px;padding:11px 13px}',
    /* 一整排資料：看得到「走到哪」與「砍掉哪一半」 */
    '.qs-cells{margin-bottom:10px}',
    '.qs-cells .cl{margin-bottom:7px}',
    '.qs-cells .nm{display:block;font-size:11.5px;font-weight:800;color:#475569;margin-bottom:3px}',
    '.qs-cells .row{display:flex;gap:2px}',
    '.qs-cells .c{flex:1;height:20px;border-radius:3px;background:#bae6fd;',
    '  transition:background .15s}',
    '.qs-cells .c.gone{background:#e2e8f0}',
    '.qs-cells .c.now{background:#f59e0b}',
    /* 一格代表好幾筆的時候要講出來 —— 不講的話學生會以為「一億筆只有 60 個」 */
    '.qs-cells .scale{font-size:11px;font-weight:700;color:#0369a1;',
    '  background:#f0f9ff;border-radius:6px;padding:3px 7px;margin-bottom:6px;display:inline-block}',
    '.qs-race .rh{font-size:12.5px;font-weight:900;color:#475569;margin-bottom:8px}',
    '.qs-lane{margin-bottom:9px}',
    '.qs-lane .nm{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;font-weight:800;color:#334155;margin-bottom:3px}',
    '.qs-lane .nm .ct{font-family:ui-monospace,monospace;font-size:13px}',
    '.qs-lane .track{background:#e2e8f0;border-radius:7px;height:16px;overflow:hidden}',
    '.qs-lane .fill{height:100%;border-radius:7px;transition:width .12s linear}',
    '.qs-lane.seq .fill{background:#f59e0b}',
    '.qs-lane.bin .fill{background:#06b6d4}',
    '.qs-lane.done .nm{color:#166534}',
    '.qs-race .note{font-size:11.5px;color:#94a3b8;line-height:1.7;margin-top:6px}',
    '.qs-race .win{font-size:13.5px;line-height:1.85;color:#166534;font-weight:700;margin-top:7px}',
    /* ── 資料大爆炸 ─────────────────────────────────────
       ⚠️ 這一段的數字要**大**：關卡叫「資料大爆炸」，
          而 1024 對 11 稱不上爆炸（老師 2026-08-17）。
          真正的震撼是 2300 萬 → 25 次。 */
    '.qs-boom{margin-top:14px;background:#fff7ed;border:2px solid #fdba74;',
    '  border-radius:12px;padding:12px 14px}',
    '.qs-boom .bh{font-size:14px;font-weight:900;color:#9a3412;margin-bottom:8px}',
    '.qs-boom .bq{font-size:13.5px;line-height:1.9;color:#7c2d12}',
    '.qs-boom .bq b{color:#9a3412}',
    '.qs-boom .sub{font-size:12px;color:#b45309}',
    '.qs-boom .brow{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}',
    '.qs-boom input{width:150px;padding:7px 10px;border:2px solid #fdba74;border-radius:9px;',
    '  font-size:14px;font-weight:700;font-family:inherit}',
    '.qs-boom button{background:#f97316;color:#fff;border:0;border-radius:9px;padding:7px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-boom button:hover{background:#ea580c}',
    '.qs-boom .bmsg{margin-top:8px;font-size:13px;line-height:1.8;color:#92400e}',
    '.qs-boom .bwin{font-size:14px;line-height:1.95;color:#7c2d12;font-weight:700}',
    '.qs-boom .bwin b{font-size:20px;color:#c2410c}',
    '.bpick{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:11px}',
    '.bpick button{background:#fff;border:2px solid #fdba74;color:#9a3412;padding:6px 12px;',
    '  font-size:13px}',
    '.bpick button.on{background:#fed7aa}',
    '.bres{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.bres .one{flex:1;min-width:110px;background:#fff;border:1px solid #fed7aa;',
    '  border-radius:10px;padding:8px 11px}',
    '.bres .lb{display:block;font-size:11px;font-weight:900;color:#b45309}',
    '.bres .vl{display:block;font-size:19px;font-weight:900;color:#9a3412;line-height:1.3}',
    '.bres .sub{display:block;font-size:11.5px;color:#c2410c}',
    '.bres .one.hot{border-color:#fca5a5;background:#fef2f2}',
    '.bres .one.hot .vl{color:#b91c1c}',
    '.bres .one.cool{border-color:#6ee7b7;background:#f0fdf4}',
    '.bres .one.cool .vl{color:#047857}',
    '.bnote{font-size:11.5px;color:#b45309;line-height:1.7;margin-top:7px}',
    '.qs-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}',
    '.qs-tbl th,.qs-tbl td{border:1px solid #e2e8f0;padding:6px 9px;text-align:center}',
    '.qs-tbl th{background:#f1f5f9;color:#475569;font-size:12px}',
    '.qs-tbl td.big{color:#b45309;font-weight:700}',
    '.qs-tbl td.small{color:#0e7490;font-weight:700}',
    '.qs-msg{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.qs-msg.good{background:#dcfce7;color:#166534}',
    '.qs-msg.bad{background:#fef3c7;color:#92400e}',
    '.qs-msg.none{background:#e2e8f0;color:#475569}',
    '.qs-btn{background:#06b6d4;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.qs-btn:hover{background:#0891b2}',
    /* 逐步示範 */
    '.qs-demo{background:#f0f9ff;border:1px solid #bae6fd;border-radius:11px;',
    '  padding:11px 14px;margin-bottom:10px}',
    '.qs-demo .h{font-size:13.5px;font-weight:900;color:#0369a1;margin-bottom:6px}',
    '.qs-demo .say{font-size:13px;line-height:1.85;color:#075985;min-height:44px}',
    '.qs-demo .say b{color:#0c4a6e}',
    '.qs-demo .row{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}',
    '.qs-demo button{background:#fff;border:2px solid #7dd3fc;color:#0369a1;border-radius:8px;',
    '  padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-demo button:hover{background:#e0f2fe}',
    '.qs-big .qs-demo{padding:14px 17px}',
    '.qs-big .qs-demo .h{font-size:15px}',
    '.qs-big .qs-demo .say{font-size:15px;min-height:56px}',
    '.qs-big .qs-demo button{padding:8px 17px;font-size:14.5px}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）─────────
       ★ 這一步是第 6 章那幾關的主角，畫面上就該長得像主角。
         原本的尺寸是給「順手嵌在別的東西旁邊」用的，
         單獨佔一整步時下面會空一大片，看起來像還沒載完。
       ⚠️ 放大的是高度與字級，**不是頁寬** —— 頁寬要和闖關地圖一致。 */
    '.qs-big .qs-cell{min-width:64px;padding:18px 14px;font-size:22px;border-width:3px}',
    '.qs-big .qs-idx{font-size:12.5px}',
    '.qs-big .qs-row{gap:10px;margin-bottom:16px}',
    '.qs-big .qs-target{padding:10px 22px;font-size:24px;border-width:3px}',
    '.qs-big .qs-goal{gap:12px;margin-bottom:16px}',
    '.qs-big .qs-goal .lb,.qs-big .qs-count{font-size:14px}',
    '.qs-big .qs-range{font-size:14.5px;margin-bottom:12px}',
    '.qs-big .qs-tip{font-size:14.5px;padding:14px 17px}',
    '.qs-big .qs-sub{font-size:13.5px}',
    '.qs-big .qs-msg{font-size:15px;padding:13px 16px;min-height:52px}',
    '.qs-big .qs-side button{padding:12px 20px;font-size:15px}',
    '.qs-big .qs-btn{padding:11px 20px;font-size:15px}',
    '.qs-big .qs-left{font-size:17px}',
    '.qs-big .qs-left b{font-size:28px}',
    '.qs-big .qs-pick button{padding:9px 18px;font-size:15px}',
    '.qs-big .qs-tbl{font-size:14.5px}',
    '.qs-big .qs-tbl th,.qs-big .qs-tbl td{padding:10px 12px}',
    /* ── 第 3 關的砍半計數器（答錯一次才出現）───────── */
    '.qs-aid{background:#fffbeb;border:1px solid #fcd34d;border-radius:11px;',
    '  padding:10px 13px;margin-top:9px}',
    '.qs-aid .h{font-size:13px;font-weight:900;color:#92400e;margin-bottom:6px}',
    '.qs-aid .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:6px;',
    '  font-size:13px;color:#78350f}',
    '.qs-aid .row b{font-size:19px;color:#b45309}',
    '.qs-aid button{background:#f59e0b;color:#fff;border:0;border-radius:8px;',
    '  padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-aid button:hover{background:#d97706}',
    '.qs-aid button:disabled{background:#e2e8f0;color:#94a3b8;cursor:default}',
    '.qs-aid button.ghost{background:#fff;border:2px solid #fcd34d;color:#92400e}',
    '.qs-aid .say{font-size:12.5px;line-height:1.8;color:#92400e;margin-top:4px}',
    '.qs-big .qs-aid{padding:13px 16px}',
    '.qs-big .qs-aid .h{font-size:14.5px}',
    '.qs-big .qs-aid .row{font-size:14.5px}',
    '.qs-big .qs-aid .row b{font-size:24px}',
    '.qs-big .qs-aid button{padding:9px 18px;font-size:14.5px}',
    '.qs-big .qs-aid .say{font-size:13.5px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('qs-style')) return;
    var s = document.createElement('style');
    /* 挑戰與證書的樣式在 shared/labtest.js —— 三支實驗室共用一份，
       抄過來的話改一邊會忘另一邊。 */
    s.id = 'qs-style';
    s.textContent = CSS + ((global.LABTEST && global.LABTEST.css) || '');
    document.head.appendChild(s);
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var mode = opts.mode || 'sequential';
    var info = INFO[mode] || INFO.sequential;

    var items, target, next, tried, passed, ended;
    /* 二元搜尋用：目前的搜尋範圍（1 起算，照課本），還有這一回合停在哪一步。
       phase 'pick' = 該點二分位置了；'side' = 點完了，該決定砍哪一半。 */
    var lo, hi, phase, mid;
    /* 大比拼用：目前選的資料量、還剩幾筆、按了幾下，還有已經跑完的紀錄。 */
    var sizes = opts.sizes || SIZES;
    var size = 0, left = 0, cuts = 0, table = {};
    /* ── 賽跑的狀態 ────────────────────────────────
       raceN：這一輪跑的是幾筆　raceSeq／raceBin：兩邊各比了幾次
       raceOn：跑到哪一個階段（0＝還沒跑、1＝跑到一半、2＝跑完）
       ⚠️ raced 記「哪幾種資料量的賽跑跑完了」—— 通過條件看它，
          不是看 table（按完砍一半只算走了一半）。 */
    var raceN = 0, raceSeq = 0, raceBin = 0, raceOn = 0, raceTimer = null;
    var raced = {};
    /* ── 資料大爆炸（老師 2026-08-17：「數字太小不符合關卡名稱」）──
       ★ 13～1024 筆稱不上爆炸：1024 對 11，學生還會覺得「喔，比較少」。
         真正的震撼在這裡 ——
           全台灣 2300 萬人 → 二元搜尋只要 **25 次**
           全世界 80 億人   → 只要 **33 次**
         資料量變成 348 倍，比較次數只多 8 次。
       ★ 而且要**先讓他猜**：直接揭曉他是被動接收，
         猜錯的那一下比任何動畫都深刻（第 8、9 關的驗收挑戰用的也是這一招）。
       ⚠️ 這幾個人口數字是概數，畫面上要寫「約」—— 教材不可以假裝精確。 */
    var BOOM = [
      { n: 900,        label: '全校',   note: '約 900 人' },
      { n: 2700000,    label: '高雄市', note: '約 270 萬人' },
      { n: 23000000,   label: '全台灣', note: '約 2300 萬人' },
      { n: 8000000000, label: '全世界', note: '約 80 億人' }
    ];
    /* 猜的那一題固定用全台灣 —— 學生對這個數字最有感。 */
    var BOOM_ASK = BOOM[2];
    var boomGuess = null;     // 猜了幾次（null＝還沒猜）
    var boomDone = false;     // 猜過了沒（猜錯也算，重點是猜過）
    var boomN = 0;            // 自己填的資料量（0＝還沒填）
    /* 每比一次停幾毫秒。★ 這個數字決定 1024 筆要等多久（1024×6ms ≈ 6 秒）。
       ⚠️ 不要調到太快 —— 那個等待就是這一步要給的東西。
       ⚠️ opts.stepMs = 0 是**測試用**的：0 就同步跑完，不開計時器。
          （測試是同步寫的，等六秒鐘的計時器沒辦法驗。） */
    var STEP_MS = (opts.stepMs != null) ? Number(opts.stepMs) : 6;
    /* ★ 要「找到一次」＋「找不到一次」才算通過。
       只找到過的學生，不會知道迴圈為什麼需要結束條件。 */
    var sawHit = false, sawMiss = false;
    /* 逐步示範：dAt < 0 代表沒開。開了才算步數。 */
    var dAt = -1, dSteps = null;
    var usedMiss = false;      // 課本的第二題（找不到）出過了沒
    /* ── 驗收挑戰（自由玩通過之後才開）─────────────
       ⚠️ 「照規則走完」只證明他**會操作**。
          真正的證據是：動手之前先說得出「這一題要比幾次」。
       三個難度見 shared/labtest.js。 */
    var freePassed = false;    // 自由玩那一段過了沒
    var worstTries = 0;        // 第 3 關答錯幾次（答錯一次才給鷹架）
    var aidN = 0, aidC = 0;    // 鷹架的計數器：還剩幾項、已經比幾次
    var lvNow = 0;             // 正在挑戰第幾關（0＝還沒開始）
    var cleared = {};          // 過了哪幾關
    var guess = null;          // 這一關預測的數字
    var errs = 0;              // 這一題點錯幾次（零失誤那一關要）
    var testMsg = '', testKind = 'info';

    reset(opts.items && opts.items.length
            ? { items: opts.items.slice(), target: opts.target }
            : (mode === 'compare' ? { items: [], target: '' } : makeCase(opts)));

    host.className = 'qs' + (opts.big ? ' qs-big' : '');
    render();

    function reset(c) {
      items = c.items; target = c.target;
      next = 0; tried = 0; ended = false;
      lo = 1; hi = items.length; phase = 'pick'; mid = 0;
    }

    /* ── 換一題 ────────────────────────────────────
       ⚠️ 2026-08-12 抓到的當機級錯誤：
          原本是 `reset(makeCase(opts))` —— opts 裡還帶著 course:'hit'，
          所以 makeCase 每次都回課本那一題（8、5、10、1、7 找 10）。
          「換一題」按幾次都一樣，而通過條件要「找得到＋找不到各一次」
          ⇒ **這一關永遠過不了**，學生卡在這一步走不下去。
          ★ 而且畫面上完全看不出異常：題目長得好好的，
            只是每次都一樣，學生只會覺得「怎麼一直是這題」。

       ★ 換題的順序是設計過的：
         第 1 題　課本 p.204 那一題（找得到）——和他手上的書一樣
         第 2 題　課本 p.205 那一題（同一列資料找 9，找不到）
                  ⇒ 課本用同一列示範兩次，這裡照走一遍
         之後　　 隨機出題（三分之一是找不到的） */
    function nextCase() {
      /* ⚠️ 課本那一題（同一列資料、找得到／找不到各一次）只在**自由玩**出現。
         挑戰開始之後再回到課本那一列，學生會覺得「怎麼又是這題」——
         而且那一列他剛剛才走過兩遍。 */
      if (opts.course && !usedMiss && !lvNow) {
        usedMiss = true;
        reset(makeCase({ mode: mode, course: 'miss' }));
      } else {
        reset(freshCase());
      }
      dAt = -1; dSteps = null;      // 換題就把示範收起來
      errs = 0;                     // 新的一題，失誤重新算
      render();
    }

    /* ── 一定要和「上一題」不一樣的新題目 ──────────────────
       ⚠️⚠️ 老師 2026-08-18：「二元搜尋法過了第一關後，換題會是相同數字」
          —— 兩個原因疊在一起：
          ① 課本那一題會出現**兩次**（找得到／找不到用同一列資料，那是刻意的），
             但那是給**自由玩**的。走到驗收挑戰還拿到它就變成「怎麼又是這題」。
          ② 隨機出題完全沒有「不可以和上一題一樣」的保護 ——
             資料量只有 6～15 種，抽到同一個長度、看起來就很像沒換。
       ⇒ 這一支：把 course 拿掉（永遠隨機），而且和目前這一題比對，
         一樣就重抽。重抽有次數上限 —— 抽不到就算了，
         **卡住比重複更糟**（寧可偶爾重複，不要無窮迴圈）。 */
    function freshCase() {
      var o = {};
      for (var k in opts) if (k !== 'course') o[k] = opts[k];
      var now = (items || []).join(',') + '|' + target;
      var wasN = (items || []).length;
      var c = null;
      for (var t = 0; t < 12; t++) {
        c = makeCase(o);
        /* ★★ 老師 2026-08-18：「搜尋的換一題問題還是在，通關後是同樣數量」。
           ⚠️ 只比「整組資料一不一樣」是不夠的：
              數字全換、但**筆數一樣**的話，畫面上格子數不變、
              二元搜尋的第一個中間位置也不變 ——
              學生看到的就是「同一種題目換了幾個數字」。
              而「這一題有幾筆」正是這兩關要他每次重新算的東西。
           ⇒ 筆數也要換得動。抽不到就算了（下面的上限），卡住比重複更糟。 */
        if (c.items.join(',') + '|' + c.target !== now && c.items.length !== wasN) return c;
      }
      return c;
    }

    function render() {
      host.innerHTML =
        '<div class="qs-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="qs-sub">📝 ' + info.why + '<br>🎁 ' + info.life + '</div></div>' +
        (mode === 'compare' ? ''
          : '<div class="qs-goal"><span class="lb">目標資料</span>' +
            '<span class="qs-target">' + esc(target) + '</span>' +
            '<span class="qs-count" id="qs-cnt"></span></div>') +
        '<div id="qs-test"></div>' +
        '<div id="qs-demo"></div>' +
        '<div id="qs-body"></div>' +
        '<div id="qs-msg"></div>' +
        (opts.newRound !== false && mode !== 'compare'
          ? '<button class="qs-btn" id="qs-new">🎲 換一題</button>' : '');
      body();
      test();
      demo();
      count();
      var nb = host.querySelector('#qs-new');
      if (nb) nb.onclick = nextCase;
    }

    /* ── 驗收挑戰的畫面 ──────────────────────────
       ⚠️ 一次只出現一關。三關攤開的話，
          學生會先看第 3 關的題目，那一關就白出了。 */
    function test() {
      var box = host.querySelector('#qs-test');
      if (!box) return;
      if (!lvNow) { box.innerHTML = ''; return; }
      var T = TESTS[mode], L = global.LABTEST.LEVELS[lvNow - 1];

      if (lvNow > 3) {                       // 三關都過了 → 證書
        box.className = '';
        box.innerHTML = global.LABTEST.certificate(3,
          { title: INFO[mode].name + '　驗收挑戰' });
        return;
      }
      box.className = '';
      var head = '<div class="lt-box"><div class="h">' + L.icon +
                 ' 驗收挑戰 ' + lvNow + '／3　' + L.name +
                 '（目前 ' + stars() + ' ★，三關全過才能往下一步）</div>';

      if (lvNow === 1) {
        box.innerHTML = head +
          (guess === null
            ? '<div class="q">先別動手。<b>這一題</b>要比幾次才會結束？' +
              '（找到就停；找不到就是全部比完）</div>' +
              '<div class="row"><input id="qs-g" type="number" min="1" placeholder="次數">' +
              '<button data-g="1">送出預測</button></div>'
            : '<div class="q">你猜 <b>' + guess + '</b> 次。現在真的走一遍 —— ' +
              '走完就知道猜得準不準。</div>') +
          '</div>';
      } else if (lvNow === 2) {
        box.innerHTML = head +
          '<div class="q">這是<b>新的一題</b>（系統已經幫你換好了）。' +
          '<b>全程不能點錯</b> —— 點錯的話走完會自動再換一題。' +
          '<br>目前這一題已經錯了 <b>' + errs + '</b> 次。</div></div>';
      } else {
        /* ★★ 第 3 關是**實際的通關門檻**（onPass 只在這裡被扳動），
             所以它不可以是「想不出來就卡死」的一題。
           ⚠️ 2026-08-17 之前這裡只有題目和一句 worstWhy，
              答錯就只回「不是 N 次」—— 學生沒有任何東西可以推。
           ★ 現在：**答錯一次之後**才長出一個砍半計數器，
             讓他自己按、自己數。先給的話這一題就白出了；
             不給的話他只能亂猜數字，那更糟。 */
        box.innerHTML = head +
          '<div class="q">' + T.worstAsk + '<br>' +
          '<span style="font-size:12.5px">這一關<b>不必真的走</b> —— ' +
          '想想這個演算法最多會做幾次。</span></div>' +
          '<div class="row"><input id="qs-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="3">送出答案</button></div>' +
          (worstTries > 0 ? aidHTML() : '') +
          '</div>';
      }
      box.innerHTML += '<div class="lt-say ' + (testKind || 'info') + '" id="qs-tsay">' +
                       (testMsg || '　') + '</div>';
      [].forEach.call(box.querySelectorAll('[data-g]'), function (el) {
        el.onclick = function () { submit(Number(el.dataset.g)); };
      });
      [].forEach.call(box.querySelectorAll('[data-aid]'), function (el) {
        el.onclick = function () { aidTap(el.dataset.aid); };
      });
    }

    function submit(which) {
      var inp = host.querySelector('#qs-g');
      var v = Number(inp && inp.value);
      if (!(v > 0)) { tsay('info', '先填一個數字。'); return; }

      if (which === 1) {
        guess = v;
        tsay('info', '記下來了：<b>' + v + '</b> 次。現在真的走一遍。');
        render();
        return;
      }
      /* 第 3 關：最壞情況 */
      var want = TESTS[mode].worstAns(TESTS[mode].worstSize);
      if (v === want) {
        cleared[3] = true; lvNow = 4;
        tsay('good', '對了 —— <b>' + want + '</b> 次。' + TESTS[mode].worstWhy +
                     '<br>三關全過，證書拿到了 ★★★');
        render(); finishAll();
      } else {
        worstTries++;
        /* ★ 第一次答錯就把砍半計數器放出來（見 test() 裡的說明）。
           ⚠️ worstWhy 本來就寫著「15 → 7 → 3 → 1 → 空」——
              但那是一行字，學生讀過去不會停下來數。
              自己按四下才會。 */
        tsay('bad', '不是 ' + v + ' 次。' +
                    (worstTries === 1
                      ? '<br>下面給你一個工具：<b>自己按按看</b>，數數看按幾下範圍才會空。'
                      : TESTS[mode].worstWhy + '<br>用下面那個工具再數一次。'));
      }
    }

    /**
     * 第 3 關的鷹架：一個砍半（或逐一比）的計數器。
     * ★ 為什麼是「自己按」而不是把過程印出來
     *   印出來的話學生用讀的，讀完照樣不知道那個數字怎麼來的。
     *   按四下、看著範圍從 15 變成空的，那四下他自己數過。
     */
    function aidHTML() {
      var T = TESTS[mode];
      return '<div class="qs-aid">' +
        '<div class="h">🧮 自己數數看</div>' +
        '<div class="row">' +
          '<span>還剩 <b id="qs-aid-n">' + aidN + '</b> 項</span>' +
          '<span>已經比了 <b id="qs-aid-c">' + aidC + '</b> 次</span>' +
        '</div>' +
        '<div class="row">' +
          '<button data-aid="go"' + (aidN <= 0 ? ' disabled' : '') + '>' +
            (mode === 'binary' ? '比一次，砍掉一半' : '比一次，往下一項') + '</button>' +
          '<button data-aid="rst" class="ghost">↺ 重來</button>' +
        '</div>' +
        '<div class="say">' +
          (aidN <= 0
            ? '範圍空了 —— 你按了 <b>' + aidC + '</b> 次。那就是最壞的情況。'
            : (aidC === 0
                ? '從 ' + T.worstSize + ' 項開始。按一下看看剩幾項。'
                : '每比一次就' + (mode === 'binary' ? '砍掉一半' : '少一項') + '。繼續按。')) +
        '</div></div>';
    }

    function aidTap(what) {
      if (what === 'rst') { aidN = TESTS[mode].worstSize; aidC = 0; render(); return; }
      if (aidN <= 0) return;
      /* ⚠️ 這裡的算法要和 worstBinary／worstSequential **完全一致**，
         不然工具數出來的和答案對不起來 —— 那比沒有工具還糟。
         binary：比完中間那一項，剩下的一半是 floor(n/2)
         sequential：一次只排除一項 */
      aidN = (mode === 'binary') ? Math.floor(aidN / 2) : aidN - 1;
      aidC++;
      render();
    }
    function tsay(kind, msg) { testKind = kind; testMsg = msg; render(); }

    /* 走完一題之後，看看挑戰過了沒 */
    function afterRound() {
      if (!lvNow || lvNow > 3) return;
      var real = realCount(mode, items, target);
      /* ★ 每一關結束都自己換題 —— 訊息說「換一題」，那就真的換。
         ⚠️ 叫學生自己去按按鈕，會發生兩件事：
            ① 他忘了按 → 對著一題已經走完的題目，怎麼點都沒反應
            ② 他猜完才按 → 猜的是舊題目、驗的是新題目，永遠判錯
         ⚠️ 換題要在 tsay 之前做（tsay 會 render），
            不然畫面會先畫舊題目再被蓋掉，閃一下。 */
      var again = function () {
        reset(freshCase());
        dAt = -1; dSteps = null; errs = 0; guess = null;
      };
      if (lvNow === 1) {
        /* ⚠️⚠️ 還沒猜就把題目走完了 —— 原本這裡只是 `return`，
           於是畫面**什麼都不會發生**：題目結束了、點不動了、
           也沒有任何一句話告訴他為什麼。那是一條安靜的死路。
           ★ 這一關本來就要「先猜再走」，所以走完＝這一題作廢，
             換一題重來，並且把原因講出來。 */
        if (guess === null) {
          again();
          tsay('info', '這一關要<b>先猜再走</b> —— 剛才那一題還沒猜就走完了，' +
                       '所以不算。<br><b>已經換了一題</b>：先填上面的預測，再動手。');
          return;
        }
        if (guess === real) {
          cleared[1] = true; lvNow = 2;
          again();
          tsay('good', '猜中了 —— 真的是 <b>' + real + '</b> 次 ⭐<br>' +
                       '下一關：<b>已經換了一題</b>，這一次<b>全程不能點錯</b>。');
        } else {
          var g = guess;
          again();
          tsay('bad', '你猜 ' + g + '，實際是 <b>' + real + '</b> 次。' +
                      '<br><b>已經換了一題</b>，再試一次 —— 這一關可以一直重來。');
        }
        return;
      }
      if (lvNow === 2) {
        if (errs === 0) {
          cleared[2] = true; lvNow = 3;
          tsay('good', '整題零失誤 ⭐⭐<br>最後一關：不必真的走，直接算給我看。');
        } else {
          var n = errs;
          again();
          tsay('bad', '這一題點錯了 ' + n + ' 次。<b>已經換了一題</b>，再挑戰一次。');
        }
      }
    }

    /* ── 逐步示範 ────────────────────────────────
       ★ 收在一顆按鈕後面：先自己試，卡住才看。
         一開場就放示範的話，學生會照著示範按 —— 那就沒有在想了。
       ⚠️ 只有循序與二元有；大比拼那一關本來就是一步一步按的。 */
    function demo() {
      var box = host.querySelector('#qs-demo');
      if (!box) return;
      if (mode === 'compare') { box.innerHTML = ''; return; }
      if (dAt < 0) {
        box.className = '';
        box.innerHTML = '<button class="qs-btn" id="qs-dgo" ' +
          'style="background:#0ea5e9;margin:0 0 10px">🐢 看一次逐步示範（用課本的例子）</button>';
        box.querySelector('#qs-dgo').onclick = function () {
          var c = makeCase({ mode: mode, course: 'hit' });
          dSteps = demoSteps(mode, c.items, c.target);
          dAt = 0; render();
        };
        return;
      }
      var st = dSteps[dAt], last = dAt >= dSteps.length - 1;
      box.className = 'qs-demo';
      box.innerHTML =
        '<div class="h">🐢 逐步示範　第 ' + dAt + ' 步 ／ 共 ' + (dSteps.length - 1) + ' 步' +
        (st.n ? '　比較次數 ' + st.n : '') + '</div>' +
        '<div class="say">' + st.note + '</div>' +
        '<div class="row">' +
        (last ? '<button data-d="0">↺ 再看一次</button>'
              : '<button data-d="1">⏭ 下一步</button><button data-d="9">⏩ 一路看完</button>') +
        '<button data-d="-1">關掉示範，自己試</button></div>';
      [].forEach.call(box.querySelectorAll('[data-d]'), function (el) {
        el.onclick = function () {
          var v = Number(el.dataset.d);
          if (v === -1) { dAt = -1; dSteps = null; }
          else if (v === 0) dAt = 0;
          else if (v === 9) dAt = dSteps.length - 1;
          else dAt = Math.min(dAt + 1, dSteps.length - 1);
          render();
        };
      });
    }

    function body() {
      var b = host.querySelector('#qs-body');
      if (mode === 'compare') { b.innerHTML = compareHtml(); wire(b); return; }
      b.innerHTML = (mode === 'binary' ? rangeHtml() : '') +
        '<div class="qs-row">' + items.map(cellHtml).join('') + '</div>' +
        (mode === 'binary' && phase === 'side' && !ended ? sideHtml() : '');
      [].forEach.call(b.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { click(Number(el.dataset.i), el); };
      });
      [].forEach.call(b.querySelectorAll('[data-side]'), function (el) {
        el.onclick = function () { pickSide(el.dataset.side); };
      });
    }

    /* ── 大比拼 ────────────────────────────────────── */
    function compareHtml() {
      var out = '<div class="qs-pick"><span class="lb">資料量</span>' +
        sizes.map(function (n) {
          var cls = (n === size) ? ' class="on"' : (table[n] ? ' class="ok"' : '');
          return '<button data-size="' + n + '"' + cls + '>' +
                 comma(n) + ' 筆' + (table[n] ? ' ✓' : '') + '</button>';
        }).join('') + '</div>';

      out += todoHtml();

      /* ★★ 場景橫幅：老師 2026-08-17「看不出目前操作的是什麼場景應用中」。
         ⚠️ 一定要**明顯**——底色、圖示、大字。
            和內文一樣的字級等於沒有標示（那正是改版前的樣子）。 */
      if (size) {
        var sc = sceneOf(size);
        /* ★★ 老師 2026-08-17：「長條圖與『圖書館藏書』之間感受不到數量的變化」。
           診斷：進度條是**比例** —— 1,024 和 100 萬都從滿格開始，長得一模一樣，
           量級差異在那條圖上完全消失了。
           ⇒ 兩個補救：① 橫幅直接講「是上一個場景的幾倍」
                        ② 範圍條下面畫一條「上一個場景在這裡有多寬」 */
        var pv = prevSize(size);
        out += '<div class="qs-scene"><span class="ic">' + sc.icon + '</span>' +
               '<span class="tx"><b>' + sc.name + '　' + comma(size) + ' ' + sc.unit + '</b>' +
               '<span class="sub">' + sc.what + ' —— ' + sc.ask +
               (pv ? '<br>📈 這是上一個場景（' + sceneOf(pv).name + ' ' + comma(pv) + ' ' +
                     sceneOf(pv).unit + '）的 <b>' + comma(Math.round(size / pv)) + ' 倍</b>' : '') +
               '</span></span></div>';
      }

      if (!size) {
        out += '<div class="qs-left">先選一個資料量 —— 每一種都是一個真實的場景。</div>';
      } else if (left > 0) {
        out += cutView() +
               '<div class="qs-side"><button data-cut="1">✂️ 比一次，砍掉一半</button></div>';
      } else {
        out += '<div class="qs-left">範圍空了 —— 二元搜尋最多比 <b>' + cuts + '</b> 次。</div>' +
               '<div class="qs-cnt big">你按 <b>' + cuts + '</b> 下就砍完了 ' +
               comma(size) + ' ' + sceneOf(size).unit + '。' +
               '<br>一個一個找的話，' + cuts + ' 下才看到第 ' + cuts + ' ' + sceneOf(size).unit +
               ' —— 還剩 <b>' + comma(Math.max(0, size - cuts)) + '</b> ' +
               sceneOf(size).unit + '沒看。</div>';
        /* ★ 砍完之後不要就這樣結束：那 11 下太輕鬆了。
           讓循序搜尋當場跑一次，看它要跑多久。 */
        if (!raced[size]) {
          out += raceOn
            ? raceHtml()
            : goBox('🏁 讓兩種搜尋比一場',
                '你按 <b>' + cuts + '</b> 下就砍完了。那循序搜尋呢？' +
                '它要一項一項往下走 —— <b>看它跑一次</b>。');
        } else {
          out += raceHtml();
        }
      }
      return out + tableHtml() + boomHtml();
    }

    /* ── 砍一半的當下：要看得到「一口氣少掉一半」──────────
       ★ 老師 2026-08-17：「除了按幾下這個動作外…操作端也是點下去，
         感受不夠強烈」——說得對，**按鈕的手感是恆定的**：
         按第 1 下和第 20 下，手指感覺一樣，變化全在一行小字裡。
       ⇒ 三件事一起上：
         ① 範圍條當場崩塌（而且抖一下）—— 看到的是「消失一半」不是「數字變了」
         ② 大字報「這一下排除了幾筆」—— 講動作的成果，不是剩下的狀態
         ③ 旁邊擺**循序搜尋的同步進度** ← 這個最關鍵：
            同樣按 N 下，你砍完了，循序才看到第 N 筆。
            ⚠️ 兩條要用**同一個量度**（還剩幾筆沒找），不然沒得比。
       ⚠️ 不做音效：一班三十台同時響會很吵，而且要多一個開關。
          震動只用 CSS 抖一下，而且 prefers-reduced-motion 要能關掉。 */
    /* ── 還差什麼（老師 2026-08-17 卡在這裡）────────────────
       ⚠️⚠️ 「四個範例都看完了，怎麼不能進入下一階段？」——
          因為通過條件被我加嚴了：每一種資料量要**砍完＋比一場賽跑**，
          最後還要在「資料大爆炸」猜一次。
          而畫面上只有一行小字在講還差什麼 —— 那等於沒講。
       ★ 這是第二次犯同一個錯（第一次是第 9 關的實驗室，
         那次的修法是加「目標＋過關標準」橫幅）。
         ⇒ 條件有幾項，畫面上就要有幾個勾。 */
    function todoHtml() {
      var rows = sizes.map(function (n) {
        var sc = sceneOf(n);
        var st = raced[n] ? 'ok' : (table[n] ? 'half' : '');
        var note = raced[n] ? '完成' : (table[n] ? '還沒比賽跑' : '還沒砍');
        return '<li class="' + st + '">' + (raced[n] ? '✅' : '⬜') + ' ' +
               sc.icon + ' ' + sc.name + '（' + comma(n) + ' ' + sc.unit + '）' +
               '<span>' + note + '</span></li>';
      });
      var allRaced = sizes.every(function (n) { return raced[n]; });
      rows.push('<li class="' + (boomDone ? 'ok' : '') + '">' +
        (boomDone ? '✅' : '⬜') + ' 💥 資料大爆炸：猜一次' +
        '<span>' + (boomDone ? '完成' : (allRaced ? '就差這個了' : '四種跑完才會出現')) +
        '</span></li>');
      var done = sizes.filter(function (n) { return raced[n]; }).length + (boomDone ? 1 : 0);
      return '<div class="qs-todo"><div class="th">這一步要完成 ' +
             done + ' / ' + (sizes.length + 1) + '</div><ul>' + rows.join('') + '</ul></div>';
    }

    /** 上一個（比較小的）資料量 —— 拿來當量級的參考尺 */
    function prevSize(n) {
      var i = sizes.indexOf(n);
      return i > 0 ? sizes[i - 1] : 0;
    }

    function cutView() {
      var sc = sceneOf(size);
      var U = sc.unit;                               // 量詞跟著場景走（首歌／本書／位同學）
      var seqLeft = Math.max(0, size - cuts);        // 循序：按了幾下就只看了幾筆
      var pctBin = size ? left / size * 100 : 0;
      var pctSeq = size ? seqLeft / size * 100 : 0;
      var justCut = cuts > 0 ? Math.round(size / Math.pow(2, cuts - 1)) - left : 0;
      return '<div class="qs-cut">' +
        (cuts > 0
          ? '<div class="boom">這一下排除了 <b>' + comma(justCut) + '</b> ' + U + '</div>'
          : '<div class="boom idle">按下去 —— 看它一口氣少掉多少</div>') +
        '<div class="qs-two">' +
          '<div class="row me">' +
            '<div class="lb">你（每次砍一半）<span>還剩 ' + comma(left) + ' ' + U + '</span></div>' +
            '<div class="bar"><div class="fill' + (cuts > 0 ? ' hit' : '') +
              '" style="width:' + pctBin + '%"></div></div>' +
          '</div>' +
          '<div class="row seq">' +
            '<div class="lb">一個一個找<span>還剩 ' + comma(seqLeft) + ' ' + U + '</span></div>' +
            '<div class="bar"><div class="fill" style="width:' + pctSeq + '%"></div></div>' +
          '</div>' +
        '</div>' +
        scaleHtml() +
        '<div class="qs-cnt">已經比了 <b>' + cuts + '</b> 次' +
          (cuts > 0 ? '　—— 一個一個找的話，' + cuts + ' 次才看到第 ' + cuts + ' ' + U : '') +
        '</div></div>';
    }

    /* ── 量級的參考尺 ─────────────────────────────────
       ★ 進度條只表示「比例」，所以 1,024 和 100 萬看起來一樣長。
         ⇒ 在同一條軸上畫出「上一個場景」有多寬 ——
           在 100 萬本的圖書館裡，那本 1,024 頁的字典只有 0.1%，
           細到幾乎看不見。**那條看不見的線就是量級差異本身。** */
    function scaleHtml() {
      var pv = prevSize(size);
      if (!pv || !size) return '';
      var pct = pv / size * 100;
      var ps = sceneOf(pv);
      return '<div class="qs-scale">' +
        '<div class="mini"><div class="seg" style="width:' + Math.max(0.15, pct) + '%"></div></div>' +
        '<div class="cap">↑ 上一個場景（' + ps.icon + ' ' + ps.name + ' ' + comma(pv) + ' ' +
        ps.unit + '）在這條線上就這麼寬 —— <b>' +
        (pct < 1 ? '不到 1%' : pct.toFixed(0) + '%') + '</b></div></div>';
    }

    /* ── 資料大爆炸：先猜再揭曉，然後自己填 ─────────────
       ⚠️ 這一段在四種資料量都跑完之後才出現 ——
          先有小數字的直覺，大數字才會震撼。 */
    function boomHtml() {
      var allRaced = sizes.every(function (n) { return raced[n]; });
      if (!allRaced) return '';
      var ans = worstBinary(BOOM_ASK.n);
      var out = '<div class="qs-boom"><div class="bh">💥 資料大爆炸</div>';

      if (!boomDone) {
        /* ★ 先猜。⚠️ 不給選項 —— 選項會把答案的量級洩漏出去。 */
        out += '<div class="bq">' + BOOM_ASK.label + '有 <b>' + BOOM_ASK.note.replace('約 ', '') +
               '</b>。如果全部照身高排好，用<b>二元搜尋</b>找一個人，' +
               '最多要比<b>幾次</b>？<br><span class="sub">先猜一個數字 —— 猜錯沒關係，這一題就是要你猜。</span></div>' +
               '<div class="brow"><input id="qs-boom-in" type="number" min="1" placeholder="你猜幾次？">' +
               '<button data-boom="guess">送出</button></div>';
        if (boomGuess != null) {
          var diff = boomGuess > ans ? Math.round(boomGuess / ans) : 0;
          out += '<div class="bmsg">你猜 <b>' + comma(boomGuess) + '</b> 次。' +
                 (diff >= 10 ? '差得有點多喔 —— 再猜一次，往<b>小</b>的想。' : '接近了，再試一次。') +
                 '</div>';
        }
      } else {
        /* ★ 這是整個第 10 關最重要的一句 —— 螢光筆就該畫在這裡。 */
        out += '<div class="bwin">答案是 ' + hl(ans + ' 次') + '。' +
               (boomGuess != null ? '（你猜 ' + comma(boomGuess) + ' 次）' : '') +
               '<br>' + BOOM_ASK.note + '，一個一個找最多要比 ' + hlb(comma(BOOM_ASK.n)) +
               ' 次；每次砍一半，' + hlb(ans) + ' 次就找到了。</div>' +
               boomTable();
      }
      return out + '</div>';
    }

    /* 自己填任意資料量 —— 想多大就多大 */
    function boomTable() {
      var n = boomN || BOOM_ASK.n;
      var seq = worstSequential(n), bin = worstBinary(n);
      /* ⚠️ 時間換算的前提要寫出來：假設電腦每秒比一百萬次（PER_SEC）。
         不寫的話，這幾個秒數就是憑空冒出來的數字。 */
      var fmt = function (times) {
        var sec = times / PER_SEC;
        if (sec < 0.001) return '不到千分之一秒';
        if (sec < 1) return (sec * 1000).toFixed(1) + ' 毫秒';
        if (sec < 60) return sec.toFixed(1) + ' 秒';
        if (sec < 3600) return (sec / 60).toFixed(1) + ' 分鐘';
        return (sec / 3600).toFixed(1) + ' 小時';
      };
      return '<div class="bpick">' +
        BOOM.map(function (b) {
          return '<button data-boomn="' + b.n + '"' + (n === b.n ? ' class="on"' : '') + '>' +
                 b.label + '</button>';
        }).join('') +
        '<input id="qs-boom-n" type="number" min="1" placeholder="自己填一個數字" value="' + n + '">' +
        '<button data-boomn="0">算算看</button></div>' +
        '<div class="bres">' +
        '<div class="one"><span class="lb">資料量</span><span class="vl">' + comma(n) + '</span></div>' +
        '<div class="one hot"><span class="lb">循序搜尋</span><span class="vl">' + comma(seq) + ' 次</span>' +
          '<span class="sub">' + fmt(seq) + '</span></div>' +
        '<div class="one cool"><span class="lb">二元搜尋</span><span class="vl">' + bin + ' 次</span>' +
          '<span class="sub">' + fmt(bin) + '</span></div>' +
        '</div>' +
        '<div class="bnote">⚠️ 時間是假設電腦<b>每秒比一百萬次</b>換算出來的，' +
        '不同電腦會差很多 —— 但<b>兩邊的比例是真的</b>。</div>';
    }

    function comma(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    /* ── 螢光筆與「按這裡」──────────────────────────────
       ★ 兩支筆的樣式在 shared/theme.css（黃＝結論、藍＝數量）——
         這裡**不要**再寫一份，兩份會慢慢長得不一樣。
       ⚠️ 一段最多兩三處。畫太多等於沒畫。 */
    function hl(t) { return '<span class="hl">' + t + '</span>'; }
    function hlb(t) { return '<span class="hl-b">' + t + '</span>'; }

    /* ⚠️ 老師 2026-08-18 說排序那顆播放鈕「太不明顯，找很久才發現」——
       這一顆是同一種毛病、只是輕一級：它和上面的資料量按鈕長得一模一樣。
       ⇒ 主要動作要自己佔一塊，而且兩個實驗室的入口長得一樣
         （學生在排序那邊學會的「找那個大按鈕」，到這邊要能繼續用）。 */
    function goBox(label, cap) {
      return '<div class="qs-go"><button data-race="1">' + label + '</button>' +
             '<div class="cap">' + cap + '</div></div>';
    }

    /* ── 賽跑：同一批資料，兩種搜尋同時起跑 ──────────────
       ⚠️ 二元那一邊幾乎瞬間結束，循序那一邊要爬很久 ——
          **那個落差就是這一步唯一要給的東西**。
       ⚠️ 不給「跳過」：跳過等於沒體驗。但小資料量（13 筆）本來就很快，
          所以真正要等的只有 1024 那一次。 */
    function raceHtml() {
      var seqMax = worstSequential(raceN), binMax = table[raceN] || worstBinary(raceN);
      var big = raceN > RACE_MAX;          // 大資料量：逐次跑不動，改看時間比例
      var lane = function (cls, name, now, max) {
        var pct = max ? Math.min(100, now / max * 100) : 0;
        return '<div class="qs-lane ' + cls + (now >= max ? ' done' : '') + '">' +
               '<div class="nm"><span>' + name + '</span>' +
               '<span class="ct">' + comma(now) + ' / ' + comma(max) + ' 次' +
               (now >= max ? '　✅' : '') + '</span></div>' +
               '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div></div>';
      };
      var out = '<div class="qs-race"><div class="rh">🏁 ' + comma(raceN) +
        ' 筆資料，最倒楣的情況</div>';
      /* ★★ 老師 2026-08-17：「在一整排資料中找到資料？」
         ⚠️ 進度條只講「比了幾次」，看不到**資料**發生什麼事。
         ★ 資料量小的時候直接把整排畫出來：
             循序 —— 一格一格往右走，走過的變灰
             二元 —— 跳到中間，被砍掉的那一半整片變灰
           那個「一次刷掉一半」的畫面，是進度條給不了的。
         ⚠️ 大資料量一筆一格畫不下（一億格）——
            但**不畫**的結果是四種資料量裡只有 13 筆有畫面
            （2026-08-18 老師：「只有一個動畫嗎？」）。
         ⇒ 改成一格代表好幾筆，四種資料量都畫得出同一種畫面。 */
      {
        var per = cellSpan(raceN);
        out += '<div class="qs-cells">' +
          (per > 1 ? '<div class="scale">一格 = ' + comma(per) + ' ' +
                     sceneOf(raceN).unit + '（' + comma(raceN) + ' ' +
                     sceneOf(raceN).unit + '畫成 ' + Math.ceil(raceN / per) + ' 格）</div>' : '') +
          '<div class="cl"><span class="nm">循序搜尋：一個一個看</span>' +
          cellsSeq(raceN, raceSeq) + '</div>' +
          '<div class="cl"><span class="nm">二元搜尋：每次砍一半</span>' +
          cellsBin(raceN, raceBin) + '</div></div>';
      }
      out +=
        lane('bin', '二元搜尋（每次砍一半）', raceBin, binMax) +
        lane('seq', '循序搜尋（一個一個看）', raceSeq, seqMax);
      if (raceOn === 2) {
        /* ★ 老師 2026-08-18：「結論要加上螢光筆畫線記號…這樣學生在看完大量資料後
           才會更有感受。」→ 只畫三處：兩個次數（藍）＋ 那個倍數（黃）。
           ⚠️ 倍數才是結論 —— 「1,000,000 和 20」是資料，「差 5 萬倍」才是意思。 */
        out += '<div class="win">跑完了：循序 ' + hlb(comma(seqMax)) + ' 次、二元 ' +
               hlb(binMax) + ' 次 —— ' +
               hl('差 ' + comma(Math.round(seqMax / binMax)) + ' 倍') + '。' +
               '<br>你剛才按 ' + cuts + ' 下就結束了；循序那一條，你等了多久？</div>' +
        /* ★ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
           ⚠️ 跑完之後畫面就停在最後一格，而且沒有任何再看一次的入口 ——
              換一種資料量再換回來也只剩靜止的結果。
              一段只能看一次、而且要 15 下才走得到的動畫，等於沒有。 */
          '<div class="qs-side"><button data-race="1">↺ 再放一次動畫</button></div>';
      }
      /* ⚠️⚠️ 這一句一定要在：不講的話學生會以為電腦搜尋真的要跑好幾秒。 */
      out += big
        ? ('<div class="note">⚠️ ' + comma(raceN) + ' 筆沒辦法一次一次畫給你看 ——' +
           '循序那一條要跑 ' + comma(seqMax) + ' 次，' +
           '照前面 13 筆的速度得畫 <b>' +
           Math.round(seqMax * CELL_MS / 3600000) + ' 小時</b>。' +
           '<br>所以這一條是<b>照時間比例快轉</b>的：兩邊誰先到、差多少，都是真的。</div>')
        : ('<div class="note">⚠️ 這裡把每一次比較放慢成 ' + CELL_MS +
           ' 毫秒，你才看得到它在跑。真的電腦一秒可以比<b>幾百萬次</b> —— ' +
           '但<b>兩邊的比例是真的</b>。</div>');
      return out + '</div>';
    }

    /** 一格代表幾筆資料。★ 小資料量一格一筆；大資料量壓縮成 CELL_MAX 格。 */
    function cellSpan(n) { return n <= CELL_MAX ? 1 : Math.ceil(n / CELL_MAX); }

    /* 把一排格子畫出來。cls(lo, hi) 收「這一格涵蓋第 lo～hi 筆」，回傳樣式。
       ⚠️ 兩種搜尋共用同一支 —— 兩排的格子數與寬度一定要一樣，
          不然「循序走了三格、二元已經砍掉一半」這件事沒得比。 */
    function cellRow(n, cls) {
      var per = cellSpan(n), cnt = Math.ceil(n / per), out = '<div class="row">';
      for (var i = 0; i < cnt; i++) {
        var lo = i * per + 1, hi = Math.min(n, (i + 1) * per);
        out += '<span class="c ' + cls(lo, hi) + '"></span>';
      }
      return out + '</div>';
    }

    /* 一排格子：循序搜尋走到第 k 筆（走過的變灰，正在看的那一格亮起來） */
    function cellsSeq(n, k) {
      return cellRow(n, function (lo, hi) {
        if (hi < k) return 'gone';
        return (k >= lo && k <= hi) ? 'now' : '';
      });
    }
    /* 一排格子：二元搜尋比到第 k 次時，範圍剩哪一段（被砍掉的整片變灰） */
    function cellsBin(n, k) {
      var lo = 1, hi = n, mid = 0;
      for (var t = 0; t < k && lo <= hi; t++) {
        mid = Math.floor((lo + hi) / 2);
        /* 最倒楣的情況：目標一直在右半（和 worstBinary 的算法一致） */
        lo = mid + 1;
      }
      return cellRow(n, function (a, b) {
        if (b < lo || a > hi) return 'gone';
        return (mid >= a && mid <= b) ? 'now' : '';
      });
    }

    /** 這一種資料量是「一次一次畫」還是「照時間比例快轉」 */
    function slowRace(n) { return n <= RACE_MAX; }
    /** 逐次模式每一步停多久（測試把 stepMs 設成 0 時整段同步跑完） */
    function raceMs(n) {
      if (!STEP_MS) return 0;
      return slowRace(n) ? CELL_MS : STEP_MS;
    }

    function startRace() {
      if (!size || raceTimer) return;
      raceN = size; raceSeq = 0; raceBin = 0; raceOn = 1;
      var seqMax = worstSequential(raceN), binMax = table[raceN] || worstBinary(raceN);
      var ms = raceMs(raceN);
      if (!ms) {                            // 測試用：直接跑完
        raceSeq = seqMax; raceBin = binMax; raceOn = 2; raced[raceN] = true;
        body(); maybePass(); return;
      }
      /* ★ 一次要往前跳幾次比較。
         小資料量：1（真的一次一次畫，那個等待就是重點）。
         大資料量：一百萬次逐次畫要 100 分鐘 —— 那不是慢，是跑不完。
         ⇒ 改成「總共跑 RACE_SEC 秒」，每一幀跳一大段。 */
      var frames = Math.max(1, Math.round(RACE_SEC * 1000 / ms));
      var stepSeq = slowRace(raceN) ? 1 : seqMax / frames;
      /* ★★ 二元那一邊**不跟循序同一個步進**。
         ⚠️ 跟同一個的話，一億筆的 27 次會在 0.16 秒內走完 ——
            「每次砍一半」那幾刀根本看不到，而那正是要給的畫面。
         ⇒ 給它自己的一段時間（BIN_SEC），仍然遠早於循序結束。 */
      var binFrames = Math.max(1, Math.round(BIN_SEC * 1000 / ms));
      var stepBin = slowRace(raceN) ? 1 : binMax / binFrames;
      /* ⚠️ 步進可能小於 1（例如 27／300）——
         直接對 raceBin 做 Math.round(raceBin + 0.09) 的話它永遠停在 0。
         ⇒ 用浮點累加器記真正的進度，畫面上才取整數。 */
      var accSeq = 0, accBin = 0;
      /* ⚠️ 兩邊用同一個計時器：不然「同時起跑」這件事會不成立。 */
      raceTimer = setInterval(function () {
        accSeq = Math.min(seqMax, accSeq + stepSeq); raceSeq = Math.round(accSeq);
        accBin = Math.min(binMax, accBin + stepBin); raceBin = Math.round(accBin);
        if (raceSeq >= seqMax && raceBin >= binMax) {
          clearInterval(raceTimer); raceTimer = null;
          raceOn = 2; raced[raceN] = true;
          body();
          maybePass();
          return;
        }
        body();
      }, ms);
      body();
    }

    /* ★ 累積成一張表，讓差距自己長出來。
       只跑一種資料量看不出什麼；跑到 1024 筆那一列時，
       1024 對 11 —— 那個對比不必解釋。 */
    function tableHtml() {
      var done = sizes.filter(function (n) { return table[n]; });
      if (!done.length) return '';
      return '<table class="qs-tbl"><tr><th>資料量</th>' +
             '<th>循序搜尋<br>最多比幾次</th><th>二元搜尋<br>最多比幾次</th></tr>' +
             done.map(function (n) {
               return '<tr><td>' + comma(n) + ' 筆</td>' +
                      '<td class="big">' + comma(worstSequential(n)) + '</td>' +
                      '<td class="small">' + table[n] + '</td></tr>';
             }).join('') + '</table>';
    }

    function wire(b) {
      [].forEach.call(b.querySelectorAll('[data-size]'), function (el) {
        el.onclick = function () { startSize(Number(el.dataset.size)); };
      });
      [].forEach.call(b.querySelectorAll('[data-cut]'), function (el) {
        el.onclick = cut;
      });
      [].forEach.call(b.querySelectorAll('[data-race]'), function (el) {
        el.onclick = startRace;
      });
      [].forEach.call(b.querySelectorAll('[data-boom]'), function (el) {
        el.onclick = boomAnswer;
      });
      [].forEach.call(b.querySelectorAll('[data-boomn]'), function (el) {
        el.onclick = function () {
          var v = Number(el.dataset.boomn);
          if (!v) {
            var box = b.querySelector('#qs-boom-n');
            v = Math.max(1, Math.min(1e12, Math.floor(Number(box && box.value) || 0)));
            if (!v) return;
          }
          boomN = v; body();
        };
      });
    }

    function startSize(n) {
      /* ⚠️ 換資料量要把上一輪的賽跑收乾淨 ——
         計時器沒清掉的話，它會繼續在背景跑並且畫到新的畫面上。 */
      if (raceTimer) { clearInterval(raceTimer); raceTimer = null; }
      raceOn = 0; raceSeq = 0; raceBin = 0;
      size = n; left = n; cuts = 0;
      /* ⚠️ 點回一種**已經砍完**的資料量時，這裡把 cuts 清成 0 ——
         等於要學生把 27 下重按一遍才回得到賽跑那一段。
         而賽跑的狀態也被清成 0，畫面上會出現一組**空的**格子與進度條。
         ⇒ 砍完過就還原成砍完的樣子；跑完過就還原成跑完的樣子，
           「↺ 再放一次」才有東西可回。 */
      if (table[n]) { cuts = table[n]; left = 0; }
      if (raced[n]) {
        raceN = n; raceOn = 2;
        raceSeq = worstSequential(n); raceBin = table[n] || worstBinary(n);
      }
      body();
      if (raced[n]) {
        say('good', '這一種你跑過了。想再看一次動畫的話，按下面的' +
                    '<b>「↺ 再放一次動畫」</b>。');
      } else if (table[n]) {
        say('good', '這一種你砍完了，還沒看賽跑 —— 按下面的<b>「🏁 讓兩種搜尋比一場」</b>。');
      } else {
        say('bad', '假設最倒楣的情況：目標在最後才找到，或根本不在裡面。' +
                   '<br>一直按下去，看看要按幾下才砍完 <b>' + comma(n) + '</b> 筆。');
      }
    }

    function cut() {
      if (!size || left <= 0) return;
      cuts++;
      left = afterCut(left);         // 比完中間那筆，剩下的不含它
      if (left > 0) {
        body();
        say('good', '比了第 ' + cuts + ' 次，範圍剩 <b>' + comma(left) + '</b> 筆。');
        return;
      }
      table[size] = cuts;
      body();
      var seq = worstSequential(size);
      say('good', '<b>' + comma(size) + '</b> 筆資料：循序搜尋最多要比 <b>' + comma(seq) + '</b> 次，' +
                  '二元搜尋只要 <b>' + cuts + '</b> 次。' +
                  (seq >= cuts * 20
                    ? '<br>⚠️ 資料量是比較次數的 <b>' + comma(Math.round(seq / cuts)) + '</b> 倍 —— ' +
                      '那就是「每次砍一半」的威力。'
                    : ''));
      maybePass();
    }

    /* 開始位置／結束位置／位置 —— 課本每一回合都寫這三個數字，
       學生要跟著算，所以畫面上一定要看得到。
       ⚠️ 名字用**範例檔**的（老師 2026-08-17 決定：一律跟 .sb3 走）。
          課本 p.208 把它叫「二分位置」—— 所以下面留一句對照，
          不然學生翻課本會以為是兩個不同的東西。 */
    function rangeHtml() {
      if (ended) return '';
      return '<div class="qs-range">第 <b>' + (tried + (phase === 'side' ? 0 : 1)) +
             '</b> 回合　開始位置：<b>' + lo + '</b>　結束位置：<b>' + hi + '</b>' +
             (phase === 'side'
               ? '　位置：<b>' + mid + '</b>（第 ' + mid + ' 項是 ' + esc(items[mid - 1]) + '）'
               : '　位置：<b>？</b>　←　自己算，然後點那一項') +
             '</div>';
    }

    function cellHtml(v, i) {
      var cls = 'qs-cell', n = i + 1;
      /* ★ 示範開著的時候，格子跟著示範走 ——
         不然畫面在講第 3 步，格子卻停在學生自己按到的地方。 */
      if (dAt >= 0 && dSteps) {
        var st = dSteps[dAt];
        if (mode === 'binary') {
          if (st.mid === n) cls += (st.found ? ' hit' : ' now');
          else if (n < st.lo || n > st.hi) cls += ' cut';
        } else {
          if (st.at === n) cls += (st.found ? ' hit' : ' now');
          else if (st.at && n < st.at) cls += ' past';
        }
        return '<div class="qs-box"><span class="qs-idx">第 ' + n + ' 項</span>' +
               '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button></div>';
      }
      if (mode === 'binary') {
        if (ended && n === mid && String(v) === String(target)) cls += ' hit';
        else if (n < lo || n > hi) cls += ' cut';        // 被砍掉的那一半：劃掉，但看得見
        else if (n === mid && phase === 'side') cls += ' now';
      } else {
        if (ended && i === next && String(v) === String(target)) cls += ' hit';
        else if (i < next) cls += ' past';
        else if (i === next && !ended) cls += ' now';
      }
      return '<div class="qs-box"><span class="qs-idx">第 ' + n + ' 項</span>' +
             '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button></div>';
    }

    function sideHtml() {
      return '<div class="qs-side">' +
             '<button data-side="left">◀ 取前（左）半部</button>' +
             '<button data-side="right">取後（右）半部 ▶</button></div>';
    }

    function count() {
      var c = host.querySelector('#qs-cnt');
      if (c) c.innerHTML = '　比較次數：<b>' + tried + '</b>';
    }
    function say(kind, msg) {
      var m = host.querySelector('#qs-msg');
      m.className = 'qs-msg ' + kind;
      m.innerHTML = (kind === 'good' ? '✓ ' : kind === 'bad' ? '✗ ' : '· ') + msg;
    }
    function flash(el) {
      if (!el) return;
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 650);
    }

    function click(i, el) {
      if (ended) return;
      if (mode === 'binary') return clickBinary(i, el);
      var r = checkSequential(items, next, i);
      if (!r.ok) { errs++; flash(el); say('bad', r.msg); return; }

      tried++;
      var s = stepResult(items, target, i);
      if (s.found) {
        ended = true; sawHit = true;
        body(); count();
        say('good', '找到了 —— <b>' + esc(target) + '</b> 在第 <b>' + (i + 1) + '</b> 項。' +
                    '總共比了 <b>' + tried + '</b> 次。' +
                    '<br>⚠️ 找到就<b>停</b>，後面那幾項不必再比。');
        maybePass();
        return;
      }
      if (s.done) {
        /* ★ 全部比完都沒有 —— 課本明講的另一條路 */
        ended = true; sawMiss = true;
        next = i + 1;
        body(); count();
        say('none', '全部 <b>' + items.length + '</b> 項都比過了，沒有 <b>' + esc(target) + '</b>。' +
                    '<br>這叫<b>查無此資料</b> —— 迴圈就是走到這裡才停的。');
        maybePass();
        return;
      }
      next = i + 1;
      body(); count();
      say('bad', '第 ' + (i + 1) + ' 項是 ' + esc(items[i]) + '，不是目標 ' + esc(target) +
                 ' —— 往下一個。');
    }

    /* ── 二元搜尋：一回合分兩步 ─────────────────────────
       ① 點二分位置（自己算（開始＋結束）÷2）
       ② 決定砍哪一半
       ⚠️ 兩步分開是刻意的。合成一步（點了就自動砍）的話，
          學生只練到「會算中間位置」，而「比中間值大就往右」
          那個判斷完全沒被考到 —— 那才是二元搜尋的核心。 */
    function clickBinary(i, el) {
      if (phase === 'side') {
        say('bad', '先決定要砍掉哪一半 —— 下面兩顆按鈕。');
        return;
      }
      var r = checkMid(lo, hi, i + 1);
      if (!r.ok) { errs++; flash(el); say('bad', r.msg); return; }

      mid = i + 1;
      tried++;
      var s = sideOf(items[mid - 1], target);
      if (s === 'hit') {
        ended = true; sawHit = true;
        body(); count();
        say('good', '找到了 —— <b>' + esc(target) + '</b> 在第 <b>' + mid + '</b> 項。' +
                    '總共只比了 <b>' + tried + '</b> 次。' +
                    '<br>⚠️ 資料有 ' + items.length + ' 筆，循序搜尋要比 ' +
                    countSequential(items, target) + ' 次 —— 差別就在每回合砍掉一半。');
        maybePass();
        return;
      }
      phase = 'side';
      body(); count();
      say('bad', '第 ' + mid + ' 項是 <b>' + esc(items[mid - 1]) + '</b>，' +
                 (Number(items[mid - 1]) < Number(target) ? '比目標<b>小</b>' : '比目標<b>大</b>') +
                 ' —— 那目標會在哪一半？');
    }

    function pickSide(pick) {
      if (ended || phase !== 'side') return;
      var want = sideOf(items[mid - 1], target);
      if (pick !== want) {
        errs++;
        /* ★ 砍錯邊 = 把目標砍掉了。這裡要講清楚後果，不只是說「錯」——
           因為錯的代價（永遠找不到）正是「資料要先排序」的理由。 */
        say('bad', '砍錯邊了。第 ' + mid + ' 項是 ' + esc(items[mid - 1]) +
                   '，資料<b>由小到大</b>排好 —— ' +
                   '比目標小的話，目標只可能在它<b>右邊</b>；比目標大就在<b>左邊</b>。' +
                   '<br>砍錯的話，目標就被你丟掉了，之後再怎麼找都找不到。');
        return;
      }
      var r = narrow(lo, hi, mid, want);
      lo = r.lo; hi = r.hi;
      phase = 'pick';

      if (empty(lo, hi)) {
        /* ★ 開始位置大於結束位置 → 查無此資料（課本 p.211） */
        ended = true; sawMiss = true;
        mid = 0;
        body(); count();
        say('none', '開始位置（' + lo + '）已經<b>大於</b>結束位置（' + hi + '）' +
                    '—— 範圍空了，沒有 <b>' + esc(target) + '</b>。' +
                    '<br>這叫<b>查無此資料</b>。二元搜尋的迴圈就是走到這裡才停的。');
        maybePass();
        return;
      }
      body(); count();
      say('good', '砍掉一半了。剩下第 <b>' + lo + '</b> ～ <b>' + hi + '</b> 項（' +
                  (hi - lo + 1) + ' 筆）—— 再算一次位置。');
    }

    /* 猜的那一題：★ 猜錯不擋 —— 它的作用是「猜過」，不是「猜對」。
       ⚠️ 但也不能一按就過：空白或亂填要擋，不然學生按兩下就跳過去了。 */
    function boomAnswer() {
      var box = host.querySelector('#qs-boom-in');
      var v = Math.floor(Number(box && box.value) || 0);
      if (!v || v < 1) { say('bad', '先填一個數字再送出 —— 猜錯真的沒關係。'); return; }
      var ans = worstBinary(BOOM_ASK.n);
      boomGuess = v;
      /* 猜得離譜（十倍以上）給一次修正的機會；再猜一次就揭曉。 */
      if (Math.abs(v - ans) > ans * 9 && !boomDone && boomGuess !== null && !boomAnswer._retried) {
        boomAnswer._retried = true;
        body();
        say('bad', '差滿多的 —— 再猜一次。提示：每比一次就少掉一半。');
        return;
      }
      boomDone = true;
      body();
      say('good', BOOM_ASK.note + '，二元搜尋最多只要 <b>' + ans + '</b> 次。' +
                  '<br>下面可以自己填數字 —— 填多大都行。');
      maybePass();
    }

    function maybePass() {
      /* ★ 挑戰開著的時候，走完一題要先結算挑戰。
         ⚠️ 放在 maybePass 開頭 —— 三個「這一題結束了」的出口都會經過這裡，
            各自呼叫的話一定會漏掉其中一個。 */
      if (lvNow && lvNow <= 3) { afterRound(); return; }
      if (passed) return;

      if (mode === 'compare') {
        /* ★ 每一種資料量都要跑過。
           ⚠️ 只跑 13 筆的話，4 對 13 —— 差距不夠大，
              學生會覺得「好像也沒差多少」。
              一定要走到最大那一個，1024 對 11 才有感覺，
              而那正是這一關存在的理由。 */
        /* ⚠️⚠️ 2026-08-17 改：條件從「砍完」改成「賽跑也跑完」。
           老師試跑時說「一直按下一步就過了，沒有體驗到差距」——
           原因就在這裡：砍一半只要按 11 下，那是**快的那一邊**，
           而循序搜尋那 1024 次學生一次都沒經歷過。
           ⇒ 要看著循序跑完一次才算走過這一種資料量。 */
        /* ★ 最後一關卡：資料大爆炸那一題要猜過。
           ⚠️ 猜「對」不是條件 —— 猜錯照樣過。要的是他先給一個數字，
              才會對 25 這個答案有反應。 */
        if (sizes.every(function (n) { return raced[n]; }) && !boomDone) {
          say2('最後一件事：下面「💥 資料大爆炸」那一題先猜一個數字。');
          return;
        }
        var miss = sizes.filter(function (n) { return !raced[n]; });
        if (miss.length) {
          var cut0 = sizes.filter(function (n) { return table[n] && !raced[n]; });
          say2(cut0.length
            ? ('' + cut0[0] + ' 筆你砍完了，但還沒看它們比一場 —— 按「🏁 讓兩種搜尋比一場」。')
            : ('還有 ' + miss.join('、') + ' 筆沒跑。' +
               '資料愈多差距愈大 —— 跑到最大那一個才看得出來。'));
          return;
        }
        openTest();
        return;
      }

      /* 找得到、找不到兩種都遇過才算走完一輪。 */
      if (!(sawHit && sawMiss)) {
        var need = sawHit ? '找<b>不到</b>' : '找<b>得到</b>';
        say2('還差一種情況：再換一題，試一次' + need + '的。' +
             '兩條路都走過，才知道迴圈為什麼需要結束條件。');
        return;
      }
      openTest();
    }

    /* ── 驗收挑戰：自由玩過了才開 ──────────────────
       ★ 「照規則走完」只證明他**會操作**。
         真正的證據是：動手之前先說得出「這一題要比幾次」。
       三個難度的定義在 shared/labtest.js（三支實驗室共用）。
       ⚠️ 大比拼沒有挑戰 —— 它本來就是一步一步按著數的，
          再加一層等於同一件事做兩次。 */
    function openTest() {
      if (freePassed) return;
      freePassed = true;
      if (mode === 'compare' || !global.LABTEST) { finishAll(); return; }
      lvNow = 1;
      aidN = TESTS[mode] ? TESTS[mode].worstSize : 0; aidC = 0;
      /* ⚠️⚠️ 挑戰第 1 關要學生「先別動手，猜這一題要比幾次」——
         但走到這裡的時候，手上那一題**剛剛才被他走完**：
           · 答案就寫在畫面上（他自己數過的次數），這一關等於白出
           · 而且題目已經結束，「現在真的走一遍」根本走不了 ——
             他只能去按「換一題」，然後拿**舊題目的猜測**去驗**新題目**，
             於是一直被判錯，看起來就像「題目沒換／系統壞了」。
         ⇒ 開挑戰的時候自己換一題。訊息說要換，那就真的換。 */
      reset(freshCase());
      dAt = -1; dSteps = null; errs = 0;
      render();
      /* ⚠️ 一定要講明這是**通關條件**。
         2026-08-17 老師試跑時卡住：自由玩走了三次還是不能往下一步，
         因為放行的開關（onPass）只在挑戰第 3 關答對時才會被扳動 ——
         而畫面上從來沒說過「三關全過才放行」。
         學生只會以為系統壞了，然後一直重玩自由玩那一段。 */
      say('good', '自由玩的部分過了 ✔<br><b>接下來是驗收挑戰</b> —— 三關，一關一顆星。' +
                  '<br>⚠️ <b>三關全過</b>才能進入下一步（實作測試）。');
    }
    function finishAll() {
      if (passed) return;
      passed = true;
      if (opts.onPass) opts.onPass(stars());
    }
    function stars() {
      return global.LABTEST ? global.LABTEST.starsOf(cleared) : 0;
    }
    function say2(extra) {
      var m = host.querySelector('#qs-msg');
      if (m) m.innerHTML += '<br>· ' + extra;
    }

    return {
      /* ⚠️ 賽跑的計時器一定要停：離開這一步之後它還會繼續跑，
         而且會去畫一個已經被清空的畫面。 */
      destroy: function () {
        if (raceTimer) { clearInterval(raceTimer); raceTimer = null; }
        host.innerHTML = '';
      },
      _state: function () {
        return { items: items, target: target, next: next, tried: tried,
                 lo: lo, hi: hi, phase: phase, mid: mid,
                 size: size, left: left, cuts: cuts, table: table,
                 ended: ended, sawHit: sawHit, sawMiss: sawMiss, passed: !!passed };
      }
    };
  }

  global.SEARCHLAB = {
    VERSION: VERSION,
    INFO: INFO,
    mount: mount,
    _checkSequential: checkSequential,
    _stepResult: stepResult,
    _countSequential: countSequential,
    _midOf: midOf,
    _checkMid: checkMid,
    _sideOf: sideOf,
    _narrow: narrow,
    _empty: empty,
    _countBinary: countBinary,
    _demoSteps: demoSteps,
    TESTS: TESTS,
    /**
     * 這一步的「目標」與「過關標準」（關卡頁畫在最前面那條橫幅）。
     * ★ 為什麼寫在模組裡，不寫在關卡頁
     *   通過條件本來就是模組自己決定的（見 openTest／finishAll）。
     *   關卡頁再抄一份的話，改了一邊另一邊不會跟 ——
     *   而學生看到的是關卡頁那一份，也就是**錯的那一份**。
     * ⚠️ 2026-08-17 老師卡在第 9 關就是因為畫面上沒寫通過條件。
     */
    goal: function (lab) {
      var m = (lab && lab.mode) || 'sequential';
      if (m === 'compare') {
        /* ⚠️ 這幾個數字要跟著 SIZES 走 —— 2026-08-18 查到這裡還寫著
           「13、50、100、1024」，那是**改資料量之前**的舊名單。
           橫幅是學生最先看到的一段，寫錯等於一開始就指錯路。
           ⇒ 直接從 SIZES 印出來，不要再手打一份。 */
        return { why: '循序和二元到底差多少？用<b>同一批資料</b>跑兩種搜尋，' +
                      '資料愈多差距愈明顯 —— 這一步是要你親眼看到那個差距。' +
                      '<br>⚠️ 砍一半你按二十幾下就結束了，' +
                      '但循序搜尋那幾百萬次是什麼感覺？<b>看它跑一次</b>。' +
                      /* ★ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
                         ⇒ 在最上面的橫幅就把入口講出來。 */
                      '<br>🎬 <b>動畫在哪裡</b>：選一個資料量 → 一直按「✂️ 比一次，砍掉一半」' +
                      '直到範圍空掉 → 這時會出現「🏁 讓兩種搜尋比一場」，按下去就會播。',
                 pass: '四種資料量（' +
                       SIZES.map(function (n) {
                         return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                       }).join('、') + ' 筆）都要：' +
                       '① 自己砍到範圍空掉　② 看兩種搜尋<b>比一場</b>；' +
                       '<br>③ 最後「💥 資料大爆炸」那一題<b>先猜一個數字</b>' +
                       '（猜錯沒關係，重點是先猜過）。' };
      }
      var name = INFO[m].name;
      return {
        why: '照著' + name + '的規則走一遍。' +
             '等一下概念檢測問的「為什麼不能跳」「找不到怎麼結束」，' +
             '都是你在這裡被擋過、走完過才答得出來的。',
        pass: '① 自由玩：<b>找得到</b>和<b>找不到</b>各走一次' +
              '（找不到那一種才看得出迴圈為什麼需要結束條件）<br>' +
              '② 驗收挑戰 <b>三關全過</b>：預測次數 → 零失誤 → 最壞情況'
      };
    },
    _realCount: realCount,
    _afterCut: afterCut,
    _worstBinary: worstBinary,
    _worstSequential: worstSequential,
    SIZES: SIZES,
    /* 動畫的節奏 —— 測試要驗「慢到看得見」，所以要拿得到。 */
    CELL_MS: CELL_MS,
    CELL_MAX: CELL_MAX,
    RACE_MAX: RACE_MAX,
    RACE_SEC: RACE_SEC,
    _makeCase: makeCase,
    _isSorted: isSorted
  };
})(typeof window !== 'undefined' ? window : this);
