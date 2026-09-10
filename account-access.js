(function(root){
  'use strict';
  const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  function recoveryHint(location){
    const hash=new URLSearchParams((location?.hash||'').replace(/^#/,''));
    const search=new URLSearchParams(location?.search||'');
    return hash.get('type')==='recovery'||search.get('recovery')==='1';
  }
  function errorText(error){
    if(error?.status===429||/rate_limit|over_email_send_rate_limit/.test(error?.code||''))return 'Trop de tentatives. Attends quelques minutes avant de réessayer.';
    if(/weak_password|same_password/.test(error?.code||''))return 'Choisis un autre mot de passe, plus long et difficile à deviner.';
    if(error?.code==='email_not_confirmed')return 'Confirme ton courriel avant de te connecter. Vérifie aussi les indésirables.';
    if(error?.code==='invalid_credentials')return 'Courriel ou mot de passe incorrect.';
    return 'Impossible de terminer pour le moment. Vérifie ta connexion puis réessaie.';
  }
  const api={validEmail,recoveryHint,errorText};root.hpAccountAccess=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id);
  let client,boot,screen='signup',recovery=recoveryHint(root.location),session=null,busy=false,booted=null,passwordSaved=false;
  const returnURL=new URL('/',root.location.origin).href;
  function say(message){const el=$('am');if(el)el.textContent=message}
  function paint(){
    const main=$('hpAuthForm'),reset=$('hpRecoveryForm');if(!main||!reset)return;
    const changing=screen==='update'||screen==='expired';
    main.hidden=changing;reset.hidden=!changing;
    $('nameWrap').classList.toggle('hidden',screen!=='signup');
    $('hpPasswordWrap').hidden=screen==='request';
    $('pw').required=screen==='login'||screen==='signup';
    $('pw').minLength=screen==='signup'?12:1;
    $('pw').autocomplete=screen==='signup'?'new-password':'current-password';
    $('hpPasswordHelp').hidden=screen!=='signup';
    $('hpForgotPassword').hidden=screen!=='login';
    $('ab').textContent=screen==='request'?'Recevoir un lien':screen==='login'?'Se connecter':'Créer mon compte';
    $('ab').disabled=busy;
    $('hpAuthHeading').textContent=screen==='request'?'Retrouver mon accès':screen==='login'?'Connexion':screen==='signup'?'Créer mon compte':'Nouveau mot de passe';
    $('hpAuthModes').hidden=recovery;
    $('hpNewPassword').disabled=screen!=='update'||passwordSaved;
    $('hpConfirmPassword').disabled=screen!=='update'||passwordSaved;
    $('hpSavePassword').disabled=busy||screen!=='update';
    $('hpSavePassword').textContent=passwordSaved?'Terminer et me reconnecter':'Enregistrer et me reconnecter';
    $('hpNewPassword').required=screen==='update'&&!passwordSaved;
    $('hpConfirmPassword').required=screen==='update'&&!passwordSaved;
    $('hpRequestAgain').hidden=screen!=='expired';
    $('hpRecoveryHint').textContent=screen==='expired'?'Ce lien est expiré ou invalide. Demande un nouveau lien.':'Choisis au moins 12 caractères. Après le changement, une reconnexion sera demandée sur tes appareils.';
    $('hpAuthLogin').setAttribute('aria-pressed',String(screen==='login'));
    $('hpAuthSignup').setAttribute('aria-pressed',String(screen==='signup'));
  }
  function render(mode){if(recovery){paint();return}screen=mode==='login'?'login':'signup';say('');paint()}
  function requestResetView(){if(recovery)return;screen='request';say('');paint();$('em').focus()}
  async function openSession(value){
    if(recovery||!value?.user||booted===value.user.id)return;
    booted=value.user.id;
    if($('hpLoadError'))$('hpLoadError').hidden=true;
    try{await boot(value)}catch{
      booted=null;
      if($('hpLoadError'))$('hpLoadError').hidden=false;
      if($('hpRetryLoad'))$('hpRetryLoad').onclick=()=>openSession(value);
      $('setup')?.classList.add('hidden');$('hc')?.classList.add('hidden');
      say('Le compte est connecté, mais les données n’ont pas pu charger. Réessaie le chargement.');
    }
  }
  function recover(value){
    recovery=true;session=value||null;screen=value?.user?'update':'expired';
    $('auth')?.classList.remove('hidden');paint();say('');
  }
  async function submit(){
    if(busy||recovery||!client)return;
    const email=$('em').value.trim().toLowerCase(),password=$('pw').value;
    if(!validEmail(email)){say('Entre un courriel valide.');return}
    if(screen!=='request'&&(screen==='signup'?password.length<12:!password)){say(screen==='signup'?'Choisis un mot de passe d’au moins 12 caractères.':'Entre ton mot de passe.');return}
    busy=true;paint();say('');
    try{
      if(screen==='request'){
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:returnURL});
        if(error)throw error;
        say('Si un compte correspond à ce courriel, tu recevras un lien de récupération. Vérifie aussi les indésirables.');
      }else{
        const result=screen==='signup'
          ?await client.auth.signUp({email,password,options:{emailRedirectTo:returnURL,data:{display_name:$('nm').value.trim()||email.split('@')[0]}}})
          :await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        $('pw').value='';
        if(result.data?.session)await openSession(result.data.session);
        else say('Vérifie ton courriel pour confirmer ton accès, puis connecte-toi. Si tu as déjà un compte, utilise Connexion.');
      }
    }catch(error){say(errorText(error))}finally{busy=false;paint()}
  }
  async function savePassword(event){
    event?.preventDefault();if(busy||!recovery||!session?.user||screen!=='update')return;
    const password=$('hpNewPassword').value;
    if(!passwordSaved&&(password.length<12||password!==$('hpConfirmPassword').value)){
      say(password.length<12?'Choisis au moins 12 caractères.':'Les deux mots de passe doivent être identiques.');return;
    }
    busy=true;paint();say('');
    try{
      if(!passwordSaved){
        const {error}=await client.auth.updateUser({password});if(error)throw error;
        passwordSaved=true;$('hpNewPassword').value='';$('hpConfirmPassword').value='';
      }
      const {error}=await client.auth.signOut({scope:'global'});if(error)throw error;
      recovery=false;session=null;booted=null;passwordSaved=false;screen='login';
      root.history.replaceState(null,'',returnURL);paint();say('Mot de passe modifié. Connecte-toi avec le nouveau.');
    }catch(error){say(passwordSaved?'Mot de passe modifié, mais la déconnexion n’a pas pu être confirmée. Réessaie pour terminer.':errorText(error))}
    finally{busy=false;paint()}
  }
  async function cancelRecovery(){
    if(busy)return;busy=true;paint();
    try{
      const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
      recovery=false;session=null;booted=null;passwordSaved=false;screen='request';
      root.history.replaceState(null,'',returnURL);paint();say('Entre ton courriel pour recevoir un nouveau lien.');
    }catch(error){say(errorText(error))}finally{busy=false;paint()}
  }
  function start(supabase,bootFn){
    client=supabase;boot=bootFn;
    $('hpAuthForm').addEventListener('submit',event=>{event.preventDefault();submit()});
    $('hpRecoveryForm').addEventListener('submit',savePassword);
    $('hpForgotPassword').onclick=requestResetView;
    $('hpRequestAgain').onclick=cancelRecovery;$('hpCancelRecovery').onclick=cancelRecovery;
    $('hpAuthLogin').onclick=()=>render('login');$('hpAuthSignup').onclick=()=>render('signup');
    const urlError=new URLSearchParams(root.location.hash.replace(/^#/,'')).has('error');
    if(recovery||urlError)recover(null);else paint();
    // No asynchronous Supabase calls inside this callback: callbacks run under the auth lock.
    client.auth.onAuthStateChange((event,value)=>{
      if(event==='PASSWORD_RECOVERY'){recover(value);return}
      if(event==='SIGNED_OUT'){booted=null;if(!recovery)root.location.reload();return}
      if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){
        if(recovery){if(value?.user)recover(value);return}
        if(value)setTimeout(()=>openSession(value),0);
      }
    });
    client.auth.getSession().then(({data,error})=>{
      if(error){if(recovery)recover(null);else say(errorText(error));return}
      if(recovery){if(data?.session)recover(data.session);return}
      return openSession(data?.session);
    }).catch(error=>say(errorText(error)));
  }
  Object.assign(api,{start,render,submit,requestResetView,isRecovering:()=>recovery});
})(globalThis);
