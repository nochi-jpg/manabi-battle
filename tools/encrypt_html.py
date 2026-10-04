# 1ファイル版の HTML を「暗号化版」にする（公開用。中の画像・音・フォントを むき出しにしない）
# 使い方: python3 tools/encrypt_html.py もとの.html 出力.html [タイトル]
# しくみ：HTML全体を gzip で ちぢめる → カギから作った数のならびで XOR → base64。
#   ひらくと 小さな読みこみ画面が もとにもどして（DecompressionStream）document.write で表示する。
#   カギは この中にあるので くわしい人なら もどせる（ツクールの暗号化と同じくらいの「隠す措置」）
import base64, gzip, hashlib, os, pathlib, sys

def keystream_xor(data: bytes, seed: int) -> bytes:
    # xorshift32（JS と同じ計算）
    out = bytearray(len(data)); x = seed & 0xffffffff or 1
    for i in range(0, len(data), 4):
        x ^= (x << 13) & 0xffffffff; x ^= x >> 17; x ^= (x << 5) & 0xffffffff
        k = x.to_bytes(4, 'little')
        for j in range(min(4, len(data) - i)): out[i + j] = data[i + j] ^ k[j]
    return bytes(out)

def main():
    src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    title = sys.argv[3] if len(sys.argv) > 3 else 'まなび'
    raw = src.read_bytes()
    z = gzip.compress(raw, 9, mtime=0)
    seed = int.from_bytes(hashlib.sha256(os.urandom(16)).digest()[:4], 'little') | 1
    try:
        import numpy as np  # はやい
        n = (len(z) + 3) // 4
        # xorshift は じゅんばんに計算するしかないので python で作って numpy でまとめる
        xs = []; v = seed
        for _ in range(n):
            v ^= (v << 13) & 0xffffffff; v ^= v >> 17; v ^= (v << 5) & 0xffffffff; xs.append(v)
        ks = np.array(xs, dtype='<u4').tobytes()[:len(z)]
        enc = (np.frombuffer(z, dtype=np.uint8) ^ np.frombuffer(ks, dtype=np.uint8)).tobytes()
    except ImportError:
        enc = keystream_xor(z, seed)
    b64 = base64.b64encode(enc).decode()
    html = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>html,body{{margin:0;height:100%;background:#0b1030;color:#fff;font-family:sans-serif}}#ld{{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-size:22px}}#ld i{{display:block;width:280px;height:10px;border-radius:5px;background:#2a3370;overflow:hidden}}#ld b{{display:block;height:100%;width:0;background:#6fd3ff;transition:width .2s}}</style></head>
<body><div id="ld"><div>よみこみ中…</div><i><b id="bar"></b></i><small id="er"></small></div>
<script id="pk" type="application/octet-stream">{b64}</script>
<script>
(async function () {{
  const bar = document.getElementById('bar'), er = document.getElementById('er');
  try {{
    if (!window.DecompressionStream) throw new Error('このブラウザでは ひらけません。Chrome か Edge の新しいものを つかってね');
    bar.style.width = '15%';
    await new Promise(r => setTimeout(r, 30));
    const s = atob(document.getElementById('pk').textContent.trim()), n = s.length, u = new Uint8Array(n);
    let x = {seed} >>> 0;
    for (let i = 0; i < n; i += 4) {{
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      for (let j = 0; j < 4 && i + j < n; j++) u[i + j] = s.charCodeAt(i + j) ^ ((x >>> (8 * j)) & 255);
    }}
    bar.style.width = '55%';
    await new Promise(r => setTimeout(r, 30));
    const txt = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    bar.style.width = '100%';
    document.open(); document.write(txt); document.close();
  }} catch (e) {{ er.textContent = '⚠️ ' + e.message; }}
}})();
</script></body></html>
'''
    dst.write_text(html, encoding='utf-8')
    print(f'{dst.name}（{dst.stat().st_size / 1e6:.1f} MB・もと {len(raw) / 1e6:.1f} MB）')

main()
