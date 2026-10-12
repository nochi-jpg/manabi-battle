# ログインボーナス（通算・7日で1しゅう）と かくしコマンド（バージョン10回タップ → QRで 復元）のテスト
# 使い方: python3 tools/login_test.py
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test&login'
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(300)
    S = lambda k: pg.evaluate(f'MB.S.{k}')
    c0 = S('coins')
    check(pg.locator('#lbok').count() == 1 and pg.evaluate("document.querySelector('.lb-n').textContent.replace(/\\s/g,'')") == '通算ログイン1日目', '1日目：ログインボーナスが出る')
    check(S('loginN') == 1 and '10 ゲット' in pg.inner_text('.lb-msg'), '1日目：コイン +10')

    check(pg.locator('.lb-c').count() == 7 and len(set(pg.evaluate("[...document.querySelectorAll('.lb-c')].map(e=>e.offsetWidth+'x'+e.offsetHeight)"))) == 1, '7まいの カードは 同じ大きさ')
    check('いつも がんばってるね' in pg.inner_text('.lb-say'), 'こくうさ「いつも がんばってるね」')
    pg.click('#lbok'); W(200)
    check(S('coins') == c0, 'OKで コインは そのまま（もう 入っている）')
    check(pg.locator('#lbok').count() == 0, 'きょうは もう出ない')
    pg.evaluate("void MB.go.home()"); W(200)
    check(pg.locator('#lbok').count() == 0, 'ホームに もどっても 出ない')
    def day():
        pg.evaluate("MB.S.loginDay = 'x'; MB.go.home()"); W(250)
    c1 = S('coins'); day()
    check(S('coins') == c1 + 10, '2日目：コイン +10'); pg.click('#lbok'); W(150)
    for n in range(3, 6): day(); pg.click('#lbok'); W(150)
    c5 = S('coins'); day()
    check(S('coins') == c5 + 150 and S('loginN') == 6, '6日目：コイン +150')
    pg.click('#lbok'); W(150)
    o5 = S('owned.length'); day()
    check(S('loginPend') and len(S('loginPend')) == 3, '7日目：アイテム 3つ（まだ えらんでいない）')
    pg.click('#lbok'); W(200)
    check(pg.locator('.ov .cards button').count() == 3, '7日目：3つから えらぶ')
    pg.reload(); W(300); pg.click('#go'); W(300)
    check(pg.locator('.ov .cards button').count() == 3, 'とちゅうで 閉じても もう一度 えらべる')
    pg.click('.ov .cards button >> nth=0'); W(200)
    pg.evaluate("document.querySelectorAll('.ov #cl').forEach(b=>b.click())"); W(200)
    check(not S('loginPend') and (S('owned.length') == o5 + 1 or S('bonusPt') >= 5), '7日目：アイテムを もらえた（持っていたら ボーナス+5）')
    day()
    check(S('loginN') == 8 and '8日目' in pg.inner_text('.lb-c.now') and S('coins') > 0, '8日目：1日目に もどる（表記は 8日目）')
    pg.click('#lbok'); W(150)
    q = pg.evaluate("(()=>{const o=SAVECODE.decode(MB.qrBytes());return [o.loginN,o.loginDay===o.day]})()")
    check(q == [8, True], f'QRに ログイン日数 {q}')
    # ---- かくしコマンド ----
    qr = pg.evaluate("MB.qrBytes()")
    pg.evaluate("MB.S.pname='べつの子'; MB.S.loginN=1; localStorage.setItem(MB.SAVE_KEY, JSON.stringify(MB.S))")
    pg.goto(URL.replace('&login', '')); W(300)
    for i in range(9): pg.click('#ver')
    check(pg.locator('.rst').count() == 0, '9回では 出ない')
    pg.click('#ver'); W(200)
    check(pg.locator('.rst').count() == 1 and 'やり直せません' in pg.inner_text('.rst') and pg.evaluate("MB.snd()") is None, '10回で 真っ白の 確認画面（BGMなし）')
    pg.click('#rsx'); W(200)
    check(pg.locator('#ver').count() == 1, 'タイトルに戻る')
    for i in range(10): pg.click('#ver')
    pg.click('#rs1'); W(200)
    check(pg.locator('#rsc').count() == 1 and pg.locator('#rsi').count() == 1 and pg.locator('#rsx').count() == 1, 'カメラ・画像・タイトル の 3つ')
    pg.evaluate(f"void MB.restore(new Uint8Array({qr}))"); W(200)
    check('復元しますか' in pg.inner_text('.ov'), '読みこんだら 確認')
    pg.click('.ov button:has-text("復元する")'); W(200)
    pg.click('.ov button'); W(300)
    check(S('pname') == 'テスト' and S('loginN') == 8 and pg.locator('#ver').count() == 1, '復元して タイトルへ')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
