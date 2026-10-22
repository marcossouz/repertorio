/* Treino de ouvido e repertório como material de estudo.

   Três trabalhos: o modo ouvido da sessão, os drills (qualidade, intervalo,
   função, ditado, cantar) e a leitura do cifras.json para virar treino —
   o mesmo parser do módulo de cifras, via graus.js. */

/* ================= treino de ouvido ================= */
function toggleEar(){
 if(!session)return;
 session.ear=!session.ear;session.earRevealed=false;
 renderSession();
 if(session.ear)playCurrentChord();
}
function revealEar(){if(!session)return;session.earRevealed=true;renderSession()}
/* ================= repertório: cifras.json vira treino =================
   O parser abaixo é um porte fiel do cifras.html: mesma expressão de token,
   mesma tabela de qualidades e o mesmo baixo relativo ao acorde. Se as duas
   leituras divergirem, o aluno estuda um acorde diferente do que vai tocar. */
let SONGS=[],REPERTOIRES=[],songsState='idle',songsError='',songsSource='',songFilter='all',songQuery='';
const CIFRAS_DB='cifras-app',CIFRAS_STORE='library',CIFRAS_KEY='main';
const songSpecs=new Map();
/* Regras de leitura de graus vêm do graus.js, o mesmo arquivo que o módulo de
   cifras usa — é o que garante que os dois leiam a mesma coisa. */
function songKeyInfo(value){return Graus.keyInfo(value)}
function songKeyName(song){const info=songKeyInfo(song&&song.key);return info?keyFromNote(info.root):null}
function parseDegreeLine(text,minor){return Graus.parseLine(text,minor)}
function songChords(song){
 const minor=!!(songKeyInfo(song&&song.key)||{}).minor,seq=[];
 (song.verses||[]).forEach(v=>parseDegreeLine(v.chords,minor).forEach(c=>{
  const last=seq[seq.length-1];
  if(!last||last.token!==c.token)seq.push(c);
 }));
 const vistos=new Set(),unicos=[];
 seq.forEach(c=>{if(!vistos.has(c.token)){vistos.add(c.token);unicos.push(c)}});
 return{seq,unicos};
}
/* qualidade -> voicing do módulo (reaproveita o que já foi validado) */
const REP_TEMPLATE={'':'triad_I','m':'minor_root','m7':'minor7_drop2','maj7':'maj7_drop2','7':'dominant7_drop2','m7b5':'half_dim_drop2','°7':'dim7_drop2','°':'triad_vii_dim','add9':'add9_open','sus2':'sus2_pad','aug':'augmented_triad','m9':'tonic_minor9'};
const REP_SYNTH={
 sus4:{suffix:'sus4',right:[60,65,67],rh:'1–2–5',function:'Suspensão da terça pela quarta.'},
 add11:{suffix:'add11',right:[60,64,67,77],rh:'1–2–3–5',function:'Tríade maior com a 11ª no topo.'},
 'm6':{suffix:'m6',right:[60,63,67,69],rh:'1–2–3–5',function:'Menor com a 6ª maior — fim do clichê de linha.'},
 'm(maj7)':{suffix:'m(maj7)',right:[60,63,67,71],rh:'1–2–3–5',function:'Menor com a 7ª maior — passo do clichê de linha.'},
 '7sus4':{suffix:'7sus4',right:[60,65,67,70],rh:'1–2–3–5',function:'Dominante suspensa: a 4ª no lugar da terça, com a 7ª.'}
};
function specFromChord(ch,id){
 let base;
 const tplId=REP_TEMPLATE[ch.quality];
 if(tplId){
  const t=VOICING_TEMPLATES.find(v=>v.id===tplId);
  const shift=(((ch.root-t.root)%12)+12)%12;
  base={...t,root:ch.root,left:t.left.map(n=>n+shift),right:t.right.map(n=>n+shift)};
 }else{
  const syn=REP_SYNTH[ch.quality]||REP_SYNTH.sus4;
  base={suffix:syn.suffix,root:ch.root,left:[48+ch.root],right:syn.right.map(n=>n+ch.root),rh:syn.rh,lh:'5',groups:['progression'],function:syn.function,care:['Acorde vindo direto da cifra do repertório.']};
 }
 if(ch.slash!==undefined){base.left=[48+ch.slash];base.lh='5';base.slash=ch.slash}
 base.id=id;base.degree=ch.token;base.level='Repertório';
 base.title=`Grau ${ch.token}`;
 base.tip=base.tip||'Toque como na música e conduza para o próximo acorde pelo menor caminho.';
 songSpecs.set(id,base);
 return base;
}
function songQueue(song,ids){
 songSpecs.clear();
 return ids.map((ch,i)=>{const id=`song:${song.id}:${i}`;specFromChord(ch,id);return id});
}
/* O cifras.json empacotado é só a semente: depois da primeira carga, a biblioteca
   viva do módulo de cifras fica no IndexedDB da mesma origem. Ler de lá é o que
   faz as músicas que você edita aparecerem aqui sem precisar reempacotar o app. */
