# アイテムの 発動メッセージの テスト（おためしバトルで アイテムを もたせて 自動で たたかう）（10/13）
# 使い方: python3 tools/itemmsg_test.py
import pathlib, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools' / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
WATCH = "window.__log = []; setInterval(() => { document.querySelectorAll('#blog, .cutin').forEach(e => { const t = e.innerText; if (t && t !== e.__lt) { e.__lt = t; window.__log.push(t); } }); }, 15);"
def fight(pg, pi, bi, boss='算数', shots=None, acc=0.9):
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    pg.evaluate("window.__log = []")
    pg.evaluate(f"window.__done = false; void MB.T.trial({pi}, {bi}, '{boss}').then(() => window.__done = true)")
    for k in range(1500):
        if pg.evaluate('window.__done'): break
        if shots and pg.evaluate("!!document.querySelector('.cutin .cut2')") and not shots.get('cut'): pg.screenshot(path=shots['dir'] + '/cut2.png'); shots['cut'] = 1
        pg.evaluate(BOT, acc); pg.wait_for_timeout(15)
    return '\n'.join(pg.evaluate('window.__log'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.add_init_script(WATCH); pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); pg.wait_for_timeout(200)
    shots = {'dir': '/tmp/claude-0'}
    t = fight(pg, ['給食の牛乳', 'うわばき', 'くつした'], ['木の盾', 'ランドセル'], shots=shots)
    check('給食の牛乳' in t and '威力が 上がった' in t, '威力アップ：カットインに アイテムの名前')
    check('木の盾' in t and 'へった' in t, 'ダメージが へった：ダメージの行に アイテムの名前')
    t = fight(pg, ['聖杯', '給食の牛乳'], ['金色の羽', 'おにぎり'])
    check('聖杯の効果で、最初の 2ターンは' in t and '金色の羽の効果で' not in t, '聖杯：最初に 説明・金色の羽も 効かない')
    check('聖杯の効果が きれた' in t, '3ターン目に 聖杯が きれる')
    check('給食の牛乳' not in t.split('聖杯の効果が きれた')[0].split('最初の 2ターンは')[1], '聖杯の あいだは 給食の牛乳も 効かない')
    t = fight(pg, ['金色の羽'], ['木の盾'])
    check('金色の羽の効果で、' in t and '木の盾が 無効化された' in t, '金色の羽：相手の アイテムが 無効化')
    t = fight(pg, ['どくキバ', '悪魔の契約書', 'もうどくビン'], ['教室のベル'])
    check(re.search('どくキバの効果で、.+が どくに なった', t) or re.search('もうどくビンの効果で、.+が どくに なった', t), '状態異常：アイテムの名前つき')
    t = fight(pg, ['まりとっつぉ', 'もちもちドーナツ', 'さくらもち'], ['ごまだんご', 'モンブラン', '銀色の羽'])
    for k in ['まりとっつぉの効果で', 'もちもちドーナツの効果で', 'さくらもちの効果で', 'ごまだんごの効果で', 'モンブランの効果で', '銀色の羽の効果で']: check(k in t, f'試合はじめ：{k}')
    t = fight(pg, ['赤のポーション', '青のポーション', '黄のポーション', '緑のポーション'], ['ベーコン'])
    check('ダメージを ふせいだ' in t, 'ポーション：ダメージを ふせぐ')
    t = fight(pg, ['メテオ'], ['くもの巣'])
    check('エラー' not in t, 'メテオ：たたかえる')
    pg.screenshot(path='/tmp/claude-0/after.png')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
