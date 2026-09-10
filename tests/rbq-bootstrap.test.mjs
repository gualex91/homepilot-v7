import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../rbq-auto-import.js',import.meta.url),'utf8');
function harness({done=false,storageUnavailable=false,counts=[16874],admin=true,user=true}={}){
 const jobs=[],elements=new Map(),writes=[],events=[],calls={auth:0,admin:0,count:0,import:0};let onAuth,now=0;
 const state={user,admin};
 const document={readyState:'complete',getElementById:id=>elements.get(id),createElement:()=>({remove(){elements.delete(this.id)}}),body:{appendChild:element=>{elements.set(element.id,element);writes.push(element)}}};
 elements.set('hpRbqAuto',{remove(){elements.delete('hpRbqAuto')}});
 const c={auth:{getUser:async()=>{calls.auth++;return {data:{user:state.user?{id:'admin-fixture'}:null}}},onAuthStateChange:callback=>{onAuth=callback}},
  from:table=>({select(){return this},eq(){if(table==='admin_users')return this;calls.count++;const count=counts[Math.min(calls.count-1,counts.length-1)];return Promise.resolve({count,error:count===null?{message:'offline'}:null})},maybeSingle:async()=>{calls.admin++;return {data:state.admin?{user_id:'admin-fixture'}:null}}}),
  functions:{invoke:async()=>{calls.import++;return {data:{profiles_imported:3000},error:null}}}};
 const storage=new Map(done?[['hp_rbq_auto_import_v1','done']]:[]);
 const context={document,window:{sb:c,dispatchEvent:event=>events.push(event.type)},localStorage:{getItem:key=>{if(storageUnavailable)throw Error('storage blocked');return storage.get(key)},setItem:(key,value)=>{if(storageUnavailable)throw Error('storage blocked');storage.set(key,value)}},console:{error(){}},Event:class{constructor(type){this.type=type}},setTimeout:(fn,delay)=>jobs.push({fn,due:now+delay})};
 vm.runInNewContext(source,context);
 async function advance(ms){now+=ms;const due=jobs.filter(j=>j.due<=now);for(const job of due)jobs.splice(jobs.indexOf(job),1);await Promise.all(due.map(j=>j.fn()))}
 return {state,calls,writes,events,storage,elements,advance,auth:event=>onAuth(event)};
}

test('a completed import stays silent on startup, token renewal and repeated sign-in events',async()=>{
 const h=harness({done:true});assert.equal(h.elements.has('hpRbqAuto'),false);
 for(const event of ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'])h.auth(event);
 await h.advance(10000);h.auth('SIGNED_IN');await h.advance(10000);
 assert.deepEqual(h.calls,{auth:0,admin:0,count:0,import:0});assert.equal(h.writes.length,0);
});

test('an already populated directory is checked only once and never shows an availability toast',async()=>{
 for(const storageUnavailable of [false,true]){
  const h=harness({storageUnavailable});h.auth('INITIAL_SESSION');h.auth('SIGNED_IN');await h.advance(2000);
  for(let i=0;i<5;i++){h.auth('SIGNED_IN');h.auth('TOKEN_REFRESHED');await h.advance(10000)}
  assert.deepEqual(h.calls,{auth:1,admin:1,count:1,import:0});assert.equal(h.writes.length,0);
  if(!storageUnavailable)assert.equal(h.storage.get('hp_rbq_auto_import_v1'),'done');
 }
});

test('logged-out and non-admin users cannot start imports; a later admin sign-in can check quietly',async()=>{
 const h=harness({user:false,admin:false});await h.advance(2000);assert.equal(h.calls.admin,0);
 h.state.user=true;h.auth('SIGNED_IN');await h.advance(1000);assert.equal(h.calls.count,0);
 h.state.admin=true;h.auth('SIGNED_IN');await h.advance(1000);assert.equal(h.calls.count,1);
 assert.equal(h.calls.import,0);assert.equal(h.writes.length,0);
});

test('a failed count is not treated as an empty directory and cannot trigger an import',async()=>{
 const h=harness({counts:[null]});await h.advance(2000);
 assert.equal(h.calls.count,1);assert.equal(h.calls.import,0);assert.equal(h.writes.length,0);assert.equal(h.storage.size,0);
});

test('a genuinely empty directory imports once, dismisses completion and never replays it on focus',async()=>{
 const h=harness({counts:[0,3000]});h.auth('INITIAL_SESSION');h.auth('SIGNED_IN');await h.advance(2000);
 assert.equal(h.calls.import,1);assert.equal(h.calls.count,2);assert.equal(h.writes.length,1);
 assert.match(h.writes[0].innerHTML,/Import RBQ terminé/);assert.doesNotMatch(h.writes[0].innerHTML,/professionnels sont disponibles/);
 assert.deepEqual(h.events,['hp-professionals-updated']);
 await h.advance(8000);assert.equal(h.elements.has('hpRbqAuto'),false);
 h.auth('SIGNED_IN');h.auth('TOKEN_REFRESHED');await h.advance(10000);
 assert.equal(h.writes.length,1);assert.equal(h.calls.import,1);assert.equal(h.elements.has('hpRbqAuto'),false);
});
