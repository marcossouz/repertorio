/* Plano de 12 meses, ciclo semanal, exames, metrônomo global e boot.

   Tudo o que o aluno vê na aba Plano — e o carregamento de estudos-data.json,
   que precisa ser o último script: o boot chama render do núcleo, do ouvido
   e do próprio plano. */

/* ================= modulação sob demanda =================

   O plano lista as pontes (dominante da nova tonalidade, secundários em cadeia,
   diminuto de passagem, semitom direto) mas o catálogo só tinha quatro
   progressões fixas. Aqui o tom de partida e o de chegada são sorteados e a
   ponte é construída na hora, então a mesma técnica cai em qualquer par. */
const MOD_BRIDGES=[
 {id:'dominant',name:'Dominante da nova tonalidade',
  tip:'V7 do destino resolve direto. É a ponte mais curta e a que sempre funciona no culto.',
  steps:d=>[{id:'dom7_root',key:keyAt(d,7)}]},
 {id:'secondary',name:'Dominantes em cadeia',
  tip:'II7 → V7 do destino: dois dominantes descendo por quintas.',
  steps:d=>[{id:'dom7_root',key:keyAt(d,2)},{id:'dom7_root',key:keyAt(d,7)}]},
 {id:'passing',name:'Diminuto de passagem',
  tip:'dim7 meio tom abaixo da nova tônica: sobe cromático e resolve.',
  steps:d=>[{id:'dim7_root',key:keyAt(d,-1)}]},
 {id:'pivot',name:'Acorde pivô',
  tip:'O vi do destino também existe na tonalidade de origem — entre por ele, sem anunciar a mudança.',
  steps:d=>[{id:'m7_root',key:keyAt(d,9)},{id:'dom7_root',key:keyAt(d,7)}]},
 {id:'half',name:'Semitom direto',
  tip:'Sem ponte: sobe tudo um semitom e resolve pela condução. Cru e eficaz.',
  steps:()=>[]}
];
function keyAt(keyName,semitones){
 const base=KEYS[keyName]?KEYS[keyName].offset:0;
 const alvo=((base+semitones)%12+12)%12;
 return Object.keys(KEYS).find(k=>KEYS[k].offset===alvo)||'C';
}
function startModulation(bridgeId){
 const b=MOD_BRIDGES.find(x=>x.id===bridgeId)||MOD_BRIDGES[0];
 const tons=CYCLE_ORDERS.chromatic;
 const de=tons[Math.floor(Math.random()*tons.length)];
 const outros=tons.filter(k=>k!==de);
 const para=b.id==='half'?keyAt(de,1):outros[Math.floor(Math.random()*outros.length)];
 const fila=[{id:'maj7_root',key:de},...b.steps(para),{id:'maj7_root',key:para}];
 beginSession(fila.map(x=>x.id),`Modular ${de} → ${para}`,`${b.name}. ${b.tip}`,true,fila,`mod:${b.id}`);
}
function renderModulation(){
 const box=document.getElementById('mod-grid');
 if(!box)return;
 box.innerHTML=MOD_BRIDGES.map(b=>`<article class="exercise-card">
  <span class="tag">Modulação</span>
  <h3>${esc(b.name)}</h3><p>${esc(b.tip)}</p>
  <button class="btn" onclick="startModulation('${b.id}')">Sortear par de tons</button>
 </article>`).join('');
}
/* ================= ciclo de 7 dias por música =================

   O plano dá sete trabalhos para cada música, um por dia. Sem lugar para marcar,
   isso vira intenção; marcado, vira a fila de dez músicas da Fase 3. */
const SONG_STEPS=[
 {n:'Tocar com cifra',h:'Só ler e tocar. Nada de análise ainda.'},
 {n:'Identificar tom, graus e estrutura',h:'A sequência só em graus, com o grau falado. Separe as partes enquanto toca.',modos:{degree:true,speak:true}},
 {n:'Tocar sem olhar a cifra',h:'O acorde fica escondido até você tocar. De memória, aceitando errar.',ouvido:true},
 {n:'Transpor',h:'Outro tom, mesma música.',modo:'transpose'},
 {n:'Voicings diferentes',h:'A mesma harmonia em shell, na região aguda.',cfg:{density:2,region:1}},
 {n:'Tocar imaginando uma banda',h:'Levada em 2 e 4, troca a cada compasso. Deixe espaço para baixo e bateria.',cfg:{metro:true,advance:4},banda:true},
 {n:'Gravar e escutar',h:'A gravação liga junto com a sessão. A gravação mostra o que a mão esconde.',gravar:true}
];
function songPlan(id){return(state.songPlan||{})[id]||[]}
function songProgress(song){const n=songPlan(song.id).length;return{n,total:7,pct:Math.round(n/7*100)}}
function songsModuleProgress(){
 const list=typeof songList==='function'?songList():[];
 if(!list.length)return{pct:0,detail:'sem músicas'};
 const avg=Math.round(list.reduce((s,song)=>s+songProgress(song).pct,0)/list.length);
 const done=list.filter(s=>songProgress(s).n>=7).length;
 const started=list.filter(s=>songProgress(s).n>0).length;
 return{pct:avg,detail:`${done} concluídas · ${started} em curso`};
}
function toggleSongStep(id,i){
 state.songPlan=state.songPlan||{};
 const feitos=[...songPlan(id)],k=feitos.indexOf(i);
 if(k<0)feitos.push(i);else feitos.splice(k,1);
 state.songPlan[id]=feitos;saveState();renderSongs();
}
function marcarPassoMusica(id,i){
 if(songPlan(id).includes(i))return;
 state.songPlan=state.songPlan||{};
 state.songPlan[id]=[...songPlan(id),i];saveState();
 if(typeof renderSongs==='function')renderSongs();
}
/* Cada passo abre a sessão que ele pede e se marca quando a sessão chega ao fim. */
function startSongStep(id,i){
 const p=SONG_STEPS[i],song=SONGS.find(s=>s.id===id);
 if(!p||!song)return;
 if(!sessaoCom(p.cfg||{},p.modos,()=>startSongSession(id,p.modo||'sequence')))return;
 session.songStep={id,i};
 if(p.ouvido){session.ear=true;session.earRevealed=false;renderSession();playCurrentChord()}
 if(p.banda){const g=session.metro2&&session.metro2.groove;session.metro2={...session.metro2,groove:g&&g!=='none'?g:'backbeat'};renderTransport()}
 if(p.gravar){session.gravar=true;if(recSupported()&&!(rec&&rec.state==='recording'))toggleRec()}
 document.getElementById('session-title').textContent=`${song.title} · ${p.n}`;
}
function songStepsHtml(song){
 const feitos=songPlan(song.id),pr=songProgress(song),sid=esc(song.id);
 return`<div class="song-steps">${SONG_STEPS.map((s,i)=>`<div class="song-step${feitos.includes(i)?' done':''}"><button type="button" onclick="startSongStep('${sid}',${i})" title="${esc(s.h)}"><b>${i+1}</b><span>${esc(s.n)}</span></button><button type="button" class="song-step-check" onclick="toggleSongStep('${sid}',${i})" title="${feitos.includes(i)?'Desmarcar':'Marcar sem tocar'}">✓</button></div>`).join('')}
  ${cardProgressHtml(pr.pct,`${pr.n}/7 do ciclo`)}
  <div class="song-step-foot">${pr.pct>=100?'Ciclo de sete dias concluído':`${pr.n}/7 do ciclo de sete dias`}</div></div>`;
}
/* ================= gravação =================

   Sábado o plano manda gravar e escutar. Depende de getUserMedia, então o botão
   só aparece onde existe — e o arquivo nunca sai daqui. */
let rec=null,recUrl='';
function recSupported(){return micSupported()&&typeof MediaRecorder!=='undefined'}
async function toggleRec(){
 if(rec&&rec.state==='recording')return rec.stop();
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const tipos=['audio/mp4','audio/webm;codecs=opus','audio/webm',''];
  const tipo=tipos.find(t=>!t||(MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t)));
  const pedacos=[];
  rec=new MediaRecorder(stream,tipo?{mimeType:tipo}:undefined);
  rec.ondataavailable=e=>{if(e.data.size)pedacos.push(e.data)};
  rec.onstop=()=>{
   stream.getTracks().forEach(t=>t.stop());
   if(recUrl)URL.revokeObjectURL(recUrl);
   recUrl=URL.createObjectURL(new Blob(pedacos,{type:rec.mimeType||'audio/mp4'}));
   const depois=rec.depois;
   rec=null;renderRec();
   if(depois)depois();
  };
  rec.start();renderRec();
 }catch(e){
  const b=document.getElementById('rec-btn');
  if(b)b.title=`microfone indisponível (${e.name||e})`;
  rec=null;renderRec();
 }
}
function renderRec(){
 const btn=document.getElementById('rec-btn');
 if(!btn)return;
 if(!recSupported()){btn.style.display='none';const p=document.getElementById('rec-play');if(p)p.style.display='none';return}
 btn.style.display='';
 const gravando=!!(rec&&rec.state==='recording');
 btn.classList.toggle('on',gravando);
 btn.innerHTML=gravando?'&#9632;':'&#9679;';
 btn.title=gravando?'Parar a gravação':'Gravar esta passagem';
 const play=document.getElementById('rec-play');
 if(play){play.style.display=recUrl&&!gravando?'inline-flex':'none';play.onclick=()=>{const a=new Audio(recUrl);a.play()}}
}
/* A sessão fecha sozinha no último acorde, e o play da gravação mora dentro dela. */
function fecharGravacaoNoResumo(){
 if(!rec||rec.state!=='recording')return;
 rec.depois=()=>{
  const box=document.getElementById('summary');if(!box||!recUrl)return;
  const b=document.createElement('button');
  b.className='btn';b.type='button';b.textContent='Escutar a gravação';b.style.marginTop='14px';
  b.onclick=()=>{const a=new Audio(recUrl);a.play()};
  box.appendChild(b);
 };
 rec.stop();
}
/* ================= progressão da semana =================

   O plano manda estudar uma progressão por semana, nos 12 tons. A escolha é
   determinística pela semana ISO dentro das progressões da fase atual, então ela
   é a mesma de segunda a domingo e roda sozinha na virada — com troca manual
   guardada para a semana corrente. */
function weekKey(when=new Date()){
 const t=new Date(when);t.setHours(0,0,0,0);
 t.setDate(t.getDate()+3-((t.getDay()+6)%7));
 const jan4=new Date(t.getFullYear(),0,4);
 const n=1+Math.round(((t-jan4)/86400000-3+((jan4.getDay()+6)%7))/7);
 return`${t.getFullYear()}-W${String(n).padStart(2,'0')}`;
}
function phaseProgressions(){
 const f=currentPhase();
 return((f&&f.progressions)||[]).map(id=>exercises.find(e=>e.id===id)).filter(Boolean);
}
function progForca(e){
 let s=0,n=0;
 e.ids.forEach(id=>CYCLE_ORDERS.chromatic.forEach(k=>{s+=itemState(id,k).strength;n++}));
 return n?s/n:0;
}
function weekProgPick(){
 const lista=phaseProgressions();
 if(!lista.length)return{e:exercises[0],de:'fase'};
 const w=state.weekProg;
 if(w&&w.week===weekKey()){const achado=lista.find(e=>e.id===w.id);if(achado)return{e:achado,de:w.auto?'manutencao':'manual'}}
 const doDiario=journalProgression();
 if(doDiario)return{e:doDiario,de:'diario'};
 if(currentPhase().maint){
  /* gravada na semana: senão a "mais fraca" mudaria enquanto você a estuda */
  const fraca=lista.slice().sort((a,b)=>progForca(a)-progForca(b))[0];
  state.weekProg={week:weekKey(),id:fraca.id,auto:true};saveState();
  return{e:fraca,de:'manutencao'};
 }
 return{e:lista[(Number(weekKey().slice(-2))||1)%lista.length],de:'fase'};
}
function weekProgression(){return weekProgPick().e}
function swapWeekProgression(){
 const lista=phaseProgressions(),atual=weekProgression();
 const outros=lista.filter(e=>e.id!==atual.id);
 if(!outros.length)return;
 state.weekProg={week:weekKey(),id:outros[Math.floor(Math.random()*outros.length)].id};
 saveState();renderTodayPlan();
}
function studyWeekProgression(){const e=weekProgression();if(e)startExercise(e.id)}
/* Ordem fixa parece fluente e esquece. Duas progressões intercaladas no mesmo tom
   parecem piores na hora — a retenção aparece depois. */
