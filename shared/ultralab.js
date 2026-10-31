/* =====================================================================
   超音波原理：暖身關卡（5016B 第一節，三個節點）
   ---------------------------------------------------------------------
   三個節點，依序解鎖（後面的要用到前面的結論）：

     ① 聲音跑一趟   Echo 收到的**就是**剛才發出去的那個聲音
     ② 除以 2       聲音走的是「來回」，所以距離＝總長度 ÷ 2
     ③ 時間變距離   每 1 毫秒走 34 公分 → 距離 = 34 × 時間 ÷ 2

   節點②③刻意用**填空**：選擇題一定得放「沒除以 2 的那個數」（最典型的錯），放了就有五成猜中率。
   節點③用**毫秒**不用微秒（真實的 HC-SR04 是幾百微秒）：這一關要測的是「除以 2」，不是單位換算。
   t 只取偶數毫秒，答案一定是 34 的整數倍（34／68／102）。

   ---------------------------------------------------------------------
   兩種用法（第二節也用超音波，同一支直接呼叫）
       ULTRALAB.mount(el, { mode:'warmup', seed, onDone })   三節點＋檢核
       ULTRALAB.mount(el, { mode:'demo' })                   只有動畫

   隨機與 seed：預設每人每次都不一樣（不讓學生背答案、互相報）；
   傳 seed（或網址 ?seed=1234）→ 同一個 seed 一定產生同一組題，方便帶全班對答案。
   Math.random() 不吃種子，所以自己寫一支 xorshift（rngFrom，其他 *lab.js 也用它）。
   ===================================================================== */
