const CACHE='d2synergy-v19-1-0-phase1';
const BUNGIE_ASSET_CACHE='d2synergy-bungie-assets-v19-1-0';
const VERSION='20260716-phase1-19-1-0';
const FALLBACKS=[
  'universal','weapon','armor','exotic','perk','trait','mod','super','ability','aspect','fragment',
  'activity','quest','currency','material','engram','vendor','emblem','subclass','cosmetic','ghost','ship','sparrow','shader'
].map(name=>`./assets/destiny-fallbacks/${name}.svg`);
const PRECACHE=[
  './','./index.html','./offline.html',`./manifest.webmanifest?v=19.1.0`,
  './assets/brand/ghost-loader.webp','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png',
  './data/destiny-assets.json',...FALLBACKS,
  `./css/base.css?v=${VERSION}`,`./css/inventory.css?v=${VERSION}`,`./css/activities-vendors.css?v=${VERSION}`,
  `./css/layout.css?v=${VERSION}`,`./css/readout.css?v=${VERSION}`,`./css/builder-blueprint.css?v=${VERSION}`,
  `./js/ui/loader.js?v=${VERSION}`,`./js/ui/themes.js?v=${VERSION}`,`./js/core/bootstrap.js?v=${VERSION}`,`./js/pwa/startup.js?v=${VERSION}`,
  `./js/data/destiny-assets.js?v=${VERSION}`
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(PRECACHE.map(url=>cache.add(new Request(url,{cache:'reload'}))));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>![CACHE,BUNGIE_ASSET_CACHE].includes(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{const response=await fetch(request,{cache:'no-cache'});if(response?.ok)await cache.put('./index.html',response.clone());return response;}
  catch{return(await cache.match('./index.html'))||(await cache.match('./offline.html'))||Response.error();}
}
async function staleWhileRevalidate(request,cacheName=CACHE){
  const cache=await caches.open(cacheName),cached=await cache.match(request);
  const fresh=fetch(request).then(async response=>{if(response&&(response.ok||response.type==='opaque'))await cache.put(request,response.clone());return response;}).catch(()=>null);
  return cached||(await fresh)||Response.error();
}
async function bungieImage(request){
  const response=await staleWhileRevalidate(request,BUNGIE_ASSET_CACHE);
  return response&&response.type!=='error'?response:Response.error();
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  const isBungieImage=request.destination==='image'&&/^(www\.)?bungie\.net$/i.test(url.hostname)&&url.pathname.startsWith('/common/destiny2_content/');
  if(isBungieImage){event.respondWith(bungieImage(request));return;}
  if(url.origin!==self.location.origin)return;
  event.respondWith(request.mode==='navigate'?networkFirst(request):staleWhileRevalidate(request));
});
