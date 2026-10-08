# ガチャ（200・10回目ごとに★4以上・1日50回・ダブりはボーナス+5）と 未入手確定（1日1回）のテスト
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
    check(pg.evaluate('MB.S.bonusPt') == 5 and 'ボーナス' in pg.inner_text('#app'), 'ダブりで ボーナスポイント +5（すぐには 上がらない）')
    pg.evaluate("MB.S.bonusPt = 8"); pg.evaluate("void MB.go.gacha()"); W(100)
    pg.click('#bpa'); W(100); pg.click('[data-bs="算数"]'); W(100)
    check(pg.evaluate("MB.S.bonusPt") == 3 and pg.evaluate("MB.S.st['算数']") == 105, 'すきな教科に ふれる（算数 +5）')
    pg.click('[data-bs="算数"]'); W(100)
    check(pg.evaluate("MB.S.bonusPt") == 0 and pg.evaluate("MB.S.st['算数']") == 108, '5より少ない のこりは まとめて（算数 +3）')
    pg.click('.ov #cl'); W(100)
    # 見た目が かわる ボーナスなら 進化の演出（10/5）
    pg.evaluate("MB.S.dungeons = 1; MB.S.bonusPt = 5; const L=MB.D.K.LOOK_LINE[0], t=Object.values(MB.S.st).reduce((a,b)=>a+b); MB.S.st['国語'] += L - t - 2"); pg.evaluate("void MB.go.gacha()"); W(100)
    pg.click('#bpa'); W(100); pg.click('[data-bs="国語"]'); W(100); pg.click('.ov #cl'); W(100)
    pg.wait_for_selector('#evb button', timeout=8000)
    check('は 進化した！' in pg.inner_text('#evt'), 'ボーナスで 段階が 上がったら「進化した！」')
    pg.click('#evb button'); W(150)
    # 段階は そのまま・タイプだけ かわる →「姿が変わった！」（10/8）
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.S.st = {国語:370,算数:300,理科:300,社会:300,英語:300}; MB.S.type='全教科'; MB.S.bonusPt = 5"); pg.evaluate("void MB.go.gacha()"); W(100)
    pg.click('#bpa'); W(100); pg.click('[data-bs="国語"]'); W(100); pg.click('.ov #cl'); W(100)
    pg.wait_for_selector('#evb button', timeout=8000)
    check('は 姿が変わった！' in pg.inner_text('#evt'), f"タイプだけ かわったら「姿が変わった！」（{pg.inner_text('#evt')[:30]}）")
    pg.click('#evb button'); W(150)
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
