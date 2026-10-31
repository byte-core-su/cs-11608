/* =====================================================================
   檢核關卡的共用骨架（5016B 智慧家居機電專題，五節課共用）
   ---------------------------------------------------------------------
   分工：
     **引擎**（這一支）  畫面元件、換一題、開放式作答的判定、旋鈕、風扇、距離舞台
     **內容**（各單元）  題目、選項、判定、流程 —— 每一節自己決定

   流程刻意不抽出來：各節的檢核形狀不同（填數字、選選項、調秒數）。

   三個檢核共用的設計原則：
     **先講你認為會怎樣 → 再執行 → 說對了才算**
     純「做出來」擋不住試誤，純「答對」擋不住猜。

   誰在用：doorlab、potlab、fanlab、rgblab、lightlab、mixlab、maplab、planlab、projlab（各 *lab.js）
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-10-23';

  /* ── 換一題 ──────────────────────────────────────────
     答錯就換一題：重試同一題的話，第二次答對只證明他記得剛才的答案。
     有守衛：亂數連續吐同一個值時，最多試 30 次。 */
  function pick(rng, list, prev, keyOf) {
    var key = keyOf || function (x) { return x && x.key; };
    for (var g = 0; g < 30; g++) {
      var x = list[Math.floor(rng() * list.length) % list.length];
      if (!prev || key(x) !== key(prev)) return x;
    }
    return list[0];
  }

  /* ── 開放式作答 ──────────────────────────────────────
     每一節都有一題「用你自己的話說」：選擇題測得出選得對，測不出知不知道為什麼。

     判定一律走 shared/answer.js（本機關鍵字、不連網、秒回、每次一致），
     不要在各單元另寫一套關鍵字比對。

     spec: { need:[{name,any:[]}], full:1, min:8, src:[抄襲來源] }
     full 建議 1（講到任何一個就算過）：要求兩個以上容易誤判「明明講懂了卻沒過」。 */
  function judgeSay(text, spec) {
    var t = String(text == null ? '' : text).trim();
    spec = spec || {};
    var min = spec.min || 8;
    if (global.ANSWER && global.ANSWER.judge) {
      return global.ANSWER.judge(t, {
        need: spec.need || [], full: spec.full || 1, min: min,
        /* 題目與正確選項都算抄襲來源（把題目倒抄一遍不算「自己的話」）。
           抽到哪一組就比哪一組。 */
        src: spec.src || []
      });
    }
    /* 退路：answer.js 沒載到時放行，不要整頁壞掉 */
    return t.length >= min
      ? { level: 'full', got: [], miss: [], why: '你寫的：' + t }
      : { level: 'none', got: [], miss: [], why: '再多寫一點 —— 至少 ' + min + ' 個字。' };
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  /* 距離舞台（第五節）：感測器在右邊，人越近越右 */
  '.lk-dist{position:relative;height:104px;background:#f8fafc;border:2px solid #e2e8f0;' +
    'border-radius:14px;overflow:hidden}' +
  '.lk-dist-s{position:absolute;right:8px;top:22px;font-size:30px;transform:scaleX(-1)}' +
  '.lk-dist-o{position:absolute;top:22px;font-size:30px;transform:translateX(-50%);' +
    'transition:left .12s linear}' +
  '.lk-dist-r{position:absolute;right:44px;bottom:26px;height:0;' +
    'border-top:3px dashed #94a3b8}' +
  '.lk-dist-r span{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);' +
    'font-size:14px;font-weight:900;color:#334155;background:#f8fafc;padding:0 8px;' +
    'white-space:nowrap}' +
  /* 會轉的風扇（第三、五節） */
  '@keyframes lk-spin{to{transform:rotate(360deg)}}' +
  '.lk-fan{display:flex;justify-content:center}' +
  '.lk-fanb{width:72px;height:72px;display:block}' +
  '.lk-fan.stop{opacity:.45;filter:grayscale(1)}' +
  /* 旋鈕（第三、四節）。touch-action:none：不然手機上一拖就變成捲頁面 */
  '.lk-dial{display:block;margin:0 auto;width:190px;max-width:60vw;cursor:grab;' +
    'touch-action:none}' +
  '.lk-dial:active{cursor:grabbing}' +
  '.dl-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.dl-tab{flex:1;min-width:150px;padding:9px 10px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font-weight:900;font-size:13px;color:#94a3b8}' +
  '.dl-tab.on{border-color:#7c3aed;color:#5b21b6;background:#f5f3ff}' +
  '.dl-tab.ok{border-color:#10b981;color:#047857;background:#ecfdf5}' +
  '.dl-ask{font-size:16px;font-weight:900;color:#0f172a;margin:12px 0 8px;line-height:1.8}' +
  '.dl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}' +
  '.dl-num{font-size:20px;font-weight:900;width:110px;padding:10px 12px;border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.dl-go{background:#7c3aed;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;border:none;border-radius:12px;cursor:pointer}' +
  '.dl-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;font-weight:700;cursor:pointer}' +
  '.dl-opt:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.dl-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.8}' +
  '.dl-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.dl-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.dl-tape{display:flex;gap:2px;margin:10px 0;flex-wrap:wrap}' +
  '.dl-cell{width:22px;height:34px;border-radius:5px;background:#e2e8f0;font-size:10px;text-align:center;line-height:34px;color:#64748b;font-weight:900}' +
  '.dl-cell.open{background:#34d399;color:#064e3b}' +
  '.dl-cell.close{background:#f87171;color:#7f1d1d}' +
  '.dl-note{font-size:13px;color:#64748b;line-height:1.8;margin-top:6px}';

  function ensureCss() {
    if (document.getElementById('labkit-css')) return;
    var st = document.createElement('style');
    st.id = 'labkit-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function md(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'); }

  /** 上面那三個分頁。names 例如 { A:'A 感測→判斷', … } */
  function tabsHtml(order, names, cur, done) {
    return '<div class="dl-tabs">' + order.map(function (k) {
      var cls = done[k] ? 'ok' : (k === cur ? 'on' : '');
      return '<div class="dl-tab ' + cls + '">' + (done[k] ? '✅ ' : '') + esc(names[k]) + '</div>';
    }).join('') + '</div>';
  }

  /* 「用你自己的話說」那一格。
     作答要從外面傳進來再回填（o.text）：放在 DOM 裡的話，每次重畫學生打的字就沒了。 */
  function sayHtml(o) {
    o = o || {};
    return '<div class="dl-ask" style="margin-top:16px">✍️ ' + esc(o.q || '') + '</div>' +
      '<textarea id="dl-say" rows="2" style="width:100%;border:2px solid #cbd5e1;' +
      'border-radius:12px;padding:10px;font-size:15px" ' +
      'placeholder="寫幾句就好，講得沒那麼漂亮沒關係">' + esc(o.text || '') + '</textarea>' +
      '<div class="dl-row"><button class="dl-go" id="dl-runB"' +
      (o.busy ? ' disabled' : '') + '>' + (o.busy ? '看看你寫的…' : '送出') + '</button>' +
      '<span class="dl-note">⚠️ 寫錯不會扣分，可以一直改。</span></div>';
  }

  /* ═══ 旋鈕（第三、四節共用）══════════════════════════════
     模擬旋轉式可變電阻。幾何只放這一份，兩節的手感才會一致。 */
  var DIAL_SWEEP = 270;                       // 真實旋鈕大約轉 270 度
  function dialAngle(pct) { return -DIAL_SWEEP / 2 + DIAL_SWEEP * pct / 100; }
  /* 角度 → 百分比。一定要夾住：從最左再往左轉，角度會繞到另一端，
     不夾的話百分比會突然跳到最右。 */
  function dialPctFromAngle(deg) {
    if (deg < -DIAL_SWEEP / 2) deg = -DIAL_SWEEP / 2;
    if (deg > DIAL_SWEEP / 2) deg = DIAL_SWEEP / 2;
    return Math.round((deg + DIAL_SWEEP / 2) / DIAL_SWEEP * 100);
  }
  /** 旋鈕的 SVG。o: { cls, needleId, legs }
      指針獨立成一個 g 並給 id —— 轉動時只改它的 transform（見 dialBind）。 */
  function dialSvg(pct, o) {
    o = o || {};
    var legs = o.legs !== false, h = legs ? 128 : 108;
    var ticks = '';
    for (var i = 0; i <= 10; i++) {
      var t = -DIAL_SWEEP / 2 + DIAL_SWEEP * i / 10;
      ticks += '<line x1="60" y1="14" x2="60" y2="21" stroke="#cbd5e1" stroke-width="2" ' +
               'transform="rotate(' + t + ' 60 60)"/>';
    }
    return '<svg class="lk-dial ' + (o.cls || '') + '" viewBox="0 0 120 ' + h + '" ' +
        'role="img" aria-label="可變電阻（旋鈕）">' +
      ticks +
      '<circle cx="60" cy="60" r="34" fill="#e7e5e4" stroke="#78716c" stroke-width="3"/>' +
      '<g id="' + (o.needleId || 'lk-needle') + '" transform="rotate(' + dialAngle(pct) + ' 60 60)">' +
        '<line x1="60" y1="60" x2="60" y2="32" stroke="#0891b2" stroke-width="7" ' +
          'stroke-linecap="round"/>' +
      '</g>' +
      '<circle cx="60" cy="60" r="9" fill="#a8a29e"/>' +
      (legs
        ? /* 三支腳（朝下），和實物一樣由左到右 1、2、3 */
          '<line x1="44" y1="92" x2="44" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
          '<line x1="60" y1="94" x2="60" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
          '<line x1="76" y1="92" x2="76" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
          '<text x="44" y="126" text-anchor="middle" font-size="12" font-weight="900" ' +
            'fill="#64748b">1</text>' +
          '<text x="60" y="126" text-anchor="middle" font-size="12" font-weight="900" ' +
            'fill="#0891b2">2</text>' +
          '<text x="76" y="126" text-anchor="middle" font-size="12" font-weight="900" ' +
            'fill="#64748b">3</text>'
        : '') +
    '</svg>';
  }
  /** 把旋鈕接上事件。o: { get, set, onRelease }
      ⚠️ 轉動時不可以重畫整個旋鈕：重畫會換掉正在被拖曳的 SVG，
         監聽器和 pointer capture 跟著消失，滑鼠只剩第一下有效。
         呼叫端在轉動時只改指針的 transform；要整頁重畫前先問 dragging()。 */
  function dialBind(svg, o) {
    if (!svg) return { dragging: function () { return false; } };
    var dragging = false;
    function pctFromPoint(cx, cy) {
      var r = svg.getBoundingClientRect();
      var dx = cx - (r.left + r.width / 2);
      var dy = cy - (r.top + r.height * 0.47);
      return dialPctFromAngle(Math.atan2(dx, -dy) * 180 / Math.PI);  // 12 點鐘方向為 0
    }
    var stop = function () {
      dragging = false;
      if (typeof o.onRelease === 'function') o.onRelease();
    };
    svg.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
      o.set(pctFromPoint(e.clientX, e.clientY));
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      o.set(pctFromPoint(e.clientX, e.clientY));
    });
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    svg.addEventListener('pointerleave', stop);
    /* 滾輪也能轉 */
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      o.set(o.get() + (e.deltaY < 0 ? 5 : -5));
    }, { passive: false });
    /* 鍵盤也能轉（觸控板拖不順的時候） */
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { o.set(o.get() - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { o.set(o.get() + 5); e.preventDefault(); }
      if (e.key === 'Home') { o.set(0); e.preventDefault(); }
      if (e.key === 'End') { o.set(100); e.preventDefault(); }
    });
    return { dragging: function () { return dragging; } };
  }

  /* ═══ 距離舞台（第五節複習用）═══════════════════════
     感測器 📡 ＋ 會走的人 🧍 ＋ 虛線尺標。
     感測器放**右邊**：人往右＝靠近＝距離變小，和全彩燈條的燈號同方向。
     （第一節的舞台有聲波去回的動畫，教的是「要除以 2」；這裡只看「人走近，數字變小」，所以分開。） */
  function distStage(cm, lo, hi) {
    var a = Math.max(lo, Math.min(hi, Number(cm) || 0));
    /* 人的位置：越近越靠右。留 8%～88% 免得貼邊被切掉。 */
    var pct = 88 - 80 * (a - lo) / (hi - lo);
    return '<div class="lk-dist">' +
      '<div class="lk-dist-s">📡</div>' +
      '<div class="lk-dist-o" style="left:' + pct.toFixed(1) + '%">🧍</div>' +
      '<div class="lk-dist-r" style="left:' + pct.toFixed(1) + '%">' +
        '<span>' + a + ' 公分</span></div>' +
    '</div>';
  }

  /* ═══ 會轉的風扇（第三、五節共用）═══════════════════
     轉速越快轉越快；最快 0.32 秒一圈（太快會糊成圓盤），
     第一片葉片不同色，快轉時還看得出正轉或反轉。 */
  var FAN_MAX = 250;             // 課本那組：類比對應（A7，−250，250）
  function fanSpin(v, max) {
    var m = max || FAN_MAX, a = Math.min(1, Math.abs(Number(v) || 0) / m);
    if (a < 0.02) return { dur: 0, rev: false, a: 0 };
    return { dur: Math.round((2.4 - 2.08 * a) * 100) / 100, rev: (Number(v) || 0) < 0, a: a };
  }
  function fanHtml(v, max) {
    var sp = fanSpin(v, max);
    var style = sp.dur
      ? 'animation:lk-spin ' + sp.dur + 's linear infinite' +
        (sp.rev ? ' reverse' : '')
      : '';
    /* 停著的時候整顆變淡、葉片轉灰，一眼看得出是停的 */
    return '<div class="lk-fan' + (sp.dur ? '' : ' stop') + '">' +
      '<svg viewBox="0 0 100 100" class="lk-fanb" style="' + style + '">' +
      '<circle cx="50" cy="50" r="46" fill="none" stroke="#334155" stroke-width="3"/>' +
      /* 第一片刻意不同色 —— 轉快的時候靠它看方向 */
      '<ellipse cx="50" cy="26" rx="9" ry="21" fill="#f59e0b"/>' +
      '<ellipse cx="50" cy="74" rx="9" ry="21" fill="#94a3b8"/>' +
      '<ellipse cx="26" cy="50" rx="21" ry="9" fill="#94a3b8"/>' +
      '<ellipse cx="74" cy="50" rx="21" ry="9" fill="#94a3b8"/>' +
      '<circle cx="50" cy="50" r="9" fill="#475569"/></svg></div>';
  }

  /* 色相 → 紅綠藍（第四、五節共用）。只是讓畫面看得見顏色，學生不必看這段。 */
  function hueRgb(h) {
    var x = (((h % 360) + 360) % 360) / 60, i = Math.floor(x), f = x - i;
    var up = Math.round(255 * f), dn = 255 - up;
    return [[255, up, 0], [dn, 255, 0], [0, 255, up], [0, dn, 255],
            [up, 0, 255], [255, 0, dn]][i % 6];
  }
  function hexOf(rgb) {
    return '#' + rgb.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }

  global.LABKIT = {
    VERSION: VERSION,
    pick: pick,
    judgeSay: judgeSay,
    ensureCss: ensureCss,
    esc: esc,
    md: md,
    tabsHtml: tabsHtml,
    dialAngle: dialAngle,
    dialPctFromAngle: dialPctFromAngle,
    distStage: distStage,
    fanHtml: fanHtml,
    hueRgb: hueRgb,
    hexOf: hexOf,
    dialSvg: dialSvg,
    dialBind: dialBind,
    sayHtml: sayHtml,
    CSS: CSS
  };

})(typeof window !== 'undefined' ? window : this);
