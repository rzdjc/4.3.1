const CACHE='gym-tracker-v6-redesign-2';
const ASSETS=['./','./index.html','./css/style.css','./css/v43.css','./css/v5.css','./css/justin-theme.css','./css/redesign.css','./js/vendor/supabase.min.js','./js/app.js','./js/v43.js','./js/redesign.js','./js/sync.js','./manifest.json','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png','./icons/apple-touch-icon.png','./icons/favicon-32.png','./images/press.jpg','./images/raise.jpg','./images/equipment.jpg','./images/bench-rest.jpg','./images/wraps-portrait.jpg'];
// Large, rarely-changing assets: fine to serve cache-first.
const STABLE=/\/(vendor|images|icons)\//;

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;

 if(STABLE.test(req.url)){
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res})));
  return;
 }
 // App shell (HTML/CSS/JS): always try the network first, bypassing HTTP cache too,
 // so a normal reload picks up a new deploy instead of needing a hard refresh.
 // Cache is only the offline fallback.
 e.respondWith(
  fetch(req,{cache:'no-store'}).then(res=>{
   const copy=res.clone();
   caches.open(CACHE).then(c=>c.put(req,copy));
   return res;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
 );
});