function startMixed(){
 const atual=weekProgression();if(!atual)return;
 const outras=phaseProgressions().filter(e=>e.id!==atual.id);
 const outra=outras.length?outras[Math.floor(Math.random()*outras.length)]:null;
 const keys=sessionKeys();
 let queue;
 if(outra){
  queue=keys.flatMap(key=>{
   const a=atual.ids.map(id=>({id,key})),b=outra.ids.map(id=>({id,key})),out=[];
   const n=Math.max(a.length,b.length);
   for(let i=0;i<n;i++){if(a[i])out.push(a[i]);if(b[i])out.push(b[i])}
   return out;
  });
 }else queue=keys.flatMap(key=>shuffle(atual.ids.map(id=>({id,key}))));
 const title=outra?`${atual.name} × ${outra.name}`:atual.name;
 beginSession(atual.ids,title,'Ordem misturada. Vai parecer pior agora. A retenção aparece depois.',true,queue,'mix:'+atual.id);
 if(!session)return;
 session.mix=true;session.chain=false;
 document.getElementById('session-title').textContent=`${title} · misturada`;
 renderSession();
}
/* ================= falar o grau =================

   "Fale os graus enquanto toca" é do plano, e a fala liga ouvido, teoria e mão de
   um jeito que a tela sozinha não liga. Fala só na troca de acorde, e nunca no
   modo ouvido antes de revelar — senão entregaria a resposta. */
