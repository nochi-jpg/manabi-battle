# 1日の せいちょうを はかる（BOTで 毎日 ダンジョン2回＋復習ダンジョン）。進化ライン（LOOK_LINE）の 目安に つかう
# 使い方: python3 tools/growth_sim.py [日数] [正答率]
import sys, pathlib, json
from playwright.sync_api import sync_playwright
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 25
ACC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.8
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
BOT = open(pathlib.Path(__file__).resolve().parent / 'play_test.py', encoding='utf-8').read().split('BOT = """')[1].split('"""')[0]
OFF = "window.__off = +(localStorage.getItem('__off') || 0); const _n = Date.now; Date.now = () => _n() + window.__off; const _D = Date; window.Date = class extends _D { constructor(...a) { if (a.length) super(...a); else super(Date.now()); } static now() { return _n() + window.__off; } };"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.add_init_script(OFF)
    pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(100)
    def until_home(limit=8000):
        idle = 0
        for _ in range(limit):
            if pg.query_selector('#dun') and not pg.query_selector('.ov') and not pg.query_selector('.qbox'): return True
            r = pg.evaluate(BOT, ACC); W(8)
            idle = idle + 1 if r == 'idle' else 0
            if idle > 40: pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.R || MB.go.home()"); idle = 0
            if pg.query_selector('#go') and not pg.query_selector('#pn'): pg.click('#go'); W(50)
        return False
    until_home()
    rows = []
    for day in range(1, DAYS + 1):
        if day > 1:
            pg.evaluate(f"localStorage.setItem('__off', {(day - 1) * 86400000})"); pg.reload(); W(100)
            if pg.query_selector('#go'): pg.click('#go'); W(100)
            until_home()
        for k in range(2):
            pg.click('#dun'); W(50); pg.click('.ov .choices button'); W(50)
            until_home()
        pg.evaluate("void MB.go.reviewDungeon()"); W(100)
        until_home()
        t = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)")
        qs = pg.evaluate("(() => { const c = [0,0,0,0,0]; Object.values(MB.S.qs).forEach(v => c[v]++); return c; })()")
        rows.append(t); print(f'day{day}: total={t} (+{t - (rows[-2] if len(rows) > 1 else 500)}) qs(2/3/4)={qs[2:]}', flush=True)
    b.close()
print('errors:', errors or 'なし')
print(json.dumps(rows))
