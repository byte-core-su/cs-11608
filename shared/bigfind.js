/* =====================================================================
   實作體驗：100 個人（第 5 關 6-1-1 的最後一步）
   ---------------------------------------------------------------------
   ★ 為什麼第 5 關的最後一步不是「上傳作品」
     課本 6-1 是**觀念導入**，不寫程式 —— 這一關的程式其實就是
     第 6 關（選擇排序）和第 7 關（插入排序）。
     但每一關的最後一步都叫學生「在 Scratch 做出來並上傳」，
     第 5 關沒有東西可交，學生會卡在那裡。
     ⇒ 換成一段**體驗**，而且是這一關唯一做得到、
       前面幾步做不到的事：把資料量放大。

   ★★ 這一段要讓學生撞到的那句話
     概念檢測寫著：「五個人你看一眼就好，五萬個人呢？
     那時候『怎麼比』才會變成問題。」
     五個人的實驗室（minlab）證明不了這句話 —— 五個人**真的**一眼就看完。
     一百個人才會痛。痛過一次，第 6 關要寫的迴圈才有理由。

   三題（老師 2026-08-17 選的）：
     ① 找出最矮的　　　　→ 用眼睛掃一百個，會漏
     ② 已排好 10 個，找第 11 個 → 那就是選擇排序的第 11 回合
     ③ 比速度：你 vs 電腦　→ 重點不是誰快，是**電腦不會漏看**

   ⚠️ 「電腦比較快」不是這一段的結論。
      國中生按幾下就知道電腦快，那不必教。
      要教的是：你掃一百個會漏、會眼花、會想放棄，
      而電腦做 99 次比較，每一次都一樣。

   用法：
     BIGFIND.mount(host, { n: 100, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-bigfind';

  /* ── 規則（純函式）───────────────────────────────── */

  /**
   * 出一題。
   * ⚠️ 身高不可以重複：有兩個並列最矮的話，「最矮的是誰」有兩個答案，
   *    而學生點到另一個會被判錯 —— 那是系統的錯，不是他的。
   */
  function makeCase(n, rnd) {
    rnd = rnd || Math.random;
    n = n || 100;
    /* ⚠️⚠️ 2026-08-17 老師問「每次的最小值與 100 個數字是固定嗎」——
       查下來：組合每次都不同，但**最小值幾乎固定**。
       原本的池子是 120～199.5 每 0.5 一格（160 種），每次抽 100 個
       ⇒ 120 公分被抽中的機率 100/160 = 62.5%，
         實測 400 次：最小值是 120 的有 249 次、120.5 有 97 次 —— 兩者就佔了 86%。
         學生玩兩次就會發現「找 120 開頭的那個」，題目等於白出。

       ⇒ 改成：**每一題的身高範圍自己浮動**。
         起點在 125～148 之間隨機，往上 42 公分（都在國中生的合理範圍），解析度 0.1。
         這樣最小值可能是 121.4、也可能是 149.8，猜不到。
       ★ 0.1 公分看起來也更像真的身高（163.7 公分）。 */
    /* ⚠️ 範圍要**像真的國中生**：125～190 公分。
       原本寫 118～202，最高那個 202 公分不是國中生的身高，
       學生一看就知道是亂數，人群的說服力就沒了。 */
    var lo = Math.round((125 + rnd() * 23) * 10);      // 起點 125～148 公分
    var span = 420;                                    // 往上 42 公分 → 最高約 190
    var pool = [];
    for (var v = lo; v <= lo + span; v++) pool.push(v / 10);
    /* 洗牌後取前 n 個 */
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n).map(function (h, k) {
      return { id: k, h: Math.round(h * 10) / 10 };
    });
  }

  /** 最矮的是第幾個（索引）。 */
  function minOf(items, skip) {
    skip = skip || {};
    var best = -1;
    for (var i = 0; i < items.length; i++) {
      if (skip[items[i].id]) continue;
      if (best < 0 || items[i].h < items[best].h) best = i;
    }
    return best;
  }

  /**
   * 前 k 矮的那幾個（第 ② 題「已經排好的」那一排）。
   * 回傳的是 id 的集合，方便畫面上標記與排除。
   */
  function lowestK(items, k) {
    var sorted = items.slice().sort(function (a, b) { return a.h - b.h; });
    var set = {};
    sorted.slice(0, k).forEach(function (p) { set[p.id] = true; });
    return set;
  }

  /** 電腦要比幾次（一個一個看，第一個直接記住）。 */
  function compares(n) { return n - 1; }

  /* ── 三題的定義 ───────────────────────────────────── */
  var TASKS = [
    { key: 'min', icon: '🔎', name: '找出最矮的',
      ask: '這 <b>%n</b> 個人裡，<b>最矮</b>的是誰？點他一下。',
      why: '五個人你一眼就看完了。一百個人呢？' +
           '你剛才是不是也「掃了好幾遍、怕漏掉」——<b>那個感覺就是重點</b>。' },
    { key: 'next', icon: '📥', name: '找下一個',
      ask: '最矮的 <b>10</b> 個已經被搬到「已排序」了（畫面上<b>打勾</b>的那些）。' +
           '<br>剩下的人裡面，<b>下一個</b>該搬走的是誰？',
      why: '這就是選擇排序的<b>第 11 回合</b> —— ' +
           '每一回合都在剩下的人裡面挑最矮的。做十一次，就排好十一個。' },
    { key: 'race', icon: '⏱️', name: '你 vs 電腦',
      ask: '再找一次最矮的 —— 這次<b>計時</b>。找到之後，讓電腦也做一次。',
      why: '重點不是誰比較快。<b>電腦不會漏看</b> —— ' +
           '它做 %c 次比較，每一次都一模一樣；而你掃到第五十個的時候已經開始眼花了。' }
  ];

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.bf{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.bf-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.bf-tip b{color:#4338ca}',
    '.bf-head{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
    '.bf-step{font-size:12px;font-weight:900;padding:4px 11px;border-radius:9999px;',
    '  background:#e2e8f0;color:#475569}',
    '.bf-step.on{background:#6366f1;color:#fff}',
    '.bf-step.ok{background:#dcfce7;color:#166534}',
    '.bf-timer{margin-left:auto;font-size:13px;font-weight:900;color:#6366f1}',
    /* ── 一整片站著的人 ─────────────────────────────
       ★ 為什麼要畫成人形而不是一格一個數字
         數字方格會變成「找最小的數字」——那是算術題，不是這一關要教的事。
         畫成人，而且**身高真的畫出來**（矮的人看起來就是比較矮），
         學生才會像真的在人群裡找人：先用看的掃一遍，
         然後發現「有幾個好像差不多高，我分不出來」——
         那個瞬間就是這一關的全部。
       ⚠️ 所以人形的高度一定要跟著身高變，不可以全部一樣高。 */
    '.bf-yard{background:linear-gradient(#f8fafc,#eef2ff);border:1px solid #e2e8f0;',
    '  border-radius:14px;padding:10px 8px 4px;margin-bottom:11px}',
    /* ⚠️⚠️ 一百個人**一定要一屏塞得下**。
       2026-08-17 老師：「不在同一個頁面內顯示全部的人，不好選擇與比對」。
       ★ 這一關的動作就是「掃一遍、比一比」——
         要捲動的話，學生看不到全部，也就無從比較；
         而且捲上捲下更容易漏看，那不是這一關想製造的困難。
       ⇒ 20 欄 × 5 排。一排 20 個人在 4xl 寬度下每人約 40px，
         放得下 11～15px 的人形，總高度約 300px，一屏看得完。
       ⚠️ 手機窄，20 欄會擠成一條線 —— 改 10 欄 10 排（那時本來就要捲）。 */
    '.bf-row{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));',
    '  align-items:end;border-bottom:2px solid #cbd5e1;margin-bottom:6px;padding-bottom:2px}',
    '@media (max-width:640px){.bf-row{grid-template-columns:repeat(10,minmax(0,1fr))}}',
    /* 一個人：由下往上長，站在那條地面線上 */
    '.bf-p{position:relative;display:flex;flex-direction:column;align-items:center;',
    '  justify-content:flex-end;background:none;border:0;padding:0 0 2px;cursor:pointer;',
    '  font-family:inherit;transition:.12s}',
    '.bf-p:hover{transform:translateY(-3px)}',
    /* 身高數字要小 —— 20 欄的格子只有 40px 寬，太大就疊在一起。
       ⚠️ 但不可以拿掉：老師要求「頭上有身高顯示」，
          而且沒有數字的話「差不多高的兩個」就真的分不出來了。 */
    '.bf-p .ht{font-size:8.5px;font-weight:900;color:#94a3b8;margin-bottom:1px;',
    '  white-space:nowrap;line-height:1}',
    '.bf-p:hover .ht{color:#4338ca}',
    /* ⚠️ 叫 .bf-hd 不叫 .bf-head —— .bf-head 已經是上面**步驟列**的容器。
       撞名的話步驟列會被套上 9×9 的圓形，整條列直接壞掉，
       而 jsdom 不套 CSS，測試照樣全綠。 */
    '.bf-hd{width:8px;height:8px;border-radius:50%;background:#94a3b8;transition:.12s}',
    '.bf-body{width:10px;border-radius:5px 5px 2px 2px;background:#cbd5e1;',
    '  margin-top:1px;transition:.12s}',
    '.bf-p:hover .bf-hd,.bf-p:hover .bf-body{background:#6366f1}',
    /* 狀態。宣告順序：done → scan → best → bad/good（後面的蓋前面的） */
    '.bf-p.done .bf-hd,.bf-p.done .bf-body{background:#e2e8f0}',
    '.bf-p.done .ht{color:#e2e8f0}',
    '.bf-p.scan .bf-hd,.bf-p.scan .bf-body{background:#6366f1}',
    '.bf-p.scan .ht{color:#4338ca}',
    '.bf-p.best .bf-hd,.bf-p.best .bf-body{background:#f59e0b}',
    '.bf-p.best .ht{color:#b45309}',
    '.bf-p.bad .bf-hd,.bf-p.bad .bf-body{background:#ef4444}',
    '.bf-p.bad .ht{color:#991b1b}',
    '.bf-p.good .bf-hd,.bf-p.good .bf-body{background:#22c55e}',
    '.bf-p.good .ht{color:#166534}',
    /* 已排好的人頭上插一支小旗子 */
    '.bf-p .flag{position:absolute;top:-2px;font-size:9px}',
    /* 電腦手上「目前最矮的」戴皇冠 —— 那一頂就是變數 */
    '.bf-p .crown{position:absolute;top:-3px;font-size:10px}',
    '.bf-msg{font-size:13.5px;line-height:1.85;padding:10px 13px;border-radius:10px;margin-bottom:10px}',
    '.bf-msg.good{background:#dcfce7;color:#166534}',
    '.bf-msg.bad{background:#fee2e2;color:#991b1b}',
    '.bf-msg.info{background:#f1f5f9;color:#475569}',
    '.bf-bar{display:flex;gap:8px;flex-wrap:wrap}',
    '.bf-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:9px 16px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.bf-btn:hover{background:#4f46e5}',
    '.bf-btn:disabled{background:#cbd5e1;cursor:default}',
    '.bf-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    /* 還沒開始計時：蓋住那一片人 */
    '.bf-veil{display:flex;align-items:center;justify-content:center;min-height:190px}',
    '.bf-veil-in{text-align:center;color:#64748b}',
    '.bf-veil-in .ico{font-size:40px;line-height:1}',
    '.bf-veil-in .tx{font-size:13.5px;line-height:1.9;margin-top:8px}',
    '.bf-veil-in .tx b{color:#4338ca}',
    '.bf-race{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px}',
    '.bf-race div{flex:1;min-width:130px;background:#f8fafc;border:2px solid #e2e8f0;',
    '  border-radius:11px;padding:9px 12px}',
    '.bf-race .lb{font-size:11.5px;font-weight:900;color:#64748b}',
    '.bf-race .vl{font-size:20px;font-weight:900;color:#4338ca}',
    '.bf-done{background:#ecfdf5;border:2px solid #6ee7b7;border-radius:14px;',
    '  padding:14px 16px;font-size:14px;line-height:1.95;color:#065f46}',
    /* 放大版（關卡頁的那一步）：人變大、數字看得清楚。
       ⚠️ 不可以沿用方格版那組 min-height／padding —— 那會把人形壓扁。 */
    '.bf-big .bf-hd{width:10px;height:10px}',
    '.bf-big .bf-body{width:13px}',
    '.bf-big .bf-p .ht{font-size:10px}',
    '.bf-big .bf-row{margin-bottom:8px}',
    '.bf-big .bf-tip{font-size:14.5px;padding:14px 17px}',
    '.bf-big .bf-msg{font-size:14.5px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('bigfind-css')) return;
    var s = global.document.createElement('style');
    s.id = 'bigfind-css';
    s.textContent = CSS;
    global.document.head.appendChild(s);
  }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();

    var n = opts.n || 100;
    var items = makeCase(n, opts.rnd);
    var loH = 0, hiH = 0;                  // 這一題的最矮／最高（畫人形用）
    function measure() {
      loH = Math.min.apply(null, items.map(function (p) { return p.h; }));
      hiH = Math.max.apply(null, items.map(function (p) { return p.h; }));
    }
    measure();
    var at = 0;                    // 第幾題（0～2）
    var cleared = {};              // 過了哪幾題
    var msg = '', kind = 'info';
    var tries = 0;                 // 這一題點錯幾次
    var mark = {};                 // 畫面上的臨時標記（點錯／點對）
    var doneSet = {};              // 第 ② 題：已經排序好的那 10 個
    var t0 = 0, mySec = 0;         // 第 ③ 題的計時
    var auto = null, autoAt = -1, autoBest = -1;   // 電腦示範

    function task() { return TASKS[at]; }

    /* 這一題的正解（索引） */
    function answer() {
      if (task().key === 'next') return minOf(items, doneSet);
      return minOf(items);
    }

    function render() {
      host.className = 'bf' + (opts.big ? ' bf-big' : '');
      /* ⚠️⚠️ 第 ③ 題還沒按「開始計時」之前，人群要**蓋起來**。
         2026-08-17 老師：「第三個要按計時開始，但是我可以先找到再開始」。
         看得到的話，學生先慢慢找到目標、再按開始、再一秒點下去 ——
         計時量到的是按按鈕的速度，整題就白出了。
         ★ 蓋住而不是不畫：學生要先看到「等一下要面對這麼一大片」，
           心理準備和實際開始是兩件事。 */
      var hide = (task().key === 'race' && !cleared.race && !t0);
      host.innerHTML =
        tipHTML() +
        headHTML() +
        (task().key === 'race' ? raceHTML() : '') +
        (hide
          ? '<div class="bf-yard bf-veil">' +
              '<div class="bf-veil-in">' +
                '<div class="ico">🫣</div>' +
                '<div class="tx">一百個人已經站好了，先蓋起來。' +
                '<br>按下<b>開始計時</b>才會掀開 —— 到時候再找。</div>' +
              '</div></div>'
          : '<div class="bf-yard" id="bf-yard"></div>') +
        (msg ? '<div class="bf-msg ' + kind + '">' + msg + '</div>' : '') +
        (allDone() ? doneHTML() : '') +
        barHTML();
      grid();
      wire();
    }

    function allDone() { return cleared.min && cleared.next && cleared.race; }

    function tipHTML() {
      if (allDone()) return '';
      var t = task();
      return '<div class="bf-tip">' + t.icon + ' <b>' + t.name + '</b>　' +
             t.ask.replace('%n', n) + '</div>';
    }

    function headHTML() {
      return '<div class="bf-head">' +
        TASKS.map(function (t, i) {
          var cls = cleared[t.key] ? ' ok' : (i === at ? ' on' : '');
          return '<span class="bf-step' + cls + '">' +
                 (cleared[t.key] ? '✔ ' : (i + 1) + '. ') + t.name + '</span>';
        }).join('') +
        (t0 && !cleared.race && task().key === 'race'
          ? '<span class="bf-timer" id="bf-t">計時中…</span>' : '') +
        '</div>';
    }

    function raceHTML() {
      return '<div class="bf-race">' +
        '<div><span class="lb">你花的時間</span>' +
          '<span class="vl">' + (mySec ? mySec.toFixed(1) + ' 秒' : '—') + '</span></div>' +
        '<div><span class="lb">電腦比較次數</span>' +
          '<span class="vl">' + (autoAt >= 0 ? autoAt : '—') +
          ' / ' + compares(n) + '</span></div>' +
        '</div>';
    }

    /**
     * 畫出一整片站著的人。
     * ★ 身高 → 人形高度：120 公分畫 22px、199.5 公分畫 52px。
     *   ⚠️ 比例不能太小，不然一百個人看起來一樣高，
     *      「用看的分不出來」就變成系統的問題，不是學生的體驗。
     */
    /**
     * 身高 → 人形高度。
     * ⚠️ 這個範圍是**被總高度綁住**的：5 排要塞進一屏（約 300px），
     *    所以一排最多約 55px（人 + 數字 + 間距）。
     * ★ 但差距不能壓太扁 —— 16→46px（差 30px）是還看得出高矮的下限。
     *   再小就變成「只能讀數字」，那又回到算術題了。
     */
    /**
     * 身高 → 人形高度。
     * ★ 用**這一題實際的最矮／最高**去換算，不是寫死 120～199.5。
     *   ⚠️ 身高範圍現在每題浮動（見 makeCase）——
     *      寫死的話，範圍窄的那幾題所有人會畫得差不多高，
     *      「用看的分不出來」就變成系統的問題。
     *   ⇒ 不管抽到什麼範圍，畫出來永遠用滿 16～46px。
     */
    function figH(h) {
      var span = hiH - loH || 1;
      var base = 16 + (h - loH) / span * 30;      // 最矮 → 16px、最高 → 46px
      return Math.round(base * (opts.big ? 1.12 : 1));
    }
    /* 頭的高度（含下面那 1px 間距）。放大版的頭也比較大 ——
       ⚠️ 不扣掉頭的話，身高愈高的人整體會多長出一顆頭的距離，
          畫出來的比例就不是身高的比例了。 */
    function headH() { return opts.big ? 11 : 9; }

    function grid() {
      /* 蓋著的時候沒有 #bf-yard —— 直接不畫（見 render 裡的 hide）。 */
      var box = host.querySelector('#bf-yard');
      if (!box) return;
      /* ⚠️ 要和 CSS 的 grid-template-columns 一致（20 欄）。
         對不上的話最後一排會歪掉，而且沒有人看得出為什麼。 */
      var per = 20;                       // 一排幾個人 → 100 人剛好 5 排
      var rows = [];
      for (var r = 0; r * per < items.length; r++) {
        rows.push(items.slice(r * per, (r + 1) * per).map(function (p) {
          var i = p.id;
          var cls = 'bf-p';
          if (task().key === 'next' && doneSet[p.id]) cls += ' done';
          if (i === autoAt) cls += ' scan';
          if (i === autoBest) cls += ' best';
          if (mark[i] === 'bad') cls += ' bad';
          if (mark[i] === 'good') cls += ' good';
          var bh = Math.max(6, figH(p.h) - headH());
          return '<button class="' + cls + '" data-i="' + i + '" ' +
                 'title="第 ' + (i + 1) + ' 個｜' + p.h + ' 公分">' +
                 (task().key === 'next' && doneSet[p.id] ? '<span class="flag">🚩</span>' : '') +
                 (i === autoBest ? '<span class="crown">👑</span>' : '') +
                 '<span class="ht">' + p.h + '</span>' +
                 '<span class="bf-hd"></span>' +
                 '<span class="bf-body" style="height:' + bh + 'px"></span>' +
                 '</button>';
        }).join(''));
      }
      box.innerHTML = rows.map(function (r) {
        return '<div class="bf-row">' + r + '</div>';
      }).join('');
      [].forEach.call(box.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { tap(Number(el.dataset.i)); };
      });
    }

    function tap(i) {
      if (allDone() || auto) return;
      var t = task();
      if (t.key === 'race' && !t0) {
        say('info', '先按「⏱️ 開始計時」再找。');
        return;
      }
      if (t.key === 'next' && doneSet[items[i].id]) {
        say('info', '打勾的那些<b>已經排好了</b> —— 要在剩下的人裡面挑。');
        return;
      }
      var want = answer();
      if (i === want) {
        mark = {}; mark[i] = 'good';
        if (t.key === 'race') { mySec = (Date.now() - t0) / 1000; }
        cleared[t.key] = true;
        say('good', '✔ 第 ' + (i + 1) + ' 個，' + items[i].h + ' 公分 —— 對了。<br>' +
                    t.why.replace('%c', compares(n)));
        return;
      }
      tries++;
      mark = {}; mark[i] = 'bad';
      var d = items[i].h - items[want].h;
      say('bad', '第 ' + (i + 1) + ' 個是 ' + items[i].h + ' 公分，' +
                 '但還有人比他矮 <b>' + d.toFixed(1) + ' 公分</b>。' +
                 (tries >= 2
                   ? '<br>⚠️ 一個一個看很累對不對？<b>那正是這一關要你體會的事。</b>'
                   : '<br>再找找看。'));
    }

    function say(k, m) { kind = k; msg = m; render(); }

    /**
     * 三題都過了之後的收尾。
     * ★ 要把這一段和第 6、7 關**接起來** ——
     *   不接的話，學生只覺得剛才玩了一個小遊戲。
     */
    function doneHTML() {
      return '<div class="bf-done">' +
        '🎉 <b>三題都過了。</b>' +
        '<br>你剛才做的事，就是<b>選擇排序法</b>的一回合：' +
        '在還沒排好的人裡面找出最矮的，把他搬到已排好的那一排。' +
        '<br>做一百次，一百個人就排好了 —— ' +
        '而<b>第 6 關</b>要做的，就是把這件事寫成 Scratch 積木，讓電腦自己跑一百次。' +
        '<div style="margin-top:8px;font-size:13px">' +
        '⚠️ 這一關<b>沒有程式作品要交</b>（課本這一節是觀念導入）。' +
        '按下面的按鈕就算完成，<b>第 6 關會打開</b>。</div>' +
        '</div>';
    }

    function barHTML() {
      var t = task();
      var b = [];
      if (allDone()) {
        /* ⚠️ 和 bigcost 同一條規則（老師 2026-08-18）：
           按鈕上的字要說出**按下去會發生什麼**，而模組不知道自己後面還有沒有東西。
           ⇒ 由關卡頁傳進來。第 5 關目前後面沒有期末檢核，所以維持預設。 */
        b.push('<button class="bf-btn" data-a="finish">' +
               (opts.nextLabel || '完成，回闖關地圖 →') + '</button>');
      } else if (cleared[t.key]) {
        b.push('<button class="bf-btn" data-a="next">下一題 →</button>');
      } else if (t.key === 'race') {
        if (!t0) b.push('<button class="bf-btn" data-a="start">⏱️ 開始計時</button>');
      }
      if (t.key === 'race' && cleared.race && autoAt < 0) {
        b.push('<button class="bf-btn ghost" data-a="auto">▶ 讓電腦做一次</button>');
      }
      return '<div class="bf-bar">' + b.join('') + '</div>';
    }

    function wire() {
      [].forEach.call(host.querySelectorAll('[data-a]'), function (el) {
        el.onclick = function () { act(el.dataset.a); };
      });
    }

    function act(a) {
      if (a === 'start') {
        t0 = Date.now();
        say('info', '開始了 —— 找出最矮的那一個。');
        return;
      }
      if (a === 'next') {
        at++;
        if (at >= TASKS.length) at = TASKS.length - 1;
        tries = 0; mark = {}; msg = ''; kind = 'info';
        if (TASKS[at].key === 'next') doneSet = lowestK(items, 10);
        /* ⚠️⚠️ 第 ③ 題（計時）一定要**換一批人**。
           不換的話，答案和第 ① 題在**同一個位置** ——
           學生記得剛才點哪裡，一秒就點完，計時量到的是記憶力不是找人。
           ★ 這和 searchlab 那個「換一題永遠出同一題」是同一種錯：
             畫面看起來換了，其實沒換，而且測試不走 UI 就抓不到。
           ⚠️ 第 ② 題**不必**換：它的答案是第 11 矮的，
              位置本來就和第 ① 題不同，而且沿用同一群人才看得出
              「已經搬走 10 個」是怎麼回事。 */
        if (TASKS[at].key === 'race') {
          items = makeCase(n, opts.rnd);
          measure();
          doneSet = {};
          autoAt = -1; autoBest = -1;
        }
        render();
        return;
      }
      if (a === 'auto') { runAuto(); return; }
      if (a === 'finish') {
        if (opts.onPass) opts.onPass();
        return;
      }
    }

    /**
     * 電腦示範：一個一個看，手上永遠記著目前最矮的。
     * ⚠️ 要**慢到看得見**。瞬間跑完的話學生只看到結果，
     *    看不到「它一個都沒有跳過」—— 而那才是這一段的結論。
     */
    function runAuto() {
      autoAt = 0; autoBest = 0;
      msg = ''; kind = 'info';
      render();
      auto = global.setInterval(function () {
        autoAt++;
        if (autoAt >= items.length) {
          global.clearInterval(auto); auto = null;
          autoAt = compares(n);
          say('good', '電腦做完了：<b>' + compares(n) + ' 次比較</b>，' +
                      '最矮的是第 ' + (autoBest + 1) + ' 個（' + items[autoBest].h + ' 公分）。' +
                      '<br>★ 你花了 ' + mySec.toFixed(1) + ' 秒。' +
                      '<b>但真正的差別不是快慢 —— 是它一個都沒有跳過。</b>' +
                      '<br>第 6 關就是把這件事寫成 Scratch 積木。');
          return;
        }
        if (items[autoAt].h < items[autoBest].h) autoBest = autoAt;
        render();
      }, 28);
    }

    render();

    return {
      destroy: function () { if (auto) global.clearInterval(auto); host.innerHTML = ''; },
      _s: function () {
        return { at: at, cleared: cleared, items: items, doneSet: doneSet,
                 tries: tries, mySec: mySec, autoAt: autoAt, done: allDone() };
      }
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅）。 */
  function goal(cfg) {
    var n = (cfg && cfg.n) || 100;
    return {
      why: '前面的實驗室只有 5 個人 —— 五個人你<b>真的</b>一眼就看完了，' +
           '證明不了「為什麼需要演算法」。' +
           '這一段給你 <b>' + n + '</b> 個人：' +
           '用眼睛掃會漏、會眼花、會想放棄，那個感覺就是第 6 關存在的理由。',
      pass: '三題都答對：<br>' +
            '① 找出最矮的　② 已排好 10 個，找下一個該搬的　③ 計時比一次，再讓電腦做一次'
    };
  }

  global.BIGFIND = {
    VERSION: VERSION,
    mount: mount,
    goal: goal,
    makeCase: makeCase,
    minOf: minOf,
    lowestK: lowestK,
    compares: compares,
    TASKS: TASKS
  };
})(typeof window !== 'undefined' ? window : this);
