import {createHash} from 'node:crypto';
export const URL_BASE='https://vkfvjwxajgeafzyphjvh.supabase.co';
export const PUBLIC_KEY='sb_publishable_pGyXnrUDdLiT6BAAME--VA_kLP_gEAR';
export function stableId(value){
  const h=createHash('sha256').update(value).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function requestId(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)}
export async function verifiedUser(auth){
  const r=await fetch(`${URL_BASE}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:auth}});
  const data=await r.json();
  if(!r.ok||!data?.id)throw Object.assign(new Error('Session expirée. Reconnecte-toi.'),{status:401});
  return data;
}
// INSERT ... ON CONFLICT DO NOTHING; never overwrite a previous successful write.
// All requests retain the user's JWT and therefore the existing RLS policies.
export async function insertOnce(table,payload,auth){
  const headers={apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'};
  const r=await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=id`,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(payload)});
  const data=await r.json();
  if(!r.ok)throw Object.assign(new Error(data?.message||'Sauvegarde impossible.'),{status:r.status});
  if(data?.[0])return data[0];
  const q=await fetch(`${URL_BASE}/rest/v1/${table}?id=eq.${payload.id}&select=*`,{headers});
  const rows=await q.json();
  if(!q.ok||!rows?.[0])throw new Error('Sauvegarde non confirmée. Réessaie sans changer le formulaire.');
  return rows[0];
}
