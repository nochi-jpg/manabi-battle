// ===== セーブのQRコード（全部入り）の作り方・読み方 =====
// 形式は docs/QR_FORMAT.md。続編でも同じQRで引きつげるように、項目は「後ろに足す」だけにする
window.SAVECODE = (function () {
  'use strict';
  const D = window.DATA, SUBJ = D.SUBJ;
  const MAGIC = [0x4d, 0x42], FMT = 2;     // 形式2：問題DBの版を入れる・アイテムの並びを新しくした           // 'MB' ＋ 形式番号
  const KEY = 'manabi-battle/2026/まなび学園';     // チェック用の数字を作るカギ（書きかえ防止）
  const BOSS = ['国語', '算数', '理科', '社会', '英語', '無'];
  const TYPES = ['全教科', ...SUBJ], AURA = ['', '銀', '金', '虹'], BG = Object.keys(D.BGS);
  const QCODE = { 2: 1, 3: 2, 4: 3 }, QBACK = [0, 2, 3, 4]; // 0=まだ 1=復習まち 2=あと1回 3=卒業
  const EPOCH = Date.UTC(2020, 0, 1);
  const te = new TextEncoder(), td = new TextDecoder();
  // 形式1のときのアイテムの並び（QRの持ち物ビットの順番）
  const ITEMS_FMT1 = ['国語の紋章', '算数の紋章', '理科の紋章', '社会の紋章', '英語の紋章', '特化の王冠', 'バランスの天秤', 'あばれ斧', 'ねらいのメガネ', '一撃の角', '背水の書', '弱点さがしの虫めがね', 'にじの紋章', 'えんぴつのお守り', '連続正解の炎', '百科じてん', 'ひらめき電球', '失敗は成功のもと', 'ひらめきメガネ', 'やり直し消しゴム', 'どくキバ', 'かみなりぐも', 'もうどくビン', 'らいうのくも', 'ひのこ石', '火山のかけら', 'こおりの結晶', 'かきごおり', 'キャンディのつえ', '道化のトランプ', 'ばくちく', 'やみの霧', 'でんせつの弓', '悪魔の契約書', '木の盾', '城の大盾', 'かたいよろい', 'がんじょう石', 'おまもり', 'ばんそうこう', 'いのちの実', '巨人のハート', 'ドレインの牙', 'ふしぎなウォッチ', 'はね返しの鏡', 'ふういんの鍵', '鉄壁の兜', '吸血セーター', 'いかさまサイコロ', '運命の指輪', 'おにぎり', '赤白ぼうし', 'ランドセル', '給食の牛乳', 'ラストのあめ', 'うわばき', 'くつした', 'じょうぎ', '教室のベル', 'たこ焼き', 'ジュース', 'くまのぬいぐるみ', '応援ラッパ', 'きつねのおめん', '竜の逆鱗', '両刃の剣', '運命の水晶', '嵐の羽', '重力の石', 'ユニコーンの角'];
  const QV = () => window.QDB_VERSION || 1;
  // 古い問題番号 → 今の番号（qmap.js の対応表を順に当てる）
  function mapId(id, fromV) { let x = +id; for (let v = fromV; v < QV(); v++) { const m = (window.QID_MAPS || {})[v]; x = m && m[x] ? m[x] : 0; if (!x) return 0; } return x; }
  function remapKeys(obj, fromV) { if (!obj || fromV >= QV()) return obj; const o = {}; for (const k in obj) { const n = mapId(k, fromV); if (n) o[n] = obj[k]; } return o; }
  const remapList = (a, fromV) => (fromV >= QV() ? a : (a || []).map(x => mapId(x, fromV)).filter(Boolean));

  class W {
    constructor() { this.b = []; }
    u8(v) { this.b.push(v & 255); }
    vu(v) { v = Math.max(0, Math.floor(v || 0)); while (v > 127) { this.b.push((v & 127) | 128); v = Math.floor(v / 128); } this.b.push(v); }
    str(s) { const u = te.encode(s || ''); this.vu(u.length); u.forEach(x => this.b.push(x)); }
    bits(n, f) { for (let i = 0; i < n; i += 8) { let x = 0; for (let j = 0; j < 8 && i + j < n; j++) if (f(i + j)) x |= 1 << j; this.b.push(x); } }
  }
  class Rd {
    constructor(b) { this.b = b; this.i = 0; }
    u8() { if (this.i >= this.b.length) throw new Error('みじかい'); return this.b[this.i++]; }
    vu() { let v = 0, m = 1, x; do { x = this.u8(); v += (x & 127) * m; m *= 128; } while (x & 128); return v; }
    str() { const n = this.vu(); if (this.i + n > this.b.length) throw new Error('みじかい'); const s = td.decode(new Uint8Array(this.b.slice(this.i, this.i + n))); this.i += n; return s; }
    bits(n) { const o = []; for (let i = 0; i < n; i += 8) { const x = this.u8(); for (let j = 0; j < 8 && i + j < n; j++) o.push(!!((x >> j) & 1)); } return o; }
  }
  function hash(bytes) {
    let h = 0x811c9dc5; const k = te.encode(KEY);
    for (const x of [...k, ...bytes, ...k]) { h ^= x; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const dayNum = s => { const [y, m, d] = String(s).split('-').map(Number); return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5)) || 0; };
  const dayStr = n => { const d = new Date(EPOCH + n * 864e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

  // S（セーブ）→ バイト列
  function encode(S, qmax) {
    const w = new W();
    MAGIC.forEach(x => w.u8(x)); w.u8(FMT); w.u8(QV());
    w.str(S.pname); w.str(S.cname);
    SUBJ.forEach(s => w.vu(S.st[s]));
    w.u8(Math.max(0, TYPES.indexOf(S.type)));
    w.vu(S.coins); w.vu(S.stamina); w.vu(dayNum(S.day)); w.u8(S.takeHome || 0); w.vu((S.towerMs || 0) / 1000);
    w.u8(BOSS.indexOf(S.lastBoss) + 1);
    [S.dungeons, S.clears, S.nocont, S.playDays, S.gachaN].forEach(v => w.vu(v));
    w.u8(S.typeChanged ? 1 : 0);
    w.bits(6, i => !!S.bossWin[BOSS[i]]); w.bits(6, i => !!S.boss3[BOSS[i]]);
    SUBJ.forEach(s => w.vu(S.towerBest[s] || 0));
    w.vu(D.ITEMS.length); w.bits(D.ITEMS.length, i => S.owned.includes(D.ITEMS[i].n)); w.bits(D.ITEMS.length, i => S.fav.includes(D.ITEMS[i].n));
    w.vu(D.ACH.length); w.bits(D.ACH.length, i => !!S.ach[D.ACH[i].id]);
    w.u8(D.ACH.findIndex(a => a.r.t && a.r.t === S.sel.title) + 1); w.u8(Math.max(0, AURA.indexOf(S.sel.aura))); w.u8(Math.max(0, BG.indexOf(S.sel.bg)));
    w.vu(qmax);
    for (let id = 1; id <= qmax; id += 4) { let x = 0; for (let j = 0; j < 4; j++) x |= (QCODE[S.qs[id + j]] || 0) << (j * 2); w.u8(x); }
    // 一発で正解できなかった問題（先生用ページの正答率）。「復習まち」は必ずまちがえているので、あと1回・卒業の問題だけ書く
    const mids = []; for (let id = 1; id <= qmax; id++) if (S.qs[id] === 3 || S.qs[id] === 4) mids.push(id);
    w.bits(mids.length, i => !!(S.miss || {})[mids[i]]);
    // 倒したボスの強さ（6体×★1〜3）
    w.bits(18, i => !!(((S.bossStg || {})[BOSS[Math.floor(i / 3)]] || 0) & (1 << (i % 3))));
    // せいかく（0〜2000）、すがた（1ビット目＝かっこいい系、2〜3ビット目＝決まった段階）
    w.vu(S.seikaku === undefined ? 1000 : S.seikaku); w.u8((S.style === 'cool' ? 1 : 0) | (((S.styleStg || 0) & 3) << 1));
    // 限定の隠し称号（持っているもの・つけているもの）
    const HT = D.HIDDEN_TITLES || [];
    w.u8(HT.reduce((m, t, i) => m | ((S.hidden || []).includes(t) ? 1 << i : 0), 0)); w.u8(HT.indexOf(S.sel.title) + 1);
    const h = hash(w.b); [24, 16, 8, 0].forEach(k => w.u8(h >>> k));
    return new Uint8Array(w.b);
  }

  // バイト列 → セーブの中身（書きかえられていたら エラー）
  function decode(bytes) {
    bytes = Array.from(bytes);
    if (bytes.length < 8 || bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1]) throw new Error('まなびバトルのQRではないよ');
    const body = bytes.slice(0, -4), tail = bytes.slice(-4);
    const h = hash(body);
    if (tail[0] !== (h >>> 24 & 255) || tail[1] !== (h >>> 16 & 255) || tail[2] !== (h >>> 8 & 255) || tail[3] !== (h & 255)) throw new Error('QRが こわれているか、書きかえられているよ');
    const r = new Rd(body); r.i = 2;
    const fmt = r.u8(); if (fmt > FMT) throw new Error('新しいバージョンのQRだよ。ゲームを新しくしてね');
    const qv = fmt >= 2 ? r.u8() : 1;
    if (qv > QV()) throw new Error('新しいバージョンのQRだよ。ゲームを新しくしてね');
    const ITEMS = fmt >= 2 ? D.ITEMS.map(it => it.n) : ITEMS_FMT1;
    const o = { v: 2, pname: r.str(), cname: r.str(), st: {} };
    SUBJ.forEach(s => (o.st[s] = r.vu()));
    o.type = TYPES[r.u8()] || '全教科';
    o.coins = r.vu(); o.stamina = r.vu(); o.day = dayStr(r.vu()); o.takeHome = r.u8(); o.towerMs = r.vu() * 1000;
    o.lastBoss = BOSS[r.u8() - 1] || null;
    [o.dungeons, o.clears, o.nocont, o.playDays, o.gachaN] = [r.vu(), r.vu(), r.vu(), r.vu(), r.vu()];
    o.typeChanged = !!(r.u8() & 1);
    const bw = r.bits(6), b3 = r.bits(6); o.bossWin = {}; o.boss3 = {};
    BOSS.forEach((b, i) => { if (bw[i]) o.bossWin[b] = 1; if (b3[i]) o.boss3[b] = 1; });
    o.towerBest = {}; SUBJ.forEach(s => (o.towerBest[s] = r.vu()));
    const ni = r.vu(), own = r.bits(ni), fav = r.bits(ni);
    o.owned = ITEMS.filter((n, i) => own[i] && D.ITEM[n]); o.fav = ITEMS.filter((n, i) => fav[i] && D.ITEM[n]);
    const na = r.vu(), ach = r.bits(na); o.ach = {}; D.ACH.forEach((a, i) => { if (ach[i]) o.ach[a.id] = o.day; });
    const ti = r.u8(), ai = r.u8(), bi = r.u8();
    o.sel = { title: ti && D.ACH[ti - 1] ? D.ACH[ti - 1].r.t || '' : '', aura: AURA[ai] || '', bg: BG[bi] || '学園の町' };
    const qmax = r.vu(); o.qs = {}; o.qd = {};
    for (let id = 1; id <= qmax; id += 4) { const x = r.u8(); for (let j = 0; j < 4; j++) { const c = (x >> (j * 2)) & 3; if (c) o.qs[id + j] = QBACK[c]; } }
    o.miss = {};
    for (const id in o.qs) if (o.qs[id] === 2) o.miss[id] = 1;
    const mids = Object.keys(o.qs).map(Number).filter(id => o.qs[id] === 3 || o.qs[id] === 4).sort((x, y) => x - y);
    if (r.i < body.length) r.bits(mids.length).forEach((m, i) => { if (m) o.miss[mids[i]] = 1; });
    if (r.i < body.length) { o.bossStg = {}; r.bits(18).forEach((x, i) => { if (x) { const b = BOSS[Math.floor(i / 3)]; o.bossStg[b] = (o.bossStg[b] || 0) | (1 << (i % 3)); } }); }
    if (r.i < body.length) { o.seikaku = Math.min(2000, r.vu()); const x = r.u8(); o.style = x & 1 ? 'cool' : 'cute'; o.styleStg = (x >> 1) & 3; }
    o.hidden = [];
    if (r.i < body.length) { const HT = D.HIDDEN_TITLES || [], m = r.u8(), si = r.u8(); o.hidden = HT.filter((t, i) => m & (1 << i)); if (si && HT[si - 1]) o.sel.title = HT[si - 1]; }
    o.qs = remapKeys(o.qs, qv); o.miss = remapKeys(o.miss, qv); o.qv = QV();
    o.tower = {}; o.run = null; o.dungeons = o.dungeons || 0;
    return o;
  }
  return { encode, decode, mapId, remapKeys, remapList, QV };
})();
