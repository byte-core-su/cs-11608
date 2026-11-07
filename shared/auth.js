/* =====================================================================
   登入：學號＋六位數驗證碼（不用 Google 帳號）
   ---------------------------------------------------------------------
   學生的 Firebase 帳號是 Email／密碼帳號，但 email 是系統自己組的、不是真的信箱：
     {學號}@students.{Firebase 專案 ID}.firebaseapp.com，密碼就是六位數驗證碼。
   Firebase 自己比對密碼，網頁從頭到尾不必讀驗證碼。
   （作法參考 byte-core-su/cs-11507。）

     第一次登入：名冊裡有這個學號、還沒設定過 → 學生自己設定六位數驗證碼。
     之後：學號＋驗證碼直接登入。忘記了 → 老師在後台「👥 學生帳號」查看或重設。
     老師：Firebase 的 Email／密碼帳號（config.js 的 SCHOOL.TEACHER_EMAIL）。

   驗證碼**不放在名冊裡**：名冊是學生登入前就要讀的（確認有這個人），
   放在那裡等於人人讀得到別人的驗證碼。驗證碼放在 codes/{學號}，只有老師讀得到；
   名冊只留一個 hasCode 旗標。

   ⚠️ 這裡的判斷與 firestore.rules 的 isOwner()／isTeacher() 必須一致。
      前端這一份只是為了早點給正確的訊息，真正把關的是安全規則。

   ⚠️ 已知風險：還沒設定驗證碼的學號，任何人都能搶先替他設定。被搶先的學生會登不進去，
      老師到 Firebase Console 刪掉那個帳號、在「學生帳號」按「清除設定」就能重來。
   ---------------------------------------------------------------------
   用法（各頁的 Firebase SDK 版本不同，所以由頁面把函式注入進來）：

     AUTH.configure({ auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
                      signInAnonymously, signOut, db, doc, getDoc, setDoc });
     const r = await AUTH.studentSignIn(sid, code);   // { sid } 或 { needsSetup: true }
     await AUTH.studentSetup(sid, code, again);       // 第一次：設定驗證碼並登入
   ===================================================================== */
