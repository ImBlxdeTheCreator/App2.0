/* Bungie configuration, authentication, API access, inventory, and sync drawer
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   BUNGIE ACCOUNT SYNC
   Reads live public profile data (characters + equipped items) via the
   Bungie.net API, directly from your browser using your creator-program API
   key. This is read-only, no OAuth/login — only works for characters whose
   equipped-loadout privacy is set to public (Bungie's default).
   NOTE: this code has not been tested against Bungie's live servers by
   Claude (no network access in the build sandbox) — written to spec from
   documented API behavior, but you'll be the first real test of it.
   ========================================================================= */
/* =========================================================================
   CONFIG BLOCK  (Phase 1 — single source of truth for tunables/keys)
   ========================================================================= */
const D2S_CONFIG = {
  MANIFEST_CACHE_VERSION: "v2",
  MANIFEST_CACHE_KEY: "d2synergy_manifest_cache",
  RATE_LIMIT_MS: 42,   // minimum spacing between outbound Bungie requests — Bungie's documented limit is ~25 req/sec (40ms); this was previously 90ms (~11/sec), needlessly slowing down anything that fetches many items at once (like the vault)
  MAX_RETRIES: 4,      // retries on 429 / 5xx / network error
  RETRY_BASE_MS: 600,  // exponential backoff base
};
const BUNGIE_API_KEY = "cb3731fc41f1468fadab053d31d07abc";
const BUNGIE_BASE = "https://www.bungie.net/Platform";
const MEMBERSHIP_TYPE_NAMES = {1:"Xbox",2:"PSN",3:"Steam",4:"Battle.net",5:"Stadia",6:"Epic",10:"Demon",254:"BungieNext"};

/* Shared rate-limited fetch: serializes spacing between Bungie.net calls and
   retries with exponential backoff on throttling (429) / server errors (5xx)
   / transient network failures. Every Bungie request routes through this. */
let __d2sNextSlot = 0;
function __d2sBackoff(attempt){
  const delay = D2S_CONFIG.RETRY_BASE_MS * Math.pow(2, attempt) + Math.random()*300;
  return new Promise(r=>setTimeout(r, delay));
}
async function rateLimitedFetch(url, options){
  const now = Date.now();
  const slot = Math.max(now, __d2sNextSlot);
  __d2sNextSlot = slot + D2S_CONFIG.RATE_LIMIT_MS;
  const wait = slot - now;
  if(wait > 0) await new Promise(r=>setTimeout(r, wait));
  let attempt = 0;
  while(true){
    let res;
    try {
      res = await fetch(url, options);
    } catch(netErr){
      if(attempt >= D2S_CONFIG.MAX_RETRIES) throw netErr;
      await __d2sBackoff(attempt++);
      continue;
    }
    if((res.status === 429 || res.status >= 500) && attempt < D2S_CONFIG.MAX_RETRIES){
      await __d2sBackoff(attempt++);
      continue;
    }
    return res;
  }
}

/* ---- OAuth (Confidential client, via Cloudflare Worker) ----
   The Worker holds the client secret and does the token exchange/refresh;
   this file only ever sees access/refresh tokens, never the secret itself. */
const BUNGIE_OAUTH_CLIENT_ID = "53783";
const OAUTH_WORKER_URL = "https://morning-sea-6b9d.ehurd37.workers.dev";
const OAUTH_STORAGE_KEY = "d2synergy_bungie_auth";

function getStoredAuth(){
  try { return JSON.parse(localStorage.getItem(OAUTH_STORAGE_KEY)); } catch(e){ return null; }
}
function setStoredAuth(data){
  localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(data));
}
function clearStoredAuth(){
  localStorage.removeItem(OAUTH_STORAGE_KEY);
}

function startBungieSignIn(){
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem("d2synergy_oauth_state", state);
  const authUrl = `https://www.bungie.net/en/oauth/authorize?client_id=${BUNGIE_OAUTH_CLIENT_ID}&response_type=code&state=${state}`;
  window.location.href = authUrl;
}

async function exchangeCodeForToken(code){
  const res = await fetch(OAUTH_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if(data.error || !data.access_token) throw new Error(data.error_description || data.error || "Token exchange failed");
  return data;
}

async function refreshBungieToken(refreshToken){
  const res = await fetch(OAUTH_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if(data.error || !data.access_token) throw new Error(data.error_description || data.error || "Token refresh failed");
  return data;
}

// Ensures we have a valid, unexpired access token — refreshing silently if
// needed. Returns null if the person isn't signed in or refresh fails (in
// which case the stored auth is cleared and they'll need to sign in again).
async function getValidAccessToken(){
  const auth = getStoredAuth();
  if(!auth) return null;
  const now = Date.now();
  if(auth.accessTokenExpires && now < auth.accessTokenExpires - 60000){
    return auth; // still valid, with >1 min of headroom
  }
  if(!auth.refresh_token || (auth.refreshTokenExpires && now > auth.refreshTokenExpires)){
    clearStoredAuth();
    return null; // refresh token also expired — full re-auth needed
  }
  try {
    const refreshed = await refreshBungieToken(auth.refresh_token);
    const newAuth = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || auth.refresh_token,
      membership_id: refreshed.membership_id || auth.membership_id,
      accessTokenExpires: Date.now() + (refreshed.expires_in*1000),
      refreshTokenExpires: Date.now() + ((refreshed.refresh_expires_in||7776000)*1000),
    };
    setStoredAuth(newAuth);
    return newAuth;
  } catch(e){
    clearStoredAuth();
    return null;
  }
}

// Handles the redirect back from Bungie (?code=...&state=...) on page load.
async function handleOAuthRedirect(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if(!code) return;
  const expectedState = sessionStorage.getItem("d2synergy_oauth_state");
  sessionStorage.removeItem("d2synergy_oauth_state");
  // Clean the URL immediately regardless of outcome, so a page refresh
  // doesn't try to reuse a spent authorization code.
  window.history.replaceState({}, document.title, window.location.pathname);
  if(state !== expectedState){
    console.warn("OAuth state mismatch — ignoring redirect for safety.");
    return;
  }
  try {
    const tokenData = await exchangeCodeForToken(code);
    setStoredAuth({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      membership_id: tokenData.membership_id,
      accessTokenExpires: Date.now() + (tokenData.expires_in*1000),
      refreshTokenExpires: Date.now() + ((tokenData.refresh_expires_in||7776000)*1000),
    });
  } catch(e){
    console.error("OAuth sign-in failed:", e.message);
    window.__d2synergyAuthError = e.message;
  }
}

// Persistent, version-invalidated manifest/icon cache. Loads any previously
// cached item defs from localStorage so repeat sessions don't re-hit Bungie;
// wiped automatically when MANIFEST_CACHE_VERSION is bumped.
const iconCache = (function(){
  try {
    const raw = localStorage.getItem(D2S_CONFIG.MANIFEST_CACHE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.__v === D2S_CONFIG.MANIFEST_CACHE_VERSION) return parsed.data || {};
    }
  } catch(e){}
  try { localStorage.removeItem(D2S_CONFIG.MANIFEST_CACHE_KEY); } catch(e){}
  return {};
})();
let __d2sCacheSaveTimer = null;
function persistIconCache(){
  clearTimeout(__d2sCacheSaveTimer);
  __d2sCacheSaveTimer = setTimeout(()=>{
    try { localStorage.setItem(D2S_CONFIG.MANIFEST_CACHE_KEY, JSON.stringify({__v:D2S_CONFIG.MANIFEST_CACHE_VERSION, data:iconCache})); } catch(e){}
  }, 600);
}

