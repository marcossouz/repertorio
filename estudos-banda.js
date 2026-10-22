/* ================= improviso e leitura de banda =================

   Os dois assuntos que faltavam no módulo, e que não cabem no formato
   "mostra o acorde, você toca, acertou ou não". Aqui não existe resposta certa
   por acorde — existe COMPORTAMENTO ao longo de uma passagem. Então a medida
   muda: em vez de acerto por item, estatística sobre 16 compassos.

   O que salva os dois de virarem cronômetro com texto na tela é que o teclado
   entrega dados suficientes para medir exatamente o que se ensina de boca:

   - "toque só notas do acorde"  ->  % de notas dentro do conjunto permitido
   - "deixe espaço"              ->  % de tempos sem nenhuma nota
   - "não toque demais"          ->  notas por compasso
   - "saia do caminho do baixo"  ->  quantas notas abaixo do piso
   - "entre quando for chamado"  ->  ms entre a deixa e a primeira nota

   Cada exercício declara METAS explícitas. A nota é a fração de metas batidas,
   e o relatório mostra o número de cada uma — de propósito: o valor de ensino
   está em ver "silêncio 8%" e entender por que o fundo está atravancado, não
   em ganhar um 73 que não explica nada. */

let BANDA_DRILLS=[],bandaRun=null;

const BANDA_PISO=52;        /* abaixo de E3 é território do baixista */
const BANDA_COMPASSOS=16;   /* passagem curta o bastante para repetir */

function bandaStats(id){
 const r=(state.banda||{})[id]||{};
 return{runs:r.runs||0,best:r.best||0,last:r.last||0};
}
function bandaRecord(id,nota){
 state.banda=state.banda||{};
 const r=state.banda[id]||{runs:0,best:0,last:0};
 r.runs++;r.last=nota;r.best=Math.max(r.best||0,nota);
 state.banda[id]=r;saveState();
}
function bandaGroupLabel(g){return g==='improviso'?'Improviso':'Banda'}

/* ---------- conjunto de notas permitido ---------- */
function bandaPermitido(restr,c,keyName){
 if(!restr||restr==='free')return null;
 const pc=n=>((n%12)+12)%12;
 if(restr==='chord')return new Set([...(c.left||[]),...(c.right||[])].map(pc));
 const base=(KEYS[keyName]||KEYS.C).offset;
 const graus=restr==='penta'?[0,2,4,7,9]:Graus.MAJOR_STEPS;
 return new Set(graus.map(g=>pc(base+g)));
}

/* ---------- captura ---------- */
function bandaMidi(cmd,note,vel){
 if(!bandaRun||!bandaRun.rodando)return;
 if(!(cmd===0x90&&vel>0))return;
 const t=performance.now()-bandaRun.t0;
 bandaRun.notas.push({note,vel,t,compasso:bandaRun.compasso,tempo:bandaRun.tempoAbs});
 const b=bandaRun.barras[bandaRun.compasso];
 if(b){
  b.onsets++;
  if(note<BANDA_PISO)b.graves++;
  if(b.reacao==null&&b.deixa&&b.deixa!=='sai')b.reacao=Math.round(t-b.t0);
  const perm=bandaRun.permitido;
  if(perm){b.total++;if(perm.has(((note%12)+12)%12))b.dentro++}
 }
 /* nada na tela ao vivo muda por nota — só por compasso. Redesenhar aqui
    seria dezenas de innerHTML por segundo com as mãos no teclado. */
}

