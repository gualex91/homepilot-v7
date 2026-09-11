import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));

// Exercise the shipped event handlers and engine with a small DOM adapter.
// This covers UI/data behavior, not browser layout; all requests are simulated.
function harness({loadFailure=false}={}){
  const nodes=new Map(),events={},requests=[],storage=new Map(),navigation=[],confirmations=[];
  class Element{
    constructor(){this.dataset={};this.handlers={};this.attributes={};this.hidden=false;this.value='';this.checked=false;this.textContent='';this.classList={add(){},remove(){},contains(){return false}}}
    set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
    set innerHTML(html){this._html=html;for(const m of html.matchAll(/\bid="([^"]+)"/g)){const child=new Element();child.id=m[1]}}
    get innerHTML(){return this._html||''}
    setAttribute(k,v){this.attributes[k]=v}
    addEventListener(k,fn){this.handlers[k]=fn}
    querySelector(){return {after(){}}}querySelectorAll(){return []}
    appendChild(child){child.parentElement=this;return child}
    contains(){return true}closest(){return {setAttribute(){}}}
    focus(){this.focused=true}scrollIntoView(){}
  }
  const budget=new Element();budget.id='budget';const home=new Element();home.id='home';
  let authCallback,session={user:{id:'owner-a'},access_token:'test'},stored=null,revision=null,failSave=false;
  const FixedDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-09-10T12:00:00Z']))}static now(){return new Date('2026-09-10T12:00:00Z').getTime()}};
  const ctx=vm.createContext({Date:FixedDate,Intl,URL,URLSearchParams,AbortSignal,structuredClone,crypto:webcrypto,console,
    confirm:message=>{confirmations.push(message);return true},alert(){},setTimeout:fn=>{Promise.resolve().then(fn)},setInterval(){},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{readyState:'loading',getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(key,fn)=>{(events[key]??=[]).push(fn)}},
    addEventListener:(key,fn)=>{(events[key]??=[]).push(fn)},show:id=>navigation.push(id),
    supabaseClient:{auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>authCallback=fn}},
    fetch:async(url,options)=>{
      requests.push({url,options});if(!session)return {ok:false,json:async()=>({error:'Session expirée.'})};
      if(options.method==='GET')return {ok:!loadFailure,json:async()=>loadFailure?{error:'Indisponible'}:{config:stored,revision,entries:[],entries_complete:true,legacy:null}};
      const body=JSON.parse(options.body);if(!stored||revision!==body.request_id){
        if(body.expected_revision!==revision)return {ok:false,status:409,json:async()=>({error:'Ton budget a changé sur un autre appareil.'})};
        stored=body.config;revision=body.request_id;
      }
      if(failSave){failSave=false;throw Object.assign(new Error('timeout'),{name:'TimeoutError'})}
      return {ok:true,json:async()=>({config:stored,revision})};
    }
  });ctx.window=ctx;
  for(const file of ['stability-core.js','budget-engine.js','asset-payment-engine.js','maintenance-budget.js','budget-catalog.js','budget-insights.js','budget-planner.js'])vm.runInContext(source(file),ctx,{filename:file});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const input=(field,value,type='number',event='input')=>{const target=nodes.get('hf-'+field.replaceAll('.','-'))||{};Object.assign(target,{dataset:{field},value:String(value),type,checked:value===true});return nodes.get('hpBudgetPlanner').handlers[event]({target})};
  const click=(action,data={})=>{const b={dataset:{action,...data},closest(){return this},getAttribute(){return null}};return nodes.get('hpBudgetPlanner').handlers.click({target:b})};
  return {ctx,nodes,requests,navigation,confirmations,input,click,tick,stored:()=>stored,
    failLoad(value=true){loadFailure=value},
    remoteSave(config){stored=structuredClone(config);revision=webcrypto.randomUUID()},
    async refresh(){for(const fn of events['hp-budget-loaded']||[])fn();await tick()},
    payments(rows,owner='owner-a'){for(const fn of events['hp-asset-payments-changed']||[])fn({detail:{owner,payments:rows}})},
    scenarioInput(key,value){const target={dataset:{scenarioField:key},value:String(value)};return nodes.get('hpBudgetPlanner').handlers.input({target})},
    async start(){for(const fn of events.DOMContentLoaded||[])fn();await tick()},
    async task(task={id:'task-a',title:'Entretien du spa',due_at:'2026-12-01'},property='Chalet',kind='property'){
      const html=ctx.hpMaintenanceBudget.button(task,property,kind),encoded=html.match(/data-maintenance-budget="([^"]+)"/)?.[1];
      return encoded?ctx.hpPlanMaintenanceTask(JSON.parse(decode(encoded))):false;
    },failSave(){failSave=true},logout(){session=null;authCallback('SIGNED_OUT',null)},
    async owner(id){session={user:{id},access_token:'test-'+id};stored=null;revision=null;authCallback('SIGNED_IN',session);await tick()}
  };
}

