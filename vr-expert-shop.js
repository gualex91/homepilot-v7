(function(){
  const SHOP_URL='https://vrexpertjonquiere.ca/';
  const isVrText=t=>/\bVR\b|motoris[eé]|roulotte|fifth\s*wheel|caravane/i.test(t||'');
  function shopButton(){const a=document.createElement('a');a.className='alt hpVrShopBtn';a.href=SHOP_URL;a.target='_blank';a.rel='noopener';a.textContent='🛒 Acheter des produits VR';a.style.cssText='display:inline-block;text-decoration:none;text-align:center;padding:12px 14px;border-radius:12px;margin-top:8px;font-weight:750';return a}
  function enhanceCards(){const root=document.getElementById('hpLeisureList');if(!root)return;[...root.children].forEach(card=>{if(card.nodeType!==1||card.querySelector('.hpVrShopBtn'))return;if(!isVrText(card.textContent))return;const actions=card.querySelector('.taskactions')||card;actions.appendChild(shopButton())})}
  function enhanceModals(){['hpLeisureTaskModal','hpDiyModal'].forEach(id=>{const m=document.getElementById(id);if(!m||m.querySelector('.hpVrShopBtn')||!isVrText(m.textContent))return;const body=m.querySelector('#hpLtmBody,#hpDiyBody')||m;body.appendChild(shopButton())})}
  function enhance(){enhanceCards();enhanceModals()}
  window.HomePilotVrShop={url:SHOP_URL,open:()=>window.open(SHOP_URL,'_blank','noopener')};
  function init(){enhance();new MutationObserver(()=>setTimeout(enhance,0)).observe(document.body,{childList:true,subtree:true});setInterval(enhance,1500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();