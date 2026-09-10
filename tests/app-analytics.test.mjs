import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import handler from '../api/support.js';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
const uid='11111111-1111-4111-a111-111111111111';
const other='22222222-2222-4222-a222-222222222222';
const response=()=>({code:200,headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v},json(body){this.body=body;return this}});
const event=()=>({id:webcrypto.randomUUID(),session_id:webcrypto.randomUUID(),name:'feature_click',target:'diy'});

test('analytics endpoint rejects missing and expired sessions before collecting or reading data',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return {ok:false,json:async()=>({})}};
  try{let r=response();await handler({url:'/api/support?resource=analytics',method:'GET',headers:{}},r);assert.equal(r.code,401);assert.equal(calls,0);
    r=response();await handler({url:'/api/support?resource=analytics',method:'POST',headers:{authorization:'Bearer expired'},body:{events:[event()]}},r);assert.equal(r.code,401);assert.equal(calls,1);
  }finally{globalThis.fetch=original}
});
test('collection forwards only bounded events with the verified JWT and server deployment environment',async()=>{
  const original=globalThis.fetch,env=process.env.VERCEL_ENV,seen=[];process.env.VERCEL_ENV='preview';
  globalThis.fetch=async(url,options)=>{seen.push({url,options});return {ok:true,json:async()=>String(url).includes('/auth/')?{id:uid}:{accepted:1}}};
  try{const item=event(),r=response();await handler({url:'/api/support?resource=analytics',method:'POST',headers:{authorization:'Bearer verified'},body:{events:[item]}},r);
    assert.equal(r.code,200);const rpc=seen.at(-1);assert.match(rpc.url,/hp_record_app_events$/);assert.equal(rpc.options.headers.Authorization,'Bearer verified');assert.deepEqual(JSON.parse(rpc.options.body),{p_events:[item],p_environment:'preview'});
    for(const body of [{events:[item],environment:'production'},{events:Array(21).fill(item)},{events:[]},'x'.repeat(14001)]){const r=response();await handler({url:'/api/support?resource=analytics',method:'POST',headers:{authorization:'Bearer verified'},body},r);assert.equal(r.code,400)}
  }finally{globalThis.fetch=original;if(env===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=env}
});
test('database authorization, rate limits and invalid filters are not presented as zero statistics',async()=>{
  const original=globalThis.fetch;let code='42501';globalThis.fetch=async url=>String(url).includes('/auth/')?{ok:true,json:async()=>({id:uid,user_metadata:{admin:true}})}:{ok:false,status:400,json:async()=>({code})};
  try{let r=response();await handler({url:'/api/support?resource=analytics',method:'GET',headers:{authorization:'Bearer member'}},r);assert.equal(r.code,403);assert.equal(r.body.usage,undefined);
    r=response();await handler({url:'/api/support?resource=analytics&days=365',method:'GET',headers:{authorization:'Bearer member'}},r);assert.equal(r.code,400);
    code='P0001';r=response();await handler({url:'/api/support?resource=analytics',method:'GET',headers:{authorization:'Bearer member'}},r);assert.equal(r.code,429);
  }finally{globalThis.fetch=original}
});

function dom(){
  class Element{
    constructor(id=''){this.id=id;this.children=[];this.parent=null;this.handlers={};this.attributes={};this.textContent='';this.checked=false;this.disabled=false;this.dataset={};this.className=''}
    appendChild(el){el.parent=this;this.children.push(el)}prepend(el){el.parent=this;this.children.unshift(el)}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}
    set innerHTML(s){this.html=s;this.children=[];for(const m of s.matchAll(/\bid="([^"]+)"/g))this.appendChild(new Element(m[1]))}get innerHTML(){return this.html||''}
  }
  const body=new Element(),find=(id,el=body)=>el.id===id?el:el.children.map(c=>find(id,c)).find(Boolean)||null;
  return {Element,body,find};
}
function collector({sessionStore=new Map(),optOut=false,dnt=false,standalone=false,storageFails=false,session={user:{id:uid},access_token:'test'}}={}){
  const {Element,body,find}=dom();body.appendChild(new Element('more'));const callbacks={},timers=new Map(),sent=[],local=new Map(optOut?[['nuvabri.usage.enabled','false']]:[]);let authCallback,now=1789056000000,seq=0,fail=false;
  const listen=(n,f)=>(callbacks[n]??=[]).push(f),FixedDate=class extends Date{static now(){return now}};
  const ctx={Date:FixedDate,crypto:webcrypto,AbortController,console,
    navigator:{doNotTrack:dnt?'1':'0',standalone},matchMedia:()=>({matches:standalone}),
    localStorage:{getItem:k=>{if(storageFails)throw Error('storage');return local.get(k)||null},setItem:(k,v)=>{if(storageFails)throw Error('storage');local.set(k,v)}},
    sessionStorage:{getItem:k=>sessionStore.get(k)||null,setItem:(k,v)=>sessionStore.set(k,v),removeItem:k=>sessionStore.delete(k)},
    document:{readyState:'complete',visibilityState:'visible',getElementById:find,createElement:()=>new Element(),querySelector:()=>({id:'home'}),addEventListener:listen},addEventListener:listen,
    setTimeout:(f,ms)=>{timers.set(++seq,{f,ms});return seq},clearTimeout:id=>timers.delete(id),
    hpAccountAccess:{isRecovering:()=>false},supabaseClient:{auth:{getSession:async()=>({data:{session}}),onAuthStateChange:f=>authCallback=f}},
    fetch:async(url,options)=>{sent.push({url,options,body:JSON.parse(options.body)});if(fail){fail=false;throw Error('network')}return {ok:true,status:200}}
  };ctx.window=ctx;vm.runInNewContext(source('app-analytics.js'),ctx);
  return {sent,find,sessionStore,async ready(){await tick()},async flush(){const item=[...timers].find(([,t])=>t.ms===800);if(item){timers.delete(item[0]);item[1].f()}await tick()},
    emit:(n,e={})=>{for(const f of callbacks[n]||[])f(e)},async auth(event,s){session=s;authCallback(event,s);await tick()},advance:n=>now+=n,fail:()=>{fail=true},
    click({dataset={},match='',onclick='',admin=false}={}){const el={dataset,id:'',matches:s=>s===match,closest:s=>s==='#hpAdminModal,#hpSupportDialog'&&admin?{}:null,getAttribute:k=>k==='onclick'?onclick:null};for(const f of callbacks.click||[])f({isTrusted:true,target:{closest:()=>el}})}
  };
}
test('collector counts connected screen navigation and install signals separately, without input values',async()=>{
  const h=collector();await h.ready();await h.flush();
  assert.deepEqual(h.sent[0].body.events.map(e=>e.name),['session_start','screen_view']);
  h.emit('hp-screen-changed',{detail:{id:'budget'}});h.emit('hp-screen-changed',{detail:{id:'budget'}});
  h.click({match:'[data-maintenance-budget]',dataset:{maintenanceBudget:'private task and 5000 dollars'}});h.emit('appinstalled');h.emit('hp-calendar-exported');await h.flush();
  const rows=h.sent[1].body.events;assert.equal(rows.filter(x=>x.name==='screen_view').length,1);assert.equal(rows.filter(x=>x.name==='app_install').length,1);assert.equal(rows.filter(x=>x.name==='calendar_export').length,1);
  assert.doesNotMatch(JSON.stringify(h.sent),/private task|5000 dollars/);assert.ok(rows.every(x=>Object.keys(x).every(k=>['id','session_id','name','target'].includes(k))));
});
test('analytics sessions survive reload, roll after inactivity and clear when the account changes',async()=>{
  const h=collector();await h.ready();await h.flush();const first=h.sent[0].body.events[0].session_id;
  const again=collector({sessionStore:h.sessionStore,standalone:true});await again.ready();await again.flush();assert.equal(again.sent[0].body.events[0].session_id,first);assert.equal(again.sent[0].body.events.filter(x=>x.name==='standalone_open').length,1);
  again.advance(1800001);again.emit('hp-screen-changed',{detail:{id:'budget'}});await again.flush();assert.notEqual(again.sent.at(-1).body.events[0].session_id,first);
  await again.auth('SIGNED_IN',{user:{id:other},access_token:'other-token'});await again.flush();assert.equal(again.sent.at(-1).options.headers.Authorization,'Bearer other-token');assert.notEqual(again.sent.at(-1).body.events[0].session_id,first);
  await again.auth('SIGNED_OUT',null);again.emit('appinstalled');await again.flush();assert.equal(again.sessionStore.size,0);
});
test('opt out, browser privacy signals and anonymous pages produce no usage requests',async()=>{
  for(const options of [{optOut:true},{dnt:true},{session:null}]){const h=collector(options);await h.ready();h.emit('appinstalled');await h.flush();assert.equal(h.sent.length,0)}
  const h=collector({storageFails:true});await h.ready();const box=h.find('hpUsageEnabled');box.checked=false;box.onchange();h.emit('appinstalled');await h.flush();assert.equal(h.sent.length,0);
});
test('uncertain collection retries reuse event identifiers and never block the clicked control',async()=>{
  const h=collector();await h.ready();h.fail();await h.flush();await h.flush();assert.deepEqual(h.sent[0].body,h.sent[1].body);
  const n=h.sent.length;h.click({dataset:{analyticsBusiness:uid,analyticsKind:'property',analyticsAction:'phone'}});await h.flush();assert.equal(h.sent.length,n+1);assert.equal(h.sent.at(-1).body.events[0].target,'phone');
  h.click({dataset:{analyticsBusiness:uid,analyticsAction:'website'},admin:true});await h.flush();assert.equal(h.sent.length,n+1);
});
const sample=()=>({days:7,environment:'preview',include_admin:false,generated_at:'2026-09-10T16:00:00Z',collection_started_at:'2026-09-10T15:00:00Z',usage:{active_users:3,sessions:5,screen_views:12,clicks:7,install_signals:1,standalone_opens:2,calendar_exports:4,professional_clicks:2,product_clicks:1},inventory:{accounts:8,new_accounts:2,households:5,properties:6,leisure_equipment:3,leads:1},daily:[{date:'2026-09-09',users:null,sessions:null,clicks:null},{date:'2026-09-10',users:3,sessions:5,clicks:7}],screens:[{target:'budget',views:12}],features:[{target:'plan_cost',clicks:4}],products:[],businesses:[{name:'<img src=x onerror=bad()>',clicks:2,website:1,phone:1,requests:0}]});
function dashboard({forbidden=false,pending=false}={}){
  const {Element,body,find}=dom();body.appendChild(new Element('hpAdminBtn'));body.appendChild(new Element('hpAdminBody'));let callback,resolve;
  const ctx={console,URLSearchParams,AbortSignal,setTimeout,clearTimeout,
    document:{readyState:'complete',getElementById:find,createElement:()=>new Element()},addEventListener(){},
    supabaseClient:{auth:{getSession:async()=>({data:{session:{user:{id:uid},access_token:'admin'}}}),onAuthStateChange:f=>callback=f}},
    fetch:async()=>{if(pending)await new Promise(r=>resolve=r);return {ok:!forbidden,json:async()=>forbidden?{error:'Accès refusé'}:sample()}}
  };ctx.window=ctx;vm.runInNewContext(source('admin-analytics.js'),ctx);return {find,async ready(){await tick()},logout(){callback('SIGNED_OUT',null)},resolve(){resolve()}};
}
test('admin dashboard renders measured values, empty history and escaped merchant names',async()=>{
  const h=dashboard();await h.ready();const html=h.find('hpStatsResults').innerHTML;
  assert.match(html,/Membres actifs/);assert.match(html,/Installations signalées/);assert.match(html,/Ouvertures en mode application/);assert.match(html,/collecte non activée/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
test('admin denial and a response arriving after logout cannot expose stale metrics',async()=>{
  const rejected=dashboard({forbidden:true});await rejected.ready();assert.match(rejected.find('hpStatsResults').innerHTML,/Accès refusé/);assert.doesNotMatch(rejected.find('hpStatsResults').innerHTML,/class="hp-metric"/);
  const late=dashboard({pending:true});await late.ready();late.logout();late.resolve();await tick();assert.equal(late.find('hpAppStats'),null);
});
