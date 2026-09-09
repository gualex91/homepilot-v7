const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

async function getUser(auth){
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data?.id)throw new Error('SESSION');
  return data;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const b=req.body||{};
  const propertyId=String(b.property_id||'').trim();
  const equipmentType=String(b.equipment_type||'').trim();
  const name=String(b.name||'').trim();
  if(!propertyId)return res.status(400).json({error:'Propriété manquante'});
  if(!equipmentType)return res.status(400).json({error:'Type d’équipement manquant'});
  if(!name)return res.status(400).json({error:'Nom de l’équipement requis'});

  try{
    const user=await getUser(auth);

    const checkUrl=new URL(`${SUPABASE_URL}/rest/v1/properties`);
    checkUrl.searchParams.set('select','id');
    checkUrl.searchParams.set('id',`eq.${propertyId}`);
    const check=await fetch(checkUrl,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
    const checkData=await check.json().catch(()=>[]);
    if(!check.ok)return res.status(check.status).json({error:checkData?.message||'Impossible de vérifier la propriété.'});
    if(!Array.isArray(checkData)||!checkData.length)return res.status(404).json({error:'Propriété introuvable ou non autorisée.'});

    const payload={
      property_id:propertyId,
      equipment_type:equipmentType,
      name,
      brand:String(b.brand||'').trim()||null,
      model:String(b.model||'').trim()||null,
      details:b.details&&typeof b.details==='object'?b.details:{},
      created_by:user.id
    };

    const r=await fetch(`${SUPABASE_URL}/rest/v1/equipment`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify(payload)
    });
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return res.status(r.status).json({error:data?.message||data?.hint||`Erreur Supabase ${r.status}`});
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.id)return res.status(500).json({error:'L’équipement n’a pas été confirmé par le serveur.'});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,equipment:row});
  }catch(e){
    console.error('property-equipment-add proxy',e);
    if(e?.message==='SESSION')return res.status(401).json({error:'Session expirée. Reconnecte-toi.'});
    return res.status(502).json({error:'Impossible d’ajouter l’équipement pour le moment.'});
  }
}
