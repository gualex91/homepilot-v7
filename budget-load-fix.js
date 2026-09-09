(function(){
 const $=id=>document.getElementById(id);
 function client(){return window.supabaseClient||window.sb||window.client||null}
 function money(n){return new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(n)}
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function withTimeout(p,ms){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Le chargement du budget prend trop de temps.')),ms))])}
 async function token(){const c=client();if(!c)throw new Error('Connexion HomePilot indisponible.');const r=await withTimeout(c.auth.getSession(),5000);if(r.error)throw r.error;const t=r.data?.session?.access_token;if(!t)throw new Error('Session expirée.');return t}
 async function load(){
   try{
     const now=new Date();
     const start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
     const endD=new Date(now.getFullYear(),now.getMonth()+1,0);
     const end=`${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,'0')}-${String(endD.getDate()).padStart(2,'0')}`;
     const t=await token();
     const r=await withTimeout(fetch(`/api/budget-list?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,{headers:{'Authorization':'Bearer '+t}}),12000);
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
   }catch(e){console.error('HomePilot budget load proxy error',e);const list=$('hpBudgetList');if(list&&(!list.innerHTML||list.textContent.includes('Aucune entrée')))list.innerHTML='<div class="notice">Impossible de rafraîchir le budget pour le moment.</div>'}
 }
 window.hpLoadBudget=load;
 window.addEventListener('hp-budget-updated',()=>setTimeout(load,100));
 function init(){setTimeout(load,1800)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
