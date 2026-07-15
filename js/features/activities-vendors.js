/* Activities, reset timing, live events, and vendor windows
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 3 — VENDOR INVENTORIES + DAILY/WEEKLY ACTIVITIES WINDOWS
   Activities are powered by the PUBLIC Milestones endpoint (no auth needed),
   so they work signed-out. Vendors use GetVendors (components 400+402) and
   require the signed-in session + ReadDestinyVendorsAndAdvisors scope.
   Reset countdowns are calculated in UTC. Activity and limited-event visibility
   is driven by Bungie's live milestone/profile components rather than a hard-coded schedule.
   ========================================================================= */

// Generic (non-item) manifest entity fetch, cached in memory (kept out of the
// persisted item cache to avoid bloating localStorage with big definitions).
const manifestEntityCache = {};
const __entInFlight = {};
async function getManifestEntity(type, hash){
  const key = type+':'+hash;
  if(manifestEntityCache[key]) return manifestEntityCache[key];
  if(__entInFlight[key]) return __entInFlight[key];
  __entInFlight[key] = (async ()=>{
    try { const def = await bungieGet(`/Destiny2/Manifest/${type}/${hash}/`); manifestEntityCache[key]=def; return def; }
    finally { delete __entInFlight[key]; }
  })();
  return __entInFlight[key];
}

// ---- Reset / event timing (all anchored to 17:00 UTC) ----
function nextDailyReset(){
  const now = new Date();
  const r = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17,0,0));
  if(r <= now) r.setUTCDate(r.getUTCDate()+1);
  return r;
}
function nextWeeklyReset(){ // Tuesday (UTC day 2) at 17:00 UTC
  const now = new Date();
  const r = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17,0,0));
  while(r.getUTCDay()!==2 || r<=now){ r.setUTCDate(r.getUTCDate()+1); }
  return r;
}
function fmtCountdown(target){
  let ms = target - new Date();
  if(ms < 0) ms = 0;
  const d=Math.floor(ms/86400000); ms-=d*86400000;
  const h=Math.floor(ms/3600000); ms-=h*3600000;
  const m=Math.floor(ms/60000);
  return (d?d+'d ':'') + h + 'h ' + m + 'm';
}
// Trials of Osiris and Iron Banner ALTERNATE weekends — they don't both run
// on a fixed Fri-Tue schedule every week (confirmed: e.g. the week of July 3
// 2026 had Iron Banner running instead of Trials). So this can't be
// determined from day-of-week math alone; it has to check Bungie's real
// live Milestones data for which one (if either) is actually active right
// now. Cached briefly so repeated checks (Activities + Vendors overlays)
// don't each trigger their own fetch.
let liveEventCache = {checkedAt: 0, trialsActive: false, ironBannerActive: false, trialsEnd: null, ironBannerEnd: null};
async function refreshLiveEvents(){
  if(Date.now() - liveEventCache.checkedAt < 60000) return liveEventCache; // cached for 1 min
  try {
    const ms = await bungieGet('/Destiny2/Milestones/');
    let trialsActive = false, ironBannerActive = false, trialsEnd = null, ironBannerEnd = null;
    await Promise.all(Object.keys(ms).map(async (hash)=>{
      try {
        const def = await getManifestEntity('DestinyMilestoneDefinition', hash);
        const name = (def?.displayProperties?.name || '').toLowerCase();
        if(!name) return;
        if(name.includes('trials') && ms[hash].endDate){ trialsActive = true; trialsEnd = new Date(ms[hash].endDate); }
        if(name.includes('iron banner') && ms[hash].endDate){ ironBannerActive = true; ironBannerEnd = new Date(ms[hash].endDate); }
      } catch(e){}
    }));
    liveEventCache = {checkedAt: Date.now(), trialsActive, ironBannerActive, trialsEnd, ironBannerEnd};
  } catch(e){ /* leave cache as-is (likely stale-but-safe) on a failed fetch */ }
  return liveEventCache;
}
function trialsEnds(){ return liveEventCache.trialsEnd || nextWeeklyReset(); }

// Only one full-screen overlay open at a time.
function closeAllOverlays(){
  ['vaultFsOverlay','vendorsOverlay','activitiesOverlay'].forEach(id=>{
    const o = document.getElementById(id); if(o) o.classList.remove('open');
  });
  closeFsMenu();
}

/* ---------------- ACTIVITIES WINDOW ---------------- */
const activitiesOverlay = document.getElementById('activitiesOverlay');
function openActivitiesWindow(){
  closeAllOverlays();
  activitiesOverlay.classList.add('open');
  document.body.style.overflow='hidden';
  loadActivities();
}
function closeActivitiesWindow(){ activitiesOverlay.classList.remove('open'); document.body.style.overflow=''; }

const MILESTONE_TYPE = {1:{n:'Tutorial'},2:{n:'One Time'},3:{n:'Weekly',cls:'tagWeekly'},4:{n:'Daily',cls:'tagDaily'},5:{n:'Special',cls:'tagSpecial'}};
const OPERATION_LANES=[
  {id:'vanguard',name:'Vanguard Ops',subtitle:'Solo • Fireteam • Arena • Pinnacle',match:/solo ops|fireteam ops|arena ops|pinnacle ops|vanguard|nightfall|strike|onslaught|the coil|contest of elders|crawls/i},
  {id:'crucible',name:'Crucible Ops',subtitle:'Rotators • Competitive • Trials',match:/crucible|competitive|trials|iron banner|control|clash|rift|heavy metal|sparrow racing|mayhem|rumble/i},
  {id:'gambit',name:'Gambit Ops',subtitle:'PvEvP rotations and rewards',match:/gambit/i},
  {id:'rad',name:'Raids & Dungeons',subtitle:'Weekly challenges • Pantheon • RAD',match:/raid|dungeon|pantheon|raid and dungeon|\brad\b/i},
];

