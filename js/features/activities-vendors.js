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
  ['vaultFsOverlay','vendorsOverlay'].forEach(id=>{
    const o = document.getElementById(id); if(o) o.classList.remove('open');
  });
  closeFsMenu();
}

/* ---------------- ACTIVITIES WINDOW ---------------- */
const activitiesOverlay = document.getElementById('workspace-operations');
function openActivitiesWindow(){
  window.D2Workspaces?.activate?.('operations',{scroll:false});
  window.scrollTo(0,0);
  loadActivities();
}
function closeActivitiesWindow(){ window.D2Workspaces?.activate?.('builder',{scroll:false}); }

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

const PROGRESS_TABS=[
  ['overview','Overview'],['daily','Daily'],['weekly','Weekly'],['longterm','Monthly & Long-Term'],['quests','Quests'],
  ['vanguard','Vanguard'],['crucible','Crucible'],['gambit','Gambit'],['rad','Raids & Dungeons'],
  ['pinnacles','Pinnacles'],['patterns','Patterns'],['catalysts','Catalysts']
];
let activitiesProgressState={tab:'overview',milestones:[],operations:[],profile:null,profileError:null};

function progressPct(value,completion){
  const complete=Number(completion?.completionValue||completion?.completeValue||0);
  const current=Number(value||completion?.progress||0);
  if(!complete)return completion?.complete?100:0;
  return Math.max(0,Math.min(100,(current/complete)*100));
}
function progressView(title,description,status='Live Bungie data'){
  const view=el('section','progressView');
  const hero=el('header','progressHero');
  const copy=el('div','');copy.appendChild(el('h3','',title));copy.appendChild(el('p','',description));hero.appendChild(copy);
  hero.appendChild(el('div','progressStatus',status));view.appendChild(hero);return view;
}
function progressSummary(label,value,hint){const card=el('div','progressSummaryCard');card.appendChild(el('div','progressSummaryLabel',label));card.appendChild(el('div','progressSummaryValue',String(value)));card.appendChild(el('div','progressSummaryHint',hint));return card;}
function progressDataCard(name,meta,pct=null){const card=el('article','progressDataCard');card.appendChild(el('div','progressDataName',name));card.appendChild(el('div','progressDataMeta',meta));if(pct!=null){const bar=el('div','progressBar');const fill=document.createElement('span');fill.style.width=`${Math.max(0,Math.min(100,pct))}%`;bar.appendChild(fill);card.appendChild(bar);}return card;}
function sectionBlock(title,subtitle){const sec=el('section','progressSection');const head=el('div','progressSectionHead');head.appendChild(el('div','progressSectionTitle',title));head.appendChild(el('div','progressSectionSub',subtitle||''));sec.appendChild(head);return sec;}
function operationMatches(tab,o){
  if(tab==='vanguard'||tab==='crucible'||tab==='gambit')return o.lane===tab;
  const t=`${o.name} ${o.desc} ${(o.modeNames||[]).join(' ')}`.toLowerCase();
  if(tab==='rad')return /raid|dungeon|pantheon/.test(t);
  if(tab==='pinnacles')return /pinnacle|powerful|exotic mission|exotic quest|presage|seraph|avalon|whisper|zero hour/.test(t);
  return false;
}
async function loadGuardianProgressProfile(){
  try{
    if(typeof getValidAccessToken!=='function'||typeof getMembershipsForCurrentUser!=='function')return null;
    const auth=await getValidAccessToken();if(!auth)return null;
    const m=await getMembershipsForCurrentUser(auth.access_token);
    const res=await fetch(`${BUNGIE_BASE}/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=100,102,104,200,201,202,204,500,700,800,900,1100,1200,1300`,{headers:{'X-API-Key':BUNGIE_API_KEY,'Authorization':'Bearer '+auth.access_token}}).then(r=>r.json());
    return handleBungieJson(res);
  }catch(error){activitiesProgressState.profileError=error;return null;}
}
function collectCompletionEntries(component){
  const out=[];
  const visit=(value,path='')=>{
    if(!value||typeof value!=='object')return;
    if(!Array.isArray(value)&&('complete' in value||'progress' in value||'objectives' in value))out.push({path,value});
    Object.entries(value).forEach(([k,v])=>{if(v&&typeof v==='object')visit(v,path?`${path}.${k}`:k);});
  };visit(component);return out;
}
async function resolveRecordCards(records,limit=80){
  const entries=Object.entries(records||{}).slice(0,limit);const cards=[];
  await Promise.all(entries.map(async([hash,state])=>{try{const def=await getManifestEntity('DestinyRecordDefinition',hash);if(!def?.displayProperties?.name)return;const objectives=state.objectives||[];const complete=Boolean(state.state&1)||objectives.length&&objectives.every(o=>o.complete);const pct=objectives.length?objectives.reduce((a,o)=>a+progressPct(o.progress,o),0)/objectives.length:(complete?100:0);cards.push({name:def.displayProperties.name,desc:def.displayProperties.description||'',complete,pct});}catch(e){}}));
  return cards.sort((a,b)=>Number(a.complete)-Number(b.complete)||b.pct-a.pct||a.name.localeCompare(b.name));
}
async function resolveCollectibleCards(collectibles,limit=80){
  const entries=Object.entries(collectibles||{}).slice(0,limit);const cards=[];
  await Promise.all(entries.map(async([hash,state])=>{try{const def=await getManifestEntity('DestinyCollectibleDefinition',hash);if(!def?.displayProperties?.name)return;const acquired=!(Number(state.state||0)&1);cards.push({name:def.displayProperties.name,desc:def.sourceString||def.displayProperties.description||'',acquired});}catch(e){}}));
  return cards.sort((a,b)=>Number(a.acquired)-Number(b.acquired)||a.name.localeCompare(b.name));
}
async function resolveCraftableCards(craftables,limit=80){
  const entries=Object.entries(craftables||{}).slice(0,limit);const cards=[];
  await Promise.all(entries.map(async([hash,state])=>{try{const def=await getManifestEntity('DestinyInventoryItemDefinition',hash);if(!def?.displayProperties?.name)return;const sockets=state.sockets||state.socketStates||[];const plugs=sockets.flatMap(x=>x.plugs||x.plugStates||[]);const completed=plugs.filter(x=>x.unlocked||x.isVisible===true).length;cards.push({name:def.displayProperties.name,desc:`${completed} recipe socket${completed===1?'':'s'} unlocked`,pct:plugs.length?completed/plugs.length*100:0});}catch(e){}}));
  return cards.sort((a,b)=>b.pct-a.pct||a.name.localeCompare(b.name));
}
async function resolveQuestCards(profile,limit=120){
  const entries=[];
  (profile?.profileInventory?.data?.items||[]).forEach(item=>entries.push({...item,owner:'Account'}));
  Object.entries(profile?.characterInventories?.data||{}).forEach(([characterId,data])=>{
    (data?.items||[]).forEach(item=>entries.push({...item,owner:characterId}));
  });
  const seen=new Set(),cards=[];
  await Promise.all(entries.slice(0,500).map(async item=>{
    const key=`${item.itemHash}:${item.itemInstanceId||item.owner}`;if(seen.has(key))return;seen.add(key);
    try{
      const def=await getManifestEntity('DestinyInventoryItemDefinition',item.itemHash);
      const text=`${def?.itemTypeDisplayName||''} ${def?.itemTypeAndTierDisplayName||''} ${def?.displayProperties?.name||''} ${def?.displayProperties?.description||''}`;
      if(!/quest|bounty|mission|pursuit/i.test(text))return;
      cards.push({name:def.displayProperties?.name||'Quest',desc:def.displayProperties?.description||def.itemTypeDisplayName||'Active pursuit',icon:operationAbsoluteIcon(def.displayProperties?.icon),owner:item.owner});
    }catch(e){}
  }));
  return cards.sort((a,b)=>a.name.localeCompare(b.name)).slice(0,limit);
}
function renderOperationProgressView(tab,title,description){
  const view=progressView(title,description);const matches=activitiesProgressState.operations.filter(o=>operationMatches(tab,o));
  if(!matches.length)view.appendChild(el('div','progressEmpty','No currently exposed Bungie activity node matched this section. Reset timing and public milestones remain available in Overview.'));
  else{const sec=sectionBlock('Current rotation',`${matches.length} live node${matches.length===1?'':'s'}`);const grid=el('div','progressCards');matches.forEach(o=>grid.appendChild(buildOperationCard(o)));sec.appendChild(grid);view.appendChild(sec);}return view;
}
function renderResetProgressView(scope,title,description){
  const view=progressView(title,description,'Live milestone schedule');
  let cards=[];
  if(scope==='daily')cards=activitiesProgressState.milestones.filter(card=>Number(card.type)===4);
  else if(scope==='weekly')cards=activitiesProgressState.milestones.filter(card=>Number(card.type)===3);
  else cards=activitiesProgressState.milestones.filter(card=>![3,4].includes(Number(card.type)));
  const sec=sectionBlock(scope==='daily'?'Daily activities and rewards':scope==='weekly'?'Weekly activities and rewards':'Monthly, special, and long-term progress',`${cards.length} milestone${cards.length===1?'':'s'} returned`);
  if(cards.length){const grid=el('div','actGrid');cards.forEach(card=>grid.appendChild(buildActivityCard(card)));sec.appendChild(grid);}else sec.appendChild(el('div','progressEmpty',`No ${title.toLowerCase()} milestones were returned by Bungie right now.`));
  view.appendChild(sec);
  if(scope==='daily'){
    const operations=activitiesProgressState.operations.filter(o=>!o.endDate||o.endDate<=nextWeeklyReset());
    if(operations.length){const opSec=sectionBlock('Daily-reset playlists','Current Director nodes and available loot');const grid=el('div','progressCards');operations.slice(0,18).forEach(o=>grid.appendChild(buildOperationCard(o)));opSec.appendChild(grid);view.appendChild(opSec);}
  }
  return view;
}
async function buildProgressViews(){
  const views=new Map();const profile=activitiesProgressState.profile;
  const milestoneCount=activitiesProgressState.milestones.length, operationCount=activitiesProgressState.operations.length;
  const overview=progressView('Guardian Overview','A fast account dashboard for live rotations, available rewards, and the next useful things to check.');
  const summary=el('div','progressSummaryGrid');summary.appendChild(progressSummary('Live activities',operationCount,'Resolved Director and milestone nodes'));summary.appendChild(progressSummary('Milestones',milestoneCount,'Daily, weekly, and special challenges'));summary.appendChild(progressSummary('Daily reset',fmtCountdown(nextDailyReset()),'Vendors and daily rotations'));summary.appendChild(progressSummary('Weekly reset',fmtCountdown(nextWeeklyReset()),'Raids, dungeons, challenges, and rewards'));overview.appendChild(summary);
  const priority=sectionBlock("Today's Priority",profile?'Account-aware starting points':'Sign in with Bungie for account completion status');const list=el('div','progressChecklist');
  const top=[...activitiesProgressState.operations].slice(0,6);if(top.length)top.forEach((o,i)=>{const row=el('div','progressTask');row.appendChild(el('span',`progressTaskState ${i<2?'available':'progress'}`));const c=el('div','progressTaskCopy');c.appendChild(el('div','progressTaskName',o.name));c.appendChild(el('div','progressTaskMeta',`${o.milestoneName||'Current rotation'}${o.endDate?` • rotates in ${fmtCountdown(o.endDate)}`:''}`));row.appendChild(c);list.appendChild(row);});else list.appendChild(el('div','progressEmpty','No activity priorities were returned right now.'));
  priority.appendChild(list);overview.appendChild(priority);
  const milestoneSec=sectionBlock('Milestones & Challenges','Additional public rewards and objectives');const milestoneGrid=el('div','actGrid');activitiesProgressState.milestones.slice(0,18).forEach(c=>milestoneGrid.appendChild(buildActivityCard(c)));milestoneSec.appendChild(milestoneGrid);overview.appendChild(milestoneSec);views.set('overview',overview);
  views.set('daily',renderResetProgressView('daily','Daily','Activities, playlist rotations, and rewards that refresh at the daily reset.'));
  views.set('weekly',renderResetProgressView('weekly','Weekly','Challenges, featured activities, and rewards that refresh at the weekly reset.'));
  views.set('longterm',renderResetProgressView('longterm','Monthly & Long-Term','Special, one-time, monthly, and longer-running objectives that do not belong in the daily or weekly lists.'));
  const quests=progressView('Quests','Active account and character pursuits returned by Bungie.',profile?'Account data loaded':'Sign in required');
  if(profile){
    const questCards=await resolveQuestCards(profile);
    if(questCards.length){const sec=sectionBlock('Active Quests & Pursuits',`${questCards.length} found`),grid=el('div','progressCards');questCards.forEach(q=>{const card=progressDataCard(q.name,q.desc,0);if(q.icon){const img=document.createElement('img');img.src=q.icon;img.alt='';img.loading='lazy';img.decoding='async';card.prepend(img);}grid.appendChild(card);});sec.appendChild(grid);quests.appendChild(sec);}
    else quests.appendChild(el('div','progressEmpty','No quest or pursuit items were returned for this profile.'));
  }else quests.appendChild(el('div','progressEmpty','Sign in with Bungie to load active quests and pursuits.'));
  views.set('quests',quests);
  views.set('vanguard',renderOperationProgressView('vanguard','Vanguard','Fireteam, solo, arena, Nightfall, and other Vanguard rotations exposed by Bungie.'));
  views.set('crucible',renderOperationProgressView('crucible','Crucible','Current PvP modes, competitive nodes, Trials, and rotating rewards.'));
  views.set('gambit',renderOperationProgressView('gambit','Gambit','Daily Gambit activity, daily reward, weapon or armor drop, challenges, and reputation when Bungie exposes them.'));
  views.set('rad',renderOperationProgressView('rad','Raids & Dungeons','Raid and dungeon rotations combined, including featured and daily-reset indicators when present.'));
  views.set('pinnacles',renderOperationProgressView('pinnacles','Pinnacles','Pinnacle, Powerful, and Exotic-mission reward sources grouped in one place.'));
  const patterns=progressView('Patterns','Crafting recipe progress from Bungie’s Craftables component.',profile?'Account data loaded':'Sign in required');if(profile){const craftables=profile.profileCraftables?.data?.craftables||{};const cards=await resolveCraftableCards(craftables);if(cards.length){const sec=sectionBlock('Craftable weapons',`${cards.length} loaded`),grid=el('div','progressCards');cards.forEach(c=>grid.appendChild(progressDataCard(c.name,c.desc,c.pct)));sec.appendChild(grid);patterns.appendChild(sec);}else patterns.appendChild(el('div','progressEmpty','No craftable recipe entries were returned for this profile.'));}else patterns.appendChild(el('div','progressEmpty','Sign in with Bungie to load pattern progress.'));views.set('patterns',patterns);
  const allRecords={...(profile?.profileRecords?.data?.records||{})};Object.values(profile?.characterRecords?.data||{}).forEach(x=>Object.assign(allRecords,x?.records||{}));const recordCards=profile?await resolveRecordCards(allRecords):[];
  const catalysts=progressView('Catalysts','Catalyst-related record progress, shown only when Bungie exposes a matching record.',profile?'Account data loaded':'Sign in required');const catalystCards=recordCards.filter(c=>/catalyst/i.test(`${c.name} ${c.desc}`));if(catalystCards.length){const sec=sectionBlock('Catalyst progress',`${catalystCards.length} records`),grid=el('div','progressCards');catalystCards.forEach(c=>grid.appendChild(progressDataCard(c.name,c.complete?'Complete':c.desc||'In progress',c.pct)));sec.appendChild(grid);catalysts.appendChild(sec);}else catalysts.appendChild(el('div','progressEmpty',profile?'No catalyst records were identified in the returned record definitions.':'Sign in with Bungie to load catalyst records.'));views.set('catalysts',catalysts);
  return views;
}
async function renderActivitiesProgress(){
  const body=document.getElementById('activitiesBody');body.innerHTML='';
  window.D2Status?.refreshing('activities','Refreshing rotations and progress');const shell=el('div','progressShell');const rail=el('nav','progressRail');rail.appendChild(el('div','progressRailTitle','Activities & Progress'));
  const main=el('div','progressMain');const views=await buildProgressViews();
  PROGRESS_TABS.forEach(([id,label])=>{const b=el('button','progressTab');b.type='button';b.dataset.progressTab=id;b.appendChild(el('span','',label));let count='';if(id==='overview')count=activitiesProgressState.milestones.length;else if(id==='daily')count=activitiesProgressState.milestones.filter(c=>Number(c.type)===4).length;else if(id==='weekly')count=activitiesProgressState.milestones.filter(c=>Number(c.type)===3).length;else if(id==='longterm')count=activitiesProgressState.milestones.filter(c=>![3,4].includes(Number(c.type))).length;else if(id==='patterns')count=Object.keys(activitiesProgressState.profile?.profileCraftables?.data?.craftables||{}).length;if(count!=='')b.appendChild(el('span','progressTabCount',String(count)));b.onclick=()=>{activitiesProgressState.tab=id;rail.querySelectorAll('.progressTab').forEach(x=>x.classList.toggle('active',x===b));main.querySelectorAll('.progressView').forEach(x=>x.classList.toggle('active',x.dataset.progressView===id));};rail.appendChild(b);const view=views.get(id)||progressView(label,'This progress section is being prepared.');view.dataset.progressView=id;view.classList.toggle('active',id===activitiesProgressState.tab);main.appendChild(view);});
  shell.appendChild(rail);shell.appendChild(main);body.appendChild(shell);rail.querySelector(`[data-progress-tab="${activitiesProgressState.tab}"]`)?.classList.add('active');
}

