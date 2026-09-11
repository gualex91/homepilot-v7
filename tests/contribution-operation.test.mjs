import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

test('prefilled contribution is confirmed before saving, refreshes operation totals and can be removed',async()=>{
 const nodes=new Map(),listeners={},writes=[];let rows=[{id:'old',entry_type:'expense',category:'Maison',amount:1850,entry_date:'2026-09-09'}],allowReplace=false;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},options:[],style:{},textContent:'',classList:{add(){},remove(){},contains(){return true}},setAttribute(){},querySelector(){return null},appendChild(x){this.options.push(x)},scrollIntoView(){},focus(){}});return nodes.get(id)};
 const ctx=vm.createContext({console,Intl,Date,AbortController,crypto:webcrypto,u:{id:'tester'},confirm:()=>allowReplace,alert(){},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
 document:{readyState:'loading',getElementById:el,createElement:()=>({}),addEventListener(){}},
 setTimeout(fn,ms){if(ms<1000)Promise.resolve().then(fn);return 1},clearTimeout(){},
 addEventListener(type,fn){(listeners[type]??=[]).push(fn)},dispatchEvent(e){for(const f of listeners[e.type]||[])f(e)},
 hpStability:{token:async()=>'token',operation:()=> 'request-1',complete(){}},
 fetch:async(url,options)=>{if(url==='/api/budget-entry'){const body=JSON.parse(options.body);writes.push(body);rows.push({...body,id:'new'});return {ok:true,json:async()=>({ok:true,id:'new'})}}
 if(url==='/api/budget-delete'){rows=rows.filter(x=>x.id!==JSON.parse(options.body).id);return {ok:true,json:async()=>({ok:true})}}
 return {ok:true,json:async()=>({rows})};}
 });ctx.window=ctx;
 for(const file of ['budget-entry-fix.js','budget-save-fix.js','budget-load-fix.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 ctx.hpOpenBudgetEntry({entry_type:'expense',category:'CELI',amount:50,description:'Cotisation CELI'});
 assert.equal(el('hpBudgetCategory').value,'CELI');assert.equal(el('hpBudgetAmount').value,'50');assert.equal(writes.length,0);
 ctx.hpOpenBudgetEntry({entry_type:'expense',category:'REER',amount:100});assert.equal(el('hpBudgetCategory').value,'CELI','do not discard an unfinished operation');
 el('hpBudgetDate').value='2026-09-11';await ctx.hpSaveBudgetEntry();await tick();
 assert.equal(writes.length,1);assert.equal(writes[0].category,'CELI');assert.equal(writes[0].amount,50);
 assert.match(el('hpExpense').textContent,/1\s?900,00/);assert.match(el('hpBalance').textContent,/-1\s?900,00/);
 assert.match(el('hpBudgetList').innerHTML,/Cotisation CELI/);
 allowReplace=true;await ctx.hpDeleteBudget('new');assert.match(el('hpExpense').textContent,/1\s?850,00/);
});
