(function(){
 const $=id=>document.getElementById(id);
 function openScreen(id){const target=$(id);if(!target)return false;document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));target.classList.remove('hidden');target.classList.add('on');window.scrollTo({top:0,behavior:'auto'});return true}
 function bind(){
  document.querySelectorAll('.tabs .tab').forEach(tab=>{
   const oc=tab.getAttribute('onclick')||'';
   const m=oc.match(/show\(['\"]([^'\"]+)['\"]\)/);
   if(!m||tab.dataset.hpNavFixed==='1')return;
   const id=m[1];
   tab.dataset.hpNavFixed='1';
   tab.addEventListener('click',e=>{
    if(!$(id))return;
    e.preventDefault();e.stopImmediatePropagation();
    openScreen(id);
    if(id==='leisure'&&typeof window.hpLoadLeisure==='function')window.hpLoadLeisure();
    if(id==='budget'&&typeof window.hpLoadBudget==='function')window.hpLoadBudget();
   },true);
  });
  document.querySelectorAll('button').forEach(b=>{
   const oc=b.getAttribute('onclick')||'';
   if(!/show\(['\"]properties['\"]\)/.test(oc)||b.dataset.hpPropFixed==='1')return;
   b.dataset.hpPropFixed='1';
   b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openScreen('properties')},true);
  });
 }
 function init(){bind();setTimeout(bind,1200);new MutationObserver(()=>bind()).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.hpOpenScreen=openScreen;
})();