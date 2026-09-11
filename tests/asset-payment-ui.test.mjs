import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const decode=s=>String(s||'').replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
function harness(){
 const nodes=new Map(),events={},requests=[],published=[],storage=new Map();
 let user='owner',rows=[],fail=false,hold=null;
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.handlers={};this.value='';this.disabled=false;this.open=false;this.children=[];this.dataset={};this.checked=false;}
  set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
  setAttribute(){}addEventListener(name,fn){this.handlers[name]=fn}focus(){}
  showModal(){this.open=true}close(){if(this.open){this.open=false;this.handlers.close?.()}}
  querySelectorAll(){return this.children.filter(n=>['INPUT','SELECT','BUTTON'].includes(n.tagName))}
  set innerHTML(html){this.html=html;this.children=[];
   for(const m of html.matchAll(/<(input|select|button|form|h2|p|div)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const n=new Node(m[1]);n.id=m[3];n.value=decode(m[2].match(/\bvalue="([^"]*)"/)?.[1]||'');n.checked=/\bchecked\b/.test(m[2]);
    const tail=html.slice(m.index+m[0].length).split('</'+m[1]+'>')[0];
    if(m[1]==='select'){const opts=[...tail.matchAll(/<option value="([^"]*)"([^>]*)>/g)];n.value=decode((opts.find(x=>/selected/.test(x[2]))||opts[0])?.[1]||'');}
    this.children.push(n);
   }
  }get innerHTML(){return this.html||''}
 }
 const doc={getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),body:{appendChild(){}},querySelectorAll:()=>[],addEventListener:(k,fn)=>{(events[k]??=[]).push(fn)}};
 const ctx={document:doc,console,Intl,Date,AbortSignal,crypto:webcrypto,URL,URLSearchParams,structuredClone,
  setTimeout,clearTimeout,confirm:()=>true,alert(){},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options)}},
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  dispatchEvent:e=>published.push(e),supabaseClient:{auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:user}}}),onAuthStateChange:fn=>{events.auth=fn}}},
  fetch:async(url,opts)=>{const request={method:opts.method,body:opts.body?JSON.parse(opts.body):null};requests.push(request);if(hold&&opts.method!=='GET')await hold;
   if(fail&&opts.method!=='GET')return {ok:false,json:async()=>({error:'Confirmation non reçue. Réessaie.'})};
   if(opts.method==='PUT'){const b=request.body;rows=[{...b,id:'saved',asset_name:'remorque',leisure_equipment_id:b.asset_id,revision:b.request_id}]}
   if(opts.method==='DELETE')rows=[];
   return {ok:true,json:async()=>({user_id:opts.headers.Authorization.slice(7),payments:rows,payment:rows[0]||null})};
  }
 };ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['stability-core.js','budget-engine.js','asset-payment-engine.js','asset-payments.js'])vm.runInContext(source(file),ctx,{filename:file});
 const get=id=>nodes.get(id),tick=()=>new Promise(r=>setImmediate(r));
 return {ctx,get,requests,published,rows:()=>rows,fail:v=>fail=v,hold:v=>hold=v,tick,
  async open(){await ctx.hpAssetPayments.open('leisure',{id:'trailer',name:'Remorque <test>'})},
  async submit(){get('hpPaymentForm').onsubmit({preventDefault(){}});await tick()},
  logout(){user='next';events.auth('SIGNED_OUT',null)}
 };
}

test('payment form saves a weekly amount, shows the annual calculation, and opens the same saved payment for editing',async()=>{
 const h=harness();await h.open();assert.equal(h.get('hpAssetPaymentDialog').open,true);assert.match(h.get('hpAssetPaymentDialog').innerHTML,/Remorque &lt;test&gt;/);
 h.get('hpPaymentAmount').value='70';h.get('hpPaymentFrequency').value='weekly';h.get('hpPaymentForm').handlers.input();
 assert.match(h.get('hpPaymentPreview').innerHTML,/303,33/);assert.match(h.get('hpPaymentPreview').innerHTML,/3[\s\u00a0]640,00/);
 await h.submit();assert.equal(h.rows().length,1);assert.equal(h.rows()[0].amount,70);assert.equal(h.rows()[0].frequency,'weekly');assert.equal(h.get('hpAssetPaymentDialog').open,false);
 await h.open();assert.equal(h.get('hpPaymentAmount').value,'70');assert.equal(h.get('hpPaymentFrequency').value,'weekly');
 h.get('hpPaymentAmount').value='80';await h.submit();assert.equal(h.rows().length,1);assert.equal(h.rows()[0].amount,80);
 const writes=h.requests.filter(x=>x.method==='PUT');assert.equal(writes[1].body.expected_revision,writes[0].body.request_id);
});
test('cancel writes nothing; a failed save keeps its amount and retries using the same request id',async()=>{
 const h=harness();await h.open();h.get('hpPaymentCancel').onclick();assert.equal(h.requests.filter(x=>x.method!=='GET').length,0);
 await h.open();h.get('hpPaymentAmount').value='70';h.fail(true);await h.submit();assert.equal(h.get('hpAssetPaymentDialog').open,true);assert.equal(h.get('hpPaymentAmount').value,'70');assert.equal(h.get('hpPaymentSave').disabled,false);assert.match(h.get('hpPaymentStatus').textContent,/Confirmation/);
 h.fail(false);await h.submit();const writes=h.requests.filter(x=>x.method==='PUT');assert.equal(writes[0].body.request_id,writes[1].body.request_id);assert.equal(h.get('hpAssetPaymentDialog').open,false);
});
test('double clicks do not duplicate a save and sign-out clears amounts and rejects a late response',async()=>{
 const h=harness();await h.open();h.get('hpPaymentAmount').value='70';let release;h.hold(new Promise(r=>release=r));await h.submit();await h.submit();assert.equal(h.requests.filter(x=>x.method==='PUT').length,1);
 const before=h.published.length;h.logout();assert.equal(h.get('hpAssetPaymentDialog').innerHTML,'');release();await h.tick();assert.equal(h.published.length,before);assert.equal(h.get('hpAssetPaymentDialog').open,false);
});
