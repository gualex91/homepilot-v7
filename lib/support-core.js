import {createHmac, timingSafeEqual} from 'node:crypto';
import {URL_BASE, PUBLIC_KEY, requestId} from './safe-write.js';

export const categories=['technical','suggestion','partner','privacy','financial','billing','other'];
export const priorities=['normal','high'];
export const statuses=['new','review','waiting','closed'];
export function fail(status,message){return Object.assign(new Error(message),{status})}
export function text(value,max,required=false){
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw fail(400,'Texte manquant ou trop long.');
  return value.replace(/\u0000/g,'').trim();
}
export function email(value){
  if(typeof value!=='string'||value.length>254||! /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(value))throw fail(400,'Adresse courriel invalide.');
  return value.toLowerCase();
}
export function mailbox(value){
  const raw=String(value||'');
  if(/[\r\n]/.test(raw))throw fail(400,'Adresse invalide.');
  const match=raw.match(/<([^<>]+)>\s*$/);
  return email(match?match[1]:raw);
}
export function uuid(value){if(!requestId(value))throw fail(400,'Identifiant invalide.');return value}
export function triage(subject,body){
  const s=(subject+' '+body).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rules=[['privacy',/confidential|donnees personnelles|supprim.*compte|effac|pirat|fuite|privacy|delete.*account/],['financial',/conseil.*financ|assurance|placement|reer|celi|invest|insurance|financial advice/],['billing',/rembours|factur|prelevement|paiement|refund|billing/],['partner',/partenair|commandit|commerce|partner|sponsor/],['technical',/erreur|bug|connexion|connecter|mot de passe|ne marche|impossible|error|password/],['suggestion',/suggestion|amelior|ajout|fonctionnalite|feature request/]];
  const category=rules.find(([,re])=>re.test(s))?.[0]||'other';
  const sensitive=['privacy','financial','billing'].includes(category)||/plainte|avocat|legal|complaint/.test(s);
  return {category,priority:sensitive?'high':'normal',sensitive,summary:body.replace(/\s+/g,' ').slice(0,240),analysis_source:'rules'};
}
export function configuration(env=process.env){
  // A preview may share production settings; never contact email/AI providers there.
  const preview=env.VERCEL_ENV==='preview';
  const addresses=String(env.SUPPORT_INBOX_ADDRESSES||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  let valid=false;try{valid=addresses.length>0&&addresses.every(x=>email(x))}catch{}
  let from=false;try{from=!!email(env.SUPPORT_FROM_EMAIL)}catch{}
  return {receiving:!!(!preview&&env.SUPPORT_RECEIVE_ENABLED==='true'&&env.RESEND_API_KEY&&env.RESEND_WEBHOOK_SECRET&&env.SUPABASE_SERVICE_ROLE_KEY&&valid),
    sending:!!(!preview&&env.SUPPORT_SEND_ENABLED==='true'&&env.RESEND_API_KEY&&from),
    ai:!!(!preview&&env.SUPPORT_AI_ENABLED==='true'&&env.OPENAI_API_KEY&&env.SUPPORT_AI_MODEL),
    addresses:valid?addresses:[],from:from?env.SUPPORT_FROM_EMAIL:null};
}
export async function fetchJSON(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  let data;try{data=await r.json()}catch{data=null}
  if(!r.ok)throw fail(r.status===401?401:r.status===403?403:r.status===409?409:502,'Le service ne confirme pas cette opération. Réessaie ou vérifie sa configuration.');
  return data;
}
export async function db(path,auth,options={}){
  return fetchJSON(`${URL_BASE}/rest/v1/${path}`,{...options,headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});
}
export async function admin(req){
  const auth=req.headers?.authorization;
  if(typeof auth!=='string'||!auth.startsWith('Bearer '))throw fail(401,'Reconnecte-toi pour accéder aux messages.');
  const user=await fetchJSON(`${URL_BASE}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:auth}});
  if(!requestId(user?.id))throw fail(401,'Session invalide.');
  const rows=await db(`admin_users?user_id=eq.${user.id}&select=user_id`,auth);
  if(!rows?.some(r=>r.user_id===user.id))throw fail(403,'Accès réservé aux administrateurs.');
  return {auth,user};
}
export function bodyJSON(req){
  let body=req.body;
  if(typeof body==='string'){if(Buffer.byteLength(body)>40000)throw fail(413,'Message trop volumineux.');try{body=JSON.parse(body)}catch{throw fail(400,'Requête invalide.')}}
  if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>40000)throw fail(400,'Requête invalide.');
  return body;
}
export function verifyWebhook(raw,headers,secret,now=Date.now()){
  const id=headers['svix-id'],ts=headers['svix-timestamp'],signature=headers['svix-signature'];
  if(typeof id!=='string'||typeof ts!=='string'||!/^\d+$/.test(ts)||typeof signature!=='string'||Math.abs(now/1000-Number(ts))>300||!secret?.startsWith('whsec_'))throw fail(401,'Signature invalide.');
  const key=Buffer.from(secret.slice(6),'base64');
  if(key.length<16)throw fail(503,'Signature non configurée.');
  const expected=createHmac('sha256',key).update(`${id}.${ts}.${raw}`).digest();
  const valid=signature.split(' ').some(s=>{const [v,b64]=s.split(',');const b=Buffer.from(b64||'','base64');return v==='v1'&&b.length===expected.length&&timingSafeEqual(b,expected)});
  if(!valid)throw fail(401,'Signature invalide.');
  try{return JSON.parse(raw)}catch{throw fail(400,'Événement invalide.')}
}
// Best-effort minimisation, not anonymisation. No account data, HTML, attachments or sender identity.
export function aiInput(ticket){
  return (ticket.subject+'\n'+ticket.body_text).slice(0,8000)
    .replace(/https?:\/\/\S+/gi,'[lien retiré]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[courriel retiré]')
    .replace(/\b\d[\d ()+.-]{6,}\d\b/g,'[numéro retiré]');
}
