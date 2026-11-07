/* =====================================================================
   闖關排行賽（畫面與流程）
   ---------------------------------------------------------------------
   course/arena.html 只放一行「這一份是哪個單元」（window.ARENA_CONTENT），畫面與流程都在這裡。
   · 規則：20 題、★1 起跳、答對升答錯降、全對 1000 分；
     全期取最高、同分用時短的在前；一天兩次（開始就算一次）；
     參賽資格：這個單元 10 / 10 章節通關。
   · 每題限時 20 秒、時間到算答錯；作答中離開畫面 ⇒ 這一題算答錯、降一級
     （不能「回來換一題」，否則會被拿來把不會的題目換掉）。
     ★ 時間由後端量，這裡的倒數只是顯示 —— 拖過時限才送的答案後端照樣算錯。
   ★★ 分數全部由後端算（題目由後端出、答案由後端判、時間由後端量）。
      這一支只顯示題目、送出「選了第幾個」—— 沒有答案、也沒有分數可以改。
   ★ 後端是 Apps Script（gas/grader.gs，和程式設計評分同一個部署，config.js 的 GRADER_URL）：
       · 每個請求送 { kind, idToken, … }（text/plain，Apps Script 才不會擋 CORS）
       · 學號不是頁面說了算 —— Apps Script 拿 idToken 向 Firebase 確認是誰
       · 作答只帶場次代號（32 碼亂數，只有按開始的那個人拿得到），少一次身分查詢、快一點
   用法（course/arena.html）：
     window.ARENA_CONTENT = { name, subtitle, chapterPage };
     <script src="../shared/arena.js"></script>   ← 放在 body 最後
     登入狀態確定之後呼叫 window.ARENA_SET_AUTH({ sid, token: () => idToken 的 Promise })
   ===================================================================== */
