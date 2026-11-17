/* =====================================================================
   🗾 2D 像素版島嶼與機場引擎 (shared/island2d.js)
   ---------------------------------------------------------------------
   素材：Ninja Adventure Asset Pack（CC0，Pixel-boy & AAA），放在 shared/pixel/，來源見 pixel/CREDITS.md。

   這一支不單獨使用：
     · shared/island.js 的 AC_ISLAND.mount() 看到 TERMSEL.engine() === '2d' 時載入這一支，呼叫 AC_ISLAND2D.run(ctx)。
       建 DOM、木牌、對話框、按鍵規則、帶路、造型面板都還是 island.js 那一份（兩種畫面共用），
       這裡只負責「畫島、走路、碰撞、算誰最近、把木牌貼到建築頭上」。
     · shared/term.js 的登機大廳看到 '2d' 時呼叫 AC_ISLAND2D.lounge(ctx)。

   座標：和 3D 一樣用「百分比」記位置（state.px / state.py，0～100），所以存檔位置、帶路、靠近判斷兩邊通用。
         地圖 1024×720 像素（16 像素一格）：x 像素 = px × 10.24、y 像素 = py × 7.2。
   ===================================================================== */
(function (global) {
  'use strict';

  var MAP_W = 1024, MAP_H = 720, TILE = 16;
  var PXX = MAP_W / 100, PXY = MAP_H / 100;
  function pctToMx(p) { return p * PXX; }
  function pctToMy(p) { return p * PXY; }
  function mxToPct(m) { return m / PXX; }
  function myToPct(m) { return m / PXY; }
  // 3D 世界座標（island.js：wx = (x%-50)*0.94、wz = (y%-50)*0.70）→ 地圖像素
  function wxToMx(wx) { return (wx / 0.94 + 50) * PXX; }
  function wzToMy(wz) { return (wz / 0.70 + 50) * PXY; }
  var WX = PXX / 0.94, WZ = PXY / 0.70;   // 1 個 3D 單位 ≈ 10.9 / 10.3 像素

  var CLIFF_Y = 215;   // 北側高台地面到這裡為止
  var CLIFF_H = 32;    // 崖壁高度（兩格）

  /* ── 素材 ─────────────────────────────────────────────── */
  var SHEETS = {
    floor: 'tiles/floor.png', water: 'tiles/water.png', nature: 'tiles/nature.png', house: 'tiles/house.png',
    towers: 'tiles/towers.png', camp: 'tiles/camp.png', element: 'tiles/element.png', relief: 'tiles/relief.png',
    detail: 'tiles/detail.png', ifloor: 'tiles/ifloor.png', interior: 'tiles/interior.png', wall: 'tiles/wall.png',
    ripple: 'anim/ripple.png', wfTop: 'anim/wf_top.png', wfMid: 'anim/wf_mid.png', wfBot: 'anim/wf_bot.png',
    watermill: 'anim/watermill.png', propeller: 'anim/propeller.png', plant: 'anim/plant.png',
    flagRed: 'anim/flag_red.png', flagBlue: 'anim/flag_blue.png', flagGreen: 'anim/flag_green.png',
    flagYellow: 'anim/flag_yellow.png', flagWhite: 'anim/flag_white.png',
    shadow: 'shadow.png'
  };
  var CHAR_FILES = ['NinjaBlue', 'Princess', 'NinjaGreen', 'NinjaYellow', 'NinjaMageBlack', 'NinjaFire', 'NinjaDark',
                    'MaskRacoon', 'Master', 'RobotGreen', 'Monkey', 'OldMan', 'Samurai', 'Noble'];
  var ANIMAL_FILES = ['cat', 'catwhite', 'dog', 'frog', 'lioncub', 'parrot', 'parrot_red', 'hamster', 'chicken', 'fish', 'pig'];

  // 造型面板的「服裝顏色」→ 換成哪一位像素角色
  var CHAR_BY_SHIRT = {
    '#0284c7': 'NinjaBlue', '#f43f5e': 'Princess', '#10b981': 'NinjaGreen', '#f59e0b': 'NinjaYellow',
    '#8b5cf6': 'NinjaMageBlack', '#f97316': 'NinjaFire', '#1e293b': 'NinjaDark'
  };

  var imgCache = {};
  function loadImg(url) {
    if (!imgCache[url]) {
      imgCache[url] = new Promise(function (resolve, reject) {
        var im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { delete imgCache[url]; reject(new Error('圖片載入失敗：' + url)); };
        im.src = url;
      });
    }
    return imgCache[url];
  }
  function loadAssets(base) {
    var root = base + 'pixel/';
    var jobs = [], out = { chars: {}, animals: {} };
    Object.keys(SHEETS).forEach(function (k) {
      jobs.push(loadImg(root + SHEETS[k]).then(function (im) { out[k] = im; }));
    });
    CHAR_FILES.forEach(function (k) {
      jobs.push(loadImg(root + 'chars/' + k + '.png').then(function (im) { out.chars[k] = im; }));
    });
    ANIMAL_FILES.forEach(function (k) {
      jobs.push(loadImg(root + 'animals/' + k + '.png').then(function (im) { out.animals[k] = im; }));
    });
    jobs.push(loadImg(FLOOR_ATLAS).then(function (im) { out.floorAtlas = im; }));
    return Promise.all(jobs).then(function () { return out; });
  }

  /* 圖塊裡的物件：[圖檔, 欄, 列, 寬(格), 高(格)] */
  var SPR = /*SPR-BEGIN*/{
    "treeGreen": ["nature", 0, 0, 2, 2], "treePine": ["nature", 2, 0, 2, 2], "treeDead": ["nature", 4, 0, 2, 2],
    "treeBig": ["nature", 6, 0, 2, 2], "treeSnow": ["nature", 8, 0, 2, 2], "treeSnow2": ["nature", 10, 0, 2, 2],
    "treeWhite": ["nature", 12, 0, 2, 2], "treePink": ["nature", 14, 0, 2, 2], "treeLight": ["nature", 16, 0, 2, 2],
    "treeLight2": ["nature", 18, 0, 2, 2],
    "fruitPink": ["nature", 0, 18, 3, 3], "fruitGreen": ["nature", 3, 18, 3, 3], "fruitWhite": ["nature", 6, 18, 3, 3],
    "fruitOrange": ["nature", 9, 18, 3, 3],
    "bush": ["nature", 0, 10, 1, 1], "bush2": ["nature", 2, 10, 1, 1], "fern": ["nature", 4, 10, 1, 1],
    "sunflower": ["nature", 0, 11, 1, 1], "clover": ["nature", 2, 11, 1, 1], "redFlower": ["nature", 3, 11, 1, 1],
    "whiteFlower": ["nature", 6, 11, 1, 1], "berryBush": ["nature", 4, 14, 1, 1],
    "rockBig": ["nature", 0, 12, 2, 2], "rockSnow": ["nature", 2, 12, 2, 2], "stone": ["nature", 4, 13, 1, 1],
    "crystalBlue": ["nature", 1, 14, 1, 1], "crystalPink": ["nature", 2, 14, 1, 1], "crystalGreen": ["nature", 3, 14, 1, 1],
    "houseOrange": ["house", 0, 0, 4, 3], "houseBeige": ["house", 4, 0, 4, 3], "houseOrange2": ["house", 8, 0, 4, 3],
    "dojo": ["house", 12, 0, 4, 3], "shop": ["house", 16, 0, 3, 3], "greenShop": ["house", 19, 0, 4, 3],
    "bakery": ["house", 23, 0, 3, 3], "woodHouse": ["house", 26, 0, 3, 3], "kiln": ["house", 29, 4, 3, 4],
    "torii": ["house", 0, 5, 3, 2], "hut": ["house", 0, 7, 3, 3], "strawHut": ["house", 3, 8, 3, 2],
    "igloo": ["house", 0, 11, 3, 3], "barn": ["house", 25, 8, 4, 6], "bigWood": ["house", 25, 14, 4, 6],
    "stoneHut": ["house", 29, 11, 2, 2], "stoneHut2": ["house", 29, 13, 2, 2], "arch": ["house", 29, 20, 3, 3],
    "bannerA": ["house", 22, 20, 1, 2], "bannerB": ["house", 24, 20, 1, 2], "bannerC": ["house", 26, 20, 1, 2],
    "towerWood": ["towers", 0, 0, 2, 2], "towerBeige": ["towers", 12, 0, 2, 2], "towerGreen": ["towers", 12, 2, 2, 2],
    "towerWhite": ["towers", 12, 4, 2, 2], "towerGrey": ["towers", 18, 0, 2, 2], "towerFire": ["towers", 18, 2, 2, 2],
    "towerCrystal": ["towers", 18, 4, 2, 2],
    "tent1": ["camp", 4, 0, 3, 3], "tent2": ["camp", 7, 0, 3, 3], "tent3": ["camp", 10, 0, 3, 3],
    "lamp": ["camp", 6, 5, 1, 2], "logs": ["camp", 0, 0, 2, 1],
    "boardPanel": ["element", 11, 1, 3, 1], "boardFrame": ["element", 11, 2, 3, 2], "sign": ["element", 13, 0, 1, 1],
    "barrel": ["element", 0, 0, 1, 1], "crate": ["element", 9, 2, 1, 1], "counter": ["element", 2, 10, 3, 1],
    "boat": ["water", 25, 0, 3, 1]
  }/*SPR-END*/;

  // 地面材質：[主圖塊, [點綴圖塊…], 邊線色]（TilesetFloor 裡的格子）
  var TEX = {
    grass:     [[0, 12], [[1, 12], [2, 12], [3, 12], [4, 12], [2, 11], [3, 11]], '#a8a129'],
    darkgrass: [[11, 12], [[12, 12], [13, 12], [14, 12], [15, 12]], '#56864c'],
    dirt:      [[1, 8], [[0, 11], [1, 11]], '#ad704b'],
    darkdirt:  [[12, 8], [[14, 11], [11, 11]], '#816855'],
    sand:      [[1, 1], [[0, 4], [1, 4]], '#ffad5d'],
    osand:     [[0, 5], [[1, 5], [2, 5], [3, 5], [4, 5]], '#ef914f'],
    pinksand:  [[11, 5], [[12, 5], [13, 5], [14, 5], [15, 5]], '#ef9597'],
    snow:      [[0, 19], [[1, 19], [2, 19], [3, 19], [4, 19]], '#d2c9c9'],
    stone:     [[11, 19], [[12, 19], [13, 19], [14, 19], [15, 19]], '#8e7c73'],
    darkstone: [[12, 15], [[14, 18], [12, 15]], '#695953']
  };
  /* 地面材質要逐點讀顏色（getImageData）。直接雙擊 index.html（file://）開網站時，
     從檔案載入的圖會被瀏覽器當成「別的來源」，一讀就出錯、整個島畫不出來。
     所以把上面 TEX 用到的 43 格地面另外做成一張小圖，直接寫在程式裡（data: 網址不受這個限制）。
     圖塊同樣出自 pixel/tiles/floor.png；TEX 改了格子，要重新產生這張小圖。 */
  var FLOOR_ATLAS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAArAAAAAQCAYAAADux0xxAAAIj0lEQVR42u2cUU9URxTHr6wVSQpLq0EIrbQmmjb2uQ8mxFeb+OyTid/IL0L8Br6YPpj60JDUqMEIAlIoobLL2lA0xD7oLLNnz5mZc87M3Lt0/slmd2bu/8zde2H5cfbMnHnw8MbHqmhk9Xj7fbkICt3bvD7Q3u2FX8+ZyXNDfbn9y/v7A31HnX+D/ePT54f6cvvv3rk52j9AG8vll0ijy7fLNVCot3CrXASFHi3dLxdBoVcbawPtbvcw2NtuTwz1cf1nyy0o+j+LAsYQuHTBZi4/BYwhcOmCzbr9RUVFRUXNFgWcIXDqgtVQfwHYoiIHOBponJk8FwSVuf1re25wNJA4Pn0+CCpz+4uKioqKTocgeBrobLcngqCU648GsB+2Tr7K/GL+K7Qfjmlja86TG+fD1r567ibMT2ljc7b/+vK3O2g/HNPG1pwnN87G5izqwaCwjvELC3NVVVXV86frAx6f3weFTR+Pmw7Yqar2rGj8+NJiVVVV1VpZcsdIpM6bg/7r6W+m0H44po2tOU9unM6bA/XczvhP3p68x5+/RvvhmDa25jy5cTpP3qrndun12ov+6+++/wHth2Pa2Jrz5MZ5vfZCPbdLL7ff9V9fnfsS7Ydj2tia8+TGebn9DvVgUJlzPArAQrgybQy6uCBGxZYAo+2VAuGozS+BO9PGoI8CQW5sCbDaXm4c6fxGdiaU0sruXnVt5iLp7xwekOMx5nfJzoSm8q/2xqsrk0ekf6vVJseTQ2x3p2qqINyZNgZ9XBCkYkuA1fZKgTQFyEK4M20M+rggSMWWAKvtlQJpCpCFcGfaGPRxQZCKLQFW2ysF0hQgC+HOtDHoo0CQG1sCrLaXG0c6f//j18qkij7WCf9YjBto4Ay2U8Cr/Rzqx+BR8h6lsFnX/KEycAjbKeDVfg71Y/AqeY8aUV/hYxCL/uE5PHD6nj9dH8q+SuanpP0KP9S/2htH+7da7fQkaMAVwmoAvLZWlmrLvho4hO0U8Go/h/oxeJW8x2TX7zMcwnYKeLWfQ/0YvEreYyoZOITtFPBqP4f6MXiVvMdUMnAI2yng1X4O9WPwKnmPqo9mogRA6x+LdRNtiKXgVQNtkjICCNYwTmqQrHt+KcRS8KqBRkkZAQRrGCcWyO723qOPUJnjpyem+hBr+ymotf3YuVxYmBt6UNlN7BGqWP75424fYm0/BbVZINaGVxectmeHxo8vLQ49ckAsBa8aaJSUEUCwhnGaBLI2xFLwqoFGSRkBBGsYp0kga0MsBa8aaJSUEUCwhnGaBLI2xFLwqoFGSRkBBGsYJxbIdruH6CNUGn+WRVwQ2iQQJgU3ly9lVrMp88cQhEZJNlOaAXX5tFlVCI+uMWpx1dAfmImpqnN48DnjOjWQebXLB3yA/ONPC2j/hYW56u/17b7fBZr2GLW4ygemXP/8cbfaarWrrVa7mu90BzKvdvlA0h0I2rOfwDUUXhFRsHp8abFq/fVr1t8/CI0SCJSCo8uXMqsa9foBaJRAoBQcXb6UWdWYgtAogUApOLp8KbOqMQWhUZLNlGZAXT5tVtXAZ8gYtTgrNDblj7qIKxTIqGNjLPjywWJd0Fj3/CGQGgqE1LExFnz5YDVmTAxMKUjlbLc1M3mxWtndG4DX6YkpNAbmpzKt2Lm4vta3IZGz3ZbWf6U6qlZ74wPwOn/crY46GX+gDcRGhNeTT8+d6KUGHDCljo2x4MsHq02FVg6YUsfGWPDlg9WmQisHTKljYyz48sFqU6GVA6bUsTEWfPlgNWZMDCwpAOVst8XxRwNYX6bRtxhLWzMLV/dLV/tz523K/LEAkRrzLcbS1szC3QWkuw1w55XCrU/XZi72SwekC7dCzu3P/X/IY7Q7AGj8VyaP+qUDnzKvNWyhZWdia6htlQAiNeZbjKWtmYW7C0h3G+DOGxsQqTHfYixtzSzcXUC62wB33tiASI35FmNpa2bh7gLS3Qa488YGRGrMtxhLWzMLdxeQ7jbAnVcKt7H8YyluJqz9DIFVrF4U63MBnzketrkQSrWbOn8KmHWVDWCAiNWrYn0u4DTHwzYHXF1trbj1sQZcDchK6mtjSlLfqvGbkgEDstr5xRBbVY3ehYACVg6sYvWqWJ8LOM3xsM0BV1c7J8y6ygYwQMTqVbE+F3Ca42GbA66udk6YdZUNYICI1atifS7gNMfDNgdcXe2cMOsqG8AAEatXxfpcwGmOh20OuLraWknqY33+sVQ3UZpBlC5swhZ55aq3rXv+VBArkXRhFbbIK3e9rQ8wzU4AVGYW89sQG+p3ybVTgQ8QzU4CVGY1hd+GWJ9/FCA2104F0gymdGEVtsgrd71tbIgVXT/hwipskVfuetvYECuRdGEVtsgrd71tbIiVSLqwClvklbve1geoZicBKrMq8Y/VcXND6l+5MEftesABYiwrLPXmnr9uuKXAlbPjABaPA8RYVpgDrlSfayzEb+9OEOJ//nTdCa/weAw67T7XWA6/vTsBdXyTILa1slQrvEoAkQJXzo4DWDwOEGNZ4SYqpP6VC5PUrgccIMaywk1USP0rFyapXQ84QIxlhZuokPpXLkxSux5wgBjLCnPAlepzjWn9Zx48vPExx00LzUZqakdTxGn6/I+383wdHZoN1dSupojj0y/PrvZfS2peXTsVQGE1sZQ/dMHXb2vb/deSzKZrp4HY/sGa2E+6e+dmI//IoKCLwevGcpbTCc2GampXU8Tx/9d5O8/1C8yGampXU8TxqbdwK8v1C82GampXU8Tx6dHS/SzXLzQbqqldTRHHp9//eHby8SioeXXtNBCibABbNNoAe1p1b/P6SJ//8v7+SJ9/YwE2+D+t5fJLNAIAe1qVC2BPq3IB7GnVq421Wuc/W25BURGu0CxoU/3Y1/ScLGvd/qKioqKi0RRWy8rJsob4/wPWBk+ZTKNg1wAAAABJRU5ErkJggg=='
  var FLOOR_ATLAS_KEY = {"0,12": 0, "1,12": 1, "2,12": 2, "3,12": 3, "4,12": 4, "2,11": 5, "3,11": 6, "11,12": 7, "12,12": 8, "13,12": 9, "14,12": 10, "15,12": 11, "1,8": 12, "0,11": 13, "1,11": 14, "12,8": 15, "14,11": 16, "11,11": 17, "1,1": 18, "0,4": 19, "1,4": 20, "0,5": 21, "1,5": 22, "2,5": 23, "3,5": 24, "4,5": 25, "11,5": 26, "12,5": 27, "13,5": 28, "14,5": 29, "15,5": 30, "0,19": 31, "1,19": 32, "2,19": 33, "3,19": 34, "4,19": 35, "11,19": 36, "12,19": 37, "13,19": 38, "14,19": 39, "15,19": 40, "12,15": 41, "14,18": 42};


  /* 各島主題：地面、步道、廣場、樹種、建築、島長、小動物 */
  var THEMES = {
    hub: {
      ground: 'grass', patch: 'darkgrass', sand: 'sand', path: 'dirt', plaza: 'stone', cliff: 0,
      trees: ['treeGreen', 'treeBig', 'treeLight', 'treePine', 'fruitGreen'], flowers: ['redFlower', 'whiteFlower', 'sunflower', 'clover', 'bush'],
      bld: ['houseOrange', 'houseBeige', 'woodHouse', 'shop', 'bakery', 'greenShop', 'houseOrange2'],
      npc: 'MaskRacoon', animals: ['cat', 'dog'], flag: 'flagRed'
    },
    ethics: {
      ground: 'grass', patch: 'darkgrass', sand: 'sand', path: 'dirt', plaza: 'dirt', cliff: 1,
      trees: ['fruitPink', 'fruitOrange', 'treeGreen', 'treeLight', 'fruitGreen'], flowers: ['sunflower', 'redFlower', 'berryBush', 'clover'],
      bld: ['barn', 'woodHouse', 'houseBeige', 'greenShop'],
      npc: 'Monkey', animals: ['chicken', 'pig'], flag: 'flagYellow'
    },
    thinking: {
      ground: 'grass', patch: 'darkgrass', sand: 'pinksand', path: 'osand', plaza: 'pinksand', cliff: 1,
      trees: ['treePink', 'treeLight2', 'fruitPink', 'treeLight'], flowers: ['whiteFlower', 'redFlower', 'sunflower'],
      bld: ['tent1', 'tent2', 'tent3', 'shop', 'houseOrange2'],
      npc: 'Noble', animals: ['parrot', 'lioncub'], flag: 'flagBlue'
    },
    code: {
      ground: 'darkgrass', patch: 'grass', sand: 'osand', path: 'darkdirt', plaza: 'darkstone', cliff: 1,
      trees: ['treePine', 'treeDead', 'treeGreen', 'treeBig'], flowers: ['fern', 'bush', 'stone'],
      bld: ['woodHouse', 'kiln', 'hut', 'stoneHut', 'bakery'],
      npc: 'Master', animals: ['dog', 'frog'], flag: 'flagWhite'
    },
    arduino: {
      ground: 'snow', patch: 'snow', sand: 'sand', path: 'stone', plaza: 'stone', cliff: 0,
      trees: ['treeSnow', 'treePine', 'treeSnow2', 'treeLight'], flowers: ['crystalBlue', 'crystalPink', 'crystalGreen', 'rockSnow'],
      bld: ['shop', 'houseOrange2', 'greenShop', 'dojo', 'towerCrystal'],
      npc: 'RobotGreen', animals: ['catwhite', 'hamster'], flag: 'flagGreen'
    }
  };
  THEMES.flowchart = THEMES.code;

  // 建築種類 → 圖（找不到就依主題輪流）
  var KIND_SPR = {
    'museum': 'greenShop', 'treehouse': 'bigWood', 'workshop': 'woodHouse', 'lighthouse': 'towerBeige',
    'cottage-amber': 'houseOrange', 'camp': 'tent1', 'shrine': 'torii',
    'orchard-barn': 'barn', 'orchard-mill': 'bigWood', 'orchard-greenhouse': 'greenShop',
    'carnival-hopscotch': 'tent1', 'carnival-portal': 'arch', 'carnival-slide': 'tent2', 'carnival-dumpling': 'shop',
    'carnival-arcade': 'houseOrange2', 'carnival-bus': 'tent3', 'carnival-gacha': 'greenShop', 'carnival-coin': 'bakery',
    'carnival-mole': 'tent2', 'carnival-radish': 'strawHut', 'carnival-wheel': 'towerFire', 'carnival-carousel': 'tent3',
    'craft-forge': 'kiln', 'craft-watermill': 'woodHouse', 'craft-clockwork': 'towerGrey', 'craft-minecart': 'hut',
    'craft-sawmill': 'bigWood', 'craft-temple': 'dojo', 'craft-robot': 'towerGreen',
    'tech-gatehouse': 'shop', 'tech-corridor': 'greenShop', 'tech-windtower': 'towerGrey',
    'tech-rgbhouse': 'houseOrange2', 'tech-hq': 'dojo'
  };
  var FRUIT_COLORS = {
    'orchard-apple': ['#e5383b', '#ff6b6b'], 'orchard-peach': ['#ff9eb5', '#ffc2d1'], 'orchard-orange': ['#f77f00', '#fcbf49'],
    'orchard-pear': ['#c5d86d', '#f2e86d'], 'orchard-cherry': ['#9d0208', '#d00000'], 'orchard-golden-tree': ['#ffd60a', '#fff3b0']
  };

  /* ── 小工具 ───────────────────────────────────────────── */
  function hash2(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hexRgb(h) {
    h = String(h).replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dither(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function imageData(im) {
    var c = makeCanvas(im.width, im.height), g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    return g.getImageData(0, 0, im.width, im.height);
  }
  function drawSpr(g, A, name, x, y, flip) {
    var d = SPR[name];
    if (!d) return;
    var im = A[d[0]];
    var w = d[3] * TILE, h = d[4] * TILE;
    if (flip) {
      g.save(); g.translate(Math.round(x) + w, Math.round(y)); g.scale(-1, 1);
      g.drawImage(im, d[1] * TILE, d[2] * TILE, w, h, 0, 0, w, h);
      g.restore();
    } else {
      g.drawImage(im, d[1] * TILE, d[2] * TILE, w, h, Math.round(x), Math.round(y), w, h);
    }
  }
  function sprSize(name) { var d = SPR[name]; return d ? [d[3] * TILE, d[4] * TILE] : [16, 16]; }

  // 角色：64×112，欄＝方向（下、上、左、右），列 0～3 ＝走路四格
  function drawChar(g, im, x, y, dir, frame, shadowIm, hop) {
    if (!im) return;
    if (shadowIm) g.drawImage(shadowIm, Math.round(x - 6), Math.round(y - 4));
    g.drawImage(im, dir * 16, (frame % 4) * 16, 16, 16, Math.round(x - 8), Math.round(y - 15 - (hop || 0)), 16, 16);
  }
  function headingToDir(dx, dy, prev) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return prev;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 2 : 3;
    return dy < 0 ? 1 : 0;
  }

  /* =====================================================================
     島嶼地形：哪裡是陸地、高台、崖壁、河、步道 ……
     ===================================================================== */
  function buildTerrain(ctx) {
    var vk = ctx.variantKey || 'hub';
    var prof = ctx.prof;
    var sx = prof.scaleX, sz = prof.scaleZ, sides = prof.sides || 56;
    var cx = MAP_W / 2, cy = MAP_H / 2;
    var rx = 37.2 * sx * WX, rz = 37.2 * sz * WZ;
    var plat = {
      x0: wxToMx(-25.2 * sx / 1.04) - 6, x1: wxToMx(25.2 * sx / 1.04) + 6,
      y0: 82, y1: CLIFF_Y
    };
    var ramp = { x0: wxToMx(prof.rampXMin), x1: wxToMx(prof.rampXMax) };
    var sign = prof.riverSign || 1;
    function riverX(my) {
      var wz = (my / PXY - 50) * 0.70;
      return wxToMx(sign * (20.8 - 0.0998 * (wz - 1.2)));
    }
    var river = { y0: CLIFF_Y + CLIFF_H, y1: wzToMy(15.2), hw: 1.7 * WX };
    // 高台池塘：位置照 3D（建築擺放校正就是避開那裡），但整個留在崖邊以上；河道從池塘下方的瀑布彎回 3D 的河道
    var pond = { x: wxToMx(19.5 * sign), y: Math.min(wzToMy(-15.2), CLIFF_Y - 31), r: 28 };
    var riverX3d = riverX;
    riverX = function (my) {
      var t = clamp((my - river.y0) / 80, 0, 1);
      t = t * t * (3 - 2 * t);
      return pond.x + (riverX3d(my) - pond.x) * t;
    };
    var endPond = { x: riverX(river.y1), y: river.y1, r: 24 };
    var bridge = { y0: wzToMy(-3.2), y1: wzToMy(0.2), x: riverX(wzToMy(-1.5)), hw: 3.4 * WX };
    var pier = { x0: wxToMx(-2.5), x1: wxToMx(2.5), y0: wzToMy(15.0), y1: 690 };
    var peninsulas = vk === 'ethics'
      ? [{ x: wxToMx(-32), y: wzToMy(2.5), r: 9.5 * WX }, { x: wxToMx(32), y: wzToMy(2.5), r: 9.5 * WX }]
      : [];
    var starAmp = vk === 'thinking' ? 0.035 : 0;
    var polyPhase = Math.PI / 2 + Math.PI / sides;

    // 陸地「距離」：負的在陸地裡、正的在海上（像素）
    function islandSd(mx, my) {
      var u = (mx - cx) / rx, v = (my - cy) / rz;
      var r = Math.sqrt(u * u + v * v);
      var th = Math.atan2(v, u);
      var seg = Math.PI * 2 / sides;
      var a = ((th - polyPhase) % seg + seg) % seg - seg / 2;
      var pr = Math.cos(Math.PI / sides) / Math.cos(a);
      if (sides > 20) pr = 1;
      if (starAmp) pr *= 1 + starAmp * Math.cos(th * sides);
      var local = Math.sqrt(Math.pow(Math.cos(th) * rx, 2) + Math.pow(Math.sin(th) * rz, 2));
      return (r - pr) * local;
    }
    function boxSd(mx, my, x0, y0, x1, y1, rad) {
      var hx = (x1 - x0) / 2 - rad, hy = (y1 - y0) / 2 - rad;
      var qx = Math.abs(mx - (x0 + x1) / 2) - hx, qy = Math.abs(my - (y0 + y1) / 2) - hy;
      var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rad;
    }
    function landSd(mx, my) {
      var d = islandSd(mx, my);
      d = Math.min(d, boxSd(mx, my, plat.x0, plat.y0, plat.x1, plat.y1 + 30, 34));
      for (var i = 0; i < peninsulas.length; i++) {
        var p = peninsulas[i];
        d = Math.min(d, Math.sqrt((mx - p.x) * (mx - p.x) + (my - p.y) * (my - p.y)) - p.r);
      }
      d += (vnoise(mx / 26, my / 26, 7) - 0.5) * 12 + (vnoise(mx / 7, my / 7, 3) - 0.5) * 3;
      return d;
    }
    function onPlateau(mx, my) { return my < CLIFF_Y && mx > plat.x0 && mx < plat.x1; }
    function inRampX(mx) { return mx > ramp.x0 + 2 && mx < ramp.x1 - 2; }
    function inCliffBand(mx, my) {
      return my >= CLIFF_Y && my < CLIFF_Y + CLIFF_H && mx > plat.x0 - 2 && mx < plat.x1 + 2;
    }

    return {
      vk: vk, prof: prof, theme: THEMES[vk] || THEMES.hub, cx: cx, cy: cy, rx: rx, rz: rz,
      plat: plat, ramp: ramp, river: river, riverX: riverX, pond: pond, endPond: endPond, bridge: bridge, pier: pier,
      landSd: landSd, onPlateau: onPlateau, inRampX: inRampX, inCliffBand: inCliffBand
    };
  }

  /* 走路格子（2 像素一格）與尋路格子（8 像素一格） */
  var WG = 2, WGW = MAP_W / WG, WGH = MAP_H / WG;
  var PG = 8, PGW = MAP_W / PG, PGH = MAP_H / PG;

  function astar(passable, sx, sy, tx, ty, W, H) {
    if (sx === tx && sy === ty) return [[sx, sy]];
    var N = W * H;
    var g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var heap = [], hv = [];
    function push(i, f) {
      heap.push(i); hv.push(f);
      var k = heap.length - 1;
      while (k > 0) {
        var p = (k - 1) >> 1;
        if (hv[p] <= hv[k]) break;
        var t = heap[p]; heap[p] = heap[k]; heap[k] = t;
        t = hv[p]; hv[p] = hv[k]; hv[k] = t; k = p;
      }
    }
    function pop() {
      var top = heap[0], lastI = heap.pop(), lastV = hv.pop();
      if (heap.length) {
        heap[0] = lastI; hv[0] = lastV;
        var k = 0;
        for (;;) {
          var l = k * 2 + 1, r = l + 1, m = k;
          if (l < heap.length && hv[l] < hv[m]) m = l;
          if (r < heap.length && hv[r] < hv[m]) m = r;
          if (m === k) break;
          var t = heap[m]; heap[m] = heap[k]; heap[k] = t;
          t = hv[m]; hv[m] = hv[k]; hv[k] = t; k = m;
        }
      }
      return top;
    }
    var s = sy * W + sx, goal = ty * W + tx;
    g[s] = 0; push(s, 0);
    var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    var guard = 0;
    while (heap.length && guard++ < N * 2) {
      var cur = pop();
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      var cx = cur % W, cy = (cur / W) | 0;
      for (var d = 0; d < 8; d++) {
        var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var ni = ny * W + nx;
        if (closed[ni] || !passable(nx, ny)) continue;
        if (d >= 4 && (!passable(cx + DIRS[d][0], cy) || !passable(cx, cy + DIRS[d][1]))) continue;
        var ng = g[cur] + DIRS[d][2];
        if (ng < g[ni]) {
          g[ni] = ng; came[ni] = cur;
          var hx = Math.abs(nx - tx), hy = Math.abs(ny - ty);
          push(ni, ng + Math.max(hx, hy) + 0.414 * Math.min(hx, hy));
        }
      }
    }
    if (came[goal] < 0) return null;
    var path = [], c = goal;
    while (c >= 0) { path.push([c % W, (c / W) | 0]); if (c === s) break; c = came[c]; }
    return path.reverse();
  }

  /* =====================================================================
     AC_ISLAND2D.run(ctx)：島嶼
     ===================================================================== */
  function run(ctx) {
    var state = ctx.state, cfg = ctx.cfg, nodes = ctx.nodes || [], props = ctx.props || [];
    var stageEl = ctx.stageEl, canvasEl = ctx.canvasEl, overlayEl = ctx.overlayEl;
    var dead = false, A = null;
    var cleanupFns = [];
    var g = canvasEl.getContext('2d');
    canvasEl.setAttribute('data-engine', '2d');
    stageEl.classList.add('ac-engine-2d');
    stageEl.style.background = '#54a0bf';

    // 載入中先畫一片海，避免空白
    function sizeCanvas() {
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      var w = stageEl.clientWidth || 800, h = stageEl.clientHeight || 520;
      canvasEl.width = Math.round(w * dpr); canvasEl.height = Math.round(h * dpr);
      return { w: w, h: h, dpr: dpr };
    }
    var view = sizeCanvas();
    g.fillStyle = '#54a0bf'; g.fillRect(0, 0, canvasEl.width, canvasEl.height);

    loadAssets(ctx.base).then(function (assets) {
      if (dead || state.destroyed) return;
      A = assets;
      start();
    }).catch(function (err) {
      console.error('[AC_ISLAND2D] 2D 島嶼建立失敗', err);
      // 不要只留一片海：在畫面上講清楚，老師／學生知道可以改用 3D
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#54a0bf'; g.fillRect(0, 0, canvasEl.width, canvasEl.height);
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.font = 'bold ' + Math.round(18 * view.dpr) + 'px sans-serif';
      g.fillText('2D 像素畫面載入失敗，請按 M 改用清單，或到 versions.html 換成 3D', canvasEl.width / 2, canvasEl.height / 2);
      g.font = Math.round(13 * view.dpr) + 'px sans-serif';
      g.fillText(String(err && err.message || err).slice(0, 120), canvasEl.width / 2, canvasEl.height / 2 + 28 * view.dpr);
    });

    function start() {
      var T = buildTerrain(ctx);
      var theme = T.theme;
      var R = rng(({ hub: 11, ethics: 23, thinking: 37, code: 41, flowchart: 41, arduino: 53 })[T.vk] || 11);

      /* ── 1. 建築、道具、島長的位置 ── */
      var npcPct = { x: 50 + -4.5 / 0.94, y: 50 + 3.6 / 0.70 };
      var npcPos = { x: pctToMx(npcPct.x), y: pctToMy(npcPct.y) };
      var entries = [];   // 會擋路、要排前後的東西
      nodes.forEach(function (n, idx) {
        var mx = pctToMx(n.x), my = pctToMy(n.y);
        var kind = String(n.kind || '');
        var e = { node: n, x: mx, y: my, kind: kind, shake: 0 };
        if (n.id === 'dodo-airport' || kind === 'airport') {
          e.type = 'airport'; e.w = 48; e.h = 40; e.foot = null;
        } else if (kind === 'board') {
          e.type = 'board'; e.w = 48; e.h = 40; e.foot = [mx - 20, my - 4, mx + 20, my + 4];
        } else if (FRUIT_COLORS[kind]) {
          e.type = 'orchard'; e.spr = kind === 'orchard-golden-tree' ? 'fruitOrange' : 'fruitGreen';
          e.w = 48; e.h = 48; e.foot = [mx - 8, my - 6, mx + 8, my + 4];
          e.fruit = FRUIT_COLORS[kind];
        } else {
          e.type = 'building';
          e.spr = KIND_SPR[kind] || theme.bld[idx % theme.bld.length];
          var sz = sprSize(e.spr); e.w = sz[0]; e.h = sz[1];
          var fh = Math.min(e.h * 0.5, 30);
          e.foot = [mx - e.w * 0.42, my + 8 - fh, mx + e.w * 0.42, my + 6];
        }
        e.base = my + 8;            // 圖的底邊
        e.top = e.base - e.h;       // 木牌掛在這裡
        e.dom = overlayEl.querySelector('.ac-node[data-node="' + cssEsc(n.id) + '"]');
        entries.push(e);
      });
      var propEntries = props.map(function (p) {
        var mx = pctToMx(p.x), my = pctToMy(p.y);
        var name = p.kind === 'pine-tree' ? 'treePine'
          : (p.kind === 'palm-tree' ? 'treeLight2'
            : (p.kind === 'fruit-tree' ? (p.fruit === 'orange' ? 'fruitOrange' : 'fruitPink') : 'treeGreen'));
        if (T.vk === 'arduino' && p.kind === 'pine-tree') name = 'treeSnow';
        var sz = sprSize(name);
        return { data: p, x: mx, y: my, spr: name, w: sz[0], h: sz[1], base: my + 6, shake: 0, foot: [mx - 7, my - 2, mx + 7, my + 5] };
      });
      var lamps = [[-8.5, 5.2], [8.5, 5.2], [-11.8, -4.5], [11.8, -4.5], [-3.2, 16.5], [3.2, 16.5]].map(function (lp) {
        return { x: wxToMx(lp[0]), y: wzToMy(lp[1]) };
      });

      /* ── 2. 地表分類（每一個像素） ── */
      var CL = { DEEP: 0, SEA: 1, SHALLOW: 2, FOAM: 3, SAND: 4, GROUND: 5, PATCH: 6, PATH: 7, PLAZA: 8, RIVER: 9, BANK: 10 };
      var N = MAP_W * MAP_H;
      var cls = new Uint8Array(N);
      var sdf = new Float32Array(N);
      for (var y = 0; y < MAP_H; y++) {
        for (var x = 0; x < MAP_W; x++) {
          var i = y * MAP_W + x;
          var d = T.landSd(x + 0.5, y + 0.5);
          sdf[i] = d;
          if (d > 0) {
            var t = dither(x, y) * 8;
            cls[i] = d < 2.5 ? CL.FOAM : (d < 22 + t ? CL.SHALLOW : (d < 64 + t * 2 ? CL.SEA : CL.DEEP));
          } else {
            var sandW = 14 + vnoise(x / 30, y / 30, 5) * 10;
            if (d > -sandW && !T.onPlateau(x, y)) cls[i] = CL.SAND;
            else if (d > -sandW * 0.6) cls[i] = CL.SAND;
            else cls[i] = vnoise(x / 40, y / 40, 9) > 0.66 ? CL.PATCH : CL.GROUND;
          }
        }
      }

      // 河、池塘（用畫布畫形狀再讀回來）
      var mask = makeCanvas(MAP_W, MAP_H), mg = mask.getContext('2d');
      mg.lineCap = 'round'; mg.lineJoin = 'round';
      mg.strokeStyle = '#00f'; mg.fillStyle = '#00f';
      mg.lineWidth = T.river.hw * 2;
      mg.beginPath();
      for (var ry = T.river.y0 - 6; ry <= T.river.y1; ry += 4) {
        var rxp = T.riverX(ry) + Math.sin(ry / 38) * 5;
        if (ry === T.river.y0 - 6) mg.moveTo(rxp, ry); else mg.lineTo(rxp, ry);
      }
      mg.stroke();
      mg.beginPath(); mg.arc(T.pond.x, T.pond.y, T.pond.r, 0, Math.PI * 2); mg.fill();
      mg.beginPath(); mg.arc(T.endPond.x, T.endPond.y, T.endPond.r, 0, Math.PI * 2); mg.fill();
      mg.fillRect(T.pond.x - T.river.hw * 0.8, T.pond.y, T.river.hw * 1.6, CLIFF_Y + CLIFF_H + 8 - T.pond.y);
      var md = mg.getImageData(0, 0, MAP_W, MAP_H).data;
      for (var i2 = 0; i2 < N; i2++) {
        if (md[i2 * 4 + 2] > 110 && cls[i2] >= CL.SAND) cls[i2] = CL.RIVER;
      }

      /* ── 3. 暫時的走路格子（還沒有步道）→ 用來找步道路線 ── */
      function terrainOK(px, py) {
        if (px < 4 || py < 4 || px >= MAP_W - 4 || py >= MAP_H - 4) return false;
        var c = cls[(py | 0) * MAP_W + (px | 0)];
        if (inBridge(px, py) || inPier(px, py)) return true;
        if (c < CL.SAND || c === CL.RIVER) return false;
        if (T.inCliffBand(px, py) && !T.inRampX(px)) return false;
        if (py < CLIFF_Y + CLIFF_H && (Math.abs(px - T.plat.x0) < 4 || Math.abs(px - T.plat.x1) < 4)) return false;
        return true;
      }
      function inBridge(px, py) {
        return py >= T.bridge.y0 && py <= T.bridge.y1 && Math.abs(px - T.bridge.x) <= T.bridge.hw;
      }
      function inPier(px, py) {
        return px >= T.pier.x0 && px <= T.pier.x1 && py >= T.pier.y0 && py <= T.pier.y1 - 12;
      }
      var footBlock = new Uint8Array(WGW * WGH);
      function blockRect(r, pad) {
        if (!r) return;
        pad = pad || 0;
        var x0 = Math.max(0, Math.floor((r[0] - pad) / WG)), x1 = Math.min(WGW - 1, Math.floor((r[2] + pad) / WG));
        var y0 = Math.max(0, Math.floor((r[1] - pad) / WG)), y1 = Math.min(WGH - 1, Math.floor((r[3] + pad) / WG));
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) footBlock[yy * WGW + xx] = 1;
      }
      entries.forEach(function (e) { blockRect(e.foot); });
      propEntries.forEach(function (p) { blockRect(p.foot); });
      blockRect([npcPos.x - 6, npcPos.y - 4, npcPos.x + 6, npcPos.y + 2]);
      lamps.forEach(function (l) { blockRect([l.x - 3, l.y - 3, l.x + 3, l.y + 1]); });

      function pathPassable(cx8, cy8) {
        var px = cx8 * PG + PG / 2, py = cy8 * PG + PG / 2;
        if (!terrainOK(px, py)) return false;
        return !footBlock[((py / WG) | 0) * WGW + ((px / WG) | 0)];
      }
      function nearestPass(px, py, fn) {
        var cx8 = clamp(Math.floor(px / PG), 0, PGW - 1), cy8 = clamp(Math.floor(py / PG), 0, PGH - 1);
        if (fn(cx8, cy8)) return [cx8, cy8];
        for (var r = 1; r < 30; r++) {
          for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            var ax = cx8 + dx, ay = cy8 + dy;
            if (ax >= 0 && ay >= 0 && ax < PGW && ay < PGH && fn(ax, ay)) return [ax, ay];
          }
        }
        return [cx8, cy8];
      }
      function losClear(a, b, fn) {
        var dx = b[0] - a[0], dy = b[1] - a[1], steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2);
        for (var s = 1; s < steps; s++) {
          var x = a[0] + dx * s / steps, y = a[1] + dy * s / steps;
          if (!fn(Math.floor(x), Math.floor(y)) || !fn(Math.ceil(x), Math.ceil(y)) || !fn(Math.floor(x), Math.ceil(y)) || !fn(Math.ceil(x), Math.floor(y))) return false;
        }
        return true;
      }
      function smooth(path, fn) {
        if (!path || path.length < 3) return path;
        var out = [path[0]], k = 0;
        while (k < path.length - 1) {
          var j = path.length - 1;
          while (j > k + 1 && !losClear(path[k], path[j], fn)) j--;
          out.push(path[j]); k = j;
        }
        return out;
      }

      /* ── 4. 廣場與步道 ── */
      var plaza = { x: MAP_W / 2, y: MAP_H / 2 + 4 };
      var pm = makeCanvas(MAP_W, MAP_H), pg = pm.getContext('2d');
      pg.fillStyle = '#f00';
      var shape = T.prof.plazaShape || 'box';
      pg.beginPath();
      if (shape === 'circle') pg.arc(plaza.x, plaza.y, 52, 0, Math.PI * 2);
      else if (shape === 'box') pg.rect(plaza.x - 66, plaza.y - 40, 132, 80);
      else {
        var ns = shape === 'octagon' ? 8 : 6, rr = shape === 'octagon' ? 56 : 58;
        for (var k = 0; k < ns; k++) {
          var ang = Math.PI * 2 * k / ns + Math.PI / ns;
          var vx = plaza.x + Math.cos(ang) * rr * 1.15, vy = plaza.y + Math.sin(ang) * rr * 0.85;
          if (k === 0) pg.moveTo(vx, vy); else pg.lineTo(vx, vy);
        }
        pg.closePath();
      }
      pg.fill();
      pg.strokeStyle = '#0f0'; pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.lineWidth = 13;
      var plazaCell = nearestPass(plaza.x, plaza.y, pathPassable);
      var pathTargets = entries.map(function (e) { return [e.x, e.y + 20]; });
      pathTargets.push([MAP_W / 2, T.pier.y0 + 10]);
      pathTargets.forEach(function (tp) {
        var goal = nearestPass(tp[0], tp[1], pathPassable);
        var p = smooth(astar(pathPassable, plazaCell[0], plazaCell[1], goal[0], goal[1], PGW, PGH), pathPassable);
        if (!p) return;
        pg.beginPath();
        p.forEach(function (c, ix) {
          var px = c[0] * PG + PG / 2, py = c[1] * PG + PG / 2;
          if (ix === 0) pg.moveTo(plaza.x, plaza.y);
          pg.lineTo(px, py);
        });
        pg.lineTo(tp[0], tp[1]);
        pg.stroke();
      });
      var pd = pg.getImageData(0, 0, MAP_W, MAP_H).data;
      for (var i3 = 0; i3 < N; i3++) {
        var c3 = cls[i3];
        if (c3 < CL.SAND || c3 === CL.RIVER) continue;
        var x3 = i3 % MAP_W, y3 = (i3 / MAP_W) | 0;
        if (pd[i3 * 4] > 128) cls[i3] = CL.PLAZA;
        else if (pd[i3 * 4 + 1] > 128 - (vnoise(x3 / 5, y3 / 5, 13) - 0.5) * 160) cls[i3] = CL.PATH;
      }

      /* ── 5. 上色：把每一類對應到圖塊材質，交界畫一條深色邊 ── */
      var floorD = imageData(A.floorAtlas).data, FW = A.floorAtlas.width;
      function texFamily(c) {
        if (c === CL.SAND) return TEX[theme.sand];
        if (c === CL.GROUND) return TEX[theme.ground];
        if (c === CL.PATCH) return TEX[theme.patch];
        if (c === CL.PATH) return TEX[theme.path];
        if (c === CL.PLAZA) return TEX[theme.plaza];
        return null;
      }
      var edgeRgb = {};
      Object.keys(TEX).forEach(function (k) { edgeRgb[k] = hexRgb(TEX[k][2]); });
      function famKey(c) {
        return c === CL.SAND ? theme.sand : c === CL.GROUND ? theme.ground : c === CL.PATCH ? theme.patch
          : c === CL.PATH ? theme.path : c === CL.PLAZA ? theme.plaza : '';
      }
      var WATER = {};
      WATER[CL.DEEP] = hexRgb('#4c93b5'); WATER[CL.SEA] = hexRgb('#5aa7c6'); WATER[CL.SHALLOW] = hexRgb('#71ddee');
      WATER[CL.FOAM] = hexRgb('#d4f5fa'); WATER[CL.RIVER] = hexRgb('#71ddee');
      var waterHi = hexRgb('#8feff1'), riverEdge = hexRgb('#54a0bf'), deepSpeck = hexRgb('#79b8ce');
      var mapCanvas = makeCanvas(MAP_W, MAP_H), mapG = mapCanvas.getContext('2d');
      var out = mapG.createImageData(MAP_W, MAP_H), od = out.data;
      for (var yy = 0; yy < MAP_H; yy++) {
        for (var xx = 0; xx < MAP_W; xx++) {
          var ii = yy * MAP_W + xx, c = cls[ii], o = ii * 4, rgb;
          if (c <= CL.FOAM || c === CL.RIVER) {
            rgb = WATER[c];
            if (c === CL.RIVER) {
              var nb = (xx > 0 && cls[ii - 1] !== CL.RIVER) || (xx < MAP_W - 1 && cls[ii + 1] !== CL.RIVER) ||
                       (yy > 0 && cls[ii - MAP_W] !== CL.RIVER);
              if (nb) rgb = riverEdge;
              else if (hash2(xx >> 2, yy, 4) > 0.985) rgb = waterHi;
            } else if (c === CL.SHALLOW && hash2(xx >> 2, yy, 5) > 0.992) rgb = waterHi;
            else if (c === CL.DEEP && hash2(xx >> 3, yy, 6) > 0.993) rgb = deepSpeck;
            od[o] = rgb[0]; od[o + 1] = rgb[1]; od[o + 2] = rgb[2]; od[o + 3] = 255;
            continue;
          }
          var fam = texFamily(c);
          var tcx = xx >> 4, tcy = yy >> 4;
          var hv = hash2(tcx, tcy, c);
          var tile = hv < 0.78 ? fam[0] : fam[1][Math.floor(hash2(tcx, tcy, c + 50) * fam[1].length)];
          var ti = tile._a;
          if (ti === undefined) ti = tile._a = FLOOR_ATLAS_KEY[tile[0] + ',' + tile[1]];
          var fo = ((yy & 15) * FW + ti * 16 + (xx & 15)) * 4;
          var r = floorD[fo], gg = floorD[fo + 1], b = floorD[fo + 2];
          // 交界：上方或左方是「比較低」的一類 → 畫邊線
          var up = yy > 0 ? cls[ii - MAP_W] : c, lf = xx > 0 ? cls[ii - 1] : c, dn = yy < MAP_H - 1 ? cls[ii + MAP_W] : c, rt = xx < MAP_W - 1 ? cls[ii + 1] : c;
          var key = famKey(c);
          if ((c === CL.PATH || c === CL.PLAZA) && (isGrassy(up) || isGrassy(lf) || isGrassy(dn) || isGrassy(rt))) {
            rgb = edgeRgb[key]; r = rgb[0]; gg = rgb[1]; b = rgb[2];
          } else if (isGrassy(c) && (up === CL.SAND || dn === CL.SAND || lf === CL.SAND || rt === CL.SAND)) {
            rgb = edgeRgb[key]; r = rgb[0]; gg = rgb[1]; b = rgb[2];
          } else if (c === CL.SAND && (up === CL.FOAM || lf === CL.FOAM || dn === CL.FOAM || rt === CL.FOAM)) {
            r = 255; gg = 236; b = 200;
          }
          od[o] = r; od[o + 1] = gg; od[o + 2] = b; od[o + 3] = 255;
        }
      }
      function isGrassy(v) { return v === CL.GROUND || v === CL.PATCH; }
      mapG.putImageData(out, 0, 0);
      mapG.imageSmoothingEnabled = false;

      /* ── 6. 地面上的平面裝飾：草叢、碎石、高台崖壁、石階、橋、碼頭、鐵軌 ── */
      var detailRow = T.vk === 'arduino' ? 3 : 2;
      for (var dcount = 0; dcount < 260; dcount++) {
        var dx0 = R() * MAP_W, dy0 = R() * MAP_H;
        var dc = cls[(dy0 | 0) * MAP_W + (dx0 | 0)];
        if (!isGrassy(dc) || T.inCliffBand(dx0, dy0)) continue;
        var col = Math.floor(R() * 5);
        mapG.drawImage(A.detail, col * 16, detailRow * 16, 16, 16, Math.round(dx0 - 8), Math.round(dy0 - 8), 16, 16);
      }
      // 崖壁（Relief：綠色或棕色的岩壁），石階走廊留空
      var cliffRow0 = theme.cliff ? 5 : 0;
      for (var cxp = Math.floor(T.plat.x0 / 16) * 16; cxp < T.plat.x1; cxp += 16) {
        if (cxp + 16 > T.ramp.x0 && cxp < T.ramp.x1) continue;
        var cc = cxp <= T.plat.x0 ? 4 : (cxp + 16 >= T.plat.x1 ? 6 : 5);
        if (cls[(CLIFF_Y - 4) * MAP_W + clamp(cxp + 8, 0, MAP_W - 1)] < CL.SAND && cls[(CLIFF_Y + CLIFF_H + 2) * MAP_W + clamp(cxp + 8, 0, MAP_W - 1)] < CL.SAND) continue;
        mapG.drawImage(A.relief, cc * 16, (cliffRow0 + 1) * 16, 16, 16, cxp, CLIFF_Y, 16, 16);
        mapG.drawImage(A.relief, cc * 16, (cliffRow0 + 2) * 16, 16, 16, cxp, CLIFF_Y + 16, 16, 16);
      }
      // 高台兩側的崖邊（直的）
      [T.plat.x0, T.plat.x1].forEach(function (ex) {
        mapG.fillStyle = 'rgba(60,40,30,0.55)';
        for (var ey = T.plat.y0 + 30; ey < CLIFF_Y + CLIFF_H; ey++) {
          if (cls[ey * MAP_W + clamp(Math.round(ex), 0, MAP_W - 1)] >= CL.SAND) mapG.fillRect(Math.round(ex) - 1, ey, 3, 1);
        }
      });
      // 高台邊緣一條亮線
      mapG.fillStyle = 'rgba(255,255,255,0.35)';
      mapG.fillRect(Math.round(T.plat.x0), CLIFF_Y - 1, Math.round(T.plat.x1 - T.plat.x0), 1);
      // 石階
      var stepA = T.vk === 'thinking' ? '#f9a8d4' : (T.vk === 'arduino' ? '#e0f2fe' : '#e7d7c1');
      var stepB = T.vk === 'thinking' ? '#7dd3fc' : (T.vk === 'arduino' ? '#7dd3fc' : '#bfae94');
      for (var sy2 = CLIFF_Y - 6, si = 0; sy2 < CLIFF_Y + CLIFF_H + 4; sy2 += 4, si++) {
        mapG.fillStyle = si % 2 ? stepB : stepA;
        mapG.fillRect(Math.round(T.ramp.x0), sy2, Math.round(T.ramp.x1 - T.ramp.x0), 4);
        mapG.fillStyle = 'rgba(0,0,0,0.18)';
        mapG.fillRect(Math.round(T.ramp.x0), sy2 + 3, Math.round(T.ramp.x1 - T.ramp.x0), 1);
      }
      mapG.fillStyle = '#6b4f3a';
      mapG.fillRect(Math.round(T.ramp.x0) - 3, CLIFF_Y - 6, 3, CLIFF_H + 10);
      mapG.fillRect(Math.round(T.ramp.x1), CLIFF_Y - 6, 3, CLIFF_H + 10);
      // 拱橋（木板）
      (function () {
        var b = T.bridge, x0 = Math.round(b.x - b.hw), w = Math.round(b.hw * 2), y0 = Math.round(b.y0), h = Math.round(b.y1 - b.y0);
        mapG.fillStyle = T.vk === 'code' || T.vk === 'flowchart' ? '#64748b' : '#b46a3c';
        mapG.fillRect(x0, y0, w, h);
        mapG.fillStyle = 'rgba(60,30,15,0.45)';
        for (var bx = x0; bx < x0 + w; bx += 6) mapG.fillRect(bx, y0, 1, h);
        mapG.fillStyle = T.vk === 'thinking' ? '#facc15' : '#7d3e24';
        mapG.fillRect(x0, y0 - 2, w, 3); mapG.fillRect(x0, y0 + h - 1, w, 3);
      })();
      // 碼頭（TilesetWater 的木板）＋木樁
      (function () {
        var p = T.pier;
        for (var py = Math.floor(p.y0 / 16) * 16; py < p.y1; py += 16) {
          for (var px = Math.round(p.x0); px < p.x1 - 2; px += 16) {
            mapG.drawImage(A.water, 1 * 16, 13 * 16, 16, 16, px, py, Math.min(16, Math.round(p.x1 - px)), 16);
          }
        }
        mapG.fillStyle = '#7d3e24';
        for (var py2 = p.y0 + 20; py2 < p.y1; py2 += 32) {
          mapG.fillRect(Math.round(p.x0) - 2, py2, 3, 6); mapG.fillRect(Math.round(p.x1) - 1, py2, 3, 6);
        }
      })();
      // 蒸氣木工島：地上的鐵軌
      if (T.vk === 'code' || T.vk === 'flowchart') {
        var rx0 = Math.round(wxToMx(-16.2)), rx1 = Math.round(wxToMx(14.6)), ryc = Math.round(wzToMy(0.5));
        for (var tx2 = rx0; tx2 < rx1; tx2 += 6) {
          if (cls[ryc * MAP_W + tx2] === CL.RIVER) continue;
          mapG.fillStyle = '#6b4f3a'; mapG.fillRect(tx2, ryc - 6, 3, 12);
        }
        mapG.fillStyle = '#9ca3af';
        for (var tx3 = rx0; tx3 < rx1; tx3++) {
          if (cls[ryc * MAP_W + tx3] === CL.RIVER) continue;
          mapG.fillRect(tx3, ryc - 4, 1, 1); mapG.fillRect(tx3, ryc + 3, 1, 1);
        }
      }

      /* ── 7. 樹、花、石頭（會擋路、要排前後） ── */
      var decor = [];
      function farFrom(x, y, list, dist) {
        for (var q = 0; q < list.length; q++) {
          var dx = list[q].x - x, dy = list[q].y - y;
          if (dx * dx + dy * dy < dist * dist) return false;
        }
        return true;
      }
      var keepClear = entries.concat(propEntries).concat([{ x: npcPos.x, y: npcPos.y }, { x: plaza.x, y: plaza.y }]).concat(lamps);
      var tries = 0;
      while (decor.length < 46 && tries++ < 2500) {
        var tx = 20 + R() * (MAP_W - 40), ty = 20 + R() * (MAP_H - 40);
        var ci = (ty | 0) * MAP_W + (tx | 0);
        if (!isGrassy(cls[ci])) continue;
        var sdv = sdf[ci];
        var nearCoast = sdv > -110;
        var onTop = T.onPlateau(tx, ty) && ty < T.plat.y0 + 70;
        if (!nearCoast && !onTop && R() > 0.25) continue;
        if (T.inCliffBand(tx, ty + 6) || T.inCliffBand(tx, ty - 24)) continue;
        if (!farFrom(tx, ty, keepClear, 58) || !farFrom(tx, ty, decor, 26)) continue;
        // 不要壓在步道上
        var onPath = false;
        for (var oy = -6; oy <= 6 && !onPath; oy += 3) for (var ox = -10; ox <= 10; ox += 5) {
          var cc2 = cls[clamp((ty + oy) | 0, 0, MAP_H - 1) * MAP_W + clamp((tx + ox) | 0, 0, MAP_W - 1)];
          if (cc2 === CL.PATH || cc2 === CL.PLAZA || cc2 === CL.RIVER) { onPath = true; break; }
        }
        if (onPath) continue;
        var nm = theme.trees[Math.floor(R() * theme.trees.length)];
        var sz2 = sprSize(nm);
        decor.push({ x: tx, y: ty, spr: nm, w: sz2[0], h: sz2[1], base: ty + 4, foot: [tx - 6, ty - 3, tx + 6, ty + 3], tree: true });
      }
      for (var fcount = 0; fcount < 70; fcount++) {
        var fx = 20 + R() * (MAP_W - 40), fy = 20 + R() * (MAP_H - 40);
        var fc = cls[(fy | 0) * MAP_W + (fx | 0)];
        if (!isGrassy(fc) || T.inCliffBand(fx, fy) || !farFrom(fx, fy, keepClear, 40)) continue;
        var fn2 = theme.flowers[Math.floor(R() * theme.flowers.length)];
        var fs = sprSize(fn2);
        if (fs[0] > 16) {
          if (!farFrom(fx, fy, decor, 24)) continue;
          decor.push({ x: fx, y: fy, spr: fn2, w: fs[0], h: fs[1], base: fy + 4, foot: [fx - 10, fy - 4, fx + 10, fy + 3] });
        } else {
          drawSpr(mapG, A, fn2, fx - 8, fy - 12);   // 小花直接畫在地上，不擋路
        }
      }
      decor.forEach(function (dd) { blockRect(dd.foot); });

      /* ── 8. 小動物 ── */
      var animals = theme.animals.map(function (nm, ai) {
        var home = nearestPass(plaza.x + (ai ? 150 : -170), plaza.y + (ai ? 90 : 70), pathPassable);
        var hx = home[0] * PG + 4, hy = home[1] * PG + 4;
        return { im: A.animals[nm], x: hx, y: hy, hx: hx, hy: hy, tx: hx, ty: hy, wait: 1 + ai, flip: false };
      });

      /* ── 9. 走路判定 ── */
      function walkable(px, py) {
        if (!terrainOK(px, py)) return false;
        return !footBlock[((py / WG) | 0) * WGW + ((px / WG) | 0)];
      }
      function canStand(px, py) {
        return walkable(px - 4, py) && walkable(px + 4, py) && walkable(px, py - 3) && walkable(px, py + 1);
      }
      function passCell(cx8, cy8) {
        var px = cx8 * PG + PG / 2, py = cy8 * PG + PG / 2;
        return canStand(px, py);
      }

      // 起點：存檔／設定的位置，站不住就找最近能站的地方
      var player = { x: pctToMx(state.px), y: pctToMy(state.py), dir: 0, frame: 0, walking: false, animT: 0 };
      if (!canStand(player.x, player.y)) {
        var st = nearestPass(player.x, player.y, passCell);
        player.x = st[0] * PG + PG / 2; player.y = st[1] * PG + PG / 2;
      }
      state.px = mxToPct(player.x); state.py = myToPct(player.y);

      var look = ctx.getLook();
      var playerIm = A.chars[CHAR_BY_SHIRT[String(look.shirt || '').toLowerCase()] || 'NinjaBlue'];
      ctx.setRebuildPlayer(function () {
        var lk = ctx.getLook();
        playerIm = A.chars[CHAR_BY_SHIRT[String(lk.shirt || '').toLowerCase()] || 'NinjaBlue'] || playerIm;
      });
      var isScratch = String(cfg.pageId || '').indexOf('scratch') === 0;
      var npcIm = A.chars[isScratch ? 'Samurai' : theme.npc];
      var npcJump = 0;
      ctx.setMascotJump(function () { npcJump = performance.now(); });
      if (ctx.npcTag) ctx.npcTag.textContent = (ctx.npcInfo && ctx.npcInfo.name ? ctx.npcInfo.name : '島長') + ' 💬';

      var timeMode = state.timeMode || 'day';
      ctx.setApplyTimeMode(function (m) { timeMode = m; });

      /* ── 10. 鏡頭 ── */
      var cam = { x: player.x, y: player.y, s: 2, zoomStep: 0 };
      function targetScale() {
        if (state.camMode === 'overview') return Math.min(view.w / MAP_W, view.h / MAP_H);
        var base = clamp(Math.round(view.w / 640), 2, 4);
        return clamp(base + cam.zoomStep, 1.5, 5);
      }
      cam.s = targetScale();
      function clampCam() {
        var vw = view.w / cam.s, vh = view.h / cam.s;
        cam.x = vw >= MAP_W ? MAP_W / 2 : clamp(cam.x, vw / 2, MAP_W - vw / 2);
        cam.y = vh >= MAP_H ? MAP_H / 2 : clamp(cam.y, vh / 2, MAP_H - vh / 2);
      }
      clampCam();
      function toScreen(mx, my) {
        return { x: (mx - cam.x) * cam.s + view.w / 2, y: (my - cam.y) * cam.s + view.h / 2 };
      }
      function toMap(sx, sy) {
        return { x: (sx - view.w / 2) / cam.s + cam.x, y: (sy - view.h / 2) / cam.s + cam.y };
      }

      /* ── 11. 自動帶路（state.tx / state.ty 由 island.js 設定）→ A* 找路 ── */
      var route = null, routeFor = '';
      function planRoute() {
        var key = state.tx + ',' + state.ty;
        if (key === routeFor) return;
        routeFor = key;
        var goal = nearestPass(pctToMx(state.tx), pctToMy(state.ty), passCell);
        var startC = nearestPass(player.x, player.y, passCell);
        var p = smooth(astar(passCell, startC[0], startC[1], goal[0], goal[1], PGW, PGH), passCell);
        route = p ? p.slice(1).map(function (c) { return { x: c[0] * PG + PG / 2, y: c[1] * PG + PG / 2 }; }) : null;
        if (!route || !route.length) { route = null; state.tx = null; state.ty = null; routeFor = ''; }
      }

      /* ── 12. 滑鼠：點建築、果樹、島長 ── */
      function hitAt(clientX, clientY) {
        var rect = canvasEl.getBoundingClientRect();
        var m = toMap(clientX - rect.left, clientY - rect.top);
        if (Math.abs(m.x - npcPos.x) < 10 && m.y > npcPos.y - 20 && m.y < npcPos.y + 3) return { npc: true };
        for (var q = 0; q < propEntries.length; q++) {
          var p = propEntries[q];
          if (m.x > p.x - p.w / 2 && m.x < p.x + p.w / 2 && m.y > p.base - p.h && m.y < p.base) return { prop: p };
        }
        for (var q2 = entries.length - 1; q2 >= 0; q2--) {
          var e = entries[q2];
          if (m.x > e.x - e.w / 2 && m.x < e.x + e.w / 2 && m.y > e.top && m.y < e.base) return { entry: e };
        }
        return null;
      }
      function previewNode(e) {
        e.shake = performance.now();
        var sp = toScreen(e.x, e.top);
        if (e.node.locked) ctx.spawnFloatScreen(sp.x, sp.y, '🔒 ' + (e.node.lockReason || '尚未開放'));
        else ctx.spawnFloatScreen(sp.x, sp.y, '🚶 請走近「' + e.node.shortTitle + '」並按空白鍵 (Space) 進入');
      }
      function onCanvasClick(ev) {
        var h = hitAt(ev.clientX, ev.clientY);
        if (!h) return;
        if (h.npc) {
          var sp = toScreen(npcPos.x, npcPos.y - 22);
          ctx.spawnFloatScreen(sp.x, sp.y, '🚶 請用方向鍵 / WASD 走近「' + (ctx.npcInfo ? ctx.npcInfo.name : '島長') + '」對話');
        } else if (h.prop) {
          h.prop.shake = performance.now();
          var list = h.prop.data.drops || ['🍎 果實 +1'];
          var sp2 = toScreen(h.prop.x, h.prop.base - h.prop.h);
          ctx.spawnFloatScreen(sp2.x, sp2.y, list[Math.floor(Math.random() * list.length)]);
        } else if (h.entry) previewNode(h.entry);
      }
      function onStageClick(ev) {
        if (ev.target.closest('#ac-dialog')) {
          ev.stopPropagation(); ev.preventDefault();
          ctx.spawnFloatScreen(view.w * 0.5, view.h - 95, '⌨️ 走近建築後請按空白鍵 (Space) 直接進入');
          return;
        }
        var pin = ev.target.closest('.ac-node');
        if (pin) {
          ev.stopPropagation();
          var id = pin.getAttribute('data-node');
          for (var q = 0; q < entries.length; q++) if (String(entries[q].node.id) === String(id)) { previewNode(entries[q]); break; }
        }
      }
      function onNpcTagClick(ev) {
        ev.stopPropagation();
        var sp = toScreen(npcPos.x, npcPos.y - 22);
        ctx.spawnFloatScreen(sp.x, sp.y, '🚶 請用方向鍵 / WASD 走近「' + (ctx.npcInfo ? ctx.npcInfo.name : '島長') + '」對話');
      }
      function onWheel(ev) {
        if (state.camMode === 'overview') return;
        ev.preventDefault();
        cam.zoomStep = clamp(cam.zoomStep + (ev.deltaY > 0 ? -1 : 1), -1, 2);
      }
      function onResize() { view = sizeCanvas(); }

      canvasEl.addEventListener('click', onCanvasClick);
      canvasEl.addEventListener('wheel', onWheel, { passive: false });
      stageEl.addEventListener('click', onStageClick);
      if (ctx.npcTag) ctx.npcTag.addEventListener('click', onNpcTagClick);
      global.addEventListener('resize', onResize);
      global.addEventListener('keydown', ctx.onKeyDown);
      global.addEventListener('keyup', ctx.onKeyUp);
      global.addEventListener('blur', ctx.onBlur);
      cleanupFns.push(function () {
        canvasEl.removeEventListener('click', onCanvasClick);
        canvasEl.removeEventListener('wheel', onWheel);
        stageEl.removeEventListener('click', onStageClick);
        if (ctx.npcTag) ctx.npcTag.removeEventListener('click', onNpcTagClick);
        global.removeEventListener('resize', onResize);
        global.removeEventListener('keydown', ctx.onKeyDown);
        global.removeEventListener('keyup', ctx.onKeyUp);
        global.removeEventListener('blur', ctx.onBlur);
      });

      /* ── 13. 每一格 ── */
      var WALK_SPEED = 120;   // 像素／秒（3D 是 12.6 單位／秒 ≈ 130 像素）
      var lastNow = performance.now(), coveredSince = 0;
      var ripples = [];
      for (var rpi = 0; rpi < 400 && ripples.length < 24; rpi++) {
        // 水波圖的底色就是淺水色，只放在整格都是淺水／河水的地方才看不出接縫
        var rpx = Math.round(R() * (MAP_W - 16)), rpy = Math.round(R() * (MAP_H - 16)), okR = true;
        for (var ry2 = 0; ry2 <= 16 && okR; ry2 += 4) for (var rx2 = 0; rx2 <= 16; rx2 += 4) {
          var rc = cls[clamp(rpy + ry2, 0, MAP_H - 1) * MAP_W + clamp(rpx + rx2, 0, MAP_W - 1)];
          if (rc !== CL.SHALLOW && rc !== CL.RIVER) { okR = false; break; }
        }
        if (okR && (rpx + 16 > T.pier.x0 - 4 && rpx < T.pier.x1 + 4 && rpy + 16 > T.pier.y0)) okR = false;
        if (okR && (rpy + 16 > T.bridge.y0 - 4 && rpy < T.bridge.y1 + 4 && Math.abs(rpx + 8 - T.bridge.x) < T.bridge.hw + 12)) okR = false;
        if (okR) ripples.push({ x: rpx, y: rpy, ph: R() * 4 });
      }
      var flagSpots = [{ x: T.pier.x1 + 2, y: T.pier.y0 + 16 }, { x: plaza.x - 70, y: plaza.y - 44 }, { x: plaza.x + 70, y: plaza.y - 44 }];

      var api = global.AC_ISLAND2D;
      api._last = {
        state: state, cam: cam, player: player, entries: entries, terrain: T, canStand: canStand,
        toScreen: toScreen, npcPos: npcPos, view: function () { return view; }, route: function () { return route; },
        // 測試用：從玩家現在的位置走得到 (x%, y%) 嗎？回傳步數或 -1
        reach: function (xp, yp) {
          var s0 = nearestPass(player.x, player.y, passCell), g0 = nearestPass(pctToMx(xp), pctToMy(yp), passCell);
          var gd = Math.hypot(g0[0] * PG + 4 - pctToMx(xp), g0[1] * PG + 4 - pctToMy(yp));
          var pth = astar(passCell, s0[0], s0[1], g0[0], g0[1], PGW, PGH);
          return pth ? { steps: pth.length, snap: Math.round(gd) } : -1;
        }
      };

      function frame(now) {
        if (dead || state.destroyed) return;
        state.rafId = requestAnimationFrame(frame);
        var dt = Math.min(0.25, Math.max(0.001, (now - lastNow) / 1000));
        lastNow = now;

        var isModalOpen = !!document.querySelector('.ac-float-backdrop:not(.hidden)');
        var covered = isModalOpen || canvasEl.getClientRects().length === 0 ||
          !!document.querySelector('#week-mask:not(.hidden), #modal.flex, #action-modal.flex');
        if (!covered) coveredSince = 0;
        else if (!coveredSince) coveredSince = now;
        else if (now - coveredSince > 700) { state.keys = {}; return; }

        if (view.w !== stageEl.clientWidth || view.h !== stageEl.clientHeight) view = sizeCanvas();

        /* 走路 */
        var vx = 0, vy = 0, k = state.keys;
        if (!isModalOpen) {
          if (k.ArrowLeft || k.KeyA) vx -= 1;
          if (k.ArrowRight || k.KeyD) vx += 1;
          if (k.ArrowUp || k.KeyW) vy -= 1;
          if (k.ArrowDown || k.KeyS) vy += 1;
        }
        var moveDist = WALK_SPEED * dt, moved = false;
        if (vx || vy) {
          state.tx = null; state.ty = null; route = null; routeFor = '';
          var len = Math.sqrt(vx * vx + vy * vy);
          moved = tryMove(vx / len * moveDist, vy / len * moveDist);
          player.dir = headingToDir(vx, vy, player.dir);
        } else if (state.tx !== null && state.tx !== undefined && state.ty !== null) {
          planRoute();
          if (route && route.length) {
            var wp = route[0];
            var ddx = wp.x - player.x, ddy = wp.y - player.y, dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist <= moveDist) {
              player.x = wp.x; player.y = wp.y; route.shift(); moved = true;
              if (!route.length) { state.tx = null; state.ty = null; routeFor = ''; route = null; ctx.savePos(); }
            } else {
              moved = tryMove(ddx / dist * moveDist, ddy / dist * moveDist, true);
              if (!moved) { player.x += ddx / dist * moveDist; player.y += ddy / dist * moveDist; moved = true; }
            }
            player.dir = headingToDir(ddx, ddy, player.dir);
          }
        }
        player.walking = moved;
        if (moved) {
          state.hasMoved = true;
          player.animT += dt;
          state.px = mxToPct(player.x); state.py = myToPct(player.y);
        } else player.animT = 0;
        player.frame = moved ? Math.floor(player.animT * 8) % 4 : 0;

        /* 小動物閒晃 */
        animals.forEach(function (an) {
          if (an.wait > 0) { an.wait -= dt; return; }
          var adx = an.tx - an.x, ady = an.ty - an.y, ad = Math.sqrt(adx * adx + ady * ady);
          if (ad < 1) {
            an.wait = 1.5 + Math.random() * 3;
            for (var tt = 0; tt < 6; tt++) {
              var nx = an.hx + (Math.random() - 0.5) * 90, ny = an.hy + (Math.random() - 0.5) * 60;
              if (canStand(nx, ny)) { an.tx = nx; an.ty = ny; break; }
            }
            return;
          }
          var st = Math.min(ad, 28 * dt);
          var nx2 = an.x + adx / ad * st, ny2 = an.y + ady / ad * st;
          if (canStand(nx2, ny2)) { an.x = nx2; an.y = ny2; an.flip = adx > 0; } else { an.tx = an.x; an.ty = an.y; }
        });

        /* 鏡頭 */
        var ts = targetScale();
        cam.s += (ts - cam.s) * (1 - Math.pow(0.0001, dt));
        if (Math.abs(ts - cam.s) < 0.01) cam.s = ts;
        var fx2 = state.camMode === 'overview' ? MAP_W / 2 : player.x, fy2 = state.camMode === 'overview' ? MAP_H / 2 : player.y - 10;
        var ease = 1 - Math.pow(0.002, dt);
        cam.x += (fx2 - cam.x) * ease; cam.y += (fy2 - cam.y) * ease;
        clampCam();

        /* 誰最近（規則和 3D 一樣：百分比距離，島長 < 8、建築 < 9） */
        var bestId = null, bestDist = 9.0;
        var ndx = npcPct.x - state.px, ndy = (npcPct.y + 2.5) - state.py, nd = Math.sqrt(ndx * ndx + ndy * ndy);
        if (nd < 8.0) { bestDist = nd; bestId = '__npc__'; }
        for (var ei = 0; ei < entries.length; ei++) {
          var n = entries[ei].node;
          var ex = n.x - state.px, ey = (n.y + 2.5) - state.py, ed = Math.sqrt(ex * ex + ey * ey);
          if (ed < bestDist) { bestDist = ed; bestId = n.id; }
        }

        draw(now);

        // 木牌、名牌
        for (var li = 0; li < entries.length; li++) {
          var en = entries[li];
          if (!en.dom) continue;
          var sp = toScreen(en.x, en.top - 2);
          en.dom.style.left = Math.round(sp.x) + 'px';
          en.dom.style.top = Math.round(sp.y) + 'px';
          en.dom.style.zIndex = String(clamp(Math.round(10 + en.base / MAP_H * 25), 10, 35));
          en.dom.classList.toggle('is-near', String(en.node.id) === String(bestId));
        }
        if (ctx.npcTag) {
          var ns = toScreen(npcPos.x, npcPos.y - 20);
          ctx.npcTag.style.left = Math.round(ns.x) + 'px';
          ctx.npcTag.style.top = Math.round(ns.y) + 'px';
        }
        if (ctx.playerTag) {
          var ps = toScreen(player.x, player.y - 20);
          ctx.playerTag.style.left = Math.round(ps.x) + 'px';
          ctx.playerTag.style.top = Math.round(ps.y) + 'px';
          ctx.playerTag.classList.toggle('is-hidden', !!state.hasMoved);
        }
        ctx.applyNearCandidate(bestId);
      }

      function tryMove(dx, dy, strict) {
        var nx = player.x + dx, ny = player.y + dy;
        if (canStand(nx, ny)) { player.x = nx; player.y = ny; return true; }
        if (strict) return false;
        if (dx && canStand(player.x + dx, player.y)) { player.x += dx; return true; }
        if (dy && canStand(player.x, player.y + dy)) { player.y += dy; return true; }
        return false;
      }

      function draw(now) {
        var dpr = view.dpr, s = cam.s * dpr;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#4c93b5';
        g.fillRect(0, 0, canvasEl.width, canvasEl.height);
        var ox = Math.round((view.w / 2 - cam.x * cam.s) * dpr), oy = Math.round((view.h / 2 - cam.y * cam.s) * dpr);
        g.setTransform(s, 0, 0, s, ox, oy);
        g.drawImage(mapCanvas, 0, 0);
        var tf = Math.floor(now / 160);

        // 水波
        for (var q = 0; q < ripples.length; q++) {
          var rp = ripples[q];
          g.drawImage(A.ripple, ((tf + Math.floor(rp.ph)) % 4) * 16, 0, 16, 16, Math.round(rp.x), Math.round(rp.y), 16, 16);
        }
        // 瀑布（從高台池塘沿崖壁流下）
        var wfx = Math.round(T.pond.x - 8);
        g.drawImage(A.wfTop, (tf % 5) * 16, 0, 16, 16, wfx, CLIFF_Y - 4, 16, 16);
        g.drawImage(A.wfMid, (tf % 5) * 16, 0, 16, 16, wfx, CLIFF_Y + 12, 16, 16);
        g.drawImage(A.wfBot, (tf % 3) * 16, 0, 16, 16, wfx, CLIFF_Y + CLIFF_H - 4, 16, 16);

        // 要排前後的東西
        var list = [];
        entries.forEach(function (e) { list.push({ y: e.base, f: function () { drawEntry(e, now, tf); } }); });
        propEntries.forEach(function (p) { list.push({ y: p.base, f: function () { drawShaky(p, now); } }); });
        decor.forEach(function (d) { list.push({ y: d.base, f: function () { drawSpr(g, A, d.spr, d.x - d.w / 2, d.base - d.h); } }); });
        lamps.forEach(function (l) { list.push({ y: l.y + 1, f: function () { drawSpr(g, A, 'lamp', l.x - 8, l.y - 30); } }); });
        flagSpots.forEach(function (fl) {
          list.push({ y: fl.y, f: function () {
            g.fillStyle = '#6b4f3a'; g.fillRect(Math.round(fl.x), Math.round(fl.y - 24), 2, 24);
            g.drawImage(A[theme.flag], (tf % 4) * 16, 0, 16, 16, Math.round(fl.x + 1), Math.round(fl.y - 26), 16, 16);
          } });
        });
        animals.forEach(function (an) {
          list.push({ y: an.y, f: function () {
            if (!an.im) return;
            var fw = Math.floor(an.im.width / 2), fh = an.im.height;
            var fi = an.wait > 0 ? 0 : (tf % 2);
            g.drawImage(A.shadow, Math.round(an.x - 6), Math.round(an.y - 4));
            if (an.flip) {
              g.save(); g.translate(Math.round(an.x + fw / 2), Math.round(an.y - fh)); g.scale(-1, 1);
              g.drawImage(an.im, fi * fw, 0, fw, fh, 0, 0, fw, fh); g.restore();
            } else g.drawImage(an.im, fi * fw, 0, fw, fh, Math.round(an.x - fw / 2), Math.round(an.y - fh), fw, fh);
          } });
        });
        var hopN = 0;
        if (npcJump) {
          var ja = (now - npcJump) / 520;
          if (ja < 1) hopN = Math.sin(ja * Math.PI) * 7; else npcJump = 0;
        }
        list.push({ y: npcPos.y, f: function () {
          var face = headingToDir(player.x - npcPos.x, player.y - npcPos.y, 0);
          drawChar(g, npcIm, npcPos.x, npcPos.y, face, 0, A.shadow, hopN + (Math.sin(now / 400) > 0.6 ? 1 : 0));
        } });
        list.push({ y: player.y + 0.5, f: function () {
          drawChar(g, playerIm, player.x, player.y, player.dir, player.frame, A.shadow, player.walking && player.frame % 2 ? 1 : 0);
        } });
        list.sort(function (a, b) { return a.y - b.y; });
        for (var li = 0; li < list.length; li++) list[li].f();

        // 時段
        if (timeMode !== 'day') {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalCompositeOperation = 'multiply';
          g.fillStyle = timeMode === 'night' ? 'rgb(78,88,160)' : 'rgb(255,196,150)';
          g.fillRect(0, 0, canvasEl.width, canvasEl.height);
          g.globalCompositeOperation = 'lighter';
          g.setTransform(s, 0, 0, s, ox, oy);
          var lights = lamps.map(function (l) { return [l.x, l.y - 26, 34]; });
          entries.forEach(function (e) { if (e.type === 'building') lights.push([e.x, e.base - 8, 26]); });
          if (timeMode === 'night') lights.push([player.x, player.y - 8, 30]);
          lights.forEach(function (L) {
            var gr = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
            gr.addColorStop(0, timeMode === 'night' ? 'rgba(255,190,110,0.45)' : 'rgba(255,170,90,0.18)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(L[0] - L[2], L[1] - L[2], L[2] * 2, L[2] * 2);
          });
          g.globalCompositeOperation = 'source-over';
        }
      }

      function drawShaky(p, now) {
        var off = 0;
        if (p.shake) {
          var a = (now - p.shake) / 480;
          if (a < 1) off = Math.round(Math.sin(a * Math.PI * 5) * 2 * (1 - a)); else p.shake = 0;
        }
        drawSpr(g, A, p.spr, p.x - p.w / 2 + off, p.base - p.h);
      }
      function drawEntry(e, now, tf) {
        var off = 0, lift = 0;
        if (e.shake) {
          var a = (now - e.shake) / 460;
          if (a < 1) { off = Math.round(Math.sin(a * Math.PI * 4) * 2 * (1 - a)); lift = Math.round(Math.sin(a * Math.PI) * 3); }
          else e.shake = 0;
        }
        var x0 = e.x - e.w / 2 + off, y0 = e.base - e.h - lift;
        if (e.node.locked) g.globalAlpha = 0.75;
        if (e.type === 'airport') {
          drawSpr(g, A, 'boat', e.x - 24, T.pier.y1 - 22 + Math.round(Math.sin(now / 500)));
          drawSpr(g, A, 'counter', e.x - 24, e.base - 16);
          drawSpr(g, A, 'sign', e.x + 14, e.base - 30);
        } else if (e.type === 'board') {
          drawSpr(g, A, 'boardFrame', x0, e.base - 32);
          drawSpr(g, A, 'boardPanel', x0, e.base - 38);
        } else if (e.type === 'orchard') {
          drawSpr(g, A, e.spr, x0, y0);
          for (var fi = 0; fi < 9; fi++) {
            var fx = x0 + 10 + Math.floor(hash2(fi, 1, e.x | 0) * 28), fy = y0 + 6 + Math.floor(hash2(fi, 2, e.y | 0) * 22);
            g.fillStyle = e.fruit[fi % 2]; g.fillRect(fx, fy, 3, 3);
            g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(fx, fy, 1, 1);
          }
          if (e.kind === 'orchard-golden-tree' && tf % 6 < 3) {
            g.fillStyle = '#fff7c2'; g.fillRect(x0 + 8 + (tf % 5) * 6, y0 + 4 + (tf % 3) * 8, 2, 2);
          }
        } else {
          drawSpr(g, A, e.spr, x0, y0);
          if (e.kind === 'craft-watermill') {
            g.drawImage(A.watermill, (tf % 3) * 34, 0, 34, 36, Math.round(x0 + e.w - 10), Math.round(e.base - 36), 34, 36);
          }
          if (e.kind === 'orchard-mill' || e.kind === 'tech-windtower' || e.kind === 'carnival-wheel') {
            g.drawImage(A.propeller, (Math.floor(now / 120) % 4) * 64, 0, 64, 64, Math.round(e.x - 32), Math.round(y0 - 30), 64, 64);
          }
        }
        g.globalAlpha = 1;
      }

      state.rafId = requestAnimationFrame(frame);
    }

    return function cleanup() {
      dead = true;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      cleanupFns.forEach(function (fn) { try { fn(); } catch (e) {} });
      stageEl.classList.remove('ac-engine-2d');
    };
  }

  function cssEsc(s) {
    return (global.CSS && global.CSS.escape) ? global.CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
  }

  /* =====================================================================
     AC_ISLAND2D.lounge(ctx)：入口與碼頭的 Dodo 航空登機大廳
     座標和 3D 一樣用 state.px（−11.8～11.8）、state.pz（0.25～8.4）。
     ===================================================================== */
  function lounge(ctx) {
    var state = ctx.state, stageEl = ctx.stageEl, canvasEl = ctx.canvasEl, routes = ctx.routes;
    var g = canvasEl.getContext('2d');
    var dead = false, A = null, rafId = 0;
    var U = 24;                         // 1 單位 = 24 像素
    var RW = 26 * U, RH = 14 * U;       // 房間 624×336
    function lx(wx) { return (wx + 13) * U; }
    function ly(wz) { return (wz + 4.6) * U; }
    canvasEl.setAttribute('data-engine', '2d');
    stageEl.style.background = '#1e293b';
    var board = ctx.hostEl.querySelector('.dal-flap-cell');
    if (board) board.textContent = 'DODO AIRLINES · PIXEL TERMINAL';
    var boardTitle = board && board.nextElementSibling;
    if (boardTitle) boardTitle.textContent = boardTitle.textContent.replace('3D 入境登機室大廳', '像素版登機大廳');

    var view = { w: 800, h: 500, dpr: 1 };
    function sizeCanvas() {
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      var w = stageEl.clientWidth || 900, h = stageEl.clientHeight || 560;
      canvasEl.width = Math.round(w * dpr); canvasEl.height = Math.round(h * dpr);
      view = { w: w, h: h, dpr: dpr };
    }
    sizeCanvas();

    var listeners = [];
    function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); }

    loadAssets(ctx.base).then(function (assets) {
      if (dead || state.destroyed) return;
      A = assets;
      begin();
    }).catch(function (err) { console.error('[AC_ISLAND2D] 登機室素材載入失敗', err); });

    function begin() {
      // 房間底圖
      var room = makeCanvas(RW, RH), rg = room.getContext('2d');
      rg.imageSmoothingEnabled = false;
      var ifl = A.ifloor;
      for (var y = 0; y < RH; y += 16) for (var x = 0; x < RW; x += 16) {
        var chk = ((x >> 4) + (y >> 4)) % 2;
        rg.drawImage(ifl, (chk ? 16 : 17) * 16, 2 * 16, 16, 16, x, y, 16, 16);
      }
      // 北牆＋大窗（看得到海與水上飛機）
      var wallH = ly(-1.6);
      rg.fillStyle = '#7c5a3a'; rg.fillRect(0, 0, RW, wallH);
      rg.fillStyle = '#5a3f28'; rg.fillRect(0, wallH - 6, RW, 6);
      var winY = 8, winH = wallH - 30;
      rg.fillStyle = '#7dd3fc'; rg.fillRect(24, winY, RW - 48, winH * 0.55);
      rg.fillStyle = '#38bdf8'; rg.fillRect(24, winY + winH * 0.55, RW - 48, winH * 0.45);
      rg.fillStyle = 'rgba(255,255,255,0.8)';
      for (var cl = 0; cl < 6; cl++) rg.fillRect(40 + cl * 98, winY + 8 + (cl % 2) * 6, 26, 4);
      rg.fillStyle = '#5a3f28';
      for (var mx = 24; mx <= RW - 24; mx += 72) rg.fillRect(mx - 2, winY, 4, winH);
      rg.fillRect(20, winY - 3, RW - 40, 4); rg.fillRect(20, winY + winH, RW - 40, 4);
      // 地毯走道
      rg.fillStyle = '#b91c1c'; rg.fillRect(lx(-1.6), ly(1.2), lx(1.6) - lx(-1.6), RH - ly(1.2));
      rg.fillStyle = '#facc15'; rg.fillRect(lx(-1.6), ly(1.2), 2, RH - ly(1.2)); rg.fillRect(lx(1.6) - 2, ly(1.2), 2, RH - ly(1.2));
      // 盆栽
      [[-11.6, 0.4], [11.6, 0.4], [-11.6, 8.6], [11.6, 8.6]].forEach(function (p) { drawSpr(rg, A, 'bush', lx(p[0]) - 8, ly(p[1]) - 12); });

      var player = { dir: 1, frame: 0, walking: false, animT: 0 };
      var look = {};
      try { look = JSON.parse(global.localStorage.getItem('ac_avatar_look_v1') || global.sessionStorage.getItem('ac_avatar_look_v1') || '{}'); } catch (e) {}
      var playerIm = A.chars[CHAR_BY_SHIRT[String(look.shirt || '').toLowerCase()] || 'NinjaBlue'];
      var staff = { '11501': A.animals.parrot, '11502': A.animals.parrot_red };
      var staffJump = {};

      var WALK_SPEED = 9.6, lastNow = performance.now(), boardT = 0;
      function frame(now) {
        if (dead || state.destroyed) return;
        rafId = requestAnimationFrame(frame);
        var dt = Math.min(0.25, Math.max(0.001, (now - lastNow) / 1000));
        lastNow = now;
        if (view.w !== stageEl.clientWidth || view.h !== stageEl.clientHeight) sizeCanvas();

        var vx = 0, vz = 0, k = state.keys;
        if (!state.boarding) {
          if (k.ArrowLeft || k.KeyA) vx -= 1;
          if (k.ArrowRight || k.KeyD) vx += 1;
          if (k.ArrowUp || k.KeyW) vz -= 1;
          if (k.ArrowDown || k.KeyS) vz += 1;
        }
        var speed = WALK_SPEED * dt;
        state.walking = false;
        if (vx || vz) {
          state.tx = null; state.tz = null;
          var len = Math.sqrt(vx * vx + vz * vz);
          state.px += vx / len * speed; state.pz += vz / len * speed;
          player.dir = headingToDir(vx, vz, player.dir); state.walking = true;
        } else if (state.tx !== null && state.tz !== null) {
          var dx = state.tx - state.px, dz = state.tz - state.pz, dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < Math.max(0.22, speed)) {
            state.px = state.tx; state.pz = state.tz; state.tx = null; state.tz = null; player.dir = 1;
          } else {
            state.px += dx / dist * speed; state.pz += dz / dist * speed;
            player.dir = headingToDir(dx, dz, player.dir); state.walking = true;
          }
        }
        state.px = clamp(state.px, -11.8, 11.8);
        state.pz = clamp(state.pz, 0.25, 8.4);
        if (state.walking) { player.animT += dt; state.hasMoved = true; } else player.animT = 0;
        player.frame = state.walking ? Math.floor(player.animT * 8) % 4 : 0;

        // 走近櫃台（和 3D 同一套規則）
        if (!state.boarding) {
          var d1 = Math.hypot(state.px - routes['11501'].standWx, state.pz - routes['11501'].standWz);
          var d2 = Math.hypot(state.px - routes['11502'].standWx, state.pz - routes['11502'].standWz);
          ctx.updateQuickBoard(d1 < 2.4 || d2 < 2.4);
          if (d1 < 2.4) {
            if (state.dismissedTerm !== '11501' && (!state.dialogOpen || state.selectedTerm !== '11501')) { ctx.selectCounter('11501', false, true); staffJump['11501'] = now; }
          } else if (d2 < 2.4) {
            if (state.dismissedTerm !== '11502' && (!state.dialogOpen || state.selectedTerm !== '11502')) { ctx.selectCounter('11502', false, true); staffJump['11502'] = now; }
          } else if (d1 > 2.8 && d2 > 2.8) {
            state.dismissedTerm = null;
            if (state.dialogOpen && state.tx === null) { state.dialogOpen = false; ctx.renderBottomDialog(); }
          }
        } else if (!boardT) boardT = now;

        draw(now);
      }

      function camera() {
        var s, cx, cy;
        if (state.camMode === 'counter') {
          s = Math.max(2, Math.floor(Math.min(view.w / RW, view.h / RH) * 1.6));
          cx = lx(state.px); cy = ly(state.pz) - 20;
          var vw = view.w / s, vh = view.h / s;
          cx = vw >= RW ? RW / 2 : clamp(cx, vw / 2, RW - vw / 2);
          cy = vh >= RH ? RH / 2 : clamp(cy, vh / 2, RH - vh / 2);
        } else {
          s = Math.min(view.w / RW, view.h / RH);
          if (s >= 1) s = Math.floor(s * 2) / 2;
          cx = RW / 2; cy = RH / 2;
        }
        return { s: s, cx: cx, cy: cy };
      }
      function toScreen(c, x, y) { return { x: (x - c.cx) * c.s + view.w / 2, y: (y - c.cy) * c.s + view.h / 2 }; }

      function draw(now) {
        var c = camera(), dpr = view.dpr, s = c.s * dpr;
        var ox = Math.round((view.w / 2 - c.cx * c.s) * dpr), oy = Math.round((view.h / 2 - c.cy * c.s) * dpr);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#1e293b'; g.fillRect(0, 0, canvasEl.width, canvasEl.height);
        g.setTransform(s, 0, 0, s, ox, oy);
        g.drawImage(room, 0, 0);
        var tf = Math.floor(now / 160);
        // 窗外的水上飛機（登機時起飛）
        var planeX = RW * 0.5 - 24, planeY = 40;
        if (boardT) { var ta = (now - boardT) / 900; planeX += ta * 260; planeY -= ta * 30; }
        drawSpr(g, A, 'boat', planeX, planeY + Math.round(Math.sin(now / 400)));

        var items = [];
        ['11501', '11502'].forEach(function (tid) {
          var r = routes[tid];
          var cxp = lx(r.wx), cyp = ly(r.wz);
          items.push({ y: cyp + 10, f: function () {
            // 地勤（鸚鵡）在櫃台後面
            var im = staff[tid], hop = 0;
            if (staffJump[tid]) { var ja = (now - staffJump[tid]) / 500; if (ja < 1) hop = Math.sin(ja * Math.PI) * 6; else staffJump[tid] = 0; }
            if (im) g.drawImage(im, (tf % 2) * 16, 0, 16, 16, Math.round(cxp - 8), Math.round(cyp - 22 - hop), 16, 16);
            drawSpr(g, A, 'counter', cxp - 24, cyp - 8);
            g.fillStyle = tid === '11501' ? '#0284c7' : '#059669';
            g.fillRect(Math.round(cxp - 24), Math.round(cyp + 8), 48, 3);
            drawSpr(g, A, 'sign', cxp + 22, cyp - 14);
          } });
        });
        items.push({ y: ly(state.pz), f: function () {
          drawChar(g, playerIm, lx(state.px), ly(state.pz), player.dir, player.frame, A.shadow, state.walking && player.frame % 2 ? 1 : 0);
        } });
        items.sort(function (a, b) { return a.y - b.y; });
        items.forEach(function (it) { it.f(); });

        if (boardT) {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.fillStyle = 'rgba(255,255,255,' + clamp((now - boardT) / 900, 0, 0.85) + ')';
          g.fillRect(0, 0, canvasEl.width, canvasEl.height);
        }

        // 木牌、名牌
        ['11501', '11502'].forEach(function (tid) {
          var pin = ctx.hostEl.querySelector('[data-counter-pin="' + tid + '"]');
          var r = routes[tid];
          if (!pin || !r) return;
          var sp = toScreen(c, lx(r.wx), ly(r.wz) - 26);
          pin.style.left = Math.round(sp.x) + 'px'; pin.style.top = Math.round(sp.y) + 'px';
        });
        if (ctx.playerTag) {
          var ps = toScreen(c, lx(state.px), ly(state.pz) - 20);
          ctx.playerTag.style.left = Math.round(ps.x) + 'px'; ctx.playerTag.style.top = Math.round(ps.y) + 'px';
          ctx.playerTag.classList.toggle('is-hidden', !!state.hasMoved);
        }
      }

      function onKeyDown(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.code === 'Escape' || e.key === 'Escape') {
          e.preventDefault();
          if (state.dialogOpen) ctx.closeLoungeDialog();
          else if (ctx.opts.isModal && typeof ctx.opts.onClose === 'function') {
            if (ctx.hostEl._dalCleanup) ctx.hostEl._dalCleanup();
            ctx.opts.onClose();
          }
          return;
        }
        if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat && ctx.camBtn && !state.boarding) {
          e.preventDefault(); ctx.camBtn.click(); return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(e.code) >= 0) {
          state.keys[e.code] = true;
          if (e.code.indexOf('Arrow') === 0) e.preventDefault();
        } else if ((e.code === 'Space' || e.key === ' ' || e.code === 'Enter') && !state.boarding && !e.repeat) {
          var nd1 = Math.hypot(state.px - routes['11501'].standWx, state.pz - routes['11501'].standWz);
          var nd2 = Math.hypot(state.px - routes['11502'].standWx, state.pz - routes['11502'].standWz);
          if (nd1 < 2.4 || nd2 < 2.4) {
            e.preventDefault(); state.keys = {};
            var nearTerm = nd1 <= nd2 ? '11501' : '11502';
            ctx.selectCounter(nearTerm, false, true);
            ctx.triggerBoarding(nearTerm);
          } else if (ctx.quickTermId && e.code === 'Enter') {
            e.preventDefault(); state.keys = {};
            ctx.updateQuickBoard(true);
            ctx.triggerBoarding(ctx.quickTermId);
          }
        }
      }
      function onKeyUp(e) { delete state.keys[e.code]; }
      function onCanvasClick() { ctx.flashLoungeHint('🚶 請用方向鍵 / WASD 走到櫃台前按空白鍵登機'); }
      on(global, 'keydown', onKeyDown);
      on(global, 'keyup', onKeyUp);
      on(global, 'resize', sizeCanvas);
      on(canvasEl, 'click', onCanvasClick);

      global.AC_ISLAND2D._lounge = { state: state, routes: routes };
      ctx.selectCounter(state.selectedTerm, false, false);
      rafId = requestAnimationFrame(frame);
    }

    return function stop() {
      dead = true;
      if (rafId) cancelAnimationFrame(rafId);
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      listeners = [];
    };
  }

  global.AC_ISLAND2D = { run: run, lounge: lounge, SPR: SPR, THEMES: THEMES };
})(window);
