# まなびバトル デバッグルーム（QR引きつぎ・先生用ページ）のテスト（Playwright）
# 使い方: python3 tools/debug_test.py
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools/play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

def kid(b, pn, acc):
    ctx = b.new_context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', pn); pg.fill('#cn', 'モン' + pn[0]); pg.click('#go')
    pg.click('#dun'); pg.wait_for_timeout(50); pg.click('.ov .choices button')
    for _ in range(4000):
        if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
        pg.evaluate(BOT, acc); pg.wait_for_timeout(25)
    return pg.evaluate("({ bytes: MB.qrBytes(), st: MB.S.st, n: Object.keys(MB.S.qs).length, miss: Object.keys(MB.S.miss).length })")

with sync_playwright() as p:
    b = p.chromium.launch()
    kids = [kid(b, n, a) for n, a in [('あおい', 0.9), ('けんた', 0.5), ('みさき', 0.7)]]
    ctx = b.new_context(accept_downloads=True); pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    # まちがった名前ではデバッグルームに入らない
    pg.fill('#pn', 'teacher'); pg.fill('#cn', 'pass'); pg.click('#go'); pg.wait_for_timeout(100)
    check(pg.query_selector('#dun') is not None, 'ちがう名前ではふつうに始まる')
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(100)
    pg.fill('#pn', 'teacher'); pg.fill('#cn', 'password'); pg.click('#go'); pg.wait_for_timeout(100)
    check(pg.query_selector('#tr') is not None and pg.evaluate("localStorage.getItem('manabi_battle_save')") is None, 'デバッグルームに入れる（セーブは作らない）')
    check('password' not in (ROOT / 'game.js').read_text(), 'コードに入口の名前が書かれていない')

    # 先生用ページ：3人読みこむ（同じ人をもう一度読んでも ふえない）
    pg.click('#tp'); pg.wait_for_timeout(100); pg.click('#add'); pg.wait_for_timeout(100)
    for k in kids + [kids[0]]:
        pg.evaluate(f"MB.scan({k['bytes']})"); pg.wait_for_timeout(150)
    pg.click('#cn'); pg.wait_for_timeout(200)
    rows = pg.query_selector_all('.tt')[0].query_selector_all('tr')
    check(len(rows) == 4, f'一覧に3人（{len(rows) - 1}人）')
    txt = pg.inner_text('.tt')
    r0 = round((kids[0]['n'] - kids[0]['miss']) / kids[0]['n'] * 100)
    check(f'{r0}%' in txt, f'あおいの正答率 {r0}%')
    rk = pg.query_selector_all('.tt')[1].query_selector_all('tr')
    check(len(rk) > 1, f'正答率が低い問題ランキング {len(rk) - 1}問')
    with pg.expect_download() as d: pg.click('#c1')
    csv = pathlib.Path(d.value.path()).read_text(encoding='utf-8-sig')
    check('あおい' in csv and '正答率' in csv, 'CSV（一覧）がダウンロードできる')
    with pg.expect_download() as d: pg.click('#c2')
    check('問題' in pathlib.Path(d.value.path()).read_text(encoding='utf-8-sig'), 'CSV（ランキング）がダウンロードできる')
    pg.click('#bk'); pg.wait_for_timeout(100)

    # QR引きつぎ（2回確認）→ このPCで続きから
    pg.click('#tr'); pg.wait_for_timeout(100)
    pg.evaluate(f"MB.scan({kids[1]['bytes']})"); pg.wait_for_timeout(150)
    pg.click('.ov .choices button'); pg.wait_for_timeout(100); pg.click('.ov .choices button'); pg.wait_for_timeout(100); pg.click('.ov .choices button'); pg.wait_for_timeout(100)
    pg.click('#go'); pg.wait_for_timeout(100)
    s = pg.evaluate("({ pn: MB.S.pname, st: MB.S.st, n: Object.keys(MB.S.qs).length })")
    check(s['pn'] == 'けんた' and s['st'] == kids[1]['st'] and s['n'] == kids[1]['n'], f'引きついだセーブで続きから {s["pn"]}')
    pg.reload(); pg.wait_for_timeout(100)
    check(pg.query_selector('#go') is not None and 'けんた' in pg.inner_text('body'), '開きなおしても引きついだまま')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
