/* Full-screen vault, account inventory, currency, and transfer interface.
   Inventory grouping is driven by Bungie's live InventoryBucket definitions,
   so Ghosts, Sparrows, Ships, Emblems, consumables, shaders/modifications,
   Engrams, Postmaster items, and future buckets are not silently discarded. */
const FS_WEAPON_BUCKETS = [1498876634,2465295065,953998645];
const FS_DMG = {1:{n:"Kinetic",c:"var(--kinetic)"},2:{n:"Arc",c:"var(--arc)"},3:{n:"Solar",c:"var(--solar)"},4:{n:"Void",c:"var(--void)"},6:{n:"Stasis",c:"var(--stasis)"},7:{n:"Strand",c:"var(--strand)"}};
const FS_BUCKET_PRIORITY = new Map([
  [1498876634,10],[2465295065,20],[953998645,30],
  [3448274439,40],[3551918588,50],[14239492,60],[20886954,70],[1585787867,80],
  [4023194814,90],[2025709351,100],[284967655,110],[4274335291,120],
]);
const FS_EQUIPPABLE_BUCKETS = new Set([1498876634,2465295065,953998645,3448274439,3551918588,14239492,20886954,1585787867,4023194814,2025709351,284967655]);
const FS_BUCKET_CAPACITY_FALLBACK = Object.fromEntries([...FS_EQUIPPABLE_BUCKETS].map(hash=>[hash,10]));
const FS_POSTMASTER_BUCKET = 215593132;
const FS_QUEST_BUCKET = 1801258597;
const FS_CLAN_BANNER_BUCKET = 497170007;
const FS_DESTINATION_CURRENCY_BUCKETS = new Set([370330657,3703306570,3703306568,2207872501]);
const FS_HIDDEN_BUCKETS = new Set([1753109658,2422292810,3621873013,444348033,3284755031]);
const FS_POSTMASTER_CAPACITY_FALLBACK = 21;
const FS_BUCKET_FALLBACK_NAMES = {
  1498876634:'Kinetic Slot',2465295065:'Energy / Special Slot',953998645:'Power / Heavy Slot',3448274439:'Helmet',
  3551918588:'Arms',14239492:'Chest',20886954:'Legs',1585787867:'Class Item',
  4023194814:'Ghosts',2025709351:'Vehicles / Sparrows',284967655:'Ships',4274335291:'Emblems',
};

const fsState = {
  stores:null,currencies:null,bucketDefs:{},membershipType:null,membershipId:null,
  search:"",element:"all",type:"all",category:"all",openGroup:"weapons",loading:false,
};

