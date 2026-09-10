import {URL_BASE,PUBLIC_KEY,verifiedUser} from './safe-write.js';
const environments=['preview','production'];
export default async function analytics(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Méthode non permise.'});
  try{
    const auth=req.headers?.authorization||'';
    if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session requise.'});
    await verifiedUser(auth);
    const q=new URL(req.url,'https://nuvabri.invalid').searchParams;
    let method,payload;
    if(req.method==='GET'){
      const days=Number(q.get('days')||30),environment=q.get('environment')||(process.env.VERCEL_ENV==='production'?'production':'preview'),admin=q.get('include_admin')||'false';
      if(![7,30,90].includes(days)||!environments.includes(environment)||!['true','false'].includes(admin))return res.status(400).json({error:'Filtres invalides.'});
      method='hp_app_analytics';payload={p_days:days,p_environment:environment,p_include_admin:admin==='true'};
    }else{
      let body=req.body;if(typeof body==='string'){if(body.length>14000)return res.status(400).json({error:'Mesures invalides.'});try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Mesures invalides.'})}}
      if(!body||Object.keys(body).some(k=>k!=='events')||!Array.isArray(body.events)||body.events.length<1||body.events.length>20||JSON.stringify(body).length>14000)return res.status(400).json({error:'Mesures invalides.'});
      if(!environments.includes(process.env.VERCEL_ENV))return res.status(200).json({accepted:0,disabled:true});
      method='hp_record_app_events';payload={p_events:body.events,p_environment:process.env.VERCEL_ENV};
    }
    const r=await fetch(URL_BASE+'/rest/v1/rpc/'+method,{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    const result=await r.json();
    if(!r.ok){const status=result?.code==='42501'?403:result?.code==='P0001'?429:result?.code?.startsWith('22')?400:r.status===401?401:503;return res.status(status).json({error:status===403?'Statistiques réservées aux administrateurs.':status===400?'Mesures ou filtres invalides.':status===429?'Limite de mesures atteinte.':'Les statistiques sont indisponibles. Réessaie.'})}
    return res.status(200).json(result);
  }catch(error){return res.status(error.status===401?401:503).json({error:error.status===401?'Session expirée.':'Les statistiques sont indisponibles. Réessaie.'})}
}
