/* =====================================================================
   期末檢核（第 10 關的最後一步，也是整門課的最後一步）
   ---------------------------------------------------------------------
   ★ 老師 2026-08-18 指定的規格
     · 十題：循序搜尋 ×1、二元搜尋 ×1、選擇排序 ×1、插入排序 ×1、
             搜尋比較 ×2、排序比較 ×2、海量資料成本 ×2
     · 每個題型五個變化版，隨機抽 —— 不容易整份重複
     · 四選一，選項不能一眼看出規律
     · 門檻 **100%**（十題全對）
     · **40 分以下會重置第 10 關的進度**，而且要有警語
     · 過了發證書（和第 5 關一樣）

   ⚠️⚠️ 這一支的規則比課程裡任何一步都嚴，所以有幾件事一定要做對：
     ① 警語要在**開始之前**看到，不是考完才告訴他
        —— 「事後才說的規則」在學生眼裡就是系統在整他。
     ② 重置**不可以安靜地發生**：要他自己按下去，而且畫面上先列清楚
        「會清掉什麼、會留下什麼」。
     ③ 重置的寫入失敗要講出來。這個專案其他存檔都是「失敗不擋進度」，
        但這一筆相反 —— 失敗的話畫面說重置了、伺服器上沒重置，
        學生下次回來會看到一個他不認得的狀態。

   ★ 為什麼 100% 是可以接受的
     它不是「一次定生死」：重考會換一組題目，而且錯在哪裡會講。
     這是**熟練度**門檻（像考駕照），不是常態分配的成績。
     ⚠️ 但也因為這樣，題目本身一定要公平 ——
        沒教過的不能考、算得出來的不能靠背、選項不能陷阱。

   ⚠️ 這一步**不給星星**。系統只有兩組，各有唯一的寫入者：
        🧩 作品星 unitStars（Apps Script 比對範例）　🧠 概念星（概念檢測現算）
      再開第三組會讓 hub 的分母錯掉，也會讓「這顆星是誰給的」說不清楚。
      ⇒ 這裡發的是**證書**（和第 5 關同一個做法），成績存起來給老師看。

   用法：
     FINALTEST.mount(host, {
       bank,                 // window.FINAL_BANK
       onPass: (score) => …, // 十題全對
       onReset: () => …,     // 40 分以下、而且學生按了確認
       onScore: (score, detail) => …   // 每次交卷都會叫（存成績用）
     })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-18-finaltest';

  /* 門檻：十題全對才算過。 */
  var PASS = 10;
  /* 這個分數（含）以下會重置第 10 關。40 分 = 十題只對 4 題。
     ★ 四選一亂猜的期望值是 2.5 題 —— 4 題以下大致就是「沒有比亂猜好多少」。 */
  var RESET_AT = 4;

  /* ── 純函式（可以單獨測）───────────────────────────── */

  /**
   * 洗牌（Fisher–Yates）。
   * ⚠️ 一定要用 rnd 參數，不要直接抓 Math.random ——
   *    測試沒辦法驗一個每次都不一樣的東西。
   */
  function shuffle(arr, rnd) {
    var a = arr.slice(), r = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 抽一份考卷。
   * ★ 每個題型抽 pick 題（不重複），題型的順序照題庫寫的走 ——
   *   ⚠️ 連題型順序都打亂的話，學生會覺得「這份考卷和上次完全沒關係」，
   *      而它其實是同一個範圍。固定順序反而看得出「原來是這七塊」。
   * ⚠️ 每一題的選項都要重新洗牌：
   *    資料檔裡的順序是固定的，不洗的話同一題永遠是同一個位置。
   */
  function draw(bank, rnd) {
    var r = rnd || Math.random;
    var out = [];
    (bank.types || []).forEach(function (t) {
      var pool = shuffle(t.questions || [], r).slice(0, t.pick || 1);
      pool.forEach(function (q) {
        out.push({
          type: t.key, typeName: t.name, icon: t.icon,
          q: q.q, a: q.a,
          options: shuffle(q.options || [], r)
        });
      });
    });
    return out;
  }

  /** 一份考卷該有幾題（由題庫自己算，不要在別的地方再寫一次 10） */
  function sizeOf(bank) {
    return (bank.types || []).reduce(function (s, t) { return s + (t.pick || 1); }, 0);
  }

  /**
   * 判分。picked[i] 是學生選的**選項文字**（不是索引）。
   * ⚠️ 用文字判，不用索引 —— 選項會洗牌，索引在洗牌之後沒有意義。
   */
  function grade(paper, picked) {
    var K = global.ANSKEY;
    var right = 0, detail = [];
    paper.forEach(function (it, i) {
      var got = picked[i];
      var ok = !!(got && K && K.check(it.q, got, it.a));
      if (ok) right++;
      detail.push({ type: it.type, ok: ok, picked: got == null ? '' : got });
    });
    return { score: right, total: paper.length, detail: detail };
  }

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.ft{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    /* ⚠️⚠️ 警語：這一塊的工作就是**被看到**。
       做得太素的話學生會直接滑過去，然後在考完之後才發現規則。 */
    '.ft-warn{background:#fef2f2;border:3px solid #fca5a5;border-radius:16px;',
    '  padding:16px 18px;margin-bottom:14px}',
    '.ft-warn .h{font-size:17px;font-weight:900;color:#991b1b;margin-bottom:8px}',
    '.ft-warn ul{list-style:none;margin:9px 0 0;padding:0}',
    '.ft-warn li{font-size:13.5px;line-height:2;color:#7f1d1d;padding-left:2px}',
    '.ft-warn li b{color:#991b1b}',
    '.ft-go{background:#eef2ff;border:2px dashed #c7d2fe;border-radius:14px;',
    '  padding:15px 14px;margin:13px 0;text-align:center}',
    '.ft-go button{background:#4f46e5;color:#fff;border:0;border-radius:11px;',
    '  padding:14px 28px;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;',
    '  box-shadow:0 3px 0 #3730a3}',
    '.ft-go button:hover{background:#4338ca}',
    '.ft-go button:active{transform:translateY(2px);box-shadow:0 1px 0 #3730a3}',
    '.ft-go .cap{font-size:12.5px;font-weight:700;color:#4338ca;line-height:1.8;margin-top:9px}',
    /* 題目 */
    '.ft-bar{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;font-weight:800;color:#475569;margin-bottom:9px}',
    '.ft-list{list-style:none;margin:0;padding:0;counter-reset:ftq}',
    '.ft-item{background:#fff;border:2px solid #e2e8f0;border-radius:14px;',
    '  padding:13px 15px;margin-bottom:11px}',
    '.ft-item.miss{border-color:#fca5a5;background:#fef2f2}',
    '.ft-item.hit{border-color:#86efac;background:#f0fdf4}',
    '.ft-tag{display:inline-block;font-size:11px;font-weight:900;color:#4338ca;',
    '  background:#eef2ff;border-radius:9999px;padding:3px 9px;margin-bottom:6px}',
    '.ft-q{font-size:14.5px;line-height:1.9;font-weight:700;margin-bottom:9px}',
    '.ft-opt{display:block;width:100%;text-align:left;background:#fff;',
    '  border:2px solid #cbd5e1;border-radius:10px;padding:10px 13px;margin-bottom:7px;',
    '  font-size:13.5px;line-height:1.8;font-family:inherit;color:#334155;cursor:pointer}',
    '.ft-opt:hover{border-color:#6366f1;background:#eef2ff}',
    '.ft-opt.on{border-color:#4f46e5;background:#e0e7ff;color:#3730a3;font-weight:800}',
    '.ft-opt.right{border-color:#22c55e;background:#dcfce7;color:#166534;font-weight:800}',
    '.ft-opt.wrong{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    '.ft-opt:disabled{cursor:default}',
    /* 交卷 */
    '.ft-send{background:#4f46e5;color:#fff;border:0;border-radius:12px;padding:14px 26px;',
    '  font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;width:100%}',
    '.ft-send:disabled{background:#cbd5e1;cursor:not-allowed}',
    '.ft-res{border-radius:16px;padding:16px 18px;margin-bottom:12px}',
    '.ft-res.ok{background:#ecfdf5;border:3px solid #6ee7b7;color:#065f46}',
    '.ft-res.no{background:#fffbeb;border:3px solid #fcd34d;color:#92400e}',
    '.ft-res.bad{background:#fef2f2;border:3px solid #fca5a5;color:#991b1b}',
    '.ft-res .h{font-size:19px;font-weight:900;margin-bottom:6px}',
    '.ft-res .s{font-size:14px;line-height:1.95}',
    '.ft-sum{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}',
    '.ft-sum span{font-size:11.5px;font-weight:800;border-radius:9999px;padding:4px 10px;',
    '  background:#f1f5f9;color:#475569}',
    '.ft-sum span.miss{background:#fee2e2;color:#991b1b}',
    /* 重置那一顆 —— 刻意做得像「危險動作」 */
    '.ft-reset{background:#fff;border:3px solid #ef4444;border-radius:14px;',
    '  padding:14px 16px;margin-top:12px}',
    '.ft-reset .h{font-size:15px;font-weight:900;color:#991b1b;margin-bottom:6px}',
    '.ft-reset ul{margin:8px 0;padding-left:20px;font-size:13px;line-height:1.95;color:#7f1d1d}',
    '.ft-reset button{background:#dc2626;color:#fff;border:0;border-radius:10px;',
    '  padding:12px 20px;font-size:14.5px;font-weight:900;cursor:pointer;font-family:inherit}',
    '.ft-reset button:hover{background:#b91c1c}',
    '.ft-btn{background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:12px 20px;',
    '  font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.ft-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.ft-big .ft-q{font-size:16px}',
    '.ft-big .ft-opt{font-size:14.5px;padding:12px 15px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('finaltest-css')) return;
    var s = global.document.createElement('style');
    s.id = 'finaltest-css';
    s.textContent = CSS;
    global.document.head.appendChild(s);
  }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();
    var bank = opts.bank || global.FINAL_BANK;
    var rnd = opts.rnd || Math.random;
    var N = sizeOf(bank);

    var phase = 'warn';        // warn → test → result
    var paper = [];
    var picked = [];
    var res = null;
    var tries = 0;             // 考了幾次
    var resetDone = false;

    host.className = 'ft' + (opts.big ? ' ft-big' : '');
    render();

    /* ⚠️ 和選擇題模組同一條規則：擋複製。
       右鍵選單的「複製」一樣會觸發 copy，所以攔出口就夠 ——
       但拖曳走的是 dragstart，copy 完全不會被觸發，要另外攔。
       ⚠️ 刻意**不**攔右鍵、也不用 user-select:none ——
          那會把螢幕朗讀器和翻譯一起關掉。 */
    ['copy', 'cut', 'dragstart'].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.preventDefault(); });
    });

    function render() {
      host.innerHTML =
        (phase === 'warn' ? warnHTML()
        : phase === 'test' ? testHTML()
        : resultHTML());
      wire();
    }

    /* ── ① 警語（一定要在開始之前）──────────────────── */
    function warnHTML() {
      return '<div class="ft-warn"><div class="h">⚠️ 開始之前，先看清楚規則</div>' +
        '<div style="font-size:13.5px;line-height:1.95;color:#7f1d1d">' +
        '這是整門課的<b>最後一關</b>，考的是第 6 章的四個演算法。</div>' +
        '<ul>' +
        '<li>📝 共 <b>' + N + ' 題</b>，四選一。</li>' +
        '<li>✅ <b>十題全對</b>才算通過 —— 錯一題就要重考。</li>' +
        '<li>🔄 重考會<b>換一組題目</b>，而且會告訴你錯在哪裡。</li>' +
        '<li>⚠️⚠️ <b>只對 ' + RESET_AT + ' 題（含）以下</b>的話，' +
        '<b>第 10 關的進度會被清掉</b>，要從情境解說重走一遍。</li>' +
        '</ul>' +
        '<div style="font-size:12.5px;line-height:1.9;color:#991b1b;margin-top:9px">' +
        '★ 標準訂得高，是因為這十題你在前面都做過了 —— ' +
        '實驗室量過、概念檢測寫過、實作體驗算過。<br>' +
        '不確定的話<b>先回去看</b>，上面的步驟隨時點得回去。</div>' +
        '</div>' +
        '<div class="ft-go"><button data-a="start">🏁 我看懂規則了，開始檢核</button>' +
        '<div class="cap">按下去才會抽題。抽完就開始 —— 中途離開的話這一次不算。</div></div>';
    }

    /* ── ② 作答 ────────────────────────────────────── */
    function testHTML() {
      var answered = picked.filter(function (x) { return x != null; }).length;
      return '<div class="ft-bar"><span>🏁 期末檢核' +
        (tries > 1 ? '（第 ' + tries + ' 次）' : '') + '</span>' +
        '<span>已作答 ' + answered + ' / ' + N + '</span></div>' +
        '<ol class="ft-list">' + paper.map(function (it, i) {
          return '<li class="ft-item">' +
            '<span class="ft-tag">' + it.icon + ' ' + it.typeName + '</span>' +
            '<div class="ft-q">' + (i + 1) + '. ' + it.q + '</div>' +
            it.options.map(function (o) {
              return '<button class="ft-opt' + (picked[i] === o ? ' on' : '') +
                     '" data-q="' + i + '" data-o="' + escAttr(o) + '">' + o + '</button>';
            }).join('') + '</li>';
        }).join('') + '</ol>' +
        '<button class="ft-send" data-a="send"' + (answered < N ? ' disabled' : '') + '>' +
        (answered < N ? '還有 ' + (N - answered) + ' 題沒作答' : '交卷') + '</button>';
    }

    /* ── ③ 結果 ────────────────────────────────────── */
    function resultHTML() {
      var s = res.score;
      var passed = s >= PASS;
      var bad = s <= RESET_AT;
      var cls = passed ? 'ok' : (bad ? 'bad' : 'no');
      var out = '<div class="ft-res ' + cls + '">' +
        '<div class="h">' + (passed ? '🎉 通過！' : (bad ? '⚠️ 這次差得比較多' : '再一次就好')) +
        '　' + s + ' / ' + N + ' 題</div>' +
        '<div class="s">' +
        (passed
          ? '十題全對 —— 第 6 章的四個演算法，你是真的懂了。'
          : (bad
              ? '只對了 ' + s + ' 題。<br>照規則，<b>第 10 關的進度要重來一遍</b>（下面那一塊）。'
              : '錯 ' + (N - s) + ' 題。下面標紅的就是錯的那幾題，' +
                '看完可以直接重考 —— 會換一組題目。')) +
        '</div>' + sumHTML() + '</div>';

      /* 逐題檢討：錯的才攤開來看正確答案。
         ⚠️ 對的那幾題**不要**把答案再印一次 —— 這一頁會被截圖傳出去。 */
      out += '<ol class="ft-list">' + paper.map(function (it, i) {
        var d = res.detail[i];
        if (d.ok) {
          return '<li class="ft-item hit">' +
            '<span class="ft-tag">' + it.icon + ' ' + it.typeName + '</span>' +
            '<div class="ft-q">' + (i + 1) + '. ' + it.q + '　✅</div></li>';
        }
        return '<li class="ft-item miss">' +
          '<span class="ft-tag">' + it.icon + ' ' + it.typeName + '</span>' +
          '<div class="ft-q">' + (i + 1) + '. ' + it.q + '</div>' +
          it.options.map(function (o) {
            var right = global.ANSKEY && global.ANSKEY.check(it.q, o, it.a);
            var c = right ? ' right' : (o === d.picked ? ' wrong' : '');
            return '<button class="ft-opt' + c + '" disabled>' + o +
                   (right ? '　← 正確答案' : (o === d.picked ? '　← 你選的' : '')) + '</button>';
          }).join('') + '</li>';
      }).join('') + '</ol>';

      if (passed) {
        out += (global.LABTEST
          ? global.LABTEST.certificate(3, {
              single: false,
              title: '第 6 章　演算法期末檢核'
            })
          : '') +
          '<button class="ft-btn" data-a="finish">完成，回闖關地圖 →</button>';
      } else if (bad && !resetDone) {
        /* ⚠️⚠️ 重置不可以安靜地發生。
           先把「會清掉什麼、會留下什麼」列出來，再讓他自己按。 */
        out += '<div class="ft-reset"><div class="h">🔄 第 10 關要重走一遍</div>' +
          '<div style="font-size:13px;line-height:1.9;color:#7f1d1d">' +
          '按下去之後會清掉的：</div>' +
          '<ul><li>第 10 關的<b>步驟進度</b>（情境、動手試一次、實作體驗）</li></ul>' +
          '<div style="font-size:13px;line-height:1.9;color:#7f1d1d">' +
          '<b>不會</b>清掉的：概念檢測的成績、前面九關的一切、你的作品星。</div>' +
          '<button data-a="reset">我知道了，重走第 10 關</button></div>';
      } else {
        out += '<button class="ft-btn" data-a="again">🔄 重考（換一組題目）</button>';
      }
      return out;
    }

    /** 哪幾個題型錯了 —— 讓他知道要回去補哪一塊，而不是「就是錯了」 */
    function sumHTML() {
      var byType = {};
      res.detail.forEach(function (d, i) {
        var k = paper[i].typeName;
        if (!byType[k]) byType[k] = { ok: 0, no: 0, icon: paper[i].icon };
        if (d.ok) byType[k].ok++; else byType[k].no++;
      });
      return '<div class="ft-sum">' + Object.keys(byType).map(function (k) {
        var v = byType[k];
        return '<span class="' + (v.no ? 'miss' : '') + '">' + v.icon + ' ' + k +
               ' ' + v.ok + '/' + (v.ok + v.no) + '</span>';
      }).join('') + '</div>';
    }

    function escAttr(t) {
      return String(t).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function wire() {
      [].forEach.call(host.querySelectorAll('.ft-opt[data-q]'), function (el) {
        el.onclick = function () {
          picked[Number(el.dataset.q)] = el.textContent;
          render();
        };
      });
      [].forEach.call(host.querySelectorAll('[data-a]'), function (el) {
        el.onclick = function () { act(el.dataset.a); };
      });
    }

    function act(a) {
      if (a === 'start' || a === 'again') {
        tries++;
        paper = draw(bank, rnd);
        picked = new Array(paper.length);
        res = null; phase = 'test';
        render();
        return;
      }
      if (a === 'send') {
        res = grade(paper, picked);
        phase = 'result';
        if (opts.onScore) opts.onScore(res.score, res);
        render();
        if (res.score >= PASS && opts.onDone) opts.onDone(res.score);
        return;
      }
      if (a === 'reset') {
        resetDone = true;
        if (opts.onReset) opts.onReset();
        render();
        return;
      }
      if (a === 'finish') { if (opts.onPass) opts.onPass(res.score); return; }
    }

    return {
      destroy: function () { host.innerHTML = ''; },
      _s: function () {
        return { phase: phase, tries: tries, paper: paper, picked: picked,
                 score: res ? res.score : null, resetDone: resetDone };
      },
      _pick: function (i, text) { picked[i] = text; },
      _act: act
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅） */
  function goal() {
    return {
      why: '第 6 章四個演算法（循序／二元搜尋、選擇／插入排序）你都做過了。' +
           '這一步把它們<b>一起</b>考一次 —— 也是整門課的最後一關。' +
           '<br>⚠️ 十題全對才算通過，重考會換一組題目。',
      pass: '<b>' + PASS + ' 題全對</b>。' +
            '<br>⚠️ 只對 <b>' + RESET_AT + ' 題以下</b>的話，' +
            '第 10 關的步驟進度會被清掉，要重走一遍。'
    };
  }

  global.FINALTEST = {
    VERSION: VERSION,
    mount: mount,
    goal: goal,
    PASS: PASS,
    RESET_AT: RESET_AT,
    _draw: draw,
    _grade: grade,
    _shuffle: shuffle,
    _sizeOf: sizeOf
  };
})(typeof window !== 'undefined' ? window : this);
