const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const id=String(req.body?.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Entrée invalide'});
  const url=new URL(`${SUPABASE_URL}/rest/v1/budget_entries`);
  url.searchParams.set('id',`eq.${id}`);
  try{
    const r=await fetch(url,{method:'DELETE',headers:{'apikey':SUPABASE_KEY,'Authorization':auth,'Prefer':'return=representation'}});
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){const msg=data?.message||data?.error_description||data?.hint||`Erreur Supabase ${r.status}`;return res.status(r.status).json({error:msg,code:data?.code||null})}
    const rows=Array.isArray(data)?data:[];
    if(!rows.length)return res.status(404).json({error:'Entrée introuvable ou non autorisée'});
    return res.status(200).json({ok:true,id:rows[0]?.id||id});
  }catch(e){console.error('budget-delete proxy',e);return res.status(502).json({error:'Le serveur HomePilot ne peut pas supprimer cette entrée.'})}
}
