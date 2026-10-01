# 英語4年（外国語活動）の追加問題。単語は同じなかまの中から誤答をえらぶ
import random
rnd = random.Random(4)
Q = []
def add(t, a, x): Q.append(('英語', 4, t, a, x))

def vocab(group, pairs, both=True):
    """pairs = [(英語, 日本語)]。英→日、日→英の問題をつくる"""
    for i, (en, ja) in enumerate(pairs):
        others = [p for j, p in enumerate(pairs) if j != i]
        w = rnd.sample(others, 3)
        add(f'"{en}" の意味は？', [ja] + [p[1] for p in w], f'"{en}" は「{ja}」。')
        if both and i % 2 == 0:
            w = rnd.sample(others, 3)
            add(f'「{ja}」は英語で？', [en] + [p[0] for p in w], f'「{ja}」は "{en}"。')

vocab('色', [('red', '赤'), ('blue', '青'), ('yellow', '黄色'), ('green', '緑'), ('pink', 'ピンク'), ('orange', 'オレンジ色'), ('purple', 'むらさき'), ('black', '黒'), ('white', '白'), ('brown', '茶色')])
vocab('動物', [('cat', 'ねこ'), ('dog', 'いぬ'), ('rabbit', 'うさぎ'), ('elephant', 'ぞう'), ('lion', 'ライオン'), ('monkey', 'さる'), ('bear', 'くま'), ('tiger', 'とら'), ('horse', 'うま'), ('cow', 'うし'), ('pig', 'ぶた'), ('bird', '鳥'), ('mouse', 'ねずみ'), ('frog', 'かえる')])
vocab('食べ物', [('apple', 'りんご'), ('banana', 'バナナ'), ('grapes', 'ぶどう'), ('strawberry', 'いちご'), ('peach', 'もも'), ('lemon', 'レモン'), ('tomato', 'トマト'), ('potato', 'じゃがいも'), ('onion', 'たまねぎ'), ('carrot', 'にんじん'), ('cake', 'ケーキ'), ('bread', 'パン'), ('rice', 'ごはん'), ('egg', 'たまご')])
vocab('体', [('head', '頭'), ('hand', '手'), ('eye', '目'), ('ear', '耳'), ('nose', '鼻'), ('mouth', '口'), ('shoulder', 'かた'), ('knee', 'ひざ'), ('foot', '足'), ('arm', 'うで')])
vocab('天気', [('sunny', '晴れ'), ('rainy', '雨'), ('cloudy', 'くもり'), ('snowy', '雪'), ('windy', '風が強い')])
vocab('形', [('circle', '丸'), ('square', '正方形'), ('triangle', '三角形'), ('star', '星'), ('heart', 'ハート'), ('rectangle', '長方形'), ('diamond', 'ひし形')])
vocab('文ぼう具', [('pen', 'ペン'), ('pencil', 'えんぴつ'), ('eraser', 'けしゴム'), ('ruler', 'じょうぎ'), ('notebook', 'ノート'), ('scissors', 'はさみ'), ('glue', 'のり'), ('pencil case', 'ふでばこ'), ('crayon', 'クレヨン'), ('stapler', 'ホッチキス')])
vocab('学校の部屋', [('classroom', '教室'), ('music room', '音楽室'), ('library', '図書室'), ('gym', '体育館'), ('science room', '理科室'), ('computer room', 'コンピューター室'), ('playground', '運動場'), ('restroom', 'トイレ'), ("school nurse's office", '保健室')])
vocab('気持ち', [('happy', 'うれしい'), ('sad', '悲しい'), ('angry', 'おこっている'), ('sleepy', 'ねむい'), ('tired', 'つかれている'), ('hungry', 'おなかがすいている'), ('fine', '元気な')])
vocab('スポーツ', [('soccer', 'サッカー'), ('baseball', '野球'), ('basketball', 'バスケットボール'), ('tennis', 'テニス'), ('swimming', '水泳'), ('volleyball', 'バレーボール'), ('table tennis', 'たっきゅう'), ('dodgeball', 'ドッジボール')])
vocab('曜日', [('Monday', '月曜日'), ('Tuesday', '火曜日'), ('Wednesday', '水曜日'), ('Thursday', '木曜日'), ('Friday', '金曜日'), ('Saturday', '土曜日'), ('Sunday', '日曜日')], both=False)

