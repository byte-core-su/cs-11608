/* =====================================================================
   上學期（11501）的課程設定
   ---------------------------------------------------------------------
   ★ 移植時**不必改這一支**：學校、Firebase、Apps Script 都在根目錄的 config.js。
     這裡只寫「這一學期教什麼」：四門課、程式設計十關、題庫放在哪裡。
   ★ 由 shared/term.js 載入（網頁不直接載這一支），defineTerm 會把它和全站設定合併成 window.CONFIG。
   ===================================================================== */
defineTerm({
  TERM: '11501',

  // ── 闖關基地的四張卡片（hub.html）───────────────────────
  //   maxStars 是進度條的分母，一定要和「這張卡真的顯示的星數」對得起來。
  //   combines：一張卡合併好幾個模組的星數（程式設計＝流程圖＋作品星）。
  MODULES: [
    { id: 'ethics', title: '資訊倫理學習系統', tag: '法律倫理', icon: '⚖️', href: 'quiz.html',
      theme: 'bg-pink-100 border-pink-300 text-pink-900', tape: 'bg-pink-500/25', rot: 'rotate-1',
      desc: '資訊倫理、網路禮儀、著作權與個資法。', maxStars: 30, subLevels: 10 },
    { id: 'thinking', title: '運算思維挑戰', tag: '運算思維', icon: '🧠', href: 'thinking.html',
      theme: 'bg-green-100 border-green-300 text-green-900', tape: 'bg-green-500/25', rot: '-rotate-1',
      desc: '10 道生活謎題，訓練邏輯與拆解力。', maxStars: 20, subLevels: 10 },
    /* 流程圖 10×2 ＋ 交圖加分 10 ＝ 30；有接 Apps Script 評分（GRADER_URL）再加作品星 10×3 ＝ 60 */
    { id: 'listprog', combines: ['flowchart', 'scratch'], title: '程式設計（Scratch）', tag: '程式設計', icon: '🐱', href: 'flowchart.html',
      theme: 'bg-orange-100 border-orange-300 text-orange-900', tape: 'bg-orange-500/25', rot: '-rotate-1',
      desc: '含前導「清單學習機」與音階教材；一關關：排流程圖 → 寫 Scratch 程式。',
      maxStars: window.SITE.GRADER_URL ? 60 : 30, subLevels: 20 },
    { id: 'arduino', title: '智慧家居機電專題', tag: '延伸挑戰', icon: '💡', href: '5016b.html',
      theme: 'bg-indigo-100 border-indigo-300 text-indigo-900', tape: 'bg-indigo-500/25', rot: 'rotate-2',
      desc: '五節課：感應、換算、調速、混色，最後做一個自己的專題。', maxStars: 0, subLevels: 0 }   // 延伸體驗，不計星數
  ],

  // ── 教師後台「成績總覽」的科目欄 ─────────────────────────
  //   key 是 progress 文件裡 modules 底下的名稱；max 是星數上限。
  SUBJECTS: [
    { key: 'ethics',    label: '資訊倫理', max: 30, rule: '每章 1–3★' },
    { key: 'thinking',  label: '運算思維', max: 20, rule: '每關 2★' },
    { key: 'flowchart', label: '流程圖',   max: 30, rule: '每關 2★' },
    { key: 'scratch',   label: '程式設計', max: 30, rule: '每關 2–3★', grader: true }   // grader：有接 Apps Script 才有
  ],

  // ── 章節測驗（quiz.html）與闖關排行賽 ───────────────────
  QUIZ: { NAME: '資訊倫理', CONTENT: 'content/ethics.js', HINTS: 'content/ethics.hints.js' },
  ARENA_INFO: {
    NAME: '資訊倫理', SUBTITLE: '資訊倫理與相關法律',
    /* 參賽資格：這些章節全部通關。⚠️ 要和 content/ethics.js 的章節一樣（gas/arena.test.js 會比對）；
       真正擋人的是 Apps Script（用老師匯入的題庫裡的章節清單），這裡只是先告訴學生還差幾章。 */
    UNITS: ['1-1', '1-2', '1-3', '1-4', 'ch1-all', '3-1', '3-2', '3-3', 'ch3-all', 'review-all']
  },

  // ── 運算思維的 10 道謎題（thinking.html）──────────────
  //   ★ 學生截圖的檔名要含 title（認關卡用），所以 title 要和謎題網站上的關卡名一樣。
  THINKING: {
    CHALLENGES: [
      { id: 1,  title: '跳格子',       url: 'https://reurl.cc/mpY8EY', difficulty: '★★' },
      { id: 2,  title: '任意門',       url: 'https://reurl.cc/ovYkWl', difficulty: '★★' },
      { id: 3,  title: '滑梯公園',     url: 'https://reurl.cc/DxOzRN', difficulty: '★★★' },
      { id: 4,  title: '水餃工廠',     url: 'https://reurl.cc/6Gqo16', difficulty: '★★★' },
      { id: 5,  title: '無括號計算機', url: 'https://reurl.cc/Q2arzb', difficulty: '★★★' },
      { id: 6,  title: '遊覽車共乘',   url: 'https://reurl.cc/53Rj6y', difficulty: '★★★' },
      { id: 7,  title: '扭蛋轉轉樂',   url: 'https://reurl.cc/N2xvW5', difficulty: '★★★★' },
      { id: 8,  title: '換零錢機',     url: 'https://reurl.cc/epkRrR', difficulty: '★★★★' },
      { id: 9,  title: '打地鼠',       url: 'https://reurl.cc/ovYkj3', difficulty: '★★★★' },
      { id: 10, title: '拔蘿蔔',       url: 'https://reurl.cc/ppYlGr', difficulty: '★★★★' }
    ]
  },

  // ── 程式設計：逐關流程圖（只有上學期）───────────────────
  //   有這一格：流程圖頁、晨星勇者、教師後台「📥 繳交審核」（流程圖圖片加分）才會出現。
  FLOWCHART: { CONTENT: 'content/flowchart.js' },

  // ── 10 個程式設計單元（流程圖／程式設計／教師端共用）──
  //   [單元代號, 名稱]；順序即關卡編號 01～10（作品備份的檔名依此）
  UNITS: [
    ['2-1-1A', '班級置物櫃'],
    ['2-1-1B', '集合點名'],
    ['2-1-2',  '演奏小星星'],
    ['2-1-3',  '計算成績'],
    ['2-1-4',  '抽號碼'],
    ['2-1-5',  '撲克發牌'],
    ['2-2-1',  '動物點點名'],
    ['2-2-2',  '戰車王'],
    ['2-3-1',  '分身小貓'],
    ['2-3-2',  '螞蟻搬乳酪']
  ]
});
