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
const FS_BUCKET_FALLBACK_NAMES = {
  1498876634:'Kinetic',2465295065:'Energy',953998645:'Power',3448274439:'Helmet',
  3551918588:'Arms',14239492:'Chest',20886954:'Legs',1585787867:'Class Item',
  4023194814:'Ghosts',2025709351:'Vehicles / Sparrows',284967655:'Ships',4274335291:'Emblems',
};

const fsState = {
  stores:null,currencies:null,bucketDefs:{},membershipType:null,membershipId:null,
  search:"",element:"all",type:"all",loading:false,
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
  buildFsFilters();
  if(!fsState.stores && !fsState.loading) loadFullScreenVault();
  else renderFsBody();
}
function closeFullScreenVault(){
  fsOverlay.classList.remove('open');
  document.body.style.overflow = '';
  closeFsMenu();
}
function buildFsFilters(){
  const elemHost = document.getElementById('fsElemChips');
  const typeHost = document.getElementById('fsTypeChips');
  if(elemHost.childElementCount === 0){
    const elems = [["all","All"],["1","Kinetic"],["2","Arc"],["3","Solar"],["4","Void"],["6","Stasis"],["7","Strand"]];
    elems.forEach(([val,label])=>{
      const c = el('div','fsChip'+(fsState.element===val?' active':''), label);
      c.onclick = ()=>{ fsState.element = val; syncFsChips(); renderFsBody(); };
      c.dataset.elem = val; elemHost.appendChild(c);
    });
  }
  if(typeHost.childElementCount === 0){
    const types = [["all","All"],["weapons","Weapons"],["armor","Armor"],["equipment","Equipment"],["inventory","Inventory"]];
    types.forEach(([val,label])=>{
      const c = el('div','fsChip'+(fsState.type===val?' active':''), label);
      c.onclick = ()=>{ fsState.type = val; syncFsChips(); renderFsBody(); };
      c.dataset.type = val; typeHost.appendChild(c);
    });
  }
}
function syncFsChips(){
  document.querySelectorAll('#fsElemChips .fsChip').forEach(c=>c.classList.toggle('active', c.dataset.elem===fsState.element));
  document.querySelectorAll('#fsTypeChips .fsChip').forEach(c=>c.classList.toggle('active', c.dataset.type===fsState.type));
}
function fsBucketInfo(hash){
  const key=String(hash||'');
  return fsState.bucketDefs[key] || {
    hash:Number(hash||0),name:FS_BUCKET_FALLBACK_NAMES[Number(hash)]||'Miscellaneous',
    bucketOrder:999,scope:0,category:0,location:0,hasTransferDestination:false,
  };
}
function fsBucketHashForItem(it){ return Number(it?._def?.bucketHash || it?.bucketHash || 0); }
function fsBucketLabel(it){ return fsBucketInfo(fsBucketHashForItem(it)).name || 'Miscellaneous'; }
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

