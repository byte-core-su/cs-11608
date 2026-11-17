# 2D 像素版素材來源

這個資料夾的圖片全部來自 **Ninja Adventure Asset Pack**，
作者 [Pixel-boy](https://pixel-boy.itch.io/) 與 [AAA](https://www.instagram.com/challenger.aaa/)。

- 授權：**CC0 1.0（公眾領域）**，可自由使用、修改、再散布，商業用途也可以，不必標示出處。
  作者希望使用者能放上他們的連結，所以列在這裡：
  - 素材包頁面：<https://pixel-boy.itch.io/ninja-adventure-asset-pack>
  - Patreon：<https://www.patreon.com/pixelarchipel>
- 只挑了島嶼與機場用得到的圖（約 50 張、0.5 MB），檔名改成小寫英文方便程式讀取，圖片本身沒有修改。

| 資料夾 | 內容 | 原始位置 |
|---|---|---|
| `tiles/` | 地面、海水、樹木、房屋、塔、帳篷、雜物、懸崖、室內地板與牆 | `Backgrounds/Tilesets/` |
| `anim/` | 花、水波、瀑布、水車、風車葉片、旗子 | `Backgrounds/Animated/` |
| `chars/` | 玩家與島長（16×16，四個方向各四格走路動畫） | `Actor/Character/*/SpriteSheet.png` |
| `animals/` | 島上的小動物 | `Actor/Animal/` |
| `shadow.png` | 角色腳下的影子 | `Actor/Character/Shadow.png` |

使用這些圖的程式是 `shared/island2d.js`（2D 像素版島嶼與機場）。
