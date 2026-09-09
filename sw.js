const CACHE='homepilot-v7-cloud-v5';
const ASSETS=['./manifest.webmanifest','./smart-equipment.js','./seasonal-auth.js','./assets/autumn-bg.svg','./assets/spring-bg.svg','./assets/summer-bg.svg','./assets/winter-bg.svg','./assets/christmas-bg.svg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

function injectRuntime(html){
  if(!html.includes('smart-equipment.js')) html=html.replace('</body>','<script src="/smart-equipment.js?v=3"></script></body>');
  if(!html.includes('seasonal-auth.js')) html=html.replace('</body>','<script src="/seasonal-auth.js?v=4"></script></body>');
  return html;
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const res=await fetch(req,{cache:'no-store'});
        let html=injectRuntime(await res.text());
        const out=new Response(html,{status:res.status,statusText:res.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
        caches.open(CACHE).then(cache=>cache.put('./index.html',out.clone()));
        return out;
      }catch(e){
        const cached=await caches.match('./index.html');
        if(cached){
          let html=injectRuntime(await cached.text());
          return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
        }
        throw e;
      }
    })());
    return;
  }
  event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res;}).catch(()=>caches.match(req)));
});