async function loadFullScreenVault(){
  const body = document.getElementById('fsBody');
  fsState.loading = true; body.innerHTML = '';
  body.appendChild(el('div','fsState', 'Resolving your signed-in account...'));
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error("Not signed in. Open the menu → Sign in with Bungie.net first. (Sign-in only works on the deployed GitHub Pages site.)");
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    fsState.membershipType = membership.membershipType; fsState.membershipId = membership.membershipId;
    body.innerHTML = ''; body.appendChild(el('div','fsState', 'Fetching characters, vault, and account inventory...'));
    const {characters, vault, currencies} = await getFullInventory(membership.membershipType, membership.membershipId);
    const stores = characters.map(c=>({
      kind:'character',charId:c.charId,classType:c.classType,light:c.light,emblemPath:c.emblemPath,
      items:[...c.equipped.map(i=>({...i,equipped:true,holderCharId:c.charId})),...c.inventory.map(i=>({...i,equipped:false,holderCharId:c.charId}))],
    }));
    stores.push({kind:'vault',items:vault.map(i=>({...i,equipped:false,holderCharId:null}))});
    body.innerHTML = ''; body.appendChild(el('div','fsState', 'Loading item and inventory-bucket details...'));
    const allItems = stores.flatMap(s=>s.items);
    await Promise.all(allItems.map(async it=>{ try { it._def = await getItemDefinition(it.hash); } catch(e){ it._def = null; } }));

    const bucketHashes=Array.from(new Set(allItems.map(fsBucketHashForItem).filter(Boolean)));
    const bucketEntries=await Promise.all(bucketHashes.map(async hash=>{
      try { return [String(hash),await getInventoryBucketDefinition(hash)]; }
      catch(e){ return [String(hash),fsBucketInfo(hash)]; }
    }));
    fsState.bucketDefs=Object.fromEntries(bucketEntries);

    const resolvedCur=[];
    await Promise.all((currencies||[]).map(async c=>{
      try { resolvedCur.push({def:await getItemDefinition(c.hash),quantity:Number(c.quantity||0)}); } catch(e){}
    }));
    resolvedCur.sort((a,b)=>{
      const rank=n=>/glimmer/i.test(n)?0:/bright dust/i.test(n)?1:10;
      return rank(a.def.name)-rank(b.def.name) || a.def.name.localeCompare(b.def.name);
    });
    fsState.currencies=resolvedCur; fsState.stores=stores; fsState.loading=false; renderFsBody();
  } catch(err){
    fsState.loading=false; body.innerHTML=''; body.appendChild(el('div','fsState err','Could not load vault: '+err.message));
  }
}

function fsItemMatchesFilter(it){
  if(!it._def) return false;
  if(fsState.type!=='all' && fsItemKind(it)!==fsState.type) return false;
  if(fsState.element!=='all'){
    if(it._def.itemType!==3 || String(it._def.damageType)!==fsState.element) return false;
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
  const ap=FS_BUCKET_PRIORITY.get(ah),bp=FS_BUCKET_PRIORITY.get(bh);
  if(ap!=null || bp!=null) return (ap??9000)-(bp??9000);
  const ad=fsBucketInfo(ah),bd=fsBucketInfo(bh);
  return Number(ad.bucketOrder??999)-Number(bd.bucketOrder??999) || String(ad.name).localeCompare(String(bd.name));
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
      if(c.def.icon){ const im=document.createElement('img'); im.src=c.def.icon; im.alt=''; pill.appendChild(im); }
      const label=document.createElement('span');
      const amount=document.createElement('b'); amount.textContent=(c.quantity||0).toLocaleString();
      label.append(amount,document.createTextNode(' '+c.def.name)); pill.appendChild(label); curBar.appendChild(pill);
    });
    body.appendChild(curBar);
  }
  const storeWrap=el('div','fsStores');
  const chars=fsState.stores.filter(s=>s.kind==='character');
  fsState.stores.forEach(store=>{
    const col=el('div','fsStore'); col.setAttribute('data-drop-store-key',store.kind==='character'?store.charId:'vault');
    const head=el('div','fsStoreHead');
    if(store.kind==='character'){
      if(store.emblemPath){ const img=document.createElement('img'); img.className='fsStoreEmblem'; img.src='https://www.bungie.net'+store.emblemPath; img.alt=''; head.appendChild(img); }
      const copy=el('div','fsStoreHeadCopy');
      copy.appendChild(el('div','cls',CLASS_TYPE_NAMES[store.classType]||'Guardian'));
      copy.appendChild(el('div','pw','◇ '+(store.light||'?'))); head.appendChild(copy);
    } else {
      const copy=el('div','fsStoreHeadCopy'); copy.appendChild(el('div','cls','Vault & Account'));
      copy.appendChild(el('div','pw',store.items.length+' items')); head.appendChild(copy);
    }
    col.appendChild(head);
    const scroll=el('div','fsStoreScroll');
    const byBucket={};
    store.items.forEach(it=>{ if(fsItemMatchesFilter(it)){ const h=fsBucketHashForItem(it); (byBucket[h]=byBucket[h]||[]).push(it); } });
    let shown=0;
    Object.keys(byBucket).sort(fsBucketSort).forEach(hash=>{
      const items=byBucket[hash]; if(!items?.length) return; shown+=items.length;
      const info=fsBucketInfo(hash); const sec=el('section','fsBucket');
      const label=el('div','fsBucketLabel');
      label.appendChild(document.createTextNode(`${info.name||FS_BUCKET_FALLBACK_NAMES[hash]||'Miscellaneous'} `));
      label.appendChild(el('span','fsBucketCount',String(items.length))); sec.appendChild(label);
      const grid=el('div','fsItems'); items.sort(fsItemSort).forEach(it=>grid.appendChild(buildFsItemTile(it,store,chars)));
      sec.appendChild(grid); scroll.appendChild(sec);
    });
    if(!shown) scroll.appendChild(el('div','fsEmpty','No matching items.'));
    col.appendChild(scroll); storeWrap.appendChild(col);
  });
  body.style.flexDirection='column'; body.appendChild(storeWrap);
}

