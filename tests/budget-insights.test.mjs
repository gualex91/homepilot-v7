import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../budget-engine.js';
import '../budget-catalog.js';
import '../budget-insights.js';
const E=globalThis.hpBudgetEngine,C=globalThis.hpBudgetCatalog,I=globalThis.hpBudgetInsights;
const day='2026-09-10';
const fixture=()=>{
  const p=E.empty();
  for(const [id,amount] of [['salary',2000],['rent',1000],['restaurants',200],['food',600],['emergency',100],['credit',150]]){
    const {key,row}=C.create(id,id,day);row.amount=amount;p[key].push(row);
  }
  p.reviewed=true;return E.validate(p);
};
const result=p=>E.analyze(p,[],'2026-09',day);

test('every suggested income and expense fits the existing saved plan without guessed amounts',()=>{
  assert.ok(C.templates.length>=60);assert.equal(new Set(C.templates.map(x=>x.id)).size,C.templates.length);
  for(const template of C.templates){
    const p=E.empty(),{key,row}=C.create(template.id,'line',day);
    assert.equal(row[template.key==='provisions'?'annualAmount':'amount'],null);
    if(key==='provisions')Object.assign(row,{annualAmount:1200,dueDate:'2026-12-01'});else row.amount=10.25;
    p[key].push(row);const saved=E.validate(p);
    assert.equal(saved[key][0].category,template.category);assert.equal(saved[key][0].label,template.label);
  }
});
test('expense allocation accounts for every cent, including savings and reserves once',()=>{
  const p=fixture();p.provisions=[{id:'tax',label:'Taxes',category:'Taxes foncières',essential:true,annualAmount:1200,savedAmount:400,dueDate:'2026-12-01'}];
  const r=result(p),i=I.analyze(p,r);
  assert.equal(i.outflow,225000);assert.equal(i.allocations.reduce((n,x)=>n+x.amount,0),i.outflow);
  assert.equal(i.savings,10000);assert.equal(i.debts,15000);assert.equal(i.adjustable,20000);
  assert.equal(i.allocations[0].category,'Maison');assert.equal(r.projectedMargin,175000);
});
test('simulation releases only declared nonessential daily spending and does not alter the plan',()=>{
  const p=fixture(),before=JSON.stringify(p),r=result(p),i=I.analyze(p,r);
  assert.deepEqual(I.simulate(r,i,5050),{monthly:5050,yearly:60600,margin:r.projectedMargin+5050});
  for(const value of [-1,NaN,Infinity,1.1,20001])assert.equal(I.simulate(r,i,value),null);
  assert.equal(JSON.stringify(p),before);
  p.reviewed=false;assert.equal(I.simulate(result(p),i,1000),null);
});
test('incomplete, zero-income and negative budgets cannot produce a misleading positive analysis',()=>{
  const p=fixture();p.reviewed=false;let r=result(p),i=I.analyze(p,r);
  assert.equal(i.committedPercent,null);assert.match(i.questions[0],/compléter/);
  p.reviewed=true;p.incomes[0].amount=0;r=result(p);i=I.analyze(p,r);
  assert.equal(i.committedPercent,null);assert.match(i.questions[0],/retrouver une marge/);
  p.incomes[0].amount=500;r=result(p);i=I.analyze(p,r);
  assert.ok(i.committedPercent>100);assert.ok(r.projectedMargin<0);
});
test('analysis preserves legacy categories and incomplete actual data stays unavailable',()=>{
  const p=fixture();p.bills.push({...p.bills[0],id:'old',label:'Ancien poste',category:'Ma catégorie personnelle',amount:23.45});
  const before=JSON.stringify(p),r=E.analyze(p,[{entry_type:'expense',category:'Santé',amount:12,entry_date:day}],'2026-09',day,false),i=I.analyze(p,r);
  assert.equal(r.actual,null);assert.equal(i.allocations.find(x=>x.category==='Ma catégorie personnelle').amount,2345);
  assert.equal(JSON.stringify(p),before);
});
