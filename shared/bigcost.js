/* =====================================================================
   實作體驗：資料大爆炸（第 10 關 6-3-3 的最後一步）
   ---------------------------------------------------------------------
   ★ 這一關的定位變了（老師 2026-08-17）
     原本叫「搜尋大比拼」，還要學生再拼一支循序搜尋 ——
     但這一關比的是**第 8、9 關寫過的那兩支程式**，它自己不該再寫一支。
     而且它其實是**第 6 章的總結**：排序（6、7 關）＋ 搜尋（8、9 關）。
     ⇒ 改名「資料大爆炸」（五個字，和第 5～9 關同一個節奏），
     最後一步換成一段體驗。

   ★★ 這一段要讓學生撞到的那件事
     四關各自都學過了，但**沒有人把它們放在一起看過**：
       · 排序很**貴**：100 筆用選擇排序要比 4950 次
       · 搜尋差很多：同樣 100 筆，循序最多 100 次、二元只要 7 次
       · 但二元搜尋**要先排好序** —— 而排序那 4950 次是先付掉的
     ⇒ 所以真正的問題不是「哪一個比較快」，而是
       **「你要查幾次？」**
         查 1 次　 → 不必排（100 次 vs 4957 次）
         查 108 次 → 先排划算（10800 次 vs 5706 次）
       ⚠️ 那個分界點跟著資料量跑（100 筆是 54 次、1000 筆是 505 次）——
          所以第二個情境的次數是**現算**的，不可以寫死。
     那個「看情況」才是這一章真正的結論。

   ⚠️ 不要把它做成「二元搜尋比較好」。
      課本上那句「二元搜尋比較快」是有前提的 ——
      前提沒講的話，學生會以為排序是免費的。

   用法：
     BIGCOST.mount(host, { onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-bigcost';

  /* ── 規則（純函式）───────────────────────────────── */

  /**
   * 選擇排序要比幾次。
   * ★ 第一回合比 n-1 次、第二回合 n-2 次…… 加起來 n(n-1)/2。
   *   ⚠️ 和第 5 關的「找一個最小值要比 n-1 次」是**同一件事做 n 遍** ——
   *      這一段就是要學生看見那個「n 遍」有多可怕。
   */
  function selCompares(n) { return n * (n - 1) / 2; }

  /**
   * 插入排序**最壞情況**要比幾次（完全相反的順序）。
   * ★ 和選擇排序一樣是 n(n-1)/2 —— 這件事本身就是重點：
   *   兩種排序法在最壞情況下**一樣貴**，差別在平均與資料本來的樣子。
   * ⚠️ 所以這一段不要問「哪一種比較快」（沒有答案），
   *    要問「最壞情況一樣嗎」（一樣）。
   */
  function insWorst(n) { return n * (n - 1) / 2; }

  /**
   * 插入排序**最好情況**：資料本來就排好了，每張牌只要比 1 次。
   * ★ 這是兩種排序唯一真正的差別 ——
   *   選擇排序不管資料長什麼樣，都要比 n(n-1)/2 次。
   */
  function insBest(n) { return n - 1; }

  /** 循序搜尋最壞要比幾次 */
  function seqWorst(n) { return n; }

  /** 二元搜尋最壞要比幾次（每次砍一半，砍到空） */
  function binWorst(n) {
    var c = 0, left = n;
    while (left > 0) { left = Math.floor(left / 2); c++; }
    return c;
  }

  /**
   * 兩種策略的總成本。
   * @param n 資料量　@param k 要查幾次
   *   不排序：每次都用循序 → k × n
   *   先排序：排一次 + 每次用二元 → n(n-1)/2 + k × log2(n)
   */
  function costPlain(n, k) { return k * seqWorst(n); }
  function costSorted(n, k) { return selCompares(n) + k * binWorst(n); }

  /** 哪一種划算（'plain' / 'sorted' / 'same'） */
  function better(n, k) {
    var a = costPlain(n, k), b = costSorted(n, k);
    return a < b ? 'plain' : (b < a ? 'sorted' : 'same');
  }

  /**
   * 要查幾次以上，先排序才開始划算。
   * ⚠️ 用逐次試的，不用解不等式 —— 這裡的數字很小，而且
   *    寫成公式之後沒有人看得懂它在算什麼。
   */
  function breakEven(n) {
    for (var k = 1; k <= 100000; k++) if (better(n, k) === 'sorted') return k;
    return -1;
  }

  /* ── 三個「排序方案」（老師 2026-08-18）─────────────────
     ★ 老師：「排序成本不是還有插入排序？這樣就可以在下一階段來組合，
       先讓學生選擇後再出現帳單比對。」
     ⚠️ 之前的帳單只有一種排序費（選擇排序）——
        等於把第 7 關的結論整個丟掉：**插入排序的成本看資料長相**。
     ★ 把「用哪一種排序法」和「資料本來長什麼樣」合成**一個軸**：
       三個都是真實情境，而且排序費差很多，
       於是「先排序划不划算」的分界點也跟著差很多 ——
       100 筆的話：54 次 → 27 次 → 2 次。
       那才是這一章真正要學生帶走的東西：**選對方法，門檻會整個垮下來**。
     ⚠️ 不要拆成「排序法 × 資料長相」兩個軸：選擇排序的三種長相答案都一樣，
        學生會覺得白選一次（老師也是這樣判斷的）。 */
  /* ── 搬動次數：帳單漏掉的另一半 ─────────────────────
     ★★ 老師 2026-08-18：「但是以數字來說還是最大，這很難令人信服，
       次數之外還有什麼背後的成本考量？不然學生會說都用插入排序就好了。」
     ⚠️ 老師是對的，而且「保證價」那個說法**站不住**：
        選擇排序保證 4,950，而插入排序**最壞也才** 4,950 ——
        同樣的價錢卻常常更便宜，那當然是「都用插入排序就好」。
        ★ 病根是帳單只算了**比較**。
     ★ 漏掉的是**搬動**（把資料真的搬來搬去）：
         選擇排序　每一回合只搬一次　→ 最多 n−1 次
         插入排序　每插一張牌，前面比它大的**全部往右挪一格**
                   → 很亂時約 n²/4、完全相反時 n(n−1)/2
       100 筆很亂的資料實測：選擇搬 95 次、插入搬 2,483 次 —— **差 26 倍**。
     ★ 而「搬一次有多貴」看資料本身有多大：
         一個數字　→ 搬一次和比一次差不多
         一整張照片→ 搬一次貴得多（要把整份資料複製過去）
       ⇒ 這就是選擇排序真正存在的理由，也是課本層級的正確答案。
     ⚠️ 搬動次數用**公式**，不是實測：
        實測每次都不一樣，學生沒辦法對答案（和排序費同一個道理）。 */

  /** 選擇排序的搬動次數：每一回合最多搬一次 */
  function selMoves(n) { return Math.max(0, n - 1); }
  /** 插入排序的搬動次數（跟著情境跑） */
  function insMovesRand(n) { return Math.round(selCompares(n) / 2); }  // 約 n²/4
  function insMovesSorted(n) { return 0; }                             // 已經排好就不用搬

  /* 「搬一次」相當於「比幾次」——
     ★ 這個倍率就是「一筆資料有多大」。
     ⚠️ 10 倍不是隨便取的：整數比較是一個指令，
        而搬一張照片要把好幾 MB 複製過去 —— 真實差距遠大於 10 倍，
        這裡取一個學生算得動、又足以翻盤的數。 */
  var SIZE_KINDS = [
    { key: 'num', icon: '🔢', name: '一個數字', mul: 1,
      sub: '搬一次和比一次差不多' },
    { key: 'photo', icon: '🖼️', name: '一整張照片', mul: 10,
      sub: '搬一次要複製好幾 MB —— 抵得上比 10 次' }
  ];
  function mulOf(key) {
    for (var i = 0; i < SIZE_KINDS.length; i++) {
      if (SIZE_KINDS[i].key === key) return SIZE_KINDS[i].mul;
    }
    return 1;
  }

  /* ⚠️⚠️ 老師 2026-08-18 再問：「如果選擇排序法都是相同金額，
     為什麼要選這個選項？學生會有疑問吧？」—— 說得對，而且是**設計錯了**。
     ★ 前一版把三個選項寫成「你要用哪一種排序法」，
       那就變成一道「挑最便宜的」的題目 ——
       而選擇排序永遠最貴，於是它是一個**永遠不該選**的選項，
       那個選擇本身就是假的。
     ★ 真正的答案：**你不是在挑最便宜的，你是在看手上的資料長什麼樣**。
       · 「資料已經接近排好」不是你能挑的，是資料本來就長那樣
       · 插入排序在很亂的資料上是**平均** 2,475，最壞會到 4,950（看運氣）
       · 選擇排序的價值是**可預測**：不管資料多爛都是 4,950，**不會更糟**
     ⇒ 三個選項改寫成「你手上的資料是哪一種情況」，
       而且把「保證價 vs 看運氣」講出來 —— 那是最壞情況與平均情況的差別，
       國中生用「保證」兩個字就懂。 */
  var PLANS = [
    { key: 'sel', icon: '🎯', name: '資料很亂 · 用選擇排序法',
      tag: '很少搬動',
      sub: '比較次數最多，但<b>每一回合只搬一次</b> —— 搬動只有 {moves} 次',
      fee: function (n) { return selCompares(n); },
      moves: selMoves },
    { key: 'insRand', icon: '🃏', name: '資料很亂 · 用插入排序法',
      tag: '比較少但搬很多',
      sub: '比較次數大約少一半，但每插一張牌都要把前面的<b>往右挪</b> —— 搬動 {moves} 次',
      /* ⚠️ 用 n(n−1)/4，不是真的去跑一次 ——
         這裡要的是**一個學生算得出來的數**（「大約一半」），
         而不是某一次隨機資料的實測值（每次都不一樣，沒辦法對答案）。 */
      fee: function (n) { return Math.round(selCompares(n) / 2); },
      moves: insMovesRand },
    { key: 'insSorted', icon: '🃏', name: '資料本來就接近排好 · 用插入排序法',
      tag: '最省',
      sub: '比一次就找到位置，而且<b>幾乎不用搬</b>。⚠️ 前提是資料<b>真的</b>接近排好 —— 這不是你能選的',
      fee: function (n) { return insBest(n); },
      moves: insMovesSorted }
  ];
  function planOf(key) {
    for (var i = 0; i < PLANS.length; i++) if (PLANS[i].key === key) return PLANS[i];
    return PLANS[0];
  }
  /** 這個方案的**比較**次數 */
  function feeOf(n, key) { return planOf(key).fee(n); }
  /** 這個方案的**搬動**次數 */
  function movesOf(n, key) { return planOf(key).moves(n); }
  /** 排序的總成本＝比較 ＋ 搬動 × 一筆資料有多大 */
  function sortCost(n, key, sizeKind) {
    return feeOf(n, key) + movesOf(n, key) * mulOf(sizeKind);
  }
  /** 先排序的總成本（排序費由方案與資料大小決定） */
  function costSortedBy(n, k, key, sizeKind) {
    return sortCost(n, key, sizeKind) + k * binWorst(n);
  }
  /** 哪一種划算（跟著方案跑） */
  function betterBy(n, k, key, sizeKind) {
    var a = costPlain(n, k), b = costSortedBy(n, k, key, sizeKind);
    return a < b ? 'plain' : (b < a ? 'sorted' : 'same');
  }
  /** 這個方案的分界點 */
  function breakEvenBy(n, key, sizeKind) {
    for (var k = 1; k <= 1000000; k++) {
      if (betterBy(n, k, key, sizeKind) === 'sorted') return k;
    }
    return -1;
  }

  /* ⚠️ 資料量要和「排序大比拼」對齊（SORTLAB 的 10／100／600）——
     這一步是拿學生剛才量過的數字來算帳，
     數字對不上的話「你剛才量過」這句話就是假的。 */
  var SIZES = [10, 100, 600];

  /* ── 這一步只做一件事：結帳 ─────────────────────────
     ★★ 老師 2026-08-18：「這樣比起來，🎮 實作體驗的內容是不是太弱了？」
       —— 對，而且是我自己弄弱的。
       原本四段是：排序有多貴／兩種排序比一比／搜尋差幾倍／先排序划算嗎。
       在「動手試一次」被加厚（600 根長條的排序動畫、整排格子的搜尋動畫）之後，
       **前三段變成了實驗室的弱化重播**：
         · 排序有多貴（100 筆 4,950 次）→ 排序大比拼選 100 筆就是這個數字
         · 兩種排序比一比　　　　　　　→ 大比拼三種資料長相跑完就是這件事
         · 搜尋差幾倍　　　　　　　　　→ 搜尋大比拼＋賽跑動畫
       同一件事做兩遍，第二遍還比較不好看 —— 那不是複習，是拖時間。
     ★ 第四段才是這一章真正的結論，而且只有這裡有：
       「不是二元搜尋比較快，是**看你要查幾次**。」
     ⇒ 收斂成兩段：把數字擺在一起（回顧）→ 用那些數字算一筆帳（結帳）。
     ⚠️ 老師給的時間是「一節課的尾巴，5～10 分鐘」——
        所以回顧那一段**不問答**，只要求他把資料量切過才往下走。 */
  var STEPS = [
    { key: 'recap', icon: '📋', name: '把四關的數字擺在一起' },
    { key: 'plan',  icon: '🧾', name: '結帳：你要查幾次？' }
  ];

  /* 回顧那一段：至少要看過幾種資料量才算走過。
     ★ 只看 10 筆的話，45 對 9 —— 學生會覺得「好像也沒差多少」，
       而 600 筆是 179,700 對 599。那個跳法才是要他看的。 */
  var RECAP_NEED = 2;

  /* 結帳那一段：要親眼看到**兩邊各贏一次**才算走過。
     ⚠️ 只看到一邊贏的話，這一步的結論會被記成
        「先排序比較好」或「不要排比較好」—— 兩個都是錯的。 */
  var PLAN_NEED = ['plain', 'sorted'];

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.bc{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.bc-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.bc-tip b{color:#4338ca}',
    '.bc-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-step{font-size:12px;font-weight:900;padding:4px 11px;border-radius:9999px;',
    '  background:#e2e8f0;color:#475569}',
    '.bc-step.on{background:#6366f1;color:#fff}',
    '.bc-step.ok{background:#dcfce7;color:#166534}',
    /* 資料量的選擇 */
    '.bc-sizes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-sizes button{background:#fff;border:2px solid #cbd5e1;border-radius:11px;',
    '  padding:8px 16px;font-size:14px;font-weight:900;color:#475569;cursor:pointer;',
    '  font-family:inherit}',
    '.bc-sizes button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-sizes button.on{background:#6366f1;border-color:#6366f1;color:#fff}',
    /* 數字卡 */
    '.bc-nums{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-num{flex:1;min-width:130px;background:#f8fafc;border:2px solid #e2e8f0;',
    '  border-radius:12px;padding:10px 13px}',
    '.bc-num .lb{display:block;font-size:11.5px;font-weight:900;color:#64748b}',
    '.bc-num .vl{display:block;font-size:24px;font-weight:900;color:#4338ca;line-height:1.2}',
    '.bc-num .sub{display:block;font-size:11px;color:#94a3b8;margin-top:2px}',
    '.bc-num.hot{border-color:#f59e0b;background:#fffbeb}',
    '.bc-num.hot .vl{color:#b45309}',
    '.bc-num.cool{border-color:#22c55e;background:#f0fdf4}',
    '.bc-num.cool .vl{color:#166534}',
    /* 長條圖：把倍數畫出來，數字看不出「幾倍」 */
    '.bc-bars{margin-bottom:11px}',
    '.bc-brow{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.bc-brow .nm{flex:0 0 82px;font-size:12px;font-weight:900;color:#475569}',
    '.bc-brow .track{flex:1;background:#f1f5f9;border-radius:6px;overflow:hidden;height:20px}',
    '.bc-brow .fill{height:100%;border-radius:6px;transition:width .5s ease-out}',
    '.bc-brow .vv{flex:0 0 auto;font-size:12px;font-weight:900;color:#334155;min-width:64px;text-align:right}',
    '.bc-ask{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;',
    '  padding:12px 14px;margin-bottom:10px;font-size:13.5px;line-height:1.9}',
    '.bc-ask .yn{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
    '.bc-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:9px 16px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.bc-btn:hover{background:#4f46e5}',
    '.bc-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.bc-in{width:110px;padding:8px 10px;border:2px solid #cbd5e1;border-radius:9px;',
    '  font-size:15px;font-weight:700;text-align:center;font-family:inherit}',
    '.bc-msg{font-size:13.5px;line-height:1.85;padding:10px 13px;border-radius:10px;margin-bottom:10px}',
    '.bc-msg.good{background:#dcfce7;color:#166534}',
    '.bc-msg.bad{background:#fee2e2;color:#991b1b}',
    '.bc-msg.info{background:#f1f5f9;color:#475569}',
    '.bc-done{background:#ecfdf5;border:2px solid #6ee7b7;border-radius:14px;',
    '  padding:14px 16px;font-size:14px;line-height:1.95;color:#065f46}',
    /* ── 回顧那三條橫條（老師 2026-08-18：「調整為更有可讀性」）──
       ⚠️ 前一版是三張並排的數字卡，4,950／100／7 **字級一樣大** ——
          而這一段唯一要傳達的就是「排序遠比搜尋貴」。
          三個一樣大的數字，正好把那件事藏起來。
       ⇒ 按比例的橫條：排序那一條滿出去，另外兩條擠在最左邊。 */
    '.bc-lines{background:#fff;border:2px solid #e2e8f0;border-radius:14px;',
    '  padding:12px 14px;margin-bottom:11px}',
    '.bc-lines .hd{font-size:13px;font-weight:900;color:#334155;margin-bottom:10px;',
    '  padding-bottom:7px;border-bottom:1px dashed #e2e8f0}',
    '.bc-line{margin-bottom:11px}',
    '.bc-line:last-child{margin-bottom:0}',
    '.bc-line .lh{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;margin-bottom:3px}',
    '.bc-line .nm{font-weight:900;color:#334155}',
    '.bc-line .src{font-size:11px;font-weight:800;color:#6366f1;',
    '  background:#eef2ff;border-radius:9999px;padding:1px 8px}',
    /* ── 一條「量」（比較／搬動）───────────────────────
       ★ 老師 2026-08-18：「這裡就要加入搬移的成本概念了。」
         排序要付兩種錢，兩條都要在回顧就看過 ——
         不然結帳那一行「搬動費」是憑空冒出來的。 */
    '.bc-mt{display:flex;align-items:center;gap:8px;margin-top:4px}',
    '.bc-mt .k{flex:0 0 34px;font-size:11.5px;font-weight:900;color:#64748b}',
    '.bc-mt .track{flex:1;position:relative;background:#f1f5f9;border-radius:6px;',
    '  overflow:hidden;height:16px}',
    '.bc-mt .fill{display:block;height:100%;border-radius:6px;transition:width .45s ease-out}',
    '.bc-mt .fill.soft{position:absolute;left:0;top:0;bottom:0;opacity:.30}',
    '.bc-mt .fill.hard{position:absolute;left:0;top:0;bottom:0}',
    '.bc-mt .edge{position:absolute;top:0;bottom:0;width:2px;background:#fff;',
    '  box-shadow:0 0 0 1px rgba(15,23,42,.25)}',
    '.bc-mt .v{flex:0 0 auto;min-width:86px;text-align:right;font-size:14px;',
    '  font-weight:900;color:#334155;font-family:ui-monospace,monospace}',
    /* 搜尋沒有搬動 —— 那一格要**明講**，不是留白 */
    '.bc-mt .no{flex:1;font-size:11.5px;color:#94a3b8;font-weight:700}',
    '.bc-big .bc-mt .v{font-size:16px}',
    '.bc-line .lb2{display:flex;align-items:center;gap:9px}',
    '.bc-line .track{flex:1;background:#f1f5f9;border-radius:7px;overflow:hidden;height:22px}',
    '.bc-line .fill{display:block;height:100%;border-radius:7px;transition:width .45s ease-out}',
    '.bc-line .vv{flex:0 0 auto;min-width:74px;text-align:right;font-size:17px;',
    '  font-weight:900;color:#334155;font-family:ui-monospace,monospace}',
    '.bc-line .nt{font-size:11.5px;color:#94a3b8;line-height:1.6;margin-top:2px}',
    /* 「和上一個資料量比」—— 切過去卻沒東西告訴他變多少，等於白切 */
    '.bc-grow{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;',
    '  padding:11px 13px;margin-bottom:11px;font-size:13px;line-height:1.95;color:#7c2d12;',
    '  font-family:ui-monospace,"Noto Sans TC",monospace}',
    '.bc-grow b{color:#92400e}',
    '.bc-big .bc-line .vv{font-size:20px}',
    /* ── 兩張收據（老師 2026-08-18：「公式也不太好理解」）──────
       ★ 把 4,950 ＋ 7 × 100 拆成看得懂的兩行：
         排序費（只付一次）／查詢費（每查一次加一筆）。
       ⚠️ 兩張要**並排**，不是上下 —— 上下排的話沒辦法一眼比大小，
          而「哪一張比較便宜」正是這一段唯一要看的事。
       ⚠️ 手機上放不下兩欄 → 自動變成上下，但總計那一行加粗留住對比。 */
    '.bc-bills{display:flex;gap:10px;margin-bottom:11px;flex-wrap:wrap}',
    '.bc-bill{flex:1;min-width:190px;background:#fff;border:2px solid #e2e8f0;',
    '  border-radius:14px;padding:11px 13px}',
    '.bc-bill.win{border-color:#22c55e;background:#f0fdf4;box-shadow:0 2px 10px rgba(34,197,94,.18)}',
    '.bc-bill .bh{font-size:13px;font-weight:900;color:#334155;margin-bottom:8px;',
    '  padding-bottom:6px;border-bottom:1px dashed #e2e8f0}',
    '.bc-bill .br{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:13px;color:#475569;font-weight:700}',
    '.bc-bill .br span:last-child{font-family:ui-monospace,monospace;font-size:14.5px;',
    '  font-weight:900;color:#334155}',
    /* 每一筆下面那一行小字：講「這筆錢是怎麼來的」 */
    '.bc-bill .bn{font-size:11px;color:#94a3b8;margin:1px 0 7px;line-height:1.6}',
    '.bc-bill .br.tot{border-top:2px solid #cbd5e1;margin-top:4px;padding-top:7px;font-size:14px}',
    '.bc-bill .br.tot span:last-child{font-size:19px;color:#4338ca}',
    '.bc-bill.win .br.tot span:last-child{color:#166534}',
    '.bc-bill .bw{font-size:12.5px;font-weight:900;color:#166534;text-align:right;',
    '  margin-top:4px;min-height:19px}',
    /* ── 三個排序方案的選擇（老師 2026-08-18）──────────
       ★ 每一顆要看得到**排序費** —— 那是這個決定的全部依據。
       ⚠️ 三顆並排、字級一樣：這是三個平行的選項，不是三個難度。 */
    '.bc-plans{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-plans button{flex:1;min-width:200px;background:#fff;border:2px solid #cbd5e1;',
    '  border-radius:14px;padding:12px 14px;cursor:pointer;font-family:inherit;',
    '  text-align:left;display:flex;flex-direction:column;gap:3px}',
    '.bc-plans button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-plans .nm{font-size:14px;font-weight:900;color:#334155}',
    '.bc-plans .fee{font-size:19px;font-weight:900;color:#b45309;',
    '  font-family:ui-monospace,monospace}',
    '.bc-plans .cnt{font-size:11.5px;font-weight:800;color:#64748b;',
    '  font-family:ui-monospace,monospace}',
    '.bc-plans .sub{font-size:11.5px;color:#94a3b8;line-height:1.6}',
    /* ── 一筆資料有多大（老師 2026-08-18：「次數之外還有什麼成本」）──
       ★ 切到照片，搬動變貴，選擇排序當場翻盤。 */
    '.bc-kind{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px;',
    '  background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 10px}',
    '.bc-kind .lb{font-size:12px;font-weight:800;color:#475569}',
    '.bc-kind button{background:#fff;border:2px solid #cbd5e1;border-radius:9px;',
    '  padding:5px 12px;font-size:13px;font-weight:800;color:#334155;cursor:pointer;',
    '  font-family:inherit}',
    '.bc-kind button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-kind button.on{background:#334155;border-color:#334155;color:#fff}',
    '.bc-kind .tip{font-size:11.5px;font-weight:700;color:#94a3b8}',
    '.bc-plans .sub b{color:#64748b}',
    /* 小標：保證價／看運氣／最省 —— 一眼看出「它為什麼存在」 */
    '.bc-plans .tag{font-size:10px;font-weight:900;margin-left:6px;vertical-align:middle;',
    '  border-radius:9999px;padding:2px 7px;background:#e0e7ff;color:#3730a3}',
    /* ── 範圍條（插入排序：它不是一個數字，是一段範圍）──────
       ⚠️ 老師 2026-08-18：「怎麼空白在前面？」——
          兩段都**從 0 起算**、疊在一起畫，前面就不會空。
          淡的那一段在下、實的那一段疊上去，交界處那條線就是「最好情況」。 */
    '.bc-line .track{position:relative}',
    '.bc-line .fill.soft{position:absolute;left:0;top:0;bottom:0;opacity:.30}',
    '.bc-line .fill.hard{position:absolute;left:0;top:0;bottom:0}',
    '.bc-line .edge{position:absolute;top:0;bottom:0;width:2px;background:#fff;',
    '  box-shadow:0 0 0 1px rgba(15,23,42,.25)}',
    /* ── 目標橫幅（老師 2026-08-18：「太開放式了，感覺會亂按」）──
       ★ 「還差幾次」要現算 —— 有數字在跳，學生才知道自己在往哪裡走。 */
    '.bc-goal{display:flex;justify-content:space-between;align-items:center;gap:10px;',
    '  background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;',
    '  padding:10px 14px;margin-bottom:11px;font-size:13.5px;color:#3730a3;',
    '  flex-wrap:wrap}',
    '.bc-goal b{color:#4338ca}',
    '.bc-goal .left{font-size:13px;font-weight:900;background:#fff;border-radius:9999px;',
    '  padding:4px 12px;white-space:nowrap}',
    '.bc-goal .left b{font-size:17px;color:#4338ca}',
    '.bc-goal.done{background:#ecfdf5;border-color:#6ee7b7;color:#065f46}',
    '.bc-goal.done b{color:#166534}',
    /* 建議按哪一顆 —— 只是加亮，不鎖住其他顆 */
    '.bc-kbar button.hint{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.28)}',
    '.bc-kbar button.hint:hover{background:#d97706}',
    /* 資料量：看過的打勾、還沒看的標出來（同一個道理） */
    '.bc-sizes button.ok{border-color:#86efac;background:#f0fdf4;color:#166534}',
    '.bc-sizes button.todo{border-color:#f59e0b;background:#fffbeb;color:#92400e}',
    '.bc-sizes button .tag{font-size:10px;font-weight:900;margin-left:5px;',
    '  background:#fde68a;color:#92400e;border-radius:9999px;padding:1px 6px}',
    '.bc-sizes button.on .tag{background:#fff;color:#4338ca}',
    /* 「＋ 再查幾次」那一排 */
    '.bc-kbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.bc-kbar .lb{font-size:13px;font-weight:800;color:#334155;margin-right:2px}',
    '.bc-kbar .lb b{color:#4338ca;font-size:16px}',
    '.bc-kbar button{background:#4f46e5;color:#fff;border:0;border-radius:9px;',
    '  padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}',
    '.bc-kbar button:hover{background:#4338ca}',
    '.bc-kbar button.ghost{background:#fff;border:2px solid #cbd5e1;color:#64748b;',
    '  font-weight:700}',
    '.bc-big .bc-bill .br.tot span:last-child{font-size:22px}',
    /* 「查幾次」的檔位 —— 結帳那一段真正在玩的東西 */
    '.bc-ks{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.bc-ks .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.bc-ks button{background:#fff;border:2px solid #cbd5e1;border-radius:9px;padding:7px 13px;',
    '  font-size:13.5px;font-weight:800;color:#334155;cursor:pointer;font-family:inherit}',
    '.bc-ks button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-ks button.on{background:#6366f1;border-color:#6366f1;color:#fff}',
    /* ⚠️ 主要動作要自己佔一塊 —— 老師 2026-08-18 在排序那邊找不到播放鈕，
       原因就是主要動作只是一顆按鈕。這裡不要重蹈覆轍。 */
    '.bc-go{background:#eef2ff;border:2px dashed #c7d2fe;border-radius:14px;',
    '  padding:15px 14px;margin:13px 0;text-align:center}',
    '.bc-go button{padding:14px 26px;font-size:16px;font-weight:900;border-radius:11px;',
    '  box-shadow:0 3px 0 #3730a3}',
    '.bc-go button:active{transform:translateY(2px);box-shadow:0 1px 0 #3730a3}',
    '.bc-go .cap{font-size:12.5px;font-weight:700;color:#4338ca;line-height:1.8;margin-top:9px}',
    /* 還差什麼 —— 條件有幾項就有幾個勾 */
    '.bc-todo{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;',
    '  padding:9px 12px;margin-bottom:11px}',
    '.bc-todo .th{font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}',
    '.bc-todo ul{list-style:none;margin:0;padding:0}',
    '.bc-todo li{font-size:12.5px;line-height:1.9;color:#64748b}',
    '.bc-todo li.ok{color:#166534;font-weight:700}',
    '.bc-big .bc-tip{font-size:14.5px;padding:14px 17px}',
    '.bc-big .bc-num .vl{font-size:28px}',
    '.bc-big .bc-msg{font-size:14.5px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('bigcost-css')) return;
    var s = global.document.createElement('style');
    s.id = 'bigcost-css';
    s.textContent = CSS;
    global.document.head.appendChild(s);
  }

  function comma(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();

    var at = 0;                 // 第幾段
    var cleared = {};           // 過了哪幾段
    var n = 100;                // 目前選的資料量
    var msg = '', kind = 'info';
    var tries = 0;
    var seen = {};              // 回顧：看過哪幾種資料量
    seen[n] = true;
    var guess = null;           // 結帳：猜的損益兩平點（null＝還沒猜）
    var planK = null;           // 結帳：現在在算「查幾次」
    var won = {};               // 結帳：哪一邊已經贏過了（plain／sorted）
    /* 「換邊了」那句話只講一次 —— 每按一下都跳同一句的話，
       學生會停止讀它，而那句正是這一段的結論。 */
    var msgShownFlip = false;
    /* 結帳：學生選的排序方案（null＝還沒選）。
       ★ 老師 2026-08-18：「先讓學生選擇後再出現帳單比對」。 */
    var pick = null;
    /* 一筆資料有多大（決定「搬一次」值幾次比較）。
       ★ 老師 2026-08-18：「次數之外還有什麼背後的成本考量？」
         —— 就是這個。切到照片，選擇排序當場翻盤。 */
    var sizeKind = 'num';

    function step() { return STEPS[at]; }
    function allDone() { return STEPS.every(function (s) { return cleared[s.key]; }); }

    function render() {
      host.className = 'bc' + (opts.big ? ' bc-big' : '');
      host.innerHTML =
        barHTML() +
        (allDone() ? doneHTML() : tipHTML() + todoHTML() + bodyHTML()) +
        (msg ? '<div class="bc-msg ' + kind + '">' + msg + '</div>' : '') +
        footHTML();
      wire();
    }

    function barHTML() {
      return '<div class="bc-bar">' + STEPS.map(function (s, i) {
        var cls = cleared[s.key] ? ' ok' : (i === at ? ' on' : '');
        return '<span class="bc-step' + cls + '">' +
               (cleared[s.key] ? '✔ ' : s.icon + ' ') + s.name + '</span>';
      }).join('') + '</div>';
    }

    function tipHTML() {
      var t = {
        recap: '前面四關的數字，你都自己量過了 —— 但<b>沒有擺在一起看過</b>。' +
               '<br>把資料量切過一輪，看它們各自怎麼長大。',
        plan: '⚠️ 二元搜尋<span class="hl">要先排好序</span> —— ' +
              '而排序那幾千次是<b>先付掉的</b>。' +
              '<br>所以真正的問題不是「哪一個比較快」，是 ' +
              '<span class="hl">你要查幾次？</span>'
      }[step().key];
      return '<div class="bc-tip">' + step().icon + ' <b>' + step().name + '</b>　' + t + '</div>';
    }

    /* ── 螢光筆（樣式在 shared/theme.css，這裡不要再寫一份）───── */
    function hl(t) { return '<span class="hl">' + t + '</span>'; }
    function hlb(t) { return '<span class="hl-b">' + t + '</span>'; }

    /* ⚠️ 「按這裡」要自己佔一塊 ——
       老師 2026-08-18 在排序那邊找不到播放鈕，就是因為主要動作只是一顆裸按鈕。 */
    function goBox(label, cap, action) {
      return '<div class="bc-go"><button class="bc-btn" data-a="' + action + '">' + label +
             '</button><div class="cap">' + cap + '</div></div>';
    }

    /* ── 還差什麼 ────────────────────────────────────
       ⚠️ 條件有幾項，畫面上就要有幾個勾（這是第四次寫這句話了）。 */
    function todoHTML() {
      var rows;
      if (step().key === 'recap') {
        rows = SIZES.map(function (v) {
          return '<li class="' + (seen[v] ? 'ok' : '') + '">' + (seen[v] ? '✅' : '⬜') +
                 ' 看過 ' + comma(v) + ' 筆的三個數字</li>';
        });
      } else {
        /* ★ 順序就是流程：先按到兩邊各贏一次，最後才回答分界點。
           ⚠️ 清單的順序要和畫面上的順序一樣 ——
              不一樣的話學生會照清單去找，但畫面上還沒出現那一題。 */
        rows = [
          '<li class="' + (pick ? 'ok' : '') + '">' + (pick ? '✅' : '⬜') +
          ' 選一種<b>排序方式</b>' +
          (pick ? '<span>' + planOf(pick).name + '</span>' : '') + '</li>',
          '<li class="' + (won.plain ? 'ok' : '') + '">' + (won.plain ? '✅' : '⬜') +
          ' 看到一次<b>不排序比較省</b>（查很少次的時候）</li>',
          '<li class="' + (won.sorted ? 'ok' : '') + '">' + (won.sorted ? '✅' : '⬜') +
          ' 看到一次<b>先排序比較省</b>（按「＋」把次數加上去）</li>',
          '<li class="' + (guess !== null ? 'ok' : '') + '">' + (guess !== null ? '✅' : '⬜') +
          ' 最後一題：分界點大概在哪裡' +
          (won.plain && won.sorted ? '' : '<span>（兩邊都看過才會出現）</span>') + '</li>'
        ];
      }
      var done = rows.filter(function (r) { return r.indexOf('✅') >= 0; }).length;
      return '<div class="bc-todo"><div class="th">這一段要完成 ' + done + ' / ' + rows.length +
             '</div><ul>' + rows.join('') + '</ul></div>';
    }

    /* ⚠️ 老師 2026-08-18：「兩個階段目前太開放式了，感覺會亂按，
       是不是有個目標式的按鍵引導。」
       ★ 三顆一樣的按鈕不會告訴學生「下一顆該按哪一顆」——
         看過的打勾、還沒看的加提示，路就只剩一條。 */
    function sizesHTML() {
      return '<div class="bc-sizes">' + SIZES.map(function (v) {
        var now = (v === n), done = !!seen[v];
        var cls = now ? 'on' : (done ? 'ok' : 'todo');
        return '<button data-n="' + v + '" class="' + cls + '">' +
               (done && !now ? '✓ ' : '') + comma(v) + ' 筆' +
               (!done ? '<span class="tag">還沒看</span>' : '') + '</button>';
      }).join('') + '</div>';
    }

    /** 一列長條 */
    function bar(name, val, max, color) {
      var w = Math.max(1, Math.round(val / max * 100));
      return '<div class="bc-brow"><span class="nm">' + name + '</span>' +
        '<span class="track"><span class="fill" style="width:' + w + '%;background:' + color + '"></span></span>' +
        '<span class="vv">' + comma(val) + ' 次</span></div>';
    }

    function bodyHTML() {
      var k = step().key;

      /* ── ① 回顧：把四關的數字擺在一起 ────────────────
         ⚠️ 這一段**不問答**（老師給的時間是一節課的尾巴）——
            但也不能一鍵跳過：只看 10 筆的話 45 對 9，
            學生會覺得「好像也沒差多少」。⇒ 要求切過兩種資料量。 */
      if (k === 'recap') return recapHTML();

      /* ── ② 結帳 ─────────────────────────────────────
         ★ 兩張收據，一次加一筆。
           ⚠️ 「先猜分界點」那一題搬到**最後**（老師 2026-08-18 選的）——
              先按到自己看見換邊，才有東西可以猜。 */
      if (k === 'plan') {
        return planHTML() + (pick && won.plain && won.sorted ? guessHTML() : '');
      }

      return '';
    }

    /* ── 回顧：三條橫條 ────────────────────────────────
       ★★ 老師 2026-08-18：「📋 把四關的數字擺在一起，這個部份也調整為更有可讀性。」
       ⚠️ 前一版是三張並排的數字卡：4,950 / 100 / 7 三個數字**字級一樣大**，
          可是這一段唯一要傳達的就是「排序遠比搜尋貴」——
          而那件事在三張一樣大的卡片上完全看不出來。
          （這和搜尋那邊「進度條看不出量級」是同一個毛病。）
       ⇒ 改成三條**按比例**的橫條：排序那一條長到滿出來，另外兩條幾乎看不見。
       ★★ 而且補上這一段本來缺的東西：**切資料量時「變了多少」**。
          原本切過去只是數字換了，沒有任何東西告訴他差多少 ——
          而「排序漲 36 倍、二元只多 3 次」正是要他看的。 */
    function recapHTML() {
      var sortN = selCompares(n), seqN = seqWorst(n), binN = binWorst(n);
      var insLo = insBest(n), insHi = insWorst(n);
      var mvSel = selMoves(n), mvInsHi = insHi;    // 插入最壞：每一筆都一路挪
      var mx = Math.max(sortN, seqN, binN, mvSel, mvInsHi);

      /* 一條「量」：名字＋比例條＋數字。lo 有值就畫成範圍。 */
      var meter = function (label, lo, hi, color, faint) {
        if (hi == null) {
          return '<div class="bc-mt"><span class="k">' + label + '</span>' +
            '<span class="track"><span class="fill" style="width:' +
            Math.max(1.2, lo / mx * 100) + '%;background:' + color +
            (faint ? ';opacity:.55' : '') + '"></span></span>' +
            '<span class="v">' + comma(lo) + '</span></div>';
        }
        var l = Math.max(1.5, lo / mx * 100), h = Math.max(l + 1, hi / mx * 100);
        return '<div class="bc-mt"><span class="k">' + label + '</span>' +
          '<span class="track">' +
          '<span class="fill soft" style="width:' + h + '%;background:' + color + '"></span>' +
          '<span class="fill hard" style="width:' + l + '%;background:' + color + '"></span>' +
          '<span class="edge" style="left:' + l + '%"></span></span>' +
          '<span class="v">' + comma(lo) + '～' + comma(hi) + '</span></div>';
      };
      var block = function (icon, name, from, body, note) {
        return '<div class="bc-line"><div class="lh">' +
          '<span class="nm">' + icon + ' ' + name + '</span>' +
          '<span class="src">' + from + '</span></div>' +
          body + '<div class="nt">' + note + '</div></div>';
      };

      /* ★★ 老師 2026-08-18：「這裡就要加入搬移的成本概念了。」
         ⚠️ 之前回顧只列比較次數，到了結帳才蹦出「搬動費」——
            那是**憑空冒出來的一筆錢**，學生會覺得系統在硬拗。
         ★ 排序要做**兩件事**：比較、搬動。兩件都要在這裡先看過一次。
         ★ 而搜尋只「看」不搬 —— 那本身就是一句值得講的話，
           也解釋了為什麼帳單上只有排序有搬動費。 */
      var out = sizesHTML() +
        '<div class="bc-lines"><div class="hd">同樣 <b>' + comma(n) +
        '</b> 筆資料：要<b>比</b>幾次？要<b>搬</b>幾次？</div>' +
        block('🎯', '選擇排序法', '第 6 關',
          meter('比較', sortN, null, '#f59e0b') +
          meter('搬動', mvSel, null, '#f59e0b', true),
          '不管資料長什麼樣，比較都是這個數；而且<b>每一回合只搬一次</b>') +
        block('🃏', '插入排序法', '第 7 關',
          meter('比較', insLo, insHi, '#a855f7') +
          meter('搬動', 0, mvInsHi, '#a855f7'),
          '看資料本來長什麼樣：接近排好幾乎不用搬；' +
          '完全相反的話<b>每插一張牌，前面的全要往右挪</b>') +
        block('🚶', '循序搜尋（最壞）', '第 8 關',
          meter('比較', seqN, null, '#0ea5e9') +
          '<div class="bc-mt none"><span class="k">搬動</span>' +
          '<span class="no">搜尋只是「看」，不會搬資料</span></div>',
          '每查一次都要付這麼多') +
        block('✂️', '二元搜尋（最壞）', '第 9 關',
          meter('比較', binN, null, '#22c55e') +
          '<div class="bc-mt none"><span class="k">搬動</span>' +
          '<span class="no">同上 —— 0 次</span></div>',
          '每查一次只要這麼多 —— 但資料得先排好') +
        '</div>' +
        '<div class="bc-ask">⚠️ ' + hl('排序那兩條長到看不完') +
        '，兩條搜尋擠在最左邊。' +
        '<br>（那兩條其實差 ' + hlb(comma(Math.round(seqN / binN)) + ' 倍') +
        '，只是和排序比起來都太短了 —— <b>那正是重點</b>。）' +
        '<br>★ 而且排序要付<b>兩種</b>錢：' + hl('比較') + '和' + hl('搬動') +
        ' —— 兩種排序法在這兩欄上剛好<b>相反</b>。' +
        '<br><span style="font-size:12px;color:#94a3b8">' +
        '這些數字你在「動手試一次」都量過，這裡只是擺在一起。</span></div>';

      out += growHTML();

      var left = SIZES.filter(function (v) { return !seen[v]; });
      out += left.length
        ? '<div class="bc-msg info">還有 ' +
          left.map(function (v) { return comma(v) + ' 筆'; }).join('、') +
          ' 沒看過 —— 切過去，看那幾條長度怎麼變。</div>'
        : goBox('🧾 開始結帳', '三種資料量都看過了。' +
            '現在用這些數字算一筆你沒算過的帳：<b>到底要不要先排序？</b>', 'recapdone');
      return out;
    }

    /** 和**前一個**資料量比：誰長得快、誰幾乎不動 */
    function growHTML() {
      var i = SIZES.indexOf(n);
      if (i <= 0 || !seen[SIZES[i - 1]]) return '';
      var pv = SIZES[i - 1];
      var f = function (a, b) {
        var r = b / a;
        return r >= 2 ? ('<b>' + comma(Math.round(r)) + ' 倍</b>')
                      : ('只多 <b>' + comma(b - a) + '</b> 次');
      };
      return '<div class="bc-grow">📈 從 <b>' + comma(pv) + '</b> 筆變成 <b>' +
        comma(n) + '</b> 筆（' + comma(Math.round(n / pv)) + ' 倍）：' +
        '<br>· 排序　　' + comma(selCompares(pv)) + ' → ' + comma(selCompares(n)) +
        '　' + hl(f(selCompares(pv), selCompares(n))) +
        '<br>· 循序搜尋 ' + comma(seqWorst(pv)) + ' → ' + comma(seqWorst(n)) +
        '　' + f(seqWorst(pv), seqWorst(n)) +
        '<br>· 二元搜尋 ' + binWorst(pv) + ' → ' + binWorst(n) +
        '　' + hl(f(binWorst(pv), binWorst(n))) +
        /* ★ 搬動也要看得到長大的速度 ——
           選擇排序的搬動只跟著 n 走（線性），插入排序跟著 n² 走。
           那正是結帳那一段「搬動費」的伏筆。 */
        '<br>· 搬動（選擇）' + comma(selMoves(pv)) + ' → ' + comma(selMoves(n)) +
        '　' + f(selMoves(pv), selMoves(n)) +
        '<br>· 搬動（插入·最壞）' + comma(insWorst(pv)) + ' → ' + comma(insWorst(n)) +
        '　' + hl(f(insWorst(pv), insWorst(n))) + '</div>';
    }

    /* ── 結帳：兩張收據 ────────────────────────────────
       ★★ 老師 2026-08-18：「🧾 結帳還是不太會操作，總覺得流程不太順手，
         公式也不太好理解，操作後還是不太理解。」
       ⚠️ 前一版壞在**開場**和**呈現**兩件事：
         ① 一進來就要他猜「查幾次以上先排序才划算」——
            那是兩條直線的交點。國中生手上沒有任何可以依靠的直覺，
            只能亂填一個數字，然後被告知答案。猜不出來的猜測沒有教學功能。
         ② 畫面上是「4,950 ＋ 7 × 100 ＝ 5,650」這種算式。
            那是**結果**的寫法，不是**過程**的寫法 ——
            學生看不出 4,950 為什麼只出現一次、7 為什麼要乘。
       ⇒ 改成兩張並排的收據，一次加一筆：
           排序費　只在「先排序」那一張出現，而且**只付一次**
           查詢費　每查一次就往上加一筆
         按「＋ 再查一次」兩張的總計各自往上跳，換邊的那一刻標出來。
       ★ 沒有乘法算式 —— 只有一直加上去的數字。
         「排序費只付一次、查詢費每次都要付」這件事，用收據看一眼就懂。 */
    /* ── 先選一個排序方案 ────────────────────────────
       ★ 老師 2026-08-18：「排序成本不是還有插入排序？
         這樣就可以在下一階段來組合，先讓學生選擇後再出現帳單比對。」
       ⚠️ 之前帳單直接用選擇排序的成本，等於替學生做了決定 ——
          而「用哪一種排序法、資料本來長什麼樣」正是第 6、7 關教的事。
       ★ 三個方案的排序費差很多，於是分界點也差很多（100 筆：54／27／2）——
         選完之後那張帳單才是**他自己的**帳單。 */
    function pickHTML() {
      return sizesHTML() +
        '<div class="bc-kind"><span class="lb">一筆資料是</span>' +
        SIZE_KINDS.map(function (sk) {
          return '<button data-kind="' + sk.key + '"' +
                 (sk.key === sizeKind ? ' class="on"' : '') + '>' +
                 sk.icon + ' ' + sk.name + '</button>';
        }).join('') +
        '<span class="tip">搬一次 ≈ 比 ' + mulOf(sizeKind) + ' 次</span></div>' +
        '<div class="bc-ask">先決定一件事：這批 <b>' + comma(n) +
        '</b> 筆資料，<b>你手上的是哪一種情況</b>？' +
        '<br>⚠️ ' + hl('這不是「挑最便宜的」') +
        ' —— 你只能挑<b>符合你手上資料</b>的那一個。' +
        '<br><span style="font-size:12px;color:#94a3b8">' +
        '★ 三個都是真的會遇到的情況，而排序費差很多 ——' +
        '之後那張帳單就會不一樣。</span></div>' +
        '<div class="bc-plans">' + PLANS.map(function (p) {
          return '<button data-pick="' + p.key + '">' +
            '<span class="nm">' + p.icon + ' ' + p.name +
            '<span class="tag">' + p.tag + '</span></span>' +
            '<span class="fee">排序費 ' + comma(sortCost(n, p.key, sizeKind)) + '</span>' +
            '<span class="cnt">比較 ' + comma(p.fee(n)) + '　搬動 ' +
            comma(p.moves(n)) + '</span>' +
            '<span class="sub">' +
            p.sub.replace('{worst}', comma(selCompares(n)))
                 .replace('{moves}', comma(p.moves(n))) + '</span></button>';
        }).join('') + '</div>';
    }

    function planHTML() {
      if (!pick) return pickHTML();
      var kk = planK || 1;
      var cmpFee = feeOf(n, pick);           // 排序：比較幾次
      var mvCnt = movesOf(n, pick);          // 排序：搬動幾次
      var mul = mulOf(sizeKind);             // 搬一次 = 比幾次
      var mvFee = mvCnt * mul;
      var perPlain = seqWorst(n);            // 不排序：每查一次的價錢
      var perSorted = binWorst(n);           // 先排序：每查一次的價錢
      var totPlain = costPlain(n, kk);
      var totSorted = costSortedBy(n, kk, pick, sizeKind);
      var side = betterBy(n, kk, pick, sizeKind);

      /* ⚠️ 帳單要**兩行排序費**（老師 2026-08-18）：
         只算比較的話，插入排序永遠不比選擇排序差 ——
         那學生當然會說「都用插入排序就好」。
         搬動那一行才是選擇排序存在的理由。 */
      var bill = function (cls, name, sorting, per, tot, win) {
        return '<div class="bc-bill ' + cls + (win ? ' win' : '') + '">' +
          '<div class="bh">' + name + '</div>' + sorting +
          '<div class="br"><span>查詢費</span><span>' + comma(per * kk) + '</span></div>' +
          '<div class="bn">一次 ' + comma(per) + ' × ' + comma(kk) + ' 次</div>' +
          '<div class="br tot"><span>總計</span><span>' + comma(tot) + '</span></div>' +
          '<div class="bw">' + (win ? '✅ 比較便宜' : '　') + '</div></div>';
      };
      var noSort =
        '<div class="br"><span>排序費</span><span>0</span></div>' +
        '<div class="bn">不用排序</div>';
      var withSort =
        '<div class="br"><span>排序 · 比較</span><span>' + comma(cmpFee) + '</span></div>' +
        '<div class="bn">只付一次</div>' +
        '<div class="br"><span>排序 · 搬動</span><span>' + comma(mvFee) + '</span></div>' +
        '<div class="bn">搬 ' + comma(mvCnt) + ' 次 × ' + mul + '（' +
        (mul > 1 ? '照片搬一次抵比 ' + mul + ' 次' : '數字搬一次≈比一次') + '）</div>';

      /* ⚠️ 加幾次的按鈕要跨好幾個量級 —— 只有 ＋1 的話，
         100 筆要按五十幾下才看得到換邊，那不是體驗是懲罰。
         ★ 三種資料量的分界點分別是 8／54／305，
           所以 ＋100 按三下之內一定看得到換邊。
         ⚠️ 哪天資料量加大（分界點跑到上千），這裡要再加一格 ——
            不然學生又會落到「按到煩」那一邊。 */
      var STEPS_K = [1, 10, 100];

      /* ── 目標橫幅（老師 2026-08-18：「太開放式了，感覺會亂按，
           是不是有個目標式的按鍵引導」）─────────────────────
         ⚠️ 前一版畫面上只有三顆「＋」和兩張收據 ——
            學生不知道要按到什麼時候，也不知道按下去要看什麼，
            那就只能亂按。
         ★ 給一個**看得到終點的目標**：讓「先排序」那一張變便宜。
           而且把「還差幾次」現算出來 —— 有數字在跳，就不是亂按。
         ⚠️ 不要直接把分界點寫出來（那是最後一題的答案）——
            只講「還差幾次」，他自己按到 0 的時候就知道答案了。 */
      var be = breakEvenBy(n, pick, sizeKind);
      var left = Math.max(0, be - kk);
      var goalBar = won.sorted
        ? '<div class="bc-goal done">🎯 目標達成！你已經看過<b>兩邊各贏一次</b> —— ' +
          '下面最後一題就是問這個。</div>'
        : '<div class="bc-goal">🎯 <b>目標：讓「先排序」那一張變便宜</b>' +
          '<span class="left">還差 <b>' + comma(left) + '</b> 次</span></div>';

      /* ★ 建議按哪一顆：還差很多就推 ＋100，快到了就推 ＋1。
         ⚠️ 只是**加亮**，不是鎖住其他顆 —— 自己亂按也要能玩。
         ⚠️⚠️ 這個變數本來叫 pick，和外層「學生選的排序方案」撞名 ——
            var 會提升到函式最上面，於是 `if (!pick) return pickHTML()`
            永遠看到 undefined，選完方案畫面還是停在選單。
            ★ 而且完全不會報錯：待辦清單那邊用的是外層的 pick，
              所以打勾了、畫面卻沒換 —— 看起來像「按鈕沒反應」。 */
      var suggest = left >= 100 ? 100 : (left >= 10 ? 10 : 1);

      /* ── 一筆資料有多大（老師 2026-08-18）─────────────
         ★ 「次數之外還有什麼成本」的答案就在這一排。
           切到照片，搬動變貴，選擇排序當場翻盤 ——
           ⚠️ **看得到的翻盤**比一句「資料很大時搬動比較貴」有用得多。 */
      var sizeBar = '<div class="bc-kind"><span class="lb">一筆資料是</span>' +
        SIZE_KINDS.map(function (sk) {
          return '<button data-kind="' + sk.key + '"' +
                 (sk.key === sizeKind ? ' class="on"' : '') + '>' +
                 sk.icon + ' ' + sk.name + '</button>';
        }).join('') +
        '<span class="tip">' +
        (mulOf(sizeKind) > 1
          ? '搬一次 ≈ 比 ' + mulOf(sizeKind) + ' 次'
          : '搬一次 ≈ 比 1 次') + '</span></div>';

      return sizesHTML() + sizeBar + goalBar +
        '<div class="bc-kbar"><span class="lb">你要查 <b>' + comma(kk) + '</b> 次</span>' +
        STEPS_K.map(function (v) {
          var hint = (!won.sorted && v === suggest);
          return '<button data-add="' + v + '"' + (hint ? ' class="hint"' : '') + '>' +
                 (hint ? '👉 ' : '') + '＋' + comma(v) + ' 次</button>';
        }).join('') +
        '<button data-add="reset" class="ghost">↺ 回到 1 次</button>' +
        '<button data-pick="" class="ghost">🔄 換一種排序方式</button></div>' +
        '<div class="bc-bills">' +
          bill('plain', '🚶 不排序，每次循序找', noSort, perPlain, totPlain, side === 'plain') +
          bill('sorted', planOf(pick).icon + ' 先排序，之後二元找', withSort, perSorted, totSorted, side === 'sorted') +
        '</div>' +
        '<div class="bc-ask">' + planSay(kk, side, totPlain, totSorted) + '</div>';
    }

    /** 收據下面那一句話 —— 講**剛剛發生了什麼**，不是講公式 */
    function planSay(kk, side, tp, ts) {
      if (side === 'same') {
        return '查 <b>' + comma(kk) + '</b> 次的話，兩邊' + hl('剛好一樣貴') +
               ' —— 這就是分界點。再多查一次，先排序就開始划算了。';
      }
      if (side === 'plain') {
        return '查 <b>' + comma(kk) + '</b> 次：' + hl('不排序比較省') +
               '（' + hlb(comma(tp)) + ' 對 ' + hlb(comma(ts)) + '）。' +
               '<br>⚠️ 因為那筆<b>排序費</b>還沒被攤平 —— 查太少次，先付的錢划不來。' +
               '<br>👉 按上面的「＋」再多查幾次看看。';
      }
      return '查 <b>' + comma(kk) + '</b> 次：' + hl('先排序比較省') +
             '（' + hlb(comma(ts)) + ' 對 ' + hlb(comma(tp)) + '）。' +
             '<br>★ 排序費只付了一次，但它幫你把<b>每一次</b>的查詢費從 ' +
             comma(seqWorst(n)) + ' 降到 ' + binWorst(n) + ' —— 查愈多次賺愈多。';
    }

    /* ── 最後才問分界點 ──────────────────────────────
       ★ 老師 2026-08-18 選的：「拿掉，改成最後才問」——
         先讓他按到自己看見換邊，再問「那分界點大概在哪裡？」。
       ⚠️ 有過經驗才猜得出來。一開場就問，他只能亂填一個數字。 */
    function guessHTML() {
      var be = breakEvenBy(n, pick);
      return '<div class="bc-ask"><b>最後一題：</b>' +
        '你剛才看到兩邊換邊了。' +
        '這批 <b>' + comma(n) + '</b> 筆資料，' +
        '用<b>' + planOf(pick).name + '</b>來排的話，' +
        '<b>查幾次以上</b>，先排序才開始划算？' +
        '<br><span style="font-size:12px">💡 用「＋」把次數調到剛好換邊的那一格，就看得出來。' +
        '答案在 ' + comma(Math.max(1, be - 20)) + ' ～ ' + comma(be + 20) + ' 之間都算對。</span>' +
        '<div class="yn"><input class="bc-in" id="bc-g" type="number" min="1" placeholder="查幾次">' +
        '<button class="bc-btn" data-a="guess">送出</button></div></div>';
    }

    /* ⚠️ 結論這一塊是整個第 6 章的收尾 —— 螢光筆就該畫在這裡。
       ★ 只畫兩處：那句「看你要查幾次」，和它的前提「資料要先排好」。
          數字用藍筆。畫太多的話，這一段又會變成一片黃。 */
    function doneHTML() {
      var be = breakEven(n);
      return '<div class="bc-done">' +
        '🎉 <b>結完帳了。</b>' +
        '<br>這一章的結論<b>不是</b>「二元搜尋比較快」——' +
        '<br>而是 ' + hl('看你要查幾次') + '：' +
        '<br>· 只查一兩次 → <b>不必排序</b>，直接循序找比較省' +
        '<br>· 要查很多次 → <b>先排序划算</b>（' + comma(n) + ' 筆的話，查 ' +
        hlb(comma(be)) + ' 次以上就值得了）' +
        '<br>⚠️ 課本說「二元搜尋比較快」是有前提的：' + hl('資料要先排好') + '。' +
        '那個排序的成本，就是第 6、7 關你排過的那件事。' +
        '</div>';
    }

    function footHTML() {
      /* ⚠️⚠️ 老師 2026-08-18：「實作體驗結束後，為什麼是『完成，回闖關地圖』？
         不是應該進入 🏁 期末檢核？」
         —— 行為是對的（關卡頁會 advance 到期末檢核），**字是錯的**。
         ★ 這種錯最傷：學生照著字判斷「這一關結束了」，
           按下去卻跳到一個他以為不存在的步驟；
           或者更糟 —— 他以為按了會離開，所以不敢按。
         ⇒ 按鈕的字由呼叫端決定（它才知道後面還有沒有東西）。 */
      if (allDone()) {
        return '<div class="bc-bar"><button class="bc-btn" data-a="finish">' +
               (opts.nextLabel || '完成，回闖關地圖 →') + '</button></div>';
      }
      if (cleared[step().key]) return '<div class="bc-bar"><button class="bc-btn" data-a="next">下一段 →</button></div>';
      return '';
    }

    function wire() {
      [].forEach.call(host.querySelectorAll('[data-n]'), function (el) {
        el.onclick = function () {
          n = Number(el.dataset.n);
          seen[n] = true;
          /* ⚠️ 換資料量就要重來 —— 不然學生用 10 筆過關，
             卻沒看到 600 筆才會出現的那個差距。
             ⚠️ 損益兩平點也跟著資料量跑（10 筆是 8 次、600 筆是 3,004 次），
                猜過的答案不能算數。 */
          cleared[step().key] = false;
          if (step().key === 'plan') {
            /* ⚠️ 方案也要清：排序費跟著資料量跑，
               留著的話帳單上會是新的 n 配舊的排序費。 */
            pick = null; guess = null; planK = 1; won = {}; msgShownFlip = false;
          }
          tries = 0; msg = ''; kind = 'info';
          render();
        };
      });
      /* 「＋ 再查幾次」—— 這是結帳那一段真正在玩的東西 */
      [].forEach.call(host.querySelectorAll('[data-add]'), function (el) {
        el.onclick = function () { act('add:' + el.dataset.add); };
      });
      [].forEach.call(host.querySelectorAll('[data-pick]'), function (el) {
        el.onclick = function () { act('pick:' + el.dataset.pick); };
      });
      [].forEach.call(host.querySelectorAll('[data-kind]'), function (el) {
        el.onclick = function () { act('kind:' + el.dataset.kind); };
      });
      [].forEach.call(host.querySelectorAll('[data-a]'), function (el) {
        el.onclick = function () { act(el.dataset.a); };
      });
    }

    function say(k2, m) { kind = k2; msg = m; render(); }

    function act(a) {
      if (a === 'next') {
        at = Math.min(at + 1, STEPS.length - 1);
        tries = 0; msg = ''; kind = 'info'; planK = null;
        render(); return;
      }
      if (a === 'finish') { if (opts.onPass) opts.onPass(); return; }

      var key = step().key;

      if (key === 'recap' && a === 'recapdone') {
        cleared.recap = true;
        say('good', '好 —— 數字都在手上了。' +
            '<br>接下來這一題，前面四關都沒問過你。');
        return;
      }

      /* ── 結帳：選一個排序方案 ───────────────────────
         ⚠️ 換方案要把按到的次數與結論**整個清掉** ——
            分界點跟著方案跑（100 筆：54／27／2），
            留著上一個方案的進度等於用錯的帳單過關。 */
      if (key === 'plan' && a && a.indexOf('pick:') === 0) {
        var pk = a.slice(5);
        pick = pk || null;
        planK = 1; won = {}; msgShownFlip = false; guess = null;
        cleared.plan = false;
        /* ⚠️ 剛選完的時候畫面上已經是「查 1 次」的帳單了 ——
           那一格通常是「不排序比較省」，而學生**確實看到了**。
           不記下來的話，他按到換邊之後系統還在等一個他早就看過的畫面
           （最後一題永遠不出現）。★ 畫面上發生過的事就要算數。 */
        if (pick) {
          var s0 = betterBy(n, 1, pick);
          if (s0 === 'plain' || s0 === 'sorted') won[s0] = true;
        }
        if (pick) {
          /* ★ 每一個方案要回一句**它自己的**話 ——
             同一句「選好了」三種情況都適用的話，那個選擇就白選了。 */
          var why = {
            sel: '★ 它最貴，但它是' + hl('保證價') + '：資料再亂也就是這個數。' +
                 '<br>⚠️ 而插入排序運氣不好會到 ' + comma(selCompares(n)) + ' 次 —— 一樣貴。',
            insRand: '★ 平均比選擇排序省一半，但這是' + hl('平均') + ' ——' +
                     '資料剛好完全相反的話會到 ' + comma(selCompares(n)) + ' 次。',
            insSorted: '★ 便宜得驚人 —— 但' + hl('前提是資料真的接近排好') + '。' +
                       '<br>這不是你挑的，是你剛好拿到這種資料。'
          }[pick];
          say('good', '選好了：<b>' + planOf(pick).name + '</b>，排序費 ' +
                      hlb(comma(feeOf(n, pick))) + ' 次（只付一次）。<br>' + why);
        } else { msg = ''; render(); }
        return;
      }

      /* ── 結帳：換「一筆資料有多大」───────────────────
         ⚠️ 換了之後分界點會跑（100 筆插入排序：54 → 293 次），
            所以按到的次數與結論要重來 —— 不然是拿舊帳單配新價目表。 */
      if (key === 'plan' && a && a.indexOf('kind:') === 0) {
        sizeKind = a.slice(5);
        planK = 1; won = {}; msgShownFlip = false; guess = null;
        cleared.plan = false;
        if (pick) {
          var s1 = betterBy(n, 1, pick, sizeKind);
          if (s1 === 'plain' || s1 === 'sorted') won[s1] = true;
          var cheap = PLANS.map(function (p) {
            return { k: p.key, c: sortCost(n, p.key, sizeKind) };
          }).sort(function (a2, b2) { return a2.c - b2.c; })[0];
          say('good', '換成<b>' + (mulOf(sizeKind) > 1 ? '一整張照片' : '一個數字') +
              '</b>：搬一次抵比 ' + mulOf(sizeKind) + ' 次。' +
              '<br>你這個方案的排序費變成 ' + hlb(comma(sortCost(n, pick, sizeKind))) +
              ' 次。' +
              (mulOf(sizeKind) > 1
                ? '<br>★ ' + hl('搬動一變貴，最省的就換人了') + ' —— ' +
                  '現在最便宜的是「' + planOf(cheap.k).name + '」。'
                : ''));
        } else { msg = ''; render(); }
        return;
      }

      /* ── 結帳：加次數 ──────────────────────────────
         ★ 一次加一筆 —— 沒有公式，只有一直加上去的數字。 */
      if (key === 'plan' && a && a.indexOf('add:') === 0) {
        var d = a.slice(4);
        planK = (d === 'reset') ? 1 : (planK || 1) + Number(d);
        var side = betterBy(n, planK, pick);
        if (side === 'plain' || side === 'sorted') won[side] = true;
        if (won.plain && won.sorted && !msgShownFlip) {
          msgShownFlip = true;
          say('good', '看到了嗎？' + hl('同一批資料、同樣兩種做法，答案換邊了') +
                      '。<br>差別只在<b>你要查幾次</b> —— 下面最後一題就是問這個。');
          return;
        }
        msg = ''; render(); return;
      }

      /* ── 結帳的最後一題：分界點 ─────────────────────
         ⚠️ 這一題**猜錯也不擋** —— 它要的是他先給一個數字，
            而且答案給一個區間（±20），不是要他算到剛好那一格。 */
      if (key === 'plan' && a === 'guess') {
        var v = num('#bc-g');
        if (v === null) return;
        var be = breakEvenBy(n, pick);
        guess = v;
        var near = Math.abs(v - be) <= 20;
        cleared.plan = true;
        say('good',
            (near ? '對了 —— ' : '答案是 ') + hl('查 ' + comma(be) + ' 次以上') +
            '（' + comma(n) + ' 筆的話）。' + (near ? '' : '（你猜 ' + comma(v) + ' 次）') +
            '<br>★ 在那之前，排序費還沒被攤平；在那之後，' +
            '每多查一次都在賺 ' + comma(seqWorst(n) - binWorst(n)) + ' 次。');
        return;
      }

      return;
    }

    function num(sel) {
      var el = host.querySelector(sel);
      var v = Number(el && el.value);
      if (!(v > 0)) { say('info', '先填一個數字。'); return null; }
      return v;
    }

    render();

    return {
      destroy: function () { host.innerHTML = ''; },
      _s: function () {
        return { at: at, cleared: cleared, n: n, planK: planK, done: allDone(), pick: pick,
                 /* 測試要看得到這三個：猜過沒、看過哪幾種資料量、哪一邊贏過 */
                 guess: guess, seen: seen, won: won };
      }
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅）。 */
  function goal() {
    return {
      /* ⚠️ 這一步**不要**再講一次「排序有多貴、搜尋差幾倍」——
         那兩件事「動手試一次」已經用動畫做過了（老師 2026-08-18：
         「比起來，實作體驗的內容是不是太弱了？」）。
         ★ 這裡只做一件他沒做過的事：把那些數字加起來，算一筆帳。 */
      why: '前面你量到的都是<b>單一一件事</b>的成本：排序要比幾次、搜尋要比幾次。' +
           '<br>但真正要決定的是 —— <b>「這批資料，我到底要不要先排序？」</b>' +
           '<br>⚠️ 二元搜尋<span class="hl">要先排好序</span>，' +
           '而排序那幾千次是<b>先付掉的</b>。這一步就是把那筆帳算出來。' +
           /* ⚠️ 這一句一定要留著：課本那句「二元搜尋比較快」如果不先擋，
              學生會把整章記成那五個字，而排序的成本就被當成免費的。 */
           '<br>⚠️ 所以結論<b>不是</b>「二元搜尋比較快」—— 那句話是有前提的。',
      /* ⚠️ 過關標準的順序要和畫面上的順序一樣（老師 2026-08-18 反映流程不順）——
         不一樣的話學生會照著標準去找，但畫面上那一題還沒出現。 */
      pass: '① 三種資料量的數字都看過；<br>' +
            '② 按「<b>＋ 再查幾次</b>」，把<b>不排序比較省</b>和' +
            '<b>先排序比較省</b>兩種畫面<b>都找出來</b>；<br>' +
            '③ 最後回答：<b>查幾次以上</b>先排序才划算（答在附近就算對）。'
    };
  }

  global.BIGCOST = {
    VERSION: VERSION,
    mount: mount,
    goal: goal,
    selCompares: selCompares,
    insWorst: insWorst,
    insBest: insBest,
    seqWorst: seqWorst,
    binWorst: binWorst,
    costPlain: costPlain,
    costSorted: costSorted,
    better: better,
    breakEven: breakEven,
    PLANS: PLANS,
    SIZE_KINDS: SIZE_KINDS,
    selMoves: selMoves,
    movesOf: movesOf,
    sortCost: sortCost,
    feeOf: feeOf,
    costSortedBy: costSortedBy,
    betterBy: betterBy,
    breakEvenBy: breakEvenBy,
    SIZES: SIZES,
    STEPS: STEPS
  };
})(typeof window !== 'undefined' ? window : this);
