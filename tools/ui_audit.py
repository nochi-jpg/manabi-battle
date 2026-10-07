# UIの点検：すべての画面・窓をまわって「重なり・はみ出し・へんな改行」を見つける（Playwright）
# 使い方: python3 tools/ui_audit.py [出力フォルダ]
#   ・画面ごとに スクリーンショットを撮り、見つけた問題を一覧にする（問題があった画面だけ 名前の先頭に ! をつける）
#   ・へんな改行：2行以上の文で、最後の行が 1〜2文字だけになっているもの
import pathlib, sys, json, re, hashlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ui_audit'); OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob('*.png'): f.unlink()
URL = (ROOT / 'index.html').as_uri() + '?test'
BOT = (ROOT / 'tools' / 'play_test.py').read_text().split('BOT = """')[1].split('"""')[0]

CHECK = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const app = document.querySelector('#app');
  const layer = [...app.querySelectorAll(':scope > .ov')].pop() || app.querySelector(':scope > .scr');
  if (!layer) return [];
  const out = [];
  const name = e => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '') || e.tagName.toLowerCase();
  const scroller = e => { for (let p = e.parentElement; p && p !== layer.parentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return p; } return null; };
  const leaves = [...layer.querySelectorAll('*')].filter(e => vis(e) && !e.closest('.cutin,.tip,.achtoast,.float,.dmg') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  for (const e of leaves) {
    const cs = getComputedStyle(e);
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const t = n.textContent, rg = document.createRange(), lines = new Map();
      for (let i = 0; i < t.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const rr = rg.getClientRects()[0]; if (!rr || !rr.width) continue; const k = Math.round(rr.top / 4); if (!lines.has(k)) lines.set(k, ''); lines.set(k, lines.get(k) + t[i]); }
      const ls = [...lines.keys()].sort((a, b) => a - b).map(k => lines.get(k).trim()).filter(Boolean);
      if (ls.length > 1 && ls[ls.length - 1].replace(/[、。！？!?）)」』…ー〜]/g, '').length <= 2) out.push(['改行', name(e), ls.join(' / ').slice(0, 60)]);
    }
    if (e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && cs.display !== 'inline' && e.clientWidth > 0) out.push(['はみ出し(横)', name(e), e.textContent.trim().slice(0, 30)]);
    // 文字が 自分の箱から はみ出していないか（中央ぞろえで 左右に はみ出すものも 見つける）
    { const er = e.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(e); const tr = rg.getBoundingClientRect();
      if (tr.width && cs.textOverflow !== 'ellipsis' && (tr.left < er.left - 2 || tr.right > er.right + 2)) out.push(['はみ出し(文字)', name(e), e.textContent.trim().slice(0, 30)]); }
    const r = e.getBoundingClientRect(), sc = scroller(e);
    const box = sc ? sc.getBoundingClientRect() : { left: 0, top: 0, right: 1280, bottom: 720 };
    if (!sc && (r.right > 1281 || r.left < -1 || r.bottom > 721 || r.top < -1)) out.push(['画面の外', name(e), e.textContent.trim().slice(0, 30)]);
  }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j];
    if (a.contains(b) || b.contains(a)) continue;
    if ([a, b].some(x => x.matches('.new, .newb'))) continue; // かどの NEW バッジは わざと重ねている
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (ix > 6 && iy > 6) {
      const sa = scroller(a), sb = scroller(b);
      if (sa && sa === sb) { const S = sa.getBoundingClientRect(); if (Math.min(A.bottom, B.bottom) < S.top || Math.max(A.top, B.top) > S.bottom) continue; }
      out.push(['重なり', name(a) + '「' + a.textContent.trim().slice(0, 12) + '」', name(b) + '「' + b.textContent.trim().slice(0, 12) + '」']);
    }
  }
  return out;
}"""
KEY = r"""() => {
  const app = document.querySelector('#app'), L = [...app.querySelectorAll(':scope > .ov')].pop(), S = app.querySelector(':scope > .scr');
  if (L && L.querySelector('.qbox')) { const a = L.querySelector('.after'); return 'qbox:' + (L.querySelector('.qg') ? 'battle:' : '') + (a && a.innerText.trim() ? (a.querySelector('.expl') ? 'ng' : 'ok') : 'open') + ':' + (L.querySelector('.megane button') ? L.querySelector('.megane').innerText.slice(0, 6) : ''); }
  const t = (L ? 'ov:' + (L.querySelector('.who') ? '' : '') + L.innerText : 'scr:' + (S ? S.className : '') + ':' + (S ? S.innerText : ''));
  return t.replace(/[0-9０-９]+/g, '#').replace(/\s+/g, ' ').slice(0, 46);
}"""

# 画面に のこっている 絵文字（画像に おきかわっていないもの）を あつめる
EMOS = r"""() => { const out = []; const w = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT); let t;
  while ((t = w.nextNode())) { const s = t.nodeValue; if (!t.parentElement || !t.parentElement.offsetParent) continue;
    for (const m of s.matchAll(/[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}][\uFE0F\u200D\u{1F000}-\u{1FAFF}]*/gu)) out.push([m[0], s.trim().slice(0, 30)]); }
  return out; }"""
EMO_LEFT = {}
seen, report = set(), []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true')
    pg.add_init_script('(()=>{let a=777;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()')
    pg.set_default_timeout(8000)
    W = pg.wait_for_timeout
    def audit(label='', force=False):
        k = pg.evaluate(KEY)
        if k in seen and not force: return
        seen.add(k); W(380)  # 窓のポップ（0.22秒）が おわってから撮る
        iss = pg.evaluate(CHECK)
        for e, ctx in pg.evaluate(EMOS): EMO_LEFT.setdefault(e, ctx)
        n = len(report) + 1
        fn = f"{'!' if iss else ''}{n:03d}_{re.sub(r'[^0-9A-Za-zぁ-んァ-ヶ一-龠ー]+', '_', (label or k))[:40]}.png"
        pg.screenshot(path=str(OUT / fn))
        report.append({'n': n, 'file': fn, 'key': k, 'label': label, 'issues': iss})
    def bot(until, acc=0.8, n=6000):
        for _ in range(n):
            if pg.evaluate(until): return True
            audit(); pg.evaluate(BOT, acc); W(15)
        return False
    close = "document.querySelectorAll('#app > .ov').forEach(o=>o.remove())"
    home_js = "!!document.querySelector('#dun') && !document.querySelector('#app > .ov')"
    go = lambda f: (pg.evaluate(f'void MB.go.{f}'), W(200))

    pg.goto(URL); W(300); audit('名前を決める画面', True)
    pg.fill('#pn', 'あおい'); pg.fill('#cn', 'ポチ'); pg.click('#go'); W(300); pg.evaluate(close); audit('ホーム（はじめ）', True)
    pg.click('#sta'); W(100); audit('スタミナの説明', True); pg.evaluate(close)
    # 育成ダンジョン ×3（出てくる窓を ぜんぶ点検）
    for r in range(3):
        pg.evaluate("MB.S.stamina = Math.max(MB.S.stamina, 100)")
        pg.click('#dun'); W(100); audit(); pg.click('.ov .choices button'); W(200)
        bot(home_js, acc=[0.9, 0.5, 0.95][r])
    # あそんだ状態にする
    pg.evaluate("""(()=>{const S=MB.S; S.owned=MB.D.ITEMS.slice(0,50).map(i=>i.n); S.fav=S.owned.slice(0,3);
      Object.keys(MB.Q).slice(0,300).forEach((id,i)=>{S.qs[id]=[2,3,4][i%3]; if(i%5==0) S.miss[id]=1;}); S.qd={};
      S.bossStg={国語:7,算数:3,理科:1}; S.st={国語:620,算数:580,理科:500,社会:460,英語:540}; S.coins=5000; S.ach={solved1:'x',solved50:'x',solved100:'x'};})()""")
    go('home()'); pg.evaluate(close); audit('ホーム（あそんだあと）', True)
    pg.click('#me'); audit('ホーム：セリフ', True)
    pg.click('#grow'); W(100); audit('せいちょう・スキル', True); pg.evaluate(close)
    # せってい
    pg.click('#set'); W(100); audit('せってい', True)
    pg.click('#sT'); W(150); audit('称号えらび', True); pg.click('.ttl.lock >> nth=0'); W(100); audit('称号：手に入れかた', True); pg.evaluate(close)
    pg.click('.ttl[data-t]:not([data-t=""]) >> nth=0'); W(100); audit('称号えらび：えらんだ', True)
    pg.click('#bk'); W(150); pg.click('#sB'); W(150); audit('背景えらび', True); pg.click('.bgc.lock >> nth=0'); W(100); audit('背景：手に入れかた', True); pg.evaluate(close)
    pg.click('#bk'); W(150); pg.click('#sN'); W(150); audit('名前をかえる', True); pg.evaluate(close)
    pg.evaluate(close); pg.click('#set'); W(100); pg.click('#sQ'); W(150); audit('出題範囲', True); pg.evaluate(close)
    pg.evaluate(close); pg.click('#set'); W(100); pg.click('#sC'); W(150); audit('クレジット', True); pg.click('.cred #cl'); W(150); pg.evaluate(close)
    pg.evaluate("MB.S.debug={on:true,bak:{}}; MB.S.ach['boss_all']='x'"); go('home()'); pg.evaluate(close); pg.click('#set'); W(100); audit('せってい（デバッグ）', True); pg.evaluate(close)
    pg.evaluate("MB.S.debug=null"); go('home()'); pg.evaluate(close)
    # ごはん
    pg.evaluate("MB.S.fedDay=''; history.replaceState(null,'',location.href+'&feed')"); go('home()'); audit('ごはん', True)
    pg.click('.ov .choices button >> nth=1'); W(150); audit('ごはん：食べた', True); pg.evaluate(close)
    # 復習ダンジョン
    go('reviewDungeon()'); bot("!!document.querySelector('#app > .ov .choices') && /きょうの復習/.test(document.querySelector('#app > .ov').innerText)", acc=0.6, n=400)
    audit('復習：おわり', True); pg.evaluate(close)
    # 無限の塔
    go('towerSelect()'); audit('塔：えらぶ', True)
    pg.click('#ts button[data-s="算数"]'); W(200)
    bot("!!document.querySelector('#app > .ov .choices') && /ざんねん/.test(document.querySelector('#app > .ov').innerText)", acc=0.3, n=600)
    audit('塔：おわり', True); pg.evaluate(close)
    go('towerSelect()'); audit('塔：入場ずみ', True)
    # おためしバトル
    go('trialMode()'); audit('おためし：ボスえらび', True)
    pg.click('#bs button[data-b] >> nth=0'); W(200); audit('そうびえらび', True)
    pg.click('.bk:not(.none) >> nth=0'); W(100); audit('そうびえらび：アイテム', True); pg.click('#eq'); W(100)
    pg.click('#ok'); W(200)
    bot("!!document.querySelector('#app > .ov .choices') && /ほうびはない/.test(document.querySelector('#app > .ov').innerText)", acc=0.8)
    audit('おためし：結果', True); pg.evaluate("(()=>{const b=[...document.querySelectorAll('.ov .choices button')].pop(); if(b) b.click()})()"); W(200); pg.evaluate(close)
    # とうぎじょう・QRゴースト
    go('arena()'); audit('とうぎじょう', True)
    pg.click('#aG'); W(300); audit('QRゴースト：QRを読む', True)
    pg.evaluate("MB.scan(MB.qrBytes())"); W(300); audit('QRゴースト：かくにん', True)
    pg.click('.ov .choices button'); W(200); pg.click('#ok'); W(300)
    if pg.query_selector('#vgo'): audit('QRゴースト：しょうかい', True); pg.click('#vgo'); W(200)
    bot("!!document.querySelector('#app > .ov .choices') && /ほうびはない/.test(document.querySelector('#app > .ov').innerText)", acc=0.8)
    audit('QRゴースト：結果', True); pg.evaluate("(()=>{const b=[...document.querySelectorAll('.ov .choices button')].pop(); if(b) b.click()})()"); W(200); pg.evaluate(close)
    # ガチャ
    go('home()'); pg.evaluate(close); pg.click('#b1'); W(200); audit('ガチャ', True)
    btns = pg.locator('button');
    for i in range(btns.count()):
        if '提供' in btns.nth(i).inner_text(): btns.nth(i).click(); break
    W(150); audit('ガチャ：提供割合', True); pg.evaluate(close)
    for i in range(btns.count()):
        if 'ガチャを引く' in btns.nth(i).inner_text(): btns.nth(i).click(); break
    bot("!!document.querySelector('#app > .ov') && /ゲット/.test(document.querySelector('#app > .ov').innerText)", n=300)
    audit('ガチャ：結果', True); pg.evaluate(close)
    # もちもの・問題リスト・QR・アチーブメント・対戦
    go('home()'); pg.evaluate(close); pg.click('#b2'); W(200); audit('もちもの', True)
    pg.click('.bk:not(.none) >> nth=0'); W(100); audit('もちもの：アイテム', True); pg.evaluate(close)
    go('home()'); pg.evaluate(close); pg.click('#b3'); W(200); audit('問題リスト', True)
    for i in range(4):
        pg.click(f'.qrow >> nth={i * 3}'); W(120); audit(f'問題リスト：問題{i + 1}', True); pg.evaluate(close)
    pg.click('[data-s="英語"]'); W(150); pg.click('[data-g="6"]'); W(150); audit('問題リスト：英語6年', True)
    pg.click('.qrow >> nth=5'); W(120); audit('問題リスト：英語の問題', True); pg.evaluate(close)
    go('home()'); pg.evaluate(close); pg.click('#b4'); W(300); audit('QR', True)
    go('home()'); pg.evaluate(close); pg.click('#b5'); W(200); audit('アチーブメント', True)
    go('home()'); pg.evaluate(close); pg.click('#vs'); W(300); audit('対戦：QRを読む', True); pg.click('#cn'); W(200)
    # 対戦（QRは テスト用の入口から。Bは 名前をかえた自分のQR）
    bA = pg.evaluate("MB.qrBytes()")
    bB = pg.evaluate("(()=>{const S=MB.S,p=S.pname,c=S.cname,t=S.type;S.pname='けんた';S.cname='ガオ';const b=MB.qrBytes();S.pname=p;S.cname=c;return b})()")
    go('home()'); pg.evaluate(close); pg.click('#vs'); W(300)
    pg.evaluate(f"MB.scan({bB})"); W(300); audit('対戦：かくにん', True)
    pg.click('.ov .choices button'); W(200)
    for _ in range(8000):
        if pg.evaluate("MB.VS && MB.VS.phase === 'end' && !!document.querySelector('#app > .ov .choices')"): break
        audit()
        if pg.query_selector('#vgo'): audit('対戦：しょうかい', True); pg.click('#vgo'); W(100); continue
        if pg.query_selector('#ok') and not pg.query_selector('#app > .ov'):
            try:  # 40秒で自動で進むことがあるので、まにあわなくてもOK
                if len(pg.query_selector_all('.bk.sel')) < 2: pg.click('.bk:not(.none):not(.sel)', timeout=1500)
                else: pg.click('#ok', timeout=1500)
            except Exception: pass
            W(40); continue
        if pg.evaluate("document.body.innerText.includes('画面を見てください')") and not pg.query_selector('#app > .ov'):
            pg.click('.scr'); W(40); continue
        pg.evaluate(BOT, 0.7); W(15)
    audit('対戦：けっか', True)
    pg.click('.ov .choices button >> nth=1'); W(200); pg.evaluate(close)
    # 先生用ページ（クラスの記録が入った状態）
    pg.evaluate(f"localStorage.setItem('manabi_battle_teacher', JSON.stringify([SAVECODE.decode({bA}), SAVECODE.decode({bB})]))")
    go('titleScreen()'); audit('タイトル', True)
    go('debugRoom()'); audit('デバッグルーム', True)
    go('teacherPage()'); W(300); audit('先生用ページ（記録あり）', True)
    b.close()

(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
bad = [r for r in report if r['issues']]
print(f'画面 {len(report)}／問題あり {len(bad)}　errors: {errors or "なし"}')
print('のこっている絵文字:'); [print('  ', e, repr(c)) for e, c in EMO_LEFT.items() if e != '★']
for r in bad:
    print(f"--- {r['file']}")
    seen_i = set()
    for i in r['issues']:
        s = ' | '.join(i)
        if s in seen_i: continue
        seen_i.add(s); print('   ', s)
