(function(){
 const $=id=>document.getElementById(id);
 function openForm(prefill){
   const budget=$('budget'), form=$('hpBudgetForm');
   if(!budget||!form||$('hpBudgetSave')?.dataset.hpSaving==='1')return false;
   if(prefill&&typeof prefill==='object'&&prefill.entry_type==='expense'&&['CELI','REER'].includes(prefill.category)&&Number.isFinite(prefill.amount)&&prefill.amount>0){
     if($('hpBudgetAmount')?.value&&!confirm('Remplacer l’opération en cours de saisie par ce versement?'))return false;
     const category=$('hpBudgetCategory');
     if(category&&!Array.from(category.options||[]).some(o=>o.value===prefill.category)){const option=document.createElement('option');option.value=prefill.category;option.textContent=prefill.category;category.appendChild(option)}
     for(const [id,value] of Object.entries({hpBudgetType:'expense',hpBudgetCategory:prefill.category,hpBudgetAmount:prefill.amount,hpBudgetDescription:prefill.description,hpBudgetProperty:'',hpBudgetDate:''})){if($(id))$(id).value=String(value??'')}
     if($('hpBudgetStatus'))$('hpBudgetStatus').textContent='Vérifie la date et le montant du versement effectué, puis enregistre.';
   }
   if(prefill&&['income','expense'].includes(prefill.entry_type)&&!prefill.category){
     const type=$('hpBudgetType'),hasDraft=!!($('hpBudgetAmount')?.value||$('hpBudgetDescription')?.value?.trim());
     if(type&&type.value!==prefill.entry_type){
       if(hasDraft&&!confirm('Changer le type de l’opération en cours pour '+(prefill.entry_type==='income'?'un revenu':'une dépense')+'? Le montant saisi sera conservé.'))return false;
       type.value=prefill.entry_type;
       if($('hpBudgetCategory'))$('hpBudgetCategory').value=prefill.entry_type==='income'?'Salaire':'Autre';
     }else if(!hasDraft&&$('hpBudgetCategory'))$('hpBudgetCategory').value=prefill.entry_type==='income'?'Salaire':'Autre';
   }
   window.hpSetFinanceView?.('operations');
   if(!$('hpFinanceOperations'))$('hpBudgetTools')?.setAttribute('open','');
   const group=$('hpBudgetGroupMonthly');
   if(group){group.classList.add('open');group.querySelector('.hp-budget-group-head')?.setAttribute('aria-expanded','true')}
   form.classList.remove('hidden');
   form.style.display='block';
   const d=$('hpBudgetDate');
   if(d&&!d.value){const now=new Date(),off=now.getTimezoneOffset();d.value=new Date(now.getTime()-off*60000).toISOString().slice(0,10)}
   $('hpBudgetAmount')?.focus({preventScroll:true});
   setTimeout(()=>{form.scrollIntoView({behavior:'smooth',block:'start'})},60);
   return true;
 }
 function bind(){
   const add=$('hpBudgetAddBtn');
   if(add&&add.dataset.hpEntryFixed!=='1'){
     add.dataset.hpEntryFixed='1';
     add.onclick=null;
     add.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openForm()},true);
   }
   const form=$('hpBudgetForm');
   if(form&&form.classList.contains('hidden')===false)form.style.display='block';
 }
 window.hpOpenBudgetEntry=openForm;
 function init(){bind();setTimeout(bind,1200);new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();