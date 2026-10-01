// ===== まなびバトル 本体（①-1：ホーム → 育成ダンジョン → CPUボス戦 → リザルト）=====
(function () {
  'use strict';
  const D = window.DATA, K = D.K, SUBJ = D.SUBJ;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const T = ms => (window.FAST ? ms / 50 : ms);
  const wait = ms => new Promise(r => setTimeout(r, T(ms)));
  const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
  const shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R0 = n => Math.round(n);

  // ---- 画面の拡大縮小 ----
  function fit() { const s = Math.min(innerWidth / 1280, innerHeight / 720); $('#stage').style.transform = `translate(-50%,-50%) scale(${s})`; }
  addEventListener('resize', fit); fit();

  // ---- 乱数（ダンジョンは入ったときに種を決める）----
  function makeRng(seed) {
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.state = () => a; return f;
  }

  // ---- 問題 ----
  const Q = {}, QBY = {}; SUBJ.forEach(s => (QBY[s] = []));
  window.QUESTION_DB.forEach(r => { const q = { id: r[0], s: r[1], g: r[2], t: r[3], a: r[4], x: r[5] }; Q[q.id] = q; if (QBY[q.s]) QBY[q.s].push(q); });

  // ---- 状態 ----
  // qs[id]: 1=正解 2=まちがい(0.8待ち) 3=0.8ずみ(0.2待ち) 4=卒業
  let S = null;
  function today() { const d = new Date(Date.now() - 5 * 3600e3); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function newState(pname, cname) {
    const st = {}; SUBJ.forEach(s => (st[s] = K.START_STAT));
    return { v: 1, pname, cname, st, type: '全教科', coins: 0, stamina: K.STAMINA_START, day: today(), owned: [], qs: {}, takeHome: 0, lastBoss: null, dungeons: 0 };
  }
  function dayCheck() {
    const t = today(); if (S.day === t) return;
    const days = Math.max(1, Math.round((new Date(t) - new Date(S.day)) / 864e5) || 1);
    S.stamina += K.STAMINA_DAY * days; S.day = t; S.takeHome = 0; S.lastBoss = null;
  }

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
  const lookOf = (type, t) => D.LOOK[type][stageOf(t)];
  function refreshType() { S.type = typeOf(S.st, S.type); }

  // ---- 小さな部品 ----
  function render(html, cls) { app.innerHTML = `<div class="scr ${cls || ''} fadein">${html}</div>`; return app.firstElementChild; }
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
  async function cutin(text, ms = 1300) {
    const el = document.createElement('div'); el.className = 'cutin'; el.innerHTML = text; app.appendChild(el);
    await wait(ms); el.remove();
  }
  function itemCard(n, extra = '') {
    const it = D.ITEM[n]; const isNew = !S.owned.includes(n);
    return `<div class="itemcard"><div class="ie">${it.e}</div><div class="in r${it.r}">${'★'.repeat(it.r)} ${esc(n)}${isNew ? ' <span class="red">🆕</span>' : ''}</div><div class="id">${esc(it.d)}</div>${extra}</div>`;
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

  // ---- 4択（連打対策つき）----
  let fastRun = 0;
  function ask(q, { head = '', fighter = null } = {}) {
    return new Promise(res => {
      const opts = shuffle(q.a.map((t, i) => ({ t, ok: i === 0 })));
      const lock = Math.min(3000, Math.max(1000, 600 + q.t.length * 30));
      const o = overlay(`<div class="qbox">
        <div class="qh">${D.SUBJ_EMO[q.s]} ${q.s}・${q.g}年 ${head}</div>
        <div class="qt">${esc(q.t)}</div>
        <div class="lockbar"><i></i></div>
        <div class="opts">${opts.map((p, i) => `<button data-i="${i}" disabled>${esc(p.t)}</button>`).join('')}</div>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><span class="megane"></span></div>
        <div class="after"></div></div>`);
      const btns = [...o.querySelectorAll('.opts button')];
      const bar = o.querySelector('.lockbar i');
      bar.style.transition = `width ${T(lock)}ms linear`; requestAnimationFrame(() => (bar.style.width = '100%'));
      let openAt = 0;
      setTimeout(() => { btns.forEach(b => (b.disabled = false)); openAt = Date.now(); o.querySelector('.lockbar').style.visibility = 'hidden'; }, T(lock));
      // 👓 ひらめきメガネ
      if (fighter && fighter.has('ひらめきメガネ') && fighter.megane > 0) {
        const mb = document.createElement('button'); mb.className = 'btn-blue'; mb.style.fontSize = '18px';
        mb.textContent = `👓 2択にする（のこり${fighter.megane}回）`;
        mb.onclick = () => { fighter.megane--; mb.remove(); let k = 0; btns.forEach((b, i) => { if (!opts[i].ok && k < 2) { b.style.visibility = 'hidden'; k++; } }); };
        o.querySelector('.megane').appendChild(mb);
      }
      btns.forEach((b, i) => (b.onclick = async () => {
        const dt = Date.now() - openAt;
        btns.forEach(x => (x.disabled = true)); o.querySelector('.megane').innerHTML = '';
        const ok = opts[i].ok;
        btns.forEach((x, j) => { if (opts[j].ok) x.classList.add('ok'); });
        if (!ok) b.classList.add('ng');
        fastRun = dt < 900 ? fastRun + 1 : 0;
        const after = o.querySelector('.after');
        if (ok) {
          after.innerHTML = `<div class="mid green" style="text-align:center;margin-top:10px">⭕ せいかい！</div>`;
          await wait(900);
        } else {
          after.innerHTML = `<div class="expl">❌ ざんねん… 答えは「${esc(q.a[0])}」<br>${esc(q.x)}</div>
            <div style="text-align:right;margin-top:10px"><button class="btn-blue" disabled>わかった</button></div>`;
          const nb = after.querySelector('button');
          await wait(2500); nb.disabled = false;
          await new Promise(r => (nb.onclick = r));
        }
        if (fastRun >= 3) {
          fastRun = 0;
          after.innerHTML = `<div class="expl" style="text-align:center">🐢 はやすぎるよ！ 問題をよく読もうね</div>`;
          await wait(3000);
        }
        o.remove(); res({ ok });
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
      if (fresh.length) {
        const gmin = Math.min(...fresh.map(q => q.g));
        let pool = fresh.filter(q => q.g === gmin);
        const upper = fresh.filter(q => q.g > gmin);
        if (upper.length && rnd() < mix) pool = upper.filter(q => q.g === Math.min(...upper.map(q => q.g)));
        q = pick(pool, rnd);
      } else {
        let pool = QBY[subj].filter(q => (S.qs[q.id] === 1 || S.qs[q.id] === 4) && !taken.has(q.id));
        if (!pool.length) pool = QBY[subj].filter(q => !taken.has(q.id));
        q = pick(pool, rnd); osarai = true;
      }
      taken.add(q.id); out.push({ id: q.id, osarai });
    }
    return out;
  }
  // 解いたことのある問題（ボス戦・イベント）。足りなければ新しい問題で補う（記録はしない）
  function drawSolvedQ(subj, used) {
    const subjs = subj ? [subj] : SUBJ;
    let all = subjs.flatMap(s => QBY[s]).filter(q => !used.has(q.id));
    if (!all.length) { used.clear(); all = subjs.flatMap(s => QBY[s]); }
    let pool = all.filter(q => S.qs[q.id]);
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
    let pool = D.ITEMS.filter(it => reqOK(it, hand) && !hand.includes(it.n) && !exclude.includes(it.n) && (!unowned || !S.owned.includes(it.n)));
    if (!pool.length) return null;
    const r = rarity || rollRarity(rnd, luck, minR);
    let p = pool.filter(it => it.r === r);
    if (cat && rnd() < 0.7) { const c = p.filter(it => it.cat === cat); if (c.length) p = c; }
    if (!p.length) { p = pool.filter(it => it.r >= minR); if (cat) { const c = p.filter(it => it.cat === cat); if (c.length && rnd() < 0.7) p = c; } }
    if (!p.length) p = pool;
    return pick(p, rnd).n;
  }

  // =====================================================================
  // 名前を決める
  // =====================================================================
  function nameScreen() {
    const el = render(`<div class="scr center" style="background:linear-gradient(160deg,#4c1d95,#1e3a8a)">
      <div style="font-size:64px">⚔️ まなびバトル</div>
      <div class="mid">ようこそ、まなび学園バトル部へ！</div>
      <div class="panel col" style="gap:16px;padding:28px">
        <label class="mid">プレイヤーネーム（8文字まで）<br><input id="pn" maxlength="8" placeholder="きみの名前"></label>
        <label class="mid">モンスターの名前（8文字まで）<br><input id="cn" maxlength="8" placeholder="モンスターの名前"></label>
        <button class="btn-main" id="go">けってい</button>
        <div class="sm red" id="err"></div>
      </div></div>`);
    $('#go', el).onclick = () => {
      const pn = $('#pn', el).value.trim(), cn = $('#cn', el).value.trim();
      if (!pn || !cn) { $('#err', el).textContent = '名前を2つとも入れてね'; return; }
      // デバッグルームの入口は ⑥ で作る
      S = newState(pn, cn);
      if (/[?&]test/.test(location.search)) { S.stamina = 9999; S.coins = 5000; }
      home();
    };
  }

  // =====================================================================
  // ホーム（部室）
  // =====================================================================
  const LINES = ['きょうも いっしょに がんばろう！', 'いろんな教科を解くと、運が上がるよ', 'まちがえた問題は、復習ダンジョンで取りもどせるよ', 'ボスの弱点をつくと、大ダメージ！', 'バトル部、さいこう！'];
  function home() {
    dayCheck(); refreshType();
    const t = total(S.st), luck = luckOf(S.st), sk = skillsOf(t);
    const review = Object.values(S.qs).filter(v => v === 2).length;
    const el = render(`
      <div class="topbar"><span>👤 ${esc(S.pname)}</span><span class="sp"></span>
        <span>⚡ スタミナ ${S.stamina}</span><span class="gold">🪙 ${S.coins}</span><button class="btn-gray" id="set" style="font-size:18px;padding:6px 12px">⚙️ せってい</button></div>
      <div class="chara col">
        <div class="emo" id="me">${lookOf(S.type, t)}</div>
        <div class="say" id="say"></div>
        <div style="text-align:center" class="mid">${esc(S.cname)} <span class="sm dim">（${S.type}タイプ）</span></div>
        <div class="panel stats">
          ${SUBJ.map(s => `<div>${D.SUBJ_EMO[s]} ${s} <b>${S.st[s]}</b></div>`).join('')}
          <div>🍀 運 <b>${luck}</b></div>
          <div class="dim" style="grid-column:span 3">ごうけい ${t}　HP ${R0(t * K.HPK)}　スキル ${sk.length}/8</div>
        </div>
      </div>
      <div class="menuR">
        <button class="wide" id="dun">⚔️ 育成ダンジョン<small>スタミナ ${K.DUNGEON_COST} をつかう</small></button>
        <button id="rev">📕 復習ダンジョン<small>まっている問題 ${review}問</small></button>
        <button id="tow">🗼 無限の塔<small>きょうの のこり 30:00</small></button>
        <button id="vs" style="grid-column:span 2">🆚 対戦モード<small>2人で1台</small></button>
      </div>
      <div class="menuB">
        <button id="b1">🎰 ガチャ</button><button id="b2">🎒 もちもの</button><button id="b3">📋 問題リスト</button><button id="b4">🔳 QR</button><button id="b5">🏆 アチーブメント</button>
      </div>`, 'home');
    $('#me', el).onclick = () => { $('#say', el).textContent = '「' + pick(LINES) + '」'; };
    $('#dun', el).onclick = () => startDungeon();
    ['set', 'rev', 'tow', 'vs', 'b1', 'b2', 'b3', 'b4', 'b5'].forEach(id => ($('#' + id, el).onclick = () => tip('この画面は、これから作るよ（じゅんびちゅう）', 2000)));
    if (S.dungeons === 0) tip('まずは「育成ダンジョン」に行ってみよう！');
  }

  // =====================================================================
  // 育成ダンジョン
  // =====================================================================
  const EVENTS = ['shop', 'coin', 'izumi', 'uranai', 'hayate', 'kurogane', 'sekihi', 'mimic', 'obake', 'omikuji', 'valz', 'mirror'];
  let R = null; // いまのダンジョン

  async function startDungeon() {
    if (S.stamina < K.DUNGEON_COST) { tip('スタミナが足りないよ。あしたの朝5時に100回復するよ'); return; }
    const go = await dialog({ who: '⚔️', text: `スタミナを ${K.DUNGEON_COST} つかって 育成ダンジョンに入る？\n（いまのスタミナ ${S.stamina}）`, choices: [{ label: '入る！', val: true, cls: 'btn-main' }, { label: 'やめる', val: false, cls: 'btn-gray' }] });
    if (!go) return;
    S.stamina -= K.DUNGEON_COST;
    const seed = (Math.random() * 2 ** 32) >>> 0, rnd = makeRng(seed);
    // ボスの属性（同じ日に2回連続では出ない）
    const boss = pick(['国語', '算数', '理科', '社会', '英語', '無'].filter(b => b !== S.lastBoss), rnd);
    S.lastBoss = boss;
    // 道のり
    const ev = shuffle(EVENTS, rnd);
    const forks = shuffle(['coin', 'item', 'event'], rnd).slice(0, 2);
    const plan = ['z', 'z', 'z', 'e1', 'z', 'z', 'f', 'z', 'z', 'z', 'e2', 'z', 'z', 't', 'b'];
    const zako = plan.filter(p => p === 'z').map(() => { const k = Math.floor(rnd() * D.ZAKO.length); return { k, e: pick(D.ZAKO[k].e, rnd), rare: rnd() < K.RARE_RATE * luckOf(S.st) / 1000 * 1.2, drop: rnd() < K.DROP_RATE }; });
    const qpre = {}; SUBJ.forEach(s => (qpre[s] = drawNewQs(s, 10, rnd)));
    R = {
      seed, rnd, boss, plan, i: 0, zi: 0, zako, ev1: ev[0], ev2: ev[1], ev2on: rnd() < 0.5, forks,
      qpre, qptr: Object.fromEntries(SUBJ.map(s => [s, 0])), hand: [], coins: 0,
      startSt: { ...S.st }, startType: S.type, flags: {}, usedQ: new Set(), log: [],
    };
    await bossPreview();
    runDungeon();
  }

  function weakText(b) {
    if (b === '英語') return 'このボスには、弱点も、効きづらい教科もないようだ。';
    if (b === '無') return 'このボスには、弱点も、効きづらい教科もないようだ。';
    const w = D.WEAK[b], r = D.RESIST[b];
    return `このステージのボスは ${D.ELEM[b]}（${b}）属性。${D.ELEM[w]}（${w}）が有効で、${D.ELEM[r]}（${r}）は効きづらいようだ。`;
  }
  async function bossPreview() {
    render(`<div class="scr center dun"><div style="font-size:120px">🕳️</div></div>`, 'dun');
    await dialog({ who: '🌫️', text: `${D.BOSSES[R.boss].hint}\n<span class="sm">${weakText(R.boss)}</span>`, choices: [{ label: '進む', val: 1, cls: 'btn-main' }] });
  }

  const NODE_ICON = { z: '🟢', e1: '❓', e2: '❓', f: '🔀', t: '🎁', b: '👑' };
  function dunScreen() {
    const t = total(S.st);
    const el = render(`
      <div class="prog">${R.plan.map((p, i) => `<span class="n ${i < R.i ? 'done' : ''} ${i === R.i ? 'cur' : ''}">${NODE_ICON[p]}</span>`).join('')}
        <span class="coin gold">🪙 ${S.coins}</span></div>
      <div class="field">
        <div><div class="me" id="me">${lookOf(S.type, t)}</div><div class="lbl">${esc(S.cname)}</div></div>
        <div><div class="foe" id="foe"></div><div class="lbl" id="foelbl"></div></div>
      </div>
      <div class="msg panel" id="msg"></div>
      <div class="hand" id="hand"></div>
      <div class="subjbar" id="subj"></div>`, 'dun');
    drawHand(); return el;
  }
  function drawHand() {
    const h = $('#hand'); if (!h) return;
    h.innerHTML = '<div class="sm dim" style="align-self:center">もちもの</div>' + [0, 1, 2, 3].map(i => {
      const n = R.hand[i]; if (!n) return '<div class="slot"></div>';
      return `<div class="slot" data-n="${esc(n)}">${D.ITEM[n].e}${S.owned.includes(n) ? '' : '<span class="new">NEW</span>'}</div>`;
    }).join('');
    h.querySelectorAll('.slot[data-n]').forEach(s => (s.onclick = () => showItem(s.dataset.n)));
  }
  const msg = h => { const m = $('#msg'); if (m) m.innerHTML = h; };
  const firstRun = () => S.dungeons === 0;

  async function runDungeon() {
    while (R.i < R.plan.length) {
      const p = R.plan[R.i];
      dunScreen();
      if (p === 'z') await zakoNode();
      else if (p === 'e1') await eventNode(R.ev1);
      else if (p === 'e2') { if (R.ev2on || R.flags.forkEvent) await eventNode(R.ev2); }
      else if (p === 'f') await forkNode();
      else if (p === 't') await treasureNode();
      else if (p === 'b') { await bossNode(); return; }
      R.i++;
    }
  }

  // 雑魚
  async function zakoNode() {
    const z = R.zako[R.zi++];
    let rare = z.rare;
    if (R.flags.nextRare) { rare = true; R.flags.nextRare = false; }
    if (R.flags.rareIn && R.flags.rareIn.includes(R.zi)) rare = true;
    const drop = z.drop || (R.flags.dropIn && R.flags.dropIn.includes(R.zi));
    const foe = rare ? D.RARE_ZAKO : D.ZAKO[z.k];
    const emo = rare ? pick(D.RARE_ZAKO.e, R.rnd) : z.e;
    $('#foe').textContent = emo; $('#foelbl').innerHTML = rare ? '<span class="gold">✨ 金色のレア雑魚！</span>' : esc(foe.n);
    msg(`${rare ? '✨ <span class="gold">金色のレア雑魚</span>' : esc(foe.n)}があらわれた！ <span class="gold">教科をえらんで問題に答えよう</span>`);
    if (firstRun() && R.zi === 1) tip('教科をえらぶと問題が出るよ。正解すると、その教科のステータスが上がる！');
    const subj = await new Promise(res => {
      $('#subj').innerHTML = SUBJ.map(s => `<button data-s="${s}" style="border-color:${D.SUBJ_COLOR[s]}">${D.SUBJ_EMO[s]} ${s}<small>${S.st[s]}</small></button>`).join('');
      $('#subj').querySelectorAll('button').forEach(b => (b.onclick = () => res(b.dataset.s)));
    });
    $('#subj').innerHTML = '';
    const pre = R.qpre[subj][R.qptr[subj]++] || drawNewQs(subj, 1, R.rnd)[0];
    const q = Q[pre.id];
    const { ok } = await ask(q, { head: pre.osarai ? '（おさらい）' : '' });
    const foeEl = $('#foe');
    if (ok) {
      const gain = pre.osarai ? K.GAIN_OSARAI : K.GAIN;
      S.st[subj] += gain;
      if (!pre.osarai) S.qs[q.id] = 1;
      const c = K.COIN_OK + (rare ? K.COIN_RARE : 0);
      S.coins += c; R.coins += c;
      foeEl.classList.add('bye');
      floatAt(820, 180, `${subj} +${gain}`, D.SUBJ_COLOR[subj]);
      setTimeout(() => floatAt(860, 240, `🪙+${c}`, '#ffd54a'), T(300));
      msg(`⭕ たおした！ ${subj}が <b>${gain}</b> 上がった！`);
      await wait(1100);
      if (drop) {
        const n = drawItem(R.rnd, { cat: rare ? null : foe.cat, hand: R.hand });
        if (n) await pickUp(n, `${emo} がアイテムを落とした！`);
      }
    } else {
      if (!pre.osarai) S.qs[q.id] = 2;
      S.coins += K.COIN_NG; R.coins += K.COIN_NG;
      foeEl.style.transition = 'transform .6s,opacity .6s'; foeEl.style.transform = 'translateX(300px)'; foeEl.style.opacity = 0;
      floatAt(860, 240, `🪙+${K.COIN_NG}`, '#ffd54a');
      msg(pre.osarai ? '💨 にげられた…' : '💨 にげられた… この問題は <b>復習ダンジョン</b> に入ったよ');
      if (firstRun() && !R.flags.tipWrong) { R.flags.tipWrong = 1; tip('まちがえた問題は、復習ダンジョンで正解すれば取りもどせるよ'); }
      await wait(1400);
    }
    refreshType();
  }

  // アイテムを拾う（5個目なら1つ捨てる）
  async function pickUp(n, text = '') {
    if (R.hand.length < K.ITEM_MAX) {
      await chooseItem(`${text}\n${D.ITEM[n].e} ${n} を拾った！`, [n], { labels: ['拾う'] });
      R.hand.push(n); drawHand();
      if (firstRun() && !R.flags.tipItem) { R.flags.tipItem = 1; tip('拾ったアイテムは、この回のボス戦で効くよ。持てるのは4個まで'); }
      return;
    }
    const all = [...R.hand, n];
    const out = await chooseItem(`${text}\n${D.ITEM[n].e} ${n} を見つけた！ 持てるのは4個まで。\n<span class="gold">どれを すてる？</span>`, all, { labels: all.map(() => 'すてる') });
    R.hand = all.filter(x => x !== out); drawHand();
  }

  // 分かれ道
  async function forkNode() {
    $('#foe').textContent = '🔀'; $('#foelbl').textContent = '分かれ道';
    const L = { coin: '🪙 コインが多そうな道', item: '🎁 アイテムがありそうな道', event: '❓ イベントがありそうな道' };
    const c = await dialog({ who: '🔀', text: '道が2つに分かれている……\nどっちに進む？', choices: R.forks.map(f => ({ label: L[f], val: f })) });
    const base = R.zi; // 次の雑魚3体は zi = base+1..base+3
    if (c === 'coin') R.flags.rareIn = [base + 1 + Math.floor(R.rnd() * 3)];
    if (c === 'item') R.flags.dropIn = shuffle([base + 1, base + 2, base + 3], R.rnd).slice(0, 2);
    if (c === 'event') R.flags.forkEvent = true;
  }

  // ボス前の宝箱（3つとも未取得）
  async function treasureNode() {
    $('#foe').textContent = '🎁'; $('#foelbl').textContent = 'ボス前の宝箱';
    const names = [];
    for (let k = 0; k < 3; k++) { const n = drawItem(R.rnd, { unowned: true, hand: R.hand, exclude: names }); if (n) names.push(n); }
    if (!names.length) { await dialog({ who: '🎁', text: '宝箱はからっぽだった……\n（もうぜんぶ持っているみたい！）' }); return; }
    if (firstRun()) tip('🆕 はまだ持っていないアイテム。リザルトで1個持ち帰れるよ');
    const n = await chooseItem('🎁 宝箱が3つある！ 1つえらんで開けよう', names, { labels: names.map(() => '開ける') });
    await pickUp(n, '');
  }

  // ---- イベント ----
  async function eventQuiz(k, head) {
    let okAll = true;
    for (let i = 0; i < k; i++) {
      const q = drawSolvedQ(null, R.usedQ);
      const { ok } = await ask(q, { head: head + (k > 1 ? `（${i + 1}/${k}）` : '') });
      if (!ok) { okAll = false; break; }
    }
    return okAll;
  }
  async function eventNode(id) {
    const luck = luckOf(S.st);
    const set = (e, n) => { $('#foe').textContent = e; $('#foelbl').textContent = n; };
    const coin = c => { S.coins += c; R.coins += c; floatAt(860, 240, `🪙+${c}`, '#ffd54a'); };
    if (firstRun() && !R.flags.tipEv) { R.flags.tipEv = 1; tip('イベントでは、いいことが起きたり、問題で挑戦できたりするよ'); }
    switch (id) {
      case 'shop': {
        set('🛒', '商人ルリ');
        const names = [], price = [0, 50, 100, 200];
        for (let r = 1; r <= 4; r++) {
          const n = drawItem(R.rnd, { unowned: true, rarity: r, hand: R.hand, exclude: names }) || drawItem(R.rnd, { rarity: r, hand: R.hand, exclude: names });
          names.push(n);
        }
        const list = names.map((n, i) => [n, price[i]]).filter(x => x[0]);
        const n = await chooseItem(`🛒 ルリ「いらっしゃい！ 1つだけ買えるよ」\n（もっているコイン 🪙${S.coins}）`, list.map(x => x[0]),
          { who: '👧', labels: list.map(x => (S.coins >= x[1] ? (x[1] ? `🪙${x[1]}で買う` : 'タダでもらう') : null)), skip: '買わない' });
        if (n) { const p = list.find(x => x[0] === n)[1]; S.coins -= p; await pickUp(n, ''); }
        break;
      }
      case 'coin': {
        set('💰', 'こぼれたコイン');
        const c = Math.round((100 + 200 * Math.min(1, R.rnd() * 0.6 + luck / 1000 * 0.5)) / 10) * 10;
        await dialog({ who: '🍃', name: 'ミドリ', text: `「あっ、コインがこぼれちゃった！ 拾うの手伝ってくれたお礼に、あげる！」\n🪙 ${c} コイン手に入れた！` });
        coin(c); break;
      }
      case 'izumi': {
        set('⛲', 'いやしの泉');
        await dialog({ who: '💧', name: 'カズマ', text: '「この泉の水を飲むといい。体がじょうぶになるぞ」\nこのダンジョンのボス戦で、最大HPが +15%！' });
        R.flags.izumi = true; break;
      }
      case 'uranai': {
        set('🔮', 'なぞの占い師');
        await dialog({ who: '⚡', name: 'ライト', text: '「……見えるぞ。次に出会うのは、金色にかがやくモンスターだ」\n次の雑魚が、かならずレア雑魚になる！' });
        R.flags.nextRare = true; break;
      }
      case 'hayate': {
        set('🏃', 'スカウトのハヤテ');
        await dialog({ who: '🏃', name: 'ハヤテ', text: '「ボスのくせを知ってるぜ。こっそり教えてやるよ」\nこのダンジョンのボス戦では、ルーレットなしで毎ターン先攻・後攻をえらべる！' });
        R.flags.hayate = true; break;
      }
      case 'kurogane': {
        set('🗡️', '師匠クロガネ');
        const go = await dialog({ who: '🗡️', name: 'クロガネ', text: '「修行をつけてやろう。3問つづけて正解できたら、ボス戦の威力が +20% だ」', choices: [{ label: '挑戦する', val: 1, cls: 'btn-main' }, { label: 'やめておく', val: 0, cls: 'btn-gray' }] });
        if (!go) break;
        const ok = await eventQuiz(3, '修行');
        if (ok) R.flags.kurogane = true;
        await dialog({ who: '🗡️', name: 'クロガネ', text: ok ? '「みごとだ！ その力、ボスにぶつけてこい」\nボス戦の威力 +20%！' : '「まだまだだな。またいつでも来い」' });
        break;
      }
      case 'sekihi': {
        set('🗿', '古い石碑');
        await dialog({ who: '🔥', name: 'コトハ', text: '「石碑に問題が書いてあるわ。解けたら、なにか起きるかも」' });
        const ok = await eventQuiz(1, '石碑');
        if (ok) { coin(200); R.flags.sekihi = true; }
        await dialog({ who: '🗿', text: ok ? '石碑が光った！\n🪙200コイン手に入れた！ ボスの弱点が さらに効くようになった（+10%）' : '石碑は しずかなままだ……' });
        break;
      }
      case 'mimic': {
        set('📦', 'あやしい宝箱');
        await dialog({ who: '📦', text: '宝箱だ！……と思ったら、ミミックだった！\n問題に正解すれば、たおしてアイテムを拾えるぞ！' });
        const ok = await eventQuiz(1, 'ミミック');
        if (ok) { $('#foe').classList.add('bye'); const n = drawItem(R.rnd, { hand: R.hand }); if (n) await pickUp(n, 'ミミックをたおした！'); }
        else await dialog({ who: '📦', text: 'ミミックは どこかへ にげていった……' });
        break;
      }
      case 'obake': {
        set('👻', 'いたずらおばけ');
        await dialog({ who: '👻', text: '「ケケケ、アイテムを1つ もらっちゃうぞ〜」\n問題に正解すれば、追いはらえる！' });
        const ok = await eventQuiz(1, 'おばけ');
        if (ok) { $('#foe').classList.add('bye'); await dialog({ who: '✨', text: 'おばけを追いはらった！' }); }
        else {
          const can = R.hand.filter(n => S.owned.includes(n)); // 🆕 は取られない
          if (can.length) { const n = pick(can, R.rnd); R.hand = R.hand.filter(x => x !== n); drawHand(); await dialog({ who: '👻', text: `${D.ITEM[n].e} ${n} を取られてしまった……` }); }
          else await dialog({ who: '👻', text: '「ちぇっ、取れるものがないや」\nおばけは帰っていった' });
        }
        break;
      }
      case 'omikuji': {
        set('⛩️', 'おみくじ');
        const go = await dialog({ who: '⛩️', name: 'ミコト', text: `「おみくじ、引いていきませんか？ 1回 50コインです」\n（もっているコイン 🪙${S.coins}）`, choices: [{ label: '🪙50で引く', val: 1, cls: 'btn-main', disabled: S.coins < 50 }, { label: '引かない', val: 0, cls: 'btn-gray' }] });
        if (!go) break;
        S.coins -= 50;
        const l = luck / 1000, r = R.rnd();
        const kuji = r < 0.15 + 0.2 * l ? '大吉' : r < 0.55 + 0.1 * l ? '吉' : r < 0.92 ? '凶' : '大凶';
        let t = `「${kuji}」！\n`;
        if (kuji === '大吉') { coin(200); t += '🪙200コイン手に入れた！'; }
        else if (kuji === '吉') { coin(100); t += '🪙100コイン手に入れた！'; }
        else if (kuji === '凶') t += 'なにも起きなかった……';
        else {
          const can = R.hand.filter(n => S.owned.includes(n));
          if (can.length) { const n = pick(can, R.rnd); R.hand = R.hand.filter(x => x !== n); drawHand(); t += `${D.ITEM[n].e} ${n} がこわれてしまった……`; }
          else t += 'でも、こわれるアイテムがなかった。セーフ！';
        }
        await dialog({ who: '⛩️', name: 'ミコト', text: t }); break;
      }
      case 'valz': {
        set('😈', '悪魔公ヴァルツ');
        const go = await dialog({ who: '😈', name: 'ヴァルツ', text: '「今のアイテムを全部わたせば、★4以上を2つくれてやろう…」\n（わたしたアイテムは、この回は使えなくなる）', choices: [{ label: '取引する', val: 1, cls: 'btn-main', disabled: !R.hand.length }, { label: 'ことわる', val: 0, cls: 'btn-gray' }] });
        if (!go) break;
        const old = R.hand; R.hand = []; drawHand();
        const got = [];
        for (let k = 0; k < 2; k++) { const n = drawItem(R.rnd, { minR: 4, hand: got, exclude: old }); if (n) got.push(n); }
        R.hand = got; drawHand();
        await dialog({ who: '😈', name: 'ヴァルツ', text: `「フフフ…取引成立だ」\n${got.map(n => D.ITEM[n].e + ' ' + n).join('、')} を手に入れた！` });
        break;
      }
      case 'mirror': {
        set('🪞', 'ふしぎな鏡');
        if (!R.hand.length) { await dialog({ who: '🪞', text: 'ふしぎな鏡がある。\nアイテムを持っていれば、交換できたかもしれない……' }); break; }
        const n = await chooseItem('🪞 ふしぎな鏡に、アイテムがうつっている。\n1つを、同じレア度のべつのアイテムに交換できる', R.hand, { labels: R.hand.map(() => '交換する'), skip: '交換しない' });
        if (n) {
          const m = drawItem(R.rnd, { rarity: D.ITEM[n].r, hand: R.hand, exclude: [n] });
          if (m) { R.hand = R.hand.map(x => (x === n ? m : x)); drawHand(); await dialog({ who: '🪞', text: `${D.ITEM[n].e} ${n} が\n${D.ITEM[m].e} ${m} に変わった！` }); }
        }
        break;
      }
    }
  }

  // =====================================================================
  // 戦闘（CPUボス戦。対戦モードでも同じしくみを使う）
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
    if (!was) log(`${D.STATUS[stt].e} ${dst.name}は ${stt}になった！`);
    if (dst.has('教室のベル') || dst.has('ユニコーンの角')) dst.hp = Math.min(dst.maxhp, dst.hp + 0.05 * dst.maxhp);
  }
  const procRate = (a, d, r) => Math.min(1, r * (a.has('悪魔の契約書') ? 2.5 : 1) * (d.has('重力の石') ? 0.5 : 1));

  // 攻撃1回ぶんを計算して、ログとダメージ列を返す
  function resolveAttack(a, d, act, turn, first, ctx) {
    const out = []; const log = t => out.push({ t });
    const sk = act.sk, subj = act.subj; const skill = D.SKILLS.find(k => k.n === sk);
    let m = 1;
    if (a.has('あばれ斧')) m *= 1.3;
    if (a.has('城の大盾')) m *= 0.8;
    if (a.has('巨人のハート')) m *= 0.8;
    if (a.has('悪魔の契約書')) m *= 0.85;
    if (a.has('すなどけい')) m *= 0.9;
    if (a.has('両刃の剣')) m *= 1.5;
    if (a.has('運命の指輪')) m *= 0.92;
    if (a.has('バランスの天秤') && a.luck >= 900) m *= 1.15;
    if (a.has('背水の書')) m *= a.hp <= 0.5 * a.maxhp ? 1.5 : 0.9;
    if (a.has('給食の牛乳') && turn === 1) m *= 1.15;
    if (a.has('ラストのあめ') && turn === 3) m *= 1.15;
    if (a.has('うわばき') && first) m *= 1.1;
    if (a.has('くつした') && !first) m *= 1.1;
    if (a.has('たこあげ') && sk === '通常攻撃') m *= 1.15;
    if (a.has('ジュース') && d.hp >= 0.5 * d.maxhp) m *= 1.12;
    if (a.has('応援ラッパ') && turn > 1 && a.lastdealt < d.lastdealt) m *= 1.2;
    if (a.has('ふたつのお面')) m *= !first && d.cursubj === subj ? 1.2 : 0.95;
    if (a.has('にじの紋章') && a.lastsubj && a.lastsubj !== subj) m *= 1.15;
    if (a.has('竜の逆鱗') && a.hp <= 0.5 * a.maxhp && !a.used.has('げきりん')) { m *= 3; a.used.add('げきりん'); log('🐉 竜の逆鱗！ 威力3倍！'); }
    if (a.has('雷鳴の太鼓') && 'しびれ' in d.status) m *= 1.3;
    if (a.has('雪女のかんざし') && 'こおり' in d.status) m *= 1.2;
    if (a.has('道化のトランプ') && 'こんらん' in d.status) m *= 1.3;
    if (a.has('弱点さがしの虫めがね') && recvMult(d, subj) > 1) m *= 1.15;
    if (a.power) m *= a.power;                                  // クロガネの修行など
    if (a.weakSubj === subj) m *= a.weakMul;                   // 紋章が輝く（ボスの弱点補正）
    if ('しびれ' in a.status) { m *= 0.7; delete a.status['しびれ']; log(`⚡ ${a.name}はしびれて力が出ない…`); }
    let nocrit = a.has('運命の指輪');
    if ('よわき' in a.status) { m *= a.opp && a.opp.has('やみの霧') ? 0.6 : 0.8; nocrit = true; delete a.status['よわき']; log(`🫧 ${a.name}はよわきになっている…`); }
    let cr, cm;
    if (a.has('運命の水晶')) { cr = 0.25; cm = 1.5; }
    else { cr = K.CRIT * a.luck / 1000 + 0.1 * a.has('ねらいのメガネ') + 0.25 * a.has('一撃の角') + (a.has('ひらめき電球') && act.s3 ? 0.25 : 0); cm = 2; }
    if (nocrit) cr = 0;
    const base = baseAtk(a, subj) * act.mult;
    const hits = sk === '連続攻撃' ? (a.has('みつまたの槍') ? [0.45, 0.45, 0.45] : [0.6, 0.6]) : [skill.pw];
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
        if (d.guard) dmg *= d.has('鉄壁のこて') ? 0.3 : 0.5;
      }
      if (d.has('あばれ斧')) dmg *= 1.15;
      if ('やけど' in d.status) dmg *= a.has('火山のかけら') ? 1.4 : 1.2;
      if (ctx.cheer) dmg *= 3;
      dmg = Math.max(1, R0(dmg));
      const before = d.hp; d.hp -= dmg; totalD += dmg;
      out.push({ hit: dmg, crit, eff, target: d });
      if (d.hp <= 0 && d.has('がんじょう石') && !d.used.has('がんじょう') && before >= 0.5 * d.maxhp) { d.used.add('がんじょう'); d.hp = 1; log(`🪨 ${d.name}は がんじょう石で HP1でふみとどまった！`); }
      if (d.has('トゲよろい')) { const r = R0(0.15 * dmg); a.hp -= r; log(`🌵 トゲよろいで ${a.name}も ${r} ダメージ`); }
      if (a.has('両刃の剣')) { const r = R0(0.25 * dmg); a.hp -= r; log(`⚔️ 両刃の剣で ${a.name}も ${r} ダメージ`); }
      Object.entries(D.INFLICT).forEach(([it, [stt, r]]) => { if (a.has(it) && ctx.rnd() < procRate(a, d, r)) giveStatus(d, stt, log); });
      if (a.has('嵐の羽') && ctx.rnd() < procRate(a, d, 0.2)) giveStatus(d, pick(Object.keys(D.STATUS)), log);
      if (d.has('嵐の羽') && ctx.rnd() < 0.3) giveStatus(a, pick(Object.keys(D.STATUS)), log);
    });
    d.guard = 0;
    if (sk === 'ガードバッシュ') { a.guard = 1; log(`🛡️ ${a.name}は 守りをかためた！（次に受けるダメージ${a.has('鉄壁のこて') ? '70%カット' : '半分'}）`); }
    if (sk === 'ふういん' && !first) { const top = topSubj(d); d.seal[top] = turn + 1 + (a.has('ふういんの鍵') ? 1 : 0); log(`🔒 ${d.name}の ${top}が ふういんされた！`); }
    if (sk === 'パワーシュート') a.skipNext = true;
    let heal = 0;
    if (sk === 'ドレイン') heal += 0.5 * totalD * (a.has('吸血マント') ? 1.5 : 1);
    if (a.has('ドレインの牙')) heal += 0.1 * totalD;
    if (heal > 0 && a.hp > 0) { heal = R0(heal); a.hp = Math.min(a.maxhp, a.hp + heal); log(`💚 ${a.name}は HPを ${heal} 回復した`); }
    d.lastrecv = totalD; a.lastdealt = totalD; a.lastsubj = subj;
    return out;
  }
  function endTurn(f, log) {
    if ('どく' in f.status) { const dmg = R0(0.10 * f.maxhp * (f.opp.has('もうどくビン') ? 1.5 : 1)); f.hp -= dmg; log(`🟣 ${f.name}は どくで ${dmg} ダメージ`); }
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
  let BT = null;
  function battleScreen() {
    const { P, B } = BT;
    const side = (f, left) => `<div class="fighter" id="${left ? 'fP' : 'fB'}" style="${left ? 'left:40px' : 'right:40px'}">
      <div class="emo">${f.emo}</div><div class="nm">${esc(f.name)} <span class="sm dim">${f.isBoss ? f.el + '属性' : f.type + 'タイプ'}</span></div>
      <div class="hpbar"><i></i></div><div class="sm hpt"></div>
      <div class="stt"></div>
      <div class="row" style="justify-content:center;font-size:30px">${[...f.items].map(n => `<span class="it" data-n="${esc(n)}" style="cursor:pointer">${D.ITEM[n].e}</span>`).join('')}</div>
      <div class="gauge" style="visibility:hidden"><i></i></div><div class="sm gtxt"></div></div>`;
    const el = render(`<div class="turnlbl" id="turn"></div>${side(P, true)}${side(B, false)}
      <div class="blog panel" id="blog"></div>`, 'btl');
    el.querySelectorAll('.it').forEach(s => (s.onclick = () => showItem(s.dataset.n)));
    updBars();
  }
  function updBars() {
    if (!BT) return;
    [['fP', BT.P], ['fB', BT.B]].forEach(([id, f]) => {
      const el = $('#' + id); if (!el) return;
      const r = Math.max(0, f.hp) / f.maxhp;
      el.querySelector('.hpbar i').style.width = r * 100 + '%';
      el.querySelector('.hpbar').classList.toggle('low', r < 0.3);
      el.querySelector('.hpt').textContent = `HP ${Math.max(0, R0(f.hp))} / ${f.maxhp}`;
      el.querySelector('.stt').innerHTML = Object.keys(f.status).map(k => `<span title="${k}">${D.STATUS[k].e}${k}</span>`).join(' ') +
        Object.entries(f.ct).filter(([, v]) => v > 0).map(([k, v]) => ` <span class="xs dim">${k}あと${v}</span>`).join('');
    });
  }
  const blog = h => { const b = $('#blog'); if (b) b.innerHTML = h; };
  async function blogLines(lines, ms = 1100) { for (const l of lines) { blog(l); updBars(); await wait(ms); } }
  function showGauge(f, st, n) {
    const el = $(f === BT.P ? '#fP' : '#fB'); if (!el) return;
    const g = el.querySelector('.gauge'); g.style.visibility = 'visible';
    const m = st ? gaugeMult(f, st, n) : 0;
    g.querySelector('i').style.width = Math.min(100, (m / 1.6) * 100) + '%';
    el.querySelector('.gtxt').textContent = st ? `問題ゲージ ×${m.toFixed(2)}（${st.correct}/${n}問正解）` : '';
  }
  function hideGauges() { app.querySelectorAll('.gauge').forEach(g => (g.style.visibility = 'hidden')); app.querySelectorAll('.gtxt').forEach(g => (g.textContent = '')); }

  // ルーレット（運が高いほど幅が広い）
  async function roulette(P, B) {
    if (P.has('運命の指輪') !== B.has('運命の指輪')) { const w = P.has('運命の指輪') ? P : B; blog(`🎰 運命の指輪！ ${w.name}が 先攻・後攻をえらぶ`); await wait(1200); return w; }
    const wp = P.luck * (P.has('いかさまサイコロ') ? 1.25 : 1), wb = B.luck * (B.has('いかさまサイコロ') ? 1.25 : 1);
    const pa = 360 * wp / (wp + wb);
    const win = Math.random() < wp / (wp + wb) ? P : B;
    const o = overlay(`<div class="center"><div class="mid">🎡 先攻・後攻を決める権利は……？</div>
      <div style="position:relative"><div class="needle">🔻</div><div class="roul" style="background:conic-gradient(#3b82f6 0 ${pa}deg,#ef4444 ${pa}deg 360deg)"></div></div>
      <div class="row mid"><span style="color:#93c5fd">■ ${esc(P.name)}（運${P.luck}）</span><span style="color:#fca5a5">■ ${esc(B.name)}（運${B.luck}）</span></div></div>`);
    const wheel = o.querySelector('.roul');
    const th = win === P ? 6 + Math.random() * (pa - 12) : pa + 6 + Math.random() * (360 - pa - 12);
    await wait(300);
    wheel.style.transitionDuration = T(2200) + 'ms';
    wheel.style.transform = `rotate(${360 * 5 + (360 - th)}deg)`;
    await wait(2500); o.remove();
    return win;
  }

  // プレイヤーのスキル・教科えらび
  function playerSkill(P, turn) {
    return new Promise(res => {
      const frozen = 'こおり' in P.status;
      const o = overlay(`<div class="panel" style="width:1100px">${BT.note || ''}<div class="mid" style="margin-bottom:10px">スキルをえらぼう ${frozen ? '<span class="sm">🧊こおっていて、通常攻撃しか使えない</span>' : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">${P.skills.map(k => {
          const s = D.SKILLS.find(x => x.n === k); const ct = P.ct[k] > 0 ? P.ct[k] : 0;
          const dis = ct > 0 || (frozen && k !== '通常攻撃');
          return `<button data-k="${k}" ${dis ? 'disabled' : ''} style="text-align:left;font-size:22px">${esc(k)}${ct ? ` <span class="sm">（あと${ct}ターン）</span>` : ''}<br><span class="xs">${esc(s.d)}${s.ct ? `／CT${s.ct}` : ''}</span></button>`;
        }).join('')}</div></div>`, 'ovb');
      o.querySelectorAll('button').forEach(b => (b.onclick = () => { o.remove(); res(b.dataset.k); }));
    });
  }
  function playerSubj(P, B, turn) {
    return new Promise(res => {
      const ban = sealed(P, turn);
      if ('こんらん' in P.status) { const c = SUBJ.filter(s => !ban.includes(s)); const s = pick(c.length ? c : SUBJ); tip(`😵 こんらんして、教科が「${s}」になった！`); setTimeout(() => res(s), T(1500)); return; }
      const o = overlay(`<div class="panel" style="width:1180px">${BT.note || ''}<div class="mid" style="margin-bottom:10px">教科をえらぼう（攻撃力の目安）</div>
        <div class="row" style="justify-content:center">${SUBJ.map(s => {
          let v = baseAtk(P, s) * recvMult(B, s); if (P.weakSubj === s) v *= P.weakMul;
          const tag = P.weakSubj === s ? '<span class="gold">✨弱点</span>' : recvMult(B, s) < 1 ? '<span class="dim">効きづらい</span>' : '';
          return `<button data-s="${s}" ${ban.includes(s) ? 'disabled' : ''} style="width:210px;height:120px;border-color:${D.SUBJ_COLOR[s]};display:flex;flex-direction:column;align-items:center;justify-content:center">${D.SUBJ_EMO[s]} ${s}<span class="sm">攻撃 ${R0(v)}</span><span class="xs">${ban.includes(s) ? '🔒ふういん中' : tag}</span></button>`;
        }).join('')}</div></div>`, 'ovb');
      o.querySelectorAll('button').forEach(b => (b.onclick = () => { o.remove(); res(b.dataset.s); }));
    });
  }
  async function playerAct(P, B, turn, first) {
    const sk = await playerSkill(P, turn);
    if (sk === 'ふういん' && first) { const top = topSubj(B); B.seal[top] = turn + (P.has('ふういんの鍵') ? 1 : 0); tip(`🔒 ${B.name}の ${top}を ふういん！`); }
    const subj = await playerSubj(P, B, turn);
    P.cursubj = subj;
    const st = { g: 0, correct: 0, run: 0, bonus: 0, s3: false }, n = K.BOSS_Q;
    showGauge(P, st, n);
    for (let i = 0; i < n; i++) {
      const q = drawSolvedQ(subj, BT.used);
      const { ok } = await ask(q, { head: `（${i + 1}/${n}問目）`, fighter: P });
      gaugeStep(P, st, ok); showGauge(P, st, n);
      if (st.eraserUsed) { st.eraserUsed = false; tip('🧽 やり直し消しゴム！ まちがいのマイナスなし'); }
    }
    return { sk, subj, mult: gaugeMult(P, st, n), s3: st.s3 };
  }
  async function bossAct(B, P, turn, first) {
    const { sk, subj } = bossChoose(B, P, turn, first);
    if (sk === 'ふういん' && first) { const top = topSubj(P); P.seal[top] = turn + (B.has('ふういんの鍵') ? 1 : 0); }
    B.cursubj = subj;
    blog(`${B.emo} ${esc(B.name)}は「${sk}」で、${subj}の問題に挑戦！${sk === 'ふういん' && first ? `<br>🔒 ${esc(P.name)}の ${topSubj(P)}が ふういんされた！` : ''}`);
    const st = { g: 0, correct: 0, run: 0, bonus: 0, s3: false }, n = K.BOSS_Q;
    showGauge(B, st, n);
    for (let i = 0; i < n; i++) { await wait(600); gaugeStep(B, st, Math.random() < K.BOSS_ACC); showGauge(B, st, n); }
    await wait(800);
    return { sk, subj, mult: gaugeMult(B, st, n), s3: st.s3 };
  }

  async function animateAttack(a, d, act, turn, first, cheer = false) {
    const sk = act.sk, s = D.SKILLS.find(k => k.n === sk);
    a.ct[sk] = (['カウンター', 'パワーシュート', 'ふういん'].includes(sk) && a.has('すなどけい') ? 1 : s.ct) + 1;
    await cutin(`${a.emo} ${esc(a.name)}の <span class="gold">${sk}</span>！ <span class="sm">（${act.subj}）</span>`, 1100);
    const res = resolveAttack(a, d, act, turn, first, { rnd: Math.random, cheer });
    if (cheer && d.hp > 0) { const extra = d.hp; d.hp = 0; res.push({ hit: extra, crit: false, eff: 1, target: d }); }
    const tEl = $(d === BT.P ? '#fP' : '#fB');
    for (const r of res) {
      if (r.hit) {
        tEl.classList.remove('hit'); void tEl.offsetWidth; tEl.classList.add('hit');
        floatAt(d === BT.P ? 260 : 960, 150, (r.crit ? '会心！ ' : '') + r.hit, r.crit ? '#f472b6' : '#fde047', 'dmg');
        blog(`${r.crit ? '💥 会心の一撃！ ' : ''}${esc(d.name)}に <b class="gold">${r.hit}</b> ダメージ！ ${r.eff > 1 ? '<span class="gold">こうかばつぐん！</span>' : r.eff < 1 ? '<span class="dim">いまひとつ…</span>' : ''}`);
        updBars(); await wait(900);
      } else { blog(r.t); updBars(); await wait(1000); }
    }
    updBars();
  }

  async function bossNode() {
    const t = total(S.st), stg = stageOf(t), bd = D.BOSSES[R.boss];
    // ボスのステータス（プレイヤーの合計に合わせる）
    const bt = t * K.BOSS_POWER, w = SUBJ.map(s => (s === R.boss ? 1.5 : 1)), ws = w.reduce((a, b) => a + b);
    const bst = {}; SUBJ.forEach((s, i) => (bst[s] = R0(bt * w[i] / ws)));
    const skills = skillsOf(t);
    const P = makeFighter({ name: S.cname, emo: lookOf(S.type, t), st: { ...S.st }, items: R.hand, prevType: S.type, hpBonus: R.flags.izumi ? 0.15 : 0, skills, power: R.flags.kurogane ? 1.2 : 1 });
    const B = makeFighter({ name: bd.n[stg], emo: bd.e[stg], st: bst, items: bd.items.slice(0, stg + 1), isBoss: true, el: bd.el, fav: bd.fav, skills, type: R.boss === '無' ? '無' : R.boss === '英語' ? '英語' : R.boss });
    P.opp = B; B.opp = P;
    // 紋章が輝く：弱点の教科は、いちばん強い教科と同じくらいの攻撃力になる
    const wk = D.WEAK[R.boss];
    if (wk) {
      const best = SUBJ.reduce((x, s) => (baseAtk(P, s) > baseAtk(P, x) ? s : x));
      P.weakSubj = wk; P.weakMul = Math.max(1, baseAtk(P, best) / baseAtk(P, wk)) * (R.flags.sekihi ? 1.1 : 1);
    }
    BT = { P, B, used: new Set(), cont: false };
    battleScreen();
    $('#turn').textContent = '👑 ボス戦';
    await cutin(`${B.emo} <span class="gold">${esc(B.name)}</span> があらわれた！`, 1600);
    if (B.items.size) await blogLines([`${esc(B.name)}の持ち物：${[...B.items].map(n => D.ITEM[n].e + n).join('、')}`], 1600);
    if (wk) await blogLines([`✨ 紋章が輝く…！！ このボスには ${wk}（弱点）の攻撃力が <b class="gold">${P.weakMul.toFixed(2)}倍</b> になる！`], 2200);
    if (firstRun()) tip('ボス戦は3ターン。スキルと教科をえらんで、問題に答えて攻撃しよう！', 4000);

    let result = null;
    for (let turn = 1; turn <= 3 && !result; turn++) {
      hideGauges();
      $('#turn').textContent = `ターン ${turn} / 3`;
      await cutin(`ターン ${turn}`, 900);
      let right;
      if (R.flags.hayate) { right = P; blog('🏃 ハヤテ「ボスのくせはお見通しだ！」 先攻・後攻をえらべる'); await wait(900); }
      else right = await roulette(P, B);
      let first;
      if (right === P) {
        first = await dialog({ who: '🎡', text: `${esc(P.name)}が 決める権利をとった！\n先攻（先に攻撃できる）と 後攻（相手のえらんだものを見てからえらべる）、どっちにする？`, choices: [{ label: '⚔️ 先攻', val: P, cls: 'btn-main' }, { label: '👀 後攻', val: B, cls: 'btn-blue' }] });
      } else { first = B; blog(`${esc(B.name)}が 決める権利をとった！ ${esc(B.name)}は先攻をえらんだ`); await wait(1300); }
      const order = [first, first.opp], acts = new Map();
      P.cursubj = B.cursubj = null;
      for (let i = 0; i < 2; i++) {
        const x = order[i];
        if (x.skipNext) { x.skipNext = false; acts.set(x, null); blog(`${esc(x.name)}は パワーシュートの反動で動けない！`); await wait(1300); continue; }
        if (x === P) { BT.note = i === 1 && acts.get(B) ? `<div class="sm gold" style="margin-bottom:6px">👀 ${esc(B.name)}は「${acts.get(B).sk}」・${acts.get(B).subj} をえらんだ。どうする？</div>` : ''; acts.set(P, await playerAct(P, B, turn, i === 0)); }
        else acts.set(B, await bossAct(B, P, turn, i === 0));
      }
      for (let i = 0; i < 2; i++) {
        const x = order[i], y = x.opp, act = acts.get(x);
        if (act && x.hp > 0 && y.hp > 0) await animateAttack(x, y, act, turn, i === 0);
      }
      const lines = []; [P, B].forEach(f => endTurn(f, l => lines.push(l)));
      await blogLines(lines, 1000);
      if (P.hp <= 0 || B.hp <= 0) result = B.hp <= 0 && (P.hp > 0 || B.hp / B.maxhp < P.hp / P.maxhp) ? 'win' : 'lose';
    }
    hideGauges();
    if (!result) {
      const rp = Math.max(0, P.hp) / P.maxhp, rb = Math.max(0, B.hp) / B.maxhp;
      result = rp >= rb ? 'win' : 'lose';
      await blogLines([`⏱️ 3ターンで決着がつかなかった！ のこりHPの割合で勝負… ${esc(P.name)} ${R0(rp * 100)}% ／ ${esc(B.name)} ${R0(rb * 100)}%`], 2200);
    }
    if (result === 'win') { await winBoss(); return; }
    // 負けた
    await blogLines([`${esc(P.name)}は たおれてしまった……`], 1500);
    const cont = await dialog({ who: '💫', text: 'コンティニューする？\n（仲間が応援にかけつけて、ボスを かならずたおせるよ）', choices: [{ label: '🔥 コンティニュー', val: true, cls: 'btn-main' }, { label: 'リザルトへ', val: false, cls: 'btn-gray' }] });
    if (!cont) { await result_(false); return; }
    BT.cont = true;
    P.hp = P.maxhp; P.status = {}; P.skipNext = false; Object.keys(P.ct).forEach(k => (P.ct[k] = 0)); updBars();
    await cutin('📣 みんなの応援！', 1200);
    for (const f of D.FRIENDS) { await cutin(`${f.e} ${f.n}「がんばれ、${esc(S.cname)}！」`, 800); }
    $('#turn').textContent = '📣 応援ターン';
    const act = await playerAct(P, B, 4, true);
    const st = R0(act.mult * 100);
    await cutin(st >= 100 ? '🌈 みんなの力がひとつに！！' : st >= 80 ? '✨ 応援の力が集まる！' : '💪 いけーっ！', 1200);
    await animateAttack(P, B, act, 4, true, true);
    await winBoss();
  }

  async function winBoss() {
    const { B } = BT;
    $('#fB') && $('#fB').classList.add('bye');
    await cutin(`🏆 ${esc(B.name)}を たおした！`, 1800);
    await result_(true);
  }

  // =====================================================================
  // リザルト
  // =====================================================================
  async function result_(beat) {
    const t0 = total(R.startSt), t1 = total(S.st), stg = stageOf(t1);
    let bossItem = null, bossCoin = 0;
    if (beat) {
      bossCoin = K.COIN_BOSS * (stg + 1); S.coins += bossCoin; R.coins += bossCoin;
      bossItem = drawItem(Math.random, { unowned: true, hand: R.hand, minR: BT.cont ? 1 : 3 });
    }
    S.dungeons++;
    window.MB_LAST = { beat, cont: !!(BT && BT.cont) };
    refreshType();
    const el = render(`<div class="scr center" style="gap:14px">
      <div class="big gold">${beat ? '🏆 ダンジョン クリア！' : '🌙 ダンジョン おわり'}</div>
      <div class="panel" style="width:900px">
        <div class="row" style="justify-content:space-around;font-size:24px">${SUBJ.map(s => { const d = S.st[s] - R.startSt[s]; return `<div style="text-align:center">${D.SUBJ_EMO[s]} ${s}<br><b>${S.st[s]}</b><br><span class="${d ? 'green' : 'dim'}">+${d}</span></div>`; }).join('')}</div>
        <div class="mid" style="text-align:center;margin-top:12px">ごうけい ${t0} → <b class="gold">${t1}</b>　　🪙 +${R.coins}（もっている ${S.coins}）</div>
        ${beat ? `<div class="sm" style="text-align:center;margin-top:6px">${BT.cont ? 'ボス撃破ボーナス 🪙' + bossCoin : '✨ ノーコンティニュー！ レアなアイテムをゲット　🪙' + bossCoin}</div>` : ''}
      </div><div id="take"></div></div>`, 'res');
    await wait(1500);
    // 持ち帰り（未取得のものから1個。1日2個まで）
    const cands = [...new Set([...R.hand, ...(bossItem ? [bossItem] : [])])].filter(n => !S.owned.includes(n));
    let took = null;
    if (bossItem) await chooseItem('👑 ボス撃破のごほうび！', [bossItem], { labels: ['見た！'] });
    if (S.takeHome >= K.TAKEHOME_PER_DAY) await dialog({ who: '🎒', text: `きょうは もう アイテムを持ち帰れないよ（ダンジョンからは1日${K.TAKEHOME_PER_DAY}個まで）\nまた あした！` });
    else if (!cands.length) await dialog({ who: '🎒', text: '持ち帰れる 新しいアイテムはなかった……\n（ぜんぶ もう持っているアイテムだった）' });
    else {
      took = await chooseItem(`🎒 1つだけ 持ち帰れるよ！（きょう あと${K.TAKEHOME_PER_DAY - S.takeHome}個）`, cands, { labels: cands.map(() => '持ち帰る') });
      S.owned.push(took); S.takeHome++;
    }
    await evolution(R.startSt, R.startType);
    R = null; BT = null;
    home();
  }

  // 進化演出（新スキル・タイプ変化・見た目の成長）
  async function evolution(st0, type0) {
    const t0 = total(st0), t1 = total(S.st);
    const newSk = skillsOf(t1).filter(k => !skillsOf(t0).includes(k));
    const look0 = lookOf(type0, t0), look1 = lookOf(S.type, t1);
    if (!newSk.length && type0 === S.type && look0 === look1) return;
    const o = overlay(`<div class="center" style="gap:20px"><div style="font-size:200px;line-height:1" id="evo">${look0}</div><div class="big" id="evt"></div><div id="evb"></div></div>`);
    if (look0 !== look1 || type0 !== S.type) {
      const e = $('#evo', o);
      for (let i = 0; i < 8; i++) { e.style.filter = i % 2 ? 'brightness(3)' : 'none'; await wait(180 - i * 15); }
      e.textContent = look1; e.style.filter = 'drop-shadow(0 0 40px #fde047)';
      $('#evt', o).innerHTML = `<span class="gold">${esc(S.cname)}</span>が 進化した！${type0 !== S.type ? `<div class="mid">${S.type}タイプになった！</div>` : ''}`;
      await wait(2200);
    }
    for (const k of newSk) {
      $('#evt', o).innerHTML = `✨ 新しいスキル <span class="gold">「${k}」</span> を おぼえた！<div class="sm">${D.SKILLS.find(s => s.n === k).d}</div>`;
      await wait(2200);
    }
    $('#evb', o).innerHTML = '<button class="btn-main">ホームへ</button>';
    await new Promise(r => ($('#evb button', o).onclick = r));
    o.remove();
  }

  // ---- テスト用の入口（Playwright などから使う）----
  window.MB = { get S() { return S; }, get R() { return R; }, get BT() { return BT; }, Q, D };

  nameScreen();
})();
