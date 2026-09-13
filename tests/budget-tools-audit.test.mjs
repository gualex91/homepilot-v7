import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import proxy from '../api/budget-data.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const cases=[
 {file:'budget-debts-loans.js',form:'hpDebtForm',button:'hpDebtSave',table:'budget_debts',required:'hpDebtBalance',values:{hpDebtType:'personal_loan',hpDebtName:'Prêt <test>',hpDebtInstitution:'Institution test',hpDebtOriginal:'1200',hpDebtBalance:'1200',hpDebtRate:'0',hpDebtPayment:'100',hpDebtFrequency:'weekly',hpDebtNext:'2026-09-20',hpDebtTarget:'2027-01-01',hpDebtNotes:'Notes de test'}},
 {file:'budget-savings-goals.js',form:'hpSavingsForm',button:'hpSavingsSave',table:'budget_savings_goals',required:'hpSavingsTarget',values:{hpSavingsName:'Projet <test>',hpSavingsTarget:'1000',hpSavingsCurrent:'100',hpSavingsDate:'2027-09-20',hpSavingsNotes:'Notes de test'}},
 {file:'budget-net-worth.js',form:'hpAssetForm',button:'hpAssetSave',table:'budget_assets',required:'hpAssetValue',values:{hpAssetType:'vehicle',hpAssetName:'Actif <test>',hpAssetValue:'1200',hpAssetInstitution:'Institution test',hpAssetNotes:'Notes de test'}},
 {file:'budget-recurring-payments.js',form:'hpRecurringForm',button:'hpRpSave',table:'budget_recurring_payments',required:'hpRpDue',values:{hpRpName:'Facture <test>',hpRpCategory:'Internet',hpRpAmount:'80',hpRpFrequency:'monthly',hpRpDue:'2026-09-20',hpRpReminder:'7',hpRpAutopay:true,hpRpNotes:'Notes de test'}},
 {file:'budget-mortgage.js',form:'hpMortgageForm',button:'hpMortgageSave',table:'mortgage_renewals',required:'hpMortgageDate',values:{hpMortgageLender:'Institution test',hpMortgageDate:'2027-09-20',hpMortgageBalance:'120000',hpMortgageRate:'4.5',hpMortgagePayment:'800',hpMortgageFreq:'monthly',hpMortgageReminder:'120',hpMortgageNotes:'Notes de test'}},
 {file:'budget-category-targets.js',form:'hpTargetForm',button:'hpTargetSave',table:'budget_category_targets',required:'hpTargetAmount',values:{hpTargetCategory:'Épicerie',hpTargetAmount:'600',hpTargetThreshold:'80'}}
];
const payloadFields={hpDebtType:'debt_type',hpDebtName:'name',hpDebtInstitution:'institution',hpDebtOriginal:'original_balance',hpDebtBalance:'current_balance',hpDebtRate:'interest_rate',hpDebtPayment:'payment_amount',hpDebtFrequency:'payment_frequency',hpDebtNext:'next_payment_date',hpDebtTarget:'target_payoff_date',hpDebtNotes:'notes',hpSavingsName:'name',hpSavingsTarget:'target_amount',hpSavingsCurrent:'current_amount',hpSavingsDate:'target_date',hpSavingsNotes:'notes',hpAssetType:'asset_type',hpAssetName:'name',hpAssetValue:'estimated_value',hpAssetInstitution:'institution',hpAssetNotes:'notes',hpRpName:'name',hpRpCategory:'category',hpRpAmount:'amount',hpRpFrequency:'frequency',hpRpDue:'next_due_date',hpRpReminder:'reminder_days',hpRpAutopay:'autopay',hpRpNotes:'notes',hpMortgageLender:'lender',hpMortgageDate:'renewal_date',hpMortgageBalance:'current_balance',hpMortgageRate:'interest_rate',hpMortgagePayment:'payment_amount',hpMortgageFreq:'payment_frequency',hpMortgageReminder:'reminder_days',hpMortgageNotes:'notes',hpTargetCategory:'category',hpTargetAmount:'monthly_target',hpTargetThreshold:'alert_threshold'};
// DOM validity and requests are simulated here; this is not an iPhone/browser test.
function harness(config){
 const nodes=new Map(),writes=[],alerts=[],intervals=[],storage=new Map(),rows=new Map();let fail=false,hold=null;
 class Element{
  constructor(){this.value='';this.dataset={};this.style={};this.children=[];this.classList={add(){},remove(){},toggle(){}};this.attrs={};}
  set id(id){this._id=id;nodes.set(id,this)}get id(){return this._id}
  set innerHTML(html){this.html=html;for(const m of html.matchAll(/<(input|select|textarea|button|div|b|span)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
   const n=nodes.get(m[3])||new Element();n.id=m[3];n.tag=m[1];
   for(const attr of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))n.attrs[attr[1]]=attr[2]??true;
   n.value=n.attrs.value||'';this.children.push(n);
  }}get innerHTML(){return this.html||''}
  querySelector(){return null}querySelectorAll(){return this.id===config.form?Object.keys(config.values).map(id=>nodes.get(id)):[]}
  appendChild(n){n.parentElement=this;this.children.push(n)}prepend(n){this.appendChild(n)}insertBefore(n){this.appendChild(n)}
  addEventListener(){}remove(){}focus(){this.focused=true}reportValidity(){this.reported=true}
  checkValidity(){const value=String(this.value);if(this.attrs.required&&!value.trim())return false;if(!value)return true;
   if(this.attrs.type==='number'){
    const n=Number(value),min=Number(this.attrs.min||0),step=Number(this.attrs.step||1),units=(n-min)/step;
    return Number.isFinite(n)&&(!('min' in this.attrs)||n>=min)&&(!('max' in this.attrs)||n<=Number(this.attrs.max))&&(this.attrs.step==='any'||Math.abs(units-Math.round(units))<1e-6);
   }
   if(this.attrs.type==='date')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
   return true;
  }
 }
 for(const id of ['budget','tl']){const el=new Element();el.id=id}
 const client={auth:{getUser:async()=>({data:{user:{id:'owner-test'}}})},from(table){
  let write=null,single=false;const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},maybeSingle(){single=true;return q},
   upsert(payload,options){write={table,payload,options};return q},insert(payload){write={table,payload};return q},update(payload){write={table,payload};return q},delete(){write={table,payload:null};return q},
   then(resolve,reject){return (async()=>{if(write){writes.push(write);if(hold)await hold;if(fail){fail=false;throw new Error('Uncertain write')};rows.set(table,[{active:true,...write.payload}]);return {error:null,data:null}}
    const data=rows.get(table)||[];return {data:single?data[0]||null:data,error:null};})().then(resolve,reject)}};return q;
 }};
 const ctx={document:{readyState:'complete',visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener(){}},console,Date,Intl,URL,URLSearchParams,crypto:webcrypto,
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout(){},clearTimeout(){},setInterval(fn,ms){intervals.push(ms)},MutationObserver:class{observe(){}},alert:x=>alerts.push(x),confirm:()=>true,
  supabaseClient:client,addEventListener(){},dispatchEvent(){},Event:class{},CustomEvent:class{}};ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['stability-core.js',config.file])vm.runInContext(source(file),ctx,{filename:file});
 const tick=()=>new Promise(r=>setImmediate(r));
 const fill=()=>{for(const [id,value] of Object.entries(config.values)){const n=nodes.get(id);assert.ok(n,id);if(typeof value==='boolean')n.checked=value;else n.value=value}};
 return {ctx,nodes,writes,rows,intervals,alerts,tick,fill,fail(){fail=true},hold(value){hold=value},save:()=>nodes.get(config.button).onclick()};
}
for(const config of cases){
 test(config.file+': every declared field submits, required blanks and negative amounts do not',async()=>{
  const h=harness(config);await h.tick();
  for(const id of Object.keys(config.values).filter(id=>h.nodes.get(id).attrs.required)){h.fill();h.nodes.get(id).value='';await h.save();assert.equal(h.writes.length,0);assert.equal(h.nodes.get(id).reported,true)}
  for(const id of Object.keys(config.values).filter(id=>h.nodes.get(id).attrs.type==='number')){h.fill();h.nodes.get(id).value='-1';await h.save();assert.equal(h.writes.length,0,id)}
  for(const id of Object.keys(config.values).filter(id=>h.nodes.get(id).attrs.type==='date')){h.fill();h.nodes.get(id).value='2026-02-30';await h.save();assert.equal(h.writes.length,0,id)}
  h.fill();await h.save();await h.tick();assert.equal(h.writes.length,1);assert.equal(h.writes[0].table,config.table);assert.equal(h.writes[0].payload.user_id,'owner-test');assert.equal(h.nodes.get(config.button).disabled,false);
  for(const [id,value] of Object.entries(config.values))assert.equal(String(h.writes[0].payload[payloadFields[id]]),String(value),id+' survives submission');
 });
 test(config.file+': money fields accept cents',async()=>{const h=harness(config);await h.tick();h.fill();for(const id of Object.keys(config.values).filter(id=>h.nodes.get(id).attrs.type==='number'))h.nodes.get(id).value=String(Number(config.values[id])+0.25);await h.save();await h.tick();assert.equal(h.writes.length,1);for(const id of Object.keys(config.values).filter(id=>h.nodes.get(id).attrs.type==='number'))assert.equal(h.writes[0].payload[payloadFields[id]],Number(config.values[id])+0.25,id)});
 if(config.table!=='budget_category_targets')test(config.file+': double click and uncertain retry retain one request identity',async()=>{
  const h=harness(config);await h.tick();h.fill();let release;h.hold(new Promise(r=>release=r));const first=h.save();await h.tick();await h.save();assert.equal(h.writes.length,1);
  h.fail();release();await first;assert.ok(h.alerts.length);assert.equal(h.nodes.get(config.button).disabled,false);
  h.hold(null);await h.save();assert.equal(h.writes.length,2);assert.equal(h.writes[0].payload.id,h.writes[1].payload.id);
 });
}
test('zero-interest weekly debt is about three months, and missing interest stays unknown',async()=>{
 const c=cases[0],h=harness(c);await h.tick();h.fill();await h.save();await h.tick();assert.match(h.nodes.get('hpDebtList').innerHTML,/~3 mois/);
 h.rows.get(c.table)[0].interest_rate=null;await h.ctx.hpLoadDebts();assert.match(h.nodes.get('hpDebtList').innerHTML,/Renseigne le paiement et le taux/);assert.doesNotMatch(h.nodes.get('hpDebtList').innerHTML,/~3 mois/);
});
test('mortgage background polling is at most once per minute',()=>{const h=harness(cases[4]);assert.deepEqual(h.intervals,[60000])});
test('budget proxy bounds upstream waits and emits no credentials or financial fields in diagnostics',async()=>{
 const realFetch=globalThis.fetch,realError=console.error,logs=[];
 globalThis.fetch=async(url,options)=>{assert.ok(options.signal instanceof AbortSignal);throw Object.assign(new Error('secret-value'),{name:'TimeoutError'})};console.error=x=>logs.push(x);
 try{const res={status(code){this.code=code;return this},setHeader(){},json(body){this.body=body;return this}};
  await proxy({method:'GET',headers:{authorization:'Bearer private-token'},url:'/api/budget-data?table=budget_debts'},res);
  assert.equal(res.code,504);assert.equal(res.body.code,'BUDGET_TIMEOUT');assert.match(logs[0],/upstream_timeout/);assert.doesNotMatch(logs[0],/private-token|secret-value/);
 }finally{globalThis.fetch=realFetch;console.error=realError}
});
