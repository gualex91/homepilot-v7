(function(){
  'use strict';
  const groups={home:'home',properties:'properties',equipment:'properties',leisure:'properties',budget:'budget'};
  function updateCurrent(id){
    document.querySelectorAll('.tabs [data-screen]').forEach(button=>{
      if(button.dataset.screen===(groups[id]||'more'))button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }
  function openScreen(id){
    const target=document.getElementById(id);if(!target)return false;
    document.querySelectorAll('.screen').forEach(screen=>screen.classList.remove('on'));
    target.classList.remove('hidden');target.classList.add('on');updateCurrent(id);
    const heading=target.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}
    window.scrollTo({top:0,behavior:'auto'});
    if(id==='budget')window.hpLoadBudget?.();
    if(id==='leisure')window.hpLoadLeisure?.();
    document.dispatchEvent(new CustomEvent('hp-screen-changed',{detail:{id}}));
    return true;
  }
  function init(){
    window.show=openScreen;
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-screen]');if(!button)return;
      if(openScreen(button.dataset.screen)){event.preventDefault()}
    });
    updateCurrent(document.querySelector('.screen.on')?.id||'home');
  }
  window.hpOpenScreen=openScreen;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
