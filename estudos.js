/* Núcleo do módulo de estudos — estado, grafia, teclado, sessão e MIDI.

   O que é compartilhado com o módulo de cifras (leitura de graus, metrônomo)
   já saiu para graus.js e metronomo.js. O que resta aqui é o que só o estudo
   precisa para abrir uma sessão: o material, o desenho do teclado, o relógio
   da sessão e o teclado MIDI.

   Ouvido e plano estão em estudos-ouvido.js e estudos-plano.js. A ordem dos
   scripts no HTML é a ordem de execução original — nada foi reordenado. */

const STORAGE_KEY='repertorio-estudos-v1';
const KEYS={C:{offset:0,flats:false},Db:{offset:1,flats:true},D:{offset:2,flats:false},Eb:{offset:3,flats:true},E:{offset:4,flats:false},F:{offset:5,flats:true},'F#':{offset:6,flats:false},G:{offset:7,flats:false},Ab:{offset:8,flats:true},A:{offset:9,flats:false},Bb:{offset:10,flats:true},B:{offset:11,flats:false}};
const CYCLE_ORDERS={
 fifths:['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'],
 fourths:['C','F','Bb','Eb','Ab','Db','F#','B','E','A','D','G'],
 chromatic:['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']
};
const CYCLE_ORDERS_ALL=['fifths','fourths','chromatic','weak','random'];
const METRO_DEFAULT={sub:1,meter:4,accents:[0],rampEvery:0,rampStep:2,rampMax:160,silentOn:0,silentOff:0,chord:false,groove:'none'};
const GROOVES=[
 {id:'none',name:'Sem levada',meter:4,sub:1,hits:[],sustain:1,desc:'Só o clique; você decide o ritmo.'},
 {id:'pad',name:'Pad',meter:4,sub:2,hits:[0],sustain:3.4,desc:'Um acorde longo por compasso — o pad de culto.'},
 {id:'backbeat',name:'2 e 4',meter:4,sub:2,hits:[2,6],sustain:1.1,desc:'Acorde só nos tempos 2 e 4; deixa espaço para o baixo.'},
 {id:'charleston',name:'Charleston',meter:4,sub:2,hits:[0,3],sustain:1.3,desc:'1 e o "e" do 2 — a célula de comping mais usada.'},
 {id:'charleston-rev',name:'Charleston invertido',meter:4,sub:2,hits:[0,5],sustain:1.3,desc:'1 e o "e" do 3; empurra a frase para frente.'},
 {id:'anticipa',name:'Antecipação',meter:4,sub:2,hits:[0,4,7],sustain:.9,desc:'1, 3 e o "e" do 4 antecipando o próximo compasso.'},
 {id:'sixteen',name:'Semicolcheias',meter:4,sub:4,hits:[0,6,8,14],sustain:.8,desc:'1, "e" do 2, 3 e "e" do 4 — gospel e pop moderno.'},
 {id:'six-eight',name:'6/8 de culto',meter:6,sub:2,hits:[0,6,10],sustain:1.2,desc:'Pulso composto com antecipação no fim do compasso.'}
];
const NOTE_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],NOTE_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
let VOICING_TEMPLATES=[],PROGRESSION_TEMPLATES=[],SCALE_TEMPLATES=[],TECHNIQUE_EXERCISES=[],paths=[],PATH_ORDER=[];
let chords=[],exercises=[],progressionChords=[];

let state=loadState(),studyKey=KEYS[state.key]?state.key:'C',allKeys=state.keyMode!=='single',cycleOrder=CYCLE_ORDERS_ALL.includes(state.cycleOrder)?state.cycleOrder:'fifths',activeFilter='all',activeScaleFilter='all',activeTechFilter='all',setup={focus:'triad_foundation',duration:3,hide:!state.sessionKb,metro:!!state.sessionMetro,bpm:state.sessionBpm,advance:state.sessionAdvance,density:state.density,region:state.region,hands:state.hands,strict:state.strict,dinamica:state.dinamica};
if(allKeys)studyKey='C';
let session=null,sessionTimer=null,beatTimer=null,clock=null,dynamicOrder=null,tapTimes=[],midiAccess=null,midiInputs=[],midiHeld=new Set(),midiVel=new Map(),midiState='off',midiBackend=null,nativeMidiUnlisten=null,globalMetroPlaying=false,globalMetroBeatIndex=0,techniqueDrill=null,techniqueTimer=null,techniqueBeatIndex=0,scaleView=null;
/* roda na linha 34, antes de estudos-plano.js existir: nada declarado lá pode ser usado aqui, senão o catch devolve o estado vazio */
function loadState(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{reviews:raw.reviews||{},sessions:Array.isArray(raw.sessions)?raw.sessions:[],dailyGoal:Number(raw.dailyGoal)||5,key:raw.key||'C',keyMode:raw.keyMode||'all',cycleOrder:raw.cycleOrder||'fifths',techniqueBpms:raw.techniqueBpms||{},bpmPr:raw.bpmPr||{},metro:normMetro(raw.metro),sessionBpm:Math.min(220,Math.max(40,Number(raw.sessionBpm)||80)),sessionAdvance:[0,4,8,16].includes(Number(raw.sessionAdvance))?Number(raw.sessionAdvance):0,sessionMetro:!!raw.sessionMetro,sessionKb:!!raw.sessionKb,sessionChain:raw.sessionChain!==false,degreeMode:!!raw.degreeMode,density:[0,1,2,3,4,5].includes(Number(raw.density))?Number(raw.density):3,region:[-1,0,1].includes(Number(raw.region))?Number(raw.region):0,hands:['both','lh','rh'].includes(raw.hands)?raw.hands:'both',strict:['pc','bass','octave'].includes(raw.strict)?raw.strict:'pc',dinamica:['pp','p','mf','f','ff'].includes(raw.dinamica)?raw.dinamica:'off',ear:raw.ear&&typeof raw.ear==='object'?raw.ear:{},banda:raw.banda&&typeof raw.banda==='object'?raw.banda:{},leitura:raw.leitura&&typeof raw.leitura==='object'?raw.leitura:{},exams:Array.isArray(raw.exams)?raw.exams:[],journal:Array.isArray(raw.journal)?raw.journal:[],songPlan:raw.songPlan&&typeof raw.songPlan==='object'?raw.songPlan:{},scaleKeys:raw.scaleKeys&&typeof raw.scaleKeys==='object'?raw.scaleKeys:{},weekProg:raw.weekProg&&typeof raw.weekProg==='object'?raw.weekProg:null,speakDegree:!!raw.speakDegree,routine:raw.routine&&typeof raw.routine==='object'?raw.routine:null,blockClock:raw.blockClock&&typeof raw.blockClock==='object'?raw.blockClock:null,metaPropria:Number(raw.metaPropria)>0?Math.round(Number(raw.metaPropria)):0,kb:normKb(raw.kb),miniTempo:raw.miniTempo&&typeof raw.miniTempo==='object'?raw.miniTempo:{},ponte:normPonte(raw.ponte),invLivre:!!raw.invLivre,ouvirCantar:!!raw.ouvirCantar,culto:raw.culto&&typeof raw.culto.repId==='string'?raw.culto:null,evo:raw.evo&&typeof raw.evo==='object'?raw.evo:{},minist:Array.isArray(raw.minist)?raw.minist:[],languageStudy:raw.languageStudy&&typeof raw.languageStudy==='object'?raw.languageStudy:null,toneStudy:raw.toneStudy&&typeof raw.toneStudy==='object'?raw.toneStudy:null}}catch(e){return{reviews:{},sessions:[],dailyGoal:5,key:'C',keyMode:'all',cycleOrder:'fifths',techniqueBpms:{},bpmPr:{},metro:normMetro(),sessionBpm:80,sessionAdvance:0,sessionMetro:false,sessionKb:false,sessionChain:true,degreeMode:false,density:3,region:0,hands:'both',strict:'pc',dinamica:'off',ear:{},banda:{},leitura:{},exams:[],journal:[],songPlan:{},scaleKeys:{},weekProg:null,speakDegree:false,routine:null,blockClock:null,metaPropria:0,kb:normKb(null),miniTempo:{},ponte:null,invLivre:false,ouvirCantar:false,culto:null,evo:{},minist:[]}}}
function saveState(){try{state.key=studyKey;state.keyMode=allKeys?'all':'single';state.cycleOrder=cycleOrder;if(typeof setup!=='undefined'){state.sessionBpm=setup.bpm;state.sessionAdvance=setup.advance;state.sessionMetro=setup.metro;state.sessionKb=!setup.hide}localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){}publicarStatus()}
/* Resumo para o lembrete diário do Telegram (scripts/lembrete-estudos.js): só
   minutos por sessão e a meta. No app grava em ~/Documents/Repertório; no
   navegador não faz nada. Com atraso, porque saveState roda a cada clique. */
