# 英語5年（外国語）の追加問題
import random, json, subprocess, pathlib
rnd = random.Random(5)
Q = []
def add(t, a, x): Q.append(('英語', 5, t, a, x))
def vocab(pairs, both=True, step=2):
    for i, (en, ja) in enumerate(pairs):
        others = [p for j, p in enumerate(pairs) if j != i]
        w = rnd.sample(others, 3)
        add(f'"{en}" の意味は？', [ja] + [p[1] for p in w], f'"{en}" は「{ja}」。')
        if both and i % step == 0:
            w = rnd.sample(others, 3)
            add(f'「{ja}」は英語で？', [en] + [p[0] for p in w], f'「{ja}」は "{en}"。')

vocab([('January', '1月'), ('February', '2月'), ('March', '3月'), ('April', '4月'), ('May', '5月'), ('June', '6月'), ('July', '7月'), ('August', '8月'), ('September', '9月'), ('October', '10月'), ('November', '11月'), ('December', '12月')], step=1)
vocab([('spring', '春'), ('summer', '夏'), ('fall', '秋'), ('winter', '冬')], step=1)
vocab([('first', '1日（1番目）'), ('second', '2日（2番目）'), ('third', '3日（3番目）'), ('fifth', '5日（5番目）'), ('tenth', '10日（10番目）'), ('twelfth', '12日（12番目）'), ('twentieth', '20日（20番目）'), ('thirty-first', '31日（31番目）')], both=False)
vocab([('Japanese', '国語'), ('math', '算数'), ('science', '理科'), ('social studies', '社会'), ('music', '音楽'), ('arts and crafts', '図工'), ('P.E.', '体育'), ('home economics', '家庭科'), ('English', '英語'), ('calligraphy', '書写')])
vocab([('teacher', '先生'), ('doctor', '医者'), ('nurse', '看護師'), ('firefighter', '消防士'), ('police officer', '警察官'), ('baker', 'パン屋'), ('florist', '花屋'), ('farmer', '農家の人'), ('cook', '料理人'), ('vet', 'じゅう医'), ('pilot', 'パイロット'), ('singer', '歌手'), ('scientist', '科学者'), ('soccer player', 'サッカー選手')])
vocab([('mother', '母'), ('father', '父'), ('sister', '姉・妹'), ('brother', '兄・弟'), ('grandfather', '祖父'), ('grandmother', '祖母'), ('uncle', 'おじ'), ('aunt', 'おば'), ('cousin', 'いとこ'), ('friend', '友だち')])
vocab([('station', '駅'), ('hospital', '病院'), ('park', '公園'), ('post office', '郵便局'), ('bookstore', '書店'), ('supermarket', 'スーパーマーケット'), ('restaurant', 'レストラン'), ('police station', '警察署'), ('fire station', '消防署'), ('zoo', '動物園'), ('museum', '博物館'), ('school', '学校'), ('convenience store', 'コンビニ'), ('bank', '銀行')])
vocab([('kind', 'やさしい'), ('cool', 'かっこいい'), ('funny', 'おもしろい'), ('brave', '勇かんな'), ('smart', 'かしこい'), ('friendly', 'フレンドリーな'), ('active', '活発な'), ('cute', 'かわいい')])
vocab([('always', 'いつも'), ('usually', 'たいてい'), ('sometimes', 'ときどき'), ('never', '一度も〜ない')], both=False)
vocab([('get up', '起きる'), ('go to school', '学校へ行く'), ('do my homework', '宿題をする'), ('take a bath', 'ふろに入る'), ('go to bed', 'ねる'), ('wash the dishes', '皿をあらう'), ('walk my dog', '犬の散歩をする'), ('take out the garbage', 'ごみを出す'), ('clean my room', '部屋をそうじする'), ('eat breakfast', '朝ごはんを食べる')])
vocab([('sing', '歌う'), ('dance', 'おどる'), ('swim', '泳ぐ'), ('cook', '料理する'), ('skate', 'スケートをする'), ('ride a unicycle', '一輪車に乗る'), ('play the piano', 'ピアノをひく'), ('run fast', '速く走る')], step=3)

# ---- 位置・道案内 ----
for t, a, wr, x in [
    ('"The pen is in the box." のペンの場所は？', '箱の中', ['箱の上', '箱の下', '箱のそば'], '"in" は「〜の中に」。'),
    ('"The cat is by the door." のねこの場所は？', 'ドアのそば', ['ドアの中', 'ドアの上', 'ドアの下'], '"by" は「〜のそばに」。'),
    ('"Go straight for two blocks." の意味は？', 'まっすぐ2区画進む', ['右に2回曲がる', '2つ目の角を左', '2分待つ'], '"block" は区画（道で区切られた一画）。'),
    ('"Turn left at the second corner." の意味は？', '2つ目の角を左に曲がる', ['2つ目の角を右に曲がる', '1つ目の角を左に曲がる', '2つ目の角をまっすぐ'], '"second corner" は「2つ目の角」。'),
    ('"You can see it on your right." の意味は？', 'あなたの右手に見えます', ['あなたの左手に見えます', 'まっすぐ前に見えます', 'うしろに見えます'], '"on your right" は「右手に」。'),
    ('"Where is the post office?" の答えとして合うのは？', 'Go straight and turn right.', ["It's sunny.", "I'm ten.", 'Yes, I can.'], '道案内の表現で答える。'),
]:
    add(t, [a] + wr, x)

