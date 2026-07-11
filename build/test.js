// node test.js  — data.js と calc.js の動作テスト
const fs = require('fs');
eval(fs.readFileSync(__dirname + '/data.js', 'utf8').replace(/const (\w+)=/g, 'globalThis.$1='));
const C = require(__dirname + '/calc.js');

const opts = {kyu: true, bushu: true, suii: true};
function strokesOf(name){ let prev = null;
  return [...name].map(ch => { const r = C.resolveChar(ch, opts, prev); prev = r.strokes; return r.strokes; }); }

let ok = 0, ng = 0;
function eq(label, got, want){
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; } else { ng++; console.log('NG', label, 'got', g, 'want', w); }
}

// 画数解決
eq('佐藤', strokesOf('佐藤'), [7, 21]);
eq('沢渡', strokesOf('沢渡'), [17, 13]);
eq('かなで', strokesOf('かなで'), [3, 4, 3]);
eq('佐々木', strokesOf('佐々木'), [7, 7, 4]);

// 異体字・拡張新字体・繰り返し記号・記号
eq('髙田', strokesOf('髙田'), [10, 5]);      // 髙→高（設定に関わらず同字扱い）
eq('𠮷野', strokesOf('𠮷野'), [6, 11]);      // 𠮷→吉
eq('桧山', strokesOf('桧山'), [17, 3]);      // 桧→檜（旧字体変換）
eq('鴎', strokesOf('鴎'), [22]);             // 鴎→鷗
eq('響', strokesOf('響'), [22]);             // 中の郷を鄕(+2)で計上
eq('みすゞ', strokesOf('みすゞ'), [2, 2, 4]); // ゞ=直前+2（濁点）
eq('〆野', strokesOf('〆野'), [2, 11]);
const noKyu = [...'桧'].map(ch => C.resolveChar(ch, {kyu:false,bushu:true,suii:true}, null).strokes);
eq('桧(旧字体オフ)', noKyu, [10]);           // 拡張新字体はトグルに追従
const takaOff = [...'髙'].map(ch => C.resolveChar(ch, {kyu:false,bushu:false,suii:false}, null).strokes);
eq('髙(全設定オフ)', takaOff, [10]);         // 異体字は設定に依らず解決

// 五格（佐藤太郎）
const g = C.gokaku([7, 21], [4, 14]);
eq('天格', g.ten.disp, 28); eq('人格', g.jin.disp, 25); eq('地格', g.chi.disp, 18);
eq('外格', g.gai.disp, 21); eq('総格', g.sou.disp, 46);

// 霊数（一字姓・一字名）
const g2 = C.gokaku([8], [17]);
eq('霊数:天', g2.ten.disp, 9); eq('霊数:地', g2.chi.disp, 18);
eq('霊数:外', g2.gai.disp, 2); eq('霊数:総', g2.sou.disp, 25);

// 81数理の循環
eq('num81(85)', C.num81(85), 5); eq('num81(81)', C.num81(81), 81);

// 数理表の完全性（81数すべてが評価・数理名・解説・仕事・対人・心得の6項目を持つ）
let complete = 0;
for (let i = 1; i <= 81; i++) {
  const f = C.FORTUNE[i];
  if (f && f.length === 6 && f.every(x => typeof x === 'string' && x.length > 0)) complete++;
}
eq('FORTUNE完全性', complete, 81);
const fo = C.fortuneOf(15);
eq('fortuneOf詳細', [!!fo.work, !!fo.social, !!fo.care], [true, true, true]);

// 性別による頭領数・活動数の判定（21・23・33・39・29）
eq('頭領数:女性', C.fortuneOf(21, 'f').rating, '凶');
eq('頭領数:男性', C.fortuneOf(21, 'm').rating, '大吉');
eq('頭領数:未指定', C.fortuneOf(21).rating, '大吉');
eq('活動数:女性', C.fortuneOf(29, 'f').rating, '凶');
eq('特殊数以外:女性', C.fortuneOf(24, 'f').rating, '大吉');
eq('注記:未指定あり', C.fortuneOf(23).note.length > 0, true);
eq('注記:男性なし', C.fortuneOf(23, 'm').note, '');
const gf = C.gokaku([10, 11], [10, 4], 'f');   // 人格21
eq('五格に性別反映', [gf.jin.disp, gf.jin.rating, gf.jin.adjusted], [21, '凶', true]);
const gm = C.gokaku([10, 11], [10, 4], 'm');
eq('男性は据え置き', [gm.jin.rating, !!gm.jin.adjusted], ['大吉', false]);

// 陰陽
eq('二分', C.inyo([7, 21, 4, 14]).name, '二分');
eq('挟み', C.inyo([3, 8, 8, 3]).name, '挟み');
eq('純陰', C.inyo([4, 4, 4]).name, '純陰');

// 三才
const sz = C.sansai(28, 25, 18);
eq('三才五行', [sz.elems.ten, sz.elems.jin, sz.elems.chi], ['金', '土', '金']);
eq('三才評価', sz.rating, '吉');

console.log(ng === 0 ? `ALL OK (${ok} tests)` : `${ng} FAILED / ${ok} passed`);
process.exit(ng === 0 ? 0 : 1);
