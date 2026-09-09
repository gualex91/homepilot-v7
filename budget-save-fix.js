(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 function currentUser(){try{if(typeof u!=='undefined'&&u?.id)return u}catch(e){}return null}
 function currentHouseholdId(){try{if(typeof h!=='undefined'&&h?.id)return h.id}catch(e){}return null}
 function withTimeout(p,ms){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('La connexion au budget prend trop de temps. Réessaie.')),ms))])}
 async function save(){
   const btn=$('hpBudgetSave'),status=$('hpBudgetStatus');
   if(status)status.textContent='';
   if(btn){btn.disabled=true;btn.textContent='Enregistrement…'}
   try{
     const c=client();
     if(!c)throw new Error('Connexion à HomePilot indisponible.');
     const user=currentUser();
     if(!user)throw new Error('Session introuvable. Ferme puis rouvre HomePilot.');
     const amount=Number($('hpBudgetAmount')?.value||0),entryDate=$('hpBudgetDate')?.value||'';
     if(!(amount>0))throw new Error('Entre un montant supérieur à 0.');
     if(!entryDate)throw new Error('Choisis une date.');
     const payload={user_id:user.id,household_id:currentHouseholdId(),property_id:$('hpBudgetProperty')?.value||null,entry_type:$('hpBudgetType')?.value||'expense',category:$('hpBudgetCategory')?.value||'Autre',amount,entry_date:entryDate,description:$('hpBudgetDescription')?.value?.trim()||null};
     const result=await withTimeout(c.from('budget_entries').insert(payload).select('id').single(),10000);
     if(result.error)throw result.error;
     if(!result.data?.id)throw new Error('HomePilot n’a pas reçu la confirmation de sauvegarde.');
     if($('hpBudgetAmount'))$('hpBudgetAmount').value='';
     if($('hpBudgetDescription'))$('hpBudgetDescription').value='';
     if($('hpBudgetProperty'))$('hpBudgetProperty').value='';
     if(status)status.textContent='✓ Entrée ajoutée.';
     const form=$('hpBudgetForm');if(form){form.classList.add('hidden');form.style.display=''}
     window.dispatchEvent(new CustomEvent('hp-budget-updated'));
     setTimeout(()=>{try{if(typeof window.hpLoadBudget==='function')window.hpLoadBudget()}catch(e){console.error(e)}},0);
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