// Fetches a best-guess icon for an item by NAME (not hash) via Bungie's
// Armory fuzzy-search endpoint, since our data is keyed by name, not by
// Bungie's internal item hash. Attaches the icon into the given container
// once resolved. Best-effort: if the name doesn't match cleanly (common for
// perks/mods, which the search endpoint isn't great at disambiguating),
// this silently does nothing rather than showing a wrong icon.
async function attachLiveIcon(container, itemName, itemType){
  if(iconCache[itemName] === null) return; // previously failed, don't retry
  if(iconCache[itemName]){
    const img = document.createElement('img');
    img.src = iconCache[itemName]; img.style.width='32px'; img.style.height='32px'; img.style.borderRadius='4px'; img.style.marginRight='8px'; img.style.verticalAlign='middle';
    container.insertBefore(img, container.firstChild);
    return;
  }
  try {
    const res = await rateLimitedFetch(`${BUNGIE_BASE}/Destiny2/Armory/Search/DestinyInventoryItemDefinition/${encodeURIComponent(itemName)}/`, {
      headers: { "X-API-Key": BUNGIE_API_KEY }
    });
    if(!res.ok) throw new Error("http "+res.status);
    const json = await res.json();
    const results = json?.Response?.results?.results || [];
    const match = results.find(r=>r.displayProperties?.name?.toLowerCase() === itemName.toLowerCase()) || results[0];
    if(!match || !match.displayProperties?.icon){ iconCache[itemName] = null; persistIconCache(); return; }
    const iconUrl = "https://www.bungie.net" + match.displayProperties.icon;
    iconCache[itemName] = iconUrl;
    persistIconCache();
    const img = document.createElement('img');
    img.src = iconUrl; img.style.width='32px'; img.style.height='32px'; img.style.borderRadius='4px'; img.style.marginRight='8px'; img.style.verticalAlign='middle';
    container.insertBefore(img, container.firstChild);
  } catch(e){
    iconCache[itemName] = null; // don't keep retrying a failed lookup
  }
}

// Known Bungie ErrorCode values worth explaining clearly rather than just
// surfacing the raw code number.
const BUNGIE_ERROR_HINTS = {
  5: "Bungie.net is currently down for maintenance — try again later.",
  99: "Destiny 2 API is temporarily disabled by Bungie.",
  217: "No player found with that exact Bungie name — double check spelling and the #code.",
  1618: "That account has no linked Destiny 2 characters.",
  1665: "This profile's game data is set to private. On Bungie.net go to Settings → Privacy and enable \"Show my Destiny game progress\" to allow public lookups.",
  2101: "The API key isn't valid or has been throttled — check the key in the code, or try again in a moment.",
};
function handleBungieJson(json){
  if(json.ErrorCode !== 1){
    const hint = BUNGIE_ERROR_HINTS[json.ErrorCode];
    throw new Error(hint || json.Message || `Bungie API error code ${json.ErrorCode}`);
  }
  return json.Response;
}

async function bungieGet(path){
  const res = await rateLimitedFetch(BUNGIE_BASE + path, { headers: { "X-API-Key": BUNGIE_API_KEY } });
  if(!res.ok) throw new Error(`Bungie API HTTP ${res.status} — the request itself failed (network issue, CORS, or Bungie.net outage)`);
  const json = await res.json();
  return handleBungieJson(json);
}

