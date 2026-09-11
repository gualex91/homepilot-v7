import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const source=readFileSync(new URL('../property-gallery.js',import.meta.url),'utf8');
function harness(properties,fetcher){
 const events={},windowEvents={},calls=[],opened=[],activated=[];
 const classes=new Set(),nodes={pl:{innerHTML:'',querySelectorAll:()=>[]},properties:{classList:{contains:x=>classes.has(x),add:x=>classes.add(x)},querySelector:()=>({textContent:''})},pf:{classList:{remove:x=>calls.push(['form',x])}},pname:{focus:()=>calls.push(['focus'])}};
 let auth;
 const context={console,Date,AbortController,setTimeout,clearTimeout,Promise,encodeURIComponent,
  u:{id:'owner'},h:{id:'household'},props:properties,ap:properties[0],tasks:[],eq:[],
  hpStability:{token:async()=>'session-token'},activate:async id=>activated.push(id),
  document:{getElementById:id=>nodes[id],addEventListener:(type,fn)=>events[type]=fn},
  fetch:async(url,options)=>{calls.push([url,options]);return fetcher?fetcher(url,options):{ok:true,json:async()=>({property:{id:new URL('https://test'+url).searchParams.get('id')},equipment:[{}],tasks:[]})}},
  addEventListener:(type,fn)=>windowEvents[type]=fn,
  supabaseClient:{auth:{onAuthStateChange:fn=>auth=fn}},hpOpenProperty:id=>opened.push(id)
 };
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 const click=async(action,id)=>events.click({preventDefault(){},target:{closest:()=>({dataset:{propertyAction:action},closest:()=>id?{dataset:{propertyId:id}}:null})}});
 return {context,nodes,calls,opened,activated,click,auth:(...args)=>auth(...args),events,windowEvents,show:()=>classes.add('on'),refresh:()=>context.hpPropertyGallery.refresh()};
}
const p=(id,type='primary_residence')=>({id,name:'Bien '+id,city:'Saguenay',property_type:type});
test('cards choose real assets, escape user text, and distinguish the active property',()=>{
 const h=harness([{...p('one'),name:'<img onerror="alert(1)">'},p('two','secondary_residence'),p('three','Immeuble locatif')]);
 const html=h.nodes.pl.innerHTML;
 assert.match(html,/quebec-house.webp/);assert.match(html,/quebec-chalet.webp/);assert.match(html,/quebec-triplex.webp/);
 assert.equal((html.match(/✓ Bien actif/g)||[]).length,1);assert.match(html,/&lt;img onerror=&quot;/);assert.doesNotMatch(html,/<img onerror=/);
 assert.match(html,/Chargement…/);assert.match(html,/<dd>—<\/dd>/);
 for(const file of ['house','chalet','triplex'])assert.ok(existsSync(new URL('../assets/properties/quebec-'+file+'.webp',import.meta.url)));
});
test('each card loads its own authenticated counts and earliest unfinished maintenance',async()=>{
 const h=harness([p('one'),p('two')],async url=>({ok:true,json:async()=>({property:{id:url.endsWith('one')?'one':'two'},equipment:url.endsWith('one')?[{},{}]:[],tasks:url.endsWith('one')?[{title:'Fait',status:'done',due_at:'2000-01-01'},{title:'Filtre',status:'todo',due_at:'2020-01-02'},{title:'Plus tard',status:'todo',due_at:'2099-01-01'}]:[]})}));
 h.show();await h.refresh();
 const [first,second]=h.nodes.pl.innerHTML.split('<article').slice(1);
 assert.match(first,/<dd>2<\/dd>/);assert.match(first,/Filtre/);assert.match(first,/Entretien en retard/);assert.doesNotMatch(first,/Plus tard/);
 assert.match(second,/<dd>0<\/dd>/);assert.match(second,/Aucune tâche en attente/);
 assert.ok(h.calls.every(([,o])=>o.headers.Authorization==='Bearer session-token'&&o.cache==='no-store'));
 await h.refresh();assert.equal(h.calls.length,2);
});
test('details, active-property and empty-state controls preserve existing flows',async()=>{
 const h=harness([p('one')]);await h.click('details','one');await h.click('activate','one');await h.click('details','other');
 assert.deepEqual(h.opened,['one']);assert.deepEqual(h.activated,['one']);
 const empty=harness([]);assert.match(empty.nodes.pl.innerHTML,/Ajouter mon premier bien/);await empty.click('add');assert.deepEqual(empty.calls,[['form','hidden'],['focus']]);
});
test('failed details keep property accessible and show unknown counts with retry',async()=>{
 let fail=true;const h=harness([p('one')],async()=>({ok:!fail,json:async()=>fail?{error:'oops'}:{property:{id:'one'},equipment:[],tasks:[]}}));
 h.show();await h.refresh();assert.match(h.nodes.pl.innerHTML,/Suivi indisponible/);assert.match(h.nodes.pl.innerHTML,/<dd>—<\/dd>/);
 await h.click('details','one');assert.deepEqual(h.opened,['one']);fail=false;
 await h.context.hpPropertyGallery.refresh(true);assert.match(h.nodes.pl.innerHTML,/Aucune tâche en attente/);
});
test('edited details win over an earlier pending overview request',async()=>{
 let resolve;const h=harness([p('one')],()=>new Promise(r=>resolve=r));h.show();const loading=h.refresh();await new Promise(setImmediate);
 h.context.hpPropertyGallery.accept({...p('one'),name:'Maison modifiée'},[{},{}],[{title:'Nouvelle tâche',due_at:'2099-01-01'}]);
 resolve({ok:true,json:async()=>({property:p('one'),equipment:[],tasks:[]})});await loading;
 assert.match(h.nodes.pl.innerHTML,/Maison modifiée/);assert.match(h.nodes.pl.innerHTML,/Nouvelle tâche/);assert.match(h.nodes.pl.innerHTML,/<dd>2<\/dd>/);
});
test('sign-out clears cards and late responses cannot restore another account’s data',async()=>{
 let resolve;const h=harness([p('one')],()=>new Promise(r=>resolve=r));h.show();const loading=h.refresh();await new Promise(setImmediate);
 h.auth('SIGNED_OUT',null);assert.equal(h.nodes.pl.innerHTML,'');
 resolve({ok:true,json:async()=>({property:p('one'),equipment:[],tasks:[]})});await loading;assert.equal(h.nodes.pl.innerHTML,'');
 h.auth('SIGNED_IN',{user:{id:'new-owner'}});await h.refresh();assert.equal(h.nodes.pl.innerHTML,'');
});
test('repeated refreshes do not exceed two concurrent detail requests',async()=>{
 let current=0,max=0;const h=harness([p('one'),p('two'),p('three'),p('four')],async url=>{
  current++;max=Math.max(max,current);await new Promise(setImmediate);current--;return {ok:true,json:async()=>({property:{id:new URL('https://test'+url).searchParams.get('id')},equipment:[],tasks:[]})};
 });h.show();await Promise.all([h.refresh(),h.refresh(),h.refresh()]);assert.equal(max,2);assert.equal(h.calls.length,4);
});