# ---- たずねる・答える ----
for t, a, wr, x in [
    ('"When is your birthday?" に「4月5日です」と答えるとき、正しいのは？', 'My birthday is April 5th.', ['My birthday is May 4th.', "I'm five.", 'It is Monday.'], '日付は「月＋日（序数）」で言う。'),
    ('"What do you want for your birthday?" の答えとして合うのは？', 'I want a new bike.', ['I like dogs.', 'My birthday is May 1st.', "I'm fine."], '"I want 〜." で答える。'),
    ('"Can you cook?" に「いいえ」と答えるときは？', "No, I can't.", ["No, I don't.", 'No, I am not.', 'Yes, I can.'], '"Can you 〜?" には can で答える。'),
    ('"Who is she?" の答えとして合うのは？', 'She is my sister.', ['He is my brother.', "I'm Ken.", 'It is a dog.'], '女の人には she を使う。'),
    ('"Who is he?" の答えとして合うのは？', 'He is my teacher.', ['She is my mother.', "It's my cat.", "I'm a teacher."], '男の人には he を使う。'),
    ('"Can she swim?" に「はい」と答えるときは？', 'Yes, she can.', ['Yes, he can.', 'Yes, I can.', 'Yes, she is.'], '主語が she なので "Yes, she can."。'),
    ('"What would you like?" に「ピザをください」と答えるときは？', "I'd like pizza, please.", ['I like pizza.', 'I have pizza.', 'Pizza is mine.'], '"I\'d like 〜." は「〜がほしいです（ていねい）」。'),
    ('"How much is it?" に「500円です」と答えるときは？', "It's 500 yen.", ["It's five o'clock.", "I'm five.", 'I have 500.'], '値段は "It\'s 〜 yen." で答える。'),
    ('"What time do you go to bed?" の答えとして合うのは？', 'I usually go to bed at nine.', ['I usually get up at six.', 'I go to school.', "It's nine."], 'ねる時こくを答える。'),
    ('"What subject do you like?" の答えとして合うのは？', 'I like science.', ['I like apples.', 'I like soccer.', 'I like blue.'], 'subject は教科。'),
    ('"What do you have on Monday?" の答えとして合うのは？', 'I have math and music.', ["It's Monday.", 'I like Monday.', 'I am fine.'], '時間割をたずねられている。'),
    ('"Where do you want to go?" の答えとして合うのは？', 'I want to go to Italy.', ['I want a pen.', 'I like Italy.', 'I went to Italy.'], '"I want to go to 〜." で答える。'),
    ('"Why?" と理由を聞かれて答えるとき、よく使う言葉は？', 'Because', ['When', 'Where', 'Who'], '"Because 〜." で理由を言う。'),
    ('"How do you spell your name?" の意味は？', 'あなたの名前はどうつづりますか', ['あなたの名前は何ですか', 'あなたは何さいですか', 'あなたはどこに住んでいますか'], 'spell は「つづりを言う」。'),
    ('"What\'s your name?" の答えとして合うのは？', 'My name is Aoi.', ["I'm ten years old.", 'I like Aoi.', "It's Aoi's pen."], '名前は "My name is 〜." で答える。'),
    ('"I can play the recorder." の意味は？', 'わたしはリコーダーがふけます', ['わたしはリコーダーが好きです', 'わたしはリコーダーを持っています', 'わたしはリコーダーがふけません'], '"can" は「〜できる」。'),
    ('"She can\'t ride a bike." の意味は？', '彼女は自転車に乗れません', ['彼女は自転車に乗れます', '彼女は自転車が好きです', '彼女は自転車を持っています'], '"can\'t" は「〜できない」。'),
    ('"He is good at singing." の意味は？', '彼は歌うのが得意です', ['彼は歌うのが苦手です', '彼は歌が好きではありません', '彼は歌手です'], '"be good at 〜" は「〜が得意」。'),
    ('"I sometimes play tennis." の sometimes の意味は？', 'ときどき', ['いつも', 'たいてい', '一度もない'], '頻度を表す言葉。'),
    ('"I never eat natto." の意味は？', 'わたしは一度も納豆を食べません', ['わたしはいつも納豆を食べます', 'わたしはときどき納豆を食べます', 'わたしはたいてい納豆を食べます'], '"never" は「一度も〜ない」。'),
]:
    add(t, [a] + wr, x)

_root = pathlib.Path(__file__).resolve().parent.parent.parent
_db = json.loads(subprocess.run(['node', '-e', "global.window={};require('./questions.js');console.log(JSON.stringify(window.QUESTION_DB))"], cwd=_root, capture_output=True, text=True).stdout)
_have = {q[3] for q in _db}
Q = [q for q in Q if q[2] not in _have]
_v = [q for q in Q if q[2].endswith('は英語で？') or (q[2].endswith('の意味は？') and q[2].count(' ') <= 4 and '"' in q[2] and q[2].index('"', 1) < 22)]
if len(Q) > 117:
    drop = set(id(q) for q in rnd.sample(_v, min(len(_v), len(Q) - 117)))
    Q = [q for q in Q if id(q) not in drop]
