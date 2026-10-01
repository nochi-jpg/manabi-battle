# まなびバトル 復習ダンジョン・無限の塔・問題リストのテスト（Playwright）
# 使い方: python3 tools/mode_test.py
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
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go')
    def loop(acc, until, n=4000):
        for _ in range(n):
            if pg.evaluate(until): return True
            pg.evaluate(BOT, acc); pg.wait_for_timeout(25)
        return False
    home = "!!document.querySelector('#dun') && !document.querySelector('.ov')"

    # まちがいを作る（正答率0.3でダンジョン2回）
    for _ in range(2):
        pg.click('#dun'); pg.wait_for_timeout(50); pg.click('.ov .choices button'); loop(0.3, home)
    cnt = "(k)=>Object.values(MB.S.qs).filter(v=>v===k).length"
    wrong, right = pg.evaluate(f"({cnt})(2)"), pg.evaluate(f"({cnt})(3)")
    check(wrong > 0 and right > 0, f'ダンジョン：不正解→復習まち {wrong}問／正解→あと1回 {right}問')

    # きょう：復習まちだけが出る（あと1回は きょう上がったばかりなので出ない）。正解 → あと1回、+8・コイン+8
    st0, c0 = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)"), pg.evaluate("MB.S.coins")
    pg.click('#rev'); loop(1.0, home)
    check(pg.evaluate(f"({cnt})(2)") == 0 and pg.evaluate(f"({cnt})(3)") == wrong + right, '復習まち → あと1回')
    gain = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)") - st0
    check(gain == wrong * 8 and pg.evaluate("MB.S.coins") - c0 == wrong * 40, f'復習まちの正解で +8・コイン+40（+{gain}）')
    pg.click('#rev'); pg.wait_for_timeout(100)
    check('回答できる問題はないようだ' in pg.inner_text('.ov'), '同じ問題は1日1回まで'); pg.click('.ov button')

    # 次の日：あと1回 → 卒業 +2・コイン+2
    pg.evaluate("for (const k in MB.S.qd) MB.S.qd[k] = '2000-01-01'")
    st0, c0 = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)"), pg.evaluate("MB.S.coins")
    pg.click('#rev'); loop(1.0, home)
    n = wrong + right
    check(pg.evaluate("MB.S.coins") - c0 == n * 10, '卒業はコイン+10')
    check(pg.evaluate(f"({cnt})(4)") == n, f'あと1回の正解で卒業 {n}問')
    check(pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)") - st0 == n * 2, '卒業は +2')

    nq0 = pg.evaluate("Object.keys(MB.S.qs).length")
    # 無限の塔：3階のぼって中断 → 再読みこみ → つづきから
    pg.click('#tow'); pg.wait_for_timeout(100); pg.click('#ts button[data-s="算数"]')
    loop(1.0, "MB.S.tower['算数'] && MB.S.tower['算数'].floor >= 3")
    pg.wait_for_timeout(200)
    pg.click('.qbox .megane button:last-child'); pg.wait_for_timeout(100)
    f = pg.evaluate("MB.S.tower['算数'].floor")
    pg.reload(); pg.click('#go'); pg.wait_for_timeout(100)
    check(pg.evaluate("MB.S.tower['算数'].floor") == f, f'中断しても {f}階 がのこる')
    check(pg.evaluate("Object.keys(MB.S.qs).length") == nq0, '塔は正誤を記録しない')
    # ハート0で1階から
    pg.click('#tow'); pg.wait_for_timeout(100); pg.click('#ts button[data-s="算数"]')
    loop(0.0, "!MB.S.tower['算数'] && !!document.querySelector('#ts') && !document.querySelector('.ov')")
    check(pg.evaluate("MB.S.towerBest['算数']") >= f, 'ハート0 → 最高記録はのこり、塔はリセット')
    pg.click('#bk')
    pg.wait_for_timeout(100)
    # 25階でコイン
    c0 = pg.evaluate("MB.S.coins")
    pg.evaluate("MB.S.tower['国語'] = null"); pg.click('#tow'); pg.wait_for_timeout(100); pg.click('#ts button[data-s="国語"]')
    loop(1.0, "MB.S.tower['国語'] && MB.S.tower['国語'].floor >= 25", 6000)
    check(pg.evaluate("MB.S.coins") - c0 == 250, f'25階で +250（{pg.evaluate("MB.S.coins") - c0}）')
    # 時間切れ
    pg.evaluate("MB.S.towerMs = 30*60*1000 - 300")
    pg.wait_for_timeout(600)
    check('きょうはここまで' in (pg.inner_text('.ov') if pg.query_selector('.ov') else ''), '時間切れで「きょうはここまで」')
    pg.click('.ov button'); pg.wait_for_timeout(100)
    pg.click('#tow'); pg.wait_for_timeout(100)
    check('もう のぼれない' in pg.inner_text('.ov'), '時間切れのあとは入れない'); pg.click('.ov button')

    # 問題リスト
    pg.click('#b3'); pg.wait_for_timeout(100); pg.click('[data-s="算数"]'); pg.click('[data-g="6"]')
    rows = pg.query_selector_all('.qrow'); check(len(rows) > 50, f'算数6年 {len(rows)}問 見られる')
    rows[0].click(); pg.wait_for_timeout(100); check(pg.query_selector('.qbox .expl') is not None, '解説が見られる')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
