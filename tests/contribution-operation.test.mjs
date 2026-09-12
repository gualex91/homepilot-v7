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

test('quick entry selects the requested type, focuses amount and protects unfinished entries',()=>{
 const nodes=new Map();let allowChange=false,focused=null,view=null;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},style:{},classList:{add(){},remove(){}},querySelector(){return null},focus(){focused=id},scrollIntoView(){}});return nodes.get(id)};
 const ctx=vm.createContext({Date,document:{readyState:'loading',getElementById:el,addEventListener(){}},confirm:()=>allowChange,setTimeout(){},hpSetFinanceView:v=>view=v});ctx.window=ctx;
 vm.runInContext(readFileSync(new URL('../budget-entry-fix.js',import.meta.url),'utf8'),ctx);
 el('hpBudgetType').value='expense';
 assert.equal(ctx.hpOpenBudgetEntry({entry_type:'income'}),true);
 assert.equal(el('hpBudgetType').value,'income');assert.equal(el('hpBudgetCategory').value,'Salaire');assert.equal(focused,'hpBudgetAmount');assert.equal(view,'operations');
 el('hpBudgetAmount').value='450';el('hpBudgetDescription').value='Paie';
 assert.equal(ctx.hpOpenBudgetEntry({entry_type:'expense'}),false);
 assert.equal(el('hpBudgetType').value,'income');assert.equal(el('hpBudgetAmount').value,'450');assert.equal(el('hpBudgetDescription').value,'Paie');
 allowChange=true;assert.equal(ctx.hpOpenBudgetEntry({entry_type:'expense'}),true);
 assert.equal(el('hpBudgetType').value,'expense');assert.equal(el('hpBudgetCategory').value,'Autre');assert.equal(el('hpBudgetAmount').value,'450');
 el('hpBudgetSave').dataset.hpSaving='1';assert.equal(ctx.hpOpenBudgetEntry({entry_type:'income'}),false);assert.equal(el('hpBudgetType').value,'expense');
});

test('quick entry loads permitted properties without blocking amount focus or leaking across accounts',async()=>{
 const nodes=new Map(),requests=[];let focused=false;
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},style:{},textContent:'',options:[],classList:{add(){},remove(){}},querySelector(){return null},focus(){focused=true},scrollIntoView(){},replaceChildren(...options){this.options=options;this.value=options[0]?.value||''}});return nodes.get(id)};
 const ctx=vm.createContext({Date,u:{id:'a'},document:{readyState:'loading',getElementById:el,addEventListener(){},createElement:()=>({})},setTimeout(){},supabaseClient:{from:table=>{assert.equal(table,'properties');return {select:()=>({order:()=>new Promise(resolve=>requests.push(resolve))})}}}});ctx.window=ctx;
 vm.runInContext(readFileSync(new URL('../budget-entry-fix.js',import.meta.url),'utf8'),ctx);
 el('hpBudgetType').value='expense';el('hpBudgetProperty').value='second';ctx.hpOpenBudgetEntry();assert.equal(focused,true);
 requests[0]({data:[{id:'first',name:'Maison',city:'Saguenay'},{id:'second',name:'<img src=x>',city:null}],error:null});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el('hpBudgetProperty').options.length,3);assert.equal(el('hpBudgetProperty').value,'second');assert.equal(el('hpBudgetProperty').options[2].textContent,'<img src=x>');
 ctx.hpOpenBudgetEntry();ctx.u={id:'b'};el('hpBudgetProperty').replaceChildren({value:'',textContent:'Aucune propriété'});
 requests[1]({data:[{id:'private-a',name:'Private A'}],error:null});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el('hpBudgetProperty').options.length,1);
});
