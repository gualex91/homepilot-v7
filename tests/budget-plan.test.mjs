import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import handler from '../api/budget-plan.js';
const E=globalThis.hpBudgetEngine;
const user='11111111-1111-4111-a111-111111111111';
const row=(id,amount,anchorDate,frequency='monthly',category='Maison')=>({id,label:id,amount,anchorDate,frequency,category,essential:true,secondDay:null});
const plan=()=>({...E.empty(),reviewed:true,incomes:[row('paie',2000,'2026-09-15','semimonthly','Salaire')].map(x=>({...x,secondDay:30}))});
const analyze=p=>E.analyze(E.validate(p),[],'2026-09','2026-09-10');

test('two-week pay is 26 dates, twice-monthly is 24; some months have three pays',()=>{
  const bi=row('pay',1000,'2026-01-02','biweekly');
  const semi={...bi,frequency:'semimonthly',anchorDate:'2026-01-15',secondDay:31};
  assert.equal(E.occurrences(bi,'2026-01-01','2026-12-31').length,26);
  assert.equal(E.occurrences(semi,'2026-01-01','2026-12-31').length,24);
  assert.equal(E.occurrences(bi,'2026-01-01','2026-01-31').length,3);
});
test('monthly dates keep their original day after February, including leap years',()=>{
  assert.deepEqual(E.occurrences(row('bill',10,'2026-01-30'),'2026-01-01','2026-03-31'),['2026-01-30','2026-02-28','2026-03-30']);
  assert.deepEqual(E.occurrences(row('bill',10,'2024-01-31'),'2024-01-01','2024-03-31'),['2024-01-31','2024-02-29','2024-03-31']);
});
test('quarterly, annual and one-off dates do not become monthly charges',()=>{
  assert.equal(E.occurrences(row('q',10,'2026-01-31','quarterly'),'2026-01-01','2026-12-31').length,4);
  assert.deepEqual(E.occurrences(row('y',10,'2024-02-29','yearly'),'2025-01-01','2025-12-31'),['2025-02-28']);
  assert.deepEqual(E.occurrences(row('o',10,'2026-01-01','once'),'2026-02-01','2026-12-31'),[]);
});
test('known next payday can determine earlier occurrences in the chosen month',()=>{
  assert.deepEqual(E.occurrences(row('p',10,'2026-09-25','biweekly'),'2026-09-01','2026-09-30'),['2026-09-11','2026-09-25']);
});
test('invalid amounts, duplicate categories, incomplete dates and invalid pay days are rejected',()=>{
  for(const amount of [null,-1,NaN,Infinity,1.001,'100']){const p=plan();p.incomes[0].amount=amount;assert.throws(()=>E.validate(p))}
  const p=plan();p.incomes[0].secondDay=14;assert.throws(()=>E.validate(p));
  p.incomes[0].secondDay=30;p.incomes[0].anchorDate='2026-02-30';assert.throws(()=>E.validate(p));
  const e=plan();e.envelopes=[row('a',0,'2026-01-01'),row('b',0,'2026-01-01')];assert.throws(()=>E.validate(e));
});
test('unset and explicitly zero remain distinct; plan without reviewed inputs is incomplete',()=>{
  const e=E.validate(E.empty());assert.equal(e.cash.balance,null);assert.equal(e.emergencySavings,null);assert.equal(analyze(e).complete,false);
  const p=plan();p.cash={balance:0,asOf:'2026-09-10',todaySettled:true};p.emergencySavings=0;
  assert.equal(E.validate(p).emergencySavings,0);assert.equal(analyze(p).cash.available,0);
});
test('forecast is independent from recorded expenses and omits future-dated actuals',()=>{
  const p=plan();p.bills=[row('rent',1000,'2026-09-01')];p.envelopes=[row('food',500,'2026-09-01','monthly','Épicerie')];
  const entries=[{entry_date:'2026-09-02',entry_type:'expense',amount:'250.10',category:'Épicerie'},{entry_date:'2026-09-11',entry_type:'expense',amount:500,category:'Épicerie'},{entry_date:'2026-08-01',entry_type:'expense',amount:500,category:'Épicerie'}];
  const r=E.analyze(E.validate(p),entries,'2026-09','2026-09-10');
  assert.equal(r.projectedMargin,250000);assert.equal(r.actual.expense,25010);assert.equal(r.categories.find(x=>x.category==='Épicerie').planned,50000);
  assert.equal(E.analyze(p,entries,'2026-09','2026-09-10',false).actual,null);
});
test('annual provision reserves money but does not double count the annual bill',()=>{
  const p=plan();p.cash={balance:1000,asOf:'2026-09-10',todaySettled:true};
  p.provisions=[{id:'tax',label:'Taxes',category:'Maison',essential:true,annualAmount:1200,savedAmount:1000,dueDate:'2026-09-12'}];
  const r=analyze(p);assert.equal(r.totals.bills,0);assert.equal(r.totals.provisions,20000);assert.equal(r.calendar.find(x=>x.kind==='annual').amount,120000);
  assert.equal(r.cash.bills,20000);assert.equal(r.cash.reserve,0);assert.equal(r.cash.available,80000);
});
test('catch-up provision uses remaining amount and includes this month',()=>{
  const p=plan();p.provisions=[{id:'tax',label:'Taxes',category:'Maison',essential:true,annualAmount:1200,savedAmount:0,dueDate:'2026-12-01'}];
  const r=analyze(p);assert.equal(r.provisions[0].monthly,10000);assert.equal(r.provisions[0].recommended,30000);
});
test('cash estimate uses future bills including payday, not expected deposits',()=>{
  const p=plan();p.cash={balance:1000,asOf:'2026-09-10',todaySettled:true};p.bills=[row('bill',200,'2026-09-15')];p.envelopes=[row('food',300,'2026-09-01','monthly','Épicerie')];
  const r=analyze(p);assert.equal(r.cash.nextPay,'2026-09-15');assert.equal(r.cash.flexible,5000);assert.equal(r.cash.available,75000);
  p.cash.asOf='2026-09-09';assert.equal(analyze(p).cash,null);
  p.cash.asOf='2026-09-10';p.cash.todaySettled=false;assert.equal(analyze(p).cash,null);
  p.cash.todaySettled=true;p.reviewed=false;assert.equal(analyze(p).cash,null);
});
test('zero income and overdue annual dates cannot produce reassuring cash estimates',()=>{
  const p=plan();p.cash={balance:1000,asOf:'2026-09-10',todaySettled:true};p.incomes[0].amount=0;assert.equal(analyze(p).cash,null);
  p.incomes[0].amount=2000;p.provisions=[{id:'tax',label:'Taxes',category:'Maison',essential:true,annualAmount:1200,savedAmount:0,dueDate:'2026-09-09'}];assert.equal(analyze(p).cash,null);
});
test('cash daily allowance handles a month boundary with different month lengths',()=>{
  const p=plan();p.incomes=[row('pay',2000,'2026-10-02','once')];p.envelopes=[row('food',310,'2026-09-01','monthly','Épicerie')];p.cash={balance:1000,asOf:'2026-09-29',todaySettled:true};
  const r=E.analyze(E.validate(p),[],'2026-09','2026-09-29');assert.equal(r.cash.flexible,3033);
});

