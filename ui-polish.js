(function(){
  function ensureStyles(){if(document.getElementById('hpUiPolishStyle'))return;const s=document.createElement('style');s.id='hpUiPolishStyle';s.textContent=`
  :root{--hp-radius:18px;--hp-gap:12px}
  .app{padding-left:14px!important;padding-right:14px!important}
  .screen>h2,.screen>.row>h2{font-size:26px;letter-spacing:-.02em}
  .card{border-radius:var(--hp-radius)!important;margin:10px 0!important;padding:15px!important}
  .card h3{letter-spacing:-.01em}
  button{min-height:44px;padding:11px 14px!important;border-radius:12px!important;line-height:1.15}
  button.alt{background:var(--soft)!important}
  input,select{min-height:44px;font-size:16px!important}
  .taskactions{gap:8px!important}.taskactions button{min-width:0!important}
  .stats{gap:7px!important}.stats div{padding:10px 6px!important}.stats b{font-size:21px!important}
  .notice{border-radius:13px!important}
  .tabs{padding-bottom:env(safe-area-inset-bottom)}
  .tabs>div{width:100%!important;min-width:0!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .tab{font-size:14px!important;line-height:1.2;padding:10px 1px!important;min-width:0;white-space:normal}
  .tab br{display:block}
  #budget .hpBudgetSectionHeader{margin-top:10px}
  @media(max-width:390px){.brand{font-size:25px!important}.card{padding:13px!important}.stats b{font-size:18px!important}.tab{font-size:14px!important}.tab{letter-spacing:-.02em}}
  @media(min-width:520px){.tab{font-size:14px!important}}
  `;document.head.appendChild(s)}
  function shortenCopy(){const replacements=new Map([
    ['Garde tes équipements de loisir au même endroit : motoneige, VTT, bateau, VR, roulotte et plus.','Tes équipements de loisir, tâches et rappels au même endroit.'],
    ['Les faits financiers sont informatifs. Vérifie tes droits personnels dans Mon dossier ARC avant de cotiser.','Information générale — vérifie tes droits personnels avant de cotiser.'],
    ['La vue d’ensemble utilise uniquement les montants enregistrés dans HomePilot. Les paiements automatiques et transactions bancaires ne sont pas importés automatiquement.','Basé sur les montants enregistrés dans HomePilot.']
  ]);document.querySelectorAll('p,.muted,.notice').forEach(el=>{const t=(el.textContent||'').trim();if(replacements.has(t))el.textContent=replacements.get(t)})}
  function removeDuplicateAdvisor(){const budget=document.getElementById('budget');if(!budget)return;const nodes=[...budget.querySelectorAll('button,a')].filter(x=>(x.textContent||'').toLowerCase().includes('trouver un conseiller'));nodes.slice(1).forEach(x=>{const card=x.closest('.card');if(card&&card.parentElement===budget)card.remove();else x.remove()})}
  function normalizeButtons(){document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').trim().toLowerCase();if(['supprimer','×'].includes(t))b.classList.add('alt');if(t==='modifier'||t.startsWith('+ '))b.classList.add('alt')})}
  function markBudgetHeaders(){const budget=document.getElementById('budget');if(!budget)return;budget.querySelectorAll('h3').forEach(h=>{if(/vue d’ensemble|budget mensuel|objectifs|valeur nette|dettes|paiements|hypothèque/i.test(h.textContent||''))h.classList.add('hpBudgetSectionHeader')})}
  function polish(){ensureStyles();shortenCopy();removeDuplicateAdvisor();normalizeButtons();markBudgetHeaders()}
  function init(){polish();new MutationObserver(polish).observe(document.body,{childList:true,subtree:true});setTimeout(polish,1800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
