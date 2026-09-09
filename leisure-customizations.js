(function(){
 const $=id=>document.getElementById(id);
 function addTrailerOption(){
   const s=$('hpLeisureType');
   if(!s||s.querySelector('option[value="utility_trailer"]')) return;
   const o=document.createElement('option');
   o.value='utility_trailer';
   o.textContent='🛻 Remorque';
   const other=s.querySelector('option[value="other"]');
   s.insertBefore(o,other||null);
 }
 function refresh(){addTrailerOption()}
 function init(){
   refresh();
   setTimeout(refresh,700);
   setTimeout(refresh,1800);
   window.addEventListener('hp-leisure-updated',refresh);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();