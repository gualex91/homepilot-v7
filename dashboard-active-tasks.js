(function(){
 // Filtering happens in render(), before limiting the dashboard to four tasks.
 // No title matching: two different equipment items may have identical task titles.
 window.addEventListener('hp-tasks-rendered',()=>{
   const host=document.getElementById('tl');
   if(!host||typeof tasks==='undefined')return;
   const completed=new Set(tasks.filter(t=>t.status==='done').map(t=>t.id));
   for(const card of host.querySelectorAll('[data-task-id]')){
     if(completed.has(card.dataset.taskId))card.remove();
   }
 });
})();
