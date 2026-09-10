(function(){
  function ensureSeasonalAuthStyles(){
    if(document.getElementById('homepilot-seasonal-auth-styles')) return;
    const style=document.createElement('style');
    style.id='homepilot-seasonal-auth-styles';
    style.textContent=`
      .auth{background-color:transparent!important;overflow:auto!important;position:fixed!important;inset:0!important;isolation:isolate}
      .auth:before,.auth:after{content:none}
      .authbox{position:relative;z-index:2}
      .authbox>.brand{font-size:38px!important;letter-spacing:-1px;text-shadow:0 2px 18px #fff8}
      .authbox>.card{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid #ffffff8c;box-shadow:0 22px 45px #00000018!important}
      body[data-season="autumn"] .auth{background:linear-gradient(rgba(255,247,237,.10),rgba(247,238,228,.22)),url('/assets/autumn-leaves-v2.webp') center top/cover fixed no-repeat!important}
      body[data-season] .authbox>.card{background:color-mix(in srgb,var(--card) 96%,transparent)!important}
      body[data-season="spring"] .auth{background:linear-gradient(rgba(250,255,246,.10),rgba(244,248,237,.22)),url('/assets/spring-botanical-v2.webp') center top/cover fixed no-repeat!important}
      body[data-season="summer"] .auth{background:linear-gradient(rgba(246,255,255,.10),rgba(238,249,251,.22)),url('/assets/summer-botanical-v2.webp') center top/cover fixed no-repeat!important}
      body[data-season="winter"] .auth{background:linear-gradient(rgba(248,253,255,.10),rgba(237,244,248,.22)),url('/assets/winter-botanical-v2.webp') center top/cover fixed no-repeat!important}
      body[data-season="christmas"] .auth{background:linear-gradient(rgba(255,250,244,.10),rgba(245,239,231,.22)),url('/assets/christmas-botanical-v2.webp') center top/cover fixed no-repeat!important}
      body[data-season="autumn"] .authbox>.brand{color:#9c3f22!important}
      body[data-season="spring"] .authbox>.brand{color:#477d4c!important}
      body[data-season="summer"] .authbox>.brand{color:#0e8396!important}
      body[data-season="winter"] .authbox>.brand{color:#2b6078!important}
      body[data-season="christmas"] .authbox>.brand{color:#28583e!important}
      @media(max-width:640px){
        .auth{padding-top:max(22px,env(safe-area-inset-top))!important}
        .authbox{margin-top:10vh!important}
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureSeasonalAuthStyles);else ensureSeasonalAuthStyles();
  setTimeout(ensureSeasonalAuthStyles,100);
})();
