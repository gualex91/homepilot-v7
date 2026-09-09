const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const b=req.body||{};
  const amount=Number(b.amount);
  if(!(amount>0))return res.status(400).json({error:'Montant invalide'});
  if(!b.entry_date)return res.status(400).json({error:'Date manquante'});
  if(!b.user_id)return res.status(400).json({error:'Utilisateur manquant'});
  const payload={
    user_id:b.user_id,
    household_id:b.household_id||null,
    property_id:b.property_id||null,
    entry_type:b.entry_type==='income'?'income':'expense',
    category:String(b.category||'Autre'),
    amount,
    entry_date:b.entry_date,
    description:b.description?String(b.description):null
  };
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/budget_entries`,{
      method:'POST',
      headers:{
        'apikey':SUPABASE_KEY,
        'Authorization':auth,
        'Content-Type':'application/json',
        'Prefer':'return=representation'
      },
      body:JSON.stringify(payload)
    });
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){
      const msg=data?.message||data?.error_description||data?.hint||`Erreur Supabase ${r.status}`;
      return res.status(r.status).json({error:msg,code:data?.code||null});
    }
    const row=Array.isArray(data)?data[0]:data;
    return res.status(200).json({ok:true,id:row?.id||null});
  }catch(e){
    console.error('budget-entry proxy',e);
    return res.status(502).json({error:'Le serveur HomePilot ne peut pas joindre la base de données.'});
  }
}
