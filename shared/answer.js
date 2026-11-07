/* =====================================================================
   判「學生寫的一段話，有沒有講到這幾個概念」
   ---------------------------------------------------------------------
   開放式作答的判定引擎（5016B 各節的「用你自己的話說」、Scratch 的概念檢測）。不呼叫任何網路。

   第一原則：寧可放過，不可錯殺
     學生感受到「我明明懂，它說我不懂」兩次，就會開始猜系統想看什麼字、堆關鍵字。
     所以：
       · 講到一個概念就有分（部分給分），不是全對才算
       · 錯誤觀念（avoid）只降級、不歸零
       · 分數加總四捨五入，2.5 進位成 3 —— 邊界往學生那邊倒

   這裡判的是「有沒有講到」，不是「講得對不對」。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-10-23';

  /* 空話。學生寫「我覺得就是這樣啊」時，拿掉這些字就什麼都不剩了。
     ⚠️ 這份清單只用來算「有沒有內容」，不用來扣分。 */
  var FILLER = /[的了嗎吧啊呀喔耶欸就是我覺得應該可能大概反正然後而且所以因為這個那個東西什麼怎麼很真的好像不知道不會]/g;

  /** 去掉標點與空白之後有幾個字 */
  function len(t) {
    return String(t == null ? '' : t).replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—]/g, '').length;
  }
  /** 拿掉空話之後還剩幾個字 —— 這才是「有沒有講東西」 */
  function meat(t) {
    return String(t == null ? '' : t)
      .replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—]/g, '')
      .replace(FILLER, '').length;
  }

  /* ── 抄來的不算 ─────────────────────────────────
     題目與提示裡本來就含有這一題想聽到的說法，複製貼上的話關鍵字當然全中。
     但學生用到題目裡的詞是正常的，所以看的是**連續 8 個字一模一樣**，
     不是「有沒有用到那些字」（正常自己寫幾乎不會連續 8 字相同）。 */
  var COPY_RUN = 8;

  /** a 和 b 最長有幾個字連續相同 */
  function longestRun(a, b) {
    a = String(a || '').replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—<>]/g, '');
    b = String(b || '').replace(/<[^>]*>/g, '')
                       .replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—<>]/g, '');
    if (!a || !b) return 0;
    var best = 0, prev = [], cur;
    for (var i = 0; i < a.length; i++) {
      cur = [];
      for (var j = 0; j < b.length; j++) {
        cur[j] = a[i] === b[j] ? (i && j ? (prev[j - 1] || 0) : 0) + 1 : 0;
        if (cur[j] > best) best = cur[j];
      }
      prev = cur;
    }
    return best;
  }

  /** 這段話是不是從提示／題目抄來的 */
  function copied(text, sources) {
    return (sources || []).some(function (src) {
      return longestRun(text, src) >= COPY_RUN;
    });
  }

  /** 關鍵概念比對：每個概念底下是一組同義說法，學生寫到任何一個就算講到 */
  function hit(text, groups) {
    var t = String(text == null ? '' : text), got = [], miss = [];
    (groups || []).forEach(function (g) {
      var words = [].concat(g.any || g);
      var ok = words.some(function (w) { return w && t.indexOf(w) >= 0; });
      (ok ? got : miss).push(g.name || words[0]);
    });
    return { hit: got, miss: miss, done: (groups || []).length > 0 && miss.length === 0 };
  }

  /* ── 判一題 ───────────────────────────────────────
     spec: {
       need:  [{ name:'會重複做', any:['重複','一直','很多次'] }, …]  要講到的概念
       avoid: [{ name:'以為是因為程式太長', any:['太長','很長'], why:'…' }]  常見誤解
       min:   8      至少要寫幾個字（去掉標點）
       full:  2      講到幾個概念算「完全懂」（預設＝need 的數量）
     }
     回傳 { level:'full'|'part'|'none', got:[], miss:[], warn:[], score, why } */
  function judge(text, spec) {
    spec = spec || {};
    var t = String(text == null ? '' : text).trim();
    var need = spec.need || [];
    var full = spec.full || need.length || 1;
    var min = spec.min || 8;

    if (!t) {
      return out('none', [], need.map(nameOf), [], '還沒寫。用自己的話寫幾句，寫不完整也沒關係。');
    }

    /* 抄提示的不算 —— 要判在關鍵字比對之前（抄來的當然全中） */
    if (copied(t, spec.src)) {
      return out('none', [], need.map(nameOf), [],
                 '這一段和提示幾乎一樣。用你自己的話再說一次 —— ' +
                 '講得沒那麼漂亮沒關係，重點是那是你想的。');
    }

    /* 先比對概念，再看長度：「要拼很多次好累喔」只有 8 個字，但講到了重點。
       只要講到任何一個概念，就不再管字數。 */
    var k = hit(t, need);

    if (!k.hit.length) {
      /* 太短不是答錯，是還沒開始答，要說清楚 */
      if (len(t) < min) {
        return out('none', [], need.map(nameOf), [],
                   '再多寫一點（至少 ' + min + ' 個字）。想到什麼寫什麼，不必寫得漂亮。');
      }
      if (meat(t) < 4) {
        return out('none', [], need.map(nameOf), [],
                   '這幾句話裡看不出你的想法。試著講「為什麼」或「會怎麼樣」。');
      }
    }
    var warn = [];
    (spec.avoid || []).forEach(function (g) {
      var words = [].concat(g.any || g);
      if (words.some(function (w) { return w && t.indexOf(w) >= 0; })) {
        warn.push({ name: g.name || words[0], why: g.why || '' });
      }
    });

    var level = k.hit.length >= full ? 'full' : k.hit.length >= 1 ? 'part' : 'none';
    /* 錯誤觀念只降一級、不歸零：兩件事都寫了（一個對、一個是誤解）就打零分，
       等於告訴學生「寫多了會被扣分」。 */
    if (warn.length && level === 'full') level = 'part';

    return out(level, k.hit, k.miss, warn, whyOf(level, k, warn));
  }

  function nameOf(g) { return g.name || [].concat(g.any || g)[0]; }

  /* ── 回饋要怎麼寫 ─────────────────────────────────
     「還差什麼」不可以把名稱講出來 —— need 的 name 就是答案，講了學生貼上去就過了。
     只講「還有幾個重點沒講到」；「你講到了什麼」可以講（那是他自己說的）。 */
  function whyOf(level, k, warn) {
    var left = k.miss.length;
    if (level === 'full') {
      return warn.length
        ? '重點都講到了。不過「' + warn[0].name + '」那個想法要再想一下 ——' +
          (warn[0].why || '它不是關鍵。')
        : '你講到了：' + k.hit.join('、') + '。這一題想通了。';
    }
    if (level === 'part') {
      return '你講到了：' + k.hit.join('、') + '。' +
             '還有 ' + left + ' 個重點沒講到 —— 卡住的話按「提示」。' +
             (warn.length && warn[0].why ? '（另外，' + warn[0].why + '）' : '');
    }
    /* 完全沒講到、但踩到常見誤解：誤解可以指名（那是他寫的），但不要順便說出正解 */
    if (warn.length) {
      return '你的想法是「' + warn[0].name + '」。' + (warn[0].why || '') +
             '換一個方向想想看，卡住的話按「提示」。';
    }
    return '這幾句還沒碰到重點。回去看情境那一段，或按「提示」。';
  }

  function out(level, got, miss, warn, why) {
    return { level: level, got: got, miss: miss, warn: warn, why: why, score: SCORE[level] };
  }

  /* 每一題的分數：講到一半有半分，不讓「認真寫一半」和「沒寫」同一個下場 */
  var SCORE = { full: 1, part: 0.5, none: 0 };

  /** 一整份的總分，四捨五入（2.5 → 3） */
  function total(results) {
    var s = (results || []).reduce(function (a, r) { return a + (r && r.score || 0); }, 0);
    return Math.round(s);
  }

  global.ANSWER = {
    VERSION: VERSION,
    judge: judge,
    total: total,
    SCORE: SCORE,
    _len: len,
    _meat: meat,
    hitKeys: hit,      // 關鍵概念比對（問題分析的「你講到了」、概念檢測都用這一支）
    _hit: hit,
    _copied: copied,
    _longestRun: longestRun,
    _COPY_RUN: COPY_RUN
  };

})(typeof window !== 'undefined' ? window : this);
