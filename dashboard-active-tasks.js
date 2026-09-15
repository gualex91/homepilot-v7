(function(){
  'use strict';
  let selected='todo', propertyId=null;
  const titles={todo:'Priorités de cette propriété',soon:'Échéances proches',done:'Tâches faites'};
  const empty={todo:'Aucune tâche à faire pour cette propriété.',soon:'Aucune échéance proche pour cette propriété.',done:'Aucune tâche faite pour cette propriété.'};

  function update(){
    const host=document.getElementById('tl');
    if(!host||typeof tasks==='undefined')return;
    const currentProperty=typeof ap!=='undefined'?ap?.id:null;
    if(currentProperty!==propertyId){selected='todo';propertyId=currentProperty}
    host.dataset.taskFilter=selected;
    document.querySelectorAll('.hp-task-filter').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.taskFilter===selected));
    });
    const title=document.getElementById('hpTaskListTitle');
    if(title)title.textContent=titles[selected];
    const legend=document.getElementById('hpPriorityLegend');
    if(legend)legend.hidden=selected==='done';

    const local=new Date();const today=new Date(local.getTime()-local.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const renewed=task=>task.status!=='done'&&task.due_at>today&&tasks.some(old=>old.status==='done'&&old.property_id===task.property_id&&old.equipment_id===task.equipment_id&&old.title===task.title&&Object.keys(old.recurrence||{}).length);
    const due=document.getElementById('due');if(due)due.textContent=tasks.filter(t=>t.status!=='done'&&!renewed(t)).length;
    let visible=tasks.filter(task=>selected==='done'?task.status==='done':task.status!=='done');
    if(selected==='todo')visible=visible.filter(t=>!renewed(t));
    if(selected==='soon'){
      // Match the existing Bientôt counter: overdue tasks and the next seven days.
      const until=new Date(Date.now()+7*864e5);
      visible=visible.filter(task=>task.due_at&&new Date(task.due_at+'T12:00:00')<=until);
    }
    if(selected==='done')visible.sort((a,b)=>String(b.completed_at||'').localeCompare(String(a.completed_at||'')));
    if(selected!=='done')visible.sort((a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')));
    visible=visible.slice(0,3);
    host.innerHTML=visible.length?visible.map(card).join(''):'<div class="card muted">'+empty[selected]+'</div>';
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.hp-task-filter');
    if(!button||!Object.hasOwn(titles,button.dataset.taskFilter))return;
    selected=button.dataset.taskFilter;
    // Use the ordinary render event so DIY/professional enhancements also refresh.
    render();
  });
  window.addEventListener('hp-tasks-rendered',update);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update);else update();
})();
