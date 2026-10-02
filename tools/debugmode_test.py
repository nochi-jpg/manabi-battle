# デバッグモード（ひみつの入口・スイッチ）のテスト
import pathlib
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
fails, errors = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(has_touch=True); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    def start(pn, cn, story=True):  # タイトル → あいぼうとの出会い → 名前2つ →（お話 → せつめいは いいえ）
        pg.click('#go'); pg.wait_for_timeout(100); pg.click('#mb'); pg.wait_for_timeout(60)
        pg.fill('#nm', pn); pg.click('#ok'); pg.wait_for_timeout(60); pg.click('#mb'); pg.wait_for_timeout(60)
        pg.fill('#nm', cn); pg.click('#ok'); pg.wait_for_timeout(100)
        if story:
            for _ in range(4): pg.click('#mb'); pg.wait_for_timeout(60)
            pg.click('.ov .choices button >> nth=1'); pg.wait_for_timeout(100)
    start('せんせい', 'テスト')
    pg.click('.ov .choices button'); pg.wait_for_timeout(80); pg.click('.ov button'); pg.wait_for_timeout(80)  # ごはん
    pg.evaluate("MB.S.coins = 123; MB.S.stamina = 77")
    def to_reset(taps):
        pg.click('#set'); pg.wait_for_timeout(100); pg.click('#rs'); pg.wait_for_timeout(100)
        for _ in range(taps // 2): pg.tap('.ov .who')   # 1回目の確認画面
        pg.click('.ov .choices button'); pg.wait_for_timeout(100)  # やりなおす
        for _ in range(taps - taps // 2): pg.tap('.ov .who')  # 2回目の確認画面
        pg.click('.ov .choices button'); pg.wait_for_timeout(200)  # ぜんぶ消す
    # 9回では入れない（ふつうに消える）→ 名前の画面
    to_reset(9)
    check(pg.query_selector('#go') is not None and pg.evaluate('MB.S') is None, '9回タッチでは ふつうに「さいしょから」になる（タイトル）')
    start('せんせい', 'テスト')
    pg.click('.ov .choices button'); pg.wait_for_timeout(80); pg.click('.ov button'); pg.wait_for_timeout(80)  # ごはん
    pg.evaluate("MB.S.coins = 123; MB.S.stamina = 77")
    to_reset(10)
    check(pg.evaluate("!!(MB.S && MB.S.debug && MB.S.debug.on)") and pg.evaluate("MB.S.coins") == 123, '10回タッチで デバッグモード（セーブは消えない）')
    # 数値を 自由に かえる
    pg.click('#dbp'); pg.wait_for_timeout(100)
    pg.fill('[data-pk="国語"]', '1234'); pg.fill('[data-pk="stamina"]', '555'); pg.fill('[data-pk="coins"]', '777'); pg.fill('[data-pk="seikaku"]', '1800')
    pg.click('.ov #ok'); pg.wait_for_timeout(150)
    v = pg.evaluate("[MB.S.st['国語'], MB.S.stamina, MB.S.coins, MB.S.seikaku]")
    check(v == [1234, 555, 777, 1800], f'数値を 自由に かえられる {v}')
    pg.evaluate("MB.S.st['国語']=100; MB.S.stamina=77; MB.S.coins=123; MB.S.seikaku=1000"); pg.click('#set') if not pg.locator('#dbp').count() else None; pg.wait_for_timeout(100)
    for k in ['st', 'stamina', 'coins', 'items', 'allq', 'tower']:
        pg.click(f'[data-dbg="{k}"]'); pg.wait_for_timeout(80)
    s = pg.evaluate("({st: MB.S.st, sta: MB.S.stamina, c: MB.S.coins, o: MB.S.owned.length})")
    check(all(v == 9999 for v in s['st'].values()) and s['sta'] == 9999 and s['c'] == 9999 and s['o'] == 70, f'スイッチ全部オン {s}')
    pg.click('#cl'); pg.wait_for_timeout(100)
    check('999:00' in pg.inner_text('#tow'), '塔の時間 999分')
    pg.click('#set'); pg.wait_for_timeout(100); pg.click('#dbx'); pg.wait_for_timeout(100)
    s = pg.evaluate("({st: MB.S.st, sta: MB.S.stamina, c: MB.S.coins, o: MB.S.owned.length, d: MB.S.debug})")
    check(s['st']['国語'] == 100 and s['sta'] == 77 and s['c'] == 123 and s['o'] == 0 and not s['d'], f'終わると もとにもどる {s}')
    # デバッグモードのまま QR引きつぎ → 引きついだら必ずオフ
    by = pg.evaluate("MB.qrBytes()")
    to_reset(10); pg.wait_for_timeout(100)  # デバッグモードにすると せってい が開く
    pg.click('#dbr'); pg.wait_for_timeout(100); pg.click('#tr'); pg.wait_for_timeout(100)
    pg.evaluate(f"MB.scan({by})"); pg.wait_for_timeout(150)
    for _ in range(3): pg.click('.ov .choices button'); pg.wait_for_timeout(100)
    check(pg.evaluate("!MB.S.debug") and pg.evaluate("!JSON.parse(localStorage.getItem(MB.SAVE_KEY)).debug"), 'QR引きつぎのあとは デバッグモードがオフ')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
