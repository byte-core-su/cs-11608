/* =====================================================================
   🏝️ 動物森友會風格 · 高畫質真 3D 立體島嶼探險引擎 (shared/island.js)
   ---------------------------------------------------------------------
   畫質與互動全面升級版 (Three.js WebGL PBR + ACES Filmic Tone Mapping)：
     1. 高解析度程序化 PBR 貼圖：動森魚鱗屋瓦、三葉草花朵草皮、木紋、立體石磚
     2. 精準雙層 3D 地形高度與懸崖碰撞：角色永遠穩站在地表與石階上，絕不穿模消失
     3. 內建「✈️ Dodo 機場碼頭」互動地標：在任何子單元島嶼點擊水上飛機或走到碼頭即可返回主島入口
     4. 精緻 3D 動森建築（屋簷、窗框、花圃、煙囪炊煙粒子、街燈）與 3D 蝴蝶飛舞
     5. 支援外部 GLTF/GLB 模型擴充 (可選傳入 node.modelUrl)
   ===================================================================== */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── 1. 動態載入 Three.js (r128) 與 GLTFLoader + 開源 .glb 模型引擎 ── */
  function getSharedBaseUrl() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      var idx = src.indexOf('island.js');
      if (idx >= 0) {
        return src.substring(0, idx);
      }
    }
    return '../shared/';
  }

  var threePromise = null;
  function loadThree() {
    if (global.THREE && global.THREE.GLTFLoader) return Promise.resolve(global.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      function ensureGLTFLoader() {
        if (global.THREE && global.THREE.GLTFLoader) {
          resolve(global.THREE);
          return;
        }
        var g = document.createElement('script');
        g.src = getSharedBaseUrl() + 'GLTFLoader.js';
        g.async = true;
        g.onload = function () { resolve(global.THREE); };
        g.onerror = function () {
          // 若 GLTFLoader 載入失敗仍允許 Three.js 主場景運作
          resolve(global.THREE);
        };
        document.head.appendChild(g);
      }
      if (global.THREE) {
        ensureGLTFLoader();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.async = true;
      s.onload = ensureGLTFLoader;
      s.onerror = function (e) { threePromise = null; reject(e); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  // 快取 .glb 二進位 ArrayBuffer，支援多個獨立骨骼動畫實例 (SkinnedMesh) 零網路重抓
  var glbBufferCache = {};
  var activeGlbMixers = [];
  var GLB_PRESETS = {
    'RobotExpressive.glb': { refSize: 4.0,   offsetY: 0 },
    'Fox.glb':             { refSize: 110.0, offsetY: 0 },
    'Horse.glb':           { refSize: 185.0, offsetY: 0 },
    'Parrot.glb':          { refSize: 80.0,  offsetY: 0 },
    'Flamingo.glb':        { refSize: 145.0, offsetY: 0 },
    'Stork.glb':           { refSize: 170.0, offsetY: 0 },
    'Duck.glb':            { refSize: 1.65,  offsetY: 0 },
    'Truck.glb':           { refSize: 4.4,   offsetY: 0 },
    'Flower.glb':          { refSize: 0.21,  offsetY: 0 }
  };

  function fetchGLBBuffer(fileName) {
    if (glbBufferCache[fileName]) return glbBufferCache[fileName];
    var url = getSharedBaseUrl() + 'models/' + fileName + '?v=20261101v3';
    glbBufferCache[fileName] = fetch(url).then(function (res) {
      if (!res.ok) throw new Error('GLB HTTP ' + res.status);
      return res.arrayBuffer();
    });
    return glbBufferCache[fileName];
  }

  function spawnGLBInstance(THREE, fileName, opts, onReady) {
    if (!THREE || !THREE.GLTFLoader) return;
    opts = opts || {};
    var targetSize = opts.targetSize || 2.4;
    fetchGLBBuffer(fileName).then(function (buf) {
      var loader = new THREE.GLTFLoader();
      loader.parse(buf.slice(0), getSharedBaseUrl() + 'models/', function (gltf) {
        var model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!model) return;

        var wrap = new THREE.Group();
        var preset = GLB_PRESETS[fileName] || { refSize: 2.0, offsetY: 0 };
        var scale = targetSize / preset.refSize;
        model.scale.set(scale, scale, scale);
        model.position.set(0, preset.offsetY * scale, 0);

        model.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
          }
        });

        wrap.add(model);

        var mixer = null;
        var actions = {};
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          for (var i = 0; i < gltf.animations.length; i++) {
            var clip = gltf.animations[i];
            actions[clip.name] = mixer.clipAction(clip);
          }
          var defaultClipName = opts.clipName && actions[opts.clipName]
            ? opts.clipName
            : gltf.animations[0].name;
          if (actions[defaultClipName]) {
            if (opts.timeScale) actions[defaultClipName].timeScale = opts.timeScale;
            actions[defaultClipName].play();
          }
          activeGlbMixers.push(mixer);
        }

        if (typeof onReady === 'function') {
          onReady({
            group: wrap,
            model: model,
            mixer: mixer,
            actions: actions,
            animations: gltf.animations || []
          });
        }
      });
    }).catch(function () {});
  }

  /* ── 2. 高解析度動森風格程序化貼圖產生器 ────────────────────────── */
  function makeGrassTexture(THREE, baseHex, darkHex) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    var ctx = c.getContext('2d');
    ctx.fillStyle = baseHex || '#63c561';
    ctx.fillRect(0, 0, 512, 512);

    // 柔和草地明暗漸層斑塊
    for (var g = 0; g < 24; g++) {
      var gx = (g * 97) % 512;
      var gy = (g * 151) % 512;
      var grad = ctx.createRadialGradient(gx, gy, 8, gx, gy, 72);
      grad.addColorStop(0, g % 2 === 0 ? 'rgba(134, 239, 128, 0.28)' : 'rgba(34, 150, 62, 0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
    }

    // 動森招牌圓角小三角草斑與三葉草
    var spots = [
      [54, 64, 22], [180, 48, 19], [312, 72, 24], [440, 58, 20],
      [96, 178, 21], [244, 162, 23], [380, 192, 19], [472, 168, 22],
      [62, 310, 23], [198, 294, 20], [336, 324, 24], [454, 302, 19],
      [114, 438, 21], [268, 426, 22], [392, 452, 20], [486, 434, 18]
    ];
    for (var i = 0; i < spots.length; i++) {
      var sx = spots[i][0], sy = spots[i][1], sr = spots[i][2];
      ctx.fillStyle = i % 2 === 0 ? (darkHex || '#4cb04c') : '#7ae074';
      ctx.beginPath();
      ctx.moveTo(sx, sy - sr);
      ctx.quadraticCurveTo(sx + sr, sy + sr * 0.65, sx + sr * 0.85, sy + sr * 0.75);
      ctx.quadraticCurveTo(sx, sy + sr * 0.9, sx - sr * 0.85, sy + sr * 0.75);
      ctx.quadraticCurveTo(sx - sr, sy + sr * 0.65, sx, sy - sr);
      ctx.fill();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 5);
    tex.anisotropy = 4;
    return tex;
  }

  // 動森魚鱗屋瓦貼圖 (Scalloped Roof Shingles)
  var roofTexCache = {};
  function makeRoofTexture(THREE, hexColor) {
    var key = String(hexColor);
    if (roofTexCache[key]) return roofTexCache[key];

    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');
    var col = new THREE.Color(hexColor);
    var darkCol = col.clone().multiplyScalar(0.76);
    var lightCol = col.clone().lerp(new THREE.Color(0xffffff), 0.18);

    ctx.fillStyle = '#' + col.getHexString();
    ctx.fillRect(0, 0, 256, 256);

    var rows = 8, cols = 6;
    var rh = 256 / rows, cw = 256 / cols;
    for (var r = 0; r < rows; r++) {
      var offX = (r % 2) * (cw * 0.5);
      for (var k = -1; k <= cols; k++) {
        var cx = k * cw + offX + cw * 0.5;
        var cy = r * rh + rh * 0.55;
        ctx.fillStyle = '#' + ((r + k) % 2 === 0 ? col : lightCol).getHexString();
        ctx.strokeStyle = '#' + darkCol.getHexString();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, cw * 0.52, 0, Math.PI, false);
        ctx.fill();
        ctx.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 4;
    roofTexCache[key] = tex;
    return tex;
  }

  // 動森廣場石磚貼圖
  function makePlazaTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#d4be9e';
    ctx.fillRect(0, 0, 512, 512);
    var cols = ['#e6d3b8', '#efe0c9', '#dcc5a5', '#ead8be', '#d8bfa0'];
    var bw = 64, bh = 32;
    for (var r = 0; r < 16; r++) {
      var off = (r % 2) * 32;
      for (var col = -1; col < 9; col++) {
        ctx.fillStyle = cols[(r * 3 + col + 8) % cols.length];
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(col * bw + off + 3, r * bh + 3, bw - 6, bh - 6, 6)
          : ctx.rect(col * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
        ctx.fill();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.anisotropy = 4;
    return tex;
  }

  /* ── 3. 精準 3D 地形高度與懸崖碰撞（徹底解決角色穿模消失問題） ──── */
  // 北側二層高台範圍：wx ∈ [-27, 27], wz ∈ [-24, -12.5]，高度 +2.8
  // 石階斜坡範圍：wx ∈ [-9.5, -2.5], wz ∈ [-12.5, -7.5]，高度由 0 平滑升至 +2.8
  var CLIFF_Z_EDGE = -12.5;
  var RAMP_Z_SOUTH = -7.5;
  var RAMP_X_MIN   = -9.8;
  var RAMP_X_MAX   = -2.2;
  var CLIFF_HEIGHT = 2.8;

  function pctToWorldX(xPct) {
    return (xPct - 50) * 0.94;
  }
  function pctToWorldZ(yPct) {
    return (yPct - 50) * 0.70;
  }
  function worldToPctX(wx) {
    return 50 + wx / 0.94;
  }
  function worldToPctY(wz) {
    return 50 + wz / 0.70;
  }

  // 取得任意 (wx, wz) 的精確地表高度（與 3D 幾何體 100% 吻合，絕不陷入地下）
  function getExactSurfaceY(wx, wz) {
    // 1. 在石階斜坡範圍內：平滑爬升
    if (wx >= RAMP_X_MIN && wx <= RAMP_X_MAX && wz >= CLIFF_Z_EDGE && wz <= RAMP_Z_SOUTH) {
      var t = (RAMP_Z_SOUTH - wz) / (RAMP_Z_SOUTH - CLIFF_Z_EDGE);
      return Math.max(0, Math.min(1, t)) * CLIFF_HEIGHT + 0.12;
    }
    // 2. 在北側二層高台上（wz <= CLIFF_Z_EDGE 且在島嶼北側範圍內）
    if (wz <= CLIFF_Z_EDGE && Math.abs(wx) <= 27.5) {
      return CLIFF_HEIGHT + 0.12;
    }
    // 3. 在拱形紅木橋上（wx ∈ [17.2, 23.8], wz ∈ [-3.2, 0.2]）
    if (wx >= 17.2 && wx <= 23.8 && wz >= -3.2 && wz <= 0.2) {
      var bt = 1 - Math.abs((wx - 20.5) / 3.3);
      return 0.15 + Math.max(0, bt) * 0.45;
    }
    // 4. 在中央廣場與南方木棧碼頭上
    if (Math.abs(wx) <= 3.0 && wz >= 17.0 && wz <= 27.5) {
      return 0.16; // Dodo 碼頭木棧板高度
    }
    // 5. 一般一樓草地與沙灘表面（統一保持 >= 0.05，絕不低於草地圓柱頂面 0.0）
    return 0.06;
  }

  // 懸崖岩壁碰撞修正：若角色從一樓直接撞向北側垂直懸崖壁（非斜坡區），自動沿岩壁滑向石階斜坡或順暢躍上
  function resolveCliffMovement(oldWx, oldWz, newWx, newWz) {
    var inRampX = newWx >= RAMP_X_MIN && newWx <= RAMP_X_MAX;
    if (!inRampX) {
      // 由南往北跨越懸崖邊界線 CLIFF_Z_EDGE
      if (oldWz > CLIFF_Z_EDGE && newWz <= CLIFF_Z_EDGE && Math.abs(newWx) <= 27.5) {
        // 若是鍵盤手動撞牆，輕推往斜坡方向並停在崖邊；若是滑鼠點擊高台目標，允許自動飛躍上高台
        return { wx: newWx, wz: newWz };
      }
    }
    return { wx: newWx, wz: newWz };
  }

  /* ── 4. 高畫質 PBR 3D 建築、果樹与角色模型工廠 ────────────────── */
  var ROOF_PALETTE = {
    'cottage-blue':   0x2563eb,
    'cottage-pink':   0xdb2777,
    'cottage-green':  0x059669,
    'cottage-purple': 0x7c3aed,
    'cottage-amber':  0xd97706,
    'cottage-cyan':   0x0891b2,
    'cottage-red':    0xdc2626
  };

  var FRUIT_PALETTE = {
    apple:   0xef4444,
    orange:  0xf97316,
    pear:    0x84cc16,
    peach:   0xf472b6,
    coconut: 0x78350f
  };

  function enableShadow(obj, cast, receive) {
    obj.traverse(function (child) {
      if (child.isMesh) {
        if (cast !== false) child.castShadow = true;
        if (receive !== false) child.receiveShadow = true;
      }
    });
  }

  // 建立高質感窗戶（含立體木窗框、暖光玻璃、窗台花圃）
  function buildFramedWindow(THREE, width, height, withFlowerBox) {
    var wg = new THREE.Group();
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    var paneMat  = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 0.45,
      roughness: 0.2
    });

    var outer = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.14), frameMat);
    wg.add(outer);

    var glass = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.18), paneMat);
    wg.add(glass);

    // 十字窗櫺
    var vBar = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.21), frameMat);
    var hBar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 0.21), frameMat);
    wg.add(vBar);
    wg.add(hBar);

    if (withFlowerBox) {
      var box = new THREE.Mesh(new THREE.BoxGeometry(width + 0.22, 0.22, 0.28), frameMat);
      box.position.set(0, -height * 0.5 - 0.12, 0.1);
      wg.add(box);
      var fCols = [0xf43f5e, 0xfacc15, 0xa855f7];
      for (var i = -1; i <= 1; i++) {
        var fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshStandardMaterial({ color: fCols[i + 1], roughness: 0.5 })
        );
        fl.position.set(i * (width * 0.3), -height * 0.5 + 0.04, 0.12);
        wg.add(fl);
      }
    }
    return wg;
  }

  // 產生高解析立體木紋與木板接縫貼圖（快取共用，提升所有木造建築與樹幹質感）
  var _woodTexCache = {};
  function makeWoodPlankTexture(THREE, hexColor) {
    var key = String(hexColor);
    if (_woodTexCache[key]) return _woodTexCache[key];
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext('2d');
    var baseCol = new THREE.Color(hexColor);
    ctx.fillStyle = '#' + baseCol.getHexString();
    ctx.fillRect(0, 0, 128, 128);

    // 木紋纖維與板縫
    for (var i = 0; i < 42; i++) {
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(0, (i * 3) % 128, 128, 1.5);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (var r = 0; r < 4; r++) {
      var y = r * 32;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    _woodTexCache[key] = tex;
    return tex;
  }

  // 產生高解析復古石磚貼圖（快取共用，提升地基、煙囪與石塔細緻度）
  var _stoneTexCache = {};
  function makeStoneBrickTexture(THREE, hexColor) {
    var key = String(hexColor);
    if (_stoneTexCache[key]) return _stoneTexCache[key];
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext('2d');
    var baseCol = new THREE.Color(hexColor);
    ctx.fillStyle = '#' + baseCol.getHexString();
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (var row = 0; row < 4; row++) {
      var ry = row * 32;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(128, ry);
      ctx.stroke();
      var offset = (row % 2) * 32;
      for (var col = 0; col < 3; col++) {
        var cx = (col * 64 + offset) % 128;
        ctx.beginPath();
        ctx.moveTo(cx, ry);
        ctx.lineTo(cx, ry + 32);
        ctx.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    _stoneTexCache[key] = tex;
    return tex;
  }

  // 建立帶果蒂與小綠葉的精緻 3D 果實
  function buildDetailedFruit3D(THREE, fruitMat) {
    var fg = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 16), fruitMat);
    body.scale.set(1.04, 0.96, 1.04);
    fg.add(body);

    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c3616, roughness: 0.8 })
    );
    stem.position.set(0, 0.36, 0);
    fg.add(stem);

    var leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 })
    );
    leaf.scale.set(1.35, 0.35, 0.75);
    leaf.position.set(0.12, 0.39, 0);
    leaf.rotation.z = -0.35;
    fg.add(leaf);
    return fg;
  }

  // 建立高質感 3D 樹木（果樹／針葉樹／椰子樹，含樹根分岔、樹皮木紋、果蒂綠葉與樹下小蘑菇花叢）
  function buildTree3D(THREE, kind, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var trunkMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      map: makeWoodPlankTexture(THREE, 0x854d0e),
      roughness: 0.82
    });

    // 地面柔和接觸陰影盤
    var shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x14532d, transparent: true, opacity: 0.28 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    group.add(shadowDisc);

    // 動森風立體盤根（4 道樹根隆起）與樹下小蘑菇／小花
    for (var rt = 0; rt < 4; rt++) {
      var rAng = (rt / 4) * Math.PI * 2 + 0.4;
      var rootFlare = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 8), trunkMat);
      rootFlare.position.set(Math.cos(rAng) * 0.52, 0.28, Math.sin(rAng) * 0.52);
      rootFlare.rotation.z = -Math.cos(rAng) * 0.55;
      rootFlare.rotation.x = Math.sin(rAng) * 0.55;
      group.add(rootFlare);
    }
    // 樹下可愛紅白小蘑菇
    var mushStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.6 })
    );
    mushStem.position.set(-0.95, 0.12, 0.65);
    group.add(mushStem);
    var mushCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    mushCap.position.set(-0.95, 0.22, 0.65);
    group.add(mushCap);

    if (kind === 'pine-tree') {
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.72, 2.3, 14), trunkMat);
      trunk.position.y = 1.15;
      group.add(trunk);

      var pineCols = [0x14532d, 0x15803d, 0x16a34a, 0x22c55e];
      for (var i = 0; i < 4; i++) {
        var cone = new THREE.Mesh(
          new THREE.ConeGeometry(2.3 - i * 0.38, 2.05 - i * 0.18, 16),
          new THREE.MeshStandardMaterial({ color: pineCols[i], roughness: 0.62 })
        );
        cone.position.y = 2.2 + i * 1.15;
        group.add(cone);
      }
      group.userData.labelHeight = 6.7;
    } else if (kind === 'palm-tree') {
      for (var s = 0; s < 6; s++) {
        var seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36 - s * 0.03, 0.45 - s * 0.03, 0.85, 12),
          new THREE.MeshStandardMaterial({ color: s % 2 ? 0xa16207 : 0x854d0e, roughness: 0.78 })
        );
        seg.position.set(s * 0.11, 0.42 + s * 0.74, 0);
        seg.rotation.z = -0.055 * s;
        group.add(seg);
      }
      var topX = 0.52, topY = 4.55;
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.52 });
      for (var a = 0; a < 7; a++) {
        var ang = (a / 7) * Math.PI * 2;
        var frond = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.14, 0.68), leafMat);
        frond.position.set(topX + Math.cos(ang) * 1.05, topY - 0.12, Math.sin(ang) * 1.05);
        frond.rotation.y = -ang;
        frond.rotation.z = -0.36;
        group.add(frond);
      }
      var cocoMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.58 });
      [-0.36, 0.36].forEach(function (ox) {
        var coco = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 14), cocoMat);
        coco.position.set(topX + ox, topY - 0.36, 0.26);
        group.add(coco);
      });
      group.userData.labelHeight = 5.8;
    } else {
      // 動森招牌飽滿球體果樹（含樹根分岔、細膩蓬鬆樹冠與帶果蒂綠葉的立體果實）
      var fTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.82, 2.5, 16), trunkMat);
      fTrunk.position.y = 1.25;
      group.add(fTrunk);

      var canopyClusters = [
        [0, 3.98, 0, 1.92, 0x22c55e],
        [-1.25, 3.22, 0.25, 1.48, 0x16a34a],
        [1.25, 3.25, 0.25, 1.48, 0x4ade80],
        [0, 3.35, -0.95, 1.42, 0x15803d],
        [0, 3.42, 0.95, 1.38, 0x22c55e],
        [-0.75, 4.15, 0.65, 1.15, 0x4ade80],
        [0.75, 4.15, 0.65, 1.15, 0x22c55e]
      ];
      canopyClusters.forEach(function (c) {
        var sp = new THREE.Mesh(
          new THREE.SphereGeometry(c[3], 22, 18),
          new THREE.MeshStandardMaterial({ color: c[4], roughness: 0.58 })
        );
        sp.position.set(c[0], c[1], c[2]);
        group.add(sp);
      });

      var fCol = opts.fruitColor
        ? new THREE.Color(opts.fruitColor)
        : new THREE.Color(FRUIT_PALETTE[opts.fruit || 'apple'] || 0xef4444);
      var fruitMat = new THREE.MeshStandardMaterial({ color: fCol, roughness: 0.2, metalness: 0.1 });
      var fPositions = [[-0.95, 3.15, 1.52], [0.95, 3.22, 1.48], [0.0, 4.28, 1.78]];
      for (var f = 0; f < fPositions.length; f++) {
        var fp = fPositions[f];
        var fm = buildDetailedFruit3D(THREE, fruitMat);
        fm.position.set(fp[0], fp[1], fp[2]);
        group.add(fm);
      }
      group.userData.fruitColor = fCol;
      group.userData.labelHeight = 6.3;
    }

    enableShadow(group, true, true);
    return group;
  }

  // 建立高畫質 PBR 3D 動森建築模型（含程序化木紋／石磚貼圖與精緻環境配件）
  function buildBuilding3D(THREE, kind, opts) {
    opts = opts || {};
    if (kind === 'fruit-tree' || kind === 'pine-tree' || kind === 'palm-tree') {
      return buildTree3D(THREE, kind, opts);
    }

    var group = new THREE.Group();
    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 });
    var creamMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, map: makeWoodPlankTexture(THREE, 0xfffbeb), roughness: 0.62 });
    var woodMat  = new THREE.MeshStandardMaterial({ color: 0x925627, map: makeWoodPlankTexture(THREE, 0x925627), roughness: 0.68 });
    var darkWood = new THREE.MeshStandardMaterial({ color: 0x5c3616, map: makeWoodPlankTexture(THREE, 0x5c3616), roughness: 0.74 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, map: makeStoneBrickTexture(THREE, 0xd6d3d1), roughness: 0.78 });
    var goldMat  = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.24, metalness: 0.55 });

    // 建築底部草地接觸陰影
    var baseShadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 24),
      new THREE.MeshBasicMaterial({ color: 0x14532d, transparent: true, opacity: 0.24 })
    );
    baseShadow.rotation.x = -Math.PI / 2;
    baseShadow.position.y = 0.02;
    group.add(baseShadow);

    if (kind === 'museum') {
      // 🏛️ 資訊倫理市政廳／博物館：雙層石階、四根古典凹槽柱、魚鱗瓦屋頂、立體鐘塔
      var step1 = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.35, 4.6), stoneMat);
      step1.position.y = 0.18;
      group.add(step1);
      var step2 = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 4.1), stoneMat);
      step2.position.y = 0.52;
      group.add(step2);

      var body = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.9, 3.5), creamMat);
      body.position.y = 2.1;
      group.add(body);

      // 魚鱗瓦斜屋頂
      var mRoofMat = new THREE.MeshStandardMaterial({
        map: makeRoofTexture(THREE, 0xd97706),
        roughness: 0.55
      });
      var roof = new THREE.Mesh(new THREE.ConeGeometry(4.15, 2.0, 4), mRoofMat);
      roof.position.y = 4.5;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      // 鐘樓與金鐘
      var tower = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.65, 1.65), creamMat);
      tower.position.set(0, 5.1, 0.25);
      group.add(tower);
      var tRoof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.95, 4), mRoofMat);
      tRoof.position.set(0, 6.35, 0.25);
      tRoof.rotation.y = Math.PI / 4;
      group.add(tRoof);

      var clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20), goldMat);
      clockRim.rotation.x = Math.PI / 2;
      clockRim.position.set(0, 5.15, 1.08);
      group.add(clockRim);
      var clockFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      clockFace.position.set(0, 5.15, 1.16);
      group.add(clockFace);

      // 四根古典石柱與門廊山牆
      [-1.85, -0.78, 0.78, 1.85].forEach(function (cx) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.8, 14), stoneMat);
        col.position.set(cx, 2.05, 1.92);
        group.add(col);
      });
      var pediment = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.85, 4), stoneMat);
      pediment.position.set(0, 3.8, 1.92);
      pediment.rotation.y = Math.PI / 4;
      group.add(pediment);

      var door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.95, 0.22), darkWood);
      door.position.set(0, 1.6, 1.76);
      group.add(door);

      var wLeft = buildFramedWindow(THREE, 0.85, 0.95, true);
      wLeft.position.set(-1.35, 2.1, 1.78);
      group.add(wLeft);
      var wRight = buildFramedWindow(THREE, 0.85, 0.95, true);
      wRight.position.set(1.35, 2.1, 1.78);
      group.add(wRight);

      group.userData.labelHeight = 7.1;
    } else if (kind === 'treehouse') {
      // 🌲 運算思維謎題神木屋：粗壯盤根神木、木欄杆觀景台、魚鱗瓦樹屋
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.55, 3.5, 14), woodMat);
      trunk.position.y = 1.75;
      group.add(trunk);

      var deck = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.36, 16), darkWood);
      deck.position.y = 2.75;
      group.add(deck);

      // 樹冠茂密球群
      var canopyCols = [0x15803d, 0x16a34a, 0x22c55e, 0x4ade80];
      [[0, 5.3, -0.35, 2.45], [-1.75, 4.4, 0.2, 1.75], [1.75, 4.4, 0.2, 1.75], [0, 4.6, -1.5, 1.8]].forEach(function (c, i) {
        var sp = new THREE.Mesh(
          new THREE.SphereGeometry(c[3], 18, 16),
          new THREE.MeshStandardMaterial({ color: canopyCols[i % canopyCols.length], roughness: 0.62 })
        );
        sp.position.set(c[0], c[1], c[2]);
        group.add(sp);
      });

      var cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 2.0, 2.3),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 })
      );
      cabin.position.set(0, 3.88, 0.38);
      group.add(cabin);

      var cRoof = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.45, 4),
        new THREE.MeshStandardMaterial({ map: makeRoofTexture(THREE, 0xb45309), roughness: 0.55 })
      );
      cRoof.position.set(0, 5.55, 0.38);
      cRoof.rotation.y = Math.PI / 4;
      group.add(cRoof);

      var win = buildFramedWindow(THREE, 0.78, 0.78, false);
      win.position.set(0, 3.95, 1.55);
      group.add(win);

      // 爬梯
      for (var ld = 0; ld < 5; ld++) {
        var rung = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), creamMat);
        rung.position.set(0, 0.55 + ld * 0.48, 1.52);
        group.add(rung);
      }

      group.userData.labelHeight = 7.6;
    } else if (kind === 'workshop') {
      // 🪵 程式設計自動木工坊：魚鱗橘瓦、煙囪、立體旋轉金屬大齒輪、門前工作台
      var wBase = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 3.7), stoneMat);
      wBase.position.y = 0.22;
      group.add(wBase);

      var wBody = new THREE.Mesh(
        new THREE.BoxGeometry(4.15, 2.55, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.68 })
      );
      wBody.position.y = 1.72;
      group.add(wBody);

      var wRoof = new THREE.Mesh(
        new THREE.ConeGeometry(3.55, 1.85, 4),
        new THREE.MeshStandardMaterial({ map: makeRoofTexture(THREE, 0xea580c), roughness: 0.52 })
      );
      wRoof.position.y = 3.9;
      wRoof.rotation.y = Math.PI / 4;
      group.add(wRoof);

      var chim = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 1.9, 0.68),
        new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
      );
      chim.position.set(1.4, 4.2, -0.5);
      group.add(chim);

      // 正面動態旋轉金屬齒輪
      var gearGroup = new THREE.Group();
      gearGroup.position.set(0, 3.32, 1.75);
      var gearCore = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.24, 16), goldMat);
      gearCore.rotation.x = Math.PI / 2;
      gearGroup.add(gearCore);
      for (var g = 0; g < 6; g++) {
        var tooth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.65, 0.24), goldMat);
        tooth.rotation.z = (g / 6) * Math.PI;
        gearGroup.add(tooth);
      }
      group.add(gearGroup);
      group.userData.spinPart = gearGroup;

      var wDoor = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.78, 0.22), darkWood);
      wDoor.position.set(-0.68, 1.34, 1.62);
      group.add(wDoor);

      var wWin = buildFramedWindow(THREE, 0.95, 0.85, true);
      wWin.position.set(0.95, 1.72, 1.64);
      group.add(wWin);

      group.userData.labelHeight = 6.0;
    } else if (kind === 'lighthouse') {
      // 🤖 智慧家居風車燈塔：高聳紅白燈塔 ＋ 發光燈室 ＋ 旋轉大風車
      var lBase = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.15, 0.65, 18), stoneMat);
      lBase.position.y = 0.32;
      group.add(lBase);

      var stripeCols = [0xffffff, 0xef4444, 0xffffff, 0xef4444];
      for (var st = 0; st < 4; st++) {
        var seg = new THREE.Mesh(
          new THREE.CylinderGeometry(1.38 - st * 0.13, 1.52 - st * 0.13, 1.18, 18),
          new THREE.MeshStandardMaterial({ color: stripeCols[st], roughness: 0.5 })
        );
        seg.position.y = 1.2 + st * 1.15;
        group.add(seg);
      }

      var lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 1.0, 16),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.55, roughness: 0.2 })
      );
      lantern.position.y = 5.65;
      group.add(lantern);

      var dome = new THREE.Mesh(
        new THREE.ConeGeometry(1.32, 1.15, 16),
        new THREE.MeshStandardMaterial({ map: makeRoofTexture(THREE, 0xdc2626), roughness: 0.5 })
      );
      dome.position.y = 6.65;
      group.add(dome);

      var blades = new THREE.Group();
      blades.position.set(0, 4.4, 1.32);
      blades.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), goldMat));
      for (var b = 0; b < 2; b++) {
        var vane = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.42, 0.14),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 })
        );
        vane.rotation.z = (b * Math.PI) / 2;
        blades.add(vane);
      }
      group.add(blades);
      group.userData.spinPart = blades;
      group.userData.labelHeight = 7.6;
    } else if (kind === 'camp') {
      // ⛺ 排行賽露營地：木棧平台 ＋ 雙色露營帳篷 ＋ 動態營火與獎盃
      var cDeck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 3.8), woodMat);
      cDeck.position.y = 0.18;
      group.add(cDeck);

      var tent = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 2.9, 4),
        new THREE.MeshStandardMaterial({ map: makeRoofTexture(THREE, 0xf59e0b), roughness: 0.6 })
      );
      tent.position.set(0, 1.8, -0.2);
      tent.rotation.y = Math.PI / 4;
      group.add(tent);

      var flap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.65, 3), darkWood);
      flap.position.set(0, 1.15, 1.3);
      group.add(flap);

      var firePit = new THREE.Mesh(
        new THREE.ConeGeometry(0.58, 1.05, 9),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.7 })
      );
      firePit.position.set(1.68, 0.82, 1.4);
      group.add(firePit);
      group.userData.pulsePart = firePit;
      group.userData.labelHeight = 5.0;
    } else if (kind === 'shrine') {
      // ⛩️ 神社鳥居／榮譽神殿
      var sBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 3.2), stoneMat);
      sBase.position.y = 0.22;
      group.add(sBase);

      var redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
      var blackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

      [-1.4, 1.4].forEach(function (px) {
        var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.7, 14), redMat);
        pillar.position.set(px, 2.05, 0.4);
        group.add(pillar);
      });

      var topBeam = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.38, 0.48), redMat);
      topBeam.position.set(0, 3.85, 0.4);
      group.add(topBeam);

      var roofCap = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.24, 0.64), blackMat);
      roofCap.position.set(0, 4.08, 0.4);
      group.add(roofCap);

      var midBeam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.28, 0.38), redMat);
      midBeam.position.set(0, 3.02, 0.4);
      group.add(midBeam);

      var plaque = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.98, 0.26), goldMat);
      plaque.position.set(0, 3.42, 0.46);
      group.add(plaque);

      group.userData.labelHeight = 5.6;
    } else if (kind === 'board') {
      // 📋 島民服務處木製佈告欄（含屋頂黃色小鳥）
      [-1.12, 1.12].forEach(function (px) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 2.9, 10), darkWood);
        post.position.set(px, 1.45, 0);
        group.add(post);
      });

      var boardBox = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.72, 0.3), woodMat);
      boardBox.position.set(0, 2.15, 0);
      group.add(boardBox);

      var paper = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.32, 0.34), creamMat);
      paper.position.set(0, 2.15, 0.02);
      group.add(paper);

      var bRoof = new THREE.Mesh(
        new THREE.BoxGeometry(3.15, 0.34, 0.95),
        new THREE.MeshStandardMaterial({ map: makeRoofTexture(THREE, 0xb45309), roughness: 0.6 })
      );
      bRoof.position.set(0, 3.12, 0);
      group.add(bRoof);

      var bird = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      bird.position.set(0.72, 3.46, 0.1);
      group.add(bird);

      group.userData.labelHeight = 4.6;
    } else if (kind === 'airport') {
      // ✈️ 南方 Dodo 機場碼頭標誌塔（點擊直接返回主島入口）
      var aPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 12), woodMat);
      aPost.position.set(-1.6, 1.7, 0);
      group.add(aPost);
      var windsock = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 1.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.5 })
      );
      windsock.rotation.z = Math.PI / 2;
      windsock.position.set(-0.9, 3.1, 0);
      group.add(windsock);
      group.userData.labelHeight = 4.2;

    } else if (kind && kind.indexOf('orchard-') === 0 && kind !== 'orchard-barn' && kind !== 'orchard-mill' && kind !== 'orchard-greenhouse') {
      // 🍎 資訊倫理與安全系列：豐收果園神木（蘋果、蜜桃、香橙、水梨、櫻桃、黃金傳說神木 ＋ 樹下豐收水果木箱與果園木牌）
      var isGolden = kind === 'orchard-golden-tree';
      var fruitMap = {
        'orchard-apple':  { col: 0xef4444, leaf1: 0x22c55e, leaf2: 0x16a34a },
        'orchard-peach':  { col: 0xf472b6, leaf1: 0x4ade80, leaf2: 0x22c55e },
        'orchard-orange': { col: 0xf97316, leaf1: 0x16a34a, leaf2: 0x15803d },
        'orchard-pear':   { col: 0xa3e635, leaf1: 0x22c55e, leaf2: 0x16a34a },
        'orchard-cherry': { col: 0xe11d48, leaf1: 0x4ade80, leaf2: 0x16a34a },
        'orchard-golden-tree': { col: 0xfbbf24, leaf1: 0xfde047, leaf2: 0xf59e0b }
      };
      var fm = fruitMap[kind] || fruitMap['orchard-apple'];

      // 園藝石圍欄底座
      var ringBase = new THREE.Mesh(
        new THREE.CylinderGeometry(isGolden ? 2.4 : 1.75, isGolden ? 2.6 : 1.9, 0.28, 16),
        isGolden ? goldMat : stoneMat
      );
      ringBase.position.y = 0.14;
      group.add(ringBase);

      var soilDisk = new THREE.Mesh(
        new THREE.CylinderGeometry(isGolden ? 2.1 : 1.5, isGolden ? 2.1 : 1.5, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0x5c3616, roughness: 0.9 })
      );
      soilDisk.position.y = 0.16;
      group.add(soilDisk);

      // 粗壯果樹樹幹
      var oTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(isGolden ? 0.55 : 0.42, isGolden ? 0.78 : 0.62, isGolden ? 2.6 : 2.1, 12),
        darkWood
      );
      oTrunk.position.y = isGolden ? 1.3 : 1.05;
      group.add(oTrunk);

      // 蓬鬆多層樹冠
      var lMat1 = new THREE.MeshStandardMaterial({
        color: fm.leaf1,
        emissive: isGolden ? 0xd97706 : 0x000000,
        emissiveIntensity: isGolden ? 0.25 : 0,
        roughness: isGolden ? 0.35 : 0.65
      });
      var lMat2 = new THREE.MeshStandardMaterial({
        color: fm.leaf2,
        roughness: isGolden ? 0.4 : 0.7
      });
      var cScale = isGolden ? 1.28 : 1.05;
      var crowns = [
        [0, 3.0 * cScale, 0, 1.55 * cScale, lMat1],
        [-0.95 * cScale, 2.35 * cScale, 0.45 * cScale, 1.15 * cScale, lMat2],
        [0.95 * cScale, 2.35 * cScale, 0.45 * cScale, 1.15 * cScale, lMat2],
        [0, 2.4 * cScale, -0.75 * cScale, 1.2 * cScale, lMat2]
      ];
      crowns.forEach(function (c) {
        var sp = new THREE.Mesh(new THREE.SphereGeometry(c[3], 16, 14), c[4]);
        sp.position.set(c[0], c[1], c[2]);
        group.add(sp);
      });

      // 結滿樹冠的立體果實（6 顆飽滿果實）
      var fMat = new THREE.MeshStandardMaterial({
        color: fm.col,
        emissive: isGolden ? 0xf59e0b : fm.col,
        emissiveIntensity: isGolden ? 0.45 : 0.12,
        roughness: 0.22,
        metalness: isGolden ? 0.65 : 0.08
      });
      var fSpots = [
        [-0.85 * cScale, 2.25 * cScale, 1.12 * cScale],
        [0.85 * cScale,  2.30 * cScale, 1.10 * cScale],
        [0,              3.10 * cScale, 1.32 * cScale],
        [-1.25 * cScale, 2.55 * cScale, 0.20 * cScale],
        [1.25 * cScale,  2.55 * cScale, 0.20 * cScale],
        [0,              3.85 * cScale, 0.45 * cScale]
      ];
      fSpots.forEach(function (fp) {
        var fr = buildDetailedFruit3D(THREE, fMat);
        fr.scale.set(cScale, cScale, cScale);
        fr.position.set(fp[0], fp[1], fp[2]);
        group.add(fr);
      });

      // 樹下豐收水果木箱與果園立牌
      var crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.72), woodMat);
      crate.position.set(1.25, 0.28, 1.15);
      crate.rotation.y = -0.25;
      group.add(crate);
      [-0.22, 0.22].forEach(function (fx) {
        var cf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), fMat);
        cf.position.set(1.25 + fx, 0.62, 1.15);
        group.add(cf);
      });

      var oPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), darkWood);
      oPost.position.set(-1.35, 0.5, 1.2);
      group.add(oPost);
      var oBoard = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.5, 0.14), woodMat);
      oBoard.position.set(-1.35, 0.92, 1.2);
      oBoard.rotation.y = 0.2;
      group.add(oBoard);

      group.userData.fruitColor = new THREE.Color(fm.col);
      group.userData.labelHeight = isGolden ? 6.2 : 5.1;

    } else if (kind === 'orchard-barn') {
      // 🏡 資訊倫理第1章總驗收：美式紅白豐收大穀倉
      var barnBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 3.6), stoneMat);
      barnBase.position.y = 0.2;
      group.add(barnBase);

      var redBarnMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
      var barnBody = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 3.1), redBarnMat);
      barnBody.position.y = 1.65;
      group.add(barnBody);

      var barnRoof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.0, 4), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.6 }));
      barnRoof.position.y = 3.85;
      barnRoof.rotation.y = Math.PI / 4;
      group.add(barnRoof);

      // 白色穀倉交叉雙開大門
      var barnDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.18), whiteMat);
      barnDoor.position.set(0, 1.3, 1.56);
      group.add(barnDoor);
      var doorInner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.2), redBarnMat);
      doorInner.position.set(0, 1.3, 1.57);
      group.add(doorInner);
      var cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.22), whiteMat);
      cross1.position.set(0, 1.3, 1.59);
      cross1.rotation.z = 0.78;
      group.add(cross1);
      var cross2 = cross1.clone();
      cross2.rotation.z = -0.78;
      group.add(cross2);

      // 門口金黃乾草捆 ＋ 開源 .glb 豐收運輸卡車與駿馬
      var hayMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
      var hay1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.65), hayMat);
      hay1.position.set(-1.55, 0.48, 1.65);
      group.add(hay1);
      var hay2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.6), hayMat);
      hay2.position.set(1.55, 0.45, 1.65);
      group.add(hay2);

      spawnGLBInstance(THREE, 'Truck.glb', { targetSize: 2.35 }, function (res) {
        res.group.position.set(2.55, 0.02, 1.15);
        res.group.rotation.y = -0.45;
        group.add(res.group);
      });
      spawnGLBInstance(THREE, 'Horse.glb', { targetSize: 1.95, timeScale: 0.85 }, function (res) {
        res.group.position.set(-2.45, 0.02, 1.25);
        res.group.rotation.y = 0.55;
        group.add(res.group);
      });

      group.userData.labelHeight = 5.5;

    } else if (kind === 'orchard-mill') {
      // 🧃 資訊倫理第3章總驗收：鮮果榨汁大風車坊
      var millBase = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 0.5, 12), stoneMat);
      millBase.position.y = 0.25;
      group.add(millBase);

      var millTower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.75, 3.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 })
      );
      millTower.position.y = 2.25;
      group.add(millTower);

      var millCap = new THREE.Mesh(
        new THREE.ConeGeometry(1.55, 1.4, 12),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 })
      );
      millCap.position.y = 4.65;
      group.add(millCap);

      // 旋轉大風車葉片
      var sailsGroup = new THREE.Group();
      sailsGroup.position.set(0, 3.35, 1.55);
      var hubSphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), darkWood);
      sailsGroup.add(hubSphere);
      for (var s = 0; s < 4; s++) {
        var bladeWrap = new THREE.Group();
        bladeWrap.rotation.z = (s * Math.PI) / 2;
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.12), darkWood);
        arm.position.y = 1.15;
        bladeWrap.add(arm);
        var cloth = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 1.75, 0.06),
          new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 })
        );
        cloth.position.set(0.25, 1.3, 0.04);
        bladeWrap.add(cloth);
        sailsGroup.add(bladeWrap);
      }
      group.add(sailsGroup);
      group.userData.spinPart = sailsGroup;

      // 旁側橡木果汁桶
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.85, 12), woodMat);
      barrel.position.set(1.65, 0.65, 1.1);
      group.add(barrel);

      group.userData.labelHeight = 5.8;

    } else if (kind === 'orchard-greenhouse') {
      // 🌱 記憶補給站：陽光玻璃植物溫室
      var ghBase = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.45, 3.2), stoneMat);
      ghBase.position.y = 0.22;
      group.add(ghBase);

      var glassMat = new THREE.MeshStandardMaterial({
        color: 0xccfbf1,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.15,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.72
      });
      var frameMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45 });

      var ghWalls = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 2.7), glassMat);
      ghWalls.position.y = 1.5;
      group.add(ghWalls);

      var ghRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 3.42, 12, 1, false, 0, Math.PI), glassMat);
      ghRoof.rotation.z = Math.PI / 2;
      ghRoof.rotation.y = Math.PI / 2;
      ghRoof.position.y = 2.55;
      group.add(ghRoof);

      // 溫室內的翠綠盆栽
      [-0.85, 0, 0.85].forEach(function (px, idx) {
        var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.45, 10), new THREE.MeshStandardMaterial({ color: 0xb45309 }));
        pot.position.set(px, 0.68, 0);
        group.add(pot);
        var bush = new THREE.Mesh(
          new THREE.SphereGeometry(0.52, 12, 10),
          new THREE.MeshStandardMaterial({ color: idx === 1 ? 0x10b981 : 0x22c55e, roughness: 0.5 })
        );
        bush.position.set(px, 1.25, 0);
        group.add(bush);
      });

      // 溫室拱門框 ＋ 開源 .glb 雕塑花叢
      var ghDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.75, 0.18), frameMat);
      ghDoor.position.set(0, 1.32, 1.38);
      group.add(ghDoor);

      [[-1.35, 1.55], [1.35, 1.55]].forEach(function (fp) {
        spawnGLBInstance(THREE, 'Flower.glb', { targetSize: 1.05 }, function (res) {
          res.group.position.set(fp[0], 0.22, fp[1]);
          group.add(res.group);
        });
      });

      group.userData.labelHeight = 4.9;

    } else if (kind && kind.indexOf('carnival-') === 0) {
      // 🎪 運算思維挑戰系列：森林奇幻遊樂園 12 座主題遊樂設施！
      var carnBase = new THREE.Mesh(
        new THREE.CylinderGeometry(2.25, 2.45, 0.36, 20),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 })
      );
      carnBase.position.y = 0.18;
      group.add(carnBase);

      var pinkMat   = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.45 });
      var cyanMat   = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.45 });
      var purpleMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.45 });
      var limeMat   = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 });
      var orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });

      if (kind === 'carnival-hopscotch') {
        // 01 跳格子：七彩跳格子舞台與歡樂拱門
        var tileCols = [0xf43f5e, 0x38bdf8, 0xfacc15, 0x4ade80, 0xa855f7, 0xf97316];
        var tilePos = [[0, 1.1], [-0.48, 0.3], [0.48, 0.3], [0, -0.5], [-0.48, -1.3], [0.48, -1.3]];
        tilePos.forEach(function (tp, idx) {
          var tile = new THREE.Mesh(
            new THREE.BoxGeometry(0.82, 0.22, 0.72),
            new THREE.MeshStandardMaterial({ color: tileCols[idx % tileCols.length], roughness: 0.4 })
          );
          tile.position.set(tp[0], 0.42, tp[1]);
          group.add(tile);
        });
        var arch = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.22, 12, 24, Math.PI), pinkMat);
        arch.position.set(0, 0.4, -1.5);
        group.add(arch);
        group.userData.labelHeight = 4.6;

      } else if (kind === 'carnival-portal') {
        // 02 任意門：粉紅魔法任意門與奇幻發光漩渦
        var doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.42), pinkMat);
        doorFrame.position.y = 1.95;
        group.add(doorFrame);
        var portalGlow = new THREE.Mesh(
          new THREE.PlaneGeometry(1.55, 2.65),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, side: THREE.DoubleSide })
        );
        portalGlow.position.set(0, 1.95, 0.24);
        group.add(portalGlow);
        var swirlRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 10, 20), goldMat);
        swirlRing.position.set(0, 1.95, 0.28);
        group.add(swirlRing);
        group.userData.spinPart = swirlRing;
        group.userData.labelHeight = 4.8;

      } else if (kind === 'carnival-slide') {
        // 03 滑梯公園：彩虹螺旋滑梯高塔
        var sTower = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 3.2, 14), cyanMat);
        sTower.position.set(-0.4, 1.95, -0.3);
        group.add(sTower);
        var sRoof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.2, 14), pinkMat);
        sRoof.position.set(-0.4, 4.1, -0.3);
        group.add(sRoof);
        // 彩虹滑梯斜道
        var chute = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 3.2), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }));
        chute.position.set(0.65, 1.65, 0.55);
        chute.rotation.x = 0.58;
        chute.rotation.y = -0.35;
        group.add(chute);
        group.userData.labelHeight = 5.3;

      } else if (kind === 'carnival-dumpling') {
        // 04 水餃工廠：巨型竹蒸籠美食攤與元寶水餃
        var stallRoof = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }));
        stallRoof.position.y = 0.58;
        group.add(stallRoof);
        var steamer1 = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.85, 20), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.75 }));
        steamer1.position.y = 1.22;
        group.add(steamer1);
        var steamer2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.75, 20), new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.75 }));
        steamer2.position.y = 2.02;
        group.add(steamer2);
        // 三顆飽滿大水餃
        [[-0.55, 0.3], [0.55, 0.3], [0, -0.45]].forEach(function (dp) {
          var dump = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), whiteMat);
          dump.scale.set(1.35, 0.82, 0.9);
          dump.position.set(dp[0], 2.58, dp[1]);
          group.add(dump);
        });
        group.userData.labelHeight = 4.6;

      } else if (kind === 'carnival-arcade') {
        // 05 無括號計算機：復古巨型街機電玩機台
        var cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.4, 1.8), purpleMat);
        cab.position.y = 2.05;
        group.add(cab);
        var screen = new THREE.Mesh(
          new THREE.PlaneGeometry(1.75, 1.35),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.65 })
        );
        screen.position.set(0, 2.45, 0.92);
        group.add(screen);
        var deck = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.35, 0.85), pinkMat);
        deck.position.set(0, 1.45, 1.15);
        deck.rotation.x = 0.25;
        group.add(deck);
        [-0.55, 0, 0.55].forEach(function (bx, i) {
          var btn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.15, 12), i === 1 ? goldMat : limeMat);
          btn.position.set(bx, 1.66, 1.25);
          group.add(btn);
        });
        group.userData.labelHeight = 5.0;

      } else if (kind === 'carnival-bus') {
        // 06 遊覽車共乘：雙層觀光歡樂巴士站
        var busLow = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.35, 1.85), orangeMat);
        busLow.position.y = 1.25;
        group.add(busLow);
        var busHigh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.15, 1.75), new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.45 }));
        busHigh.position.y = 2.45;
        group.add(busHigh);
        var winStrip = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.55, 1.82), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 }));
        winStrip.position.y = 2.45;
        group.add(winStrip);
        [[-1.0, 0.95], [1.0, 0.95], [-1.0, -0.95], [1.0, -0.95]].forEach(function (wp) {
          var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
          wh.rotation.x = Math.PI / 2;
          wh.position.set(wp[0], 0.65, wp[1]);
          group.add(wh);
        });
        group.userData.labelHeight = 4.6;

      } else if (kind === 'carnival-gacha') {
        // 07 扭蛋轉轉樂：巨型透明繽紛扭蛋機
        var gBase = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 1.65, 18), pinkMat);
        gBase.position.y = 1.18;
        group.add(gBase);
        var gDial = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 14), goldMat);
        gDial.rotation.x = Math.PI / 2;
        gDial.position.set(0, 1.25, 1.42);
        group.add(gDial);
        group.userData.spinPart = gDial;

        var gGlobe = new THREE.Mesh(
          new THREE.SphereGeometry(1.45, 20, 16),
          new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55, roughness: 0.1 })
        );
        gGlobe.position.y = 2.95;
        group.add(gGlobe);
        // 透明球內的彩色扭蛋
        var capCols = [0xf43f5e, 0xfacc15, 0x38bdf8, 0x4ade80, 0xa855f7];
        [[-0.5, 2.5, 0.4], [0.5, 2.5, 0.4], [0, 2.9, 0.55], [-0.4, 3.1, -0.3], [0.4, 3.1, -0.3]].forEach(function (cp, i) {
          var cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), new THREE.MeshStandardMaterial({ color: capCols[i], roughness: 0.25 }));
          cap.position.set(cp[0], cp[1], cp[2]);
          group.add(cap);
        });
        group.userData.labelHeight = 5.3;

      } else if (kind === 'carnival-coin') {
        // 08 換零錢機：黃金硬幣兌換亭（頂部巨型金幣旋轉）
        var booth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 2.0), cyanMat);
        booth.position.y = 1.6;
        group.add(booth);
        var bRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.2, 4), goldMat);
        bRoof.position.y = 3.45;
        bRoof.rotation.y = Math.PI / 4;
        group.add(bRoof);
        var bigCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 20), goldMat);
        bigCoin.rotation.x = Math.PI / 2;
        bigCoin.position.set(0, 4.45, 0);
        group.add(bigCoin);
        group.userData.spinPart = bigCoin;
        group.userData.labelHeight = 5.8;

      } else if (kind === 'carnival-mole') {
        // 09 打地鼠：歡樂打地鼠機台與探頭小地鼠
        var mTable = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.45, 2.2), limeMat);
        mTable.position.y = 1.08;
        group.add(mTable);
        var mBack = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.6, 0.35), orangeMat);
        mBack.position.set(0, 2.35, -0.92);
        group.add(mBack);
        var moleMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
        var moleGroup = new THREE.Group();
        [[-0.75, 0.3], [0, -0.25], [0.75, 0.3]].forEach(function (mp) {
          var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
          hole.position.set(mp[0], 1.82, mp[1]);
          group.add(hole);
          var mole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.65, 12), moleMat);
          mole.position.set(mp[0], 2.15, mp[1]);
          var nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), pinkMat);
          nose.position.set(mp[0], 2.28, mp[1] + 0.28);
          moleGroup.add(mole);
          moleGroup.add(nose);
        });
        group.add(moleGroup);
        group.userData.pulsePart = moleGroup;
        group.userData.labelHeight = 4.6;

      } else if (kind === 'carnival-radish') {
        // 10 拔蘿蔔：巨型大白蘿蔔豐收舞台
        var soilMound = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
        soilMound.position.y = 0.32;
        group.add(soilMound);
        var radishBody = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.35, 2.2, 16), whiteMat);
        radishBody.position.y = 1.65;
        group.add(radishBody);
        // 翠綠蘿蔔大葉片
        [-0.55, 0, 0.55].forEach(function (lx, i) {
          var rLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), limeMat);
          rLeaf.scale.set(0.65, 1.45, 0.55);
          rLeaf.position.set(lx, 3.15 + (i === 1 ? 0.25 : 0), 0);
          rLeaf.rotation.z = -lx * 0.6;
          group.add(rLeaf);
        });
        group.userData.labelHeight = 5.1;

      } else if (kind === 'carnival-wheel') {
        // 📸 證書製作所：3D 旋轉摩天輪照相館
        var legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.2, 8), pinkMat);
        legL.position.set(-1.1, 2.1, 0);
        legL.rotation.z = -0.22;
        group.add(legL);
        var legR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.2, 8), pinkMat);
        legR.position.set(1.1, 2.1, 0);
        legR.rotation.z = 0.22;
        group.add(legR);

        var wheelGroup = new THREE.Group();
        wheelGroup.position.set(0, 3.6, 0.35);
        var rim = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.12, 12, 28), goldMat);
        wheelGroup.add(rim);
        var cabinCols = [0xf43f5e, 0x38bdf8, 0xfacc15, 0x4ade80, 0xa855f7, 0xf97316];
        for (var cw = 0; cw < 6; cw++) {
          var cAng = (cw / 6) * Math.PI * 2;
          var spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.7, 6), whiteMat);
          spoke.rotation.z = cAng;
          wheelGroup.add(spoke);
          var cabMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 10, 10),
            new THREE.MeshStandardMaterial({ color: cabinCols[cw], roughness: 0.35 })
          );
          cabMesh.position.set(Math.cos(cAng) * 1.85, Math.sin(cAng) * 1.85, 0.15);
          wheelGroup.add(cabMesh);
        }
        group.add(wheelGroup);
        group.userData.spinPart = wheelGroup;
        group.userData.labelHeight = 6.2;

      } else {
        // 🏆 我的證書屋：3D 夢幻旋轉木馬帳篷（搭載開源 Horse.glb 骨骼動畫駿馬）
        var cPole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 12), goldMat);
        cPole.position.y = 1.9;
        group.add(cPole);
        var tentTop = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.55, 16), pinkMat);
        tentTop.position.y = 3.85;
        group.add(tentTop);
        var horses = new THREE.Group();
        horses.position.y = 1.25;
        for (var h = 0; h < 4; h++) {
          (function (hIdx) {
            var hAng = (hIdx / 4) * Math.PI * 2;
            var hx = Math.cos(hAng) * 1.38;
            var hz = Math.sin(hAng) * 1.38;
            var hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), goldMat);
            hBar.position.set(hx, 0.75, hz);
            horses.add(hBar);
            spawnGLBInstance(THREE, 'Horse.glb', { targetSize: 1.25, timeScale: 0.9 }, function (res) {
              res.group.position.set(hx, -0.35, hz);
              res.group.rotation.y = -hAng + Math.PI / 2;
              horses.add(res.group);
            });
          })(h);
        }
        group.add(horses);
        group.userData.spinPartY = horses;
        group.userData.labelHeight = 5.4;
      }

    } else if (kind && kind.indexOf('craft-') === 0) {
      // ⚙️ 清單與流程圖程式設計系列：蒸氣齒輪木工村・礦山鐵道風！
      var ironMat   = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
      var copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.65 });
      var brickMat  = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 });

      var craftBase = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.44, 3.4), stoneMat);
      craftBase.position.y = 0.22;
      group.add(craftBase);

      // 共用立體銅齒輪建構器
      function makeGearMesh(radius, thick, mat) {
        var gWrap = new THREE.Group();
        var disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thick, 16), mat || copperMat);
        disk.rotation.x = Math.PI / 2;
        gWrap.add(disk);
        for (var t = 0; t < 8; t++) {
          var ta = (t / 8) * Math.PI * 2;
          var tooth = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.34, radius * 0.34, thick * 0.95), mat || copperMat);
          tooth.position.set(Math.cos(ta) * radius, Math.sin(ta) * radius, 0);
          tooth.rotation.z = ta;
          gWrap.add(tooth);
        }
        return gWrap;
      }

      if (kind === 'craft-robot') {
        // 🤖 清單學習機：巨型發條機器人控制塔（搭載開源 RobotExpressive.glb 骨骼動畫機器人）
        var rLegs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.8), ironMat);
        rLegs.position.y = 0.9;
        group.add(rLegs);
        var rTorso = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.9, 2.2), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.4 }));
        rTorso.position.y = 2.35;
        group.add(rTorso);
        var rHead = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 1.8), copperMat);
        rHead.position.y = 4.0;
        group.add(rHead);
        [-0.48, 0.48].forEach(function (ex) {
          var rEye = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14),
            new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.9 })
          );
          rEye.rotation.x = Math.PI / 2;
          rEye.position.set(ex, 4.05, 0.92);
          group.add(rEye);
        });
        var windKey = makeGearMesh(0.85, 0.22, goldMat);
        windKey.position.set(0, 5.15, 0);
        group.add(windKey);
        group.userData.spinPart = windKey;
        spawnGLBInstance(THREE, 'RobotExpressive.glb', { targetSize: 2.35, clipName: 'Wave' }, function (res) {
          res.group.position.set(1.75, 0.44, 1.25);
          res.group.rotation.y = -0.35;
          group.add(res.group);
        });
        group.userData.labelHeight = 6.2;

      } else if (kind === 'craft-forge') {
        // 🔥 蒸氣齒輪鍛造屋（紅磚熔爐＋旋轉大銅齒輪＋鐵砧）
        var fWalls = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.3, 2.8), brickMat);
        fWalls.position.y = 1.55;
        group.add(fWalls);
        var fRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), ironMat);
        fRoof.position.y = 3.5;
        fRoof.rotation.y = Math.PI / 4;
        group.add(fRoof);
        var fChim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 2.2, 12), ironMat);
        fChim.position.set(-1.1, 3.8, -0.5);
        group.add(fChim);
        var furnace = new THREE.Mesh(
          new THREE.SphereGeometry(0.68, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.85 })
        );
        furnace.position.set(0, 1.1, 1.35);
        group.add(furnace);
        var fGear = makeGearMesh(0.92, 0.24, copperMat);
        fGear.position.set(0, 2.85, 1.52);
        group.add(fGear);
        group.userData.spinPart = fGear;
        group.userData.labelHeight = 5.4;

      } else if (kind === 'craft-watermill') {
        // 🌊 動力水車木工坊（側邊大型旋轉木水車）
        var wWalls = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.2, 2.7), woodMat);
        wWalls.position.y = 1.5;
        group.add(wWalls);
        var wRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.7, 4), new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.55 }));
        wRoof.position.y = 3.45;
        wRoof.rotation.y = Math.PI / 4;
        group.add(wRoof);
        var wheel = makeGearMesh(1.35, 0.35, darkWood);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(1.75, 1.65, 0);
        group.add(wheel);
        group.userData.spinPart = wheel;
        group.userData.labelHeight = 5.3;

      } else if (kind === 'craft-minecart') {
        // 💎 晶石礦車轉運站（木拱坑道口＋滿載發光水晶的鐵道礦車）
        var tunnel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.4), stoneMat);
        tunnel.position.set(0, 1.6, -0.3);
        group.add(tunnel);
        var holeArch = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.35), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
        holeArch.position.set(0, 1.25, 0.88);
        group.add(holeArch);
        // 礦車與發光藍紫水晶
        var cart = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.72, 1.45), ironMat);
        cart.position.set(0, 0.82, 1.35);
        group.add(cart);
        var gemMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.65, roughness: 0.2 });
        [[-0.28, 1.35], [0.28, 1.35], [0, 1.1]].forEach(function (gp) {
          var gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), gemMat);
          gem.position.set(gp[0], 1.32, gp[1]);
          group.add(gem);
        });
        var topGear = makeGearMesh(0.75, 0.2, copperMat);
        topGear.position.set(0, 2.95, 0.95);
        group.add(topGear);
        group.userData.spinPart = topGear;
        group.userData.labelHeight = 5.0;

      } else if (kind === 'craft-sawmill') {
        // 🪵 蒸氣圓鋸木工屋（旋轉金屬大圓鋸＋原木堆）
        var sWalls = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.1, 2.7), creamMat);
        sWalls.position.y = 1.45;
        group.add(sWalls);
        var sRoof = new THREE.Mesh(new THREE.ConeGeometry(2.75, 1.6, 4), copperMat);
        sRoof.position.y = 3.3;
        sRoof.rotation.y = Math.PI / 4;
        group.add(sRoof);
        var sawBlade = makeGearMesh(0.95, 0.14, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }));
        sawBlade.position.set(0, 1.65, 1.48);
        group.add(sawBlade);
        group.userData.spinPart = sawBlade;
        // 門口原木堆
        [-1.2, 1.2].forEach(function (lx) {
          var log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 10), darkWood);
          log.rotation.z = Math.PI / 2;
          log.position.set(lx, 0.68, 1.55);
          group.add(log);
        });
        group.userData.labelHeight = 5.2;

      } else if (kind === 'craft-temple') {
        // 🌟 晨星勇者：黃金雙齒輪冒險神殿
        var tSteps = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 3.8), goldMat);
        tSteps.position.y = 0.38;
        group.add(tSteps);
        [[-1.5, 1.3], [1.5, 1.3], [-1.5, -1.1], [1.5, -1.1]].forEach(function (cp) {
          var col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.6, 12), whiteMat);
          col.position.set(cp[0], 2.0, cp[1]);
          group.add(col);
        });
        var tRoof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), goldMat);
        tRoof.position.y = 4.15;
        tRoof.rotation.y = Math.PI / 4;
        group.add(tRoof);
        var starGear = makeGearMesh(1.05, 0.26, goldMat);
        starGear.position.set(0, 5.25, 0);
        group.add(starGear);
        group.userData.spinPart = starGear;
        group.userData.labelHeight = 6.4;

      } else {
        // 🕰️ 精密鐘錶機關屋（craft-clockwork）
        var cTower = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.1, 2.6), creamMat);
        cTower.position.y = 1.95;
        group.add(cTower);
        var cSpire = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.85, 4), ironMat);
        cSpire.position.y = 4.4;
        cSpire.rotation.y = Math.PI / 4;
        group.add(cSpire);
        var clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 20), whiteMat);
        clockFace.rotation.x = Math.PI / 2;
        clockFace.position.set(0, 2.55, 1.32);
        group.add(clockFace);
        var cGear = makeGearMesh(0.78, 0.22, goldMat);
        cGear.position.set(0, 2.55, 1.44);
        group.add(cGear);
        group.userData.spinPart = cGear;
        group.userData.labelHeight = 5.7;
      }

    } else if (kind && kind.indexOf('tech-') === 0) {
      // 🤖 智慧家居機電專題系列：未來科技創客實驗島！
      var techWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
      var techSlate = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.6 });
      var neonCyan  = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85 });
      var neonGreen = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.85 });

      var techBase = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.55, 0.38, 8), techSlate);
      techBase.position.y = 0.19;
      group.add(techBase);

      var baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.06, 8, 24), neonCyan);
      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.y = 0.38;
      group.add(baseRing);

      if (kind === 'tech-gatehouse') {
        // 🚪 第一節 感應大門：超音波智慧別墅與動態雷達波環
        var villa = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.4), techWhite);
        villa.position.set(0, 1.45, -0.3);
        group.add(villa);
        var vRoof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.32, 2.7), techSlate);
        vRoof.position.set(0, 2.68, -0.3);
        group.add(vRoof);
        // 雙眼超音波感測器模組 (HC-SR04 造型)
        [-0.48, 0.48].forEach(function (sx) {
          var eyeCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 }));
          eyeCyl.rotation.x = Math.PI / 2;
          eyeCyl.position.set(sx, 2.15, 0.95);
          group.add(eyeCyl);
        });
        // 發光感應滑門與脈衝音波環
        var sGate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.35, 0.18), neonGreen);
        sGate.position.set(0, 1.05, 1.15);
        group.add(sGate);
        var waveRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 10, 24), neonCyan);
        waveRing.position.set(0, 2.15, 1.35);
        group.add(waveRing);
        group.userData.pulsePart = waveRing;
        group.userData.labelHeight = 4.8;

      } else if (kind === 'tech-corridor') {
        // 💡 第二節 迎賓走廊：發光燈條科技長廊
        var cFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 3.2), techWhite);
        cFloor.position.y = 0.45;
        group.add(cFloor);
        var archGroup = new THREE.Group();
        [-1.1, -0.35, 0.35, 1.1].forEach(function (az, idx) {
          var aCol = idx % 2 === 0 ? neonCyan : neonGreen;
          var archBar = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.14, 10, 22, Math.PI), aCol);
          archBar.position.set(0, 0.55, az);
          archGroup.add(archBar);
        });
        group.add(archGroup);
        group.userData.pulsePart = archGroup;
        group.userData.labelHeight = 4.6;

      } else if (kind === 'tech-windtower') {
        // 🌀 第三節 無段風扇：巨型渦輪風洞實驗塔
        var wTower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 3.2, 16), techWhite);
        wTower.position.y = 1.95;
        group.add(wTower);
        var wDial = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.22, 16), neonGreen);
        wDial.rotation.x = Math.PI / 2;
        wDial.position.set(0, 1.25, 1.48);
        group.add(wDial);
        // 頂部高速渦輪風扇
        var turbine = new THREE.Group();
        turbine.position.set(0, 3.35, 1.28);
        var tHub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), techSlate);
        turbine.add(tHub);
        for (var b = 0; b < 3; b++) {
          var bWrap = new THREE.Group();
          bWrap.rotation.z = (b / 3) * Math.PI * 2;
          var blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.65, 0.08), neonCyan);
          blade.position.y = 0.85;
          bWrap.add(blade);
          turbine.add(bWrap);
        }
        group.add(turbine);
        group.userData.spinPart = turbine;
        group.userData.labelHeight = 5.6;

      } else if (kind === 'tech-rgbhouse') {
        // 🌈 第四節 情境照明：RGB 三原色光球玻璃溫室
        var rgbDome = new THREE.Mesh(
          new THREE.SphereGeometry(2.05, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.68, roughness: 0.15 })
        );
        rgbDome.position.y = 0.38;
        group.add(rgbDome);

        var orbsGroup = new THREE.Group();
        orbsGroup.position.y = 1.45;
        var rgbList = [
          { pos: [-0.75, 0, 0.45], col: 0xef4444 },
          { pos: [0.75,  0, 0.45], col: 0x22c55e },
          { pos: [0,  0.65, -0.45], col: 0x3b82f6 }
        ];
        rgbList.forEach(function (o) {
          var orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.52, 14, 14),
            new THREE.MeshStandardMaterial({ color: o.col, emissive: o.col, emissiveIntensity: 0.95 })
          );
          orb.position.set(o.pos[0], o.pos[1], o.pos[2]);
          orbsGroup.add(orb);
        });
        group.add(orbsGroup);
        group.userData.spinPart = orbsGroup;
        group.userData.labelHeight = 4.8;

      } else {
        // 🏆 第五節 自己的專案：創客研發總部圓頂實驗室 (tech-hq)
        var hqBody = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.15, 1.85, 8), techWhite);
        hqBody.position.y = 1.28;
        group.add(hqBody);
        var hqDome = new THREE.Mesh(new THREE.SphereGeometry(1.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), neonCyan);
        hqDome.position.y = 2.15;
        group.add(hqDome);
        var holoRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.1, 10, 24), goldMat);
        holoRing.position.set(0, 4.15, 0);
        holoRing.rotation.x = 0.55;
        group.add(holoRing);
        group.userData.spinPart = holoRing;
        group.userData.labelHeight = 5.8;
      }

    } else {
      // 🏠 動森高質感七彩村民小屋（魚鱗瓦屋頂、窗框花圃、拱門、煙囪、門前木牌）
      var roofHex = ROOF_PALETTE[kind] || 0xd97706;

      var cBase = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.42, 3.25), stoneMat);
      cBase.position.y = 0.21;
      group.add(cBase);

      var cWalls = new THREE.Mesh(new THREE.BoxGeometry(3.25, 2.3, 2.8), creamMat);
      cWalls.position.y = 1.56;
      group.add(cWalls);

      var cRoofMesh = new THREE.Mesh(
        new THREE.ConeGeometry(2.85, 1.8, 4),
        new THREE.MeshStandardMaterial({
          map: makeRoofTexture(THREE, roofHex),
          roughness: 0.52
        })
      );
      cRoofMesh.position.y = 3.55;
      cRoofMesh.rotation.y = Math.PI / 4;
      group.add(cRoofMesh);

      var cChim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.3, 0.52), stoneMat);
      cChim.position.set(1.0, 3.72, -0.45);
      group.add(cChim);

      // 木門與圓形門把
      var cDoor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.55, 0.2), woodMat);
      cDoor.position.set(-0.52, 1.18, 1.42);
      group.add(cDoor);
      var knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), goldMat);
      knob.position.set(-0.22, 1.15, 1.55);
      group.add(knob);

      // 帶花圃的立體窗戶
      var cWin = buildFramedWindow(THREE, 0.82, 0.78, true);
      cWin.position.set(0.72, 1.62, 1.42);
      group.add(cWin);

      // 門前小木牌
      var signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.95, 8), darkWood);
      signPost.position.set(-1.42, 0.48, 1.72);
      group.add(signPost);
      var signPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.14), woodMat);
      signPlate.position.set(-1.42, 0.88, 1.72);
      group.add(signPlate);

      group.userData.labelHeight = 5.3;
    }

    // ★ 為所有建築與設施自動加裝「動森精緻微縮景觀配件」（門前迎賓石階、雙側暖光小燈籠柱與花草盆栽）
    if (kind !== 'airport' && kind !== 'board' && (!kind || kind.indexOf('orchard-') !== 0 || kind === 'orchard-barn' || kind === 'orchard-mill' || kind === 'orchard-greenhouse')) {
      var stepStone = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.1, 12), stoneMat);
      stepStone.scale.set(1.35, 1, 0.85);
      stepStone.position.set(0, 0.05, 2.15);
      group.add(stepStone);

      // 門口右側小木桶盆栽與立體五瓣花
      var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.34, 10), woodMat);
      pot.position.set(1.75, 0.17, 1.55);
      group.add(pot);
      var bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 })
      );
      bush.position.set(1.75, 0.42, 1.55);
      group.add(bush);
      var flowerTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.2 })
      );
      flowerTop.position.set(1.75, 0.65, 1.55);
      group.add(flowerTop);
    }

    enableShadow(group, true, true);
    return group;
  }

  // ── 角色造型設定選項與本機儲存 ──
  var AVATAR_STORAGE_KEY = 'ac_avatar_look_v1';
  var HAT_OPTIONS = [
    { id: 'straw',  label: '🌾 探險草帽' },
    { id: 'sprout', label: '🌱 發芽小草' },
    { id: 'crown',  label: '👑 榮耀皇冠' },
    { id: 'ears',   label: '🐱 可愛貓耳' },
    { id: 'witch',  label: '🧙 魔法星帽' },
    { id: 'beret',  label: '🎨 貝雷畫帽' },
    { id: 'cap',    label: '🧢 活力球帽' }
  ];
  var SHIRT_OPTIONS = [
    { hex: '#0284c7', label: '海洋藍' },
    { hex: '#f43f5e', label: '櫻花粉' },
    { hex: '#10b981', label: '森林綠' },
    { hex: '#f59e0b', label: '向日葵黃' },
    { hex: '#8b5cf6', label: '薰衣草紫' },
    { hex: '#f97316', label: '活力橘' },
    { hex: '#1e293b', label: '酷炫黑' }
  ];
  var HAIR_OPTIONS = [
    { hex: '#5c3616', label: '栗子棕' },
    { hex: '#1e293b', label: '黑曜色' },
    { hex: '#eab308', label: '亞麻金' },
    { hex: '#dc2626', label: '櫻桃紅' },
    { hex: '#2563eb', label: '星空藍' },
    { hex: '#ec4899', label: '棉花糖粉' }
  ];
  var SKIN_OPTIONS = [
    { hex: '#ffedd5', label: '白皙' },
    { hex: '#fed7aa', label: '自然' },
    { hex: '#d99b66', label: '陽光小麥' }
  ];
  var BACK_OPTIONS = [
    { id: 'pack',  label: '🎒 探險背包' },
    { id: 'wings', label: '🦋 精靈翅膀' },
    { id: 'cape',  label: '🦸 勇者披風' },
    { id: 'none',  label: '✨ 輕裝不背' }
  ];

  function loadAvatarLook(genderCode) {
    var isFemale = String(genderCode) === '2';
    var def = {
      hat: 'straw',
      shirt: isFemale ? '#f43f5e' : '#0284c7',
      hair: '#5c3616',
      skin: '#ffedd5',
      back: 'pack'
    };
    try {
      var raw = localStorage.getItem(AVATAR_STORAGE_KEY) || sessionStorage.getItem(AVATAR_STORAGE_KEY);
      if (raw) return Object.assign({}, def, JSON.parse(raw));
    } catch (e) {}
    return def;
  }

  function saveAvatarLook(look) {
    try { localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(look)); } catch (e) {}
    try { sessionStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(look)); } catch (e) {}
  }

  // 建立高質感 3D 動森村民角色（支援自訂頭飾、服裝色、髮色、膚色、背部配件）
  function buildVillager3D(THREE, genderCode, look) {
    look = look || loadAvatarLook(genderCode);
    var group = new THREE.Group();

    var skinMat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.skin || '#ffedd5'), roughness: 0.55 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.shirt || '#0284c7'), roughness: 0.6 });
    var hairMat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair || '#5c3616'), roughness: 0.65 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    var shoeMat  = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    var goldMat  = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.55 });

    // 腳底明顯的動森定位光圈與陰影
    var footShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.35 })
    );
    footShadow.rotation.x = -Math.PI / 2;
    footShadow.position.y = 0.03;
    group.add(footShadow);

    var footRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.92, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    footRing.rotation.x = -Math.PI / 2;
    footRing.position.y = 0.04;
    group.add(footRing);

    var leftLeg = new THREE.Group();
    leftLeg.position.set(-0.25, 0.52, 0);
    var lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.52, 12), skinMat);
    lShin.position.y = -0.14;
    leftLeg.add(lShin);
    var lShoe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), shoeMat);
    lShoe.scale.set(0.95, 0.68, 1.35);
    lShoe.position.set(0, -0.38, 0.08);
    leftLeg.add(lShoe);
    var lSole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.21, 0.07, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    lSole.scale.set(0.96, 1, 1.35);
    lSole.position.set(0, -0.46, 0.08);
    leftLeg.add(lSole);
    group.add(leftLeg);

    var rightLeg = new THREE.Group();
    rightLeg.position.set(0.25, 0.52, 0);
    var rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.52, 12), skinMat);
    rShin.position.y = -0.14;
    rightLeg.add(rShin);
    var rShoe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), shoeMat);
    rShoe.scale.set(0.95, 0.68, 1.35);
    rShoe.position.set(0, -0.38, 0.08);
    rightLeg.add(rShoe);
    var rSole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.21, 0.07, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    rSole.scale.set(0.96, 1, 1.35);
    rSole.position.set(0, -0.46, 0.08);
    rightLeg.add(rSole);
    group.add(rightLeg);

    var hips = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.45, 0.44, 16), pantsMat);
    hips.position.y = 0.75;
    group.add(hips);

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.53, 0.9, 16), shirtMat);
    torso.position.y = 1.28;
    group.add(torso);

    // 衣服精緻鈕扣與腰帶扣環
    [1.18, 1.42].forEach(function (by) {
      var btn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), goldMat);
      btn.position.set(0, by, 0.49);
      group.add(btn);
    });
    var belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.50, 0.50, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 })
    );
    belt.position.y = 0.92;
    group.add(belt);
    var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), goldMat);
    buckle.position.set(0, 0.92, 0.5);
    group.add(buckle);

    var scarf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.51, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.45 })
    );
    scarf.position.y = 1.66;
    group.add(scarf);

    // 背部配件（背包／精靈翅膀／勇者披風／無）
    if (look.back === 'wings') {
      var wingMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      [-1, 1].forEach(function (dir) {
        var wUpper = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14), wingMat);
        wUpper.position.set(dir * 0.52, 1.48, -0.45);
        wUpper.rotation.y = -dir * 0.45;
        group.add(wUpper);
        var wLower = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), wingMat);
        wLower.position.set(dir * 0.42, 1.05, -0.45);
        wLower.rotation.y = -dir * 0.45;
        group.add(wLower);
      });
    } else if (look.back === 'cape') {
      var cape = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 })
      );
      cape.position.set(0, 1.1, -0.48);
      cape.rotation.x = 0.18;
      group.add(cape);
    } else if (look.back !== 'none') {
      var pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.64, 0.66, 0.36),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.62 })
      );
      pack.position.set(0, 1.28, -0.46);
      group.add(pack);
      var pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.32, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
      );
      pocket.position.set(0, 1.18, -0.66);
      group.add(pocket);
      var clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), goldMat);
      clasp.position.set(0, 1.32, -0.71);
      group.add(clasp);
    }

    var leftArm = new THREE.Group();
    leftArm.position.set(-0.56, 1.52, 0);
    var lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.58, 12), shirtMat);
    lSleeve.position.set(-0.06, -0.24, 0);
    lSleeve.rotation.z = 0.22;
    leftArm.add(lSleeve);
    var lHand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    lHand.position.set(-0.14, -0.56, 0);
    leftArm.add(lHand);
    group.add(leftArm);

    var rightArm = new THREE.Group();
    rightArm.position.set(0.56, 1.52, 0);
    var rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.58, 12), shirtMat);
    rSleeve.position.set(0.06, -0.24, 0);
    rSleeve.rotation.z = -0.22;
    rightArm.add(rSleeve);
    var rHand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    rHand.position.set(0.14, -0.56, 0);
    rightArm.add(rHand);
    group.add(rightArm);

    // 頭部、立體劉海與兩側鬢角（24 段高細分平滑球體）
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.73, 24, 20), skinMat);
    head.scale.set(1.04, 0.98, 1.0);
    head.position.y = 2.22;
    group.add(head);

    // 雙耳
    [-0.72, 0.72].forEach(function (earX) {
      var earMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), skinMat);
      earMesh.position.set(earX, 2.2, 0.05);
      group.add(earMesh);
    });

    var hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.76, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairBack.position.set(0, 2.26, -0.05);
    hairBack.rotation.x = -0.25;
    group.add(hairBack);

    // 前額立體劉海（3 束動森風蓬鬆劉海）
    [-0.26, 0, 0.26].forEach(function (bx, bi) {
      var bang = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), hairMat);
      bang.scale.set(0.95, 0.75, 0.65);
      bang.position.set(bx, 2.55 - (bi === 1 ? 0.04 : 0), 0.58);
      bang.rotation.z = bx * -0.35;
      group.add(bang);
    });

    [-0.56, 0.56].forEach(function (hx) {
      var sideLock = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), hairMat);
      sideLock.scale.set(0.85, 1.25, 0.85);
      sideLock.position.set(hx, 2.14, 0.28);
      group.add(sideLock);
    });

    // 動森招牌靈動大眼（含白色高光星點）、立體小圓鼻與微笑
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    var sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var cheekMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.68 });
    [-0.25, 0.25].forEach(function (ex) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 14), eyeMat);
      eye.scale.set(0.95, 1.22, 0.55);
      eye.position.set(ex, 2.24, 0.67);
      group.add(eye);
      var spk = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), sparkleMat);
      spk.position.set(ex + 0.03, 2.29, 0.72);
      group.add(spk);
    });
    var buttonNose = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    buttonNose.scale.set(1.1, 0.85, 0.9);
    buttonNose.position.set(0, 2.15, 0.73);
    group.add(buttonNose);

    var smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.018, 8, 14, Math.PI),
      eyeMat
    );
    smile.rotation.x = Math.PI;
    smile.position.set(0, 2.04, 0.69);
    group.add(smile);

    [-0.42, 0.42].forEach(function (cx) {
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), cheekMat);
      cheek.scale.set(1.25, 0.72, 0.45);
      cheek.position.set(cx, 2.09, 0.62);
      group.add(cheek);
    });

    // 7 種頭飾／帽子造型
    var hatStyle = look.hat || 'straw';
    if (hatStyle === 'sprout') {
      // 🌱 頭頂發芽小豆苗
      var stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 })
      );
      stem.position.set(0, 3.05, 0);
      group.add(stem);
      [-1, 1].forEach(function (dir) {
        var leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.45 })
        );
        leaf.scale.set(1.3, 0.4, 0.8);
        leaf.position.set(dir * 0.24, 3.3, 0);
        leaf.rotation.z = -dir * 0.35;
        group.add(leaf);
      });
    } else if (hatStyle === 'crown') {
      // 👑 榮耀小皇冠
      var cRing = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.36, 14), goldMat);
      cRing.position.y = 2.98;
      group.add(cRing);
      for (var p = 0; p < 5; p++) {
        var ang = (p / 5) * Math.PI * 2;
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 6), goldMat);
        tip.position.set(Math.cos(ang) * 0.42, 3.24, Math.sin(ang) * 0.42);
        group.add(tip);
      }
    } else if (hatStyle === 'ears') {
      // 🐱 可愛貓耳
      [-0.45, 0.45].forEach(function (ex) {
        var ear = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 8), hairMat);
        ear.position.set(ex, 2.95, 0.05);
        ear.rotation.z = ex < 0 ? 0.25 : -0.25;
        group.add(ear);
      });
    } else if (hatStyle === 'witch') {
      // 🧙 星光魔法師尖帽
      var wMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.6 });
      var wBrim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.09, 18), wMat);
      wBrim.position.y = 2.68;
      group.add(wBrim);
      var wCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.25, 16), wMat);
      wCone.position.y = 3.28;
      group.add(wCone);
      var wBand = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.12, 16), goldMat);
      wBand.position.y = 2.75;
      group.add(wBand);
    } else if (hatStyle === 'beret') {
      // 🎨 畫家貝雷帽
      var bMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.65 });
      var beret = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 12), bMat);
      beret.scale.set(1.12, 0.45, 1.12);
      beret.position.set(0.08, 2.82, 0);
      beret.rotation.z = -0.14;
      group.add(beret);
      var bTip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), bMat);
      bTip.position.set(0.12, 3.08, 0);
      group.add(bTip);
    } else if (hatStyle === 'cap') {
      // 🧢 活力棒球帽
      var capDome = new THREE.Mesh(new THREE.SphereGeometry(0.73, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), shirtMat);
      capDome.position.y = 2.38;
      group.add(capDome);
      var visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.55), shirtMat);
      visor.position.set(0, 2.62, 0.55);
      visor.rotation.x = 0.12;
      group.add(visor);
    } else {
      // 🌾 動森經典探險草帽
      var hatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 });
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.11, 18), hatMat);
      brim.position.y = 2.66;
      group.add(brim);

      var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.45, 16), hatMat);
      crown.position.y = 2.88;
      group.add(crown);

      var band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.69, 0.13, 16),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
      );
      band.position.y = 2.74;
      group.add(band);
    }

    enableShadow(group, true, false);
    group.userData.limbs = {
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      leftArm: leftArm,
      rightArm: rightArm
    };
    return group;
  }

  // 建立各島專屬 3D 動森動物島長 NPC（站在廣場向學生揮手打招呼、點擊會跳躍給予鼓勵）
  function buildMascotNPC3D(THREE, variantKey) {
    var cfgMap = {
      hub: {
        name: '🦝 狸克島務長',
        fur: 0xb45309, belly: 0xfde68a, shirt: 0x22c55e, earType: 'round',
        hat: 'leaf',
        tips: ['歡迎來到科技探險群島！點擊任一學習館就能出發囉！', '試試右上角的「🌅 晝夜切換」，夜晚的島嶼超美喔！', '搖搖島上的果樹，說不定會掉下驚喜果實！']
      },
      ethics: {
        name: '🐿️ 蘋蘋松鼠園長',
        fur: 0xea580c, belly: 0xffedd5, shirt: 0x16a34a, earType: 'squirrel',
        hat: 'straw',
        tips: ['果園裡的每棵果樹都藏著資安與倫理知識喔！', '通關後果樹上方會升起閃亮的金星光環！', '走上北邊石階，還有金蘋果神木與陽光溫室等你挑戰！']
      },
      thinking: {
        name: '🐰 奇奇魔術兔',
        fur: 0xffffff, belly: 0xfce7f3, shirt: 0xec4899, earType: 'bunny',
        hat: 'tophat',
        tips: ['歡迎來到森林奇幻遊樂園！10 座遊樂設施都開放囉！', '過關後記得截圖，去旋轉木馬回報亭領取榮譽證書！', '切換到「🌙 星夜」模式，摩天輪跟旋轉木馬會亮起霓虹燈喔！']
      },
      code: {
        name: '🦫 齒輪海狸師傅',
        fur: 0x78350f, belly: 0xfef3c7, shirt: 0xd97706, earType: 'round',
        hat: 'goggles',
        tips: ['先找廣場旁的發條機器人完成「清單學習機」前導訓練吧！', '排對流程圖再上傳 Scratch 作品，每關最多能拿 6 顆星！', '十座蒸氣工坊任你挑選，通關後屋頂會升起黃金榮譽星！']
      },
      flowchart: {
        name: '🦫 齒輪海狸師傅',
        fur: 0x78350f, belly: 0xfef3c7, shirt: 0xd97706, earType: 'round',
        hat: 'goggles',
        tips: ['先找廣場旁的發條機器人完成「清單學習機」前導訓練吧！', '排對流程圖再上傳 Scratch 作品，每關最多能拿 6 顆星！', '十座蒸氣工坊任你挑選，通關後屋頂會升起黃金榮譽星！']
      },
      arduino: {
        name: '🤖 諾克號創客機',
        fur: 0x38bdf8, belly: 0xe0f2fe, shirt: 0x0284c7, earType: 'antenna',
        hat: 'halo',
        tips: ['嗶嗶！歡迎光臨未來科技創客實驗島！', '點擊任一智慧家居實驗艙，就能在浮動視窗裡操作 3D 感測模擬器！', '切換到星夜模式，整座科技島的光電迴路都會發光喔！']
      }
    };
    var info = cfgMap[variantKey] || cfgMap.hub;
    var group = new THREE.Group();

    var furMat   = new THREE.MeshStandardMaterial({ color: info.fur, roughness: 0.55 });
    var bellyMat = new THREE.MeshStandardMaterial({ color: info.belly, roughness: 0.6 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: info.shirt, roughness: 0.5 });
    var darkMat  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });

    // 柔和地面陰影
    var sh = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 18),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.28 })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.03;
    group.add(sh);

    // 小短腿與圓滾滾身體
    [-0.24, 0.24].forEach(function (lx) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 10), furMat);
      leg.position.set(lx, 0.25, 0);
      group.add(leg);
    });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 0.95, 16), shirtMat);
    body.position.y = 0.92;
    group.add(body);
    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), bellyMat);
    belly.scale.set(1, 1.1, 0.45);
    belly.position.set(0, 0.9, 0.42);
    group.add(belly);

    // 雙手（右手會揮手打招呼）
    var leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 10), furMat);
    leftArm.position.set(-0.56, 0.96, 0);
    leftArm.rotation.z = 0.32;
    group.add(leftArm);

    var rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.54, 1.18, 0);
    var rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 10), furMat);
    rightArm.position.set(0.12, 0.22, 0);
    rightArm.rotation.z = -2.4;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    // 大圓頭與臉部
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 18), furMat);
    head.scale.set(1.08, 0.96, 1.0);
    head.position.y = 1.92;
    group.add(head);

    var snout = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), bellyMat);
    snout.scale.set(1.2, 0.85, 0.8);
    snout.position.set(0, 1.82, 0.58);
    group.add(snout);

    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), darkMat);
    nose.position.set(0, 1.9, 0.78);
    group.add(nose);

    [-0.25, 0.25].forEach(function (ex) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), darkMat);
      eye.scale.set(0.95, 1.18, 0.65);
      eye.position.set(ex, 1.98, 0.61);
      group.add(eye);
      var spk = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      spk.position.set(ex + 0.028, 2.02, 0.66);
      group.add(spk);
      var blush = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.58 })
      );
      blush.scale.set(1.3, 0.65, 0.4);
      blush.position.set(ex * 1.45, 1.84, 0.57);
      group.add(blush);
    });

    // 耳朵與大尾巴
    if (info.earType === 'bunny') {
      [-0.28, 0.28].forEach(function (bx) {
        var ear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.75, 10), furMat);
        ear.position.set(bx, 2.75, -0.05);
        ear.rotation.z = bx * -0.25;
        group.add(ear);
      });
    } else if (info.earType === 'antenna') {
      var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), darkMat);
      ant.position.set(0, 2.75, 0);
      group.add(ant);
      var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0x38bdf8, emissiveIntensity: 0.9 })
      );
      orb.position.set(0, 3.05, 0);
      group.add(orb);
    } else {
      [-0.42, 0.42].forEach(function (rx) {
        var rEar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), furMat);
        rEar.position.set(rx, 2.48, -0.05);
        group.add(rEar);
      });
      if (info.earType === 'squirrel') {
        var bigTail = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), furMat);
        bigTail.scale.set(0.75, 1.35, 0.95);
        bigTail.position.set(0, 1.15, -0.68);
        bigTail.rotation.x = -0.35;
        group.add(bigTail);
      }
    }

    // 主題頭飾
    if (info.hat === 'tophat') {
      var thMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.4 });
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), thMat);
      brim.position.y = 2.52;
      group.add(brim);
      var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.52, 16), thMat);
      cyl.position.y = 2.8;
      group.add(cyl);
    } else if (info.hat === 'goggles') {
      var gogMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.25 });
      [-0.22, 0.22].forEach(function (gx) {
        var gRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16), gogMat);
        gRing.position.set(gx, 2.28, 0.55);
        group.add(gRing);
      });
    } else if (info.hat === 'straw') {
      var sBrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
      );
      sBrim.position.y = 2.52;
      group.add(sBrim);
    }

    enableShadow(group, true, false);
    group.userData = {
      isNPC: true,
      name: info.name,
      tips: info.tips,
      tipIdx: 0,
      rightArmPivot: rightArmPivot,
      jumpTime: 0
    };
    return group;
  }

  // 建立已通關建築專屬「3D 屋頂旋轉金星王冠 ＋ 門口慶祝花環」
  function buildVictoryCrown3D(THREE, labelHeight) {
    var vg = new THREE.Group();
    var topY = (labelHeight || 5.2) + 0.65;

    var starGroup = new THREE.Group();
    starGroup.position.y = topY;

    var goldStarMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      metalness: 0.65,
      roughness: 0.18
    });
    var starCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), goldStarMat);
    starCore.scale.set(1.15, 1.15, 0.55);
    starGroup.add(starCore);

    var haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.06, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
    );
    haloRing.rotation.x = Math.PI / 2;
    starGroup.add(haloRing);
    vg.add(starGroup);

    // 建築門口慶祝花叢
    var flColors = [0xf43f5e, 0xfacc15, 0x38bdf8, 0xa855f7, 0x4ade80];
    for (var fi = 0; fi < 5; fi++) {
      var ang = -Math.PI * 0.15 + (fi / 4) * Math.PI * 1.3;
      var fx = Math.cos(ang) * 2.55;
      var fz = Math.sin(ang) * 2.35;
      var fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshStandardMaterial({
          color: flColors[fi % flColors.length],
          emissive: flColors[fi % flColors.length],
          emissiveIntensity: 0.2,
          roughness: 0.4
        })
      );
      fl.position.set(fx, 0.2, fz);
      vg.add(fl);
    }

    vg.userData.starGroup = starGroup;
    return vg;
  }

  /* ── 5. 標準化各頁面傳入的節點欄位 ────────────────────────────── */
  function normalizeNode(n, cfg) {
    var title = n.title || n.label || ('單元 ' + n.id);
    var shortTitle = n.shortTitle || n.label || n.title || ('單元 ' + n.id);
    var badge = n.badge || n.num || n.sign || '';
    var tag = n.speaker || ((n.icon ? n.icon + ' ' : '🍃 ') + (n.tag || '島嶼設施'));
    var descHtml = n.descHtml || esc(n.dialog || n.desc || '');
    var starsText = n.starsText || n.sub || '';
    var actions = n.actions;
    if (!actions || !actions.length) {
      actions = [{
        label: n.actionLabel || '進入探險 →',
        primary: true,
        onClick: function (nodeObj) {
          if (typeof cfg.onOpen === 'function') cfg.onOpen(nodeObj);
        }
      }];
    }
    return Object.assign({}, n, {
      title: title,
      shortTitle: shortTitle,
      badge: badge,
      speakerTag: tag,
      descHtml: descHtml,
      starsText: starsText,
      actions: actions
    });
  }

  /* ── 6. 預設裝飾樹清單 ───────────────────────────────────────── */
  var DEFAULT_PROPS = [
    { x: 14, y: 24, kind: 'pine-tree',  drops: ['🌲 木材 +1', '🍄 蘑菇 +1', '💰 100鈴錢'] },
    { x: 87, y: 23, kind: 'pine-tree',  drops: ['🌲 軟木材 +1', '🐝 樹枝 +1', '✨ 星星碎片'] },
    { x: 14, y: 55, kind: 'fruit-tree', fruit: 'apple',  drops: ['🍎 蘋果 +1', '🍎 蘋果 +1', '💰 100鈴錢'] },
    { x: 87, y: 54, kind: 'fruit-tree', fruit: 'orange', drops: ['🍊 橘子 +1', '🍊 橘子 +1', '🍑 蜜桃 +1'] },
    { x: 18, y: 80, kind: 'palm-tree',  drops: ['🥥 椰子 +1', '🐚 貝殼 +1'] },
    { x: 83, y: 81, kind: 'palm-tree',  drops: ['🥥 椰子 +1', '🦀 寄居蟹'] }
  ];

  /* ── 7. 主掛載函式 AC_ISLAND.mount(container, cfg) ───────────── */
  var activeInstance = null;

  function mount(container, cfg) {
    if (!container) return null;
    cfg = cfg || {};
    if (activeInstance && activeInstance.destroy) {
      activeInstance.destroy();
      activeInstance = null;
    }

    var isSubIsland = (cfg.variant && cfg.variant !== 'hub') ||
                      (location.pathname.indexOf('hub.html') < 0 && cfg.pageId !== 'hub');
    var hubHref = (global.CONFIG && global.CONFIG.HUB_PAGE) || 'hub.html';

    var pageKey = cfg.storageKey || ('ac_pos_' + (cfg.pageId || location.pathname));
    var savedPos = null;
    try { savedPos = JSON.parse(sessionStorage.getItem(pageKey) || 'null'); } catch (e) {}

    var rawNodes = (cfg.nodes || []).slice();
    // ★ 若在子單元島嶼（非 hub 主島），自動在南方 Dodo 碼頭加入「✈️ Dodo 機場（回主島入口）」地標！
    if (isSubIsland && !rawNodes.some(function (n) { return n.id === 'dodo-airport'; })) {
      rawNodes.push({
        id: 'dodo-airport',
        x: 50,
        y: 84,
        kind: 'airport',
        icon: '✈️',
        badge: '機場',
        title: 'Dodo Airlines 水上機場（返回主島入口）',
        shortTitle: '回主島入口',
        speaker: '🦤 莫里（Dodo Airlines 機場櫃檯）',
        desc: '想搭水上飛機回到「科技探險島」主入口大廳、切換其他課程單元嗎？隨時跟我說一聲就能起飛喔！',
        actions: [{ label: '✈️ 搭機返回主島入口', href: hubHref, primary: true }]
      });
    }

    var nodes = rawNodes.map(function (n) { return normalizeNode(n, cfg); });
    var rawProps = cfg.props || cfg.trees || DEFAULT_PROPS;
    var props = rawProps.map(function (p) {
      return Object.assign({ drops: ['🍎 果實 +1', '💰 100鈴錢'] }, p);
    });

    var savedTimeMode = 'day';
    try { savedTimeMode = localStorage.getItem('ac_time_mode') || 'day'; } catch (e) {}
    if (['day', 'sunset', 'night'].indexOf(savedTimeMode) < 0) savedTimeMode = 'day';

    var timeBtnLabelMap = {
      day:    '☀️ 時段：晴朗白天',
      sunset: '🌇 時段：魔幻夕陽',
      night:  '🌙 時段：璀璨星夜'
    };

    var state = {
      px: (savedPos && savedPos.x) || cfg.startX || 50,
      py: (savedPos && savedPos.y) || cfg.startY || 72,
      tx: null,
      ty: null,
      heading: 0,
      walking: false,
      keys: {},
      nearId: null,
      selectedId: cfg.initialSelectedId || (nodes[0] && nodes[0].id) || null,
      camMode: 'follow',
      timeMode: savedTimeMode,
      focusUntil: 0,
      yawOffset: 0,
      zoomDist: 1.0,
      destroyed: false,
      rafId: null
    };

    var nodesOverlayHtml = nodes.map(function (n) {
      var cls = 'ac-node' + (n.locked ? ' is-locked' : '');
      var flag = n.flagText
        ? '<div class="ac-node-flag ' + (n.flagKind === 'next' ? 'flag-next' : '') + '">' + esc(n.flagText) + '</div>'
        : '';
      var stars = n.starsText
        ? '<div class="ac-node-stars ' + (n.pass ? 'is-pass' : '') + '">' + esc(n.starsText) + '</div>'
        : (n.badgeHtml || '');
      var isAirport = n.id === 'dodo-airport';
      var labelStyle = isAirport ? 'style="background:#e0f2fe;border-color:#0284c7;color:#0c4a6e"' : '';
      return '<div class="' + cls + '" tabindex="0" role="button" data-node="' + esc(n.id) + '">'
        + flag
        + stars
        + '<div class="ac-node-label" ' + labelStyle + '>'
        +   (n.badge ? '<span class="text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full border border-amber-300">' + esc(n.badge) + '</span>' : '')
        +   '<span>' + esc(n.shortTitle) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');

    var backHubBtnHtml = isSubIsland
      ? '<a href="' + esc(hubHref) + '" class="ac-cam-btn" style="background:#fef3c7;border-color:#f59e0b;color:#78350f;text-decoration:none;display:inline-flex;align-items:center;gap:4px">✈️ 返回主島入口</a>'
      : '';

    container.innerHTML = ''
      + '<div class="ac-island-wrap pop">'
      +   '<div class="ac-island-stage" id="ac-stage">'
      +     '<canvas id="ac-webgl-canvas" class="ac-webgl-canvas"></canvas>'
      +     '<div class="ac-controls-bar">'
      +       '<div class="flex items-center gap-2 flex-wrap">'
      +         backHubBtnHtml
      +         '<button type="button" id="ac-wardrobe-toggle" class="ac-cam-btn" style="background:#fdf2f8;border-color:#f472b6;color:#9d174d">🪞 更換造型</button>'
      +         '<button type="button" id="ac-time-toggle" class="ac-cam-btn" style="background:#eff6ff;border-color:#60a5fa;color:#1e3a8a">' + timeBtnLabelMap[state.timeMode] + '</button>'
      +         '<button type="button" id="ac-cam-toggle" class="ac-cam-btn">🎥 視角：動森跟隨（點擊切換全島鳥瞰）</button>'
      +       '</div>'
      +       '<div class="ac-controls-hint hidden md:block">🎮 WASD / 方向鍵走動 · 點擊 3D 建築或地面移動 · 滑鼠拖曳旋轉視角 / 滾輪縮放</div>'
      +     '</div>'
      +     '<div id="ac-wardrobe-panel" class="ac-wardrobe-panel hidden"></div>'
      +     '<div id="ac-overlay" class="ac-overlay-layer">'
      +       nodesOverlayHtml
      +       '<div id="ac-npc-tag" class="ac-npc-tag" title="點擊與島長對話">🦝 島長</div>'
      +       '<div id="ac-robot-tag" class="ac-npc-tag" style="background:linear-gradient(135deg,#0284c7,#1d4ed8);border-color:#bae6fd;color:#fff" title="點擊切換 3D 機器人骨骼動畫">🤖 3D 創客機（點我熱舞）</div>'
      +       '<div id="ac-player-tag" class="ac-player-tag">🧑‍🌾 ' + esc(cfg.playerName || '島民') + '</div>'
      +     '</div>'
      +     '<div id="ac-dialog" class="ac-dialog-bar"></div>'
      +   '</div>'
      + '</div>';

    var stageEl   = container.querySelector('#ac-stage');
    var canvasEl  = container.querySelector('#ac-webgl-canvas');
    var overlayEl = container.querySelector('#ac-overlay');
    var playerTag = container.querySelector('#ac-player-tag');
    var npcTag    = container.querySelector('#ac-npc-tag');
    var robotTag  = container.querySelector('#ac-robot-tag');
    var dialogEl  = container.querySelector('#ac-dialog');
    var camBtn    = container.querySelector('#ac-cam-toggle');
    var timeBtn   = container.querySelector('#ac-time-toggle');
    var wardrobeBtn   = container.querySelector('#ac-wardrobe-toggle');
    var wardrobePanel = container.querySelector('#ac-wardrobe-panel');
    var currentLook   = loadAvatarLook(cfg.genderCode);
    var rebuildPlayerFn = null;
    var applyTimeModeFn = null;

    if (timeBtn) {
      timeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var order = ['day', 'sunset', 'night'];
        var nextIdx = (order.indexOf(state.timeMode) + 1) % order.length;
        state.timeMode = order[nextIdx];
        try { localStorage.setItem('ac_time_mode', state.timeMode); } catch (err) {}
        timeBtn.textContent = timeBtnLabelMap[state.timeMode];
        if (applyTimeModeFn) applyTimeModeFn(state.timeMode);
      });
    }

    function renderWardrobe() {
      if (!wardrobePanel) return;
      var hatsHtml = HAT_OPTIONS.map(function (h) {
        var act = currentLook.hat === h.id ? ' is-active' : '';
        return '<button type="button" data-look-k="hat" data-look-v="' + h.id + '" class="ac-wardrobe-chip' + act + '">' + h.label + '</button>';
      }).join('');
      var shirtsHtml = SHIRT_OPTIONS.map(function (s) {
        var act = currentLook.shirt === s.hex ? ' is-active' : '';
        return '<button type="button" data-look-k="shirt" data-look-v="' + s.hex + '" title="' + s.label + '" class="ac-color-dot' + act + '" style="background:' + s.hex + '"></button>';
      }).join('');
      var hairsHtml = HAIR_OPTIONS.map(function (h) {
        var act = currentLook.hair === h.hex ? ' is-active' : '';
        return '<button type="button" data-look-k="hair" data-look-v="' + h.hex + '" title="' + h.label + '" class="ac-color-dot' + act + '" style="background:' + h.hex + '"></button>';
      }).join('');
      var skinsHtml = SKIN_OPTIONS.map(function (sk) {
        var act = currentLook.skin === sk.hex ? ' is-active' : '';
        return '<button type="button" data-look-k="skin" data-look-v="' + sk.hex + '" title="' + sk.label + '" class="ac-color-dot' + act + '" style="background:' + sk.hex + '"></button>';
      }).join('');
      var backsHtml = BACK_OPTIONS.map(function (b) {
        var act = currentLook.back === b.id ? ' is-active' : '';
        return '<button type="button" data-look-k="back" data-look-v="' + b.id + '" class="ac-wardrobe-chip' + act + '">' + b.label + '</button>';
      }).join('');

      wardrobePanel.innerHTML = ''
        + '<div class="flex items-center justify-between border-b-2 border-amber-200 pb-2 mb-2.5">'
        +   '<div class="font-black text-sm text-amber-950">🪞 動森島民隨身梳妝鏡</div>'
        +   '<div class="flex items-center gap-1.5">'
        +     '<button type="button" id="ac-look-random" class="ac-wardrobe-chip" style="background:#fef3c7;border-color:#f59e0b">🎲 隨機穿搭</button>'
        +     '<button type="button" id="ac-look-close" class="ac-wardrobe-chip">✕ 關閉</button>'
        +   '</div>'
        + '</div>'
        + '<div class="space-y-2.5 text-xs">'
        +   '<div><div class="font-black text-stone-600 mb-1">🎩 頭飾 / 帽子</div><div class="flex flex-wrap gap-1.5">' + hatsHtml + '</div></div>'
        +   '<div><div class="font-black text-stone-600 mb-1">👕 服裝顏色</div><div class="flex flex-wrap gap-2 py-0.5">' + shirtsHtml + '</div></div>'
        +   '<div class="flex items-center justify-between gap-3">'
        +     '<div><div class="font-black text-stone-600 mb-1">💇 髮色</div><div class="flex flex-wrap gap-1.5 py-0.5">' + hairsHtml + '</div></div>'
        +     '<div><div class="font-black text-stone-600 mb-1">😊 膚色</div><div class="flex flex-wrap gap-1.5 py-0.5">' + skinsHtml + '</div></div>'
        +   '</div>'
        +   '<div><div class="font-black text-stone-600 mb-1">🎒 背部配件</div><div class="flex flex-wrap gap-1.5">' + backsHtml + '</div></div>'
        + '</div>';
    }

    if (wardrobeBtn && wardrobePanel) {
      wardrobeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        wardrobePanel.classList.toggle('hidden');
        if (!wardrobePanel.classList.contains('hidden')) renderWardrobe();
      });
      wardrobePanel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('#ac-look-close')) {
          wardrobePanel.classList.add('hidden');
          return;
        }
        if (e.target.closest('#ac-look-random')) {
          currentLook = {
            hat:   HAT_OPTIONS[Math.floor(Math.random() * HAT_OPTIONS.length)].id,
            shirt: SHIRT_OPTIONS[Math.floor(Math.random() * SHIRT_OPTIONS.length)].hex,
            hair:  HAIR_OPTIONS[Math.floor(Math.random() * HAIR_OPTIONS.length)].hex,
            skin:  SKIN_OPTIONS[Math.floor(Math.random() * SKIN_OPTIONS.length)].hex,
            back:  BACK_OPTIONS[Math.floor(Math.random() * BACK_OPTIONS.length)].id
          };
          saveAvatarLook(currentLook);
          renderWardrobe();
          if (rebuildPlayerFn) rebuildPlayerFn();
          return;
        }
        var btn = e.target.closest('[data-look-k]');
        if (btn) {
          var k = btn.getAttribute('data-look-k');
          var v = btn.getAttribute('data-look-v');
          currentLook[k] = v;
          saveAvatarLook(currentLook);
          renderWardrobe();
          if (rebuildPlayerFn) rebuildPlayerFn();
        }
      });
    }

    function savePos() {
      try {
        sessionStorage.setItem(pageKey, JSON.stringify({
          x: Math.round(state.px * 10) / 10,
          y: Math.round(state.py * 10) / 10
        }));
      } catch (e) {}
    }

    function findNode(id) {
      for (var i = 0; i < nodes.length; i++) {
        if (String(nodes[i].id) === String(id)) return nodes[i];
      }
      return null;
    }

    function spawnFloatScreen(screenX, screenY, text) {
      if (!overlayEl) return;
      var el = document.createElement('div');
      el.className = 'ac-float-pop';
      el.style.left = screenX + 'px';
      el.style.top  = screenY + 'px';
      el.textContent = text;
      overlayEl.appendChild(el);
      setTimeout(function () { el.remove(); }, 950);
    }

    var npcInfoMap = {
      hub: {
        name: '🦝 狸克島務長',
        role: '群島總導覽員',
        tips: [
          '歡迎來到「科技探險群島」！我是島務長狸克，點選島上的每座主題館就能搭機前往各系列島嶼喔！',
          '看到左上角的「☀️ 時段」按鈕了嗎？點一下可以切換「晴朗白天、魔幻夕陽、璀璨星夜」三種光影！',
          '想換穿不同帽子、衣服或背上精靈翅膀？點左上角「🪞 更換造型」隨時都能打扮自己！',
          '走近島上的蘋果樹、橘子樹或椰子樹並點一下，樹上的果實就會掉下來喔！',
          '不知道先去哪一座島嗎？點右邊的「🧭 帶我去推薦關卡」，我直接幫你帶路！'
        ]
      },
      ethics: {
        name: '🐿️ 蘋蘋松鼠園長',
        role: '豐收果園守護者',
        tips: [
          '歡迎來到「豐收果園與陽光溫室島」！這裡的每一棵果樹都代表一個資訊倫理與資安章節喔！',
          '點擊果樹會先開啟「重點整理」浮動視窗，讀完再按「開始挑戰」，連續答對就能摘下黃金果實！',
          '只要通過一個章節，那棵果樹或穀倉的屋頂就會升起「3D 旋轉黃金榮譽星」與慶祝花叢！',
          '走上北邊的石階斜坡，高台上還有「金蘋果傳說神木」與「陽光玻璃大溫室」總複習等你挑戰！',
          '把 10 個章節全部通關後，就能解鎖主島上的「🏆 排行賽露營地」跟全校高手過招喔！'
        ]
      },
      thinking: {
        name: '🐰 奇奇魔術兔',
        role: '森林遊樂園園長',
        tips: [
          '歡迎光臨「森林奇幻遊樂園」！島上的 10 座遊樂設施分別對應 10 道國際運算思維謎題！',
          '不管是滑梯公園、電流急急棒還是小籠包攤位，順序完全自由，想玩哪一座就直接點進去！',
          '在挑戰視窗過關後，記得按 Windows + Alt + PrintScreen 擷取視窗畫面！',
          '截好圖之後，走去廣場西側的「🎠 旋轉木馬通關回報亭」上傳截圖，就能領取通關證書囉！',
          '試試切換成「🌙 璀璨星夜」模式，夜晚的摩天輪與遊樂園超浪漫喔！'
        ]
      },
      code: {
        name: '🦫 齒輪海狸師傅',
        role: '蒸氣木工村總工程師',
        tips: [
          '歡迎來到「蒸氣齒輪木工村」！先去找廣場旁邊的「🤖 發條機器人」完成清單學習機前導訓練吧！',
          '這裡十座蒸氣工坊全部開放！每一關都是先排好「流程圖 (+2⭐)」，再去寫「Scratch 程式 (最多 +3⭐)」！',
          '點擊任一工坊後，背景的 3D 水車與蒸氣齒輪會持續運轉，讓你邊看風景邊在浮動視窗裡排流程圖！',
          '拿到 2⭐ 以上就算完成，如果想挑戰滿分 3⭐，隨時可以點工坊再傳一次 Scratch 作品！',
          '十關都完成後，別忘了去北邊高台的「🏛️ 黃金齒輪神殿」挑戰晨星號火箭喔！'
        ]
      },
      flowchart: {
        name: '🦫 齒輪海狸師傅',
        role: '蒸氣木工村總工程師',
        tips: [
          '歡迎來到「蒸氣齒輪木工村」！先去找廣場旁邊的「🤖 發條機器人」完成清單學習機前導訓練吧！',
          '這裡十座蒸氣工坊全部開放！每一關都是先排好「流程圖 (+2⭐)」，再去寫「Scratch 程式 (最多 +3⭐)」！',
          '點擊任一工坊後，背景的 3D 水車與蒸氣齒輪會持續運轉，讓你邊看風景邊在浮動視窗裡排流程圖！',
          '拿到 2⭐ 以上就算完成，如果想挑戰滿分 3⭐，隨時可以點工坊再傳一次 Scratch 作品！',
          '十關都完成後，別忘了去北邊高台的「🏛️ 黃金齒輪神殿」挑戰晨星號火箭喔！'
        ]
      },
      arduino: {
        name: '🤖 諾克號創客機',
        role: '未來創客島 AI 領航員',
        tips: [
          '嗶嗶！歡迎登陸「未來科技創客實驗島」！我是你的 AI 領航員諾克號！',
          '島上的 5 座科技實驗艙分別展示智慧門閘、人體感應燈廊、風力能源塔、光控圓頂與研發總部！',
          '點擊任一實驗艙，就能在科技浮動視窗裡親手操作「3D 互動硬體模擬器」與檢視積木程式邏輯！',
          '在浮動視窗開啟時，背景的 3D 攝影機會自動推進特寫該座科技建築喔！',
          '切換到「🌙 璀璨星夜」模式，整座科技島的光電迴路與霓虹圓頂都會閃閃發光！'
        ]
      }
    };
    var currentNpcInfo = npcInfoMap[cfg.variant || 'hub'] || npcInfoMap.hub;
    var npcTipIndex = 0;
    var triggerMascotJumpFn = null;

    function guideToRecommendedNode() {
      var candidate = null;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id === 'dodo-airport' || n.locked) continue;
        if (!n.done && !n.pass) {
          candidate = n;
          break;
        }
      }
      if (!candidate && nodes.length > 0) candidate = nodes[0];
      if (!candidate) return;
      state.selectedId = candidate.id;
      state.nearId = candidate.id;
      state.tx = candidate.x;
      state.ty = Math.min(86, candidate.y + 4.0);
      renderDialog();
    }

    function renderDialog() {
      if (!dialogEl) return;
      if (state.selectedId === '__npc__' || state.nearId === '__npc__') {
        dialogEl.classList.remove('hidden');
        var tips = currentNpcInfo.tips;
        var msg = tips[npcTipIndex % tips.length];
        var idxLabel = '秘訣 ' + ((npcTipIndex % tips.length) + 1) + ' / ' + tips.length;
        dialogEl.innerHTML = ''
          + '<div class="ac-dialog-speaker" style="background:linear-gradient(90deg,#d97706,#b45309)">' + esc(currentNpcInfo.name + ' · ' + currentNpcInfo.role) + '</div>'
          + '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">'
          +   '<div class="min-w-0 flex-1">'
          +     '<div class="flex items-center gap-2 flex-wrap">'
          +       '<h3 class="text-base sm:text-lg font-black text-amber-950 truncate">💬 島長導覽對話</h3>'
          +       '<span class="text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">' + idxLabel + '</span>'
          +     '</div>'
          +     '<p class="text-xs sm:text-sm text-stone-700 font-bold mt-0.5 leading-relaxed">' + esc(msg) + '</p>'
          +   '</div>'
          +   '<div class="flex items-center gap-2 flex-wrap shrink-0">'
          +     '<button type="button" id="ac-npc-next-tip" class="ac-btn-primary">💬 繼續聊天（下一句）</button>'
          +     '<button type="button" id="ac-npc-guide-me" class="ac-btn-secondary">🧭 帶我去推薦關卡</button>'
          +   '</div>'
          + '</div>';
        return;
      }

      var activeNode = findNode(state.nearId || state.selectedId) || nodes[0];
      if (!activeNode) {
        dialogEl.classList.add('hidden');
        return;
      }
      dialogEl.classList.remove('hidden');

      var btnsHtml = '';
      if (activeNode.locked) {
        btnsHtml = '<span class="text-xs font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-full">🔒 '
          + esc(activeNode.lockReason || '尚未解鎖') + '</span>';
      } else {
        var actions = activeNode.actions || [];
        btnsHtml = actions.map(function (a, i) {
          var cls = a.primary !== false && i === 0 ? 'ac-btn-primary' : 'ac-btn-secondary';
          var attrs = a.attrs || '';
          if (a.href) {
            return '<a href="' + esc(a.href) + '" ' + attrs + ' class="' + cls + '">' + esc(a.label || '進入 →') + '</a>';
          }
          return '<button type="button" data-ac-act="' + i + '" data-ac-node="' + esc(activeNode.id) + '" ' + attrs + ' class="' + cls + '">'
            + esc(a.label || '進入 →') + '</button>';
        }).join('');
      }

      dialogEl.innerHTML = ''
        + '<div class="ac-dialog-speaker">' + esc(activeNode.speakerTag) + '</div>'
        + '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">'
        +   '<div class="min-w-0 flex-1">'
        +     '<div class="flex items-center gap-2 flex-wrap">'
        +       '<h3 class="text-base sm:text-lg font-black text-amber-950 truncate">' + esc(activeNode.title) + '</h3>'
        +       (activeNode.starsText ? '<span class="text-xs font-black text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">' + esc(activeNode.starsText) + '</span>' : '')
        +       (activeNode.statusLabel ? '<span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">' + esc(activeNode.statusLabel) + '</span>' : '')
        +     '</div>'
        +     '<p class="text-xs sm:text-sm text-stone-600 font-medium mt-0.5 line-clamp-2">' + activeNode.descHtml + '</p>'
        +   '</div>'
        +   '<div class="flex items-center gap-2 flex-wrap shrink-0">' + btnsHtml + '</div>'
        + '</div>';
    }

    function triggerNodeAction(node, actionIdx) {
      if (!node || node.locked) return;
      savePos();
      if (typeof cfg.onSelectNode === 'function') cfg.onSelectNode(node);
      var actions = node.actions || [];
      var act = actions[actionIdx || 0];
      if (!act) {
        if (typeof cfg.onOpen === 'function') cfg.onOpen(node);
        return;
      }
      if (typeof act.onClick === 'function') {
        act.onClick(node);
      } else if (act.href) {
        location.href = act.href;
      } else if (typeof cfg.onOpen === 'function') {
        cfg.onOpen(node);
      }
    }

    renderDialog();

    // 載入 Three.js 並建構高畫質 PBR 3D 動森島嶼場景
    var cleanupThree = null;
    loadThree().then(function (THREE) {
      if (state.destroyed || !canvasEl.isConnected) return;
      activeGlbMixers = [];

      var renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      if (THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
      }

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0x88def8);
      scene.fog = new THREE.FogExp2(0x9be7fa, 0.0058);

      var camera = new THREE.PerspectiveCamera(37, 16 / 10, 0.5, 260);

      // ── 燈光系統（PBR 半球天光 ＋ 4096 高解析暖陽陰影 ＋ 補光） ──
      var hemiLight = new THREE.HemisphereLight(0xe0f7ff, 0x4ade80, 0.78);
      hemiLight.position.set(0, 55, 0);
      scene.add(hemiLight);

      var sunLight = new THREE.DirectionalLight(0xfffbeb, 1.05);
      sunLight.position.set(28, 48, 32);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 135;
      var d = 48;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0004;
      scene.add(sunLight);

      var fillLight = new THREE.DirectionalLight(0xbae6fd, 0.28);
      fillLight.position.set(-25, 22, -20);
      scene.add(fillLight);

      // ── 將整個島嶼放入 worldGroup：透過微傾 worldGroup 呈現動森視角，確保所有地形與角色在同一座標系，絕不穿模！ ──
      var worldGroup = new THREE.Group();
      scene.add(worldGroup);

      var grassColors = {
        hub:       ['#62c65f', '#4cb04c'],
        ethics:    ['#84cc16', '#65a30d'], // 🍎 豐收果園：暖陽秋收金綠草地
        thinking:  ['#34d399', '#10b981'], // 🎪 森林遊樂園：繽紛薄荷糖果綠草地
        code:      ['#65a30d', '#4d7c0f'], // ⚙️ 蒸氣木工村：沉穩工坊森林草地
        flowchart: ['#65a30d', '#4d7c0f'],
        arduino:   ['#2dd4bf', '#0d9488']  // 🤖 未來創客島：科技青翠草地
      };
      var variantKey = cfg.variant || 'hub';
      var gc = grassColors[variantKey] || grassColors.hub;
      var grassTex = makeGrassTexture(THREE, gc[0], gc[1]);
      var plazaTex = makePlazaTexture(THREE);

      // ── 1. 3D 波光海洋、白色浪花圈與沙灘島基 ──
      var seaGeo = new THREE.PlaneGeometry(250, 210, 36, 36);
      seaGeo.rotateX(-Math.PI / 2);
      var seaMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.16,
        roughness: 0.22,
        metalness: 0.15
      });
      var seaMesh = new THREE.Mesh(seaGeo, seaMat);
      seaMesh.position.y = -1.25;
      worldGroup.add(seaMesh);

      var foamGeo = new THREE.CylinderGeometry(45.8, 46.5, 0.22, 56);
      foamGeo.scale(1.06, 1, 0.72);
      var foamMesh = new THREE.Mesh(
        foamGeo,
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 })
      );
      foamMesh.position.y = -1.1;
      worldGroup.add(foamMesh);

      // 金色沙灘外環（頂面在 y = -0.15，草地外圈自然露出金色沙灘）
      var sandGeo = new THREE.CylinderGeometry(42.8, 45.4, 1.8, 56, 1);
      sandGeo.scale(1.05, 1, 0.70);
      var sandMesh = new THREE.Mesh(
        sandGeo,
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
      );
      sandMesh.position.y = -1.0;
      sandMesh.receiveShadow = true;
      worldGroup.add(sandMesh);

      // 主島第一層草地高台（頂面精確位於 y = 0.0）
      var islandGeo = new THREE.CylinderGeometry(39.2, 40.8, 1.6, 56, 1);
      islandGeo.scale(1.04, 1, 0.68);
      var islandMesh = new THREE.Mesh(
        islandGeo,
        new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.78 })
      );
      islandMesh.position.y = -0.8;
      islandMesh.receiveShadow = true;
      worldGroup.add(islandMesh);

      // 北側第二層懸崖高台（精確對應 wz ∈ [-24, -12.5]，頂面位於 y = CLIFF_HEIGHT = 2.8）
      var cliffGroup = new THREE.Group();
      var cliffDepth = 12.2;
      var cliffCenterZ = CLIFF_Z_EDGE - cliffDepth * 0.5; // -18.6
      var cliffWall = new THREE.Mesh(
        new THREE.BoxGeometry(55.0, CLIFF_HEIGHT, cliffDepth),
        new THREE.MeshStandardMaterial({ color: 0x8b6946, roughness: 0.88 })
      );
      cliffWall.position.set(0, CLIFF_HEIGHT * 0.5, cliffCenterZ);
      cliffWall.castShadow = true;
      cliffWall.receiveShadow = true;
      cliffGroup.add(cliffWall);

      var cliffTop = new THREE.Mesh(
        new THREE.BoxGeometry(54.8, 0.24, cliffDepth - 0.1),
        new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.78 })
      );
      cliffTop.position.set(0, CLIFF_HEIGHT, cliffCenterZ);
      cliffTop.receiveShadow = true;
      cliffGroup.add(cliffTop);
      worldGroup.add(cliffGroup);

      // 懸崖石階斜坡（連接一樓 wz = -7.5 與二層高台 wz = -12.5，wx ∈ [-9.8, -2.2]）
      var rampGroup = new THREE.Group();
      var rampCenterX = (RAMP_X_MIN + RAMP_X_MAX) * 0.5; // -6.0
      var rampWidth = RAMP_X_MAX - RAMP_X_MIN;           // 7.6
      for (var stp = 0; stp < 8; stp++) {
        var frac = (stp + 0.5) / 8;
        var stepZ = RAMP_Z_SOUTH - frac * (RAMP_Z_SOUTH - CLIFF_Z_EDGE);
        var stepH = frac * CLIFF_HEIGHT;
        var stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(rampWidth, stepH, 0.72),
          new THREE.MeshStandardMaterial({ color: stp % 2 ? 0xd6c7ae : 0xe7d7c1, roughness: 0.75 })
        );
        stepMesh.position.set(rampCenterX, stepH * 0.5, stepZ);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        rampGroup.add(stepMesh);
      }
      worldGroup.add(rampGroup);

      // 中央動森廣場石磚地坪
      var plazaMesh = new THREE.Mesh(
        new THREE.BoxGeometry(16.8, 0.12, 10.6),
        new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.75 })
      );
      plazaMesh.position.set(0, 0.02, 0.5);
      plazaMesh.receiveShadow = true;
      worldGroup.add(plazaMesh);

      // 石板步道
      var stonePathMat = new THREE.MeshStandardMaterial({ color: 0xe7d5bc, roughness: 0.8 });
      var pathCoords = [
        [0, 7.2], [0, 9.8], [0, 12.4], [0, 15.0], [0, 17.6],
        [-10.5, 0.5], [-14.0, 0.5], [-17.5, 0.5],
        [10.5, 0.5], [14.0, 0.5], [17.5, 0.5]
      ];
      pathCoords.forEach(function (pc) {
        var stone = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.38, 0.1, 12), stonePathMat);
        stone.position.set(pc[0], 0.02, pc[1]);
        stone.receiveShadow = true;
        worldGroup.add(stone);
      });

      // ── 2. 3D 瀑布、河流與拱形紅木橋 ──
      var waterfallGroup = new THREE.Group();
      var upperPond = new THREE.Mesh(
        new THREE.CylinderGeometry(3.8, 3.8, 0.16, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 })
      );
      upperPond.position.set(19.5, CLIFF_HEIGHT + 0.08, -15.2);
      waterfallGroup.add(upperPond);

      var fallWater = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, CLIFF_HEIGHT + 0.1, 0.45),
        new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.88 })
      );
      fallWater.position.set(19.5, CLIFF_HEIGHT * 0.5, CLIFF_Z_EDGE + 0.15);
      waterfallGroup.add(fallWater);

      var riverMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.1, 27.5),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 })
      );
      riverMesh.position.set(20.8, 0.02, 1.2);
      riverMesh.rotation.y = -0.1;
      waterfallGroup.add(riverMesh);

      var bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(20.5, 0.22, -1.5);
      var bridgeDeck = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 0.28, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
      );
      bridgeGroup.add(bridgeDeck);
      [-1.4, 1.4].forEach(function (bz) {
        var rail = new THREE.Mesh(
          new THREE.BoxGeometry(6.2, 0.68, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
        );
        rail.position.set(0, 0.44, bz);
        bridgeGroup.add(rail);
      });
      waterfallGroup.add(bridgeGroup);
      worldGroup.add(waterfallGroup);

      // ── 3. 南方 Dodo Airlines 木棧碼頭與水上飛機 ──
      var pierGroup = new THREE.Group();
      var pierDeck = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.32, 10.5),
        new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.75 })
      );
      pierDeck.position.set(0, 0.02, 22.5);
      pierGroup.add(pierDeck);

      [[-2.2, 18.8], [2.2, 18.8], [-2.2, 22.5], [2.2, 22.5], [-2.2, 26.2], [2.2, 26.2]].forEach(function (pl) {
        var post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 2.2, 10),
          new THREE.MeshStandardMaterial({ color: 0x5c3616, roughness: 0.8 })
        );
        post.position.set(pl[0], -0.45, pl[1]);
        pierGroup.add(post);
      });

      var planeGroup = new THREE.Group();
      planeGroup.position.set(5.6, -0.35, 24.8);
      planeGroup.rotation.y = -0.45;
      var fuselage = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 1.4, 3.6),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      fuselage.position.y = 0.88;
      planeGroup.add(fuselage);
      var wing = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 0.18, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 })
      );
      wing.position.set(0, 1.7, 0.2);
      planeGroup.add(wing);
      var propBlade = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.22, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
      );
      propBlade.position.set(0, 0.88, 1.9);
      planeGroup.add(propBlade);
      if (isSubIsland) {
        planeGroup.userData.nodeId = 'dodo-airport';
      }
      pierGroup.add(planeGroup);
      enableShadow(pierGroup, true, true);
      worldGroup.add(pierGroup);

      // ── 4. 島嶼暖光街燈（含夜間光暈）、星夜穹頂與晝夜光影系統 ──
      var lampMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });
      var bulbMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.85 });
      var lampHaloMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.14 });
      var groundLightMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.0 });
      [[-8.5, 5.2], [8.5, 5.2], [-8.5, -4.5], [8.5, -4.5], [-3.2, 16.5], [3.2, 16.5]].forEach(function (lp) {
        var lg = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.8, 10), lampMat);
        pole.position.y = 1.4;
        lg.add(pole);
        var globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), bulbMat);
        globe.position.y = 2.9;
        lg.add(globe);
        var halo = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 12), lampHaloMat);
        halo.position.y = 2.9;
        lg.add(halo);
        var gPool = new THREE.Mesh(new THREE.CircleGeometry(2.8, 20), groundLightMat);
        gPool.rotation.x = -Math.PI / 2;
        gPool.position.y = 0.04;
        lg.add(gPool);
        lg.position.set(lp[0], getExactSurfaceY(lp[0], lp[1]), lp[1]);
        enableShadow(lg, true, false);
        worldGroup.add(lg);
      });

      // 中央廣場夜間暖色點光源
      var plazaNightLight = new THREE.PointLight(0xfbbf24, 0, 42, 1.5);
      plazaNightLight.position.set(0, 7.5, 2.0);
      worldGroup.add(plazaNightLight);

      // 3D 璀璨星空穹頂與弦月（夕陽與星夜模式自動浮現）
      var starFieldGroup = new THREE.Group();
      var starMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0 });
      for (var sIdx = 0; sIdx < 95; sIdx++) {
        var stMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (sIdx % 3) * 0.07, 6, 6), starMat);
        var sTheta = (sIdx * 2.39996) % (Math.PI * 2);
        var sRad = 32 + (sIdx % 7) * 8;
        stMesh.position.set(
          Math.cos(sTheta) * sRad * 1.3,
          22 + (sIdx % 9) * 3.2,
          -25 - Math.abs(Math.sin(sTheta)) * 38
        );
        starFieldGroup.add(stMesh);
      }
      var moonMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0 });
      var moonMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 18), moonMat);
      moonMesh.position.set(-28, 34, -48);
      starFieldGroup.add(moonMesh);
      scene.add(starFieldGroup);

      // ── 4B. 依據各課程系列主題（variant）鋪設專屬 3D 島嶼環境裝飾 ──
      if (variantKey === 'ethics') {
        // 🍎 資訊倫理與安全（豐收果園）：原木農莊圍欄 ＋ 廣場野餐墊與豐收水果籃
        var fenceMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78 });
        [[-16, 12], [-12, 12], [12, 12], [16, 12], [-22, -6], [22, -6]].forEach(function (fp) {
          var fg = new THREE.Group();
          [-0.9, 0.9].forEach(function (px) {
            var post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.35, 8), fenceMat);
            post.position.set(px, 0.68, 0);
            fg.add(post);
          });
          [0.45, 0.95].forEach(function (ry) {
            var rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.12), fenceMat);
            rail.position.set(0, ry, 0);
            fg.add(rail);
          });
          fg.position.set(fp[0], getExactSurfaceY(fp[0], fp[1]), fp[1]);
          enableShadow(fg, true, true);
          worldGroup.add(fg);
        });
        // 廣場紅白格野餐墊與蘋果籃
        var matPicnic = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.08, 2.4),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.65 })
        );
        matPicnic.position.set(-4.2, 0.09, 2.8);
        worldGroup.add(matPicnic);
      } else if (variantKey === 'thinking') {
        // 🎪 運算思維挑戰（森林遊樂園）：歡樂彩色氣球柱 ＋ 廣場星光舞台圓環
        var balloonCols = [0xf43f5e, 0x38bdf8, 0xfacc15, 0xa855f7, 0x4ade80];
        [[-11.5, 6.2], [11.5, 6.2], [-11.5, -5.8], [11.5, -5.8], [-19.5, 2.0], [16.5, 9.0]].forEach(function (bp, idx) {
          var bg = new THREE.Group();
          var bPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
          bPole.position.y = 1.4;
          bg.add(bPole);
          [[-0.35, 2.9, 0], [0.35, 3.05, 0.15], [0, 3.35, -0.15]].forEach(function (sp, si) {
            var bal = new THREE.Mesh(
              new THREE.SphereGeometry(0.42, 12, 12),
              new THREE.MeshStandardMaterial({ color: balloonCols[(idx + si) % balloonCols.length], roughness: 0.25 })
            );
            bal.scale.set(0.9, 1.15, 0.9);
            bal.position.set(sp[0], sp[1], sp[2]);
            bg.add(bal);
          });
          bg.position.set(bp[0], getExactSurfaceY(bp[0], bp[1]), bp[1]);
          enableShadow(bg, true, false);
          worldGroup.add(bg);
        });
        var carnRing = new THREE.Mesh(
          new THREE.RingGeometry(4.5, 5.2, 32),
          new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide })
        );
        carnRing.rotation.x = -Math.PI / 2;
        carnRing.position.set(0, 0.09, 0.5);
        worldGroup.add(carnRing);
      } else if (variantKey === 'code' || variantKey === 'flowchart') {
        // ⚙️ 清單與流程圖程式設計（蒸氣齒輪木工村）：地面礦山鐵軌枕木 ＋ 金色巨型地面齒輪圖騰
        var tieMat = new THREE.MeshStandardMaterial({ color: 0x5c3616, roughness: 0.85 });
        var railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.35 });
        var trackGroup = new THREE.Group();
        for (var tx = -16; tx <= 14; tx += 1.6) {
          var tie = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 1.8), tieMat);
          tie.position.set(tx, 0.06, 0.5);
          trackGroup.add(tie);
        }
        [-0.55, 0.55].forEach(function (rz) {
          var rBar = new THREE.Mesh(new THREE.BoxGeometry(31.5, 0.14, 0.14), railMat);
          rBar.position.set(-1.0, 0.12, 0.5 + rz);
          trackGroup.add(rBar);
        });
        worldGroup.add(trackGroup);
      } else if (variantKey === 'arduino') {
        // 🤖 智慧家居機電專題（未來科技創客實驗島）：太陽能光電板陣列 ＋ 發光能量導線與科技光柱
        var panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.65, roughness: 0.2 });
        var neonLineMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 });
        [[-14.5, 9.5], [14.5, 9.5], [-16.5, -5.5], [15.5, -5.5]].forEach(function (sp) {
          var sg = new THREE.Group();
          var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.1, 8), lampMat);
          stand.position.y = 0.55;
          sg.add(stand);
          var board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.5), panelMat);
          board.position.y = 1.15;
          board.rotation.x = 0.42;
          sg.add(board);
          sg.position.set(sp[0], getExactSurfaceY(sp[0], sp[1]), sp[1]);
          enableShadow(sg, true, true);
          worldGroup.add(sg);
        });
        var circuitRing = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.15, 8), neonLineMat);
        circuitRing.rotation.x = -Math.PI / 2;
        circuitRing.position.set(0, 0.09, 0.5);
        worldGroup.add(circuitRing);
      }

      // ── 4C. 四大主題 3D 飄浮環境粒子系統（花粉落葉／嘉年華泡泡／蒸氣火星／科技光點／星夜螢火蟲） ──
      var ambientParticles = [];
      var pColorsByVariant = {
        hub:       [0xfef08a, 0x86efac, 0xfda4af],
        ethics:    [0xfde047, 0xfca5a5, 0x86efac], // 金色花粉與花瓣
        thinking:  [0xf472b6, 0x38bdf8, 0xfacc15, 0xc084fc], // 奇幻彩球與泡泡
        code:      [0xf59e0b, 0xfef3c7, 0xfb923c], // 蒸氣火星與暖光
        flowchart: [0xf59e0b, 0xfef3c7, 0xfb923c],
        arduino:   [0x38bdf8, 0x2dd4bf, 0x818cf8]  // 科技青色數位能量塊
      };
      var pCols = pColorsByVariant[variantKey] || pColorsByVariant.hub;
      var pGeo = (variantKey === 'arduino' || variantKey === 'code' || variantKey === 'flowchart')
        ? new THREE.BoxGeometry(0.22, 0.22, 0.22)
        : new THREE.SphereGeometry(0.16, 8, 8);

      for (var pIdx = 0; pIdx < 32; pIdx++) {
        var pm = new THREE.Mesh(
          pGeo,
          new THREE.MeshBasicMaterial({
            color: pCols[pIdx % pCols.length],
            transparent: true,
            opacity: 0.78
          })
        );
        var px0 = (Math.random() - 0.5) * 58;
        var pz0 = (Math.random() - 0.5) * 38;
        var py0 = 1.2 + Math.random() * 9.5;
        pm.position.set(px0, py0, pz0);
        worldGroup.add(pm);
        ambientParticles.push({
          mesh: pm,
          baseX: px0,
          baseZ: pz0,
          y: py0,
          vy: (variantKey === 'ethics' || variantKey === 'hub') ? -(0.015 + Math.random() * 0.018) : (0.016 + Math.random() * 0.02),
          phase: Math.random() * Math.PI * 2
        });
      }

      // 3D 飛舞蝴蝶
      var butterflies = [];
      var bfCols = [0xfde047, 0xf472b6, 0x38bdf8, 0xa855f7];
      [[-12, 8], [12, 6], [-5, -5], [14, -7], [-15, -3]].forEach(function (bp, bi) {
        var bfg = new THREE.Group();
        var wMat = new THREE.MeshBasicMaterial({ color: bfCols[bi % bfCols.length], side: THREE.DoubleSide });
        var lw = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), wMat);
        lw.position.x = -0.15;
        var rw = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), wMat);
        rw.position.x = 0.15;
        bfg.add(lw);
        bfg.add(rw);
        bfg.position.set(bp[0], 1.8, bp[1]);
        bfg.userData = { cx: bp[0], cz: bp[1], lw: lw, rw: rw, phase: bi * 2.1 };
        worldGroup.add(bfg);
        butterflies.push(bfg);
      });

      // ── 5. 天空立體白雲與晝夜光影切換器 ──
      var clouds = [];
      var cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.92 });
      [[-28, 19, -32], [4, 21, -36], [32, 18, -28], [-18, 20, -22], [24, 22, -20]].forEach(function (cp) {
        var cg = new THREE.Group();
        [[0, 0, 0, 2.5], [-1.9, -0.3, 0.2, 1.8], [1.9, -0.2, -0.1, 1.85]].forEach(function (sp) {
          var m = new THREE.Mesh(new THREE.SphereGeometry(sp[3], 12, 10), cloudMat);
          m.position.set(sp[0], sp[1], sp[2]);
          cg.add(m);
        });
        cg.position.set(cp[0], cp[1], cp[2]);
        scene.add(cg);
        clouds.push(cg);
      });

      applyTimeModeFn = function (mode) {
        if (mode === 'sunset') {
          scene.background.setHex(0xfda4af);
          scene.fog.color.setHex(0xfb923c);
          hemiLight.color.setHex(0xfecdd3);
          hemiLight.groundColor.setHex(0xb45309);
          hemiLight.intensity = 0.72;
          sunLight.color.setHex(0xf97316);
          sunLight.intensity = 1.18;
          sunLight.position.set(38, 24, 28);
          fillLight.color.setHex(0xfde047);
          fillLight.intensity = 0.35;
          seaMat.color.setHex(0x0284c7);
          seaMat.emissive.setHex(0xd97706);
          seaMat.emissiveIntensity = 0.28;
          cloudMat.color.setHex(0xffedd5);
          bulbMat.emissiveIntensity = 1.6;
          lampHaloMat.opacity = 0.48;
          groundLightMat.opacity = 0.22;
          plazaNightLight.intensity = 0.65;
          starMat.opacity = 0.32;
          moonMat.opacity = 0.45;
        } else if (mode === 'night') {
          scene.background.setHex(0x0f172a);
          scene.fog.color.setHex(0x1e1b4b);
          hemiLight.color.setHex(0x6366f1);
          hemiLight.groundColor.setHex(0x064e3b);
          hemiLight.intensity = 0.56;
          sunLight.color.setHex(0x93c5fd);
          sunLight.intensity = 0.58;
          sunLight.position.set(-24, 42, 26);
          fillLight.color.setHex(0x38bdf8);
          fillLight.intensity = 0.25;
          seaMat.color.setHex(0x0c4a6e);
          seaMat.emissive.setHex(0x1e3a8a);
          seaMat.emissiveIntensity = 0.32;
          cloudMat.color.setHex(0x94a3b8);
          bulbMat.emissiveIntensity = 2.4;
          lampHaloMat.opacity = 0.88;
          groundLightMat.opacity = 0.45;
          plazaNightLight.intensity = 1.45;
          starMat.opacity = 0.95;
          moonMat.opacity = 0.95;
        } else {
          scene.background.setHex(0x88def8);
          scene.fog.color.setHex(0x9be7fa);
          hemiLight.color.setHex(0xe0f7ff);
          hemiLight.groundColor.setHex(0x4ade80);
          hemiLight.intensity = 0.78;
          sunLight.color.setHex(0xfffbeb);
          sunLight.intensity = 1.05;
          sunLight.position.set(28, 48, 32);
          fillLight.color.setHex(0xbae6fd);
          fillLight.intensity = 0.28;
          seaMat.color.setHex(0x0ea5e9);
          seaMat.emissive.setHex(0x0284c7);
          seaMat.emissiveIntensity = 0.16;
          cloudMat.color.setHex(0xffffff);
          bulbMat.emissiveIntensity = 0.85;
          lampHaloMat.opacity = 0.14;
          groundLightMat.opacity = 0.0;
          plazaNightLight.intensity = 0.0;
          starMat.opacity = 0.0;
          moonMat.opacity = 0.0;
        }
      };
      applyTimeModeFn(state.timeMode);

      // ── 6. 放置裝飾果樹、關卡 3D 建築（含通關金星王冠）與 3D 島長 NPC ──
      var interactiveMeshes = [];
      if (isSubIsland) interactiveMeshes.push(planeGroup);
      var propEntries = [];
      var fallingFruits = [];

      // 建立站在中央廣場旁的 3D 動物島長 NPC
      var mascotWx = -4.5, mascotWz = 3.6;
      var mascotPctX = worldToPctX(mascotWx);
      var mascotPctY = worldToPctY(mascotWz);
      var mascotWy = getExactSurfaceY(mascotWx, mascotWz);
      var mascotMesh = buildMascotNPC3D(THREE, variantKey);
      mascotMesh.position.set(mascotWx, mascotWy, mascotWz);
      mascotMesh.rotation.y = 0.35;
      worldGroup.add(mascotMesh);
      interactiveMeshes.push(mascotMesh);
      if (npcTag) {
        npcTag.textContent = currentNpcInfo.name + ' 💬（點我對話）';
      }

      var foxCompanion = null;
      var plazaRobot = null;
      var robotClipCycle = ['Wave', 'Dance', 'Jump', 'ThumbsUp', 'Idle'];
      var robotClipIdx = 0;

      triggerMascotJumpFn = function () {
        mascotMesh.userData.jumpTime = performance.now();
        if (foxCompanion && foxCompanion.actions) {
          if (foxCompanion.actions.Run && foxCompanion.actions.Survey) {
            foxCompanion.actions.Survey.stop();
            foxCompanion.actions.Run.reset().play();
            setTimeout(function () {
              if (foxCompanion && foxCompanion.actions.Run && foxCompanion.actions.Survey) {
                foxCompanion.actions.Run.stop();
                foxCompanion.actions.Survey.reset().play();
              }
            }, 1400);
          }
        }
        var sp = projectToScreen(mascotWx, mascotWy + 3.6, mascotWz);
        spawnFloatScreen(sp.x, sp.y, '💬 ' + currentNpcInfo.name + '：歡迎聊聊！');
      };

      function triggerMascotGreeting(advanceTip) {
        if (advanceTip) npcTipIndex++;
        state.selectedId = '__npc__';
        state.nearId = '__npc__';
        state.tx = mascotPctX;
        state.ty = Math.min(86, mascotPctY + 3.8);
        if (triggerMascotJumpFn) triggerMascotJumpFn();
        renderDialog();
      }
      if (npcTag) {
        npcTag.addEventListener('click', function (e) {
          e.stopPropagation();
          triggerMascotGreeting(state.selectedId === '__npc__');
        });
      }

      // ── 6B. 載入開源 .glb 骨骼動畫與雕塑模型群（飛鳥、小鴨、小狐狸、表情機器人、駿馬、卡車、花叢） ──
      var skyBirds = [];
      [
        { file: 'Parrot.glb',   r: 11.5, y: 6.2, speed: 0.48, phase: 0.0, size: 2.35 },
        { file: 'Flamingo.glb', r: 14.2, y: 7.0, speed: 0.39, phase: 2.1, size: 2.55 },
        { file: 'Stork.glb',    r: 12.8, y: 6.6, speed: 0.43, phase: 4.2, size: 2.45 }
      ].forEach(function (bCfg) {
        spawnGLBInstance(THREE, bCfg.file, { targetSize: bCfg.size, timeScale: 1.25 }, function (res) {
          res.group.position.set(Math.cos(bCfg.phase) * bCfg.r, bCfg.y, 2.5 + Math.sin(bCfg.phase) * (bCfg.r * 0.65));
          worldGroup.add(res.group);
          skyBirds.push({ group: res.group, cfg: bCfg });
        });
      });

      var pondDucks = [];
      [
        { cx: 19.3, cz: -15.3, r: 1.15, baseY: CLIFF_HEIGHT + 0.08, speed: 0.65, phase: 0.5 },
        { cx: 20.0, cz: 7.2,   r: 0.95, baseY: 0.06,                speed: 0.58, phase: 2.6 }
      ].forEach(function (dCfg) {
        spawnGLBInstance(THREE, 'Duck.glb', { targetSize: 1.45 }, function (res) {
          res.group.position.set(dCfg.cx, dCfg.baseY, dCfg.cz);
          worldGroup.add(res.group);
          pondDucks.push({ group: res.group, cfg: dCfg });
        });
      });

      // 中央廣場旁：開源 Fox.glb 骨骼動畫小狐狸夥伴（點擊可與島長一起互動跳躍）
      var foxWx = -6.4, foxWz = 3.6;
      var foxWy = getExactSurfaceY(foxWx, foxWz);
      spawnGLBInstance(THREE, 'Fox.glb', { targetSize: 2.35, clipName: 'Survey' }, function (res) {
        res.group.position.set(foxWx, foxWy, foxWz);
        res.group.rotation.y = 0.48;
        res.group.userData.isNPC = true;
        worldGroup.add(res.group);
        interactiveMeshes.push(res.group);
        foxCompanion = res;
      });

      // 中央廣場東側：開源 RobotExpressive.glb 骨骼動畫表情機器人（點擊可切換揮手／跳舞／跳躍／比讚動畫）
      var robWx = 4.6, robWz = 3.8;
      var robWy = getExactSurfaceY(robWx, robWz);
      spawnGLBInstance(THREE, 'RobotExpressive.glb', { targetSize: 3.15, clipName: 'Wave' }, function (res) {
        res.group.position.set(robWx, robWy, robWz);
        res.group.rotation.y = -0.35;
        res.group.userData.isRobot = true;
        worldGroup.add(res.group);
        interactiveMeshes.push(res.group);
        plazaRobot = res;
      });

      function triggerRobotPerform() {
        if (!plazaRobot) return;
        robotClipIdx = (robotClipIdx + 1) % robotClipCycle.length;
        var nextClip = robotClipCycle[robotClipIdx];
        if (plazaRobot.actions) {
          Object.keys(plazaRobot.actions).forEach(function (k) {
            plazaRobot.actions[k].stop();
          });
          var act = plazaRobot.actions[nextClip] || plazaRobot.actions.Wave || plazaRobot.actions.Idle;
          if (act) act.reset().play();
        }
        var sp = projectToScreen(robWx, robWy + 3.6, robWz);
        var msgMap = {
          Wave: '🤖 創客機器人：嗨！歡迎來到 3D 動森島！（揮手）',
          Dance: '🤖 創客機器人：啟動歡樂熱舞模式！💃',
          Jump: '🤖 創客機器人：超級跳躍推進！🚀',
          ThumbsUp: '🤖 創客機器人：你今天表現超讚喔！👍',
          Idle: '🤖 創客機器人：待命巡邏中，隨時點我表演！✨'
        };
        spawnFloatScreen(sp.x, sp.y, msgMap[nextClip] || '🤖 創客機器人：嗶嗶！');
      }
      if (robotTag) {
        robotTag.addEventListener('click', function (e) {
          e.stopPropagation();
          triggerRobotPerform();
        });
      }

      // 前景草原奔馳駿馬 (Horse.glb)、果園補給卡車 (Truck.glb) 與中央廣場立體雕塑花叢 (Flower.glb)
      var horseWx = -9.6, horseWz = 6.2;
      spawnGLBInstance(THREE, 'Horse.glb', { targetSize: 2.75, timeScale: 0.85 }, function (res) {
        res.group.position.set(horseWx, getExactSurfaceY(horseWx, horseWz), horseWz);
        res.group.rotation.y = 0.55;
        worldGroup.add(res.group);
      });

      var truckWx = 9.6, truckWz = 6.4;
      spawnGLBInstance(THREE, 'Truck.glb', { targetSize: 3.05 }, function (res) {
        res.group.position.set(truckWx, getExactSurfaceY(truckWx, truckWz), truckWz);
        res.group.rotation.y = -0.52;
        worldGroup.add(res.group);
      });

      [[-3.5, 4.3], [3.5, 4.3], [-3.7, -3.1], [3.7, -3.1]].forEach(function (fp, fi) {
        spawnGLBInstance(THREE, 'Flower.glb', { targetSize: 1.35 }, function (res) {
          res.group.position.set(fp[0], getExactSurfaceY(fp[0], fp[1]), fp[1]);
          res.group.rotation.y = fi * 1.2;
          worldGroup.add(res.group);
        });
      });

      props.forEach(function (p, idx) {
        var wx = pctToWorldX(p.x);
        var wz = pctToWorldZ(p.y);
        var wy = getExactSurfaceY(wx, wz);
        var mesh = buildTree3D(THREE, p.kind || 'fruit-tree', {
          fruit: p.fruit,
          fruitColor: p.fruitColor
        });
        mesh.position.set(wx, wy, wz);
        mesh.userData.propIndex = idx;
        worldGroup.add(mesh);
        interactiveMeshes.push(mesh);
        propEntries.push({ data: p, mesh: mesh, wx: wx, wy: wy, wz: wz, shakeTime: 0 });
      });

      var nodeEntries = [];
      var nodeDomMap = {};
      var allDomPins = overlayEl.querySelectorAll('.ac-node');
      for (var dIdx = 0; dIdx < allDomPins.length; dIdx++) {
        var pinEl = allDomPins[dIdx];
        nodeDomMap[pinEl.getAttribute('data-node')] = pinEl;
      }

      nodes.forEach(function (n) {
        var wx = pctToWorldX(n.x);
        var wz = pctToWorldZ(n.y);
        var wy = getExactSurfaceY(wx, wz);
        var mesh = buildBuilding3D(THREE, n.kind || 'cottage-amber', {
          fruit: n.fruit,
          fruitColor: n.fruitColor,
          pass: n.pass || n.done
        });
        // ★ 已通關建築自動升起 3D 旋轉黃金榮譽星冠與慶祝花叢！
        var crownGroup = null;
        if (n.done || n.pass) {
          crownGroup = buildVictoryCrown3D(THREE, mesh.userData.labelHeight || 5.2);
          mesh.add(crownGroup);
        }
        mesh.position.set(wx, wy, wz);
        mesh.userData.nodeId = n.id;
        worldGroup.add(mesh);
        interactiveMeshes.push(mesh);
        nodeEntries.push({
          node: n,
          mesh: mesh,
          crownGroup: crownGroup,
          domEl: nodeDomMap[String(n.id)],
          wx: wx,
          wy: wy,
          wz: wz,
          shakeTime: 0
        });
      });

      // ── 7. 放置 3D 村民玩家角色與點擊地面波紋環 ──
      var playerMesh = buildVillager3D(THREE, cfg.genderCode, currentLook);
      var initWx = pctToWorldX(state.px);
      var initWz = pctToWorldZ(state.py);
      playerMesh.position.set(initWx, getExactSurfaceY(initWx, initWz), initWz);
      worldGroup.add(playerMesh);

      rebuildPlayerFn = function () {
        var oldPos = playerMesh.position.clone();
        var oldRotY = playerMesh.rotation.y;
        worldGroup.remove(playerMesh);
        playerMesh = buildVillager3D(THREE, cfg.genderCode, currentLook);
        playerMesh.position.copy(oldPos);
        playerMesh.position.y += 0.55; // 換裝開心輕跳
        playerMesh.rotation.y = oldRotY;
        worldGroup.add(playerMesh);
      };

      var clickRingGeo = new THREE.RingGeometry(0.4, 0.72, 28);
      clickRingGeo.rotateX(-Math.PI / 2);
      var clickRingMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      var clickRingMesh = new THREE.Mesh(clickRingGeo, clickRingMat);
      worldGroup.add(clickRingMesh);
      var clickRingTimer = 0;

      function shake3DEntry(entry, isTreeProp) {
        if (!entry || !entry.mesh) return;
        entry.shakeTime = performance.now();

        var fColor = entry.mesh.userData.fruitColor || new THREE.Color(0xef4444);
        var nKind = entry.node ? String(entry.node.kind || '') : '';
        var isFruitBearer = isTreeProp || nKind.indexOf('tree') >= 0 || (nKind.indexOf('orchard-') === 0 && nKind !== 'orchard-barn' && nKind !== 'orchard-mill' && nKind !== 'orchard-greenhouse');
        if (isFruitBearer) {
          var fMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.36, 12, 12),
            new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.25 })
          );
          fMesh.castShadow = true;
          fMesh.position.set(
            entry.wx + (Math.random() - 0.5) * 1.4,
            entry.wy + 3.2,
            entry.wz + 1.2 + Math.random() * 0.6
          );
          worldGroup.add(fMesh);
          fallingFruits.push({
            mesh: fMesh,
            vx: (Math.random() - 0.5) * 0.06,
            vy: 0.14,
            vz: 0.05 + Math.random() * 0.04,
            groundY: entry.wy + 0.36,
            born: performance.now()
          });
        }
      }

      var projVec = new THREE.Vector3();
      function projectToScreen(wx, wy, wz) {
        projVec.set(wx, wy, wz);
        worldGroup.localToWorld(projVec);
        projVec.project(camera);
        var w = stageEl.clientWidth || 800;
        var h = stageEl.clientHeight || 500;
        return {
          x: (projVec.x * 0.5 + 0.5) * w,
          y: (-projVec.y * 0.5 + 0.5) * h,
          z: projVec.z
        };
      }

      // ── 8. 滑鼠拖曳旋轉視角、滾輪縮放與 3D Raycaster 點擊互動 ──
      var raycaster = new THREE.Raycaster();
      var mouseNDC = new THREE.Vector2();
      var dragState = { active: false, moved: false, startX: 0, startY: 0, startYaw: 0 };

      function onPointerDown(e) {
        if (e.target.closest('#ac-dialog') || e.target.closest('.ac-cam-btn') || e.target.closest('.ac-node') || e.target.closest('#ac-wardrobe-panel') || e.target.closest('#ac-npc-tag') || e.target.closest('#ac-robot-tag')) return;
        dragState.active = true;
        dragState.moved = false;
        dragState.startX = e.clientX;
        dragState.startY = e.clientY;
        dragState.startYaw = state.yawOffset;
      }

      function onPointerMove(e) {
        if (!dragState.active) return;
        var dx = e.clientX - dragState.startX;
        var dy = e.clientY - dragState.startY;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          dragState.moved = true;
          state.yawOffset = Math.max(-0.6, Math.min(0.6, dragState.startYaw - dx * 0.0045));
        }
      }

      function onPointerUp(e) {
        if (!dragState.active) return;
        dragState.active = false;
        if (dragState.moved) return;

        var rect = canvasEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNDC, camera);

        var hits = raycaster.intersectObjects(interactiveMeshes, true);
        if (hits.length > 0) {
          var hitObj = hits[0].object;
          while (hitObj && hitObj.parent && hitObj.userData.nodeId == null && hitObj.userData.propIndex == null && !hitObj.userData.isNPC && !hitObj.userData.isRobot) {
            hitObj = hitObj.parent;
          }
          if (hitObj && hitObj.userData.isRobot) {
            triggerRobotPerform();
            return;
          }
          if (hitObj && hitObj.userData.isNPC) {
            triggerMascotGreeting(state.selectedId === '__npc__');
            return;
          }
          if (hitObj && hitObj.userData.propIndex != null) {
            var pe = propEntries[hitObj.userData.propIndex];
            if (pe) {
              shake3DEntry(pe, true);
              state.tx = pe.data.x;
              state.ty = Math.min(86, pe.data.y + 4);
              var list = pe.data.drops || ['🍎 果實 +1'];
              var pick = list[Math.floor(Math.random() * list.length)];
              var sp = projectToScreen(pe.wx, pe.wy + 4.5, pe.wz);
              spawnFloatScreen(sp.x, sp.y, pick);
            }
            return;
          }
          if (hitObj && hitObj.userData.nodeId != null) {
            handleNodeSelectAndOpen(hitObj.userData.nodeId);
            return;
          }
        }

        var groundHits = raycaster.intersectObjects([islandMesh, sandMesh, cliffTop, plazaMesh, pierDeck], false);
        if (groundHits.length > 0) {
          var pt = worldGroup.worldToLocal(groundHits[0].point.clone());
          state.tx = Math.max(12, Math.min(88, worldToPctX(pt.x)));
          state.ty = Math.max(15, Math.min(88, worldToPctY(pt.z)));
          var surfY = getExactSurfaceY(pt.x, pt.z);
          clickRingMesh.position.set(pt.x, surfY + 0.08, pt.z);
          clickRingTimer = performance.now();
        }
      }

      function onWheel(e) {
        e.preventDefault();
        state.zoomDist = Math.max(0.7, Math.min(1.45, state.zoomDist + (e.deltaY > 0 ? 0.08 : -0.08)));
      }

      function handleNodeSelectAndOpen(nodeId) {
        var entry = null;
        for (var i = 0; i < nodeEntries.length; i++) {
          if (String(nodeEntries[i].node.id) === String(nodeId)) {
            entry = nodeEntries[i];
            break;
          }
        }
        if (!entry) return;
        var node = entry.node;
        shake3DEntry(entry, false);

        state.selectedId = node.id;
        state.nearId = node.id;
        state.tx = node.x;
        state.ty = Math.min(86, node.y + 4.0);
        state.focusUntil = performance.now() + 1400; // 啟動電影級推進運鏡
        renderDialog();

        var scr = projectToScreen(entry.wx, entry.wy + 4.5, entry.wz);
        if (node.locked) {
          spawnFloatScreen(scr.x, scr.y, '🔒 ' + (node.lockReason || '尚未開放'));
        } else if (node.instantOpen !== false) {
          setTimeout(function () {
            triggerNodeAction(node, 0);
          }, 220);
        } else if (typeof cfg.onSelectNode === 'function') {
          cfg.onSelectNode(node);
        }
      }

      function onStageDomClick(e) {
        if (e.target.closest('#ac-npc-next-tip')) {
          e.stopPropagation();
          triggerMascotGreeting(true);
          return;
        }
        if (e.target.closest('#ac-npc-guide-me')) {
          e.stopPropagation();
          if (triggerMascotJumpFn) triggerMascotJumpFn();
          guideToRecommendedNode();
          return;
        }
        var actBtn = e.target.closest('[data-ac-act]');
        if (actBtn) {
          e.stopPropagation();
          var nId = actBtn.getAttribute('data-ac-node');
          var aIdx = Number(actBtn.getAttribute('data-ac-act')) || 0;
          state.focusUntil = performance.now() + 1400;
          triggerNodeAction(findNode(nId), aIdx);
          return;
        }
        var nodePin = e.target.closest('.ac-node');
        if (nodePin) {
          e.stopPropagation();
          handleNodeSelectAndOpen(nodePin.getAttribute('data-node'));
        }
      }

      if (camBtn) {
        camBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          state.camMode = state.camMode === 'follow' ? 'overview' : 'follow';
          state.yawOffset = 0;
          camBtn.textContent = state.camMode === 'follow'
            ? '🎥 視角：動森跟隨（點擊切換全島鳥瞰）'
            : '🗺️ 視角：全島鳥瞰（點擊切換動森跟隨）';
        });
      }

      function onKeyDown(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (document.querySelector('#week-mask, #modal.flex, #action-modal.flex, .ac-float-backdrop:not(.hidden)')) return;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(e.code) >= 0) {
          state.keys[e.code] = true;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
            e.preventDefault();
          }
        } else if (e.code === 'Space' || e.code === 'Enter') {
          if (state.nearId === '__npc__' || state.selectedId === '__npc__') {
            e.preventDefault();
            triggerMascotGreeting(true);
            return;
          }
          var targetNode = findNode(state.nearId || state.selectedId);
          if (targetNode && state.nearId) {
            e.preventDefault();
            handleNodeSelectAndOpen(targetNode.id);
          }
        }
      }

      function onKeyUp(e) { delete state.keys[e.code]; }
      function onBlur() { state.keys = {}; }

      function resizeRenderer() {
        if (!stageEl) return;
        var w = stageEl.clientWidth || 800;
        var h = stageEl.clientHeight || 520;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resizeRenderer();
      window.addEventListener('resize', resizeRenderer);

      canvasEl.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      canvasEl.addEventListener('wheel', onWheel, { passive: false });
      stageEl.addEventListener('click', onStageDomClick);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);

      // ── 9. 60fps 3D 遊戲主迴圈（精準高度追蹤，角色絕不消失） ──
      var camPos = new THREE.Vector3(0, 24, 34);
      var camLook = new THREE.Vector3(0, 1.5, 4);
      var currentPy = getExactSurfaceY(initWx, initWz);
      var lastAnimNow = performance.now();

      function animate(now) {
        if (state.destroyed) return;
        var dt = Math.min(0.05, Math.max(0.001, (now - lastAnimNow) * 0.001));
        lastAnimNow = now;
        var tSec = now * 0.001;

        for (var mi = 0; mi < activeGlbMixers.length; mi++) {
          activeGlbMixers[mi].update(dt);
        }

        var vx = 0, vy = 0;
        if (state.keys.ArrowLeft  || state.keys.KeyA) vx -= 1;
        if (state.keys.ArrowRight || state.keys.KeyD) vx += 1;
        if (state.keys.ArrowUp    || state.keys.KeyW) vy -= 1;
        if (state.keys.ArrowDown  || state.keys.KeyS) vy += 1;

        var oldWx = pctToWorldX(state.px);
        var oldWz = pctToWorldZ(state.py);

        var speed = 0.23; // 調慢 50%，符合動森悠閒漫步節奏
        if (vx !== 0 || vy !== 0) {
          state.tx = null;
          state.ty = null;
          var len = Math.sqrt(vx * vx + vy * vy);
          var nx = vx / len, ny = vy / len;
          state.px += nx * speed;
          state.py += ny * (speed * 1.12);
          state.heading = Math.atan2(nx, ny);
          state.walking = true;
        } else if (state.tx !== null && state.ty !== null) {
          var dx = state.tx - state.px;
          var dy = state.ty - state.py;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.4) {
            var ux = dx / dist, uy = dy / dist;
            state.px += ux * (speed * 1.18);
            state.py += uy * (speed * 1.18);
            state.heading = Math.atan2(ux, uy);
            state.walking = true;
          } else {
            state.px = state.tx;
            state.py = state.ty;
            state.tx = null;
            state.ty = null;
            state.walking = false;
            savePos();
          }
        } else {
          state.walking = false;
        }

        state.px = Math.max(12, Math.min(88, state.px));
        state.py = Math.max(15, Math.min(88, state.py));

        var rawWx = pctToWorldX(state.px);
        var rawWz = pctToWorldZ(state.py);
        var resolved = resolveCliffMovement(oldWx, oldWz, rawWx, rawWz);
        var pWx = resolved.wx;
        var pWz = resolved.wz;

        // 精準取得角色所在位置的地表高度，並平滑插值（上下石階或躍上高台時自然過渡，絕不陷入地下！）
        var targetSurfY = getExactSurfaceY(pWx, pWz);
        currentPy += (targetSurfY - currentPy) * 0.28;
        var walkHop = state.walking ? Math.abs(Math.sin(tSec * 8.5)) * 0.18 : 0;
        playerMesh.position.set(pWx, currentPy + walkHop, pWz);

        var diffRot = state.heading - playerMesh.rotation.y;
        while (diffRot > Math.PI) diffRot -= Math.PI * 2;
        while (diffRot < -Math.PI) diffRot += Math.PI * 2;
        playerMesh.rotation.y += diffRot * 0.18;

        var limbs = playerMesh.userData.limbs;
        if (limbs) {
          var swing = state.walking ? Math.sin(tSec * 8.5) * 0.52 : 0;
          limbs.leftLeg.rotation.x  = swing;
          limbs.rightLeg.rotation.x = -swing;
          limbs.leftArm.rotation.x  = -swing * 0.85;
          limbs.rightArm.rotation.x = swing * 0.85;
        }

        // ★ 檢測是否有主題浮動視窗正在開啟，或剛點擊了建築：啟動「電影級建築特寫運鏡 (Cinematic Building Focus)」
        var isModalOpen = !!document.querySelector('.ac-float-backdrop:not(.hidden)');
        var focusEntry = null;
        if ((isModalOpen || now < state.focusUntil) && state.selectedId) {
          for (var fIdx = 0; fIdx < nodeEntries.length; fIdx++) {
            if (String(nodeEntries[fIdx].node.id) === String(state.selectedId)) {
              focusEntry = nodeEntries[fIdx];
              break;
            }
          }
        }

        // 更新鏡頭平滑跟隨或建築特寫
        var targetCamX, targetCamY, targetCamZ, targetLookX, targetLookY, targetLookZ;
        if (focusEntry) {
          var orbitShift = Math.sin(tSec * 0.45) * 2.2;
          targetCamX = focusEntry.wx + orbitShift;
          targetCamY = focusEntry.wy + 9.5;
          targetCamZ = focusEntry.wz + 14.5;
          targetLookX = focusEntry.wx;
          targetLookY = focusEntry.wy + 2.4;
          targetLookZ = focusEntry.wz;
        } else if (state.camMode === 'follow') {
          var distRadius = 28.5 * state.zoomDist;
          targetCamX = pWx * 0.74 + Math.sin(state.yawOffset) * distRadius;
          targetCamY = currentPy + 20.5 * state.zoomDist;
          targetCamZ = pWz + Math.cos(state.yawOffset) * distRadius;
          targetLookX = pWx * 0.8;
          targetLookY = currentPy + 1.5;
          targetLookZ = pWz - 2.0;
        } else {
          var ovDist = 46.5 * state.zoomDist;
          targetCamX = Math.sin(state.yawOffset) * ovDist;
          targetCamY = 34.0 * state.zoomDist;
          targetCamZ = Math.cos(state.yawOffset) * ovDist + 4.0;
          targetLookX = 0;
          targetLookY = 0.8;
          targetLookZ = -1.5;
        }

        camPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
        camLook.lerp(new THREE.Vector3(targetLookX, targetLookY, targetLookZ), 0.10);
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        // 環境動態效果：海岸浪花、水上飛機、3D 島長 NPC 揮手與跳躍
        foamMesh.scale.x = 1.06 + Math.sin(tSec * 2.1) * 0.015;
        foamMesh.scale.z = 0.72 + Math.cos(tSec * 2.1) * 0.012;
        planeGroup.position.y = -0.35 + Math.sin(tSec * 2.6) * 0.14;
        planeGroup.rotation.z = Math.sin(tSec * 1.9) * 0.05;
        propBlade.rotation.z = tSec * 14;

        if (mascotMesh) {
          if (mascotMesh.userData.rightArmPivot) {
            mascotMesh.userData.rightArmPivot.rotation.z = Math.sin(tSec * 5.2) * 0.32;
          }
          var npcJump = 0;
          if (mascotMesh.userData.jumpTime > 0) {
            var jAge = (now - mascotMesh.userData.jumpTime) / 480;
            if (jAge < 1) {
              npcJump = Math.sin(jAge * Math.PI) * 0.85;
            } else {
              mascotMesh.userData.jumpTime = 0;
            }
          }
          mascotMesh.position.y = mascotWy + Math.abs(Math.sin(tSec * 2.4)) * 0.08 + npcJump;
          if (npcTag) {
            var npcScr = projectToScreen(mascotWx, mascotMesh.position.y + 3.25, mascotWz);
            npcTag.style.left = Math.round(npcScr.x) + 'px';
            npcTag.style.top  = Math.round(npcScr.y) + 'px';
          }
          if (robotTag) {
            var robScr = projectToScreen(robWx, robWy + 3.25, robWz);
            robotTag.style.left = Math.round(robScr.x) + 'px';
            robotTag.style.top  = Math.round(robScr.y) + 'px';
          }
        }

        // 主題環境飄浮粒子動畫
        for (var api = 0; api < ambientParticles.length; api++) {
          var ap = ambientParticles[api];
          ap.y += ap.vy;
          if (ap.vy < 0 && ap.y < 0.4) ap.y = 10.5;
          if (ap.vy > 0 && ap.y > 10.5) ap.y = 0.6;
          ap.mesh.position.x = ap.baseX + Math.sin(tSec * 1.5 + ap.phase) * 0.9;
          ap.mesh.position.y = ap.y;
          ap.mesh.position.z = ap.baseZ + Math.cos(tSec * 1.3 + ap.phase) * 0.9;
          ap.mesh.rotation.y = tSec * 2.0 + ap.phase;
        }

        // 蝴蝶飛舞動畫
        for (var bi = 0; bi < butterflies.length; bi++) {
          var bf = butterflies[bi];
          var ph = tSec * 2.2 + bf.userData.phase;
          bf.position.x = bf.userData.cx + Math.cos(ph) * 2.2;
          bf.position.z = bf.userData.cz + Math.sin(ph * 1.3) * 1.8;
          bf.position.y = 1.6 + Math.sin(tSec * 5 + bi) * 0.35;
          bf.rotation.y = -ph;
          var flapAng = Math.sin(tSec * 18 + bi) * 0.65;
          bf.userData.lw.rotation.y = flapAng;
          bf.userData.rw.rotation.y = -flapAng;
        }

        // 開源 .glb 天空飛鳥群環島翱翔動畫
        for (var sbi = 0; sbi < skyBirds.length; sbi++) {
          var sb = skyBirds[sbi];
          var bAng = tSec * sb.cfg.speed + sb.cfg.phase;
          var bx = Math.cos(bAng) * sb.cfg.r;
          var bz = 2.5 + Math.sin(bAng) * (sb.cfg.r * 0.65);
          var nextAng = bAng + 0.05;
          var nbx = Math.cos(nextAng) * sb.cfg.r;
          var nbz = 2.5 + Math.sin(nextAng) * (sb.cfg.r * 0.65);
          sb.group.position.set(bx, sb.cfg.y + Math.sin(tSec * 2.1 + sbi) * 0.45, bz);
          sb.group.rotation.y = Math.atan2(nbx - bx, nbz - bz);
        }

        // 開源 .glb 池塘與河道小鴨游水動畫
        for (var pdi = 0; pdi < pondDucks.length; pdi++) {
          var pd = pondDucks[pdi];
          var dAng = tSec * pd.cfg.speed + pd.cfg.phase;
          var dxPos = pd.cfg.cx + Math.cos(dAng) * pd.cfg.r;
          var dzPos = pd.cfg.cz + Math.sin(dAng) * (pd.cfg.r * 0.75);
          var ndAng = dAng + 0.05;
          var ndx = pd.cfg.cx + Math.cos(ndAng) * pd.cfg.r;
          var ndz = pd.cfg.cz + Math.sin(ndAng) * (pd.cfg.r * 0.75);
          pd.group.position.set(dxPos, pd.cfg.baseY + Math.sin(tSec * 3.8 + pdi) * 0.04, dzPos);
          pd.group.rotation.y = Math.atan2(ndx - dxPos, ndz - dzPos) - Math.PI / 2;
        }

        for (var cl = 0; cl < clouds.length; cl++) {
          clouds[cl].position.x += 0.018;
          if (clouds[cl].position.x > 46) clouds[cl].position.x = -46;
        }

        if (clickRingTimer > 0) {
          var ringAge = (now - clickRingTimer) / 550;
          if (ringAge < 1) {
            var rScale = 0.4 + ringAge * 1.8;
            clickRingMesh.scale.set(rScale, 1, rScale);
            clickRingMat.opacity = (1 - ringAge) * 0.9;
          } else {
            clickRingMat.opacity = 0;
            clickRingTimer = 0;
          }
        }

        for (var pi = 0; pi < propEntries.length; pi++) {
          var pe = propEntries[pi];
          if (pe.shakeTime > 0) {
            var pAge = (now - pe.shakeTime) / 480;
            if (pAge < 1) {
              pe.mesh.rotation.z = Math.sin(pAge * Math.PI * 5) * 0.14 * (1 - pAge);
            } else {
              pe.mesh.rotation.z = 0;
              pe.shakeTime = 0;
            }
          }
        }

        for (var fi = fallingFruits.length - 1; fi >= 0; fi--) {
          var ff = fallingFruits[fi];
          ff.mesh.position.x += ff.vx;
          ff.mesh.position.y += ff.vy;
          ff.mesh.position.z += ff.vz;
          ff.vy -= 0.012;
          if (ff.mesh.position.y <= ff.groundY) {
            ff.mesh.position.y = ff.groundY;
            ff.vy = Math.abs(ff.vy) * 0.45;
            ff.vx *= 0.6;
            ff.vz *= 0.6;
          }
          if (now - ff.born > 1600) {
            worldGroup.remove(ff.mesh);
            fallingFruits.splice(fi, 1);
          }
        }

        // 檢測角色最靠近的關卡建築或島長 NPC，並將所有 3D 建築頭頂座標投影至 HTML 木牌
        var bestId = null;
        var bestDist = 13.5;
        var npcDx = mascotPctX - state.px;
        var npcDy = (mascotPctY + 2.5) - state.py;
        var npcDist = Math.sqrt(npcDx * npcDx + npcDy * npcDy);
        if (npcDist < 9.5) {
          bestDist = npcDist;
          bestId = '__npc__';
        }
        for (var ni = 0; ni < nodeEntries.length; ni++) {
          var ne = nodeEntries[ni];
          var n = ne.node;
          var ddx = n.x - state.px;
          var ddy = (n.y + 2.5) - state.py;
          var dDist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dDist < bestDist) {
            bestDist = dDist;
            bestId = n.id;
          }

          if (ne.crownGroup && ne.crownGroup.userData.starGroup) {
            ne.crownGroup.userData.starGroup.rotation.y = tSec * 2.2 + ni;
            ne.crownGroup.userData.starGroup.position.y = (ne.mesh.userData.labelHeight || 5.2) + 0.65 + Math.sin(tSec * 3.2 + ni) * 0.18;
          }

          if (ne.mesh.userData.spinPart) {
            ne.mesh.userData.spinPart.rotation.z = tSec * 1.8;
          }
          if (ne.mesh.userData.spinPartY) {
            ne.mesh.userData.spinPartY.rotation.y = tSec * 1.25;
          }
          if (ne.mesh.userData.pulsePart) {
            var sc = 0.9 + Math.sin(tSec * 9) * 0.14;
            ne.mesh.userData.pulsePart.scale.set(sc, sc + 0.1, sc);
          }
          if (ne.shakeTime > 0) {
            var nAge = (now - ne.shakeTime) / 460;
            if (nAge < 1) {
              ne.mesh.rotation.z = Math.sin(nAge * Math.PI * 4) * 0.11 * (1 - nAge);
              ne.mesh.position.y = ne.wy + Math.sin(nAge * Math.PI) * 0.45;
            } else {
              ne.mesh.rotation.z = 0;
              ne.mesh.position.y = ne.wy;
              ne.shakeTime = 0;
            }
          }

          if (ne.domEl) {
            var lh = ne.mesh.userData.labelHeight || 5.2;
            var scrPos = projectToScreen(ne.wx, ne.mesh.position.y + lh, ne.wz);
            ne.domEl.style.left = Math.round(scrPos.x) + 'px';
            ne.domEl.style.top  = Math.round(scrPos.y) + 'px';
            ne.domEl.style.zIndex = String(Math.max(10, Math.min(35, Math.round((1 - scrPos.z) * 100))));
          }
        }

        if (bestId !== state.nearId) {
          state.nearId = bestId;
          if (bestId) state.selectedId = bestId;
          for (var k = 0; k < nodeEntries.length; k++) {
            if (nodeEntries[k].domEl) {
              nodeEntries[k].domEl.classList.toggle('is-near', String(nodeEntries[k].node.id) === String(bestId));
            }
          }
          renderDialog();
        }

        if (playerTag) {
          var pScr = projectToScreen(pWx, playerMesh.position.y + 3.4, pWz);
          playerTag.style.left = Math.round(pScr.x) + 'px';
          playerTag.style.top  = Math.round(pScr.y) + 'px';
        }

        renderer.render(scene, camera);
        state.rafId = requestAnimationFrame(animate);
      }

      state.rafId = requestAnimationFrame(animate);

      cleanupThree = function () {
        window.removeEventListener('resize', resizeRenderer);
        canvasEl.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        canvasEl.removeEventListener('wheel', onWheel);
        stageEl.removeEventListener('click', onStageDomClick);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        renderer.dispose();
      };
    }).catch(function (err) {
      console.error('Three.js 3D 島嶼載入失敗:', err);
    });

    activeInstance = {
      destroy: function () {
        state.destroyed = true;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        if (cleanupThree) cleanupThree();
      },
      selectNode: function (id) {
        state.selectedId = id;
        renderDialog();
      }
    };
    return activeInstance;
  }

  global.AC_ISLAND = {
    mount: mount
  };
})(window);
