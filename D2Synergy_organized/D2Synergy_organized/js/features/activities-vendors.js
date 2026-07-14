/* Activities, reset timing, live events, and vendor windows
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 3 — VENDOR INVENTORIES + DAILY/WEEKLY ACTIVITIES WINDOWS
   Activities are powered by the PUBLIC Milestones endpoint (no auth needed),
   so they work signed-out. Vendors use GetVendors (components 400+402) and
   require the signed-in session + ReadDestinyVendorsAndAdvisors scope.
   Daily reset = 17:00 UTC; weekly reset = Tuesday 17:00 UTC; Trials runs the
   weekend (Fri 17:00 UTC -> Tue 17:00 UTC). Iron Banner / Trials are also
   surfaced from live milestone data when active.
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

async function loadActivities(){
  const body = document.getElementById('activitiesBody');
  body.innerHTML = '';
  document.getElementById('activitiesReset').textContent =
    `Daily reset in ${fmtCountdown(nextDailyReset())} \u2022 Weekly reset (Tue) in ${fmtCountdown(nextWeeklyReset())}`;
  // Reset chips render first so the countdowns stay visible even if the
  // milestones API errors out.
  const chips = el('div','resetChips');
  chips.innerHTML = `<div class="resetChip">Daily reset: <b>${fmtCountdown(nextDailyReset())}</b></div>
    <div class="resetChip">Weekly reset (Tue): <b>${fmtCountdown(nextWeeklyReset())}</b></div>`;
  body.appendChild(chips);
  const loading = el('div','fsState','Fetching public milestones from Bungie.net...');
  body.appendChild(loading);
  try {
    const ms = await bungieGet('/Destiny2/Milestones/');
    const entries = Object.keys(ms);
    const cards = [];
    await Promise.all(entries.map(async (hash)=>{
      try {
        const def = await getManifestEntity('DestinyMilestoneDefinition', hash);
        if(!def || !def.displayProperties || !def.displayProperties.name) return;
        // gather reward item hashes from the milestone definition
        const rewardItemHashes = [];
        if(def.rewards){
          Object.values(def.rewards).forEach(cat=>{
            Object.values(cat.rewardEntries||{}).forEach(en=>{
              (en.items||[]).forEach(it=>{ if(it.itemHash) rewardItemHashes.push(it.itemHash); });
            });
          });
        }
        cards.push({
          hash,
          name: def.displayProperties.name,
          desc: def.displayProperties.description || '',
          icon: def.displayProperties.icon ? 'https://www.bungie.net'+def.displayProperties.icon : null,
          type: def.milestoneType || 0,
          endDate: ms[hash].endDate ? new Date(ms[hash].endDate) : null,
          rewardItemHashes: rewardItemHashes.slice(0,4),
          order: def.milestoneType===3?0:def.milestoneType===4?1:2,
        });
      } catch(e){}
    }));
    loading.remove();

    // Event bar (Trials/Iron Banner) — driven entirely by real milestone
    // data returned above, since these two alternate weekends rather than
    // both running on a fixed schedule.
    const events = [];
    cards.forEach(c=>{
      const n = c.name.toLowerCase();
      if(n.includes('iron banner')) events.push({label:`Iron Banner \u2014 active${c.endDate?` \u2022 ends in ${fmtCountdown(c.endDate)}`:''}`, cls:'iron'});
      else if(n.includes('trials')) events.push({label:`Trials of Osiris \u2014 active${c.endDate?` \u2022 ends in ${fmtCountdown(c.endDate)}`:''}`, cls:'trials'});
    });
    if(events.length){
      const bar = el('div','eventBar');
      // de-dupe by label
      [...new Map(events.map(e=>[e.label,e])).values()].forEach(ev=>{
        bar.appendChild(el('div','eventPill '+(ev.cls||''), `&#9733; ${ev.label}`));
      });
      body.insertBefore(bar, chips); // event bar sits above the reset chips
    }

    if(!cards.length){ body.appendChild(el('div','fsState','No active public milestones returned right now.')); return; }
    cards.sort((a,b)=> a.order-b.order || a.name.localeCompare(b.name));
    const grid = el('div','actGrid');
    body.appendChild(grid);
    cards.forEach(c=>grid.appendChild(buildActivityCard(c)));
  } catch(err){
    loading.textContent = 'Could not load activities: '+err.message;
    loading.className = 'fsState err';
  }
}

function buildActivityCard(c){
  const card = el('div','actCard'); card.setAttribute('data-testid','activity-card');
  const head = el('div','head');
  if(c.icon){ const img=document.createElement('img'); img.src=c.icon; img.alt=c.name; head.appendChild(img); }
  const mt = MILESTONE_TYPE[c.type] || {n:''};
  head.appendChild(el('div','', `<div class="nm">${c.name}</div><div class="tag ${mt.cls||''}">${mt.n}${c.endDate?` \u2022 ends in ${fmtCountdown(c.endDate)}`:''}</div>`));
  card.appendChild(head);
  const bodyEl = el('div','body');
  if(c.desc) bodyEl.appendChild(el('div','desc', c.desc));
  if(c.rewardItemHashes.length){
    bodyEl.appendChild(el('div','rwLabel','Rewards'));
    c.rewardItemHashes.forEach(h=>{
      const row = el('div','rw'); row.textContent='Loading...';
      bodyEl.appendChild(row);
      getItemDefinition(h).then(def=>{
        row.textContent='';
        if(def.icon){ const im=document.createElement('img'); im.src=def.icon; row.appendChild(im); }
        row.appendChild(el('span','', def.name));
      }).catch(()=>{ row.textContent=''; });
    });
  }
  card.appendChild(bodyEl);
  return card;
}

/* ---------------- VENDORS WINDOW ---------------- */
const vendorsOverlay = document.getElementById('vendorsOverlay');
const vendorsState = { data:null, search:'' };
// Notable vendors to surface (others hidden to cut noise). Falls back to all
// selling vendors if none of these are present.
const NOTABLE_VENDORS = {
  2190858386:'X\u00fbr', 672118013:'Banshee-44', 350061650:'Ada-1',
  2255782930:'Rahool', 765357505:'Saint-14', 396892126:'Devrim Kay',
  3603221665:'Commander Zavala', 69482069:'Lord Shaxx', 248695599:'The Drifter',
};
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
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error('Not signed in. Open the menu \u2192 Sign in with Bungie.net first. Vendor data needs the ReadDestinyVendorsAndAdvisors permission (you may be asked to re-authorize once). Sign-in only works on the deployed GitHub Pages site.');
    const m = await getMembershipsForCurrentUser(auth.access_token);
    body.innerHTML=''; body.appendChild(el('div','fsState','Loading character...'));
    const profile = await bungieGet(`/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=200`);
    const charId = Object.keys(profile.characters?.data || {})[0];
    if(!charId) throw new Error('No characters found on this account.');
    body.innerHTML=''; body.appendChild(el('div','fsState','Fetching live vendor sales...'));
    const res = await fetch(`${BUNGIE_BASE}/Destiny2/${m.membershipType}/Profile/${m.membershipId}/Character/${charId}/Vendors/?components=400,402`, {
      headers: { 'X-API-Key': BUNGIE_API_KEY, 'Authorization':'Bearer '+auth.access_token },
    }).then(r=>r.json());
    const parsed = handleBungieJson(res);
    const vendorsMeta = parsed.vendors?.data || {};
    const salesData = parsed.sales?.data || {};
    // Build a list of vendors that have sale items.
    let vendorHashes = Object.keys(salesData).filter(h=>Object.keys(salesData[h].saleItems||{}).length);
    const notable = vendorHashes.filter(h=>NOTABLE_VENDORS[h]);
    if(notable.length) vendorHashes = notable;
    const vendors = [];
    await Promise.all(vendorHashes.map(async (vhash)=>{
      try {
        const vdef = await getManifestEntity('DestinyVendorDefinition', vhash);
        const name = vdef?.displayProperties?.name || NOTABLE_VENDORS[vhash] || 'Vendor';
        const icon = vdef?.displayProperties?.icon ? 'https://www.bungie.net'+vdef.displayProperties.icon : null;
        const sales = Object.values(salesData[vhash].saleItems||{}).slice(0,40);
        const items = await Promise.all(sales.map(async (s)=>{
          const def = await getItemDefinition(s.itemHash).catch(()=>null);
          if(!def) return null;
          const costs = await Promise.all((s.costs||[]).filter(c=>c.itemHash).map(async c=>{
            const cd = await getItemDefinition(c.itemHash).catch(()=>null);
            return cd ? {name:cd.name, icon:cd.icon, qty:c.quantity} : {name:'', icon:null, qty:c.quantity};
          }));
          return {def, costs};
        }));
        vendors.push({vhash, name, icon, nextRefresh: vendorsMeta[vhash]?.nextRefreshDate, items: items.filter(Boolean)});
      } catch(e){}
    }));
    vendors.sort((a,b)=>a.name.localeCompare(b.name));
    vendorsState.data = vendors;
    await refreshLiveEvents();
    renderVendors();
  } catch(err){
    body.innerHTML=''; body.appendChild(el('div','fsState err','Could not load vendors: '+err.message));
  }
}

