/* =====================================================================
   下學期（11502）的課程設定
   ---------------------------------------------------------------------
   ★ 移植時**不必改這一支**：學校、Firebase、Apps Script 都在根目錄的 config.js。
     這裡只寫「這一學期教什麼」：四門課、Scratch 十關、題庫放在哪裡。
   ★ 由 shared/term.js 載入（網頁不直接載這一支），defineTerm 會把它和全站設定合併成 window.CONFIG。
   ===================================================================== */
defineTerm({
  TERM: '11502',

  // ── 闖關基地的四張卡片（hub.html）───────────────────────
  //   maxStars 是進度條的分母，一定要和「這張卡真的顯示的星數」對得起來。
  //   程式設計這張卡合併兩組星星（combines）：
  //     🧩 作品星：上傳 .sb3 和範例比對（要接 Apps Script），每關最多 3⭐；
  //        第 5、10 關沒有作品要交（NO_UPLOAD），所以是 8 關 × 3 ＝ 24
  //     🧠 概念星：概念檢測五題講到幾題，每關最多 3⭐，10 關 ＝ 30（不必接 Apps Script）
  MODULES: [
    { id: 'ethics', title: '媒體與社會議題', tag: '法律倫理', icon: '⚖️', href: 'quiz.html',
      theme: 'bg-pink-100 border-pink-300 text-pink-900', tape: 'bg-pink-500/25', rot: 'rotate-1',
      desc: '第五、六章共 10 個章節（含 2 個整章挑戰），做完測驗給星。', maxStars: 30, subLevels: 10 },
    { id: 'thinking', title: '運算思維挑戰', tag: '運算思維', icon: '🧠', href: 'thinking.html',
      theme: 'bg-green-100 border-green-300 text-green-900', tape: 'bg-green-500/25', rot: '-rotate-1',
      desc: '10 道生活謎題，訓練邏輯與拆解力。', maxStars: 20, subLevels: 10 },
    { id: 'scratch2', combines: ['scratch', 'concept'], title: 'Scratch 程式設計', tag: '程式設計', icon: '🐱', href: 'scratch.html',
      theme: 'bg-orange-100 border-orange-300 text-orange-900', tape: 'bg-orange-500/25', rot: 'rotate-2',
      desc: '十關全部開放：情境 → 問題分析 → 概念檢測 → 程式拼圖 → 在 Scratch 做出來。',
      maxStars: (window.SITE.GRADER_URL ? 24 : 0) + 30, subLevels: (window.SITE.GRADER_URL ? 8 : 0) + 10 },
    { id: 'arduino', title: 'Arduino 智慧專題', tag: '延伸挑戰', icon: '💡', href: 'arduino.html',
      theme: 'bg-indigo-100 border-indigo-300 text-indigo-900', tape: 'bg-indigo-500/25', rot: 'rotate-1',
      desc: '五節課 PBL：找一個自己看到的問題，做出專屬作品。', maxStars: 0, subLevels: 0 }   // 延伸體驗，不計星數
  ],

  // ── 教師後台「成績總覽」的科目欄 ─────────────────────────
  //   key 是 progress 文件裡 modules 底下的名稱；max 是星數上限。
  //   concept（概念星）不存，每次由 modules.scratch.quiz 的分數現算（computed）。
  SUBJECTS: [
    { key: 'ethics',   label: '媒體與社會議題', max: 30, rule: '每章 1–3★' },
    { key: 'thinking', label: '運算思維',       max: 20, rule: '每關 2★' },
    { key: 'scratch',  label: '程式設計',       max: 24, rule: '每關 2–3★', grader: true },   // grader：有接 Apps Script 才有
    { key: 'concept',  label: '概念星',         max: 30, rule: '每關 1–3★', computed: true, group: '程式設計' }
  ],

  // ── 章節測驗（quiz.html）與闖關排行賽 ───────────────────
  QUIZ: { NAME: '媒體與社會議題', CONTENT: 'content/social.js', HINTS: 'content/social.hints.js' },
  ARENA_INFO: {
    NAME: '媒體與社會議題', SUBTITLE: '媒體與社會議題・基本演算法',
    /* 參賽資格：這些章節全部通關。⚠️ 要和 content/social.js 的章節一樣（gas/arena.test.js 會比對） */
    UNITS: ['5-1', '5-2', '5-3', '5-4', '5-5', '5-all', '6-1', '6-2', '6-3', '6-all']
  },

  // ── 運算思維的 10 道謎題（thinking.html）──────────────
  //   ★ 學生截圖的檔名要含 title（認關卡用），所以 title 要和謎題網站上的關卡名一樣。
  THINKING: {
    CHALLENGES: [
      { id: 1,  title: '智慧選卡', url: 'https://reurl.cc/6Gqor6', difficulty: '★★' },
      { id: 2,  title: '必勝棋局', url: 'https://reurl.cc/yOAdzl', difficulty: '★★' },
      { id: 3,  title: '變數謎題', url: 'https://reurl.cc/2aQ129', difficulty: '★★★' },
      { id: 4,  title: '遊園專車', url: 'https://reurl.cc/18O6d9', difficulty: '★★★' },
      { id: 5,  title: '智慧圓環', url: 'https://reurl.cc/qpY7Q0', difficulty: '★★★' },
      { id: 6,  title: '烤車輪餅', url: 'https://reurl.cc/GaN8Wd', difficulty: '★★★' },
      { id: 7,  title: '合作學習', url: 'https://reurl.cc/8e9EKb', difficulty: '★★★★' },
      { id: 8,  title: '校慶點心', url: 'https://reurl.cc/7EVGgl', difficulty: '★★★★' },
      { id: 9,  title: '夾娃娃機', url: 'https://reurl.cc/vELYlA', difficulty: '★★★★' },
      { id: 10, title: '兌領福袋', url: 'https://reurl.cc/V2WArN', difficulty: '★★★★' }
    ]
  },

  // ── Scratch 十關（scratch.html 闖關地圖、level.html 關卡頁）────────
  //   關卡內容（情境、問題分析、概念檢測、程式拼圖…）在 content/blocks.js；
  //   第 10 關最後的期末檢核題庫在 content/final.js。
  BLOCKS: { CONTENT: 'content/blocks.js', FINAL: 'content/final.js' },

  //   沒有程式作品要交的關卡：最後一步是「實作體驗」，不上傳、沒有作品星。
  //     第 5 關 6-1-1 排隊比高矮：觀念導入，課本這一節不寫程式
  //     第 10 關 6-3-3 資料大爆炸：比較第 8、9 關兩支程式的效能，自己不再寫一支
  NO_UPLOAD: ['6-1-1', '6-3-3'],

  //   [單元代號, 名稱]；順序即關卡編號 01～10。
  //   難度刻意排成連續的：1–3 函式積木（自訂積木 → 參數 → 綜合）、4 遊戲（事件、偵測、變數）、
  //   5 排序的兩個原子動作先單獨練、6–7 兩種排序法、8–9 兩種搜尋法（二元搜尋需要「已排序」）、10 效率比較。
  UNITS: [
    ['4-2-1', '平行的正方形'],
    ['4-2-2', '愈畫愈大的正方形'],
    ['4-2-3', '畫圖形（邊數、邊長）'],
    ['4-3-1', '小鳥吃蟲'],
    ['6-1-1', '排隊比高矮'],
    ['6-2-1', '選擇排序法'],
    ['6-2-2', '插入排序法'],
    ['6-3-1', '循序搜尋法'],
    ['6-3-2', '二元搜尋法'],
    ['6-3-3', '資料大爆炸']
  ]
});
