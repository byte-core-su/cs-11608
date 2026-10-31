/* =====================================================================
   闖關排行賽（grader.gs 第三部分）的測試：node gas/arena.test.js
   ---------------------------------------------------------------------
   整支 grader.gs 放進一個「假的 Apps Script」（fakegas.js）裡跑：
     Firestore（REST）、Firebase 登入查詢、快取、鎖、時間都是假的，存在記憶體。
   ⇒ 從 doPost 一路測到寫進資料庫的內容，和真的部署走同一條路。
   不需要安裝任何套件。
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

let fail = 0, pass = 0;
function ok(cond, name, info) {
  if (cond) pass++; else fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (info ? '　' + info : ''));
}
const section = t => console.log('\n── ' + t + ' ──');

/* ── 題庫：用網站裡的 ethics.js（和老師後台按「匯入題庫」同一個抽法）── */
const ROOT = path.join(__dirname, '..');
const W = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'shared', 'qstat.js'), 'utf8'))(W);
new Function('window', fs.readFileSync(path.join(ROOT, 'course', 'content', 'ethics.js'), 'utf8'))(W);
const ARENABANK = require(path.join(ROOT, 'shared', 'arenabank.js'));
const RAW = ARENABANK.build(W.QUIZ_CONTENT, W.QSTAT, '11501');
const BANK_TEXT = JSON.stringify(RAW);

/* ── 假的 Apps Script（fakegas.js）：Firestore、登入查詢、快取、鎖、時間都存在記憶體 ── */
const env = require('./fakegas')();
const { G, post, DB, docOf, seed, login, DOMAIN } = env;

const T = login('teacher@school.tw');
const SID = '1410101', SID2 = '1410102';
const S1 = login(SID + '@' + DOMAIN), S2 = login(SID2 + '@' + DOMAIN);
const rightIndex = q => {           // 測試用：用公開的答案雜湊反查（和學生拿 ethics.js 反查一樣）
  const item = RAW.items.find(it => it.q === q.q);
  return q.options.findIndex(o => G.arenaAnsOf(item.q, o) === item.a);
};
const sec = s => { env.clock += s * 1000; };

