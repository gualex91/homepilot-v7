/* One private payment per asset. Budget and cards read the same saved record. */
(function(){
 'use strict';
 const P=hpAssetPaymentEngine,E=hpBudgetEngine,$=id=>document.getElementById(id),esc=hpStability.esc;
 const money=cents=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(cents/100);
 const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 let owner='',rows=[],ready=false,generation=0,pending=null,dialog=null,current=null,version=0;
 const assetField=kind=>kind==='property'?'property_id':'leisure_equipment_id';
 function get(kind,id){return rows.find(x=>x[assetField(kind)]===id)||null;}
 async function session(expected){
  const {data,error}=await window.supabaseClient.auth.getSession();const s=data?.session;
  if(error||!s?.user?.id||(expected&&s.user.id!==expected))throw new Error('Session expirée. Reconnecte-toi.');return s;
 }
 async function api(method,body,expected){
  const s=await session(expected);const r=await fetch('/api/asset-payments',{method,headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Paiement indisponible.');
  if(data.user_id!==s.user.id||!Array.isArray(data.payments))throw new Error('Paiement non confirmé. Réessaie.');return data;
 }
 function publish(){paint();window.dispatchEvent(new CustomEvent('hp-asset-payments-changed',{detail:{owner,payments:rows}}));}
 function accept(data){rows=data.payments;ready=true;publish();}
 function reset(){generation++;version++;owner='';rows=[];ready=false;pending=null;current=null;if(dialog){dialog.close();dialog.innerHTML='';}paint();}
 async function load(){
  const s=await session();if(owner!==s.user.id){if(owner)reset();owner=s.user.id;}
  if(pending)return pending;
  const stamp=generation,id=owner;
  const promise=(async()=>{const data=await api('GET',null,id);if(stamp===generation&&owner===id)accept(data);return data;})();
  pending=promise;
  try{return await promise}finally{if(pending===promise)pending=null;}
 }
 function summary(row){
  const totals=P.totals(row.amount,row.frequency);if(!totals)return '';
  return `<strong>${money(Math.round(Number(row.amount)*100))} ${esc(P.frequencies[row.frequency])}</strong><div class="hp-payment-totals"><span>${money(totals.monthly)}<small>/ mois en moyenne</small></span><span>${money(totals.annual)}<small>/ an estimé</small></span></div>`;
 }
 function content(kind,id){
  const row=ready?get(kind,id):null;
  return `<span class="hp-payment-eyebrow">MON PAIEMENT</span>${row?summary(row):`<p>${ready?'Aucun paiement renseigné.':'Ouvre le paiement pour le consulter ou l’ajouter.'}</p>`}<button type="button" class="alt" data-payment-open>${row?'Modifier mon paiement':'+ Ajouter / voir mon paiement'}</button>${row?'<small class="hp-payment-included">Inclus dans mes dépenses prévues.</small>':''}`;
 }
 function card(kind,record){return `<div class="hp-payment-card" data-payment-card data-payment-kind="${esc(kind)}" data-payment-id="${esc(record.id)}" data-payment-name="${esc(record.name||'Mon bien')}">${content(kind,record.id)}</div>`;}
 function paint(){for(const node of document.querySelectorAll('[data-payment-card]')){const html=content(node.dataset.paymentKind,node.dataset.paymentId);if(node.innerHTML!==html)node.innerHTML=html;}}
 function ensure(){
  if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='hpAssetPaymentDialog';dialog.className='hp-asset-dialog';dialog.setAttribute('aria-labelledby','hpPaymentTitle');
  dialog.addEventListener('cancel',e=>{if(current?.busy)e.preventDefault();});dialog.addEventListener('close',()=>{version++;current=null;});document.body.appendChild(dialog);return dialog;
 }
 function setBusy(busy){if(current)current.busy=busy;for(const el of dialog.querySelectorAll('button,input,select'))el.disabled=busy;}
 function preview(){
  const amount=$('hpPaymentAmount').value,frequency=$('hpPaymentFrequency').value;
  $('hpPaymentSecondWrap').hidden=frequency!=='semimonthly';
  const t=P.totals(amount,frequency);$('hpPaymentPreview').innerHTML=t?summary({amount,frequency}):'<p>Entre le montant de chaque paiement.</p>';
 }
 async function open(kind,record){
  if(current?.busy||!['property','leisure'].includes(kind)||!record?.id)return;
  const d=ensure();const stamp=++version;current={kind,record,busy:false};
  d.innerHTML='<h2 id="hpPaymentTitle">Mon paiement</h2><p>Chargement…</p><button type="button" id="hpPaymentCancel">Annuler</button>';$('hpPaymentCancel').onclick=()=>d.close();if(!d.open)d.showModal();
  try{
   await load();if(stamp!==version)return;
   const row=get(kind,record.id),expectedOwner=owner;current={kind,record,row,owner:expectedOwner,busy:false};
   d.innerHTML=`<form id="hpPaymentForm"><div class="hp-asset-dialog-heading"><h2 id="hpPaymentTitle">Paiement ${esc(record.name||'du bien')}</h2><button type="button" class="alt" id="hpPaymentCancel">Fermer</button></div><p>Inscris le montant que <b>tu paies</b>. Il sera inclus automatiquement dans ton budget personnel.</p><label for="hpPaymentAmount">Montant de chaque paiement ($)</label><input id="hpPaymentAmount" type="number" inputmode="decimal" min="0.01" max="100000000" step="0.01" required value="${esc(row?.amount??'')}" placeholder="Ex. 70"><label for="hpPaymentFrequency">Fréquence</label><select id="hpPaymentFrequency">${Object.entries(P.frequencies).map(([value,label])=>`<option value="${value}" ${value===(row?.frequency||'monthly')?'selected':''}>${label}</option>`).join('')}</select><label for="hpPaymentDate">Une date connue de paiement</label><input id="hpPaymentDate" type="date" min="2000-01-01" max="2099-12-31" required value="${esc(row?.anchor_date||today())}"><p class="hp-payment-note">Cette date sert à placer les versements dans le calendrier; elle ne marque pas le début du financement.</p><div id="hpPaymentSecondWrap"><label for="hpPaymentSecond">Deuxième jour du mois (31 = dernier jour)</label><input id="hpPaymentSecond" type="number" min="2" max="31" step="1" value="${esc(row?.second_day??15)}"></div><label class="hp-payment-check"><input id="hpPaymentEssential" type="checkbox" ${(row?row.essential:kind==='property')?'checked':''}> Cette dépense est essentielle pour moi.</label><div id="hpPaymentPreview" class="hp-payment-preview" aria-live="polite"></div><p class="hp-payment-note">Estimation à rythme constant : 52 semaines, 26 versements aux deux semaines ou 12 mois. Le budget du mois suit les dates prévues : il peut compter 4 ou 5 versements hebdomadaires.</p><p class="hp-payment-note">Si ce même paiement est déjà saisi manuellement dans ton budget, retire cette ancienne ligne pour ne pas le compter deux fois.</p><p id="hpPaymentStatus" role="status" aria-live="polite"></p><div class="hp-asset-dialog-actions">${row?'<button type="button" class="alt hp-asset-danger" id="hpPaymentRemove">Retirer le paiement</button>':''}<button type="submit" id="hpPaymentSave">Enregistrer dans mon budget</button></div></form>`;
   $('hpPaymentCancel').onclick=()=>{if(!current?.busy)d.close();};$('hpPaymentForm').addEventListener('input',preview);$('hpPaymentForm').addEventListener('change',preview);preview();
   async function submit(method){
    if(!current||current.busy||version!==stamp)return;
    if(method==='DELETE'&&!window.confirm('Retirer ce paiement des dépenses prévues? La fiche et les opérations déjà enregistrées seront conservées.'))return;
    const operation=current,body={kind,asset_id:record.id,expected_revision:row?.revision||null};
    if(method==='PUT')Object.assign(body,{amount:Number($('hpPaymentAmount').value),frequency:$('hpPaymentFrequency').value,anchor_date:$('hpPaymentDate').value,second_day:$('hpPaymentFrequency').value==='semimonthly'?Number($('hpPaymentSecond').value):null,essential:$('hpPaymentEssential').checked});
    const key='asset-payment:'+expectedOwner+':'+kind+':'+record.id+':'+method;body.request_id=hpStability.operation(key,body);
    setBusy(true);$('hpPaymentStatus').textContent=method==='DELETE'?'Retrait…':'Enregistrement…';
    try{
     const data=await api(method,body,expectedOwner);if(current!==operation||stamp!==version||owner!==expectedOwner)return;
     generation++;pending=null;accept(data);hpStability.complete(key);d.close();
    }catch(error){if(current===operation&&stamp===version)$('hpPaymentStatus').textContent=error.message||'Paiement non confirmé. Réessaie.';}
    finally{if(current===operation&&stamp===version)setBusy(false);}
   }
   $('hpPaymentForm').onsubmit=e=>{e.preventDefault();submit('PUT');};if($('hpPaymentRemove'))$('hpPaymentRemove').onclick=()=>submit('DELETE');$('hpPaymentAmount').focus();
  }catch(error){if(stamp===version)d.innerHTML=`<h2 id="hpPaymentTitle">Paiement indisponible</h2><p>${esc(error.message)}</p><button id="hpPaymentCancel" type="button">Fermer</button>`;if($('hpPaymentCancel'))$('hpPaymentCancel').onclick=()=>d.close();}
 }
 async function openLinked(id){try{await load();const row=rows.find(x=>P.prefix+x.id===id);if(!row)throw new Error('Ce paiement n’est plus disponible. Recharge le budget.');return open(row.property_id?'property':'leisure',{id:row.property_id||row.leisure_equipment_id,name:row.asset_name});}catch(e){window.alert(e.message)}}
 function invalidate(){generation++;pending=null;ready=false;paint();load().catch(()=>{});}
 document.addEventListener('click',e=>{const button=e.target.closest?.('[data-payment-open]');if(!button)return;const node=button.closest('[data-payment-card]');if(node){e.preventDefault();open(node.dataset.paymentKind,{id:node.dataset.paymentId,name:node.dataset.paymentName});}});
 document.addEventListener('hp-screen-changed',e=>{if(['properties','leisure'].includes(e.detail?.id))load().catch(()=>{});});
 window.hpAssetPayments={card,open,openLinked,load,invalidate,reset};
 window.supabaseClient?.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||(s?.user?.id&&owner&&owner!==s.user.id))reset();if(event==='SIGNED_IN')setTimeout(()=>load().catch(()=>{}),0);});
 load().catch(()=>{});
})();
