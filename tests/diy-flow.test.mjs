import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// A DOM/event harness executes the shipped scripts in their real load order.
// External navigation is inspected, never followed; no user data is written.
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const hrefs=node=>node.querySelectorAll('a').map(a=>a.getAttribute('href')).join('\n');
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));
class Element{
 constructor(tag='div'){this.tagName=tag.toLowerCase();this.nodeType=1;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.style={};this.hidden=false;this.value='';this._text='';this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)}}
 set id(v){this.attributes.id=v}get id(){return this.attributes.id}
 set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean))}get className(){return [...this.classes].join(' ')}
 setAttribute(k,v){this.attributes[k]=v;if(k==='class')this.className=v;if(k==='hidden')this.hidden=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v}
 getAttribute(k){return this.attributes[k]??null}hasAttribute(k){return Object.hasOwn(this.attributes,k)}
 appendChild(child){child.parentElement=this;this.children.push(child);return child}
 set textContent(v){this._text=v;this.children=[]}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ')}
 set innerHTML(html){
  this.children=[];this._text='';this._html=html;const stack=[this];
  for(const part of html.match(/<[^>]+>|[^<]+/g)||[]){
   if(part.startsWith('</')){if(stack.length>1)stack.pop();continue}
   if(part.startsWith('<')){const tag=part.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const node=new Element(tag);for(const m of part.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(m[1]!==tag)node.setAttribute(m[1],decode(m[2]||''))}stack.at(-1).appendChild(node);if(!['input','br','img','hr'].includes(tag))stack.push(node)}
   else stack.at(-1)._text+=decode(part);
  }
 }
 get innerHTML(){return this._html||''}
 matches(s){if(s[0]==='#')return this.id===s.slice(1);if(s[0]==='.')return this.classes.has(s.slice(1));if(s[0]==='[')return this.hasAttribute(s.slice(1,-1));return this.tagName===s}
 closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null}
 querySelectorAll(s){const options=s.split(',').map(x=>x.trim()),out=[];for(const child of this.children){if(options.some(q=>child.matches(q)))out.push(child);out.push(...child.querySelectorAll(s))}return out}
 querySelector(s){return this.querySelectorAll(s)[0]||null}
}
function harness(){
 const body=new Element('body'),listeners=[],requests=[],intervals=[];
 const leisure=body.appendChild(new Element());leisure.id='hpLeisureList';
 const home=body.appendChild(new Element());home.id='tl';
 const calendar=body.appendChild(new Element());calendar.id='at';
 const titles=['Nettoyer les filtres de la thermopompe','Vérifier le détecteur de fumée','Nettoyer le filtre du spa'];
 const tasks=titles.map((title,i)=>({id:'task-'+i,title,property_id:'house',equipment_id:'equipment-'+i}));
 const cards=tasks.map(task=>{const card=home.appendChild(new Element());card.className='card';card.setAttribute('data-task-id',task.id);const title=card.appendChild(new Element('b'));title.textContent=task.title;return card});
 const calendarCard=calendar.appendChild(new Element());calendarCard.className='card';calendarCard.setAttribute('data-task-id','task-0');calendarCard.appendChild(new Element('b')).textContent=titles[0];
 const props=[{id:'house',name:'Maison',city:'Jonquière',postal_code:'G7X1A1',address:'Adresse privée'},{id:'chalet',name:'Chalet',city:'Québec',postal_code:'G1R1A1'}];
 const document={readyState:'complete',body,createElement:tag=>new Element(tag),getElementById:id=>body.querySelector('#'+id),addEventListener:(event,callback)=>{if(event==='click')listeners.push(callback)},querySelectorAll:s=>s.includes(' > *')?s.split(',').flatMap(selector=>document.getElementById(selector.trim().split(' ')[0].slice(1))?.children||[]):body.querySelectorAll(s)};
 const context={document,props,tasks,ap:props[0],eq:tasks.map((t,i)=>({id:t.equipment_id,property_id:'house',brand:'Marque'+i,model:'Modèle'+i,serial_number:'SERIAL-SECRET'})),URL,URLSearchParams,AbortController,Date,console,setTimeout:()=>0,clearTimeout(){},setInterval:callback=>intervals.push(callback),clearInterval(){},MutationObserver:class{observe(){}},hpStability:{token:async()=> 'session-fixture'},fetch:async(url)=>{
  requests.push(new URL(url,'https://nuvabri.test'));
  return {ok:true,json:async()=>({rows:[{id:'professional',business_name:'Commerce local',active:true,directory_issues:[],phone:'4182346789'}]})};
 }};context.window=context;const ctx=vm.createContext(context);
 for(const file of ['professional-presentation.js','vr-expert-shop.js','diy-guides.js','professional-directory-cloud.js','leisure-tasks.js','professional-task-router.js'])vm.runInContext(source(file),ctx,{filename:file});
 const click=async button=>{assert.ok(button,'button exists');const event={target:button,stopped:false,preventDefault(){},stopImmediatePropagation(){this.stopped=true}};for(const listener of listeners){await listener(event);if(event.stopped)return}await button.onclick?.(event)};
 return {ctx,cards,calendarCard,requests,intervals,get:document.getElementById,click};
}

