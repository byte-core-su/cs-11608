/* =====================================================================
   作品比對（抄襲線索）＋運算思維截圖的測試：node gas/works.test.js
   ---------------------------------------------------------------------
   整支 grader.gs 放進假的 Apps Script（fakegas.js）裡跑，用 gas/demo/ 的示範關卡：
     · 評分時記下指紋與積木編號、空白範本的積木扣掉
     · 同一個檔案 ⇒ 指紋一樣；拖一下、改個數字 ⇒ 指紋不同、積木編號相同；自己做的 ⇒ 都不同
     · 老師取消之後：同一份、改一點點的再交 ⇒ 擋下；自己重做的 ⇒ 照常評分
     · 截圖：存進雲端硬碟對的資料夾、連結寫進進度、同一張不重存、換一張舊的丟垃圾桶
   不需要安裝任何套件。
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const makeFakeGas = require('./fakegas');

let fail = 0, pass = 0;
function ok(cond, name, info) {
  if (cond) pass++; else fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (info ? '　' + info : ''));
}
const section = t => console.log('\n── ' + t + ' ──');

/* ── .sb3 讀寫（測試要改作品再包回去）── */
const DEMO = path.join(__dirname, 'demo');
const readSb3 = f => makeFakeGas.unzip(fs.readFileSync(path.join(DEMO, f)));
const projectOf = files => JSON.parse(files.find(x => x.name === 'project.json').data.toString('utf8'));
function crc32(buf) { let c, crc = 0xFFFFFFFF; for (const b of buf) { c = (crc ^ b) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {                                  // stored，夠 Utilities.unzip（和真的 Scratch）讀
  const parts = [], central = []; let off = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, 'utf8'), data = f.data, crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, name, data); central.push(ch, name); off += 30 + name.length + data.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cd, end]));
}
const ANS = readSb3('示範關卡_解答.sb3'), BLANK = readSb3('示範關卡_空白.sb3');
const b64 = files => zip(files).toString('base64');
const withProject = (files, p) => files.map(f => f.name === 'project.json' ? { name: f.name, data: Buffer.from(JSON.stringify(p), 'utf8') } : f);
const clone = o => JSON.parse(JSON.stringify(o));
const sprite = p => p.targets.find(t => !t.isStage);
/** 自己重做一份：每一塊積木都換新的編號（Scratch 拖出新積木就是這樣），座標也挪一下 */
function redo(p, seed) {
  const q = clone(p), t = sprite(q), map = {};
  let n = 0;
  Object.keys(t.blocks).forEach(id => { map[id] = 'z' + seed + String(++n).padStart(3, '0') + 'qQ9x!kLm'; });
  const fix = v => (typeof v === 'string' && map[v]) ? map[v] : Array.isArray(v) ? v.map(fix) : v;
  const nb = {};
  Object.entries(t.blocks).forEach(([id, b]) => {
    const c = clone(b); c.next = fix(c.next); c.parent = fix(c.parent);
    Object.keys(c.inputs || {}).forEach(k => { c.inputs[k] = fix(c.inputs[k]); });
    if (c.topLevel) { c.x = (c.x || 0) + 13; c.y = (c.y || 0) + 7; }
    nb[map[id]] = c;
  });
  t.blocks = nb; return q;
}

/* ===================================================================== */
const env = makeFakeGas({ DRIVE_FOLDER_ID: 'root' });
const { G, post, docOf, seed, login, DOMAIN, drive } = env;
const T = login('teacher@school.tw');
const STU = { A: '1410101', B: '1410102', C: '1410103', D: '1410104' };
const tok = {};
Object.entries(STU).forEach(([k, sid], i) => { seed('roster/' + sid, { cls: '801', no: i + 1, name: '學生' + k }); tok[k] = login(sid + '@' + DOMAIN); });
const UNIT = '2-1-1A';
const grade = (k, files) => post({ kind: 'grade', idToken: tok[k], unit: UNIT, unitNo: 1, total: 10, b64: b64(files) });
const printOf = sid => ((((docOf('11501-progress/' + sid) || {}).modules || {}).scratch || {}).unitPrint || {})[UNIT];

section('積木編號');
const idsAns = G.blockIds(projectOf(ANS)), idsBlank = G.blockIds(projectOf(BLANK));
ok(idsAns.length > idsBlank.length && idsBlank.every(x => idsAns.includes(x)), '★ 解答的積木編號包含空白範本的', idsAns.length + ' / ' + idsBlank.length);
ok(idsAns.every(x => x.length <= 8), '只留前 8 碼');
ok(G.idsMinus(idsAns, idsBlank.join(' ')).length === idsAns.length - idsBlank.length, 'idsMinus 扣掉空白範本');

