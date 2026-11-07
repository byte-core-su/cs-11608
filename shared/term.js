/* =====================================================================
   現在是哪一個學期 —— 決定之後載入那一學期的設定
   ---------------------------------------------------------------------
   每個網頁都這樣開頭（course/、shared/ 底下的頁面）：
       <script src="../config.js"></script>       全站設定 window.SITE
       <script src="../shared/term.js"></script>  ← 這一支：選學期，接著載入 ../{學期}/config.js
   之後的 <script> 就拿得到 window.CONFIG（全站設定＋那一學期的設定，合在一起、凍結）。

   ★ 學期怎麼決定（前面的優先）
     ① 網址帶 ?term=11502            —— 入口、教師後台切換學期時用
     ② 這個分頁剛才選的（sessionStorage）—— 在同一個分頁裡換頁不會跑掉
     ③ 這台電腦上次選的（localStorage）
     ④ 依日期：SITE.TERMS 裡 START 在今天以前、最近的那一個（都還沒到就用第一個）
     不在 SITE.TERMS 裡的代號一律不理 —— 網址亂改只會退回 ②～④。
   ★ 選定之後記進 ② ③：之後這個分頁的每一頁都是同一學期。

   ★ 學期資料夾的 config.js 只寫那一學期自己的東西，用 defineTerm({...}) 交給這裡，
     這裡補上共用的部分（集合名稱、學號檢查…）、和全站設定合併、凍結成 window.CONFIG。

   ★ 那一學期的題庫、關卡資料：TERMSEL.include('content/social.js') 會載入 ../{學期}/content/social.js
     （要放在 config 之後、用到它的 <script> 之前，和一般的 <script src> 一樣是依序執行）。
   ===================================================================== */
