import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../leisure-budget.js',import.meta.url),'utf8');
function harness(){
 const rows=new Map(),requests=[],nodes={},storage=new Map();let fail=false,user='owner',loads=0,delay=null;
 for(const [id,value] of Object.entries({hpLeisureName:'Remorque',hpLeisureType:'utility_trailer',hpLeisureBrand:'Marque',hpLeisureModel:'',hpLeisureYear:'2024',hpLeisureRegistration:'',hpLeisureNotes:''}))nodes[id]={value,disabled:false};
 nodes.hpLeisureSave={disabled:false,textContent:'Ajouter'};nodes.hpLeisureSaveStatus={textContent:''};nodes.hpLeisureForm={hidden:false,classList:{add(){nodes.hpLeisureForm.hidden=true}},querySelectorAll:()=>Object.values(nodes).filter(x=>'value' in x)};
 const client={auth:{getUser:async()=>({data:{user:{id:user}}})},from(table){
  const q={select(){return this},eq(){return this},limit(){return this},maybeSingle:async()=>({data:{household_id:'house'}})};
  if(table==='household_members')return q;
  function write(payload){requests.push({...payload});return {select:()=>run(),then:(yes,no)=>run().then(yes,no)}}
  async function run(){if(delay)await delay;const payload=requests.at(-1);let inserted=false;if(!payload.id||!rows.has(payload.id)){rows.set(payload.id||webcrypto.randomUUID(),{...payload});inserted=true;}if(fail)return {data:null,error:{message:'Connection interrupted'}};return {data:inserted?[payload]:[],error:null};}
  return {insert:write,upsert:write,select(){return {eq(key,value){const filters={[key]:value};return {eq(k,v){filters[k]=v;return this},maybeSingle:async()=>({data:[...rows.values()].find(row=>Object.entries(filters).every(([k,v])=>row[k]===v))||null})}}}}};
 }};
 const ctx={console,crypto:webcrypto,URL,URLSearchParams,window:null,document:{readyState:'loading',getElementById:id=>nodes[id],addEventListener(){}},supabaseClient:client,alert:s=>nodes.hpLeisureSaveStatus.textContent=s,
 sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('../stability-core.js',import.meta.url),'utf8'),ctx);
 vm.runInContext(source.replace('function init(){','window.testSaveLeisure=saveLeisure;function init(){'),ctx);ctx.hpLoadLeisure=async()=>{loads++};
 return {ctx,nodes,rows,requests,save:()=>ctx.testSaveLeisure(),fail:v=>fail=v,delay:v=>delay=v,user:v=>user=v,loads:()=>loads};
}
test('double click on leisure creation creates one record and waits for confirmation',async()=>{
 const h=harness();await Promise.all([h.save(),h.save()]);assert.equal(h.requests.length,1);assert.equal(h.rows.size,1);assert.equal(h.nodes.hpLeisureForm.hidden,true);assert.equal(h.nodes.hpLeisureSave.disabled,false);
});
test('retry after an uncertain insert retrieves the same record instead of inserting a duplicate',async()=>{
 const h=harness();h.fail(true);await h.save();assert.equal(h.rows.size,1);assert.equal(h.nodes.hpLeisureForm.hidden,false);assert.equal(h.nodes.hpLeisureName.value,'Remorque');
 h.fail(false);await h.save();assert.equal(h.rows.size,1);assert.equal(h.requests[0].id,h.requests[1].id);assert.equal(h.nodes.hpLeisureName.value,'');assert.equal(h.loads(),1);
});
test('invalid year or missing name does not write a leisure record',async()=>{
 const h=harness();h.nodes.hpLeisureYear.value='1800';await h.save();assert.equal(h.rows.size,0);h.nodes.hpLeisureYear.value='2024';h.nodes.hpLeisureName.value='';await h.save();assert.equal(h.rows.size,0);
});
