# 問題の点検（全問）
# 使い方: python3 tools/check_questions.py
# ・形（番号・教科・学年・4択・解説）・番号の重複／順番
# ・同じ問題文の重複、選択肢の重複
# ・算数：同じ値の別表記（2/4 と 1/2、0.50 と 0.5 など）が選択肢にまざっていないか
# ・正解だけが極端に長くないか（文の長さで答えがわからないように）
import json, re, subprocess, sys, pathlib
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent
js = "global.window={};require('./questions.js');console.log(JSON.stringify(window.QUESTION_DB))"
db = json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
SUBJ = ['国語', '算数', '理科', '社会', '英語']
errs, warns = [], []

def val(s):
    """算数の選択肢を数として読む（読めなければ None）"""
    t = s.replace('，', '').replace(',', '').strip()
    t = re.sub(r'(㎠|㎡|cm|mm|km|m|kg|g|L|dL|mL|度|こ|人|円|本|まい|cm²|倍|分|秒|時間|日|才|a|ha|㎦|㎤|㎥)$', '', t)
    m = re.fullmatch(r'(\d+)と(\d+)/(\d+)', t)
    if m: return Fraction(int(m[1])) + Fraction(int(m[2]), int(m[3]))
    m = re.fullmatch(r'(\d+)/(\d+)', t)
    if m and int(m[2]): return Fraction(int(m[1]), int(m[2]))
    try: return Fraction(t)
    except Exception: return None

ids = [q[0] for q in db]
if len(set(ids)) != len(ids): errs.append('番号が重複している')
if ids != sorted(ids): errs.append('番号が順番になっていない')
seen = {}
for q in db:
    if len(q) != 6: errs.append(f'{q[0]}: 形がちがう'); continue
    i, s, g, t, a, x = q
    tag = f'No.{i} {s}{g}年 {t[:24]}'
    if s not in SUBJ: errs.append(f'{tag}: 教科がちがう')
    if g not in (4, 5, 6): errs.append(f'{tag}: 学年がちがう')
    if len(a) != 4 or any(not str(o).strip() for o in a): errs.append(f'{tag}: 選択肢が4つない')
    if len(set(a)) != 4: errs.append(f'{tag}: 選択肢が重複 {a}')
    if not x.strip(): errs.append(f'{tag}: 解説がない')
    k = (s, t)
    if k in seen: errs.append(f'{tag}: 同じ問題文が No.{seen[k]} にある')
    seen[k] = i
    if s == '算数':
        vs = [val(o) for o in a]
        nums = [v for v in vs if v is not None]
        if len(nums) == 4 and len(set(nums)) != 4: errs.append(f'{tag}: 同じ値の選択肢がある {a}')
    L = [len(o) for o in a]
    if L[0] >= 12 and L[0] > 1.8 * max(L[1:]): warns.append(f'{tag}: 正解だけ長い {a}')

print(f'全{len(db)}問', {f'{s}{g}': sum(1 for q in db if q[1] == s and q[2] == g) for s in SUBJ for g in (4, 5, 6)})
for w in warns: print('注意', w)
for e in errs: print('NG', e)
print('NG', len(errs), '件 / 注意', len(warns), '件')
sys.exit(1 if errs else 0)
