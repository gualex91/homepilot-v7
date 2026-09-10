(function(root){
  'use strict';
  const DAY=86400000;
  const frequencies=['once','weekly','biweekly','semimonthly','monthly','quarterly','yearly'];
  const cents=n=>Math.round(Number(n)*100);
  const iso=d=>d.toISOString().slice(0,10);
  const date=s=>new Date(s+'T00:00:00Z');
  const validDate=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(date(s).getTime())&&iso(date(s))===s;
  const addDays=(s,n)=>iso(new Date(date(s).getTime()+n*DAY));
  const days=(a,b)=>Math.round((date(b)-date(a))/DAY);
  const monthEnd=m=>iso(new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)));
  function monthDate(y,m,day){return iso(new Date(Date.UTC(y,m,Math.min(day,new Date(Date.UTC(y,m+1,0)).getUTCDate()))))}
  function empty(){return {version:1,incomes:[],bills:[],envelopes:[],provisions:[],projects:[],reviewed:false,cash:{balance:null,asOf:null,todaySettled:false},emergencySavings:null}}
  function validate(input){
    const fail=m=>{throw new Error(m)};
    const text=(v,label,max=120)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():fail(label+' invalide.');
    const amount=(v,label,nullable=false)=>nullable&&v===null?null:typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100000000&&Math.abs(v*100-Math.round(v*100))<0.0001?v:fail(label+' : montant positif, avec au plus deux décimales.');
    const dateField=(v,label)=>validDate(v)?v:fail(label+' invalide.');
    if(!input||input.version!==1)fail('Format du budget invalide.');
    const result=empty(),ids=new Set();
    const taskKeys=new Set();
    for(const key of ['incomes','bills','envelopes','provisions','projects']){
      const list=key==='projects'&&input[key]===undefined?[]:input[key];
      if(!Array.isArray(list)||list.length>100)fail('Trop de lignes dans le budget.');
      result[key]=list.map(x=>{
        if(!x||typeof x!=='object')fail('Ligne invalide.');
        const id=text(x.id,'Identifiant',100);if(ids.has(id))fail('Une ligne est présente deux fois.');ids.add(id);
        const row={id,label:text(x.label,'Nom'),category:text(x.category,'Catégorie',80),essential:x.essential===true};
        if(key==='projects'){
          const taskKey=x.taskKey==null?null:text(x.taskKey,'Tâche liée',200);
          if(taskKey&&taskKeys.has(taskKey))fail('Cette échéance d’entretien est déjà prévue dans ton budget.');
          if(taskKey)taskKeys.add(taskKey);
          if(!['estimate','quote'].includes(x.costSource))fail('Précise si le coût vient de ton estimation ou d’une soumission.');
          if(x.confirmed!==true)fail('Confirme le coût et l’échéance de chaque entretien ou remplacement.');
          const totalAmount=amount(x.totalAmount,'Coût prévu'),savedAmount=amount(x.savedAmount,'Déjà réservé');
          if(savedAmount>totalAmount)fail('Le montant réservé dépasse le coût prévu. Vérifie ces deux montants.');
          return {...row,taskKey,propertyName:x.propertyName==null?null:text(x.propertyName,'Bien associé'),totalAmount,savedAmount,dueDate:dateField(x.dueDate,'Date prévue de la dépense'),costSource:x.costSource,confirmed:true,active:x.active!==false};
        }
        if(key==='provisions')return {...row,annualAmount:amount(x.annualAmount,'Coût annuel'),savedAmount:amount(x.savedAmount,'Déjà réservé'),dueDate:dateField(x.dueDate,'Échéance')};
        row.amount=amount(x.amount,'Montant');
        if(key!=='envelopes'){
          if(!frequencies.includes(x.frequency))fail('Fréquence invalide.');
          row.frequency=x.frequency;row.anchorDate=dateField(x.anchorDate,'Date de référence');
          row.secondDay=null;
          if(x.frequency==='semimonthly'){
            const first=Number(x.anchorDate.slice(-2));
            if(!Number.isInteger(x.secondDay)||first>28||x.secondDay<=first||x.secondDay>31)fail('Choisis deux jours distincts, dans l’ordre (ex. 1 et 15, ou 15 et 31).');
            row.secondDay=x.secondDay;
          }
        }
        return row;
      });
    }
    if(new Set(result.envelopes.map(x=>x.category)).size!==result.envelopes.length)fail('Utilise une seule enveloppe par catégorie.');
    result.reviewed=input.reviewed===true;
    result.emergencySavings=amount(input.emergencySavings??null,'Épargne de secours',true);
    const cash=input.cash||{};
    if(cash.balance!==null&&cash.balance!==undefined){
      if(typeof cash.balance!=='number'||!Number.isFinite(cash.balance)||Math.abs(cash.balance)>100000000||Math.abs(cash.balance*100-Math.round(cash.balance*100))>0.0001)fail('Solde invalide.');
      result.cash={balance:cash.balance,asOf:dateField(cash.asOf,'Date du solde'),todaySettled:cash.todaySettled===true};
    }
    return result;
  }
  // The anchor is a known occurrence, not a start date. Keep the original day
  // on every month calculation, so January 30 -> February 28 -> March 30.
  function occurrences(item,start,end){
    if(!validDate(start)||!validDate(end)||start>end||days(start,end)>740||!validDate(item.anchorDate))return [];
    const out=[],anchor=date(item.anchorDate),first=date(start),last=date(end);
    if(item.frequency==='once')return item.anchorDate>=start&&item.anchorDate<=end?[item.anchorDate]:[];
    if(item.frequency==='weekly'||item.frequency==='biweekly'){
      const step=item.frequency==='weekly'?7:14;
      for(let d=addDays(item.anchorDate,Math.ceil(days(item.anchorDate,start)/step)*step);d<=end;d=addDays(d,step))out.push(d);
      return out;
    }
    const a=anchor.getUTCFullYear()*12+anchor.getUTCMonth();
    for(let m=first.getUTCFullYear()*12+first.getUTCMonth(),stop=last.getUTCFullYear()*12+last.getUTCMonth();m<=stop;m++){
      const y=Math.floor(m/12),mo=m%12,step=item.frequency==='yearly'?12:item.frequency==='quarterly'?3:1;
      if(((m-a)%step+step)%step!==0)continue;
      const dates=[monthDate(y,mo,anchor.getUTCDate())];
      if(item.frequency==='semimonthly')dates.push(monthDate(y,mo,item.secondDay));
      for(const d of dates)if(d>=start&&d<=end)out.push(d);
    }
    return out.sort();
  }
  function events(plan,start,end){
    const all=[];
    for(const [key,kind] of [['incomes','income'],['bills','expense']])for(const item of plan[key]){
      for(const when of occurrences(item,start,end))all.push({id:item.id,date:when,label:item.label,category:item.category,kind,amount:cents(item.amount)});
    }
    for(const item of plan.provisions)if(item.dueDate>=start&&item.dueDate<=end)all.push({id:item.id,date:item.dueDate,label:item.label,category:item.category,kind:'annual',amount:cents(item.annualAmount),unfunded:Math.max(0,cents(item.annualAmount)-cents(item.savedAmount))});
    for(const item of plan.projects||[])if(item.active!==false&&item.dueDate>=start&&item.dueDate<=end)all.push({id:item.id,date:item.dueDate,label:item.label,category:item.category,kind:'project',amount:cents(item.totalAmount),unfunded:Math.max(0,cents(item.totalAmount)-cents(item.savedAmount))});
    return all.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.kind==='income')-Number(b.kind==='income'));
  }
  function analyze(plan,entries,month,today,entriesComplete=true){
    const start=month+'-01',end=monthEnd(month),calendar=events(plan,start,end),totals={income:0,bills:0,flexible:0,provisions:0,projects:0,essential:0};
    const categories=new Map();
    const category=name=>{if(!categories.has(name))categories.set(name,{category:name,planned:null,actual:0,provision:0});return categories.get(name)};
    for(const event of calendar){if(event.kind==='income')totals.income+=event.amount;else if(event.kind==='expense'){totals.bills+=event.amount;const row=category(event.category);row.planned=(row.planned??0)+event.amount}}
    for(const item of plan.bills)if(item.essential)totals.essential+=occurrences(item,start,end).length*cents(item.amount);
    for(const item of plan.envelopes){const value=cents(item.amount);totals.flexible+=value;if(item.essential)totals.essential+=value;const row=category(item.category);row.planned=(row.planned??0)+value}
    const provisions=plan.provisions.map(item=>{
      const monthly=Math.round(cents(item.annualAmount)/12),remaining=Math.max(0,cents(item.annualAmount)-cents(item.savedAmount));
      const months=Math.max(1,(Number(item.dueDate.slice(0,4))-Number(today.slice(0,4)))*12+Number(item.dueDate.slice(5,7))-Number(today.slice(5,7))+1);
      const catchUp=Math.ceil(remaining/months),recommended=Math.max(monthly,catchUp);
      totals.provisions+=recommended;if(item.essential)totals.essential+=monthly;category(item.category).provision+=recommended;
      return {...item,monthly,remaining,catchUp,recommended,overdue:item.dueDate<today};
    });
    const projects=(plan.projects||[]).map(item=>{
      const funding=projectFunding(item,today);
      const applicable=item.active!==false&&month>=today.slice(0,7)&&month<=(funding.overdue?today:item.dueDate).slice(0,7);
      if(applicable){totals.projects+=funding.monthly;category(item.category).provision+=funding.monthly}
      return {...item,...funding,contribution:applicable?funding.monthly:0};
    });
    const actual={income:0,expense:0};
    for(const entry of entries){
      if(!validDate(entry.entry_date)||entry.entry_date<start||entry.entry_date>end||entry.entry_date>today||!Number.isFinite(Number(entry.amount)))continue;
      if(entry.entry_type==='income')actual.income+=cents(entry.amount);
      else if(entry.entry_type==='expense'){actual.expense+=cents(entry.amount);category(entry.category||'Autre').actual+=cents(entry.amount)}
    }
    const projectedMargin=totals.income-totals.bills-totals.flexible-totals.provisions-totals.projects;
    const nextEvents=events(plan,addDays(today,1),addDays(today,370));
    const nextPay=nextEvents.find(x=>x.kind==='income'&&x.amount>0)||null;
    let cash=null;
    if(plan.reviewed&&plan.cash.balance!==null&&plan.cash.asOf===today&&plan.cash.todaySettled&&nextPay&&!provisions.some(x=>x.overdue)&&!projects.some(x=>x.active&&x.remaining>0&&x.dueDate<=today)){
      const scheduled=nextEvents.filter(x=>x.kind!=='income'&&x.date<=nextPay.date);
      const bills=scheduled.reduce((n,x)=>n+(['annual','project'].includes(x.kind)?x.unfunded:x.amount),0);
      // Daily envelope allowance, including the payday before its deposit.
      const dueIds=new Set(scheduled.filter(x=>['annual','project'].includes(x.kind)).map(x=>x.id));
      const reserveMonthly=provisions.filter(x=>!dueIds.has(x.id)).reduce((n,x)=>n+x.recommended,0);
      let flexible=0,reserve=0;for(let d=addDays(today,1);d<=nextPay.date;d=addDays(d,1)){const divisor=Number(monthEnd(d.slice(0,7)).slice(-2));flexible+=totals.flexible/divisor;reserve+=reserveMonthly/divisor;for(const x of projects)if(x.active&&!dueIds.has(x.id)&&d<=x.dueDate)reserve+=x.monthly/divisor}
      flexible=Math.round(flexible);
      reserve=Math.round(reserve);cash={nextPay:nextPay.date,balance:cents(plan.cash.balance),bills,flexible,reserve,available:cents(plan.cash.balance)-bills-flexible-reserve};
    }
    const actions=[];
    if(projects.some(x=>x.active&&x.remaining>0&&x.dueDate<=today))actions.push({title:'Vérifier une dépense arrivée à échéance',body:'Un entretien ou remplacement reste à financer. Vérifie le coût, la date et ce qui a déjà été payé avant de te fier au disponible.'});
    if(!plan.reviewed)actions.push({title:'Compléter mon budget',body:'Vérifie tes revenus, charges, dépenses courantes et provisions avant de confirmer ton plan.'});
    if(!plan.incomes.length)actions.push({title:'Préciser mes revenus',body:'Ajoute tes revenus nets, prestations ou pensions. Sans eux, la marge prévue est incomplète.'});
    if(plan.reviewed&&projectedMargin<0)actions.push({title:'Rééquilibrer mon mois',body:'Les dépenses et provisions prévues dépassent les revenus prévus. Revois les montants et les échéances.'});
    if(cash&&cash.available<0)actions.push({title:'Vérifier les prochains paiements',body:'L’estimation avant la prochaine rentrée d’argent est négative. Vérifie les dates et les montants avant d’engager une nouvelle dépense.'});
    if(provisions.some(x=>x.overdue))actions.push({title:'Actualiser mes échéances annuelles',body:'Une échéance est passée. Mets à jour sa date et le montant déjà réservé.'});
    else if(provisions.some(x=>x.catchUp>x.monthly))actions.push({title:'Rattraper une provision',body:'Le montant déjà réservé est insuffisant au rythme annuel moyen. Consulte le montant à mettre de côté jusqu’à l’échéance.'});
    if(entriesComplete&&[...categories.values()].some(x=>x.planned!==null&&x.provision===0&&x.actual>x.planned))actions.push({title:'Revoir un écart de dépenses',body:'Une catégorie dépasse le prévu. Vérifie les opérations et ajuste ton plan si cet écart se répète.'});
    if(!cash&&plan.reviewed)actions.push({title:'Actualiser mon disponible',body:'Un solde vérifié aujourd’hui, une prochaine rentrée d’argent positive et des échéances à jour sont nécessaires pour cette estimation.'});
    if(!actions.length)actions.push({title:'Faire mon point mensuel',body:'Compare tes dépenses enregistrées à ton plan et vérifie les opérations manquantes. Aucun compte bancaire n’est synchronisé.'});
    return {month,totals,actual:entriesComplete?actual:null,projectedMargin,complete:plan.reviewed&&plan.incomes.length>0,categories:[...categories.values()],provisions,projects,calendar,cash,emergencyMonths:plan.emergencySavings!==null&&totals.essential>0?cents(plan.emergencySavings)/totals.essential:null,actions:actions.slice(0,3)};
  }
  function projectFunding(item,today){
    const remaining=Math.max(0,cents(item.totalAmount)-cents(item.savedAmount));
    const months=Math.max(1,(Number(item.dueDate.slice(0,4))-Number(today.slice(0,4)))*12+Number(item.dueDate.slice(5,7))-Number(today.slice(5,7))+1);
    return {remaining,months,monthly:item.active===false?0:Math.ceil(remaining/months),overdue:item.dueDate<today};
  }
  function compareProject(input,projectId,changes,today){
    if(!validDate(today))throw new Error('Date du calcul invalide.');
    const before=validate(input),index=before.projects.findIndex(x=>x.id===projectId),original=before.projects[index];
    if(!original||!original.active)throw new Error('Choisis un projet actif dans ton plan.');
    const candidate={...original,totalAmount:changes?.totalAmount,savedAmount:changes?.savedAmount,dueDate:changes?.dueDate};
    if(candidate.totalAmount!==original.totalAmount)candidate.costSource='estimate';
    const after=validate({...before,projects:before.projects.map((x,i)=>i===index?candidate:x)});
    if(candidate.dueDate<today)throw new Error('Choisis une date à partir d’aujourd’hui pour ce scénario.');
    const month=today.slice(0,7);
    const describe=plan=>{const result=analyze(plan,[],month,today,false),project=plan.projects[index];return {project,funding:projectFunding(project,today),margin:result.complete?result.projectedMargin:null}};
    const a=describe(before),b=describe(after);
    return {month,before:a,after:b,monthlyDelta:b.funding.monthly-a.funding.monthly,marginDelta:a.margin===null||b.margin===null?null:b.margin-a.margin};
  }
  root.hpBudgetEngine={empty,validate,occurrences,events,analyze,validDate,monthEnd,addDays,cents,projectFunding,compareProject};
})(globalThis);
