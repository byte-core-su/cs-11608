/* =====================================================================
   自己的專案：兩種模式展示 ＋ 成果發表（5016B 第五節）
   ---------------------------------------------------------------------
   這一節沒有「動手檢核」，也不判定學生做出來了沒（電腦看不到硬體）。做兩件事：
     ① 兩種模式的對照 —— 複習前四節，並指出「條件判斷在哪裡」
          自動：超音波接管（近了就亮、就轉）
          手動：旋鈕接管（自己調顏色、調轉速）
        學生的作品**挑一種做就好**，不必做「切換」（教具上沒有按鈕）。
     ② 成果發表：三句話 → 一張帶得走的成果卡（下載成 PNG）

   成果卡用 canvas 自己畫成 PNG，不用 jsPDF 一類的函式庫（預設不含中文字型，會印出豆腐字）。
   三張分層任務卡（基礎／挑戰／創意）寫在頁面的教材區，不做成關卡。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('projlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  var MIN = 4;                   // 每一格至少幾個字
  /* 輸出那四格例外：「熄掉」「停下來」都是完整的答案，用 4 字門檻會逼學生寫廢話 */
  var MIN_IO = 2;
  function minOf(k) {
    return (k === 'thenL' || k === 'thenM' || k === 'elsL' || k === 'elsM')
      ? MIN_IO : MIN;
  }

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  /* ── 兩種模式 ────────────────────────────────────────
     對照表的目的：「**你的程式裡，條件判斷在哪裡？**」
       自動：如果…那麼…否則… —— 判斷寫在中間
       手動：直接換算，**沒有條件判斷** —— 所以要自己補一個
     這正好接上成果發表的第二句。
     兩種都是「一個輸入＋兩個輸出」：自動＝超音波、手動＝可變電阻；輸入不換，兩個輸出（燈條、馬達）都要用到。 */
  var MODES = [
    { key: 'auto', t: '自動', by: '超音波距離感測器',
      d: '人一靠近就亮、就轉；走遠了自己停。',
      good: '★ 好處：不用動手。⚠️ 代價：想要它「現在別亮」也做不到。',
      cond: '**有**條件判斷',
      /* 模式決定成果發表第二句的範例，也會檢查條件和模式對不對得起來（只提醒、不擋）。
         ph 要和 SHOW_Q[1].slots 一格一格對齊（五格）。 */
      ph: ['例：距離小於 30 公分',
           '例：亮起暖黃色', '例：慢慢開始轉',
           '例：熄掉', '例：停下來'],
      words: '距離|公分|靠近|接近|太近|太遠|走|人',
      code: '如果　距離 < 30　那麼\n　　燈條亮起來\n　　風扇開始轉\n否則\n　　兩個都關掉',
      note: '★ 那個 30 就是**你要自己決定的門檻**。' +
            '⚠️ 「否則」不能省 —— 少了它，燈亮起來就**再也不會暗**。' },
    { key: 'manual', t: '手動', by: '可變電阻（旋鈕）',
      d: '轉到哪就是哪 —— 顏色和轉速都自己說了算。',
      good: '★ 好處：完全可控。⚠️ 代價：得一直自己轉。',
      cond: '⚠️ **沒有**條件判斷',
      ph: ['例：旋鈕轉到 80% 以上',
           '例：變成紅色', '例：轉快一點',
           '例：變回白色', '例：慢慢停下來'],
      words: '旋鈕|轉|%|百分|可變電阻',
      code: '轉速 ← 類比對應（A7，−250，250）\n設定馬達 = 轉速\n燈條顏色 ← 類比對應（A7，0，359）',
      note: '⚠️ 這樣寫從頭到尾**沒有一個「如果」** —— 它只是照著換算。' +
            '★ 所以做手動的人要**自己補一個條件**，例如：' +
            '「如果 旋鈕 < 5%，那麼 兩個都關掉」。' }
  ];

  /* ── 成果發表的三句（主詞一律用「我」，研發人員是單數）── */
  var SHOW_Q = [
    { key: 's1', t: '我要解決的問題是：', slots: ['problem'],
      ph: ['例：晚上回家玄關太暗，開燈要摸半天'] },
    /* 第二句就是**程式裡那個判斷**：寫不出條件的，通常程式裡也沒有。
       「否則」那兩格擋得住最多錯 —— 少了它，動作做了就回不去。
       （和第一節「門開了沒」是同一族：只想了該做的時候，沒想不該做的時候。）
       「系統會…」和「否則…」各拆成兩格（燈條、馬達）：合在一格的話學生多半只寫燈。
       元件名可以讀成生活中的實際產品（燈條＝玄關燈、馬達＝電扇）。 */
    { key: 's2', t: '當＿＿＿＿時，（燈條）＿＿＿＿、（馬達）＿＿＿＿；' +
                    '否則（燈條）＿＿＿＿、（馬達）＿＿＿＿。',
      slots: ['when', 'thenL', 'thenM', 'elsL', 'elsM'],
      hint: '＝ <b>如果</b>（條件）<b>那麼</b>（兩個輸出各做什麼）' +
            '<b>否則</b>（兩個各恢復成什麼）<br>' +
            '⚠️ 「否則」那兩格不能空 —— 少了它，動作做了就<b>回不去</b>。<br>' +
            '★ 和第一節那個「門開了沒」是同一族的毛病：' +
            '只想了<b>該做的時候</b>，沒想<b>不該做的時候</b>。<br>' +
            '★ （燈條）（馬達）可以讀成你作品裡的東西：玄關燈、電扇…',
      ph: ['例：距離小於 30 公分',
           '例：亮起暖黃色', '例：慢慢開始轉',
           '例：熄掉', '例：停下來'] },
    /* 第三句的第三格是**反思**：前兩格是事情經過，第三格才是「所以呢」 */
    { key: 's3', t: '我遇到＿＿＿＿，最後用＿＿＿＿解決，我學到＿＿＿＿。',
      slots: ['trouble', 'fix', 'learn'],
      ph: ['例：距離一直跳來跳去，燈會閃',
           '例：把門檻改成兩個數字（進 15 出 25）',
           '例：感測器讀到的數字會抖，門檻不能只設一個'] }
  ];
  /* 第三句最常見的敷衍：「沒有遇到問題」—— 那會讓這一節最有價值的部分不見 */
  var NO_TROUBLE = /^(沒有|沒|無|都很順利|很順利|沒問題|沒遇到|一切順利|none|no)/;
  /* 條件要看得出「拿什麼在比」：要有數字，或一個比較／臨界的說法。
     刻意放寬到「靠近／碰到／轉到底」這種生活講法，不必寫成數學式。 */
  var COND = new RegExp('[0-9０-９]|小於|大於|超過|低於|高於|以內|以下|以上|不到|' +
                        '靠近|接近|太近|太遠|碰到|轉到|滿|到達|超出|距離|公分|%');
  /* ═══ 系統規格 ═══════════════════════════════════════
     輸入不讓學生選 —— 由模式決定（自動＝超音波、手動＝旋鈕）；兩個輸出都要用到。 */
  var OUTS = [
    { key: 'strip', t: 'RGB 全彩燈條', pin: '燈條腳位', from: '第二、四節' },
    { key: 'moto',  t: '直流馬達',     pin: '馬達 腳位 2、3', from: '第三節' }
  ];
  function inputOf(modeT) {
    var m = MODES.filter(function (x) { return x.t === modeT; })[0];
    return m ? m.by : '';
  }
  function specOf(v) {
    return {
      mode: v.mode || '',
      input: inputOf(v.mode),
      pin: v.mode === '自動' ? 'Trig = A2、Echo = A3' : 'A7',
      outs: OUTS.map(function (o) { return o.t; }),
      level: '一個輸入 ＋ 兩個輸出'
    };
  }
  function modeOf(t) {
    return MODES.filter(function (m) { return m.t === t; })[0] || null;
  }
  /* 模式和第二句的條件對不對得起來。只提醒不擋（學生可能有沒想到的寫法）。 */
  function mismatch(v) {
    var m = modeOf(v.mode);
    if (!m || !norm(v.when)) return '';
    if (new RegExp(m.words).test(String(v.when))) return '';
    var other = MODES.filter(function (x) { return x !== m; })[0];
    if (other && new RegExp(other.words).test(String(v.when)))
      return '⚠️ 你選的是**' + m.t + '模式**（靠' + m.by + '），' +
             '但第二句的條件講的是**' + other.t + '模式**那一邊的東西。' +
             '★ 兩個對不起來的話，聽的人會很困惑 —— 檢查一下是哪一個寫錯了。';
    return '';
  }
  function judgeShow(v) {
    /* 這一條排在長度檢查前面：學生實際打的就是「沒有」兩個字，
       先查長度的話他收到「太短」，只會補成「沒有遇到問題」。 */
    if (NO_TROUBLE.test(norm(v.trouble))) return { ok: false, how: 'notrouble' };
    var miss = [];
    ['problem', 'when', 'thenL', 'thenM', 'elsL', 'elsM',
     'trouble', 'fix', 'learn'].forEach(function (k) {
      if (norm(v[k]).length < minOf(k)) miss.push(k);
    });
    if (miss.length) return { ok: false, how: 'short', miss: miss };
    /* 規格不完整就出不了卡 */
    if (!v.mode) return { ok: false, how: 'nomode' };
    if (!COND.test(String(v.when || ''))) return { ok: false, how: 'nocond' };
    return { ok: true, how: 'fit', warn: mismatch(v) };
  }
  var LABEL = { problem: '要解決的問題', when: '當…時',
                thenL: '（燈條）會…', thenM: '（馬達）會…',
                elsL: '否則（燈條）…', elsM: '否則（馬達）…',
                trouble: '我遇到…', fix: '最後用…解決', learn: '我學到…' };
  function sayShow(r) {
    /* 正常走不到 nomode（沒選模式就進不了成果發表），留著給外部呼叫 judgeShow 時用 */
    if (r.how === 'nomode')
      return '⚠️ 先在上面那一頁**挑一種模式**（自動或手動）—— ' +
             '成果卡上要寫清楚你做的是哪一種。';
    if (r.how === 'nocond')
      return '⚠️ 第二句的「當＿＿時」要是一個**條件** —— ' +
             '也就是程式裡那個「**如果**」。\n' +
             '★ 條件要看得出**拿什麼在比**：' +
             '「距離小於 30 公分」「旋鈕轉到底」「太近的時候」都可以；\n' +
             '⚠️ 「當我們做好的時候」不算 —— 那不是程式判斷得出來的事。';
    if (r.how === 'notrouble')
      return '⛔ 「沒有遇到問題」不能算 —— 這一格是整段發表**最值錢**的地方。' +
             '★ 想想看：第一次燒錄成功了嗎？數字第一次就抓對了嗎？' +
             '線有沒有插錯過？那些都算。';
    if (r.how === 'short')
      return '⚠️ 還有沒填完的：**' +
             r.miss.map(function (k) { return LABEL[k]; }).join('、') + '**。';
    return '';
  }


  /* ═══ 成果卡：下載成 PNG ═════════════════════════════
     cardLines() 是下載 PNG 那一版的版面來源；網頁上的 cardHtml() 有自己的一份，兩份要一起改。
     每一列帶兩個訊息：是規格（k/v 一列一行）還是內文；字是學生自己打的（own:true）還是系統填的。 */
  function cardLines(v) {
    var sp = specOf(v);
    return [
      { s: '一、系統規格' },
      { t: 'spec', k: '控制模式', v: sp.mode ? sp.mode + '模式' : '—' },
      { t: 'spec', k: '輸入元件', v: sp.input || '—' },
      { t: 'spec', k: '接腳',     v: sp.pin },
      { t: 'spec', k: '輸出元件', v: sp.outs.join('、') },
      { t: 'spec', k: '系統架構', v: sp.level },
      { s: '二、動作說明' },
      { t: 'line', n: '1', k: '我要解決的問題是', v: v.problem, own: true },
      { t: 'cond', k: '當', v: v.when, own: true, tail: '時' },
      { t: 'io', k: '那麼　（燈條）', v: v.thenL, own: true },
      { t: 'io', k: '　　　（馬達）', v: v.thenM, own: true },
      { t: 'io', k: '否則　（燈條）', v: v.elsL, own: true },
      { t: 'io', k: '　　　（馬達）', v: v.elsM, own: true },
      { s: '三、問題與解決' },
      { t: 'line', n: '2', k: '我遇到', v: v.trouble, own: true },
      { t: 'line', n: '3', k: '最後用…解決', v: v.fix, own: true },
      { t: 'line', n: '4', k: '我學到', v: v.learn, own: true }
    ];
  }

  /* 網頁版成果卡：技術文件格式
       抬頭（單位／文件名／日期）→ 基本資料 → 一、系統規格 → 二、動作說明 → 三、問題與解決 → 簽名欄
     欄位名稱用學生看得懂的話。 */
  function cardHtml(v, meta) {
    var esc = LK().esc;
    var m = meta || {};
    var sp = specOf(v);
    /* .pj-li 是 flex 容器：只放兩個子元素（編號圓點、內容區塊），
       內容區塊裡的句子和表格才會正常往下排。 */
    function li(n, html) {
      return '<div class="pj-li"><span class="pj-no">' + n + '</span>' +
             '<div class="pj-li-b">' + html + '</div></div>';
    }
    /* 學生打的字上藍色（網頁版和 PNG 同一套） */
    function row(k, val, own) {
      return '<tr><th>' + esc(k) + '</th><td' + (own ? ' class="pj-own"' : '') +
        '>' + esc(val || '—') + '</td></tr>';
    }
    return '<div class="pj-card" id="pj-card">' +
      '<div class="pj-doc-h">' +
        '<div class="pj-doc-org">' + esc(m.org || '智慧家居機電專題') + '</div>' +
        '<div class="pj-doc-t">專題成果報告</div>' +
        '<div class="pj-doc-m">' + esc(m.date || '') + '</div>' +
      '</div>' +
      '<table class="pj-tb pj-tb-head">' +
        row('專題名稱', m.scene, true) +
        row('研發人員', m.team) +
        row('系統架構', sp.level) +
      '</table>' +
      '<div class="pj-sec">一、系統規格</div>' +
      '<table class="pj-tb">' +
        row('控制模式', sp.mode ? sp.mode + '模式' : '') +
        row('輸入元件', sp.input) +
        row('接腳', sp.pin) +
        row('輸出元件', sp.outs.join('、')) +
      '</table>' +
      '<div class="pj-sec">二、動作說明</div>' +
      '<div class="pj-body">' +
        li('1', '我要解決的問題是：' +
              '<span class="pj-own">' + esc(v.problem) + '</span>') +
        li('2', '當 <span class="pj-own">' + esc(v.when) + '</span> 時：' +
              '<table class="pj-tb pj-tb-io"><tr><th>燈條</th>' +
              '<td class="pj-own">' + esc(v.thenL) + '</td>' +
              '<th>馬達</th><td class="pj-own">' + esc(v.thenM) + '</td></tr>' +
              '<tr><th>否則 燈條</th><td class="pj-own">' + esc(v.elsL) + '</td>' +
              '<th>否則 馬達</th><td class="pj-own">' + esc(v.elsM) +
              '</td></tr></table>') +
      '</div>' +
      '<div class="pj-sec">三、問題與解決</div>' +
      '<div class="pj-body">' +
        li('3', '我遇到 <span class="pj-own">' + esc(v.trouble) +
              '</span>，最後用 <span class="pj-own">' + esc(v.fix) + '</span> 解決。') +
        li('4', '我學到 <span class="pj-own">' + esc(v.learn) + '</span>。') +
        '<div class="pj-legend">■ 藍色的字是研發人員自己填的</div>' +
      '</div>' +
      (m.line ? '<div class="pj-doc-f">設計單：' + esc(m.line) + '</div>' : '') +
      '<div class="pj-sign"><span>研發人員簽名</span><span>教師確認</span></div>' +
    '</div>';
  }

  /* 下載 PNG：canvas 自己畫，用系統字型 fillText，中文不會有問題 */
  function wrapText(ctx, text, max) {
    var out = [], line = '';
    String(text || '').split('').forEach(function (ch) {
      if (ch === '\n') { out.push(line); line = ''; return; }
      if (ctx.measureText(line + ch).width > max) { out.push(line); line = ch; }
      else line += ch;
    });
    if (line) out.push(line);
    return out;
  }
  /* 顏色：學生自己打的字用深藍，系統／樣板字用深灰 —— 改作業時一眼分得出哪些是他寫的 */
  var C_OWN = '#1d4ed8';        // 學生打的
  var C_TXT = '#334155';        // 系統／樣板
  var C_KEY = '#64748b';        // 欄位名
  var C_ACC = '#7c3aed';        // 主色
  function drawCard(v, meta) {
    var W = 1000, H = 1414, pad = 78;          // A4 直式的比例
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
    var m = meta || {}, sp = specOf(v), IN = W - pad * 2;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    /* 左側色帶 */
    c.fillStyle = C_ACC; c.fillRect(0, 0, 12, H);

    /* ── 抬頭 ── */
    var y = pad + 14;
    c.fillStyle = C_KEY; c.font = '700 20px ' + FONT;
    c.fillText(String(m.org || '智慧家居機電專題'), pad, y);
    c.textAlign = 'right'; c.fillText(String(m.date || ''), W - pad, y);
    c.textAlign = 'left';
    y += 46;
    c.fillStyle = '#0f172a'; c.font = '900 42px ' + FONT;
    c.fillText('專題成果報告', pad, y);
    y += 16;
    c.fillStyle = C_ACC; c.fillRect(pad, y, IN, 4);
    y += 34;

    /* ── 表格：一列一行，欄位名在左、內容在右 ── */
    var KW = 132;                       // 欄位名那一欄的寬
    function row(k, val, own) {
      c.font = '800 23px ' + FONT;
      var lines = wrapText(c, String(val == null || val === '' ? '—' : val), IN - KW - 26);
      var h = Math.max(40, lines.length * 34 + 12);
      c.strokeStyle = '#e2e8f0'; c.lineWidth = 1.5;
      c.strokeRect(pad, y, IN, h);
      c.fillStyle = '#f8fafc'; c.fillRect(pad + 1, y + 1, KW - 1, h - 2);
      c.beginPath(); c.moveTo(pad + KW, y); c.lineTo(pad + KW, y + h); c.stroke();
      c.fillStyle = C_KEY; c.font = '900 21px ' + FONT;
      c.fillText(k, pad + 14, y + 27);
      c.fillStyle = own ? C_OWN : C_TXT; c.font = '800 23px ' + FONT;
      lines.forEach(function (l, i) { c.fillText(l, pad + KW + 14, y + 27 + i * 34); });
      y += h;
    }
    row('專題名稱', m.scene, true);
    row('研發人員', m.team, false);

    /* ── 段落 ── */
    function sec(t) {
      y += 26;
      c.fillStyle = '#f5f3ff'; c.fillRect(pad, y - 22, IN, 34);
      c.fillStyle = C_ACC; c.fillRect(pad, y - 22, 5, 34);
      c.font = '900 23px ' + FONT;
      c.fillText(t, pad + 16, y + 2);
      y += 26;
    }
    /* 內文一列（編號 ＋ 標籤 ＋ 學生的字） */
    function line(n, k, val, own) {
      c.fillStyle = '#ede9fe';
      c.beginPath(); c.arc(pad + 13, y - 1, 13, 0, Math.PI * 2); c.fill();
      c.fillStyle = C_ACC; c.font = '900 17px ' + FONT;
      c.textAlign = 'center'; c.fillText(n, pad + 13, y + 5); c.textAlign = 'left';
      c.fillStyle = C_KEY; c.font = '900 21px ' + FONT;
      c.fillText(k, pad + 36, y + 5);
      y += 32;
      c.fillStyle = own ? C_OWN : C_TXT; c.font = '800 24px ' + FONT;
      wrapText(c, String(val || '—'), IN - 36).forEach(function (l) {
        c.fillText(l, pad + 36, y); y += 33;
      });
      y += 10;
    }
    /* 條件那一列框起來：它就是程式裡的「如果」 */
    function cond(k, val, tail) {
      c.fillStyle = '#fffbeb'; c.strokeStyle = '#fcd34d'; c.lineWidth = 2;
      var h = 48;
      c.fillRect(pad, y - 8, IN, h); c.strokeRect(pad, y - 8, IN, h);
      c.fillStyle = C_KEY; c.font = '900 21px ' + FONT;
      c.fillText(k, pad + 14, y + 22);
      var kw = c.measureText(k).width;
      c.fillStyle = C_OWN; c.font = '900 24px ' + FONT;
      c.fillText(String(val || '—'), pad + 24 + kw, y + 22);
      var vw = c.measureText(String(val || '—')).width;
      c.fillStyle = C_KEY; c.font = '900 21px ' + FONT;
      c.fillText(tail || '', pad + 34 + kw + vw, y + 22);
      y += h + 8;
    }
    /* 輸出那四列：標籤在左，箭頭，學生的字在右 */
    function io(k, val) {
      c.fillStyle = C_KEY; c.font = '900 21px ' + FONT;
      c.fillText(k, pad + 22, y + 12);
      c.fillStyle = '#cbd5e1'; c.fillText('→', pad + 200, y + 12);
      c.fillStyle = C_OWN; c.font = '800 23px ' + FONT;
      c.fillText(String(val || '—'), pad + 240, y + 12);
      y += 36;
    }

    cardLines(v).forEach(function (r) {
      if (r.s) return sec(r.s);
      if (r.t === 'spec') return row(r.k, r.v, false);
      if (r.t === 'cond') return cond(r.k, r.v, r.tail);
      if (r.t === 'io') return io(r.k, r.v);
      line(r.n, r.k, r.v, r.own);
    });

    /* ── 頁尾：圖例 ＋ 簽名 ── */
    var fy = H - pad - 62;
    c.fillStyle = C_OWN; c.font = '800 17px ' + FONT;
    c.fillText('■', pad, fy);
    c.fillStyle = C_KEY; c.fillText(' 藍色的字是研發人員自己填的', pad + 18, fy);
    var sy = H - pad - 8;
    c.strokeStyle = '#cbd5e1'; c.lineWidth = 2;
    [0, 1].forEach(function (i) {
      var x = pad + i * (IN / 2 + 10), w = IN / 2 - 10;
      c.beginPath(); c.moveTo(x, sy); c.lineTo(x + w, sy); c.stroke();
      c.fillStyle = '#94a3b8'; c.font = '700 18px ' + FONT;
      c.fillText(i === 0 ? '研發人員簽名' : '教師確認', x, sy + 24);
    });
    return cv;
  }

  /* 檔名「成果發表-班級_座號_姓名.png」。拿掉 Windows 不准的字元與空白；
     讀不到身分時退回專題名稱。 */
  function safeName(t) {
    return String(t || '').replace(/[\\\/:*?"<>|\s]+/g, '');
  }
  function fileName(meta) {
    var m = meta || {};
    var who = safeName(m.file);
    return '成果發表-' + (who || safeName(m.scene) || '專題') + '.png';
  }
  function downloadPng(v, meta) {
    var cv = drawCard(v, meta);
    var a = document.createElement('a');
    a.download = fileName(meta);
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ═══ 樣式 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pj-lv{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.pj-tab{flex:1;min-width:130px;text-align:center;padding:10px 8px;border-radius:12px;' +
    'border:2px solid #e2e8f0;font-weight:900;font-size:14px;color:#64748b;background:#fff;' +
    'cursor:pointer}' +
  '.pj-tab.on{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6}' +
  '.pj-tab.off{opacity:.55;cursor:not-allowed}' +
  '.pj-tab span{display:block;font-size:11px;font-weight:800;opacity:.8}' +
  '.pj-goal{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin-bottom:12px}' +
  '.pj-goal em{color:#fbbf24;font-style:normal}' +
  '.pj-ask{font-size:15px;font-weight:900;color:#0f172a;line-height:1.9;margin:12px 0 8px}' +
  '.pj-stage{background:#0f172a;border-radius:14px;padding:16px;margin:10px 0}' +
  '.pj-strip{display:flex;gap:5px;justify-content:center;margin-bottom:12px}' +
  '.pj-led{width:28px;height:28px;border-radius:50%;border:2px solid #334155}' +
  '.pj-fan{display:flex;align-items:center;justify-content:center;gap:12px;' +
    'color:#e2e8f0;font-weight:900;font-size:15px}' +

  '.pj-read{text-align:center;color:#94a3b8;font-weight:900;font-size:14px;margin-top:10px;' +
    'font-variant-numeric:tabular-nums}' +
  '.pj-sl{display:flex;align-items:center;gap:10px;font-weight:900;font-size:15px;margin:10px 0}' +
  '.pj-sl input{flex:1;height:30px;cursor:pointer}' +
  '.pj-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:900;' +
    'font-size:15px;margin:8px 0}' +
  '.pj-t{flex:1;min-width:150px;font-size:15px;font-weight:800;padding:9px 12px;' +
    'border:2px solid #cbd5e1;border-radius:10px;box-sizing:border-box}' +
  '.pj-note{font-size:13px;color:#64748b;font-weight:700;line-height:1.8;margin-top:6px}' +
  '.pj-who{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#f8fafc;' +
    'border:2px solid #e2e8f0;border-radius:12px;padding:10px 13px;margin:8px 0;' +
    'font-size:15px;font-weight:900;color:#0f172a}' +
  '.pj-who-k{font-size:12px;font-weight:900;color:#7c3aed}' +
  '.pj-who-n{font-size:12px;font-weight:800;color:#94a3b8}' +
  '.pj-who-w{font-size:14px;font-weight:800;color:#64748b}' +
  '.pj-who-b{font-size:14px;font-weight:900;color:#b45309}' +
  '.pj-who-r{padding:5px 12px;font-size:12px}' +
  '.pj-spec{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;' +
    'padding:11px 13px;margin:10px 0}' +
  '.pj-spec-h{font-size:12px;font-weight:900;color:#7c3aed;margin-bottom:5px}' +
  '.pj-spec-r{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;' +
    'font-weight:800;color:#475569;margin:4px 0}' +
  '.pj-spec-r b{color:#0f172a}' +
  '.pj-spec-r span{font-size:12px;color:#94a3b8;font-family:monospace}' +
  '.pj-spec-n{font-size:12px;font-weight:800;color:#94a3b8;margin-top:5px}' +
  '.pj-io2{padding-left:14px}' +
  '.pj-io2 b{color:#7c3aed;min-width:62px}' +
  '.pj-tb-io{margin:6px 0 0}' +
  '.pj-tb-io th{width:78px;font-size:13px}' +
  '.pj-tb-io td{font-size:14px}' +
  '.pj-hint{font-size:13px;font-weight:800;color:#7c3aed;background:#f5f3ff;' +
    'border-radius:10px;padding:7px 10px;margin-top:5px;line-height:1.8}' +
  /* 兩種模式的對照表 */
  '.pj-cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}' +
  '.pj-col{border:2px solid #e2e8f0;border-radius:14px;padding:13px;background:#fff}' +
  '.pj-col.on{border-color:#7c3aed;background:#faf5ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pj-col-h{font-size:17px;font-weight:900;color:#0f172a;margin-bottom:6px}' +
  '.pj-col-b{font-size:14px;font-weight:800;color:#334155;line-height:1.8}' +
  '.pj-code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px 12px;' +
    'font-family:monospace;font-size:13px;line-height:1.9;margin:8px 0}' +
  '.pj-cond{font-size:14px;font-weight:900;color:#7c3aed;margin-bottom:4px}' +
  '.pj-col-n{font-size:13px;font-weight:700;color:#64748b;line-height:1.8;margin-bottom:6px}' +
  '.pj-pick{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:12px 14px;' +
    'margin:12px 0;font-weight:800;font-size:14px;color:#78350f;line-height:1.8}' +
  /* 成果卡 */
  '.pj-card{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:30px 32px;' +
    'margin:14px 0;line-height:1.9;color:#0f172a}' +
  '.pj-doc-h{display:flex;justify-content:space-between;align-items:baseline;' +
    'flex-wrap:wrap;gap:6px;border-bottom:3px solid #7c3aed;padding-bottom:10px}' +
  '.pj-doc-org{font-size:14px;font-weight:800;color:#64748b;letter-spacing:.08em}' +
  '.pj-doc-t{font-size:26px;font-weight:900;letter-spacing:.12em}' +
  '.pj-doc-m{font-size:13px;font-weight:800;color:#64748b}' +
  '.pj-tb{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px}' +
  '.pj-tb th{width:112px;text-align:left;font-weight:900;color:#64748b;' +
    'background:#f8fafc;border:1px solid #e2e8f0;padding:7px 11px;white-space:nowrap}' +
  '.pj-tb td{border:1px solid #e2e8f0;padding:7px 11px;font-weight:800}' +
  '.pj-tb-head th{color:#7c3aed}' +
  '.pj-sec{font-size:16px;font-weight:900;color:#7c3aed;margin:18px 0 6px;' +
    'border-bottom:2px solid #ede9fe;padding-bottom:4px}' +
  '.pj-body{font-size:15px;font-weight:800;color:#334155}' +
  '.pj-li{display:flex;gap:9px;align-items:flex-start;margin-bottom:10px;line-height:1.9}' +
  /* 只有直接子元素才是 flex item（編號、內容區塊）；
     不要寫成 .pj-li span，那會連內容裡的 .pj-own 一起套上圓點樣式。 */
  '.pj-li>.pj-no{flex:none;width:22px;height:22px;border-radius:50%;background:#ede9fe;' +
    'color:#7c3aed;font-size:13px;font-weight:900;text-align:center;line-height:22px;' +
    'margin-top:5px}' +
  '.pj-li>.pj-li-b{flex:1;min-width:0}' +
  '.pj-li b{color:#0f172a}' +
  '.pj-own{color:#1d4ed8;font-weight:900}' +
  '.pj-legend{font-size:12px;font-weight:800;color:#94a3b8;margin-top:14px}' +
  '.pj-doc-f{font-size:12px;font-weight:800;color:#94a3b8;background:#f8fafc;' +
    'border-radius:6px;padding:7px 10px;margin-top:14px}' +
  '.pj-sign{display:flex;gap:20px;margin-top:26px}' +
  '.pj-sign span{flex:1;border-top:1px solid #cbd5e1;padding-top:6px;font-size:12px;' +
    'font-weight:800;color:#94a3b8}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('projlab-css')) return;
    var st = document.createElement('style');
    st.id = 'projlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var line = String(opts.line || '');
    var scene = (opts.plan && opts.plan.scene) || '我的專題';
    var tab = 'demo';                 // demo（兩種模式）／show（成果發表）
    /* 學生的作答（會存起來、下次載回）。身分不放在這裡。 */
    var f = Object.assign({ mode: '', problem: '', when: '',
                            thenL: '', thenM: '', elsL: '', elsM: '',
                            trouble: '', fix: '', learn: '' }, opts.work || {});
    /* 研發人員：唯讀，只由系統填（opts.who 或稍後 setWho 補進來的名冊值）。
       不放進 f，舊紀錄裡手打的名字不會跟著跑。 */
    var who = String(opts.who || '');
    /* 檔名要的是「班級_座號_姓名」，和畫面顯示的格式不同，由頁面另外給 */
    var whoFile = String(opts.whoFile || '');
    /* 三態：已帶入／還在問名冊／問不到（不可以靜默留白） */
    var whoState = who ? 'got' : 'wait';
    function whoLine() {
      if (whoState === 'got')
        return '<span class="pj-who-k">研發人員</span>' +
               '<b>' + esc(who) + '</b>' +
               '<span class="pj-who-n">（系統自動填入，不可修改）</span>';
      if (whoState === 'wait')
        return '<span class="pj-who-k">研發人員</span>' +
               '<span class="pj-who-w">⏳ 正在讀你的班級座號姓名…</span>';
      return '<span class="pj-who-k">研發人員</span>' +
             '<span class="pj-who-b">⚠️ 這一頁沒問到你的班級座號姓名</span>' +
             '<button class="dl-go pj-who-r" id="pj-whoretry">重新讀取</button>';
    }
    /* 頁面問到名冊之後補進來 */
    function setWho(t, file) {
      whoState = t ? 'got' : 'miss';
      if (t) who = t;
      if (file) whoFile = file;
      var n = el.querySelector('#pj-who');
      if (n) { n.innerHTML = whoLine(); bind(); }
    }

    function tabs() {
      var t = [['demo', '🎛️ 兩種模式', '玩玩看，複習前四節'],
               ['show', '🎤 成果發表', '三句話 ＋ 成果卡']];
      return '<div class="pj-lv">' + t.map(function (x) {
        var off = (x[0] === 'show' && !f.mode);
        return '<div class="pj-tab ' + (tab === x[0] ? 'on' : '') + (off ? ' off' : '') +
          '" data-tab="' + x[0] + '">' +
          x[1] + '<span>' + (off ? '先挑一種模式' : x[2]) + '</span></div>';
      }).join('') + '</div>';
    }
    function goal() {
      return '<div class="pj-goal">🎯 <em>' + esc(scene) + '</em>' +
        (line ? '<br>' + esc(line) : '') + '</div>';
    }
    function view(body, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + goal() + body +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }

    /* ── 兩種模式：對照表 ── */
    function viewDemo(msg, cls) {
      view(
        '<div class="pj-ask">🎛️ 同一組硬體，<b>兩種寫法</b>　—— ' +
        '⚠️ 你的作品<b>挑一種做就好</b>。<br>' +
        '★ 不管挑哪一種，都是 <b>一個輸入 ＋ 兩個輸出</b>：' +
        '輸入從頭到尾不換，挑戰關加的是<b>第二個輸出</b>。</div>' +
        '<div class="pj-cmp">' + MODES.map(function (m) {
          return '<div class="pj-col' + (f.mode === m.t ? ' on' : '') + '">' +
            '<div class="pj-col-h">' + esc(m.t) + '模式</div>' +
            '<div class="pj-col-b">靠 <b>' + esc(m.by) + '</b><br>' + esc(m.d) + '</div>' +
            '<div class="pj-code">' + esc(m.code).replace(/\n/g, '<br>') + '</div>' +
            '<div class="pj-cond">' + md(m.cond) + '</div>' +
            '<div class="pj-col-n">' + md(m.note) + '</div>' +
            '<div class="pj-col-n">' + md(m.good) + '</div>' +
            '<button class="dl-go" data-pick="' + esc(m.t) + '"' +
              (f.mode === m.t ? '' : ' style="background:#94a3b8"') + '>' +
              (f.mode === m.t ? '✅ 我做這一種' : '選這一種') + '</button>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="pj-pick">🧩 <b>不管做哪一種，程式裡一定要有一個「如果」。</b><br>' +
          '自動那一種本來就有；手動那一種要自己補 —— ' +
          '想想看：<b>什麼情況下它應該整個停下來？</b><br>' +
          '★ 這一句等一下就是成果發表的第二句。</div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-go-show"' +
          (f.mode ? '' : ' style="background:#94a3b8"') + '>' +
          (f.mode ? '去填成果發表 →' : '先挑一種模式') + '</button></div>',
        msg, cls);
    }

    /* ── 成果發表 ── */
    function viewShow(msg, cls) {
      view(
        '<div class="pj-ask">🎤 <b>成果發表</b>　—— 固定講這三句就好。</div>' +
        /* 研發人員：唯讀，由系統填（這張卡要交出去，能打字就有人會打別人的名字）。
           讀不到通常只是「還沒問到」名冊，給一顆重新讀取。 */
        '<div class="pj-who" id="pj-who">' + whoLine() + '</div>' +
        /* 檔名在表單上就先寫出來（出卡之後學生已經不會注意名字對不對） */
        '<div class="pj-note">🖼️ 下載的檔名會是 <b>' + esc(fname()) + '</b></div>' +
        /* 輸入不讓學生選，由模式決定 */
        '<div class="pj-spec">' +
          '<div class="pj-spec-h">系統規格</div>' +
          '<div class="pj-spec-r">控制模式：<b>' +
            (f.mode ? esc(f.mode) + '模式' : '⚠️ 還沒挑（回上一頁選）') + '</b></div>' +
          '<div class="pj-spec-r">輸入元件：<b>' +
            (inputOf(f.mode) || '（挑了模式就會自動帶出來）') + '</b>' +
            '<span>' + (f.mode === '自動' ? 'Trig = A2、Echo = A3'
                                          : (f.mode ? 'A7' : '')) + '</span></div>' +
          '<div class="pj-spec-r">輸出元件：<b>' +
            OUTS.map(function (o) { return esc(o.t); }).join('、') + '</b></div>' +
          '<div class="pj-spec-n">★ 兩個輸出**都要用到** —— ' +
          '同一個判斷底下，燈條和馬達一起動。</div>' +
        '</div>' +
        '<div class="pj-ask" style="margin-top:10px">1. 我要解決的問題是：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-problem" value="' + esc(f.problem) +
          '" placeholder="' + esc(SHOW_Q[0].ph[0]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">2. 當＿＿時，兩個輸出各做什麼？' +
          '<div class="pj-hint">' + SHOW_Q[1].hint + '</div></div>' +
        '<div class="pj-fill">當　<input class="pj-t" id="pj-when" value="' + esc(f.when) +
          '" placeholder="' + esc(ph2(0)) + '">　時</div>' +
        '<div class="pj-fill pj-io2"><b>（燈條）</b>會　' +
          '<input class="pj-t" id="pj-thenL" value="' + esc(f.thenL) +
          '" placeholder="' + esc(ph2(1)) + '"></div>' +
        '<div class="pj-fill pj-io2"><b>（馬達）</b>會　' +
          '<input class="pj-t" id="pj-thenM" value="' + esc(f.thenM) +
          '" placeholder="' + esc(ph2(2)) + '"></div>' +
        '<div class="pj-fill" style="margin-top:8px">否則 ——</div>' +
        '<div class="pj-fill pj-io2"><b>（燈條）</b>　' +
          '<input class="pj-t" id="pj-elsL" value="' + esc(f.elsL) +
          '" placeholder="' + esc(ph2(3)) + '"></div>' +
        '<div class="pj-fill pj-io2"><b>（馬達）</b>　' +
          '<input class="pj-t" id="pj-elsM" value="' + esc(f.elsM) +
          '" placeholder="' + esc(ph2(4)) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">' +
          '3. 我遇到＿＿，最後用＿＿解決，我學到＿＿。</div>' +
        '<div class="pj-fill">我遇到　<input class="pj-t" id="pj-trouble" value="' +
          esc(f.trouble) + '" placeholder="' + esc(SHOW_Q[2].ph[0]) + '"></div>' +
        '<div class="pj-fill">最後用　<input class="pj-t" id="pj-fix" value="' + esc(f.fix) +
          '" placeholder="' + esc(SHOW_Q[2].ph[1]) + '">　解決</div>' +
        '<div class="pj-fill">我學到　<input class="pj-t" id="pj-learn" value="' + esc(f.learn) +
          '" placeholder="' + esc(SHOW_Q[2].ph[2]) + '"></div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-make">產生成果卡</button></div>',
        msg, cls);
    }
    /* 第二句的範例跟著選的模式走：自動給距離的例子，手動給旋鈕的例子 */
    function ph2(i) {
      var m = modeOf(f.mode);
      return (m && m.ph && m.ph[i]) || SHOW_Q[1].ph[i];
    }
    function fname() { return fileName(meta()); }
    function meta() {
      return { scene: scene, team: who, file: whoFile, mode: f.mode, line: line,
               date: new Date().toLocaleDateString('zh-TW') };
    }
    function doShow() {
      grab();
      var r = judgeShow(f);
      if (!r.ok) return viewShow(sayShow(r), 'bad');
      /* 條件和模式對不起來：只提醒一次，但要在出卡之前講 */
      if (r.warn && !f.warned) { f.warned = true; return viewShow(r.warn, 'bad'); }
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">🎉 成果卡好了 —— 下載成圖片就能帶走。</div>' +
        cardHtml(f, meta()) +
        '<div class="dl-row">' +
          '<button class="dl-go" id="pj-png">🖼️ 下載成圖片</button> ' +
          '<button class="dl-go" id="pj-back" style="background:#94a3b8">回去改</button>' +
        '</div>' +
        '<div class="pj-note">⚠️ 電腦教室<b>關機會還原</b> —— ' +
        '下載完記得把檔案傳給自己，或直接交給老師。<br>' +
        '★ 檔名會自動取成 <b>' + esc(fname()) + '</b>。</div>' +
        '</div>';
      bind();
      /* 存下來的是作答，不含身分 */
      if (typeof opts.onDone === 'function') opts.onDone({ work: f });
    }

    function grab() {
      [['pj-problem', 'problem'], ['pj-when', 'when'],
       ['pj-thenL', 'thenL'], ['pj-thenM', 'thenM'],
       ['pj-elsL', 'elsL'], ['pj-elsM', 'elsM'],
       ['pj-trouble', 'trouble'], ['pj-fix', 'fix'],
       ['pj-learn', 'learn']].forEach(function (x) {
        var e = el.querySelector('#' + x[0]);
        if (e) f[x[1]] = e.value;
      });
    }
    /* 沒選模式不能進成果發表：第二句的範例、規格都跟著模式走 */
    function show(t) {
      if (t === 'show' && !f.mode)
        return viewDemo('⚠️ 先挑一種模式（**自動**或**手動**）再往下 —— ' +
                        '成果發表要寫的條件、範例、規格都跟著它走。', 'bad');
      tab = t;
      if (t === 'demo') viewDemo('', ''); else viewShow('', '');
    }

    function bind() {
      var on = function (id, fn) {
        var e = el.querySelector('#' + id); if (e) e.addEventListener('click', fn);
      };
      on('pj-make', doShow);
      /* 打字就把文字收進資料（不重畫，不然會失焦） */
      el.querySelectorAll('.pj-t').forEach(function (t) {
        t.addEventListener('input', function () { grab(); });
      });
      /* 問不到身分時留一顆「重新讀取」 */
      on('pj-whoretry', function () {
        whoState = 'wait';
        var n = el.querySelector('#pj-who');
        if (n) { n.innerHTML = whoLine(); bind(); }
        if (typeof opts.onRetryWho === 'function') opts.onRetryWho();
      });
      on('pj-png', function () { downloadPng(f, meta()); });
      on('pj-back', function () { show('show'); });
      on('pj-go-show', function () { show('show'); });
      /* 兩塊都是開的，隨時可以來回 */
      el.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (tab === 'show') grab();
          show(b.getAttribute('data-tab'));
        });
      });
      el.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { f.mode = b.getAttribute('data-pick'); viewDemo('', ''); });
      });
    }

    show('demo');
    return { tab: function () { return tab; }, work: function () { return f; },
             setWho: setWho, whoState: function () { return whoState; },
             fname: fname,
             show: show, card: function () { return cardHtml(f, meta()); } };
  }

  global.PROJLAB = {
    MIN: MIN, MIN_IO: MIN_IO, MODES: MODES, SHOW_Q: SHOW_Q,
    judgeShow: judgeShow, sayShow: sayShow,
    OUTS: OUTS, specOf: specOf, inputOf: inputOf,
    cardHtml: cardHtml, cardLines: cardLines, drawCard: drawCard,
    fileName: fileName, safeName: safeName, downloadPng: downloadPng,
    mount: mount
  };

})(window);
