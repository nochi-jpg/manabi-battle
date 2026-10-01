import random
from collections import Counter
from battle_sim import *
import battle_sim as bs

def one(acc=(.75,.75),kinds=('ランダム','ランダム'),ia=None,ib=None,log=None):
    log=log or dict(skill=Counter(),status=Counter(),rwin=Counter(),dmg=[])
    A=F('A',rand_stats(2000,kinds[0]),ia if ia is not None else rand_items(),acc[0])
    B=F('B',rand_stats(2000,kinds[1]),ib if ib is not None else rand_items(),acc[1])
    return (A,B)+battle(A,B,log)

def report(N=30000, seed=2, tag=''):
    random.seed(seed)
    end=Counter(); wins=Counter(); cnt=Counter(); first=0; firstw=0
    log=dict(skill=Counter(),status=Counter(),rwin=Counter(),dmg=[])
    for i in range(N):
        A,B,w,how,t=one(log=log); end[(how,t)]+=1
        for f in (A,B):
            for it in f.items: cnt[it]+=1; wins[it]+=(w is f)
    print(f"[{tag}] 決着:",{f'{h}{t}':f'{v/N:.0%}' for (h,t),v in sorted(end.items())},
          " 1撃の中央値",f"{sorted(log['dmg'])[len(log['dmg'])//2]:.0%}")
    rows=sorted(((wins[i]/cnt[i],i) for i in cnt),reverse=True)
    print("  勝率 上位:", ', '.join(f'{i}{r:.0%}' for r,i in rows[:6]))
    print("  勝率 下位:", ', '.join(f'{i}{r:.0%}' for r,i in rows[-6:]))
    return rows

if __name__=='__main__':
  for hpk in (.55,.65,.75):
    bs.P['HPK']=hpk; report(tag=f'HP=合計×{hpk}')
