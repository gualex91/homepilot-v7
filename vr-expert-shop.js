(function(){
 'use strict';
 const ORIGIN='https://vrexpertjonquiere.ca',CHECKED='2026-09-10';
 // Curated from public merchant pages, not a stock feed. Preserve exact slugs.
 const categories=[
  ['winter','Hivernisation','entretien-et-reparation/hivernisation'],
  ['hoses','Boyaux d’eau potable','plomberie/boyau-deau-potable-et-accessoires'],
  ['pumps','Pompes et filtres à eau','plomberie/pompes-filtres-et-accessoires'],
  ['waste','Toilettes et eaux usées','plomberie/toilettes-et-produits-chimiques'],
  ['drain','Boyaux et accessoires de vidange','plomberie/vidange'],
  ['seals','Scellants','entretien-et-reparation/scellants'],
  ['cleaning','Nettoyants et cires','entretien-et-reparation/nettoyant-et-cire'],
  ['battery','Boîtiers et accessoires de batterie','electricite/batteries-et-accesssoires'],
  ['surge','Protection contre les surtensions','electricite/fils-et-adapteurs'],
  ['detectors','Détecteurs','accessoires/detecteur'],
  ['chocks','Cales et blocs de nivellement','remorquage/cales-de-roues-et-niveleur'],
  ['towing','Attelages','remorquage/attelages'],
  ['locks','Cadenas et barrures','remorquage/cadenas-et-barrures'],
  ['propane','Propane : boyaux, raccords et régulateurs','propane'],
  ['covers','Housses de remisage','accessoires/housse-de-remisage'],
  ['awnings','Toiles et pièces d’auvents','toiles-et-auvents'],
  ['kitchen','Accessoires de cuisine','accessoires/cuisine'],
  ['chairs','Chaises et tables','accessoires/kuma'],
  ['shelters','Gazebos et tentes portatives','accessoires/chaises'],
  ['mats','Tapis de sol','accessoires/tapis-de-sol'],
  ['griddles','Plaques de cuisson','appareils-et-electromenagers/plaque-de-cuisson'],
  ['water_heaters','Chauffe-eau et pièces','appareils-et-electromenagers/chauffe-eau'],
  ['lights','Éclairage extérieur et feux de position','electricite/lumieres-et-ampoules'],
  ['vents','Dômes et ventilation','entretien-et-reparation/ventilation']
 ].map(([id,label,path])=>({id,label,url:ORIGIN+'/categorie-de-produit/'+path+'/',checkedAt:CHECKED}));
 const products=[
  ['antifreeze','Antigel de plomberie pour VR','antigel-de-plomberie','winter','Pour les conduites du VR, selon le manuel et l’étiquette. Ne pas utiliser comme antigel moteur.'],
  ['winter_kit','Ensemble de mise en hiver','ens-mise-en-hiver','winter','Pour acheminer l’antigel dans le réseau du VR. Antigel vendu séparément; vérifier les raccords.'],
  ['moisture','Absorbants d’humidité — paquet de 2','absorbant-humidite-pqt2','winter','Pour le remisage intérieur du VR, en complément d’une ventilation adaptée.'],
  ['hose','Boyau d’eau potable 1/2 po × 15 pi','boyau-eau-1-2-15','hoses','Pour le branchement d’eau potable; choisir une longueur adaptée à ton installation.'],
  ['water_care','Assainisseur d’eau potable','assainisseur-deau','pumps','Pour l’entretien de l’eau du réservoir. Suivre l’étiquette; ce produit ne remplace pas une procédure complète de désinfection.'],
  ['water_filter','Filtre à eau extérieur','filtre-a-eau-ext','pumps','Pour une arrivée d’eau déjà potable; vérifier raccords et entretien.'],
  ['water_pump','Pompe à eau Shurflo 3 GPM, 12 V','pompe-shurflo-3gpm-4008-101-e65','pumps','Pièce de remplacement au besoin : confirmer tension, pression, débit et raccords.'],
  ['aquapods','Aquapods — 12 sachets','aquapods-12-sachets','waste','Pour le réservoir d’eaux noires du VR; respecter l’étiquette.'],
  ['toilet_paper','Papier Aqua-Soft à dissolution rapide','papier-hygienique-2-ply-12','waste','Pour les toilettes de VR compatibles; paquet de 4 rouleaux.'],
  ['roof_seal','Scellant Dicor pour toit','dicor-pour-toit','seals','Autonivelant : pour les surfaces horizontales compatibles du toit du VR. Confirmer la membrane.'],
  ['butyl','Ruban de butyle 1/8 po × 1 po × 30 pi','butyle-tape-1-8-x-1-x-30-1901f20','seals','Pour les assemblages qui exigent du butyle. Choisir le format prescrit.'],
  ['wall_seal','Scellant Proflex clair pour mur','proflex-clair-pour-mur','seals','Pour les joints extérieurs du VR. Ne convient pas au silicone ni à l’EPDM.'],
  ['microfiber','Chiffons en microfibre — paquet de 3','linges-a-polir-en-microfibre-pqt3','cleaning','Pour essuyer ou polir une surface compatible. Utiliser un chiffon propre et suivre le manuel.'],
  ['wash_wax','Savon-cire pour VR, 550 ml','savon-cire-550ml-0','cleaning','Pour le lavage extérieur du VR; vérifier le revêtement avant l’emploi.'],
  ['brush','Brosse de lavage télescopique','brosse-telescopique','cleaning','Pour les surfaces extérieures compatibles; raccord pour boyau d’eau.',true],
  ['roof_cleaner','Nettoyant pour toit de caoutchouc','nettoyeur-toit-caoutchouc-l','cleaning','Vérifier la membrane et le traitement complémentaire recommandé par le fabricant.'],
  ['awning_cleaner','Nettoyant pour auvent aux agrumes','nettoyeur-auvent-aux-agrumes','cleaning','Pour un auvent en vinyle, acrylique ou tissu compatible; respecter l’étiquette.'],
  ['slide_lube','Lubrifiant sec pour annexe','lubrifiant-slide-out-star-brite','cleaning','Seulement si le mécanisme d’extension du VR autorise cette lubrification.'],
  ['battery_box','Boîte à batterie, groupe 24','boite-a-batterie-24','battery','Boîtier vendu sans batterie. Confirmer les dimensions et la fixation.'],
  ['disconnect','Déconnecteur de batterie','batterie-disconnect-3','battery','Pour une installation compatible à borne latérale; confirmer les caractéristiques électriques.'],
  ['surge_30','Protecteur de surtension portatif, 30 A','protecteur-surge-30-amp','surge','Choisir selon le branchement électrique du VR.'],
  ['surge_50','Protecteur de surtension portatif, 50 A','protecteur-surge-50-amp','surge','Variante pour un branchement de 50 A; ne remplace pas le modèle de 30 A.'],
  ['smoke_alarm','Détecteur de fumée à pile','detecteur-de-fumee','detectors','Détecteur complet avec pile 9 V incluse. Vérifier les exigences du VR; ne remplace pas un détecteur de propane ou de CO.'],
  ['wheel_lock','Barrure de roue double','cale-roue-a-lunite','chocks','Pour un montage à roues doubles compatible de 16 à 24 po; vérifier les dimensions.'],
  ['levelers','Blocs de nivellement Lynx avec sac','leviers-avec-sac-lynx-levelers-2','chocks','Ensemble de 10 blocs; respecter la charge admissible et le mode d’emploi.',true],
  ['griddle','Plaque de cuisson Martin, 3 brûleurs','plaque-de-cuisson-3-bruleurs','griddles','Option pour cuisiner en camping. Respecter le lieu d’utilisation et le raccord de propane prescrits.'],
  ['chair','Chaise pliante à ressort','chaise-a-ressort-pliante','chairs','Accessoire de camping facultatif; vérifier la variante et la capacité.',true],
  ['hull_cleaner','Nettoyant en gel pour coque de bateau','nettoyant-coque-gel-750ml','cleaning','Pour une coque compatible; vérifier le matériau et suivre les consignes de rinçage.'],
  ['marine_wax','Cire à bateau avec polymère, 500 ml','cire-a-bateau-avec-polymeres-500ml','cleaning','Pour le gelcoat; application à la machine selon la fiche du marchand.'],
  ['pontoon_cleaner','Nettoyant pour tubes de ponton','nettoyant-quille-de-ponton-750-ml','cleaning','Uniquement pour un ponton et des tubes compatibles.'],
  ['inflatable_cleaner','Nettoyant pour bateau et planche gonflable','nettoyant-bateau-et-planche-gonflable-500ml','cleaning','Pour un équipement gonflable en PVC, Hypalon ou vinyle compatible.']
 ].map(([id,label,path,category,note,onOrder=false])=>({id,label,url:ORIGIN+'/produit/'+path+'/',category,note,onOrder,checkedAt:CHECKED}));
 const groups=[
  ['winter','Hivernisation et remisage',['antifreeze','winter_kit','moisture'],['winter','covers']],
  ['water','Eau potable et chauffe-eau',['hose','water_care','water_filter','water_pump'],['hoses','pumps','water_heaters']],
  ['waste','Toilettes et vidange',['aquapods','toilet_paper'],['waste','drain']],
  ['sealing','Étanchéité du VR',['roof_seal','butyl','wall_seal'],['seals']],
  ['cleaning','Lavage, toit et auvent',['microfiber','wash_wax','brush','roof_cleaner','awning_cleaner','slide_lube'],['cleaning','awnings']],
  ['power','Batterie et branchement électrique',['battery_box','disconnect','surge_30','surge_50'],['battery','surge','lights']],
  ['safety','Détecteurs et propane',['smoke_alarm'],['detectors','propane']],
  ['towing','Installation et remorquage',['wheel_lock','levelers'],['chocks','towing','locks']],
  ['camping','Confort et cuisine en camping',['griddle','chair'],['griddles','chairs','shelters','mats','kitchen']],
  ['ventilation','Ventilation et pièces',[],['vents']],
  ['marine','Entretien du bateau',['hull_cleaner','marine_wax','pontoon_cleaner','inflatable_cleaner','microfiber'],[]]
 ].map(([id,label,productIds,categoryIds])=>({id,label,productIds,categoryIds}));
 const rvGroups=groups.filter(g=>g.id!=='marine').map(g=>g.id);
 const equipmentGroups={rv:rvGroups,travel_trailer:rvGroups,boat:['marine'],utility_trailer:['towing']};
 const winter=['antifreeze','winter_kit','moisture','battery_box','roof_seal','wall_seal','microfiber'];
 const spring=['hose','water_care','water_filter','aquapods','toilet_paper','wash_wax','microfiber','surge_30','surge_50','smoke_alarm'];
 // Only known task keys select specialized chemicals or parts. No free-text matching.
 const guideProducts={
  rv_winterize:winter,trailer_winterize:winter,rv_spring:spring,trailer_spring:spring,
  boat_winterize:['hull_cleaner','microfiber'],boat_spring:['hull_cleaner','marine_wax','microfiber'],
  pwc_winterize:['microfiber'],pwc_spring:['microfiber'],
  snowmobile_storage:['microfiber'],motorcycle_storage:['microfiber']
 };
 const byId=new Map(products.map(p=>[p.id,p])),catById=new Map(categories.map(c=>[c.id,c])),groupById=new Map(groups.map(g=>[g.id,g]));
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const external=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 0;overflow-wrap:anywhere">${esc(label)} ↗</a>`;
 function item(p){return `<div class="card hpMerchantProduct" data-hp-product-id="${p.id}" style="margin:8px 0"><b>${esc(p.label)}</b><p class="muted">${esc(p.note)}</p>${p.onOrder?'<p class="muted">Sur commande lors du relevé du 10 septembre 2026; délai à confirmer.</p>':''}${external(p.url,'Voir chez VR Expert')}</div>`}
 function intro(){return '<p class="muted">Suggestions chez VR Expert Jonquière, à choisir selon ton besoin et ton modèle. Tu peux utiliser le matériel que tu possèdes déjà.</p><p class="muted">Catalogue consulté le 10 septembre 2026. Prix, compatibilité et disponibilité à confirmer chez le marchand; stock non synchronisé.</p>'}
 function footer(){return `<p class="muted">Liens commerciaux non rémunérés. Aucun achat n’est effectué dans HomePilot.</p>${external(ORIGIN+'/boutique/','Tout le catalogue VR Expert')}`}
 function selected(ids){return (ids||[]).map(id=>byId.get(id)).filter(Boolean)}
 function categoryLinks(ids){return ids.map(id=>catById.get(id)).filter(Boolean).map(c=>'<div>'+external(c.url,c.label)+'</div>').join('')}
 function renderForGuide(key){
  const rows=selected(Object.hasOwn(guideProducts,key)?guideProducts[key]:[]);if(!rows.length)return '';
  const cats=[...new Set(rows.map(p=>p.category))];
  // A cloth in a motor-vehicle guide must not suggest RV chemicals as substitutes.
  const more=/^(rv|trailer)_/.test(key)?categoryLinks(cats):'';
  return `<details class="card hpVrSuggestions" data-hp-merchant="vr-expert" style="margin:12px 0"><summary style="cursor:pointer;padding:12px 0;font-weight:750">🛒 Trouver les produits · VR Expert Jonquière</summary>${intro()}<h3>Articles utiles pour ce guide</h3><p class="muted">Cette sélection couvre une partie du matériel. Les pièces de remplacement sont à acheter seulement au besoin.</p>${rows.map(item).join('')}${more?'<h4>Autres formats et choix</h4>'+more:''}${footer()}</details>`;
 }
 function renderForEquipment(type){
  const ids=Object.hasOwn(equipmentGroups,type)?equipmentGroups[type]:[];if(!ids.length)return '';
  return `<details class="card hpVrSuggestions" data-hp-merchant="vr-expert" style="margin:12px 0"><summary style="cursor:pointer;padding:12px 0;font-weight:750">🛒 Articles suggérés · VR Expert Jonquière</summary>${intro()}${ids.map(id=>{const g=groupById.get(id);return `<details style="border-top:1px solid var(--line,#ddd);padding:8px 0"><summary style="cursor:pointer;padding:10px 0;font-weight:700">${esc(g.label)}</summary>${selected(g.productIds).map(item).join('')}${categoryLinks(g.categoryIds)}</details>`}).join('')}${footer()}</details>`;
 }
 function forMaterial(material){
  // Detector batteries, pool/spa chemicals and household parts retain their searches.
  return ['Chiffon','Chiffon sec','Chiffon/éponge non abrasive'].includes(material)?byId.get('microfiber'):null;
 }
 window.HomePilotVrShop=Object.freeze({url:ORIGIN+'/boutique/',checkedAt:CHECKED,products,categories,groups,guideProducts,equipmentGroups,renderForGuide,renderForEquipment,forMaterial});
})();
