/* =====================================================================
   章節測驗引擎（版型單一來源）
   ---------------------------------------------------------------------
   這支負責「長什麼樣子」與「怎麼跑」，完全不含任何課程內容。
   內容一律由 content/*.js 提供 window.QUIZ_CONTENT。

   用法（頁面外殼只要三行）：
     <script src="content/ethics.js"></script>        內容資料
     <script src="shared/quiz-engine.js"></script>    版型與流程（本檔）
     <script type="module" src="shared/quiz-firebase.js"></script>  資料庫接線

   本檔刻意寫成「一般 script」而非 module：
      module 會被延後執行，已登入的學生會先看到空白畫面再跳章節頁。
      一般 script 解析到就執行，畫面不會閃。
   ===================================================================== */
(function () {
  'use strict';

  var C = window.QUIZ_CONTENT;
  if (!C) { console.error('[quiz-engine] 找不到 window.QUIZ_CONTENT，請先載入內容資料檔'); return; }

  /* 讀完就把題庫從 window 上拿掉：不讓學生在 Console 打一行 QUIZ_CONTENT 就整批帶走。
     ⚠️ 這不是把題庫藏起來（content/*.js 本身是公開的檔案），擋的是「考試當下順手一行帶走」。
     quiz-firebase.js 只用 window.QUIZ 檢查引擎在不在，不讀 QUIZ_CONTENT。 */
  try { delete window.QUIZ_CONTENT; }
  catch (e) { window.QUIZ_CONTENT = undefined; }

  /* 答錯時的「想一想」提示：content/*.hints.js 提供 window.QUIZ_HINTS = { 題幹原文: 提示 }。
     沒有這個檔就不顯示提示。讀完一樣從 window 拿掉。 */
  var HINTS = window.QUIZ_HINTS || {};
  try { delete window.QUIZ_HINTS; } catch (e) { window.QUIZ_HINTS = undefined; }
  function hintFor(item) {
    var h = item && Object.prototype.hasOwnProperty.call(HINTS, item.q) ? HINTS[item.q] : '';
    return typeof h === 'string' ? h.trim() : '';
  }

  // ── 預設值：內容資料沒寫的就用這些 ────────────────────────
  var TARGET    = C.target   || 10;   // 目標連對題數
  var MAX_WRONG = C.maxWrong || 20;   // 容錯上限，超過就跳學習警示單
  var KEEP      = C.keepRecords || 3; // 每個章節保留幾筆闖關紀錄
  /* 🧠 記憶補給站：通關後的重複練習，每次十題、一樣採用失焦機制。內容檔寫了 practice 才有。 */
  /* 入口在章節選單最下面；從**已通關的章節**出題：答錯過的最多 5 題，其餘從答對過的任選。 */
  var PRACTICE  = C.practice ? { label: C.practice.label || '🧠 記憶補給站',
                                 size: C.practice.size || 10,
                                 weak: C.practice.weak || 5 } : null;
  var passedIds = [];   // 已通關（有星）的章節 id —— paintBadges 讀完進度後填

  /* ===================================================================
     色票：不用字串拼接組 class，避免 Tailwind CDN 掃不到而失效
     每個模組色都要在這裡登記一組，對照《設計規範》的模組代表色
     =================================================================== */
  var PALETTE = {
    pink:    { text:'text-pink-600',    textDark:'text-pink-700',    hover:'hover:text-pink-500',    bg:'bg-pink-600',    bgHover:'hover:bg-pink-700',    soft:'bg-pink-50',    softText:'text-pink-700',    softHover:'hover:bg-pink-600',    chip:'bg-pink-100 text-pink-700 border-pink-300',       border:'border-pink-500',    optHover:'hover:bg-pink-50 hover:border-pink-300',       optSel:['bg-pink-100','border-pink-500','text-pink-800'],       shadow:'shadow-pink-100' },
    blue:    { text:'text-blue-600',    textDark:'text-blue-700',    hover:'hover:text-blue-500',    bg:'bg-blue-600',    bgHover:'hover:bg-blue-700',    soft:'bg-blue-50',    softText:'text-blue-700',    softHover:'hover:bg-blue-600',    chip:'bg-blue-100 text-blue-700 border-blue-300',       border:'border-blue-500',    optHover:'hover:bg-blue-50 hover:border-blue-300',       optSel:['bg-blue-100','border-blue-500','text-blue-800'],       shadow:'shadow-blue-100' },
    emerald: { text:'text-emerald-600', textDark:'text-emerald-700', hover:'hover:text-emerald-500', bg:'bg-emerald-600', bgHover:'hover:bg-emerald-700', soft:'bg-emerald-50', softText:'text-emerald-700', softHover:'hover:bg-emerald-600', chip:'bg-emerald-100 text-emerald-700 border-emerald-300', border:'border-emerald-500', optHover:'hover:bg-emerald-50 hover:border-emerald-300', optSel:['bg-emerald-100','border-emerald-500','text-emerald-800'], shadow:'shadow-emerald-100' },
    purple:  { text:'text-purple-600',  textDark:'text-purple-700',  hover:'hover:text-purple-500',  bg:'bg-purple-600',  bgHover:'hover:bg-purple-700',  soft:'bg-purple-50',  softText:'text-purple-700',  softHover:'hover:bg-purple-600',  chip:'bg-purple-100 text-purple-700 border-purple-300',   border:'border-purple-500',  optHover:'hover:bg-purple-50 hover:border-purple-300',   optSel:['bg-purple-100','border-purple-500','text-purple-800'],   shadow:'shadow-purple-100' },
    orange:  { text:'text-orange-600',  textDark:'text-orange-700',  hover:'hover:text-orange-500',  bg:'bg-orange-600',  bgHover:'hover:bg-orange-700',  soft:'bg-orange-50',  softText:'text-orange-700',  softHover:'hover:bg-orange-600',  chip:'bg-orange-100 text-orange-700 border-orange-300',   border:'border-orange-500',  optHover:'hover:bg-orange-50 hover:border-orange-300',   optSel:['bg-orange-100','border-orange-500','text-orange-800'],   shadow:'shadow-orange-100' },
    teal:    { text:'text-teal-600',    textDark:'text-teal-700',    hover:'hover:text-teal-500',    bg:'bg-teal-600',    bgHover:'hover:bg-teal-700',    soft:'bg-teal-50',    softText:'text-teal-700',    softHover:'hover:bg-teal-600',    chip:'bg-teal-100 text-teal-700 border-teal-300',       border:'border-teal-500',    optHover:'hover:bg-teal-50 hover:border-teal-300',       optSel:['bg-teal-100','border-teal-500','text-teal-800'],       shadow:'shadow-teal-100' }
  };
  var MAIN = PALETTE[C.color] || PALETTE.pink;   // 全站主色（登入頁、測驗頁、通關卡）
  function pal(name) { return PALETTE[name] || MAIN; }

  /* ===================================================================
     1. 樣式：版型的一部分，跟著引擎走，不放在各頁
     =================================================================== */
  var STYLE = ''
    + "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');"
    + "body{font-family:'Noto Sans TC',sans-serif;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);min-height:100vh}"
    + ".glass-card{background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-radius:1.5rem;box-shadow:0 15px 35px rgba(0,0,0,.1)}"
    + ".pass-card{background:#fff;border:4px solid #3b82f6;position:relative;overflow:hidden}"
    + ".pass-card::before{content:'PASSED';position:absolute;top:30px;right:-40px;transform:rotate(45deg);background:#10b981;color:#fff;padding:8px 50px;font-weight:900;font-size:1rem;box-shadow:0 4px 6px rgba(0,0,0,.1);z-index:10}"
    + ".study-note-box{background:#fffdf5;border-left:6px solid #f59e0b}"
    /* ── 失焦遮罩與浮水印 ───────────────────────────────────
       ⚠️ 先說清楚它**不能**做什麼：
         · PrintScreen 由作業系統直接複製畫面，網頁收不到任何事件
         · Win+Shift+S 是**先把畫面凍結成圖**才顯示選取介面 ——
           等瀏覽器收到失焦事件，那張圖早就拍好了
         ⇒ 這兩樣**擋不住瞬間截圖**。網路上教的「偵測 PrintScreen 就遮住」
           在 Win+Shift+S 面前是無效的，不要以為裝了就安全。
       ★ 它們真正擋到的是：
         · 遮罩：「一邊開著題目、一邊在旁邊視窗跟 AI 打字問答」——
           切走題目就沒了，要切回來重看
         · 浮水印：截圖會連班級座號一起拍進去（嚇阻＋可追溯）
       ⚠️ 浮水印一定要 pointer-events:none —— 不然它會吃掉選項的點擊，
          那就從「防作弊」變成「這題點不下去」。 */
    + ".qz-mark{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden;"
    +   "display:flex;align-items:center;justify-content:center;"
    +   "font-weight:900;font-size:clamp(28px,7vw,64px);letter-spacing:.12em;"
    +   "color:rgba(100,116,139,.10);transform:rotate(-22deg);white-space:nowrap;"
    +   "user-select:none;-webkit-user-select:none}"
    + ".qz-veil{position:absolute;inset:0;z-index:20;border-radius:1.5rem;"
    +   "background:rgba(248,250,252,.98);backdrop-filter:blur(6px);"
    +   "display:flex;flex-direction:column;align-items:center;justify-content:center;"
    +   "gap:10px;text-align:center;padding:24px}"
    + ".qz-veil b{font-size:20px;color:#334155}"
    + ".qz-veil span{font-size:14px;color:#64748b;line-height:1.9}"
    + ".study-note-box h4{color:#b45309;font-weight:900;margin-top:1rem;margin-bottom:.5rem;font-size:1.1rem}"
    + ".study-note-box ul{list-style-type:disc;padding-left:1.5rem;margin-bottom:1rem}"
    + ".study-note-box p{margin-bottom:.5rem}"
    + ".study-note-box .sec-head{margin-top:2rem;padding-top:1rem;border-top:2px dashed #fcd34d;color:#92400e;font-weight:900;font-size:1.25rem}"
    + ".study-note-box .sec-head:first-child{margin-top:0;padding-top:0;border-top:0}"
    + "@keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}"
    + ".animate-pop{animation:pop .4s cubic-bezier(.175,.885,.32,1.275) forwards}"
    + ".pdf-link{display:inline-flex;align-items:center;background-color:#ef4444;color:#fff;font-size:.75rem;padding:4px 12px;border-radius:9999px;margin-left:12px;font-weight:700;transition:all .2s;box-shadow:0 2px 4px rgba(239,68,68,.2);text-decoration:none}"
    + ".pdf-link:hover{background-color:#b91c1c;transform:translateY(-2px);box-shadow:0 4px 6px rgba(185,28,28,.3)}"
    + ".hl{background:linear-gradient(transparent 52%,rgba(250,204,21,.65) 52%);font-weight:800}"
    + ".hl-b{background:linear-gradient(transparent 52%,rgba(147,197,253,.7) 52%);font-weight:800}";

  /* ===================================================================
     2. 章節資料整理：把內容資料攤平成引擎好用的形式
     =================================================================== */
  var NODES = {};    // id -> { id, title, notes, questions }
  var ORDER = [];    // 所有可挑戰的 id，順序即畫面順序（用來算「已通關 n / 全部」）

  C.chapters.forEach(function (ch) {
    var secs = ch.sections || [];
    secs.forEach(function (s) {
      NODES[s.id] = { id:s.id, title:s.title, notes:s.notes || '', questions:s.questions || [] };
      ORDER.push(s.id);
    });
    if (ch.challenge) {
      var cg = ch.challenge;
      // 整章挑戰沒給題庫就自動合併小節題庫；沒給教材就自動串接小節教材
      var qs = cg.questions || secs.reduce(function (a, s) { return a.concat(s.questions || []); }, []);
      var nt = cg.notes;
      if (!nt) {
        nt = secs.map(function (s) {
          return '<div class="sec-head">' + s.title + '</div>' + (s.notes || '');
        }).join('');
      }
      NODES[cg.id] = { id:cg.id, title:cg.title || ch.title, notes:nt, questions:qs };
      ORDER.push(cg.id);
    }
  });

  /* ===================================================================
     3. 版型：整個畫面由這裡產生，兩個學期共用同一份
     =================================================================== */
  function chapterCard(ch) {
    var p = pal(ch.color);
    var secs = ch.sections || [];
    var cg = ch.challenge;
    var html = '<div class="p-5 border-2 border-slate-50 rounded-2xl bg-white shadow-sm hover:shadow-md transition">';

    // 大標題（本身就是整章測驗的入口）
    if (cg && cg.style !== 'block') {
      html += '<div class="flex justify-between items-start mb-4"><div class="flex flex-wrap items-center">'
           +    '<button data-ch="' + cg.id + '" class="qz-open text-xl font-black ' + p.textDark
           +    ' text-left ' + p.hover + ' hover:underline transition flex items-center cursor-pointer">'
           +    ch.title
           +    '<span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ' + p.chip + '">'
           +    (cg.label || '🎯 點我挑戰整章測驗') + '</span></button>'
           +    (ch.pdf ? '<a href="' + ch.pdf + '" target="_blank" class="pdf-link">課本教材 PDF</a>' : '')
           +  '</div></div>';
    } else {
      html += '<div class="flex justify-between items-start mb-4"><div class="flex flex-wrap items-center">'
           +    '<h3 class="text-xl font-black ' + p.textDark + '">' + ch.title + '</h3>'
           +    (ch.pdf ? '<a href="' + ch.pdf + '" target="_blank" class="pdf-link">課本教材 PDF</a>' : '')
           +  '</div></div>';
    }

    // 小節按鈕：一律兩欄起跳，桌機最多三欄（版型固定，不由內容決定）
    if (secs.length) {
      html += '<div class="grid grid-cols-2 md:grid-cols-3 gap-3">';
      secs.forEach(function (s) {
        html += '<button data-ch="' + s.id + '" class="qz-open py-2 ' + p.soft + ' ' + p.softText
             +  ' rounded-lg font-bold text-xs ' + p.softHover + ' hover:text-white transition">' + s.title + '</button>';
      });
      html += '</div>';
    }

    // 沒有小節、只有一顆大按鈕的章節（例如總整理與綜合測驗）
    if (cg && cg.style === 'block') {
      html += '<button data-ch="' + cg.id + '" class="qz-open w-full py-3 ' + p.soft + ' ' + p.softText
           +  ' rounded-lg font-bold text-sm ' + p.softHover + ' hover:text-white transition">'
           +  (cg.label || '開始挑戰') + '</button>';
    }
    return html + '</div>';
  }

  function render() {
    var s = document.createElement('style'); s.textContent = STYLE; document.head.appendChild(s);
    if (C.siteTitle) document.title = C.siteTitle;
    document.body.className = 'p-2 sm:p-4 text-slate-800 ac-theme-bg';

    var html = ''

    + '<div id="app" class="w-full max-w-[96vw] xl:max-w-[1680px] mx-auto">'

    // 1. 身分確認
    +   '<div id="login-screen" class="glass-card p-10 max-w-md mx-auto mt-8 text-center">'
    +     '<span class="' + MAIN.text + ' font-bold tracking-widest uppercase text-sm">' + (C.schoolLine || '') + '</span>'
    +     '<h1 class="text-3xl font-black text-slate-800 mt-2 leading-tight">' + (C.headline || '') + '</h1>'
    +     '<p id="sso-msg" class="mt-8 text-slate-500 font-bold">正在從闖關基地確認身分…</p>'
    +   '</div>'

    // 2. 章節選擇（動森島嶼探險 ＋ 清單雙模式）
    +   '<div id="chapter-screen" class="hidden animate-pop">'
    +     '<div class="ac-hud mb-5">'
    +       '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">'
    +         '<div>'
    +           '<h2 id="welcome-info" class="text-xs font-extrabold text-amber-800 mb-0.5"></h2>'
    +           '<h2 class="text-xl sm:text-2xl font-black text-amber-950">⚖️ 資訊倫理 · 法治森林村落</h2>'
    +           '<p id="chapter-progress" class="mt-1 text-xs sm:text-sm font-bold text-stone-600">讀取進度中…</p>'
    +         '</div>'
    +         '<div class="flex items-center gap-2 flex-wrap">'
    +           C.chapters.map(function (ch) {
                  return ch.pdf ? '<a href="' + ch.pdf + '" target="_blank" class="pdf-link">📄 ' + ch.title.split('：')[0] + ' 教材 PDF</a>' : '';
                }).join('')
    +           '<div class="inline-flex rounded-full bg-amber-100/80 p-1 border-2 border-amber-200">'
    +             '<button type="button" data-qz-view="island" class="qz-view-btn px-3 py-1 rounded-full text-xs font-black transition bg-emerald-500 text-white shadow">🏝️ 島嶼探險</button>'
    +             '<button type="button" data-qz-view="list" class="qz-view-btn px-3 py-1 rounded-full text-xs font-black transition text-stone-600 hover:text-stone-900">📋 章節清單</button>'
    +           '</div>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div id="qz-island-mount" class="mb-6"></div>'
    +     '<div id="qz-list-wrap" class="glass-card p-8 max-w-2xl mx-auto hidden">'
    +       '<p class="mb-4 text-xs text-slate-400 text-center leading-relaxed">💡 小提示：<span class="hl">章節大標題也是測驗</span>，點下去可一次挑戰整章；下方小方塊則是單一小節的測驗。</p>'
    +       '<div class="space-y-6">' + C.chapters.map(chapterCard).join('') + '</div>'
    /* 🧠 記憶補給站：放在最後一章（總整理）下方，要一眼看得到 */
    +       (PRACTICE
            ? '<div id="qz-practice" class="mt-6 p-5 rounded-2xl border-4 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 shadow-md">'
              +   '<div class="flex items-center gap-3 mb-2">'
              +     '<span class="text-4xl" aria-hidden="true">🧠</span>'
              +     '<div><div class="text-xl font-black text-amber-800">' + PRACTICE.label.replace(/^🧠\s*/, '')
              +       ' <span class="ml-1 align-middle text-[11px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">複習用</span></div>'
              +     '<div class="text-xs font-bold text-amber-700 leading-relaxed">從你<b>已通關的章節</b>出 ' + PRACTICE.size
              +       ' 題：答錯過的先出（最多 ' + PRACTICE.weak + ' 題），其餘隨機・每題公布正解・不計分</div></div>'
              +   '</div>'
              +   '<button id="qz-practice-go" disabled class="w-full mt-2 py-3 rounded-xl font-black text-lg transition '
              +     'bg-amber-400 text-amber-950 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">'
              +     '🔒 通關任一章節後開放</button>'
              + '</div>'
            : '')
    +     '</div>'
    +   '</div>'

    // 3. 章節重點閱讀（浮動在 3D 果園島嶼上方的主題木框視窗）
    +   '<div id="study-screen" class="ac-float-backdrop hidden">'
    +     '<div class="ac-float-window theme-orchard p-8 max-w-2xl mx-auto animate-pop">'
    +       '<div class="ac-window-badge">🍎 豐收果園 · 園丁筆記</div>'
    +       '<h2 id="study-title" class="text-2xl font-black text-amber-950 mb-6 border-b-4 border-amber-500 pb-2 inline-block">章節重點</h2>'
    +       '<div id="study-content" class="study-note-box p-6 mb-8 text-slate-700 leading-relaxed space-y-4 text-lg max-h-[58vh] overflow-y-auto"></div>'
    +       '<div class="flex space-x-4">'
    +         '<button id="back-chapters-btn" class="flex-1 py-4 bg-amber-100 text-amber-900 border-2 border-amber-300 font-bold rounded-2xl hover:bg-amber-200 transition">返回目錄 (Esc)</button>'
    +         '<button id="start-quiz-btn" class="flex-2 px-10 py-4 ' + MAIN.bg + ' text-white font-black rounded-2xl ' + MAIN.bgHover + ' shadow-lg ' + MAIN.shadow + ' transition transform active:scale-95">開始測驗挑戰</button>'
    +       '</div>'
    +     '</div>'
    +   '</div>'

    // 4. 測驗（浮動在 3D 果園島嶼上方的主題木框視窗）
    +   '<div id="quiz-screen" class="ac-float-backdrop hidden">'
    +     '<div class="ac-float-window theme-orchard p-8 max-w-2xl mx-auto animate-pop relative">'
    +       '<div class="ac-window-badge">🍎 豐收果園 · 採收挑戰</div>'
    +       '<div class="flex justify-between items-center mb-8 border-b-2 border-amber-200 pb-6 gap-2">'
    +         '<div class="max-w-[68%]">'
    +           '<div id="current-chapter-title" class="' + MAIN.text + ' font-black text-xl leading-tight"></div>'
    +           '<div class="flex items-center flex-wrap gap-2 mt-2">'
    +             '<span id="score-counter" class="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-black shadow-sm">連對: 0 / ' + TARGET + '</span>'
    +             '<span id="target-counter" class="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full font-bold border border-amber-300">目標連對: ' + TARGET + '</span>'
    +             '<span id="wrong-counter" class="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-bold shadow-sm">容錯: ' + MAX_WRONG + '</span>'
    +           '</div>'
    +         '</div>'
    +         '<div class="flex items-center gap-2 shrink-0">'
    +           '<div id="timer" class="text-red-500 font-mono font-black text-2xl bg-red-50 px-4 py-1 rounded-xl border-2 border-red-200">00:00</div>'
    +           '<button id="quiz-top-close-btn" type="button" title="中斷測驗並返回島嶼目錄 (Esc)" class="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border-2 border-amber-300 text-xs font-black transition cursor-pointer">✕ 離開 (Esc)</button>'
    +         '</div>'
    +       '</div>'
    +       '<div id="question-container" class="min-h-[300px]"></div>'
    /* 浮水印與遮罩都掛在 quiz-screen 裡（它是 position:relative） */
    +       '<div id="qz-mark" class="qz-mark"></div>'
    +       '<div class="mt-10 flex flex-wrap items-center justify-between gap-3">'
    +         '<div class="flex items-center gap-2">'
    +           '<button id="quiz-quit-btn" type="button" class="px-4 py-3.5 bg-amber-100 text-amber-900 border-2 border-amber-300 font-black text-sm rounded-2xl hover:bg-amber-200 transition cursor-pointer">🏝️ 返回島嶼目錄</button>'
    +           '<button id="quiz-back-study-btn" type="button" class="px-4 py-3.5 bg-slate-100 text-slate-700 border-2 border-slate-300 font-bold text-sm rounded-2xl hover:bg-slate-200 transition cursor-pointer">📖 重讀重點</button>'
    +         '</div>'
    +         '<button id="next-btn" class="px-10 py-4 ' + MAIN.bg + ' text-white font-black rounded-2xl shadow-xl ' + MAIN.bgHover + ' transition transform active:scale-95 cursor-pointer">送出答案</button>'
    +       '</div>'
    +     '</div>'
    +   '</div>'

    // 5. 通關卡（浮動在 3D 果園島嶼上方）
    +   '<div id="result-screen" class="ac-float-backdrop hidden">'
    +     '<div class="ac-float-window theme-orchard p-6 sm:p-8 max-w-2xl mx-auto animate-pop">'
    +       '<div class="ac-window-badge">🏆 豐收果園 · 榮譽收成證書</div>'
    +       '<div class="pass-card rounded-[2rem] p-8 shadow-2xl">'
    +         '<div class="text-center mb-6">'
    +           '<h2 class="text-4xl font-black ' + MAIN.text + ' italic underline tracking-tighter uppercase">QUIZ PASS CARD</h2>'
    +           '<p class="text-[10px] text-slate-400 font-bold tracking-[0.3em] mt-1">INFORMATION TECHNOLOGY LEARNING SYSTEM</p>'
    +         '</div>'
    +         '<div class="bg-slate-50/50 border-y-4 border-double border-slate-100 rounded-xl p-6 mb-6">'
    +           '<div class="flex justify-around items-center mb-4">'
    +             '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">Class</span><span id="res-class" class="text-2xl font-black text-slate-800"></span></div>'
    +             '<div class="h-8 w-[2px] bg-slate-200"></div>'
    +             '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">No.</span><span id="res-no" class="text-2xl font-black text-slate-800"></span></div>'
    +             '<div class="h-8 w-[2px] bg-slate-200"></div>'
    +             '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">Name</span><span id="res-name" class="text-2xl font-black text-slate-800"></span></div>'
    +           '</div>'
    +           '<div class="text-center pt-2 border-t border-slate-100"><span class="text-[10px] text-slate-400 font-black uppercase mr-2">Challenge Date:</span><span id="res-date" class="text-sm font-bold text-slate-600 tracking-widest"></span></div>'
    +         '</div>'
    +         '<div class="space-y-4 mb-8">'
    +           '<div class="bg-slate-50 p-5 rounded-2xl border border-slate-100"><span class="text-[10px] text-slate-400 font-black uppercase block mb-1">Completed Chapter</span><span id="res-chapter" class="font-black ' + MAIN.textDark + ' text-lg leading-tight"></span></div>'
    +           '<div class="grid grid-cols-2 gap-4">'
    +             '<div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center"><span class="text-[10px] text-slate-400 font-black block mb-1">DURATION</span><span id="res-duration" class="font-black text-orange-600 text-lg"></span></div>'
    +             '<div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center"><span class="text-[10px] text-slate-400 font-black block mb-1">ACCURACY</span><span id="res-rate" class="font-black text-green-600 text-lg">0%</span></div>'
    +           '</div>'
    +         '</div>'
    +         '<div class="grid grid-cols-2 gap-4 text-center mb-8">'
    +           '<div><div class="text-[10px] text-slate-400 font-bold">CORRECT</div><div id="res-correct" class="text-2xl font-black text-green-500">0</div></div>'
    +           '<div><div class="text-[10px] text-slate-400 font-bold">TOTAL Q.</div><div id="res-total" class="text-2xl font-black text-slate-800">0</div></div>'
    +         '</div>'
    +         '<p id="pass-msg" class="text-center text-sm text-slate-400 mb-8 italic font-bold"></p>'
    +         '<button id="cert-return-btn" class="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-black transition transform active:scale-95">完成挑戰</button>'
    +       '</div>'
    +     '</div>'
    +   '</div>'

    // 5-2. 記憶補給站的結果（不計分、不是通關卡）
    +   (PRACTICE
        ? '<div id="practice-screen" class="ac-float-backdrop hidden">'
          + '<div class="ac-float-window theme-orchard p-8 max-w-2xl mx-auto animate-pop">'
          +   '<div class="ac-window-badge">🌱 陽光溫室 · 記憶栽培報告</div>'
          +   '<h2 class="text-2xl font-black text-amber-600 mb-1">' + PRACTICE.label + '</h2>'
          +   '<p id="prac-chapter" class="text-sm font-bold text-slate-500 mb-6"></p>'
          +   '<div class="text-center mb-6"><span id="prac-score" class="text-5xl font-black text-slate-800"></span>'
          +     '<p id="prac-msg" class="mt-2 font-bold text-slate-500"></p></div>'
          +   '<div id="prac-review" class="space-y-3 mb-8 max-h-[45vh] overflow-y-auto pr-1"></div>'
          +   '<div class="flex gap-3">'
          +     '<button id="prac-back" class="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">返回目錄</button>'
          +     '<button id="prac-again" class="flex-1 py-4 bg-amber-400 text-amber-950 font-black rounded-xl hover:bg-amber-500 transition">再補給一次</button>'
          +   '</div>'
          + '</div>'
          + '</div>'
        : '')

    // 6. 學習狀態警示單
    +   '<div id="warning-screen" class="ac-float-backdrop hidden">'
    +     '<div class="ac-float-window theme-orchard p-6 sm:p-8 max-w-2xl mx-auto animate-pop">'
    +       '<div class="ac-window-badge">⚠️ 豐收果園 · 學習狀態提醒</div>'
    +       '<div class="bg-white border-4 border-red-500 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">'
    +         '<div class="absolute top-0 left-0 w-full h-4 bg-red-500"></div>'
    +         '<div class="text-center mb-6 mt-4"><h2 class="text-4xl font-black text-red-600 italic tracking-tighter uppercase">LEARNING WARNING</h2><p class="text-xs text-red-400 font-bold tracking-[0.2em] mt-2">學習狀態警示單</p></div>'
    +         '<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-center mb-8">'
    +           '<div class="text-6xl mb-4">⚠️</div>'
    +           '<h3 class="text-2xl font-black text-slate-800 mb-3">累積答錯已達 ' + MAX_WRONG + ' 題！</h3>'
    +           '<p class="text-slate-600 font-bold leading-relaxed text-lg">看來學習遇到了一點小瓶頸呢。<br>請先暫停測驗，<span class="text-red-600 underline">重新閱讀課本</span>或<span class="text-red-600 underline">仔細查看重點整理</span>後，準備好再來挑戰吧！</p>'
    +         '</div>'
    +         '<button id="warn-back-btn" class="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-red-700 transition transform active:scale-95">返回閱讀重點</button>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'

    // 提示框
    + '<div id="modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center p-4 z-[80] backdrop-blur-sm">'
    +   '<div class="ac-float-window theme-orchard p-8 max-w-sm w-full">'
    +     '<div class="ac-window-badge">🍎 豐收果園 · 島嶼提示</div>'
    +     '<h3 id="modal-title" class="text-2xl font-black mb-4 ' + MAIN.text + '">提示</h3>'
    +     '<p id="modal-msg" class="text-slate-600 font-bold mb-8 text-lg"></p>'
    +     '<div class="flex justify-end"><button id="modal-ok" class="w-full py-3 ' + MAIN.bg + ' text-white rounded-xl font-black ' + MAIN.bgHover + ' transition">我知道了</button></div>'
    +   '</div>'
    + '</div>'

    // 闖關紀錄
    + '<div id="action-modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center p-4 z-[80] backdrop-blur-sm">'
    +   '<div class="ac-float-window theme-orchard p-8 max-w-md w-full">'
    +     '<div class="ac-window-badge">🍎 豐收果園 · 採收成果籃</div>'
    +     '<h3 class="text-2xl font-black mb-2 text-emerald-600">過關紀錄查詢</h3>'
    +     '<p class="text-slate-600 font-bold mb-6 text-sm">你已經通過這個章節了，這是你的輝煌紀錄！</p>'
    +     '<div id="history-list" class="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2"></div>'
    +     '<div class="flex space-x-3">'
    +       '<button id="hist-close" class="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-black hover:bg-slate-300 transition shadow-sm">返回目錄</button>'
    +       '<button id="hist-again" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition shadow-sm">再次闖關</button>'
    +     '</div>'
    +   '</div>'
    + '</div>';

    // ⚠️ 用「附加容器」而不是覆寫 body.innerHTML：
    //    覆寫會把後面還沒執行的 <script type="module"> 一起清掉，資料庫就接不上了。
    var root = document.createElement('div');
    root.id = 'qz-root';
    root.innerHTML = html;
    document.body.appendChild(root);
  }

  /* ===================================================================
     4. 狀態
     =================================================================== */
  var user = { cls:'', no:'', name:'' };
  var currentId = '';
  var pool = [], current = null, streak = 0, score = 0, wrong = 0, picked = -1;
  /* 這一次挑戰的逐題紀錄 { 題id: {n, ok} }。挑戰結束才寫出去，見 saveStat()。 */
  var runStat = {};
  /* 'quiz'＝正式挑戰（計分、回報）；'practice'＝記憶補給站（不計分、不回報、不進題目統計） */
  var mode = 'quiz', prac = null;
  var timer = null, seconds = 0;
  // 闖關紀錄直接讀 progress 文件的 history
  var recent = [];           // 目前章節最近幾次的紀錄，由新到舊
  var identified = false;

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { $(id).classList.remove('hidden'); };
  var hide = function (id) { $(id).classList.add('hidden'); };

  function showModal(title, msg) {
    $('modal-title').textContent = title; $('modal-msg').textContent = msg;
    $('modal').classList.remove('hidden'); $('modal').classList.add('flex');
  }

  /* ===================================================================
     5. 畫面流程
     =================================================================== */
  var lastUnitsMap = {};
  var qzViewMode = 'island';

  function mountQuizIsland(units) {
    lastUnitsMap = units || lastUnitsMap || {};
    var mountEl = $('qz-island-mount');
    var listEl  = $('qz-list-wrap');
    if (!mountEl || !listEl) return;

    document.querySelectorAll('.qz-view-btn').forEach(function (b) {
      var on = b.getAttribute('data-qz-view') === qzViewMode;
      b.className = 'qz-view-btn px-3 py-1 rounded-full text-xs font-black transition '
        + (on ? 'bg-emerald-500 text-white shadow' : 'text-stone-600 hover:text-stone-900');
    });

    if (qzViewMode === 'list' || !window.AC_ISLAND) {
      mountEl.classList.add('hidden');
      listEl.classList.remove('hidden');
      return;
    }
    mountEl.classList.remove('hidden');
    listEl.classList.add('hidden');

    // 上下學期章節在島上的座標與「豐收果園 × 玻璃溫室」主題 3D 模型
    var layout = {
      // 11501 上學期（資訊倫理與安全）
      '1-1':        { x: 22, y: 66, kind: 'orchard-apple',       icon: '🍎', shortTitle: '1-1 網路禮儀' },
      '1-2':        { x: 36, y: 55, kind: 'orchard-peach',       icon: '🍑', shortTitle: '1-2 資訊倫理' },
      '1-3':        { x: 24, y: 40, kind: 'orchard-orange',      icon: '🍊', shortTitle: '1-3 著作權法' },
      '1-4':        { x: 40, y: 34, kind: 'orchard-pear',        icon: '🍐', shortTitle: '1-4 個資保護' },
      'ch1-all':    { x: 32, y: 20, kind: 'orchard-barn',        icon: '🏡', shortTitle: '第1章 豐收穀倉' },
      '3-1':        { x: 64, y: 56, kind: 'orchard-cherry',      icon: '🍒', shortTitle: '3-1 資訊安全' },
      '3-2':        { x: 78, y: 64, kind: 'orchard-apple',       icon: '🍎', shortTitle: '3-2 網路犯罪' },
      '3-3':        { x: 76, y: 39, kind: 'orchard-peach',       icon: '🍑', shortTitle: '3-3 媒體素養' },
      'ch3-all':    { x: 68, y: 20, kind: 'orchard-mill',        icon: '🧃', shortTitle: '第3章 風車果坊' },
      'review-all': { x: 50, y: 18, kind: 'orchard-golden-tree', icon: '🌟', shortTitle: '黃金神木總測驗' },
      // 11502 下學期（媒體與社會議題・基本演算法）
      '5-1':        { x: 20, y: 66, kind: 'orchard-apple',       icon: '🍎', shortTitle: '5-1 媒體與科技' },
      '5-2':        { x: 35, y: 56, kind: 'orchard-peach',       icon: '🍑', shortTitle: '5-2 資訊失序' },
      '5-3':        { x: 22, y: 42, kind: 'orchard-orange',      icon: '🍊', shortTitle: '5-3 言論自由' },
      '5-4':        { x: 38, y: 36, kind: 'orchard-pear',        icon: '🍐', shortTitle: '5-4 網路霸凌' },
      '5-5':        { x: 26, y: 24, kind: 'orchard-cherry',      icon: '🍒', shortTitle: '5-5 網路成癮' },
      '5-all':      { x: 42, y: 20, kind: 'orchard-barn',        icon: '🏡', shortTitle: '第5章 豐收穀倉' },
      '6-1':        { x: 64, y: 56, kind: 'orchard-apple',       icon: '🍎', shortTitle: '6-1 演算法概念' },
      '6-2':        { x: 78, y: 64, kind: 'orchard-peach',       icon: '🍑', shortTitle: '6-2 排序原理' },
      '6-3':        { x: 76, y: 39, kind: 'orchard-orange',      icon: '🍊', shortTitle: '6-3 搜尋原理' },
      '6-all':      { x: 68, y: 20, kind: 'orchard-mill',        icon: '🧃', shortTitle: '第6章 風車果坊' }
    };

    var firstUnpassed = ORDER.find(function (id) { return !lastUnitsMap[id] || !(lastUnitsMap[id].star > 0); });
    var islandNodes = ORDER.map(function (id, idx) {
      var n = NODES[id] || { id: id, title: id };
      var u = lastUnitsMap[id] || {};
      var star = Number(u.star) || 0;
      var lay = layout[id] || { x: 20 + (idx % 5) * 15, y: 30 + Math.floor(idx / 5) * 28, kind: 'orchard-apple', icon: '🍎', shortTitle: n.title };
      var isNext = firstUnpassed === id;
      return {
        id: id,
        x: lay.x,
        y: lay.y,
        kind: lay.kind,
        icon: lay.icon,
        tag: id === 'review-all' ? '傳說黃金果樹' : (id.indexOf('all') >= 0 ? '整章豐收驗收' : '果園章節果樹'),
        title: n.title,
        shortTitle: lay.shortTitle,
        desc: star > 0 ? ('已採收通關獲得 ' + '★'.repeat(star) + '（最高分 ' + (u.score || 100) + '%）・點擊可檢視證書或再次挑戰') : '走近搖晃果樹！先讀章節重點，再進行連對 ' + TARGET + ' 題採收挑戰！',
        pass: star > 0,
        starsText: star > 0 ? '★'.repeat(star) : '',
        statusLabel: star > 0 ? '已通關' : '待挑戰',
        flagText: isNext ? '👉 推薦挑戰' : '',
        flagKind: isNext ? 'next' : '',
        locked: false,
        actions: [{ label: star > 0 ? '查看紀錄 / 再挑戰 →' : '閱讀重點並挑戰 →', primary: true, onClick: function () { openChapter(id); } }]
      };
    });

    if (PRACTICE) {
      var canPrac = passedIds.length > 0;
      islandNodes.push({
        id: 'qz-practice-node',
        x: 52,
        y: 52,
        kind: 'orchard-greenhouse',
        icon: '🌱',
        tag: '陽光玻璃溫室',
        title: PRACTICE.label,
        shortTitle: '記憶補給溫室',
        desc: '從你已通關的果樹章節抽選 ' + PRACTICE.size + ' 題練習（答錯過的優先栽培複習、當場公布正解、不計分）',
        pass: canPrac,
        starsText: canPrac ? ('已解鎖 ' + passedIds.length + ' 章') : '',
        statusLabel: canPrac ? '可複習' : '未開放',
        locked: !canPrac,
        lockReason: '通關任一章節後開放',
        actions: [{ label: '開始記憶補給 🧠', primary: true, onClick: function () { startPractice(); } }]
      });
    }

    var startId  = firstUnpassed || ORDER[0];
    var startLay = layout[startId] || { x: 22, y: 66 };
    var sig = qzViewMode + '|' + (user.name || '') + '|' + ORDER.map(function (id) {
      return id + ':' + ((lastUnitsMap[id] && lastUnitsMap[id].star) || 0);
    }).join(',');
    if (mountEl.dataset.mountedSig === sig && mountEl.children.length > 0) return;
    mountEl.dataset.mountedSig = sig;

    window.AC_ISLAND.mount(mountEl, {
      pageId: 'ethics_' + C.moduleId + '_' + ((window.CONFIG && window.CONFIG.TERM) || '11501'),
      variant: 'ethics',
      playerName: user.name || '島民',
      startX: startLay.x,
      startY: Math.min(82, startLay.y + 4),
      initialSelectedId: startId,
      onOpen: function (node) {
        if (!node) return;
        if (node.id === 'qz-practice-node') startPractice();
        else openChapter(node.id);
      },
      nodes: islandNodes
    });
  }

  function enterChapters() {
    hide('login-screen'); show('chapter-screen');
    $('welcome-info').textContent = user.cls + '班 ' + user.no + '號 ' + user.name + '，歡迎登島';
    mountQuizIsland(lastUnitsMap);
    setTimeout(paintBadges, 300);
  }

  function openChapter(id) {
    currentId = id;

    // 尚未通關的章節或沒接上進度模組時，0 延遲直接開啟重點閱讀與測驗視窗，不擋學生
    var u = lastUnitsMap && lastUnitsMap[id];
    var hasPass = u && Number(u.star) > 0;
    if (!hasPass || !window.REPORT) { proceedToStudy(id); return; }

    var done = false;
    var timerId = setTimeout(function () {
      if (done) return;
      done = true;
      proceedToStudy(id);
    }, 900);

    window.REPORT.history(C.moduleId, id).then(function (list) {
      if (done) return;
      done = true;
      clearTimeout(timerId);
      recent = (list || []).slice(0, KEEP);
      if (!recent.length) { proceedToStudy(id); return; }

      $('history-list').innerHTML = recent.map(function (h, i) {
        var d = new Date(h.at).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        return '<div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-3 shadow-sm flex justify-between items-center gap-2">'
             +   '<div><div class="text-xs text-slate-400 font-black mb-1 tracking-wider uppercase">History ' + (i+1) + ' &bull; ' + d + '</div>'
             +   '<div class="flex items-center gap-3 mt-1"><span class="text-emerald-700 font-black text-sm md:text-lg">正確率: ' + (h.score || 0) + '%</span>'
             +   '<span class="text-orange-500 font-bold bg-white px-2 py-1 rounded-md text-xs md:text-sm border border-orange-100">耗時: ' + (h.duration || '—') + '</span></div></div>'
             +   '<button data-rec="' + i + '" class="qz-cert shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-lg transition shadow-sm">檢視證書</button>'
             + '</div>';
      }).join('');
      $('action-modal').classList.remove('hidden'); $('action-modal').classList.add('flex');
    }).catch(function (e) {
      if (done) return;
      done = true;
      clearTimeout(timerId);
      console.error('讀取闖關紀錄失敗', e);
      proceedToStudy(id);
    });
  }

  function proceedToStudy(id) {
    var n = NODES[id || currentId];
    $('study-title').textContent = n ? n.title : '建置中';
    $('study-content').innerHTML = n && n.notes ? n.notes : '內容尚未建置';
    // ★ 保留 chapter-screen（3D 果園島嶼）在背景持續運轉，直接彈出浮動視窗！
    show('study-screen');
  }

  function closeActionModal() {
    $('action-modal').classList.remove('flex'); $('action-modal').classList.add('hidden');
  }

  function viewCertificate(idx) {
    var h = recent[idx];
    if (!h) return;
    closeActionModal();
    // 班級／座號／姓名不必存進每一筆紀錄：這份 progress 文件本來就是這位學生的
    $('res-class').textContent = user.cls; $('res-no').textContent = user.no; $('res-name').textContent = user.name;
    var d = new Date(h.at);
    $('res-date').textContent = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
    $('res-chapter').textContent = (NODES[h.unit] && NODES[h.unit].title) || h.unit;
    $('res-duration').textContent = h.duration || '—';
    $('res-rate').textContent = (h.score || 0) + '%';
    $('res-correct').textContent = (h.correct === undefined ? '—' : h.correct);
    $('res-total').textContent = (h.total === undefined ? '—' : h.total);
    $('pass-msg').textContent = praise(h.correct !== undefined && h.correct === h.total, h.score || 0);
    $('cert-return-btn').textContent = '返回目錄';
    show('result-screen');
  }

  function praise(perfect, rate) {
    if (perfect) return 'PERFECT! 零失誤完美通關！';
    if (rate >= 80) return 'GREAT! 表現出色，順利完成挑戰！';
    return 'GOOD! 雖然有波折，但還是成功達成連對目標！';
  }

  /* ── 測驗 ────────────────────────────────────────────── */
  /* ── 作答過程的紀錄 ───────────────────────────────────
     ⚠️ 這幾個數字**不是作弊判定**，是給老師看的參考。
        · 切出視窗可能只是通知跳出來、切輸入法
        · 秒數快可能是他真的會
        ⇒ 系統**不封鎖、不扣分、不跳警告**，只把它記下來。
          任何「自動抓作弊」的做法都會冤枉到人，而被冤枉一次
          比讓一個人抄到還糟。
     ★ 真正有訊號的是**對照**：整份都 3 秒、只有難題 40 秒，那才值得問一句。 */
  var behav = { t: [], copy: 0, away: 0, swap: 0 };
  var qStart = 0;

  /* ── 離開就換題（config.js 的 QUIZ_SWAP_ON_LEAVE: true 時生效）──────
     沒開的話：只蓋遮罩，點回來繼續同一題。
     ★ 做法：作答中焦點一離開（切分頁、切 App、點網址列的 AI 模式、開 Gemini 側邊欄、
       擷取工具跳出來）⇒ **題目文字立刻從網頁裡拿掉**；回來 ⇒ **換一題**。
       ‧ 拿掉而不只是蓋住：Chrome 的 Gemini「詢問這個網頁」讀的是網頁內容，
         遮罩蓋得住畫面、蓋不住文字。
       ‧ 回來換題：離開時查到的答案（或截下來的圖）對新的這一題沒有用。
     ⚠️ 不扣分、不歸零連對、不算答錯 —— 誤判（跳通知、切輸入法）的代價只是換一題。
        「自動抓作弊」會冤枉人（見上面 behav 那一段），這裡只讓偷查變得沒有用。
     ⚠️ 換掉的那一題放回題庫最後面，不算作答、不進逐題統計。 */
  /* 用的當下才讀 CONFIG（不是載入時） */
  function swapOn() { return !!(window.CONFIG && window.CONFIG.QUIZ_SWAP_ON_LEAVE === true); }
  var swapPending = false;
  function pullQuestion() {
    /* 解釋畫面不收、不換題：那不是題目，而且換題會把解釋直接跳掉。
       離開時由 readhold 暫停倒數、遮罩蓋住畫面（見 showExplain）。 */
    if (explain) return;
    /* 記憶補給站不看 CONFIG，一律「離開就換題」。
       已經公布正解的那一題不必收（答案都看到了，收起來也沒意義）。 */
    var on = swapOn() || mode === 'practice';
    if (!on || !isQuizOn() || !current || swapPending) return;
    if (mode === 'practice' && prac && prac.answered) return;
    swapPending = true;
    behav.swap++;
    var box = document.getElementById('question-container');
    if (box) box.innerHTML = '<p class="text-lg font-bold text-slate-400 py-10 text-center">'
      + '題目先收起來了。回到這個畫面，會換一題新的給你。</p>';
  }
  function swapIfPulled() {
    if (!swapPending) return;
    swapPending = false;
    if (!isQuizOn() || !current) return;
    var old = current;
    if (mode === 'practice') {
      /* 補給站：換成**這一輪沒有的**題目（從備用題拿），一輪還是十題；
         備用題用完了才把原題放回最後面。 */
      if (prac.spare.length) pool.unshift(prac.spare.shift()); else pool.push(old);
      loadQuestion();
      return;
    }
    pool.push(old);                                  // 放回最後面
    if (pool.length === 1) {                         // 題庫只剩它 ⇒ 先出別題
      pool = shuffle(NODES[currentId].questions.filter(function (q) { return q !== old; }))
        .concat([old]);
    }
    loadQuestion();
  }
  /** 回到頁面：收遮罩＋（有需要時）換題 */
  function comeBack() { veil(false); swapIfPulled(); }

  function startQuiz() {
    var n = NODES[currentId];
    if (!n || !n.questions.length) { showModal('題庫建置中', '本小節題庫尚未建置完成，敬請期待！'); return; }
    pool = shuffle(n.questions.slice());
    mode = 'quiz'; prac = null; practiceChrome(false);
    streak = 0; score = 0; wrong = 0; seconds = 0; runStat = {};
    behav = { t: [], copy: 0, away: 0, swap: 0 };
    swapPending = false;
    endExplain();                // 上一輪停在解釋畫面就離開的話，計時器要收掉
    paintMark();                 // 浮水印：班級座號＋時間
    hide('study-screen'); show('quiz-screen');
    $('current-chapter-title').textContent = n.title;
    startTimer(); loadQuestion();
  }

  function shuffle(a) { return a.sort(function () { return 0.5 - Math.random(); }); }

  /* ── 題目不給複製 ─────────────────────────────────────
     ⚠️ 刻意**不用** user-select:none —— 那會讓螢幕朗讀器、翻譯工具、
        放大鏡一起失效，而這一章正好在教「資訊近用權」與「數位包容」。
        ⇒ 改成攔 copy 事件：選取照常（輔具正常），但剪貼簿裡放的是一句話。
     ⚠️ 這擋不掉截圖 —— 現在的 AI 讀得懂截圖，按 Win+Shift+S 只要兩秒。
        它擋的是「最省事的那一條」，不是全部。 */
  function isQuizOn() {
    var el = document.getElementById('quiz-screen');
    return !!el && !el.classList.contains('hidden');
  }
  var CLIP_MSG = '（題目請自己讀 😉 這一份要看的是你想得到什麼）';

  /* ★ 為什麼攔的是 copy 而不是右鍵
     copy 是**出口**：不管走 Ctrl+C、右鍵選單的「複製」、還是編輯選單，
     最後都會經過這個事件。攔它一個，那幾條路一起擋掉。
     ⚠️ 反過來說，攔 contextmenu（右鍵選單）幾乎沒有多擋到什麼 ——
        複製那條路已經擋了，而右鍵選單裡還有「朗讀所選文字」「翻譯」，
        手機的長按選字也是同一個事件。關掉它是把輔具的入口一起關掉。
     ⇒ 不攔右鍵。 */
  document.addEventListener('copy', function (e) {
    if (!isQuizOn()) return;
    behav.copy++;
    try {
      (e.clipboardData || window.clipboardData).setData('text/plain', CLIP_MSG);
      e.preventDefault();
    } catch (err) { /* 瀏覽器不給改剪貼簿就算了，至少數字記到了 */ }
  });
  /* 剪下：題目區沒有可編輯的欄位，理論上不會發生 —— 但成本是一行。 */
  document.addEventListener('cut', function (e) {
    if (!isQuizOn()) return;
    behav.copy++;
    try {
      (e.clipboardData || window.clipboardData).setData('text/plain', CLIP_MSG);
      e.preventDefault();
    } catch (err) {}
  });
  /* 選取文字之後**直接用滑鼠拖進另一個視窗**（例如 AI 的輸入框），
     那是 dragstart，**不會觸發 copy** —— 前面那兩道都攔不到。
     ★ 只擋題目區的文字拖曳；拼圖那邊的積木拖曳在別的頁面，不受影響。 */
  document.addEventListener('dragstart', function (e) {
    if (!isQuizOn()) return;
    var box = document.getElementById('question-container');
    if (box && box.contains(e.target)) { behav.copy++; e.preventDefault(); }
  });
  /* 切出視窗（換分頁、切到別的 App）。同樣只記次數，不做任何處置。 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && isQuizOn()) { behav.away++; veil(true); pullQuestion(); }
    else if (!document.hidden) comeBack();
  });

  /* ── 失焦遮罩 ─────────────────────────────────────────
     ⚠️⚠️ 它**擋不住瞬間截圖**（見上面 CSS 那一段的說明）。
        擋到的是「一邊開著題目、一邊在旁邊的視窗跟 AI 打字」——
        切走題目就被蓋住，要切回來重看。
     ⚠️ 誤判是刻意容忍的：點到工作列、跳出通知、切輸入法都會遮起來。
        代價只有「點回來」一個動作，而反過來（漏掉）就完全沒有效果。
     ★ 遮罩**不擋作答**：它只蓋住畫面，不會清掉選的答案、不會停計時、
       更不會判定作弊。學生點回來就繼續。 */
  function veil(on) {
    var host = document.getElementById('quiz-screen');
    if (!host || host.classList.contains('hidden')) return;
    var winEl = host.querySelector('.ac-float-window') || host;
    var el = document.getElementById('qz-veil');
    if (on) {
      if (el) return;
      el = document.createElement('div');
      el.id = 'qz-veil';
      el.className = 'qz-veil';
      el.innerHTML = '<b>👀 題目先蓋起來了</b>' +
        '<span>你切到別的視窗去了。<br>' +
        '點一下這裡就繼續 —— <b>答案和計時都留著</b>。</span>';
      /* 點遮罩本身也能收起來（有些情況 focus 事件不會來，例如點到別的分頁再回來） */
      el.addEventListener('click', comeBack);
      winEl.appendChild(el);
    } else if (el) {
      el.remove();
    }
  }
  window.addEventListener('blur', function () { if (isQuizOn()) { behav.away++; veil(true); pullQuestion(); } });
  window.addEventListener('focus', comeBack);

  /* ── 浮水印 ───────────────────────────────────────────
     截圖會連它一起拍進去。它不阻止任何事 —— 作用是「這張圖上有我的座號」。
     ⚠️ pointer-events:none 寫在 CSS 裡，這裡不要再加任何會吃掉點擊的東西。 */
  function paintMark() {
    var el = document.getElementById('qz-mark');
    if (!el) return;
    var t = new Date();
    var stamp = String(t.getMonth() + 1) + '/' + t.getDate() + ' ' +
                String(t.getHours()).padStart(2, '0') + ':' +
                String(t.getMinutes()).padStart(2, '0');
    el.textContent = (user.cls || '') + '班 ' + (user.no || '') + '號　' + stamp;
  }

  /** 把每題的秒數濃縮成幾個數字 —— 不存整個陣列（history 有長度上限）

     ★ 光有 med 和 min 分不出人和腳本（例如用瀏覽器外掛自動作答）—— 真的很熟的學生也可能很快。
       **分得出來的是最慢那一題**：
         人　 一定有長尾（某題卡住、回頭重看）→ max 常常十幾二十秒
         腳本 每題都一樣快　　　　　　　　　 → max 和 min 幾乎相同
     ⇒ 「連最慢的一題都在 1 秒內」才是那個訊號，不是「平均很快」。
     ⚠️ 這只是記錄，引擎不會因為它擋任何人 ——
        擋不擋、怎麼處理，是老師看了教師端之後的決定。
     ⚠️ 要裝得像人，腳本得刻意做出隨機長尾；那已經不是
        「隨手裝個外掛」的層次了。這一層擋不死，但拉高了門檻。 */
  function pace() {
    var a = behav.t.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    return { med: a[Math.floor(a.length / 2)], min: a[0],
             max: a[a.length - 1], n: a.length };
  }

  function startTimer() {
    clearInterval(timer); paintTimer();
    timer = setInterval(function () { seconds++; paintTimer(); }, 1000);
  }
  function paintTimer() {
    $('timer').textContent = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
  }

  function loadQuestion() {
    picked = -1;
    if (mode === 'practice') {
      $('score-counter').textContent = '第 ' + (prac.done + 1) + ' / ' + prac.total + ' 題';
      $('wrong-counter').textContent = '答對: ' + prac.right;
      $('next-btn').textContent = '送出答案';
    } else {
      $('score-counter').textContent = '連對: ' + streak + ' / ' + TARGET;
      $('wrong-counter').textContent = '容錯: ' + (MAX_WRONG - wrong);
    }
    if (!pool.length) pool = (mode === 'practice')
      ? (prac.spare.length ? [prac.spare.shift()] : [current])
      : shuffle(NODES[currentId].questions.slice());
    current = pool.shift();

    var opts = current.options.map(function (t, i) { return { text:t, orig:i }; });
    current.shuffled = shuffle(opts);

    var html = '<h3 class="text-xl md:text-2xl font-black mb-6 text-slate-800 leading-relaxed">' + current.q + '</h3><div class="space-y-3">';
    current.shuffled.forEach(function (o, i) {
      html += '<div data-opt="' + i + '" id="opt-' + i + '" class="qz-opt p-4 border-2 border-slate-200 rounded-xl cursor-pointer '
           +  MAIN.optHover + ' transition text-lg font-bold text-slate-700 select-none">' + o.text + '</div>';
    });
    $('question-container').innerHTML = html + '</div>';
    qStart = Date.now();          // ★ 這一題從現在開始計時
    paintMark();                  // 時間會變，每題重畫一次
  }

  function selectOption(i) {
    if (mode === 'practice' && prac && prac.answered) return;   // 已經公布正解
    picked = i;
    document.querySelectorAll('.qz-opt').forEach(function (el, idx) {
      MAIN.optSel.forEach(function (c) { el.classList.remove(c); });
      if (idx === i) MAIN.optSel.forEach(function (c) { el.classList.add(c); });
    });
  }

  /**
   * 這一題答對了沒。
   * 題庫裡沒有明碼答案，只有一段雜湊（a）：對學生選的那個選項算一次雜湊，和 a 比（見 shared/anskey.js）。
   * 自己新增題目時若寫的是明碼 correct（第幾個選項）也照樣能判 —— 但那樣答案會被看到。
   */
  function isRight(item, picked) {
    if (window.ANSKEY && item.a) {
      return window.ANSKEY.check(item.q, item.shuffled[picked].text, item.a);
    }
    return item.shuffled[picked].orig === item.correct;
  }

  /* ── 答錯時的解釋（「想一想」）──────────────────────
     只說「該想到哪個觀念」，不標出正確選項：答錯就重新洗牌，這一題之後還會再遇到 ——
     要讓他那時候是「想得出來」，不是「記得哪個」。
     10 秒閱讀倒數、2 秒後可略過（讀滿 10 秒只是文字變「讀完了」，不會自動跳題）；
     秒數算的是**看著畫面**的時間（shared/readhold.js：離開就暫停、離開太久從頭算、有保險絲）。
     記憶補給站也一樣，只是正解照常公布、提示附在下面。
     沒寫提示的題目直接下一題；沒載到 readhold.js 就不等。 */
  var EXPLAIN_SEC = 10, EXPLAIN_SKIP = 2;
  var explain = null;      // { hold, practice }
  function paintExplain(v) {
    var b = $('next-btn'), t = $('qz-ex-time');
    if (!explain) return;
    var left = v ? v.left : 0;
    var read = EXPLAIN_SEC - left;
    var canSkip = read >= EXPLAIN_SKIP;
    var pr = explain.practice;
    var last = pr && prac && prac.done + 1 >= prac.total;
    if (t) t.textContent =
      !v || left <= 0 ? (pr ? '✅ 讀完了，可以按下一題' : '✅ 讀完了，可以繼續作答') :
      v.state === 'reset' ? '⏸ 離開太久，從頭算（還要 ' + left + ' 秒）' :
      v.state === 'pause' ? '⏸ 已暫停：回到這個畫面才會繼續（還要 ' + left + ' 秒）' :
                            '請先讀一讀這段提示（' + left + ' 秒）';
    if (b) {
      b.disabled = !canSkip;
      b.classList.toggle('opacity-40', !canSkip);
      b.classList.toggle('cursor-not-allowed', !canSkip);
      /* 補給站沿用原本的「下一題／看結果」字樣（正解已經公布，這裡沒有「略過」的意思）。 */
      var go = pr ? (last ? '看結果' : '下一題 →') : (left <= 0 ? '繼續作答 →' : '略過 →');
      var wait = pr ? (last ? '看結果' : '下一題') : '略過';
      b.textContent = canSkip ? go : wait + '（' + (left - (EXPLAIN_SEC - EXPLAIN_SKIP)) + '）';
    }
  }
  function showExplain(item, mineText, hint) {
    endExplain();
    explain = { hold: null };
    /* 計分要當下就更新（平常是 loadQuestion 才更新，而解釋畫面還沒載下一題）—— 
       不然學生會看到「連對 7」停在那裡，以為答錯不算。 */
    $('score-counter').textContent = '連對: ' + streak + ' / ' + TARGET;
    $('wrong-counter').textContent = '容錯: ' + (MAX_WRONG - wrong);
    $('question-container').innerHTML =
        '<div id="qz-explain" class="animate-pop">'
      +   '<p class="text-lg font-black text-rose-600 mb-3">❌ 這題答錯了，先別急著下一題</p>'
      +   '<h3 class="text-lg md:text-xl font-black mb-3 text-slate-800 leading-relaxed">' + item.q + '</h3>'
      +   '<p class="text-sm text-slate-500 mb-4">你選的是：<span class="font-bold text-rose-600 line-through">' + mineText + '</span></p>'
      +   '<div class="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">'
      +     '<div class="text-amber-700 font-black mb-2">💡 想一想</div>'
      +     '<p id="qz-ex-hint" class="text-lg font-bold text-slate-700 leading-relaxed">' + hint + '</p>'
      +   '</div>'
      +   '<p id="qz-ex-time" class="mt-4 text-sm font-bold text-slate-500"></p>'
      + '</div>';
    startExplainHold();
  }
  /** 10 秒倒數（章節測驗和記憶補給站共用）。 */
  function startExplainHold() {
    if (!window.READHOLD) { paintExplain(null); return; }
    explain.hold = window.READHOLD.start({
      sec: EXPLAIN_SEC,
      onTick: function (v) { paintExplain(v); },
      onDone: function () { paintExplain(null); }
    });
  }
  function endExplain() {
    if (explain && explain.hold) explain.hold.stop();
    explain = null;
    var b = $('next-btn');
    if (b) {
      b.disabled = false;
      b.classList.remove('opacity-40', 'cursor-not-allowed');
      b.textContent = '送出答案';
    }
  }
  /** 解釋畫面上按「略過／繼續」。還沒讀滿 EXPLAIN_SKIP（2 秒）就不理（按鈕本來也是灰的）。 */
  function explainNext() {
    var left = explain && explain.hold ? explain.hold.left() : 0;
    if (EXPLAIN_SEC - left < EXPLAIN_SKIP && left > 0) return;
    var pr = explain && explain.practice;
    endExplain();
    if (pr) { practiceStep(); return; }    // 補給站：正解已公布 ⇒ 下一題／看結果
    loadQuestion();
  }

  function checkAnswer() {
    if (explain) { explainNext(); return; }
    if (mode === 'practice') { practiceStep(); return; }
    if (picked === -1) { showModal('尚未作答', '請先選擇一個選項再送出！'); return; }
    /* 這一題想了幾秒（上限 600 —— 中間去上廁所不必記成兩小時） */
    if (qStart) behav.t.push(Math.min(600, Math.round((Date.now() - qStart) / 1000)));
    var right = isRight(current, picked);

    /* ★ 逐題記一筆 ——「這一節下次該重講什麼」只有這個答得出來。
       ⚠️ 只累加在記憶體裡，**不是每答一題就寫 Firestore**。
          一次挑戰要連對 10 題、容錯 20 題，實際上可能作答幾十次；
          每次都寫的話，一堂課三十個人就是上千次寫入，
          而寫入額度是整個專案共用的。挑戰結束才寫一次。
       ⚠️ 沒載到 qstat.js 就跳過，不要讓它擋住答題。 */
    /* 一定要 window. 前綴：這一支的外殼沒有 global 參數 */
    if (window.QSTAT) window.QSTAT.bump(runStat, current.q, right);

    if (right) {
      score++; streak++;
      if (streak >= TARGET) { showResult(); return; }
    } else {
      wrong++; streak = 0;
      pool = shuffle(NODES[currentId].questions.slice());   // 答錯就重新洗牌，避免背題序
      if (wrong >= MAX_WRONG) {
        /* 累積答錯太多 → 學習警示：這一條路也要存統計 —— 答錯 20 題的人正是最需要知道錯在哪的 */
        saveStat();
        clearInterval(timer); hide('quiz-screen'); show('warning-screen'); return;
      }
      var hint = hintFor(current);
      if (hint) { showExplain(current, current.shuffled[picked].text, hint); return; }
    }
    loadQuestion();
  }

  /* ===================================================================
     記憶補給站（通關後的重複練習）
     ★ 每次 PRACTICE.size 題（10）：先出「他自己在這一章答錯過」的題目
       （答對率最低的先），不夠再隨機補滿。資料來源是本來就有的逐題紀錄
       modules.{模組}.qstat —— 不新增任何資料。
     ★ 每題送出後**當場公布正解**，結束列出答錯的題目。
     ⚠️ 不計分、不寫闖關紀錄、不進題目統計（runStat 不累加）——
        重複練習會把答對率灌高，教師端「題目分析」與排行賽每天的難度分級都讀那一份。
     ★ 一律「離開就換題」（見 pullQuestion），換成這一輪沒有的題目。
     =================================================================== */
  /** 挑題：答錯過的**隨機**挑最多 maxWeak 題，其餘從答對過／沒做過的任選；
      沒有錯題就全部任選。回傳 { pick, spare, weak }。
      ⚠️ 錯題是「隨機挑」不是「答對率最低的固定那幾題」：補給站不記錄，
         錯題清單不會因為練習而改變 —— 固定挑的話每一輪都是同樣那 5 題。
      ★ spare（備用題）給「離開就換題」用：先拿非錯題，再拿剩下的錯題。 */
  function pickPractice(qs, mine, size, maxWeak) {
    var weak = [], rest = [], seen = {};
    shuffle(qs.slice()).forEach(function (q) {
      if (!q || !q.q || seen[q.q]) return;          // 整章挑戰合併了小節，題目會重複
      seen[q.q] = 1;
      var e = (mine || {})[window.QSTAT ? window.QSTAT.id(q.q) : ''];
      var n = e ? Number(e.n) || 0 : 0, ok = e ? Number(e.ok) || 0 : 0;
      (n > ok ? weak : rest).push(q);
    });
    var w = weak.slice(0, maxWeak);
    var pick = w.concat(rest.slice(0, size - w.length));
    if (pick.length < size) pick = pick.concat(weak.slice(w.length, w.length + size - pick.length));
    var used = {}; pick.forEach(function (q) { used[q.q] = 1; });
    var spare = rest.concat(weak).filter(function (q) { return !used[q.q]; });
    return { pick: shuffle(pick), spare: spare, weak: w.length };
  }

  /** 已通關章節的題目（去重） */
  function passedQuestions() {
    var out = [];
    passedIds.forEach(function (id) { if (NODES[id]) out = out.concat(NODES[id].questions); });
    return out;
  }

  /** 章節選單底下那張卡：有通關的章節才開 */
  function paintPractice() {
    var b = $('qz-practice-go'); if (!b) return;
    if (passedIds.length) {
      b.disabled = false;
      b.textContent = '開始補給（從已通關的 ' + passedIds.length + ' 個章節出題）';
    } else {
      b.disabled = true;
      b.textContent = '🔒 通關任一章節後開放';
    }
  }

  /** 公布正解的時候按鈕外觀不一樣；正式挑戰要換回來 */
  function practiceChrome(on) {
    ['target-counter', 'timer', 'quiz-back-study-btn'].forEach(function (id) {
      var el = $(id); if (el) el.classList.toggle('hidden', !!on);
    });
    var b = $('next-btn'); if (b) b.textContent = '送出答案';
  }

  /** 中斷目前測驗，返回章節重點或返回 3D 島嶼章節選單 */
  function quitQuiz(toStudy) {
    clearInterval(timer);
    endExplain();
    veil(false);
    swapPending = false;
    if (mode === 'quiz') saveStat();
    var wasQuiz = (mode === 'quiz');
    practiceChrome(false);
    hide('quiz-screen');
    if (toStudy && wasQuiz) {
      show('study-screen');
    } else {
      show('chapter-screen');
      mountQuizIsland(lastUnitsMap);
    }
  }

  function startPractice() {
    endExplain();
    var qs = passedQuestions();
    if (!PRACTICE || !qs.length) return;
    var go = function (mine) {
      var p = pickPractice(qs, mine, PRACTICE.size, PRACTICE.weak);
      mode = 'practice';
      prac = { total: p.pick.length, done: 0, right: 0, wrongs: [], spare: p.spare,
               weak: p.weak, answered: false };
      pool = p.pick;
      behav = { t: [], copy: 0, away: 0, swap: 0 };
      swapPending = false;
      practiceChrome(true);
      ['study-screen', 'result-screen', 'warning-screen', 'practice-screen']
        .forEach(function (id) { if ($(id)) hide(id); });
      show('quiz-screen');
      $('current-chapter-title').textContent = PRACTICE.label + '｜已通關的 ' + passedIds.length + ' 個章節';
      paintMark();
      loadQuestion();
    };
    /* 讀他自己的逐題紀錄；讀不到就全章隨機（不擋練習） */
    if (window.REPORT && window.REPORT.get) {
      window.REPORT.get(C.moduleId).then(function (m) { go((m && m.qstat) || {}); })
        .catch(function () { go({}); });
    } else go({});
  }

  function practiceStep() {
    if (prac.answered) {                       // 已公布正解 ⇒ 下一題／看結果
      prac.answered = false;
      prac.done++;
      if (prac.done >= prac.total) { practiceEnd(); return; }
      loadQuestion();
      return;
    }
    if (picked === -1) { showModal('尚未作答', '請先選擇一個選項再送出！'); return; }
    var right = isRight(current, picked);
    var ans = -1;
    current.shuffled.forEach(function (o, i) { if (ans < 0 && isRight(current, i)) ans = i; });
    prac.answered = true;
    if (right) prac.right++;
    else prac.wrongs.push({ q: current.q, mine: current.shuffled[picked].text,
                            ans: ans >= 0 ? current.shuffled[ans].text : '' });
    document.querySelectorAll('.qz-opt').forEach(function (el, i) {
      MAIN.optSel.forEach(function (c) { el.classList.remove(c); });
      el.classList.add('cursor-default');
      if (i === ans) el.classList.add('bg-emerald-100', 'border-emerald-500', 'text-emerald-800');
      else if (i === picked) el.classList.add('bg-rose-100', 'border-rose-500', 'text-rose-800');
    });
    var fb = document.createElement('p');
    fb.id = 'prac-fb';
    fb.className = 'mt-5 text-lg font-black ' + (right ? 'text-emerald-600' : 'text-rose-600');
    fb.innerHTML = right ? '✅ 答對了！'
      : '❌ 正確答案是：<span class="text-emerald-700">' + (ans >= 0 ? current.shuffled[ans].text : '—') + '</span>';
    $('question-container').appendChild(fb);
    $('wrong-counter').textContent = '答對: ' + prac.right;
    $('next-btn').textContent = (prac.done + 1 >= prac.total) ? '看結果' : '下一題';
    /* 補給站：答錯時把「想一想」也附上（和章節測驗一樣 10 秒閱讀、離開就暫停、2 秒後才能按下一題） */
    var ph = right ? '' : hintFor(current);
    if (ph) {
      var hp = document.createElement('p');
      hp.id = 'prac-hint';
      hp.className = 'mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-base font-bold text-slate-700 leading-relaxed';
      hp.innerHTML = '💡 ' + ph;
      $('question-container').appendChild(hp);
      var tm = document.createElement('p');
      tm.id = 'qz-ex-time';
      tm.className = 'mt-3 text-sm font-bold text-slate-500';
      $('question-container').appendChild(tm);
      endExplain();
      explain = { hold: null, practice: true };
      startExplainHold();
    }
  }

  function practiceEnd() {
    hide('quiz-screen');
    practiceChrome(false);
    $('prac-chapter').textContent = '從已通關的 ' + passedIds.length + ' 個章節出題'
      + (prac.weak ? '（其中 ' + prac.weak + ' 題是你之前答錯過的）' : '（你在這些章節沒有答錯過的題目，全部隨機）');
    $('prac-score').textContent = prac.right + ' / ' + prac.total;
    $('prac-msg').textContent = prac.right === prac.total ? '全部答對！記憶補給完成 💪'
      : (prac.right * 2 >= prac.total ? '不錯！下面這幾題再看一次就更穩了。'
                                       : '這一章值得再讀一次重點，下面是答錯的題目。');
    $('prac-review').innerHTML = prac.wrongs.map(function (w) {
      return '<div class="bg-rose-50 border border-rose-100 rounded-xl p-4">'
           +   '<div class="font-bold text-slate-800 mb-2">' + w.q + '</div>'
           +   '<div class="text-sm text-rose-600">你選的：' + w.mine + '</div>'
           +   '<div class="text-sm text-emerald-700 font-bold">正確答案：' + w.ans + '</div>'
           + '</div>';
    }).join('');
    mode = 'quiz';
    show('practice-screen');
  }

  /** 把這一次挑戰累積的逐題紀錄寫進進度文件（只寫一次） */
  function saveStat() {
    if (!window.QSTAT || !window.REPORT || !Object.keys(runStat).length) return;
    var m = runStat;
    runStat = {};                       // 先清掉，避免重複送出同一批
    window.REPORT.qstat(C.moduleId, m).catch(function (e) {
      /* 統計存不進去不可以影響闖關 —— 它是給老師看的，不是學生的成績。 */
      console.warn('[qstat] 題目統計沒存成功（不影響闖關）', e);
    });
  }

  function showResult() {
    clearInterval(timer);
    hide('quiz-screen'); show('result-screen');

    $('res-class').textContent = user.cls; $('res-no').textContent = user.no; $('res-name').textContent = user.name;
    var t = new Date();
    $('res-date').textContent = t.getFullYear() + '/' + String(t.getMonth()+1).padStart(2,'0') + '/' + String(t.getDate()).padStart(2,'0');
    $('res-chapter').textContent = NODES[currentId].title;

    var dur = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
    var total = score + wrong;
    var rate = Math.round((score / total) * 100);

    $('res-duration').textContent = dur;
    $('res-rate').textContent = rate + '%';
    $('res-correct').textContent = score; $('res-total').textContent = total;
    $('pass-msg').textContent = praise(wrong === 0, rate);
    $('cert-return-btn').textContent = '完成挑戰';

    saveStat();          // ★ 逐題統計：一次挑戰只寫這一次

    // 回報到統一進度（hub 才會亮燈）；星等一律走 GRADING，不在這裡寫死門檻。
    // extra 的欄位只寫進 history，供事後檢視證書與可疑紀錄用。
    if (window.REPORT && window.GRADING) {
      var star = window.GRADING.ethicsStar(rate);
      /* ★ pace／copy／away 是給老師看的參考，不影響星等，也不影響過關。 */
      var extra = { duration: dur, correct: score, total: total,
                    pace: pace(), copy: behav.copy, away: behav.away };
      /* 不可以寫成 swap: undefined（Firestore 遇到 undefined 會整筆拒收）：只有開了換題才加這一格 */
      if (swapOn()) extra.swap = behav.swap;
      window.REPORT.unit(C.moduleId, currentId, {
        star: star, score: rate,
        extra: extra
      }).then(paintBadges)
        .catch(function (e) { console.error('回報進度失敗', e); });
    }
  }

  /* ── 通關標記 ────────────────────────────────────────── */
  function paintBadges() {
    if (!window.REPORT) return Promise.resolve();
    return window.REPORT.get(C.moduleId).then(function (mod) {
      var units = (mod && mod.units) || {}, done = 0;
      passedIds = ORDER.filter(function (id) { return units[id] && (units[id].star || 0) > 0; });
      paintPractice();
      mountQuizIsland(units);
      document.querySelectorAll('.qz-open').forEach(function (btn) {
        var id = btn.getAttribute('data-ch');
        btn.querySelectorAll('.pass-badge').forEach(function (el) { el.remove(); });
        btn.classList.remove('ring-2','ring-emerald-400');
        var u = units[id];
        if (u && (u.star || 0) > 0) {
          done++;
          var badge = document.createElement('span');
          badge.className = 'pass-badge ml-1 whitespace-nowrap text-amber-500 font-black';
          badge.textContent = '✅' + '★'.repeat(u.star);
          btn.appendChild(badge);
          btn.classList.add('ring-2','ring-emerald-400');
        }
      });
      var info = $('chapter-progress');
      if (info) {
        var st = (mod && mod.stars) || 0;
        /* ⚠️ 有星星卻一個章節都對不上 —— 連 history 都救不回來的舊資料。
           這時候**不可以**說「還沒有通關的章節」：那和小卡上的星數互相打臉，
           學生會以為成績不見了。照實說：星數還在，明細找不到。 */
        info.innerHTML = done
          ? '已通關 <span class="hl-b">' + done + '</span> / ' + ORDER.length + ' 個章節，累積 <span class="text-amber-500 font-black">⭐ ' + st + '</span>'
          : (st > 0
             ? '你已經有 <span class="text-amber-500 font-black">⭐ ' + st + '</span>，'
               + '但這些是<b>舊版</b>留下的紀錄，查不到是哪幾章 —— '
               + '<span class="hl">星數不會消失</span>，重做任何一章就會重新標記。'
             : '還沒有通關的章節，挑一個開始吧！');
      }
    }).catch(function (e) { console.error('讀取進度失敗', e); });
  }

  /* ===================================================================
     6. 事件（全部用委派，不在 HTML 裡寫 onclick）
     =================================================================== */
  function bind() {
    document.addEventListener('click', function (e) {
      var vb = e.target.closest('.qz-view-btn');
      if (vb) { qzViewMode = vb.getAttribute('data-qz-view') || 'island'; mountQuizIsland(lastUnitsMap); return; }
      var t = e.target.closest('.qz-open');   if (t) { openChapter(t.getAttribute('data-ch')); return; }
      var c = e.target.closest('.qz-cert');   if (c) { viewCertificate(c.getAttribute('data-rec')); return; }
      var o = e.target.closest('.qz-opt');    if (o) { selectOption(+o.getAttribute('data-opt')); return; }
    });
    $('start-quiz-btn').addEventListener('click', startQuiz);
    $('next-btn').addEventListener('click', checkAnswer);
    $('back-chapters-btn').addEventListener('click', function () { hide('study-screen'); show('chapter-screen'); mountQuizIsland(lastUnitsMap); });
    if ($('quiz-quit-btn')) $('quiz-quit-btn').addEventListener('click', function () { quitQuiz(false); });
    if ($('quiz-top-close-btn')) $('quiz-top-close-btn').addEventListener('click', function () { quitQuiz(false); });
    if ($('quiz-back-study-btn')) $('quiz-back-study-btn').addEventListener('click', function () { quitQuiz(true); });
    $('warn-back-btn').addEventListener('click', function () { hide('warning-screen'); show('study-screen'); });
    $('cert-return-btn').addEventListener('click', function () { hide('result-screen'); show('chapter-screen'); mountQuizIsland(lastUnitsMap); });
    $('modal-ok').addEventListener('click', function () {
      $('modal').classList.remove('flex'); $('modal').classList.add('hidden');
    });
    $('hist-close').addEventListener('click', closeActionModal);
    $('hist-again').addEventListener('click', function () { proceedToStudy(); closeActionModal(); });
    if (PRACTICE) {
      $('qz-practice-go').addEventListener('click', startPractice);
      $('prac-again').addEventListener('click', startPractice);
      $('prac-back').addEventListener('click', function () { hide('practice-screen'); show('chapter-screen'); mountQuizIsland(lastUnitsMap); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.code !== 'Escape') return;
      if ($('modal') && !$('modal').classList.contains('hidden')) {
        e.preventDefault();
        $('modal').classList.remove('flex');
        $('modal').classList.add('hidden');
        return;
      }
      if ($('action-modal') && !$('action-modal').classList.contains('hidden')) {
        e.preventDefault();
        closeActionModal();
        return;
      }
      if ($('quiz-screen') && !$('quiz-screen').classList.contains('hidden')) {
        e.preventDefault();
        quitQuiz(false);
        return;
      }
      if ($('study-screen') && !$('study-screen').classList.contains('hidden')) {
        e.preventDefault();
        hide('study-screen');
        show('chapter-screen');
        mountQuizIsland(lastUnitsMap);
        return;
      }
      if ($('result-screen') && !$('result-screen').classList.contains('hidden')) {
        e.preventDefault();
        hide('result-screen');
        show('chapter-screen');
        mountQuizIsland(lastUnitsMap);
        return;
      }
      if ($('practice-screen') && !$('practice-screen').classList.contains('hidden')) {
        e.preventDefault();
        hide('practice-screen');
        show('chapter-screen');
        mountQuizIsland(lastUnitsMap);
        return;
      }
      if ($('warning-screen') && !$('warning-screen').classList.contains('hidden')) {
        e.preventDefault();
        hide('warning-screen');
        show('study-screen');
        return;
      }
    });
  }

  /* ===================================================================
     7. 對外介面：給 quiz-firebase.js 用
     =================================================================== */
  window.QUIZ = {
    /* 刻意不暴露 content 與 nodes（不然 Console 打 QUIZ.content 一樣整批帶走題庫） */
    moduleId: C.moduleId,
    // 身分確定後呼叫（快取或名冊都走這裡）
    setUser: function (me) {
      if (!me) return;
      user.cls = me.cls; user.no = me.no; user.name = me.name;
      identified = true;
      enterChapters();
    },
    isIdentified: function () { return identified; },
    failIdentity: function (msg) {
      var el = $('sso-msg'); if (el) el.textContent = msg || '無法確認身分，請回闖關基地重新登入。';
    },
    refreshBadges: paintBadges
  };

  /* ===================================================================
     8. 啟動
     =================================================================== */
  render();
  bind();

  // 快速通道：闖關基地已快取身分時直接進章節頁，不讓學生看到「正在確認身分…」
  var cached = (window.SSO && window.SSO.me) ? window.SSO.me() : null;
  if (cached) window.QUIZ.setUser(cached);

})();
