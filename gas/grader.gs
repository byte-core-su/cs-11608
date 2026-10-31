/* =====================================================================
   Scratch 作品自動評分（Google Apps Script）
   ---------------------------------------------------------------------
   不用 AI：拿學生的 .sb3 和老師的「參考解答」「空白範本」逐塊比對。

   ★ 範本 ＝ 解答 − 空白
     空白範本裡老師預先放好的積木（鷹架）不算學生的功勞，
     解答比空白「多出來的那些積木」才是這一關學生該寫的。

   ★ 三層比對，各占一部分分數
     ① 積木（50 分）：該用的積木有沒有用到、用了幾塊
     ② 位置（30 分）：積木放在哪個事件底下、包在哪個迴圈／如果裡面
     ③ 設定值（20 分）：清單名稱、數字、文字、按鍵……和範例一樣嗎
     分數 ＝ 三層的比例加權。星數：
       3⭐：90 分以上，而且「沒有缺任何一種積木、沒有放錯位置、設定值至少八成一樣」
       2⭐：75 分以上
       0⭐：未滿 75 分（未通關）
     ⇒ 3⭐ 的意思是「和範例一致」。只看分數的話，少一整種積木（例如完全沒有用到「插入」）
        還有 94 分 —— 那不該是 3⭐，所以另外把關。
     ⇒ 積木和位置都對、只是設定值都不一樣 → 80 分 2⭐。

   ★ 範本存在哪
     Firestore 的 {TERM}-grader/criteria 這份文件的 units_json 欄位，
     每一關有 example_code（解答）和 template_code（空白），格式是虛擬碼。
     ⚠️ 這份文件只有老師讀得到（安全規則）；這支腳本是用老師的身分讀的。
        解答絕對不可以放在網站的靜態檔裡 —— 學生打得開。

   ★ 為什麼學生偽造不了分數
     ① 送作品時要附上 Firebase 的登入憑證，這裡向 Firebase 確認「真的是學號 X 本人」。
     ② 星數由這支腳本**用老師的身分**寫進 Firestore，
        而安全規則不准學生自己改作品星（scratchStarsUnchanged）。

   ★ 抄襲比對的線索（第四部分）：每次評分記下作品的「指紋」和「積木編號」，
     老師在後台「🐱 作品評分」下課後比對；老師取消過的作品，同一個檔案（或改一點點）再交會被擋下。
   ★ 運算思維的通關截圖（第五部分）：學生過關時背景上傳，存到 DRIVE_FOLDER_ID 底下。

   ★ 同一個部署也跑「資訊倫理 闖關排行賽」（第三部分）：出題、判對錯、量時間、記排行都在這裡。

   ---------------------------------------------------------------------
   部署（約 10 分鐘，步驟見 gas/README.md）
     1. script.google.com 新增專案，貼上這支與 appsscript.json
     2. 專案設定 → 指令碼屬性：PROJECT_ID、API_KEY、TEACHER_EMAIL、TERM（選填 DRIVE_FOLDER_ID）
     3. 部署 → 新增部署作業 → 網頁應用程式：執行身分「我」、存取權「所有人」
     4. 把 /exec 結尾的網址貼到 course/config.js 的 GRADER_URL
   ===================================================================== */

var VERSION = 'grader-2026-10-26';   // 10-26：作品比對＋運算思維截圖

/* =====================================================================
   第一部分：比對核心（純 JavaScript，不用到任何 Google 服務，可以在 node 裡測）
   ===================================================================== */

/* ── sb3 → 虛擬碼 ─────────────────────────────────────────────────────
   ⚠️ 解答、空白範本、學生作品都經過同一個轉換，三者才比得起來。
      改這裡之前先跑 gas/test.js，確認第 1 關的解答還是 100 分、空白還是 0 分。 */
var MAX_INPUT_CHARS = 400;

function pyStr_(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return String(v);
}
function nl_(s) { return String(s).replace(/\n/g, ' ').replace(/\r/g, ' '); }
function cut_(s, n) { return Array.from(String(s)).slice(0, n).join(''); }

function procSignature_(proccode, values) {
  var out = [], i = 0;
  String(proccode || '').split(/(%[snb])/).forEach(function (part) {
    if (/^%[snb]$/.test(part)) {
      var v = i < values.length ? pyStr_(values[i]) : '?';
      out.push('(' + v.replace(/^'+|'+$/g, '') + ')');
      i++;
    } else if (part) {
      out.push(part);
    }
  });
  return out.join('').trim() || '(未命名)';
}

function inputReadable_(input, blocks) {
  if (!input || !Array.isArray(input) || input.length < 2) return '';
  var payload = input[1];
  if (typeof payload === 'string' && Object.prototype.hasOwnProperty.call(blocks, payload)) {
    var t = blocks[payload];
    var op = t.opcode || 'unknown';
    if (op === 'procedures_prototype') {
      var mut = t.mutation || {}, names = [];
      try { names = JSON.parse(mut.argumentnames || '[]'); } catch (e) { names = []; }
      return '「' + procSignature_(mut.proccode || '', names) + '」';
    }
    if (op.indexOf('argument_reporter_') === 0) {
      var fv = (t.fields || {}).VALUE || [''];
      return '(參數:' + pyStr_(fv[0]) + ')';
    }
    var inner = [];
    Object.keys(t.fields || {}).forEach(function (k) {
      var f = t.fields[k];
      if (Array.isArray(f) && f.length > 0) inner.push(nl_(pyStr_(f[0])));
    });
    Object.keys(t.inputs || {}).forEach(function (k) {
      var v = inputReadable_(t.inputs[k], blocks);
      if (v) inner.push(v);
    });
    return '[' + op + ': ' + inner.join(' ') + ']';
  } else if (Array.isArray(payload)) {
    if (payload.length > 0) {
      var vt = payload[0];
      if (vt === 11 && payload.length > 1) return '(訊息:' + pyStr_(payload[1]).replace(/\n/g, ' ') + ')';
      if (vt === 12 && payload.length > 1) return '(變數:' + pyStr_(payload[1]).replace(/\n/g, ' ') + ')';
      if (vt === 13 && payload.length > 1) return '(清單:' + pyStr_(payload[1]).replace(/\n/g, ' ') + ')';
      if (payload.length > 1) return "'" + cut_(pyStr_(payload[1]).replace(/\n/g, ' '), 50) + "'";
      return "'" + cut_(pyStr_(payload[0]), 50) + "'";
    }
  }
  return cut_(nl_(pyStr_(payload)), 50);
}

function chain_(blockId, level, blocks, visited) {
  var text = '', cur = blockId, indent = new Array(level + 1).join('  ');
  while (cur && Object.prototype.hasOwnProperty.call(blocks, cur)) {
    if (visited[cur]) { text += indent + '--> (警告：偵測到無限迴圈，中斷解析)\n'; break; }
    visited[cur] = true;
    var b = blocks[cur], op = b.opcode;
    if (!op) { cur = b.next; continue; }

    if (op === 'procedures_definition') {
      var pin = (b.inputs || {}).custom_block;
      var proto = (pin && typeof pin[1] === 'string') ? blocks[pin[1]] : null;
      var m1 = (proto || {}).mutation || {}, n1 = [];
      try { n1 = JSON.parse(m1.argumentnames || '[]'); } catch (e) { n1 = []; }
      text += indent + 'procedures_definition 【定義自訂積木】「' + procSignature_(m1.proccode || '', n1) + '」\n';
      cur = b.next; continue;
    }
    if (op === 'procedures_call') {
      var m2 = b.mutation || {}, ids = [];
      try { ids = JSON.parse(m2.argumentids || '[]'); } catch (e) { ids = []; }
      var vals = ids.map(function (a) { return inputReadable_((b.inputs || {})[a], blocks); });
      text += indent + 'procedures_call 【呼叫自訂積木】「' + procSignature_(m2.proccode || '', vals) + '」\n';
      cur = b.next; continue;
    }

    var pairs = [], subs = {};
    if (b.fields) {
      Object.keys(b.fields).forEach(function (k) {
        var v = b.fields[k];
        if (Array.isArray(v) && v.length > 0) pairs.push(k + ":'" + cut_(pyStr_(v[0]).replace(/\n/g, ' '), 50) + "'");
      });
    }
    if (b.inputs) {
      Object.keys(b.inputs).forEach(function (k) {
        var v = b.inputs[k];
        if (k === 'SUBSTACK' || k === 'SUBSTACK2') {
          if (v.length > 1 && typeof v[1] === 'string') subs[k] = v[1];
        } else {
          var r = inputReadable_(v, blocks);
          if (r) {
            if (Array.from(r).length > MAX_INPUT_CHARS) r = cut_(r, MAX_INPUT_CHARS) + '…（過長已截斷）';
            pairs.push(k + ':' + r);
          }
        }
      });
    }
    text += indent + op + ' (' + pairs.join(', ') + ')\n';
    if (subs.SUBSTACK) text += chain_(subs.SUBSTACK, level + 1, blocks, visited);
    if (op === 'control_if_else') {
      text += indent + '--> (ELSE):\n';
      if (subs.SUBSTACK2) text += chain_(subs.SUBSTACK2, level + 1, blocks, visited);
    }
    if (op.indexOf('control_') === 0) text += indent + '--> (END ' + op + ')\n';
    cur = b.next;
  }
  return text;
}

