/* Manifest-driven live character and equipped-loadout synchronization.
   The Bungie response is normalized first; curated synergy tables are only
   used afterward for optional effect matching. Exact live names/hashes remain
   available even when the local data library does not contain an entry. */
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

async function loadLiveCharacters(options={}){
  if(!options || options instanceof Event) options={};
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
    liveSyncState.loading = false;
    const ordered=[...full.characters].sort((a,b)=>(Date.parse(b.dateLastPlayed||0)||0)-(Date.parse(a.dateLastPlayed||0)||0));
    const target=full.characters.find(c=>c.charId===state.selectedCharId)||ordered[0]||null;
    if(options.autoSelect && target){ state.selectedCharId=target.charId; await applyLiveLoadout(target); }
    render();
    fsToast(options.autoSelect ? 'Characters and equipped live build loaded.' : 'Characters loaded — pick one to sync its exact equipped build.', 'ok');
  } catch(err){
    liveSyncState.loading = false; render();
    fsToast('Could not load characters: ' + err.message, 'err');
  }
}

async function selectLiveCharacter(charId){
  state.selectedCharId = charId;
  const char = (liveSyncState.characters||[]).find(c=>c.charId===charId);
  if(!char){ render(); return; }
  fsToast('Reading equipped item instances and subclass sockets...');
  try {
    await applyLiveLoadout(char);
    render();
    fsToast('Exact equipped build synced. Unmodeled live entries are shown as live manifest data.', 'ok');
  } catch(err){
    console.error('Live loadout sync failed', err);
    render();
    fsToast('Live sync partial/failed: ' + err.message, 'err');
  }
}

function normalizeLiveName(value){
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '').replace(/[–—]/g, '-')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}
function liveNameMatches(appName, manifestName){
  const a = normalizeLiveName(appName), b = normalizeLiveName(manifestName);
  return !!a && !!b && (a===b || a.startsWith(b+' ') || b.startsWith(a+' '));
}
function uniqueByHash(items){
  const seen = new Set();
  return items.filter(x=>x && x.hash && !seen.has(x.hash) && seen.add(x.hash));
}

async function resolvePlugDefinitions(item){
  const hashes = uniqueByHash((item.socketedPlugHashes||[]).map(hash=>({hash}))).map(x=>x.hash);
  const defs = [];
  await Promise.all(hashes.map(async hash=>{
    try { defs.push(await getItemDefinition(hash)); } catch(e){ console.warn('Could not resolve plug', hash, e); }
  }));
  return defs;
}

function classifySubclassPlug(def){
  const type = normalizeLiveName(def.typeName);
  const cat = normalizeLiveName(def.plugCategoryIdentifier);
  const traits = (def.traitIds||[]).map(normalizeLiveName).join(' ');
  const text = `${type} ${cat} ${traits}`;
  if(/super ability|\.super\b|\bsuper\b/.test(text)) return 'super';
  if(/class ability|class abilities|class ability/.test(text)) return 'classAbility';
  if(/grenade ability|\.grenade\b|\bgrenade\b/.test(text)) return 'grenade';
  if(/melee ability|\.melee\b|\bmelee\b/.test(text)) return 'melee';
  if(/aspect/.test(text)) return 'aspect';
  if(/fragment|facet|ember|echo|spark|whisper|thread/.test(text)) return 'fragment';
  return 'other';
}

function inferSubclassElement(subItem, plugDefs){
  const itemName = subItem?._def?.name || '';
  for(const [subclassName, element] of Object.entries(SUBCLASS_NAME_ELEMENT)){
    if(normalizeLiveName(itemName).includes(normalizeLiveName(subclassName))) return element;
  }
  const damageElement = DAMAGE_TYPE_TO_ELEMENT[subItem?._def?.damageType];
  if(damageElement && damageElement !== 'Kinetic') return damageElement;
  const names = plugDefs.map(d=>d.name);
  let best = null;
  for(const element of ELEMENTS){
    const sc = SUBCLASSES[state.cls]?.[element]; if(!sc) continue;
    const grenadePool = element==='Prismatic' ? ['Arc','Solar','Void','Stasis','Strand'].flatMap(e=>GRENADES[e]||[]) : (GRENADES[element]||[]);
    const meleePool = element==='Prismatic' ? ['Arc','Solar','Void','Stasis','Strand'].flatMap(e=>MELEES[state.cls]?.[e]||[]) : (MELEES[state.cls]?.[element]||[]);
    const candidates = [...(sc.supers||[]),...(sc.aspects||[]),...(FRAGMENTS[element]||[]),...grenadePool,...meleePool];
    const score = names.reduce((n,pn)=>n+(candidates.some(x=>liveNameMatches(x.name,pn))?1:0),0);
    if(!best || score>best.score) best={element,score};
  }
  return best?.score ? best.element : null;
}

