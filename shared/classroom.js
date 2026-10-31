/* =====================================================================
   Google Classroom 讀取（只讀，教師端用）
   ---------------------------------------------------------------------
   實際去讀 Classroom 的是 gas/classroom.gs（一支 Apps Script Web App）。
   這一支只負責「呼叫它、把回應整理好、把錯誤翻成人話」。

   ★ 為什麼繞一層 Apps Script，不讓瀏覽器直接呼叫 Classroom API
     瀏覽器那條路要在 Google Cloud 建 OAuth 用戶端，對學校的 Workspace
     來說那是一個「第三方應用程式」，通常要網域管理員核准才能用。
     Apps Script 是**老師自己帳號裡的指令碼**，以老師的身分執行，
     讀得到的東西和老師自己打開 Classroom 一模一樣，不需要任何人核准。

   ★ 回傳裡沒有姓名、沒有 email
     email → 學號 的對應在 .gs 裡面就做完了。姓名前端本來就有自己的名冊。
     Web App 部署成「任何人都可以存取」，網址外流就等於內容外流 ——
     少回傳一樣東西，就少一樣會外洩的東西。

   ★ 通行碼不放在 config.js（網站是公開的）
     在審核頁輸入一次，存在這台瀏覽器的 localStorage。

   ---------------------------------------------------------------------
   用法：
     CLASSROOM.init(gasUrl, key);
     await CLASSROOM.ping();                   // 確認網址與通行碼
     const courses = await CLASSROOM.courses();
     const works   = await CLASSROOM.coursework(courseId);
     const subs    = await CLASSROOM.submissions(courseId, courseWorkId);
   ===================================================================== */
