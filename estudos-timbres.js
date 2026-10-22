/* Timbres, ferramentas e escuta. O catálogo vem de PLAN.soundLab.
   O app orienta a prática no host; não inspeciona licenças nem controla AUs.
   Conclusões, anotações e disponibilidade usam datas para mesclar backups
   sem ressuscitar uma aula desmarcada. Não alteram a medição harmônica. */
let toneTab='lesson',toneResourceQuery='';
function toneCatalog(){return PLAN&&PLAN.soundLab||{resources:[],references:[],modules:[],lessons:[],sources:[]}}
function toneDate(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null}
function normToneStudy(raw){
 const c=toneCatalog(),r=raw&&typeof raw==='object'?raw:{},records={},availability={};
 c.lessons.forEach(l=>{
  const v=r.records&&r.records[l.id],at=v&&toneDate(v.at);if(!at)return;
  const checks=[0,1,2].map(i=>!!(v.checks&&v.checks[i]));
  records[l.id]={checks,done:!!v.done&&checks.every(Boolean),note:typeof v.note==='string'?v.note.slice(0,2000):'',patch:typeof v.patch==='string'?v.patch.slice(0,160):'',at};
 });
 c.resources.forEach(x=>{
  const v=r.availability&&r.availability[x.id],at=v&&toneDate(v.at);
  if(at&&['available','unavailable','default'].includes(v.value))availability[x.id]={value:v.value,at};
 });
 const genre=r.genre==='all'||(PLAN.languages||[]).some(x=>x.id===r.genre)?r.genre:'all';
 const candidates=c.lessons.filter(l=>genre==='all'||l.genres.includes(genre));
 const selected=candidates.find(l=>l.id===r.lesson&&l.module===r.module)||candidates.find(l=>l.module===r.module)||candidates[0];
 return{module:selected?selected.module:'',lesson:selected?selected.id:'',genre,records,availability,tab:['roadmap','lesson','setup','references','guides'].includes(r.tab)?r.tab:'roadmap'};
}
function toneState(){return state.toneStudy=normToneStudy(state.toneStudy)}
function mergeToneStudy(a,b){
 const left=normToneStudy(a),right=normToneStudy(b),records={...left.records},availability={...left.availability};
 Object.entries(right.records).forEach(([id,v])=>{
  const old=records[id];
  if(!old||v.at>old.at||(v.at===old.at&&!v.done))records[id]=v;
 });
 Object.entries(right.availability).forEach(([id,v])=>{
  const old=availability[id];
  if(!old||v.at>old.at||(v.at===old.at&&v.value==='unavailable'))availability[id]=v;
 });
 return{...left,records,availability};
}
function toneRecord(id){return toneState().records[id]||{done:false,checks:[false,false,false],note:'',patch:''}}
function toneAvailable(id){
 const r=toneState().availability[id],x=toneCatalog().resources.find(x=>x.id===id);
 return r&&r.value!=='default'?r.value==='available':!!x&&x.status!=='pending';
}
function toneLessons(module){const r=toneState();return toneCatalog().lessons.filter(l=>(!module||l.module===module)&&(r.genre==='all'||l.genres.includes(r.genre)))}
function toneLesson(id){return toneCatalog().lessons.find(l=>l.id===(id||toneState().lesson))}
function toneUsable(l){return l.resources.some(toneAvailable)}
function toneNext(){
 const r=toneState(),lessons=toneLessons();
 return lessons.find(l=>l.module===r.module&&!toneRecord(l.id).done&&toneUsable(l))||lessons.find(l=>!toneRecord(l.id).done&&toneUsable(l))||toneLesson();
}
function chooseToneModule(id){
 const l=toneLessons(id).find(x=>!toneRecord(x.id).done)||toneLessons(id)[0];if(!l)return;
 const r=toneState();r.module=id;r.lesson=l.id;saveState();renderToneStudy();renderTodayTone();
}
function chooseToneLesson(id){
 const l=toneLesson(id);if(!l)return;
 const r=toneState();if(r.genre!=='all'&&!l.genres.includes(r.genre))r.genre='all';
 r.module=l.module;r.lesson=l.id;r.tab='lesson';toneTab='lesson';saveState();renderToneStudy();renderTodayTone();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'auto'});
}
function chooseToneGenre(genre){
 if(genre!=='all'&&!(PLAN.languages||[]).some(x=>x.id===genre))return;
 const r=toneState();r.genre=genre;state.toneStudy=normToneStudy(r);saveState();renderToneStudy();renderTodayTone();
}
function chooseToneTab(tab){if(!['roadmap','lesson','setup','references','guides'].includes(tab))return;const r=toneState();r.tab=tab;toneTab=tab;saveState();renderToneStudy();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'auto'})}
function updateToneRecord(id,change){
 if(!toneLesson(id))return;
 const r=toneState(),old=toneRecord(id),next={...old,...change,at:new Date().toISOString()};
 if(!next.checks.every(Boolean))next.done=false;
 r.records[id]=next;state.toneStudy=r;saveState();renderTodayTone();
}
function checkToneStep(id,index,value){
 if(!Number.isInteger(index)||index<0||index>2)return;
 const checks=toneRecord(id).checks.slice();checks[index]=!!value;updateToneRecord(id,{checks});renderToneStudy();
 const el=document.getElementById(`tone-check-${index}`);if(el)el.focus();
}
function saveToneWriting(id,field,value){
 if(!['note','patch'].includes(field))return;
 updateToneRecord(id,{[field]:String(value).slice(0,field==='note'?2000:160)});
 const el=document.getElementById('tone-saved');if(el)el.textContent='Registro salvo neste aparelho.';
}
function saveToneDraft(id){
 const patch=document.getElementById('tone-patch'),note=document.getElementById('tone-note');
 if(!patch||!note)return;
 updateToneRecord(id,{patch:patch.value.slice(0,160),note:note.value.slice(0,2000)});
 const saved=document.getElementById('tone-saved');if(saved)saved.textContent='Registro salvo neste aparelho.';
}
function toggleToneDone(id){
 const old=toneRecord(id);if(!old.done&&!old.checks.every(Boolean))return;
 updateToneRecord(id,{done:!old.done});renderToneStudy();
}
function setToneAvailability(id,value){
 if(!toneCatalog().resources.some(x=>x.id===id)||!['default','available','unavailable'].includes(value))return;
 const r=toneState();r.availability[id]={value,at:new Date().toISOString()};saveState();renderToneStudy();renderTodayTone();
}
function openToneStudy(id){if(id)chooseToneLesson(id);showView('timbres')}
function openToneBridge(id){const l=toneLesson(id);if(!l)return;selectLanguageTrack(l.bridge.genre);openLanguagePlan()}
function startToneBase(id){
 const l=toneLesson(id),e=l&&exercises.find(e=>e.id===l.exercise);if(!e)return;
 const previous=planMode;
 try{planMode='';sessaoCom({density:3},null,()=>beginSession(e.ids,`${l.title} · base harmônica`,l.listen,true,null,e.id))}
 finally{planMode=previous}
 if(session){session.languagePractice=`${l.title}: ${l.listen}`;renderSession()}
}
function findToneSong(id){
 const ref=toneCatalog().references.find(r=>r.id===id);if(!ref)return;
 songQuery=ref.title.replace(/’/g,"'");songFilter='all';
 document.getElementById('song-search').value=songQuery;
 document.getElementById('rep-filter').value='all';showView('songs');
 if(songsState==='ready')renderSongs();
}
function toneResourceLink(x){return`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Guia / fabricante ↗</a>`}
function toneRefHtml(ref){
 return`<article class="tone-ref"><div class="eyebrow">${esc(ref.artist)}</div><h3>${esc(ref.title)}</h3><p><b>Escute:</b> ${esc(ref.focus)}</p><p><b>Sugestão de timbre:</b> ${esc(ref.tone)}</p><p><b>Experimente:</b> ${esc(ref.task)}</p><div class="tone-actions"><a class="btn" href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>${ref.kind==='artist'?'':`<button type="button" class="btn ghost" onclick="findToneSong('${ref.id}')">Buscar no meu repertório</button>`}</div><small>${esc(ref.source)} · link externo</small></article>`;
}
function renderToneSetup(){
 const c=toneCatalog(),r=toneState(),query=toneResourceQuery.toLocaleLowerCase('pt-BR');
 const list=c.resources.filter(x=>(x.name+' '+x.family+' '+x.learn).toLocaleLowerCase('pt-BR').includes(query));
 return`<div class="tone-setup-head"><h2>Meu setup</h2><label class="tone-search">Buscar ferramenta ou função<input type="search" value="${esc(toneResourceQuery)}" placeholder="Holy Keys, piano, órgão…" oninput="filterToneResources(this.value)"></label></div><p class="tone-note">${esc(c.inventoryNote)}</p><div class="tone-resource-grid">${list.map(x=>{
  const availability=r.availability[x.id],value=availability?availability.value:'default',label=x.status==='native'?'Incluído no MainStage':x.status==='pending'?'Instalação a confirmar':'Arquivos encontrados';
  return`<article class="tone-resource"><div class="tone-resource-top"><span class="tag">${esc(x.family)}</span><small>${esc(label)}</small></div><h3>${esc(x.name)}</h3><p>${esc(x.learn)}</p><p><b>Prática:</b> ${esc(x.exercise)}</p><details><summary>Onde encontrar</summary><p>${esc(x.where)}</p></details><label class="tone-availability">Disponibilidade para estudar<select aria-label="Disponibilidade de ${esc(x.name)}" onchange="setToneAvailability('${x.id}',this.value)"><option value="default"${value==='default'?' selected':''}>${esc(label)}</option><option value="available"${value==='available'?' selected':''}>Já abri e posso usar</option><option value="unavailable"${value==='unavailable'?' selected':''}>Indisponível por enquanto</option></select></label>${toneResourceLink(x)}</article>`;
 }).join('')||'<p class="empty">Nenhuma ferramenta com essa busca.</p>'}</div>`;
}
function filterToneResources(value){
 toneResourceQuery=String(value).slice(0,100);
 const input=document.querySelector('.tone-search input'),start=input&&input.selectionStart;
 renderToneStudy();const next=document.querySelector('.tone-search input');if(next){next.focus();if(start!=null)next.setSelectionRange(start,start)}
}
function renderToneLesson(){
 const c=toneCatalog(),r=toneState(),l=toneLesson(),record=l&&toneRecord(l.id);if(!l)return'<p class="empty">Nenhuma aula nesta aplicação.</p>';
 const module=c.modules.find(m=>m.id===l.module),steps=toneLessons(l.module),next=toneNext(),bridge=(PLAN.languages||[]).find(x=>x.id===l.bridge.genre);
 const resources=l.resources.map(id=>c.resources.find(x=>x.id===id)).filter(Boolean),available=resources.filter(x=>toneAvailable(x.id));
 return`<div class="tone-course"><aside class="tone-module-list" aria-label="Módulos de timbres">${c.modules.filter(m=>toneLessons(m.id).length).map(m=>{
  const ls=toneLessons(m.id),done=ls.filter(x=>toneRecord(x.id).done).length;
  return`<button type="button" class="tone-module${m.id===r.module?' active':''}" aria-pressed="${m.id===r.module}" onclick="chooseToneModule('${m.id}')"><span>${esc(m.name)}</span><small>${done}/${ls.length} aulas</small></button>`;
 }).join('')}</aside><div class="tone-lesson-column"><div class="tone-module-intro"><div class="eyebrow">${esc(module.name)}</div><p>${esc(module.goal)}</p></div><div class="tone-lesson-picker" role="group" aria-label="Aulas do módulo">${steps.map((s,i)=>`<button type="button" class="choice${s.id===l.id?' active':''}" aria-pressed="${s.id===l.id}" onclick="chooseToneLesson('${s.id}')">${toneRecord(s.id).done?'✓':i+1} · ${esc(s.level)}</button>`).join('')}</div>
 <article class="tone-lesson"><div class="eyebrow">Aula prática · cerca de ${l.minutes} min</div><h2>${esc(l.title)}</h2><p class="tone-use"><b>Escolha uma opção disponível:</b> ${esc((available.length?available:resources).map(x=>x.name).join(' · '))}</p>${!available.length?'<p class="tone-warning">As ferramentas desta aula estão por confirmar ou indisponíveis. Atualize Meu setup quando conseguir abrir uma delas, ou escolha outro módulo.</p>':''}
 <ol class="tone-practice">${l.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="tone-listen"><b>Avance quando ouvir</b><p>${esc(l.listen)}</p></div><p><b>Entrega:</b> ${esc(l.deliverable)}</p><div class="tone-actions"><button type="button" class="btn primary" onclick="startToneBase('${l.id}')">Treinar base harmônica</button><button type="button" class="btn" onclick="openToneBridge('${l.id}')">Levar para ${esc(bridge?bridge.name:l.bridge.genre)}</button></div><p class="tone-note">${esc(l.bridge.task)} A base guiada usa o material harmônico do app; não é a transcrição da música de referência.</p>
 <fieldset class="tone-checklist"><legend>Minha conferência por escuta</legend>${['Preparei e entendi o som escolhido','Fiz a comparação proposta nesta aula','Toquei a aplicação e avaliei o critério de escuta'].map((s,i)=>`<label><input id="tone-check-${i}" type="checkbox"${record.checks[i]?' checked':''} onchange="checkToneStep('${l.id}',${i},this.checked)"><span>${esc(s)}</span></label>`).join('')}</fieldset>
 <label class="tone-field">Nome do patch ou gravação<input id="tone-patch" maxlength="160" value="${esc(record.patch)}" placeholder="Ex.: Prime Piano — base soul 01" oninput="saveToneWriting('${l.id}','patch',this.value)"></label><label class="tone-field">O que ouvi e o que mudei no toque<textarea id="tone-note" maxlength="2000" rows="3" placeholder="Registre uma mudança no timbre, uma na execução e o próximo ajuste." oninput="saveToneWriting('${l.id}','note',this.value)">${esc(record.note)}</textarea></label><div class="tone-actions"><button type="button" class="btn" onclick="saveToneDraft('${l.id}')">Salvar registro</button><button type="button" class="btn${record.done?'':' primary'}"${!record.done&&!record.checks.every(Boolean)?' disabled':''} aria-pressed="${record.done}" onclick="toggleToneDone('${l.id}')">${record.done?'Desmarcar conclusão':'Concluir por escuta'}</button>${next&&next.id!==l.id?`<button type="button" class="btn" onclick="chooseToneLesson('${next.id}')">Próxima prática</button>`:''}<span class="tiny" id="tone-saved" role="status">${record.at?'Registro salvo neste aparelho.':'Salve o registro antes de sair da aula.'}</span></div><p class="tone-note">A conclusão é sua autoavaliação; não mede domínio automaticamente por MIDI. Para comparar o áudio dos plugins, grave no MainStage ou no REAPER. A entrada de gravação do app não captura o MainStage automaticamente.</p></article>
 <h3 class="tone-related-title">Escutas para esta prática</h3><p class="tone-note">${esc(c.referenceNote)}</p><div class="tone-ref-grid">${l.references.map(id=>c.references.find(x=>x.id===id)).filter(Boolean).map(toneRefHtml).join('')}</div></div></div>`;
}
function renderToneStudy(){
 const box=document.getElementById('tone-study'),c=toneCatalog();if(!box||!c.lessons.length)return;
 const r=toneState(),completed=c.lessons.filter(l=>toneRecord(l.id).done).length;toneTab=r.tab;
 box.innerHTML=`<div class="tone-head"><div><div class="eyebrow">Seu setup · timbre, toque e repertório</div><h1>Aprenda os sons que você tem.</h1><p>${esc(c.intro)}</p></div><div class="tone-progress"><b>${completed}/${c.lessons.length}</b><span>aulas concluídas por escuta</span><div class="progress"><i style="width:${Math.round(completed/c.lessons.length*100)}%"></i></div></div></div>
 <div class="tone-toolbar"><div class="choice-row" role="group" aria-label="Área de timbres">${[['roadmap','Minha trilha'],['lesson','Aulas práticas'],['setup','Meu setup'],['references','Músicas e referências'],['guides','Guias e pesquisa']].map(([id,label])=>`<button type="button" class="choice${toneTab===id?' active':''}" aria-pressed="${toneTab===id}" onclick="chooseToneTab('${id}')">${label}</button>`).join('')}</div><label class="tone-genre"${['lesson','references'].includes(toneTab)?'':' hidden'}>Aplicação<select aria-label="Gênero da aplicação" onchange="chooseToneGenre(this.value)"><option value="all">Todos os gêneros</option>${(PLAN.languages||[]).map(g=>`<option value="${g.id}"${r.genre===g.id?' selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div>
 ${toneTab==='roadmap'?renderToneRoadmap():toneTab==='guides'?renderToneGuides():toneTab==='setup'?renderToneSetup():toneTab==='references'?`<p class="tone-note">${esc(c.referenceNote)} Os links abrem fora do app; as aulas e seus registros continuam disponíveis offline.</p><div class="tone-ref-grid">${c.references.filter(x=>r.genre==='all'||x.genres.includes(r.genre)).map(toneRefHtml).join('')}</div>`:renderToneLesson()}
 <details class="tone-sources"><summary>Como usar este módulo e consultar os guias</summary><p>Pratique uma mudança por vez, compare volumes percebidos e guarde uma versão que você consiga reabrir. Use 10–15 minutos dentro do bloco de repertório ou improviso.</p><p>${esc(c.inventoryNote)}</p><p>As referências pessoais incluem Eli Soares, Morada, Oficina G3, Filipe Martins e Rapha DanTop, suas referências de teclado. As propostas não afirmam que esses artistas usam os plugins listados.</p><ul>${c.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a></li>`).join('')}</ul><p>Seu progresso, disponibilidade e anotações entram no mesmo backup dos estudos.</p></details>`;
}
function renderTodayTone(){
 const box=document.getElementById('tone-today'),c=toneCatalog();if(!box||!c.lessons.length)return;
 const l=toneNext();if(!l){box.innerHTML='';return}
 const m=c.modules.find(m=>m.id===l.module);
 box.innerHTML=`<div><div class="eyebrow">Prática de timbre · ${esc(m.name)}</div><h3>${esc(l.title)}</h3><p>${esc(l.listen)}</p><small>Cerca de ${l.minutes} min dentro de repertório ou improviso · sem acrescentar um bloco obrigatório</small></div><button type="button" class="btn" onclick="openToneStudy('${l.id}')">Abrir prática</button>`;
}
/* Guias locais e pesquisa histórica: nenhum conteúdo remoto é executado. */
let toneGuideQuery='',toneGuideCategory='all';
function tonePlain(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')}
function toneInline(text){
 return String(text).split(/(\[[^\]]+\]\(https:\/\/[^\s)]+\))/g).map(part=>{
  const link=part.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
  if(link)return`<a href="${esc(link[2])}" target="_blank" rel="noopener noreferrer">${esc(link[1])} ↗</a>`;
  return esc(part).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
 }).join('');
}
function toneGuideBody(text){
 const lines=String(text).split('\n');let html='',list='',table=false,code=false,buffer=[];
 const closeList=()=>{if(list){html+=`</${list}>`;list=''}};
 const closeTable=()=>{if(table){html+='</tbody></table></div>';table=false}};
 for(const line of lines){
  if(line.startsWith('```')){closeList();closeTable();if(code){html+=`<pre>${esc(buffer.join('\n'))}</pre>`;buffer=[]}code=!code;continue}
  if(code){buffer.push(line);continue}
  if(line.trim().startsWith('|')){
   closeList();const cells=line.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
   if(cells.every(x=>/^:?-+:?$/.test(x)))continue;
   if(!table){html+='<div class="tone-table-wrap"><table><tbody>';table=true}
   html+=`<tr>${cells.map(x=>`<td>${toneInline(x)}</td>`).join('')}</tr>`;continue;
  }
  closeTable();const item=line.match(/^\s*(?:(\d+)\.\s+|[-•]\s+)(.*)$/);
  if(item){const tag=item[1]?'ol':'ul';if(list!==tag){closeList();html+=`<${tag}>`;list=tag}html+=`<li>${toneInline(item[2])}</li>`;continue}
  closeList();if(!line.trim())continue;
  const heading=line.match(/^#{1,4}\s+(.+)/);html+=heading?`<h4>${toneInline(heading[1])}</h4>`:`<p>${toneInline(line)}</p>`;
 }
 closeList();closeTable();if(code&&buffer.length)html+=`<pre>${esc(buffer.join('\n'))}</pre>`;return html;
}
function renderToneRoadmap(){
 const c=toneCatalog(),next=toneNext(),r=toneState();
 return`<section class="tone-roadmap"><div class="tone-lesson"><div class="eyebrow">Da preparação à execução</div><h2>Sua trilha completa</h2><p>Avance pelo resultado que consegue ouvir e repetir. Você pode voltar a qualquer aula e escolher outra ferramenta disponível. As etapas abaixo mostram todas as aulas; o filtro de gênero continua nas práticas e nas referências.</p><div class="tone-actions">${next?`<button class="btn primary" onclick="chooseToneLesson('${next.id}')">Retomar: ${esc(next.title)}</button>`:''}<button class="btn" onclick="chooseToneTab('guides')">Consultar guias e pesquisa</button><button class="btn" onclick="chooseToneTab('setup')">Conferir meu setup</button></div><p class="tone-note">Use o bloco de repertório ou improviso da sua rotina. Uma aula marcada registra sua autoavaliação; retorne para aprofundar e comparar uma nova gravação.</p></div>
 ${(c.roadmap||[]).map(stage=>{
  const lessons=c.lessons.filter(l=>stage.modules.includes(l.module)),done=lessons.filter(l=>toneRecord(l.id).done).length;
  return`<section class="tone-stage"><div class="tone-stage-head"><div><h3>${esc(stage.title)}</h3><p>${esc(stage.goal)}</p></div><span class="tag">${done}/${lessons.length}</span></div><div class="tone-roadmap-modules">${stage.modules.map(id=>{
   const m=c.modules.find(m=>m.id===id);return`<article><h4>${esc(m.name)}</h4>${c.lessons.filter(l=>l.module===id).map(l=>`<button type="button" class="tone-roadmap-lesson${r.lesson===l.id?' current':''}" onclick="chooseToneLesson('${l.id}')"><span>${toneRecord(l.id).done?'✓':'○'} ${esc(l.title)}</span><small>${l.minutes} min${toneUsable(l)?'':' · conferir ferramenta'}</small></button>`).join('')}</article>`;
  }).join('')}</div></section>`;
 }).join('')}<div class="tone-lesson"><h3>Segundo ciclo: aprofundar e transferir</h3><p>Escolha três presets por módulo, recrie uma intenção ouvida em uma referência, salve três variações, mapeie controles úteis e toque uma música inteira. Reutilize as anotações da aula para comparar suas decisões.</p><button class="btn" onclick="chooseToneTab('references')">Escolher música ou tecladista de referência</button></div></section>`;
}
function filterToneGuides(value){
 toneGuideQuery=String(value).slice(0,100);
 const input=document.getElementById('tone-guide-search'),start=input&&input.selectionStart;
 renderToneStudy();const next=document.getElementById('tone-guide-search');if(next){next.focus();if(start!=null)next.setSelectionRange(start,start)}
}
function chooseToneGuideCategory(value){
 if(value!=='all'&&value!=='research'&&!(toneCatalog().guides||[]).some(g=>g.category===value))return;
 toneGuideCategory=value;renderToneStudy();
}
function renderToneGuides(){
 const c=toneCatalog(),query=tonePlain(toneGuideQuery),categories=[...new Set((c.guides||[]).map(g=>g.category))];
 const guides=(c.guides||[]).filter(g=>(toneGuideCategory==='all'||toneGuideCategory===g.category)&&tonePlain(g.title+' '+g.body).includes(query));
 const projects=toneGuideCategory==='all'||toneGuideCategory==='research'?(c.research?.projetos||[]).filter(p=>tonePlain(p.nome+' '+p.prioridade+' '+p.details).includes(query)):[];
 const labels={A:'A · Binários e opções para avaliar',B:'B · Pesquisar e experimentar',C:'C · Compilar, adaptar ou legado',D:'D · Desenvolvimento'};
 return`<div class="tone-guide-library"><div class="tone-setup-head"><div><h2>Guias e pesquisa</h2><p class="tone-note">Material completo dentro do app, com busca por ferramenta, controle ou dúvida.</p></div><label class="tone-search">Buscar nos guias e projetos<input id="tone-guide-search" type="search" maxlength="100" value="${esc(toneGuideQuery)}" placeholder="pedal, KeyLab, SFZ, CPU…" oninput="filterToneGuides(this.value)"></label></div>
 <label class="tone-genre">Assunto<select aria-label="Assunto dos guias" onchange="chooseToneGuideCategory(this.value)">${[['all','Todos os assuntos'],...categories.map(x=>[x,x]),['research','Catálogo de 34 projetos']].map(([id,label])=>`<option value="${esc(id)}"${toneGuideCategory===id?' selected':''}>${esc(label)}</option>`).join('')}</select></label>
 <p class="tone-note">Pesquisa documental de 22/10/2026. As prioridades e versões do relatório retratam aquela consulta; alguns plugins foram instalados depois. Consulte Meu setup para a disponibilidade atual de estudo. CPU e RAM não foram medidas em áudio. Abra as fontes para verificar novas versões antes de baixar.</p><p class="tiny" role="status">${guides.length} guias · ${projects.length} projetos nesta busca</p>
 <div class="tone-guide-results">${guides.map(g=>`<details class="tone-guide"${query?' open':''}><summary><span>${esc(g.category)}</span><b>${esc(g.title)}</b></summary><div class="tone-guide-body">${toneGuideBody(g.body)}</div></details>`).join('')}
 ${projects.map(p=>`<details class="tone-guide"${query?' open':''}><summary><span>${esc(labels[p.grupo]||p.grupo)} · pesquisa de 22/10/2026</span><b>${esc(p.nome)}</b><small>${esc(p.prioridade)}</small></summary><div class="tone-guide-body">${toneGuideBody(p.details)}<p><a href="${esc(p.github)}" target="_blank" rel="noopener noreferrer">Repositório oficial ↗</a></p></div></details>`).join('')}
 ${!guides.length&&!projects.length?'<p class="empty">Nenhum resultado. Tente outra palavra ou selecione todos os assuntos.</p>':''}</div></div>`;
}