# ---- 数 ----
NUM = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen',
       14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty'}
for n in [3, 9, 11, 13, 14, 16, 17, 18, 19, 30, 40, 50, 60]:
    near = {13: [30, 3, 15], 14: [40, 4, 16], 16: [60, 6, 17], 17: [70, 7, 16], 18: [80, 8, 19], 19: [90, 9, 18], 30: [13, 3, 40], 40: [14, 4, 50], 50: [15, 5, 60], 60: [16, 6, 50]}.get(n, [n + 1, n - 1, n + 2])
    add(f'"{NUM[n]}" はいくつ？', [str(n)] + [str(x) for x in near], f'"{NUM[n]}" は {n}。')
for n in [4, 6, 11, 13, 30, 50]:
    cand = [k for k in NUM if k != n]
    near = {13: [30, 3, 14], 30: [13, 3, 40], 50: [15, 5, 60]}.get(n, rnd.sample(cand, 3))
    add(f'「{n}」は英語で？', [NUM[n]] + [NUM[x] for x in near], f'{n} は "{NUM[n]}"。')

# ---- アルファベット ----
for a in ['F', 'K', 'P', 'T', 'W']:
    i = ord(a) - 65
    add(f'アルファベットで「{a}」の次は？', [chr(66 + i)] + [chr(64 + i), chr(67 + i), chr(68 + i)], f'{chr(64 + i)}・{a}・{chr(66 + i)} の順。')
for a in ['b', 'd', 'q', 'g']:
    wr = {'b': ['D', 'P', 'Q'], 'd': ['B', 'P', 'Q'], 'q': ['P', 'G', 'D'], 'g': ['Q', 'J', 'C']}[a]
    add(f'小文字「{a}」の大文字は？', [a.upper()] + wr, f'「{a}」の大文字は「{a.upper()}」。形のにている文字に注意。')