function mapSubclassToBuilder(liveSubclass){
  const elem = liveSubclass.element;
  const sc = SUBCLASSES[state.cls]?.[elem];
  if(!elem || !sc) return;
  state.element = elem;
  state.super = liveSubclass.super?.name || defaultSuperFor(state.cls, elem);
  state.classAbility = liveSubclass.classAbility?.name || null;
  state.grenade = liveSubclass.grenade?.name || null;
  state.melee = liveSubclass.melee?.name || null;
  state.aspects = liveSubclass.aspects.map(x=>x.name);
  state.fragments = liveSubclass.fragments.map(x=>x.name);
}

async function hydrateEquippedRealItem(item){
  const def = item._def || await getItemDefinition(item.hash); item._def = def;
  const plugDefs = await resolvePlugDefinitions(item);
  return {
    ...item, name:def.name, icon:def.icon,
    element:DAMAGE_TYPE_TO_ELEMENT[def.damageType]||'Kinetic',
    typeName:def.typeName, isExotic:def.tierType===6,
    plugDefinitions:plugDefs,
    socketedPlugNames:plugDefs.map(d=>d.name).filter(Boolean),
  };
}

function clearCharacterSpecificState(){
  state.aspects=[]; state.fragments=[]; state.grenade=null; state.melee=null; state.classAbility=null;
  state.liveSubclass=null; state.liveExoticWeapon=null; state.liveExoticArmor=null; state.liveArtifact=null;
  state.activeExoticWeapon=null; state.exoticArmor=null;
  state.legendary={Kinetic:null,Energy:null,Power:null};
  state.legendaryMode={Kinetic:'generic',Energy:'generic',Power:'generic'};
  state.legendaryRealItem={Kinetic:null,Energy:null,Power:null};
  state.armorMode={Helmet:'generic',Arms:'generic',Chest:'generic',Legs:'generic',ClassItem:'generic'};
  state.armorRealItem={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.mods={Helmet:[],Arms:[],Chest:[],Legs:[],ClassItem:[]};
  state.tuning={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.armorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.liveArmorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.artifact=null; state.artifactPerks=[]; state.artifactMode='generic'; state.armorSetMode='generic';
}

function detectArmorSet(slot, realItem){
  const names = [realItem.name, ...(realItem.socketedPlugNames||[])];
  const known = ARMOR_SETS.find(set=>names.some(n=>
    liveNameMatches(set.name,n) || liveNameMatches(set.twoPiece?.name,n) || liveNameMatches(set.fourPiece?.name,n)
  ));
  if(known){
    state.armorSetByPiece[slot]=known.name;
    state.liveArmorSetByPiece[slot]={name:known.name, sourceNames:names};
    state.armorSetMode='real';
    return;
  }
  const likelyBonus = (realItem.plugDefinitions||[]).find(d=>{
    const t=normalizeLiveName(`${d.typeName} ${d.plugCategoryIdentifier} ${(d.traitIds||[]).join(' ')}`);
    return /armor set|set bonus|intrinsic/.test(t) && d.name && !/empty|deprecated/.test(normalizeLiveName(d.name));
  });
  if(likelyBonus) state.liveArmorSetByPiece[slot]={name:likelyBonus.name, sourceNames:names};
}

async function syncArtifactFromProfile(){
  const hashes = liveSyncState.full?.artifactPerkHashes || [];
  const perks=[];
  await Promise.all(hashes.map(async hash=>{ try{ perks.push(await getItemDefinition(hash)); }catch(e){} }));
  const names=perks.map(p=>p.name).filter(Boolean);
  let best=null,bestScore=0;
  ARTIFACTS.forEach(a=>{
    const pool=[...a.column1,...a.column2,...a.column3];
    const score=names.filter(n=>pool.some(p=>liveNameMatches(p,n))).length;
    if(score>bestScore){best=a;bestScore=score;}
  });
  state.artifactMode='real';
  state.artifact=best?.name || (names.length?'Live Seasonal Artifact':null);
  state.artifactPerks=names;
  state.liveArtifact={name:state.artifact,perkHashes:hashes,perks:names,powerBonus:liveSyncState.full?.artifactPowerBonus||0,matchedCuratedArtifact:best?.name||null};
}

async function applyLiveLoadout(char){
  state.cls = CLASS_TYPE_NAMES[char.classType] || state.cls;
  clearCharacterSpecificState();
  await Promise.all(char.equipped.map(async it=>{ if(!it._def){ try{it._def=await getItemDefinition(it.hash);}catch(e){it._def=null;} } }));

  const subItem=char.equipped.find(it=>it._def?.bucketHash===SUBCLASS_BUCKET);
  if(subItem?._def){
    const plugDefs=await resolvePlugDefinitions(subItem);
    const grouped={super:[],classAbility:[],grenade:[],melee:[],aspect:[],fragment:[],other:[]};
    plugDefs.forEach(def=>grouped[classifySubclassPlug(def)].push(def));
    const element=inferSubclassElement(subItem,plugDefs) || state.element;
    state.liveSubclass={
      itemHash:subItem.hash,instanceId:subItem.instanceId,name:subItem._def.name,element,
      super:grouped.super[0]||null,classAbility:grouped.classAbility[0]||null,
      grenade:grouped.grenade[0]||null,melee:grouped.melee[0]||null,
      aspects:grouped.aspect,fragments:grouped.fragment,otherPlugs:grouped.other,
      allPlugs:plugDefs,
    };
    mapSubclassToBuilder(state.liveSubclass);
  }

  for(const item of char.equipped){
    if(!item._def) continue;
    const weaponSlot=WEAPON_BUCKET_TO_SLOT[item._def.bucketHash];
    if(!weaponSlot) continue;
    const realItem=await hydrateEquippedRealItem(item);
    await selectRealWeapon(weaponSlot,realItem);
    if(realItem.isExotic){
      state.liveExoticWeapon=realItem;
      const match=EXOTIC_WEAPONS.find(w=>liveNameMatches(w.name,realItem.name));
      state.activeExoticWeapon=match?.name||null;
    }
  }

  for(const item of char.equipped){
    if(!item._def) continue;
    const armorSlot=ARMOR_BUCKET_TO_SLOT[item._def.bucketHash];
    if(!armorSlot) continue;
    const realItem=await hydrateEquippedRealItem(item);
    await selectRealArmor(armorSlot,realItem);
    detectArmorSet(armorSlot,realItem);
    if(realItem.isExotic){
      state.liveExoticArmor=realItem;
      const match=(EXOTIC_ARMOR[state.cls]||[]).find(a=>liveNameMatches(a.name,realItem.name));
      state.exoticArmor=match?.name||null;
      if(match) state.armorFilter='all';
    }
  }

  await syncArtifactFromProfile();
  window.__d2synergyLastLiveBuild={characterId:char.charId,classType:char.classType,stateSnapshot:JSON.parse(JSON.stringify({
    cls:state.cls,element:state.element,super:state.super,classAbility:state.classAbility,grenade:state.grenade,melee:state.melee,
    aspects:state.aspects,fragments:state.fragments,liveSubclass:state.liveSubclass,
    weapons:state.legendaryRealItem,armor:state.armorRealItem,liveExoticWeapon:state.liveExoticWeapon,
    liveExoticArmor:state.liveExoticArmor,armorSets:state.liveArmorSetByPiece,artifact:state.liveArtifact,
  }))};
}
