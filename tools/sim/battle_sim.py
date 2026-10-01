# まなびバトル 対戦シミュレーター（バランス検討用）
import random, math, statistics as st
from collections import defaultdict, Counter

SUBJ = ['国語', '算数', '理科', '社会', '英語']
# 相性：key のタイプが value の教科から 1.25倍で受ける / 0.9倍で受ける
WEAK = {'国語': '算数', '算数': '理科', '理科': '社会', '社会': '国語'}
RESIST = {'国語': '社会', '算数': '国語', '理科': '算数', '社会': '理科'}
STATUS = ['どく', 'しびれ', 'やけど', 'こおり', 'こんらん', 'よわき']

P = dict(EXP=0.8, ALLRES=0.85, HPK=0.70, GANJO=0.5, RING=0.92, STORM=0.20, DEVIL=0.85, AXE=1.3, AXET=1.15, AMP=1.3, KANZASHI=1.2, RYO=1.5, RYOR=0.25, GRAV=1.0, UNI=1.0, SUNA=1.0, BIN=1.5, CUTCAP=0.25, HPCAP=0.40, Q=5, CRIT=0.10)

SKILLS = {  # 威力, CT
    '通常': (1.0, 0), '連続': (0.6, 1), 'ガード': (0.5, 1), 'ドレイン': (0.7, 1),
    'かんつう': (0.9, 1), 'カウンター': (0.7, 2), 'パワー': (2.0, 2), 'ふういん': (0.8, 2),
}

INFLICT = {  # 当たるたび状態異常をかけるアイテム: (状態, 確率)
    'どくキバ': ('どく', .30), 'かみなりの羽': ('しびれ', .30), 'ひのこ石': ('やけど', .30),
    'こおりの結晶': ('こおり', .20), 'うずまきキャンディ': ('こんらん', .20), 'しゃぼん玉の杖': ('よわき', .30),
    'もうどくビン': ('どく', .10), '雷鳴の太鼓': ('しびれ', .10), '火山のかけら': ('やけど', .10),
    '雪女のかんざし': ('こおり', .10), '道化のトランプ': ('こんらん', .10), 'やみの霧': ('よわき', .10),
}
AMP_VS = {'雷鳴の太鼓': 'しびれ', '雪女のかんざし': 'こおり', '道化のトランプ': 'こんらん'}

ITEMS = ['国語の紋章', '算数の紋章', '理科の紋章', '社会の紋章', '英語の紋章', '特化の王冠', 'バランスの天秤',
         'あばれ斧', 'ねらいのメガネ', '一撃の角', '背水の書', '弱点さがしの虫めがね', 'にじの紋章',
         'えんぴつのお守り', '連続正解の炎', '百科じてん', 'ひらめき電球', 'ひらめきメガネ', 'やり直し消しゴム', '失敗は成功のもと',
         'どくキバ', 'かみなりの羽', 'もうどくビン', '雷鳴の太鼓', 'みつまたの槍', '悪魔の契約書',
         'ひのこ石', '火山のかけら', 'こおりの結晶', '雪女のかんざし', 'うずまきキャンディ', '道化のトランプ', 'しゃぼん玉の杖', 'やみの霧',
         '木の盾', '城の大盾', 'トゲよろい', 'がんじょう石', 'おまもり', 'ばんそうこう', 'いのちの実', '巨人のハート', 'ドレインの牙',
         'すなどけい', 'はね返しの鏡', 'ふういんの鍵', '鉄壁のこて', '吸血マント', 'いかさまサイコロ', '運命の指輪',
         'おにぎり', '赤白ぼうし', 'ランドセル', '給食の牛乳', 'ラストのあめ', 'うわばき', 'くつした', 'じょうぎ', '教室のベル',
         'たこあげ', 'ジュース', 'くまのぬいぐるみ', '応援ラッパ', 'ふたつのお面', '竜の逆鱗', '両刃の剣', '運命の水晶', '嵐の羽',
         '重力の石', 'ユニコーンの角']
REQ = {'もうどくビン': 'どくキバ', '雷鳴の太鼓': 'かみなりの羽', '火山のかけら': 'ひのこ石', '雪女のかんざし': 'こおりの結晶',
       '道化のトランプ': 'うずまきキャンディ', 'やみの霧': 'しゃぼん玉の杖'}


def luck_of(st_):
    v = list(st_.values()); m = sum(v) / 5; cv = (sum((x - m) ** 2 for x in v) / 5) ** .5 / m
    return max(300, round(1000 - 500 * (cv / 1.6) ** 1.5))


def type_of(st_):
    best = max(SUBJ, key=lambda s: st_[s]); others = [st_[s] for s in SUBJ if s != best]
    return best if st_[best] >= 1.25 * sum(others) / 4 else '全教科'