# ---- あいさつ・表現 ----
for t, a, wr, x in [
    ('"Good afternoon." の意味は？', 'こんにちは', ['おはよう', 'こんばんは', 'おやすみなさい'], '午後のあいさつ。'),
    ('"Good evening." の意味は？', 'こんばんは', ['おはよう', 'こんにちは', 'さようなら'], '夕方から夜のあいさつ。'),
    ('"See you." の意味は？', 'またね', ['はじめまして', 'ありがとう', 'ごめんなさい'], '別れるときのあいさつ。'),
    ('"I\'m sorry." の意味は？', 'ごめんなさい', ['ありがとう', 'どういたしまして', 'おめでとう'], 'あやまるときの言葉。'),
    ('"You\'re welcome." の意味は？', 'どういたしまして', ['ありがとう', 'ごめんなさい', 'はじめまして'], '"Thank you." への返事。'),
    ('"Here you are." の意味は？', 'はい、どうぞ', ['ありがとう', 'ここはどこ？', 'またね'], '物をわたすときの言葉。'),
    ('"This is for you." の意味は？', 'これはあなたにです', ['これは何ですか', 'これはわたしのです', 'あなたはだれですか'], 'プレゼントをわたすときの言葉。'),
    ('"How\'s the weather?" の意味は？', '天気はどうですか', ['何時ですか', '何曜日ですか', 'お元気ですか'], '天気をたずねる表現。'),
    ('"What do you want?" の意味は？', '何がほしいですか', ['何が好きですか', '何をしていますか', '何時ですか'], '"I want 〜." と答える。'),
    ('"Do you have a ruler?" に「いいえ」と答えるときは？', "No, I don't.", ['No, I am not.', 'No, I can.', 'Yes, I do.'], '"Do you 〜?" には "Yes, I do." / "No, I don\'t." で答える。'),
    ('"Do you like dogs?" に「はい」と答えるときは？', 'Yes, I do.', ["No, I don't.", 'Yes, I am.', 'Yes, I can.'], '"Do you 〜?" には do で答える。'),
    ('"What time is it?" に「3時です」と答えるときは？', "It's three o'clock.", ["It's Monday.", "I'm three.", "It's sunny."], '時こくは "It\'s 〜 o\'clock." で答える。'),
    ('"What day is it?" に「金曜日です」と答えるときは？', "It's Friday.", ["It's five.", "It's fine.", "It's rainy."], '曜日は "It\'s 〜day." で答える。'),
    ('"How\'s the weather?" に「晴れです」と答えるときは？', "It's sunny.", ["It's Sunday.", "I'm happy.", "It's seven."], '天気は "It\'s 〜." で答える。'),
    ('"Let\'s play dodgeball." の意味は？', 'ドッジボールをしよう', ['ドッジボールが好き', 'ドッジボールを持っている', 'ドッジボールができない'], '"Let\'s 〜." は「〜しよう」。'),
    ('"I don\'t like carrots." の意味は？', 'にんじんが好きではない', ['にんじんが好き', 'にんじんがほしい', 'にんじんを持っている'], '"don\'t like" は「好きではない」。'),
    ('"I want a red pen." の意味は？', '赤いペンがほしい', ['赤いペンが好き', '赤いペンを持っている', '赤いペンを使う'], '"want" は「ほしい」。'),
    ('"Go to the music room." の意味は？', '音楽室に行きなさい', ['音楽室から来なさい', '音楽室は好きですか', '音楽室はどこですか'], '"Go to 〜." は「〜に行きなさい」。'),
    ('"Where is the gym?" の意味は？', '体育館はどこですか', ['体育館は何ですか', '体育館は好きですか', '体育館に行こう'], '"Where is 〜?" は場所をたずねる。'),
    ('"It\'s my favorite place." の意味は？', 'わたしのお気に入りの場所です', ['わたしの家の場所です', 'わたしの行きたい場所です', 'わたしのきらいな場所です'], '"favorite" は「いちばん好きな・お気に入りの」。'),
    ('"Look." の意味は？', '見て', ['聞いて', 'すわって', '書いて'], '"Look." は「見て」。"Listen." は「聞いて」。'),
    ('"Listen." の意味は？', '聞いて', ['見て', '話して', '立って'], '"Listen." は「聞いて」。'),
    ('"How many apples?" の答えとして合うのは？', 'Five apples.', ['Yes, I do.', "It's red.", "I'm fine."], '"How many 〜?" には数で答える。'),
    ('"Who are you?" の答えとして合うのは？', "I'm a rabbit.", ["I'm fine.", "It's sunny.", 'Yes, I am.'], '"Who are you?" は「あなたはだれ？」。'),
    ('"What do you want?" の答えとして合うのは？', 'I want a banana, please.', ['I like Monday.', "It's two o'clock.", "I'm hungry."], '"I want 〜, please." で答える。'),
]:
    add(t, [a] + wr, x)

# 多すぎるので、単語の問題を へらす（同じ問題文の既存問題は add_questions がとばす）
import json, subprocess, pathlib
_root = pathlib.Path(__file__).resolve().parent.parent.parent
_db = json.loads(subprocess.run(['node', '-e', "global.window={};require('./questions.js');console.log(JSON.stringify(window.QUESTION_DB))"], cwd=_root, capture_output=True, text=True).stdout)
_have = {q[3] for q in _db}
Q = [q for q in Q if q[2] not in _have and q[2] != '「保健室」は英語で？']
_vocab = [q for q in Q if q[2].endswith('の意味は？') and q[2].count(' ') <= 3 and not q[2].startswith('"I') or q[2].endswith('は英語で？')]
_keep = set(id(q) for q in rnd.sample(_vocab, max(0, len(_vocab) - (len(Q) - 117)))) if len(Q) > 117 else set(id(q) for q in _vocab)
Q = [q for q in Q if q not in _vocab or id(q) in _keep]
