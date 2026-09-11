(function(){
 const $=id=>document.getElementById(id);
 const GROUPS=[
  {id:'hpBudgetGroupOverview',title:'Ressources et accompagnement',open:false},
  {id:'hpBudgetGroupMonthly',title:'Opérations du mois en cours',open:false},
  {id:'hpBudgetGroupGoals',title:'Objectifs et valeur nette',open:false},
  {id:'hpBudgetGroupDebts',title:'Dettes et paiements',open:false}
 ];
 function addStyles(){if($('hpBudgetSectionsStyle'))return;const s=document.createElement('style');s.id='hpBudgetSectionsStyle';s.textContent=`
 #budget .hp-budget-group{margin:14px 0;border:1px solid color-mix(in srgb,var(--b) 14%,transparent);border-radius:18px;background:color-mix(in srgb,var(--card) 97%,transparent);overflow:hidden;box-shadow:var(--shadow)}
 #budget .hp-budget-group-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px;background:transparent;color:var(--txt);box-shadow:none;border:0;text-align:left;font-size:17px}
 #budget .hp-budget-group-head .hp-budget-chevron{font-size:18px;transition:transform .2s ease;color:var(--b)}
 #budget .hp-budget-group.open .hp-budget-chevron{transform:rotate(180deg)}
 #budget .hp-budget-group-body{padding:0 14px 14px}
 #budget .hp-budget-group:not(.open) .hp-budget-group-body{display:none}
 #budget #hpBudgetGroupMonthly .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
 #budget #hpBudgetGroupMonthly .stats>div{min-width:0}
 #budget #hpBudgetGroupMonthly .stats b{font-size:clamp(1.1rem,5vw,1.6rem);overflow-wrap:anywhere}
 #budget #hpContributionShortcuts button{display:block;width:100%;margin:.5rem 0;min-height:44px}
 #budget .hp-budget-group-body>.card:first-child{margin-top:2px}
 `;document.head.appendChild(s)}
 function makeGroup(cfg,budget){let g=$(cfg.id);if(g)return g;g=document.createElement('div');g.id=cfg.id;g.className='hp-budget-group'+(cfg.open?' open':'');g.innerHTML=`<button class="hp-budget-group-head" type="button"><span>${cfg.title}</span><span class="hp-budget-chevron">⌄</span></button><div class="hp-budget-group-body"></div>`;const button=g.querySelector('.hp-budget-group-head');button.setAttribute('aria-expanded',String(cfg.open));button.onclick=()=>{g.classList.toggle('open');button.setAttribute('aria-expanded',String(g.classList.contains('open')))};budget.appendChild(g);return g}
 function move(el,group){if(!el||!group)return;const body=group.querySelector('.hp-budget-group-body');if(el.parentElement!==body)body.appendChild(el)}
 function directByText(budget,selector,text){return [...budget.querySelectorAll(`:scope > ${selector}`)].find(x=>(x.textContent||'').trim()===text)||null}
 function organize(){const budget=$('budget');if(!budget)return;addStyles();let tools=$('hpBudgetTools');if(!tools){tools=document.createElement('details');tools.id='hpBudgetTools';tools.innerHTML='<summary>Mes opérations et outils détaillés</summary><p class="muted">Retrouve tes opérations, tes dettes et tes objectifs. Le bilan utilise les montants de « Mes montants »; ces outils ne les additionnent pas automatiquement.</p>';budget.appendChild(tools)}const groups={};for(const cfg of GROUPS)groups[cfg.id]=makeGroup(cfg,tools);
  // Vue d’ensemble : résumé, fait financier et accès au conseiller.
  const oldOverview=$('hpFinancialOverview');if(oldOverview){oldOverview.hidden=true;move(oldOverview,groups.hpBudgetGroupOverview)}
  const fact=[...budget.children].find(x=>x.classList?.contains('season'));move(fact,groups.hpBudgetGroupOverview);
  const advisorBtn=budget.querySelector(':scope > .card .hpFindAdvisorBtn');if(advisorBtn)move(advisorBtn.closest('.card'),groups.hpBudgetGroupOverview);
  // Budget mensuel : totaux, saisie, cibles et liste du mois.
  const stats=[...budget.children].find(x=>x.classList?.contains('stats'));move(stats,groups.hpBudgetGroupMonthly);
  move($('hpContributionShortcuts'),groups.hpBudgetGroupMonthly);move($('hpBudgetForm'),groups.hpBudgetGroupMonthly);const shortcuts=$('hpContributionShortcuts'),entryForm=$('hpBudgetForm');if(shortcuts&&entryForm&&shortcuts.nextElementSibling!==entryForm)entryForm.parentElement.insertBefore(shortcuts,entryForm);move($('hpBudgetTargets'),groups.hpBudgetGroupMonthly);
  const monthTitle=directByText(budget,'h3','Ce mois-ci');move(monthTitle,groups.hpBudgetGroupMonthly);move($('hpBudgetList'),groups.hpBudgetGroupMonthly);
  const baseNotice=[...budget.children].find(x=>x.classList?.contains('notice')&&!x.closest('.hp-budget-group'));move(baseNotice,groups.hpBudgetGroupMonthly);
  // Objectifs et patrimoine.
  move($('hpSavingsGoals'),groups.hpBudgetGroupGoals);move($('hpNetWorthSection'),groups.hpBudgetGroupGoals);
  // Dettes, paiements et hypothèque.
  move($('hpMortgageCard'),groups.hpBudgetGroupDebts);move($('hpRecurringBlock'),groups.hpBudgetGroupDebts);move($('hpDebtSection'),groups.hpBudgetGroupDebts);
  // Garde le titre + bouton Ajouter du Budget au-dessus des groupes.
  if(budget.lastElementChild!==tools)budget.appendChild(tools);
 }
 function init(){setTimeout(organize,2600);let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(organize,120)}).observe(document.body,{childList:true,subtree:true});setInterval(organize,5000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