/* 帽子積木（會被觸發的程式起點）*/
function isHat_(op) {
  if (/^(event_|procedures_definition|control_start_as_clone)/.test(op)) return true;
  if (/^(motion_|looks_|sound_|sensing_|operator_|data_|control_|argument_)/.test(op)) return false;
  return op.indexOf('_when') >= 0;
}

/** project.json → 只含「執行序列」的虛擬碼（比對用不到的說明文字不印） */
function projectToPseudo(project) {
  var out = '';
  (project.targets || []).forEach(function (t) {
    out += '\n[角色/背景：' + String(t.name || '未命名').replace(/\n/g, ' ') + ']\n';
    var blocks = t.blocks || {};
    Object.keys(blocks).forEach(function (id) {
      var b = blocks[id];
      if (!b || typeof b !== 'object' || Array.isArray(b)) return;
      if (!b.topLevel || (b.parent !== null && b.parent !== undefined)) return;
      if (!isHat_(String(b.opcode || ''))) return;
      out += '  ▶ 執行序列：\n' + chain_(id, 2, blocks, {});
    });
  });
  return out;
}

/* ── 虛擬碼 → 一塊一塊的積木（解答、空白、學生作品都走這一支）────────── */

/* 把 "LIST:'班級置物置', ITEM:'apple'" 拆成 { LIST: "'班級置物置'", ITEM: "'apple'" }
   ⚠️ 值裡面可能有逗號、括號、引號（巢狀的 [data_itemoflist: …]），所以要數括號 */
function splitParams_(s) {
  var out = {}, depth = 0, quote = false, buf = '', parts = [];
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (c === "'" ) quote = !quote;
    if (!quote) {
      if (c === '[' || c === '(' || c === '「') depth++;
      if (c === ']' || c === ')' || c === '」') depth--;
      if (c === ',' && depth === 0 && s[i + 1] === ' ' && /^ [A-Z_0-9]+:/.test(s.slice(i + 1))) {
        parts.push(buf); buf = ''; i++; continue;
      }
    }
    buf += c;
  }
  if (buf) parts.push(buf);
  parts.forEach(function (p) {
    var m = p.match(/^([A-Za-z_0-9]+):([\s\S]*)$/);
    if (m) out[m[1]] = m[2]; else out['_'] = p;
  });
  return out;
}

/* 設定值的比對口徑：大小寫、空白、數字寫法（3 和 3.0）都不計較 */
function normVal_(v) {
  v = String(v).trim().replace(/^'([\s\S]*)'$/, '$1').trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^-?\d+(\.\d+)?$/.test(v)) v = String(Number(v));
  return v;
}

/**
 * 虛擬碼 → 積木清單。每一塊記三把鑰匙：
 *   k1 積木本身　k2 加上「在哪個事件、哪幾層迴圈／如果裡面」　k3 再加上設定值
 */
