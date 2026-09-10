import {directoryRegion,preferredProfessionalId,eligiblePriority,rankProfessionals} from '../lib/directory-priority.js';
const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';
const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const inferredRegion=(city,region,postal)=>directoryRegion({city,region,postal});
function cityMatch(profileCity,userCity){
  const a=norm(profileCity),b=norm(userCity);
  if(!a||!b)return false;
  return a===b||a.includes(b)||b.includes(a)||(b.includes('jonquiere')&&a==='saguenay')||(b.includes('chicoutimi')&&a==='saguenay')||(b.includes('la baie')&&a==='saguenay');
}
function locationMatch(p,{city,postal,region}){
  if(p.serves_all_quebec)return true;
  const c=norm(city),pc=norm(postal).replace(/\s/g,''),r=norm(inferredRegion(city,region,postal));
  return (p.municipalities||[]).some(x=>cityMatch(x,c))||(p.postal_prefixes||[]).some(x=>{const prefix=norm(x).replace(/\s/g,'');return !!pc&&!!prefix&&pc.startsWith(prefix)})||(p.regions||[]).some(x=>r&&norm(x)===r);
}
async function preferredProfile(id,fields,auth,context){
  const url=new URL(`${SUPABASE_URL}/rest/v1/professional_profiles`);
  url.search=new URLSearchParams({select:fields,id:'eq.'+id,active:'eq.true',directory_issues:'eq.{}',category:'eq.electrical',limit:'1'}).toString();
  if(context.service)url.searchParams.set('service_categories','cs.{'+context.service+'}');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1800);
  try{
    const r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:controller.signal});
    if(!r.ok)return null;
    const data=await r.json(),profile=Array.isArray(data)?data[0]:null;
    return profile&&eligiblePriority(profile,context)&&locationMatch(profile,context)?profile:null;
  }catch{return null}finally{clearTimeout(timer)}
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const category=String(req.query.category||'general');
  const service=String(req.query.service||'');
  const city=String(req.query.city||''),postal=String(req.query.postal||''),region=String(req.query.region||'');
  const context={category,service,city,postal,region:inferredRegion(city,region,postal)};
  const url=new URL(`${SUPABASE_URL}/rest/v1/rpc/search_directory_professionals`);
  url.searchParams.set('select','id,business_name,category,phone,email,website,listing_tier,regions,municipalities,postal_prefixes,serves_all_quebec,description,service_categories,source,source_reference,rbq_license,imported_at,directory_issues,active');
  for(const [key,value] of Object.entries({p_category:category,p_service:service,p_city:city,p_postal:postal,p_region:context.region}))url.searchParams.set(key,value);
  url.searchParams.set('active','eq.true');
  url.searchParams.set('directory_issues','eq.{}');
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    let r;
    try{r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:controller.signal})}
    finally{clearTimeout(timer)}
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.hint||`Erreur Supabase ${r.status}`});
    const all=(Array.isArray(data)?data:[]).filter(p=>p.active===true&&Array.isArray(p.directory_issues)&&p.directory_issues.length===0);
    const candidates=all.filter(p=>locationMatch(p,context)),preferred=preferredProfessionalId(context);
    // The RPC limits to 120 before this sort. Fetch the specific eligible profile
    // if it fell outside that page, using the same user token and quality gates.
    if(preferred&&!candidates.some(p=>p.id===preferred)){
      const profile=await preferredProfile(preferred,url.searchParams.get('select'),auth,context);
      if(profile)candidates.push(profile);
    }
    const rows=rankProfessionals(candidates,context).slice(0,120);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,rows,service:service||null,city,region:context.region});
  }catch(e){
    if(e?.name==='AbortError')return res.status(504).json({error:'La recherche prend trop de temps. Réessaie.'});
    console.error('professionals proxy',e);return res.status(502).json({error:'Impossible de charger le répertoire.'})
  }
}
