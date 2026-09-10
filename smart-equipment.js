(function(){
 function selected(name){return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>x.value)}
 function ensureInfo(){const btn=document.getElementById('cp');if(!btn||document.getElementById('autoTaskInfo'))return;const box=document.createElement('div');box.id='autoTaskInfo';box.className='notice';box.textContent='Les équipements sélectionnés génèrent leur plan d’entretien. Une sauvegarde incomplète peut être reprise sans recréer la propriété.';btn.before(box)}
 async function insertOnce(table,payload){
   const result=await sb.from(table).upsert(payload,{onConflict:'id',ignoreDuplicates:true}).select();
   if(result.error)throw result.error;
   if(result.data?.[0])return result.data[0];
   const existing=await sb.from(table).select('*').eq('id',payload.id).single();
   if(existing.error)throw existing.error;return existing.data;
 }
 async function create(){
   if(!h||!u)return alert('Crée d’abord ton foyer.');
   const name=pname.value.trim();if(!name)return alert('Donne un nom à la propriété.');
   const key='property:'+u.id;
   const equipment=selected('e'),services=selected('s');
   const payload={household_id:h.id,name,property_type:ptype.value,city:pcity.value.trim(),postal_code:ppostal.value.trim(),construction_year:pyear.value?Number(pyear.value):null,created_by:u.id};
   const fingerprint={...payload,equipment,services};
   payload.id=hpStability.operation(key,fingerprint);
   cp.disabled=true;cp.textContent='Création du plan…';
   try{
     const property=await insertOnce('properties',payload);
     for(const type of equipment){
       let details={};
       if(type==='piscine')details={size:poolSize.value,treatment:poolTreat.value,volume_estimated_l:PV[poolSize.value]||null,volume_actual_l:Number(poolVol.value)||null,volume_l:Number(poolVol.value)||PV[poolSize.value]||null};
       if(type==='spa')details={size:spaSize.value,treatment:spaTreat.value,volume_estimated_l:SV[spaSize.value]||null,volume_actual_l:Number(spaVol.value)||null,volume_l:Number(spaVol.value)||SV[spaSize.value]||null};
       const body={property_id:property.id,equipment_type:type,name:E.find(x=>x[0]===type)?.[1].replace(/^[^ ]+ /,'')||type,details};
       body.request_id=hpStability.operation(key+':'+property.id+':'+type,body);
       const response=await fetch('/api/property-equipment-add',{method:'POST',headers:{Authorization:'Bearer '+await hpStability.token(),'Content-Type':'application/json'},body:JSON.stringify(body)});
       const result=await response.json();
       if(!response.ok||result.task_warning)throw new Error(result.task_warning||result.error||'Plan incomplet.');
     }
     for(const type of services){
       const body={property_id:property.id,service_type:type,name:S.find(x=>x[0]===type)?.[1].replace(/^[^ ]+ /,'')||type,created_by:u.id};
       body.id=hpStability.operation(key+':'+property.id+':'+type,body);
       await insertOnce('property_services',body);
     }
     hpStability.complete(key);pf.classList.add('hidden');await load();await activate(property.id);
   }catch(error){alert('La sauvegarde est incomplète : '+error.message+' Réessaie sans changer le formulaire.')}
   finally{cp.disabled=false;cp.textContent='Créer ma propriété'}
 }
 function init(){ensureInfo();window.createProperty=create}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
