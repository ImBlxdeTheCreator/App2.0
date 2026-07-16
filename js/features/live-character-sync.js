/* Exact-equipped, manifest-driven synchronization.
   No owned-item ranking is used here. Every weapon/armor/exotic comes only
   from CharacterEquipment (component 205) for the selected character. */
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
  if(window.D2Loader){D2Loader.show('Loading Guardians','Resolving your Destiny membership…');D2Loader.progress(0.08);}
  try {
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    liveSyncState.membershipType = membership.membershipType;
    liveSyncState.membershipId = membership.membershipId;
    if(window.D2Loader){D2Loader.update('Loading Guardians','Fetching characters, equipment, inventory, currencies, and artifact data…');D2Loader.progress(0.28);}
    const full = await getFullInventory(membership.membershipType, membership.membershipId);
    liveSyncState.full = full;
    liveSyncState.characters = full.characters;
    if(window.D2Loader){D2Loader.update('Resolving Equipment','Loading exact equipped item definitions…');D2Loader.progress(0.55);}
    await hydrateCharacterEquipmentDefinitions(full.characters);
    liveSyncState.loading = false;
    const ordered=[...full.characters].sort((a,b)=>(Date.parse(b.dateLastPlayed||0)||0)-(Date.parse(a.dateLastPlayed||0)||0));
    const savedCharId=localStorage.getItem(`d2synergy:selected-character:${membership.membershipId}`);
    const target=full.characters.find(c=>String(c.charId)===String(state.selectedCharId))
      || full.characters.find(c=>String(c.charId)===String(savedCharId))
      || ordered[0] || null;
    if(options.autoSelect && target){
      state.selectedCharId=String(target.charId);
      localStorage.setItem(`d2synergy:selected-character:${membership.membershipId}`,String(target.charId));
      if(window.D2Loader){D2Loader.update('Applying Live Build','Reading subclass sockets, weapons, armor, sets, and artifact perks…');D2Loader.progress(0.78);}
      await applyLiveLoadout(target);
    }
    render();
    if(window.D2Loader)D2Loader.progress(1);
    fsToast(options.autoSelect ? 'Exact equipped character build loaded.' : 'Characters loaded — select one to sync its exact equipped build.', 'ok');
  } catch(err){
    liveSyncState.loading = false; render();
    fsToast('Could not load characters: ' + err.message, 'err');
  } finally {
    if(window.D2Loader)D2Loader.hide();
  }
}

async function hydrateCharacterEquipmentDefinitions(characters){
  await Promise.all((characters||[]).flatMap(c=>(c.equipped||[]).map(async item=>{
    try{ item._def=item._def||await getItemDefinition(item.hash); }
    catch(e){ item._def=null; }
  })));
}

async function selectLiveCharacter(charId){
  state.selectedCharId = String(charId);
  if(liveSyncState.membershipId) localStorage.setItem(`d2synergy:selected-character:${liveSyncState.membershipId}`,String(charId));
  const char = (liveSyncState.characters||[]).find(c=>String(c.charId)===String(charId));
  if(!char){ render(); return; }
  fsToast('Reading CharacterEquipment and equipped socket plugs...');
  if(window.D2Loader){D2Loader.show('Syncing Guardian','Reading exact equipped gear and subclass sockets…');D2Loader.progress(0.2);}
  try {
    await applyLiveLoadout(char);
    if(window.D2Loader)D2Loader.progress(1);
    render();
    fsToast(`Exact equipped ${CLASS_TYPE_NAMES[char.classType]||'Guardian'} build synced.`, 'ok');
  } catch(err){
    console.error('Live loadout sync failed', err);
    render(); fsToast('Live sync failed: ' + err.message, 'err');
  } finally {
    if(window.D2Loader)D2Loader.hide();
  }
}

function normalizeLiveName(value){
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '').replace(/[–—]/g, '-')
    .replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}
function liveNameMatches(appName, manifestName){
  const a=normalizeLiveName(appName), b=normalizeLiveName(manifestName);
  return !!a && !!b && (a===b || a.startsWith(b+' ') || b.startsWith(a+' '));
}

async function resolveSocketDescriptors(item){
  const itemDef=item._def||await getItemDefinition(item.hash); item._def=itemDef;
  const categoryByIndex={};
  await Promise.all((itemDef.socketCategories||[]).map(async cat=>{
    let categoryDef=null; try{categoryDef=await getSocketCategoryDefinition(cat.socketCategoryHash);}catch(e){}
    (cat.socketIndexes||[]).forEach(index=>{categoryByIndex[index]=categoryDef||{hash:cat.socketCategoryHash,name:'',description:''};});
  }));
  return Promise.all((item.sockets||[]).map(async socket=>{
    const entry=itemDef.socketEntries?.[socket.index]||null;
    let plugDef=null, socketTypeDef=null;
    try{ if(socket.plugHash) plugDef=await getItemDefinition(socket.plugHash); }catch(e){}
    try{ if(entry?.socketTypeHash) socketTypeDef=await getSocketTypeDefinition(entry.socketTypeHash); }catch(e){}
    return {index:socket.index,plugHash:socket.plugHash,plugDef,socketTypeDef,categoryDef:categoryByIndex[socket.index]||null,isEnabled:socket.isEnabled,isVisible:socket.isVisible};
  }));
}

