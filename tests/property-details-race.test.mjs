import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../property-pro-stability.js',import.meta.url),'utf8');
function harness(){
 const nodes=new Map(),requests=[],accepted=[],callbacks=[];
 class Node{
  constructor(){this.classList={add(){},remove(){}};this.onclick=null;this.html=''}
  set id(id){this._id=id;nodes.set(id,this)}get id(){return this._id}
  set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g)){const n=new Node();n.id=m[1];}}
  get innerHTML(){return this.html}setAttribute(){}
 }
 const ctx={console,AbortController,setTimeout,clearTimeout,document:{getElementById:id=>nodes.get(id),createElement:()=>new Node(),body:{appendChild(){}},addEventListener(){}},
  hpStability:{token:async()=> 'test'},hpPropertyGallery:{accept:p=>accepted.push(p.id)},props:[{id:'a'},{id:'b'}],
  supabaseClient:{auth:{onAuthStateChange:fn=>callbacks.push(fn)}},
  fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,nodes,requests,accepted,tick:()=>new Promise(setImmediate),complete(index,id){requests[index].resolve({ok:true,json:async()=>({property:{id,name:'Propriété '+id,city:'Ville'},equipment:[],tasks:[]})})},logout(){callbacks.forEach(fn=>fn('SIGNED_OUT',null))}};
}
test('a slow previous property response cannot replace the most recently opened property',async()=>{
 const h=harness();const a=h.ctx.hpOpenProperty('a');await h.tick();const b=h.ctx.hpOpenProperty('b');await h.tick();h.complete(1,'b');await b;h.complete(0,'a');await a;
 assert.deepEqual(h.accepted,['b']);assert.match(h.nodes.get('hpPropertyBody').innerHTML,/Propriété b/);assert.doesNotMatch(h.nodes.get('hpPropertyBody').innerHTML,/Propriété a/);
});
test('closing property details cancels pending display and clears the panel',async()=>{
 const h=harness();const a=h.ctx.hpOpenProperty('a');await h.tick();h.nodes.get('hpPropertyClose2').onclick();h.complete(0,'a');await a;
 assert.deepEqual(h.accepted,[]);assert.equal(h.nodes.get('hpPropertyBody').innerHTML,'');
});
test('sign-out clears property details and prevents a late response from displaying them',async()=>{
 const h=harness();const a=h.ctx.hpOpenProperty('a');await h.tick();h.logout();h.complete(0,'a');await a;assert.deepEqual(h.accepted,[]);assert.equal(h.nodes.get('hpPropertyBody').innerHTML,'');
});
