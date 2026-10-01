# 英語6年（外国語）の追加問題
import random, json, subprocess, pathlib
rnd = random.Random(6)
Q = []
def add(t, a, x): Q.append(('英語', 6, t, a, x))
def vocab(pairs, both=True, step=2):
    for i, (en, ja) in enumerate(pairs):
        others = [p for j, p in enumerate(pairs) if j != i]
        w = rnd.sample(others, 3)
        add(f'"{en}" の意味は？', [ja] + [p[1] for p in w], f'"{en}" は「{ja}」。')
        if both and i % step == 0:
            w = rnd.sample(others, 3)
            add(f'「{ja}」は英語で？', [en] + [p[0] for p in w], f'「{ja}」は "{en}"。')

# ---- 過去形 ----
PAST = [('go', 'went'), ('eat', 'ate'), ('see', 'saw'), ('have', 'had'), ('make', 'made'), ('get', 'got'), ('buy', 'bought'), ('swim', 'swam'), ('run', 'ran'), ('sing', 'sang'), ('come', 'came'), ('write', 'wrote')]
for base, past in PAST[5:]:
    others = [p for b, p in PAST if p != past]
    add(f'"{base}" の過去形は？', [past] + rnd.sample([f'{base}ed', f'{base}s'] + others, 3), f'"{base}" の過去形は "{past}"。（不規則に変わる）')
for base in ['play', 'watch', 'visit', 'enjoy', 'cook', 'study']:
    past = base[:-1] + 'ied' if base.endswith('y') and base[-2] not in 'aeiou' else base + 'ed'
    add(f'"{base}" の過去形は？', [past, base + 's', base + 'ing', base[:-1] + 'ied' if past.endswith('ed') and not past.endswith('ied') else base + 'd'], f'"{base}" の過去形は "{past}"。')
add('"is" の過去形は？', ['was', 'were', 'are', 'did'], '"is"・"am" の過去形は "was"。')

# ---- 思い出・行事 ----
vocab([('sports day', '運動会'), ('school trip', '修学旅行'), ('music festival', '音楽会'), ('field trip', '遠足'), ('swimming meet', '水泳大会'), ('graduation ceremony', '卒業式'), ('drama festival', '学芸会'), ('volunteer day', 'ボランティアの日')])
vocab([('went camping', 'キャンプに行った'), ('went fishing', 'つりに行った'), ('went shopping', '買い物に行った'), ('saw fireworks', '花火を見た'), ('ate shaved ice', 'かき氷を食べた'), ('enjoyed swimming', '泳ぐのを楽しんだ'), ('visited my grandparents', '祖父母をたずねた'), ('watched a movie', '映画を見た')])
vocab([('delicious', 'とてもおいしい'), ('exciting', 'わくわくする'), ('interesting', 'おもしろい（興味深い）'), ('beautiful', '美しい'), ('wonderful', 'すばらしい'), ('fun', '楽しい'), ('boring', 'たいくつな'), ('scary', 'こわい')])

# ---- 国・自然・町 ----
vocab([('America', 'アメリカ'), ('Canada', 'カナダ'), ('Brazil', 'ブラジル'), ('India', 'インド'), ('Egypt', 'エジプト'), ('Korea', '韓国'), ('Italy', 'イタリア'), ('Germany', 'ドイツ'), ('Spain', 'スペイン'), ('the U.K.', 'イギリス'), ('Kenya', 'ケニア'), ('Russia', 'ロシア')], step=3)
vocab([('river', '川'), ('sea', '海'), ('lake', '湖'), ('forest', '森'), ('beach', '砂浜'), ('island', '島'), ('mountain', '山'), ('volcano', '火山')])
vocab([('temple', '寺'), ('shrine', '神社'), ('castle', '城'), ('bridge', '橋'), ('stadium', 'スタジアム'), ('aquarium', '水族館'), ('amusement park', '遊園地'), ('department store', 'デパート')])

# ---- 中学校・将来 ----
vocab([('baseball team', '野球部'), ('brass band', 'すいそう楽部'), ('art club', '美術部'), ('science club', '科学部'), ('track and field team', '陸上部'), ('chorus', '合唱部')], step=3)
vocab([('astronaut', '宇宙飛行士'), ('artist', '芸術家'), ('zookeeper', '動物園の飼育員'), ('comedian', 'お笑い芸人'), ('carpenter', '大工'), ('game creator', 'ゲームクリエイター'), ('programmer', 'プログラマー'), ('designer', 'デザイナー')], step=3)