function operationAbsoluteIcon(path){return path?(/^https?:\/\//i.test(path)?path:'https://www.bungie.net'+(String(path).startsWith('/')?'':'/')+path):null;}
function collectNumericHashes(value,keyNames,out=new Set(),depth=0){
  if(depth>8||value==null)return out;
  if(Array.isArray(value)){value.forEach(v=>collectNumericHashes(v,keyNames,out,depth+1));return out;}
  if(typeof value!=='object')return out;
  Object.entries(value).forEach(([key,v])=>{
    if(keyNames.has(key)){
      const values=Array.isArray(v)?v:[v];
      values.forEach(x=>{const n=Number(x);if(Number.isFinite(n)&&n>0)out.add(n);});
    }
    collectNumericHashes(v,keyNames,out,depth+1);
  });
  return out;
}
function collectRewardHashesFromDefinition(def){
  const hashes=new Set();
  collectNumericHashes(def?.rewards||{},new Set(['itemHash']),hashes);
  return [...hashes];
}
async function enrichOperationContextsFromSignedInProfile(activityContexts){
  // Public milestones are available while signed out. When an authenticated
  // profile exists, CharacterActivities adds the currently available Director
  // nodes and modifiers that do not always appear in the public milestone feed.
  try{
    if(typeof getValidAccessToken!=='function'||typeof getMembershipsForCurrentUser!=='function')return 0;
    const auth=await getValidAccessToken();
    if(!auth)return 0;
    const membership=await getMembershipsForCurrentUser(auth.access_token);
    const response=await fetch(`${BUNGIE_BASE}/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200,204`,{
      headers:{'X-API-Key':BUNGIE_API_KEY,'Authorization':'Bearer '+auth.access_token},
    }).then(r=>r.json());
    const profile=handleBungieJson(response);
    const characterIds=Object.keys(profile.characters?.data||{});
    // The activity availability is broadly shared. One character avoids
    // duplicating the same Director node three times while retaining gating.
    const first=characterIds[0];
    const available=first?(profile.characterActivities?.data?.[first]?.availableActivities||[]):[];
    available.forEach(activity=>{
      const activityHash=Number(activity.activityHash||0);
      if(!activityHash)return;
      const existing=activityContexts.get(activityHash)||{modeHashes:[],modifierHashes:[],rewardItemHashes:[],endDate:null,milestoneName:''};
      if(activity.activityModeHash)existing.modeHashes.push(activity.activityModeHash);
      (activity.activityModeHashes||[]).forEach(h=>existing.modeHashes.push(h));
      (activity.modifierHashes||[]).forEach(h=>existing.modifierHashes.push(h));
      existing.milestoneName=existing.milestoneName||'Current Director rotation';
      activityContexts.set(activityHash,existing);
    });
    return available.length;
  }catch(error){
    // Signed-out mode and profiles that hide activity data still retain the
    // public milestone view, so enrichment failures are intentionally nonfatal.
    return 0;
  }
}
function classifyOperationLane(model){
  const text=`${model.name} ${model.desc} ${(model.modeNames||[]).join(' ')} ${(model.modifierNames||[]).join(' ')}`;
  return OPERATION_LANES.find(l=>l.match.test(text))?.id||null;
}
async function resolveOperationActivity(activityHash,context){
  try{
    const def=await getManifestEntity('DestinyActivityDefinition',activityHash);
    if(!def?.displayProperties?.name)return null;
    const modeHashes=new Set([...(def.activityModeHashes||[])]);
    if(def.directActivityModeHash)modeHashes.add(def.directActivityModeHash);
    (context.modeHashes||[]).forEach(h=>modeHashes.add(h));
    const modifierHashes=[...new Set(context.modifierHashes||[])].slice(0,8);
    const [modeDefs,modifierDefs]=await Promise.all([
      Promise.all([...modeHashes].slice(0,5).map(h=>getManifestEntity('DestinyActivityModeDefinition',h).catch(()=>null))),
      Promise.all(modifierHashes.map(h=>getManifestEntity('DestinyActivityModifierDefinition',h).catch(()=>null))),
    ]);
    const rewards=collectRewardHashesFromDefinition(def);
    (context.rewardItemHashes||[]).forEach(h=>rewards.push(h));
    const model={
      hash:Number(activityHash),name:def.displayProperties.name,desc:def.displayProperties.description||'',
      icon:operationAbsoluteIcon(def.displayProperties.icon),
      modeNames:modeDefs.map(d=>d?.displayProperties?.name).filter(Boolean),
      modifierNames:modifierDefs.map(d=>d?.displayProperties?.name).filter(Boolean),
      rewardItemHashes:[...new Set(rewards)].slice(0,6),endDate:context.endDate||null,
      milestoneName:context.milestoneName||'',
    };
    model.lane=classifyOperationLane(model);
    return model;
  }catch(e){return null;}
}
function buildOperationCard(operation){
  const card=el('article','opCard');
  const head=el('div','opCardHead');
  if(operation.icon){const img=document.createElement('img');img.src=operation.icon;img.alt='';img.loading='lazy';img.decoding='async';head.appendChild(img);}
  const copy=el('div','opCardCopy');copy.appendChild(el('div','opCardName',operation.name));
  const meta=[];
  if(operation.modeNames.length)meta.push(operation.modeNames.join(' • '));
  if(operation.endDate)meta.push(`rotates in ${fmtCountdown(operation.endDate)}`);
  else meta.push(`daily reset in ${fmtCountdown(nextDailyReset())}`);
  copy.appendChild(el('div','opCardMeta',meta.join(' • ')));head.appendChild(copy);card.appendChild(head);
  if(operation.desc)card.appendChild(el('div','opCardDesc',operation.desc));
  if(operation.modifierNames.length){const mods=el('div','opModifiers');operation.modifierNames.forEach(n=>mods.appendChild(el('span','opModifier',n)));card.appendChild(mods);}
  if(operation.rewardItemHashes.length){
    const rewards=el('div','opRewards');rewards.appendChild(el('div','rwLabel','Available loot / rewards'));
    const rail=el('div','opRewardRail');rewards.appendChild(rail);
    operation.rewardItemHashes.forEach(hash=>{
      const row=el('div','opReward');row.textContent='Loading reward…';rail.appendChild(row);
      getItemDefinition(hash).then(def=>{
        row.textContent='';if(def.icon){const img=document.createElement('img');img.src=def.icon;img.alt='';img.loading='lazy';img.decoding='async';row.appendChild(img);}row.appendChild(el('span','',def.name));
      }).catch(()=>row.remove());
    });
    card.appendChild(rewards);
  }
  return card;
}
function buildOperationsLanes(operations){
  const wrap=el('section','operationLanes');
  const heading=el('div','operationsHeading');heading.appendChild(el('div','operationsTitle','Live Operations Rotations'));heading.appendChild(el('div','operationsSubtitle','Public milestone and activity definitions currently exposed by Bungie.'));wrap.appendChild(heading);
  const grid=el('div','operationLaneGrid');wrap.appendChild(grid);
  OPERATION_LANES.forEach(lane=>{
    const section=el('section','operationLane');section.dataset.lane=lane.id;
    const head=el('header','operationLaneHead');head.appendChild(el('div','operationLaneName',lane.name));head.appendChild(el('div','operationLaneSub',lane.subtitle));section.appendChild(head);
    const list=el('div','operationLaneList');
    const laneItems=operations.filter(o=>o.lane===lane.id);
    if(laneItems.length)laneItems.forEach(o=>list.appendChild(buildOperationCard(o)));
    else list.appendChild(el('div','operationUnavailable','No live rotation node was returned for this lane. Reset and reward timing remain visible above.'));
    section.appendChild(list);grid.appendChild(section);
  });
  return wrap;
}

async function loadActivities(){
  const body=document.getElementById('activitiesBody');body.innerHTML='';
  if(window.D2Loader){D2Loader.show('Loading Operations','Fetching public milestones, rotations, modifiers, and rewards…');D2Loader.progress(0.08);}
  document.getElementById('activitiesReset').textContent=`Daily reset in ${fmtCountdown(nextDailyReset())} • Weekly reset (Tue) in ${fmtCountdown(nextWeeklyReset())}`;
  const chips=el('div','resetChips');chips.innerHTML=`<div class="resetChip">Daily rotation reset: <b>${fmtCountdown(nextDailyReset())}</b></div><div class="resetChip">Weekly raid, dungeon & challenge reset: <b>${fmtCountdown(nextWeeklyReset())}</b></div>`;body.appendChild(chips);
  const loading=el('div','fsState','Fetching live public operations from Bungie.net…');body.appendChild(loading);
  try{
    const ms=await bungieGet('/Destiny2/Milestones/');
    if(window.D2Loader){D2Loader.update('Resolving Operations','Loading milestone and activity definitions…');D2Loader.progress(0.3);}
    const milestoneCards=[];
    const activityContexts=new Map();
    await Promise.all(Object.entries(ms).map(async([hash,live])=>{
      try{
        const def=await getManifestEntity('DestinyMilestoneDefinition',hash);
        if(!def?.displayProperties?.name)return;
        const rewardItemHashes=collectRewardHashesFromDefinition(def);
        const card={hash,name:def.displayProperties.name,desc:def.displayProperties.description||'',icon:operationAbsoluteIcon(def.displayProperties.icon),type:def.milestoneType||0,endDate:live.endDate?new Date(live.endDate):null,rewardItemHashes:rewardItemHashes.slice(0,6),order:def.milestoneType===3?0:def.milestoneType===4?1:2};
        milestoneCards.push(card);
        const activityHashes=collectNumericHashes(live,new Set(['activityHash']));
        const modeHashes=[...collectNumericHashes(live,new Set(['activityModeHash','activityModeHashes']))];
        const modifierHashes=[...collectNumericHashes(live,new Set(['modifierHashes']))];
        activityHashes.forEach(activityHash=>{
          const existing=activityContexts.get(activityHash)||{modeHashes:[],modifierHashes:[],rewardItemHashes:[],endDate:null,milestoneName:''};
          existing.modeHashes.push(...modeHashes);existing.modifierHashes.push(...modifierHashes);existing.rewardItemHashes.push(...rewardItemHashes);
          existing.endDate=existing.endDate||card.endDate;existing.milestoneName=existing.milestoneName||card.name;
          activityContexts.set(activityHash,existing);
        });
      }catch(e){}
    }));
    if(window.D2Loader){D2Loader.update('Checking Director Rotations','Adding signed-in character activity nodes when available…');D2Loader.progress(0.5);}
    await enrichOperationContextsFromSignedInProfile(activityContexts);
    if(window.D2Loader){D2Loader.update('Building Rotation Lanes','Resolving Vanguard, Crucible, Gambit, raid, and dungeon nodes…');D2Loader.progress(0.64);}
    const operationModels=(await Promise.all([...activityContexts.entries()].slice(0,96).map(([hash,context])=>resolveOperationActivity(hash,context)))).filter(Boolean);
    loading.remove();

    const events=[];milestoneCards.forEach(c=>{const n=c.name.toLowerCase();if(n.includes('iron banner'))events.push({label:`Iron Banner — active${c.endDate?` • ends in ${fmtCountdown(c.endDate)}`:''}`,cls:'iron'});else if(n.includes('trials'))events.push({label:`Trials of Osiris — active${c.endDate?` • ends in ${fmtCountdown(c.endDate)}`:''}`,cls:'trials'});});
    if(events.length){const bar=el('div','eventBar');[...new Map(events.map(e=>[e.label,e])).values()].forEach(ev=>bar.appendChild(el('div','eventPill '+(ev.cls||''),`★ ${ev.label}`)));body.insertBefore(bar,chips);}

    body.appendChild(buildOperationsLanes(operationModels));
    if(milestoneCards.length){
      milestoneCards.sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name));
      const title=el('div','operationsHeading milestoneHeading');title.appendChild(el('div','operationsTitle','Milestones & Challenges'));title.appendChild(el('div','operationsSubtitle','Additional public milestone cards and reward previews.'));body.appendChild(title);
      const grid=el('div','actGrid');body.appendChild(grid);milestoneCards.forEach(c=>grid.appendChild(buildActivityCard(c)));
    }else body.appendChild(el('div','fsState','No active public milestones were returned right now.'));
    if(window.D2Loader)D2Loader.progress(0.96);
  }catch(err){loading.textContent='Could not load operations: '+err.message;loading.className='fsState err';}
  finally{if(window.D2Loader){D2Loader.progress(1);D2Loader.hide();}}
}