const fsOverlay = document.getElementById('vaultFsOverlay');
function fsToast(msg, kind){
  const t = el('div','fsToast'+(kind?(' '+kind):''), msg);
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 2600);
}
function closeFsMenu(){ const m = document.getElementById('fsMenu'); if(m) m.remove(); }
function openFullScreenVault(){
  fsOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Vault is a primary destination. Each open starts at the top instead of
  // exposing the old intermediary workspace card or a stale scroll position.
  fsOverlay.scrollTop = 0;
  const body = document.getElementById('fsBody');
  if(body) body.scrollTop = 0;
  requestAnimationFrame(()=>{
    fsOverlay.scrollTop = 0;
    if(body) body.scrollTop = 0;
  });
  buildFsFilters();
  if(!fsState.stores && !fsState.loading) loadFullScreenVault();
  else renderFsBody();
}
function closeFullScreenVault(){
  fsOverlay.classList.remove('open');
  document.body.style.overflow = '';
  closeFsMenu();
  // Do not strand the user on the obsolete Inventory launcher panel.
  window.D2Workspaces?.activate?.('builder',{scroll:false});
  requestAnimationFrame(()=>window.scrollTo(0,0));
}
function buildFsFilters(){
  const elemHost=document.getElementById('fsElemChips');
  const typeHost=document.getElementById('fsTypeChips');
  elemHost.replaceChildren();typeHost.replaceChildren();
  elemHost.hidden=true;
  const groups=[
    ['weapons','Weapons',[['kinetic','Kinetic'],['solar','Solar'],['arc','Arc'],['void','Void'],['stasis','Stasis'],['strand','Strand'],['exotic-weapons','Exotic Weapons']]],
    ['armor','Armor',[['helmets','Helmets'],['gauntlets','Gauntlets'],['chests','Chests'],['legs','Legs'],['class-items','Class Items'],['exotic-armor','Exotic Armor']]],
    ['equipment','Equipment',[['destination-currency','Destination Currency'],['clan-banner','Clan Banner'],['general','General'],['cosmetics','Cosmetics']]],
  ];
  const nav=el('div','fsDropdownNav');
  groups.forEach(([id,label,items])=>{
    const group=el('section','fsDropdownGroup'+(fsState.openGroup===id?' open':''));
    const button=el('button','fsDropdownToggle',`${label} ${fsState.openGroup===id?'▾':'▸'}`);button.type='button';
    button.onclick=()=>{fsState.openGroup=fsState.openGroup===id?'':id;buildFsFilters();};group.appendChild(button);
    const list=el('div','fsDropdownList');
    items.forEach(([value,text])=>{const b=el('button','fsDropdownItem'+(fsState.category===value?' active':''),text);b.type='button';b.onclick=()=>{fsState.category=value;fsState.type=id==='weapons'?'weapons':id==='armor'?'armor':'all';renderFsBody();buildFsFilters();};list.appendChild(b);});
    group.appendChild(list);nav.appendChild(group);
  });
  const all=el('button','fsDropdownAll'+(fsState.category==='all'?' active':''),'All Vault Items');all.type='button';all.onclick=()=>{fsState.category='all';fsState.type='all';renderFsBody();buildFsFilters();};
  typeHost.append(all,nav);
}
function syncFsChips(){buildFsFilters();}
function fsBucketInfo(hash){
  const key=String(hash||'');
  return fsState.bucketDefs[key] || {
    hash:Number(hash||0),name:FS_BUCKET_FALLBACK_NAMES[Number(hash)]||'Miscellaneous',
    bucketOrder:999,scope:0,category:0,location:0,hasTransferDestination:false,
  };
}
// The live item component's bucketHash is its actual current container. The
// manifest definition only describes the item's default bucket, so it is a
// fallback—not the source of truth for character capacity/grouping.
function fsBucketHashForItem(it){ return Number(it?.bucketHash || it?._def?.bucketHash || 0); }
function fsBucketLabel(it){ const h=fsBucketHashForItem(it); if(FS_DESTINATION_CURRENCY_BUCKETS.has(h))return'Destination Currency'; if(h===FS_CLAN_BANNER_BUCKET)return'Clan Banner'; return fsBucketInfo(h).name || 'Miscellaneous'; }
function fsItemKind(it){
  const def=it?._def||{};
  if(def.itemType===3) return 'weapons';
  if(def.itemType===2) return 'armor';
  const text=`${fsBucketLabel(it)} ${def.typeName||''} ${def.name||''}`.toLowerCase();
  if(/ghost|vehicle|sparrow|ship|emblem|emote|finisher|shader|ornament/.test(text)) return 'equipment';
  if(!it.instanceId || Number(it.quantity||1)>1 || /consum|material|currency|modification|mod |engram|quest|bount|inventory|token|collectible/.test(text)) return 'inventory';
  return 'equipment';
}
function fsCanTransfer(it){ return !!(it?.instanceId && !it?.equipped && Number(it.transferStatus||0)===0); }
function fsCanDrag(it,store){
  if(store?.kind==='postmaster') return !!(it?.hash && Number(it.transferStatus||0)===0);
  return fsCanTransfer(it);
}
function fsItemIdentity(it){
  if(it?.instanceId) return `instance:${it.instanceId}`;
  return `stack:${it?.source||"unknown"}:${it?.characterId||it?.holderCharId||"profile"}:${it?.bucketHash||0}:${it?.hash||0}`;
}
function fsDedupeStoreItems(items){
  const byId=new Map();
  (items||[]).forEach(item=>{
    const key=fsItemIdentity(item);
    const existing=byId.get(key);
    // Equipped wins if an impossible duplicate is returned in both components.
    if(!existing || (item.equipped && !existing.equipped)) byId.set(key,item);
  });
  return [...byId.values()];
}
function fsBucketCapacity(hash,store){
  if(store?.kind!=="character") return null;
  const def=fsBucketInfo(hash);
  const manifestCapacity=Number(def?.itemCount||0);
  if(manifestCapacity>0) return manifestCapacity;
  return FS_BUCKET_CAPACITY_FALLBACK[Number(hash)] || null;
}
function fsAuditCharacterStore(store){
  if(store?.kind!=="character") return [];
  const counts={};
  store.items.forEach(item=>{const hash=fsBucketHashForItem(item);counts[hash]=(counts[hash]||0)+1;});
  return Object.entries(counts).map(([hash,count])=>({
    characterId:store.charId,
    bucketHash:Number(hash),
    bucketName:fsBucketInfo(hash).name,
    count,
    capacity:fsBucketCapacity(hash,store),
  })).filter(row=>row.capacity && row.count>row.capacity);
}