const NUM_FALADO=['','um','dois','três','quatro','cinco','seis','sete','oito','nove'];
function degreeSpeech(deg){
 const m=String(baseDegree(deg)||'').match(/^([b#]?)(\d+)(m?)$/);
 if(!m)return String(deg||'');
 const alt=m[1]==='b'?' bemol':m[1]==='#'?' sustenido':'';
 return`${NUM_FALADO[Number(m[2])]||m[2]}${alt}${m[3]?' menor':''}`;
}
function speakSupported(){return typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined'}
function toggleSpeak(){
 state.speakDegree=!state.speakDegree;saveState();
 if(!state.speakDegree&&speakSupported())speechSynthesis.cancel();
 if(session)renderSession();
 syncSetupControls();
}
function speakDegree(c){
 if(!state.speakDegree||!speakSupported()||!c)return;
 try{
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(degreeSpeech(c.degree));
  u.lang='pt-BR';u.rate=1.15;u.volume=.85;
  speechSynthesis.speak(u);
 }catch(e){}
}
/* ================= teste de fluência =================

   Os dez itens que o plano define como "a teoria virou habilidade". Cada passo
   configura a sessão que prova aquele item e volta com a evidência que o módulo
   já mede — tempo de resposta e proporção de "firme". O que o app não consegue
   medir (acompanhar uma melodia sem cobrir a voz) fica declarado como
   autoavaliação, em vez de fingir automação. */
const FLUENCY=[
 {id:'find',name:'Encontrar imediatamente',crit:'O acorde sai abaixo do alvo de tempo, sem caçar nota.',cfg:{density:3,hands:'both',strict:'pc'},mede:'ms'},
 {id:'nonames',name:'Tocar sem pensar no nome das notas',crit:'Modo grau: você recebe a função e acha o teclado.',cfg:{degree:true},mede:'firm'},
 {id:'inv',name:'Usar inversões',crit:'O baixo precisa ser o que a inversão pede.',cfg:{strict:'bass'},mede:'firm'},
 {id:'region',name:'Manter a mão na região',crit:'Altura exata — sem trocar de oitava por conforto.',cfg:{strict:'octave'},mede:'firm'},
 {id:'hands',name:'Tocar com as duas mãos',crit:'Baixo na esquerda e voicing na direita, juntos.',cfg:{hands:'both',density:3},mede:'firm'},
 {id:'revoice',name:'Mudar o voicing',crit:'A mesma harmonia em shell, sem parar o pulso.',cfg:{density:2},mede:'firm'},
 {id:'sing',name:'Cantar a fundamental',crit:'A voz encontra a nota sem o teclado dar a resposta.',drill:'sing'},
 {id:'earfn',name:'Identificar a função pelo ouvido',crit:'Reconhecer o grau sem ver o nome.',drill:'function'},
 {id:'transpose',name:'Transpor para outro tom',crit:'A mesma progressão em outro tom, sem recomeçar do zero.',cfg:{key:'sorteado'},mede:'firm'},
 {id:'melody',name:'Acompanhar uma melodia',crit:'Tocar a harmonia sem cobrir a linha da voz.',self:true}
];
let exam=null,examStep=null;
function examDue(){
 const ult=(state.exams||[])[0];
 if(!ult)return true;
 return (Date.now()-Date.parse(ult.date))/86400000>=28;
}
function startFluency(){
 const f=currentPhase(),pool=exercises.filter(e=>((f&&f.progressions)||[]).includes(e.id));
 const lista=pool.length?pool:exercises;
 const prog=lista[Math.floor(Math.random()*lista.length)];
 const tons=CYCLE_ORDERS.chromatic;
 exam={prog,key:tons[Math.floor(Math.random()*tons.length)],start:Date.now(),
       steps:FLUENCY.map(x=>({...x,verdict:null,evid:''}))};
 examStep=null;openOverlay('exam-overlay');renderExam();
}
function examScore(){return exam?exam.steps.filter(x=>x.verdict===true).length:0}
function renderExam(){
 const box=document.getElementById('exam-live');
 if(!box||!exam)return;
 const n=examScore(),resp=exam.steps.filter(x=>x.verdict!==null).length;
 box.innerHTML=`<div class="exam-head">
   <div><div class="eyebrow">Progressão sorteada · tom sorteado</div>
    <h2>${esc(exam.prog.name)} em ${esc(exam.key)}</h2>
    <p class="muted">${esc(exam.prog.degrees)}</p></div>
   <div class="ear-score"><b>${n}/10</b><span>${resp} respondidos</span></div>
  </div>
  <ol class="exam-list">${exam.steps.map((x,i)=>`<li class="exam-step${x.verdict===true?' ok':x.verdict===false?' no':''}">
   <div class="exam-body"><b>${i+1}. ${esc(x.name)}</b><i>${esc(x.crit)}</i>${x.evid?`<em>${esc(x.evid)}</em>`:''}</div>
   <div class="exam-actions">
    ${x.self?'':`<button class="btn" onclick="runExamStep(${i})" title="Rodar este passo">▶</button>`}
    <button class="btn${x.verdict===true?' primary':''}" onclick="markExam(${i},true)">✓</button>
    <button class="btn${x.verdict===false?' primary':''}" onclick="markExam(${i},false)">✗</button>
   </div></li>`).join('')}</ol>
  <div class="ear-foot">
   <button class="btn primary" onclick="finishFluency()" ${resp===10?'':'disabled'}>Concluir teste</button>
   <button class="btn ghost" onclick="exam=null;examStep=null;closeOverlay('exam-overlay')">Sair</button>
  </div>`;
}
function markExam(i,v){if(!exam)return;exam.steps[i].verdict=exam.steps[i].verdict===v?null:v;renderExam()}
function runExamStep(i){
 if(!exam)return;
 const x=exam.steps[i];examStep=i;
 closeOverlay('exam-overlay');
 if(x.drill)return startEar(x.drill);
 const cfg=x.cfg||{};
 const outros=CYCLE_ORDERS.chromatic.filter(k=>k!==exam.key);
 const tom=cfg.key==='sorteado'?outros[Math.floor(Math.random()*outros.length)]:exam.key;
 allKeys=false;studyKey=tom;saveState();rebuildHarmony();
 document.getElementById('study-key').value=tom;document.getElementById('cycle-picker').style.display='none';
 if(cfg.degree!==undefined){
  if(exam.degreePrev===undefined)exam.degreePrev=!!state.degreeMode;
  state.degreeMode=!!cfg.degree;
 }
 setup.density=cfg.density!==undefined?cfg.density:3;
 setup.hands=cfg.hands||'both';
 setup.strict=cfg.strict||'pc';
 setup.duration=3;saveState();
 const e=exercises.find(y=>y.id===exam.prog.id);
 if(e)beginSession(e.ids,`Fluência ${i+1}/10 · ${x.name}`,x.crit,true);
}
/* a sessão e o drill devolvem a evidência para o passo que os chamou */
function restoreExamDegree(){
 if(!exam||exam.degreeTouched||typeof exam.degreePrev!=='boolean')return;
 state.degreeMode=exam.degreePrev;exam.degreePrev=undefined;saveState();syncDegreeModeUi();
}
function examCapture(evid,sugestao){
 if(examStep==null||!exam)return false;
 const x=exam.steps[examStep];
 x.evid=evid;if(x.verdict===null)x.verdict=sugestao;
 examStep=null;restoreExamDegree();openOverlay('exam-overlay');renderExam();
 return true;
}
function finishFluency(){
 if(!exam)return;
 restoreExamDegree();
 const n=examScore();
 state.exams=[{date:new Date().toISOString(),score:n,prog:exam.prog.name,key:exam.key,
   falhas:exam.steps.filter(x=>x.verdict===false).map(x=>x.name)},...(state.exams||[])].slice(0,24);
 state.sessions.push({date:new Date().toISOString(),minutes:Math.max(1,Math.round((Date.now()-exam.start)/60000)),focus:`Teste de fluência · ${n}/10`,key:exam.key});
 state.sessions=state.sessions.slice(-365);saveState();
 exam=null;examStep=null;closeOverlay('exam-overlay');renderPlan();renderDashboard();
}
/* ================= diário de culto =================

   Domingo o plano manda observar, não estudar. As cinco perguntas viram dado:
   cada resposta abre uma sessão da semana, os tons marcados sobem na fila de
   revisão e a progressão marcada vira a progressão da semana. */
const JOURNAL_Q=['Onde fiquei perdido?','Onde meu voicing ficou embolado?','Onde atrapalhei a voz?','Onde faltou dinâmica?','Onde consegui antecipar a mudança?'];
const JOURNAL_SEM=/^(n[aã]o|nenhum[a]?|nada|ok|tudo certo|-+)[.!]?$/i;
/* inverso: a última pergunta é o que deu certo — o déficit é não ter o que responder */
const JOURNAL_FOCO=[
 {q:0,dow:1,n:'Graus falados',h:'Você se perdeu: a sessão mostra só o grau e fala o grau. Siga a função, não o nome.',cfg:{},modos:{degree:true,speak:true}},
 {q:1,dow:2,n:'Shell limpo',h:'O voicing embolou: fundamental, 3ª e 7ª. Menos nota, mais clareza.',cfg:{density:2}},
 {q:2,dow:6,n:'Espaço para a voz',h:'Você cobriu a voz: voicing e resposta só no espaço que sobra.',cfg:{density:4}},
 {q:3,dow:4,n:'Dinâmica em p',h:'Faltou dinâmica: o MIDI cobra volume suave e acorde equilibrado.',cfg:{dinamica:'p'},completo:true},
 {q:4,dow:3,n:'Antecipar a troca',h:'Você não antecipou: troca a cada compasso, no metrônomo. Olho no próximo acorde.',cfg:{advance:4,metro:true},inverso:true}
];
/* O diário de domingo vale para os sete dias seguintes. Mais velho que isso, já não descreve a mão de hoje. */
function journalWeek(){
 const j=(state.journal||[])[0];
 return j&&daysLate(j.date)<=7?j:null;
}
function journalMarcou(s){const t=String(s||'').trim();return !!t&&!JOURNAL_SEM.test(t)}
function journalFocos(){
 const j=journalWeek();if(!j)return[];
 const a=Array.isArray(j.answers)?j.answers:[];
 const respondeu=a.some(x=>String(x||'').trim());
 return JOURNAL_FOCO.filter(f=>{
  if(!f.inverso)return journalMarcou(a[f.q]);
  const t=String(a[f.q]||'').trim();
  return t?JOURNAL_SEM.test(t):respondeu;
 });
}
function journalProgression(){
 const j=journalWeek();
 const id=j&&(j.progs||[]).find(x=>exercises.some(e=>e.id===x));
 return id?exercises.find(e=>e.id===id):null;
}
function journalTravados(){const j=journalWeek();return j?(j.keys||[]).filter(k=>KEYS[k]):[]}
function startJournalFocus(q){
 const j=journalWeek();if(!j)return;
 const f=q<0?{q:-1,n:'Tons travados',h:'Os tons que travaram no culto, primeiro.',cfg:{}}:JOURNAL_FOCO.find(x=>x.q===q);
 const e=journalProgression()||weekProgression();
 if(!f||!e)return;
 const tons=journalTravados(),keys=tons.length?tons:sessionKeys();
 const queue=keys.flatMap(key=>e.ids.map(id=>({id,key})));
 if(sessaoCom(f.cfg,f.modos,()=>beginSession(e.ids,`${e.name} · ${f.n}`,f.h,true,queue,e.id)))session.diario=f.q;
}
function marcarDiario(q){
 const j=journalWeek();if(!j)return;
 j.feitos=[...new Set([...(Array.isArray(j.feitos)?j.feitos:[]),q])];
 saveState();
}
function journalCardHtml(){
 const j=journalWeek();if(!j)return '';
 const focos=journalFocos(),prog=journalProgression(),tons=journalTravados();
 if(!focos.length&&!prog&&!tons.length)return '';
 const hoje=new Date().getDay(),feitos=Array.isArray(j.feitos)?j.feitos:[],mini=kbIsMini();
 const ord=focos.slice().sort((a,b)=>(b.dow===hoje)-(a.dow===hoje));
 if(tons.length)ord.push({q:-1,n:`Tons travados · ${tons.join(' ')}`,h:'Os tons que travaram no culto, primeiro.'});
 const info=[prog?`progressão da semana: ${prog.name}`:'',tons.length?`tons: ${tons.join(' · ')}`:''].filter(Boolean).join(' · ');
 return`<div class="journal-week"><div><span class="setup-label">Do diário de ${esc(fmtDate(j.date))}</span><i>${esc(info||'O que travou no culto vira sessão desta semana.')}</i></div>
  <div class="journal-focos">${ord.map(f=>{
   const ok=feitos.includes(f.q),off=f.completo&&mini;
   return`<button class="btn${f.dow===hoje&&!ok?' primary':''}${ok?' done':''}" type="button" ${off?'disabled title="Dinâmica pede o teclado completo"':`title="${esc(f.h)}"`} onclick="startJournalFocus(${f.q})">${ok?'✓ ':''}${esc(f.n)}</button>`}).join('')}</div></div>`;
}
function journalToday(){
 const achado=(state.journal||[]).find(j=>j.date===dateKey());
 return achado||{date:dateKey(),answers:['','','','',''],keys:[],progs:[]};
}
function openJournal(){renderJournal();openOverlay('journal-overlay')}
function renderJournal(){
 const box=document.getElementById('journal-live');
 if(!box)return;
 const j=journalToday();
 const fase=phaseProgressions(),marcadas=exercises.filter(e=>j.progs.includes(e.id)&&!fase.includes(e));
 const opcoes=[...fase,...marcadas,...exercises.filter(e=>!fase.includes(e)&&!marcadas.includes(e))].slice(0,Math.max(14,fase.length+marcadas.length));
 box.innerHTML=`<p class="muted" style="margin-bottom:16px">Responda depois do culto. Cada resposta vira uma sessão da semana na aba Hoje. Os tons marcados vão para a frente da revisão e a progressão marcada vira a da semana. Se não houve problema, escreva "nada".</p>
  ${JOURNAL_Q.map((q,i)=>`<div class="setup-section"><div class="setup-label">${esc(q)}</div>
   <input class="search journal-input" style="width:100%;margin:0" data-q="${i}" value="${esc(j.answers[i]||'')}" placeholder="uma linha basta"></div>`).join('')}
  <div class="setup-section"><div class="setup-label">Tons que travaram</div><div class="choice-row">
   ${CYCLE_ORDERS.chromatic.map(k=>`<button class="choice${j.keys.includes(k)?' active':''}" onclick="journalKey('${k}')">${k}</button>`).join('')}</div></div>
  <div class="setup-section"><div class="setup-label">Progressões que travaram</div><div class="choice-row">
   ${opcoes.map(e=>`<button class="choice${j.progs.includes(e.id)?' active':''}" onclick="journalProg('${e.id}')">${esc(e.name)}</button>`).join('')}</div></div>
  <div class="setup-foot"><button class="btn" onclick="closeOverlay('journal-overlay')">Fechar</button>
   <button class="btn primary" onclick="saveJournal()">Guardar</button></div>`;
}
function journalPut(j){
 state.journal=[j,...(state.journal||[]).filter(x=>x.date!==j.date)].slice(0,60);
 saveState();
}
function journalKey(k){const j=journalToday();const i=j.keys.indexOf(k);i<0?j.keys.push(k):j.keys.splice(i,1);journalPut(j);renderJournal()}
function journalProg(id){const j=journalToday();const i=j.progs.indexOf(id);i<0?j.progs.push(id):j.progs.splice(i,1);journalPut(j);renderJournal()}
function saveJournal(){
 const j=journalToday();
 document.querySelectorAll('.journal-input').forEach(el=>{j.answers[Number(el.dataset.q)]=el.value.trim()});
 journalPut(j);closeOverlay('journal-overlay');renderTodayPlan();renderReviewCard();
}
function journalFocusKeys(){return new Set(journalTravados())}
/* Ajustes que valem só para esta sessão: o setup gravado volta na hora,
   e os modos globais (graus, fala) voltam quando a sessão fecha. */
function sessaoCom(cfg,modos,abrir){
 const prev={},volta={};
 Object.keys(cfg||{}).forEach(k=>prev[k]=setup[k]);
 if(modos&&'degree' in modos){volta.degree=!!state.degreeMode;state.degreeMode=!!modos.degree;syncDegreeModeUi()}
 if(modos&&'speak' in modos){volta.speak=!!state.speakDegree;state.speakDegree=!!modos.speak}
 Object.assign(setup,cfg||{});
 const cadeia=state.sessionChain;state.sessionChain=false;
 try{abrir()}finally{Object.assign(setup,prev);state.sessionChain=cadeia}
 if(!session){voltarModos({volta});return false}
 session.volta=Object.keys(volta).length?volta:null;
 renderSession();
 return true;
}
function voltarModos(s){
 if(!s||!s.volta)return;
 const v=s.volta;s.volta=null;
 if('degree' in v){state.degreeMode=v.degree;syncDegreeModeUi()}
 if('speak' in v)state.speakDegree=v.speak;
 saveState();
}
function aoConcluirSessao(s,completo,total){
 voltarModos(s);
 if(s.gravar)fecharGravacaoNoResumo();
 if(!total)return;
 evoFoto();
 if(s.diario!=null)marcarDiario(s.diario);
 if(s.songStep&&completo)marcarPassoMusica(s.songStep.id,s.songStep.i);
}
/* ================= camadas de prática =================

   O exercício central da Fase 3 do plano: a mesma harmonia tocada com densidade
   crescente, da fundamental sozinha até o voicing com resposta — e a última
   camada, que é não tocar. Região e mão separada saem daqui também, porque as
   três respostas mudam as mesmas notas antes de chegarem na tela, no som e na
   checagem do MIDI. */
const DENSITY=[
 {name:'Só fundamentais',hint:'Uma nota por acorde. Ouça a harmonia acontecer sem preencher nada.'},
 {name:'Fundamental + 3ª',hint:'A terça é o que decide maior ou menor. Duas notas já contam a história.'},
 {name:'Shell · 3 e 7',hint:'O esqueleto. É o que a banda precisa de você, e nada mais.'},
 {name:'Voicing completo',hint:'O desenho como está escrito, com as cores.'},
 {name:'Voicing + resposta',hint:'Toque o voicing e responda a frase da voz no espaço que sobra.'},
 {name:'Não tocar',hint:'Acompanhe mentalmente, mãos paradas. Saber calar é a parte difícil.'}
];
const REGIONS=[{v:-1,n:'Grave'},{v:0,n:'Média'},{v:1,n:'Aguda'}];
const HANDS=[{v:'both',n:'Duas mãos'},{v:'lh',n:'Só esquerda'},{v:'rh',n:'Só direita'}];
const STRICTS=[{v:'pc',n:'Notas'},{v:'bass',n:'Baixo certo'},{v:'octave',n:'Altura exata'}];

/* ================= dinâmica =================

   A única dimensão que o teclado já manda pelo cabo e que nenhum estudo aqui
   usava: a velocity de cada nota. Duas medidas saem dela, e elas treinam coisas
   diferentes.

   ALVO é o volume: tocar de verdade em pp é mais difícil que em f, porque exige
   controle do peso, não força. Quem só toca mf a vida inteira soa igual o tempo
   todo — e na igreja isso é o que impede a música de crescer.

   ESPALHO é o equilíbrio dentro do acorde: a diferença entre a voz mais forte e
   a mais fraca. É o que separa "cinco dedos caindo" de "um instrumento soando".
   O dedo 4 e o 5 chegam sempre mais fracos; por isso o espalho é a medida que
   mais denuncia técnica intermediária, e a que mais melhora com atenção. */
const DINAMICAS=[
 {v:'off',n:'Livre',alvo:null,hint:'Sem alvo de volume — o padrão.'},
 {v:'pp',n:'pp',alvo:28,hint:'Muito suave. O teste real de controle de peso.'},
 {v:'p',n:'p',alvo:48,hint:'Suave. Fundo debaixo de voz falada.'},
 {v:'mf',n:'mf',alvo:70,hint:'Meio-termo. É onde quase todo mundo mora sem perceber.'},
 {v:'f',n:'f',alvo:96,hint:'Forte. Refrão, sem endurecer o som.'},
 {v:'ff',n:'ff',alvo:116,hint:'Muito forte. Só o clímax aguenta.'}
];
const DIN_TOL=14;      /* margem de velocity aceita em torno do alvo */
const DIN_ESPALHO=18;  /* diferença tolerada entre a voz mais forte e a mais fraca */
function dinamicaDe(v){return DINAMICAS.find(d=>d.v===v)||DINAMICAS[0]}
function densityName(i){return(DENSITY[i]||DENSITY[3]).name}
function regionName(v){return(REGIONS.find(r=>r.v===v)||REGIONS[1]).n}
function handsName(v){return(HANDS.find(h=>h.v===v)||HANDS[0]).n}
function strictName(v){return(STRICTS.find(x=>x.v===v)||STRICTS[0]).n}
function pcOf(n){return((n%12)+12)%12}
/* As notas que ESTA repetição pede — o resto do módulo passou a perguntar aqui
   em vez de ler c.left/c.right direto. */
function practiceNotes(c){
 const d=session?session.density:3,reg=session?session.region:0,mao=session?session.hands:'both';
 let left=[...(c.left||[])],right=[...(c.right||[])];
 if(d<3){
  const iv=n=>((n-c.rootPc)%12+12)%12;
  let terca=right.filter(n=>[3,4].includes(iv(n)));
  if(!terca.length)terca=right.slice(1,2);
  const setima=right.filter(n=>[10,11].includes(iv(n)));
  const quinta=right.filter(n=>[6,7,8].includes(iv(n)));
  if(d===0)right=[];
  else if(d===1)right=terca.slice(0,1);
  else right=[...terca.slice(0,1),...(setima.length?setima.slice(0,1):quinta.slice(0,1))].sort((a,b)=>a-b);
 }
 if(d===5){left=[];right=[]}
 if(mao==='lh')right=[];
 if(mao==='rh')left=[];
 if(reg){left=left.map(n=>n+reg*12);right=right.map(n=>n+reg*12)}
 let fit='';
 if(session&&session.kb==='mini'&&(left.length||right.length)&&typeof encaixarTessitura==='function'){
  const range=kbRange()||{lo:48,hi:72};
  const f=encaixarTessitura(left,right,range.lo,range.hi);
  left=f.left;right=f.right;fit=f.fit;
 }
 return{left,right,all:[...left,...right].sort((a,b)=>a-b),fit};
}
function practiced(c){
 const n=practiceNotes(c);
 const oL=c.left||[],oR=c.right||[];
 const mesmo=n.left.length===oL.length&&n.right.length===oR.length&&n.left.every((v,i)=>v===oL[i])&&n.right.every((v,i)=>v===oR[i]);
 if(mesmo&&!(session&&session.region)&&!n.fit)return c;
 const md=['—','1','1–5','1–3–5','1–2–3–5'][Math.min(4,n.right.length)]||'1–2–3–5';
 const me=['—','5','5–1','5–3–1'][Math.min(3,n.left.length)]||'5';
 return{...c,left:n.left,right:n.right,rh:n.right.length?md:'—',lh:n.left.length?me:'—',fit:n.fit||''};
}
function practiceLabel(){
 if(!session)return'';
 const p=[];
 if(session.density!==3)p.push(densityName(session.density));
 if(session.region)p.push(`região ${regionName(session.region).toLowerCase()}`);
 if(session.hands!=='both')p.push(handsName(session.hands).toLowerCase());
 if(session.strict!=='pc')p.push(`MIDI: ${strictName(session.strict).toLowerCase()}`);
 return p.join(' · ');
}
function stepDensity(delta){
 if(!session)return;
 session.density=Math.max(0,Math.min(DENSITY.length-1,session.density+delta));
 setup.density=session.density;saveState();
 session.leadFrom=null;renderKeymap();renderSession();
}
function cycleHands(){
 if(!session)return;
 const i=HANDS.findIndex(h=>h.v===session.hands);
 session.hands=HANDS[(i+1)%HANDS.length].v;setup.hands=session.hands;saveState();
 session.leadFrom=null;renderKeymap();renderSession();
}
/* Condução de vozes: quanto a mão andou entre um acorde e o seguinte, comparado
   com quanto o desenho escrito anda. Acertar as notas não é conduzir. */
function totalShift(a,b){
 const A=[...a].sort((x,y)=>x-y),B=[...b].sort((x,y)=>x-y);
 if(!A.length||!B.length)return null;
 const n=Math.max(A.length,B.length);let soma=0;
 for(let i=0;i<n;i++)soma+=Math.abs(B[Math.min(i,B.length-1)]-A[Math.min(i,A.length-1)]);
 return soma;
}
/* ================= plano de 12 meses =================

   O plano do usuário é temporal ("mês 1–3"), mas o módulo já mede o que foi
   consolidado por voicing e por tom. Então a fase não avança pelo calendário:
   avança quando o material dela passou pelos 12 tons e ficou firme, no tempo de
   resposta esperado. Calendário vira estimativa; a régua é o progresso. */
let PLAN=null,blockRun=null,blockTimer=null,planMode='';

function planReady(){return !!(PLAN&&Array.isArray(PLAN.phases)&&PLAN.phases.length)}
function phaseIds(f){return[...new Set((f.paths||[]).flatMap(id=>{const p=paths.find(x=>x.id===id);return p?p.ids:[]}))]}
function strongKeys(id,min){return CYCLE_ORDERS.chromatic.filter(k=>itemState(id,k).strength>=min).length}
function phaseStats(f){
 const ids=phaseIds(f);
 const raw=f.gate||{};
 /* bloco só fecha quando TODOS os voicings estão firmes nos 12 tons — parcial não é "dominado" */
 const g={ms:4500,...raw,share:1,keys:12,strength:Math.min(75,Number(raw.strength)||75)};
 const firmes=ids.filter(id=>strongKeys(id,g.strength)>=g.keys).length;
 const share=ids.length?firmes/ids.length:0;
 let soma=0,n=0;
 ids.forEach(id=>CYCLE_ORDERS.chromatic.forEach(k=>{const r=reviewRow(id,k);if(r&&r.timed){soma+=r.sumMs;n+=r.timed}}));
 const ms=n?Math.round(soma/n):null;
 const tempoOk=n<12||ms<=g.ms;
 /* a fase também lista progressões, técnica e músicas — o que ela lista é o que ela cobra */
 const progs=(f.progressions||[]).map(id=>exercises.find(e=>e.id===id)).filter(Boolean);
 const progFirmes=progs.filter(e=>e.ids.length&&e.ids.every(id=>strongKeys(id,g.strength)>=g.keys)).length;
 const tecs=(f.technique||[]).map(id=>TECHNIQUE_EXERCISES.find(t=>t.id===id)).filter(Boolean);
 const tecOk=tecs.filter(t=>techniqueProgress(t).pct>=100).length;
 const musicas=Number(raw.songs)||0,musOk=Math.min(musicas,songsCycled());
 const itens=ids.length+progs.length+tecs.length+musicas,ok=firmes+progFirmes+tecOk+musOk;
 const harm=ids.length+progs.length;
 return{ids:ids.length,firmes,share,ms,amostras:n,tempoOk,g,
        progs:progs.length,progFirmes,tecs:tecs.length,tecOk,musicas,musOk,itens,ok,
        pct:itens?Math.round(ok/itens*100):0,hpct:harm?Math.round((firmes+progFirmes)/harm*100):0,
        done:ids.length>0&&ok===itens&&tempoOk};
}
function songsCycled(){return Object.values(state.songPlan||{}).filter(v=>Array.isArray(v)&&v.length>=SONG_STEPS.length).length}
/* Depois da última fase o plano não para: todo o material volta, a progressão
   da semana é a mais fraca e o teste mensal é a régua. */
function maintenancePhase(){
 const fs=PLAN.phases,ult=fs[fs.length-1],junta=k=>[...new Set(fs.flatMap(f=>f[k]||[]))];
 return{id:'manutencao',n:fs.length+1,maint:true,name:'Manutenção',months:'Depois do mês 12',
  goal:'Manter o que já é seu nos 12 tons, sem material novo.',
  detail:'O material das quatro fases volta na revisão. A progressão da semana é a mais fraca, o ciclo pode começar pelos tons fracos e o teste mensal diz se algo caiu.',
  paths:junta('paths'),progressions:junta('progressions'),technique:junta('technique'),gate:{...(ult.gate||{}),songs:0}};
}
function currentPhase(){
 if(!planReady())return null;
 return PLAN.phases.find(f=>!phaseStats(f).done)||maintenancePhase();
}
function planDay(when=new Date()){
 if(!planReady())return null;
 return PLAN.week.find(w=>w.dow===when.getDay())||PLAN.week[0];
}
function routineOf(id){return(PLAN.routines||[]).find(r=>r.id===id)||PLAN.routines[0]}
/* As falhas do último teste viram blocos fixos até o próximo teste. Três por dia,
   em rodízio se forem mais; no dia de 10 min não cabem. */
function examBlocks(){
 const ult=(state.exams||[])[0];
 if(!ult||!Array.isArray(ult.falhas)||!ult.falhas.length)return[];
 const itens=FLUENCY.filter(x=>ult.falhas.includes(x.name));
 if(!itens.length)return[];
 const n=Math.min(3,itens.length),ini=itens.length>3?Math.floor(Date.parse(dateKey()+'T00:00:00')/DAY)%itens.length:0;
 return Array.from({length:n},(_,k)=>itens[(ini+k)%itens.length]).map(x=>({min:5,name:`Teste · ${x.name}`,view:x.drill?'ear':x.self?'songs':'transitions',hint:x.self?`${x.crit} Escolha uma música e toque com a voz na cabeça.`:x.crit,action:'exam',exam:x.id}));
}
function routineBlocks(rot){
 const blocos=(rot.blocks||[]).map(b=>{
  if(b.action!=='language')return b;
  const t=languageTrack();
  return t?{...b,name:`Linguagem · ${t.name}`,hint:languageSteps(t)[languageNextStep(t)].practice}:b;
 });
 return rot.id==='rush'?blocos:[...blocos,...examBlocks()];
}
function startExamDrill(id){
 const x=FLUENCY.find(y=>y.id===id);if(!x||x.self)return;
 if(x.drill)return startEar(x.drill);
 const e=weekProgression();if(!e)return;
 const cfg={...(x.cfg||{})},modos={};
 if('degree' in cfg){modos.degree=cfg.degree;delete cfg.degree}
 let keys=sessionKeys().slice().sort((a,b)=>keyStrength(a,e.ids)-keyStrength(b,e.ids)).slice(0,4);
 if(cfg.key==='sorteado'){delete cfg.key;keys=shuffle(CYCLE_ORDERS.chromatic.filter(k=>k!==studyKey)).slice(0,3)}
 const queue=keys.flatMap(key=>e.ids.map(id=>({id,key})));
 sessaoCom(cfg,modos,()=>beginSession(e.ids,`${e.name} · ${x.name}`,x.crit,true,queue,e.id));
}
function routineState(){
 const hoje=dateKey(),r=state.routine||{};
 if(r.date!==hoje)return{date:hoje,id:r.id||'long',done:[]};
 return{date:hoje,id:r.id||'long',done:Array.isArray(r.done)?r.done:[]};
}
function saveRoutine(r){state.routine=r;saveState()}
function setRoutine(id){const r=routineState();r.id=id;r.done=[];saveRoutine(r);renderPlan();renderDashboard()}  // renderDashboard redesenha o plano de hoje e a meta, que segue a rotina
function nextPlanBlock(){
 if(!planReady())return null;
 const dia=planDay();
 if(dia&&dia.mode==='journal')return null;
 const r=routineState(),blocos=routineBlocks(routineOf(r.id));
 const i=blocos.findIndex((_,k)=>!r.done.includes(k));
 if(i<0)return null;
 return{i,block:blocos[i],feitos:r.done.length,total:blocos.length};
}
function planFollowUpHtml(){
 if(blockRun)return`<p class="muted">O bloco ${esc(blockRun.name)} ainda está no relógio.</p><button class="btn primary" onclick="closeOverlay('summary-overlay')">Continuar o bloco</button>`;
 const next=nextPlanBlock();
 if(!next)return`<button class="btn primary" onclick="closeOverlay('summary-overlay');showView('today')">Concluir</button>`;
 return`<p class="muted">Próximo no plano: ${esc(next.block.name)} · ${next.block.min} min</p>
  <div class="summary-actions">
   <button class="btn primary" onclick="closeOverlay('summary-overlay');startBlock(${next.i})">Começar ${esc(next.block.name)}</button>
   <button class="btn ghost" onclick="closeOverlay('summary-overlay')">Agora não</button>
  </div>`;
}
function offerNextBlock(feito){
 const box=document.getElementById('summary');
 if(!box){showView('today');return}
 const next=nextPlanBlock();
 if(!next){
  box.innerHTML=`<div class="summary-mark">✓</div>
   <div class="eyebrow">Plano de hoje</div>
   <h2 id="summary-title">Rotina completa</h2>
   <p class="muted">${feito?esc(feito)+' concluído. ':''}Não resta bloco na rotina de hoje.</p>
   <button class="btn primary" onclick="closeOverlay('summary-overlay');showView('today')">Ver o dia</button>`;
  openOverlay('summary-overlay');
  return;
 }
 const b=next.block;
 box.innerHTML=`<div class="summary-mark">✓</div>
  <div class="eyebrow">${feito?esc(feito)+' · ':''}bloco ${next.i+1}/${next.total}</div>
  <h2 id="summary-title">Próximo: ${esc(b.name)}</h2>
  <p class="muted">${b.min} min · ${esc(b.hint)}</p>
  <div class="summary-actions">
   <button class="btn primary" onclick="closeOverlay('summary-overlay');startBlock(${next.i})">Começar agora</button>
   <button class="btn ghost" onclick="closeOverlay('summary-overlay');showView('today')">Mais tarde</button>
  </div>`;
 openOverlay('summary-overlay');
}
function toggleBlock(i){
 const r=routineState(),k=r.done.indexOf(i);
 if(k<0)r.done.push(i);else r.done.splice(k,1);
 saveRoutine(r);renderTodayPlan();
}
/* Cada bloco leva a uma área e liga o modo que aquele bloco pede: o de ouvido
   entra na sessão já cego, o de transposição força o ciclo cromático nos 12
   tons. Sem isso o "bloco" seria só um cronômetro com nome bonito. */
function applyBlockMode(b){
 planMode=b.mode||'';
 if(b.mode==='chromatic'){
  if(!allKeys||cycleOrder!=='chromatic'){setStudyKey('ALL');setCycleOrder('chromatic');document.getElementById('cycle-order').value='chromatic'}
 }
 if(b.mode==='rush'){
  if(!allKeys)setStudyKey('ALL');
  setup.density=2;state.density=2;
  setup.metro=true;
  if(![4,8,16].includes(Number(setup.advance)))setup.advance=4;
  setup.duration=6;
  setDegreeMode(true);
  saveState();
  if(typeof syncSetupControls==='function')syncSetupControls();
 }
}
function startBlock(i){
 const b=routineBlocks(routineOf(routineState().id))[i];
 if(!b)return;
 const total=b.min*60000;
 blockRun={i,name:b.name,end:Date.now()+total,total,paused:false,left:total};
 state.blockClock=null;saveState();
 clearInterval(blockTimer);blockTimer=setInterval(tickBlock,500);
 applyBlockMode(b);
 showView(b.view);
 renderBlockBar();
 if(b.action==='weekProg')studyWeekProgression();
 if(b.action==='exam')startExamDrill(b.exam);
 if(b.action==='language')openLanguagePlan();
}
function blockLeft(){
 if(!blockRun)return 0;
 if(blockRun.paused)return blockRun.left;
 return Math.max(0,blockRun.end-Date.now());
}
function persistBlockClock(){
 if(!blockRun){if(state.blockClock){state.blockClock=null;saveState()}return}
 state.blockClock={date:dateKey(),i:blockRun.i,name:blockRun.name,total:blockRun.total,left:blockLeft()};
 saveState();
}
function pauseBlock(){
 if(!blockRun||blockRun.paused)return;
 blockRun.left=blockLeft();
 blockRun.paused=true;
 persistBlockClock();
 renderBlockBar();
}
function resumeBlock(){
 if(!blockRun||!blockRun.paused)return;
 blockRun.end=Date.now()+blockRun.left;
 blockRun.paused=false;
 if(state.blockClock){state.blockClock=null;saveState()}
 renderBlockBar();
}
function toggleBlockPause(){if(!blockRun)return;if(blockRun.paused)resumeBlock();else pauseBlock()}
function tickBlock(){
 if(!blockRun)return stopBlock(false);
 if(blockRun.paused)return;
 if(Date.now()>=blockRun.end)return finishBlock();
 renderBlockBar();
}
/* A passada do dia cheio acaba no último acorde. O relógio de 6 min não fica contando depois. */
function fecharBlocoRush(){
 if(!blockRun)return;
 const r=routineState();
 if(!r.done.includes(blockRun.i))r.done.push(blockRun.i);
 saveRoutine(r);
 clearInterval(blockTimer);blockTimer=null;blockRun=null;planMode='';
 if(state.blockClock)state.blockClock=null;
 renderBlockBar();
}
function finishBlock(){
 if(!blockRun)return;
 const i=blockRun.i,feito=blockRun.name,r=routineState();
 if(!r.done.includes(i))r.done.push(i);
 saveRoutine(r);
 beat(2);
 stopBlock(true,feito);
}
function stopBlock(concluido,feito){
 clearInterval(blockTimer);blockTimer=null;blockRun=null;planMode='';
 if(state.blockClock){state.blockClock=null;saveState()}
 renderBlockBar();renderTodayPlan();
 if(concluido)offerNextBlock(feito);
}
function restoreBlockClock(){
 const c=state.blockClock;
 if(!c||c.date!==dateKey()||!planReady()){if(c&&c.date!==dateKey()){state.blockClock=null;saveState()}return}
 const b=routineBlocks(routineOf(routineState().id))[c.i];
 if(!b){state.blockClock=null;saveState();return}
 const left=Math.max(0,Number(c.left)||0);
 if(left<=0){state.blockClock=null;saveState();return}
 blockRun={i:c.i,name:c.name||b.name,end:Date.now()+left,total:c.total||b.min*60000,paused:true,left};
 applyBlockMode(b);
 clearInterval(blockTimer);blockTimer=setInterval(tickBlock,500);
 renderBlockBar();renderTodayPlan();
}
function fmtClock(ms){const t=Math.max(0,Math.round(ms/1000));return`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
function renderBlockBar(){
 const bar=document.getElementById('block-bar');
 if(!bar)return;
 if(!blockRun){bar.classList.remove('on','paused');bar.innerHTML='';return}
 const blocos=routineBlocks(routineOf(routineState().id)),falta=blockLeft();
 const pct=Math.max(0,Math.min(100,100-falta/blockRun.total*100));
 bar.classList.add('on');
 bar.classList.toggle('paused',!!blockRun.paused);
 bar.innerHTML=`<div class="block-fill" style="width:${pct}%"></div>
  <span class="block-pos">bloco ${blockRun.i+1}/${blocos.length}</span>
  <b>${esc(blockRun.name)}</b>
  <span class="block-clock">${fmtClock(falta)}</span>
  <button class="btn" type="button" onclick="toggleBlockPause()">${blockRun.paused?'Continuar':'Pausar'}</button>
  <button class="btn" type="button" onclick="finishBlock()">Concluir</button>
  <button class="btn ghost" type="button" onclick="stopBlock(false)">Sair</button>`;
}
/* ================= linguagens e timbres =================

   As fases medem a base harmônica. Estas trilhas aplicam essa base a estilos
   diferentes, sem bloquear um gênero pelo mês ou atribuir domínio por MIDI.
   O registro é autoavaliação por escuta; desfazer também tem data para que um
   backup antigo não ressuscite uma etapa desmarcada. */
let languageStep=null;
function languageTracks(){return PLAN&&Array.isArray(PLAN.languages)?PLAN.languages:[]}
function normLanguageStudy(raw){
 const tracks=languageTracks(),r=raw&&typeof raw==='object'?raw:{},records={};
 tracks.forEach(t=>{
  const source=r.records&&r.records[t.id];
  if(!source||typeof source!=='object')return;
  const steps={};
  for(let i=0;i<4;i++){
   const v=source[i];
   if(v&&typeof v.done==='boolean'&&typeof v.at==='string'&&Number.isFinite(Date.parse(v.at)))steps[i]={done:v.done,at:new Date(v.at).toISOString()};
  }
  if(Object.keys(steps).length)records[t.id]=steps;
 });
 return{selected:tracks.some(t=>t.id===r.selected)?r.selected:(tracks.find(t=>t.id==='soul')||tracks[0]||{}).id||'',records};
}
function languageState(){return state.languageStudy=normLanguageStudy(state.languageStudy)}
function mergeLanguageStudy(a,b){
 const left=normLanguageStudy(a),right=normLanguageStudy(b),records={...left.records};
 Object.entries(right.records).forEach(([id,steps])=>{
  records[id]={...(records[id]||{})};
  Object.entries(steps).forEach(([i,v])=>{
   const old=records[id][i];
   if(!old||v.at>old.at||(v.at===old.at&&!v.done))records[id][i]=v;
  });
 });
 return{selected:left.selected,records};
}
function languageTrack(id){
 const tracks=languageTracks();
 return tracks.find(t=>t.id===(id||languageState().selected))||tracks[0];
}
function languageSteps(t){
 const other=languageTracks().find(x=>x.id===t.bridge.to);
 return[...t.steps,{title:`Ponte para ${other?other.name:t.bridge.to}`,practice:t.bridge.practice,listen:t.bridge.listen,exercise:t.steps[0].exercise}];
}
function languageDone(t,i){return !!(((languageState().records[t.id]||{})[i]||{}).done)}
function languageNextStep(t){const i=languageSteps(t).findIndex((_,n)=>!languageDone(t,n));return i<0?3:i}
function languageProgress(t){return languageSteps(t).filter((_,i)=>languageDone(t,i)).length}
function selectLanguageTrack(id){
 if(!languageTracks().some(t=>t.id===id))return;
 const r=languageState();r.selected=id;state.languageStudy=r;languageStep=null;
 saveState();renderPlan();renderTodayPlan();
}
function selectLanguageStep(i){
 if(!Number.isInteger(i)||i<0||i>3)return;
 languageStep=i;renderLanguagePlan();
}
function toggleLanguageStep(id,i){
 const t=languageTracks().find(x=>x.id===id);
 if(!t||!Number.isInteger(i)||i<0||i>3)return;
 const r=languageState(),old=(r.records[id]||{})[i];
 r.records[id]={...(r.records[id]||{}),[i]:{done:!old||!old.done,at:new Date().toISOString()}};
 state.languageStudy=r;languageStep=null;saveState();renderLanguagePlan();renderTodayPlan();
}
function openLanguagePlan(){
 showView('plan');
 const el=document.getElementById('language-plan');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}
function startLanguageBase(id,i){
 const t=languageTracks().find(x=>x.id===id);
 if(!t||!Number.isInteger(i)||i<0||i>3)return;
 const step=languageSteps(t)[i],e=exercises.find(x=>x.id===step.exercise);
 if(!e)return;
 const mode=planMode;
 try{
  planMode='';
  sessaoCom({density:3},null,()=>beginSession(e.ids,`${t.name} · base harmônica`,step.practice,true,null,e.id));
 }finally{planMode=mode}
 if(session){session.languagePractice=step.practice;renderSession()}
}
function renderLanguagePlan(){
 const box=document.getElementById('language-plan'),t=languageTrack();
 if(!box||!t)return;
 const steps=languageSteps(t),i=languageStep==null?languageNextStep(t):languageStep,s=steps[i],done=languageDone(t,i),n=languageProgress(t);
 const other=languageTracks().find(x=>x.id===t.bridge.to),refs=PLAN.languageProfile||{};
 box.innerHTML=`<div class="language-head"><div><div class="eyebrow">Estudo e ensaio em casa</div><h2>Linguagem, toque e timbre</h2><p class="muted">Escolha um foco e leve o que aprendeu para outro gênero. Todas as trilhas estão abertas.</p></div><span class="tag">${n}/4 aplicações em ${esc(t.name)}</span></div>
  <div class="language-picker" role="group" aria-label="Escolher gênero">${languageTracks().map(x=>`<button type="button" class="choice${x.id===t.id?' active':''}" aria-pressed="${x.id===t.id}" onclick="selectLanguageTrack('${x.id}')">${esc(x.name)} <small>${languageProgress(x)}/4</small></button>`).join('')}</div>
  <p class="language-focus">${esc(t.focus)}</p>
  <div class="language-steps" role="group" aria-label="Etapas da linguagem">${steps.map((x,k)=>`<button type="button" class="language-stage${k===i?' active':''}${languageDone(t,k)?' done':''}" aria-pressed="${k===i}" onclick="selectLanguageStep(${k})"><b>${languageDone(t,k)?'✓':k+1}</b><span>${esc(x.title)}</span></button>`).join('')}</div>
  <div class="language-lesson"><div class="eyebrow">${i===3?'Transferência entre gêneros':'Aplicação '+(i+1)}</div><h3>${esc(s.title)}</h3><p>${esc(s.practice)}</p>
   <div class="language-listen"><b>Avance quando ouvir</b><p>${esc(s.listen)}</p></div>
   <p class="language-tone"><b>Timbre e controle:</b> ${esc(t.tone)}</p>
   <div class="language-actions"><button type="button" class="btn primary" onclick="startLanguageBase('${t.id}',${i})">Abrir base harmônica</button>${s.banda?`<button type="button" class="btn" onclick="startBanda('${s.banda}')">Praticar fraseado</button>`:''}<button type="button" class="btn" aria-pressed="${done}" onclick="toggleLanguageStep('${t.id}',${i})">${done?'Desmarcar aplicação':'Ouvi e consegui aplicar'}</button></div>
   <p class="language-foot">Registro por autoavaliação. A base guiada treina os acordes; a levada e o timbre são avaliados pela escuta. Use 5–10 min dentro de Repertório ou Improviso.</p>
  </div>
  ${other?`<div class="language-bridge"><p><b>Próxima ponte: ${esc(t.name)} → ${esc(other.name)}.</b> ${esc(t.bridge.practice)}</p><button type="button" class="btn" onclick="selectLanguageTrack('${other.id}')">Explorar ${esc(other.name)}</button></div>`:''}
  <details class="language-reference"><summary>Suas referências e como estudar</summary><p>${esc((refs.references||[]).join(' · '))}.</p><p>Escolha um trecho curto de uma gravação que você gosta. Cante, tire de ouvido, toque mais devagar e crie uma resposta própria. Os nomes são referências de escuta que você trouxe; cada exercício é uma proposta de estudo, sem reproduzir o arranjo de um artista.</p><p>Compare o mesmo trecho seco e com efeitos, com volumes parecidos. No órgão e nos pads, expressão e envelope também mudam a dinâmica; velocity não é volume ouvido.</p><ul>${(refs.resources||[]).map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a> · ${esc(r.access)}</li>`).join('')}</ul></details>`;
}
function renderTodayLanguage(){
 const box=document.getElementById('language-today'),t=languageTrack();if(!box||!t)return;
 const i=languageNextStep(t),s=languageSteps(t)[i],n=languageProgress(t);
 box.innerHTML=`<div><div class="eyebrow">Seu foco musical · ${esc(t.name)} · ${n}/4 aplicações</div><h3>${n===4?'Revisar e cruzar gêneros':esc(s.title)}</h3><p>${esc(s.practice)}</p><small>Dentro do bloco de repertório ou improviso · escolha outro gênero quando quiser.</small></div><button type="button" class="btn" onclick="openLanguagePlan()">Abrir trilha</button>`;
}
/* ---- aba Plano ---- */
function gateText(f,st){
 const g=st.g;
 return`Firmes nos ${g.keys} tons: ${st.firmes}/${st.ids} voicings e ${st.progFirmes}/${st.progs} progressões`+
  (st.tecs?` · ${st.tecOk}/${st.tecs} técnicas no BPM alvo`:'')+
  (st.musicas?` · ${st.musOk}/${st.musicas} músicas com o ciclo de 7 dias`:'')+
  (st.amostras>=12?` · tempo médio ${fmtSeg(st.ms)} (alvo ${fmtSeg(g.ms)})`:' · tempo ainda sem amostra');
}
function maintenanceCardHtml(){
 const f=maintenancePhase(),ativa=!!currentPhase().maint,ult=(state.exams||[])[0];
 const nota=ult?`Último teste: ${ult.score}/10${ult.score<8?' — abaixo de 8, as falhas já estão na rotina como blocos.':'.'}`:'Ainda sem teste.';
 return`<article class="phase-card${ativa?' now':''}">
   <div class="phase-top"><span class="tag">${ativa?'fase atual':'depois da fase '+(f.n-1)}</span><span class="phase-months">${esc(f.months)}</span></div>
   <h3>${esc(f.name)}</h3>
   <p class="phase-goal">${esc(f.goal)}</p>
   <p class="muted">${esc(f.detail)}</p>
   <div class="phase-gate">Critério: teste mensal com 8/10 ou mais. ${esc(nota)}</div>
   ${ativa?`<div class="phase-lists"><div><span class="setup-label">Ordem dos tons</span><button class="chip" onclick="setCycleOrder('weak');document.getElementById('cycle-order').value='weak';renderPlan()">${cycleOrder==='weak'?'Ciclo pelos tons fracos · ligado':'Começar pelos tons fracos'}</button></div></div>`:''}
  </article>`;
}
function renderPlan(){
 const box=document.getElementById('plan-grid');
 if(!box||!planReady())return;
 const atual=currentPhase();
 renderLanguagePlan();
 box.innerHTML=PLAN.phases.map(f=>{
  const st=phaseStats(f),ativa=f.id===atual.id;
  const prog=f.progressions.map(id=>exercises.find(e=>e.id===id)).filter(Boolean);
  return`<article class="phase-card${ativa?' now':''}${st.done?' done':''}">
   <div class="phase-top"><span class="tag">${st.done?'concluída':ativa?'fase atual':'bloqueada'}</span><span class="phase-months">${esc(f.months)}</span></div>
   <h3>Fase ${f.n} · ${esc(f.name)}</h3>
   <p class="phase-goal">${esc(f.goal)}</p>
   <p class="muted">${esc(f.detail)}</p>
   <div class="path-meta"><span>${st.pct>=100?'Dominado':`${st.ok}/${st.itens} itens`}</span><b>${st.pct}%</b></div>
   <div class="progress"><i style="width:${st.pct}%"></i></div>
   <div class="phase-gate">${gateText(f,st)}</div>
   <div class="phase-lists">
    <div><span class="setup-label">Trilhas</span>${f.paths.map(id=>{const p=paths.find(x=>x.id===id);return p?`<button class="chip" onclick="openSetup('${p.id}')">${esc(p.name)} · ${pathMastery(p)}%</button>`:''}).join('')}</div>
    <div><span class="setup-label">Progressões</span>${prog.map(e=>`<button class="chip" onclick="startExercise('${e.id}')">${esc(e.name)}</button>`).join('')}</div>
   </div>
  </article>`}).join('')+maintenanceCardHtml();
 const semana=document.getElementById('week-strip');
 if(semana){
  const hoje=planDay();
  semana.innerHTML=PLAN.week.map(w=>`<button class="week-day${w.dow===hoje.dow?' now':''}" onclick="showView('${w.view}')">
   <b>${esc(w.name)}</b><span>${esc(w.focus)}</span><i>${esc(w.hint)}</i></button>`).join('');
 }
 const regra=document.getElementById('plan-rule');
 if(regra)regra.innerHTML=`<b>${esc(PLAN.rule)}</b><span>${esc(PLAN.cycle)}</span>`;
 const ex=document.getElementById('exam-card');
 if(ex){
  const ult=(state.exams||[])[0],vence=examDue();
  ex.innerHTML=`<div class="review-main">
   <div class="eyebrow">Teste de fluência</div>
   <h2>${ult?`Último: ${ult.score}/10 · ${esc(ult.prog)} em ${esc(ult.key)}`:'Ainda não medido'}</h2>
   <p class="muted">${vence?'Progressão e tom sorteados, dez itens. Faça uma vez por mês — é o que diz se a teoria virou habilidade.':`Feito em ${esc(fmtDate(dateKey(ult.date)))}. O próximo abre 28 dias depois.`}${ult&&ult.falhas.length?` Falhou em: ${esc(ult.falhas.join(', '))}.`:''}</p>
   <div class="review-actions">
    <button class="btn primary" onclick="startFluency()">${vence?'Fazer o teste':'Refazer agora'}</button>
    <button class="btn" onclick="openJournal()">Diário de culto</button>
   </div></div>`;
 }
}
/* ---- cartão do dia, na aba Hoje ---- */
function renderTodayPlan(){
 const box=document.getElementById('plan-today');
 if(!box||!planReady())return;
 renderTodayLanguage();
 renderTodayTone();
 const f=currentPhase(),st=phaseStats(f),dia=planDay(),r=routineState(),rot=routineOf(r.id),blocos=routineBlocks(rot);
 const total=blocos.length,feitos=r.done.filter(i=>i<total).length;
 const min=blocos.reduce((n,b,i)=>n+(r.done.includes(i)?0:b.min),0);
 const next=nextPlanBlock(),wp=weekProgPick();
 const agora=dia.mode==='journal'?'':blockRun?`<div class="plan-next">
   <div><div class="eyebrow">Em andamento</div><h3>${esc(blockRun.name)}</h3><p class="muted">O relógio está na barra de baixo. Conclua o bloco para o plano sugerir o seguinte.</p></div>
  </div>`:!next?`<div class="plan-next done"><div><div class="eyebrow">Hoje</div><h3>Rotina completa</h3><p class="muted">Todos os blocos da rotina ${esc(rot.label)} estão feitos.</p></div></div>`:`<div class="plan-next">
   <div><div class="eyebrow">Agora · bloco ${next.i+1}/${next.total}</div><h3>${esc(next.block.name)} · ${next.block.min} min</h3><p class="muted">${esc(next.block.hint)}</p></div>
   <button class="btn primary" onclick="startBlock(${next.i})">Começar</button>
  </div>`;
 box.innerHTML=`<div class="plan-head">
   <div><div class="eyebrow">${f.maint?'Manutenção':`Fase ${f.n}`} · ${esc(f.months)} · ${st.pct}% consolidado</div><h2>${esc(dia.name)} · ${esc(dia.focus)}</h2><p class="muted">${esc(dia.hint)}</p></div>
   <div class="routine-pick">${(PLAN.routines||[]).map(x=>`<button class="choice${x.id===r.id?' active':''}" onclick="setRoutine('${x.id}')">${esc(x.label)}</button>`).join('')}</div>
  </div>
  ${agora}
  ${dia.mode==='journal'?'':`<div class="week-prog"><div><span class="setup-label">Progressão da semana${wp.de==='diario'?' · do diário':wp.de==='manutencao'?' · a mais fraca':''}</span><b>${esc(wp.e.name)}</b><i>${esc(wp.e.degrees)}</i></div><div class="week-prog-actions"><button class="btn" onclick="swapWeekProgression()">Trocar</button><button class="btn" onclick="startMixed()" title="Alterna esta progressão com outra da fase. Parece pior na hora e retém melhor">Misturar</button><button class="btn primary" onclick="studyWeekProgression()">Estudar</button></div></div>${journalCardHtml()}${cultoHojeHtml()}`}
  ${dia.mode==='journal'?`<p class="muted plan-rest">Domingo não tem bloco. Toque, observe e depois responda: onde fiquei perdido? onde o voicing embolou? onde atrapalhei a voz? onde faltou dinâmica? onde consegui antecipar a mudança?</p><div class="hero-actions" style="margin-top:14px"><button class="btn primary" onclick="openJournal()">Abrir o diário</button></div>`:
  `<div class="block-list">${blocos.map((b,i)=>{
    const ok=r.done.includes(i),rodando=blockRun&&blockRun.i===i,proximo=next&&next.i===i&&!rodando;
    return`<div class="block-row${ok?' done':''}${rodando?' now':''}${proximo?' next':''}">
     <button class="block-check" onclick="toggleBlock(${i})" title="${ok?'Desmarcar':'Marcar como feito'}">${ok?'✓':''}</button>
     <span class="block-min">${b.min}′</span>
     <div class="block-body"><b>${esc(b.name)}</b><i>${esc(b.hint)}</i></div>
     <button class="btn" onclick="startBlock(${i})">${rodando?'Rodando':ok?'Refazer':'▶'}</button>
    </div>`}).join('')}</div>
   <div class="plan-foot">${feitos}/${total} blocos · ${min} min restantes hoje</div>`}`;
}
/* ================= repetição espaçada ================= */
const DAY=86400000;
/* Sessions já cortam em 365. Reviews, PRs, BPMs de técnica e o ouvido
   acumulavam chaves de voicings que saíram do catálogo. A poda roda no boot
   e depois de importar backup — não apaga song:… (o repertório vive no
   IndexedDB e pode voltar). */
function pruneStaleProgress(){
 const tons=new Set(Object.keys(KEYS));
 const vivos=new Set(VOICING_TEMPLATES.map(v=>v.id));
 PROGRESSION_TEMPLATES.forEach(p=>(p.steps||[]).forEach((_,i)=>vivos.add(`${p.id}-${i}`)));
 const pathsIds=new Set(paths.map(p=>p.id));
 const techIds=new Set(TECHNIQUE_EXERCISES.map(t=>t.id));
 const earIds=new Set(EAR_DRILLS.map(d=>d.id));
 let mudou=false;
 Object.keys(state.reviews).forEach(k=>{
  const at=k.lastIndexOf('@');
  if(at<0){delete state.reviews[k];mudou=true;return}
  const id=k.slice(0,at),key=k.slice(at+1);
  if(!tons.has(key)){delete state.reviews[k];mudou=true;return}
  if(id.startsWith('song:'))return;
  if(!vivos.has(id)){delete state.reviews[k];mudou=true}
 });
 Object.keys(state.bpmPr||{}).forEach(k=>{
  if(k==='revisao'||k.startsWith('song:')||k.startsWith('mod:'))return;
  if(!pathsIds.has(k)&&!vivos.has(k)){delete state.bpmPr[k];mudou=true}
 });
 Object.keys(state.techniqueBpms||{}).forEach(k=>{
  if(!techIds.has(k)){delete state.techniqueBpms[k];mudou=true}
 });
 Object.keys(state.ear||{}).forEach(k=>{
  if(!earIds.has(k)){delete state.ear[k];mudou=true}
 });
 const scaleIds=new Set(SCALE_TEMPLATES.map(s=>s.id));
 Object.keys(state.scaleKeys||{}).forEach(k=>{
  if(!scaleIds.has(k)){delete state.scaleKeys[k];mudou=true;return}
  const limpos=[...new Set((state.scaleKeys[k]||[]).filter(t=>tons.has(t)))];
  if(limpos.length!==(state.scaleKeys[k]||[]).length){state.scaleKeys[k]=limpos;mudou=true}
 });
 if(mudou)saveState();
}
function addDays(n,from=new Date()){const d=new Date(from);d.setDate(d.getDate()+n);return dateKey(d)}
function daysLate(due,ref=dateKey()){if(!due)return 999;return Math.round((Date.parse(ref+'T00:00:00')-Date.parse(due+'T00:00:00'))/DAY)}
function reviewRow(id,key){return state.reviews[`${id}@${key}`]}
function itemState(id,key){
 const r=reviewRow(id,key);
 if(!r||!r.attempts)return{status:'new',late:0,strength:0,due:null};
 const strength=Math.min(100,Math.round((r.score/Math.max(1,r.attempts*2))*100));
 const due=r.due||dateKey(),late=daysLate(due);
 return{status:late>=0?'due':'ok',late,strength,due};
}
function heatLevel(st){return st.status==='new'?'new':st.strength>=80?'high':st.strength>=50?'mid':'low'}
function scheduleReview(id,key,value,ms){
 const k=`${id}@${key}`,r=state.reviews[k]||{score:0,attempts:0,reps:0,lapses:0,ease:2.3,interval:0};
 r.score=(r.score||0)+value;r.attempts=(r.attempts||0)+1;r.last=new Date().toISOString();
 if(ms!=null&&isFinite(ms)){r.lastMs=ms;r.bestMs=Math.min(Number(r.bestMs)||Infinity,ms);r.sumMs=(Number(r.sumMs)||0)+ms;r.timed=(Number(r.timed)||0)+1}
 r.ease=Math.min(2.9,Math.max(1.3,(r.ease||2.3)+(value===2?.1:value===1?-.14:-.22)));
 if(value===0){r.lapses=(r.lapses||0)+1;r.reps=0;r.interval=0;r.due=dateKey()}
 else{
  r.reps=(r.reps||0)+1;
  const prev=r.interval||0;
  const next=value===1?(r.reps<=1?1:Math.max(1,Math.round(prev*1.25))):(r.reps<=1?1:r.reps===2?3:Math.max(2,Math.round(prev*r.ease)));
  r.interval=Math.min(180,next);r.due=addDays(r.interval);
 }
 state.reviews[k]=r;saveState();return r;
}
function drillKeys(){return allKeys?trainingKeys():[studyKey]}
function reviewPool(){
 const keys=drillKeys(),due=[],fresh=[];
 VOICING_TEMPLATES.forEach(v=>keys.forEach(key=>{
  const st=itemState(v.id,key),item={id:v.id,key,...st};
  if(st.status==='new')fresh.push(item);else if(st.status==='due')due.push(item);
 }));
 const foco=journalFocusKeys(),escala=cultoChaves();
 const peso=x=>(foco.has(x.key)?1:0)+(escala.has(`${x.id}@${x.key}`)?1:0);
 due.sort((a,b)=>peso(b)-peso(a)||b.late-a.late||a.strength-b.strength);
 fresh.sort((a,b)=>{const ia=PATH_ORDER.indexOf(a.id),ib=PATH_ORDER.indexOf(b.id);return peso(b)-peso(a)||(ia<0?99:ia)-(ib<0?99:ib)||keyStrength(a.key)-keyStrength(b.key)});
 return{due,fresh};
}
function dueQueue(limit=24){
 const{due,fresh}=reviewPool();
 const heavy=due.length>=Math.round(limit*.65);
 const pickDue=due.slice(0,heavy?Math.max(0,limit-Math.max(4,Math.round(limit*.35))):limit);
 const pickFresh=fresh.slice(0,Math.max(0,limit-pickDue.length)),out=[];
 let d=0,f=0;
 while(d<pickDue.length||f<pickFresh.length){
  if(d<pickDue.length)out.push(pickDue[d++]);
  if(d<pickDue.length)out.push(pickDue[d++]);
  if(f<pickFresh.length)out.push(pickFresh[f++]);
 }
 return out.slice(0,limit);
}
function fmtDate(iso){if(!iso)return '';const p=String(iso).split('-');return p.length===3?`${p[2]}/${p[1]}`:iso}
function nextDueDate(){
 const keys=drillKeys();let best=null;
 VOICING_TEMPLATES.forEach(v=>keys.forEach(k=>{const r=reviewRow(v.id,k);if(r&&r.due&&(!best||r.due<best))best=r.due}));
 return best;
}
function startRevision(){
 const q=dueQueue(Math.max(12,setup.duration*8));
 if(!q.length)return;
 beginSession(q.map(x=>x.id),'Revisão do dia','Vencidos primeiro, material novo intercalado.',false,q.map(x=>({id:x.id,key:x.key})),'revisao');
}
function renderReviewCard(){
 const box=document.getElementById('review-card');if(!box)return;
 const{due,fresh}=reviewPool(),next=nextDueDate(),total=VOICING_TEMPLATES.length*drillKeys().length;
 const studied=total-fresh.length;
 const size=Math.min(due.length+fresh.length,Math.max(12,setup.duration*8)),ready=size>0;
 box.innerHTML=`<div class="review-main">
  <div class="eyebrow">Revisão espaçada</div>
  <h2>${due.length?`${due.length} ${due.length===1?'item vence':'itens vencem'} hoje`:fresh.length?'Nada vencido — material novo disponível':'Tudo em dia'}</h2>
  <p class="muted">${due.length?'Itens que você já viu e estão no ponto de voltar.':next?`Próxima revisão em ${esc(fmtDate(next))}.`:'Comece por qualquer trilha para alimentar a fila.'} ${fresh.length?`${fresh.length} combinações ainda não estudadas.`:''}</p>
  <div class="review-actions">
   <button class="btn primary" onclick="startRevision()" ${ready?'':'disabled'}>Revisar agora${ready?` · ${size} ${size===1?'item':'itens'}`:''}</button>
   <button class="btn" onclick="openOverlay('data-overlay');renderDataPanel()">Progresso e backup</button>
  </div>
 </div>
 <div class="review-side">
  <div class="review-stat"><b>${due.length}</b><span>vencidos</span></div>
  <div class="review-stat"><b>${studied}</b><span>de ${total} vistos</span></div>
 </div>`;
}
/* ================= domínio por tom ================= */
function keyStrength(keyName,ids){
 const list=ids&&ids.length?ids:VOICING_TEMPLATES.map(v=>v.id);
 let score=0,attempts=0;
 list.forEach(id=>{const r=state.reviews[`${id}@${keyName}`];if(r){score+=r.score||0;attempts+=r.attempts||0}});
 return attempts?Math.min(100,Math.round(score/(attempts*2)*100)):0;
}
function keySeen(keyName){return VOICING_TEMPLATES.filter(v=>{const r=state.reviews[`${v.id}@${keyName}`];return r&&r.attempts}).length}
function renderKeyHeat(){
 const box=document.getElementById('key-heat');if(!box)return;
 const order=CYCLE_ORDERS.fifths;
 box.innerHTML=order.map(k=>{
  const st=keyStrength(k),seen=keySeen(k),lvl=!seen?'new':st>=80?'high':st>=50?'mid':'low';
  return `<button class="heat-cell heat-${lvl}" onclick="focusKey('${k}')" title="${esc(k)} · ${seen} voicings estudados"><b>${esc(k)}</b><span class="heat-bar"><u style="width:${seen?st:0}%"></u></span><i>${seen?st+'%':'—'}</i></button>`;
 }).join('');
 const seenKeys=order.filter(k=>keySeen(k));
 const weak=seenKeys.filter(k=>keyStrength(k)<80).sort((a,b)=>keyStrength(a)-keyStrength(b)).slice(0,3);
 const note=document.getElementById('heat-note');
 if(note)note.textContent=!seenKeys.length?'Estude qualquer trilha para o mapa se preencher.':weak.length?`Mais frágeis: ${weak.join(' · ')} — use o ciclo "Mais fracos"`:'Nenhum tom abaixo de 80% entre os estudados.';
}
function focusKey(k){
 if(!KEYS[k])return;
 setStudyKey(k);
 document.getElementById('study-key').value=k;
 window.scrollTo({top:0,behavior:'smooth'});
}
/* ================= painel do metrônomo ================= */
function openMetroPanel(){renderMetroPanel();openOverlay('metro-overlay')}
function toggleAccent(i){
 const m=normMetro(state.metro),set=new Set(m.accents);
 if(set.has(i))set.delete(i);else set.add(i);
 m.accents=[...set].sort((a,b)=>a-b);
 state.metro=normMetro(m);
 if(session){session.metro2=normMetro(state.metro);renderTransport()}
 saveState();renderMetroPanel();renderGlobalMetronome();
}
function accentLabel(accents){return accents.length?`acento ${accents.map(i=>i+1).join('·')}`:'sem acento'}
function metroSet(field,value){
 const m=normMetro(state.metro);m[field]=value;state.metro=normMetro(m);
 if(session){session.metro2=normMetro(state.metro);if(session.playing)startSessionClock();renderTransport()}
 if(globalMetroPlaying)startGlobalMetronome();
 saveState();renderMetroPanel();renderGlobalMetronome();
}
function metroRow(label,field,options,hint){
 const m=normMetro(state.metro);
 return `<div class="metro-row"><div><div class="setup-label" style="margin:0">${label}</div>${hint?`<div class="tiny">${hint}</div>`:''}</div><div class="choice-row">${options.map(o=>`<button class="choice${m[field]===o.v?' active':''}" onclick="metroSet('${field}',${typeof o.v==='string'?`'${o.v}'`:o.v})">${o.n}</button>`).join('')}</div></div>`;
}
/* Escolher para onde o clique vai (in-ear em vez do PA) só existia no módulo de
   cifras; veio junto com o motor compartilhado. */
async function renderSaidaAudio(){
 const linha=document.getElementById('metro-saida');
 if(!linha)return;
 if(!Metronomo.podeEscolherSaida()){linha.innerHTML='';return}
 const saidas=await Metronomo.listarSaidas(),atual=Metronomo.saidaAtual();
 linha.innerHTML=`<div class="metro-row"><div><div class="setup-label" style="margin:0">Saída do clique</div><div class="tiny">Mande o metrônomo para o fone sem vazar no som da casa.</div></div><div class="choice-row"><select class="search" style="margin:0;min-width:190px" onchange="setSaidaAudio(this.value)">${saidas.map(o=>`<option value="${esc(o.id)}"${o.id===atual?' selected':''}>${esc(o.nome)}</option>`).join('')}</select></div></div>`;
}
async function setSaidaAudio(id){
 const escolhida=await Metronomo.usarSaida(id);
 try{localStorage.setItem('repertorio-metro-out',escolhida||'')}catch(e){}
 renderSaidaAudio();
}
function restaurarSaidaAudio(){
 try{Metronomo.definirSaidaSalva(localStorage.getItem('repertorio-metro-out')||'')}catch(e){}
}
function renderMetroPanel(){
 const box=document.getElementById('metro-panel');if(!box)return;
 const m=normMetro(state.metro);
 const groove=GROOVES.find(g=>g.id===m.groove)||GROOVES[0];
 const meter=Math.max(2,(groove.hits.length?groove.meter:m.meter));
 const accentRow=`<div class="metro-row"><div><div class="setup-label" style="margin:0">Acento</div><div class="tiny">Marque os tempos que devem soar mais forte. Sem nenhum marcado, o clique fica plano — bom para não se apoiar no tempo 1.</div></div><div class="choice-row">${Array.from({length:meter},(_,i)=>`<button class="choice${m.accents.includes(i)?' active':''}" onclick="toggleAccent(${i})">${i+1}</button>`).join('')}</div></div>`;
 box.innerHTML=
  `<div class="metro-row"><div><div class="setup-label" style="margin:0">Levada de comping</div><div class="tiny">${esc(groove.desc)} O app toca o acorde no ritmo; você acompanha ou responde.</div></div><div class="choice-row">${GROOVES.map(g=>`<button class="choice${m.groove===g.id?' active':''}" onclick="metroSet('groove','${g.id}')">${g.name}</button>`).join('')}</div></div>`+
  metroRow('Subdivisão','sub',[{v:1,n:'Semínimas'},{v:2,n:'Colcheias'},{v:3,n:'Tercinas'},{v:4,n:'Semicolcheias'}],'Cliques por tempo.')+
  metroRow('Compasso','meter',[{v:3,n:'3/4'},{v:4,n:'4/4'},{v:5,n:'5/4'},{v:6,n:'6/8'}],'Quantos tempos o ciclo tem.')+
  accentRow+
  metroRow('Acelerar sozinho','rampEvery',[{v:0,n:'Desligado'},{v:4,n:'a cada 4 comp.'},{v:8,n:'a cada 8 comp.'},{v:16,n:'a cada 16 comp.'}],`Sobe ${m.rampStep} BPM até ${m.rampMax}.`)+
  metroRow('Passo do aumento','rampStep',[{v:2,n:'+2'},{v:3,n:'+3'},{v:5,n:'+5'}])+
  metroRow('Teto do aumento','rampMax',[{v:120,n:'120'},{v:140,n:'140'},{v:160,n:'160'},{v:200,n:'200'}])+
  metroRow('Compassos mudos','silentOn',[{v:0,n:'Desligado'},{v:3,n:'3 com som'},{v:2,n:'2 com som'}],'O clique some por alguns compassos para testar seu pulso interno.')+
  metroRow('Compassos em silêncio','silentOff',[{v:0,n:'Nenhum'},{v:1,n:'1 mudo'},{v:2,n:'2 mudos'}])+
  `<div class="metro-row"><div><div class="setup-label" style="margin:0">Tocar o acorde na troca</div><div class="tiny">Referência sonora a cada acorde novo.</div></div><div class="choice-row"><button class="choice${m.chord?' active':''}" onclick="metroSet('chord',${!m.chord})">${m.chord?'Ligado':'Desligado'}</button><button class="choice" onclick="playCurrentChord()">Ouvir agora</button></div></div>`+
  `<div id="metro-saida"></div>`;
 renderSaidaAudio();
}
/* ================= backup do progresso ================= */
function exportPayload(){return JSON.stringify({app:'repertorio-estudos',version:1,exportedAt:new Date().toISOString(),state},null,1)}
function renderDataPanel(){
 const box=document.getElementById('data-panel');if(!box)return;
 const reviews=Object.keys(state.reviews).length,minutes=state.sessions.reduce((n,s)=>n+(s.minutes||0),0);
 box.innerHTML=`<p class="muted">${reviews} revisões registradas · ${state.sessions.length} sessões · ${minutes} minutos. O progresso fica no navegador deste app, então exporte para levar a outro aparelho.</p>
 <div class="choice-row" style="margin:14px 0">
  <button class="btn primary" onclick="downloadProgress()">Baixar arquivo</button>
  <button class="btn" onclick="copyProgress()">Copiar JSON</button>
  <label class="btn" style="cursor:pointer">Importar arquivo<input type="file" accept="application/json,.json" style="display:none" onchange="importFile(this)"></label>
 </div>
 <div class="setup-label">Ou cole um backup aqui</div>
 <textarea id="data-text" class="data-text" spellcheck="false" placeholder="Cole o JSON exportado…"></textarea>
 <div class="choice-row" style="margin-top:10px"><button class="btn" onclick="importText('merge')">Mesclar</button><button class="btn" onclick="importText('replace')">Substituir tudo</button><span class="tiny" id="data-msg"></span></div>
 <div class="setup-label" style="margin-top:22px">Recomeçar a medição</div>
 <p class="tiny" style="margin-bottom:10px">Zera o domínio dos voicings, o mapa dos 12 tons, a fila de revisão e os PRs de andamento. Minutos praticados, sessões e streak continuam.</p>
 <button class="btn" onclick="resetReviews()">Zerar histórico de revisões</button>`;
}
/* O domínio e os PRs de andamento foram medidos por uma régua que dava "firme"
   automaticamente. Zerar é o caminho honesto quando a régua muda: as sessões e
   os minutos praticados ficam, porque aconteceram de verdade. */
function resetReviews(){
 const itens=Object.keys(state.reviews).length,prs=Object.keys(state.bpmPr||{}).length;
 if(!itens&&!prs)return dataMsg('Não há histórico de revisões para zerar.');
 if(!confirm(`Apagar ${itens} registro(s) de revisão e ${prs} PR(s) de andamento?\n\nO domínio dos voicings e o mapa dos 12 tons voltam ao zero, e a fila de revisão recomeça. Minutos praticados, sessões e streak são preservados.`))return;
 state.reviews={};state.bpmPr={};
 saveState();renderDashboard();renderChords();renderDataPanel();
 dataMsg(`${itens} revisão(ões) e ${prs} PR(s) apagados. O domínio recomeça do zero.`);
}
function dataMsg(text){const el=document.getElementById('data-msg');if(el)el.textContent=text}
function downloadProgress(){
 try{
  const blob=new Blob([exportPayload()],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`repertorio-estudos-${dateKey()}.json`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},400);
  dataMsg('Arquivo gerado.');
 }catch(e){dataMsg('Não foi possível baixar; use copiar JSON.')}
}
function copyProgress(){
 const text=exportPayload();
 const done=()=>dataMsg('JSON copiado.');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done));
 else fallbackCopy(text,done);
}
function fallbackCopy(text,done){
 const ta=document.getElementById('data-text');
 if(!ta)return dataMsg('Copie manualmente pelo campo abaixo.');
 ta.value=text;ta.select();try{document.execCommand('copy');done()}catch(e){dataMsg('Selecione o texto e copie manualmente.')}
}
function importFile(input){
 const file=input.files&&input.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{const ta=document.getElementById('data-text');if(ta)ta.value=String(reader.result||'');dataMsg('Arquivo carregado. Escolha mesclar ou substituir.')};
 reader.readAsText(file);
 input.value='';
}
function importText(mode){
 const ta=document.getElementById('data-text');
 if(!ta||!ta.value.trim())return dataMsg('Cole ou carregue um backup primeiro.');
 let data;
 try{data=JSON.parse(ta.value)}catch(e){return dataMsg('JSON inválido.')}
 const incoming=data&&data.state?data.state:data;
 if(!incoming||typeof incoming!=='object'||!incoming.reviews)return dataMsg('Backup não reconhecido.');
 if(mode==='replace'&&!confirm('Substituir todo o progresso atual por este backup?'))return;
 if(mode==='replace')state=normalizeImported(incoming);
 else state=mergeState(state,normalizeImported(incoming));
 applyImportedSettings();
 saveState();
 dataMsg(mode==='replace'?'Progresso substituído.':'Backups mesclados.');
}
function applyImportedSettings(){
 studyKey=KEYS[state.key]?state.key:'C';
 allKeys=state.keyMode!=='single';
 cycleOrder=CYCLE_ORDERS_ALL.includes(state.cycleOrder)?state.cycleOrder:'fifths';
 dynamicOrder=null;
 setup.bpm=state.sessionBpm;setup.advance=state.sessionAdvance;setup.metro=!!state.sessionMetro;setup.hide=!state.sessionKb;
 document.getElementById('study-key').value=allKeys?'ALL':studyKey;
 document.getElementById('cycle-order').value=cycleOrder;
 document.getElementById('cycle-picker').style.display=allKeys?'flex':'none';
 rebuildHarmony();pruneStaleProgress();
 if(typeof aplicarLimitesMini==='function')aplicarLimitesMini();
 syncSetupControls();
 if(typeof syncKbUi==='function')syncKbUi();
 renderDashboard();renderChords();renderExercises();renderScales();renderTechnique();
}
function normalizeImported(raw){
 return{
  reviews:raw.reviews&&typeof raw.reviews==='object'?raw.reviews:{},
  sessions:Array.isArray(raw.sessions)?raw.sessions:[],
  dailyGoal:Number(raw.dailyGoal)||5,
  key:KEYS[raw.key]?raw.key:'C',
  keyMode:raw.keyMode==='single'?'single':'all',
  cycleOrder:CYCLE_ORDERS_ALL.includes(raw.cycleOrder)?raw.cycleOrder:'fifths',
  techniqueBpms:raw.techniqueBpms||{},
  bpmPr:raw.bpmPr||{},
  scaleKeys:raw.scaleKeys&&typeof raw.scaleKeys==='object'?raw.scaleKeys:{},
  songPlan:raw.songPlan&&typeof raw.songPlan==='object'?raw.songPlan:{},
  metro:normMetro(raw.metro),
  sessionBpm:Math.min(220,Math.max(40,Number(raw.sessionBpm)||80)),
  sessionAdvance:[0,4,8,16].includes(Number(raw.sessionAdvance))?Number(raw.sessionAdvance):0,
  sessionMetro:!!raw.sessionMetro,sessionKb:!!raw.sessionKb,
  kb:normKb(raw.kb),
  miniTempo:raw.miniTempo&&typeof raw.miniTempo==='object'?raw.miniTempo:{},
  ponte:normPonte(raw.ponte),
  exams:Array.isArray(raw.exams)?raw.exams:[],
  journal:Array.isArray(raw.journal)?raw.journal:[],
  culto:raw.culto&&typeof raw.culto.repId==='string'?raw.culto:null,
  evo:raw.evo&&typeof raw.evo==='object'?raw.evo:{},
  minist:Array.isArray(raw.minist)?raw.minist:[],
  languageStudy:normLanguageStudy(raw.languageStudy),
  toneStudy:normToneStudy(raw.toneStudy)
 };
}
function mergeState(a,b){
 const reviews={...a.reviews};
 Object.entries(b.reviews||{}).forEach(([k,v])=>{
  const cur=reviews[k];
  if(!cur||((v.attempts||0)>(cur.attempts||0)))reviews[k]=v;
 });
 const seen=new Set(),sessions=[...(a.sessions||[]),...(b.sessions||[])].filter(s=>{const k=`${s.date}|${s.focus}`;if(seen.has(k))return false;seen.add(k);return true}).sort((x,y)=>String(x.date).localeCompare(String(y.date))).slice(-365);
 const bpmPr={...a.bpmPr};
 Object.entries(b.bpmPr||{}).forEach(([k,v])=>{bpmPr[k]=Math.max(Number(bpmPr[k])||0,Number(v)||0)});
 const techniqueBpms={...a.techniqueBpms};
 Object.entries(b.techniqueBpms||{}).forEach(([k,v])=>{techniqueBpms[k]=Math.max(Number(techniqueBpms[k])||0,Number(v)||0)});
 const scaleKeys={...(a.scaleKeys||{})};
 Object.entries(b.scaleKeys||{}).forEach(([id,keys])=>{
  scaleKeys[id]=[...new Set([...(scaleKeys[id]||[]),...(Array.isArray(keys)?keys:[])])];
 });
 const songPlan={...(a.songPlan||{})};
 Object.entries(b.songPlan||{}).forEach(([id,steps])=>{
  songPlan[id]=[...new Set([...(songPlan[id]||[]),...(Array.isArray(steps)?steps:[])])];
 });
 const miniTempo={...(a.miniTempo||{}),...(b.miniTempo||{})};
 const kb=(b.kb&&b.kb.calibrated)?normKb(b.kb):normKb(a.kb||b.kb);
 const pa=normPonte(a.ponte),pb=normPonte(b.ponte);
 const ponte=!pa?pb:!pb?pa:(pa.feito!==pb.feito)?(pa.feito?pb:pa):(String(pa.at)>=String(pb.at)?pa:pb);
 const porData=(x,y,n)=>{const m=new Map();[...(x||[]),...(y||[])].forEach(e=>{if(e&&e.date)m.set(e.date,e)});return[...m.values()].sort((p,q)=>String(q.date).localeCompare(String(p.date))).slice(0,n)};
 const exams=porData(a.exams,b.exams,24),journal=porData(a.journal,b.journal,60),minist=porData(a.minist,b.minist,30);
 const evo={...(b.evo||{}),...(a.evo||{})},culto=a.culto||b.culto||null;
 const languageStudy=mergeLanguageStudy(a.languageStudy,b.languageStudy);
 const toneStudy=mergeToneStudy(a.toneStudy,b.toneStudy);
 return{...a,reviews,sessions,bpmPr,techniqueBpms,scaleKeys,songPlan,miniTempo,kb,ponte,exams,journal,minist,evo,culto,languageStudy,toneStudy};
}
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('#chord-filters .filter').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;document.querySelectorAll('#chord-filters .filter').forEach(x=>x.classList.toggle('active',x===b));renderChords()});document.getElementById('chord-search').addEventListener('input',renderChords);
document.getElementById('song-search').addEventListener('input',e=>{songQuery=e.target.value;renderSongs()});
document.getElementById('rep-filter').addEventListener('change',e=>{songFilter=e.target.value;renderSongs()});
document.querySelectorAll('#scale-filters .filter').forEach(b=>b.onclick=()=>{activeScaleFilter=b.dataset.scaleFilter;document.querySelectorAll('#scale-filters .filter').forEach(x=>x.classList.toggle('active',x===b));renderScales()});document.querySelectorAll('#technique-filters .filter').forEach(b=>b.onclick=()=>{activeTechFilter=b.dataset.techFilter;document.querySelectorAll('#technique-filters .filter').forEach(x=>x.classList.toggle('active',x===b));renderTechnique()});
const PRACTICE_OVERLAYS=new Set(['session-overlay','ear-overlay','technique-overlay','exam-overlay','minist-overlay']);
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{
 if(e.target!==o||PRACTICE_OVERLAYS.has(o.id))return;
 closeOverlay(o.id);
}));
document.addEventListener('keydown',e=>{
 if(e.key==='Tab')return trapOverlayTab(e);
 if(e.key!=='Escape')return;
 const open=[...document.querySelectorAll('.overlay.open')].pop();if(!open)return;
 if(open.id==='session-overlay')return requestEndSession();
 if(open.id==='ear-overlay')return hideEar();
 if(PRACTICE_OVERLAYS.has(open.id))return;
 closeOverlay(open.id);
});
document.addEventListener('keydown',e=>{
 const open=[...document.querySelectorAll('.overlay.open')].pop();
 if(!open||open.id!=='scale-overlay')return;
 const t=e.target;if(t&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))return;
 if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();return shiftScaleKey(1)}
 if(e.key==='ArrowLeft'){e.preventDefault();return shiftScaleKey(-1)}
});
document.addEventListener('keydown',e=>{
 if(!session||!document.getElementById('session-overlay').classList.contains('open'))return;
 const t=e.target;if(t&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))return;
 if(e.metaKey||e.ctrlKey||e.altKey)return;
 const k=e.key.toLowerCase(),peek=document.getElementById('peek-overlay').classList.contains('open');
 if(['metro-overlay','data-overlay','setup-overlay','summary-overlay','detail-overlay','scale-overlay'].some(id=>document.getElementById(id).classList.contains('open')))return;
 if(peek&&k!=='d')return;
 if(k==='d'){e.preventDefault();return peekVoicing()}
 if(k===' '||k==='arrowright'){e.preventDefault();return stepSession(1)}
 if(k==='arrowleft'){e.preventDefault();return stepSession(-1)}
 if(k==='1'||k==='2'||k==='3'){e.preventDefault();return rateCurrent(Number(k)-1)}
 if(k==='g'){e.preventDefault();return toggleDegreeMode()}
 if(k==='c'){e.preventDefault();return stepDensity(e.shiftKey?-1:1)}
 if(k==='h'){e.preventDefault();return cycleHands()}
 if(k==='o'){e.preventDefault();return playCurrentChord()}
 if(k==='r'){e.preventDefault();return session.ear?revealEar():toggleEar()}
 if(k==='m'){e.preventDefault();return toggleSessionSound()}
 if(k==='p'){e.preventDefault();return toggleTransport()}
 if(k==='a'){e.preventDefault();const seq=[0,4,8,16];return setAdvance(seq[(seq.indexOf(session.advance)+1)%seq.length])}
 if(k==='+'||k==='='){e.preventDefault();return changeBpm(5)}
 if(k==='-'||k==='_'){e.preventDefault();return changeBpm(-5)}
});
async function loadData(){
 const res=await fetch('estudos-data.json',{cache:'no-cache'});
 if(!res.ok)throw new Error(`HTTP ${res.status}`);
 const d=await res.json();
 const need=['voicings','progressions','scales','technique','paths'];
 const missing=need.filter(k=>!Array.isArray(d[k])||!d[k].length);
 if(missing.length)throw new Error(`estudos-data.json sem ${missing.join(', ')}`);
 PLAN=d.plan||null;EAR_DRILLS=Array.isArray(d.ear)?d.ear:[];BANDA_DRILLS=Array.isArray(d.banda)?d.banda:[];VOICING_TEMPLATES=d.voicings;PROGRESSION_TEMPLATES=d.progressions;SCALE_TEMPLATES=d.scales;TECHNIQUE_EXERCISES=d.technique;paths=d.paths;
 PATH_ORDER=paths.flatMap(p=>p.ids);
}
function boot(){
 if(!window.__TAURI__&&'serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
 }
 restaurarSaidaAudio();
 document.addEventListener('pointerdown',()=>{if(window.Metronomo)Metronomo.liberar()},{capture:true,passive:true});
 rebuildHarmony();
 pruneStaleProgress();
 document.getElementById('study-key').value=allKeys?'ALL':studyKey;
 document.getElementById('cycle-order').value=cycleOrder;
 document.getElementById('cycle-picker').style.display=allKeys?'flex':'none';
 if(typeof aplicarLimitesMini==='function'&&aplicarLimitesMini())saveState();
 if(typeof syncKbUi==='function')syncKbUi();
 restoreEarLive();
 renderDashboard();renderChords();renderExercises();renderScales();renderTechnique();renderGlobalMetronome();renderPlan();renderEar();renderBanda();renderModulation();renderRec();
 restoreBlockClock();
}
function showDataError(err){
 const msg=`Não foi possível carregar <b>estudos-data.json</b> (${esc(err&&err.message||err)}). Abra o módulo pelo app ou por um servidor local — <code>npm run serve</code> — em vez de abrir o arquivo direto.`;
 document.getElementById('path-grid').innerHTML=`<div class="empty">${msg}</div>`;
 document.getElementById('today-exercises').innerHTML='';
 const card=document.getElementById('review-card');if(card)card.innerHTML=`<div class="review-main"><div class="eyebrow">Dados do módulo</div><h2>Biblioteca não carregada</h2><p class="muted">${msg}</p></div>`;
}
loadData().then(boot).catch(showDataError);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  if(blockRun&&!blockRun.paused){blockRun.hidePause=true;pauseBlock()}
  if(session&&!session.paused){session.hidePause=true;toggleSessionPause()}
 }else{
  if(blockRun&&blockRun.hidePause){blockRun.hidePause=false;resumeBlock()}
  if(session&&session.hidePause){session.hidePause=false;if(session.paused)toggleSessionPause()}
 }
});
window.addEventListener('pagehide',()=>{if(blockRun)persistBlockClock();if(earRun)persistEarLive()});
