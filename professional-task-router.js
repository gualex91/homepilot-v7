(function(){
  const $=id=>document.getElementById(id);
  const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const TASK_ROUTES=[
    [['nettoyer les filtres de la thermopompe','nettoyage thermopompe'],'hvac','heat_pump_cleaning','nettoyage de thermopompe',true],
    [['entretien de la thermopompe','verifier l’entretien de la thermopompe','réparer thermopompe','reparation thermopompe'],'hvac','heat_pump_maintenance','entretien de thermopompe',true],
    [['installer thermopompe','installation thermopompe'],'hvac','heat_pump_installation','installation de thermopompe',true],
    [['filtre de la fournaise','remplacer le filtre de la fournaise','faire verifier la fournaise','entretien fournaise','reparation fournaise'],'hvac','hvac','fournaise',false],
    [['echangeur d’air','échangeur d’air','conduit de ventilation','conduits de ventilation'],'hvac','ventilation_cleaning','ventilation / échangeur d’air',true],
    [['chauffe-eau','chauffe eau','pompe de puisard','plomberie','fuite d’eau','fuite eau','robinet','toilette','lavabo','drain','egout','égout','debouchage','débouchage'],'plumbing','plumbing','plomberie',false],
    [['ramonage','cheminee','cheminée'],'chimney','chimney','cheminée / ramonage',false],
    [['fosse septique','installation septique','champ d’epuration','champ d\'épuration'],'septic','septic','service septique',false],
    [['electricite','électricité','electrique','électrique','prise','panneau electrique','panneau électrique','detecteur de fumee','détecteur de fumée','monoxyde de carbone'],'electrical','electrical','électricité',false],
    [['nettoyer la piscine','filtration piscine','eau de la piscine','produits et equipements de piscine'],'pool_spa','','entretien de piscine',false],
    [['eau du spa','filtre du spa','produits du spa','entretien spa'],'pool_spa','','entretien de spa',false],
    [['gouttiere','gouttière','toiture','toit','bardeau'],'roofing','','toiture / gouttières',false],
    [['porte de garage','garage door'],'garage_door','','porte de garage',false],
    [['deneigement','déneigement'],'snow_removal','','déneigement',false],
    [['tonte de pelouse','pelouse','gazon','arbre','elagage','élagage','abattage'],'landscaping','','aménagement paysager',false]
  ];
  const LEISURE={
    snowmobile:{category:'general',service:'snowmobile_service',label:'service de motoneige',strict:true},
    snowmobile_preseason:{category:'general',service:'snowmobile_service',label:'service de motoneige',strict:true},
    snowmobile_storage:{category:'general',service:'snowmobile_service',label:'service de motoneige',strict:true},
    atv:{category:'general',service:'powersports_service',label:'service de VTT',strict:true},
    side_by_side:{category:'general',service:'powersports_service',label:'service de côte-à-côte',strict:true},
    boat:{category:'general',service:'marine_service',label:'service nautique',strict:true},
    boat_winterize:{category:'general',service:'marine_service',label:'service nautique',strict:true},
    boat_spring:{category:'general',service:'marine_service',label:'service nautique',strict:true},
    personal_watercraft:{category:'general',service:'pwc_service',label:'service de motomarine',strict:true},
    pwc_winterize:{category:'general',service:'pwc_service',label:'service de motomarine',strict:true},
    pwc_spring:{category:'general',service:'pwc_service',label:'service de motomarine',strict:true},
    rv:{category:'general',service:'rv_service',label:'service de VR',strict:true},
    rv_winterize:{category:'general',service:'rv_service',label:'service de VR',strict:true},
    rv_spring:{category:'general',service:'rv_service',label:'service de VR',strict:true},
    travel_trailer:{category:'general',service:'rv_service',label:'service de roulotte',strict:true},
    trailer_winterize:{category:'general',service:'rv_service',label:'service de roulotte',strict:true},
    trailer_spring:{category:'general',service:'rv_service',label:'service de roulotte',strict:true},
    motorcycle:{category:'general',service:'motorcycle_service',label:'service de moto',strict:true},
    motorcycle_storage:{category:'general',service:'motorcycle_service',label:'service de moto',strict:true},
    motorcycle_spring:{category:'general',service:'motorcycle_service',label:'service de moto',strict:true},
    utility_trailer:{category:'general',service:'trailer_service',label:'service de remorque',strict:true}
  };
  function routeFor(text){const t=norm(text);for(const [keys,category,service,label,strict] of TASK_ROUTES){if(keys.some(k=>t.includes(norm(k))))return {category,service,label,strict}}return {category:'general',service:'',label:'ce service',strict:false}}
  function routeForLeisure(key){return LEISURE[key]||routeFor(key)}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function token(){try{const raw=localStorage.getItem('sb-vkfvjwxajgeafzyphjvh-auth-token');if(raw){const p=JSON.parse(raw);return p?.access_token||p?.currentSession?.access_token||p?.session?.access_token||null}}catch(e){}return null}
  function getProps(){try{if(typeof props!=='undefined'&&Array.isArray(props))return props}catch(e){}return window.properties||window.props||[]}
  function currentProperty(){try{if(typeof ap!=='undefined'&&ap)return ap}catch(e){}const id=window.currentPropertyId||window.currentProperty?.id||window.activePropertyId||window.pid;return getProps().find(p=>p.id===id)||window.currentProperty||getProps()[0]||null}
  function modal(){let d=$('hpProModal');if(d)return d;d=document.createElement('div');d.id='hpProModal';d.className='hidden';d.style='position:fixed;inset:0;z-index:220;background:#0009;padding:18px;overflow:auto';d.innerHTML='<div class="card" style="max-width:620px;margin:3vh auto"><div class="row"><h2>Professionnels</h2><button class="alt" id="hpTaskProClose">Fermer</button></div><div id="hpProBody"></div></div>';document.body.appendChild(d);$('hpTaskProClose').onclick=()=>d.classList.add('hidden');return d}
  async function fetchFast(url,opts,ms=6000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opts,signal:c.signal})}catch(e){if(e?.name==='AbortError')throw new Error('La recherche a pris trop de temps. Réessaie.');throw e}finally{clearTimeout(timer)}}
  const cache=new Map();
  async function searchWithRoute(route){const m=modal(),body=$('hpProBody'),prop=currentProperty();m.classList.remove('hidden');if(!prop){body.innerHTML='<div class="notice">Sélectionne d’abord une propriété pour utiliser sa ville.</div>';return}body.innerHTML='<p class="muted">Recherche…</p>';
    try{const t=token();if(!t)throw new Error('Session expirée. Reconnecte-toi.');const qs=new URLSearchParams({category:route.category,city:prop.city||'',postal:prop.postal_code||'',region:prop.region||prop.administrative_region||''});if(route.service)qs.set('service',route.service);const ck=qs.toString(),hit=cache.get(ck);let data;if(hit&&Date.now()-hit.at<300000)data=hit.data;else{const r=await fetchFast('/api/professionals?'+ck,{headers:{Authorization:'Bearer '+t},cache:'no-store'},6000);data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.error||'Impossible de charger le répertoire.');cache.set(ck,{at:Date.now(),data})}const rows=data?.rows||[];
      if(!rows.length){body.innerHTML=`<h3>Aucun professionnel confirmé pour ${esc(route.label)}</h3><p class="muted">Ville utilisée : ${esc(prop.city||'non définie')}.</p>${route.strict?'<p class="muted">Ce service précis n’est pas encore assez documenté dans le répertoire. HomePilot n’affiche pas de compagnie au hasard.</p>':''}`;return}
      body.innerHTML=`<p class="muted">Résultats pour <b>${esc(route.label)}</b> à ${esc(prop.city||'ta région')}.</p>`+rows.map(p=>`<div class="card"><div class="row"><b>${esc(p.business_name)}</b>${route.service&&(p.service_categories||[]).includes(route.service)?'<span class="badge">Service confirmé</span>':''}</div>${p.description?`<p class="muted">${esc(p.description)}</p>`:''}${p.phone?`<p><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></p>`:''}${p.website?`<p><a href="${esc(p.website)}" target="_blank" rel="noopener">Voir le site</a></p>`:''}</div>`).join('');
    }catch(e){body.innerHTML='<div class="notice">'+esc(e?.message||'Impossible de charger le répertoire.')+'</div>'}}
  function searchPros(text){return searchWithRoute(routeFor(text))}
  function searchLeisure(key){return searchWithRoute(routeForLeisure(key))}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b)return;if(!(b.classList.contains('hpFindPro')||/Trouver un professionnel/i.test(b.textContent||'')))return;const oc=b.getAttribute('onclick')||'';const lm=oc.match(/hpFindLeisurePro\(['\"]([^'\"]+)['\"]\)/);e.preventDefault();e.stopImmediatePropagation();if(lm)return searchLeisure(lm[1]);const holder=b.closest('.notice,.card,li')||b;return searchPros(holder.textContent||'')},true);
  window.hpOpenPros=searchPros;
  window.hpFindLeisurePro=searchLeisure;
  window.hpProfessionalRouteForTask=routeFor;
})();