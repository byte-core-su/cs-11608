/* =====================================================================
   假的 Apps Script（給 node 測試用）：Firestore（REST）、Firebase 登入查詢、快取、鎖、時間、
   雲端硬碟、Utilities 都是假的，存在記憶體 ⇒ 整支 grader.gs 從 doPost 一路測到寫進資料庫。
   用法：const env = require('./fakegas')({ DRIVE_FOLDER_ID: 'root' });
         env.post({ kind, idToken, … })、env.login(email)、env.docOf(路徑)、env.seed(路徑, 物件)
         env.clock（可加減）、env.beforeCommit（下一次寫入前先做的事）、env.commits、env.drive
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), zlib = require('zlib');

const signed = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));
function blob(buf, type, name) {
  return { buf, getBytes: () => signed(buf), getDataAsString: () => buf.toString('utf8'), getName: () => name, getContentType: () => type };
}
/** 最小的 zip 讀取（stored／deflate） */
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip');
  let p = buf.readUInt32LE(eocd + 16); const n = buf.readUInt16LE(eocd + 10), out = [];
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ln = buf.readUInt16LE(off + 26), lx = buf.readUInt16LE(off + 28);
    const raw = buf.subarray(off + 30 + ln + lx, off + 30 + ln + lx + csize);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

module.exports = function makeFakeGas(props, extra) {
props = props || {};

/* ── 假的雲端硬碟 ── */
const drive = { folders: {}, files: {}, n: 0 };
function folderObj(id) {
  const f = drive.folders[id]; if (!f) throw new Error('沒有這個資料夾：' + id);
  return {
    getId: () => id, getName: () => f.name,
    getFoldersByName: name => { const hit = Object.keys(drive.folders).filter(k => drive.folders[k].parent === id && drive.folders[k].name === name);
      let i = 0; return { hasNext: () => i < hit.length, next: () => folderObj(hit[i++]) }; },
    createFolder: name => { const nid = 'fold' + (++drive.n); drive.folders[nid] = { name, parent: id }; return folderObj(nid); },
    createFile: b => { const nid = 'file' + (++drive.n); drive.files[nid] = { name: b.getName(), parent: id, bytes: b.buf, type: b.getContentType(), trashed: false };
      return { getId: () => nid, getUrl: () => 'https://drive.google.com/file/d/' + nid + '/view' }; }
  };
}
if (props.DRIVE_FOLDER_ID) drive.folders[props.DRIVE_FOLDER_ID] = { name: '根', parent: null };
const DriveApp = {
  getFolderById: folderObj,
  getFileById: id => { const f = drive.files[id]; if (!f) throw new Error('沒有這個檔案'); return { setTrashed: v => { f.trashed = !!v; } }; }
};
/** 資料夾的完整路徑（測試用）：'11501/thinking/801' */
drive.pathOf = id => { const parts = []; let f = drive.folders[id]; while (f && f.parent) { parts.unshift(f.name); f = drive.folders[f.parent]; } return parts.join('/'); };

/* ── 假的 Firestore（REST）──────────────────────────────────────────── */
const PROJECT = 'demo-proj';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
const DB = {};                       // path → { fields(Firestore 格式), updateTime }
let tick = 0, beforeCommit = null, commits = 0;
const enc = v => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const f = {}; Object.keys(v).forEach(k => { f[k] = enc(v[k]); }); return { mapValue: { fields: f } };
};
const dec = v => {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = dec(x); }); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  return null;
};
const docOf = p => { const d = DB[p]; if (!d) return null; const o = {}; Object.entries(d.fields).forEach(([k, x]) => { o[k] = dec(x); }); return o; };
const seed = (p, obj) => { DB[p] = { fields: enc(obj).mapValue.fields, updateTime: 't' + (++tick) }; };
function splitPath(fp) {                       // a.`2-1-1A`.b → ['a','2-1-1A','b']
  const out = []; let cur = '', q = false;
  for (const ch of fp) {
    if (ch === '`') { q = !q; continue; }
    if (ch === '.' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur); return out;
}
function getAt(fields, parts) {
  let f = fields;
  for (let i = 0; i < parts.length; i++) {
    const v = f && f[parts[i]];
    if (!v) return undefined;
    if (i === parts.length - 1) return v;
    f = v.mapValue && v.mapValue.fields;
  }
}
function setAt(fields, parts, val) {
  let f = fields;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!f[parts[i]] || !f[parts[i]].mapValue) f[parts[i]] = { mapValue: { fields: {} } };
    f = f[parts[i]].mapValue.fields = f[parts[i]].mapValue.fields || {};
  }
  if (val === undefined) delete f[parts[parts.length - 1]]; else f[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
}
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });

