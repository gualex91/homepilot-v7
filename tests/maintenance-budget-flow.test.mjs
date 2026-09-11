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
  const nodes=new Map(),events={},requests=[],storage=new Map(),navigation=[];
  class Element{
    constructor(){this.dataset={};this.handlers={};this.attributes={};this.hidden=false;this.value='';this.checked=false;this.textContent='';this.classList={add(){},remove(){},contains(){return false}}}
    set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
    set innerHTML(html){this._html=html;for(const m of html.matchAll(/\bid="([^"]+)"/g)){const child=new Element();child.id=m[1]}}
    get innerHTML(){return this._html||''}
    setAttribute(k,v){this.attributes[k]=v}
    addEventListener(k,fn){this.handlers[k]=fn}
    querySelector(){return {after(){}}}querySelectorAll(){return []}
    contains(){return true}closest(){return {setAttribute(){}}}
    focus(){this.focused=true}scrollIntoView(){}
  }
  const budget=new Element();budget.id='budget';
  let authCallback,session={user:{id:'owner-a'},access_token:'test'},stored=null,revision=null,failSave=false;
  const FixedDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-09-10T12:00:00Z']))}static now(){return new Date('2026-09-10T12:00:00Z').getTime()}};
  const ctx=vm.createContext({Date:FixedDate,Intl,URL,URLSearchParams,AbortSignal,structuredClone,crypto:webcrypto,console,
    confirm:()=>true,alert(){},setTimeout:fn=>{Promise.resolve().then(fn)},setInterval(){},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{readyState:'loading',getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener:(key,fn)=>{(events[key]??=[]).push(fn)}},
    addEventListener:(key,fn)=>{(events[key]??=[]).push(fn)},show:id=>navigation.push(id),
    supabaseClient:{auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>authCallback=fn}},
    fetch:async(url,options)=>{
      requests.push({url,options});if(!session)return {ok:false,json:async()=>({error:'Session expirée.'})};
      if(options.method==='GET')return {ok:!loadFailure,json:async()=>loadFailure?{error:'Indisponible'}:{config:stored,revision,entries:[],entries_complete:true,legacy:null}};
      const body=JSON.parse(options.body);if(!stored||revision!==body.request_id){stored=body.config;revision=body.request_id}
      if(failSave){failSave=false;throw Object.assign(new Error('timeout'),{name:'TimeoutError'})}
      return {ok:true,json:async()=>({config:stored,revision})};
    }
  });ctx.window=ctx;
  for(const file of ['stability-core.js','budget-engine.js','maintenance-budget.js','budget-catalog.js','budget-insights.js','budget-planner.js'])vm.runInContext(source(file),ctx,{filename:file});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const input=(field,value,type='number',event='input')=>{const target=nodes.get('hf-'+field.replaceAll('.','-'))||{};Object.assign(target,{dataset:{field},value:String(value),type,checked:value===true});return nodes.get('hpBudgetPlanner').handlers[event]({target})};
  const click=(action,data={})=>{const b={dataset:{action,...data},closest(){return this},getAttribute(){return null}};return nodes.get('hpBudgetPlanner').handlers.click({target:b})};
  return {ctx,nodes,requests,navigation,input,click,tick,stored:()=>stored,
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