/* ---------- execução ---------- */
function startBanda(id){
 const dr=BANDA_DRILLS.find(x=>x.id===id);if(!dr)return;
 if(window.Metronomo)Metronomo.liberar();
 if(bandaRun)stopBanda(true);
 const prog=bandaProgressao(dr),keys=trainingKeys();
 bandaRun={
  dr,prog,key:keys[Math.floor(Math.random()*keys.length)],
  bpm:dr.bpm||72,compasso:-1,tempoAbs:-1,notas:[],barras:[],
  rodando:true,t0:performance.now()
 };
 openOverlay('banda-overlay');
 renderBandaLive();
 startClock({bpm:()=>bandaRun.bpm,sub:()=>1,level:n=>(n%4===0?2:1),onTick:bandaTick});
}
function bandaProgressao(dr){
 const alvo=dr.prog&&exercises.find(e=>e.id===dr.prog);
 if(alvo)return alvo;
 const pool=exercises.filter(e=>e.level==='Fundamento');
 return (pool.length?pool:exercises)[0];
}
function bandaTick(n){
 if(!bandaRun||!bandaRun.rodando)return;
 bandaRun.tempoAbs=n;
 const compasso=Math.floor(n/4);
 if(compasso===bandaRun.compasso)return;
 if(compasso>=BANDA_COMPASSOS)return finishBanda();
 bandaRun.compasso=compasso;
 const dr=bandaRun.dr;
 const deixa=dr.cues&&dr.cues.length?dr.cues[Math.floor(Math.random()*dr.cues.length)]:null;
 bandaRun.barras[compasso]={
  onsets:0,graves:0,dentro:0,total:0,reacao:null,deixa,
  t0:performance.now()-bandaRun.t0
 };
 /* o acompanhamento é o que torna isto ensaio e não exercício de mesa */
 const passos=bandaRun.prog.ids,cid=passos[compasso%passos.length];
 const c=chordInKey(cid,bandaRun.key);
 bandaRun.acorde=c;
 bandaRun.permitido=bandaPermitido(dr.restr,c,bandaRun.key);
 if(!dr.mudo)playChordOf(c,{duration:4*60/bandaRun.bpm*.9});
 renderBandaLive();
}
function stopBanda(silencioso){
 stopBeat();
 if(bandaRun)bandaRun.rodando=false;
 if(!silencioso){bandaRun=null;closeOverlay('banda-overlay');renderBanda()}
}

/* ---------- medição ---------- */
function bandaMetricas(){
 const r=bandaRun,barras=r.barras.filter(Boolean),notas=r.notas;
 const compassos=barras.length||1,tempos=compassos*4;
 const comNota=new Set(notas.map(x=>x.tempo));
 const dentro=barras.reduce((a,b)=>a+b.dentro,0),total=barras.reduce((a,b)=>a+b.total,0);
 const reacoes=barras.map(b=>b.reacao).filter(v=>v!=null);
 const alturas=notas.map(x=>x.note);
 const passo=60000/r.bpm;
 let frases=0;
 for(let i=1;i<notas.length;i++)if(notas[i].t-notas[i-1].t>=passo)frases++;
 return{
  dentro:total?Math.round(dentro/total*100):null,
  densidade:Math.round(notas.length/compassos*10)/10,
  silencio:Math.round((1-comNota.size/tempos)*100),
  ambito:alturas.length?Math.max(...alturas)-Math.min(...alturas):0,
  frases:notas.length?frases+1:0,
  graves:barras.reduce((a,b)=>a+b.graves,0),
  obediencia:barras.length?Math.round(barras.filter(bandaBarraOk).length/barras.length*100):0,
  reacao:reacoes.length?Math.round(reacoes.reduce((a,b)=>a+b,0)/reacoes.length):null,
  notas:notas.length
 };
}
function bandaBarraOk(b){
 if(b.deixa==='sai')return b.onsets===0;
 if(b.deixa==='pad')return b.onsets>0&&b.onsets<=2;
 if(b.deixa==='base')return b.graves>0;
 if(b.deixa==='toca')return b.onsets>0;
 return true;
}
function bandaMetaOk(meta,m){
 const v=m[meta.k];
 if(v==null)return false;
 return meta.op==='>='?v>=meta.v:meta.op==='<='?v<=meta.v:v===meta.v;
}
function finishBanda(){
 if(!bandaRun)return;
 stopBeat();
 bandaRun.rodando=false;
 const m=bandaMetricas(),metas=bandaRun.dr.metas||[];
 const batidas=metas.filter(x=>bandaMetaOk(x,m)).length;
 const nota=metas.length?Math.round(batidas/metas.length*100):0;
 bandaRun.relatorio={m,metas,batidas,nota};
 bandaRecord(bandaRun.dr.id,nota);
 renderBandaLive();
}

