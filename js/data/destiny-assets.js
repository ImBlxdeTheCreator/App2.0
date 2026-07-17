/* D2Synergy unified Destiny asset resolver.
   Official Bungie definitions remain the source of truth. This layer normalizes
   icon paths, retries exact/alternate candidates, remembers successful URLs,
   and guarantees a bundled category fallback instead of a broken image. */
(function(){
  'use strict';

  const BUILD='20260716-phase1-19-1-9';
  const HOST='https://www.bungie.net';
  const API_BASE=HOST+'/Platform';
  const API_KEY='cb3731fc41f1468fadab053d31d07abc';
  // Asset caches are intentionally independent of the D2Synergy app build.
  // Bungie icon URLs should survive normal app deploys and only be invalidated
  // when the resolver detects a bad URL or a real manifest refresh requires it.
  const SUCCESS_KEY='d2synergy_asset_success';
  const RESOLUTION_KEY='d2synergy_asset_resolution';
  const LEGACY_SUCCESS_KEYS=['d2synergy_asset_success_v19_1_8','d2synergy_asset_success_v19_1_7','d2synergy_asset_success_v19_1_6','d2synergy_asset_success_v19_1_5'];
  const LEGACY_RESOLUTION_KEYS=['d2synergy_asset_resolution_v19_1_8','d2synergy_asset_resolution_v19_1_7','d2synergy_asset_resolution_v19_1_6','d2synergy_asset_resolution_v19_1_5'];
  const FALLBACK_ROOT='assets/destiny-fallbacks/';
  const DEFAULT_TYPES={
    weapon:'DestinyInventoryItemDefinition',armor:'DestinyInventoryItemDefinition',exotic:'DestinyInventoryItemDefinition',
    perk:'DestinyInventoryItemDefinition',trait:'DestinyInventoryItemDefinition',mod:'DestinyInventoryItemDefinition',
    super:'DestinyInventoryItemDefinition',ability:'DestinyInventoryItemDefinition',aspect:'DestinyInventoryItemDefinition',
    fragment:'DestinyInventoryItemDefinition',quest:'DestinyInventoryItemDefinition',currency:'DestinyInventoryItemDefinition',
    material:'DestinyInventoryItemDefinition',engram:'DestinyInventoryItemDefinition',emblem:'DestinyInventoryItemDefinition',
    subclass:'DestinyInventoryItemDefinition',cosmetic:'DestinyInventoryItemDefinition',ghost:'DestinyInventoryItemDefinition',
    ship:'DestinyInventoryItemDefinition',sparrow:'DestinyInventoryItemDefinition',shader:'DestinyInventoryItemDefinition',
    activity:'DestinyActivityDefinition',vendor:'DestinyVendorDefinition'
  };
  const FALLBACK_NAMES=new Set(['universal','weapon','armor','exotic','perk','trait','mod','super','ability','aspect','fragment','activity','quest','currency','material','engram','vendor','emblem','subclass','cosmetic','ghost','ship','sparrow','shader']);
  const activeEntries=new Set();
  const inFlight=new Map();
  let iconObserver=null;
  let nextRequestAt=0;
  let registry={version:'19.1.9',definitionTypes:{...DEFAULT_TYPES},fallbacks:{},overrides:{}};
  try{Object.assign(registry,JSON.parse(sessionStorage.getItem('d2synergy_asset_registry')||'null')||{});}catch(_){ }
  const registryReady=fetch(`data/destiny-assets.json?v=${BUILD}`,{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(data=>{
    if(data){registry={...registry,...data,definitionTypes:{...DEFAULT_TYPES,...data.definitionTypes},fallbacks:{...registry.fallbacks,...data.fallbacks},overrides:data.overrides||{}};try{sessionStorage.setItem('d2synergy_asset_registry',JSON.stringify(registry));}catch(_){ }}
    return registry;
  }).catch(()=>registry);

  function readStore(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function readMigratedStore(primary,legacyKeys){
    const current=readStore(primary);
    for(const legacyKey of legacyKeys){
      const legacy=readStore(legacyKey);
      for(const [entry,value] of Object.entries(legacy)){if(current[entry]===undefined)current[entry]=value;}
    }
    return current;
  }
  const successful=readMigratedStore(SUCCESS_KEY,LEGACY_SUCCESS_KEYS);
  const resolved=readMigratedStore(RESOLUTION_KEY,LEGACY_RESOLUTION_KEYS);
  let saveTimer=0;
  function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(SUCCESS_KEY,JSON.stringify(successful));localStorage.setItem(RESOLUTION_KEY,JSON.stringify(resolved));}catch(_){ }},350);}
  function normalizeName(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`]/g,'').replace(/[–—]/g,'-').replace(/\s*\((arc|solar|void|stasis|strand|kinetic|prismatic)\)\s*$/i,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();}
  function normalizeType(value){
    const raw=String(value||'universal').replace(/[^a-z0-9]+/gi,'').toLowerCase();
    if(raw==='classability')return 'ability';
    if(raw==='origintrait')return 'trait';
    if(raw==='item')return 'universal';
    return FALLBACK_NAMES.has(raw)?raw:'universal';
  }
  function normalizeUrl(value){
    if(!value)return null;
    let url=String(value).trim();
    if(!url||/^(null|undefined)$/i.test(url)||/missing[_-]?icon|placeholder|blank\.png/i.test(url))return null;
    if(url.startsWith('//'))url='https:'+url;
    else if(url.startsWith('/'))url=HOST+url;
    else if(!/^[a-z][a-z0-9+.-]*:/i.test(url))url=new URL(url,document.baseURI).href;
    if(!/^https?:/i.test(url)&&!/^blob:/i.test(url)&&!/^data:image/i.test(url))return null;
    return url;
  }
  function sourceParts(source){
    if(typeof source==='string')return {name:source,hash:null,urls:[]};
    if(!source||typeof source!=='object')return {name:'',hash:null,urls:[]};
    const nested=source._def||{},dp=source.displayProperties||nested.displayProperties||{};
    const urls=[source.icon,nested.icon,dp.icon,source.primaryIcon,source.secondaryIcon,nested.secondaryIcon,dp.secondaryIcon,source.highResIcon,nested.highResIcon,source.screenshot,nested.screenshot,dp.screenshot,source.iconWatermark,nested.iconWatermark,source.iconWatermarkShelved,nested.iconWatermarkShelved,source.emblemPath,source.emblemBackgroundPath,source.backgroundPath,source.logo,source.largeIcon,source.largeTransparentIcon,source.mapIcon,source.originalDisplayProperties?.icon,source.selectionScreenDisplayProperties?.icon].map(normalizeUrl).filter(Boolean);
    const hash=source.hash??source.itemHash??source.definitionHash??source.bungieHash??nested.hash??source.activityHash??source.vendorHash??null;
    return {name:source.name||nested.name||dp.name||source.label||'',hash:hash!==null&&hash!==undefined&&String(hash)!=='0'?String(hash):null,urls:[...new Set(urls)]};
  }
  function keyFor(source,type){const p=sourceParts(source);return `${normalizeType(type)}|${p.hash||normalizeName(p.name)||p.urls[0]||'unknown'}`;}
  function fallbackFor(type){const t=normalizeType(type);return registry.fallbacks?.[t]||`${FALLBACK_ROOT}${t}.svg`;}
  function typeScore(def,type){
    const t=normalizeName(`${def?.itemTypeDisplayName||''} ${def?.itemTypeAndTierDisplayName||''} ${def?.typeName||''} ${def?.plug?.plugCategoryIdentifier||''} ${def?.plugCategoryIdentifier||''}`);
    const n=Number(def?.itemType),wanted=normalizeType(type);
    if(wanted==='weapon')return n===3||/weapon|rifle|hand cannon|sidearm|bow|glaive|sword|launcher|shotgun|sniper|fusion|machine gun|trace rifle/.test(t)?30:-30;
    if(wanted==='armor')return n===2||/armor|helmet|gauntlet|chest|leg armor|class item|cloak|mark|bond/.test(t)?30:-30;
    if(wanted==='super')return /super ability|super/.test(t)?30:-20;
    if(wanted==='aspect')return /aspect/.test(t)?30:-20;
    if(wanted==='fragment')return /fragment|facet|ember|echo|spark|whisper|thread/.test(t)?30:-15;
    if(wanted==='ability')return /ability|grenade|melee|super|aspect|fragment/.test(t)?20:0;
    if(wanted==='mod')return /mod/.test(t)?20:0;
    if(wanted==='perk'||wanted==='trait')return /perk|trait|intrinsic|artifact|mod/.test(t)?15:0;
    return 0;
  }
  async function publicFetch(path){
    const now=Date.now(),slot=Math.max(now,nextRequestAt);nextRequestAt=slot+45;if(slot>now)await new Promise(r=>setTimeout(r,slot-now));
    let last;
    for(let attempt=0;attempt<3;attempt++){
      try{const r=await fetch(API_BASE+path,{headers:{'X-API-Key':API_KEY},cache:'no-cache'});if(r.ok){const j=await r.json();if(j?.ErrorCode===1)return j.Response;last=new Error(j?.Message||`Bungie error ${j?.ErrorCode}`);}else last=new Error(`HTTP ${r.status}`);}catch(e){last=e;}
      await new Promise(r=>setTimeout(r,450*Math.pow(2,attempt)));
    }
    throw last||new Error('Bungie asset request failed');
  }
  function candidateUrlsFromDefinition(def){
    if(!def)return [];
    const dp=def.displayProperties||{};
    return [dp.icon,def.icon,dp.secondaryIcon,def.secondaryIcon,def.highResIcon,def.screenshot,dp.screenshot,def.iconWatermark,def.iconWatermarkShelved].map(normalizeUrl).filter(Boolean);
  }
  async function resolveRemote(source,type){
    await registryReady;
    const p=sourceParts(source),t=normalizeType(type),key=keyFor(source,t);
    if(resolved[key])return normalizeUrl(typeof resolved[key]==='string'?resolved[key]:resolved[key]?.url);
    if(inFlight.has(key))return inFlight.get(key);
    const task=(async()=>{
      try{
        const override=registry.overrides?.[String(p.hash)]||registry.overrides?.[normalizeName(p.name)];
        const overrideUrl=normalizeUrl(override?.icon||override);
        if(overrideUrl){resolved[key]={url:overrideUrl,hash:p.hash||null};persist();return overrideUrl;}
        if(p.hash){
          const entity=registry.definitionTypes?.[t]||DEFAULT_TYPES[t]||'DestinyInventoryItemDefinition';
          try{const def=await publicFetch(`/Destiny2/Manifest/${entity}/${p.hash}/`);const urls=candidateUrlsFromDefinition(def);if(urls[0]){resolved[key]={url:urls[0],hash:String(p.hash)};persist();return urls[0];}}catch(_){ }
        }
        const rawLookup=String(p.name||'').trim(),normalized=normalizeName(rawLookup);
        if(!normalized)return null;
        // Curated Builder names often append an element, e.g. “Storm's Edge (Arc)”.
        // Bungie's Armory search is literal enough that the suffix can prevent a match,
        // so search the canonical cleaned name first and retain the original as fallback.
        const cleanLookup=rawLookup.replace(/\s*\((arc|solar|void|stasis|strand|kinetic|prismatic)\)\s*$/i,'').trim();
        const lookups=[cleanLookup,rawLookup].filter((v,i,a)=>v&&a.indexOf(v)===i);
        let results=[];
        for(const lookup of lookups){
          try{results=(await publicFetch(`/Destiny2/Armory/Search/DestinyInventoryItemDefinition/${encodeURIComponent(lookup)}/`))?.results?.results||[];}catch(_){results=[];}
          if(results.length)break;
        }
        const ranked=results.map(r=>{let score=normalizeName(r.displayProperties?.name)===normalized?100:-100;score+=typeScore(r,t);if(r.redacted)score-=50;return {r,score};}).sort((a,b)=>b.score-a.score);
        if(ranked[0]?.score>=80){
          let def=ranked[0].r,url=candidateUrlsFromDefinition(def)[0];
          // Search results are summaries and sometimes omit display artwork. Fetch the
          // exact full definition before giving up and showing a fallback.
          if(!url&&def?.hash){try{def=await publicFetch(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${def.hash}/`);url=candidateUrlsFromDefinition(def)[0];}catch(_){ }}
          if(url){resolved[key]={url,hash:def?.hash?String(def.hash):null};persist();return url;}
        }
      }catch(_){ }
      return null;
    })().finally(()=>inFlight.delete(key));
    inFlight.set(key,task);return task;
  }
  async function candidates(source,type){
    const p=sourceParts(source),key=keyFor(source,type),urls=[...p.urls];
    if(successful[key])urls.push(normalizeUrl(successful[key]));
    if(resolved[key])urls.push(normalizeUrl(typeof resolved[key]==='string'?resolved[key]:resolved[key]?.url));
    if(!urls.length&&p.hash&&typeof window.getItemDefinition==='function'){
      try{const def=await window.getItemDefinition(p.hash);urls.push(...sourceParts(def).urls);}catch(_){ }
    }
    return [...new Set(urls.filter(Boolean))];
  }
  function markSuccess(img,url,key){img.classList.add('loaded');img.classList.remove('d2AssetFallback','iconFailed');delete img.dataset.d2AssetFallback;img.dataset.d2AssetState='live';successful[key]=url;persist();}
  function applyFallback(img,type,options={}){
    if(!img)return null;
    const t=normalizeType(type||img.dataset.d2AssetType);
    if(img.dataset.d2AssetFallback==='universal'){img.hidden=true;return null;}
    const local=normalizeUrl(fallbackFor(t));
    const universal=normalizeUrl(fallbackFor('universal'));
    img.dataset.d2AssetFallback=t==='universal'?'universal':'category';
    img.dataset.d2AssetState='fallback';img.dataset.d2AssetType=t;img.classList.add('d2AssetFallback');img.classList.remove('loaded','iconFailed');
    img.onerror=()=>{if(local!==universal){img.dataset.d2AssetFallback='universal';img.src=universal;}else img.hidden=true;};
    img.src=local||universal;return img;
  }
  async function setImage(img,source,type,options={}){
    if(!img)return null;
    const t=normalizeType(type),key=keyFor(source,t),entry={img,source,type:t,options,key,pending:true};activeEntries.add(entry);
    img.dataset.d2AssetType=t;img.dataset.d2AssetKey=key;img.referrerPolicy='no-referrer';img.decoding=options.decoding||'async';if(options.lazy!==false)img.loading='lazy';
    const urls=await candidates(source,t);let index=0,refreshed=false;const attempts=new Map();
    return await new Promise(resolve=>{
      const next=()=>{
        const url=urls[index++];
        if(!url){
          if(!refreshed){
            refreshed=true;delete resolved[key];delete successful[key];persist();
            resolveRemote(source,t).then(fresh=>{if(fresh&&!urls.includes(fresh))urls.push(fresh);next();});return;
          }
          entry.pending=false;applyFallback(img,t,options);resolve(img);return;
        }
        img.onerror=()=>{
          const count=attempts.get(url)||0;
          if(count<1&&/^https:\/\/(www\.)?bungie\.net\//i.test(url)){attempts.set(url,count+1);setTimeout(()=>{img.src=url+(url.includes('?')?'&':'?')+'d2retry=1';},350);return;}
          next();
        };
        img.onload=()=>{entry.pending=false;activeEntries.delete(entry);markSuccess(img,url,key);resolve(img);};img.src=url;
      };
      next();
    });
  }
  function createImage(source,type,options={}){const img=document.createElement('img');if(options.className)img.className=options.className;if(options.alt!==undefined)img.alt=options.alt;void setImage(img,source,type,options);return img;}
  function ensureObserver(){
    if(iconObserver||typeof IntersectionObserver==='undefined')return iconObserver;
    iconObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;iconObserver.unobserve(entry.target);entry.target.__d2AssetLoad?.();}),{rootMargin:'260px 0px'});
    return iconObserver;
  }
  function attach(container,source,type,options={}){
    if(!container)return null;
    const key=keyFor(source,type);
    if([...container.querySelectorAll('img[data-d2-asset-key]')].some(node=>node.dataset.d2AssetKey===key))return null;
    const t=normalizeType(type),img=document.createElement('img');
    img.className=`bungiePublicIcon bungiePublicIcon--${t} ${options.className||''}`.trim();img.alt=options.alt??`${sourceParts(source).name||'Destiny 2'} icon`;img.dataset.d2AssetKey=key;img.dataset.d2AssetType=t;
    if(options.size)img.style.setProperty('--bungie-icon-size',`${Number(options.size)}px`);
    container.insertBefore(img,container.firstChild);container.classList.add('hasBungiePublicIcon');
    const load=()=>{if(img.__d2AssetStarted)return;img.__d2AssetStarted=true;void setImage(img,source,t,options);};img.__d2AssetLoad=load;
    if(sourceParts(source).urls.length||options.lazy===false)load();else{applyFallback(img,t,options);const observer=ensureObserver();if(observer)observer.observe(img);else load();}
    return img;
  }
  function retryAll(){for(const entry of [...activeEntries]){if(!entry.img?.isConnected){activeEntries.delete(entry);continue;}if(entry.img.dataset.d2AssetState==='fallback'){activeEntries.delete(entry);entry.img.hidden=false;delete entry.img.dataset.d2AssetFallback;void setImage(entry.img,entry.source,entry.type,entry.options);}}}
  function inferType(img){const text=`${img.className||''} ${img.closest?.('[class]')?.className||''}`.toLowerCase();if(/emblem/.test(text))return 'emblem';if(/vendor/.test(text))return 'vendor';if(/quest/.test(text))return 'quest';if(/activity|operation|milestone/.test(text))return 'activity';if(/currency|cost/.test(text))return 'currency';if(/armor/.test(text))return 'armor';if(/weapon|item|socket|perk/.test(text))return 'weapon';return 'universal';}
  window.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement)||img.dataset.d2NoFallback==='1'||img.dataset.d2AssetKey||img.classList.contains('d2AssetFallback'))return;applyFallback(img,img.dataset.d2AssetType||inferType(img));},true);

  window.D2Assets={BUILD,HOST,normalizeUrl,normalizeName,sourceParts,fallbackFor,candidates,resolveOne:resolveRemote,setImage,createImage,attach,applyFallback,retryAll,get registry(){return registry;},get registryReady(){return registryReady;}};
  window.attachLiveIcon=function(container,source,itemType,options){return window.D2Assets.attach(container,source,itemType,options||{});};
})();