function response(){return {code:200,headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}}}
function fakeDB({expired=false,race=false,entryCount=0}={}){
  const db={current:null,writes:0,calls:[]};
  db.fetch=async(input,opts={})=>{
    const url=new URL(input),table=url.pathname.split('/').pop();db.calls.push({url,opts});
    if(url.pathname==='/auth/v1/user')return Response.json(expired?{}:{id:user},{status:expired?401:200});
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    if(table==='budget_plans'){
      if(opts.method==='POST'){db.writes++;const row=JSON.parse(opts.body);assert.equal(row.user_id,user);if(db.current)return Response.json([]);db.current=row;return Response.json([row])}
      assert.equal(url.searchParams.get('user_id'),'eq.'+user);
      if(opts.method==='PATCH'){db.writes++;if(race){db.current.revision=randomUUID();return Response.json([])}assert.equal(url.searchParams.get('revision'),'eq.'+db.current.revision);db.current={...db.current,...JSON.parse(opts.body)};return Response.json([db.current])}
      return Response.json(db.current?[db.current]:[]);
    }
    assert.equal(url.searchParams.get('user_id'),'eq.'+user);
    if(table==='budget_entries'){
      assert.deepEqual(url.searchParams.getAll('entry_date'),['gte.2026-09-01','lte.2026-09-30']);
      const offset=Number(url.searchParams.get('offset'));return Response.json(Array.from({length:Math.min(500,Math.max(0,entryCount-offset))},(_,i)=>({id:offset+i,entry_date:'2026-09-01',entry_type:'expense',category:'Autre',amount:1})));
    }
    return Response.json([]);
  };return db;
}
const request=(method='GET',body)=>({method,url:'/api/budget-plan?month=2026-09',headers:{authorization:'Bearer test-token'},body});
async function usingDB(db,fn){const original=globalThis.fetch;globalThis.fetch=db.fetch;try{await fn()}finally{globalThis.fetch=original}}
const payload=(expected=null)=>({config:plan(),request_id:randomUUID(),expected_revision:expected,user_id:'untrusted-other-user'});
test('API rejects unauthenticated calls and unsupported methods without database writes',async()=>{
  const a=response();await handler({...request(),headers:{}},a);assert.equal(a.code,401);assert.equal(a.headers['Cache-Control'],'private, no-store');
  const b=response();await handler(request('DELETE'),b);assert.equal(b.code,405);
});
test('API verifies the session server-side',async()=>usingDB(fakeDB({expired:true}),async()=>{const r=response();await handler(request(),r);assert.equal(r.code,401)}));
test('API rejects bad month and invalid plans without writing',async()=>{
  const db=fakeDB();await usingDB(db,async()=>{const r=response();await handler({...request(),url:'/api/budget-plan?month=2026-99'},r);assert.equal(r.code,400);const b=payload();b.config.incomes[0].amount=-1;const s=response();await handler(request('PUT',b),s);assert.equal(s.code,400);assert.equal(db.writes,0)});
});
test('API first save ignores forged owner and identical retries do not write twice',async()=>{
  const db=fakeDB();await usingDB(db,async()=>{const b=payload(),r=response();await handler(request('PUT',b),r);assert.equal(r.code,200);assert.equal(r.body.revision,b.request_id);const s=response();await handler(request('PUT',b),s);assert.equal(s.code,200);assert.equal(db.writes,1);assert.equal(db.current.user_id,user)});
});
test('API rejects stale revisions and same-request tampering; valid update preserves ownership',async()=>{
  const db=fakeDB();await usingDB(db,async()=>{const first=payload();await handler(request('PUT',first),response());const stale=response();await handler(request('PUT',payload()),stale);assert.equal(stale.code,409);const forged=structuredClone(first);forged.config.incomes[0].amount=5;const r=response();await handler(request('PUT',forged),r);assert.equal(r.code,409);const next=payload(first.request_id),s=response();await handler(request('PUT',next),s);assert.equal(s.code,200);assert.equal(db.current.revision,next.request_id);assert.equal(db.writes,2)});
});
test('API atomic compare-and-swap detects a race after reading the old revision',async()=>{
  const db=fakeDB({race:true});await usingDB(db,async()=>{const first=payload();await handler(request('PUT',first),response());const r=response();await handler(request('PUT',payload(first.request_id)),r);assert.equal(r.code,409)});
});
test('API paginates actual entries and flags the hard cap instead of claiming complete totals',async()=>{
  for(const [entryCount,complete] of [[501,true],[10001,false]]){const db=fakeDB({entryCount});await usingDB(db,async()=>{const r=response();await handler(request(),r);assert.equal(r.code,200);assert.equal(r.body.entries.length,Math.min(entryCount,10000));assert.equal(r.body.entries_complete,complete)})}
});

