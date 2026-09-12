(function(root){
  'use strict';
  // Original Nuvabri thoughts, without attribution to outside authors.
  const thoughts={
    spring:[
      'Comme le printemps, tes projets peuvent repartir doucement, un petit geste à la fois.',
      'Aujourd’hui, sème une petite habitude que tu aimeras voir grandir.',
      'Tu n’as pas besoin de tout refaire pour donner un nouveau souffle à ta journée.',
      'Laisse un peu de place à ce qui te fait du bien : les beaux jours commencent aussi comme ça.',
      'Un projet prend racine quand tu lui accordes un premier moment.',
      'Le printemps invite à ouvrir les fenêtres, et parfois à changer de perspective.',
      'Chaque pousse avance à son rythme. Tu peux en faire autant.',
      'Un peu de lumière, un peu de patience : les changements durables prennent leur temps.'
    ],
    summer:[
      'Les journées bien remplies méritent aussi un moment pour profiter de ce que tu construis.',
      'Un beau souvenir commence parfois par une pause au soleil.',
      'Tes projets comptent. Les moments simples avec les tiens aussi.',
      'Prends le temps de savourer ce qui est déjà là, entre deux choses à accomplir.',
      'Aujourd’hui, garde une petite place pour ce qui te donne de l’énergie.',
      'Une soirée dehors peut suffire à rendre une journée mémorable.',
      'Tu peux avancer dans tes projets et profiter du chemin.',
      'Le plus beau programme d’été laisse parfois une place à l’imprévu.'
    ],
    autumn:[
      'Comme les feuilles qui changent, tes projets peuvent évoluer à ton rythme.',
      'Un petit geste aujourd’hui peut rendre les journées à venir plus sereines.',
      'L’automne rappelle qu’on peut ralentir sans cesser d’avancer.',
      'Prendre soin de ton chez-toi, c’est aussi préparer de doux moments pour toi.',
      'Chaque chose réglée libère un peu de place pour ce qui compte.',
      'Une saison qui change est une occasion de choisir ce que tu veux garder près de toi.',
      'Accorde-toi la chaleur d’une pause, même quand la liste n’est pas terminée.',
      'Tes efforts discrets d’aujourd’hui préparent le confort de demain.'
    ],
    winter:[
      'Même au cœur de l’hiver, un petit pas suffit pour garder tes projets en mouvement.',
      'Les journées froides invitent à prendre soin de ce qui nous réchauffe.',
      'Tu peux avancer doucement et être fier du chemin parcouru.',
      'Un moment tranquille peut faire autant de bien qu’une tâche accomplie.',
      'Les projets prennent aussi forme pendant les saisons plus calmes.',
      'Aujourd’hui, choisis un geste simple qui rendra demain un peu plus léger.',
      'Ton énergie mérite le même soin que les projets auxquels tu tiens.',
      'Il y a de la douceur à trouver, même dans les plus petites journées d’hiver.'
    ],
    christmas:[
      'Les Fêtes se construisent aussi avec de petits moments de présence.',
      'Un accueil chaleureux vaut souvent plus qu’une préparation parfaite.',
      'Garde de la place pour les souvenirs, au milieu des choses à organiser.',
      'Le temps offert aux personnes qu’on aime fait partie des plus beaux cadeaux.',
      'Tu n’as pas besoin que tout soit parfait pour passer un bon moment.',
      'Un repas partagé, une conversation, un sourire : la fête peut être toute simple.',
      'Avant de préparer la suite, accorde-toi un regard bienveillant sur l’année écoulée.',
      'Que cette saison te laisse du temps pour les personnes et les moments qui te font du bien.'
    ]
  };
  const labels={spring:'Printemps',summer:'Été',autumn:'Automne',winter:'Hiver',christmas:'Les Fêtes'};
  const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  // Match the app's seasonal theme (December has its own holiday theme).
  function seasonFor(day){const m=Number(day.slice(5,7));return m===12?'christmas':m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter'}
  function nextThought(previous={},random=Math.random,day=localDay()){
    const season=seasonFor(day),list=thoughts[season],ids=list.map((_,i)=>`${season}-${i}`);
    const state=previous&&typeof previous==='object'?previous:{};
    let remaining=state.version===1&&state.season===season&&Array.isArray(state.remaining)?[...new Set(state.remaining)].filter(id=>ids.includes(id)&&id!==state.last):[];
    if(!remaining.length){
      remaining=[...ids];
      for(let i=remaining.length-1;i>0;i--){const n=random(),j=Math.floor(Math.max(0,Math.min(Number.isFinite(n)?n:0,0.999999999))*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]]}
      if(remaining[0]===state.last)[remaining[0],remaining[1]]=[remaining[1],remaining[0]];
    }
    const id=remaining.shift();
    return {thought:{id,season,label:labels[season],text:list[ids.indexOf(id)]},state:{version:1,season,last:id,remaining}};
  }
  function createRotation({read=()=>null,write=()=>{},random=Math.random,onDate=localDay}={}){
    let user=null,day=null,memory={},storageWritable=true;
    return (event,session)=>{
      if(event==='SIGNED_OUT'||(event==='INITIAL_SESSION'&&!session)){user=null;day=null;return {hide:true}}
      const date=onDate();
      if(event==='DAY_CHECK'){if(!user||day===date)return null}
      else {
        if(!['INITIAL_SESSION','SIGNED_IN'].includes(event)||!session?.user?.id)return null;
        if(user===session.user.id&&day===date)return null;
        user=session.user.id;
      }
      day=date;let previous=memory;
      try{const stored=storageWritable?read():null;if(stored)previous=JSON.parse(stored)}catch{}
      const chosen=nextThought(previous,random,date);memory=chosen.state;
      try{write(JSON.stringify(memory));storageWritable=true}catch{storageWritable=false}
      return {thought:chosen.thought};
    };
  }
  root.hpSeasonalThoughts=Object.freeze({thoughts,seasonFor,nextThought,createRotation});
  if(!root.document)return;
  function init(){
    const $=id=>document.getElementById(id),home=$('home'),auth=root.supabaseClient?.auth;
    if(!home||!auth||$('hpSeasonalThought'))return;
    const card=document.createElement('aside');card.id='hpSeasonalThought';card.className='hp-seasonal-thought';card.hidden=true;card.setAttribute('aria-labelledby','hpThoughtTitle');
    card.innerHTML='<div id="hpThoughtTitle" class="hp-thought-heading">La pensée du jour <span id="hpThoughtSeason"></span></div><p id="hpThoughtText"></p>';
    const greeting=$('hello')?.closest('.card');if(greeting?.parentElement===home)greeting.after(card);else home.prepend(card);
    const rotation=createRotation({read:()=>root.localStorage.getItem('nuvabri.thoughts.v1'),write:value=>root.localStorage.setItem('nuvabri.thoughts.v1',value)});
    function render(result){
      if(!result)return;
      if(result.hide){card.hidden=true;$('hpThoughtText').textContent='';return}
      if(!result.thought)return;
      $('hpThoughtSeason').textContent='· '+result.thought.label;
      $('hpThoughtText').textContent=result.thought.text;card.dataset.season=result.thought.season;card.hidden=false;
    }
    // No auth calls inside its callback, no changes for duplicate sign-in or token refresh events.
    let authEvent=0;
    auth.onAuthStateChange((event,session)=>{authEvent++;render(rotation(event,session))});
    const pending=authEvent;
    Promise.resolve().then(()=>auth.getSession()).then(({data,error})=>{if(!error&&pending===authEvent)render(rotation('INITIAL_SESSION',data?.session))}).catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render(rotation('DAY_CHECK'))});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
