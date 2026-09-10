import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/professionals.js';
import {GESTI_ENERGIE_ID,directoryRegion,rankProfessionals} from '../lib/directory-priority.js';
import '../professional-presentation.js';

const G={id:GESTI_ENERGIE_ID,business_name:'Gesti Énergie',phone:'418 818-0176',active:true,directory_issues:[],category:'electrical',service_categories:['electrical'],regions:['Saguenay–Lac-Saint-Jean'],municipalities:['Saint-Ambroise'],listing_tier:'organic'};
const other={...G,id:'other',business_name:'Autre électricien',listing_tier:'sponsored'};
const query={category:'electrical',service:'electrical',city:'Jonquière',postal:'G7X1A1'};
const response=()=>({status(n){this.code=n;return this},setHeader(){},json(data){this.data=data;return this}});
async function run(q,fetcher){
 const original=globalThis.fetch,requests=[];globalThis.fetch=async(url,options)=>{requests.push({url:new URL(url),options});return fetcher(new URL(url),options)};
 try{const res=response();await handler({method:'GET',headers:{authorization:'Bearer fixture'},query:q},res);return {res,requests}}
 finally{globalThis.fetch=original}
}

test('Gesti leads electrical results for properties across Saguenay and Lac-Saint-Jean',async()=>{
 for(const city of ['Jonquière','Saint-Ambroise','Alma','Roberval','Dolbeau-Mistassini','Saint-Félicien','St-Honoré','L’Anse-Saint-Jean']){
  const {res,requests}=await run({...query,city},()=>Response.json([other,G]));
  assert.equal(res.code,200);assert.equal(res.data.rows[0].id,GESTI_ENERGIE_ID);assert.equal(res.data.rows[0].homepilot_featured,true);
  assert.equal(res.data.rows[0].phone,'418 818-0176');assert.equal(requests.length,1);
  assert.equal(requests[0].url.searchParams.get('p_region'),'Saguenay-Lac-Saint-Jean');
 }
 assert.equal(directoryRegion({city:'Saint-Bruno',postal:'G0W 2L0'}),'Saguenay-Lac-Saint-Jean');
 assert.equal(directoryRegion({city:'Saint-Bruno',postal:'J3V1A1'}),'');
 assert.equal(directoryRegion({city:'Chibougamau'}),'');
});

test('priority cannot cross property region, category or service boundaries',async()=>{
 for(const q of [{...query,region:'Capitale-Nationale',city:'Québec'},{...query,category:'plumbing',service:'plumbing'},{...query,service:'heat_pump_cleaning'}]){
  const {res,requests}=await run(q,()=>Response.json([other,G]));
  assert.equal(res.code,200);assert.ok(res.data.rows.every(p=>!p.homepilot_featured));assert.equal(requests.length,1);
 }
 const ordered=rankProfessionals([other,G],{...query,region:'Montréal'});assert.equal(ordered[0].id,'other');
 assert.equal(directoryRegion({city:'Jonquière',region:'Capitale-Nationale'}),'Capitale-Nationale');
});

test('a profile beyond the RPC limit is fetched once with the user token and quality gates',async()=>{
 const ordinary=Array.from({length:120},(_,i)=>({...other,id:'ordinary-'+i}));
 const {res,requests}=await run(query,url=>Response.json(url.pathname.includes('/rpc/')?ordinary:[G]));
 assert.equal(res.data.rows.length,120);assert.equal(res.data.rows[0].id,GESTI_ENERGIE_ID);assert.equal(requests.length,2);
 const lookup=requests[1];assert.equal(lookup.url.pathname,'/rest/v1/professional_profiles');assert.equal(lookup.url.searchParams.get('id'),'eq.'+GESTI_ENERGIE_ID);
 assert.equal(lookup.url.searchParams.get('active'),'eq.true');assert.equal(lookup.url.searchParams.get('directory_issues'),'eq.{}');
 assert.equal(lookup.url.searchParams.get('category'),'eq.electrical');assert.equal(lookup.url.searchParams.get('service_categories'),'cs.{electrical}');
 assert.equal(lookup.options.headers.Authorization,'Bearer fixture');
});

test('priority never revives a disabled, unqualified or out-of-region profile; lookup failures keep ordinary results',async()=>{
 for(const candidate of [{...G,active:false},{...G,directory_issues:['invalid_phone']},{...G,category:'plumbing'},{...G,service_categories:[]},{...G,regions:['Montréal'],municipalities:['Montréal']},{...G,id:'lookalike'}]){
  const {res}=await run(query,url=>Response.json(url.pathname.includes('/rpc/')?[other]:[candidate]));
  assert.deepEqual(res.data.rows.map(p=>p.id),['other']);
 }
 const {res}=await run(query,url=>{if(!url.pathname.includes('/rpc/'))throw Error('network');return Response.json([other])});
 assert.equal(res.code,200);assert.equal(res.data.rows[0].id,'other');
 const denied=await run(query,()=>Response.json({message:'Expired token'},{status:401}));assert.equal(denied.res.code,401);assert.equal(denied.requests.length,1);
});

test('placement is disclosed without inventing sponsorship, and alphabetical sorting remains available',()=>{
 const P=globalThis.hpProfessionalPresentation,featured={...G,homepilot_featured:true};
 const card=P.card(featured);assert.match(card,/Mis en avant par Nuvabri/);assert.match(card,/Fiche non commanditée/);
 assert.doesNotMatch(card,/Partenaire commercial|Publicité · Commandité|licence active/);
 assert.match(P.disclosure,/mises en avant choisies par Nuvabri/);
 assert.deepEqual(P.sortRows([featured,{...other,business_name:'Alpha'}],'alphabetical').map(p=>p.business_name),['Alpha','Gesti Énergie']);
});
