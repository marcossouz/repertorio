/* Culto, ministração e evolução.

   O método termina no domingo, mas o domingo não entrava na semana. Aqui o
   repertório da escala vira o material de estudo, o momento da ministração
   ganha medida pelo MIDI e a semana vira curva. */

/* ================= preparar o culto =================

   Escolhido o repertório do domingo: as músicas entram no ciclo de 7 dias, as
   passagens entre elas viram modulação com os tons reais e os acordes que elas
   usam e ainda não estão firmes sobem na fila de revisão. */
let cultoCache=null;
function cultoReps(){return REPERTOIRES.filter(r=>r&&!r.archived&&Array.isArray(r.songs)&&r.songs.length)}
function cultoRep(){
 const id=state.culto&&state.culto.repId;
 return id?cultoReps().find(r=>r.id===id)||null:null;
}
function setCultoRep(id){
 state.culto=id?{repId:id,at:new Date().toISOString()}:null;
 cultoCache=null;saveState();
 renderCulto();renderTodayPlan();renderReviewCard();
}
function cultoSongs(){
 const rep=cultoRep();if(!rep)return[];
 return rep.songs.map(id=>SONGS.find(s=>s.id===id)).filter(s=>s&&songKeyName(s)&&songChords(s).seq.length);
}
function passagemSugerida(de,para){
 const d=((KEYS[para].offset-KEYS[de].offset)%12+12)%12;
 return d===0?'':d===1?'half':'dominant';
}
/* acorde da música -> voicing do catálogo no tom em que ele soa */
function cultoAcordes(){
 const rep=cultoRep();if(!rep)return[];
 const sig=`${rep.id}|${rep.songs.join(',')}|${SONGS.length}`;
 if(cultoCache&&cultoCache.sig===sig)return cultoCache.list;
 const mapa=new Map();
 cultoSongs().forEach(s=>{
  const tom=songKeyName(s);
  songChords(s).unicos.forEach(ch=>{
   const t=VOICING_TEMPLATES.find(v=>v.id===REP_TEMPLATE[ch.quality]);if(!t)return;
   const key=keyAt(tom,ch.root-t.root),k=`${t.id}@${key}`;
   if(!mapa.has(k))mapa.set(k,{id:t.id,key,nome:chordInKey(t.id,key).name,musicas:new Set()});
   mapa.get(k).musicas.add(s.title);
  });
 });
 cultoCache={sig,list:[...mapa.values()]};
 return cultoCache.list;
}
function cultoChaves(){return new Set(cultoAcordes().map(x=>`${x.id}@${x.key}`))}
function cultoFracos(){return cultoAcordes().filter(x=>itemState(x.id,x.key).strength<75)}
function startCultoFracos(){
 const q=cultoFracos();if(!q.length)return;
 beginSession([...new Set(q.map(x=>x.id))],'Acordes do domingo','Os acordes das músicas da escala que ainda não estão firmes, no tom em que vão soar.',false,q.map(x=>({id:x.id,key:x.key})),'revisao');
}
function startPassagem(i){
 const lista=cultoSongs(),A=lista[i],B=lista[i+1];if(!A||!B)return;
 const de=songKeyName(A),para=songKeyName(B);
 const sel=document.getElementById(`culto-ponte-${i}`);
 const b=MOD_BRIDGES.find(x=>x.id===(sel?sel.value:passagemSugerida(de,para)));
 const fimA=songChords(A).seq.slice(-1)[0],iniB=songChords(B).seq[0];
 songSpecs.clear();
 const idA=`song:${A.id}:fim`,idB=`song:${B.id}:ini`;
 specFromChord(fimA,idA);specFromChord(iniB,idB);
 const uma=[{id:idA,key:de},...(de===para||!b?[]:b.steps(para)),{id:idB,key:para}];
 const fila=[0,1,2,3].flatMap(()=>uma.map(x=>({...x})));
 const dica=de===para?'Mesmo tom: o fim de uma emenda no começo da outra sem parar o pulso.':`${de} → ${para} · ${b.name}. ${b.tip}`;
 beginSession([...new Set(uma.map(x=>x.id))],`${A.title} → ${B.title}`,dica,true,fila,'mod:culto');
}
function cultoProximoPasso(song){
 const feitos=songPlan(song.id);
 return SONG_STEPS.findIndex((_,i)=>!feitos.includes(i));
}
function cultoHojeHtml(){
 if(!state.culto||!state.culto.repId)return '';
 if(songsState!=='ready'){if(songsState==='idle')ensureSongs().then(()=>{if(songsState==='ready')renderTodayPlan()});return ''}
 const rep=cultoRep();if(!rep)return '';
 const songs=cultoSongs(),pend=songs.filter(s=>cultoProximoPasso(s)>=0).length,fracos=cultoFracos().length;
 return`<div class="journal-week"><div><span class="setup-label">Domingo · ${esc(rep.name)}</span><i>${songs.length} músicas · ${pend?`${pend} com passo do ciclo pendente`:'ciclo das músicas completo'} · ${fracos?`${fracos} acordes ainda fracos`:'acordes firmes'}</i></div>
  <div class="journal-focos"><button class="btn" type="button" onclick="showView('culto')">Preparar</button></div></div>`;
}
function renderCulto(){
 const box=document.getElementById('culto-prep');if(!box)return;
 if(songsState!=='ready'){
  box.innerHTML='<div class="empty">Lendo a biblioteca…</div>';
  ensureSongs().then(()=>{if(songsState==='ready')renderCulto()});
  return;
 }
 const reps=cultoReps(),rep=cultoRep();
 const pick=`<select class="search" style="margin:0;min-width:220px" onchange="setCultoRep(this.value)" aria-label="Repertório do domingo">
  <option value="">Escolha o repertório…</option>${reps.map(r=>`<option value="${esc(r.id)}"${rep&&rep.id===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</select>`;
 if(!rep){
  box.innerHTML=`<div class="culto-head"><div><div class="eyebrow">Próximo domingo</div><h2>Qual repertório você vai tocar?</h2><p class="muted">As músicas entram no ciclo de 7 dias, as passagens entre elas viram treino de modulação e os acordes fracos sobem na revisão.</p></div>${pick}</div>`;
  renderMinistCard();
  return;
 }
 const songs=cultoSongs(),fracos=cultoFracos(),todos=cultoAcordes();
 const linhas=songs.map((s,i)=>{
  const tom=songKeyName(s),pr=songProgress(s),prox=cultoProximoPasso(s),sid=esc(s.id);
  return`<div class="culto-song"><span class="culto-n">${i+1}</span>
   <div class="culto-body"><b>${esc(s.title)}</b><i>tom ${esc(tom)} · ${pr.n}/7 do ciclo${prox>=0?` · próximo: ${esc(SONG_STEPS[prox].n)}`:' · ciclo completo'}</i></div>
   ${prox>=0?`<button class="btn primary" type="button" onclick="startSongStep('${sid}',${prox})">${prox+1}. ${esc(SONG_STEPS[prox].n)}</button>`:''}
   <button class="btn" type="button" onclick="startSongSession('${sid}','sequence')">Sequência</button></div>`;
 });
 const passagens=songs.slice(0,-1).map((A,i)=>{
  const B=songs[i+1],de=songKeyName(A),para=songKeyName(B),sug=passagemSugerida(de,para);
  return`<div class="culto-pass"><div class="culto-body"><b>${esc(de)} → ${esc(para)}</b><i>${esc(A.title)} → ${esc(B.title)}</i></div>
   ${de===para?'<span class="tag">mesmo tom</span>':`<select class="search" style="margin:0" id="culto-ponte-${i}" aria-label="Ponte">${MOD_BRIDGES.map(b=>`<option value="${b.id}"${b.id===sug?' selected':''}>${esc(b.name)}</option>`).join('')}</select>`}
   <button class="btn" type="button" onclick="startPassagem(${i})">Treinar passagem</button></div>`;
 });
 box.innerHTML=`<div class="culto-head"><div><div class="eyebrow">Próximo domingo${state.culto.at?` · escolhido em ${esc(fmtDate(dateKey(state.culto.at)))}`:''}</div><h2>${esc(rep.name)}</h2><p class="muted">${songs.length} músicas. Um passo do ciclo por música por dia, as passagens nos tons reais e, por fim, os acordes que ainda não estão firmes.</p></div>${pick}</div>
  <div class="section-head"><div><div class="eyebrow">Ciclo de 7 dias</div><h3>As músicas da escala</h3></div></div>
  <div class="culto-list">${linhas.join('')||'<div class="empty">Nenhuma música deste repertório tem cifra em graus.</div>'}</div>
  <div class="section-head"><div><div class="eyebrow">Modulação</div><h3>As passagens entre as músicas</h3></div><p>O último acorde de uma, a ponte, o primeiro da outra. Quatro vezes</p></div>
  <div class="culto-list">${passagens.join('')||'<div class="empty">Uma música só: não há passagem.</div>'}</div>
  <div class="review-card" style="margin-top:18px"><div class="review-main"><div class="eyebrow">Revisão</div>
   <h2>${fracos.length?`${fracos.length} de ${todos.length} acordes ainda fracos`:`Os ${todos.length} acordes estão firmes`}</h2>
   <p class="muted">${fracos.length?esc(fracos.slice(0,10).map(x=>x.nome).join(' · '))+(fracos.length>10?' …':'')+'. Eles também passam na frente da revisão do dia.':'Nada a revisar para este repertório.'}</p>
   <div class="review-actions"><button class="btn primary" type="button" onclick="startCultoFracos()" ${fracos.length?'':'disabled'}>Revisar os acordes do domingo</button></div></div></div>`;
 renderMinistCard();
}

/* ================= ministração =================

   O trecho do culto que nenhum exercício cobria: dois a quatro acordes por
   minutos, e a música crescendo e voltando. O que se mede é a dinâmica — a
   média de velocity de cada compasso contra uma curva que sobe de pp a ff e
   volta. Tocar tudo no mesmo volume aparece na hora como "faixa estreita". */
const MINIST_LOOPS=['1 4','1 5 6m 4','6m 4 1 5','4 1/3 2m7 5sus4'];
const MINIST_PISO=28,MINIST_TETO=112;
let ministRun=null;
function ministAlvo(c,total){return Math.round(MINIST_PISO+(MINIST_TETO-MINIST_PISO)*Math.sin(Math.PI*(c+.5)/total))}
function ministRotulo(v){return DINAMICAS.filter(d=>d.alvo!=null).reduce((a,d)=>Math.abs(d.alvo-v)<Math.abs(a.alvo-v)?d:a).n}
function ministTomPadrao(){const s=cultoSongs()[0];return s?songKeyName(s):(allKeys?'C':studyKey)}
function renderMinistCard(){
 const box=document.getElementById('minist-card');if(!box)return;
 const ult=(state.minist||[])[0],mini=kbIsMini(),tom=ministTomPadrao();
 const sel=(id,opts,val)=>`<select class="search" style="margin:0" id="${id}">${opts.map(o=>`<option value="${esc(o[0])}"${String(o[0])===String(val)?' selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
 box.innerHTML=`<div class="review-main"><div class="eyebrow">Ministração</div>
  <h2>${ult?`Última: ${ult.dentro}% na curva · faixa ${ult.faixa}`:'Loop longo, dinâmica medida'}</h2>
  <p class="muted">Poucos acordes por vários minutos. A tela pede um volume por compasso, subindo de pp até ff e voltando; o MIDI mede a força das teclas. ${mini?'Dinâmica pede o teclado completo: troque o seletor para Completo.':'Precisa do teclado MIDI.'}</p>
  <div class="minist-opts">
   ${sel('minist-loop',MINIST_LOOPS.map(l=>[l,l]),MINIST_LOOPS[1])}
   ${sel('minist-key',CYCLE_ORDERS.chromatic.map(k=>[k,`tom ${k}`]),tom)}
   ${sel('minist-min',[[3,'3 min'],[5,'5 min'],[8,'8 min']],3)}
   ${sel('minist-bpm',[[60,'60 BPM'],[68,'68 BPM'],[76,'76 BPM']],68)}
  </div>
  <div class="review-actions"><button class="btn primary" type="button" onclick="startMinist()" ${mini?'disabled':''}>Começar</button></div></div>`;
}
function startMinist(){
 if(kbIsMini())return;
 const v=id=>document.getElementById(id).value;
 const loop=v('minist-loop'),key=v('minist-key'),bpm=Number(v('minist-bpm'))||68,min=Number(v('minist-min'))||3;
 const acordes=parseDegreeLine(loop,false);if(!acordes.length)return;
 const ids=acordes.map((ch,i)=>{const id=`minist:${i}`;specFromChord(ch,id);return id});
 if(window.Metronomo)Metronomo.liberar();
 if(ministRun)stopBeat();
 ministRun={loop,key,bpm,min,ids,total:Math.max(8,Math.round(min*bpm/4)),compasso:-1,barras:[],rodando:true,t0:Date.now(),relatorio:null};
 openOverlay('minist-overlay');renderMinistLive();
 startClock({bpm:()=>ministRun.bpm,sub:()=>1,level:n=>n%4===0?0:-1,onTick:ministTick});
}
function ministTick(n){
 if(!ministRun||!ministRun.rodando)return;
 const c=Math.floor(n/4);
 if(c===ministRun.compasso)return;
 if(c>=ministRun.total)return finishMinist();
 ministRun.compasso=c;
 ministRun.barras[c]={alvo:ministAlvo(c,ministRun.total),vels:[]};
 ministRun.acorde=chordInKey(ministRun.ids[c%ministRun.ids.length],ministRun.key);
 renderMinistLive();
}
function ministMidi(cmd,note,vel){
 if(!ministRun||!ministRun.rodando||!(cmd===0x90&&vel>0))return;
 const b=ministRun.barras[ministRun.compasso];if(b)b.vels.push(vel);
}
function ministMedia(b){return b&&b.vels.length?Math.round(b.vels.reduce((a,x)=>a+x,0)/b.vels.length):null}
function finishMinist(){
 if(!ministRun)return;
 stopBeat();ministRun.rodando=false;
 const barras=ministRun.barras.filter(Boolean),medias=barras.map(ministMedia),tocadas=medias.filter(m=>m!=null);
 const dentro=barras.length?Math.round(barras.filter((b,i)=>medias[i]!=null&&Math.abs(medias[i]-b.alvo)<=DIN_TOL).length/barras.length*100):0;
 const pico=tocadas.length?Math.max(...tocadas):0,vale=tocadas.length?Math.min(...tocadas):0;
 const r={date:new Date().toISOString(),loop:ministRun.loop,key:ministRun.key,bpm:ministRun.bpm,compassos:barras.length,dentro,pico,vale,faixa:pico-vale,
  curva:barras.map((b,i)=>[b.alvo,medias[i]])};
 ministRun.relatorio=r;
 state.minist=[r,...(state.minist||[])].slice(0,30);
 state.sessions.push({date:r.date,minutes:Math.max(1,Math.round((Date.now()-ministRun.t0)/60000)),focus:'Ministração',ratings:barras.length,key:ministRun.key,kb:'full',conta:'completo'});
 state.sessions=state.sessions.slice(-365);saveState();
 renderMinistLive();renderMinistCard();renderDashboard();
}
function stopMinist(){
 stopBeat();
 ministRun=null;closeOverlay('minist-overlay');
}
async function ministLigarMidi(){await toggleMidi();renderMinistLive()}
function ministCurvaSvg(curva){
 const w=320,h=110,n=Math.max(1,curva.length),x=i=>Math.round((i+.5)/n*w),y=v=>Math.round(h-v/127*h);
 const alvo=curva.map((p,i)=>`${x(i)},${y(p[0])}`).join(' ');
 const seu=curva.map((p,i)=>p[1]==null?'':`<circle cx="${x(i)}" cy="${y(p[1])}" r="2.6" class="${Math.abs(p[1]-p[0])<=DIN_TOL?'ok':'no'}"/>`).join('');
 return`<svg class="minist-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Curva de dinâmica"><polyline points="${alvo}" class="alvo"/>${seu}</svg>`;
}
function renderMinistLive(){
 const box=document.getElementById('minist-live');
 if(!box||!ministRun)return;
 const r=ministRun.relatorio;
 if(r){
  box.innerHTML=`<div class="eyebrow minist-loop">${esc(r.loop)} · tom ${esc(r.key)} · ${r.bpm} BPM</div>
   <h2 style="margin:4px 0 10px">${r.dentro}% dos compassos na curva</h2>
   ${ministCurvaSvg(r.curva)}
   <div class="banda-metas" style="margin-top:12px">
    <div class="banda-meta ${r.faixa>=50?'ok':'no'}"><b>${r.faixa}</b><span>faixa de velocity (do mais fraco ao mais forte compasso). Abaixo de 50 a música não cresceu</span></div>
    <div class="banda-meta ${r.vale&&r.vale<=48?'ok':'no'}"><b>${r.vale||'—'}</b><span>compasso mais suave. O começo pede p ou menos</span></div>
    <div class="banda-meta ${r.pico>=96?'ok':'no'}"><b>${r.pico||'—'}</b><span>compasso mais forte. O topo pede f ou mais</span></div>
   </div>
   <div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary" onclick="startMinist()">De novo</button><button class="btn" onclick="stopMinist()">Fechar</button></div>`;
  return;
 }
 const c=ministRun.acorde,i=Math.max(0,ministRun.compasso),b=ministRun.barras[i],ant=ministRun.barras[i-1];
 const alvo=b?b.alvo:ministAlvo(0,ministRun.total),prox=ministAlvo(Math.min(i+1,ministRun.total-1),ministRun.total);
 const seu=ministMedia(ant),dir=prox>alvo+2?'crescendo':prox<alvo-2?'decrescendo':'segure';
 const midi=midiState==='on'?'':`<p class="muted" style="margin-top:8px">Sem MIDI a curva não é medida. <button class="link-btn" onclick="ministLigarMidi()">Ligar o teclado</button></p>`;
 box.innerHTML=`<div class="eyebrow minist-loop">${esc(ministRun.loop)} · tom ${esc(ministRun.key)} · ${ministRun.bpm} BPM</div>
  <div class="minist-din">${esc(ministRotulo(alvo))}<small>${dir}</small></div>
  <div class="minist-meter"><i class="alvo" style="left:${alvo/127*100}%"></i>${seu!=null?`<i class="seu${Math.abs(seu-(ant?ant.alvo:alvo))<=DIN_TOL?' ok':''}" style="left:${seu/127*100}%"></i>`:''}</div>
  <div class="banda-acorde">${c?esc(c.name):'—'} <small class="muted">${c?esc(c.degree||''):''}</small></div>
  <div class="banda-compasso">compasso ${i+1} <small>de ${ministRun.total}</small></div>
  ${midi}
  <div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="finishMinist()">Encerrar e ver</button><button class="btn ghost" onclick="stopMinist()">Sair</button></div>`;
}

/* ================= evolução =================

   Os dados já estavam lá; faltava vê-los no tempo. Minutos por semana separando
   teclado completo de 25 teclas, tempo de resposta e firmeza por semana, o teste
   mensal, e o mapa dos tons comparado com semanas atrás — este último depende de
   uma foto semanal, então a comparação começa a existir a partir da semana seguinte. */
function evoFoto(){
 state.evo=state.evo&&typeof state.evo==='object'?state.evo:{};
 const foto={};
 CYCLE_ORDERS.chromatic.forEach(k=>foto[k]=keyStrength(k));
 const wk=weekKey(),ant=state.evo[wk];
 if(ant&&CYCLE_ORDERS.chromatic.every(k=>ant[k]===foto[k]))return;
 state.evo[wk]=foto;
 const semanas=Object.keys(state.evo).sort();
 semanas.slice(0,Math.max(0,semanas.length-60)).forEach(s=>delete state.evo[s]);
 saveState();
}
function evoSemanas(n=12){
 const out=[];
 for(let i=n-1;i>=0;i--){
  const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-7*i-((d.getDay()+6)%7));
  out.push({wk:weekKey(d),rot:fmtDate(dateKey(d))});
 }
 return out;
}
function evoBarras(cols,unidade){
 const max=Math.max(1,...cols.map(c=>c.partes.reduce((a,p)=>a+p.v,0)));
 return`<div class="evo-bars">${cols.map(c=>{
  const soma=c.partes.reduce((a,p)=>a+p.v,0);
  return`<div class="evo-col" title="${esc(c.titulo||'')}"><em>${soma?esc(c.topo!=null?c.topo:soma+unidade):''}</em><div class="evo-stack">${c.partes.map(p=>`<i class="${p.cls||''}" style="height:${p.v/max*100}%"></i>`).join('')}</div><span>${esc(c.rot)}</span></div>`}).join('')}</div>`;
}
function renderEvolucao(){
 const box=document.getElementById('evo-body');if(!box)return;
 evoFoto();
 const semanas=evoSemanas(),por=new Map(semanas.map(s=>[s.wk,{full:0,mini:0,ms:0,timed:0,firm:0,total:0}]));
 state.sessions.forEach(s=>{
  const w=por.get(weekKey(new Date(s.date)));if(!w)return;
  w[s.kb==='mini'?'mini':'full']+=Number(s.minutes)||0;
  if(s.ms!=null&&s.ratings){w.ms+=s.ms*s.ratings;w.timed+=s.ratings}
  if(s.firm!=null&&s.ratings){w.firm+=s.firm;w.total+=s.ratings}
 });
 const lin=semanas.map(s=>({...s,...por.get(s.wk)}));
 const ult4=lin.slice(-4),min4=ult4.reduce((a,w)=>a+w.full+w.mini,0),full4=ult4.reduce((a,w)=>a+w.full,0);
 const comMs=lin.filter(w=>w.timed),msIni=comMs[0],msFim=comMs[comMs.length-1];
 const exams=(state.exams||[]).slice(0,12).reverse();
 const fotos=Object.keys(state.evo||{}).sort(),atual=state.evo[weekKey()];
 const base=fotos.filter(w=>w<weekKey()).slice(-8)[0];
 const tons=CYCLE_ORDERS.chromatic.map(k=>{const v=atual?atual[k]:keyStrength(k),d=base?v-state.evo[base][k]:null;return{k,v,d}});
 const minist=(state.minist||[]).slice(0,12).reverse();
 const resumo=[`Últimas 4 semanas: ${fmtMin(min4)} de estudo, ${fmtMin(full4)} no teclado completo.`,
  msIni&&msFim&&msIni!==msFim?`Tempo de resposta: de ${fmtSeg(Math.round(msIni.ms/msIni.timed))} para ${fmtSeg(Math.round(msFim.ms/msFim.timed))}.`:'',
  exams.length>=2?`Teste mensal: de ${exams[0].score}/10 para ${exams[exams.length-1].score}/10.`:''].filter(Boolean).join(' ');
 box.innerHTML=`<div class="review-card"><div class="review-main"><div class="eyebrow">Resumo</div><h2>${min4?'Onde você está':'Ainda sem histórico'}</h2><p class="muted">${esc(resumo)}</p></div></div>
  <div class="section-head"><div><div class="eyebrow">Minutos por semana</div><h3>Teclado completo e 25 teclas</h3></div><p><span class="evo-leg full"></span>completo <span class="evo-leg mini"></span>25 teclas</p></div>
  ${evoBarras(lin.map(w=>({rot:w.rot,titulo:`${w.full} min no completo · ${w.mini} no 25 teclas`,partes:[{v:w.full,cls:'full'},{v:w.mini,cls:'mini'}]})),'′')}
  <div class="section-head"><div><div class="eyebrow">Tempo de resposta</div><h3>Do acorde pedido ao acorde tocado</h3></div><p>Barra menor é melhor. Conta a partir da versão 1.8.38</p></div>
  ${evoBarras(lin.map(w=>{const ms=w.timed?Math.round(w.ms/w.timed):0;return{rot:w.rot,topo:ms?fmtSeg(ms):'',titulo:w.total?`${Math.round(w.firm/w.total*100)}% firmes`:'',partes:[{v:ms,cls:'full'}]}}),'')}
  <div class="section-head"><div><div class="eyebrow">Mapa dos tons</div><h3>${base?`Comparado com a ${esc(base.replace(/^\d+-W0?/,'semana '))}`:'Hoje'}</h3></div><p>${base?'Seta mostra quanto o tom subiu ou caiu':'A comparação aparece a partir da próxima semana'}</p></div>
  <div class="heat-strip">${tons.map(t=>`<div class="heat-cell ${t.v>=80?'heat-high':t.v>=50?'heat-mid':t.v?'heat-low':'heat-new'}"><b>${t.k}</b><i>${t.v}%${t.d?` <span class="evo-delta ${t.d>0?'up':'down'}">${t.d>0?'▲':'▼'}${Math.abs(t.d)}</span>`:''}</i><span class="heat-bar"><u style="width:${t.v}%"></u></span></div>`).join('')}</div>
  <div class="section-head"><div><div class="eyebrow">Teste mensal</div><h3>Os dez itens de fluência</h3></div></div>
  ${exams.length?evoBarras(exams.map(e=>({rot:fmtDate(dateKey(e.date)),topo:`${e.score}/10`,titulo:(e.falhas||[]).join(', '),partes:[{v:e.score,cls:'full'}]})),''):'<div class="empty">Nenhum teste ainda. Ele fica na aba Plano.</div>'}
  <div class="section-head"><div><div class="eyebrow">Ministração</div><h3>Compassos dentro da curva de dinâmica</h3></div></div>
  ${minist.length?evoBarras(minist.map(m=>({rot:fmtDate(dateKey(m.date)),topo:`${m.dentro}%`,titulo:`faixa ${m.faixa}`,partes:[{v:m.dentro,cls:'full'}]})),''):'<div class="empty">Nenhuma ministração medida ainda. Ela fica na aba Culto.</div>'}`;
}
