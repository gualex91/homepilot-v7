import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import '../account-access.js';
import '../professional-presentation.js';
import '../launch-experience.js';
import professionals from '../api/professionals.js';

const A=globalThis.hpAccountAccess,P=globalThis.hpProfessionalPresentation,L=globalThis.hpLaunchExperience;
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function elements(){
  const map=new Map();
  const get=id=>{
    if(!map.has(id)){const classes=new Set();map.set(id,{id,value:'',hidden:false,disabled:false,checked:false,textContent:'',innerHTML:'',attributes:{},handlers:{},isConnected:true,
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,force){if(force===true)classes.add(x);else if(force===false)classes.delete(x);else if(classes.has(x))classes.delete(x);else classes.add(x)}},
      setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},addEventListener(k,v){this.handlers[k]=v},focus(){},querySelector(){return null},querySelectorAll(){return []}})}
    return map.get(id);
  };
  return {get,map};
}
function authHarness({hash='',initial=null,resetError=null,signOutError=null,bootError=false}={}){
  const el=elements(),calls={reset:[],update:[],out:[],boot:[]};let callback;
  const auth={onAuthStateChange(fn){callback=fn},getSession:async()=>({data:{session:initial}}),
    resetPasswordForEmail:async(...args)=>{calls.reset.push(args);return {error:resetError}},
    signInWithPassword:async()=>({data:{session:{user:{id:'member'}}}}),
    signUp:async()=>({data:{session:null}}),
    updateUser:async payload=>{calls.update.push(payload);return {data:{user:initial?.user}}},
    signOut:async opts=>{calls.out.push(opts);callback('SIGNED_OUT',null);return {error:signOutError}}};
  const ctx=vm.createContext({URL,URLSearchParams,setTimeout,document:{getElementById:el.get},location:{origin:'https://nuvabri.test',hash,search:'',reload(){}},history:{replaceState(){}}});
  vm.runInContext(source('account-access.js'),ctx);
  ctx.hpAccountAccess.start({auth},async value=>{calls.boot.push(value);if(bootError)throw Error('load failed')});
  return {...el,api:ctx.hpAccountAccess,calls,event:(...args)=>callback(...args)};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));

