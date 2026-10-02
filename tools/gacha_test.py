# ガチャ（200・10回目ごとに★4以上・1日50回・ダブりはボーナス+3）と 未入手確定（1日1回）のテスト
import pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(100)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.S.coins = 200*60; MB.S.owned = MB.D.ITEMS.map(i=>i.n); void MB.go.gacha()"); W(100)
    check(pg.evaluate('MB.D.GACHA_COST') == 200, 'ガチャは 200')
    st0 = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)")
    pg.click('#pull'); W(150); pg.click('#gr button'); W(100)
    check(pg.evaluate('MB.S.bonusPt') == 3 and 'ボーナス' in pg.inner_text('#app'), 'ダブりで ボーナスポイント +3（すぐには 上がらない）')
    pg.click('#bpa'); W(100); pg.click('[data-bs="算数"]'); W(100)
    check(pg.evaluate("MB.S.bonusPt") == 0 and pg.evaluate("MB.S.st['算数']") == 103, 'すきな教科に ふれる（算数 +3）')
    pg.click('.ov #cl'); W(100)
    for _ in range(60):
        if pg.locator('#pull').is_disabled(): break
        pg.click('#pull'); W(60); pg.click('#gr button'); W(60)
    check(pg.evaluate('MB.S.gachaToday') == 50 and pg.locator('#pull').is_disabled() and 'もう ひけない' in pg.inner_text('#app'), f"1日 50回まで（{pg.evaluate('MB.S.gachaToday')}）")
    q = pg.evaluate("(()=>{const o=SAVECODE.decode(MB.qrBytes()); return [o.bonusPt, o.gachaToday]})()")
    check(q == [pg.evaluate('MB.S.bonusPt'), 50], f'QRに ボーナス・きょうの回数 {q}')
    # 天井：10回目は ★4以上
    pg.evaluate("MB.S.gachaToday=0; MB.S.gachaN=9; MB.S.coins=1000"); pg.evaluate("void MB.go.gacha()"); W(100)
    pg.click('#pull'); W(150)
    check('★4' in pg.inner_text('#gr') or '★5' in pg.inner_text('#gr'), '10回目は ★4以上'); pg.click('#gr button'); W(60)
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