# ---- 文の意味・答え方 ----
for t, a, wr, x in [
    ('"I went to the zoo with my family." の意味は？', '家族と動物園に行きました', ['家族と動物園に行きたいです', '家族と動物園に行きます', '家族は動物園が好きです'], '"went" は "go" の過去形。'),
    ('"I enjoyed the music festival." の意味は？', '音楽会を楽しみました', ['音楽会を楽しみにしています', '音楽会が好きではありません', '音楽会に行きたいです'], '"enjoyed" は "enjoy" の過去形。'),
    ('"What did you eat?" の答えとして合うのは？', 'I ate sushi.', ['I eat sushi.', 'I like sushi.', 'I want sushi.'], '過去のことなので ate を使う。'),
    ('"Where did you go?" の答えとして合うのは？', 'I went to Okinawa.', ['I go to Okinawa.', 'I want to go to Okinawa.', 'I live in Okinawa.'], '過去のことなので went を使う。'),
    ('"How was it?" の答えとして合うのは？', 'It was exciting.', ['It is a cat.', 'I went there.', 'Yes, I did.'], '感想は "It was 〜." で答える。'),
    ('"What do you want to be?" の答えとして合うのは？', 'I want to be a doctor.', ['I want a doctor.', 'I am a doctor.', 'I went to the doctor.'], '"I want to be 〜." で答える。'),
    ('"What club do you want to join?" の答えとして合うのは？', 'I want to join the art club.', ['I like art.', 'I joined the art club.', 'I am in the art club.'], '中学校で入りたい部活を答える。'),
    ('"What do you want to do in junior high school?" の答えとして合うのは？', 'I want to study hard.', ['I studied hard.', 'I am a student.', 'I like school.'], '"I want to 〜." で答える。'),
    ('"Where do you want to go?" に、理由も言うとき合うのは？', 'I want to go to Egypt. I want to see the pyramids.', ['I went to Egypt. I saw the pyramids.', 'I like Egypt. It is a big country.', 'I live in Egypt. It is hot there.'], 'したいことを続けて言うと理由になる。'),
    ('"We have a big festival in our town." の意味は？', 'わたしたちの町には大きな祭りがあります', ['わたしたちの町には大きな祭りがありません', 'わたしたちの町に大きな祭りがほしい', 'わたしたちは大きな祭りに行きました'], '"We have 〜." で町にあるものをしょうかいする。'),
    ('"We don\'t have a zoo." の意味は？', '動物園がありません', ['動物園があります', '動物園に行きたい', '動物園が好きです'], '"don\'t have" は「〜がない」。'),
    ('"I want a library in my town." の意味は？', '町に図書館がほしいです', ['町に図書館があります', '町の図書館に行きました', '町の図書館が好きです'], '町にほしいものを伝える表現。'),
    ('"Where is curry from?" の答えとして合うのは？', "It's from India.", ['I like curry.', 'I ate curry.', "It's delicious."], '"from 〜" は「〜から来た・〜産の」。'),
    ('"This is my best memory." の意味は？', 'これがわたしのいちばんの思い出です', ['これはわたしの大切な宝物です', 'これはわたしの好きな食べ物です', 'これはわたしの行きたい所です'], '"memory" は「思い出」。'),
    ('"I\'m going to be a junior high school student." の意味は？', 'わたしは中学生になります', ['わたしは中学生でした', 'わたしは中学生になりたくありません', 'わたしは中学校の先生になります'], '"be going to 〜" は「〜するつもりだ・〜する予定だ」。'),
    ('"Thank you for everything." の意味は？', 'いろいろとありがとう', ['どういたしまして', 'またね', 'はじめまして'], '卒業のときなどに使う表現。'),
    ('"I like Japanese culture." の culture の意味は？', '文化', ['料理', '天気', '動物'], '"culture" は「文化」。'),
    ('"You can eat sushi in Japan." の意味は？', '日本ではすしが食べられます', ['日本ではすしが食べられません', '日本ですしを食べました', '日本ですしを作ります'], '"You can 〜." で、その場所でできることをしょうかいする。'),
    ('"It\'s a famous place." の意味は？', '有名な場所です', ['小さな場所です', '新しい場所です', '静かな場所です'], '"famous" は「有名な」。'),
    ('"Let\'s save the earth." の save の意味は？', '守る', ['こわす', 'えがく', 'ちらかす'], '"save" は「守る・救う」。'),
    ('"Plastic bags are a problem for sea animals." の意味は？', 'レジぶくろは海の動物にとって問題です', ['レジぶくろは海の動物にとって大切です', '海の動物はレジぶくろが好きです', '海の動物はレジぶくろを使います'], '"problem" は「問題」。'),
    ('"I can use my own bag." の意味は？', '自分のかばん（マイバッグ）を使えます', ['自分のかばんを持っていません', '自分のかばんをなくしました', '自分のかばんを買いたいです'], '環境のためにできることを伝える表現。'),
    ('"Did you enjoy it?" に「はい」と答えるときは？', 'Yes, I did.', ['Yes, I do.', 'Yes, I can.', 'Yes, I was.'], '"Did you 〜?" には "Yes, I did." / "No, I didn\'t." で答える。'),
    ('"I didn\'t go to school yesterday." の意味は？', 'きのうは学校に行きませんでした', ['きのうは学校に行きました', 'あしたは学校に行きません', '今日は学校に行きます'], '"didn\'t" は過去の打ち消し。'),
]:
    add(t, [a] + wr, x)

_root = pathlib.Path(__file__).resolve().parent.parent.parent
_db = json.loads(subprocess.run(['node', '-e', "global.window={};require('./questions.js');console.log(JSON.stringify(window.QUESTION_DB))"], cwd=_root, capture_output=True, text=True).stdout)
_have = {q[3] for q in _db}
Q = [q for q in Q if q[2] not in _have]
_v = [q for q in Q if q[2].endswith('は英語で？')]
if len(Q) > 117:
    drop = set(id(q) for q in rnd.sample(_v, min(len(_v), len(Q) - 117)))
    Q = [q for q in Q if id(q) not in drop]