function buildActivityCard(c){
  const card=el('div','actCard');card.setAttribute('data-testid','activity-card');
  const head=el('div','head');if(c.icon){const img=document.createElement('img');img.src=c.icon;img.alt=c.name;img.loading='lazy';img.decoding='async';head.appendChild(img);}
  const mt=MILESTONE_TYPE[c.type]||{n:''};head.appendChild(el('div','',`<div class="nm">${c.name}</div><div class="tag ${mt.cls||''}">${mt.n}${c.endDate?` • ends in ${fmtCountdown(c.endDate)}`:''}</div>`));card.appendChild(head);
  const bodyEl=el('div','body');if(c.desc)bodyEl.appendChild(el('div','desc',c.desc));
  if(c.rewardItemHashes.length){bodyEl.appendChild(el('div','rwLabel','Rewards'));c.rewardItemHashes.forEach(h=>{const row=el('div','rw');row.textContent='Loading…';bodyEl.appendChild(row);getItemDefinition(h).then(def=>{row.textContent='';if(def.icon){const im=document.createElement('img');im.src=def.icon;im.alt='';im.loading='lazy';row.appendChild(im);}row.appendChild(el('span','',def.name));}).catch(()=>row.remove());});}
  card.appendChild(bodyEl);return card;
}

/* ---------------- VENDORS WINDOW ---------------- */
const vendorsOverlay = document.getElementById('vendorsOverlay');
const vendorsState = { data:null, kiosks:null, search:'', renderToken:0 };