test('task to budget requires a cost, confirmation and explicit save; repeat clicks edit the same project',async()=>{
  const h=harness();await h.start();await h.task();await h.task();
  assert.equal(h.requests.filter(r=>r.options.method==='PUT').length,0);
  assert.equal((h.nodes.get('hpFinanceEditor').innerHTML.match(/id="hpFinanceProject-\d+"/g)||[]).length,1);
  assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/Chalet/);assert.ok(h.navigation.every(x=>x==='budget'));
  await h.click('save');assert.equal(h.requests.filter(r=>r.options.method==='PUT').length,0);
  h.input('projects.0.totalAmount',1200);h.input('projects.0.savedAmount',400);
  assert.match(h.nodes.get('hpFinanceProjectFunding-0').textContent,/200,00/);
  await h.click('save');assert.equal(h.requests.filter(r=>r.options.method==='PUT').length,0);
  h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  assert.equal(h.stored().projects.length,1);assert.equal(h.stored().projects[0].totalAmount,1200);
  assert.equal(h.stored().projects[0].taskKey,'property:task-a:2026-12-01');
  await h.ctx.hpLoadFinancePlan({force:true});await h.task();assert.equal(h.stored().projects.length,1);
  assert.match(h.nodes.get('hpFinanceStatus').textContent,/déjà/);
});
test('editing the cost requires renewed confirmation and an uncertain save reuses its request ID',async()=>{
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',100);h.input('projects.0.confirmed',true,'checkbox');
  h.input('projects.0.totalAmount',200);await h.click('save');assert.equal(h.requests.filter(r=>r.options.method==='PUT').length,0);
  h.input('projects.0.confirmed',true,'checkbox');h.failSave();await h.click('save');assert.match(h.nodes.get('hpFinanceStatus').textContent,/Confirmation non reçue/);
  await h.click('save');const writes=h.requests.filter(r=>r.options.method==='PUT').map(r=>JSON.parse(r.options.body));
  assert.equal(writes.length,2);assert.equal(writes[0].request_id,writes[1].request_id);assert.equal(h.stored().projects.length,1);
});
test('changing a confirmed amount visibly unchecks confirmation and shows the save error beside the button',async()=>{
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',100);h.input('projects.0.confirmed',true,'checkbox');
  const check=h.nodes.get('hf-projects-0-confirmed');assert.ok(check,'confirmation must be addressable in the rendered form');assert.equal(check.checked,true);
  h.input('projects.0.totalAmount',200);assert.equal(check.checked,false);
  await h.click('save');assert.equal(h.requests.filter(r=>r.options.method==='PUT').length,0);
  assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/Confirme/);assert.equal(h.nodes.get('hpFinanceSaveStatus').focused,true);
  h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  assert.equal(h.stored().projects[0].totalAmount,200);assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/Plan enregistré/);
});
test('change events commit form values and network save errors remain beside the retry button',async()=>{
  const h=harness();await h.start();await h.task();
  h.input('projects.0.totalAmount',250,'number','change');h.input('projects.0.confirmed',true,'checkbox','change');
  h.failSave();await h.click('save');assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/Confirmation non reçue/);
  await h.click('save');assert.equal(h.stored().projects[0].totalAmount,250);assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/Plan enregistré/);
});
test('different recurring occurrences stay separate; task and property labels cannot inject HTML',async()=>{
  const h=harness();await h.start();const task={id:'same',title:'<img src=x onerror="attack()">',due_date:'2026-12-01'};
  await h.task(task,'<svg onload="attack()">','leisure');await h.task({...task,due_date:'2027-12-01'},'Bateau','leisure');
  const html=h.nodes.get('hpFinanceEditor').innerHTML;assert.equal((html.match(/id="hpFinanceProject-\d+"/g)||[]).length,2);
  assert.doesNotMatch(html,/<img|<svg/);assert.match(html,/&lt;img/);
  assert.equal(h.ctx.hpMaintenanceBudget.button({...task,status:'done'}),'');
});
test('unavailable budgets cannot accept a task and a new account never inherits the old draft',async()=>{
  const unavailable=harness({loadFailure:true});await unavailable.start();assert.equal(await unavailable.task(),false);assert.equal(unavailable.stored(),null);
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',7654);h.logout();
  assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/7654|Chalet/);
  await h.owner('owner-b');await h.task({id:'new',title:'Filtre',due_at:'2026-10-01'},'Maison');
  assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/7654|Chalet/);
});


