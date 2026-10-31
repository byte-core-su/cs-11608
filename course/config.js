/* =====================================================================
   ★★ 全站設定（移植時「只需要改這一支」＋ firestore.rules 開頭）
   ---------------------------------------------------------------------
   八年級資訊科技闖關系統：一個 Firebase 專案就能跑；
   程式設計自動評分、闖關排行賽、Classroom 繳交審核是選用的 Apps Script。
   步驟見 README.md。

   ★ 標了【必改】的欄位一定要換成你們學校的值。
   ★ 每個網頁在其他 <script> 之前先載入：<script src="config.js"></script>
   ===================================================================== */
window.CONFIG = {

  // ── 學校與帳號【必改】──────────────────────────────────
  //   學生用「學號＋六位數驗證碼」登入（第一次登入自己設定），
  //   老師用 Firebase 裡建立的「電子郵件／密碼」帳號登入。
  //   學生的 Firebase 帳號 email 是系統自己組的，不是真的信箱：
  //     {學號}@students.{Firebase 專案 ID}.firebaseapp.com
  //   ⚠️ TEACHER_EMAIL 與學生 email 的網域在 firestore.rules 最上面**各有一份**，
  //      兩邊要一模一樣（安全規則沒辦法讀 JS）。只改這裡的症狀是「登得進去、進度存不了」。
  SCHOOL: {
    NAME:           '○○國中',                    // 顯示在頁首、證書上
    GRADE:          '八年級',
    SID_PATTERN:    '^\\d{7}$',                 // 【必改】學號格式（正規表示式字串）
    SID_HINT:       '7 位數字',                   //         格式不對時給學生看的白話說明
    TEACHER_EMAIL:  'teacher@example.com',        // 【必改】唯一的教師帳號（一律小寫）
    STUDENT_EMAIL_DOMAIN: ''                      //         留空 ＝ students.{projectId}.firebaseapp.com
  },

  // ── 學期 ────────────────────────────────────────────────
  //   TERM 只是一個代號，用來替資料庫的集合命名（{TERM}-progress…）。
  //   ★ 換學期／換學年時改一個新代號（5 碼數字），舊資料就自然和新資料分開。
  //   ⚠️ 改了 TERM 的話，下面 COLLECTIONS 的兩個名字、firestore.rules 開頭的 TERM() 也要改成一樣。
  TERM: '11501',
  //   第 1 週的星期一。每週評分與出席週次都以它為準。【必改】
  TERM_START: '2026-08-31',

  HUB_PAGE: 'hub.html',

  // ── Firebase【必改】────────────────────────────────────
  //   Firebase Console → 專案設定 → 一般 → 你的應用程式 → SDK 設定（「設定」那一格）
  //   整段貼過來。這些值本來就是公開的，不是密碼 —— 真正的防線是安全規則。
  FIREBASE: {
    apiKey:            'YOUR_API_KEY',
    authDomain:        'YOUR_PROJECT.firebaseapp.com',
    projectId:         'YOUR_PROJECT',
    storageBucket:     'YOUR_PROJECT.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId:             '1:000000000000:web:0000000000000000'
  },

  COLLECTIONS: {
    PROGRESS: '11501-progress',
    ROSTER:   'roster',
    CONFIG:   '11501-config'
  },

  /* ── 程式設計自動評分（選用）────────────────────────────
     gas/grader.gs 部署成網頁應用程式之後，把結尾是 /exec 的網址貼在這裡。
     ★ 有填：學生在程式設計頁上傳 .sb3，和老師的參考解答比對給 0～3⭐。
       沒填：作品交到老師指定的地方（例如 Classroom），作品星不計。
     步驟見 gas/README.md。 */
  GRADER_URL: '',

  /* 資訊倫理 闖關排行賽（選用，要先填好上面的 GRADER_URL —— 同一個 Apps Script）
     20 題、答對升級答錯降級、一天兩次，資訊倫理 10 章全部通關才能玩。
     ★ 開始前：教師後台「🏆 排行賽」→ 按「匯入題庫」一次。
     改成 false ＝ 不開排行賽（闖關基地不會出現那張卡片）。 */
  ARENA: true,

  /* Google Classroom 繳交審核（選用）：gas/classroom.gs 部署之後，把 /exec 網址貼在 GAS_URL。
     ★ 有填：教師後台「📥 繳交審核」直接列出誰交了流程圖圖片、點開就能看、看完給 +1⭐。
       沒填：審核頁照樣能給分，只是要自己開 Classroom 看。
     ⚠️ 通行碼不要填在這裡（網站是公開的）—— 在審核頁輸入一次就好。 */
  CLASSROOM: { GAS_URL: '' },

  /* 資訊倫理測驗：作答中離開就換題
     切分頁、切 App、點網址列的 AI 模式、開瀏覽器的 AI 側邊欄、擷取工具跳出來 ⇒
     題目文字立刻從網頁裡拿掉（遮罩蓋得住畫面、蓋不住「詢問這個網頁」讀的文字），
     回來就換一題。不扣分、不歸零連對、不算答錯，被換掉的題目放回題庫最後面。
     改成 false ＝ 寬容版：只蓋遮罩，點回來繼續同一題。 */
  QUIZ_SWAP_ON_LEAVE: true,

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
  ],

  // 學號格式檢查（所有頁面共用這一個，格式在上面的 SCHOOL.SID_PATTERN）
  isSid: function (v) {
    try { return new RegExp(this.SCHOOL.SID_PATTERN).test(String(v || '')); }
    catch (e) { return /^\d{7}$/.test(String(v || '')); }
  },

  // 由單元代號取得關卡編號（1～10）
  unitNo: function (id) {
    var i = this.UNITS.findIndex(function (u) { return u[0] === id; });
    return i >= 0 ? i + 1 : 0;
  }
};

(function () {
  /* 🔒 鎖住：判分、計星、設定都是掛在 window 上的物件，網頁是**用的當下**才去讀 ——
       在 Console 打一行把設定或判分函式換掉，之後每一題都算答對。
     ★ 作法：載入完就**凍結**（裡面的函式、數字一個都改不了），
       而且 window 上這個名字**不能再指向別的東西**。
     ⚠️ 這擋的是「網頁載入之後」才動手的（Console、書籤小工具、大部分 AI 寫的腳本）。
        搶在網頁載入**之前**就動手的（Tampermonkey 設 document-start）照樣擋不住 ——
        前端能做的只到這裡，見 shared/anskey.js 開頭。
     ⚠️ 同一頁載入兩次時保留第一份，不報錯。 */
  function __lockGlobal(g, name, obj) {
    (function freeze(o) {
      if (!o || (typeof o !== 'object' && typeof o !== 'function') || Object.isFrozen(o)) return;
      Object.freeze(o);
      Object.getOwnPropertyNames(o).forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(o, k);
        if (d && 'value' in d) freeze(d.value);
      });
    })(obj);
    try {
      Object.defineProperty(g, name, { value: obj, writable: false, configurable: false, enumerable: true });
    } catch (e) { /* 已經鎖過：保留第一份 */ }
  }
  __lockGlobal(window, 'CONFIG', window.CONFIG);
})();
