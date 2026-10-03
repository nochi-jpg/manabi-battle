# まなびバトル とうぎじょう：QRゴースト（友だちのQRのモンスターと CPU戦）のテスト（Playwright）
# 使い方: python3 tools/ghost_test.py
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
    pg.fill('#pn', 'あおい'); pg.fill('#cn', 'ピコ'); pg.click('#go'); pg.wait_for_timeout(100)
    pg.evaluate("MB.S.owned = ['木の盾','どくキバ','おにぎり']; MB.S.fav = ['木の盾']")
    # 友だちのQR：算数は ぜんぶ卒業、国語は あと1回、理科は 復習待ち。おきにいり 2つ
    friend = pg.evaluate("""(()=>{const S=MB.S, bak=JSON.stringify(S), ids=s=>Object.keys(MB.Q).filter(id=>MB.Q[id].s===s).slice(0,30);
      S.pname='けんた'; S.cname='ガオ'; S.st={国語:150,算数:400,理科:150,社会:150,英語:150}; S.owned=['どくキバ','ねらいのメガネ','おにぎり','たこ焼き']; S.fav=['どくキバ','ねらいのメガネ'];
      S.qs={}; ids('算数').forEach(id=>S.qs[id]=4); ids('国語').forEach(id=>S.qs[id]=3); ids('理科').forEach(id=>S.qs[id]=2);
      const b=MB.qrBytes(); Object.assign(S, JSON.parse(bak)); return b})()""")
    nofav = pg.evaluate("""(()=>{const S=MB.S, bak=JSON.stringify(S); S.pname='ゆい'; S.cname='ミミ'; S.owned=['木の盾','たこ焼き']; S.fav=[]; const b=MB.qrBytes(); Object.assign(S, JSON.parse(bak)); return b})()""")
    before = pg.evaluate("JSON.stringify({c:MB.S.coins,st:MB.S.st,qs:MB.S.qs,o:MB.S.owned,s:MB.S.stamina})")

    pg.click('#tri'); pg.wait_for_timeout(100)
    check(pg.locator('#aT').count() == 1 and pg.locator('#aG').count() == 1, 'とうぎじょう：おためしバトル と QRゴースト')
    pg.click('#aG'); pg.wait_for_timeout(100)
    pg.evaluate(f"MB.scan({friend})"); pg.wait_for_timeout(100)
    t = pg.inner_text('.ov')
    check('けんた' in t and 'せいかく' in t and '算数 400' in t and '%' not in t and 'そうび' not in t, '読みこみの かくにん：せいかく と ステータスだけ（正解率・そうびは 出さない）')
    pg.click('.ov .choices button'); pg.wait_for_timeout(100)
    pg.click('#ok'); pg.wait_for_timeout(100)
    if pg.locator('#vgo').count(): pg.click('#vgo')
    check(pg.evaluate("MB.BT && MB.BT.ghost && MB.BT.qn") == 5, 'ゴースト戦：1ターン5問')
    check(sorted(pg.evaluate("[...MB.BT.B.items]")) == sorted(['どくキバ', 'ねらいのメガネ']), 'ゴーストの そうび＝おきにいり')
    accm = pg.evaluate("MB.BT.B.acc"); exp = {'国語': 0.95, '算数': 1, '理科': 0.55, '社会': 0.5, '英語': 0.5}
    check(all(abs(accm[k] - v) < 1e-6 for k, v in exp.items()), f'正解率（卒業100・あと1回95・復習待ち55・まだ50）{accm}')
    check(pg.evaluate("MB.BT.B.skills.join()") == pg.evaluate("MB.D.SKILLS.filter(k=>!MB.D.K.SKILL_LINE[k.n]||1000>=MB.D.K.SKILL_LINE[k.n]).map(k=>k.n).join()"), 'スキルは QRの ステータス合計（1000）で おぼえていた ものだけ')
    check(pg.evaluate("MB.BT.B.name") == 'ガオ' and not pg.evaluate("MB.BT.B.isBoss"), 'あいては 友だちの モンスター')
    subj = set(); ok = []
    end = "!!document.querySelector('.ov .choices') && document.querySelector('.ov').innerText.includes('QRゴーストなので')"
    for _ in range(15000):
        if pg.evaluate(end): break
        a = pg.evaluate("MB.BT && MB.BT.acts.B && MB.BT.acts.B.subj ? [MB.BT.acts.B.subj, MB.BT.acts.B.ans] : null")
        if a: subj.add(a[0]); ok.append(json.dumps(a))
        pg.evaluate(BOT, 0.8); pg.wait_for_timeout(20)
    check(pg.evaluate(end), 'バトルがおわって 結果が出る')
    check(subj <= {'算数'}, f'ゴーストは ダメージの出る教科（いちばん強くて 全部卒業の 算数）をえらぶ {subj}')
    acts = [json.loads(x) for x in set(ok)]
    check(all(all(a[1]) for a in acts if a[0] == '算数'), '全部卒業の教科は 全問正解')
    # ちがう友だち（おきにいり なし → もっているアイテムから）
    pg.click('.ov .choices button >> nth=2'); pg.wait_for_timeout(200)
    pg.evaluate(f"MB.scan({nofav})"); pg.wait_for_timeout(100)
    pg.click('.ov .choices button'); pg.wait_for_timeout(100); pg.click('#ok'); pg.wait_for_timeout(100)
    if pg.locator('#vgo').count(): pg.click('#vgo')
    check(sorted(pg.evaluate("[...MB.BT.B.items]")) == sorted(['木の盾', 'たこ焼き']), 'おきにいりが なければ もっているアイテムから')
    for _ in range(15000):
        if pg.evaluate(end): break
        pg.evaluate(BOT, 0.8); pg.wait_for_timeout(20)
    pg.click('.ov .choices button >> nth=3'); pg.wait_for_timeout(200)
    check(pg.locator('#tri').count() == 1, 'ホームへもどる')
    after = pg.evaluate("JSON.stringify({c:MB.S.coins,st:MB.S.st,qs:MB.S.qs,o:MB.S.owned,s:MB.S.stamina})")
    check(before == after, 'ほうびなし・記録なし（コイン・ステータス・問題・アイテム・スタミナ）')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
