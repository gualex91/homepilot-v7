import {URL_BASE,PUBLIC_KEY} from '../lib/safe-write.js';
const allowed=new Set(['budget_entries','budget_category_targets','budget_recurring_payments','budget_savings_goals','budget_debts','budget_assets','mortgage_renewals']);
export default async function handler(req,res){
  if(!['GET','POST','PATCH','DELETE','HEAD'].includes(req.method))return res.status(405).end();
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante'});
  const target=new URL(`${URL_BASE}/rest/v1/`);
  const input=new URL(req.url,'https://homepilot.invalid');
  const table=input.searchParams.get('table');
  if(!allowed.has(table))return res.status(400).json({error:'Table non autorisée'});
  target.pathname+=table;
  input.searchParams.delete('table');target.search=input.searchParams.toString();
  const headers={apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'};
  for(const key of ['prefer','accept','range','range-unit'])if(req.headers[key])headers[key]=req.headers[key];
  try{
    const upstream=await fetch(target,{method:req.method,headers,body:['POST','PATCH'].includes(req.method)?JSON.stringify(req.body):undefined});
    res.setHeader('Cache-Control','no-store');
    for(const key of ['content-type','content-range','range-unit','preference-applied'])if(upstream.headers.has(key))res.setHeader(key,upstream.headers.get(key));
    return res.status(upstream.status).send(await upstream.text());
  }catch{return res.status(502).json({message:'Impossible de joindre le Budget.'})}
}
