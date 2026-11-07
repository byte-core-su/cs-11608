/* =====================================================================
   上傳 Scratch 作品 → Apps Script 和範例比對給星（兩學期共用）
   ---------------------------------------------------------------------
   ★ 星數由 Apps Script（gas/grader.gs）用老師的身分寫進資料庫，學生改不到；
     這一支只負責：檢查檔案、送出、把結果畫出來。
   ★ 上學期的流程圖頁（course/flowchart.html）、下學期的關卡頁（course/level.html）都用這一支。
   ⚠️ 不設 Content-Type（預設 text/plain）：Apps Script 不處理跨網域的預檢請求。

   用法：
     WORKUP.send({
       button, file, out,          // 送出按鈕、<input type=file>、顯示結果的元素
       unit, unitNo, total,        // 關卡代號、第幾關、總關數
       auth,                       // Firebase Auth（拿登入憑證給 Apps Script 確認是誰）
       onDone: r => { … }          // 評分成功之後（例如重讀進度）
     });
   ===================================================================== */
(function (global) {
  'use strict';

  var MAX_MB = 20;
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readB64(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(new Error('讀不到這個檔案')); };
      r.readAsDataURL(f);
    });
  }

  function send(o) {
    var cfg = global.CONFIG || {};
    var url = String(cfg.GRADER_URL || '').trim();
    var btn = o.button, out = o.out, label = btn ? btn.textContent : '送出評分';
    var f = o.file && o.file.files ? o.file.files[0] : o.file;
    function say(html, cls) { out.innerHTML = '<div class="rounded-lg px-3 py-2 border ' + cls + '">' + html + '</div>'; }
    var warn = 'bg-amber-50 border-amber-200 text-amber-800';
    if (!url) { say('還沒有接上評分服務，請照老師說的方式交作品。', warn); return Promise.resolve(null); }
    if (!f) { say('請先選擇 .sb3 檔案。', warn); return Promise.resolve(null); }
    if (!/\.sb3$/i.test(f.name)) { say('要傳 Scratch 存出來的 <b>.sb3</b> 檔。', warn); return Promise.resolve(null); }
    if (f.size > MAX_MB * 1024 * 1024) { say('檔案太大了（超過 ' + MAX_MB + 'MB），請把用不到的音效、造型刪掉再存一次。', warn); return Promise.resolve(null); }
    if (btn) { btn.disabled = true; btn.textContent = '評分中…（約 5～15 秒）'; }
    out.innerHTML = '';
    return readB64(f).then(function (b64) {
      if (!o.auth || !o.auth.currentUser) throw new Error('登入狀態不見了，請回闖關基地重新登入。');
      return o.auth.currentUser.getIdToken().then(function (idToken) {
        return fetch(url, { method: 'POST', body: JSON.stringify({
          kind: 'grade', term: cfg.TERM, idToken: idToken,
          unit: o.unit, unitNo: Number(o.unitNo) || 0, total: Number(o.total) || 10, b64: b64 }) });
      });
    }).then(function (resp) { return resp.json(); }).then(function (r) {
      if (!r.ok) throw new Error(r.message || '評分失敗');
      var lv = r.levels || {};
      var star = r.stars > 0 ? '⭐'.repeat(r.stars) : '還沒有星';
      var best = (r.bestStars > r.stars)
        ? '<div class="text-xs text-slate-500 mt-1">（這一關你最好的成績是 ' + '⭐'.repeat(r.bestStars) + '，星數取最高，不會變低）</div>' : '';
      say('<div class="text-lg font-black">' + r.score + ' 分　' + star + '</div>' +
          '<div class="text-xs text-slate-600 mt-1">積木 ' + lv.block + '%　位置 ' + lv.place + '%　設定值 ' + lv.value + '%</div>' +
          '<div class="mt-2">' + esc(r.message || '') + '</div>' + best +
          (r.stars < 3 ? '<div class="mt-2 text-xs font-bold">改好之後再存一次、再傳一次就好。</div>'
                       : '<div class="mt-2 text-xs font-bold">🏆 和範例一致！</div>'),
          r.stars >= 3 ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : r.stars === 2 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-rose-50 border-rose-300 text-rose-900');
      if (o.onDone) { try { o.onDone(r); } catch (e) { /* 重讀進度失敗不影響結果顯示 */ } }
      return r;
    }).catch(function (err) {
      var msg = (err && err.message) || '';
      say(/Failed to fetch|NetworkError|Load failed/i.test(msg)
            ? '連不到評分服務 —— 請檢查網路，等一下再試；還是不行就告訴老師。'
            : esc(msg), 'bg-rose-50 border-rose-200 text-rose-800');
      return null;
    }).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = label; }
      return r;
    });
  }

  global.WORKUP = { send: send };
})(window);
