# まなびバトル ごはん・せいかく・すがた／称号・背景・名前の変更／デバッグ全開放 のテスト（Playwright）
# 使い方: python3 tools/feed_test.py
import pathlib, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test&feed'
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true')
    W = pg.wait_for_timeout
    pg.goto(URL)
    check('いやな気もち' in pg.inner_text('body'), '名前を決める画面に 名前のルールの ひとこと')
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(150)
    S = lambda k: pg.evaluate(f'MB.S.{k}')

    # ---- ごはん ----
    check('ごはんの時間' in pg.inner_text('.ov'), 'はじめて開くと ごはん')
    check(S('seikaku') == 1000, 'せいかくの はじめは 1000')
    pg.click('.ov .choices button:has-text("キャンディ")'); W(100)
    check(S('seikaku') == 800 and 'やさしい性格' in pg.inner_text('.ov'), 'キャンディで −200 → やさしい性格')
    pg.click('.ov button'); W(100)
    check(pg.locator('.ov').count() == 0, '1日1回だけ（もう出ない）')
    pg.evaluate("void MB.go.home()"); W(100)
    check(pg.locator('.ov').count() == 0, 'ホームにもどっても もう出ない')
    check('やさしい性格' in pg.inner_text('#app'), 'ホームに せいかくが出る')
    def feed(kind):
        pg.evaluate("MB.S.fedDay = '2000-01-01'"); pg.evaluate("void MB.go.home()"); W(100)
        pg.click(f'.ov .choices button:has-text("{kind}")'); W(100)
        t = pg.inner_text('.ov'); pg.click('.ov button'); W(100); return t
    for _ in range(5): feed('キャンディ')
    check(S('seikaku') == 0, 'さいていは 0')
    t = feed('キャンディ')
    check(S('seikaku') == 0 and 'かわらなかった' not in t or S('seikaku') == 0, '0でも キャンディは あげられる（何もおこらない）')
    names = pg.evaluate("[0,1,200,201,400,600,800,1000,1001,1200,1400,1600,1800,1801,2000].map(v=>{MB.S.seikaku=v; MB.go.home(); return document.querySelector('#app').innerText.match(/🍽️ (\\S+性格)/)[1]})")
    check(names == ['高貴で高潔な性格', '気品のある性格', '気品のある性格', '上品な性格', '上品な性格', 'おしとやかな性格', 'やさしい性格', 'おだやかな性格', 'げんきな性格', 'げんきな性格', 'かちきな性格', '勇気のある性格', '英雄的な性格', '英雄的で高潔な性格', '英雄的で高潔な性格'], f'せいかくの名前 {names}')
    pg.evaluate("MB.S.seikaku = 1800")
    feed('肉'); feed('肉')
    check(S('seikaku') == 2000, 'さいこうは 2000')

    # ---- すがた：単細胞 → 第1〜第3段階。どの段階でも せいかくで すぐ かわる（10/13）----
    # 画像があれば そのファイル名、なければ 絵文字
    look = "(e=>{const i=e.querySelector('img');return i?i.getAttribute('src').split('/').pop():e.innerText.trim()})(document.querySelector('#me'))"
    pg.evaluate("MB.S.seikaku = 0; MB.S.style='cute'; MB.S.styleStg=0; MB.go.home()"); W(50)
    l0 = pg.evaluate(look)
    pg.evaluate("MB.S.seikaku = 2000; MB.go.home()"); W(50)
    check(pg.evaluate(look) == l0 and l0 in ('🦠', 'tansaibou.png'), f'単細胞（第0段階）：せいかくが かわっても 同じ（{l0}）')
    # さいしょの ダンジョンの リザルトで 第1段階へ（かっこいい系で 進化）（10/8）
    pg.evaluate("MB.S.stamina=100")
    pg.click('#dun'); W(50); pg.click('.ov .choices button'); W(200)
    BOT = (ROOT / 'tools' / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
    for _ in range(15000):
        if pg.evaluate("!!document.querySelector('#evt') && /進化/.test(document.querySelector('#evt').innerText)"): break
        pg.evaluate(BOT, 0.9); W(15)
    check('は 進化した！' in pg.inner_text('#evt') and '系' not in pg.inner_text('#evt'), f'さいしょの ダンジョンで「○○は 進化した！」（系の名前は 出さない）（{pg.inner_text("#evt")[:30]}）')
    for _ in range(3000):
        if pg.evaluate("!!document.querySelector('#dun') && !document.querySelector('.ov')"): break
        pg.evaluate(BOT, 0.9); W(15)
    l1 = pg.evaluate(look)
    check(l1 != l0 and 'cool_1' in l1 or l1 in ('🐥', '🐊', '🦐', '🌿', '🐦', '🐈‍⬛'), f'第1段階・かっこいい系（{l1}）')
    # どの段階でも せいかくが かわると すぐ すがたが かわる（10/13）
    pg.evaluate("MB.S.seikaku = 0; MB.go.home()"); W(50)
    l1c = pg.evaluate(look)
    check(l1c != l1 and ('cute_1' in l1c or not l1c.endswith('.png')), f'第1段階：せいかくを かわいい側にすると すぐ かわいい系（{l1}→{l1c}）')
    # 第3段階が 最終（LOOK_LINE は 2つ）
    pg.evaluate("(()=>{const v=Math.round(MB.D.K.LOOK_LINE[1]/5)+400; MB.S.st = {国語:v,算数:v,理科:v,社会:v,英語:v}; MB.S.seikaku = 1000; MB.go.home()})()"); W(50)
    check(pg.evaluate("MB.D.K.LOOK_LINE.length") == 2 and pg.evaluate("MB.T.lookStage(Object.values(MB.S.st).reduce((a,b)=>a+b))") == 3 and '進化は さいごまで できた' in pg.inner_text('#app'), '第3段階が 最終進化')
    cute3 = pg.evaluate(look)
    t = feed('肉')
    cool3 = pg.evaluate("void MB.go.home()") or pg.evaluate(look)
    check(cute3 != cool3 and '姿が変わった' in t, f'第3段階：ごはんで すぐ すがたが かわる（{cute3}→{cool3}）')
    q = pg.evaluate("(()=>{const o=SAVECODE.decode(MB.qrBytes());return [o.seikaku,o.style]})()")
    check(q[0] == 1200, f'QRに せいかく {q}')

    # ---- せってい：称号・背景・名前 ----
    pg.evaluate("MB.S.ach = {}; MB.S.ach['solved1'] = '2026-01-01'; MB.S.sel.title=''; MB.go.home()"); W(50)
    pg.click('#set'); W(50)
    check(pg.locator('#sT').count() == 1 and pg.locator('#sB').count() == 1 and pg.locator('#sN').count() == 1, 'せっていに 称号・背景・名前のボタン')
    pg.click('#sT'); W(100)
    check(pg.locator('.ttl[data-t="見習いまほうつかい"]').count() == 1, '称号：手に入れたものは 名前が出る')
    check(pg.locator('.ttl.lock').count() > 5 and '？？？' in pg.inner_text('.ttl.lock >> nth=0'), '称号：まだのものは ？？？')
    pg.click('.ttl.lock >> nth=0'); W(100)
    check('手に入れかた' in pg.inner_text('.ov'), '称号：？？？をタップすると 手に入れかた'); pg.click('.ov button'); W(50)
    pg.click('.ttl[data-t="見習いまほうつかい"]'); W(50)
    check(pg.evaluate('MB.S.sel.title') == '見習いまほうつかい', '称号を えらべる')
    pg.click('#bk'); W(100); pg.click('#sB'); W(100)
    nb = pg.evaluate("1 + MB.D.ACH.filter(a => MB.S.ach[a.id] && a.r.bg).length")
    check(pg.locator('.bgc:not(.lock)').count() == nb and pg.locator('.bgc.lock').count() == pg.evaluate("Object.keys(MB.D.BGS).length") - nb, f'背景：まなびタウンと 手に入れた背景（{nb}）だけ。ほかは ？？？')
    pg.click('.bgc.lock >> nth=0'); W(100)
    check('手に入れかた' in pg.inner_text('.ov'), '背景：？？？をタップすると 手に入れかた'); pg.click('.ov button'); W(50)
    pg.click('#bk'); W(100); pg.click('#sN'); W(100)
    check('いやな気もち' in pg.inner_text('.ov'), '名前をかえる：ルールの ひとこと')
    pg.fill('#nn', ''); pg.click('#ok'); W(50)
    check(pg.locator('#nn').count() == 1, '空の名前は だめ')
    pg.fill('#nn', 'ピカリン'); pg.click('#ok'); W(100)
    check(S('cname') == 'ピカリン' and S('pname') == 'テスト', 'モンスターの名前だけ かわる')

    # ---- デバッグ：称号・アチーブメント・背景 全開放 ----
    pg.evaluate("MB.S.debug = { on: true, bak: {} }; MB.go.home()"); W(50)
    ach0 = pg.evaluate("JSON.stringify(MB.S.ach)")
    for k in ['titles', 'bgs']:
        pg.click('#set'); W(50); pg.click(f'[data-dbg="{k}"]'); W(100); pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    pg.click('#set'); W(50); pg.click('#sT'); W(100)
    check(pg.locator('.ttl.lock').count() == 0, 'デバッグ：称号 全開放')
    pg.click('#bk'); W(100); pg.click('#sB'); W(100)
    check(pg.locator('.bgc.lock').count() == 0, 'デバッグ：背景 全開放')
    check(pg.evaluate("JSON.stringify(MB.S.ach)") == ach0, 'デバッグ：称号・背景の全開放は アチーブメントを書きかえない')
    pg.evaluate("void MB.go.home()"); W(50)
    pg.click('#set'); W(50); pg.click('[data-dbg="ach"]'); W(100); pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    check(pg.evaluate("Object.keys(MB.S.ach).length") == pg.evaluate("MB.D.ACH.length"), 'デバッグ：アチーブメント 全開放')
    pg.click('#set'); W(50); pg.click('[data-dbg="ach"]'); W(100); pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    check(pg.evaluate("JSON.stringify(MB.S.ach)") == ach0, 'デバッグ：アチーブメント 全開放を オフで もとにもどる')
    b.close()

print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
