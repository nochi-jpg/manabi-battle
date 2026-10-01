# まなびバトル QRコード・対戦モードのテスト（Playwright）
# 使い方: python3 tools/vs_test.py
import pathlib, random
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools/play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
TMP = pathlib.Path(__file__).with_name('_qr.png')
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

def player(b, pn, cn, runs, acc):
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL)
    pg.fill('#pn', pn); pg.fill('#cn', cn); pg.click('#go')
    for _ in range(runs):
        pg.click('#dun'); pg.wait_for_timeout(50); pg.click('.ov .choices button')
        for _ in range(4000):
            if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
            pg.evaluate(BOT, acc); pg.wait_for_timeout(25)
    pg.evaluate("MB.S.owned.push('どくキバ','木の盾','たこあげ','おにぎり','ねらいのメガネ')")
    return ctx, pg

with sync_playwright() as p:
    b = p.chromium.launch()
    ctxA, A = player(b, 'あおい', 'ピコ', 2, 0.8)
    ctxB, B = player(b, 'けんた', 'ガオ', 2, 0.6)

    # QRの中身：作って読むと同じになる
    rt = A.evaluate("(() => { const o = SAVECODE.decode(MB.qrBytes()); const S = MB.S; return { n: MB.qrBytes().length, st: JSON.stringify(o.st) === JSON.stringify(S.st), qs: JSON.stringify(o.qs) === JSON.stringify(Object.fromEntries(Object.entries(S.qs).sort((a,b)=>a[0]-b[0]))), owned: o.owned.length === S.owned.length, name: o.pname === S.pname && o.cname === S.cname, coins: o.coins === S.coins }; })()")
    check(all(v for k, v in rt.items() if k != 'n'), f'QRの中身が元どおり {rt}')
    bad = A.evaluate("(() => { const b = MB.qrBytes(); b[10] ^= 1; try { SAVECODE.decode(b); return 'よめた'; } catch (e) { return e.message; } })()")
    check('書きかえ' in bad, f'書きかえたQRは読めない（{bad}）')

    # QR画面の画像 → 画像ファイルから読みこみ
    A.click('#b4'); A.wait_for_timeout(200)
    data = A.evaluate("document.querySelector('#qrc').toDataURL('image/png')")
    import base64; TMP.write_bytes(base64.b64decode(data.split(',')[1]))
    A.click('#bk'); A.wait_for_timeout(100)
    bytesB = B.evaluate("MB.qrBytes()")

    # 対戦：A は画像ファイル、B はテスト用の入口で読みこむ
    A.click('#vs'); A.wait_for_timeout(200)
    A.set_input_files('#fi', str(TMP)); A.wait_for_timeout(500)
    check(A.evaluate("MB.VS && MB.VS.phase") == 'scanB', '画像ファイルからQRを読めた')
    A.evaluate(f"MB.scan({bytesB})"); A.wait_for_timeout(200)
    check('けんた' in A.inner_text('.ov'), 'Bも読めた（確認画面）')
    A.click('.ov .choices button')
    reloads = 0
    def play(until, n=6000, reload=0.0):
        global reloads
        for _ in range(n):
            if A.evaluate(until): return True
            if reload and random.random() < reload and A.evaluate("MB.VS && MB.VS.phase === 'battle'"):
                A.reload(); A.wait_for_timeout(80)
                if A.query_selector('#go'): A.click('#go'); A.wait_for_timeout(80)
                A.click('#vs'); A.wait_for_timeout(80); A.click('.ov .choices button'); reloads += 1; continue
            if A.query_selector('#ok') and not A.query_selector('.ov'):
                if len(A.query_selector_all('.bk.sel')) < 2: A.click('.bk:not(.none):not(.sel)')
                else: A.click('#ok')
                A.wait_for_timeout(30); continue
            if A.evaluate("document.body.innerText.includes('画面を見てください')") and not A.query_selector('.ov'):
                A.click('.scr'); A.wait_for_timeout(30); continue
            A.evaluate(BOT, 0.7); A.wait_for_timeout(25)
        return False
    ok = play("MB.VS && MB.VS.phase === 'end'", reload=0.03)
    check(ok, f'対戦が最後まで進んだ（とちゅうで再読みこみ {reloads}回）')
    res = A.evaluate("MB.VS.result")
    check(res in ('P', 'B', 'draw'), f'勝敗 {res}')
    picks = A.evaluate("MB.VS.picks")
    # 再戦 → 前のそうびが最初から入っている
    A.wait_for_timeout(300); A.click('.ov .choices button'); A.wait_for_timeout(200)
    A.click('.scr'); A.wait_for_timeout(200)
    sel = A.evaluate("[...document.querySelectorAll('.bk.sel')].map(e=>e.dataset.n)")
    check(len(picks['a']) == 2 and sorted(set(sel)) == sorted(set(picks['a'])), f'再戦は前のそうびが入っている {picks["a"]}')
    play("MB.VS && MB.VS.phase === 'end'")
    A.wait_for_timeout(300)
    btns = A.query_selector_all('.ov .choices button'); btns[1].click(); A.wait_for_timeout(200)
    check(A.evaluate("localStorage.getItem('manabi_battle_vs') === null") and A.query_selector('#dun') is not None, 'タイトルにもどる → 対戦のデータは消える')
    b.close()
TMP.unlink(missing_ok=True)
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
