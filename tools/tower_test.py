# まなびバトル 無限の塔（入場券・コイン・窓を閉じない）のテスト（Playwright）
# 使い方: python3 tools/tower_test.py
import pathlib
from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
BOT = pathlib.Path(__file__).with_name('play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true')
    pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); pg.wait_for_timeout(100)
    W = pg.wait_for_timeout
    def answer(ok):
        pg.wait_for_selector('.qbox .opts button:not([disabled])')
        pg.evaluate("""(ok)=>{const q=document.querySelector('.qbox');const t=q.querySelector('.qt').textContent;const qq=Object.values(MB.Q).find(x=>x.t===t);
          [...q.querySelectorAll('.opts button')].find(b=>ok?b.textContent===qq.a[0]:b.textContent!==qq.a[0]).click()}""", ok)
        if not ok:
            pg.wait_for_selector('.qbox .after button:not([disabled])'); pg.click('.qbox .after button')
        W(80)

    c0 = pg.evaluate('MB.S.coins')
    pg.click('#tow'); W(100)
    check('入場できる' in pg.inner_text('#ts button[data-s="算数"]'), 'はじめは 入場できる')
    pg.click('#ts button[data-s="算数"]'); W(100)
    ov = pg.evaluate("document.querySelector('.ov.ovq')")
    pg.evaluate("window._ov = document.querySelector('.ov.ovq')")
    for _ in range(3): answer(True)
    check(pg.evaluate("window._ov === document.querySelector('.ov.ovq') && document.querySelectorAll('.ov.ovq').length===1"), '問題の窓は 閉じずに 同じ窓で 次の問題')
    check(pg.evaluate('MB.S.coins') - c0 == 3, '正解1問ごとに コイン+1')
    # 中断 → 同じ日は つづきから入れる
    pg.click('.qbox .megane button:last-child'); W(150)
    check(pg.locator('.ov').count() == 0 and pg.locator('#ts').count() == 1, '中断すると 塔の入口へ（窓が のこらない）')
    check('つづきから 4階' in pg.inner_text('#ts button[data-s="算数"]'), '中断しても つづきから')
    # ゲームオーバー（きょうの入場券で入った）→ きょうは もう入れない
    pg.click('#ts button[data-s="算数"]'); W(100)
    for _ in range(3): answer(False)
    pg.wait_for_selector('.ov .choices button'); txt = pg.inner_text('.ov')
    check('また あした' in txt, 'きょう入った塔で おわり → また あした')
    pg.click('.ov .choices button'); W(100)
    check(pg.locator('#ts button[data-s="算数"]').is_disabled(), 'きょうは もう その塔に入れない')
    check(not pg.locator('#ts button[data-s="国語"]').is_disabled(), 'ほかの塔には入れる')
    # 次の日：きのうの つづき → ゲームオーバーしても きょうの入場券で もう一度
    pg.click('#ts button[data-s="国語"]'); W(100)
    answer(True); pg.click('.qbox .megane button:last-child'); W(100)
    pg.evaluate("MB.S.day='2000-01-01'; for (const k in MB.S.towerTicket) MB.S.towerTicket[k]='2000-01-01'; MB.S.tower['国語'].day='2000-01-01'")
    pg.evaluate("void MB.go.towerSelect()"); W(100)
    check(pg.evaluate('MB.S.towerMs') == 0, '次の日は 30分がもどる')
    check('入場できる' in pg.inner_text('#ts button[data-s="算数"]'), '次の日：入場券がもどる（算数）')
    check('つづきから 2階' in pg.inner_text('#ts button[data-s="国語"]'), '次の日：きのうの つづきから（国語）')
    pg.click('#ts button[data-s="国語"]'); W(100)
    for _ in range(3): answer(False)
    pg.wait_for_selector('.ov .choices button'); txt = pg.inner_text('.ov')
    check('もう一度' in txt, 'きのうの つづきで おわり → きょうの入場券で もう一度 入れる')
    pg.click('.ov .choices button'); W(100)
    check('入場できる' in pg.inner_text('#ts button[data-s="国語"]'), 'もう一度 1階から 入れる')
    pg.click('#ts button[data-s="国語"]'); W(100)
    for _ in range(3): answer(False)
    pg.wait_for_selector('.ov .choices button'); pg.click('.ov .choices button'); W(100)
    check(pg.locator('#ts button[data-s="国語"]').is_disabled(), '2回目（きょうの入場券）で おわったら もう入れない')
    # 30分しばり
    pg.evaluate("MB.S.towerMs = 30*60*1000"); pg.evaluate("void MB.go.towerSelect()"); W(100)
    check('30分まで' in pg.inner_text('.ov'), '30分しばりは そのまま')
    b.close()

print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
