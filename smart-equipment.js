(function(){
  const TASK_RULES={
    thermopompe:[['Nettoyer les filtres de la thermopompe',30,0],['Vérifier l’entretien de la thermopompe',365,30]],
    fournaise:[['Vérifier ou remplacer le filtre de la fournaise',90,0],['Faire vérifier la fournaise',365,30]],
    echangeur:[['Nettoyer les filtres de l’échangeur d’air',90,0],['Nettoyer le noyau de l’échangeur d’air',180,14]],
    chauffeeau:[['Vérifier le chauffe-eau',365,30]],
    cheminee:[['Planifier le ramonage de la cheminée',365,30]],
    piscine:[['Vérifier l’eau de la piscine',7,0],['Nettoyer la piscine et vérifier la filtration',7,0],['Vérifier les produits et équipements de piscine',30,7]],
    spa:[['Vérifier l’eau du spa',7,0],['Nettoyer ou rincer les filtres du spa',30,7],['Vérifier les produits du spa',30,7]],
    fosse:[['Vérifier la date du dernier entretien de la fosse septique',365,30]],
    gouttieres:[['Inspecter et nettoyer les gouttières',180,14]],
    pompe:[['Tester la pompe de puisard',180,14]],
    garage:[['Inspecter et lubrifier la porte de garage',180,14]],
    detecteurs:[['Tester les détecteurs de fumée et CO',30,7]]
  };
  const SERVICE_RULES={
    deneigement:[['Préparer ou renouveler le service de déneigement',365,30]],
    tonte_pelouse:[['Préparer le service de tonte de pelouse',365,30]]
  };
  function isoIn(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
  function buildTasks(propertyId,equipment,services){
    const rows=[];
    for(const key of equipment){for(const [title,every,lead] of (TASK_RULES[key]||[]))rows.push({property_id:propertyId,title,category:'Entretien',due_at:isoIn(lead||Math.min(every,30)),status:'todo',created_by:user.id,notes:'Créée automatiquement par HomePilot selon les choix de la propriété. Fréquence indicative : '+every+' jours. Vérifier les recommandations du fabricant ou du professionnel.'})}
    for(const key of services){for(const [title,every,lead] of (SERVICE_RULES[key]||[]))rows.push({property_id:propertyId,title,category:'Service',due_at:isoIn(lead||30),status:'todo',created_by:user.id,notes:'Créée automatiquement par HomePilot. Échéance indicative à adapter à votre contrat et à votre région.'})}
    return rows;
  }
  function selectedValues(name){return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>x.value)}
  function ensureInfo(){const btn=document.getElementById('cp')||document.getElementById('createPropertyBtn');if(!btn||document.getElementById('autoTaskInfo'))return;const p=document.createElement('div');p.id='autoTaskInfo';p.className='notice';p.style.margin='12px 0';p.innerHTML='<b>✨ Plan automatique HomePilot</b><br>En enregistrant la propriété, les tâches correspondant aux équipements et services cochés seront ajoutées automatiquement au calendrier. Tu pourras ensuite les modifier ou en ajouter.';btn.parentNode.insertBefore(p,btn)}
  function patchCurrentCreate(){if(typeof window.createProperty!=='function'||window.__proactivePropertyOverride)return;window.__proactivePropertyOverride=true;window.createProperty=async function(){
    const hh=window.h||window.household;if(!hh)return alert('Crée d’abord ton foyer.');
    const name=(window.pname||window.pName)?.value?.trim();if(!name)return alert('Donne un nom à la propriété.');
    const equip=document.querySelector('input[name="e"]')?selectedValues('e'):selectedValues('propertyEquip');
    const services=document.querySelector('input[name="s"]')?selectedValues('s'):selectedValues('propertyService');
    const btn=window.cp||window.createPropertyBtn;if(btn){btn.disabled=true;btn.textContent='Création du plan…'}
    const type=(window.ptype||window.pType)?.value,city=(window.pcity||window.pCity)?.value?.trim()||'',postal=(window.ppostal||window.pPostal)?.value?.trim()||'',year=(window.pyear||window.pYear)?.value;
    const r=await sb.from('properties').insert({household_id:hh.id,name,property_type:type,city,postal_code:postal,construction_year:year?Number(year):null,created_by:(window.u||window.user).id}).select().single();
    if(r.error){if(btn){btn.disabled=false;btn.textContent='Créer ma propriété'}return alert(r.error.message)}
    const uid=(window.u||window.user).id;
    if(equip.length){const catalog=window.E||window.equipmentCatalog||[];const rows=equip.map(key=>{const meta=catalog.find(x=>x[0]===key);let details={};try{if(key==='piscine'&&window.poolSize)details={size:poolSize.value,treatment:poolTreat?.value||poolTreatment?.value,volume_estimated_l:window.PV?.[poolSize.value]||null,volume_actual_l:+(poolVol?.value||0)||null,volume_l:+(poolVol?.value||0)||window.PV?.[poolSize.value]||null};if(key==='spa'&&window.spaSize)details={size:spaSize.value,treatment:spaTreat?.value||spaTreatment?.value,volume_estimated_l:window.SV?.[spaSize.value]||null,volume_actual_l:+(spaVol?.value||0)||null,volume_l:+(spaVol?.value||0)||window.SV?.[spaSize.value]||null}}catch(e){}return {property_id:r.data.id,equipment_type:key,name:meta?meta[1].replace(/^[^ ]+ /,''):key,details,created_by:uid}});const er=await sb.from('equipment').insert(rows);if(er.error)alert('Propriété créée, mais erreur équipement : '+er.error.message)}
    if(services.length){const catalog=window.S||[];const sr=await sb.from('property_services').insert(services.map(key=>({property_id:r.data.id,service_type:key,name:(catalog.find(x=>x[0]===key)?.[1]||key).replace(/^[^ ]+ /,''),created_by:uid})));if(sr.error)console.warn(sr.error)}
    const auto=buildTasks(r.data.id,equip,services);if(auto.length){const tr=await sb.from('tasks').insert(auto);if(tr.error)alert('La propriété est créée, mais le plan automatique n’a pas pu être ajouté : '+tr.error.message)}
    const form=window.pf||window.propertyForm;if(form)form.classList.add('hidden');if(btn){btn.disabled=false;btn.textContent='Créer ma propriété'}
    if(typeof window.load==='function'){await load();window.ap=(window.props||[]).find(x=>x.id===r.data.id)||r.data;if(typeof window.lp==='function')await lp();if(typeof window.render==='function')render();if(typeof window.show==='function')show('home')}
    else if(typeof window.loadAll==='function'){await loadAll();window.activeProperty=(window.properties||[]).find(x=>x.id===r.data.id)||r.data;await loadPropertyData();render();show('home')}
    alert(auto.length?'Ton plan HomePilot est prêt : '+auto.length+' tâches ont été ajoutées automatiquement.':'Ta propriété est créée. Ajoute des équipements ou services pour générer automatiquement son plan d’entretien.');
  }}
  function init(){ensureInfo();patchCurrentCreate()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();setTimeout(init,300);setTimeout(init,1000);
})();