test('scenario calculations are temporary; applying updates the same project and requires confirmation and save',async()=>{
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',1200);h.input('projects.0.savedAmount',400);h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  const id=h.stored().projects[0].id,writes=h.requests.filter(x=>x.options.method==='PUT').length;
  await h.click('scenario-open',{projectId:id});h.scenarioInput('totalAmount',1600);h.scenarioInput('dueDate','2026-11-01');
  assert.match(h.nodes.get('hpScenarioResult').innerHTML,/200,00.*de plus/);assert.equal(h.stored().projects[0].totalAmount,1200);
  assert.equal(h.requests.filter(x=>x.options.method==='PUT').length,writes);
  await h.ctx.hpLoadFinancePlan();assert.equal(h.nodes.get('hpScenarioApply').disabled,false);
  await h.click('scenario-apply');assert.equal(h.nodes.get('hpFinanceScenario').hidden,true);
  await h.click('save');assert.equal(h.requests.filter(x=>x.options.method==='PUT').length,writes);
  h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  assert.equal(h.stored().projects.length,1);assert.equal(h.stored().projects[0].id,id);assert.equal(h.stored().projects[0].totalAmount,1600);assert.equal(h.stored().projects[0].dueDate,'2026-11-01');
});
test('closing or invalidating a scenario never modifies the plan and logout clears its amounts',async()=>{
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',500);h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  const id=h.stored().projects[0].id;
  await h.click('scenario-open',{projectId:id});h.scenarioInput('totalAmount',9876);await h.click('scenario-close');
  assert.equal(h.stored().projects[0].totalAmount,500);assert.equal(h.nodes.get('hpFinanceScenario').innerHTML,'');
  await h.click('scenario-open',{projectId:id});h.scenarioInput('savedAmount',600);assert.equal(h.nodes.get('hpScenarioApply').disabled,true);
  await h.click('scenario-apply');assert.equal(h.stored().projects[0].totalAmount,500);
  h.logout();assert.equal(h.nodes.get('hpFinanceScenario').innerHTML,'');assert.equal(h.nodes.get('hpFinanceScenario').hidden,true);
});
test('a scenario cannot overwrite a plan changed during comparison',async()=>{
  const h=harness();await h.start();await h.task();h.input('projects.0.totalAmount',500);h.input('projects.0.confirmed',true,'checkbox');await h.click('save');
  await h.click('scenario-open',{projectId:h.stored().projects[0].id});h.scenarioInput('totalAmount',800);
  h.stored().projects[0].totalAmount=700;await h.ctx.hpLoadFinancePlan();
  assert.equal(h.nodes.get('hpScenarioApply').disabled,true);assert.match(h.nodes.get('hpScenarioResult').innerHTML,/plan a changé/);
  await h.click('scenario-apply');assert.equal(h.stored().projects[0].totalAmount,700);
});

