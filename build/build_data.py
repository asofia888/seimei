# -*- coding: utf-8 -*-
"""熊崎式（康熙字典体）画数辞書ビルダー
RAW: 文字→実画数（KANJIDIC2系, 新字体・旧字体とも収録）
KYU: 新字体→旧字体
ADJ: 部首補正（さんずい=水4 等）＋既知の強制補正
最終画数 = RAW[KYU[c]] + ADJ[KYU[c]]
"""
import json, re, sys

kanji = json.load(open('kanji.json', encoding='utf-8'))
RAW = {c: v['strokes'] for c, v in kanji.items() if isinstance(v.get('strokes'), int)}

# ---- IDS 読み込み（[J]優先） ----
IDS = {}
tagre = re.compile(r'\[[A-Z]+\]')
for line in open('ids.txt', encoding='utf-8'):
    if line.startswith('#'):
        continue
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 3:
        continue
    ch = parts[1]
    cands = parts[2:]
    chosen = None
    for c in cands:  # [J] を最優先
        if '[J' in c or '[GJ' in c or ('J' in (tagre.search(c).group() if tagre.search(c) else '')):
            chosen = tagre.sub('', c); break
    if chosen is None:
        for c in cands:
            if '[' not in c:
                chosen = c; break
    if chosen is None:
        chosen = tagre.sub('', cands[0])
    IDS[ch] = chosen

OPS2 = set('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻')
OPS3 = set('⿲⿳')

def tokens(ids_str):
    return [t for t in ids_str if t not in OPS2 and t not in OPS3]

# 再帰展開して部首出現を数える
FLAT_PLUS1 = set('氵忄扌犭礻衤')      # → 水4/心4/手4/犬4/示5/衣6
SHINNYO   = set('辶⻌⻍')             # → 辵7（既定 +4、二点之繞は個別補正）
COMP_PATCH = {'毎': 1, '者': 1, '曽': 1, '郎': 1, '成': 1}  # 康熙字典体で1画増える構成部品

def expand_count(ch, memo, depth=0):
    if ch in memo:
        return memo[ch]
    res = {'p1': 0, 'p3': 0, 'sn': 0, 'patch': 0}
    if depth > 8:
        return res
    s = IDS.get(ch)
    if not s:
        return res
    memo[ch] = res  # 循環防止（仮置き）
    for t in tokens(s):
        if t == ch:
            continue
        if t in FLAT_PLUS1:
            res['p1'] += 1
        elif t in SHINNYO:
            res['sn'] += 1
        elif t in COMP_PATCH:
            res['patch'] += COMP_PATCH[t]
        else:
            sub = expand_count(t, memo, depth + 1)
            for k in res:
                res[k] += sub[k]
    memo[ch] = res
    return res

def first_level_adj(ch):
    """こざとへん(阜8)=+5 / おおざと(邑7)=+4 / たまへん(玉5)=+1 は第一階層のみ"""
    s = IDS.get(ch)
    if not s:
        return 0
    if s[0] in '⿱⿳' and len(s) > 1 and s[1] == '艹':
        return 3  # 下部の氵・辶等は expand_count 側で計上済み
    if not s.startswith('⿰'):
        return 0
    # ⿰ の左右を構文解析
    def parse(i):
        c = s[i]
        if c in OPS2:
            i, a = parse(i + 1)
            i, b = parse(i)
            return i, (c, a, b)
        if c in OPS3:
            i, a = parse(i + 1)
            i, b = parse(i)
            i, c2 = parse(i)
            return i, (c, a, b, c2)
        return i + 1, c
    try:
        _, tree = parse(0)
    except Exception:
        return 0
    if not (isinstance(tree, tuple) and tree[0] == '⿰'):
        return 0
    left, right = tree[1], tree[2]
    adj = 0
    if left == '阝':
        adj += 5
    if right == '阝':
        adj += 4
    if left == '王':
        adj += 1
    return adj