test('onboarding follows saved data and never requires a property for the budget',()=>{
  assert.equal(L.nextStep({household:null}).step,1);
  assert.equal(L.nextStep({household:{id:'h'}}).step,2);
  assert.equal(L.nextStep({household:{},properties:[{id:'p'}]}).target,'tasks');
  assert.equal(L.nextStep({household:{},properties:[{id:'p'},{id:'chalet'},{id:'rental'}],tasks:[{}]}).step,4);
  assert.match(source('launch-experience.js'),/Commencer par mon budget/);
});
test('paid visibility and verification remain independent; unsafe links are not rendered',()=>{
  assert.equal(P.listingLabel({verified:true}),'Fiche non commanditée');
  assert.equal(P.listingLabel({sponsored:true}),'Publicité · Commandité');
  assert.equal(P.listingLabel({listing_tier:'partner'}),'Partenaire commercial');
  assert.equal(P.safeWebsite('javascript:alert(1)'),'');
  assert.equal(P.safeWebsite('https://name:password@example.com'),'');
  const html=P.card({business_name:'<img onerror="x">',website:'javascript:alert(1)',listing_tier:'sponsored'});
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('Vérification indiquée'));
  assert.deepEqual(P.sortRows([{business_name:'Zulu',sponsored:true},{business_name:'Alpha'}],'alphabetical').map(p=>p.business_name),['Alpha','Zulu']);
});
test('lead validation requires explicit consent and useful contact details',()=>{
  const data={contact_name:'Test',contact_email:'test@example.com',contact_phone:'',message:'Nettoyer ma thermopompe',consent_to_share:true};
  assert.equal(P.validateLead(data),null);
  for(const patch of [{consent_to_share:false},{contact_email:'invalid'},{message:'x'},{contact_name:''}])assert.ok(P.validateLead({...data,...patch}));
});
test('password reset keeps return URL same-origin and never claims an account exists',async()=>{
  const h=authHarness();await tick();h.api.render('login');h.api.requestResetView();
  h.get('em').value='Test@Example.com';await h.api.submit();
  assert.equal(h.calls.reset.length,1);assert.equal(h.calls.reset[0][0],'test@example.com');
  assert.equal(h.calls.reset[0][1].redirectTo,'https://nuvabri.test/');
  assert.match(h.get('am').textContent,/Si un compte correspond/);assert.equal(h.get('ab').disabled,false);
});
test('recovery does not boot dashboard and saving waits for matching passwords',async()=>{
  const session={user:{id:'member'}},h=authHarness({hash:'#type=recovery&access_token=example',initial:session});
  await tick();h.event('PASSWORD_RECOVERY',session);h.event('SIGNED_IN',session);await tick();
  assert.equal(h.calls.boot.length,0);assert.equal(h.get('hpRecoveryForm').hidden,false);
  h.get('hpNewPassword').value='a-long-unique-password';h.get('hpConfirmPassword').value='different';
  await h.get('hpRecoveryForm').handlers.submit({preventDefault(){}});assert.equal(h.calls.update.length,0);
  h.get('hpConfirmPassword').value='a-long-unique-password';
  await h.get('hpRecoveryForm').handlers.submit({preventDefault(){}});
  assert.equal(h.calls.update.length,1);assert.equal(h.calls.out[0].scope,'global');assert.equal(h.get('hpRecoveryForm').hidden,true);
  assert.match(h.get('am').textContent,/Mot de passe modifié/);assert.equal(h.get('hpNewPassword').value,'');
});
test('expired recovery cannot update a password and provider errors release controls',async()=>{
  const expired=authHarness({hash:'#type=recovery'});await tick();
  assert.equal(expired.get('hpSavePassword').disabled,true);assert.match(expired.get('hpRecoveryHint').textContent,/expiré/);
  const failed=authHarness({resetError:{status:429}});await tick();failed.api.requestResetView();failed.get('em').value='test@example.com';await failed.api.submit();
  assert.match(failed.get('am').textContent,/Trop de tentatives/);assert.equal(failed.get('ab').disabled,false);
});
test('a failed household load shows a retry instead of suggesting a duplicate household',async()=>{
  const h=authHarness({initial:{user:{id:'member'}},bootError:true});await tick();
  assert.equal(h.get('hpLoadError').hidden,false);assert.ok(h.get('setup').classList.contains('hidden'));
  assert.equal(typeof h.get('hpRetryLoad').onclick,'function');await h.get('hpRetryLoad').onclick();assert.equal(h.calls.boot.length,2);
  assert.match(source('app-core.html'),/if\(m\.error\)throw m\.error/);
});
test('duplicate auth events boot once; a failed final signout does not change password twice',async()=>{
  const session={user:{id:'member'}},normal=authHarness({initial:session});await tick();normal.event('SIGNED_IN',session);normal.event('INITIAL_SESSION',session);await tick();assert.equal(normal.calls.boot.length,1);
  const h=authHarness({hash:'#type=recovery',initial:session,signOutError:{status:500}});await tick();h.get('hpNewPassword').value='long-enough-password';h.get('hpConfirmPassword').value='long-enough-password';
  await h.get('hpRecoveryForm').handlers.submit({preventDefault(){}});await h.get('hpRecoveryForm').handlers.submit({preventDefault(){}});
  assert.equal(h.calls.update.length,1);assert.equal(h.calls.out.length,2);assert.match(h.get('am').textContent,/déconnexion/);
});
test('the four destinations are semantic buttons; every old section stays reachable',()=>{
  const html=source('app-core.html'),nav=html.match(/<nav class="tabs"[\s\S]*?<\/nav>/)[0];
  assert.equal([...nav.matchAll(/class="tab"/g)].length,4);
  for(const id of ['home','properties','budget','more'])assert.ok(nav.includes('data-screen="'+id+'"'));
  for(const id of ['tasks','equipment','household','leisure'])assert.ok(source('launch-experience.js').includes('data-screen="'+id+'"'));
  for(const file of ['launch-experience.js','account-access.js','professional-presentation.js','launch-experience.css'])assert.ok(source(file).length>0);
  assert.match(source('index.html'),/launch-experience\.js/);
});
test('navigation marks the right group and loads finances once per action',()=>{
  const el=elements(),screens=['home','properties','equipment','leisure','budget','more','tasks'].map(el.get),buttons=['home','properties','budget','more'].map(id=>Object.assign(el.get('nav-'+id),{dataset:{screen:id}}));
  let loads=0;const context={document:{readyState:'complete',getElementById:el.get,querySelectorAll:q=>q==='.screen'?screens:buttons,querySelector:()=>screens[0],addEventListener(){},dispatchEvent(){}},scrollTo(){},hpLoadBudget:()=>loads++,CustomEvent:class {constructor(type,data){this.type=type;this.detail=data.detail}}};context.window=context;
  vm.runInContext(source('navigation-fix.js'),vm.createContext(context));context.hpOpenScreen('budget');assert.equal(loads,1);assert.equal(buttons[2].attributes['aria-current'],'page');context.show('equipment');assert.equal(buttons[1].attributes['aria-current'],'page');assert.equal(buttons[2].attributes['aria-current'],undefined);
});
test('lead submission uses one ID for a double click and retry after uncertain insert',async()=>{
  const el=elements(),writes=[],rows=new Map();let first=true;
  const client={
    auth:{getUser:async()=>({data:{user:{id:'member'}}})},
    from:()=>({
      upsert(payload){writes.push(payload);rows.set(payload.id,payload);return {select:async()=>{if(first){first=false;throw Error('network')}return {data:[]}}}},
      select(){return {eq(){return this},maybeSingle:async()=>({data:{id:[...rows.keys()][0]}})}}
    })
  };
  const ctx=vm.createContext({document:{getElementById:el.get},crypto:webcrypto,URL,URLSearchParams,supabaseClient:client,hpAccountAccess:A});vm.runInContext(source('professional-presentation.js'),ctx);
  ctx.hpProfessionalPresentation.quote({id:'pro',business_name:'Entreprise test'},{property:{id:'property',name:'Chalet'},category:'hvac'});
  el.get('hpLeadName').value='Test';el.get('hpLeadEmail').value='test@example.com';el.get('hpLeadMessage').value='Entretenir une thermopompe';el.get('hpLeadConsent').checked=true;
  const submit=el.get('hpLeadForm').onsubmit,event={preventDefault(){}};
  await Promise.all([submit(event),submit(event)]);assert.equal(writes.length,1);assert.equal(el.get('hpLeadSend').disabled,false);
  await submit(event);assert.equal(writes.length,2);assert.equal(rows.size,1);assert.equal(writes[0].id,writes[1].id);
  assert.equal(writes[0].property_id,'property');assert.equal(writes[0].professional_id,'pro');assert.equal(writes[0].user_id,'member');
  assert.match(el.get('hpProBody').innerHTML,/Demande enregistrée/);assert.ok(!el.get('hpProBody').innerHTML.includes('Demande envoyée'));
});
test('regional spelling and blank postal prefixes cannot distort local recommendations',async()=>{
  const real=globalThis.fetch;
  globalThis.fetch=async()=>Response.json([{id:'local',business_name:'Local',active:true,directory_issues:[],regions:['Saguenay–Lac-Saint-Jean']},{id:'wrong',business_name:'Ailleurs',active:true,directory_issues:[],regions:['Montréal'],postal_prefixes:[''],listing_tier:'sponsored'}]);
  try{const res={status(n){this.code=n;return this},setHeader(){},json(data){this.data=data;return this}};await professionals({method:'GET',headers:{authorization:'Bearer test'},query:{city:'Jonquière',postal:'G7X1A1'}},res);assert.deepEqual(res.data.rows.map(p=>p.id),['local'])}finally{globalThis.fetch=real}
});
