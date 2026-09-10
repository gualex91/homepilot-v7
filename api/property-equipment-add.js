import {stableId, requestId, insertOnce} from '../lib/safe-write.js';
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
  d.setUTCHours(12,0,0,0);
  d.setUTCDate(d.getUTCDate()+days);
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
  if(!requestId(b.request_id))return res.status(400).json({error:'Actualise HomePilot avant de réessayer.'});
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
      id:stableId(user.id+':equipment:'+b.request_id),
      property_id:propertyId,equipment_type:equipmentType,name,
      brand:String(b.brand||'').trim()||null,model:String(b.model||'').trim()||null,
      details:b.details&&typeof b.details==='object'?b.details:{},created_by:user.id
    };
    const row=await insertOnce('equipment',payload,auth);
    if(row.property_id!==propertyId||row.created_by!==user.id||row.name!==name||row.equipment_type!==equipmentType)return res.status(409).json({error:'Cette demande a déjà été enregistrée avec un autre contenu.'});
    // Existing database triggers already create plans for several equipment types.
    // Preserve those plans instead of layering a second set of tasks on top.
    const existingResponse=await fetch(`${SUPABASE_URL}/rest/v1/tasks?equipment_id=eq.${row.id}&select=*`,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
    const existing=await existingResponse.json();
    if(!existingResponse.ok) return res.status(200).json({ok:true,equipment:row,tasks:[],task_warning:'Impossible de vérifier les tâches. Réessaie la même demande.'});
    const generatedByDatabase=existing.some(t=>String(t.source_note||'').startsWith('Généré automatiquement par HomePilot'));
    const rules=generatedByDatabase?[]:(TASK_RULES[equipmentType]||[]);
    const tasksById=new Map(existing.map(task=>[task.id,task]));
    let taskWarning=null;
    if(rules.length){
      const taskPayload=rules.map(([title,every,lead],index)=>({
        id:stableId(row.id+':initial-task:'+index),
        equipment_id:row.id,
        property_id:propertyId,
        title,
        category:'Entretien',
        due_at:isoIn(lead ?? Math.min(every,30)),
        status:'todo',
        created_by:user.id,
        source_note:`Créée automatiquement par HomePilot pour ${name}. Fréquence indicative : ${every} jours. Vérifier les recommandations du fabricant ou du professionnel.`
      }));
      try {
        for(const task of taskPayload){const saved=await insertOnce('tasks',task,auth);tasksById.set(saved.id,saved);}
      } catch(error) { taskWarning=error.message; }

    }

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,equipment:row,tasks:[...tasksById.values()],task_warning:taskWarning});
  }catch(e){
    console.error('property-equipment-add proxy',e);
    if(e?.message==='SESSION')return res.status(401).json({error:'Session expirée. Reconnecte-toi.'});
    return res.status(e.status||502).json({error:e.status===403?'Cette propriété ne permet pas l’ajout d’équipements avec ton compte.':'Impossible d’ajouter l’équipement pour le moment.'});
  }
}
