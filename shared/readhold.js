/* =====================================================================
   閱讀停留：純閱讀的畫面要留住眼睛，不是留住分頁
   ---------------------------------------------------------------------
   沒有判定條件的步驟（情境解說、關卡說明）按一下就過去了，最需要讀的學生兩秒就滑走，
   然後在下一步卡住。這幾十秒不是懲罰，是**把「讀完」變成一件真的發生過的事**。
   規則放這裡（什麼叫「離開」、寬限幾秒、什麼時候重算、保險絲），畫面文字留給各頁。

   判「離開」看兩件事：
     ① document.visibilityState === 'hidden'   切分頁、最小化
     ② document.hasFocus() === false           視窗還看得見，焦點在別的視窗（並排視窗）
   只看 ① 的話，並排視窗照樣倒數。

   ② 不可以直接信（sawFocus）：有些環境（內嵌瀏覽器、看板模式）hasFocus() 永遠回 false，
   直接信的話倒數會永遠停在原地、沒有任何錯誤訊息。
   ⇒ 只有在「這個環境真的回報過一次有焦點」之後，失焦才算離開。**寧可放過。**
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-readhold';

  var SEC = 30;          // 預設要停留幾秒
  var AWAY_RESET = 5;    // 離開超過幾秒才從頭算（之內只是暫停）
  var FUSE = 3;          // 保險絲：最久 SEC × FUSE 秒一定放行

  /* ── 「現在算不算不在讀」──────────────────────────
     sawFocus 的閂在這裡，一個計時器一份。 */
  function watcher(doc) {
    var sawFocus = false;
    return function () {
      /* 沒有 hasFocus 這個 API 的環境一律當作有焦點 */
      var focused = !doc.hasFocus || doc.hasFocus();
      if (focused) sawFocus = true;
      return doc.visibilityState === 'hidden' || (sawFocus && !focused);
    };
  }

  /**
   * 開始倒數。
   *
   * @param {object} o
   *   sec        這一次要停留幾秒（0 或負數 = 不用等，直接完成）
   *   left       從幾秒接著算（頁面重繪時傳目前秒數；預設 = sec）
   *   awayReset  離開幾秒才重算（預設 AWAY_RESET）
   *   doc        換掉 document 用（測試；預設 document）
   *   onTick(v)  每秒一次。v = { left, state:'run'|'pause'|'reset' }
   *   onDone()   時間到
   * @return { stop(), away(), left() }
   * ⚠️ 呼叫端一定要在重繪前 stop()，不然每重畫一次就多一個計時器，倒數會愈跳愈快。
   */
  function start(o) {
    o = o || {};
    var doc = o.doc || global.document;
    var sec = o.sec == null ? SEC : o.sec;
    var left = o.left == null ? sec : o.left;
    var reset = o.awayReset == null ? AWAY_RESET : o.awayReset;
    var isAway = watcher(doc);
    var awayFor = 0;
    var timer = null;

    /* 保險絲：不管發生什麼事，最久 sec × FUSE 秒一定放行。
       ★ 為什麼需要
         倒數是靠 visibilityState 和 hasFocus 決定要不要扣秒的。
         只要有任何一個瀏覽器（或內嵌瀏覽器、或某個外掛）
         把狀態一直報成非 visible／永遠沒有焦點，學生就會**永遠卡住**，
         而畫面上只會看到一個不動的秒數，沒有任何錯誤訊息。
       ⇒ 擋錯人的代價遠大於少讀 30 秒，所以一定要有出口。
       ⇒ 這也是「離開座位」的出口：時間到了就算沒焦點也照樣倒數完。
         那是刻意留的 —— 一個被叫去辦公室的學生不該永遠回不來。 */
    var deadline = Date.now() + sec * FUSE * 1000;

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function tickOut(st) { if (o.onTick) o.onTick({ left: left, state: st || 'run' }); }
    function finish() { stop(); left = 0; if (o.onDone) o.onDone(); }

    /* 不用等的情況（例如已經通關的關卡回來查資料）直接結束，
       不要開一個一秒後才會發現「其實不用等」的計時器。 */
    if (!(sec > 0) || !(left > 0)) { finish(); return api(); }

    tickOut();
    timer = setInterval(function () {
      if (isAway() && Date.now() < deadline) {
        awayFor++;
        /* 離開超過寬限期 → 從頭算（只暫停的話，「並排掛著」回來按一下就過關）。
           寬限期不可以拿掉：通知跳出來、輸入法搶焦點、被老師叫一句話回頭，
           這些都發生在認真的學生身上最多。 */
        if (awayFor >= reset) left = sec;
        tickOut(awayFor >= reset ? 'reset' : 'pause');
        return;
      }
      awayFor = 0;
      left--;
      if (left > 0) { tickOut(); return; }
      finish();
    }, 1000);

    function api() {
      return {
        stop: stop,
        /** 現在算不算離開（頁面想在 blur 當下就換文字時用） */
        away: function () { return isAway(); },
        left: function () { return left; }
      };
    }
    return api();
  }

  global.READHOLD = {
    VERSION: VERSION,
    SEC: SEC,
    AWAY_RESET: AWAY_RESET,
    FUSE: FUSE,
    start: start,
    _watcher: watcher
  };
})(typeof window !== 'undefined' ? window : this);