/* ===================================================================== */
section('題庫');
const prepared = G.arenaPrepareBank(RAW);
ok(RAW.count === 141 && Object.keys(prepared).length === 141, '★★ ethics.js 抽出 141 題，全部反查得到正確選項', RAW.count + ' / ' + Object.keys(prepared).length);
ok(RAW.items.every(it => G.arenaQid(it.q) === it.id), '★★ 題目 id 和題目分析頁（QSTAT.id）一樣');
ok(JSON.stringify(RAW.units) === JSON.stringify(['1-1', '1-2', '1-3', '1-4', 'ch1-all', '3-1', '3-2', '3-3', 'ch3-all', 'review-all']), '★ 參賽資格是 10 個章節', RAW.units.join(','));
const hubSrc = fs.readFileSync(path.join(ROOT, 'course', 'hub.html'), 'utf8');
const hubUnits = (hubSrc.match(/ARENA_UNITS\s*=\s*(\[[^\]]*\])/) || [])[1];
ok(hubUnits && JSON.stringify(JSON.parse(hubUnits.replace(/'/g, '"'))) === JSON.stringify(RAW.units), '★★ 闖關基地的排行賽卡片用同一份章節清單', hubUnits || '（hub 沒有 ARENA_UNITS）');
/* 選填：ARENA_REF=另一份 ethics.arena.json 的路徑，比對兩份題庫是否一致 */
const REF = process.env.ARENA_REF || '';
if (REF && fs.existsSync(REF)) {
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  ok(JSON.stringify(ref.items) === JSON.stringify(RAW.items) && JSON.stringify(ref.units) === JSON.stringify(RAW.units),
     '★★★ 和 ARENA_REF 那份題庫一模一樣（題目、選項、雜湊、順序、章節）');
}

section('規則（純邏輯）');
ok([1, 2, 3, 4].concat(Array(16).fill(5)).reduce((s, t) => s + G.ARENA.POINTS[t], 0) === 1000, '★★ 一路全對剛好 1000 分');
const qids = Object.keys(prepared).sort();
const stats = {};
qids.slice(0, 100).forEach((k, i) => { stats[k] = { n: 20, ok: 20 - Math.floor(i / 5) }; });
const tiers = G.arenaTiers(qids, stats);
ok(new Set(Object.values(tiers)).size === 5, '分成五級');
ok(qids.slice(100).every(k => tiers[k] === 3), '★★ 資料不足（少於 10 人次）的放 ★3');
ok(tiers[qids[0]] === 1 && tiers[qids[99]] === 5, '★★★ 答對率最高的是 ★1、最低的是 ★5');
ok(G.arenaIsRobot([1, 0.5, 1, 1, 0.8]) && !G.arenaIsRobot([1, 1, 1, 1, 12]) && !G.arenaIsRobot([1, 1, 1]), '像腳本：至少 5 題、每題都在 1 秒內');
ok(G.arenaBetter({ score: 900, seconds: 50 }, { score: 900, seconds: 60 }) && !G.arenaBetter({ score: 800, seconds: 1 }, { score: 900, seconds: 60 }), '★ 分數高的贏，同分用時短的贏');
const rows = [];
for (let i = 0; i < 41; i++) rows.push({ sid: String(1400000 + i), score: 1000 - i * 10, seconds: 100, at: '2026-10-0' + (i % 9 + 1) });
rows.push({ sid: '1499998', score: 990, seconds: 90, at: 'z' });
const rk = G.arenaRanking(rows, '1400040', 30);
ok(rk.top.length === 30 && rk.players === 42 && rk.top[1].sid === '1499998', '★★ 前 30 名，同分用時短的在前');
ok(rk.me && rk.me.rank === 42, '★★★ 30 名外也拿得到自己的名次', 'rank ' + (rk.me && rk.me.rank));

section('還沒匯入題庫');
ok(post({ kind: 'arenaInfo', idToken: T }).bank === null, '老師看得到「還沒有題庫」');
let r = post({ kind: 'arenaToday', idToken: S1 });
ok(!r.ok && /匯入/.test(r.error), '★ 學生看到「題庫還沒匯入，請告訴老師」', r.error);
ok(!post({ kind: 'arenaSetBank', idToken: S1, bankText: BANK_TEXT }).ok, '★★★ 學生不能匯入題庫');

section('老師匯入題庫');
r = post({ kind: 'arenaSetBank', idToken: T, bankText: BANK_TEXT });
ok(r.ok && r.count === 141 && r.dropped === 0, '匯入 141 題', r.message);
const sig = crypto.createHash('sha256').update(BANK_TEXT, 'utf8').digest('hex');
ok(r.sig === sig && post({ kind: 'arenaInfo', idToken: T }).bank.sig === sig, '★ 指紋和瀏覽器算的一樣（後台才知道網站上的題庫有沒有改過）');
const broken = JSON.parse(BANK_TEXT); broken.items = broken.items.slice(0, 10);
ok(!post({ kind: 'arenaSetBank', idToken: T, bankText: JSON.stringify(broken) }).ok, '少於 20 題 ⇒ 不收');
ok(!post({ kind: 'arenaSetBank', idToken: T, bankText: 'not json' }).ok, '不是 JSON ⇒ 不收');

section('參賽資格');
seed('roster/' + SID, { studentId: SID, cls: '801', no: '01', name: '王小明' });
seed('roster/' + SID2, { studentId: SID2, cls: '802', no: '02', name: '李小華' });
const units9 = {}; RAW.units.slice(0, 9).forEach(u => { units9[u] = { star: 2 }; });
seed('11501-progress/' + SID, { modules: { ethics: { units: units9 } } });
r = post({ kind: 'arenaToday', idToken: S1 });
ok(r.ok && r.eligible === false && r.passed === 9 && r.need === 10 && r.left === 2, '★★ 9 / 10 ⇒ 沒資格', JSON.stringify({ e: r.eligible, p: r.passed, l: r.left }));
r = post({ kind: 'arenaStart', idToken: S1 });
ok(!r.ok && /9 \/ 10/.test(r.error), '★★★ 沒資格按開始 ⇒ 擋下', r.error);
ok(!DB['11501-arena-board/' + SID], '★★★ 而且沒有扣掉今天的次數');
ok(post({ kind: 'arenaToday', idToken: T }).ok === false, '老師帳號沒有排行賽成績');
ok(post({ kind: 'arenaToday', idToken: 'bad' }).ok === false, '假的登入憑證 ⇒ 擋下');

/* 全班答題統計（決定今天的難度） */
const all10 = {}; RAW.units.forEach(u => { all10[u] = { star: 3 }; });
const qs = {}; qids.forEach((k, i) => { qs[k] = { n: 12 + (i % 7), ok: 12 - (i % 13) }; });   // 141 題都有足夠的作答人次 ⇒ 每一級約 28 題
seed('11501-progress/' + SID, { modules: { ethics: { units: all10, qstat: qs } } });
seed('11501-progress/' + SID2, { modules: { ethics: { units: all10 } } });
r = post({ kind: 'arenaToday', idToken: S1 });
ok(r.ok && r.eligible && r.passed === 10 && r.left === 2 && r.best === null, '★★ 10 / 10 ⇒ 可以挑戰，今天剩 2 次');

section('一場全對');
r = post({ kind: 'arenaStart', idToken: S1 });
ok(r.ok && /^[0-9a-f]{32}$/.test(r.run_id) && r.left === 1, '開始：拿到場次代號、今天剩 1 次');
let q = r.question;
ok(q.index === 1 && q.tier === 1 && q.points === 15 && q.limit === 20, '★★ 第一題 ★1、15 分、限時 20 秒');
ok(JSON.stringify(Object.keys(q).sort()) === JSON.stringify(['index', 'limit', 'options', 'points', 'q', 'score', 'tier', 'total']), '★★★ 題目裡沒有答案、沒有雜湊');
const day = DB['11501-arena-days/2026-10-23'];
ok(day && docOf('11501-arena-days/2026-10-23').rated === 141, '★ 今天的分級存起來了（依全班答對率，141 題都分到級）');
const run1 = r.run_id, seen = new Set(), pathT = [];
let last;
for (let i = 0; i < 20; i++) {
  seen.add(q.q); pathT.push(q.tier);
  sec(5);
  last = post({ kind: 'arenaAnswer', run_id: run1, choice: rightIndex(q) });
  if (!last.ok) { ok(false, '第 ' + (i + 1) + ' 題送不出去', last.error); break; }
  q = last.next;
}
ok(last.done && last.result.score === 1000 && last.result.correct === 20, '★★★ 20 題全對 ＝ 1000 分', JSON.stringify(last.result));
ok(JSON.stringify(pathT.slice(0, 5)) === '[1,2,3,4,5]' && pathT.slice(5).every(t => t === 5), '★★ 路線 ★1→★5，之後都在 ★5');
ok(seen.size === 20, '★★ 同一場 20 題不重複');
ok(last.result.seconds === 100 && last.result.max_tier === 5 && !last.result.robot, '用時由後端量（100 秒）');
ok(last.best_updated === true && last.best.score === 1000, '★★ 刷新最佳成績');
const runDoc = docOf('11501-arena-runs/' + run1);
ok(runDoc && runDoc.sid === SID && runDoc.steps.length === 20 && runDoc.day === '2026-10-23', '★ 這一場的紀錄寫進資料庫（老師後台看得到）');
const bd = docOf('11501-arena-board/' + SID);
ok(bd.best.score === 1000 && bd.days['2026-10-23'] === 1, '排行：最佳 1000、今天用了 1 次');
r = post({ kind: 'arenaAnswer', run_id: run1, choice: 0 });
ok(!r.ok, '★ 結束的那一場不能再交', r.error);

section('答錯、時間到、拖時間、離開畫面');
r = post({ kind: 'arenaStart', idToken: S1 });
ok(r.ok && r.left === 0, '第 2 次：今天剩 0 次');
const run2 = r.run_id; q = r.question;
sec(3); r = post({ kind: 'arenaAnswer', run_id: run2, choice: (rightIndex(q) + 1) % q.options.length });
ok(r.ok && !r.right && r.points === 0 && r.tier_to === 1, '★★ ★1 答錯：0 分、還是 ★1');
q = r.next; sec(3); r = post({ kind: 'arenaAnswer', run_id: run2, choice: rightIndex(q) });
ok(r.right && r.points === 15 && r.tier_to === 2, '答對：+15、升到 ★2');
q = r.next;
for (const bad of [-1, 9, 'x', null, 1.5]) {
  const b = post({ kind: 'arenaAnswer', run_id: run2, choice: bad });
  ok(!b.ok, '★ 亂送選項 ' + JSON.stringify(bad) + ' ⇒ 擋下（不會偷偷算成一題）');
}
sec(21); r = post({ kind: 'arenaAnswer', run_id: run2, timeout: true });
ok(r.ok && !r.right && r.why === 'timeout' && r.tier_from === 2 && r.tier_to === 1, '★★ 時間到 ⇒ 算錯、降一級');
q = r.next; sec(30); r = post({ kind: 'arenaAnswer', run_id: run2, choice: rightIndex(q) });
ok(r.ok && !r.right && r.why === 'late', '★★★ 頁面不送「時間到」、拖到 30 秒才交對的答案 ⇒ 照樣算錯');
q = r.next; sec(G.ARENA.LIMIT + G.ARENA.GRACE - 1); r = post({ kind: 'arenaAnswer', run_id: run2, choice: rightIndex(q) });
ok(r.ok && r.right && r.why === null, '★ 網路慢一點（' + (G.ARENA.LIMIT + G.ARENA.GRACE - 1) + ' 秒才到）還在寬限內 ⇒ 照常判');
q = r.next; sec(2); r = post({ kind: 'arenaLeave', run_id: run2 });
ok(r.ok && !r.right && r.why === 'leave' && r.tier_to === 1 && r.question && r.question.index === 7, '★★ 離開畫面 ⇒ 算錯、降一級、直接下一題（不是換題）');
while (!r.done) { q = r.next; sec(2); r = post({ kind: 'arenaAnswer', run_id: run2, choice: 0 }); }
ok(r.result.total === 20 && r.result.swaps === 1, '一場還是 20 題；記一次離開', JSON.stringify(r.result));
ok(r.best_updated === false && r.best.score === 1000, '★★ 分數比較低 ⇒ 不會蓋掉最佳成績');
const steps = docOf('11501-arena-runs/' + run2).steps;
ok(steps[2].why === 'timeout' && steps[2].sec === 20 && steps[3].why === 'late' && steps[5].why === 'leave', '★ 紀錄裡看得出哪幾題是時間到、拖時間、離開');

section('一天兩次');
r = post({ kind: 'arenaStart', idToken: S1 });
ok(!r.ok && /用完/.test(r.error), '★★★ 第 3 次擋下，講清楚「明天再來」', r.error);
ok(post({ kind: 'arenaToday', idToken: S1 }).left === 0, '開始畫面顯示剩 0 次');
r = post({ kind: 'arenaGrant', idToken: T, sid: SID });
ok(r.ok && r.used === 1 && post({ kind: 'arenaToday', idToken: S1 }).left === 1, '★ 老師可以退回一次（斷線白白用掉的時候）', r.message);
ok(!post({ kind: 'arenaGrant', idToken: S2, sid: SID }).ok, '★★ 學生不能幫人退次數');
r = post({ kind: 'arenaStart', idToken: S1 });
ok(r.ok, '退回之後可以再玩一次');
env.clock += 24 * 3600 * 1000;
r = post({ kind: 'arenaToday', idToken: S1 });
ok(r.left === 2, '★★ 隔天重新計算');
r = post({ kind: 'arenaStart', idToken: S1 });
ok(r.ok && JSON.stringify(Object.keys(docOf('11501-arena-board/' + SID).days)) === '["2026-10-24"]', '舊日期不累積');
ok(docOf('11501-arena-days/2026-10-24'), '★ 新的一天重新分級');

section('同時按兩次開始');
let n0 = env.commits;
env.beforeCommit = () => {               // 第一次寫入之前，另一個分頁先寫了
  const p = '11501-arena-board/' + SID2;
  const d = docOf(p) || {}; d.days = { '2026-10-24': 1 }; d.sid = SID2; seed(p, d);
};
r = post({ kind: 'arenaStart', idToken: S2 });
ok(r.ok && r.left === 0 && docOf('11501-arena-board/' + SID2).days['2026-10-24'] === 2, '★★★ 被搶先寫入 ⇒ 重讀再算（2 次，不是 1 次）', 'commits ' + (env.commits - n0));
seed('11501-arena-board/' + SID2, { sid: SID2, days: { '2026-10-24': 1 } });
env.beforeCommit = () => { const p = '11501-arena-board/' + SID2; const d = docOf(p); d.days = { '2026-10-24': 2 }; seed(p, d); };
r = post({ kind: 'arenaStart', idToken: S2 });
ok(!r.ok && /用完/.test(r.error), '★★ 搶先的那一個把額度用完 ⇒ 這一個擋下', r.error);
env.beforeCommit = null;

section('像腳本的一場');
seed('11501-arena-board/' + SID2, { sid: SID2 });
r = post({ kind: 'arenaStart', idToken: S2 });
const run3 = r.run_id; q = r.question;
for (;;) { sec(0.5); r = post({ kind: 'arenaAnswer', run_id: run3, choice: rightIndex(q) }); if (!r.ok || r.done) break; q = r.next; }
ok(r.done && r.result.score === 1000 && r.result.robot, '★★ 每題 0.5 秒 ⇒ 判成像腳本', JSON.stringify(r.result));
ok(r.best_updated === false && !docOf('11501-arena-board/' + SID2).best, '★★★ 不進排行');
ok(!!docOf('11501-arena-runs/' + run3), '★ 但那一場照樣留紀錄（老師查得到）');

section('排行榜');
r = post({ kind: 'arenaBoard', idToken: S2 });
ok(r.ok && r.players === 1 && r.top[0].sid === SID && r.top[0].score === 1000 && r.me === null, '排行讀得出來；沒成績的人沒有名次');
ok(JSON.stringify(Object.keys(r.top[0]).sort()) === '["rank","score","seconds","sid"]', '★★ 只給學號、分數、用時、名次 —— 不給姓名、不給明細');
r = post({ kind: 'arenaBoard', idToken: S1 });
ok(r.me && r.me.rank === 1, '自己的名次');

section('亂送的場次代號');
ok(!post({ kind: 'arenaAnswer', run_id: 'abc', choice: 0 }).ok, '格式不對 ⇒ 擋下');
ok(!post({ kind: 'arenaAnswer', run_id: 'a'.repeat(32), choice: 0 }).ok, '★ 猜不到別人的場次（32 碼亂數）');

console.log('\n' + (fail ? '❌ ' + fail + ' 項沒過' : '✅ 全部通過') + '（' + pass + ' 項）');
process.exit(fail ? 1 : 0);
