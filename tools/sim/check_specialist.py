import random, battle_sim as bs
from exp import one
def wr(N=15000,**kw):
    random.seed(7); a=0
    for i in range(N):
        A,B,w,h,t=one(**kw); a+=(w is A)
    return a/N
for e,r in ((1.0,.95),(0.8,.95),(0.7,.95),(0.8,.85),(0.7,.9)):
    bs.P['EXP']=e; bs.P['ALLRES']=r
    print(f"ステの効き方^{e} 全教科耐性{r}: 特化vsバランス {wr(kinds=('特化','バランス')):.0%} / 特化vsランダム {wr(kinds=('特化','ランダム')):.0%} / ランダムvsバランス {wr(kinds=('ランダム','バランス')):.0%}")
