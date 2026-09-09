const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';
const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function inferredRegion(city,region){
  if(region)return region;
  const c=norm(city);
  if(['jonquiere','chicoutimi','la baie','saguenay','alma'].some(x=>c.includes(x)))return 'Saguenay–Lac-Saint-Jean';
  return '';
}
function locMatch(p,city,region){
  const c=norm(city),r=norm(inferredRegion(city,region));
  if(c&&norm(p.city)===c)return true;
  if(r&&norm(p.region)===r)return true;
  if(r&&(p.service_area||[]).some(x=>norm(x)===r))return true;
  return false;
}
function score(p,city,region){
  let s=Number(p.priority_weight||0);
  const c=norm(city),r=norm(inferredRegion(city,region));
  if(c&&norm(p.city)===c)s+=300;
  if(r&&norm(p.region)===r)s+=180;
  if(r&&(p.service_area||[]).some(x=>norm(x)===r))s+=120;
  if(p.verified)s+=60;if(p.partner)s+=40;if(p.sponsored)s+=80;
  return s;
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const category=String(req.query.category||'').trim();
  const city=String(req.query.city||'').trim();
  const region=String(req.query.region||'').trim();
  if(!category)return res.status(400).json({error:'Catégorie manquante'});
  const url=new URL(`${SUPABASE_URL}/rest/v1/leisure_professionals`);
  url.searchParams.set('select','id,business_name,categories,city,region,phone,website,online_store,service_area,partner,sponsored,active,services,brands,verified,priority_weight');
  url.searchParams.set('active','eq.true');
  url.searchParams.set('categories',`cs.{${category}}`);
  url.searchParams.set('limit','120');
  try{
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),5000);
    let r;try{r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:c.signal})}finally{clearTimeout(timer)}
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||`Erreur ${r.status}`});
    let rows=(Array.isArray(data)?data:[]).filter(p=>locMatch(p,city,region));
    rows.sort((a,b)=>score(b,city,region)-score(a,city,region)||String(a.business_name).localeCompare(String(b.business_name),'fr'));
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,rows:rows.slice(0,25),category,city,region:inferredRegion(city,region)});
  }catch(e){
    if(e?.name==='AbortError')return res.status(504).json({error:'La recherche prend trop de temps. Réessaie.'});
    return res.status(502).json({error:'Impossible de charger le répertoire loisirs.'});
  }
}
