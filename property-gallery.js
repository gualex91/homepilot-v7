/* Illustrated property overview. Uses the existing authenticated detail endpoint. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id), cache=new Map(), pending=new Map();
 let owner='', epoch=0, signedOut=false, authUser=null, running=-1, again=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function state(){
  try{return {user:typeof u!=='undefined'?u:null,house:typeof h!=='undefined'?h:null,properties:typeof props!=='undefined'?props:[],active:typeof ap!=='undefined'?ap:null}}
  catch{return {properties:[]}}
 }
 function reset(){epoch++;cache.clear();for(const ctl of pending.values())ctl.abort();pending.clear();owner='';again=false;}
 function scope(){
  const s=state(),key=!signedOut&&s.user?.id&&(!authUser||authUser===s.user.id)?s.user.id+':'+(s.house?.id||'') : '';
  if(key!==owner){reset();owner=key;}
  return {...s,properties:key?s.properties:[],key};
 }
 function kind(p){
  const t=String(p.property_type||'').toLowerCase();
  if(/secondary|secondaire|chalet/.test(t))return {image:'chalet',label:'Chalet / résidence secondaire'};
  if(/rental|locati|immeuble|plex/.test(t))return {image:'triplex',label:'Immeuble locatif'};
  return {image:'house',label:!t||/primary|principale|maison/.test(t)?'Résidence principale':p.property_type};
 }
 function summary(equipment,tasks){
  const todo=tasks.filter(t=>t.status!=='done');
  const dated=todo.filter(t=>/^\d{4}-\d{2}-\d{2}/.test(t.due_at||''));
  dated.sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)));
  return {equipment:equipment.length,todo:todo.length,next:dated[0]||null,at:Date.now()};
 }
 function taskMarkup(s){
  if(!s)return '<div class="hp-property-next"><span>Suivi des entretiens</span><strong>Chargement…</strong></div>';
  if(s.error)return '<div class="hp-property-next"><span>Suivi indisponible pour le moment</span><button type="button" class="alt" data-property-action="retry">Réessayer</button></div>';
  if(!s.next)return `<div class="hp-property-next"><span>${s.todo?'À planifier':'Entretiens'}</span><strong>${s.todo?'Aucune prochaine date fixée':'Aucune tâche en attente'}</strong></div>`;
  const date=String(s.next.due_at).slice(0,10),today=new Date(),local=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const pretty=new Date(date+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'short'}),late=date<local;
  return `<div class="hp-property-next${late?' is-overdue':''}"><span>${late?'Entretien en retard':'Prochain entretien'} · <time datetime="${esc(date)}">${esc(pretty)}</time></span><strong>${esc(s.next.title||'Entretien')}</strong></div>`;
 }
 function card(p,active,index){
  const k=kind(p),s=cache.get(p.id),ready=s&&!s.error,isActive=active?.id===p.id;
  const facts=[p.construction_year?'Construit en '+p.construction_year:'',k.image==='triplex'&&p.units?p.units+' unité'+(Number(p.units)>1?'s':''):''].filter(Boolean);
  return `<article class="hp-property-card${isActive?' is-active':''}" data-property-id="${esc(p.id)}">
   <div class="hp-property-picture"><img src="/assets/properties/quebec-${k.image}.webp" alt="" width="960" height="640" loading="${index?'lazy':'eager'}" decoding="async"><span class="hp-property-illustration">Illustration</span>${isActive?'<span class="hp-property-active">✓ Bien actif</span>':''}</div>
   <div class="hp-property-content"><span class="hp-property-type">${esc(k.label)}</span><h3>${esc(p.name||'Ma propriété')}</h3><p class="hp-property-city">${esc(p.city||'Ville à préciser')}${facts.length?' <span>· '+facts.map(esc).join(' · ')+'</span>':''}</p>
   <dl class="hp-property-stats"><div><dt>Équipement${ready&&s.equipment===1?'':'s'}</dt><dd>${ready?s.equipment:'—'}</dd></div><div><dt>Tâche${ready&&s.todo===1?'':'s'} à faire</dt><dd>${ready?s.todo:'—'}</dd></div></dl>
   ${taskMarkup(s)}<div class="hp-property-actions"><button type="button" data-property-action="details" aria-label="Voir les détails de ${esc(p.name||'la propriété')}">Voir les détails <span aria-hidden="true">↗</span></button><button type="button" class="alt" data-property-action="activate" aria-label="${isActive?'Voir les tâches de':'Utiliser'} ${esc(p.name||'la propriété')}">${isActive?'Voir mes tâches':'Utiliser ce bien'}</button></div></div></article>`;
 }
 function render(){
  const list=$('pl'),screen=$('properties');if(!list||!screen)return;
  const s=scope();if(!s.key){list.innerHTML='';return;}
  const heading=screen.querySelector('h2');if(heading)heading.textContent='Mes biens';
  screen.classList.add('hp-properties');
  list.className='hp-property-gallery';
  const focused=document.activeElement,focusCard=focused?.closest?.('[data-property-id]');
  const focus=focusCard?{id:focusCard.dataset.propertyId,action:focused.dataset.propertyAction}:null;
  list.innerHTML=s.properties.length?`<p class="hp-property-count">${s.properties.length} bien${s.properties.length>1?'s':''} dans mon foyer</p><div class="hp-property-grid">${s.properties.map((p,i)=>card(p,s.active,i)).join('')}</div>`:'<div class="hp-property-empty"><img src="/assets/properties/quebec-house.webp" width="960" height="640" alt="" decoding="async"><div><span class="hp-property-type">Mes biens</span><h3>Tout commence par un premier bien</h3><p>Maison, chalet ou immeuble : retrouve ici ses équipements et ses entretiens.</p><button type="button" data-property-action="add">+ Ajouter mon premier bien</button></div></div>';
  if(focus){for(const el of list.querySelectorAll('[data-property-action]'))if(el.dataset.propertyAction===focus.action&&el.closest('[data-property-id]')?.dataset.propertyId===focus.id){el.focus({preventScroll:true});break;}}
 }
 function visible(){return $('properties')?.classList.contains('on');}
 async function refresh(force=false){
  const s=scope();render();if(!s.key||!visible())return;
  if(running===epoch){if(force)again=true;return;}
  const version=epoch,key=owner;running=version;
  const ids=s.properties.map(p=>p.id).filter(id=>!pending.has(id)&&(force||!cache.has(id)||Date.now()-cache.get(id).at>90000));
  // Two concurrent requests at most; no data is written by the overview.
  async function worker(){while(ids.length&&epoch===version&&owner===key){
   const id=ids.shift();if(pending.has(id))continue;
   const ctl=new AbortController();pending.set(id,ctl);const timer=setTimeout(()=>ctl.abort(),12000);
   try{
    const token=await hpStability.token();if(!token)throw new Error('Session expirée');
    if(epoch!==version||owner!==key)return;
    const res=await fetch('/api/property-details?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:ctl.signal});
    const data=await res.json();if(!res.ok||data.property?.id!==id||!Array.isArray(data.equipment)||!Array.isArray(data.tasks))throw new Error('Détails indisponibles');
    if(epoch===version&&scope().key===key&&pending.get(id)===ctl){cache.set(id,summary(data.equipment,data.tasks));render();}
   }catch(e){if(epoch===version&&scope().key===key&&pending.get(id)===ctl){cache.set(id,{error:true,at:Date.now()});render();}}
   finally{clearTimeout(timer);if(pending.get(id)===ctl)pending.delete(id);}
  }}
  await Promise.all([worker(),worker()]);
  if(running===version){running=-1;if(again){again=false;refresh(true);}}
 }
 function accept(p,equipment,ts){
  const s=scope();if(!s.key||!p?.id||!s.properties.some(x=>x.id===p.id))return;
  const local=s.properties.find(x=>x.id===p.id);Object.assign(local,p);
  // Cancel an older overview request so it cannot overwrite a just-edited detail.
  pending.get(p.id)?.abort();pending.delete(p.id);cache.set(p.id,summary(equipment,ts));render();
 }
 document.addEventListener('click',async e=>{
  const b=e.target?.closest?.('#pl [data-property-action]');if(!b)return;
  const action=b.dataset.propertyAction,id=b.closest('[data-property-id]')?.dataset.propertyId;
  e.preventDefault();
  if(action==='add'){$('pf')?.classList.remove('hidden');$('pname')?.focus();return;}
  if(action==='retry'){cache.delete(id);refresh(true);return;}
  if(!scope().properties.some(p=>p.id===id))return;
  if(action==='details'){window.hpOpenProperty?.(id);return;}
  if(action==='activate'){
   b.disabled=true;try{await activate(id);}catch{b.textContent='Réessayer';}finally{b.disabled=false;}
  }
 });
 window.addEventListener('hp-tasks-rendered',()=>{
  const s=scope();if(window.hpCoreDataReady&&s.active&&typeof eq!=='undefined'&&typeof tasks!=='undefined')accept(s.active,eq,tasks);
  render();if(visible())refresh();
 });
 document.addEventListener('hp-screen-changed',e=>{if(e.detail?.id==='properties')refresh();});
 window.hpPropertyGallery={accept,refresh};
 window.supabaseClient?.auth?.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||(!session&&event==='INITIAL_SESSION')){signedOut=true;authUser=null;reset();render();}
  else if(session?.user?.id){if(authUser&&authUser!==session.user.id)reset();authUser=session.user.id;signedOut=false;}
 });
 render();if(visible())refresh();
})();
