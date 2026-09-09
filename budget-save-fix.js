(function(){
 const $=id=>document.getElementById(id);
 function currentUser(){try{if(typeof u!=='undefined'&&u?.id)return u}catch(e){}return null}
 function currentHouseholdId(){try{if(typeof h!=='undefined'&&h?.id)return h.id}catch(e){}return null}
 function localToken(){
   try{
     const exact=localStorage.getItem('sb-vkfvjwxajgeafzyphjvh-auth-token');
     const candidates=exact?[exact]:Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')).map(k=>localStorage.getItem(k));
     for(const raw of candidates){
       if(!raw)continue;
       const parsed=JSON.parse(raw);
       const token=parsed?.access_token||parsed?.currentSession?.access_token||parsed?.session?.access_token;
       if(token)return token;
     }
   }catch(e){console.warn('HomePilot local token read',e)}
   return null;
 }
 function resetButton(btn){if(btn){btn.disabled=false;btn.textContent='Ajouter au budget';btn.dataset.hpSaving='0'}}
 async function save(){
   const btn=$('hpBudgetSave'),status=$('hpBudgetStatus');
   if(status)status.textContent='';
   if(!btn)return;
   btn.disabled=true;btn.textContent='Enregistrement…';btn.dataset.hpSaving='1';
   let watchdog=setTimeout(()=>{
     resetButton(btn);
     if(status)status.textContent='Erreur : la sauvegarde a pris trop de temps. Réessaie.';
   },15000);
   try{
     const user=currentUser();
     if(!user)throw new Error('Session introuvable. Ferme puis rouvre HomePilot.');
     const token=localToken();
     if(!token)throw new Error('Session expirée. Reconnecte-toi à HomePilot.');
     const amount=Number($('hpBudgetAmount')?.value||0),entryDate=$('hpBudgetDate')?.value||'';
     if(!(amount>0))throw new Error('Entre un montant supérieur à 0.');
     if(!entryDate)throw new Error('Choisis une date.');
     const payload={user_id:user.id,household_id:currentHouseholdId(),property_id:$('hpBudgetProperty')?.value||null,entry_type:$('hpBudgetType')?.value||'expense',category:$('hpBudgetCategory')?.value||'Autre',amount,entry_date:entryDate,description:$('hpBudgetDescription')?.value?.trim()||null};
     const controller=new AbortController();
     const abortTimer=setTimeout(()=>controller.abort(),10000);
     let r;
     try{
       r=await fetch('/api/budget-entry',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
     }finally{clearTimeout(abortTimer)}
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok)throw new Error(body?.error||('Erreur serveur '+r.status));
     if(!body?.ok||!body?.id)throw new Error('HomePilot n’a pas confirmé la sauvegarde dans la base de données.');
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