test('home and DIY clicks send exactly the same professional search and render the result',async()=>{
 const h=harness();
 await h.click(h.cards[0].querySelector('.hpFindPro'));const direct=h.requests[0].search;
 await h.click(h.cards[0].querySelector('.hpDiyBtn'));
 assert.match(h.get('hpDiyBody').textContent,/Nettoyer les filtres/);
 await h.click(h.get('hpDiyBody').querySelector('[data-hp-diy-professional]'));
 assert.equal(h.requests.length,2);assert.equal(h.requests[1].search,direct);assert.equal(h.requests[1].searchParams.get('service'),'heat_pump_cleaning');
 assert.match(h.get('hpProResults').textContent,/Commerce local/);
 await h.click(h.get('hpProResults').querySelector('[data-pro-id]'));
 assert.match(h.get('hpProBody').textContent,/Maison/);assert.match(h.get('hpProBody').textContent,/Jonquière/);
});
test('DIY retains its original property if the active property changes and is available from the calendar',async()=>{
 const h=harness();await h.click(h.calendarCard.querySelector('.hpDiyBtn'));h.ctx.ap=h.ctx.props[1];
 // Guide prose contains unrelated terms; routing must still use the original task.
 h.get('hpDiyBody').appendChild(new Element()).textContent='électricité toiture piscine';
 await h.click(h.get('hpDiyBody').querySelector('[data-hp-diy-professional]'));
 assert.equal(h.requests[0].searchParams.get('city'),'Jonquière');assert.equal(h.requests[0].searchParams.get('postal'),'G7X1A1');
 assert.equal(h.requests[0].searchParams.get('service'),'heat_pump_cleaning');
 await h.click(h.get('hpTaskProClose'));assert.equal(h.get('hpDiyModal').classList.contains('hidden'),false);
});
test('product button opens working search anchors; queries include model but exclude private context',async()=>{
 const h=harness();await h.click(h.cards[1].querySelector('.hpDiyBtn'));
 const panel=h.get('hpDiyProducts'),toggle=h.get('hpDiyProductsToggle');assert.equal(panel.hidden,true);
 await h.click(toggle);assert.equal(panel.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
 const links=panel.querySelectorAll('a');assert.equal(links.length,3);
 const battery=new URL(links[0].getAttribute('href'));assert.equal(battery.origin,'https://www.google.com');assert.equal(battery.searchParams.get('tbm'),'shop');assert.equal(battery.searchParams.get('gl'),'ca');assert.match(battery.searchParams.get('q'),/Marque1 Modèle1/);
 for(const link of links){assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');assert.doesNotMatch(link.getAttribute('href'),/SERIAL|Adresse|G7X|session-fixture/)}
 await h.click(toggle);assert.equal(panel.hidden,true);
});
test('spa filters keep the spa guide and reopening a different guide resets product state',async()=>{
 const h=harness();await h.click(h.cards[0].querySelector('.hpDiyBtn'));await h.click(h.get('hpDiyProductsToggle'));
 assert.equal(h.get('hpDiyProducts').querySelectorAll('a').length,2); // Water is preparation, not a purchase.
 await h.click(h.cards[2].querySelector('.hpDiyBtn'));assert.match(h.get('hpDiyBody').textContent,/Entretien courant du spa/);assert.equal(h.get('hpDiyProducts').hidden,true);
 await h.click(h.get('hpDiyBody').querySelector('[data-hp-diy-professional]'));assert.equal(h.requests[0].searchParams.get('category'),'pool_spa');
});
test('a task whose property is unavailable cannot silently search another property',async()=>{
 const h=harness();h.ctx.tasks[0].property_id='missing';await h.click(h.cards[0].querySelector('.hpFindPro'));
 assert.equal(h.requests.length,0);assert.match(h.get('hpProBody').textContent,/propriété associée/);
});

test('household materials link to the actual cloth, preserving battery, filter and spa product searches',async()=>{
 const h=harness();
 for(const card of h.cards){
  await h.click(card.querySelector('.hpDiyBtn'));await h.click(h.get('hpDiyProductsToggle'));
  const links=h.get('hpDiyProducts').querySelectorAll('a');
  const local=links.filter(a=>new URL(a.getAttribute('href')).hostname==='vrexpertjonquiere.ca');
  assert.equal(local.length,1);assert.match(local[0].textContent,/VR Expert Jonquière/);
  assert.equal(new URL(local[0].getAttribute('href')).pathname,'/produit/linges-a-polir-en-microfibre-pqt3/');
  for(const a of links.filter(a=>a!==local[0]))assert.equal(new URL(a.getAttribute('href')).hostname,'www.google.com');
  assert.doesNotMatch(hrefs(h.get('hpDiyProducts')),/antigel|aquapods|boite-a-batterie/);
 }
 h.ctx.hpOpenDiy('Entretien courant de la piscine');
 assert.ok(h.get('hpDiyProducts').querySelectorAll('a').every(a=>new URL(a.getAttribute('href')).hostname==='www.google.com'));
});

test('leisure DIY shows contextual product pages and retains the professional action',async()=>{
 const h=harness();h.ctx.hpShowLeisureDiy('rv_winterize');
 let body=h.get('hpLtmBody'),panel=body.querySelector('.hpVrSuggestions');
 assert.ok(panel);assert.equal(panel.hasAttribute('open'),false);assert.match(panel.textContent,/Trouver les produits/);
 assert.ok(panel.querySelectorAll('a').some(a=>a.getAttribute('href').endsWith('/produit/antigel-de-plomberie/')));
 assert.match(body.querySelector('button').getAttribute('onclick'),/hpFindLeisurePro\('rv_winterize'\)/);
 await h.ctx.hpFindLeisurePro('rv_winterize');assert.match(h.get('hpProResults').textContent,/Commerce local/);
 for(const key of ['boat_winterize','boat_spring','pwc_winterize','motorcycle_storage','snowmobile_storage']){
  h.ctx.hpShowLeisureDiy(key);panel=h.get('hpLtmBody').querySelector('.hpVrSuggestions');assert.ok(panel);
  assert.doesNotMatch(hrefs(panel),/antigel-de-plomberie|aquapods|dicor-pour-toit|surge-30/);
 }
 h.ctx.hpShowLeisureDiy('boat_spring');assert.match(h.get('hpLtmBody').textContent,/application à la machine/);
 h.ctx.hpShowLeisureDiy('unknown');assert.equal(h.get('hpLtmBody').querySelector('.hpVrSuggestions'),null);
 // Missing merchant script must not prevent a guide or its professional button from opening.
 delete h.ctx.HomePilotVrShop;h.ctx.hpShowLeisureDiy('rv_winterize');assert.match(h.get('hpLtmBody').textContent,/Hivernisation du VR/);
});

test('saved equipment renders the catalog in the actual leisure list with types kept separate',async()=>{
 const h=harness(),equipment=[{id:'rv1',equipment_type:'rv',name:'Mon VR'},{id:'boat1',equipment_type:'boat',name:'Mon bateau'},{id:'atv1',equipment_type:'atv',name:'VTT'}];
 h.ctx.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},from:table=>({select(){return this},eq(){return this},order:async()=>({data:table==='leisure_equipment'?equipment:[],error:null})})};
 h.ctx.hpLoadLeisure=()=>{};
 // The last registered interval installs the shipped leisure renderer.
 h.intervals.at(-1)();await h.ctx.hpLoadLeisure();
 const [rv,boat,atv]=h.get('hpLeisureList').children;
 assert.match(rv.textContent,/Hivernisation et remisage/);assert.match(rv.textContent,/Confort et cuisine en camping/);
 assert.match(rv.textContent,/Sur commande/);assert.doesNotMatch(hrefs(rv),/nettoyant-quille-de-ponton/);
 assert.match(hrefs(boat),/nettoyant-quille-de-ponton/);assert.doesNotMatch(hrefs(boat),/antigel-de-plomberie/);
 assert.equal(atv.querySelector('.hpVrSuggestions'),null);
 assert.equal(rv.querySelectorAll('.hpVrSuggestions').length,1);
 await h.ctx.hpLoadLeisure();assert.equal(h.get('hpLeisureList').children[0].querySelectorAll('.hpVrSuggestions').length,1);
});

