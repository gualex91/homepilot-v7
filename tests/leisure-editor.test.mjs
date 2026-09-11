import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../leisure-editor.js',import.meta.url),'utf8');
const decode=s=>String(s||'').replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
function harness(){
 const nodes=new Map(),calls=[],applied=[],deleted=[];
 let user='owner',fail=false,deny=false,delay=null,loads=0;
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.listeners={};this.value='';this.disabled=false;this.open=false;this.textContent='';this.children=[];}
  set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
  setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn}focus(){}
  showModal(){this.open=true}close(){this.open=false;this.listeners.close?.()}
  querySelectorAll(){return this.children.filter(n=>['INPUT','SELECT','TEXTAREA','BUTTON'].includes(n.tagName))}
  set innerHTML(html){this.html=html;this.children=[];
   for(const m of html.matchAll(/<(input|select|textarea|button|form|h2|p)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const n=new Node(m[1]);n.id=m[3];n.value=decode(m[2].match(/\bvalue="([^"]*)"/)?.[1]||'');
    const tail=html.slice(m.index+m[0].length).split('</'+m[1]+'>')[0];
    if(m[1]==='textarea')n.value=decode(tail);
    if(m[1]==='select'){const opts=[...tail.matchAll(/<option value="([^"]*)"([^>]*)>/g)];n.value=decode((opts.find(x=>/selected/.test(x[2]))||opts[0])?.[1]||'');}
    this.children.push(n);
   }
  }get innerHTML(){return this.html||''}
 }
 const rows=new Map([['boat',{id:'boat',user_id:'owner',equipment_type:'boat',name:'Bateau d’Alex "<test>"',brand:'Princecraft',model:'Vacanza',year:2004,registration:'ABC',notes:'Mes notes',insurance_renewal_date:'2027-06-01'}],['other',{id:'other',user_id:'other-owner',equipment_type:'rv',name:'Privé'}]]);
 const tasks=[{id:'t1',leisure_equipment_id:'boat',status:'done'},{id:'t2',leisure_equipment_id:'other',status:'todo'}];
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},from:table=>{
  const q={filters:{},method:'select',patch:null,update(p){this.method='update';this.patch=p;return this},delete(){this.method='delete';return this},select(){return this},eq(k,v){this.filters[k]=v;return this},maybeSingle(){return this.run(true)},then(ok,bad){return this.run(false).then(ok,bad)},async run(single){
   if(delay)await delay;
   calls.push({table,method:this.method,patch:this.patch,filters:{...this.filters}});
   if(fail&&this.method!=='select')return {data:null,error:{message:'unavailable'}};
   let result=[...rows.values()].filter(row=>Object.entries(this.filters).every(([k,v])=>row[k]===v));
   if(deny&&this.method!=='select')result=[];
   else if(this.method==='update')result=result.map(row=>{Object.assign(row,this.patch);return {...row}});
   else if(this.method==='delete')for(const row of result){rows.delete(row.id);for(let i=tasks.length-1;i>=0;i--)if(tasks[i].leisure_equipment_id===row.id)tasks.splice(i,1);}
   return {data:single?result[0]||null:result,error:null};
  }};return q;
 }};
 const document={getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),body:{appendChild(){}}};
 const ctx={document,console,supabaseClient:client,hpLeisureGallery:{updated:(...args)=>applied.push(args),deleted:(...args)=>deleted.push(args)},hpLoadLeisure:()=>loads++,alert(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 const get=id=>nodes.get(id),open=(mode='edit')=>mode==='delete'?ctx.hpLeisureEditor.remove({...rows.get('boat')},'owner',1):ctx.hpLeisureEditor.open({...rows.get('boat')},'owner');
 return {ctx,rows,tasks,calls,applied,deleted,get,open,setUser:v=>user=v,fail:v=>fail=v,deny:v=>deny=v,delay:v=>delay=v,loads:()=>loads,submit:()=>get('hpLeisureEditorForm').onsubmit({preventDefault(){}})};
}
test('editing prefills the saved fields and changes the same record without touching tasks or renewal fields',async()=>{
 const h=harness();h.open();assert.equal(h.get('hpLeisureEditName').value,h.rows.get('boat').name);assert.equal(h.get('hpLeisureEditYear').value,'2004');assert.equal(h.get('hpLeisureEditNotes').value,'Mes notes');
 assert.match(h.get('hpLeisureEditor').innerHTML,/&quot;&lt;test&gt;&quot;/);
 h.get('hpLeisureEditName').value='Nouveau nom';h.get('hpLeisureEditType').value='utility_trailer';h.get('hpLeisureEditYear').value='';await h.submit();
 assert.equal(h.rows.size,2);assert.equal(h.rows.get('boat').id,'boat');assert.equal(h.rows.get('boat').year,null);assert.equal(h.rows.get('boat').equipment_type,'utility_trailer');assert.equal(h.rows.get('boat').insurance_renewal_date,'2027-06-01');
 assert.equal(h.tasks[0].id,'t1');assert.equal(h.tasks[0].status,'done');assert.equal(h.tasks.length,2);
 assert.deepEqual(Object.keys(h.calls[0].patch).sort(),['equipment_type','name','year']);assert.equal(h.calls[0].filters.user_id,'owner');assert.equal(h.calls[0].filters.id,'boat');assert.equal(h.calls[0].table,'leisure_equipment');
 assert.equal(h.get('hpLeisureEditor').open,false);assert.equal(h.applied.length,1);assert.equal(h.loads(),1);
});
test('cancel and invalid fields do not write data',async()=>{
 const h=harness();h.open();h.get('hpLeisureEditName').value='Annulé';h.get('hpLeisureEditorCancel').onclick();assert.equal(h.calls.length,0);assert.notEqual(h.rows.get('boat').name,'Annulé');
 h.open();h.get('hpLeisureEditName').value='  ';await h.submit();assert.equal(h.calls.length,0);assert.match(h.get('hpLeisureEditorStatus').textContent,/nom/);assert.equal(h.get('hpLeisureEditor').open,true);
 h.get('hpLeisureEditName').value='Bateau';h.get('hpLeisureEditYear').value='1800';await h.submit();assert.equal(h.calls.length,0);assert.match(h.get('hpLeisureEditorStatus').textContent,/année/);
});
test('failed saves retain the draft and retry updates once without creating another record',async()=>{
 const h=harness();h.open();h.get('hpLeisureEditModel').value='Modifié';h.fail(true);await h.submit();
 assert.equal(h.get('hpLeisureEditor').open,true);assert.equal(h.get('hpLeisureEditModel').value,'Modifié');assert.equal(h.rows.get('boat').model,'Vacanza');assert.equal(h.applied.length,0);assert.equal(h.get('hpLeisureEditorSave').disabled,false);
 h.fail(false);await h.submit();assert.equal(h.rows.get('boat').model,'Modifié');assert.equal(h.rows.size,2);assert.ok(h.calls.every(c=>c.method==='update'));assert.equal(h.applied.length,1);
});
test('delete requires confirmation, names its scope, and removes only the selected equipment and its tasks',async()=>{
 const h=harness();h.open('delete');assert.equal(h.calls.length,0);assert.match(h.get('hpLeisureEditor').innerHTML,/1 tâche associée/);assert.match(h.get('hpLeisureEditor').innerHTML,/définitivement/);
 h.get('hpLeisureEditorCancel').onclick();assert.equal(h.calls.length,0);assert.equal(h.rows.size,2);
 h.open('delete');await h.submit();assert.equal(h.rows.has('boat'),false);assert.equal(h.rows.has('other'),true);assert.equal(h.tasks.length,1);assert.equal(h.tasks[0].id,'t2');
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].table,'leisure_equipment');assert.equal(h.calls[0].method,'delete');assert.equal(h.calls[0].filters.id,'boat');assert.equal(h.calls[0].filters.user_id,'owner');assert.equal(h.deleted.length,1);
});
test('denied deletion remains visible; a retry after an already completed deletion succeeds',async()=>{
 const h=harness();h.open('delete');h.deny(true);await h.submit();assert.equal(h.rows.has('boat'),true);assert.equal(h.deleted.length,0);assert.equal(h.get('hpLeisureEditor').open,true);assert.match(h.get('hpLeisureEditorStatus').textContent,/pas été supprimée/);
 h.deny(false);h.rows.delete('boat');await h.submit();assert.equal(h.deleted.length,1);assert.equal(h.get('hpLeisureEditor').open,false);
});
test('account changes cannot save or delete a previous user’s record',async()=>{
 const h=harness();h.open();h.get('hpLeisureEditName').value='Refusé';h.setUser('other-owner');await h.submit();assert.equal(h.calls.length,0);assert.equal(h.applied.length,0);assert.match(h.get('hpLeisureEditorStatus').textContent,/Session expirée/);
 h.get('hpLeisureEditorCancel').onclick();h.open('delete');await h.submit();assert.equal(h.calls.length,0);assert.equal(h.deleted.length,0);
});
test('double submission sends one write; reset erases the dialog and ignores a late response',async()=>{
 const h=harness();let release;h.delay(new Promise(r=>release=r));h.open();h.get('hpLeisureEditName').value='En cours';
 const save=h.submit();await h.submit();assert.equal(h.get('hpLeisureEditorSave').disabled,true);
 h.ctx.hpLeisureEditor.reset();assert.equal(h.get('hpLeisureEditor').innerHTML,'');release();await save;
 assert.equal(h.calls.length,1);assert.equal(h.applied.length,0);assert.equal(h.loads(),0);assert.equal(h.get('hpLeisureEditor').open,false);
});
