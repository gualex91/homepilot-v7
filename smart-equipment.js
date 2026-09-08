(function(){
  function byValue(v){return [...document.querySelectorAll('input[name="propertyEquip"]')].find(x=>x.value===v)}
  function ensureSmartUI(){
    const host=document.getElementById('propertyEquipChoices');
    if(!host||document.getElementById('poolConfig')) return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`
      <div id="poolConfig" class="hidden" style="margin-top:12px"><hr><b>🏊 Détails de la piscine</b>
        <label>Type</label><select id="poolType"><option value="hors_terre">Hors terre</option><option value="creusee">Creusée</option></select>
        <label>Grandeur</label><select id="poolSize"><option>12 pi ronde</option><option>15 pi ronde</option><option>18 pi ronde</option><option>21 pi ronde</option><option>24 pi ronde</option><option>27 pi ronde</option><option>30 pi ronde</option><option>12 x 24 pi</option><option>15 x 30 pi</option><option>16 x 32 pi</option><option>18 x 36 pi</option><option>Autre</option></select>
        <label>Filtration</label><select id="poolFilter"><option>Sable</option><option>Cartouche</option><option>Terre de diatomées (DE)</option><option>Autre</option></select>
        <label>Traitement</label><select id="poolTreatment"><option>Chlore</option><option>Sel</option><option>Autre</option></select>
      </div>
      <div id="spaConfig" class="hidden" style="margin-top:12px"><hr><b>♨️ Détails du spa</b>
        <label>Grandeur</label><select id="spaSize"><option>2 à 3 places</option><option>4 à 5 places</option><option>6 à 7 places</option><option>8 places et plus</option></select>
        <label>Traitement</label><select id="spaTreatment"><option>Brome</option><option>Chlore</option><option>Autre</option></select>
        <label>Utilisation</label><select id="spaUsage"><option value="frequente">Fréquente</option><option value="occasionnelle">Occasionnelle</option></select>
      </div>`;
    host.insertAdjacentElement('afterend',wrap);
    document.querySelectorAll('input[name="propertyEquip"]').forEach(x=>x.addEventListener('change',sync));
    sync();
  }
  function sync(){
    const p=document.getElementById('poolConfig'),s=document.getElementById('spaConfig');
    if(p)p.classList.toggle('hidden',!byValue('piscine')?.checked);
    if(s)s.classList.toggle('hidden',!byValue('spa')?.checked);
  }
  function details(key){
    if(key==='piscine')return {type:poolType.value,size:poolSize.value,filter:poolFilter.value,treatment:poolTreatment.value};
    if(key==='spa')return {size:spaSize.value,treatment:spaTreatment.value,usage:spaUsage.value};
    return {};
  }
  function overrideCreate(){
    if(typeof window.createProperty!=='function'||window.__smartPropertyOverride)return;
    window.__smartPropertyOverride=true;
    window.createProperty=async function(){
      if(!household)return alert('Crée d’abord ton foyer.');
      const name=pName.value.trim();if(!name)return alert('Donne un nom à la propriété.');
      const selected=[...document.querySelectorAll('input[name="propertyEquip"]:checked')].map(x=>x.value);
      createPropertyBtn.disabled=true;createPropertyBtn.textContent='Création…';
      const r=await sb.from('properties').insert({household_id:household.id,name,property_type:pType.value,city:pCity.value.trim(),postal_code:pPostal.value.trim(),construction_year:pYear.value?Number(pYear.value):null,created_by:user.id}).select().single();
      if(r.error){createPropertyBtn.disabled=false;createPropertyBtn.textContent='Créer ma propriété';return alert(r.error.message)}
      if(selected.length){
        const rows=selected.map(key=>{const meta=equipmentCatalog.find(x=>x[0]===key);return {property_id:r.data.id,equipment_type:key,name:meta?meta[1].replace(/^[^ ]+ /,''):key,details:details(key),created_by:user.id}});
        const eq=await sb.from('equipment').insert(rows);
        if(eq.error){createPropertyBtn.disabled=false;createPropertyBtn.textContent='Créer ma propriété';return alert('La propriété a été créée, mais certains équipements n’ont pas pu être ajoutés : '+eq.error.message)}
      }
      propertyForm.classList.add('hidden');
      if(typeof resetPropertyForm==='function')resetPropertyForm();
      await loadAll();activeProperty=properties.find(x=>x.id===r.data.id)||r.data;await loadPropertyData();render();show('home');
      createPropertyBtn.disabled=false;createPropertyBtn.textContent='Créer ma propriété';
    }
  }
  function init(){ensureSmartUI();overrideCreate();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(init,500);
})();