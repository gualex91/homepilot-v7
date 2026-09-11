/* Edit an existing leisure record in place; deletion uses the database's task cascade. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const TYPES=[['snowmobile','Motoneige'],['atv','VTT'],['side_by_side','Côte-à-côte'],['boat','Bateau'],['personal_watercraft','Motomarine'],['rv','VR / motorisé'],['travel_trailer','Roulotte'],['motorcycle','Moto'],['utility_trailer','Remorque'],['other','Autre']];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let current=null,version=0,dialog=null;
 function clean(values){
  const name=String(values.name||'').trim(),type=String(values.equipment_type||'');
  if(!name)throw new Error('Donne un nom à cet équipement.');
  if(!TYPES.some(([key])=>key===type))throw new Error('Choisis un type de loisir.');
  const year=values.year===''||values.year==null?null:Number(values.year);
  if(year!==null&&(!Number.isInteger(year)||year<1900||year>2100))throw new Error('L’année doit être comprise entre 1900 et 2100.');
  const optional=key=>String(values[key]??'').trim()||null;
  return {equipment_type:type,name,brand:optional('brand'),model:optional('model'),year,registration:optional('registration'),notes:optional('notes')};
 }
 async function identity(expectedOwner){
  const client=window.supabaseClient;if(!client||!expectedOwner)throw new Error('Session expirée. Reconnecte-toi.');
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user||data.user.id!==expectedOwner)throw new Error('Session expirée. Reconnecte-toi.');
  return {client,user:data.user};
 }
 async function update(original,values,expectedOwner){
  const fields=clean(values),{client,user}=await identity(expectedOwner);
  const patch=Object.fromEntries(Object.entries(fields).filter(([key,value])=>(original[key]??null)!==value));
  if(!Object.keys(patch).length)return {...original};
  const {data,error}=await client.from('leisure_equipment').update(patch).eq('id',original.id).eq('user_id',user.id).select('*').maybeSingle();
  if(error)throw new Error('Enregistrement non confirmé. Tes modifications sont encore dans le formulaire; réessaie.');
  if(!data||data.id!==original.id||data.user_id!==user.id)throw new Error('Cette fiche n’est plus disponible. Actualise tes loisirs.');
  return data;
 }
 async function destroy(id,expectedOwner){
  const {client,user}=await identity(expectedOwner);
  const {data,error}=await client.from('leisure_equipment').delete().eq('id',id).eq('user_id',user.id).select('id');
  if(error)throw new Error('La suppression n’a pas été confirmée. Réessaie.');
  if(!Array.isArray(data))throw new Error('La suppression n’a pas été confirmée. Réessaie.');
  if(!data.some(row=>row.id===id)){
   const check=await client.from('leisure_equipment').select('id').eq('id',id).eq('user_id',user.id).maybeSingle();
   if(check.error||check.data)throw new Error('La fiche n’a pas été supprimée. Réessaie.');
  }
  return id;
 }
 function reset(){version++;current=null;if(dialog){if(dialog.open)dialog.close();dialog.innerHTML='';}}
 function ensure(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='hpLeisureEditor';dialog.setAttribute('aria-labelledby','hpLeisureEditorTitle');
  dialog.addEventListener('cancel',e=>{if(current?.busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{current=null;version++;});
  document.body.appendChild(dialog);return dialog;
 }
 function busy(value){
  if(current)current.busy=value;
  for(const el of dialog.querySelectorAll('input,select,textarea,button'))el.disabled=value;
  $('hpLeisureEditorSave').textContent=value?(current?.mode==='delete'?'Suppression…':'Enregistrement…'):(current?.mode==='delete'?'Supprimer définitivement':'Enregistrer');
 }
 function field(id,label,value,extra=''){return `<label for="${id}">${label}</label><input id="${id}" value="${esc(value??'')}" ${extra}>`;}
 function open(record,expectedOwner,mode='edit',taskCount){
  if(!record?.id||!expectedOwner||current?.busy)return;
  const d=ensure();current={record:{...record},owner:expectedOwner,mode,busy:false};version++;const initialVersion=version;
  const heading=mode==='delete'?'Supprimer ce loisir?':'Modifier la fiche';
  const known=TYPES.some(([key])=>key===record.equipment_type),options=(known?TYPES:[[record.equipment_type||'other','Type actuel'],...TYPES]);
  d.innerHTML=`<form id="hpLeisureEditorForm"><div class="hp-leisure-editor-heading"><h2 id="hpLeisureEditorTitle">${heading}</h2><button type="button" class="alt" id="hpLeisureEditorClose" aria-label="Fermer">Fermer</button></div>${mode==='delete'?`<p class="hp-leisure-delete-explanation">La fiche <strong>${esc(record.name||'de cet équipement')}</strong> et ${Number.isInteger(taskCount)?taskCount+' tâche'+(taskCount===1?'':'s')+' associée'+(taskCount===1?'':'s'):'ses tâches associées'} seront supprimées définitivement.</p><p>Cette action ne peut pas être annulée.</p>`:`<p class="hp-leisure-editor-intro">Tes tâches et leur historique sont conservés.</p><label for="hpLeisureEditType">Type</label><select id="hpLeisureEditType">${options.map(([key,label])=>`<option value="${esc(key)}" ${key===record.equipment_type?'selected':''}>${label}</option>`).join('')}</select>${field('hpLeisureEditName','Nom',record.name,'required autocomplete="off"')}<div class="hp-leisure-editor-grid"><div>${field('hpLeisureEditBrand','Marque',record.brand)}</div><div>${field('hpLeisureEditModel','Modèle',record.model)}</div><div>${field('hpLeisureEditYear','Année',record.year,'type="number" min="1900" max="2100" step="1" inputmode="numeric"')}</div><div>${field('hpLeisureEditRegistration','Immatriculation (facultatif)',record.registration,'autocapitalize="characters"')}</div></div><label for="hpLeisureEditNotes">Notes (facultatif)</label><textarea id="hpLeisureEditNotes" rows="4">${esc(record.notes||'')}</textarea>`}<p id="hpLeisureEditorStatus" role="status" aria-live="polite"></p><div class="hp-leisure-editor-actions"><button type="button" class="alt" id="hpLeisureEditorCancel">Annuler</button><button type="submit" id="hpLeisureEditorSave" class="${mode==='delete'?'hp-leisure-confirm-delete':''}">${mode==='delete'?'Supprimer définitivement':'Enregistrer'}</button></div></form>`;
  const close=()=>{if(!current?.busy)d.close();};$('hpLeisureEditorClose').onclick=close;$('hpLeisureEditorCancel').onclick=close;
  $('hpLeisureEditorForm').onsubmit=async e=>{
   e.preventDefault();if(!current||current.busy||version!==initialVersion)return;
   const operation=current;busy(true);$('hpLeisureEditorStatus').textContent='';
   try{
    if(mode==='delete'){
     await destroy(record.id,expectedOwner);
     if(version!==initialVersion||current!==operation)return;
     d.close();window.hpLeisureGallery?.deleted(record.id,expectedOwner);
    }else{
     const values={equipment_type:$('hpLeisureEditType').value,name:$('hpLeisureEditName').value,brand:$('hpLeisureEditBrand').value,model:$('hpLeisureEditModel').value,year:$('hpLeisureEditYear').value,registration:$('hpLeisureEditRegistration').value,notes:$('hpLeisureEditNotes').value};
     const saved=await update(operation.record,values,expectedOwner);
     if(version!==initialVersion||current!==operation)return;
     d.close();window.hpLeisureGallery?.updated(saved,expectedOwner);
    }
    window.hpLoadLeisure?.();
   }catch(error){if(version===initialVersion&&current===operation)$('hpLeisureEditorStatus').textContent=error?.message||'Cette action n’a pas pu être terminée. Réessaie.';}
   finally{if(version===initialVersion&&current===operation)busy(false);}
  };
  if(!d.open)d.showModal();
  $(mode==='delete'?'hpLeisureEditorCancel':'hpLeisureEditName')?.focus();
 }
 window.hpLeisureEditor={open,remove:(record,owner,count)=>open(record,owner,'delete',count),reset,update,destroy};
 // The older list also goes through the same named confirmation and verified deletion.
 window.hpDeleteLeisure=async id=>{
  try{
   const client=window.supabaseClient,{data:session,error}=await client.auth.getUser();if(error||!session?.user)throw new Error('Session expirée. Reconnecte-toi.');
   const row=await client.from('leisure_equipment').select('*').eq('id',id).eq('user_id',session.user.id).maybeSingle();if(row.error||!row.data)throw new Error('Cette fiche n’est plus disponible.');
   open(row.data,session.user.id,'delete');
  }catch(error){window.alert(error?.message||'Impossible de charger cette fiche.');}
 };
})();