function songsFromDb(){
 return new Promise(resolve=>{
  try{
   if(typeof indexedDB==='undefined'||!indexedDB)return resolve(null);
   const req=indexedDB.open(CIFRAS_DB);
   let inexistente=false;
   req.onupgradeneeded=()=>{inexistente=true;try{req.transaction.abort()}catch(e){}};
   req.onerror=()=>resolve(null);
   req.onblocked=()=>resolve(null);
   req.onsuccess=()=>{
    const db=req.result;
    if(inexistente||!db.objectStoreNames.contains(CIFRAS_STORE)){db.close();return resolve(null)}
    try{
     const pedido=db.transaction(CIFRAS_STORE).objectStore(CIFRAS_STORE).get(CIFRAS_KEY);
     pedido.onsuccess=()=>{db.close();resolve(pedido.result||null)};
     pedido.onerror=()=>{db.close();resolve(null)};
    }catch(e){db.close();resolve(null)}
   };
  }catch(e){resolve(null)}
 });
}
let songsPromise=null;
function ensureSongs(force){
 if(songsState==='ready'&&!force)return Promise.resolve();
 if(songsPromise)return songsPromise;
 songsPromise=loadSongs(songsState==='ready');
 return songsPromise;
}
async function loadSongs(silencioso){
 if(!silencioso){songsState='loading';renderSongs()}
 try{
  let dados=await songsFromDb(),origem='app';
  if(!dados||!Array.isArray(dados.songs)||!dados.songs.length){
   const res=await fetch('cifras.json',{cache:'no-cache'});
   if(!res.ok)throw new Error('HTTP '+res.status);
   dados=await res.json();origem='arquivo';
  }
  SONGS=(Array.isArray(dados.songs)?dados.songs:[]).filter(s=>s&&s.title&&songKeyName(s));
  REPERTOIRES=Array.isArray(dados.repertoires)?dados.repertoires:[];
  songsSource=origem;songsState='ready';songsError='';
 }catch(e){songsState='error';songsError=e.message||String(e)}
 songsPromise=null;
 renderSongs();
}
function songList(){
 const q=songQuery.trim().toLowerCase();
 let list=SONGS;
 if(songFilter!=='all'){
  const rep=REPERTOIRES.find(r=>r.id===songFilter);
  const ids=new Set((rep&&rep.songs)||[]);
  list=list.filter(s=>ids.has(s.id));
 }
 if(q)list=list.filter(s=>String(s.title).toLowerCase().includes(q));
 return list;
}
function renderSongs(){
 const grid=document.getElementById('song-grid');if(!grid)return;
 const sel=document.getElementById('rep-filter');
 if(sel&&sel.options.length<=1&&REPERTOIRES.length){
  sel.innerHTML='<option value="all">Todos os repertórios</option>'+REPERTOIRES.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
  sel.value=songFilter;
 }
 if(typeof renderLeituraCard==='function')renderLeituraCard();
 const fonte=document.getElementById('song-source');
 if(fonte){
  fonte.innerHTML=songsState!=='ready'?'':(songsSource==='app'
   ?`<b>${SONGS.length} músicas</b> lidas da biblioteca do app — o que você editar nas cifras aparece aqui. <button class="link-btn" onclick="ensureSongs(true)">recarregar</button>`
   :`<b>${SONGS.length} músicas</b> lidas do <b>cifras.json</b> empacotado. Abra o módulo de cifras uma vez para o app passar a usar a sua biblioteca viva. <button class="link-btn" onclick="ensureSongs(true)">recarregar</button>`);
 }
 if(songsState==='loading')return void(grid.innerHTML='<div class="empty">Lendo a biblioteca…</div>');
 if(songsState==='error')return void(grid.innerHTML=`<div class="empty">Não foi possível ler o repertório (${esc(songsError)}). Sem biblioteca no app, o módulo cai no <b>cifras.json</b> — que precisa estar no mesmo diretório.</div>`);
 if(songsState!=='ready')return void(grid.innerHTML='<div class="empty">Abra esta aba para carregar o repertório.</div>');
 const list=songList();
 const mod=songsModuleProgress(),stat=document.getElementById('song-module-stat');
 if(stat)stat.innerHTML=moduleStatHtml('Ciclo de 7 dias',mod.pct,mod.detail);
 if(!list.length)return void(grid.innerHTML='<div class="empty">Nenhuma música encontrada.</div>');
 grid.innerHTML=list.map(song=>{
  const key=songKeyName(song),{seq,unicos}=songChords(song);
  if(!seq.length)return '';
  const nomes=unicos.slice(0,8).map(c=>esc(materialize(specFromChord(c,'preview'),'preview',key).name));
  const pr=songProgress(song),status=pr.pct>=100?'good':pr.pct?'learning':'';
  return `<article class="song-card">
   <span class="tag">tom ${esc(key)}${song.key&&song.key!==key?` · escrito ${esc(song.key)}`:''}</span>
   <h3>${esc(song.title)}</h3>
   <div class="degree-line">${seq.slice(0,12).map(c=>esc(c.token)).join(' → ')}${seq.length>12?' …':''}</div>
   <div class="song-notes">${nomes.join(' · ')}${unicos.length>8?' …':''}</div>
   <div class="song-meta">${seq.length} acordes na sequência · ${unicos.length} diferentes</div>
   <div class="mastery ${status}" style="margin:8px 0 4px"><i class="mastery-dot"></i>${pr.pct>=100?'Ciclo completo':pr.pct?`${pr.n}/7 passos`:'Sem progresso'}</div>
   <div class="song-actions">
    <button class="btn" onclick="startSongSession('${esc(song.id)}','sequence')">Sequência em ${esc(key)}</button>
    <button class="btn" onclick="startSongSession('${esc(song.id)}','transpose')">Transpor inteira</button>
    <button class="btn primary" onclick="startSongSession('${esc(song.id)}','keys')">Nos 12 tons</button>
   </div>
   ${songStepsHtml(song)}
  </article>`;
 }).join('');
}
function startSongSession(songId,mode){
 const song=SONGS.find(s=>s.id===songId);if(!song)return;
 const key=songKeyName(song);if(!key)return;
 const {seq,unicos}=songChords(song);
 if(!seq.length)return;
 if(mode==='sequence'){
  const ids=songQueue(song,seq.slice(0,24));
  if(allKeys||studyKey!==key){allKeys=false;studyKey=key;saveState();rebuildHarmony();document.getElementById('study-key').value=key;document.getElementById('cycle-picker').style.display='none';renderDashboard();renderChords();renderExercises();renderScales();renderTechnique()}
  beginSession(ids,song.title,'A sequência da música, no tom em que você toca.',true,ids.map(id=>({id,key})),`song:${song.id}`);
 }else if(mode==='transpose'){
  const outros=CYCLE_ORDERS.chromatic.filter(k=>k!==key);
  const alvo=outros[Math.floor(Math.random()*outros.length)];
  const ids=songQueue(song,seq.slice(0,24));
  allKeys=false;studyKey=alvo;saveState();rebuildHarmony();
  document.getElementById('study-key').value=alvo;document.getElementById('cycle-picker').style.display='none';
  renderDashboard();renderChords();renderExercises();renderScales();renderTechnique();
  beginSession(ids,`${song.title} · em ${alvo}`,`A música inteira fora do tom em que você a aprendeu (escrita em ${key}).`,true,ids.map(id=>({id,key:alvo})),`song:${song.id}`);
 }else{
  const base=unicos.slice(0,6),ids=songQueue(song,base),keys=trainingKeys();
  const queue=keys.flatMap(k=>ids.map(id=>({id,key:k})));
  beginSession(ids,`${song.title} · vocabulário`,'Os acordes desta música em todos os tons.',true,queue,`song:${song.id}`);
 }
}
/* ================= drills de ouvido =================

   O plano pede quatro trabalhos distintos que o "modo ouvido" da sessão não
   cobria: qualidade, intervalo, função e ditado — mais cantar o grau, que
   depende do microfone. Cada um é uma rodada curta com nota registrada, para o
   ouvido ter progresso próprio em vez de virar apêndice dos voicings. */