async function loadFullScreenVault(){
  const body = document.getElementById('fsBody');
  fsState.loading = true; body.innerHTML = '';
  window.D2Status?.refreshing('inventory','Refreshing Vault and characters');
  body.appendChild(el('div','fsState', 'Resolving your signed-in account...'));
  if(window.D2Loader){D2Loader.show('Loading Vault','Resolving your signed-in account…');D2Loader.progress(0.05);}
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error("Not signed in. Open the menu → Sign in with Bungie.net first. (Sign-in only works on the deployed GitHub Pages site.)");
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    fsState.membershipType = membership.membershipType; fsState.membershipId = membership.membershipId;
    body.innerHTML = ''; body.appendChild(el('div','fsState', 'Fetching characters, vault, and account inventory...'));
    if(window.D2Loader){D2Loader.update('Loading Vault','Fetching characters, equipped gear, carried items, Postmasters, and account inventory…');D2Loader.progress(0.18);}
    const {characters, vault, currencies} = await getFullInventory(membership.membershipType, membership.membershipId);
    const stores = characters.map(c=>{
      const items=fsDedupeStoreItems([
        ...c.equipped.map(i=>({...i,equipped:true,holderCharId:c.charId,source:'equipped'})),
        ...c.inventory.map(i=>({...i,equipped:false,holderCharId:c.charId,source:'character'})),
      ]);
      const postmasterItems=fsDedupeStoreItems((c.postmaster||[]).map(i=>({
        ...i,equipped:false,holderCharId:c.charId,source:'postmaster'
      })));
      return {kind:'character',charId:c.charId,classType:c.classType,light:c.light,emblemPath:c.emblemPath,items,postmasterItems};
    });
    stores.push({kind:'vault',items:fsDedupeStoreItems(vault.map(i=>({...i,equipped:false,holderCharId:null})))});
    body.innerHTML = ''; body.appendChild(el('div','fsState', 'Loading item and inventory-bucket details...'));
    if(window.D2Loader){D2Loader.update('Resolving Inventory','Loading item names, icons, buckets, and currencies…');D2Loader.progress(0.42);}
    const allItems = stores.flatMap(s=>[...(s.items||[]),...(s.postmasterItems||[])]);
    // Resolve each manifest hash once, then attach the shared result to every
    // matching instance. This avoids hundreds of duplicate Promise wrappers.
    const uniqueHashes=Array.from(new Set(allItems.map(it=>Number(it.hash)).filter(Boolean)));
    const definitions=new Map();
    await Promise.all(uniqueHashes.map(async hash=>{
      try { definitions.set(hash,await getItemDefinition(hash)); }
      catch(e){ definitions.set(hash,null); }
    }));
    allItems.forEach(it=>{it._def=definitions.get(Number(it.hash))||null;});

    const bucketHashes=Array.from(new Set(allItems.map(fsBucketHashForItem).filter(Boolean)));
    const bucketEntries=await Promise.all(bucketHashes.map(async hash=>{
      try { return [String(hash),await getInventoryBucketDefinition(hash)]; }
      catch(e){ return [String(hash),fsBucketInfo(hash)]; }
    }));
    fsState.bucketDefs=Object.fromEntries(bucketEntries);
    const overflow=stores.flatMap(fsAuditCharacterStore);
    window.__d2synergyInventoryAudit={
      generatedAt:new Date().toISOString(),
      model:'DIM-style: CharacterInventories + CharacterEquipment; Postmaster separate; ProfileInventory separate',
      characters:stores.filter(s=>s.kind==='character').map(store=>({
        characterId:store.charId,
        classType:store.classType,
        totalItems:store.items.length,
        equippedItems:store.items.filter(item=>item.equipped).length,
        carriedItems:store.items.filter(item=>!item.equipped).length,
        postmasterItems:(store.postmasterItems||[]).length,
        buckets:Object.fromEntries(Object.entries(store.items.reduce((acc,item)=>{const h=fsBucketHashForItem(item);acc[h]=(acc[h]||0)+1;return acc;},{}))),
      })),
      profileInventoryItems:stores.find(s=>s.kind==='vault')?.items?.length||0,
      overflow,
    };
    if(overflow.length) console.warn('[D2Synergy] Bungie inventory capacity audit found overflow after de-duplication',overflow);

    const resolvedCur=[];
    const currencyFallbacks={
      3159615086:{name:'Glimmer',icon:null},
      2817410917:{name:'Bright Dust',icon:null},
    };
    await Promise.all((currencies||[]).map(async c=>{
      try { resolvedCur.push({def:await getItemDefinition(c.hash),quantity:Number(c.quantity||0)}); }
      catch(e){
        const fallback=currencyFallbacks[Number(c.hash)]||{name:`Currency ${c.hash}`,icon:null};
        resolvedCur.push({def:{hash:Number(c.hash),name:fallback.name,icon:fallback.icon},quantity:Number(c.quantity||0)});
      }
    }));
    // Never silently hide the currency component. Expose the raw response for
    // debugging accounts where Bungie returns a new or redacted currency hash.
    window.__d2synergyCurrencies={raw:currencies||[],resolved:resolvedCur};
    resolvedCur.sort((a,b)=>{
      const rank=n=>/glimmer/i.test(n)?0:/bright dust/i.test(n)?1:10;
      return rank(a.def.name)-rank(b.def.name) || a.def.name.localeCompare(b.def.name);
    });
    fsState.currencies=resolvedCur; fsState.stores=stores; fsState.loading=false;
    if(window.D2Loader){D2Loader.update('Rendering Inventory','Building the visible Vault and Guardian stores…');D2Loader.progress(0.92);}
    renderFsBody();
    window.D2Status?.set('inventory','live','Vault, characters, and Postmasters synced');
    if(window.D2Loader)D2Loader.progress(1);
  } catch(err){
    fsState.loading=false; window.D2Status?.fail('inventory',err.message||'Inventory refresh failed'); body.innerHTML=''; body.appendChild(el('div','fsState err','Could not load vault: '+err.message));
  } finally {
    if(window.D2Loader)D2Loader.hide();
  }
}