memo = {}
ADJ = {}
for ch in RAW:
    c = expand_count(ch, memo)
    a = c['p1'] * 1 + c['p3'] * 3 + c['sn'] * 4 + c['patch'] + first_level_adj(ch)
    if a:
        ADJ[ch] = a

# にくづき：康熙字典で肉部（部首130）の字は、月の形でも肉(6)として数える（+2）。
# CJK統合漢字は部首順に並ぶため、肉部は U+8089〜U+81E2。月部（服・朋・望 等）は範囲外。
# 肉の形のまま含む字（腐・臠 等）はすでに6画で数えられているので補正しない
for ch in RAW:
    if 0x8089 <= ord(ch) <= 0x81E2 and '肉' not in IDS.get(ch, ch):
        ADJ[ch] = ADJ.get(ch, 0) + 2

# ---- 新字体→旧字体（常用・人名用の主要対応） ----
KYU_PAIRS = ("亜亞 悪惡 圧壓 囲圍 医醫 壱壹 稲稻 飲飮 隠隱 営營 栄榮 衛衞 駅驛 円圓 縁緣 艶艷 塩鹽 応應 横橫 "
"欧歐 殴毆 黄黃 温溫 穏穩 仮假 価價 画畫 会會 壊壞 懐懷 絵繪 拡擴 殻殼 覚覺 学學 岳嶽 楽樂 渇渴 巻卷 勧勸 "
"寛寬 歓歡 缶罐 観觀 関關 陥陷 巌巖 顔顏 帰歸 気氣 亀龜 偽僞 戯戲 犠犧 旧舊 拠據 挙擧 虚虛 峡峽 挟挾 狭狹 "
"郷鄕 暁曉 区區 駆驅 勲勳 薫薰 径徑 恵惠 渓溪 経經 継繼 茎莖 蛍螢 軽輕 鶏鷄 芸藝 撃擊 研硏 県縣 倹儉 剣劍 "
"険險 圏圈 検檢 献獻 権權 顕顯 験驗 厳嚴 効效 広廣 恒恆 鉱鑛 号號 国國 黒黑 済濟 砕碎 斎齋 剤劑 桜櫻 冊册 "
"雑雜 参參 惨慘 桟棧 蚕蠶 賛贊 残殘 歯齒 児兒 辞辭 湿濕 実實 舎舍 写寫 釈釋 寿壽 収收 従從 渋澁 獣獸 縦縱 "
"粛肅 処處 叙敍 奨奬 将將 渉涉 焼燒 称稱 証證 乗乘 剰剩 壌壤 嬢孃 条條 浄淨 状狀 畳疊 譲讓 醸釀 嘱囑 触觸 "
"寝寢 慎愼 晋晉 真眞 尽盡 図圖 粋粹 酔醉 随隨 髄髓 数數 枢樞 瀬瀨 声聲 静靜 斉齊 摂攝 窃竊 専專 戦戰 浅淺 "
"潜潛 繊纖 践踐 銭錢 禅禪 曽曾 双雙 壮壯 捜搜 挿插 巣巢 争爭 痩瘦 総總 聡聰 荘莊 装裝 騒騷 増增 蔵藏 臓臟 "
"属屬 続續 堕墮 体體 対對 帯帶 滞滯 台臺 滝瀧 択擇 沢澤 単單 担擔 胆膽 団團 弾彈 断斷 痴癡 遅遲 昼晝 虫蟲 "
"鋳鑄 庁廳 徴徵 聴聽 勅敕 鎮鎭 逓遞 鉄鐵 転轉 点點 伝傳 灯燈 当當 党黨 盗盜 闘鬪 徳德 独獨 読讀 届屆 縄繩 "
"弐貳 悩惱 脳腦 覇霸 廃廢 拝拜 売賣 麦麥 発發 髪髮 抜拔 晩晚 蛮蠻 秘祕 浜濱 払拂 仏佛 変變 歩步 穂穗 宝寶 "
"豊豐 翻飜 毎每 万萬 満滿 黙默 弥彌 訳譯 薬藥 予豫 余餘 与與 誉譽 揺搖 様樣 謡謠 来來 頼賴 乱亂 覧覽 竜龍 "
"両兩 猟獵 緑綠 涙淚 塁壘 礼禮 励勵 霊靈 齢齡 暦曆 歴歷 恋戀 錬鍊 炉爐 労勞 遥遙 郎郞 辺邊 桧檜 鴎鷗 "
"穣穰 瑶瑤 尭堯 莱萊 為爲 鴬鶯")

