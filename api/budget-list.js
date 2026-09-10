const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const start=String(req.query.start||'');
  const end=String(req.query.end||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return res.status(400).json({error:'Période invalide'});
  const url=new URL(`${SUPABASE_URL}/rest/v1/budget_entries`);
  url.searchParams.set('select','id,user_id,household_id,property_id,entry_type,category,amount,entry_date,description,properties(name)');
  url.searchParams.set('entry_date',`gte.${start}`);
  url.searchParams.append('entry_date',`lte.${end}`);
  url.searchParams.set('order','entry_date.desc,created_at.desc');
  try{
    const r=await fetch(url,{headers:{'apikey':SUPABASE_KEY,'Authorization':auth}});
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){const msg=data?.message||data?.error_description||data?.hint||`Erreur Supabase ${r.status}`;return res.status(r.status).json({error:msg,code:data?.code||null})}
    return res.status(200).json({ok:true,rows:Array.isArray(data)?data:[]});
  }catch(e){console.error('budget-list proxy',e);return res.status(502).json({error:'Le serveur Nuvabri ne peut pas lire le budget.'})}
}
