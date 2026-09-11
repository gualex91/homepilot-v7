import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import payments from '../api/asset-payments.js';
import budget from '../api/budget-plan.js';
import deleteProperty from '../api/property-delete.js';
const P=globalThis.hpAssetPaymentEngine,E=globalThis.hpBudgetEngine;
const user=randomUUID(),asset=randomUUID();
const response=()=>({code:200,status(n){this.code=n;return this},setHeader(){},json(body){this.body=body;return this}});
function db(){
 const state={payments:[],plan:null,property:true,allowDelete:true,calls:[],race:false};
 state.fetch=async(input,options={})=>{
  const url=new URL(input),table=url.pathname.split('/').pop(),method=options.method||'GET';state.calls.push({url,method,options});
  if(table==='user')return Response.json({id:user});
  assert.equal(options.headers.Authorization,'Bearer test');
  const body=options.body?JSON.parse(options.body):null;
  if(table==='properties'||table==='leisure_equipment'){
   if(method==='DELETE'&&state.allowDelete&&state.property){state.property=false;state.payments=[];return Response.json([{id:asset}]);}
   return Response.json(method==='DELETE'?[]:state.property?[{id:asset,name:'remorque'}]:[]);
  }
  if(table==='asset_payments'){
   assert.equal(method==='POST'?body.user_id:url.searchParams.get('user_id'),method==='POST'?user:'eq.'+user);
   let rows=state.payments.filter(row=>[...url.searchParams].every(([key,v])=>!['property_id','leisure_equipment_id','revision'].includes(key)||v==='eq.'+row[key]));
   if(method==='POST'){if(state.payments.length)return Response.json([]);state.payments.push(body);return Response.json([body]);}
   if(method==='PATCH'){if(state.race){state.payments[0].revision=randomUUID();return Response.json([]);}rows.forEach(row=>Object.assign(row,body));return Response.json(rows);}
   if(method==='DELETE'){state.payments=state.payments.filter(row=>!rows.includes(row));return Response.json(rows);}
   return Response.json(rows.map(row=>({...row,leisure_equipment:{name:'remorque'},properties:{name:'Maison'}})));
  }
  if(table==='budget_plans'){
   if(method==='POST'){assert.equal(body.user_id,user);state.plan=body;return Response.json([body]);}
   assert.equal(url.searchParams.get('user_id'),'eq.'+user);
   if(method==='PATCH')state.plan={...state.plan,...body};return Response.json(state.plan?[state.plan]:[]);
  }
  assert.equal(url.searchParams.get('user_id'),'eq.'+user);return Response.json([]);
 };return state;
}
async function call(handler,method,body,query={}){const res=response();await handler({method,headers:{authorization:'Bearer test'},body,query,url:'/api/budget-plan?month=2026-09'},res);return res;}
const payment=()=>({kind:'leisure',asset_id:asset,user_id:'forged',amount:70,frequency:'weekly',anchor_date:'2026-09-04',second_day:null,essential:false,expected_revision:null,request_id:randomUUID()});
test('weekly payment has an annual estimate and average monthly value, with actual monthly dates',()=>{
 assert.deepEqual(P.totals(70,'weekly'),{annual:364000,monthly:30333});
 assert.deepEqual(P.totals(70,'biweekly'),{annual:182000,monthly:15167});
 assert.deepEqual(P.totals(70,'semimonthly'),{annual:168000,monthly:14000});
 const row={id:'p',amount:70,frequency:'weekly',anchor_date:'2026-09-04',asset_name:'remorque',leisure_equipment_id:asset};
 const p=P.merge(E.empty(),[row]);assert.equal(p.bills[0].label,'Paiement remorque');
 assert.equal(E.analyze(p,[],'2026-09','2026-09-11').totals.bills,28000);
 assert.equal(E.analyze(p,[],'2026-10','2026-09-11').totals.bills,35000);
 assert.equal(P.merge(p,[{...row,amount:80}]).bills.length,1);
 assert.equal(P.merge(p,[]).bills.length,0);
});
test('payment API saves for the verified user and retries without duplicating; edits require the current revision',async t=>{
 const d=db();t.mock.method(globalThis,'fetch',d.fetch);const body=payment();
 let r=await call(payments,'PUT',body);assert.equal(r.code,200);assert.equal(d.payments.length,1);assert.equal(d.payments[0].user_id,user);
 const id=r.body.payment.id;r=await call(payments,'PUT',body);assert.equal(r.code,200);assert.equal(d.payments.length,1);
 r=await call(payments,'PUT',{...body,amount:99});assert.equal(r.code,409);assert.equal(d.payments[0].amount,70);
 const edit={...body,amount:80,expected_revision:body.request_id,request_id:randomUUID()};r=await call(payments,'PUT',edit);
 assert.equal(r.code,200);assert.equal(r.body.payment.id,id);assert.equal(d.payments.length,1);assert.equal(d.payments[0].amount,80);
 r=await call(payments,'DELETE',body);assert.equal(r.code,409);assert.equal(d.payments.length,1);
 const remove={...edit,expected_revision:edit.request_id,request_id:randomUUID()};r=await call(payments,'DELETE',remove);assert.equal(r.code,200);assert.equal(d.payments.length,0);
 r=await call(payments,'DELETE',remove);assert.equal(r.code,200);
});
test('invalid dates, amounts, missing access and a concurrent payment edit do not overwrite data',async t=>{
 const d=db();t.mock.method(globalThis,'fetch',d.fetch);
 for(const patch of [{amount:-1},{amount:0},{amount:1.001},{amount:'70'},{anchor_date:'2026-02-30'},{frequency:'bad'},{frequency:'semimonthly',anchor_date:'2026-09-15',second_day:10}]){const r=await call(payments,'PUT',{...payment(),...patch});assert.equal(r.code,400);}
 assert.equal(d.payments.length,0);d.property=false;assert.equal((await call(payments,'PUT',payment())).code,404);d.property=true;
 const initial=payment();await call(payments,'PUT',initial);d.race=true;
 assert.equal((await call(payments,'PUT',{...initial,amount:88,expected_revision:initial.request_id,request_id:randomUUID()})).code,409);assert.equal(d.payments[0].amount,70);
});
test('budget projects current payments at read/save time, ignores stale linked copies, and preserves manual lines',async t=>{
 const d=db();t.mock.method(globalThis,'fetch',d.fetch);const initial=payment();await call(payments,'PUT',initial);
 let r=await call(budget,'GET');assert.equal(r.code,200);assert.equal(r.body.config.bills.length,1);assert.equal(r.body.config.bills[0].amount,70);
 const linked=r.body.config.bills[0],manual={...linked,id:'manual',label:'Téléphone',amount:50,frequency:'monthly'};
 const body={config:{...E.empty(),bills:[manual,{...linked,amount:999}]},expected_revision:null,request_id:randomUUID()};
 r=await call(budget,'PUT',body);assert.equal(r.code,200);assert.equal(d.plan.config.bills.length,1);assert.equal(r.body.config.bills.length,2);assert.equal(r.body.config.bills[1].amount,70);
 // An old client omitting the linked line must not erase the asset payment.
 const old={config:{...body.config,bills:[manual]},expected_revision:body.request_id,request_id:randomUUID()};
 r=await call(budget,'PUT',old);assert.equal(r.code,200);assert.equal(r.body.config.bills.length,2);
 d.payments=[];r=await call(budget,'GET');assert.equal(r.body.config.bills.length,1);assert.equal(r.body.config.bills[0].label,'Téléphone');
});
test('property deletion is scoped, rejects denied deletion and accepts an already completed retry',async t=>{
 const d=db();t.mock.method(globalThis,'fetch',d.fetch);d.allowDelete=false;
 let r=await call(deleteProperty,'DELETE',null,{id:asset});assert.equal(r.code,403);assert.equal(d.property,true);
 d.allowDelete=true;r=await call(deleteProperty,'DELETE',null,{id:asset});assert.equal(r.code,200);assert.equal(d.property,false);
 r=await call(deleteProperty,'DELETE',null,{id:asset});assert.equal(r.code,200);
 assert.ok(d.calls.filter(x=>x.url.pathname.endsWith('/properties')).every(x=>x.url.searchParams.get('id')==='eq.'+asset));
});
