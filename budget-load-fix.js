(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 function money(n){return new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(n)}
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function withTimeout(p,ms,msg){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg||'Le chargement du budget prend trop de temps.')),ms))])}
 async function token(){return hpStability.token()}
 function currentUserId(){try{return typeof u!=='undefined'?u?.id||null:null}catch{return null}}
 let loadVersion=0,authOwner=currentUserId();
 function clearOperations(message='Connecte-toi pour retrouver tes opérations.'){
   for(const id of ['hpIncome','hpExpense','hpBalance'])if($(id))$(id).textContent='—';
   if($('hpBudgetList'))$('hpBudgetList').textContent=message;
 }
 function clearEntry(){
   for(const id of ['hpBudgetAmount','hpBudgetDescription','hpBudgetProperty','hpBudgetDate'])if($(id))$(id).value='';
   const property=$('hpBudgetProperty');if(property)property.innerHTML='<option value="">Aucune propriété</option>';
   if($('hpBudgetType'))$('hpBudgetType').value='expense';
   if($('hpBudgetCategory'))$('hpBudgetCategory').value='Autre';
   if($('hpBudgetStatus'))$('hpBudgetStatus').textContent='';
   const form=$('hpBudgetForm');if(form){form.classList.add('hidden');form.style.display=''}
 }
 async function load(){
   const userId=currentUserId(),version=++loadVersion;
   if(!userId){clearOperations();return}
   const current=()=>version===loadVersion&&currentUserId()===userId;
   try{
     const now=new Date();
     const start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
     const endD=new Date(now.getFullYear(),now.getMonth()+1,0);
     const end=`${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,'0')}-${String(endD.getDate()).padStart(2,'0')}`;
     const t=await token();if(!current())return;
     const r=await withTimeout(fetch(`/api/budget-list?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&v=${Date.now()}`,{headers:{'Authorization':'Bearer '+t},cache:'no-store'}),10000,'Le serveur Nuvabri ne répond pas.');
     let body=null;try{body=await r.json()}catch{}
     if(!current())return;
     if(!r.ok)throw new Error(body?.error||('Erreur serveur '+r.status));
     if(!Array.isArray(body?.rows))throw new Error('Réponse des opérations incomplète.');
     const rows=body.rows;
     const inc=rows.filter(x=>x.entry_type==='income').reduce((a,x)=>a+Number(x.amount||0),0);
     const exp=rows.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);
     if($('hpIncome'))$('hpIncome').textContent=money(inc);
     if($('hpExpense'))$('hpExpense').textContent=money(exp);
     if($('hpBalance'))$('hpBalance').textContent=money(inc-exp);
     if($('hpBudgetList'))$('hpBudgetList').innerHTML=rows.length?rows.map(x=>`<div class="card row"><div><b>${x.entry_type==='income'?'＋':'−'} ${money(Number(x.amount||0))}</b><div class="muted">${esc(x.category)}${x.description?' • '+esc(x.description):''}${x.properties?.name?' • 🏠 '+esc(x.properties.name):''}<br>${new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long'}).format(new Date(x.entry_date+'T12:00:00'))}</div></div><button class="alt" onclick="hpDeleteBudget('${x.id}')">×</button></div>`).join(''):'<div class="card muted">Aucune entrée pour ce mois.</div>';
     window.dispatchEvent(new CustomEvent('hp-budget-loaded',{detail:{rows,income:inc,expense:exp,balance:inc-exp}}));
   }catch(e){if(!current())return;console.error('Nuvabri budget load proxy error',e);clearOperations('Impossible de rafraîchir les opérations. Réessaie dans un instant.')}
 }
 async function del(id){
   if(!confirm('Supprimer cette entrée du budget?'))return;
   try{
     const t=await token();
     const r=await withTimeout(fetch('/api/budget-delete',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({id}),cache:'no-store'}),10000,'La suppression prend trop de temps.');
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok||!body?.ok)throw new Error(body?.error||'Suppression impossible.');
     await load();
   }catch(e){console.error('Nuvabri budget delete',e);alert(e?.message||'Impossible de supprimer cette entrée.')}
 }
 window.hpLoadBudget=load;
 window.hpDeleteBudget=del;
 window.addEventListener('hp-budget-updated',()=>setTimeout(load,120));
 function init(){
   client()?.auth?.onAuthStateChange?.((event,session)=>{
     if(!['SIGNED_OUT','SIGNED_IN','INITIAL_SESSION'].includes(event))return;
     const next=event==='SIGNED_OUT'?null:session?.user?.id||null;
     if(next!==authOwner||event==='SIGNED_OUT'){
       authOwner=next;loadVersion++;clearOperations(next?'Chargement des opérations…':undefined);clearEntry();
       if(next)setTimeout(load,0);
     }
   });
   setTimeout(load,1400);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
