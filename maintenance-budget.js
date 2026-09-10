(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function button(task,propertyName='',kind='property'){
    if(!task?.id||task.status==='done')return '';
    const taskDate=String(task.due_at||task.due_date||'');
    const context={taskKey:kind+':'+String(task.id)+':'+taskDate,label:String(task.title||'Entretien').slice(0,120),propertyName:String(propertyName||'').slice(0,120)||null,dueDate:taskDate};
    return `<button type="button" class="alt" data-maintenance-budget="${esc(JSON.stringify(context))}">Prévoir le coût</button>`;
  }
  root.hpMaintenanceBudget={button};
  if(typeof document==='undefined')return;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-maintenance-budget]');if(!button)return;
    event.preventDefault();
    if(!root.hpPlanMaintenanceTask){alert('Le budget termine son chargement. Réessaie dans un instant.');return}
    let context;try{context=JSON.parse(button.dataset.maintenanceBudget)}catch{return}
    root.hpPlanMaintenanceTask(context).catch(()=>alert('Impossible d’ouvrir ton budget. Réessaie.'));
  });
})(globalThis);
