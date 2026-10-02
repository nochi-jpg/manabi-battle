# 称号の色・限定の隠し称号（デバッグのスイッチ・QR・称号えらび・対戦の表示）のテスト（Playwright）
# 使い方: python3 tools/title_test.py [スクショの出力フォルダ]
import pathlib, sys, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '?test'
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e))); pg.add_init_script('window.FAST = true'); pg.goto(URL)
    W = pg.wait_for_timeout
    pg.fill('#pn', 'あおい'); pg.fill('#cn', 'ポチ'); pg.click('#go'); W(150)
    close = "document.querySelectorAll('#app > .ov').forEach(o=>o.remove())"
    # 色の分けかた
    rk = pg.evaluate("['バトル部員','算数の塔 見習い','火ハンター','まなびの鬼','国語の塔 制覇','伝説の部員','👑大会の覇者'].map(t=>{const e=document.createElement('div');e.innerHTML=MB.go.titleBadge(t);return e.firstChild.className})")
    check('tr-white' in rk[0] and 'tr-subj' in rk[1] and 'tr-subj' in rk[2] and 'tr-gold' in rk[3] and 'tr-gold' in rk[4] and 'tr-gold' in rk[5] and 'tr-rainbow' in rk[6], f'称号の色 {rk}')
    # 限定称号：デバッグでオン → 称号リストの いちばん下に出る → デバッグを終わっても のこる
    pg.click('#set'); W(100); pg.click('#sT'); W(150)
    check('限定' not in pg.inner_text('#app') and '大会の覇者' not in pg.inner_text('#app'), '持っていないときは 称号リストに 出ない（？？？にもならない）')
    pg.evaluate("MB.S.debug = { on: true, bak: {} }"); pg.evaluate("void MB.go.home()"); pg.evaluate(close); W(80)
    pg.click('#set'); W(100); pg.click('[data-hid="👑大会の覇者"]'); W(150)
    check(pg.evaluate("MB.S.hidden") == ['👑大会の覇者'], 'スイッチで 限定称号を つける')
    pg.evaluate(close); pg.click('#set'); W(100); pg.click('#dbx'); W(150)
    check(pg.evaluate("MB.S.debug") is None and pg.evaluate("MB.S.hidden") == ['👑大会の覇者'], 'デバッグモードを終わっても 限定称号は のこる')
    pg.evaluate(close); pg.click('#set'); W(100); pg.click('#sT'); W(150)
    rows = pg.evaluate("[...document.querySelectorAll('.qrow.ttl')].map(r=>r.innerText.trim())")
    check(rows[-1].endswith('大会の覇者】') and not any('グランド' in r for r in rows), f'称号リストの いちばん下に 手に入れた物だけ（{rows[-1]}）')
    pg.click('.qrow.ttl >> nth=-1'); W(100)
    check(pg.evaluate("MB.S.sel.title") == '👑大会の覇者', '限定称号を つけられる')
    if OUT: pg.screenshot(path=str(OUT / 'title_list.png'))
    # QR で 引きつぐ
    q = pg.evaluate("(()=>{const o=SAVECODE.decode(MB.qrBytes());return [o.hidden,o.sel.title]})()")
    check(q == [['👑大会の覇者'], '👑大会の覇者'], f'QRに 限定称号 {q}')
    # 対戦：いちばん長い称号でも 1行・はみ出さない
    pg.evaluate("void MB.go.home()"); pg.evaluate(close); W(80)
    longest = pg.evaluate("[...MB.D.ACH.filter(a=>a.r.t).map(a=>a.r.t), ...MB.D.HIDDEN_TITLES].sort((a,b)=>[...b].length-[...a].length)[0]")
    pg.evaluate("MB.S.hidden=['👑大会の覇者','👑グランドモンスター']; MB.S.sel.title='👑グランドモンスター'")
    bA = pg.evaluate("MB.qrBytes()")
    bB = pg.evaluate(f"(()=>{{const S=MB.S,p=S.pname,c=S.cname,t=S.sel.title;S.pname='けんた';S.cname='ガオ';S.sel.title={json.dumps(longest)};const b=MB.qrBytes();S.pname=p;S.cname=c;S.sel.title=t;return b}})()")
    pg.click('#vs'); W(300); pg.evaluate(f"MB.scan({bA})"); W(200); pg.evaluate(f"MB.scan({bB})"); W(300); pg.click('.ov .choices button'); W(200)
    for _ in range(400):
        if pg.query_selector('.fighter .ttlb'): break
        if pg.query_selector('#ok') and not pg.query_selector('#app > .ov'): pg.click('#ok'); W(60); continue
        if pg.query_selector('#app > .ov .choices button'): pg.click('#app > .ov .choices button'); W(60); continue
        if pg.evaluate("document.body.innerText.includes('画面を見てください')"): pg.click('.scr'); W(60); continue
        W(40)
    W(200); pg.evaluate("document.querySelectorAll('#app > .ov').forEach(o=>o.style.display='none')"); W(200)
    m = pg.evaluate("""[...document.querySelectorAll('.fighter')].map(f=>{const t=f.querySelector('.ttlb'),n=f.querySelector('.nm'),e=f.querySelector('.emo');const r=t.getBoundingClientRect(),fr=f.getBoundingClientRect(),nr=n.getBoundingClientRect();
      return {t:t.innerText, lines:Math.round(r.height/parseFloat(getComputedStyle(t).lineHeight)), inside:r.left>=fr.left&&r.right<=fr.right, above:r.bottom<=nr.top+1}})""")
    check(all(x['lines'] == 1 and x['inside'] and x['above'] for x in m), f'対戦：称号は 名前の上に 1行（いちばん長い「{longest}」も） {m}')
    if OUT: pg.screenshot(path=str(OUT / 'title_vs.png'))
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
