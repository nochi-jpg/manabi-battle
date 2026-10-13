// ===== セーブのQRコード（全部入り）の作り方・読み方 =====
// 形式は docs/QR_FORMAT.md。続編でも同じQRで引きつげるように、項目は「後ろに足す」だけにする
window.SAVECODE = (function () {
  'use strict';
  const D = window.DATA, SUBJ = D.SUBJ;
  const MAGIC = [0x4d, 0x42], FMT = 3;     // 形式3（10/13 配布版）：問題の記録を 圧縮・アイテムは 手に入れた順・ごはん。形式2までは 読まない           // 'MB' ＋ 形式番号
  const KEY = 'manabi-battle/2026/まなび学園';     // チェック用の数字を作るカギ（書きかえ防止）
  const BOSS = ['国語', '算数', '理科', '社会', '英語', '無'];
  const TYPES = ['全教科', ...SUBJ], AURA = ['', '銀', '金', '虹'], BG = Object.keys(D.BGS);
  const QCODE = { 2: 1, 3: 2, 4: 3 }, QBACK = [0, 2, 3, 4]; // 0=まだ 1=復習まち 2=あと1回 3=卒業
  const EPOCH = Date.UTC(2020, 0, 1);
  const te = new TextEncoder(), td = new TextDecoder();
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
    u8() { if (this.i >= this.b.length) throw new Error('QRが こわれているよ'); return this.b[this.i++]; }
    vu() { let v = 0, m = 1, x; do { x = this.u8(); v += (x & 127) * m; m *= 128; } while (x & 128); return v; }
    str() { const n = this.vu(); if (this.i + n > this.b.length) throw new Error('QRが こわれているよ'); const s = td.decode(new Uint8Array(this.b.slice(this.i, this.i + n))); this.i += n; return s; }
    bits(n) { const o = []; for (let i = 0; i < n; i += 8) { const x = this.u8(); for (let j = 0; j < 8 && i + j < n; j++) o.push(!!((x >> j) & 1)); } return o; }
  }
  // ---- 問題の記録の 圧縮（10/13）：レンジコーダー（LZMA と同じ しくみ）。1問 2ビット（0〜3）を、ひとつ前の 問題の 状態ごとに 確率を 学びながら 小さくする ----
  const TOP = 16777216, U32 = 4294967296;
  function rcEncode(sym) {
    const out = []; let low = 0, range = 0xFFFFFFFF, cache = 0, csz = 1;
    const shift = () => {
      if (low < 0xFF000000 || low >= U32) { const c = low >= U32 ? 1 : 0; let t = cache; do { out.push((t + c) & 255); t = 255; } while (--csz !== 0); cache = Math.floor(low / TOP) & 255; }
      csz++; low = (low % TOP) * 256;
    };
    const P = Array.from({ length: 4 }, () => [1024, 1024, 1024]);
    const bit = (p, i, b) => { const bound = (range >>> 11) * p[i]; if (!b) { range = bound; p[i] += (2048 - p[i]) >> 5; } else { low += bound; range -= bound; p[i] -= p[i] >> 5; } while (range < TOP) { range = (range * 256) % U32; shift(); } };
    let prev = 0;
    for (const s of sym) { const p = P[prev], h = s >> 1; bit(p, 0, h); bit(p, 1 + h, s & 1); prev = s; }
    for (let i = 0; i < 5; i++) shift();
    return out;
  }
  function rcDecode(bytes, n) {
    let i = 0; const nb = () => (i < bytes.length ? bytes[i++] : 0);
    let range = 0xFFFFFFFF, code = 0; for (let k = 0; k < 5; k++) code = (code * 256 + nb()) % U32;
    const P = Array.from({ length: 4 }, () => [1024, 1024, 1024]);
    const bit = (p, j) => { const bound = (range >>> 11) * p[j]; let b; if (code < bound) { range = bound; p[j] += (2048 - p[j]) >> 5; b = 0; } else { code -= bound; range -= bound; p[j] -= p[j] >> 5; b = 1; } while (range < TOP) { range = (range * 256) % U32; code = (code * 256 + nb()) % U32; } return b; };
    const out = []; let prev = 0;
    for (let k = 0; k < n; k++) { const p = P[prev], h = bit(p, 0), s = (h << 1) | bit(p, 1 + h); out.push(s); prev = s; }
    return out;
  }
  function hash(bytes) {
    let h = 0x811c9dc5; const k = te.encode(KEY);
    for (const x of [...k, ...bytes, ...k]) { h ^= x; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const dayNum = s => { const [y, m, d] = String(s).split('-').map(Number); return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5)) || 0; };
  const dayStr = n => { const d = new Date(EPOCH + n * 864e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

  // S（セーブ）→ バイト列（形式3。docs/QR_FORMAT.md）
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
    // アイテム：手に入れた じゅんの 番号（data.js の 並び）＋ おきにいり（ビット）
    const own = (S.owned || []).map(n => D.ITEMS.findIndex(it => it.n === n)).filter(i => i >= 0);
    w.vu(D.ITEMS.length); w.vu(own.length); own.forEach(i => w.u8(i)); w.bits(D.ITEMS.length, i => (S.fav || []).includes(D.ITEMS[i].n));
    w.vu(D.ACH.length); w.bits(D.ACH.length, i => !!S.ach[D.ACH[i].id]);
    w.u8(D.ACH.findIndex(a => a.r.t && a.r.t === S.sel.title) + 1); w.u8(Math.max(0, AURA.indexOf(S.sel.aura))); w.u8(Math.max(0, BG.indexOf(S.sel.bg)));
    // 問題の 状態（番号1〜qmax。0=まだ 1=復習まち 2=あと1回 3=卒業）→ 圧縮
    const sym = []; for (let id = 1; id <= qmax; id++) sym.push(QCODE[S.qs[id]] || 0);
    const rc = rcEncode(sym); w.vu(qmax); w.vu(rc.length); rc.forEach(x => w.u8(x));
    w.bits(18, i => !!(((S.bossStg || {})[BOSS[Math.floor(i / 3)]] || 0) & (1 << (i % 3))));
    w.vu(S.seikaku === undefined ? 1000 : S.seikaku); w.u8((S.style === 'cool' ? 1 : 0) | (((S.styleStg || 0) & 7) << 1));
    const HT = D.HIDDEN_TITLES || [];
    w.u8(HT.reduce((m, t, i) => m | ((S.hidden || []).includes(t) ? 1 << i : 0), 0)); w.u8(HT.indexOf(S.sel.title) + 1);
    w.vu(S.bonusPt || 0); w.u8(Math.min(255, S.gachaToday || 0)); w.u8(S.newDay === S.day ? 1 : 0);
    const rg = (S.run && S.run.gain) || {}; SUBJ.forEach(s => w.vu(Math.max(0, rg[s] || 0)));
    SUBJ.forEach(s => w.u8((S.qgrade || {})[s] || 4));
    w.vu(S.loginN || 0);
    w.u8((S.loginDay === S.day ? 1 : 0) | (S.fedDay === S.day ? 2 : 0)); // 1：きょうの ログインボーナス済み・2：きょうの ごはん済み
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
    const fmt = r.u8();
    if (fmt > FMT) throw new Error('新しいバージョンのQRだよ。ゲームを新しくしてね');
    if (fmt < FMT) throw new Error('前のバージョンのQRなので 読めないよ。いまのゲームで QRを 出しなおしてね');
    const qv = r.u8();
    if (qv > QV()) throw new Error('新しいバージョンのQRだよ。ゲームを新しくしてね');
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
    const ni = r.vu(), no = r.vu(); o.owned = [];
    for (let k = 0; k < no; k++) { const it = D.ITEMS[r.u8()]; if (it && !o.owned.includes(it.n)) o.owned.push(it.n); }
    const fav = r.bits(ni); o.fav = D.ITEMS.filter((it, i) => fav[i]).map(it => it.n);
    const na = r.vu(), ach = r.bits(na); o.ach = {}; D.ACH.forEach((a, i) => { if (ach[i]) o.ach[a.id] = o.day; });
    const ti = r.u8(), ai = r.u8(), bi = r.u8();
    o.sel = { title: ti && D.ACH[ti - 1] ? D.ACH[ti - 1].r.t || '' : '', aura: AURA[ai] || '', bg: BG[bi] || 'まなびタウン' };
    const qmax = r.vu(), nrc = r.vu(); if (r.i + nrc > body.length) throw new Error('QRが こわれているよ');
    const sym = rcDecode(body.slice(r.i, r.i + nrc), qmax); r.i += nrc;
    o.qs = {}; o.qd = {}; o.miss = {};
    sym.forEach((c, k) => { if (c) o.qs[k + 1] = QBACK[c]; });
    for (const id in o.qs) if (o.qs[id] === 2) o.miss[id] = 1;
    o.bossStg = {}; r.bits(18).forEach((x, i) => { if (x) { const b = BOSS[Math.floor(i / 3)]; o.bossStg[b] = (o.bossStg[b] || 0) | (1 << (i % 3)); } });
    o.seikaku = Math.min(2000, r.vu()); { const x = r.u8(); o.style = x & 1 ? 'cool' : 'cute'; o.styleStg = (x >> 1) & 7; }
    o.lookV = 2;
    { const HT = D.HIDDEN_TITLES || [], m = r.u8(), si = r.u8(); o.hidden = HT.filter((t, i) => m & (1 << i)); if (si && HT[si - 1]) o.sel.title = HT[si - 1]; }
    o.bonusPt = r.vu(); o.gachaToday = r.u8(); if (r.u8() & 1) o.newDay = o.day;
    o.runGain = null; { const g = {}; SUBJ.forEach(s => (g[s] = r.vu())); if (SUBJ.some(s => g[s])) o.runGain = g; }
    o.qgrade = {}; SUBJ.forEach(s => { const g = r.u8(); o.qgrade[s] = g >= 4 && g <= 6 ? g : 4; });
    o.loginN = r.vu(); { const f = r.u8(); if (f & 1) o.loginDay = o.day; if (f & 2) o.fedDay = o.day; }
    o.qs = remapKeys(o.qs, qv); o.miss = remapKeys(o.miss, qv); o.qv = QV();
    o.tower = {}; o.run = null; o.dungeons = o.dungeons || 0;
    return o;
  }
  return { encode, decode, mapId, remapKeys, remapList, QV };
})();
