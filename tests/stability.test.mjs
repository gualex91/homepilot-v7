import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {stableId} from '../lib/safe-write.js';
import addEquipment from '../api/property-equipment-add.js';
import addBudget from '../api/budget-entry.js';
import budgetData from '../api/budget-data.js';

const root=resolve(import.meta.dirname,'..');
function core(){const s=new Map();const ctx=vm.createContext({crypto:webcrypto,URL,URLSearchParams,fetch:()=>{},sessionStorage:{getItem:k=>s.get(k),setItem:(k,v)=>s.set(k,v),removeItem:k=>s.delete(k)}});vm.runInContext(readFileSync(resolve(root,'stability-core.js'),'utf8'),ctx);return ctx.hpStability;}
function response(){return {code:200,headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this},send(v){this.body=v;return this},end(){return this}}}
const user='11111111-1111-4111-a111-111111111111',property='22222222-2222-4222-a222-222222222222',request='33333333-3333-4333-a333-333333333333';
function fakeDB(options={}){
  const db={equipment:new Map(),tasks:new Map(),budget_entries:new Map()};
  const calls=[];
  return {db,calls,fetch:async(input,opts={})=>{
    const url=new URL(input);calls.push({url:String(url),opts});
    if(url.pathname==='/auth/v1/user')return Response.json({id:user});
    const table=url.pathname.split('/').pop();
    if(table==='properties')return Response.json(options.deny?[]:[{id:property}]);
    if(opts.method==='POST'){
      const row=JSON.parse(opts.body);
      if(table==='tasks'&&options.failTasks)return Response.json({message:'task insert failed'},{status:400});
      if(db[table].has(row.id))return Response.json([]);
      db[table].set(row.id,row);return Response.json([row]);
    }
    let rows=[...db[table].values()];
    if(url.searchParams.has('id'))rows=rows.filter(r=>r.id===url.searchParams.get('id').slice(3));
    if(url.searchParams.has('equipment_id'))rows=rows.filter(r=>r.equipment_id===url.searchParams.get('equipment_id').slice(3));
    return Response.json(rows);
  }};
}

