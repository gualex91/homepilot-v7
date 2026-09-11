(function(root){
  'use strict';
  // Every insight is derived from declared amounts. No credit/health score,
  // market return, inferred insurance need or third-party data transfer.
  function analyze(plan,result){
    const E=root.hpBudgetEngine,r=result,t=r.totals;
    const allocations=r.categories.map(x=>({category:x.category,amount:(x.planned||0)+(x.provision||0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
    const outflow=t.bills+t.flexible+t.provisions+t.projects;
    const savings=r.calendar.filter(x=>x.kind==='expense'&&x.category==='Épargne').reduce((n,x)=>n+x.amount,0)+plan.envelopes.filter(x=>x.category==='Épargne').reduce((n,x)=>n+E.cents(x.amount),0);
    const debts=r.calendar.filter(x=>x.kind==='expense'&&x.category==='Remboursement de dettes').reduce((n,x)=>n+x.amount,0);
    const adjustable=plan.envelopes.filter(x=>!x.essential&&x.category!=='Épargne').reduce((n,x)=>n+E.cents(x.amount),0);
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
  root.hpBudgetInsights={analyze,simulate};
})(typeof globalThis!=='undefined'?globalThis:window);
