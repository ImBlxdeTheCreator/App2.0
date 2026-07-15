const CACHE='d2synergy-shell-v9';
const VERSION='20260715-performance-9';
const PRECACHE=[
  './','./index.html','./offline.html',
  `./manifest.webmanifest?v=9`,
  './assets/brand/ghost-loader.webp',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png',
  `./css/base.css?v=${VERSION}`,`./css/inventory.css?v=${VERSION}`,
  `./css/activities-vendors.css?v=${VERSION}`,`./css/layout.css?v=${VERSION}`,`./css/readout.css?v=${VERSION}`,
  `./js/ui/loader.js?v=${VERSION}`,`./js/core/bootstrap.js?v=${VERSION}`,`./js/pwa/startup.js?v=${VERSION}`,
  `./js/data/subclasses.js?v=${VERSION}`,`./js/data/abilities.js?v=${VERSION}`,
  `./js/data/exotics.js?v=${VERSION}`,`./js/data/weapons.js?v=${VERSION}`,
  `./js/data/armor.js?v=${VERSION}`,`./js/data/artifacts.js?v=${VERSION}`,
  `./js/core/state.js?v=${VERSION}`,`./js/core/synergy-engine.js?v=${VERSION}`,
  `./js/ui/builder.js?v=${VERSION}`,`./js/ui/readout.js?v=${VERSION}`,
  `./js/api/bungie.js?v=${VERSION}`,`./js/features/vault.js?v=${VERSION}`,
  `./js/features/activities-vendors.js?v=${VERSION}`,`./js/features/live-character-sync.js?v=${VERSION}`,
  `./js/features/item-detail.js?v=${VERSION}`,`./js/features/finalize-loadout.js?v=${VERSION}`,
  `./js/features/loadouts.js?v=${VERSION}`,`./js/ui/workspaces.js?v=${VERSION}`
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // A single optional asset should never prevent the service worker from
    // installing, so cache entries independently.
    await Promise.allSettled(PRECACHE.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(response?.ok) await cache.put('./index.html',response.clone());
    return response;
  }catch(error){
    return (await cache.match('./index.html')) || (await cache.match('./offline.html')) || Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  const fresh=fetch(request).then(async response=>{
    if(response?.ok) await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  return cached || (await fresh) || Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin) return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
