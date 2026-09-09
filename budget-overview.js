(function(){
 const $=id=>document.getElementById(id);
 const client=()=>window.supabaseClient||window.sb||window.client||null;
 const money=n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(n||0));
 async function user(){const c=client();if(!c)return null;const {data:{user}}=await c.auth.getUser();return user||null}
 function ensureUI(){const budget=$('budget');if(!budget||$('hpFinancialOverview'))return;const block=document.createElement('div');block.id='hpFinancialOverview';block.className='card';block.innerHTML=`<div class="row"><div><div class="badge">Vue d’ensemble</div><h3 style="margin:8px 0 0">Mon mois financier</h3></div><span id="hpOverviewMonth" class="pill"></span></div><div id="hpOverviewGrid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px"></div><div id="hpOverviewNote" class="muted" style="margin-top:10px"></div>`;const season=budget.querySelector('.season');if(season)season.insertAdjacentElement('beforebegin',block);else budget.prepend(block)}
 function tile(icon,label,value,sub=''){return `<div style="background:linear-gradient(180deg,var(--card),color-mix(in srgb,var(--soft) 42%,var(--card)));border:1px solid color-mix(in srgb,var(--b) 10%,transparent);padding:12px;border-radius:14px"><div class="muted">${icon} ${label}</div><b style="display:block;font-size:20px;color:var(--b);margin-top:4px">${value}</b>${sub?`<div class="muted" style="font-size:12px;margin-top:3px">${sub}</div>`:''}</div>`}
 async function load(){ensureUI();const c=client(),u=await user();if(!c||!u||!$('hpOverviewGrid'))return;const now=new Date(),start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,last=new Date(now.getFullYear(),now.getMonth()+1,0),end=`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`,next30=new Date(now);next30.setDate(next30.getDate()+30);const next30s=`${next30.getFullYear()}-${String(next30.getMonth()+1).padStart(2,'0')}-${String(next30.getDate()).padStart(2,'0')}`;
 const [entriesR,savingsR,debtsR,mortgageR,recurringR]=await Promise.all([
   c.from('budget_entries').select('entry_type,amount').eq('user_id',u.id).gte('entry_date',start).lte('entry_date',end),
   c.from('budget_savings_goals').select('current_amount,target_amount').eq('user_id',u.id).eq('active',true),
   c.from('budget_debts').select('current_balance').eq('user_id',u.id).eq('active',true),
   c.from('mortgage_renewals').select('current_balance').eq('user_id',u.id).order('renewal_date',{ascending:true}).limit(1),
   c.from('budget_recurring_payments').select('amount,next_due_date').eq('user_id',u.id).eq('active',true).gte('next_due_date',start).lte('next_due_date',next30s)
 ]);
 const entries=entriesR.data||[],income=entries.filter(x=>x.entry_type==='income').reduce((a,x)=>a+Number(x.amount||0),0),expense=entries.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount||0),0),balance=income-expense;
 const savings=savingsR.data||[],saved=savings.reduce((a,x)=>a+Number(x.current_amount||0),0),target=savings.reduce((a,x)=>a+Number(x.target_amount||0),0);
 const otherDebt=(debtsR.data||[]).reduce((a,x)=>a+Number(x.current_balance||0),0),mortgage=Number(mortgageR.data?.[0]?.current_balance||0),totalDebt=otherDebt+mortgage;
 const recurring=recurringR.data||[],upcoming=recurring.reduce((a,x)=>a+Number(x.amount||0),0);
 $('hpOverviewMonth').textContent=new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(now);
 $('hpOverviewGrid').innerHTML=tile('💵','Revenus',money(income))+tile('🧾','Dépenses',money(expense))+tile(balance>=0?'✅':'⚠️','Solde du mois',money(balance),balance>=0?'Positif':'Négatif')+tile('🎯','Épargne',money(saved),target>0?`${Math.round(saved/target*100)} % des objectifs`:'Aucun objectif cible')+tile('💳','Dettes totales',money(totalDebt),mortgage>0?'Hypothèque incluse':'Hors hypothèque non renseignée')+tile('🔁','À payer bientôt',money(upcoming),`${recurring.length} paiement${recurring.length===1?'':'s'} dans les 30 jours`);
 $('hpOverviewNote').textContent='La vue d’ensemble utilise uniquement les montants enregistrés dans HomePilot. Les paiements automatiques et transactions bancaires ne sont pas importés automatiquement.';
 }
 function patchBudget(){if(window.__hpOverviewPatched||typeof window.hpLoadBudget!=='function')return;window.__hpOverviewPatched=true;const orig=window.hpLoadBudget;window.hpLoadBudget=async function(){const r=await orig.apply(this,arguments);await load();return r}}
 function init(){ensureUI();patchBudget();setTimeout(load,2400);new MutationObserver(()=>{ensureUI();patchBudget()}).observe(document.body,{childList:true,subtree:true});window.addEventListener('hp-mortgage-updated',load);setInterval(load,180000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();