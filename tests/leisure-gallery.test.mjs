import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function harness(){
 const events={},intervals=[],actions=[],nodes={};let authCallback,fetchRows;
 function node(id){return nodes[id]||= {id,dataset:{},innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector(){return {textContent:''}},querySelectorAll:()=>[],insertAdjacentHTML(_where,html){this.innerHTML=html+this.innerHTML},focus(){actions.push(['focus',id])}};}
 ['leisure','hpLeisureList','hpLeisureForm','hpLeisureName','hpLeisureTaskModal'].forEach(node);
 const ctx={console,Date,Promise,setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},
  document:{readyState:'complete',getElementById:id=>nodes[id],addEventListener:(name,fn)=>{(events[name]||=[]).push(fn)}},
  hpMaintenanceBudget:{button:(t,name)=>'<button data-budget-task="'+t.id+'">Prévoir au budget</button>'},
  HomePilotVrShop:{renderForEquipment:type=>['rv','boat'].includes(type)?'<details class="hpVrSuggestions"><summary>Articles '+type+'</summary></details>':''},
  supabaseClient:{auth:{getUser:async()=>({data:{user:{id:'owner'}}}),onAuthStateChange:fn=>{authCallback=fn}},from:table=>({select(){return this},eq(){return this},order(){return fetchRows(table)}})}
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('leisure-tasks.js'),ctx);vm.runInContext(read('leisure-gallery.js'),ctx);
 const addTask=ctx.hpAddLeisureTask;
 for(const name of ['hpAddLeisureTask','hpFindLeisurePro','hpShowLeisureDiy','hpToggleLeisureTask','hpDeleteLeisureTask','hpDeleteLeisure'])ctx[name]=(...args)=>actions.push([name,...args]);
 ctx.hpLoadLeisure=()=>{};intervals.at(-1)();
 return {ctx,actions,nodes,node,addTask,auth:(event,session)=>authCallback(event,session),data:fn=>fetchRows=fn,
  render:(eq,ts=[],owner='owner')=>ctx.hpLeisureGallery.render(eq,ts,owner),
  click:async(action,equipment,task)=>{const card={dataset:{leisureEquipment:equipment}},button={dataset:{leisureAction:action,...(task?{taskId:task}:{})},closest:s=>s==='#hpLeisureList'?nodes.hpLeisureList:s==='[data-leisure-equipment]'?card:null};const e={target:{closest:()=>button},preventDefault(){}};for(const fn of events.click||[])await fn(e);}
 };
}
const eq=(id,type)=>({id,equipment_type:type,name:'Mon '+id});
test('all supported vehicles have distinct illustration paths; unknown types use a neutral fallback',()=>{
 const h=harness();const types=['snowmobile','atv','side_by_side','boat','personal_watercraft','rv','travel_trailer','motorcycle','utility_trailer'];
 h.render(types.map(type=>eq(type,type)));const html=h.nodes.hpLeisureList.innerHTML;
 assert.equal(new Set([...html.matchAll(/src="(\/assets\/leisure\/[^\"]+)"/g)].map(m=>m[1])).size,9);
 assert.equal((html.match(/>Illustration</g)||[]).length,9);assert.doesNotMatch(html,/<details[^>]+ open/);
 h.render([eq('other','__proto__')]);assert.match(h.nodes.hpLeisureList.innerHTML,/Autre loisir/);assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/undefined.webp/);
});
test('cards keep tasks with their equipment and show the first unfinished due date',()=>{
 const h=harness();h.render([eq('boat','boat'),eq('rv','rv')],[
  {id:'done',leisure_equipment_id:'boat',title:'Déjà fait',due_date:'2000-01-01',status:'done'},
  {id:'later',leisure_equipment_id:'boat',title:'Printemps bateau',due_date:'2099-05-15',status:'todo'},
  {id:'next',leisure_equipment_id:'boat',title:'Hivernisation bateau',due_date:'2020-10-15',status:'todo'},
  {id:'rv-task',leisure_equipment_id:'rv',title:'Inspection du toit',due_date:null,status:'todo'}]);
 const [boat,rv]=h.nodes.hpLeisureList.innerHTML.split('<article').slice(1);
 assert.match(boat,/<dd>2<\/dd>/);assert.match(boat,/<dd>1<\/dd>/);assert.match(boat,/Entretien en retard/);assert.match(boat,/<strong>Hivernisation bateau<\/strong>/);assert.doesNotMatch(boat,/Inspection du toit/);
 assert.match(rv,/Aucune prochaine date fixée/);assert.doesNotMatch(rv,/Hivernisation bateau/);
 assert.match(boat,/Articles boat/);assert.match(rv,/Articles rv/);assert.match(boat,/data-budget-task="next"/);
});
test('names remain text and all existing actions receive the exact equipment or task',async()=>{
 const h=harness(),name='Bateau d’Alex "<img>"';h.render([{...eq('boat','boat'),name}],[{id:'task',leisure_equipment_id:'boat',title:'Hiver',status:'todo',diy_key:'boat_winterize'}]);
 assert.match(h.nodes.hpLeisureList.innerHTML,/&quot;&lt;img&gt;&quot;/);assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/onclick=/);
 for(const [action,task] of [['add-task'],['professional'],['diy','task'],['professional','task'],['toggle','task'],['delete-task','task'],['delete-equipment']])await h.click(action,'boat',task);
 assert.deepEqual(h.actions,[['hpAddLeisureTask','boat','boat',name],['hpFindLeisurePro','boat'],['hpShowLeisureDiy','boat_winterize'],['hpFindLeisurePro','boat_winterize'],['hpToggleLeisureTask','task','todo'],['hpDeleteLeisureTask','task'],['hpDeleteLeisure','boat']]);
 await h.click('toggle','foreign','task');assert.equal(h.actions.length,7);
});
test('the real loader feeds the gallery; failures do not claim there are zero tasks',async()=>{
 const h=harness();h.data(async table=>({data:table==='leisure_equipment'?[eq('boat','boat')]:[],error:null}));await h.ctx.hpLoadLeisure();
 assert.match(h.nodes.hpLeisureList.innerHTML,/Mon boat/);
 h.data(async()=>({data:null,error:{message:'unavailable'}}));await h.ctx.hpLoadLeisure();
 assert.match(h.nodes.hpLeisureList.innerHTML,/Réessayer/);assert.match(h.nodes.hpLeisureList.innerHTML,/Mon boat/);
 h.data(async()=>{throw new Error('network')});await h.ctx.hpLoadLeisure();assert.match(h.nodes.hpLeisureList.innerHTML,/Réessayer/);
});
test('signed-out users cannot regain old cards from late responses or stale buttons',async()=>{
 const h=harness();let release;const wait=new Promise(r=>release=r);h.data(async table=>{await wait;return {data:table==='leisure_equipment'?[eq('private','boat')]:[],error:null}});
 const loading=h.ctx.hpLoadLeisure();await new Promise(setImmediate);h.auth('SIGNED_OUT',null);release();await loading;
 assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/Mon private/);await h.click('delete-equipment','private');assert.equal(h.actions.length,0);
});
test('an empty collection opens the existing add form',async()=>{
 const h=harness();h.render([]);assert.match(h.nodes.hpLeisureList.innerHTML,/Ajouter mon premier loisir/);
 await h.click('add-equipment');assert.deepEqual(h.actions,[['focus','hpLeisureName']]);
});

