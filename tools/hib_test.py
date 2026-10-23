# 冬眠版（4.0.0）のテスト：育成ダンジョン・無限の塔は 灰色で 入れない／ログボは 出ない／ガチャ・対戦・とうぎじょう・問題リスト・QRは つかえる
# 使い方: python3 tools/hib_test.py
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test&login&hib'
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(400)
    S = lambda k: pg.evaluate(f'MB.S.{k}')
    pg.evaluate("MB.S.tutorial = 0; MB.S.fedDay = new Date().toISOString(); MB.S.loginDay = 'x'; MB.go.home()"); W(300)
    check(pg.locator('#lbok').count() == 0, 'ログインボーナスは 出ない')
    pg.evaluate("document.querySelectorAll('.ov').forEach(e => e.remove())"); W(100)
    dun, tow = pg.locator('#dun'), pg.locator('#tow')
    check(dun.count() == 1 and 'hib' in (dun.get_attribute('class') or ''), '育成ダンジョンは 灰色')
    check(tow.count() == 1 and 'hib' in (tow.get_attribute('class') or ''), '無限の塔は 灰色')
    check('冬眠中' in dun.inner_text() and '冬眠中' in tow.inner_text(), 'ボタンに「冬眠中」')
    st0, d0 = S('stamina'), S('dungeons')
    dun.click(); W(300)
    check('冬眠中' in pg.inner_text('body') and S('stamina') == st0 and S('dungeons') == d0 and not S('run'), '育成ダンジョンを おしても 入れない')
    pg.evaluate("document.querySelectorAll('.ov').forEach(e => e.remove())"); pg.evaluate("MB.go.home()"); W(200)
    pg.locator('#tow').click(); W(300)
    check(pg.locator('.big:has-text(\"無限の塔\")').count() == 0, '無限の塔を おしても 入れない')
    hs = pg.evaluate("[...document.querySelectorAll('.menuR button')].map(e => e.id + ':' + e.offsetWidth + 'x' + e.offsetHeight)")
    print('   ', hs)
    pg.evaluate("document.querySelectorAll('.ov').forEach(e => e.remove())"); pg.evaluate("MB.go.home()"); W(200)
    for bid in ['b1', 'b3', 'b4', 'vs', 'tri']:
        pg.evaluate("MB.go.home()"); W(200)
        pg.locator('#' + bid).click(); W(300)
        check(pg.locator('#dun').count() == 0 or pg.locator('.ov').count() > 0, f'{bid} は ひらける')
        pg.evaluate("document.querySelectorAll('.ov').forEach(e => e.remove())")
    pg.screenshot(path='/tmp/claude-0/hib_home.png') if False else None
    b.close()
check(not errors, 'エラーなし ' + ' / '.join(errors[:3]))
print('ぜんぶOK' if not fails else f'NG {len(fails)}')
