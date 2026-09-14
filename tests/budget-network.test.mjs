import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {budgetUpstream} from '../lib/budget-upstream.js';

const reply=(status=200,text='[]',headers={})=>new Response(text,{status,headers});
function upstream(sequence){
 const calls=[],pauses=[];let signals=0;
 return {calls,pauses,run:(method='GET')=>budgetUpstream('https://database.invalid/rest/v1/budget_assets',
  {method,headers:{Authorization:'Bearer test-owner',Prefer:'return=representation'},body:method==='PATCH'?'{}':undefined},
  {timeout:()=>({attempt:++signals}),pause:async ms=>pauses.push(ms),fetch:async(_,options)=>{
    calls.push(options);const next=sequence.shift();if(next instanceof Error)throw next;return next;
  }})};
}
test('temporary gateway errors and network timeouts recover on a single safe read retry',async()=>{
 for(const first of [reply(504),reply(502),reply(503),Object.assign(new Error('slow'),{name:'TimeoutError'}),new TypeError('network')]){
  const h=upstream([first,reply(200,'[{"id":"ok"}]')]);const r=await h.run();
  assert.equal(r.attempts,2);assert.equal(r.response.status,200);assert.match(r.text,/ok/);
  assert.equal(h.calls.length,2);assert.notEqual(h.calls[0].signal,h.calls[1].signal);
  assert.equal(h.calls[1].headers.Authorization,'Bearer test-owner');
 }
});
test('a response-body timeout is covered and a second failure stops',async()=>{
 const error=Object.assign(new Error('slow body'),{name:'TimeoutError'});
 const h=upstream([{status:200,headers:new Headers(),text:async()=>{throw error}},error]);
 await assert.rejects(h.run(),/slow body/);assert.equal(h.calls.length,2);
});
test('writes never retry, including uncertain timeout after an accepted write',async()=>{
 for(const method of ['POST','PATCH','DELETE']){
  const h=upstream([Object.assign(new Error('lost confirmation'),{name:'TimeoutError'})]);
  await assert.rejects(h.run(method),/lost confirmation/);assert.equal(h.calls.length,1);
  const failed=upstream([reply(504)]);assert.equal((await failed.run(method)).response.status,504);assert.equal(failed.calls.length,1);
 }
});
test('authentication, permissions and rate limits are returned without retry',async()=>{
 for(const status of [400,401,403,409,429]){
  const h=upstream([reply(status)]);assert.equal((await h.run()).response.status,status);assert.equal(h.calls.length,1);
 }
 const later=upstream([reply(503,'',{ 'retry-after':'30' })]);await later.run();assert.equal(later.calls.length,1);
});
function frontend(){
 const calls=[];
 const ctx=vm.createContext({URL,URLSearchParams,Headers,Request,location:{origin:'https://nuvabri.invalid'},
  fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))});
 vm.runInContext(readFileSync(new URL('../stability-core.js',import.meta.url),'utf8'),ctx);
 const url='https://vkfvjwxajgeafzyphjvh.supabase.co/rest/v1/budget_assets?select=*';
 return {ctx,calls,read:(auth='owner-a',extra={})=>ctx.hpStability.budgetFetch(url,{headers:{Authorization:auth},...extra}),
  write:()=>ctx.hpStability.budgetFetch(url,{method:'PATCH',headers:{Authorization:'owner-a'},body:'{}'})};
}
test('concurrent identical reads share one request with separately readable responses',async()=>{
 const h=frontend(),a=h.read(),b=h.read();assert.equal(h.calls.length,1);h.calls[0].resolve(reply(200,'[1]'));
 assert.equal(await(await a).text(),'[1]');assert.equal(await(await b).text(),'[1]');
 const c=h.read();assert.equal(h.calls.length,2);h.calls[1].resolve(reply());await c;
});
test('different accounts, headers and cancellation signals do not share requests',async()=>{
 const h=frontend();const pending=[h.read('owner-a'),h.read('owner-b'),h.read('owner-a',{headers:{Authorization:'owner-a',Prefer:'count=exact'}}),h.read('owner-a',{signal:{}})];
 assert.equal(h.calls.length,4);h.calls.forEach(x=>x.resolve(reply()));await Promise.all(pending);
});
test('writes invalidate pending reads and old reads cannot clear a newer request',async()=>{
 const h=frontend(),old=h.read(),write=h.write();h.calls[1].resolve(reply());await write;
 const fresh=h.read();assert.equal(h.calls.length,3);h.calls[0].resolve(reply(200,'old'));await old;
 const shared=h.read();assert.equal(h.calls.length,3);h.calls[2].resolve(reply(200,'fresh'));
 assert.equal(await(await fresh).text(),'fresh');assert.equal(await(await shared).text(),'fresh');
});
test('failed reads are cleared so a manual retry can recover',async()=>{
 const h=frontend(),a=h.read(),b=h.read();h.calls[0].reject(new TypeError('offline'));
 await Promise.all([assert.rejects(a,/offline/),assert.rejects(b,/offline/)]);
 const retry=h.read();assert.equal(h.calls.length,2);h.calls[1].resolve(reply());await retry;
});