function parsePseudo(text) {
  var items = [], inScript = false, hat = null, hatParams = '', stack = [];
  String(text || '').split('\n').forEach(function (line) {
    var t = line.trim();
    if (t === '▶ 執行序列：') { inScript = true; hat = null; stack = []; return; }
    if (!t || /^\[角色\/背景：/.test(t) || (/^▶/.test(t))) { inScript = false; return; }
    if (!inScript || t.indexOf('-->') === 0) return;
    var m = line.match(/^( *)([A-Za-z0-9]+_[A-Za-z0-9_]+) ([\s\S]*)$/);
    if (!m) return;
    var depth = Math.max(0, (m[1].length - 4) / 2), op = m[2], rest = m[3];
    var params;
    if (/^procedures_(definition|call)$/.test(op)) {
      params = { SIG: rest.replace(/^【[^】]*】/, '') };
    } else {
      params = splitParams_(rest.replace(/^\(/, '').replace(/\)$/, ''));
    }
    var pkey = Object.keys(params).sort().map(function (k) { return k + '=' + normVal_(params[k]); }).join(';');
    if (!hat) { hat = op; hatParams = pkey; }
    stack.length = depth;
    var path = [hat].concat(stack.filter(Boolean)).join('>');
    items.push({
      op: op,
      k1: op,
      k2: path + '>' + op,
      k3: path + '{' + hatParams + '}>' + op + '{' + pkey + '}'
    });
    stack[depth] = op;          // 這一塊如果是 C 形積木，下一層的積木就包在它裡面
  });
  return items;
}

function bag_(items, key) {
  var b = {};
  items.forEach(function (it) { b[it[key]] = (b[it[key]] || 0) + 1; });
  return b;
}
function minus_(a, b) {
  var o = {};
  Object.keys(a).forEach(function (k) { var n = a[k] - (b[k] || 0); if (n > 0) o[k] = n; });
  return o;
}
function size_(a) { return Object.keys(a).reduce(function (s, k) { return s + a[k]; }, 0); }
function overlap_(a, b) {
  return Object.keys(a).reduce(function (s, k) { return s + Math.min(a[k], b[k] || 0); }, 0);
}

/* 給學生看的積木名稱（Scratch 官方繁中；沒列到的就印代號） */
var BLOCK_NAMES = {
  event_whenflagclicked: '當綠旗被點擊', event_whenkeypressed: '當按下按鍵', event_whenthisspriteclicked: '當角色被點擊',
  event_whenbroadcastreceived: '當收到訊息', event_broadcast: '廣播訊息', event_broadcastandwait: '廣播訊息並等待',
  event_whenbackdropswitchesto: '當背景換成',
  control_repeat: '重複（計次）', control_forever: '重複無限次', control_if: '如果…那麼', control_if_else: '如果…那麼…否則',
  control_repeat_until: '重複直到', control_wait: '等待（秒）', control_wait_until: '等待直到', control_stop: '停止',
  control_create_clone_of: '建立分身', control_start_as_clone: '當分身產生', control_delete_this_clone: '分身刪除',
  data_setvariableto: '變數設為', data_changevariableby: '變數改變', data_showvariable: '變數顯示', data_hidevariable: '變數隱藏',
  data_addtolist: '添加（到清單）', data_deleteoflist: '刪除（清單的第幾項）', data_deletealloflist: '刪除（清單的全部項目）',
  data_insertatlist: '插入（到清單的第幾項）', data_replaceitemoflist: '替換（清單的第幾項）',
  data_itemoflist: '清單的第幾項', data_itemnumoflist: '某項在清單裡是第幾項', data_lengthoflist: '清單的長度',
  data_listcontainsitem: '清單包含', data_showlist: '清單顯示', data_hidelist: '清單隱藏',
  motion_movesteps: '移動（點）', motion_turnright: '右轉', motion_turnleft: '左轉', motion_gotoxy: '定位到 x、y',
  motion_goto: '定位到', motion_glidesecstoxy: '滑行到 x、y', motion_pointindirection: '面朝', motion_changexby: 'x 改變',
  motion_setx: 'x 設為', motion_changeyby: 'y 改變', motion_sety: 'y 設為', motion_ifonedgebounce: '碰到邊緣就反彈',
  looks_sayforsecs: '說出（秒）', looks_say: '說出', looks_thinkforsecs: '想著（秒）', looks_think: '想著',
  looks_switchcostumeto: '造型換成', looks_nextcostume: '造型換成下一個', looks_switchbackdropto: '背景換成',
  looks_show: '顯示', looks_hide: '隱藏', looks_changesizeby: '尺寸改變', looks_setsizeto: '尺寸設為',
  looks_seteffectto: '圖像效果設為', looks_changeeffectby: '圖像效果改變', looks_gotofrontback: '移到最上層／最下層',
  sound_play: '播放音效', sound_playuntildone: '播放音效直到結束', sound_stopallsounds: '停播所有音效',
  music_playNoteForBeats: '演奏音階', music_restForBeats: '休息（拍）', music_setInstrument: '樂器設為', music_setTempo: '演奏速度設為',
  sensing_askandwait: '詢問並等待', sensing_answer: '詢問的答案', sensing_touchingobject: '碰到',
  sensing_keypressed: '按下按鍵？', sensing_resettimer: '計時器重置', sensing_timer: '計時器',
  operator_add: '＋', operator_subtract: '－', operator_multiply: '×', operator_divide: '÷', operator_random: '隨機取數',
  operator_gt: '＞', operator_lt: '＜', operator_equals: '＝', operator_and: '且', operator_or: '或', operator_not: '不成立',
  operator_join: '字串組合', operator_mod: '除以…的餘數', operator_round: '四捨五入',
  procedures_definition: '定義自訂積木', procedures_call: '自訂積木'
};
function blockName_(op) { return BLOCK_NAMES[op] || op; }

/**
 * 評分。example／template 是虛擬碼（Firestore 存的那兩份），student 也是虛擬碼。
 * @returns {score, stars, levels:{block,place,value}, missing:[{op,name,count}], misplaced, mismatched, message}
 */
function gradeSubmission(exampleCode, templateCode, studentCode) {
  var ex = parsePseudo(exampleCode), tp = parsePseudo(templateCode), st = parsePseudo(studentCode);
  var res = { levels: {} }, matched = {}, required = {};
  ['k1', 'k2', 'k3'].forEach(function (k) {
    var tb = bag_(tp, k);
    required[k] = minus_(bag_(ex, k), tb);
    var added = minus_(bag_(st, k), tb);
    matched[k] = overlap_(required[k], added);
  });
  var need = size_(required.k1);
  if (!need) return { error: 'no-reference', message: '這一關的參考解答和空白範本沒有差別（或還沒上傳），沒辦法評分。' };

  var c1 = matched.k1 / need, c2 = matched.k2 / need, c3 = matched.k3 / need;
  res.score = Math.round(50 * c1 + 30 * c2 + 20 * c3);
  res.levels = { block: Math.round(c1 * 100), place: Math.round(c2 * 100), value: Math.round(c3 * 100) };
  res.need = need;

  /* 還缺哪些積木（只講種類和數量，不講答案的設定值） */
  var stAdded = minus_(bag_(st, 'k1'), bag_(tp, 'k1'));
  res.missing = Object.keys(required.k1).map(function (op) {
    var n = required.k1[op] - Math.min(required.k1[op], stAdded[op] || 0);
    return n > 0 ? { op: op, name: blockName_(op), count: n } : null;
  }).filter(Boolean);
  res.misplaced = matched.k1 - matched.k2;     // 積木有了，但放的位置和範例不同
  res.mismatched = matched.k2 - matched.k3;    // 位置也對，但設定值和範例不同

  /* 3⭐ ＝ 和範例一致：分數夠，而且沒有整種積木沒用到、沒有放錯位置、設定值至少八成一樣 */
  var missingType = res.missing.some(function (m) { return m.count === required.k1[m.op]; });
  var exact = !missingType && res.misplaced === 0 && c3 >= 0.8;
  res.stars = (res.score >= 90 && exact) ? 3 : res.score >= 75 ? 2 : 0;

  var tips = [];
  if (res.missing.length) tips.push('還缺：' + res.missing.map(function (m) { return '「' + m.name + '」' + (m.count > 1 ? ' ×' + m.count : ''); }).join('、'));
  if (res.misplaced > 0) tips.push('有 ' + res.misplaced + ' 塊積木放的位置（在哪個事件底下、包在哪個迴圈或如果裡面）和範例不同');
  if (res.mismatched > 0) tips.push('有 ' + res.mismatched + ' 塊積木的設定值（清單、數字、文字、按鍵）和範例不同');
  res.message = tips.length ? tips.join('；') + '。' : '和範例完全一致！';
  if (res.stars === 2 && res.score >= 90) {
    res.message += '（分數夠了，但要和範例一致才是 3⭐：' +
      [missingType ? '每一種積木都要用到' : '', res.misplaced ? '位置要放對' : '', c3 < 0.8 ? '設定值要八成以上一樣' : '']
        .filter(Boolean).join('、') + '）';
  }
  return res;
}

/* =====================================================================
   第二部分：Apps Script 外殼（網頁應用程式）
   ===================================================================== */

function props_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var project = String(p.PROJECT_ID || '').trim();
  return {
    project: project,
    apiKey: String(p.API_KEY || '').trim(),
    term: String(p.TERM || '11501').trim(),
    teacher: String(p.TEACHER_EMAIL || '').trim().toLowerCase(),
    domain: String(p.STUDENT_EMAIL_DOMAIN || ('students.' + project.toLowerCase() + '.firebaseapp.com')).trim().toLowerCase(),
    sidPattern: String(p.SID_PATTERN || '^\\d{7}$'),
    folder: String(p.DRIVE_FOLDER_ID || '').trim()
  };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, version: VERSION, features: ['grade', 'test', 'setRef', 'units', 'arena'] });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var P = props_();
    if (!P.project || !P.apiKey || !P.teacher) return json_({ ok: false, message: '評分服務還沒設定好（指令碼屬性少了 PROJECT_ID／API_KEY／TEACHER_EMAIL），請告訴老師。' });
    /* 排行賽作答：靠場次代號找這一場，不必每一題都向 Firebase 確認身分（少一次連線，快將近一秒） */
    if (req.kind === 'arenaAnswer' || req.kind === 'arenaLeave') return json_(handleArena_(req, null, P));
    var who = whoIs_(req.idToken, P);
    if (!who) return json_({ ok: false, message: '登入已經過期，請重新整理頁面再送一次。', error: '登入已經過期，請回闖關基地重新登入。' });

    if (req.kind === 'grade') return json_(handleGrade_(req, who, P, false));
    if (req.kind === 'shot') return json_(handleShot_(req, who, P));
    if (/^arena(Today|Start|Board)$/.test(req.kind)) return json_(handleArena_(req, who, P));
    if (!who.teacher) return json_({ ok: false, message: '這個動作只有老師可以做。' });
    if (/^arena(Info|SetBank|Grant)$/.test(req.kind)) return json_(handleArenaTeacher_(req, P));
    if (req.kind === 'test') return json_(handleGrade_(req, who, P, true));
    if (req.kind === 'setRef') return json_(handleSetRef_(req, P));
    if (req.kind === 'units') return json_(handleUnits_(P));
    return json_({ ok: false, message: '不認得的動作：' + req.kind });
  } catch (err) {
    var msg = '評分服務出錯了：' + (err && err.message || err);
    return json_({ ok: false, message: msg, error: msg });
  }
}

/* 向 Firebase 確認登入憑證是誰的（憑證過期、偽造都會被擋） */
function whoIs_(idToken, P) {
  if (!idToken) return null;
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(P.apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) return null;
  var u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u || !u.email) return null;
  var email = String(u.email).toLowerCase();
  if (email === P.teacher) return { teacher: true, email: email };
  var at = email.lastIndexOf('@');
  var sid = email.slice(0, at);
  if (email.slice(at + 1) !== P.domain || !new RegExp(P.sidPattern).test(sid)) return null;
  return { teacher: false, email: email, sid: sid };
}

/* ── Firestore（用老師的身分；安全規則管不到這裡）── */
function fsBase_(P) { return 'https://firestore.googleapis.com/v1/projects/' + P.project + '/databases/(default)/documents'; }
function fsHeaders_() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }; }

