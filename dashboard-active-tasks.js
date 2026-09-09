(function(){
 let busy=false;
 function activeTasks(){return (window.tasks||[]).filter(t=>t.status!=='done')}
 function hideDone(){
  if(busy)return; const host=document.getElementById('tl'); if(!host)return;
  const all=window.tasks||[]; const done=all.filter(t=>t.status==='done'); if(!done.length)return;
  busy=true;
  [...host.children].forEach(card=>{
   if(card.nodeType!==1)return;
   const text=(card.textContent||'').toLowerCase();
   const match=done.find(t=>text.includes(String(t.title||'').toLowerCase()));
   if(match)card.remove();
  });
  busy=false;
 }
 function patchDone(){
  if(typeof window.done!=='function'||window.done.__hpPatched)return;
  const original=window.done;
  const wrapped=async function(id){
   const result=await original.apply(this,arguments);
   const t=(window.tasks||[]).find(x=>x.id===id); if(t)t.status='done';
   setTimeout(hideDone,0); return result;
  };
  wrapped.__hpPatched=true; window.done=wrapped;
 }
 function init(){patchDone();hideDone();const h=document.getElementById('tl');if(h)new MutationObserver(()=>setTimeout(hideDone,0)).observe(h,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 setInterval(()=>{patchDone();hideDone()},1000);
})();