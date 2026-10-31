/* =====================================================================
   grader.gs 的比對核心測試：node gas/test.js
   ---------------------------------------------------------------------
   預設用 gas/demo/ 的「示範關卡：購物清單小幫手」—— 和課程任何一關都無關，
   專門給測試用，公開也不會洩漏答案。
   ⚠️ 課程各關的解答 .sb3 **不可以放在網站裡**（網站是公開的，學生下載解答原封不動交上來就是 3⭐）。
      想拿自己的某一關來測：node gas/test.js <網站以外的資料夾> [關卡代號，預設 01_]
      資料夾裡放檔名含「關卡代號」與「解答」「空白」的兩個 .sb3。
   拿「解答」「空白」兩個 .sb3：
     解答 → 100 分 3⭐　空白 → 0 分 0⭐
     改了設定值（換名字、換按鍵）→ 2⭐　整種積木沒用到 → 2⭐ 並說出缺什麼
     積木放錯地方 → 2⭐（「位置」那一層扣分）
   不需要安裝任何套件（.sb3 用 node 內建的 zlib 解開）。
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');

const ctx = { module: { exports: {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'grader.gs'), 'utf8'), ctx, { filename: 'grader.gs' });
const G = ctx.module.exports;

/* 最小的 zip 讀取：只找 project.json */
function projectJson(file) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (name === 'project.json') {
      const ln = buf.readUInt16LE(off + 26), lx = buf.readUInt16LE(off + 28);
      const data = buf.subarray(off + 30 + ln + lx, off + 30 + ln + lx + csize);
      return JSON.parse((method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8'));
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error('no project.json in ' + file);
}

const dir = process.argv[2] || path.join(__dirname, 'demo');
const tag = process.argv[2] ? (process.argv[3] || '01_') : '示範關卡_';
const pick = which => {
  const f = fs.existsSync(dir) && fs.readdirSync(dir).find(n => n.includes(tag) && n.endsWith(which + '.sb3'));
  if (!f) { console.error('❌ ' + dir + ' 裡找不到檔名含「' + tag + '」的' + which + ' .sb3'); process.exit(1); }
  return path.join(dir, f);
};
const answer = projectJson(pick('解答'));
const blank = projectJson(pick('空白'));
const EX = G.projectToPseudo(answer), TP = G.projectToPseudo(blank);

let fail = 0;
function check(name, cond, info) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (info ? '　' + info : ''));
  if (!cond) fail++;
}
const clone = o => JSON.parse(JSON.stringify(o));
const sprite = (p, name) => p.targets.find(t => t.name === name);
const blocksOf = (p, op) => { const out = []; p.targets.forEach(t => Object.entries(t.blocks || {}).forEach(([id, b]) => { if (b && b.opcode === op) out.push([t, id, b]); })); return out; };
const grade = p => G.gradeSubmission(EX, TP, G.projectToPseudo(p));
const show = r => `${r.score} 分 ${r.stars}⭐（積木 ${r.levels.block}%／位置 ${r.levels.place}%／設定值 ${r.levels.value}%）${r.message}`;

console.log(path.basename(pick('解答')) + '：解答比空白多出 ' + G.gradeSubmission(EX, TP, '').need + ' 塊積木\n');

let r = grade(answer);
check('交解答 → 100 分 3⭐', r.score === 100 && r.stars === 3, show(r));

r = grade(blank);
check('交空白 → 0 分 0⭐', r.score === 0 && r.stars === 0, show(r));

/* 換掉清單裡的名字（ITEM）—— 積木和位置都對，只有設定值不同 */
let p = clone(answer);
blocksOf(p, 'data_addtolist').forEach(([t, id, b]) => { if (b.inputs.ITEM) b.inputs.ITEM[1][1] = '學生' + id.slice(0, 3); });
r = grade(p);
check('名字全部換掉 → 2⭐（積木、位置滿分）', r.stars === 2 && r.levels.block === 100 && r.levels.place === 100, show(r));

/* 少一塊「插入」 */
p = clone(answer);
blocksOf(p, 'data_insertatlist').forEach(([t, id, b]) => {
  const parent = t.blocks[b.parent]; if (parent && parent.next === id) parent.next = b.next || null;
  if (b.next) t.blocks[b.next].parent = b.parent;
  delete t.blocks[id];
});
r = grade(p);
check('完全沒用到「插入」→ 2⭐，並指出缺「插入」', r.stars === 2 && r.missing.some(m => m.op === 'data_insertatlist'), show(r));

/* 把每個按鍵全部改成同一個按鍵 —— 帽子的設定值不同，影響底下所有積木的第 ③ 層 */
p = clone(answer);
blocksOf(p, 'event_whenkeypressed').forEach(([t, id, b]) => { b.fields.KEY_OPTION[0] = 'space'; });
r = grade(p);
check('按鍵全部改成空白鍵 → 2⭐（設定值扣分）', r.stars === 2 && r.levels.block === 100 && r.levels.place === 100 && r.levels.value < 100, show(r));

/* 把「替換」從按鍵底下搬到綠旗底下 —— 積木有了，位置不對 */
p = clone(answer);
{
  const [[t, id, b]] = blocksOf(p, 'data_replaceitemoflist');
  const parent = t.blocks[b.parent]; if (parent.next === id) parent.next = b.next || null;
  const [[, flagId]] = blocksOf(p, 'event_whenflagclicked').filter(([tt]) => tt === t);
  let last = flagId; while (t.blocks[last].next) last = t.blocks[last].next;
  t.blocks[last].next = id; b.parent = last; b.next = null;
}
r = grade(p);
check('「替換」搬到綠旗底下 → 2⭐（位置扣分）', r.stars === 2 && r.levels.block === 100 && r.levels.place < 100, show(r));

console.log(fail ? `\n❌ ${fail} 項沒過` : '\n✅ 全部通過');
process.exit(fail ? 1 : 0);
