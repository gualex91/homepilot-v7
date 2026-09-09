const SUPABASE_URL='https://vkfvjwxajgeafzyphjvh.supabase.co';
const SUPABASE_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';

const TASK_RULES={
  thermopompe:[['Nettoyer les filtres de la thermopompe',30,0],['Vérifier l’entretien de la thermopompe',365,30]],
  fournaise:[['Vérifier ou remplacer le filtre de la fournaise',90,0],['Faire vérifier la fournaise',365,30]],
  echangeur:[['Nettoyer les filtres de l’échangeur d’air',90,0],['Nettoyer le noyau de l’échangeur d’air',180,14]],
  chauffeeau:[['Vérifier le chauffe-eau',365,30]],
  cheminee:[['Planifier le ramonage de la cheminée',365,30]],
  piscine:[['Vérifier l’eau de la piscine',7,0],['Nettoyer la piscine et vérifier la filtration',7,0],['Vérifier les produits et équipements de piscine',30,7]],
  spa:[['Vérifier l’eau du spa',7,0],['Nettoyer ou rincer les filtres du spa',30,7],['Vérifier les produits du spa',30,7]],
  fosse:[['Vérifier la date du dernier entretien de la fosse septique',365,30]],
  gouttieres:[['Inspecter et nettoyer les gouttières',180,14]],
  pompe:[['Tester la pompe de puisard',180,14]],
  garage:[['Inspecter et lubrifier la porte de garage',180,14]],
  detecteurs:[['Tester les détecteurs de fumée et CO',30,7]]
};

function isoIn(days){
  const d=new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

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

    const rules=TASK_RULES[equipmentType]||[];
    let tasks=[];
    let taskWarning=null;
    if(rules.length){
      const taskPayload=rules.map(([title,every,lead])=>({
        property_id:propertyId,
        title,
        category:'Entretien',
        due_at:isoIn(lead||Math.min(every,30)),
        status:'todo',
        created_by:user.id,
        notes:`Créée automatiquement par HomePilot pour ${name}. Fréquence indicative : ${every} jours. Vérifier les recommandations du fabricant ou du professionnel.`
      }));
      const tr=await fetch(`${SUPABASE_URL}/rest/v1/tasks`,{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify(taskPayload)
      });
      const taskText=await tr.text();let taskData=null;try{taskData=taskText?JSON.parse(taskText):null}catch{}
      if(tr.ok)tasks=Array.isArray(taskData)?taskData:(taskData?[taskData]:[]);
      else taskWarning=taskData?.message||taskData?.hint||`Erreur Supabase ${tr.status}`;
    }

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,equipment:row,tasks,task_warning:taskWarning});
  }catch(e){
    console.error('property-equipment-add proxy',e);
    if(e?.message==='SESSION')return res.status(401).json({error:'Session expirée. Reconnecte-toi.'});
    return res.status(502).json({error:'Impossible d’ajouter l’équipement pour le moment.'});
  }
}
