(function(root){
  'use strict';
  const savingsCategory=category=>['Épargne','REER','CELI'].includes(category);
  const registeredCategory=category=>['REER','CELI'].includes(category);
  const annualCounts={once:1,weekly:52,biweekly:26,semimonthly:24,monthly:12,quarterly:4,yearly:1};
  const validAmount=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000000&&Math.abs(n*100-Math.round(n*100))<0.0001;
  // A constant annual saving rhythm, not the remaining calendar year. The
  // monthly cash-flow engine still uses actual dates and may count 53 weeks.
  function savingProjection(row,key='bills'){
    const frequency=key==='envelopes'?'monthly':row.frequency,count=Object.hasOwn(annualCounts,frequency)?annualCounts[frequency]:undefined;
    const contributions=validAmount(row.amount)&&count!==undefined?Math.round(row.amount*100)*count:null;
    const startingBalance=validAmount(row.accountBalance)?Math.round(row.accountBalance*100):null;
    return {count,contributions,startingBalance,projectedBalance:contributions!==null&&startingBalance!==null?startingBalance+contributions:null};
  }
  function annualSavings(plan){
    return ['REER','CELI'].flatMap(category=>{
      const rows=['bills','envelopes'].flatMap(key=>(plan[key]||[]).filter(x=>x.category===category).map(x=>savingProjection(x,key)));
      if(!rows.length)return [];
      const total=field=>rows.every(x=>x[field]!==null)?rows.reduce((n,x)=>n+x[field],0):null;
      return [{category,accounts:rows.length,contributions:total('contributions'),startingBalance:total('startingBalance'),projectedBalance:total('projectedBalance')}];
    });
  }
  // Every insight is derived from declared amounts. No credit/health score,
  // market return, inferred insurance need or third-party data transfer.
  function analyze(plan,result){
    const E=root.hpBudgetEngine,r=result,t=r.totals;
    const allocations=r.categories.map(x=>({category:x.category,amount:(x.planned||0)+(x.provision||0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
    const outflow=t.bills+t.flexible+t.provisions+t.projects;
    const savings=r.calendar.filter(x=>x.kind==='expense'&&savingsCategory(x.category)).reduce((n,x)=>n+x.amount,0)+plan.envelopes.filter(x=>savingsCategory(x.category)).reduce((n,x)=>n+E.cents(x.amount),0);
    const debts=r.calendar.filter(x=>x.kind==='expense'&&x.category==='Remboursement de dettes').reduce((n,x)=>n+x.amount,0);
    const adjustable=plan.envelopes.filter(x=>!x.essential&&!savingsCategory(x.category)).reduce((n,x)=>n+E.cents(x.amount),0);
    const questions=[];
    if(!r.complete)questions.push('Quels revenus et dépenses dois-je vérifier pour compléter mon portrait?');
    else if(r.projectedMargin<0)questions.push('Quelles priorités revoir pour retrouver une marge dans mon budget?');
    else questions.push('Comment répartir ma marge entre mes projets, mon épargne et ma retraite?');
    if(plan.emergencySavings===null)questions.push('Quel coussin prévoir selon ma situation et mes responsabilités?');
    else questions.push('Mon épargne disponible et mes protections conviennent-elles à mes imprévus possibles?');
    if(debts>0)questions.push('Comment concilier mes remboursements de dettes et mes objectifs d’épargne?');
    else if(t.provisions+t.projects>0)questions.push('Comment préparer mes dépenses à venir tout en poursuivant mes objectifs?');
    else questions.push('Quels objectifs financiers devrais-je intégrer à mon budget?');
    return {outflow,savings,debts,adjustable,allocations,questions,committedPercent:r.complete&&t.income>0?outflow/t.income*100:null};
  }
  function simulate(result,insights,amount){
    if(!result.complete||!Number.isFinite(amount)||amount<0||!Number.isInteger(amount)||amount>insights.adjustable)return null;
    return {monthly:amount,yearly:amount*12,margin:result.projectedMargin+amount};
  }
  root.hpBudgetInsights={analyze,simulate,savingsCategory,registeredCategory,savingProjection,annualSavings};
})(typeof globalThis!=='undefined'?globalThis:window);
