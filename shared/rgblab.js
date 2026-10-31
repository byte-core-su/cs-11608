/* =====================================================================
   RGB 三原色混色（5016B 第四節「情境照明」暖身）
   ---------------------------------------------------------------------
   重點：**紅、綠、藍三盞燈疊在一起，會混出什麼顏色。**（色相換算的三個 sin 完全不碰）

   三個節點：
     ① 混混看　　三個滑桿調 R／G／B，調出指定的顏色
     ② 光不是顏料　美術課的顏料越混越暗，光越混越亮
     ③ 複習轉換　轉旋鈕看燈號移動與換色，再填「類比對應（A7，0，359）」

   ② 是這一關真正的重點：學生在美術課學的是顏料（混起來變濁、變暗），
      不點破的話，「紅+綠=黃」在他腦中是講不通的。
   ===================================================================== */
(function (global) {
  'use strict';

  var PIN = 'A7';
  var HUE_MAX = 359;             // 課本那組：類比對應（A7，0，359）

  function LK() {
    if (!global.LABKIT) throw new Error('rgblab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function rngFrom(seed) {
    if (global.ULTRALAB && global.ULTRALAB.rngFrom) return global.ULTRALAB.rngFrom(seed);
    return Math.random;
  }

  /* ── ① 要調出來的顏色 ──────────────────────────────
     ★ 只用「開／關」的組合（0 或 255）—— 這一關要的是
       「哪幾盞燈亮著」，不是精細調色。
     ⚠️ 刻意不放「紅」「綠」「藍」本身：那三個只要開一盞，
        混不混得起來看不出來。 */
  var MIXES = [
    { key: 'yellow',  name: '黃色',   want: [1, 1, 0], hex: '#ffff00',
      why: '紅光 ＋ 綠光 ＝ 黃光。⚠️ 顏料的話紅加綠會變濁，光不是。' },
    { key: 'cyan',    name: '青色',   want: [0, 1, 1], hex: '#00ffff',
      why: '綠光 ＋ 藍光 ＝ 青色（天空藍那種）。' },
    { key: 'magenta', name: '洋紅色', want: [1, 0, 1], hex: '#ff00ff',
      why: '紅光 ＋ 藍光 ＝ 洋紅（桃紅色）。' },
    { key: 'white',   name: '白色',   want: [1, 1, 1], hex: '#ffffff',
      why: '★ 三盞全開就是**白光** —— 這是光和顏料最不一樣的地方。' }
  ];
  function caseMix(rng, prev) { return LK().pick(rng, MIXES, prev); }

  /* 判定：每一個通道都要「夠亮」或「夠暗」。
     ⚠️ 不要求剛好 255／0 —— 拖到 240 就算他懂了，
        卡在最後幾格只會讓人以為自己想錯了。 */
  var ON = 200, OFF = 55;
  function judgeMix(rgb, c) {
    var st = rgb.map(function (v) { return v >= ON ? 1 : (v <= OFF ? 0 : -1); });
    if (st.indexOf(-1) >= 0) return { ok: false, how: 'mid', st: st };
    var same = st.every(function (v, i) { return v === c.want[i]; });
    return { ok: same, how: same ? 'fit' : 'wrong', st: st };
  }
  var CH = ['紅', '綠', '藍'];
  function sayMix(r, c) {
    if (r.how === 'fit') return '✅ 對了！' + c.why;
    if (r.how === 'mid')
      return '⚠️ 有的滑桿停在中間。這一關先只用「**全開**」或「**全關**」—— ' +
             '把每一根都推到底或拉到 0。';
    /* 指出多開了哪一盞、少開了哪一盞 —— 不要只說「不對」。 */
    var more = [], less = [];
    r.st.forEach(function (v, i) {
      if (v === 1 && c.want[i] === 0) more.push(CH[i]);
      if (v === 0 && c.want[i] === 1) less.push(CH[i]);
    });
    return '⚠️ 還不是' + c.name + '。' +
      (more.length ? '**' + more.join('、') + '**開著，要關掉。' : '') +
      (less.length ? '**' + less.join('、') + '**沒開，要打開。' : '');
  }

  /* ── ② 光不是顏料 ─────────────────────────────────
     ★★ 這一關的重點。⚠️ 三個選項都是學生真的會選的。 */
  var Q2 = [
    { q: '美術課調顏料的時候，紅色加綠色會變成**濁濁的咖啡色**。<br>' +
         '那**紅光加綠光**呢？',
      opts: [{ k: 'add', good: true, t: '變成**黃色**，而且比原本更亮' },
             { k: 'paint', good: false, t: '一樣是咖啡色' },
             { k: 'dark', good: false, t: '互相抵消，變暗' }],
      why: '★ 顏料是**把光吃掉**（越混越暗），燈是**把光加上去**（越混越亮）。' },
    { q: '紅、綠、藍三盞燈**全部開到最亮**，看起來會是什麼顏色？',
      opts: [{ k: 'white', good: true, t: '**白色**' },
             { k: 'black', good: false, t: '黑色（三個混在一起會抵消）' },
             { k: 'brown', good: false, t: '咖啡色' }],
      why: '★ 三種光疊在一起就是白光 —— 太陽光就是這樣來的。' },
    { q: '要讓燈條**完全不亮**（黑色），三個數字要怎麼填？',
      opts: [{ k: 'zero', good: true, t: '紅 0、綠 0、藍 0 —— 三盞都不開' },
             { k: 'mix', good: false, t: '紅 255、綠 255、藍 255' },
             { k: 'half', good: false, t: '各填一半（128）' }],
      why: '⚠️ 黑色不是一種光，是**沒有光**。三盞都關掉才是黑的。' }
  ];
  function caseQ2(rng, prev) { return LK().pick(rng, Q2, prev, function (x) { return x.q; }); }

  /* ── ③ 旋轉旋鈕 → 燈號移動 ＋ 換色 ─────────────────
     轉它，亮的那一顆會跑，顏色也跟著換（這一節的兩個模式同時看得見）。
     兩端都轉到才出題 —— 要自己轉一遍才有感覺。 */
  var LEDS = 8;
/* 1 到 8 中間只有**七格**間隔 */
  function posAt(pct) { return Math.round(1 + (LEDS - 1) * clamp(pct) / 100); }
  function hueAt(pct) { return Math.round(HUE_MAX * clamp(pct) / 100); }
  function clamp(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }
  /* 色相 → 紅綠藍。★ 算法在 labkit（第五節的展示也要用，不可以有兩份）。 */
  function hueRgb(h) { return LK().hueRgb(h); }

  /* ── ③ 的填空：複習「類比對應」那一塊（0～359） ───── */
  function caseHue(rng, prev) {
    var spots = [];
    /* 不挑整除的位置（359 幾乎除不盡），答案四捨五入、容許 ±2：
       考的是會不會用那塊積木，不是心算精度。 */
    for (var p = 10; p <= 90; p += 10) {
      spots.push({ pct: p, answer: Math.round(HUE_MAX * p / 100) });
    }
    for (var g = 0; g < 30; g++) {
      var s = spots[Math.floor(rng() * spots.length) % spots.length];
      if (!prev || s.pct !== prev.pct) return { pct: s.pct, answer: s.answer };
    }
    return spots[0];
  }
  function judgeHue(ans, c) {
    var t = String(ans).trim(), n = Number(t);
    /* ⚠️ 容許 ±2 —— 這一題考的是「會不會用那塊積木」，不是心算精度。 */
    return t !== '' && isFinite(n) && Math.abs(n - c.answer) <= 2;
  }
  function sayHue(ans, c) {
    var n = Number(String(ans).trim());
    if (isFinite(n) && Math.abs(n - c.pct) <= 2)
      return '⚠️ 你寫的是**旋鈕的百分比**，不是換算後的值。' +
             '那塊積木會把它換到 0～' + HUE_MAX + '。';
    if (isFinite(n) && n > HUE_MAX)
      return '⚠️ 超過 ' + HUE_MAX + ' 了 —— 上限就是 ' + HUE_MAX + '（繞完一圈就回到起點）。';
    return '整個範圍是 0～' + HUE_MAX + '。旋鈕轉到 ' + c.pct + '%，會落在哪裡？';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.rg-wrap{font-size:15px}' +
  '.rg-q{font-size:16px;font-weight:900;color:#0f172a;line-height:1.9;margin-bottom:10px}' +
  '.rg-stage{background:#0f172a;border-radius:14px;padding:18px;margin:12px 0}' +
  /* 三盞燈疊起來 —— 用混色模式讓它們真的「加」在一起 */
  '.rg-lamps{position:relative;height:150px;margin-bottom:6px}' +
  '.rg-lamp{position:absolute;top:16px;width:104px;height:104px;border-radius:50%;' +
    'mix-blend-mode:screen;filter:blur(6px)}' +
  '.rg-lamp.r{left:calc(50% - 78px);background:#f00}' +
  '.rg-lamp.g{left:calc(50% - 26px);top:60px;background:#0f0}' +
  '.rg-lamp.b{left:calc(50% + 26px);background:#00f}' +
  '.rg-strip{display:flex;gap:5px;justify-content:center;margin-top:6px}' +
  '.rg-led{width:30px;height:30px;border-radius:50%;border:2px solid #334155}' +
  '.rg-sl{display:flex;align-items:center;gap:10px;margin:8px 0;font-weight:900}' +
  '.rg-sl label{width:56px;font-size:15px}' +
  '.rg-sl input{flex:1;height:30px;cursor:pointer}' +
  '.rg-sl b{width:52px;text-align:right;font-size:16px;font-variant-numeric:tabular-nums}' +
  '.rg-sl.r input{accent-color:#ef4444}.rg-sl.r label,.rg-sl.r b{color:#ef4444}' +
  '.rg-sl.g input{accent-color:#22c55e}.rg-sl.g label,.rg-sl.g b{color:#22c55e}' +
  '.rg-sl.b input{accent-color:#3b82f6}.rg-sl.b label,.rg-sl.b b{color:#3b82f6}' +
  '.rg-target{display:flex;align-items:center;gap:10px;justify-content:center;' +
    'font-weight:900;font-size:16px;margin:8px 0}' +
  '.rg-chip{width:44px;height:44px;border-radius:12px;border:3px solid #cbd5e1}' +
  '.rg-in{font-size:20px;font-weight:900;width:120px;padding:10px 12px;' +
    'border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.rg-go{background:#7c3aed;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;' +
    'border:none;border-radius:12px;cursor:pointer}' +
  '.rg-opt{display:block;width:100%;text-align:left;padding:13px 15px;margin-bottom:8px;' +
    'border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;' +
    'font-weight:800;cursor:pointer}' +
  '.rg-opt:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.rg-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;' +
    'font-weight:700;line-height:1.9}' +
  '.rg-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.rg-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.rg-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.rg-live{text-align:center;font-weight:900;font-size:16px;color:#e2e8f0;margin-top:8px;' +
    'font-variant-numeric:tabular-nums}' +
  '.rg-goals{display:flex;gap:14px;justify-content:center;font-weight:900;font-size:14px;' +
    'color:#475569;margin-top:8px}' +
  '.rg-sm{padding:7px 14px;font-size:13px}' +
  '.rg-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.rg-dot.on{background:#7c3aed}.rg-dot.ok{background:#10b981}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('rgblab-css')) return;
    var st = document.createElement('style');
    st.id = 'rgblab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function hex(rgb) {
    return '#' + rgb.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }
  /** 三盞燈 ＋ 一條燈條。★ 用 mix-blend-mode:screen 讓光真的「加」起來。 */
  function stageHtml(rgb) {
    var c = hex(rgb);
    return '<div class="rg-stage">' +
      '<div class="rg-lamps">' +
        '<div class="rg-lamp r" style="opacity:' + (rgb[0] / 255) + '"></div>' +
        '<div class="rg-lamp g" style="opacity:' + (rgb[1] / 255) + '"></div>' +
        '<div class="rg-lamp b" style="opacity:' + (rgb[2] / 255) + '"></div>' +
      '</div>' +
      '<div class="rg-strip">' +
        [0, 0, 0, 0, 0, 0, 0, 0].map(function () {
          return '<div class="rg-led" style="background:' + c + '"></div>';
        }).join('') +
      '</div></div>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var rng = rngFrom(opts.seed);
    var node = 1, tries = 0;
    var rgb = [0, 0, 0];
    var pct = 50, turned = { lo: false, hi: false };
    var dialH = null, needView = false;
    var mix = caseMix(rng, null), q2 = caseQ2(rng, null), hue = caseHue(rng, null);

    function dots(n, done) {
      return '<div class="rg-dots">' + [1, 2, 3].map(function (i) {
        return '<div class="rg-dot ' + (done >= i ? 'ok' : (n === i ? 'on' : '')) + '"></div>';
      }).join('') + '</div>';
    }

    function view(msg, cls) {
      var body;
      if (node === 1) {
        body =
          '<div class="rg-q">💡 燈條的每一顆裡面其實有<b>三盞小燈</b>：' +
          '<span style="color:#ef4444">紅</span>、' +
          '<span style="color:#16a34a">綠</span>、' +
          '<span style="color:#2563eb">藍</span>。<br>' +
          '把它們<b>疊在一起</b>，就混出各種顏色。<br>' +
          '⚠️ 調調看 —— 把三根滑桿推成下面這個顏色：</div>' +
          '<div class="rg-target">目標：<div class="rg-chip" style="background:' +
            mix.hex + '"></div><b>' + mix.name + '</b></div>' +
          '<div id="rg-stage">' + stageHtml(rgb) + '</div>' +
          ['r', 'g', 'b'].map(function (k, i) {
            return '<div class="rg-sl ' + k + '"><label>' + CH[i] + '</label>' +
              '<input type="range" min="0" max="255" value="' + rgb[i] +
              '" data-ch="' + i + '"><b id="rg-v' + i + '">' + rgb[i] + '</b></div>';
          }).join('') +
          '<div style="text-align:center;margin-top:6px">' +
            '<button class="rg-go" id="rg-run">就是這個顏色</button></div>';
      } else if (node === 2) {
        var list = q2.opts.slice().sort(function () { return rng() - 0.5; });
        body = '<div class="rg-q">' + q2.q + '</div>' +
          list.map(function (o) {
            return '<button class="rg-opt" data-k="' + o.k + '">' + md(o.t) + '</button>';
          }).join('');
      } else {
        var both = turned.lo && turned.hi;
        body =
          '<div class="rg-q">🎚️ 換<b>旋鈕</b>上場 —— 轉轉看：<br>' +
          '亮的那一顆會<b>跟著跑</b>（模式一），顏色也會<b>跟著換</b>（模式二）。<br>' +
          '⚠️ 左右<b>兩端都要轉到</b>。</div>' +
          LK().dialSvg(pct, { cls: 'rg-dial', needleId: 'rg-needle', legs: true }) +
          '<div id="rg-live">' + liveHtml() + '</div>' +
          '<div class="rg-goals">' +
            '<span id="rg-gl"></span><span id="rg-gh"></span></div>' +
          '<div style="text-align:center;margin-top:4px">' +
            '<button class="rg-go rg-sm" id="rg-jl">直接轉到最左</button> ' +
            '<button class="rg-go rg-sm" id="rg-jr">直接轉到最右</button></div>' +
          (both
            ? '<div class="rg-q" style="margin-top:14px">' +
              '✅ 兩種模式你都轉過了。最後把<b>換算</b>寫出來：<br>' +
              '<span style="font-family:monospace;font-size:14px">顏色 ← 類比對應（' + PIN +
                '，0，' + HUE_MAX + '）</span><br>' +
              '⚠️ 旋鈕轉到 <b>' + hue.pct + '%</b> 的時候，「顏色」會是多少？</div>' +
              '<div class="rg-row" style="text-align:center">' +
                '<input class="rg-in" id="rg-hue" placeholder="?"> ' +
                '<button class="rg-go" id="rg-runH">送出</button></div>'
            : '');
      }
      el.innerHTML = '<div class="rg-wrap">' + dots(node, node - 1) + body +
        (msg ? '<div class="rg-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    /* 拖滑桿時只換舞台那一塊，不整個重畫（重畫會讓滑桿失焦，手指還按著就斷了） */
    function paint() {
      var st = el.querySelector('#rg-stage');
      if (st) st.innerHTML = stageHtml(rgb);
      rgb.forEach(function (v, i) {
        var b = el.querySelector('#rg-v' + i);
        if (b) b.textContent = v;
      });
    }

    /* ③ 的燈條＋讀數。⚠️ 這一塊和旋鈕的 SVG **分開**，
       所以重畫它不會把正在拖的旋鈕換掉。 */
    function liveHtml() {
      var pos = posAt(pct), h = hueAt(pct), c = hex(hueRgb(h));
      var leds = '';
      for (var i = 1; i <= LEDS; i++) {
        leds += '<div class="rg-led" style="background:' + (i === pos ? c : '#1e293b') +
          (i === pos ? ';box-shadow:0 0 14px ' + c : '') + '"></div>';
      }
      return '<div class="rg-stage"><div class="rg-strip">' + leds + '</div></div>' +
        '<div class="rg-live">第 <b>' + pos + '</b> 顆　｜　顏色 <b>' + h + '</b>' +
        '　｜　旋鈕 ' + pct + '%</div>';
    }
    function paint3() {
      var g = el.querySelector('#rg-needle');
      if (g) g.setAttribute('transform', 'rotate(' + LK().dialAngle(pct) + ' 60 60)');
      var lv = el.querySelector('#rg-live');
      if (lv) lv.innerHTML = liveHtml();
      var gl = el.querySelector('#rg-gl'), gh = el.querySelector('#rg-gh');
      if (gl) gl.textContent = (turned.lo ? '✅' : '⬜') + ' 轉到最左';
      if (gh) gh.textContent = (turned.hi ? '✅' : '⬜') + ' 轉到最右';
    }
    /* 手指還按著的時候不可以重畫整頁（會換掉正在拖的 SVG，見 labkit.dialBind） */
    function setPct(v) {
      var was = turned.lo && turned.hi;
      pct = clamp(v);
      if (pct <= 5) turned.lo = true;
      if (pct >= 95) turned.hi = true;
      paint3();
      if (!was && turned.lo && turned.hi) {
        if (dialH && dialH.dragging()) { needView = true; return; }
        view('', '');
      }
    }

    function bind() {
      /* ③ 的旋鈕：拖曳／滾輪／方向鍵都在 labkit（和第三節同一顆）。 */
      var dl = el.querySelector('.rg-dial');
      if (dl) {
        dialH = LK().dialBind(dl, {
          get: function () { return pct; },
          set: setPct,
          onRelease: function () { if (needView) { needView = false; view('', ''); } }
        });
        paint3();
      }
      var jl = el.querySelector('#rg-jl');
      if (jl) jl.addEventListener('click', function () { setPct(0); });
      var jr = el.querySelector('#rg-jr');
      if (jr) jr.addEventListener('click', function () { setPct(100); });
      el.querySelectorAll('[data-ch]').forEach(function (sl) {
        sl.addEventListener('input', function () {
          rgb[Number(sl.getAttribute('data-ch'))] = Number(sl.value);
          paint();
        });
      });
      var run = el.querySelector('#rg-run');
      if (run) run.addEventListener('click', doMix);
      var rh = el.querySelector('#rg-runH');
      if (rh) rh.addEventListener('click', doHue);
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () { doQ2(b.getAttribute('data-k')); });
      });
    }

    function doMix() {
      tries++;
      var r = judgeMix(rgb, mix);
      if (r.ok) { node = 2; view('✅ ' + mix.why, 'good'); return; }
      view(sayMix(r, mix), 'bad');
    }
    function doQ2(k) {
      tries++;
      var o = q2.opts.filter(function (x) { return x.k === k; })[0];
      if (o && o.good) { node = 3; view('✅ 對了。' + q2.why, 'good'); return; }
      var old = q2;
      q2 = caseQ2(rng, q2);            // ★ 答錯換一題
      view('⚠️ 不對。' + old.why + '　**換一題**再試一次。', 'bad');
    }
    function doHue() {
      tries++;
      var v = el.querySelector('#rg-hue').value;
      if (judgeHue(v, hue)) {
        el.innerHTML = '<div class="rg-wrap">' + dots(3, 3) +
          '<div class="rg-msg good">' + md(
            '🎉 暖身完成！\n你會了三件事：燈條裡是**紅綠藍三盞燈疊在一起**、' +
            '**光越混越亮**（和顏料相反）、而旋鈕一樣用**類比對應**換算。\n' +
            '⚠️ 等一下程式裡那三行 sin 的公式不必看懂 —— ' +
            '它只是幫你把旋鈕的角度換成一組紅綠藍。'
          ).replace(/\n/g, '<br>') + '</div></div>';
        if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
        return;
      }
      var msg = sayHue(v, hue);
      hue = caseHue(rng, hue);
      view(msg + '　**換一題**再試一次。', 'bad');
    }

    view('', '');
    return { node: function () { return node; }, tries: function () { return tries; },
             rgb: function () { return rgb; }, setRgb: function (a) { rgb = a.slice(); paint(); },
             mix: function () { return mix; }, q2: function () { return q2; },
             hue: function () { return hue; },
             pct: function () { return pct; }, setPct: setPct };
  }

  global.RGBLAB = {
    PIN: PIN, HUE_MAX: HUE_MAX, MIXES: MIXES, Q2: Q2, CH: CH, ON: ON, OFF: OFF,
    hex: hex, caseMix: caseMix, judgeMix: judgeMix, sayMix: sayMix,
    caseQ2: caseQ2, caseHue: caseHue, LEDS: LEDS,
    posAt: posAt, hueAt: hueAt, hueRgb: hueRgb, judgeHue: judgeHue, sayHue: sayHue,
    mount: mount
  };

})(window);
