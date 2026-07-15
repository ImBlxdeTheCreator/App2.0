/* Useful first-pass content for previously empty workspaces. It only uses
   current local build state and curated definitions; it never fabricates live data. */
(function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function list(source){return Array.isArray(source)?source:Object.values(source||{});}
  function currentState(){return window.AppState||window.state||window.buildState||{};}
  function renderFireteam(panel){
    const s=currentState();
    const weapons=[s.kinetic,s.energy,s.power,s.primaryWeapon,s.specialWeapon,s.heavyWeapon].filter(Boolean);
    const effects=list(s.activeEffects||s.buffs||[]).map(x=>x?.name||x).filter(Boolean);
    panel.innerHTML=`<header class="workspaceToolHead"><div><span class="workspaceEyebrow">Build readiness</span><h2>Fireteam</h2><p>Coverage shown here comes only from the currently loaded build.</p></div></header>
      <div class="workspaceMetricGrid">
        <article><strong>${weapons.length}</strong><span>Weapon slots detected</span></article>
        <article><strong>${effects.length}</strong><span>Known active effects</span></article>
        <article><strong>${s.subclass?.name||s.subclass||'Not selected'}</strong><span>Current subclass</span></article>
      </div><div class="workspaceToolCard"><h3>Planning checklist</h3><div class="workspaceChecklist">
      <label><input type="checkbox"> Champion coverage confirmed</label><label><input type="checkbox"> Team survivability source assigned</label>
      <label><input type="checkbox"> Boss damage rotation assigned</label><label><input type="checkbox"> Add-clear role assigned</label></div></div>`;
  }
  function renderCollections(panel){
    const groups=[['Weapons',window.WEAPONS||window.weapons],['Exotics',window.EXOTICS||window.exotics],['Armor',window.ARMOR||window.armor]];
    panel.innerHTML=`<header class="workspaceToolHead"><div><span class="workspaceEyebrow">Curated build database</span><h2>Collections</h2><p>This browser reflects definitions bundled with D2Synergy. It does not claim account ownership until Bungie collection data is loaded.</p></div></header>
      <div class="workspaceMetricGrid">${groups.map(([name,data])=>`<article><strong>${list(data).length}</strong><span>${name} definitions</span></article>`).join('')}</div>
      <div class="workspaceToolCard"><h3>Search bundled definitions</h3><input class="workspaceToolSearch" id="collectionLocalSearch" placeholder="Search weapons, exotics, or armor"><div id="collectionLocalResults" class="workspaceLocalResults"></div></div>`;
    const input=panel.querySelector('#collectionLocalSearch'),out=panel.querySelector('#collectionLocalResults');
    const all=groups.flatMap(([group,data])=>list(data).map(item=>({group,name:item?.name||item?.displayProperties?.name||item?.label||''}))).filter(x=>x.name);
    const draw=()=>{const q=input.value.trim().toLowerCase();out.innerHTML=(q?all.filter(x=>x.name.toLowerCase().includes(q)).slice(0,80):all.slice(0,24)).map(x=>`<button type="button"><span>${esc(x.group)}</span><strong>${esc(x.name)}</strong></button>`).join('')||'<p class="workspaceMuted">No matching bundled definition.</p>';};
    input.addEventListener('input',draw);draw();
  }
  function renderFashion(panel){
    const s=currentState();const armor=[s.helmet,s.gauntlets,s.chest,s.legs,s.classItem].filter(Boolean);
    panel.innerHTML=`<header class="workspaceToolHead"><div><span class="workspaceEyebrow">Appearance workspace</span><h2>Fashion</h2><p>Equipped armor is shown when present. Shaders and ornaments will remain unclaimed until live cosmetic sockets are available.</p></div></header>
      <div class="workspaceToolCard"><h3>Current armor presentation</h3><div class="workspaceFashionGrid">${armor.length?armor.map(item=>`<article><strong>${esc(item.name||item.displayProperties?.name||'Equipped armor')}</strong><span>${esc(item.slot||item.type||'Armor')}</span></article>`).join(''):'<p class="workspaceMuted">Load or select armor in the Builder to populate this workspace.</p>'}</div></div>
      <div class="workspaceToolCard"><h3>Appearance notes</h3><textarea id="fashionNotes" placeholder="Save shader, ornament, and transmog ideas locally…"></textarea></div>`;
    const notes=panel.querySelector('#fashionNotes');notes.value=localStorage.getItem('d2synergy_fashion_notes')||'';notes.addEventListener('input',()=>localStorage.setItem('d2synergy_fashion_notes',notes.value));
  }
  function render(name){
    const panel=document.querySelector(`[data-workspace-panel="${name}"]`);if(!panel)return;
    if(panel.dataset.rendered==='1'&&name!=='fashion')return;
    if(name==='fireteam')renderFireteam(panel);else if(name==='collections')renderCollections(panel);else if(name==='fashion')renderFashion(panel);else return;
    panel.dataset.rendered='1';
  }
  window.D2WorkspaceTools={render};
})();
