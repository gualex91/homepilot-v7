import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function harness(){
 const events={},intervals=[],actions=[],nodes={};let authCallback,fetchRows;
 function node(id){return nodes[id]||= {id,innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector(){return {textContent:''}},querySelectorAll:()=>[],insertAdjacentHTML(_where,html){this.innerHTML=html+this.innerHTML},focus(){actions.push(['focus',id])}};}
 ['leisure','hpLeisureList','hpLeisureForm','hpLeisureName','hpLeisureTaskModal'].forEach(node);
 const ctx={console,Date,Promise,setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},
  document:{readyState:'complete',getElementById:id=>nodes[id],addEventListener:(name,fn)=>{(events[name]||=[]).push(fn)}},
  hpMaintenanceBudget:{button:(t,name)=>'<button data-budget-task="'+t.id+'">Prévoir au budget</button>'},
  HomePilotVrShop:{renderForEquipment:type=>['rv','boat'].includes(type)?'<details class="hpVrSuggestions"><summary>Articles '+type+'</summary></details>':''},
  supabaseClient:{auth:{getUser:async()=>({data:{user:{id:'owner'}}}),onAuthStateChange:fn=>{authCallback=fn}},from:table=>({select(){return this},eq(){return this},order(){return fetchRows(table)}})}
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('leisure-tasks.js'),ctx);vm.runInContext(read('leisure-gallery.js'),ctx);
 for(const name of ['hpAddLeisureTask','hpFindLeisurePro','hpShowLeisureDiy','hpToggleLeisureTask','hpDeleteLeisureTask','hpDeleteLeisure'])ctx[name]=(...args)=>actions.push([name,...args]);
 ctx.hpLoadLeisure=()=>{};intervals.at(-1)();
 return {ctx,actions,nodes,node,auth:(event,session)=>authCallback(event,session),data:fn=>fetchRows=fn,
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
