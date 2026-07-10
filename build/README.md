# 再ビルド手順

`index.html` は、このディレクトリのソースから生成されています。
画数辞書・判定ロジック・デザインを変更したい場合は以下の手順で再生成してください。

## 必要なもの

- Python 3.8 以上
- Node.js（構文チェックとテストに使用。省略可）

## 手順

```bash
cd build

# 1. 元データを取得（リポジトリには含まれていません）
curl -L -o kanji.json https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json
curl -L -o ids.txt   https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt

# 2. 画数辞書を生成（基準値111字との照合テストが自動で走ります）
python3 build_data.py
#   → data.js が生成され、「--- verify: 111/111 OK ---」のような結果が出れば成功

# 3. テンプレートに辞書とロジックを注入して index.html を生成
python3 build_app.py
#   → ../index.html が更新されます

# 4. （任意）ロジックのテスト
node test.js
```

## ファイル構成

| ファイル | 役割 |
|---|---|
| `build_data.py` | 画数辞書ビルダー。旧字体変換表（291組）・異体字表・部首補正・強制補正・かな画数表を組み込み、`data.js` を出力 |
| `calc.js` | 鑑定ロジック（八十一数理表・五格・霊数・陰陽配列・三才五行・総評） |
| `ui.js` | 画面制御（文字カード・命式図の描画・設定トグル・再計算） |
| `template.html` | デザインテンプレート。`/*__DATA__*/` `/*__CALC__*/` `/*__UI__*/` の位置に注入される |
| `build_app.py` | 注入スクリプト。`../index.html` を出力 |
| `test.js` | Node.js での動作テスト |

## 画数を修正したいとき

- **特定の文字の画数を固定する** … `build_data.py` の `FORCE = {...}` に `'字': 画数` を追加
- **旧字体の対応を足す** … `KYU_PAIRS` の文字列に「新旧」の2文字ペアを追加（例: `恋戀`）
- **異体字の対応を足す** … `VAR = {...}` に `'異体字': '標準字体'` を追加（例: `'髙': '高'`）。設定に関わらず常に同字として数えます
- **基準値テストに追加する** … `EXPECT = {...}` に追加しておくと、以後のビルドで自動検証されます
