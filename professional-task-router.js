(function(){
  const $=id=>document.getElementById(id);
  const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const ROUTES=[
    [['nettoyer les filtres de la thermopompe','nettoyage thermopompe'], 'hvac','heat_pump_cleaning','nettoyage de thermopompe'],
    [['entretien de la thermopompe','verifier l’entretien de la thermopompe','réparer thermopompe','reparation thermopompe'], 'hvac','heat_pump_maintenance','entretien de thermopompe'],
    [['installer thermopompe','installation thermopompe'], 'hvac','heat_pump_installation','installation de thermopompe'],
    [['filtre de la fournaise','remplacer le filtre de la fournaise'], 'hvac','furnace_filter_service','filtre de fournaise'],
    [['faire verifier la fournaise','entretien fournaise','reparation fournaise'], 'hvac','furnace_maintenance','entretien de fournaise'],
    [['echangeur d’air','échangeur d’air'], 'hvac','air_exchanger_cleaning','nettoyage d’échangeur d’air'],
    [['conduit de ventilation','conduits de ventilation','ventilation nettoyer'], 'hvac','ventilation_cleaning','nettoyage de ventilation'],
    [['chauffe-eau','chauffe eau'], 'plumbing','water_heater_service','service de chauffe-eau'],
    [['ramonage','cheminee','cheminée'], 'chimney','chimney_sweeping','ramonage de cheminée'],
    [['nettoyer la piscine','filtration piscine','eau de la piscine','produits et equipements de piscine'], 'pool_spa','pool_maintenance','entretien de piscine'],
    [['eau du spa','filtre du spa','produits du spa','entretien spa'], 'pool_spa','spa_maintenance','entretien de spa'],
    [['fosse septique','installation septique','champ d’epuration','champ d'épuration'], 'septic','septic_service','service septique'],
    [['gouttiere','gouttière'], 'roofing','gutter_cleaning','nettoyage de gouttières'],
    [['toiture','toit','bardeau'], 'roofing','roofing_service','service de toiture'],
    [['pompe de puisard','sump pump'], 'plumbing','sump_pump_service','pompe de puisard'],
    [['porte de garage','garage door'], 'garage_door','garage_door_service','porte de garage'],
    [['detecteur de fumee','détecteur de fumée','detecteurs de fumee','co2','monoxyde de carbone'], 'electrical','smoke_co_service','détecteurs de fumée/CO'],
    [['deneigement','déneigement'], 'snow_removal','snow_removal','déneigement'],
    [['tonte de pelouse','pelouse','gazon'], 'landscaping','lawn_care','entretien de pelouse'],
    [['plomberie','fuite d’eau','fuite eau','robinet','toilette','lavabo'], 'plumbing','plumbing_service','plomberie'],
    [['drain','egout','égout','debouchage','débouchage'], 'plumbing','drain_cleaning','débouchage de drain'],
    [['electricite','électricité','electrique','électrique','prise','panneau electrique','panneau électrique'], 'electrical','electrical_service','électricité'],
    [['fondation','fissure'], 'general','foundation_repair','réparation de fondation'],
    [['moisissure','mold'], 'general','mold_remediation','traitement de moisissure'],
    [['isolation','isolant'], 'general','insulation_service','isolation'],
    [['extermin','insecte','souris','rongeur'], 'general','pest_control','extermination'],
    [['serrure','serrurier'], 'general','locksmith','serrurier'],
    [['electromenager','électroménager','refrigerateur','réfrigérateur','lave-vaisselle','secheuse','sécheuse'], 'general','appliance_repair','réparation d’électroménager'],
    [['fenetre','fenêtre','porte exterieure','porte extérieure'], 'general','window_door_service','portes et fenêtres'],
    [['peinture','peintre'], 'general','painting','peinture'],
    [['arbre','elagage','élagage','abattage'], 'landscaping','arborist','arboriste'],
    [['bateau','mise en hiver du bateau','mise a l’eau','mise à l’eau'], 'general','marine_service','service nautique'],
    [['motomarine'], 'general','pwc_service','service de motomarine'],
    [['motoneige'], 'general','snowmobile_service','service de motoneige'],
    [['vtt','cote-a-cote','côte-à-côte'], 'general','powersports_service','service VTT/côte-à-côte'],
    [['vr','motorise','motorisé','roulotte'], 'general','rv_service','service VR/roulotte'],
    [['moto','motocyclette'], 'general','motorcycle_service','service de moto'],
    [['remorque'], 'general','trailer_service','service de remorque']
  ];
  function routeFor(text){const t=norm(text);for(const [keys,category,service,label] of ROUTES){if(keys.some(k=>t.includes(norm(k))))return {category,service,label}}return {category:'general',service:'',label:'ce service'}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function token(){try{const raw=localStorage.getItem('sb-vkfvjwxajgeafzyphjvh-auth-token');if(raw){const p=JSON.parse(raw);return p?.access_token||p?.currentSession?.access_token||p?.session?.access_token||null}}catch(e){}return null}
  function getProps(){try{if(typeof props!=='undefined'&&Array.isArray(props))return props}catch(e){}return window.properties||window.props||[]}
  function currentProperty(){try{if(typeof ap!=='undefined'&&ap)return ap}catch(e){}const id=window.currentPropertyId||window.currentProperty?.id||window.activePropertyId||window.pid;return getProps().find(p=>p.id===id)||window.currentProperty||getProps()[0]||null}
  function modal(){let d=$('hpProModal');if(d)return d;d=document.createElement('div');d.id='hpProModal';d.className='hidden';d.style='position:fixed;inset:0;z-index:220;background:#0009;padding:18px;overflow:auto';d.innerHTML='<div class="card" style="max-width:620px;margin:3vh auto"><div class="row"><h2>Professionnels</h2><button class="alt" id="hpTaskProClose">Fermer</button></div><div id="hpProBody"></div></div>';document.body.appendChild(d);$('hpTaskProClose').onclick=()=>d.classList.add('hidden');return d}
  async function searchPros(text){const m=modal(),body=$('hpProBody'),prop=currentProperty(),route=routeFor(text);m.classList.remove('hidden');body.innerHTML='<p class="muted">Recherche par service précis…</p>';if(!prop){body.innerHTML='<div class="notice">Sélectionne d’abord une propriété pour utiliser sa ville.</div>';return}
    try{const t=token();if(!t)throw new Error('Session expirée. Reconnecte-toi.');const qs=new URLSearchParams({category:route.category,city:prop.city||'',postal:prop.postal_code||'',region:prop.region||prop.administrative_region||''});if(route.service)qs.set('service',route.service);const r=await fetch('/api/professionals?'+qs.toString(),{headers:{Authorization:'Bearer '+t},cache:'no-store'});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.error||'Impossible de charger le répertoire.');const rows=data?.rows||[];
      if(!rows.length){body.innerHTML=`<h3>Aucun professionnel confirmé pour ${esc(route.label)}</h3><p class="muted">HomePilot préfère afficher zéro résultat plutôt qu’une entreprise dont ce service précis n’est pas confirmé.</p><p class="muted">Ville utilisée : ${esc(prop.city||'non définie')}.</p>`;return}
      body.innerHTML=`<p class="muted">Résultats correspondant précisément à <b>${esc(route.label)}</b> à ${esc(prop.city||'ta région')}.</p>`+rows.map(p=>`<div class="card"><div class="row"><b>${esc(p.business_name)}</b>${(p.service_categories||[]).includes(route.service)?'<span class="badge">Service confirmé</span>':''}</div>${p.description?`<p class="muted">${esc(p.description)}</p>`:''}${p.phone?`<p><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></p>`:''}${p.website?`<p><a href="${esc(p.website)}" target="_blank" rel="noopener">Voir le site</a></p>`:''}</div>`).join('');
    }catch(e){body.innerHTML='<div class="notice">'+esc(e?.message||'Impossible de charger le répertoire.')+'</div>'}}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b)return;if(!(b.classList.contains('hpFindPro')||/Trouver un professionnel/i.test(b.textContent||'')))return;const holder=b.closest('.card,li,.notice,div')||b;e.preventDefault();e.stopImmediatePropagation();searchPros(holder.textContent||'')},true);
  window.hpOpenPros=searchPros;
  window.hpFindLeisurePro=key=>searchPros(key||'loisir');
  window.hpProfessionalRouteForTask=routeFor;
})();