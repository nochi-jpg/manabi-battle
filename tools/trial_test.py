# まなびバトル おためしバトル（CPU戦）のテスト（Playwright）
# 使い方: python3 tools/trial_test.py
import pathlib, json
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
    pg.wait_for_timeout(100)
    # アイテムを3つ持たせる
    pg.evaluate("MB.S.owned = ['木の盾','どくキバ','おにぎり']; MB.S.stamina = 0")
    before = pg.evaluate("JSON.stringify({c:MB.S.coins,st:MB.S.st,qs:MB.S.qs,o:MB.S.owned,d:MB.S.dungeons,s:MB.S.stamina})")

    pg.click('#tri'); pg.wait_for_timeout(100)
    check(pg.locator('#bs button').count() == 6, 'ボスが6体えらべる')
    pg.click('#sg button[data-g="2"]'); pg.wait_for_timeout(50)
    pg.click('#bs button[data-b="算数"]'); pg.wait_for_timeout(100)
    check(pg.locator('#lt').count() == 0, 'そうびえらびに 時間制限がない')
    pg.wait_for_timeout(1500)
    check(pg.locator('#ok').count() == 1, '時間がたっても そうびえらびのまま')
    cells = pg.evaluate("[...document.querySelectorAll('.bk:not(.none)')].map(e=>e.dataset.n)")
    check(set(cells) <= {'木の盾', 'どくキバ', 'おにぎり'}, '持っているアイテムだけ えらべる')
    for n in ['木の盾', 'どくキバ']:
        pg.click(f'.bk[data-n="{n}"] >> nth=0'); pg.click('#eq'); pg.wait_for_timeout(50)
    pg.click('.bk.none >> nth=0'); pg.wait_for_timeout(50)
    check(pg.locator('#eq').count() == 0, '持っていないアイテムは そうびできない')
    pg.click('#ok'); pg.wait_for_timeout(100)

    check(pg.evaluate("MB.BT && MB.BT.qn") == 5, '1ターン5問')
    check(pg.evaluate("[...MB.BT.P.items].sort().join()") == ','.join(sorted(['木の盾', 'どくキバ'])), 'えらんだアイテムで戦う')
    check(pg.evaluate("MB.BT.B.name") == 'たいかいのクジラ', 'えらんだボス・強さ')
    # 1ターン目：プレイヤーの問題数を数える
    asked = 0; maxturn = 0
    end = "!!document.querySelector('.ov .choices') && document.querySelector('.ov').innerText.includes('おためしバトルなので')"
    for _ in range(6000):
        if pg.evaluate(end): break
        t = pg.evaluate("MB.BT ? MB.BT.turn : 0"); maxturn = max(maxturn, t)
        a = pg.evaluate("MB.BT && MB.BT.acts.P && MB.BT.acts.P.ans ? MB.BT.acts.P.ans.length : 0"); asked = max(asked, a)
        pg.evaluate(BOT, 0.8); pg.wait_for_timeout(20)
    check(pg.evaluate(end), 'バトルがおわって 結果が出る')
    check(asked == 5, f'プレイヤーは5問答える（{asked}問）')
    check(maxturn <= 4, f'3ターンまで（{maxturn}）')
    check(pg.evaluate("MB.R") is None and pg.evaluate("MB.S.run") is None, 'ダンジョンのデータを作らない')
    # もう一度（同じそうび）
    pg.click('.ov .choices button >> nth=0'); pg.wait_for_timeout(200)
    check(pg.evaluate("MB.BT && [...MB.BT.P.items].length") == 2, 'もう一度：同じそうびで すぐ始まる')
    for _ in range(6000):
        if pg.evaluate(end): break
        pg.evaluate(BOT, 0.8); pg.wait_for_timeout(20)
    # そうびをかえる
    pg.click('.ov .choices button >> nth=1'); pg.wait_for_timeout(200)
    check(pg.locator('#ok').count() == 1 and pg.locator('.bk.sel').count() >= 2, 'そうびをかえる：前のそうびが入った状態')
    pg.click('#bk'); pg.wait_for_timeout(100)
    check(pg.locator('#bs').count() == 1, 'もどるで ボスえらびへ')
    pg.click('#bk'); pg.wait_for_timeout(100)
    check(pg.locator('#tri').count() == 1, 'ホームへもどる')
    after = pg.evaluate("JSON.stringify({c:MB.S.coins,st:MB.S.st,qs:MB.S.qs,o:MB.S.owned,d:MB.S.dungeons,s:MB.S.stamina})")
    check(before == after, 'コイン・ステータス・問題の記録・アイテム・スタミナが変わらない（ほうびなし・記録なし）')
    b.close()

print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
