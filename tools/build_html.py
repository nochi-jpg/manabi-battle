# 1つのHTMLにまとめた版を作る（子どもが「解凍 → index.html」をしなくていいように）
# 使い方: python3 tools/build_html.py [BGMのビットレート kbps（ふつう32）]
#   素材リポジトリは となりのフォルダ（../manabi-battle-assets）。ffmpeg が必要（BGMを軽くする）
#   画像・音・フォントは data: URI にして中に入れる。同じ画像は1回だけ入れて、読みこんだあとに パスを置きかえる
import base64, json, mimetypes, pathlib, re, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT.parent / 'manabi-battle-assets'
KBPS = int(sys.argv[1]) if len(sys.argv) > 1 else 32
OUT = ROOT / 'manabi-battle.html'
TMP = pathlib.Path(tempfile.mkdtemp())
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2'}

def src(rel):  # 公開リポジトリ → なければ素材リポジトリ
    for b in (ROOT, ASSETS):
        if (b / rel).exists(): return b / rel
    raise FileNotFoundError(rel)
def data_uri(rel):
    p = src(rel)
    if rel.startswith('sounds/bgm/'):  # BGM は モノラル・低いビットレートに
        q = TMP / p.name
        if not q.exists():
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(p), '-ac', '1', '-b:a', f'{KBPS}k', str(q)], check=True)
        p = q
    return f'data:{MIME[p.suffix.lower()]};base64,' + base64.b64encode(p.read_bytes()).decode()
PATH = re.compile(r'(?:images|sounds|fonts)/[\w./%-]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|woff2?)')
def js(text): return text.replace('</script', '<\\/script')

html = (ROOT / 'index.html').read_text()
css_local = (ASSETS / 'assets.local.css').read_text()
local_js = (ASSETS / 'assets.local.js').read_text()

# CSS（index.html の中と assets.local.css）：パスを その場で data: に（フォント・UI画像。少ない）
inline = lambda t: PATH.sub(lambda m: data_uri(m.group(0)), t)
style_parts = re.split(r'(<style>.*?</style>)', html, flags=re.S)
html = ''.join(inline(s) if s.startswith('<style>') else s for s in style_parts)
html = html.replace('<link rel="stylesheet" href="assets.local.css">', '<style>\n' + inline(css_local) + '\n</style>')
ico = data_uri('images/player/all_cute_1.png')
html = re.sub(r'(<link rel="(?:icon|apple-touch-icon)"[^>]*href=")images/player/all_cute_1\.png', lambda m: m.group(1) + ico, html)

# JS：assets.local.js の パスは 表（__EMB）にまとめて 1回だけ入れる → 読みこんだあと ASSETS の中の文字を置きかえ
def exists(p):
    try: src(p); return True
    except FileNotFoundError: return False
paths = sorted(set(PATH.findall(local_js)) | {p for p in PATH.findall((ROOT / 'assets.js').read_text()) if exists(p)})
emb = {p: data_uri(p) for p in paths}
fix = '<script>(function(){/* data: を blob: に（innerHTML に 長い文字が 入らないように＝画面の切りかえが かるくなる）。画像は 先に デコードしておく */const E=window.__EMB,K=window.__KEEP=[];for(const k in E){const v=E[k],c=v.indexOf(\',\'),t=v.slice(5,v.indexOf(\';\')),b=atob(v.slice(c+1)),u=new Uint8Array(b.length);for(let j=0;j<b.length;j++)u[j]=b.charCodeAt(j);E[k]=URL.createObjectURL(new Blob([u],{type:t}));if(t.startsWith(\'image/\')){const im=new Image();im.src=E[k];if(im.decode)im.decode().catch(()=>{});K.push(im);}}const w=o=>{for(const k in o){const v=o[k];if(typeof v==="string"&&E[v])o[k]=E[v];else if(v&&typeof v==="object")w(v);}};w(window.ASSETS||{});})();</script>'
def script(m):
    name = m.group(1)
    if name == 'assets.local.js':
        return '<script>window.__EMB=' + js(json.dumps(emb, ensure_ascii=False)) + ';</script>\n<script>' + js(local_js) + '</script>\n' + fix
    return '<script>' + js(src(name).read_text()) + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', script, html)
left = [p for p in PATH.findall(re.sub(r'data:[^"\')]+', '', html)) if p not in emb and exists(p)]
OUT.write_text(html)
print(f'{OUT}（{OUT.stat().st_size / 1e6:.1f} MB・BGM {KBPS}kbps モノラル・埋めこみ {len(emb)} ファイル）')
if left: print('のこっているパス:', sorted(set(left))[:10])
