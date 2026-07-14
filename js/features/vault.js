/* Full-screen vault and transfer interface
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 2 — FULL-SCREEN VAULT VIEW
   DIM / Ishtar Commander-style window: every character + the vault side by
   side, weapons split Kinetic / Energy / Power, armor split by slot, with
   power / masterwork / equipped indicators, live search + element/type
   filters, and direct character <-> vault <-> character transfers.
   Data is fetched once and all item defs resolved up-front (resolve-then-
   render) so nothing renders out of order — this is also the async-race fix.
   ========================================================================= */
const FS_BUCKETS = [
  {h:1498876634, label:"Kinetic"},
  {h:2465295065, label:"Energy"},
  {h:953998645,  label:"Power"},
  {h:3448274439, label:"Helmet"},
  {h:3551918588, label:"Arms"},
  {h:14239492,   label:"Chest"},
  {h:20886954,   label:"Legs"},
  {h:1585787867, label:"Class Item"},
];
const FS_WEAPON_BUCKETS = [1498876634,2465295065,953998645];
const FS_DMG = {1:{n:"Kinetic",c:"var(--kinetic)"},2:{n:"Arc",c:"var(--arc)"},3:{n:"Solar",c:"var(--solar)"},4:{n:"Void",c:"var(--void)"},6:{n:"Stasis",c:"var(--stasis)"},7:{n:"Strand",c:"var(--strand)"}};

const fsState = { stores:null, currencies:null, membershipType:null, membershipId:null, search:"", element:"all", type:"all", loading:false };

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
      c.dataset.elem = val;
      elemHost.appendChild(c);
    });
  }
  if(typeHost.childElementCount === 0){
    const types = [["all","All"],["weapons","Weapons"],["armor","Armor"]];
    types.forEach(([val,label])=>{
      const c = el('div','fsChip'+(fsState.type===val?' active':''), label);
      c.onclick = ()=>{ fsState.type = val; syncFsChips(); renderFsBody(); };
      c.dataset.type = val;
      typeHost.appendChild(c);
    });
  }
}
function syncFsChips(){
  document.querySelectorAll('#fsElemChips .fsChip').forEach(c=>c.classList.toggle('active', c.dataset.elem===fsState.element));
  document.querySelectorAll('#fsTypeChips .fsChip').forEach(c=>c.classList.toggle('active', c.dataset.type===fsState.type));
}

async function loadFullScreenVault(){
  const body = document.getElementById('fsBody');
  fsState.loading = true;
  body.innerHTML = '';
  body.appendChild(el('div','fsState', 'Resolving your signed-in account...'));
  try {
    const auth = await getValidAccessToken();
    if(!auth) throw new Error("Not signed in. Open the menu \u2192 Sign in with Bungie.net first. (Sign-in only works on the deployed GitHub Pages site.)");
    const membership = await getMembershipsForCurrentUser(auth.access_token);
    fsState.membershipType = membership.membershipType;
    fsState.membershipId = membership.membershipId;
    body.innerHTML = '';
    body.appendChild(el('div','fsState', 'Fetching characters and vault from Bungie.net...'));
    const {characters, vault, currencies} = await getFullInventory(membership.membershipType, membership.membershipId);
    const stores = characters.map(c=>({
      kind:'character', charId:c.charId, classType:c.classType, light:c.light,
      items:[
        ...c.equipped.map(i=>({...i, equipped:true, holderCharId:c.charId})),
        ...c.inventory.map(i=>({...i, equipped:false, holderCharId:c.charId})),
      ],
    }));
    stores.push({kind:'vault', items:vault.map(i=>({...i, equipped:false, holderCharId:null}))});
    body.innerHTML = '';
    body.appendChild(el('div','fsState', 'Loading item details...'));
    const allItems = stores.flatMap(s=>s.items);
    await Promise.all(allItems.map(async it=>{
      try { it._def = await getItemDefinition(it.hash); }
      catch(e){ it._def = null; }
    }));
    // Phase 1 — resolve currency defs (Glimmer, Bright Dust, Shards, etc.)
    const resolvedCur = [];
    await Promise.all((currencies||[]).map(async c=>{
      try { const def = await getItemDefinition(c.hash); resolvedCur.push({def, quantity:c.quantity}); }
      catch(e){}
    }));
    fsState.currencies = resolvedCur;
    fsState.stores = stores;
    fsState.loading = false;
    renderFsBody();
  } catch(err){
    fsState.loading = false;
    body.innerHTML = '';
    body.appendChild(el('div','fsState err', 'Could not load vault: ' + err.message));
  }
}

