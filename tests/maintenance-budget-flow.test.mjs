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
  for(const file of ['stability-core.js','budget-engine.js','maintenance-budget.js','budget-planner.js'])vm.runInContext(source(file),ctx,{filename:file});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const input=(field,value,type='number')=>nodes.get('hpBudgetPlanner').handlers.input({target:{dataset:{field},value:String(value),type,checked:value===true}});
  const click=action=>{const b={dataset:{action},closest(){return this},getAttribute(){return null}};return nodes.get('hpBudgetPlanner').handlers.click({target:b})};
  return {ctx,nodes,requests,navigation,input,click,tick,stored:()=>stored,
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