async function bungiePost(path, body){
  const res = await rateLimitedFetch(BUNGIE_BASE + path, {
    method: "POST",
    headers: { "X-API-Key": BUNGIE_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if(!res.ok) throw new Error(`Bungie API HTTP ${res.status} — the request itself failed (network issue, CORS, or Bungie.net outage)`);
  const json = await res.json();
  return handleBungieJson(json);
}

// Looks up an item's real name + icon URL by its item hash via the
// manifest single-entity endpoint, with an in-memory cache so repeat
// lookups (same weapon on multiple characters) don't refetch.
// Real Bungie inventory bucket hashes — used to group items the way the
// in-game character screen (and tools like Ishtar/DIM) actually organize
// them, rather than one flat list.
const BUCKET_NAMES = {
  1498876634: "Kinetic Weapons",
  2465295065: "Energy Weapons",
  953998645: "Power Weapons",
  3448274439: "Helmet",
  3551918588: "Gauntlets",
  14239492: "Chest Armor",
  20886954: "Leg Armor",
  1585787867: "Class Armor",
  4023194814: "Ghost",
  2025709351: "Vehicle",
  284967655: "Ships",
  4274335291: "Emblems",
};
const BUCKET_ORDER = [1498876634,2465295065,953998645,3448274439,3551918588,14239492,20886954,1585787867,4023194814,2025709351,284967655,4274335291];

// De-dupes concurrent identical lookups (fixes the async race where the same
// weapon on multiple characters fired several parallel manifest fetches) and
// persists resolved defs. Returns name, icon, bucket, element + item type so
// the vault view can group/filter without extra calls.
const __defInFlight = {};
// Bungie's real DamageType enum, mapped to this tool's existing element names.
const DAMAGE_TYPE_TO_ELEMENT = {1:"Kinetic", 2:"Arc", 3:"Solar", 4:"Void", 6:"Stasis", 7:"Strand"};
const BUCKET_TO_WEAPON_SLOT = {1498876634:"Kinetic", 2465295065:"Energy", 953998645:"Power"};
const BUCKET_TO_ARMOR_SLOT = {3448274439:"Helmet", 3551918588:"Arms", 14239492:"Chest", 20886954:"Legs", 1585787867:"ClassItem"};

// Real gear cache for every "sync from my account" feature across the Build
// Synergy page — one fetch covers weapons, armor, AND the account's real
// unlocked artifact perks, rather than each sync button hitting the API
// separately.
let realGearCache = {fetchedAt: 0, weaponsBySlot: {Kinetic:[], Energy:[], Power:[]}, armorBySlot: {Helmet:[], Arms:[], Chest:[], Legs:[], ClassItem:[]}, artifactPerkHashes: [], artifactPowerBonus: 0};
async function refreshMyRealGear(){
  const auth = await getValidAccessToken();
  if(!auth) throw new Error("Not signed in \u2014 sign in above to sync your real gear here.");
  const membership = await getMembershipsForCurrentUser(auth.access_token);
  const {characters, vault, artifactPerkHashes, artifactPowerBonus} = await getFullInventory(membership.membershipType, membership.membershipId);
  const allItems = [...vault];
  characters.forEach(c=>{ allItems.push(...c.equipped); allItems.push(...c.inventory); });
  const weaponsBySlot = {Kinetic:[], Energy:[], Power:[]};
  const armorBySlot = {Helmet:[], Arms:[], Chest:[], Legs:[], ClassItem:[]};
  const seen = new Set(); // de-dupe: same item can appear via multiple characters/vault views
  await Promise.all(allItems.map(async item=>{
    if(!item.instanceId || seen.has(item.instanceId)) return;
    try {
      const def = await getItemDefinition(item.hash);
      const built = {
        hash: item.hash, instanceId: item.instanceId, name: def.name, icon: def.icon,
        element: DAMAGE_TYPE_TO_ELEMENT[def.damageType] || "Kinetic",
        typeName: def.typeName, power: item.power, isMasterworked: item.isMasterworked,
        energyCapacity: item.energyCapacity, stats: item.stats,
        socketedPlugHashes: item.socketedPlugHashes || [],
        isExotic: def.tierType === 6,
      };
      const weaponSlot = BUCKET_TO_WEAPON_SLOT[def.bucketHash];
      const armorSlot = BUCKET_TO_ARMOR_SLOT[def.bucketHash];
      if(weaponSlot){ seen.add(item.instanceId); weaponsBySlot[weaponSlot].push(built); }
      else if(armorSlot){ seen.add(item.instanceId); armorBySlot[armorSlot].push(built); }
    } catch(e){ /* skip unresolvable items */ }
  }));
  Object.values(weaponsBySlot).forEach(arr=>arr.sort((a,b)=>(b.power||0)-(a.power||0)));
  Object.values(armorBySlot).forEach(arr=>arr.sort((a,b)=>(b.power||0)-(a.power||0)));
  realGearCache = {fetchedAt: Date.now(), weaponsBySlot, armorBySlot, artifactPerkHashes: artifactPerkHashes||[], artifactPowerBonus: artifactPowerBonus||0};
  realWeaponsCache = {fetchedAt: realGearCache.fetchedAt, bySlot: weaponsBySlot}; // keep the existing weapons-only cache in sync too
  return realGearCache;
}
// Kept for the existing "Load My Weapons" button — now just a thin wrapper.
async function refreshMyRealWeapons(){ return refreshMyRealGear(); }

// Single consolidated sync — replaces having a separate sync button on every
// panel. One fetch (refreshMyRealGear), then populates exotic armor/weapon,
// all 3 legendary weapon slots, all 5 armor pieces, the artifact, and set
// bonuses in one pass, switching each panel into "real" mode as it goes.
async function syncEverything(){
  const btn = document.getElementById('globalSyncBtn');
  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Syncing...';
  const results = [];
  try {
    await refreshMyRealGear();

    // Exotic armor + weapon — highest-power owned exotic that matches this
    // tool's known list, per category.
    const ownedExoticArmor = Object.values(realGearCache.armorBySlot).flat().filter(a=>a.isExotic);
    const myExotics = EXOTIC_ARMOR[state.cls] || [];
    const foundArmor = ownedExoticArmor.find(a=>myExotics.some(e=>e.name.toLowerCase()===a.name.toLowerCase()));
    if(foundArmor){ state.exoticArmor = myExotics.find(e=>e.name.toLowerCase()===foundArmor.name.toLowerCase()).name; results.push('Exotic Armor: '+state.exoticArmor); }

    const ownedExoticWeapons = Object.values(realGearCache.weaponsBySlot).flat().filter(w=>w.isExotic);
    const foundWeapon = ownedExoticWeapons.find(w=>EXOTIC_WEAPONS.some(e=>e.name.toLowerCase()===w.name.toLowerCase()));
    if(foundWeapon){ state.activeExoticWeapon = EXOTIC_WEAPONS.find(e=>e.name.toLowerCase()===foundWeapon.name.toLowerCase()).name; results.push('Exotic Weapon: '+state.activeExoticWeapon); }

    // Legendary weapons — highest-power non-exotic item per slot.
    for(const slot of ["Kinetic","Energy","Power"]){
      const pick = (realGearCache.weaponsBySlot[slot]||[]).find(w=>!w.isExotic);
      if(pick){ await selectRealWeapon(slot, pick); results.push(slot+' Weapon: '+pick.name); }
    }

    // Armor mods/stats — highest-power non-exotic item per piece.
    for(const slotName of ["Helmet","Arms","Chest","Legs","ClassItem"]){
      const pick = (realGearCache.armorBySlot[slotName]||[]).find(a=>!a.isExotic);
      if(pick){ await selectRealArmor(slotName, pick); results.push(slotName+' Armor synced'); }
    }

    // Artifact — real unlocked+active perks.
    const realNames = [];
    for(const hash of realGearCache.artifactPerkHashes){
      try { const def = await getItemDefinition(hash); if(def.name) realNames.push(def.name); } catch(e){}
    }
    if(realNames.length){
      let bestArt = null, bestScore = 0;
      ARTIFACTS.forEach(a=>{
        const allNames = [...a.column1, ...a.column2, ...a.column3];
        const score = allNames.filter(n=>realNames.some(rn=>rn.toLowerCase()===n.toLowerCase())).length;
        if(score > bestScore){ bestScore = score; bestArt = a; }
      });
      if(bestArt){
        state.artifact = bestArt.name;
        const allNames = [...bestArt.column1, ...bestArt.column2, ...bestArt.column3];
        state.artifactPerks = allNames.filter(n=>realNames.some(rn=>rn.toLowerCase()===n.toLowerCase())).slice(0,7);
        state.artifactMode = "real";
        results.push('Artifact: '+bestArt.name);
      }
    }

    // Set bonuses — from the first character's actually-equipped armor.
    const auth = await getValidAccessToken();
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    const {characters} = await getFullInventory(membership.membershipType, membership.membershipId);
    if(characters.length){
      const char = characters[0];
      const newAssignment = {Helmet:null, Arms:null, Chest:null, Legs:null, ClassItem:null};
      let matchedAny = false;
      for(const item of char.equipped){
        const def = await getItemDefinition(item.hash).catch(()=>null);
        if(!def) continue;
        const slotName = BUCKET_TO_ARMOR_SLOT[def.bucketHash];
        if(!slotName) continue;
        for(const plugHash of (item.socketedPlugHashes||[])){
          const plugDef = await getItemDefinition(plugHash).catch(()=>null);
          if(!plugDef || !plugDef.name) continue;
          const matchedSet = ARMOR_SETS.find(s=>s.twoPiece.name.toLowerCase()===plugDef.name.toLowerCase() || s.fourPiece.name.toLowerCase()===plugDef.name.toLowerCase());
          if(matchedSet){ newAssignment[slotName] = matchedSet.name; matchedAny = true; break; }
        }
      }
      if(matchedAny){ state.armorSetByPiece = newAssignment; state.armorSetMode = "real"; results.push('Set bonuses synced'); }
    }

    // Also flip the weapon/armor per-slot modes to "real" for anything we
    // actually found, so the UI reflects the sync immediately.
    ["Kinetic","Energy","Power"].forEach(slot=>{ if(state.legendaryRealItem[slot]) state.legendaryMode[slot] = "real"; });
    ["Helmet","Arms","Chest","Legs","ClassItem"].forEach(slotName=>{ if(state.armorRealItem[slotName]) state.armorMode[slotName] = "real"; });

    render();
    alert(results.length ? ('Synced:\n' + results.join('\n')) : 'Nothing matched this tool\u2019s known data to sync.');
  } catch(e){
    alert('Sync failed: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}
document.getElementById('globalSyncBtn').onclick = syncEverything;

// Matches a real armor piece's actually-socketed mods against this tool's
// own ARMOR_MODS_BY_SLOT / TUNING_MODS_BY_SLOT library (by name), same
// principle as matchRealWeaponPerks.
function matchRealArmorMods(slotName, socketedPlugHashes, resolvedPlugDefs){
  const knownMods = ARMOR_MODS_BY_SLOT[slotName] || [];
  const knownTuning = TUNING_MODS_BY_SLOT[slotName] || [];
  const allKnown = [...knownMods, ...knownTuning];
  const matched = [];
  socketedPlugHashes.forEach(hash=>{
    const def = resolvedPlugDefs[hash];
    if(!def || !def.name) return;
    const known = allKnown.find(m=>m.name.toLowerCase() === def.name.toLowerCase());
    if(known) matched.push(known);
  });
  return matched;
}

// Matches a real weapon's actually-socketed plugs against this tool's own
// curated perk libraries (by name) so real gear contributes real synergy
// numbers — same-name perks reuse the same verified effect data already
// used everywhere else in the tool, rather than guessing new values.
function matchRealWeaponPerks(socketedPlugHashes, resolvedPlugDefs){
  const allKnownPerks = [
    ...UNIVERSAL_PERKS,
    ...Object.values(ELEMENT_LOCKED_PERKS).flat(),
    ...Object.values(WEAPON_TYPE_PERKS).flat(),
    ...ORIGIN_TRAITS,
  ];
  const matched = [];
  socketedPlugHashes.forEach(hash=>{
    const def = resolvedPlugDefs[hash];
    if(!def || !def.name) return;
    const known = allKnownPerks.find(p=>p.name.toLowerCase() === def.name.toLowerCase());
    if(known) matched.push(known);
  });
  return matched;
}

// Called when the person picks a real owned weapon for a slot in the Build
// Synergy page — resolves its socketed plugs, matches them against this
// tool's own perk library, and caches the result on the item so
// collectComponents() can read it synchronously afterward.
async function selectRealWeapon(slot, item){
  state.legendaryRealItem[slot] = item;
  state.legendaryMode[slot] = "real";
  render(); // show the pick immediately, perks fill in a moment later
  try {
    const resolvedPlugDefs = {};
    await Promise.all((item.socketedPlugHashes||[]).map(async hash=>{
      try { resolvedPlugDefs[hash] = await getItemDefinition(hash); } catch(e){ /* skip unresolvable */ }
    }));
    item.matchedPerks = matchRealWeaponPerks(item.socketedPlugHashes||[], resolvedPlugDefs);
    item.unmatchedPlugNames = (item.socketedPlugHashes||[])
      .map(h=>resolvedPlugDefs[h]?.name)
      .filter(n=>n && !item.matchedPerks.some(p=>p.name.toLowerCase()===n.toLowerCase()));
  } catch(e){
    item.matchedPerks = [];
  }
  render();
}

// Same pattern as selectRealWeapon, for an armor piece — resolves its real
// socketed mods, matches them against ARMOR_MODS_BY_SLOT/TUNING_MODS_BY_SLOT
// by name, and caches the result so computeCharacterStats()/collectComponents()
// can read it synchronously. Real stats (item.stats) are already present
// from the initial fetch, no extra resolution needed for those.
async function selectRealArmor(slotName, item){
  state.armorRealItem[slotName] = item;
  state.armorMode[slotName] = "real";
  render();
  try {
    const resolvedPlugDefs = {};
    await Promise.all((item.socketedPlugHashes||[]).map(async hash=>{
      try { resolvedPlugDefs[hash] = await getItemDefinition(hash); } catch(e){ /* skip unresolvable */ }
    }));
    item.matchedMods = matchRealArmorMods(slotName, item.socketedPlugHashes||[], resolvedPlugDefs);
    item.unmatchedPlugNames = (item.socketedPlugHashes||[])
      .map(h=>resolvedPlugDefs[h]?.name)
      .filter(n=>n && !item.matchedMods.some(m=>m.name.toLowerCase()===n.toLowerCase()));
  } catch(e){
    item.matchedMods = [];
  }
  render();
}

async function getItemDefinition(hash){
  if(iconCache[hash]) return iconCache[hash];
  if(__defInFlight[hash]) return __defInFlight[hash];
  __defInFlight[hash] = (async ()=>{
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`);
      const result = {
        name: def.displayProperties?.name || "Unknown Item",
        icon: def.displayProperties?.icon ? "https://www.bungie.net" + def.displayProperties.icon : null,
        bucketHash: def.inventory?.bucketTypeHash || null,
        damageType: def.defaultDamageType || 0,      // 1=Kinetic 2=Arc 3=Solar 4=Void 6=Stasis 7=Strand
        itemType: def.itemType || 0,                 // 2=Armor 3=Weapon
        tierType: def.inventory?.tierType || 0,       // 6=Exotic 5=Legendary
        typeName: def.itemTypeDisplayName || "",
      };
      iconCache[hash] = result;
      persistIconCache();
      return result;
    } finally {
      delete __defInFlight[hash];
    }
  })();
  return __defInFlight[hash];
}

async function searchBungiePlayer(bungieName){
  const [displayName, code] = bungieName.split("#");
  if(!displayName || !code) throw new Error("Enter your Bungie name in the format Name#1234");
  const results = await bungiePost(`/Destiny2/SearchDestinyPlayerByBungieName/-1/`, {
    displayName: displayName.trim(),
    displayNameCode: parseInt(code.trim(), 10),
  });
  if(!results || !results.length) throw new Error("No player found with that Bungie name — double-check the Name#0000 format.");
  // Filter out membershipType 254 (BungieNext account itself, not a real
  // platform) — this can appear mixed into "-1/All" search results and has
  // zero Destiny characters, which silently produces an empty-looking result
  // if it happens to get picked instead of the real platform membership.
  const platformResults = results.filter(r=>r.membershipType !== 254);
  const pool = platformResults.length ? platformResults : results;
  // Prefer the primary cross-save membership if present
  return pool.find(r=>r.crossSaveOverride && r.crossSaveOverride===r.membershipType) || pool[0];
}

async function getFullInventory(membershipType, membershipId){
  // Components: 200=Characters, 201=CharacterInventories (unequipped items in
  // that character's pockets), 205=CharacterEquipment (currently equipped),
  // 102=ProfileInventories (the Vault — shared account-wide storage, not
  // tied to any one character), 103=ProfileCurrencies (Glimmer/Bright Dust/
  // etc.), 300=ItemInstances (Power level + state flags), 302=ItemPerks,
  // 304=ItemStats (real per-item stat values — required for armor stat
  // sync; this was missing before, silently breaking that feature against
  // the real API even though mocked tests passed), 305=ItemSockets
  // (currently-socketed plugs), 104=ProfileProgression (seasonal artifact's
  // unlocked perks — also previously missing here).
  const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=200,201,205,102,103,104,300,302,304,305`);
  const characters = profile.characters?.data || {};
  const equipment = profile.characterEquipment?.data || {};
  const inventories = profile.characterInventories?.data || {};
  const vaultItems = profile.profileInventory?.data?.items || [];
  const instanceStats = profile.itemComponents?.instances?.data || {};
  const socketData = profile.itemComponents?.sockets?.data || {};
  const statData = profile.itemComponents?.stats?.data || {};
  const currencies = profile.profileCurrencies?.data?.items || []; // component 103
  // ItemState is a bitmask; bit value 4 = Masterworked (this specific flag
  // is documented and stable, so this reads reliably without needing to
  // walk the deeper socket-category manifest chain).
  const MASTERWORK_STATE_BIT = 4;
  // Keep itemHash (name/icon/bucket lookup), itemInstanceId (required to
  // reference this exact item for a transfer call — stackable consumables
  // won't have one), power level, masterwork flag, and the raw list of
  // currently-socketed plug hashes (resolved to names on render, same as
  // any other item — plug hashes ARE regular DestinyInventoryItemDefinition
  // hashes, just for the mod/perk itself).
  const mapItem = i => {
    const inst = i.itemInstanceId ? instanceStats[i.itemInstanceId] : null;
    const sockets = i.itemInstanceId ? (socketData[i.itemInstanceId]?.sockets || []) : [];
    const stats = i.itemInstanceId ? (statData[i.itemInstanceId]?.stats || null) : null;
    return {
      hash: i.itemHash,
      instanceId: i.itemInstanceId || null,
      bucketHash: i.bucketHash || null,
      power: inst?.primaryStat?.value || null,
      isMasterworked: !!(inst && (inst.state & MASTERWORK_STATE_BIT)),
      socketedPlugHashes: sockets.filter(s=>s.isEnabled && s.plugHash).map(s=>s.plugHash),
      sockets: sockets,
      stats: stats,
    };
  };
  const charList = Object.keys(characters).map(charId=>({
    charId,
    classType: characters[charId].classType, // 0=Titan, 1=Hunter, 2=Warlock
    light: characters[charId].light,
    emblemPath: characters[charId].emblemPath || null,
    equipped: (equipment[charId]?.items || []).map(mapItem),
    inventory: (inventories[charId]?.items || []).map(mapItem),
  }));
  // Seasonal artifact: which perks the account has actually unlocked+active.
  const artifactData = profile.profileProgression?.data?.seasonalArtifact;
  const artifactPerkHashes = [];
  if(artifactData?.tiers){
    artifactData.tiers.forEach(tier=>{
      (tier.items||[]).forEach(item=>{
        if(item.isActive) artifactPerkHashes.push(item.itemHash);
      });
    });
  }
  return {
    characters: charList,
    vault: vaultItems.map(mapItem),
    currencies: currencies.map(c=>({hash:c.itemHash, quantity:c.quantity})),
    artifactPerkHashes,
    artifactPowerBonus: artifactData?.powerBonus || 0,
  };
}

// Moves one instanced item between the Vault and a specific character.
// direction: "toVault" (from a character) or "toCharacter" (from the vault).
async function transferItem({itemHash, instanceId, membershipType, characterId, direction}){
  const auth = await getValidAccessToken();
  if(!auth) throw new Error("Not signed in.");
  const res = await rateLimitedFetch(`${BUNGIE_BASE}/Destiny2/Actions/Items/TransferItem/`, {
    method: "POST",
    headers: {
      "X-API-Key": BUNGIE_API_KEY,
      "Authorization": "Bearer " + auth.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      itemReferenceHash: itemHash,
      stackSize: 1,
      transferToVault: direction === "toVault",
      itemId: instanceId,
      characterId: characterId,
      membershipType: membershipType,
    }),
  });
  const json = await res.json();
  return handleBungieJson(json);
}

const CLASS_TYPE_NAMES = {0:"Titan", 1:"Hunter", 2:"Warlock"};

// Resolves the signed-in user's actual Destiny membership (platform +
// membershipId) using their OAuth access token. This is a DIFFERENT ID
// namespace than the Bungie.net account membership_id stored from sign-in —
// Destiny profile calls need this one specifically.
async function getMembershipsForCurrentUser(accessToken){
  const res = await rateLimitedFetch(`${BUNGIE_BASE}/User/GetMembershipsForCurrentUser/`, {
    headers: { "X-API-Key": BUNGIE_API_KEY, "Authorization": "Bearer " + accessToken },
  });
  const json = await res.json();
  const data = handleBungieJson(json);
  const memberships = data.destinyMemberships || [];
  if(!memberships.length) throw new Error("No Destiny 2 characters linked to this Bungie account.");
  const primary = memberships.find(m=>m.membershipId === data.primaryMembershipId) || memberships[0];
  return { membershipType: primary.membershipType, membershipId: primary.membershipId, displayName: primary.bungieGlobalDisplayName || primary.displayName };
}

// Shared renderer: given a resolved membershipType + membershipId, fetches
// and displays characters/inventory/vault. Used by both the name-search
// lookup and the "View My Inventory" authenticated flow.
async function renderInventoryResults(membershipType, membershipId, displayLabel, opts){
  const canTransfer = !!(opts && opts.canTransfer); // only true for the signed-in "My Inventory" path
  const vaultOnly = !!(opts && opts.vaultOnly); // My Vault tab shows just the vault, not per-character lists
  const col = document.getElementById((opts && opts.containerId) || 'syncResultsHolder');
  if(!col) return;
  col.innerHTML = "";
  const loading = el('div','empty-note', vaultOnly ? 'Fetching your vault contents...' : 'Fetching characters, inventory, and vault — this makes several live calls to Bungie.net, may take a few seconds...');
  col.appendChild(loading);
  try {
    const {characters: chars, vault} = await getFullInventory(membershipType, membershipId);
    col.innerHTML = "";
    const header = el('div','empty-note', `${displayLabel} on ${MEMBERSHIP_TYPE_NAMES[membershipType]||'platform '+membershipType}` + (canTransfer ? '' : ' — view only, no transfers'));
    header.style.fontStyle='normal'; header.style.marginBottom='10px';
    col.appendChild(header);
    if(!chars.length){
      col.appendChild(el('div','empty-note', 'No characters found on this account — it may be brand new, or on a linked platform with no Destiny 2 characters.'));
      return;
    }
    const totalItems = chars.reduce((sum,c)=>sum+c.equipped.length+c.inventory.length, 0) + vault.length;
    if(totalItems === 0){
      col.appendChild(el('div','empty-note', 'Characters found, but no items were returned. This usually means your "Show Destiny Game Progress" / inventory privacy setting is not public — check Bungie.net → Settings → Privacy, or it may take a moment after your last login for Bungie to refresh your data.'));
      return;
    }

    async function doTransfer(item, direction, targetCharId, btn){
      if(!item.instanceId){
        alert("This item can't be transferred (no instance ID — likely a stackable consumable/material).");
        return;
      }
      const confirmMsg = direction === "toVault"
        ? "Move this item to the Vault?"
        : "Move this item from the Vault to this character?";
      if(!window.confirm(confirmMsg)) return;
      btn.disabled = true; btn.textContent = "Moving...";
      try {
        await transferItem({itemHash: item.hash, instanceId: item.instanceId, membershipType, characterId: targetCharId, direction});
        // Refresh the whole view so the moved item shows in its new location.
        await renderInventoryResults(membershipType, membershipId, displayLabel, opts);
      } catch(e){
        alert("Transfer failed: " + e.message);
        btn.disabled = false; btn.textContent = direction === "toVault" ? "\u2192 Vault" : "\u2192 Character";
      }
    }

    function renderItemGrid(items, label, gridContext){
      const sub = el('div','', `<div style="font-size:11px;color:var(--muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">${label} (${items.length})</div>`);
      col.appendChild(sub);
      const grid = el('div','chipgrid');
      col.appendChild(grid);
      items.forEach(async (item)=>{
        try {
          const def = await getItemDefinition(item.hash);
          const chip = el('div','chip');
          chip.style.display='flex'; chip.style.alignItems='center'; chip.style.gap='8px';
          if(def.icon){
            const img = document.createElement('img');
            img.src = def.icon; img.style.width='32px'; img.style.height='32px'; img.style.borderRadius='4px';
            chip.appendChild(img);
          }
          chip.appendChild(el('span','nm', def.name));
          if(canTransfer && gridContext.transferable && item.instanceId){
            const btn = document.createElement('button');
            btn.className = 'reset';
            btn.style.marginLeft = 'auto'; btn.style.fontSize = '11px'; btn.style.padding = '4px 8px';
            if(gridContext.type === 'vault'){
              btn.textContent = `\u2192 ${CLASS_TYPE_NAMES[gridContext.targetClassType] || 'Character'}`;
              btn.onclick = (e)=>{ e.stopPropagation(); doTransfer(item, "toCharacter", gridContext.targetCharId, btn); };
            } else {
              btn.textContent = "\u2192 Vault";
              btn.onclick = (e)=>{ e.stopPropagation(); doTransfer(item, "toVault", gridContext.targetCharId, btn); };
            }
            chip.appendChild(btn);
          }
          grid.appendChild(chip);
        } catch(e){ /* skip items that fail to resolve (e.g. non-item hashes) */ }
      });
    }

    // Vault-specific renderer: groups items into real category sections
    // (Kinetic/Energy/Power Weapons, Helmet, Gauntlets, etc.) with each
    // item's current Power level shown, matching how the in-game character
    // screen and tools like Ishtar Commander organize the vault.
    function renderCategorizedVaultGrid(items, gridContext){
      const resolved = [];
      let pending = items.length;
      if(pending === 0){
        col.appendChild(el('div','empty-note','Vault is empty.'));
        return;
      }
      items.forEach(async (item)=>{
        try {
          const def = await getItemDefinition(item.hash);
          resolved.push({item, def});
        } catch(e){ /* skip unresolvable items */ }
        pending--;
        if(pending === 0) renderGrouped();
      });
      function renderGrouped(){
        const byBucket = {};
        resolved.forEach(r=>{
          const key = r.def.bucketHash || 0;
          (byBucket[key] = byBucket[key] || []).push(r);
        });
        const orderedKeys = [...BUCKET_ORDER.filter(k=>byBucket[k]), ...Object.keys(byBucket).map(Number).filter(k=>!BUCKET_ORDER.includes(k))];
        orderedKeys.forEach(bucketHash=>{
          const group = byBucket[bucketHash];
          if(!group || !group.length) return;
          const label = BUCKET_NAMES[bucketHash] || "Other";
          const sub = el('div','', `<div style="font-size:11px;color:var(--muted);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.06em;">/ ${label} (${group.length})</div>`);
          col.appendChild(sub);
          const grid = el('div','chipgrid');
          col.appendChild(grid);
          group.forEach(({item,def})=>{
            const chip = el('div','chip');
            chip.style.display='flex'; chip.style.alignItems='flex-start'; chip.style.gap='8px';
            if(def.icon){
              const img = document.createElement('img');
              img.src = def.icon; img.style.width='36px'; img.style.height='36px'; img.style.borderRadius='4px';
              chip.appendChild(img);
            }
            const nameCol = el('div',''); nameCol.style.flex='1';
            const nameRow = el('div','');
            nameRow.appendChild(el('span','nm', def.name));
            if(item.isMasterworked){
              const mwBadge = document.createElement('span');
              mwBadge.textContent = ' MW';
              mwBadge.style.color = 'var(--gold)'; mwBadge.style.fontWeight = 'bold'; mwBadge.style.fontSize = '11px';
              nameRow.appendChild(mwBadge);
            }
            nameCol.appendChild(nameRow);
            if(item.power) nameCol.appendChild(el('div','', `<span style="color:var(--gold);font-size:11px;">\u25C8 ${item.power}</span>`));
            // Weapons show their type, element, and currently-socketed
            // mods/perks — known perks (ones this tool's own library
            // recognizes, same ones usable in "My Real Weapons" on the
            // Build Synergy page) are highlighted; unrecognized ones are
            // shown dimmer since they won't contribute a synergy number.
            const isWeaponBucket = [1498876634,2465295065,953998645].includes(bucketHash);
            if(isWeaponBucket){
              const typeElemLine = el('div','', `<span style="color:var(--muted2);font-size:10px;">${DAMAGE_TYPE_TO_ELEMENT[def.damageType]||''} ${def.typeName||''}</span>`);
              nameCol.appendChild(typeElemLine);
            }
            if(isWeaponBucket && item.socketedPlugHashes && item.socketedPlugHashes.length){
              const modsLine = el('div','','');
              modsLine.style.fontSize = '11px'; modsLine.style.marginTop = '2px';
              modsLine.textContent = 'Loading perks...';
              nameCol.appendChild(modsLine);
              (async ()=>{
                const allKnownPerks = [
                  ...UNIVERSAL_PERKS,
                  ...Object.values(ELEMENT_LOCKED_PERKS).flat(),
                  ...Object.values(WEAPON_TYPE_PERKS).flat(),
                  ...ORIGIN_TRAITS,
                ];
                const parts = [];
                for(const plugHash of item.socketedPlugHashes){
                  try {
                    const plugDef = await getItemDefinition(plugHash);
                    if(!plugDef.name || plugDef.name === "Unknown Item") continue;
                    const isKnown = allKnownPerks.some(p=>p.name.toLowerCase()===plugDef.name.toLowerCase());
                    parts.push(isKnown
                      ? `<span style="color:var(--gold);">${plugDef.name}</span>`
                      : `<span style="color:var(--muted2);opacity:0.7;">${plugDef.name}</span>`);
                  } catch(e){ /* skip unresolvable plugs */ }
                }
                modsLine.innerHTML = parts.join(' \u2022 ');
              })();
            }
            chip.appendChild(nameCol);
            if(canTransfer && gridContext.transferable && item.instanceId){
              const btn = document.createElement('button');
              btn.className = 'reset';
              btn.style.marginLeft = 'auto'; btn.style.fontSize = '11px'; btn.style.padding = '4px 8px';
              btn.textContent = `\u2192 ${CLASS_TYPE_NAMES[gridContext.targetClassType] || 'Character'}`;
              btn.onclick = (e)=>{ e.stopPropagation(); doTransfer(item, "toCharacter", gridContext.targetCharId, btn); };
              chip.appendChild(btn);
            }
            grid.appendChild(chip);
          });
        });
      }
    }

    if(!vaultOnly){
      for(const char of chars){
        const charPanel = el('div','panel');
        charPanel.appendChild(el('h3','', `${CLASS_TYPE_NAMES[char.classType]||'Unknown'} — Power ${char.light||'?'}`));
        col.appendChild(charPanel);
        renderItemGrid(char.equipped, 'Equipped', {type:'character', transferable:false});
        renderItemGrid(char.inventory, 'Inventory (unequipped)', {type:'character', transferable:true, targetCharId:char.charId});
        if(canTransfer) col.appendChild(el('div','empty-note','Equipped items must be unequipped in-game before they can transfer \u2014 not supported here yet.'));
      }
    }

    const vaultPanel = el('div','panel');
    vaultPanel.appendChild(el('h3','', 'Vault'));
    col.appendChild(vaultPanel);
    if(canTransfer && chars.length){
      const targetRow = el('div','row');
      targetRow.style.marginBottom = '8px';
      targetRow.appendChild(el('span','', 'Send to: '));
      const targetSel = document.createElement('select');
      chars.forEach(c=>{
        const o = document.createElement('option');
        o.value = c.charId; o.textContent = CLASS_TYPE_NAMES[c.classType] || c.charId;
        targetSel.appendChild(o);
      });
      targetSel.id = 'vaultTransferTarget';
      targetRow.appendChild(targetSel);
      col.appendChild(targetRow);
      renderCategorizedVaultGrid(vault, {transferable:true, get targetCharId(){ return document.getElementById('vaultTransferTarget').value; }, get targetClassType(){ const c = chars.find(x=>x.charId===document.getElementById('vaultTransferTarget').value); return c ? c.classType : null; }});
    } else {
      renderCategorizedVaultGrid(vault, {transferable:false});
    }

    const roDisclaimer = el('div','empty-note', canTransfer
      ? 'Transfers call Bungie\u2019s real inventory API using your signed-in session \u2014 this moves actual items on your account. Double-check before confirming.'
      : 'View-only here. Sign in above and use "View My Inventory" to enable moving items to/from the vault.');
    roDisclaimer.style.padding = '10px 4px 4px';
    col.appendChild(roDisclaimer);
  } catch(err){
    col.innerHTML = "";
    const errNote = el('div','empty-note', `Lookup failed: ${err.message}`);
    errNote.style.color = 'var(--danger)';
    col.appendChild(errNote);
  }
}

async function renderSyncResults(bungieName){
  try {
    const player = await searchBungiePlayer(bungieName);
    const membershipType = player.crossSaveOverride && player.crossSaveOverride !== 0 ? player.crossSaveOverride : player.membershipType;
    await renderInventoryResults(membershipType, player.membershipId, `Found: ${player.bungieGlobalDisplayName || bungieName}`);
  } catch(err){
    const col = document.getElementById('syncResultsHolder');
    if(col){
      col.innerHTML = "";
      const errNote = el('div','empty-note', `Lookup failed: ${err.message}`);
      errNote.style.color = 'var(--danger)';
      col.appendChild(errNote);
    }
  }
}

// Authenticated path: uses the signed-in session instead of a typed name.
async function renderMyInventory(){
  const col = document.getElementById('syncResultsHolder');
  if(col){ col.innerHTML = ""; col.appendChild(el('div','empty-note', 'Resolving your signed-in account...')); }
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error("Not signed in, or your session expired \u2014 sign in again above.");
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    await renderInventoryResults(membership.membershipType, membership.membershipId, `Signed in as ${membership.displayName || 'you'}`, {canTransfer: true});
  } catch(err){
    if(col){
      col.innerHTML = "";
      const errNote = el('div','empty-note', `Couldn't load your inventory: ${err.message}`);
      errNote.style.color = 'var(--danger)';
      col.appendChild(errNote);
    }
  }
}

// Dedicated "My Vault" path — shows just the vault (with transfer-to-
// character buttons), skipping the per-character equipped/inventory lists
// already covered under Sign In → View My Inventory.
async function renderMyVault(){
  const col = document.getElementById('vaultResultsHolder');
  if(col){ col.innerHTML = ""; col.appendChild(el('div','empty-note', 'Resolving your signed-in account...')); }
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error("Not signed in, or your session expired \u2014 sign in again above.");
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    await renderInventoryResults(membership.membershipType, membership.membershipId, `Signed in as ${membership.displayName || 'you'}`, {canTransfer: true, vaultOnly: true, containerId: 'vaultResultsHolder'});
  } catch(err){
    if(col){
      col.innerHTML = "";
      const errNote = el('div','empty-note', `Couldn't load your vault: ${err.message}`);
      errNote.style.color = 'var(--danger)';
      col.appendChild(errNote);
    }
  }
}

const drawerAccordionOpen = {signin:false, lookup:false, vault:false};

// Phase 1 — sign-in section, rendered at the BOTTOM of the drawer.
function renderSignInSection(col){
  const signinRow = el('div','drawerRow');
  signinRow.setAttribute('data-testid','signin-row');
  const storedAuth = getStoredAuth();
  signinRow.appendChild(el('span','rowLabel', storedAuth ? 'Bungie Account (signed in)' : 'Sign in with Bungie'));
  signinRow.appendChild(el('span','rowChev'+(drawerAccordionOpen.signin?' open':''), '&#10095;'));
  signinRow.onclick = ()=>{ drawerAccordionOpen.signin = !drawerAccordionOpen.signin; renderSyncPanel(); };
  col.appendChild(signinRow);
  if(drawerAccordionOpen.signin){
    const body = el('div','drawerAccordionBody');
    if(storedAuth){
      const stillValid = storedAuth.refreshTokenExpires && Date.now() < storedAuth.refreshTokenExpires;
      const statusNote = el('div','empty-note', stillValid
        ? 'Signed in \u2014 session will refresh automatically. Membership ID: ' + storedAuth.membership_id
        : 'Session expired \u2014 please sign in again.');
      body.appendChild(statusNote);
      if(stillValid){
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View My Inventory';
        viewBtn.className = 'reset';
        viewBtn.style.marginTop = '10px';
        viewBtn.style.marginRight = '8px';
        viewBtn.setAttribute('data-testid','view-my-inventory-btn');
        viewBtn.onclick = (e)=>{ e.stopPropagation(); closeDrawer(); openFullScreenVault(); };
        body.appendChild(viewBtn);
      }
      const signOutBtn = document.createElement('button');
      signOutBtn.textContent = 'Sign Out';
      signOutBtn.className = 'reset';
      signOutBtn.style.marginTop = '10px';
      signOutBtn.onclick = (e)=>{ e.stopPropagation(); clearStoredAuth(); state.selectedCharId=null; liveSyncState.characters=null; renderSyncPanel(); render(); };
      body.appendChild(signOutBtn);
    } else {
      const oauthDesc = el('div','empty-note', 'Sign in with your Bungie.net account to authenticate. This redirects to Bungie\u2019s real sign-in page \u2014 your password is never seen by this app.');
      body.appendChild(oauthDesc);
      if(window.__d2synergyAuthError){
        const errNote = el('div','empty-note', 'Last sign-in attempt failed: ' + window.__d2synergyAuthError);
        errNote.style.color = 'var(--danger)';
        body.appendChild(errNote);
      }
      const oauthBtn = document.createElement('button');
      oauthBtn.textContent = 'Sign in with Bungie.net';
      oauthBtn.className = 'reset';
      oauthBtn.style.marginTop = '10px';
      oauthBtn.setAttribute('data-testid','signin-bungie-btn');
      oauthBtn.onclick = (e)=>{ e.stopPropagation(); startBungieSignIn(); };
      body.appendChild(oauthBtn);
    }
    col.appendChild(body);
  }
}

function renderSyncPanel(){
  const col = document.getElementById('syncCol');
  col.innerHTML = "";

  // ---- My Vault — opens the DIM/Ishtar-style full-screen vault window ----
  const vaultViewRow = el('div','drawerRow');
  vaultViewRow.setAttribute('data-testid','open-fullscreen-vault-row');
  vaultViewRow.appendChild(el('span','rowLabel','My Vault'));
  vaultViewRow.appendChild(el('span','rowChev','&#10095;'));
  vaultViewRow.onclick = ()=>{ closeDrawer(); openFullScreenVault(); };
  col.appendChild(vaultViewRow);

  // ---- Vendor Inventories (full-screen window) ----
  const vendorsRow = el('div','drawerRow');
  vendorsRow.setAttribute('data-testid','open-vendors-row');
  vendorsRow.appendChild(el('span','rowLabel','Vendor Inventories'));
  vendorsRow.appendChild(el('span','rowChev','&#10095;'));
  vendorsRow.onclick = ()=>{ closeDrawer(); openVendorsWindow(); };
  col.appendChild(vendorsRow);

  // ---- Daily & Weekly Activities (full-screen window) ----
  const activitiesRow = el('div','drawerRow');
  activitiesRow.setAttribute('data-testid','open-activities-row');
  activitiesRow.appendChild(el('span','rowLabel','Daily & Weekly Activities'));
  activitiesRow.appendChild(el('span','rowChev','&#10095;'));
  activitiesRow.onclick = ()=>{ closeDrawer(); openActivitiesWindow(); };
  col.appendChild(activitiesRow);

  // ---- Sign in with Bungie is rendered at the BOTTOM (see below) ----

  // ---- Read-only public lookup — accordion row (works today, once Origin
  // header is set on the Bungie application) ----
  const lookupRow = el('div','drawerRow');
  lookupRow.appendChild(el('span','rowLabel','Look Up Equipped Gear'));
  lookupRow.appendChild(el('span','rowChev'+(drawerAccordionOpen.lookup?' open':''), '&#10095;'));
  lookupRow.onclick = ()=>{ drawerAccordionOpen.lookup = !drawerAccordionOpen.lookup; renderSyncPanel(); };
  col.appendChild(lookupRow);
  if(drawerAccordionOpen.lookup){
    const body = el('div','drawerAccordionBody');
    const desc = el('div','empty-note', 'Enter your Bungie name (format: Name#1234, found on your Bungie.net profile). This reads live public profile data directly from your browser, read-only, no login required. Only works if your equipped-loadout privacy is public (the default setting).');
    body.appendChild(desc);
    const row = el('div','row');
    row.style.display='flex'; row.style.gap='8px'; row.style.marginTop='8px';
    const input = document.createElement('input');
    input.type='text'; input.placeholder='Name#1234'; input.style.flex='1';
    input.style.padding='8px'; input.style.background='var(--panel2)'; input.style.border='1px solid var(--line)'; input.style.color='var(--text)'; input.style.borderRadius='4px';
    input.onclick = (e)=>e.stopPropagation();
    row.appendChild(input);
    const btn = document.createElement('button');
    btn.textContent='Look Up'; btn.className='reset';
    btn.onclick = (e)=>{ e.stopPropagation(); if(input.value.trim()) renderSyncResults(input.value.trim()); };
    row.appendChild(btn);
    body.appendChild(row);
    const resultsHolder = el('div','','');
    resultsHolder.id = 'syncResultsHolder';
    body.appendChild(resultsHolder);
    col.appendChild(body);
  }

  // ---- Jump to Section — plain stacked list rows, dbrand-menu style ----
  Object.entries(PANEL_LABELS).forEach(([id,label])=>{
    const navRow = el('div','drawerRow');
    navRow.appendChild(el('span','rowLabel',label));
    navRow.appendChild(el('span','rowChev','&#10095;'));
    navRow.onclick = ()=>{ openPanel(id); };
    col.appendChild(navRow);
  });

  // ---- Sign in with Bungie — pinned to the literal bottom of the drawer's
  // viewport (a real fixed footer, not just last-in-scroll-order) ----
  const footerCol = document.getElementById('syncDrawerFooter');
  footerCol.innerHTML = '';
  renderSignInSection(footerCol);
}
renderSyncPanel();

const syncDrawer = document.getElementById('syncDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
function openDrawer(){ syncDrawer.classList.add('open'); drawerOverlay.classList.add('open'); }
function closeDrawer(){ syncDrawer.classList.remove('open'); drawerOverlay.classList.remove('open'); }
document.getElementById('syncDrawerBtn').onclick = openDrawer;
document.getElementById('drawerCloseBtn').onclick = closeDrawer;
drawerOverlay.onclick = closeDrawer;

// Swipe-from-right-edge gesture: lets you pull the drawer open from
// anywhere in the app, not just by tapping the hamburger button. Only
// starts tracking a swipe if the touch begins within a thin zone right at
// the screen's right edge, so normal scrolling/tapping elsewhere is
// completely unaffected.
(function(){
  let startX = null, startY = null, tracking = false;
  const EDGE_ZONE = 24;
  const SWIPE_THRESHOLD = 60;
  function anyFullScreenOverlayOpen(){
    return document.querySelectorAll('.fsOverlay.open').length > 0;
  }
  document.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    if(!t) return;
    // Skip entirely while a full-screen overlay (Vault/Vendors/Activities)
    // is open — those views have their own touch-drag interactions near
    // the right edge (e.g. dragging a vault item), and this gesture's
    // preventDefault() would otherwise swallow that touch before the
    // item's own drag handler ever sees it.
    if(anyFullScreenOverlayOpen()){ tracking = false; return; }
    if(window.innerWidth - t.clientX <= EDGE_ZONE){
      startX = t.clientX; startY = t.clientY; tracking = true;
      // Non-passive on purpose: iOS/Android reserve this exact edge zone for
      // their own back/forward swipe gesture, which silently wins over a
      // passive listener since passive listeners can never call
      // preventDefault(). This is a best-effort override — some browsers
      // (notably Chrome iOS) don't fully honor it even so.
      e.preventDefault();
    } else {
      tracking = false;
    }
  }, {passive:false});
  document.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    if(!t) return;
    const deltaX = t.clientX - startX;
    const deltaY = Math.abs(t.clientY - startY);
    if(deltaX < -SWIPE_THRESHOLD && deltaY < 80){
      openDrawer();
    }
  }, {passive:true});
})();

