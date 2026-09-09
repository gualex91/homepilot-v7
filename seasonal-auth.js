(function(){
  function ensureSeasonalAuthStyles(){
    if(document.getElementById('homepilot-seasonal-auth-styles')) return;
    const style=document.createElement('style');
    style.id='homepilot-seasonal-auth-styles';
    style.textContent=`
      .auth{background-color:transparent!important;overflow:auto!important;position:fixed!important;inset:0!important;isolation:isolate}
      .auth:before,.auth:after{content:"";position:fixed;pointer-events:none;z-index:0;background-repeat:no-repeat;background-size:contain;filter:drop-shadow(0 12px 24px #0003)}
      .auth:before{left:-24px;top:10px;width:290px;height:290px}
      .auth:after{right:-30px;bottom:0;width:310px;height:310px;transform:rotate(10deg)}
      .authbox{position:relative;z-index:2}
      .authbox>.brand{font-size:38px!important;letter-spacing:-1px;text-shadow:0 2px 18px #fff8}
      .authbox>.card{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid #ffffff8c;box-shadow:0 22px 45px #00000018!important}
      body[data-season="autumn"] .auth{background:linear-gradient(rgba(255,247,237,.20),rgba(247,238,228,.58)),url('/assets/autumn-bg.svg?v=6') center top/cover fixed no-repeat!important}
      body[data-season="autumn"] .auth:before,body[data-season="autumn"] .auth:after{background-image:url('/assets/autumn-bg.svg?v=6')}
      body[data-season="spring"] .auth{background:linear-gradient(rgba(250,255,246,.20),rgba(244,248,237,.60)),url('/assets/spring-bg.svg?v=6') center top/cover fixed no-repeat!important}
      body[data-season="spring"] .auth:before,body[data-season="spring"] .auth:after{background-image:url('/assets/spring-bg.svg?v=6')}
      body[data-season="summer"] .auth{background:linear-gradient(rgba(246,255,255,.18),rgba(238,249,251,.56)),url('/assets/summer-bg.svg?v=6') center top/cover fixed no-repeat!important}
      body[data-season="summer"] .auth:before,body[data-season="summer"] .auth:after{background-image:url('/assets/summer-bg.svg?v=6')}
      body[data-season="winter"] .auth{background:linear-gradient(rgba(248,253,255,.20),rgba(237,244,248,.60)),url('/assets/winter-bg.svg?v=6') center top/cover fixed no-repeat!important}
      body[data-season="winter"] .auth:before,body[data-season="winter"] .auth:after{background-image:url('/assets/winter-bg.svg?v=6')}
      body[data-season="christmas"] .auth{background:linear-gradient(rgba(255,250,244,.18),rgba(245,239,231,.58)),url('/assets/christmas-bg.svg?v=6') center top/cover fixed no-repeat!important}
      body[data-season="christmas"] .auth:before,body[data-season="christmas"] .auth:after{background-image:url('/assets/christmas-bg.svg?v=6')}
      body[data-season="autumn"] .authbox>.brand{color:#9c3f22!important}
      body[data-season="spring"] .authbox>.brand{color:#477d4c!important}
      body[data-season="summer"] .authbox>.brand{color:#0e8396!important}
      body[data-season="winter"] .authbox>.brand{color:#2b6078!important}
      body[data-season="christmas"] .authbox>.brand{color:#28583e!important}
      @media(max-width:640px){
        .auth{padding-top:max(22px,env(safe-area-inset-top))!important}
        .authbox{margin-top:10vh!important}
        .auth:before{width:250px;height:250px;left:-45px;top:30px}
        .auth:after{width:270px;height:270px;right:-55px;bottom:20px}
        .authbox>.card{background:color-mix(in srgb,var(--card) 84%,transparent)!important}
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureSeasonalAuthStyles);else ensureSeasonalAuthStyles();
  setTimeout(ensureSeasonalAuthStyles,100);
})();