// D2Synergy ritual presentation order. The fixed hashes are preferred, while
// aliases allow a future manifest update to be matched by localized name.
const VENDOR_ROSTER = [
  {id:'vanguard', hash:'3603221665', name:'Commander Zavala', factionLabel:'Vanguard', aliases:['commander zavala','zavala']},
  {id:'crucible', hash:'69482069', name:'Lord Shaxx', factionLabel:'Crucible', aliases:['lord shaxx','shaxx']},
  {id:'gambit', hash:'248695599', name:'The Drifter', factionLabel:'Gambit', aliases:['the drifter','drifter']},
  {id:'trials', hash:'765357505', name:'Saint-14', factionLabel:'Trials of Osiris', aliases:['saint-14','saint 14','saint']},
  {id:'black-armory', hash:'350061650', name:'Ada-1', factionLabel:'Black Armory', aliases:['ada-1','ada 1','ada']},
  {id:'the-nine', hash:'2190858386', name:'Xûr', factionLabel:'The Nine', aliases:['xûr','xur']},
];
const MONUMENT_KIOSK_RE=/monument|triumph/i;

function vendorAbsoluteIcon(path){
  if(!path) return null;
  if(typeof publicBungieIconUrl==='function') return publicBungieIconUrl(path);
  return /^https?:\/\//i.test(path) ? path : 'https://www.bungie.net'+(String(path).startsWith('/')?'':'/')+path;
}
function vendorDisplayCategory(vdef,index){
  const list=vdef?.displayCategories||[];
  return list.find(c=>Number(c.index)===Number(index)) || list[Number(index)] || null;
}
function vendorCategoryTitle(categoryDef,index){
  const name=categoryDef?.displayProperties?.name?.trim();
  return name || categoryDef?.displayTitle?.trim() || categoryDef?.identifier?.replace(/[._-]+/g,' ') || `Inventory ${Number(index)+1}`;
}
function vendorCategoryDescription(categoryDef){
  return categoryDef?.displayProperties?.description?.trim() || categoryDef?.disabledDescription?.trim() || '';
}
function vendorCategoryIcon(categoryDef){
  return vendorAbsoluteIcon(categoryDef?.displayProperties?.icon || categoryDef?.overlay?.icon);
}
function vendorInfoText(vendor){
  const pieces=[];
  const description=vendor.vdef?.displayProperties?.description?.trim() || vendor.faction?.displayProperties?.description?.trim();
  if(description) pieces.push(description);
  if(vendor.factionName) pieces.push(`Affiliation: ${vendor.factionName}.`);
  if(vendor.kind==='kiosk') pieces.push('This is a profile kiosk. Its visible entries and acquisition state come from your account kiosk component.');
  if(vendor.nextRefresh) pieces.push(`Next inventory refresh: ${new Date(vendor.nextRefresh).toLocaleString()}.`);
  if(!vendor.available) pieces.push(vendor.kind==='kiosk'?'No visible kiosk entries were returned for this profile.':'This vendor is not currently returned for the selected character.');
  return pieces.join(' ') || `${vendor.name} represents ${vendor.profile.factionLabel}.`;
}
function vendorItemModel(item){
  return {
    hash:Number(item.sale.itemHash),
    _def:item.def,
    quantity:Number(item.sale.quantity||1),
    stats:{}, sockets:[], transferStatus:2,
  };
}
function vendorBuildRawCategories(vdef,liveCategories,saleItems){
  const categories=[];
  const assigned=new Set();
  (liveCategories||[]).forEach((liveCategory,order)=>{
    const displayIndex=Number(liveCategory.displayCategoryIndex ?? order);
    const categoryDef=vendorDisplayCategory(vdef,displayIndex);
    const items=[];
    (liveCategory.itemIndexes||[]).forEach(index=>{
      const key=String(index);
      const sale=saleItems[key] || saleItems[index];
      if(!sale)return;
      assigned.add(key);
      items.push({vendorItemIndex:Number(index),sale,def:null,costs:null,kioskStatus:null});
    });
    if(items.length){
      categories.push({
        key:`${displayIndex}:${order}`,
        displayIndex,
        order,
        name:vendorCategoryTitle(categoryDef,displayIndex),
        description:vendorCategoryDescription(categoryDef),
        icon:vendorCategoryIcon(categoryDef),
        items,
        hydrated:false,
        hydrating:null,
      });
    }
  });

  const leftovers=[];
  Object.entries(saleItems||{}).forEach(([key,sale])=>{
    if(assigned.has(String(key)))return;
    leftovers.push({vendorItemIndex:Number(key),sale,def:null,costs:null,kioskStatus:null});
  });
  if(leftovers.length){
    categories.push({key:'other',displayIndex:9999,order:9999,name:'Other Offers',description:'Additional live offers returned by Bungie.',icon:null,items:leftovers,hydrated:false,hydrating:null});
  }
  return categories;
}
function kioskSaleFromDefinition(entry){
  return {
    itemHash:Number(entry?.itemHash||0),
    quantity:Number(entry?.quantity||1),
    costs:Array.isArray(entry?.currencies)?entry.currencies:(Array.isArray(entry?.costs)?entry.costs:[]),
  };
}
function vendorBuildKioskCategories(vdef,kioskStatuses){
  const statusByIndex=new Map((kioskStatuses||[]).map(status=>[Number(status.index),status]));
  const visibleIndexes=new Set(statusByIndex.keys());
  const assigned=new Set();
  const categories=[];
  (vdef?.categories||[]).forEach((categoryDef,order)=>{
    const indexes=(categoryDef.vendorItemIndexes||[]).map(Number).filter(index=>visibleIndexes.has(index));
    if(!indexes.length)return;
    const displayIndex=Number(categoryDef.categoryIndex ?? order);
    const displayDef=vendorDisplayCategory(vdef,displayIndex);
    const items=indexes.map(index=>{
      assigned.add(index);
      const definitionEntry=vdef.itemList?.[index]||{};
      return {vendorItemIndex:index,sale:kioskSaleFromDefinition(definitionEntry),def:null,costs:null,kioskStatus:statusByIndex.get(index)||null};
    }).filter(item=>item.sale.itemHash);
    if(!items.length)return;
    categories.push({
      key:`kiosk:${displayIndex}:${order}`,
      displayIndex,
      order,
      name:categoryDef.displayTitle?.trim() || vendorCategoryTitle(displayDef,displayIndex),
      description:vendorCategoryDescription(displayDef)||vendorCategoryDescription(categoryDef),
      icon:vendorCategoryIcon(displayDef)||vendorCategoryIcon(categoryDef),
      items,
      hydrated:false,
      hydrating:null,
    });
  });
  const leftovers=[...visibleIndexes].filter(index=>!assigned.has(index)).map(index=>{
    const definitionEntry=vdef?.itemList?.[index]||{};
    return {vendorItemIndex:index,sale:kioskSaleFromDefinition(definitionEntry),def:null,costs:null,kioskStatus:statusByIndex.get(index)||null};
  }).filter(item=>item.sale.itemHash);
  if(leftovers.length)categories.push({key:'kiosk:other',displayIndex:9999,order:9999,name:'Kiosk Inventory',description:'Additional visible Monument entries for this account.',icon:null,items:leftovers,hydrated:false,hydrating:null});
  return categories;
}
async function buildMonumentKiosks(profile){
  const profileMap=profile.profileKiosks?.data?.kioskItems||{};
  const characterMaps=Object.values(profile.characterKiosks?.data||{}).map(component=>component?.kioskItems||{});
  const merged=new Map();
  const mergeMap=map=>Object.entries(map||{}).forEach(([hash,items])=>{
    const bucket=merged.get(String(hash))||new Map();
    (items||[]).forEach(item=>bucket.set(Number(item.index),item));
    merged.set(String(hash),bucket);
  });
  mergeMap(profileMap);characterMaps.forEach(mergeMap);
  const kiosks=[];
  for(const [hash,statusMap] of merged.entries()){
    let vdef=null;
    try{vdef=await getManifestEntity('DestinyVendorDefinition',hash);}catch(e){continue;}
    const searchable=`${vdef?.displayProperties?.name||''} ${vdef?.displayProperties?.description||''} ${vdef?.vendorIdentifier||''}`;
    if(!MONUMENT_KIOSK_RE.test(searchable))continue;
    let faction=null;
    if(vdef?.factionHash){try{faction=await getManifestEntity('DestinyFactionDefinition',vdef.factionHash);}catch(e){}}
    const statuses=[...statusMap.values()];
    const name=vdef?.displayProperties?.name||'Monument of Triumph';
    const profileEntry={id:`kiosk-${hash}`,hash:String(hash),name,factionLabel:'Monument of Triumph',aliases:[name.toLowerCase()]};
    const categories=vendorBuildKioskCategories(vdef,statuses);
    kiosks.push({
      kind:'kiosk',profile:profileEntry,vhash:String(hash),name,
      factionName:faction?.displayProperties?.name||'Monument of Triumph',
      logo:vendorAbsoluteIcon(faction?.displayProperties?.icon||vdef?.displayProperties?.icon||vdef?.displayProperties?.largeIcon),
      vdef,faction,nextRefresh:null,available:statuses.length>0,categories,
    });
  }
  return kiosks.sort((a,b)=>a.name.localeCompare(b.name));
}

