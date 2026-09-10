(function(){
  const STORAGE_KEY='hp_rbq_auto_import_v1';
  let completed=false,running=false,attempted=false;
  function wasCompleted(){try{return localStorage.getItem(STORAGE_KEY)==='done'}catch{return false}}
  function markCompleted(){completed=true;try{localStorage.setItem(STORAGE_KEY,'done')}catch{}}
  function client(){return window.sb||window.supabaseClient||window.client||null}
  function banner(text,ok){let b=document.getElementById('hpRbqAuto');if(!b){b=document.createElement('div');b.id='hpRbqAuto';b.className='notice';b.style='position:fixed;left:12px;right:12px;bottom:82px;z-index:130;max-width:560px;margin:auto;box-shadow:0 10px 28px #0003';document.body.appendChild(b)}b.innerHTML=text;if(ok)setTimeout(()=>b.remove(),7000)}
  async function importedCount(c){try{const {count,error}=await c.from('professional_profiles').select('id',{count:'exact',head:true}).eq('source','rbq_open_data');return error||typeof count!=='number'?null:count}catch{return null}}
  async function run(){
    if(completed||running||attempted)return;
    if(wasCompleted()){completed=true;return}
    const c=client();if(!c)return;running=true;
    try{const {data:{user}}=await c.auth.getUser();if(!user)return;const {data:adm}=await c.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(!adm)return;
    const existing=await importedCount(c);
    // A count failure is not evidence of an empty directory. Never import on it.
    if(existing===null)return;
    if(existing>1000){markCompleted();return}
    attempted=true;
    banner('<b>🏗 Import RBQ Québec</b><br>Nuvabri prépare le répertoire des professionnels. Tu peux continuer à utiliser l’application.');
    const {data,error}=await c.functions.invoke('import-rbq-professionals');
    const after=await importedCount(c);
    if(after!==null&&after>1000){markCompleted();banner('<b>✓ Import RBQ terminé</b><br>Les fiches importées sont consultables dans l’espace admin. Seules les fiches admissibles sont publiées.',true);window.dispatchEvent(new Event('hp-professionals-updated'));return}
    if(error){console.error(error);banner('<b>Import RBQ non confirmé</b><br>Consulte l’espace admin pour vérifier le répertoire.',true);return}
    if(after===null){banner('<b>Import RBQ non confirmé</b><br>Consulte l’espace admin pour vérifier le répertoire.',true);return}
    markCompleted();const n=data?.profiles_imported||0;banner('<b>✓ Répertoire RBQ importé</b><br>'+(n?n.toLocaleString('fr-CA')+' fiches ajoutées ou mises à jour.':'Les données RBQ sont déjà à jour.'),true);window.dispatchEvent(new Event('hp-professionals-updated'))
  }catch(e){console.error(e)}finally{running=false}}
  function start(){document.getElementById('hpRbqAuto')?.remove();setTimeout(run,1800);const c=client();if(c?.auth?.onAuthStateChange)c.auth.onAuthStateChange(event=>{if(event==='INITIAL_SESSION'||event==='SIGNED_IN')setTimeout(run,800)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
