import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../professional-admin.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const owner={id:'owner',user_metadata:{admin:true}};
function harness({user=owner,authorized=['owner'],authError=false}={}){
 const state={user,authorized:new Set(authorized),authError,recovering:false,roleResult:null,dataResult:null,reads:[]},timers=[],listeners={};let authChange;
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.parentElement=null;this.id='';this.attributes={};this.classes=new Set();this.textContent='';this._html='';this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)}}
  set className(value){this.classes=new Set(value.split(/\s+/).filter(Boolean))}
  get className(){return [...this.classes].join(' ')}
  set innerHTML(value){for(const child of this.children)child.parentElement=null;this.children=[];this._html=value;for(const match of value.matchAll(/\bid="([^"]+)"/g)){const child=new Element();child.id=match[1];this.appendChild(child)}}
  get innerHTML(){return this._html}
  setAttribute(key,value){this.attributes[key]=value}
  appendChild(child){child.remove();this.children.push(child);child.parentElement=this;return child}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null}}
  querySelector(selector){if(!selector.startsWith('#'))return null;const id=selector.slice(1);for(const child of this.children){if(child.id===id)return child;const found=child.querySelector(selector);if(found)return found}return null}
  querySelectorAll(){return []}
 }
 const body=new Element('body'),header=new Element(),more=new Element();body.appendChild(header);body.appendChild(more);more.id='hpAdminEntry';
 const get=id=>body.querySelector('#'+id),client={auth:{
  getUser:async()=>state.authError?{data:{user:null},error:Error('Session expired')}:{data:{user:state.user}},
  onAuthStateChange(fn){authChange=fn}
 },from(table){let uid;const query={
  select(){return query},eq(key,value){if(key==='user_id')uid=value;return query},order(){return query},limit(){return query},
  async maybeSingle(){state.reads.push(table);if(state.roleResult)return state.roleResult(uid);return {data:state.authorized.has(uid)?{user_id:uid}:null,error:null}},
  then(resolve,reject){state.reads.push(table);return (state.dataResult?state.dataResult(table):Promise.resolve({data:[],error:null})).then(resolve,reject)}
 };return query}};
 const context={document:{readyState:'complete',body,getElementById:get,createElement:tag=>new Element(tag),querySelector:selector=>selector==='main.app > .row'?header:null},
  supabaseClient:client,u:owner,user:owner,hpAccountAccess:{isRecovering:()=>state.recovering},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length},setInterval(){},addEventListener(type,fn){listeners[type]=fn},dispatchEvent(){},Event:class{constructor(type){this.type=type}},console};
 context.window=context;vm.runInContext(source,vm.createContext(context));
 return {state,get,header,more,listeners,async emit(event,next){state.user=next;authChange(event,next?{user:next}:null);const pending=timers.splice(0);for(const timer of pending)if(timer.ms===0)timer.fn();await tick()}};
}

test('verified admin has one clearly labelled header entry, outside the hidden Plus screen',async()=>{
 const h=harness();await tick();const button=h.get('hpAdminBtn');
 assert.equal(button.parentElement,h.header);assert.match(button.textContent,/Mon espace admin/);assert.equal(button.attributes['aria-controls'],'hpAdminModal');assert.equal(h.more.children.length,0);
 h.listeners.focus();await tick();assert.equal(h.header.children.filter(x=>x.id==='hpAdminBtn').length,1);
 assert.ok(!readFileSync(new URL('../launch-experience.js',import.meta.url),'utf8').includes("entry.appendChild(admin)"));
});
test('user metadata and stale global users never grant access without verified membership',async()=>{
 for(const options of [{authorized:[]},{authError:true},{user:null}]){const h=harness(options);await tick();assert.equal(h.get('hpAdminBtn'),null)}
});
test('admin can open the existing workspace and logout removes its entry and contents',async()=>{
 const h=harness();await tick();await h.get('hpAdminBtn').onclick();
 assert.equal(h.get('hpAdminModal').classList.contains('hidden'),false);assert.match(h.get('hpAdminBody').innerHTML,/Pilote partenaires/);
 await h.emit('SIGNED_OUT',null);assert.equal(h.get('hpAdminBtn'),null);assert.equal(h.get('hpAdminModal').classList.contains('hidden'),true);assert.equal(h.get('hpAdminBody').innerHTML,'');
});
test('changing to a non-admin account clears the open administrator workspace',async()=>{
 const h=harness();await tick();await h.get('hpAdminBtn').onclick();await h.emit('SIGNED_IN',{id:'member',user_metadata:{admin:true}});
 assert.equal(h.get('hpAdminBtn'),null);assert.equal(h.get('hpAdminBody').innerHTML,'');assert.equal(h.get('hpAdminModal').classList.contains('hidden'),true);
});
test('a late successful role check cannot restore admin UI after logout',async()=>{
 const h=harness();await tick();const pending=deferred();h.state.roleResult=()=>pending.promise;h.listeners.focus();await tick();
 await h.emit('SIGNED_OUT',null);pending.resolve({data:{user_id:'owner'},error:null});await tick();assert.equal(h.get('hpAdminBtn'),null);
});
test('revoked membership is checked again before opening or reading administration data',async()=>{
 const h=harness();await tick();h.state.authorized.clear();await h.get('hpAdminBtn').onclick();
 assert.equal(h.get('hpAdminBtn'),null);assert.ok(!h.state.reads.includes('professional_profiles'));assert.equal(h.get('hpAdminModal').classList.contains('hidden'),true);
});
test('late private data cannot repopulate the workspace after the session changes',async()=>{
 const h=harness();await tick();const pending=deferred();h.state.dataResult=()=>pending.promise;const opening=h.get('hpAdminBtn').onclick();await tick();
 await h.emit('SIGNED_OUT',null);pending.resolve({data:[],error:null});await opening;assert.equal(h.get('hpAdminBody').innerHTML,'');assert.equal(h.get('hpAdminModal').classList.contains('hidden'),true);
});
test('password recovery hides the administrator entry until normal sign-in resumes',async()=>{
 const h=harness();await tick();h.state.recovering=true;await h.emit('PASSWORD_RECOVERY',owner);h.listeners.focus();await tick();assert.equal(h.get('hpAdminBtn'),null);
 h.state.recovering=false;await h.emit('SIGNED_IN',owner);assert.ok(h.get('hpAdminBtn'));
});