(function () {
  'use strict';
  var A = window.ARENA_CONTENT || {};
  var esc0 = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  if (A.name) document.title = A.name + ' 闖關排行賽';

  /* ── 樣式與畫面 ─────────────────────────────── */
  var st = document.createElement('style');
  st.textContent = `  body { font-family: 'Noto Sans TC', system-ui, sans-serif; background: #f1f5f9; }
  .rung { transition: all .25s; }
  .rung.on { transform: scale(1.06); box-shadow: 0 0 0 3px #f59e0b; }
  .pop { animation: pop .35s ease-out; }
  @keyframes pop { 0% { transform: scale(.85); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
  .opt.sel { border-color: #4f46e5; background: #eef2ff; }
  /* ── 等待動畫（出題中…讓使用者知道還在進行）──
     五顆星輪流跳（呼應 ★1～★5 階梯）＋會動的「…」。
     ⚠️ 第一次出題要讀全班的答題紀錄來分級，可能要好幾秒 —— 沒有動靜的話，
        學生會以為當掉而一直按、或重新整理（重新整理＝那一次機會白白用掉）。 */
  .ld { display: inline-flex; align-items: center; gap: .6rem; font-weight: 800; color: #475569; }
  .ld-stars i { display: inline-block; font-style: normal; color: #f59e0b; font-size: 1.25rem;
                animation: ld-hop 1.1s ease-in-out infinite; }
  .ld-stars i:nth-child(2) { animation-delay: .12s } .ld-stars i:nth-child(3) { animation-delay: .24s }
  .ld-stars i:nth-child(4) { animation-delay: .36s } .ld-stars i:nth-child(5) { animation-delay: .48s }
  @keyframes ld-hop { 0%, 60%, 100% { transform: translateY(0); opacity: .35 } 30% { transform: translateY(-7px); opacity: 1 } }
  .ld-dots::after { content: ''; display: inline-block; width: 1.2em; text-align: left; animation: ld-dots 1.2s steps(4) infinite; }
  @keyframes ld-dots { 0% { content: '' } 25% { content: '.' } 50% { content: '..' } 75% { content: '...' } }
  .spin { display: inline-block; width: 1em; height: 1em; border: 3px solid rgba(255,255,255,.4);
          border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; }
  @keyframes spin { to { transform: rotate(360deg) } }
  @media (prefers-reduced-motion: reduce) { .ld-stars i, .spin, .ld-dots::after { animation: none } .ld-stars i { opacity: 1 } }
  .veil { position: fixed; inset: 0; z-index: 60; background: rgba(15,23,42,.92); color: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: .75rem; text-align: center; padding: 1.5rem; cursor: pointer; }
`;
  document.head.appendChild(st);
  document.body.className = 'min-h-screen text-slate-800';
  document.body.insertAdjacentHTML('afterbegin', `
<a id="back-to-hub" href="hub.html" style="display:none"
  class="hidden"
  ></a>

<main class="max-w-3xl mx-auto px-4 pt-20 pb-16">

  <!-- ① 開始畫面 -->
  <section id="s-start">
    <header class="text-center mb-6">
      <p class="text-sm font-bold text-indigo-500 tracking-widest">{{SUBTITLE}}</p>
      <h1 class="text-3xl sm:text-4xl font-black mt-1">🏆 闖關排行賽</h1>
      <p class="text-slate-500 mt-2">全部題目大亂鬥 —— 答對升級、答錯降級，爬得越高分數越多！</p>
    </header>

    <div class="bg-white rounded-2xl shadow-sm p-5 mb-4">
      <h2 class="font-black text-lg mb-3">📜 規則</h2>
      <ul class="space-y-1.5 text-slate-600 leading-relaxed">
        <li>・一共 <b>20 題</b>，從最簡單的 <b>★1</b> 開始。</li>
        <li>・<b class="text-emerald-600">答對升一級</b>、<b class="text-rose-600">答錯降一級</b>（答錯那題 0 分）。</li>
        <li>・難度是依<b>全班的答對率</b>分的，每天會重新分一次。</li>
        <li>・<b>一路全對剛好 1000 分</b>。</li>
        <li>・排行取你<b>最高的一次</b>；同分的話，<b>用時短的</b>排前面。</li>
        <li>・<b>參賽資格</b>：{{NAME}} <b>10 個章節全部通關</b>（章節選單上「已通關 10 / 10」）。</li>
        <li>・每天可以挑戰 <b>2 次</b>，<b>按下開始就算一次</b>。</li>
        <li>・每題限時 <b class="text-rose-600">20 秒</b>，<b>時間到算答錯</b>。</li>
        <li>・作答時切到別的視窗、分頁或 App，<b class="text-rose-600">這一題算答錯、降一級</b>（不能用來換題）。</li>
      </ul>
      <div class="grid grid-cols-5 gap-2 mt-4" id="ladder-demo"></div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm p-5 mb-4 flex flex-wrap items-center gap-4 justify-between">
      <div>
        <p class="text-sm text-slate-500">今天還可以挑戰</p>
        <p class="text-2xl font-black"><span id="left">—</span> 次</p>
      </div>
      <div>
        <p class="text-sm text-slate-500">我的最佳成績</p>
        <p class="text-2xl font-black" id="best">—</p>
      </div>
      <button id="btn-start" disabled
        class="px-6 py-3 rounded-xl bg-indigo-600 text-white font-black text-lg shadow hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed">
        開始挑戰 ▶
      </button>
    </div>
    <p id="start-msg" class="text-center text-sm text-slate-500 min-h-[2rem]"><span class="ld"><span class="ld-text">連線中</span><span class="ld-dots"></span></span></p>
    <p class="text-center mt-2"><button id="btn-board0" class="text-indigo-600 font-bold underline">看排行榜</button></p>
  </section>

  <!-- ② 作答畫面 -->
  <section id="s-quiz" class="hidden">
    <div class="flex items-center justify-between mb-3">
      <p class="font-black text-lg">第 <span id="q-no">1</span> / 20 題</p>
      <p class="font-black text-lg">🏅 <span id="q-score">0</span> 分</p>
    </div>
    <div class="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
      <div id="q-bar" class="h-full bg-indigo-500 transition-all" style="width:0%"></div>
    </div>
    <div class="grid grid-cols-5 gap-2 mb-4" id="ladder"></div>

    <div class="bg-white rounded-2xl shadow-sm p-5 relative">
      <div class="flex items-center gap-2 mb-3" aria-label="剩餘時間">
        <span aria-hidden="true">⏱</span>
        <div class="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div id="q-timebar" class="h-full bg-emerald-500" style="width:100%"></div>
        </div>
        <span id="q-time" class="font-black text-lg tabular-nums w-12 text-right">20 秒</span>
      </div>
      <p class="text-sm font-bold text-amber-600 mb-2" id="q-worth"></p>
      <div id="q-box"></div>
      <button id="btn-send" disabled
        class="mt-5 w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-lg disabled:opacity-40">送出答案</button>
      <div id="fb" class="hidden absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center"></div>
    </div>
    <p id="q-msg" class="text-center text-sm text-rose-600 mt-3 min-h-[1.25rem]"></p>
  </section>

  <!-- ③ 結果與排行 -->
  <section id="s-result" class="hidden">
    <div class="bg-white rounded-2xl shadow-sm p-6 text-center mb-5 pop" id="res-card"></div>
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-black text-lg">🏆 排行榜（前 30 名）</h2>
        <span class="text-sm text-slate-400" id="players"></span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm sm:text-base">
          <thead><tr class="text-left text-slate-400 border-b">
            <th class="py-2 pr-2 w-14">名次</th><th class="py-2 pr-2">學號</th>
            <th class="py-2 pr-2 text-right">分數</th><th class="py-2 text-right">用時</th>
          </tr></thead>
          <tbody id="board"></tbody>
        </table>
      </div>
    </div>
    <p class="text-center mt-5"><button id="btn-again" class="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold">回到開始畫面</button></p>
  </section>
</main>
`
    .replace('{{SUBTITLE}}', esc0(A.subtitle || A.name || ''))
    .replace('{{NAME}}', esc0(A.name || '')));

  var C = window.CONFIG || {};
  var TERM = C.TERM || '';
  var URL_ = String(C.GRADER_URL || '').trim();
  var SID = '', TOKEN = null;            // 由 arena.html 的登入程式填進來（ARENA_SET_AUTH）
  var POINTS = { 1: 15, 2: 25, 3: 35, 4: 45, 5: 55 };
  var TIER_NAME = { 1: '暖身', 2: '入門', 3: '進階', 4: '高手', 5: '大師' };
  var TIER_CLS = { 1: 'bg-emerald-100 text-emerald-800', 2: 'bg-sky-100 text-sky-800',
                   3: 'bg-indigo-100 text-indigo-800', 4: 'bg-violet-100 text-violet-800',
                   5: 'bg-amber-100 text-amber-800' };

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { ['s-start', 's-quiz', 's-result'].forEach(function (s) {
    $(s).classList.toggle('hidden', s !== id); }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtSec = function (s) { s = Math.round(Number(s) || 0);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /** 呼叫 Apps Script：{ kind, idToken, …body }。回傳 JSON（錯誤訊息統一放在 error） */
  function api(kind, body) {
    var tok = (TOKEN && kind !== 'arenaAnswer' && kind !== 'arenaLeave') ? TOKEN() : Promise.resolve('');
    return Promise.resolve(tok).then(function (idToken) {
      var b = Object.assign({ kind: kind, term: TERM }, body || {});   // term：Apps Script 一個部署服務兩個學期
      if (idToken) b.idToken = idToken;
      return fetch(URL_, { method: 'POST', body: JSON.stringify(b) });   // ⚠️ 不加 Content-Type：維持 text/plain，Apps Script 才收得到
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    }).then(function (j) {
      if (j && !j.ok && !j.error) j.error = j.message || '';
      return j;
    });
  }

  /** 等待動畫的 HTML（text 後面會自己跑「…」） */
  function loader(text) {
    return '<span class="ld" role="status"><span class="ld-stars" aria-hidden="true"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></span>'
      + '<span class="ld-text">' + esc(text) + '</span><span class="ld-dots"></span></span>';
  }
  /* 出題等比較久時，輪流換提示，讓人知道不是當掉 */
  var HINTS = ['出題中', '依今天全班的答對率分級中', '洗牌題目中', '準備 ★1 暖身題'];
  var hintTimer = null;
  function startHints(host) {
    var i = 0, t0 = Date.now();
    host.innerHTML = loader(HINTS[0]);
    stopHints();
    hintTimer = setInterval(function () {
      var el = host.querySelector('.ld-text');
      if (!el) return stopHints();
      i = (i + 1) % HINTS.length;
      el.textContent = (Date.now() - t0 > 8000)
        ? '第一次出題要分析全班的答題紀錄，比較久，請不要重新整理'
        : HINTS[i];
    }, 2000);
  }
  function stopHints() { if (hintTimer) { clearInterval(hintTimer); hintTimer = null; } }

  function ladder(host, cur) {
    host.innerHTML = [1, 2, 3, 4, 5].map(function (t) {
      return '<div class="rung rounded-xl py-2 text-center ' + TIER_CLS[t] + (t === cur ? ' on' : '') + '">'
        + '<div class="font-black">' + '★'.repeat(t) + '</div>'
        + '<div class="text-xs font-bold">' + TIER_NAME[t] + '・' + POINTS[t] + ' 分</div></div>';
    }).join('');
  }

  /* ── ① 開始畫面 ─────────────────────────────── */
  var state = { run: null, q: null, picked: -1, busy: false, pulled: false, leaveP: null };

  /* ── 倒數（每題限時 20 秒，時間到算答錯）──────────
     ★ 只是顯示：真正的時限在後端（從出題那一刻起算）。倒數到 0 ⇒ 送「時間到」。 */
  var cd = { h: null, end: 0, limit: 20 };
  function stopCountdown() { if (cd.h) { clearInterval(cd.h); cd.h = null; } }
  function paintCountdown() {
    var left = Math.max(0, (cd.end - Date.now()) / 1000);
    var bar = $('q-timebar'), lab = $('q-time');
    if (bar) {
      bar.style.width = (left / cd.limit * 100) + '%';
      bar.className = 'h-full ' + (left <= 5 ? 'bg-rose-500' : left <= 10 ? 'bg-amber-400' : 'bg-emerald-500');
    }
    if (lab) {
      lab.textContent = Math.ceil(left) + ' 秒';
      lab.classList.toggle('text-rose-600', left <= 5);
    }
    return left;
  }
  function startCountdown(sec) {
    stopCountdown();
    cd.limit = Number(sec) || 20;
    cd.end = Date.now() + cd.limit * 1000;
    paintCountdown();
    cd.h = setInterval(function () { if (paintCountdown() <= 0) { stopCountdown(); timeUp(); } }, 200);
  }
  function timeUp() {
    if (state.busy || state.pulled || !state.q) return;
    state.busy = true; $('btn-send').disabled = true;
    $('btn-send').innerHTML = '<span class="spin"></span> 時間到，判定中…';
    sendAnswer({ run_id: state.run, timeout: true });
  }

  function loadToday() {
    ladder($('ladder-demo'), 0);
    if (!URL_) { $('start-msg').textContent = '排行賽還沒接上 Apps Script（config.js 的 GRADER_URL 是空的），請告訴老師。'; return; }
    if (!SID) { $('start-msg').textContent = '找不到你的學號，請從闖關基地重新登入。'; return; }
    api('arenaToday').then(function (j) {
      if (!j.ok) { $('start-msg').textContent = j.error || '讀不到'; return; }
      $('left').textContent = j.left;
      $('best').textContent = j.best ? (j.best.score + ' 分（' + fmtSec(j.best.seconds) + '）') : '還沒有';
      /* ★ 參賽資格：這個單元 10 / 10 章節通關（後端開始時也會再擋一次） */
      if (j.eligible === false) {
        $('btn-start').disabled = true;
        $('start-msg').innerHTML = '🔒 要先把' + esc(A.name) + ' <b>' + j.need + ' 個章節全部通關</b>才能挑戰'
          + '（目前 <b>' + j.passed + ' / ' + j.need + '</b>）。'
          + '<a href="' + esc(A.chapterPage) + '" class="text-indigo-600 font-bold underline ml-1">去闖關 →</a>';
        return;
      }
      $('btn-start').disabled = !(j.left > 0);
      $('start-msg').textContent = j.left > 0 ? '準備好就按開始！' : '今天的 2 次都用完了，明天再來挑戰！';
    }).catch(function () {
      $('start-msg').textContent = '連不上排行賽服務（Apps Script），請稍後再試；一直這樣請告訴老師。';
    });
  }

  $('btn-start').addEventListener('click', function () {
    if (!confirm('按下開始就會用掉今天的一次機會，確定要開始嗎？')) return;
    $('btn-start').disabled = true;
    startHints($('start-msg'));
    api('arenaStart').then(function (j) {
      stopHints();
      if (!j.ok) { $('start-msg').textContent = j.error || '開始失敗'; loadToday(); return; }
      state.run = j.run_id; state.pulled = false;
      show('s-quiz');
      paint(j.question);
    }).catch(function () { stopHints(); $('start-msg').textContent = '連不上排行賽服務，請稍後再試。'; loadToday(); });
  });

  /* ── ② 作答 ─────────────────────────────────── */
  function paint(q) {
    state.q = q; state.picked = -1; state.busy = false;
    $('q-no').textContent = q.index;
    $('q-score').textContent = q.score;
    $('q-bar').style.width = ((q.index - 1) / q.total * 100) + '%';
    ladder($('ladder'), q.tier);
    $('q-worth').textContent = '★'.repeat(q.tier) + ' ' + TIER_NAME[q.tier] + '級・答對 +' + q.points + ' 分';
    $('q-box').innerHTML = '<h3 class="text-xl sm:text-2xl font-black leading-relaxed mb-4">' + q.q + '</h3>'
      + q.options.map(function (o, i) {
        return '<div data-i="' + i + '" class="opt p-4 mb-2 border-2 border-slate-200 rounded-xl cursor-pointer font-bold text-lg hover:border-indigo-300">'
          + esc(o) + '</div>';
      }).join('');
    $('btn-send').disabled = true;
    $('btn-send').textContent = '送出答案';
    $('q-msg').textContent = '';
    startCountdown(q.limit);
  }

  $('q-box').addEventListener('click', function (e) {
    var el = e.target.closest('.opt');
    if (!el || state.busy) return;
    state.picked = Number(el.getAttribute('data-i'));
    document.querySelectorAll('.opt').forEach(function (x) { x.classList.toggle('sel', x === el); });
    $('btn-send').disabled = false;
  });

  $('btn-send').addEventListener('click', function () {
    if (state.picked < 0 || state.busy) return;
    state.busy = true; $('btn-send').disabled = true;
    stopCountdown();
    $('btn-send').innerHTML = '<span class="spin"></span> 判定中…';
    sendAnswer({ run_id: state.run, choice: state.picked });
  });

  function sendAnswer(body) {
    var sendFail = function (msg) {
      state.busy = false; $('btn-send').disabled = state.picked < 0; $('btn-send').textContent = '送出答案';
      $('q-msg').textContent = msg;
    };
    api('arenaAnswer', body).then(function (j) {
      if (!j.ok) { sendFail(j.error || '送出失敗，再按一次'); return; }
      feedback(j, function () {
        if (j.done) finish(j); else paint(j.next);
      });
    }).catch(function () {
      /* 時間到那一次送不出去：自動重送「時間到」（不讓他改送選項） */
      if (body.timeout) {
        $('q-msg').textContent = '連線失敗，自動重送中…';
        setTimeout(function () { sendAnswer(body); }, 1500);
        return;
      }
      sendFail('連線失敗，再按一次送出');
    });
  }

  function feedback(j, then) {
    var fb = $('fb');
    var up = j.tier_to > j.tier_from, down = j.tier_to < j.tier_from;
    fb.className = 'absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center pop '
      + (j.right ? 'bg-emerald-50/95' : 'bg-rose-50/95');
    fb.innerHTML = j.right
      ? '<p class="text-5xl">✅</p><p class="text-2xl font-black text-emerald-700 mt-2">答對！+' + j.points + ' 分</p>'
        + '<p class="font-bold text-emerald-600 mt-1">' + (up ? '⬆ 升到 ' + '★'.repeat(j.tier_to) : '維持 ★★★★★ 大師級！') + '</p>'
      : '<p class="text-5xl">' + ({ timeout: '⏰', late: '⏰', leave: '👀' }[j.why] || '❌') + '</p>'
        + '<p class="text-2xl font-black text-rose-700 mt-2">'
        + ({ timeout: '時間到！算答錯', late: '超過 20 秒，算答錯', leave: '離開畫面，這一題算答錯' }[j.why] || '答錯了')
        + '</p>'
        + '<p class="font-bold text-rose-600 mt-1">' + (down ? '⬇ 降到 ' + '★'.repeat(j.tier_to) : '維持 ★ 暖身級') + '</p>';
    $('q-score').textContent = j.score;
    setTimeout(function () { fb.className = 'hidden'; then(); }, 1100);
  }

  /* ── 離開畫面：這一題算答錯、降一級 ──────────
     ⛔ 以前是「題目收起來，回來換一題、不扣分」—— 老師發現會被拿來
        把不會的題目換掉（換到會的為止），改成算答錯。
     ★ 一離開就告訴後端（不是等回來才說）：回來之後才送的話，
        可能搶在那之前先把答案送出去。
     ⚠️ 仍然把題目文字拿掉，不只是蓋住 —— Chrome 的 Gemini「詢問這個網頁」讀的是網頁內容。
     ⚠️ 已經送出答案、正在判定或播對錯動畫時（state.busy）離開，不算。 */
  function inQuiz() { return !$('s-quiz').classList.contains('hidden') && state.q && !state.busy; }
  function leaveCall() {
    state.leaveP = api('arenaLeave', { run_id: state.run })
      .catch(function () { return { ok: false, error: '連線失敗' }; });
    return state.leaveP;
  }
  function pull() {
    if (!inQuiz() || state.pulled) return;
    state.pulled = true; state.busy = true;
    stopCountdown();
    $('q-box').innerHTML = '<p class="text-lg font-bold text-rose-500 py-10 text-center">👀 你離開了作答畫面，這一題算答錯。</p>';
    $('btn-send').disabled = true;
    leaveCall();
    if (!$('veil')) {
      var v = document.createElement('div');
      v.id = 'veil'; v.className = 'veil';
      v.innerHTML = '<p class="text-2xl font-black">👀 你離開了作答畫面</p><p>這一題<b>算答錯、降一級</b>。點一下這裡，繼續下一題。</p>';
      v.addEventListener('click', back);
      document.body.appendChild(v);
    }
  }
  function back() {
    var v = $('veil'); if (v) v.remove();
    if (!state.pulled) return;
    state.pulled = false;
    $('q-box').innerHTML = '<p class="py-10 text-center">' + loader('下一題') + '</p>';
    (state.leaveP || leaveCall()).then(function (j) {
      state.leaveP = null;
      if (!j.ok) {
        /* 送不出去：留著遮罩，點一下重送（這一題照樣算錯，只是要讓後端知道） */
        state.pulled = true;
        var v2 = document.createElement('div');
        v2.id = 'veil'; v2.className = 'veil';
        v2.innerHTML = '<p class="text-xl font-black">連線失敗</p><p>' + esc(j.error || '') + '<br>點一下這裡再試一次</p>';
        v2.addEventListener('click', back);
        document.body.appendChild(v2);
        return;
      }
      $('q-msg').textContent = '';
      feedback(j, function () { if (j.done) finish(j); else paint(j.next); });
    });
  }
  window.addEventListener('blur', pull);
  window.addEventListener('focus', back);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pull(); else back(); });
  document.addEventListener('copy', function (e) {
    if (!inQuiz()) return;
    try { e.clipboardData.setData('text/plain', '（題目請自己讀 😉）'); e.preventDefault(); } catch (err) {}
  });

  /* ── ③ 結果與排行 ────────────────────────────── */
  function finish(j) {
    var r = j.result || {};
    $('res-card').innerHTML =
      '<p class="text-sm font-bold text-slate-400">本次成績</p>'
      + '<p class="text-6xl font-black text-indigo-600 my-2">' + r.score + '<span class="text-2xl"> 分</span></p>'
      + '<p class="text-slate-600">答對 <b>' + r.correct + '</b> / ' + r.total + ' 題　最高爬到 <b>' + '★'.repeat(r.max_tier || 1)
      + '</b>　用時 <b>' + fmtSec(r.seconds) + '</b></p>'
      + (j.best_updated ? '<p class="mt-3 font-black text-amber-600 text-lg">🎉 刷新你的最佳成績！</p>'
         : (j.best ? '<p class="mt-3 text-slate-500">你的最佳成績：' + j.best.score + ' 分（' + fmtSec(j.best.seconds) + '）</p>' : ''))
      + (r.swaps ? '<p class="mt-2 text-sm text-rose-500">👀 這一場離開畫面 ' + r.swaps + ' 次（每次那一題算答錯）</p>' : '')
      + (r.robot ? '<p class="mt-3 text-rose-600 font-bold">⚠️ 這一場每題都在 1 秒內作答，不列入排行（老師看得到紀錄）。</p>' : '')
      + (j.save_error ? '<p class="mt-3 text-rose-600 font-bold">⚠️ ' + esc(j.save_error) + '</p>' : '');
    show('s-result');
    loadBoard();
  }

  function row(r, me) {
    var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
    return '<tr class="border-b last:border-0 ' + (me ? 'bg-amber-100 font-black' : '') + '">'
      + '<td class="py-2 pr-2">' + medal + '</td><td class="py-2 pr-2">' + esc(r.sid) + (me ? '（你）' : '') + '</td>'
      + '<td class="py-2 pr-2 text-right">' + r.score + '</td><td class="py-2 text-right">' + fmtSec(r.seconds) + '</td></tr>';
  }
  function loadBoard() {
    $('board').innerHTML = '<tr><td colspan="4" class="py-6 text-center">' + loader('讀取排行榜') + '</td></tr>';
    api('arenaBoard').then(function (j) {
      if (!j.ok) throw new Error(j.error);
      $('players').textContent = '共 ' + j.players + ' 人上榜';
      var html = (j.top || []).map(function (r) { return row(r, r.sid === SID); }).join('');
      /* 30 名外：放在第 31 列，顯示自己真正的名次 */
      if (j.me && j.me.rank > 30) {
        html += '<tr><td colspan="4" class="py-1 text-center text-slate-300">⋯</td></tr>' + row(j.me, true);
      }
      if (!html) html = '<tr><td colspan="4" class="py-4 text-center text-slate-400">還沒有人上榜，你就是第一個！</td></tr>';
      if (!j.me) html += '<tr><td colspan="4" class="py-2 text-center text-slate-400">你還沒有成績 —— 挑戰一次就會上榜。</td></tr>';
      $('board').innerHTML = html;
    }).catch(function () {
      $('board').innerHTML = '<tr><td colspan="4" class="py-4 text-center text-rose-500">讀不到排行，請稍後再試</td></tr>';
    });
  }
  $('btn-board0').addEventListener('click', function () {
    $('res-card').innerHTML = '<p class="font-black text-lg">🏆 目前排行</p>';
    show('s-result'); loadBoard();
  });
  $('btn-again').addEventListener('click', function () { show('s-start'); loadToday(); });

  /* 登入狀態由 arena.html 告訴這裡（Firebase 是 module，比這一支晚執行） */
  window.ARENA_SET_AUTH = function (a) {
    SID = String((a && a.sid) || ''); TOKEN = (a && a.token) || null;
    loadToday();
  };
  ladder($('ladder-demo'), 0);
})();