let EAR_DRILLS=[],earRun=null,earMic=null,earMicRaf=null;

function earStats(id){
 const r=(state.ear||{})[id]||{};
 return{hits:r.hits||0,total:r.total||0,best:r.best||0,pct:r.total?Math.round(r.hits/r.total*100):0};
}
function earRecord(id,ok){
 state.ear=state.ear||{};
 const r=state.ear[id]||{hits:0,total:0,best:0};
 r.total++;if(ok)r.hits++;
 earRun.streak=ok?earRun.streak+1:0;
 r.best=Math.max(r.best||0,earRun.streak);
 state.ear[id]=r;saveState();
}
function micSupported(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&(window.AudioContext||window.webkitAudioContext))}
function earGroupLabel(g){return({start:'Fundamento',applied:'Aplicado',voice:'Voz',structure:'Estrutura'})[g]||'Ouvido'}
const INTERVAL_LABEL={0:'1',1:'b9',2:'9',3:'b3',4:'3',5:'11',6:'#11',7:'5',8:'b13',9:'13',10:'b7',11:'7M'};
const EAR_LIVE_KEY='estudos-ear-live';
function persistEarLive(){
 try{
  if(!earRun)sessionStorage.removeItem(EAR_LIVE_KEY);
  else sessionStorage.setItem(EAR_LIVE_KEY,JSON.stringify({
   id:earRun.dr.id,round:earRun.round,streak:earRun.streak,hits:earRun.hits,
   answered:!!earRun.answered,ok:earRun.ok,entrada:earRun.entrada||[],
   start:earRun.start,tonic:earRun.tonic,pick:earRun.pick,escolha:earRun.escolha,
   cantou:earRun.cantou,alvo:earRun.alvo,prog:earRun.prog||null,voic:earRun.voic||null,opts:earRun.opts||null
  }));
 }catch(e){}
}
function restoreEarLive(){
 if(earRun)return;
 try{
  const s=JSON.parse(sessionStorage.getItem(EAR_LIVE_KEY)||'null');
  if(!s||!s.id)return;
  const dr=EAR_DRILLS.find(x=>x.id===s.id);if(!dr)return;
  earRun={dr,round:s.round||1,streak:s.streak||0,hits:s.hits||0,answered:!!s.answered,ok:s.ok,entrada:s.entrada||[],start:s.start||Date.now(),tonic:s.tonic,pick:s.pick,escolha:s.escolha,cantou:s.cantou,alvo:s.alvo,prog:s.prog,voic:s.voic,opts:s.opts};
 }catch(e){}
}
function resumeEarOverlay(){
 if(!earRun)return;
 if(window.Metronomo)Metronomo.liberar();
 openOverlay('ear-overlay');
 renderEarRound();
 if(earRun.dr.kind==='sing')earStartMic();
 if(!earRun.answered)earPlay();
}
function hideEar(){
 if(!earRun)return closeOverlay('ear-overlay');
 earStopMic();
 persistEarLive();
 closeOverlay('ear-overlay');
 renderEar();
}
function renderEar(){
 const grid=document.getElementById('ear-grid');
 if(!grid)return;
 grid.innerHTML=EAR_DRILLS.map(dr=>{
  const st=earStats(dr.id),bloq=dr.needs==='mic'&&!micSupported();
  const ativo=earRun&&earRun.dr&&earRun.dr.id===dr.id;
  return`<article class="ear-card${bloq?' off':''}${ativo?' live':''}">
   <div class="path-top"><span class="path-icon">${dr.icon}</span><span class="tag">${earGroupLabel(dr.group)}</span></div>
   <h3>${esc(dr.name)}</h3><p>${esc(dr.desc)}</p>
   <div class="path-meta"><span>${st.total?`${st.pct}% em ${st.total}`:'sem histórico'}</span><b>${ativo?`rodada ${earRun.round}`:(st.best?`recorde ${st.best}`:'')}</b></div>
   <div class="progress"><i style="width:${st.pct}%"></i></div>
   <button class="btn${bloq?'':' primary'}" ${bloq?'disabled':`onclick="startEar('${dr.id}')"`}>${bloq?'Precisa de microfone':(ativo?'Continuar':'Treinar')}</button>
  </article>`}).join('');
}
function earTonic(){const k=trainingKeys();return 55+KEYS[k[Math.floor(Math.random()*k.length)]].offset}
function startEar(id){
 const dr=EAR_DRILLS.find(x=>x.id===id);if(!dr)return;
 if(window.Metronomo)Metronomo.liberar();
 if(earRun&&earRun.dr.id===id){resumeEarOverlay();return}
 if(earRun)stopEar();
 earRun={dr,round:0,streak:0,hits:0,answered:false,ok:null,entrada:[],start:Date.now()};
 persistEarLive();
 openOverlay('ear-overlay');
 earNext();
 if(dr.kind==='sing')earStartMic();
}
function earNext(){
 if(!earRun)return;
 const dr=earRun.dr;
 earRun.round++;earRun.answered=false;earRun.ok=null;earRun.entrada=[];earRun.cantou=null;
 earRun.tonic=earTonic();
 if(dr.kind==='dictation'){
  const pool=exercises.filter(e=>e.level==='Fundamento'),lista=pool.length?pool:exercises;
  earRun.prog=lista[Math.floor(Math.random()*lista.length)];
  earRun.alvo=earRun.prog.ids.map(cid=>baseDegree(chord(cid).degree));
 }else if(dr.kind==='topvoice'){
  const pool=VOICING_TEMPLATES.filter(v=>(v.right||[]).length>=3),tons=trainingKeys();
  const t=pool[Math.floor(Math.random()*pool.length)];
  earRun.voic=materialize(t,t.id,tons[Math.floor(Math.random()*tons.length)]);
  const topo=Math.max(...earRun.voic.right);
  const certo=INTERVAL_LABEL[((topo-earRun.voic.rootPc)%12+12)%12];
  earRun.opts=shuffle([certo,...shuffle(Object.values(INTERVAL_LABEL).filter(x=>x!==certo)).slice(0,5)]).map(label=>({label}));
  earRun.pick=earRun.opts.findIndex(o=>o.label===certo);
 }else{
  earRun.opts=null;
  earRun.pick=Math.floor(Math.random()*dr.options.length);
 }
 persistEarLive();
 renderEarRound();
 earPlay();
}
function baseDegree(d){const m=String(d||'').match(/^[b#]?\d+(?:m(?!aj))?/);return m?m[0]:String(d||'')}
function earPlay(){
 if(!earRun)return;
 if(window.Metronomo)Metronomo.liberar();
 const dr=earRun.dr,t=earRun.tonic;
 if(dr.kind==='dictation'){
  earRun.prog.ids.forEach((cid,i)=>setTimeout(()=>{const c=chord(cid);playNotes([...(c.left||[]),...(c.right||[])],{duration:1.4})},i*900));
  return;
 }
 if(dr.kind==='topvoice'){playNotes([...earRun.voic.left,...earRun.voic.right],{duration:1.9});return}
 const op=dr.options[earRun.pick];
 if(dr.kind==='melodic'){op.iv.forEach((n,i)=>setTimeout(()=>playNotes([t+n],{duration:1.1}),i*620));return}
 if(dr.kind==='pair'){playNotes([t,t+4,t+7],{duration:1.3});setTimeout(()=>playNotes(op.iv.map(n=>t+n),{duration:1.6}),1000);return}
 if(dr.kind==='sing'){playNotes([t],{duration:1.6});return}
 playNotes(op.iv.map(n=>t+n),{duration:1.7});
}
function earAnswer(i){
 if(!earRun||earRun.answered)return;
 earRun.answered=true;earRun.escolha=i;
 earRun.ok=i===earRun.pick;
 if(earRun.ok)earRun.hits++;
 earRecord(earRun.dr.id,earRun.ok);
 persistEarLive();
 renderEarRound();
}
function earType(deg){
 if(!earRun||earRun.answered)return;
 earRun.entrada.push(deg);
 if(earRun.entrada.length>=earRun.alvo.length){
  earRun.answered=true;
  earRun.ok=earRun.entrada.every((v,i)=>v===earRun.alvo[i]);
  if(earRun.ok)earRun.hits++;
  earRecord(earRun.dr.id,earRun.ok);
 }
 persistEarLive();
 renderEarRound();
}
function earUndo(){if(!earRun||earRun.answered)return;earRun.entrada.pop();persistEarLive();renderEarRound()}
const DEG_PALETTE=['1','2m','3m','4','5','6m','7dim','b7','b3','b6'];
function renderEarRound(){
 const box=document.getElementById('ear-live');
 if(!box||!earRun)return;
 const dr=earRun.dr,st=earStats(dr.id);
 let corpo='';
 if(dr.kind==='dictation'){
  const escrito=earRun.entrada.map((v,i)=>`<span class="${earRun.answered?(v===earRun.alvo[i]?'hit':'miss'):''}">${esc(v)}</span>`).join('<i>→</i>');
  corpo=`<div class="ear-seq">${escrito||'<em>clique os graus na ordem</em>'}</div>
   <div class="ear-options">${DEG_PALETTE.map(g=>`<button class="choice" onclick="earType('${g}')" ${earRun.answered?'disabled':''}>${g}</button>`).join('')}
   <button class="choice" onclick="earUndo()" ${earRun.answered?'disabled':''}>← apagar</button></div>
   ${earRun.answered?`<div class="ear-verdict ${earRun.ok?'ok':'no'}">${earRun.ok?'Certo':'Era '+earRun.alvo.join(' → ')} · ${esc(earRun.prog.name)}</div>`:''}`;
 }else if(dr.kind==='sing'){
  const alvo=dr.options[earRun.pick];
  corpo=`<div class="ear-target">Cante a <b>${esc(alvo.label)}</b> acima da nota que tocou</div>
   <div class="ear-pitch"><b id="ear-note">—</b><span id="ear-cents">ouvindo…</span></div>
   ${earRun.answered?`<div class="ear-verdict ${earRun.ok?'ok':'no'}">${earRun.ok?`Certo · ${earRun.cantou}`:`Saiu ${earRun.cantou||'—'} · o alvo era ${noteName(earRun.tonic+alvo.iv[1],false,'C')}`}</div>`:''}`;
 }else{
  const ops=earRun.opts||dr.options;
  const cabeca=dr.kind==='topvoice'&&earRun.voic
   ?`<div class="ear-voicing"><b>${esc(earRun.voic.name)}</b><span>${esc(earRun.voic.voicingTitle)} · tom ${esc(earRun.voic.key)}</span>${svgDiagram(earRun.voic,true)}</div>`:'';
  corpo=cabeca+`<div class="ear-options">${ops.map((o,i)=>{
    const cls=earRun.answered?(i===earRun.pick?' hit':(earRun.ok===false&&i===earRun.escolha?' miss':'')):'';
    return`<button class="choice${cls}" onclick="earAnswer(${i})" ${earRun.answered?'disabled':''}>${esc(o.label)}</button>`}).join('')}</div>
   ${earRun.answered?`<div class="ear-verdict ${earRun.ok?'ok':'no'}">${earRun.ok?'Certo':`Era ${esc(ops[earRun.pick].label)}`}</div>`:''}`;
 }
 box.innerHTML=`<div class="ear-head">
   <div><div class="eyebrow">${esc(dr.name)} · rodada ${earRun.round}</div><p class="muted">${esc(dr.hint)}</p></div>
   <div class="ear-score"><b>${earRun.hits}/${earRun.round-(earRun.answered?0:1)}</b><span>sequência ${earRun.streak} · recorde ${st.best}</span></div>
  </div>
  ${corpo}
  <div class="ear-foot">
   <button class="btn" onclick="earPlay()">Ouvir de novo</button>
   <button class="btn primary" onclick="earNext()" ${earRun.answered?'':'disabled'}>Próxima</button>
   <button class="btn ghost" onclick="stopEar()">Encerrar</button>
  </div>`;
}
function stopEar(){
 if(earRun&&earRun.round>1){
  state.sessions.push({date:new Date().toISOString(),minutes:Math.max(1,Math.round((Date.now()-earRun.start)/60000)),focus:`Ouvido · ${earRun.dr.name}`,key:'12 tons'});
  state.sessions=state.sessions.slice(-365);saveState();
 }
 const ev=earRun?`${earRun.hits} de ${Math.max(0,earRun.round-(earRun.answered?0:1))} rodadas`:'';
 const bom=!!earRun&&earRun.round>2&&earRun.hits/Math.max(1,earRun.round-1)>=.7;
 earStopMic();earRun=null;persistEarLive();closeOverlay('ear-overlay');renderEar();renderDashboard();
 examCapture(ev,bom);
}
/* ---- cantar: microfone + autocorrelação, o mesmo método do mic-test ---- */
async function earStartMic(){
 if(earMic)return;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const ctx=Metronomo.acordar();if(!ctx)throw new Error('sem AudioContext');
  const an=ctx.createAnalyser();an.fftSize=2048;
  ctx.createMediaStreamSource(stream).connect(an);
  earMic={stream,an,buf:new Float32Array(an.fftSize),ctx};
  earMicLoop();
 }catch(e){
  const box=document.getElementById('ear-cents');
  if(box)box.textContent=`microfone indisponível (${e.name||e})`;
 }
}
function earStopMic(){
 cancelAnimationFrame(earMicRaf);earMicRaf=null;
 if(earMic){try{earMic.stream.getTracks().forEach(t=>t.stop())}catch(e){}earMic=null}
}
function detectPitch(buf,taxa){
 let soma=0;for(let i=0;i<buf.length;i++)soma+=buf[i]*buf[i];
 if(Math.sqrt(soma/buf.length)<.008)return-1;
 let r1=0,r2=buf.length-1;
 while(r1<buf.length/2&&Math.abs(buf[r1])<.002)r1++;
 while(r2>buf.length/2&&Math.abs(buf[r2])<.002)r2--;
 const b=buf.slice(r1,r2),n=b.length,c=new Array(n).fill(0);
 for(let l=0;l<n;l++)for(let i=0;i<n-l;i++)c[l]+=b[i]*b[i+l];
 let dd=0;while(dd<n-1&&c[dd]>c[dd+1])dd++;
 let max=-1,pos=-1;
 for(let i=dd;i<n;i++)if(c[i]>max){max=c[i];pos=i}
 if(pos<=0)return-1;
 const y1=c[pos-1]||0,y2=c[pos],y3=c[pos+1]||0,a=(y1+y3-2*y2)/2,bb=(y3-y1)/2;
 return taxa/(a?pos-bb/(2*a):pos);
}
function earMicLoop(){
 earMicRaf=requestAnimationFrame(earMicLoop);
 if(!earMic||!earRun||earRun.dr.kind!=='sing')return;
 earMic.an.getFloatTimeDomainData(earMic.buf);
 const f=detectPitch(earMic.buf,earMic.ctx.sampleRate);
 const nota=document.getElementById('ear-note'),cents=document.getElementById('ear-cents');
 if(!nota||!cents)return;
 if(!(f>60&&f<1400)){nota.textContent='—';cents.textContent='cante uma nota sustentada';return}
 const semi=12*Math.log2(f/440)+69,arred=Math.round(semi),desvio=Math.round((semi-arred)*100);
 nota.textContent=noteName(arred,true,'C');
 cents.textContent=`${desvio>0?'+':''}${desvio} cents`;
 if(earRun.answered)return;
 /* precisa segurar a nota afinada por meio segundo — evita acerto de passagem */
 const alvoPc=pcOf(earRun.tonic+earRun.dr.options[earRun.pick].iv[1]);
 const dentro=pcOf(arred)===alvoPc&&Math.abs(desvio)<=35;
 earRun.firme=dentro?(earRun.firme||Date.now()):null;
 if(dentro&&Date.now()-earRun.firme>500){
  earRun.answered=true;earRun.ok=true;earRun.cantou=noteName(arred,true,'C');
  earRecord(earRun.dr.id,true);persistEarLive();renderEarRound();
 }
}
