# 公開版（暗号化した1ファイル版）を 公開リポジトリに出す
# 使い方: python3 tools/publish.py battle    → ../manabato/index.html（まなびバトル）
#         python3 tools/publish.py stadium   → ../manasuta/index.html（まなびスタジアム）
# ・公開リポジトリは いつも「最新の1コミットだけ」にする（約20MBのHTMLを たくさん ためないため。force push）
# ・素材の むき出しの ファイルは 公開リポジトリに 入れない
import pathlib, shutil, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
HOME = ROOT.parent
GAMES = {
    'battle': dict(src=ROOT, build=ROOT / 'tools/build_html.py', html=ROOT / 'manabi-battle.html', pub=HOME / 'manabato', title='まなびバトル',
                   about='小学4〜6年向けの 学習×育成×対戦ゲーム。5教科の問題を ときながら モンスターを そだてて、ボスや 友だちと たたかう。'),
    'stadium': dict(src=HOME / 'manabi-stadium', build=HOME / 'manabi-stadium/tools/build_html.py', html=HOME / 'manabi-stadium/manabi-stadium.html', pub=HOME / 'manasuta', title='まなびスタジアム',
                    about='先生用の「豪華版とうぎじょう」。まなびバトルの QRコードを 2まい 読みこんで、電子黒板の大画面で 3Dのスタジアムの 対戦を 上映する。'),
}
CREDITS = '''- 音楽：MusMus（https://musmus.main.jp）／魔王魂（https://maou.audio）
- 効果音：効果音ラボ（https://soundeffect-lab.info）
- ドット絵：ピクセルガロー（https://hpgpixer.jp）／DOT ILLUST（https://dot-illust.net）／ゲームまてりあるず（https://game-materials.com）／モケモ（https://mokemo-factory.booth.pm）
- UI：dobo_ui「Fantasy RPG UI」／mandinhart「Garden cozy kit」／Atelier Pixerelia「Verboten Arcane Stash」
- フォント：DotGothic16（Fontworks）・M PLUS Rounded 1c（M+ FONTS PROJECT）SIL Open Font License 1.1
- プログラム：qrcode-generator（Kazuhiko Arase）・jsQR（cozmo）・Three.js（three.js authors）MIT License'''

def run(*a, cwd=None): subprocess.run(list(a), check=True, cwd=cwd)
def main():
    g = GAMES[sys.argv[1]]
    pub = g['pub']
    if not (pub / '.git').exists(): sys.exit(f'{pub} がない（となりに clone してね）')
    run(sys.executable, str(g['build']))
    run(sys.executable, str(ROOT / 'tools/encrypt_html.py'), str(g['html']), str(pub / 'index.html'), g['title'])
    name = pub.name
    (pub / 'README.md').write_text(f'''# {g['title']}

{g['about']}

**あそぶ**：https://nochi-jpg.github.io/{name}/ （ブラウザで ひらくだけ。Chrome・Edge の新しいもの）

- このリポジトリには、ゲームを1つのファイルにまとめた `index.html` だけを置いています
- ゲームの中の 画像・音・フォントの 著作権は、それぞれの作者にあります。**ゲームから 取り出して つかったり、配ったりしないでください**

## クレジット
ディレクション・ゲームデザイン・企画 K.nom

{CREDITS}
''', encoding='utf-8')
    (pub / '.nojekyll').write_text('')
    # 最新の1コミットだけにする
    run('git', 'checkout', '-q', '--orphan', '_pub', cwd=pub)
    run('git', 'add', '-A', cwd=pub)
    run('git', 'commit', '-q', '-m', f'{g["title"]} 公開版\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01VSVSxW2cDN42XVaoPQurWi', cwd=pub)
    subprocess.run(['git', 'branch', '-D', 'main'], cwd=pub, capture_output=True)
    run('git', 'branch', '-m', 'main', cwd=pub)
    run('git', 'push', '-q', '--force', 'origin', 'main', cwd=pub)
    print(f'公開した → https://nochi-jpg.github.io/{name}/')

main()
