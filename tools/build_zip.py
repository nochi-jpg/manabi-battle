# Teams配信用の ZIP をつくる（公開リポジトリのプログラム ＋ 非公開リポジトリ manabi-battle-assets の画像）
# 使い方: python3 tools/build_zip.py [出力ファイル名]
#   素材リポジトリは となりのフォルダ（../manabi-battle-assets）に置いておく
import subprocess, zipfile, pathlib, sys, io

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT.parent / 'manabi-battle-assets'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'manabi-battle.zip')
P = 'manabi-battle/'

code = subprocess.run(['git', 'archive', '--format=zip', '--prefix=' + P, 'HEAD'], cwd=ROOT, capture_output=True, check=True).stdout
n = 0
with zipfile.ZipFile(io.BytesIO(code)) as src, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for i in src.infolist():
        z.writestr(i, src.read(i))
    if ASSETS.exists():
        files = [ASSETS / 'assets.local.js', ASSETS / 'CREDITS.md'] + sorted((ASSETS / 'images').rglob('*.*'))
        for f in files:
            if f.is_file():
                name = 'CREDITS-assets.md' if f.name == 'CREDITS.md' else str(f.relative_to(ASSETS)).replace('\\', '/')
                z.write(f, P + name, compress_type=zipfile.ZIP_STORED if f.suffix in ('.png', '.jpg') else zipfile.ZIP_DEFLATED); n += 1
    else:
        print('⚠️ 素材リポジトリが見つからないので、絵文字だけの ZIP になります:', ASSETS)
print(f'{out}（画像など {n} ファイル入り・{out.stat().st_size // 1024} KB）')