let statusTimer=null;
function publicarStatus(){
 const api=window.__TAURI__;
 if(!api||!api.core||typeof api.core.invoke!=='function')return;
 clearTimeout(statusTimer);
 statusTimer=setTimeout(()=>{
  const resumo={meta:metaDoDia(),atualizado:new Date().toISOString(),sessoes:state.sessions.slice(-400).map(x=>({data:x.date,minutos:x.minutes||0}))};
  api.core.invoke('estudos_status_write',{contents:JSON.stringify(resumo)}).catch(()=>{});
 },1500);
}
function normMetro(m){
 const o={...METRO_DEFAULT,...(m||{})};
 o.sub=[1,2,3,4].includes(Number(o.sub))?Number(o.sub):1;
 o.meter=[2,3,4,5,6,7].includes(Number(o.meter))?Number(o.meter):4;
 o.rampEvery=Math.max(0,Math.min(32,Number(o.rampEvery)||0));
 o.rampStep=Math.max(1,Math.min(10,Number(o.rampStep)||2));
 o.rampMax=Math.max(60,Math.min(240,Number(o.rampMax)||160));
 o.silentOn=Math.max(0,Math.min(8,Number(o.silentOn)||0));
 o.silentOff=Math.max(0,Math.min(8,Number(o.silentOff)||0));
 o.chord=!!o.chord;
 o.groove=GROOVES.some(g=>g.id===o.groove)?o.groove:'none';
 const acc=Array.isArray(o.accents)?o.accents.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<12):[0];
 o.accents=[...new Set(acc)].sort((a,b)=>a-b);
 return o;
}
function shuffle(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function weakOrder(){return CYCLE_ORDERS.chromatic.slice().sort((a,b)=>keyStrength(a)-keyStrength(b)||CYCLE_ORDERS.fifths.indexOf(a)-CYCLE_ORDERS.fifths.indexOf(b))}
function trainingKeys(){
 if(cycleOrder==='random'){if(!dynamicOrder||dynamicOrder.length!==12)dynamicOrder=shuffle(CYCLE_ORDERS.fifths);return dynamicOrder}
 if(cycleOrder==='weak')return weakOrder();
 return CYCLE_ORDERS[cycleOrder]||CYCLE_ORDERS.fifths;
}
/* Dia cheio: a fila da sessão usa só os quatro primeiros tons do ciclo.
   O mapa de domínio continua nos doze — senão quatro tons pareceriam fase fechada. */
function sessionKeys(){
 const keys=trainingKeys();
 if(typeof planMode!=='undefined'&&planMode==='rush')return keys.slice(0,4);
 return keys;
}
/* Teclado de 25 teclas (M-VAVE e similares): duas oitavas. A harmonia conta.
   Altura exata, dinâmica e andamento de técnica não — a tecla curta mente nessas três. */
function normKb(k){
 const o=k&&typeof k==='object'?k:{};
 const profile=o.profile==='mini'?'mini':'full';
 let lo=Math.round(Number(o.lo)),hi=Math.round(Number(o.hi));
 const ok=Number.isInteger(lo)&&Number.isInteger(hi)&&hi-lo>=12&&hi-lo<=36&&lo>=0&&hi<=127;
 if(!ok){lo=48;hi=72}
 return{profile,lo,hi,calibrated:!!(ok&&o.calibrated)};
}
function kbIsMini(){return state.kb&&state.kb.profile==='mini'}
function kbRange(){
 const k=normKb(state.kb);
 return kbIsMini()?{lo:k.lo,hi:k.hi}:null;
}
function deslocarOitava(notes,lo,hi){
 const min0=Math.min(...notes),max0=Math.max(...notes);
 let best=null;
 for(let s=-48;s<=48;s+=12){
  if(min0+s>=lo&&max0+s<=hi&&(best==null||Math.abs(s)<Math.abs(best)))best=s;
 }
 return best;
}
/* Mantém o desenho se couber com um deslocamento de oitava. Se a abertura
   for maior que o teclado, cada voz cai na oitava mais próxima que existe
   ali — e a sessão marca "abertura encaixada", sem fingir que é o voicing escrito. */
function encaixarTessitura(left,right,lo,hi){
 const L=left.slice(),R=right.slice(),all=[...L,...R];
 if(!all.length)return{left:L,right:R,fit:''};
 const span=Math.max(...all)-Math.min(...all);
 if(span<=hi-lo){
  const shift=deslocarOitava(all,lo,hi);
  if(shift!=null){
   if(!shift)return{left:L,right:R,fit:''};
   return{left:L.map(n=>n+shift),right:R.map(n=>n+shift),fit:'oitava'};
  }
 }
 const pc=n=>((n%12)+12)%12;
 const fold=n=>{
  let best=null,dist=1e9;
  for(let m=lo;m<=hi;m++){
   if(pc(m)!==pc(n))continue;
   const d=Math.abs(m-n);
   if(d<dist){dist=d;best=m}
  }
  return best==null?Math.min(hi,Math.max(lo,n)):best;
 };
 const usados=new Set(),nl=[],nr=[];
 L.forEach(n=>{const m=fold(n);if(!usados.has(m)){usados.add(m);nl.push(m)}});
 R.forEach(n=>{const m=fold(n);if(!usados.has(m)){usados.add(m);nr.push(m)}});
 nl.sort((a,b)=>a-b);nr.sort((a,b)=>a-b);
 return{left:nl,right:nr,fit:'apertado'};
}
function kbSessaoNota(fit){
 if(!session||session.kb!=='mini')return'';
 const r=kbRange()||{lo:48,hi:72};
 const base=`25 teclas · ${noteName(r.lo,true)}–${noteName(r.hi,true)}`;
 if(fit==='apertado')return`${base} · abertura encaixada`;
 if(fit==='oitava')return`${base} · oitava encaixada`;
 return base;
}
function cycleName(){return({fourths:'quartas',chromatic:'cromático',weak:'tons fracos',random:'sorteio'})[cycleOrder]||'quintas'}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function noteName(midi,octave=false,keyName=studyKey,forceFlats){const key=KEYS[keyName]||KEYS.C,names=(forceFlats||key.flats)?NOTE_FLAT:NOTE_SHARP,name=names[((midi%12)+12)%12];return octave?name+(Math.floor(midi/12)-1):name}
function isBlackMidi(m){return [1,3,6,8,10].includes(((m%12)+12)%12)}
function pianoSpan(notes){
 if(!notes||!notes.length)return{from:48,to:72};
 const lo=Math.min(...notes),hi=Math.max(...notes),from=Math.floor(lo/12)*12;
 return{from,to:Math.max(from+12,hi)};
}
function pianoWhites(from,to){const w=[];for(let m=from;m<=to;m++) if(!isBlackMidi(m)) w.push(m);return w}
function pianoChunks(notes,mini=false){
 const uniq=[...new Set(notes)].sort((a,b)=>a-b),full=pianoSpan(uniq);
 if(mini||uniq.length<2)return[full];
 let maxGap=0,at=0;
 for(let i=1;i<uniq.length;i++){const g=uniq[i]-uniq[i-1];if(g>maxGap){maxGap=g;at=i}}
 const whites=pianoWhites(full.from,full.to);
 if(maxGap<12||whites.length<=18)return[full];
 return[pianoSpan(uniq.slice(0,at)),pianoSpan(uniq.slice(at))];
}
function keyAnchor(midi,whites,keyW){
 const wi=whites.indexOf(midi);
 if(wi>=0)return{x:wi*keyW+keyW/2,y:103};
 const before=whites.findIndex(v=>v+1===midi);
 return before<0?null:{x:(before+1)*keyW,y:57};
}
/* ================= grafia enarmônica =================

   A grafia vinha do tom, não do acorde: em C, um Cm7 saía "C D# G A#". A regra
   certa é diatônica — cada voz do acorde ocupa uma letra diferente, e o acidente
   é só o que falta para chegar na altura. Então a letra vem do TAMANHO do
   intervalo (terça, quinta, sétima) e o bemol ou sustenido vem depois.

   Três intervalos são ambíguos e dependem do acorde: 6 semitons é b5 no
   diminuto e #11 no resto; 8 é #5 no aumentado e b13 no resto; 9 é bb7 no
   diminuto de sétima e 13 no resto.

   Num ACORDE, grafias que ninguém escreve numa cifra (dobrado bemol, Cb, E#)
   caem de volta na grafia simples do tom: em C, o bb7 do dim7 vira "A", não
   "Bbb" — você está procurando a tecla, não escrevendo partitura. A exceção são
   as NOTAS DO ACORDE (1, 3, 5, 7), que se leem como cifra: o V de F# é C#7, com
   E#, e a tônica é F#maj7, também com E#.

   Numa ESCALA a conta é outra: ali se lê uma sequência de letras, e uma letra
   repetida ("Bb B Db" no Eb menor, "D# F F#" no F# maior) atrapalha mais do que
   o Cb. Então escala e exercício de técnica aceitam Cb, Fb, B# e E#. O dobrado
   acidente continua fora dos dois. */
const LETTERS=['C','D','E','F','G','A','B'],LETTER_PC=[0,2,4,5,7,9,11],ACCS=['bb','b','','#','x'];
const EXOTICAS=new Set(['Cb','Fb','B#','E#']);
function letterIndexOf(nome){const i=LETTERS.indexOf(String(nome||'C')[0].toUpperCase());return i<0?0:i}
function spellAt(letterIdx,pc,exoticasOk){
 const li=((letterIdx%7)+7)%7;
 let d=((pc-LETTER_PC[li])%12+12)%12;
 if(d>6)d-=12;
 if(Math.abs(d)>1)return null;
 const nome=LETTERS[li]+ACCS[d+2];
 return(!exoticasOk&&EXOTICAS.has(nome))?null:nome;
}
const STEPS_PADRAO=[0,1,1,2,2,3,3,4,5,5,6,6];
function chordSteps(iv,ctx){
 if(iv===3)return ctx.sharp9?1:2;  // com a terça maior presente, 3 semitons é #9
 if(iv===6)return ctx.dim?4:3;
 if(iv===8)return ctx.aug?4:5;
 if(iv===9)return ctx.dim7?6:5;
 return STEPS_PADRAO[iv]||0;
}
function chordContext(suffix,ivs){
 const tem=n=>ivs.includes(n),s=String(suffix||'').toLowerCase();
 const dim=/dim|\(b5\)|ø|°/.test(s)||(tem(3)&&tem(6)&&!tem(7));
 return{dim,sharp9:tem(3)&&tem(4),dim7:/dim7|°7/.test(s)||(dim&&tem(9)),
        aug:/aug|\+/.test(s)||(tem(4)&&tem(8)&&!tem(7)&&!tem(10)&&!tem(11))};
}
/* devolve {classe de altura -> nome}, para sobreviver a transposição de oitava */
function spellChord(rootName,rootPc,midis,suffix,keyName,forceFlats){
 const base=letterIndexOf(rootName);
 const ivs=[...new Set(midis.map(m=>(((m-rootPc)%12)+12)%12))];
 const ctx=chordContext(suffix,ivs),out={};
 ivs.forEach(iv=>{
  const pc=(rootPc+iv)%12,passo=chordSteps(iv,ctx);
  /* As notas do acorde — 1, 3, 5 e 7, os passos pares — se leem como cifra e
     ganham a grafia própria (o V de F# é C#7, com E#). As tensões alteradas —
     b9, #9, #11, b13, os passos ímpares — caem na grafia simples, que é como
     elas aparecem numa cifra de verdade (o b9 de Bb7alt é B, não Cb). */
  out[pc]=spellAt(base+passo,pc,passo%2===0)||noteName(60+pc,false,keyName,forceFlats);
 });
 return out;
}
/* A fundamental segue o acidente do grau: b3 e b6 são bemol, #1 é sustenido.

   E os menores de três tons fogem da grafia do tom: Dbm7 é C#m7 em qualquer
   cifra, e escrito assim as notas saem naturais (C# E G# B) em vez de
   Db Fb Ab Cb. Vale para Db, Gb e Ab — mas não para Eb menor nem Bb menor, que
   se escrevem com bemol mesmo (a alternativa teria mais acidentes, não menos). */
const MENOR_EM_SUSTENIDO={1:'C#',6:'F#',8:'G#'};
function qualidadeMenor(suffix){
 const q=String(suffix||'');
 return /^m(?!aj)/.test(q)||/dim|ø|°/.test(q);
}
function rootSpelling(spec,keyName){
 const key=KEYS[keyName]||KEYS.C,pc=(((60+key.offset+(spec.root||0))%12)+12)%12;
 const alt=String(spec.degree||'')[0];
 if(alt==='#')return NOTE_SHARP[pc];
 const bemol=spec.flats||alt==='b'||key.flats;
 /* flats explícito no voicing é escolha do autor e continua valendo */
 if(bemol&&!spec.flats&&qualidadeMenor(spec.suffix)&&MENOR_EM_SUSTENIDO[pc])return MENOR_EM_SUSTENIDO[pc];
 if(spec.flats||alt==='b')return NOTE_FLAT[pc];
 return(key.flats?NOTE_FLAT:NOTE_SHARP)[pc];
}
function spellName(c,midi){
 const pc=(((midi%12)+12)%12);
 return(c&&c.spell&&c.spell[pc])||noteName(midi,false,c&&c.key||studyKey,c&&c.flats);
}
function spellNameOct(c,midi){
 const nome=spellName(c,midi),d=ACCS.indexOf(nome.slice(1))-2;
 return nome+(Math.floor((midi-(isFinite(d)?d:0))/12)-1);
}
/* Escalas: a fórmula ("1 2 b3 4 5 b6 b7") já diz o grau de cada nota, então a
   letra sai dela. Sem fórmula — os exercícios de técnica — usa-se a leitura
   melódica comum: 3 semitons é b3, 6 é #4, 8 é b6, 10 é b7. */
function formulaSteps(formula,total){
 const toks=String(formula||'').trim().split(/\s+/).filter(Boolean);
 if(toks.length!==total)return null;
 return toks.map(t=>{const m=t.match(/(\d+)/);return m?(Number(m[1])-1)%7:0});
}
function spellScale(tonicName,tonicPc,intervals,formula){
 const base=letterIndexOf(tonicName);
 const passos=formulaSteps(formula,intervals.length);
 return intervals.map((iv,i)=>{
  const pc=(tonicPc+iv)%12,passo=passos?passos[i]:STEPS_PADRAO[((iv%12)+12)%12];
  return spellAt(base+passo,pc,true)||noteName(60+pc,false,studyKey);
 });
}
function keyRootName(keyName){const k=KEYS[keyName]||KEYS.C;return(k.flats?NOTE_FLAT:NOTE_SHARP)[k.offset]}
function scaleNames(scale,keyName=studyKey){
 const k=KEYS[keyName]||KEYS.C,ivs=[...scale.intervals,12];
 return spellScale(keyRootName(keyName),k.offset,ivs,scale.formula?scale.formula+' 8':'');
}
function melodicName(tonicPc,semitones,keyName=studyKey){
 const base=letterIndexOf(keyRootName(keyName)),iv=((semitones%12)+12)%12;
 const pc=(tonicPc+semitones)%12;
 return spellAt(base+STEPS_PADRAO[iv],((pc%12)+12)%12,true)||noteName(60+((pc%12)+12)%12,false,keyName);
}
const RIGHT_MIN=55,RIGHT_MAX=88;
function transposeZone(notes,semitones,min=RIGHT_MIN,max=RIGHT_MAX){let out=notes.map(n=>n+semitones);while(Math.max(...out)>max)out=out.map(n=>n-12);while(Math.min(...out)<min)out=out.map(n=>n+12);return out}
/* Distância escrita entre o topo da esquerda e a base da direita, medida no tom de C.
   É a relação entre as mãos que o voicing foi pensado para ter. */
function writtenGap(spec){
 const l=transposeLeft(spec.left,0),r=transposeZone(spec.right,0);
 return Math.min(...r)-Math.max(...l);
}
/* Escolhe a oitava da mão direita que preserva essa relação em qualquer tom,
   em vez de só empurrar as notas para dentro de uma faixa fixa — era daí que
   vinham os cruzamentos de mão em tons como B. */
function fitRight(spec,left,semitones){
 const base=spec.right.map(n=>n+semitones),leftTop=Math.max(...left),gap=writtenGap(spec);
 let best=null;
 for(let k=-3;k<=3;k++){
  const cand=base.map(n=>n+k*12),lo=Math.min(...cand),hi=Math.max(...cand);
  let cost=Math.abs((lo-leftTop)-gap);
  if(lo<RIGHT_MIN)cost+=(RIGHT_MIN-lo)*3;
  if(hi>RIGHT_MAX)cost+=(hi-RIGHT_MAX)*3;
  if(!best||cost<best.cost)best={cand,cost};
 }
 return best.cand;
}
function transposeLeft(notes,semitones){let out=notes.map(n=>n+semitones);if(Math.min(...out)>=55)out=out.map(n=>n-12);while(Math.min(...out)<43)out=out.map(n=>n+12);return out}
function materialize(spec,id=spec.id,keyName=studyKey){
 const key=KEYS[keyName],forceFlats=!!spec.flats,left=transposeLeft(spec.left,key.offset),right=fitRight(spec,left,key.offset);
 const rootPc=(((60+key.offset+spec.root)%12)+12)%12,root=rootSpelling(spec,keyName);
 const spell=spellChord(root,rootPc,[...left,...right],spec.suffix,keyName,forceFlats);
 const slashPc=spec.slash===undefined?null:(((60+key.offset+spec.slash)%12)+12)%12;
 const slash=slashPc===null?'':`/${spell[slashPc]||noteName(60+slashPc,false,keyName,forceFlats)}`;
 return{id,name:`${root}${spec.suffix||''}${slash}`,voicingTitle:spec.title||spec.function,degree:spec.degree||'',left,right,rh:spec.rh,lh:spec.lh,groups:spec.groups||['progression'],level:spec.level||'Avançado',function:spec.function||'',tip:spec.tip||'',care:spec.care||[spec.function||'Observe a função harmônica.', 'Conduza cada voz pelo menor intervalo possível.'],variation:spec.variation||'',shape:`${left.map(n=>spell[((n%12)+12)%12]||noteName(n,false,keyName,forceFlats)).join(' · ')} | ${right.map(n=>spell[((n%12)+12)%12]||noteName(n,false,keyName,forceFlats)).join(' · ')}`,key:keyName,flats:forceFlats,rootPc,spell};
}
function rebuildHarmony(){
 chords=VOICING_TEMPLATES.map(v=>materialize(v));progressionChords=[];
 exercises=PROGRESSION_TEMPLATES.map(p=>{const built=p.steps.map((s,i)=>materialize({...s,level:p.level},`${p.id}-${i}`));progressionChords.push(...built);return{...p,ids:built.map(c=>c.id)};});
}
function setStudyKey(value){if(value==='ALL'){allKeys=true;studyKey='C'}else{if(!KEYS[value])return;allKeys=false;studyKey=value}saveState();rebuildHarmony();document.getElementById('study-key').value=allKeys?'ALL':studyKey;document.getElementById('cycle-picker').style.display=allKeys?'flex':'none';renderDashboard();renderChords();renderExercises();renderScales();renderTechnique();if(document.getElementById('scale-overlay').classList.contains('open')&&scaleView)renderScaleDetail()}
function setCycleOrder(value){if(!CYCLE_ORDERS_ALL.includes(value))return;cycleOrder=value;if(value==='random')dynamicOrder=shuffle(CYCLE_ORDERS.fifths);saveState();renderDashboard();renderScales();renderTechnique()}
function chord(id){return chords.find(c=>c.id===id)||progressionChords.find(c=>c.id===id)||(songSpecs.has(id)?materialize(songSpecs.get(id),id,studyKey):undefined)}
function chordInKey(id,keyName){if(songSpecs.has(id))return materialize(songSpecs.get(id),id,keyName);const base=VOICING_TEMPLATES.find(v=>v.id===id);if(base)return materialize(base,id,keyName);for(const p of PROGRESSION_TEMPLATES){if(!id.startsWith(`${p.id}-`))continue;const index=Number(id.slice(p.id.length+1));if(p.steps[index])return materialize({...p.steps[index],level:p.level},id,keyName)}return chord(id)}
function dateKey(value=new Date()){const d=new Date(value);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function todaySessions(){const t=dateKey();return state.sessions.filter(s=>dateKey(s.date)===t)}
/* Hoje ainda sem sessão NÃO quebra a ofensiva: ela morre quando ontem também
   está vazio. Contando a partir de hoje, o número zerava toda madrugada e só
   voltava depois da primeira sessão do dia — punia quem ainda ia estudar. */
function streak(){
 const dates=new Set(state.sessions.map(s=>dateKey(s.date)));
 const d=new Date();
 if(!dates.has(dateKey(d)))d.setDate(d.getDate()-1);
 let count=0;
 while(dates.has(dateKey(d))){count++;d.setDate(d.getDate()-1)}
 return count;
}
function keyMastery(id,key){
 const r=typeof reviewRow==='function'?reviewRow(id,key):state.reviews[`${id}@${key}`];
 if(!r||!r.attempts)return 0;
 return Math.min(100,Math.round((r.score/Math.max(1,r.attempts*2))*100));
}
/* Domínio honesto: nos 12 tons, tom não tocado conta 0 — não a média só do que já saiu. */
function masteryKeys(id){return typeof drillKeys==='function'?drillKeys():(allKeys?trainingKeys():[studyKey])}
function mastery(id){
 const keys=masteryKeys(id);if(!keys.length)return 0;
 return Math.round(keys.reduce((n,k)=>n+keyMastery(id,k),0)/keys.length);
}
function isMastered(id,min=75){
 const keys=masteryKeys(id);
 return keys.length>0&&keys.every(k=>keyMastery(id,k)>=min);
}
function pathMastery(path){return Math.round(path.ids.reduce((sum,id)=>sum+mastery(id),0)/path.ids.length)}
function pathMastered(path){return path.ids.length>0&&path.ids.every(id=>isMastered(id))}
function exerciseMastery(e){return e&&e.ids&&e.ids.length?Math.round(e.ids.reduce((sum,id)=>sum+mastery(id),0)/e.ids.length):0}
function exerciseMastered(e){return !!(e&&e.ids&&e.ids.length&&e.ids.every(id=>isMastered(id)))}
function moduleStatHtml(label,pct,detail){
 return`<div class="module-stat" title="${esc(detail||'')}">
  <div class="module-stat-top"><span>${esc(label)}</span><b>${pct}%</b></div>
  <div class="progress"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>
  ${detail?`<em>${esc(detail)}</em>`:''}
 </div>`;
}
function cardProgressHtml(pct,meta){
 return`<div class="path-meta"><span>${esc(meta||'Progresso')}</span><b>${pct}%</b></div><div class="progress"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>`;
}
/* Escalas: cada tom visitado no mapa conta. O alvo é ciclar os 12. */
function scaleKeysSeen(id){
 const raw=(state.scaleKeys&&state.scaleKeys[id])||[];
 return[...new Set(raw.filter(k=>KEYS[k]))];
}
function markScaleStudied(id,keyName){
 if(!id||!KEYS[keyName])return false;
 state.scaleKeys=state.scaleKeys||{};
 const seen=scaleKeysSeen(id);
 if(seen.includes(keyName))return false;
 state.scaleKeys[id]=[...seen,keyName];
 saveState();
 return true;
}
function scaleProgress(id){
 const n=scaleKeysSeen(id).length;
 return{n,total:12,pct:Math.round(n/12*100)};
}
function scalesModuleProgress(){
 const list=SCALE_TEMPLATES;if(!list.length)return{pct:0,detail:'sem escalas'};
 const avg=Math.round(list.reduce((s,x)=>s+scaleProgress(x.id).pct,0)/list.length);
 const done=list.filter(x=>scaleProgress(x.id).n>=12).length;
 return{pct:avg,detail:`${done}/${list.length} nos 12 tons`};
}
function exercisesModuleProgress(){
 if(!exercises.length)return{pct:0,detail:'sem progressões'};
 const avg=Math.round(exercises.reduce((s,e)=>s+exerciseMastery(e),0)/exercises.length);
 const firm=exercises.filter(e=>exerciseMastered(e)).length;
 return{pct:avg,detail:`${firm}/${exercises.length} firmes`};
}
function techniqueProgress(t){
 const bpm=techniqueBpm(t),goal=Math.max(1,Number(t.goalBpm)||120);
 return{bpm,goal,pct:Math.min(100,Math.round(bpm/goal*100))};
}
function techniqueModuleProgress(){
 const list=TECHNIQUE_EXERCISES;if(!list.length)return{pct:0,detail:'sem exercícios'};
 const avg=Math.round(list.reduce((s,t)=>s+techniqueProgress(t).pct,0)/list.length);
 const meta=list.filter(t=>techniqueProgress(t).pct>=100).length;
 return{pct:avg,detail:`${meta}/${list.length} na meta`};
}
function svgKeyboard(notes,item,mini,from,to){
 const whites=pianoWhites(from,to),keyW=22,w=whites.length*keyW,h=mini?126:154;
 const rightFingers=(item.rh.match(/[1-5]/g)||[]),leftFingers=(item.lh.match(/[1-5]/g)||[]);
 const rightMap=new Map(item.right.map((m,i)=>[m,rightFingers[i]||''])),leftMap=new Map(item.left.map((m,i)=>[m,leftFingers[i]||'ME']));
 const inLeft=m=>item.left.includes(m),active=m=>inLeft(m)||item.right.includes(m),keyName=item.key||studyKey,flat=item.flats;
 const shown=notes.filter(m=>m>=from&&m<=to);
 let out=`<svg class="${mini?'chord-mini':''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Teclas do acorde ${esc(item.name)}">`;
 whites.forEach((m,i)=>{out+=`<rect x="${i*keyW+.5}" y=".5" width="${keyW-1}" height="126" rx="2" fill="${active(m)?(inLeft(m)?'var(--green-bg)':'var(--accent2)'):'var(--surface)'}" stroke="var(--border-strong)"/>`});
 whites.forEach((m,i)=>{const bm=m+1;if(!isBlackMidi(bm)||bm>to)return;out+=`<rect x="${(i+1)*keyW-7}" y="0" width="14" height="77" rx="2" fill="${active(bm)?(inLeft(bm)?'var(--green)':'var(--accent)'):'var(--text)'}" stroke="var(--surface)"/>`});
 if(!mini){
  whites.forEach((m,i)=>{if((((m%12)+12)%12)!==0||active(m))return;out+=`<text x="${i*keyW+keyW/2}" y="145" text-anchor="middle" fill="var(--text3)" font-size="7" font-family="system-ui">${noteName(m,true,keyName,flat)}</text>`});
  shown.forEach(m=>{const pos=keyAnchor(m,whites,keyW);if(!pos)return;const left=inLeft(m),label=left?leftMap.get(m):rightMap.get(m);out+=`<circle cx="${pos.x}" cy="${pos.y}" r="9" fill="${left?'var(--green)':'var(--accent)'}"/><text x="${pos.x}" y="${pos.y+3}" text-anchor="middle" fill="white" font-size="7" font-weight="800" font-family="system-ui">${label}</text><text x="${pos.x}" y="145" text-anchor="middle" fill="currentColor" font-size="8" font-family="system-ui">${spellNameOct(item,m)}</text>`});
 }
 return out+'</svg>';
}
function svgDiagram(item,mini=false){
 const notes=[...new Set([...(item.left||[]),...(item.right||[])])],chunks=pianoChunks(notes,mini);
 const svgs=chunks.map(({from,to})=>svgKeyboard(notes,item,mini,from,to));
 return mini||svgs.length===1?svgs[0]:`<div class="kb-stack">${svgs.join('')}</div>`;
}
const MAJOR_FINGERING={
 C:{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1'},Db:{rh:'2–3–1–2–3–4–1–2',lh:'3–2–1–4–3–2–1–3'},D:{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1'},Eb:{rh:'3–1–2–3–4–1–2–3',lh:'3–2–1–4–3–2–1–3'},E:{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1'},
 F:{rh:'1–2–3–4–1–2–3–4',lh:'5–4–3–2–1–3–2–1'},'F#':{rh:'2–3–4–1–2–3–1–2',lh:'4–3–2–1–3–2–1–4'},G:{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1'},Ab:{rh:'3–4–1–2–3–1–2–3',lh:'3–2–1–4–3–2–1–3'},A:{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1'},Bb:{rh:'2–1–2–3–1–2–3–4',lh:'3–2–1–4–3–2–1–3'},B:{rh:'1–2–3–1–2–3–4–5',lh:'4–3–2–1–4–3–2–1'}
};
function scaleTonic(keyName=studyKey){return 60+KEYS[keyName].offset}
function scaleMidi(scale,keyName=studyKey){const tonic=scaleTonic(keyName);return[...scale.intervals.map(i=>tonic+i),tonic+12]}
function scaleFingering(scale,keyName=studyKey){
 if(scale.family==='major')return{...(MAJOR_FINGERING[keyName]||MAJOR_FINGERING.C),note:'Digitação tradicional de uma oitava para esta tonalidade.'};
 if(scale.family==='minor')return{rh:'1–2–3–1–2–3–4–5',lh:'5–4–3–2–1–3–2–1',note:'Base de uma oitava: ajuste polegar e dedos longos à geometria das teclas pretas.'};
 if(scale.family==='pentatonic')return{rh:'1–2–3–1–2–3',lh:'3–2–1–3–2–1',note:'Agrupe em blocos 3+2; use 4 ou 5 no topo quando a forma pedir abertura.'};
 if(scale.family==='symmetric')return{rh:'1–2–3–4 · 1–2–3–4',lh:'4–3–2–1 · 4–3–2–1',note:'Pense em células simétricas de quatro notas e desloque a mesma forma.'};
 return{rh:'1–2–3–4 · 1–2–3–4',lh:'4–3–2–1 · 4–3–2–1',note:'Para uso modal, priorize fraseado em células; adapte a passagem à tonalidade.'};
}
function svgScale(scale,keyName=studyKey){
 const notes=scaleMidi(scale,keyName),{from,to}=pianoSpan(notes),whites=pianoWhites(from,to),active=new Set(notes),keyW=22,w=whites.length*keyW,h=158,fingers=(scaleFingering(scale,keyName).rh.match(/[1-5]/g)||[]),fingerMap=new Map(notes.map((m,i)=>[m,fingers[i%fingers.length]||'']));
 let out=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Escala ${esc(keyName+' '+scale.name)} no teclado">`;
 whites.forEach((m,i)=>{const on=active.has(m),root=m===notes[0]||m===notes.at(-1);out+=`<rect x="${i*keyW+.5}" y=".5" width="${keyW-1}" height="126" rx="2" fill="${on?(root?'var(--green-bg)':'var(--accent2)'):'var(--surface)'}" stroke="var(--border-strong)"/>`});
 whites.forEach((m,i)=>{const bm=m+1;if(!isBlackMidi(bm)||bm>to)return;const on=active.has(bm),root=bm===notes[0]||bm===notes.at(-1);out+=`<rect x="${(i+1)*keyW-7}" y="0" width="14" height="77" rx="2" fill="${on?(root?'var(--green)':'var(--accent)'):'var(--text)'}" stroke="var(--surface)"/>`});
 notes.forEach((m,i)=>{const pos=keyAnchor(m,whites,keyW);if(!pos)return;const root=i===0||i===notes.length-1;out+=`<circle cx="${pos.x}" cy="${pos.y}" r="9" fill="${root?'var(--green)':'var(--accent)'}"/><text x="${pos.x}" y="${pos.y+3}" text-anchor="middle" fill="white" font-size="7" font-weight="800" font-family="system-ui">${fingerMap.get(m)}</text><text x="${pos.x}" y="146" text-anchor="middle" fill="currentColor" font-size="8" font-family="system-ui">${noteName(m,false,keyName)}</text>`});
 return out+'</svg>';
}
function renderScales(){
 const list=SCALE_TEMPLATES.filter(s=>activeScaleFilter==='all'||s.group===activeScaleFilter),grid=document.getElementById('scale-grid');
 const mod=scalesModuleProgress(),stat=document.getElementById('scale-module-stat');
 if(stat)stat.innerHTML=moduleStatHtml('Ciclo de tons',mod.pct,mod.detail);
 grid.innerHTML=list.map(s=>{
  const pr=scaleProgress(s.id),status=pr.pct>=100?'good':pr.pct?'learning':'';
  return`<button class="scale-card" onclick="openScale('${s.id}')"><span class="tag">${s.group==='mode'?'Modo grego':s.group==='pentatonic'?'Pentatônica':s.group==='advanced'?'Avançada':'Tonal'}${allKeys?' · 12 tons':''}</span><h2 style="margin-top:10px">${allKeys?'12 tons · ':studyKey+' '}${s.name}</h2><div class="scale-formula">${s.formula}</div><div class="scale-notes">${allKeys?'Modelo C · ':''}${scaleNames(s,allKeys?'C':studyKey).join(' · ')}</div><p>${s.character}</p>${cardProgressHtml(pr.pct,`${pr.n}/12 tons`)}<div class="mastery ${status}"><i class="mastery-dot"></i>${pr.pct>=100?'Ciclo completo':pr.pct?`${pr.n} tons vistos`:'Novo'}</div></button>`;
 }).join('');
}
const ENHARMONIC={'Gb':'F#','D#':'Eb','A#':'Bb','G#':'Ab','C#':'Db','Fb':'E','Cb':'B','E#':'F','B#':'C'};
function keyFromNote(name){const n=String(name||'').trim();return KEYS[n]?n:(ENHARMONIC[n]||null)}
function openScale(id,keyName){
 const s=SCALE_TEMPLATES.find(x=>x.id===id);if(!s)return;
 const keys=trainingKeys();
 const kn=KEYS[keyName]?keyName:(allKeys?keys[0]:studyKey);
 scaleView={id,key:kn};
 markScaleStudied(id,kn);
 renderScaleDetail();
 openOverlay('scale-overlay');
 renderScales();
}
function shiftScaleKey(delta){
 if(!scaleView)return;
 const keys=trainingKeys();
 const i=Math.max(0,keys.indexOf(scaleView.key));
 scaleView.key=keys[(i+delta+keys.length)%keys.length];
 markScaleStudied(scaleView.id,scaleView.key);
 renderScaleDetail();
 renderScales();
}
function renderScaleDetail(){
 if(!scaleView)return;
 const s=SCALE_TEMPLATES.find(x=>x.id===scaleView.id);if(!s)return;
 const kn=scaleView.key,keys=trainingKeys(),idx=Math.max(0,keys.indexOf(kn)),pr=scaleProgress(s.id);
 const f=scaleFingering(s,kn),notes=scaleNames(s,kn);
 document.getElementById('scale-name').textContent=`${kn} · ${s.name}`;
 document.getElementById('scale-detail').innerHTML=`<div class="scale-keyboard">${svgScale(s,kn)}
  <div class="scale-key-nav">
   <button class="btn" type="button" onclick="shiftScaleKey(-1)">← tom</button>
   <span class="finger-chip">${kn} · ${idx+1}/${keys.length}</span>
   <button class="btn" type="button" onclick="shiftScaleKey(1)">próximo tom →</button>
  </div>
  <div class="diagram-caption">${notes.join(' · ')}</div>
  <div class="finger-row" style="justify-content:center;margin-top:8px"><span class="finger-chip">${pr.n}/12 tons · ${pr.pct}%</span></div></div>
  <div class="scale-copy"><div><div class="eyebrow">Fórmula</div><h2>${s.formula}</h2><h3 style="margin-top:18px">Caráter</h3><p>${s.character}</p><h3 style="margin-top:18px">Aplicação harmônica</h3><p>${s.application}</p></div><div>
  <div class="eyebrow">Digitação sugerida · ${esc(kn)}</div>
  <div class="finger-row"><span class="finger-chip">MD · ${f.rh}</span><span class="finger-chip">ME · ${f.lh}</span></div>
  <p style="margin-top:12px">${f.note}</p>
  <h3 style="margin-top:18px">Estudo avançado</h3>
  <ul><li>Percorra o ciclo de ${cycleName()} com as setas ou os botões: ${keys.join(' → ')}.</li>
  <li>Comece a frase em cada grau, sem alterar a digitação por impulso.</li>
  <li>${s.avoid}</li></ul></div></div>`;
}
function techniqueBpm(item){return Number(state.techniqueBpms[item.id])||item.defaultBpm}
function techniquePlayBpm(item){
 if(!kbIsMini())return techniqueBpm(item);
 const n=state.miniTempo&&Number(state.miniTempo[item.id]);
 return n>=35&&n<=200?n:techniqueBpm(item);
}
function techniqueNotes(item,keyName=studyKey){const k=KEYS[keyName]||KEYS.C;return item.semitones.map(n=>melodicName(k.offset,n,keyName)).join(' · ')}
function techGroupLabel(g){return({independence:'Independência',sequence:'Sequência',phrase:'Fraseado',arpeggio:'Arpejo',lefthand:'Mão esquerda',dinamica:'Dinâmica'})[g]||'Arpejo'}
function clockLabel(sec){const m=Math.floor(sec/60),s=sec%60;return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function renderTechnique(){
 const list=TECHNIQUE_EXERCISES.filter(t=>activeTechFilter==='all'||t.group===activeTechFilter),grid=document.getElementById('technique-grid');
 const mod=techniqueModuleProgress(),stat=document.getElementById('technique-module-stat');
 if(stat)stat.innerHTML=moduleStatHtml('Rumo à meta',mod.pct,mod.detail);
 grid.innerHTML=list.map(t=>{
  const bpm=techniqueBpm(t),tocando=techniquePlayBpm(t),pr=techniqueProgress(t),status=pr.pct>=100?'good':pr.pct>=50?'learning':'';
  const miniNota=kbIsMini()?'<div class="tiny" style="margin-top:8px">No 25 teclas este andamento fica no treino e não entra na meta.</div>':'';
  return`<article class="technique-card"><span class="tag">${techGroupLabel(t.group)}${allKeys?' · 12 tons':''}</span><h2 style="margin-top:10px">${t.title}</h2><div class="tech-pattern">${t.pattern}</div><div class="scale-notes">${allKeys?'Modelo C · ':''}${techniqueNotes(t)}</div><p>${t.description}</p><p><b>Dedos:</b> ${t.fingering}</p>${cardProgressHtml(pr.pct,`${bpm} → ${t.goalBpm} BPM`)}<div class="mastery ${status}" style="margin-top:8px"><i class="mastery-dot"></i>${pr.pct>=100?'Meta atingida':`${pr.pct}% da meta`}</div><div class="tempo-row"><button class="btn" onclick="changeTechniqueTempo('${t.id}',-5)" aria-label="Diminuir andamento">−</button><span class="tempo-value">${tocando} BPM</span><button class="btn" onclick="changeTechniqueTempo('${t.id}',5)" aria-label="Aumentar andamento">+</button><button class="btn primary" style="margin-left:auto" onclick="startTechnique('${t.id}',true)">▶ Manual</button><button class="btn" onclick="startTechnique('${t.id}')">1 min</button></div>${miniNota}<div class="tiny" style="margin-top:8px">${allKeys?'Manual: você muda o tom. 1 min: 5 s por tom. ':''}Meta limpa no teclado completo: ${t.goalBpm} BPM</div></article>`;
 }).join('');
}
function changeTechniqueTempo(id,delta){
 const item=TECHNIQUE_EXERCISES.find(t=>t.id===id);if(!item)return;
 const base=kbIsMini()?techniquePlayBpm(item):techniqueBpm(item);
 const v=Math.max(35,Math.min(200,base+delta));
 if(kbIsMini()){
  state.miniTempo=state.miniTempo||{};
  state.miniTempo[id]=v;
  if(techniqueDrill&&techniqueDrill.item.id===id){techniqueDrill.bpm=v;if(clock&&clock.rodando)clock.remarcar();renderTechniqueLive()}
  else renderTechnique();
  saveState();
  return;
 }
 state.techniqueBpms[id]=v;saveState();renderTechnique();
}
function startTechnique(id,manual=false){
 const item=TECHNIQUE_EXERCISES.find(t=>t.id===id);if(!item)return;if(globalMetroPlaying)stopGlobalMetronome();const keys=trainingKeys();
 techniqueDrill={item,bpm:techniquePlayBpm(item),start:Date.now(),duration:manual?null:60,manual:!!manual,completed:false,currentKey:allKeys?keys[0]:studyKey,keys,allKeys,midiPos:0,midiLoops:0,midiMiss:0,tickAt:null,tickN:0,poli:{esqN:0,esqSoma:0,esqPior:0,dirN:0,dirSoma:0,dirPior:0,ultimo:null}};
 techniqueBeatIndex=0;
 const brow=document.getElementById('technique-eyebrow'),head=document.getElementById('technique-heading');
 if(brow)brow.textContent=manual?'Treino no seu tempo':'Treino de 1 minuto';
 if(head)head.textContent=manual?'Mude de tom quando estiver limpo':'Precisão antes da velocidade';
 renderTechniqueLive();openOverlay('technique-overlay');syncTechniqueMidiUi();paintTechniqueMidi();startBeat(techniqueDrill.bpm);clearInterval(techniqueTimer);techniqueTimer=setInterval(tickTechnique,200);
}
function shiftTechniqueKey(delta){
 const d=techniqueDrill;if(!d||!d.manual||!d.allKeys||d.completed)return;
 const i=Math.max(0,d.keys.indexOf(d.currentKey));
 d.currentKey=d.keys[(i+delta+d.keys.length)%d.keys.length];
 d.midiPos=0;
 renderTechniqueLive();
 paintTechniqueMidi();
}
function techniqueTargets(d){
 const off=(KEYS[d.currentKey]||KEYS.C).offset;
 return(d.item.semitones||[]).map(s=>(((off+s)%12)+12)%12);
}
function techniqueNotesHtml(d){
 const names=(d.item.semitones||[]).map(s=>melodicName((KEYS[d.currentKey]||KEYS.C).offset,s,d.currentKey));
 const pos=d.midiPos||0,len=names.length||1;
 return names.map((n,i)=>{
  const cls=i<pos%len&&midiState==='on'?' done':(i===pos%len&&midiState==='on'?' now':'');
  return`<span class="tech-note${cls}">${esc(n)}</span>`;
 }).join(' · ');
}
function renderTechniqueLive(){
 const d=techniqueDrill;if(!d)return;const box=document.getElementById('technique-live');
 if(d.completed){const pp=d.item.kind==='poli'&&(d.poli.esqN||d.poli.dirN)?'<p class="tiny" style="margin-top:8px">ME '+(poliMedia(d.poli,'esq')??'—')+' ms em '+d.poli.esqN+' · MD '+(poliMedia(d.poli,'dir')??'—')+' ms em '+d.poli.dirN+' · pior '+Math.max(d.poli.esqPior,d.poli.dirPior)+' ms</p>':'';const mini=kbIsMini();box.innerHTML=`<div class="summary-mark">✓</div><div class="eyebrow">Treino concluído · ${d.bpm} BPM</div><h2 style="font-family:inherit">${mini?'Harmonia registrada':'Precisão registrada'}</h2><p class="muted">${mini?'Os minutos entram no dia. Este andamento não sobe a meta de técnica — a tecla curta não é a do culto.':'Suba 5 BPM apenas quando o toque estiver uniforme, relaxado e musical.'}</p>${pp}${d.midiLoops?`<p class="tiny" style="margin-top:8px">MIDI · ${d.midiLoops} volta${d.midiLoops>1?'s':''} limpa${d.midiLoops>1?'s':''}${d.midiMiss?` · ${d.midiMiss} fora`:''}</p>`:''}<div style="margin-top:22px"><button class="btn primary" onclick="stopTechnique()">Concluir</button></div>`;syncTechniqueMidiUi();return}
 const elapsed=Math.floor((Date.now()-d.start)/1000);
 const clock=d.manual?clockLabel(elapsed):`00:${String(Math.max(0,d.duration-elapsed)).padStart(2,'0')}`;
 const keyNav=d.manual&&d.allKeys?`<div style="margin-top:16px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn" type="button" onclick="shiftTechniqueKey(-1)">← tom</button><button class="btn" type="button" onclick="shiftTechniqueKey(1)">próximo tom →</button></div>`:'';
 const register=d.manual?`<div style="margin-top:18px"><button class="btn primary" type="button" onclick="finishTechnique()">Registrar</button></div>`:'';
 const poli=d.item.kind==='poli';
 const midiHint=midiState!=='on'?'':poli
  ?'MIDI ligado · o clique é a mão esquerda. Abaixo do dó central conta como ME.'
  :`MIDI ligado · toque a sequência nota a nota. Próxima: ${melodicName((KEYS[d.currentKey]||KEYS.C).offset,d.item.semitones[(d.midiPos||0)%d.item.semitones.length],d.currentKey)}.`
  ;
 const semMidi=midiState!=='on'&&midiSupported()?'Ligue o MIDI no canto do painel para validar no teclado. ':'';
 const hint=d.manual
  ?(d.allKeys?`Ciclo de ${cycleName()} · avance o tom quando a célula estiver limpa. `:'')+midiHint+semMidi+'O relógio só conta. Você encerra quando quiser.'
  :(d.allKeys?`Ciclo de ${cycleName()} · o tom muda a cada 5 segundos. `:'')+midiHint+semMidi+'Solte ombros e punhos. Pare se surgir tensão.';
 const midiChips=midiState!=='on'?'':poli
  ?`<span class="finger-chip">${d.item.poli.dir} contra ${d.item.poli.esq}</span><span class="finger-chip">${d.poli.esqN+d.poli.dirN} ataques</span>`
  :`<span class="finger-chip">MIDI · volta ${d.midiLoops||0}</span><span class="finger-chip">nota ${(d.midiPos||0)%Math.max(1,d.item.semitones.length)+1}/${d.item.semitones.length}</span>`;
 box.innerHTML=`<div class="eyebrow">${d.currentKey} · ${d.item.title}</div><h2>${d.item.pattern}</h2><div class="technique-live-notes" id="technique-notes">${poli?poliNotesHtml(d):techniqueNotesHtml(d)}</div><div class="finger-row" style="justify-content:center"><span class="finger-chip">${d.item.fingering}</span><span class="finger-chip">${d.bpm} BPM</span>${d.allKeys?`<span class="finger-chip">tom ${d.keys.indexOf(d.currentKey)+1}/12</span>`:''}${midiChips}</div><div class="drill-pulse">${[0,1,2,3].map(i=>`<i class="${i===techniqueBeatIndex?'on':''}"></i>`).join('')}</div><div class="drill-time" id="technique-time">${clock}</div><p class="tiny">${hint}</p>${keyNav}${register}`;
 syncTechniqueMidiUi();
}
function syncTechniqueMidiUi(){
 const btn=document.getElementById('tech-midi-btn'),note=document.getElementById('tech-midi-note');
 if(btn){btn.classList.toggle('on',midiState==='on');btn.title=midiLabel();btn.style.display=midiSupported()?'':'none'}
 if(note&&midiState!=='on')note.textContent=midiState==='off'?'':midiLabel();
}
function paintTechniqueMidi(info){
 const box=document.getElementById('tech-midi-note');if(!box)return;
 if(midiState!=='on')return void(box.textContent=midiState==='off'?'':midiLabel());
 if(!techniqueDrill||techniqueDrill.completed)return void(box.textContent=midiLabel());
 const d=techniqueDrill,targets=techniqueTargets(d),pos=d.midiPos||0,expect=targets[pos%targets.length];
 const nome=p=>NOTE_SHARP[((p%12)+12)%12];
 if(!info)return void(box.textContent=`próxima · ${nome(expect)}`);
 if(info.hit)return void(box.textContent=`✓ ${nome(info.got)} · próxima ${nome(targets[(pos)%targets.length]||expect)}`);
 if(info.miss)return void(box.textContent=`✗ ${nome(info.got)} · esperava ${nome(info.expect)}`);
 if(info.loop)return void(box.textContent=`✓ volta ${d.midiLoops} · de novo`);
}
/* ================= polirritmia =================

   Os outros exercícios de independência têm as duas mãos no mesmo ritmo — o que
   se confere é a próxima nota da sequência. Aqui não existe "próxima nota": as
   mãos estão em métricas diferentes, e o que se mede é ONDE cada ataque caiu
   dentro do ciclo.

   A mão vem da altura, porque o MIDI não diz qual é qual: abaixo do ponto de
   corte é esquerda, acima é direita. E o metrônomo clica a ESQUERDA — de
   propósito. Contra dois cliques você encaixa três; é assim que se aprende, e
   é assim que dá para conferir sozinho se está certo. */
function poliFase(d){
 const beatMs=60000/d.bpm;
 if(d.tickAt==null||!isFinite(beatMs)||beatMs<=0)return null;
 const pos=d.tickN+(performance.now()-d.tickAt)/beatMs;
 const ciclo=Math.max(1,d.item.poli.esq);
 return{fase:(((pos%ciclo)+ciclo)%ciclo)/ciclo,cicloMs:ciclo*beatMs};
}
/* Distância até a grade ideal de n ataques por ciclo, em fração de ciclo. */
function poliErro(fase,n){
 const passo=1/Math.max(1,n);
 let d=fase-Math.round(fase/passo)*passo;
 if(d>.5)d-=1;
 if(d<-.5)d+=1;
 return d;
}
function checkPoli(d,note){
 const f=poliFase(d);if(!f)return;
 const direita=note>=(d.item.split||60);
 const n=direita?d.item.poli.dir:d.item.poli.esq;
 /* ||0 troca o -0 do arredondamento por 0: "-0 ms" na tela é ruído. */
 const ms=Math.round(poliErro(f.fase,n)*f.cicloMs)||0;
 const p=d.poli,lado=direita?'dir':'esq';
 p[lado+'N']++;p[lado+'Soma']+=Math.abs(ms);p[lado+'Pior']=Math.max(p[lado+'Pior'],Math.abs(ms));
 p.ultimo={direita,ms};
 const notes=document.getElementById('technique-notes');
 if(notes)notes.innerHTML=poliNotesHtml(d);
}
function poliMedia(p,lado){return p[lado+'N']?Math.round(p[lado+'Soma']/p[lado+'N']):null}
function poliNotesHtml(d){
 const p=d.poli,u=p.ultimo;
 const lado=(rot,l)=>{
  const m=poliMedia(p,l),atual=u&&(u.direita?'dir':'esq')===l?' now':'';
  const conta=p[l+'N']?' ('+p[l+'N']+')':'';
  return '<span class="tech-note'+atual+'">'+rot+' · '+(m==null?'—':m+' ms')+conta+'</span>';
 };
 const ultimo=u?'<span class="tech-note'+(Math.abs(u.ms)<=35?' done':'')+'">'+(u.direita?'MD':'ME')+' '+(u.ms>0?'+':'')+u.ms+' ms</span>':'';
 return [lado('ME','esq'),lado('MD','dir'),ultimo].filter(Boolean).join(' · ');
}
function checkMidiTechnique(cmd,note,vel){
 if(!techniqueDrill||techniqueDrill.completed||midiState!=='on')return;
 const d=techniqueDrill;
 if(d.item.kind==='poli')return void(cmd===0x90&&vel>0&&checkPoli(d,note));
 const targets=techniqueTargets(d);
 if(!targets.length)return;
 if(!(cmd===0x90&&vel>0))return;
 const expect=targets[(d.midiPos||0)%targets.length],got=((note%12)+12)%12;
 if(got!==expect){
  d.midiMiss=(d.midiMiss||0)+1;
  return paintTechniqueMidi({miss:true,got,expect});
 }
 d.midiPos=(d.midiPos||0)+1;
 let looped=false;
 if(d.midiPos%targets.length===0){d.midiLoops=(d.midiLoops||0)+1;looped=true}
 const notes=document.getElementById('technique-notes');
 if(notes)notes.innerHTML=techniqueNotesHtml(d);
 const hint=document.querySelector('#technique-live .tiny');
 if(hint){
  const nextName=melodicName((KEYS[d.currentKey]||KEYS.C).offset,d.item.semitones[d.midiPos%d.item.semitones.length],d.currentKey);
  hint.textContent=`MIDI ligado · toque a sequência nota a nota. Próxima: ${nextName}.`+(d.manual?' O relógio só conta. Você encerra quando quiser.':' Solte ombros e punhos. Pare se surgir tensão.');
 }
 paintTechniqueMidi(looped?{loop:true,got}:{hit:true,got});
}
function techniquePulse(n){
 if(!techniqueDrill||techniqueDrill.completed)return;
 if(typeof n==='number'){techniqueDrill.tickAt=performance.now();techniqueDrill.tickN=n}
 techniqueBeatIndex=((typeof n==='number'?n:techniqueBeatIndex+1)%4+4)%4;
 document.querySelectorAll('#technique-live .drill-pulse i').forEach((dot,i)=>dot.classList.toggle('on',i===techniqueBeatIndex));
}
function tickTechnique(){
 if(!techniqueDrill||techniqueDrill.completed)return;
 const elapsed=Math.floor((Date.now()-techniqueDrill.start)/1000);
 if(techniqueDrill.manual){
  const time=document.getElementById('technique-time');
  if(time)time.textContent=clockLabel(elapsed);
  return;
 }
 const left=Math.max(0,techniqueDrill.duration-elapsed);
 if(techniqueDrill.allKeys){
  const next=techniqueDrill.keys[Math.min(11,Math.floor(elapsed/5))];
  if(next!==techniqueDrill.currentKey){
   techniqueDrill.currentKey=next;techniqueDrill.midiPos=0;
   /* só atualiza tom/notas — não recria o painel nem mexe no metrônomo */
   patchTechniqueKeyUi();paintTechniqueMidi();
  }
 }
 const time=document.getElementById('technique-time');
 if(time)time.textContent=`00:${String(left).padStart(2,'0')}`;
 if(left<=0)finishTechnique();
}
function patchTechniqueKeyUi(){
 const d=techniqueDrill;if(!d||d.completed)return;
 const live=document.getElementById('technique-live');if(!live)return;
 const brow=live.querySelector('.eyebrow');
 if(brow)brow.textContent=`${d.currentKey} · ${d.item.title}`;
 const notes=document.getElementById('technique-notes');
 if(notes)notes.innerHTML=techniqueNotesHtml(d);
 const chips=live.querySelector('.finger-row');
 if(chips&&d.allKeys){
  const tomChip=[...chips.querySelectorAll('.finger-chip')].find(c=>/^tom\s/i.test(c.textContent||''));
  if(tomChip)tomChip.textContent=`tom ${d.keys.indexOf(d.currentKey)+1}/12`;
 }
 const hint=live.querySelector('.tiny');
 if(hint&&midiState==='on'){
  const nextName=melodicName((KEYS[d.currentKey]||KEYS.C).offset,d.item.semitones[(d.midiPos||0)%d.item.semitones.length],d.currentKey);
  hint.textContent=`MIDI ligado · toque a sequência nota a nota. Próxima: ${nextName}.`+(d.manual?' O relógio só conta. Você encerra quando quiser.':' Solte ombros e punhos. Pare se surgir tensão.');
 }
}
function finishTechnique(){
 if(!techniqueDrill||techniqueDrill.completed)return;
 clearInterval(techniqueTimer);techniqueTimer=null;stopBeat();techniqueDrill.completed=true;
 const elapsedMin=Math.max(1,Math.ceil((Date.now()-techniqueDrill.start)/60000));
 const minutes=techniqueDrill.manual?elapsedMin:1;
 const mini=kbIsMini();
 state.sessions.push({date:new Date().toISOString(),minutes,focus:techniqueDrill.item.title,key:techniqueDrill.allKeys?'12 tons':studyKey,kb:mini?'mini':'full',conta:mini?'harmonia':'completo',...(mini?{}:{bpm:techniqueDrill.bpm})});
 state.sessions=state.sessions.slice(-365);saveState();renderDashboard();renderTechnique();renderTechniqueLive();
}
function stopTechnique(){clearInterval(techniqueTimer);techniqueTimer=null;stopBeat();techniqueDrill=null;closeOverlay('technique-overlay')}
/* Meta diária em minutos. Sem escolha própria, acompanha a rotina do plano
   escolhida para hoje (1h40 = 100, 1h = 60). Antes era 5 fixo: o círculo enchia
   quase sem estudar e o lembrete do Telegram quase nunca tinha o que avisar. */
function metaDoDia(){
 if(state.metaPropria>0)return state.metaPropria;
 try{
  if(PLAN&&PLAN.routines&&typeof routineOf==='function'){
   const m=routineBlocks(routineOf(routineState().id)).reduce((n,b)=>n+(Number(b.min)||0),0);
   if(m>0)return m;
  }
 }catch(e){}
 return state.dailyGoal||5;
}
function fmtMin(m){return m>=60?`${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}`:`${m} min`}
function rotuloRotina(){
 try{return routineOf(routineState().id).label}catch(e){return ''}
}
function abrirMeta(ev){
 if(ev)ev.stopPropagation();
 const box=document.getElementById('goal-menu');
 if(!box.hidden){box.hidden=true;return}
 const plano=state.metaPropria>0?null:metaDoDia(),rot=rotuloRotina();
 const opcoes=[15,30,45,60,90,120];
 box.innerHTML=`<button class="goal-opt${state.metaPropria?'':' on'}" onclick="definirMeta(0)">Acompanhar o plano${rot?` (${esc(rot)})`:''}</button>`+
  opcoes.map(m=>`<button class="goal-opt${state.metaPropria===m?' on':''}" onclick="definirMeta(${m})">${fmtMin(m)}</button>`).join('');
 box.hidden=false;
}
function definirMeta(m){
 state.metaPropria=m;saveState();renderDashboard();
 document.getElementById('goal-menu').hidden=true;
}
document.addEventListener('click',e=>{const box=document.getElementById('goal-menu');if(box&&!box.hidden&&!e.target.closest('#goal-menu,#goal-ring'))box.hidden=true});
function renderDashboard(){
 const total=state.sessions.reduce((n,s)=>n+(s.minutes||0),0),mastered=chords.filter(c=>isMastered(c.id)).length,today=todaySessions().reduce((n,s)=>n+(s.minutes||0),0),goal=metaDoDia();
 document.getElementById('minutes-stat').textContent=total;document.getElementById('mastered-stat').textContent=mastered;document.getElementById('sessions-stat').textContent=state.sessions.length;document.getElementById('streak').textContent=streak();
 document.getElementById('tone-context').textContent=allKeys?`Ciclo de ${cycleName()}: ${trainingKeys().join(' → ')}`:`Todo material está em ${studyKey}`;
 document.getElementById('goal-value').textContent=`${Math.min(today,goal)}/${goal}`;const anel=document.getElementById('goal-ring');anel.style.setProperty('--p',Math.min(100,today/goal*100));anel.classList.toggle('longa',goal>=100);anel.title=`Meta de hoje: ${fmtMin(goal)}${state.metaPropria?'':` (plano ${rotuloRotina()})`} · toque para mudar`;
 document.getElementById('path-grid').innerHTML=paths.map(p=>{const m=pathMastery(p),pr=Number(state.bpmPr[p.id])||0,done=pathMastered(p),firm=p.ids.filter(id=>isMastered(id)).length;return`<button class="path-card" onclick="openSetup('${p.id}')"><div class="path-top"><span class="path-icon">${p.icon}</span><span class="tag">${pr?`PR ${pr} BPM`:`${p.ids.length} voicings`}</span></div><h3>${p.name}</h3><p>${p.desc}</p><div class="path-meta"><span>${done?'Dominado':`Firmes ${firm}/${p.ids.length}`}</span><b>${m}%</b></div><div class="progress"><i style="width:${m}%"></i></div></button>`}).join('');
 const recommended=['axis-loop','pad-clouds','modulation-whole'].map(id=>exercises.find(e=>e.id===id)).filter(Boolean);document.getElementById('today-exercises').innerHTML=recommended.map(exerciseHtml).join('');
 renderReviewCard();renderKeyHeat();renderTodayPlan();renderLedger();renderPonte();
}
function harmoniaLedger(){
 if(typeof planReady==='function'&&planReady()){
  const f=currentPhase(),st=phaseStats(f);
  return{pct:st.hpct,detail:`${f.maint?'Manutenção':`Fase ${f.n}`} · ${st.firmes}/${st.ids} voicings e ${st.progFirmes}/${st.progs} progressões firmes. Vale no 25 teclas e no completo.`};
 }
 const n=chords.length||1,m=chords.filter(c=>isMastered(c.id)).length;
 return{pct:Math.round(m/n*100),detail:`${m} voicings dominados`};
}
function ultimaSessaoCompleta(){
 for(let i=state.sessions.length-1;i>=0;i--)if(state.sessions[i].kb!=='mini')return state.sessions[i];
 return null;
}
function diasDesde(iso){
 const t=new Date(iso);if(!iso||isNaN(t))return null;
 const a=new Date();a.setHours(0,0,0,0);
 const b=new Date(t);b.setHours(0,0,0,0);
 return Math.round((a-b)/86400000);
}
function mecanicaLedger(){
 const tech=techniqueModuleProgress();
 const ult=ultimaSessaoCompleta();
 let folga='Ainda sem sessão no teclado completo.';
 if(ult){
  const dias=diasDesde(ult.date);
  const quando=typeof fmtDate==='function'?fmtDate(dateKey(ult.date)):dateKey(ult.date);
  folga=dias<=0?'Última no teclado completo: hoje.':dias===1?'Última no teclado completo: ontem.':`Última no teclado completo: ${quando}. Faz ${dias} dias.`;
 }
 return{pct:tech.pct,detail:`${tech.detail} · ${folga}`};
}
function normPonte(p){
 if(!p||typeof p!=='object'||!Array.isArray(p.ids))return null;
 const ids=p.ids.filter(id=>typeof id==='string'&&id);
 const keys=Array.isArray(p.keys)?p.keys.filter(k=>KEYS[k]):[];
 if(!ids.length)return null;
 return{id:String(p.id||''),title:String(p.title||'Progressão'),ids,keys,at:typeof p.at==='string'?p.at:'',feito:!!p.feito};
}
function pontePendente(){const p=normPonte(state.ponte);return p&&!p.feito?p:null}
/* O 25 teclas guarda a progressão. A volta no teclado completo toca a mesma fila, uma vez. */
function guardarPonte(){
 if(!session||session.kb!=='mini'||session.replay||!session.ids||!session.ids.length)return;
 const keys=[];
 session.queue.forEach(e=>{if(KEYS[e.key]&&!keys.includes(e.key))keys.push(e.key)});
 state.ponte={id:session.focusId||'',title:session.title||'Progressão',ids:session.ids.slice(),keys,at:new Date().toISOString(),feito:false};
}
function renderPonte(){
 const box=document.getElementById('ponte-card');if(!box)return;
 const p=pontePendente();
 if(!p){box.hidden=true;box.innerHTML='';return}
 box.hidden=false;
 const tons=p.keys.length?p.keys.join(' → '):'os tons da última sessão';
 const mini=kbIsMini();
 box.innerHTML=`<div><div class="eyebrow">Abertura real</div><h3>${esc(p.title)}</h3><p>${mini?`Está guardada do 25 teclas (${esc(tons)}). Troque o seletor para Completo e toque uma passada no desenho escrito.`:`Uma passada em ${esc(tons)}, no desenho escrito. Não entra de novo no mapa dos 12 tons.`}</p></div>${mini?'':`<button class="btn primary" type="button" onclick="startPonte()">Tocar no teclado completo</button>`}`;
}
function startPonte(){
 const p=pontePendente();
 if(!p||kbIsMini())return;
 const keys=p.keys.length?p.keys:trainingKeys().slice(0,4);
 const queue=keys.flatMap(key=>p.ids.map(id=>({id,key})));
 const prev={density:setup.density,strict:setup.strict,dinamica:setup.dinamica,region:setup.region,hands:setup.hands,advance:setup.advance,metro:setup.metro};
 setup.density=3;setup.strict='octave';setup.dinamica='off';setup.region=0;setup.hands='both';
 if(![4,8,16].includes(Number(setup.advance)))setup.advance=4;
 setup.metro=true;
 beginSession(p.ids,p.title,'A mesma harmonia, na abertura escrita. Uma passada.',true,queue,p.id||'ponte');
 setup.density=prev.density;setup.strict=prev.strict;setup.dinamica=prev.dinamica;setup.region=prev.region;setup.hands=prev.hands;setup.advance=prev.advance;setup.metro=prev.metro;
 if(!session)return;
 session.replay=true;session.chain=false;session.rush=false;session.kb='full';
 session.density=3;session.strict='octave';session.dinamica='off';session.region=0;session.hands='both';
 document.getElementById('session-title').textContent=`${p.title} · abertura real`;
 renderKeymap();renderSession();
}
function renderLedger(){
 const box=document.getElementById('ledger');if(!box)return;
 const h=harmoniaLedger(),m=mecanicaLedger();
 box.innerHTML=`<article><span>Harmonia</span><b>${h.pct}%</b><i>${esc(h.detail)}</i></article><article><span>Mecânica</span><b>${m.pct}%</b><i>${esc(m.detail)}</i></article>`;
}
function renderChords(){const q=document.getElementById('chord-search').value.trim().toLowerCase();const list=chords.filter(c=>(activeFilter==='all'||c.groups.includes(activeFilter))&&(!q||`${c.name} ${c.voicingTitle} ${c.degree} ${c.shape}`.toLowerCase().includes(q)));const grid=document.getElementById('chord-grid');grid.innerHTML=list.length?list.map(c=>{const m=mastery(c.id),ok=isMastered(c.id),status=ok?'good':m?'learning':'';return`<button class="chord-card" onclick="openChord('${c.id}')"><span class="voice-note">${c.degree}${allKeys?' · 12 tons':''}</span><div class="chord-name">${allKeys?c.voicingTitle:c.name}</div><div class="chord-shape">${allKeys?`Modelo em ${c.name}`:c.voicingTitle} · ${c.shape}</div><div class="mastery ${status}"><i class="mastery-dot"></i>${ok?'Dominado':m?'Em estudo':'Novo'}</div>${svgDiagram(c,true)}</button>`}).join(''):'<div class="empty">Nenhum voicing encontrado.</div>'}
function sequenceHtml(ids){return ids.map((id,i)=>`${i?'<span class="arrow">→</span>':''}<span>${esc(chord(id).name)}</span>`).join('')}
function exerciseHtml(e){
 const m=exerciseMastery(e),ok=exerciseMastered(e),status=ok?'good':m?'learning':'';
 const firm=e.ids.filter(id=>isMastered(id)).length;
 return`<article class="exercise-card"><span class="tag">${e.level}</span><div class="degree-line">${e.degrees}</div><div class="exercise-chords">${sequenceHtml(e.ids)}</div><h3>${e.name}</h3><p>${e.tip}</p>${cardProgressHtml(m,ok?'Dominada':`Firmes ${firm}/${e.ids.length}`)}<div class="mastery ${status}" style="margin-top:8px"><i class="mastery-dot"></i>${ok?'Dominada':m?'Em estudo':'Nova'}</div><button class="btn" onclick="startExercise('${e.id}')">Estudar progressão</button></article>`;
}
function renderExercises(){
 const mod=exercisesModuleProgress(),stat=document.getElementById('exercise-module-stat');
 if(stat)stat.innerHTML=moduleStatHtml('Domínio',mod.pct,mod.detail);
 document.getElementById('exercise-grid').innerHTML=exercises.map(exerciseHtml).join('');
}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='chords')renderChords();if(name==='scales')renderScales();if(name==='technique')renderTechnique();if(name==='plan')renderPlan();if(name==='timbres')renderToneStudy();if(name==='ear')renderEar();if(name==='banda')renderBanda();if(name==='songs')ensureSongs(true);if(name==='culto')renderCulto();if(name==='evolucao')renderEvolucao();window.scrollTo({top:0,behavior:'smooth'})}
function openChord(id){const c=chord(id);if(!c)return;document.getElementById('detail-name').textContent=`${allKeys?'12 tons · ':c.name+' · '}${c.voicingTitle}`;document.getElementById('chord-detail').innerHTML=`<div class="diagram-panel">${svgDiagram(c)}<div class="diagram-caption"><span style="color:var(--green)">● ME</span> · <span style="color:var(--accent-text)">● MD</span> · ${allKeys?'modelo em C · ':''}${c.shape}</div></div><div class="detail-copy"><div class="eyebrow">${c.degree} · ${c.level}${allKeys?' · ciclo de 12 tons':''}</div><h2>${c.name}</h2><p class="muted">${c.function}</p><div class="finger-row"><span class="finger-chip">MD · ${c.rh}</span><span class="finger-chip">ME · ${c.lh}</span></div><h3>Condução e aplicação</h3><p class="muted">${c.tip}</p><ul>${c.care.map(t=>`<li>${t}</li>`).join('')}</ul>${c.variation?`<h3>Desenvolvimento</h3><p class="muted">${c.variation}</p>`:''}${chordScalesHtml(c)}${allKeys?keyTableHtml(c):''}<div style="margin-top:22px"><button class="btn primary" onclick="closeOverlay('detail-overlay');openSetup('${c.id}')">${allKeys?'Praticar nos 12 tons':'Praticar este voicing'}</button></div></div>`;openOverlay('detail-overlay')}
/* Overlay: o Tab precisa circular só dentro do diálogo, e ao fechar o foco
   volta para o botão que abriu. Sem isso o leitor de tela continua na página
   atrás — os doze têm role=dialog, mas isso sozinho não prende o teclado. */
const OVERLAY_FOCUS='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let overlayStack=[];
function overlayFocusables(el){
 return[...el.querySelectorAll(OVERLAY_FOCUS)].filter(n=>{
  if(n.disabled||n.getAttribute('aria-hidden')==='true')return false;
  const r=n.getBoundingClientRect();
  return r.width>0&&r.height>0;
 });
}
function openOverlay(id){
 const el=document.getElementById(id);if(!el)return;
 overlayStack.push({id,from:document.activeElement});
 el.classList.add('open');document.body.style.overflow='hidden';
 const first=overlayFocusables(el)[0];
 if(first)requestAnimationFrame(()=>first.focus());
}
function closeOverlay(id){
 const el=document.getElementById(id);if(!el)return;
 el.classList.remove('open');
 if(!document.querySelector('.overlay.open'))document.body.style.overflow='';
 const i=overlayStack.map(x=>x.id).lastIndexOf(id);
 const rec=i>=0?overlayStack.splice(i,1)[0]:null;
 const from=rec&&rec.from;
 if(from&&typeof from.focus==='function'&&document.contains(from))from.focus();
}
function trapOverlayTab(e){
 const open=[...document.querySelectorAll('.overlay.open')].pop();
 if(!open)return;
 const list=overlayFocusables(open);
 if(!list.length){e.preventDefault();return}
 const first=list[0],last=list[list.length-1],cur=document.activeElement;
 if(e.shiftKey&&(cur===first||!open.contains(cur))){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&(cur===last||!open.contains(cur))){e.preventDefault();first.focus()}
}
function openSetup(focus='open_colors'){setup.focus=focus;const keys=sessionKeys(),curto=allKeys&&keys.length<trainingKeys().length,r=kbIsMini()&&kbRange();const tom=curto?`Esta sessão usa ${keys.length} tons: ${keys.join(' → ')}.`:allKeys?`Esta sessão percorre os 12 tons pelo ciclo de ${cycleName()}: ${trainingKeys().join(' → ')}.`:'Esta sessão permanece no tom de '+studyKey+'.';document.getElementById('setup-tone').textContent=tom+(r?` No 25 teclas (${noteName(r.lo,true)}–${noteName(r.hi,true)}) ela entra na harmonia: abertura, dinâmica e andamento de técnica ficam para o teclado completo.`:'');const choices=[...paths.map(p=>({id:p.id,name:p.name})),...chords.map(c=>({id:c.id,name:`${c.name} · ${c.voicingTitle}`}))];document.getElementById('density-choices').innerHTML=DENSITY.map((d,i)=>`<button class="choice" data-density="${i}" title="${esc(d.hint)}">${esc(d.name)}</button>`).join('');
 document.getElementById('region-choices').innerHTML=REGIONS.map(r=>`<button class="choice" data-region="${r.v}">${r.n}</button>`).join('')+HANDS.map(h=>`<button class="choice" data-hands="${h.v}">${h.n}</button>`).join('');
 document.getElementById('strict-choices').innerHTML=STRICTS.map(x=>`<button class="choice" data-strict="${x.v}">${x.n}</button>`).join('');
 document.getElementById('din-choices').innerHTML=DINAMICAS.map(x=>`<button class="choice" data-din="${x.v}" title="${esc(x.hint)}">${x.n}</button>`).join('');
 document.getElementById('focus-choices').innerHTML=choices.filter((v,i)=>i<paths.length||v.id===focus).map(v=>`<button class="choice${v.id===focus?' active':''}" data-focus="${v.id}">${v.name}</button>`).join('');bindSetupChoices();openOverlay('setup-overlay')}
function bindSetupChoices(){
 document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{setup.focus=b.dataset.focus;document.querySelectorAll('[data-focus]').forEach(x=>x.classList.toggle('active',x===b))});
 document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{setup.duration=Number(b.dataset.duration);document.querySelectorAll('[data-duration]').forEach(x=>x.classList.toggle('active',x===b))});
 document.querySelectorAll('#advance-choices [data-adv]').forEach(b=>b.onclick=()=>setAdvance(Number(b.dataset.adv)));
 document.getElementById('metro-choice').onclick=e=>{setup.metro=!setup.metro;saveState();syncSetupControls()};
 document.querySelectorAll('[data-density]').forEach(b=>b.onclick=()=>{setup.density=Number(b.dataset.density);state.density=setup.density;saveState();if(session)session.density=setup.density;syncSetupControls();if(session)renderSession()});
 document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const v=Number(b.dataset.region);if(kbIsMini()&&v)return;setup.region=v;state.region=v;saveState();if(session)session.region=setup.region;syncSetupControls();if(session)renderSession()});
 document.querySelectorAll('[data-hands]').forEach(b=>b.onclick=()=>{setup.hands=b.dataset.hands;state.hands=setup.hands;saveState();if(session)session.hands=setup.hands;syncSetupControls();if(session)renderSession()});
 document.querySelectorAll('[data-strict]').forEach(b=>b.onclick=()=>{if(kbIsMini()&&b.dataset.strict==='octave')return;setup.strict=b.dataset.strict;state.strict=setup.strict;saveState();if(session)session.strict=setup.strict;syncSetupControls()});
 document.querySelectorAll('[data-din]').forEach(b=>b.onclick=()=>{if(kbIsMini()&&b.dataset.din!=='off')return;setup.dinamica=b.dataset.din;state.dinamica=setup.dinamica;saveState();if(session)session.dinamica=setup.dinamica;syncSetupControls()});
 syncSetupControls();
}
function syncSetupControls(){
 const bpm=document.getElementById('setup-bpm');if(bpm)bpm.textContent=setup.bpm;
 const hide=document.getElementById('hide-choice2');if(hide)hide.classList.toggle('active',!setup.hide);
 syncDegreeModeUi();
 const fala=document.getElementById('speak-choice');
 if(fala){fala.style.display=speakSupported()?'':'none';fala.classList.toggle('active',!!state.speakDegree)}
 const metro=document.getElementById('metro-choice');if(metro)metro.classList.toggle('active',setup.metro);
 const chain=document.getElementById('chain-choice');if(chain)chain.classList.toggle('active',state.sessionChain!==false);
 const inv=document.getElementById('inv-choice');if(inv)inv.classList.toggle('active',!!state.invLivre);
 const rito=document.getElementById('rito-choice');if(rito)rito.classList.toggle('active',!!state.ouvirCantar);
 document.querySelectorAll('#advance-choices [data-adv]').forEach(b=>b.classList.toggle('active',Number(b.dataset.adv)===setup.advance));
 document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===setup.duration));
 document.querySelectorAll('[data-density]').forEach(b=>b.classList.toggle('active',Number(b.dataset.density)===setup.density));
 document.querySelectorAll('[data-hands]').forEach(b=>b.classList.toggle('active',b.dataset.hands===setup.hands));
 document.querySelectorAll('[data-region]').forEach(b=>{
  const off=kbIsMini()&&Number(b.dataset.region)!==0;
  b.disabled=off;
  if(off)b.title='No 25 teclas a região grave/aguda não cabe. O voicing entra na tessitura calibrada.';
  b.classList.toggle('active',!off&&Number(b.dataset.region)===setup.region);
 });
 document.querySelectorAll('[data-strict]').forEach(b=>{
  const off=kbIsMini()&&b.dataset.strict==='octave';
  b.disabled=off;
  if(off)b.title='Altura exata fica para o teclado completo. Aqui contam as notas, não a oitava.';
  b.classList.toggle('active',!off&&b.dataset.strict===setup.strict);
 });
 document.querySelectorAll('[data-din]').forEach(b=>{
  const off=kbIsMini()&&b.dataset.din!=='off';
  b.disabled=off;
  if(!b.dataset.hint)b.dataset.hint=b.title||'';
  b.title=off?'No 25 teclas a dinâmica não entra: a tecla curta não mede peso.':b.dataset.hint;
  b.classList.toggle('active',!off&&b.dataset.din===setup.dinamica);
 });
}
function toggleSessionChain(){state.sessionChain=state.sessionChain===false;saveState();syncSetupControls();if(session)session.chain=state.sessionChain!==false}
function toggleInvLivre(){
 state.invLivre=!state.invLivre;saveState();
 if(session){session.invLivre=!!state.invLivre;session.leadFrom=null;renderSession()}
 syncSetupControls();
}
function toggleOuvirCantar(){
 state.ouvirCantar=!state.ouvirCantar;saveState();
 if(session){
  session.ouvirCantar=!!state.ouvirCantar;
  if(!session.ouvirCantar){
   const religar=!!session.ritoPausouRelogio;
   session.rito=null;session.ritoPausouRelogio=false;ritoFecharMic();
   if(religar&&session.playing)startSessionClock();
  }
  renderSession();
 }
 syncSetupControls();
}
function startExercise(id){const e=exercises.find(x=>x.id===id);if(!e)return;beginSession(e.ids,e.name,e.tip,true,null,e.id)}
function startSession(){const path=paths.find(p=>p.id===setup.focus);const ids=path?path.ids:[setup.focus];closeOverlay('setup-overlay');beginSession(ids,path?path.name:`Voicing ${chord(setup.focus)?.name||''}`,'Mantenha a região, identifique a função e ouça cada tensão antes de avançar.')}
function beginSession(ids,title,transitionTip='',sequence=false,presetQueue=null,focusId=''){
 if(globalMetroPlaying){stopGlobalMetronome();setup.metro=true}
 if(cycleOrder==='random')dynamicOrder=shuffle(CYCLE_ORDERS.fifths);
 const cycles=Math.max(1,Math.ceil(setup.duration*60/10)),keys=sessionKeys();
 let queue;
 if(presetQueue&&presetQueue.length)queue=presetQueue.map(e=>({...e}));
 else if(allKeys&&sequence)queue=keys.flatMap(key=>ids.map(id=>({id,key})));
 /* trilha/voicing nos 12 tons: cada forma percorre o ciclo inteiro, depois a próxima */
 else if(allKeys)queue=ids.flatMap(id=>keys.map(key=>({id,key})));
 else queue=Array.from({length:cycles},(_,i)=>({id:ids[i%ids.length],key:studyKey}));
 /* Dia cheio: uma passada e para. Repetir a fila até encher o relógio cortava no meio do ciclo. */
 const rush=typeof planMode!=='undefined'&&planMode==='rush'&&!presetQueue;
 if(setup.advance&&!presetQueue&&!rush){
  const base=queue.length,perChord=setup.advance*60/setup.bpm;
  const wanted=Math.max(1,Math.round(setup.duration*60/Math.max(4,base*perChord))),cap=Math.max(1,Math.floor(96/Math.max(1,base))),loops=Math.min(wanted,cap);
  if(loops>1)queue=Array.from({length:loops}).flatMap(()=>queue.map(e=>({...e})));
 }
 /* nos 12 tons o relógio acompanha a fila — senão o timer de 3 min corta no meio e força recomeçar.
   No dia cheio o relógio só precisa cobrir a passada: quem encerra é o último acorde. */
 let duration=setup.duration*60;
 if((allKeys||presetQueue)&&!rush)duration=Math.max(duration,queue.length*4);
 if(setup.advance)duration=Math.max(duration,Math.ceil(queue.length*setup.advance*60/setup.bpm)+3);
 if(rush)duration=Math.ceil(queue.length*Math.max(4,setup.advance||4)*60/setup.bpm)+8;
 const chain=!rush&&state.sessionChain!==false;
 const mini=kbIsMini();
 let strict=setup.strict,dinamica=setup.dinamica,region=setup.region;
 if(mini){if(strict==='octave')strict='pc';dinamica='off';region=0}
 session={ids,queue,index:0,title,transitionTip,start:Date.now(),duration,ratings:[],allKeys,cycleOrder,focusId:focusId||setup.focus,bpm:setup.bpm,startBpm:setup.bpm,advance:setup.advance,metro:setup.metro,metro2:normMetro(state.metro),playing:!!(setup.metro||setup.advance),pending:null,beatIndex:0,bar:0,ear:planMode==='ear',earRevealed:false,midiHit:false,subAt:null,subN:0,pedal:{baixo:false,pendente:null,trocas:0,limpas:0,soma:0,presas:0},pedalUltimo:'',density:setup.density,region,hands:setup.hands,strict,dinamica,dinFalhas:0,leadFrom:null,leadTarget:null,paused:false,left:duration,metroWasOn:false,chain,sequence:!!sequence,kb:mini?'mini':'full',rush,mix:false,invLivre:!!state.invLivre,ouvirCantar:!!state.ouvirCantar,missRun:0,slowMsg:'',visto:{},rito:null};
 const chainHint=chain&&peekChainNext({focusId:session.focusId,sequence:session.sequence})?` · encadeado`:'';
 const tomHint=rush?` · ${keys.length} tons`:(allKeys&&!presetQueue?` · ciclo de ${cycleName()}`:'');
 document.getElementById('session-title').textContent=`${title}${tomHint}${chainHint}`;
 openOverlay('session-overlay');
 renderKeymap();renderSession();renderTransport();renderRec();paintSessionClock();
 clearInterval(sessionTimer);sessionTimer=setInterval(tickSession,250);
 if(session.playing)startSessionClock();
}
function chainLabel(next){
 if(!next)return '';
 if(next.kind==='review')return`Revisão · ${next.q.length} itens`;
 if(next.kind==='path')return next.path.name;
 if(next.kind==='exercise')return next.ex.name;
 if(next.kind==='voicing'){const c=chord(next.id);return c?`${c.name} · ${c.voicingTitle}`:next.id}
 return '';
}
function peekChainNext(snap){
 if(!snap)return null;
 if(snap.focusId==='revisao'){
  if(typeof dueQueue!=='function')return null;
  const q=dueQueue(Math.max(12,setup.duration*8));
  return q.length?{kind:'review',q}:null;
 }
 const pi=paths.findIndex(p=>p.id===snap.focusId);
 if(pi>=0)return pi+1<paths.length?{kind:'path',path:paths[pi+1]}:null;
 if(snap.sequence||exercises.some(e=>e.id===snap.focusId)){
  const ei=exercises.findIndex(e=>e.id===snap.focusId);
  return ei>=0&&ei+1<exercises.length?{kind:'exercise',ex:exercises[ei+1]}:null;
 }
 if(typeof PATH_ORDER!=='undefined'){
  const oi=PATH_ORDER.indexOf(snap.focusId);
  if(oi>=0&&oi+1<PATH_ORDER.length)return{kind:'voicing',id:PATH_ORDER[oi+1]};
 }
 return null;
}
function beginChainNext(next){
 if(!next)return;
 if(next.kind==='review')beginSession(next.q.map(x=>x.id),'Revisão do dia','Vencidos primeiro, material novo intercalado.',false,next.q.map(x=>({id:x.id,key:x.key})),'revisao');
 else if(next.kind==='path')beginSession(next.path.ids,next.path.name,'Mantenha a região, identifique a função e ouça cada tensão antes de avançar.',false,null,next.path.id);
 else if(next.kind==='exercise')beginSession(next.ex.ids,next.ex.name,next.ex.tip,true,null,next.ex.id);
 else if(next.kind==='voicing'){const c=chord(next.id);beginSession([next.id],c?`Voicing ${c.name}`:next.id,'Mantenha a região, identifique a função e ouça cada tensão antes de avançar.',false,null,next.id)}
}
function continueFromSummary(focusId,sequence){
 closeOverlay('summary-overlay');
 const next=peekChainNext({focusId,sequence:!!sequence});
 if(next)beginChainNext(next);
}
function sessionLeftSec(){
 if(!session)return 0;
 if(session.paused)return session.left;
 return Math.max(0,session.duration-Math.floor((Date.now()-session.start)/1000));
}
function sessionElapsedSec(){
 if(!session)return 0;
 if(session.paused)return Math.max(0,session.duration-session.left);
 return Math.floor((Date.now()-session.start)/1000);
}
function paintSessionClock(){
 if(!session)return;
 const left=sessionLeftSec(),el=document.getElementById('session-time'),btn=document.getElementById('session-pause'),top=document.querySelector('#session-overlay .session-top');
 if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
 if(btn)btn.textContent=session.paused?'Continuar':'Pausar';
 if(top)top.classList.toggle('paused',!!session.paused);
}
function toggleSessionPause(){
 if(!session)return;
 if(session.paused){
  session.start=Date.now()-(session.duration-session.left)*1000;
  session.paused=false;
  if(session.metroWasOn){session.playing=true;startSessionClock()}
  session.metroWasOn=false;
 }else{
  session.left=sessionLeftSec();
  session.paused=true;
  session.metroWasOn=!!session.playing;
  if(session.playing){session.playing=false;stopBeat();document.querySelectorAll('#beat-dots i').forEach(d=>d.classList.remove('on','down'))}
 }
 paintSessionClock();renderTransport();
}
function tickSession(){if(!session||session.paused)return;paintSessionClock();paintResponseTime();if(sessionLeftSec()<=0)finishSession()}
function handNotes(c){
 const kb=c.key||studyKey,f=c.flats;
 const lh=(c.left||[]).map(m=>spellName(c,m)),rh=(c.right||[]).map(m=>spellName(c,m));
 return{lh:lh.join(' '),rh:rh.join(' '),all:`${lh.join(' ')} | ${rh.join(' ')}`};
}
function chordQuality(c){return String(c.name||'').replace(/^[A-G][b#]?/,'').replace(/\/.*$/,'').toLowerCase()}
function scalesForChord(c){
 const q=chordQuality(c),out=[];
 const add=(...ids)=>ids.forEach(id=>{if(!out.includes(id)&&SCALE_TEMPLATES.some(x=>x.id===id))out.push(id)});
 if(/dim/.test(q))add('diminished-wh');
 else if(/m7\(b5\)|ø/.test(q))add('locrian');
 else if(/m\(maj/.test(q))add('melodic-minor','harmonic-minor');
 else if(/^m(?!aj)/.test(q))add('dorian','aeolian','minor-pentatonic');
 else if(/alt|#9|b9/.test(q))add('altered','diminished-hw','phrygian-dominant');
 else if(/sus/.test(q))add('mixolydian','major-pentatonic');
 else if(/aug|\+/.test(q))add('whole-tone','augmented-hexatonic');
 else if(/maj/.test(q))add(/#11/.test(q)?'lydian':'major',/#11/.test(q)?'major':'lydian','bebop-major');
 else if(/^(7|9|13)/.test(q))add(/#11/.test(q)?'lydian-dominant':'mixolydian','bebop-dominant','blues');
 else add('major','major-pentatonic','lydian');
 return out.slice(0,3);
}
function chordScalesHtml(c){
 const ids=scalesForChord(c),root=keyFromNote(String(c.name||'').match(/^[A-G][b#]?/)?.[0]);
 if(!ids.length||!root)return '';
 return `<h3 style="margin-top:20px">Escalas para este acorde</h3><div class="finger-row">${ids.map(id=>{const sc=SCALE_TEMPLATES.find(x=>x.id===id);return `<button class="finger-chip scale-chip" onclick="openScale('${id}','${root}')">${esc(root)} ${esc(sc.name)}</button>`}).join('')}</div><p class="tiny" style="margin-top:6px">Construídas sobre ${esc(root)}, a fundamental deste acorde.</p>`;
}
function keyTableHtml(c){
 return `<h3 style="margin-top:20px">Notas nos 12 tons</h3><p class="tiny" style="margin-bottom:4px">A barra mostra seu domínio deste voicing em cada tom.</p><div class="key-table">${trainingKeys().map(k=>{
  const cc=chordInKey(c.id,k)||c,st=itemState(c.id,k);
  return `<div class="heat-${heatLevel(st)}"><b>${esc(cc.name)}</b><i>${esc(handNotes(cc).all)}</i><em>${st.status==='new'?'novo':`${st.strength}%${st.status==='due'?' · vence hoje':''}`}</em><span class="heat-bar"><u style="width:${st.status==='new'?0:st.strength}%"></u></span></div>`
 }).join('')}</div>`;
}
function keymapGroups(){
 const g=[];
 session.queue.forEach((e,i)=>{const last=g[g.length-1];if(last&&last.key===e.key)last.items.push({e,i});else g.push({key:e.key,items:[{e,i}]})});
 return g;
}
function renderKeymap(){
 if(!session)return;
 const head=session.allKeys?`Notas do treino · ciclo de ${cycleName()}`:`Sequência em ${studyKey}`;
 document.getElementById('practice-side').innerHTML=`<div class="keymap"><div class="keymap-head">${head}</div>${keymapGroups().map(g=>`<div class="keymap-row"><div class="keymap-key">${esc(g.key)}</div><div class="keymap-chips">${g.items.map(({e,i})=>{const c=chordInKey(e.id,e.key);return `<button class="keymap-chip" data-i="${i}" onclick="jumpTo(${i})" title="Ir para este acorde"><b>${esc(promptName(c))}</b><i>${esc(state.degreeMode?(c.function||c.degree||''):handNotes(practiced(c)).all)}</i></button>`}).join('')}</div></div>`).join('')}</div>`;
 updateKeymap();
}
function updateKeymap(){
 if(!session)return;
 let current=null;
 document.querySelectorAll('#practice-side .keymap-chip').forEach(el=>{
  const i=Number(el.dataset.i),entry=session.queue[i];
  const now=i===session.index;
  el.classList.toggle('now',now);
  el.classList.toggle('done',i<session.index);
  el.classList.toggle('firm',!!entry&&entry.result===2);
  el.classList.toggle('weak',!!entry&&entry.result===0);
  if(now)current=el;
 });
 document.querySelectorAll('#practice-side .keymap-row').forEach(r=>r.classList.toggle('active',!!current&&r.contains(current)));
 if(current)current.scrollIntoView({block:'nearest'});
}
/* Exibição Notas / Graus.

   Notas é o começo: nome do acorde, ME/MD e teclado. Graus esconde isso e pede
   a função — a meta é achar o 6m9 de qualquer tom sem passar pelo nome. A escolha
   fica gravada; na sessão dá para mudar a qualquer momento (ou G). */
function promptName(c){return state.degreeMode?(c.degree||c.name):c.name}
function promptAlt(c){return state.degreeMode?c.name:(c.degree||'')}
function syncDegreeModeUi(){
 const on=!!state.degreeMode;
 document.querySelectorAll('[data-degree]').forEach(b=>b.classList.toggle('active',b.dataset.degree===(on?'graus':'notes')));
 const n=document.getElementById('session-mode-notes'),g=document.getElementById('session-mode-degrees');
 if(n){n.classList.toggle('active',!on);n.setAttribute('aria-pressed',String(!on))}
 if(g){g.classList.toggle('active',on);g.setAttribute('aria-pressed',String(on))}
}
function setDegreeMode(on){
 const v=!!on;
 if(state.degreeMode===v){syncDegreeModeUi();return}
 if(exam)exam.degreeTouched=true;
 if(session&&session.volta)delete session.volta.degree;
 state.degreeMode=v;saveState();
 if(session){renderKeymap();renderSession()}
 renderChords();syncSetupControls();
}
function toggleDegreeMode(){setDegreeMode(!state.degreeMode)}
/* Primeira vez de cada acorde: ouça, cante a fundamental, depois a mão.
   O relógio do metrônomo espera. Sem microfone, a etapa de cantar é pulada. */
function ritoAberto(){return !!(session&&session.rito&&session.rito.fase!=='tocar')}
function ritoChave(){const e=session.queue[session.index];return `${e.id}@${e.key}`}
let ritoMic=null,ritoRaf=null;
function ritoFecharMic(){
 cancelAnimationFrame(ritoRaf);ritoRaf=null;
 if(session&&session.ritoTimer){clearTimeout(session.ritoTimer);session.ritoTimer=null}
 if(ritoMic){try{ritoMic.stream.getTracks().forEach(t=>t.stop())}catch(e){}ritoMic=null}
}
function prepararRito(c){
 ritoFecharMic();
 if(!session.ouvirCantar||session.replay){session.rito=null;return}
 const chave=ritoChave();
 session.visto=session.visto||{};
 if(session.visto[chave]){session.rito=null;return}
 session.rito={fase:'ouvir',chave,root:c.rootPc,dica:''};
 if(session.playing){session.ritoPausouRelogio=true;stopBeat()}
 playCurrentChord();
 session.ritoTimer=setTimeout(ritoParaCantar,1500);
}
async function ritoParaCantar(){
 if(!session||!session.rito||session.rito.fase!=='ouvir')return;
 session.rito.fase='cantar';session.rito.dica='Segure a fundamental que você acabou de ouvir.';
 renderSession();
 const ok=await ritoAbrirMic();
 if(!session||!session.rito||session.rito.fase!=='cantar')return;
 if(!ok){ritoParaTocar();return}
 ritoLoop();
}
async function ritoAbrirMic(){
 if(ritoMic)return true;
 if(typeof micSupported!=='function'||!micSupported())return false;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const ctx=Metronomo.acordar();if(!ctx)throw new Error('sem áudio');
  const an=ctx.createAnalyser();an.fftSize=2048;
  ctx.createMediaStreamSource(stream).connect(an);
  ritoMic={stream,an,buf:new Float32Array(an.fftSize),ctx,firme:null};
  return true;
 }catch(e){return false}
}
function ritoLoop(){
 ritoRaf=requestAnimationFrame(ritoLoop);
 if(!ritoMic||!session||!session.rito||session.rito.fase!=='cantar')return;
 ritoMic.an.getFloatTimeDomainData(ritoMic.buf);
 const f=detectPitch(ritoMic.buf,ritoMic.ctx.sampleRate);
 if(!(f>60&&f<1400)){ritoMic.firme=null;return}
 const semi=12*Math.log2(f/440)+69,arred=Math.round(semi),desvio=Math.round((semi-arred)*100);
 const dentro=pcOf(arred)===pcOf(session.rito.root)&&Math.abs(desvio)<=35;
 ritoMic.firme=dentro?(ritoMic.firme||Date.now()):null;
 if(dentro&&Date.now()-ritoMic.firme>500)ritoParaTocar();
}
function ritoParaTocar(){
 if(!session||!session.rito)return;
 session.visto[session.rito.chave]=true;
 session.rito=null;
 const religar=!!session.ritoPausouRelogio;
 session.ritoPausouRelogio=false;
 ritoFecharMic();
 renderSession();
 if(religar&&session&&session.playing)startSessionClock();
}
function renderSession(){
 if(!session)return;
 const entry=session.queue[session.index],c=chordInKey(entry.id,entry.key),nextEntry=session.queue[session.index+1],next=nextEntry?chordInKey(nextEntry.id,nextEntry.key):null;
 if(session.shownIndex!==session.index){session.shownIndex=session.index;session.shownAt=performance.now();prepararRito(c)}
 const cp=practiced(c),n=handNotes(cp);
 const rito=ritoAberto(),livre=!!session.invLivre;
 document.getElementById('session-pos').textContent=`${session.allKeys?`tom ${entry.key} · `:''}rodada ${session.index+1}/${session.queue.length}`;
 const escondido=session.ear&&!session.earRevealed,oculto=escondido||state.degreeMode||livre||rito;
 document.getElementById('prompt-chord').textContent=escondido?'?':(livre||rito)?(c.degree||c.name):promptName(c);
 document.getElementById('prompt-label').textContent=rito&&session.rito.fase==='ouvir'?'Ouça':rito&&session.rito.fase==='cantar'?'Cante a fundamental':escondido?`Tom ${entry.key} · ouça e identifique`:`Tom ${entry.key} · ${(livre?c.name:promptAlt(c))}`;
 document.getElementById('prompt-notes').innerHTML=oculto?'':`<div class="note-line lh"><span class="hand">ME</span>${esc(n.lh)}</div><div class="note-line rh"><span class="hand">MD</span>${esc(n.rh)}</div>`;
 document.getElementById('prompt-fingers').textContent=oculto?'':`MD ${cp.rh} · ME ${cp.lh}`;
 let tip=escondido?'Toque o acorde de novo quantas vezes quiser antes de revelar.':(state.degreeMode?`${c.function||c.tip} · confira com D`:(c.function||c.tip));
 if(rito&&session.rito.fase==='ouvir')tip='O acorde soa. A mão entra depois que você cantar a fundamental.';
 else if(rito&&session.rito.fase==='cantar')tip=session.rito.dica||'Segure a fundamental que você acabou de ouvir.';
 const marca=practiceLabel();
 if(!rito&&marca)tip=`${session.density===5?DENSITY[5].hint:marca}${session.density!==5&&session.density!==3?` — ${DENSITY[session.density].hint}`:''}`;
 if(livre&&!rito)tip=`Você escolhe a inversão. A nota cai se a mão andar mais que o caminho curto.${tip?` · ${tip}`:''}`;
 if(session.mix)tip=`Ordem misturada. Vai parecer pior agora. A retenção aparece depois.${tip?` · ${tip}`:''}`;
 if(session.slowMsg)tip=`${session.slowMsg}${tip?` · ${tip}`:''}`;
 if(session.languagePractice)tip=`${session.languagePractice} · Base harmônica: a aplicação de estilo é por escuta.`;
 const kbNota=kbSessaoNota(cp.fit);
 if(kbNota&&!escondido&&!rito)tip=tip?`${tip} · ${kbNota}`:kbNota;
 document.getElementById('prompt-tip').textContent=tip;
 const densBtn=document.getElementById('density-btn');
 if(densBtn){densBtn.textContent=`Camada · ${densityName(session.density)}`;densBtn.classList.toggle('primary',session.density!==3)}
 document.getElementById('prompt-next').textContent=escondido?'':(next?`A seguir: ${nextEntry.key} · ${promptName(next)}${state.degreeMode?'':` · ${handNotes(practiced(next)).all}`}`:'Último da sequência');
 document.getElementById('prompt-kb').innerHTML=(setup.hide||oculto||rito||!cp.left.length&&!cp.right.length)?'':svgDiagram(cp);
 const earBtn=document.getElementById('ear-btn');
 if(earBtn){earBtn.textContent=session.ear?(session.earRevealed?'Ouvido: revelado':'Revelar · R'):'Modo ouvido';earBtn.classList.toggle('primary',!!session.ear)}
 session.midiHit=false;paintMidi(null);
 if(!ritoAberto()&&!escondido&&session.shownAt&&performance.now()-session.shownAt<80)speakDegree(c);

 updateKeymap();paintRating();paintResponseTime();syncDegreeModeUi();
 if(document.getElementById('peek-overlay').classList.contains('open'))renderPeek();
}
/* Tempo de resposta.

   Acertar não é o mesmo que dominar: se o acorde só sai depois de você caçar as
   notas, isso é aprendizado, não fluência. Então medimos quanto tempo o acorde
   ficou na tela antes da resposta e usamos isso para NÃO promover a "firme" o
   que veio devagar — quando a nota foi dada automaticamente (avanço no compasso
   ou acerto pelo MIDI). Nota que você marcou com o dedo continua valendo o que
   você disse. */
const RESPOSTA_ALVO_MS=4000;
function responseMs(){
 if(!session||!session.shownAt)return null;
 return Math.round(performance.now()-session.shownAt);
}
function responseTargetMs(){
 if(!session)return RESPOSTA_ALVO_MS;
 /* com avanço automático, a régua é a própria janela do acorde: chegar só no
    fim do compasso não é fluência */
 if(session.advance)return Math.max(1200,Math.round(session.advance*60/session.bpm*1000*0.5));
 return RESPOSTA_ALVO_MS;
}
function fmtSeg(ms){return ms==null?'—':`${(ms/1000).toFixed(1)} s`}
function paintResponseTime(){
 const box=document.getElementById('response-time');
 if(!box)return;
 if(!session){box.textContent='';return}
 const ms=responseMs(),alvo=responseTargetMs();
 box.textContent=ms==null?'':`${fmtSeg(ms)} · alvo ${fmtSeg(alvo)}`;
 box.classList.toggle('lento',ms!=null&&ms>alvo);
}
function paintRating(){
 const names=['Repetir','Quase','Firme'],label=document.getElementById('rate-label');
 const marked=session&&session.pending!=null;
 label.textContent=marked?`Marcado: ${names[session.pending]}`:(session&&session.advance?'Marque enquanto toca':'Como ficou?');
 document.querySelectorAll('.session-foot .rate').forEach((b,i)=>b.classList.toggle('marked',marked&&i===session.pending));
}
function peekVoicing(){
 if(!session)return;
 const box=document.getElementById('peek-overlay');
 if(box.classList.contains('open'))return closeOverlay('peek-overlay');
 renderPeek();openOverlay('peek-overlay');
}
function renderPeek(){
 if(!session)return;
 const entry=session.queue[session.index],c=chordInKey(entry.id,entry.key),n=handNotes(c);
 document.getElementById('peek-name').textContent=`${c.name} · ${c.voicingTitle}`;
 document.getElementById('peek-body').innerHTML=`<div class="diagram-panel">${svgDiagram(c)}<div class="diagram-caption"><span style="color:var(--green)">● ME</span> ${esc(n.lh)} · <span style="color:var(--accent-text)">● MD</span> ${esc(n.rh)}</div></div><div class="finger-row" style="justify-content:center;margin-top:12px"><span class="finger-chip">Tom ${esc(entry.key)}</span><span class="finger-chip">${esc(c.degree)}</span><span class="finger-chip">MD · ${esc(c.rh)}</span><span class="finger-chip">ME · ${esc(c.lh)}</span></div><p class="muted" style="margin-top:12px;font-size:12px">${esc(c.tip)}</p>`;
}
function toggleInlineKeyboard(){setup.hide=!setup.hide;saveState();syncSetupControls();if(session)renderSession()}
function jumpTo(i){if(!session||i<0||i>=session.queue.length)return;marcarTrocaPedal();session.index=i;session.pending=null;session.leadFrom=null;if(session.ear)session.earRevealed=false;renderSession();if(session.ear)playCurrentChord();/* não reinicia o relógio: troca de acorde no meio do compasso */}
function stepSession(delta){if(!session)return;jumpTo(session.index+delta)}
function rateCurrent(value){
 if(!session)return;
 session.pendingFromMidi=false;
 if(session.advance){session.pending=session.pending===value?null:value;paintRating();return}
 commitRating(value,false);
}
function commitRating(value,fromClock,opts){
 if(!session||ritoAberto())return;
 const entry=session.queue[session.index];
 const ms=responseMs(),automatica=!!(opts&&opts.auto);
 /* nota automática só vira "firme" se veio dentro do alvo */
 if(automatica&&value===2&&ms!=null&&ms>responseTargetMs())value=1;
 session.ratings.push({...entry,value,ms});entry.result=value;
 /* A volta no teclado completo confirma a mão. O mapa dos 12 tons já foi contado no 25 teclas. */
 if(!session.replay)scheduleReview(entry.id,entry.key,value,ms);
 if(value===2&&session.advance&&session.kb!=='mini'&&!session.replay)state.bpmPr[session.focusId]=Math.max(Number(state.bpmPr[session.focusId])||0,session.bpm);
 /* Três erros seguidos gravam o erro. Desce 5 BPM e o acorde volta na hora.
    Erro é "repetir", ou o compasso fechou sem o acorde certo no MIDI. */
 const errou=value===0||(automatica&&value<2&&midiState==='on'&&!session.midiHit);
 if(errou)session.missRun=(session.missRun||0)+1;else session.missRun=0;
 const isolar=errou&&session.missRun>=3;
 if(isolar){
  session.missRun=0;
  const v=Math.max(40,session.bpm-5);
  if(v!==session.bpm){session.bpm=v;setup.bpm=v;if(session.playing&&clock&&clock.rodando)nudgeClock();renderTransport();renderGlobalMetronome()}
  session.slowMsg=`Três erros. Andamento ${session.bpm} BPM. Este acorde de novo, devagar.`;
 }else if(!errou)session.slowMsg='';
 let rebuild=false;
 if((value===0||isolar)&&!session.rush&&!session.replay&&session.queue.length<96){session.queue.splice(Math.min(session.index+(isolar?1:2),session.queue.length),0,{id:entry.id,key:entry.key});rebuild=true}
 marcarTrocaPedal();session.index++;session.pending=null;session.pendingFromMidi=false;
 if(session.index>=session.queue.length)return finishSession();
 if(rebuild)renderKeymap();
 if(session.ear)session.earRevealed=false;
 renderSession();
 if(session.ear)playCurrentChord();
 else if(session.metro2&&session.metro2.chord)playCurrentChord({duration:1.2});
 /* MIDI / nota manual não podem zerar o compasso — só garante o relógio se estiver parado */
 if(!fromClock&&session.playing&&!(clock&&clock.rodando))startSessionClock();
}
function advanceAuto(){
 if(!session||ritoAberto())return;
 const explicito=session.pending!=null&&!session.pendingFromMidi;
 /* sem prova nenhuma, o acorde conta como praticado ("quase"), não dominado */
 const nota=session.pending==null?1:session.pending;
 commitRating(nota,true,{auto:!explicito});
}
function startSessionClock(){if(!session)return;session.beatIndex=0;startClock({bpm:()=>session.bpm,sub:()=>effSub(),level:sessionLevel,onTick:sessionTick})}
function sessionLevel(n){
 if(!session||!session.metro)return -1;
 const m=session.metro2,sub=effSub(),meter=effMeter();
 const beatN=Math.floor(n/sub),inBeat=n%sub,pos=beatN%meter,bar=Math.floor(beatN/meter);
 if(barMuted(bar))return -1;
 const clickEvery=Math.max(1,Math.round(sub/Math.min(sub,Math.max(1,m.sub))));
 if(n%clickEvery!==0)return -1;
 return inBeat===0?(m.accents.includes(pos)?2:1):0;
}
function barMuted(bar){
 const m=session.metro2;
 if(!m.silentOn||!m.silentOff)return false;
 return (bar%(m.silentOn+m.silentOff))>=m.silentOn;
}
function activeGroove(){const id=session&&session.metro2&&session.metro2.groove,g=GROOVES.find(x=>x.id===id);return g&&g.hits.length?g:null}
function effMeter(){const g=activeGroove();return Math.max(2,g?g.meter:session.metro2.meter)}
function effSub(){const g=activeGroove();return Math.max(1,g?g.sub:session.metro2.sub)}
function sessionTick(n){
 if(!session)return;
 const m=session.metro2,g=activeGroove(),sub=effSub(),meter=effMeter();
 const beatN=Math.floor(n/sub),inBeat=n%sub,pos=beatN%meter,bar=Math.floor(beatN/meter),slot=n%(meter*sub);
 const muted=barMuted(bar);
 session.beatIndex=beatN;session.bar=bar;
 if(g&&!muted&&g.hits.includes(slot))playCurrentChord({duration:Math.max(.35,g.sustain*60/session.bpm),roll:.006});
 if(g)paintGroove(slot);
 session.subAt=performance.now();session.subN=n;
 if(inBeat===0)paintBeats(pos,muted,beatN)
 if(inBeat===0&&pos===0&&bar>0&&m.rampEvery&&bar%m.rampEvery===0)rampTempo();
 if(session.advance&&n>0&&n%(session.advance*sub)===0)advanceAuto();
}
function paintGroove(slot){document.querySelectorAll('#groove-grid i').forEach((c,i)=>c.classList.toggle('now',i===slot))}
function paintBeats(pos,muted,beatN){
 const per=session.advance;
 document.querySelectorAll('#beat-dots i').forEach((d,i)=>{
  const on=i===pos;
  d.classList.toggle('on',on&&!muted);
  d.classList.toggle('muted',on&&muted);
  d.classList.toggle('down',on&&!muted&&!!per&&beatN%per===0);
 });
}
function rampTempo(){
 const m=session.metro2,v=Math.min(m.rampMax,session.bpm+m.rampStep);
 if(v===session.bpm)return;
 session.bpm=v;setup.bpm=v;saveState();renderTransport();
}
function toggleTransport(){
 if(!session)return;
 session.playing=!session.playing;
 if(session.playing)startSessionClock();else{stopBeat();document.querySelectorAll('#beat-dots i').forEach(d=>d.classList.remove('on','down'))}
 renderTransport();
}
function toggleSessionSound(){
 if(session){session.metro=!session.metro;setup.metro=session.metro}else setup.metro=!setup.metro;
 saveState();syncSetupControls();
 if(session&&session.metro&&!session.playing)toggleTransport();else renderTransport();
}
function changeBpm(delta){
 const base=session?session.bpm:setup.bpm,v=Math.max(40,Math.min(220,base+delta));
 setup.bpm=v;if(session){session.bpm=v;if(session.playing){clock?nudgeClock():startSessionClock()}}
 saveState();syncSetupControls();renderTransport();renderGlobalMetronome();
}
function tapTempo(){
 const now=performance.now();
 tapTimes=tapTimes.filter(t=>now-t<2400);tapTimes.push(now);tapTimes=tapTimes.slice(-5);
 if(tapTimes.length<2)return;
 const gaps=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]),avg=gaps.reduce((a,b)=>a+b,0)/gaps.length,bpm=Math.round(60000/avg);
 if(bpm<40||bpm>220)return;
 /* mesma regra do changeBpm: trocar andamento no meio não reinicia o compasso */
 setup.bpm=bpm;if(session){session.bpm=bpm;if(session.playing){clock?nudgeClock():startSessionClock()}}
 saveState();syncSetupControls();renderTransport();renderGlobalMetronome();
}
function setAdvance(v){
 setup.advance=v;
 if(v&&!setup.metro)setup.metro=true;
 if(session){session.advance=v;session.metro=setup.metro;if(v&&!session.playing)session.playing=true;if(session.playing)startSessionClock()}
 saveState();syncSetupControls();renderTransport();paintRating();
}
function renderTransport(){
 if(!session)return;
 const m=session.metro2,g=activeGroove(),meter=effMeter(),sub=effSub();
 const dots=document.getElementById('beat-dots');
 if(dots.children.length!==meter)dots.innerHTML='<i></i>'.repeat(meter);
 [...dots.children].forEach((d,i)=>d.classList.toggle('acc',m.accents.includes(i)));
 const grid=document.getElementById('groove-grid');
 if(g){
  const slots=meter*sub;
  grid.style.display='flex';
  if(grid.children.length!==slots||grid.dataset.groove!==g.id){
   grid.dataset.groove=g.id;
   grid.innerHTML=Array.from({length:slots},(_,i)=>`<i class="${g.hits.includes(i)?'hit':''}${i%sub===0?' beat':''}"></i>`).join('');
  }
 }else{grid.style.display='none';grid.dataset.groove=''}
 const play=document.getElementById('transport-play');play.innerHTML=session.playing?'&#10073;&#10073;':'&#9654;';play.classList.toggle('on',session.playing);
 const snd=document.getElementById('transport-sound');snd.innerHTML=session.metro?'&#128266;':'&#128263;';snd.classList.toggle('on',session.metro);
 document.getElementById('bpm-value').textContent=session.bpm;
 const parts=[g?g.name:null,session.advance?`troca a cada ${session.advance} tempos · ${(session.advance*60/session.bpm).toFixed(1)}s`:'avanço manual',g?`${g.meter}/${g.meter===6?8:4}`:`${m.meter}/4`];
 if(m.sub>1)parts.push(m.sub===2?'colcheias':m.sub===3?'tercinas':'semicolcheias');
 if(m.rampEvery)parts.push(`+${m.rampStep} a cada ${m.rampEvery} comp. até ${m.rampMax}`);
 if(m.accents.length!==1||m.accents[0]!==0)parts.push(accentLabel(m.accents));
 if(m.silentOn&&m.silentOff)parts.push(`mudo ${m.silentOn}+${m.silentOff}`);
 document.getElementById('adv-note').textContent=parts.filter(Boolean).join(' · ');
 document.querySelectorAll('#adv-row .adv').forEach(b=>b.classList.toggle('active',Number(b.dataset.adv)===session.advance));
 const midiBtn=document.getElementById('midi-btn');
 if(midiBtn){midiBtn.classList.toggle('on',midiState==='on');midiBtn.title=midiLabel()}
 const midiBox=document.getElementById('midi-note');
 if(midiBox&&midiState!=='on')midiBox.textContent=midiState==='off'?'':midiLabel();
}
function requestEndSession(){if(!session)return closeOverlay('session-overlay');clearInterval(sessionTimer);sessionTimer=null;ritoFecharMic();stopBeat();if(typeof voltarModos==='function')voltarModos(session);if(session.gravar&&typeof rec!=='undefined'&&rec&&rec.state==='recording')rec.stop();session=null;closeOverlay('session-overlay');if(typeof restoreExamDegree==='function')restoreExamDegree()}
function finishSession(){
 if(!session)return;
 clearInterval(sessionTimer);sessionTimer=null;ritoFecharMic();stopBeat();
 const snap={focusId:session.focusId,sequence:!!session.sequence,chain:!!session.chain,title:session.title};
 const completed=session.index>=session.queue.length;
 const elapsed=Math.max(1,Math.round(sessionElapsedSec()/60)),firm=session.ratings.filter(r=>r.value===2).length,total=session.ratings.length,cycle=session.allKeys&&!session.rush;
 const mini=session.kb==='mini',rush=!!session.rush,replay=!!session.replay;
 const tempos=session.ratings.map(r=>r.ms).filter(v=>v!=null&&isFinite(v)),medio=tempos.length?Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length):null;
 const ped=pedalResumo();
 if(mini&&!replay&&total>0)guardarPonte();
 if(replay&&state.ponte)state.ponte.feito=true;
 if(rush&&completed&&typeof fecharBlocoRush==='function')fecharBlocoRush();
 if(typeof aoConcluirSessao==='function')aoConcluirSessao(session,completed,total);
 state.sessions.push({date:new Date().toISOString(),minutes:elapsed,focus:session.title,ratings:total,key:rush?'4 tons':cycle?'12 tons':studyKey,kb:mini?'mini':'full',conta:replay?'abertura':mini?'harmonia':'completo',ms:medio,firm});
 state.sessions=state.sessions.slice(-365);saveState();
 closeOverlay('session-overlay');
 session=null;
 renderDashboard();renderChords();renderExercises();
 if(typeof examCapture==='function'&&examCapture(`${total} repetições · ${firm} firmes · tempo médio ${fmtSeg(medio)}`,total>0&&firm/total>=.7))return;
 const next=peekChainNext(snap);
 if(snap.chain&&completed&&next){beginChainNext(next);return;}
 const cont=next
  ?`<div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn primary" onclick="continueFromSummary('${snap.focusId}',${snap.sequence?'true':'false'})">Continuar · ${esc(chainLabel(next))}</button><button class="btn" onclick="closeOverlay('summary-overlay')">Encerrar</button></div>`
  :(typeof planFollowUpHtml==='function'?planFollowUpHtml():'<button class="btn primary" onclick="closeOverlay(\'summary-overlay\')">Concluir</button>');
 const onde=replay?'abertura real':mini&&rush?'25 teclas · 4 tons':mini?'25 teclas':rush?'4 tons':cycle?'ciclo de 12 tons':`tom ${studyKey}`;
 const frase=replay?'Esta passada não entra de novo no mapa dos 12 tons. Ela acerta a mão na abertura escrita.':mini?`Os acordes entraram no mapa dos 12 tons${rush?' — quatro tons, uma passada':''}. Com o seletor em Completo, a aba Hoje pede a mesma progressão na abertura real.`:rush?'Uma passada pelos quatro tons. O resto do ciclo fica para o dia com tempo.':cycle?'Você percorreu o ciclo tonal; o próximo estudo pode seguir sem reabrir o setup.':'Repita em outro tom e preserve o desenho das vozes, não a posição absoluta.';
 document.getElementById('summary').innerHTML=`<div class="summary-mark">✓</div><div class="eyebrow">Sessão concluída · ${onde}</div><h2 id="summary-title">${replay?'Mão no teclado completo':mini?'Harmonia consolidada':'Condução consolidada'}</h2><p class="muted" style="margin-top:6px">${frase}</p><div class="summary-grid"><div class="summary-stat"><b>${elapsed}</b><span>minutos</span></div><div class="summary-stat"><b>${total}</b><span>repetições</span></div><div class="summary-stat"><b>${firm}</b><span>firmes</span></div><div class="summary-stat"><b>${medio==null?'—':fmtSeg(medio)}</b><span>tempo médio</span></div>${ped?`<div class="summary-stat"><b>${ped.pct}%</b><span>pedal limpo em ${ped.trocas}</span></div>`:''}</div>${cont}`;
 openOverlay('summary-overlay');
}
/* O motor de áudio agora vive no metronomo.js, junto com a saída escolhida e a
   agenda — o que muda aqui é só o timbre e a política de acentos. */
const CLIQUE={
 forte:{freq:1500,ganho:.07,decai:.035,tipo:'sine'},
 normal:{freq:900,ganho:.04,decai:.035,tipo:'sine'},
 fraco:{freq:1250,ganho:.014,decai:.02,tipo:'sine'}
};
function cliqueDe(level){
 if(level==null||level<0)return null;
 return level>=2?CLIQUE.forte:level===1?CLIQUE.normal:CLIQUE.fraco;
}
function beat(level=1,when){return Metronomo.clique(cliqueDe(level),when)}
function playNotes(midis,opt={}){
 if(!midis||!midis.length)return;
 const soar=()=>{
  const ctx=Metronomo.contexto(),saida=Metronomo.destino();
  if(!ctx||!saida)return;
  try{
   const t0=ctx.currentTime+.02,dur=opt.duration||1.7,roll=opt.roll===undefined?.014:opt.roll;
   const master=ctx.createGain();master.gain.value=Math.min(.34,.85/Math.max(3,midis.length));
   const filt=ctx.createBiquadFilter();filt.type='lowpass';filt.frequency.value=3400;
   master.connect(filt);filt.connect(saida);
   midis.slice().sort((a,b)=>a-b).forEach((m,i)=>{
    const f=440*Math.pow(2,(m-69)/12),st=t0+i*roll;
    [[1,.62],[2,.17],[3,.07],[4,.03]].forEach(([mult,amp])=>{
     const o=ctx.createOscillator(),g=ctx.createGain();
     o.type='triangle';o.frequency.value=f*mult;
     g.gain.setValueAtTime(.0001,st);
     g.gain.exponentialRampToValueAtTime(amp,st+.014);
     g.gain.exponentialRampToValueAtTime(.0008,st+dur);
     o.connect(g);g.connect(master);o.start(st);o.stop(st+dur+.06);
    });
   });
  }catch(e){}
 };
 const ctx=Metronomo.liberar();
 if(!ctx)return;
 if(ctx.state==='running'){soar();return}
 const seguir=()=>{if(ctx.state==='running')soar()};
 ctx.addEventListener('statechange',seguir,{once:true});
 try{ctx.resume()}catch(e){}
}
function playChordOf(c,opt){if(!c)return;const n=session?practiceNotes(c):{all:[...(c.left||[]),...(c.right||[])]};if(n.all.length)playNotes(n.all,opt)}
function playCurrentChord(opt){if(!session)return;const e=session.queue[session.index];playChordOf(chordInKey(e.id,e.key),opt)}
function startClock(opts){
 stopBeat();
 clock=Metronomo.criar({
  passo:()=>60/(Math.max(20,opts.bpm())*Math.max(1,opts.sub())),
  soar:n=>cliqueDe(opts.level?opts.level(n):1),
  aoTocar:n=>opts.onTick(n),
  /* aba oculta acumula atraso: colapsar evita marcar vários acordes de uma vez */
  colapsar:()=>Math.max(2,Math.max(1,opts.sub())*2)
 }).iniciar();
}
/* Trocar andamento no meio não reinicia o compasso — vem do metrônomo das cifras. */
function nudgeClock(){if(clock&&clock.rodando)clock.remarcar()}
function startBeat(bpm=100,onBeat=techniquePulse,sound=()=>true){
 startClock({bpm:()=>bpm,sub:()=>1,level:n=>sound()?(n%4===0?2:1):-1,onTick:n=>{if(onBeat)onBeat(n)}});
}
function stopBeat(){
 clearTimeout(beatTimer);clearInterval(beatTimer);beatTimer=null;
 if(clock)clock.parar();
 clock=null;
}
/* Metrônomo fixo da barra superior. Ao abrir uma prática, o pulso passa para
   o relógio da sessão para nunca haver dois metrônomos concorrentes. */
function globalMetroConfig(){return normMetro(state.metro)}
function globalMetroMuted(m,bar){return !!(m.silentOn&&m.silentOff&&(bar%(m.silentOn+m.silentOff))>=m.silentOn)}
function globalMetroLevel(n){
 const m=globalMetroConfig(),sub=Math.max(1,m.sub),beatN=Math.floor(n/sub),inBeat=n%sub,pos=beatN%m.meter,bar=Math.floor(beatN/m.meter);
 if(globalMetroMuted(m,bar))return -1;
 return inBeat===0?(m.accents.includes(pos)?2:1):0;
}
function globalMetroTick(n){
 if(!globalMetroPlaying)return;
 const m=globalMetroConfig(),sub=Math.max(1,m.sub);
 if(n%sub)return;
 const beatN=Math.floor(n/sub),pos=beatN%m.meter,bar=Math.floor(beatN/m.meter),muted=globalMetroMuted(m,bar);
 globalMetroBeatIndex=pos;
 document.querySelectorAll('#global-metro-dots i').forEach((dot,i)=>{dot.classList.toggle('on',i===pos);dot.classList.toggle('down',i===pos&&m.accents.includes(i));dot.classList.toggle('muted',i===pos&&muted)});
 if(pos===0&&bar>0&&m.rampEvery&&bar%m.rampEvery===0){setup.bpm=Math.min(m.rampMax,setup.bpm+m.rampStep);saveState();renderGlobalMetronome()}
}
function startGlobalMetronome(){
 if(!globalMetroPlaying)return;
 globalMetroBeatIndex=0;
 startClock({bpm:()=>setup.bpm,sub:()=>globalMetroConfig().sub,level:globalMetroLevel,onTick:globalMetroTick});
 renderGlobalMetronome();
}
function stopGlobalMetronome(){
 globalMetroPlaying=false;globalMetroBeatIndex=0;stopBeat();renderGlobalMetronome();
}
function toggleGlobalMetronome(){
 if(session)return toggleTransport();
 if(techniqueDrill)return;
 globalMetroPlaying=!globalMetroPlaying;
 if(globalMetroPlaying)startGlobalMetronome();else stopGlobalMetronome();
}
function renderGlobalMetronome(){
 const play=document.getElementById('global-metro-play'),bpm=document.getElementById('global-metro-bpm'),dots=document.getElementById('global-metro-dots');
 if(!play||!bpm||!dots)return;
 const m=globalMetroConfig();
 bpm.textContent=setup.bpm;play.innerHTML=globalMetroPlaying?'&#10073;&#10073;':'&#9654;';play.classList.toggle('on',globalMetroPlaying);play.title=globalMetroPlaying?'Pausar metrônomo':'Tocar metrônomo';play.setAttribute('aria-label',play.title);
 if(dots.children.length!==m.meter)dots.innerHTML='<i></i>'.repeat(m.meter);
 if(!globalMetroPlaying)[...dots.children].forEach(dot=>dot.classList.remove('on','down','muted'));
}
/* ================= teclado MIDI =================
   No navegador usa Web MIDI; no app Tauri usa a ponte MIDI nativa. */
function webMidiSupported(){return typeof navigator!=='undefined'&&typeof navigator.requestMIDIAccess==='function'}
function nativeMidiApi(){const t=window.__TAURI__;return t?.core?.invoke&&t?.event?.listen?t:null}
function midiSupported(){return webMidiSupported()||!!nativeMidiApi()}
async function toggleMidi(){
 if(!midiSupported()){midiState='unsupported';renderTransport();syncTechniqueMidiUi();return}
 if(midiState==='on')return disconnectMidi();
 midiState='asking';renderTransport();syncTechniqueMidiUi();
 const native=nativeMidiApi();
 if(native)return connectNativeMidi(native);
 try{
  midiAccess=await navigator.requestMIDIAccess({sysex:false});
  midiBackend='web';
  bindMidiInputs();
  midiAccess.onstatechange=()=>{bindMidiInputs();renderTransport();syncTechniqueMidiUi()};
  midiState=midiInputs.length?'on':'empty';
 }catch(e){midiState='denied'}
 renderTransport();
 if(techniqueDrill&&!techniqueDrill.completed){techniqueDrill.midiPos=0;renderTechniqueLive();paintTechniqueMidi()}
 else syncTechniqueMidiUi();
}
async function connectNativeMidi(native){
 try{
  const devices=await native.core.invoke('midi_inputs');
  if(!devices.length){midiState='empty';renderTransport();syncTechniqueMidiUi();return}
  nativeMidiUnlisten=await native.event.listen('midi-message',event=>onMidiMessage({data:event.payload}));
  const name=await native.core.invoke('midi_connect',{portIndex:devices[0].index});
  midiBackend='native';midiInputs=[{name}];midiState='on';
 }catch(e){
  console.error('Falha ao conectar MIDI nativo',e);
  if(nativeMidiUnlisten){nativeMidiUnlisten();nativeMidiUnlisten=null}
  midiBackend=null;midiInputs=[];midiState='error';
 }
 renderTransport();
 if(techniqueDrill&&!techniqueDrill.completed){techniqueDrill.midiPos=0;renderTechniqueLive();paintTechniqueMidi()}
 else syncTechniqueMidiUi();
}
function bindMidiInputs(){
 if(!midiAccess)return;
 midiInputs=[...midiAccess.inputs.values()];
 midiInputs.forEach(inp=>{inp.onmidimessage=onMidiMessage});
}
function disconnectMidi(){
 midiInputs.forEach(inp=>{inp.onmidimessage=null});
 if(midiBackend==='web'&&midiAccess)midiAccess.onstatechange=null;
 if(midiBackend==='native')nativeMidiApi()?.core.invoke('midi_disconnect').catch(e=>console.error('Falha ao desconectar MIDI nativo',e));
 if(nativeMidiUnlisten){nativeMidiUnlisten();nativeMidiUnlisten=null}
 midiBackend=null;midiAccess=null;
 midiInputs=[];midiHeld.clear();midiVel.clear();midiState='off';
 if(session)session.midiHit=false;
 paintMidi(null);renderTransport();syncTechniqueMidiUi();
 if(techniqueDrill&&!techniqueDrill.completed)renderTechniqueLive();
}
function onMidiMessage(e){
 const d=e.data||[],cmd=d[0]&0xf0,note=d[1],vel=d[2];
 if(cmd===0x90&&vel>0){midiHeld.add(note);midiVel.set(note,vel);if(kbListen){kbCalNote(note);return}kbHear(note)}
 else if(cmd===0x80||(cmd===0x90&&vel===0)){midiHeld.delete(note);midiVel.delete(note)}
 else if(cmd===0xb0&&note===123){midiHeld.clear();midiVel.clear()}
 else if(cmd===0xb0&&note===64)return pedalMidi(vel>=64);
 else return;
 if(session)checkMidiChord();
 else if(techniqueDrill)checkMidiTechnique(cmd,note,vel);
 else if(typeof bandaRun!=='undefined'&&bandaRun)bandaMidi(cmd,note,vel);
 else if(typeof leituraRun!=='undefined'&&leituraRun)leituraMidi();
 else if(typeof ministRun!=='undefined'&&ministRun)ministMidi(cmd,note,vel);
}
function checkMidiChord(){
 if(!session||midiState!=='on'||ritoAberto())return;
 const entry=session.queue[session.index],c=chordInKey(entry.id,entry.key),alvoN=practiceNotes(c).all;
 /* camada silenciosa: não há o que validar, e não vale nota automática */
 if(!alvoN.length){paintMidi({silencio:true});session.midiHit=false;return}
 const alvo=new Set(alvoN.map(pcOf)),tocado=new Set([...midiHeld].map(pcOf));
 const faltam=[...alvo].filter(p=>!tocado.has(p));
 const sobram=[...tocado].filter(p=>!alvo.has(p));
 let certo=tocado.size>0&&!faltam.length&&!sobram.length,aviso='';
 /* as notas certas em qualquer oitava não provam inversão nem região — por isso
    os níveis de exigência: a Fase 2 do plano é sobre exatamente isso */
 if(certo&&session.strict!=='pc'&&!session.invLivre){
  const bAlvo=pcOf(Math.min(...alvoN)),bToc=pcOf(Math.min(...midiHeld));
  if(bAlvo!==bToc){certo=false;aviso=`baixo errado · ${(c.spell&&c.spell[bAlvo])||NOTE_SHARP[bAlvo]} embaixo`}
 }
 if(certo&&session.strict==='octave'&&!session.invLivre){
  const a=[...alvoN].sort((x,y)=>x-y),t=[...midiHeld].sort((x,y)=>x-y);
  if(a.length!==t.length||a.some((v,i)=>v!==t[i]))
   {certo=false;aviso='altura exata · confira a oitava de cada voz'}
 }
 paintMidi({certo,faltam,sobram,aviso,vazio:!tocado.size,spell:c.spell});
 if(certo&&!session.midiHit){session.midiHit=true;onMidiCorrect(alvoN)}
 if(!certo)session.midiHit=false;
}
/* Lê a dinâmica do acorde que acabou de ser tocado: o volume médio e o
   desequilíbrio entre as vozes. Só as notas do acorde entram na conta — uma
   tecla ainda presa de antes falsearia as duas medidas. */
function lerDinamica(tocado){
 const vs=tocado.map(n=>midiVel.get(n)).filter(v=>typeof v==='number'&&v>0);
 if(!vs.length)return null;
 const media=Math.round(vs.reduce((a,b)=>a+b,0)/vs.length);
 /* Equilíbrio só existe entre vozes: com uma nota só, o volume ainda vale. */
 const espalho=vs.length>1?Math.max(...vs)-Math.min(...vs):null;
 return{media,espalho,vozes:vs.length};
}
function avaliarDinamica(lida){
 if(!lida)return null;
 const alvo=dinamicaDe(session&&session.dinamica).alvo;
 const desnivel=lida.espalho!=null&&lida.espalho>DIN_ESPALHO;
 if(alvo==null)return{texto:desnivel?` · vozes desiguais (${lida.espalho})`:'',ok:true};
 const erro=lida.media-alvo,fora=Math.abs(erro)>DIN_TOL;
 const partes=[];
 if(fora)partes.push(`${erro>0?'forte demais':'fraco demais'} (${lida.media} para ${alvo})`);
 if(desnivel)partes.push(`vozes desiguais (${lida.espalho})`);
 return{texto:partes.length?' · '+partes.join(' · '):` · dinâmica ok (${lida.media})`,ok:!fora&&!desnivel};
}
/* Onde a levada REALMENTE bate. Sem levada, a régua é a cabeça de cada tempo;
   com levada, são os ataques dela — que em seis das oito caem fora da cabeça.
   Medir contra o tempo mais próximo fazia o Charleston tocado certo aparecer
   como meio tempo atrasado, ou seja, o número dizia o contrário do certo. */
function expectedSlots(){
 const g=activeGroove(),sub=effSub(),meter=effMeter(),ciclo=meter*sub;
 if(g&&g.hits.length)return{ciclo,slots:[...g.hits].sort((a,b)=>a-b)};
 const slots=[];for(let i=0;i<ciclo;i+=sub)slots.push(i);
 return{ciclo,slots};
}
/* ================= pedal =================

   A diferença mais audível entre intermediário e avançado não é voicing: é
   pedal sujo. Trocar de harmonia sem levantar o pedal soma os dois acordes, e
   quem toca não ouve — ouve quem está na plateia.

   O pedal legato correto levanta LOGO DEPOIS do acorde novo soar, não antes:
   antes abre buraco, muito depois borra. Por isso a janela limpa começa na
   troca e vai até PEDAL_LIMPO — e levantar no instante exato da troca também
   conta como limpo. Nada disso pune a nota do acorde: encontrar o voicing e
   limpar o pedal são duas habilidades, e misturá-las esconderia as duas. */
const PEDAL_LIMPO=150;
function pedalMidi(baixo){
 if(!session||!session.pedal)return;
 const p=session.pedal;
 if(baixo===p.baixo)return;
 p.baixo=baixo;
 if(!baixo&&p.pendente!=null){
  const atraso=Math.round(performance.now()-p.pendente);
  p.pendente=null;p.trocas++;p.soma+=atraso;
  const limpo=atraso<=PEDAL_LIMPO;
  if(limpo)p.limpas++;
  session.pedalUltimo=limpo?` · pedal limpo (+${atraso} ms)`:` · pedal borrado (+${atraso} ms)`;
  const box=document.getElementById('midi-note');
  if(box&&midiState==='on')box.textContent=session.pedalUltimo.replace(/^ · /,'');
 }
}
/* Chamado quando a harmonia troca: se o pedal está no chão, começa a contar. */
function marcarTrocaPedal(){
 if(!session||!session.pedal)return;
 const p=session.pedal;
 if(p.pendente!=null){p.trocas++;p.presas++;p.soma+=PEDAL_LIMPO*2;session.pedalUltimo=' · pedal preso na troca'}
 p.pendente=p.baixo?performance.now():null;
}
function pedalResumo(){
 const p=session&&session.pedal;
 if(!p||!p.trocas)return null;
 return{trocas:p.trocas,pct:Math.round(p.limpas/p.trocas*100),medio:Math.round(p.soma/p.trocas),presas:p.presas};
}
function midiTiming(){
 if(!session||!session.playing||session.subAt==null)return null;
 const sub=effSub(),subMs=60000/(session.bpm*sub);
 if(!isFinite(subMs)||subMs<=0)return null;
 /* posição fracionária em subdivisões desde o início do relógio */
 const pos=session.subN+(performance.now()-session.subAt)/subMs;
 const{ciclo,slots}=expectedSlots();
 if(!slots.length)return null;
 const base=Math.floor(pos/ciclo)*ciclo;
 let melhor=null;
 /* o ciclo anterior e o seguinte entram para não errar na virada do compasso */
 for(const volta of [-ciclo,0,ciclo])for(const sl of slots){
  const d=(pos-(base+volta+sl))*subMs;
  if(melhor==null||Math.abs(d)<Math.abs(melhor))melhor=d;
 }
 return Math.round(melhor);
}
function onMidiCorrect(alvoN){
 const t=midiTiming(),tocado=[...midiHeld];
 const din=session.kb==='mini'?null:avaliarDinamica(lerDinamica(tocado));
 if(din&&!din.ok)session.dinFalhas=(session.dinFalhas||0)+1;
 let cond='',andouDemais=false;
 if(session.leadFrom&&session.leadFrom.length){
  const seu=totalShift(session.leadFrom,tocado),ideal=totalShift(session.leadTarget,alvoN||[]);
  if(seu!=null&&ideal!=null){
   andouDemais=seu>ideal+1;
   cond=andouDemais?` · a mão andou ${seu} st · o caminho curto anda ${ideal}`:` · condução ${seu} st`;
  }
 }
 session.leadFrom=tocado;session.leadTarget=alvoN||[];
 const box=document.getElementById('midi-note');
 if(box)box.textContent=(t===null?'✓ acorde certo':`✓ certo · ${t>0?'+':''}${t} ms do tempo`)+cond+(din?din.texto:'')+(session.pedalUltimo||'');
 session.pedalUltimo='';
 if(session.ear)revealEar();
 /* Mesma régua do tempo de resposta: acertar as notas com a dinâmica pedida
    errada não é domínio, é meio acerto. */
 let nota=din&&!din.ok?1:2;
 if(session.invLivre&&andouDemais)nota=1;
 session.pending=nota;session.pendingFromMidi=true;paintRating();
 if(!session.advance)setTimeout(()=>{if(session&&session.midiHit)commitRating(nota,false,{auto:true})},260);
}
function paintMidi(info){
 const box=document.getElementById('midi-note');if(!box)return;
 if(!info||midiState!=='on')return void(box.textContent='');
 if(info.silencio)return void(box.textContent='camada silenciosa · avance quando a frase pedir');
 if(info.vazio)return void(box.textContent='aguardando o acorde…');
 if(info.certo)return;
 if(info.aviso)return void(box.textContent=info.aviso);
 const nome=p=>(info.spell&&info.spell[p])||NOTE_SHARP[p];
 const partes=[];
 if(info.faltam.length)partes.push('faltam '+info.faltam.map(nome).join(' '));
 if(info.sobram.length)partes.push('sobram '+info.sobram.map(nome).join(' '));
 box.textContent=partes.join(' · ');
}
function midiLabel(){
 return({off:'MIDI desligado',on:midiInputs.length?`MIDI: ${midiInputs[0].name||'teclado'}`:'MIDI ligado',asking:'procurando teclado MIDI…',empty:'nenhum teclado MIDI encontrado',denied:'acesso MIDI negado',error:'falha ao conectar o teclado MIDI',unsupported:'MIDI indisponível neste ambiente'})[midiState]||'';
}
let kbListen=null;
function syncKbUi(){
 const sel=document.getElementById('kb-profile');
 if(sel)sel.value=kbIsMini()?'mini':'full';
 const btn=document.getElementById('kb-cal-btn');
 if(!btn)return;
 btn.hidden=!kbIsMini();
 if(!kbIsMini())return;
 const r=kbRange()||{lo:48,hi:72},cal=!!(state.kb&&state.kb.calibrated);
 btn.textContent=cal?`${noteName(r.lo,true)}–${noteName(r.hi,true)}`:'Calibrar';
 btn.title=cal?'Ajustar a tessitura do 25 teclas':'Toque a tecla mais grave e a mais aguda';
}
function setKbProfile(v){
 const profile=v==='mini'?'mini':'full';
 const prev=normKb(state.kb);
 state.kb=normKb({profile,lo:prev.lo,hi:prev.hi,calibrated:prev.calibrated});
 aplicarLimitesMini();
 saveState();syncKbUi();syncSetupControls();
 if(session){
  session.kb=profile;
  if(profile==='mini'){if(session.strict==='octave')session.strict='pc';session.dinamica='off';session.region=0}
  renderSession();
 }
 renderDashboard();renderTechnique();
 if(profile==='mini'&&!state.kb.calibrated)openKbCal();
}
function aplicarLimitesMini(){
 if(!kbIsMini())return false;
 let mudou=false;
 if(setup.strict==='octave'){setup.strict='pc';state.strict='pc';mudou=true}
 if(setup.dinamica!=='off'){setup.dinamica='off';state.dinamica='off';mudou=true}
 if(setup.region){setup.region=0;state.region=0;mudou=true}
 return mudou;
}
function openKbCal(){
 kbListen={lo:null,hi:null};
 renderKbCal();
 openOverlay('kb-overlay');
 if(midiState!=='on'&&midiState!=='asking')toggleMidi();
}
function closeKbCal(){kbListen=null;closeOverlay('kb-overlay')}
function kbCalNote(note){
 if(!kbListen)return;
 if(kbListen.lo==null||note<kbListen.lo)kbListen.lo=note;
 if(kbListen.hi==null||note>kbListen.hi)kbListen.hi=note;
 renderKbCal();
}
/* Botão de oitava do controlador: a nota caiu fora da janela, mas perto.
   Abaixo de uma oitava, alarga a borda. A partir de uma oitava, desloca a janela inteira. */
function kbHear(note){
 if(!kbIsMini()||kbListen||!state.kb||!state.kb.calibrated)return;
 let {lo,hi}=state.kb;
 if(note>=lo&&note<=hi)return;
 const dist=note>hi?note-hi:lo-note;
 if(dist>24)return;
 if(dist<12){if(note>hi)hi=note;else lo=note}
 else{const oct=Math.round(dist/12)*12;if(note>hi){lo+=oct;hi+=oct}else{lo-=oct;hi-=oct}}
 if(hi-lo<12||hi-lo>36||lo<0||hi>127||(lo===state.kb.lo&&hi===state.kb.hi))return;
 state.kb.lo=lo;state.kb.hi=hi;state.kb.calibrated=true;
 saveState();syncKbUi();
 if(session)renderSession();
}
function renderKbCal(){
 const box=document.getElementById('kb-cal-body');if(!box)return;
 const ouviu=kbListen&&kbListen.lo!=null;
 const span=ouviu?kbListen.hi-kbListen.lo:0;
 const ok=ouviu&&span>=12&&span<=36;
 const atual=normKb(state.kb);
 const ouvido=ouviu?`${noteName(kbListen.lo,true)}–${noteName(kbListen.hi,true)} · ${span} semitons`:'ainda sem nota';
 box.innerHTML=`<p class="muted">Toque a tecla mais grave e a mais aguda. O app guarda essa janela e encaixa o voicing dentro dela.</p>
  <p style="margin-top:14px"><b>${esc(ouvido)}</b></p>
  <p class="tiny" style="margin-top:6px">${ok?'Janela válida.':'Precisa de pelo menos 12 semitons e no máximo 36.'} Padrão sem calibrar: ${noteName(atual.lo,true)}–${noteName(atual.hi,true)}${atual.calibrated?' · calibrado':''}.</p>
  <p class="tiny" style="margin-top:6px">${midiState==='on'?'MIDI ligado. Toque as duas pontas.':esc(midiLabel()||'Ligue o MIDI para ouvir o teclado.')}</p>
  <div class="setup-foot">
   <button class="btn" type="button" onclick="kbCalPadrao()">Usar C3–C5</button>
   <button class="btn primary" type="button" onclick="confirmKbCal()" ${ok?'':'disabled'}>Guardar</button>
  </div>`;
}
function confirmKbCal(){
 if(!kbListen||kbListen.lo==null)return;
 const span=kbListen.hi-kbListen.lo;
 if(span<12||span>36)return;
 state.kb=normKb({profile:'mini',lo:kbListen.lo,hi:kbListen.hi,calibrated:true});
 kbListen=null;saveState();closeOverlay('kb-overlay');syncKbUi();
 if(session)renderSession();renderDashboard();
}
function kbCalPadrao(){
 state.kb=normKb({profile:'mini',lo:48,hi:72,calibrated:true});
 kbListen=null;saveState();closeOverlay('kb-overlay');syncKbUi();
 if(session)renderSession();renderDashboard();
}

/* o arquivo do lembrete já nasce em dia ao abrir os estudos */
publicarStatus();
