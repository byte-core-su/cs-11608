/* =====================================================================
   排序實驗室（第 6、7 關）：手動挑戰 ＋ 30 筆自動播放
   ---------------------------------------------------------------------
   ★ 來歷
     這兩樣原本都在 11502/sort.html（一支獨立的「排序大冒險」頁面）。
     2026-08-07 先把手動挑戰抽出來共用；
     2026-08-12 再把自動排序動畫改寫進來，然後**刪掉 sort.html**。
     ⚠️ 中間一度是把整支 sort.html 用 iframe 嵌進關卡 ——
        那不叫整合，只是把它藏起來：用詞、判定、畫面都還是兩套。
        真正的整合是「挑出對得上課本的那一段，用系統自己的樣子重寫」。

   ★ 選擇排序法跟課本走：兩個清單
     原本 sort.html 的選擇排序是「和邊界那一格對調」（原地交換），
     課本（翰林 114 資科 2 下 6-2）是
       從「未排序」找到最小值 → 加到「已排序」的最後一項 → 從未排序刪掉。
     兩種都叫選擇排序法，但寫成 Scratch 積木完全不同。
     學生玩的、課本寫的、第 6 關要拼的必須是同一件事，
     所以這裡一律照課本。

     （氣泡與插入兩種本來就和課本一致，維持原樣。）

   用法：
     SORTLAB.mount(host, { mode:'selection', order:'asc', items:[...], onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-07-sortlab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /** 由小到大就找最小、由大到小就找最大 */
  function bestOf(list, order) {
    if (!list.length) return [];
    var vals = list.map(Number);
    var m = (order === 'desc') ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    var out = [];
    vals.forEach(function (v, i) { if (v === m) out.push(i); });
    return out;                       // 並列的都算對
  }

  /**
   * 選擇排序（課本版）：從未排序挑一個搬到已排序的最後面。
   * ★ 錯的時候不講正確位置 —— 講了，下一回合他照樣不會找。
   */
  function checkSelection(unsorted, i, order) {
    if (!unsorted.length) return { ok: false, msg: '沒有東西可以挑了。' };
    if (bestOf(unsorted, order).indexOf(i) >= 0) return { ok: true, msg: '' };
    return { ok: false,
             msg: '你選的是 ' + unsorted[i] + '，但未排序裡還有更' +
                  (order === 'desc' ? '大' : '小') + '的 —— 再看一次。' };
  }

  /**
   * 氣泡排序：只能交換「相鄰」的兩個。
   * ★ 只擋「不相鄰」，不擋「換了沒有變好」——
   *   換錯方向讓資料變亂，本來就是學生該自己看見的事。
   */
  function checkBubble(a, b) {
    if (a === b) return { ok: false, msg: '要選兩個不同的。' };
    if (Math.abs(a - b) !== 1) {
      return { ok: false, msg: '氣泡排序只能交換<b>相鄰</b>的兩個 —— 你選的這兩個中間還隔著別人。' };
    }
    return { ok: true, msg: '' };
  }

  /**
   * 插入排序：把邊界上那一張「新牌」插進左邊已排好的位置。
   * pos = 要插到第幾格（0 ～ boundary）
   */
  function checkInsertion(arr, boundary, pos, order) {
    if (pos > boundary) return { ok: false, msg: '新牌只能往<b>左邊已排好</b>的那一段插。' };
    var v = Number(arr[boundary]);
    var left = pos > 0 ? Number(arr[pos - 1]) : null;
    var right = pos < boundary ? Number(arr[pos]) : null;
    var okL = left === null || (order === 'desc' ? left >= v : left <= v);
    var okR = right === null || (order === 'desc' ? v >= right : v <= right);
    if (okL && okR) return { ok: true, msg: '' };
    if (!okL) {
      return { ok: false, msg: '插在這裡的話，左邊的 ' + left + ' 會排在 ' + v + ' 的' +
                              (order === 'desc' ? '前面 —— 但它比較小。' : '前面 —— 但它比較大。') };
    }
    return { ok: false, msg: '再往' + (order === 'desc' ? '左' : '左') + '一點 —— 右邊的 ' + right +
                            (order === 'desc' ? ' 比它大。' : ' 比它小。') };
  }

  /** 插入排序：把第 from 張抽出來插到第 pos 格 */
  function doInsert(arr, from, pos) {
    var out = arr.slice();
    var v = out.splice(from, 1)[0];
    out.splice(pos, 0, v);
    return out;
  }

  function sorted(arr, order) {
    for (var i = 1; i < arr.length; i++) {
      if (order === 'desc' ? Number(arr[i - 1]) < Number(arr[i])
                           : Number(arr[i - 1]) > Number(arr[i])) return false;
    }
    return true;
  }

  /** 隨機出題 —— 一開始就排好的話等於白玩，所以排好了就重抽 */
  /* ── 手動挑戰每一題有幾筆 ────────────────────────────
     ★★ 老師 2026-08-18：「插入排序法每次都是 6 筆？沒有變化？6-10」
        「選擇排序每次都是 6 筆？沒有變化？」
     ⚠️ 原本寫死 `opts.size || 6` —— 換一題只換數字、不換**筆數**，
        於是每一輪的長度、回合數、比較次數的量級都一模一樣。
        學生第二次排的時候是在**重複同一個動作**，不是在遇到新情況。
     ★ 而且筆數固定的話，第 1 關「這一組要比幾次」永遠是同一個答案
       （選擇排序 6 筆永遠 15 次）—— 背一次就過了。
     ⇒ 6～10 隨機。上限 10 是因為手排要一格一格點，
       再多就變成在考耐心，不是考規則。 */
  var HAND_SIZES = [6, 7, 8, 9, 10];

  function makeItems(n, order) {
    n = n || HAND_SIZES[Math.floor(Math.random() * HAND_SIZES.length)];
    for (var t = 0; t < 30; t++) {
      var a = [];
      var seen = {};
      while (a.length < n) {
        var v = 10 + Math.floor(Math.random() * 90);
        if (!seen[v]) { seen[v] = 1; a.push(v); }   // 不重複，免得「最小的是誰」有兩個答案
      }
      if (!sorted(a, order)) return a;
    }
    return [42, 17, 93, 28, 61, 35];
  }

  /* ── 自動播放：30 筆資料跑一遍 ─────────────────────
     ★ 為什麼手動之外還要有這個
       手動只排得動六個 —— 而六個排起來一點都不費力，
       學生不會覺得「排序很花時間」。
       課本 p.12 的教學叮嚀就建議用動畫讓學生對大量資料有感。
       ⇒ 30 筆自動跑一遍，而且**把比較次數印出來**。
         那個數字接得上第 10 關的搜尋大比拼 ——
         排序與搜尋都在問同一件事：資料變多的時候，要比幾次？

     ★ 為什麼先算好每一格畫面，再播
       原本 sort.html 是把 await sleep() 混在演算法裡 ——
       演算法和動畫綁在一起，就沒辦法單獨測「它排得對不對」。
       ⇒ plan() 是純函式：吃一個陣列，吐出每一步的畫面。
         播放器只負責一格一格放。演算法對不對，測試裡直接驗。

     一格畫面（frame）：
       arr      這一刻的排列
       cmp      這一刻正在比的兩個位置（畫成高亮）
       best     目前找到的最小值位置（只有選擇排序用）
       done     第 done 項之前都排好了（畫成綠色）
       n        到這一刻為止比了幾次 */
  /* ⚠️⚠️ plan() 會把**每一格畫面的整個陣列**都留下來。
     600 筆用選擇排序要比 179,700 次 → 三十幾萬份 600 格的複本，
     瀏覽器會直接卡死。大資料量一定要走 runner()（見下面），它只留現在這一份。
     ★ 這個上限寫成會噴錯的守衛，而不是註解 ——
       註解擋不住「順手把資料量調大」這種改法。 */
  var PLAN_MAX = 40;

  function plan(items, mode, order) {
    if (items.length > PLAN_MAX) {
      throw new Error('plan() 只能用在 ' + PLAN_MAX + ' 筆以內（' + items.length +
                      ' 筆請用 runner()，不然每一格都存一份陣列會爆掉）');
    }
    var a = items.slice().map(Number), n = a.length, frames = [], cmp = 0;
    /* ★ 每一格都要帶一句「這一步發生了什麼」。
       ⚠️ 只有動畫沒有解說的話，學生看到的是一堆長條在跳 ——
          他知道「有事情在發生」，但不知道發生的是什麼。
          按「下一步」慢慢看的人，讀的就是這一句。 */
    function shot(c, best, done, note) {
      frames.push({ arr: a.slice(), cmp: c || null,
                    best: (best == null ? null : best), done: done || 0,
                    n: cmp, note: note || '' });
    }
    var better = function (x, y) {
      return order === 'desc' ? x > y : x < y;
    };
    var W = (order === 'desc') ? '大' : '小';       // 由大到小就是找最大
    var no = function (i) { return i + 1; };        // 畫面上用第幾項（1 起算）

    if (mode === 'bubble') {
      shot(null, null, 0, '氣泡排序：從頭開始，每次比<b>相鄰</b>的兩個。');
      for (var i = 0; i < n - 1; i++) {
        for (var j = 0; j < n - 1 - i; j++) {
          cmp++;
          shot([j, j + 1], null, i ? n - i : 0,
               '比第 ' + no(j) + '、' + no(j + 1) + ' 項（' + a[j] + ' 和 ' + a[j + 1] + '）。');
          if (better(a[j + 1], a[j])) {
            var big = a[j], small = a[j + 1];
            var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
            shot([j, j + 1], null, i ? n - i : 0,
                 '順序不對 —— ' + small + ' 比 ' + big + W + '，<b>交換</b>。');
          } else {
            frames[frames.length - 1].note +=
              ' 順序本來就對，<b>不用換</b>。';
          }
        }
        shot(null, null, n - 1 - i,
             '跑完第 ' + (i + 1) + ' 回合 —— 最' + (order === 'desc' ? '小' : '大') +
             '的那個已經被推到<b>最後面</b>，之後不必再看它。');
      }
    } else if (mode === 'insertion') {
      shot(null, null, 1, '插入排序：左邊那一段當成「已經排好的手牌」，' +
                          '每次<b>抽一張新牌</b>插進去。');
      for (var k = 1; k < n; k++) {
        var key = a[k], p = k - 1;
        shot([k, k], null, k, '抽第 ' + no(k) + ' 張牌：<b>' + key + '</b>。' +
                              '要把它插進左邊那 ' + k + ' 張裡。');
        while (p >= 0) {
          cmp++;
          shot([p, k], null, k,
               '和左邊的 ' + a[p] + ' 比：' +
               (better(key, a[p]) ? '<b>' + key + ' 比較' + W + '</b>，' + a[p] + ' 要往右讓一格。'
                                  : '<b>' + key + ' 沒有比較' + W + '</b> —— 位置就在這裡，停。'));
          if (!better(key, a[p])) break;
          a[p + 1] = a[p]; p--;
          shot([p + 1, k], null, k, a[p + 2] + ' 往右移了一格，空出位子。');
        }
        a[p + 1] = key;
        shot(null, null, k + 1, '<b>' + key + '</b> 插進第 ' + no(p + 1) + ' 個位置。' +
                                '左邊 ' + (k + 1) + ' 張現在都排好了。');
      }
    } else {
      /* 選擇排序照課本的兩清單版：從未排序找最小 → 搬到已排序的最後一項。
         畫面上已排好的留在左邊不動，未排序的整段往左遞補。 */
      shot(null, null, 0, '選擇排序：每一回合從<b>還沒排好</b>的那一段裡挑出最' + W + '的。');
      for (var s = 0; s < n; s++) {
        var best = s;
        shot(null, best, s, '第 ' + (s + 1) + ' 回合開始。先假設第 ' + no(s) +
                            ' 項（' + a[s] + '）最' + W + '。');
        for (var q = s + 1; q < n; q++) {
          cmp++;
          var hit = better(a[q], a[best]);
          shot([q, best], best, s,
               '拿第 ' + no(q) + ' 項（' + a[q] + '）和目前最' + W + '的第 ' + no(best) +
               ' 項（' + a[best] + '）比 —— ' +
               (hit ? '<b>更' + W + '了，換人。</b>' : '沒有更' + W + '，不換。'));
          if (hit) { best = q; shot([q, best], best, s,
               '目前最' + W + '的換成第 ' + no(best) + ' 項（' + a[best] + '）。'); }
        }
        var v = a.splice(best, 1)[0];
        a.splice(s, 0, v);
        shot(null, null, s + 1,
             '整段看完了，最' + W + '的是 <b>' + v + '</b> —— ' +
             '把它搬到已排好那一段的<b>最後面</b>，並從未排序刪掉。');
      }
    }
    shot(null, null, n, '沒有東西可以挑了 —— <b>排好了</b>。總共比了 ' + cmp + ' 次。');
    return { frames: frames, compares: cmp };
  }

  /* ── 大量資料的排序過程 ─────────────────────────────
     ★ 老師 2026-08-18：「可以真實體驗大量數據排列的過程」——
       搜尋那邊已經做到了（一整排格子，被砍掉的整片變灰），
       排序這邊卻還停在 10 筆。10 筆看得清楚「在比哪兩根」，
       但看不到「一整片散亂的資料慢慢長成一道斜坡」那個畫面。

     ⚠️ 不能用 plan()：它把每一格的陣列都存下來（見 PLAN_MAX）。
     ⇒ runner() 是一台**只有現在**的機器：
        advance(k) 往前走 k 步，arr 就地被改，不留歷史。
        代價是沒有「上一步」可以回看 —— 那本來就是小資料量在做的事。

     ★ 兩邊要用**同一個 k**：一次都走 k 步，
       「插入排序早就排完、選擇排序還在爬」那個畫面才是真的。

     一步（step）＝ 最多一次比較。有些步只是搬東西（不算比較次數）。 */
  function runner(items, mode, order) {
    var a = items.slice().map(Number), n = a.length, cmp = 0, fin = (n <= 1);
    var better = function (x, y) { return order === 'desc' ? x > y : x < y; };
    /* 選擇：s＝已排好幾項、q＝掃到哪、best＝目前最小的位置
       插入：i＝正在插第幾張、key＝那張牌、p＝往左比到哪 */
    var s = 0, q = 1, best = 0;
    var i = 1, key = (n > 1 ? a[1] : 0), p = 0;

    function stepSel() {
      if (q < n) {
        cmp++;
        if (better(a[q], a[best])) best = q;
        q++;
        return;
      }
      /* 這一回合結束：把最小的搬到已排序那一段的最後面（和 plan() 同一種做法） */
      var v = a.splice(best, 1)[0];
      a.splice(s, 0, v);
      s++;
      if (s >= n - 1) { s = n; fin = true; return; }
      best = s; q = s + 1;
    }
    function stepIns() {
      if (i >= n) { fin = true; return; }
      if (p >= 0) {
        cmp++;
        /* ⚠️ 比不過就**停** —— 那一次「沒有比較小」的比較也要算，
           不算的話已排好的資料會變成 0 次，和 plan() 對不起來。 */
        if (better(key, a[p])) { a[p + 1] = a[p]; p--; return; }
      }
      a[p + 1] = key;
      i++;
      if (i >= n) { fin = true; return; }
      key = a[i]; p = i - 1;
    }

    return {
      arr: a,
      compares: function () { return cmp; },
      /* 左邊有幾項已經定案（畫成綠色） */
      done: function () { return mode === 'insertion' ? i : s; },
      /* 現在正在動的位置（畫成橘色） */
      at: function () { return mode === 'insertion' ? Math.max(0, p) : Math.min(n - 1, q); },
      best: function () { return mode === 'insertion' ? i : best; },
      finished: function () { return fin; },
      advance: function (k) {
        for (var t = 0; t < k && !fin; t++) {
          if (mode === 'insertion') stepIns(); else stepSel();
        }
      }
    };
  }

  /** 這一批資料用這種排法要比幾次、要走幾步（先算好，動畫才知道一次該跳多少） */
  function costOf(items, mode, order) {
    var r = runner(items, mode, order), n = items.length, steps = 0;
    /* ⚠️ 上限抓 n²+4n：選擇是 n(n−1)/2 次比較加上每回合一次搬移，
       插入最壞也是 n(n−1)/2 次比較加上搬移 —— 都在這個界內。
       抓太小的話會回報一個「還沒排完」的次數，而那不會報錯，只會是錯的。 */
    var cap = n * n + 4 * n + 16;
    while (!r.finished() && steps < cap) { r.advance(1); steps++; }
    return { compares: r.compares(), steps: steps, sorted: r.finished() };
  }

  /* ── 變數追蹤：電腦怎麼找出最小值 ───────────────────
     ★ 玩法來自 11502/search.html（逐步執行＋程式碼行高亮＋變數面板）。
       但那一頁追的是「找最大值」，和課本對不上 ——
       ⇒ 玩法留下來，內容換成課本備課用書 p.193／p.198 的
         「找出最小值位置」副程式（資料位置／最小值位置）。
       課本那張「第一次～第五次」的比對表，這裡是一步一步走出來的。

     ★ 為什麼第 6 關特別需要這個
       手動挑戰時學生是「用眼睛挑最小的」——
       他做得到，但那不是電腦做的事。
       這一段把同一件事拆成電腦的動作：兩個變數、一次比一個。
       ⇒ 接下來的拼圖要拼的正是這段程式。

     一步（step）：
       line  這一步在跑程式的第幾行（畫面上高亮那一行）
       dp    資料位置
       mp    最小值位置
       note  這一步發生了什麼（課本用詞）
       cmp   這一步有沒有做比較（拿來數比較次數） */
  var TRACE_CODE = [
    '定義 找出最小值位置',
    '　變數 資料位置 設為 1',
    '　變數 最小值位置 設為 1',
    '　重複 清單 原始資料 的長度 次',
    '　　如果 第(資料位置)項 < 第(最小值位置)項 那麼',
    '　　　變數 最小值位置 設為 資料位置',
    '　　變數 資料位置 改變 1'
  ];

  function traceMin(items, order) {
    var a = items.map(Number), n = a.length, steps = [], cmp = 0;
    var better = function (x, y) { return order === 'desc' ? x > y : x < y; };
    var word = (order === 'desc') ? '大' : '小';

    steps.push({ line: 1, dp: 1, mp: null, cmp: false,
                 note: '資料位置設為 1 —— 從第 1 項開始看。' });
    steps.push({ line: 2, dp: 1, mp: 1, cmp: false,
                 note: '最小值位置也設為 1 —— 先假設第 1 項最' + word + '。' });
    for (var i = 1, mp = 1; i <= n; i++) {
      cmp++;
      var hit = (i !== mp) && better(a[i - 1], a[mp - 1]);
      steps.push({ line: 4, dp: i, mp: mp, cmp: true,
                   note: '第 ' + i + ' 項是 ' + a[i - 1] + '，目前最' + word +
                         '的是第 ' + mp + ' 項（' + a[mp - 1] + '）—— ' +
                         (i === mp ? '就是它自己，不必比。'
                                   : (hit ? '比較' + word + '，換人。'
                                          : '沒有比較' + word + '，維持不變。')) });
      if (hit) {
        mp = i;
        steps.push({ line: 5, dp: i, mp: mp, cmp: false,
                     note: '最小值位置改成第 ' + mp + ' 項。' });
      }
      steps.push({ line: 6, dp: i + 1, mp: mp, cmp: false,
                   note: '資料位置往下一格 → 第 ' + (i + 1) + ' 項。' });
    }
    var last = steps[steps.length - 1];
    steps.push({ line: 3, dp: last.dp, mp: last.mp, cmp: false, done: true,
                 note: '每一項都看過了。最' + word + '的在第 ' + last.mp +
                       ' 項，數字是 ' + a[last.mp - 1] + '。' });
    return { steps: steps, compares: cmp, at: last.mp, value: a[last.mp - 1] };
  }

  /* ── 驗收挑戰的三關（第 6、7 關）───────────────────
     ⚠️ 排序的「次數」和搜尋不一樣：手動挑戰是一回合挑一個，
        不是一次一次比。所以第 1 關問的是
        「這一組資料用這個排序法**總共**要比幾次」——
        而答案就在下面的自動播放裡，他可以自己按來驗證。
        ★ 預測 → 自己驗證，比我直接給答案有用得多。

     ⭐   預測：這一組（6 筆）要比幾次
     ⭐⭐  零失誤：換一題手動排完，全程不能點錯
     ⭐⭐⭐ 最壞情況：10 筆要比幾次（n×(n−1)÷2 = 45）
          ⚠️ 不必教公式。選擇與氣泡每一對都要比一次，
             10 個裡任兩個配對就是 45 —— 數得出來。 */
  var TESTS = {
    worstSize: 10,
    worstAsk: '一組有 <b>10</b> 筆資料。用<b>選擇排序法</b>把它排好，' +
              '總共要比幾次？',
    worstWhy: '選擇排序每一輪都要把剩下的全部看一遍：9＋8＋7＋…＋1 ＝ 45 次。' +
              '（也就是「10 個裡任兩個配對」的數目。）',
    worstAns: function (n) { return n * (n - 1) / 2; }
  };

  /* ── 補充教材：課本沒教、但畫面上看得到的東西 ──────────
     ★ 老師 2026-08-18：「『🫧 氣泡排序法』不在課程內，
       在旁加個補充介紹的按鈕，會有浮動視窗顯示簡介說明。」
     ⚠️ 補充的第一句話就要說「這一段不考」——
        不講的話，學生會把它當成第三種要背的排序法。
     ⚠️ 內容要接回他**已經學過**的兩種，不要另開一套詞彙。 */
  var WHY = {
    bubble: {
      icon: '🫧', name: '氣泡排序法',
      html:
        '<p class="lead">⚠️ 這一段<b>不在第 6 章的範圍</b>，也<b>不會考</b> —— ' +
        '放在這裡是因為它常常和另外兩種一起被提到，看一眼就好。</p>' +
        '<p><b>怎麼排</b>：從第 1 項開始，只比<b>相鄰的兩個</b>，' +
        '順序不對就交換；一路比到最後，' +
        '整排最大的那一個就會被「推」到最後面。<br>' +
        '再從頭來一次，第二大的就位……重複到全部排好。</p>' +
        '<p><b>名字的由來</b>：大的數字像氣泡一樣，一輪一輪往後浮上去。</p>' +
        '<p><b>和課本那兩種的關係</b><br>' +
        '· 和<b>選擇排序法</b>一樣：不管資料本來長什麼樣，' +
        '最壞都要比 <b>n×(n−1)÷2</b> 次。<br>' +
        '· 但選擇排序<b>每一回合只搬一次</b>；' +
        '氣泡排序一路換過去，<b>交換的次數多很多</b>。<br>' +
        '· 和<b>插入排序法</b>一樣：資料本來就接近排好的時候會比較快' +
        '（可以加一個「這一輪都沒換過就提早結束」的判斷）。</p>' +
        '<p class="note">🎒 生活裡的樣子：體育課排隊，老師說' +
        '「看旁邊的同學，比較高的往後站」—— 大家兩兩互換，' +
        '一輪下來最高的就到最後面了。</p>'
    }
  };

  /* ── 三種排序法的說明（沿用 sort.html 原本的文案）───── */
  /* ── 三種資料長相（排序大比拼用）────────────────────
     ★ 老師 2026-08-17：「2. 動手試一次 就只有搜尋，沒有排序 …
       應該是兩個都要，比較 搜尋的循序與二元速度差、
       排序的選擇與插入速度差。這個在前面都是分開的單元吧？」
       —— 對，第 6、7 關（排序）和第 8、9 關（搜尋）是分開教的，
       第 10 關才是把它們放在一起比的地方，而原本只比了搜尋。
     ★ 這三種情境是這一段的全部重點：
         🎲 隨機　　選擇 45／插入 24
         ✅ 已排好　選擇 45／插入 **9**
         🔄 完全相反 選擇 45／插入 45
       **選擇排序永遠 45 次**（不看資料長相），插入排序 9～45 都有。
       那正是第 7 關的核心，也是這一關概念檢測第 2 題在問的。 */
  /* ── 排序大比拼的資料量 ─────────────────────────────
     ★ 老師 2026-08-18：「可以真實體驗大量數據排列的過程」。
       10 筆看得清楚「現在在比哪兩根」，但那不叫「大量資料」——
       600 筆才看得到一整片散亂的長條慢慢長成一道斜坡。
     ⚠️ 兩種畫面**都要**，不是二選一：
        10 筆解釋「怎麼排」，600 筆解釋「排起來有多久」。
     ★ 600 筆的數字剛好接得上搜尋那一邊：
        已排好的資料 → 選擇 179,700 次、插入 599 次（300 倍）。 */
  var CMP_SIZES = [10, 100, 600];
  /* 「大資料量」從哪一個開始算（過關條件要求至少跑一次大的） */
  var CMP_BIG = 100;
  /* 大資料量整段跑多久（秒）—— 逐格畫的話 18 萬次要跑三小時。 */
  var BIG_SEC = 8;

  var SHAPES = [
    { key: 'rand', icon: '🎲', name: '隨機',
      note: '一般情況 —— 資料本來就亂七八糟',
      make: function (n) { return shuffled(n); } },
    { key: 'sorted', icon: '✅', name: '已經排好',
      note: '最好的情況 —— 資料本來就是照順序的',
      make: function (n) { var a = []; for (var i = 1; i <= n; i++) a.push(i); return a; } },
    { key: 'rev', icon: '🔄', name: '完全相反',
      note: '最壞的情況 —— 資料剛好是倒過來的',
      make: function (n) { var a = []; for (var i = n; i >= 1; i--) a.push(i); return a; } }
  ];
  function shuffled(n) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  var INFO = {
    /* ★ 老師 2026-08-18：「這裡面要加上畫重點標注」。
       ⚠️ 這三行是學生進到這一步看到的**第一段字**，而讀純文字時眼睛是滑過去的。
       ★ 用全站同一組螢光筆（shared/theme.css）：
           黃（.hl）＝這一段真正的重點　藍（.hl-b）＝數量
       ⚠️ 一段最多三四處。畫太多等於沒畫 —— 學生會略過所有黃色的東西。
          ⇒ 只畫「這一步的變因」與「兩種排序真正的差別」，
            操作說明（各排一次、三種都要跑）維持 <b>，那是指示不是重點。 */
    compare: {
      name: '排序大比拼', icon: '⚖️',
      rule: '<span class="hl">同一批資料</span>，讓<b>選擇排序</b>和<b>插入排序</b>各排一次，' +
            '看誰比得少 —— 三種資料長相都要跑過。',
      why: '選擇排序<span class="hl">不管資料長什麼樣，都要比 n(n-1)/2 次</span>；' +
           '插入排序會因為<span class="hl">「資料本來就接近排好」</span>而變快很多。',
      life: '整理手上的撲克牌：牌本來就差不多順的時候，' +
            '<span class="hl-b">你插幾張就好</span>；' +
            '牌全部倒著排的話，怎麼整理都一樣累。'
    },
    selection: {
      name: '選擇排序法', icon: '🎯',
      rule: '每一回合從<b>未排序</b>裡點出最小的，它會被搬到<b>已排序</b>的最後一項。',
      /* ⚠️ 名字跟著範例檔（.sb3）走：原始資料／已排序資料。
         課本這一段寫「未排序數列／已排序數列」—— 意思一樣，
         但學生在 Scratch 裡看到的清單是前者。 */
      why: '反覆從原始資料中找出<span class="hl">「最小值」</span>，把它加到已排序資料的最後一項，' +
           '再從原始資料裡刪掉。<span class="hl">重複到原始資料清空為止。</span>',
      /* ⚠️ 生活案例照課本 6-2（華森向麗娜學理牌的兩種方法）。
         原本這裡寫的是「整理書箱」—— 我自己編的，課本沒有。
         ★ 兩種排序法要用**同一個情境**才看得出差別，
           那正是課本用同一副撲克牌示範兩次的用意。 */
      life: '理牌方法一：<span class="hl">在翻開的所有牌裡找出最小的那張</span>，抽出來排好；'
          + '再從剩下的裡面找最小的，接在後面。'
    },
    bubble: {
      name: '氣泡排序法', icon: '🫧',
      rule: '只能交換<b>相鄰</b>的兩個。點一個，再點它旁邊那個。',
      why: '從第一筆開始，<span class="hl">逐一比較相鄰兩筆，順序有誤就交換</span>。' +
           '跑完一回合，<span class="hl">最後一筆一定就位</span>。',
      life: '體育課排隊，老師說<span class="hl">「看旁邊的同學，比較高的往後站」</span>，大家兩兩互換。'
    },
    insertion: {
      name: '插入排序法', icon: '🃏',
      rule: '點<b>橘框</b>那張新牌，再點左邊已排好的那一段裡<b>該插進去的位置</b>。',
      why: '逐一把新資料插進已排序好的資料中：<span class="hl">和前面已排好的一一比較</span>，'
         + '<span class="hl">找到對的位置插入</span>。',
      /* 課本 6-2 的理牌方法二 —— 和選擇排序同一副牌，差別才看得出來。 */
      life: '理牌方法二：蓋著的牌堆每次抽一張，'
          + '<span class="hl">直接插進手上已經排好的牌裡該去的位置</span>。'
    }
  };

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.sl{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    /* ── 排序大比拼（第 10 關）───────────────────────── */
    '.sl-pick{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.sl-pick .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.sl-pick button{background:#fff;border:2px solid #cbd5e1;color:#334155;border-radius:9px;',
    '  padding:6px 13px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.sl-pick button:hover{border-color:#8b5cf6;background:#f5f3ff}',
    '.sl-pick button.on{border-color:#8b5cf6;background:#ede9fe;color:#6d28d9}',
    '.sl-pick button.ok{border-color:#86efac;background:#dcfce7;color:#166534}',
    /* 現在在跑哪一種資料 —— 要一眼看出來（和搜尋那邊同一個做法） */
    '.sl-shape{display:flex;gap:11px;align-items:center;background:#6d28d9;color:#fff;',
    '  border-radius:12px;padding:9px 13px;margin-bottom:9px}',
    '.sl-shape .ic{font-size:26px;line-height:1}',
    '.sl-shape b{font-size:15px;font-weight:900}',
    '.sl-shape .sub{display:block;font-size:12px;color:#ddd6fe;line-height:1.6}',
    '.sl-mini .sl-cell{min-width:30px;font-size:13px;padding:3px 6px}',
    /* 「排序前的資料」——⚠️ 一定要有標籤：沒有標籤的一排數字看起來就是殘骸
       （老師 2026-08-18：「為什麼還要列一個數字小卡？是不是前一版沒改到？」） */
    '.sl-before{margin-bottom:10px}',
    '.sl-before .lb{display:block;font-size:11.5px;font-weight:800;color:#64748b;',
    '  margin-bottom:4px}',
    '.sl-before .sl-row{margin-bottom:0}',
    '.sl-race{margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;',
    '  border-radius:12px;padding:10px 13px}',
    '.sl-lane{margin-bottom:9px}',
    '.sl-lane .nm{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;font-weight:800;color:#334155;margin-bottom:3px}',
    '.sl-lane .ct{font-family:ui-monospace,monospace;font-size:13px}',
    '.sl-lane .track{background:#e2e8f0;border-radius:7px;height:16px;overflow:hidden}',
    /* ★ 真實的排序過程：一排長條，正在比的會亮、排好的變綠。
       ⚠️ 高度固定 —— 每一格重畫的時候高度會跳，不固定的話整頁上下彈。 */
    '.sl-bars2{display:flex;align-items:flex-end;gap:3px;height:78px;',
    '  background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 6px}',
    '.sl-bars2 .sl-bar{flex:1;background:#cbd5e1;border-radius:3px 3px 0 0;position:relative;',
    '  transition:height .12s linear,background .12s}',
    '.sl-bars2 .sl-bar span{position:absolute;top:-15px;left:0;right:0;text-align:center;',
    '  font-size:10.5px;font-weight:700;color:#64748b}',
    '.sl-bars2 .sl-bar.cmp{background:#f59e0b}',
    '.sl-bars2 .sl-bar.cmp span{color:#b45309}',
    '.sl-bars2 .sl-bar.best{background:#8b5cf6}',
    '.sl-bars2 .sl-bar.ok{background:#4ade80}',
    /* ── 大量資料的那一排（老師 2026-08-18）─────────────
       ⚠️ 600 根長條不可以有 gap、不可以有圓角、不可以有 transition：
          · gap 3px × 600 = 1800px，長條本身就被擠沒了
          · 每秒重畫十幾次 × 600 個 transition，舊電腦會掉幀
       ★ 也不印數字 —— 600 個數字疊在一起是一片黑。 */
    '.sl-bars2.big{gap:0;height:96px;padding:4px}',
    '.sl-bars2.big i{flex:1;min-width:0;background:#cbd5e1;align-self:flex-end}',
    '.sl-bars2.big i.cmp{background:#f59e0b}',
    '.sl-bars2.big i.best{background:#8b5cf6}',
    '.sl-bars2.big i.ok{background:#4ade80}',
    /* 資料量那一排：和「資料長相」分得開，不然兩排按鈕看起來是同一組 */
    '.sl-size{padding-bottom:9px;border-bottom:1px dashed #e2e8f0;margin-bottom:10px}',
    '.sl-size .tip{font-size:11.5px;color:#64748b;font-weight:600}',
    '.sl-size button.on{border-color:#0ea5e9;background:#e0f2fe;color:#0369a1}',
    /* 還差什麼 —— 條件有幾項就有幾個勾（第三次踩同一個坑之後加的） */
    '.sl-todo{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;',
    '  padding:9px 12px;margin-bottom:11px}',
    '.sl-todo .th{font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}',
    '.sl-todo ul{list-style:none;margin:0;padding:0}',
    '.sl-todo li{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;line-height:1.9;color:#64748b}',
    '.sl-todo li.ok{color:#166534;font-weight:700}',
    '.sl-todo li span{font-size:11.5px;color:#94a3b8}',
    '.sl-lane .say{font-size:12px;line-height:1.7;color:#64748b;min-height:34px;margin-top:5px}',
    '.sl-lane .say b{color:#334155}',
    '.sl-lane .fill{height:100%;border-radius:7px;transition:width .1s linear}',
    '.sl-lane.sel .fill{background:#f59e0b}',
    '.sl-lane.ins .fill{background:#8b5cf6}',
    '.sl-lane.done .nm{color:#166534}',
    '.sl-race .win{font-size:13.5px;line-height:1.9;color:#166534;font-weight:700;margin-top:6px}',
    '.sl-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}',
    '.sl-tbl th,.sl-tbl td{border:1px solid #e2e8f0;padding:6px 9px;text-align:center}',
    '.sl-tbl th{background:#f1f5f9;color:#475569;font-size:12px}',
    '.sl-tbl td.same{color:#b45309;font-weight:700}',
    '.sl-tbl td.vary{color:#6d28d9;font-weight:700}',
    '.sl-hint2{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:8px}',
    '.sl-hint2 b{color:#6d28d9}',
    '.sl-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.sl-tip b{color:#4338ca}',
    '.sl-sub{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:6px}',
    '.sl-round{font-size:12.5px;font-weight:900;color:#6366f1;margin:10px 0 6px}',
    '.sl-row{display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap}',
    '.sl-tag{font-size:11px;font-weight:700;color:#64748b;min-width:52px}',
    '.sl-cell{min-width:44px;padding:9px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;color:#334155;',
    '  cursor:pointer;transition:.12s}',
    '.sl-cell:hover{border-color:#6366f1;background:#eef2ff}',
    /* ⚠️ 這四條的**順序就是規則**（同權重，後面的贏）。
       2026-08-12 踩到：原本 .card 排在 .sel 後面 ——
       學生點下「橘框那張新牌」，畫面除了浮起 3px 之外**什麼都沒變**，
       因為 .card 的橘色又把 .sel 的靛藍蓋回去了。
       說明寫著「點橘框那張」，他點了卻看不出有沒有點到。
       ⇒ 正確順序：已排好 → 橘框（這一張要處理）→ 點選中 → 出錯閃爍。
          出錯一定要排最後，不然閃爍會被別的狀態蓋掉。 */
    '.sl-cell.done{border-color:#34d399;background:#dcfce7;color:#166534;cursor:default}',
    '.sl-cell.done:hover{background:#dcfce7}',
    /* ── 這一回合要處理的那一張新牌 ─────────────────────
       ⚠️⚠️ 老師 2026-08-18：「『這一回合要處理的是橘框那一張新牌』
          但是並沒有亮橘框，只有外框造型不同。」
          —— 原本只是 2px 的橘邊＋很淡的底色（#fff7ed）。
          那個底色和白色差不到哪裡去，在投影機上更是完全看不出來；
          旁邊的「已排好」是**綠底**，對比之下橘的那張看起來只是「沒有顏色」。
       ★ 訊息裡指名「橘框那一張」，畫面上就必須真的有一張是橘的 ——
         **文字說的和畫面看到的要是同一件事**。
       ⇒ 實心橘底、白字、加粗邊、微微浮起，而且掛一個「這張」的小標。 */
    '.sl-cell.card{border-color:#c2410c;background:#f97316;color:#fff;',
    '  box-shadow:0 3px 0 #c2410c;transform:translateY(-2px);position:relative}',
    '.sl-cell.card:hover{background:#ea580c;border-color:#9a3412}',
    /* 小標：告訴他「就是這一張」—— 顏色再明顯，也要有字說清楚 */
    '.sl-cell.card::after{content:"這張";position:absolute;top:-15px;left:50%;',
    '  transform:translateX(-50%);font-size:10px;font-weight:900;color:#c2410c;',
    '  background:#ffedd5;border-radius:9999px;padding:1px 6px;white-space:nowrap}',
    /* ⚠️ 這一條要把 .card 的橘色陰影也換掉 ——
       只換底色的話，點下去會變成「靛藍的牌配橘色的影子」，看起來像沒畫完。 */
    '.sl-cell.sel{border-color:#4338ca;background:#e0e7ff;color:#3730a3;',
    '  transform:translateY(-3px);box-shadow:0 3px 0 #4338ca}',
    /* ⚠️ 出錯用**紅色**，不要用琥珀色 —— 琥珀和橘框太像，
       學生會分不出「這是要處理的那張」和「你點錯了」。 */
    '.sl-cell.bad{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    '.sl-slot{width:16px;height:38px;border:2px dashed #cbd5e1;border-radius:6px;',
    '  background:transparent;cursor:pointer;padding:0}',
    '.sl-slot:hover{border-color:#6366f1;background:#eef2ff}',
    /* ★★ 最尾巴那一個插入點（老師 2026-08-18：「最大數排到最後不好表示」）。
       ⚠️ 它和其他插入點長得一樣的話，「插在最後面」這個動作等於沒有畫面 ——
          而那正是新牌比手上每一張都大時的**正確答案**。
       ⇒ 畫寬一點、實線、帶一個往右的箭頭：看得出「這裡是尾巴」。 */
    '.sl-slot.last{width:30px;border-style:solid;border-color:#a5b4fc;',
    '  background:#eef2ff;position:relative}',
    '.sl-slot.last::after{content:"→";position:absolute;inset:0;display:flex;',
    '  align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#6366f1}',
    '.sl-slot.last:hover{background:#e0e7ff;border-color:#6366f1}',
    '.sl-empty{font-size:12px;color:#cbd5e1}',
    '.sl-msg{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.sl-msg.good{background:#dcfce7;color:#166534}',
    '.sl-msg.bad{background:#fef3c7;color:#92400e}',
    '.sl-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.sl-btn:hover{background:#4f46e5}',
    /* ── 補充教材：標記與浮動視窗（老師 2026-08-18）──────
       ⚠️ 「補充」這兩個字一定要在按鈕上 —— 藏在說明裡的話，
          學生看到的還是三顆長得一樣的按鈕。 */
    '.sl-card .ex{font-size:9.5px;font-weight:900;margin-left:4px;',
    '  background:#fde68a;color:#92400e;border-radius:9999px;padding:1px 5px;vertical-align:middle}',
    /* ⚠️ 老師 2026-08-18：❓ 那顆圓按鈕「會跑出格子，排版不良」——
       它和旁邊那排方形按鈕不同形狀也不同大小，夾著就是一個突出的小方塊。
       ⇒ 做成**標籤的樣子**：藥丸形、小一號、琥珀色、沒有粗框。
       ★ 形狀本身就在說「我是附註，不是另一個選項」。 */
    /* ⚠️ 老師 2026-08-18：「『補充 ⓘ』加上底色標示會更明顯。」
       原本是 #fef7c7 那種很淡的底 —— 在白色按鈕旁邊幾乎看不出來，
       等於又回到「只有外框造型不同」那個問題（同一天講過的第 4 點）。
       ★ 改成**實心的螢光黃**（#fcd34d）配深棕字：
         和全站螢光筆同一個色系（theme.css 的 --marker 就是 250,204,21），
         深棕字在黃底上的對比夠高，投影出來也讀得到。
       ⚠️ 不用白字：白字配黃底的對比不到 3:1，投影機一打就糊掉。 */
    '.sl-ex{background:#fcd34d;border:1px solid #d97706;color:#78350f;',
    '  border-radius:9999px;padding:3px 10px;font-size:11.5px;font-weight:900;',
    '  cursor:pointer;font-family:inherit;line-height:1.5;margin-left:-3px;',
    '  align-self:center;box-shadow:0 1px 0 rgba(120,53,15,.25)}',
    '.sl-ex:hover{background:#fbbf24;border-color:#b45309}',
    /* ⚠️ 蓋在 host 上（position:absolute），不是 fixed ——
       這個模組會被掛在關卡頁的一塊 div 裡，fixed 會蓋掉整個網站。 */
    '.sl-modal{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.55);',
    '  display:flex;align-items:center;justify-content:center;padding:18px}',
    '.sl-card{background:#fff;border-radius:16px;max-width:520px;width:100%;',
    '  max-height:82vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.28)}',
    '.sl-card .hd{display:flex;justify-content:space-between;align-items:center;',
    '  padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:900;',
    '  color:#334155;position:sticky;top:0;background:#fff}',
    '.sl-card .x{background:none;border:0;font-size:18px;color:#94a3b8;cursor:pointer;',
    '  font-family:inherit;padding:2px 6px}',
    '.sl-card .x:hover{color:#334155}',
    '.sl-card .bd{padding:14px 16px;font-size:13.5px;line-height:2;color:#334155}',
    '.sl-card .bd p{margin:0 0 10px}',
    '.sl-card .bd b{color:#4338ca}',
    '.sl-card .bd .lead{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;',
    '  padding:9px 12px;color:#92400e;font-size:13px}',
    '.sl-card .bd .lead b{color:#92400e}',
    '.sl-card .bd .note{background:#f8fafc;border-radius:10px;padding:9px 12px;',
    '  font-size:12.5px;color:#64748b}',
    '.sl-card .ft{padding:0 16px 14px;text-align:right}',
    /* ── 播放動畫的那顆按鈕 ────────────────────────────
       ⚠️⚠️ 老師 2026-08-18：「▶ 播放 600 筆的排序過程 這個也太不明顯了，找很久才發現」。
          查下來原因很難堪：`.sl-side` **從頭到尾沒有任何 CSS** ——
          那顆是瀏覽器的預設灰按鈕，塞在一整頁配好色的內容中間，
          眼睛會直接把它當成頁面邊角的雜物跳過去。
       ★ 我前一輪只改了按鈕上的**字**（「各排一次」→「播放」），
         以為那樣就叫「入口明顯」—— 字改得再好，沒有樣式一樣看不到。
         ⇒ 這一次改的是它長什麼樣、佔多大、在不在視線上。
       ⚠️ 主要動作（播放）和次要動作（再放一次）要分得開：
          兩顆長一樣的話，等於又回到「一片按鈕裡找一顆」。 */
    '.sl-go{background:#f5f3ff;border:2px dashed #c4b5fd;border-radius:14px;',
    '  padding:15px 14px;margin:13px 0;text-align:center}',
    '.sl-go button{background:#7c3aed;color:#fff;border:0;border-radius:11px;',
    '  padding:14px 26px;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;',
    '  box-shadow:0 3px 0 #5b21b6;letter-spacing:.5px}',
    '.sl-go button:hover{background:#6d28d9}',
    '.sl-go button:active{transform:translateY(2px);box-shadow:0 1px 0 #5b21b6}',
    '.sl-go .cap{font-size:12.5px;font-weight:700;color:#6d28d9;line-height:1.8;margin-top:9px}',
    /* 呼吸一下 —— 投影出來時那圈光暈就是「按這裡」。
       ⚠️ 系統開了「減少動態效果」要能關掉（會暈的人）。 */
    '@keyframes sl-breathe{0%,100%{box-shadow:0 3px 0 #5b21b6,0 0 0 0 rgba(124,58,237,.5)}',
    '  50%{box-shadow:0 3px 0 #5b21b6,0 0 0 12px rgba(124,58,237,0)}}',
    '.sl-go button{animation:sl-breathe 2.4s ease-out infinite}',
    '@media (prefers-reduced-motion:reduce){.sl-go button{animation:none}}',
    /* 次要動作（再放一次）：看得到，但不搶主角 */
    '.sl-side{display:flex;gap:9px;margin-top:10px;flex-wrap:wrap}',
    '.sl-side button{background:#fff;border:2px solid #c4b5fd;color:#6d28d9;border-radius:9px;',
    '  padding:9px 16px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit}',
    '.sl-side button:hover{background:#f5f3ff}',
    /* 自動播放 */
    '.sl-auto{margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:14px}',
    '.sl-auto h4{font-size:14px;font-weight:900;color:#4338ca;margin:0 0 4px}',
    '.sl-auto .lead{font-size:12.5px;color:#64748b;line-height:1.8;margin-bottom:10px}',
    '.sl-bars{display:flex;align-items:flex-end;gap:2px;height:150px;',
    '  background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px}',
    '.sl-bar{flex:1;background:#c7d2fe;border-radius:2px 2px 0 0;transition:height .06s}',
    '.sl-bar.cmp{background:#f59e0b}',      /* 正在比的兩個 */
    '.sl-bar.best{background:#ef4444}',     /* 目前最小的 */
    '.sl-bar.ok{background:#34d399}',       /* 已經排好的 */
    '.sl-ctrl{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:9px}',
    '.sl-ctrl button{background:#fff;border:2px solid #cbd5e1;color:#334155;border-radius:8px;',
    '  padding:5px 11px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.sl-ctrl button:hover{border-color:#6366f1;background:#eef2ff}',
    '.sl-ctrl button.on{border-color:#6366f1;background:#e0e7ff;color:#4338ca}',
    '.sl-ctrl .num{font-size:12.5px;color:#4338ca;font-weight:900;margin-left:auto}',
    '.sl-ctrl .num b{font-size:16px}',
    /* 解說列：固定高度，不然按「下一步」整頁會彈 */
    '.sl-say{background:#eef2ff;border:1px solid #c7d2fe;border-radius:9px;',
    '  padding:9px 12px;margin-top:9px;font-size:13px;line-height:1.8;',
    '  color:#3730a3;min-height:46px}',
    '.sl-say b{color:#4338ca}',
    /* 變數追蹤（玩法沿用 search.html：程式碼行高亮＋變數面板＋逐步執行） */
    '.sl-tr{margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:14px}',
    '.sl-tr h4{font-size:14px;font-weight:900;color:#0f766e;margin:0 0 4px}',
    '.sl-tr .lead{font-size:12.5px;color:#64748b;line-height:1.8;margin-bottom:10px}',
    '.sl-var{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px}',
    '.sl-var span{background:#f0fdfa;border:2px solid #5eead4;border-radius:9px;',
    '  padding:5px 12px;font-size:13px;font-weight:700;color:#0f766e}',
    '.sl-var span b{font-size:16px;color:#0d9488}',
    '.sl-code{background:#0f172a;border-radius:10px;padding:9px 4px;margin:9px 0;',
    '  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.85}',
    '.sl-code div{color:#94a3b8;padding:1px 10px;white-space:pre-wrap;border-radius:4px}',
    '.sl-code div.now{background:#134e4a;color:#5eead4;font-weight:700}',
    '.sl-cell.dp{border-color:#0d9488;background:#ccfbf1;color:#0f766e}',
    '.sl-cell.mp{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    '.sl-note{font-size:12.5px;line-height:1.8;padding:8px 11px;border-radius:9px;',
    '  background:#f0fdfa;color:#0f766e;margin-top:8px}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）───────── */
    '.sl-big .sl-cell{min-width:62px;padding:15px 16px;font-size:21px;border-width:3px}',
    '.sl-big .sl-slot{width:22px;height:56px}',
    '.sl-big .sl-row{gap:10px;margin-bottom:12px}',
    '.sl-big .sl-tag{font-size:13px;min-width:64px}',
    '.sl-big .sl-round{font-size:14.5px}',
    '.sl-big .sl-tip{font-size:14.5px;padding:14px 17px}',
    '.sl-big .sl-sub{font-size:13.5px}',
    '.sl-big .sl-msg{font-size:15px;padding:12px 15px;min-height:50px}',
    '.sl-big .sl-btn{padding:11px 20px;font-size:15px}',
    /* 投影用：這一步是主角，「按這裡」也要跟著放大 */
    '.sl-big .sl-go{padding:18px}',
    '.sl-big .sl-go button{padding:17px 34px;font-size:19px}',
    '.sl-big .sl-go .cap{font-size:13.5px}',
    /* 自動播放的長條圖：150 → 300，資料量大的時候差距才看得出來 */
    '.sl-big .sl-bars{height:300px;padding:12px;gap:3px}',
    '.sl-big .sl-auto h4{font-size:16px}',
    '.sl-big .sl-auto .lead{font-size:13.5px}',
    '.sl-big .sl-ctrl button{padding:8px 15px;font-size:14px}',
    '.sl-big .sl-ctrl .num{font-size:14.5px}',
    '.sl-big .sl-ctrl .num b{font-size:22px}',
    '.sl-big .sl-say{font-size:15px;padding:12px 16px;min-height:58px}',
    /* 變數追蹤：程式碼要看得清楚，它等一下就是要拼的那一段 */
    '.sl-big .sl-tr h4{font-size:16px}',
    '.sl-big .sl-tr .lead{font-size:13.5px}',
    '.sl-big .sl-code{font-size:14.5px;padding:13px 6px}',
    '.sl-big .sl-code div{padding:3px 14px}',
    '.sl-big .sl-var span{padding:8px 16px;font-size:14.5px}',
    '.sl-big .sl-var span b{font-size:21px}',
    '.sl-big .sl-note{font-size:14.5px;padding:12px 15px;min-height:48px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('sl-style')) return;
    var s = document.createElement('style');
    s.id = 'sl-style';
    /* 挑戰與證書的樣式在 shared/labtest.js —— 三支實驗室共用一份。 */
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
    var mode = opts.mode || 'selection';
    var order = opts.order || 'asc';
    var info = INFO[mode] || INFO.selection;

    /* ⚠️ 不要寫 `opts.size || 6` —— 那就是老師 2026-08-18 指出的
       「每次都是 6 筆」。沒指定就交給 makeItems 抽 6～10。 */
    var items = (opts.items && opts.items.length) ? opts.items.slice() : makeItems(opts.size, order);
    var unsorted = items.slice(), done = [];        // 選擇排序用
    var arr = items.slice(), boundary = 1, sel = null;  // 氣泡／插入用
    var round = 0, passed = false;
    /* ── 驗收挑戰（手動排完才開）─────────────────
       ★ 「排得完」只證明他會操作。真正的證據是
         他能不能在動手之前說出「這一組要比幾次」。
       三個難度的定義在 shared/labtest.js（三支實驗室共用）。 */
    var freePassed = false, lvNow = 0, cleared = {}, guess = null, errs = 0;
    var testMsg = '', testKind = 'info';
    /* 自動播放的狀態。
       ⚠️ 一定要在 render() 之前宣告 —— render() 會叫 auto()，
          而 var 只提升宣告不提升賦值，放在後面的話 algo 會是 undefined。 */
    var pl = null, at = 0, timer = null, algo = mode, speed = 60;
    /* ── 排序大比拼（第 10 關）────────────────────────
       cmpN：這一批有幾筆　cmpShape：現在跑的是哪一種資料長相
       cmpSel／cmpIns：兩邊各比到第幾次（動畫用）
       cmpOn：0 還沒跑、1 跑到一半、2 跑完　cmpTable：跑完的紀錄
       ⚠️ 三種長相都要跑過才算走完 —— 只跑隨機的話，
          「選擇排序不看資料」這件事完全顯不出來。 */
    var cmpN = CMP_SIZES[0], cmpShape = '', cmpItems = [];
    var cmpSel = 0, cmpIns = 0, cmpOn = 0, cmpTimer = null, cmpTable = {};
    var cmpAt = 0;      // 排序過程播到第幾格（兩邊共用同一個計時器）
    /* ── 大量資料（老師 2026-08-18：「可以真實體驗大量數據排列的過程」）──
       ⚠️ 大資料量走的是另一條路：runner() 就地排、不留歷史（見 PLAN_MAX）。
          所以這一輪不是「播到第幾格」，而是「兩台機器各走了幾步」。
       rnSel／rnIns：兩台跑者　ranBig：有沒有用大資料量跑過（過關條件之一） */
    var rnSel = null, rnIns = null, ranBig = false;
    /* 排序過程每一格停多久。
       ⚠️ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
          原本是 22 毫秒 —— 10 筆資料約 88 格，整段「不到 2 秒」就結束了，
          學生還在看說明，長條已經全綠。畫面上就只剩「結果」，沒有「過程」。
       ★ 60 毫秒 → 約 5 秒，看得到一根一根被比、一根一根變綠。
       ⚠️ opts.stepMs = 0 是測試用的：0 就同步跑完，不開計時器。 */
    var CMP_MS = (opts.stepMs != null) ? Number(opts.stepMs) : 60;

    host.className = 'sl' + (opts.big ? ' sl-big' : '');
    render();

    function render() {
      round++;
      host.innerHTML =
        '<div class="sl-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="sl-sub">📝 ' + info.why + '<br>🎒 ' + info.life + '</div></div>' +
        '<div id="sl-body"></div>' +
        '<div id="sl-msg"></div>' +
        (opts.newRound !== false ? '<button class="sl-btn" id="sl-new">🎲 換一題</button>' : '') +
        '<div id="sl-test"></div>' +
        '<div id="sl-trace"></div>' +
        '<div id="sl-auto"></div>';
      body();
      test();
      trace();
      auto();
      var nb = host.querySelector('#sl-new');
      if (nb) nb.onclick = function () {
        newItems();
        /* ⚠️ 挑戰開著的時候不要把 passed 清掉 ——
           清掉的話 finish() 會再跑一次 openTest()，挑戰就被重置了。 */
        if (!lvNow) passed = false;
        errs = 0;                    // 新的一題，失誤重新算
        render();
      };
    }

    /* ── 換一組新資料 ────────────────────────────────────
       ⚠️⚠️ 老師 2026-08-18：搜尋那兩關「過了第一關後換題會是相同數字」，
          「選擇排序法忘了加上這個規則」。
       ★ 兩件事要一起做，少一件都還是會被學生看成「沒換」：
         ① 新的一組**不可以和上一組一樣**（隨機沒有這個保證）
         ② 挑戰要換題的時候**系統自己換** —— 見 finish() 裡的說明。
       ⚠️ 重抽有次數上限：抽不到就算了。
          寧可偶爾重複，也不要為了「一定不一樣」卡在迴圈裡。 */
    function newItems() {
      var was = items.join(',');
      var a = null;
      for (var t = 0; t < 12; t++) {
        /* ⚠️ opts.size 沒指定就讓 makeItems 自己抽 6～10 ——
           不可以再寫 `opts.size || 6`，那就是「每次都 6 筆」的來源。 */
        a = makeItems(opts.size, order);
        /* ★ 筆數也要換得動：只有數字不同、長度一樣的話，
           學生看到的還是「同一種題目」。抽到同長度就再抽一次。 */
        if (a.join(',') !== was && a.length !== items.length) break;
      }
      items = a;
      unsorted = items.slice(); done = []; arr = items.slice();
      boundary = 1; sel = null; round = 0;
    }

    function body() {
      var b = host.querySelector('#sl-body');
      if (mode === 'compare') { b.innerHTML = cmpHtml(); wireCmp(b); return; }
      /* ★ 兩種排序法都用**兩排** —— 選擇是「未排序／已排序」，
         插入是「牌堆／手牌」。氣泡不是，它本來就在同一排上交換。 */
      if (mode === 'selection') b.innerHTML = selHtml();
      else if (mode === 'insertion') b.innerHTML = insHtml();
      else b.innerHTML = lineHtml();
      [].forEach.call(b.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { click(Number(el.dataset.i), el); };
      });
      [].forEach.call(b.querySelectorAll('[data-slot]'), function (el) {
        el.onclick = function () { slot(Number(el.dataset.slot)); };
      });
    }

    /* ── 排序大比拼 ───────────────────────────────────
       ★ 一次比兩種排序法，資料完全一樣 —— 唯一的變因是「資料本來長怎樣」。 */
    function cmpHtml() {
      /* ★ 資料量那一排擺在最上面：學生要先決定「看幾筆」，再決定「什麼長相」。
         ⚠️ 兩排按鈕長得一樣的話會分不清在選什麼 → 各自帶標籤。 */
      var out = '<div class="sl-pick sl-size"><span class="lb">資料量</span>' +
        CMP_SIZES.map(function (n) {
          return '<button data-size="' + n + '"' + (n === cmpN ? ' class="on"' : '') + '>' +
                 comma(n) + ' 筆' + (n >= CMP_BIG ? '　💥' : '') + '</button>';
        }).join('') +
        '<span class="tip">' +
        (cmpN >= CMP_BIG
          ? '大量資料 —— 看的是「整片資料怎麼被排好」'
          : '小資料量 —— 看得清楚現在在比哪兩根') + '</span></div>';

      out += '<div class="sl-pick"><span class="lb">資料長相</span>' +
        SHAPES.map(function (sh) {
          var r = rec(sh.key);
          var cls = (sh.key === cmpShape) ? ' class="on"' : (r ? ' class="ok"' : '');
          return '<button data-shape="' + sh.key + '"' + cls + '>' +
                 sh.icon + ' ' + sh.name + (r ? ' ✓' : '') + '</button>';
        }).join('') + '</div>' + todoHtml();

      if (!cmpShape) {
        out += '<div class="sl-hint2">先選一種資料長相 —— 三種都要跑過。</div>';
        return out + cmpTable2();
      }
      var sh = shapeOf(cmpShape);
      out += '<div class="sl-shape"><span class="ic">' + sh.icon + '</span>' +
             '<span class="tx"><b>' + sh.name + '　' + comma(cmpN) + ' 筆</b>' +
             '<span class="sub">' + sh.note + '</span></span></div>';
      /* ── 這一批資料長什麼樣 ────────────────────────────
         ⚠️ 老師 2026-08-18：「10 筆資料為什麼還要列一個 41710892365 數字小卡？
            是不是前一個版本沒有改到？」—— 看起來像殘骸，因為它**沒有標籤**，
            而且動畫開始之後它還留在那裡，顯示的是**排序前**的順序，
            旁邊的長條卻正在排 —— 兩個相衝突的畫面擺在一起。
         ★ 它其實有用，但只在按下播放**之前**：
           「✅ 已經排好」那一列會是 1 2 3 4 5…，一眼就看得出資料長相不同。
         ⇒ 播放前才顯示，而且加上標籤說明它是什麼。 */
      if (!cmpOn) {
        out += '<div class="sl-before"><span class="lb">排序前的資料</span>' +
          (cmpN <= PLAN_MAX
            ? '<div class="sl-row sl-mini">' + cmpItems.map(function (v) {
                return '<span class="sl-cell done">' + esc(v) + '</span>';
              }).join('') + '</div>'
            /* ⚠️ 600 個數字擠在一起是一片噪音 —— 大資料量改畫一排靜止的長條，
               「已經排好」是一道斜坡、「完全相反」是反過來的斜坡，一眼可辨。 */
            : '<div class="sl-bars2 big">' + barsFlat(cmpItems) + '</div>') + '</div>';
      }

      if (cmpN > PLAN_MAX) return out + cmpBigHtml() + cmpTable2();

      var selP = plan(cmpItems, 'selection', 'asc');
      var insP = plan(cmpItems, 'insertion', 'asc');
      var sel = selP.compares, ins = insP.compares;
      if (!cmpOn) {
        /* ★ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
           ⚠️ 原本只有一顆按鈕，按鈕上寫「各排一次」——
              從字面上看不出按下去會有**動畫**，也看不出要看什麼。
           ⇒ 按鈕寫成「播放」，下面一句話講清楚等一下會看到什麼。 */
        out += goBox('▶ 播放排序過程',
          '按下去之後，上面這排數字會變成<b>兩排長條</b>，' +
          '一根一根被比、一根一根排好 —— 看誰先排完。' +
          (cmpTable[cmpShape] ? '<br>（這一種你看過了，可以再看一次）' : ''));
      } else {
        /* ★★ 老師 2026-08-17：「第十關能有真實的排序過程嗎？
             模擬散亂的資料，一個一個排好的過程？」
           ⚠️ 原本這裡只有兩條進度條 —— 那是**次數**，不是**過程**：
              學生看到兩條線在跑，但不知道資料發生了什麼事。
           ★ plan() 的每一格本來就帶著「這一刻的陣列長什麼樣、正在比哪兩個」，
             大比拼卻只用了它的總次數，把過程丟掉了。
           ⇒ 兩排長條同時排給他看：正在比的兩根會亮，排好的變綠。 */
        var fs1 = selP.frames[Math.min(cmpAt, selP.frames.length - 1)];
        var fs2 = insP.frames[Math.min(cmpAt, insP.frames.length - 1)];
        var lane = function (cls, name, f, now, max, plen) {
          return '<div class="sl-lane ' + cls + (cmpAt >= plen - 1 ? ' done' : '') + '">' +
                 '<div class="nm"><span>' + name + '</span><span class="ct">比了 ' + f.n +
                 ' 次' + (cmpAt >= plen - 1 ? '　✅ 排好了' : '') + '</span></div>' +
                 '<div class="sl-bars2">' + barsOf(f) + '</div>' +
                 '<div class="say">' + (f.note || '　') + '</div></div>';
        };
        out += '<div class="sl-race">' +
          lane('sel', '🎯 選擇排序', fs1, cmpSel, sel, selP.frames.length) +
          lane('ins', '🃏 插入排序', fs2, cmpIns, ins, insP.frames.length);
        if (cmpOn === 2) {
          out += '<div class="win">' +
            (sel === ins
              ? '兩邊一樣：都比了 ' + hlb(sel) + ' 次。'
              : '選擇 ' + hlb(sel) + ' 次、插入 ' + hlb(ins) + ' 次 —— 插入少了 ' +
                hl((sel - ins) + ' 次') + '。') +
            '<br>⚠️ 注意看：<b>選擇排序永遠是 ' + sel + ' 次</b>，三種資料長相都一樣。</div>' +
            '<div class="sl-side"><button data-cmp="1">↺ 再放一次動畫</button></div>';
        }
        out += '</div>';
      }
      return out + cmpTable2();
    }

    /* ── 大量資料的排序過程 ────────────────────────────
       ★ 老師 2026-08-18：「可以真實體驗大量數據排列的過程」。
       ⚠️ 這一段和小資料量長得像，但底下完全不同：
          小的是「播放事先算好的每一格」，大的是「兩台機器現在正在排」。
          所以這裡沒有 note 可以印 —— 一次跳一千多次比較，
          逐句解說反而是假的。改成講「現在排到哪裡」。 */
    function cmpBigHtml() {
      if (!cmpOn) {
        /* ⚠️ 只講選擇排序的次數，**不要**先算插入的 ——
           「你覺得哪一種先排完」是要他猜的，
           把另一個數字（哪怕是藏起來的）放進頁面就等於送答案。 */
        var pre = costOf(cmpItems, 'selection', 'asc');
        return goBox('▶ 播放 ' + comma(cmpN) + ' 筆的排序過程',
          '兩排各 ' + comma(cmpN) + ' 根長條，從<b>散亂</b>慢慢排成一道<b>斜坡</b>。' +
          '<br>⚠️ 先想一下：這一批資料，你覺得哪一種先排完？' +
          '（已知：選擇排序要比 ' + comma(pre.compares) + ' 次）' +
          (rec(cmpShape) ? '<br>（這一種你看過了，可以再看一次）' : ''));
      }
      var lane = function (cls, name, r, tot) {
        var d = r.done(), fin = r.finished();
        return '<div class="sl-lane ' + cls + (fin ? ' done' : '') + '">' +
               '<div class="nm"><span>' + name + '</span><span class="ct">比了 ' +
               comma(r.compares()) + ' 次' + (fin ? '　✅ 排好了' : '') + '</span></div>' +
               '<div class="sl-bars2 big">' + barsBig(r) + '</div>' +
               '<div class="say">' +
               (fin ? '排好了 —— 總共比了 <b>' + comma(tot) + '</b> 次。'
                    : '已經排好 <b>' + comma(d) + '</b> 項，還剩 ' +
                      comma(cmpN - d) + ' 項。') +
               '</div></div>';
      };
      var out = '<div class="sl-race">' +
        lane('sel', '🎯 選擇排序', rnSel, rnSel.compares()) +
        lane('ins', '🃏 插入排序', rnIns, rnIns.compares());
      if (cmpOn === 2) {
        var s = rnSel.compares(), i = rnIns.compares();
        /* ★ 螢光筆只畫三處：兩個次數（藍）＋ 那個倍數（黃）。
           ⚠️ 倍數才是結論 —— 「179,700 和 599」是資料，「差 300 倍」才是意思。 */
        out += '<div class="win">' +
          (s === i
            ? '兩邊一樣：都比了 ' + hlb(comma(s)) + ' 次。'
            : '選擇 ' + hlb(comma(s)) + ' 次、插入 ' + hlb(comma(i)) + ' 次 —— ' +
              (i > 0 && s / i >= 2
                ? hl('差了 ' + comma(Math.round(s / i)) + ' 倍') + '。'
                : '插入少了 ' + hl(comma(s - i) + ' 次') + '。')) +
          '<br>⚠️ ' + comma(cmpN) + ' 筆資料，選擇排序<b>永遠</b>比 ' + comma(s) +
          ' 次 —— 換成哪一種資料長相都一樣。</div>' +
          '<div class="sl-side"><button data-cmp="1">↺ 再放一次動畫</button></div>';
      }
      return out + '</div>';
    }

    /** 靜止的一排長條（排序**前**的樣子）。★ 全部同色 —— 還沒開始排，沒有誰在比。 */
    function barsFlat(a) {
      var n = a.length, out = '';
      for (var i = 0; i < n; i++) {
        out += '<i style="height:' + Math.round(a[i] / n * 100) + '%"></i>';
      }
      return out;
    }

    /** 一台跑者的現況 → 一排細長條（大資料量用，不印數字） */
    function barsBig(r) {
      var a = r.arr, n = a.length, d = r.done(), at = r.at(), bs = r.best();
      var out = '';
      for (var i = 0; i < n; i++) {
        /* ⚠️ 一根一根拼字串，不要 map().join()：
           600 根 × 每秒十幾次重畫，中間陣列是白花的。 */
        var cls = (i < d) ? ' class="ok"'
                : (i === bs) ? ' class="best"'
                : (i === at) ? ' class="cmp"' : '';
        out += '<i' + cls + ' style="height:' + Math.round(a[i] / n * 100) + '%"></i>';
      }
      return out;
    }

    /* ── 還差什麼 ──────────────────────────────────────
       ⚠️ 過關條件有幾項，畫面上就要有幾個勾。
          （這是第三次踩同一個坑：第 9 關的實驗室、第 10 關的搜尋，
            兩次都是我把條件加嚴、卻只用一行小字提示。） */
    function todoHtml() {
      var rows = SHAPES.map(function (sh) {
        var r = rec(sh.key);
        return '<li class="' + (r ? 'ok' : '') + '">' + (r ? '✅' : '⬜') + ' ' +
               sh.icon + ' ' + sh.name +
               '<span>' + (r ? '跑過了（' + comma(r.n) + ' 筆）' : '還沒跑') + '</span></li>';
      });
      rows.push('<li class="' + (ranBig ? 'ok' : '') + '">' + (ranBig ? '✅' : '⬜') +
                ' 💥 至少用 <b>' + comma(CMP_BIG) + ' 筆以上</b>跑一次' +
                '<span>' + (ranBig ? '完成' : '看大量資料被排好的樣子') + '</span></li>');
      var done = SHAPES.filter(function (sh) { return rec(sh.key); }).length + (ranBig ? 1 : 0);
      return '<div class="sl-todo"><div class="th">這一步要完成 ' + done + ' / ' +
             (SHAPES.length + 1) + '</div><ul>' + rows.join('') + '</ul></div>';
    }

    /* ── 「按這裡」的區塊 ──────────────────────────────
       ⚠️⚠️ 老師 2026-08-18：「▶ 播放 600 筆的排序過程 這個也太不明顯了，找很久才發現」。
          ★ 一顆按鈕再怎麼寫字，在一整頁內容裡就只是一顆按鈕。
            要被找到的東西不能只是「有」，它得**佔位置**：
            自己一塊、留白、虛線框、大字，還有一句「按下去會發生什麼」。
       ⚠️ 這個區塊一次只能有一個 —— 兩個「主要動作」等於沒有主要動作。 */
    /* ── 螢光筆 ────────────────────────────────────────
       ★ 老師 2026-08-18：「結論要加上螢光筆畫線記號，之前也有使用過這個功能，
         這樣學生在看完大量資料後才會更有感受。」
       ★ 沿用全站既有的兩支筆（shared/theme.css）：
           黃（.hl）＝這一段真正的結論　藍（.hl-b）＝數量
       ⚠️ 樣式**不要**在這裡再寫一份 —— theme.css 已經有了，
          兩份會慢慢長得不一樣，而且沒有人會發現是哪一天開始的
          （levelpage.test.js 就在盯這一條）。
       ⚠️ 一段最多兩三處。畫太多等於沒畫 —— 學生會略過所有黃色的東西。 */
    function hl(t) { return '<span class="hl">' + t + '</span>'; }
    function hlb(t) { return '<span class="hl-b">' + t + '</span>'; }

    function goBox(label, cap) {
      return '<div class="sl-go"><button data-cmp="1">' + label + '</button>' +
             '<div class="cap">' + cap + '</div></div>';
    }

    /** 這一種資料長相跑過的紀錄（跑過就記，不分資料量） */
    function rec(k) { return cmpTable[k] || null; }

    function comma(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    /** 一格 frame → 一排長條（正在比的兩根會亮、排好的變綠） */
    function barsOf(f) {
      var max = Math.max.apply(null, f.arr);
      return f.arr.map(function (v, i) {
        var cls = 'sl-bar';
        if (i < f.done) cls += ' ok';
        else if (f.best === i) cls += ' best';
        else if (f.cmp && (f.cmp[0] === i || f.cmp[1] === i)) cls += ' cmp';
        return '<div class="' + cls + '" style="height:' +
               Math.round(v / max * 100) + '%"><span>' + v + '</span></div>';
      }).join('');
    }

    function shapeOf(k) {
      for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].key === k) return SHAPES[i];
      return SHAPES[0];
    }

    /* 累積的對照表 —— 三列擺在一起，「選擇那一欄都一樣」才看得出來
       ⚠️ 加了資料量之後，這張表一定要有**資料量**那一欄：
          隨機跑 10 筆、已排好跑 600 筆的話，選擇那一欄當然不會一樣 ——
          沒有這一欄的話，那張表看起來就只是「數字對不上」。
       ★ 而「三列都一樣」這句結論只有在**同一個資料量**下才成立，
         所以要先看同一個 n 的三列都齊了沒。 */
    function cmpTable2() {
      var rows = SHAPES.filter(function (sh) { return cmpTable[sh.key]; });
      if (!rows.length) return '';
      var out = '<table class="sl-tbl"><tr><th>資料長相</th><th>資料量</th>' +
             '<th>選擇排序<br>比幾次</th><th>插入排序<br>比幾次</th></tr>' +
        rows.map(function (sh) {
          var r = cmpTable[sh.key];
          return '<tr><td>' + sh.icon + ' ' + sh.name + '</td>' +
                 '<td>' + comma(r.n) + '</td>' +
                 '<td class="same">' + comma(r.sel) + '</td>' +
                 '<td class="vary">' + comma(r.ins) + '</td></tr>';
        }).join('') + '</table>';
      var sameN = rows.length === SHAPES.length &&
                  rows.every(function (sh) { return cmpTable[sh.key].n === cmpTable[rows[0].key].n; });
      if (sameN) {
        out += '<div class="sl-hint2">★ 選擇排序那一欄<b>三列都一樣</b>；插入排序那一欄' +
               '從 <b>' + comma(cmpTable.sorted.ins) + '</b> 到 <b>' +
               comma(cmpTable.rev.ins) + '</b> —— 那就是兩種排序真正的差別。</div>';
      } else if (rows.length === SHAPES.length) {
        out += '<div class="sl-hint2">⚠️ 三列的<b>資料量不一樣</b>，次數當然對不起來。' +
               '想看「選擇排序永遠一樣」的話，三種長相要用<b>同一個資料量</b>各跑一次。</div>';
      }
      return out;
    }

    function wireCmp(b) {
      [].forEach.call(b.querySelectorAll('[data-shape]'), function (el) {
        el.onclick = function () { startShape(el.dataset.shape); };
      });
      [].forEach.call(b.querySelectorAll('[data-cmp]'), function (el) {
        el.onclick = startCmp;
      });
      [].forEach.call(b.querySelectorAll('[data-size]'), function (el) {
        el.onclick = function () { startSize(Number(el.dataset.size)); };
      });
    }

    /** 換資料量。★ 已經選好的資料長相要留著 —— 換的是「幾筆」，不是「哪一種」。 */
    function startSize(n) {
      if (cmpTimer) { clearInterval(cmpTimer); cmpTimer = null; }
      cmpN = n; cmpOn = 0; cmpSel = 0; cmpIns = 0; cmpAt = 0;
      rnSel = rnIns = null;
      if (cmpShape) cmpItems = shapeOf(cmpShape).make(cmpN);
      body();
      say(true, n >= CMP_BIG
        ? '換成 <b>' + comma(n) + ' 筆</b>。這麼多資料印不出每一個數字了 —— ' +
          '看的是整片長條怎麼慢慢排成一道斜坡。'
        : '換成 <b>' + comma(n) + ' 筆</b>。這個量看得清楚每一根長條在比什麼。');
    }

    function startShape(k) {
      if (cmpTimer) { clearInterval(cmpTimer); cmpTimer = null; }
      cmpShape = k; cmpOn = 0; cmpSel = 0; cmpIns = 0; cmpAt = 0;
      rnSel = rnIns = null;
      cmpItems = shapeOf(k).make(cmpN);
      body();
      /* ⚠️ say(ok, msg) 的第一個參數是**布林**（sortlab 和 searchlab 不一樣，
         那一支收的是 'good'／'bad' 字串）。傳字串的話 'bad' 是 truthy，
         會顯示成綠色的成功訊息 —— 不會報錯，只是顏色一直是對的。 */
      say(true, '這一批資料是「' + shapeOf(k).name + '」的。' +
                '兩種排序法各排一次，看誰比得少。');
    }

    function startCmp() {
      if (!cmpShape || cmpTimer) return;
      if (cmpN > PLAN_MAX) return startBig();
      var selP = plan(cmpItems, 'selection', 'asc');
      var insP = plan(cmpItems, 'insertion', 'asc');
      var sel = selP.compares, ins = insP.compares;
      /* ★ 兩邊用**同一個**計時器、同一個格數 —— 誰先排完才會是真的。
         ⚠️ 各自跑各自的計時器，看起來就像兩支影片各播各的，
            那個「插入排序早就排完了、選擇排序還在比」的畫面就不見了。 */
      var last = Math.max(selP.frames.length, insP.frames.length) - 1;
      cmpOn = 1; cmpAt = 0; cmpSel = 0; cmpIns = 0;
      if (!CMP_MS) {                       // 測試用：直接跑完
        cmpAt = last; cmpSel = sel; cmpIns = ins; cmpOn = 2;
        record(sel, ins);
        body(); finishCmp(); return;
      }
      cmpTimer = setInterval(function () {
        cmpAt++;
        cmpSel = selP.frames[Math.min(cmpAt, selP.frames.length - 1)].n;
        cmpIns = insP.frames[Math.min(cmpAt, insP.frames.length - 1)].n;
        if (cmpAt >= last) {
          clearInterval(cmpTimer); cmpTimer = null;
          cmpAt = last; cmpOn = 2;
          record(sel, ins);
          body(); finishCmp(); return;
        }
        body();
      }, CMP_MS);
      body();
    }

    /* ── 大量資料：兩台機器現在正在排 ───────────────────
       ⚠️ 不可以先算好每一格（見 PLAN_MAX）——
          600 筆選擇排序有十八萬次比較，存起來會爆掉。
       ★ 兩邊每一拍走**同樣的步數**，
         「插入排序早就排完、選擇排序還在爬」那個畫面才是真的。 */
    function startBig() {
      var cs = costOf(cmpItems, 'selection', 'asc');
      var ci = costOf(cmpItems, 'insertion', 'asc');
      rnSel = runner(cmpItems, 'selection', 'asc');
      rnIns = runner(cmpItems, 'insertion', 'asc');
      cmpOn = 1;
      if (!CMP_MS) {                        // 測試用：直接跑完
        rnSel.advance(cs.steps); rnIns.advance(ci.steps);
        cmpOn = 2; record(cs.compares, ci.compares);
        body(); finishCmp(); return;
      }
      /* 一拍要走幾步：整段跑 BIG_SEC 秒。
         ⚠️ 用**兩邊比較長的那一個**算 —— 用短的算的話，
            長的那一邊會被拖成好幾十秒。 */
      /* ⚠️ 大資料量的一拍要比小資料量慢一點：
         每一拍要重畫 1,200 根長條，教室那批舊電腦跟不上 60 毫秒的話，
         畫面會變成一頓一頓的 —— 而學生只會覺得「這個網頁很卡」。
         ★ 整段仍然是 BIG_SEC 秒（拍子變慢，一拍就走多一點）。 */
      var ms = Math.max(CMP_MS, 70);
      var ticks = Math.max(1, Math.round(BIG_SEC * 1000 / ms));
      var per = Math.max(1, Math.ceil(Math.max(cs.steps, ci.steps) / ticks));
      cmpTimer = setInterval(function () {
        rnSel.advance(per); rnIns.advance(per);
        if (rnSel.finished() && rnIns.finished()) {
          clearInterval(cmpTimer); cmpTimer = null;
          cmpOn = 2; record(rnSel.compares(), rnIns.compares());
          body(); finishCmp(); return;
        }
        paintBig();
      }, ms);
      body();
    }

    /* ── 只重畫會動的那幾塊 ────────────────────────────
       ⚠️ 每一拍都呼叫 body() 的話，整段大比拼都會被重建 ——
          600 根 × 2 排 × 每秒十幾次，再加上按鈕、清單、對照表。
          畫面不會壞，但舊電腦會卡，而「卡」看起來就像動畫在頓。
       ★ 動的只有兩排長條和它們的次數 —— 只換那幾塊。
       ⚠️ 找不到的時候要退回 body()：第一拍還沒畫出來就是這種情況。 */
    function paintBig() {
      var lanes = host.querySelectorAll('.sl-bars2.big');
      if (lanes.length !== 2) { body(); return; }
      var rs = [rnSel, rnIns];
      for (var i = 0; i < 2; i++) {
        lanes[i].innerHTML = barsBig(rs[i]);
        var lane = lanes[i].parentNode;
        var ct = lane.querySelector('.ct'), sy = lane.querySelector('.say');
        if (ct) ct.innerHTML = '比了 ' + comma(rs[i].compares()) + ' 次' +
                               (rs[i].finished() ? '　✅ 排好了' : '');
        if (sy) sy.innerHTML = rs[i].finished()
          ? '排好了 —— 總共比了 <b>' + comma(rs[i].compares()) + '</b> 次。'
          : '已經排好 <b>' + comma(rs[i].done()) + '</b> 項，還剩 ' +
            comma(cmpN - rs[i].done()) + ' 項。';
        if (rs[i].finished()) lane.className = lane.className.replace(/ done$/, '') + ' done';
      }
    }

    /** 記下這一輪的結果。★ 資料量要一起記 —— 對照表少了它就看不懂。 */
    function record(sel, ins) {
      cmpTable[cmpShape] = { sel: sel, ins: ins, n: cmpN };
      if (cmpN >= CMP_BIG) ranBig = true;
    }

    function finishCmp() {
      var miss = SHAPES.filter(function (sh) { return !cmpTable[sh.key]; });
      /* ⚠️ 兩個條件要**一起**講。分兩次講的話，學生把三種長相跑完、
         看到「還差大資料量」，會覺得系統又臨時加了一條。
         ★ 上面的清單本來就一直看得到 —— 這裡只是把它唸出來。 */
      if (miss.length || !ranBig) {
        var todo = miss.map(function (sh) { return sh.icon + ' ' + sh.name; });
        if (!ranBig) todo.push('💥 至少用 ' + comma(CMP_BIG) + ' 筆以上跑一次');
        say(true, '記下來了。還差：' + todo.join('、') + '。' +
                  (miss.length ? '' : '<br>三種長相都跑過了 —— ' +
                   '剩下的是<b>大量資料</b>那一次：把資料量換成 ' + comma(CMP_BIG) +
                   ' 筆以上，看整片資料被排好的樣子。'));
        return;
      }
      if (passed) return;
      passed = true;
      /* ⚠️ 「選擇排序永遠 N 次」只有在三種長相用**同一個資料量**時才成立。
         學生可以隨機跑 10 筆、已排好跑 600 筆 —— 那時候這句話是錯的。 */
      var sameN = SHAPES.every(function (sh) {
        return cmpTable[sh.key].n === cmpTable.rand.n;
      });
      say(true, '三種都跑完了，大量資料也看過了。' +
                (sameN
                  ? '<b>選擇排序永遠 ' + comma(cmpTable.rand.sel) + ' 次</b>，' +
                    '插入排序從 ' + comma(cmpTable.sorted.ins) + ' 到 ' +
                    comma(cmpTable.rev.ins) + ' —— 差別在「資料本來長怎樣」。'
                  : '⚠️ 你三種用的<b>資料量不一樣</b>，所以次數不能直接比 —— ' +
                    '想看「選擇排序永遠一樣」的話，用同一個資料量再跑一輪。'));
      if (opts.onPass) opts.onPass(0);
    }

    function selHtml() {
      return '<div class="sl-round">第 ' + round + ' 回合</div>' +
        row('未排序', unsorted, true) + row('已排序', done, false);
    }
    function row(tag, list, live) {
      return '<div class="sl-row"><span class="sl-tag">' + tag + '</span>' +
        (list.length
          ? list.map(function (v, i) {
              return '<button class="sl-cell' + (live ? '' : ' done') + '"' +
                (live ? ' data-i="' + i + '"' : '') + '>' + esc(v) + '</button>';
            }).join('')
          : '<span class="sl-empty">（空的）</span>') + '</div>';
    }

    /* ── 插入排序：兩排（老師 2026-08-18）────────────────
       ★ 「插入排序的『動手試一次』應該也要使用兩排，
         不然最大數排到最後不好表示。」—— 說得對，而且是兩個問題疊在一起：

       ⚠️ 問題一：新牌**比手上每一張都大**的時候，正確的插入點是
          已排好那一段的**最尾巴**，而它剛好緊貼在橘框新牌的左邊。
          一整排的畫面上，那個插入點和「新牌本來的位置」看起來一模一樣 ——
          學生做對了也感覺不出自己做了什麼，做錯了也看不出差在哪。

       ⚠️ 問題二：一整排的排法讓「已排好」和「還沒抽」黏在一起，
          而 INFO.insertion.life 講的是**兩疊牌**：
          「蓋著的牌堆每次抽一張，插進手上已經排好的牌裡」。
          畫面和比喻對不上，學生要自己在腦中翻譯一次。

       ⇒ 拆成兩排，和選擇排序同一個版型（那一邊本來就是兩排）：
           🖐️ 手上排好的牌　＋ 插入點（含**最尾巴**那一個）
           🂠 還沒抽的牌堆　第一張＝這一回合的新牌（橘框）
       ⚠️ 資料結構完全不動 —— 還是同一個 arr 和 boundary，
          slot 的編號也照舊（0～boundary）。
          動了資料結構的話，checkInsertion／doInsert／驗收挑戰都要跟著改。 */
    function insHtml() {
      var hand = '<div class="sl-row"><span class="sl-tag">🖐️ 手上排好的牌</span>';
      for (var i = 0; i < boundary; i++) {
        hand += '<button class="sl-slot" data-slot="' + i + '" title="插在這裡"></button>';
        hand += '<button class="sl-cell done" data-i="' + i + '">' + esc(arr[i]) + '</button>';
      }
      /* ★★ 最尾巴那一個插入點 —— 老師指的「最大數排到最後」就靠它。
         ⚠️ 它一定要**畫在手牌這一排的最後**，不是黏在新牌旁邊：
            黏著的話又回到「看起來像沒動」的老問題。 */
      hand += '<button class="sl-slot last" data-slot="' + boundary +
              '" title="插在最後面（比手上每一張都大）"></button>';
      if (!boundary) hand += '<span class="sl-empty">（還沒有牌）</span>';
      hand += '</div>';

      var pile = '<div class="sl-row"><span class="sl-tag">🂠 還沒抽的牌堆</span>';
      if (boundary >= arr.length) {
        pile += '<span class="sl-empty">（抽完了）</span>';
      } else {
        for (var k = boundary; k < arr.length; k++) {
          var cls = 'sl-cell' + (k === boundary ? ' card' : '') + (sel === k ? ' sel' : '');
          pile += '<button class="' + cls + '" data-i="' + k + '">' + esc(arr[k]) + '</button>';
        }
      }
      pile += '</div>';
      return '<div class="sl-round">第 ' + boundary + ' 張已經排好</div>' + pile + hand;
    }

    /* 氣泡：一整排（它本來就是在同一排上兩兩交換，拆成兩排反而不對） */
    function lineHtml() {
      var out = '<div class="sl-row">';
      arr.forEach(function (v, i) {
        if (mode === 'insertion' && i <= boundary - 1) {
          out += '<button class="sl-slot" data-slot="' + i + '" title="插在這裡"></button>';
        }
        var cls = 'sl-cell';
        if (mode === 'insertion') {
          if (i < boundary) cls += ' done';
          else if (i === boundary) cls += ' card';
        }
        if (sel === i) cls += ' sel';
        out += '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button>';
      });
      if (mode === 'insertion' && boundary > 0) {
        out += '<button class="sl-slot" data-slot="' + boundary + '" title="插在這裡"></button>';
      }
      return out + '</div>';
    }

    function say(ok, msg) {
      var m = host.querySelector('#sl-msg');
      m.className = 'sl-msg ' + (ok ? 'good' : 'bad');
      m.innerHTML = (ok ? '✓ ' : '✗ ') + msg;
    }
    function flash(el) {
      errs++;                     // 零失誤那一關要數
      if (!el) return;
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 650);
    }
    function finish() {
      /* 挑戰第 2 關（零失誤）：排完這一題就結算。 */
      if (lvNow === 2) {
        if (errs === 0) {
          cleared[2] = true; lvNow = 3;
          tsay('good', '整題零失誤 ⭐⭐<br>最後一關：不必真的排，直接算給我看。');
        } else {
          var n = errs;
          newItems(); errs = 0;      // 同上：系統自己換，不要叫他去按按鈕
          tsay('bad', '這一題點錯了 ' + n + ' 次。<b>已經換了一組新的</b>，再挑戰一次。');
        }
        return;
      }
      if (passed) return;
      passed = true;
      say(true, '排好了！' + info.why);
      trace(); auto();             // ★ 通關才出現這兩區，這裡要重畫一次
      openTest();
    }

    function click(i, el) {
      if (mode === 'selection') {
        var r = checkSelection(unsorted, i, order);
        if (!r.ok) { flash(el); say(false, r.msg); return; }
        done.push(unsorted.splice(i, 1)[0]);
        if (unsorted.length) {
          say(true, '把 ' + done[done.length - 1] + ' 加到「已排序」的最後一項，並從「未排序」刪掉。');
          body();
        } else { body(); finish(); }
        return;
      }
      if (mode === 'bubble') {
        if (sel === null) { sel = i; body(); return; }
        var rb = checkBubble(sel, i);
        if (!rb.ok) { flash(el); say(false, rb.msg); sel = null; body(); return; }
        var t = arr[sel]; arr[sel] = arr[i]; arr[i] = t;
        sel = null; body();
        if (sorted(arr, order)) finish(); else say(true, '交換了。');
        return;
      }
      // insertion：只能點橘框那一張
      if (i !== boundary) {
        flash(el);
        say(false, '這一回合要處理的是<b>橘框</b>那一張新牌。');
        return;
      }
      sel = i; body();
      say(true, '選好了。現在點左邊要插進去的位置（虛線框）。');
    }

    function slot(pos) {
      if (mode !== 'insertion') return;
      if (sel === null) { say(false, '先點橘框那張新牌。'); return; }
      var r = checkInsertion(arr, boundary, pos, order);
      if (!r.ok) { say(false, r.msg); return; }
      arr = doInsert(arr, boundary, pos);
      sel = null; boundary++;
      body();
      if (boundary >= arr.length) finish();
      else say(true, '插好了。換下一張新牌。');
    }

    /* ── 驗收挑戰 ──────────────────────────────────
       ★ 手動排完才開。三關，一關一顆星。
       ⚠️ 第 1 關的答案就在下面的自動播放裡 ——
          預測完自己按來驗證，比我直接給答案有用得多。 */
    function openTest() {
      if (freePassed) return;
      freePassed = true;
      if (!global.LABTEST) { finishAll(); return; }
      lvNow = 1;
      /* ⚠️⚠️ 開挑戰之前一定要換一組新的，有兩個理由：
         ① 第 1 關問「上面那 N 筆用這個排序法要比幾次」——
            但畫面上那一排是他**剛剛排好的結果**，不是原始順序。
            對插入排序來說這兩個數字差很多（已排好只要 n−1 次），
            題目和畫面指的不是同一件事，而**兩邊都沒有寫出來**。
            （選擇排序剛好都是 n(n−1)/2，所以這個錯一直沒被發現。）
         ② 他才剛用手排完那一組，次數等於是他自己數過的 —— 這一關就白出了。
         ⇒ 換一組沒排過的，題目、畫面、自動播放三邊指的才是同一組資料。 */
      newItems();
      errs = 0;
      render();
    }
    function finishAll() {
      if (opts.onPass) opts.onPass(stars());
    }
    function stars() { return global.LABTEST ? global.LABTEST.starsOf(cleared) : 0; }

    function test() {
      var box = host.querySelector('#sl-test');
      if (!box) return;
      if (!lvNow) { box.innerHTML = ''; return; }
      if (lvNow > 3) {
        box.innerHTML = global.LABTEST.certificate(3, { title: info.name + '　驗收挑戰' });
        return;
      }
      var L = global.LABTEST.LEVELS[lvNow - 1];
      var head = '<div class="lt-box"><div class="h">' + L.icon +
                 ' 驗收挑戰 ' + lvNow + '／3　' + L.name + '（目前 ' + stars() + ' ★）</div>';
      if (lvNow === 1) {
        /* ⚠️ 不可以寫「上面那 N 筆」——
           插入排序的畫面是**兩排**（牌堆在上、手牌在下），
           由上往下讀到的順序**不是**原始順序，
           而這一關的答案跟原始順序有關（插入排序看資料長相）。
           ⇒ 直接把那一組數字印出來，題目和畫面就不會各講各的。 */
        box.innerHTML = head +
          '<div class="q">這一組 <b>' + items.length + '</b> 筆資料：' +
          '<b style="color:#4338ca">' + items.map(esc).join('、') + '</b><br>' +
          '用<b>' + info.name + '</b>排好，總共要<b>比幾次</b>？' +
          '<br><span style="font-size:12.5px">想不出來？下面的自動播放會幫你數 ——' +
          '但先自己猜一個。</span></div>' +
          '<div class="row"><input id="sl-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="1">送出預測</button></div></div>';
      } else if (lvNow === 2) {
        box.innerHTML = head +
          '<div class="q">這是<b>新的一組</b>（系統已經幫你換好了）。' +
          '<b>全程不能點錯</b> —— 點錯的話排完會自動再換一組。' +
          '<br>目前這一題已經錯了 <b>' + errs + '</b> 次。</div></div>';
      } else {
        box.innerHTML = head +
          '<div class="q">' + TESTS.worstAsk +
          '<br><span style="font-size:12.5px">這一關<b>不必真的排</b> ——' +
          '想想每一輪要看幾個。</span></div>' +
          '<div class="row"><input id="sl-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="3">送出答案</button></div></div>';
      }
      box.innerHTML += '<div class="lt-say ' + testKind + '" id="sl-tsay">' +
                       (testMsg || '　') + '</div>';
      [].forEach.call(box.querySelectorAll('[data-g]'), function (el) {
        el.onclick = function () { submit(Number(el.dataset.g)); };
      });
    }

    function submit(which) {
      var inp = host.querySelector('#sl-g');
      var v = Number(inp && inp.value);
      if (!(v > 0)) { tsay('info', '先填一個數字。'); return; }
      if (which === 1) {
        var real = plan(items, mode, order).compares;
        if (v === real) {
          cleared[1] = true; lvNow = 2; errs = 0;
          /* ⚠️ 以前這裡寫「按🎲換一題拿一組新的」—— 叫學生自己去按。
             他忘了按的話，手上那一題**已經排好了**，怎麼點都沒反應；
             而畫面上寫著「全程不能點錯」，他只會覺得系統壞了。
             ⇒ 系統自己換。訊息說換了，那就真的換了。 */
          newItems();
          tsay('good', '猜中了 —— 真的是 <b>' + real + '</b> 次 ⭐<br>' +
                       '下一關：<b>已經換了一組新的</b>，這一次<b>全程不能點錯</b>。');
        } else {
          tsay('bad', '你猜 ' + v + '，實際是 <b>' + real + '</b> 次。' +
                      '<br>用下面的自動播放按「下一步」數一遍，看看差在哪 —— 然後再猜一次。');
        }
        return;
      }
      var want = TESTS.worstAns(TESTS.worstSize);
      if (v === want) {
        cleared[3] = true; lvNow = 4;
        tsay('good', '對了 —— <b>' + want + '</b> 次。' + TESTS.worstWhy +
                     '<br>三關全過，證書拿到了 ★★★');
        render(); finishAll();
      } else {
        tsay('bad', '不是 ' + v + ' 次。' + TESTS.worstWhy + '<br>再想一次。');
      }
    }
    function tsay(kind, msg) { testKind = kind; testMsg = msg; render(); }

    /* ── 變數追蹤區（只有第 6 關開）─────────────────
       ★ 位置在「手動」和「自動」中間，順序是刻意的：
         你剛才用眼睛挑最小的 → 電腦怎麼挑 → 30 筆跑一遍。
       ⚠️ 一樣要通關才出現。還沒自己挑過就先看程式，
          他看到的只是一段沒有來由的積木。 */
    var tr = null, tAt = 0;

    function trace() {
      var box = host.querySelector('#sl-trace');
      if (!box) return;
      if (!opts.trace || !passed) { box.innerHTML = ''; return; }
      /* 用課本的那一組（8、5、10、1、7）—— 學生對得回課本 p.193 的表。 */
      if (!tr) { tr = traceMin(opts.traceItems || [8, 5, 10, 1, 7], order); tAt = 0; }
      var s = tr.steps[tAt], vals = opts.traceItems || [8, 5, 10, 1, 7];
      var last = tAt >= tr.steps.length - 1;

      box.className = 'sl-tr';
      box.innerHTML =
        '<h4>🔬 電腦是怎麼「看出」最小的那一個？</h4>' +
        '<div class="lead">你剛剛是<b>一眼</b>就挑出來的。電腦沒有眼睛 ——' +
        '它只能一次比一個，而且要用<b>兩個變數</b>記著。一步一步看下去。</div>' +
        '<div class="sl-row">' + vals.map(function (v, i) {
          var cls = 'sl-cell';
          if (s.mp === i + 1) cls += ' mp';
          else if (s.dp === i + 1) cls += ' dp';
          return '<span class="' + cls + '">' + esc(v) + '</span>';
        }).join('') + '</div>' +
        '<div class="sl-var">' +
        '<span>資料位置 <b>' + (s.dp > vals.length ? '—' : s.dp) + '</b></span>' +
        '<span>最小值位置 <b>' + (s.mp || '—') + '</b></span>' +
        '<span>比較次數 <b>' + tr.steps.slice(0, tAt + 1).filter(function (x) { return x.cmp; }).length + '</b></span>' +
        '</div>' +
        '<div class="sl-code">' + TRACE_CODE.map(function (t, i) {
          return '<div' + (i === s.line ? ' class="now"' : '') + '>' + esc(t) + '</div>';
        }).join('') + '</div>' +
        '<div class="sl-note">' + s.note + '</div>' +
        '<div class="sl-ctrl">' +
        (last ? '<button data-treset="1">↺ 再看一次</button>'
              : '<button data-tstep="1">▶ 下一步</button>' +
                '<button data-tall="1">⏭ 一路跑完</button>') +
        '</div>';
      var b1 = box.querySelector('[data-tstep]'), b2 = box.querySelector('[data-tall]'),
          b3 = box.querySelector('[data-treset]');
      if (b1) b1.onclick = function () { tAt++; trace(); };
      if (b2) b2.onclick = function () { tAt = tr.steps.length - 1; trace(); };
      if (b3) b3.onclick = function () { tr = null; trace(); };
    }

    /* ── 自動播放區 ────────────────────────────────
       ★ 先手動、後自動 —— 順序是刻意的。
         先看動畫的話，學生會覺得「原來這麼快」，
         然後在手動那一關卡住卻不知道自己卡在哪。
         自己排過六個之後再看 30 個跑，他看的是**自己剛做過的事**。
       ⚠️ 所以這一區在通關之前不出現。 */
    function auto() {
      var box = host.querySelector('#sl-auto');
      if (!box) return;
      if (opts.auto === false || !passed) { box.innerHTML = ''; return; }
      if (!pl) { pl = plan(makeItems(opts.autoSize || 30, order), algo, order); at = 0; }
      var f = pl.frames[at];
      box.className = 'sl-auto';
      var last = at >= pl.frames.length - 1;
      box.innerHTML =
        '<h4>📺 換 ' + f.arr.length + ' 筆資料，一步一步看它怎麼排</h4>' +
        '<div class="lead">你剛剛用手排六個。同樣的方法，' + f.arr.length + ' 筆要比幾次？' +
        '<br><b>看不懂就按「下一步」</b> —— 每一步下面都會告訴你它剛才做了什麼。' +
        '想快轉再按「自動播放」。</div>' +
        '<div class="sl-bars" id="sl-bars"></div>' +
        /* ★ 解說列。⚠️ 給固定高度 —— 文字長短不一，
           不固定的話按一下「下一步」整頁就往上下彈一格。 */
        '<div class="sl-say" id="sl-say">' + (f.note || '　') + '</div>' +
        '<div class="sl-ctrl">' +
        /* ★★ 老師 2026-08-18：「『🫧 氣泡排序法』不在課程內，
             在旁加個補充介紹的按鈕，會有浮動視窗顯示簡介說明。」
             （第 6、7 關都要 —— 這一區兩關共用，所以改一次兩邊都有。）
           ⚠️ 課本第 6 章只教選擇與插入。氣泡放在這裡是**補充**，
              但畫面上和另外兩顆長得一模一樣 ——
              學生會以為它也是要考的，或是以為自己漏學了一種。
           ⇒ 標一個「補充」，旁邊給一顆 ❓ 打開說明。 */
        ['selection', 'insertion', 'bubble'].map(function (m) {
          var extra = (m === 'bubble');
          /* ⚠️ 老師 2026-08-18：「那個 ❓ 會跑出格子，排版不良，
             『補充』標籤的型態可能比較適合。」
             —— 原本是一顆圓的 ❓ 小按鈕：它和旁邊那排方形按鈕
             既不同形狀也不同大小，夾在中間就變成一個突出的小方塊。
             ⇒ 標籤**本身**就是按鈕：藥丸形、小一號、琥珀色，
               形狀上明顯是「附註」而不是「另一個選項」。
             ★ 這樣也少一個元素 —— 原本「靜態的補充字樣」和「❓ 按鈕」
               其實在講同一件事，擺兩個只是把版面弄擠。 */
          return '<button data-algo="' + m + '"' +
                 (m === algo ? ' class="on"' : '') + '>' +
                 INFO[m].icon + ' ' + INFO[m].name + '</button>' +
                 (extra ? '<button class="sl-ex" data-why="bubble" ' +
                          'title="氣泡排序法不在課程內 —— 點開看簡介">補充 ⓘ</button>' : '');
        }).join('') +
        (last ? '<button data-again="1">↺ 再看一次</button>'
              : '<button data-step="1">⏭ 下一步</button>' +
                '<button data-play="1">' + (timer ? '⏸ 暫停' : '▶ 自動播放') + '</button>') +
        '<button data-new="1">🎲 換一組</button>' +
        '<span class="num">第 ' + at + ' 步　比較次數 <b>' + f.n + '</b>' +
        (last ? '　✅ 排好了' : '') + '</span></div>';
      bars(f);
      [].forEach.call(box.querySelectorAll('[data-algo]'), function (el) {
        el.onclick = function () { stop(); algo = el.dataset.algo; pl = null; auto(); };
      });
      var b;
      if ((b = box.querySelector('[data-step]'))) b.onclick = function () { stop(); step(); };
      if ((b = box.querySelector('[data-play]'))) b.onclick = toggle;
      if ((b = box.querySelector('[data-again]'))) b.onclick = function () { at = 0; auto(); };
      if ((b = box.querySelector('[data-new]'))) b.onclick = function () { stop(); pl = null; auto(); };
      [].forEach.call(box.querySelectorAll('[data-why]'), function (el) {
        el.onclick = function () { openWhy(el.dataset.why); };
      });
    }

    /* ── 補充說明的浮動視窗 ────────────────────────────
       ★ 老師 2026-08-18 指定：氣泡排序法不在課程內，要有補充介紹。
       ⚠️ 用**模態**（蓋一層黑幕）而不是展開一段文字：
          展開的話整頁會往下推，學生剛才在看的長條就跑掉了。
       ⚠️ 三件事一定要做，不然它會變成一個關不掉的東西：
          ① 黑幕點下去要能關　② Esc 要能關　③ 一定要有一顆看得見的關閉鈕
       ⚠️ 而且要講清楚「這一段不考」—— 補充教材最怕的是學生以為要背。 */
    /* ⚠️ 這一支用的是**裸的 document**，和 ensureStyle() 一樣 ——
       不要寫 global.document：這個檔案裡的 global 是外面傳進來的 window，
       在瀏覽器裡它剛好有 document，但在測試的替身 window 上沒有。
       整份檔案只能有一種拿 document 的方式。 */
    function openWhy(key) {
      var d = WHY[key];
      if (!d) return;
      var wrap = document.createElement('div');
      wrap.className = 'sl-modal';
      wrap.innerHTML =
        '<div class="sl-card" role="dialog" aria-modal="true">' +
        '<div class="hd"><span>' + d.icon + ' ' + d.name +
        '<span class="ex">補充</span></span>' +
        '<button class="x" data-close="1" aria-label="關閉">✕</button></div>' +
        '<div class="bd">' + d.html + '</div>' +
        '<div class="ft"><button class="sl-btn" data-close="1">知道了</button></div></div>';
      var close = function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        document.removeEventListener('keydown', onKey);
      };
      var onKey = function (e) { if (e.key === 'Escape') close(); };
      wrap.onclick = function (e) { if (e.target === wrap) close(); };
      [].forEach.call(wrap.querySelectorAll('[data-close]'), function (el) {
        el.onclick = close;
      });
      document.addEventListener('keydown', onKey);
      host.appendChild(wrap);
      var x = wrap.querySelector('.x');
      if (x && x.focus) x.focus();
    }

    /* 走一步 —— 按鈕和自動播放共用同一條路，不會有兩套走法。 */
    function step() {
      if (at >= pl.frames.length - 1) return;
      at++;
      auto();
    }

    function bars(f) {
      var b = host.querySelector('#sl-bars');
      if (!b) return;
      var max = Math.max.apply(null, f.arr);
      b.innerHTML = f.arr.map(function (v, i) {
        var cls = 'sl-bar';
        if (i < f.done) cls += ' ok';
        else if (f.best === i) cls += ' best';
        else if (f.cmp && (f.cmp[0] === i || f.cmp[1] === i)) cls += ' cmp';
        return '<div class="' + cls + '" style="height:' +
               Math.round(v / max * 100) + '%"></div>';
      }).join('');
    }

    function toggle() { timer ? stop() : play(); auto(); }
    function play() {
      if (at >= pl.frames.length - 1) { at = 0; }
      timer = setInterval(function () {
        at++;
        if (at >= pl.frames.length - 1) { at = pl.frames.length - 1; stop(); auto(); return; }
        bars(pl.frames[at]);
        /* 自動播放時只換會變的那幾塊，不整段重畫 ——
           整段重畫會讓按鈕在腳下閃爍，按不準。 */
        var num = host.querySelector('.sl-ctrl .num b');
        if (num) num.textContent = pl.frames[at].n;
        var st = host.querySelector('.sl-ctrl .num');
        if (st) st.innerHTML = '第 ' + at + ' 步　比較次數 <b>' + pl.frames[at].n + '</b>';
        var say = host.querySelector('#sl-say');
        if (say) say.innerHTML = pl.frames[at].note || '　';
      }, speed);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    return { destroy: function () { stop(); host.innerHTML = ''; } };
  }

  /** 這一步的目標與過關標準（說明見 searchlab.js 的同名函式）。 */
  function goal(lab) {
    var m = (lab && lab.mode) || 'selection';
    var name = (INFO[m] || {}).name || '排序法';
    /* ★ 大比拼的目標和「手排一次」完全不同 —— 它不用排，它在比。 */
    if (m === 'compare') {
      return {
        why: '第 6、7 關你各排過一次，但<b>沒有把兩種放在一起比過</b>。' +
             '同一批資料、同一個結果，兩種排序法要比的次數卻不一樣 ——' +
             '<br>而且差別不在演算法本身，在<b>資料本來長什麼樣</b>。' +
             /* ★ 2026-08-18 老師：「怎麼找不到可以看動畫的位置？」
                ⇒ 入口寫在最上面的橫幅，不要只留在按鈕上。 */
             '<br>🎬 <b>動畫在哪裡</b>：先選<b>資料量</b>和<b>資料長相</b>，' +
             '再按「▶ 播放排序過程」—— 兩排長條會同時開始排，一根一根比給你看。' +
             '<br>💥 資料量調到 <b>' + CMP_BIG + ' 筆以上</b>，看的就不是「哪兩根在比」，' +
             '而是<b>一整片散亂的資料慢慢排成一道斜坡</b>。',
        pass: '① 三種資料長相（🎲 隨機、✅ 已經排好、🔄 完全相反）' +
              '<b>都要讓兩種排序法比一場</b>；' +
              '<br>② 其中<b>至少一次</b>要用 <b>' + CMP_BIG + ' 筆以上</b>的資料量。'
      };
    }
    return {
      why: '用手排一次' + name + '。' +
           '同一批資料、同一個結果，但<b>怎麼排</b>兩種方法完全不同 —— ' +
           '那個差別用讀的讀不出來，要自己動手才會有感覺。',
      pass: '① 自由玩：把整排資料<b>排好</b>（點錯會擋下來並說明原因）<br>' +
            '② 驗收挑戰 <b>三關全過</b>：預測次數 → 零失誤 → 最壞情況'
    };
  }

  global.SORTLAB = {
    goal: goal,
    VERSION: VERSION,
    INFO: INFO,
    mount: mount,
    TESTS: TESTS,
    _plan: plan,
    _runner: runner,
    _costOf: costOf,
    PLAN_MAX: PLAN_MAX,
    _traceMin: traceMin,
    TRACE_CODE: TRACE_CODE,
    _bestOf: bestOf,
    _checkSelection: checkSelection,
    _checkBubble: checkBubble,
    _checkInsertion: checkInsertion,
    _doInsert: doInsert,
    _sorted: sorted,
    _makeItems: makeItems
  };

})(typeof window !== 'undefined' ? window : this);
