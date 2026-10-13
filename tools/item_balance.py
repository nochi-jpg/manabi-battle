# アイテム1つずつの 強さを はかる（対戦 3問×5ターン。A＝そのアイテム＋ふつうの手、B＝ふつうの手）（10/13）
# 使い方: python3 tools/item_balance.py [回数]
import pathlib, sys, json
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
N = int(sys.argv[1]) if len(sys.argv) > 1 else 1500
S5 = ['国語', '算数', '理科', '社会', '英語']
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); pg.wait_for_timeout(100)
    names = pg.evaluate('MB.D.ITEMS.map(i => [i.n, i.r])')
    st = {'国語': 900, '算数': 700, '理科': 600, '社会': 500, '英語': 800}
    # くらべる 手：ランダムな 3個（アイテムなしの 子は いない ため）。A は そのアイテム＋2個
    base = pg.evaluate('([st,n]) => MB.simVs({stA: st, stB: st, n, itemsA: () => MB.simHand(6, 3), itemsB: () => MB.simHand(6, 3)}).win', [st, N])
    rows = []
    for n, r in names:
        w = pg.evaluate('([st,n,it]) => MB.simVs({stA: st, stB: st, n, itemsA: () => [it, ...MB.simHand(6, 3).filter(x => x !== it).slice(0, 2)], itemsB: () => MB.simHand(6, 3)}).win', [st, N, n])
        rows.append((w, n, r)); print(f'{w*100:5.1f}%  ★{r} {n}', flush=True)
    b.close()
print('基準（ランダム3個どうし）', f'{base*100:.1f}%')
rows.sort(reverse=True)
print('強い:', [(n, f'{w*100:.0f}%') for w, n, r in rows[:12]])
print('弱い:', [(n, f'{w*100:.0f}%') for w, n, r in rows[-12:]])
print('errors:', errors[:5] or 'なし')
