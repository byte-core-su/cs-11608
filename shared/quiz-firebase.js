/* =====================================================================
   章節測驗引擎 · 資料庫接線
   ---------------------------------------------------------------------
   把 Firebase 的細節全部關在這一支，quiz-engine.js 完全不碰 Firestore。
   集合名稱一律由 config.js 決定。

   載入順序（頁面外殼）：
     content/xxx.js  →  shared/quiz-engine.js  →  shared/quiz-firebase.js（本檔）

   闖關紀錄寫進 {TERM}-progress 的 history（證書需要的耗時／答對題數由 REPORT.unit 的 extra 一起寫進去），
   不另存集合。
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ⚠️ 只檢查引擎：題庫（window.QUIZ_CONTENT）被 quiz-engine.js 讀完就從 window 拿掉了（防止在 Console 看答案），
      這裡讀不到是正常的。 */
if (!window.QUIZ) {
  console.error('[quiz-firebase] 測驗引擎沒有載入，請確認載入順序');
}

// Firebase 設定集中在 config.js（全站同一組 appId，各頁不再自行覆蓋）
const firebaseConfig = window.CONFIG.FIREBASE;

let db = null, auth = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);

  // 進度回報：把 Firestore 函式交給共用模組（hub 亮燈、history 都靠這個）
  if (window.REPORT) REPORT.configure({ db, doc, getDoc, setDoc, arrayUnion });

  /* 學生是在闖關基地用「學號＋驗證碼」登入的（Email／密碼帳號），
       而系統為了「登入前先查名冊」有開匿名登入 —— 這裡如果一進來就 signInAnonymously，
       會把學生的身分蓋掉，安全規則的 isOwner() 就認不出他、成績存不進去。
     ⇒ 等 Firebase 還原完第一次登入狀態，**真的沒有人**才匿名登入。 */
  let firstAuth = true;
  onAuthStateChanged(auth, (u) => {
    if (!firstAuth) return;
    firstAuth = false;
    if (!u) signInAnonymously(auth).catch(e => console.error('Firebase Auth Error', e));
  });

  onAuthStateChanged(auth, (u) => {
    if (!u) return;
    // 身分：優先用闖關基地的快取，沒有才回名冊補讀
    if (!QUIZ.isIdentified()) resolveIdentity();
    else QUIZ.refreshBadges();
  });
} catch (e) {
  console.error('Firebase Setup Error', e);
}

async function resolveIdentity() {
  if (!window.SSO) return;
  const who = await SSO.resolve(async (sid) => {
    const snap = await getDoc(doc(db, SSO.ROSTER, sid));
    return snap.exists() ? snap.data() : null;
  });
  if (!who) { QUIZ.failIdentity(); return; }
  QUIZ.setUser(who);
}