/* ---------- tela ---------- */
function bandaValor(k,m){
 const v=m[k];
 if(v==null)return '—';
 return k==='dentro'||k==='silencio'||k==='obediencia'?`${v}%`
  :k==='reacao'?`${v} ms`
  :k==='ambito'?`${v} st`
  :String(v);
}
function renderBanda(){
 const grid=document.getElementById('banda-grid');
 if(!grid)return;
 grid.innerHTML=BANDA_DRILLS.map(dr=>{
  const st=bandaStats(dr.id),ativo=bandaRun&&bandaRun.dr.id===dr.id;
  return`<article class="ear-card${ativo?' live':''}">
   <div class="path-top"><span class="path-icon">${dr.icon}</span><span class="tag">${bandaGroupLabel(dr.group)}</span></div>
   <h3>${esc(dr.name)}</h3><p>${esc(dr.desc)}</p>
   <div class="path-meta"><span>${st.runs?`${st.runs} ${st.runs===1?'passagem':'passagens'}`:'sem histórico'}</span><b>${st.best?`recorde ${st.best}`:''}</b></div>
   <div class="progress"><i style="width:${st.last}%"></i></div>
   <button class="btn primary" onclick="startBanda('${dr.id}')">${ativo?'Recomeçar':'Tocar 16 compassos'}</button>
  </article>`}).join('');
}
function renderBandaLive(){
 const box=document.getElementById('banda-live');
 if(!box||!bandaRun)return;
 const dr=bandaRun.dr;
 if(bandaRun.relatorio){
  const{m,metas,nota}=bandaRun.relatorio;
  box.innerHTML=`<div class="eyebrow">${esc(dr.name)} · ${esc(bandaRun.key)}</div>
   <h2 style="margin:4px 0 10px">${nota}%</h2>
   <div class="banda-metas">${metas.map(meta=>{
    const ok=bandaMetaOk(meta,m);
    return`<div class="banda-meta ${ok?'ok':'no'}"><b>${bandaValor(meta.k,m)}</b><span>${esc(meta.label)}</span></div>`;
   }).join('')}</div>
   <p class="muted" style="margin-top:12px">${esc(dr.fecho||'')}</p>
   <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn primary" onclick="startBanda('${dr.id}')">De novo</button>
    <button class="btn" onclick="stopBanda()">Fechar</button>
   </div>`;
  return;
 }
 const c=bandaRun.acorde,b=bandaRun.barras[bandaRun.compasso];
 /* Palavra curta: o que se lê de canto de olho é o formato da palavra inteira,
    e "COBRE O BAIXO" em corpo grande não cabe nem é reconhecível de relance. */
 const deixaTxt={sai:'SAI',toca:'ENTRA',pad:'PAD',base:'BAIXO'};
 box.innerHTML=`<div class="eyebrow">${esc(dr.name)} · tom de ${esc(bandaRun.key)} · ${bandaRun.bpm} BPM</div>
  ${b&&b.deixa?`<div class="banda-deixa ${b.deixa}">${deixaTxt[b.deixa]||b.deixa}</div>`:''}
  <div class="banda-acorde">${c?esc(c.name):'—'}</div>
  <div class="banda-compasso">compasso ${Math.max(0,bandaRun.compasso)+1} <small>de ${BANDA_COMPASSOS}</small></div>
  <p class="muted" style="font-size:12px;margin-top:10px">${esc(dr.live||'')}</p>
  <div style="margin-top:12px"><button class="btn" onclick="stopBanda()">Parar</button></div>`;
}

/* ================= leitura à primeira vista =================

   Todo o resto do módulo traz de volta o que você já estudou — a fila de revisão
   existe para isso. Aqui é o contrário: sorteia uma música que você NUNCA abriu,
   anuncia o tom e rola a cifra no tempo. É o que acontece quando entra música
   nova no domingo.

   Duas decisões que definem o exercício:

   MOSTRAR ADIANTE. A tira exibe o acorde atual e os próximos quatro. Ler à
   primeira vista é ler adiante — se a tela mostrasse só o acorde da vez, isto
   treinaria reação, não leitura.

   COBRAR O NÚCLEO, NÃO O VOICING. Na primeira passada o que importa é acertar
   fundamental e qualidade. Sétima, nona e inversão são refinamento de segunda
   leitura; exigi-las aqui reprovaria quem está lendo certo. Notas a mais não
   contam como erro. */

