# ver 3.0.0 のテスト：技は4つまで・QR形式4（前の形式3は 引きつぎだけ・対戦は ことわる）・あいことば
import pathlib, subprocess
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
# 形式3（2.0.x）の savecode.js：形式3の QR を 作るため
OLD = subprocess.run(['git', 'show', 'dabfb30:savecode.js'], cwd=ROOT, capture_output=True, text=True).stdout.replace('window.SAVECODE =', 'window.OLDCODE =', 1)
BOT = (pathlib.Path(__file__).resolve().parent / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(200)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    # ---- 技 ----
    pg.evaluate("MB.S.st = {国語:300,算数:300,理科:300,社会:300,英語:300}; MB.S.dungeons = 3; void MB.go.home()"); W(150)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())"); pg.click('#grow'); W(200)
    check(pg.locator('.skp-b.on').count() == 3, f"おぼえた技が4つ以下なら ぜんぶ オン（{pg.locator('.skp-b.on').count()}）")
    pg.click('.skp-b[data-k="通常攻撃"]'); W(80)
    check(pg.locator('.skp-b.on').count() == 3, '4つ以下の あいだは オフに できない')
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.S.st = {国語:2000,算数:1200,理科:1200,社会:1200,英語:1200}; MB.S.skSel = null; void MB.go.home()"); W(150)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())"); pg.click('#grow'); W(200)
    check(pg.locator('.skp-b.on').count() == 4, 'えらんでいなければ おぼえた順に 4つ')
    tp = pg.evaluate("(() => { document.querySelector('.skp-b[data-k=\"パワーシュート\"]').click(); const t = document.querySelector('.tip'); return t ? t.innerText : ''; })()"); W(80)
    check(pg.locator('.skp-b.on').count() == 4 and '選べる技は4つまでだよ！' in tp, f'5つ目は「選べる技は4つまでだよ！」（{tp}）')
    pg.click('.skp-b[data-k="ガードバッシュ"]'); pg.click('.skp-b[data-k="パワーシュート"]'); W(80)
    sel = pg.evaluate("MB.S.skSel")
    check(sel == ['通常攻撃', '連続攻撃', 'ドレイン', 'パワーシュート'], f'その場で オン・オフして セーブ {sel}')
    # ボス戦：自分は 4つ・ボスは ぜんぶ
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); void MB.T.trial([], [], '算数')"); W(800)
    sk = pg.evaluate("[MB.BT.P.skills, MB.BT.B.skills.length]")
    check(sorted(sk[0]) == sorted(sel) and sk[1] == 8, f'ボス戦：自分は えらんだ4つ・ボスは 8つ {sk}')
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); void MB.go.home()"); W(200)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    # アイテムえらびの スキルタブ（この たたかい だけ）
    pg.evaluate("void MB.go.pickItems(MB.S, [], {noTimer:true}).then(v => window.__pk = [v, MB.go.pickItems.sk])"); W(200)
    pg.click('.pk-tabs [data-v="skill"]'); W(150)
    pg.click('.skp-b[data-k="ドレイン"]'); pg.click('.skp-b[data-k="かんつう"]'); W(50); pg.click('#ok'); W(150)
    pk = pg.evaluate("window.__pk")
    check(pk and 'かんつう' in pk[1] and 'ドレイン' not in pk[1] and pg.evaluate("MB.S.skSel").count('ドレイン') == 1, f'アイテムえらびの スキルタブで かえられる（セーブは そのまま）{pk}')
    # ---- QR 形式4 ----
    pg.evaluate("MB.S.ak = [3, 22]; MB.S.sel.title = MB.D.AK_TITLES[2]")
    o = pg.evaluate("(() => { const o = SAVECODE.decode(MB.qrBytes()); return [o.fmt, o.skSel, o.ak, o.sel.title]; })()")
    check(o[0] == 4 and o[1] == ['通常攻撃', '連続攻撃', 'ドレイン', 'パワーシュート'] and o[2] == [3, 22] and o[3] == '古墳の守り人', f'QR形式4に 技・あいことば・称号 {o}')
    pg.add_script_tag(content=OLD)
    old = pg.evaluate("Array.from(OLDCODE.encode(MB.S, Object.keys(MB.Q).length))")
    check(pg.evaluate(f"SAVECODE.decode({old}).fmt") == 3, '形式3の QRも 読める（引きつぎ用）')
    nw = pg.evaluate("MB.qrBytes()")
    msg = pg.evaluate(f"(() => {{ try {{ OLDCODE.decode({nw}); return 'よめた'; }} catch (e) {{ return e.message; }} }})()")
    check('新しいバージョン' in msg, f'前の ゲームは 新しい QRを 読まない（{msg}）')
    # 対戦は 形式3を ことわる
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); void MB.go.home()"); W(150)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())"); pg.click('#vs'); W(300)
    pg.evaluate(f"MB.scan({old})"); W(200)
    check('前のバージョン' in pg.inner_text('.ov') and pg.evaluate("MB.VS.phase") == 'scanB', '対戦：前の バージョンの QRは ことわる')
    pg.evaluate(f"MB.scan({nw})"); W(200)
    check('はじめる' in pg.inner_text('.ov'), '対戦：新しい QRは 読める')
    # ---- あいことば ----
    pg.evaluate("localStorage.removeItem('manabi_battle_vs'); document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.S.ak = []; MB.S.sel.title=''; MB.S.coins = 0; void MB.go.home()"); W(150)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    pg.click('#set'); W(200)
    n = pg.locator('.setbtns button').count()
    check(n == 8, f'せっていの ボタンは 8つ（4×2）{n}')
    pg.click('#sK'); W(200)
    pg.fill('#akin', 'でたらめ'); pg.click('#akok'); W(100)
    check('ちがうみたい' in pg.inner_text('#akm'), 'まちがいは「あいことばが ちがうみたい」')
    pg.fill('#akin', ' カイヅカ・のしょうじょ '); pg.click('#akok'); W(300)
    txt = pg.inner_text('.ov')
    check('550' in txt and '縄文のむらびと' in txt and pg.evaluate("MB.S.coins") == 550 and pg.evaluate("MB.S.ak") == [1], f'正しい あいことば → 550コイン・称号（カタカナ・空白・「・」も OK）')
    pg.click('.ov .choices button'); W(300)
    check(pg.evaluate("MB.S.sel.title") == '縄文のむらびと', '称号を つける')
    pg.fill('#akin', 'かいづかのしょうじょ'); pg.click('#akok'); W(100)
    check('もう つかった' in pg.inner_text('#akm') and pg.evaluate("MB.S.coins") == 550, '2回目は「もう つかったよ」')
    pg.fill('#akin', 'おかえりかなた'); pg.click('#akok'); W(300)
    check(pg.evaluate("MB.S.coins") == 2602 and '2052' in pg.inner_text('.ov'), '22話は 2052コイン')
    pg.click('.ov .choices button >> nth=1'); W(300)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); void MB.go.titlePage(() => MB.go.home())"); W(200)
    t = pg.inner_text('#app')
    check('ひみつの称号' in t and '時をめぐる帰還者' in t and '古墳の守り人' not in t, '称号の一覧には もらったものだけ')
    # ---- 時を超える銀時計 ----
    clk = pg.evaluate("MB.D.CLOCK")
    check(clk in pg.evaluate("MB.S.owned") and pg.evaluate("MB.S.coins") == 550 + 2052, '22話で 銀時計も もらえる（コインは 表のとおり）')
    o4 = pg.evaluate("SAVECODE.decode(MB.qrBytes()).owned")
    check(clk in o4, 'QRに 銀時計も 入る')
    pg.evaluate("MB.S.owned = MB.S.owned.filter(n => n !== MB.D.CLOCK); localStorage.setItem('manabi_battle_book', JSON.stringify({view:'icon',sort:'rare'})); void MB.go.itemBook()"); W(200)
    check(pg.locator(f'.bk[data-n="{clk}"]').count() == 0 and '/ 100' in pg.inner_text('.prog'), 'もっていないと もちものに 出ない（？？？にも しない）')
    pg.evaluate("MB.S.owned = MB.D.ITEMS.map(i => i.n); void MB.go.itemBook()"); W(200)
    check(pg.locator(f'.bk[data-n="{clk}"]').count() == 1 and '101 / 100' in pg.inner_text('.prog'), f"もったら ★5に 出る・コンプ後は 101 / 100（{pg.inner_text('.prog')[:20]}）")
    pool = pg.evaluate("MB.S.gachaN = 0; MB.D.ITEMS.filter(it => !it.hid).length")
    check(pool == 100, 'ふつうの アイテムは 100個のまま')
    pg.evaluate("void MB.go.pickItems(MB.S, [], {noTimer:true})"); W(200)
    check(pg.locator(f'.bk[data-n="{clk}"]').count() == 1, 'アイテムえらびに 出る（持っているとき）')
    pg.click('#ok'); W(100)
    # 6ターン目：自分だけ 持っている → ルーレットなし・ボスは 動けない
    pg.evaluate(f"document.querySelectorAll('.ov').forEach(o=>o.remove()); void MB.T.trial(['{clk}'], [], '算数')"); W(600)
    pg.evaluate("MB.BT.P.hp = MB.BT.P.maxhp = 999999; MB.BT.B.hp = MB.BT.B.maxhp = 999999; window.__lg = ''; new MutationObserver(() => { if (/はざま/.test(document.body.innerText)) window.__lg = 'frozen'; }).observe(document.body, {subtree:true, childList:true, characterData:true})")
    log = ''
    for i in range(4000):
        st = pg.evaluate("(() => { const t = document.querySelector('#turn'); return [MB.BT ? MB.BT.turn : 0, MB.BT ? MB.BT.phase : '', t ? t.textContent : '', document.querySelector('#log') ? document.querySelector('#log').innerText : ''] })()")
        if '6 / 5' in st[2]: log = 'saw6'
        if st[1] == 'end' or (st[0] == 0): break
        pg.evaluate(BOT, 1.0); W(20)
    log += pg.evaluate("window.__lg")
    check('saw6' in log and 'frozen' in log, f'6ターン目「6 / 5」・相手は 動けない（{log}）')
    # 前の 形式3から 引きつぐと 技・あいことばは からっぽ
    o3 = pg.evaluate(f"(() => {{ const o = SAVECODE.decode({old}); return [o.skSel, o.ak]; }})()")
    check(o3 == [[], []], f'形式3から 引きつぐと 技は おぼえた順・あいことばは なし {o3}')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
