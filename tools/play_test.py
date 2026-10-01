# まなびバトル 自動プレイテスト（Playwright）
# 使い方: python3 tools/play_test.py [回数] [正答率] [とちゅうで再読みこみする確率]
#   例) python3 tools/play_test.py 5 0.75 0.03
# window.FAST=true で演出を速くし、育成ダンジョン→ボス戦→リザルトを自動でくり返す
# 再読みこみの確率を入れると、とちゅうでページを開きなおして「続きから」が動くかを確かめる
import sys, random, pathlib
from playwright.sync_api import sync_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 3
ACC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.75
RELOAD = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
URL = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?test'

BOT = """
(acc) => {
  const vis = e => e && e.offsetParent !== null && !e.disabled;
  const q = document.querySelector('.qbox');
  if (q) {
    const nx = q.querySelector('.after button'); if (vis(nx)) { nx.click(); return 'next'; }
    const opts = [...q.querySelectorAll('.opts button')].filter(vis);
    if (opts.length) {
      const t = q.querySelector('.qt').textContent;
      const qq = Object.values(MB.Q).find(x => x.t === t);
      const right = opts.find(b => b.textContent === qq.a[0]);
      const b = Math.random() < acc && right ? right : opts[Math.floor(Math.random() * opts.length)];
      b.click(); return 'answer';
    }
    return 'wait';
  }
  const ov = [...document.querySelectorAll('.ov')].pop();
  if (ov) { const bs = [...ov.querySelectorAll('button')].filter(vis); if (bs.length) { (Math.random() < 0.7 ? bs[0] : bs[Math.floor(Math.random() * bs.length)]).click(); return 'ov'; } return 'wait'; }
  const nx2 = document.querySelector('#nx'); if (vis(nx2)) { nx2.click(); return 'next'; }
  const sb = [...document.querySelectorAll('#subj button')].filter(vis);
  if (sb.length) { sb[Math.floor(Math.random() * sb.length)].click(); return 'subj'; }
  return 'idle';
}
"""
STATE = '({st: MB.S.st, coins: MB.S.coins, owned: MB.S.owned.length, solved: Object.keys(MB.S.qs).length, last: window.MB_LAST})'

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script('window.FAST = true')
    pg.goto(URL)
    pg.fill('#pn', 'テスト'); pg.fill('#cn', 'モンスター'); pg.click('#go')
    reloads = 0
    for run in range(N):
        pg.click('#dun'); pg.wait_for_timeout(50); pg.click('.ov .choices button')
        steps = 0
        while steps < 5000:
            steps += 1
            if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
            if RELOAD and random.random() < RELOAD:
                before = pg.evaluate('JSON.stringify(MB.S.st)')
                pg.reload(); pg.wait_for_timeout(50)
                after = pg.evaluate('JSON.stringify(MB.S.st)')
                if before != after: errors.append(f'再読みこみでステータスが変わった {before} -> {after}')
                pg.click('#go'); reloads += 1; continue
            pg.evaluate(BOT, ACC); pg.wait_for_timeout(30)
        print(f'run{run + 1}: steps={steps}', pg.evaluate(STATE))
    print('再読みこみ', reloads, '回')
    b.close()
print('errors:', errors or 'なし')