function buildFsItemTile(it,store,chars){
  const def=it._def; const tile=el('div','fsItem'); tile.setAttribute('data-testid','vault-item-tile');
  tile.dataset.itemKind=fsItemKind(it);
  if(def.tierType===6) tile.classList.add('exotic');
  if(it.isMasterworked) tile.classList.add('masterwork');
  if(it.equipped) tile.classList.add('equipped');
  if(it.isLocked) tile.classList.add('locked');
  tile.title=def.name+(it.power?` — ${it.power}`:'')+(Number(it.quantity||1)>1?` ×${Number(it.quantity).toLocaleString()}`:'')+(it.equipped?' (equipped)':'');
  if(def.icon){ const img=document.createElement('img'); img.src=def.icon; img.alt=def.name; img.loading='lazy'; tile.appendChild(img); }
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
function clearFsDragVisuals(){
  if(__fsDragState?.ghost) __fsDragState.ghost.remove();
  if(__fsDragState?.sourceTile) __fsDragState.sourceTile.classList.remove('dragging');
  document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget'));
}
function attachDragHandlers(tile,it,store){
  if(!fsCanTransfer(it)) return;
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
  if(!d.dragging){ if(Math.hypot(ev.clientX-d.startX,ev.clientY-d.startY)<7) return; d.dragging=true;d.sourceTile.classList.add('dragging');
    const ghost=el('div','fsDragGhost'); if(d.it._def?.icon){const img=document.createElement('img');img.src=d.it._def.icon;ghost.appendChild(img);} document.body.appendChild(ghost);d.ghost=ghost; }
  ev.preventDefault(); d.ghost.style.left=(ev.clientX-26)+'px';d.ghost.style.top=(ev.clientY-26)+'px';
  document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget')); fsStoreAtPoint(ev.clientX,ev.clientY)?.classList.add('dropTarget');
}
async function fsHandlePointerUp(ev){
  const d=__fsDragState;if(!d||ev.pointerId!==d.pointerId)return;
  const wasDragging=d.dragging;const storeCol=wasDragging?fsStoreAtPoint(ev.clientX,ev.clientY):null;
  const targetKey=storeCol?.getAttribute('data-drop-store-key')||null;const originKey=d.store.kind==='character'?d.store.charId:'vault';
  clearFsDragVisuals();try{d.sourceTile.releasePointerCapture(ev.pointerId);}catch(e){} __fsDragState=null;
  if(!wasDragging)return;__fsJustDragged=true;setTimeout(()=>{__fsJustDragged=false;},250);
  if(!targetKey||targetKey===originKey)return;__fsMoveInFlight=true;
  try{if(targetKey==='vault')await fsDoMove(d.it,d.store,{toVault:true});else await fsDoMove(d.it,d.store,{toCharacterId:targetKey});}finally{__fsMoveInFlight=false;}
}
function fsHandlePointerCancel(ev){ if(!__fsDragState||(ev.pointerId!=null&&ev.pointerId!==__fsDragState.pointerId))return;clearFsDragVisuals();__fsDragState=null; }
document.addEventListener('pointermove',fsHandlePointerMove,{passive:false,capture:true});
document.addEventListener('pointerup',fsHandlePointerUp,{capture:true});
document.addEventListener('pointercancel',fsHandlePointerCancel,{capture:true});

function openFsItemMenu(ev,it,store,chars){
  closeFsMenu();const def=it._def;const menu=el('div','fsMenu');menu.id='fsMenu';
  const head=el('div','mHead');if(def.icon){const img=document.createElement('img');img.src=def.icon;head.appendChild(img);}
  head.appendChild(el('div','',`<div class="mn">${def.name}</div><div class="mt">${def.typeName||fsBucketLabel(it)}${it.power?` • ◈${it.power}`:''}${Number(it.quantity||1)>1?` • ×${Number(it.quantity).toLocaleString()}`:''}</div>`));menu.appendChild(head);
  const detailsBtn=document.createElement('button');detailsBtn.textContent='View details';detailsBtn.setAttribute('data-testid','view-item-details-btn');detailsBtn.onclick=()=>{closeFsMenu();openItemDetail(it,{store,chars});};menu.appendChild(detailsBtn);
  if(it.equipped) menu.appendChild(el('div','mNote','Equipped items must be unequipped in-game before they can be moved.'));
  else if(!it.instanceId) menu.appendChild(el('div','mNote','This is an account inventory stack or currency. It can be viewed here, but Bungie does not expose it as a transferable item instance.'));
  else if(Number(it.transferStatus||0)!==0) menu.appendChild(el('div','mNote','Bungie currently marks this item as non-transferable.'));
  else {
    if(store.kind==='character'){const b=document.createElement('button');b.textContent='→ Vault';b.setAttribute('data-testid','move-to-vault-btn');b.onclick=()=>fsDoMove(it,store,{toVault:true});menu.appendChild(b);}
    chars.forEach(c=>{if(store.kind==='character'&&c.charId===store.charId)return;const b=document.createElement('button');b.textContent=`→ ${CLASS_TYPE_NAMES[c.classType]||'Character'}`;b.onclick=()=>fsDoMove(it,store,{toCharacterId:c.charId});menu.appendChild(b);});
  }
  document.body.appendChild(menu);const r=menu.getBoundingClientRect();let x=ev.clientX,y=ev.clientY+8;
  if(x+r.width>window.innerWidth-8)x=window.innerWidth-r.width-8;if(y+r.height>window.innerHeight-8)y=window.innerHeight-r.height-8;
  menu.style.left=Math.max(8,x)+'px';menu.style.top=Math.max(8,y)+'px';
}
async function fsDoMove(it,store,dest){
  closeFsMenu();const mt=fsState.membershipType;
  try{
    fsToast('Moving '+it._def.name+'...');
    if(dest.toVault) await transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:store.charId,direction:'toVault'});
    else if(dest.toCharacterId){
      if(store.kind==='vault') await transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:dest.toCharacterId,direction:'toCharacter'});
      else {await transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:store.charId,direction:'toVault'});await transferItem({itemHash:it.hash,instanceId:it.instanceId,membershipType:mt,characterId:dest.toCharacterId,direction:'toCharacter'});}
    }
    fsToast(it._def.name+' moved.','ok');await loadFullScreenVault();
  }catch(err){fsToast('Transfer failed: '+err.message,'err');}
}

document.getElementById('fsCloseBtn').onclick=closeFullScreenVault;
document.getElementById('fsReloadBtn').onclick=()=>{fsState.stores=null;loadFullScreenVault();};
document.getElementById('fsSearchInput').addEventListener('input',e=>{fsState.search=e.target.value.trim();renderFsBody();});
document.addEventListener('click',e=>{const m=document.getElementById('fsMenu');if(m&&!m.contains(e.target))closeFsMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fsOverlay.classList.contains('open'))closeFullScreenVault();});
