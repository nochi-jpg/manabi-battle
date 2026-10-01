# 問題の番号を「国語4年→5年→6年→算数4年→…→英語6年」の通し番号にそろえる
# 使い方: python3 tools/renumber_questions.py
# ・questions.js を書きなおし、問題DBの版（QDB_VERSION）を1つ上げる
# ・前の番号 → 新しい番号 の対応表を qmap.js に足す（セーブ・QRは自動で新しい番号に引きつがれる）
# ・同じ教科・学年の中は、今の番号の小さい順
import json, subprocess, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
QJS, QMAP = ROOT / 'questions.js', ROOT / 'qmap.js'
SUBJ = ['国語', '算数', '理科', '社会', '英語']

def load_js(code):
    return json.loads(subprocess.run(['node', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

db = load_js("global.window={};require('./questions.js');console.log(JSON.stringify({db:window.QUESTION_DB,v:window.QDB_VERSION||1}))")
ver, db = db['v'], db['db']
maps = load_js("global.window={};try{require('./qmap.js')}catch(e){};console.log(JSON.stringify(window.QID_MAPS||{}))") if QMAP.exists() else {}

order = sorted(db, key=lambda q: (SUBJ.index(q[1]), q[2], q[0]))
old2new = [0] * (max(q[0] for q in db) + 1)
for i, q in enumerate(order, 1): old2new[q[0]] = i
if all(old2new[q[0]] == q[0] for q in db):
    print('もう そろっています'); raise SystemExit

def esc(s): return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"
out = [f'''// ===== 問題DB（まなびバトル）=====
// 形式： [番号, 教科, 学年, 問題文, [正解, ハズレ1, ハズレ2, ハズレ3], 解説]
// ・番号は「国語4年→5年→6年→算数4年→…→英語6年」の通し番号（tools/renumber_questions.py でそろえる）
// ・番号をそろえなおしたら QDB_VERSION を上げ、前の番号との対応表を qmap.js に足す（セーブ・QRは自動で引きつぐ）
// ・選択肢は「先頭が正解」。表示時にシャッフルされます
// ・教科は 国語 / 算数 / 理科 / 社会 / 英語
window.QDB_VERSION = {ver + 1};
window.QUESTION_DB = [''']
cur = None
for q in order:
    k = (q[1], q[2])
    if k != cur: out.append(f'// ---- {q[1]}{q[2]}年 ----'); cur = k
    out.append(f"[{old2new[q[0]]},{esc(q[1])},{q[2]},{esc(q[3])},[{','.join(esc(o) for o in q[4])}],{esc(q[5])}],")
out.append('];\n')
QJS.write_text('\n'.join(out))

maps[str(ver)] = old2new
lines = ['// ===== 問題の番号の対応表（番号をそろえなおしたときの 前の番号 → 新しい番号）=====',
         '// QID_MAPS[版] = [0, 新しい番号, …]（添字が前の番号）。セーブやQRの古い番号を新しい番号に直すのに使う',
         'window.QID_MAPS = {']
for k in sorted(maps, key=int): lines.append(f'  {k}: {json.dumps(maps[k], separators=(",", ":"))},')
lines.append('};\n')
QMAP.write_text('\n'.join(lines))
print(f'{len(order)}問の番号をそろえました（版 {ver} → {ver + 1}）')
