# まなびバトル ボス戦の勝率をはかる（ノーコンティニュー）。ほんもののゲームの計算を Playwright で動かす
# 使い方: python3 tools/boss_balance.py [★1 ★2 ★3 のボスHP倍率]（なし＝data.js の K.BOSS_HP）
#   ねらい: アイテムあり(6個見つけて4個のこす)・全問正解 → 約90%、アイテムなし・正答率80% → 約50%
import pathlib, sys
from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
HP = [float(x) for x in sys.argv[1:4]] if len(sys.argv) > 3 else [float(sys.argv[1])] * 3 if len(sys.argv) > 1 else None
N = 3000
# 段階ごとの ステータス（合計 1350 / 3900 / 8150（10/5 の ライン。もとは 1000 / 2500 / 5000）。得意・苦手のばらつきあり）
def stats(t):
    return [{s: round(t / 5 * m) for s, m in zip(['国語', '算数', '理科', '社会', '英語'], ms)}
            for ms in ([1, 1, 1, 1, 1], [1.3, 1.1, 1, 0.9, 0.7], [0.8, 1.4, 1, 1, 0.8])]

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); pg.wait_for_timeout(100)
    print('ボスHP倍率:', HP or pg.evaluate('MB.D.K.BOSS_HP'))
    tot = {'item': [], 'none': []}
    for t in (1350, 3900, 8150):
        for st in stats(t):
            a = pg.evaluate('([st,n,hp]) => MB.simBoss({st, n, bossHp: hp, acc: 1, items: () => MB.simHand()})', [st, N, HP])
            c = pg.evaluate('([st,n,hp]) => MB.simBoss({st, n, bossHp: hp, acc: 0.8, items: []})', [st, N, HP])
            tot['item'].append(a['win']); tot['none'].append(c['win'])
            print(f"合計{t:5d} {list(st.values())}  アイテムあり全問正解 {a['win']*100:5.1f}%  アイテムなし80% {c['win']*100:5.1f}%")
    avg = lambda v: sum(v) / len(v) * 100
    print(f"平均  アイテムあり全問正解 {avg(tot['item']):.1f}%（ねらい90%）  アイテムなし80% {avg(tot['none']):.1f}%（ねらい50%）")
    b.close()