KYU = {}
warn = []
for pair in KYU_PAIRS.split():
    if len(pair) != 2:
        warn.append('pair length: ' + pair); continue
    s, k = pair[0], pair[1]
    if s == k:
        warn.append('same codepoint: ' + pair); continue
    if k not in RAW:
        warn.append('kyujitai missing in RAW: ' + pair); continue
    KYU[s] = k

# ---- かな（濁点+2・半濁点+1） ----
HIRA = dict(zip('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをん',
 [3,2,2,2,3, 3,4,1,3,2, 3,1,2,3,1, 4,2,1,1,2, 4,3,2,2,1, 3,1,4,1,4, 3,2,3,2,3, 3,2,2, 2,2,1,2,1, 2,1,1,3,1]))
for a, b in zip('ぁぃぅぇぉっゃゅょゎ', 'あいうえおつやゆよわ'):
    HIRA[a] = HIRA[b]
for base, voiced in zip('かきくけこさしすせそたちつてとはひふへほ', 'がぎぐげござじずぜぞだぢづでどばびぶべぼ'):
    HIRA[voiced] = HIRA[base] + 2
for base, semi in zip('はひふへほ', 'ぱぴぷぺぽ'):
    HIRA[semi] = HIRA[base] + 1

KATA = dict(zip('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン',
 [2,2,3,3,3, 2,3,2,3,2, 3,3,2,2,2, 3,3,3,3,2, 2,2,2,4,1, 2,2,1,1,4, 2,3,2,2,3, 2,2,3, 2,2,2,1,3, 2,4,3,3,2]))
for a, b in zip('ァィゥェォッャュョヮヵヶ', 'アイウエオツヤユヨワカケ'):
    KATA[a] = KATA[b]
for base, voiced in zip('カキクケコサシスセソタチツテトハヒフヘホ', 'ガギグゲゴザジズゼゾダヂヅデドバビブベボ'):
    KATA[voiced] = KATA[base] + 2
for base, semi in zip('ハヒフヘホ', 'パピプペポ'):
    KATA[semi] = KATA[base] + 1
HIRA['ゔ'] = HIRA['う'] + 2
KATA['ヴ'] = KATA['ウ'] + 2
KATA['ー'] = 1

for d in (HIRA, KATA):
    RAW.update(d)

RAW['〆'] = 2  # 記号（〆野・〆木 等の姓）

# ---- 異体字（字典に無い字形は標準字体と同字として数える） ----
VAR = {'髙': '高', '𠮷': '吉'}
for a, b in list(VAR.items()):
    if b not in RAW:
        VAR.pop(a)
        print('WARN variant target missing:', a, b)

# ---- 強制補正（流派で確立している既知値へ合わせる） ----
FORCE = {'隆': 17, '朗': 11, '琴': 13,
         '薰': 20,  # 薰: 元データが20画（部品の熏14と矛盾）。艸6＋熏14＝20
         '遙': 17, '邊': 22, '遞': 17, '迄': 10, '辿': 10, '這': 14,
         '迂': 10, '遜': 17, '遡': 17, '辻': 9, '逗': 14, '逞': 14, '郞': 14, '德': 15, '瀨': 20, '龜': 16, '成': 7, '雅': 12, '溫': 14, '蘭': 23,
         '響': 22}  # 響: 中の郷を鄕(+2)で数える（饗はKANJIDIC2が既に鄕形で22のため補正不要）