test('monthly dates stay at the month end, including leap years',()=>{
 const c=core();assert.equal(c.addMonths('2026-01-31',1),'2026-02-28');assert.equal(c.addMonths('2026-02-28',1),'2026-03-31');assert.equal(c.addMonths('2024-01-31',1),'2024-02-29');assert.equal(c.addMonths('2026-08-30',1),'2026-09-30');
});
test('uncertain writes reuse IDs; confirmed or changed writes get new IDs',()=>{
 const c=core(),a=c.operation('budget',{amount:5});assert.equal(c.operation('budget',{amount:5}),a);assert.notEqual(c.operation('budget',{amount:6}),a);c.complete('budget');assert.notEqual(c.operation('budget',{amount:5}),a);
 assert.notEqual(stableId('user-a:'+request),stableId('user-b:'+request));
});
test('text values cannot create HTML',()=>assert.equal(core().esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;'));
test('budget SDK requests use the same origin without rerouting auth',async()=>{
 const calls=[],ctx=vm.createContext({URL,URLSearchParams,fetch:(...args)=>calls.push(args)});
 vm.runInContext(readFileSync(resolve(root,'stability-core.js'),'utf8'),ctx);
 ctx.hpStability.budgetFetch('https://vkfvjwxajgeafzyphjvh.supabase.co/rest/v1/budget_debts?select=*',{method:'GET'});
 assert.match(calls[0][0],/^\/api\/budget-data\?/);
 ctx.hpStability.budgetFetch('https://vkfvjwxajgeafzyphjvh.supabase.co/auth/v1/user',{});assert.match(calls[1][0],/\/auth\/v1\/user$/);
});
test('budget proxy preserves Request method, body and authorization',async()=>{
 const calls=[],ctx=vm.createContext({URL,URLSearchParams,Request,location:{origin:'https://nuvabri.test'},fetch:(...args)=>calls.push(args)});
 vm.runInContext(readFileSync(resolve(root,'stability-core.js'),'utf8'),ctx);
 ctx.hpStability.budgetFetch(new Request('https://vkfvjwxajgeafzyphjvh.supabase.co/rest/v1/budget_assets',{method:'POST',headers:{Authorization:'Bearer test'},body:'{"amount":1}'}));
 const req=calls[0][0];assert.match(req.url,/nuvabri.test\/api\/budget-data/);assert.equal(req.method,'POST');assert.equal(req.headers.get('Authorization'),'Bearer test');assert.equal(await req.text(),'{"amount":1}');
 ctx.hpStability.budgetFetch(new URL('https://vkfvjwxajgeafzyphjvh.supabase.co/rest/v1/budget_debts'));assert.match(calls[1][0],/^\/api\/budget-data/);
});
test('all frontend scripts and inline scripts parse and shell assets exist',()=>{
 for(const file of readdirSync(root).filter(f=>f.endsWith('.js')))new vm.Script(readFileSync(resolve(root,file),'utf8'),{filename:file});
 for(const file of ['index.html','seasonal-shell.html','app-core.html']){
  const html=readFileSync(resolve(root,file),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});
  for(const match of html.matchAll(/src="(\/[\w-]+\.js)(?:\?[^" ]+)?"/g))assert.ok(existsSync(resolve(root,'.'+match[1])),match[1]);
 }
 assert.equal(readFileSync(resolve(root,'index.html'),'utf8'),readFileSync(resolve(root,'seasonal-shell.html'),'utf8'));
 assert.match(readFileSync(resolve(root,'index.html'),'utf8'),/fetch\('\/app-core\.html\?source='/);
});
test('property creation resumes the same property and equipment after failure',async()=>{
 const rows=new Map(),calls=[],alerts=[],c=core();let fail=true;
 const sb={from:table=>({upsert:payload=>({select:async()=>{
   const key=table+':'+payload.id;if(rows.has(key))return {data:[]};rows.set(key,payload);return {data:[payload]};
 }}),select:()=>({eq:(_,id)=>({single:async()=>({data:rows.get(table+':'+id)})})})})};
 const ctx=vm.createContext({window:{},document:{readyState:'complete',getElementById:()=>null,querySelectorAll:query=>query.includes('"e"')?[{value:'fournaise'}]:[]},sb,h:{id:property},u:{id:user},pname:{value:'Maison'},ptype:{value:'maison'},pcity:{value:'Jonquière'},ppostal:{value:''},pyear:{value:''},cp:{},pf:{classList:{add:()=>{}}},E:[['fournaise','🔥 Fournaise']],S:[],hpStability:{...c,token:async()=> 'test'},load:async()=>{},activate:async()=>{},alert:s=>alerts.push(s),fetch:async(_,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,json:async()=>({equipment:{id:'saved'},task_warning:fail?'Temporary failure':null})}}});
 vm.runInContext(readFileSync(resolve(root,'smart-equipment.js'),'utf8'),ctx);
 await ctx.window.createProperty();assert.equal(rows.size,1);assert.equal(alerts.length,1);
 fail=false;await ctx.window.createProperty();assert.equal(rows.size,1);assert.equal(calls[0].request_id,calls[1].request_id);assert.equal(calls[0].name,'Fournaise');assert.equal(ctx.cp.disabled,false);
});
test('concurrent equipment retries create one equipment and one task set',async()=>{
 const real=global.fetch,fake=fakeDB();global.fetch=fake.fetch;
 try{const req={method:'POST',headers:{authorization:'Bearer example'},body:{request_id:request,property_id:property,equipment_type:'fournaise',name:'Appareil'}};
 const a=response(),b=response();await Promise.all([addEquipment(req,a),addEquipment(req,b)]);
 assert.equal(a.code,200);assert.equal(b.code,200);assert.equal(fake.db.equipment.size,1);assert.equal(fake.db.tasks.size,2);
 for(const row of fake.db.tasks.values()){assert.ok(row.equipment_id);assert.ok(row.source_note);assert.ok(!('notes' in row))}
 const first=[...fake.db.tasks.values()][0];assert.equal(first.due_at,new Date().toISOString().slice(0,10));
 }finally{global.fetch=real}
});
test('partial task failure is visible; retry repairs without duplicate equipment',async()=>{
 const real=global.fetch,options={failTasks:true},fake=fakeDB(options);global.fetch=fake.fetch;
 try{const req={method:'POST',headers:{authorization:'Bearer example'},body:{request_id:request,property_id:property,equipment_type:'fournaise',name:'Appareil'}};
 const res=response();await addEquipment(req,res);assert.equal(res.code,200);assert.equal(fake.db.equipment.size,1);assert.ok(res.body.task_warning);
 options.failTasks=false;const retry=response();await addEquipment(req,retry);assert.equal(retry.body.task_warning,null);assert.equal(fake.db.equipment.size,1);assert.equal(fake.db.tasks.size,2);
 const again=response();await addEquipment(req,again);assert.equal(again.body.tasks.length,2);
 }finally{global.fetch=real}
});
for(const brand of ['HomePilot','Nuvabri'])test(`database-generated ${brand} tasks are preserved instead of duplicated`,async()=>{
 const real=global.fetch,fake=fakeDB(),id=stableId(user+':equipment:'+request);fake.db.tasks.set('generated',{id:'generated',equipment_id:id,source_note:`Généré automatiquement par ${brand}`});global.fetch=fake.fetch;
 try{const res=response();await addEquipment({method:'POST',headers:{authorization:'Bearer example'},body:{request_id:request,property_id:property,equipment_type:'piscine',name:'Piscine'}},res);assert.equal(res.code,200);assert.equal(fake.db.tasks.size,1)}finally{global.fetch=real}
});
test('budget ignores spoofed user IDs and retries never double the amount',async()=>{
 const real=global.fetch,fake=fakeDB();global.fetch=fake.fetch;
 try{const req={method:'POST',headers:{authorization:'Bearer example'},body:{request_id:request,user_id:'spoofed',entry_date:'2026-09-10',amount:1300,entry_type:'expense'}};
 for(let i=0;i<2;i++){const res=response();await addBudget(req,res);assert.equal(res.code,200)}assert.equal(fake.db.budget_entries.size,1);assert.equal([...fake.db.budget_entries.values()][0].user_id,user);
 }finally{global.fetch=real}
});
test('missing authentication and out-of-scope proxy tables fail closed',async()=>{
 const a=response();await addEquipment({method:'POST',headers:{},body:{}},a);assert.equal(a.code,401);
 const b=response();await budgetData({method:'GET',headers:{authorization:'Bearer example'},url:'/api/budget-data?table=profiles'},b);assert.equal(b.code,400);
});
test('equipment insert is blocked when the property is not accessible',async()=>{
 const real=global.fetch,fake=fakeDB({deny:true});global.fetch=fake.fetch;
 try{const res=response();await addEquipment({method:'POST',headers:{authorization:'Bearer example'},body:{request_id:request,property_id:property,equipment_type:'fournaise',name:'Appareil'}},res);assert.equal(res.code,404);assert.equal(fake.db.equipment.size,0)}finally{global.fetch=real}
});

test('browser: dashboard stability and budget save-to-summary flow',{skip:process.env.HP_BROWSER_TEST!=='1'?'Requires HP_BROWSER_TEST=1, Playwright and Chromium':false},async()=>{
 const require=createRequire(import.meta.url);
 const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
 const server=createServer((req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://test').pathname);
   const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end();return}
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml'})[extname(file)]||'text/plain');res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  const serverChromium=process.env.HP_CHROMIUM_MODULE?(await import(process.env.HP_CHROMIUM_MODULE)).default:null;
  browser=await chromium.launch({headless:true,...(serverChromium?{executablePath:process.env.HP_BROWSER_EXECUTABLE||await serverChromium.executablePath(),args:serverChromium.args}:process.env.HP_BROWSER_EXECUTABLE?{executablePath:process.env.HP_BROWSER_EXECUTABLE}:{})});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__testUser?{access_token:'test',user:window.__testUser}:null}}),getUser:async()=>({data:{user:window.__testUser||null}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:table=>{let single=false;const chain=new Proxy(function(){},{get:(_,k)=>k==='then'?(resolve)=>resolve({data:single?null:table==='budget_entries'?(window.__budgetTestRows||[]):[],error:null}):()=>{if(k==='single'||k==='maybeSingle')single=true;return chain}});return chain}})};`}));
  await page.route('**/api/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"Test session"}'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>typeof window.hpOpenProperty==='function');
  assert.ok((await page.locator('body').innerText()).trim().length>0);
  await page.evaluate(()=>{
    auth.classList.add('hidden');setup.classList.add('hidden');hc.classList.remove('hidden');
    props=[{id:'p1',name:'<img src=x onerror="window.injected=true">',city:'Jonquière'}];ap=props[0];
    tasks=[{id:'done',title:'Même titre',status:'done',due_at:'2026-09-09'},{id:'todo',title:'Même titre',status:'todo',due_at:'2026-09-10'},{id:'safe',title:'<img src=x onerror="window.injected=true">',status:'todo',due_at:'2026-09-10'}];
    eq=[];render();window.mutations=0;new MutationObserver(records=>window.mutations+=records.length).observe(document.getElementById('tl'),{subtree:true,childList:true,characterData:true});
  });
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#tl [data-task-id="done"]').count(),0);
  assert.equal(await page.locator('#tl [data-task-id="todo"]').count(),1);
  assert.equal(await page.locator('#at [data-task-id="done"]').count(),1);
  assert.equal(await page.locator('#pl img,#tl img').count(),0);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  const count=await page.evaluate(()=>window.mutations);await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.mutations),count,'dashboard must stop mutating when data is unchanged');
  assert.deepEqual(errors,[]);
  if(process.env.HP_SCREENSHOT)await page.screenshot({path:process.env.HP_SCREENSHOT,fullPage:true});
  const budgetRows=[];let writes=0;
  await page.route('**/api/budget-entry',async route=>{
   writes++;const row={...route.request().postDataJSON(),id:'budget-test'};budgetRows.push(row);
   await page.evaluate(rows=>window.__budgetTestRows=rows,budgetRows);
   await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,id:row.id})});
  });
  await page.route('**/api/budget-list?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({rows:budgetRows})}));
  await page.evaluate(id=>{u={id,email:'test@example.invalid'};window.__testUser=u;show('budget');hpOpenBudgetEntry()},user);
  await page.locator('#hpBudgetAmount').fill('1300');
  await page.locator('#hpBudgetSave').click();
  await page.waitForFunction(()=>document.getElementById('hpExpense').textContent.replace(/\D/g,'').includes('1300'));
  await page.waitForFunction(()=>document.getElementById('hpOverviewGrid').textContent.replace(/\D/g,'').includes('1300'));
  assert.equal(writes,1);assert.equal(budgetRows[0].user_id,user);assert.ok(budgetRows[0].request_id);
  assert.equal(await page.locator('#hpBudgetForm').evaluate(n=>n.classList.contains('hidden')),true);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
});