(function (global) {
  'use strict';

  var SPEED = 34;          // 公分／毫秒（約 340 m/s）
  var D_MIN = 5, D_MAX = 60;

  /* ── 亂數 ─────────────────────────────────────────────
     FNV-1a 把 seed（可能是字串）壓成 32 位元，再餵 xorshift32。
     ⚠️ 不要用 Math.random()：它沒有種子，全班同題就做不到。 */
  function hash32(s) {
    var h = 0x811c9dc5;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function rngFrom(seed) {
    var x = hash32(seed == null ? (Date.now() + '-' + Math.random()) : seed) || 1;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5;  x >>>= 0;
      return x / 4294967296;
    };
  }
  function pick(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  /* ── 出題 ─────────────────────────────────────────────
     ⚠️ 每一節點都要「和上一次不同」——重做時換一組才證明得了不是背的。 */
  function caseFor(node, rng, prev) {
    for (var guard = 0; guard < 50; guard++) {
      var c;
      if (node === 1) {
        c = { d: pick(rng, 10, D_MAX) };                 // 只影響動畫長度
      } else if (node === 2) {
        var d = pick(rng, D_MIN, D_MAX);
        c = { d: d, total: d * 2, answer: d };
      } else {
        var t = pick(rng, 1, 3) * 2;                     // 2、4、6 毫秒
        c = { t: t, answer: SPEED * t / 2 };
      }
      if (!prev || JSON.stringify(c) !== JSON.stringify(prev)) return c;
    }
    return c;
  }

  /** 判定。node 1 是選項索引，2／3 是數字。 */
  function judge(node, c, ans) {
    if (node === 1) return String(ans) === 'echo';
    var n = Number(String(ans).trim());
    if (!isFinite(n)) return false;
    return n === c.answer;
  }

  /* 答錯時**不給答案**，只點破想錯的地方 —— 給了答案就沒得再想。 */
  function hintFor(node, c, ans) {
    var n = Number(String(ans).trim());
    if (node === 2) {
      if (n === c.total) return '你寫的是**聲音走的總長度** —— 它去了又回來，所以…';
      return '再看一次上面的圖：聲音走的路，是物體距離的幾倍？';
    }
    if (node === 3) {
      if (n === SPEED * c.t) return '這是**聲音走的總長度** —— 別忘了它走的是來回。';
      if (n === c.t / 2 || n === c.t) return '時間要先換成長度：每 1 毫秒走 ' + SPEED + ' 公分。';
      return '兩步：先算聲音一共走多長，再想想那是不是物體的距離。';
    }
    return '那個聲音不是憑空出現的，也不是物體發出來的。';
  }

  var NODES = [
    { no: 1, title: '聲音跑一趟', ask: 'Echo 收到的那個聲音，是誰發出來的？' },
    { no: 2, title: '為什麼要除以 2', ask: '' },
    { no: 3, title: '時間變成距離', ask: '' }
  ];

  var OPTS1 = [
    { key: 'echo',  text: '感測器自己發出去、撞到東西彈回來的' },
    { key: 'obj',   text: '物體自己發出來的' },
    { key: 'air',   text: '空氣中本來就有的' }
  ];

  /* 選項要洗牌 —— 不然學生會互相傳「選第一個」。 */
  function shuffled(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── 畫面 ───────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function md(s) {   // 只認 **粗體**，其餘原樣（這裡的文字都是我們自己寫的）
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  /* 聲音畫成**同心弧線**（一圈一圈擴散的波），不畫圓球 ——
     圓球像一顆飛出去的子彈，正好是節點① 要破除的誤解（以為感測器射出了一個東西）。
     去程三道藍弧往右擴散，回程三道橘弧往左回來：去回是同一個聲音，節點② 算的就是「一去一回」。 */
  function waveHtml(d, label) {
    var pct = Math.round((d - D_MIN) / (D_MAX - D_MIN) * 70) + 20;   // 20%～90%
    function arcs(dir) {
      var out = '';
      for (var i = 0; i < 3; i++) {
        out += '<span class="ul-arc ' + dir + '" style="animation-delay:' + (i * 0.18) + 's"></span>';
      }
      return out;
    }
    return '' +
      '<div class="ul-stage">' +
        '<div class="ul-sensor">📡</div>' +
        '<div class="ul-obj" style="left:' + pct + '%">🧍</div>' +
        '<div class="ul-wave go"  style="--to:' + pct + '%">' + arcs('go') + '</div>' +
        '<div class="ul-wave back" style="--to:' + pct + '%">' + arcs('back') + '</div>' +
        '<div class="ul-ruler" style="width:' + pct + '%">' +
          '<span>' + (label || (d + ' 公分')) + '</span>' +
        '</div>' +
      '</div>';
  }

  var CSS = '' +
  '.ul-wrap{font-family:inherit}' +
  '.ul-steps{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.ul-step{flex:1;min-width:120px;padding:8px 10px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font-weight:900;font-size:13px;color:#94a3b8}' +
  '.ul-step.on{border-color:#0891b2;color:#0e7490;background:#ecfeff}' +
  '.ul-step.ok{border-color:#10b981;color:#047857;background:#ecfdf5}' +
  /* 舞台 150px，距離的字放在尺標線的**上方**（bottom），和舞台底部之間永遠有緩衝，不會被裁掉 */
  '.ul-stage{position:relative;height:150px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;overflow:hidden;margin:10px 0}' +
  '.ul-sensor{position:absolute;left:8px;top:34px;font-size:34px}' +
  '.ul-obj{position:absolute;top:34px;font-size:34px;transform:translateX(-50%)}' +
  /* 同心弧線：用 border 只畫一邊，靠 scale 擴散。
     ⚠️ 去程從感測器往右、回程從物體往左 —— 兩組各自定位，
        不要用同一個元素「跑過去再跑回來」（那又變成子彈了）。 */
  '.ul-wave{position:absolute;top:0;bottom:0;width:0;pointer-events:none}' +
  '.ul-wave.go{left:46px}' +
  '.ul-wave.back{left:calc(var(--to) - 14px)}' +
  '.ul-arc{position:absolute;top:50%;width:22px;height:44px;margin-top:-22px;opacity:0;' +
    'border:4px solid transparent;border-radius:50%}' +
  '.ul-arc.go{border-right-color:#0891b2;animation:ularc-go 1.6s ease-out infinite}' +
  '.ul-arc.back{border-left-color:#f97316;animation:ularc-back 1.6s ease-out infinite}' +
  /* 去程在前半段、回程在後半段 —— 加起來剛好是「一去一回」。 */
  '@keyframes ularc-go{0%{opacity:0;transform:scale(.4) translateX(0)}' +
    '8%{opacity:1}40%{opacity:1;transform:scale(1.5) translateX(6px)}' +
    '48%,100%{opacity:0;transform:scale(1.6) translateX(6px)}}' +
  '@keyframes ularc-back{0%,48%{opacity:0;transform:scale(.4) translateX(0)}' +
    '56%{opacity:1}88%{opacity:1;transform:scale(1.5) translateX(-6px)}' +
    '96%,100%{opacity:0;transform:scale(1.6) translateX(-6px)}}' +
  '@media (prefers-reduced-motion: reduce){.ul-arc{animation-duration:3.2s}}' +
  '.ul-ruler{position:absolute;left:44px;bottom:26px;height:0;border-top:3px dashed #94a3b8}' +
  '.ul-ruler span{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);font-size:15px;font-weight:900;color:#334155;background:#f8fafc;padding:0 8px;white-space:nowrap}' +
  '.ul-ask{font-size:16px;font-weight:900;color:#0f172a;margin:12px 0 8px;line-height:1.7}' +
  '.ul-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;font-weight:700;cursor:pointer}' +
  '.ul-opt:hover{border-color:#0891b2;background:#ecfeff}' +
  '.ul-num{font-size:20px;font-weight:900;width:130px;padding:10px 12px;border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.ul-go{background:#0891b2;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;border:none;border-radius:12px;cursor:pointer}' +
  '.ul-go2{background:#fff;color:#0e7490;border:2px solid #0891b2;font-weight:900;padding:9px 16px;border-radius:12px;cursor:pointer;margin-left:8px}' +
  '.ul-msg{margin-top:10px;padding:10px 12px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.7}' +
  '.ul-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.ul-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.ul-card{background:#eff6ff;border:2px solid #bfdbfe;color:#1e3a8a;border-radius:12px;padding:10px 12px;font-weight:800;font-size:14px;margin:8px 0}';

  function ensureCss() {
    if (document.getElementById('ultralab-css')) return;
    var st = document.createElement('style');
    st.id = 'ultralab-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var demo = opts.mode === 'demo';
    var rng = rngFrom(opts.seed);
    var node = 1, tries = { 1: 0, 2: 0, 3: 0 }, prev = {};
    var c = caseFor(node, rng, null);
    var options = shuffled(OPTS1, rng);

    function stepsHtml() {
      return '<div class="ul-steps">' + NODES.map(function (n) {
        var cls = n.no < node ? 'ok' : (n.no === node ? 'on' : '');
        return '<div class="ul-step ' + cls + '">' +
               (n.no < node ? '✅ ' : '') + n.no + '. ' + n.title + '</div>';
      }).join('') + '</div>';
    }

    function body() {
      if (node === 1) {
        return waveHtml(c.d) +
          '<div class="ul-ask">' + md(NODES[0].ask) + '</div>' +
          options.map(function (o) {
            return '<button class="ul-opt" data-k="' + o.key + '">' + esc(o.text) + '</button>';
          }).join('');
      }
      if (node === 2) {
        return waveHtml(c.d, '？公分') +
          '<div class="ul-card">聲音<b>去了又回來</b>，這一趟一共走了 <b>' + c.total + '</b> 公分。</div>' +
          '<div class="ul-ask">那麼物體離感測器多遠？</div>' +
          '<input class="ul-num" id="ul-in" inputmode="numeric" placeholder="?"> 公分 ' +
          '<button class="ul-go" id="ul-ok">送出</button>';
      }
      return '<div class="ul-card">📏 聲音每 <b>1 毫秒</b> 走 <b>' + SPEED + '</b> 公分。</div>' +
        '<div class="ul-ask">來回一共花了 <b>' + c.t + '</b> 毫秒，物體離感測器多遠？</div>' +
        '<input class="ul-num" id="ul-in" inputmode="numeric" placeholder="?"> 公分 ' +
        '<button class="ul-go" id="ul-ok">送出</button>';
    }

    function draw(msg, cls) {
      el.innerHTML =
        '<div class="ul-wrap">' + (demo ? '' : stepsHtml()) + body() +
        (msg ? '<div class="ul-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') +
        '</div>';
      /* 弧線用 CSS 的 infinite 動畫一直循環播 —— 這一段是理解的基礎，看漏了要有第二次機會 */
      bind();
    }

    function next(ok) {
      if (!ok) return;
      if (node === 3) {
        el.innerHTML = '<div class="ul-wrap">' + stepsHtml() +
          '<div class="ul-msg good">🎉 暖身關卡完成！你已經知道<b>那個距離數字是怎麼來的</b>了 —— ' +
          '接下來要用它來決定門什麼時候開。</div></div>';
        if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
        return;
      }
      node++;
      prev = null;
      c = caseFor(node, rng, null);
      draw('答對了，進入下一步。', 'good');
    }

    function answer(val) {
      tries[node]++;
      if (judge(node, c, val)) { next(true); return; }
      /* ⚠️ 答錯就**換一組數字**再來 —— 重試同一題的話，
         第二次答對只證明他記得剛才的答案。 */
      var old = c;
      c = caseFor(node, rng, old);
      if (node === 1) options = shuffled(OPTS1, rng);
      draw(hintFor(node, old, val) + '　（已換一組，再試一次）');
    }

    function bind() {
      el.querySelectorAll('.ul-opt').forEach(function (b) {
        b.addEventListener('click', function () { answer(b.getAttribute('data-k')); });
      });
      var ok = el.querySelector('#ul-ok');
      if (ok) ok.addEventListener('click', function () {
        answer((el.querySelector('#ul-in') || {}).value || '');
      });
      var inp = el.querySelector('#ul-in');
      if (inp) inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') answer(inp.value);
      });
    }

    draw('');
    return { node: function () { return node; }, tries: function () { return tries; } };
  }

  global.ULTRALAB = {
    SPEED: SPEED,
    rngFrom: rngFrom, hash32: hash32,
    caseFor: caseFor, judge: judge, hintFor: hintFor,
    mount: mount
  };

})(window);
