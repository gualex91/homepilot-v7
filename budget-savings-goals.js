(function(){
 const $=id=>document.getElementById(id);
 const client=()=>window.supabaseClient||window.sb||window.client||null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(Number(n||0));
 let contribution=null;
 const store=hpStability.financialStore('budget_savings_goals',client,()=>{contribution=null;hpStability.resetForm('hpSavingsForm');hpStability.resetForm('hpSavingsContribution');if($('hpSavingsList'))$('hpSavingsList').innerHTML='';});
 async function user(){const session=await store.context();return session?{id:session.userId,valid:session.valid}:null}
 function ensure(){const b=$('budget');if(!b||$('hpSavingsGoals'))return;const wrap=document.createElement('div');wrap.id='hpSavingsGoals';wrap.innerHTML=`<div class="row" style="margin-top:18px"><h3>🎯 Objectifs d’épargne</h3><button class="alt" id="hpSavingsToggle">+ Objectif</button></div><div id="hpSavingsForm" class="card hidden"><label>Nom de l’objectif</label><input id="hpSavingsName" required placeholder="Ex. Fonds d'urgence, voyage, mise de fonds"><label>Montant cible</label><input id="hpSavingsTarget" required type="number" min="0.01" step="0.01"><label>Montant déjà accumulé</label><input id="hpSavingsCurrent" required type="number" min="0" step="0.01" value="0"><label>Date visée (facultatif)</label><input id="hpSavingsDate" type="date"><label>Notes</label><input id="hpSavingsNotes" placeholder="Facultatif"><button id="hpSavingsSave" style="width:100%">Créer l’objectif</button></div><div id="hpSavingsContribution" class="card hidden"><h4>Ajouter à mon objectif</h4><p id="hpSavingsContributionHint" class="muted"></p><label for="hpSavingsContributionAmount">Montant ajouté</label><input id="hpSavingsContributionAmount" required type="number" inputmode="decimal" min="0.01" step="0.01"><p id="hpSavingsContributionError" role="status"></p><button id="hpSavingsContributionSave">Enregistrer l’ajout</button><button class="alt" id="hpSavingsContributionCancel">Annuler</button></div><div id="hpSavingsList"></div>`;b.appendChild(wrap);$('hpSavingsToggle').onclick=()=>$('hpSavingsForm').classList.toggle('hidden');$('hpSavingsSave').onclick=hpStability.guardForm('hpSavingsForm','hpSavingsSave',save);$('hpSavingsContributionSave').onclick=hpStability.guardForm('hpSavingsContribution','hpSavingsContributionSave',saveContribution);$('hpSavingsContributionCancel').onclick=()=>{contribution=null;hpStability.resetForm('hpSavingsContribution')}}
 async function save(){const c=client(),u=await user();if(!c||!u)return alert('Reconnecte-toi à Nuvabri.');const name=$('hpSavingsName').value.trim(),target=Number($('hpSavingsTarget').value),current=Number($('hpSavingsCurrent').value||0);if(!name)return alert('Donne un nom à l’objectif.');if(!(target>0))return alert('Entre un montant cible supérieur à 0.');if(current<0)return alert('Le montant accumulé ne peut pas être négatif.');const {error}=await hpStability.insertOnce(c,'budget_savings_goals',{user_id:u.id,name,target_amount:target,current_amount:current,target_date:$('hpSavingsDate').value||null,notes:$('hpSavingsNotes').value.trim()||null});if(!u.valid())return;if(error)return alert(hpStability.financialError(error));['hpSavingsName','hpSavingsTarget','hpSavingsCurrent','hpSavingsDate','hpSavingsNotes'].forEach(id=>$(id).value=id==='hpSavingsCurrent'?'0':'');$('hpSavingsForm').classList.add('hidden');load()}
 function monthsTo(date){if(!date)return null;const now=new Date(),d=new Date(date+'T12:00:00');let m=(d.getFullYear()-now.getFullYear())*12+d.getMonth()-now.getMonth();if(d.getDate()<now.getDate())m--;return Math.max(0,m)}
 function card(x){const target=Number(x.target_amount),current=Number(x.current_amount),pct=Math.min(100,target?current/target*100:0),remain=Math.max(0,target-current),months=monthsTo(x.target_date),monthly=months&&remain>0?remain/months:null;return `<div class="card"><div class="row"><div><b>${esc(x.name)}</b><div class="muted">${money(current)} sur ${money(target)}</div></div><span class="pill">${Math.round(pct)} %</span></div><div style="height:10px;background:var(--soft);border-radius:999px;overflow:hidden;margin:10px 0"><div style="height:100%;width:${pct}%;background:var(--b)"></div></div>${x.target_date?`<div class="muted">Date visée : ${new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long',year:'numeric'}).format(new Date(x.target_date+'T12:00:00'))}</div>`:''}${monthly?`<div class="notice" style="margin-top:10px">Contribution suggérée : <b>${money(monthly)}/mois</b> pour atteindre l’objectif à temps.</div>`:''}${pct>=100?'<div class="notice" style="margin-top:10px">🎉 Objectif atteint.</div>':''}${x.notes?`<p class="muted">${esc(x.notes)}</p>`:''}<div class="taskactions"><button class="alt" onclick="hpSavingsAdd('${x.id}')">+ Ajouter</button><button class="alt" onclick="hpSavingsDelete('${x.id}')">Supprimer</button></div></div>`}
 async function load(){
  ensure();if(!$('hpSavingsList'))return;
  try {const data=await store.read(q=>q.eq('active',true).order('created_at',{ascending:false}));if(data===null)return;
   $('hpSavingsList').innerHTML=data.length?data.map(card).join(''):'<div class="card muted">Aucun objectif d’épargne pour le moment.</div>';
  }catch{$('hpSavingsList').innerHTML='<div class="notice">Les objectifs n’ont pas pu charger. <button onclick="hpLoadSavings()">Réessayer</button></div>'}
 }
 window.hpLoadSavings=load;
 window.hpSavingsAdd=id=>{
  contribution=store.snapshot(id);if(!contribution)return;
  $('hpSavingsContributionHint').textContent=contribution.name+' · Déjà accumulé : '+money(contribution.current_amount);
  $('hpSavingsContributionAmount').value='';$('hpSavingsContributionError').textContent='';
  $('hpSavingsContribution').classList.remove('hidden');$('hpSavingsContribution').scrollIntoView?.({block:'center'});$('hpSavingsContributionAmount').focus();
 };
 async function saveContribution(){
  const row=contribution,amount=Number($('hpSavingsContributionAmount').value);
  if(!row||!Number.isFinite(amount)||amount<=0)return;
  const total=Math.round((Number(row.current_amount)+amount)*100)/100;
  if(!Number.isSafeInteger(Math.round(total*100))){$('hpSavingsContributionError').textContent='Ce montant est trop élevé.';return}
  try{const changed=await store.change(row,{current_amount:total});if(!changed||contribution!==row)return;
   contribution=null;hpStability.resetForm('hpSavingsContribution');await load();
  }catch(error){if(contribution===row)$('hpSavingsContributionError').textContent=hpStability.financialError(error)}
 }
 window.hpSavingsDelete=async id=>{
  const row=store.snapshot(id);if(!row||!confirm('Supprimer cet objectif?'))return;
  try{if(await store.remove(row))await load()}catch(error){alert(hpStability.financialError(error))}
 };
 window.addEventListener('hp-budget-loaded',()=>{load().catch(console.error)});
 function init(){ensure();setTimeout(load,1800);new MutationObserver(()=>{ensure()}).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
