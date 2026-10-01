# 問題を questions.js の後ろに足す（番号は今の最大＋1から）
# 使い方: python3 tools/add_questions.py tools/qgen/sansu4.py
#   qgen の各ファイルは Q = [(教科, 学年, 問題文, [正解, ハズレ1, ハズレ2, ハズレ3], 解説), ...] を作る
import json, re, subprocess, sys, pathlib, runpy

ROOT = pathlib.Path(__file__).resolve().parent.parent
QJS = ROOT / 'questions.js'

def esc(s): return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"

src = pathlib.Path(sys.argv[1])
Q = runpy.run_path(str(src))['Q']
js = "global.window={};require('./questions.js');console.log(JSON.stringify(window.QUESTION_DB))"
db = json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
have = {(q[1], q[3]) for q in db}
nid = max(q[0] for q in db) + 1
lines, skip = [], 0
for s, g, t, a, x in Q:
    if (s, t) in have: skip += 1; continue
    have.add((s, t))
    lines.append(f"[{nid},{esc(s)},{g},{esc(t)},[{','.join(esc(o) for o in a)}],{esc(x)}],")
    nid += 1
text = QJS.read_text()
head = f"// ---- 追加（{src.stem}）----\n"
text = text.rstrip()
assert text.endswith('];')
text = text[:-2] + head + '\n'.join(lines) + '\n];\n'
QJS.write_text(text)
print(f'{len(lines)}問 追加（同じ問題文で とばした {skip}問）。最後の番号 {nid - 1}')
