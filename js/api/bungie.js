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
  MANIFEST_CACHE_VERSION: "v6-tiered-plug-options",
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

// Official public Bungie icon support. Live objects already carry an exact
// manifest hash/icon, while hand-curated builder entries are resolved through
// Destiny2.SearchDestinyEntities. Name searches require an exact normalized
// match: showing no icon is safer than attaching the wrong first search result.
const BUNGIE_ICON_HOST = "https://www.bungie.net";
const __d2sIconInFlight = new Map();
let __d2sIconObserver = null;

function normalizeIconLookupName(value){
  return String(value || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "").replace(/[–—]/g, "-")
    .replace(/\s*\((arc|solar|void|stasis|strand|kinetic|prismatic)\)\s*$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function publicBungieIconUrl(value){
  if(!value) return null;
  if(/^https?:\/\//i.test(value)) return value;
  return BUNGIE_ICON_HOST + (String(value).startsWith("/") ? value : "/" + value);
}

function iconTypeScore(def, requestedType){
  const t = normalizeIconLookupName(`${def?.itemTypeDisplayName||""} ${def?.itemTypeAndTierDisplayName||""} ${def?.typeName||""} ${def?.plug?.plugCategoryIdentifier||""} ${def?.plugCategoryIdentifier||""}`);
  const numericType = Number(def?.itemType);
  const hasTypeMetadata = !!t || Number.isFinite(numericType);
  if(!hasTypeMetadata) return 0;
  const type = String(requestedType || "").toLowerCase();
  if(type === "weapon") return numericType === 3 || /weapon|rifle|hand cannon|sidearm|bow|glaive|sword|launcher|shotgun|sniper|fusion|machine gun|trace rifle/.test(t) ? 30 : -30;
  if(type === "armor") return numericType === 2 || /armor|helmet|gauntlet|chest|leg armor|class item|cloak|mark|bond/.test(t) ? 30 : -30;
  if(type === "super") return /super ability|super/.test(t) ? 30 : -20;
  if(type === "grenade") return /grenade/.test(t) ? 30 : -20;
  if(type === "melee") return /melee/.test(t) ? 30 : -20;
  if(type === "classability" || type === "class ability") return /class ability/.test(t) ? 30 : -20;
  if(type === "aspect") return /aspect/.test(t) ? 30 : -20;
  if(type === "fragment") return /fragment|facet|ember|echo|spark|whisper|thread/.test(t) ? 30 : -15;
  if(type === "ability") return /ability|aspect|fragment|facet|ember|echo|spark|whisper|thread|grenade|melee|super/.test(t) ? 20 : 0;
  if(type === "mod") return /mod/.test(t) ? 20 : 0;
  if(type === "perk") return /perk|trait|intrinsic|artifact|mod/.test(t) ? 15 : 0;
  return 0;
}

function iconSourceParts(source){
  if(typeof source === "string") return {name:source, hash:null, icon:null};
  if(!source || typeof source !== "object") return {name:"", hash:null, icon:null};
  return {
    name: source.name || source.displayProperties?.name || "",
    hash: source.hash || source.itemHash || null,
    icon: source.icon || source.displayProperties?.icon || null,
  };
}

async function resolvePublicBungieIcon(source, itemType){
  const parts = iconSourceParts(source);
  const direct = publicBungieIconUrl(parts.icon);
  if(direct) return direct;

  if(parts.hash && typeof getItemDefinition === "function"){
    try {
      const def = await getItemDefinition(parts.hash);
      const byHash = publicBungieIconUrl(def?.icon || def?.displayProperties?.icon);
      if(byHash) return byHash;
    } catch(e){}
  }

  const lookupName = String(parts.name || "").trim();
  const normalizedName = normalizeIconLookupName(lookupName);
  if(!normalizedName) return null;
  const cacheKey = `${String(itemType||"item").toLowerCase()}|${normalizedName}`;
  if(Object.prototype.hasOwnProperty.call(iconCache, cacheKey)) return iconCache[cacheKey];
  if(__d2sIconInFlight.has(cacheKey)) return __d2sIconInFlight.get(cacheKey);

  const request = (async()=>{
    try {
      const searchTerm = lookupName.replace(/\s*\((arc|solar|void|stasis|strand|kinetic|prismatic)\)\s*$/i, "").trim();
      const res = await rateLimitedFetch(`${BUNGIE_BASE}/Destiny2/Armory/Search/DestinyInventoryItemDefinition/${encodeURIComponent(searchTerm)}/`, {
        headers: { "X-API-Key": BUNGIE_API_KEY }
      });
      if(!res.ok) throw new Error("http "+res.status);
      const json = await res.json();
      const results = json?.Response?.results?.results || [];
      const ranked = results
        .filter(r=>r?.displayProperties?.icon)
        .map(r=>{
          const candidateName = normalizeIconLookupName(r.displayProperties?.name);
          let score = candidateName === normalizedName ? 100 : -100;
          score += iconTypeScore(r, itemType);
          if(r.redacted) score -= 50;
          return {r, score};
        })
        .sort((a,b)=>b.score-a.score);
      const best = ranked[0];
      const iconUrl = best && best.score >= 80 ? publicBungieIconUrl(best.r.displayProperties.icon) : null;
      iconCache[cacheKey] = iconUrl;
      persistIconCache();
      return iconUrl;
    } catch(e){
      iconCache[cacheKey] = null;
      persistIconCache();
      return null;
    } finally {
      __d2sIconInFlight.delete(cacheKey);
    }
  })();
  __d2sIconInFlight.set(cacheKey, request);
  return request;
}

function ensureIconObserver(){
  if(__d2sIconObserver || typeof IntersectionObserver === "undefined") return __d2sIconObserver;
  __d2sIconObserver = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      __d2sIconObserver.unobserve(entry.target);
      const load = entry.target.__d2sLoadIcon;
      if(load) load();
    });
  }, {rootMargin:"240px 0px"});
  return __d2sIconObserver;
}

