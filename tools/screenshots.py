# 全画面のスクリーンショットを撮って docs/screens/ に保存し、docs/SCREENS.md（番号つき一覧）を作る
# 使い方: python3 tools/screenshots.py
# UI調整（②）で「S07のボタンを大きく」のように番号で指示できるようにするためのもの
import pathlib, shutil
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'screens'
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools' / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
shots, errors = [], []

shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir(parents=True)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true')
    # 毎回同じ画面になるように 乱数を固定
    pg.add_init_script('(()=>{let a=12345;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()')
    W = pg.wait_for_timeout; pg.set_default_timeout(8000)

    def shot(name, desc):
        W(250)
        n = len(shots) + 1
        f = f'S{n:02d}_{name}.png'
        pg.screenshot(path=str(OUT / f))
        shots.append((n, f, desc)); print(f'S{n:02d} {desc}')

    def bot_until(js, acc=0.85, n=8000):
        for _ in range(n):
            if pg.evaluate(js): return True
            pg.evaluate(BOT, acc); W(15)
        print('  （とれなかった）', js[:60]); return False
    has = lambda sel: f"!!document.querySelector({sel!r})"
    close_ov = "document.querySelectorAll('.ov').forEach(o=>o.remove())"

    # ---- はじめて ----
    pg.goto(URL); W(300)
    shot('name', '名前を決める画面（はじめて）')
    pg.fill('#pn', 'あおい'); pg.fill('#cn', 'ポチ'); pg.click('#go'); W(300)
    pg.evaluate(close_ov)
    shot('home_first', 'ホーム（はじめて・アイテムなし）')

    # ---- 育成ダンジョン ----
    pg.click('#dun'); W(100)
    shot('dun_confirm', '育成ダンジョンに入る確認')
    pg.click('.ov .choices button'); W(400)
    pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")
    shot('dun_hint', '育成ダンジョン：ボスのヒント')
    pg.click('.ov .choices button'); W(400)
    pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")
    shot('dun_field', '育成ダンジョン：道のりと フィールド')
    bot_until(has('.qbox .opts button:not([disabled])'))
    shot('question', '問題（4択）')
    pg.evaluate("""(()=>{const q=document.querySelector('.qbox');const t=q.querySelector('.qt').textContent;const qq=Object.values(MB.Q).find(x=>x.t===t);
      [...q.querySelectorAll('.opts button')].find(b=>b.textContent!==qq.a[0]).click()})()"""); W(400)
    shot('question_wrong', '問題：まちがえたとき（解説）')
    bot_until("MB.R && ['e1','f','t','b'].includes(MB.R.plan[MB.R.i]) && !!document.querySelector('.ov') && !document.querySelector('.qbox')")
    shot('dun_event', '育成ダンジョン：イベント／分かれ道／宝箱')
    bot_until("!!document.querySelector('.ov .bk, .ov .itc, .ov [data-n]') || (MB.R && MB.R.plan[MB.R.i]==='b')")
    if pg.evaluate("!!document.querySelector('.ov')"): shot('dun_item', '育成ダンジョン：アイテムをひろう／えらぶ')
    bot_until("!!(MB.BT) && !!document.querySelector('.ov button[data-k]')")
    shot('boss_skill', 'ボス戦：スキルをえらぶ')
    pg.click('.ov button[data-k]:not([disabled])'); W(200)
    bot_until(has('.ov button[data-s]'), n=200)
    shot('boss_subj', 'ボス戦：教科をえらぶ')
    pg.click('.ov button[data-s]:not([disabled])'); W(200)
    bot_until(has('.qbox .opts button:not([disabled])'))
    shot('boss_question', 'ボス戦：問題（問題ゲージ）')
    if bot_until("!!MB.BT && !document.querySelector('.ov') && !document.querySelector('.cutin') && /ダメージ/.test((document.querySelector('#blog')||{}).innerText||'')", n=4000): shot('boss_field', 'ボス戦：バトル画面（ダメージ）')
    bot_until(has('.scr.res') + ' && ' + has('.ov'))
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.style.visibility='hidden')"); W(50)
    shot('result', 'リザルト')
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.style.visibility='')")
    shot('boss_reward', 'リザルト：ボス撃破のごほうび')
    bot_until("!!document.querySelector('.ov') && /1つだけ 持ち帰れる|もう アイテムを持ち帰れない|新しいアイテムはなかった/.test(document.querySelector('.ov').innerText)")
    shot('takehome', 'アイテムの持ち帰り')
    bot_until("!!document.querySelector('#dun') && !document.querySelector('.ov')")

    # 少し遊んだ状態にする（アイテム・問題・ボス）
    pg.evaluate("""(()=>{const S=MB.S; S.owned=MB.D.ITEMS.slice(0,40).map(i=>i.n); S.fav=S.owned.slice(0,3);
      Object.keys(MB.Q).slice(0,300).forEach((id,i)=>{S.qs[id]=[2,3,4][i%3]; if(i%5==0) S.miss[id]=1;}); S.qd={};
      S.bossStg={国語:7,算数:3,理科:1}; S.st={国語:420,算数:380,理科:300,社会:260,英語:340}; S.coins=1500;})()""")
    pg.evaluate("void MB.go.home()"); W(200)
    shot('home', 'ホーム（あそんだあと）')

    # ---- ホームのメニュー ----
    pg.click('#set'); shot('settings', 'せってい'); pg.evaluate(close_ov)
    pg.evaluate("void MB.go.reviewDungeon()"); W(200)
    bot_until(has('.qbox .opts button:not([disabled])'), n=100)
    pg.evaluate(close_ov.replace('.ov', '.ov:not(:has(.qbox))'))
    shot('review', '復習ダンジョン')
    pg.evaluate("void MB.go.towerSelect()"); shot('tower_select', '無限の塔：教科えらび')
    pg.click('#ts button[data-s="算数"]'); W(200)
    bot_until(has('.qbox .opts button:not([disabled])'), n=100)
    shot('tower_run', '無限の塔：のぼっているところ')
    pg.evaluate(close_ov)
    pg.evaluate("void MB.go.trialMode()"); W(200); shot('trial_select', 'おためしバトル：ボスえらび')
    pg.click('#bs button[data-b]'); W(200); shot('pick_items', 'そうびえらび（おためしバトル・対戦）')
    pg.click('.bk:not(.none)'); W(100); shot('pick_item_detail', 'そうびえらび：アイテムをタップ')
    pg.click('#eq'); W(100); pg.click('#ok'); W(100)
    if bot_until(has('.roul'), n=300): shot('roulette', '先攻・後攻ルーレット')
    if bot_until("!!document.querySelector('.ov .choices') && document.querySelector('.ov').innerText.includes('決める権利をとった')", n=300): shot('first_choice', '先攻・後攻をえらぶ')
    pg.evaluate("MB.BT.phase='end'"); pg.evaluate(close_ov)
    pg.evaluate("void MB.go.home()"); W(100)
    pg.click('#b1'); shot('gacha', 'ガチャ')
    pg.evaluate("void MB.go.home()"); pg.click('#b2'); shot('itembook', 'もちもの（アイテム図鑑）')
    pg.click('.bk:not(.none)'); shot('item_detail', 'アイテムの説明'); pg.evaluate(close_ov)
    pg.evaluate("void MB.go.home()"); pg.click('#b3'); shot('qlist', '問題リスト')
    pg.evaluate("void MB.go.home()"); pg.click('#b4'); W(300); shot('qr', 'QRコード')
    pg.evaluate("void MB.go.home()"); pg.click('#b5'); shot('achievements', 'アチーブメント')
    pg.evaluate("void MB.go.home()"); pg.click('#vs'); W(300); shot('vs_scan', '対戦モード：QRを読みこむ')
    pg.evaluate(close_ov)
    pg.evaluate("void MB.go.titleScreen()"); shot('title', 'タイトル（2回目から）')
    pg.evaluate("void MB.go.debugRoom()"); shot('debug_room', 'デバッグルーム（先生用）')
    pg.evaluate("void MB.go.teacherPage()"); W(200); shot('teacher', '先生用ページ')
    b.close()

lines = ['# 画面一覧（UI調整用）', '', '`python3 tools/screenshots.py` で撮りなおせます。番号（S01 など）で指示してください。', '',
         '| 番号 | 画面 |', '|---|---|']
lines += [f'| S{n:02d} | [{d}](screens/{f}) |' for n, f, d in shots]
lines += ['', *[f'### S{n:02d} {d}\n![S{n:02d}](screens/{f})\n' for n, f, d in shots]]
(ROOT / 'docs' / 'SCREENS.md').write_text('\n'.join(lines))
print('errors:', errors or 'なし')
