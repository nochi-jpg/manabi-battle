# ボス戦の ボーナスタイム（早く たおしたら のこりの問題）と 対戦ルーレットの はやさ のテスト
# 使い方: python3 tools/bonus_test.py
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools' / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(200)
    pg.evaluate("MB.S.stamina = 100"); pg.click('#dun'); W(50); pg.click('.ov .choices button'); W(200)
    # ボス戦まで すすめる
    for _ in range(8000):
        if pg.evaluate("!!(MB.BT && MB.BT.P && MB.BT.phase === 'turn')"): break
        pg.evaluate(BOT, 1.0); W(10)
    check(pg.evaluate("!!MB.BT"), 'ボス戦に 入った')
    pg.evaluate("MB.BT.B.hp = 1; MB.BT.P.power = 50")  # 1ターン目で たおす
    seen, heads = False, set()
    for _ in range(6000):
        if pg.evaluate("!!document.querySelector('.rres, #rstamp') || !MB.R"): break
        h = pg.evaluate("(document.querySelector('.qbox .qh')||{}).innerText||''")
        if 'ボーナスタイム' in h: seen = True; heads.add(h.split('（')[1].split('問目')[0] if '（' in h else h)
        if pg.evaluate("MB.BT && MB.BT.bonusN !== undefined && MB.BT.bonusAns === 3 && !window.__rl"):
            pg.evaluate("window.__rl = 1"); pg.reload(); W(300); pg.click('#go'); W(300)  # とちゅうで 開きなおす
        pg.evaluate(BOT, 1.0); W(10)
    check(seen, 'ボーナスタイムが 出た')
    check(len([x for x in heads if '/6' in x]) >= 5, f'1ターンで たおすと のこり 6問（{sorted(heads)}）')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
