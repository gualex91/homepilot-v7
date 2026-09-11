import deleteProperty from '../lib/property-delete-handler.js';
const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

export default async function handler(req,res){
  if(req.method==='DELETE')return deleteProperty(req,res);
  if(req.method!=='PATCH')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const id=String(req.query.id||'');
  if(!id)return res.status(400).json({error:'Propriété manquante'});
  const b=req.body||{};
  const payload={
    name:String(b.name||'').trim(),
    property_type:String(b.property_type||'').trim()||null,
    address:String(b.address||'').trim()||null,
    city:String(b.city||'').trim(),
    postal_code:String(b.postal_code||'').trim()||null,
    construction_year:b.construction_year?Number(b.construction_year):null,
    units:b.units?Number(b.units):null,
    updated_at:new Date().toISOString()
  };
  if(!payload.name)return res.status(400).json({error:'Le nom de la propriété est requis.'});
  if(!payload.city)return res.status(400).json({error:'La ville est requise.'});
  if(payload.construction_year && (payload.construction_year<1800||payload.construction_year>2100))return res.status(400).json({error:'Année de construction invalide.'});
  const url=new URL(`${SUPABASE_URL}/rest/v1/properties`);
  url.searchParams.set('id',`eq.${id}`);
  try{
    const r=await fetch(url,{method:'PATCH',headers:{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.hint||`Erreur Supabase ${r.status}`});
    const row=Array.isArray(data)?data[0]:data;
    if(!row)return res.status(404).json({error:'Propriété introuvable ou non autorisée.'});
    return res.status(200).json({ok:true,property:row});
  }catch(e){console.error('property-update proxy',e);return res.status(502).json({error:'Impossible de modifier la propriété pour le moment.'})}
}