function fsItemMatchesFilter(it){
  if(!it._def) return false;
  if(fsState.type === 'weapons' && it._def.itemType !== 3) return false;
  if(fsState.type === 'armor' && it._def.itemType !== 2) return false;
  if(fsState.element !== 'all' && String(it._def.damageType) !== fsState.element) return false;
  if(fsState.search){
    const q = fsState.search.toLowerCase();
    if(!(it._def.name||'').toLowerCase().includes(q)) return false;
  }
  return true;
}

function renderFsBody(){
  const body = document.getElementById('fsBody');
  if(!fsState.stores){ return; }
  body.innerHTML = '';
  // Phase 1 — currency strip (Glimmer, Bright Dust, Legendary Shards, etc.)
  if(fsState.currencies && fsState.currencies.length){
    const curBar = el('div','fsCurrencies'); curBar.setAttribute('data-testid','vault-currencies');
    fsState.currencies.forEach(c=>{
      const pill = el('div','fsCur');
      if(c.def.icon){ const im=document.createElement('img'); im.src=c.def.icon; pill.appendChild(im); }
      pill.appendChild(el('span','', `<b>${(c.quantity||0).toLocaleString()}</b> ${c.def.name}`));
      curBar.appendChild(pill);
    });
    body.appendChild(curBar);
  }
  const storeWrap = el('div','fsStores');
  const chars = fsState.stores.filter(s=>s.kind==='character');
  fsState.stores.forEach(store=>{
    const col = el('div','fsStore');
    col.setAttribute('data-drop-store-key', store.kind==='character' ? store.charId : 'vault');
    const head = el('div','fsStoreHead');
    if(store.kind==='character'){
      head.innerHTML = `<span class="cls">${CLASS_TYPE_NAMES[store.classType]||'Guardian'}</span> <span class="pw">\u25C8 ${store.light||'?'}</span>`;
    } else {
      head.innerHTML = `<span class="cls">Vault</span> <span class="pw">${store.items.length} items</span>`;
    }
    col.appendChild(head);
    const scroll = el('div','fsStoreScroll');
    const byBucket = {};
    store.items.forEach(it=>{
      if(!fsItemMatchesFilter(it)) return;
      const b = it._def.bucketHash;
      (byBucket[b] = byBucket[b] || []).push(it);
    });
    let shown = 0;
    FS_BUCKETS.forEach(bk=>{
      const items = byBucket[bk.h];
      if(!items || !items.length) return;
      shown += items.length;
      const sec = el('div','fsBucket');
      sec.appendChild(el('div','fsBucketLabel', `${bk.label} (${items.length})`));
      const grid = el('div','fsItems');
      items.sort((a,b)=>(b.equipped-a.equipped) || ((b.power||0)-(a.power||0)));
      items.forEach(it=>grid.appendChild(buildFsItemTile(it, store, chars)));
      sec.appendChild(grid);
      scroll.appendChild(sec);
    });
    if(shown === 0) scroll.appendChild(el('div','fsEmpty','No matching items.'));
    col.appendChild(scroll);
    storeWrap.appendChild(col);
  });
  body.style.flexDirection = 'column';
  body.appendChild(storeWrap);
}

