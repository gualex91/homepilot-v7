(function(){
  const category={technical:'Problème technique',suggestion:'Suggestion',partner:'Partenariat',privacy:'Confidentialité',financial:'Question financière',billing:'Facturation',other:'Autre'};
  const status={new:'Nouveau',review:'À approuver',waiting:'En attente',closed:'Fermé'};
  const priority={normal:'Normale',high:'Haute'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>new Date(v).toLocaleString('fr-CA');
  let dialog,content,rows=[],config={},epoch=0,userId=null,dirty=false,busy=false,next=false,bound=false,entry=null;
  function client(){return window.supabaseClient||window.sb}
  function message(value,error=false){const el=dialog?.querySelector('#hpSupportMessage');if(el){el.textContent=value;el.className='hpSupportNote'+(error?' hpSupportError':'')}}
  async function request(path='',body){
    const snapshot=epoch,{data}=await client().auth.getSession();
    if(!data?.session?.access_token)throw new Error('Reconnecte-toi pour accéder aux messages.');
    const response=await fetch('/api/support'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(45000)});
    const result=await response.json();
    if(snapshot!==epoch)throw new Error('La session a changé.');
    if(!response.ok)throw new Error(result.error||'Opération non confirmée.');return result;
  }
  function shell(){
    if(dialog)return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='/support-inbox.css?v=1';document.head.appendChild(link);
    dialog=document.createElement('dialog');dialog.id='hpSupportDialog';dialog.setAttribute('aria-labelledby','hpSupportTitle');
    dialog.innerHTML='<header><h2 id="hpSupportTitle">Messages et retours clients</h2><button class="secondary" id="hpSupportClose" type="button">Fermer</button></header><div class="hpSupportContent"><p id="hpSupportMessage" role="status" aria-live="polite"></p><div id="hpSupportContent"></div></div>';
    document.body.appendChild(dialog);content=dialog.querySelector('#hpSupportContent');
    dialog.querySelector('#hpSupportClose').onclick=()=>{if(leave())dialog.close()};
    dialog.addEventListener('cancel',e=>{if(!leave())e.preventDefault()});
  }
  function leave(){return !busy&&(!dirty||confirm('Quitter sans enregistrer les modifications?'))}
  async function action(button,fn){
    if(busy)return;const current=epoch;busy=true;
    const controls=[...dialog.querySelectorAll('button,input,textarea,select')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>{el.disabled=true});
    try{await fn()}catch(e){if(current===epoch)message(e.message,true)}finally{busy=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled})}
  }
  function stateNote(){return `<div class="hpSupportNote">Réception : ${config.receiving?'configurée, livraison à vérifier':'non activée'} · Envoi : ${config.sending?'autorisé après approbation':'désactivé'} · IA : ${config.ai?'disponible sur demande':'non activée'}<br>Le classement initial utilise des règles. Aucun courriel n’est envoyé automatiquement.</div>`}
  function options(dict,current){return Object.entries(dict).map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${esc(label)}</option>`).join('')}
  async function home(append=false){
    const r=await request('?offset='+(append?rows.length:0));config=r.config;rows=append?[...rows,...r.tickets]:r.tickets;next=r.has_more;dirty=false;
    content.innerHTML=`${stateNote()}<div class="hpSupportBar"><button id="hpSupportNew">Saisir un message reçu</button><button id="hpSupportRefresh" class="secondary">Actualiser</button></div><div class="hpSupportBar"><label>Rechercher parmi les messages chargés<input id="hpSupportSearch" type="search" placeholder="Objet, expéditeur, résumé"></label><label>Statut<select id="hpSupportStatusFilter"><option value="">Tous</option>${options(status,'')}</select></label></div><div id="hpSupportTotals" class="hpSupportNote"></div><div id="hpSupportList"></div>${next?'<button class="secondary" id="hpSupportMore">Charger les 100 suivants</button>':''}`;
    const search=content.querySelector('#hpSupportSearch'),filter=content.querySelector('#hpSupportStatusFilter');
    function list(){
      const q=search.value.toLocaleLowerCase('fr'),visible=rows.filter(t=>(!filter.value||t.status===filter.value)&&`${t.subject} ${t.from_email} ${t.summary}`.toLocaleLowerCase('fr').includes(q));
      const counts=Object.keys(category).map(k=>[category[k],rows.filter(t=>t.category===k).length]).filter(([,n])=>n);
      content.querySelector('#hpSupportTotals').textContent=`Sur ${rows.length} messages chargés : ${rows.filter(t=>t.status!=='closed').length} ouverts, ${rows.filter(t=>t.sensitive&&t.status!=='closed').length} sensibles ouverts. `+counts.map(([k,n])=>`${k} : ${n}`).join(' · ')+(next?' — Bilan partiel : d’autres messages sont disponibles.':'');
      content.querySelector('#hpSupportList').innerHTML=visible.map(t=>`<button class="hpSupportTicket" data-ticket="${esc(t.id)}"><strong>${esc(t.subject)}</strong><span class="hpSupportMeta">${esc(t.from_email)} · ${date(t.created_at)}</span><br><span class="hpSupportBadge">${status[t.status]||'À vérifier'}</span><span class="hpSupportBadge">${category[t.category]||'Autre'}</span>${t.sensitive?'<span class="hpSupportBadge hpSupportWarning">Traitement humain</span>':''}<div>${esc(t.summary)}</div></button>`).join('')||'<div class="hpSupportCard">Aucun message à afficher. Les messages apparaîtront ici lorsque la réception sera activée, ou après une saisie manuelle.</div>';
      content.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>action(b,()=>detail(b.dataset.ticket)));
    }
    search.oninput=list;filter.onchange=list;list();message('');
    content.querySelector('#hpSupportNew').onclick=newMessage;
    content.querySelector('#hpSupportRefresh').onclick=e=>action(e.currentTarget,()=>home());
    content.querySelector('#hpSupportMore')?.addEventListener('click',e=>action(e.currentTarget,()=>home(true)));
  }
  function newMessage(){
    if(!leave())return;const requestId=crypto.randomUUID();
    content.innerHTML='<button id="hpSupportBack" class="secondary">Retour aux messages</button><h3>Saisir un message reçu</h3><p class="hpSupportMeta">Copie uniquement les informations utiles au support. Aucun accès aux budgets ni pièce jointe n’est ajouté.</p><form id="hpSupportNewForm"><label for="hpSupportSender">Courriel de l’expéditeur</label><input id="hpSupportSender" type="email" maxlength="254" required><label for="hpSupportSubject">Objet</label><input id="hpSupportSubject" maxlength="240" required><label for="hpSupportBody">Message</label><textarea id="hpSupportBody" maxlength="20000" required></textarea><button type="submit">Enregistrer le message</button></form>';
    const form=content.querySelector('form');form.oninput=()=>{dirty=true};
    content.querySelector('#hpSupportBack').onclick=e=>{if(leave())action(e.currentTarget,()=>home())};
    form.onsubmit=e=>{e.preventDefault();action(form.querySelector('button'),async()=>{const r=await request('',{action:'create',request_id:requestId,from_email:form.querySelector('#hpSupportSender').value.trim(),subject:form.querySelector('#hpSupportSubject').value,body_text:form.querySelector('#hpSupportBody').value});dirty=false;await detail(r.ticket.id);message('Message enregistré. Aucun courriel envoyé.')})};
  }
  async function detail(id){
    const r=await request('?id='+encodeURIComponent(id));config=r.config;const t=r.ticket;dirty=false;let sendId=crypto.randomUUID();
    const pending=r.replies.some(x=>x.state==='pending');
    content.innerHTML=`<button id="hpSupportBack" class="secondary">Retour aux messages</button>${stateNote()}<h3>${esc(t.subject)}</h3><p class="hpSupportMeta">${esc(t.from_email)} · ${date(t.created_at)} · ${t.source==='email'?'Courriel reçu':'Saisie manuelle'}<br>Adresse déclarée : l’identité de l’expéditeur n’est pas vérifiée.</p>${t.sensitive?'<div class="hpSupportNote hpSupportWarning">Dossier sensible. Traitement humain requis; aucun envoi à l’IA. Une demande par courriel ne suffit pas à autoriser un accès ou une suppression de compte.</div>':''}${pending?'<div class="hpSupportNote hpSupportWarning">Un envoi n’est pas confirmé. Vérifie son historique ci-dessous avant de modifier le dossier.</div>':''}<div class="hpSupportGrid"><section class="hpSupportCard"><h3>Message original</h3><pre>${esc(t.body_text)}</pre>${t.attachment_count?`<p class="hpSupportMeta">${t.attachment_count} pièce(s) jointe(s) non importée(s). Consulter l’original dans Resend.</p>`:''}<h3>Résumé</h3><p>${esc(t.summary)||'Aucun résumé.'}</p><p class="hpSupportMeta">${t.analysis_source==='ai'?'Résumé proposé par IA, à vérifier':'Extrait du message; classement par règles'}</p></section><section class="hpSupportCard"><label for="hpSupportCategory">Catégorie</label><select id="hpSupportCategory">${options(category,t.category)}</select><div class="hpSupportBar"><label>Priorité<select id="hpSupportPriority">${options(priority,t.priority)}</select></label><label>Statut<select id="hpSupportStatus">${options(status,t.status)}</select></label></div><label for="hpSupportDraft">Brouillon de réponse</label><textarea id="hpSupportDraft" maxlength="8000" placeholder="Rédige ou prépare une réponse, puis relis-la avant l’envoi.">${esc(t.draft)}</textarea><div class="hpSupportBar"><button id="hpSupportSave">Enregistrer</button><button id="hpSupportAI" class="secondary" ${!config.ai||t.sensitive||pending?'disabled':''}>Préparer avec IA</button></div><p class="hpSupportMeta">L’IA ne reçoit que l’objet et le texte limité du message, avec masquage partiel des coordonnées. Ce masquage n’est pas une anonymisation garantie.</p><label class="hpSupportCheck"><input type="checkbox" id="hpSupportApproval">J’ai vérifié le destinataire, le contenu et les éventuels engagements.</label>${t.sensitive?'<label class="hpSupportCheck"><input type="checkbox" id="hpSupportSensitive">J’ai vérifié les autorisations nécessaires au traitement de ce dossier sensible.</label>':''}<p class="hpSupportMeta">Destinataire : ${esc(t.from_email)}</p><button id="hpSupportSend" ${!config.sending||pending||t.status==='closed'?'disabled':''}>Approuver et envoyer</button></section></div><h3>Historique des envois approuvés</h3><div>${r.replies.map(x=>`<div class="hpSupportCard"><b>${x.state==='accepted'?'Accepté par le service d’envoi — livraison non vérifiée':'Envoi non confirmé'}</b><p class="hpSupportMeta">Approbation : ${date(x.approved_at)} · ${esc(x.to_email)}</p><pre>${esc(x.body_text)}</pre>${x.state==='pending'?`<button class="secondary" data-retry="${esc(x.id)}" ${!config.sending?'disabled':''}>Vérifier / reprendre le même envoi</button>`:''}</div>`).join('')||'<p class="hpSupportMeta">Aucun envoi approuvé.</p>'}</div><h3>Historique IA</h3>${r.generations.map(g=>`<p class="hpSupportMeta"><button class="secondary" data-generation="${esc(g.id)}">${date(g.created_at)} · ${esc(g.status)}</button> ${esc(g.model)} · ${g.usage?.total_tokens??'—'} jetons · coût monétaire non calculé</p>`).join('')||'<p class="hpSupportMeta">Aucune génération. Le classement initial n’est pas une génération IA.</p>'}<pre id="hpSupportGenerationResult"></pre>`;
    const get=id=>content.querySelector('#'+id),draft=get('hpSupportDraft');
    const payload=()=>({id:t.id,revision:t.revision,draft:draft.value,category:get('hpSupportCategory').value,priority:get('hpSupportPriority').value,status:get('hpSupportStatus').value});
    content.querySelectorAll('textarea,select').forEach(el=>el.oninput=()=>{dirty=true});
    get('hpSupportBack').onclick=e=>{if(leave())action(e.currentTarget,()=>home())};
    get('hpSupportSave').disabled=pending;
    get('hpSupportSave').onclick=e=>action(e.currentTarget,async()=>{await request('',{action:'save',...payload()});dirty=false;await detail(id);message('Brouillon et classement enregistrés. Aucun courriel envoyé.')});
    get('hpSupportAI').onclick=e=>{
      if(dirty&&!confirm('Remplacer le brouillon non enregistré par une proposition IA?'))return;
      action(e.currentTarget,async()=>{await request('',{action:'analyze',id:t.id,revision:t.revision});dirty=false;await detail(id);message('Proposition IA enregistrée. Relis-la avant toute utilisation.')});
    };
    get('hpSupportSend').onclick=e=>{
      if(!get('hpSupportApproval').checked||t.sensitive&&!get('hpSupportSensitive').checked){message('Confirme la vérification du message avant l’envoi.',true);return}
      if(!draft.value.trim()){message('Rédige une réponse avant l’envoi.',true);return}
      action(e.currentTarget,async()=>{await request('',{action:'send',...payload(),request_id:sendId,approved:true,sensitive_confirmed:!!get('hpSupportSensitive')?.checked});dirty=false;await detail(id);message('Réponse acceptée par le service d’envoi. Livraison non encore vérifiée.')});
    };
    content.querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{if(confirm('Reprendre uniquement cet envoi déjà approuvé, avec le même texte et le même destinataire?'))action(b,async()=>{await request('',{action:'retry',reply_id:b.dataset.retry,approved:true});await detail(id);message('État de l’envoi confirmé par le service.')})});
    content.querySelectorAll('[data-generation]').forEach(b=>b.onclick=()=>action(b,async()=>{const g=await request('?generation='+b.dataset.generation);get('hpSupportGenerationResult').textContent=g.generation.result?.text||'Aucun résultat disponible.'}));
  }
  async function open(){
    shell();if(!dialog.open)dialog.showModal();content.textContent='';message('Chargement des messages…');
    try{await home()}catch(e){message(e.message,true)}
  }
  function addEntry(){
    const host=document.querySelector('#hpAdminModal .row');if(!host||host.querySelector('#hpSupportEntry'))return;
    entry=document.createElement('button');entry.id='hpSupportEntry';entry.className='alt';entry.textContent='Messages';entry.onclick=open;host.appendChild(entry);
  }
  function clear(){epoch++;rows=[];dirty=false;busy=false;if(dialog){dialog.close();dialog.remove();dialog=null;content=null}}
  async function boot(){
    const c=client();if(!c)return;
    if(!bound){bound=true;c.auth.onAuthStateChange((_event,session)=>{const nextId=session?.user?.id||null;if(nextId!==userId){userId=nextId;clear()}})}
    addEntry();
  }
  window.hpSupportInbox={open};
  window.addEventListener('hp-admin-rendered',boot);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
