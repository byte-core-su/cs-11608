/* =====================================================================
   Scratch 風積木模擬器（上下學期共用）
   ---------------------------------------------------------------------
   讓學生在網頁上直接把積木拖出一段程式，按執行看角色怎麼動，
   組對了就算通關 —— 不必離開頁面去 Scratch、也不必上傳作品。

   ★ 為什麼自己做而不是嵌 Scratch 官方編輯器：
     官方編輯器沒有「這一關只能用這幾塊積木」也沒有「答案對不對」的概念。
     這裡的重點是**限定積木**與**自動判定**，等於一道結構化的練習題，
     不是一個自由創作環境。自由創作仍然回 Scratch 做。

   ⚠️ 判定跑在瀏覽器裡，所以「通關」是學生的電腦說了算。
      會開 F12 的學生可以直接把自己標成通過。
      拼圖只是練習（不給作品星），安全規則擋得住「寫別人的進度」，擋不住「謊報自己的成績」。

   ---------------------------------------------------------------------
   用法：
     BLOCKS.mount(document.getElementById('sim'), {
       palette : ['motion.move', 'control.repeat', …],   // 這一關給哪些積木
       goal    : [ {id:'motion.move', args:[10]} ],      // 正確答案
       hint    : '把小貓往前移動 10 點',
       onPass  : () => { … }                             // 組對時呼叫
     });

   拖曳用 pointer events 自己實作，不用 HTML5 drag-and-drop ——
   後者在平板／觸控螢幕上不會觸發，而電腦教室有時會用觸控螢幕。
   ===================================================================== */