function buildFsItemTile(it, store, chars){
  const def = it._def;
  const tile = el('div','fsItem');
  tile.setAttribute('data-testid','vault-item-tile');
  if(def.tierType === 6) tile.classList.add('exotic');
  if(it.isMasterworked) tile.classList.add('masterwork');
  if(it.equipped) tile.classList.add('equipped');
  tile.title = def.name + (it.power?` \u2014 ${it.power}`:'') + (it.equipped?' (equipped)':'');
  if(def.icon){
    const img = document.createElement('img');
    img.src = def.icon; img.alt = def.name; img.loading = 'lazy';
    tile.appendChild(img);
  }
  const dmg = FS_DMG[def.damageType];
  if(dmg && FS_WEAPON_BUCKETS.includes(def.bucketHash)){
    const e = el('div','elem'); e.style.background = dmg.c; tile.appendChild(e);
  }
  if(it.power){ tile.appendChild(el('div','pw', String(it.power))); }
  tile.onclick = (ev)=>{
    ev.stopPropagation();
    if(__fsJustDragged){ __fsJustDragged = false; return; } // suppress the tap-menu right after a drag-drop
    openFsItemMenu(ev, it, store, chars);
  };
  attachDragHandlers(tile, it, store);
  return tile;
}

let __fsJustDragged = false;

// Pointer-based drag-and-drop (not native HTML5 dragstart/drop) since
// native drag-and-drop is unreliable on mobile touch — pointer events work
// consistently across mouse and touch. Dragging an item onto a different
// character/vault column transfers it there, reusing the same fsDoMove
// logic the tap menu already uses.
let __fsDragState = null;
function attachDragHandlers(tile, it, store){
  if(it.equipped || !it.instanceId) return; // equipped/non-instanced items aren't draggable, same rule as the tap menu
  tile.style.touchAction = 'none';
  tile.addEventListener('pointerdown', (ev)=>{
    if(ev.button !== undefined && ev.button !== 0) return; // left-click / primary touch only
    __fsDragState = { it, store, startX: ev.clientX, startY: ev.clientY, dragging: false, ghost: null, pointerId: ev.pointerId };
  });
}
function fsHandlePointerMove(ev){
  if(!__fsDragState) return;
  const d = __fsDragState;
  const dx = ev.clientX - d.startX, dy = ev.clientY - d.startY;
  if(!d.dragging){
    if(Math.hypot(dx,dy) < 8) return; // small movement threshold before treating this as a drag, not a tap
    d.dragging = true;
    const ghost = el('div','fsDragGhost');
    if(d.it._def && d.it._def.icon){
      const img = document.createElement('img'); img.src = d.it._def.icon; ghost.appendChild(img);
    }
    document.body.appendChild(ghost);
    d.ghost = ghost;
    document.querySelectorAll('.fsItem').forEach(t=>{ if(t===ev.target || t.contains(ev.target)) t.classList.add('dragging'); });
  }
  d.ghost.style.left = (ev.clientX - 26) + 'px';
  d.ghost.style.top = (ev.clientY - 26) + 'px';
  document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget'));
  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  const storeCol = under && under.closest ? under.closest('.fsStore') : null;
  if(storeCol) storeCol.classList.add('dropTarget');
}
function fsHandlePointerUp(ev){
  if(!__fsDragState) return;
  const d = __fsDragState;
  if(d.dragging){
    __fsJustDragged = true;
    if(d.ghost) d.ghost.remove();
    document.querySelectorAll('.fsItem.dragging').forEach(t=>t.classList.remove('dragging'));
    document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget'));
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const storeCol = under && under.closest ? under.closest('.fsStore') : null;
    const targetKey = storeCol ? storeCol.getAttribute('data-drop-store-key') : null;
    const originKey = d.store.kind==='character' ? d.store.charId : 'vault';
    if(targetKey && targetKey !== originKey){
      if(targetKey === 'vault') fsDoMove(d.it, d.store, {toVault:true});
      else fsDoMove(d.it, d.store, {toCharacterId: targetKey});
    }
  }
  __fsDragState = null;
}
document.addEventListener('pointermove', fsHandlePointerMove);
document.addEventListener('pointerup', fsHandlePointerUp);
document.addEventListener('pointercancel', ()=>{ if(__fsDragState && __fsDragState.ghost) __fsDragState.ghost.remove(); document.querySelectorAll('.fsItem.dragging').forEach(t=>t.classList.remove('dragging')); document.querySelectorAll('.fsStore').forEach(s=>s.classList.remove('dropTarget')); __fsDragState = null; });