section('老師上傳範本');
let r = post({ kind: 'setRef', idToken: T, unit: UNIT, which: 'example', b64: b64(ANS) });
ok(r.ok, '上傳解答', r.message);
r = post({ kind: 'setRef', idToken: T, unit: UNIT, which: 'template', b64: b64(BLANK) });
ok(r.ok, '上傳空白範本', r.message);
const crit = JSON.parse(docOf('11501-grader/criteria').units_json)[UNIT];
ok(crit.template_ids === idsBlank.join(' '), '★★ 空白範本的積木編號記進 template_ids');
r = post({ kind: 'setRef', idToken: tok.A, unit: UNIT, which: 'example', b64: b64(ANS) });
ok(!r.ok && /只有老師/.test(r.message), '★ 學生不能上傳範本', r.message);

section('評分時記下指紋');
r = grade('A', ANS);
ok(r.ok && r.stars === 3, 'A 交解答 3⭐', r.score + ' 分');
const pa = printOf(STU.A);
ok(pa && pa.hash && pa.stars === 3 && pa.file, '★★ unitPrint 有指紋、星數、作品連結');
ok(pa.ids.split(' ').length === idsAns.length - idsBlank.length && !idsBlank.some(x => pa.ids.split(' ').includes(x)), '★★ 積木編號已經扣掉空白範本', pa.ids.split(' ').length + ' 塊');
ok(drive.files[pa.file.match(/d\/(\w+)/)[1]].name.indexOf(STU.A) >= 0, '作品備份到雲端硬碟');

r = grade('B', ANS);
const pb = printOf(STU.B);
ok(r.ok && pb.hash === pa.hash, '★★ B 原封不動交同一個檔案 ⇒ 指紋一樣');

const tweak = clone(projectOf(ANS));
Object.values(sprite(tweak).blocks).forEach(b => { if (b.topLevel) { b.x += 40; } if (b.opcode === 'data_addtolist' && b.inputs.ITEM[1][1] === '牛奶') b.inputs.ITEM[1][1] = '鮮奶'; });
r = grade('C', withProject(ANS, tweak));
const pc = printOf(STU.C);
ok(r.ok && pc.hash !== pa.hash && pc.ids === pa.ids, '★★★ C 拿去拖一下、改個字 ⇒ 指紋不同、積木編號一樣', r.score + ' 分 ' + r.stars + '⭐');

r = grade('D', withProject(ANS, redo(projectOf(ANS), 'd')));
const pd = printOf(STU.D);
ok(r.ok && r.stars === 3 && pd.hash !== pa.hash, '★ D 自己做（邏輯一模一樣）⇒ 一樣 3⭐，指紋不同');
const shared = pd.ids.split(' ').filter(x => pa.ids.split(' ').includes(x)).length;
ok(shared === 0, '★★★ D 和 A 的積木編號沒有重疊 ⇒ 不會被誤判', '相同 ' + shared + ' 塊');

section('指紋記「拿到目前星數的那一份」');
r = grade('C', BLANK);
ok(r.ok && r.stars === 0 && r.bestStars >= 2, 'C 再交一份空白 ⇒ 星數不變', r.stars + '⭐，最佳 ' + r.bestStars + '⭐');
ok(printOf(STU.C).hash === pc.hash, '★★ 指紋還是抄來的那一份（交差的蓋不掉）');

section('老師取消之後');
/* 老師後台（shared/works.html）按「取消」寫進去的東西：0⭐＋指紋＋特有的積木編號 */
function revoke(sid, pr) {
  const p = '11501-progress/' + sid, d = docOf(p);
  d.modules.scratch.unitStars[UNIT] = 0; d.modules.scratch.unitScores[UNIT] = 0;
  d.modules.scratch.revoked = { [UNIT]: [{ hash: pr.hash, ids: pr.ids, at: env.clock }] };
  seed(p, d);
}
revoke(STU.B, pb);
r = grade('B', ANS);
ok(!r.ok && r.blocked && /取消/.test(r.message), '★★★ B 再交同一個檔案 ⇒ 擋下', r.message);
let db = docOf('11501-progress/' + STU.B).modules.scratch;
ok(db.unitStars[UNIT] === 0 && db.blocked[UNIT] && db.blocked[UNIT].hash, '★★ 星數還是 0，記下 blocked 給老師看');
r = grade('B', withProject(ANS, tweak));
ok(!r.ok && r.blocked, '★★★ B 改一點點再交 ⇒ 也擋下（積木編號一樣）');
r = grade('B', withProject(ANS, redo(projectOf(ANS), 'b')));
ok(r.ok && r.stars === 3, '★★★ B 自己重做一份 ⇒ 照常評分', r.score + ' 分 ' + r.stars + '⭐');
db = docOf('11501-progress/' + STU.B).modules.scratch;
ok(db.unitStars[UNIT] === 3 && printOf(STU.B).hash !== pb.hash, '★ 重做的那一份變成新的指紋');

