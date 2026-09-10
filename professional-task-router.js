(function(){
  const $=id=>document.getElementById(id);
  const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const TASK_ROUTES=[
    [['filtre de la fournaise','remplacer le filtre de la fournaise','faire verifier la fournaise','entretien fournaise','reparation fournaise'],'hvac','hvac','fournaise'],
    [['echangeur d air','conduit de ventilation','conduits de ventilation'],'hvac','ventilation_cleaning','ventilation / échangeur d’air'],
    [['chauffe-eau','chauffe eau','pompe de puisard','plomberie','fuite d eau','fuite eau','robinet','toilette','lavabo','drain','egout','debouchage'],'plumbing','plumbing','plomberie'],
    [['ramonage','cheminee'],'chimney','chimney','cheminée / ramonage'],
    [['fosse septique','installation septique','champ d epuration'],'septic','septic','service septique'],
    [['electricite','electrique','prise','panneau electrique','detecteur de fumee','monoxyde de carbone'],'electrical','electrical','électricité'],
    [['nettoyer la piscine','filtration piscine','eau de la piscine'],'pool_spa','','entretien de piscine'],
    [['eau du spa','filtre du spa','entretien spa'],'pool_spa','','entretien de spa'],
    [['gouttiere','toiture','toit','bardeau'],'roofing','','toiture / gouttières'],
    [['porte de garage'],'garage_door','','porte de garage'],
    [['deneigement'],'snow_removal','','déneigement'],
    [['tonte de pelouse','pelouse','gazon','arbre','elagage','abattage'],'landscaping','','aménagement paysager']
  ];
  const LEISURE={
    snowmobile:['snowmobile','motoneige'],snowmobile_preseason:['snowmobile','motoneige'],snowmobile_storage:['snowmobile','motoneige'],snowmobile_track:['snowmobile','motoneige'],
    atv:['atv','VTT'],atv_service:['atv','VTT'],side_by_side:['side_by_side','côte-à-côte'],sxs_service:['side_by_side','côte-à-côte'],
    boat:['boat','bateau'],boat_winterize:['boat','bateau'],boat_spring:['boat','bateau'],
    personal_watercraft:['personal_watercraft','motomarine'],pwc_winterize:['personal_watercraft','motomarine'],pwc_spring:['personal_watercraft','motomarine'],
    rv:['rv','VR'],rv_winterize:['rv','VR'],rv_spring:['rv','VR'],travel_trailer:['travel_trailer','roulotte'],trailer_winterize:['travel_trailer','roulotte'],trailer_spring:['travel_trailer','roulotte'],
    motorcycle:['motorcycle','moto'],motorcycle_storage:['motorcycle','moto'],motorcycle_spring:['motorcycle','moto'],
    utility_trailer:['utility_trailer','remorque'],utility_trailer_service:['utility_trailer','remorque'],trailer_tire_check:['utility_trailer','remorque'],trailer_bearing_check:['utility_trailer','remorque'],trailer_lights_check:['utility_trailer','remorque']
  };
  function routeFor(text){const t=norm(text);if(t.includes('thermopompe')){if(t.includes('install'))return {category:'hvac',service:'heat_pump_installation',label:'installation de thermopompe'};if(t.includes('nettoy')||t.includes('filtre'))return {category:'hvac',service:'heat_pump_cleaning',label:'nettoyage de thermopompe'};return {category:'hvac',service:'heat_pump_maintenance',label:'inspection / entretien de thermopompe'}}for(const [keys,category,service,label] of TASK_ROUTES)if(keys.some(k=>t.includes(norm(k))))return {category,service,label};return {unknown:true,label:'ce service'}}
  function leisureRoute(key){const v=LEISURE[String(key||'')];return v?{category:v[0],label:v[1]}:null}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function token(){return hpStability.token()}
  function getProps(){try{if(typeof props!=='undefined'&&Array.isArray(props))return props}catch(e){}return window.properties||window.props||[]}
  function currentProperty(){try{if(typeof ap!=='undefined'&&ap)return ap}catch(e){}const id=window.currentPropertyId||window.currentProperty?.id||window.activePropertyId||window.pid;return getProps().find(p=>p.id===id)||window.currentProperty||getProps()[0]||null}
  function getTasks(){try{if(typeof tasks!=='undefined'&&Array.isArray(tasks))return tasks}catch{}return window.tasks||[]}
  function getEquipment(){try{if(typeof eq!=='undefined'&&Array.isArray(eq))return eq}catch{}return window.equipment||[]}
  function contextFor(input){
    const supplied=typeof input==='object'&&input!==null?input:{text:String(input||'')};
    const task=supplied.task||getTasks().find(t=>supplied.taskId?t.id===supplied.taskId:norm(t.title)===norm(supplied.text))||null;
    const property=Object.hasOwn(supplied,'property')?supplied.property:task?.property_id?getProps().find(p=>p.id===task.property_id)||null:currentProperty();
    const equipment=supplied.equipment||getEquipment().find(e=>e.id===task?.equipment_id&&(!property||e.property_id===property.id))||null;
    return {text:task?.title||supplied.text||'',task:task?{...task}:null,property:property?{...property}:null,equipment:equipment?{brand:equipment.brand,model:equipment.model}:null};
  }
  function contextFromElement(element){
    const card=element?.closest?.('[data-task-id]')||element?.closest?.('.card')||element;
    return contextFor({taskId:card?.dataset?.taskId,text:card?.querySelector?.('b')?.textContent||card?.textContent||''});
  }
  function modal(){let d=$('hpProModal');if(d)return d;d=document.createElement('div');d.id='hpProModal';d.className='hidden';d.style='position:fixed;inset:0;z-index:220;background:#0009;padding:18px;overflow:auto';d.innerHTML='<div class="card" style="max-width:620px;margin:3vh auto"><div class="row"><h2>Professionnels</h2><button class="alt" id="hpTaskProClose">Fermer</button></div><div id="hpProBody"></div></div>';document.body.appendChild(d);$('hpTaskProClose').onclick=()=>d.classList.add('hidden');return d}
  async function fetchFast(url,opts,ms=6000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opts,signal:c.signal})}catch(e){if(e?.name==='AbortError')throw new Error('La recherche a pris trop de temps. Réessaie.');throw e}finally{clearTimeout(timer)}}
  let searchId=0;
  async function searchPros(input){
    const context=contextFor(input),route=routeFor(context.text),m=modal(),body=$('hpProBody'),prop=context.property,request=++searchId;
    m.classList.remove('hidden');
    if(route.unknown){body.innerHTML='<div class="notice"><b>Service non associé.</b><br>Cette tâche ne correspond pas encore à une catégorie du répertoire.</div>';return}
    if(!prop){body.innerHTML='<div class="notice">Sélectionne d’abord la propriété associée à cette tâche.</div>';return}
    body.innerHTML='<p class="muted">Recherche…</p>';
    try{
      const t=await token();if(request!==searchId)return;if(!t)throw new Error('Session expirée. Reconnecte-toi.');
      const qs=new URLSearchParams({category:route.category,city:prop.city||'',postal:prop.postal_code||'',region:prop.region||prop.administrative_region||'',v:'6'});
      if(route.service)qs.set('service',route.service);
      const r=await fetchFast('/api/professionals?'+qs,{headers:{Authorization:'Bearer '+t},cache:'no-store'});
      const data=await r.json().catch(()=>null);if(request!==searchId)return;
      if(!r.ok)throw new Error(data?.error||'Impossible de charger le répertoire.');
      const rows=data?.rows||[];
      if(rows.length)window.hpProfessionalPresentation.render(rows,{subtitle:'Résultats pour '+route.label+' à '+(prop.city||'ta région')+'.',property:prop,task:context.task,category:route.category,allowQuote:true});
      else body.innerHTML='<h3>Aucun professionnel trouvé pour '+esc(route.label)+'</h3><p class="muted">Aucune fiche admissible ne correspond à cette recherche à '+esc(prop.city||'cet emplacement')+'.</p>';
    }catch(e){if(request===searchId)body.innerHTML='<div class="notice">'+esc(e?.message||'Impossible de charger le répertoire.')+'</div>'}
  }
  async function searchLeisure(key){const route=leisureRoute(key),m=modal(),body=$('hpProBody'),prop=currentProperty(),request=++searchId;m.classList.remove('hidden');if(!route){body.innerHTML='<div class="notice"><b>Catégorie loisir non reconnue.</b></div>';return}const city=prop?.city||'',region=prop?.region||prop?.administrative_region||'';body.innerHTML='<p class="muted">Recherche…</p>';try{const qs=new URLSearchParams({category:route.category,city,region,v:'2'});const r=await fetchFast('/api/leisure-professionals?'+qs,{cache:'no-store'},5500);const data=await r.json().catch(()=>null);if(request!==searchId)return;if(!r.ok)throw new Error(data?.error||'Impossible de charger le répertoire loisirs.');const rows=data?.rows||[];if(rows.length)window.hpProfessionalPresentation.render(rows,{subtitle:'Spécialistes '+route.label+' près de '+(city||'ta région')+'.',property:prop});else body.innerHTML='<div class="notice">Aucun spécialiste '+esc(route.label)+' trouvé dans ta région.</div>';}catch(e){if(request===searchId)body.innerHTML='<div class="notice">'+esc(e?.message||'Impossible de charger le répertoire loisirs.')+'</div>'}}
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('button');if(!b)return;
    if(!(b.classList.contains('hpFindPro')||b.hasAttribute('data-hp-diy-professional')||/Trouver un professionnel/i.test(b.textContent||'')))return;
    const oc=b.getAttribute('onclick')||'',lm=oc.match(/hpFindLeisurePro\(['\"]([^'\"]+)['\"]\)/);
    e.preventDefault();e.stopImmediatePropagation();
    if(lm)return searchLeisure(lm[1]);
    if(b.closest('#hpDiyBody')){
      const context=window.hpDiyContext?.();
      if(!context){modal().classList.remove('hidden');$('hpProBody').innerHTML='<div class="notice">Rouvre le guide depuis sa tâche pour retrouver la bonne propriété.</div>';return}
      return searchPros(context);
    }
    return searchPros(contextFromElement(b));
  },true);
  window.hpProfessionalContext=contextFor;window.hpProfessionalContextFromElement=contextFromElement;
  window.hpOpenPros=searchPros;window.hpFindLeisurePro=searchLeisure;window.hpProfessionalRouteForTask=routeFor;
})();
