(function(){
 const PROFILE={
  name:'Guillaume-Alexandre Tremblay',
  title:'Conseiller en sécurité financière (Québec)',
  firm:'iA Groupe financier - Bureau de le Fjord',
  profileUrl:'https://ia.ca/fr/fiche-conseiller/conseiller/guillaume-alexandre-tremblay',
  services:['Assurance vie','Assurance maladie grave et invalidité','Assurance accident corporel','Assurance voyage','REER, CELI et autres régimes d’épargne','REEE','Produits de revenu de retraite']
 };
 const $=id=>document.getElementById(id);
 function ensureModal(){if($('hpAdvisorModal'))return;const d=document.createElement('div');d.id='hpAdvisorModal';d.className='hidden';d.style='position:fixed;inset:0;z-index:180;background:#0009;padding:18px;overflow:auto';d.innerHTML='<div class="card" style="max-width:620px;margin:3vh auto"><div class="row"><h2>Ton accompagnement financier</h2><button class="alt" onclick="hpCloseAdvisor()">Fermer</button></div><div id="hpAdvisorBody"></div></div>';document.body.appendChild(d)}
 window.hpCloseAdvisor=()=>$('hpAdvisorModal')?.classList.add('hidden');
 window.hpFindAdvisor=()=>{ensureModal();$('hpAdvisorBody').innerHTML=`<div class="card"><div class="row"><div><b>${PROFILE.name}</b><div class="muted">${PROFILE.title}</div></div><span class="pill">Conseiller Nuvabri</span></div><p class="muted">${PROFILE.firm}</p><p>Disponible comme référence financière Nuvabri partout au Québec.</p><div class="notice"><b>Services</b><br>${PROFILE.services.join(' • ')}</div><p style="margin-top:14px"><a href="${PROFILE.profileUrl}" target="_blank" rel="noopener">Voir la fiche officielle iA et contacter Guillaume-Alexandre</a></p></div>`;$('hpAdvisorModal').classList.remove('hidden')};
 function addBudgetButton(){const s=$('budget');if(!s||s.querySelector('.hpFindAdvisorBtn'))return;const card=document.createElement('div');card.className='card';card.innerHTML='<div class="row"><div><div class="badge">Accompagnement</div><h3 style="margin:8px 0 4px">Ton accompagnement financier</h3><p class="muted" style="margin:0">Avec Guillaume-Alexandre Tremblay, conseiller en sécurité financière. Aucun accès à tes données sans démarche de ta part.</p></div></div><button class="hpFindAdvisorBtn" style="width:100%;margin-top:12px" onclick="hpFindAdvisor()">👤 Consulter la fiche de Guillaume-Alexandre</button>';s.appendChild(card)}
 function patchAdvisorLinks(){document.querySelectorAll('button,a').forEach(el=>{const t=(el.textContent||'').toLowerCase();if(t.includes('trouver un conseiller')||t.includes('parler à un conseiller')){el.onclick=e=>{e.preventDefault();hpFindAdvisor()};if(el.tagName==='A')el.removeAttribute('href')}})}
 function init(){ensureModal();addBudgetButton();patchAdvisorLinks();new MutationObserver(()=>{addBudgetButton();patchAdvisorLinks()}).observe(document.body,{childList:true,subtree:true});setInterval(()=>{addBudgetButton();patchAdvisorLinks()},1500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