function classifySubclassSocket(desc){
  const p=desc.plugDef||{};
  const plugId=String(p.plugCategoryIdentifier||'').toLowerCase();
  const plugText=normalizeLiveName([
    p.typeName,p.plugCategoryIdentifier,(p.traitIds||[]).join(' '),p.name,p.description,
  ].filter(Boolean).join(' '));
  const socketText=normalizeLiveName([
    desc.categoryDef?.name,desc.categoryDef?.description,
    desc.socketTypeDef?.name,desc.socketTypeDef?.description,
  ].filter(Boolean).join(' '));

  // Plug identity is more precise than a shared category such as
  // "Aspects and Fragments". Check fragments first so Facets/Embers/Echoes
  // cannot be misclassified as aspects by the surrounding socket category.
  if(/fragment|facet|ember|echo|spark|whisper|thread/.test(plugText)||plugId.includes('fragment')) return 'fragment';
  if(/aspect/.test(plugText)||plugId.includes('aspect')) return 'aspect';
  const text=`${plugText} ${socketText}`;
  if(/class ability|class abilities/.test(text)||plugId.includes('class_ability')) return 'classAbility';
  if(/grenade ability|\bgrenade\b/.test(text)||plugId.includes('grenade')) return 'grenade';
  if(/melee ability|\bmelee\b/.test(text)||plugId.includes('melee')) return 'melee';
  if(/super ability|\bsuper\b/.test(text)||plugId.includes('super')) return 'super';
  if(/aspect/.test(socketText)) return 'aspect';
  if(/fragment/.test(socketText)) return 'fragment';
  return 'other';
}

function inferSubclassElement(subItem, descriptors){
  const itemName=subItem?._def?.name||'';
  for(const [name,element] of Object.entries(SUBCLASS_NAME_ELEMENT)) if(normalizeLiveName(itemName).includes(normalizeLiveName(name))) return element;
  const damageElement=DAMAGE_TYPE_TO_ELEMENT[subItem?._def?.damageType];
  if(damageElement&&damageElement!=='Kinetic') return damageElement;
  const names=descriptors.map(d=>d.plugDef?.name).filter(Boolean);
  let best=null;
  for(const element of ELEMENTS){
    const sc=SUBCLASSES[state.cls]?.[element]; if(!sc) continue;
    const grenades=element==='Prismatic'?['Arc','Solar','Void','Stasis','Strand'].flatMap(e=>GRENADES[e]||[]):(GRENADES[element]||[]);
    const melees=element==='Prismatic'?['Arc','Solar','Void','Stasis','Strand'].flatMap(e=>MELEES[state.cls]?.[e]||[]):(MELEES[state.cls]?.[element]||[]);
    const candidates=[...(sc.supers||[]),...(sc.aspects||[]),...(FRAGMENTS[element]||[]),...grenades,...melees];
    const score=names.reduce((n,name)=>n+(candidates.some(x=>liveNameMatches(x.name,name))?1:0),0);
    if(!best||score>best.score) best={element,score};
  }
  return best?.score?best.element:null;
}

function mapSubclassToBuilder(live){
  const elem=live.element, sc=SUBCLASSES[state.cls]?.[elem];
  if(!elem||!sc) return;
  state.element=elem;
  state.super=live.super?.name||null;
  state.classAbility=live.classAbility?.name||null;
  state.grenade=live.grenade?.name||null;
  state.melee=live.melee?.name||null;
  state.aspects=live.aspects.map(x=>x.name).filter(Boolean);
  state.fragments=live.fragments.map(x=>x.name).filter(Boolean);
}

async function hydrateEquippedRealItem(item){
  const def=item._def||await getItemDefinition(item.hash); item._def=def;
  const descriptors=await resolveSocketDescriptors(item);
  const plugDefs=descriptors.map(d=>d.plugDef).filter(Boolean);
  return {...item,name:def.name,icon:def.icon,element:DAMAGE_TYPE_TO_ELEMENT[def.damageType]||'Kinetic',typeName:def.typeName,isExotic:def.tierType===6,
    plugDefinitions:plugDefs,socketDescriptors:descriptors,socketedPlugNames:plugDefs.map(d=>d.name).filter(Boolean)};
}