class F:  # ファイター
    def __init__(s, name, stats, items, acc):
        s.name, s.st, s.items, s.acc = name, dict(stats), set(items), acc
        s.luck = luck_of(stats) - (100 if '特化の王冠' in s.items else 0)
        s.type = type_of(stats)
        hpm = 1 + .15 * ('いのちの実' in s.items) + .6 * ('巨人のハート' in s.items) + .08 * ('ランドセル' in s.items)
        hpm = min(hpm, 1 + P['HPCAP'])
        hpm *= .8 if '竜の逆鱗' in s.items else 1
        s.maxhp = sum(stats.values()) * P['HPK'] * hpm; s.hp = s.maxhp
        s.ct = Counter(); s.status = {}; s.used = set(); s.guard = 0; s.lastrecv = 0; s.lastdealt = 0
        s.skip = False; s.seal = {}; s.lastsubj = None; s.streak = 0; s.fail = 0; s.megane = 2; s.eraser = 1
        s.gekirin = False
        s.skills_used = Counter()

    def has(s, k): return k in s.items

    def cut(s):
        c = .10 * s.has('木の盾') + .35 * s.has('城の大盾') + .03 * s.has('ランドセル')
        if s.has('くまのぬいぐるみ') and s.hp <= .3 * s.maxhp: c += .20
        return min(c, P['CUTCAP'])


def subj_mult(a, s):
    m = 1.2 if a.has(s + 'の紋章') else 1
    if a.has('特化の王冠'):
        m *= 1.3 if s == max(SUBJ, key=lambda x: a.st[x]) else .7
    return m


def recv_mult(d, s):  # d が教科 s の攻撃を受ける倍率
    if d.type == '全教科': return P['ALLRES']
    if d.type in WEAK and WEAK[d.type] == s: return 1.15 if d.has('じょうぎ') else 1.25
    if d.type in RESIST and RESIST[d.type] == s: return .9
    return 1


def choose_subject(a, d, turn):
    sealed = {x for x, t in a.seal.items() if t >= turn}
    cands = [x for x in SUBJ if x not in sealed] or SUBJ
    if 'こんらん' in a.status: return random.choice(cands)
    def val(x):
        v = a.st[x] * subj_mult(a, x) * recv_mult(d, x)
        if a.has('にじの紋章') and x != a.lastsubj: v *= 1.15
        if a.has('弱点さがしの虫めがね') and recv_mult(d, x) > 1: v *= 1.15
        return v
    return max(cands, key=val)


def answer(a, n):
    """問題ゲージ・会心ボーナスなどを返す"""
    gauge = 0; correct = 0; streak3 = False; run = 0; bonus = 0
    for i in range(n):
        ok = random.random() < a.acc
        if not ok and a.has('ひらめきメガネ') and a.megane > 0:  # わからない問題を2択に
            a.megane -= 1; ok = random.random() < .5
        if ok:
            gauge += 1; correct += 1; run += 1
            if a.has('失敗は成功のもと') and a.fail: bonus += .15 * a.fail; a.fail = 0
            a.streak += 1
        else:
            if a.has('やり直し消しゴム') and a.eraser > 0: a.eraser -= 1; gauge += 1
            else: gauge += .5
            run = 0; a.fail += 1
            if a.has('連続正解の炎'): a.streak = 0
        if run >= 3: streak3 = True
    m = gauge / n * (1 + bonus / n)
    if a.has('えんぴつのお守り'): m *= 1 + min(.20, .04 * correct)
    if a.has('連続正解の炎'): m *= 1 + min(.60, .06 * a.streak)
    if a.has('百科じてん') and correct == n: m *= 1.3
    return m, correct, streak3


def choose_skill(a, d, turn, first):
    avail = [k for k in SKILLS if a.ct[k] <= 0]
    if 'こおり' in a.status: return '通常'
    if a.has('みつまたの槍') is False and False: pass
    est = sum(a.st.values()) / 5 * .85
    def ok(k): return k in avail
    if ok('パワー') and (turn == 3 or d.hp < est * 2.0 * 1.0 and d.hp > est): return 'パワー'
    if ok('カウンター') and a.lastrecv > .25 * a.maxhp and first: return 'カウンター'
    if d.has('がんじょう石') and 'がんじょう' not in d.used and ok('連続') and d.hp < est * 1.3: return '連続'
    if a.hp < .45 * a.maxhp:
        if ok('ドレイン'): return 'ドレイン'
        if ok('ガード') and first and turn < 3: return 'ガード'
    if ok('ふういん') and d.type not in ('全教科',) and turn < 3: return 'ふういん'
    inflictor = any(i in a.items for i in INFLICT) or a.has('嵐の羽')
    if ok('連続') and (inflictor or a.has('みつまたの槍')): return '連続'
    if ok('かんつう') and (d.cut() >= .15 or d.type == '全教科'): return 'かんつう'
    if ok('ドレイン') and a.hp < .8 * a.maxhp: return 'ドレイン'
    cands = [k for k in ('通常', '連続', 'かんつう') if ok(k)]
    return random.choice(cands) if random.random() < .3 else '通常'


