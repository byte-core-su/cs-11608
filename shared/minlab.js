/* =====================================================================
   找最小值實驗室（第 5 關 6-1-1 排隊比高矮）
   ---------------------------------------------------------------------
   ★ 為什麼第 5 關需要這一段
     這一關本來只有情境、推導、概念檢測 —— 情境寫「不寫程式，用點的就好」，
     但畫面上沒有東西可以點。它是全課程份量最輕的一關。

   ★ 和推導那一段有什麼不同（很重要，不然就是同一件事做兩遍）
     推導：身高**看得見**，學生每一回合挑最矮的搬過去 —— 那是整個選擇排序。
     這裡：身高**全部藏起來**，只找出「最矮的那一個」。
     順序是刻意的 —— 先用眼睛做一遍，再把眼睛拿掉。
     情境那句話講的就是這件事：
       「你一眼掃過去就知道誰最矮 —— 但電腦沒有眼睛。
         它一次只能拿兩個出來比大小，而且比完就忘了，除非你叫它記住。」

   ★★ 這一段真正要教的是**變數**
     蒙眼之後，學生會親身撞到一件事：
       比完 A 和 B，知道 A 比較矮 —— 然後呢？
       再去比 C 和 D 的話，剛才那個結果就沒地方放了。
     所以畫面上有一格「🧠 記住的最矮」。那一格就是變數，
     而「要不要換成他」就是：
         如果 這一個 < 記住的　那麼　記住的 ← 這一個
     第 6 關要拼的就是這幾塊積木 —— 他在這裡先用手做過一次。

   ⚠️ 為什麼不讓學生「隨便比、最後猜一個」
     每個人都要被比過至少一次才能宣告完成。
     跳過任何一個都可能漏掉最矮的 —— 那正是這個演算法不能偷懶的地方。

   ⚠️ 挑戰只有**一關**（預測最少要比幾次）。
     第 5 關是前導關，不該比正課還難；三個難度留給第 6～10 關。
     ⇒ 證書用 LABTEST.certificate(1, { single: true })，
        文案不會再叫學生去挑戰一個不存在的下一關。

   用法：
     MINLAB.mount(host, { n: 5, big: true, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-minlab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /* 五個人的名字。用代號不用真名 —— 班上有同名同姓的話很尷尬。 */
  var NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛'];

  /**
   * 出一題。
   * ⚠️ 身高不可以有重複值：「一樣高」的時候「比較矮的是誰」沒有答案，
   *    而這一關的每一步都要有明確答案。
   * ⚠️ 最矮的不可以固定在第 1 個 —— 那樣「先把第 1 個記住」就直接過關了，
   *    學生永遠不會遇到「要換」的那一步，也就學不到那塊積木。
   */
  function makeCase(opts, rnd) {
    opts = opts || {};
    rnd = rnd || Math.random;
    var n = opts.n || 5;
    var vals = [];
    while (vals.length < n) {
      var v = 138 + Math.floor(rnd() * 30);              // 138～167 公分
      if (vals.indexOf(v) < 0) vals.push(v);
    }
    /* ★ 保證最矮的不在第 1 個：如果剛好是，就和最後一個對調。 */
    if (minOf(vals) === 0) {
      var t = vals[0]; vals[0] = vals[n - 1]; vals[n - 1] = t;
    }
    return vals.map(function (v, i) {
      return { id: i, name: NAMES[i] || String(i + 1), v: v };
    });
  }

  /** 最矮的是第幾個（索引）。 */
  function minOf(items) {
    var best = 0;
    for (var i = 1; i < items.length; i++) {
      if (val(items[i]) < val(items[best])) best = i;
    }
    return best;
  }
  function val(x) { return typeof x === 'number' ? x : x.v; }

  /**
   * 比一下：a 比 b 矮嗎？
   * ★ 只回「誰比較矮」，**不回身高** —— 這是蒙眼的重點。
   *   回了數字的話學生比一次就把數字抄下來，蒙眼就沒有意義了。
   */
  function shorter(items, a, b) {
    return val(items[a]) < val(items[b]) ? a : b;
  }

  /**
   * 學生決定「要不要換」對不對。
   * keep = 目前記住的那一個，pick = 剛才拿來比的那一個。
   * swap = 學生按了「換成他」。
   */
  function judge(items, keep, pick, swap) {
    var should = val(items[pick]) < val(items[keep]);
    if (swap === should) return { ok: true, msg: '' };
    if (should) {
      return { ok: false,
               msg: '<b>' + items[pick].name + '</b> 比記住的那個矮 —— 應該<b>換成他</b>。' +
                    '<br>記住的要一直是「目前看過最矮的」，不然後面比再多次也沒用。' };
    }
    return { ok: false,
             msg: '<b>' + items[pick].name + '</b> 沒有比較矮 —— 應該<b>不換</b>。' +
                  '<br>換過去的話，你就把已經找到的那個矮子弄丟了。' };
  }

  /**
   * 最少要比幾次。
   * ★ n 個人比 n-1 次：第一個直接記住（沒有比），其餘每個都要跟記住的比一次。
   *   ⚠️ 學生最常猜的是 n（每個人都比）或 n(n-1)/2（兩兩都比）——
   *      前者忘了第一個不必比，後者是「全部互相比」，那不是這個演算法。
   */
  function need(n) { return n - 1; }

  /** 每個人都被比過了嗎（含一開始直接記住的那一個）。 */
  function allSeen(seen, n) {
    for (var i = 0; i < n; i++) if (!seen[i]) return false;
    return true;
  }

  /**
   * 逐步示範：電腦會怎麼跑。
   * ★ 通關之後才給看。還沒自己做過就先看答案，
   *   他看到的只是一串沒有來由的動作。
   */
  function demoSteps(items) {
    var out = [{ keep: 0, at: -1, cmp: null,
                 note: '第一個人<b>直接記住</b> —— 還沒有人可以跟他比，' +
                       '所以他暫時就是「目前最矮的」。' }];
    var keep = 0;
    for (var i = 1; i < items.length; i++) {
      var win = val(items[i]) < val(items[keep]);
      out.push({ keep: win ? i : keep, at: i, cmp: keep, swap: win,
                 note: '拿 <b>' + items[i].name + '</b> 跟記住的 <b>' + items[keep].name + '</b> 比：' +
                       (win
                         ? '比較矮 → <b>換成他</b>。'
                         : '沒有比較矮 → <b>不換</b>，記住的不動。') });
      if (win) keep = i;
    }
    out.push({ keep: keep, at: -1, cmp: null, done: true,
               note: '每個人都比過了 —— 記住的 <b>' + items[keep].name +
                     '</b> 就是最矮的。<br>總共比了 <b>' + need(items.length) + '</b> 次。' });
    return out;
  }

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.ml{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.ml-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.ml-tip b{color:#4338ca}',
    '.ml-sub{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:6px}',
    '.ml-keep{display:flex;align-items:center;gap:10px;background:#fffbeb;border:2px solid #fcd34d;',
    '  border-radius:12px;padding:10px 14px;margin-bottom:12px}',
    '.ml-keep .lab{font-size:12px;font-weight:900;color:#92400e}',
    '.ml-keep .box{min-width:52px;text-align:center;background:#fff;border:2px dashed #fbbf24;',
    '  border-radius:10px;padding:7px 12px;font-size:18px;font-weight:900;color:#b45309}',
    '.ml-keep .box.on{border-style:solid;background:#fef3c7}',
    '.ml-keep .hint{font-size:12px;color:#92400e;line-height:1.7}',
    '.ml-row{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px}',
    /* ⚠️ 樣式的宣告順序會決定誰蓋過誰（同權重後面贏）。
       順序：done（比過了）→ keep（記住的）→ sel（正在比）→ bad（點錯）
       ★ 反過來的話，學生點了正在比的那一個，顏色被「比過了」的灰色蓋掉，
         畫面看起來完全沒反應 —— 而系統不會報任何錯。 */
    '.ml-p{position:relative;min-width:64px;padding:12px 10px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:12px;font-family:inherit;cursor:pointer;transition:.12s;text-align:center}',
    '.ml-p:hover{border-color:#6366f1;background:#eef2ff}',
    '.ml-p .nm{font-size:15px;font-weight:900;color:#334155}',
    '.ml-p .ht{font-size:12px;color:#94a3b8;margin-top:2px;letter-spacing:1px}',
    '.ml-p.done{border-color:#cbd5e1;background:#f8fafc;color:#94a3b8}',
    '.ml-p.done .nm{color:#94a3b8}',
    '.ml-p.keep{border-color:#f59e0b;background:#fffbeb}',
    '.ml-p.keep .nm{color:#b45309}',
    '.ml-p.sel{border-color:#6366f1;background:#e0e7ff;transform:translateY(-3px)}',
    '.ml-p.sel .nm{color:#3730a3}',
    '.ml-p.bad{border-color:#ef4444;background:#fee2e2}',
    '.ml-p.bad .nm{color:#991b1b}',
    '.ml-p .tag{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:10px;',
    '  font-weight:900;padding:1px 7px;border-radius:9999px;white-space:nowrap}',
    '.ml-p.keep .tag{background:#f59e0b;color:#fff}',
    '.ml-ask{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;',
    '  margin-bottom:10px;font-size:13.5px;line-height:1.9}',
    '.ml-ask .yn{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
    '.ml-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.ml-btn:hover{background:#4f46e5}',
    '.ml-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.ml-btn.ghost:hover{background:#f1f5f9}',
    '.ml-msg{font-size:13.5px;line-height:1.85;padding:9px 12px;border-radius:9px;margin-bottom:9px}',
    '.ml-msg.good{background:#dcfce7;color:#166534}',
    '.ml-msg.bad{background:#fee2e2;color:#991b1b}',
    '.ml-msg.info{background:#f1f5f9;color:#475569}',
    '.ml-cnt{font-size:12.5px;font-weight:900;color:#6366f1;margin-bottom:8px}',
    '.ml-demo{background:#0f172a;border-radius:12px;padding:13px 16px;margin-top:12px;',
    '  color:#e2e8f0;font-size:13.5px;line-height:2}',
    '.ml-demo .c{color:#c4b5fd;font-weight:700}',
    '.ml-demo .a{color:#86efac}',
    '.ml-demo .k{color:#fcd34d}',
    '.ml-note{background:#f5f3ff;border:1px solid #e9d5ff;border-radius:10px;padding:9px 12px;',
    '  font-size:13px;line-height:1.85;margin-top:9px}',
    '.ml-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）───────── */
    '.ml-big .ml-tip{font-size:14.5px;padding:14px 17px}',
    '.ml-big .ml-keep{padding:14px 18px}',
    '.ml-big .ml-keep .box{font-size:24px;padding:10px 18px;min-width:68px}',
    '.ml-big .ml-keep .lab{font-size:13.5px}',
    '.ml-big .ml-keep .hint{font-size:13px}',
    '.ml-big .ml-p{min-width:86px;padding:18px 14px}',
    '.ml-big .ml-p .nm{font-size:21px}',
    '.ml-big .ml-p .ht{font-size:13.5px}',
    '.ml-big .ml-ask{font-size:15px;padding:15px 18px}',
    '.ml-big .ml-msg{font-size:14.5px;padding:11px 14px}',
    '.ml-big .ml-demo{font-size:15px;padding:16px 20px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('minlab-css')) return;
    var s = global.document.createElement('style');
    s.id = 'minlab-css';
    s.textContent = CSS + ((global.LABTEST && global.LABTEST.css) || '');
    global.document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();

    var n = opts.n || 5;
    var items, keep, seen, cmps, errs, pick, msg, msgKind, passed, badFlash;
    var dSteps = null, dAt = -1;          // 逐步示範
    var lvNow = 0, cleared = {}, testMsg = '', testKind = 'info';

    function reset(list) {
      items = list;
      keep = null;                        // 還沒記住任何人
      seen = {};
      cmps = 0; errs = 0;
      pick = null; badFlash = null;
      msg = ''; msgKind = 'info';
      passed = false;
    }
    reset(makeCase({ n: n }, opts.rnd));

    /* ── 畫 ─────────────────────────────────────── */

    function render() {
      host.className = 'ml' + (opts.big ? ' ml-big' : '');
      host.innerHTML =
        tipHTML() +
        keepHTML() +
        '<div class="ml-cnt">已經比了 <b>' + cmps + '</b> 次　·　' +
          '還沒比過的有 <b>' + (n - countSeen()) + '</b> 個</div>' +
        '<div class="ml-row" id="ml-row"></div>' +
        askHTML() +
        (msg ? '<div class="ml-msg ' + msgKind + '">' + msg + '</div>' : '') +
        '<div id="ml-test"></div>' +
        demoHTML() +
        barHTML();
      row();
      test();
      wireBar();
    }

    function tipHTML() {
      if (passed) {
        return '<div class="ml-tip">✅ 找到了 —— 最矮的是 <b>' + items[keep].name + '</b>。' +
               '<div class="ml-sub">身高現在公開了。你剛才做的事，' +
               '就是第 6 關要用積木拼出來的<b>「找出最小值」</b>。</div></div>';
      }
      return '<div class="ml-tip">' +
        '這幾個人的身高<b>看不到</b> —— 電腦也看不到。' +
        '<div class="ml-sub">' +
        '① 先點一個人，把他<b>記住</b>（還沒比過，誰都可以）。<br>' +
        '② 再點另一個人 —— 系統會告訴你<b>誰比較矮</b>，但<b>不會</b>告訴你身高。<br>' +
        '③ 你要自己決定：<b>記住的那一個要不要換成他</b>。<br>' +
        '⚠️ 每個人都要比過，才算找完 —— 跳過任何一個，都可能漏掉最矮的。' +
        '</div></div>';
    }

    function keepHTML() {
      var on = keep !== null;
      return '<div class="ml-keep">' +
        '<span class="lab">🧠 記住的最矮</span>' +
        '<span class="box' + (on ? ' on' : '') + '">' + (on ? items[keep].name : '—') + '</span>' +
        '<span class="hint">' +
        (on
          ? '這一格就是<b>變數</b>。電腦比完就忘，只有放進這裡的才留得住。'
          : '還是空的。<b>先點一個人</b>放進來 —— 沒有這一格，比出來的結果沒地方放。') +
        '</span></div>';
    }

    function row() {
      var box = host.querySelector('#ml-row');
      if (!box) return;
      box.innerHTML = items.map(function (p, i) {
        var cls = 'ml-p';
        if (seen[i] && i !== keep) cls += ' done';
        if (i === keep) cls += ' keep';
        if (i === pick) cls += ' sel';
        if (i === badFlash) cls += ' bad';
        /* ★ 身高只有通關之後才顯示 —— 蒙眼是這一關的全部重點。 */
        var ht = passed ? esc(items[i].v) + ' 公分' : '? ? ?';
        return '<button class="' + cls + '" data-i="' + i + '">' +
               (i === keep ? '<span class="tag">記住的</span>' : '') +
               '<div class="nm">' + esc(p.name) + '</div>' +
               '<div class="ht">' + ht + '</div></button>';
      }).join('');
      [].forEach.call(box.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { tap(Number(el.dataset.i)); };
      });
    }

    /* 「要不要換」的那兩顆按鈕 —— 只有正在比的時候才出現。 */
    function askHTML() {
      if (pick === null || keep === null || passed) return '';
      var win = shorter(items, keep, pick);
      return '<div class="ml-ask">' +
        '比一下：<b>' + esc(items[pick].name) + '</b> 和記住的 <b>' + esc(items[keep].name) + '</b> —— ' +
        '<b>' + esc(items[win].name) + '</b> 比較矮。' +
        '<br>記住的那一格，要換成 <b>' + esc(items[pick].name) + '</b> 嗎？' +
        '<div class="yn">' +
        '<button class="ml-btn" data-sw="1">換成他</button>' +
        '<button class="ml-btn ghost" data-sw="0">不換</button>' +
        '</div></div>';
    }

    function tap(i) {
      if (passed) return;
      /* 第一步：把某個人放進「記住」。 */
      if (keep === null) {
        keep = i; seen[i] = true; pick = null;
        say('good', '記住 <b>' + esc(items[i].name) + '</b> 了。' +
                    '<br>接下來點別人，一個一個跟他比。');
        return;
      }
      if (i === keep) {
        say('info', '這一個就是記住的那個 —— 自己跟自己比沒有意義，點別人。');
        return;
      }
      if (seen[i]) {
        say('info', '<b>' + esc(items[i].name) + '</b> 已經比過了。點還沒比過的那幾個。');
        return;
      }
      if (pick !== null) {
        say('info', '先回答上面那一題（換／不換），再比下一個。');
        return;
      }
      pick = i;
      cmps++;
      msg = ''; msgKind = 'info';
      render();
    }

    function answer(swap) {
      if (pick === null || keep === null) return;
      var r = judge(items, keep, pick, swap);
      if (!r.ok) {
        errs++;
        badFlash = pick;
        say('bad', r.msg);
        global.setTimeout(function () { badFlash = null; render(); }, 550);
        return;
      }
      seen[pick] = true;
      var moved = swap;
      if (swap) keep = pick;
      pick = null;
      if (allSeen(seen, n)) { finish(); return; }
      say('good', moved
        ? '換好了 —— 現在記住的是 <b>' + esc(items[keep].name) + '</b>。'
        : '對，不換。記住的還是 <b>' + esc(items[keep].name) + '</b>。');
    }

    function finish() {
      passed = true;
      /* ⚠️ 這裡不必檢查 keep 是不是真的最矮 ——
         每一步的「換／不換」都判過了，錯的不會生效，
         所以走到這裡 keep 一定是最小值。
         （真要不放心，minlab.test.js 有一條在跑一百次隨機走查。） */
      say('good', '每個人都比過了，總共比了 <b>' + cmps + '</b> 次。' +
                  (errs ? '（中間想錯 ' + errs + ' 次，沒關係 —— 想錯的地方才是學到的地方。）' : '') +
                  '<br>最矮的是 <b>' + esc(items[keep].name) + '</b>。');
      openTest();
    }

    function say(kind, m) { msgKind = kind; msg = m; render(); }
    function countSeen() { var c = 0; for (var i = 0; i < n; i++) if (seen[i]) c++; return c; }

    /* ── 驗收挑戰（只有一關）─────────────────────
       ★ 為什麼是「最少要比幾次」
         他剛剛才走完一遍，次數就在畫面上。
         但「最少」要他想清楚：第一個人是**直接記住**的，沒有比 ——
         所以是 n-1，不是 n。答錯的人幾乎都是漏掉這件事。
       ⚠️ 第 5 關是前導關，只給一關；三個難度留給第 6～10 關。 */
    function openTest() {
      if (!global.LABTEST) { finishAll(); return; }
      lvNow = 1;
      render();
    }
    function finishAll() { if (opts.onPass) opts.onPass(stars()); }
    function stars() { return cleared[1] ? 1 : 0; }

    function test() {
      var box = host.querySelector('#ml-test');
      if (!box) return;
      if (!lvNow || !global.LABTEST) { box.innerHTML = ''; return; }
      if (lvNow > 1) {
        box.innerHTML = global.LABTEST.certificate(1,
          { title: '找出最小值　驗收挑戰', single: true });
        return;
      }
      var L = global.LABTEST.LEVELS[0];
      box.innerHTML =
        '<div class="lt-box"><div class="h">' + L.icon + ' 驗收挑戰　' + L.name + '</div>' +
        '<div class="q"><b>' + n + '</b> 個人，用這個方法找出最矮的，' +
        '<b>最少</b>要比幾次？' +
        '<br><span style="font-size:12.5px">⚠️ 不是「你剛才比了幾次」—— 想想看：' +
        '第一個人有比過嗎？</span></div>' +
        '<div class="row"><input id="ml-g" type="number" min="1" placeholder="次數">' +
        '<button data-g="1">送出答案</button></div></div>' +
        '<div class="lt-say ' + testKind + '">' + (testMsg || '　') + '</div>';
      [].forEach.call(box.querySelectorAll('[data-g]'), function (el) {
        el.onclick = function () { submit(); };
      });
    }

    function submit() {
      var inp = host.querySelector('#ml-g');
      var v = Number(inp && inp.value);
      if (!(v > 0)) { tsay('info', '先填一個數字。'); return; }
      var want = need(n);
      if (v === want) {
        cleared[1] = true; lvNow = 2;
        tsay('good', '對了 —— <b>' + want + '</b> 次 ⭐<br>' +
                     '第一個人是<b>直接記住</b>的，沒有比；剩下的 ' + want +
                     ' 個每個跟他比一次。');
        finishAll();
        return;
      }
      if (v === n) {
        tsay('bad', '差一點 —— 不是 ' + n + ' 次。' +
                    '<br>⚠️ 第一個人是<b>直接放進「記住」</b>的，他沒有跟任何人比過。');
        return;
      }
      if (v === n * (n - 1) / 2) {
        tsay('bad', '那是「每兩個人都互相比一次」的次數。' +
                    '<br>這個方法不必那樣 —— 每個人只要跟<b>記住的那一個</b>比就好。');
        return;
      }
      tsay('bad', '不是 ' + v + ' 次。再想一次：有幾個人<b>需要</b>跟記住的那個比？');
    }
    function tsay(kind, m) { testKind = kind; testMsg = m; render(); }

    /* ── 逐步示範（通關才開）───────────────────── */
    function demoHTML() {
      if (!passed) return '';
      if (!dSteps) dSteps = demoSteps(items);
      var s = dAt >= 0 ? dSteps[dAt] : null;
      return '<div class="ml-demo">' +
        '<div class="c">記住的 ← 第 1 個</div>' +
        '<div class="c">重複（剩下的每一個）</div>' +
        '<div style="padding-left:16px"><span class="c">如果</span> ' +
          '<span class="k">這一個</span> &lt; <span class="k">記住的</span> <span class="c">那麼</span></div>' +
        '<div style="padding-left:32px" class="a">記住的 ← 這一個</div>' +
        '</div>' +
        (s ? '<div class="ml-note"><b>第 ' + (dAt + 1) + ' 步／' + dSteps.length + '</b>　' +
             s.note + (s.at >= 0 ? '　（記住的：<b>' + esc(items[s.keep].name) + '</b>）' : '') +
             '</div>' : '');
    }

    function barHTML() {
      if (!passed) return '';
      var last = dSteps && dAt >= dSteps.length - 1;
      return '<div class="ml-bar">' +
        '<button class="ml-btn" data-d="next">' +
          (dAt < 0 ? '▶ 一步一步看電腦怎麼做' : (last ? '↺ 從頭再看一次' : '下一步')) + '</button>' +
        '<button class="ml-btn ghost" data-d="new">🎲 換一組人</button>' +
        '</div>';
    }

    function wireBar() {
      [].forEach.call(host.querySelectorAll('[data-d]'), function (el) {
        el.onclick = function () {
          if (el.dataset.d === 'new') { nextCase(); return; }
          if (!dSteps) dSteps = demoSteps(items);
          dAt = (dAt >= dSteps.length - 1) ? 0 : dAt + 1;
          render();
        };
      });
      [].forEach.call(host.querySelectorAll('[data-sw]'), function (el) {
        el.onclick = function () { answer(el.dataset.sw === '1'); };
      });
    }

    /**
     * 換一組人。
     * ⚠️ 挑戰開著的時候不要把它關掉 —— 學生想再玩一次不該賠掉已經拿到的徽章。
     *    （searchlab 就踩過反過來的坑：換一題把狀態清掉，結果永遠過不了關。）
     */
    function nextCase() {
      var keepLv = lvNow, keepCleared = cleared, keepMsg = testMsg, keepKind = testKind;
      reset(makeCase({ n: n }, opts.rnd));
      dSteps = null; dAt = -1;
      lvNow = keepLv; cleared = keepCleared; testMsg = keepMsg; testKind = keepKind;
      render();
    }

    render();

    return {
      destroy: function () { host.innerHTML = ''; },
      /* 測試用的窗口（畫面之外看不到的狀態）。 */
      _s: function () {
        return { items: items, keep: keep, seen: seen, cmps: cmps, errs: errs,
                 pick: pick, passed: passed, stars: stars(), lvNow: lvNow };
      }
    };
  }

  /** 這一步的目標與過關標準（說明見 searchlab.js 的同名函式）。 */
  function goal(lab) {
    var n = (lab && lab.n) || 5;
    return {
      why: '你一眼就看得出誰最矮 —— 但電腦沒有眼睛。' +
           '這一步把身高<b>全部蓋起來</b>，你只能一次比兩個。' +
           '你會親身撞到一件事：比完之後，結果要放哪裡？' +
           '那一格「記住的最矮」就是<b>變數</b>，也就是下一關要拼的那塊積木。',
      pass: '① <b>' + n + ' 個人全部都比過</b>（跳過任何一個都可能漏掉最矮的）<br>' +
            '② 驗收挑戰 <b>一關</b>：最少要比幾次' +
            '<br>（這一關是前導關，挑戰只有一題，不是三關。）'
    };
  }

  global.MINLAB = {
    goal: goal,
    VERSION: VERSION,
    mount: mount,
    /* 純函式對外開放，測試直接打這幾支。 */
    makeCase: makeCase,
    minOf: minOf,
    shorter: shorter,
    judge: judge,
    need: need,
    allSeen: allSeen,
    demoSteps: demoSteps,
    NAMES: NAMES
  };
})(typeof window !== 'undefined' ? window : this);