function openVendorsWindow(){
  closeAllOverlays();
  vendorsOverlay.classList.add('open');
  document.body.style.overflow='hidden';
  if(!vendorsState.data) loadVendors(); else renderVendors();
}
function closeVendorsWindow(){ vendorsOverlay.classList.remove('open'); document.body.style.overflow=''; }

async function loadVendors(){
  const body = document.getElementById('vendorsBody');
  body.innerHTML=''; body.appendChild(el('div','fsState','Resolving your signed-in account...'));
  if(window.D2Loader){D2Loader.show('Loading Vendors','Resolving your signed-in account…');D2Loader.progress(0.08);}
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error('Not signed in. Open the menu → Sign in with Bungie.net first. Vendor data needs the ReadDestinyVendorsAndAdvisors permission.');
    const m = await getMembershipsForCurrentUser(auth.access_token);
    if(window.D2Loader){D2Loader.update('Loading Vendors','Loading your active Guardian, kiosk status, and vendor access…');D2Loader.progress(0.22);}
    const rawProfile = await fetch(`${BUNGIE_BASE}/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=200,500`,{
      headers:{'X-API-Key':BUNGIE_API_KEY,'Authorization':'Bearer '+auth.access_token},
    }).then(r=>r.json());
    const profile=handleBungieJson(rawProfile);
    const charId = Object.keys(profile.characters?.data || {})[0];
    if(!charId) throw new Error('No characters found on this account.');
    if(window.D2Loader){D2Loader.update('Loading Vendors','Fetching live inventories and category blocks…');D2Loader.progress(0.4);}
    const res = await fetch(`${BUNGIE_BASE}/Destiny2/${m.membershipType}/Profile/${m.membershipId}/Character/${charId}/Vendors/?components=400,401,402`, {
      headers: { 'X-API-Key': BUNGIE_API_KEY, 'Authorization':'Bearer '+auth.access_token },
    }).then(r=>r.json());
    const parsed = handleBungieJson(res);
    const vendorsMeta = parsed.vendors?.data || {};
    const categoryData = parsed.categories?.data || {};
    const salesData = parsed.sales?.data || {};

    if(window.D2Loader){D2Loader.update('Organizing Vendors','Resolving ritual emblems, interactive inventory blocks, and Monuments…');D2Loader.progress(0.62);}
    const vendors=await Promise.all(VENDOR_ROSTER.map(async profileEntry=>{
      let vdef=null,faction=null;
      try{vdef=await getManifestEntity('DestinyVendorDefinition',profileEntry.hash);}catch(e){}
      if(vdef?.factionHash){try{faction=await getManifestEntity('DestinyFactionDefinition',vdef.factionHash);}catch(e){}}
      const saleItems=salesData[profileEntry.hash]?.saleItems || {};
      const liveCategories=categoryData[profileEntry.hash]?.categories || [];
      const categories=vendorBuildRawCategories(vdef,liveCategories,saleItems);
      const name=vdef?.displayProperties?.name || profileEntry.name;
      const factionName=faction?.displayProperties?.name || profileEntry.factionLabel;
      // Faction icon is intentionally first: Vanguard, Crucible, Gambit,
      // Trials, Black Armory, and The Nine should read at a glance.
      const logo=vendorAbsoluteIcon(faction?.displayProperties?.icon || vdef?.displayProperties?.icon);
      return {
        kind:'vendor',profile:profileEntry,vhash:profileEntry.hash,name,factionName,logo,vdef,faction,
        nextRefresh:vendorsMeta[profileEntry.hash]?.nextRefreshDate || null,
        available:Object.keys(saleItems).length>0,categories,
      };
    }));
    const kiosks=await buildMonumentKiosks(profile);

    vendorsState.data=vendors;
    vendorsState.kiosks=kiosks;
    await refreshLiveEvents();
    if(window.D2Loader){D2Loader.progress(0.92);D2Loader.update('Rendering Vendors','Building ritual vendors and Monument kiosks…');}
    renderVendors();
  } catch(err){
    body.innerHTML=''; body.appendChild(el('div','fsState err','Could not load vendors: '+err.message));
  } finally {
    if(window.D2Loader){D2Loader.progress(1);D2Loader.hide();}
  }
}