// Backward-compatible helper used throughout the UI. `source` may be a name,
// a manifest definition, or a live inventory object with hash/icon fields.
function attachLiveIcon(container, source, itemType, options={}){
  if(!container || !source) return null;
  const parts = iconSourceParts(source);
  const key = `${String(itemType||"item").toLowerCase()}|${parts.hash||normalizeIconLookupName(parts.name)}`;
  if(!parts.hash && !normalizeIconLookupName(parts.name) && !parts.icon) return null;
  if(Array.from(container.querySelectorAll('img[data-d2-icon-key]')).some(node=>node.dataset.d2IconKey===key)) return null;

  const img = document.createElement("img");
  img.className = `bungiePublicIcon bungiePublicIcon--${String(itemType||"item").replace(/[^a-z0-9_-]/gi,"").toLowerCase()}`;
  img.dataset.d2IconKey = key;
  img.alt = parts.name ? `${parts.name} icon` : "Destiny 2 icon";
  img.title = parts.name || "Destiny 2 manifest icon";
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  if(options.size) img.style.setProperty("--bungie-icon-size", `${Number(options.size)}px`);
  if(options.className) img.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  container.insertBefore(img, container.firstChild);

  let started = false;
  const load = async()=>{
    if(started) return; started = true;
    const url = await resolvePublicBungieIcon(source, itemType);
    if(!img.isConnected) return;
    if(!url){ img.remove(); return; }
    img.onerror = ()=>img.remove();
    img.src = url;
    img.classList.add("loaded");
    container.classList.add("hasBungiePublicIcon");
  };
  img.__d2sLoadIcon = load;

  const direct = publicBungieIconUrl(parts.icon);
  if(direct){ load(); }
  else {
    const observer = ensureIconObserver();
    if(observer) observer.observe(img); else load();
  }
  return img;
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
let realWeaponsCache = {fetchedAt: 0, bySlot: {Kinetic:[], Energy:[], Power:[]}};
let realGearCache = {fetchedAt: 0, weaponsBySlot: {Kinetic:[], Energy:[], Power:[]}, armorBySlot: {Helmet:[], Arms:[], Chest:[], Legs:[], ClassItem:[]}, artifactPerkHashes: [], artifactPowerBonus: 0};
async function populateRealGearCacheFromFullInventory(full){
  const {characters, vault, artifactPerkHashes, artifactPowerBonus} = full;
  const allItems = [...vault];
  characters.forEach(c=>{ allItems.push(...c.equipped); allItems.push(...c.inventory); });
  const weaponsBySlot = {Kinetic:[], Energy:[], Power:[]};
  const armorBySlot = {Helmet:[], Arms:[], Chest:[], Legs:[], ClassItem:[]};
  const seen = new Set();
  await Promise.all(allItems.map(async item=>{
    if(!item.instanceId || seen.has(item.instanceId)) return;
    try {
      const def = item._def || await getItemDefinition(item.hash);
      item._def = def;
      const built = {
        hash:item.hash, instanceId:item.instanceId, name:def.name, icon:def.icon,
        element:DAMAGE_TYPE_TO_ELEMENT[def.damageType]||'Kinetic', typeName:def.typeName,
        power:item.power, isMasterworked:item.isMasterworked, energyCapacity:item.energyCapacity,
        stats:item.stats, sockets:item.sockets||[], socketedPlugHashes:item.socketedPlugHashes||[],
        isExotic:def.tierType===6,
      };
      const currentBucket=Number(item.bucketHash||def.bucketHash||0);
      const weaponSlot=BUCKET_TO_WEAPON_SLOT[currentBucket];
      const armorSlot=BUCKET_TO_ARMOR_SLOT[currentBucket];
      if(weaponSlot){ seen.add(item.instanceId); weaponsBySlot[weaponSlot].push(built); }
      else if(armorSlot){ seen.add(item.instanceId); armorBySlot[armorSlot].push(built); }
    } catch(e){}
  }));
  Object.values(weaponsBySlot).forEach(arr=>arr.sort((a,b)=>(b.power||0)-(a.power||0)));
  Object.values(armorBySlot).forEach(arr=>arr.sort((a,b)=>(b.power||0)-(a.power||0)));
  realGearCache={fetchedAt:Date.now(),weaponsBySlot,armorBySlot,artifactPerkHashes:artifactPerkHashes||[],artifactPowerBonus:artifactPowerBonus||0};
  realWeaponsCache={fetchedAt:realGearCache.fetchedAt,bySlot:weaponsBySlot};
  return realGearCache;
}
async function refreshMyRealGear(){
  const auth=await getValidAccessToken();
  if(!auth) throw new Error('Not signed in — sign in above to sync your real gear here.');
  const membership=await getMembershipsForCurrentUser(auth.access_token);
  const full=await getFullInventory(membership.membershipType,membership.membershipId);
  return populateRealGearCacheFromFullInventory(full);
}
// Kept for the existing "Load My Weapons" button — now just a thin wrapper.
async function refreshMyRealWeapons(){ return refreshMyRealGear(); }

// The exact sync implementation is defined later in
// features/live-character-sync.js. Keep this compatibility wrapper so older
// markup cannot fall back to an account-wide "best owned item" routine.
async function syncEverything(){
  if(typeof window.syncMyLiveBuildExact === 'function') return window.syncMyLiveBuildExact();
  fsToast('Exact live-sync module did not load. Hard-refresh the page and check that js/features/live-character-sync.js is present.', 'err');
}
const __globalSyncCompatibilityButton=document.getElementById('globalSyncBtn');
if(__globalSyncCompatibilityButton) __globalSyncCompatibilityButton.onclick=syncEverything;
console.info('[D2Synergy] compatibility sync binding loaded; awaiting exact CharacterEquipment module');

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
        hash: Number(hash),
        name: def.displayProperties?.name || "Unknown Item",
        description: def.displayProperties?.description || "",
        icon: def.displayProperties?.icon ? "https://www.bungie.net" + def.displayProperties.icon : null,
        bucketHash: def.inventory?.bucketTypeHash || null,
        damageType: def.defaultDamageType || 0,
        itemType: def.itemType || 0,
        itemSubType: def.itemSubType || 0,
        tierType: def.inventory?.tierType || 0,
        typeName: def.itemTypeDisplayName || "",
        plugCategoryIdentifier: def.plug?.plugCategoryIdentifier || "",
        plugCategoryHash: def.plug?.plugCategoryHash || null,
        traitIds: def.traitIds || [],
        itemCategoryHashes: def.itemCategoryHashes || [],
        collectibleHash: def.collectibleHash || null,
        socketCategories: (def.sockets?.socketCategories || []).map(c=>({socketCategoryHash:c.socketCategoryHash, socketIndexes:c.socketIndexes||[]})),
        socketEntries: (def.sockets?.socketEntries || []).map(e=>({socketTypeHash:e.socketTypeHash, singleInitialItemHash:e.singleInitialItemHash, reusablePlugSetHash:e.reusablePlugSetHash, randomizedPlugSetHash:e.randomizedPlugSetHash, reusablePlugItemHashes:(e.reusablePlugItems||[]).map(p=>p.plugItemHash).filter(Boolean), preventInitializationOnVendorPurchase:!!e.preventInitializationOnVendorPurchase, hidePerksInItemTooltip:!!e.hidePerksInItemTooltip})),
        equippable: !!def.equippable,
        classType: def.classType ?? 3,
        doesPostmasterPullHaveSideEffects: !!def.doesPostmasterPullHaveSideEffects,
        iconWatermark: def.iconWatermark ? "https://www.bungie.net" + def.iconWatermark : null,
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

const __artifactDefCache = {};
const __artifactDefInFlight = {};
async function getArtifactDefinition(hash){
  const key=String(hash||'');
  if(!key) return null;
  if(__artifactDefCache[key]) return __artifactDefCache[key];
  if(__artifactDefInFlight[key]) return __artifactDefInFlight[key];
  __artifactDefInFlight[key]=(async()=>{
    try {
      const def=await bungieGet(`/Destiny2/Manifest/DestinyArtifactDefinition/${key}/`);
      const result={
        hash:Number(hash),
        name:def.displayProperties?.name || 'Seasonal Artifact',
        description:def.displayProperties?.description || '',
        icon:def.displayProperties?.icon ? 'https://www.bungie.net'+def.displayProperties.icon : null,
        tierHashes:(def.tiers||[]).map(t=>t.tierHash).filter(Boolean),
      };
      __artifactDefCache[key]=result;
      return result;
    } finally { delete __artifactDefInFlight[key]; }
  })();
  return __artifactDefInFlight[key];
}

const __socketCategoryDefCache = {};
async function getSocketCategoryDefinition(hash){
  const key=String(hash||'');
  if(!key) return null;
  if(__socketCategoryDefCache[key]) return __socketCategoryDefCache[key];
  const def=await bungieGet(`/Destiny2/Manifest/DestinySocketCategoryDefinition/${key}/`);
  const result={
    hash:Number(hash),
    name:def.displayProperties?.name || '',
    description:def.displayProperties?.description || '',
    categoryStyle:def.categoryStyle ?? 0,
  };
  __socketCategoryDefCache[key]=result;
  return result;
}

const __socketTypeDefCache = {};
async function getSocketTypeDefinition(hash){
  const key=String(hash||'');
  if(!key) return null;
  if(__socketTypeDefCache[key]) return __socketTypeDefCache[key];
  const def=await bungieGet(`/Destiny2/Manifest/DestinySocketTypeDefinition/${key}/`);
  const result={
    hash:Number(hash),
    name:def.displayProperties?.name || '',
    description:def.displayProperties?.description || '',
    plugWhitelist:def.plugWhitelist || [],
    socketCategoryHash:def.socketCategoryHash || null,
  };
  __socketTypeDefCache[key]=result;
  return result;
}


const __bucketDefCache = {};
const __bucketDefInFlight = {};
async function getInventoryBucketDefinition(hash){
  const key=String(hash||'');
  if(!key) return null;
  if(__bucketDefCache[key]) return __bucketDefCache[key];
  if(__bucketDefInFlight[key]) return __bucketDefInFlight[key];
  __bucketDefInFlight[key]=(async()=>{
    try {
      const def=await bungieGet(`/Destiny2/Manifest/DestinyInventoryBucketDefinition/${key}/`);
      const result={
        hash:Number(hash),
        name:def.displayProperties?.name || BUCKET_NAMES[Number(hash)] || `Bucket ${hash}`,
        description:def.displayProperties?.description || '',
        scope:def.scope ?? 0,
        category:def.category ?? 0,
        bucketOrder:def.bucketOrder ?? 999,
        itemCount:def.itemCount ?? 0,
        location:def.location ?? 0,
        hasTransferDestination:!!def.hasTransferDestination,
        vaultBucket:def.vaultBucket || null,
        enabled:def.enabled !== false,
      };
      __bucketDefCache[key]=result;
      return result;
    } finally { delete __bucketDefInFlight[key]; }
  })();
  return __bucketDefInFlight[key];
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
  const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=200,201,202,205,102,103,104,300,302,304,305,310`);
  const characters = profile.characters?.data || {};
  const equipment = profile.characterEquipment?.data || {};
  const inventories = profile.characterInventories?.data || {};
  const characterProgressions = profile.characterProgressions?.data || {};
  const vaultItems = profile.profileInventory?.data?.items || [];
  const instanceStats = profile.itemComponents?.instances?.data || {};
  const socketData = profile.itemComponents?.sockets?.data || {};
  const reusablePlugData = profile.itemComponents?.reusablePlugs?.data || {};
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
  const perkData = profile.itemComponents?.perks?.data || {};
  const mapItem = (i, source, characterId=null) => {
    const inst = i.itemInstanceId ? instanceStats[i.itemInstanceId] : null;
    const sockets = i.itemInstanceId ? (socketData[i.itemInstanceId]?.sockets || []) : [];
    const reusableBySocket = i.itemInstanceId ? (reusablePlugData[i.itemInstanceId]?.plugs || {}) : {};
    const stats = i.itemInstanceId ? (statData[i.itemInstanceId]?.stats || null) : null;
    return {
      hash: i.itemHash,
      instanceId: i.itemInstanceId || null,
      bucketHash: i.bucketHash || null,
      quantity: Number(i.quantity || 1),
      state: Number(i.state || 0),
      transferStatus: Number(i.transferStatus || 0),
      bindStatus: Number(i.bindStatus || 0),
      location: Number(i.location || 0),
      power: inst?.primaryStat?.value || null,
      gearTier: Number(inst?.gearTier||0)||null,
      energyCapacity: inst?.energy?.energyCapacity ?? null,
      energyType: inst?.energy?.energyType ?? null,
      isLocked: !!(Number(i.state || 0) & 1),
      isMasterworked: !!(inst && (inst.state & MASTERWORK_STATE_BIT)),
      socketedPlugHashes: sockets.filter(s=>s.isEnabled && s.plugHash).map(s=>s.plugHash),
      sockets: sockets.map((socket,index)=>({
        index,
        plugHash: socket.plugHash || null,
        isEnabled: socket.isEnabled !== false,
        isVisible: socket.isVisible !== false,
        reusablePlugHashes: Array.from(new Set([
          ...(socket.reusablePlugItems||[]).map(p=>p.plugItemHash),
          ...((reusableBySocket[index]||[]).map(p=>p.plugItemHash)),
        ].filter(Boolean))),
      })),
      stats: stats,
      activePerkHashes: i.itemInstanceId ? (perkData[i.itemInstanceId]?.perks || []).filter(p=>p.isActive).map(p=>p.perkHash).filter(Boolean) : [],
      source,
      characterId,
      isEquipped: source === "equipped",
    };
  };
  // Bungie returns CharacterInventories and CharacterEquipment as separate
  // components. Treat them as separate sources and defensively de-duplicate by
  // itemInstanceId, always preferring CharacterEquipment when the same item is
  // ever present in both responses. This guarantees one physical item renders
  // once and prevents impossible >10 counts in equippable character buckets.
  const dedupeInventoryItems = (items, preferredSource=null) => {
    const byKey = new Map();
    items.forEach((item,index)=>{
      const key = item.instanceId
        ? `instance:${item.instanceId}`
        : `uninstanced:${item.source}:${item.characterId||"profile"}:${item.bucketHash||0}:${item.hash}:${index}`;
      const existing = byKey.get(key);
      if(!existing || (preferredSource && item.source===preferredSource && existing.source!==preferredSource)) byKey.set(key,item);
    });
    return [...byKey.values()];
  };
  const profileArtifact = profile.profileProgression?.data?.seasonalArtifact || null;
  const charList = Object.keys(characters).map(charId=>{
    const equippedItems=(equipment[charId]?.items || []).map(i=>mapItem(i,"equipped",charId));
    const nonEquippedItems=(inventories[charId]?.items || []).map(i=>mapItem(i,"character",charId));

    // CharacterInventories includes both the Guardian's normal carried items
    // and Lost Items held by that character's Postmaster. DestinyItemLocation
    // value 4 is Postmaster; never count those against a character equipment
    // bucket's 10 total slots (1 equipped + up to 9 unequipped).
    const postmasterItems=nonEquippedItems
      .filter(i=>Number(i.location)===4 || Number(i.bucketHash)===215593132)
      .map(i=>({...i,source:"postmaster"}));
    const carriedItems=nonEquippedItems.filter(i=>Number(i.location)!==4 && Number(i.bucketHash)!==215593132);

    const merged=dedupeInventoryItems([...carriedItems,...equippedItems],"equipped");
    const equippedIds=new Set(equippedItems.map(i=>i.instanceId).filter(Boolean));
    const charArtifact=characterProgressions[charId]?.seasonalArtifact || null;
    const artifactPerkHashes=[];
    (charArtifact?.tiers||[]).forEach(tier=>{
      (tier.items||[]).forEach(item=>{ if(item.isActive) artifactPerkHashes.push(item.itemHash); });
    });
    return {
      charId,
      classType: characters[charId].classType, // 0=Titan, 1=Hunter, 2=Warlock
      light: characters[charId].light,
      stats: {...(characters[charId].stats || {})},
      emblemPath: characters[charId].emblemPath || null,
      dateLastPlayed: characters[charId].dateLastPlayed || null,
      equipped: merged.filter(i=>i.source==="equipped" || (i.instanceId && equippedIds.has(i.instanceId))),
      inventory: merged.filter(i=>i.source!=="equipped" && !(i.instanceId && equippedIds.has(i.instanceId))),
      postmaster: dedupeInventoryItems(postmasterItems),
      artifact: {
        artifactHash: charArtifact?.artifactHash || profileArtifact?.artifactHash || null,
        pointsUsed: charArtifact?.pointsUsed || 0,
        resetCount: charArtifact?.resetCount || 0,
        perkHashes: Array.from(new Set(artifactPerkHashes)),
      },
    };
  });
  const artifactPerkHashes=Array.from(new Set(charList.flatMap(c=>c.artifact?.perkHashes||[])));
  const mappedProfileItems=vaultItems.map(i=>mapItem(i,"profile",null));
  const profilePostmaster=mappedProfileItems.filter(i=>Number(i.location)===4 || Number(i.bucketHash)===215593132);
  const profileVault=mappedProfileItems.filter(i=>Number(i.location)!==4 && Number(i.bucketHash)!==215593132);
  // DIM assigns profile-scoped transferable buckets to the current character.
  // Bungie occasionally returns Lost Items through ProfileInventory, so attach
  // those to the most recently played Guardian instead of hiding them in Vault.
  if(profilePostmaster.length && charList.length){
    const current=[...charList].sort((a,b)=>(Date.parse(b.dateLastPlayed||0)||0)-(Date.parse(a.dateLastPlayed||0)||0))[0];
    current.postmaster=dedupeInventoryItems([...(current.postmaster||[]),...profilePostmaster.map(i=>({...i,source:"postmaster",characterId:current.charId}))]);
  }
  return {
    characters: charList,
    // ProfileInventory is account-wide. The UI keeps it outside all Guardian
    // stores, matching DIM's core rule that it must never inflate character slot counts.
    profileInventory: profileVault,
    vault: profileVault, // compatibility alias
    currencies: currencies.map(c=>({hash:c.itemHash, quantity:Number(c.quantity||0)})),
    artifactHash: profileArtifact?.artifactHash || null,
    artifactPerkHashes,
    artifactPowerBonus: profileArtifact?.powerBonus || 0,
    responseMintedTimestamp: profile.responseMintedTimestamp || null,
  };
}

// Pulls an item out of the owning character's Postmaster. Postmaster items
// are not ordinary character inventory and cannot be moved with TransferItem.
async function pullFromPostmaster({itemHash, instanceId, quantity=1, membershipType, characterId}){
  const auth = await getValidAccessToken();
  if(!auth) throw new Error("Not signed in.");
  const res = await rateLimitedFetch(`${BUNGIE_BASE}/Destiny2/Actions/Items/PullFromPostmaster/`, {
    method: "POST",
    headers: {
      "X-API-Key": BUNGIE_API_KEY,
      "Authorization": "Bearer " + auth.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      itemReferenceHash: itemHash,
      stackSize: Math.max(1, Number(quantity||1)),
      itemId: instanceId || "0",
      characterId,
      membershipType,
    }),
  });
  const json = await res.json();
  return handleBungieJson(json);
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
  // 254 is the Bungie.net identity, not a playable Destiny platform profile.
  // Prefer the cross-save/primary profile exactly as DIM does conceptually;
  // falling back to an arbitrary membership can display an old dormant roster.
  const memberships = (data.destinyMemberships || []).filter(m=>Number(m.membershipType)!==254);
  if(!memberships.length) throw new Error("No playable Destiny 2 membership is linked to this Bungie account.");
  const primaryId = String(data.primaryMembershipId || '');
  const primary = memberships.find(m=>String(m.membershipId)===primaryId)
    || memberships.find(m=>Number(m.crossSaveOverride)>0 && Number(m.crossSaveOverride)===Number(m.membershipType))
    || memberships.find(m=>Number(m.crossSaveOverride)===Number(m.membershipType))
    || memberships[0];
  return {
    membershipType: Number(primary.membershipType),
    membershipId: String(primary.membershipId),
    displayName: primary.bungieGlobalDisplayName || primary.displayName,
    allMemberships: memberships,
  };
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

