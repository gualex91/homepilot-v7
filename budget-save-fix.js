(function(){
 const $=id=>document.getElementById(id);
 function currentUser(){try{if(typeof u!=='undefined'&&u?.id)return u}catch(e){}return null}
 function currentHouseholdId(){try{if(typeof h!=='undefined'&&h?.id)return h.id}catch(e){}return null}
 async function localToken(){return hpStability.token()}
 function resetButton(btn){if(btn){btn.disabled=false;btn.textContent='Ajouter au budget';btn.dataset.hpSaving='0'}}
 async function save(){
   const btn=$('hpBudgetSave'),status=$('hpBudgetStatus');
   if(status)status.textContent='';
   if(!btn)return;
   btn.disabled=true;btn.textContent='Enregistrement…';btn.dataset.hpSaving='1';
   let watchdog=setTimeout(()=>{
     if(status)status.textContent='Sauvegarde en cours de vérification…';
   },15000);
   try{
     const user=currentUser();
     if(!user)throw new Error('Session introuvable. Ferme puis rouvre HomePilot.');
     const token=await localToken();
     if(!token)throw new Error('Session expirée. Reconnecte-toi à HomePilot.');
     const amount=Number($('hpBudgetAmount')?.value||0),entryDate=$('hpBudgetDate')?.value||'';
     if(!(amount>0))throw new Error('Entre un montant supérieur à 0.');
     if(!entryDate)throw new Error('Choisis une date.');
     const payload={user_id:user.id,household_id:currentHouseholdId(),property_id:$('hpBudgetProperty')?.value||null,entry_type:$('hpBudgetType')?.value||'expense',category:$('hpBudgetCategory')?.value||'Autre',amount,entry_date:entryDate,description:$('hpBudgetDescription')?.value?.trim()||null};
     const operationKey='budget:'+user.id;
     payload.request_id=hpStability.operation(operationKey,payload);
     const controller=new AbortController();
     const abortTimer=setTimeout(()=>controller.abort(),10000);
     let r;
     try{
       r=await fetch('/api/budget-entry',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
     }finally{clearTimeout(abortTimer)}
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok)throw new Error(body?.error||('Erreur serveur '+r.status));
     if(!body?.ok||!body?.id)throw new Error('HomePilot n’a pas confirmé la sauvegarde dans la base de données.');
     hpStability.complete(operationKey);
     clearTimeout(watchdog);watchdog=null;
     resetButton(btn);
     if($('hpBudgetAmount'))$('hpBudgetAmount').value='';
     if($('hpBudgetDescription'))$('hpBudgetDescription').value='';
     if($('hpBudgetProperty'))$('hpBudgetProperty').value='';
     if(status)status.textContent='✓ Entrée enregistrée.';
     const form=$('hpBudgetForm');if(form){form.classList.add('hidden');form.style.display=''}
     setTimeout(()=>window.dispatchEvent(new CustomEvent('hp-budget-updated')),100);
   }catch(e){
     clearTimeout(watchdog);watchdog=null;
     resetButton(btn);
     console.error('HomePilot budget save error',e);
     const msg=e?.name==='AbortError'?'Le serveur HomePilot ne répond pas. Réessaie.':(e?.message||'Erreur inconnue');
     if(status)status.textContent='Erreur : '+msg;
     alert(msg);
   }
 }
 window.hpSaveBudgetEntry=save;
 function bind(){const b=$('hpBudgetSave');if(!b)return;b.type='button';b.onclick=null;b.setAttribute('onclick','return false;')}
 document.addEventListener('click',function(e){const b=e.target?.closest?.('#hpBudgetSave');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.hpSaving==='1')return;save()},true);
 function init(){bind();setTimeout(bind,900);new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
