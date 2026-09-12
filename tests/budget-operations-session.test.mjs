import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function harness(user={id:'a'}){
 const nodes=new Map(),requests=[],events=[];let authCallback;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{},classList:{add(){}}});return nodes.get(id)};
 const ctx=vm.createContext({Intl,Date,console:{error(){}},u:user,document:{readyState:'complete',getElementById:el},setTimeout(){return 1},
  CustomEvent:class{constructor(type,args){this.type=type;this.detail=args?.detail}},addEventListener(){},dispatchEvent:e=>events.push(e),
  supabaseClient:{auth:{onAuthStateChange:fn=>authCallback=fn}},hpStability:{token:async()=> 'test-token'},
  fetch:()=>new Promise(resolve=>requests.push(resolve))});ctx.window=ctx;
 vm.runInContext(readFileSync(new URL('../budget-load-fix.js',import.meta.url),'utf8'),ctx);
 return {ctx,el,requests,events,auth:(event,session)=>authCallback(event,session)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(amount,ok=true)=>({ok,status:ok?200:500,json:async()=>ok?{rows:[{id:'entry',entry_type:'expense',category:'CELI',amount,entry_date:'2026-09-12'}]}:{error:'offline'}});

test('signed-out startup sends no budget request and clears amounts',async()=>{
 const h=harness(null);h.el('hpExpense').textContent='Previous amount';await h.ctx.hpLoadBudget();
 assert.equal(h.requests.length,0);assert.equal(h.el('hpExpense').textContent,'—');assert.match(h.el('hpBudgetList').textContent,/Connecte-toi/);
});
test('sign-out clears the entry and ignores an already running budget response',async()=>{
 const h=harness();const pending=h.ctx.hpLoadBudget();await tick();
 h.el('hpBudgetAmount').value='50';h.el('hpBudgetDescription').value='Private draft';
 h.ctx.u=null;h.auth('SIGNED_OUT',null);
 assert.equal(h.el('hpBudgetAmount').value,'');assert.equal(h.el('hpBudgetDescription').value,'');
 h.requests[0](response(500));await pending;
 assert.equal(h.el('hpExpense').textContent,'—');assert.equal(h.events.length,0);
});
test('a previous account response cannot replace the new account totals',async()=>{
 const h=harness();const old=h.ctx.hpLoadBudget();await tick();
 h.ctx.u={id:'b'};h.auth('SIGNED_IN',{user:{id:'b'}});
 const fresh=h.ctx.hpLoadBudget();await tick();h.requests[1](response(25));await fresh;
 h.requests[0](response(900));await old;
 assert.match(h.el('hpExpense').textContent,/25,00/);assert.equal(h.events.length,1);assert.equal(h.events[0].detail.expense,25);
});
test('latest refresh wins; failed refresh clears stale totals but preserves unfinished entry',async()=>{
 const h=harness();const old=h.ctx.hpLoadBudget();await tick();const fresh=h.ctx.hpLoadBudget();await tick();
 h.requests[1](response(75));await fresh;h.requests[0](response(5));await old;assert.match(h.el('hpExpense').textContent,/75,00/);
 h.el('hpBudgetAmount').value='40';const failed=h.ctx.hpLoadBudget();await tick();h.requests[2](response(0,false));await failed;
 assert.equal(h.el('hpExpense').textContent,'—');assert.equal(h.el('hpBudgetAmount').value,'40');assert.match(h.el('hpBudgetList').textContent,/Impossible/);
});
