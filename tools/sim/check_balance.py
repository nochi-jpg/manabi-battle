import random
from collections import Counter
from battle_sim import *
from exp import one
def wr(N=20000,**kw):
    random.seed(7); a=0
    for i in range(N):
        A,B,w,h,t=one(**kw); a+=(w is A)
    return a/N
print("== かしこさの差（Aの勝率）")
for pa,pb in ((.9,.6),(.9,.75),(.75,.6),(.6,.4)): print(f"  正答率{pa:.0%} vs {pb:.0%}: {wr(acc=(pa,pb)):.0%}")
print("== 育て方（Aの勝率、正答率は同じ）")
print("  特化 vs バランス:",f"{wr(kinds=('特化','バランス')):.0%}")
print("  特化 vs ランダム:",f"{wr(kinds=('特化','ランダム')):.0%}")
print("  アイテム4個 vs アイテム0個:",f"{wr(ib=[]):.0%}")
# ルーレットの権利をとった回数と勝率
random.seed(8); c=Counter(); N=20000
for i in range(N):
    log=dict(skill=Counter(),status=Counter(),rwin=Counter(),dmg=[])
    A,B,w,h,t=one(log=log); k=log['rwin']['A']; c[(k,w is A)]+=1
print("== ルーレットで先攻後攻を選べた回数（3ターン中）とAの勝率")
for k in range(4):
    tot=c[(k,True)]+c[(k,False)]
    if tot: print(f"  {k}回: {c[(k,True)]/tot:.0%}")
