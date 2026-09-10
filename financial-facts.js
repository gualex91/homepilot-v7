(function(root){
  'use strict';
  const base='https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/';
  const sources={
    emergency:{name:'ACFC · Fonds d’urgence',url:base+'epargnes-investissements/etablir-fonds-durgence.html'},
    budget:{name:'ACFC · Faire un budget',url:base+'faire-budget.html'},
    debt:{name:'ACFC · Comprendre les dettes',url:base+'dettes/plan-payer-dettes.html'}
  };
  // Editorial content, not generated at sign-in or personalized from private data.
  // Re-check official sources before extending reviewBy or adding changing figures.
  const facts=[
    {id:'emergency-months',topic:'Sécurité financière',title:'Un coussin se construit progressivement',body:'L’ACFC propose de viser 3 à 6 mois de dépenses habituelles pour un fonds d’urgence. C’est un repère à adapter à ta situation, pas un objectif à atteindre d’un seul coup.',source:'emergency'},
    {id:'planned-is-not-emergency',topic:'Dépenses annuelles',title:'Prévisible ne veut pas dire mensuel',body:'Les pneus d’hiver et la rentrée scolaire ne sont pas des imprévus : même occasionnelles, ces dépenses peuvent être prévues dans ton budget.',source:'emergency'},
    {id:'accessible-reserve',topic:'Sécurité financière',title:'Un fonds d’urgence doit rester accessible',body:'Une réserve pour les imprévus doit pouvoir être utilisée rapidement. Les frais de retrait et l’accès à l’argent comptent aussi dans le choix du compte.',source:'emergency'},
    {id:'automatic-savings',topic:'Épargne',title:'L’épargne peut suivre le rythme de ta paie',body:'Un virement automatique permet de choisir à l’avance le montant, la date et la fréquence de ton épargne, selon ce que ton budget permet.',source:'emergency'},
    {id:'budget-has-savings',topic:'Budget',title:'L’épargne fait partie du plan',body:'Un budget ne sert pas seulement à additionner les factures : il met aussi en relation tes revenus, tes dépenses et l’argent destiné à tes objectifs.',source:'budget'},
    {id:'needs-context',topic:'Priorités',title:'Un besoin dépend de ta réalité',body:'Une voiture peut être nécessaire là où il n’y a pas de transport collectif. Les besoins et les désirs ne sont pas identiques pour tout le monde.',source:'budget'},
    {id:'monthly-review',topic:'Budget',title:'Le prévu gagne à être comparé au réel',body:'Comparer chaque mois tes dépenses enregistrées au budget aide à repérer les écarts récurrents et à ajuster les montants devenus irréalistes.',source:'budget'},
    {id:'life-changes',topic:'Objectifs',title:'Ton budget doit évoluer avec ta vie',body:'Une variation de salaire ou de facture peut modifier ton équilibre financier. Mettre à jour ton budget permet de tenir compte de cette nouvelle réalité.',source:'budget'},
    {id:'cost-of-borrowing',topic:'Dettes',title:'Le montant emprunté n’est pas le coût total',body:'Le capital est le montant emprunté. Les intérêts et les frais applicables, comme les frais annuels ou d’administration, peuvent augmenter ce que tu devras payer.',source:'debt'},
    {id:'payment-dates',topic:'Dettes',title:'Les dates de paiement comptent aussi',body:'Un retard ou un manque de fonds peut entraîner des frais supplémentaires. Un calendrier des échéances aide à prévoir quand l’argent devra être disponible.',source:'debt'},
    {id:'weekly-savings-example',topic:'Épargne en chiffres',title:'25 $ par semaine = 1 300 $ en 52 semaines',body:'Exemple de calcul : 25 $ × 52 = 1 300 $, avant intérêts et sans retraits. Ce montant illustre une habitude d’épargne, pas un rendement promis.',source:'budget',example:true},
    {id:'annual-provision-example',topic:'Budget en chiffres',title:'1 200 $ par année = 100 $ par mois',body:'Exemple de calcul : réserver 100 $ pendant 12 mois couvre une dépense annuelle de 1 200 $. Si l’échéance est plus proche, le montant à réserver peut être plus élevé.',source:'budget',example:true}
  ].map(f=>Object.freeze({...f,source:sources[f.source],checkedOn:'2026-09-10',reviewBy:f.example?null:'2027-03-10'}));
  Object.freeze(facts);
  const today=()=>new Date().toISOString().slice(0,10);
  const eligible=(on=today())=>facts.filter(f=>!f.reviewBy||on<f.reviewBy);
  function nextFact(previous={},random=Math.random,on=today()){
    const available=eligible(on),ids=available.map(f=>f.id);
    const last=typeof previous?.last==='string'?previous.last:null;
    let remaining=previous?.version===1&&Array.isArray(previous.remaining)?[...new Set(previous.remaining)].filter(id=>ids.includes(id)&&id!==last):[];
    if(!remaining.length){
      remaining=[...ids];
      for(let i=remaining.length-1;i>0;i--){const n=random(),j=Math.floor(Math.max(0,Math.min(Number.isFinite(n)?n:0,0.999999999))*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]]}
      if(remaining.length>1&&remaining[0]===last)[remaining[0],remaining[1]]=[remaining[1],remaining[0]];
    }
    const id=remaining.shift();
    return {fact:available.find(f=>f.id===id),state:{version:1,last:id,remaining}};
  }
  function createRotation({read=()=>null,write=()=>{},random=Math.random,onDate=today}={}){
    let user=null,memory={},storageWritable=true;
    return (event,session)=>{
      if(event==='SIGNED_OUT'||(event==='INITIAL_SESSION'&&!session)){user=null;return {hide:true}}
      if(!['INITIAL_SESSION','SIGNED_IN'].includes(event)||!session?.user?.id||session.user.id===user)return null;
      user=session.user.id;
      let previous=memory;try{const stored=storageWritable?read():null;if(stored)previous=JSON.parse(stored)}catch{}
      const chosen=nextFact(previous,random,onDate());memory=chosen.state;
      try{write(JSON.stringify(memory));storageWritable=true}catch{storageWritable=false}
      return {fact:chosen.fact};
    };
  }
  root.hpFinancialFacts=Object.freeze({facts,eligible,nextFact,createRotation});
  if(!root.document)return;
  function init(){
    const home=document.getElementById('home'),auth=root.supabaseClient?.auth;
    if(!home||!auth||document.getElementById('hpHomeFinancialFact'))return;
    const card=document.createElement('aside');card.id='hpHomeFinancialFact';card.className='card';card.hidden=true;card.setAttribute('aria-labelledby','hpHomeFactTitle');
    card.innerHTML='<div class="hp-home-fact-kicker">Le savais-tu? · <span id="hpHomeFactTopic"></span></div><h2 id="hpHomeFactTitle"></h2><p id="hpHomeFactBody"></p><div class="hp-home-fact-footer"><a id="hpHomeFactSource" target="_blank" rel="noopener noreferrer"></a><span id="hpHomeFactDate"></span></div><p class="hp-home-fact-note">Information générale, pas une recommandation personnalisée.</p>';
    const greeting=document.getElementById('hello')?.closest('.card');if(greeting?.parentElement===home)greeting.after(card);else home.prepend(card);
    const rotation=createRotation({read:()=>root.localStorage.getItem('hp.home-financial-facts.v1'),write:value=>root.localStorage.setItem('hp.home-financial-facts.v1',value)});
    let current=null;
    function render(result){
      if(!result)return;
      if(result.hide||!result.fact){card.hidden=true;current=null;return}
      const f=result.fact;current=f;
      document.getElementById('hpHomeFactTopic').textContent=f.topic;
      document.getElementById('hpHomeFactTitle').textContent=f.title;
      document.getElementById('hpHomeFactBody').textContent=f.body;
      const link=document.getElementById('hpHomeFactSource');link.textContent=(f.example?'Méthode budgétaire : ':'En savoir plus : ')+f.source.name;link.href=f.source.url;
      document.getElementById('hpHomeFactDate').textContent=f.example?'Exemple de calcul Nuvabri':'Source consultée le '+new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(f.checkedOn+'T12:00:00Z'));
      card.hidden=false;
    }
    // No Supabase calls in the synchronous callback. Duplicate sign-in events
    // on tab focus and token refresh must not consume another capsule.
    auth.onAuthStateChange((event,session)=>render(rotation(event,session)));
    document.addEventListener('visibilitychange',()=>{if(current?.reviewBy&&today()>=current.reviewBy){card.hidden=true;current=null}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
