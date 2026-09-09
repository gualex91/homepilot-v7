(function(){
  function client(){return window.sb||window.supabaseClient||window.client||null}
  function banner(text,ok){let b=document.getElementById('hpRbqAuto');if(!b){b=document.createElement('div');b.id='hpRbqAuto';b.className='notice';b.style='position:fixed;left:12px;right:12px;bottom:82px;z-index:130;max-width:560px;margin:auto;box-shadow:0 10px 28px #0003';document.body.appendChild(b)}b.innerHTML=text;if(ok)setTimeout(()=>b.remove(),7000)}
  async function importedCount(c){try{const {count,error}=await c.from('professional_profiles').select('id',{count:'exact',head:true}).eq('source','rbq_open_data');return error?0:(count||0)}catch(e){return 0}}
  async function run(){const c=client();if(!c)return;try{const {data:{user}}=await c.auth.getUser();if(!user)return;const {data:adm}=await c.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(!adm)return;
    const existing=await importedCount(c);
    if(existing>1000){localStorage.setItem('hp_rbq_auto_import_v1','done');banner('<b>✓ Répertoire RBQ prêt</b><br>'+existing.toLocaleString('fr-CA')+' professionnels sont disponibles dans HomePilot.',true);return}
    const done=localStorage.getItem('hp_rbq_auto_import_v1');if(done==='done')return;
    banner('<b>🏗 Import RBQ Québec</b><br>HomePilot prépare le répertoire des professionnels. Tu peux continuer à utiliser l’application.');
    const {data,error}=await c.functions.invoke('import-rbq-professionals');
    const after=await importedCount(c);
    if(after>1000){localStorage.setItem('hp_rbq_auto_import_v1','done');banner('<b>✓ Répertoire RBQ prêt</b><br>'+after.toLocaleString('fr-CA')+' professionnels sont disponibles dans HomePilot.',true);window.dispatchEvent(new Event('hp-professionals-updated'));return}
    if(error){console.error(error);banner('<b>Import RBQ en attente</b><br>Le répertoire n’est pas encore prêt. HomePilot réessaiera automatiquement.');return}
    localStorage.setItem('hp_rbq_auto_import_v1','done');const n=data?.profiles_imported||0;banner('<b>✓ Répertoire RBQ importé</b><br>'+(n?n.toLocaleString('fr-CA')+' professionnels ajoutés ou mis à jour.':'Les données RBQ sont déjà à jour.'),true);window.dispatchEvent(new Event('hp-professionals-updated'))
  }catch(e){console.error(e)}}
  function start(){setTimeout(run,1800);const c=client();if(c?.auth?.onAuthStateChange)c.auth.onAuthStateChange(()=>setTimeout(run,800))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();