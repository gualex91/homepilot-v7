(function(root){
  'use strict';
  const SESSION='nuvabri.usage.session.v1',PREFERENCE='nuvabri.usage.enabled',SCREENS=new Set(['home','properties','equipment','leisure','budget','tasks','household','more','hpHelp','hpPartners']);
  let actor=null,token=null,visit=null,announced=null,lastScreen=null,queue=[],timer=null,flight=null,epoch=0,attempts=0,preferenceOverride=null;
  const client=()=>root.supabaseClient;
  const privacySignal=()=>root.navigator?.globalPrivacyControl===true||root.navigator?.doNotTrack==='1';
  const enabled=()=>{if(privacySignal())return false;if(preferenceOverride!==null)return preferenceOverride;try{return root.localStorage.getItem(PREFERENCE)!=='false'}catch{return true}};
  const uuid=()=>root.crypto.randomUUID();
  function clear(){epoch++;actor=null;token=null;visit=null;announced=null;lastScreen=null;queue=[];attempts=0;clearTimeout(timer);timer=null;flight?.abort();flight=null;try{root.sessionStorage.removeItem(SESSION)}catch{}}
  function push(name,target,extra={}){if(queue.length<40)queue.push({id:uuid(),session_id:visit.id,name,target,...extra})}
  function session(){
    if(!actor||!token||!enabled()||root.hpAccountAccess?.isRecovering?.())return false;
    const now=Date.now();if(!visit){try{const saved=JSON.parse(root.sessionStorage.getItem(SESSION));if(saved?.userId===actor&&typeof saved.id==='string'&&Number.isFinite(saved.touched)&&now-saved.touched>=0&&now-saved.touched<1800000)visit=saved}catch{}}
    if(!visit||now-visit.touched>=1800000||now<visit.touched){visit={userId:actor,id:uuid(),touched:now};lastScreen=null}
    visit.touched=now;try{root.sessionStorage.setItem(SESSION,JSON.stringify(visit))}catch{}
    if(announced!==visit.id){announced=visit.id;push('session_start','app');if(root.matchMedia?.('(display-mode: standalone)').matches||root.navigator?.standalone===true)push('standalone_open','app')}
    return true;
  }
  function schedule(){if(!timer&&!flight&&queue.length)timer=setTimeout(()=>{timer=null;void flush()},800)}
  function track(name,target,extra={}){if(!session())return;push(name,target,extra);schedule()}
  function screen(id){if(!SCREENS.has(id)||!session())return;if(lastScreen!==id){lastScreen=id;push('screen_view',id)}schedule()}
  async function flush(){
    if(flight||!queue.length||!actor||!token||!enabled())return;
    const stamp=epoch,batch=queue.slice(0,20),auth=token,controller=new AbortController();flight=controller;
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await root.fetch('/api/support?resource=analytics',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({events:batch}),signal:controller.signal,keepalive:true});
      if(stamp!==epoch)return;
      if(r.ok||[400,401,403,429].includes(r.status)){queue.splice(0,batch.length);attempts=0}
      else if(++attempts>=2){queue.splice(0,batch.length);attempts=0}
    }catch{if(stamp===epoch&&++attempts>=2){queue.splice(0,batch.length);attempts=0}}
    finally{clearTimeout(timeout);if(stamp===epoch){flight=null;schedule()}}
  }
  function auth(sessionValue){
    const next=sessionValue?.user?.id||null;
    if(root.hpAccountAccess?.isRecovering?.()){clear();return}
    if(actor&&actor!==next)clear();if(actor!==next)epoch++;actor=next;token=sessionValue?.access_token||null;
    if(actor)screen(document.querySelector('.screen.on')?.id||'home');
  }
  function click(event){
    if(event.isTrusted===false)return;const el=event.target.closest?.('a,button,summary');if(!el||el.closest('#hpAdminModal,#hpSupportDialog'))return;
    const data=el.dataset;
    if(data.analyticsBusiness){track('professional_click',data.analyticsAction,{business_id:data.analyticsBusiness,business_kind:data.analyticsKind||'property'});return}
    if(el.matches?.('a')&&(data.analyticsProduct||el.closest('[data-hp-merchant="vr-expert"]'))){track('product_click',data.analyticsProduct||'vr_expert');return}
    if(el.matches?.('[data-maintenance-budget]'))return track('feature_click','plan_cost');
    if(data.action==='scenario-open')return track('feature_click','compare_scenario');
    if(el.id==='hpDiyProductsToggle'){if(el.getAttribute('aria-expanded')!=='true')track('feature_click','find_products');return}
    const action=el.getAttribute('onclick')||'';
    if(el.matches?.('.hpDiyBtn')||/^hp(?:ShowLeisureDiy|OpenDiy)\(/.test(action))return track('feature_click','diy');
    if(el.matches?.('.hpFindPro,.hpProBtn,[data-hp-diy-professional]')||/^hpFind(?:LeisurePro|Pros)\(/.test(action))return track('feature_click','find_professional');
  }
  function preference(){
    const more=document.getElementById('more');if(!more||document.getElementById('hpUsagePreference'))return;
    const box=document.createElement('section');box.id='hpUsagePreference';box.className='card';
    box.innerHTML='<h3>Statistiques d’utilisation</h3><label class="choice"><input id="hpUsageEnabled" type="checkbox">Contribuer aux statistiques d’utilisation</label><p class="muted">Nuvabri mesure les écrans consultés, certains clics et les signaux d’installation pour améliorer l’application. Les montants du budget, les noms de tes biens et tes messages ne sont pas collectés. Les statistiques présentées à l’administrateur sont regroupées. Les événements liés au compte sont supprimés après environ 90 jours.</p><p id="hpUsageState" class="muted" role="status"></p>';
    more.appendChild(box);const control=document.getElementById('hpUsageEnabled'),note=document.getElementById('hpUsageState');control.checked=enabled();control.disabled=privacySignal();
    note.textContent=privacySignal()?'La demande de confidentialité de ton navigateur désactive ces mesures.':'Ce choix s’applique aux prochaines mesures sur ce navigateur.';
    control.onchange=()=>{preferenceOverride=control.checked;try{root.localStorage.setItem(PREFERENCE,String(control.checked))}catch{}const previous={user:{id:actor},access_token:token};clear();if(control.checked)auth(previous);note.textContent=control.checked?'Mesures d’utilisation activées.':'Mesures d’utilisation désactivées.'};
  }
  async function start(){
    preference();document.addEventListener('click',click,true);document.addEventListener('hp-screen-changed',e=>screen(e.detail?.id));
    root.addEventListener('appinstalled',()=>track('app_install','browser'));
    root.addEventListener('hp-calendar-exported',()=>track('calendar_export','calendar'));
    root.addEventListener('pagehide',()=>{clearTimeout(timer);timer=null;void flush()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')screen(document.querySelector('.screen.on')?.id||'home')});
    const c=client();if(!c)return;
    c.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY')clear();else auth(s)});
    const stamp=epoch;try{const {data}=await c.auth.getSession();if(stamp===epoch)auth(data?.session)}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})(globalThis);