async function hydrateVendorCategory(vendor,category,host){
  if(category.hydrated){renderVendorCategoryItems(vendor,category,host);return;}
  if(category.hydrating){await category.hydrating;renderVendorCategoryItems(vendor,category,host);return;}
  host.innerHTML=''; host.appendChild(window.D2Loader?D2Loader.inline(`Loading ${category.name}…`):el('div','fsState',`Loading ${category.name}…`));
  category.hydrating=(async()=>{
    const allCostHashes=new Set();
    category.items.forEach(item=>(item.sale.costs||[]).forEach(c=>{if(c.itemHash)allCostHashes.add(c.itemHash);}));
    const itemDefs=await Promise.all(category.items.map(item=>getItemDefinition(item.sale.itemHash).catch(()=>null)));
    const costMap=new Map();
    await Promise.all([...allCostHashes].map(async hash=>{const def=await getItemDefinition(hash).catch(()=>null);if(def)costMap.set(String(hash),def);}));
    category.items.forEach((item,index)=>{
      item.def=itemDefs[index];
      item.costs=(item.sale.costs||[]).map(c=>({def:costMap.get(String(c.itemHash))||null,qty:c.quantity}));
      if(item.kioskStatus){
        item.failureMessages=(item.kioskStatus.failureIndexes||[]).map(i=>vendor.vdef?.failureStrings?.[i]).filter(Boolean);
      }
    });
    category.hydrated=true;
  })().finally(()=>{category.hydrating=null;});
  await category.hydrating;
  renderVendorCategoryItems(vendor,category,host);
}

