(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 async function context(){const c=client();if(!c)return{};const {data:{user},error}=await c.auth.getUser();if(error||!user)return{c};const {data:m}=await c.from('household_members').select('household_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();return{c,user,householdId:m?.household_id||null}}
 async function save(){
   const status=$('hpBudgetStatus'),btn=$('hpBudgetSave');
   if(status)status.textContent='';
   const {c,user,householdId}=await context();
   if(!c||!user){alert('Reconnecte-toi à HomePilot.');return}
   const amount=Number($('hpBudgetAmount')?.value||0),date=$('hpBudgetDate')?.value||'',type=$('hpBudgetType')?.value||'expense',category=$('hpBudgetCategory')?.value||'Autre',description=$('hpBudgetDescription')?.value?.trim()||null,propertyId=$('hpBudgetProperty')?.value||null;
   if(!(amount>0)){alert('Entre un montant supérieur à 0.');return}
   if(!date){alert('Choisis une date.');return}
   if(btn){btn.disabled=true;btn.textContent='Enregistrement…'}
   try{
     const {error}=await c.from('budget_entries').insert({user_id:user.id,household_id:householdId||null,property_id:propertyId||null,entry_type:type,category,amount,entry_date:date,description});
     if(error)throw error;
     if($('hpBudgetAmount'))$('hpBudgetAmount').value='';
     if($('hpBudgetDescription'))$('hpBudgetDescription').value='';
     if($('hpBudgetProperty'))$('hpBudgetProperty').value='';
     $('hpBudgetForm')?.classList.add('hidden');
     if(status)status.textContent='Entrée ajoutée.';
     if(typeof window.hpLoadBudget==='function')await window.hpLoadBudget();
     window.dispatchEvent(new CustomEvent('hp-budget-updated'));
   }catch(e){console.error('HomePilot budget save error',e);if(status)status.textContent='Impossible d’enregistrer : '+(e?.message||'erreur inconnue');alert('L’entrée n’a pas pu être enregistrée. '+(e?.message||''))}
   finally{if(btn){btn.disabled=false;btn.textContent='Ajouter au budget'}}
 }
 function bind(){const b=$('hpBudgetSave');if(!b||b.dataset.hpSaveFixed==='1')return;b.dataset.hpSaveFixed='1';b.onclick=null;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();save()},true)}
 window.hpSaveBudgetEntry=save;
 function init(){bind();setTimeout(bind,900);new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();