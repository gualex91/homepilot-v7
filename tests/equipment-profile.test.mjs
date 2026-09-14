import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function harness(){
 const nodes=new Map(),callbacks=[],alerts=[],writes=[];let held=null,lost=false,failed=false,user={id:'owner'},renders=0;
 const base={id:'eq-a',property_id:'property-a',equipment_type:'detecteur',name:'Détecteur TEST',details:{retained:'yes'},updated_at:'2026-09-14T00:00:00.000Z'};
 const database=[{...base,details:{...base.details}},{...base,id:'eq-b',name:'Autre TEST',details:{retained:'b'}}];
 class Node{
  constructor(){this.value='';this.attrs={};this.hidden=true;this.classList={add:()=>this.hidden=true,remove:()=>this.hidden=false};this.style={};this.dataset={};}
  set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
  set innerHTML(v){this.html=v;for(const match of v.matchAll(/<(input|select|textarea|button|p|div)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const n=new Node();n.id=match[3];n.tag=match[1];for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))n.attrs[a[1]]=a[2]??true;n.value=n.attrs.value||'';}}
  get innerHTML(){return this.html||''}
  querySelectorAll(){return this.id==='hpEqForm'?[...nodes.values()].filter(x=>['input','select','textarea'].includes(x.tag)):[]}
  focus(){this.focused=true}reportValidity(){this.reported=true}
  checkValidity(){if(this.attrs.type==='date'&&this.value)return /^\d{4}-\d{2}-\d{2}$/.test(this.value)&&new Date(this.value+'T12:00:00Z').toISOString().slice(0,10)===this.value;return true}
 }
 const client={auth:{getUser:async()=>({data:{user}}),onAuthStateChange:fn=>callbacks.push(fn)},from(table){assert.equal(table,'equipment');const filters=[];let patch;const q={update(v){patch=v;return q},eq(k,v){filters.push([k,v]);return q},select(){return q},then(resolve,reject){return (async()=>{writes.push({patch,filters});if(held)await held;if(failed){failed=false;throw Error('Network')};const found=database.find(x=>filters.every(([k,v])=>x[k]===v));if(found)Object.assign(found,patch);if(lost){lost=false;throw Error('Lost after commit')};return{data:found?[{...found}]:[],error:null}})().then(resolve,reject)}};return q;}};
 const ctx={console,Date,URL,hpStability:null,supabaseClient:client,eq:database.map(x=>({...x,details:{...x.details}})),alert:x=>alerts.push(x),render:()=>renders++,document:{readyState:'complete',getElementById:id=>nodes.get(id),querySelector:()=>null,createElement:()=>new Node(),body:{appendChild(){}},addEventListener(){}},MutationObserver:class{observe(){}},setInterval(){}};ctx.window=ctx;vm.createContext(ctx);for(const f of ['stability-core.js','equipment-profile.js'])vm.runInContext(source(f),ctx);
 const values={heName:'Détecteur nouveau',heBrand:'Marque',heModel:'Modèle',heSerial:'ABC-123',heInstalled:'2025-02-28',heInstaller:'Installateur',heWarranty:'2028-02-29',heMaintenance:'2026-09-14',heManual:'https://example.com/manual',heInvoice:'https://example.com/invoice',heNotes:'Notes TEST',heBattery:'9 V',heBatteryRef:'522',heBatteryLink:'https://example.com/battery'};
 return{ctx,nodes,alerts,writes,database,values,fill(){for(const[k,v]of Object.entries(values))nodes.get(k).value=v},hold(p){held=p},lose(){lost=true},fail(){failed=true},tick:()=>new Promise(setImmediate),auth(id){user=id?{id}:null;callbacks.forEach(fn=>fn(id?'SIGNED_IN':'SIGNED_OUT',user?{user}:null))},renders:()=>renders};
}
test('equipment: all detector fields persist together and unknown details remain',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();await h.ctx.hpSaveEq('eq-a');const p=h.writes[0].patch;
 assert.equal(p.name,h.values.heName);for(const [field,key] of [['heBrand','brand'],['heModel','model'],['heSerial','serial_number'],['heInstalled','installation_date'],['heInstaller','installer'],['heWarranty','warranty_expiry'],['heMaintenance','last_maintenance'],['heManual','manual_url'],['heInvoice','invoice_url'],['heNotes','notes'],['heBattery','battery_type'],['heBatteryRef','battery_reference'],['heBatteryLink','battery_purchase_url']])assert.equal(p.details[key],h.values[field],field);
 assert.equal(p.details.retained,'yes');assert.equal(p.installed_at,p.details.installation_date);assert.equal(h.ctx.eq[0].name,h.values.heName);assert.equal(h.renders(),1);assert.match(h.alerts[0],/enregistrée/);
});
test('equipment: unsafe links and invalid dates do not save',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();
 for(const id of ['heManual','heInvoice','heBatteryLink']){h.fill();h.nodes.get(id).value='javascript:alert(1)';await h.ctx.hpSaveEq('eq-a');assert.equal(h.writes.length,0,id)}
 for(const id of ['heInstalled','heWarranty','heMaintenance']){h.fill();h.nodes.get(id).value='2026-02-30';await h.ctx.hpSaveEq('eq-a');assert.equal(h.writes.length,0,id);assert.equal(h.nodes.get(id).reported,true)}
});
test('equipment: a concurrent edit cannot be overwritten',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();h.database[0].updated_at='2026-09-15T00:00:00.000Z';h.database[0].name='Other session';await h.ctx.hpSaveEq('eq-a');assert.equal(h.database[0].name,'Other session');assert.equal(h.nodes.get('heName').value,h.values.heName);assert.match(h.nodes.get('hpEqFormError').textContent,/fiche a changé/);assert.equal(h.alerts.length,0);
});
test('equipment: double click and lost confirmation never report unconfirmed success',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();let release;h.hold(new Promise(r=>release=r));h.lose();const first=h.ctx.hpSaveEq('eq-a');await h.tick();await h.ctx.hpSaveEq('eq-a');assert.equal(h.writes.length,1);release();await first;
 assert.match(h.nodes.get('hpEqFormError').textContent,/Confirmation non reçue/);assert.equal(h.alerts.length,0);assert.equal(h.nodes.get('heName').value,h.values.heName);h.hold(null);await h.ctx.hpSaveEq('eq-a');assert.match(h.nodes.get('hpEqFormError').textContent,/déjà été enregistrée/);assert.equal(h.alerts.length,0);
});
test('equipment: a late save does not close or change a newly opened form',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();let release;h.hold(new Promise(r=>release=r));const first=h.ctx.hpSaveEq('eq-a');await h.tick();await h.ctx.hpOpenEq('eq-b');h.nodes.get('heName').value='B draft';release();await first;assert.equal(h.nodes.get('heName').value,'B draft');assert.equal(h.nodes.get('hpEqModal').hidden,false);assert.equal(h.alerts.length,0);assert.equal(h.renders(),0);
});
test('equipment: logout clears the form and ignores a late confirmation',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();let release;h.hold(new Promise(r=>release=r));const first=h.ctx.hpSaveEq('eq-a');await h.tick();h.auth(null);release();await first;assert.equal(h.nodes.get('hpEqModal').hidden,true);assert.equal(h.nodes.get('hpEqForm').innerHTML,'');assert.equal(h.alerts.length,0);assert.equal(h.renders(),0);
});
test('equipment: a changed account cannot submit an old draft',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();h.auth('other');await h.ctx.hpSaveEq('eq-a');assert.equal(h.writes.length,0);assert.equal(h.nodes.get('hpEqForm').innerHTML,'');
});
test('equipment: changed property and missing version fail closed',async()=>{
 const h=harness();await h.ctx.hpOpenEq('eq-a');h.fill();h.ctx.eq=[];await h.ctx.hpSaveEq('eq-a');assert.equal(h.writes.length,0);assert.match(h.nodes.get('hpEqFormError').textContent,/propriété affichée a changé/);
 const b=harness();b.ctx.eq[0].updated_at=null;await b.ctx.hpOpenEq('eq-a');b.fill();await b.ctx.hpSaveEq('eq-a');assert.equal(b.writes.length,0);assert.match(b.nodes.get('hpEqFormError').textContent,/Recharge/);
});
