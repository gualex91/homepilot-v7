(function(root){
  'use strict';
  function nextStep({household,properties=[],equipment=[],tasks=[]}){
    if(!household)return {step:1,title:'Crée ton foyer',body:'Le foyer permet de regrouper tes propriétés et, plus tard, de les partager.',action:'Commencer avec mon foyer',target:'household'};
    if(!properties.length)return {step:2,title:'Ajoute ta première propriété',body:'Maison, chalet ou immeuble : commence par un bien. Tu pourras en ajouter d’autres, dans toutes les régions.',action:'Ajouter ma première propriété',target:'properties'};
    if(!tasks.length)return {step:3,title:'Prépare ta première échéance',body:'Ajoute une tâche personnelle au calendrier. Tu pourras aussi compléter les équipements dans la fiche de ta propriété.',action:'Ajouter une tâche',target:'tasks'};
    return {step:4,title:'Ton premier suivi est prêt',body:'Consulte tes prochaines tâches. Vérifie les dates proposées et adapte-les à ta propriété.',action:'Voir mon calendrier',target:'tasks'};
  }
  root.hpLaunchExperience={nextStep};if(!root.document)return;
  const $=id=>document.getElementById(id);let showGuide=false,lastKey='';
  function addSection(id,html){if($(id))return $(id);const section=document.createElement('section');section.id=id;section.className='screen';section.innerHTML=html;document.querySelector('main.app').appendChild(section);return section}
  function setupScreens(){
    addSection('more',`<h2>Plus</h2><div class="hp-more-grid"><button class="alt" type="button" data-screen="tasks">Calendrier<small>Tâches et échéances</small></button><button class="alt" type="button" data-screen="household">Mon foyer<small>Invitations et connexion</small></button><button class="alt" type="button" data-screen="leisure">Loisirs<small>Équipements et entretien</small></button><button class="alt" type="button" data-screen="equipment">Équipements<small>De la propriété active</small></button><button class="alt" type="button" data-screen="hpHelp">Aide<small>Bien commencer</small></button><button class="alt" type="button" data-screen="hpPartners">Partenaires<small>Notre fonctionnement</small></button></div><div id="hpAdminEntry"></div>`);
    addSection('hpHelp',`<h2>Aide</h2><div class="card"><h3>Prendre Nuvabri en main</h3><p class="hp-launch-copy">Commence par une propriété et ses équipements. Les informations de ton budget restent personnelles : elles ne sont pas transmises automatiquement aux membres du foyer, aux commerces ou au conseiller.</p><button type="button" id="hpRestartGuide">Revoir les premières étapes</button></div><div class="card"><h3>Où sont mes rappels?</h3><p class="hp-launch-copy">Les échéances apparaissent dans Nuvabri. L’export Apple / Android copie les tâches dans ton calendrier par fichier .ics : les changements suivants ne s’y synchronisent pas automatiquement. Vérifie les alertes dans ton calendrier.</p></div><div class="card"><h3>Inviter un proche</h3><p class="hp-launch-copy">L’invitation est enregistrée dans Nuvabri. Préviens toi-même la personne : elle doit créer son compte avec le courriel invité, se connecter puis accepter l’invitation.</p><button type="button" class="alt" data-screen="household">Ouvrir mon foyer</button></div>`);
    addSection('hpPartners',`<h2>Commerces partenaires</h2><div class="card"><h3>Des services près de chaque propriété</h3><p class="hp-launch-copy">Les commerces sont proposés selon le besoin et l’emplacement du bien concerné. Un chalet dans une autre région ne doit pas recevoir les mêmes résultats que ta maison.</p><p class="hp-commercial-disclosure">Les fiches « Publicité · Commandité » et « Partenaire commercial » peuvent être mises en avant. Ce statut ne constitue pas une garantie de qualité. Un tri alphabétique permet de consulter les résultats sans priorité commerciale.</p></div><div class="card"><h3>Comment Nuvabri souhaite se financer</h3><p class="hp-launch-copy">Les fonctions essentielles, dont le budget, restent gratuites. Nous préparons un programme de visibilité locale pour des commerces partenaires. Aucun abonnement commercial n’est souscrit depuis cette page.</p><p class="muted">Le pilote n’est pas encore ouvert aux paiements. Aucun nombre de clients ou de soumissions n’est garanti.</p></div><div class="card"><h3>Tu choisis ce que tu partages</h3><p class="hp-launch-copy">Une demande désigne un seul commerce. Tu choisis les coordonnées et le message à lui transmettre. Ton budget n’est pas joint à cette demande. L’accompagnement financier reste facultatif.</p></div>`);
    $('hpRestartGuide').onclick=()=>{showGuide=true;lastKey='';refresh();root.hpOpenScreen('home')};
    const properties=$('properties');
    if(properties&&!$('hpPropertyShortcuts')){const links=document.createElement('div');links.id='hpPropertyShortcuts';links.className='hp-launch-actions';links.innerHTML='<button type="button" class="alt" data-screen="equipment">Équipements du bien actif</button><button type="button" class="alt" data-screen="leisure">Mes loisirs</button>';properties.querySelector('.row')?.after(links)}
    const household=$('household');if(household&&!$('hpInvitationNotice')){const notice=document.createElement('p');notice.id='hpInvitationNotice';notice.className='notice';notice.textContent='Aucun courriel d’invitation automatique : préviens la personne après avoir enregistré son invitation.';household.querySelector('.card')?.prepend(notice)}
  }
  function homeLayout(){
    const home=$('home'),hello=$('hello')?.closest('.card');if(!home||!hello)return;
    hello.classList.add('hp-home-greeting');
    if(home.firstElementChild!==hello)home.prepend(hello);
    const seasonal=home.querySelector(':scope > .season');
    if(seasonal&&!$('hpSeasonDetails')){const details=document.createElement('details');details.id='hpSeasonDetails';details.innerHTML='<summary>Une idée de saison</summary>';$('hpHelp').appendChild(details);details.appendChild(seasonal)}
    if(!$('hpGettingStarted')){const guide=document.createElement('section');guide.id='hpGettingStarted';guide.className='card';guide.setAttribute('aria-label','Premières étapes');hello.after(guide)}
    const guide=$('hpGettingStarted'),thought=$('hpSeasonalThought');
    if(thought&&thought.previousElementSibling!==hello)hello.after(thought);
    const anchor=thought||hello;if(guide.previousElementSibling!==anchor)anchor.after(guide);
    const setup=$('setup');if(setup&&setup.previousElementSibling!==guide)guide.after(setup);
    const hc=$('hc');if(hc&&hc.previousElementSibling!==setup)setup.after(hc);
    const fact=$('hpHomeFinancialFact'),budget=$('budget');if(fact&&budget&&fact.parentElement!==budget)budget.appendChild(fact);
    const legend=$('hpPriorityLegend');if(legend&&legend.parentElement!==$('hpHelp'))$('hpHelp').appendChild(legend);
    const summary=$('hpHomeBudget');if(summary&&hc&&summary.previousElementSibling!==hc)hc.after(summary);
    if(hc&&!$('hpHomeCalendar')){const links=document.createElement('div');links.id='hpHomeCalendar';links.className='hp-launch-actions';links.innerHTML='<button type="button" class="alt" data-screen="tasks">Voir toutes mes tâches</button>';hc.appendChild(links)}
  }
  function state(){return {household:typeof h!=='undefined'?h:null,properties:typeof props!=='undefined'?props:[],equipment:typeof eq!=='undefined'?eq:[],tasks:typeof tasks!=='undefined'?tasks:[]}}
  function refresh(){
    homeLayout();const guide=$('hpGettingStarted');if(!guide)return;
    if(root.hpCoreDataReady!==true){guide.hidden=true;return}
    const data=state(),next=nextStep(data),key=JSON.stringify([next.step,next.target,showGuide]);
    guide.hidden=!showGuide&&next.step!==2;
    if(key===lastKey)return;lastKey=key;
    guide.innerHTML=`<div class="hp-launch-kicker">${next.step===4?'Prêt pour le suivi':'Premiers pas · '+next.step+' / 3'}</div><h3>${next.title}</h3><p class="hp-onboard-copy">${next.body}</p><ol>${['Créer mon foyer','Ajouter une propriété','Préparer mes tâches'].map((label,index)=>`<li data-complete="${index+1<next.step}" ${index+1===next.step?'aria-current="step"':''}>${label}${index+1<next.step?' · Fait':''}</li>`).join('')}</ol><div class="hp-launch-actions"><button type="button" id="hpGuideNext">${next.action}</button><button type="button" class="alt" data-screen="budget">Commencer par mon budget</button></div>${showGuide?'<button type="button" class="alt" id="hpGuideClose">Fermer le guide</button>':''}`;
    if(!showGuide)guide.innerHTML=`<h3>${next.title}</h3><p>${next.body}</p><button type="button" id="hpGuideNext">${next.action}</button>`;
    $('hpGuideNext').onclick=()=>{
      if(next.target==='household'){ $('setup')?.classList.remove('hidden');$('hn')?.focus();return }
      root.hpOpenScreen(next.target);
      if(next.target==='properties'){ $('pf')?.classList.remove('hidden');$('pname')?.focus() }
      if(next.target==='tasks'&&next.step===3){ $('tf')?.classList.remove('hidden');$('tt')?.focus() }
    };
    if($('hpGuideClose'))$('hpGuideClose').onclick=()=>{showGuide=false;guide.hidden=true};
  }
  function init(){
    setupScreens();refresh();
    for(const name of ['load','render']){const original=root[name];if(typeof original!=='function')continue;root[name]=function(){const result=original.apply(this,arguments);if(result?.then)return result.finally(refresh);refresh();return result}}
    let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,100)}).observe(document.querySelector('main.app'),{childList:true,subtree:true});
    root.supabaseClient?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){showGuide=false;lastKey='';setTimeout(refresh,0)}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
