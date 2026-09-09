const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';
const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function locationMatch(p,{city,postal,region}){
  if(p.serves_all_quebec)return true;
  const c=norm(city),pc=norm(postal).replace(/\s/g,''),r=norm(region);
  return (p.municipalities||[]).some(x=>norm(x)===c)||(p.postal_prefixes||[]).some(x=>pc.startsWith(norm(x).replace(/\s/g,'')))||(p.regions||[]).some(x=>norm(x)===r);
}
function tierRank(t){return t==='sponsored'?3:t==='partner'?2:1}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const category=String(req.query.category||'general');
  const city=String(req.query.city||''),postal=String(req.query.postal||''),region=String(req.query.region||'');
  const url=new URL(`${SUPABASE_URL}/rest/v1/professional_profiles`);
  url.searchParams.set('select','id,business_name,category,phone,email,website,verification_status,listing_tier,regions,municipalities,postal_prefixes,serves_all_quebec,description');
  url.searchParams.set('active','eq.true');
  if(category&&category!=='general')url.searchParams.set('category',`eq.${category}`);
  try{
    const r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.hint||`Erreur Supabase ${r.status}`});
    const rows=(Array.isArray(data)?data:[])
      .filter(p=>/[A-Za-zÀ-ÿ]/.test(p.business_name||''))
      .filter(p=>locationMatch(p,{city,postal,region}))
      .sort((a,b)=>tierRank(b.listing_tier)-tierRank(a.listing_tier));
    return res.status(200).json({ok:true,rows});
  }catch(e){console.error('professionals proxy',e);return res.status(502).json({error:'Impossible de charger le répertoire.'})}
}
