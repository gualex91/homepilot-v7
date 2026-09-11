/* Illustrated leisure cards; data and saved actions remain owned by leisure-tasks.js. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const TYPES={snowmobile:['Motoneige','snowmobile'],atv:['VTT','atv'],side_by_side:['Côte-à-côte','side-by-side'],boat:['Bateau','boat'],personal_watercraft:['Motomarine','personal-watercraft'],rv:['VR / motorisé','rv'],travel_trailer:['Roulotte','travel-trailer'],motorcycle:['Moto','motorcycle'],utility_trailer:['Remorque','utility-trailer']};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let equipment=[],tasks=[],owner='',message='';
 const pending=new Set();
 function day(v){return /^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):''}
 function date(v){const d=day(v);return d?new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}):'Sans date'}
 function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 function taskOrder(a,b){return Number(a.status==='done')-Number(b.status==='done')||String(day(a.due_date)||'9999').localeCompare(day(b.due_date)||'9999')}
 function taskCard(t,x){
  const done=t.status==='done',late=!done&&day(t.due_date)&&day(t.due_date)<today();
  return `<div class="hp-leisure-task${done?' is-done':''}" data-leisure-task="${esc(t.id)}"><div class="hp-leisure-task-head"><div><strong>${esc(t.title||'Entretien')}</strong><p>${done?'✓ Terminée · ':late?'En retard · ':''}${esc(date(t.due_date))}</p></div><button type="button" class="alt" data-leisure-action="toggle" data-task-id="${esc(t.id)}" aria-label="${done?'Rouvrir':'Terminer'} : ${esc(t.title)}">${done?'Rouvrir':'Fait'}</button></div>${t.notes?`<p class="hp-leisure-task-note">${esc(t.notes)}</p>`:''}<div class="hp-leisure-task-actions">${t.diy_key?`<button type="button" class="alt" data-leisure-action="diy" data-task-id="${esc(t.id)}">Comment faire</button>`:''}<button type="button" class="alt" data-leisure-action="professional" data-task-id="${esc(t.id)}">Professionnel</button>${window.hpMaintenanceBudget?.button(t,x.name,'leisure')||''}<button type="button" class="alt hp-leisure-delete" data-leisure-action="delete-task" data-task-id="${esc(t.id)}" aria-label="Supprimer la tâche ${esc(t.title)}">Supprimer</button></div></div>`;
 }
 function picture(x,index){
  const type=Object.hasOwn(TYPES,x.equipment_type)?TYPES[x.equipment_type]:null;
  return type?`<div class="hp-leisure-picture"><img src="/assets/leisure/${type[1]}.webp" width="960" height="640" alt="" loading="${index?'lazy':'eager'}" decoding="async"><span>Illustration</span></div>`:'<div class="hp-leisure-picture hp-leisure-generic"><span aria-hidden="true">🎯</span><p>Équipement de loisir</p></div>';
 }
 function card(x,index){
  const own=tasks.filter(t=>t.leisure_equipment_id===x.id).sort(taskOrder),active=own.filter(t=>t.status!=='done'),next=active.find(t=>day(t.due_date)),done=own.length-active.length;
  const late=next&&day(next.due_date)<today(),specs=[x.brand,x.model,x.year].filter(Boolean).map(esc).join(' · ');
  return `<article class="hp-leisure-card" data-leisure-equipment="${esc(x.id)}">${picture(x,index)}<div class="hp-leisure-content"><span class="hp-leisure-type">${esc((Object.hasOwn(TYPES,x.equipment_type)?TYPES[x.equipment_type][0]:'Autre loisir'))}</span><h3>${esc(x.name||'Mon équipement')}</h3>${specs?`<p class="hp-leisure-specs">${specs}</p>`:''}<dl class="hp-leisure-stats"><div><dt>Tâche${active.length===1?'':'s'} à faire</dt><dd>${active.length}</dd></div><div><dt>Terminée${done===1?'':'s'}</dt><dd>${done}</dd></div></dl><div class="hp-leisure-next${late?' is-overdue':''}"><span>${next?(late?'Entretien en retard':'Prochain entretien')+' · '+esc(date(next.due_date)):active.length?'À planifier':'Entretiens'}</span><strong>${next?esc(next.title):active.length?'Aucune prochaine date fixée':own.length?'Aucune tâche en attente':'Ajoute ton premier entretien'}</strong></div><div class="hp-leisure-actions"><button type="button" data-leisure-action="add-task">+ Ajouter une tâche</button><button type="button" class="alt" data-leisure-action="professional">Trouver un pro</button></div><details class="hp-leisure-details" data-leisure-panel="tasks"><summary>Entretiens et rappels <span>${own.length}</span></summary>${own.length?own.map(t=>taskCard(t,x)).join(''):'<p class="hp-leisure-empty-tasks">Aucune tâche enregistrée. Ajoute une tâche pour choisir une date et suivre ton entretien.</p>'}</details><details class="hp-leisure-details" data-leisure-panel="equipment"><summary>Fiche et options</summary>${x.equipment_type==='other'?'<p class="hp-leisure-reclassify">C’est une remorque? Change son type en conservant ses tâches.</p><button type="button" class="alt" data-leisure-action="classify-trailer">Classer comme remorque</button>':''}<dl class="hp-leisure-facts">${[['Marque',x.brand],['Modèle',x.model],['Année',x.year],['Immatriculation',x.registration]].filter(([,v])=>v).map(([label,v])=>`<div><dt>${label}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${x.notes?`<h4>Notes</h4><p class="hp-leisure-notes">${esc(x.notes)}</p>`:''}<button type="button" class="alt hp-leisure-delete" data-leisure-action="delete-equipment">Supprimer cet équipement</button></details>${window.HomePilotVrShop?.renderForEquipment(x.equipment_type)||''}</div></article>`;
 }
 function status(){const node=$('hpLeisureGalleryStatus');if(node){node.textContent=message;node.hidden=!message;}}
 function paint(){
  const list=$('hpLeisureList'),screen=$('leisure');if(!list)return;
  screen?.classList.add('hp-leisure-screen');
  const title=screen?.querySelector('h2');if(title)title.textContent='Mes loisirs';
  const open=new Set([...list.querySelectorAll('details[open][data-leisure-panel]')].map(d=>d.closest('[data-leisure-equipment]')?.dataset.leisureEquipment+':'+d.dataset.leisurePanel));
  const focused=document.activeElement,focusCard=focused?.closest?.('[data-leisure-equipment]');
  const focus=focusCard?{id:focusCard.dataset.leisureEquipment,task:focused.dataset.taskId,action:focused.dataset.leisureAction,panel:focused.closest('details')?.dataset.leisurePanel,summary:focused.tagName==='SUMMARY'}:null;
  list.className='hp-leisure-gallery';
  list.innerHTML='<p id="hpLeisureGalleryStatus" class="hp-leisure-load-status" role="status" aria-live="polite" hidden></p>'+(!owner?'':equipment.length?`<p class="hp-leisure-count">${equipment.length} équipement${equipment.length>1?'s':''} de loisir</p><div class="hp-leisure-grid">${equipment.map(card).join('')}</div>`:'<div class="hp-leisure-empty"><div class="hp-leisure-empty-images"><img src="/assets/leisure/boat.webp" width="960" height="640" alt="" decoding="async"><img src="/assets/leisure/snowmobile.webp" width="960" height="640" alt="" decoding="async"><img src="/assets/leisure/travel-trailer.webp" width="960" height="640" alt="" decoding="async"></div><div><h3>Prêt pour la prochaine sortie?</h3><p>Ajoute ton bateau, ta motoneige, ton VR ou un autre équipement pour préparer ses entretiens.</p><button type="button" data-leisure-action="add-equipment">+ Ajouter mon premier loisir</button></div></div>');
  for(const d of list.querySelectorAll('[data-leisure-panel]'))if(open.has(d.closest('[data-leisure-equipment]')?.dataset.leisureEquipment+':'+d.dataset.leisurePanel))d.open=true;
  if(focus){for(const el of list.querySelectorAll('[data-leisure-action],summary'))if(el.closest('[data-leisure-equipment]')?.dataset.leisureEquipment===focus.id&&((focus.action&&el.dataset.leisureAction===focus.action&&el.dataset.taskId===focus.task)||(focus.summary&&el.tagName==='SUMMARY'&&el.closest('details')?.dataset.leisurePanel===focus.panel))){el.focus({preventScroll:true});break;}}
  status();
 }
 function clear(){equipment=[];tasks=[];owner='';message='';pending.clear();paint();}
 function loading(userId){if(owner!==userId){clear();owner=userId||'';}message='Chargement des loisirs…';if(!$('hpLeisureGalleryStatus'))paint();status();}
 function render(rows,ts,userId){if(owner!==userId){clear();owner=userId||'';}equipment=rows;tasks=ts;message='';paint();}
 function error(userId){if(owner!==userId){clear();owner=userId||'';}message='Impossible de charger les loisirs. Réessaie dans un instant.';if(!$('hpLeisureGalleryStatus'))paint();status();const list=$('hpLeisureList');if(list&&!$('hpLeisureRetry'))list.insertAdjacentHTML('afterbegin','<button id="hpLeisureRetry" type="button" class="alt" data-leisure-action="retry">Réessayer</button>');}
 document.addEventListener('click',async e=>{
  const b=e.target?.closest?.('[data-leisure-action]');if(!b||!b.closest('#hpLeisureList'))return;
  const action=b.dataset.leisureAction,id=b.closest('[data-leisure-equipment]')?.dataset.leisureEquipment;
  e.preventDefault();
  if(action==='retry'){window.hpLoadLeisure?.();return;}
  if(action==='add-equipment'){$('hpLeisureForm')?.classList.remove('hidden');$('hpLeisureName')?.focus();return;}
  const x=equipment.find(x=>x.id===id);if(!x||!owner)return;
  const t=tasks.find(t=>t.id===b.dataset.taskId&&t.leisure_equipment_id===id);
  if(b.dataset.taskId&&!t)return;
  const key=id+':'+(t?.id||'')+':'+action;if(pending.has(key))return;
  pending.add(key);b.disabled=true;
  try{
   if(action==='classify-trailer'&&x.equipment_type==='other'){const currentOwner=owner;const result=await window.hpClassifyLeisureTrailer(x.id,currentOwner);if(owner===currentOwner&&equipment.includes(x)){x.equipment_type=result.equipment_type;message='Équipement classé comme remorque. Ses tâches sont conservées.';paint();}}
   else if(action==='add-task')window.hpAddLeisureTask?.(x.id,x.equipment_type,x.name);
   else if(action==='professional')await window.hpFindLeisurePro?.(t?.diy_key||x.equipment_type);
   else if(action==='diy'&&t?.diy_key)window.hpShowLeisureDiy?.(t.diy_key);
   else if(action==='toggle'&&t)await window.hpToggleLeisureTask?.(t.id,t.status);
   else if(action==='delete-task'&&t)await window.hpDeleteLeisureTask?.(t.id);
   else if(action==='delete-equipment')await window.hpDeleteLeisure?.(x.id);
  }catch{message='Cette action n’a pas pu être terminée. Réessaie.';status();}
  finally{pending.delete(key);b.disabled=false;}
 });
 window.hpLeisureGallery={render,loading,error,clear};
})();
