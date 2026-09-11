(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=hpStability.esc;
 let dialog=null,busy=false,version=0,activeOwner='';
 function reset(){version++;busy=false;activeOwner='';if(dialog){dialog.close();dialog.innerHTML='';}}
 async function identity(){const {data,error}=await window.supabaseClient.auth.getSession();if(error||!data?.session?.user)throw new Error('Session expirée. Reconnecte-toi.');return data.session;}
 async function open(record){
  if(busy||!record?.id)return;
  const stamp=++version;
  try{
   const first=await identity();if(stamp!==version)return;activeOwner=first.user.id;
   if(!dialog){dialog=document.createElement('dialog');dialog.id='hpPropertyDeleteDialog';dialog.className='hp-asset-dialog';dialog.setAttribute('aria-labelledby','hpPropertyDeleteTitle');dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{version++;});document.body.appendChild(dialog);}
   dialog.innerHTML=`<h2 id="hpPropertyDeleteTitle">Supprimer cette propriété?</h2><p><strong>${esc(record.name||'Cette propriété')}</strong> sera supprimée pour tout le foyer, avec ses équipements, ses tâches, ses accès et ses demandes de professionnels associés.</p><p>Les paiements liés seront retirés des budgets. Les opérations financières déjà enregistrées seront conservées.</p><p>Cette action est définitive et réservée aux responsables autorisés du foyer.</p><p id="hpPropertyDeleteStatus" role="status" aria-live="polite"></p><div class="hp-asset-dialog-actions"><button type="button" class="alt" id="hpPropertyDeleteCancel">Annuler</button><button type="button" class="hp-asset-confirm-delete" id="hpPropertyDeleteConfirm">Supprimer définitivement</button></div>`;
   $('hpPropertyDeleteCancel').onclick=()=>{if(!busy)dialog.close();};
   $('hpPropertyDeleteConfirm').onclick=async()=>{
    if(busy||stamp!==version)return;busy=true;const button=$('hpPropertyDeleteConfirm');button.disabled=true;$('hpPropertyDeleteCancel').disabled=true;$('hpPropertyDeleteStatus').textContent='Suppression…';
    try{
     const s=await identity();if(s.user.id!==first.user.id)throw new Error('La session a changé. Rouvre la fiche.');
     const r=await fetch('/api/property-update?id='+encodeURIComponent(record.id),{method:'DELETE',headers:{Authorization:'Bearer '+s.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await r.json();
     if(!r.ok||!data.ok||data.id!==record.id)throw new Error(data.error||'Suppression non confirmée. Réessaie.');
     if(stamp!==version)return;
     dialog.close();$('hpPropertyModal')?.classList.add('hidden');window.hpAssetPayments?.invalidate();
     await window.hpForgetProperty?.(record.id,first.user.id);window.show?.('properties');window.hpPropertyGallery?.refresh(true);
    }catch(e){if(stamp===version)$('hpPropertyDeleteStatus').textContent=e.message||'Suppression non confirmée. Réessaie.';}
    finally{busy=false;if(stamp===version){button.disabled=false;$('hpPropertyDeleteCancel').disabled=false;}}
   };
   if(!dialog.open)dialog.showModal();$('hpPropertyDeleteCancel').focus();
  }catch(e){if(stamp===version)window.alert(e.message);}
 }
 window.hpDeleteProperty={open,reset};window.supabaseClient?.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||(activeOwner&&s?.user?.id&&s.user.id!==activeOwner))reset();});
})();
