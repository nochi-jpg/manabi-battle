# デバッグルームの入口の名前から、コードに入れるハッシュを作る
# 使い方: python3 tools/make_debug_hash.py プレイヤーネーム キャラクターネーム
#   → 出てきた16文字を game.js の DEBUG_HASH に書きかえる（名前そのものはコードに書かない）
import sys

def name_hash(pname, cname):
    M = 0xFFFFFFFF
    h1, h2 = 0x811c9dc5, 0x01000193 ^ 0x5bd1e995
    for x in ('manabi-debug:' + pname + '\n' + cname).encode('utf-8'):
        h1 = ((h1 ^ x) * 0x01000193) & M
        h2 = ((h2 ^ x) * 0x5bd1e995) & M
        h2 ^= h2 >> 13
    return f'{h1:08x}{h2:08x}'

if __name__ == '__main__':
    if len(sys.argv) != 3: print(__doc__ or '使い方: python3 tools/make_debug_hash.py プレイヤーネーム キャラクターネーム'); sys.exit(1)
    print(name_hash(sys.argv[1], sys.argv[2]))