for ch, target in FORCE.items():
    if ch in RAW:
        a = target - RAW[ch]
        if a:
            ADJ[ch] = a
        elif ch in ADJ:
            del ADJ[ch]

def final(ch):
    ch = VAR.get(ch, ch)
    k = KYU.get(ch, ch)
    if k not in RAW:
        return None
    return RAW[k] + ADJ.get(k, 0)

# ---- 検証 ----
EXPECT = {'佐':7,'藤':21,'鈴':13,'木':4,'高':10,'橋':16,'田':5,'中':4,'村':7,'山':3,'林':8,'太':4,'郎':14,
'子':3,'美':9,'花':10,'井':4,'上':3,'川':3,'海':11,'陽':17,'大':3,'恵':12,'沢':17,'渡':13,'部':15,'阿':13,
'都':16,'桜':21,'菜':14,'優':17,'心':4,'香':9,'奈':8,'達':16,'遥':17,'梅':11,'敏':11,'緒':15,'渚':13,'藍':21,
'清':12,'広':15,'島':10,'崎':11,'原':10,'森':12,'松':8,'竹':6,'野':11,'吉':6,'伊':6,'斎':17,'斉':14,'辺':22,
'隆':17,'翔':12,'結':12,'愛':13,'央':5,'咲':9,'道':16,'神':10,'理':12,'英':11,'蒼':16,'葵':15,'陸':16,'独':17,
'裕':13,'快':8,'徳':15,'漢':14,'郁':13,'浜':18,'瀬':20,'滝':20,'龍':16,'亀':16,'恋':23,'静':16,'実':14,'寿':14,
'豊':18,'穂':17,'聡':17,'弥':17,'礼':18,'蓮':20,'遠':17,'近':11,'進':15,'四':5,'五':4,'七':2,'十':2,'ん':1,'が':5,'パ':3,
'髙':10,'𠮷':6,'桧':17,'檜':17,'鴎':22,'鷗':22,'響':22,'饗':22,'郷':17,'〆':2,'ゔ':4,'ヴ':5,
'薫':20,'穣':22,'瑶':15,'尭':12,'莱':14,'為':12,'鴬':21,
'育':10,'胤':11,'脩':13,'能':12,'脇':12,'肥':10,'腐':14,'服':8,'朋':8}

ng = 0
for ch, exp in EXPECT.items():
    got = final(ch)
    if got != exp:
        ng += 1
        k = KYU.get(ch, ch)
        print(f'MISMATCH {ch}: got={got} expect={exp}  (kyu={k} raw={RAW.get(k)} adj={ADJ.get(k,0)} ids={IDS.get(k)})')
print(f'--- verify: {len(EXPECT)-ng}/{len(EXPECT)} OK, warnings={len(warn)} ---')
for w in warn[:20]:
    print('WARN', w)

# ---- 出力 ----
def js_obj(d):
    items = ','.join(f'"{k}":{v}' for k, v in d.items())
    return '{' + items + '}'

with open('data.js', 'w', encoding='utf-8') as f:
    f.write('const RAW=' + js_obj(RAW) + ';\n')
    f.write('const KYU=' + json.dumps(KYU, ensure_ascii=False, separators=(",", ":")) + ';\n')
    f.write('const ADJ=' + js_obj(ADJ) + ';\n')
    f.write('const NUM={"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10};\n')
    f.write('const VAR=' + json.dumps(VAR, ensure_ascii=False, separators=(",", ":")) + ';\n')

import os
print('data.js size:', os.path.getsize('data.js'), 'RAW entries:', len(RAW), 'ADJ entries:', len(ADJ), 'KYU pairs:', len(KYU))
