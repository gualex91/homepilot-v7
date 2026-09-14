import {URL_BASE,PUBLIC_KEY} from '../lib/safe-write.js';
import {budgetUpstream} from '../lib/budget-upstream.js';
const allowed=new Set(['budget_entries','budget_category_targets','budget_recurring_payments','budget_savings_goals','budget_debts','budget_assets','mortgage_renewals']);
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST','PATCH','DELETE','HEAD'].includes(req.method))return res.status(405).end();
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const target=new URL(`${URL_BASE}/rest/v1/`);
  const input=new URL(req.url,'https://nuvabri.invalid');
  const table=input.searchParams.get('table');
  if(!allowed.has(table))return res.status(400).json({error:'Table non autorisée'});
  target.pathname+=table;
  input.searchParams.delete('table');target.search=input.searchParams.toString();
  const headers={apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'};
  for(const key of ['prefer','accept','range','range-unit'])if(req.headers[key])headers[key]=req.headers[key];
  const started=Date.now();
  try{
    const {response:upstream,text,attempts}=await budgetUpstream(target,{method:req.method,headers,body:['POST','PATCH'].includes(req.method)?JSON.stringify(req.body):undefined});
    if(upstream.status>=500||attempts>1)console.warn(JSON.stringify({route:'/api/budget-data',table,method:req.method,status:upstream.status,attempts,ms:Date.now()-started}));
    for(const key of ['content-type','content-range','range-unit','preference-applied'])if(upstream.headers.has(key))res.setHeader(key,upstream.headers.get(key));
    return res.status(upstream.status).send(text);
  }catch(error){
    const timeout=error?.name==='TimeoutError'||error?.name==='AbortError';
    console.error(JSON.stringify({route:'/api/budget-data',table,method:req.method,kind:timeout?'upstream_timeout':'upstream_unavailable',ms:Date.now()-started}));
    res.setHeader('Cache-Control','no-store');
    return res.status(timeout?504:502).json({message:timeout?'Le chargement du budget prend trop de temps. Réessaie dans un instant.':'Impossible de joindre le Budget.',code:timeout?'BUDGET_TIMEOUT':'BUDGET_UNAVAILABLE'});
  }
}
