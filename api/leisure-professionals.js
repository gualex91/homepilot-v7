const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';
const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—-]+/g,'-').replace(/\s+/g,' ').trim();
function inferredRegion(city,region){
  if(region)return region;
  const c=norm(city);
  if(['jonquiere','chicoutimi','la baie','saguenay','alma'].some(x=>c.includes(x)))return 'Saguenay-Lac-Saint-Jean';
  return '';
}
function sameRegion(a,b){
  const x=norm(a).replace(/-/g,' '),y=norm(b).replace(/-/g,' ');
  return !!x&&!!y&&x===y;
}
function locMatch(p,city,region){
  const c=norm(city),r=inferredRegion(city,region);
  if(c&&norm(p.city)===c)return true;
  if(r&&sameRegion(p.region,r))return true;
  if(r&&(p.service_area||[]).some(x=>sameRegion(x,r)))return true;
  return false;
}
function score(p,city,region){
  let s=Number(p.priority_weight||0);
  const c=norm(city),r=inferredRegion(city,region);
  if(c&&norm(p.city)===c)s+=300;
  if(r&&sameRegion(p.region,r))s+=180;
  if(r&&(p.service_area||[]).some(x=>sameRegion(x,r)))s+=120;
  if(p.partner)s+=40;if(p.sponsored)s+=80;
  return s;
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const category=String(req.query.category||'').trim();
  const city=String(req.query.city||'').trim();
  const region=String(req.query.region||'').trim();
  if(!category)return res.status(400).json({error:'Catégorie manquante'});
  const url=new URL(`${SUPABASE_URL}/rest/v1/rpc/search_directory_leisure`);
  url.searchParams.set('select','id,business_name,categories,city,region,phone,website,online_store,service_area,partner,sponsored,active,services,brands,priority_weight,source,directory_issues');
  for(const [key,value] of Object.entries({p_category:category,p_city:city,p_region:region}))url.searchParams.set(key,value);
  url.searchParams.set('active','eq.true');
  url.searchParams.set('directory_issues','eq.{}');
  try{
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),4500);
    let r;try{r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},signal:c.signal,cache:'no-store'})}finally{clearTimeout(timer)}
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||`Erreur ${r.status}`});
    let rows=(Array.isArray(data)?data:[]).filter(p=>p.active===true&&Array.isArray(p.directory_issues)&&p.directory_issues.length===0&&locMatch(p,city,region));
    rows.sort((a,b)=>score(b,city,region)-score(a,city,region)||String(a.business_name).localeCompare(String(b.business_name),'fr'));
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(200).json({ok:true,rows:rows.slice(0,25),category,city,region:inferredRegion(city,region)});
  }catch(e){
    if(e?.name==='AbortError')return res.status(504).json({error:'La recherche prend trop de temps. Réessaie.'});
    return res.status(502).json({error:'Impossible de charger le répertoire loisirs.'});
  }
}
