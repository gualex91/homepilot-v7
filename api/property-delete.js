import {verifiedUser,requestId} from '../lib/safe-write.js';
import {database} from '../lib/asset-payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='DELETE'){res.setHeader('Allow','DELETE');return res.status(405).json({error:'Méthode non permise.'})}
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante.'});
 const id=req.query?.id;if(!requestId(id))return res.status(400).json({error:'Propriété invalide.'});
 try{
  await verifiedUser(auth);const query=database(auth),filter=[['id','eq.'+id]];
  // Existing household-manager DELETE policy and FK cascades remain authoritative.
  const rows=await query('properties',filter,{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows.some(x=>x.id===id)&&(await query('properties',[...filter,['select','id']])).length)return res.status(403).json({error:'Seul un responsable autorisé du foyer peut supprimer cette propriété.'});
  return res.status(200).json({ok:true,id});
 }catch(e){return res.status(e.status===401?401:503).json({error:e.status===401?'Session expirée. Reconnecte-toi.':'La suppression n’a pas été confirmée. Réessaie.'})}
}