test('all curated product and category links are reachable through a supported equipment context and are read-only',()=>{
 const h=harness(),shop=h.ctx.HomePilotVrShop;
 const html=Object.keys(shop.equipmentGroups).map(type=>shop.renderForEquipment(type)).join('');
 const rows=[...shop.products,...shop.categories];
 assert.equal(new Set(shop.products.map(p=>p.id)).size,shop.products.length);
 for(const row of rows){
  const url=new URL(row.url);assert.equal(url.origin,'https://vrexpertjonquiere.ca');assert.equal(url.search,'');
  assert.match(url.pathname,/^\/(produit|categorie-de-produit)\//);assert.ok(html.includes(row.url),row.id+' has a visible placement');
  assert.equal(row.checkedAt,'2026-09-10');
 }
 const node=new Element();node.innerHTML=html;
 for(const a of node.querySelectorAll('a')){assert.equal(a.getAttribute('target'),'_blank');assert.equal(a.getAttribute('rel'),'noopener noreferrer')}
 assert.match(node.textContent,/stock non synchronisé/);assert.match(node.textContent,/non rémunérés/);
 assert.doesNotMatch(html,/add-to-cart|en stock|\d+\.\d+\s*\$/);
 assert.equal(shop.renderForEquipment('<img src=x onerror=alert(1)>'),'');
 assert.equal(shop.renderForGuide('__proto__'),'');
 assert.equal(shop.forMaterial('Batterie compatible avec le détecteur'),null);
});

test('both entry shells load the merchant catalog before consumers with identical versions',()=>{
 const index=source('index.html');assert.equal(index,source('seasonal-shell.html'));
 assert.match(index,/<title>Nuvabri<\/title>/);assert.match(index,/const stamp='nuvabri-[^']+'/);
 const merchant=index.indexOf('/vr-expert-shop.js?v=');
 assert.ok(merchant>=0);
 assert.ok(merchant<index.indexOf('/diy-guides.js?v='));
 assert.ok(merchant<index.indexOf('/leisure-tasks.js?v='));
});