(function (global) {
  'use strict';

  /* 版本字串：畫面上會顯示 —— 改版後看到舊值，就知道是瀏覽器快取（GitHub Pages 會快取 10 分鐘） */
  var VERSION = '2026-10-23';

  var url = '';
  var key = '';

  function init(u, k) {
    url = String(u || '').trim();
    key = String(k || '').trim();
  }
  function ready() { return !!(url && key); }

  /* 通行碼記在這台瀏覽器，不進版控。
     電腦教室有還原卡、關機就清掉，所以不必另外做「登出時清除」。 */
  var LS = 'c115.classroom.key';
  function savedKey() {
    try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; }
  }
  function saveKey(k) {
    try { localStorage.setItem(LS, String(k || '')); } catch (e) { /* 無痕模式會擋，忽略 */ }
  }
  function forgetKey() {
    try { localStorage.removeItem(LS); } catch (e) {}
  }

  /**
   * 呼叫 Web App。
   *
   * ★ 為什麼不看 HTTP 狀態碼：Apps Script 回非 200 時會回一頁 HTML 錯誤畫面，
   *   跨來源讀不到內容，前端只會拿到「fetch 失敗」，看不出真正原因。
   *   所以 .gs 一律回 200 ＋ { ok:false, error:… }，這裡看 ok 欄位。
   */
  function call(action, params) {
    if (!url) {
      return Promise.reject(new Error(
        '還沒設定 Apps Script 的網址。請照 gas/classroom.gs 開頭的步驟部署一次，' +
        '再把網址填進 course/config.js（CLASSROOM.GAS_URL）。'));
    }
    if (!key) {
      return Promise.reject(new Error('還沒輸入通行碼。就是 Apps Script 指令碼屬性裡的 QUERY_KEY。'));
    }
    var qs = ['action=' + encodeURIComponent(action), 'key=' + encodeURIComponent(key)];
    Object.keys(params || {}).forEach(function (k2) {
      if (params[k2] != null && params[k2] !== '') {
        qs.push(encodeURIComponent(k2) + '=' + encodeURIComponent(params[k2]));
      }
    });
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + qs.join('&'), {
      method: 'GET', redirect: 'follow'
    }).then(function (r) {
      return r.text().then(function (t) {
        var j;
        try { j = JSON.parse(t); }
        catch (e) { throw new Error(explainNonJson(t, r)); }
        if (!j.ok) throw new Error(explainError(j.error));
        return j;
      });
    }, function () {
      throw new Error('連不上 Apps Script。檢查網址是不是「部署 → 網頁應用程式」那一個（結尾是 /exec），' +
                      '以及部署時「誰可以存取」有沒有選「任何人」。');
    });
  }

  /** 回傳的不是 JSON —— 幾乎都是部署設定不對，講清楚是哪一種 */
  function explainNonJson(text, resp) {
    var t = String(text || '');
    if (/accounts\.google\.com|Sign in|登入/i.test(t)) {
      return 'Apps Script 要求登入才能存取 —— 部署時「誰可以存取」要選「任何人」，' +
             '不是「僅限我自己」或「機構內部使用者」。改完要重新部署（版本選「新版本」）。';
    }
    if (/Script function not found|找不到指令碼函式/i.test(t)) {
      return '這支 Apps Script 沒有 doGet —— 確認整份 classroom.gs 都貼進去了，而且已經重新部署。';
    }
    if (/^\s*</.test(t)) {
      return 'Apps Script 回的是網頁而不是資料（HTTP ' + (resp && resp.status) + '）。' +
             '通常是網址貼到「編輯器」而不是「部署」的網址 —— 要用結尾 /exec 的那一個。';
    }
    return 'Apps Script 的回應看不懂：' + t.slice(0, 120);
  }

  /** .gs 回報的錯誤，補上「該去哪裡改」 */
  function explainError(msg) {
    var t = String(msg || '');
    if (/通行碼/.test(t)) return t;      // .gs 已經寫清楚了
    /* 「Requested entity was not found.」真正的意思是「這個 courseWorkId 不屬於這個 courseId」，
       也就是作業清單還停留在上一門課（見 review.html 的 pickCourse）。要講「下一步怎麼辦」。 */
    if (/Requested entity was not found|entity was not found/i.test(t)) {
      return '這份作業不屬於目前選到的課程 —— 通常是剛換班、作業清單還沒重新' +
             '載完就按了「讀取這一關」。等一兩秒再按一次就好；' +
             '如果一直這樣，請在下拉選單裡重新選一次課程。';
    }
    if (/Classroom is not defined|Classroom 未定義/i.test(t)) {
      return 'Apps Script 專案沒有加入 Classroom 服務 —— 編輯器左側「服務」→ 新增 →' +
             ' Google Classroom API，加完重新部署。';
    }
    if (/permission|授權|PERMISSION_DENIED/i.test(t)) {
      return '權限不足：' + t + '\n第一次部署後要在編輯器裡執行一次 selfTest 完成授權，' +
             '並確認你在這門課是「老師」身分。';
    }
    return t || 'Apps Script 回報了不明的錯誤。';
  }

  /* ===== 端點 ===== */
  function ping()        { return call('ping'); }
  function courses()     { return call('courses').then(function (j) { return j.courses || []; }); }
  function coursework(courseId) {
    return call('coursework', { courseId: courseId }).then(function (j) { return j.courseWork || []; });
  }
  /** 回傳 學號 → 這一筆繳交 */
  function submissions(courseId, courseWorkId) {
    return call('submissions', { courseId: courseId, courseWorkId: courseWorkId })
      .then(function (j) {
        var map = {};
        (j.submissions || []).forEach(function (s) { map[s.sid] = s; });
        return map;
      });
  }

  /* ===== 純資料處理（沒有網路，可以單獨測） ===== */

  /** 交了沒（有附件而且狀態是已繳交才算） */
  function handedIn(row) {
    return !!row && row.state === 'TURNED_IN' && (row.attachments || []).length > 0;
  }

  /**
   * 附件看起來是圖片還是影片。
   *
   * ⚠️ 只是「看起來」—— Classroom 不保證給得到副檔名。
   *    所以這只用來提示，最後仍然由老師點開確認再給分。
   *    寧可標成「看不出來」，也不要猜錯讓老師以為系統驗過了。
   */
  function guessKind(att) {
    var t = String((att && att.title) || '').toLowerCase();
    if (att && att.kind === 'youtube') return 'video';
    if (/\.(png|jpe?g|gif|webp|svg|bmp|heic)$/.test(t)) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/.test(t)) return 'video';
    return 'unknown';
  }

  /**
   * 從作業清單裡找出「這一關」的那一份。
   *
   * 老師的作業名稱長這樣：
   *   2026/08/06 任務一：2-1-1A 班級置物櫃
   * 裡面帶著單元代號，所以選好關卡就找得到，不必每次在下拉選單裡翻。
   *
   * ★ 比對要卡邊界，不能用單純的 indexOf：
   *   「2-1-1」是「2-1-1A」的前綴，直接包含比對會把 2-1-1A 那份
   *   誤認成 2-1-1 的作業 —— 而且是安靜地認錯，老師會對著別關的繳交給分。
   *   所以代號後面不可以再接英數字。
   * ★ 多個候選代號時（流程圖與程式各有自己的十關）長的先比，
   *   同樣是為了讓 2-1-1A 贏過 2-1-1。
   * ★ 找到不只一份就回報「不確定」，讓老師自己選 —— 猜錯的代價
   *   是整班分數登記到錯的關卡上。
   */
  function findWork(works, ids) {
    var cands = (ids || []).filter(Boolean)
      .slice().sort(function (a, b) { return String(b).length - String(a).length; });
    for (var i = 0; i < cands.length; i++) {
      var id = String(cands[i]);
      var re = new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9A-Za-z])');
      var hit = (works || []).filter(function (w) { return re.test(String(w.title || '')); });
      if (hit.length === 1) return { work: hit[0], id: id, many: null };
      if (hit.length > 1) return { work: null, id: id, many: hit };
    }
    return { work: null, id: '', many: null };
  }

  /**
   * 把附件連結轉成「可以嵌在頁面裡預覽」的網址。
   *
   *   Drive   .../file/d/<ID>/view  →  .../file/d/<ID>/preview
   *   YouTube youtu.be/<ID>／watch?v=<ID>  →  youtube.com/embed/<ID>
   *
   * ★ 為什麼值得做：審核就是「看一眼、按一下」。每看一份都要開新分頁、
   *   看完再關掉，三十個人就是六十次分頁切換 —— 那是把老師的時間
   *   花在視窗管理上。
   * ★ 轉不出來就回空字串，畫面會退回「在新分頁開啟」。
   *   Drive 也可能拒絕被嵌（權限或檔案類型），所以預覽視窗裡
   *   一定要同時留一個「在新分頁開啟」，不能只有 iframe。
   */
  function previewUrl(att) {
    var u = String((att && att.link) || '');
    var m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    m = u.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    m = u.match(/youtu\.be\/([^?&/]+)/) || u.match(/youtube\.com\/watch\?v=([^&]+)/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    return '';
  }

  /**
   * 從課程清單裡找出某一班的那一門課。
   * 和 findWork 同一套原則：對到剛好一門才回傳，對到多門或零門就不猜。
   */
  function findCourse(courses, klass) {
    if (!klass) return { course: null, many: null };
    var hit = (courses || []).filter(function (c) {
      return classFromCourseName(c.name) === String(klass);
    });
    if (hit.length === 1) return { course: hit[0], many: null };
    return { course: null, many: hit.length ? hit : null };
  }

  /** 從課程名稱抓班級（三位數）：「資訊科技 801」→ 801；抓不到回空字串（不要亂猜） */
  function classFromCourseName(name) {
    var m = String(name || '').match(/\b(\d{3})\b/);
    return m ? m[1] : '';
  }

  global.CLASSROOM = {
    VERSION: VERSION,
    init: init,
    ready: ready,
    savedKey: savedKey,
    saveKey: saveKey,
    forgetKey: forgetKey,
    ping: ping,
    courses: courses,
    coursework: coursework,
    submissions: submissions,
    handedIn: handedIn,
    guessKind: guessKind,
    classFromCourseName: classFromCourseName,
    findWork: findWork,
    findCourse: findCourse,
    previewUrl: previewUrl,
    _explainError: explainError,
    _explainNonJson: explainNonJson
  };

})(window);
