(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 function money(n){return new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(n)}
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function withTimeout(p,ms,msg){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg||'Le chargement du budget prend trop de temps.')),ms))])}
 function localToken(){
   try{
     const exact=localStorage.getItem('sb-vkfvjwxajgeafzyphjvh-auth-token');
     const candidates=exact?[exact]:Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')).map(k=>localStorage.getItem(k));
     for(const raw of candidates){if(!raw)continue;const parsed=JSON.parse(raw);const t=parsed?.access_token||parsed?.currentSession?.access_token||parsed?.session?.access_token;if(t)return t}
   }catch(e){console.warn('HomePilot budget token cache',e)}
   return null;
 }
 async function token(){const cached=localToken();if(cached)return cached;const c=client();if(!c)throw new Error('Connexion HomePilot indisponible.');const r=await withTimeout(c.auth.getSession(),4000,'Impossible de lire la session HomePilot.');if(r.error)throw r.error;const t=r.data?.session?.access_token;if(!t)throw new Error('Session expirée.');return t}
 async function load(){
   try{
     const now=new Date();
     const start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
     const endD=new Date(now.getFullYear(),now.getMonth()+1,0);
     const end=`${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,'0')}-${String(endD.getDate()).padStart(2,'0')}`;
     const t=await token();
     const r=await withTimeout(fetch(`/api/budget-list?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&v=${Date.now()}`,{headers:{'Authorization':'Bearer '+t},cache:'no-store'}),10000,'Le serveur HomePilot ne répond pas.');
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok)throw new Error(body?.error||('Erreur serveur '+r.status));
     const rows=body?.rows||[];
     const inc=rows.filter(x=>x.entry_type==='income').reduce((a,x)=>a+Number(x.amount||0),0);
     const exp=rows.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);
     if($('hpIncome'))$('hpIncome').textContent=money(inc);
     if($('hpExpense'))$('hpExpense').textContent=money(exp);
     if($('hpBalance'))$('hpBalance').textContent=money(inc-exp);
     if($('hpBudgetList'))$('hpBudgetList').innerHTML=rows.length?rows.map(x=>`<div class="card row"><div><b>${x.entry_type==='income'?'＋':'−'} ${money(Number(x.amount||0))}</b><div class="muted">${esc(x.category)}${x.description?' • '+esc(x.description):''}${x.properties?.name?' • 🏠 '+esc(x.properties.name):''}<br>${new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long'}).format(new Date(x.entry_date+'T12:00:00'))}</div></div><button class="alt" onclick="hpDeleteBudget('${x.id}')">×</button></div>`).join(''):'<div class="card muted">Aucune entrée pour ce mois.</div>';
     window.dispatchEvent(new CustomEvent('hp-budget-loaded',{detail:{rows,income:inc,expense:exp,balance:inc-exp}}));
   }catch(e){console.error('HomePilot budget load proxy error',e);const list=$('hpBudgetList');if(list)list.innerHTML='<div class="notice">Impossible de rafraîchir le budget pour le moment.</div>'}
 }
 async function del(id){
   if(!confirm('Supprimer cette entrée du budget?'))return;
   try{
     const t=await token();
     const r=await withTimeout(fetch('/api/budget-delete',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({id}),cache:'no-store'}),10000,'La suppression prend trop de temps.');
     let body=null;try{body=await r.json()}catch{}
     if(!r.ok||!body?.ok)throw new Error(body?.error||'Suppression impossible.');
     await load();
   }catch(e){console.error('HomePilot budget delete',e);alert(e?.message||'Impossible de supprimer cette entrée.')}
 }
 window.hpLoadBudget=load;
 window.hpDeleteBudget=del;
 window.addEventListener('hp-budget-updated',()=>setTimeout(load,120));
 function init(){setTimeout(load,1400)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
