(function(){
 // professional-task-router owns every search; this module only adds entry buttons.
 function enhance(){
  document.querySelectorAll('#tl > *, #at > *, #tasklist > *').forEach(card=>{
   if(card.nodeType!==1||card.querySelector('.hpFindPro'))return;
   const button=document.createElement('button');button.type='button';button.className='alt hpFindPro';
   button.textContent='👷 Trouver un professionnel';button.style.marginTop='8px';card.appendChild(button);
  });
 }
 function init(){enhance();new MutationObserver(()=>setTimeout(enhance,0)).observe(document.body,{childList:true,subtree:true});setInterval(enhance,1500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
