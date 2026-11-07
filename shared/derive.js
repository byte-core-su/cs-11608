/* =====================================================================
   推導活動：「這個數字是怎麼來的」
   ---------------------------------------------------------------------
   接在積木關卡前面的一小段。學生先想清楚數字從哪來，再去拼積木。

   ★ 為什麼不是排流程圖
     上學期排流程圖練的是「順序」。下學期這幾關的難處不在順序 ——
     4-2-3 的難處是「每畫一條邊要轉幾度」這件事本身，
     以及「為什麼是 360 ÷ N 而不是寫死 90」。
     排流程圖完全碰不到這一點。

   ★ 核心機制：答案直接餵進程式，不是答完就丟
     最後一步不比對標準答案 —— 學生填什麼角度，小貓就照那個角度走。
     對了圖形自己閉合，錯了就留一個開口。
     **不必系統說「答錯了」，圖形自己會說。**

     這也是防亂填的方法。前置活動最容易變成「答完才能玩」的過路費，
     國中生會亂按衝過去，那就退化成點擊練習。
     這裡亂填的結果是畫出開口，衝不過去，而且看得出來為什麼。

   ★ 一般化那一步用「代入三個數字」判定
     問「如果邊數是 N 呢」，學生寫出 ( ) ÷ ( )。
     系統代 N=4、6、10 各畫一次，三個都閉合才算對。
     右邊如果寫死 6，N=6 會過但 N=4 不會 —— 這正是要抓的誤解，
     而且抓出來的時候學生看得到那個沒閉合的圖。

   用法：
     DERIVE.mount(host, data, { onPass: fn })
   資料格式見 11502/content/blocks.js 裡的 derive 欄位。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-derive';

  /* 判斷題連錯幾次就強制讀提示、鎖幾秒。
     ★ 兩次不是一次：第一次很可能只是看太快或手滑，
       罰第一次會罰到大部分人；連錯兩次才比較確定是真的不懂。
     ★ 20 秒不是 30 秒：這是一顆小判斷題，不是整段情境。 */
  var PENALTY_WRONG = 2;
  var PENALTY_SEC = 20;

  /* ── 純計算（沒有畫面，可以單獨測） ───────────────── */

  /**
   * 算式 → 這一次要轉幾度。
   * f = { left: 數字或字串, right: 數字 或 'N' }
   * right 是 'N' 表示「跟著邊數走」，是數字表示學生寫死了。
   */
  function turnFor(f, n) {
    var L = parseFloat(f && f.left);
    var R = (f && String(f.right).trim().toUpperCase() === 'N') ? n : parseFloat(f && f.right);
    if (!isFinite(L) || !isFinite(R) || R === 0) return NaN;
    return L / R;
  }

  /**
   * 走 n 條邊、每次轉 turn 度，會不會剛好回到起點？
   *
   * ⚠️ 判定是「總共剛好轉一圈」，不是「有沒有回到起點」。
   *    n=6、turn=120 也會回到起點 —— 但那是把三角形描了兩遍，
   *    轉了 720 度。看起來是閉合的圖形，觀念卻是錯的。
   *    所以條件是 n × turn ≈ 360，一圈就是一圈。
   */
  function closes(turn, n) {
    if (!isFinite(turn) || !isFinite(n) || n < 3) return false;
    return Math.abs(n * turn - 360) < 0.5;
  }

  /** 多轉了幾圈（用來講「你轉了兩圈」這種話），沒閉合就回 0 */
  function laps(turn, n) {
    if (!isFinite(turn) || !isFinite(n)) return 0;
    var t = n * turn / 360;
    return Math.abs(t - Math.round(t)) < 0.01 ? Math.round(t) : 0;
  }

  /**
   * 單一數字的回饋。回傳 { ok, msg }。
   *
   * ★ 訊息要講「圖形怎麼了」，不要講「答案錯了」。
   *   學生看得到那張圖，訊息的工作是幫他把圖和數字連起來。
   */
  function checkAngle(turn, n) {
    if (!isFinite(turn)) return { ok: false, msg: '先填一個數字。' };
    if (closes(turn, n)) {
      return { ok: true, msg: '閉合了！' + n + ' 條邊 × ' + fmt(turn) + ' 度 = 360 度，剛好轉一整圈。' };
    }
    var L = laps(turn, n);
    if (L >= 2) {
      return { ok: false, msg: '它回到起點了，但轉了 ' + L + ' 圈 —— 圖形被描了 ' + L +
                              ' 遍。一圈是 360 度，不是 ' + (360 * L) + ' 度。' };
    }
    var tot = n * turn;
    return { ok: false, msg: '沒有閉合，留了一個開口。轉 ' + n + ' 次、每次 ' + fmt(turn) +
                            ' 度，總共只轉了 ' + fmt(tot) + ' 度，' +
                            (tot < 360 ? '不夠一圈（360 度）。' : '超過一圈（360 度）。') };
  }

  /**
   * 一般化那一步：代入好幾個邊數，全部都要閉合。
   *
   * 回傳 { ok, msg, bad }　bad = 第一個失敗的邊數（畫面拿它畫圖）
   */
  function verdict(f, ns) {
    ns = (ns && ns.length) ? ns : [4, 6, 10];
    var L = parseFloat(f && f.left);
    if (!isFinite(L)) return { ok: false, msg: '左邊要填一個數字。', bad: ns[0] };
    if (!String(f && f.right).trim()) return { ok: false, msg: '右邊還沒填。', bad: ns[0] };

    for (var i = 0; i < ns.length; i++) {
      if (!closes(turnFor(f, ns[i]), ns[i])) {
        var fixed = String(f.right).trim().toUpperCase() !== 'N';
        return {
          ok: false, bad: ns[i],
          msg: fixed
            ? ('代進 ' + ns[i] + ' 邊形就不閉合了 —— 右邊寫死成 ' + f.right +
               '，只有 ' + f.right + ' 邊形畫得出來。要放會跟著變的 N。')
            : ('代進 ' + ns[i] + ' 邊形不閉合。' + checkAngle(turnFor(f, ns[i]), ns[i]).msg)
        };
      }
    }
    return { ok: true, bad: 0,
             msg: '三種邊數代進去都閉合 —— 這個式子對任何邊數都成立。這就是要放進「右轉 ( ) 度」的東西。' };
  }

  function fmt(v) {
    if (!isFinite(v)) return '?';
    return (Math.round(v * 100) / 100).toString();
  }

  /* ── 追蹤每一輪（排序）─────────────────────────────
     ★ 為什麼要有這一步
       排序的難處從來不是「步驟順序」—— 課本把步驟寫得清清楚楚，
       學生照著念也念得出來。難的是「跑完一輪，資料到底變成什麼樣」。
       排流程圖完全碰不到這一點，念一遍步驟也碰不到。
       這裡讓學生一輪一輪自己動手，資料在眼前變。

     ★ 照課本的做法：兩個清單
       課本（翰林 114 資科 2 下 6-2）的選擇排序法是
       「從未排序找到最小值 → 加到已排序的最後一項 → 從未排序刪掉」，
       不是在同一個清單裡對調。兩者都叫選擇排序，但積木完全不同 ——
       這裡跟課本走，學生等一下拼的才是同一件事。 */

  /** 未排序清單裡最小的那幾個位置（可能有並列） */
  function minAt(list) {
    var m = Math.min.apply(null, list.map(function (x) { return num(x); }));
    var out = [];
    list.forEach(function (x, i) { if (num(x) === m) out.push(i); });
    return out;
  }
  function num(x) { return (x && typeof x === 'object') ? Number(x.v) : Number(x); }
  function label(x) { return (x && typeof x === 'object') ? String(x.t) : String(x); }

  /**
   * 學生點了第 i 個，對不對？
   * ★ 錯的時候要說「還有更小的」，不要說「答案是 3」——
   *   直接給位置的話，學生下一輪照樣不會找。
   */
  function pickMin(list, i) {
    if (!list.length) return { ok: false, msg: '沒有東西可以挑了。' };
    var want = minAt(list);
    if (want.indexOf(i) >= 0) return { ok: true, msg: '' };
    var m = num(list[want[0]]);
    return { ok: false, msg: '你選的是 ' + label(list[i]) + '，但還有更小的 —— 再看一次。' +
                            (num(list[i]) < m ? '' : '') };
  }

  /* ── 畫圖：一隻很小的烏龜 ──────────────────────────
     沒有用 blocks.js 的引擎 —— 這裡只要「走 n 條邊、每次轉 t 度」，
     為了這件事去組一份假的積木程式反而更難懂也更難改。
     舞台比例仍然照 Scratch 的 480×360，學生換到積木關卡不會覺得換了世界。 */

  function polyPath(n, turn, side) {
    var pts = [[0, 0]], x = 0, y = 0, head = 0;   // head：0 = 朝右
    for (var i = 0; i < n; i++) {
      x += side * Math.cos(head * Math.PI / 180);
      y += side * Math.sin(head * Math.PI / 180);
      pts.push([x, y]);
      head -= turn;                                // Scratch 的右轉是順時針
    }
    return pts;
  }

  /** 把路徑縮放置中，塞進 w×h 的畫布 */
  function fitPath(pts, w, h, pad) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sw = Math.max(x1 - x0, 1), sh = Math.max(y1 - y0, 1);
    var k = Math.min((w - pad * 2) / sw, (h - pad * 2) / sh);
    if (!isFinite(k) || k <= 0) k = 1;
    return pts.map(function (p) {
      return [(p[0] - (x0 + x1) / 2) * k + w / 2, -(p[1] - (y0 + y1) / 2) * k + h / 2];
    });
  }

  /** 一邊一邊畫出來。回傳一個可以中止的 handle。 */
  function draw(cv, n, turn, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    var pts = fitPath(polyPath(n, turn, 60), w, h, 22);
    var stop = false, i = 0;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // 起點：畫一個小圈，這樣「有沒有回到這裡」看得出來
    function dot(p, color) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
    dot(pts[0], '#94a3b8');

    function step() {
      if (stop || i >= n) {
        if (!stop && opts.onDone) opts.onDone();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.strokeStyle = opts.color || '#4c97ff';
      ctx.stroke();
      i++;
      setTimeout(step, opts.speed || 130);
    }
    step();

    return { cancel: function () { stop = true; } };
  }

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.dv{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    /* 一題一題的進度點與題號 */
    '.dv-prog{display:flex;gap:5px;margin:12px 0 10px}',
    '.dv-dot{width:22px;height:5px;border-radius:99px;background:#e2e8f0}',
    '.dv-dot.now{background:#4f46e5}.dv-dot.ok{background:#10b981}',
    '.dv-num{font-size:11.5px;font-weight:900;color:#94a3b8;margin-bottom:4px}',
    '.dv-next{margin-top:12px}',
    '.dv-ask{margin-top:10px}',
    '.dv-ask-q{font-size:14px;font-weight:800;line-height:1.85;margin-bottom:8px}',
    '.dv-opt{display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px 13px;',
    '  border:2px solid #e2e8f0;border-radius:11px;background:#fff;font-family:inherit;',
    '  font-size:14px;line-height:1.7;cursor:pointer}',
    '.dv-opt:hover:not(:disabled){border-color:#a5b4fc}',
    '.dv-opt.right{border-color:#10b981;background:#ecfdf5}',
    '.dv-opt.wrong{border-color:#f43f5e;background:#fff1f2;opacity:.7}',
    '.dv-opt:disabled{cursor:default}',
    /* ★ 提示不給滑鼠選取 —— 提高「複製貼上」的摩擦。
       ⚠️ 這不是安全機制（F12 一開就繞過了），
          它擋的是「順手反白貼上」那個動作，而那才是多數學生會做的事。 */
    '.dv-hint div,.dv-modal-c{user-select:none;-webkit-user-select:none}',
    /* ── 題目後面那顆 💡 ──────────────────────────────
       ⚠️ 至少 32×32 —— 電腦教室有觸控螢幕，比手指小的目標按不到。 */
    '.dv-tip{margin-left:7px;border:0;background:#fef3c7;border-radius:999px;',
    '  width:32px;height:32px;font-size:15px;line-height:1;cursor:pointer;',
    '  vertical-align:middle;transition:transform .15s}',
    '.dv-tip:hover{background:#fde68a;transform:scale(1.1)}',
    /* ── 提示的浮動視窗 ────────────────────────────── */
    '.dv-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:60;',
    '  display:flex;align-items:center;justify-content:center;padding:18px}',
    '.dv-modal-b{background:#fff;border-radius:18px;max-width:520px;width:100%;',
    '  box-shadow:0 18px 50px rgba(15,23,42,.3);overflow:hidden}',
    '.dv-modal-h{display:flex;align-items:center;justify-content:space-between;',
    '  padding:13px 16px;font-weight:900;background:#fffbeb;border-bottom:1px solid #fde68a}',
    '.dv-modal-x{border:0;background:transparent;font-size:17px;cursor:pointer;color:#92400e}',
    '.dv-modal-c{padding:15px 17px;font-size:14px;line-height:2;max-height:52vh;overflow:auto}',
    '.dv-modal-f{padding:0 17px 15px;text-align:right}',
    '.dv-modal-ok{border:0;background:#6366f1;color:#fff;font-weight:900;font-size:14px;',
    '  border-radius:11px;padding:9px 18px;cursor:pointer}',
    '.dv-modal-ok:disabled{background:#cbd5e1;cursor:not-allowed}',
    '.dv-say textarea{width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:9px 11px;',
    '  font-family:inherit;font-size:14px;line-height:1.8;resize:vertical;margin-top:8px}',
    '.dv-say textarea:focus{outline:0;border-color:#6366f1}',
    '.dv-btn:disabled{background:#cbd5e1;cursor:not-allowed;opacity:.9}',
    '.dv-intro{background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;',
    '  padding:12px 14px;font-size:14px;line-height:1.9;margin-bottom:14px}',
    '.dv-step{background:#fff;border:2px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:10px}',
    '.dv-step.on{border-color:#6366f1;box-shadow:0 3px 12px rgba(99,102,241,.13)}',
    '.dv-step.ok{border-color:#34d399;background:#f0fdf4}',
    '.dv-step.off{opacity:.5}',
    '.dv-q{font-size:15px;font-weight:700;line-height:1.8;margin:0 0 10px}',
    '.dv-no{display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;',
    '  border-radius:999px;background:#6366f1;color:#fff;font-size:12px;font-weight:900;margin-right:7px}',
    '.dv-step.ok .dv-no{background:#10b981}',
    '.dv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.dv-in{width:88px;padding:7px 9px;border:2px solid #cbd5e1;border-radius:9px;',
    '  font-size:16px;font-weight:700;text-align:center;font-family:inherit}',
    '.dv-in:focus{outline:none;border-color:#6366f1}',
    '.dv-unit{font-size:14px;color:#64748b}',
    '.dv-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.dv-btn:hover{background:#4f46e5}',
    '.dv-btn.ghost{background:#e2e8f0;color:#475569}',
    '.dv-fb{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.dv-fb.good{background:#dcfce7;color:#166534}',
    '.dv-fb.bad{background:#fef3c7;color:#92400e}',
    '.dv-why{margin-top:8px;font-size:12.5px;color:#64748b;line-height:1.8}',
    '.dv-cv{background:#fff;border:1px solid #e2e8f0;border-radius:12px;display:block;margin-top:10px}',
    /* 除法積木長得和調色盤裡那顆一樣 —— 學生等一下要去拿的就是它。
       ⚠️ 這裡不是裝飾：形狀一致，「原來就是這塊」才連得起來。 */
    '.dv-div{display:inline-flex;align-items:center;gap:6px;background:#59c059;',
    '  border-radius:999px;padding:5px 12px}',
    '.dv-div input{width:66px;padding:5px 7px;border:0;border-radius:999px;text-align:center;',
    '  font-size:15px;font-weight:700;font-family:inherit}',
    '.dv-div span{color:#fff;font-weight:900;font-size:16px}',
    '.dv-tok{background:#ff6680;color:#fff;border:0;border-radius:999px;padding:5px 13px;',
    '  font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.dv-done{background:#dcfce7;border:2px solid #34d399;border-radius:14px;padding:14px 16px;',
    '  font-size:14px;line-height:1.9;color:#166534}',
    /* 問題拆解：編號用橘色圓圈，和課本「問題拆解①②③」對得起來 */
    '.dv-qs{list-style:none;counter-reset:dvq;margin:0;padding:0}',
    '.dv-qs>li{counter-increment:dvq;position:relative;padding:0 0 0 34px;margin:0 0 12px}',
    '.dv-qs>li::before{content:counter(dvq);position:absolute;left:0;top:1px;width:24px;height:24px;',
    '  border-radius:999px;background:#f97316;color:#fff;font-size:13px;font-weight:900;',
    '  display:flex;align-items:center;justify-content:center}',
    '.dv-qt{font-size:15px;font-weight:700;line-height:1.75;padding-top:2px}',
    '.dv-hint{margin-top:5px}',
    '.dv-hint summary{cursor:pointer;font-size:12.5px;color:#94a3b8;font-weight:700;list-style:none}',
    '.dv-hint summary::-webkit-details-marker{display:none}',
    '.dv-hint summary::before{content:"▸ "}',
    '.dv-hint[open] summary::before{content:"▾ "}',
    '.dv-hint summary:hover{color:#6366f1}',
    '.dv-hint>div{margin-top:5px;background:#f8fafc;border-left:3px solid #cbd5e1;',
    '  border-radius:0 8px 8px 0;padding:8px 12px;font-size:13px;line-height:1.9;color:#475569}',
    /* 圈選：一行一顆，點了會亮起來。長得像積木堆，和下面的拼圖對得起來 */
    '.dv-pick{margin-top:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}',
    '.dv-pt{font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:7px}',
    '.dv-line{display:block;width:100%;text-align:left;margin-bottom:5px;padding:7px 11px;',
    '  border:2px solid #e2e8f0;background:#f8fafc;border-radius:8px;font-size:13.5px;',
    '  font-family:inherit;cursor:pointer;transition:.12s;color:#334155}',
    '.dv-line:hover{border-color:#cbd5e1}',
    '.dv-line.on{background:#eef2ff;border-color:#6366f1;color:#3730a3;font-weight:700}',
    '.dv-line.on::before{content:"✓ ";font-weight:900}',
    /* 先寫再對照 */
    '.dv-write{margin-top:14px;background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:12px 14px}',
    '.dv-write textarea{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 11px;',
    '  border:2px solid #fde68a;border-radius:9px;font-family:inherit;font-size:13.5px;',
    '  line-height:1.8;resize:vertical}',
    '.dv-write textarea:focus{outline:none;border-color:#f59e0b}',
    '.dv-write textarea:disabled{background:#fff;color:#78350f}',
    /* 追蹤每一輪：兩排資料，未排序的可以點 */
    '.dv-round{font-size:12.5px;font-weight:900;color:#6366f1;margin:10px 0 6px}',
    '.dv-row2{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}',
    '.dv-tag{font-size:11px;font-weight:700;color:#64748b;min-width:52px}',
    '.dv-chip{min-width:44px;padding:8px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;color:#334155}',
    '.dv-chip.pickable{cursor:pointer}',
    '.dv-chip.pickable:hover{border-color:#6366f1;background:#eef2ff}',
    '.dv-chip.moved{border-color:#34d399;background:#dcfce7;color:#166534}',
    '.dv-chip.wrong{border-color:#f59e0b;background:#fef3c7}',
    '.dv-empty{font-size:12px;color:#cbd5e1}',
    /* ── 本尊與分身（kind:'clone'）───────────────────
       ⚠️ 本尊那一格「隱藏」的時候要**看得出來還在**（半透明＋虛線框），
          直接不畫的話學生會以為本尊被刪掉了 ——
          而概念檢測正好要問「本尊隱藏、分身顯示為什麼不打架」。 */
    '.dv-stage{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;',
    '  padding:12px 14px;margin-top:10px;text-align:center}',
    '.dv-body{display:inline-flex;align-items:center;gap:7px;font-size:26px;',
    '  border:2px solid #cbd5e1;border-radius:12px;padding:5px 12px;background:#fff}',
    '.dv-body.hid{opacity:.4;border-style:dashed}',
    '.dv-lab{font-size:11px;font-weight:900;color:#64748b}',
    '.dv-st{font-size:11px;font-weight:900;color:#94a3b8}',
    '.dv-body.hid .dv-st{color:#f59e0b}',
    '.dv-arrow{font-size:11.5px;font-weight:900;color:#a855f7;margin:5px 0;min-height:16px}',
    '.dv-clones{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;min-height:30px;',
    '  align-items:center}',
    '.dv-c{font-size:22px}',
    '.dv-hats{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
    '.dv-hat{flex:1;min-width:140px;border:2px solid #cbd5e1;border-radius:12px;',
    '  padding:7px 11px;background:#fff;text-align:left}',
    '.dv-hat-n{display:block;font-size:11.5px;font-weight:900;color:#475569}',
    '.dv-hat-v{display:block;font-size:19px;font-weight:900;margin-top:1px}',
    '.dv-ask2{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;',
    '  padding:11px 13px;margin-top:10px;font-size:13.5px;line-height:1.85}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('dv-style')) return;
    var s = document.createElement('style');
    s.id = 'dv-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, data, opts) {
    ensureStyle();
    opts = opts || {};
    data = data || {};
    var steps = data.steps || [];
    var at = 0;                 // 目前做到第幾步
    var anim = null;

    host.className = 'dv';
    host.innerHTML = '';

    if (data.intro) {
      var intro = document.createElement('div');
      intro.className = 'dv-intro';
      intro.innerHTML = data.intro;
      host.appendChild(intro);
    }

    var list = document.createElement('div');
    host.appendChild(list);

    var doneBox = document.createElement('div');
    host.appendChild(doneBox);

    function pass(i) {
      if (i !== at) return;
      at = i + 1;
      render();
      if (at >= steps.length) {
        doneBox.className = 'dv-done';
        doneBox.innerHTML = data.done || '推導完成，接下來把它拼成積木。';
        /* ⚠️⚠️ 2026-08-17 修：這裡原本只叫 opts.onPass，
           但 level.html 傳進來的是 **onDone**（問題分析那一支用的就是 onDone）——
           名字對不上，於是**推導做完之後什麼都不會發生**。
           而推導那一步沒有「下一步」按鈕，回呼是唯一的出路
           ⇒ 所有有推導的關卡（第 3、4、5 關）走到這裡就卡死。
           老師 2026-08-17 在第 3 關實際卡住。
           ★ 兩個都叫，而且兩個都不是必要的 ——
             這種「模組叫 A、呼叫端傳 B」的錯完全不會報錯，
             畫面上看起來就是「我明明做完了，它沒反應」。
             shared/tests/stepflow.test.js 現在會比對兩邊的名字。 */
        if (opts.onDone) opts.onDone();
        if (opts.onPass) opts.onPass();
      }
    }

    function render() {
      list.innerHTML = '';
      steps.forEach(function (st, i) {
        /* 只顯示做到的那一步和之前的。
           ★ 為什麼不整頁攤開：後面的題目會把前面的答案講出來
             （「正六邊形每次轉 60 度」這種），先看到就不用想了。 */
        if (i > at) return;
        list.appendChild(stepBox(st, i));
      });
    }

    function stepBox(st, i) {
      var box = document.createElement('div');
      box.className = 'dv-step ' + (i < at ? 'ok' : 'on');
      var head = '<p class="dv-q"><span class="dv-no">' + (i + 1) + '</span>' + st.q + '</p>';

      if (i < at) {
        // 過關的就收起來，只留答案，畫面不會愈滾愈長
        box.innerHTML = head + '<div class="dv-fb good">✓ ' + esc(st._got || '完成') + '</div>' +
          (st.why ? '<div class="dv-why">' + st.why + '</div>' : '');
        return box;
      }

      if (st.kind === 'ask')     box.innerHTML = head + askHtml(st);
      else if (st.kind === 'draw')    box.innerHTML = head + drawHtml(st);
      else if (st.kind === 'formula') box.innerHTML = head + formulaHtml(st);
      else if (st.kind === 'sort')    box.innerHTML = head + '<div class="dv-sort"></div>' +
                                                      '<div class="dv-fb" style="display:none"></div>';
      else if (st.kind === 'clone')   box.innerHTML = head + '<div class="dv-clone"></div>' +
                                                      '<div class="dv-fb" style="display:none"></div>';
      wire(box, st, i);
      return box;
    }

    /* ① 純問答：這種是「事實」，畫圖驗不出來（例如「一圈幾度」）*/
    function askHtml(st) {
      return '<div class="dv-row">' +
        '<input class="dv-in" type="number" inputmode="numeric" placeholder="?">' +
        (st.unit ? '<span class="dv-unit">' + esc(st.unit) + '</span>' : '') +
        '<button class="dv-btn" data-go>確定</button></div>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    /* ② 填角度 → 真的畫。過不過由圖形決定，不是由標準答案決定 */
    function drawHtml(st) {
      return '<div class="dv-row">' +
        '<span class="dv-unit">每次右轉</span>' +
        '<input class="dv-in" type="number" inputmode="decimal" placeholder="?">' +
        '<span class="dv-unit">度，走 ' + st.n + ' 條邊</span>' +
        '<button class="dv-btn" data-go>▶ 畫畫看</button></div>' +
        '<canvas class="dv-cv" width="330" height="240"></canvas>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    /* ③ 一般化：寫出算式，代入好幾個邊數一起驗 */
    function formulaHtml(st) {
      var ns = st.tests || [4, 6, 10];
      return '<div class="dv-row">' +
        '<span class="dv-div"><input data-l type="text" inputmode="numeric" placeholder="?">' +
        '<span>/</span><input data-r type="text" placeholder="?"></span>' +
        '<button class="dv-tok" data-fill="N">拿 N 來用</button>' +
        '<button class="dv-btn" data-go>▶ 代進去畫畫看</button></div>' +
        '<div class="dv-unit" style="margin-top:6px;font-size:12.5px">會用 ' +
        ns.join('、') + ' 邊形各畫一次，全部閉合才算對。</div>' +
        '<canvas class="dv-cv" width="330" height="240"></canvas>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    function wire(box, st, i) {
      var fb = box.querySelector('.dv-fb');
      var cv = box.querySelector('canvas');
      var go = box.querySelector('[data-go]');

      function say(ok, msg) {
        fb.style.display = '';
        fb.className = 'dv-fb ' + (ok ? 'good' : 'bad');
        fb.textContent = (ok ? '✓ ' : '✗ ') + msg;
      }
      function run(n, turn, after) {
        if (anim) anim.cancel();
        anim = draw(cv, n, turn, { onDone: after, color: closes(turn, n) ? '#10b981' : '#f59e0b' });
      }

      if (st.kind === 'ask') {
        var inp = box.querySelector('.dv-in');
        go.onclick = function () {
          var v = parseFloat(inp.value);
          if (!isFinite(v)) return say(false, '先填一個數字。');
          if (Math.abs(v - st.answer) < 1e-9) { st._got = v + (st.unit || ''); pass(i); }
          else say(false, st.miss || '再想一下。');
        };
        inp.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      }

      if (st.kind === 'draw') {
        var inp2 = box.querySelector('.dv-in');
        go.onclick = function () {
          var t = parseFloat(inp2.value);
          if (!isFinite(t)) return say(false, '先填一個角度。');
          run(st.n, t, function () {
            var r = checkAngle(t, st.n);
            say(r.ok, r.msg);
            if (r.ok) { st._got = '每次轉 ' + fmt(t) + ' 度'; setTimeout(function () { pass(i); }, 900); }
          });
        };
        inp2.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      }

      if (st.kind === 'sort') { wireSort(box, st, i, say, pass); return; }
      if (st.kind === 'clone') { wireClone(box, st, i, say, pass); return; }

      if (st.kind === 'formula') {
        var L = box.querySelector('[data-l]'), R = box.querySelector('[data-r]');
        var tok = box.querySelector('[data-fill]');
        // 「拿 N 來用」：一個按鈕就好，不必要求學生自己打對大小寫
        if (tok) tok.onclick = function () { R.value = 'N'; R.focus(); };
        go.onclick = function () {
          var f = { left: L.value, right: R.value };
          var v = verdict(f, st.tests);
          var n = v.ok ? (st.tests || [4, 6, 10])[1] : v.bad;
          run(n, turnFor(f, n), function () {
            say(v.ok, v.msg);
            if (v.ok) { st._got = fmt(f.left) + ' ÷ ' + String(f.right).trim(); setTimeout(function () { pass(i); }, 900); }
          });
        };
      }
    }

    /* 追蹤每一輪：學生從「未排序」點出最小的，看著它搬到「已排序」。 */
    function wireSort(box, st, i, say, passFn) {
      var left = (st.items || []).slice();      // 未排序
      var right = [];                            // 已排序
      var round = 0;
      var wrap = box.querySelector('.dv-sort');

      draw2();
      function draw2() {
        round++;
        wrap.innerHTML =
          '<div class="dv-round">第 ' + round + ' 回合</div>' +
          row('未排序', left, true) +
          row('已排序', right, false) +
          (left.length ? '<p class="dv-unit" style="font-size:12.5px;margin-top:4px">' +
             '點一下「未排序」裡<b>最小</b>的那一個。</p>' : '');
        [].forEach.call(wrap.querySelectorAll('[data-i]'), function (b) {
          b.onclick = function () { hit(Number(b.dataset.i), b); };
        });
      }
      function row(tag, list, pickable) {
        return '<div class="dv-row2"><span class="dv-tag">' + tag + '</span>' +
          (list.length
            ? list.map(function (x, k) {
                return '<button class="dv-chip' + (pickable ? ' pickable' : ' moved') + '"' +
                  (pickable ? ' data-i="' + k + '"' : '') + '>' + esc(label(x)) + '</button>';
              }).join('')
            : '<span class="dv-empty">（空的）</span>') + '</div>';
      }
      function hit(k, btn) {
        var r = pickMin(left, k);
        if (!r.ok) {
          btn.classList.add('wrong');
          say(false, r.msg);
          setTimeout(function () { btn.classList.remove('wrong'); }, 700);
          return;
        }
        right.push(left.splice(k, 1)[0]);
        if (left.length) {
          say(true, '找到最小值 ' + label(right[right.length - 1]) +
                    '，加到「已排序」的最後一項，並且從「未排序」刪掉。');
          draw2();
        } else {
          wrap.innerHTML = '<div class="dv-round">排好了</div>' + row('已排序', right, false);
          say(true, st.finish || '這就是選擇排序法：每一回合挑出最小的，搬到已排序的最後面。');
          st._got = right.map(label).join('、');
          setTimeout(function () { passFn(i); }, 900);
        }
      }
    }

    /* ── 本尊與分身（第 4 關 小鳥吃蟲）─────────────────
       ★ 為什麼需要這一段
         「分身」在前三關出現 **0 次**（前三關都在畫正方形），
         但第 4 關的概念檢測有**兩題**在考它：
           · 本尊隱藏、分身顯示，為什麼不打架？
           · 「當分身產生」和「當綠旗被點擊」差在哪？
         而唯一解釋這件事的 build 是掛在**拼圖**那一步 —— 在概念檢測之後。
         也就是說學生被問到的時候，畫面上從來沒有任何地方講過
         本尊和分身是兩回事。這一段就是補那個洞。

       ★ 為什麼要「先預測，再看答案」
         計數器直接攤在畫面上的話，學生會用讀的 ——
         讀出來的數字不代表他知道那塊帽子積木什麼時候會被觸發。
         ⇒ 先按綠旗、先吃幾隻（真的看到分身怎麼來的），
           再自己押一個數字，押對才把計數器打開。 */
    function wireClone(box, st, i, say, passFn) {
      var total = st.n || 10;          // 開場產生幾隻
      var alive = 0;                   // 現在畫面上有幾隻分身
      var born = 0;                    // 「當分身產生」被觸發了幾次（累計，不會減）
      var flag = 0;                    // 「當綠旗被點擊」被觸發了幾次
      var ate = 0;                     // 吃掉幾隻
      var opened = false;              // 計數器打開了沒（答對才開）
      var wrap = box.querySelector('.dv-clone');

      draw2();

      function draw2() {
        var ready = flag > 0 && ate >= (st.eat || 2);
        wrap.innerHTML =
          /* 本尊 */
          '<div class="dv-stage">' +
            '<div class="dv-body' + (flag ? ' hid' : '') + '">' +
              '<span class="dv-lab">本尊</span>🐛' +
              '<span class="dv-st">' + (flag ? '隱藏' : '顯示') + '</span>' +
            '</div>' +
            '<div class="dv-arrow">' + (flag ? '複製出 ↓' : '　') + '</div>' +
            '<div class="dv-clones">' +
              (alive
                ? new Array(alive + 1).join('<span class="dv-c">🐛</span>')
                : '<span class="dv-empty">（還沒有分身）</span>') +
            '</div>' +
          '</div>' +
          /* 兩塊帽子積木的觸發次數 */
          '<div class="dv-hats">' +
            hat('當綠旗被點擊', flag, '#22c55e') +
            hat('當分身產生', born, '#a855f7') +
          '</div>' +
          '<div class="dv-row" style="margin-top:9px">' +
            '<button class="dv-btn" data-act="flag"' + (flag ? ' disabled' : '') + '>🏳️ 按綠旗</button>' +
            '<button class="dv-btn ghost" data-act="eat"' + (alive ? '' : ' disabled') + '>🐦 吃掉一隻</button>' +
          '</div>' +
          '<p class="dv-unit" style="font-size:12.5px;margin-top:6px">' +
            (!flag
              ? '先按一次綠旗，看看那十隻蟲是<b>哪裡來的</b>。'
              : (ate < (st.eat || 2)
                  ? '再吃掉幾隻看看 —— 吃掉一隻會發生什麼事？（還要 ' +
                    ((st.eat || 2) - ate) + ' 隻）'
                  : '')) +
          '</p>' +
          /* ★ 預測欄：真的玩過才出現 */
          (ready && !opened
            ? '<div class="dv-ask2">' +
                '<b>' + (st.ask || '「當分身產生」那塊，到現在總共被觸發了幾次？') + '</b>' +
                '<div class="dv-row" style="margin-top:7px">' +
                  '<input class="dv-in" type="number" inputmode="numeric" placeholder="?">' +
                  '<button class="dv-btn" data-act="guess">送出</button>' +
                '</div>' +
                '<div class="dv-unit" style="font-size:12px;margin-top:5px">' +
                  '⚠️ 提示：開場那幾隻算不算？被吃掉又補上的那幾隻呢？</div>' +
              '</div>'
            : '');

        [].forEach.call(wrap.querySelectorAll('[data-act]'), function (b) {
          b.onclick = function () { act(b.dataset.act); };
        });
        var inp = wrap.querySelector('.dv-in');
        if (inp) inp.onkeydown = function (e) {
          if (e.key === 'Enter') wrap.querySelector('[data-act="guess"]').click();
        };
      }

      function hat(name, n, color) {
        return '<div class="dv-hat" style="border-color:' + color + '">' +
          '<span class="dv-hat-n">' + esc(name) + '</span>' +
          '<span class="dv-hat-v" style="color:' + color + '">' +
            (opened ? n + ' 次' : '？') + '</span></div>';
      }

      function act(what) {
        if (what === 'flag') {
          /* 綠旗：本尊先隱藏，再重複 n 次呼叫「產生蟲」。
             ★ 每呼叫一次就多一個分身，而每一個分身都會觸發一次「當分身產生」。 */
          flag = 1; alive = total; born = total;
          say(true, '本尊<b>隱藏</b>了 —— 但畫面上有 ' + total + ' 隻蟲。' +
                    '你看到的全部都是<b>分身</b>。');
          draw2();
          return;
        }
        if (what === 'eat') {
          if (!alive) return;
          ate++;
          /* 吃掉一隻：刪掉自己，再補一隻 —— 所以數量不變，但又觸發一次。 */
          born++;
          say(true, '刪掉一隻、又補一隻 —— 蟲的<b>數量沒變</b>，' +
                    '但「當分身產生」<b>又被觸發了一次</b>。');
          draw2();
          return;
        }
        if (what === 'guess') {
          var inp = wrap.querySelector('.dv-in');
          var v = parseFloat(inp && inp.value);
          if (!isFinite(v)) { say(false, '先填一個數字。'); return; }
          if (v === born) {
            opened = true;
            st._got = '綠旗 ' + flag + ' 次、當分身產生 ' + born + ' 次';
            draw2();
            say(true, st.finish ||
              ('對了 —— 綠旗只按了 <b>1</b> 次，「當分身產生」卻跑了 <b>' + born + '</b> 次。' +
               '<br>兩塊都是帽子積木，但<b>觸發的時機不一樣</b>：' +
               '綠旗是你按的，分身是每產生一個就自己跑一次。'));
            setTimeout(function () { passFn(i); }, 1100);
            return;
          }
          if (v === total) {
            say(false, '差一點 —— 你只算了開場那 ' + total + ' 隻。' +
                       '被吃掉之後<b>補上來</b>的那幾隻呢？它們也是新的分身。');
            return;
          }
          if (v === alive) {
            say(false, '那是<b>現在畫面上</b>有幾隻。問的是這塊積木<b>總共被觸發幾次</b> —— ' +
                       '被吃掉的那幾隻，當初也觸發過。');
            return;
          }
          say(false, '不是 ' + v + ' 次。開場產生了 ' + total + ' 隻，' +
                     '之後你吃掉幾隻、就補了幾隻。');
        }
      }
    }

    render();
    return { destroy: function () { if (anim) anim.cancel(); host.innerHTML = ''; } };
  }

  /* ── 問題拆解（課本的「問題分析」）─────────────────
     把一個大題目切成幾個小問題，這是這一章真正在教的東西
     （運算思維的「問題拆解」），不是拼積木的技巧。

     ★ 為什麼照課本的拆解，不自己排
       學生課堂上聽的、課本上印的就是這幾問。網站自己排一套順序，
       學生要在兩套講法之間翻譯 —— 那是白白多出來的負擔。

     ★ 為什麼提示要收起來
       五個問題連答案一起攤開，就變成「照著抄」。
       先讓學生自己想，想不出來才點開 ——
       點開這個動作本身也讓學生知道自己卡在第幾問。 */
  /* ── 問題分析：一題一題來 ─────────────────────────
     ★ 為什麼改成「一次只看一題」
       五問一次全部攤開的時候，學生做的事是「捲到底、找有按鈕的那一個」。
       課本的拆解本來就是有順序的推理 —— 先知道怎麼畫一個，
       才輪得到「六個怎麼排」，最後才問「哪一段重複」。
       一次一題，那個順序才會真的發生。

     ★ 為什麼「確認理解」不再是獨立的一步
       圈選題本來就是某一問的判斷，寫作題本來就是整段的收尾 ——
       把它們搬到另一頁，等於把同一件事切成兩半，
       學生還要重新想起「剛剛那一題在問什麼」。

     ⚠️ 只能有一顆「往下走」的按鈕。
        原本這裡自己畫一顆、關卡頁又補一顆，畫面上同時出現
        「想清楚了，開始動手」和「分析完了，往下走」——
        兩顆功能一樣的按鈕，學生只會想「這兩個有什麼不同」。 */
  function renderAnalysis(host, data, opts) {
    ensureStyle();
    opts = opts || {};
    if (!host) return;
    if (!data || !(data.qs || []).length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    host.className = 'dv';

    var qs = data.qs;
    var at = 0;                 // 現在看到第幾問
    var passed = {};            // 這一問過了沒
    var said = {};              // 沒有圈選題的那幾問，學生寫了什麼
    /* ⚠️ 這一行本來寫在底下 askHtml 的旁邊 —— 而 draw() 在那之前就被呼叫了，
       於是第一次畫的時候 chosen 還是 undefined，整個問題分析變成**一片空白**。
       ★ var 會被提升，但**指派不會** —— 少掉的東西不會報「未定義」，
         而是安靜地變成 undefined，然後在別的地方炸。
       ⇒ 狀態變數一律和其他狀態放在一起，放在第一次 draw() 之前。 */
    var chosen = {};            // 每一問抽到哪一題、選項怎麼排
    var wrongN = {};            // 這一問已經選錯幾次（見 penalty()）
    var usedAsk = {};           // 這一問已經抽過哪幾題（見 pickAsk()）
    /* ⚠️⚠️ 2026-08-17：**同一條規則又被犯了一次**。
       SAY_MIN 本來宣告在下面 sayHtml() 的旁邊（約 1030 行），
       但 sayHtml 在第一次 draw() 就會被呼叫 ——
       於是畫面上寫著「先寫下你現在的想法（至少 <b>undefined</b> 個字）」。
       ★ 老師回報「之前有幾次更新後，檢查字數都會變成 undefined 字」——
         就是這個。每次有人在下面新增一個常數，就再中一次。
       ⇒ 這裡是「第一次 draw() 之前」的唯一正確位置，**新的常數一律加在這裡**。
         shared/tests/undefined.test.js 現在會把每一關的畫面渲染出來，
         直接檢查有沒有 undefined／NaN 漏到畫面上。 */
    var SAY_MIN = 6;            // 沒有圈選題的那幾問，想法至少要寫幾個字

    host.innerHTML =
      (data.intro ? '<div class="dv-intro">' + data.intro + '</div>' : '') +
      '<div class="dv-prog"></div>' +
      '<div class="dv-one"></div>' +
      '<div class="dv-write-box"></div>' +
      '<div id="dv-go"></div>';

    draw();

    function draw() {
      prog();
      var box = host.querySelector('.dv-one');
      if (at >= qs.length) { box.innerHTML = ''; writeStage(); return; }

      var it = qs[at];
      /* ★ 提示改成題目後面的一顆 💡（2026-08-11）。
         原本是題目下面一整條「▸ 想不出來？點開看提示」——
         它佔掉一整行，而且就長在選項正上方，
         等於一直在對學生說「你大概想不出來吧」。
         做成圖示之後：想用的人看得到，不想用的人眼裡沒有它。 */
      box.innerHTML =
        '<div class="dv-num">第 ' + (at + 1) + ' 題 / 共 ' + qs.length + '</div>' +
        '<div class="dv-qt">' + it.q +
          (it.hint ? '<button class="dv-tip" data-tip="' + at + '" ' +
                     'title="看提示" aria-label="看提示">💡</button>' : '') +
        '</div>' +
        (it.pick ? pickHtml(it.pick, at) : askHtml(it, at)) +
        '<div class="dv-next"></div>';

      if (it.hint) wireTip(host, it, at);
      if (it.pick) wirePick(host, it.pick, at);
      else if (chosen[at]) wireAsk1(host, at);
      else wireSay(host, it, at);
      nextBar();
    }

    /* ── 提示的浮動視窗 ───────────────────────────────
       ⚠️ 提示照樣禁止滑鼠選取（見樣式表那一段）——
          換成浮動視窗不是為了讓它更好複製。 */
    function wireTip(root, it, i) {
      var b = root.querySelector('[data-tip="' + i + '"]');
      if (b) b.onclick = function () { openTip(it.hint); };
    }
    function openTip(html, locked) {
      var old = document.getElementById('dv-modal');
      if (old) old.remove();
      var m = document.createElement('div');
      m.id = 'dv-modal';
      m.className = 'dv-modal';
      m.innerHTML =
        '<div class="dv-modal-b">' +
          '<div class="dv-modal-h">💡 提示' +
            (locked ? '' : '<button class="dv-modal-x" aria-label="關閉">✕</button>') +
          '</div>' +
          '<div class="dv-modal-c">' + html + '</div>' +
          '<div class="dv-modal-f">' +
            (locked
              ? '<button class="dv-modal-ok" disabled>請先讀完（' + locked + '）</button>'
              : '<button class="dv-modal-ok">讀完了</button>') +
          '</div>' +
        '</div>';
      document.body.appendChild(m);
      var close = function () { m.remove(); };
      var x = m.querySelector('.dv-modal-x');
      if (x) x.onclick = close;
      var okb = m.querySelector('.dv-modal-ok');
      if (!locked) okb.onclick = close;
      /* ⚠️ 罰讀的時候不可以點背景關掉 —— 那就等於沒有罰。 */
      if (!locked) m.onclick = function (e) { if (e.target === m) close(); };
      return { box: m, ok: okb, close: close };
    }

    /* ── 沒有圈選題的那幾問：要寫一句 ─────────────────
       ★ 為什麼不能只放一顆「下一題」
         那樣學生一路按下去，五問完全沒看 —— 這一步就沒有意義了。
         而課本的五個問題本來就是要「想」的。

       ★ 但這裡**不判對錯**，寫了就能往下。
         這一段是「想一想」，不是關卡（真正的門檻在概念檢測）。
         判對錯的話學生會開始猜系統要什麼字，那正好毀掉這一步。

       ⇒ 折衷：一定要動手寫，但寫什麼都算數；
         有 keys 的話再給一句正向回饋（「你講到了…」），沒講到也不擋。 */
    /* ── 每一問的小判斷題（asks，3 題抽 1）─────────────
       ★ 為什麼從「寫一句」改成選擇題
         寫一句擋不住「把提示貼上來」—— 而提示裡本來就有想聽到的說法。
         選擇題貼不了，答錯還有具體的回饋。

       ★ 為什麼是 3 題抽 1
         隔壁同學拿到的不一樣，也不必為了變化寫一百題。

       ⚠️ 選項要洗牌 —— 正解固定在第一個的話，第二次就變成「背 A」。
       ⚠️ 沒有寫 asks 的問（例如 4-2-2 還沒補）就退回「寫一句」，
          而那條路一樣要擋抄襲（見 wireSay）。 */
    /**
     * 抽一題出來問。
     *
     * ★ 答錯之後要**換一題**（2026-08-11），不是把錯的選項劃掉重選。
     *   劃掉重選的話：四選一 → 三選一 → 二選一，
     *   一個完全不懂的學生也保證能過，而他學到的是刪去法。
     *   換一題就沒有這個問題 —— 每一次都是重新的四選一。
     *
     * ⚠️ 三題都用過之後回頭再用（reuse），但選項會重新洗牌。
     *    「用完就放行」等於答錯三次自動過關；
     *    「用完就卡死」則是把不懂的人關在門外 ——
     *    而他真正需要的是提示，那個由 penalty() 負責（錯兩次強制讀）。
     */
    function pickAsk(it, i) {
      var bank = it.asks || [];
      var used = usedAsk[i] || (usedAsk[i] = []);
      var left = bank.filter(function (_, k) { return used.indexOf(k) < 0; });
      if (!left.length) { used.length = 0; left = bank; }   // 一輪用完，重新來過
      var one = left[Math.floor(Math.random() * left.length)];
      used.push(bank.indexOf(one));
      var right = one.options[one.answer];
      var opts = shuffleArr(one.options);
      return { q: one.q, options: opts, answer: opts.indexOf(right), why: one.why || '' };
    }

    function askHtml(it, i) {
      var bank = it.asks || [];
      if (!bank.length) return sayHtml(i);
      if (!chosen[i]) chosen[i] = pickAsk(it, i);
      var a = chosen[i];
      return '<div class="dv-ask" data-ask="' + i + '">' +
        '<div class="dv-ask-q">' + a.q + '</div>' +
        a.options.map(function (o, k) {
          return '<button class="dv-opt" data-o="' + k + '">' + o + '</button>';
        }).join('') +
        '<div class="dv-fb" id="dv-askfb' + i + '" style="display:none"></div></div>';
    }
    function wireAsk1(root, i) {
      var wrap = root.querySelector('[data-ask="' + i + '"]');
      if (!wrap) return;
      var fb = root.querySelector('#dv-askfb' + i);
      wrap.addEventListener('click', function (e) {
        var b = e.target.closest('.dv-opt');
        if (!b || passed[i]) return;
        var k = +b.dataset.o, a = chosen[i];
        fb.style.display = '';
        if (k === a.answer) {
          passed[i] = true;
          b.classList.add('right');
          fb.className = 'dv-fb good';
          fb.innerHTML = '✓ ' + (a.why || '對了。');
          wrap.querySelectorAll('.dv-opt').forEach(function (x) { x.disabled = true; });
          prog(); nextBar();
        } else {
          /* ★ 答錯不鎖死，可以再選 —— 這一段是「想一想」不是考試。
             ⚠️ 但也不可以說出「為什麼是對的那個」。
                a.why 講的是**正解**為什麼對 —— 端在錯誤回饋裡，
                等於錯一次就把答案送給他，剩下三選一變成直接勾。 */
          b.classList.add('wrong');
          wrongN[i] = (wrongN[i] || 0) + 1;
          fb.className = 'dv-fb bad';
          /* ★ 錯兩次 → 強制讀提示（2026-08-11）。
             錯兩次通常不是手滑，是真的不懂 —— 而提示就是寫給這種情況的。
             他自己不會點（點提示像認輸），所以由系統打開。 */
          var punish = wrongN[i] >= PENALTY_WRONG && qs[i].hint;
          if (punish) {
            wrap.querySelectorAll('.dv-opt').forEach(function (x) { x.disabled = true; });
            fb.innerHTML = '✗ 這個不是。先看一下提示，等一下換一題再問你。';
            penalty(wrap, qs[i].hint, function () { swapAsk(i); });
            return;
          }
          /* ★ 換一題，不是把錯的選項劃掉讓他再選。
             劃掉重選是四選一 → 三選一 → 二選一，
             完全不懂的人也保證會過，而他學到的是刪去法。 */
          fb.innerHTML = '✗ 這個不是。<b>換一題再想想。</b>';
          wrap.querySelectorAll('.dv-opt').forEach(function (x) { x.disabled = true; });
          setTimeout(function () { swapAsk(i); }, 900);
        }
      });
    }

    /** 換下一題（答錯之後）。只重畫這一問，不動整頁。 */
    function swapAsk(i) {
      if (i !== at || passed[i]) return;      // 已經走掉或已經答對了就不要再插手
      chosen[i] = pickAsk(qs[i], i);
      draw();
    }

    /* ── 錯兩次的罰讀 ─────────────────────────────────
       ★ 為什麼是「讀提示」不是「退回重來」
         錯的是這一問，退回整段重讀罰得太重，只會讓人不耐煩；
         而不耐煩的人接下來就是亂點到過為止。
       ★ 為什麼用 READHOLD
         「秒數只在人真的在看的時候才走」這件事只該有一份規則。
         切到別的視窗會暫停，離開太久會重算 —— 和情境解說完全一樣。
       ⚠️ 沒載到 READHOLD 就只開提示、不鎖 —— 少罰一次，
          總比把學生鎖在一個永遠不會動的視窗裡好。 */
    function penalty(wrap, hint, then) {
      var free = function () { if (then) then(); };
      if (!global.READHOLD) { openTip(hint); free(); return; }
      var m = openTip(hint, PENALTY_SEC);
      global.READHOLD.start({
        sec: PENALTY_SEC,
        onTick: function (v) {
          m.ok.textContent =
            v.state === 'reset' ? '離開太久，重來（' + v.left + '）' :
            v.state === 'pause' ? '請回到這個畫面（' + v.left + '）' :
                                  '請先讀完（' + v.left + '）';
        },
        onDone: function () {
          m.ok.disabled = false;
          m.ok.textContent = '讀完了，換一題';
          m.ok.onclick = function () { m.close(); free(); };
        }
      });
    }
    function shuffleArr(a) {
      a = a.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    /* ⚠️ SAY_MIN 移到上面「第一次 draw() 之前」了 —— 見那裡的說明。
       放在這裡的話，第一次畫出來會是「至少 undefined 個字」。 */
    function sayHtml(i) {
      return '<div class="dv-say">' +
        '<textarea id="dv-say' + i + '" rows="2" ' +
        'placeholder="先寫下你現在的想法（至少 ' + SAY_MIN + ' 個字，寫不完整也沒關係）"></textarea>' +
        '<div class="dv-fb" id="dv-sayfb' + i + '" style="display:none"></div></div>';
    }
    function strip(x) { return String(x || '').replace(/<[^>]*>/g, ''); }
    function wireSay(root, it, i) {
      var ta = root.querySelector('#dv-say' + i);
      if (!ta) return;
      if (said[i]) { ta.value = said[i]; }
      ta.addEventListener('input', function () {
        var t = ta.value.trim();
        /* ⚠️ 這條路一樣要擋抄襲 —— 不擋的話，學生會把提示貼進來。
           （2026-08-10：抄襲判定原本只做在概念檢測，這裡漏掉了。） */
        var isCopy = (typeof window !== 'undefined' && window.ANSWER)
          ? window.ANSWER._copied(t, [strip(it.q), strip(it.hint)]) : false;
        said[i] = (t.length >= SAY_MIN && !isCopy) ? t : '';
        var fb = root.querySelector('#dv-sayfb' + i);
        if (fb && isCopy) {
          fb.style.display = ''; fb.className = 'dv-fb bad';
          fb.innerHTML = '這一段和題目／提示幾乎一樣。用你自己的話說說看。';
        } else if (fb && fb.className.indexOf('bad') >= 0) {
          fb.style.display = 'none';
        }
        nextBar();
      });
      ta.addEventListener('blur', function () {
        var fb = root.querySelector('#dv-sayfb' + i);
        if (!fb || !said[i] || !(it.keys || []).length) return;
        /* ★ 只給正向回饋，不給否定的。
           「你還沒講到 X」在這裡沒有用 —— 他還沒開始學，
           而且那句話會直接把答案講出去。 */
        var k = (typeof window !== 'undefined' && window.ANSWER && window.ANSWER.hitKeys)
          ? window.ANSWER.hitKeys(said[i], it.keys) : { hit: [] };
        if (!k.hit.length) { fb.style.display = 'none'; return; }
        fb.style.display = '';
        fb.className = 'dv-fb good';
        fb.innerHTML = '✓ 你講到了：' + esc(k.hit.join('、'));
      });
    }

    function prog() {
      host.querySelector('.dv-prog').innerHTML = qs.map(function (x, i) {
        return '<span class="dv-dot ' + (passed[i] ? 'ok' : i === at ? 'now' : '') + '"></span>';
      }).join('');
    }

    /* 沒有圈選題的那幾問，看完自己按「下一題」。
       ★ 這裡不設判定也不設時間 —— 它們是「想一想」，不是考題。
         擋在這裡只會讓學生開始猜系統要什麼。 */
    function nextBar() {
      var bar = host.querySelector('.dv-next');
      if (!bar) return;
      var it = qs[at];
      /* ⚠️ 沒有寫東西就不給「下一題」——
         這是「不能一路按下去」的實作，也是這一步唯一的門檻。 */
      var hasAsk = !it.pick && (it.asks || []).length > 0;
      var ready = (it.pick || hasAsk) ? passed[at] : !!said[at];
      bar.innerHTML = '<button class="dv-btn" style="width:100%;padding:10px" id="dv-nx"' +
        (ready ? '' : ' disabled') + '>' +
        (ready ? (at === qs.length - 1 ? '五題都想過了 →' : '下一題 →')
               : hasAsk ? '先選出正確的那一個'
               : '先寫下你的想法（至少 ' + SAY_MIN + ' 個字）') + '</button>';
      bar.querySelector('#dv-nx').onclick = function () {
        if (bar.querySelector('#dv-nx').disabled) return;
        passed[at] = true; at++; draw();
        if (host.scrollIntoView) host.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
    }

    /* ── 最後的寫作題 ─────────────────────────────
       ★ 判的是「有沒有講到概念」，不是字數。
         只看字數的話，亂打十五個字也會過 —— 那等於沒有這一題。
       ⚠️ 但回饋要說得出「還差什麼」，而且提示要拿得到。
         擋住卻不告訴他方向，他只會亂試到過為止。 */
    function writeStage() {
      var w = data.write;
      var box = host.querySelector('.dv-write-box');
      if (!w) { box.innerHTML = ''; refreshGo(); return; }
      if (host.__wrote) { refreshGo(); return; }
      box.innerHTML = writeHtml(w);
      wireWrite(host, w, opts);
      refreshGo();
    }

    function refreshGo() {
      var box = host.querySelector('#dv-go');
      if (!box || !opts.onDone) return;
      var need = data.write ? !!host.__wrote : at >= qs.length;
      if (!need) { box.innerHTML = ''; return; }
      box.innerHTML = '<button class="dv-btn" style="width:100%;padding:12px" id="dv-godo">' +
        '想清楚了，開始動手 →</button>';
      box.querySelector('#dv-godo').onclick = function () { opts.onDone(host.__wrote || ''); };
    }

    function wirePick(root, p, i) {
      var wrap = root.querySelector('[data-pick="' + i + '"]');
      if (!wrap) return;
      var fb = wrap.querySelector('.dv-fb');
      var done = false;
      wrap.addEventListener('click', function (e) {
        var row = e.target.closest('[data-line]');
        if (row && !done) { row.classList.toggle('on'); return; }
        if (!e.target.closest('[data-check]') || done) return;
        var got = [].slice.call(wrap.querySelectorAll('[data-line].on'))
          .map(function (r) { return Number(r.dataset.line); }).sort();
        var want = (p.answer || []).slice().sort();
        fb.style.display = '';
        if (got.join() === want.join()) {
          done = true; passed[i] = true;
          fb.className = 'dv-fb good';
          fb.innerHTML = '✓ ' + (p.ok || '對了。');
          var cb = wrap.querySelector('[data-check]');
          if (cb) cb.remove();
          prog(); nextBar();
        } else {
          fb.className = 'dv-fb bad';
          fb.innerHTML = '✗ ' + missMsg(p, got, want);
        }
      });
    }

    function wireWrite(root, w, o) {
      var ta = root.querySelector('#dv-write');
      var btn = root.querySelector('#dv-wbtn');
      var out = root.querySelector('#dv-wout');
      var tries = 0;
      btn.onclick = function () {
        var t = ta.value.trim();
        var r = judgeWrite(t, w);
        out.style.display = '';
        if (r.level === 'none') {
          tries++;
          out.className = 'dv-fb bad';
          out.innerHTML = esc(r.why) +
            /* ★ 試兩次還不過就直接把提示端出來。
               這一題是「想一想」的收尾，不是關卡 ——
               卡在這裡的代價是他連課本的說法都看不到。 */
            (tries >= 2 && w.hintText
              ? '<div style="margin-top:6px">💡 ' + w.hintText + '</div>' : '');
          return;
        }
        host.__wrote = t;
        ta.disabled = true; btn.remove();
        out.className = 'dv-fb good';
        /* ★ 寫完才顯示課本的說法。
             先給答案的話，學生會照抄；而這一步的重點是「先有自己的想法」。 */
        out.innerHTML = '<b>' + esc(r.why) + '</b>' +
          '<div style="margin-top:8px"><b>課本是這樣說的：</b>' + w.sample + '</div>' +
          '<div style="margin-top:6px;font-size:12px;opacity:.75">' +
          '兩邊不一樣沒關係 —— 講得出自己的理由才是重點。</div>';
        if (o.onWrite) o.onWrite(t);
        refreshGo();
      };
    }
  }

  /* 寫作題的判定。
     ★ 一律走 shared/answer.js —— 站上「有沒有講到這幾個概念」只能有一套規則。
     ⚠️ answer.js 沒載到時**放行**，不要擋人。
        這一題不是關卡的鎖（真正的門檻在概念檢測），
        少載一支 js 就讓所有人卡在這裡，是最不划算的擋法。 */
  function judgeWrite(text, w) {
    var t = String(text || '').trim();
    if (typeof window !== 'undefined' && window.ANSWER && (w.keys || []).length) {
      /* ⚠️ 題目本身也要當抄襲來源 —— 把題目倒著抄一遍不算「自己的話」。
         課本的說法（sample）寫完才會出現，所以不必比對。 */
      return window.ANSWER.judge(t, {
        need: w.keys, full: 1, min: w.min || 12,
        src: [String(w.q || '').replace(/<[^>]*>/g, '')]
      });
    }
    return t.length >= (w.min || 12)
      ? { level: 'full', why: '你寫的：' + t }
      : { level: 'none', why: '再多寫一點 —— 至少 ' + (w.min || 12) + ' 個字。' };
  }

  /** 圈選題：哪幾行是一直重複的 */
  function pickHtml(p, i) {
    return '<div class="dv-pick" data-pick="' + i + '">' +
      '<div class="dv-pt">' + (p.prompt || '點選你認為對的那幾行') + '</div>' +
      (p.lines || []).map(function (t, k) {
        return '<button data-line="' + k + '" class="dv-line">' + t + '</button>';
      }).join('') +
      '<button data-check class="dv-btn" style="margin-top:8px">確定</button>' +
      '<div class="dv-fb" style="display:none"></div></div>';
  }

  /* 錯的時候要講「哪裡不一樣」，不是只說錯。
     多選了或少選了是兩種不同的誤解，講反了會把學生推向反方向。 */
  function missMsg(p, got, want) {
    var extra = got.filter(function (x) { return want.indexOf(x) < 0; });
    var less = want.filter(function (x) { return got.indexOf(x) < 0; });
    if (extra.length && p.tooMany) return p.tooMany;
    if (less.length && p.tooFew) return p.tooFew;
    if (extra.length) return '多選了 ' + extra.length + ' 行。再想想那一行是不是這件事的一部分。';
    return '還少了 ' + less.length + ' 行。';
  }

  function writeHtml(w) {
    return '<div class="dv-write">' +
      '<div class="dv-qt">✍️ ' + w.q + '</div>' +
      '<textarea id="dv-write" rows="3" placeholder="用你自己的話寫，寫完才會看到課本怎麼說"></textarea>' +
      '<button id="dv-wbtn" class="dv-btn" style="margin-top:8px">寫好了，看看課本怎麼說</button>' +
      '<div id="dv-wout" class="dv-fb" style="display:none"></div></div>';
  }

  global.DERIVE = {
    VERSION: VERSION,
    mount: mount,
    renderAnalysis: renderAnalysis,
    _judgeWrite: judgeWrite,
    _turnFor: turnFor,
    _closes: closes,
    _laps: laps,
    _checkAngle: checkAngle,
    _verdict: verdict,
    _polyPath: polyPath,
    _minAt: minAt,
    _pickMin: pickMin
  };

})(typeof window !== 'undefined' ? window : this);
