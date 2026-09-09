const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

async function getJson(url,auth){
  const r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{}
  if(!r.ok)throw new Error(data?.message||data?.hint||`Erreur Supabase ${r.status}`);
  return data;
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const id=String(req.query.id||'');
  if(!/^[0-9a-fA-F-]{36}$/.test(id))return res.status(400).json({error:'Propriété invalide'});
  try{
    const base=`${SUPABASE_URL}/rest/v1`;
    const [props,equipment,tasks]=await Promise.all([
      getJson(`${base}/properties?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,auth),
      getJson(`${base}/equipment?select=*&property_id=eq.${encodeURIComponent(id)}&order=created_at.asc`,auth),
      getJson(`${base}/tasks?select=*&property_id=eq.${encodeURIComponent(id)}&order=due_at.asc`,auth)
    ]);
    const property=Array.isArray(props)?props[0]:null;
    if(!property)return res.status(404).json({error:'Propriété introuvable'});
    return res.status(200).json({ok:true,property,equipment:Array.isArray(equipment)?equipment:[],tasks:Array.isArray(tasks)?tasks:[]});
  }catch(e){
    console.error('property-details proxy',e);
    return res.status(502).json({error:e?.message||'Impossible de charger la propriété.'});
  }
}