function renderVendorCategoryItems(vendor,category,host){
  host.innerHTML='';
  const q=vendorsState.search.toLowerCase();
  const visible=category.items.filter(item=>{
    if(!item.def)return false;
    if(!q)return true;
    return `${item.def.name} ${item.def.typeName||''} ${category.name} ${vendor.name}`.toLowerCase().includes(q);
  });
  if(!visible.length){host.appendChild(el('div','venCategoryEmpty',q?'No matching items in this category.':'No item definitions were available.'));return;}
  const grid=el('div','venItems');
  visible.forEach(item=>{
    const def=item.def;
    const cell=document.createElement('button');
    cell.type='button';cell.className='venItem';cell.setAttribute('data-testid','vendor-item');
    cell.setAttribute('aria-label',`View ${def.name} details`);
    if(def.tierType===6)cell.classList.add('exotic');
    if(item.kioskStatus&&!item.kioskStatus.canAcquire)cell.classList.add('kioskUnavailable');
    if(def.icon){const im=document.createElement('img');im.className='ic';im.src=def.icon;im.alt='';im.loading='lazy';im.decoding='async';im.fetchPriority='low';cell.appendChild(im);}
    const info=el('div','venItemCopy');
    info.appendChild(el('div','nm',def.name));
    if(def.typeName)info.appendChild(el('div','typ',def.typeName));
    if(item.kioskStatus){
      const statusText=item.kioskStatus.canAcquire?'Available from kiosk':'Visible • not currently acquirable';
      info.appendChild(el('div','kioskState',statusText));
      (item.failureMessages||[]).slice(0,2).forEach(message=>info.appendChild(el('div','kioskFailure',message)));
    }
    (item.costs||[]).forEach(cost=>{
      const cr=el('div','cost');
      if(cost.def?.icon){const ci=document.createElement('img');ci.src=cost.def.icon;ci.alt='';ci.loading='lazy';ci.decoding='async';cr.appendChild(ci);}
      cr.appendChild(el('span','',`${Number(cost.qty||0).toLocaleString()} ${cost.def?.name||''}`.trim()));
      info.appendChild(cr);
    });
    cell.appendChild(info);
    cell.onclick=()=>{if(typeof openItemDetail==='function')openItemDetail(vendorItemModel(item),{});};
    grid.appendChild(cell);
  });
  host.appendChild(grid);
}

function buildVendorSection(vendor){
  const sec=el('section','venVendor'+(vendor.kind==='kiosk'?' venKiosk':''));sec.dataset.vendorId=vendor.profile.id;
  const head=el('div','venHead');
  const logoWrap=el('div','venLogoWrap');
  if(vendor.logo){const img=document.createElement('img');img.src=vendor.logo;img.alt=`${vendor.profile.factionLabel} logo`;img.loading='lazy';img.decoding='async';logoWrap.appendChild(img);}
  else logoWrap.appendChild(el('div','venLogoFallback',vendor.profile.factionLabel.slice(0,2).toUpperCase()));
  head.appendChild(logoWrap);

  const heading=el('div','venHeading');
  const nameRow=el('div','venNameRow');
  nameRow.appendChild(el('div','nm',vendor.name));
  const infoBtn=document.createElement('button');infoBtn.type='button';infoBtn.className='venInfoBtn';infoBtn.textContent='i';infoBtn.title=`About ${vendor.name}`;infoBtn.setAttribute('aria-label',`Information about ${vendor.name}`);infoBtn.setAttribute('aria-expanded','false');
  nameRow.appendChild(infoBtn);
  if(vendor.kind==='kiosk')nameRow.appendChild(el('span','venKindBadge','Kiosk'));
  heading.appendChild(nameRow);
  const count=vendor.categories.reduce((sum,c)=>sum+c.items.length,0);
  const inventoryWord=vendor.kind==='kiosk'?'visible entr':'live offer';
  heading.appendChild(el('div','sub',`${vendor.factionName} • ${count} ${inventoryWord}${count===1?(vendor.kind==='kiosk'?'y':''):(vendor.kind==='kiosk'?'ies':'s')}${vendor.nextRefresh?` • refreshes ${new Date(vendor.nextRefresh).toLocaleDateString()}`:''}`));
  head.appendChild(heading);sec.appendChild(head);

  const infoPanel=el('div','venInfoPanel',vendorInfoText(vendor));infoPanel.hidden=true;sec.appendChild(infoPanel);
  infoBtn.onclick=()=>{infoPanel.hidden=!infoPanel.hidden;infoBtn.setAttribute('aria-expanded',String(!infoPanel.hidden));};

  const categoriesWrap=el('div','venCategories');sec.appendChild(categoriesWrap);
  if(!vendor.categories.length){
    categoriesWrap.appendChild(el('div','venUnavailable',vendor.available?'No categorized offers were returned.':vendor.kind==='kiosk'?'No visible Monument entries were returned for this account.':'Inventory is not currently available for this character.'));
    return sec;
  }
  vendor.categories.forEach(category=>{
    const details=document.createElement('details');details.className='venCategory';details.dataset.categoryName=category.name.toLowerCase();
    const summary=document.createElement('summary');summary.className='venCategoryBlock';
    if(category.icon){const icon=document.createElement('img');icon.src=category.icon;icon.alt='';icon.loading='lazy';icon.decoding='async';summary.appendChild(icon);}
    const copy=el('div','venCategoryCopy');copy.appendChild(el('div','venCategoryName',category.name));
    copy.appendChild(el('div','venCategoryMeta',`${category.items.length} item${category.items.length===1?'':'s'}${category.description?` • ${category.description}`:''}`));
    summary.appendChild(copy);summary.appendChild(el('span','venCategoryChevron','⌄'));details.appendChild(summary);
    const panel=el('div','venCategoryPanel');panel.appendChild(el('div','venCategoryHint',vendor.kind==='kiosk'?'Open this kiosk block to load its visible entries.':'Open this category to load its live items.'));details.appendChild(panel);
    details.addEventListener('toggle',()=>{if(details.open)hydrateVendorCategory(vendor,category,panel).catch(err=>{panel.innerHTML='';panel.appendChild(el('div','venCategoryEmpty','Could not load this category: '+err.message));});});
    categoriesWrap.appendChild(details);
  });
  return sec;
}

