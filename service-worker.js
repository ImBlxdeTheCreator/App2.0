const CACHE='d2synergy-v19-0-2-stable';
const VERSION='20260716-stable-19-0-2';
// Keep installation small. Feature scripts are cached on first use instead of
// delaying service-worker installation with the entire application.
const PRECACHE=[
  './','./index.html','./offline.html',`./manifest.webmanifest?v=19.0.2`,
  './assets/brand/ghost-loader.webp','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png',
  `./css/base.css?v=${VERSION}`,`./css/inventory.css?v=${VERSION}`,`./css/activities-vendors.css?v=${VERSION}`,
  `./css/layout.css?v=${VERSION}`,`./css/readout.css?v=${VERSION}`,`./css/builder-blueprint.css?v=${VERSION}`,
  `./js/ui/loader.js?v=${VERSION}`,`./js/core/bootstrap.js?v=${VERSION}`,`./js/pwa/startup.js?v=${VERSION}`
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);await Promise.allSettled(PRECACHE.map(url=>cache.add(new Request(url,{cache:'reload'}))));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{const response=await fetch(request,{cache:'no-cache'});if(response?.ok)await cache.put('./index.html',response.clone());return response;}
  catch{return(await cache.match('./index.html'))||(await cache.match('./offline.html'))||Response.error();}
}
async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);const cached=await cache.match(request);
  const fresh=fetch(request).then(async response=>{if(response?.ok)await cache.put(request,response.clone());return response;}).catch(()=>null);
  return cached||(await fresh)||Response.error();
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(request.mode==='navigate'?networkFirst(request):staleWhileRevalidate(request));
});
