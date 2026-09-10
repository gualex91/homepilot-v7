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
