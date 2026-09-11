import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html=readFileSync(new URL('../app-core.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../dashboard-active-tasks.js',import.meta.url),'utf8');
function harness(rows){
  const listeners={},nodes=new Map();
  const node=()=>({dataset:{},attributes:{},innerHTML:'',textContent:'',setAttribute(k,v){this.attributes[k]=v}});
  for(const id of ['pn','due','done','soon','tl','at','pl','el','ip','hpTaskListTitle','hpPriorityLegend'])nodes.set(id,node());
  const buttons=[...html.matchAll(/<button\b([^>]*class="hp-task-filter"[^>]*)>/g)].map(match=>{
    const n=node();n.dataset.taskFilter=/data-task-filter="([^"]+)"/.exec(match[1])[1];
    assert.match(match[1],/type="button"/);assert.match(match[1],/aria-controls="tl"/);
    return n;
  });
  assert.equal(buttons.length,3,'the three counters must be actual filter buttons');
  const ctx=vm.createContext({console,Date,Event,URL,Blob,Map,Set,
    document:{readyState:'complete',getElementById:id=>nodes.get(id)||null,
      querySelectorAll:selector=>selector==='.hp-task-filter'?buttons:[],
      addEventListener:(name,fn)=>listeners[name]=fn},
    supabase:{createClient:()=>({})},hpStability:{budgetFetch(){},esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')},
    hpMaintenanceBudget:{button:()=>''},...Object.fromEntries(nodes)});
  ctx.window=ctx;
  ctx.addEventListener=(name,fn)=>listeners[name]=fn;
  ctx.dispatchEvent=event=>listeners[event.type]?.(event);
  const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInContext(script.replace('hpAccountAccess.start(sb,boot);ra();choices();season();',''),ctx);
  ctx.rows=structuredClone(rows);
  vm.runInContext("props=[{id:'p1',name:'Test Nuvabri'}];ap=props[0];tasks=rows;eq=[]",ctx);
  vm.runInContext(source,ctx);vm.runInContext('render()',ctx);
  return {ctx,nodes,buttons,ids:()=>[...nodes.get('tl').innerHTML.matchAll(/data-task-id="([^"]+)"/g)].map(m=>m[1]),
    click(filter){const button=buttons.find(b=>b.dataset.taskFilter===filter);listeners.click({target:{closest:()=>button}})},
    run:code=>vm.runInContext(code,ctx)};
}
const date=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)};

test('Faites previews three completed tasks and keeps the full calendar history',()=>{
  const rows=[...Array.from({length:7},(_,i)=>({id:'done-'+i,title:'Même titre',status:'done',completed_at:`2026-09-0${i+1}T12:00:00Z`})),{id:'active',title:'Même titre',status:'todo'}];
  const h=harness(rows);assert.deepEqual(h.ids(),['active']);h.click('done');
  assert.deepEqual(h.ids(),['done-6','done-5','done-4']);
  assert.equal(h.nodes.get('hpTaskListTitle').textContent,'Tâches faites');
  assert.equal(h.buttons.find(b=>b.dataset.taskFilter==='done').attributes['aria-pressed'],'true');
  assert.equal(h.nodes.get('hpPriorityLegend').hidden,true);
  h.run('render()');assert.equal(h.ids().length,3);assert.equal((h.nodes.get('at').innerHTML.match(/data-task-id=/g)||[]).length,8);
  h.click('todo');assert.deepEqual(h.ids(),['active']);assert.equal(h.nodes.get('hpPriorityLegend').hidden,false);
});

test('Bientôt matches the existing count and excludes completed, undated and distant tasks',()=>{
  const h=harness([{id:'late',status:'todo',due_at:date(-2)},{id:'near',status:'todo',due_at:date(2)},
    {id:'later',status:'todo',due_at:date(10)},{id:'undated',status:'todo'},{id:'done',status:'done',due_at:date(1)}]);
  h.click('soon');assert.deepEqual(h.ids(),['late','near']);assert.equal(h.nodes.get('soon').textContent,2);
});

test('completing and reopening refresh the selected list; reloading retains the completed record',()=>{
  const h=harness([{id:'task',title:'Filtre',status:'todo'}]);h.run("tasks[0].status='done';render()");
  assert.deepEqual(h.ids(),[]);h.click('done');assert.deepEqual(h.ids(),['task']);
  const reloaded=harness([{id:'task',title:'Filtre',status:'done'}]);reloaded.click('done');assert.deepEqual(reloaded.ids(),['task']);
  h.run("tasks[0].status='todo';render()");assert.deepEqual(h.ids(),[]);
  assert.match(h.nodes.get('tl').innerHTML,/Aucune tâche faite/);h.click('todo');assert.deepEqual(h.ids(),['task']);
});

test('changing property uses its own task list and leaves calendar history intact',()=>{
  const h=harness([{id:'old',title:'Ancienne propriété',status:'done'}]);h.click('done');
  assert.match(h.nodes.get('at').innerHTML,/data-task-id="old"/);
  h.run("ap={id:'p2',name:'Chalet'};tasks=[{id:'new',title:'Nouvelle tâche',status:'todo'}];render()");
  assert.deepEqual(h.ids(),['new']);assert.equal(h.nodes.get('tl').dataset.taskFilter,'todo');
  h.click('done');assert.deepEqual(h.ids(),[]);assert.doesNotMatch(h.nodes.get('at').innerHTML,/data-task-id="old"/);
});


test('deleting the active property clears its tasks and selects the remaining property safely',async()=>{
 const h=harness([{id:'old',title:'Ancienne tâche',status:'done'}]);h.run("u={id:'owner'};props.push({id:'p2',name:'Chalet'})");
 await h.ctx.hpForgetProperty('p1','other');assert.equal(h.run('props.length'),2);
 // The simulated client has no fetch method: the replacement must still never show old tasks.
 await h.ctx.hpForgetProperty('p1','owner');assert.equal(h.run('props.length'),1);assert.equal(h.run('ap.id'),'p2');assert.equal(h.run('tasks.length'),0);assert.doesNotMatch(h.nodes.get('at').innerHTML,/Ancienne tâche/);
 await h.ctx.hpForgetProperty('p2','owner');assert.equal(h.run('props.length'),0);assert.equal(h.run('ap'),null);assert.equal(h.nodes.get('pn').textContent,'Aucune propriété');
});

test('home previews the three closest dates while retaining all tasks and counts',()=>{
 const h=harness([8,2,-1,1,4].map((days,i)=>({id:'t'+i,status:'todo',due_at:date(days)})));
 assert.deepEqual(h.ids(),['t2','t3','t1']);assert.equal(h.nodes.get('due').textContent,5);
 assert.equal((h.nodes.get('at').innerHTML.match(/data-task-id=/g)||[]).length,5);
 h.click('soon');assert.equal(h.ids().length,3);assert.equal(h.nodes.get('soon').textContent,4);
});
