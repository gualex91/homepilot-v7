(function(){
 const $=id=>document.getElementById(id);
 function currentUser(){try{if(typeof u!=='undefined'&&u?.id)return u}catch(e){}return null}
 function currentHouseholdId(){try{if(typeof h!=='undefined'&&h?.id)return h.id}catch(e){}return null}
 function withTimeout(p,ms,msg){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg||'La connexion prend trop de temps.')),ms))])}
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
 async function accessToken(){
   const cached=localToken();
   if(cached)return cached;
   const c=window.supabaseClient||window.sb||window.client||null;
   if(!c)throw new Error('Connexion à HomePilot indisponible.');
   const r=await withTimeout(c.auth.getSession(),4000,'Impossible de lire la session HomePilot.');
   if(r.error)throw r.error;
   const token=r.data?.session?.access_token;
   if(!token)throw new Error('Session expirée. Reconnecte-toi.');
   return token;
 }
 async function save(){
   const btn=$('hpBudgetSave'),status=$('hpBudgetStatus');
   if(status)status.textContent='';
   try{
     const user=currentUser();
     if(!user)throw new Error('Session introuvable. Ferme puis rouvre HomePilot.');
     const amount=Number($('hpBudgetAmount')?.value||0),entryDate=$('hpBudgetDate')?.value||'';
     if(!(amount>0))throw new Error('Entre un montant supérieur à 0.');
     if(!entryDate)throw new Error('Choisis une date.');
     const token=await accessToken();
     if(btn){btn.disabled=true;btn.textContent='Enregistrement…'}
     const payload={user_id:user.id,household_id:currentHouseholdId(),property_id:$('hpBudgetProperty')?.value||null,entry_type:$('hpBudgetType')?.value||'expense',category:$('hpBudgetCategory')?.value||'Autre',amount,entry_date:entryDate,description:$('hpBudgetDescription')?.value?.trim()||null};
     const r=await withTimeout(fetch('/api/budget-entry',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload),cache:'no-store'}),12000,'Le serveur HomePilot ne répond pas.');
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok)throw new Error(body?.error||('Erreur serveur '+r.status));
     if(!body?.ok)throw new Error('HomePilot n’a pas confirmé la sauvegarde.');
     if($('hpBudgetAmount'))$('hpBudgetAmount').value='';
     if($('hpBudgetDescription'))$('hpBudgetDescription').value='';
     if($('hpBudgetProperty'))$('hpBudgetProperty').value='';
     if(status)status.textContent='✓ Entrée ajoutée.';
     const form=$('hpBudgetForm');if(form){form.classList.add('hidden');form.style.display=''}
     window.dispatchEvent(new CustomEvent('hp-budget-updated'));
   }catch(e){
     console.error('HomePilot budget save error',e);
     const msg=e?.message||'Erreur inconnue';
     if(status)status.textContent='Erreur : '+msg;
     alert(msg);
   }finally{
     if(btn){btn.disabled=false;btn.textContent='Ajouter au budget'}
   }
 }
 window.hpSaveBudgetEntry=save;
 function bind(){const b=$('hpBudgetSave');if(!b)return;b.type='button';b.setAttribute('onclick','return false;')}
 document.addEventListener('click',function(e){const b=e.target?.closest?.('#hpBudgetSave');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.hpSaving==='1')return;b.dataset.hpSaving='1';save().finally(()=>{b.dataset.hpSaving='0'})},true);
 function init(){bind();setTimeout(bind,900);new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();