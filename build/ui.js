/* ===== UI ===== */
const OPTS={kyu:true,bushu:true,suii:true};
try{const s=JSON.parse(localStorage.getItem('seimei-opts')||'{}');
  for(const k in OPTS) if(typeof s[k]==='boolean') OPTS[k]=s[k];}catch(e){}
function saveOpts(){try{localStorage.setItem('seimei-opts',JSON.stringify(OPTS));}catch(e){}}
const overrides={};            // "g:i:ch" -> 画数(手動)
let resolved={sei:[],mei:[]};
let hasRun=false;
const $=id=>document.getElementById(id);

function resolveGroup(txt,g){
  const chars=[...txt];
  let prev=null;
  return chars.map((ch,i)=>{
    const r=resolveChar(ch,OPTS,prev);
    const key=g+':'+i+':'+ch;
    if(overrides[key]!=null){r.strokes=overrides[key];r.known=true;r.manual=true;}
    prev=r.strokes;
    return r;
  });
}

function cleanName(v){return v.replace(/[\uff66-\uff9f]+/g,s=>s.normalize('NFKC')).replace(/[\s\u3000]/g,'');}

function renderCards(){
  const seiT=cleanName($('seiIn').value), meiT=cleanName($('meiIn').value);
  resolved.sei=resolveGroup(seiT,'s');
  resolved.mei=resolveGroup(meiT,'m');
  const any=seiT.length||meiT.length;
  $('charwrap').style.display=any?'':'none';
  $('seiCards').innerHTML=resolved.sei.map((r,i)=>cardHTML(r,'s',i)).join('');
  $('meiCards').innerHTML=resolved.mei.map((r,i)=>cardHTML(r,'m',i)).join('');
  document.querySelectorAll('.ccard input').forEach(inp=>{
    inp.addEventListener('input',onStrokeInput);
    inp.addEventListener('change',onStrokeChange);
  });
  updateRunState();
}

