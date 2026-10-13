# まなびバトル 対戦（3問×5ターン）の 決着の ターンを はかる。ほんものの ゲームの 計算を Playwright で動かす（MB.simVs）
# 使い方: python3 tools/vs_balance.py [HP倍率 ...]（なし＝data.js の K.VS_HP）
#   ねらい（10/13）：4〜5ターン目の KO が 多め・判定は 1〜2割（前の 3ターン：3ターン目KO 70%・判定 12%）
import pathlib, sys
from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
HPS = [float(x) for x in sys.argv[1:]] or [None]
N = 3000
S5 = ['国語', '算数', '理科', '社会', '英語']
def st(t, ms): return {s: round(t / 5 * m) for s, m in zip(S5, ms)}
CASES = [  # （名前, A, B, Aの正答率, Bの正答率）
    ('同じくらい 合計2000', st(2000, [1, 1, 1, 1, 1]), st(2000, [1.3, 1.1, 1, 0.9, 0.7]), 0.75, 0.75),
    ('同じくらい 合計5000', st(5000, [0.8, 1.4, 1, 1, 0.8]), st(5000, [1, 1, 1, 1, 1]), 0.75, 0.75),
    ('正答率 90% vs 60%', st(3000, [1, 1, 1, 1, 1]), st(3000, [1, 1, 1, 1, 1]), 0.9, 0.6),
]

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); pg.wait_for_timeout(100)
    import os
    if os.environ.get('OLD'): pg.evaluate('Object.assign(MB.D.K, {VS_Q: 5, VS_T: 3})')
    for hp in HPS:
        print('HP倍率:', hp or pg.evaluate('MB.D.K.VS_HP'))
        for name, a, bb, xa, xb in CASES:
            r = pg.evaluate('([a,b,xa,xb,n,hp]) => MB.simVs({stA: a, stB: b, accA: xa, accB: xb, n, hp, itemsA: () => MB.simHand(), itemsB: () => MB.simHand()})', [a, bb, xa, xb, N, hp])
            ko = '・'.join(f'{t}T {v*100:4.1f}%' for t, v in enumerate(r['ko']) if t)
            print(f"  {name}：Aの勝率 {r['win']*100:5.1f}%  KO {ko}  判定 {r['judge']*100:4.1f}%")
    b.close()
