(function(){
 const c=()=>window.supabaseClient||window.sb||window.client||null;
 const TYPES={snowmobile:'Motoneige',atv:'VTT',side_by_side:'Côte-à-côte',boat:'Bateau',personal_watercraft:'Motomarine',rv:'VR',travel_trailer:'Roulotte',motorcycle:'Moto',utility_trailer:'Remorque'};
 const RULES={
  snowmobile:[['Préparation avant saison',11,'snowmobile_preseason'],['Remisage de fin de saison',4,'snowmobile_storage'],['Vérifier la batterie',11,'battery_check'],['Inspecter chenille et glissières',11,'snowmobile_track']],
  atv:[['Entretien saisonnier',5,'atv_service'],['Vérifier pneus et pression',5,'tire_check'],['Vérifier la batterie',4,'battery_check']],
  side_by_side:[['Entretien saisonnier',5,'sxs_service'],['Vérifier pneus et pression',5,'tire_check'],['Vérifier la batterie',4,'battery_check']],
  boat:[['Mise à l’eau et préparation',5,'boat_spring'],['Mise en hiver du bateau',10,'boat_winterize'],['Inspection batterie',5,'battery_check'],['Inspection remorque et pneus',5,'tire_check']],
  personal_watercraft:[['Préparation de début de saison',5,'pwc_spring'],['Mise en hiver de la motomarine',10,'pwc_winterize'],['Inspection batterie',5,'battery_check']],
  rv:[['Déshivernisation du VR',5,'rv_spring'],['Hivernisation du VR',10,'rv_winterize'],['Inspection pneus',5,'tire_check'],['Inspection batterie',5,'battery_check']],
  travel_trailer:[['Préparation de la roulotte',5,'trailer_spring'],['Hivernisation de la roulotte',10,'trailer_winterize'],['Inspection pneus',5,'tire_check'],['Inspection batterie',5,'battery_check']],
  motorcycle:[['Inspection de début de saison',5,'motorcycle_spring'],['Remisage hivernal de la moto',10,'motorcycle_storage'],['Inspection pneus',5,'tire_check'],['Inspection batterie',5,'battery_check']],
  utility_trailer:[['Inspection annuelle de la remorque',5,'utility_trailer_service'],['Vérifier pneus et pression',5,'tire_check'],['Vérifier roulements et moyeux',5,'bearing_check'],['Vérifier feux et câblage',5,'trailer_lights']]
 };
 function dateFor(month){const now=new Date(),y=now.getFullYear();let d=new Date(y,month-1,15);if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate()-30))d=new Date(y+1,month-1,15);return d.toISOString().slice(0,10)}
 async function user(){const cl=c();if(!cl)return null;const {data:{user}}=await cl.auth.getUser();return user||null}
 async function ensureFor(eq){const cl=c(),u=await user();if(!cl||!u)return;const rules=RULES[eq.equipment_type]||[];const {data:existing}=await cl.from('leisure_tasks').select('title').eq('user_id',u.id).eq('leisure_equipment_id',eq.id);const titles=new Set((existing||[]).map(x=>x.title));const rows=[];for(const [title,month,key] of rules){if(!titles.has(title))rows.push({user_id:u.id,leisure_equipment_id:eq.id,title,due_date:dateFor(month),status:'todo',diy_key:key,notes:'Créée automatiquement par Nuvabri selon le type d’équipement.'})}
  if(eq.insurance_renewal_date&&!titles.has('Renouvellement assurance'))rows.push({user_id:u.id,leisure_equipment_id:eq.id,title:'Renouvellement assurance',due_date:eq.insurance_renewal_date,status:'todo',notes:'Rappel annuel Nuvabri'});
  if(eq.registration_renewal_date&&!titles.has('Renouvellement immatriculation'))rows.push({user_id:u.id,leisure_equipment_id:eq.id,title:'Renouvellement immatriculation',due_date:eq.registration_renewal_date,status:'todo',notes:'Rappel annuel Nuvabri'});
  if(rows.length)await cl.from('leisure_tasks').insert(rows);
 }
 async function run(){const cl=c(),u=await user();if(!cl||!u)return;const {data,error}=await cl.from('leisure_equipment').select('*').eq('user_id',u.id);if(error)return;for(const eq of data||[])await ensureFor(eq);if(typeof window.hpLoadLeisure==='function')window.hpLoadLeisure()}
 function enhanceForm(){const form=document.getElementById('hpLeisureForm');if(!form||document.getElementById('hpLeisureInsurance'))return;const block=document.createElement('div');block.innerHTML='<h3>Rappels automatiques</h3><label>Renouvellement assurance (facultatif)</label><input id="hpLeisureInsurance" type="date"><label>Renouvellement immatriculation (facultatif)</label><input id="hpLeisureRegistrationRenewal" type="date"><p class="muted">Nuvabri ajoutera aussi automatiquement les rappels saisonniers adaptés au type d’équipement.</p>';const save=document.getElementById('hpLeisureSave');form.insertBefore(block,save);
 const old=save.onclick;save.onclick=async function(){const cl=c();const before=Date.now();await old?.();setTimeout(async()=>{const u=await user();if(!u)return;const {data}=await cl.from('leisure_equipment').select('id').eq('user_id',u.id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(data?.id){await cl.from('leisure_equipment').update({insurance_renewal_date:document.getElementById('hpLeisureInsurance')?.value||null,registration_renewal_date:document.getElementById('hpLeisureRegistrationRenewal')?.value||null}).eq('id',data.id);await run()}},700)}
 }
 function patchType(){const s=document.getElementById('hpLeisureType');if(s&&![...s.options].some(o=>o.value==='utility_trailer')){const o=document.createElement('option');o.value='utility_trailer';o.textContent='🛻 Remorque';s.appendChild(o)}}
 function init(){setTimeout(()=>{patchType();enhanceForm();run()},1800);new MutationObserver(()=>{patchType();enhanceForm()}).observe(document.body,{childList:true,subtree:true});setInterval(run,21600000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();