test('guided entry saves income, family and daily expenses; repeated category choice reopens its total',async()=>{
  const h=harness();await h.start();
  async function choose(kind,id){await h.click('choose',{kind});h.nodes.get('hpFinanceTemplate').value=id;await h.click('template')}
  await choose('income','salary');h.input('incomes.0.amount',2000);
  await choose('income','canada-child');h.input('incomes.1.amount',250);
  await choose('expense','daycare');h.input('bills.0.amount',180);
  await choose('expense','restaurants');h.input('envelopes.0.amount',200);
  await choose('expense','restaurants');assert.match(h.nodes.get('hpFinanceStatus').textContent,/existe déjà/);
  h.input('reviewed',true,'checkbox');await h.click('save');
  assert.equal(h.stored().incomes.length,2);assert.equal(h.stored().bills.length,1);assert.equal(h.stored().envelopes.length,1);
  assert.equal(h.stored().incomes[1].category,'Allocations familiales');
  assert.equal(h.nodes.get('hpFinanceOverview').hidden,false);
  assert.match(h.nodes.get('hpFinanceOverview').innerHTML,/Ce qui entre/);
  await h.ctx.hpLoadFinancePlan({force:true});assert.equal(h.stored().envelopes[0].amount,200);
});
test('annual suggestions stay separate from recurring bills and require a real due date',async()=>{
  const h=harness();await h.start();await h.click('choose',{kind:'expense'});h.nodes.get('hpFinanceTemplate').value='taxes';await h.click('template');
  h.input('provisions.0.annualAmount',1200);await h.click('save');assert.equal(h.stored(),null);
  h.input('provisions.0.dueDate','2026-12-01','date');await h.click('save');
  assert.equal(h.stored().provisions.length,1);assert.equal(h.stored().bills.length,0);
  assert.equal(h.stored().provisions[0].savedAmount,0);
});
test('monthly habit simulation and adviser contact cannot write or send budget data',async()=>{
  const h=harness();await h.start();
  await h.click('choose',{kind:'income'});h.nodes.get('hpFinanceTemplate').value='salary';await h.click('template');h.input('incomes.0.amount',2000);
  await h.click('choose',{kind:'expense'});h.nodes.get('hpFinanceTemplate').value='restaurants';await h.click('template');h.input('envelopes.0.amount',200);
  h.input('reviewed',true,'checkbox');await h.click('save');
  const before=JSON.stringify(h.stored()),requestCount=h.requests.length;
  h.nodes.get('hpBudgetPlanner').handlers.input({target:{dataset:{simulation:'amount'},value:'50.50'}});
  assert.match(h.nodes.get('hpFinanceSimulationResult').innerHTML,/606,00/);
  h.nodes.get('hpBudgetPlanner').handlers.input({target:{dataset:{simulation:'amount'},value:'999'}});
  assert.match(h.nodes.get('hpFinanceSimulationResult').innerHTML,/Entre un montant/);
  let contact;h.ctx.hpFindAdvisor=context=>contact=context;await h.click('advisor');
  assert.equal(contact.questions.length,3);assert.deepEqual(Object.keys(contact),['questions']);
  await h.click('summary');assert.match(h.nodes.get('hpFinanceSummaryText').value,/MES QUESTIONS POUR LE CONSEILLER NUVABRI/);
  assert.equal(h.requests.length,requestCount);assert.equal(JSON.stringify(h.stored()),before);
});