test('Remorque is selectable separately from Roulotte and offers four matching maintenance presets',()=>{
 const types=vm.runInNewContext(read('leisure-budget.js').match(/const TYPES=(\[.*?\]);/)[1]);
 assert.equal(types.filter(([key])=>key==='utility_trailer').length,1);assert.ok(types.some(([key])=>key==='travel_trailer'));
 const h=harness();for(const id of ['hpLtmTitle','hpLtmBody','hpLtPreset','hpLtSave','hpLtTitle','hpLtDate'])h.node(id);
 h.addTask('trailer','utility_trailer','Ma remorque');
 const html=h.nodes.hpLtmBody.innerHTML;assert.match(html,/Inspection annuelle de la remorque/);assert.match(html,/pneus et la pression/);assert.match(html,/roulements et les moyeux/);assert.match(html,/feux et le câblage/);
 h.nodes.hpLtPreset.value='2';h.nodes.hpLtPreset.onchange();assert.equal(h.nodes.hpLtSave.dataset.diy,'trailer_bearing_check');
 h.nodes.hpLtPreset.value='';h.nodes.hpLtPreset.onchange();assert.equal(h.nodes.hpLtSave.dataset.diy,'');
});
test('reclassifying Other updates only the equipment type and retains the same tasks and image context',async()=>{
 const h=harness(),stored={...eq('trailer','other'),user_id:'owner',notes:'Calcium',registration:'ABC'},task={id:'inspection',leisure_equipment_id:'trailer',title:'Mes roulements',status:'todo'},writes=[];
 h.ctx.supabaseClient.from=table=>({filters:{},patch:null,update(patch){this.patch=patch;return this},select(){return this},eq(k,v){this.filters[k]=v;return this},async maybeSingle(){
  const matches=Object.entries(this.filters).every(([k,v])=>stored[k]===v);
  if(this.patch&&matches){writes.push({table,patch:this.patch,filters:this.filters});Object.assign(stored,this.patch);}
  return {error:null,data:matches?{id:stored.id,equipment_type:stored.equipment_type}:null};
 }});
 h.render([{...stored}],[task]);await h.click('classify-trailer','trailer');
 assert.equal(stored.id,'trailer');assert.equal(stored.equipment_type,'utility_trailer');assert.equal(stored.notes,'Calcium');assert.equal(stored.registration,'ABC');
 assert.equal(writes.length,1);assert.equal(writes[0].table,'leisure_equipment');assert.deepEqual(Object.keys(writes[0].patch),['equipment_type']);assert.equal(writes[0].filters.user_id,'owner');assert.equal(writes[0].filters.equipment_type,'other');
 assert.match(h.nodes.hpLeisureList.innerHTML,/utility-trailer.webp/);assert.match(h.nodes.hpLeisureList.innerHTML,/Mes roulements/);assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/Classer comme remorque/);
 await h.ctx.hpClassifyLeisureTrailer('trailer','owner');assert.equal(writes.length,1);
 assert.equal(task.status,'todo');assert.equal(task.leisure_equipment_id,'trailer');
});
test('reclassification rejects account changes and denied writes without changing displayed equipment',async()=>{
 const h=harness();h.data(async()=>({data:[],error:null}));await h.ctx.hpLoadLeisure();let queries=0;h.ctx.supabaseClient.from=()=>{queries++;return {update(){return this},eq(){return this},select(){return this},maybeSingle:async()=>({error:{message:'denied'},data:null})}};
 await assert.rejects(h.ctx.hpClassifyLeisureTrailer('trailer','another-user'),/Session expirée/);assert.equal(queries,0);
 h.render([eq('trailer','other')]);await h.click('classify-trailer','trailer');assert.match(h.nodes.hpLeisureList.innerHTML,/Classer comme remorque/);assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/utility-trailer.webp/);assert.equal(queries,1);
});