def give_status(src, dst, stt, log):
    if stt in dst.status and stt != 'どく': dst.status[stt] = dst.status[stt]
    if dst.has('ユニコーンの角') and stt == 'どく': return
    if dst.has('おまもり') and 'おまもり' not in dst.used: dst.used.add('おまもり'); return
    dst.status[stt] = True
    if dst.has('教室のベル'): dst.hp = min(dst.maxhp, dst.hp + .05 * dst.maxhp)
    if dst.has('ユニコーンの角'): dst.hp = min(dst.maxhp, dst.hp + .05 * dst.maxhp)
    log['status'][stt] += 1


def proc_rate(a, d, base):
    r = base * (2.5 if a.has('悪魔の契約書') else 1) * (.5 if d.has('重力の石') else 1)
    return min(1, r)


def attack(a, d, turn, first, log):
    if a.skip: a.skip = False; a.lastdealt = 0; return
    sk = choose_skill(a, d, turn, first); a.skills_used[sk] += 1; log['skill'][sk] += 1
    pw, ct = SKILLS[sk]
    if sk in ('カウンター', 'パワー', 'ふういん') and a.has('すなどけい'): ct = 1
    a.ct[sk] = ct + 1
    subj = choose_subject(a, d, turn); a.lastsubj = subj
    g, correct, s3 = answer(a, P['Q'])
    avg = sum(a.st.values()) / 5
    base = avg * (a.st[subj] / avg) ** P['EXP'] * subj_mult(a, subj) * g
    m = 1.0
    if a.has('あばれ斧'): m *= P['AXE']
    if a.has('大盾_dummy'): pass
    if a.has('城の大盾'): m *= .8
    if a.has('巨人のハート'): m *= .8
    if a.has('悪魔の契約書'): m *= P['DEVIL']
    if a.has('すなどけい'): m *= P['SUNA']
    if a.has('両刃の剣'): m *= P['RYO']
    if a.has('重力の石'): m *= P['GRAV']
    if a.has('ユニコーンの角'): m *= P['UNI']
    if a.has('運命の指輪'): m *= P['RING']
    if a.has('バランスの天秤') and a.luck >= 900: m *= 1.15
    if a.has('背水の書'): m *= 1.5 if a.hp <= .5 * a.maxhp else .9
    if a.has('給食の牛乳') and turn == 1: m *= 1.15
    if a.has('ラストのあめ') and turn == 3: m *= 1.15
    if a.has('うわばき') and first: m *= 1.10
    if a.has('くつした') and not first: m *= 1.10
    if a.has('たこあげ') and sk == '通常': m *= 1.15
    if a.has('ジュース') and d.hp >= .5 * d.maxhp: m *= 1.12
    if a.has('応援ラッパ') and turn > 1 and a.lastdealt < d.lastdealt: m *= 1.20
    if a.has('ふたつのお面'): m *= 1.20 if (not first and d.lastsubj == subj) else .95
    if a.has('竜の逆鱗') and a.hp <= .5 * a.maxhp and 'げきりん' not in a.used: m *= 3; a.used.add('げきりん')
    for stt, amp in AMP_VS.items():
        if a.has(stt) and amp in d.status: m *= P['KANZASHI'] if stt == '雪女のかんざし' else P['AMP']
    if 'しびれ' in a.status: m *= .7; del a.status['しびれ']
    nocrit = a.has('運命の指輪')
    if 'よわき' in a.status: m *= .6 if d.has('やみの霧') else .8; nocrit = True; del a.status['よわき']
    # 会心
    if a.has('運命の水晶'): cr, cm = .25, 1.5
    else:
        cr = P['CRIT'] * a.luck / 1000 + .10 * a.has('ねらいのメガネ') + .25 * a.has('一撃の角') + (.25 if a.has('ひらめき電球') and s3 else 0); cm = 2
    if nocrit: cr = 0
    # ヒット数
    if sk == '連続': hits = [.45] * 3 if a.has('みつまたの槍') else [.6] * 2
    else: hits = [pw]
    total = 0
    for h in hits:
        if d.hp <= 0: break
        crit = random.random() < cr
        dmg = base * m * h
        if crit: dmg *= (1.5 if d.has('赤白ぼうし') and cm == 2 else cm)
        elif a.has('一撃の角'): dmg *= .8
        if sk == 'カウンター': dmg += a.lastrecv * (1 if a.has('はね返しの鏡') else .5) / 1  # 上乗せ
        if sk != 'かんつう':
            dmg *= recv_mult(d, subj) * (1 - d.cut())
            if d.guard: dmg *= (.3 if d.has('鉄壁のこて') else .5)
        if d.has('あばれ斧'): dmg *= P['AXET']
        if 'やけど' in d.status: dmg *= 1.4 if a.has('火山のかけら') else 1.2
        before = d.hp; d.hp -= dmg; total += dmg
        if d.hp <= 0 and d.has('がんじょう石') and 'がんじょう' not in d.used and before >= P['GANJO'] * d.maxhp:
            d.used.add('がんじょう'); d.hp = 1
        if d.has('トゲよろい'): a.hp -= .15 * dmg
        if a.has('両刃の剣'): a.hp -= P['RYOR'] * dmg
        # 状態異常
        for it, (stt, r) in INFLICT.items():
            if a.has(it) and random.random() < proc_rate(a, d, r): give_status(a, d, stt, log)
        if a.has('嵐の羽') and random.random() < proc_rate(a, d, P['STORM']): give_status(a, d, random.choice(STATUS), log)
        if d.has('嵐の羽') and random.random() < .3: give_status(d, a, random.choice(STATUS), log)
    d.guard = 0
    if sk == 'ガード': a.guard = 1
    if sk == 'ふういん':
        top = max(SUBJ, key=lambda x: d.st[x])
        d.seal[top] = (turn if first else turn + 1) + (1 if a.has('ふういんの鍵') else 0)
    if sk == 'パワー': a.skip = True
    heal = 0
    if sk == 'ドレイン': heal += .5 * total * (1.5 if a.has('吸血マント') else 1)
    if a.has('ドレインの牙'): heal += .1 * total
    a.hp = min(a.maxhp, a.hp + heal)
    d.lastrecv = total; a.lastdealt = total
    log['dmg'].append(total / d.maxhp)