test('visible expense suggestions open amounts directly and reopen saved bills without duplicating them',async()=>{
  const h=harness();await h.start();
  const editor=h.nodes.get('hpFinanceEditor').innerHTML;
  for(const label of ['Téléphone','Internet','Électricité / chauffage','Assurance habitation','Assurance automobile'])assert.ok(editor.includes(label));
  assert.equal(h.stored(),null);
  await h.click('suggest-expense',{template:'phone'});
  assert.equal(h.nodes.get('hf-bills-0-amount').focused,true);h.input('bills.0.amount',65);
  await h.click('suggest-expense',{template:'internet'});h.input('bills.1.amount',75);
  await h.click('suggest-expense',{template:'phone'});assert.equal(h.stored(),null);
  await h.click('save');assert.equal(h.stored().bills.length,2);assert.equal(h.stored().bills[0].amount,65);
  await h.ctx.hpLoadFinancePlan({force:true});await h.click('suggest-expense',{template:'phone'});
  assert.match(h.nodes.get('hpFinanceStatus').textContent,/déjà prévue/);h.input('bills.0.amount',60);await h.click('save');
  assert.equal(h.stored().bills.length,2);assert.equal(h.stored().bills[0].amount,60);assert.equal(h.stored().bills[1].amount,75);
});

test('Mes montants shows weekly CELI and REER projections immediately and retains optional account balances',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'tfsa'});h.input('bills.0.amount',50);
  const annual=()=>h.nodes.get('hpFinanceSavingsAnnual');
  assert.equal(annual().hidden,false);assert.match(annual().innerHTML,/2\s600,00/);assert.match(annual().innerHTML,/Non renseigné/);
  h.input('bills.0.accountBalance',1000);assert.match(annual().innerHTML,/3\s600,00/);
  h.input('bills.0.frequency','monthly','select');assert.match(annual().innerHTML,/600,00/);assert.match(annual().innerHTML,/1\s600,00/);
  h.input('bills.0.frequency','weekly','select');await h.click('suggest-expense',{template:'rrsp'});h.input('bills.1.amount',25);h.input('bills.1.accountBalance',0);
  assert.match(annual().innerHTML,/1\s300,00/);await h.click('save');assert.equal(h.stored().bills.length,2);assert.equal(h.stored().bills[0].accountBalance,1000);assert.equal(h.stored().bills[1].accountBalance,0);
  await h.ctx.hpLoadFinancePlan({force:true});assert.match(annual().innerHTML,/3\s600,00/);
  await h.click('suggest-expense',{template:'tfsa'});h.input('bills.0.accountBalance','');await h.click('save');assert.equal(h.stored().bills[0].accountBalance,null);assert.match(annual().innerHTML,/Non renseigné/);
  await h.click('summary');assert.match(h.nodes.get('hpFinanceSummaryText').value,/REER ET CELI — PROJECTION SUR UN AN/);
  h.logout();assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/3\s600,00/);
});


test('linked payment changes preserve an unfinished manual budget draft, stay unique, and update the calendar',async()=>{
 const h=harness();await h.start();await h.click('add',{list:'bills'});h.input('bills.0.label','Téléphone','text');h.input('bills.0.amount',50);
 const payment={id:'saved-payment',leisure_equipment_id:'trailer',asset_name:'remorque',amount:70,frequency:'weekly',anchor_date:'2026-09-04',second_day:null,essential:false};
 h.payments([payment]);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/Paiement remorque/);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/303,33/);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/3[\s\u00a0]640,00/);
 assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/Téléphone/);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/4 versements/);
 h.payments([{...payment,amount:80}]);assert.equal((h.nodes.get('hpFinanceEditor').innerHTML.match(/Paiement remorque/g)||[]).length,1);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/346,67/);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/Téléphone/);
 h.payments([]);assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/Paiement remorque/);assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/Téléphone/);
 h.payments([payment],'other-owner');assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/Paiement remorque/);
 await h.click('save');assert.equal(h.stored().bills.length,1);assert.equal(h.stored().bills[0].amount,50);
});