function renderVendorGroup(body,title,subtitle,vendors,q,token,pendingHydrations){
  const heading=el('div','venSectionHeading');heading.appendChild(el('div','venSectionTitle',title));heading.appendChild(el('div','venSectionSub',subtitle));body.appendChild(heading);
  let shown=0,hydratedDuringSearch=false;
  vendors.forEach(vendor=>{
    const vendorMatches=!q || `${vendor.name} ${vendor.factionName}`.toLowerCase().includes(q);
    const categoryNameMatches=vendor.categories.some(category=>category.name.toLowerCase().includes(q));
    const itemMatches=vendor.categories.some(category=>category.items.some(item=>item.def?.name?.toLowerCase().includes(q)));
    const hasUnhydrated=vendor.categories.some(category=>!category.hydrated);
    if(q&&!vendorMatches&&!categoryNameMatches&&!itemMatches&&!hasUnhydrated)return;
    shown++;
    const section=buildVendorSection(vendor);body.appendChild(section);
    if(q){
      section.querySelectorAll('.venCategory').forEach((details,index)=>{
        const category=vendor.categories[index];
        const categoryMatch=category.name.toLowerCase().includes(q) || category.items.some(item=>item.def?.name?.toLowerCase().includes(q));
        const shouldInspect=vendorMatches||categoryMatch||!category.hydrated;
        if(!shouldInspect)return;
        details.open=true;
        const panel=details.querySelector('.venCategoryPanel');
        if(!category.hydrated)hydratedDuringSearch=true;
        const work=hydrateVendorCategory(vendor,category,panel).then(()=>{
          if(token===vendorsState.renderToken&&q)renderVendorCategoryItems(vendor,category,panel);
        }).catch(()=>{});
        pendingHydrations.push(work);
      });
    }
  });
  if(!shown)heading.remove();
  return {shown,hydratedDuringSearch};
}

function renderVendors(){
  const body=document.getElementById('vendorsBody');
  body.innerHTML='';
  const token=++vendorsState.renderToken;
  const pendingHydrations=[];
  document.getElementById('vendorsReset').textContent=`Ritual vendors & Monument kiosks • next daily reset in ${fmtCountdown(nextDailyReset())}`;
  if(liveEventCache.trialsActive){
    const bar=el('div','eventBar');bar.appendChild(el('div','eventPill trials',`★ Trials of Osiris live • ends in ${fmtCountdown(liveEventCache.trialsEnd || nextWeeklyReset())}`));body.appendChild(bar);
  }else if(liveEventCache.ironBannerActive){
    const bar=el('div','eventBar');bar.appendChild(el('div','eventPill iron',`★ Iron Banner live • ends in ${fmtCountdown(liveEventCache.ironBannerEnd || nextWeeklyReset())}`));body.appendChild(bar);
  }
  const q=vendorsState.search.toLowerCase();
  const ritual=renderVendorGroup(body,'Ritual Vendors','Ordered Vanguard → Crucible → Gambit → Trials → Black Armory → The Nine.',vendorsState.data||[],q,token,pendingHydrations);
  const kiosk=renderVendorGroup(body,'Monument of Triumph Kiosks','Profile-visible kiosk entries grouped by their in-game category blocks.',vendorsState.kiosks||[],q,token,pendingHydrations);
  if(!ritual.shown&&!kiosk.shown)body.appendChild(el('div','fsState',q?'No vendor or kiosk inventory matches your search.':'No vendor or Monument kiosk data is available right now.'));
  if(q&&(ritual.hydratedDuringSearch||kiosk.hydratedDuringSearch)&&pendingHydrations.length){
    Promise.allSettled(pendingHydrations).then(()=>{
      if(token===vendorsState.renderToken&&vendorsState.search.toLowerCase()===q)renderVendors();
    });
  }
}

// Wire Phase 3 controls
document.getElementById('activitiesCloseBtn').onclick = closeActivitiesWindow;
document.getElementById('activitiesReloadBtn').onclick = loadActivities;
document.getElementById('vendorsCloseBtn').onclick = closeVendorsWindow;
document.getElementById('vendorsReloadBtn').onclick = ()=>{ vendorsState.data=null; vendorsState.kiosks=null; loadVendors(); };
let __vendorSearchTimer=null;
document.getElementById('vendorsSearch').addEventListener('input', (e)=>{
  const value=e.target.value.trim();
  clearTimeout(__vendorSearchTimer);
  __vendorSearchTimer=setTimeout(()=>{vendorsState.search=value;if(vendorsState.data)renderVendors();},120);
});
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Escape') return;
  if(activitiesOverlay.classList.contains('open')) closeActivitiesWindow();
  if(vendorsOverlay.classList.contains('open')) closeVendorsWindow();
});

