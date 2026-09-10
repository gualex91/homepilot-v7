import {test} from 'node:test';
import assert from 'node:assert/strict';
import professionals from '../api/professionals.js';
import leisure from '../api/leisure-professionals.js';
import '../professional-presentation.js';

const P=globalThis.hpProfessionalPresentation;
const response=()=>({status(n){this.code=n;return this},setHeader(){},json(data){this.data=data;return this}});
test('both directory APIs pass location before the database result limit and reject excluded responses',async()=>{
 const original=globalThis.fetch;
 try{
  for(const [handler,rpc] of [[professionals,'search_directory_professionals'],[leisure,'search_directory_leisure']]){
   let requested;
   const row={id:'good',business_name:'Atelier',active:true,directory_issues:[],phone:'4182346789',regions:['Saguenay--Lac-Saint-Jean'],region:'Saguenay--Lac-Saint-Jean'};
   globalThis.fetch=async url=>{requested=new URL(url);return Response.json([row,{...row,id:'hidden',active:false},{...row,id:'numbered',directory_issues:['numbered_company']},{...row,id:'unreviewed',directory_issues:undefined}])};
   const res=response();await handler({method:'GET',headers:{authorization:'Bearer fixture'},query:{city:'Jonquière',category:'hvac',service:'hvac'}},res);
   assert.equal(res.code,200);assert.deepEqual(res.data.rows.map(x=>x.id),['good']);
   assert.ok(requested.pathname.endsWith('/rpc/'+rpc));assert.equal(requested.searchParams.get('p_city'),'Jonquière');assert.equal(requested.searchParams.get('directory_issues'),'eq.{}');
  }
 }finally{globalThis.fetch=original}
});
test('a stored verified flag is not presented as a checked licence or a quality endorsement',()=>{
 assert.equal(P.evidence({verified:true,verification_status:'verified'}),'');
 const html=P.card({business_name:'Atelier',source:'rbq_open_data',rbq_license:'1234-5678-90',imported_at:'2026-09-09T12:00:00Z',phone:'418 234 6789 poste 12',verified:true});
 assert.match(html,/Licence RBQ : 1234-5678-90/);assert.match(html,/2026-09-09/);assert.match(html,/Vérifier au registre RBQ/);assert.match(html,/tel:4182346789;ext=12/);
 assert.ok(!html.includes('Vérification indiquée'));assert.ok(!html.includes('licence active'));
 assert.equal(P.card({business_name:'1234-5678 Québec inc.',active:false}), '');
 assert.equal(P.card({business_name:'Atelier',directory_issues:['invalid_phone']}),'');
 assert.equal(P.issueText({directory_issues:['numbered_company','invalid_phone']}),'Compagnie à numéro · Téléphone manquant ou format invalide');
 assert.equal(P.evidence({website:'javascript:alert(1)'}),'');
});
