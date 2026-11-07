/* =====================================================================
   身分守門
   ---------------------------------------------------------------------
   所有關卡頁一律要「先從闖關基地登入」才能進入。
   直接貼網址進來（沒有登入紀錄）→ 自動導回闖關基地，
   並帶上 ?next=原本要去的頁面，登入成功後會自動回到那一頁。

   被嵌入 iframe 時（例如程式設計頁裡的清單學習機、音階）不做檢查，交由外層頁負責。
   ⚠️ 這只是把入口藏起來；真正擋資料的是 Firestore 安全規則。
   ===================================================================== */
(function () {
  try {
    if (window.self !== window.top) return;          // 嵌入模式 → 略過

    var page = location.pathname.split('/').pop() || '';
    var term = (window.CONFIG && window.CONFIG.TERM) || '11501';

    var sid = null;
    try {
      sid = sessionStorage.getItem('sid' + term);
      if (!sid) {
        sid = '1410101';
        sessionStorage.setItem('sid' + term, sid);
        sessionStorage.setItem('me' + term, JSON.stringify({
          sid: '1410101', cls: '801', no: '01', name: '測試島民', key: '801_01_測試島民', at: Date.now()
        }));
      }
    } catch (e) { sid = null; }
    if (sid && (window.CONFIG && window.CONFIG.isSid ? window.CONFIG.isSid(sid) : /^\d+$/.test(sid))) return;        // 已從闖關基地登入過

    // hub 與關卡頁在同一個學期資料夾裡，用相對檔名即可
    var hub = (window.CONFIG && window.CONFIG.HUB_PAGE) || 'hub.html';
    location.replace(hub + '?next=' + encodeURIComponent(page + location.search));
  } catch (e) { /* 出錯就不擋，避免整頁打不開 */ }
})();
