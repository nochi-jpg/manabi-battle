# デバッグモード（ひみつの入口・スイッチ）のテスト
import pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
fails, errors = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', 'せんせい'); pg.fill('#cn', 'テスト'); pg.click('#go'); pg.wait_for_timeout(100)
    pg.evaluate("MB.S.coins = 123; MB.S.stamina = 77")
    def to_reset(taps):
        pg.click('#set'); pg.wait_for_timeout(100); pg.click('#rs'); pg.wait_for_timeout(100)
        pg.click('.ov .choices button'); pg.wait_for_timeout(100)  # やりなおす
        for _ in range(taps): pg.click('.ov .who')
        pg.click('.ov .choices button'); pg.wait_for_timeout(200)  # ぜんぶ消す
    # 9回では入れない（ふつうに消える）→ 名前の画面
    to_reset(9)
    check(pg.query_selector('#pn') is not None, '9回タッチでは ふつうに「さいしょから」になる')
    pg.fill('#pn', 'せんせい'); pg.fill('#cn', 'テスト'); pg.click('#go'); pg.wait_for_timeout(100)
    pg.evaluate("MB.S.coins = 123; MB.S.stamina = 77")
    to_reset(10)
    check(pg.evaluate("!!(MB.S && MB.S.debug && MB.S.debug.on)") and pg.evaluate("MB.S.coins") == 123, '10回タッチで デバッグモード（セーブは消えない）')
    for k in ['st', 'stamina', 'coins', 'items', 'allq', 'tower']:
        pg.click(f'[data-dbg="{k}"]'); pg.wait_for_timeout(80)
    s = pg.evaluate("({st: MB.S.st, sta: MB.S.stamina, c: MB.S.coins, o: MB.S.owned.length})")
    check(all(v == 9999 for v in s['st'].values()) and s['sta'] == 9999 and s['c'] == 9999 and s['o'] == 70, f'スイッチ全部オン {s}')
    pg.click('#cl'); pg.wait_for_timeout(100)
    check('999:00' in pg.inner_text('#tow'), '塔の時間 999分')
    pg.click('#set'); pg.wait_for_timeout(100); pg.click('#dbx'); pg.wait_for_timeout(100)
    s = pg.evaluate("({st: MB.S.st, sta: MB.S.stamina, c: MB.S.coins, o: MB.S.owned.length, d: MB.S.debug})")
    check(s['st']['国語'] == 100 and s['sta'] == 77 and s['c'] == 123 and s['o'] == 0 and not s['d'], f'終わると もとにもどる {s}')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