function clearCharacterSpecificState(){
  state.aspects=[]; state.fragments=[]; state.grenade=null; state.melee=null; state.classAbility=null;
  state.liveSubclass=null; state.liveExoticWeapon=null; state.liveExoticArmor=null; state.liveArtifact=null;
  state.activeExoticWeapon=null; state.exoticArmor=null;
  state.legendary={Kinetic:null,Energy:null,Power:null}; state.legendaryMode={Kinetic:'generic',Energy:'generic',Power:'generic'};
  state.legendaryRealItem={Kinetic:null,Energy:null,Power:null};
  state.armorMode={Helmet:'generic',Arms:'generic',Chest:'generic',Legs:'generic',ClassItem:'generic'};
  state.armorRealItem={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.mods={Helmet:[],Arms:[],Chest:[],Legs:[],ClassItem:[]}; state.tuning={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.armorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.liveArmorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.artifact=null; state.artifactPerks=[]; state.artifactMode='generic'; state.armorSetMode='generic';
}

function detectArmorSet(slot,realItem){
  const names=[realItem.name,...(realItem.socketedPlugNames||[])];
  const known=ARMOR_SETS.find(set=>names.some(n=>liveNameMatches(set.name,n)||liveNameMatches(set.twoPiece?.name,n)||liveNameMatches(set.fourPiece?.name,n)));
  if(known){state.armorSetByPiece[slot]=known.name;state.liveArmorSetByPiece[slot]={name:known.name,sourceNames:names};state.armorSetMode='real';return;}
  const setPlug=(realItem.plugDefinitions||[]).find(d=>{
    const id=String(d.plugCategoryIdentifier||'').toLowerCase();
    const text=normalizeLiveName(`${d.typeName} ${id} ${(d.traitIds||[]).join(' ')} ${d.description||''}`);
    return (id.includes('set_bonus')||id.includes('setbonus')||/armor set|set bonus/.test(text))&&d.name&&!/empty|deprecated/.test(normalizeLiveName(d.name));
  });
  if(setPlug){state.liveArmorSetByPiece[slot]={name:setPlug.name,hash:setPlug.hash,sourceNames:names};state.armorSetMode='real';}
}

function isArtifactDefinition(def){
  const text=normalizeLiveName(`${def?.typeName||''} ${def?.name||''} ${(def?.traitIds||[]).join(' ')}`);
  return /\bartifact\b/.test(text);
}

async function syncArtifact(char){
  const liveArtifact=char?.artifact || {};
  const artifactHash=liveArtifact.artifactHash || liveSyncState.full?.artifactHash || null;
  let artifactDef=null;
  if(artifactHash){
    try { artifactDef=await getArtifactDefinition(artifactHash); }
    catch(e){ console.warn('[D2Synergy] artifact definition lookup failed',artifactHash,e); }
  }

  const perkHashes=Array.from(new Set(
    (liveArtifact.perkHashes?.length ? liveArtifact.perkHashes : (liveSyncState.full?.artifactPerkHashes||[]))
      .map(Number).filter(Boolean)
  ));
  const perkDefs=[];
  await Promise.all(perkHashes.map(async hash=>{
    try { perkDefs.push(await getItemDefinition(hash)); }
    catch(e){ console.warn('[D2Synergy] artifact perk lookup failed',hash,e); }
  }));
  perkDefs.sort((a,b)=>perkHashes.indexOf(a.hash)-perkHashes.indexOf(b.hash));
  const names=perkDefs.map(p=>p.name).filter(Boolean);

  // Curated matching is only used for synergy metadata. The displayed artifact
  // and active unlocks always come from the exact Bungie hashes above.
  let best=null,bestScore=0;
  ARTIFACTS.forEach(a=>{
    const pool=[...a.column1,...a.column2,...a.column3];
    const score=names.filter(n=>pool.some(p=>liveNameMatches(p,n))).length;
    if(score>bestScore){best=a;bestScore=score;}
  });
  const exactName=artifactDef?.name || best?.name || (artifactHash ? `Artifact ${artifactHash}` : null);
  state.artifactMode='real';
  state.artifact=exactName;
  state.artifactPerks=names;
  state.liveArtifact={
    name:exactName,
    artifactHash,
    icon:artifactDef?.icon||null,
    description:artifactDef?.description||'',
    perks:perkDefs,
    perkHashes,
    pointsUsed:Number(liveArtifact.pointsUsed||0),
    resetCount:Number(liveArtifact.resetCount||0),
    powerBonus:liveSyncState.full?.artifactPowerBonus||0,
    matchedCuratedArtifact:best?.name||null,
  };
}

async function applyLiveLoadout(char){
  state.cls=CLASS_TYPE_NAMES[char.classType]||state.cls; clearCharacterSpecificState();
  state.liveCharacterStats={...(char.stats||{})};
  await hydrateCharacterEquipmentDefinitions([char]);
  const equipped=(char.equipped||[]);
  const subItem=equipped.find(it=>Number(it.bucketHash||it._def?.bucketHash)===SUBCLASS_BUCKET);
  if(subItem?._def){
    const descriptors=await resolveSocketDescriptors(subItem);
    const grouped={super:[],classAbility:[],grenade:[],melee:[],aspect:[],fragment:[],other:[]};
    descriptors.forEach(desc=>{if(desc.plugDef) grouped[classifySubclassSocket(desc)].push(desc.plugDef);});
    const element=inferSubclassElement(subItem,descriptors)||state.element;
    state.liveSubclass={itemHash:subItem.hash,instanceId:subItem.instanceId,name:subItem._def.name,icon:subItem._def.icon,element,
      super:grouped.super[0]||null,classAbility:grouped.classAbility[0]||null,grenade:grouped.grenade[0]||null,melee:grouped.melee[0]||null,
      aspects:grouped.aspect,fragments:grouped.fragment,otherPlugs:grouped.other,allPlugs:descriptors.map(d=>d.plugDef).filter(Boolean),socketDescriptors:descriptors};
    mapSubclassToBuilder(state.liveSubclass);
  }

  for(const item of equipped){
    const slot=WEAPON_BUCKET_TO_SLOT[Number(item.bucketHash||item._def?.bucketHash)]; if(!slot) continue;
    const real=await hydrateEquippedRealItem(item); await selectRealWeapon(slot,real);
    if(real.isExotic){state.liveExoticWeapon=real;const match=EXOTIC_WEAPONS.find(w=>liveNameMatches(w.name,real.name));state.activeExoticWeapon=match?.name||null;}
  }
  for(const item of equipped){
    const slot=ARMOR_BUCKET_TO_SLOT[Number(item.bucketHash||item._def?.bucketHash)]; if(!slot) continue;
    const real=await hydrateEquippedRealItem(item); await selectRealArmor(slot,real); detectArmorSet(slot,real);
    if(real.isExotic){state.liveExoticArmor=real;const match=(EXOTIC_ARMOR[state.cls]||[]).find(a=>liveNameMatches(a.name,real.name));state.exoticArmor=match?.name||null;if(match)state.armorFilter='all';}
  }
  await syncArtifact(char);

  const exactSummary={
    characterId:String(char.charId),className:state.cls,
    subclass:state.liveSubclass?.name||null,super:state.liveSubclass?.super?.name||null,classAbility:state.liveSubclass?.classAbility?.name||null,
    melee:state.liveSubclass?.melee?.name||null,grenade:state.liveSubclass?.grenade?.name||null,
    aspects:(state.liveSubclass?.aspects||[]).map(x=>x.name),fragments:(state.liveSubclass?.fragments||[]).map(x=>x.name),
    weapons:Object.fromEntries(Object.entries(state.legendaryRealItem).map(([k,v])=>[k,v?.name||null])),
    armor:Object.fromEntries(Object.entries(state.armorRealItem).map(([k,v])=>[k,v?.name||null])),
    exoticWeapon:state.liveExoticWeapon?.name||null,exoticArmor:state.liveExoticArmor?.name||null,artifact:state.liveArtifact?.name||null,
  };
  window.__d2synergyLastLiveBuild=exactSummary;
  console.table({weapons:exactSummary.weapons,armor:exactSummary.armor});
  console.info('[D2Synergy] exact CharacterEquipment sync',exactSummary);
  return exactSummary;
}

/* Final binding intentionally lives in this file, which loads after bungie.js.
   This guarantees the header button cannot fall back to the legacy account-wide
   highest-power picker. One click loads characters and applies only the chosen
   character's CharacterEquipment component. */
async function syncMyLiveBuildExact(){
  const btn=document.getElementById('globalSyncBtn');
  if(!btn || liveSyncState.loading) return;
  const original=btn.textContent;
  btn.disabled=true; btn.textContent='Loading exact build…';
  try {
    await loadLiveCharacters({autoSelect:true});
    if(liveSyncState.full && typeof populateRealGearCacheFromFullInventory==='function'){
      await populateRealGearCacheFromFullInventory(liveSyncState.full);
    }
  } finally {
    btn.disabled=false; btn.textContent=original;
  }
}
const __exactSyncButton=document.getElementById('globalSyncBtn');
if(__exactSyncButton) __exactSyncButton.onclick=syncMyLiveBuildExact;
window.syncMyLiveBuildExact=syncMyLiveBuildExact;
