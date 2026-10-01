// ===== セーブのQRコード（全部入り）の作り方・読み方 =====
// 形式は docs/QR_FORMAT.md。続編でも同じQRで引きつげるように、項目は「後ろに足す」だけにする
window.SAVECODE = (function () {
  'use strict';
  const D = window.DATA, SUBJ = D.SUBJ;
  const MAGIC = [0x4d, 0x42], FMT = 1;           // 'MB' ＋ 形式番号
  const KEY = 'manabi-battle/2026/まなび学園';     // チェック用の数字を作るカギ（書きかえ防止）
  const BOSS = ['国語', '算数', '理科', '社会', '英語', '無'];
  const TYPES = ['全教科', ...SUBJ], AURA = ['', '銀', '金', '虹'], BG = Object.keys(D.BGS);
  const QCODE = { 2: 1, 3: 2, 4: 3 }, QBACK = [0, 2, 3, 4]; // 0=まだ 1=復習まち 2=あと1回 3=卒業
  const EPOCH = Date.UTC(2020, 0, 1);
  const te = new TextEncoder(), td = new TextDecoder();

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
    MAGIC.forEach(x => w.u8(x)); w.u8(FMT);
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
    w.bits(qmax, i => !!(S.miss || {})[i + 1]); // 一発で正解できなかった問題（先生用ページの正答率）
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
    o.owned = D.ITEMS.filter((it, i) => own[i]).map(it => it.n); o.fav = D.ITEMS.filter((it, i) => fav[i]).map(it => it.n);
    const na = r.vu(), ach = r.bits(na); o.ach = {}; D.ACH.forEach((a, i) => { if (ach[i]) o.ach[a.id] = o.day; });
    const ti = r.u8(), ai = r.u8(), bi = r.u8();
    o.sel = { title: ti && D.ACH[ti - 1] ? D.ACH[ti - 1].r.t || '' : '', aura: AURA[ai] || '', bg: BG[bi] || '部室' };
    const qmax = r.vu(); o.qs = {}; o.qd = {};
    for (let id = 1; id <= qmax; id += 4) { const x = r.u8(); for (let j = 0; j < 4; j++) { const c = (x >> (j * 2)) & 3; if (c) o.qs[id + j] = QBACK[c]; } }
    o.miss = {};
    if (r.i < body.length) r.bits(qmax).forEach((m, i) => { if (m) o.miss[i + 1] = 1; });
    o.tower = {}; o.run = null; o.dungeons = o.dungeons || 0;
    return o;
  }
  return { encode, decode };
})();