let leituraRun=null;
const LEITURA_ADIANTE=4;     /* quantos acordes aparecem à frente do atual */
const LEITURA_MIN=8;         /* música curta demais não testa leitura */
const NUCLEO={
 '':[0,4,7],'m':[0,3,7],'m7':[0,3,7],'maj7':[0,4,7],'7':[0,4,7],
 'm7b5':[0,3,6],'°':[0,3,6],'°7':[0,3,6],'add9':[0,4,7],'sus2':[0,2,7],
 'sus4':[0,5,7],'aug':[0,4,8],'add11':[0,4,7],'m9':[0,3,7]
};
/* parseLine devolve a fundamental RELATIVA à tônica (0 = tônica), e o MIDI
   chega em classe de altura absoluta. Sem somar o tom, o grau 5 em B viraria G:
   o exercício ficaria impossível de acertar e a culpa pareceria do leitor. */
function leituraNucleo(ch,keyName){
 const base=NUCLEO[ch.quality]||[0,4,7];
 const tom=(KEYS[keyName]||KEYS.C).offset;
 return base.map(i=>(((tom+ch.root+i)%12)+12)%12);
}
function leituraStats(){
 const l=state.leitura||{};
 const lidas=Object.keys(l).length;
 const pcts=Object.values(l).map(x=>x.pct).filter(v=>typeof v==='number');
 return{lidas,media:pcts.length?Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length):null};
}
/* Candidatas: com tom, com cifra suficiente, e nunca lidas. Esgotadas as novas,
   volta a mais antiga — mas o card avisa que já não é primeira vista. */
