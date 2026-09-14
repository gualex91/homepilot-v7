import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function setup(){
 const nodes=new Map(),requests=[],alerts=[];let listener;
 const el=id=>{
  if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,dataset:{},style:{},attrs:{},
   classList:{add(){}},setAttribute(k,v){this.attrs[k]=v},focus(){this.focused=true},scrollIntoView(){this.scrolled=true}});
  return nodes.get(id);
 };
 const ctx=vm.createContext({u:{id:'test-owner'},h:null,console:{error(){}},AbortController,
  alert:v=>alerts.push(v),setTimeout:()=>1,clearTimeout(){},
  MutationObserver:class{observe(){}},CustomEvent:class{},
  document:{readyState:'complete',body:{},getElementById:el,addEventListener:(type,fn)=>{if(type==='click')listener=fn}},
  hpStability:{token:async()=> 'test-token',operation:()=> 'test-request',complete(){}},
  fetch:async(_,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,id:'confirmed'})}}
 });ctx.window=ctx;
 vm.runInContext(readFileSync(new URL('../budget-save-fix.js',import.meta.url),'utf8'),ctx);
 el('hpBudgetType').value='expense';el('hpBudgetCategory').value='Autre';el('hpBudgetDate').value='2026-09-14';el('hpBudgetDescription').value='TEST saisie';
 return {ctx,el,requests,alerts,click:()=>listener({target:{closest:()=>el('hpBudgetSave')},preventDefault(){},stopImmediatePropagation(){}})};
}
test('invalid amount stays in the form with a focused inline error, then correction saves once',async()=>{
 const h=setup();h.el('hpBudgetAmount').value='0';await h.ctx.hpSaveBudgetEntry();
 assert.equal(h.requests.length,0);assert.equal(h.alerts.length,0);
 assert.match(h.el('hpBudgetStatus').textContent,/supérieur à 0/);
 assert.equal(h.el('hpBudgetStatus').attrs.role,'alert');assert.ok(h.el('hpBudgetStatus').focused);
 assert.equal(h.el('hpBudgetDescription').value,'TEST saisie');assert.equal(h.el('hpBudgetSave').disabled,false);
 h.el('hpBudgetAmount').value='12.50';await h.ctx.hpSaveBudgetEntry();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].amount,12.5);assert.equal(h.el('hpBudgetDescription').value,'');
});
test('missing date makes no write and keeps the amount for correction',async()=>{
 const h=setup();h.el('hpBudgetDate').value='';h.el('hpBudgetAmount').value='12.50';await h.ctx.hpSaveBudgetEntry();
 assert.equal(h.requests.length,0);assert.equal(h.alerts.length,0);assert.match(h.el('hpBudgetStatus').textContent,/date/);assert.equal(h.el('hpBudgetAmount').value,'12.50');
});
test('two clicks before the request resolves produce one expense',async()=>{
 const h=setup();h.el('hpBudgetAmount').value='12.50';h.click();h.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.requests.length,1);assert.equal(h.el('hpBudgetSave').dataset.hpSaving,'0');
});
test('an unconfirmed response preserves the draft and displays an inline error',async()=>{
 const h=setup();h.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});h.el('hpBudgetAmount').value='12.50';await h.ctx.hpSaveBudgetEntry();
 assert.equal(h.alerts.length,0);assert.match(h.el('hpBudgetStatus').textContent,/confirmé/);assert.equal(h.el('hpBudgetAmount').value,'12.50');assert.equal(h.el('hpBudgetDescription').value,'TEST saisie');
});