(function (global) {
  'use strict';

  var SITE = global.SITE || {};
  if (SITE.SCHOOL && (!SITE.SCHOOL.NAME || SITE.SCHOOL.NAME === '○○國中')) {
    SITE.SCHOOL.NAME = '高雄市立前峰國中';
  }
  (SITE.TERMS || []).forEach(function (t) { if (t && t.id === '11501') t.short = '116-1'; if (t && t.id === '11502') t.short = '116-2'; });
  var LIST = (SITE.TERMS || []).filter(function (t) { return t && /^[\w-]{1,20}$/.test(String(t.id || '')); });
  var KEY = 'cs-term';

  /* 這一支的位置 ⇒ 網站根目錄（根目錄的頁面和 course/、shared/ 底下的頁面都用同一支） */
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var all = document.getElementsByTagName('script'); s = all[all.length - 1].src; }
    return String(s || '').replace(/shared\/term\.js(\?.*)?$/, '');
  })();

  function valid(id) { return LIST.some(function (t) { return t.id === id; }); }
  function info(id) { return LIST.filter(function (t) { return t.id === id; })[0] || null; }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** 依日期：START 在今天以前、最近的那一個；都還沒到就用第一個 */
  function byDate(today) {
    var t = ymd(today || new Date()), pick = LIST[0] ? LIST[0].id : '';
    LIST.forEach(function (x) { if (x.START && String(x.START) <= t) pick = x.id; });
    return pick;
  }
  function read(store) { try { return global[store].getItem(KEY) || ''; } catch (e) { return ''; } }
  function write(id) {
    try { global.sessionStorage.setItem(KEY, id); } catch (e) {}
    try { global.localStorage.setItem(KEY, id); } catch (e) {}
  }

  var fromUrl = '';
  try { fromUrl = new URLSearchParams(global.location.search).get('term') || ''; } catch (e) {}
  var current = [fromUrl, read('sessionStorage'), read('localStorage')].filter(valid)[0] || byDate();
  if (current) write(current);

  /* 學期資料夾的 config.js 呼叫這一支 */
  global.defineTerm = function (data) {
    if (global.CONFIG) return;                       // 同一頁載入兩次：保留第一份
    var t = info(data.TERM) || { id: data.TERM, name: data.TERM, short: data.TERM };
    var cfg = {};
    Object.keys(SITE).forEach(function (k) { cfg[k] = SITE[k]; });
    Object.keys(data || {}).forEach(function (k) { cfg[k] = data[k]; });
    cfg.TERM_NAME = t.name;
    cfg.TERM_SHORT = t.short;
    cfg.TERM_START = cfg.TERM_START || t.START;
    cfg.HUB_PAGE = cfg.HUB_PAGE || 'hub.html';
    cfg.COLLECTIONS = Object.assign({
      PROGRESS: data.TERM + '-progress',
      CONFIG:   data.TERM + '-config',
      THINKING: data.TERM + '-thinking',
      ROSTER:   'roster'
    }, data.COLLECTIONS || {});
    // 學號格式檢查（所有頁面共用這一個，格式在全站設定的 SCHOOL.SID_PATTERN）
    cfg.isSid = function (v) {
      try { return new RegExp(this.SCHOOL.SID_PATTERN).test(String(v || '')); }
      catch (e) { return /^\d{7}$/.test(String(v || '')); }
    };
    // 由單元代號取得關卡編號（1 起算；找不到回 0）
    cfg.unitNo = function (id) {
      var i = (this.UNITS || []).findIndex(function (u) { return u[0] === id; });
      return i >= 0 ? i + 1 : 0;
    };
    lock(global, 'CONFIG', cfg);
  };

  /* 🔒 鎖住：判分、計星、設定都是掛在 window 上的物件，網頁是**用的當下**才去讀 ——
       在 Console 打一行把設定或判分函式換掉，之後每一題都算答對。
     ★ 作法：載入完就**凍結**（裡面的函式、數字一個都改不了），
       而且 window 上這個名字**不能再指向別的東西**。
     ⚠️ 這擋的是「網頁載入之後」才動手的（Console、書籤小工具、大部分 AI 寫的腳本）。
        搶在網頁載入**之前**就動手的（Tampermonkey 設 document-start）照樣擋不住 ——
        前端能做的只到這裡，見 shared/anskey.js 開頭。 */
  function lock(g, name, obj) {
    (function freeze(o) {
      if (!o || (typeof o !== 'object' && typeof o !== 'function') || Object.isFrozen(o)) return;
      Object.freeze(o);
      Object.getOwnPropertyNames(o).forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(o, k);
        if (d && 'value' in d) freeze(d.value);
      });
    })(obj);
    try { Object.defineProperty(g, name, { value: obj, writable: false, configurable: false, enumerable: true }); }
    catch (e) { /* 已經鎖過：保留第一份 */ }
  }

  function include(path) {
    if (!current) return;
    /* 防快取：GitHub Pages 會叫瀏覽器快取 10 分鐘，改了設定或題庫之後要等很久才看得到 ——
       這裡帶一個「每 10 分鐘換一次」的版本號，最多舊 10 分鐘（不必每次都重抓）。 */
    var v = Math.floor(Date.now() / 600000);
    document.write('<scr' + 'ipt src="' + ROOT + current + '/' + path + '?v=' + v + '"></scr' + 'ipt>');
  }

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 各學期航線的目的地群島介紹（Dodo Airlines 3D 入境登機室雙櫃台展示用，不影響任何課程教材文字） */
  var FLIGHT_ROUTES = {
    '11501': {
      counterNo: '1號櫃台',
      flightNo: 'DAL-1161',
      gate: 'GATE A1',
      staffName: '🦤 地勤 莫里 (Orville)',
      archipelago: '初階科技探險群島（上學期之島）',
      weather: '☀️ 晴朗微風 · 適合果園採收與木工造船',
      themeHex: 0x0284c7,
      lightHex: 0x38bdf8,
      colorBadge: 'bg-sky-600 text-white',
      btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200',
      wx: -6.8,
      wz: -2.0,
      standWx: -6.8,
      standWz: 0.85,
      orvillePitch: '歡迎來到「1號櫃台（GATE A1）」！歐拉～我是莫里！「DAL-1161 上學期航線」直飛『初階科技探險群島』，島上有資訊倫理果園、運算思維遊樂園、流程圖與 Scratch 蒸氣島、以及 5016B 智慧家居燈塔！',
      islands: [
        { icon: '⚖️', name: '資訊倫理果園島', sub: '網路禮儀、PAPA、著作權與資安（10 章節）' },
        { icon: '🧠', name: '運算思維遊樂園島', sub: '跳格子、任意門、滑梯公園等 10 座遊樂設施' },
        { icon: '🐱', name: '流程圖＆Scratch 蒸氣島', sub: '清單學習機、音階前導、流程圖與 10 關程式' },
        { icon: '💡', name: '智慧家居 5016B 科技島', sub: '感應、換算、調速、RGB 混色 5 節創客實驗' }
      ]
    },
    '11502': {
      counterNo: '2號櫃台',
      flightNo: 'DAL-1162',
      gate: 'GATE B2',
      staffName: '🦤 機長 羅德里 (Wilbur)',
      archipelago: '進階創客探險群島（下學期之島）',
      weather: '🌤️ 碧海晴空 · 適合演算法解謎與專題研發',
      themeHex: 0x059669,
      lightHex: 0x34d399,
      colorBadge: 'bg-emerald-600 text-white',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200',
      wx: 6.8,
      wz: -2.0,
      standWx: 6.8,
      standWz: 0.85,
      orvillePitch: '歡迎來到「2號櫃台（GATE B2）」！羅傑～我是羅德里機長！「DAL-1162 下學期航線」直飛『進階創客探險群島』，包含媒體與社會議題果園、二期思維樂園、Scratch 排序搜尋演算法島、與 Arduino 專題島！',
      islands: [
        { icon: '📡', name: '媒體與社會議題果園島', sub: '媒體素養、資訊失序、言論自由與演算法（10 章）' },
        { icon: '🧠', name: '運算思維二期樂園島', sub: '智慧選卡、必勝棋局、變數謎題等 10 座進階謎題' },
        { icon: '🧩', name: 'Scratch 演算法積木島', sub: '自訂函式、選擇/插入排序、循序/二元搜尋 10 關' },
        { icon: '🤖', name: 'Arduino 智慧專題科技島', sub: '五節課 PBL 專題探究、感測器與硬體互動模擬' }
      ]
    }
  };

  var threeLoadPromise = null;
  function ensureThreeLoaded() {
    if (global.THREE) return Promise.resolve(global.THREE);
    if (threeLoadPromise) return threeLoadPromise;
    threeLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.async = true;
      s.onload = function () { resolve(global.THREE); };
      s.onerror = function (e) { threeLoadPromise = null; reject(e); };
      document.head.appendChild(s);
    });
    return threeLoadPromise;
  }

  function makeFloorParquetTex(THREE) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f3e5cc';
    ctx.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var x = col * 64;
        var y = row * 64;
        ctx.fillStyle = (row + col) % 2 === 0 ? '#f6ead4' : '#ead7b7';
        ctx.fillRect(x + 2, y + 2, 60, 60);
        ctx.strokeStyle = 'rgba(180, 140, 90, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, 60, 60);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 4);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeCounterSignTex(THREE, gateText, titleText, subText, bgHexStr, accentHexStr) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    var ctx = c.getContext('2d');
    ctx.fillStyle = bgHexStr || '#0f172a';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = accentHexStr || '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 176);

    ctx.fillStyle = accentHexStr || '#38bdf8';
    ctx.fillRect(22, 24, 156, 44);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 26px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gateText, 100, 55);

    ctx.fillStyle = '#fde047';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('BOARDING', 485, 54);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, 256, 118);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 22px "Noto Sans TC", sans-serif';
    ctx.fillText(subText, 256, 158);

    var tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeMainBoardTex(THREE, schoolTitle) {
    var c = document.createElement('canvas');
    c.width = 768;
    c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 768, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 756, 244);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 16, 736, 56);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 28px "Noto Sans TC", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✈️ DODO AIRLINES · 入境登機室大廳', 32, 54);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 20px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(schoolTitle, 736, 52);

    // Row 1: 11501
    ctx.fillStyle = '#020617';
    ctx.fillRect(24, 90, 720, 64);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 26px "Noto Sans TC", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('⬅ 1號櫃台 GATE A1 | DAL-1161 | 116-1 上學期群島', 40, 131);
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'right';
    ctx.fillText('BOARDING 準點', 726, 131);

    // Row 2: 11502
    ctx.fillStyle = '#020617';
    ctx.fillRect(24, 168, 720, 64);
    ctx.fillStyle = '#34d399';
    ctx.font = '900 26px "Noto Sans TC", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('➡ 2號櫃台 GATE B2 | DAL-1162 | 116-2 下學期群島', 40, 209);
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'right';
    ctx.fillText('BOARDING 準點', 726, 209);

    var tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function buildDodoStaff3D(THREE, isCaptain, accentHex) {
    var g = new THREE.Group();
    var blueFeather = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    var bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.6 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: accentHex || 0x0369a1, roughness: 0.45 });
    var beakMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25 });

    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 1.15, 16), shirtMat);
    body.position.y = 0.95;
    g.add(body);

    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), bellyMat);
    belly.scale.set(1, 1.1, 0.45);
    belly.position.set(0, 0.92, 0.42);
    g.add(belly);

    // 領帶
    var tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.08), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }));
    tie.position.set(0, 1.05, 0.58);
    g.add(tie);

    // 雙翼（右翼揮手）
    var leftWing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.68, 10), blueFeather);
    leftWing.position.set(-0.6, 1.0, 0);
    leftWing.rotation.z = 0.3;
    g.add(leftWing);

    var rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.56, 1.24, 0);
    var rightWing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.68, 10), blueFeather);
    rightWing.position.set(0.15, 0.24, 0);
    rightWing.rotation.z = -2.35;
    rightWingPivot.add(rightWing);
    g.add(rightWingPivot);

    // 頭部與大鳥喙
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 16), blueFeather);
    head.position.y = 1.98;
    g.add(head);

    var beak = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.68, 14), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.9, 0.78);
    g.add(beak);
    var beakTip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), darkMat);
    beakTip.position.set(0, 1.9, 1.05);
    g.add(beakTip);

    // 眼睛或飛行墨鏡
    if (isCaptain) {
      [-0.24, 0.24].forEach(function (ex) {
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), darkMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(ex, 2.08, 0.58);
        g.add(lens);
      });
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), beakMat);
      bridge.position.set(0, 2.1, 0.6);
      g.add(bridge);
      // 機長帽
      var capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.28, 16), shirtMat);
      capCrown.position.y = 2.62;
      g.add(capCrown);
      var capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.45), darkMat);
      capVisor.position.set(0, 2.5, 0.42);
      g.add(capVisor);
    } else {
      [-0.23, 0.23].forEach(function (ex) {
        var eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), darkMat);
        eye.position.set(ex, 2.08, 0.57);
        g.add(eye);
      });
      // 地勤耳麥
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.05, 8, 20, Math.PI), darkMat);
      band.position.set(0, 2.0, 0);
      g.add(band);
      [-0.64, 0.64].forEach(function (mx) {
        var muff = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), darkMat);
        muff.rotation.z = Math.PI / 2;
        muff.position.set(mx, 1.98, 0);
        g.add(muff);
      });
    }

    g.userData.rightWingPivot = rightWingPivot;
    g.userData.jumpTime = 0;
    return g;
  }

  function buildCheckInCounter3D(THREE, termId, route, isLeft) {
    var group = new THREE.Group();
    var accentHex = route.themeHex || 0x0284c7;
    var lightHex = route.lightHex || 0x38bdf8;
    var bgHexStr = isLeft ? '#0c4a6e' : '#064e3b';
    var accHexStr = isLeft ? '#38bdf8' : '#34d399';

    var woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 });
    var darkWood = new THREE.MeshStandardMaterial({ color: 0x5c3616, roughness: 0.65 });
    var creamTop = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.35 });
    var accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.4 });
    var glowMat = new THREE.MeshStandardMaterial({ color: lightHex, emissive: accentHex, emissiveIntensity: 0.65 });
    var metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.25 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });

    // 1. 櫃台底部迎賓踏墊
    var matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.06, 2.4),
      new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.75 })
    );
    matMesh.position.set(0, 0.03, 1.85);
    group.add(matMesh);

    // 2. 櫃台主體桌檯（寬 5.4m，高 1.28m，深 1.35m）
    var deskBody = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.22, 1.32), woodMat);
    deskBody.position.set(0, 0.61, 0);
    group.add(deskBody);

    var frontPanel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.92, 0.08), accentMat);
    frontPanel.position.set(0, 0.61, 0.66);
    group.add(frontPanel);

    // 櫃台正面發光燈條
    var ledBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.12), glowMat);
    ledBar.position.set(0, 1.15, 0.68);
    group.add(ledBar);

    // 櫃台正面航班資訊銘牌
    var frontSignTex = makeCounterSignTex(
      THREE,
      route.gate,
      route.counterNo + ' · ' + (termId === '11501' ? '上學期' : '下學期'),
      route.archipelago,
      bgHexStr,
      accHexStr
    );
    var frontSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.05),
      new THREE.MeshBasicMaterial({ map: frontSignTex })
    );
    frontSign.position.set(0, 0.6, 0.72);
    group.add(frontSign);

    // 櫃台桌面
    var deskTop = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.14, 1.55), creamTop);
    deskTop.position.set(0, 1.28, 0.04);
    group.add(deskTop);

    // 3. 桌面設備：電腦螢幕、登機證印表機、小地球儀/雷達
    var monStand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.35, 10), darkMat);
    monStand.position.set(-1.1, 1.5, 0);
    group.add(monStand);
    var monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.08), darkMat);
    monScreen.position.set(-1.1, 1.82, 0);
    monScreen.rotation.y = 0.2;
    group.add(monScreen);
    var monGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.5), glowMat);
    monGlow.position.set(-1.09, 1.82, 0.05);
    monGlow.rotation.y = 0.2;
    group.add(monGlow);

    // 登機證出票機
    var printer = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.52), creamTop);
    printer.position.set(0.35, 1.54, 0.15);
    group.add(printer);
    var ticket = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    ticket.position.set(0.35, 1.74, 0.38);
    ticket.rotation.x = 0.35;
    group.add(ticket);

    // 桌面小飛機模型
    var miniPlane = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
    );
    miniPlane.position.set(1.55, 1.52, 0.15);
    miniPlane.rotation.y = -0.4;
    group.add(miniPlane);
    var miniWing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.72), accentMat);
    miniWing.position.set(1.55, 1.62, 0.15);
    miniWing.rotation.y = -0.4;
    group.add(miniWing);

    // 4. 側邊行李輸送帶與磅秤 + 3D 行李箱
    var sideDir = isLeft ? -1 : 1;
    var scaleBase = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 1.45), metalMat);
    scaleBase.position.set(sideDir * 3.65, 0.14, -0.05);
    group.add(scaleBase);
    var beltTop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 1.28), darkMat);
    beltTop.position.set(sideDir * 3.65, 0.31, -0.05);
    group.add(beltTop);

    // 行李箱 1 & 2
    var case1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.92, 0.46),
      new THREE.MeshStandardMaterial({ color: isLeft ? 0xf43f5e : 0xf59e0b, roughness: 0.4 })
    );
    case1.position.set(sideDir * 3.45, 0.78, -0.1);
    case1.rotation.y = 0.18;
    group.add(case1);

    var case2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.48, 0.52),
      new THREE.MeshStandardMaterial({ color: isLeft ? 0xfacc15 : 0x38bdf8, roughness: 0.4 })
    );
    case2.position.set(sideDir * 4.1, 0.56, 0.12);
    case2.rotation.y = -0.25;
    group.add(case2);

    // 5. 櫃台上方懸吊式 3D 雙柱航班燈箱與登機拱門
    [-2.35, 2.35].forEach(function (px) {
      var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 12), darkWood);
      pillar.position.set(px, 2.2, -0.45);
      group.add(pillar);
    });

    var overheadBox = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.38, 0.36), darkMat);
    overheadBox.position.set(0, 4.15, -0.45);
    group.add(overheadBox);

    var overheadFace = new THREE.Mesh(
      new THREE.PlaneGeometry(5.16, 1.18),
      new THREE.MeshBasicMaterial({ map: frontSignTex })
    );
    overheadFace.position.set(0, 4.15, -0.26);
    group.add(overheadFace);

    // 6. 排隊紅龍柱 (Queue Stanchions)
    [-2.2, 2.2].forEach(function (qx) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.92, 10), metalMat);
      post.position.set(qx, 0.46, 2.25);
      group.add(post);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 12), metalMat);
      base.position.set(qx, 0.04, 2.25);
      group.add(base);
    });

    // 7. 櫃台後方 3D Dodo 航空地勤人員 (莫里 / 羅德里)
    var dodoStaff = buildDodoStaff3D(THREE, !isLeft, accentHex);
    dodoStaff.position.set(0, 0, -1.25);
    group.add(dodoStaff);
    group.userData.dodoStaff = dodoStaff;
    group.userData.termId = termId;

    group.traverse(function (c) {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    return group;
  }

  function buildLoungePlayer3D(THREE) {
    var look = { hat: 'straw', shirt: '#0284c7', hair: '#5c3616', skin: '#ffedd5', back: 'pack' };
    try {
      var raw = global.localStorage.getItem('ac_avatar_look_v1') || global.sessionStorage.getItem('ac_avatar_look_v1');
      if (raw) Object.assign(look, JSON.parse(raw));
    } catch (e) {}

    var group = new THREE.Group();
    var skinMat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.skin || '#ffedd5'), roughness: 0.55 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.shirt || '#0284c7'), roughness: 0.6 });
    var hairMat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair || '#5c3616'), roughness: 0.65 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    var shoeMat  = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });

    var footRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.84, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    footRing.rotation.x = -Math.PI / 2;
    footRing.position.y = 0.04;
    group.add(footRing);

    var leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.55, 10), shoeMat);
    leftLeg.position.set(-0.24, 0.28, 0);
    group.add(leftLeg);
    var rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.55, 10), shoeMat);
    rightLeg.position.set(0.24, 0.28, 0);
    group.add(rightLeg);

    var hips = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.4, 14), pantsMat);
    hips.position.y = 0.72;
    group.add(hips);

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.88, 16), shirtMat);
    torso.position.y = 1.24;
    group.add(torso);

    // 隨身探險背包與拉桿登機箱
    var pack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.34), new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 }));
    pack.position.set(0, 1.25, -0.44);
    group.add(pack);

    var leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.58, 10), shirtMat);
    leftArm.position.set(-0.56, 1.28, 0);
    leftArm.rotation.z = 0.22;
    group.add(leftArm);

    var rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.58, 10), shirtMat);
    rightArm.position.set(0.56, 1.28, 0);
    rightArm.rotation.z = -0.22;
    group.add(rightArm);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 18), skinMat);
    head.position.y = 2.16;
    group.add(head);

    var hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.73, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hairBack.position.set(0, 2.2, -0.04);
    hairBack.rotation.x = -0.22;
    group.add(hairBack);

    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    [-0.24, 0.24].forEach(function (ex) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), eyeMat);
      eye.scale.set(0.95, 1.2, 0.55);
      eye.position.set(ex, 2.18, 0.64);
      group.add(eye);
    });

    // 探險草帽
    var hatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 });
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.1, 18), hatMat);
    brim.position.y = 2.6;
    group.add(brim);
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.65, 0.42, 16), hatMat);
    crown.position.y = 2.82;
    group.add(crown);

    group.traverse(function (c) {
      if (c.isMesh) c.castShadow = true;
    });
    group.userData.limbs = { leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm };
    return group;
  }

  /**
   * 在指定容器內渲染「🦤 Dodo Airlines 3D 入境登機室（雙櫃台 3D 互動場景）」
   * @param {HTMLElement} hostEl
   * @param {Object} [opts] { targetPath: 'course/hub.html', isModal: false, onClose: fn, showTeacherLink: false }
   */
  function renderAirportCounter(hostEl, opts) {
    if (!hostEl) return;
    opts = opts || {};
    if (hostEl._dalCleanup) {
      hostEl._dalCleanup();
      hostEl._dalCleanup = null;
    }

    var targetPath = opts.targetPath || 'course/hub.html';
    var schoolObj = (SITE.SCHOOL || {});
    var schoolTitle = [schoolObj.NAME, schoolObj.GRADE].filter(Boolean).join(' ') || '資訊科技探險群島';
    var byDateId = byDate();
    var activeTermId = current || byDateId || '11501';

    var closeBtnHtml = opts.isModal
      ? '<button type="button" data-dal-close class="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white border border-rose-400 text-xs font-black cursor-pointer transition shadow">✕ 留在目前島嶼 (Esc)</button>'
      : '';

    var teacherBtnHtml = opts.showTeacherLink
      ? '<a id="dal-teacher-link" href="' + escHtml(ROOT + 'course/teacher.html?term=' + encodeURIComponent(activeTermId)) + '" class="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-600 text-xs font-black transition">🛠️ 教師管理後台</a>'
      : '';

    var pinsHtml = LIST.map(function (t, idx) {
      var r = FLIGHT_ROUTES[t.id] || FLIGHT_ROUTES[idx === 0 ? '11501' : '11502'];
      var isRec = (t.id === byDateId);
      var isCur = (t.id === current && opts.isModal);
      var flagText = isCur ? '📍 目前所在群島' : (isRec ? '📅 本學期推薦' : '');
      var borderCol = idx === 0 ? '#0284c7' : '#059669';
      var bgCol = idx === 0 ? '#e0f2fe' : '#d1fae5';
      var txtCol = idx === 0 ? '#0c4a6e' : '#064e3b';
      return '<div class="ac-node" tabindex="0" role="button" data-counter-pin="' + escHtml(t.id) + '">'
        + (flagText ? '<div class="ac-node-flag ' + (isRec ? 'flag-next' : '') + '">' + escHtml(flagText) + '</div>' : '')
        + '<div class="ac-node-stars">' + escHtml(r.gate + ' · ' + r.flightNo) + '</div>'
        + '<div class="ac-node-label" style="background:' + bgCol + ';border-color:' + borderCol + ';color:' + txtCol + ';max-width:230px">'
        +   '<span class="text-[11px] bg-white/90 px-1.5 py-0.2 rounded-full border" style="border-color:' + borderCol + '">' + escHtml(r.counterNo) + '</span>'
        +   '<span>' + escHtml(t.short || t.name) + ' 登機櫃台</span>'
        + '</div>'
        + '</div>';
    }).join('');

    hostEl.innerHTML = ''
      + '<div class="dal-terminal-shell w-full max-w-[1440px] mx-auto">'
      +   '<div class="dal-departure-board flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">'
      +     '<div class="flex items-center gap-2.5 flex-wrap">'
      +       '<span class="text-2xl">✈️</span>'
      +       '<span class="dal-flap-cell text-xs sm:text-sm">DODO AIRLINES · 3D TERMINAL</span>'
      +       '<span class="text-xs sm:text-sm font-black text-sky-300 tracking-wide">' + escHtml(schoolTitle) + ' · 3D 入境登機室大廳（雙學期櫃台）</span>'
      +     '</div>'
      +     '<div class="flex items-center gap-2 flex-wrap">'
      +       '<button type="button" data-goto-counter="11501" class="px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer shadow">⬅ 1號櫃台（116-1 上學期）</button>'
      +       '<button type="button" data-goto-counter="11502" class="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer shadow">➡ 2號櫃台（116-2 下學期）</button>'
      +       '<button type="button" id="dal-cam-btn" class="px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-black transition cursor-pointer">🎥 視角：登機室全景</button>'
      +       teacherBtnHtml
      +       closeBtnHtml
      +     '</div>'
      +   '</div>'
      +   '<div class="ac-island-stage" id="dal-3d-stage" style="min-height:570px;max-height:80vh;background:linear-gradient(180deg,#38bdf8 0%,#bae6fd 50%,#fde68a 100%)">'
      +     '<canvas id="dal-3d-canvas" class="ac-webgl-canvas"></canvas>'
      +     '<div class="ac-controls-bar">'
      +       '<div class="ac-controls-hint">🎮 請用 WASD / 方向鍵控制角色走向左、右兩座 3D 登機櫃台 · 點擊櫃台或按 Enter 立即蓋章起飛！</div>'
      +     '</div>'
      +     '<div id="dal-3d-overlay" class="ac-overlay-layer">'
      +       pinsHtml
      +       '<div id="dal-player-tag" class="ac-player-tag">🧑‍🌾 島民旅客</div>'
      +     '</div>'
      +     '<div id="dal-3d-dialog" class="ac-dialog-bar hidden"></div>'
      +   '</div>'
      + '</div>';

    var stageEl   = hostEl.querySelector('#dal-3d-stage');
    var canvasEl  = hostEl.querySelector('#dal-3d-canvas');
    var dialogEl  = hostEl.querySelector('#dal-3d-dialog');
    var playerTag = hostEl.querySelector('#dal-player-tag');
    var camBtn    = hostEl.querySelector('#dal-cam-btn');
    var teacherLink = hostEl.querySelector('#dal-teacher-link');

    var state = {
      selectedTerm: activeTermId,
      dialogOpen: false,
      dismissedTerm: null,
      px: 0,
      pz: 5.8,
      tx: null,
      tz: null,
      heading: Math.PI,
      walking: false,
      keys: {},
      camMode: 'overview', // 'overview' (登機室全景可同時看兩座櫃台) | 'counter' (櫃台特寫)
      yawOffset: 0,
      zoomDist: 1.0,
      boarding: false,
      takeoffStart: 0,
      destroyed: false,
      rafId: null
    };

    var counterGroups = {};

    function selectCounter(termId, walkThere, showDialogNow) {
      if (!FLIGHT_ROUTES[termId] || state.boarding) return;
      state.selectedTerm = termId;
      var route = FLIGHT_ROUTES[termId];
      if (walkThere) {
        state.tx = route.standWx;
        state.tz = route.standWz;
        state.dismissedTerm = null;
      }
      if (showDialogNow !== undefined) {
        state.dialogOpen = !!showDialogNow;
      }
      if (teacherLink) {
        teacherLink.href = ROOT + 'course/teacher.html?term=' + encodeURIComponent(termId);
      }
      var cGroup = counterGroups[termId];
      if (cGroup && cGroup.userData.dodoStaff) {
        cGroup.userData.dodoStaff.userData.jumpTime = performance.now();
      }
      var pins = hostEl.querySelectorAll('[data-counter-pin]');
      for (var i = 0; i < pins.length; i++) {
        pins[i].classList.toggle('is-near', state.dialogOpen && pins[i].getAttribute('data-counter-pin') === termId);
      }
      renderBottomDialog();
    }

    function triggerBoarding(termId) {
      if (state.boarding) return;
      termId = termId || state.selectedTerm || '11501';
      var route = FLIGHT_ROUTES[termId] || FLIGHT_ROUTES['11501'];
      var destHref = ROOT + targetPath + (String(targetPath).indexOf('?') >= 0 ? '&' : '?') + 'term=' + encodeURIComponent(termId);

      state.boarding = true;
      state.dialogOpen = true;
      state.selectedTerm = termId;
      state.takeoffStart = performance.now();
      if (valid(termId)) write(termId);

      var cGroup = counterGroups[termId];
      if (cGroup && cGroup.userData.dodoStaff) {
        cGroup.userData.dodoStaff.userData.jumpTime = performance.now();
      }

      renderBottomDialog();

      var stamp = document.createElement('div');
      stamp.className = 'dal-stamp-seal';
      stamp.style.top = '10px';
      stamp.style.right = '24px';
      stamp.innerHTML = '🦤 DODO AIRLINES · ' + escHtml(route.gate) + '<br>准予登機 APPROVED';
      dialogEl.appendChild(stamp);

      setTimeout(function () {
        global.location.href = destHref;
      }, 920);
    }

    function renderBottomDialog() {
      if (!dialogEl) return;
      if (!state.dialogOpen && !state.boarding) {
        dialogEl.classList.add('hidden');
        return;
      }
      dialogEl.classList.remove('hidden');

      var termId = state.selectedTerm || '11501';
      var termObj = info(termId) || { id: termId, name: termId, short: termId };
      var route = FLIGHT_ROUTES[termId] || FLIGHT_ROUTES['11501'];
      var otherTermId = termId === '11501' ? '11502' : '11501';
      var otherRoute = FLIGHT_ROUTES[otherTermId];

      var islandsBadges = route.islands.map(function (isl) {
        return '<span class="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-black px-2 py-0.5 rounded-lg" title="' + escHtml(isl.sub) + '">'
          + '<span>' + isl.icon + '</span>'
          + '<span>' + escHtml(isl.name) + '</span>'
          + '</span>';
      }).join('');

      var speakerBg = termId === '11501'
        ? 'background:linear-gradient(90deg,#0284c7,#0369a1)'
        : 'background:linear-gradient(90deg,#059669,#047857)';

      dialogEl.innerHTML = ''
        + '<div class="ac-dialog-speaker" style="' + speakerBg + '">'
        +   escHtml(route.counterNo + ' · ' + route.gate + ' (' + route.flightNo + ') · ' + route.staffName)
        + '</div>'
        + '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-0.5">'
        +   '<div class="min-w-0 flex-1 text-left">'
        +     '<div class="flex items-center gap-2 flex-wrap">'
        +       '<h3 class="text-sm sm:text-base font-black text-amber-950">🏝️ ' + escHtml(termObj.name + '（' + (termObj.short || termObj.id) + '）· ' + route.archipelago) + '</h3>'
        +       (state.boarding ? '<span class="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">✈️ 螺旋槳全速起飛中…</span>' : '')
        +     '</div>'
        +     '<div class="flex items-center gap-1.5 flex-wrap mt-1.5">'
        +       '<span class="text-[11px] font-black text-stone-500">🗺️ 航線停靠：</span>'
        +       islandsBadges
        +     '</div>'
        +   '</div>'
        +   '<div class="flex items-center gap-2 flex-wrap shrink-0">'
        +     '<button type="button" data-close-dialog="1" class="px-2.5 py-1.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-700 font-black text-xs cursor-pointer transition" title="收起櫃台資訊，欣賞 3D 登機室 (Esc)">✕ 收起 (Esc)</button>'
        +     '<button type="button" data-switch-other="' + escHtml(otherTermId) + '" class="ac-btn-secondary text-xs cursor-pointer">'
        +       '🚶 走向' + escHtml(otherRoute.counterNo)
        +     '</button>'
        +     '<button type="button" data-board-now="' + escHtml(termId) + '" class="px-4 py-2 rounded-2xl font-black text-xs sm:text-sm cursor-pointer transition transform active:scale-95 ' + route.btnClass + '">'
        +       (state.boarding ? '✈️ 水上飛機起飛中…' : ('✈️ 辦理登機・飛往 ' + escHtml(termObj.short || termObj.id) + ' 群島 →'))
        +     '</button>'
        +   '</div>'
        + '</div>';
    }

    renderBottomDialog();

    var closeBtn = hostEl.querySelector('[data-dal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (hostEl._dalCleanup) hostEl._dalCleanup();
        if (typeof opts.onClose === 'function') opts.onClose();
      });
    }

    hostEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-dialog]')) {
        state.dialogOpen = false;
        state.dismissedTerm = state.selectedTerm;
        renderBottomDialog();
        return;
      }
      var gotoBtn = e.target.closest('[data-goto-counter]');
      if (gotoBtn) {
        selectCounter(gotoBtn.getAttribute('data-goto-counter'), true, true);
        return;
      }
      var pinEl = e.target.closest('[data-counter-pin]');
      if (pinEl) {
        selectCounter(pinEl.getAttribute('data-counter-pin'), true, true);
        return;
      }
      var swBtn = e.target.closest('[data-switch-other]');
      if (swBtn) {
        selectCounter(swBtn.getAttribute('data-switch-other'), true, true);
        return;
      }
      var boardBtn = e.target.closest('[data-board-now]');
      if (boardBtn) {
        triggerBoarding(boardBtn.getAttribute('data-board-now'));
      }
    });

    if (camBtn) {
      camBtn.addEventListener('click', function () {
        state.camMode = state.camMode === 'overview' ? 'counter' : 'overview';
        state.yawOffset = 0;
        camBtn.textContent = state.camMode === 'overview'
          ? '🎥 視角：登機室全景'
          : '🎥 視角：櫃台跟隨特寫';
      });
    }

    var cleanupThree = null;
    ensureThreeLoaded().then(function (THREE) {
      if (state.destroyed || !canvasEl.isConnected) return;

      var renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      if (THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
      }

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0x7dd3fc);
      scene.fog = new THREE.FogExp2(0xbae6fd, 0.0085);

      var camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 180);

      var hemiLight = new THREE.HemisphereLight(0xffffff, 0xfef3c7, 0.85);
      hemiLight.position.set(0, 40, 0);
      scene.add(hemiLight);

      var dirLight = new THREE.DirectionalLight(0xfffbeb, 1.05);
      dirLight.position.set(16, 34, 24);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      var sd = 24;
      dirLight.shadow.camera.left = -sd;
      dirLight.shadow.camera.right = sd;
      dirLight.shadow.camera.top = sd;
      dirLight.shadow.camera.bottom = -sd;
      dirLight.shadow.bias = -0.0005;
      scene.add(dirLight);

      var worldGroup = new THREE.Group();
      scene.add(worldGroup);

      // ── 1. 窗外碧海、遠方雙學期群島與水上飛機停機坪 ──
      var seaMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 100),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25, metalness: 0.1 })
      );
      seaMesh.rotation.x = -Math.PI / 2;
      seaMesh.position.set(0, -0.65, -35);
      worldGroup.add(seaMesh);

      // 左遠方：115-1 初階群島山巒
      var islLeft = new THREE.Mesh(
        new THREE.ConeGeometry(8.5, 6.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 })
      );
      islLeft.position.set(-16, 2.2, -26);
      worldGroup.add(islLeft);

      // 右遠方：115-2 進階群島山巒
      var islRight = new THREE.Mesh(
        new THREE.ConeGeometry(9.2, 6.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.7 })
      );
      islRight.position.set(16, 2.5, -26);
      worldGroup.add(islRight);

      // 戶外木造登機碼頭
      var pierWood = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });
      var pierDeck = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.35, 8.5), pierWood);
      pierDeck.position.set(0, -0.1, -10.5);
      worldGroup.add(pierDeck);

      // 3D Dodo 水上飛機（停泊於觀景窗正後方海面）
      var planeGroup = new THREE.Group();
      planeGroup.position.set(0, 0.55, -15.2);
      var yellowBodyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.32 });
      var blueTrimMat   = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 });
      var darkMetalMat  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.6 });

      // 雙浮筒
      [-1.35, 1.35].forEach(function (fz) {
        var pontoon = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 0.68), blueTrimMat);
        pontoon.position.set(0, -0.85, fz);
        planeGroup.add(pontoon);
        var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), darkMetalMat);
        strut.position.set(0, -0.3, fz * 0.7);
        planeGroup.add(strut);
      });
      // 機身、機翼、尾翼与螺旋槳
      var fuselage = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.65, 1.75), yellowBodyMat);
      fuselage.position.y = 0.45;
      planeGroup.add(fuselage);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.35, 1.8), blueTrimMat);
      stripe.position.y = 0.35;
      planeGroup.add(stripe);
      var topWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 9.2), blueTrimMat);
      topWing.position.set(0.2, 1.45, 0);
      planeGroup.add(topWing);
      var tailFin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.45, 0.24), blueTrimMat);
      tailFin.position.set(-2.35, 1.35, 0);
      planeGroup.add(tailFin);
      var propSpinner = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      propSpinner.rotation.z = -Math.PI / 2;
      propSpinner.position.set(3.05, 0.45, 0);
      planeGroup.add(propSpinner);
      var propBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.26), darkMetalMat);
      propBlade.position.set(3.15, 0.45, 0);
      planeGroup.add(propBlade);
      worldGroup.add(planeGroup);

      // ── 2. 3D 登機室室內木質地板、迎賓分流跑道地毯與全景落地窗牆 ──
      var floorTex = makeFloorParquetTex(THREE);
      var floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(28.5, 0.4, 17.5),
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 })
      );
      floorMesh.position.set(0, -0.2, 1.5);
      floorMesh.receiveShadow = true;
      worldGroup.add(floorMesh);

      // 中央入境迎賓主地毯（由南門 z=9.2 通往中央羅盤 z=3.2）
      var mainCarpet = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.04, 6.4),
        new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.75 })
      );
      mainCarpet.position.set(0, 0.02, 6.2);
      mainCarpet.receiveShadow = true;
      worldGroup.add(mainCarpet);

      // 中央黃金羅盤圓章
      var compassDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.1, 0.05, 32),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 })
      );
      compassDisc.position.set(0, 0.03, 3.2);
      worldGroup.add(compassDisc);
      var compassInner = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 0.06, 28),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
      );
      compassInner.position.set(0, 0.035, 3.2);
      worldGroup.add(compassInner);

      // 左分流地毯（通往 1號櫃台 115-1 上學期）
      var leftRunner = new THREE.Mesh(
        new THREE.BoxGeometry(7.8, 0.04, 2.1),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.75 })
      );
      leftRunner.position.set(-3.6, 0.02, 2.0);
      leftRunner.rotation.y = -0.26;
      worldGroup.add(leftRunner);

      // 右分流地毯（通往 2號櫃台 115-2 下學期）
      var rightRunner = new THREE.Mesh(
        new THREE.BoxGeometry(7.8, 0.04, 2.1),
        new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.75 })
      );
      rightRunner.position.set(3.6, 0.02, 2.0);
      rightRunner.rotation.y = 0.26;
      worldGroup.add(rightRunner);

      // 北側全景落地窗框與中央大型航班看板
      var frameWood = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
      var wallCream = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 });
      var glassMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.24,
        roughness: 0.1,
        metalness: 0.2
      });

      // 後牆矮牆基座與頂樑
      var backLowWall = new THREE.Mesh(new THREE.BoxGeometry(28.5, 1.1, 0.45), wallCream);
      backLowWall.position.set(0, 0.55, -6.8);
      worldGroup.add(backLowWall);

      var topBeam = new THREE.Mesh(new THREE.BoxGeometry(28.5, 0.65, 0.65), frameWood);
      topBeam.position.set(0, 7.1, -6.8);
      worldGroup.add(topBeam);

      // 全景透明玻璃窗
      var bigGlass = new THREE.Mesh(new THREE.PlaneGeometry(27.6, 5.8), glassMat);
      bigGlass.position.set(0, 4.0, -6.8);
      worldGroup.add(bigGlass);

      [-13.8, -3.5, 3.5, 13.8].forEach(function (px) {
        var col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.2, 0.55), frameWood);
        col.position.set(px, 3.6, -6.8);
        worldGroup.add(col);
      });

      // 中央巨型 3D 翻頁航班資訊看板
      var mainBoardTex = makeMainBoardTex(THREE, schoolTitle);
      var boardBack = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
      boardBack.position.set(0, 5.25, -6.45);
      worldGroup.add(boardBack);
      var boardFace = new THREE.Mesh(
        new THREE.PlaneGeometry(6.95, 2.3),
        new THREE.MeshBasicMaterial({ map: mainBoardTex })
      );
      boardFace.position.set(0, 5.25, -6.26);
      worldGroup.add(boardFace);

      // ── 3. 建立左、右兩座 3D 登機櫃台 (1號櫃台 11501 / 2號櫃台 11502) ──
      var interactiveMeshes = [];
      ['11501', '11502'].forEach(function (tid, idx) {
        var r = FLIGHT_ROUTES[tid];
        var cGroup = buildCheckInCounter3D(THREE, tid, r, idx === 0);
        cGroup.position.set(r.wx, 0, r.wz);
        worldGroup.add(cGroup);
        counterGroups[tid] = cGroup;
        interactiveMeshes.push(cGroup);
      });

      // ── 4. 登機室候機排椅與熱帶觀葉盆栽 ──
      [-10.8, 10.8].forEach(function (bx, idx) {
        var benchGroup = new THREE.Group();
        var seatCol = idx === 0 ? 0x0284c7 : 0x059669;
        var seatMat = new THREE.MeshStandardMaterial({ color: seatCol, roughness: 0.45 });
        var seatBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.38, 1.1), seatMat);
        seatBase.position.y = 0.52;
        benchGroup.add(seatBase);
        var seatBack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.25), seatMat);
        seatBack.position.set(0, 0.98, 0.45);
        benchGroup.add(seatBack);
        benchGroup.position.set(bx, 0, 5.4);
        benchGroup.rotation.y = idx === 0 ? 0.35 : -0.35;
        worldGroup.add(benchGroup);
      });

      // 室內四角椰子樹盆栽
      [[-12.5, -5.2], [12.5, -5.2], [-12.5, 7.6], [12.5, 7.6]].forEach(function (pt) {
        var potGroup = new THREE.Group();
        var pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.42, 0.85, 12),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
        );
        pot.position.y = 0.42;
        potGroup.add(pot);
        var trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.24, 2.4, 10),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
        );
        trunk.position.y = 1.6;
        potGroup.add(trunk);
        var crown = new THREE.Mesh(
          new THREE.SphereGeometry(1.05, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 })
        );
        crown.scale.set(1.25, 0.7, 1.25);
        crown.position.y = 2.95;
        potGroup.add(crown);
        potGroup.position.set(pt[0], 0, pt[1]);
        worldGroup.add(potGroup);
      });

      // ── 5. 3D 島民旅客角色 ──
      var playerMesh = buildLoungePlayer3D(THREE);
      playerMesh.position.set(state.px, 0, state.pz);
      playerMesh.rotation.y = state.heading;
      worldGroup.add(playerMesh);

      // ── 6. 滑鼠點擊與鍵盤控制 ──
      var raycaster = new THREE.Raycaster();
      var mouseNDC = new THREE.Vector2();
      var dragState = { active: false, moved: false, startX: 0, startYaw: 0 };

      function onPointerDown(e) {
        if (e.target.closest('#dal-3d-dialog') || e.target.closest('.ac-node')) return;
        dragState.active = true;
        dragState.moved = false;
        dragState.startX = e.clientX;
        dragState.startYaw = state.yawOffset;
      }

      function onPointerMove(e) {
        if (!dragState.active) return;
        var dx = e.clientX - dragState.startX;
        if (Math.abs(dx) > 6) {
          dragState.moved = true;
          state.yawOffset = Math.max(-0.45, Math.min(0.45, dragState.startYaw - dx * 0.004));
        }
      }

      function onPointerUp(e) {
        if (!dragState.active) return;
        dragState.active = false;
        if (dragState.moved || state.boarding) return;

        var rect = canvasEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNDC, camera);

        var hits = raycaster.intersectObjects(interactiveMeshes, true);
        if (hits.length > 0) {
          var obj = hits[0].object;
          while (obj && obj.parent && !obj.userData.termId) {
            obj = obj.parent;
          }
          if (obj && obj.userData.termId) {
            selectCounter(obj.userData.termId, true, true);
            return;
          }
        }

        // 點擊地板時走向該位置並自動收起櫃台解說框，避免擋住主畫面
        var floorHits = raycaster.intersectObject(floorMesh, false);
        if (floorHits.length > 0) {
          var pt = floorHits[0].point;
          state.tx = Math.max(-11.5, Math.min(11.5, pt.x));
          state.tz = Math.max(0.2, Math.min(8.2, pt.z));
          if (state.dialogOpen) {
            state.dialogOpen = false;
            renderBottomDialog();
          }
        }
      }

      function onKeyDown(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.code === 'Escape' || e.key === 'Escape') { e.preventDefault(); if (state.dialogOpen) { state.dialogOpen = false; state.dismissedTerm = state.selectedTerm; renderBottomDialog(); } else if (opts.isModal && typeof opts.onClose === 'function') { if (hostEl._dalCleanup) hostEl._dalCleanup(); opts.onClose(); } return; }
        if (e.code === 'Escape' && state.dialogOpen) {
          state.dialogOpen = false;
          state.dismissedTerm = state.selectedTerm;
          renderBottomDialog();
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(e.code) >= 0) {
          state.keys[e.code] = true;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
        } else if ((e.code === 'Enter' || e.code === 'Space') && state.dialogOpen) {
          e.preventDefault();
          triggerBoarding(state.selectedTerm);
        }
      }

      function onKeyUp(e) { delete state.keys[e.code]; }

      function resizeRenderer() {
        if (!stageEl) return;
        var w = stageEl.clientWidth || 960;
        var h = stageEl.clientHeight || 570;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resizeRenderer();
      global.addEventListener('resize', resizeRenderer);
      canvasEl.addEventListener('pointerdown', onPointerDown);
      global.addEventListener('pointermove', onPointerMove);
      global.addEventListener('pointerup', onPointerUp);
      global.addEventListener('keydown', onKeyDown);
      global.addEventListener('keyup', onKeyUp);

      var projVec = new THREE.Vector3();
      function projectToScreen(wx, wy, wz) {
        projVec.set(wx, wy, wz);
        projVec.project(camera);
        var w = stageEl.clientWidth || 960;
        var h = stageEl.clientHeight || 570;
        return {
          x: (projVec.x * 0.5 + 0.5) * w,
          y: (-projVec.y * 0.5 + 0.5) * h
        };
      }

      var camPos = new THREE.Vector3(0, 12.5, 19.5);
      var camLook = new THREE.Vector3(0, 2.0, -1.5);

      function animate(now) {
        if (state.destroyed) return;
        var tSec = now * 0.001;

        var vx = 0, vz = 0;
        if (!state.boarding) {
          if (state.keys.ArrowLeft  || state.keys.KeyA) vx -= 1;
          if (state.keys.ArrowRight || state.keys.KeyD) vx += 1;
          if (state.keys.ArrowUp    || state.keys.KeyW) vz -= 1;
          if (state.keys.ArrowDown  || state.keys.KeyS) vz += 1;
        }

        var speed = 0.16;
        if (vx !== 0 || vz !== 0) {
          state.tx = null;
          state.tz = null;
          var len = Math.sqrt(vx * vx + vz * vz);
          var nx = vx / len, nz = vz / len;
          state.px += nx * speed;
          state.pz += nz * speed;
          state.heading = Math.atan2(nx, nz);
          state.walking = true;
        } else if (state.tx !== null && state.tz !== null) {
          var dx = state.tx - state.px;
          var dz = state.tz - state.pz;
          var dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.22) {
            state.px = state.tx;
            state.pz = state.tz;
            state.tx = null;
            state.tz = null;
            state.walking = false;
            state.heading = Math.PI; // 面向北側櫃台
          } else {
            state.px += (dx / dist) * speed;
            state.pz += (dz / dist) * speed;
            state.heading = Math.atan2(dx, dz);
            state.walking = true;
          }
        } else {
          state.walking = false;
        }

        // 室內邊界與櫃台碰撞約束（不能穿過櫃台與北牆）
        state.px = Math.max(-11.8, Math.min(11.8, state.px));
        state.pz = Math.max(0.25, Math.min(8.4, state.pz));

        // 只有當角色真正走近左、右櫃台時才顯示底部解說框；離開櫃台範圍即自動收起，不遮擋主畫面！
        if (!state.boarding) {
          var d1 = Math.hypot(state.px - FLIGHT_ROUTES['11501'].standWx, state.pz - FLIGHT_ROUTES['11501'].standWz);
          var d2 = Math.hypot(state.px - FLIGHT_ROUTES['11502'].standWx, state.pz - FLIGHT_ROUTES['11502'].standWz);
          if (d1 < 2.4) {
            if (state.dismissedTerm !== '11501' && (!state.dialogOpen || state.selectedTerm !== '11501')) {
              selectCounter('11501', false, true);
            }
          } else if (d2 < 2.4) {
            if (state.dismissedTerm !== '11502' && (!state.dialogOpen || state.selectedTerm !== '11502')) {
              selectCounter('11502', false, true);
            }
          } else if (d1 > 2.8 && d2 > 2.8) {
            state.dismissedTerm = null;
            if (state.dialogOpen && state.tx === null) {
              state.dialogOpen = false;
              renderBottomDialog();
            }
          }
        }

        var hop = state.walking ? Math.abs(Math.sin(tSec * 9.5)) * 0.16 : 0;
        playerMesh.position.set(state.px, hop, state.pz);

        var diffRot = state.heading - playerMesh.rotation.y;
        while (diffRot > Math.PI) diffRot -= Math.PI * 2;
        while (diffRot < -Math.PI) diffRot += Math.PI * 2;
        playerMesh.rotation.y += diffRot * 0.2;

        var limbs = playerMesh.userData.limbs;
        if (limbs) {
          var sw = state.walking ? Math.sin(tSec * 9.5) * 0.5 : 0;
          limbs.leftLeg.rotation.x = sw;
          limbs.rightLeg.rotation.x = -sw;
          limbs.leftArm.rotation.x = -sw * 0.8;
          limbs.rightArm.rotation.x = sw * 0.8;
        }

        // Dodo 櫃台地勤揮手與跳躍動畫
        ['11501', '11502'].forEach(function (tid, idx) {
          var cg = counterGroups[tid];
          if (!cg || !cg.userData.dodoStaff) return;
          var staff = cg.userData.dodoStaff;
          if (staff.userData.rightWingPivot) {
            staff.userData.rightWingPivot.rotation.z = Math.sin(tSec * 5.5 + idx) * 0.35;
          }
          var jumpY = 0;
          if (staff.userData.jumpTime > 0) {
            var jAge = (now - staff.userData.jumpTime) / 480;
            if (jAge < 1) jumpY = Math.sin(jAge * Math.PI) * 0.75;
            else staff.userData.jumpTime = 0;
          }
          staff.position.y = Math.abs(Math.sin(tSec * 2.5 + idx)) * 0.06 + jumpY;
        });

        // 窗外水上飛機動畫（待命波浪搖晃 vs 登機起飛衝刺）
        if (state.boarding && state.takeoffStart > 0) {
          var tkSec = (now - state.takeoffStart) * 0.001;
          propBlade.rotation.x = tSec * 42;
          planeGroup.position.x = tkSec * 22;
          planeGroup.position.y = 0.55 + Math.pow(tkSec, 1.8) * 6.5;
          planeGroup.rotation.z = Math.min(0.28, tkSec * 0.35);
        } else {
          propBlade.rotation.x = tSec * 14;
          planeGroup.position.x = 0;
          planeGroup.position.y = 0.55 + Math.sin(tSec * 2.4) * 0.14;
          planeGroup.rotation.z = Math.sin(tSec * 1.8) * 0.04;
        }

        // 鏡頭平滑控制
        var activeRoute = FLIGHT_ROUTES[state.selectedTerm] || FLIGHT_ROUTES['11501'];
        var targetCamX, targetCamY, targetCamZ, targetLookX, targetLookY, targetLookZ;
        if (state.boarding) {
          targetCamX = activeRoute.wx * 0.4;
          targetCamY = 6.5;
          targetCamZ = 6.5;
          targetLookX = planeGroup.position.x * 0.5;
          targetLookY = planeGroup.position.y + 1.5;
          targetLookZ = -14.0;
        } else if (state.camMode === 'counter') {
          targetCamX = activeRoute.wx * 0.85 + Math.sin(state.yawOffset) * 12;
          targetCamY = 7.2;
          targetCamZ = 9.8;
          targetLookX = activeRoute.wx;
          targetLookY = 2.1;
          targetLookZ = activeRoute.wz;
        } else {
          targetCamX = state.px * 0.28 + Math.sin(state.yawOffset) * 18.5;
          targetCamY = 11.2;
          targetCamZ = 16.8;
          targetLookX = state.px * 0.22;
          targetLookY = 2.1;
          targetLookZ = -1.6;
        }

        camPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
        camLook.lerp(new THREE.Vector3(targetLookX, targetLookY, targetLookZ), 0.1);
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        // 更新 3D 櫃台上方投影木牌與玩家名牌座標
        ['11501', '11502'].forEach(function (tid) {
          var pin = hostEl.querySelector('[data-counter-pin="' + tid + '"]');
          var r = FLIGHT_ROUTES[tid];
          if (pin && r) {
            var sp = projectToScreen(r.wx, 5.25, r.wz - 0.3);
            pin.style.left = Math.round(sp.x) + 'px';
            pin.style.top  = Math.round(sp.y) + 'px';
          }
        });

        if (playerTag) {
          var pScr = projectToScreen(state.px, playerMesh.position.y + 3.35, state.pz);
          playerTag.style.left = Math.round(pScr.x) + 'px';
          playerTag.style.top  = Math.round(pScr.y) + 'px';
        }

        renderer.render(scene, camera);
        state.rafId = requestAnimationFrame(animate);
      }

      selectCounter(state.selectedTerm, false, false);
      state.rafId = requestAnimationFrame(animate);

      cleanupThree = function () {
        state.destroyed = true;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        global.removeEventListener('resize', resizeRenderer);
        canvasEl.removeEventListener('pointerdown', onPointerDown);
        global.removeEventListener('pointermove', onPointerMove);
        global.removeEventListener('pointerup', onPointerUp);
        global.removeEventListener('keydown', onKeyDown);
        global.removeEventListener('keyup', onKeyUp);
        renderer.dispose();
      };
      hostEl._dalCleanup = cleanupThree;
    }).catch(function (err) {
      console.error('Dodo Airlines 3D 入境登機室載入失敗:', err);
    });
  }

  /**
   * 在任何頁面彈出「🦤 Dodo Airlines 3D 入境登機室（雙櫃台）」浮動場景視窗
   */
  function openAirportModal(opts) {
    opts = opts || {};
    var existing = document.getElementById('dal-airport-modal');
    if (existing) existing.remove();

    var backdrop = document.createElement('div');
    backdrop.id = 'dal-airport-modal';
    backdrop.className = 'ac-float-backdrop';
    backdrop.style.zIndex = '95';
    backdrop.style.padding = '16px 12px';
    backdrop.style.overflowY = 'auto';

    var mountBox = document.createElement('div');
    mountBox.className = 'w-full max-w-[1400px] my-auto pop';
    backdrop.appendChild(mountBox);
    document.body.appendChild(backdrop);

    function closeModal() {
      if (mountBox._dalCleanup) mountBox._dalCleanup();
      backdrop.remove();
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });

    renderAirportCounter(mountBox, {
      targetPath: opts.targetPath || 'course/hub.html',
      isModal: true,
      showTeacherLink: false,
      onClose: closeModal
    });
  }

  global.TERMSEL = {
    current: current,
    list: LIST.map(function (t) { return { id: t.id, name: t.name, short: t.short, START: t.START }; }),
    info: info,
    byDate: byDate,
    root: ROOT,
    include: include,
    /** 換學期：記下來（呼叫端自己決定要不要重新載入頁面） */
    choose: function (id) { if (valid(id)) write(id); return valid(id); },
    /** 帶著學期的網址：TERMSEL.url('course/hub.html', '11502') */
    url: function (path, id) { return ROOT + path + (String(path).indexOf('?') >= 0 ? '&' : '?') + 'term=' + encodeURIComponent(id || current); },
    renderAirportCounter: renderAirportCounter,
    openAirportModal: openAirportModal
  };
  lock(global, 'TERMSEL', global.TERMSEL);

  /* 載入這一學期的設定（defineTerm 會在裡面被呼叫） */
  if (current) include('config.js');
})(window);