const project=(changes={})=>({id:'maintenance-a',taskKey:'property:task-a:2026-12-01',propertyName:'Maison',label:'Remplacer le chauffe-eau',category:'Maison',essential:false,totalAmount:900,savedAmount:300,dueDate:'2026-12-01',costSource:'estimate',confirmed:true,active:true,...changes});
test('maintenance savings use the remaining cost and months to deadline, with no annual floor',()=>{
  const p=plan();p.projects=[project()];const r=analyze(p);
  assert.equal(r.projects[0].remaining,60000);assert.equal(r.projects[0].months,4);assert.equal(r.projects[0].monthly,15000);
  assert.equal(r.totals.projects,15000);assert.equal(r.totals.provisions,0);assert.equal(r.projectedMargin,385000);
  p.projects=[project({dueDate:'2028-12-01',savedAmount:899})];assert.equal(analyze(p).projects[0].monthly,4);
  p.projects=[project({totalAmount:1,savedAmount:0,dueDate:'2026-11-01'})];assert.equal(analyze(p).projects[0].monthly,34);
});
test('one-off projects stop after their deadline and never renew in the next year',()=>{
  const p=plan();p.projects=[project()];const normalized=E.validate(p);
  assert.equal(E.events(normalized,'2026-12-01','2026-12-31').filter(x=>x.kind==='project').length,1);
  assert.equal(E.events(normalized,'2027-01-01','2027-12-31').filter(x=>x.kind==='project').length,0);
  assert.equal(E.analyze(normalized,[],'2027-01','2026-09-10').totals.projects,0);
  assert.equal(E.analyze(normalized,[],'2026-08','2026-09-10').totals.projects,0);
});
test('funded or closed projects require no new savings; reopening restores the unfunded amount',()=>{
  const p=plan();p.projects=[project({savedAmount:900})];assert.equal(analyze(p).totals.projects,0);
  p.projects=[project({active:false,dueDate:'2026-09-12'})];assert.equal(analyze(p).totals.projects,0);assert.equal(analyze(p).calendar.some(x=>x.kind==='project'),false);
  p.projects[0].active=true;assert.equal(analyze(p).totals.projects,60000);
});
test('a project due before payday deducts its unfunded cost once, without inventing a transaction',()=>{
  const p=plan();p.cash={balance:1000,asOf:'2026-09-10',todaySettled:true};p.projects=[project({dueDate:'2026-09-15'})];
  const r=analyze(p);assert.equal(r.cash.bills,60000);assert.equal(r.cash.reserve,0);assert.equal(r.cash.available,40000);
  assert.equal(r.actual.expense,0);assert.equal(r.totals.bills,0);assert.equal(r.calendar.find(x=>x.kind==='project').amount,90000);
});
test('future project reserves affect cash; a due or overdue unfunded project blocks a reassuring estimate',()=>{
  const p=plan();p.cash={balance:1000,asOf:'2026-09-10',todaySettled:true};p.projects=[project()];
  assert.equal(analyze(p).cash.reserve,2500);assert.equal(analyze(p).cash.available,97500);
  for(const dueDate of ['2026-09-10','2026-09-09']){p.projects=[project({dueDate})];const r=analyze(p);assert.equal(r.cash,null);assert.match(r.actions[0].title,/échéance/)}
});
test('project amounts, dates, confirmation and duplicate source occurrences are validated',()=>{
  for(const change of [{totalAmount:null},{totalAmount:-1},{totalAmount:0.001},{savedAmount:901},{dueDate:'2026-02-30'},{confirmed:false},{costSource:'verified-by-Nuvabri'},{taskKey:'x'.repeat(201)}]){
    const p=plan();p.projects=[project(change)];assert.throws(()=>E.validate(p));
  }
  const p=plan();p.projects=[project(),project({id:'maintenance-b'})];assert.throws(()=>E.validate(p),/déjà prévue/);
  p.projects[1].taskKey='property:task-a:2027-12-01';assert.equal(E.validate(p).projects.length,2);
  p.projects=[project({totalAmount:0,savedAmount:0})];assert.equal(analyze(p).totals.projects,0);
});
test('legacy plans load with no projects, while missing projects in an old client save preserve stored projects',async()=>{
  const old=plan();delete old.projects;assert.deepEqual(E.validate(old).projects,[]);
  const db=fakeDB();await usingDB(db,async()=>{
    const first=payload();first.config.projects=[project()];const a=response();await handler(request('PUT',first),a);assert.equal(a.code,200);
    assert.equal(db.current.config.projects,undefined);assert.equal(db.current.maintenance_projects.length,1);
    const b=response();await handler(request(),b);assert.equal(b.body.config.projects[0].label,project().label);
    const legacy=payload(first.request_id);delete legacy.config.projects;legacy.config.incomes[0].amount=2200;
    const c=response();await handler(request('PUT',legacy),c);assert.equal(c.code,200);assert.equal(c.body.config.projects.length,1);
    assert.equal(db.current.maintenance_projects.length,1);assert.equal(db.current.config.incomes[0].amount,2200);
  });
});
test('project save retries and stale revisions cannot duplicate or overwrite a project',async()=>{
  const db=fakeDB();await usingDB(db,async()=>{
    const b=payload();b.config.projects=[project()];const first=response();await handler(request('PUT',b),first);assert.equal(first.code,200);
    const retry=response();await handler(request('PUT',b),retry);assert.equal(retry.code,200);assert.equal(db.writes,1);
    const stale=payload();stale.config.projects=[project({totalAmount:1000})];const conflict=response();await handler(request('PUT',stale),conflict);assert.equal(conflict.code,409);assert.equal(db.current.maintenance_projects[0].totalAmount,900);
    const clear=payload(b.request_id),removed=response();await handler(request('PUT',clear),removed);assert.equal(removed.code,200);assert.deepEqual(db.current.maintenance_projects,[]);
  });
});

