import {randomUUID} from 'node:crypto';
import {verifiedUser,requestId} from '../lib/safe-write.js';
import {database,paymentsFor,paymentEngine as P} from '../lib/asset-payments.js';
import '../budget-engine.js';
const E=globalThis.hpBudgetEngine;
const conflict=res=>res.status(409).json({error:'Ce paiement a changé. Ferme ce formulaire et rouvre-le avant de réessayer.'});
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','PUT','DELETE'].includes(req.method)){res.setHeader('Allow','GET, PUT, DELETE');return res.status(405).json({error:'Méthode non permise.'})}
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante.'});
 try{
  const user=await verifiedUser(auth),query=database(auth);
  if(req.method==='GET')return res.status(200).json({ok:true,payments:await paymentsFor(query,user.id),user_id:user.id});
  const b=req.body||{},field=b.kind==='property'?'property_id':b.kind==='leisure'?'leisure_equipment_id':null;
  if(!field||!requestId(b.asset_id)||!requestId(b.request_id)||(b.expected_revision!==null&&!requestId(b.expected_revision)))return res.status(400).json({error:'Paiement invalide. Rouvre sa fiche.'});
  const own=[['user_id','eq.'+user.id],[field,'eq.'+b.asset_id]];
  let current=(await query('asset_payments',own))[0];
  if(req.method==='DELETE'){
   if(current){
    if(current.revision!==b.expected_revision)return conflict(res);
    const removed=await query('asset_payments',[...own,['revision','eq.'+b.expected_revision]],{method:'DELETE',headers:{Prefer:'return=representation'}});
    if(!removed.length&&(await query('asset_payments',own)).length)return conflict(res);
   }
   return res.status(200).json({ok:true,payment:null,payments:await paymentsFor(query,user.id),user_id:user.id});
  }
  let fields;
  try{
   if(!Object.hasOwn(P.frequencies,b.frequency)||typeof b.amount!=='number'||b.amount<=0)throw new Error('Entre un paiement supérieur à zéro.');
   const checked=E.validate({...E.empty(),bills:[{id:'check',label:'Paiement',category:'Autre',amount:b.amount,frequency:b.frequency,anchorDate:b.anchor_date,secondDay:b.second_day,essential:b.essential===true}]}).bills[0];
   fields={amount:checked.amount,frequency:checked.frequency,anchor_date:checked.anchorDate,second_day:checked.secondDay,essential:checked.essential};
  }catch(e){return res.status(400).json({error:e.message})}
  const matches=row=>row?.revision===b.request_id&&Object.entries(fields).every(([key,v])=>key==='amount'?Number(row[key])===v:row[key]===v);
  if(!matches(current)){
   if((current?.revision??null)!==b.expected_revision)return conflict(res);
   const table=field==='property_id'?'properties':'leisure_equipment';
   const asset=await query(table,[['id','eq.'+b.asset_id],['select','id'],...(table==='leisure_equipment'?[['user_id','eq.'+user.id]]:[])]);
   if(!asset.length)return res.status(404).json({error:'Ce bien n’est plus disponible.'});
   const payload={...fields,revision:b.request_id,updated_at:new Date().toISOString()};
   const rows=current?await query('asset_payments',[...own,['revision','eq.'+b.expected_revision]],{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}):await query('asset_payments',[['on_conflict','user_id,'+field]],{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({...payload,id:randomUUID(),user_id:user.id,[field]:b.asset_id})});
   current=rows[0]||(await query('asset_payments',own))[0];if(!matches(current))return conflict(res);
  }
  return res.status(200).json({ok:true,payment:current,payments:await paymentsFor(query,user.id),user_id:user.id});
 }catch(e){return res.status(e.status===401?401:503).json({error:e.status===401?'Session expirée. Reconnecte-toi.':'Paiement non confirmé. Tes montants restent dans le formulaire; réessaie.'})}
}
