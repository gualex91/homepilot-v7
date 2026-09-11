import {URL_BASE,PUBLIC_KEY} from './safe-write.js';
import '../asset-payment-engine.js';
export const paymentEngine=globalThis.hpAssetPaymentEngine;
export function database(auth){
 return async function query(table,params=[],options={}){
  const url=new URL(URL_BASE+'/rest/v1/'+table);for(const [key,value] of params)url.searchParams.append(key,value);
  const r=await fetch(url,{...options,headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Object.assign(new Error('La sauvegarde n’a pas été confirmée. Réessaie.'),{status:r.status});
  if(!Array.isArray(data))throw new Error('Réponse non confirmée. Réessaie.');return data;
 };
}
export async function paymentsFor(query,userId){
 const rows=[];
 for(let offset=0;offset<=500;offset+=100){
  const page=await query('asset_payments',[['user_id','eq.'+userId],['select','*,properties(name),leisure_equipment(name)'],['order','id.asc'],['offset',String(offset)],['limit','100']]);
  rows.push(...page);if(rows.length>500)throw new Error('Trop de paiements liés.');if(page.length<100)break;
 }
 return rows.map(row=>({...row,asset_name:row.properties?.name||row.leisure_equipment?.name||'Bien indisponible',properties:undefined,leisure_equipment:undefined}));
}