section('revokedHit 門檻');
const idsA = pa.ids.split(' ');
ok(G.revokedHit([{ hash: 'x', ids: idsA.join(' ') }], 'y', idsA.slice(0, Math.ceil(idsA.length / 2))), '★ 特有的積木一半在 ⇒ 擋');
ok(!G.revokedHit([{ hash: 'x', ids: idsA.join(' ') }], 'y', idsA.slice(0, Math.floor(idsA.length / 2) - 1)), '★ 不到一半 ⇒ 不擋');
ok(!G.revokedHit([{ hash: 'x', ids: idsA.slice(0, 4).join(' ') }], 'y', idsA), '★ 特有的積木不到 5 塊 ⇒ 只看指紋', '（避免太少塊誤判）');
ok(!G.revokedHit(undefined, 'y', idsA) && !G.revokedHit([], 'y', idsA), '沒有取消紀錄 ⇒ 不擋');

section('老師試評不受影響');
r = post({ kind: 'test', idToken: T, unit: UNIT, b64: b64(ANS) });
ok(r.ok && r.dry && r.stars === 3, '老師試評同一個檔案照樣有分數');

/* ===================================================================== */
section('運算思維截圖');
const png = n => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, n)]).toString('base64');
const shot = (k, lv, data, mime) => post({ kind: 'shot', idToken: tok[k], challenge: lv, title: '滑梯公園', mime: mime || 'image/png', b64: data });
const shotsOf = sid => ((((docOf('11501-progress/' + sid) || {}).modules || {}).thinking || {}).shots) || {};
r = shot('A', 3, png(1));
ok(r.ok && r.url, 'A 交第 3 關的截圖', r.url);
let s3 = shotsOf(STU.A)['3'];
ok(s3 && s3.hash && s3.fileId && s3.title === '滑梯公園' && s3.size === 208, '★★ 連結、指紋、大小寫進 modules.thinking.shots');
const f3 = drive.files[s3.fileId];
ok(drive.pathOf(f3.parent) === '11501/thinking/801' && f3.name === '80101_學生A_' + STU.A + '_第03關.png', '★★ 存在 {TERM}/thinking/{班級}，檔名有班級座號姓名學號關卡', drive.pathOf(f3.parent) + '/' + f3.name);
const nFiles = Object.keys(drive.files).length;
r = shot('A', 3, png(1));
ok(r.ok && r.same && Object.keys(drive.files).length === nFiles, '★ 同一張重傳 ⇒ 不再存一份');
r = shot('A', 3, png(2));
const s3b = shotsOf(STU.A)['3'];
ok(r.ok && s3b.fileId !== s3.fileId && drive.files[s3.fileId].trashed && !drive.files[s3b.fileId].trashed, '★★ 換一張 ⇒ 舊的丟進垃圾桶');
r = shot('B', 3, png(2));
ok(r.ok && shotsOf(STU.B)['3'].hash === s3b.hash, '★★ B 交 A 的同一張圖 ⇒ 指紋一樣（後台比得出來）');
const folders801 = Object.values(drive.folders).filter(f => f.name === '801').length;
ok(folders801 === 1, '★ 同一班只建一個資料夾', folders801 + ' 個');
r = shot('A', 11, png(3));
ok(!r.ok, '不認得的關卡（11）⇒ 拒絕', r.message);
r = shot('A', 4, png(3), 'image/gif');
ok(!r.ok && /PNG/.test(r.message), '不是 PNG／JPG／WebP ⇒ 拒絕', r.message);
r = shot('A', 4, Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64'));
ok(!r.ok && /太大/.test(r.message), '超過 8 MB ⇒ 拒絕', r.message);
r = post({ kind: 'shot', idToken: T, challenge: 3, mime: 'image/png', b64: png(1) });
ok(!r.ok, '老師帳號不收', r.message);
r = post({ kind: 'shot', idToken: 'bad', challenge: 3, mime: 'image/png', b64: png(1) });
ok(!r.ok && /登入/.test(r.message), '★ 沒登入 ⇒ 拒絕');

const env2 = makeFakeGas({});
env2.seed('roster/' + STU.A, { cls: '801', no: 1, name: '學生A' });
r = env2.post({ kind: 'shot', idToken: env2.login(STU.A + '@' + env2.DOMAIN), challenge: 3, mime: 'image/png', b64: png(1) });
ok(!r.ok && r.skipped, '★★ 沒設 DRIVE_FOLDER_ID ⇒ 回 skipped（學生頁之後就不再送）', r.message);

console.log(fail ? `\n❌ ${fail} 項沒過（通過 ${pass} 項）` : `\n✅ 全部通過（${pass} 項）`);
process.exit(fail ? 1 : 0);
