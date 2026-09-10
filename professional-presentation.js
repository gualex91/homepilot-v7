(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeWebsite(value){
    try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  function listingLabel(profile){
    if(profile.listing_tier==='sponsored'||profile.sponsored)return 'Publicité · Commandité';
    if(profile.listing_tier==='partner'||profile.partner)return 'Partenaire commercial';
    return profile.homepilot_featured===true?'Mis en avant par Nuvabri · Fiche non commanditée':'Fiche non commanditée';
  }
  function sortRows(rows,order){return order==='alphabetical'?[...rows].sort((a,b)=>String(a.business_name).localeCompare(String(b.business_name),'fr')):[...rows]}
  const disclosure='Les mises en avant choisies par Nuvabri, les commandites et les partenariats peuvent influencer l’ordre d’affichage. Ils ne garantissent ni la qualité ni la disponibilité. La vérification est distincte de la mise en avant et du statut commercial.';
  function evidence(profile){
    const license=String(profile.rbq_license||profile.source_reference||'').replace(/^Licence RBQ\s+/i,'');
    if(['rbq_open_data','RBQ_CC_BY_4_0'].includes(profile.source)&&/^\d{4}-\d{4}-\d{2}$/.test(license)){
      const imported=new Date(profile.imported_at),date=Number.isNaN(imported.getTime())||!profile.imported_at?'':` · Données importées le ${imported.toLocaleDateString('fr-CA',{timeZone:'UTC'})}`;
      return `<p class="muted">Licence RBQ : ${esc(license)}${esc(date)} · <a href="https://www.rbq.gouv.qc.ca/vous-etes/citoyen/verifier-la-licence-dun-entrepreneur/" target="_blank" rel="noopener noreferrer">Vérifier au registre RBQ</a></p>`;
    }
    const url=safeWebsite(profile.source_reference)||safeWebsite(profile.website);
    return url?`<p class="muted"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Consulter la référence du commerce</a></p>`:'';
  }
  const issueLabels={numbered_company:'Compagnie à numéro',missing_business_name:'Nom commercial manquant',invalid_phone:'Téléphone manquant ou format invalide',missing_reference:'Référence consultable manquante'};
  const issueText=profile=>(profile.directory_issues||[]).map(issue=>issueLabels[issue]||'Fiche à revoir').join(' · ');
  function card(profile,canQuote=false){
    if(profile.active===false||profile.directory_issues?.length)return '';
    const url=safeWebsite(profile.website),rawPhone=String(profile.phone||''),extension=rawPhone.match(/(?:ext\.?|extension|poste|x|#)\s*(\d+)\s*$/i),phone=rawPhone.replace(/(?:ext\.?|extension|poste|x|#)\s*\d+\s*$/i,'').replace(/[^+\d]/g,'')+(extension?';ext='+extension[1]:'');
    return `<article class="card"><h3>${esc(profile.business_name)}</h3><div class="hp-listing-badge">${listingLabel(profile)}</div>${evidence(profile)}${profile.description?`<p class="muted">${esc(profile.description)}</p>`:''}<div class="hp-pro-contact">${phone?`<a href="tel:${esc(phone)}">Appeler ${esc(profile.phone)}</a>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Site ou fiche du commerce</a>`:''}</div>${canQuote?`<button type="button" class="hpQuote" data-pro-id="${esc(profile.id)}">Préparer une demande</button>`:''}</article>`;
  }
  function validateLead(payload){
    if(!payload.consent_to_share)return 'Ton consentement est requis pour partager cette demande avec le commerce choisi.';
    if(!payload.contact_name||payload.contact_name.length>120)return 'Indique ton nom (120 caractères maximum).';
    if(!root.hpAccountAccess?.validEmail(payload.contact_email))return 'Indique un courriel valide pour la réponse.';
    if(payload.contact_phone.length>40)return 'Le numéro de téléphone est trop long.';
    if(payload.message.length<10||payload.message.length>3000)return 'Décris ton besoin en 10 à 3 000 caractères, sans données financières ou sensibles.';
    return null;
  }
  const api={esc,safeWebsite,listingLabel,sortRows,card,disclosure,evidence,issueText,validateLead};root.hpProfessionalPresentation=api;
  if(!root.document)return;
  let current=null;
  function render(rows,{subtitle='',property=null,task=null,category='general',allowQuote=false}={}){
    const body=document.getElementById('hpProBody');if(!body)return;
    current={rows,subtitle,property,task,category,allowQuote};
    body.innerHTML=`<p class="muted">${esc(subtitle)}</p><p class="hp-commercial-disclosure">${disclosure}</p><label for="hpProSort">Ordre des résultats</label><select id="hpProSort"><option value="directory">Ordre du répertoire, incluant les mises en avant</option><option value="alphabetical">Alphabétique, sans mise en avant</option></select><div id="hpProResults"></div>`;
    const draw=()=>{
      const list=document.getElementById('hpProResults');if(!list)return;
      list.innerHTML=sortRows(rows,document.getElementById('hpProSort').value).map(p=>card(p,allowQuote&&!!property?.id)).join('');
      list.querySelectorAll('[data-pro-id]').forEach(button=>button.onclick=()=>quote(rows.find(p=>String(p.id)===button.dataset.proId),{property,task,category}));
    };
    document.getElementById('hpProSort').onchange=draw;draw();
  }
  function quote(profile,{property,task=null,category='general'}){
    const body=document.getElementById('hpProBody');if(!profile||!property?.id||!body)return;
    body.innerHTML=`<button type="button" class="alt" id="hpLeadBack">Retour aux commerces</button><h3>Demande à ${esc(profile.business_name)}</h3><p class="muted">Pour ${esc(property.name||'la propriété choisie')} · ${esc(property.city||'')}</p><p class="hp-commercial-disclosure">L’enregistrement dans Nuvabri ne confirme pas la réception par le commerce. Pour un besoin urgent, contacte-le directement. N’inscris pas de renseignements bancaires ou d’assurance.</p><form id="hpLeadForm"><label for="hpLeadName">Nom</label><input id="hpLeadName" autocomplete="name" maxlength="120" required><label for="hpLeadEmail">Courriel pour la réponse</label><input id="hpLeadEmail" type="email" autocomplete="email" maxlength="254" required><label for="hpLeadPhone">Téléphone (facultatif)</label><input id="hpLeadPhone" type="tel" autocomplete="tel" maxlength="40"><label for="hpLeadMessage">Ton besoin</label><textarea id="hpLeadMessage" minlength="10" maxlength="3000" required></textarea><label class="choice"><input id="hpLeadConsent" type="checkbox" required> J’autorise le partage de ces coordonnées et de ce message avec ${esc(profile.business_name)}, uniquement pour répondre à cette demande.</label><button type="submit" id="hpLeadSend">Enregistrer ma demande</button><p id="hpLeadStatus" role="status" aria-live="polite"></p></form>`;
    document.getElementById('hpLeadBack').onclick=()=>{if(current)render(current.rows,current)};
    let busy=false,attempt=null;
    document.getElementById('hpLeadForm').onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      const field=id=>document.getElementById(id),status=field('hpLeadStatus'),button=field('hpLeadSend');
      const data={property_id:property.id,professional_id:profile.id,task_id:task?.id||null,category,message:field('hpLeadMessage').value.trim(),contact_name:field('hpLeadName').value.trim(),contact_email:field('hpLeadEmail').value.trim().toLowerCase(),contact_phone:field('hpLeadPhone').value.trim(),consent_to_share:field('hpLeadConsent').checked,status:'new'};
      const invalid=validateLead(data);if(invalid){status.textContent=invalid;return}
      busy=true;button.disabled=true;status.textContent='Enregistrement…';
      try{
        const client=root.supabaseClient;if(!client)throw Error('offline');
        const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth?.user)throw Error('session');
        data.user_id=auth.user.id;
        // Keep retries idempotent within this form; no contact details in browser storage.
        const fingerprint=JSON.stringify(data);
        if(!attempt||attempt.fingerprint!==fingerprint)attempt={id:root.crypto.randomUUID(),fingerprint};
        const payload={...data,id:attempt.id};
        const result=await client.from('professional_leads').upsert(payload,{onConflict:'id',ignoreDuplicates:true}).select('id');
        if(result.error)throw result.error;
        let saved=result.data?.[0];
        if(!saved){const check=await client.from('professional_leads').select('id').eq('id',attempt.id).eq('user_id',auth.user.id).maybeSingle();if(check.error)throw check.error;saved=check.data}
        if(!saved?.id)throw Error('unconfirmed');
        body.innerHTML=`<h3>Demande enregistrée</h3><p class="muted">Elle est conservée dans Nuvabri pour ${esc(profile.business_name)}. Sa livraison au commerce n’est pas confirmée. Aucun retour n’est garanti.</p><p class="muted">Référence : ${esc(saved.id)}</p>${card(profile,false)}`;
      }catch(error){status.textContent=error?.message==='session'?'Reconnecte-toi avant d’enregistrer ta demande.':'L’enregistrement n’a pas pu être confirmé. Réessaie sans fermer ni modifier ce formulaire.'}
      finally{busy=false;if(button.isConnected)button.disabled=false}
    };
  }
  Object.assign(api,{render,quote});
})(globalThis);