function openFsItemMenu(ev, it, store, chars){
  closeFsMenu();
  const def = it._def;
  const menu = el('div','fsMenu'); menu.id = 'fsMenu';
  const head = el('div','mHead');
  if(def.icon){ const img = document.createElement('img'); img.src = def.icon; head.appendChild(img); }
  head.appendChild(el('div','', `<div class="mn">${def.name}</div><div class="mt">${def.typeName||''}${it.power?` \u2022 \u25C8${it.power}`:''}</div>`));
  menu.appendChild(head);

  const detailsBtn = document.createElement('button');
  detailsBtn.textContent = 'View details';
  detailsBtn.setAttribute('data-testid','view-item-details-btn');
  detailsBtn.onclick = ()=>{ closeFsMenu(); openItemDetail(it); };
  menu.appendChild(detailsBtn);

  if(it.equipped){
    menu.appendChild(el('div','mNote','Equipped items must be unequipped in-game before they can be moved.'));
  } else if(!it.instanceId){
    menu.appendChild(el('div','mNote','This item is a stackable material/consumable and can\u2019t be moved here.'));
  } else {
    if(store.kind === 'character'){
      const b = document.createElement('button');
      b.textContent = '\u2192 Vault';
      b.setAttribute('data-testid','move-to-vault-btn');
      b.onclick = ()=>fsDoMove(it, store, {toVault:true});
      menu.appendChild(b);
    }
    chars.forEach(c=>{
      if(store.kind==='character' && c.charId===store.charId) return;
      const b = document.createElement('button');
      b.textContent = `\u2192 ${CLASS_TYPE_NAMES[c.classType]||'Character'}`;
      b.onclick = ()=>fsDoMove(it, store, {toCharacterId:c.charId});
      menu.appendChild(b);
    });
  }
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  let x = ev.clientX, y = ev.clientY + 8;
  if(x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
  if(y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
  menu.style.left = Math.max(8,x)+'px';
  menu.style.top = Math.max(8,y)+'px';
}

async function fsDoMove(it, store, dest){
  closeFsMenu();
  const mt = fsState.membershipType;
  try {
    fsToast('Moving ' + it._def.name + '...');
    if(dest.toVault){
      await transferItem({itemHash:it.hash, instanceId:it.instanceId, membershipType:mt, characterId:store.charId, direction:'toVault'});
    } else if(dest.toCharacterId){
      if(store.kind === 'vault'){
        await transferItem({itemHash:it.hash, instanceId:it.instanceId, membershipType:mt, characterId:dest.toCharacterId, direction:'toCharacter'});
      } else {
        await transferItem({itemHash:it.hash, instanceId:it.instanceId, membershipType:mt, characterId:store.charId, direction:'toVault'});
        await transferItem({itemHash:it.hash, instanceId:it.instanceId, membershipType:mt, characterId:dest.toCharacterId, direction:'toCharacter'});
      }
    }
    fsToast(it._def.name + ' moved.', 'ok');
    await loadFullScreenVault();
  } catch(err){
    fsToast('Transfer failed: ' + err.message, 'err');
  }
}

document.getElementById('fsCloseBtn').onclick = closeFullScreenVault;
document.getElementById('fsReloadBtn').onclick = ()=>{ fsState.stores=null; loadFullScreenVault(); };
document.getElementById('fsSearchInput').addEventListener('input', (e)=>{ fsState.search = e.target.value.trim(); renderFsBody(); });
document.addEventListener('click', (e)=>{ const m = document.getElementById('fsMenu'); if(m && !m.contains(e.target)) closeFsMenu(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && fsOverlay.classList.contains('open')) closeFullScreenVault(); });

