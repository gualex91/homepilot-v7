import {randomUUID} from 'node:crypto';
import {URL_BASE,PUBLIC_KEY,verifiedUser,requestId} from '../lib/safe-write.js';
import '../budget-engine.js';
const engine=globalThis.hpBudgetEngine;
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
// Store the addition separately: an older client updating config cannot erase it.
const present=row=>row?{config:{...row.config,projects:row.maintenance_projects||[]},revision:row.revision,updated_at:row.updated_at}:null;

export default async function handler(req,res){
  const started=Date.now(),trace=randomUUID();
  console.info(JSON.stringify({level:'info',msg:'start',route:'/api/budget-plan',trace,method:req.method}));
  res.once?.('finish',()=>console.info(JSON.stringify({level:'info',msg:'done',route:'/api/budget-plan',trace,status:res.statusCode,ms:Date.now()-started})));
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Méthode non permise.'})}
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Session manquante.'});
  try{
    const user=await verifiedUser(auth);
    const headers={apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'};
    async function query(table,params,options={}){
      const url=new URL(URL_BASE+'/rest/v1/'+table);for(const [k,v] of params)url.searchParams.append(k,v);
      const response=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(10000)});
      const data=await response.json();if(!response.ok)throw Object.assign(new Error('Base de données indisponible.'),{status:response.status});return data;
    }
    const own=[['user_id','eq.'+user.id]];
    const current=present((await query('budget_plans',[...own,['select','config,maintenance_projects,revision,updated_at']]))[0]);
    if(req.method==='PUT'){
      let config;
      try{
        const input=req.body?.config;
        // An older client may omit the optional balance field. Preserve it
        // on the same account; explicit null clears it and row removal wins.
        const keepBalances=key=>Array.isArray(input?.[key])?input[key].map(row=>{
          if(!row||Object.hasOwn(row,'accountBalance'))return row;
          const previous=current?.config[key]?.find(x=>x.id===row.id&&x.category===row.category);
          return previous&&Object.hasOwn(previous,'accountBalance')?{...row,accountBalance:previous.accountBalance}:row;
        }):input?.[key];
        config=engine.validate({...input,bills:keepBalances('bills'),envelopes:keepBalances('envelopes'),projects:input&&Object.hasOwn(input,'projects')?input.projects:current?.config.projects||[]});
      }catch(error){return res.status(400).json({error:error.message})}
      const expected=req.body?.expected_revision??null,id=req.body?.request_id;
      if(!requestId(id)||(expected!==null&&!requestId(expected)))return res.status(400).json({error:'Identifiant de sauvegarde invalide.'});
      if(current?.revision===id&&stable(current.config)===stable(config))return res.status(200).json({ok:true,...current});
      if((current?.revision??null)!==expected)return res.status(409).json({error:'Ton budget a changé sur un autre appareil. Recharge la version enregistrée avant de refaire tes modifications.'});
      const {projects,...baseConfig}=config;
      const payload={config:baseConfig,maintenance_projects:projects,revision:id,updated_at:new Date().toISOString()};
      const rows=current?await query('budget_plans',[...own,['revision','eq.'+expected]],{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}):await query('budget_plans',[['on_conflict','user_id']],{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({...payload,user_id:user.id})});
      if(!rows.length){
        const latest=present((await query('budget_plans',own))[0]);
        if(latest?.revision===id&&stable(latest.config)===stable(config))return res.status(200).json({ok:true,config:latest.config,revision:latest.revision,updated_at:latest.updated_at});
        return res.status(409).json({error:'Une autre sauvegarde a été effectuée. Recharge le budget.'});
      }
      return res.status(200).json({ok:true,...present(rows[0])});
    }
    const month=new URL(req.url,'https://nuvabri.invalid').searchParams.get('month')||'';
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return res.status(400).json({error:'Mois invalide.'});
    const entries=[];let complete=false;
    for(let offset=0;offset<10000;offset+=500){
      const rows=await query('budget_entries',[...own,['select','id,entry_type,category,amount,entry_date'],['entry_date','gte.'+month+'-01'],['entry_date','lte.'+engine.monthEnd(month)],['order','entry_date.asc,id.asc'],['offset',String(offset)],['limit','500']]);
      entries.push(...rows);if(rows.length<500){complete=true;break}
    }
    // Legacy values are suggestions only. The user explicitly chooses to import.
    let legacy={targets:[],bills:[],available:true};
    if(!current){try{const [targets,bills]=await Promise.all([query('budget_category_targets',[...own,['select','id,category,monthly_target']]),query('budget_recurring_payments',[...own,['active','eq.true'],['select','id,name,category,amount,frequency,next_due_date']])]);legacy={targets,bills,available:true}}catch{legacy.available=false}}
    return res.status(200).json({ok:true,config:current?.config||null,revision:current?.revision||null,updated_at:current?.updated_at||null,entries,entries_complete:complete,legacy});
  }catch(error){
    const log=error.status===401?console.warn:console.error;log(JSON.stringify({level:error.status===401?'warning':'error',msg:'failed',route:'/api/budget-plan',trace,status:error.status||502,ms:Date.now()-started}));
    return res.status(error.status===401?401:503).json({error:error.status===401?'Session expirée. Reconnecte-toi.':'Le budget ne peut pas être chargé ou enregistré. Tes modifications restent à l’écran.',trace});
  }
}
