# 出題の ながれ・仮ステータス・リザルト・QRの とちゅう分 のテスト（10/5）
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'
BOT = open(pathlib.Path(__file__).resolve().parent / 'play_test.py', encoding='utf-8').read().split('BOT = """')[1].split('"""')[0]
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true'); pg.goto(URL); W = pg.wait_for_timeout
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モン'); pg.click('#go'); W(100)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    pg.evaluate("MB.S.stamina = 2000"); pg.evaluate("void MB.go.home()"); W(100)
    pg.click('#dun'); W(50); pg.click('.ov .choices button'); W(150)

    # ---- 出題のえらび方（pickQ / applyQ を 直接） ----
    r = pg.evaluate("""(() => {
      const T = MB.T, S = MB.S, R = MB.R, out = {};
      const st0 = JSON.stringify(S.st);
      // 新しい問題を まちがえる → 復習まち
      const a = T.pickQ('算数'); out.k1 = a.kind; T.applyQ('算数', a, false); out.s1 = S.qs[a.id];
      // すぐには 出ない（同じ教科を 3問 はさむ）
      const seq = [];
      for (let i = 0; i < 6; i++) { const x = T.pickQ('算数'); seq.push([x.id === a.id, x.kind]); T.applyQ('算数', x, true); }
      out.seq = seq;
      out.s2 = S.qs[a.id];
      // ほかの教科を いくら 答えても 算数の 間には 数えない
      const b = T.pickQ('国語'); T.applyQ('国語', b, false);
      for (let i = 0; i < 5; i++) { const x = T.pickQ('理科'); T.applyQ('理科', x, true); }
      out.b4 = T.pickQ('国語').id === b.id;
      // 正解でも「あと1回」まで（卒業しない）
      out.noGrad = Object.values(S.qs).every(v => v !== 4);
      out.stSame = JSON.stringify(S.st) === st0;
      out.gain = { ...R.gain };
      out.cur = T.curSt();
      return out;
    })()""")
    check(r['k1'] == 'new' and r['s1'] == 2, f"新しい問題 → まちがえると 復習まち {r['k1']} {r['s1']}")
    seq = r['seq']
    first = next((i for i, x in enumerate(seq) if x[0]), None)
    check(first == 3 and seq[first][1] == 'rev', f'復習まちは 同じ教科を 3問 はさんでから（{first}問目に 出た）')
    check(sum(1 for x in seq if x[0]) == 1, 'この回で 出なおすのは 1回まで')
    check(r['s2'] == 3, '復習まちを 正解 → あと1回（日の しばりなし）')
    check(not r['b4'], 'ほかの教科の 問題は 3問に 数えない（国語は まだ 出ない）')
    check(r['noGrad'], '道中で 正解しても 卒業しない（あと1回まで）')
    check(r['stSame'], '道中で 正解しても 本ステータスは かわらない')
    check(r['gain']['算数'] == 48 and r['gain']['理科'] == 40 and r['cur']['算数'] == 148, f"仮ステータスに 足される（+8 ずつ）{r['gain']} {r['cur']['算数']}")
    # イベントは いつも 新しい問題（記録しない）
    e = pg.evaluate("(() => { const ids = []; for (let i = 0; i < 20; i++) ids.push(MB.T.drawEventQ().id); return ids.every(id => !MB.S.qs[id]); })()")
    check(e, 'イベントの問題は いつも 新しい問題')
    # 復習ダンジョン：あと1回は 次の日から・復習まちは いつでも
    d = pg.evaluate("(() => { const L = MB.T.dueList(); return L.every(id => MB.S.qs[id] === 2) && L.length > 0; })()")
    check(d, '復習ダンジョン：きょう あと1回に なった問題は 出ない／復習まちは 出る')

    # ---- 中断 → ホーム：本ステータス・見た目は そのまま ----
    pg.evaluate("MB.R.gain['国語'] += 3000"); pg.evaluate("void MB.go.home()"); W(150)
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
    st = pg.evaluate("MB.S.st['国語']")
    check(st == 100, f'中断して ホーム：本ステータスは かわらない（国語 {st}）')
    # QR：とちゅう分は 別の欄
    q = pg.evaluate("(() => { const o = SAVECODE.decode(MB.qrBytes()); return [o.st['国語'], o.runGain && o.runGain['国語']]; })()")
    check(q == [100, 3000], f'QR：本ステータスと とちゅう分は 別 {q}')

    # ---- 引きつぎ：とちゅう分を 本ステータスに 足して 進化演出 ----
    code = pg.evaluate("MB.qrBytes()")
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.go.debugRoom()"); W(150)
    has = pg.evaluate("!!(MB.go.debugRoom)")
    if has:
        pg.click('#tr'); W(150)
        pg.evaluate(f"MB.scan(new Uint8Array({code}))"); W(150)
        pg.click('.ov .choices button'); W(100); pg.click('.ov .choices button'); W(100); pg.click('.ov button'); W(100)
        pg.click('.ov button'); W(100)  # 「とちゅうで 上がった」
        pg.wait_for_selector('#evb button', timeout=8000)
        check(pg.locator('#evo').count() > 0, '引きつぎ：とちゅう分で 見た目が かわったら 進化の演出')
        pg.click('#evb button'); W(100)
        v = pg.evaluate("[MB.S.st['国語'], MB.S.run]")
        check(v == [3100, None], f'引きつぎ：とちゅう分を 本ステータスに 足す・ダンジョンの つづきは 引きつがない {v}')
    else:
        check(False, 'MB.go.debugRoom が ない')

    # ---- ダンジョン（全部 正解）：ボス戦の 攻撃力は スキルを えらんだ ときに 決まる ----
    def fresh_dungeon():
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove()); MB.S.stamina = 2000; MB.S.run = null"); pg.evaluate("void MB.go.home()"); W(100)
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")
        pg.click('#dun'); W(50); pg.click('.ov .choices button'); W(100)
    fresh_dungeon()
    locked = []
    for i in range(6000):
        if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
        info = pg.evaluate("(() => { const BT = MB.BT; if (!BT || !BT.P || !BT.acts || !BT.acts.P || BT.acts.P === 'skip' || !BT.acts.P.st) return null; return { act: BT.acts.P.st, P: BT.P.st, cur: MB.T.curSt(), n: BT.acts.P.ans.length }; })()")
        if info and info['n'] >= 2: locked.append(info['act'] == info['P'] and info['cur'] != info['act'])
        pg.evaluate(BOT, 1.0); W(25)
    check(len(locked) > 0 and all(locked), f'ボス戦：攻撃力は スキルを えらんだ ときの 仮ステータス・そのターンの 正解ぶんは 次のターンから（{sum(locked)}/{len(locked)}）')
    check(pg.evaluate("Object.values(MB.S.qs).every(v => v !== 4)"), 'ボス戦で 正解しても 卒業しない')

    # ---- 負け → リザルト（ランク「—」・持ち帰りなし・ステータスは 足す）----
    fresh_dungeon()
    t0 = pg.evaluate("Object.values(MB.S.st).reduce((a,b)=>a+b)"); owned0 = pg.evaluate("MB.S.owned.length"); saw_rank = None
    for i in range(6000):
        if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
        rk = pg.evaluate("(() => { const e = document.querySelector('#rstamp'); return e ? e.textContent : null; })()")
        if rk: saw_rank = rk
        if pg.evaluate("!!(MB.BT && MB.BT.P)"):
            pg.evaluate("MB.BT.P.hp = 1; (() => { const b = [...document.querySelectorAll('.ov button')].find(x => x.textContent.includes('リザルト')); if (b) b.click(); })()")
        pg.evaluate(BOT, 1.0); W(25)
    last = pg.evaluate("window.MB_LAST")
    check(last and not last['beat'], f'負けて おわり {last}')
    check(saw_rank is not None and '—' in saw_rank, f'負けても リザルト・ランクは「—」 {saw_rank!r}')
    v = pg.evaluate("[Object.values(MB.S.st).reduce((a,b)=>a+b), MB.S.owned.length, MB.S.run]")
    check(v[0] > t0 and v[1] == owned0 and v[2] is None, f'負け：ステータスは 足す・持ち帰りなし {t0} → {v}')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
