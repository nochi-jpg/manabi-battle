import random
from collections import Counter
from battle_sim import *
from exp import report, one
rows=report(N=40000, tag='修正2')
# 対策アイテム：相手が状態異常アイテムを持っているときの勝率
random.seed(5); W=Counter(); C=Counter()
STAT_ITEMS=set(INFLICT)|{'嵐の羽'}
for i in range(40000):
    A,B,w,h,t=one()
    for f,o in ((A,B),(B,A)):
        if o.items & STAT_ITEMS:
            for it in ('ユニコーンの角','重力の石','おまもり'):
                if it in f.items: C[it]+=1; W[it]+=(w is f)
print("  相手が状態異常アイテム持ちのとき:", ', '.join(f'{k}{W[k]/C[k]:.0%}' for k in C))
