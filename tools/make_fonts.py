# 同梱フォントを作りなおす（問題や文言を足したら実行）。Google Fonts の ttf が必要
# 使い方: python3 tools/make_fonts.py <google/fonts の ofl フォルダ>
#   （git clone --depth 1 --filter=blob:none --sparse https://github.com/google/fonts して
#     git sparse-checkout set ofl/mplusrounded1c ofl/dotgothic16）
import pathlib, subprocess, sys
R = pathlib.Path(__file__).resolve().parent.parent
G = pathlib.Path(sys.argv[1])
chars = set()
for f in ['game.js', 'data.js', 'questions.js', 'index.html', 'savecode.js', 'assets.js', 'docs/SPEC.md']:
    chars |= set((R / f).read_text())
la = R.parent / 'manabi-battle-assets' / 'assets.local.css'
if la.exists(): chars |= set(la.read_text())
chars |= {chr(c) for c in list(range(0x20, 0x7f)) + list(range(0x3000, 0x3100)) + list(range(0x30A0, 0x3100)) + list(range(0xFF01, 0xFF9F))}
for hi in range(0xB0, 0xD0):  # JIS第1水準の漢字（名前用）
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('euc_jp'))
        except Exception: pass
chars = {c for c in chars if ord(c) >= 0x20 and not (0xD800 <= ord(c) < 0xE000)}
tf = R / 'fonts' / '_chars.txt'; tf.write_text(''.join(sorted(chars)))
jobs = [(G / 'dotgothic16' / 'DotGothic16-Regular.ttf', 'DotGothic16-Regular.woff')] + \
       [(G / 'mplusrounded1c' / f'MPLUSRounded1c-{w}.ttf', f'MPLUSRounded1c-{w}.woff') for w in ['Regular', 'Bold', 'ExtraBold']]
for src, out in jobs:
    subprocess.run(['pyftsubset', str(src), f'--text-file={tf}', '--flavor=woff', f'--output-file={R / "fonts" / out}', '--layout-features=*'], check=True)
tf.unlink(); print(len(chars), '字')