function renderVendors(){
  const body = document.getElementById('vendorsBody');
  body.innerHTML='';
  document.getElementById('vendorsReset').textContent = `Sales refresh at daily/weekly reset \u2022 next daily in ${fmtCountdown(nextDailyReset())}`;
  if(liveEventCache.trialsActive){
    const bar = el('div','eventBar');
    bar.appendChild(el('div','eventPill trials', `&#9733; Trials of Osiris live \u2014 Saint-14 has weekend rewards (ends in ${fmtCountdown(liveEventCache.trialsEnd || nextWeeklyReset())})`));
    body.appendChild(bar);
  } else if(liveEventCache.ironBannerActive){
    const bar = el('div','eventBar');
    bar.appendChild(el('div','eventPill iron', `&#9733; Iron Banner live (ends in ${fmtCountdown(liveEventCache.ironBannerEnd || nextWeeklyReset())})`));
    body.appendChild(bar);
  }
  const q = vendorsState.search.toLowerCase();
  let shownVendors = 0;
  (vendorsState.data||[]).forEach(v=>{
    const items = q ? v.items.filter(it=>it.def.name.toLowerCase().includes(q)) : v.items;
    if(!items.length) return;
    shownVendors++;
    const sec = el('div','venVendor');
    const head = el('div','venHead');
    if(v.icon){ const img=document.createElement('img'); img.src=v.icon; head.appendChild(img); }
    head.appendChild(el('div','', `<div class="nm">${v.name}</div><div class="sub">${items.length} item${items.length===1?'':'s'} for sale${v.nextRefresh?` \u2022 refreshes ${new Date(v.nextRefresh).toLocaleDateString()}`:''}</div>`));
    sec.appendChild(head);
    const grid = el('div','venItems');
    items.forEach(it=>{
      const cell = el('div','venItem'); cell.setAttribute('data-testid','vendor-item');
      if(it.def.tierType===6) cell.classList.add('exotic');
      if(it.def.icon){ const im=document.createElement('img'); im.className='ic'; im.src=it.def.icon; im.loading='lazy'; cell.appendChild(im); }
      const info = el('div','');
      info.appendChild(el('div','nm', it.def.name));
      if(it.def.typeName) info.appendChild(el('div','typ', it.def.typeName));
      it.costs.forEach(c=>{
        const cr = el('div','cost');
        if(c.icon){ const ci=document.createElement('img'); ci.src=c.icon; cr.appendChild(ci); }
        cr.appendChild(el('span','', `${c.qty} ${c.name}`));
        info.appendChild(cr);
      });
      cell.appendChild(info);
      grid.appendChild(cell);
    });
    sec.appendChild(grid);
    body.appendChild(sec);
  });
  if(!shownVendors) body.appendChild(el('div','fsState', q?'No vendor items match your search.':'No vendor sales available right now.'));
}

// Wire Phase 3 controls
document.getElementById('activitiesCloseBtn').onclick = closeActivitiesWindow;
document.getElementById('activitiesReloadBtn').onclick = loadActivities;
document.getElementById('vendorsCloseBtn').onclick = closeVendorsWindow;
document.getElementById('vendorsReloadBtn').onclick = ()=>{ vendorsState.data=null; loadVendors(); };
document.getElementById('vendorsSearch').addEventListener('input', (e)=>{ vendorsState.search = e.target.value.trim(); if(vendorsState.data) renderVendors(); });
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Escape') return;
  if(activitiesOverlay.classList.contains('open')) closeActivitiesWindow();
  if(vendorsOverlay.classList.contains('open')) closeVendorsWindow();
});