test('project scenario recalculates the whole current month without mutating or duplicating the plan',()=>{
  const p=plan();p.bills=[row('rent',1000,'2026-09-01')];p.envelopes=[row('food',500,'2026-09-01','monthly','Épicerie')];
  p.provisions=[{id:'tax',label:'Taxes',category:'Maison',essential:true,annualAmount:1200,savedAmount:1200,dueDate:'2026-12-01'}];
  const project={id:'project-a',label:'Chauffe-eau',category:'Maison',essential:false,totalAmount:1200,savedAmount:400,dueDate:'2026-12-01',costSource:'quote',confirmed:true,active:true,taskKey:'task:a',propertyName:'Maison'};
  p.projects=[project,{...project,id:'project-b',taskKey:'task:b',totalAmount:600,savedAmount:0,dueDate:'2027-02-01'}];
  const original=JSON.stringify(p),r=E.compareProject(p,'project-a',{totalAmount:1600,savedAmount:400,dueDate:'2026-11-01'},'2026-09-10');
  assert.equal(r.before.funding.monthly,20000);assert.equal(r.after.funding.monthly,40000);assert.equal(r.monthlyDelta,20000);
  assert.equal(r.before.margin,210000);assert.equal(r.after.margin,190000);assert.equal(r.marginDelta,-20000);
  assert.equal(r.after.project.id,'project-a');assert.equal(r.after.project.taskKey,'task:a');assert.equal(JSON.stringify(p),original);
});
test('scenario cost changes become estimates while date-only changes retain the declared quote',()=>{
  const p=plan();p.projects=[{id:'p',label:'Projet',category:'Maison',totalAmount:1000,savedAmount:0,dueDate:'2026-12-01',costSource:'quote',confirmed:true,active:true}];
  const r=E.compareProject(p,'p',{totalAmount:1000,savedAmount:0,dueDate:'2027-02-01'},'2026-09-10');
  assert.equal(r.after.project.costSource,'quote');assert.equal(r.after.funding.monthly,16667);assert.equal(r.monthlyDelta,-8333);
  const changed=E.compareProject(p,'p',{totalAmount:1100,savedAmount:0,dueDate:'2027-02-01'},'2026-09-10');
  assert.equal(changed.after.project.costSource,'estimate');
});
test('scenarios refuse invalid costs, past dates, closed projects and unknown identifiers',()=>{
  const p=plan();p.projects=[{id:'p',label:'Projet',category:'Maison',totalAmount:100,savedAmount:0,dueDate:'2026-09-01',costSource:'estimate',confirmed:true,active:true}];
  const changes={totalAmount:100,savedAmount:0,dueDate:'2026-09-10'};
  for(const bad of [{totalAmount:null},{totalAmount:-1},{totalAmount:10.001},{savedAmount:101},{dueDate:'2026-02-30'},{dueDate:'2026-09-09'}])assert.throws(()=>E.compareProject(p,'p',{...changes,...bad},'2026-09-10'));
  assert.throws(()=>E.compareProject(p,'absent',changes,'2026-09-10'));
  const r=E.compareProject(p,'p',changes,'2026-09-10');assert.equal(r.before.funding.overdue,true);assert.equal(r.after.funding.months,1);
  p.projects[0].active=false;assert.throws(()=>E.compareProject(p,'p',changes,'2026-09-10'));
});
test('an incomplete plan has no reassuring scenario margin and a fully funded project needs no reserve',()=>{
  const p=E.empty();p.projects=[{id:'p',label:'Projet',category:'Maison',totalAmount:1200,savedAmount:400,dueDate:'2026-12-01',costSource:'estimate',confirmed:true,active:true}];
  const r=E.compareProject(p,'p',{totalAmount:1200,savedAmount:1200,dueDate:'2026-12-01'},'2026-09-10');
  assert.equal(r.after.funding.monthly,0);assert.equal(r.monthlyDelta,-20000);assert.equal(r.before.margin,null);assert.equal(r.after.margin,null);assert.equal(r.marginDelta,null);
});

