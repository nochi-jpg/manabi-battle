# はじめての ながれ（タイトル → あいぼうとの出会い → 名前 → お話 → せつめい → ごはん → ダンジョンへ）のテスト
# 使い方: python3 tools/intro_test.py [画像を保存するフォルダ]
import pathlib, sys
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test&intro&feed'
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    n = [0]
    def shot(name):
        if OUT: n[0] += 1; pg.screenshot(path=str(OUT / f'{n[0]:02d}_{name}.png'))
    W(300); shot('title')
    check(pg.locator('.logo').count() == 1 and 'はじめる' in pg.inner_text('#go'), 'はじめても タイトル画面')
    pg.click('#go'); W(300); shot('meet')
    check('あいぼう' in pg.inner_text('#mb'), 'あいぼうが 話しかける')
    pg.click('#mb'); W(150); shot('pname')
    check('かえることは できません' in pg.inner_text('#mb'), '自分の名前（あとから かえられない）')
    pg.fill('#nm', 'ゆうき'); pg.click('#ok'); W(150)
    pg.click('#mb'); W(150); shot('cname')
    check('すきなときに かえられます' in pg.inner_text('#mb'), 'あいぼうの名前（あとから かえられる）')
    pg.fill('#nm', 'ポチ'); pg.click('#ok'); W(150)
    check(pg.evaluate('MB.S.pname') == 'ゆうき' and pg.evaluate('MB.S.cname') == 'ポチ', 'セーブができる')
    talk = []
    for _ in range(4): talk.append(pg.inner_text('.meet-t')); shot('talk'); pg.click('#mb'); W(150)
    check('まなびタウン' in talk[0] and 'つよく そだてて' in talk[3], 'お話が 4つ')
    check('せつめいを 聞きますか' in pg.inner_text('.ov'), 'せつめいを 聞くか きく'); shot('ask')
    pg.click('.ov .choices button >> nth=0'); W(300)
    pages = 0
    while pg.locator('.tut').count():
        pages += 1; W(250); shot('tut'); pg.click('#nx'); W(150)
    check(pages >= 7, f'せつめい（{pages}ページ）')
    check('ごはん' in pg.inner_text('.ov'), 'せつめいのあとに ごはん'); shot('feed')
    pg.click('.ov .choices button >> nth=0'); W(200); pg.click('.ov .choices button'); W(200)
    check('ダンジョンに 行こう' in pg.inner_text('.ov'), 'さいごに「まずは ダンジョンに 行こう！」'); shot('go')
    pg.click('.ov .choices button'); W(200)
    check(pg.evaluate('MB.S.tutorial') == 0 and pg.locator('.ov').count() == 0, 'おわり → ホーム')
    # せっていの せつめい
    pg.click('#set'); W(150); pg.click('#sH'); W(150)
    p2 = 0
    while pg.locator('.tut').count(): p2 += 1; pg.click('#nx'); W(120)
    check(p2 >= 4 and pg.locator('#sH').count() == 1, f'せっていから せつめい（{p2}ページ）→ せっていへ もどる')
    # いいえ のとき
    pg.evaluate("localStorage.clear()"); pg.goto(URL); W(300); pg.click('#go'); W(200); pg.click('#mb'); W(100)
    pg.fill('#nm', 'あ'); pg.click('#ok'); W(100); pg.click('#mb'); W(100); pg.fill('#nm', 'い'); pg.click('#ok'); W(100)
    for _ in range(4): pg.click('#mb'); W(100)
    pg.click('.ov .choices button >> nth=1'); W(300)
    check(pg.locator('.tut').count() == 0 and 'ごはん' in pg.inner_text('.ov'), 'いいえ → すぐ ホーム（ごはん）')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
