// ===== まなびバトル 本体 =====
// ①-1 ホーム → 育成ダンジョン → CPUボス戦 → リザルト
// ①-2 セーブ（1問ごとに自動保存・続きから）＋ 画像の差しかえ（assets.js）
(function () {
  'use strict';
  const D = window.DATA, K = D.K, SUBJ = D.SUBJ, A = window.ASSETS || {};
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const T = ms => (window.FAST ? ms / 50 : ms);
  const wait = ms => new Promise(r => setTimeout(r, T(ms)));
  const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
  const shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R0 = n => Math.round(n);
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---- 画面の拡大縮小 ----
  function fit() { const s = Math.min(innerWidth / 1280, innerHeight / 720); $('#stage').style.transform = `translate(-50%,-50%) scale(${s})`; }
  addEventListener('resize', fit); fit();

  // ---- 画像（assets.js にパスがあれば画像、なければ絵文字）----
  function art(path, emoji) {
    if (!path) return `<span class="art">${emoji}</span>`;
    return `<span class="art"><img src="${esc(path)}" alt="" style="height:1em;width:auto;vertical-align:middle" onerror="this.parentNode.textContent='${emoji}'"></span>`;
  }
  const g2 = (o, ...k) => k.reduce((x, y) => (x && x[y] !== undefined ? x[y] : ''), o);
  // p：せいかく・すがたの記録をもつもの（ふつうは S。対戦では QR の中身）
  const artPlayer = (type, t, p = S) => art(g2(A, 'player', type, styleFor(p, t), lookStage(t)), lookOf(type, t, p));
  const artItem = n => art(g2(A, 'item', n), D.ITEM[n].e).replace('class="art"', 'class="art pix"'); // ドット絵は くっきり
  const artZako = e => art(g2(A, 'zako', e), e);
  const artNpc = (n, e) => art(g2(A, 'npc', n), e);
  const artUi = (k, e) => art(g2(A, 'ui', k), e);
  // 教科のアイコン（画像がなければ 絵文字）
  const subjIc = s => `<span class="sji">${art(g2(A, 'subj', s), D.SUBJ_EMO[s])}</span>`;
  const ic = (k, e) => `<span class="ic">${artUi(k, e)}</span>`; // UIのアイコン（画像がなければ絵文字）
  const mi = (k, e) => `<span class="mi">${art(g2(A, 'menu', k), e)}</span>`; // メニューのアイコン
  const mb = (k, e, title, sub) => `${mi(k, e)}<span class="mt">${title}${sub !== undefined ? `<small>${sub}</small>` : ''}</span>`;
  const hearts = (n, max) => ic('heart', '❤️').repeat(n) + ic('heartEmpty', '🖤').repeat(max - n);
  const BG = { home: 'home', dun: 'dungeon', btl: 'battle', res: 'result', title: 'title', name: 'name' };

  // ---- 乱数（ダンジョンは入ったときに種を決める。状態をセーブできる）----
  function makeRng(seed) {
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.state = () => a; return f;
  }

  // ---- 問題 ----
  const Q = {}, QBY = {}; SUBJ.forEach(s => (QBY[s] = []));
  window.QUESTION_DB.forEach(r => { const q = { id: r[0], s: r[1], g: r[2], t: r[3], a: r[4], x: r[5] }; Q[q.id] = q; if (QBY[q.s]) QBY[q.s].push(q); });

  // =====================================================================
  // 状態とセーブ
  // =====================================================================
  // qs[id]: 2=復習待ち 3=あと1回 4=卒業（qd[id] = 最後に1段階上がった日。1日1回まで）
  // 全問 最低2回 正解して卒業：ダンジョンで正解→あと1回／不正解→復習待ち → 復習ダンジョンで1段階ずつ上がる
  const SAVE_KEY = 'manabi_battle_save', SAVE_V = 3;
  let S = null;   // セーブデータ本体
  let R = null;   // いまのダンジョン（S.run にしまう）
  let BT = null;  // いまのボス戦（R.bt にしまう）

  function today() { const d = new Date(Date.now() - 5 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function newState(pname, cname) {
    const st = {}; SUBJ.forEach(s => (st[s] = K.START_STAT));
    return { v: SAVE_V, pname, cname, st, type: '全教科', coins: 0, stamina: K.STAMINA_START, day: today(), owned: [], qs: {}, qd: {}, miss: {}, takeHome: 0, lastBoss: null, dungeons: 0, created: Date.now(), run: null, qv: window.QDB_VERSION || 1, tower: {}, towerBest: {}, towerMs: 0, towerTicket: {}, hidden: [], seikaku: K.SEIKAKU_START, style: 'cute', styleStg: 0, fedDay: '',
      playDays: 1, clears: 0, bossWin: {}, boss3: {}, bossStg: {}, nocont: 0, typeChanged: false, ach: {}, sel: { title: '', aura: '', bg: '学園の町' }, fav: [], gachaN: 0 };
  }
  function dayCheck() {
    const t = today(); if (S.day === t) return;
    const days = Math.max(1, Math.round((new Date(t) - new Date(S.day)) / 864e5) || 1);
    if (S.stamina < K.STAMINA_MAX) S.stamina = Math.min(K.STAMINA_MAX, S.stamina + K.STAMINA_DAY * days); // 2000までためておける
    S.day = t; S.takeHome = 0; S.lastBoss = null; S.towerMs = 0; S.playDays = (S.playDays || 0) + 1;
    save();
  }
  function packRun() {
    const { rnd, usedQ, ...rest } = R;
    return { ...rest, rs: rnd.state(), usedQ: [...usedQ], bt: BT ? packBT() : rest.bt || null };
  }
  function unpackRun(o) { const { rs, usedQ, ...rest } = o; R = { ...rest, rnd: makeRng(rs), usedQ: new Set(usedQ || []) }; }
  function save() {
    if (!S) return;
    if (checkAch()) rawSave();
    rawSave();
  }
  function rawSave() {
    if (!S) return;
    try {
      if (R) S.run = packRun(); S.savedAt = Date.now(); // 中断中（R なし）も S.run は のこす
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch (e) { console.warn('セーブできませんでした', e); }
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { return migrate(JSON.parse(raw)); }
    catch (e) { try { localStorage.setItem(SAVE_KEY + '_broken', raw); } catch (_) { } return null; }
  }
  // 版番号ごとの引きつぎ（新しいZIPに差しかえても読めるように）
  // アイテムの名前を かえた（10/3）。セーブの中の 古い名前を 新しい名前に
  const ITEM_RENAME = { 'たこあげ': 'たこ焼き', 'ふたつのお面': 'きつねのおめん', 'かみなりの羽': 'かみなりぐも', '雷鳴の太鼓': 'らいうのくも', '雪女のかんざし': 'かきごおり', 'うずまきキャンディ': 'キャンディのつえ', 'しゃぼん玉の杖': 'ばくちく', 'みつまたの槍': 'でんせつの弓', 'トゲよろい': 'かたいよろい', '鉄壁のこて': '鉄壁の兜', '吸血マント': '吸血セーター', 'すなどけい': 'ふしぎなウォッチ' };
  const renItems = a => (Array.isArray(a) ? a.map(x => ITEM_RENAME[x] || x) : a);
  function migrate(s) {
    if (!s || typeof s !== 'object' || !s.v) return null;
    if (s.v === 1) { // v1→v2：「正解(1)」は「あと1回(3)」に
      for (const k in s.qs || {}) if (s.qs[k] === 1) s.qs[k] = 3;
      s.v = 2;
    }
    if (s.v === 2) s.v = 3; // v2→v3：問題の番号に「問題DBの版（qv）」をつけた
    remapSave(s);
    if (!s.bossStg) s.bossStg = bossStgFrom(s.bossWin, s.boss3);
    s.owned = renItems(s.owned); s.fav = renItems(s.fav);
    if (s.run) { s.run.hand = renItems(s.run.hand); (s.run.pend || []).forEach(p => (p.n = ITEM_RENAME[p.n] || p.n)); }
    if (s.sel && !(s.sel.bg in D.BGS)) s.sel.bg = '学園の町'; // 背景を 入れかえた（10/3）。いまは ない背景は さいしょの背景に
    const base = newState(s.pname || '', s.cname || '');
    return Object.assign(base, s);
  }
  // 倒したボスの強さ（★1〜3）を ビットで持つ（1=★1 2=★2 4=★3）。記録がないときは bossWin・boss3 から作る
  function bossStgFrom(win = {}, b3 = {}) { const o = {}; for (const b in win) o[b] = 1; for (const b in b3) o[b] = 7; return o; }
  // 問題の番号をそろえなおしたとき（qmap.js）、セーブの中の古い番号を新しい番号にする
  function remapSave(s) {
    const C = window.SAVECODE, from = s.qv || 1;
    if (from >= C.QV()) { s.qv = C.QV(); return s; }
    s.qs = C.remapKeys(s.qs, from); s.qd = C.remapKeys(s.qd, from); s.miss = C.remapKeys(s.miss, from);
    for (const k in s.tower || {}) if (s.tower[k]) s.tower[k].order = C.remapList(s.tower[k].order, from);
    if (s.run) {
      const r = s.run;
      for (const k in r.qpre || {}) r.qpre[k] = r.qpre[k].map(x => ({ ...x, id: C.mapId(x.id, from) })).filter(x => x.id);
      r.usedQ = C.remapList(r.usedQ, from);
      if (r.bt) r.bt.used = C.remapList(r.bt.used, from);
    }
    s.qv = C.QV(); return s;
  }
  function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } S = null; R = null; BT = null; }

  // ---- ステータスの計算 ----
  const total = st => SUBJ.reduce((a, s) => a + st[s], 0);
  function luckOf(st) {
    const v = SUBJ.map(s => st[s]), m = v.reduce((a, b) => a + b) / 5;
    const cv = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / 5) / m;
    return Math.max(300, R0(1000 - 500 * Math.pow(cv / 1.6, 1.5)));
  }
  function typeOf(st, prev) {
    const mx = Math.max(...SUBJ.map(s => st[s]));
    const tops = SUBJ.filter(s => st[s] === mx);
    const b = tops.includes(prev) ? prev : tops[0];
    const avg = SUBJ.filter(s => s !== b).reduce((a, s) => a + st[s], 0) / 4;
    return st[b] >= 1.25 * avg ? b : '全教科';
  }
  const stageOf = t => (t < K.STAGE_LINE[0] ? 0 : t < K.STAGE_LINE[1] ? 1 : 2);
  const skillsOf = t => D.SKILLS.filter(k => !K.SKILL_LINE[k.n] || t >= K.SKILL_LINE[k.n]).map(k => k.n);
  // ---- 見た目：タイプ × かわいい系・かっこいい系 × 4段階 ----
  const lookStage = t => K.LOOK_LINE.filter(x => t >= x).length; // 0〜3
  const styleOf = v => ((v === undefined || v === null ? K.SEIKAKU_START : v) <= 1000 ? 'cute' : 'cool');
  const seikakuName = v => D.SEIKAKU.find(([x]) => (v === undefined ? K.SEIKAKU_START : v) <= x)[1];
  // 1〜3段階目：進化したときの せいかくで決まる（styleStg に記録）。4段階目：いまの せいかくで すぐ変わる
  function styleFor(p, t) {
    const g = lookStage(t);
    if (g < 3 && p && p.styleStg === g && p.style) return p.style;
    return styleOf(p && p.seikaku);
  }
  const lookOf = (type, t, p = S) => D.LOOK[type][styleFor(p, t)][lookStage(t)];
  function refreshType() { S.type = typeOf(S.st, S.type); if (S.type !== '全教科') S.typeChanged = true; }

  // ---- 小さな部品 ----
  // sk：画面ごとの背景（assets の scrBg。ガチャ＝gacha、リザルト＝result、問題リスト・アチーブ・もちもの＝library、無限の塔の入口＝tower・とちゅう＝towerRun）
  function render(html, cls, sk) {
    app.innerHTML = `<div class="scr ${cls || ''} fadein">${html}</div>`;
    const el = app.firstElementChild;
    // 画像の背景は 少し暗くして 文字を読みやすくする
    const shade = d => `linear-gradient(rgba(8,10,24,${d}),rgba(8,10,24,${d + 0.15}))`;
    if (cls === 'home' && S) { // ホームの背景（えらんだもの。画像がなければ仮の色）
      const k = (S.sel && S.sel.bg) || '学園の町', img = g2(A, 'homeBg', k);
      el.style.background = img ? `${shade(0.12)}, url("${img}") center/cover` : D.BGS[k] || D.BGS['学園の町'];
      return el;
    }
    // ダンジョン・ボス戦は ボスの属性ごとの背景（画像があるとき）
    let bg = sk ? g2(A, 'scrBg', sk) : '';
    if (cls === 'dun' && R && R.boss) bg = g2(A, 'dunBoss', R.boss);
    // ボス戦・おためしバトルは ボスの属性の ダンジョンと同じ背景。対戦は ダンジョンの背景から ランダム（対戦ごとに決めて しまっておく）
    if (cls === 'btl' && BT && BT.B && BT.B.isBoss) bg = g2(A, 'dunBoss', BT.B.type) || g2(A, 'scrBg', 'arena');
    if (cls === 'btl' && BT && BT.vs) bg = g2(A, 'dunBoss', BT.bgVs) || g2(A, 'scrBg', 'arena');
    bg = bg || g2(A, 'bg', BG[cls]);
    if (bg) el.style.background = `${shade(cls === 'btl' || cls === 'dun' ? 0.2 : 0.35)}, url("${bg}") center/cover`;
    return el;
  }
  function overlay(html, cls = '') { const el = document.createElement('div'); el.className = 'ov ' + cls; el.innerHTML = html; app.appendChild(el); return el; }
  function floatAt(x, y, text, color = '#fff', cls = 'float') {
    const el = document.createElement('div'); el.className = cls; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = color; app.appendChild(el);
    setTimeout(() => el.remove(), T(1300));
  }
  function tip(text, ms = 3500) {
    const el = document.createElement('div'); el.className = 'tip'; el.innerHTML = '💡 ' + text; app.appendChild(el);
    setTimeout(() => el.remove(), T(ms));
  }
  // ---- ゲームのテンポ（せってい）：はやい＝時間で進む ／ ふつう＝メッセージを 1クリック（タップ）で送る ----
  const slow = () => !!(S && S.sel && S.sel.tempo !== 'fast') && !window.FAST && !(BT && BT.vs); // さいしょは ふつう。対戦は いつも はやい
  function clickWait() {
    return new Promise(res => {
      const t0 = Date.now(), mk = document.createElement('div'); mk.className = 'nextmark'; mk.textContent = '▼'; app.appendChild(mk);
      const done = e => {
        if (Date.now() - t0 < 250) return; // れんだで とばさないように
        if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
        document.removeEventListener('pointerdown', done, true); document.removeEventListener('keydown', done, true); mk.remove(); res();
      };
      document.addEventListener('pointerdown', done, true); document.addEventListener('keydown', done, true);
    });
  }
  // メッセージのあとの 待ち（ふつう のときは クリックまで待つ）
  const msgWait = ms => (slow() ? clickWait() : wait(ms));
  // click=false：「ターン1」のような 見ればわかる短いものは、ふつう でも時間で進む
  async function cutin(text, ms = 1300, click = true) {
    const el = document.createElement('div'); el.className = 'cutin'; el.innerHTML = text; app.appendChild(el);
    if (click && slow()) { el.classList.add('stay'); await clickWait(); } else await wait(ms);
    el.remove();
  }
  const NEWB = '<span class="newb">NEW</span>';
  function itemCard(n, extra = '') {
    const it = D.ITEM[n]; const isNew = !S.owned.includes(n);
    // 名前が長いときは 文字を少し小さく。NEW は カードの右上に
    const len = [...n].length, sz = len >= 10 ? ' xl' : len >= 8 ? ' l' : '';
    return `<div class="itemcard">${isNew ? NEWB : ''}<div class="ie">${artItem(n)}</div><div class="ir r${it.r}">${'★'.repeat(it.r)}</div><div class="in r${it.r}${sz}">${esc(n)}</div><div class="id">${esc(it.d)}</div>${extra}</div>`;
  }
  function showItem(n) {
    return new Promise(res => {
      const o = overlay(`<div class="panel center">${itemCard(n)}<button class="btn-gray">とじる</button></div>`);
      o.querySelector('button').onclick = () => { o.remove(); res(); };
    });
  }
  // セリフ＋選択肢（イベント・確認など）
  function dialog({ who = '', name = '', text = '', choices = [{ label: 'OK', val: true }], body = '' }) {
    return new Promise(res => {
      const o = overlay(`<div class="panel evbox">${who ? `<div class="who">${who}</div>` : ''}
        ${name ? `<div class="mid gold" style="text-align:center">${esc(name)}</div>` : ''}
        <div class="txt">${text}</div>${body}<div class="choices"></div></div>`);
      const box = o.querySelector('.choices');
      choices.forEach(c => {
        const b = document.createElement('button'); b.innerHTML = c.label; b.className = c.cls || 'btn-blue';
        if (c.disabled) b.disabled = true;
        b.onclick = () => { o.remove(); res(c.val); }; box.appendChild(b);
      });
    });
  }
  // アイテムをえらぶ（宝箱・お店・持ち帰り など）
  function chooseItem(text, names, { labels, skip, who } = {}) {
    return new Promise(res => {
      const o = overlay(`<div class="panel evbox">${who ? `<div class="who" style="font-size:80px">${who}</div>` : ''}<div class="txt" style="text-align:center">${text}</div>
        <div class="choices cards"></div><div class="choices" style="margin-top:12px"></div></div>`);
      const box = o.querySelector('.cards');
      names.forEach((n, i) => {
        const w = document.createElement('div');
        w.innerHTML = itemCard(n, `<button class="btn-main" style="font-size:20px;padding:8px 14px">${labels ? labels[i] : 'これにする'}</button>`);
        const b = w.querySelector('button');
        if (labels && labels[i] === null) b.remove();
        else b.onclick = () => { o.remove(); res(n); };
        box.appendChild(w.firstElementChild);
      });
      if (skip) { const b = document.createElement('button'); b.className = 'btn-gray'; b.textContent = skip; b.onclick = () => { o.remove(); res(null); }; o.querySelectorAll('.choices')[1].appendChild(b); }
    });
  }

  // ---- 4択（読み飛ばし防止の待ち時間つき）。答えを押した瞬間に onAnswer が呼ばれる（そこでセーブする）----
  // keep：{} をわたすと 窓を閉じずに 次の問題も同じ窓に出す（無限の塔）。おわったら keep.o.remove()
  function ask(q, { head = '', fighter = null, onAnswer = null, extra = null, ctl = null, gauge = null, keep = null } = {}) {
    return new Promise(res => {
      let done = false;
      const opts = shuffle(q.a.map((t, i) => ({ t, ok: i === 0 })));
      const lock = Math.min(3000, Math.max(1000, 600 + q.t.length * 30));
      const html = `<div class="qbox">
        <div class="qh row" style="justify-content:space-between"><span>${subjIc(q.s)} ${q.s}・${q.g}年 ${head}</span>${gauge ? '<span class="qgw">問題ゲージ <span class="gauge qg"><i></i></span> <b class="qgt"></b></span>' : ''}</div>
        <div class="qt">${esc(q.t)}</div>
        <div class="lockrow"><span>⏳ よく読もう</span><div class="lockbar"><i></i></div></div>
        <div class="opts">${opts.map((p, i) => `<button data-i="${i}" disabled>${esc(p.t)}</button>`).join('')}</div>
        <div class="row" style="justify-content:flex-end;margin-top:8px;min-height:44px"><span class="megane"></span></div>
        <div class="after"></div></div>`;
      const o = keep && keep.o ? keep.o : overlay(html, 'ovq');
      if (keep) { o.innerHTML = html; keep.o = o; }
      const btns = [...o.querySelectorAll('.opts button')];
      // バトル中：問題ゲージを 窓の中にも出す（後ろのゲージは窓にかくれるため）
      const drawG = () => { if (!gauge) return; const { m, n } = gauge(); const g = o.querySelector('.qg'); g.style.setProperty('--n', n); g.querySelector('i').style.width = Math.min(100, m * 100) + '%'; g.classList.toggle('over', m > 1.001); o.querySelector('.qgt').textContent = '×' + m.toFixed(2); };
      drawG();
      const bar = o.querySelector('.lockbar i');
      // 読み飛ばし防止：のこり時間が へっていくゲージ
      bar.style.transition = `width ${T(lock)}ms linear`; requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = '0%')));
      setTimeout(() => { btns.forEach(b => (b.disabled = false)); o.querySelector('.lockrow').style.visibility = 'hidden'; }, T(lock));
      if (fighter && fighter.has('ひらめきメガネ') && fighter.megane > 0) {
        const mb = document.createElement('button'); mb.className = 'btn-blue'; mb.style.fontSize = '18px';
        mb.textContent = `👓 2択にする（のこり${fighter.megane}回）`;
        mb.onclick = () => { fighter.megane--; mb.remove(); let k = 0; btns.forEach((b, i) => { if (!opts[i].ok && k < 2) { b.style.visibility = 'hidden'; k++; } }); };
        o.querySelector('.megane').appendChild(mb);
      }
      const finish = r => { if (done) return; done = true; if (!keep) o.remove(); res(r); };
      if (ctl) ctl.cancel = () => finish({ cancel: true });
      if (extra) {
        const xb = document.createElement('button'); xb.className = 'btn-gray'; xb.style.fontSize = '18px'; xb.textContent = extra;
        xb.onclick = () => finish({ quit: true });
        o.querySelector('.megane').appendChild(xb);
      }
      btns.forEach((b, i) => (b.onclick = async () => {
        if (done) return;
        btns.forEach(x => (x.disabled = true)); o.querySelector('.megane').innerHTML = '';
        const ok = opts[i].ok;
        if (onAnswer) onAnswer(ok);
        drawG();
        btns.forEach((x, j) => { if (opts[j].ok) x.classList.add('ok'); });
        if (!ok) b.classList.add('ng');
        const after = o.querySelector('.after');
        if (ok) {
          after.innerHTML = `<div style="text-align:center"><span class="okmsg">⭕ せいかい！</span></div>`;
          await wait(900);
        } else {
          after.innerHTML = `<div class="expl">❌ ざんねん… 答えは「${esc(q.a[0])}」<br>${esc(q.x)}
            <div style="text-align:right;margin-top:6px"><button class="btn-blue" disabled>わかった</button></div></div>`;
          const nb = after.querySelector('button');
          await wait(2500); nb.disabled = false;
          await new Promise(r => (nb.onclick = r));
        }
        finish({ ok });
      }));
    });
  }

  // ---- 問題をえらぶ ----
  // 新しい問題：4年→5年→6年（教科ごと）。得意な教科は上の学年もまぜる。ぜんぶ解いたらおさらい
  function drawNewQs(subj, n, rnd) {
    const taken = new Set(), out = [];
    const others = SUBJ.filter(s => s !== subj).reduce((a, s) => a + S.st[s], 0) / 4;
    const ratio = S.st[subj] / others;
    const mix = ratio >= 2 ? 0.3 : ratio >= 1.5 ? 0.2 : ratio >= 1.25 ? 0.1 : 0;
    for (let k = 0; k < n; k++) {
      const fresh = QBY[subj].filter(q => !S.qs[q.id] && !taken.has(q.id));
      let q = null, osarai = false;
      if (fresh.length && dbg('allq')) q = pick(fresh, rnd); // デバッグ：学年の順番に関係なく出す
      else if (fresh.length) {
        const gmin = Math.min(...fresh.map(q => q.g));
        let pool = fresh.filter(q => q.g === gmin);
        const upper = fresh.filter(q => q.g > gmin);
        if (upper.length && rnd() < mix) pool = upper.filter(q => q.g === Math.min(...upper.map(q => q.g)));
        q = pick(pool, rnd);
      } else {
        let pool = QBY[subj].filter(q => (S.qs[q.id] === 3 || S.qs[q.id] === 4) && !taken.has(q.id));
        if (!pool.length) pool = QBY[subj].filter(q => !taken.has(q.id));
        q = pick(pool, rnd); osarai = true;
      }
      taken.add(q.id); out.push({ id: q.id, osarai });
    }
    return out;
  }
  // 解いたことのある問題（ボス戦・イベント）。足りなければ新しい問題で補う（記録はしない）
  function drawSolvedQ(subj, used, qs = S.qs) {
    const subjs = subj ? [subj] : SUBJ;
    let all = subjs.flatMap(s => QBY[s]).filter(q => !used.has(q.id));
    if (!all.length) { used.clear(); all = subjs.flatMap(s => QBY[s]); }
    let pool = all.filter(q => qs[q.id]);
    if (!pool.length) { const g = Math.min(...all.map(q => q.g)); pool = all.filter(q => q.g === g); }
    const q = pick(pool); used.add(q.id); return q;
  }

  // ---- アイテムの抽選 ----
  function reqOK(it, hand) {
    if (!it.req) return true;
    const has = n => S.owned.includes(n) || hand.includes(n);
    const sk = skillsOf(total(S.st));
    if (it.req === 'status') return Object.keys(D.INFLICT).some(has) || has('嵐の羽');
    if (it.req === 'ct2') return ['カウンター', 'パワーシュート', 'ふういん'].some(k => sk.includes(k));
    if (it.req.startsWith('skill:')) return sk.includes(it.req.slice(6));
    return has(it.req);
  }
  function rollRarity(rnd, luck, minR = 1) {
    const w = D.RARITY_W.map((x, r) => (r < minR ? 0 : r >= 3 ? x * (0.5 + 0.5 * luck / 1000) : x));
    let t = rnd() * w.reduce((a, b) => a + b);
    for (let r = 1; r <= 5; r++) { t -= w[r]; if (t < 0) return r; }
    return 5;
  }
  function drawItem(rnd, { cat = null, unowned = false, exclude = [], hand = [], minR = 1, rarity = 0 } = {}) {
    const luck = luckOf(S.st);
    const pool = D.ITEMS.filter(it => reqOK(it, hand) && !hand.includes(it.n) && !exclude.includes(it.n) && (!unowned || !S.owned.includes(it.n)));
    if (!pool.length) return null;
    const r = rarity || rollRarity(rnd, luck, minR);
    let p = pool.filter(it => it.r === r);
    if (cat && rnd() < 0.7) { const c = p.filter(it => it.cat === cat); if (c.length) p = c; }
    if (!p.length) { p = pool.filter(it => it.r >= minR); if (cat) { const c = p.filter(it => it.cat === cat); if (c.length && rnd() < 0.7) p = c; } }
    if (!p.length) p = pool;
    return pick(p, rnd).n;
  }

  // =====================================================================
  // タイトル・名前を決める・せってい
  // =====================================================================
  // タイトルロゴ（画像があれば画像。なければ 文字）
  const logoHtml = (px, w = 640) => (g2(A, 'ui', 'logo') ? `<img class="logo" style="width:${w}px" src="${esc(A.ui.logo)}" alt="まなびバトル" onerror="this.outerHTML='<div style=&quot;font-size:${px}px&quot;>⚔️ まなびバトル</div>'">` : `<div style="font-size:${px}px">⚔️ まなびバトル</div>`);
  function titleScreen() {
    const el = render(`<div class="scr center">
      ${logoHtml(72)}
      <div class="mid">${esc(S.pname)} の データ</div>
      <button class="btn-main" id="go">${S.run ? '▶ ダンジョンの つづきから' : '▶ はじめる'}</button>
      <div class="sm dim">ブラウザに 自動でセーブしています</div></div>`, 'title');
    $('#go', el).onclick = () => { dayCheck(); if (S.run) resumeRun(); else home(); };
  }
  // デバッグルームの入口（名前そのものは書かない。変えるときは tools/make_debug_hash.py で作る）
  const DEBUG_HASH = '952292505c231cec';
  const dbgNorm = s => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ''); // 全角・大文字・空白のちがいは気にしない
  function nameHash(p, c) {
    let h1 = 0x811c9dc5, h2 = (0x01000193 ^ 0x5bd1e995) >>> 0;
    for (const x of new TextEncoder().encode('manabi-debug:' + p + '\n' + c)) { h1 = Math.imul(h1 ^ x, 0x01000193) >>> 0; h2 = Math.imul((h2 ^ x) >>> 0, 0x5bd1e995) >>> 0; h2 = (h2 ^ (h2 >>> 13)) >>> 0; }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }
  function nameScreen() {
    const el = render(`<div class="scr center" style="${g2(A, 'bg', 'name') ? '' : 'background:linear-gradient(160deg,#4c1d95,#1e3a8a)'}">
      ${logoHtml(64, 380)}
      <div class="mid">ようこそ、まなび学園バトル部へ！</div>
      <div class="panel col" style="gap:16px;padding:28px">
        <label class="mid">プレイヤーネーム（8文字まで）<br><input id="pn" maxlength="8" placeholder="きみの名前"></label>
        <label class="mid">モンスターの名前（8文字まで）<br><input id="cn" maxlength="8" placeholder="モンスターの名前"></label>
        <div class="sm rule" style="text-align:center">${NAME_RULE}</div>
        <button class="btn-main" id="go">けってい</button>
        <div class="sm red" id="err"></div>
      </div></div>`, 'name');
    $('#go', el).onclick = () => {
      const pn = $('#pn', el).value.trim(), cn = $('#cn', el).value.trim();
      if (!pn || !cn) { $('#err', el).textContent = '名前を2つとも入れてね'; return; }
      if (nameHash(dbgNorm(pn), dbgNorm(cn)) === DEBUG_HASH) { debugRoom(); return; } // セーブは作らない
      S = newState(pn, cn);
      if (/[?&]test/.test(location.search)) { S.stamina = 9999; S.coins = 5000; }
      save(); home();
    };
  }
  // せってい：称号・オーラ（持っているときだけ）・ホームの背景・やりなおし
  function settings() {
    const auras = myRewards('aura');
    const sec = (name, list, cur, key, label = x => x) => `<div class="mid" style="margin-top:10px">${name}</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${list.map(x => `<button data-k="${key}" data-v="${esc(x)}" class="${x === cur ? 'btn-main' : ''}" style="font-size:18px;padding:6px 12px">${label(x)}</button>`).join('')}</div>`;
    const o = overlay(`<div class="panel" style="width:1100px;max-height:680px;overflow-y:auto">
      <div class="big">⚙️ せってい</div>
      <div class="setbtns">
        <button id="sT">🏷️ 称号をかえる<small>いま：${S.sel.title ? esc(S.sel.title) : 'つけない'}</small></button>
        <button id="sB">🖼️ 背景をかえる<small>いま：${esc(S.sel.bg || '学園の町')}</small></button>
        <button id="sN">✏️ モンスターの名前をかえる<small>いま：${esc(S.cname)}</small></button>
      </div>
      ${sec('⏩ ゲームのテンポ', ['normal', 'fast'], S.sel.tempo === 'fast' ? 'fast' : 'normal', 'tempo', x => (x === 'fast' ? 'はやい' : 'ふつう（タップで メッセージを すすめる）'))}
      ${auras.length ? sec('✨ オーラ', ['', ...auras], S.sel.aura, 'aura', x => (x ? x + 'オーラ' : 'オフ')) : ''}
      ${dbgOn() ? debugSection() : ''}
      <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn-gray" id="rs" style="font-size:18px">さいしょから やりなおす</button><div class="row" style="gap:10px"><button class="btn-gray" id="sC" style="font-size:18px">📜 クレジット</button><button class="btn-blue" id="cl">とじる</button></div></div></div>`);
    o.querySelectorAll('[data-k]').forEach(b => (b.onclick = () => { S.sel[b.dataset.k] = b.dataset.v; save(); o.remove(); home(); settings(); }));
    $('#cl', o).onclick = () => o.remove();
    $('#sT', o).onclick = () => { o.remove(); titlePage(); };
    $('#sB', o).onclick = () => { o.remove(); bgPage(); };
    $('#sN', o).onclick = () => { o.remove(); renameMonster(); };
    $('#sC', o).onclick = () => { o.remove(); creditsPage(); };
    if (dbgOn()) bindDebug(o);
    $('#rs', o).onclick = async () => {
      o.remove();
      let taps = 0; // ひみつの入口：確認画面の⚠️を合わせて10回以上タッチ →「ぜんぶ消す」
      const tapWho = () => { const w = [...app.querySelectorAll('.ov .who')].pop(); if (!w) return; w.style.cursor = 'default';
        w.addEventListener('pointerdown', e => { e.preventDefault(); taps++; if (taps === 10) w.style.transform = 'rotate(8deg)'; }); };
      const p1 = dialog({ who: '⚠️', text: 'ほんとうに さいしょから やりなおす？\nステータス・アイテム・コインが ぜんぶ消えるよ', choices: [{ label: 'やりなおす', val: 1, cls: 'btn-gray' }, { label: 'やめる', val: 0, cls: 'btn-main' }] });
      tapWho(); const c1 = await p1;
      if (!c1) return;
      const p2 = dialog({ who: '⚠️', text: 'もういちど聞くよ。\nほんとうに ぜんぶ消して いいんだね？（もとにもどせないよ）', choices: [{ label: 'ぜんぶ消す', val: 1, cls: 'btn-gray' }, { label: 'やめる', val: 0, cls: 'btn-main' }] });
      tapWho(); const c2 = await p2;
      if (!c2) return;
      if (taps >= 10) { // デバッグモード起動（セーブは消さない）
        S.debug = { on: true, st: false, stamina: false, coins: false, items: false, allq: false, tower: false, boss: false, bak: {} };
        save(); home(); tip('🔧 デバッグモードを起動しました（せっていに デバッグの項目が出ます）', 3500); settings(); return;
      }
      resetSave(); nameScreen();
    };
  }

  // ---- クレジット（使っている素材・フォント・ライブラリ）----
  function creditsPage() {
    const rows = list => list.map(([n, a, u, l]) => `<div class="crow"><div class="cn">${esc(n)}</div><div class="ca">${esc(a)}${l ? `<small>${esc(l)}</small>` : ''}</div><div class="cu">${esc(u)}</div></div>`).join('');
    const img = (A.credits || []).filter(c => c && c[0]);
    const o = overlay(`<div class="panel cred" style="width:1100px;max-height:680px;overflow-y:auto">
      <div class="big">📜 クレジット</div>
      <div class="sm dim">このゲームは、たくさんの人が作った素材を つかわせてもらっています。ありがとうございます！</div>
      <div class="staff">${D.STAFF.map(([r, n]) => `<div class="sr">${esc(r)}</div><div class="sn">${esc(n)}</div>`).join('')}</div>
      ${img.length ? `<div class="mid ch">🎨 画像</div>${rows(img)}` : ''}
      <div class="mid ch">🔤 フォント・プログラム</div>${rows(D.CREDITS)}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn-blue" id="cl">とじる</button></div></div>`);
    $('#cl', o).onclick = () => { o.remove(); backToSettings(); };
  }

  // ---- 称号をかえる（アチーブメントの画面と同じ形。まだのものは ？？？ → タップで 手に入れかた）----
  const backToSettings = () => { home(); settings(); };
  const howTo = (a, what) => dialog({ who: '🔒', text: `まだ 手に入れていない ${what}だよ\n手に入れかた：<span class="gold">${esc(a.d)}</span>` });
  function titlePage() {
    const have = new Set(myRewards('t')), list = D.ACH.filter(a => a.r.t), cats = [...new Set(list.map(a => a.cat))];
    const row = (t, label, on) => `<div class="qrow ttl ${on ? 'sel' : ''}" data-t="${esc(t)}">${on ? '✅' : '⬜'} ${label}</div>`;
    const el = render(`
      <div class="prog"><span class="mid">🏷️ 称号をえらぶ　<span class="gold">${list.filter(a => have.has(a.r.t)).length} / ${list.length}</span></span><span class="coin"><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">◀ せっていへ</button></span></div>
      <div class="panel" style="position:absolute;top:70px;left:24px;right:24px;bottom:20px;overflow-y:auto">
        ${row('', 'つけない', !S.sel.title)}
        ${cats.map(c => `<div class="mid gold" style="margin:8px 0 4px">${c}</div>` + list.filter(a => a.cat === c).map(a => have.has(a.r.t)
          ? row(a.r.t, titleBadge(a.r.t), S.sel.title === a.r.t)
          : `<div class="qrow ttl lock" data-id="${a.id}">🔒 ？？？</div>`).join('')).join('')}
        ${(S.hidden || []).length ? `<div class="mid" style="margin:8px 0 4px">🌈 <span class="ttlb tr-rainbow">限定の称号</span></div>` + D.HIDDEN_TITLES.filter(t => S.hidden.includes(t)).map(t => row(t, titleBadge(t), S.sel.title === t)).join('') : ''}
      </div>`, 'res');
    $('#bk', el).onclick = backToSettings;
    el.querySelectorAll('.ttl').forEach(r => (r.onclick = () => {
      if (r.dataset.id) return howTo(D.ACH.find(a => a.id === r.dataset.id), '称号');
      S.sel.title = r.dataset.t; save(); titlePage();
    }));
  }
  // ---- 背景をかえる ----
  function bgPage() {
    const have = new Set(['学園の町', ...myRewards('bg')]), keys = Object.keys(D.BGS);
    const el = render(`
      <div class="prog"><span class="mid">🖼️ ホームの背景をえらぶ　<span class="gold">${keys.filter(k => have.has(k)).length} / ${keys.length}</span></span><span class="coin"><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">◀ せっていへ</button></span></div>
      <div class="panel bggrid" style="position:absolute;top:70px;left:24px;right:24px;bottom:20px;overflow-y:auto">
        ${keys.map(k => {
          if (!have.has(k)) return `<div class="bgc lock" data-k="${esc(k)}"><div class="bgp">🔒</div><div class="mid">？？？</div></div>`;
          const img = g2(A, 'homeBg', k);
          return `<div class="bgc ${S.sel.bg === k || (!S.sel.bg && k === '学園の町') ? 'sel' : ''}" data-k="${esc(k)}"><div class="bgp" style="background:${img ? `url('${esc(img)}') center/cover` : D.BGS[k]}"></div><div class="mid">${S.sel.bg === k ? '✅ ' : ''}${esc(k)}</div></div>`;
        }).join('')}
      </div>`, 'res');
    $('#bk', el).onclick = backToSettings;
    el.querySelectorAll('.bgc').forEach(c => (c.onclick = () => {
      const k = c.dataset.k;
      if (!have.has(k)) return howTo(D.ACH.find(a => a.r.bg === k), '背景');
      S.sel.bg = k; save(); bgPage();
    }));
  }
  // ---- モンスターの名前をかえる（いつでも）----
  const NAME_RULE = '⚠️ みんなが いやな気もちに ならない 名前にしてね<br><span class="sm">（わる口・らんぼうな ことば・友だちを からかう 名前は つけないよ）</span>';
  function renameMonster() {
    const o = overlay(`<div class="panel evbox" style="text-align:center">
      <div class="who">${artPlayer(S.type, total(S.st))}</div>
      <div class="mid">✏️ モンスターの名前をかえる</div>
      <div class="sm rule" style="margin:10px 0">${NAME_RULE}</div>
      <input id="nn" maxlength="8" value="${esc(S.cname)}" style="width:420px"><div class="sm red" id="ne" style="min-height:24px"></div>
      <div class="choices"><button class="btn-main" id="ok">けってい</button><button class="btn-gray" id="cl">やめる</button></div></div>`);
    const inp = $('#nn', o); inp.focus(); inp.select();
    $('#cl', o).onclick = () => { o.remove(); backToSettings(); };
    $('#ok', o).onclick = () => {
      const v = inp.value.trim();
      if (!v) { $('#ne', o).textContent = '名前を入れてね'; return; }
      S.cname = v; save(); o.remove(); home(); tip(`名前を「${esc(v)}」にしたよ`);
    };
  }

  // =====================================================================
  // デバッグモード（先生用。せっていの「もういちど聞くよ」の⚠️を10回以上タッチ →「ぜんぶ消す」）
  // =====================================================================
  const dbgOn = () => !!(S && S.debug && S.debug.on);
  const dbg = k => dbgOn() && !!S.debug[k];
  const towerLimit = () => (dbg('tower') ? 999 * 60 * 1000 : K.TOWER_MS);
  const DBG_ITEMS = [['st', '📊 ステータス 9999'], ['stamina', '⚡ スタミナ 無限（9999）'], ['coins', '🪙 コイン 無限（9999）'], ['items', '🎒 アイテム 全開放'], ['allq', '📋 問題 全開放（学年の順番なし）'], ['tower', '🗼 無限の塔 999分'], ['boss', '👑 ボス討伐 全開放（おためしバトル）'], ['titles', '🏷️ 称号 全開放'], ['ach', '🏆 アチーブメント 全開放'], ['bgs', '🖼️ 背景 全開放']];
  const HID_KEYS = D.HIDDEN_TITLES.map((t, i) => ['hid' + i, t]);
  // スイッチの状態をセーブに反映（オフにしたら もとの値にもどす）
  function applyDebug() {
    if (!dbgOn()) return;
    const d = S.debug, b = d.bak;
    if (d.st) { if (!b.st) b.st = { ...S.st }; SUBJ.forEach(x => (S.st[x] = 9999)); } else if (b.st) { S.st = b.st; delete b.st; }
    if (d.stamina) { if (b.stamina === undefined) b.stamina = S.stamina; S.stamina = 9999; } else if (b.stamina !== undefined) { S.stamina = b.stamina; delete b.stamina; }
    if (d.coins) { if (b.coins === undefined) b.coins = S.coins; S.coins = 9999; } else if (b.coins !== undefined) { S.coins = b.coins; delete b.coins; }
    if (d.items) { if (!b.owned) b.owned = [...S.owned]; S.owned = D.ITEMS.map(it => it.n); } else if (b.owned) { S.owned = b.owned; delete b.owned; }
    if (d.ach) { if (!b.ach) b.ach = { ...S.ach }; D.ACH.forEach(a => { if (!S.ach[a.id]) S.ach[a.id] = today(); }); } else if (b.ach) { S.ach = b.ach; delete b.ach; }
    refreshType(); rawSave();
  }
  function debugSection() {
    return `<div class="panel" style="margin-top:12px;border-color:#f59e0b"><div class="mid gold">🔧 デバッグモード</div>
      <div class="mid" style="margin-top:8px">🌈 限定の称号（その子のセーブに のこる。デバッグモードを終わっても 消えない）</div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:4px">${HID_KEYS.map(([k, t]) => { const on = (S.hidden || []).includes(t); return `<button data-hid="${esc(t)}" class="${on ? 'btn-main' : 'btn-gray'}" style="font-size:18px;padding:6px 12px">${esc(t)}：${on ? 'オン' : 'オフ'}</button>`; }).join('')}</div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px">${DBG_ITEMS.map(([k, n]) => `<button data-dbg="${k}" class="${S.debug[k] ? 'btn-main' : 'btn-gray'}" style="font-size:18px;padding:6px 12px">${n}：${S.debug[k] ? 'オン' : 'オフ'}</button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn-blue" id="dbr" style="font-size:18px;padding:6px 12px">デバッグルーム（QR引きつぎ・先生用ページ）</button><button class="btn-gray" id="dbx" style="font-size:18px;padding:6px 12px">デバッグモードを終わる</button></div>
      <div class="xs dim" style="margin-top:4px">オフにすると、オンにする前の値にもどります</div></div>`;
  }
  function bindDebug(o) {
    o.querySelectorAll('[data-hid]').forEach(b => (b.onclick = () => {
      const t = b.dataset.hid, h = S.hidden = (S.hidden || []).filter(x => D.HIDDEN_TITLES.includes(x));
      if (h.includes(t)) { S.hidden = h.filter(x => x !== t); if (S.sel.title === t) S.sel.title = ''; } else h.push(t);
      save(); o.remove(); home(); settings();
    }));
    o.querySelectorAll('[data-dbg]').forEach(b => (b.onclick = () => { S.debug[b.dataset.dbg] = !S.debug[b.dataset.dbg]; applyDebug(); o.remove(); home(); settings(); }));
    $('#dbr', o).onclick = () => { o.remove(); debugRoom(); };
    $('#dbx', o).onclick = () => { DBG_ITEMS.forEach(([k]) => (S.debug[k] = false)); applyDebug(); S.debug = null; save(); o.remove(); home(); tip('デバッグモードを終わりました', 2000); };
  }

  // =====================================================================
  // アチーブメント
  // =====================================================================
  const correctN = s => QBY[s].filter(q => S.qs[q.id] === 1 || S.qs[q.id] >= 3).length;
  function achDone(a) {
    const t = total(S.st);
    switch (a.k) {
      case 'solved': return Object.keys(S.qs).length >= a.v;
      case 'grade': return Object.keys(S.qs).some(id => Q[id] && Q[id].g >= a.v);
      case 'subj': return correctN(a.s) >= a.v;
      case 'all': return SUBJ.every(s => correctN(s) >= a.v);
      case 'days': return (S.playDays || 0) >= a.v;
      case 'clear': return (S.clears || 0) >= a.v;
      case 'boss': return !!S.bossWin[a.s];
      case 'bossAll': return Object.keys(S.bossWin).length >= 6;
      case 'boss3': return Object.keys(S.boss3).length >= a.v;
      case 'nocont': return (S.nocont || 0) >= a.v;
      case 'tower': return (S.towerBest[a.s] || 0) >= (a.v || QBY[a.s].length);
      case 'type': return !!S.typeChanged;
      case 'stage': return lookStage(t) >= a.v;
      case 'total': return t >= a.v;
      case 'skills': return skillsOf(t).length >= a.v;
      case 'items': return S.owned.length >= a.v;
      case 'ach': return Object.keys(S.ach).length >= a.v;
    }
    return false;
  }
  function checkAch() {
    if (!S.ach) return false;
    let got = false, more = true;
    while (more) {
      more = false;
      D.ACH.forEach(a => { if (!S.ach[a.id] && achDone(a)) { S.ach[a.id] = today(); got = more = true; achToast(a); } });
    }
    return got;
  }
  const rewardText = r => [r.t && `称号「${esc(r.t)}」`, r.bg && `背景「${esc(r.bg)}」`, r.aura && `${r.aura}オーラ`].filter(Boolean).join('＋');
  // デバッグの「称号 全開放」「背景 全開放」は セーブを書きかえずに 見えるだけ
  // ---- 称号の色：限定＝虹、むずかしい＝金、教科・属性＝その色、とりやすい＝白 ----
  const TCOL = { 国語: '#ff8f8f', 算数: '#7cb8ff', 理科: '#6fe3a0', 社会: '#ffc46b', 英語: '#d9a8ff', 無: '#cfd6e6' };
  function titleRank(t) {
    if (D.HIDDEN_TITLES.includes(t)) return 'rainbow';
    const a = D.ACH.find(x => x.r.t === t); if (!a) return 'white';
    const v = a.v, k = a.k;
    const hard = (k === 'solved' && v >= 1000) || (k === 'subj' && v >= 300) || (k === 'days' && v >= 30) || (k === 'clear' && v >= 50) || k === 'bossAll' || k === 'nocont'
      || (k === 'tower' && (v === 0 || v >= 250)) || (k === 'total' && v >= 3000) || k === 'skills' || (k === 'items' && v >= 50) || k === 'ach';
    if (hard) return 'gold';
    if (a.s && TCOL[a.s]) return 's:' + a.s;
    return 'white';
  }
  // 称号のバッジ（1行・小さく）
  function titleBadge(t, cls = '') {
    if (!t) return '';
    const r = titleRank(t), c = r.startsWith('s:') ? `style="--tc:${TCOL[r.slice(2)]}"` : '';
    return `<span class="ttlb tr-${r.startsWith('s:') ? 'subj' : r} ${cls}" ${c}>【${esc(t)}】</span>`;
  }
  const myRewards = k => D.ACH.filter(a => (S.ach[a.id] || (k === 't' && dbg('titles')) || (k === 'bg' && dbg('bgs'))) && a.r[k]).map(a => a.r[k]).concat(k === 't' ? (S.hidden || []).filter(t => D.HIDDEN_TITLES.includes(t)) : []);
  const auraCls = () => (S.sel.aura && myRewards('aura').includes(S.sel.aura) ? 'aura-' + D.AURAS[S.sel.aura] : '');
  let toastN = 0;
  function achToast(a) {
    const el = document.createElement('div'); el.className = 'achtoast';
    el.style.top = 80 + (toastN++ % 4) * 74 + 'px';
    el.innerHTML = `🏆 アチーブメント達成！<br><span class="sm">${esc(a.d)} → ${rewardText(a.r)}</span>`;
    document.getElementById('stage').appendChild(el);
    setTimeout(() => { el.remove(); toastN = Math.max(0, toastN - 1); }, T(4000));
  }
  function achList() {
    const n = Object.keys(S.ach).length, cats = [...new Set(D.ACH.map(a => a.cat))];
    const el = render(`
      <div class="prog"><span class="mid">🏆 アチーブメント　<span class="gold">${n} / ${D.ACH.length}</span></span><span class="coin"><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">🏠 ホームへ</button></span></div>
      <div class="panel" style="position:absolute;top:70px;left:24px;right:24px;bottom:20px;overflow-y:auto">
        ${cats.map(c => `<div class="mid gold" style="margin:8px 0 4px">${c}</div>` + D.ACH.filter(a => a.cat === c).map(a => {
          const ok = !!S.ach[a.id];
          return `<div class="qrow" style="cursor:default;${ok ? '' : 'color:#94a3b8'}">${ok ? '✅' : '⬜'} ${esc(a.d)} → ${ok ? `<span class="gold">${rewardText(a.r)}</span>` : '？？？'}</div>`;
        }).join('')).join('')}
      </div>`, 'res', 'library');
    $('#bk', el).onclick = () => home();
  }

  // =====================================================================
  // ガチャ（1回1000コイン・確率は固定・5回目ごとに★4以上・まだ持っていないものだけ）
  // =====================================================================
  function gachaPool() { return D.ITEMS.filter(it => !S.owned.includes(it.n) && reqOK(it, [])); }
  function gacha() {
    applyDebug();
    const pool = gachaPool(), left = D.GACHA_PITY - (S.gachaN % D.GACHA_PITY), done = S.owned.length >= D.ITEMS.length;
    const el = render(`<div class="scr center" style="gap:18px">
      <div class="big">🎰 ガチャ</div>
      <div class="mid gold">🪙 ${S.coins}</div>
      ${done ? '<div class="big gold">コンプリート！ ぜんぶ集めたよ！</div>' : `
      <div class="magic" style="width:220px;height:220px"></div>
      <div class="mid">${left === 1 ? '<span class="gold">つぎは ★4以上 確定！</span>' : `あと <b class="gold">${left}</b>回で ★4以上確定！`}</div>
      ${!pool.length ? '<div class="sm">いま出せるアイテムがないよ（スキルや、もとになるアイテムを手に入れると出るようになる）</div>' : ''}
      <button class="btn-main" id="pull" ${S.coins < D.GACHA_COST || !pool.length ? 'disabled' : ''}>ガチャを引く（🪙${D.GACHA_COST}）</button>`}
      <div class="row"><button class="btn-blue" id="rate" style="font-size:20px">提供割合</button><button class="btn-gray" id="bk" style="font-size:20px">🏠 ホームへ</button></div>
      </div>`, 'res', 'gacha');
    $('#bk', el).onclick = () => home();
    $('#rate', el).onclick = () => dialog({ who: '📊', name: '提供割合', text: `★1　35%\n★2　30%\n★3　20%\n★4　10%\n★5　5%\n5回目ごとに ★4以上が かならず出ます（★4 67%・★5 33%）。\nまだ持っていないアイテムだけが出ます。そのレア度のアイテムを ぜんぶ持っているときは、近いレア度のアイテムが出ます。\n「出る条件」があるアイテムは、条件を満たすまで出ません。` });
    const pb = $('#pull', el); if (pb) pb.onclick = () => pullGacha();
  }
  async function pullGacha() {
    const pool = gachaPool();
    if (S.coins < D.GACHA_COST || !pool.length) return;
    const pity = S.gachaN % D.GACHA_PITY === D.GACHA_PITY - 1;
    const w = pity ? [0, 0, 0, 0, 10, 5] : D.RARITY_W;
    let t = Math.random() * w.reduce((a, b) => a + b), r = 5;
    for (let k = 1; k <= 5; k++) { t -= w[k]; if (t < 0) { r = k; break; } }
    const has = k => pool.some(it => it.r === k);
    if (!has(r)) { // そのレア度がもうないときは近いレア度（確定のときは★4以上を先にさがす）
      const order = (pity ? [4, 5, 3, 2, 1] : [1, 2, 3, 4, 5]).sort((a, b) => (pity ? 0 : Math.abs(a - r) - Math.abs(b - r)));
      r = order.find(has);
    }
    const it = pick(pool.filter(x => x.r === r));
    S.coins -= D.GACHA_COST; S.gachaN++; S.owned.push(it.n); save();
    const col = ['', '#e5e7eb', '#4ade80', '#60a5fa', '#c084fc', '#fde047'][it.r];
    const o = overlay(`<div class="center" style="gap:16px"><div class="magic spin" style="--c:${col}"></div><div id="gr"></div></div>`);
    await wait(1600);
    o.querySelector('.magic').classList.add('flash');
    await wait(500);
    o.querySelector('.magic').remove();
    $('#gr', o).innerHTML = `<div class="mid ${it.r >= 4 ? 'gold' : ''}" style="text-align:center">${it.r >= 5 ? '🌈 ' : ''}★${it.r} ゲット！</div><div style="filter:drop-shadow(0 0 24px ${col})">${itemCard(it.n).replace(NEWB, '')}</div><div style="text-align:center;margin-top:10px"><button class="btn-main">OK</button></div>`;
    await new Promise(res => ($('#gr button', o).onclick = res));
    o.remove(); gacha();
  }

  // =====================================================================
  // もちもの（図鑑）：♡おきにいり ＋ 70個を効果別に。持っていないものは黒くぬりつぶし
  // =====================================================================
  function itemBook() {
    const sorted = D.CAT_ORDER.map(c => [c, D.ITEMS.filter(it => it.cat === c)]);
    const cell = n => { const own = S.owned.includes(n); return `<div class="bk ${own ? '' : 'none'}" data-n="${esc(n)}" title="${own ? esc(n) : '？？？'}">${artItem(n)}</div>`; };
    const el = render(`
      <div class="prog"><span class="mid">🎒 もちもの　<span class="gold">${S.owned.length} / ${D.ITEMS.length}</span></span><span class="coin"><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">🏠 ホームへ</button></span></div>
      <div class="panel" style="position:absolute;top:70px;left:24px;right:24px;bottom:20px;overflow-y:auto">
        <div class="mid" style="color:#f9a8d4">♡ おきにいり</div>
        <div class="bkrow">${S.fav.filter(n => S.owned.includes(n)).map(cell).join('') || '<span class="sm dim">アイテムをタップして ♡ をおすと、ここに並ぶよ</span>'}</div>
        ${D.ITEM_GROUPS.map(g => `<div class="sm gold" style="margin-top:8px">${esc(g.n)}</div><div class="bkrow">${g.items.map(cell).join('')}</div>`).join('')}
      </div>`, 'res', 'library');
    $('#bk', el).onclick = () => home();
    el.querySelectorAll('.bk').forEach(c => (c.onclick = () => {
      const n = c.dataset.n;
      if (!S.owned.includes(n)) { dialog({ who: '❓', text: '？？？\nまだ 持っていない アイテム' }); return; }
      const fav = S.fav.includes(n);
      const o = overlay(`<div class="panel center">${itemCard(n)}<div class="row"><button class="${fav ? 'btn-main' : ''}" id="fv">${fav ? '♥ おきにいり' : '♡ おきにいり'}</button><button class="btn-gray" id="cl">とじる</button></div></div>`);
      $('#cl', o).onclick = () => o.remove();
      $('#fv', o).onclick = () => { S.fav = fav ? S.fav.filter(x => x !== n) : [...S.fav, n]; save(); o.remove(); itemBook(); };
    }));
  }

  // =====================================================================
  // ホーム（学園の町）
  // =====================================================================
  const LINES = ['きょうも いっしょに がんばろう！', 'いろんな教科を解くと、運が上がるよ', '解いた問題は、復習ダンジョンで もう1回 正解すると 卒業だよ', 'ボスの弱点をつくと、大ダメージ！', 'バトル部、さいこう！'];
  function home() {
    dayCheck(); applyDebug(); refreshType();
    const t = total(S.st), luck = luckOf(S.st), sk = skillsOf(t);
    const review = dueList().length;
    const towerLeft = Math.max(0, towerLimit() - S.towerMs);
    const el = render(`
      <div class="topbar"><span class="pname">${mi('user', '👤')} ${esc(S.pname)}</span><span class="sp"></span>
        <span id="sta" class="pill" style="cursor:pointer">${ic('stamina', '⚡')} スタミナ <b>${S.stamina}</b><span class="xs dim"> / ${K.STAMINA_MAX}</span> <span class="xs">❔</span></span><span class="gold pill">${ic('coin', '🪙')} <b>${S.coins}</b></span><button class="btn-gray" id="set" style="font-size:18px;padding:6px 12px">${mi('set', '⚙️')} せってい</button></div>
      <div class="chara col">
        <div class="emo ${auraCls()}" id="me">${artPlayer(S.type, t)}</div>
        <div class="say" id="say"></div>
        ${S.sel.title ? `<div style="text-align:center">${titleBadge(S.sel.title)}</div>` : ''}
        <div style="text-align:center" class="mid">${esc(S.cname)} <span class="sm dim">（${S.type}タイプ）</span></div>
        <div style="text-align:center" class="sm">🍽️ ${seikakuName(S.seikaku)}</div>
        <div class="panel stats">
          ${SUBJ.map(s => `<div>${subjIc(s)} ${s} <b>${S.st[s]}</b></div>`).join('')}
          <div>🍀 運 <b>${luck}</b></div>
          <div class="dim" style="grid-column:span 3">ごうけい ${t}　HP ${R0(t * K.HPK)}　スキル ${sk.length}/8</div>
        </div>
      </div>
      <div class="menuR">
        <button class="wide" id="dun">${mb('dun', '⚔️', '育成ダンジョン', S.run ? `つづきから（${S.run.i + 1} / ${S.run.plan.length}）` : `スタミナ ${K.DUNGEON_COST} をつかう`)}</button>
        <button id="rev">${mb('rev', '📕', '復習ダンジョン', `まっている問題 ${review}問`)}</button>
        <button id="tow">${mb('tow', '🗼', '無限の塔', `きょうの のこり ${fmtTime(towerLeft)}`)}</button>
        <button id="tri">${mb('tri', '🧪', 'おためしバトル', '倒したボスと 練習試合')}</button>
        <button id="vs">${mb('vs', '🆚', '対戦モード', '2人で1台')}</button>
        <button id="grow" style="grid-column:span 2;height:84px">${mb('grow', '📈', 'せいちょう・スキル', growLine(t))}</button>
      </div>
      <div class="menuB">
        <button id="b1">${mb('b1', '🎰', 'ガチャ')}</button><button id="b2">${mb('b2', '🎒', 'もちもの')}</button><button id="b3">${mb('b3', '📋', '問題リスト')}</button><button id="b4">${mb('b4', '🔳', 'QR')}</button><button id="b5">${mb('b5', '🏆', 'アチーブメント')}</button>
      </div>`, 'home');
    $('#me', el).onclick = () => { $('#say', el).textContent = '「' + pick(LINES) + '」'; };
    $('#dun', el).onclick = () => startDungeon();
    $('#set', el).onclick = () => settings();
    $('#sta', el).onclick = () => staminaHelp();
    $('#rev', el).onclick = () => reviewDungeon();
    $('#tow', el).onclick = () => towerSelect();
    $('#b3', el).onclick = () => questionList();
    $('#b1', el).onclick = () => gacha();
    $('#b2', el).onclick = () => itemBook();
    $('#b5', el).onclick = () => achList();
    $('#vs', el).onclick = () => vsMode();
    $('#tri', el).onclick = () => trialMode();
    $('#grow', el).onclick = () => growthPanel();
    $('#b4', el).onclick = () => qrScreen();
    if (S.fedDay !== today()) { feedTime().then(fed => { if (fed) home(); }); return; }
    if (S.dungeons === 0) tip('まずは「育成ダンジョン」に行ってみよう！');
  }

  // ---- スタミナの説明 ----
  function staminaHelp() {
    const full = S.stamina >= K.STAMINA_MAX;
    return dialog({ who: '⚡', name: 'スタミナって なに？', text: `<div style="text-align:left;font-size:22px;line-height:1.8">・育成ダンジョンに 入るときに <b class="gold">${K.DUNGEON_COST}</b> つかうよ
・毎朝5時に <b class="gold">${K.STAMINA_DAY}</b> たまるよ（1日2回 ダンジョンに 入れる）
・遊ばなかった日の ぶんも たまって、<b class="gold">${K.STAMINA_MAX}</b> まで ためておけるよ
・復習ダンジョン・無限の塔・おためしバトル・対戦は スタミナを つかわないよ</div>
いまの スタミナ：<b class="gold">${S.stamina}</b> / ${K.STAMINA_MAX}${full ? '\n<span class="red">いっぱい！ これ以上は たまらないよ。ダンジョンで つかおう！</span>' : ''}` });
  }

  // ---- ごはん（1日1回。キャンディ＝せいかく−200／肉＝＋200。0〜2000）----
  let feeding = false;
  async function feedTime() {
    if (feeding || S.fedDay === today()) return false;
    if (/[?&]test/.test(location.search) && !/[?&]feed/.test(location.search)) { S.fedDay = today(); save(); return false; } // テストでは出さない
    feeding = true;
    const t = total(S.st), look0 = lookOf(S.type, t), name0 = seikakuName(S.seikaku);
    const f = await dialog({ who: '🍽️', text: `きょうの ごはんの時間！\n${esc(S.cname)}に どっちを あげる？`, choices: Object.entries(D.FOODS).map(([k, x]) => ({ label: `${x.e} ${x.n}`, val: k, cls: 'btn-main' })) });
    const food = D.FOODS[f], v0 = S.seikaku;
    S.seikaku = Math.max(0, Math.min(K.SEIKAKU_MAX, v0 + food.d)); S.fedDay = today(); save();
    const name1 = seikakuName(S.seikaku), look1 = lookOf(S.type, t);
    let txt = `${esc(S.cname)}は ${food.n}を おいしそうに 食べた！`;
    if (name1 !== name0) txt += `\nせいかくが「<span class="gold">${name1}</span>」に なった！`;
    else txt += `\n（せいかく：${name1}）`;
    if (look1 !== look0) txt += `\n✨ すがたが かわった！（${D.STYLE_NAME[styleFor(S, t)]}）`;
    await dialog({ who: look1 !== look0 ? artPlayer(S.type, t) : food.e, text: txt });
    feeding = false;
    return true;
  }

  // =====================================================================
  // 育成ダンジョン
  // ・入ったときに 道のり・雑魚・問題・イベントを先に決める
  // ・R.ns（いまの場所の進み具合）に 結果を書いてから セーブ → 開きなおしても同じ結果
  // =====================================================================
  const EVENTS = ['shop', 'coin', 'izumi', 'uranai', 'hayate', 'kurogane', 'sekihi', 'mimic', 'obake', 'omikuji', 'valz', 'mirror'];

  // 一度だけ実行して結果をセーブ（開きなおしたら、とっておいた結果を使う）
  async function once(key, fn) {
    if (key in R.ns) return R.ns[key];
    const v = await fn();
    R.ns[key] = v === undefined ? null : v; save();
    return R.ns[key];
  }

  // ---- せいちょう（進化・スキル）----
  const nextEvo = t => K.LOOK_LINE.find(x => t < x) || null;
  const nextSkill = t => D.SKILLS.filter(k => K.SKILL_LINE[k.n] && t < K.SKILL_LINE[k.n]).sort((a, b) => K.SKILL_LINE[a.n] - K.SKILL_LINE[b.n])[0] || null;
  function growLine(t) {
    const e = nextEvo(t), k = nextSkill(t);
    return [e ? `進化まで あと ${e - t}` : '進化は さいごまで できた！', k ? `次のスキルまで あと ${K.SKILL_LINE[k.n] - t}` : 'スキルは ぜんぶ おぼえた！'].join('　／　');
  }
  function growthPanel() {
    const t = total(S.st), stg = lookStage(t), e = nextEvo(t), sk = skillsOf(t);
    const prev = stg === 0 ? 0 : K.LOOK_LINE[stg - 1];
    const bar = (a, b) => `<div class="hpbar" style="width:100%;height:16px;margin:6px 0"><i style="width:${Math.min(100, (a / b) * 100)}%;background:linear-gradient(90deg,#22c55e,#a3e635)"></i></div>`;
    const evo = e
      ? `<div class="row" style="align-items:center;gap:16px"><span style="font-size:64px">${artPlayer(S.type, t)}</span><span class="mid">▶</span><span style="font-size:64px;filter:brightness(0) opacity(.5)">${artPlayer(S.type, e)}</span>
           <div style="flex:1"><div class="mid">進化まで あと <b class="gold">${e - t}</b></div>${bar(t - prev, e - prev)}<div class="xs dim">ステータスの ごうけい ${t} ／ ${e} で 進化</div></div></div>`
      : `<div class="row" style="align-items:center;gap:16px"><span style="font-size:64px">${artPlayer(S.type, t)}</span><div class="mid gold">さいごの すがたまで 進化した！</div></div>`;
    const sty = D.STYLE_NAME[styleOf(S.seikaku)];
    const sei = `<div class="sm" style="margin-top:8px">🍽️ せいかく：<b class="gold">${seikakuName(S.seikaku)}</b>　${e ? `いまの せいかくで 進化すると <b>${sty}</b> になるよ` : `せいかくが かわると、すがたも すぐ かわるよ（いまは ${sty}）`}<br><span class="xs dim">せいかくは 毎日の ごはん（🍬キャンディ・🍖肉）で かわる</span></div>`;
    const rows = D.SKILLS.map(k => {
      const line = K.SKILL_LINE[k.n] || 0, has = sk.includes(k.n);
      return `<div class="skrow ${has ? '' : 'lock'}"><span class="mid">${has ? '✅' : '🔒'} ${esc(k.n)}</span>
        <span class="sm">${has ? esc(k.d) + (k.ct ? `　<span class="dim">CT${k.ct}</span>` : '') : `ごうけい <b class="gold">${line}</b> で おぼえる（あと ${line - t}）`}</span></div>`;
    }).join('');
    const o = overlay(`<div class="panel" style="width:1060px;max-height:680px;overflow-y:auto">
      <div class="row" style="justify-content:space-between"><span class="big">📈 せいちょう・スキル</span><button class="btn-gray" id="cl">とじる</button></div>
      <div class="panel" style="margin:8px 0">${evo}${sei}</div>
      <div class="mid" style="margin:6px 0">スキル <span class="gold">${sk.length} / ${D.SKILLS.length}</span></div>
      <div class="sklist">${rows}</div></div>`);
    $('#cl', o).onclick = () => o.remove();
  }

  async function startDungeon() {
    if (S.run) { resumeRun(); return; } // 中断した ダンジョンの つづき（スタミナは つかわない）
    if (S.stamina < K.DUNGEON_COST) { tip('スタミナが足りないよ。あしたの朝5時に100回復するよ'); return; }
    const go = await dialog({ who: '⚔️', text: `スタミナを ${K.DUNGEON_COST} つかって 育成ダンジョンに入る？\n（いまのスタミナ ${S.stamina}）`, choices: [{ label: '入る！', val: true, cls: 'btn-main' }, { label: 'やめる', val: false, cls: 'btn-gray' }] });
    if (!go) return;
    S.stamina -= K.DUNGEON_COST;
    const seed = (Math.random() * 2 ** 32) >>> 0, rnd = makeRng(seed);
    const boss = pick(['国語', '算数', '理科', '社会', '英語', '無'].filter(b => b !== S.lastBoss), rnd);
    S.lastBoss = boss;
    const ev = shuffle(EVENTS, rnd);
    const forks = shuffle(['coin', 'item', 'event'], rnd).slice(0, 2);
    const plan = ['z', 'z', 'z', 'e1', 'z', 'z', 'f', 'z', 'z', 'z', 'e2', 'z', 'z', 't', 'b'];
    const luck = luckOf(S.st);
    const zako = plan.filter(p => p === 'z').map(() => { const k = Math.floor(rnd() * D.ZAKO.length); return { k, e: pick(D.ZAKO[k].e, rnd), re: pick(D.RARE_ZAKO.e, rnd), rare: rnd() < K.RARE_RATE * luck / 1000 * 1.2, drop: rnd() < K.DROP_RATE }; });
    const qpre = {}; SUBJ.forEach(s => (qpre[s] = drawNewQs(s, 10, rnd)));
    R = {
      seed, rnd, boss, plan, i: 0, zi: 0, zako, ev1: ev[0], ev2: ev[1], ev2on: rnd() < 0.5, forks,
      qpre, qptr: Object.fromEntries(SUBJ.map(s => [s, 0])), hand: [], coins: 0,
      startSt: { ...S.st }, startType: S.type, flags: {}, usedQ: new Set(), ns: {}, pend: [], bt: null,
    };
    save();
    runDungeon();
  }
  function resumeRun() {
    unpackRun(S.run);
    tip('つづきから はじめるよ', 2000);
    runDungeon();
  }

  function weakText(b) {
    if (b === '英語' || b === '無') return 'このボスには、弱点も、効きづらい教科もないようだ。';
    const w = D.WEAK[b], r = D.RESIST[b];
    return `このステージのボスは ${D.ELEM[b]}（${b}）属性。${D.ELEM[w]}（${w}）が有効で、${D.ELEM[r]}（${r}）は効きづらいようだ。`;
  }

  // 進行バーのマス：[画像のキー（assets の ui）, 画像がないときの絵文字, 種類]
  const NODE = { z: ['nodeZ', '⚔️', 'z'], e1: ['nodeE', '❓', 'e'], e2: ['nodeE', '❓', 'e'], f: ['nodeF', '🔀', 'f'], t: ['nodeT', '🎁', 't'], b: ['nodeB', '👑', 'b'] };
  function dunScreen() {
    const me = artPlayer(R.startType, total(R.startSt));
    const el = render(`
      <div class="prog dprog"><div class="track">${R.plan.map((p, i) => { const [k, e, c] = NODE[p];
          return `<span class="n n${c} ${i < R.i ? 'done' : ''} ${i === R.i ? 'cur' : ''}">${i === R.i ? `<span class="nme">${me}</span><span class="nsub">${artUi(k, e)}</span>` : artUi(k, e)}</span>`; }).join('')}</div>
        <span class="coin gold" id="coin">🪙 ${S.coins}</span><button class="btn-gray" id="dhome" disabled>🏠 ホーム</button></div>
      <div class="field">
        <div><div class="me" id="me">${artPlayer(R.startType, total(R.startSt))}</div><div class="lbl">${esc(S.cname)}</div></div>
        <div><div class="foe" id="foe"></div><div class="lbl" id="foelbl"></div></div>
      </div>
      <div class="msg panel" id="msg"></div>
      <div class="hand" id="hand"></div>
      <div class="subjbar" id="subj"></div>`, 'dun');
    drawHand(); return el;
  }
  function drawHand() {
    const c = $('#coin'); if (c) c.textContent = '🪙 ' + S.coins;
    const h = $('#hand'); if (!h) return;
    h.innerHTML = '<div class="sm dim" style="align-self:center">もちもの</div>' + [0, 1, 2, 3].map(i => {
      const n = R.hand[i]; if (!n) return '<div class="slot"></div>';
      return `<div class="slot" data-n="${esc(n)}">${artItem(n)}${S.owned.includes(n) ? '' : '<span class="new">NEW</span>'}</div>`;
    }).join('');
    h.querySelectorAll('.slot[data-n]').forEach(s => (s.onclick = () => showItem(s.dataset.n)));
  }
  // ダンジョンを 中断して ホームへ（教科をえらぶときだけ。つづきは ホームの育成ダンジョンから）
  // 拾ったアイテムは そのまま「仮」で、リザルトまで 自分のものには ならない
  function homeBtn(on) {
    const b = $('#dhome'); if (!b) return;
    b.disabled = !on;
    b.onclick = async () => {
      const go = await dialog({ who: '🏠', text: 'ダンジョンを 中断して ホームに もどる？\n（いまの ところから つづきが できるよ。ホームの「育成ダンジョン」を おしてね）', choices: [{ label: 'もどる', val: true, cls: 'btn-main' }, { label: 'つづける', val: false, cls: 'btn-gray' }] });
      if (!go || !R) return;
      save(); R = null; BT = null; home();
    };
  }
  const msg = h => { const m = $('#msg'); if (m) m.innerHTML = h; };
  const setFoe = (html, lbl) => { const f = $('#foe'); if (f) f.innerHTML = html; const l = $('#foelbl'); if (l) l.innerHTML = lbl; };
  const firstRun = () => S.dungeons === 0;

  async function runDungeon() {
    while (R && R.i < R.plan.length) {
      const p = R.plan[R.i];
      dunScreen();
      await flushPend();
      if (p === 'z') await zakoNode();
      else if (p === 'e1') await eventNode(R.ev1);
      else if (p === 'e2') { if (R.ev2on || R.flags.forkEvent) await eventNode(R.ev2); }
      else if (p === 'f') await forkNode();
      else if (p === 't') await treasureNode();
      else if (p === 'b') { await bossNode(); return; }
      if (p === 'z') R.zi++;
      R.i++; R.ns = {}; save();
    }
  }

  // 拾うアイテムは R.pend にためてからセーブ → 画面で拾う（開きなおしても消えない）
  function queuePick(n, text = '') { if (n) R.pend.push({ n, text }); }
  async function flushPend() {
    while (R.pend.length) {
      const { n, text } = R.pend[0];
      if (R.hand.length < K.ITEM_MAX) {
        await chooseItem(`${text}\n${artItem(n)} ${n} を拾った！`, [n], { labels: ['拾う'] });
        R.hand.push(n);
        if (firstRun() && !R.flags.tipItem) { R.flags.tipItem = 1; tip('拾ったアイテムは、この回のボス戦で効くよ。持てるのは4個まで'); }
      } else {
        const all = [...R.hand, n];
        const out = await chooseItem(`${text}\n${artItem(n)} ${n} を見つけた！ 持てるのは4個まで。\n<span class="gold">どれを すてる？</span>`, all, { labels: all.map(() => 'すてる') });
        R.hand = all.filter(x => x !== out);
      }
      R.pend.shift(); save(); drawHand();
    }
  }

  // ---- ボスの予告（最初の雑魚の前に1回）----
  async function bossPreview() {
    await dialog({ who: '🌫️', text: `${D.BOSSES[R.boss].hint}\n<span class="sm">${weakText(R.boss)}</span>`, choices: [{ label: '進む', val: 1, cls: 'btn-main' }] });
  }

  // ---- 雑魚 ----
  async function zakoNode() {
    if (R.i === 0 && !R.ns.preview) { await bossPreview(); R.ns.preview = 1; save(); }
    const zi = R.zi, z = R.zako[zi];
    const rare = await once('rare', () => {
      let r = z.rare;
      if (R.flags.nextRare) { r = true; R.flags.nextRare = false; }
      if (R.flags.rareIn && R.flags.rareIn.includes(zi)) r = true;
      return r;
    });
    const drop = z.drop || (R.flags.dropIn && R.flags.dropIn.includes(zi));
    const foe = rare ? D.RARE_ZAKO : D.ZAKO[z.k];
    const emo = rare ? z.re : z.e;
    const fname = (foe.ns && foe.ns[foe.e.indexOf(emo)]) || foe.n; // 1体ずつの名前
    setFoe(artZako(emo), rare ? `<span class="gold">✨ ${esc(fname)}</span>` : esc(fname));
    if (R.ns.ans) { await flushPend(); return; } // 答えたあとに閉じた → 結果はもう出ている
    msg(`${rare ? `✨ レア！ <span class="gold">${esc(fname)}</span>` : esc(fname)}があらわれた！<br><span class="gold">教科をえらんで 問題に答えよう</span>`);
    if (firstRun() && zi === 0) tip('教科をえらぶと問題が出るよ。正解すると、その教科のステータスが上がる！');
    const subj = await new Promise(res => {
      $('#subj').innerHTML = SUBJ.map(s => `<button data-s="${s}" style="border-color:${D.SUBJ_COLOR[s]}">${subjIc(s)} ${s}<small>${S.st[s]}</small></button>`).join('');
      $('#subj').querySelectorAll('button').forEach(b => (b.onclick = () => res(b.dataset.s)));
      homeBtn(true);
    });
    homeBtn(false);
    $('#subj').innerHTML = '';
    const pre = R.qpre[subj][R.qptr[subj]] || drawNewQs(subj, 1, R.rnd)[0];
    const q = Q[pre.id];
    let out = null;
    await ask(q, {
      head: pre.osarai ? '（おさらい）' : '',
      onAnswer: ok => { // 押した瞬間に結果を決めてセーブ
        R.qptr[subj]++;
        if (ok) {
          const gain = pre.osarai ? K.GAIN_OSARAI : K.GAIN;
          S.st[subj] += gain; if (!pre.osarai) { S.qs[q.id] = 3; S.qd[q.id] = today(); } // 正解 → あと1回
          const c = (pre.osarai ? K.COIN_OSARAI : K.COIN_OK) + (rare ? K.COIN_RARE : 0); S.coins += c; R.coins += c;
          if (drop) queuePick(drawItem(R.rnd, { cat: rare ? null : foe.cat, hand: R.hand }), `${fname}は アイテムを落としていった……`);
          out = { ok, subj, gain, c };
        } else {
          if (!pre.osarai) { S.qs[q.id] = 2; S.miss[q.id] = 1; } // 不正解 → 復習待ち（一発でまちがえた記録も残す）
          S.coins += K.COIN_NG; R.coins += K.COIN_NG;
          out = { ok, subj, c: K.COIN_NG, osarai: pre.osarai };
        }
        refreshType(); R.ns.ans = out; save();
      },
    });
    const foeEl = $('#foe');
    if (out.ok) {
      foeEl.classList.add('bye');
      floatAt(820, 180, `${subj} +${out.gain}`, D.SUBJ_COLOR[subj]);
      setTimeout(() => floatAt(860, 240, `🪙+${out.c}`, '#ffd54a'), T(300));
      msg(`⭕ たおした！ ${subj}が <b>${out.gain}</b> 上がった！${out.osarai ? '' : '<br><span class="sm">この問題は 復習ダンジョンで もう1回 正解すると 卒業だよ</span>'}`);
    } else {
      foeEl.style.transition = 'transform .6s,opacity .6s'; foeEl.style.transform = 'translateX(300px)'; foeEl.style.opacity = 0;
      if (out.c) floatAt(860, 240, `🪙+${out.c}`, '#ffd54a');
      msg(out.osarai ? '💨 にげられた…' : '💨 にげられた… この問題は <b>復習ダンジョン</b> に入ったよ');
      if (firstRun() && !R.flags.tipWrong) { R.flags.tipWrong = 1; tip('まちがえた問題は、復習ダンジョンで もう一度 挑戦できるよ'); }
    }
    drawHand();
    await wait(1200);
    await flushPend();
  }

  // ---- 分かれ道 ----
  async function forkNode() {
    setFoe(artUi('fork', '🔀'), '分かれ道');
    const L = { coin: '🪙 コインが多そうな道', item: '🎁 アイテムがありそうな道', event: '❓ イベントがありそうな道' };
    await once('fork', async () => {
      const c = await dialog({ who: artUi('fork', '🔀'), text: '道が2つに分かれている……\nどっちに進む？', choices: R.forks.map(f => ({ label: L[f], val: f })) });
      const base = R.zi; // 次の雑魚3体は base, base+1, base+2
      if (c === 'coin') R.flags.rareIn = [base + Math.floor(R.rnd() * 3)];
      if (c === 'item') R.flags.dropIn = shuffle([base, base + 1, base + 2], R.rnd).slice(0, 2);
      if (c === 'event') R.flags.forkEvent = true;
      return c;
    });
  }

  // ---- ボス前の宝箱（3つとも未取得）----
  async function treasureNode() {
    setFoe(artUi('treasure', '🎁'), 'ボス前の宝箱');
    const names = await once('names', () => { const a = []; for (let k = 0; k < 3; k++) { const n = drawItem(R.rnd, { unowned: true, hand: R.hand, exclude: a }); if (n) a.push(n); } return a; });
    if (!names.length) { await dialog({ who: artUi('treasure', '🎁'), text: '宝箱はからっぽだった……\n（もうぜんぶ持っているみたい！）' }); return; }
    if (firstRun() && !('pick' in R.ns)) tip('「NEW」は まだ持っていないアイテム。リザルトで1個持ち帰れるよ');
    await once('pick', async () => { const n = await chooseItem(`${artUi('treasure', '🎁')} 宝箱が3つある！ 1つえらんで開けよう`, names, { labels: names.map(() => '開ける') }); queuePick(n, `${artUi('treasure', '🎁')} 宝箱を開けた！`); return n; });
    await flushPend();
  }

  // ---- イベント ----
  async function eventQuiz(k, head) {
    for (let i = 0; i < k; i++) {
      const key = 'quiz' + i;
      if (!(key in R.ns)) {
        const q = drawSolvedQ(null, R.usedQ);
        await ask(q, { head: head + (k > 1 ? `（${i + 1}/${k}）` : ''), onAnswer: ok => { R.ns[key] = ok; save(); } });
      }
      if (!R.ns[key]) return false;
    }
    return true;
  }
  async function eventNode(id) {
    const luck = luckOf(S.st);
    const coin = c => { S.coins += c; R.coins += c; floatAt(860, 240, `🪙+${c}`, '#ffd54a'); drawHand(); };
    if (firstRun() && !R.flags.tipEv) { R.flags.tipEv = 1; tip('イベントでは、いいことが起きたり、問題で挑戦できたりするよ'); }
    const npc = artNpc;
    switch (id) {
      case 'shop': {
        setFoe(npc('ルリ', '👧'), '商人ルリ');
        const price = [0, 50, 100, 200];
        const names = await once('names', () => {
          const a = [];
          for (let r = 1; r <= 4; r++) a.push(drawItem(R.rnd, { unowned: true, rarity: r, hand: R.hand, exclude: a }) || drawItem(R.rnd, { rarity: r, hand: R.hand, exclude: a }));
          return a;
        });
        const list = names.map((n, i) => [n, price[i]]).filter(x => x[0]);
        await once('buy', async () => {
          const n = await chooseItem(`🛒 ルリ「いらっしゃい！ 1つだけ買えるよ」\n（もっているコイン 🪙${S.coins}）`, list.map(x => x[0]),
            { who: npc('ルリ', '👧'), labels: list.map(x => (S.coins >= x[1] ? (x[1] ? `🪙${x[1]}で買う` : 'タダでもらう') : null)), skip: '買わない' });
          if (n) { S.coins -= list.find(x => x[0] === n)[1]; queuePick(n, ''); }
          return n;
        });
        await flushPend(); break;
      }
      case 'coin': {
        setFoe(npc('ミドリ', '🍃'), 'こぼれたコイン');
        const c = await once('got', () => { const c = Math.round((100 + 200 * Math.min(1, R.rnd() * 0.6 + luck / 1000 * 0.5)) / 10) * 10; coin(c); return c; });
        await dialog({ who: npc('ミドリ', '🍃'), name: 'ミドリ', text: `「あっ、コインがこぼれちゃった！ 拾うのを手伝ってくれたお礼に、あげるね♪」\n🪙 ${c} コイン手に入れた！` });
        break;
      }
      case 'izumi': {
        setFoe(artUi('fountain', '⛲'), 'いやしの泉');
        await once('got', () => { R.flags.izumi = true; });
        await dialog({ who: npc('ミズナ', '💧'), name: 'ミズナ', text: '「この泉のお水、飲んでみて！ 体がじょうぶになるのよ」\nこのダンジョンのボス戦で、最大HPが +15%！' });
        break;
      }
      case 'uranai': {
        setFoe(npc('ヒカリ', '🔮'), 'うらないの妖精');
        await once('got', () => { R.flags.nextRare = true; });
        await dialog({ who: npc('ヒカリ', '⚡'), name: 'ヒカリ', text: '「……見えるわ。次に出会うのは、とってもめずらしいモンスターよ！」\n次の雑魚が、かならずレア雑魚になる！' });
        break;
      }
      case 'hayate': {
        setFoe(npc('ハヤテ', '🏃'), 'スカウトのハヤテ');
        await once('got', () => { R.flags.hayate = true; });
        await dialog({ who: npc('ハヤテ', '🏃'), name: 'ハヤテ', text: '「ボスのくせを知ってるぜ。こっそり教えてやるよ」\nこのダンジョンのボス戦では、ルーレットなしで毎ターン先攻・後攻をえらべる！' });
        break;
      }
      case 'kurogane': {
        setFoe(npc('クロガネ', '🗡️'), '師匠クロガネ');
        const go = await once('go', () => dialog({ who: npc('クロガネ', '🗡️'), name: 'クロガネ', text: '「修行をつけてやろう。3問つづけて正解できたら、ボス戦の威力が +20% だ」', choices: [{ label: '挑戦する', val: 1, cls: 'btn-main' }, { label: 'やめておく', val: 0, cls: 'btn-gray' }] }));
        if (!go) break;
        const ok = await eventQuiz(3, '修行');
        await once('res', () => { if (ok) R.flags.kurogane = true; });
        await dialog({ who: npc('クロガネ', '🗡️'), name: 'クロガネ', text: ok ? '「みごとだ！ その力、ボスにぶつけてこい」\nボス戦の威力 +20%！' : '「まだまだだな。またいつでも来い」' });
        break;
      }
      case 'sekihi': {
        setFoe(artUi('stone', '🗿'), '古い石碑');
        if (!('quiz0' in R.ns)) await dialog({ who: npc('コトハ', '🌸'), name: 'コトハ', text: '「石碑に問題が書いてあるの。解けたら、なにか起きるかもしれないわ」' });
        const ok = await eventQuiz(1, '石碑');
        await once('res', () => { if (ok) { coin(200); R.flags.sekihi = true; } });
        await dialog({ who: artUi('stone', '🗿'), text: ok ? '石碑が光った！\n🪙200コイン手に入れた！ ボスの弱点が さらに効くようになった（+10%）' : '石碑は しずかなままだ……' });
        break;
      }
      case 'mimic': {
        setFoe(artUi('mimic', '📦'), 'あやしい宝箱');
        if (!('quiz0' in R.ns)) await dialog({ who: artUi('mimic', '📦'), text: '宝箱だ！……と思ったら、ミミックだった！\n問題に正解すれば、たおしてアイテムを拾えるぞ！' });
        const ok = await eventQuiz(1, 'ミミック');
        await once('res', () => { if (ok) queuePick(drawItem(R.rnd, { hand: R.hand }), 'ミミックをたおした！'); });
        if (ok) { $('#foe').classList.add('bye'); await flushPend(); }
        else await dialog({ who: artUi('mimic', '📦'), text: 'ミミックは どこかへ にげていった……' });
        break;
      }
      case 'obake': {
        setFoe(artUi('obake', '👻'), 'いたずらおばけ');
        if (!('quiz0' in R.ns)) await dialog({ who: artUi('obake', '👻'), text: '「ケケケ、アイテムを1つ もらっちゃうぞ〜」\n問題に正解すれば、追いはらえる！' });
        const ok = await eventQuiz(1, 'おばけ');
        const lost = await once('res', () => {
          if (ok) return null;
          const can = R.hand.filter(n => S.owned.includes(n)); // 🆕 は取られない
          if (!can.length) return '';
          const n = pick(can, R.rnd); R.hand = R.hand.filter(x => x !== n); return n;
        });
        drawHand();
        if (ok) { $('#foe').classList.add('bye'); await dialog({ who: '✨', text: 'おばけを追いはらった！' }); }
        else if (lost) await dialog({ who: artUi('obake', '👻'), text: `${artItem(lost)} ${lost} を取られてしまった……` });
        else await dialog({ who: artUi('obake', '👻'), text: '「ちぇっ、取れるものがないや」\nおばけは帰っていった' });
        break;
      }
      case 'omikuji': {
        setFoe(npc('ミコト', '⛩️'), 'おみくじ');
        const go = await once('go', async () => {
          const v = await dialog({ who: npc('ミコト', '⛩️'), name: 'ミコト', text: `「おみくじ、引いていきませんか？ 1回 50コインです」\n（もっているコイン 🪙${S.coins}）`, choices: [{ label: '🪙50で引く', val: 1, cls: 'btn-main', disabled: S.coins < 50 }, { label: '引かない', val: 0, cls: 'btn-gray' }] });
          if (v) S.coins -= 50;
          return v;
        });
        if (!go) break;
        const t = await once('kuji', () => {
          const l = luck / 1000, r = R.rnd();
          const kuji = r < 0.15 + 0.2 * l ? '大吉' : r < 0.55 + 0.1 * l ? '吉' : r < 0.92 ? '凶' : '大凶';
          let t = `「${kuji}」！\n`;
          if (kuji === '大吉') { coin(200); t += '🪙200コイン手に入れた！'; }
          else if (kuji === '吉') { coin(100); t += '🪙100コイン手に入れた！'; }
          else if (kuji === '凶') t += 'なにも起きなかった……';
          else {
            const can = R.hand.filter(n => S.owned.includes(n));
            if (can.length) { const n = pick(can, R.rnd); R.hand = R.hand.filter(x => x !== n); t += `${artItem(n)} ${n} がこわれてしまった……`; }
            else t += 'でも、こわれるアイテムがなかった。セーフ！';
          }
          return t;
        });
        drawHand();
        await dialog({ who: npc('ミコト', '⛩️'), name: 'ミコト', text: t }); break;
      }
      case 'valz': {
        setFoe(npc('ヴァルツ', '😈'), '悪魔公ヴァルツ');
        const go = await once('go', () => dialog({ who: npc('ヴァルツ', '😈'), name: 'ヴァルツ', text: '「今のアイテムを全部わたせば、★4以上を2つくれてやろう…」\n（わたしたアイテムは、この回は使えなくなる）', choices: [{ label: '取引する', val: 1, cls: 'btn-main', disabled: !R.hand.length }, { label: 'ことわる', val: 0, cls: 'btn-gray' }] }));
        if (!go) break;
        const got = await once('got', () => {
          const old = R.hand, got = [];
          for (let k = 0; k < 2; k++) { const n = drawItem(R.rnd, { minR: 4, hand: got, exclude: old }); if (n) got.push(n); }
          R.hand = got; return got;
        });
        drawHand();
        await dialog({ who: npc('ヴァルツ', '😈'), name: 'ヴァルツ', text: `「フフフ…取引成立だ」\n${got.map(n => artItem(n) + ' ' + n).join('、')} を手に入れた！` });
        break;
      }
      case 'mirror': {
        setFoe(artUi('mirror', '🪞'), 'ふしぎな鏡');
        if (!R.hand.length && !('swap' in R.ns)) { await dialog({ who: artUi('mirror', '🪞'), text: 'ふしぎな鏡がある。\nアイテムを持っていれば、交換できたかもしれない……' }); break; }
        const sw = await once('swap', async () => {
          const n = await chooseItem(`${artUi('mirror', '🪞')} ふしぎな鏡に、アイテムがうつっている。\n1つを、同じレア度のべつのアイテムに交換できる`, R.hand, { labels: R.hand.map(() => '交換する'), skip: '交換しない' });
          if (!n) return null;
          const m = drawItem(R.rnd, { rarity: D.ITEM[n].r, hand: R.hand, exclude: [n] });
          if (!m) return null;
          R.hand = R.hand.map(x => (x === n ? m : x)); return [n, m];
        });
        drawHand();
        if (sw) await dialog({ who: artUi('mirror', '🪞'), text: `${artItem(sw[0])} ${sw[0]} が\n${artItem(sw[1])} ${sw[1]} に変わった！` });
        break;
      }
    }
  }

  // =====================================================================
  // 戦闘（CPUボス戦。対戦モードでも同じしくみを使う）
  // ・ターンのはじめの状態（snap）と、えらんだもの・答え（acts）をセーブ
  // ・開きなおしたら snap にもどして acts を当てなおす → 答えたぶんは取り消せない
  // =====================================================================
  function makeFighter(o) {
    const f = { ...o, items: new Set(o.items || []) };
    f.has = k => f.items.has(k);
    f.luck = Math.max(300, luckOf(f.st) - (f.has('特化の王冠') ? 100 : 0));
    f.type = o.type || typeOf(f.st, o.prevType);
    let hpm = 1 + 0.15 * f.has('いのちの実') + 0.6 * f.has('巨人のハート') + 0.08 * f.has('ランドセル');
    hpm = Math.min(hpm, 1 + K.HPCAP);
    if (f.has('竜の逆鱗')) hpm *= 0.8;
    if (o.hpBonus) hpm *= 1 + o.hpBonus;
    f.maxhp = R0(total(f.st) * K.HPK * hpm); f.hp = f.maxhp;
    Object.assign(f, { ct: {}, status: {}, used: new Set(), guard: 0, lastrecv: 0, lastdealt: 0, skipNext: false, seal: {}, lastsubj: null, cursubj: null, streak: 0, fail: 0, megane: 2, eraser: 1 });
    return f;
  }
  const DYN = ['hp', 'ct', 'status', 'guard', 'lastrecv', 'lastdealt', 'skipNext', 'seal', 'lastsubj', 'cursubj', 'streak', 'fail', 'megane', 'eraser'];
  function dyn(f) { const o = {}; DYN.forEach(k => (o[k] = clone(f[k] === undefined ? null : f[k]))); o.used = [...f.used]; return o; }
  function restoreDyn(f, o) { DYN.forEach(k => (f[k] = clone(o[k]))); f.used = new Set(o.used || []); }
  const dynAll = () => ({ P: dyn(BT.P), B: dyn(BT.B) });
  function hydrate(pk) {
    const P = makeFighter(pk.cfg.P), B = makeFighter(pk.cfg.B);
    P.opp = B; B.opp = P; P.side = 'P'; B.side = 'B';
    if (pk.snap) { restoreDyn(P, pk.snap.P); restoreDyn(B, pk.snap.B); }
    return { ...pk, P, B, used: new Set(pk.used || []) };
  }
  const btSave = () => (BT && BT.vs ? saveVs() : save());
  function packBT() { const { P, B, used, note, ...rest } = BT; return clone({ ...rest, used: [...used] }); }

  function cutRate(f) {
    let c = 0.10 * f.has('木の盾') + 0.35 * f.has('城の大盾') + 0.03 * f.has('ランドセル');
    if (f.has('くまのぬいぐるみ') && f.hp <= 0.3 * f.maxhp) c += 0.20;
    return Math.min(c, K.CUTCAP);
  }
  function subjMult(a, s) {
    let m = a.has(s + 'の紋章') ? 1.2 : 1;
    if (a.has('特化の王冠')) m *= s === SUBJ.reduce((b, x) => (a.st[x] > a.st[b] ? x : b)) ? 1.3 : 0.7;
    return m;
  }
  function recvMult(d, s) {
    if (d.type === '全教科') return K.ALLRES;
    if (D.WEAK[d.type] === s) return d.has('じょうぎ') ? 1.15 : 1.25;
    if (D.RESIST[d.type] === s) return 0.9;
    return 1;
  }
  const baseAtk = (a, s) => { const avg = total(a.st) / 5; return avg * Math.pow(a.st[s] / avg, K.EXP) * subjMult(a, s); };
  const topSubj = f => SUBJ.reduce((b, x) => (f.st[x] > f.st[b] ? x : b));
  const sealed = (f, turn) => SUBJ.filter(s => (f.seal[s] || 0) >= turn);

  // 問題ゲージなどの計算（1問ごと）
  const newGauge = () => ({ g: 0, correct: 0, run: 0, bonus: 0, s3: false });
  function gaugeStep(a, st, ok) {
    if (ok) { st.g += 1; st.correct++; st.run++; if (a.has('失敗は成功のもと') && a.fail) { st.bonus += 0.15 * a.fail; a.fail = 0; } a.streak++; }
    else {
      if (a.has('やり直し消しゴム') && a.eraser > 0) { a.eraser--; st.g += 1; st.eraserUsed = true; } else st.g += 0.5;
      st.run = 0; a.fail++; if (a.has('連続正解の炎')) a.streak = 0;
    }
    if (st.run >= 3) st.s3 = true;
  }
  function gaugeMult(a, st, n) {
    let m = (st.g / n) * (1 + st.bonus / n);
    if (a.has('えんぴつのお守り')) m *= 1 + Math.min(0.2, 0.04 * st.correct);
    if (a.has('連続正解の炎')) m *= 1 + Math.min(0.6, 0.06 * a.streak);
    if (a.has('百科じてん') && st.correct === n) m *= 1.3;
    return m;
  }

  function giveStatus(dst, stt, log) {
    if (dst.has('ユニコーンの角') && stt === 'どく') return;
    if (dst.has('おまもり') && !dst.used.has('おまもり')) { dst.used.add('おまもり'); log(`🧿 ${dst.name}のおまもりが ${stt}をふせいだ！`); return; }
    const was = stt in dst.status;
    dst.status[stt] = true;
    if (dst.has('教室のベル') || dst.has('ユニコーンの角')) dst.hp = Math.min(dst.maxhp, dst.hp + 0.05 * dst.maxhp);
    if (!was) log(`${art(g2(A, 'status', stt), D.STATUS[stt].e)} ${dst.name}は ${stt}になった！`, { stt });
  }
  const procRate = (a, d, r) => Math.min(1, r * (a.has('悪魔の契約書') ? 2.5 : 1) * (d.has('重力の石') ? 0.5 : 1));

  // 表示用の状態（演出中のHPなど）
  const vsnap = () => { const o = {}; [['P', BT.P], ['B', BT.B]].forEach(([k, f]) => (o[k] = { hp: f.hp, status: Object.keys(f.status), ct: { ...f.ct } })); return o; };

  // 攻撃1回ぶんを計算して、表示する出来事の列を返す
  function resolveAttack(a, d, act, turn, first, ctx) {
    const out = []; const log = (t, x) => out.push({ t, snap: vsnap(), ...x });
    const sk = act.sk, subj = act.subj; const skill = D.SKILLS.find(k => k.n === sk);
    let m = 1;
    if (a.has('あばれ斧')) m *= 1.3;
    if (a.has('城の大盾')) m *= 0.8;
    if (a.has('巨人のハート')) m *= 0.8;
    if (a.has('悪魔の契約書')) m *= 0.85;
    if (a.has('ふしぎなウォッチ')) m *= 0.9;
    if (a.has('両刃の剣')) m *= 1.5;
    if (a.has('運命の指輪')) m *= 0.92;
    if (a.has('バランスの天秤') && a.luck >= 900) m *= 1.15;
    if (a.has('背水の書')) m *= a.hp <= 0.5 * a.maxhp ? 1.5 : 0.9;
    if (a.has('給食の牛乳') && turn === 1) m *= 1.15;
    if (a.has('ラストのあめ') && turn === 3) m *= 1.15;
    if (a.has('うわばき') && first) m *= 1.1;
    if (a.has('くつした') && !first) m *= 1.1;
    if (a.has('たこ焼き') && sk === '通常攻撃') m *= 1.15;
    if (a.has('ジュース') && d.hp >= 0.5 * d.maxhp) m *= 1.12;
    if (a.has('応援ラッパ') && turn > 1 && a.lastdealt < d.lastdealt) m *= 1.2;
    if (a.has('きつねのおめん')) m *= !first && d.cursubj === subj ? 1.2 : 0.95;
    if (a.has('にじの紋章') && a.lastsubj && a.lastsubj !== subj) m *= 1.15;
    if (a.has('竜の逆鱗') && a.hp <= 0.5 * a.maxhp && !a.used.has('げきりん')) { m *= 3; a.used.add('げきりん'); log('🐉 竜の逆鱗！ 威力3倍！'); }
    if (a.has('らいうのくも') && 'しびれ' in d.status) m *= 1.3;
    if (a.has('かきごおり') && 'こおり' in d.status) m *= 1.2;
    if (a.has('道化のトランプ') && 'こんらん' in d.status) m *= 1.3;
    if (a.has('弱点さがしの虫めがね') && recvMult(d, subj) > 1) m *= 1.15;
    if (a.power) m *= a.power;                                  // クロガネの修行など
    if (a.weakSubj === subj) m *= a.weakMul;                   // 紋章が輝く（ボスの弱点補正）
    if ('しびれ' in a.status) { m *= 0.7; delete a.status['しびれ']; log(`${art(g2(A, 'status', 'しびれ'), '⚡')} ${a.name}はしびれて力が出ない…`); }
    let nocrit = a.has('運命の指輪');
    if ('よわき' in a.status) { m *= a.opp && a.opp.has('やみの霧') ? 0.6 : 0.8; nocrit = true; delete a.status['よわき']; log(`${art(g2(A, 'status', 'よわき'), '🫧')} ${a.name}はよわきになっている…`); }
    let cr, cm;
    if (a.has('運命の水晶')) { cr = 0.25; cm = 1.5; }
    else { cr = K.CRIT * a.luck / 1000 + 0.1 * a.has('ねらいのメガネ') + 0.25 * a.has('一撃の角') + (a.has('ひらめき電球') && act.s3 ? 0.25 : 0); cm = 2; }
    if (nocrit) cr = 0;
    const base = baseAtk(a, subj) * act.mult;
    const hits = sk === '連続攻撃' ? (a.has('でんせつの弓') ? [0.45, 0.45, 0.45] : [0.6, 0.6]) : [skill.pw];
    let totalD = 0;
    hits.forEach(h => {
      if (d.hp <= 0) return;
      const crit = ctx.rnd() < cr;
      let dmg = base * m * h;
      if (crit) dmg *= d.has('赤白ぼうし') && cm === 2 ? 1.5 : cm;
      else if (a.has('一撃の角')) dmg *= 0.8;
      if (sk === 'カウンター') dmg += a.lastrecv * (a.has('はね返しの鏡') ? 1 : 0.5);
      let eff = 1;
      if (sk !== 'かんつう') {
        eff = recvMult(d, subj);
        dmg *= eff * (1 - cutRate(d));
        if (d.guard) dmg *= d.has('鉄壁の兜') ? 0.3 : 0.5;
      }
      if (d.has('あばれ斧')) dmg *= 1.15;
      if ('やけど' in d.status) dmg *= a.has('火山のかけら') ? 1.4 : 1.2;
      if (ctx.cheer) dmg *= 3;
      dmg = Math.max(1, R0(dmg));
      const before = d.hp; d.hp -= dmg; totalD += dmg;
      const ganjo = d.hp <= 0 && d.has('がんじょう石') && !d.used.has('がんじょう') && before >= 0.5 * d.maxhp;
      if (ganjo) { d.used.add('がんじょう'); d.hp = 1; }
      out.push({ hit: dmg, crit, eff, side: d.side, snap: vsnap() });
      if (ganjo) log(`🪨 ${d.name}は がんじょう石で HP1でふみとどまった！`);
      if (d.has('かたいよろい')) { const r = R0(0.15 * dmg); a.hp -= r; log(`🌵 かたいよろいで ${a.name}も ${r} ダメージ`); }
      if (a.has('両刃の剣')) { const r = R0(0.25 * dmg); a.hp -= r; log(`⚔️ 両刃の剣で ${a.name}も ${r} ダメージ`); }
      Object.entries(D.INFLICT).forEach(([it, [stt, r]]) => { if (a.has(it) && ctx.rnd() < procRate(a, d, r)) giveStatus(d, stt, log); });
      if (a.has('嵐の羽') && ctx.rnd() < procRate(a, d, 0.2)) giveStatus(d, pick(Object.keys(D.STATUS)), log);
      if (d.has('嵐の羽') && ctx.rnd() < 0.3) giveStatus(a, pick(Object.keys(D.STATUS)), log);
    });
    d.guard = 0;
    if (sk === 'ガードバッシュ') { a.guard = 1; log(`🛡️ ${a.name}は 守りをかためた！（次に受けるダメージ${a.has('鉄壁の兜') ? '70%カット' : '半分'}）`); }
    if (sk === 'ふういん' && !first) { const top = topSubj(d); d.seal[top] = turn + 1 + (a.has('ふういんの鍵') ? 1 : 0); log(`🔒 ${d.name}の ${top}が ふういんされた！`); }
    if (sk === 'パワーシュート') a.skipNext = true;
    let heal = 0;
    if (sk === 'ドレイン') heal += 0.5 * totalD * (a.has('吸血セーター') ? 1.5 : 1);
    if (a.has('ドレインの牙')) heal += 0.1 * totalD;
    if (heal > 0 && a.hp > 0) { heal = R0(heal); a.hp = Math.min(a.maxhp, a.hp + heal); log(`💚 ${a.name}は HPを ${heal} 回復した`); }
    d.lastrecv = totalD; a.lastdealt = totalD; a.lastsubj = subj;
    return out;
  }
  function endTurn(f, log) {
    if ('どく' in f.status) { const dmg = R0(0.10 * f.maxhp * (f.opp.has('もうどくビン') ? 1.5 : 1)); f.hp -= dmg; log(`${art(g2(A, 'status', 'どく'), '🟣')} ${f.name}は どくで ${dmg} ダメージ`); }
    if (f.has('おにぎり') && f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + R0(0.03 * f.maxhp));
    if (f.has('ばんそうこう') && f.hp > 0 && f.hp <= 0.3 * f.maxhp && !f.used.has('ばんそうこう')) { f.used.add('ばんそうこう'); f.hp += R0(0.25 * f.maxhp); log(`🩹 ${f.name}は ばんそうこうで回復！`); }
    ['やけど', 'こおり', 'こんらん'].forEach(k => { if (k in f.status) { if (f.status[k] === true) f.status[k] = 'next'; else delete f.status[k]; } });
    Object.keys(f.ct).forEach(k => (f.ct[k] -= 1));
  }

  // ---- CPUボスの作戦 ----
  function bossChoose(b, p, turn, first) {
    const avail = b.skills.filter(k => !(b.ct[k] > 0));
    const ok = k => avail.includes(k);
    let sk = '通常攻撃';
    const est = baseAtk(b, topSubj(b)) * 0.8;
    if ('こおり' in b.status) sk = '通常攻撃';
    else if (ok('パワーシュート') && (p.hp <= est * 2 * recvMult(p, topSubj(b)) || turn === 3)) sk = 'パワーシュート';
    else if (b.hp < 0.45 * b.maxhp && ok('ガードバッシュ') && first && turn < 3) sk = 'ガードバッシュ';
    else if (b.hp < 0.45 * b.maxhp && ok('ドレイン')) sk = 'ドレイン';
    else if (ok('カウンター') && b.lastrecv > 0.25 * b.maxhp && first) sk = 'カウンター';
    else {
      const fav = b.fav.filter(ok);
      if (b.el === '無') sk = pick(avail);
      else if (fav.length && Math.random() < 0.6) sk = pick(fav);
    }
    const ban = sealed(b, turn);
    let cands = SUBJ.filter(s => !ban.includes(s)); if (!cands.length) cands = SUBJ;
    let subj;
    if ('こんらん' in b.status) subj = pick(cands);
    else subj = cands.reduce((x, s) => (baseAtk(b, s) * recvMult(p, s) > baseAtk(b, x) * recvMult(p, x) ? s : x));
    return { sk, subj };
  }

  // ---- ボス戦の画面 ----
  function battleScreen() {
    const { P, B } = BT;
    const side = (f, left) => `<div class="fighter" id="${left ? 'fP' : 'fB'}" style="${left ? 'left:40px' : 'right:40px'}">
      <div class="emo ${f.aura || ''}">${f.art}</div>${f.title ? `<div class="ttlrow">${titleBadge(f.title, 'sm')}</div>` : ''}<div class="nm">${esc(f.name)}${f.pname ? `<span class="sm">（${esc(f.pname)}）</span>` : ''} <span class="sm dim">${f.isBoss ? f.el + '属性' : f.type + 'タイプ'}</span></div>
      <div class="hpbar"><i></i></div><div class="hprow"><span class="sm hpt"></span><span class="stt"></span></div>
      <div class="row" style="justify-content:center;font-size:30px">${[...f.items].map(n => `<span class="it" data-n="${esc(n)}" style="cursor:pointer">${artItem(n)}</span>`).join('')}</div>
      <div class="gauge" style="visibility:hidden"><i></i></div><div class="sm gtxt"></div></div>`;
    const el = render(`<div class="turnlbl" id="turn"></div>${side(P, true)}${side(B, false)}
      <div class="blog panel" id="blog"></div>`, 'btl');
    el.querySelectorAll('.it').forEach(s => (s.onclick = () => showItem(s.dataset.n)));
    el.addEventListener('click', e => { const s = e.target.closest('.sti'); if (s) statusHelp(s.dataset.stt); }); // 状態異常のアイコンを タップで 説明
    updBars();
  }
  function updBars(snap) {
    if (!BT) return;
    snap = snap || vsnap();
    [['fP', BT.P, snap.P], ['fB', BT.B, snap.B]].forEach(([id, f, v]) => {
      const el = $('#' + id); if (!el) return;
      const r = Math.max(0, v.hp) / f.maxhp;
      el.querySelector('.hpbar i').style.width = r * 100 + '%';
      el.querySelector('.hpbar').classList.toggle('low', r < 0.3);
      el.querySelector('.hpt').textContent = `HP ${Math.max(0, R0(v.hp))} / ${f.maxhp}`;
      el.querySelector('.stt').innerHTML = v.status.map(k => `<span class="sti" data-stt="${k}" title="${k}">${art(g2(A, 'status', k), D.STATUS[k].e)}${k}</span>`).join(' ') +
        Object.entries(v.ct).filter(([, x]) => x > 0).map(([k, x]) => ` <span class="xs dim">${k}あと${x}</span>`).join('');
    });
  }
  const statusHelp = k => dialog({ who: art(g2(A, 'status', k), D.STATUS[k].e), name: k, text: D.STATUS[k].h });
  const blog = h => { const b = $('#blog'); if (b) b.innerHTML = h; };
  async function blogLines(lines, ms = 1100) { for (const l of lines) { blog(l); await msgWait(ms); } }
  function showGauge(f, st, n) {
    const el = $(f === BT.P ? '#fP' : '#fB'); if (!el) return;
    const g = el.querySelector('.gauge'); g.style.visibility = 'visible';
    const m = st ? gaugeMult(f, st, n) : 0;
    // 全問正解で ちょうど満タン。問題の数だけ くぎり線。アイテムで1倍をこえたら 金色に光る
    g.style.setProperty('--n', n);
    g.querySelector('i').style.width = Math.min(100, m * 100) + '%';
    g.classList.toggle('over', m > 1.001);
    el.querySelector('.gtxt').textContent = st ? `問題ゲージ ×${m.toFixed(2)}（${st.correct}/${n}問正解）` : '';
  }
  function hideGauges() { app.querySelectorAll('.gauge').forEach(g => (g.style.visibility = 'hidden')); app.querySelectorAll('.gtxt').forEach(g => (g.textContent = '')); }

  // ルーレット（運が高いほど幅が広い）
  async function roulette(P, B) {
    if (P.has('運命の指輪') !== B.has('運命の指輪')) { const w = P.has('運命の指輪') ? P : B; blog(`🎰 運命の指輪！ ${esc(w.name)}が 先攻・後攻をえらぶ`); await msgWait(1200); return w; }
    const wp = P.luck * (P.has('いかさまサイコロ') ? 1.25 : 1), wb = B.luck * (B.has('いかさまサイコロ') ? 1.25 : 1);
    const pa = 360 * wp / (wp + wb);
    const win = Math.random() < wp / (wp + wb) ? P : B;
    const side = (f, k) => `<div class="rl-side ${k}"><div class="rl-art">${f.art}</div><div class="rl-nm">${esc(f.name)}</div><div class="rl-luck">🍀 運 ${f.luck}</div></div>`;
    const lights = Array.from({ length: 24 }, (_, i) => `<i style="transform:rotate(${i * 15}deg) translateY(-176px)"></i>`).join('');
    const o = overlay(`<div class="rl">
      <div class="rl-title">先攻・後攻を 決める権利は……？</div>
      <div class="rl-stage">${side(P, 'p')}
        <div class="rl-wheel"><div class="rl-rays"></div><div class="rl-rim">${lights}</div>
          <div class="roul" style="background:conic-gradient(from 0deg,#2f7bff 0deg,#55b6ff ${pa / 2}deg,#2f7bff ${pa}deg,#ff3d5e ${pa}deg,#ff8a6b ${pa + (360 - pa) / 2}deg,#ff3d5e 360deg)"></div>
          <div class="rl-gloss"></div><div class="rl-hub">VS</div><div class="needle"></div></div>
        ${side(B, 'b')}</div>
      <div class="rl-win" id="rlw"></div></div>`);
    const wheel = o.querySelector('.roul');
    const th = win === P ? 6 + Math.random() * (pa - 12) : pa + 6 + Math.random() * (360 - pa - 12);
    await wait(300);
    o.querySelector('.rl').classList.add('spin');
    wheel.style.transitionDuration = T(2200) + 'ms';
    wheel.style.transform = `rotate(${360 * 5 + (360 - th)}deg)`;
    await wait(2300);
    o.querySelector('.rl').classList.remove('spin');
    o.querySelector(`.rl-side.${win === P ? 'p' : 'b'}`).classList.add('win');
    $('#rlw', o).innerHTML = `✨ ${esc(win.name)} が 決める権利を ゲット！`;
    await wait(1100); o.remove();
    return win;
  }

  // プレイヤーのスキル・教科えらび
  function playerSkill(P) {
    return new Promise(res => {
      const frozen = 'こおり' in P.status;
      const o = overlay(`<div class="panel selp" style="width:1100px"><div class="selh"><span class="mid">スキルをえらぼう</span>${frozen ? '<span class="sm">🧊こおっていて、通常攻撃しか使えない</span>' : ''}${BT.note || ''}</div>
        <div class="skgrid">${P.skills.map(k => {
          const s = D.SKILLS.find(x => x.n === k); const ct = P.ct[k] > 0 ? P.ct[k] : 0;
          const dis = ct > 0 || (frozen && k !== '通常攻撃');
          return `<button class="skb" data-k="${k}" ${dis ? 'disabled' : ''}><span class="skh">${g2(A, 'skill', k) ? `<span class="skic">${art(g2(A, 'skill', k), '')}</span>` : ''}<b>${esc(k)}</b>${ct ? `<span class="skct">あと${ct}ターン</span>` : ''}</span><span class="skd">${esc(s.d)}${s.ct ? `／CT${s.ct}` : ''}</span></button>`;
        }).join('')}</div></div>`, 'ovb');
      o.querySelectorAll('button').forEach(b => (b.onclick = () => { o.remove(); res(b.dataset.k); }));
    });
  }
  function playerSubj(P, B, turn) {
    return new Promise(res => {
      const ban = sealed(P, turn);
      if ('こんらん' in P.status) { const c = SUBJ.filter(s => !ban.includes(s)); const s = pick(c.length ? c : SUBJ); tip(`😵 こんらんして、教科が「${s}」になった！`); setTimeout(() => res(s), T(1500)); return; }
      const o = overlay(`<div class="panel selp" style="width:1180px"><div class="selh"><span class="mid">教科をえらぼう</span><span class="sm dim">（攻撃力の目安）</span>${BT.note || ''}</div>
        <div class="row" style="justify-content:center">${SUBJ.map(s => {
          let v = baseAtk(P, s) * recvMult(B, s); if (P.weakSubj === s) v *= P.weakMul;
          const tag = P.weakSubj === s ? '<span class="gold">✨弱点</span>' : recvMult(B, s) < 1 ? '<span class="dim">効きづらい</span>' : '';
          return `<button data-s="${s}" ${ban.includes(s) ? 'disabled' : ''} style="width:210px;height:96px;border-color:${D.SUBJ_COLOR[s]};display:flex;flex-direction:column;align-items:center;justify-content:center">${subjIc(s)} ${s}<span class="sm">攻撃 ${R0(v)}</span><span class="xs">${ban.includes(s) ? '🔒ふういん中' : tag}</span></button>`;
        }).join('')}</div></div>`, 'ovb');
      o.querySelectorAll('button').forEach(b => (b.onclick = () => { o.remove(); res(b.dataset.s); }));
    });
  }
  // えらんだときに起きること（先攻のふういん など）。開きなおしたときも同じように当てなおす
  function applyActStart(x, act, turn, first) {
    x.cursubj = act.subj;
    if (act.sk === 'ふういん' && first) { const y = x.opp, top = topSubj(y); y.seal[top] = turn + (x.has('ふういんの鍵') ? 1 : 0); }
    if (act.meg !== undefined) x.megane = act.meg;
  }
  // えらぶ人 P、あいて B（ボス戦ではプレイヤー、対戦では A・B どちらも）
  async function playerAct(P, B, turn, first, n = K.BOSS_Q) {
    let act = BT.acts[P.side];
    if (!act) {
      const sk = await playerSkill(P);
      const subj = await playerSubj(P, B, turn);
      act = { sk, subj, ans: [] }; BT.acts[P.side] = act; btSave();
      if (sk === 'ふういん' && first) tip(`🔒 ${B.name}の ${topSubj(B)}を ふういん！`);
    }
    applyActStart(P, act, turn, first);
    const st = newGauge();
    act.ans.forEach(ok => gaugeStep(P, st, ok));
    showGauge(P, st, n);
    while (act.ans.length < n) {
      const q = drawSolvedQ(act.subj, BT.used, P.qs || S.qs);
      await ask(q, {
        head: `（${act.ans.length + 1}/${n}問目）`, fighter: P, gauge: () => ({ m: gaugeMult(P, st, n), n }),
        onAnswer: ok => { gaugeStep(P, st, ok); act.ans.push(ok); act.meg = P.megane; btSave(); },
      });
      showGauge(P, st, n);
      if (st.eraserUsed) { st.eraserUsed = false; tip('🧽 やり直し消しゴム！ まちがいのマイナスなし'); }
    }
    act.mult = gaugeMult(P, st, n); act.s3 = st.s3;
    return act;
  }
  async function bossAct(B, P, turn, first) {
    let act = BT.acts.B; const fresh = !act, n = BT.qn || K.BOSS_Q;
    if (fresh) {
      const { sk, subj } = bossChoose(B, P, turn, first);
      act = { sk, subj, ans: Array.from({ length: n }, () => Math.random() < K.BOSS_ACC) };
      BT.acts.B = act; save();
    }
    applyActStart(B, act, turn, first);
    const st = newGauge();
    if (fresh) {
      blog(`${B.art} ${esc(B.name)}は「${act.sk}」で、${act.subj}の問題に挑戦！${act.sk === 'ふういん' && first ? `<br>🔒 ${esc(P.name)}の ${topSubj(P)}が ふういんされた！` : ''}`);
      showGauge(B, st, n);
      for (const ok of act.ans) { await wait(600); gaugeStep(B, st, ok); showGauge(B, st, n); }
      await msgWait(800);
    } else { act.ans.forEach(ok => gaugeStep(B, st, ok)); showGauge(B, st, n); }
    act.mult = gaugeMult(B, st, n); act.s3 = st.s3;
    return act;
  }

  // ターンの結果をまとめて計算（ここでセーブ）→ そのあと演出
  function resolveTurn(order, turn, cheer) {
    const ev = [];
    order.forEach((x, i) => {
      const y = x.opp, act = BT.acts[x.side];
      if (!act || act === 'skip' || x.hp <= 0 || y.hp <= 0) return;
      const s = D.SKILLS.find(k => k.n === act.sk);
      x.ct[act.sk] = (['カウンター', 'パワーシュート', 'ふういん'].includes(act.sk) && x.has('ふしぎなウォッチ') ? 1 : s.ct) + 1;
      ev.push({ cut: `${x.art} ${esc(x.name)}の <span class="gold">${act.sk}</span>！ <span class="sm">（${act.subj}）</span>` });
      ev.push(...resolveAttack(x, y, act, turn, i === 0, { rnd: Math.random, cheer }));
      if (cheer && y.hp > 0) { const extra = Math.max(1, R0(y.hp)); y.hp = 0; ev.push({ hit: extra, crit: false, eff: 1, side: y.side, snap: vsnap() }); }
    });
    if (!cheer) [BT.P, BT.B].forEach(f => endTurn(f, t => ev.push({ t, snap: vsnap() })));
    return ev;
  }
  async function playEvents(ev) {
    for (const e of ev) {
      if (e.cut) { await cutin(e.cut, 1100); continue; }
      if (e.hit) {
        const tEl = $(e.side === 'P' ? '#fP' : '#fB'), d = e.side === 'P' ? BT.P : BT.B;
        if (tEl) { tEl.classList.remove('hit'); void tEl.offsetWidth; tEl.classList.add('hit'); }
        floatAt(e.side === 'P' ? 260 : 960, 150, (e.crit ? '会心！ ' : '') + e.hit, e.crit ? '#f472b6' : '#fde047', 'dmg');
        blog(`${e.crit ? '💥 会心の一撃！ ' : ''}${esc(d.name)}に <b class="gold">${e.hit}</b> ダメージ！ ${e.eff > 1 ? '<span class="gold">こうかばつぐん！</span>' : e.eff < 1 ? '<span class="dim">いまひとつ…</span>' : ''}`);
        updBars(e.snap); await msgWait(900);
      } else {
        blog(e.t); updBars(e.snap); await msgWait(1000);
        // CPU戦だけ：はじめて見る 状態異常は 説明を出す（対戦では出さない。きろくは QR に入れない）
        if (e.stt && !BT.vs) { S.seenStt = S.seenStt || {}; if (!S.seenStt[e.stt]) { S.seenStt[e.stt] = 1; save(); await statusHelp(e.stt); } }
      }
    }
    updBars();
  }

  async function playTurn() {
    const { P, B } = BT, turn = BT.turn;
    hideGauges();
    $('#turn').textContent = `ターン ${turn} / 3`;
    await cutin(`ターン ${turn}`, 900, false);
    if (!BT.firstId) {
      let right;
      if (R && R.flags.hayate) { right = P; blog('🏃 ハヤテ「ボスのくせはお見通しだ！」 先攻・後攻をえらべる'); await msgWait(900); }
      else right = await roulette(P, B);
      let first;
      if (right === P) first = await dialog({ text: `${esc(P.name)}が 決める権利をとった！\n先攻（先に攻撃できる）と 後攻（相手のえらんだものを見てからえらべる）、どっちにする？`, choices: [{ label: `${artUi('first', '⚔️')} 先攻`, val: P, cls: 'btn-main' }, { label: `${artUi('second', '👀')} 後攻`, val: B, cls: 'btn-blue' }] });
      else { first = B; blog(`${esc(B.name)}が 決める権利をとった！ ${esc(B.name)}は先攻をえらんだ`); await msgWait(1300); }
      BT.firstId = first.side; save();
    }
    const first = BT.firstId === 'P' ? P : B, order = [first, first.opp];
    for (let i = 0; i < 2; i++) {
      const x = order[i];
      if (BT.acts[x.side] === 'skip' || (!BT.acts[x.side] && x.skipNext)) {
        x.skipNext = false;
        if (BT.acts[x.side] !== 'skip') { BT.acts[x.side] = 'skip'; save(); }
        blog(`${esc(x.name)}は パワーシュートの反動で動けない！`); await msgWait(1300); continue;
      }
      if (x === P) {
        const ba = BT.acts.B;
        BT.note = i === 1 && ba && ba !== 'skip' ? `<div class="sm gold" style="margin-bottom:6px">👀 ${esc(B.name)}は「${ba.sk}」・${ba.subj} をえらんだ。どうする？</div>` : '';
        await playerAct(P, B, turn, i === 0, BT.qn || K.BOSS_Q);
      } else await bossAct(B, P, turn, i === 0);
    }
    hideGauges();
    // 計算 → セーブ → 演出（演出中に閉じても、結果は変わらない）
    const ev = resolveTurn(order, turn, false);
    let res = null;
    if (P.hp <= 0 || B.hp <= 0) res = B.hp <= 0 && (P.hp > 0 || B.hp / B.maxhp < P.hp / P.maxhp) ? 'win' : 'lose';
    else if (turn >= 3) {
      const rp = P.hp / P.maxhp, rb = B.hp / B.maxhp; res = rp >= rb ? 'win' : 'lose';
      ev.push({ t: `⏱️ 3ターンで決着がつかなかった！ のこりHPの割合で勝負… ${esc(P.name)} ${R0(rp * 100)}% ／ ${esc(B.name)} ${R0(rb * 100)}%`, snap: vsnap() });
    }
    BT.turn = turn + 1; BT.firstId = null; BT.acts = {}; BT.snap = dynAll();
    if (res) { BT.phase = 'end'; BT.result = res; }
    save();
    await playEvents(ev);
  }

  // ボス戦の2人（育成ダンジョンと おためしバトルで共通）
  // look：見た目（ダンジョンでは 入ったときの すがた。進化はリザルトで）
  function bossCfg(boss, stg, hand, flags = {}, look = null) {
    const t = total(S.st), bd = D.BOSSES[boss];
    // ボスのステータス（プレイヤーの合計に合わせる）
    const btot = t * K.BOSS_POWER, w = SUBJ.map(s => (s === boss ? 1.5 : 1)), ws = w.reduce((a, b) => a + b);
    const bst = {}; SUBJ.forEach((s, i) => (bst[s] = R0(btot * w[i] / ws)));
    const skills = skillsOf(t);
    const lt = look || { type: S.type, t };
    const cP = { name: S.cname, emo: lookOf(lt.type, lt.t), art: artPlayer(lt.type, lt.t), st: { ...S.st }, items: [...hand], prevType: S.type, hpBonus: flags.izumi ? 0.15 : 0, skills, power: flags.kurogane ? 1.2 : 1, title: S.sel.title, aura: auraCls() };
    const cB = { name: bd.n[stg], emo: bd.e[stg], art: art(g2(A, 'boss', boss, stg), bd.e[stg]), st: bst, items: bd.items.slice(0, stg + 1), isBoss: true, el: bd.el, fav: bd.fav, skills, type: boss, hpBonus: K.BOSS_HP[stg] - 1 };
    // 紋章が輝く：弱点の教科は、いちばん強い教科と同じくらいの攻撃力になる
    const wk = D.WEAK[boss];
    if (wk) {
      const tmp = makeFighter(cP);
      const best = SUBJ.reduce((x, s) => (baseAtk(tmp, s) > baseAtk(tmp, x) ? s : x));
      cP.weakSubj = wk; cP.weakMul = Math.max(1, baseAtk(tmp, best) / baseAtk(tmp, wk)) * (flags.sekihi ? 1.1 : 1);
    }
    return { P: cP, B: cB };
  }
  // ---- テスト用：ボス戦を 画面なしで くりかえす（難易度の調整用。MB.simBoss）----
  // ほんものの計算（resolveAttack・bossChoose など）をそのまま使う。プレイヤーは「いちばん強そうな手」をえらぶ
  function simPlayer(P, B, turn, first, bAct) {
    const ban = sealed(P, turn);
    let cands = SUBJ.filter(s => !ban.includes(s)); if (!cands.length) cands = SUBJ;
    const val = s => baseAtk(P, s) * recvMult(B, s) * (P.weakSubj === s ? P.weakMul : 1);
    const subj = 'こんらん' in P.status ? pick(cands) : cands.reduce((x, s) => (val(s) > val(x) ? s : x));
    const avail = 'こおり' in P.status ? ['通常攻撃'] : P.skills.filter(k => !(P.ct[k] > 0));
    const est = val(subj) * (1 - cutRate(B));
    const sc = k => {
      const pw = D.SKILLS.find(x => x.n === k).pw;
      if (k === '連続攻撃') return P.has('でんせつの弓') ? 1.35 : 1.2;
      if (k === 'パワーシュート') return turn === 3 || est * 2 >= B.hp ? 2.1 : 0.9;
      if (k === 'ドレイン') return pw + (P.hp < 0.5 * P.maxhp ? 0.4 : 0);
      if (k === 'ガードバッシュ') return pw + (first && turn < 3 ? 0.3 : 0);
      if (k === 'ふういん') return pw + (first ? 0.2 : 0);
      if (k === 'カウンター') return pw + (est > 0 ? (0.5 * P.lastrecv) / est : 0);
      if (k === 'かんつう') return pw / Math.min(1, recvMult(B, subj) * (1 - cutRate(B)));
      return pw;
    };
    return { sk: avail.reduce((x, k) => (sc(k) > sc(x) ? k : x)), subj };
  }
  function simBoss({ st, boss = null, items = [], acc = 1, n = 1000, bossHp = null }) {
    const bak = { st: S.st, type: S.type, BT, hp: K.BOSS_HP };
    if (bossHp) K.BOSS_HP = bossHp;
    S.st = { ...st }; S.type = typeOf(S.st, S.type);
    const stg = stageOf(total(S.st)), q = K.BOSS_Q;
    let win = 0, turns = 0;
    try {
      for (let i = 0; i < n; i++) {
        const b = boss || pick(['国語', '算数', '理科', '社会', '英語', '無']);
        const its = typeof items === 'function' ? items(i) : items;
        const cfg = bossCfg(b, stg, its);
        const P = makeFighter(cfg.P), B = makeFighter(cfg.B);
        P.opp = B; B.opp = P; P.side = 'P'; B.side = 'B';
        BT = { P, B };
        let res = null, turn = 1;
        for (; turn <= 3 && !res; turn++) {
          let first;
          if (P.has('運命の指輪') !== B.has('運命の指輪')) first = P.has('運命の指輪') ? P : B;
          else { const wp = P.luck * (P.has('いかさまサイコロ') ? 1.25 : 1), wb = B.luck * (B.has('いかさまサイコロ') ? 1.25 : 1); first = Math.random() < wp / (wp + wb) ? P : B; }
          const order = [first, first.opp], acts = {};
          order.forEach((x, k) => {
            if (x.skipNext) { x.skipNext = false; acts[x.side] = 'skip'; return; }
            const fst = k === 0;
            const a = x === P ? simPlayer(P, B, turn, fst, acts.B) : bossChoose(B, P, turn, fst);
            const ok = x === P ? acc : K.BOSS_ACC;
            a.ans = Array.from({ length: q }, () => Math.random() < ok);
            applyActStart(x, a, turn, fst);
            const g = newGauge(); a.ans.forEach(o => gaugeStep(x, g, o));
            a.mult = gaugeMult(x, g, q); a.s3 = g.s3; acts[x.side] = a;
          });
          order.forEach((x, k) => {
            const y = x.opp, a = acts[x.side];
            if (!a || a === 'skip' || x.hp <= 0 || y.hp <= 0) return;
            const s = D.SKILLS.find(z => z.n === a.sk);
            x.ct[a.sk] = (['カウンター', 'パワーシュート', 'ふういん'].includes(a.sk) && x.has('ふしぎなウォッチ') ? 1 : s.ct) + 1;
            resolveAttack(x, y, a, turn, k === 0, { rnd: Math.random, cheer: false });
          });
          [P, B].forEach(f => endTurn(f, () => {}));
          if (P.hp <= 0 || B.hp <= 0) res = B.hp <= 0 && (P.hp > 0 || B.hp / B.maxhp < P.hp / P.maxhp) ? 'win' : 'lose';
          else if (turn >= 3) res = P.hp / P.maxhp >= B.hp / B.maxhp ? 'win' : 'lose';
        }
        if (res === 'win') win++;
        turns += turn - 1;
      }
    } finally { S.st = bak.st; S.type = bak.type; BT = bak.BT; K.BOSS_HP = bak.hp; }
    return { win: win / n, turns: turns / n };
  }
  // アイテムを ダンジョンと同じように ひく（テスト用）
  // ダンジョン1回で 見つけるのは 6個くらい → レアなものを 4個のこす
  const simHand = (seen = 6, k = K.ITEM_MAX) => { const h = []; for (let i = 0; i < seen; i++) { const it = drawItem(Math.random, { hand: h }); if (it) h.push(it); } return h.sort((a, b) => D.ITEM[b].r - D.ITEM[a].r).slice(0, k); };

  async function bossIntro() {
    const { P, B } = BT;
    await cutin(`${B.art} <span class="gold">${esc(B.name)}</span> があらわれた！`, 1600);
    if (B.items.size) await blogLines([`${esc(B.name)}の持ち物：${[...B.items].map(n => artItem(n) + n).join('、')}`], 1600);
    if (P.weakSubj) await blogLines([`✨ 紋章が輝く…！！ このボスには ${P.weakSubj}（弱点）の攻撃力が <b class="gold">${P.weakMul.toFixed(2)}倍</b> になる！`], 2200);
  }

  async function bossNode() {
    if ('boss' in R.ns) return result_(); // ボス戦はもう終わっている
    const stg = stageOf(total(S.st));
    if (!R.bt) {
      R.bt = { cfg: bossCfg(R.boss, stg, R.hand, R.flags, { type: R.startType, t: total(R.startSt) }), snap: null, turn: 1, firstId: null, acts: {}, used: [], cont: false, phase: 'intro', result: null };
      save();
    }
    BT = hydrate(R.bt);
    const { P, B } = BT;
    battleScreen();
    $('#turn').textContent = '👑 ボス戦';
    if (BT.phase === 'intro') {
      await bossIntro();
      if (firstRun()) tip('ボス戦は3ターン。スキルと教科をえらんで、問題に答えて攻撃しよう！', 4000);
      BT.phase = 'turn'; BT.snap = dynAll(); save();
    }
    while (BT.phase === 'turn') await playTurn();
    if (BT.phase === 'end' && BT.result === 'lose') {
      blog(`${esc(P.name)}は たおれてしまった……`); await msgWait(1500);
      const cont = await dialog({ who: '💫', text: 'コンティニューする？\n（仲間が 応援に かけつけてくれるよ）', choices: [{ label: '🔥 コンティニュー', val: true, cls: 'btn-main' }, { label: 'リザルトへ', val: false, cls: 'btn-gray' }] });
      if (!cont) return finishBoss('lose');
      BT.cont = true; P.hp = P.maxhp; P.status = {}; P.skipNext = false; P.seal = {}; Object.keys(P.ct).forEach(k => (P.ct[k] = 0));
      BT.phase = 'cheer'; BT.acts = {}; BT.snap = dynAll(); save();
    }
    if (BT.phase === 'cheer') {
      updBars();
      await cutin('📣 みんなの応援！', 1200);
      for (const f of D.FRIENDS) await cutin(`<span class="cutnpc">${artNpc(f.n, f.e)}</span> ${f.n}「がんばって、${esc(S.cname)}！」`, 800, false);
      $('#turn').textContent = '📣 応援ターン';
      BT.note = '<div class="sm gold" style="margin-bottom:6px">📣 みんなの応援で 力が わいてきた！</div>';
      const act = await playerAct(P, B, 4, true);
      const good = act.mult;
      const ev = resolveTurn([P], 4, true);
      BT.phase = 'end'; BT.result = 'win'; BT.snap = dynAll(); save();
      await cutin(good >= 1 ? 'みんなの力がひとつに！！' : good >= 0.8 ? '応援の力が集まる！' : 'いけーっ！', 1200);
      await playEvents(ev);
    }
    if (BT.result === 'win') {
      const fb = $('#fB'); if (fb) fb.classList.add('bye');
      await cutin(`🏆 ${esc(B.name)}を たおした！`, 1800);
      return finishBoss('win');
    }
  }
  function finishBoss(res) {
    R.ns.boss = res; R.ns.cont = !!BT.cont; R.bt = null; BT = null; save();
    return result_();
  }

  // =====================================================================
  // リザルト
  // =====================================================================
  async function result_() {
    const beat = R.ns.boss === 'win', cont = R.ns.cont;
    const t0 = total(R.startSt), t1 = total(S.st), stg = stageOf(t1);
    const rw = await once('reward', () => {
      let bossItem = null, bossCoin = 0;
      if (beat) {
        bossCoin = K.COIN_BOSS * (stg + 1); S.coins += bossCoin; R.coins += bossCoin;
        bossItem = drawItem(R.rnd, { unowned: true, hand: R.hand, minR: cont ? 1 : 3 });
      }
      S.dungeons++; refreshType();
      if (beat) {
        S.clears++; S.bossWin[R.boss] = 1;
        S.bossStg = S.bossStg || {}; S.bossStg[R.boss] = (S.bossStg[R.boss] || 0) | ((2 << stg) - 1); // ★3を倒したら ★1・★2も倒したことにする
        if (stg === 2) S.boss3[R.boss] = 1;
        if (!cont) S.nocont++;
      }
      return { bossItem, bossCoin };
    });
    window.MB_LAST = { beat, cont };
    render(`<div class="scr center" style="gap:14px">
      <div class="big gold">${beat ? '🏆 ダンジョン クリア！' : '🌙 ダンジョン おわり'}</div>
      <div class="panel" style="width:900px">
        <div class="row" style="justify-content:space-around;font-size:24px">${SUBJ.map(s => { const d = S.st[s] - R.startSt[s]; return `<div style="text-align:center">${subjIc(s)} ${s}<br><b>${S.st[s]}</b><br><span class="${d ? 'green' : 'dim'}">+${d}</span></div>`; }).join('')}</div>
        <div class="mid" style="text-align:center;margin-top:12px">ごうけい ${t0} → <b class="gold">${t1}</b>　　🪙 +${R.coins}（もっている ${S.coins}）</div>
        ${beat ? `<div class="sm" style="text-align:center;margin-top:6px">${cont ? 'ボス撃破ボーナス 🪙' + rw.bossCoin : '✨ ノーコンティニュー！ レアなアイテムをゲット　🪙' + rw.bossCoin}</div>` : ''}
      </div></div>`, 'res', 'result');
    await msgWait(1500);
    // 持ち帰り（未取得のものから1個。1日2個まで。ボス撃破報酬も候補にまぜる）
    await once('take', async () => {
      const cands = [...new Set([...R.hand, ...(rw.bossItem ? [rw.bossItem] : [])])].filter(n => !S.owned.includes(n));
      if (rw.bossItem) await chooseItem('👑 ボス撃破のごほうび！ 持ち帰りの候補に入ったよ', [rw.bossItem], { labels: ['見た！'] });
      if (S.takeHome >= K.TAKEHOME_PER_DAY) { await dialog({ who: '🎒', text: `きょうは もう アイテムを持ち帰れないよ（ダンジョンからは1日${K.TAKEHOME_PER_DAY}個まで）\nまた あした！` }); return null; }
      if (!cands.length) { await dialog({ who: '🎒', text: '持ち帰れる 新しいアイテムはなかった……\n（ぜんぶ もう持っているアイテムだった）' }); return null; }
      const took = await chooseItem(`🎒 1つだけ 持ち帰れるよ！（きょう あと${K.TAKEHOME_PER_DAY - S.takeHome}個）`, cands, { labels: cands.map(() => '持ち帰る') });
      S.owned.push(took); S.takeHome++;
      return took;
    });
    await evolution(R.startSt, R.startType);
    R = null; BT = null; S.run = null; save();
    home();
  }

  // 進化演出（新スキル・タイプ変化・見た目の成長）
  async function evolution(st0, type0) {
    const t0 = total(st0), t1 = total(S.st);
    const newSk = skillsOf(t1).filter(k => !skillsOf(t0).includes(k));
    const p0 = { seikaku: S.seikaku, style: S.style, styleStg: S.styleStg };
    const g0 = lookStage(t0), g1 = lookStage(t1);
    // 進化した段階の すがた（かわいい系・かっこいい系）は、いまの せいかくで決まる
    const evolved = g1 > g0;
    if (evolved) { S.style = styleOf(S.seikaku); S.styleStg = g1; save(); }
    const look0 = lookOf(type0, t0, p0), look1 = lookOf(S.type, t1);
    if (!newSk.length && type0 === S.type && look0 === look1) return;
    const o = overlay(`<div class="center" style="gap:20px"><div style="font-size:200px;line-height:1" id="evo">${artPlayer(type0, t0, p0)}</div><div class="big" id="evt"></div><div id="evb"></div></div>`);
    if (look0 !== look1 || type0 !== S.type) {
      const e = $('#evo', o);
      for (let i = 0; i < 8; i++) { e.style.filter = i % 2 ? 'brightness(3)' : 'none'; await wait(180 - i * 15); }
      e.innerHTML = artPlayer(S.type, t1); e.style.filter = 'drop-shadow(0 0 40px #fde047)';
      $('#evt', o).innerHTML = `<span class="gold">${esc(S.cname)}</span>が ${evolved ? `<span class="gold">${D.STYLE_NAME[styleFor(S, t1)]}</span>に ` : ''}進化した！${type0 !== S.type ? `<div class="mid">${S.type}タイプになった！</div>` : ''}`;
      await msgWait(2200);
    }
    for (const k of newSk) {
      $('#evt', o).innerHTML = `✨ 新しいスキル <span class="gold">「${k}」</span> を おぼえた！<div class="sm">${D.SKILLS.find(s => s.n === k).d}</div>`;
      await msgWait(2200);
    }
    $('#evb', o).innerHTML = '<button class="btn-main">ホームへ</button>';
    await new Promise(r => ($('#evb button', o).onclick = r));
    o.remove();
  }

  // =====================================================================
  // 復習ダンジョン（スタミナなし）
  // まちがい（2）→ 正解で +8・コイン+10 →（3：別の日まで待つ）→ 別の日に正解で +2 → 卒業（4）
  // まちがえたら、ほかの問題をはさんで もう一度出る
  // =====================================================================
  function dueList() {
    const t = today();
    return Object.entries(S.qs).filter(([id, v]) => (v === 2 || v === 3) && S.qd[id] !== t).map(([id]) => +id).filter(id => Q[id]);
  }
  async function reviewDungeon() {
    const due = dueList();
    if (!due.length) { await dialog({ who: '📕', text: '回答できる問題はないようだ。\n（まちがえた問題は すぐ、正解した問題は 次の日から ここに出るよ）' }); return; }
    const st0 = { ...S.st }, type0 = S.type;
    let queue = shuffle(due), retry = [], okN = 0, ngN = 0;
    const el = render(`
      <div class="prog"><span class="mid">📕 復習ダンジョン</span><span class="coin gold" id="coin">🪙 ${S.coins}</span></div>
      <div class="field">
        <div><div class="me">${artPlayer(S.type, total(S.st))}</div><div class="lbl">${esc(S.cname)}</div></div>
        <div><div class="foe" id="foe"></div><div class="lbl" id="foelbl"></div></div>
      </div>
      <div class="msg panel" id="msg" style="width:1232px"></div>
      <div class="subjbar" id="subj"></div>`, 'dun');
    const left = () => queue.length + retry.length;
    while (true) {
      let id = null;
      const ri = retry.findIndex(r => r.wait <= 0);
      if (ri >= 0) id = retry.splice(ri, 1)[0].id;
      else if (queue.length) id = queue.shift();
      else break;
      const q = Q[id], stage = S.qs[id];
      $('#foe').innerHTML = artZako(stage === 3 ? '🦉' : '👻'); $('#foe').className = 'foe fadein';
      $('#foelbl').textContent = stage === 3 ? 'あと1回（正解で卒業）' : '復習まち';
      msg(`のこり <b>${left() + 1}</b> 問。解いた問題に もう一度 挑戦して、しっかり おぼえよう！`);
      let out = null;
      const r = await ask(q, {
        head: stage === 3 ? '（あと1回）' : '（復習まち）', extra: '🏠 ホームへ',
        onAnswer: ok => {
          retry.forEach(x => x.wait--);
          if (ok) {
            // 1段階上がるのは 1日1回まで（qd に日付を書く）
            if (S.qs[id] === 2) { S.qs[id] = 3; S.st[q.s] += K.GAIN_REVIEW1; S.coins += K.COIN_REVIEW; out = { gain: K.GAIN_REVIEW1, c: K.COIN_REVIEW }; }
            else { S.qs[id] = 4; S.st[q.s] += K.GAIN_REVIEW2; S.coins += K.COIN_REVIEW2; out = { gain: K.GAIN_REVIEW2, c: K.COIN_REVIEW2, grad: true }; }
            S.qd[id] = today();
            okN++;
          } else { retry.push({ id, wait: 2 }); ngN++; }
          refreshType(); save();
        },
      });
      if (r.quit) { queue.unshift(id); break; }
      const c = $('#coin'); if (c) c.textContent = '🪙 ' + S.coins;
      if (r.ok) {
        $('#foe').classList.add('bye');
        floatAt(820, 180, `${q.s} +${out.gain}`, D.SUBJ_COLOR[q.s]);
        if (out.c) setTimeout(() => floatAt(860, 240, `🪙+${out.c}`, '#ffd54a'), T(300));
        msg(out.grad ? `🎓 卒業！ この問題は もう だいじょうぶ！ ${q.s} +${out.gain}` : `⭕ 正解！ ${q.s} +${out.gain}<br><span class="sm">あと1回 正解すると 卒業だよ（あした以降に また出るよ）</span>`);
      } else msg(`💨 にげられた… ${queue.length + retry.length > 1 ? 'ほかの問題のあとで、もう一度出るよ' : 'また あとで 挑戦しよう'}`);
      await wait(900);
      if (!left()) break;
      const go = await new Promise(res => {
        $('#subj').innerHTML = `<button class="btn-main" id="nx">つぎの問題へ</button><button class="btn-gray" id="hm">🏠 ホームへ</button>`;
        $('#nx').onclick = () => res(true); $('#hm').onclick = () => res(false);
      });
      $('#subj').innerHTML = '';
      if (!go) break;
    }
    if (!left() && retry.length === 0) msg('📕 いまできる復習は ぜんぶおわった！');
    await dialog({ who: '📕', text: `きょうの復習\n⭕ ${okN}問　❌ ${ngN}問${dueList().length ? `\nまだ ${dueList().length}問 まっているよ` : ''}` });
    await evolution(st0, type0);
    home();
  }

  // =====================================================================
  // 無限の塔（スタミナなし・ステータスは上がらない・正誤は記録しない）
  // =====================================================================
  function fmtTime(ms) {
    ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(c).padStart(2, '0')}`;
  }
  function towerOrder(subj) { if (dbg('allq')) return shuffle(QBY[subj].map(q => q.id)); return [4, 5, 6].flatMap(g => shuffle(QBY[subj].filter(q => q.g === g).map(q => q.id))); }
  // 入場券：教科ごとに 1日1回（くりこしなし）。前の日からの つづき は 前の日の入場券なので、
  // そのまま再開でき、ゲームオーバーになっても きょうの入場券で もう一度入れる
  const towerTicketFree = s => dbg('tower') || (S.towerTicket || {})[s] !== today();
  function towerState(s) {
    const t = S.tower[s];
    if (t && t.order && t.order.length) return { kind: 'cont', t };
    return towerTicketFree(s) ? { kind: 'new' } : { kind: 'used' };
  }
  async function towerSelect() {
    dayCheck();
    const left = towerLimit() - S.towerMs;
    if (left <= 0) { await dialog({ who: '🗼', text: `きょうは もう のぼれないよ（1日${K.TOWER_MS / 60000}分まで）\nまた あしたの朝5時から のぼれるよ` }); return home(); }
    const el = render(`<div class="scr center" style="gap:16px">
      <div class="big">🗼 無限の塔</div>
      <div class="mid">きょうの のこり時間 <span class="gold">${fmtTime(left)}</span></div>
      <div class="sm dim" style="text-align:center">1問＝1階。正解するたびに 🪙+${K.TOWER_COIN}。ハート3つ。3回まちがえたら おしまい（次は1階から）<br>どの塔も 1日1回 入れる（あしたに くりこせない）。とちゅうで やめても、つづきから 再開できるよ</div>
      <div class="row" id="ts">${SUBJ.map(s => {
        const st = towerState(s), top = QBY[s].length, t = st.t;
        const line = st.kind === 'cont' ? `<span class="sm gold">▶ つづきから ${t.floor + 1}階</span><span class="xs">${hearts(t.hearts, K.TOWER_HEARTS)}</span>`
          : st.kind === 'new' ? `<span class="sm">🎫 入場できる</span><span class="xs">1階から</span>` : `<span class="sm dim">きょうは 入場ずみ</span><span class="xs dim">また あした</span>`;
        return `<button data-s="${s}" ${st.kind === 'used' ? 'disabled' : ''} style="width:220px;height:170px;border-color:${D.SUBJ_COLOR[s]};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <span class="mid">${subjIc(s)} ${s}</span>${line}<span class="xs dim">さいこう ${S.towerBest[s] || 0}階<br>頂上 ${top}階</span></button>`;
      }).join('')}</div>
      <button class="btn-gray" id="bk">🏠 ホームへ</button></div>`, 'dun', 'tower');
    $('#bk', el).onclick = () => home();
    el.querySelectorAll('#ts button').forEach(b => (b.onclick = () => towerRun(b.dataset.s)));
  }
  async function towerRun(subj) {
    const st = towerState(subj);
    if (st.kind === 'used') return towerSelect();
    if (st.kind === 'new') { // きょうの入場券をつかう
      S.towerTicket = { ...(S.towerTicket || {}), [subj]: today() };
      S.tower[subj] = { order: towerOrder(subj), floor: 0, hearts: K.TOWER_HEARTS, day: today() }; save();
    }
    const tw = S.tower[subj], top = tw.order.length;
    const el = render(`
      <div class="prog"><span class="mid">🗼 ${subjIc(subj)} ${subj}の塔</span><span class="mid" style="margin-left:24px" id="hearts"></span>
        <span class="coin"><span class="gold" id="tcoin"></span>　⏱️ <b class="gold" id="timer"></b></span></div>
      <div class="field" style="flex-direction:column;justify-content:flex-start;padding-top:20px;gap:4px">
        <div style="font-size:120px;line-height:1">🗼</div><div class="big" id="floor"></div><div class="sm dim" id="best"></div>
      </div>`, 'dun', 'towerRun');
    let got = 0;
    const upd = () => {
      $('#hearts').innerHTML = hearts(tw.hearts, K.TOWER_HEARTS);
      $('#floor').textContent = `${tw.floor + 1}階`;
      $('#best').textContent = `さいこう ${S.towerBest[subj] || 0}階 ／ 頂上 ${top}階`;
      $('#tcoin').textContent = `🪙 ${S.coins}${got ? `（+${got}）` : ''}`;
    };
    upd();
    // 時計（塔にいる間だけ減る）
    let last = Date.now(), lastSave = Date.now(), timeUp = false;
    const ctl = {}, keep = {};
    const tick = setInterval(() => {
      const now = Date.now(); S.towerMs += now - last; last = now;
      const t = $('#timer'); if (t) t.textContent = fmtTime(towerLimit() - S.towerMs);
      if (now - lastSave > 3000) { lastSave = now; save(); }
      if (S.towerMs >= towerLimit() && !timeUp) { timeUp = true; if (ctl.cancel) ctl.cancel(); }
    }, 47);
    let endMsg = null;
    try {
      while (!timeUp) {
        if (tw.floor >= top) { endMsg = 'top'; break; }
        const q = Q[tw.order[tw.floor]];
        // 問題の窓は 閉じずに 次の問題を出す（テンポよく）
        const r = await ask(q, {
          head: `（${tw.floor + 1}階）`, extra: '⏸️ 中断する', ctl, keep,
          onAnswer: ok => {
            if (ok) { tw.floor++; S.coins += K.TOWER_COIN; got += K.TOWER_COIN; S.towerBest[subj] = Math.max(S.towerBest[subj] || 0, tw.floor); }
            else tw.hearts--;
            save(); upd();
          },
        });
        if (r.cancel) break;
        if (r.quit) { endMsg = 'quit'; break; }
        if (r.ok) floatAt(640, 120, `🪙+${K.TOWER_COIN}`, '#ffd54a');
        if (tw.hearts <= 0) { endMsg = 'over'; break; }
      }
    } finally { clearInterval(tick); if (keep.o) keep.o.remove(); save(); }
    if (timeUp) {
      await dialog({ who: '⏰', text: `きょうはここまで！${got ? `（🪙+${got}）` : ''}\nセーブしたから大丈夫。また明日つづきから登ろう` });
      return home();
    }
    if (endMsg === 'over') {
      const f = tw.floor; S.tower[subj] = null; save();
      const again = towerTicketFree(subj);
      await dialog({ who: '💔', text: `ざんねん！ ${f}階まで のぼった（🪙+${got}）\n（さいこう記録 ${S.towerBest[subj] || 0}階）\n${again ? 'きのうの つづきだったので、きょうの入場券で もう一度 1階から 入れるよ' : `${subj}の塔は また あした 1階から 挑戦しよう`}` });
      return towerSelect();
    }
    if (endMsg === 'top') {
      S.tower[subj] = null; save();
      await dialog({ who: '🏆', text: `${subj}の塔の 頂上に 到達！！ ${top}階（🪙+${got}）\nすごい！ ${subj}の問題を ぜんぶ 解いたよ！` });
      return towerSelect();
    }
    towerSelect();
  }

  // =====================================================================
  // 問題リスト（教科ごとに問題と解説を読める。まだの学年も見られる）
  // =====================================================================
  const QST = { 0: ['⬜', 'まだ'], 2: ['❌', '復習まち'], 3: ['🔁', 'あと1回'], 4: ['🎓', '卒業'] };
  function questionList(subj = '国語', grade = 4) {
    const qs = QBY[subj].filter(q => q.g === grade);
    const cnt = k => QBY[subj].filter(q => (S.qs[q.id] || 0) === k).length;
    const el = render(`
      <div class="prog"><span class="mid">📋 問題リスト</span><span class="coin"><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">🏠 ホームへ</button></span></div>
      <div style="position:absolute;top:70px;left:24px;right:24px" class="col">
        <div class="row">${SUBJ.map(s => `<button data-s="${s}" class="${s === subj ? 'btn-main' : ''}" style="font-size:20px;padding:8px 16px;border-color:${D.SUBJ_COLOR[s]}">${subjIc(s)} ${s}</button>`).join('')}
          <span style="width:24px"></span>${[4, 5, 6].map(g => `<button data-g="${g}" class="${g === grade ? 'btn-blue' : ''}" style="font-size:20px;padding:8px 16px">${g}年</button>`).join('')}</div>
        <div class="sm dim">${subj}：${[2, 3, 4].map(k => `${QST[k][0]}${QST[k][1]} ${cnt(k)}`).join('　')}　⬜まだ ${cnt(0)}</div>
        <div class="panel" id="ql" style="height:520px;overflow-y:auto;padding:8px">
          ${qs.map(q => { const v = S.qs[q.id] || 0; return `<div class="qrow" data-id="${q.id}">${QST[v][0]} <span class="xs dim">No.${q.id}</span> ${esc(q.t)}</div>`; }).join('')}
        </div></div>`, 'res', 'library');
    $('#bk', el).onclick = () => home();
    el.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => questionList(b.dataset.s, grade)));
    el.querySelectorAll('[data-g]').forEach(b => (b.onclick = () => questionList(subj, +b.dataset.g)));
    el.querySelectorAll('.qrow').forEach(r => (r.onclick = () => {
      const q = Q[r.dataset.id], v = S.qs[q.id] || 0;
      const o = overlay(`<div class="qbox qdetail"><div class="qh"><span>${subjIc(q.s)} ${q.s}・${q.g}年</span>　No.${q.id}　${QST[v][0]} ${QST[v][1]}</div>
        <div class="qt">${esc(q.t)}</div>
        <div class="opts">${q.a.map((t, i) => `<button disabled class="${i === 0 ? 'ok' : ''}" style="opacity:1">${i === 0 ? '⭕ ' : ''}${esc(t)}</button>`).join('')}</div>
        <div class="expl">${esc(q.x)}</div><div style="text-align:right;margin-top:10px"><button class="btn-blue">とじる</button></div></div>`);
      o.querySelector('.expl + div button').onclick = () => o.remove();
    }));
  }

  // =====================================================================
  // QRコード（全部入りのセーブ。対戦・引きつぎ・先生用ページで使う）
  // =====================================================================
  const QMAX = Math.max(...Object.keys(Q).map(Number));
  const qrBytes = () => window.SAVECODE.encode(S, QMAX);
  function drawQR(canvas, bytes, size = 520) {
    const qr = window.qrcode(0, 'L');
    qr.addData(String.fromCharCode(...bytes), 'Byte'); qr.make();
    const n = qr.getModuleCount(), q = 4, cell = Math.max(2, Math.floor(size / (n + q * 2)));
    canvas.width = canvas.height = (n + q * 2) * cell;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) c.fillRect((x + q) * cell, (y + q) * cell, cell, cell);
    return n;
  }
  function qrScreen() {
    const el = render(`<div class="scr center" style="gap:12px">
      <div class="mid">🔳 ${esc(S.pname)} の QRコード</div>
      <canvas id="qrc" style="background:#fff;border-radius:8px;width:520px;height:520px;image-rendering:pixelated"></canvas>
      <div class="sm">対戦のときは、このQRを 相手のカメラに 見せてね</div>
      <div class="xs dim">いまのステータス・アイテム・解いた問題が 入っているよ（あそぶたびに 変わるよ）</div>
      <button class="btn-gray" id="bk">🏠 ホームへ</button></div>`, 'res');
    drawQR($('#qrc', el), qrBytes());
    $('#bk', el).onclick = () => home();
  }
  // QRを読みこむ（カメラ。だめなら画像ファイルから）→ 中身をかえす（やめたら null）
  let scanHook = null;
  function scanQR(title, sub = '') {
    return new Promise(res => {
      const o = overlay(`<div class="panel center" style="width:900px;gap:10px">
        <div class="mid">${title}</div>${sub ? `<div class="sm dim">${sub}</div>` : ''}
        <video id="vd" playsinline muted style="width:560px;height:420px;background:#000;border-radius:10px;object-fit:cover"></video>
        <div class="sm gold" id="stt">カメラに QRコードを 見せてね</div>
        <div class="row"><label class="btn-blue" style="font-size:20px;padding:10px 16px;border-radius:12px;cursor:pointer">🖼️ 画像ファイルから読みこむ<input type="file" accept="image/*" id="fi" style="display:none"></label>
        <button class="btn-gray" id="cn">やめる</button></div></div>`);
      const vd = $('#vd', o), stt = $('#stt', o), cv = document.createElement('canvas');
      let stream = null, stop = false;
      const done = v => { if (stop) return; stop = true; scanHook = null; if (stream) stream.getTracks().forEach(t => t.stop()); o.remove(); res(v); };
      const tryBytes = bin => { try { done(window.SAVECODE.decode(bin)); return true; } catch (e) { stt.textContent = '⚠️ ' + e.message; return false; } };
      const scan = () => {
        const c = cv.getContext('2d', { willReadFrequently: true }), img = c.getImageData(0, 0, cv.width, cv.height);
        const r = window.jsQR(img.data, cv.width, cv.height);
        return r && r.binaryData ? tryBytes(r.binaryData) : false;
      };
      scanHook = tryBytes; // テスト用
      $('#cn', o).onclick = () => done(null);
      $('#fi', o).onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1600 / Math.max(img.width, img.height));
          cv.width = R0(img.width * k); cv.height = R0(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          if (!scan() && !stop) stt.textContent = '⚠️ QRコードが 見つからなかったよ';
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(f);
      };
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(st => {
          if (stop) { st.getTracks().forEach(t => t.stop()); return; }
          stream = st; vd.srcObject = st; vd.play();
          const loop = () => {
            if (stop) return;
            if (vd.readyState >= 2 && vd.videoWidth) { cv.width = vd.videoWidth; cv.height = vd.videoHeight; cv.getContext('2d').drawImage(vd, 0, 0); if (scan()) return; }
            setTimeout(loop, 150);
          };
          loop();
        }).catch(() => { stt.textContent = 'カメラが使えないよ。「画像ファイルから読みこむ」をつかってね'; });
      } else stt.textContent = 'カメラが使えないよ。「画像ファイルから読みこむ」をつかってね';
    });
  }

  // =====================================================================
  // 対戦モード（2人で1台。QR2枚を読みこむ。結果はセーブに残さない。途中から再開できる）
  // =====================================================================
  const VS_KEY = 'manabi_battle_vs';
  let VSV = null;
  function saveVs() { if (!VSV) return; if (BT && BT.vs) VSV.bt = packBT(); try { localStorage.setItem(VS_KEY, JSON.stringify(VSV)); } catch (e) { console.warn(e); } }
  function loadVs() {
    try {
      const v = JSON.parse(localStorage.getItem(VS_KEY) || 'null');
      if (!v || !v.phase) return null;
      if (Object.values(v.prof || {}).some(p => (p.qv || 1) !== window.SAVECODE.QV())) { localStorage.removeItem(VS_KEY); return null; } // 問題の番号が変わった古い対戦は消す
      return v;
    } catch (e) { return null; }
  }
  function clearVs() { VSV = null; BT = null; try { localStorage.removeItem(VS_KEY); } catch (e) { } }
  const AB = { a: 'A', b: 'B' };
  function vsCfg(pr, items) {
    const t = total(pr.st);
    return { name: pr.cname, pname: pr.pname, emo: lookOf(pr.type, t, pr), art: artPlayer(pr.type, t, pr), st: { ...pr.st }, items: [...items], prevType: pr.type, skills: skillsOf(t), title: pr.sel.title, aura: pr.sel.aura ? 'aura-' + D.AURAS[pr.sel.aura] : '', qs: pr.qs };
  }
  function tapScreen(text, sub = '') {
    return new Promise(res => {
      const el = render(`<div class="scr center" style="gap:20px;cursor:pointer"><div style="font-size:90px">👀</div><div class="big">${text}</div><div class="mid dim">${sub || '画面をタップしてね'}</div></div>`, 'btl');
      el.onclick = () => res();
    });
  }
  // =====================================================================
  // おためしバトル（CPU戦）：アイテムの組み合わせを ためす用
  // ・ほうびなし・回数制限なし・正誤は記録しない・とちゅうのセーブなし
  // ・ボスは育成ダンジョンと同じ。1ターン5問×3ターン。持っているアイテムだけ。時間制限なし
  // =====================================================================
  const TRIAL_BOSS = ['国語', '算数', '理科', '社会', '英語', '無'];
  let TR = null; // { boss, stg, items }
  // 倒したことのあるボス（デバッグの「ボス討伐 全開放」なら全部）
  const beaten = (b, g) => dbg('boss') || ((S.bossStg || {})[b] || 0) >= (1 << g); // 上の★を倒していれば 下の★もOK
  const anyBeaten = g => TRIAL_BOSS.some(b => beaten(b, g));
  async function trialMode() {
    if (![0, 1, 2].some(anyBeaten)) { await dialog({ who: '🧪', text: 'まだ ボスを倒していないよ。\n育成ダンジョンで ボスを倒すと、おためしバトルで 何回でも 戦えるようになるよ！' }); return; }
    if (!TR) { const g0 = stageOf(total(S.st)); TR = { boss: null, stg: anyBeaten(g0) ? g0 : [2, 1, 0].find(anyBeaten), items: S.owned.filter(n => S.fav.includes(n)).slice(0, 4) }; }
    if (!anyBeaten(TR.stg)) TR.stg = [2, 1, 0].find(anyBeaten);
    for (;;) {
      if (!TR.boss) { const b = await trialSelect(); if (!b) return home(); TR.boss = b; }
      if (!TR.picked) {
        const it = await pickItems(S, TR.items.filter(n => S.owned.includes(n)), { noTimer: true, back: '◀ ボスえらび' });
        if (!it) { TR.boss = null; continue; }
        TR.items = it; TR.picked = true;
      }
      const res = await trialBattle();
      const c = await dialog({ who: res === 'win' ? '🏆' : '💫', text: `${res === 'win' ? '🏆 勝った！' : '😢 負けちゃった……'}\n${esc(BT.P.name)} HP ${Math.max(0, R0(BT.P.hp))}／${BT.P.maxhp}　　${esc(BT.B.name)} HP ${Math.max(0, R0(BT.B.hp))}／${BT.B.maxhp}\n<span class="sm dim">（おためしバトルなので、ほうびはないよ）</span>`,
        choices: [{ label: '🔁 同じそうびで もう一度', val: 'again', cls: 'btn-main' }, { label: '🎒 そうびを かえる', val: 'items', cls: 'btn-blue' }, { label: '👑 ボスを かえる', val: 'boss', cls: 'btn-blue' }, { label: '🏠 ホームへ', val: 'home', cls: 'btn-gray' }] });
      BT = null;
      if (c === 'home') { TR.picked = false; return home(); }
      if (c === 'items') TR.picked = false;
      if (c === 'boss') { TR.boss = null; TR.picked = false; }
    }
  }
  function trialSelect() {
    return new Promise(res => {
      const draw = () => {
        const stg = TR.stg;
        const el = render(`<div class="scr center" style="gap:14px">
          <div class="big">🧪 おためしバトル</div>
          <div class="sm dim">倒したことのあるボスと 何回でも戦えるよ。ほうびはないよ（1ターン${K.VS_Q}問×3ターン）</div>
          <div class="row" id="sg">${[0, 1, 2].map(i => `<button data-g="${i}" class="${i === stg ? 'btn-main' : 'btn-gray'}" ${anyBeaten(i) ? '' : 'disabled'} style="font-size:20px;padding:8px 18px">ボスの強さ ${'★'.repeat(i + 1)}</button>`).join('')}</div>
          <div style="display:grid;grid-template-columns:repeat(3,360px);gap:12px" id="bs">${TRIAL_BOSS.map(b => {
            const bd = D.BOSSES[b];
            if (!beaten(b, stg)) return `<button disabled style="height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px"><span style="font-size:48px;line-height:1">❓</span><span class="mid">？？？</span><span class="xs dim">まだ倒していない</span></button>`;
            return `<button data-b="${b}" style="height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
              <span style="font-size:48px;line-height:1">${art(g2(A, 'boss', b, stg), bd.e[stg])}</span><span class="mid">${esc(bd.n[stg])}</span>
              <span class="xs dim">${bd.el}属性　持ち物 ${bd.items.slice(0, stg + 1).map(n => artItem(n)).join('')}</span></button>`;
          }).join('')}</div>
          <button class="btn-gray" id="bk">🏠 ホームへ</button></div>`, 'dun');
        el.querySelectorAll('#sg button').forEach(b => (b.onclick = () => { TR.stg = +b.dataset.g; draw(); }));
        el.querySelectorAll('#bs button[data-b]').forEach(b => (b.onclick = () => res(b.dataset.b)));
        $('#bk', el).onclick = () => res(null);
      };
      draw();
    });
  }
  async function trialBattle() {
    BT = hydrate({ trial: true, qn: K.VS_Q, cfg: bossCfg(TR.boss, TR.stg, TR.items), snap: null, turn: 1, firstId: null, acts: {}, used: [], phase: 'turn', result: null });
    BT.snap = dynAll();
    battleScreen();
    $('#turn').textContent = '🧪 おためしバトル';
    await bossIntro();
    blog(`<span class="sm dim">${weakText(TR.boss)}</span>`); await msgWait(1200);
    while (BT.phase === 'turn') await playTurn();
    if (BT.result === 'win') { const fb = $('#fB'); if (fb) fb.classList.add('bye'); await cutin(`🏆 ${esc(BT.B.name)}を たおした！`, 1500); }
    else { blog(`${esc(BT.P.name)}は たおれてしまった……`); await msgWait(1200); }
    return BT.result;
  }

  async function vsMode() {
    let V = loadVs();
    if (V) {
      const c = await dialog({ who: '🆚', text: 'とちゅうの対戦があるよ。どうする？', choices: [{ label: '▶ 続きから', val: 1, cls: 'btn-main' }, { label: '新しく はじめる', val: 0, cls: 'btn-gray' }] });
      if (!c) { clearVs(); V = null; }
    }
    VSV = V || { phase: 'scanA', prof: {}, picks: { a: [], b: [] }, last: null };
    saveVs();
    await vsRun();
  }
  async function vsRun() {
    for (;;) {
      const V = VSV;
      if (V.phase === 'scanA' || V.phase === 'scanB') {
        const w = V.phase === 'scanA' ? 'a' : 'b';
        render('<div class="scr center"><div style="font-size:120px">🆚</div></div>', 'btl');
        const pr = await scanQR(`🆚 プレイヤー${AB[w]}の QRコードを 読みこんでね`, '「QR」ボタンで 出したQRコードを、カメラに見せてね');
        if (!pr) { clearVs(); return home(); }
        V.prof[w] = pr; V.phase = w === 'a' ? 'scanB' : 'confirm'; saveVs(); continue;
      }
      if (V.phase === 'confirm') {
        const { a, b } = V.prof;
        const line = (k, p) => `プレイヤー${k}：${esc(p.pname)}（${esc(p.cname)}）ステータス合計 ${total(p.st)}`;
        const c = await dialog({ who: '🆚', text: `${line('A', a)}\n${line('B', b)}${a.pname === b.pname && a.cname === b.cname ? '\n<span class="red">⚠️ 同じQRを2回 読みこんだかも？</span>' : ''}`, choices: [{ label: 'はじめる！', val: 1, cls: 'btn-main' }, { label: 'QRを読みなおす', val: 0, cls: 'btn-gray' }] });
        V.phase = c ? 'pickA' : 'scanA'; saveVs(); continue;
      }
      if (V.phase === 'pickA' || V.phase === 'pickB') {
        const w = V.phase === 'pickA' ? 'a' : 'b', pr = V.prof[w];
        await tapScreen(`プレイヤー${AB[w]}（${esc(pr.pname)}）だけ<br>画面を見てください`, w === 'b' ? 'プレイヤーAは 見ないでね。画面をタップしてね' : '');
        const preset = V.picks[w].length ? V.picks[w] : V.last ? V.last[w] : [];
        V.picks[w] = await pickItems(pr, preset.filter(n => pr.owned.includes(n)));
        V.phase = w === 'a' ? 'pickB' : 'intro'; saveVs(); continue;
      }
      if (V.phase === 'intro') {
        await tapScreen('2人で 画面を見てください');
        V.bt = { vs: true, bgVs: pick(Object.keys(D.BOSSES)), cfg: { P: vsCfg(V.prof.a, V.picks.a), B: vsCfg(V.prof.b, V.picks.b) }, snap: null, turn: 1, firstId: null, acts: {}, used: [], phase: 'turn', result: null };
        BT = hydrate(V.bt); BT.snap = dynAll(); V.phase = 'battle'; saveVs();
        battleScreen(); $('#turn').textContent = '🆚 対戦';
        await vsIntro(); continue;
      }
      if (V.phase === 'battle') {
        if (!BT) BT = hydrate(V.bt);
        battleScreen();
        while (BT.phase === 'turn') await vsTurn();
        V.result = BT.result; V.phase = 'end'; saveVs(); continue;
      }
      if (V.phase === 'end') {
        if (!BT) BT = hydrate(V.bt);
        const { P, B } = BT, res = V.result;
        const msgT = res === 'draw' ? '🤝 引き分け！' : `🏆 プレイヤー${res === 'P' ? 'A' : 'B'}（${esc((res === 'P' ? P : B).pname)}）の 勝ち！`;
        const c = await dialog({ who: res === 'draw' ? '🤝' : (res === 'P' ? P : B).art, text: `${msgT}\n${esc(P.name)} HP ${Math.max(0, R0(P.hp))}／${P.maxhp}　　${esc(B.name)} HP ${Math.max(0, R0(B.hp))}／${B.maxhp}`, choices: [{ label: '🔁 再戦する', val: 1, cls: 'btn-main' }, { label: '🏠 タイトルにもどる', val: 0, cls: 'btn-gray' }] });
        if (!c) { clearVs(); return home(); }
        V.last = { a: V.picks.a, b: V.picks.b }; V.picks = { a: [], b: [] }; V.bt = null; V.result = null; BT = null; V.phase = 'pickA'; saveVs(); continue;
      }
      clearVs(); return home();
    }
  }
  // 持ちこみアイテムをえらぶ（もちものと同じ並び・4つまで・40秒）
  // noTimer：時間制限なし（おためしバトル）。back：「もどる」ボタン（おしたら null を返す）
  function pickItems(pr, preset, { noTimer = false, back = '' } = {}) {
    return new Promise(res => {
      let sel = [...preset].slice(0, 4), left = 40, done = false, tm = null;
      const finish = (v = sel) => { if (done) return; done = true; clearInterval(tm); app.querySelectorAll('.ov').forEach(x => x.remove()); res(v); };
      const draw = () => {
        const cell = n => { const own = pr.owned.includes(n); return `<div class="bk ${own ? '' : 'none'} ${sel.includes(n) ? 'sel' : ''}" data-n="${esc(n)}">${artItem(n)}</div>`; };
        const el = render(`
          <div class="prog"><span class="mid">🎒 ${esc(pr.pname)}の そうび <span class="gold">${sel.length} / 4</span></span>
            <span class="coin row">${noTimer ? '' : `<span class="mid">⏱️ <b class="gold" id="lt">${left}</b>秒</span>`}${back ? `<button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">${back}</button>` : ''}<button class="btn-gray" id="rs" style="font-size:18px;padding:6px 12px">そうびリセット</button><button class="btn-main" id="ok" style="font-size:20px;padding:6px 16px">けってい</button></span></div>
          <div class="row" style="position:absolute;top:66px;left:24px;font-size:30px;gap:10px">${sel.map(n => artItem(n)).join('') || '<span class="sm dim">アイテムをタップして「そうび」をおしてね（4つまで）</span>'}</div>
          <div class="panel" style="position:absolute;top:112px;left:24px;right:24px;bottom:16px;overflow-y:auto">
            <div class="sm" style="color:#f9a8d4">♡ おきにいり</div><div class="bkrow">${pr.fav.filter(n => pr.owned.includes(n)).map(cell).join('') || '<span class="xs dim">なし</span>'}</div>
            ${D.ITEM_GROUPS.map(g => `<div class="sm gold" style="margin-top:6px">${esc(g.n)}</div><div class="bkrow">${g.items.map(cell).join('')}</div>`).join('')}
          </div>`, 'res');
        $('#ok', el).onclick = () => finish();
        if (back) $('#bk', el).onclick = () => finish(null);
        $('#rs', el).onclick = () => { sel = []; draw(); };
        el.querySelectorAll('.bk').forEach(c => (c.onclick = () => {
          const n = c.dataset.n;
          if (!pr.owned.includes(n)) return;
          const on = sel.includes(n);
          const o = overlay(`<div class="panel center">${itemCard(n).replace(NEWB, '')}<div class="row">
            <button class="${on ? 'btn-gray' : 'btn-main'}" id="eq" ${!on && sel.length >= 4 ? 'disabled' : ''}>${on ? 'そうびを はずす' : 'そうびする'}</button><button class="btn-gray" id="cl">とじる</button></div></div>`);
          $('#cl', o).onclick = () => o.remove();
          $('#eq', o).onclick = () => { sel = on ? sel.filter(x => x !== n) : [...sel, n]; o.remove(); draw(); };
        }));
      };
      draw();
      if (!noTimer) tm = setInterval(() => { left--; const l = $('#lt'); if (l) l.textContent = left; if (left <= 0) finish(); }, T(1000));
    });
  }
  async function vsIntro() {
    const { P, B } = BT;
    const side = (f, k) => `<div class="col" style="width:520px"><div class="mid">プレイヤー${k}：${esc(f.pname)}</div>
      ${f.title ? `<div>${titleBadge(f.title, 'sm')}</div>` : ''}<div class="mid">${f.art} ${esc(f.name)} <span class="sm dim">${f.type}タイプ・HP ${f.maxhp}</span></div>
      ${[...f.items].map(n => `<div class="xs">${artItem(n)} <b>${esc(n)}</b>：${esc(D.ITEM[n].d)}</div>`).join('') || '<div class="xs dim">アイテムなし</div>'}</div>`;
    await dialog({ who: '🆚', text: '', body: `<div class="row" style="align-items:flex-start;gap:20px">${side(P, 'A')}${side(B, 'B')}</div>`, choices: [{ label: 'バトル スタート！', val: 1, cls: 'btn-main' }] });
  }
  async function vsTurn() {
    const { P, B } = BT, turn = BT.turn;
    hideGauges();
    $('#turn').textContent = `🆚 ターン ${turn} / 3`;
    await cutin(`ターン ${turn}`, 900, false);
    if (!BT.firstId) {
      const right = await roulette(P, B);
      const first = await dialog({ who: right.art, text: `${esc(right.pname)}さん（${esc(right.name)}）が 決める権利をとった！\n先攻（先に攻撃できる）と 後攻（相手のえらんだものを見てからえらべる）、どっちにする？`, choices: [{ label: `${artUi('first', '⚔️')} 先攻`, val: right, cls: 'btn-main' }, { label: `${artUi('second', '👀')} 後攻`, val: right.opp, cls: 'btn-blue' }] });
      BT.firstId = first.side; saveVs();
    }
    const first = BT.firstId === 'P' ? P : B, order = [first, first.opp];
    for (let i = 0; i < 2; i++) {
      const x = order[i], other = BT.acts[x.opp.side];
      if (BT.acts[x.side] === 'skip' || (!BT.acts[x.side] && x.skipNext)) {
        x.skipNext = false;
        if (BT.acts[x.side] !== 'skip') { BT.acts[x.side] = 'skip'; saveVs(); }
        blog(`${esc(x.name)}は パワーシュートの反動で動けない！`); await msgWait(1300); continue;
      }
      if (!BT.acts[x.side] || !BT.acts[x.side].ans) await cutin(`${esc(x.pname)}さん（${esc(x.name)}）の番！`, 1100);
      BT.note = `<div class="sm" style="margin-bottom:6px"><b>${esc(x.pname)}</b>さんの番${i === 1 && other && other !== 'skip' ? `　<span class="gold">👀 ${esc(x.opp.pname)}さんは「${other.sk}」・${other.subj} をえらんだ</span>` : ''}</div>`;
      await playerAct(x, x.opp, turn, i === 0, K.VS_Q);
    }
    hideGauges();
    const ev = resolveTurn(order, turn, false);
    let res = null;
    if (P.hp <= 0 || B.hp <= 0) {
      if (P.hp <= 0 && B.hp <= 0) { const rp = P.hp / P.maxhp, rb = B.hp / B.maxhp; res = rp === rb ? 'draw' : rp > rb ? 'P' : 'B'; }
      else res = B.hp <= 0 ? 'P' : 'B';
    } else if (turn >= 3) {
      const rp = P.hp / P.maxhp, rb = B.hp / B.maxhp; res = Math.abs(rp - rb) < 1e-9 ? 'draw' : rp > rb ? 'P' : 'B';
      ev.push({ t: `⏱️ 3ターンで決着がつかなかった！ のこりHPの割合で勝負… ${esc(P.name)} ${R0(rp * 100)}% ／ ${esc(B.name)} ${R0(rb * 100)}%`, snap: vsnap() });
    }
    BT.turn = turn + 1; BT.firstId = null; BT.acts = {}; BT.snap = dynAll();
    if (res) { BT.phase = 'end'; BT.result = res; }
    saveVs();
    await playEvents(ev);
    if (res && res !== 'draw') { const el = $(res === 'P' ? '#fB' : '#fP'); if (el) el.classList.add('bye'); await cutin(`🏆 ${esc((res === 'P' ? P : B).name)}の 勝ち！`, 1800); }
  }

  // =====================================================================
  // デバッグルーム（先生用。名前を決める画面から入る。セーブは作らない）
  // =====================================================================
  const TEACH_KEY = 'manabi_battle_teacher';
  function debugRoom() {
    const el = render(`<div class="scr center" style="gap:18px">
      <div class="big">🔧 デバッグルーム（先生用）</div>
      <button class="btn-main" id="tr" style="width:560px">📲 QR引きつぎ<br><span class="sm">このPCに セーブを移す</span></button>
      <button class="btn-blue" id="tp" style="width:560px">📊 先生用ページ<br><span class="sm">クラスの記録</span></button>
      <button class="btn-gray" id="bk">もどる（名前を決める画面へ）</button></div>`, 'btl');
    $('#tr', el).onclick = () => transferQR();
    $('#tp', el).onclick = () => teacherPage();
    $('#bk', el).onclick = () => { S = load(); if (S) (dbgOn() ? home() : titleScreen()); else nameScreen(); };
  }
  const summary = p => `${esc(p.pname)}（${esc(p.cname)}）\nステータス合計 ${total(p.st)}　解いた問題 ${Object.keys(p.qs).length}問　アイテム ${p.owned.length}個　コイン ${p.coins}`;
  async function transferQR() {
    const pr = await scanQR('📲 QR引きつぎ：子どもの QRコードを 読みこんでね', '故障したPCの子の「QR」画面を 読みこみます');
    if (!pr) return debugRoom();
    const had = load();
    const c1 = await dialog({ who: '📲', text: `このデータを このPCに 引きつぎますか？\n${summary(pr)}`, choices: [{ label: '引きつぐ', val: 1, cls: 'btn-main' }, { label: 'やめる', val: 0, cls: 'btn-gray' }] });
    if (!c1) return debugRoom();
    const c2 = await dialog({ who: '⚠️', text: had ? `このPCには すでに「${esc(had.pname)}」のセーブがあります。\n上書きして 消えてしまいますが、ほんとうに いいですか？` : 'もういちど確認します。ほんとうに 引きつぎますか？', choices: [{ label: 'はい、引きつぐ', val: 1, cls: 'btn-main' }, { label: 'やめる', val: 0, cls: 'btn-gray' }] });
    if (!c2) return debugRoom();
    S = migrate(pr); S.debug = null; R = null; BT = null; S.run = null; rawSave(); // 引きついだら デバッグモードは必ずオフ
    await dialog({ who: '✅', text: `引きつぎました！\n${esc(S.pname)} さんの データで はじめられます` });
    titleScreen();
  }
  // ---- 先生用ページ ----
  function teachLoad() {
    let l = []; try { l = JSON.parse(localStorage.getItem(TEACH_KEY) || '[]'); } catch (e) { return []; }
    const C = window.SAVECODE;
    return l.map(p => { const v = p.qv || 1; if (v < C.QV()) { p.qs = C.remapKeys(p.qs, v); p.miss = C.remapKeys(p.miss, v); p.qv = C.QV(); } return p; });
  }
  function teachSave(list) { try { localStorage.setItem(TEACH_KEY, JSON.stringify(list)); } catch (e) { tip('保存できませんでした'); } }
  function rateOf(p, subj) { // 一発で正解した割合（解いた問題のうち）
    const ids = Object.keys(p.qs).filter(id => Q[id] && (!subj || Q[id].s === subj));
    if (!ids.length) return null;
    return (ids.length - ids.filter(id => p.miss && p.miss[id]).length) / ids.length;
  }
  const pct = r => (r === null ? '—' : R0(r * 100) + '%');
  function weakSubj(p) {
    const c = SUBJ.map(s => [s, rateOf(p, s), Object.keys(p.qs).filter(id => Q[id] && Q[id].s === s).length]).filter(x => x[2] >= 5);
    if (!c.length) return '—';
    return c.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  }
  function ranking(list, n = 20) {
    const st = {};
    list.forEach(p => Object.keys(p.qs).forEach(id => { if (!Q[id]) return; const x = st[id] || (st[id] = { n: 0, m: 0 }); x.n++; if (p.miss && p.miss[id]) x.m++; }));
    return Object.entries(st).filter(([, x]) => x.m > 0).map(([id, x]) => ({ q: Q[id], n: x.n, m: x.m, r: 1 - x.m / x.n }))
      .sort((a, b) => a.r - b.r || b.n - a.n).slice(0, n);
  }
  function downloadCSV(name, rows) {
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function teacherPage() {
    const list = teachLoad();
    const rk = ranking(list);
    const el = render(`
      <div class="prog"><span class="mid">📊 先生用ページ　<span class="gold">${list.length}人</span></span>
        <span class="coin row"><button class="btn-main" id="add" style="font-size:18px;padding:6px 12px">＋ QRを読みこむ</button>
        <button class="btn-blue" id="c1" style="font-size:18px;padding:6px 12px">CSV（一覧）</button><button class="btn-blue" id="c2" style="font-size:18px;padding:6px 12px">CSV（ランキング）</button>
        <button class="btn-gray" id="clr" style="font-size:18px;padding:6px 12px">ぜんぶ消す</button><button class="btn-gray" id="bk" style="font-size:18px;padding:6px 12px">もどる</button></span></div>
      <div class="panel" style="position:absolute;top:66px;left:16px;right:16px;bottom:12px;overflow:auto;font-size:16px">
        <table class="tt"><tr><th>名前</th><th>解いた問題</th>${SUBJ.map(s => `<th>${s}</th>`).join('')}<th>ぜんぶ</th><th>苦手な教科</th><th>遊んだ日数</th><th>最後に遊んだ日</th><th></th></tr>
        ${list.map((p, i) => `<tr><td>${esc(p.pname)}<br><span class="xs dim">${esc(p.cname)}</span></td><td>${Object.keys(p.qs).length}</td>${SUBJ.map(s => `<td>${pct(rateOf(p, s))}</td>`).join('')}<td>${pct(rateOf(p))}</td><td>${weakSubj(p)}</td><td>${p.playDays}</td><td>${esc(p.day)}</td><td><button class="btn-gray del" data-i="${i}" style="font-size:14px;padding:2px 8px">消す</button></td></tr>`).join('') || `<tr><td colspan="${SUBJ.length + 7}" class="dim">「＋ QRを読みこむ」で 子どもの QRコードを 1人ずつ 読みこんでください</td></tr>`}
        </table>
        <div class="xs dim" style="margin:6px 0">正答率＝解いた問題のうち、育成ダンジョンで一発で正解した割合。苦手な教科＝5問以上解いた教科で、正答率がいちばん低い教科</div>
        <div class="mid gold" style="margin-top:10px">クラスで 正答率が低い問題（上位20）</div>
        <table class="tt"><tr><th>順位</th><th>No.</th><th>教科</th><th>学年</th><th>問題</th><th>正答率</th></tr>
        ${rk.map((x, i) => `<tr><td>${i + 1}</td><td>${x.q.id}</td><td>${x.q.s}</td><td>${x.q.g}年</td><td style="text-align:left">${esc(x.q.t)}</td><td>${pct(x.r)}（${x.n - x.m}/${x.n}人）</td></tr>`).join('') || '<tr><td colspan="6" class="dim">まだ ありません</td></tr>'}
        </table></div>`, 'res');
    $('#bk', el).onclick = () => debugRoom();
    $('#add', el).onclick = async () => {
      const l = teachLoad();
      for (;;) {
        const pr = await scanQR(`📊 ${l.length + 1}人目の QRコードを 読みこんでね`, '読みこむたびに 次の人へ。おわったら「やめる」');
        if (!pr) break;
        const k = l.findIndex(x => x.pname === pr.pname && x.cname === pr.cname);
        if (k >= 0) l[k] = pr; else l.push(pr);
        teachSave(l); tip(`${pr.pname} さんを 読みこんだよ（${l.length}人）`, 1500);
      }
      teacherPage();
    };
    el.querySelectorAll('.del').forEach(b => (b.onclick = () => { const l = teachLoad(); l.splice(+b.dataset.i, 1); teachSave(l); teacherPage(); }));
    $('#clr', el).onclick = async () => {
      const c = await dialog({ who: '⚠️', text: '読みこんだ記録を ぜんぶ消しますか？', choices: [{ label: '消す', val: 1, cls: 'btn-gray' }, { label: 'やめる', val: 0, cls: 'btn-main' }] });
      if (c) { teachSave([]); teacherPage(); }
    };
    $('#c1', el).onclick = () => downloadCSV('まなびバトル_一覧.csv', [
      ['名前', 'キャラ', '解いた問題数', ...SUBJ.map(s => s + '正答率'), 'ぜんぶの正答率', '苦手な教科', '遊んだ日数', '最後に遊んだ日', 'ステータス合計'],
      ...list.map(p => [p.pname, p.cname, Object.keys(p.qs).length, ...SUBJ.map(s => pct(rateOf(p, s))), pct(rateOf(p)), weakSubj(p), p.playDays, p.day, total(p.st)])]);
    $('#c2', el).onclick = () => downloadCSV('まなびバトル_正答率が低い問題.csv', [
      ['順位', '番号', '教科', '学年', '問題', '正解', '正答率', '正解した人数', '解いた人数'],
      ...ranking(list, 1e9).map((x, i) => [i + 1, x.q.id, x.q.s, x.q.g, x.q.t, x.q.a[0], pct(x.r), x.n - x.m, x.n])]);
  }

  // ---- テスト用の入口（Playwright などから使う）----
  // テスト・画面撮影用（?test のときだけ）
  const GO = /[?&]test/.test(location.search) ? { titleBadge, home, titleScreen, nameScreen, settings, achList, gacha, itemBook, questionList, qrScreen, towerSelect, trialMode, vsMode, debugRoom, teacherPage, reviewDungeon, pickItems, showItem } : null;
  window.MB = { go: GO, get S() { return S; }, get R() { return R; }, get BT() { return BT; }, get VS() { return VSV; }, Q, D, SAVE_KEY, qrBytes: () => Array.from(qrBytes()), simBoss, simHand, preloaded: () => KEEP.length, msgWait, updBars, scan: b => (scanHook ? scanHook(b) : false) };

  // ---- 絵文字を 画像に おきかえる（assets の emo。画面に出た 文字を 見はって 自動で。'' は 消す。表にない絵文字は そのまま）----
  const EMO_RE = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}](?:\uFE0F|\u200D[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?)*/gu;
  function emoFix(node) {
    const M = A.emo; if (!M || !node) return;
    const list = [];
    if (node.nodeType === 3) list.push(node);
    else if (node.nodeType === 1) { const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) list.push(t); }
    for (const tn of list) {
      const s = tn.nodeValue, p = tn.parentNode;
      if (!s || !p || /^(TEXTAREA|INPUT|SCRIPT|STYLE|OPTION)$/.test(p.nodeName)) continue;
      const frag = document.createDocumentFragment(); let last = 0, hit = false;
      for (const m of s.matchAll(EMO_RE)) {
        const e = m[0], k = e.replace(/\uFE0F/g, ''), v = M[k] !== undefined ? M[k] : M[e];
        if (v === undefined) continue;
        hit = true; frag.append(s.slice(last, m.index)); last = m.index + e.length;
        if (v) { const im = document.createElement('img'); im.className = 'emoi'; im.src = v; im.alt = ''; frag.append(im); }
        else if (/[ 　]/.test(s[last] || '')) last++; // 消したら うしろの空白も
      }
      if (!hit) continue;
      frag.append(s.slice(last)); p.replaceChild(frag, tn);
    }
  }
  if (A.emo) {
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') emoFix(m.target); else m.addedNodes.forEach(emoFix); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ---- 起動：画像を ぜんぶ先に読みこむ（とちゅうで 画像が あとから出てくる・絵文字がちらつく のをふせぐ）----
  // ASSETS にあるパスと、CSS の url(...) を ぜんぶ集める。アセットを ふやしても 自動で入る
  const KEEP = []; // 読みこんだ画像を にぎっておく（キャッシュから消えないように）
  function imagePaths() {
    const set = new Set();
    const walk = o => { if (typeof o === 'string') { if (/\.(png|jpe?g|gif|webp|svg)$/i.test(o)) set.add(o); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(A);
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      const base = sh.href || location.href;
      for (const r of rules || []) for (const m of (r.cssText || '').matchAll(/url\(["']?([^"')]+\.(?:png|jpe?g|gif|webp|svg))["']?\)/gi)) set.add(new URL(m[1], base).href);
    }
    return [...set];
  }
  async function preload() {
    const list = imagePaths();
    if (!list.length || window.FAST) return;
    app.innerHTML = '<div class="boot"><div class="boot-t">よみこみ中…</div><div class="boot-bar"><i></i></div></div>';
    const bar = app.querySelector('.boot-bar i');
    let done = 0;
    const one = src => new Promise(res => {
      const im = new Image(); KEEP.push(im);
      const fin = () => { done++; bar.style.width = (100 * done / list.length) + '%'; res(); };
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(fin); im.onerror = fin; im.src = src;
    });
    // 8秒たっても おわらなければ、そのまま はじめる（とちゅうの画像は あとから出る）
    await Promise.race([Promise.all(list.map(one)), new Promise(r => setTimeout(r, 8000))]);
  }
  preload().then(() => {
    S = load();
    if (S) titleScreen(); else nameScreen();
  });
})();