function firestore(url, opt) {
  const u = new URL(url.replace('(default)', 'DEFAULT'));
  const rest = decodeURIComponent(u.pathname).replace('/v1/projects/' + PROJECT + '/databases/DEFAULT/documents', '');
  if (rest === ':commit') {
    commits++;
    if (beforeCommit) { const f = beforeCommit; beforeCommit = null; f(); }
    const body = JSON.parse(opt.payload);
    for (const w of body.writes) {
      const p = w.update.name.split('/documents/')[1];
      const cur = DB[p];
      const pre = w.currentDocument;
      if (pre && pre.exists === false && cur) return resp(409, { error: { status: 'ALREADY_EXISTS' } });
      if (pre && pre.updateTime && (!cur || cur.updateTime !== pre.updateTime)) return resp(400, { error: { status: 'FAILED_PRECONDITION' } });
    }
    for (const w of body.writes) {
      const p = w.update.name.split('/documents/')[1];
      const d = DB[p] || { fields: {} };
      (w.updateMask ? w.updateMask.fieldPaths : Object.keys(w.update.fields)).forEach(fp => {
        const parts = splitPath(fp); setAt(d.fields, parts, getAt(w.update.fields, parts));
      });
      (w.updateTransforms || []).forEach(t => {
        const parts = splitPath(t.fieldPath), cur = getAt(d.fields, parts);
        const vals = ((cur && cur.arrayValue && cur.arrayValue.values) || []).concat(t.appendMissingElements.values);
        setAt(d.fields, parts, { arrayValue: { values: vals } });
      });
      d.updateTime = 't' + (++tick);
      DB[p] = d;
    }
    return resp(200, {});
  }
  const segs = rest.replace(/^\//, '').split('/');
  if (segs.length % 2 === 0) {                     // 一份文件
    const p = segs.join('/'), d = DB[p];
    return d ? resp(200, { name: 'x/documents/' + p, fields: d.fields, updateTime: d.updateTime }) : resp(404, {});
  }
  const col = segs.join('/');                      // 整個集合
  const docs = Object.keys(DB).filter(k => k.startsWith(col + '/') && k.split('/').length === segs.length + 1).sort()
    .map(k => ({ name: 'x/documents/' + k, fields: DB[k].fields, updateTime: DB[k].updateTime }));
  return resp(200, { documents: docs });
}

/* ── 假的 Firebase 登入（idToken → email）── */
const TOKENS = {};
const DOMAIN = 'students.' + PROJECT + '.firebaseapp.com';
function login(email) { const t = 'tok_' + crypto.randomBytes(6).toString('hex'); TOKENS[t] = email; return t; }

/* ── 假的 Apps Script ── */
let clock = Date.UTC(2026, 9, 23, 1, 0, 0);       // 台灣時間 2026-10-23 09:00
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(clock); }
  static now() { return clock; }
}
const cacheStore = {};
const ctx = {
  module: { exports: {} }, console, JSON, Math, Date: FakeDate,
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({ PROJECT_ID: PROJECT, API_KEY: 'k', TEACHER_EMAIL: 'teacher@school.tw', TERM: '11501' }, props) }) },
  CacheService: { getScriptCache: () => ({
    get: k => (k in cacheStore ? cacheStore[k] : null),
    put: (k, v) => { if (String(v).length > 100000) throw new Error('too big'); cacheStore[k] = String(v); },
    remove: k => { delete cacheStore[k]; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  ScriptApp: { getOAuthToken: () => 'oauth' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).forEach(x => { p[x.type] = x.value; });
      return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
    },
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, x) => signed(crypto.createHash(alg).update(Array.isArray(x) ? Buffer.from(x.map(b => b & 255)) : Buffer.from(String(x), 'utf8')).digest()),
    base64Encode: x => (Array.isArray(x) ? Buffer.from(x.map(b => b & 255)) : Buffer.from(String(x), 'utf8')).toString('base64'),
    base64Decode: s => { if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw new Error('bad base64'); return signed(Buffer.from(s, 'base64')); },
    newBlob: (bytes, type, name) => blob(Buffer.from((bytes || []).map(b => b & 255)), type, name),
    unzip: b => unzip(b.buf).map(f => blob(f.data, '', f.name))
  },
  DriveApp,
  UrlFetchApp: { fetch(url, opt) {
    if (url.indexOf('identitytoolkit') >= 0) {
      const e = TOKENS[JSON.parse(opt.payload).idToken];
      return e ? resp(200, { users: [{ email: e }] }) : resp(400, {});
    }
    if (url.indexOf('firestore.googleapis.com') >= 0) return firestore(url, opt || {});
    throw new Error('沒有假的：' + url);
  } }
};
Object.assign(ctx, extra || {});
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'grader.gs'), 'utf8'), ctx, { filename: 'grader.gs' });
const G = ctx.module.exports;
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);


const env = { G, ctx, post, DB, docOf, seed, login, DOMAIN, PROJECT, drive, cacheStore };
Object.defineProperty(env, 'clock', { get: () => clock, set: v => { clock = v; } });
Object.defineProperty(env, 'beforeCommit', { get: () => beforeCommit, set: v => { beforeCommit = v; } });
Object.defineProperty(env, 'commits', { get: () => commits });
return env;
};
module.exports.unzip = unzip;

/** 讀網站的設定（給測試用）：根目錄 config.js ＋ {學期}/config.js，回傳合在一起的 CONFIG（沒有凍結） */
module.exports.loadTerm = function (root, term) {
  const W = {};
  new Function('window', fs.readFileSync(path.join(root, 'config.js'), 'utf8'))(W);
  let out = null;
  W.defineTerm = d => { out = Object.assign({}, W.SITE, d); };
  new Function('window', 'defineTerm', fs.readFileSync(path.join(root, term, 'config.js'), 'utf8'))(W, W.defineTerm);
  return out;
};
/** 網站有哪幾個學期（根目錄 config.js 的 SITE.TERMS） */
module.exports.terms = function (root) {
  const W = {};
  new Function('window', fs.readFileSync(path.join(root, 'config.js'), 'utf8'))(W);
  return (W.SITE.TERMS || []).map(t => t.id);
};