test('visible edit and delete controls open the correct record and confirmed changes update only its card',async()=>{
 const h=harness(),opened=[],removed=[];h.ctx.hpLeisureEditor={reset(){},open:(...args)=>opened.push(args),remove:(...args)=>removed.push(args)};
 h.render([eq('boat','boat'),eq('rv','rv')],[{id:'t1',leisure_equipment_id:'boat',title:'Bateau',status:'done'},{id:'t2',leisure_equipment_id:'rv',title:'Toit',status:'todo'}]);
 const first=h.nodes.hpLeisureList.innerHTML.split('<article')[1];assert.ok(first.indexOf('data-leisure-action="edit-equipment"')<first.indexOf('<details'));assert.equal((first.match(/data-leisure-action="delete-equipment"/g)||[]).length,1);
 await h.click('edit-equipment','boat');await h.click('delete-equipment','boat');assert.equal(opened[0][0].id,'boat');assert.equal(opened[0][1],'owner');assert.equal(removed[0][0].id,'boat');assert.equal(removed[0][1],'owner');assert.equal(removed[0][2],1);
 h.ctx.hpLeisureGallery.updated({...eq('boat','utility_trailer'),name:'Ma remorque'},'owner');assert.match(h.nodes.hpLeisureList.innerHTML,/utility-trailer.webp/);assert.match(h.nodes.hpLeisureList.innerHTML,/Ma remorque/);assert.match(h.nodes.hpLeisureList.innerHTML,/data-leisure-task="t1"/);
 h.ctx.hpLeisureGallery.deleted('boat','wrong-owner');assert.match(h.nodes.hpLeisureList.innerHTML,/Ma remorque/);
 h.ctx.hpLeisureGallery.deleted('boat','owner');assert.doesNotMatch(h.nodes.hpLeisureList.innerHTML,/Ma remorque|data-leisure-task="t1"/);assert.match(h.nodes.hpLeisureList.innerHTML,/Mon rv/);assert.match(h.nodes.hpLeisureList.innerHTML,/data-leisure-task="t2"/);
});
