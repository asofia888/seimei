# -*- coding: utf-8 -*-
"""template.html に data.js / calc.js / ui.js を注入して ../index.html を生成"""
import re, os, sys, subprocess, tempfile

here = os.path.dirname(os.path.abspath(__file__))
def read(name):
    return open(os.path.join(here, name), encoding='utf-8').read()

for req in ('data.js',):
    if not os.path.exists(os.path.join(here, req)):
        sys.exit('data.js がありません。先に build_data.py を実行してください。')

calc = read('calc.js')
calc = re.sub(r"if\(typeof module!=='undefined'\)\{[^\n]*\}\n?", '', calc)  # Node用エクスポートを除去
data = read('data.js')
ui = read('ui.js')
tpl = read('template.html')

out = tpl.replace('/*__DATA__*/', data).replace('/*__CALC__*/', calc).replace('/*__UI__*/', ui)
assert '__DATA__' not in out and '__CALC__' not in out and '__UI__' not in out, '注入placeholderが残っています'

# Node.js があれば結合後スクリプトを構文チェック（無ければスキップ）
tmp = None
try:
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
        tf.write(data + '\n' + calc + '\n' + ui)
        tmp = tf.name
    chk = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if chk.returncode != 0:
        sys.exit('node --check 失敗:\n' + chk.stderr)
    print('構文チェック OK (node --check)')
except FileNotFoundError:
    print('note: Node.js が見つからないため構文チェックをスキップしました')
finally:
    if tmp and os.path.exists(tmp):
        os.unlink(tmp)

dst = os.path.join(here, '..', 'index.html')
open(dst, 'w', encoding='utf-8').write(out)
print('OK:', os.path.abspath(dst), f'{os.path.getsize(dst):,} bytes')