test('failed background refresh preserves the draft and allows adding and saving expenses',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'phone'});h.input('bills.0.amount',65);
  const field=h.nodes.get('hf-bills-0-amount');h.failLoad();await h.refresh();
  assert.equal(h.nodes.get('hf-bills-0-amount'),field,'keep the current form and focus');
  assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/conserv/);
  await h.click('suggest-expense',{template:'internet'});
  h.input('bills.1.amount',75);await h.click('save');
  assert.equal(h.stored().bills.length,2);assert.equal(h.stored().bills[0].amount,65);assert.equal(h.stored().bills[1].amount,75);
  assert.equal(h.confirmations.length,0);
});
test('retry after the first failed load is visible and does not authorize an empty overwrite',async()=>{
  const h=harness({loadFailure:true});await h.start();
  assert.match(h.nodes.get('hpFinanceOverview').innerHTML,/data-action="retry"/);
  await h.click('save');assert.equal(h.requests.filter(x=>x.options.method==='PUT').length,0);
  h.failLoad(false);await h.click('retry');
  await h.click('suggest-expense',{template:'phone'});h.input('bills.0.amount',85);await h.click('save');
  assert.equal(h.stored().bills[0].amount,85);assert.equal(h.confirmations.length,0);
});
test('retrying a failed refresh preserves incomplete edits without a discard confirmation',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'phone'});h.input('bills.0.amount',60);await h.click('save');
  h.input('bills.0.amount',65);await h.click('suggest-expense',{template:'internet'});
  const field=h.nodes.get('hf-bills-1-amount');h.failLoad();await h.refresh();h.failLoad(false);await h.click('retry');
  assert.equal(h.nodes.get('hf-bills-1-amount'),field,'background success must not rebuild the draft editor');
  h.input('bills.1.amount',75);await h.click('save');
  assert.equal(h.stored().bills.length,2);assert.equal(h.stored().bills[0].amount,65);
  assert.equal(h.confirmations.length,0);
});
test('concurrent load triggers produce only one request',async()=>{
  const h=harness();await h.start();const before=h.requests.length;
  await Promise.all([h.ctx.hpLoadFinancePlan(),h.ctx.hpLoadFinancePlan()]);
  assert.equal(h.requests.length-before,1);
});

test('recovery retains the original revision so an edit on another device is not overwritten',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'phone'});h.input('bills.0.amount',60);await h.click('save');
  h.input('bills.0.amount',65);h.failLoad();await h.refresh();
  const remote=structuredClone(h.stored());remote.bills[0].amount=70;h.remoteSave(remote);
  h.failLoad(false);await h.click('retry');await h.click('save');
  assert.equal(h.stored().bills[0].amount,70);
  assert.match(h.nodes.get('hpFinanceSaveStatus').textContent,/autre appareil/);
  assert.match(h.nodes.get('hpFinanceEditor').innerHTML,/value="65"/);
  assert.equal(h.confirmations.length,0);
});
test('a late refresh after sign-out cannot restore amounts or revive a previous account',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'phone'});h.input('bills.0.amount',9876);await h.click('save');
  let finish;const original=h.ctx.fetch;
  h.ctx.fetch=async(url,options)=>options.method==='GET'?await new Promise(resolve=>finish=resolve):original(url,options);
  const pending=h.ctx.hpLoadFinancePlan();await h.tick();h.logout();
  finish({ok:true,json:async()=>({config:h.stored(),revision:'old-revision',entries:[]})});await pending;
  assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/9876/);
  await h.click('save');assert.equal(h.requests.filter(x=>x.options.method==='PUT').length,1);
  h.ctx.fetch=original;await h.owner('owner-b');
  assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/9876/);
});

