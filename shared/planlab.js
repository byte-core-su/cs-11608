/* =====================================================================
   專題設計單（5016B 第五節「自己的專案」的進場券）
   ---------------------------------------------------------------------
   電腦看不到學生的硬體，所以這裡不判定「做出來了沒」，只負責一件事 ——
   在動手之前**把要做什麼講清楚**（專題課最常見的卡關是「還沒想好要做什麼」）。

   四個節點：
     ① 先複習：學過的四樣怎麼配（四種組合都親手試過）
     ② 選一個情境（可以自訂）
     ③ 選 1 個輸入 ＋ 1 個輸出
     ④ 把「如果…那麼…」補完整（觸發條件 ＋ 輸出動作）

   元件清單只放前四節真的用過的四樣：超音波、可變電阻、RGB 燈條、直流馬達
   （多寫一個教具上沒有的，學生會找半天）。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('planlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  /* ── ① 情境清單 ────────────────────────────────────── */
  /* 每一個情境都要只用那四樣做得出來（例如「衣櫃燈」用距離偵測，不用門磁或按鈕） */
  var SCENES = [
    { key: 'hall',  t: '玄關迎賓燈',   d: '有人走近就亮，離開一會兒自己熄掉' },
    { key: 'desk',  t: '書桌護眼燈',   d: '坐太近就變色提醒，坐好了才恢復' },
    { key: 'closet', t: '衣櫃感應燈',  d: '手伸進去（距離變近）就亮，拿開就暗' },
    { key: 'fan',   t: '房間自動電扇', d: '旋鈕調風速；或人靠近才吹' },
    { key: 'park',  t: '停車距離指示', d: '越靠近亮的顆數越多，太近就整條變紅' },
    { key: 'water', t: '洗手感應計時', d: '手伸過來就亮，燈跑完一圈代表洗夠久了' },
    { key: 'stair', t: '樓梯夜燈',     d: '有人經過才亮，一顆一顆跟著走' },
    { key: 'focus', t: '專注計時燈',   d: '旋鈕設定時間，燈條慢慢跑完就提醒' }
  ];

  /* ── ② 輸入／輸出 ───────────────────────────────────
     ★ 只列前四節用過的。⚠️ 每一個都標出「它給你什麼數字」——
        專題課最容易卡在「我不知道這個能拿來幹嘛」。 */
  /* 前四節用過的四樣元件（教具上就這四樣） */
  var INPUTS = [
    { key: 'us',  t: '超音波距離感測器', gives: '距離幾公分（數字）',
      from: '第一、二節', unit: '公分', hint: '越近數字越小',
      def: 15, lo: 2, hi: 200 },
    { key: 'pot', t: '可變電阻（旋鈕）', gives: '轉到幾 %（數字）',
      from: '第三、四節', unit: '%', hint: '最左 0、最右 100',
      def: 50, lo: 0, hi: 100 }
  ];
  var OUTPUTS = [
    { key: 'strip', t: 'RGB 全彩燈條', from: '第二、四節',
      acts: ['整條亮起指定顏色', '只亮其中一顆（位置會跑）', '顏色跟著變'] },
    { key: 'moto',  t: '直流馬達', from: '第三節',
      acts: ['開始轉動', '停下來', '依比例調整轉速'] }
  ];

  /* ── ① 元件複習盤 ─────────────────────────────────
     不出題、不判對錯，只要求「四種組合都親手試過」——
     卡關多半是「不知道這兩樣湊起來能幹嘛」，要自己拉滑桿看它動。
     轉速用 −250～250（第三節那一組）。 */
  var SPD = 250, LEDS = 8, HUE_MAX = 359;
  var ACTS = {
    strip: [
      { key: 'seq',  t: '燈號順序（只亮一顆，位置會跑）', from: '第二節',
        can: '做成停車距離指示、樓梯夜燈 —— 位置本身就是資訊。' },
      { key: 'bar',  t: '長條（越大亮越多顆）', from: '第二節',
        can: '做成電量、音量、距離的「條」—— 一眼看得出多還是少。' },
      { key: 'hue',  t: '整條變色（走完色環）', from: '第四節',
        can: '做成氣氛燈、狀態燈 —— 綠色安全、紅色警告。' }
    ],
    /* 做法清單依輸入而不同：
         旋鈕配馬達 → 「依比例（−250～250）」放第一個（往左反轉是第三節的重點）
         超音波配馬達 → 沒有反轉（人走遠了馬達倒轉沒有道理），只往一邊轉，下限 0 才對 */
    moto_pot: [
      { key: 'ratio', t: '依比例調轉速（−250 ～ 250）', from: '第三節',
        can: '★ 旋鈕轉到**正中間是停**，往左**反轉**、往右正轉 —— ' +
             '這就是第三節那個負號的意思。' },
      { key: 'onoff', t: '轉或停（過了門檻才轉）', from: '第一節的判斷',
        can: '做成可調速電扇的開關；最單純，先做這個一定會動。' }
    ],
    moto_us: [
      { key: 'onoff', t: '轉或停（過了門檻才轉）', from: '第一節的判斷',
        can: '做成感應風扇、自動門 —— 最單純，先做這個一定會動。' },
      { key: 'ratio', t: '依比例調轉速（0 ～ 250）', from: '第三節',
        can: '越近轉越快。⚠️ 這裡下限是 **0 不是 −250** —— ' +
             '人走遠了讓風扇倒轉沒有道理，只往一邊轉的話 0 才對。' }
    ]
  };
  /* ⚠️ 做法要看**輸入是誰** —— 反轉是旋鈕才有的。 */
  function actsOf(out, inKey) {
    if (out !== 'moto') return ACTS[out] || [];
    return inKey === 'us' ? ACTS.moto_us : ACTS.moto_pot;
  }
  /* 輸入的原始值 → 這個做法會做出什麼。★ 只有這一個地方在算，畫面照著畫。 */
  function effectOf(inKey, out, act, raw) {
    /* 先把兩種輸入都換成 0～1 的「強度」——
       ⚠️ 超音波是**越近越強**（反向，第二節那一課）。 */
    var k = (inKey === 'us')
      ? Math.max(0, Math.min(1, (60 - Math.max(2, Math.min(200, raw))) / 55))
      : Math.max(0, Math.min(1, raw / 100));
    if (out === 'moto') {
      if (act === 'onoff') return { fan: k > 0.5 ? SPD : 0, lo: 0 };
      /* ★ 旋鈕：中間停、往左反轉（第三節）。超音波：只往一邊。 */
      if (inKey === 'us') return { fan: Math.round(k * SPD), lo: 0 };
      return { fan: Math.round(-SPD + 2 * SPD * k), lo: -SPD };
    }
    if (act === 'seq') return { on: [Math.round(1 + (LEDS - 1) * k)], hue: 200 };
    if (act === 'bar') return { n: Math.max(0, Math.round(k * LEDS)), hue: 140 };
    return { all: true, hue: Math.round(HUE_MAX * k) };
  }

  function byKey(list, k) {
    return list.filter(function (x) { return x.key === k; })[0] || null;
  }

  /* 把設計單組成一句「如果…那麼…」。
     ★ 這一句是**整節課的錨**：任務卡、成果發表都回頭指著它。 */
  function planLine(p) {
    if (!p || !p.input || !p.output) return '';
    var i = byKey(INPUTS, p.input), o = byKey(OUTPUTS, p.output);
    if (!i || !o) return '';
    var when = i.t.replace(/（.*/, '') + '讀到的數字 ' +
      (p.dir === 'gt' ? '大於' : '小於') + ' ' + p.value + ' ' + i.unit;
    return '如果　' + when + '　那麼　' + o.t + '就' + p.act + '。';
  }
  /* 設計單填完了沒。⚠️ 少一格就不算 —— 半張設計單等於沒有。 */
  function planReady(p) {
    if (!p || !p.scene || !p.input || !p.output || !p.act) return false;
    var i = byKey(INPUTS, p.input);
    if (!i) return false;
    return p.value !== '' && isFinite(Number(p.value));
  }
  function sayPlan(p) {
    if (!p.scene) return '先選一個情境（或自己寫一個）。';
    if (!p.input) return '選一個**輸入** —— 系統要靠什麼知道「該動作了」？';
    if (!p.output) return '選一個**輸出** —— 你希望它做什麼給你看？';
    var i = byKey(INPUTS, p.input);
    if (i && (p.value === '' || !isFinite(Number(p.value))))
      return '⚠️ 那個門檻要填一個**數字** —— 到多少才算「該動作了」？';
    if (i) {
      var n = Number(p.value);
      if (n < i.lo || n > i.hi)
        return '⚠️ ' + i.t + '只讀得到 ' + i.lo + '～' + i.hi + ' ' + i.unit +
               '，填在範圍外的話**永遠不會觸發**。';
    }
    if (!p.act) return '選一個動作 —— 輸出要「怎麼動」？';
    return '';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px}' +
  '.pl-card{text-align:left;padding:12px 13px;border:2px solid #e2e8f0;border-radius:14px;' +
    'background:#fff;cursor:pointer;font-size:14px;font-weight:800;line-height:1.6}' +
  '.pl-card:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.pl-card.on{border-color:#7c3aed;background:#f5f3ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pl-card b{display:block;font-size:15px;color:#0f172a;margin-bottom:2px}' +
  '.pl-card span{display:block;font-size:12px;color:#64748b;font-weight:700}' +
  '.pl-tag{display:inline-block;font-size:11px;font-weight:900;color:#7c3aed;' +
    'background:#ede9fe;border-radius:6px;padding:1px 6px;margin-top:4px}' +
  '.pl-line{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin:12px 0}' +
  '.pl-line em{color:#fbbf24;font-style:normal}' +
  '.pl-in{font-size:16px;font-weight:900;padding:8px 11px;border:2px solid #cbd5e1;' +
    'border-radius:10px;width:100px;text-align:center}' +
  '.pl-txt{width:100%;font-size:15px;font-weight:800;padding:10px 12px;' +
    'border:2px solid #cbd5e1;border-radius:12px;box-sizing:border-box}' +
  '.pl-row{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:10px 0;' +
    'font-weight:900;font-size:15px}' +
  '.pl-chip{padding:8px 12px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;' +
    'font-weight:900;font-size:14px;cursor:pointer;text-align:left;line-height:1.5}' +
  '.pl-chip:hover{border-color:#7c3aed}' +
  '.pl-chip.on{border-color:#7c3aed;background:#f5f3ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pl-chip span{display:block;font-size:11px;color:#64748b;font-weight:800}' +
  '.pl-sel{font-size:14px;font-weight:900;padding:8px 10px;border:2px solid #cbd5e1;' +
    'border-radius:10px}' +
  '.pl-io{margin:8px 0}' +
  '.pl-io-h{font-size:12px;font-weight:900;color:#7c3aed;margin-bottom:4px}' +
  '.pl-arrow{text-align:center;font-size:13px;font-weight:900;color:#94a3b8;margin:2px 0}' +
  '.pl-dialbox{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:6px}' +
  '.pl-dial{width:104px}' +
  '.pl-stage{background:#0f172a;border-radius:14px;padding:16px;margin:10px 0;' +
    'display:flex;flex-direction:column;align-items:center;gap:10px}' +
  '.pl-strip{display:flex;gap:5px;justify-content:center}' +
  '.pl-led{width:28px;height:28px;border-radius:50%;border:2px solid #334155}' +
  '.pl-read{color:#e2e8f0;font-weight:900;font-size:15px;text-align:center}' +
  '.pl-read span{display:block;font-size:12px;color:#94a3b8;font-weight:800}' +
  '.pl-tip{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:11px 13px;' +
    'font-weight:800;font-size:14px;color:#78350f;line-height:1.8;margin-top:8px}' +
  '.pl-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.pl-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.pl-dot.on{background:#7c3aed}.pl-dot.ok{background:#10b981}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('planlab-css')) return;
    var st = document.createElement('style');
    st.id = 'planlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var node = 1, tries = 0;
    /* ① 複習盤的狀態。⚠️ tried 記「哪幾種組合親手試過」。 */
    var mx = { input: 'us', output: 'strip', act: 'seq', raw: 40, tried: {} };
    /* ★ 帶著上次的設計單回來（改主意很正常，不必從頭選）。 */
    var p = Object.assign({ scene: '', input: '', output: '', act: '',
                            value: '', dir: 'lt' }, opts.plan || {});

    function dots() {
      return '<div class="pl-dots">' + [1, 2, 3, 4].map(function (i) {
        return '<div class="pl-dot ' + (node > i ? 'ok' : (node === i ? 'on' : '')) + '"></div>';
      }).join('') + '</div>';
    }
    /* 輸入圖形化：
         超音波 → 感測器 ＋ 會走的人 ＋ 尺標（labkit.distStage）
         旋鈕　 → 第三節那顆會轉的旋鈕（labkit.dialSvg），可以直接拖 */
    function inStage() {
      if (mx.input === 'us') return LK().distStage(mx.raw, 2, 200);
      return '<div class="pl-dialbox">' +
        LK().dialSvg(mx.raw, { cls: 'pl-dial', needleId: 'pl-needle', legs: false }) +
        '</div>';
    }

    /* ① 元件複習盤 */
    function mixStage() {
      var e = effectOf(mx.input, mx.output, mx.act, mx.raw);
      if (mx.output === 'moto') {
        return '<div class="pl-stage">' + LK().fanHtml(e.fan, SPD) +
          '<div class="pl-read"><b>轉速 ' + e.fan + '</b>　' +
          (e.fan === 0 ? '停止' : (e.fan > 0 ? '正轉' : '反轉')) +
          '<span>範圍 ' + e.lo + ' ～ ' + SPD + '</span></div></div>';
      }
      var col = LK().hexOf(LK().hueRgb(e.hue)), leds = '';
      for (var i = 1; i <= LEDS; i++) {
        var on = e.all ? true : (e.on ? e.on.indexOf(i) >= 0 : i <= e.n);
        leds += '<div class="pl-led" style="background:' + (on ? col : '#1e293b') +
          (on ? ';box-shadow:0 0 12px ' + col : '') + '"></div>';
      }
      return '<div class="pl-stage"><div class="pl-strip">' + leds + '</div>' +
        '<div class="pl-read">' +
          (e.on ? '第 ' + e.on[0] + ' 顆' : (e.all ? '整條（色相 ' + e.hue + '）'
                                                  : '亮 ' + e.n + ' 顆')) +
        '</div></div>';
    }
    function mixHtml() {
      var ins = PLIN(), a = actsOf(mx.output, mx.input);
      var act = a.filter(function (x) { return x.key === mx.act; })[0] || a[0];
      var n = Object.keys(mx.tried).length;
      return '<div class="pl-row">🔁 <b>第一步：先複習 —— 學過的就這四樣</b></div>' +
        '<div style="font-size:14px;color:#475569;font-weight:700;margin-bottom:10px">' +
        '★ 挑一個<b>輸入</b>配一個<b>輸出</b>，拉拉看下面的滑桿。<br>' +
        '⚠️ <b>四種配法都要試過</b>（已試 ' + n + '／4）—— ' +
        '知道每一樣能做什麼，等一下才想得出題目。</div>' +
        '<div class="pl-row">輸入：' + ins.map(function (i) {
          return '<button class="pl-chip' + (mx.input === i.key ? ' on' : '') +
            '" data-mi="' + i.key + '">' + esc(i.t.replace(/（.*/, '')) +
            '<span>' + esc(i.gives) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="pl-row">輸出：' + OUTPUTS.map(function (o) {
          return '<button class="pl-chip' + (mx.output === o.key ? ' on' : '') +
            '" data-mo="' + o.key + '">' + esc(o.t) +
            '<span>' + esc(o.from) + '用過</span></button>';
        }).join('') + '</div>' +
        '<div class="pl-row">做法：<select class="pl-sel" id="pl-mact">' +
          a.map(function (x) {
            return '<option value="' + x.key + '"' + (mx.act === x.key ? ' selected' : '') +
              '>' + esc(x.t) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="pl-io">' +
          '<div class="pl-io-h">輸入：' + esc(mx.input === 'us' ? '超音波距離感測器'
                                                              : '可變電阻（旋鈕）') + '</div>' +
          '<div id="pl-instage">' + inStage() + '</div>' +
        '</div>' +
        '<div class="pl-arrow">↓　換算　↓</div>' +
        '<div class="pl-io">' +
          '<div class="pl-io-h">輸出：' + esc(mx.output === 'strip' ? 'RGB 全彩燈條'
                                                                   : '直流馬達') + '</div>' +
          '<div id="pl-mstage">' + mixStage() + '</div>' +
        '</div>' +
        '<div class="pl-row"><label style="min-width:64px">' +
          (mx.input === 'us' ? '距離' : '旋鈕') + '</label>' +
          '<input type="range" id="pl-mraw" style="flex:1" ' +
            (mx.input === 'us' ? 'min="2" max="200"' : 'min="0" max="100"') +
            ' value="' + mx.raw + '"><b id="pl-mval" style="min-width:74px;text-align:right">' +
            mx.raw + (mx.input === 'us' ? ' cm' : ' %') + '</b></div>' +
        '<div class="pl-tip">💡 <b>' + esc(act.t) + '</b>（' + esc(act.from) + '）<br>' +
          esc(act.can) + '</div>' +
        '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
          '<button class="dl-go" id="pl-n0"' + (n < 4 ? ' style="background:#94a3b8"' : '') +
          '>' + (n < 4 ? '還有 ' + (4 - n) + ' 種沒試過' : '四種都試過了，下一步') +
          '</button></div>';
    }
    function PLIN() { return INPUTS; }
    /* ⚠️ 拉滑桿時只換舞台那一塊 —— 整頁重畫會讓滑桿失焦。 */
    function mixPaint() {
      var st = el.querySelector('#pl-mstage');
      if (st) st.innerHTML = mixStage();
      /* 旋鈕不可以重畫（會換掉正在被拖的 SVG），只改指針的 transform；距離舞台才整塊換 */
      if (mx.input === 'us') {
        var ins = el.querySelector('#pl-instage');
        if (ins) ins.innerHTML = inStage();
      } else {
        var g = el.querySelector('#pl-needle');
        if (g) g.setAttribute('transform', 'rotate(' + LK().dialAngle(mx.raw) + ' 60 60)');
      }
      var b = el.querySelector('#pl-mval');
      if (b) b.textContent = mx.raw + (mx.input === 'us' ? ' cm' : ' %');
      var sl = el.querySelector('#pl-mraw');
      if (sl && Number(sl.value) !== mx.raw) sl.value = mx.raw;
    }
    function markTried() { mx.tried[mx.input + '|' + mx.output] = 1; }

    function preview() {
      var line = planLine(p);
      return '<div class="pl-line">' +
        (p.scene ? '🎯 <em>' + esc(p.scene) + '</em><br>' : '') +
        (line ? esc(line) : '<span style="color:#64748b">選好之後，這一句會自動長出來</span>') +
        '</div>';
    }

    function view(msg, cls) {
      var body;
      if (node === 1) {
        body = mixHtml();
      } else if (node === 2) {
        body =
          '<div class="pl-row">📋 <b>第二步：你想解決什麼問題？</b></div>' +
          '<div style="font-size:14px;color:#475569;font-weight:700;margin-bottom:10px">' +
          '⚠️ 先想「誰會用、什麼時候用」，不要先想程式怎麼寫。</div>' +
          '<div class="pl-grid">' +
            SCENES.map(function (s) {
              return '<button class="pl-card' + (p.scene === s.t ? ' on' : '') +
                '" data-scene="' + esc(s.t) + '"><b>' + esc(s.t) + '</b>' +
                '<span>' + esc(s.d) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="margin-top:12px">或自己寫一個：</div>' +
          '<input class="pl-txt" id="pl-own" maxlength="40" ' +
            'placeholder="例：陽台植物缺水提醒燈" value="' +
            (SCENES.some(function (s) { return s.t === p.scene; }) ? '' : esc(p.scene)) + '">' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-n1">下一步</button></div>';
      } else if (node === 3) {
        body =
          preview() +
          '<div class="pl-row">🔌 <b>第三步：選 1 個輸入</b>　（系統靠什麼知道該動作了？）</div>' +
          '<div class="pl-grid">' +
            INPUTS.map(function (i) {
              return '<button class="pl-card' + (p.input === i.key ? ' on' : '') +
                '" data-in="' + i.key + '"><b>' + esc(i.t) + '</b>' +
                '<span>給你：' + esc(i.gives) + '</span>' +
                '<span class="pl-tag">' + esc(i.from) + '用過</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="margin-top:14px">💡 <b>再選 1 個輸出</b>　（你要它做什麼給你看？）</div>' +
          '<div class="pl-grid">' +
            OUTPUTS.map(function (o) {
              return '<button class="pl-card' + (p.output === o.key ? ' on' : '') +
                '" data-out="' + o.key + '"><b>' + esc(o.t) + '</b>' +
                '<span class="pl-tag">' + esc(o.from) + '用過</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-b2" style="background:#94a3b8">上一步</button>' +
            '<button class="dl-go" id="pl-n2">下一步</button></div>';
      } else {
        var i = byKey(INPUTS, p.input), o = byKey(OUTPUTS, p.output);
        body =
          preview() +
          '<div class="pl-row">🧩 <b>第四步：把「如果…那麼…」補完整</b></div>' +
          '<div class="pl-row">如果　' + esc(i.t.replace(/（.*/, '')) +
            '　<select class="pl-in" id="pl-dir" style="width:88px">' +
              '<option value="lt"' + (p.dir === 'lt' ? ' selected' : '') + '>小於</option>' +
              '<option value="gt"' + (p.dir === 'gt' ? ' selected' : '') + '>大於</option>' +
            '</select>　<input class="pl-in" id="pl-val" placeholder="?" value="' +
              esc(String(p.value)) + '">　' + esc(i.unit) +
            '<span style="font-size:13px;color:#64748b;font-weight:700">' +
              '（' + esc(i.hint) + '，' + i.lo + '～' + i.hi + '）</span>' +
          '</div>' +
          '<div class="pl-row">那麼　' + esc(o.t) + '就' +
            '　<select class="pl-in" id="pl-act" style="width:auto;min-width:170px">' +
              '<option value="">選一個…</option>' +
              o.acts.map(function (a) {
                return '<option' + (p.act === a ? ' selected' : '') + '>' + esc(a) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-b3" style="background:#94a3b8">上一步</button>' +
            '<button class="dl-go" id="pl-done">完成設計單</button></div>';
      }
      el.innerHTML = '<div class="dl-wrap">' + dots() + body +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    function grab() {
      var v = el.querySelector('#pl-val'); if (v) p.value = v.value.trim();
      var d = el.querySelector('#pl-dir'); if (d) p.dir = d.value;
      var a = el.querySelector('#pl-act'); if (a) p.act = a.value;
      var own = el.querySelector('#pl-own');
      if (own && own.value.trim()) p.scene = own.value.trim();
    }

    function bind() {
      /* ── ① 複習盤 ── */
      el.querySelectorAll('[data-mi]').forEach(function (b) {
        b.addEventListener('click', function () {
          mx.input = b.getAttribute('data-mi');
          /* ⚠️ 旋鈕預設不要停在正中間 —— 配馬達的時候正中間剛好是
             「停」，學生一切過去看到不會動，會以為壞掉。
             ⇒ 預設偏右（正轉），讓他先看到會動，再自己往左轉發現反轉。 */
          mx.raw = mx.input === 'us' ? 40 : 75;
          /* 切換輸入不必重設做法：兩組做法用同一組 key（onoff／ratio）。
             同樣選「依比例」，切到超音波就自動變成 0～250 —— 正好是第三節「只往一邊轉時下限 0 才對」那個對照。 */
          markTried(); view('', '');
        });
      });
      el.querySelectorAll('[data-mo]').forEach(function (b) {
        b.addEventListener('click', function () {
          mx.output = b.getAttribute('data-mo');
          mx.act = actsOf(mx.output, mx.input)[0].key;
          markTried(); view('', '');
        });
      });
      var ma = el.querySelector('#pl-mact');
      if (ma) ma.addEventListener('change', function () { mx.act = ma.value; view('', ''); });
      var mr = el.querySelector('#pl-mraw');
      if (mr) mr.addEventListener('input', function () {
        mx.raw = Number(mr.value); markTried(); mixPaint();
      });
      /* ★ 旋鈕可以直接拖／滾／用方向鍵（和第三節同一顆）。 */
      var dl = el.querySelector('.pl-dial');
      if (dl) LK().dialBind(dl, {
        get: function () { return mx.raw; },
        set: function (v) { mx.raw = Math.max(0, Math.min(100, v)); markTried(); mixPaint(); }
      });
      var n0 = el.querySelector('#pl-n0');
      if (n0) n0.addEventListener('click', function () {
        if (Object.keys(mx.tried).length < 4)
          return view('⚠️ 還有配法沒試過 —— **四種都拉一次**，' +
                      '不然等一下想題目的時候會忘記某一樣能做什麼。', 'bad');
        node = 2; view('', '');
      });
      el.querySelectorAll('[data-scene]').forEach(function (b) {
        b.addEventListener('click', function () {
          p.scene = b.getAttribute('data-scene'); view('', '');
        });
      });
      el.querySelectorAll('[data-in]').forEach(function (b) {
        b.addEventListener('click', function () {
          grab();
          /* 換了輸入 → 觸發條件要重選（數字型和按鈕型問的不是同一件事）。 */
          if (p.input !== b.getAttribute('data-in')) p.value = '';
          p.input = b.getAttribute('data-in');
          var i = byKey(INPUTS, p.input);
          if (i && p.value === '') p.value = String(i.def);
          view('', '');
        });
      });
      el.querySelectorAll('[data-out]').forEach(function (b) {
        b.addEventListener('click', function () {
          grab();
          if (p.output !== b.getAttribute('data-out')) p.act = '';
          p.output = b.getAttribute('data-out');
          view('', '');
        });
      });
      var n1 = el.querySelector('#pl-n1');
      if (n1) n1.addEventListener('click', function () {
        grab();
        if (!p.scene) return view('先選一個情境，或在下面自己寫一個。', 'bad');
        node = 3; view('', '');
      });
      var n2 = el.querySelector('#pl-n2');
      if (n2) n2.addEventListener('click', function () {
        grab();
        if (!p.input || !p.output) return view(sayPlan(p), 'bad');
        node = 4; view('', '');
      });
      var b2 = el.querySelector('#pl-b2');
      if (b2) b2.addEventListener('click', function () { grab(); node = 2; view('', ''); });
      var b3 = el.querySelector('#pl-b3');
      if (b3) b3.addEventListener('click', function () { grab(); node = 3; view('', ''); });
      var dn = el.querySelector('#pl-done');
      if (dn) dn.addEventListener('click', doDone);
      var ta = el.querySelector('#pl-own');
      if (ta) ta.addEventListener('input', function () { p.scene = ta.value.trim() || p.scene; });
    }

    function doDone() {
      tries++;
      grab();
      if (!planReady(p)) return view(sayPlan(p), 'bad');
      var i = byKey(INPUTS, p.input);
      var n = Number(p.value);
      if (n < i.lo || n > i.hi) return view(sayPlan(p), 'bad');
      el.innerHTML = '<div class="dl-wrap">' + dots() +
        '<div class="pl-line">🎯 <em>' + esc(p.scene) + '</em><br>' + esc(planLine(p)) + '</div>' +
        '<div class="dl-msg good">' + md(
          '🎉 設計單完成 —— **任務卡開了**。\n' +
          '⚠️ 這一句就是你的**基礎關**：先讓它動起來，再想怎麼變聰明。\n' +
          '★ 改主意很正常，隨時可以回來按「再玩一次」改設計單。'
        ).replace(/\n/g, '<br>') + '</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries, plan: p });
    }

    view('', '');
    return { node: function () { return node; }, plan: function () { return p; },
             tries: function () { return tries; },
             set: function (k, v) { p[k] = v; view('', ''); },
             go: function (n) { node = n; view('', ''); } };
  }

  global.PLANLAB = {
    SCENES: SCENES, INPUTS: INPUTS, OUTPUTS: OUTPUTS, ACTS: ACTS, SPD: SPD, LEDS: LEDS,
    actsOf: actsOf, effectOf: effectOf,
    byKey: byKey, planLine: planLine, planReady: planReady, sayPlan: sayPlan,
    mount: mount
  };

})(window);
