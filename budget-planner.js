(function(){
  'use strict';
  const E=hpBudgetEngine,esc=hpStability.esc,$=id=>document.getElementById(id);
  const money=n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(n/100);
  const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
  const dateLabel=s=>new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(s+'T12:00:00'));
  const C=hpBudgetCatalog,I=hpBudgetInsights,CATS=C.categories;
  const FREQ={once:'Une seule fois',weekly:'Chaque semaine',biweekly:'Aux deux semaines',semimonthly:'Deux fois par mois',monthly:'Chaque mois',quarterly:'Chaque trimestre',yearly:'Chaque année'};
  let owner=null,epoch=0,loading=false,saving=false,ready=false,dirty=false,revision=null,plan=E.empty(),draft=E.empty(),entries=[],entriesComplete=true,legacy=null,month=today().slice(0,7),view='overview',lastResult=null,lastLoadedMonth=null;
  let statusMessage='',statusError=false,scenario=null,picker=null,simulationAmount=0;
  function status(message,error=false){
    statusMessage=message;statusError=error;
    for(const id of ['hpFinanceStatus','hpFinanceSaveStatus']){const el=$(id);if(el){el.textContent=message;el.setAttribute('role',error?'alert':'status');el.classList.toggle?.('finance-negative',error)}}
  }
  function saveProblem(message){status(message,true);const el=$('hpFinanceSaveStatus')||$('hpFinanceStatus');el?.scrollIntoView?.({block:'center'});el?.focus?.({preventScroll:true})}
  function ensure(){
    const budget=$('budget');if(!budget||$('hpBudgetPlanner'))return;
    const heading=budget.querySelector('h2');if(heading)heading.textContent='Mon budget';const entry=$('hpBudgetAddBtn');if(entry)entry.textContent='Noter une opération';
    const category=$('hpBudgetCategory');if(category){const selected=category.value;category.innerHTML=[...new Set([...CATS,...Array.from(category.options||[],o=>o.value)])].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');category.value=selected}
    const box=document.createElement('div');box.id='hpBudgetPlanner';
    box.innerHTML=`<div class="finance-heading"><div><h3>Un budget clair. Des choix plus simples.</h3><div class="finance-note">Tes revenus, tes dépenses et la suite de tes projets. Montants en dollars canadiens.</div></div></div><div class="finance-controls"><button type="button" class="alt" data-action="previous" aria-label="Mois précédent">‹</button><input id="hpFinanceMonth" type="month" value="${month}" aria-label="Mois du budget"><button type="button" class="alt" data-action="next" aria-label="Mois suivant">›</button></div><div class="finance-tabs" role="tablist" aria-label="Mon budget"><button type="button" data-view="overview" role="tab" id="hpFinanceTabOverview" aria-controls="hpFinanceOverview">Mon bilan</button><button type="button" data-view="plan" role="tab" id="hpFinanceTabPlan" aria-controls="hpFinanceEditor">Mes montants</button><button type="button" data-view="calendar" role="tab" id="hpFinanceTabCalendar" aria-controls="hpFinanceCalendar">Mes dates</button></div><p id="hpFinanceStatus" class="finance-note" role="status" aria-live="polite">Chargement du budget…</p><details class="finance-load-options"><summary>Actualiser les données</summary><button type="button" class="alt" data-action="reload">Recharger</button></details><section id="hpFinanceScenario" class="finance-block finance-scenario" aria-labelledby="hpFinanceScenarioTitle" hidden></section><div id="hpFinanceOverview" role="tabpanel" aria-labelledby="hpFinanceTabOverview"></div><div id="hpFinanceEditor" role="tabpanel" aria-labelledby="hpFinanceTabPlan" hidden></div><div id="hpFinanceCalendar" role="tabpanel" aria-labelledby="hpFinanceTabCalendar" hidden></div>`;
    budget.querySelector('.row')?.after(box);
    box.addEventListener('click',onClick);box.addEventListener('input',onInput);box.addEventListener('change',onChange);
    box.addEventListener('keydown',event=>{const tab=event.target.closest('[role=tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...box.querySelectorAll('[role=tab]')];let i=tabs.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setView(tabs[i].dataset.view);tabs[i].focus()});
    setView(view);
  }
  function reset(){closeScenario();picker=null;simulationAmount=0;epoch++;owner=null;ready=false;dirty=false;revision=null;loading=false;saving=false;lastLoadedMonth=null;plan=E.empty();draft=E.empty();entries=[];legacy=null;lastResult=null;ensure();render();status('Connecte-toi pour retrouver ton budget privé.');}
  async function identity(){const {data,error}=await window.supabaseClient.auth.getSession();if(error)throw error;if(!data?.session?.user?.id)throw new Error('Connecte-toi pour accéder au budget.');return data.session}
  async function api(method,body){const session=await identity();if(owner&&session.user.id!==owner)throw new Error('La session a changé. Recharge le budget.');const r=await fetch('/api/budget-plan?month='+month,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Budget indisponible.');return data}
  async function load({force=false}={}){
    ensure();if(loading||saving)return;
    let session;try{session=await identity()}catch(error){status(error.message);return}
    if(owner!==session.user.id){reset();owner=session.user.id}
    if(force&&dirty&&!confirm('Recharger effacera tes modifications non enregistrées. Continuer?'))return;
    const stamp=epoch,requestedMonth=month;loading=true;status('Chargement…');
    try{
      const data=await api('GET');if(stamp!==epoch||requestedMonth!==month)return;
      const config=data.config?E.validate(data.config):E.empty();
      if(!dirty||force){plan=config;draft=structuredClone(config);revision=data.revision;dirty=false}
      entries=data.entries||[];entriesComplete=data.entries_complete!==false;legacy=data.legacy;ready=true;lastLoadedMonth=month;
      render(!dirty);status(dirty?'Modifications non enregistrées.':data.config?'Ton budget est enregistré.':'Commence par ajouter tes revenus et tes dépenses.');
    }catch(error){if(stamp===epoch){ready=false;status(error.name==='TimeoutError'?'Le chargement prend trop de temps. Réessaie.':error.message,true);render(false)}}
    finally{if(stamp===epoch){loading=false;updateScenario();if(requestedMonth!==month)load()}}
  }
  function preview(){try{return E.analyze(E.validate(draft),entries,month,today(),entriesComplete&&lastLoadedMonth===month)}catch{return null}}
  function tile(label,value,note='',primary=false,negative=false){return `<div class="finance-stat${primary?' primary':''}"><span>${label}</span><strong${negative?' class="finance-negative"':''}>${value}</strong>${note?`<div class="finance-note">${note}</div>`:''}</div>`}
  function render(rebuildEditor=true){
    ensure();if(!$('hpFinanceOverview'))return;
    lastResult=preview();renderOverview();renderCalendar();if(rebuildEditor)renderEditor();setView(view);updateScenario();
  }
  function renderOverview(){
    const host=$('hpFinanceOverview'),r=lastResult;if(!host)return;
    if(!ready){host.innerHTML='<div class="finance-block">Chargement de ton budget personnel. Tes montants apparaîtront ici.</div>';return}
    if(!r){host.innerHTML='<div class="finance-warning">Une ligne est à compléter. <button type="button" data-view="plan">Revenir à mes montants</button></div>';return}
    const info=I.analyze(draft,r),complete=r.complete,display=n=>complete?money(n):'À compléter';
    const count=draft.incomes.length+draft.bills.length+draft.envelopes.length+draft.provisions.length+draft.projects.length;
    if(!count){host.innerHTML=`<div class="finance-welcome"><span class="finance-eyebrow">MON BUDGET NUVABRI</span><h3>Où va mon argent?</h3><p>Ajoute ce que tu reçois et ce que tu paies. Nuvabri te montre ce qu’il reste et les points à préparer pour la suite.</p><button type="button" data-action="choose" data-kind="income">Commencer avec mes revenus</button><p class="finance-note">Salaire, allocations, retraite, logement, enfants, santé… Choisis seulement ce qui te concerne.</p></div>${advisorCard(r,info)}`;return}
    const marginMessage=!complete?'Vérifie tes montants pour obtenir ton bilan.':r.projectedMargin<0?'Les sorties prévues dépassent les revenus.':r.projectedMargin===0?'Tout ton revenu prévu est affecté ce mois-ci.':'Voici ta marge après les dépenses et les mises de côté prévues.';
    host.innerHTML=`${dirty?'<p class="finance-warning">Aperçu de tes modifications non enregistrées. <button type="button" class="alt" data-view="plan">Vérifier et enregistrer</button></p>':''}${!complete?'<div class="finance-warning">Ton budget est à compléter. <button type="button" data-view="plan">Vérifier mes montants</button></div>':''}<div class="finance-grid finance-balance">${tile(r.projectedMargin<0?'Ce qu’il manque ce mois-ci':'Ce qu’il reste ce mois-ci',display(Math.abs(r.projectedMargin)),marginMessage,true,complete&&r.projectedMargin<0)}${tile('Ce qui entre',display(r.totals.income),'Revenus nets prévus')}${tile('Ce qui sort / est réservé',display(info.outflow),'Dépenses + mises de côté')}</div><p class="finance-note">Prévision du mois sélectionné, pas ton solde bancaire. ${money(r.totals.provisions+r.totals.projects+info.savings)} sont prévus pour l’épargne et les réserves.</p><div class="finance-quick-actions"><button type="button" data-view="plan">Modifier mes montants</button><button type="button" class="alt" data-action="entry">Noter une opération</button></div><div class="finance-block"><h4>Ce que ton budget révèle</h4>${complete?`<p>${info.committedPercent===null?'Aucun revenu positif prévu pour calculer une proportion.':`Sur 100 $ de revenus, <b>${info.committedPercent.toLocaleString('fr-CA',{maximumFractionDigits:1})} $</b> sont affectés aux dépenses et mises de côté.`}</p>`:''}${complete&&info.allocations.length?`<div class="finance-action"><b>Ton poste principal : ${esc(info.allocations[0].category)}</b><p>${money(info.allocations[0].amount)}, soit ${(info.allocations[0].amount/info.outflow*100).toLocaleString('fr-CA',{maximumFractionDigits:1})} % des sorties prévues. Ouvre « Où va mon argent? » pour voir les autres postes.</p></div>`:''}${r.actions.slice(0,2).map(a=>`<div class="finance-action"><b>${esc(a.title)}</b><p>${esc(a.body)}</p></div>`).join('')}</div>${advisorCard(r,info)}<details class="finance-analysis"><summary>Où va mon argent?</summary><p class="finance-note">Répartition de toutes les sorties prévues, réserves comprises. Les catégories déjà enregistrées sont conservées.</p>${info.allocations.length?info.allocations.map(x=>`<div class="finance-allocation"><div class="finance-row-head"><span>${esc(x.category)}</span><b>${money(x.amount)}</b></div><meter min="0" max="${info.outflow}" value="${x.amount}" aria-label="${esc(x.category)} : ${money(x.amount)}"></meter><span class="finance-note">${(x.amount/info.outflow*100).toLocaleString('fr-CA',{maximumFractionDigits:1})} % des sorties prévues</span></div>`).join(''):'<p>Ajoute tes dépenses pour voir leur répartition.</p>'}${info.debts?`<p class="finance-note">${money(info.debts)} de remboursements de dettes identifiés ce mois. Vérifie les anciens postes classés ailleurs : ils restent inclus dans leur catégorie.</p>`:''}</details><details class="finance-analysis"><summary>Et si je changeais une habitude?</summary><p>Essaie une réduction de tes dépenses courantes marquées non essentielles.</p><p class="finance-note">Base déclarée : ${money(info.adjustable)}/mois. Tu choisis les dépenses essentielles dans les options de chaque ligne.</p><label for="hpFinanceSimulation">Réduction envisagée par mois ($)</label><input id="hpFinanceSimulation" data-simulation="amount" type="number" inputmode="decimal" min="0" max="${info.adjustable/100}" step="0.01" value="${simulationAmount}" ${!complete||!info.adjustable?'disabled':''}><div id="hpFinanceSimulationResult" aria-live="polite"></div><p class="finance-note">Simulation seulement : aucune dépense modifiée, aucun rendement supposé. Le résultat sur un an suppose la même réduction pendant 12 mois.</p></details><details class="finance-analysis"><summary>Mes dépenses enregistrées face au budget</summary><p class="finance-note">Montants saisis, hors dates futures. Aucun compte bancaire connecté; vérifie avec tes relevés.</p>${r.actual?`<p>Revenus enregistrés : <b>${money(r.actual.income)}</b> · Dépenses enregistrées : <b>${money(r.actual.expense)}</b></p>${comparison(r)}`:'<p role="alert">Les opérations n’ont pas toutes été chargées. Aucun total partiel n’est présenté.</p>'}<button type="button" class="alt" data-action="entry">Noter une opération</button></details><details class="finance-analysis"><summary>Avant ma prochaine rentrée d’argent</summary>${r.cash?`<div class="finance-stat primary"><span>Disponible estimé jusqu’au ${dateLabel(r.cash.nextPay)}, avant le versement</span><strong class="${r.cash.available<0?'finance-negative':''}">${money(r.cash.available)}</strong></div><p class="finance-note">Solde déclaré ${money(r.cash.balance)} − paiements ${money(r.cash.bills)} − dépenses courantes estimées ${money(r.cash.flexible)} − réserves ${money(r.cash.reserve)}.</p>`:'<p>Ajoute un solde vérifié aujourd’hui et tes dates de revenus pour calculer cette estimation.</p><button type="button" class="alt" data-action="cash">Ajouter mon solde</button>'}<p class="finance-note">Calcul à partir de demain. Les paiements d’aujourd’hui doivent déjà être déduits du solde. Les paiements du jour de paie sont déduits avant le versement. Vérifie les dates si elles tombent un jour férié.</p></details><details class="finance-analysis"><summary>Mon coussin et mes projets</summary><h4>Mon coussin de sécurité</h4><p>${r.emergencyMonths!==null&&complete?`L’épargne de secours déclarée couvre environ <b>${r.emergencyMonths.toLocaleString('fr-CA',{maximumFractionDigits:1})} mois</b> de dépenses marquées essentielles.`:'Ajoute ton épargne de secours et vérifie les dépenses essentielles pour estimer la durée couverte.'}</p><p class="finance-note">Cette durée ne détermine pas tes besoins d’assurance.</p>${projectCards(r)}</details><p class="finance-note">Pour préparer tes chiffres : <a href="https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/faire-budget.html" target="_blank" rel="noopener">guide budgétaire de l’Agence de la consommation en matière financière du Canada</a>.</p>`;
    renderSimulation();
  }
  function advisorCard(r,info){
    return `<div class="finance-advisor"><span class="finance-eyebrow">LA SUITE, AVEC TON CONSEILLER NUVABRI</span><h4>Transforme ton bilan en prochaines étapes.</h4><p>${!r.complete?'Un portrait plus clair peut t’aider à préparer une première discussion.':r.projectedMargin<0?'Ton budget prévoit un manque de '+money(-r.projectedMargin)+'. Une discussion peut t’aider à clarifier tes priorités.':r.projectedMargin>0?'Tu prévois une marge de '+money(r.projectedMargin)+'. Quels projets aimerais-tu faire avancer?':'Ton budget utilise tout ton revenu prévu. Parlons de la place à donner aux imprévus et à tes objectifs.'}</p><ul>${info.questions.slice(0,2).map(q=>`<li>${esc(q)}</li>`).join('')}</ul><button type="button" data-action="advisor">Contacter mon conseiller Nuvabri</button><button type="button" class="alt" data-action="summary">Préparer mon résumé</button><p class="finance-note">Guillaume-Alexandre Tremblay · Conseiller en sécurité financière. Tu choisis les informations à partager.</p><div id="hpFinanceSummary" hidden><label for="hpFinanceSummaryText">Mon résumé à relire avant de le partager</label><textarea id="hpFinanceSummaryText" readonly></textarea><button type="button" class="alt" data-action="copy">Copier mon résumé</button></div></div>`;
  }
  function renderSimulation(){
    const host=$('hpFinanceSimulationResult');if(!host||!lastResult)return;
    const info=I.analyze(draft,lastResult),cents=simulationAmount===null?NaN:simulationAmount*100;
    const r=I.simulate(lastResult,info,Math.abs(cents-Math.round(cents))<0.0001?Math.round(cents):NaN);
    host.innerHTML=r?`<p>Nouvelle marge prévue : <b>${money(r.margin)}</b>.</p><p><b>${money(r.yearly)}</b> libérés sur un an si tu maintiens cette réduction.</p>`:`<p class="finance-note">${!lastResult.complete?'Complète ton budget avant de simuler un changement.':!info.adjustable?'Ajoute une dépense courante et ajuste son choix « essentielle » pour explorer un changement.':'Entre un montant entre 0 et '+money(info.adjustable)+', avec au plus deux décimales.'}</p>`;
  }
  function comparison(r){
    if(!r.categories.length)return '<p>Aucun poste pour ce mois. Commence avec tes dépenses habituelles.</p>';
    return `<div class="finance-table-wrap"><table><thead><tr><th scope="col">Catégorie</th><th scope="col">Prévu</th><th scope="col">Enregistré</th><th scope="col">Écart*</th></tr></thead><tbody>${r.categories.map(x=>`<tr><th scope="row">${esc(x.category)}${x.provision?'<div class="finance-note">Réserve à part</div>':''}</th><td>${x.planned===null?'Non défini':money(x.planned)}</td><td>${money(x.actual)}</td><td>${x.planned===null||x.provision?'—':money(x.planned-x.actual)}</td></tr>`).join('')}</tbody></table></div><p class="finance-note">* Prévu moins enregistré. Un écart positif n’est pas de l’argent disponible. Les provisions sont de l’argent réservé, pas une dépense additionnelle. Une dépense annuelle ou ponctuelle est à comparer à sa réserve.</p>`;
  }
  function renderCalendar(){
    const host=$('hpFinanceCalendar'),r=lastResult;if(!host)return;
    if(!ready||!r){host.innerHTML='<p>Complète ou recharge ton plan pour afficher les dates.</p>';return}
    host.innerHTML=`<div class="finance-block"><h4>Calendrier prévu</h4><p class="finance-note">Dates théoriques de ton plan, pas des paiements confirmés. Les enveloppes courantes sont réparties dans l’estimation, sans fausses dates de facturation.</p>${r.calendar.length?r.calendar.map(x=>`<div class="finance-row"><div class="finance-date">${dateLabel(x.date)} · ${x.kind==='income'?'Revenu':x.kind==='annual'?'Dépense annuelle':x.kind==='project'?'Projet ponctuel':'Charge'}</div><div class="finance-row-head"><strong>${esc(x.label)}</strong><span>${x.kind==='income'?'+':'−'} ${money(x.amount)}</span></div>${['annual','project'].includes(x.kind)?`<div class="finance-note">${money(x.unfunded)} non couvert par le montant déjà réservé déclaré.</div>`:''}</div>`).join(''):'<p>Aucune échéance définie pour ce mois.</p>'}</div><div class="finance-block"><h4>Mes provisions annuelles</h4>${r.provisions.length?r.provisions.map(x=>`<div class="finance-row"><b>${esc(x.label)}</b><p>${money(E.cents(x.annualAmount))} · échéance ${dateLabel(x.dueDate)}</p><div class="finance-note">Moyenne annuelle : ${money(x.monthly)}/mois. Déjà réservé : ${money(E.cents(x.savedAmount))}. À réserver ce mois : ${money(x.recommended)}.</div>${x.overdue?'<p class="finance-negative">Date passée : actualise cette provision.</p>':''}</div>`).join(''):'<p>Ajoute tes taxes, immatriculations ou dépenses saisonnières dans « Mes montants ».</p>'}</div>${projectCards(r)}`;
  }
  function input(path,label,value,type='text',extra=''){
    const id='hf-'+path.replaceAll('.','-');return `<label for="${id}">${label}</label><input id="${id}" data-field="${path}" type="${type}" value="${esc(value??'')}" ${type==='number'?`${extra.includes('step=')?'':'step="0.01"'} inputmode="decimal"`:''} ${extra}>`;
  }
  function checkbox(path,label,value){return `<label class="finance-check"><input id="hf-${path.replaceAll('.','-')}" type="checkbox" data-field="${path}" ${value?'checked':''}><span>${label}</span></label>`}
  function select(path,label,value,options){const id='hf-'+path.replaceAll('.','-');return `<label for="${id}">${label}</label><select id="${id}" data-field="${path}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`}
  function savingsField(key,x,i){
    if(!['bills','envelopes'].includes(key)||!I.registeredCategory(x.category))return '';
    return `${input(key+'.'+i+'.accountBalance','Solde de départ de ce compte ($) — facultatif',x.accountBalance,'number','min="0"')}<p class="finance-note">Entre le montant déjà accumulé, avant les cotisations de la projection. Laisse vide si tu ne le connais pas.</p>`;
  }
  function annualCaption(key,x){
    if(!['bills','envelopes'].includes(key)||!I.registeredCategory(x.category))return '';
    const value=I.savingProjection(x,key).contributions;return value===null?'':' · '+money(value)+' / an';
  }
  function renderSavingsAnnual(){
    const host=$('hpFinanceSavingsAnnual');if(!host)return;
    const accounts=I.annualSavings(draft);host.hidden=!accounts.length;
    if(!accounts.length){host.innerHTML='';return}
    const amount=value=>value===null?'À compléter':money(value);
    const legacy=draft.bills.concat(draft.envelopes).some(x=>x.category==='Épargne'&&/REER|CELI/i.test(x.label));
    host.innerHTML=`<h4>Mon REER et mon CELI sur un an</h4><p class="finance-note">Au rythme choisi, sur 12 mois complets. Ces montants ne correspondent pas au reste de l’année civile.</p><div class="finance-saving-grid">${accounts.map(x=>`<div class="finance-saving-account"><h5>${x.category}${x.accounts>1?' · '+x.accounts+' lignes':''}</h5><span>Cotisations estimées sur un an</span><strong>${amount(x.contributions)}</strong><dl><div><dt>Solde de départ</dt><dd>${x.startingBalance===null?'Non renseigné':money(x.startingBalance)}</dd></div><div><dt>Solde estimé après un an</dt><dd>${x.projectedBalance===null?'À compléter':money(x.projectedBalance)}</dd></div></dl>${x.startingBalance===null?'<p class="finance-note">Ajoute le solde de départ dans chaque ligne pour estimer le total accumulé.</p>':''}</div>`).join('')}</div><p class="finance-note">52 cotisations pour une fréquence hebdomadaire, 26 aux deux semaines, 24 deux fois par mois ou 12 mensuelles. Un versement unique est compté une seule fois. Le budget mensuel conserve les dates réelles des cotisations.</p><p class="finance-note">Solde estimé = solde de départ + cotisations. Sans rendement, frais, retraits ni effet fiscal. Les cotisations sont déjà incluses dans « Ce qui sort ».</p>${legacy?'<p class="finance-warning">Un ancien poste regroupe REER et CELI. Répartis son montant dans les nouvelles lignes et retire le poste groupé pour éviter de compter deux fois la même épargne.</p>':''}`;
  }
  function editorRow(key,x,i){
    if(key==='projects')return projectRow(x,i);
    const p=key+'.'+i,annual=key==='provisions',envelope=key==='envelopes',income=key==='incomes';
    const categories=[...new Set([...CATS,x.category])].map(c=>[c,c]);
    const amount=annual?x.annualAmount:x.amount;
    const caption=(amount===null?'Montant à compléter':money(E.cents(amount))+' · '+(annual?'par année':envelope?'par mois':FREQ[x.frequency]))+annualCaption(key,x);
    return `<details class="finance-edit-row" data-budget-row="${p}"><summary><span id="hf-title-${key}-${i}">${esc(x.label||'Nouvelle ligne')}</span><small id="hf-caption-${key}-${i}">${esc(caption)}</small></summary>${input(p+'.label',income?'Nom du revenu':I.registeredCategory(x.category)?'Nom du compte':'Nom de la dépense',x.label,'text','maxlength="120"')}${annual?`${input(p+'.annualAmount','Montant à payer dans l’année ($)',x.annualAmount,'number','min="0"')}${input(p+'.dueDate','Prochaine date de paiement',x.dueDate,'date')}${input(p+'.savedAmount','Déjà mis de côté pour cette dépense ($)',x.savedAmount,'number','min="0"')}`:`${input(p+'.amount',envelope?'Total à prévoir par mois ($)':income?'Montant net reçu chaque fois ($)':I.registeredCategory(x.category)?'Montant de chaque cotisation ($)':'Montant payé chaque fois ($)',x.amount,'number','min="0"')}${!envelope?`${select(p+'.frequency','À quelle fréquence?',x.frequency,Object.entries(FREQ))}${input(p+'.anchorDate',income?'Une date où tu reçois ce revenu':I.registeredCategory(x.category)?'Une date de cotisation connue':'Une date où tu paies cette facture',x.anchorDate,'date')}<div ${x.frequency==='semimonthly'?'':'hidden'} data-second="${p}">${input(p+'.secondDay','Deuxième jour du mois (31 = dernier jour)',x.secondDay,'number','min="1" max="31" step="1"')}</div>`:'<p class="finance-note">Une estimation pour les achats du mois, sans date de paiement précise.</p>'}`}<div id="hpFinanceSavingsField-${key}-${i}">${savingsField(key,x,i)}</div>${I.savingsCategory(x.category)?'<p class="finance-note">Cette mise de côté réduit ta marge prévue. Ne compte pas à nouveau un montant déjà prévu pour un projet ou une dépense annuelle.</p>':''}${x.category==='Revenus locatifs'?'<p class="finance-note">Si tu inscris le loyer reçu en entier, ajoute aussi les dépenses locatives. Si tu inscris un revenu net, ne déduis pas ces frais une deuxième fois.</p>':''}<details><summary>Catégorie et options</summary>${select(p+'.category','Catégorie',x.category,categories)}${!income?checkbox(p+'.essential','Cette dépense est essentielle pour moi.',x.essential):''}</details><button type="button" class="finance-remove" data-action="remove" data-list="${key}" data-index="${i}">Retirer cette ligne</button></details>`;
  }
  function projectNote(x){
    if(!E.validDate(x.dueDate)||typeof x.totalAmount!=='number'||typeof x.savedAmount!=='number'||!Number.isFinite(x.totalAmount)||!Number.isFinite(x.savedAmount)||x.totalAmount<0||x.savedAmount<0||x.savedAmount>x.totalAmount)return 'Indique le coût total, le montant déjà réservé et la date pour calculer ton effort mensuel.';
    const r=E.projectFunding(x,today());
    if(x.active===false)return 'Projet clôturé : aucun montant supplémentaire à réserver.';
    if(!r.remaining)return 'Le coût prévu est entièrement couvert par le montant réservé déclaré.';
    if(r.overdue)return `${money(r.remaining)} restent à financer. La date est passée : actualise le projet.`;
    return `${money(r.remaining)} restent à financer : ${money(r.monthly)} par mois pendant ${r.months} mois, mois actuel et mois d’échéance inclus. Aucun rendement ni hausse de prix supposé.`;
  }
  function projectRow(x,i){
    const p='projects.'+i;
    return `<div class="finance-edit-row" id="hpFinanceProject-${i}">${x.propertyName?`<p class="finance-note">Bien associé : ${esc(x.propertyName)}</p>`:''}${x.taskKey?'<p class="finance-note">Issu d’une échéance d’entretien. Ce projet reste personnel; les modifications de la tâche ne changent pas automatiquement le budget.</p>':''}${input(p+'.label','Entretien ou remplacement prévu',x.label,'text','maxlength="120"')}${input(p+'.totalAmount','Coût total prévu, taxes incluses ($)',x.totalAmount,'number','min="0"')}${select(p+'.costSource','Origine du montant',x.costSource,[['estimate','Mon estimation — à vérifier'],['quote','Une soumission obtenue']])}${input(p+'.savedAmount','Déjà réservé pour ce projet, hors solde disponible ($)',x.savedAmount,'number','min="0"')}${input(p+'.dueDate','Date prévue de la dépense — à confirmer',x.dueDate,'date')}<p class="finance-project-funding" id="hpFinanceProjectFunding-${i}" aria-live="polite">${esc(projectNote(x))}</p>${checkbox(p+'.confirmed','J’ai vérifié le montant et l’échéance. Cette dépense n’est pas déjà prévue dans une charge, une enveloppe ou une provision.',x.confirmed)}${checkbox(p+'.active','Ce projet est encore à préparer ou à payer.',x.active!==false)}<p class="finance-note">Décoche ce dernier choix pour clôturer le projet après paiement ou annulation. Aucune transaction ni mise de côté réelle n’est créée.</p><button type="button" class="finance-remove" data-action="remove" data-list="projects" data-index="${i}">Retirer ce projet du plan</button></div>`;
  }
  function projectCards(r){
    return `<div class="finance-block"><h4>Mes entretiens et remplacements</h4><p class="finance-note">Coûts déclarés, à vérifier. Les montants restent privés, même si la propriété est partagée.</p>${r.projects.length?r.projects.map((x,i)=>`<div class="finance-row"><b>${esc(x.label)}</b>${x.propertyName?`<div class="finance-note">${esc(x.propertyName)}</div>`:''}<p>${money(E.cents(x.totalAmount))} · ${dateLabel(x.dueDate)} · ${x.costSource==='quote'?'Soumission déclarée':'Estimation personnelle'}</p><p>${esc(projectNote(x))}</p><button type="button" class="alt" data-action="edit-project" data-index="${i}">Modifier ce projet</button>${x.active?`<button type="button" class="alt" data-action="scenario-open" data-project-id="${esc(x.id)}">Comparer un scénario</button>`:''}</div>`).join(''):'<p>Depuis une tâche, choisis « Prévoir le coût ». Tu peux aussi préparer un remplacement directement ici.</p>'}<button type="button" class="alt" data-action="add" data-list="projects">+ Prévoir une dépense</button></div>`;
  }
  function pickerHTML(){
    if(!picker)return '';
    const list=C.templates.filter(t=>picker==='income'?t.key==='incomes':t.key!=='incomes');
    const families=[...new Set(list.map(t=>t.family))];
    return `<div class="finance-picker" id="hpFinancePicker"><h4>${picker==='income'?'Quel revenu veux-tu ajouter?':'Quelle dépense veux-tu prévoir?'}</h4><label for="hpFinanceTemplate">Choisis ce qui te concerne</label><select id="hpFinanceTemplate">${families.map(f=>`<optgroup label="${esc(f)}">${list.filter(t=>t.family===f).map(t=>`<option value="${t.id}">${esc(t.label)}${t.key==='provisions'?' — à mettre de côté':t.key==='envelopes'?' — total mensuel':''}</option>`).join('')}</optgroup>`).join('')}</select><p class="finance-note">Tu pourras modifier le nom, le montant et la fréquence. Rien n’est ajouté sans ton choix.</p><div class="finance-quick-actions"><button type="button" data-action="template">Ajouter ce poste</button><button type="button" class="alt" data-action="picker-close">Fermer</button></div><details><summary>Créer mon propre poste</summary><button type="button" class="alt" data-action="add" data-list="${picker==='income'?'incomes':'bills'}">${picker==='income'?'Autre revenu':'Autre paiement avec une date'}</button>${picker==='expense'?'<button type="button" class="alt" data-action="add" data-list="envelopes">Autre total de dépenses par mois</button>':''}</details></div>`;
  }
  const EXPENSE_SUGGESTIONS=[['rent','Loyer'],['mortgage','Hypothèque'],['hydro','Électricité / chauffage'],['phone','Téléphone'],['internet','Internet'],['subscriptions','Télé / abonnements'],['home-insurance','Assurance habitation'],['car-insurance','Assurance automobile'],['life-insurance','Assurance vie / invalidité'],['food','Épicerie'],['fuel','Essence / recharge'],['daycare','Garderie'],['rrsp','REER'],['tfsa','CELI']];
  function existingSuggestion(t){return draft[t.key].findIndex(x=>t.key==='envelopes'?x.category===t.category:x.label===t.label&&x.category===t.category)}
  function expenseSuggestions(){
    return `<div class="finance-suggestions"><h5>Dépenses fréquentes</h5><p class="finance-note">Touche une dépense pour remplir son montant. Choisis seulement celles qui te concernent.</p><div class="finance-suggestion-grid">${EXPENSE_SUGGESTIONS.map(([id,label])=>{const t=C.templates.find(x=>x.id===id),exists=existingSuggestion(t)>=0;return `<button type="button" class="alt finance-suggestion" data-action="suggest-expense" data-template="${id}"><span>${esc(label)}</span><small>${exists?'Déjà ajoutée · modifier':'+ Ajouter un montant'}</small></button>`}).join('')}</div></div>`;
  }
  function openExpenseSuggestion(id){
    if(!ready||loading||saving)return;
    const t=C.templates.find(x=>x.id===id);if(!t||!EXPENSE_SUGGESTIONS.some(x=>x[0]===id))return;
    closeScenario();picker=null;setView('plan');const index=existingSuggestion(t);
    if(index<0)return addTemplate(id);
    renderEditor();focusRow(t.key,index);status('Cette dépense est déjà prévue. Tu peux ajuster son montant.');
  }
  function renderEditor(){
    const host=$('hpFinanceEditor');if(!host)return;if(!ready){host.innerHTML='<p>Recharge ton budget avant de le modifier.</p>';return}
    const rows=key=>draft[key].map((x,i)=>editorRow(key,x,i)).join('');
    host.innerHTML=`<p class="finance-note">Ajoute seulement ce qui te concerne. Utilise tes montants nets et ta part des dépenses du foyer.</p>${!revision&&legacy&&(legacy.targets.length||legacy.bills.length)?'<div class="finance-warning">Tu as déjà des montants enregistrés. <button type="button" class="alt" data-action="import">Reprendre mes montants existants</button><p>Vérifie les doublons avant de sauvegarder.</p></div>':''}${pickerHTML()}<section class="finance-block"><div class="finance-section-title"><span class="finance-step">1</span><h4>Ce qui entre</h4></div><p class="finance-note">Salaire, allocations, revenus autonomes, retraite…</p>${rows('incomes')||'<p>Aucun revenu ajouté pour le moment.</p>'}<button type="button" class="alt" data-action="choose" data-kind="income">+ Ajouter un revenu</button></section><section class="finance-block"><div class="finance-section-title"><span class="finance-step">2</span><h4>Ce qui sort</h4></div>${expenseSuggestions()}${rows('bills')}${rows('envelopes')}${!draft.bills.length&&!draft.envelopes.length?'<p>Commence par ton logement, ton épicerie et ton transport.</p>':''}<button type="button" class="alt" data-action="choose" data-kind="expense">+ Autre dépense ou épargne</button><div id="hpFinanceSavingsAnnual" class="finance-saving-summary" aria-live="polite" hidden></div></section><details id="hpFinanceAnnual"><summary>Dépenses à préparer dans l’année · ${draft.provisions.length}</summary><p class="finance-note">Taxes, permis, vacances… Nuvabri calcule une réserve mensuelle. N’ajoute pas le même paiement dans tes dépenses habituelles.</p>${rows('provisions')}<button type="button" class="alt" data-action="choose" data-kind="expense">+ Choisir une dépense</button><button type="button" class="alt" data-action="add" data-list="provisions">Autre dépense annuelle</button></details><details><summary>Entretiens et remplacements · ${draft.projects.length}</summary><p class="finance-note">Pour un coût ponctuel, avec une date et un montant à préparer.</p>${rows('projects')}<button type="button" class="alt" data-action="add" data-list="projects">+ Prévoir un projet</button></details><details id="hpFinanceCash"><summary>Mon solde et mon coussin — facultatif</summary><p class="finance-note">Montant disponible pour payer, sans l’argent déjà réservé. Vérifie le solde à la date indiquée.</p>${input('cash.balance','Solde disponible aujourd’hui ($)',draft.cash.balance,'number')}${input('cash.asOf','Date de vérification',draft.cash.asOf,'date')}${checkbox('cash.todaySettled','Les paiements de cette journée sont déjà déduits.',draft.cash.todaySettled)}${input('emergencySavings','Épargne disponible pour les imprévus ($)',draft.emergencySavings,'number','min="0"')}<p class="finance-note">Laisse vide si tu ne connais pas ce montant. Une limite de crédit n’est pas de l’épargne.</p></details><details><summary>Éviter de compter deux fois la même somme</summary><p class="finance-note">Si tu as inscrit tes achats par carte, ne les ajoute pas au remboursement de la carte. Indique seulement le remboursement d’une ancienne dette en plus. Un virement entre comptes n’est pas un revenu. Les prêts, rappels et objectifs des outils détaillés ne sont pas ajoutés automatiquement à ce plan.</p></details>${checkbox('reviewed','J’ai vérifié mes revenus et dépenses. Les postes que je n’ai pas ajoutés ne s’appliquent pas à mon budget.',draft.reviewed)}<div class="finance-savebar"><p id="hpFinanceSaveStatus" class="finance-note" tabindex="-1" role="status" aria-live="polite"></p><button type="button" data-action="save" ${saving?'disabled':''}>${saving?'Enregistrement…':'Enregistrer et voir mon bilan'}</button><div class="finance-note" id="hpFinanceDirty">${dirty?'Modifications non enregistrées.':'Budget personnel enregistré dans ton compte.'}</div></div>`;
    renderSavingsAnnual();status(statusMessage,statusError);
  }
  function focusRow(key,index,field='amount'){
    const el=$('hf-'+key+'-'+index+'-'+field)||$('hf-'+key+'-'+index+'-label');
    let details=el?.closest('details');while(details){details.setAttribute('open','');details=details.parentElement?.closest('details')}
    el?.scrollIntoView?.({block:'center'});el?.focus();
  }
  function addTemplate(id){
    if(!ready||saving||loading)return;
    const choice=C.create(id,crypto.randomUUID(),today());if(!choice)return;
    const {key,row}=choice;
    if(draft[key].length>=100){status('Ce groupe contient déjà 100 lignes.',true);return}
    // An envelope is a category total. Reopen it rather than duplicating it.
    const existing=key==='envelopes'?draft.envelopes.findIndex(x=>x.category===row.category):-1;
    picker=null;
    if(existing>=0){renderEditor();focusRow(key,existing);status('Ce total mensuel existe déjà. Ajuste son montant pour inclure tous les achats de cette catégorie.');return}
    draft[key].push(row);dirty=true;draft.reviewed=false;render();setView('plan');
    focusRow(key,draft[key].length-1,key==='provisions'?'annualAmount':'amount');status('Poste ajouté. Complète le montant et vérifie la fréquence ou la date avant d’enregistrer.');
  }
  function setView(next){view=next;const map={overview:'hpFinanceOverview',plan:'hpFinanceEditor',calendar:'hpFinanceCalendar'};for(const [key,id] of Object.entries(map))if($(id))$(id).hidden=key!==view;document.querySelectorAll('#hpBudgetPlanner [data-view]').forEach(b=>{if(b.getAttribute('role')==='tab'){b.setAttribute('aria-selected',String(b.dataset.view===view));b.tabIndex=b.dataset.view===view?0:-1}})}
  function onInput(event){
    if(event.target.dataset.scenarioField)return scenarioInput(event);
    if(event.target.dataset.simulation){simulationAmount=event.target.value===''?null:Number(event.target.value);renderSimulation();return}
    const field=event.target.dataset.field;if(!field||saving)return;closeScenario();const parts=field.split('.');let target=draft;for(const key of parts.slice(0,-1))target=target[key];const key=parts.at(-1),el=event.target;
    target[key]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;
    if(parts[0]==='projects'){
      if(['totalAmount','savedAmount','dueDate','costSource'].includes(key)){target.confirmed=false;const check=$('hf-projects-'+parts[1]+'-confirmed');if(check)check.checked=false}
      const note=$('hpFinanceProjectFunding-'+parts[1]);if(note)note.textContent=projectNote(target);
    }
    dirty=true;if($('hpFinanceDirty'))$('hpFinanceDirty').textContent='Modifications non enregistrées.';status('Modifications non enregistrées.');
    if(key==='frequency'){const p=parts.slice(0,-1).join('.'),second=document.querySelector(`[data-second="${p}"]`);if(second)second.hidden=el.value!=='semimonthly'}
    const title=$('hf-title-'+parts[0]+'-'+parts[1]),caption=$('hf-caption-'+parts[0]+'-'+parts[1]);if(title)title.textContent=target.label||'Nouvelle ligne';if(caption){const value=parts[0]==='provisions'?target.annualAmount:target.amount;caption.textContent=value===null?'Montant à compléter':money(E.cents(value))+' · '+(parts[0]==='provisions'?'par année':parts[0]==='envelopes'?'par mois':FREQ[target.frequency])+annualCaption(parts[0],target)}
    if(key==='category'){const host=$('hpFinanceSavingsField-'+parts[0]+'-'+parts[1]);if(host)host.innerHTML=savingsField(parts[0],target,parts[1])}
    renderSavingsAnnual();lastResult=preview();renderOverview();renderCalendar();
  }
  function onChange(event){if(event.target.dataset.field||event.target.dataset.scenarioField||event.target.dataset.simulation)return onInput(event);if(event.target.id==='hpFinanceMonth'){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value)){event.target.value=month;return}month=event.target.value;lastResult=preview();renderOverview();renderCalendar();load()}}
  async function save(){
    if(saving)return;if(!ready){saveProblem('Le budget n’est pas chargé. Utilise Recharger avant de sauvegarder.');return}if(loading){saveProblem('Attends la fin du chargement avant de sauvegarder.');return}let config;try{config=E.validate(draft)}catch(error){saveProblem(error.message);return}
    saving=true;const stamp=epoch,key='finance-plan:'+owner;
    const body={config,expected_revision:revision};body.request_id=hpStability.operation(key,body);
    document.querySelectorAll('#hpFinanceEditor input,#hpFinanceEditor select,#hpFinanceEditor button').forEach(el=>el.disabled=true);status('Enregistrement…');
    try{const result=await api('PUT',body);if(stamp!==epoch)return;plan=result.config;draft=structuredClone(plan);revision=result.revision;dirty=false;hpStability.complete(key);setView('overview');status('Plan enregistré dans ton compte.');}
    catch(error){if(stamp===epoch)status(error.name==='TimeoutError'?'Confirmation non reçue. Réessaie sans modifier le plan : la même demande sera reconnue.':error.message,true)}
    finally{if(stamp===epoch){saving=false;render();if(lastLoadedMonth!==month)load()}}
  }
  function add(key){if(!ready||saving||loading||!Array.isArray(draft[key]))return;if(draft[key].length>=100){status('Ce groupe contient déjà 100 lignes.',true);return}picker=null;setView('plan');const x={id:crypto.randomUUID(),label:'',category:key==='incomes'?'Salaire':'Autre',essential:key!=='incomes'};if(key==='projects')Object.assign(x,{taskKey:null,propertyName:null,totalAmount:null,savedAmount:0,dueDate:'',costSource:'estimate',confirmed:false,active:true,essential:false});else if(key==='provisions')Object.assign(x,{annualAmount:null,savedAmount:null,dueDate:''});else {x.amount=null;if(key!=='envelopes')Object.assign(x,{frequency:'monthly',anchorDate:today(),secondDay:null})}draft[key].push(x);dirty=true;draft.reviewed=false;renderEditor();focusRow(key,draft[key].length-1,'label');lastResult=preview();renderOverview();renderCalendar()}
  function importLegacy(){
    if(!legacy||!confirm('Reprendre tes anciennes cibles et tes rappels? Les lignes déjà ajoutées seront conservées. Vérifie les doublons avant d’enregistrer.'))return;
    let skipped=0;
    for(const x of legacy.bills){const id='recurring-'+x.id;if(draft.bills.some(b=>b.id===id))continue;if(x.amount===null||!FREQ[x.frequency]||!E.validDate(x.next_due_date)){skipped++;continue}draft.bills.push({id,label:x.name,category:x.category||'Autre',amount:Number(x.amount),frequency:x.frequency,anchorDate:x.next_due_date,secondDay:null,essential:true})}
    const start=month+'-01',end=E.monthEnd(month);
    for(const x of legacy.targets){if(draft.envelopes.some(b=>b.category===x.category))continue;const fixed=draft.bills.filter(b=>b.category===x.category).reduce((n,b)=>n+E.occurrences(b,start,end).length*b.amount,0);draft.envelopes.push({id:'target-'+x.id,label:x.category,category:x.category,amount:Math.round(Math.max(0,Number(x.monthly_target)-fixed)*100)/100,essential:true})}
    dirty=true;draft.reviewed=false;render();status('Montants repris : vérifie chaque ligne avant de sauvegarder.'+(skipped?' Certains rappels incomplets n’ont pas été repris.':''));
  }
  function summary(){const r=lastResult,info=I.analyze(draft,r),accounts=I.annualSavings(draft);return `MON BUDGET PERSONNEL — ${month}\n${dirty?'BROUILLON NON ENREGISTRÉ\n':''}${r.complete?'Plan déclaré vérifié':'PLAN INCOMPLET'}\nRevenus prévus : ${money(r.totals.income)}\nCharges et dépenses courantes : ${money(r.totals.bills+r.totals.flexible)}\nProvisions annuelles : ${money(r.totals.provisions)}\nEntretiens et remplacements à réserver : ${money(r.totals.projects)}\nMarge prévue : ${r.complete?money(r.projectedMargin):'À compléter'}\nDépenses enregistrées : ${r.actual?money(r.actual.expense):'Indisponible'}\n\nENTRETIENS ET REMPLACEMENTS\n${r.projects.filter(x=>x.active).map(x=>'- '+x.label+' : '+money(E.cents(x.totalAmount))+' le '+x.dueDate+'; reste à financer '+money(x.remaining)).join('\n')||'Aucun projet actif.'}\n\nPRINCIPAUX POSTES (réserves comprises)\n${info.allocations.slice(0,5).map(x=>'- '+x.category+' : '+money(x.amount)).join('\n')}\n\nREER ET CELI — PROJECTION SUR UN AN\n${accounts.map(x=>'- '+x.category+' : '+(x.contributions===null?'cotisations à compléter':money(x.contributions)+' de cotisations')+'; solde estimé après un an : '+(x.projectedBalance===null?'solde de départ à renseigner':money(x.projectedBalance))).join('\n')||'Aucune cotisation REER ou CELI distincte renseignée.'}\nRythme constant sur 12 mois (52 semaines); sans rendement, frais, retrait ni effet fiscal.\n\nMES QUESTIONS POUR LE CONSEILLER NUVABRI\n${info.questions.map(x=>'- '+x).join('\n')}\n\nPOINTS À DISCUTER\n${r.actions.map(a=>'- '+a.title+' : '+a.body).join('\n')}\n\nDonnées déclarées, sans connexion bancaire. Ce résumé n’est pas une analyse des besoins d’assurance ni une recommandation de placement. Aucun envoi automatique.`}
  async function onClick(event){
    const b=event.target.closest('button');if(!b||!$('hpBudgetPlanner').contains(b))return;
    if(b.dataset.view){closeScenario();setView(b.dataset.view);return}
    const action=b.dataset.action;if(saving&&!['advisor','copy','summary'].includes(action))return;
    if(action==='entry')return window.hpOpenBudgetEntry?.();
    if(action==='suggest-expense')return openExpenseSuggestion(b.dataset.template);
    if(action==='choose'){if(!ready||loading)return;closeScenario();picker=b.dataset.kind;setView('plan');renderEditor();$('hpFinanceTemplate')?.focus();$('hpFinancePicker')?.scrollIntoView?.({block:'start'});return}
    if(action==='picker-close'){picker=null;return renderEditor()}
    if(action==='template'){closeScenario();return addTemplate($('hpFinanceTemplate')?.value)}
    if(action==='cash'){setView('plan');$('hpFinanceCash')?.setAttribute('open','');$('hf-cash-balance')?.focus();return}
    if(action==='scenario-open')return openScenario(b.dataset.projectId);
    if(action==='scenario-close')return closeScenario(true);
    if(action==='scenario-apply')return applyScenario();
    if(['save','add','remove','import','edit-project'].includes(action))closeScenario();
    if(action==='save')return save();if(action==='reload')return load({force:true});if(action==='add')return add(b.dataset.list);
    if(action==='edit-project')return focusProject(Number(b.dataset.index));
    if(action==='remove'){if(!confirm('Retirer cette ligne du plan? Le retrait sera appliqué à la prochaine sauvegarde.'))return;draft[b.dataset.list].splice(Number(b.dataset.index),1);dirty=true;return render()}
    if(action==='import')return importLegacy();
    if(action==='previous'||action==='next'){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+(action==='next'?1:-1));month=d.toISOString().slice(0,7);$('hpFinanceMonth').value=month;lastResult=preview();renderOverview();renderCalendar();return load()}
    if(action==='advisor')return window.hpFindAdvisor?.({questions:lastResult?I.analyze(draft,lastResult).questions:[]});
    if(action==='summary'&&lastResult){$('hpFinanceSummary').hidden=false;$('hpFinanceSummaryText').value=summary();return}
    if(action==='copy'){try{await navigator.clipboard.writeText($('hpFinanceSummaryText').value);status('Résumé copié. Choisis toi-même si tu veux le partager.')}catch{$('hpFinanceSummaryText').select();status('Sélectionne et copie le résumé manuellement.')}}
  }
  function closeScenario(focus=false){
    scenario=null;const host=$('hpFinanceScenario');if(host){host.hidden=true;host.innerHTML=''}
    if(focus)$(view==='calendar'?'hpFinanceTabCalendar':'hpFinanceTabOverview')?.focus();
  }
  function scenarioInput(event){
    const key=event.target.dataset.scenarioField;
    if(!scenario||saving||!['totalAmount','savedAmount','dueDate'].includes(key))return;
    scenario.fields[key]=key==='dueDate'?event.target.value:event.target.value===''?null:Number(event.target.value);updateScenario();
  }
  function scenarioResult(){
    if(!scenario||!ready||scenario.owner!==owner||scenario.day!==today()||scenario.base!==JSON.stringify(E.validate(draft)))throw new Error('Ton plan a changé. Ferme cette comparaison et rouvre le projet.');
    return E.compareProject(draft,scenario.projectId,scenario.fields,scenario.day);
  }
  function openScenario(projectId){
    if(!ready||saving||loading){status('Attends le chargement du budget avant de comparer un scénario.');return}
    try{
      const base=E.validate(draft),project=base.projects.find(x=>x.id===projectId);
      if(!project?.active)throw new Error('Choisis un projet actif dans ton plan.');
      scenario={projectId,owner,day:today(),base:JSON.stringify(base),fields:{totalAmount:project.totalAmount,savedAmount:project.savedAmount,dueDate:project.dueDate}};
      const field=(key,label,type)=>`<div><label for="hpScenario-${key}">${label}</label><input id="hpScenario-${key}" data-scenario-field="${key}" type="${type}" value="${esc(scenario.fields[key])}" ${type==='number'?'min="0" step="0.01" inputmode="decimal"':`min="${today()}"`}></div>`;
      const host=$('hpFinanceScenario');host.hidden=false;
      host.innerHTML=`<h4 id="hpFinanceScenarioTitle" tabindex="-1">Et si je changeais ce projet?</h4><p><b>${esc(project.label)}</b></p><p class="finance-note">Essaie d’autres montants ou une autre date. Les calculs partent de ton plan affiché${dirty?', qui contient des modifications non enregistrées':''}. La date reste à vérifier selon l’urgence de l’entretien.</p><div class="finance-scenario-fields">${field('totalAmount','Coût total envisagé, taxes incluses ($)','number')}${field('savedAmount','Montant réservé envisagé ($)','number')}${field('dueDate','Date envisagée','date')}</div><div id="hpScenarioResult" aria-live="polite"></div><div class="finance-scenario-actions"><button type="button" data-action="scenario-apply" id="hpScenarioApply">Reprendre dans mon plan</button><button type="button" class="alt" data-action="scenario-close">Fermer sans appliquer</button></div><p class="finance-note">Aucun changement enregistré ici. Après la reprise, vérifie les montants et confirme ton projet avant d’enregistrer le plan. Aucun déplacement d’argent ni changement de tâche automatique.</p>`;
      updateScenario();host.scrollIntoView?.({block:'start'});$('hpFinanceScenarioTitle')?.focus({preventScroll:true});
    }catch(error){closeScenario();status(error.message,true)}
  }
  function updateScenario(){
    if(!scenario)return;const host=$('hpScenarioResult'),button=$('hpScenarioApply');if(!host||!button)return;
    try{
      const r=scenarioResult(),a=r.before,b=r.after;
      const row=(label,before,after)=>`<tr><th scope="row">${label}</th><td>${before}</td><td>${after}</td></tr>`;
      const monthLabel=new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(new Date(r.month+'-01T12:00:00'));
      const change=r.monthlyDelta===0?'La réserve mensuelle reste identique.':`${money(Math.abs(r.monthlyDelta))} ${r.monthlyDelta>0?'de plus':'de moins'} à réserver par mois pour ce projet.`;
      host.innerHTML=`<p class="finance-project-funding">${change}</p><div class="finance-table-wrap"><table><caption>Comparaison pour ${esc(monthLabel)}</caption><thead><tr><th scope="col">Prévision</th><th scope="col">Plan actuel</th><th scope="col">Scénario</th></tr></thead><tbody>${row('Coût total',money(E.cents(a.project.totalAmount)),money(E.cents(b.project.totalAmount)))}${row('Date',dateLabel(a.project.dueDate),dateLabel(b.project.dueDate))}${row('Déjà réservé',money(E.cents(a.project.savedAmount)),money(E.cents(b.project.savedAmount)))}${row('Reste à réserver',money(a.funding.remaining),money(b.funding.remaining))}${row('Mois pour réserver',a.funding.months,b.funding.months)}${row('Réserve mensuelle du projet',money(a.funding.monthly),money(b.funding.monthly))}${row('Marge prévue du mois',a.margin===null?'À compléter':money(a.margin),b.margin===null?'À compléter':money(b.margin))}</tbody></table></div><p class="finance-note">Mois actuel et mois d’échéance inclus. La marge tient compte des autres postes du plan; ce n’est pas un solde bancaire. Aucun intérêt ni changement de prix supposé.</p>${a.margin===null?'<p class="finance-note">Complète tes revenus et confirme ton budget pour comparer aussi la marge du mois.</p>':''}${b.margin!==null&&b.margin<0?'<p class="finance-warning">Avec ce scénario, les dépenses et réserves prévues dépassent les revenus du mois.</p>':''}${a.funding.overdue?'<p class="finance-warning">La date du plan actuel est passée : sa réserve mensuelle correspond à tout le montant restant à financer.</p>':''}${b.project.totalAmount!==a.project.totalAmount?'<p class="finance-note">Le nouveau coût sera repris comme une estimation personnelle. Vérifie une nouvelle soumission avant de changer son origine.</p>':''}`;
      button.disabled=saving||loading;
    }catch(error){host.innerHTML=`<p class="finance-warning" role="alert">${esc(error.message)}</p>`;button.disabled=true}
  }
  function applyScenario(){
    if(!scenario||saving||loading)return;
    try{
      const result=scenarioResult(),index=draft.projects.findIndex(x=>x.id===scenario.projectId);
      draft.projects[index]={...result.after.project,confirmed:false};draft.reviewed=false;dirty=true;
      closeScenario();render();focusProject(index);status('Scénario repris, non enregistré. Vérifie le montant et la date, confirme le projet, puis enregistre ton plan.');
    }catch(error){updateScenario();status(error.message,true)}
  }
  window.hpLoadFinancePlan=load;
  function focusProject(index){setView('plan');const row=$('hpFinanceProject-'+index);row?.closest('details')?.setAttribute('open','');row?.scrollIntoView?.({block:'start',behavior:'smooth'});$('hf-projects-'+index+'-totalAmount')?.focus()}
  let openingTask=false;
  window.hpPlanMaintenanceTask=async context=>{
    if(openingTask)return false;
    openingTask=true;
    try{
      window.show?.('budget');for(const id of ['hpPropertyModal','hpLeisureTaskModal','hpDiyModal'])$(id)?.classList.add('hidden');
      if(saving||loading){status('Le budget est en cours de chargement ou de sauvegarde. Réessaie « Prévoir le coût » ensuite.');return false}
      const session=await identity();if(owner!==session.user.id){reset();owner=session.user.id}
      const stamp=epoch;if(!ready)await load();if(!ready||stamp!==epoch||owner!==session.user.id)return false;
      if(!context||typeof context.taskKey!=='string'||!context.taskKey||context.taskKey.length>200||typeof context.label!=='string'||!context.label.trim()){status('Rouvre la tâche pour préparer son coût.',true);return false}
      const existing=draft.projects.findIndex(x=>x.taskKey===context.taskKey);
      if(existing>=0){focusProject(existing);status('Cette échéance figure déjà dans ton plan. Vérifie ou modifie le projet existant.');return true}
      if(draft.projects.length>=100){status('Ton plan contient déjà 100 projets. Retire un ancien projet avant d’en ajouter un.',true);return false}
      draft.projects.push({id:crypto.randomUUID(),taskKey:context.taskKey,label:context.label.trim().slice(0,120),propertyName:typeof context.propertyName==='string'?context.propertyName.trim().slice(0,120)||null:null,category:context.taskKey.startsWith('leisure:')?'Loisirs':'Maison',essential:false,totalAmount:null,savedAmount:0,dueDate:E.validDate(context.dueDate)?context.dueDate:'',costSource:'estimate',confirmed:false,active:true});
      dirty=true;draft.reviewed=false;render();focusProject(draft.projects.length-1);status('Projet préparé, non enregistré. Confirme le coût et l’échéance, puis enregistre ton plan.');return true;
    }catch(error){status(error.message||'Le budget ne peut pas être ouvert.',true);return false}finally{openingTask=false}
  };
  let renderedDay=today();
  function refreshDay(){if(renderedDay!==today()){closeScenario();renderedDay=today();lastResult=preview();renderOverview();renderCalendar()}}
  window.addEventListener('focus',refreshDay);document.addEventListener('visibilitychange',refreshDay);setInterval(refreshDay,60000);
  function init(){ensure();load();window.addEventListener('hp-budget-loaded',()=>load());window.supabaseClient?.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&owner&&owner!==session.user.id))reset();if(event==='SIGNED_IN')setTimeout(()=>load(),0)});document.addEventListener('click',event=>{if(event.target.closest('.tab')?.getAttribute('onclick')?.includes("'budget'"))setTimeout(()=>load(),0)});window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
