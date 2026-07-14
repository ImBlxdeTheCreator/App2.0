/* Live character selection and equipped-loadout synchronization
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 6 — LIVE CHARACTER + LIVE-EQUIPPED SYNC
   Loads the signed-in account's characters and, when one is selected,
   auto-populates the builder from what's actually equipped. Edits stay
   staged locally — nothing is written until Finalize Loadout.
   NOTE: authenticated calls only succeed on the deployed GitHub Pages
   domain (Bungie's registered origin), not the Emergent preview.
   ========================================================================= */
const liveSyncState = { characters:null, membershipType:null, membershipId:null, loading:false, full:null };
const SUBCLASS_BUCKET = 3284755031;
const ARMOR_BUCKET_TO_SLOT = {3448274439:"Helmet",3551918588:"Arms",14239492:"Chest",20886954:"Legs",1585787867:"ClassItem"};
const WEAPON_BUCKET_TO_SLOT = {1498876634:"Kinetic",2465295065:"Energy",953998645:"Power"};
const SUBCLASS_NAME_ELEMENT = {
  Sunbreaker:"Solar",Striker:"Arc",Sentinel:"Void",Behemoth:"Stasis",Berserker:"Strand",
  Gunslinger:"Solar",Arcstrider:"Arc",Nightstalker:"Void",Revenant:"Stasis",Threadrunner:"Strand",
  Dawnblade:"Solar",Stormcaller:"Arc",Voidwalker:"Void",Shadebinder:"Stasis",Broodweaver:"Strand",
  Prismatic:"Prismatic",
};

async function loadLiveCharacters(){
  const auth = await getValidAccessToken();
  if(!auth){ fsToast('Sign in first (only works on the deployed site).', 'err'); return; }
  liveSyncState.loading = true; render();
  try {
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    liveSyncState.membershipType = membership.membershipType;
    liveSyncState.membershipId = membership.membershipId;
    const full = await getFullInventory(membership.membershipType, membership.membershipId);
    liveSyncState.full = full;
    liveSyncState.characters = full.characters;
    await Promise.all(full.characters.flatMap(c=>c.equipped).map(async it=>{
      try { it._def = await getItemDefinition(it.hash); } catch(e){ it._def = null; }
    }));
    liveSyncState.loading = false; render();
    fsToast('Characters loaded — pick one to sync its equipped loadout.', 'ok');
  } catch(err){
    liveSyncState.loading = false; render();
    fsToast('Could not load characters: ' + err.message, 'err');
  }
}

async function selectLiveCharacter(charId){
  state.selectedCharId = charId;
  const char = (liveSyncState.characters||[]).find(c=>c.charId===charId);
  if(!char){ render(); return; }
  fsToast('Syncing equipped loadout...');
  try { await applyLiveLoadout(char); render(); fsToast('Builder populated from your equipped loadout. Edits are staged only.', 'ok'); }
  catch(err){ render(); fsToast('Live sync partial/failed: ' + err.message, 'err'); }
}

async function resolvePlugNames(item){
  const names = [];
  for(const h of (item.socketedPlugHashes||[])){
    try { const d = await getItemDefinition(h); if(d.name && d.name!=="Unknown Item") names.push(d.name); } catch(e){}
  }
  return names;
}

async function applyLiveLoadout(char){
  state.cls = CLASS_TYPE_NAMES[char.classType] || state.cls;
  await Promise.all(char.equipped.map(async it=>{ if(!it._def){ try{ it._def = await getItemDefinition(it.hash); }catch(e){} } }));
  const subItem = char.equipped.find(it=>it._def && it._def.bucketHash===SUBCLASS_BUCKET);
  if(subItem && subItem._def){
    const nm = subItem._def.name || '';
    let elem = null;
    Object.keys(SUBCLASS_NAME_ELEMENT).forEach(k=>{ if(nm.toLowerCase().includes(k.toLowerCase())) elem = SUBCLASS_NAME_ELEMENT[k]; });
    if(elem){
      state.element = elem;
      state.aspects=[]; state.fragments=[]; state.super=defaultSuperFor(state.cls,elem); state.grenade=null; state.melee=null;
      const sc = SUBCLASSES[state.cls][elem];
      const plugNames = await resolvePlugNames(subItem);
      const grenadePool = elem==="Prismatic" ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>GRENADES[e]) : (GRENADES[elem]||[]);
      const meleePool = elem==="Prismatic" ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>MELEES[state.cls][e]) : (MELEES[state.cls][elem]||[]);
      const fragPool = FRAGMENTS[elem]||[];
      plugNames.forEach(pn=>{
        const superMatch = (sc.supers||[]).find(s=>s.name===pn || s.name.replace(/ \(.*\)$/,'')===pn);
        if(superMatch){ state.super = superMatch.name; return; }
        const aspMatch = sc.aspects.find(a=>a.name===pn || a.name.replace(/ \(.*\)$/,'')===pn);
        if(aspMatch){ if(state.aspects.length<2 && !state.aspects.includes(aspMatch.name)) state.aspects.push(aspMatch.name); return; }
        const fragMatch = fragPool.find(f=>f.name===pn);
        if(fragMatch){ if(!state.fragments.includes(fragMatch.name)) state.fragments.push(fragMatch.name); return; }
        const gMatch = grenadePool.find(g=>g.name===pn);
        if(gMatch){ state.grenade = gMatch.name; return; }
        const mMatch = meleePool.find(m=>m.name===pn);
        if(mMatch){ state.melee = mMatch.name; return; }
      });
    }
  }
  state.activeExoticWeapon = null;
  char.equipped.forEach(it=>{
    if(!it._def) return;
    const wslot = WEAPON_BUCKET_TO_SLOT[it._def.bucketHash];
    if(wslot && it._def.tierType===6){
      const match = EXOTIC_WEAPONS.find(w=>w.name===it._def.name);
      if(match) state.activeExoticWeapon = match.name;
    }
  });
  state.exoticArmor = null;
  for(const it of char.equipped){
    if(!it._def) continue;
    const aslot = ARMOR_BUCKET_TO_SLOT[it._def.bucketHash];
    if(!aslot) continue;
    if(it._def.tierType===6){
      const match = (EXOTIC_ARMOR[state.cls]||[]).find(a=>a.name===it._def.name);
      if(match){ state.exoticArmor = match.name; state.armorFilter = "all"; }
    }
    const plugNames = await resolvePlugNames(it);
    const slotMods = [];
    plugNames.forEach(pn=>{ const m = (ARMOR_MODS_BY_SLOT[aslot]||[]).find(x=>x.name===pn); if(m && slotMods.length<4) slotMods.push(m.name); });
    if(slotMods.length) state.mods[aslot] = slotMods;
  }
}