async function loadActivities(){
  const body=document.getElementById('activitiesBody');body.innerHTML='';
  if(window.D2Loader){D2Loader.show('Loading Activities & Progress','Fetching rotations first, then account progress when signed in…');D2Loader.progress(0.08);}
  document.getElementById('activitiesReset').textContent=`Daily reset in ${fmtCountdown(nextDailyReset())} • Weekly reset in ${fmtCountdown(nextWeeklyReset())}`;
  body.appendChild(el('div','fsState','Fetching live activities and Guardian progress…'));
  try{
    const [ms,profile]=await Promise.all([bungieGet('/Destiny2/Milestones/'),loadGuardianProgressProfile()]);activitiesProgressState.profile=profile;
    if(window.D2Loader){D2Loader.update('Resolving Activities','Loading milestone and activity definitions…');D2Loader.progress(0.34);}
    const milestoneCards=[],activityContexts=new Map();
    await Promise.all(Object.entries(ms).map(async([hash,live])=>{try{const def=await getManifestEntity('DestinyMilestoneDefinition',hash);if(!def?.displayProperties?.name)return;const rewardItemHashes=collectRewardHashesFromDefinition(def);const card={hash,name:def.displayProperties.name,desc:def.displayProperties.description||'',icon:operationAbsoluteIcon(def.displayProperties.icon),type:def.milestoneType||0,endDate:live.endDate?new Date(live.endDate):null,rewardItemHashes:rewardItemHashes.slice(0,6),order:def.milestoneType===3?0:def.milestoneType===4?1:2};milestoneCards.push(card);const activityHashes=collectNumericHashes(live,new Set(['activityHash']));const modeHashes=[...collectNumericHashes(live,new Set(['activityModeHash','activityModeHashes']))];const modifierHashes=[...collectNumericHashes(live,new Set(['modifierHashes']))];activityHashes.forEach(activityHash=>{const existing=activityContexts.get(activityHash)||{modeHashes:[],modifierHashes:[],rewardItemHashes:[],endDate:null,milestoneName:''};existing.modeHashes.push(...modeHashes);existing.modifierHashes.push(...modifierHashes);existing.rewardItemHashes.push(...rewardItemHashes);existing.endDate=existing.endDate||card.endDate;existing.milestoneName=existing.milestoneName||card.name;activityContexts.set(activityHash,existing);});}catch(e){}}));
    await enrichOperationContextsFromSignedInProfile(activityContexts);
    if(window.D2Loader){D2Loader.update('Building Progress Workspace','Organizing activities, rewards, patterns, and catalysts…');D2Loader.progress(0.67);}
    const operationModels=(await Promise.all([...activityContexts.entries()].slice(0,96).map(([hash,context])=>resolveOperationActivity(hash,context)))).filter(Boolean);milestoneCards.sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name));activitiesProgressState.milestones=milestoneCards;activitiesProgressState.operations=operationModels;await renderActivitiesProgress();
    window.D2Status?.set('activities',profile?'live':'cached',profile?'Activities and account progress synced':'Public rotations refreshed');
    if(window.D2Loader)D2Loader.progress(0.98);
  }catch(err){window.D2Status?.fail('activities',err.message||'Activities refresh failed');body.innerHTML='';body.appendChild(el('div','fsState err','Could not load Activities & Progress: '+err.message));}
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
const vendorsState = { data:null, search:'', renderToken:0 };

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
  if(vendor.nextRefresh) pieces.push(`Next inventory refresh: ${new Date(vendor.nextRefresh).toLocaleString()}.`);
  if(!vendor.available) pieces.push('This vendor is not currently returned for the selected character.');
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
      items.push({vendorItemIndex:Number(index),sale,def:null,costs:null});
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
    leftovers.push({vendorItemIndex:Number(key),sale,def:null,costs:null});
  });
  if(leftovers.length){
    categories.push({key:'other',displayIndex:9999,order:9999,name:'Other Offers',description:'Additional live offers returned by Bungie.',icon:null,items:leftovers,hydrated:false,hydrating:null});
  }
  return categories;
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
  window.D2Status?.refreshing('vendors','Refreshing vendor inventories');
  body.innerHTML=''; body.appendChild(el('div','fsState','Resolving your signed-in account...'));
  if(window.D2Loader){D2Loader.show('Loading Vendors','Resolving your signed-in account…');D2Loader.progress(0.08);}
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error('Not signed in. Open the menu → Sign in with Bungie.net first. Vendor data needs the ReadDestinyVendorsAndAdvisors permission.');
    const m = await getMembershipsForCurrentUser(auth.access_token);
    if(window.D2Loader){D2Loader.update('Loading Vendors','Loading your active Guardian and vendor access…');D2Loader.progress(0.22);}
    const rawProfile = await fetch(`${BUNGIE_BASE}/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=200`,{
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

    if(window.D2Loader){D2Loader.update('Organizing Vendors','Resolving ritual emblems and interactive inventory blocks…');D2Loader.progress(0.62);}
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
    vendorsState.data=vendors;
    await refreshLiveEvents();
    if(window.D2Loader){D2Loader.progress(0.92);D2Loader.update('Rendering Vendors','Building ritual vendor inventories…');}
    renderVendors();
    window.D2Status?.set('vendors','live','Vendor inventories synced');
  } catch(err){
    window.D2Status?.fail('vendors',err.message||'Vendor refresh failed');
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
    if(def.icon){const im=document.createElement('img');im.className='ic';im.src=def.icon;im.alt='';im.loading='lazy';im.decoding='async';im.fetchPriority='low';cell.appendChild(im);}
    const info=el('div','venItemCopy');
    info.appendChild(el('div','nm',def.name));
    if(def.typeName)info.appendChild(el('div','typ',def.typeName));
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
  const sec=el('section','venVendor');sec.dataset.vendorId=vendor.profile.id;
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
  heading.appendChild(nameRow);
  const count=vendor.categories.reduce((sum,c)=>sum+c.items.length,0);
  heading.appendChild(el('div','sub',`${vendor.factionName} • ${count} live offer${count===1?'':'s'}${vendor.nextRefresh?` • refreshes ${new Date(vendor.nextRefresh).toLocaleDateString()}`:''}`));
  head.appendChild(heading);sec.appendChild(head);

  const infoPanel=el('div','venInfoPanel',vendorInfoText(vendor));infoPanel.hidden=true;sec.appendChild(infoPanel);
  infoBtn.onclick=()=>{infoPanel.hidden=!infoPanel.hidden;infoBtn.setAttribute('aria-expanded',String(!infoPanel.hidden));};

  const categoriesWrap=el('div','venCategories');sec.appendChild(categoriesWrap);
  if(!vendor.categories.length){
    categoriesWrap.appendChild(el('div','venUnavailable',vendor.available?'No categorized offers were returned.':'Inventory is not currently available for this character.'));
    return sec;
  }
  vendor.categories.forEach(category=>{
    const details=document.createElement('details');details.className='venCategory';details.dataset.categoryName=category.name.toLowerCase();
    const summary=document.createElement('summary');summary.className='venCategoryBlock';
    if(category.icon){const icon=document.createElement('img');icon.src=category.icon;icon.alt='';icon.loading='lazy';icon.decoding='async';summary.appendChild(icon);}
    const copy=el('div','venCategoryCopy');copy.appendChild(el('div','venCategoryName',category.name));
    copy.appendChild(el('div','venCategoryMeta',`${category.items.length} item${category.items.length===1?'':'s'}${category.description?` • ${category.description}`:''}`));
    summary.appendChild(copy);summary.appendChild(el('span','venCategoryChevron','⌄'));details.appendChild(summary);
    const panel=el('div','venCategoryPanel');panel.appendChild(el('div','venCategoryHint','Open this category to load its live items.'));details.appendChild(panel);
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
  document.getElementById('vendorsReset').textContent=`Ritual vendors • next daily reset in ${fmtCountdown(nextDailyReset())}`;
  if(liveEventCache.trialsActive){
    const bar=el('div','eventBar');bar.appendChild(el('div','eventPill trials',`★ Trials of Osiris live • ends in ${fmtCountdown(liveEventCache.trialsEnd || nextWeeklyReset())}`));body.appendChild(bar);
  }else if(liveEventCache.ironBannerActive){
    const bar=el('div','eventBar');bar.appendChild(el('div','eventPill iron',`★ Iron Banner live • ends in ${fmtCountdown(liveEventCache.ironBannerEnd || nextWeeklyReset())}`));body.appendChild(bar);
  }
  const q=vendorsState.search.toLowerCase();
  const ritual=renderVendorGroup(body,'Ritual Vendors','Ordered Vanguard → Crucible → Gambit → Trials → Black Armory → The Nine.',vendorsState.data||[],q,token,pendingHydrations);
  if(!ritual.shown)body.appendChild(el('div','fsState',q?'No vendor inventory matches your search.':'No vendor inventory is available right now.'));
  if(q&&ritual.hydratedDuringSearch&&pendingHydrations.length){
    Promise.allSettled(pendingHydrations).then(()=>{
      if(token===vendorsState.renderToken&&vendorsState.search.toLowerCase()===q)renderVendors();
    });
  }
}

// Wire Phase 3 controls
document.getElementById('activitiesCloseBtn')?.addEventListener('click',closeActivitiesWindow);
document.getElementById('activitiesReloadBtn').onclick = loadActivities;
document.getElementById('vendorsCloseBtn').onclick = closeVendorsWindow;
document.getElementById('vendorsReloadBtn').onclick = ()=>{ vendorsState.data=null; loadVendors(); };
let __vendorSearchTimer=null;
document.getElementById('vendorsSearch').addEventListener('input', (e)=>{
  const value=e.target.value.trim();
  clearTimeout(__vendorSearchTimer);
  __vendorSearchTimer=setTimeout(()=>{vendorsState.search=value;if(vendorsState.data)renderVendors();},120);
});
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Escape') return;
  if(window.D2Workspaces?.active==='operations') closeActivitiesWindow();
  if(vendorsOverlay.classList.contains('open')) closeVendorsWindow();
});