test('home budget preview only shows a saved complete plan and clears drafts and sign-out',async()=>{
 const h=harness();await h.start();assert.equal(h.nodes.get('hpHomeBudget').hidden,true);
 await h.click('choose',{kind:'income'});h.nodes.get('hpFinanceTemplate').value='salary';await h.click('template');h.input('incomes.0.amount',2000);
 h.input('reviewed',true,'checkbox');assert.equal(h.nodes.get('hpHomeBudget').hidden,true);
 await h.click('save');assert.equal(h.nodes.get('hpHomeBudget').hidden,false);assert.match(h.nodes.get('hpHomeBudget').innerHTML,/Marge prévue.*septembre/);assert.match(h.nodes.get('hpHomeBudget').innerHTML,/Voir mon bilan/);
 h.input('incomes.0.amount',3000);assert.equal(h.nodes.get('hpHomeBudget').hidden,true);assert.equal(h.nodes.get('hpHomeBudget').innerHTML,'');
 await h.click('save');assert.equal(h.nodes.get('hpHomeBudget').hidden,false);
 h.logout();assert.equal(h.nodes.get('hpHomeBudget').hidden,true);assert.equal(h.nodes.get('hpHomeBudget').innerHTML,'');
});

test('expense entry stays beside its suggestion and saves several expenses without leaving the editor',async()=>{
  const h=harness();await h.start();await h.click('suggest-expense',{template:'phone'});
  let html=h.nodes.get('hpFinanceEditor').innerHTML;
  assert.match(html,/finance-suggestion-item is-editing/);
  assert.equal((html.match(/id="hf-bills-0-amount"/g)||[]).length,1);
  assert.ok(html.indexOf('hf-bills-0-amount')<html.indexOf('data-template="internet"'));
  const amount=h.nodes.get('hf-bills-0-amount');h.input('bills.0.amount',45);
  assert.equal(h.nodes.get('hf-bills-0-amount'),amount,'typing must retain the input node and keyboard focus');
  await h.click('save-continue');assert.equal(h.nodes.get('hpFinanceEditor').hidden,false);
  assert.equal(h.stored().bills[0].amount,45);
  assert.match(h.nodes.get('hpExpenseSaveStatus').textContent,/Plan enregistré/);
  await h.click('suggest-expense',{template:'internet'});h.input('bills.1.amount',70);
  h.failSave();await h.click('save-continue');assert.match(h.nodes.get('hpExpenseSaveStatus').textContent,/Confirmation non reçue/);
  assert.equal(h.nodes.get('hpFinanceEditor').hidden,false);
  await h.click('save-continue');
  const writes=h.requests.filter(r=>r.options.method==='PUT').map(r=>JSON.parse(r.options.body));
  assert.equal(writes[1].request_id,writes[2].request_id);
  assert.deepEqual(h.stored().bills.map(x=>x.amount),[45,70]);
  await h.click('save');assert.equal(h.nodes.get('hpFinanceEditor').hidden,true);
  h.logout();await h.owner('owner-b');assert.doesNotMatch(h.nodes.get('hpFinanceEditor').innerHTML,/is-editing/);
});

test('registered contribution shortcuts use saved amounts, require an explicit operation and clear on logout',async()=>{
 const h=harness(),opened=[];h.ctx.hpOpenBudgetEntry=value=>opened.push(value);await h.start();
 await h.click('suggest-expense',{template:'tfsa'});h.input('bills.0.amount',50);
 assert.equal(h.nodes.get('hpContributionShortcuts').hidden,true);
 await h.click('save');const id=h.stored().bills[0].id;
 const trigger=()=>h.nodes.get('hpContributionShortcuts').handlers.click({target:{closest:()=>({dataset:{contributionId:id}})}});
 trigger();assert.equal(opened[0].category,'CELI');assert.equal(opened[0].amount,50);
 assert.equal(h.requests.filter(x=>x.options.method==='PUT').length,1);
 h.input('bills.0.amount',75);trigger();assert.equal(opened[1].amount,50,'unfinished plan changes cannot change the saved shortcut');
 h.logout();trigger();assert.equal(opened.length,2);assert.equal(h.nodes.get('hpContributionShortcuts').innerHTML,'');
});
