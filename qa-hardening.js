(function(){
 const $=id=>document.getElementById(id);
 function dedupeNav(){const tabs=document.querySelector('.tabs>div');if(!tabs)return;const seen=new Set();[...tabs.querySelectorAll('.tab')].forEach(tab=>{const key=(tab.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();if(!key)return;if(seen.has(key))tab.remove();else seen.add(key)});}
 function validateScreens(){document.querySelectorAll('.tabs .tab').forEach(tab=>{const oc=tab.getAttribute('onclick')||'';const m=oc.match(/show\(['\"]([^'\"]+)['\"]\)/);if(m&&!$(m[1])){tab.style.display='none';tab.dataset.hpHiddenBroken='1'}})}
 function hardenShow(){if(window.__hpShowHardened||typeof window.show!=='function')return;window.__hpShowHardened=true;const orig=window.show;window.show=function(id){const target=$(id);if(!target){console.warn('HomePilot: écran introuvable',id);return}try{return orig.apply(this,arguments)}catch(e){console.error('HomePilot navigation error',e);document.querySelectorAll('.screen').forEach(x=>x.classList.remove('on'));target.classList.add('on')}}}
 function hardenForms(){document.querySelectorAll('button').forEach(b=>{if(!b.type)b.type='button'});document.querySelectorAll('input[type="number"]').forEach(i=>{if(!i.inputMode)i.inputMode='decimal'});}
 function normalizeHidden(){document.querySelectorAll('.hidden').forEach(el=>{if(el.classList.contains('screen')&&el.classList.contains('on'))el.classList.remove('hidden')})}
 function run(){dedupeNav();validateScreens();hardenShow();hardenForms();normalizeHidden()}
 function init(){run();let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,80)}).observe(document.body,{childList:true,subtree:true});window.addEventListener('error',e=>console.error('HomePilot UI error:',e.error||e.message));window.addEventListener('unhandledrejection',e=>console.error('HomePilot async error:',e.reason));setTimeout(run,2500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();