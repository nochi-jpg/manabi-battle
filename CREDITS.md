# クレジット（使っている素材・ライブラリ）

## ライブラリ（`lib/` に同梱。ネットなしで動くように）
| 名前 | 用途 | ライセンス | 出典 |
|---|---|---|---|
| qrcode-generator 2.0.4（Kazuhiko Arase） | QRコードを作る | MIT（`lib/LICENSE-qrcode-generator.txt`） | https://github.com/kazuhikoarase/qrcode-generator |
| jsQR 1.4.0（Cosmo Wolfe） | QRコードを読みとる | Apache License 2.0（`lib/LICENSE-jsQR.txt`） | https://github.com/cozmo/jsQR |

## フォント
| 名前 | ライセンス | 出典 |
|---|---|---|
| DotGothic16 | SIL Open Font License 1.1 | google/fonts。`fonts/` に同梱（ゲームで使う字だけにしぼったWOFF。`fonts/OFL-DotGothic16.txt`） |
| M PLUS Rounded 1c | SIL Open Font License 1.1 | google/fonts。`fonts/` に同梱（同上。画像UIで使う丸ゴシック。`fonts/OFL-MPLUSRounded1c.txt`） |

- ゲームの中でも「せってい → 📜 クレジット」で見られる（フォント・ライブラリは `data.js` の CREDITS、画像は 素材リポジトリの `tools/make_assets.py` の credits。URLは出さない）
- フォントはネットから読みこまない（Teamsのオフラインでも同じ見た目）。作りなおしは `python3 tools/make_fonts.py`

## 画像
- 画像の素材は 非公開リポジトリ `manabi-battle-assets` に置いている（二次配布NGの素材があるため、公開リポジトリには入れない）
- 公開リポジトリ（GitHub Pages）だけで開くと、絵文字で動く。Teams用ZIP（`python3 tools/build_zip.py`）には画像が入る
- 素材ごとの出典・ライセンスは `manabi-battle-assets/CREDITS.md`

| 素材 | 作者 | 使っているところ |
|---|---|---|
| Monsters Pixel Pack vol.01〜10 | モケモ（mokemo-factory） | ボス・雑魚 |
| Witches & Wizards Backgrounds | Lornn（lornn.itch.io） | ホームの背景 |
| [Verboten Arcane Stash] Basic Skills and Buffs | Atelier Pixerelia | 状態異常・スキルのアイコン |
| Fantasy RPG UI Pack（DEMO） | dobo_ui | ボタン・パネル・カード・マス・リボン |
| Garden cozy kit | mandinhart | ハート・スタミナ・コイン・メニューのアイコン |
