(function(){
 const REGIONS=['Bas-Saint-Laurent','Saguenay–Lac-Saint-Jean','Capitale-Nationale','Mauricie','Estrie','Montréal','Outaouais','Abitibi-Témiscamingue','Côte-Nord','Nord-du-Québec','Gaspésie–Îles-de-la-Madeleine','Chaudière-Appalaches','Laval','Lanaudière','Laurentides','Montérégie','Centre-du-Québec'];
 window.HomePilotGeo={country:'CA',province:'QC',provinceName:'Québec',regions:REGIONS,normalizePostalCode:v=>(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^(.{3})(.{1,3}).*$/,'$1 $2').trim(),isQuebecPostalCode:v=>/^[GHJ]\d[A-Z] ?\d[A-Z]\d$/i.test((v||'').trim())};
 function decorate(){
  document.querySelectorAll('input').forEach(i=>{const p=((i.placeholder||'')+' '+(i.previousElementSibling?.textContent||'')).toLowerCase();if((p.includes('code postal')||p.includes('postal'))&&!i.dataset.hpQc){i.dataset.hpQc='1';i.placeholder='Ex. G7H 2B1';i.autocomplete='postal-code';i.addEventListener('blur',()=>{i.value=HomePilotGeo.normalizePostalCode(i.value)})}});
  const propertySection=document.getElementById('pc')||document.getElementById('propertyForm');
  if(propertySection&&!document.getElementById('hpQuebecScope')){const n=document.createElement('div');n.id='hpQuebecScope';n.className='notice';n.style.margin='10px 0';n.innerHTML='<b>📍 Nuvabri Québec</b><br><span class="muted">Cette propriété peut être située partout au Québec. Les tâches, services et professionnels seront adaptés à son emplacement.</span>';propertySection.prepend(n)}
 }
 function exposeRegionSelector(){
  const postal=[...document.querySelectorAll('input')].find(i=>(((i.placeholder||'')+' '+(i.previousElementSibling?.textContent||'')).toLowerCase().includes('postal')));if(!postal||document.getElementById('hpRegion'))return;
  const wrap=document.createElement('div');wrap.id='hpRegionWrap';wrap.innerHTML='<label>Région administrative</label><select id="hpRegion"><option value="">Déterminée selon l’adresse / à préciser</option>'+REGIONS.map(r=>'<option value="'+r+'">'+r+'</option>').join('')+'</select>';
  postal.parentNode.insertBefore(wrap,postal.nextSibling);
 }
 function init(){decorate();exposeRegionSelector();new MutationObserver(()=>{decorate();exposeRegionSelector()}).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();