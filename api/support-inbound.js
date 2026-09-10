import {URL_BASE} from '../lib/safe-write.js';
import {configuration,verifyWebhook,fetchJSON,uuid,mailbox,triage,fail} from '../lib/support-core.js';
export const config={api:{bodyParser:false}};
export async function rawBody(req){
  if(typeof req.body==='string'||Buffer.isBuffer(req.body)){if(Buffer.byteLength(req.body)>262144)throw fail(413,'Événement trop volumineux.');return req.body.toString()}
  if(req.body)throw fail(400,'Corps brut requis.');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>262144)throw fail(413,'Événement trop volumineux.');chunks.push(Buffer.from(chunk))}
  return Buffer.concat(chunks).toString('utf8');
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non permise.'});
  try{
    const c=configuration();if(!c.receiving)throw fail(503,'Réception non activée.');
    const event=verifyWebhook(await rawBody(req),req.headers,process.env.RESEND_WEBHOOK_SECRET);
    if(event.type!=='email.received')return res.status(200).json({ignored:true});
    const id=uuid(event.data?.email_id);
    const mail=await fetchJSON(`https://api.resend.com/emails/receiving/${id}`,{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`}});
    const recipients=(mail.to||[]).map(mailbox),to=recipients.find(x=>c.addresses.includes(x));
    if(!to)return res.status(200).json({ignored:true});
    const subject=String(mail.subject||'Sans objet').replace(/[\r\n\u0000]/g,' ').slice(0,240);
    // Never render remote HTML/images, execute attachments, or follow links from incoming mail.
    const body=String(mail.text||'Courriel sans version texte. Consulter l’original dans Resend.').replace(/\u0000/g,'').slice(0,20000);
    const payload={provider_email_id:id,source:'email',from_email:mailbox(mail.from),to_email:to,subject,body_text:body,
      message_id:/^<[^<>\r\n]{1,500}>$/.test(mail.message_id||'')?mail.message_id:null,
      attachment_count:Array.isArray(mail.attachments)?mail.attachments.length:0,...triage(subject,body)};
    await fetchJSON(`${URL_BASE}/rest/v1/support_tickets?on_conflict=provider_email_id`,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(payload)});
    // Ack only after durable storage. No reply or AI call on this unauthenticated entry point.
    return res.status(200).json({received:true});
  }catch(e){return res.status(e.status||502).json({error:e.status?e.message:'Réception non confirmée.'})}
}