(function (global) {
  'use strict';

  /* ===== 積木定義 =====
     label 裡的 %n / %s 是參數欄位（數字／文字），順序對應 args。
     shape: 'stack' 一般積木｜'c' 可以包住其他積木｜'hat' 開頭帽子

     ★★ 積木名稱一律照 Scratch 官方繁體中文，一個字都不改 ★★
     來源：scratch-l10n（Scratch 官方翻譯庫）
       積木   https://github.com/scratchfoundation/scratch-l10n/blob/master/editor/blocks/zh-tw.json
       擴充   https://github.com/scratchfoundation/scratch-l10n/blob/master/editor/extensions/zh-tw.json
     學生在這裡練完回去打開 Scratch，看到的必須是同一個名字 ——
     自己取「落筆」「全部擦掉」這種聽起來比較白話的名字，等於逼學生
     學兩套詞彙，那是我們自己製造的障礙。
     每個積木後面都標了官方的訊息代號，之後要對照就從那裡查。
     check.py 會比對常用積木的名稱，改錯會被擋下來。

     下面標「★自訂」的幾塊在 Scratch 裡沒有對應積木（是為了避開
     「回報值積木」而做的簡化），只有那幾塊是我們自己命名的。 */
  /* 宣告順序＝調色盤的分類順序，刻意照真的 Scratch 排：
     動作 → 外觀 → 音效 → 事件 → 控制 → 變數 → 清單 → 函式積木 → 畫筆（擴充）
     顏色也用 Scratch 的原色，學生在這裡看到的藍色，回到 Scratch 還是同一個藍色。 */
  var CATS = {
    motion:  { name: '動作',   color: '#4c97ff', dark: '#3373cc' },  // CATEGORY_MOTION
    looks:   { name: '外觀',   color: '#9966ff', dark: '#774dcb' },  // CATEGORY_LOOKS
    sound:   { name: '音效',   color: '#cf63cf', dark: '#bd42bd' },  // CATEGORY_SOUND
    events:  { name: '事件',   color: '#ffbf00', dark: '#cc9900' },  // CATEGORY_EVENTS
    control: { name: '控制',   color: '#ffab19', dark: '#cf8b17' },  // CATEGORY_CONTROL
    data:    { name: '變數',   color: '#ff8c1a', dark: '#db6e00' },  // CATEGORY_VARIABLES
    list:    { name: '清單',   color: '#ff661a', dark: '#e64d00' },  // Scratch 把清單放在「變數」裡，顏色是這個
    operator:{ name: '運算',   color: '#59c059', dark: '#389438' },  // CATEGORY_OPERATORS
    sensing: { name: '偵測',   color: '#5cb1d6', dark: '#2e8eb8' },  // CATEGORY_SENSING
    my:      { name: '函式積木', color: '#ff6680', dark: '#ff4d6a' }, // CATEGORY_MYBLOCKS（不是「我的積木」）
    pen:     { name: '畫筆',   color: '#0fbd8c', dark: '#0b8e69' }   // pen.categoryName
  };

  /* ⚠️⚠️ 用詞規則（老師 2026-08-17 決定）：
     **一律用範例檔（.sb3）裡的清單與變數名稱**，不要自己另取一套。
       清單：原始資料／已排序資料　　變數：位置、開始位置、結束位置、
             資料位置、最小值位置、插入位置
     ★ 為什麼：學生在拼圖上看到的字，回到 Scratch 要找得到同一個東西。
       系統原本寫「數列」「二分位置」（那是課本 p.208 的講法），
       範例檔寫的是「原始資料」「位置」—— 兩套名字，學生得自己翻譯一次。
     ⚠️ 代價：課本用「二分位置」，這裡叫「位置」。
        指回課本的時候要說一句「課本上叫二分位置」。 */
  var DEFS = {
    // %flag 會畫成綠旗（就是 Scratch 的那面旗子），不是播放三角形
    'events.whenflag':  { cat:'events',  shape:'hat',   label:'當 %flag 被點擊' },              // EVENT_WHENFLAGCLICKED
    /* ★ 2026-08-17 加：老師的範例檔（單元七、八、九）主程式都是**當角色被點擊**——
       綠旗那一塊留給「建立資料」（隨機產生一列數字），
       點角色才開始排序／搜尋。那是刻意的：資料和演算法分成兩支，
       學生可以重跑演算法而不必重新亂數一組資料。
       ⚠️ 系統原本只有綠旗，於是拼圖教的和範例檔對不起來 ——
          學生照拼圖做完，回 Scratch 會發現帽子積木不一樣。 */
    'events.whenclicked':{cat:'events',  shape:'hat',   label:'當角色被點擊' },                    // EVENT_WHENTHISSPRITECLICKED
    'motion.move':      { cat:'motion',  shape:'stack', label:'移動 %n 點',        args:[10] }, // MOTION_MOVESTEPS
    // ↻ ↺ 是 Scratch 積木上真的有的箭頭圖示（MOTION_TURNRIGHT 的 %1）
    // 預設 15 度也照 Scratch —— 順便讓調色盤不會直接把答案（90）送給學生
    'motion.turnright': { cat:'motion',  shape:'stack', label:'右轉 ↻ %n 度',      args:[15] }, // MOTION_TURNRIGHT
    'motion.turnleft':  { cat:'motion',  shape:'stack', label:'左轉 ↺ %n 度',      args:[15] }, // MOTION_TURNLEFT
    'motion.goto':      { cat:'motion',  shape:'stack', label:'定位到 x:%n y:%n',  args:[0, 0] },// MOTION_GOTOXY（冒號後沒空格）
    'motion.point':     { cat:'motion',  shape:'stack', label:'面朝 %n 度',        args:[90] }, // MOTION_POINTINDIRECTION
    'motion.setx':      { cat:'motion',  shape:'stack', label:'x 設為 %n',         args:[0] },  // MOTION_SETX
    'motion.sety':      { cat:'motion',  shape:'stack', label:'y 設為 %n',         args:[0] },  // MOTION_SETY
    'motion.changex':   { cat:'motion',  shape:'stack', label:'x 改變 %n',         args:[10] }, // MOTION_CHANGEXBY
    'motion.changey':   { cat:'motion',  shape:'stack', label:'y 改變 %n',         args:[10] }, // MOTION_CHANGEYBY
    'looks.say':        { cat:'looks',   shape:'stack', label:'說出 %s',           args:['Hello!'] },     // LOOKS_SAY
    'looks.sayfor':     { cat:'looks',   shape:'stack', label:'說出 %s 持續 %n 秒', args:['Hello!', 2] }, // LOOKS_SAYFORSECS
    'looks.next':       { cat:'looks',   shape:'stack', label:'造型換成下一個' },                // LOOKS_NEXTCOSTUME
    'looks.change':     { cat:'looks',   shape:'stack', label:'尺寸改變 %n',       args:[10] }, // LOOKS_CHANGESIZEBY
    'sound.play':       { cat:'sound',   shape:'stack', label:'播放音效 %s',       args:['喵'] },// SOUND_PLAY
    'control.wait':     { cat:'control', shape:'stack', label:'等待 %n 秒',        args:[1] },  // CONTROL_WAIT
    'control.repeat':   { cat:'control', shape:'c',     label:'重複 %n 次',        args:[10] }, // CONTROL_REPEAT
    // 變數名稱也是學生自己取的 → idArgs
    'data.setvar':      { cat:'data',    shape:'stack', label:'變數 %s 設為 %n',   args:['我的變數', 0], idArgs:[0], idNs:['var'] }, // DATA_SETVARIABLETO（Scratch 新專案的預設變數就叫「我的變數」）
    'data.changevar':   { cat:'data',    shape:'stack', label:'變數 %s 改變 %n',   args:['我的變數', 1], idArgs:[0], idNs:['var'] }, // DATA_CHANGEVARIABLEBY

    /* 畫筆（擴充積木）：1～3 關畫正方形、正多邊形要用 */
    'pen.clear':        { cat:'pen',     shape:'stack', label:'筆跡全部清除' },                  // pen.clear
    'pen.down':         { cat:'pen',     shape:'stack', label:'下筆' },                          // pen.penDown
    'pen.up':           { cat:'pen',     shape:'stack', label:'停筆' },                          // pen.penUp
    'pen.color':        { cat:'pen',     shape:'stack', label:'筆跡顏色設為 %s', args:['紅'] },  // pen.setHue

    /* 函式積木（Scratch 的「函式積木」分類）：1～3 關的主角
       PROCEDURES_DEFINITION 是「定義 %1」，呼叫時就是積木自己的名字。
       參數支援 0～2 個。真正的 Scratch 要幾個都行，兩個已經夠課程用
       （「畫圖形 (邊數) (邊長)」同時決定形狀與大小）。 */
    // idArgs 標出「這一格是學生自己取的名字」，判定時只看定義與呼叫有沒有對上，
    // 不要求跟參考答案同名（詳見下面 canon()）。廣播積木加進來時也要標。
    'my.define':        { cat:'my',      shape:'c',     label:'定義 %s',       args:['畫正方形'], idArgs:[0], idNs:['proc'] },
    // 積木名和「參數名」都由學生自己取（Scratch 就是這樣），所以兩格都是 idArgs
    'my.definep':       { cat:'my',      shape:'c',     label:'定義 %s (%s)',  args:['畫正方形', '邊長'], idArgs:[0, 1], idNs:['proc', 'param'] },
    // 兩個參數（Scratch 的自訂積木要幾個參數都行；這裡做到兩個，
    // 因為課程用得到「畫圖形 (邊數) (邊長)」這種同時決定形狀與大小的積木）
    'my.definep2':      { cat:'my',      shape:'c',     label:'定義 %s (%s) (%s)', args:['畫圖形', 'N', '邊長'], idArgs:[0, 1, 2], idNs:['proc', 'param', 'param'] },
    'my.call':          { cat:'my',      shape:'stack', label:'%s',            args:['畫正方形'], idArgs:[0], idNs:['proc'] },
    // 呼叫時那一格可以填數字，也可以塞一顆橢圓積木（變數或參數）
    'my.callp':         { cat:'my',      shape:'stack', label:'%s %n',         args:['畫正方形', 50], idArgs:[0], idNs:['proc'] },
    'my.callp2':        { cat:'my',      shape:'stack', label:'%s %n %n',      args:['畫圖形', 4, 30], idArgs:[0], idNs:['proc'] },

    /* ===== 橢圓形的回報值積木 =====
       這幾塊可以被拖進別的積木的空格裡，就像真的 Scratch 一樣。

       ★ 為什麼值得做，而不是繼續用「移動 (邊長) 點」這種一體成形的假積木：
         在 Scratch 裡「移動 (邊長) 點」是**兩塊**—— 標準的「移動 ( ) 點」
         加上函式專用的參數「邊長」拖進去。做成一塊的話，學生在這裡
         按一下就完成，回到 Scratch 卻找不到那塊積木，也不知道
         「參數是可以拖進任何空格的東西」。那正是這一課的核心概念。

       ★ 顏色也照 Scratch 分：
         函式的參數是**函式積木的紅**，一般變數是**變數的橘**。
         兩者長得像但來源完全不同 —— 參數只在自己的定義裡有意義，
         變數則是整個程式共用。顏色是學生分辨這件事的第一個線索。 */
    'arg.param':        { cat:'my',       shape:'reporter', label:'%s', args:['邊長'],    idArgs:[0], idNs:['param'] }, // argument_reporter
    'data.var':         { cat:'data',     shape:'reporter', label:'%s', args:['我的變數'], idArgs:[0], idNs:['var'] },   // data_variable
    'op.div':           { cat:'operator', shape:'reporter', label:'%n / %n', args:[360, 4] },            // OPERATORS_DIVIDE

    /* 清單與判斷：5～10 關的排序、搜尋要用
       ★自訂 —— 這幾塊在 Scratch 裡是好幾塊積木組起來的（要用橢圓形的
       回報值積木塞進另一塊裡）。引擎還不支援巢狀的回報值，先做成單塊，
       名稱盡量沿用官方用詞（「清單 %1 的長度」「%2 的第 %1 項」）。
       等引擎補上回報值積木，這幾塊就該拆回真正的 Scratch 組合。 */
    'list.swap':        { cat:'list',    shape:'stack', label:'交換 原始資料 的第 %n 項和第 %n 項', args:[1, 2] }, // ★自訂
    'list.say':         { cat:'list',    shape:'stack', label:'說出 原始資料 的第 %n 項', args:[1] },              // ★自訂
    'list.setidx':      { cat:'list',    shape:'stack', label:'變數 %s 設為 %n',   args:['位置', 1], idArgs:[0], idNs:['var'] }, // DATA_SETVARIABLETO
    'list.changeidx':   { cat:'list',    shape:'stack', label:'變數 %s 改變 %n',   args:['位置', 1], idArgs:[0], idNs:['var'] }, // DATA_CHANGEVARIABLEBY
    'control.ifless':   { cat:'control', shape:'c',     label:'如果 原始資料 的第 %n 項 < 原始資料 的第 %n 項 那麼', args:[1, 2] }, // ★自訂
    'control.repeatlen':{ cat:'control', shape:'c',     label:'重複 原始資料 的長度 次' },                     // ★自訂
    /* 二元搜尋（第 9 關）要的四塊。
       ★自訂 —— 在真的 Scratch 裡，「（開始＋結束）÷2 的整數部分」
       是「無條件捨去（( ) / ( )）」套「( ) + ( )」三塊橢圓積木疊起來的。
       引擎的巢狀回報值還只支援一層，硬拆出來學生會忙著卡積木，
       而這一關要學的是「每回合砍掉一半」——不是積木怎麼疊。
       ⚠️ 用詞照課本（開始位置／結束位置／二分位置），
          學生回課本第 208 頁要對得起來。 */
    'list.setlen':      { cat:'list',    shape:'stack', label:'變數 %s 設為 已排序資料 的長度', args:['結束位置'], idArgs:[0], idNs:['var'] }, // ★自訂
    'list.setmid':      { cat:'list',    shape:'stack', label:'變數 位置 設為（開始位置＋結束位置）÷ 2 的整數部分' },                     // ★自訂
    'list.tolo':        { cat:'list',    shape:'stack', label:'變數 開始位置 設為 位置 ＋ 1' },                                            // ★自訂
    'list.tohi':        { cat:'list',    shape:'stack', label:'變數 結束位置 設為 位置 － 1' },                                            // ★自訂
    /* ⚠️ 寫法和範例檔對齊：範例是「如果 詢問的答案 > 第二分位置項」。
       「中間值 < 答案」和「答案 > 中間值」是同一件事，但學生回 Scratch
       是照著範例拼的 —— 兩邊長得一樣，他就不必在腦中翻一次。 */
    'control.ifmid':    { cat:'control', shape:'c2',    label:'如果 詢問的答案 > 已排序資料 的第 位置 項 那麼' },                            // ★自訂
    /* 第 9 關的停止條件與收尾（2026-08-17 依老師的範例檔 11502_單元九 改寫）。
       ★ 結構照範例：迴圈只負責砍一半，找到／沒有在**迴圈外**報告。
       ⚠️⚠️ 但收斂**不照**範例：範例是「開始位置 ← 位置」（不加減 1），
          配合「開始位置 = 位置」當停止條件 ——
          我把它接上範例檔自己那 50 筆資料跑過：
            50 個數字裡有 2 個找不到（第 25 項的 50、第 50 項的 100）。
          範圍縮到剩兩格時，(開始+結束)÷2 取整數永遠等於開始位置，
          於是停止條件立刻成立，**最後一項永遠輪不到被比較**。
          ⇒ 改成 ±1、停止條件用「開始位置 > 結束位置」。
            同一份資料重跑：50 個全部找得到，最多比 6 次（50 筆的上界就是 6）。
       ★ 老師 2026-08-17 知情並選擇這個版本，範例檔也會跟著改。 */
    'control.untilhalf':{ cat:'control', shape:'c',     label:'重複直到 開始位置 > 結束位置 或 詢問的答案 = 已排序資料 的第 位置 項' },         // ★自訂
    'control.iffoundmid':{cat:'control', shape:'c2',    label:'如果 詢問的答案 = 已排序資料 的第 位置 項 那麼' },                                // ★自訂
    'looks.saycomparemid':{cat:'looks',  shape:'stack', label:'說出「目前比對的數字是（已排序資料 的第 位置 項）」持續 0.5 秒' },                // ★自訂
    'looks.sayfoundmid':{ cat:'looks',   shape:'stack', label:'說出「找到了，位於第（位置）個數字」' },                                    // ★自訂
    /* 第 10 關（搜尋法的程式應用，課本 6-3-3）要的四塊。
       ★ 這一關要補上第 8 關**故意留下**的那個洞：
         迴圈的停止條件其實有**兩個** —— 找到了，或位置已經超過資料量。
         只有一個的話，找不到時會一直往下讀空的項目。
         課本 p.215 的流程圖第一個判斷就是「位置大於原始資料數量？」。
       ⚠️ 詢問是真的 Scratch 積木（SENSING_ASKANDWAIT），用詞照官方。 */
    'sensing.ask':      { cat:'sensing', shape:'stack', label:'詢問 %s 並等待', args:['要搜尋的數字是？'] },                                   // SENSING_ASKANDWAIT
    'list.settarget':   { cat:'list',    shape:'stack', label:'變數 目標資料 設為 詢問的答案' },                                               // ★自訂
    /* ⚠️⚠️ 2026-08-17 依老師的範例檔（11502_單元八）改寫。
       原本寫「重複直到 找到目標 或 位置 > 長度」，而且把「說出找到了」
       放在迴圈**裡面** —— 那樣**找不到的時候什麼都不會說**。
       老師的做法（也是課本 p.215 的流程圖）是：
         迴圈只負責往下走，走完之後在**迴圈外**用「如果…否則」報告結果。
       ★ 條件的順序也照範例：先問「位置有沒有超過」，再問「是不是找到了」。
       ⚠️ 範例檔寫死「位置 > 50」，這裡用「數列的長度」——
          寫死的話資料筆數一改就壞，那不是要教給學生的習慣。 */
    'control.untilfound':{cat:'control', shape:'c',     label:'重複直到 位置 > 原始資料 的長度 或 詢問的答案 = 原始資料 的第 位置 項' },              // ★自訂
    'control.ifover':   { cat:'control', shape:'c2',    label:'如果 位置 > 原始資料 的長度 那麼' },                                                // ★自訂
    'looks.saycompare': { cat:'looks',   shape:'stack', label:'說出「目前比對的數字是（原始資料 的第 位置 項）」持續 0.5 秒' },                    // ★自訂
    'looks.saynone':    { cat:'looks',   shape:'stack', label:'說出「沒有符合的數字」' },                                                      // ★自訂
    'control.iffound':  { cat:'control', shape:'c2',    label:'如果 原始資料 的第 位置 項 = 目標資料 那麼' },                                      // ★自訂
    'looks.sayfound':   { cat:'looks',   shape:'stack', label:'說出「找到了，位於第（位置）個數字」' },                                        // ★自訂
    /* 第 6 關 選擇排序（課本 6-2-1、備課用書 p.198 的「找出最小值位置」副程式）。
       ★ 課本把「找最小值」單獨包成一個函式積木，理由寫在 p.198：
         那是每一回合都要做的同一件事 —— 正是副程式存在的意義。 */
    'control.ifsmaller':{ cat:'control', shape:'c',     label:'如果 原始資料 的第 資料位置 項 < 原始資料 的第 最小值位置 項 那麼' },                   // ★自訂
    'list.setmin':      { cat:'list',    shape:'stack', label:'變數 最小值位置 設為 資料位置' },                                               // ★自訂
    /* 第 7 關 插入排序（課本 6-2-2）。
       ★ 課本的規則：「遇到大於自己的元素就插入此元素之前；
         否則插入在已排序數列的最後一項」—— 所以停止條件有兩個，
         和第 10 關循序搜尋是同一個道理。 */
    'control.untilempty':{cat:'control', shape:'c',     label:'重複直到 原始資料 是空的' },                                                    // ★自訂
    'list.takenext':    { cat:'list',    shape:'stack', label:'取出 原始資料 的第 1 項當作 新牌（並從原始資料刪掉）' },                        // ★自訂
    /* ⚠️ 2026-08-17 依老師的範例檔（11502_單元七）改寫。
       原本用一塊「取出第 1 項當作新牌（並從原始資料刪掉）」把兩件事合成一塊，
       老師的做法是：**一路用「原始資料的第 1 項」比對，插入之後才刪掉它**。
       ⇒ 少了「新牌」這個中間變數，學生在真的 Scratch 裡也拼得出同一支程式。 */
    'control.untilspot':{ cat:'control', shape:'c',     label:'重複直到 已排序資料 的第 插入位置 項 > 原始資料 的第 1 項 或 插入位置 > 已排序資料 的長度' }, // ★自訂
    'list.insertfirst': { cat:'list',    shape:'stack', label:'把 原始資料 的第 1 項 插入 已排序資料 的第 插入位置 項' },                          // ★自訂
    'list.delfirst':    { cat:'list',    shape:'stack', label:'刪除 原始資料 的第 1 項' },                                                     // ★自訂
    'looks.saytake':    { cat:'looks',   shape:'stack', label:'說出「目前取出的數字是（原始資料 的第 1 項）」持續 2 秒' },                     // ★自訂
    'list.insertcard':  { cat:'list',    shape:'stack', label:'把 新牌 插入 已排序資料 的第 插入位置 項' },                                        // ★自訂
    'control.until':    { cat:'control', shape:'c',     label:'重複直到 找到目標' },                           // ★自訂

    /* ===================================================================
       遊戲類的積木（第 4 關「小鳥吃蟲」起）
       -------------------------------------------------------------------
       ★ 為什麼一次加這麼多
         前三關是畫圖題，用到的都是動作與畫筆。第 4 關開始是遊戲：
         角色會隱藏、換造型、產生分身，還要判斷「碰到而且被按下」。
         這幾塊在第 6～10 關的排序與搜尋也躲不掉（如果…那麼、重複無限次、且），
         所以這是七關共同的地基，不是第 4 關專用。

       ⚠️ 模擬器（按綠旗會動的那個）**不會執行**這些積木。
         它是畫線用的，沒有角色、造型、分身、滑鼠事件的概念。
         第 4 關的拼圖只比對「結構對不對」——
         真的跑起來看，是「實作測試」那一步在 Scratch 裡做的事。
         ⇒ exec() 的 switch 遇到不認得的 id 就什麼都不做，
           所以不必為它們補執行邏輯，也不會壞掉。
       =================================================================== */

    /* ── 外觀 ───────────────────────────────────── */
    'looks.show':       { cat:'looks',   shape:'stack', label:'顯示' },                        // LOOKS_SHOW
    'looks.hide':       { cat:'looks',   shape:'stack', label:'隱藏' },                        // LOOKS_HIDE
    'looks.costume':    { cat:'looks',   shape:'stack', label:'造型換成 %s', args:['造型1'] }, // LOOKS_SWITCHCOSTUMETO

    /* ── 動作 ───────────────────────────────────── */
    /* ⚠️ Scratch 是一塊「定位到（隨機位置▾）」附下拉選單。
       引擎沒有下拉選單，所以拆成兩塊 —— 名稱照官方用詞，
       學生回 Scratch 找得到同一塊（只是要自己在下拉選單裡選）。 */
    'motion.gotorandom':{ cat:'motion',  shape:'stack', label:'定位到 隨機 位置' },            // MOTION_GOTO（隨機位置）
    'motion.gotomouse': { cat:'motion',  shape:'stack', label:'定位到 鼠標 位置' },            // MOTION_GOTO（鼠標）

    /* ── 控制 ───────────────────────────────────── */
    'control.forever':  { cat:'control', shape:'c',     label:'重複無限次' },                  // CONTROL_FOREVER
    /* 如果…那麼：條件那一格要塞得下一顆六角形的判斷積木
       （碰到顏色？／滑鼠鍵被按下？／兩個用「且」串起來）。 */
    'control.if':       { cat:'control', shape:'c',     label:'如果 %s 那麼', args:[''] },     // CONTROL_IF
    /* 如果…否則（雙向選擇結構）—— 課本明列的學習目標之一。
       ★ shape:'c2' 是**兩個**容器：children 是「那麼」，children2 是「否則」。
         引擎原本只支援一個容器，2026-08-11 為了這一塊改了九個地方
         （建節點／存檔／正規化／比對／畫面／摘除／差在哪／兩處 walk）。
       ⚠️ 比對一定要連「否則」那一格一起比。漏掉的話，
          學生把兩個造型放反（按下→站立、否則→彎腰）照樣判對 ——
          而那正是雙向選擇要他分清楚的事。 */
    'control.ifelse':   { cat:'control', shape:'c2',    label:'如果 %s 那麼', args:[''] },     // CONTROL_IF_ELSE
    'control.clone':    { cat:'control', shape:'stack', label:'建立 自己 的分身' },            // CONTROL_CREATECLONE
    'control.whenclone':{ cat:'control', shape:'hat',   label:'當分身產生' },                  // CONTROL_STARTASCLONE
    'control.delclone': { cat:'control', shape:'stack', label:'分身刪除' },                    // CONTROL_DELETETHISCLONE

    /* ── 偵測 ───────────────────────────────────── */
    /* ⚠️ Scratch 的判斷積木是**六角形**，而且不能打字進去。
       引擎目前只有橢圓形的回報值，所以先用 reporter ——
       形狀不一樣，但「可以拖進另一塊的空格裡」這個行為是對的。 */
    'sensing.touchcolor':{ cat:'sensing', shape:'reporter', label:'碰到顏色 %s ?', args:['紅'] }, // SENSING_TOUCHINGCOLOR
    'sensing.mousedown': { cat:'sensing', shape:'reporter', label:'滑鼠鍵被按下?' },              // SENSING_MOUSEDOWN
    /* ★ 下面兩塊是「看起來也行，其實不對」的誘餌 ——
       課本備課用書把它們明列在「不須使用的積木」裡（p.157、p.158），
       因為學生真的會拿錯：
         碰到 蟲?      → 整隻鳥碰到就算吃到，翅膀擦過也算（要的是**嘴巴的顏色**）
         空白 鍵被按下? → 這一關是用滑鼠玩的
       ⚠️ 調色盤上沒有誘餌的話，「選對積木」就不是一個選擇，
          學生只是把唯一剩下的那塊拖進去。 */
    'sensing.touching':  { cat:'sensing', shape:'reporter', label:'碰到 %s ?', args:['蟲'] },     // SENSING_TOUCHINGOBJECT
    'sensing.keydown':   { cat:'sensing', shape:'reporter', label:'%s 鍵被按下?', args:['空白'] },// SENSING_KEYPRESSED

    /* ── 運算 ───────────────────────────────────── */
    /* 「且」要能把兩顆判斷積木串起來 —— 這正是第 4 關（和邏輯實驗室）
       要學生看懂的東西：碰到蟲**而且**按下滑鼠，兩件事同時成立才算吃到。 */
    'op.and':           { cat:'operator', shape:'reporter', label:'%s 且 %s', args:['', ''] },  // OPERATORS_AND
    /* ★ 「或」也是課本點名的誘餌。兩塊長得幾乎一樣，差一個字，
       但拿錯的話：滑鼠一按就吃掉全場的蟲（沒碰到也算）。
       這一關要學生分的就是這個。 */
    'op.or':            { cat:'operator', shape:'reporter', label:'%s 或 %s', args:['', ''] }   // OPERATORS_OR
  };

  /* ===== 小工具 ===== */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }

  /**
   * 空格的寬度照內容長度算。
   *
   * ★ 為什麼不用固定寬度
   *   原本一律 42px。「-140」「0.2」「200」都塞不下 ——
   *   數字被切掉一半，而學生看到的是「我打的東西不見了」，
   *   他會以為自己打錯，然後刪掉重打一次。
   *   組合區右邊本來就空著一大片，沒有理由省那幾十像素。
   *
   * ★ 為什麼不乾脆全部放大
   *   積木要看得出長短。「移動 10 點」和「定位到 x:-140 y:-20」
   *   一樣寬的話，整段程式會變成一排一模一樣的長條，
   *   而 Scratch 的積木本來就是靠形狀和長度在幫人記路。
   *   ⇒ 短的維持小巧，長的才長出來。
   *
   * ⚠️ 上限要留：貼進一長串文字時，積木不可以被撐到跑出畫面。
   */
  function fitIn(input, inRep) {
    if (!input) return;
    var big = /(^| )s( |$)/.test(input.className);
    var n = String(input.value == null ? '' : input.value).length;
    /* 橢圓（回報值）裡的空格用小一號 —— 它本來就該比一般積木秀氣。 */
    var min = inRep ? (big ? 64 : 38) : (big ? 82 : 42);
    var max = inRep ? (big ? 150 : 84) : (big ? 190 : 96);
    /* 12px 的字大約 8px 寬（數字比中文窄），再加左右內距。 */
    input.style.width = Math.max(min, Math.min(max, n * 8 + 24)) + 'px';
  }

  /* 哪些積木是「定義」。散在五、六個地方各寫一次 id 比對，
     以後新增一種定義積木就一定會漏掉其中一處（而且不會報錯，
     只會變成「那塊積木放進函式區卻不被當成定義」）。集中在這裡。 */
  /* 定義／呼叫積木，以及它們各有幾個參數。
     數字＝參數個數，也就是「args 從第 1 格起有幾格是參數」。 */
  var DEFINE_IDS = { 'my.define': 0, 'my.definep': 1, 'my.definep2': 2 };
  var CALL_IDS   = { 'my.call': 0, 'my.callp': 1, 'my.callp2': 2 };
  function isDefine(id) { return Object.prototype.hasOwnProperty.call(DEFINE_IDS, id); }
  function isCall(id) { return Object.prototype.hasOwnProperty.call(CALL_IDS, id); }

  /* Scratch 的綠旗與紅色停止鈕。
     用 SVG 而不是 emoji：unicode 裡根本沒有「綠旗」這個字元
     （白旗、黑旗、格子旗都不是），而且 emoji 在不同系統長得不一樣。
     積木上的圖示應該到哪一台電腦都是同一面旗子。 */
  var FLAG_SVG =
    '<svg viewBox="0 0 32 32" width="15" height="15" aria-hidden="true" style="vertical-align:-2px">' +
    '<rect x="4" y="3" width="3" height="26" rx="1.5" fill="#4cbf56"/>' +
    '<path fill="#4cbf56" d="M8 4c6-3 12 3 19 0v12c-7 3-13-3-19 0z"/></svg>';
  var STOP_SVG =
    '<svg viewBox="0 0 32 32" width="15" height="15" aria-hidden="true" style="vertical-align:-2px">' +
    '<path fill="#ec5959" d="M10.5 3h11L29 10.5v11L21.5 29h-11L3 21.5v-11z"/></svg>';

  function svgSpan(svg) {
    var n = document.createElement('span');
    n.innerHTML = svg;
    n.style.cssText = 'display:inline-flex;align-items:center;margin:0 2px';
    return n;
  }

  /** 一次注入樣式（多個模擬器共用同一份） */
  function ensureStyle() {
    if (document.getElementById('blocks-style')) return;
    var s = el('style');
    s.id = 'blocks-style';
    s.textContent = [
      /* ★ 積木形狀：用 clip-path 切出上凹下凸的榫頭。
         這是「像不像 Scratch」最關鍵的一件事 —— 圓角方塊排在一起
         看起來只是清單，有榫頭才看得出「它們是接在一起的」。
         盒子底部多留 4px 給凸榫，所以堆疊時不留任何縫隙。 */
      ':root{--bk-notch:4px}',
      '.bk{position:relative;display:block;color:#fff;font-weight:500;',
      '    font-size:13px;line-height:1.25;padding:8px 12px 12px;margin:0;cursor:grab;',
      '    background:var(--c);user-select:none;touch-action:none;white-space:nowrap;',
      '    clip-path:polygon(0 0, 12px 0, 16px 4px, 26px 4px, 30px 0, 100% 0,',
      '                      100% calc(100% - 4px), 30px calc(100% - 4px), 26px 100%,',
      '                      16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',
      /* 帽子積木：上緣是圓弧，沒有凹槽 */
      '.bk.hat{padding-top:20px;',
      '    clip-path:polygon(0 14px, 6px 6px, 16px 1px, 30px 0, 44px 1px, 54px 6px, 60px 14px, 100% 14px,',
      '                      100% calc(100% - 4px), 30px calc(100% - 4px), 26px 100%,',
      '                      16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',
      '.bk-row{display:flex;align-items:center;flex-wrap:wrap;gap:2px}',
      '.bk-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;',
      '          filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))}',
      /* 參數欄位：Scratch 是白色圓角膠囊 */
      /* ★ 空格的寬度是**照內容算**的（見 fitIn()），這裡只給預設值。
         ⚠️ 原本固定 42px：「-140」「0.2」「200」都塞不下，
            數字被切掉一半，學生會以為自己打錯。
            而組合區右邊本來就空著一大片 —— 沒有理由省那幾十像素。 */
      '.bk-in{width:42px;border:0;border-radius:12px;padding:3px 8px;margin:0 3px;',
      '       font:inherit;font-size:12px;font-weight:500;color:#1f2937;text-align:center;',
      '       background:#fff;outline:0}',
      '.bk-in.s{width:82px}',
      /* 數字框的上下小箭頭吃掉一半空間，而且點下去很容易誤改數值 —— 拿掉。
         學生要改數字用打的就好。 */
      '.bk-in[type=number]{-moz-appearance:textfield;appearance:textfield}',
      '.bk-in[type=number]::-webkit-outer-spin-button,',
      '.bk-in[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      /* ★ 橢圓形的回報值積木（Scratch 的圓角膠囊） */
      '.bk-rep{display:inline-flex;align-items:center;gap:3px;background:var(--c);',
      '        color:#fff;border-radius:999px;padding:2px 4px;margin:0 3px;font-size:12px;',
      '        font-weight:700;line-height:1.6;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);',
      '        cursor:grab;white-space:nowrap}',
      '.bk-rep .bk-in{width:38px;margin:0 1px;font-size:11px;padding:1px 6px}',
      '.bk-rep .bk-in.s{width:64px}',
      '.bk-rep>span{padding:0 4px}',
      /* 空格（可以填數字，也可以塞一顆橢圓積木進來） */
      '.bk-hole{display:inline-flex;align-items:center;border-radius:999px}',
      'body.bk-dragging.bk-rep-drag .bk-script .bk-hole{box-shadow:0 0 0 2px rgba(255,255,255,.7)}',
      'body.bk-dragging.bk-rep-drag .bk-script .bk-hole.on{box-shadow:0 0 0 3px #ffd400}',
      '.bk-in:focus{box-shadow:0 0 0 2px rgba(0,0,0,.25)}',

      /* ★ C 型積木：左側直條 ＋ 上下臂，中間的嘴巴露出程式區底色 */
      '.bk-c{padding-bottom:0;clip-path:none;border-radius:4px 4px 0 0}',
      '.bk-c>.bk-row{padding-bottom:4px}',
      '.bk-slot{min-height:24px;margin:0 0 0 15px;padding:0;',
      '         background:var(--bk-canvas);border-radius:4px 0 0 4px}',
      /* 「否則」那一條：夾在兩個容器中間，用同一個積木色 ——
         要看得出是同一塊積木的一部分，不是兩塊疊在一起。 */
      '.bk-else{background:var(--c);color:#fff;font-size:13px;font-weight:500;',
      '        padding:4px 12px;line-height:1.4}',
      '.bk-foot{height:14px;background:var(--c);',
      '         clip-path:polygon(0 0, 100% 0, 100% calc(100% - 4px), 30px calc(100% - 4px),',
      '                           26px 100%, 16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',

      /* ★ 積木之間不留縫 —— 有榫頭又有縫會很怪 */
      '.bk-stack>.bk{margin:0}',
      '.bk-drop{height:0;margin:0;border-radius:3px;background:transparent;transition:height .1s}',
      'body.bk-dragging .bk-drop{height:8px;background:rgba(100,116,139,.25)}',
      'body.bk-dragging .bk-drop.on{height:20px;background:#ffd400}',

      /* ★ 調色盤：分類清單，積木直向排列（和真的 Scratch 一樣） */
      '.bk-cat{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;',
      '        color:#575e75;margin:10px 0 6px}',
      '.bk-cat:first-child{margin-top:0}',
      '.bk-dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}',
      '.bk-pal{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
      '.bk-palbox{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:8px;',
      '           padding:10px;max-height:420px;overflow:auto}',

      /* ★ 程式區：Scratch 的淺灰格點底 */
      /* 角色標題（一關有兩個角色時才出現）。
         ⚠️ 要夠明顯 —— 它是在說「以下是另一份程式」，不是一個小標。 */
      /* 虛擬碼：縮排要看得出層次，所以用等寬字。
         ⚠️ 顏色不要太搶 —— 它是參考，主角是右邊的積木。 */
      '.bk-pseudo{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;',
      '  padding:8px 12px;margin-bottom:9px}',
      '.bk-pseudo summary{font-size:12.5px;font-weight:900;color:#475569;cursor:pointer;',
      '  list-style:none}',
      '.bk-pseudo summary::-webkit-details-marker{display:none}',
      '.bk-pseudo summary::before{content:"▾ ";color:#94a3b8}',
      '.bk-pseudo:not([open]) summary::before{content:"▸ "}',
      '.bk-pseudo pre{margin:7px 0 2px;font-family:ui-monospace,"Cascadia Code",',
      '  "Noto Sans TC",monospace;font-size:12.5px;line-height:1.85;color:#334155;',
      '  white-space:pre-wrap;overflow-wrap:anywhere}',
      '.bk-pseudo pre b{color:#4338ca}',
      '.bk-pseudo pre i{color:#94a3b8;font-style:normal}',
      '.bk-psnote{font-size:11.5px;color:#94a3b8;line-height:1.7;margin-top:5px}',
      '.bk-sphead{display:inline-flex;align-items:center;gap:6px;font-size:14px;',
      '  font-weight:900;color:#fff;background:#4c97ff;border-radius:9px;',
      '  padding:5px 13px;margin-bottom:8px}',
      '.bk-script{min-height:300px;padding:14px;border-radius:8px;background:#f9f9f9;',
      '           background-image:radial-gradient(#d9d9d9 1px, transparent 1px);',
      '           background-size:22px 22px;border:1px solid #e5e7eb}',
      'body.bk-dragging .bk-script{border-color:#4c97ff}',
      '.bk-defarea{min-height:120px}',
      '.bk-empty{color:#9aa0b4;font-size:13px;text-align:center;padding:34px 8px;pointer-events:none}',
      '.bk-parahint{color:#8d8fa6;font-size:11px;line-height:1.7;padding:2px 4px}',
      '.bk-goal{margin-top:10px;font-size:13px;line-height:1.75;color:#475569;' +
        'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px}',
      '.bk-goal-h{font-weight:700;color:#334155}',
      '.bk-goal-s{margin:7px 0 0;padding-left:18px}',
      '.bk-goal-s li{margin:3px 0}',
      '.bk-goal b{color:#4f46e5}',

      /* ★ 舞台：白底 ＋ 綠旗／停止列 */
      '.bk-stagebar{display:flex;align-items:center;gap:8px;background:#e6e9ef;',
      '             border:1px solid #d7dbe3;border-bottom:0;border-radius:8px 8px 0 0;padding:5px 9px}',
      '.bk-flag{background:none;border:0;font-size:15px;cursor:pointer;line-height:1;padding:2px}',
      '.bk-stage{background:#fff;border:1px solid #d7dbe3;border-radius:0 0 8px 8px;',
      '          position:relative;overflow:hidden}',
      '.bk-sprite{position:absolute;font-size:34px;line-height:1;',
      '           transition:left .25s,top .25s,transform .25s}',
      '.bk-bubble{position:absolute;background:#fff;border:1px solid #c8cbd6;border-radius:12px;',
      '           padding:5px 10px;font-size:12px;color:#1f2937;max-width:150px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ===== 程式樹 =====
     node = { uid, id, args:[…], children:[node…] }（children 只有 C 型積木有） */
  function makeNode(id) {
    var d = DEFS[id];
    /* ★ c2 ＝ 兩個容器的 C 型（如果…否則）。
       children 是「那麼」那一格，children2 是「否則」那一格。
       ⚠️ 兩格都要建成陣列 —— 其中一格是 null 的話，
          學生把積木拖進去時會炸在 push()，而畫面上只看到積木彈回去。 */
    return { uid: uid(), id: id, args: (d.args || []).slice(),
             children:  (d.shape === 'c' || d.shape === 'c2') ? [] : null,
             children2: (d.shape === 'c2') ? [] : null };
  }

  /** 樹 → 可比對的純資料（丟掉 uid）。這是「原樣」，名稱不動 —— 存進資料庫用這個 */
  function plain(list) {
    function arg(v) {
      // 空格裡可能塞著一顆橢圓積木，不是單純的字串
      return (v && typeof v === 'object') ? { id: v.id, args: v.args.map(arg) } : String(v).trim();
    }
    return (list || []).map(function (n) {
      var o = { id: n.id, args: n.args.map(arg) };
      if (n.children) o.children = plain(n.children);
      if (n.children2) o.children2 = plain(n.children2);
      return o;
    });
  }

  /* ===== 判定用的正規化 =====
     ★ 自訂積木的名字、廣播訊息的名字，由學生自己取，不該影響對錯。

     學生把積木取名「正方形」而不是「畫正方形」，程式一模一樣，
     卻被判錯 —— 那是在考背名字，不是考程式。名字取得好不好可以講評，
     但不該是通不通關的條件。

     真正該檢查的是**對應關係**：定義的那個名字，和呼叫的那個名字，
     是不是同一個。所以這裡把每個名字換成出現順序的代號
     （第一個出現的叫「名稱#1」，第二個叫「名稱#2」…），再比對。
     · 定義 A、呼叫 A → #1、#1 ✔（不管 A 是什麼字）
     · 定義 A、呼叫 B → #1、#2 ✘（正確地判錯：呼叫了沒定義的積木）
     這在程式語言理論裡叫 alpha 等價，就是「換個變數名不算改程式」。

     哪些欄位算「名字」由 DEFS 的 idArgs 指定；沒標的欄位（數字、秒數）
     還是要一字不差。廣播積木之後加進來時，記得也標 idArgs。 */
  function canon(list) {
    /* 每一種名字各有自己的一份代號。
       ★ 為什麼不能全部共用一份：
         函式的參數和一般變數在 Scratch 是兩套不同的東西（顏色都不一樣）。
         若共用一份代號，學生把參數取名 n、變數取名 size，
         會拿到 #1 和 #2；而參考答案兩個剛好同名，兩個都是 #1 ——
         程式明明一模一樣卻被判錯。反過來也一樣糟。
         分成 proc（積木名）／param（參數）／var（變數）三套就沒有這個問題。 */
    var maps = {}, seqs = {};
    function nameKey(s, ns) {
      ns = ns || 'name';
      s = String(s).trim();
      // 沒取名字不是「另一種取法」，是還沒做完 —— 給一個永遠對不上的值
      if (s === '') return '(沒有取名字)';
      if (!maps[ns]) { maps[ns] = {}; seqs[ns] = 0; }
      if (!Object.prototype.hasOwnProperty.call(maps[ns], s)) maps[ns][s] = ns + '#' + (++seqs[ns]);
      return maps[ns][s];
    }
    function one(n) {
      var d = DEFS[n.id] || {};
      var args = (n.args != null ? n.args : (d.args || [])).map(function (v) {
        // 空格裡塞著橢圓積木時，整顆一起正規化（裡面的名字也要換代號）
        return (v && typeof v === 'object') ? one(v) : String(v).trim();
      });
      (d.idArgs || []).forEach(function (i, k) {
        if (typeof args[i] !== 'object') args[i] = nameKey(args[i], (d.idNs || [])[k]);
      });
      var o = { id: n.id, args: args };
      if (d.shape === 'c' || d.shape === 'c2') o.children = walk(n.children);
      if (d.shape === 'c2') o.children2 = walk(n.children2);
      return o;
    }
    function walk(l) { return (l || []).map(one); }
    return walk(list);
  }

  /** 兩棵樹是否一致（順序、參數、巢狀都要對；名字只看對應關係） */
  /**
   * 兩份程式是不是同一份。
   *
   * ★ loose：這些積木只看「有沒有」，不看裡面的數字。
   *   來由是課本（翰林 114 資科 2 下 4-2，課本 p.136）的教學叮嚀：
   *     「參考答案的『定位到 x:-140 y:-20』坐標數值不一定要一樣，
   *       加上此積木的目的是定出畫圖的起始位置，避免圖形超出畫面。」
   *   目的是「不要畫出畫面外」，不是那兩個特定數字。
   *   照數字比的話，學生從 x:-150 開始畫，圖一模一樣卻被判錯 ——
   *   而他其實完全懂了。
   *
   * ⚠️ 只有「位置不影響圖形長相」的關卡才寬鬆。
   *    第 3 關三列圖形的座標是互相咬合的（換列要回到起點那一欄），
   *    起點放寬會讓三列對不齊，所以那一關仍然照數字比。
   */
  function same(a, b, loose) {
    return eqList(canon(a), canon(b), loose || []);
  }
  function eqList(g, w, loose) {
    if (g.length !== w.length) return false;
    for (var i = 0; i < g.length; i++) if (!eqOne(g[i], w[i], loose)) return false;
    return true;
  }
  function eqOne(g, w, loose) {
    if (!g || !w || g.id !== w.id) return false;
    if (loose.indexOf(w.id) < 0) {
      var ga = g.args || [], wa = w.args || [];
      if (ga.length !== wa.length) return false;
      for (var i = 0; i < wa.length; i++) {
        var x = ga[i], y = wa[i];
        if (y && typeof y === 'object') { if (!eqOne(x, y, loose)) return false; }
        else if (x && typeof x === 'object') return false;
        else if (String(x) !== String(y)) return false;
      }
    }
    if (g.children || w.children) {
      if (!eqList(g.children || [], w.children || [], loose)) return false;
    }
    /* ⚠️ 「否則」那一格也要比。
       漏掉的話，學生把兩個造型放反（按下→站立、否則→彎腰）
       照樣判對 —— 而那正是雙向選擇要學生分清楚的事。 */
    if (g.children2 || w.children2) {
      if (!eqList(g.children2 || [], w.children2 || [], loose)) return false;
    }
    return true;
  }
  /** 這份程式和目標對上了幾塊（只看最外層，用來挑「差在哪」要拿誰來比） */
  function score(g, w, loose) {
    var n = 0;
    for (var i = 0; i < Math.min(g.length, w.length); i++) {
      if (eqOne(g[i], w[i], loose)) n++;
    }
    return n;
  }

  /* ===================================================================
     虛擬碼：把 goal 直接印成有縮排的文字
     -------------------------------------------------------------------
     ★ 2026-08-17 老師：「整個說明太長了，能夠簡介完功能後，
       使用 pseudo code 的文字描述來引導嗎？」
       原本每一關右邊都是幾條散文式的結構說明，讀完還是要自己在腦中排成程式。

     ★ 為什麼用**算的**、不用手寫
       手寫一份就等於同一件事寫兩遍：改了 goal 忘了改虛擬碼，
       學生照著虛擬碼拼卻被判錯 —— 而那是**不會報錯**的。
       ⇒ 直接從 goal 印出來，永遠對得上。
       關卡想寫旁註（← 先補一隻）時可以自己給 pseudo，覆寫這裡的結果。

     ⚠️ 名字（副程式名、參數名）印的是參考答案的取法。
        學生可以自己取名（判定用的是代號，不是字面），所以要在畫面上講一句。
     =================================================================== */
  var PAD = '    ';
  /**
   * 一塊積木印成一行字。
   * @param hide 要**挖空**的數字（關卡的 mustDerive）
   * ★ 為什麼要挖空
   *   前三關刻意不說「正方形有幾條邊、每次轉幾度、要重複幾次」——
   *   那正是那幾關要學生自己想出來的東西（見 mustDerive 的說明）。
   *   虛擬碼要是把它們一起印出來，等於一邊說「你自己想」、一邊把答案寫在旁邊。
   *   ⚠️ 規格（大小、間隔、位置、秒數）照印 —— 那是題目，不是他要學的東西。
   */
  function labelOf(node, hide) {
    var d = DEFS[node.id] || {};
    var args = (node.args != null ? node.args : (d.args || []));
    var i = 0;
    return String(d.label || node.id).replace(/%[a-z]+/g, function (tok) {
      if (tok === '%flag') return '綠旗';
      var v = args[i++];
      if (v && typeof v === 'object') return '(' + labelOf(v, hide) + ')';
      v = String(v == null ? '' : v);
      if (hide && hide.length && v !== '' && hide.indexOf(Number(v)) >= 0) return '？';
      return v === '' ? '（　）' : v;
    });
  }
  /** goal → 一行一行的虛擬碼（頂層每一塊之間空一行）
      ⚠️ 拼圖的資料結構裡，「當綠旗被點擊」和它下面那幾塊是**平行的頂層項目**，
         但在 Scratch 裡它們是接在帽子積木下面的一串。
         照著資料結構印的話，虛擬碼會變成一堆對齊的敘述，看不出誰帶著誰 ——
         所以帽子積木之後的頂層積木要縮一格。 */
  function pseudoFrom(list, depth, under, hide) {
    depth = depth || 0;
    var out = [];
    (list || []).forEach(function (n, i) {
      var d = DEFS[n.id] || {};
      var head = (d.shape === 'hat' || isDefine(n.id));
      if (depth === 0 && head) {
        if (i > 0) out.push('');          // 各自獨立的程式之間空一行
        under = true;
      }
      var dep = depth + (depth === 0 && !head && under ? 1 : 0);
      out.push(new Array(dep + 1).join(PAD) + esc(labelOf(n, hide)));
      if (n.children && n.children.length) out = out.concat(pseudoFrom(n.children, dep + 1, false, hide));
      if (d.shape === 'c2') {
        out.push(new Array(dep + 1).join(PAD) + '否則');
        out = out.concat(pseudoFrom(n.children2 || [], dep + 1, false, hide));
      }
    });
    return out;
  }
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ===== 主體 ===== */
  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var program = [];
    var goal = opts.goal || [];
    var passed = false;

    host.innerHTML = '';
    var wrap = el('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(150px,185px) minmax(0,1fr) 230px;gap:14px;align-items:start';

    /* ── 左：積木調色盤 ──
       依分類分組、直向排列，和真的 Scratch 一樣。
       原本是一團 flex-wrap 的色塊，看起來像標籤雲不像積木箱。 */
    var palBox = el('div');
    palBox.appendChild(tag('積木'));
    var palWrap = el('div', 'bk-palbox');
    palBox.appendChild(palWrap);

    /* 目前「定義」積木上宣告了哪些參數名（依出現順序、去重、不含空白）。
       兩個定義各自宣告的參數都算 —— 調色盤是一個，不分定義。 */
    function declaredParams() {
      var out = [];
      function walk(list) {
        (list || []).forEach(function (n) {
          if (isDefine(n.id)) {
            for (var i = 1; i <= DEFINE_IDS[n.id]; i++) {
              var nm = String(n.args[i] == null ? '' : n.args[i]).trim();
              if (nm && out.indexOf(nm) < 0) out.push(nm);
            }
          }
          walk(n.children);
          walk(n.children2);
        });
      }
      SP.forEach(function (sp) { walk(sp.defs); walk(sp.program); });
      return out;
    }

    /* 畫調色盤。
       ★ 參數橢圓不是固定的一顆，而是「你在定義上打了什麼名字，
         這裡就出現什麼」—— 和真的 Scratch 一樣。
         原本只給一顆通用的橢圓、要學生自己把名字打對，
         等於多考一件與概念無關的事（而且打錯字不會有任何提示）。
       每次程式結構有變動都會重畫，所以改一個字就會立刻反映。 */
    function drawPalette() {
      palWrap.innerHTML = '';
      var groups = {};
      (opts.palette || []).forEach(function (id) {
        if (!DEFS[id]) return;
        (groups[DEFS[id].cat] = groups[DEFS[id].cat] || []).push(id);
      });
      Object.keys(CATS).forEach(function (cat) {
        if (!groups[cat]) return;
        var head = el('div', 'bk-cat');
        var dot = el('span', 'bk-dot');
        dot.style.background = CATS[cat].color;
        head.appendChild(dot);
        head.appendChild(el('span', '', CATS[cat].name));
        palWrap.appendChild(head);
        var list = el('div', 'bk-pal');
        groups[cat].forEach(function (id) {
          if (id === 'arg.param') {
            var names = declaredParams();
            if (!names.length) {
              // 還沒定義任何參數 —— 說清楚，而不是給一顆空橢圓讓人亂猜
              var hint = el('div', 'bk-parahint',
                '先在「定義」積木上打好參數名稱，這裡就會出現對應的橢圓積木。');
              list.appendChild(hint);
              return;
            }
            names.forEach(function (nm) {
              var node = makeNode('arg.param');
              node.args[0] = nm;
              list.appendChild(renderBlock(node, true));
            });
            return;
          }
          list.appendChild(renderBlock(makeNode(id), true));
        });
        palWrap.appendChild(list);
      });
    }

    /* ── 中：程式區 ──
       ★ 有自訂積木的關卡會多切一個「函式區」。
         這不只是為了空間 —— 真實 Scratch 裡「定義」本來就是一段**獨立的腳本**，
         不會跟主程式接在一起。把它們疊成一長條反而不像。
         沒有自訂積木的關卡就不顯示，免得空著讓人困惑。 */
    var hasDefine = (opts.palette || []).some(function (id) {
      return isDefine(id);
    });

    /* ── 角色 ─────────────────────────────────────────
       ★ 第 4 關起，一關可能有**兩個角色**（蟲、小鳥）。
         在真的 Scratch 裡那是兩份各自獨立的程式：先點角色，再拼它的積木。
         全部堆在同一個程式區的話，畫面上會出現兩個「當綠旗被點擊」，
         看起來像同一個角色有兩個開頭 —— 那是錯的心智模型。
         而且判定是逐項比對的，等於還要求學生把兩個角色照指定的順序排，
         可是在 Scratch 裡這兩份程式根本沒有先後可言。
       ⇒ opts.sprites 有值就分區，每個角色**各自判定**。
       ★ 沒有 sprites 的關卡當成「一個沒有名字的角色」，走的是**同一套**程式碼 ——
         留兩條路徑的話，總有一條長期沒人走，而沒人走的那條遲早壞掉。
       ⚠️ 函式區要不要出現，是**課程作者**在 sprite 上指定的（hasDefine）。
          不去看那個角色的 goal 裡有沒有定義積木 —— 那等於把答案畫在畫面上。 */
    var SPRITES = (opts.sprites && opts.sprites.length) ? opts.sprites
                : [{ name: '', goal: goal, hasDefine: hasDefine,
                     alts: opts.alts, pseudo: opts.pseudo }];
    var multi = SPRITES.length > 1;

    var midBox = el('div');
    var SP = SPRITES.map(function (sd, si) {
      var sp = { name: sd.name || '', icon: sd.icon || '',
                 goal: sd.goal || [], alts: sd.alts || [],
                 defs: [], program: [], defArea: null, script: null };
      if (multi) {
        var head = el('div', 'bk-sphead',
                      (sp.icon ? sp.icon + ' ' : '') + sp.name + '　角色');
        if (si) head.style.marginTop = '18px';
        midBox.appendChild(head);
      }
      /* 沒寫 pseudo 就從 goal 印一份 —— 每一關都該有，而且永遠對得上 */
      var ps = sd.pseudo || pseudoFrom(sd.goal || [], 0, false, opts.hide || []);
      if (ps && ps.length) midBox.appendChild(pseudoBox(ps));
      var wantDef = (sd.hasDefine == null) ? (hasDefine && !multi) : !!sd.hasDefine;
      if (wantDef) {
        midBox.appendChild(tag('函式區（定義副程式）'));
        sp.defArea = el('div', 'bk-script bk-defarea');
        sp.defArea._isDef = true;
        sp.defArea._sp = sp;
        midBox.appendChild(sp.defArea);
        var gap = el('div');
        gap.style.height = '14px';
        midBox.appendChild(gap);
      }
      midBox.appendChild(tag(sp.defArea ? '主程式' : '程式區'));
      sp.script = el('div', 'bk-script');
      sp.script._sp = sp;
      midBox.appendChild(sp.script);
      return sp;
    });

    var bar = el('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap';
    var runBtn = el('button');
    runBtn.innerHTML = FLAG_SVG + '<span style="margin-left:6px">執行</span>';
    runBtn.style.cssText = btnCss('#16a34a') + ';display:inline-flex;align-items:center';
    var checkBtn = el('button', '', '✓ 檢查答案');
    checkBtn.style.cssText = btnCss('#4f46e5');
    var clearBtn = el('button', '', '🗑 全部清除');
    clearBtn.style.cssText = btnCss('#64748b');
    bar.appendChild(runBtn); bar.appendChild(checkBtn); bar.appendChild(clearBtn);
    midBox.appendChild(bar);

    var msg = el('div');
    msg.style.cssText = 'margin-top:10px;font-size:14px;font-weight:700;line-height:1.7';
    midBox.appendChild(msg);

    /* ── 右：舞台 ── */
    var rightBox = el('div');
    rightBox.appendChild(tag('舞台'));
    var sbar = el('div', 'bk-stagebar');
    var flagBtn = el('button', 'bk-flag');
    flagBtn.innerHTML = FLAG_SVG;
    flagBtn.title = '執行';
    flagBtn.setAttribute('aria-label', '執行');
    var stopBtn = el('button', 'bk-flag');
    stopBtn.innerHTML = STOP_SVG;
    stopBtn.title = '停止';
    stopBtn.setAttribute('aria-label', '停止');
    sbar.appendChild(flagBtn); sbar.appendChild(stopBtn);
    rightBox.appendChild(sbar);
    var stage = el('div', 'bk-stage');
    stage.style.cssText += ';width:100%;aspect-ratio:4/3';
    /* 畫筆軌跡畫在 canvas 上。1～3 關要畫正方形、正多邊形，
       沒有這層的話按「執行」只看得到小貓亂跑，看不出畫了什麼。 */
    var pen = el('canvas');
    pen.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    stage.appendChild(pen);
    var sprite = el('div', 'bk-sprite', '🐱');
    var bubble = el('div', 'bk-bubble');
    bubble.style.display = 'none';
    stage.appendChild(sprite); stage.appendChild(bubble);
    rightBox.appendChild(stage);
    /* ── 這一關要做出什麼 ─────────────────────────────
       ⚠️ 2026-08-11：這裡本來用 el()（textContent），
          而 opts.hint 傳進來的是 lv.task —— 裡面有 <b>副程式</b>。
          結果畫面上直接印出「<b>副程式</b>」這一串標籤。
          ★ 這裡的內容是**課程作者寫的**，不是學生輸入的，
            所以可以用 innerHTML。學生的自由輸入一律走 el()／textContent，
            這條界線不要因為方便就模糊掉。

       ★ 為什麼要有第二段（steps）
          原本只有一句 task，學生看完還是不知道「要拼成什麼樣子」。
          第二段講**結構**（先定義、再主程式、各要放什麼），
          但不講積木的順序與參數 —— 那是這一關要他自己排出來的。 */
    if (opts.hint || opts.steps) {
      var h = el('div', 'bk-goal');
      h.innerHTML =
        (opts.hint ? '<div class="bk-goal-h">🎯 ' + opts.hint + '</div>' : '') +
        (opts.steps ? '<ul class="bk-goal-s">' +
          opts.steps.map(function (t) { return '<li>' + t + '</li>'; }).join('') +
          '</ul>' : '');
      rightBox.appendChild(h);
    }

    wrap.appendChild(palBox); wrap.appendChild(midBox); wrap.appendChild(rightBox);
    host.appendChild(wrap);

    function tag(t) {
      var n = el('div', '', t);
      n.style.cssText = 'font-size:12px;font-weight:900;color:#64748b;margin-bottom:7px';
      return n;
    }
    /* ── 虛擬碼 ───────────────────────────────────────
       ★ 2026-08-17 老師：「整個說明太長了，能夠簡介完功能後，
         使用 pseudo code 的文字描述來引導嗎？」
         原本第 4 關右邊塞了 1 句任務＋10 條散文式說明（466 字），
         讀完還是要自己在腦中把它排成程式。
       ⇒ 改成把**程式的形狀**直接畫出來：縮排看得出誰包著誰，
         一眼就知道有幾塊、每一塊裡面有什麼。
       ★ 放在**那個角色自己的程式區正上方** —— 對照的時候眼睛不必跑來跑去。
       ⚠️ 內容是課程作者寫的（要用 <b> 標重點），所以用 innerHTML。
          學生的自由輸入一律走 textContent，這條界線不要因為方便就模糊掉。
       ⚠️ 用 <details> 是為了可以收起來：拼到後面已經記得的人，
          不必一直被它佔著螢幕。 */
    function pseudoBox(lines) {
      var d = global.document.createElement('details');
      d.className = 'bk-pseudo';
      d.open = true;
      var sum = global.document.createElement('summary');
      sum.textContent = '📝 程式要長這樣';
      d.appendChild(sum);
      var pre = global.document.createElement('pre');
      pre.innerHTML = (typeof lines === 'string') ? lines : lines.join('\n');
      d.appendChild(pre);
      /* ★ 每一關都要講的兩件事，寫在模組裡 ——
         讓每一關自己在 build 裡寫一遍的話，總有幾關會忘記。 */
      var note = el('div', 'bk-psnote',
        '往右縮排＝包在上面那塊積木的肚子裡。名字（副程式、變數）可以自己取，'
        + '但兩邊要用同一個。'
        + (/？/.test(String(lines)) ? '　❓ 是這一關要你自己想出來的數字。' : ''));
      d.appendChild(note);
      return d;
    }
    function btnCss(bg) {
      return 'background:' + bg + ';color:#fff;border:0;border-radius:10px;padding:9px 15px;' +
             'font-weight:700;font-size:14px;cursor:pointer';
    }

    /* ── 畫積木 ── */
    function renderBlock(node, isTemplate) {
      var d = DEFS[node.id], c = CATS[d.cat];
      if (d.shape === 'reporter') return renderReporter(node, isTemplate);
      var b = el('div', 'bk' + (d.shape === 'hat' ? ' hat' : '') + (d.shape === 'c' ? ' bk-c' : ''));
      b.style.setProperty('--c', c.color);
      b.style.setProperty('--bk-canvas', '#f9f9f9');   // C 型積木「嘴巴」露出的底色
      /* ⚠️ 一定要關掉原生拖曳。瀏覽器看到「按住有文字的元素在移動」
         會自己啟動 HTML5 drag，而原生 drag 一開始，pointermove 就不再觸發 ——
         拖曳整個斷掉，放開時當然什麼也沒發生。
         user-select:none 擋不住這件事，要明確設 draggable=false。 */
      b.draggable = false;
      b.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
      b.dataset.uid = node.uid;
      b.dataset.id = node.id;

      // label 裡的 %n / %s 換成輸入框
      var parts = d.label.split(/(%n|%s|%flag)/), ai = 0;
      var head = el('div', 'bk-row');
      parts.forEach(function (p) {
        if (p === '%flag') {
          head.appendChild(svgSpan(FLAG_SVG));
        } else if (p === '%n' || p === '%s') {
          head.appendChild(renderHole(node, ai, p, isTemplate));
          ai++;
        } else if (p) {
          head.appendChild(el('span', '', p));
        }
      });
      b.appendChild(head);

      if (d.shape === 'c' || d.shape === 'c2') {
        var slot = el('div', 'bk-slot bk-stack');
        slot.dataset.slot = '1';
        b.appendChild(slot);
        /* c2（如果…否則）：中間插一條「否則」，再開第二個容器。
           ★ 中間那一條要看得出來是同一塊積木的一部分，不是兩塊疊在一起 ——
             所以用同一個 --c 顏色，只在文字上區分。 */
        if (d.shape === 'c2') {
          var mid = el('div', 'bk-else', '否則');
          b.appendChild(mid);
          var slot2 = el('div', 'bk-slot bk-stack');
          slot2.dataset.slot = '2';
          b.appendChild(slot2);
          if (!isTemplate) fill(slot2, node.children2);
        }
        var foot = el('div', 'bk-foot');
        b.appendChild(foot);
        if (!isTemplate) fill(slot, node.children);
      }

      b.addEventListener('pointerdown', function (e) { startDrag(e, node, b, isTemplate); });
      return b;
    }

    /* 一個「空格」：可以打字，也可以被拖一顆橢圓積木進來。
       DOM 上掛 _node/_idx，拖曳時才知道要塞進誰的第幾格。 */
    function renderHole(node, idx, kind, isTemplate, inRep) {
      var hole = el('span', 'bk-hole');
      hole._node = node; hole._idx = idx; hole._tpl = !!isTemplate;
      var v = node.args[idx];
      if (v && typeof v === 'object') {           // 裡面已經有一顆橢圓積木
        hole.appendChild(renderReporter(v, false, node, idx));
      } else {
        var i = el('input', 'bk-in' + (kind === '%s' ? ' s' : ''));
        i.value = v == null ? '' : v;
        if (kind === '%n') i.type = 'number';
        /* ⚠️ 橢圓（回報值）裡的空格要用小一號的尺寸。
           這裡不能靠 closest('.bk-rep') 判斷 —— 這個時候
           input 還沒被掛進 DOM，closest 一定回 null。
           所以由呼叫端明講「我在橢圓裡」。 */
        fitIn(i, inRep);
        i.addEventListener('input', function () {
          fitIn(i, inRep);
          var before = node.args[idx];
          node.args[idx] = i.value;
          /* 改的是「定義」上的參數名 → 定義裡面已經放好的橢圓要跟著改。
             不跟的話那些橢圓會突然指向一個不存在的參數，
             程式默默停止運作而畫面上完全看不出來 —— 最糟的一種壞法。
             真的 Scratch 也是這樣連動的。 */
          if (isDefine(node.id) && idx >= 1 && idx <= DEFINE_IDS[node.id]) {
            renameParam(node, String(before).trim(), i.value.trim());
            drawPalette();
          }
        });
        i.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); // 打字不要觸發拖曳
        hole.appendChild(i);
      }
      return hole;
    }

    /** 橢圓形的回報值積木。owner/oidx 是「它現在被塞在誰的第幾格」 */
    function renderReporter(node, isTemplate, owner, oidx) {
      var d = DEFS[node.id], c = CATS[d.cat];
      var r = el('span', 'bk-rep');
      r.style.setProperty('--c', c.color);
      r.draggable = false;
      r.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
      r.dataset.uid = node.uid;
      r.dataset.id = node.id;
      var parts = d.label.split(/(%n|%s)/), ai = 0;
      parts.forEach(function (p) {
        if (p === '%n' || p === '%s') { r.appendChild(renderHole(node, ai, p, isTemplate, true)); ai++; }
        else if (p) r.appendChild(el('span', '', p));
      });
      r.addEventListener('pointerdown', function (e) {
        e.stopPropagation();                       // 不要連帶把外層的整塊積木拖走
        startDrag(e, node, r, isTemplate, owner, oidx);
      });
      return r;
    }

    /** 把定義內部所有指向 from 的參數橢圓改成 to */
    function renameParam(defNode, from, to) {
      if (!from || from === to) return;
      (function walk(list) {
        (list || []).forEach(function (n) {
          (n.args || []).forEach(function (a, i) {
            if (a && typeof a === 'object') {
              if (a.id === 'arg.param' && String(a.args[0]).trim() === from) a.args[0] = to;
              walk([a]);
            }
          });
          walk(n.children);
          walk(n.children2);
        });
      })(defNode.children);
    }

    /** 把一串 node 畫進容器，中間夾放置點 */
    function fill(box, list) {
      box.innerHTML = '';
      box.appendChild(dropZone(list, 0));
      list.forEach(function (n, i) {
        box.appendChild(renderBlock(n, false));
        box.appendChild(dropZone(list, i + 1));
      });
      if (!list.length) {
        box.appendChild(el('div', 'bk-empty', box._isDef
          ? '把「定義…」積木拖到這裡'
          : '把左邊的積木拖到這裡'));
      }
    }
    function dropZone(list, idx) {
      var z = el('div', 'bk-drop');
      z._list = list; z._idx = idx;
      return z;
    }
    function redraw() {
      SP.forEach(function (sp) {
        if (sp.defArea) { fill(sp.defArea, sp.defs); sp.defArea.classList.add('bk-stack'); }
        fill(sp.script, sp.program);
        sp.script.classList.add('bk-stack');
      });
      drawPalette();          // 定義上的參數名可能變了，調色盤要跟著換
    }
    /** 所有程式區（判定與拖曳都要一起看） */
    function areas() {
      var out = [];
      SP.forEach(function (sp) { if (sp.defArea) out.push(sp.defArea); out.push(sp.script); });
      return out;
    }
    /** 一個角色的完整程式 = 它的函式區 ＋ 它的主程式 */
    function wholeOf(sp) { return sp.defs.concat(sp.program); }
    /** 全部角色串起來（給模擬器與 load 用；判定不走這裡 —— 判定是一個角色一份） */
    function whole() {
      var out = [];
      SP.forEach(function (sp) { out = out.concat(wholeOf(sp)); });
      return out;
    }
    function clearAll() { SP.forEach(function (sp) { sp.defs.length = 0; sp.program.length = 0; }); }

    /* ── 拖曳（pointer events：滑鼠、觸控、觸控筆都能用）── */
    var drag = null;
    var rejected = '';        // 這次拖曳被區域規則擋下的原因（放開時顯示）
    function startDrag(e, node, srcEl, isTemplate, owner, oidx) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();

      // 從調色盤拖 = 複製一塊新的；從程式區拖 = 搬移（先摘下來）
      var moving = isTemplate ? makeNode(node.id) : node;
      if (!isTemplate) {
        if (owner) {
          // 從別的積木的空格裡拉出來 → 那一格恢復成可以打字的欄位
          owner.args[oidx] = (DEFS[owner.id].args || [])[oidx];
          if (owner.args[oidx] == null) owner.args[oidx] = '';
        } else {
          /* ⚠️ 不知道它原本在哪一個角色的哪一區 —— 全部找一遍。
             找不到就當它已經被摘掉了（不要當成錯誤）。 */
          SP.some(function (sp) {
            return detach(sp.program, node) || detach(sp.defs, node);
          });
        }
      }
      var isRep = DEFS[moving.id].shape === 'reporter';

      var ghost = renderBlock(moving, false);
      ghost.classList.add('bk-ghost');
      ghost.style.width = srcEl.offsetWidth + 'px';
      document.body.appendChild(ghost);

      drag = { node: moving, ghost: ghost, zone: null, rep: isRep };
      rejected = '';
      document.body.classList.add('bk-dragging');   // 讓所有縫隙顯形
      if (isRep) document.body.classList.add('bk-rep-drag');   // 改成讓「空格」顯形
      document.addEventListener('dragstart', stopNativeDrag);
      moveGhost(e);
      if (!isTemplate) redraw();

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function moveGhost(e) {
      drag.ghost.style.left = (e.clientX - 30) + 'px';
      drag.ghost.style.top = (e.clientY - 16) + 'px';
    }
    /* 找「該放到哪一道縫」。

       ⚠️ 前兩版都靠 document.elementFromPoint + closest() 去問
          「游標下面是誰」。那在瀏覽器裡很脆弱：只要有任何東西疊在上面
          （拖曳中的分身、transition 進行中的元素、瀏覽器自己的選取層），
          問到的就不是我們要的元素，於是判定成「沒有放置目標」，
          放開後積木就消失了 —— 也就是「拖不進去、放開不會停住」。

       改成純幾何：直接量所有縫隙的座標，挑離游標最近的一道。
       不問瀏覽器任何事，就沒有被誰擋住的問題。
       水平距離只給兩成權重，因為 C 型積木的凹槽是靠縮排區分的，
       主要仍看垂直位置。 */
    /* 橢圓積木要找的是「空格」，不是積木之間的縫。
       ⚠️ 不能塞進自己裡面（把一顆積木拖進它自己的空格會變成無限巢狀），
          也不能塞進調色盤上的樣板。 */
    function nearestHole(x, y, node) {
      var pad = 30, best = null, bestD = Infinity;
      areas().forEach(function (a) {
        [].slice.call(a.querySelectorAll('.bk-hole')).forEach(function (h) {
          if (h._tpl) return;
          var b = h.getBoundingClientRect();
          if (!b.width) return;
          var cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
          var d = Math.abs(x - cx) + Math.abs(y - cy);
          if (d > b.width / 2 + b.height / 2 + pad * 2) return;
          if (d < bestD) { bestD = d; best = h; }
        });
      });
      return best;
    }

    function nearestZone(x, y, node) {
      var pad = 48;                                   // 邊緣外一點也算，手不必很準
      var box = null;
      areas().forEach(function (a) {
        var r = a.getBoundingClientRect();
        if (x >= r.left - pad && x <= r.right + pad &&
            y >= r.top - pad  && y <= r.bottom + pad) box = a;
      });
      if (!box) return null;

      /* 放置限制：定義積木只能放函式區的頂層，其他積木不能放函式區頂層。
         這不是刁難 —— 「定義」在真實 Scratch 也不能接在主程式下面，
         而且分開放才看得出「定義」與「呼叫」是兩件事。 */
      var isDef = node && isDefine(node.id);
      var all = [].slice.call(box.querySelectorAll('.bk-drop'));
      var zones = all.filter(function (z) {
        var top = z.parentNode === box;               // 頂層（不在 C 型積木的凹槽裡）
        if (!top) return true;                        // 凹槽裡一律可放
        return box._isDef ? isDef : !isDef;
      });
      if (!zones.length) {
        /* 游標在區域內但這塊積木不該放這裡。
           記下原因 —— 積木默默消失是最讓人困惑的失敗方式。 */
        rejected = box._isDef
          ? '函式區只放「定義…」積木，其他積木請放到下面的主程式。'
          : '「定義…」積木要放在上面的函式區，不能接在主程式裡。';
        return null;
      }

      var best = null, bestD = Infinity;
      zones.forEach(function (z) {
        var b = z.getBoundingClientRect();
        var cy = (b.top + b.bottom) / 2;
        var dx = x < b.left ? b.left - x : (x > b.right ? x - b.right : 0);
        var d = Math.abs(y - cy) + dx * 0.2;
        if (d < bestD) { bestD = d; best = z; }
      });
      return best;
    }

    function onMove(e) {
      if (!drag) return;
      e.preventDefault();          // 順手擋掉行動裝置的捲動與長按選字
      moveGhost(e);
      // 不再需要「先把分身藏起來再問瀏覽器」——現在只量座標，分身不影響
      rejected = '';
      var z = drag.rep ? nearestHole(e.clientX, e.clientY, drag.node)
                       : nearestZone(e.clientX, e.clientY, drag.node);
      if (drag.zone && drag.zone !== z) drag.zone.classList.remove('on');
      drag.zone = z;
      if (z) z.classList.add('on');
    }
    function stopNativeDrag(ev) { ev.preventDefault(); }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('dragstart', stopNativeDrag);
      document.body.classList.remove('bk-dragging');
      document.body.classList.remove('bk-rep-drag');
      if (!drag) return;
      var z = drag.zone;
      if (z) {
        z.classList.remove('on');
        if (drag.rep) z._node.args[z._idx] = drag.node;    // 塞進空格
        else z._list.splice(z._idx, 0, drag.node);         // 接進積木串
      }
      // 沒放在任何放置點 = 丟掉（等於刪除積木）
      var why = z ? '' : rejected;
      drag.ghost.remove();
      drag = null;
      redraw();
      say(why);
    }
    /** 從樹裡把某個節點摘掉（可能在巢狀裡） */
    function detach(list, node) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === node) { list.splice(i, 1); return true; }
        if (list[i].children && detach(list[i].children, node)) return true;
        if (list[i].children2 && detach(list[i].children2, node)) return true;
      }
      return false;
    }

    /* ── 執行：在小舞台上跑一遍 ── */
    var st, ctx;
    var PEN_COLORS = { '紅':'#e5484d', '藍':'#0090ff', '綠':'#30a46c',
                       '黃':'#ffb224', '紫':'#8e4ec6', '黑':'#333' };
    function resetStage() {
      st = { x: 0, y: 0, dir: 90, size: 1, down: false, color: '#e5484d' };
      // canvas 的像素尺寸要跟著實際版面走，不然畫出來會糊掉或偏移
      var w = stage.clientWidth || 240, h = stage.clientHeight || 180;
      pen.width = w; pen.height = h;
      ctx = pen.getContext ? pen.getContext('2d') : null;
      if (ctx) { ctx.clearRect(0, 0, w, h); ctx.lineWidth = 3; ctx.lineCap = 'round'; }
      paint(); bubble.style.display = 'none';
    }
    /* Scratch 舞台就是 480×360、原點在正中央、y 向上。
       ★ 這裡一定要照抄，不能拿畫面上的像素當座標：
         我們的小舞台只有 230 像素寬，若把座標當像素用，x 只到 ±115，
         老師課堂檔案裡的「定位到 x:-140」就會畫到框外，
         學生在 Scratch 看到的圖和這裡看到的不一樣 —— 那比不畫還糟。 */
    var STAGE_W = 480, STAGE_H = 360;
    function sx() { return pen.width / STAGE_W; }
    function sy() { return pen.height / STAGE_H; }

    /** 舞台座標（中心為原點、y 向上）→ canvas 座標 */
    function toCanvas(x, y) {
      return [pen.width / 2 + x * sx(), pen.height / 2 - y * sy()];
    }
    function drawTo(x0, y0, x1, y1) {
      if (!ctx || !st.down) return;
      var a = toCanvas(x0, y0), b = toCanvas(x1, y1);
      ctx.strokeStyle = st.color;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    function paint() {
      var w = stage.clientWidth, h = stage.clientHeight;
      var px = w / STAGE_W, py = h / STAGE_H;          // 小貓也要用同一套換算，否則會和筆跡對不上
      sprite.style.left = (w / 2 + st.x * px - 18) + 'px';
      sprite.style.top = (h / 2 - st.y * py - 18) + 'px';
      sprite.style.transform = 'rotate(' + (st.dir - 90) + 'deg) scale(' + st.size + ')';   // 90 度＝朝右
      if (bubble.style.display !== 'none') {
        bubble.style.left = Math.min(w - 160, w / 2 + st.x * px + 10) + 'px';
        bubble.style.top = Math.max(4, h / 2 - st.y * py - 52) + 'px';
      }
    }
    function speak(t, ms) {
      bubble.textContent = t; bubble.style.display = ''; paint();
      if (ms) setTimeout(function () { bubble.style.display = 'none'; }, ms);
    }

    var running = false;
    function run() {
      if (running) return;
      running = true; runBtn.disabled = true;
      resetStage();
      var steps = [];
      var all = whole();
      flatten(all, steps, collectDefs(all), {}, 0, {});

      /* 每一步之間停多久。
         ★ 為什麼不是固定值：原本每步固定 280ms，三塊積木的程式剛剛好，
           但第 3 關要畫九個五邊形＝一百多個動作，會變成整整 35 秒 ——
           一節課裡學生每改一次就等半分鐘，沒有人會想按第二次執行。
         改成「整段大約跑 3 秒」，程式短就慢慢演給你看，程式長就快轉。
         上下限是為了兩頭都不失控：太快看不出在畫什麼，太慢等到不耐煩。
         opts.stepMs 可以指定（測試用 0，就不必真的等）。 */
      var stepMs = opts.stepMs != null ? Number(opts.stepMs)
                 : Math.max(14, Math.min(280, 3000 / Math.max(1, steps.length)));
      var i = 0;
      stopped = false;
      (function tick() {
        if (stopped || i >= steps.length) { running = false; runBtn.disabled = false; return; }
        var wait = exec(steps[i++], stepMs);
        setTimeout(tick, wait);
      })();
    }
    /* 把樹展開成一串動作。
       · 重複 N 次 → 直接展開
       · 自訂積木 → 找到定義，把它的內容接進來（等於 inline），
         並把「定義時取的參數名」配上「呼叫時填的值」傳下去（params），
         橢圓的參數積木就是靠名字去 params 裡拿值。
       防呆：遞迴深度 8 層、總步數 400 步 —— 學生把自訂積木寫成自己呼叫自己
       是很常見的意外，沒有上限的話瀏覽器會直接當掉。 */
    function collectDefs(list) {
      var m = {};
      (list || []).forEach(function (n) {
        if (isDefine(n.id)) m[String(n.args[0]).trim()] = n;
      });
      return m;
    }
    /* vars 是一個共用的物件，整趟展開共用同一份。
       ★ 為什麼變數在「展開」時算，而不是在「執行」時算：
         展開本來就是照執行順序走的（重複已經被拆開成一次一次），
         所以走到某一塊時，變數的值就是那一刻該有的值。
         這樣「呼叫 畫正五邊形 (大小)」才能在每一次拿到不同的數字 ——
         九個五邊形會一個比一個大，就是靠這個。 */
    /* 把一個空格的內容算成數字。
       字串就是字串；橢圓積木要看它是哪一種：
         參數（arg.param）→ 這一次呼叫帶進來的值
         變數（data.var） → 變數目前的值
         除法（op.div）   → 左邊 ÷ 右邊（360 ÷ 邊數 就是這樣來的） */
    function evalArg(v, vars, params) {
      if (!v || typeof v !== 'object') return v;
      // 參數用「名字」找 —— 一個自訂積木可以有兩個參數（例如 N 和 邊長），
      // 靠名字才分得出橢圓積木指的是哪一個
      if (v.id === 'arg.param') return params[String(v.args[0]).trim()] || 0;
      if (v.id === 'data.var')  return vars[String(v.args[0]).trim()] || 0;
      if (v.id === 'op.div') {
        var a = parseFloat(evalArg(v.args[0], vars, params)) || 0;
        var b = parseFloat(evalArg(v.args[1], vars, params)) || 0;
        return b === 0 ? 0 : a / b;                    // 除以 0 就當 0，不要讓畫面炸掉
      }
      return 0;
    }
    function evalArgs(n, vars, params) {
      return (n.args || []).map(function (v) { return evalArg(v, vars, params); });
    }

    function flatten(list, out, defs, params, depth, vars) {
      depth = depth || 0;
      vars = vars || {};
      params = params || {};
      if (depth > 8) return;
      (list || []).forEach(function (n) {
        if (out.length >= 400) return;
        if (isDefine(n.id)) return;                                  // 定義本身不執行
        var v = evalArgs(n, vars, params);            // 空格先算成數字
        if (n.id === 'data.setvar') {
          vars[String(n.args[0]).trim()] = parseFloat(v[1]) || 0;
          return;                                                    // 沒有畫面效果，不必排進動作
        }
        if (n.id === 'data.changevar') {
          var k = String(n.args[0]).trim();
          vars[k] = (vars[k] || 0) + (parseFloat(v[1]) || 0);
          return;
        }
        if (isCall(n.id)) {
          var d = defs[String(n.args[0]).trim()];
          if (!d) return;                                            // 呼叫了不存在的積木 → 略過
          /* 把「定義時取的參數名」配上「呼叫時填的值」。
             定義 畫圖形 (N) (邊長) ＋ 呼叫 畫圖形 4 30 → { N:4, 邊長:30 } */
          var np = {}, cnt = Math.min(CALL_IDS[n.id], DEFINE_IDS[d.id]);
          for (var q = 0; q < cnt; q++) {
            np[String(d.args[q + 1]).trim()] = parseFloat(v[q + 1]) || 0;
          }
          flatten(d.children, out, defs, np, depth + 1, vars);
          return;
        }
        if (n.id === 'control.repeat') {
          var t = Math.max(0, Math.min(50, Math.round(parseFloat(v[0])) || 0));
          for (var k2 = 0; k2 < t && out.length < 400; k2++) flatten(n.children, out, defs, params, depth + 1, vars);
          return;
        }
        out.push({ node: n, vals: v });
      });
    }
    function exec(step, stepMs) {
      if (stepMs == null) stepMs = 280;
      var n = step.node, a = step.vals || n.args;     // vals 是空格算完的值
      var num = function (i) { return parseFloat(a[i]) || 0; };
      var move = function (dist) {
        var x0 = st.x, y0 = st.y;
        // Scratch 的方向：90 = 右、0 = 上
        st.x += Math.sin(st.dir * Math.PI / 180) * dist;
        st.y += Math.cos(st.dir * Math.PI / 180) * dist;
        drawTo(x0, y0, st.x, st.y);
      };
      switch (n.id) {
        case 'motion.move':      move(num(0)); break;
        case 'pen.down':         st.down = true; break;
        case 'pen.up':           st.down = false; break;
        case 'pen.clear':        if (ctx) ctx.clearRect(0, 0, pen.width, pen.height); break;
        case 'pen.color':        st.color = PEN_COLORS[String(a[0]).trim()] || '#e5484d'; break;
        case 'motion.turnright': st.dir += num(0); break;
        case 'motion.turnleft':  st.dir -= num(0); break;
        case 'motion.goto':      st.x = num(0); st.y = num(1); break;   // 定位不留筆跡
        case 'motion.point':     st.dir = num(0); break;
        case 'motion.setx': {
          var xs0 = st.x; st.x = num(0); drawTo(xs0, st.y, st.x, st.y); break;
        }
        case 'motion.sety': {
          var ys0 = st.y; st.y = num(0); drawTo(st.x, ys0, st.x, st.y); break;
        }
        case 'motion.changex': {
          var x0 = st.x; st.x += num(0); drawTo(x0, st.y, st.x, st.y); break;
        }
        case 'motion.changey': {
          var y0 = st.y; st.y += num(0); drawTo(st.x, y0, st.x, st.y); break;
        }
        case 'looks.say':        speak(a[0]); break;
        // 這兩塊的秒數是程式自己寫的，不受快轉影響 —— 它們就是在「等」
        case 'looks.sayfor':     speak(a[0], num(1) * 1000); return Math.max(200, num(1) * 1000);
        case 'looks.change':     st.size = Math.max(.3, Math.min(2.5, st.size + num(0) / 100)); break;
        case 'looks.next':       sprite.textContent = sprite.textContent === '🐱' ? '😺' : '🐱'; break;
        case 'sound.play':       speak('♪ ' + a[0], 700); break;
        case 'control.wait':     return Math.max(200, num(0) * 1000);
      }
      paint();
      return stepMs;
    }

    /* ── 檢查答案 ── */
    function say(t, ok) {
      msg.textContent = t;
      msg.style.color = t ? (ok ? '#16a34a' : '#b45309') : '';
    }
    /* 可以接受的答案：第一份是參考解答，後面是課本認可的其他解法。
       ★ 為什麼要有這個
         課本（p.135 教學叮嚀）明講：學生把下筆與停筆放在重複積木中，
         「執行結果也正確」，並且「相同問題可以有不同的解法」。
         判定只認一種寫法的話，那句話就是假的 ——
         學生完全做對卻被說錯，比沒有回饋更糟。
       ★ 但也不是「畫出來一樣就算過」
         這一關要學的是模組化。六段一樣的積木也畫得出六個正方形，
         那不能算過。所以是「幾份指定的正確寫法」，不是「畫得像就好」。 */
    var loose = opts.loose || [];
    /** 這個角色可以接受的答案（第一份是參考解答） */
    function targetsOf(sp) { return [{ goal: sp.goal, note: '' }].concat(sp.alts || []); }
    /** 錯誤訊息前面標角色 —— 兩個角色的時候，不講是哪一個等於沒講 */
    function who(sp) {
      return multi ? '【' + (sp.icon ? sp.icon + ' ' : '') + sp.name + '】' : '';
    }

    function check() {
      if (!whole().length) { say('程式區還是空的，先從左邊拖幾塊積木過來。'); return; }

      /* ★ 一個角色一份判定。
         ⚠️ 不可以把兩個角色串起來比 —— 那會變成「兩個角色的順序也要對」，
            而在真的 Scratch 裡它們根本沒有先後。 */
      var notes = [];
      for (var k = 0; k < SP.length; k++) {
        var sp = SP[k], all = wholeOf(sp), ts = targetsOf(sp), hit = null;
        for (var i = 0; i < ts.length && !hit; i++) {
          if (same(all, ts[i].goal, loose)) hit = ts[i];
        }
        if (hit) { if (hit.note) notes.push(hit.note); continue; }
        /* 「差在哪」要拿最接近的那一份來比 —— 學生在拼另一種解法時，
           硬拿參考解答去比，會指著一個他根本沒打算寫的地方叫他改。 */
        var got = canon(all), best = canon(ts[0].goal), bs = -1;
        ts.forEach(function (t) {
          var w = canon(t.goal), sc = score(got, w, loose);
          if (sc > bs) { bs = sc; best = w; }
        });
        say('❌ ' + who(sp) + diffHint(got, best));
        return;
      }
      say(notes.length
            ? '✅ 這樣也對！' + notes.join(' ')
            : ('✅ 組對了！' + (passed ? '' : ' 這一關通過。')),
          true);
      if (!passed) { passed = true; if (opts.onPass) opts.onPass(plain(whole())); }
    }
    /** 給一句「差在哪」，不要只說錯 —— 學生看到「錯了」只會亂試。
        差別藏在 C 型積木裡面時要一路追進去講（「第 5 塊裡面的第 2 塊」）：
        只說「裡面包的積木不對」，等於叫學生自己一塊一塊試。 */
    function diffHint(got, want, where) {
      where = where || '';
      if (got.length < want.length) return where + '積木還不夠，再想想少了哪一步。';
      if (got.length > want.length) return where + '積木太多了，有幾塊是用不到的。';
      for (var i = 0; i < want.length; i++) {
        var at = where + '第 ' + (i + 1) + ' 塊積木';
        if (got[i].id !== want[i].id) return at + '不對。';
        // 寬鬆的積木（例如定位座標）本來就不比數字，這裡也不能拿它來挑毛病
        if (loose.indexOf(want[i].id) < 0 &&
            JSON.stringify(got[i].args) !== JSON.stringify(want[i].args)) {
          /* 名字對不上要講清楚是「對不上」，不是「取錯字」——
             名字本來就可以自己取，說「文字要再改一下」會害學生
             回頭去猜參考答案到底叫什麼，那正是我們不想考的東西。 */
          var d = DEFS[want[i].id] || {};
          var bad = (d.idArgs || []).filter(function (k) { return got[i].args[k] !== want[i].args[k]; });
          if (bad.length) {
            return got[i].args[bad[0]] === '(沒有取名字)'
              ? at + '還沒取名字。'
              : at + '的名字，和你在別的地方寫的對不起來 —— '
                + '「定義」和「呼叫」要用同一個名字（叫什麼都可以）。';
          }
          return at + '的數字或文字要再改一下。';
        }
        if (want[i].children && !eqList(got[i].children || [], want[i].children, loose))
          return diffHint(got[i].children, want[i].children, at + '裡面的');
        if (want[i].children2 && !eqList(got[i].children2 || [], want[i].children2, loose))
          return diffHint(got[i].children2, want[i].children2, at + '「否則」裡面的');
      }
      return where ? where + '順序不太對。' : '順序好像不太對，再對照一次任務說明。';
    }

    var stopped = false;
    flagBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', function () { stopped = true; });
    runBtn.addEventListener('click', run);
    checkBtn.addEventListener('click', check);
    clearBtn.addEventListener('click', function () {
      clearAll(); redraw(); resetStage(); say('');
    });

    redraw();
    setTimeout(resetStage, 0);

    return {
      reset: function () { clearAll(); redraw(); resetStage(); say(''); },
      /* 載入：自動把「定義」放進函式區、其餘放進主程式 */
      load: function (list, which) {
        /* which：要載到第幾個角色（多角色關卡才需要，預設第 1 個）。
           ⚠️ 這支只有測試與「載入上次進度」在用 —— 學生是用拖的。 */
        clearAll();
        var sp = SP[which || 0] || SP[0];
        (list || []).forEach(function (n) {
          (isDefine(n.id) && sp.defArea ? sp.defs : sp.program).push(n);
        });
        redraw();
      },
      /* 多角色關卡：一次載入每個角色的程式（陣列的陣列） */
      loadAll: function (lists) {
        clearAll();
        (lists || []).forEach(function (list, i) {
          var sp = SP[i]; if (!sp) return;
          (list || []).forEach(function (n) {
            (isDefine(n.id) && sp.defArea ? sp.defs : sp.program).push(n);
          });
        });
        redraw();
      },
      get sprites() { return SP.length; },
      get program() { return plain(whole()); }
    };
  }

  global.BLOCKS = {
    CATS: CATS,
    DEFS: DEFS,
    mount: mount,
    _plain: plain,
    _canon: canon,
    _same: same,
    _score: score,
    _pseudo: pseudoFrom
  };

})(window);