function fromFs_(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { var o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = fromFs_(f[k]); }); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs_);
  return null;
}
function toFs_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs_) } };
  var f = {}; Object.keys(v).forEach(function (k) { f[k] = toFs_(v[k]); });
  return { mapValue: { fields: f } };
}
function fsGet_(P, path) {
  var r = UrlFetchApp.fetch(fsBase_(P) + '/' + path, { headers: fsHeaders_(), muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('讀不到 ' + path + '（' + r.getResponseCode() + '）：' + r.getContentText().slice(0, 200));
  var f = JSON.parse(r.getContentText()).fields || {}, o = {};
  Object.keys(f).forEach(function (k) { o[k] = fromFs_(f[k]); });
  return o;
}
/* 欄位路徑：代號裡有「-」的（2-1-1A）要用反引號包起來 */
function fp_(parts) {
  return parts.map(function (p) { return /^[A-Za-z_][A-Za-z_0-9]*$/.test(p) ? p : '`' + String(p).replace(/`/g, '\\`') + '`'; }).join('.');
}
/** 只改指定的幾個欄位（其他欄位原封不動），可順便往陣列加一筆 */
function fsPatch_(P, path, fieldsObj, maskPaths, appendTo, appendValue) {
  var write = {
    update: { name: 'projects/' + P.project + '/databases/(default)/documents/' + path, fields: toFs_(fieldsObj).mapValue.fields },
    updateMask: { fieldPaths: maskPaths }
  };
  if (appendTo) write.updateTransforms = [{ fieldPath: appendTo, appendMissingElements: { values: [toFs_(appendValue)] } }];
  var r = UrlFetchApp.fetch(fsBase_(P).replace(/\/documents$/, '/documents:commit'), {
    method: 'post', contentType: 'application/json', headers: fsHeaders_(),
    payload: JSON.stringify({ writes: [write] }), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('寫入失敗（' + r.getResponseCode() + '）：' + r.getContentText().slice(0, 300));
}

function readUnits_(P) {
  var cache = CacheService.getScriptCache(), key = 'units_' + P.term;
  var hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var doc = fsGet_(P, P.term + '-grader/criteria') || {};
  var units = {};
  try { units = JSON.parse(doc.units_json || '{}'); } catch (e) { units = {}; }
  try { cache.put(key, JSON.stringify(units), 600); } catch (e) { /* 太大就不快取 */ }
  return units;
}

function sb3ToPseudo_(b64) {
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/zip', 'work.zip');
  var files;
  try { files = Utilities.unzip(blob); } catch (e) { throw new Error('這不是 Scratch 的 .sb3 檔（打不開）。'); }
  var pj = files.filter(function (f) { return f.getName() === 'project.json'; })[0];
  if (!pj) throw new Error('檔案裡找不到 project.json —— 請用 Scratch「檔案 → 下載到你的電腦」存出來的 .sb3。');
  var project = JSON.parse(pj.getDataAsString('UTF-8'));
  return { pseudo: projectToPseudo(project), ids: blockIds(project),
           hash: Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pj.getBytes())) };
}

function handleGrade_(req, who, P, dry) {
  var unit = String(req.unit || '');
  if (!/^[\w-]{1,20}$/.test(unit)) return { ok: false, message: '不認得的關卡。' };
  if (!req.b64) return { ok: false, message: '沒有收到檔案。' };
  var ref = readUnits_(P)[unit] || {};
  if (!ref.example_code || !ref.template_code) {
    return { ok: false, message: '這一關老師還沒上傳' + (!ref.example_code ? '參考解答' : '空白範本') + '，暫時沒辦法評分。' };
  }
  var conv = sb3ToPseudo_(req.b64);
  var g = gradeSubmission(ref.example_code, ref.template_code, conv.pseudo);
  if (g.error) return { ok: false, message: g.message };
  g.ok = true;
  if (dry || who.teacher) { g.dry = true; return g; }

  /* ── 學生：只往上加，不會因為重交而變低 ── */
  var sid = who.sid;
  var roster = fsGet_(P, 'roster/' + sid);
  if (!roster) return { ok: false, message: '名冊裡找不到學號 ' + sid + '，請找老師。' };
  var prog = fsGet_(P, P.term + '-progress/' + sid) || {};
  var sc = ((prog.modules || {}).scratch) || {};
  var ids = idsMinus(conv.ids, ref.template_ids);
  var now = Date.now();

  /* 老師取消過的作品：同一個檔案、或拿那個檔案改一點點再交 ⇒ 擋下，不評分（記一筆給老師看） */
  if (revokedHit((sc.revoked || {})[unit], conv.hash, ids)) {
    var bf = { modules: { scratch: { blocked: {} } } };
    bf.modules.scratch.blocked[unit] = { at: now, hash: conv.hash };
    fsPatch_(P, P.term + '-progress/' + sid, bf, [fp_(['modules', 'scratch', 'blocked', unit])]);
    return { ok: false, blocked: true,
             message: '這一關的成績被老師取消了：交上來的作品和被取消的那一份出自同一個檔案。請自己重新做一份再交；有問題請找老師。' };
  }

  var stars = sc.unitStars || {}, scores = sc.unitScores || {};
  var prevStar = Number(stars[unit] || 0), prevScore = Number(scores[unit] || 0);
  stars[unit] = Math.max(prevStar, g.stars);
  scores[unit] = Math.max(prevScore, g.score);
  var total = 0, done = 0;
  Object.keys(stars).forEach(function (k) { var s = Number(stars[k]) || 0; if (s > 0) { total += s; done++; } });

  var link = '';
  if (P.folder) {
    try {
      var pad2 = function (x) { x = String(x || ''); return x.length < 2 ? ('0' + x).slice(-2) : x; };
      var name = [pad2(req.unitNo), (roster.cls || '') + pad2(roster.no), roster.name || '', sid].join('_') + '.sb3';
      var f = DriveApp.getFolderById(P.folder).createFile(Utilities.newBlob(Utilities.base64Decode(req.b64), 'application/x.scratch.sb3', name));
      link = f.getUrl();
    } catch (e) { /* 備份失敗不影響評分 */ }
  }

  var fields = { modules: { scratch: { unitStars: {}, unitScores: {}, stars: total, level: done, status: done >= Number(req.total || 10) ? 'pass' : 'in-progress', source: 'gas', updatedAt: now, lastHash: {} } }, studentId: sid, updatedAt: now };
  fields.modules.scratch.unitStars[unit] = stars[unit];
  fields.modules.scratch.unitScores[unit] = scores[unit];
  fields.modules.scratch.lastHash[unit] = conv.hash;
  var mask = [fp_(['modules', 'scratch', 'unitStars', unit]), fp_(['modules', 'scratch', 'unitScores', unit]),
              'modules.scratch.stars', 'modules.scratch.level', 'modules.scratch.status', 'modules.scratch.source',
              'modules.scratch.updatedAt', fp_(['modules', 'scratch', 'lastHash', unit]), 'studentId', 'updatedAt'];
  if (link) {
    fields.modules.scratch.unitFiles = {}; fields.modules.scratch.unitFiles[unit] = link;
    mask.push(fp_(['modules', 'scratch', 'unitFiles', unit]));
  }
  /* 指紋記「拿到目前星數的那一份」：之後交一份較差的自己的作品，也蓋不掉抄來的那一份 */
  if (g.stars >= prevStar || !(sc.unitPrint || {})[unit]) {
    fields.modules.scratch.unitPrint = {};
    fields.modules.scratch.unitPrint[unit] = { hash: conv.hash, ids: ids.join(' '), at: now, stars: g.stars, score: g.score, file: link };
    mask.push(fp_(['modules', 'scratch', 'unitPrint', unit]));
  }
  fsPatch_(P, P.term + '-progress/' + sid, fields, mask, 'history',
           { module: 'scratch', unit: unit, score: g.score, at: now, stars: Math.max(0, g.stars - prevStar) });

  g.prevStars = prevStar; g.bestStars = stars[unit]; g.bestScore = scores[unit]; g.total = total;
  return g;
}

/* 老師上傳解答／空白範本：轉成虛擬碼，存進 {TERM}-grader/criteria 的 units_json */
function handleSetRef_(req, P) {
  var unit = String(req.unit || ''), which = req.which === 'template' ? 'template_code' : 'example_code';
  if (!/^[\w-]{1,20}$/.test(unit)) return { ok: false, message: '不認得的關卡。' };
  var conv = sb3ToPseudo_(req.b64);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var doc = fsGet_(P, P.term + '-grader/criteria') || {};
    var units = {};
    try { units = JSON.parse(doc.units_json || '{}'); } catch (e) { units = {}; }
    units[unit] = units[unit] || {};
    units[unit][which] = conv.pseudo;
    /* 空白範本裡的積木大家都有（都從同一個起始檔開始）⇒ 記下來，比對抄襲時扣掉 */
    if (which === 'template_code') units[unit].template_ids = conv.ids.join(' ');
    fsPatch_(P, P.term + '-grader/criteria', { units_json: JSON.stringify(units), updated_at: new Date().toISOString() }, ['units_json', 'updated_at']);
    CacheService.getScriptCache().remove('units_' + P.term);
  } finally { lock.releaseLock(); }
  return { ok: true, message: '已儲存第 ' + unit + ' 關的' + (which === 'template_code' ? '空白範本' : '參考解答') + '。' };
}

function handleUnits_(P) {
  CacheService.getScriptCache().remove('units_' + P.term);
  var units = readUnits_(P), out = {};
  Object.keys(units).forEach(function (u) {
    var x = units[u] || {};
    var need = (x.example_code && x.template_code) ? gradeSubmission(x.example_code, x.template_code, '').need || 0 : 0;
    out[u] = { example: !!x.example_code, template: !!x.template_code, need: need };
  });
  return { ok: true, units: out };
}

/* =====================================================================
   第三部分：資訊倫理 闖關排行賽
   ---------------------------------------------------------------------
   · 20 題、★1 起跳、答對升一級、答錯降一級，全對剛好 1000 分
   · 每題限時 20 秒（寬限 8 秒）：時間在這裡量，頁面改掉倒數也沒用
   · 作答中離開畫面 ⇒ 這一題算答錯、降一級
   · 一天 2 次，按開始就算一次；全期取最高分，同分用時短的在前
   · 參賽資格：資訊倫理 10 個章節全部通關
   · 難度：依全班的答對率每天分一次（作答不到 10 人次的題目放 ★3）

   ★ 為什麼學生作弊不了分數
     題目由這裡出、選項由這裡洗、對錯由這裡判、時間由這裡量；
     瀏覽器只送「選了第幾個」。成績由這支腳本用老師的身分寫進 Firestore，
     安全規則不准學生讀寫排行賽的集合。
   ⚠️ 題目和答案雜湊和章節測驗（content/ethics.js）是同一份、本來就公開；
      排行賽沒有多洩漏任何東西，擋的是「改分數、拖時間、換題目」。

   ★ 資料放哪
     {TERM}-grader/arena_bank       題庫（老師在後台「🏆 排行賽」按「匯入題庫」，從 ethics.js 抽出來）
     {TERM}-arena-days/{日期}        今天的分級（一整天固定）
     {TERM}-arena-board/{學號}       最佳成績＋今天用了幾次
     {TERM}-arena-runs/{場次}        每一場的紀錄（老師後台看得到）
     進行中的那一場放在 Apps Script 的快取（一小時沒動就丟掉）。
   ===================================================================== */

var ARENA = {
  TOTAL: 20, POINTS: { 1: 15, 2: 25, 3: 35, 4: 45, 5: 55 }, TIERS: 5,
  MIN_N: 10, DAILY: 2, TOP: 30, RUN_TTL: 3600, LIMIT: 20,
  GRACE: 8,                   // 寬限：網路來回＋答完一題的對錯動畫。Apps Script 冷啟動要 2～4 秒
 
  SALT: 'ans::115'            // = shared/anskey.js 的 SALT（不是秘密，見上面）
};

/* ── 純邏輯（node 可測）──────────────────────────────────────────────── */

/** = shared/qstat.js／anskey.js 的 norm()：去標籤、去空白與標點 */
function arenaNorm_(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[\s，。、？！：；「」（）()·,.?!:;"']/g, '');
}
/** = FNV-1a 32 位元 → 36 進位 */
function arenaFnv_(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}
function arenaQid(q) { var s = arenaNorm_(q); return s ? 'q' + arenaFnv_(s) : ''; }
function arenaAnsOf(q, option) { return arenaFnv_(arenaNorm_(q) + '||' + arenaNorm_(option) + '||' + ARENA.SALT); }

/** 題庫 JSON → {qid: {q, options, right}}。反查不到唯一正確選項的題目丟掉。 */
function arenaPrepareBank(raw) {
  var out = {};
  ((raw || {}).items || []).forEach(function (it) {
    var q = it && it.q, opts = (it && it.options || []).slice(), a = String(it && it.a || '');
    if (!q || opts.length < 2 || !a) return;
    var right = opts.filter(function (o) { return arenaAnsOf(q, o) === a; });
    if (right.length !== 1) return;
    out[arenaQid(q)] = { q: q, options: opts, right: right[0] };
  });
  return out;
}

/** 全班的 modules.ethics.qstat 加總 → {qid: {n, ok}} */
function arenaStats(progressDocs, module) {
  var tot = {};
  (progressDocs || []).forEach(function (d) {
    var qs = ((((d || {}).modules || {})[module || 'ethics'] || {}).qstat) || {};
    Object.keys(qs).forEach(function (k) {
      var e = tot[k] || (tot[k] = { n: 0, ok: 0 }), v = qs[k] || {};
      e.n += Number(v.n) || 0; e.ok += Number(v.ok) || 0;
    });
  });
  return tot;
}

/** {qid: 1~5}。答對率由高到低切五等分；資料不足的放中間（★3）。 */
function arenaTiers(qids, stats) {
  var rated = [];
  qids.forEach(function (k) {
    var e = (stats || {})[k] || {}, n = Number(e.n) || 0;
    if (n >= ARENA.MIN_N) rated.push({ k: k, r: (Number(e.ok) || 0) / n });
  });
  rated.sort(function (a, b) { return (b.r - a.r) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0); });
  var out = {};
  qids.forEach(function (k) { out[k] = Math.floor((ARENA.TIERS + 1) / 2); });
  rated.forEach(function (x, i) { out[x.k] = 1 + Math.floor(i * ARENA.TIERS / rated.length); });
  return out;
}

/** = shared/audit.js isRobotPace：至少 5 題、連最慢的一題都在 1 秒內 */
function arenaIsRobot(secs) {
  secs = (secs || []).filter(function (s) { return s != null; });
  return secs.length >= 5 && Math.max.apply(null, secs) <= 1;
}

function arenaPick_(run, tier, rnd) {
  for (var d = 0; d < ARENA.TIERS; d++) {
    var ts = d ? [tier - d, tier + d] : [tier];
    for (var j = 0; j < ts.length; j++) {
      var pool = (run.by[String(ts[j])] || []).filter(function (k) { return run.used.indexOf(k) < 0; });
      if (pool.length) return { k: pool[Math.floor(rnd() * pool.length)], t: ts[j] };
    }
  }
  return null;
}
function arenaShuffle_(a, rnd) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}
function arenaServe_(run, bank, rnd, now) {
  var p = arenaPick_(run, run.tier, rnd);
  if (!p) return null;
  run.used.push(p.k);
  run.cur = { qid: p.k, tier: p.t, options: arenaShuffle_(bank[p.k].options.slice(), rnd), at: now };
  return arenaPublic(run, bank);
}
/** 給瀏覽器看的：題目與洗過的選項 —— 沒有答案、沒有雜湊 */
function arenaPublic(run, bank) {
  var c = run.cur || {};
  return { index: run.i + 1, total: ARENA.TOTAL, tier: c.tier, points: ARENA.POINTS[c.tier] || 0,
           score: run.score, limit: ARENA.LIMIT, q: c.qid ? bank[c.qid].q : '', options: c.options || [] };
}

function arenaNewRun(sid, bank, tiers, rnd, now) {
  var by = {};
  Object.keys(bank).sort().forEach(function (k) {
    var t = String(Number(tiers[k]) || 3);
    (by[t] || (by[t] = [])).push(k);
  });
  var run = { sid: String(sid), tier: 1, score: 0, correct: 0, i: 0, max_tier: 1, used: [], cur: null,
              steps: [], swaps: 0, by: by, started: now, touched: now, done: false };
  var first = arenaServe_(run, bank, rnd, now);
  return { run: run, first: first };
}

/** 交一題。why：null＝正常作答；'timeout'＝倒數到 0；'leave'＝離開畫面。
    超過時限才送來的答案 why 變成 'late'。後三種都算答錯、降一級。 */
function arenaAnswer(run, bank, choice, rnd, now, why) {
  var c = run.cur;
  if (run.done || !c) throw new Error('這一場已經結束了');
  var sec = Math.max(0, Math.round((now - c.at) * 10) / 10);
  if (why !== 'timeout' && why !== 'leave') {
    why = null;
    if (choice === null || choice === undefined || choice === '' || typeof choice === 'boolean') throw new Error('選項不正確');
    choice = Number(choice);
    if (!(choice >= 0 && choice < c.options.length && Math.floor(choice) === choice)) throw new Error('選項不正確');
    if (sec > ARENA.LIMIT + ARENA.GRACE) why = 'late';
  }
  var right = !why && c.options[choice] === bank[c.qid].right;
  var pts = right ? ARENA.POINTS[c.tier] : 0;
  if (why === 'leave') run.swaps++;
  var step = { qid: c.qid, tier: c.tier, right: right, points: pts, sec: Math.min(sec, ARENA.LIMIT) };
  if (why) step.why = why;
  run.steps.push(step);
  run.score += pts;
  run.correct += right ? 1 : 0;
  var from = run.tier;
  run.tier = right ? Math.min(ARENA.TIERS, from + 1) : Math.max(1, from - 1);
  run.max_tier = Math.max(run.max_tier, c.tier);
  run.i++;
  run.cur = null;
  run.touched = now;
  var out = { right: right, points: pts, tier_from: from, tier_to: run.tier, score: run.score, done: false, next: null, why: why };
  if (run.i >= ARENA.TOTAL) { run.done = true; out.done = true; }
  else {
    out.next = arenaServe_(run, bank, rnd, now);
    if (!out.next) { run.done = true; out.done = true; }
  }
  return out;
}

function arenaResult(run) {
  var secs = run.steps.map(function (s) { return s.sec; });
  return { sid: run.sid, score: run.score, correct: run.correct, total: run.steps.length, max_tier: run.max_tier,
           swaps: run.swaps, seconds: Math.round(secs.reduce(function (a, b) { return a + b; }, 0) * 10) / 10,
           robot: arenaIsRobot(secs), steps: run.steps };
}
/** 分數高的贏；同分用時短的贏 */
function arenaBetter(n, best) {
  if (!best) return true;
  if (n.score !== best.score) return n.score > (Number(best.score) || 0);
  return n.seconds < Number(best.seconds == null ? 1e9 : best.seconds);
}
/** 排序：分數高 → 用時短 → 先達成（= shared/arenarank.js 的 cmp） */
function arenaRanking(rows, sid, top) {
  var ranked = rows.filter(function (r) { return r.score != null; }).sort(function (a, b) {
    return (b.score - a.score) || (a.seconds - b.seconds) || String(a.at || '').localeCompare(String(b.at || ''));
  }).map(function (r, i) { return { sid: r.sid, score: r.score, seconds: r.seconds, at: r.at, rank: i + 1 }; });
  var me = ranked.filter(function (r) { return r.sid === String(sid); })[0] || null;
  return { top: ranked.slice(0, top || ARENA.TOP), me: me, players: ranked.length };
}
/** 已通關幾個章節：units[id].star > 0（和章節選單同一個判斷） */
function arenaPassed(units, need) {
  return (need || []).filter(function (k) { return (Number(((units || {})[k] || {}).star) || 0) > 0; }).length;
}

/* ── Apps Script 外殼 ───────────────────────────────────────────────── */

function arenaFail_(msg) { return { ok: false, error: msg, message: msg }; }
function arenaDay_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function arenaNow_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function arenaCache_() { return CacheService.getScriptCache(); }

/** 讀一份文件（含 updateTime，給「沒被別人改過才寫」用） */
function fsGetDoc_(P, path) {
  var r = UrlFetchApp.fetch(fsBase_(P) + '/' + path, { headers: fsHeaders_(), muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return { fields: {}, updateTime: null };
  if (r.getResponseCode() !== 200) throw new Error('讀不到 ' + path + '（' + r.getResponseCode() + '）');
  var j = JSON.parse(r.getContentText()), f = j.fields || {}, o = {};
  Object.keys(f).forEach(function (k) { o[k] = fromFs_(f[k]); });
  return { fields: o, updateTime: j.updateTime || null };
}
/** 整個集合（分頁讀完），mask 只拿需要的欄位 */
function fsListAll_(P, col, mask) {
  var out = [], token = '';
  for (var guard = 0; guard < 50; guard++) {
    var url = fsBase_(P) + '/' + col + '?pageSize=300' + (mask || []).map(function (m) { return '&mask.fieldPaths=' + encodeURIComponent(m); }).join('')
            + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    var r = UrlFetchApp.fetch(url, { headers: fsHeaders_(), muteHttpExceptions: true });
    if (r.getResponseCode() === 404) break;
    if (r.getResponseCode() !== 200) throw new Error('讀不到 ' + col + '（' + r.getResponseCode() + '）');
    var j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(function (d) {
      var f = d.fields || {}, o = {};
      Object.keys(f).forEach(function (k) { o[k] = fromFs_(f[k]); });
      out.push({ id: String(d.name).split('/').pop(), data: o });
    });
    token = j.nextPageToken || '';
    if (!token) break;
  }
  return out;
}
/** 帶前提條件的寫入：updateTime 還是那一個（或文件還不存在）才寫。成功 true、被搶先 false。 */
function fsPatchIf_(P, path, fieldsObj, maskPaths, updateTime) {
  var write = {
    update: { name: 'projects/' + P.project + '/databases/(default)/documents/' + path, fields: toFs_(fieldsObj).mapValue.fields },
    updateMask: { fieldPaths: maskPaths },
    currentDocument: updateTime ? { updateTime: updateTime } : { exists: false }
  };
  var r = UrlFetchApp.fetch(fsBase_(P).replace(/\/documents$/, '/documents:commit'), {
    method: 'post', contentType: 'application/json', headers: fsHeaders_(),
    payload: JSON.stringify({ writes: [write] }), muteHttpExceptions: true
  });
  var code = r.getResponseCode();
  if (code === 200) return true;
  if (code === 400 || code === 409 || code === 412) {
    if (/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS|NOT_FOUND/.test(r.getContentText())) return false;
  }
  throw new Error('寫入失敗（' + code + '）：' + r.getContentText().slice(0, 300));
}

/** 題庫：Firestore 的 {TERM}-grader/arena_bank（快取 10 分鐘） */
function arenaBank_(P) {
  var c = arenaCache_(), key = 'arenabank_' + P.term, text = c.get(key);
  if (!text) {
    var doc = fsGet_(P, P.term + '-grader/arena_bank') || {};
    text = doc.bank_json || '';
    if (text) { try { c.put(key, text, 600); } catch (e) { /* 太大就不快取 */ } }
  }
  if (!text) return null;
  var raw = JSON.parse(text);
  return { bank: arenaPrepareBank(raw), units: (raw.units || []).map(String) };
}
function arenaNeedBank_(P) {
  var b = arenaBank_(P);
  if (!b || Object.keys(b.bank).length < ARENA.TOTAL) throw new Error('排行賽的題庫還沒匯入，請告訴老師（教師後台 →「🏆 排行賽」→「匯入題庫」）。');
  return b;
}
function arenaElig_(P, sid, need) {
  var prog = fsGet_(P, P.term + '-progress/' + sid + '?mask.fieldPaths=modules.ethics.units') || {};
  var units = ((prog.modules || {}).ethics || {}).units || {};
  var passed = arenaPassed(units, need);
  return { passed: passed, need: need.length, ok: passed >= need.length };   // 題庫沒帶章節清單 ⇒ 不擋
}
/** 今天的分級：快取 → Firestore → 從全班統計算一份存起來 */
function arenaDayTiers_(P, bank) {
  var day = arenaDay_(), c = arenaCache_(), key = 'arenatiers_' + P.term + '_' + day;
  var covers = function (t) { return t && Object.keys(bank).every(function (k) { return k in t; }); };
  try { var hit = JSON.parse(c.get(key) || 'null'); if (covers(hit)) return hit; } catch (e) {}
  var doc = fsGet_(P, P.term + '-arena-days/' + day) || {};
  var t = null;
  try { t = JSON.parse(doc.tiers_json || 'null'); } catch (e) { t = null; }
  if (!covers(t)) {
    var docs = fsListAll_(P, P.term + '-progress', ['modules.ethics.qstat']).map(function (d) { return d.data; });
    var stats = arenaStats(docs, 'ethics');
    t = arenaTiers(Object.keys(bank).sort(), stats);
    var rated = Object.keys(bank).filter(function (k) { return (Number((stats[k] || {}).n) || 0) >= ARENA.MIN_N; }).length;
    try { fsPatch_(P, P.term + '-arena-days/' + day, { tiers_json: JSON.stringify(t), rated: rated, made_at: arenaNow_() }, ['tiers_json', 'rated', 'made_at']); }
    catch (e) { /* 沒存進去就照用 */ }
  }
  try { c.put(key, JSON.stringify(t), 21600); } catch (e) {}
  return t;
}
/** 用掉今天的一次機會。回傳今天已用幾次（含這一次）；額度用完回 -1。兩個分頁同時按開始，只有一個拿得到。 */
function arenaTakeTry_(P, sid) {
  var day = arenaDay_(), path = P.term + '-arena-board/' + sid;
  for (var i = 0; i < 4; i++) {
    var d = fsGetDoc_(P, path), used = Number((d.fields.days || {})[day]) || 0;
    if (used >= ARENA.DAILY) return -1;
    var days = {}; days[day] = used + 1;                 // 只留今天
    if (fsPatchIf_(P, path, { days: days, sid: String(sid) }, ['days', 'sid'], d.updateTime)) return used + 1;
  }
  throw new Error('太多人同時開始了，請再按一次');
}
/** 一場結束：寫紀錄；比最佳成績好（而且不是腳本節奏）就更新排行 */
function arenaRecord_(P, runId, res) {
  var now = arenaNow_(), rec = JSON.parse(JSON.stringify(res));
  rec.at = now; rec.day = arenaDay_();
  fsPatch_(P, P.term + '-arena-runs/' + runId, rec, Object.keys(rec));
  var path = P.term + '-arena-board/' + res.sid;
  for (var i = 0; i < 4; i++) {
    var d = fsGetDoc_(P, path), best = d.fields.best || null;
    if (res.robot || !arenaBetter(res, best)) return { best_updated: false, best: best };
    var nb = { score: res.score, seconds: res.seconds, at: now, correct: res.correct, max_tier: res.max_tier, run: runId };
    if (fsPatchIf_(P, path, { best: nb, sid: res.sid }, ['best', 'sid'], d.updateTime)) {
      arenaCache_().remove('arenaboard_' + P.term);
      return { best_updated: true, best: nb };
    }
  }
  return { best_updated: false, best: null };
}
function arenaBoardRows_(P) {
  var c = arenaCache_(), key = 'arenaboard_' + P.term;
  try { var hit = JSON.parse(c.get(key) || 'null'); if (hit) return hit; } catch (e) {}
  var rows = [];
  fsListAll_(P, P.term + '-arena-board', ['best']).forEach(function (d) {
    var b = d.data.best;
    if (b && b.score != null) rows.push({ sid: d.id, score: Number(b.score), seconds: Number(b.seconds) || 0, at: String(b.at || '') });
  });
  try { c.put(key, JSON.stringify(rows), 30); } catch (e) {}
  return rows;
}

/* 進行中的一場：放快取，用鎖保證同一場的兩個請求不會同時改 */
function arenaWithRun_(runId, fn) {
  runId = String(runId || '');
  if (!/^[0-9a-f]{32}$/.test(runId)) return { err: arenaFail_('找不到這一場') };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { err: arenaFail_('伺服器忙線中，請再按一次') };
  try {
    var c = arenaCache_(), text = c.get('arenarun_' + runId);
    if (!text) return { err: arenaFail_('找不到這一場（超過一小時沒動，或伺服器清掉了）') };
    var run = JSON.parse(text);
    var out = fn(run);
    if (run.done) c.remove('arenarun_' + runId);
    else c.put('arenarun_' + runId, JSON.stringify(run), ARENA.RUN_TTL);
    return { run: run, out: out };
  } catch (e) {
    return { err: arenaFail_(e.message || String(e)) };
  } finally { lock.releaseLock(); }
}

function handleArena_(req, who, P) {
  try { return arenaRoute_(req, who, P); }
  catch (e) { return arenaFail_(String(e && e.message || e)); }
}
function arenaRoute_(req, who, P) {
  var kind = req.kind;

  /* 作答／時間到／離開畫面：靠場次代號（32 碼亂數，只有開始的那個人拿得到）找這一場 */
  if (kind === 'arenaAnswer' || kind === 'arenaLeave') {
    var b = arenaNeedBank_(P);
    var why = kind === 'arenaLeave' ? 'leave' : (req.timeout ? 'timeout' : null);
    var r = arenaWithRun_(req.run_id, function (run) {
      return arenaAnswer(run, b.bank, req.choice, Math.random, Date.now() / 1000, why);
    });
    if (r.err) return r.err;
    var out = r.out;
    if (out.done) {
      var res = arenaResult(r.run), rec;
      try { rec = arenaRecord_(P, String(req.run_id), res); }
      catch (e) { rec = { best_updated: false, best: null, error: String(e.message || e) }; }
      out.result = { score: res.score, correct: res.correct, total: res.total, max_tier: res.max_tier,
                     seconds: res.seconds, swaps: res.swaps, robot: res.robot };
      out.best_updated = rec.best_updated; out.best = rec.best;
      if (rec.error) out.save_error = '成績沒存進去，請告訴老師';
    }
    out.ok = true;
    if (kind === 'arenaLeave') out.question = out.next;
    return out;
  }

  /* 其他：要確認是哪個學生 */
  if (!who) return arenaFail_('登入已經過期，請回闖關基地重新登入。');
  if (who.teacher) return arenaFail_('老師帳號沒有排行賽成績 —— 請用學生帳號試玩，或到教師後台看排行。');
  var sid = who.sid;

  if (kind === 'arenaBoard') {
    var bd = arenaRanking(arenaBoardRows_(P), sid, ARENA.TOP);
    var slim = function (x) { return x && { sid: x.sid, score: x.score, seconds: x.seconds, rank: x.rank }; };   // 不給姓名、不給明細
    return { ok: true, top: bd.top.map(slim), me: slim(bd.me), players: bd.players };
  }

  var bank = arenaNeedBank_(P);
  if (kind === 'arenaToday') {
    var f = fsGetDoc_(P, P.term + '-arena-board/' + sid).fields;
    var used = Number((f.days || {})[arenaDay_()]) || 0;
    var el = arenaElig_(P, sid, bank.units);
    return { ok: true, left: Math.max(0, ARENA.DAILY - used), eligible: el.ok, passed: el.passed, need: el.need,
             daily: ARENA.DAILY, best: f.best || null, points: ARENA.POINTS, total: ARENA.TOTAL };
  }
  if (kind === 'arenaStart') {
    if (!fsGet_(P, 'roster/' + sid)) return arenaFail_('名冊裡沒有這個學號');
    /* ⚠️ 資格一定要在「用掉一次機會」之前擋：沒資格的人按開始，不可以把今天的次數扣掉 */
    var e2 = arenaElig_(P, sid, bank.units);
    if (!e2.ok) return arenaFail_('要先把資訊倫理 ' + e2.need + ' 個章節全部通關才能挑戰（目前 ' + e2.passed + ' / ' + e2.need + '）');
    var tiers = arenaDayTiers_(P, bank.bank);
    var n = arenaTakeTry_(P, sid);
    if (n < 0) return arenaFail_('今天的 ' + ARENA.DAILY + ' 次挑戰已經用完了，明天再來！');
    var nr = arenaNewRun(sid, bank.bank, tiers, Math.random, Date.now() / 1000);
    var runId = Utilities.getUuid().replace(/-/g, '');
    arenaCache_().put('arenarun_' + runId, JSON.stringify(nr.run), ARENA.RUN_TTL);
    return { ok: true, run_id: runId, question: nr.first, left: Math.max(0, ARENA.DAILY - n) };
  }
  return arenaFail_('不認得的動作：' + kind);
}

/* ── 老師：題庫、多給一次 ── */
function arenaHex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function handleArenaTeacher_(req, P) {
  try { return arenaTeacherRoute_(req, P); }
  catch (e) { return arenaFail_(String(e && e.message || e)); }
}
function arenaTeacherRoute_(req, P) {
  if (req.kind === 'arenaInfo') {
    var doc = fsGet_(P, P.term + '-grader/arena_bank');
    if (!doc || !doc.bank_json) return { ok: true, bank: null, today: arenaDay_() };
    var raw = JSON.parse(doc.bank_json);
    return { ok: true, today: arenaDay_(), bank: { count: Object.keys(arenaPrepareBank(raw)).length, items: (raw.items || []).length,
             units: raw.units || [], sig: doc.sig || '', at: doc.updated_at || '' } };
  }
  if (req.kind === 'arenaSetBank') {
    var text = String(req.bankText || '');
    var raw2;
    try { raw2 = JSON.parse(text); } catch (e) { return arenaFail_('題庫格式不對（不是 JSON）'); }
    var ok = Object.keys(arenaPrepareBank(raw2)).length, all = (raw2.items || []).length;
    if (ok < ARENA.TOTAL) return arenaFail_('能用的題目只有 ' + ok + ' 題（至少要 ' + ARENA.TOTAL + ' 題）');
    var sig = arenaHex_(text);
    fsPatch_(P, P.term + '-grader/arena_bank', { bank_json: text, sig: sig, count: ok, updated_at: arenaNow_() },
             ['bank_json', 'sig', 'count', 'updated_at']);
    arenaCache_().remove('arenabank_' + P.term);
    return { ok: true, count: ok, dropped: all - ok, sig: sig,
             message: '已匯入 ' + ok + ' 題' + (all - ok ? '（' + (all - ok) + ' 題反查不到正確答案，略過）' : '') + '。' };
  }
  if (req.kind === 'arenaGrant') {
    var sid = String(req.sid || '');
    if (!new RegExp(P.sidPattern).test(sid)) return arenaFail_('學號不正確');
    var day = arenaDay_(), path = P.term + '-arena-board/' + sid;
    for (var i = 0; i < 4; i++) {
      var d = fsGetDoc_(P, path), used = Number((d.fields.days || {})[day]) || 0;
      if (used <= 0) return { ok: true, used: 0, message: sid + ' 今天還沒用掉任何一次。' };
      var days = {}; days[day] = used - 1;
      if (fsPatchIf_(P, path, { days: days }, ['days'], d.updateTime)) return { ok: true, used: used - 1, message: '已把 ' + sid + ' 今天的次數退回一次（今天已用 ' + (used - 1) + ' 次）。' };
    }
    return arenaFail_('剛好有人在改，請再按一次');
  }
  return arenaFail_('不認得的動作：' + req.kind);
}

/* =====================================================================
   第四部分：作品比對的線索（抄襲）
   ---------------------------------------------------------------------
   ★ 比對本身不在這裡做，也不在上課時做：
     評分時只順手記下兩樣東西（寫進本來就要寫的那筆進度，不多一次連線），
     老師打開「🐱 作品評分」時，在老師的瀏覽器裡比對全班（shared/works.html）。
   ① 指紋 hash：作品內容（project.json）的 SHA-256。整個檔案原封不動轉傳 ⇒ 一樣。
      兩個學生各自做出邏輯一模一樣的程式也**不會**一樣 —— 每塊積木的編號是 Scratch 隨機產生的，
      擺放的座標也不同 ⇒ 不會誤判認真做的學生。
   ② 積木編號 ids：每塊積木的編號（前 8 碼）。拿到別人的檔案後拖一下、改個數字，
      指紋就變了，但積木編號還是同一批 ⇒ 抓得到「抄來再改一點」。
      ⚠️ 空白範本裡的積木大家都有（從同一個起始檔開始），要扣掉：
         老師上傳空白範本時記下 template_ids；後台比對時再扣掉「全班大多數人都有」的編號。
   ③ 老師按「取消成績」⇒ 後台把那一份的指紋與特有的積木編號記進 modules.scratch.revoked。
      之後交上來的作品，指紋一樣、或那批特有的積木一半以上都在 ⇒ 擋下（revokedHit）。
      自己重做的新作品，積木都是新拖出來的、編號都是新的 ⇒ 照常評分。
   ⚠️ 門檻（PRINT）要和 shared/works.html 的 PRINT 一樣。
   ===================================================================== */
var PRINT = { MAX_IDS: 400, MIN_IDS: 5, RATIO: 0.5 };

/** 作品裡每一塊積木的編號：只取前 8 碼、排序、去重、最多 400 個
    （陣列＝放在舞台上的變數小方塊；shadow＝積木裡的輸入格，跟著積木走，不必另外算） */
function blockIds(project) {
  var seen = {};
  (project.targets || []).forEach(function (t) {
    Object.keys(t.blocks || {}).forEach(function (id) {
      var b = t.blocks[id];
      if (!b || Array.isArray(b) || b.shadow) return;
      seen[String(id).slice(0, 8)] = 1;
    });
  });
  return Object.keys(seen).sort().slice(0, PRINT.MAX_IDS);
}

/** ids 扣掉 drop（空白隔開的字串，例如空白範本的 template_ids） */
function idsMinus(ids, drop) {
  var d = {};
  String(drop || '').split(' ').forEach(function (x) { if (x) d[x] = 1; });
  return (ids || []).filter(function (x) { return !d[x]; });
}

/** 這份作品是不是老師取消過的那一份：指紋一樣，或那一份特有的積木有一半以上都在 */
function revokedHit(list, hash, ids) {
  var mine = {};
  (ids || []).forEach(function (x) { mine[x] = 1; });
  return (Array.isArray(list) ? list : []).some(function (r) {
    if (!r) return false;
    if (r.hash && r.hash === hash) return true;
    var theirs = String(r.ids || '').split(' ').filter(Boolean);
    if (theirs.length < PRINT.MIN_IDS) return false;
    var hit = theirs.filter(function (x) { return mine[x]; }).length;
    return hit / theirs.length >= PRINT.RATIO;
  });
}

/* =====================================================================
   第五部分：運算思維的通關截圖
   ---------------------------------------------------------------------
   學生在運算思維頁按「送出」⇒ 過關照常馬上記錄（瀏覽器自己寫，和以前一樣），
   接著**背景**把截圖送到這裡；送不上去也不影響過關。
   · 存到 DRIVE_FOLDER_ID / {TERM} / thinking / {班級} / {班級座號}_{姓名}_{學號}_第NN關.png
     沒設 DRIVE_FOLDER_ID ⇒ 回 skipped，學生頁之後就不再送。
   · 連結和指紋由這裡用老師的身分寫進 {TERM}-progress/{學號} 的 modules.thinking.shots，
     安全規則不准學生自己改（不然可以把連結換成別人的圖）。
   · 同一關換一張 ⇒ 舊的那張丟進雲端硬碟的垃圾桶（30 天內救得回來）；同一張重傳 ⇒ 不再存一份。
   · 相同截圖的比對在老師後台「🧠 通關截圖」打開時才做（shared/shots.html），上課時不比對。
   ===================================================================== */
var SHOT = { MAX_MB: 8, LEVELS: 10, TYPES: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } };

function handleShot_(req, who, P) {
  if (who.teacher) return { ok: false, message: '老師帳號不用交截圖。' };
  if (!P.folder) return { ok: false, skipped: true, message: '老師沒有設定雲端硬碟資料夾，截圖不保存（過關照常記錄）。' };
  var level = Number(req.challenge);
  if (!(level >= 1 && level <= SHOT.LEVELS && Math.floor(level) === level)) return { ok: false, message: '不認得的關卡。' };
  var mime = String(req.mime || ''), ext = SHOT.TYPES[mime];
  if (!ext) return { ok: false, message: '只收 PNG、JPG、WebP 的截圖。' };
  var bytes;
  try { bytes = Utilities.base64Decode(String(req.b64 || '')); } catch (e) { return { ok: false, message: '截圖讀不出來。' }; }
  if (!bytes || !bytes.length) return { ok: false, message: '沒有收到截圖。' };
  if (bytes.length > SHOT.MAX_MB * 1024 * 1024) return { ok: false, message: '截圖太大（超過 ' + SHOT.MAX_MB + ' MB）。' };

  var sid = who.sid;
  var roster = fsGet_(P, 'roster/' + sid);
  if (!roster) return { ok: false, message: '名冊裡找不到學號 ' + sid + '，請找老師。' };
  var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
  var prog = fsGet_(P, P.term + '-progress/' + sid) || {};
  var key = String(level);
  var old = ((((prog.modules || {}).thinking || {}).shots) || {})[key];
  if (old && old.hash === hash) return { ok: true, same: true, url: old.url };

  var pad2 = function (x) { x = String(x == null ? '' : x); return x.length < 2 ? ('0' + x).slice(-2) : x; };
  var cls = String(roster.cls || '未分班');
  var folder = driveFolder_(P.folder, [P.term, 'thinking', cls]);
  var name = [cls + pad2(roster.no), roster.name || '', sid, '第' + pad2(level) + '關'].join('_') + '.' + ext;
  var f = folder.createFile(Utilities.newBlob(bytes, mime, name));
  if (old && old.fileId) { try { DriveApp.getFileById(old.fileId).setTrashed(true); } catch (e) { /* 舊檔已被老師移走，不管它 */ } }

  var shot = { url: f.getUrl(), fileId: f.getId(), hash: hash, at: Date.now(), size: bytes.length, title: String(req.title || '').slice(0, 40) };
  var fields = { modules: { thinking: { shots: {} } } };
  fields.modules.thinking.shots[key] = shot;
  fsPatch_(P, P.term + '-progress/' + sid, fields, [fp_(['modules', 'thinking', 'shots', key])]);
  return { ok: true, url: shot.url };
}

/** 找（沒有就建）root 底下的一串子資料夾。資料夾 id 快取起來：
    同一班 30 個人同時過關，只有第一個要找；建資料夾時上鎖，免得同時建出兩個「801」。 */
function driveFolder_(rootId, names) {
  var cache = CacheService.getScriptCache(), key = 'fold_' + rootId + '/' + names.join('/');
  var id = cache.get(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { cache.remove(key); } }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var f = DriveApp.getFolderById(rootId);
    names.forEach(function (n) { var it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n); });
    try { cache.put(key, f.getId(), 21600); } catch (e) {}
    return f;
  } finally { lock.releaseLock(); }
}

/* node 測試用（Apps Script 裡沒有 module，這一段不會執行） */
if (typeof module !== 'undefined') {
  module.exports = { projectToPseudo: projectToPseudo, parsePseudo: parsePseudo, gradeSubmission: gradeSubmission,
    ARENA: ARENA, arenaQid: arenaQid, arenaAnsOf: arenaAnsOf, arenaPrepareBank: arenaPrepareBank, arenaStats: arenaStats,
    arenaTiers: arenaTiers, arenaIsRobot: arenaIsRobot, arenaNewRun: arenaNewRun, arenaAnswer: arenaAnswer,
    arenaResult: arenaResult, arenaBetter: arenaBetter, arenaRanking: arenaRanking, arenaPassed: arenaPassed,
    handleArena_: handleArena_, handleArenaTeacher_: handleArenaTeacher_,
    PRINT: PRINT, blockIds: blockIds, idsMinus: idsMinus, revokedHit: revokedHit, SHOT: SHOT };
}