(function (global) {
  'use strict';

  var CFG = global.CONFIG || {};
  var SCH = CFG.SCHOOL || {};
  var PROJECT = String(((CFG.FIREBASE || {}).projectId) || '').toLowerCase();
  /* 學生帳號 email 的 @ 後面。config 沒寫就用 Firebase 專案自動組出來 */
  var DOMAIN = String(SCH.STUDENT_EMAIL_DOMAIN || ('students.' + PROJECT + '.firebaseapp.com')).toLowerCase().trim();
  var PREFIX = '';
  var TEACHER = String(SCH.TEACHER_EMAIL || '').toLowerCase().trim();
  var SID_RE = (function () {
    try { return new RegExp(SCH.SID_PATTERN || '^\\d{7}$'); } catch (e) { return /^\d{7}$/; }
  })();
  var CODE_RE = /^\d{6}$/;
  var ROSTER = ((CFG.COLLECTIONS || {}).ROSTER) || 'roster';
  var CODES = 'codes';

  var fb = null;

  function configure(deps) { fb = deps; }

  /** email → 學號。不是學生帳號就回空字串。 */
  function sidFromEmail(email) {
    email = String(email || '').toLowerCase().trim();
    var at = email.lastIndexOf('@');
    if (at < 0 || email.slice(at + 1) !== DOMAIN) return '';
    var sid = email.slice(0, at);
    return SID_RE.test(sid) ? sid : '';
  }

  /** 學號 → email（規則裡 isOwner() 就是這樣組的） */
  function emailFromSid(sid) {
    return PREFIX + String(sid || '') + '@' + DOMAIN;
  }

  function isTeacherEmail(email) {
    return !!TEACHER && String(email || '').toLowerCase().trim() === TEACHER;
  }

  /* 錯誤碼 → 白話說明。
     出錯時使用者最需要知道的不是代碼，而是「這是誰的問題、該找誰」。 */
  var HINT = {
    'auth/operation-not-allowed':
      '系統還沒開啟「電子郵件／密碼」或「匿名」登入方式，請聯絡老師。',
    'auth/unauthorized-domain':
      '這個網址還沒被授權，請聯絡老師。',
    'auth/too-many-requests':
      '登入失敗太多次，系統暫時擋下來了。請過幾分鐘再試，或找老師。',
    'auth/network-request-failed':
      '網路連線有問題，請確認網路後再試。',
    'auth/admin-restricted-operation':
      '系統還沒開啟「匿名」登入方式，請聯絡老師。',
    'auth/weak-password':
      '驗證碼要是 6 位數字。'
  };

  function hintFor(code) {
    return HINT[code] || ('登入失敗（' + code + '），請聯絡老師。');
  }

  function friendly(message) {
    var e = new Error(message);
    e.friendly = message;
    return e;
  }
  /* 「帳號不存在」和「密碼錯」在新版 Firebase 一律回 invalid-credential（防帳號探測），
     兩種都要當成「可能還沒設定」再查一次名冊。 */
  function isBadLogin(e) {
    var c = (e && e.code) || '';
    return c === 'auth/invalid-credential' || c === 'auth/user-not-found'
        || c === 'auth/wrong-password' || c === 'auth/invalid-login-credentials'
        || c === 'auth/invalid-email';
  }

  /** 讀名冊要先有個身分（規則：登入者才能單筆讀）。沒有就匿名登入。 */
  function ensureSignedIn() {
    if (fb.auth.currentUser) return Promise.resolve(fb.auth.currentUser);
    return fb.signInAnonymously(fb.auth).then(function (c) { return c && c.user; });
  }
  function readRoster(sid) {
    return ensureSignedIn().then(function () {
      return fb.getDoc(fb.doc(fb.db, ROSTER, sid));
    }).then(function (s) { return s.exists() ? (s.data() || {}) : null; });
  }

  /* 登入成功後補一次「已設定」旗標與老師看得到的驗證碼。
     正常流程在 studentSetup 就寫好了；這裡給「帳號建好了、旗標卻沒寫進去」
     （例如設定到一半斷網）的人自己修好。寫不進去就算了。 */
  function markHasCode(sid, code) {
    var p1 = fb.setDoc(fb.doc(fb.db, CODES, sid), { code: code, at: Date.now() })
               .catch(function () {});
    var p2 = fb.setDoc(fb.doc(fb.db, ROSTER, sid), { hasCode: true }, { merge: true })
               .catch(function () {});
    return Promise.all([p1, p2]);
  }

  /**
   * 學生登入。
   * @returns {Promise<{sid,name}|{needsSetup:true}>}
   *          失敗丟出帶 friendly 訊息的錯誤。
   */
  function studentSignIn(sid, code) {
    if (!fb) return Promise.reject(new Error('AUTH 尚未 configure()'));
    sid = String(sid || '').trim(); code = String(code || '').trim();
    if (!SID_RE.test(sid)) return Promise.reject(friendly('學號格式不對（' + (SCH.SID_HINT || '') + '）。'));
    if (!CODE_RE.test(code)) return Promise.reject(friendly('驗證碼要是 6 位數字。'));

    return fb.signInWithEmailAndPassword(fb.auth, emailFromSid(sid), code).then(function () {
      return readRoster(sid).then(function (r) {
        if (!r) {
          return fb.signOut(fb.auth).then(function () {
            throw friendly('名冊裡找不到學號 ' + sid + '，請找老師確認。');
          });
        }
        if (!r.hasCode) markHasCode(sid, code);
        return { sid: sid, name: r.name || '' };
      });
    }, function (e) {
      if (!isBadLogin(e)) throw friendly(hintFor((e && e.code) || 'unknown'));
      return readRoster(sid).then(function (r) {
        if (!r) throw friendly('名冊裡找不到學號 ' + sid + '，請確認學號，或找老師。');
        if (r.hasCode) throw friendly('驗證碼不對。忘記了請找老師查看或重設。');
        return { needsSetup: true };
      });
    });
  }

  /** 第一次登入：設定六位數驗證碼並登入。 */
  function studentSetup(sid, code, again) {
    if (!fb) return Promise.reject(new Error('AUTH 尚未 configure()'));
    sid = String(sid || '').trim(); code = String(code || '').trim();
    if (!SID_RE.test(sid)) return Promise.reject(friendly('學號格式不對。'));
    if (!CODE_RE.test(code)) return Promise.reject(friendly('驗證碼要是 6 位數字。'));
    if (code !== String(again || '').trim()) return Promise.reject(friendly('兩次輸入的驗證碼不一樣，請再輸入一次。'));

    return readRoster(sid).then(function (r) {
      if (!r) throw friendly('名冊裡找不到學號 ' + sid + '，請找老師確認。');
      if (r.hasCode) throw friendly('這個學號已經設定過驗證碼了，請用原本的驗證碼登入。');
      return fb.createUserWithEmailAndPassword(fb.auth, emailFromSid(sid), code).then(function () {
        return markHasCode(sid, code);
      }, function (e) {
        if (e && e.code === 'auth/email-already-in-use') {
          throw friendly('這個學號已經有人設定過驗證碼了。如果不是你設定的，請馬上告訴老師。');
        }
        throw friendly(hintFor((e && e.code) || 'unknown'));
      }).then(function () { return { sid: sid, name: r.name || '' }; });
    });
  }

  function signOut() {
    if (!fb || !fb.signOut) return Promise.resolve();
    return fb.signOut(fb.auth);
  }

  /**
   * 老師登入用的小視窗（各教師頁共用）。只負責「問」，登入由頁面自己用它的 SDK 做。
   * @returns {Promise<{email,password}|null>}  按取消回 null
   */
  function askTeacherPassword(message) {
    return new Promise(function (resolve) {
      var box = document.createElement('div');
      box.setAttribute('style', 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);' +
        'display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,"Noto Sans TC",sans-serif');
      box.innerHTML =
        '<form style="background:#fff;border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 40px rgba(0,0,0,.2)">' +
        '<h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#1e293b">老師登入</h2>' +
        '<p style="margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.6">' + (message || '用 Firebase 裡建立的教師帳號登入。') + '</p>' +
        '<label style="display:block;font-size:13px;font-weight:800;color:#334155;margin-bottom:12px">教師信箱' +
        '<input name="email" type="email" autocomplete="username" required style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px"></label>' +
        '<label style="display:block;font-size:13px;font-weight:800;color:#334155;margin-bottom:18px">密碼' +
        '<input name="password" type="password" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px"></label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button type="button" data-cancel style="padding:10px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-weight:700;color:#475569;cursor:pointer">取消</button>' +
        '<button type="submit" style="padding:10px 18px;border-radius:10px;border:0;background:#1e293b;color:#fff;font-weight:900;cursor:pointer">登入</button></div></form>';
      document.body.appendChild(box);
      var form = box.querySelector('form');
      form.email.value = TEACHER;
      setTimeout(function () { (TEACHER ? form.password : form.email).focus(); }, 0);
      function done(v) { box.remove(); resolve(v); }
      box.querySelector('[data-cancel]').onclick = function () { done(null); };
      form.onsubmit = function (ev) {
        ev.preventDefault();
        done({ email: form.email.value.trim(), password: form.password.value });
      };
    });
  }

  /* ===================================================================
     分頁的身分維護（每一頁進站時呼叫一次）
     -------------------------------------------------------------------
     核心觀念：**身分以 Firebase 為準，不以分頁為準。**
     Firebase 的登入狀態是「整個瀏覽器一份」、會同步到所有分頁；
     我們自己的 sessionStorage 學號卻是「每個分頁一份」。不同步的話，
     在第二個分頁換了人，第一個分頁手上拿的就是別人的令牌。所以 sessionStorage 一律跟著 Firebase 走：

       ① 完全沒有登入紀錄 → 匿名登入（登入前要先讀名冊）。
          要等第一次 onAuthStateChanged 回報之後再決定：頁面剛載入時 Firebase 還在非同步還原，
          currentUser 可能暫時是 null，太早匿名登入會把既有的身分蓋掉。
       ② Firebase 是學生帳號：
          · 分頁原本是別人 → 換成新的人並重新整理（令牌已經換了，畫面不跟著換只會騙人）
          · 分頁原本沒有身分 → 直接沿用，新開的分頁不必再登入一次
          （電腦教室有還原卡、關機就重置，所以不再多問「是你嗎」；
            若用在沒有還原機制的共用電腦，要考慮加回這一步。）
       ③ Firebase 是老師帳號（或不是學生帳號）→ 這個分頁沒有學生身分，清掉並導回闖關基地。

     各頁的 SDK 版本不同，所以函式由呼叫端傳進來。
     @returns {Promise<user|null>} 目前的使用者（匿名登入失敗時回 null）
     =================================================================== */
  function attachSession(auth, signInAnonymously, onAuthStateChanged, opts) {
    opts = opts || {};
    var cfg  = global.CONFIG || {};
    var term = opts.term || cfg.TERM || '11501';
    var hub  = opts.hub || cfg.HUB_PAGE || 'hub.html';
    var first = true;

    return new Promise(function (resolve) {
      onAuthStateChanged(auth, function (user) {
        // 每次狀態變動都要同步，不只第一次 —— 別的分頁換人時就是靠這個
        if (user && user.email) {
          var r = syncSid(user, term);
          if (r === 'changed')    { reload(opts); return; }    // 換人了，畫面要重來
          if (r === 'notstudent') { toHubSwitched(user, term, hub, opts); return; }
          if (r === 'adopted') {
            /* 這個分頁沿用了現有的登入：hub 自己接手（onAdopt），其他頁重新整理讓 SSO 重新讀一次 */
            if (typeof opts.onAdopt === 'function') { opts.onAdopt(user, sidFromEmail(user.email)); return; }
            reload(opts); return;
          }
        }

        if (!first) return;
        first = false;
        if (user) return resolve(user);
        signInAnonymously(auth)
          .then(function (cred) { resolve(cred && cred.user); })
          .catch(function (e) { console.error('匿名登入失敗', e); resolve(null); });
      });
    });
  }

  /**
   * 把 Firebase 的學生身分同步到這個分頁的 sessionStorage。
   * @returns 'same' 沒變／'adopted' 新分頁沿用現有登入／
   *          'changed' 分頁原本是別人（已強制換掉）／'notstudent' 不是學生帳號
   */
  function syncSid(user, term) {
    var sid = sidFromEmail(user.email);
    if (!sid) return 'notstudent';              // 老師或外部帳號

    var tabSid = null;
    try { tabSid = sessionStorage.getItem('sid' + term); } catch (e) {}
    if (tabSid === sid) return 'same';

    try {
      sessionStorage.setItem('sid' + term, sid);
      sessionStorage.removeItem('me' + term);   // 姓名快取是前一個人的，一定要清
    } catch (e) {}

    return tabSid ? 'changed' : 'adopted';
    return tabSid ? 'changed' : 'adopted';
  }

  /* 換人之後重新整理。
     不會無限重整：sessionStorage 已經寫成新學號，下一次載入就是 'same'。
     ⚠️ 也因此「登出」一定要連 Firebase 一起登出，否則清掉 sessionStorage
        之後這裡會立刻把身分再撿回來，看起來像登不出去。 */
  function reload(opts) {
    if (typeof opts.onSwitch === 'function') { opts.onSwitch(); return; }
    try { global.location.reload(); } catch (e) {}
  }

  /** 不是學生帳號（老師或外部帳號）：這個分頁沒有身分可用 */
  function toHubSwitched(user, term, hub, opts) {
    try {
      sessionStorage.removeItem('sid' + term);
      sessionStorage.removeItem('me'  + term);
    } catch (e) {}
    if (typeof opts.onMismatch === 'function') { opts.onMismatch(user); return; }
    /* 已經在闖關基地就停在原地（由 hub 的 onMismatch 處理），否則會無限重新整理 */
    try {
      var here = String(global.location.pathname || '').split('/').pop() || '';
      if (here === hub) return;
    } catch (e) {}
    try {
      global.location.replace(hub + '?switched=' + encodeURIComponent(user.email || ''));
    } catch (e) {}
  }

  global.AUTH = {
    DOMAIN: DOMAIN,
    SID_RE: SID_RE,
    SID_HINT: SCH.SID_HINT || '',
    PREFIX: PREFIX,
    TEACHER_EMAIL: TEACHER,
    configure: configure,
    studentSignIn: studentSignIn,
    studentSetup: studentSetup,
    askTeacherPassword: askTeacherPassword,
    signOut: signOut,
    attachSession: attachSession,
    sidFromEmail: sidFromEmail,
    emailFromSid: emailFromSid,
    isTeacherEmail: isTeacherEmail,
    hintFor: hintFor
  };

})(window);