function fsIsExcludedPresentationItem(it){
  const bucket=fsBucketHashForItem(it),def=it?._def||{};
  if(FS_HIDDEN_BUCKETS.has(bucket)||bucket===FS_QUEST_BUCKET)return true;
  const text=`${fsBucketInfo(bucket).name||''} ${def.typeName||''} ${def.name||''}`.toLowerCase();
  return /(^|\b)(subclass|seasonal artifact|artifact)(\b|$)/.test(text);
}
function fsItemMatchesFilter(it){
  if(!it._def) return false;
  const bucket=fsBucketHashForItem(it);
  if(fsIsExcludedPresentationItem(it)) return false;
  if(fsState.type!=='all' && fsItemKind(it)!==fsState.type) return false;
  const def=it._def||{},name=`${def.typeName||''} ${fsBucketLabel(it)}`.toLowerCase();
  const cat=fsState.category;
  if(cat!=='all'){
    const dmg=String(def.damageType||'');
    const weapon=def.itemType===3,armor=def.itemType===2,exotic=Number(def.tierType)===6;
    const pass={kinetic:weapon&&dmg==='1'&&!exotic,arc:weapon&&dmg==='2'&&!exotic,solar:weapon&&dmg==='3'&&!exotic,void:weapon&&dmg==='4'&&!exotic,stasis:weapon&&dmg==='6'&&!exotic,strand:weapon&&dmg==='7'&&!exotic,
      'exotic-weapons':weapon&&exotic,helmets:armor&&/helmet/.test(name)&&!exotic,gauntlets:armor&&/(gauntlet|arms)/.test(name)&&!exotic,chests:armor&&/chest/.test(name)&&!exotic,legs:armor&&/leg/.test(name)&&!exotic,'class-items':armor&&/class item/.test(name)&&!exotic,'exotic-armor':armor&&exotic,
      'destination-currency':FS_DESTINATION_CURRENCY_BUCKETS.has(bucket),'clan-banner':bucket===FS_CLAN_BANNER_BUCKET,cosmetics:/ghost|sparrow|vehicle|ship|emblem|shader|ornament|emote|finisher/.test(name),general:!weapon&&!armor&&!FS_DESTINATION_CURRENCY_BUCKETS.has(bucket)&&bucket!==FS_CLAN_BANNER_BUCKET};
    if(!pass[cat])return false;
  }
  if(fsState.search){
    const q=fsState.search.toLowerCase();
    const hay=`${it._def.name||''} ${it._def.typeName||''} ${fsBucketLabel(it)}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}
function fsBucketSort(a,b){
  const ah=Number(a),bh=Number(b);
  const labelRank=h=>{const n=String(fsBucketInfo(h).name||'').toLowerCase();if(/engram/.test(n))return 1;if(/order/.test(n))return 2;if(FS_DESTINATION_CURRENCY_BUCKETS.has(Number(h)))return 120;if(Number(h)===FS_CLAN_BANNER_BUCKET)return 121;return 50;};
  const ar=labelRank(ah),br=labelRank(bh);if(ar!==br)return ar-br;
  const ap=FS_BUCKET_PRIORITY.get(ah),bp=FS_BUCKET_PRIORITY.get(bh);
  if(ap!=null || bp!=null) return (ap??9000)-(bp??9000);
  const ad=fsBucketInfo(ah),bd=fsBucketInfo(bh);
  return Number(ad.bucketOrder??999)-Number(bd.bucketOrder??999) || String(ad.name).localeCompare(String(bd.name));
}

function fsPriorityBucketKind(it){
  const bucket=fsBucketHashForItem(it);
  if(bucket===FS_CLAN_BANNER_BUCKET)return 'clan';
  const name=String(fsBucketInfo(bucket).name||fsBucketLabel(it)||'').toLowerCase();
  if(/engram/.test(name))return 'engram';
  if(/order/.test(name))return 'order';
  return null;
}
function fsCharacterLabel(store){return CLASS_TYPE_NAMES[store?.classType]||'Guardian';}
function buildFsCharacterPrioritySection(title,chars,getEntries,options={}){
  const sec=el('section',`fsBucket fsPrioritySection ${options.className||''}`.trim());
  const label=el('div','fsBucketLabel'+(options.labelClass?` ${options.labelClass}`:''));
  label.appendChild(document.createTextNode(title));sec.appendChild(label);
  if(options.note)sec.appendChild(el('div','fsPostmasterNote',options.note));
  const rows=el('div','fsPriorityCharacterRows');
  chars.forEach(store=>{
    const entries=(getEntries(store)||[]).filter(({item})=>fsItemMatchesFilter(item)).sort((a,b)=>fsItemSort(a.item,b.item));
    const row=el('section','fsPriorityCharacterRow');
    const head=el('div','fsPriorityCharacterHead');
    if(store.emblemPath){const im=document.createElement('img');D2Assets.setImage(im,{name:`${fsCharacterLabel(store)} emblem`,icon:store.emblemPath},'emblem',{alt:'',lazy:false});head.appendChild(im);}
    const copy=el('div','');copy.appendChild(el('strong','',fsCharacterLabel(store)));copy.appendChild(el('span','',options.capacity?`${entries.length}/${options.capacity}`:String(entries.length)));head.appendChild(copy);row.appendChild(head);
    const grid=el('div','fsItems');entries.forEach(({item,itemStore})=>grid.appendChild(buildFsItemTile(item,itemStore,chars)));
    if(!entries.length)grid.appendChild(el('div','fsEmpty',options.emptyText||`No ${title.toLowerCase()} items.`));
    row.appendChild(grid);rows.appendChild(row);
  });
  sec.appendChild(rows);return sec;
}
function fsClanEntryRole(entry){
  const text=`${entry?.item?._def?.name||''} ${entry?.item?._def?.typeName||''}`.toLowerCase();
  if(/nightfall|vanguard/.test(text))return 'Nightfall';
  if(/gambit/.test(text))return 'Gambit';
  if(/raid/.test(text))return 'Raid';
  if(/crucible|pvp/.test(text))return 'Crucible';
  if(/engram/.test(text))return 'Clan Engram';
  return 'Clan Banner';
}
function openClanBannerDetail(entries,chars){
  const overlay=document.getElementById('itemDetailOverlay'),card=document.getElementById('itemDetailCard');
  if(!overlay||!card)return;
  const bannerEntry=entries.find(e=>!/engram/i.test(`${e.item?._def?.name||''} ${e.item?._def?.typeName||''}`))||entries[0];
  const banner=bannerEntry?.item?._def||{name:'Clan Banner'};
  card.textContent='';card.className='idCard dimDetailCard fsClanDetailCard';overlay.classList.add('open');document.body.classList.add('itemDetailOpen');
  const hero=el('header','dimHero');const iconFrame=el('div','dimItemIconFrame');const icon=document.createElement('img');D2Assets.setImage(icon,banner,'emblem',{alt:'Clan Banner',lazy:false});iconFrame.appendChild(icon);hero.appendChild(iconFrame);
  const copy=el('div','dimHeroCopy');copy.appendChild(el('h2','dimItemName','Clan Banner'));copy.appendChild(el('div','dimItemMeta',banner.description||banner.typeName||'Clan rewards and upgrades'));hero.appendChild(copy);
  const close=el('button','dimClose','×');close.type='button';close.onclick=()=>window.closeItemDetail?.();hero.appendChild(close);card.appendChild(hero);
  const content=el('div','dimContent');
  const summary=el('section','dimSection fsClanSummary');summary.appendChild(el('div','dimSectionTitle','Clan Status'));summary.appendChild(el('div','fsClanStatusCopy','Clan level and upgrade progress are read from Bungie when available.'));
  content.appendChild(summary);
  const engramSec=el('section','dimSection');engramSec.appendChild(el('div','dimSectionTitle','Clan Engrams'));
  const engramGrid=el('div','fsClanDetailEngrams');
  const expected=['Nightfall','Gambit','Raid','Crucible'];
  expected.forEach(role=>{
    const found=entries.find(e=>fsClanEntryRole(e)===role);
    const cell=el('article','fsClanEngramCard'+(found?' available':' missing'));
    if(found){const im=document.createElement('img');D2Assets.setImage(im,found.item._def,'engram',{alt:role,lazy:false});cell.appendChild(im);}else{const im=document.createElement('img');D2Assets.applyFallback(im,'engram');cell.appendChild(im);}
    cell.appendChild(el('strong','',role));cell.appendChild(el('span','',found?'Available / inspectable':'Not returned by Bungie'));engramGrid.appendChild(cell);
  });
  entries.filter(e=>fsClanEntryRole(e)==='Clan Engram').forEach(e=>{const cell=el('article','fsClanEngramCard available');const im=document.createElement('img');D2Assets.setImage(im,e.item._def,'engram',{alt:e.item._def.name,lazy:false});cell.appendChild(im);cell.appendChild(el('strong','',e.item._def.name));cell.appendChild(el('span','',e.item._def.description||'Clan reward'));engramGrid.appendChild(cell);});
  engramSec.appendChild(engramGrid);content.appendChild(engramSec);
  const perks=el('section','dimSection');perks.appendChild(el('div','dimSectionTitle','Clan Upgrades'));
  const perkList=el('div','fsClanUpgradeList');
  ['Live Fire Sale','Bountiful Bounties','Prime Engram Boost','Daily Ops Focus','Ascendant Supply'].forEach((name,i)=>{const row=el('div','fsClanUpgrade');row.appendChild(el('span','fsClanUpgradeLevel',i===4?'MAX':`LV ${i+1}`));row.appendChild(el('strong','',name));perkList.appendChild(row);});
  perks.appendChild(perkList);content.appendChild(perks);card.appendChild(content);
  const actions=el('footer','dimActions');const done=el('button','dimAction','Close');done.type='button';done.onclick=()=>window.closeItemDetail?.();actions.appendChild(done);card.appendChild(actions);
}
function buildClanBannerSection(entries,chars){
  const sec=el('section','fsBucket fsPrioritySection fsClanBannerSection');
  const label=el('div','fsBucketLabel');label.appendChild(document.createTextNode('Clan Banner '));label.appendChild(el('span','fsBucketCount',String(entries.length)));sec.appendChild(label);
  sec.appendChild(el('div','fsPostmasterNote','Clan Banner rewards and Clan Engrams are contained inside the Clan Banner menu.'));
  const grid=el('div','fsItems fsClanBannerItems');
  const bannerEntry=entries.find(e=>!/engram/i.test(`${e.item?._def?.name||''} ${e.item?._def?.typeName||''}`))||entries[0];
  if(bannerEntry){const tile=buildFsItemTile(bannerEntry.item,bannerEntry.store,chars);tile.title='Open Clan Banner';tile.onclick=ev=>{ev.stopPropagation();openClanBannerDetail(entries,chars);};grid.appendChild(tile);}
  else grid.appendChild(el('div','fsEmpty','No Clan Banner data was returned for this account.'));
  sec.appendChild(grid);return sec;
}
function fsItemSort(a,b){
  return Number(b.equipped)-Number(a.equipped) || Number(b.power||0)-Number(a.power||0) ||
    String(a._def?.name||'').localeCompare(String(b._def?.name||''));
}

function renderFsBody(){
  const body=document.getElementById('fsBody');
  if(!fsState.stores) return;
  body.innerHTML='';
  if(fsState.currencies?.length){
    const curBar=el('div','fsCurrencies'); curBar.setAttribute('data-testid','vault-currencies');
    fsState.currencies.forEach(c=>{
      const pill=el('div','fsCur');
      if(c.def){const im=document.createElement('img');D2Assets.setImage(im,c.def,'currency',{alt:''});pill.appendChild(im);}
      const label=document.createElement('span');
      const amount=document.createElement('b'); amount.textContent=(c.quantity||0).toLocaleString();
      label.append(amount,document.createTextNode(' '+c.def.name)); pill.appendChild(label); curBar.appendChild(pill);
    });
    body.appendChild(curBar);
  }
  const chars=fsState.stores.filter(s=>s.kind==='character');
  const priorityWrap=el('div','fsPriorityBuckets');
  const claimed=new Set();
  priorityWrap.appendChild(buildFsCharacterPrioritySection('Postmaster',chars,store=>{
    const pmStore={kind:'postmaster',charId:store.charId,classType:store.classType,items:store.postmasterItems||[]};
    return (store.postmasterItems||[]).map(item=>{claimed.add(fsItemIdentity(item));return {item,itemStore:pmStore};});
  },{className:'fsPostmasterSection',labelClass:'fsPostmasterLabel',capacity:FS_POSTMASTER_CAPACITY_FALLBACK,emptyText:'Postmaster is empty.',note:'Each Guardian Postmaster is always shown, even when empty.'}));
  const priorityFor=(store,kind)=>(store.items||[]).filter(item=>fsPriorityBucketKind(item)===kind).map(item=>{claimed.add(fsItemIdentity(item));return {item,itemStore:store};});
  priorityWrap.appendChild(buildFsCharacterPrioritySection('Engrams',chars,store=>priorityFor(store,'engram'),{emptyText:'No engrams are currently held.'}));
  priorityWrap.appendChild(buildFsCharacterPrioritySection('Orders',chars,store=>priorityFor(store,'order'),{emptyText:'No order items are currently held.'}));
  const clan=[];fsState.stores.forEach(store=>(store.items||[]).forEach(item=>{if(fsPriorityBucketKind(item)==='clan'){claimed.add(fsItemIdentity(item));clan.push({item,store});}}));
  priorityWrap.appendChild(buildClanBannerSection(clan,chars));
  body.appendChild(priorityWrap);

  const storeWrap=el('div','fsStores');
  fsState.stores.forEach(store=>{
    const col=el('div','fsStore'); col.setAttribute('data-drop-store-key',store.kind==='character'?store.charId:'vault');
    const head=el('div','fsStoreHead');
    if(store.kind==='character'){
      if(store.emblemPath){const img=document.createElement('img');img.className='fsStoreEmblem';D2Assets.setImage(img,{name:`${CLASS_TYPE_NAMES[store.classType]||'Guardian'} emblem`,icon:store.emblemPath},'emblem',{alt:''});head.appendChild(img);}
      const copy=el('div','fsStoreHeadCopy');copy.appendChild(el('div','cls',CLASS_TYPE_NAMES[store.classType]||'Guardian'));copy.appendChild(el('div','pw','◇ '+(store.light||'?')+' · '+store.items.length+' carried'));head.appendChild(copy);
    }else{const copy=el('div','fsStoreHeadCopy');copy.appendChild(el('div','cls','Vault & Account'));copy.appendChild(el('div','pw',store.items.length+' items'));head.appendChild(copy);}
    col.appendChild(head);
    const scroll=el('div','fsStoreScroll');const byBucket={};
    store.items.forEach(it=>{if(claimed.has(fsItemIdentity(it)))return;if(fsItemMatchesFilter(it)){let h=fsBucketHashForItem(it);if(FS_DESTINATION_CURRENCY_BUCKETS.has(h))h='destination-currency';(byBucket[h]=byBucket[h]||[]).push(it);}});
    let shown=0;
    Object.keys(byBucket).sort(fsBucketSort).forEach(hash=>{const items=byBucket[hash];if(!items?.length)return;shown+=items.length;const info=hash==='destination-currency'?{name:'Destination Currency'}:fsBucketInfo(hash);const sec=el('section','fsBucket');const label=el('div','fsBucketLabel');label.appendChild(document.createTextNode(`${info.name||FS_BUCKET_FALLBACK_NAMES[hash]||'Miscellaneous'} `));const capacity=fsBucketCapacity(hash,store);const countEl=el('span','fsBucketCount',capacity?`${items.length}/${capacity}`:String(items.length));label.appendChild(countEl);sec.appendChild(label);const grid=el('div','fsItems');items.sort(fsItemSort).forEach(it=>grid.appendChild(buildFsItemTile(it,store,chars)));sec.appendChild(grid);scroll.appendChild(sec);});
    if(!shown)scroll.appendChild(el('div','fsEmpty','No matching items.'));
    col.appendChild(scroll);storeWrap.appendChild(col);
  });
  body.style.flexDirection='column';body.appendChild(storeWrap);
}

function fsAssetTypeForItem(it){
  const def=it?._def||{},bucket=fsBucketHashForItem(it),text=`${fsBucketInfo(bucket).name||''} ${def.typeName||''} ${def.name||''}`.toLowerCase();
  if(def.itemType===3)return Number(def.tierType)===6?'exotic':'weapon';
  if(def.itemType===2)return Number(def.tierType)===6?'exotic':'armor';
  if(bucket===FS_CLAN_BANNER_BUCKET||/clan banner|emblem/.test(text))return 'emblem';
  if(/engram/.test(text))return 'engram';
  if(/currency|material|token|destination/.test(text))return /currency/.test(text)?'currency':'material';
  if(/quest|bount|mission|pursuit/.test(text))return 'quest';
  if(/ghost/.test(text))return 'ghost';if(/sparrow|vehicle/.test(text))return 'sparrow';if(/ship/.test(text))return 'ship';if(/shader/.test(text))return 'shader';
  if(/perk|trait/.test(text))return 'perk';return 'universal';
}
function buildFsItemTile(it,store,chars){
  const def=it._def; const tile=el('div','fsItem'); tile.setAttribute('data-testid','vault-item-tile');
  tile.dataset.itemKind=fsItemKind(it);
  if(def.tierType===6) tile.classList.add('exotic');
  if(it.isMasterworked) tile.classList.add('masterwork');
  if(it.equipped) tile.classList.add('equipped');
  if(it.isLocked) tile.classList.add('locked');
  tile.title=def.name+(it.power?` — ${it.power}`:'')+(Number(it.quantity||1)>1?` ×${Number(it.quantity).toLocaleString()}`:'')+(it.equipped?' (equipped)':'')+(store.kind==='postmaster'?' (Postmaster)':'');
  {const img=document.createElement('img');img.fetchPriority='low';D2Assets.setImage(img,def,fsAssetTypeForItem(it),{alt:def.name});tile.appendChild(img);}
  const dmg=FS_DMG[def.damageType];
  if(dmg && FS_WEAPON_BUCKETS.includes(def.bucketHash)){ const e=el('div','elem'); e.style.background=dmg.c; tile.appendChild(e); }
  if(it.power) tile.appendChild(el('div','pw',String(it.power)));
  if(Number(it.quantity||1)>1) tile.appendChild(el('div','qty',Number(it.quantity).toLocaleString()));
  if(it.isLocked) tile.appendChild(el('div','lockMark','◆'));
  tile.onclick=ev=>{ ev.stopPropagation(); if(__fsJustDragged){__fsJustDragged=false;return;} openFsItemMenu(ev,it,store,chars); };
  attachDragHandlers(tile,it,store); return tile;
}

let __fsJustDragged=false;
let __fsDragState=null;
let __fsMoveInFlight=false;
let __fsDragFrame=0;
let __fsPendingPoint=null;
function clearFsDragVisuals(){
  if(__fsDragFrame){cancelAnimationFrame(__fsDragFrame);__fsDragFrame=0;}
  __fsPendingPoint=null;
  if(__fsDragState?.ghost) __fsDragState.ghost.remove();
  if(__fsDragState?.sourceTile) __fsDragState.sourceTile.classList.remove('dragging');
  document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget'));
}
function attachDragHandlers(tile,it,store){
  if(!fsCanDrag(it,store)) return;
  tile.style.touchAction='none';
  tile.addEventListener('pointerdown',ev=>{
    if(__fsMoveInFlight||!ev.isPrimary||(ev.pointerType==='mouse'&&ev.button!==0)) return;
    ev.preventDefault(); closeFsMenu();
    try{tile.setPointerCapture(ev.pointerId);}catch(e){}
    __fsDragState={it,store,sourceTile:tile,startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,dragging:false,ghost:null,pointerId:ev.pointerId};
  });
}
function fsStoreAtPoint(x,y){ return document.elementFromPoint(x,y)?.closest?.('.fsStore')||null; }
function fsHandlePointerMove(ev){
  const d=__fsDragState; if(!d||ev.pointerId!==d.pointerId) return;
  d.lastX=ev.clientX;d.lastY=ev.clientY;
  if(!d.dragging){
    if(Math.hypot(ev.clientX-d.startX,ev.clientY-d.startY)<7) return;
    d.dragging=true;d.sourceTile.classList.add('dragging');
    const ghost=el('div','fsDragGhost');
    if(d.it._def){const img=document.createElement('img');D2Assets.setImage(img,d.it._def,d.it._def.itemType===2?'armor':'weapon',{alt:'',lazy:false});ghost.appendChild(img);}
    document.body.appendChild(ghost);d.ghost=ghost;
  }
  ev.preventDefault();
  __fsPendingPoint={x:ev.clientX,y:ev.clientY};
  if(__fsDragFrame)return;
  __fsDragFrame=requestAnimationFrame(()=>{
    __fsDragFrame=0;
    const active=__fsDragState,point=__fsPendingPoint;
    if(!active?.dragging||!active.ghost||!point)return;
    active.ghost.style.transform=`translate3d(${point.x-26}px,${point.y-26}px,0)`;
    document.querySelectorAll('.fsStore.dropTarget').forEach(s=>s.classList.remove('dropTarget'));
    fsStoreAtPoint(point.x,point.y)?.classList.add('dropTarget');
  });
}
async function fsHandlePointerUp(ev){
  const d=__fsDragState;if(!d||ev.pointerId!==d.pointerId)return;
  const wasDragging=d.dragging;const storeCol=wasDragging?fsStoreAtPoint(ev.clientX,ev.clientY):null;
  const targetKey=storeCol?.getAttribute('data-drop-store-key')||null;const originKey=d.store.kind==='postmaster'?`postmaster:${d.store.charId}`:(d.store.kind==='character'?d.store.charId:'vault');
  clearFsDragVisuals();try{d.sourceTile.releasePointerCapture(ev.pointerId);}catch(e){} __fsDragState=null;
  if(!wasDragging)return;__fsJustDragged=true;setTimeout(()=>{__fsJustDragged=false;},250);
  if(!targetKey||targetKey===originKey)return;
  if(targetKey==='vault')await fsDoMove(d.it,d.store,{toVault:true});else await fsDoMove(d.it,d.store,{toCharacterId:targetKey});
}
function fsHandlePointerCancel(ev){ if(!__fsDragState||(ev.pointerId!=null&&ev.pointerId!==__fsDragState.pointerId))return;clearFsDragVisuals();__fsDragState=null; }
document.addEventListener('pointermove',fsHandlePointerMove,{passive:false,capture:true});
document.addEventListener('pointerup',fsHandlePointerUp,{capture:true});
document.addEventListener('pointercancel',fsHandlePointerCancel,{capture:true});

function openFsItemMenu(ev,it,store,chars){
  closeFsMenu();const def=it._def;const menu=el('div','fsMenu');menu.id='fsMenu';
  const head=el('div','mHead');{const img=document.createElement('img');D2Assets.setImage(img,def,def.itemType===2?'armor':'weapon',{alt:def.name});head.appendChild(img);}
  head.appendChild(el('div','',`<div class="mn">${def.name}</div><div class="mt">${def.typeName||fsBucketLabel(it)}${it.power?` • ◈${it.power}`:''}${Number(it.quantity||1)>1?` • ×${Number(it.quantity).toLocaleString()}`:''}</div>`));menu.appendChild(head);
  const detailsBtn=document.createElement('button');detailsBtn.textContent='View details';detailsBtn.setAttribute('data-testid','view-item-details-btn');detailsBtn.onclick=()=>{closeFsMenu();openItemDetail(it,{store,chars});};menu.appendChild(detailsBtn);
  if(store.kind==='postmaster'){
    const owner=chars.find(c=>String(c.charId)===String(store.charId));
    const ownerName=CLASS_TYPE_NAMES[owner?.classType]||'owning Guardian';
    const note=it._def?.doesPostmasterPullHaveSideEffects
      ? 'Bungie warns that pulling this item may have side effects. Review it in-game before continuing.'
      : 'Postmaster items must be pulled to their owning Guardian before they can be moved elsewhere.';
    menu.appendChild(el('div','mNote',note));
    const b=document.createElement('button');
    b.textContent=`Pull to ${ownerName}`;
    b.setAttribute('data-testid','pull-from-postmaster-btn');
    b.disabled=Number(it.transferStatus||0)!==0;
    b.onclick=()=>fsDoMove(it,store,{toCharacterId:store.charId});
    menu.appendChild(b);
  } else if(it.equipped) menu.appendChild(el('div','mNote','Equipped items must be unequipped in-game before they can be moved.'));
  else if(!it.instanceId) menu.appendChild(el('div','mNote','This is an account inventory stack or currency. It can be viewed here, but Bungie does not expose it as a transferable item instance.'));
  else if(Number(it.transferStatus||0)!==0) menu.appendChild(el('div','mNote','Bungie currently marks this item as non-transferable.'));
  else {
    if(store.kind==='character'){const b=document.createElement('button');b.textContent='→ Vault';b.setAttribute('data-testid','move-to-vault-btn');b.onclick=()=>fsDoMove(it,store,{toVault:true});menu.appendChild(b);}
    chars.forEach(c=>{if(store.kind==='character'&&String(c.charId)===String(store.charId))return;const b=document.createElement('button');b.textContent=`→ ${CLASS_TYPE_NAMES[c.classType]||'Character'}`;b.onclick=()=>fsDoMove(it,store,{toCharacterId:c.charId});menu.appendChild(b);});
  }
  document.body.appendChild(menu);const r=menu.getBoundingClientRect();let x=ev.clientX,y=ev.clientY+8;
  if(x+r.width>window.innerWidth-8)x=window.innerWidth-r.width-8;if(y+r.height>window.innerHeight-8)y=window.innerHeight-r.height-8;
  menu.style.left=Math.max(8,x)+'px';menu.style.top=Math.max(8,y)+'px';
}
function fsOptimisticMove(it,store,dest){
  if(!fsState.stores) return;
  const sourceStore=store.kind==='postmaster'
    ? fsState.stores.find(s=>s.kind==='character'&&String(s.charId)===String(store.charId))
    : fsState.stores.find(s=>store.kind==='vault'?s.kind==='vault':s.kind==='character'&&String(s.charId)===String(store.charId));
  if(store.kind==='postmaster' && sourceStore) sourceStore.postmasterItems=(sourceStore.postmasterItems||[]).filter(x=>fsItemIdentity(x)!==fsItemIdentity(it));
  else if(sourceStore) sourceStore.items=(sourceStore.items||[]).filter(x=>fsItemIdentity(x)!==fsItemIdentity(it));
  let target=null;
  if(dest.toVault) target=fsState.stores.find(s=>s.kind==='vault');
  else if(dest.toCharacterId) target=fsState.stores.find(s=>s.kind==='character'&&String(s.charId)===String(dest.toCharacterId));
  if(target){
    const moved={...it,equipped:false,source:target.kind==='vault'?'vault':'character',holderCharId:target.charId||null,characterId:target.charId||null,location:target.kind==='vault'?2:1};
    target.items=fsDedupeStoreItems([...(target.items||[]),moved]);
  }
  renderFsBody();
}
function fsDelay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function fsDoMove(it,store,dest){
  if(__fsMoveInFlight) return;
  __fsMoveInFlight=true; closeFsMenu(); const mt=fsState.membershipType;
  if(window.D2Loader){D2Loader.show(store.kind==='postmaster'?'Pulling Item':'Moving Item',it._def?.name||'Updating inventory…');D2Loader.progress(0.12);}
  const withTimeout=(promise,ms=15000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Bungie transfer timed out. The item may still move; reload to verify.')),ms))]);
  try{
    fsToast((store.kind==='postmaster'?'Pulling ':'Moving ')+it._def.name+'...');
    if(store.kind==='postmaster'){
      if(!dest.toCharacterId || String(dest.toCharacterId)!==String(store.charId)) throw new Error('A Postmaster item must first be pulled to the Guardian that owns that Postmaster.');
      await withTimeout(pullFromPostmaster({itemHash:it.hash,instanceId:it.instanceId,quantity:it.quantity,membershipType:mt,characterId:store.charId}));
      if(window.D2Loader)D2Loader.progress(0.82);
    } else if(dest.toVault){
      await withTimeout(transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:store.charId,direction:'toVault'}));
      if(window.D2Loader)D2Loader.progress(0.82);
    } else if(dest.toCharacterId){
      if(store.kind==='vault'){
        await withTimeout(transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:dest.toCharacterId,direction:'toCharacter'}));
        if(window.D2Loader)D2Loader.progress(0.82);
      } else {
        await withTimeout(transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:store.charId,direction:'toVault'}));
        if(window.D2Loader){D2Loader.update('Moving Item',`Routing ${it._def?.name||'item'} through the Vault…`);D2Loader.progress(0.46);}
        await fsDelay(180);
        await withTimeout(transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:dest.toCharacterId,direction:'toCharacter'}));
        if(window.D2Loader)D2Loader.progress(0.82);
      }
    }
    fsOptimisticMove(it,store,dest);
    if(window.D2Loader)D2Loader.progress(1);
    fsToast(it._def.name+(store.kind==='postmaster'?' pulled.':' moved.'),'ok');
    // Reconcile with Bungie after its profile cache has had time to update.
    setTimeout(()=>loadFullScreenVault().catch(()=>{}),900);
  }catch(err){
    fsToast('Transfer failed: '+err.message,'err');
    setTimeout(()=>loadFullScreenVault().catch(()=>{}),300);
  }finally{
    __fsMoveInFlight=false;
    if(window.D2Loader)D2Loader.hide();
  }
}

document.getElementById('fsCloseBtn').onclick=closeFullScreenVault;
document.getElementById('fsReloadBtn').onclick=()=>{fsState.stores=null;loadFullScreenVault();};
let __fsSearchTimer=null;
document.getElementById('fsSearchInput').addEventListener('input',e=>{
  const value=e.target.value.trim();
  clearTimeout(__fsSearchTimer);
  __fsSearchTimer=setTimeout(()=>{fsState.search=value;renderFsBody();},90);
});
document.addEventListener('click',e=>{const m=document.getElementById('fsMenu');if(m&&!m.contains(e.target))closeFsMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fsOverlay.classList.contains('open'))closeFullScreenVault();});
