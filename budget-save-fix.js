(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 async function sessionUser(c){
   try{const {data,error}=await c.auth.getSession();if(error)throw error;return data?.session?.user||null}catch(e){console.error('HomePilot budget session error',e);return null}
 }
 async function save(){
   const btn=$('hpBudgetSave'),status=$('hpBudgetStatus');
   if(status)status.textContent='';
   if(btn){btn.disabled=true;btn.textContent='Enregistrement…'}
   try{
     const c=client();
     if(!c)throw new Error('Connexion à HomePilot indisponible.');
     const user=await sessionUser(c);
     if(!user)throw new Error('Session expirée. Reconnecte-toi.');
     const amount=Number($('hpBudgetAmount')?.value||0);
     const entryDate=$('hpBudgetDate')?.value||'';
     if(!(amount>0))throw new Error('Entre un montant supérieur à 0.');
     if(!entryDate)throw new Error('Choisis une date.');
     let householdId=null;
     try{
       const {data:m}=await c.from('household_members').select('household_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();
       householdId=m?.household_id||null;
     }catch(e){console.warn('HomePilot budget household optional',e)}
     const payload={
       user_id:user.id,
       household_id:householdId,
       property_id:$('hpBudgetProperty')?.value||null,
       entry_type:$('hpBudgetType')?.value||'expense',
       category:$('hpBudgetCategory')?.value||'Autre',
       amount,
       entry_date:entryDate,
       description:$('hpBudgetDescription')?.value?.trim()||null
     };
     const {data,error}=await c.from('budget_entries').insert(payload).select('id').single();
     if(error)throw error;
     if(!data?.id)throw new Error('Aucune confirmation reçue après l’enregistrement.');
     if($('hpBudgetAmount'))$('hpBudgetAmount').value='';
     if($('hpBudgetDescription'))$('hpBudgetDescription').value='';
     if($('hpBudgetProperty'))$('hpBudgetProperty').value='';
     if(status)status.textContent='✓ Entrée ajoutée.';
     const form=$('hpBudgetForm');if(form){form.classList.add('hidden');form.style.display=''}
     if(typeof window.hpLoadBudget==='function')await window.hpLoadBudget();
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
 function bind(){
   const b=$('hpBudgetSave');if(!b)return;
   b.type='button';
   b.setAttribute('onclick','return false;');
 }
 document.addEventListener('click',function(e){
   const b=e.target?.closest?.('#hpBudgetSave');
   if(!b)return;
   e.preventDefault();e.stopPropagation();
   if(b.dataset.hpSaving==='1')return;
   b.dataset.hpSaving='1';
   Promise.resolve(save()).finally(()=>{b.dataset.hpSaving='0'});
 },true);
 function init(){bind();setTimeout(bind,900);new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();