def roulette(a, b):
    if a.has('運命の指輪') and not b.has('運命の指輪'): return a
    if b.has('運命の指輪') and not a.has('運命の指輪'): return b
    wa = a.luck * (1.25 if a.has('いかさまサイコロ') else 1); wb = b.luck * (1.25 if b.has('いかさまサイコロ') else 1)
    return a if random.random() < wa / (wa + wb) else b


def end_turn(f, log):
    if 'どく' in f.status: f.hp -= .10 * f.maxhp * (P['BIN'] if f.status.get('ビン') else 1)
    if f.has('おにぎり'): f.hp = min(f.maxhp, f.hp + .03 * f.maxhp)
    if f.has('ばんそうこう') and 0 < f.hp <= .3 * f.maxhp and 'ばんそうこう' not in f.used:
        f.used.add('ばんそうこう'); f.hp += .25 * f.maxhp
    for k in list(f.status):
        if k in ('やけど', 'こおり', 'こんらん'): f.status[k] = 'next' if f.status[k] is True else None
    for k in [k for k, v in f.status.items() if v is None]: del f.status[k]
    for k in f.ct: f.ct[k] -= 1


def battle(a, b, log):
    a.opp, b.opp = b, a
    for turn in (1, 2, 3):
        w = roulette(a, b); order = [w, w.opp]  # 権利を得た側は先攻を選ぶ
        log['rwin'][w.name] += 1
        for i, x in enumerate(order):
            y = x.opp
            if x.hp > 0 and y.hp > 0: attack(x, y, turn, i == 0, log)
        for f in (a, b):
            if f.hp > 0 or True:
                # もうどくビン：どくダメージ2倍
                if 'どく' in f.status and f.opp.has('もうどくビン'): f.status['ビン'] = True
                end_turn(f, log)
        if a.hp <= 0 or b.hp <= 0:
            if a.hp <= 0 and b.hp <= 0: return (a if a.hp / a.maxhp > b.hp / b.maxhp else b), 'KO', turn
            return (a if b.hp <= 0 else b), 'KO', turn
    return (a if a.hp / a.maxhp >= b.hp / b.maxhp else b), '判定', 3


def rand_stats(total, kind):
    if kind == 'バランス': w = [1, 1, 1, 1, 1]
    elif kind == '特化': w = [2.6, 1, 1, 1, 1]
    else: w = [random.uniform(.8, 1.6) for _ in SUBJ]
    random.shuffle(w); s = sum(w)
    return {SUBJ[i]: total * w[i] / s for i in range(5)}


def rand_items(k=4):
    while True:
        it = random.sample(ITEMS, k)
        if all(REQ.get(x) in it or x not in REQ for x in it): return it
