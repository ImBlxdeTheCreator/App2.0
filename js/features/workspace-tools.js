/* Lightweight Collections workspace. Uses shared bundled definitions immediately,
   then overlays live ownership when account data has already been resolved. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=v=>Array.isArray(v)?v:Object.values(v||{});
  const categories=[
    ['weapons','Weapons'],['exotics','Exotics'],['armor','Armor'],['customization','Customization']
  ];
  function nameOf(item){return item?.name||item?.displayProperties?.name||item?.label||'';}
  function iconOf(item){return item?.icon||item?.displayProperties?.icon||item?.iconWatermark||'';}
  function normalize(){
    const weapons=arr(window.WEAPONS||window.weapons).map(x=>({...x,__category:'weapons'}));
    const exotics=arr(window.EXOTIC_WEAPONS||window.EXOTICS||window.exotics).map(x=>({...x,__category:'exotics'}));
    const armor=[...arr(window.ARMOR||window.armor),...Object.values(window.EXOTIC_ARMOR||{}).flatMap(arr)].map(x=>({...x,__category:'armor'}));
    return [...weapons,...exotics,...armor].filter(x=>nameOf(x));
  }
  function ownership(item){
    const n=nameOf(item).toLowerCase();
    const ownedWeapons=Object.values(window.realWeaponsCache?.bySlot||{}).flat();
    const ownedArmor=Object.values(window.realGearCache?.armorBySlot||{}).flat();
    return [...ownedWeapons,...ownedArmor].some(x=>String(x?.name||'').toLowerCase()===n);
  }
  function renderCollections(panel){
    const all=normalize();let category=localStorage.getItem('d2_collections_category')||'weapons';
    panel.innerHTML=`<header class="workspaceToolHead"><div><span class="workspaceEyebrow">Guardian catalog</span><h2>Collections</h2><p>Browse definitions in a game-like catalog. Owned state is highlighted when Bungie account data is available.</p><div class="workspaceLocalStatus" id="collectionsSyncStatus" data-status-scope="collections" role="status" aria-live="polite"></div></div></header>
      <div class="collectionToolbar"><div class="collectionTabs">${categories.map(([id,label])=>`<button type="button" data-collection-category="${id}">${label}</button>`).join('')}</div>
      <input class="workspaceToolSearch" id="collectionSearch" placeholder="Search this collection"></div>
      <div class="collectionSubfilters" id="collectionSubfilters"></div><div class="collectionCount" id="collectionCount"></div><div class="collectionGrid" id="collectionGrid"></div>`;
    const grid=panel.querySelector('#collectionGrid'),count=panel.querySelector('#collectionCount'),search=panel.querySelector('#collectionSearch');
    const subs=panel.querySelector('#collectionSubfilters');
    let q='',owned='all';
    function draw(){
      panel.querySelectorAll('[data-collection-category]').forEach(b=>b.classList.toggle('active',b.dataset.collectionCategory===category));
      subs.innerHTML='<button data-owned="all">All</button><button data-owned="owned">Owned</button><button data-owned="missing">Unowned</button>';
      subs.querySelectorAll('[data-owned]').forEach(b=>{b.classList.toggle('active',b.dataset.owned===owned);b.onclick=()=>{owned=b.dataset.owned;draw();};});
      if(category==='customization'){
        grid.innerHTML='<div class="workspaceEmpty compact"><div><h3>Customization</h3><p>Shaders, emblems, Ghost shells, ships, and Sparrows require the full collectible catalog. This category will populate from Bungie collectible definitions rather than fabricated local entries.</p></div></div>';
        count.textContent='Bungie collectible catalog required';return;
      }
      const filtered=all.filter(item=>item.__category===category).filter(item=>!q||nameOf(item).toLowerCase().includes(q)).filter(item=>owned==='all'||(owned==='owned')===ownership(item));
      count.textContent=`${filtered.length} visible ${category}`;
      const visible=filtered.slice(0,240);
      grid.innerHTML=visible.map((item,index)=>{const own=ownership(item);return `<button class="collectionCard ${own?'owned':'unowned'}" type="button" data-collection-index="${index}"><span class="collectionImage"><img loading="lazy" decoding="async" alt=""></span><strong>${esc(nameOf(item))}</strong><span>${own?'Owned':'Not currently owned'}</span></button>`;}).join('')||'<p class="workspaceMuted">No matching definitions.</p>';
      grid.querySelectorAll('[data-collection-index]').forEach(card=>{const item=visible[Number(card.dataset.collectionIndex)];const img=card.querySelector('img');if(item&&img)D2Assets.setImage(img,item,item.__category==='armor'?'armor':'weapon',{alt:`${nameOf(item)} icon`});});
    }
    panel.querySelectorAll('[data-collection-category]').forEach(b=>b.onclick=()=>{category=b.dataset.collectionCategory;localStorage.setItem('d2_collections_category',category);draw();});
    search.addEventListener('input',()=>{q=search.value.trim().toLowerCase();draw();});draw();
  }
  function render(name){if(name!=='collections')return;const panel=document.querySelector('[data-workspace-panel="collections"]');if(panel){renderCollections(panel);queueMicrotask(()=>{window.D2Status?.set('collections',navigator.onLine?'cached':'offline',navigator.onLine?'Catalog ready; ownership uses latest account cache':'Catalog available offline',{preserveTime:true});window.D2Status?.render();});}}
  window.D2WorkspaceTools={render};
})();
