import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import handler from '../api/support.js';
import inbound from '../api/support-inbound.js';
import {configuration,verifyWebhook,mailbox,triage,aiInput} from '../lib/support-core.js';
const user='11111111-1111-4111-a111-111111111111';
const id='22222222-2222-4222-a222-222222222222';
const revision='33333333-3333-4333-a333-333333333333';
const ticket=()=>({id,revision,source:'manual',subject:'Erreur de connexion',body_text:'Je ne peux pas me connecter.',from_email:'client@example.com',status:'new',sensitive:false,draft:'',category:'technical',priority:'normal'});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this}}}
function req(body){return {method:body?'POST':'GET',url:'/api/support',headers:{authorization:'Bearer test-token'},body}}
async function run(fetcher,env,fn){
 const original=globalThis.fetch,old={};const keys=['SUPPORT_RECEIVE_ENABLED','SUPPORT_SEND_ENABLED','SUPPORT_AI_ENABLED','RESEND_API_KEY','RESEND_WEBHOOK_SECRET','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY','SUPPORT_AI_MODEL','SUPPORT_INBOX_ADDRESSES','SUPPORT_FROM_EMAIL'];
 for(const k of keys){old[k]=process.env[k];delete process.env[k]}Object.assign(process.env,env);globalThis.fetch=fetcher;
 try{await fn()}finally{globalThis.fetch=original;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
}
function fake({isAdmin=true,expired=false,t=ticket(),race=false}={}){
 const state={t,calls:[],sends:[],replies:new Map(),generations:[]};
 state.fetch=async(raw,opts={})=>{
  const url=new URL(raw),path=url.pathname,b=opts.body?JSON.parse(opts.body):null;state.calls.push({url,opts,b});
  if(path==='/auth/v1/user')return Response.json(expired?{}:{id:user,user_metadata:{admin:true}},{status:expired?401:200});
  if(path.endsWith('/admin_users'))return Response.json(isAdmin?[{user_id:user}]:[]);
  if(path.endsWith('/support_tickets')){
   assert.equal(opts.headers.Authorization,'Bearer test-token');
   if(opts.method==='POST'){if(state.t?.id===b.id)return Response.json([]);state.t={...b,revision};return Response.json([state.t])}
   if(opts.method==='PATCH'){if(race)return Response.json([]);assert.equal(url.searchParams.get('revision'),'eq.'+state.t.revision);state.t={...state.t,...b};return Response.json([state.t])}
   return Response.json(state.t?[state.t]:[]);
  }
  if(path.endsWith('/support_replies')){
   const rid=url.searchParams.get('id')?.slice(3);
   if(opts.method==='PATCH'){const r={...state.replies.get(rid),...b};state.replies.set(rid,r);return Response.json([r])}
   return Response.json([...state.replies.values()].filter(r=>(!rid||r.id===rid)&&(!url.searchParams.has('state')||r.state==='pending')));
  }
  if(path.endsWith('/hp_support_prepare_reply')){
   const existing=state.replies.get(b.p_request);if(existing)return Response.json(existing);
   const r={id:b.p_request,ticket_id:id,approved_by:user,approved_at:new Date().toISOString(),from_email:b.p_from,to_email:state.t.from_email,subject:'Re: '+state.t.subject,body_text:b.p_text,state:'pending'};
   state.replies.set(r.id,r);return Response.json(r);
  }
  if(path.endsWith('/support_generations')){
   if(opts.method==='POST'){state.generations.push(b);return Response.json([b])}
   if(opts.method==='PATCH'){const g=state.generations.find(x=>'eq.'+x.id===url.searchParams.get('id'));Object.assign(g,b);return Response.json([g])}
   return Response.json([]);
  }
  if(url.hostname==='api.resend.com'){state.sends.push({b,headers:opts.headers});return Response.json({id:randomUUID()})}
  if(url.hostname==='api.openai.com'){state.ai=b;return Response.json({status:'completed',usage:{total_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({category:'technical',priority:'normal',sensitive:false,summary:'Problème de connexion.',draft:'Peux-tu préciser le message d’erreur affiché?'})}]}]})}
  throw new Error('Unexpected URL: '+raw);
 };return state;
}
test('features fail closed without explicit flags and configured secrets',()=>{
 assert.deepEqual(configuration({}),{receiving:false,sending:false,ai:false,addresses:[],from:null});
 assert.equal(configuration({RESEND_API_KEY:'test',SUPPORT_FROM_EMAIL:'support@example.com'}).sending,false);
 assert.equal(configuration({SUPPORT_SEND_ENABLED:'true',RESEND_API_KEY:'test',SUPPORT_FROM_EMAIL:'bad\r\n@example.com'}).sending,false);
});
test('Vercel previews cannot enable external support integrations even with configured secrets',()=>{
 const configured={SUPPORT_RECEIVE_ENABLED:'true',SUPPORT_SEND_ENABLED:'true',SUPPORT_AI_ENABLED:'true',RESEND_API_KEY:'test',RESEND_WEBHOOK_SECRET:'test',SUPABASE_SERVICE_ROLE_KEY:'test',OPENAI_API_KEY:'test',SUPPORT_AI_MODEL:'test',SUPPORT_INBOX_ADDRESSES:'support@example.com',SUPPORT_FROM_EMAIL:'support@example.com'};
 for(const feature of ['receiving','sending','ai']){
  assert.equal(configuration({...configured,VERCEL_ENV:'production'})[feature],true);
  assert.equal(configuration({...configured,VERCEL_ENV:'preview'})[feature],false);
 }
});
test('webhook verification matches the published Svix vector and rejects tampering and replay',()=>{
 const payload='{"event_type":"ping","data":{"success":true}}';
 const headers={'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='};
 const secret='whsec_plJ3nmyCDGBKInavdOK15jsl';
 assert.equal(verifyWebhook(payload,headers,secret,1731705121000).event_type,'ping');
 assert.throws(()=>verifyWebhook(payload+' ',headers,secret,1731705121000));
 assert.throws(()=>verifyWebhook(payload,headers,secret,1731705481000));
 assert.throws(()=>verifyWebhook(payload,{...headers,'svix-timestamp':'NaN'},secret));
});
test('addresses reject header injection and sensitive triage takes precedence',()=>{
 assert.equal(mailbox('Client <client@example.com>'),'client@example.com');
 assert.throws(()=>mailbox('client@example.com\r\nBcc: bad@example.com'));
 assert.equal(triage('Partenariat','Je veux supprimer mon compte').category,'privacy');
 assert.equal(triage('Suggestion','Une plainte concernant votre service').sensitive,true);
 assert.equal(triage('CELI','Quel placement choisir?').sensitive,true);
 const prompt=aiInput({...ticket(),body_text:'client@example.com 418-555-0100 https://example.com/secret'});
 assert.ok(!prompt.includes('client@example.com'));assert.ok(!prompt.includes('418-555'));assert.ok(!prompt.includes('https://'));
});
test('API rejects missing session, expired session and non-admin despite user_metadata',async()=>{
 const res=response();await handler({...req(),headers:{}},res);assert.equal(res.code,401);assert.equal(res.headers['Cache-Control'],'private, no-store');
 for(const options of [{isAdmin:false},{expired:true}]){const d=fake(options);await run(d.fetch,{},async()=>{const r=response();await handler(req(),r);assert.equal(r.code,options.expired?401:403);assert.ok(!d.calls.some(x=>x.url.pathname.includes('support_')))})}
});
test('manual creation is idempotent and rejects reused IDs with changed contents',async()=>{
 const d=fake({t:null});await run(d.fetch,{},async()=>{const b={action:'create',request_id:id,from_email:'client@example.com',subject:'Bug',body_text:'Erreur'};
 for(let i=0;i<2;i++){const r=response();await handler(req(b),r);assert.equal(r.code,200)}
 const r=response();await handler(req({...b,body_text:'Autre texte'}),r);assert.equal(r.code,409);assert.equal(d.sends.length,0);
 });
});
test('stale updates and concurrent edits fail without replacing the saved draft',async()=>{
 for(const race of [false,true]){const d=fake({race});await run(d.fetch,{},async()=>{const r=response();await handler(req({action:'save',id,revision:race?revision:randomUUID(),draft:'Brouillon',category:'technical',priority:'normal',status:'review'}),r);assert.equal(r.code,409);assert.equal(d.t.draft,'')})}
});
test('sending is disabled by default and always requires explicit approval',async()=>{
 for(const env of [{},{SUPPORT_SEND_ENABLED:'true',RESEND_API_KEY:'test',SUPPORT_FROM_EMAIL:'support@example.com'}]){const d=fake();await run(d.fetch,env,async()=>{const r=response();await handler(req({action:'send',id,revision,request_id:randomUUID(),draft:'Bonjour'}),r);assert.equal(r.code,env.RESEND_API_KEY?400:503);assert.equal(d.sends.length,0);assert.equal(d.replies.size,0)})}
});
test('approved send uses stored recipient and preserves a stable idempotency key on retry',async()=>{
 const d=fake();await run(d.fetch,{SUPPORT_SEND_ENABLED:'true',RESEND_API_KEY:'test',SUPPORT_FROM_EMAIL:'support@example.com'},async()=>{
  const b={action:'send',id,revision,request_id:randomUUID(),draft:'Bonjour',approved:true,to:'attacker@example.com'};
  for(let i=0;i<2;i++){const r=response();await handler(req(b),r);assert.equal(r.code,200)}
  assert.equal(d.sends.length,1);assert.deepEqual(d.sends[0].b.to,['client@example.com']);assert.equal(d.sends[0].headers['Idempotency-Key'],'support-reply-'+b.request_id);
 });
});
test('uncertain sends older than the safe retry window are not resent',async()=>{
 const d=fake(),rid=randomUUID();d.replies.set(rid,{id:rid,approved_by:user,approved_at:new Date(Date.now()-24*3600000).toISOString(),state:'pending'});
 await run(d.fetch,{SUPPORT_SEND_ENABLED:'true',RESEND_API_KEY:'test',SUPPORT_FROM_EMAIL:'support@example.com'},async()=>{const r=response();await handler(req({action:'retry',reply_id:rid,approved:true}),r);assert.equal(r.code,409);assert.equal(d.sends.length,0)});
});
test('sensitive tickets never reach the model; ordinary drafts are saved before applying',async()=>{
 const env={SUPPORT_AI_ENABLED:'true',OPENAI_API_KEY:'test',SUPPORT_AI_MODEL:'configured-test-model'};
 for(const sensitive of [false,true]){const d=fake({t:{...ticket(),sensitive}});await run(d.fetch,env,async()=>{
  const r=response();await handler(req({action:'analyze',id,revision}),r);assert.equal(r.code,sensitive?409:200);
  if(sensitive){assert.equal(d.ai,undefined);assert.equal(d.generations.length,0)}else{assert.equal(d.ai.store,false);assert.equal(d.ai.tools,undefined);assert.ok(!JSON.stringify(d.ai).includes('client@example.com'));assert.equal(d.generations[0].status,'complete');assert.equal(d.generations[0].usage.total_tokens,100);assert.equal(d.sends.length,0);assert.equal(d.t.status,'review')}
 })}
});
test('inbound verifies raw signatures, filters mailbox, deduplicates and never sends or calls AI',async()=>{
 const secret='whsec_'+Buffer.alloc(32,1).toString('base64'),env={SUPPORT_RECEIVE_ENABLED:'true',RESEND_API_KEY:'test',RESEND_WEBHOOK_SECRET:secret,SUPABASE_SERVICE_ROLE_KEY:'service-test',SUPPORT_INBOX_ADDRESSES:'support@example.com'};
 const payload=JSON.stringify({type:'email.received',data:{email_id:id}}),ts=String(Math.floor(Date.now()/1000));
 const headers={'svix-id':'msg-test','svix-timestamp':ts,'svix-signature':'v1,'+createHmac('sha256',Buffer.alloc(32,1)).update(`msg-test.${ts}.${payload}`).digest('base64')};
 let writes=0;const calls=[];
 const fetcher=async(url,opts)=>{calls.push(url);if(url.includes('/emails/receiving/'))return Response.json({from:'Client <client@example.com>',to:['support@example.com'],subject:'Question',text:'Bonjour',html:'<script>alert(1)</script>',attachments:[]});assert.ok(url.includes('on_conflict=provider_email_id'));assert.ok(opts.headers.Prefer.includes('ignore-duplicates'));assert.ok(!opts.body.includes('<script>'));writes++;return Response.json([])};
 await run(fetcher,env,async()=>{const r=response();await inbound({method:'POST',headers,body:payload},r);assert.equal(r.code,200);assert.equal(writes,1);assert.equal(calls.length,2);const bad=response();await inbound({method:'POST',headers,body:payload+' '},bad);assert.equal(bad.code,401);assert.equal(calls.length,2)});
});
test('admin UI uses escaped plaintext, clears messages on session change and does not store mail locally',()=>{
 const source=readFileSync(new URL('../support-inbox.js',import.meta.url),'utf8');
 assert.match(source,/esc\(t.body_text\)/);assert.match(source,/nextId!==userId/);assert.match(source,/dialog\.remove\(\)/);
 assert.ok(!/localStorage|sessionStorage|iframe|eval\(/.test(source));
 const sql=readFileSync(new URL('../db/support-inbox.sql',import.meta.url),'utf8');
 assert.equal((sql.match(/enable row level security/g)||[]).length,3);assert.ok(!/security definer|user_metadata/i.test(sql));assert.match(sql,/for update;/);assert.match(sql,/support_one_pending_reply/);
});