function leituraCandidatas(){
 const lidas=state.leitura||{};
 const aptas=(SONGS||[]).filter(s=>songKeyName(s)&&songChords(s).seq.length>=LEITURA_MIN);
 const novas=aptas.filter(s=>!lidas[s.id]);
 return{aptas,novas};
}
function startLeitura(){
 const{aptas,novas}=leituraCandidatas();
 if(!aptas.length)return;
 const pool=novas.length?novas
  :[...aptas].sort((a,b)=>String((state.leitura[a.id]||{}).data||'').localeCompare(String((state.leitura[b.id]||{}).data||'')));
 const song=pool[novas.length?Math.floor(Math.random()*pool.length):0];
 const key=songKeyName(song),{seq}=songChords(song);
 if(window.Metronomo)Metronomo.liberar();
 if(leituraRun)stopLeitura(true);
 leituraRun={
  song,key,seq:seq.slice(0,32),primeira:!novas.length?false:true,
  bpm:64,compasso:-1,contagem:2,passos:[],rodando:true,t0:performance.now()
 };
 openOverlay('leitura-overlay');
 renderLeituraLive();
 startClock({bpm:()=>leituraRun.bpm,sub:()=>1,level:n=>(n%4===0?2:1),onTick:leituraTick});
}
function leituraTick(n){
 const r=leituraRun;
 if(!r||!r.rodando)return;
 const compasso=Math.floor(n/4)-r.contagem;
 if(compasso===r.compasso)return;
 if(compasso>=r.seq.length)return finishLeitura();
 r.compasso=compasso;
 if(compasso>=0)r.passos[compasso]={t0:performance.now()-r.t0,ok:false,atraso:null};
 renderLeituraLive();
}
function leituraMidi(){
 const r=leituraRun;
 if(!r||!r.rodando||r.compasso<0)return;
 const passo=r.passos[r.compasso];
 if(!passo||passo.ok)return;
 const alvo=leituraNucleo(r.seq[r.compasso],r.key);
 const tocado=new Set([...midiHeld].map(n=>(((n%12)+12)%12)));
 /* notas a mais são bem-vindas; o que conta é não faltar nenhuma do núcleo */
 if(alvo.some(p=>!tocado.has(p)))return;
 passo.ok=true;
 passo.atraso=Math.round(performance.now()-r.t0-passo.t0);
 renderLeituraLive();
}
function leituraMetricas(){
 const p=leituraRun.passos.filter(Boolean);
 const ok=p.filter(x=>x.ok),atrasos=ok.map(x=>x.atraso);
 return{
  total:p.length,
  pegos:p.length?Math.round(ok.length/p.length*100):0,
  acertos:ok.length,
  atraso:atrasos.length?Math.round(atrasos.reduce((a,b)=>a+b,0)/atrasos.length):null,
  travou:p.length-ok.length
 };
}
function finishLeitura(){
 const r=leituraRun;
 if(!r)return;
 stopBeat();r.rodando=false;
 const m=leituraMetricas();
 r.relatorio=m;
 state.leitura=state.leitura||{};
 const ant=state.leitura[r.song.id]||{n:0};
 state.leitura[r.song.id]={n:(ant.n||0)+1,pct:m.pegos,data:new Date().toISOString()};
 saveState();
 renderLeituraLive();
}
function stopLeitura(silencioso){
 stopBeat();
 if(leituraRun)leituraRun.rodando=false;
 if(!silencioso){leituraRun=null;closeOverlay('leitura-overlay');renderLeituraCard()}
}
function leituraTira(){
 const r=leituraRun,out=[];
 for(let i=Math.max(0,r.compasso-1);i<Math.min(r.seq.length,Math.max(0,r.compasso)+LEITURA_ADIANTE+1);i++){
  const p=r.passos[i],cls=i===r.compasso?'agora':(i<r.compasso?(p&&p.ok?'feito':'perdido'):'');
  out.push('<span class="leitura-grau '+cls+'">'+esc(r.seq[i].token)+'</span>');
 }
 return out.join('');
}
function renderLeituraLive(){
 const box=document.getElementById('leitura-live');
 const r=leituraRun;
 if(!box||!r)return;
 if(r.relatorio){
  const m=r.relatorio;
  box.innerHTML='<div class="eyebrow">'+esc(r.song.title)+' · tom de '+esc(r.key)+'</div>'+
   '<h2 style="margin:4px 0 12px">'+m.pegos+'%</h2>'+
   '<div class="banda-metas">'+
    '<div class="banda-meta '+(m.pegos>=70?'ok':'no')+'"><b>'+m.acertos+'/'+m.total+'</b><span>acordes pegos na primeira passada</span></div>'+
    '<div class="banda-meta '+(m.atraso!=null&&m.atraso<=700?'ok':'no')+'"><b>'+(m.atraso==null?'—':m.atraso+' ms')+'</b><span>atraso médio dentro do compasso</span></div>'+
    '<div class="banda-meta '+(m.travou===0?'ok':'no')+'"><b>'+m.travou+'</b><span>acordes que você não alcançou</span></div>'+
   '</div>'+
   '<p class="muted" style="margin-top:12px">Ler à primeira vista melhora com quilometragem, não com repetição: da próxima vez vem outra música.</p>'+
   '<div style="display:flex;gap:8px;margin-top:14px">'+
    '<button class="btn primary" onclick="startLeitura()">Outra música</button>'+
    '<button class="btn" onclick="stopLeitura()">Fechar</button></div>';
  return;
 }
 const contando=r.compasso<0;
 box.innerHTML='<div class="eyebrow">'+esc(r.song.title)+' · '+r.bpm+' BPM'+(r.primeira?'':' · releitura')+'</div>'+
  '<div class="leitura-tom">Tom de '+esc(r.key)+'</div>'+
  (contando?'<div class="leitura-contagem">prepare-se…</div>':'<div class="leitura-tira">'+leituraTira()+'</div>')+
  '<div class="banda-compasso">compasso '+(Math.max(0,r.compasso)+1)+' <small>de '+r.seq.length+'</small></div>'+
  '<p class="muted" style="font-size:12px;margin-top:10px">Fundamental e qualidade bastam. Olhe à frente, não para a mão.</p>'+
  '<div style="margin-top:12px"><button class="btn" onclick="stopLeitura()">Parar</button></div>';
}
function renderLeituraCard(){
 const box=document.getElementById('leitura-card');
 if(!box)return;
 const{aptas,novas}=leituraCandidatas();
 const st=leituraStats();
 if(!aptas.length){box.innerHTML='';return}
 box.innerHTML='<div class="review-main">'+
  '<div class="eyebrow">Leitura à primeira vista</div>'+
  '<h2>'+(novas.length?novas.length+' música'+(novas.length===1?'':'s')+' que você nunca abriu aqui':'Todas já lidas — vem a mais antiga')+'</h2>'+
  '<p class="muted">Sorteia uma cifra, anuncia o tom e rola no tempo. Precisa do teclado MIDI.'+
   (st.lidas?' Já leu '+st.lidas+', média '+st.media+'%.':'')+'</p>'+
  '<div class="review-actions"><button class="btn primary" onclick="startLeitura()">Ler uma agora</button></div>'+
  '</div>';
}
