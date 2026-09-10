import {stableId, requestId, insertOnce, verifiedUser} from '../lib/safe-write.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non permise'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const b=req.body||{};
  const amount=Number(b.amount);
  if(!Number.isFinite(amount)||!(amount>0))return res.status(400).json({error:'Montant invalide'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.entry_date||''))return res.status(400).json({error:'Date manquante'});
  if(!requestId(b.request_id))return res.status(400).json({error:'Actualise HomePilot avant de réessayer.'});
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
    const user=await verifiedUser(auth);
    payload.user_id=user.id;
    payload.id=stableId(user.id+':budget:'+b.request_id);
    const row=await insertOnce('budget_entries',payload,auth);
    const same=['user_id','household_id','property_id','entry_type','category','entry_date','description'].every(k=>(row[k]??null)===(payload[k]??null))&&Number(row.amount)===amount;
    if(!same)return res.status(409).json({error:'Cette demande a déjà été enregistrée avec un autre contenu.'});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,id:row.id});
  }catch(e){
    console.error('budget-entry proxy',e);
    return res.status(e.status||502).json({error:e.status===401?'Session expirée. Reconnecte-toi.':e.status===403?'Cette sauvegarde n’est pas autorisée.':'Le serveur HomePilot ne peut pas enregistrer cette entrée.'});
  }
}
