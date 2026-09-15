(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const frequencies={weekly:'Chaque semaine',biweekly:'Aux deux semaines',monthly:'Chaque mois',quarterly:'Chaque trimestre',yearly:'Chaque année'};
 function buildPlan(config,entry,frequency){
  const E=root.hpBudgetEngine;
  if(!Object.hasOwn(frequencies,frequency))throw new Error('Choisis une fréquence.');
  const plan=structuredClone(config||E.empty()),key=entry.entry_type==='income'?'incomes':'bills';
  const prefix='entry-repeat:'+(entry.property_id||'personal')+':';
  const row={id:prefix+entry.request_id,label:(entry.description||entry.category).slice(0,120),category:entry.category,amount:entry.amount,frequency,anchorDate:entry.entry_date,secondDay:null,essential:entry.entry_type!=='income'&&!root.hpBudgetInsights.savingsCategory(entry.category)};
  if(root.hpBudgetInsights.savingsCategory(row.category)&&key==='bills'){row.accountBalance=entry.accountBalance??null;if(entry.accountBalanceAsOf)row.accountBalanceAsOf=entry.accountBalanceAsOf;}
  const previous=plan[key].find(x=>x.id===row.id);
  if(previous){if(['label','category','amount','frequency','anchorDate'].some(k=>previous[k]!==row[k]))throw new Error('Cette récurrence a changé. Vérifie tes montants avant de réessayer.');return {config:plan,unchanged:true}}
  // Recording the next actual payment must not create the same schedule again.
  const same=plan[key].find(x=>x.id.startsWith(prefix)&&['label','category','amount','frequency'].every(k=>x[k]===row[k])&&E.occurrences(x,row.anchorDate,row.anchorDate).length);
  if(same)return {config:plan,unchanged:true};
  plan[key].push(row);plan.reviewed=false;
  return {config:E.validate(plan),unchanged:false};
 }
 root.hpBuildRecurringEntryPlan=buildPlan;
 root.hpPrepareEntryRecurrence=async(entry,frequency,token)=>{
  const owner=entry.user_id;
  async function sameOwner(){const {data,error}=await root.supabaseClient.auth.getSession();if(error||data?.session?.user?.id!==owner)throw new Error('La session a changé. Rouvre le formulaire.')}
  async function request(method,body){await sameOwner();const r=await fetch('/api/budget-plan?month='+entry.entry_date.slice(0,7),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});const result=await r.json();await sameOwner();if(!r.ok)throw new Error(result.error||'La récurrence n’a pas pu être enregistrée.');return result}
  const current=await request('GET'),clean=root.hpAssetPaymentEngine?.cleanPlan(current.config||root.hpBudgetEngine.empty())||current.config||root.hpBudgetEngine.empty();
  const next=buildPlan(clean,entry,frequency);
  return async()=>{
   await sameOwner();if(next.unchanged)return;
   const key='entry-recurrence:'+owner+':'+entry.request_id;
   const body={config:next.config,expected_revision:current.revision??null};body.request_id=hpStability.operation(key,body);
   const result=await request('PUT',body);if(!result.ok||!result.revision)throw new Error('La récurrence n’a pas été confirmée.');hpStability.complete(key);
  };
 };
 function sync(){
  const type=$('hpBudgetType'),select=$('hpBudgetCategory'),form=$('hpBudgetForm');if(!type||!select||!form||!root.hpBudgetCatalog)return;
  const income=type.value==='income',kind=income?'income':'expense',categories=root.hpBudgetCatalog.categoriesFor(kind);
  const signature=kind+':'+categories.join('|');
  if(select.dataset.hpCategoryKind!==signature){const selected=select.value;select.replaceChildren(...categories.map(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;return o}));select.value=categories.includes(selected)?selected:income?'Salaire':'Autre';select.dataset.hpCategoryKind=signature}
  const title=form.querySelector('h3');if(title)title.textContent=income?'Ajouter un revenu':'Ajouter une dépense';
  if(!$('hpBudgetRepeat')){
   const box=document.createElement('div');box.id='hpBudgetRepeatOptions';box.innerHTML='<label class="finance-check" for="hpBudgetRepeat"><input id="hpBudgetRepeat" type="checkbox" role="switch"><span id="hpBudgetRepeatLabel">Cette dépense revient</span></label><div id="hpBudgetRepeatFields" hidden><label for="hpBudgetFrequency">Fréquence</label><select id="hpBudgetFrequency">'+Object.entries(frequencies).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select><p class="muted">Cette opération est enregistrée une fois. Les prochaines dates seront ajoutées au budget prévu; confirme les futurs paiements lorsqu’ils auront eu lieu.</p></div>';
   $('hpBudgetSave').before(box);$('hpBudgetFrequency').value='monthly';
  }
  const savings=!income&&root.hpBudgetInsights.savingsCategory(select.value);
  if(!$('hpBudgetSavingsBalance')){const box=document.createElement('div');box.id='hpBudgetSavingsFields';box.innerHTML='<label for="hpBudgetSavingsBalance">Solde déjà accumulé dans ce compte ($)</label><input id="hpBudgetSavingsBalance" type="number" min="0" step="0.01" inputmode="decimal"><label for="hpBudgetSavingsAsOf">Solde vérifié le</label><input id="hpBudgetSavingsAsOf" type="date"><p class="muted">Inclus le versement saisi s’il est déjà dans ce solde. Les versements suivants s’ajouteront automatiquement à l’estimation selon la fréquence choisie, sans modifier ton solde bancaire réel.</p>';$('hpBudgetSave').before(box)}
  $('hpBudgetSavingsFields').hidden=!savings||!$('hpBudgetRepeat').checked;
  $('hpBudgetRepeatLabel').textContent=savings?'Je mets ce montant de côté régulièrement':income?'Ce revenu revient (paie, prestations…)':'Cette dépense revient';
  $('hpBudgetRepeatFields').hidden=!$('hpBudgetRepeat').checked;
 }
 root.hpSyncBudgetEntryOptions=sync;
 root.hpResetBudgetEntryOptions=()=>{if($('hpBudgetRepeat'))$('hpBudgetRepeat').checked=false;for(const id of ['hpBudgetSavingsBalance','hpBudgetSavingsAsOf'])if($(id))$(id).value='';sync()};
 function init(){sync();document.addEventListener('change',e=>{if(['hpBudgetType','hpBudgetCategory','hpBudgetRepeat'].includes(e.target.id))sync()});new MutationObserver(()=>{if(!$('hpBudgetRepeat')&&$('hpBudgetForm'))sync()}).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