test('API saves account balances and preserves them for an older client while allowing explicit clearing',async()=>{
  const db=fakeDB();await usingDB(db,async()=>{
    const first=payload();first.config.bills=[{...row('tfsa',50,'2026-09-10','weekly','CELI'),accountBalance:1000}];
    const saved=response();await handler(request('PUT',first),saved);assert.equal(saved.code,200);assert.equal(saved.body.config.bills[0].accountBalance,1000);
    const old={config:structuredClone(saved.body.config),request_id:randomUUID(),expected_revision:first.request_id};delete old.config.bills[0].accountBalance;old.config.bills[0].amount=60;
    const updated=response();await handler(request('PUT',old),updated);assert.equal(updated.code,200);assert.equal(updated.body.config.bills[0].accountBalance,1000);
    const retry=response();await handler(request('PUT',old),retry);assert.equal(retry.code,200);assert.equal(db.writes,2);
    const invalid={config:structuredClone(updated.body.config),request_id:randomUUID(),expected_revision:old.request_id};invalid.config.bills[0].accountBalance=-1;
    const rejected=response();await handler(request('PUT',invalid),rejected);assert.equal(rejected.code,400);assert.equal(db.writes,2);
    const clear={...invalid,request_id:randomUUID()};clear.config.bills[0].accountBalance=null;
    const cleared=response();await handler(request('PUT',clear),cleared);assert.equal(cleared.code,200);assert.equal(cleared.body.config.bills[0].accountBalance,null);
    const removed={config:{...cleared.body.config,bills:[]},request_id:randomUUID(),expected_revision:clear.request_id};
    const deleted=response();await handler(request('PUT',removed),deleted);assert.equal(deleted.code,200);assert.equal(deleted.body.config.bills.length,0);
  });
});