function cardHTML(r,g,i){
  const kyu=(r.counted!==r.ch)?((r.varOnly?'':'旧 ')+r.counted):'';
  const basis=r.manual?'手動修正':(r.basis.length?r.basis.join('・'):(r.known?'実画':''));
  const val=r.strokes!=null?r.strokes:'';
  const warn=r.known?'' :'<div class="warn">画数を入力</div>';
  return '<div class="ccard'+(r.known?'':' unknown')+'">'
    +'<div class="ch">'+esc(r.ch)+'</div>'
    +'<div class="kyu">'+esc(kyu)+'</div>'
    +'<input type="number" min="1" max="64" inputmode="numeric" aria-label="「'+esc(r.ch)+'」の画数" data-g="'+g+'" data-i="'+i+'" data-ch="'+esc(r.ch)+'" value="'+val+'">'
    +warn
    +'<div class="basis">'+esc(basis)+'</div>'
    +'</div>';
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function onStrokeInput(e){
  const t=e.target;let v=parseInt(t.value,10);
  if(v>64){v=64;t.value='64';}
  const key=t.dataset.g+':'+t.dataset.i+':'+t.dataset.ch;
  if(!isNaN(v)&&v>0){overrides[key]=v;}else{delete overrides[key];}
  // 内部値だけ更新（フォーカス維持のため再描画しない）
  const grp=t.dataset.g==='s'?resolved.sei:resolved.mei;
  const r=grp[+t.dataset.i];
  if(r){r.strokes=(!isNaN(v)&&v>0)?v:null;r.known=r.strokes!=null;r.manual=true;}
  updateRunState();
  if(hasRun&&canRun())compute(false);
}
function onStrokeChange(){renderCards();if(hasRun&&canRun())compute(false);}

function canRun(){
  return resolved.sei.length>=1&&resolved.mei.length>=1
    &&resolved.sei.every(r=>r.strokes!=null)&&resolved.mei.every(r=>r.strokes!=null);
}
function updateRunState(){
  const seiT=cleanName($('seiIn').value),meiT=cleanName($('meiIn').value);
  $('runBtn').disabled=!canRun();
  $('results').classList.toggle('stale',hasRun&&!canRun());
  let h='';
  if((seiT.length||meiT.length)&&(!seiT.length||!meiT.length))h='姓と名の両方を入力してください。';
  else if(seiT.length&&meiT.length&&!canRun())h='画数が未登録の文字があります。文字カードに画数を直接入力してください。';
  $('hint').textContent=h;
}

/* ===== 鑑定 ===== */
let last=null;
function currentSex(){const r=document.querySelector('input[name="sexIn"]:checked');return r?r.value:'';}
function compute(scroll){
  const sei=resolved.sei.map(r=>r.strokes),mei=resolved.mei.map(r=>r.strokes);
  const sex=currentSex();
  const g=gokaku(sei,mei,sex);
  const iy=inyo(sei.concat(mei));
  const sz=sansai(g.ten.num,g.jin.num,g.chi.num);
  const ov=overall(g,iy,sz,sex);
  last={g,iy,sz,ov,sex};
  renderMeishiki(g);
  renderGokaku(g,sex);
  renderInyo(iy);
  renderSansai(sz);
  $('ovBandT').textContent=ov.band;
  $('ovText').innerHTML=ov.paras.map(t=>'<p>'+esc(t)+'</p>').join('');
  $('results').classList.add('show');
  $('results').classList.remove('stale');
  hasRun=true;
  if(scroll){
    const rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('results').scrollIntoView({behavior:rm?'auto':'smooth',block:'start'});
  }
}

function chip(r){return '<span class="chip '+r+'">'+r+'</span>';}

/* --- 命式図 --- */
function renderMeishiki(g){
  const rows=[];
  if(g.reiSei)rows.push({rei:1});
  resolved.sei.forEach(r=>rows.push({ch:r.ch,s:r.strokes}));
  const meiStart=rows.length;
  resolved.mei.forEach(r=>rows.push({ch:r.ch,s:r.strokes}));
  if(g.reiMei)rows.push({rei:1});
  const seiEnd=meiStart-1,lastI=rows.length-1;
  const frame=document.querySelector('.frame').clientWidth||360;
  const narrow=frame<430;
  const H=narrow?58:66,CW=narrow?62:76,LL=narrow?74:88;
  const chF=narrow?27:33;
  const CX=LL+22, laneA=CX+CW+6, laneB=laneA+20, labX=laneB+20, pad=6;
  const width=labX+(narrow?108:128);
  const height=rows.length*H;
  let h='';
  rows.forEach((r,i)=>{
    const top=i*H;
    if(r.rei){
      h+='<div class="ms-cell rei" style="left:'+CX+'px;top:'+top+'px;width:'+CW+'px;height:'+H+'px;">'
        +'<div class="c">1</div><div class="s" style="font-size:9px;">霊数</div></div>';
    }else{
      const yin=r.s%2?'○':'●';
      h+='<div class="ms-cell" style="left:'+CX+'px;top:'+top+'px;width:'+CW+'px;height:'+H+'px;">'
        +'<div class="c" style="font-size:'+chF+'px;">'+esc(r.ch)+'</div>'
        +'<div class="s">'+r.s+'画 '+yin+'</div></div>';
    }
  });
  const br=(x,r1,r2,side)=>'<div class="ms-br '+side+'" style="left:'+x+'px;top:'+(r1*H+pad)+'px;height:'+((r2-r1+1)*H-pad*2)+'px;width:12px;"></div>';
  h+=br(laneA,0,seiEnd,'right');
  h+=br(laneA,meiStart,lastI,'right');
  h+=br(laneB,seiEnd,meiStart,'right');
  h+=br(LL+4,0,lastI,'left');
  const lab=(x,cy,t,f,lft)=>'<div class="ms-lab'+(lft?' lft':'')+'" style="'+(lft?'right:'+(width-x)+'px;':'left:'+x+'px;')+'top:'+cy+'px;transform:translateY(-50%);">'
    +'<div class="t">'+t+'</div><div class="n">'+f.disp+'<span class="fn">'+esc(f.name)+'</span>'+(t==='天格'?'':chip(f.rating))+'</div></div>';
  h+=lab(labX,((0+seiEnd+1)/2)*H,'天格',g.ten,false);
  h+=lab(labX,(seiEnd+1)*H,'人格',g.jin,false);
  h+=lab(labX,((meiStart+lastI+1)/2)*H,'地格',g.chi,false);
  h+=lab(LL-2,(rows.length/2)*H,'外格',g.gai,true);
  const ms=$('meishiki');
  ms.style.width=width+'px';ms.style.height=height+'px';
  ms.innerHTML=h;
  $('msFoot').innerHTML='総格 <b>'+g.sou.disp+'</b> '+esc(g.sou.name)+'　'+chip(g.sou.rating);
}

/* --- 五格 --- */
const KAKU_META={
  ten:['天格','祖運 ─ 家系から受け継ぐ運','姓の画数の合計です。家系・先祖から受け継ぐ環境の運を示します。同じ姓の人に共通する部分のため、この格だけでは吉凶を判断しません。'],
  jin:['人格','主運 ─ 性格の中核と中年期','姓の末字と名の頭字を足した数です。その人の性格の中核と、人生の中心期（およそ30〜50代）の運勢を示す、鑑定の要です。'],
  chi:['地格','初年運 ─ 資質と若年期','名の画数の合計です。生まれ持った資質・才能の土台と、若年期（およそ20代まで）の運勢を示します。'],
  gai:['外格','助運 ─ 対人・社会との縁','総格から人格を除いた数です。対人関係や社会との縁、周囲からの助けのあらわれ方を示します。'],
  sou:['総格','総運 ─ 生涯・晩年の運勢','姓名すべての画数の合計です。生涯全体の流れ、とくに晩年（およそ50代から）の運勢を示します。']
};
const KAKU_ADVICE={
  jin:{
    '大吉':'主運が大吉であることは、この鑑定でもっとも心強い点です。人生の中心期に向かって、持ち前の力が素直に伸びていく形です。',
    '吉':'主運は堅実な吉数です。派手さよりも積み重ねが実を結ぶ形で、中年期に確かな充実を迎えやすいでしょう。',
    '半吉':'主運は吉に進める半々の数です。数意の示す長所を意識して使うことで、運の振れ幅を良い側へ寄せていけます。',
    '半凶':'主運はやや凶に近づく半々の数です。数意の示す注意どころを早めに知って備えることで、振れ幅を良い側へ戻していけます。',
    '凶':'主運の凶数は「性格の癖への注意信号」と読むのが伝統的な見方です。示された弱点を知って備えるだけでも流れは変わるとされます。'
  },
  sou:{
    '大吉':'総運が大吉で、人生の後半に向かうほど運が熟していく形です。晩年の安泰を支える、たいへん心強い土台です。',
    '吉':'総運は良好です。歩みを重ねるほど土台が固まり、穏やかな晩年へつながっていく形です。',
    '半吉':'総運は吉に進める半々の形です。中年までに築く備えと信用が、そのまま晩年の安心につながります。',
    '半凶':'総運はやや凶に寄る半々の形です。中年までに固める備えと健康への配慮が、晩年の安定をしっかり支えてくれます。',
    '凶':'総格の凶数は、生涯の「気をつけどころ」を示すものです。堅実な選択と健康への配慮を重ねることで、十分に穏やかな流れを築けるとされます。'
  },
  chi:{
    '大吉':'若年期の運がたいへん良く、才能の土台をのびのびと育てられる形です。若いうちに身につけたものが生涯の財産になります。',
    '吉':'初年運は良好です。学びや経験を素直に吸収できる若年期となりやすく、その蓄えが後年の歩みを支えます。',
    '半吉':'初年運はおおむね穏やかですが、ややむらの出やすい形です。若いうちの習慣づくりと基礎固めが、後年に大きく効いてきます。',
    '半凶':'初年運はやや不安定に傾く形ですが、若いうちの基礎固めと良い習慣づくりが、後年の確かな支えとなります。',
    '凶':'若年期にやや苦労の出やすい形ですが、それは早くから鍛えられることの裏返しでもあります。成人後は人格・総格が運の主役となるため、過度な心配は無用です。'
  },
  gai:{
    '大吉':'対人運・援助運がたいへん強く、良い縁と引き立てに恵まれる形です。人との関わりの中で道が開けていきます。',
    '吉':'対人運は良好です。周囲との縁が追い風となり、困ったときには助け手があらわれやすいでしょう。',
    '半吉':'対人運はまずまずですが、環境や相手によって明暗が分かれやすい形です。良い縁を選んで深める意識が大切です。',
    '半凶':'対人面ではやや波の出やすい形です。縁を広げるより、信頼できる相手を選んで深めることが何よりの守りになります。',
    '凶':'対人面で気疲れや行き違いの生じやすい形とされます。無理に八方へ合わせるより、信頼できる少数との縁を深めることが開運の近道です。'
  }
};
function kakuCalc(k,g){
  const f=r=>r.ch+'('+r.strokes+')';
  const rei='霊数(1)';
  const sei=resolved.sei,mei=resolved.mei;
  let a;
  if(k==='ten'){a=sei.map(f);if(g.reiSei)a.unshift(rei);}
  else if(k==='chi'){a=mei.map(f);if(g.reiMei)a.push(rei);}
  else if(k==='jin'){a=[f(sei[sei.length-1]),f(mei[0])];}
  else if(k==='sou'){a=sei.map(f).concat(mei.map(f));}
  else{a=[];if(g.reiSei)a.push(rei);a.push(...sei.slice(0,-1).map(f));a.push(...mei.slice(1).map(f));if(g.reiMei)a.push(rei);}
  return a.join('＋');
}
function renderGokaku(g,sex){
  const order=['jin','sou','chi','gai','ten'];
  $('gkGrid').innerHTML=order.map(k=>{
    const f=g[k],m=KAKU_META[k];
    const isTen=k==='ten';
    const fem=(!isTen&&sex==='f'&&f.fem)?'<p class="fem"><span class="l">女性の運</span>'+esc(f.fem)+'</p>':'';
    const adv=isTen?'':(f.adjusted
      ?'この凶は「弱い」のではなく「強すぎる」ことへの戒めです。強さを和らげ、家庭や周囲との調和に心を配ることが開運の鍵とされます。'
      :(KAKU_ADVICE[k][f.rating]||''));
    const wrap=f.num!==f.disp?'（81数理では'+f.disp+'として鑑定）':'';
    const dts=isTen?'':'<div class="dts">'
      +[['仕事',f.work],['金運',f.money],['対人',f.social],['健康',f.health],['心得',f.care]].map(([l,t])=>
        '<div class="dt"><span class="l">'+l+'</span><span>'+esc(t)+'</span></div>').join('')
      +'</div>';
    return '<div class="gk">'
      +'<div class="top"><span class="kaku">'+m[0]+'</span><span class="role">'+m[1]+'</span>'
      +'<span class="num">'+f.disp+'<small>画</small></span></div>'
      +'<div class="calc">'+esc(kakuCalc(k,g))+'＝'+f.num+wrap+'</div>'
      +'<div class="desc">'+esc(m[2])+'</div>'
      +'<div class="fname">'+esc(f.name)+(isTen?'':'　'+chip(f.rating))+'</div>'
      +(isTen?'':'<p>'+esc(f.text)+'</p>'+fem+dts+(adv?'<p class="adv">'+esc(adv)+'</p>':'')
        +(f.note?'<p class="note">※'+esc(f.note)+'</p>':''))
      +'</div>';
  }).join('');
}

/* --- 陰陽 --- */
function renderInyo(iy){
  $('iyPat').textContent=iy.pattern;
  $('iyName').textContent='〈'+iy.name+'〉';
  $('iyChip').innerHTML=chip(iy.rating);
  $('iyText').textContent=iy.text;
}

/* --- 三才 --- */
function renderSansai(sz){
  const tile=(t,e)=>'<div class="sz-el el-'+e+'"><div class="e">'+e+'</div><div class="t">'+t+'</div></div>';
  const arrow=(m,rel)=>'<div class="sz-arrow"><div class="m">'+m+'</div><div>'+rel+'</div></div>';
  $('szFlow').innerHTML=
    tile('天格',sz.elems.ten)+arrow(sz.seiko.mark,sz.seiko.rel)
    +tile('人格',sz.elems.jin)+arrow(sz.kiso.mark,sz.kiso.rel)
    +tile('地格',sz.elems.chi);
  $('szSeiko').innerHTML=esc(sz.seiko.text)+' '+chip(sz.seiko.rating);
  $('szKiso').innerHTML=esc(sz.kiso.text)+' '+chip(sz.kiso.rating);
  $('szTotal').innerHTML=esc(sz.text)+' '+chip(sz.rating);
}

/* ===== イベント ===== */
['seiIn','meiIn'].forEach(id=>{
  const el=$(id);
  el.addEventListener('input',e=>{if(e.isComposing)return;renderCards();if(hasRun&&canRun())compute(false);});
  el.addEventListener('compositionend',()=>{renderCards();if(hasRun&&canRun())compute(false);});
  el.addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('runBtn').disabled){e.preventDefault();compute(true);}});
});
$('runBtn').addEventListener('click',()=>compute(true));
document.querySelectorAll('input[name="sexIn"]').forEach(r=>{
  r.addEventListener('change',()=>{if(hasRun&&canRun())compute(false);});
});
[['optKyu','kyu'],['optBushu','bushu'],['optSuii','suii']].forEach(([id,k])=>{
  $(id).checked=OPTS[k];
  $(id).addEventListener('change',e=>{OPTS[k]=e.target.checked;saveOpts();renderCards();if(hasRun&&canRun())compute(false);});
});
let rsT=null;
window.addEventListener('resize',()=>{if(!hasRun||!last)return;clearTimeout(rsT);rsT=setTimeout(()=>renderMeishiki(last.g),200);});
