(function(){
 const $=id=>document.getElementById(id);
 function openForm(){
   const budget=$('budget'), form=$('hpBudgetForm');
   if(!budget||!form)return false;
   const group=$('hpBudgetGroupMonthly');
   if(group)group.classList.add('open');
   form.classList.remove('hidden');
   form.style.display='block';
   const d=$('hpBudgetDate');
   if(d&&!d.value){const now=new Date(),off=now.getTimezoneOffset();d.value=new Date(now.getTime()-off*60000).toISOString().slice(0,10)}
   setTimeout(()=>{form.scrollIntoView({behavior:'smooth',block:'start'});$('hpBudgetAmount')?.focus()},60);
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