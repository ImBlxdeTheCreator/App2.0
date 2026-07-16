/* Builder panels and controls
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   RENDER — BUILDER (left column)
   ========================================================================= */
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }

function isMeaningfulEquippedEntry(item){
  const name=String(item?.name||item||'').trim();
  return !!name&&!/^(empty|none|unknown|placeholder)/i.test(name)&&!/empty (fragment|aspect|socket)/i.test(name);
}

// Offline mode deliberately omits the Bungie account module. Keep empty
// account caches available so the shared Builder can render its manual data
// without depending on live-account globals.
if(typeof window.realWeaponsCache==='undefined')window.realWeaponsCache={fetchedAt:0,bySlot:{Kinetic:[],Energy:[],Power:[]}};
if(typeof window.realGearCache==='undefined')window.realGearCache={fetchedAt:0,weaponsBySlot:{Kinetic:[],Energy:[],Power:[]},armorBySlot:{Helmet:[],Arms:[],Chest:[],Legs:[],ClassItem:[]},artifactPerkHashes:[],artifactPowerBonus:0};


function appendLiveSubclassIconSummary(parent){
  const live = state.liveSubclass;
  if(!live) return;
  const entries = [
    {label:"Subclass", value:{name:live.name, hash:live.itemHash}, type:"ability"},
    {label:"Super", value:live.super, type:"super"},
    {label:"Class ability", value:live.classAbility, type:"classAbility"},
    {label:"Grenade", value:live.grenade, type:"grenade"},
    {label:"Melee", value:live.melee, type:"melee"},
    ...(live.aspects||[]).filter(isMeaningfulEquippedEntry).map(v=>({label:"Aspect",value:v,type:"aspect"})),
    ...(live.fragments||[]).filter(isMeaningfulEquippedEntry).map(v=>({label:"Fragment",value:v,type:"fragment"})),
  ].filter(entry=>entry.value && (entry.value.name || entry.value.hash || entry.value.icon));
  if(!entries.length) return;

  const wrap = el('div','liveManifestSummary');
  wrap.appendChild(el('div','liveManifestSummaryTitle','Live equipped subclass — official Bungie manifest icons'));
  const grid = el('div','liveManifestIconGrid');
  entries.forEach(entry=>{
    const card = el('div','liveManifestIconCard');
    const text = el('div','liveManifestIconText');
    text.appendChild(el('span','liveManifestIconLabel',entry.label));
    const name = typeof entry.value === 'string' ? entry.value : entry.value.name;
    text.appendChild(el('span','liveManifestIconName',name || 'Unknown'));
    card.appendChild(text);
    grid.appendChild(card);
    attachLiveIcon(card, entry.value, entry.type, {size:40});
  });
  wrap.appendChild(grid);
  parent.appendChild(wrap);
}

// Per-panel collapse state — persists across re-renders since renderBuilder()
// rebuilds the DOM from scratch every call. Clicking any panel's header
// toggles just that one panel, letting people focus on a single section.
// Same structural pattern as the Build Synergy / Character Stats accordions:
// a separate clickable header row, and a separate content div that gets
// .collapsed (display:none) toggled on it directly.
const PANEL_LABELS = {
  p1:"Class & Subclass", p2:"Exotic Armor", p3:"Exotic Weapon",
  p4:"Tiered Legendary Weapons", p5:"Armor Details", p6:"Seasonal Artifact",
};
const panelCollapsed = {p1:false,p2:true,p3:true,p4:true,p5:true,p6:false};
function makePanel(id, headerHTML, opts){
  const skipPanelClear = opts && opts.skipPanelClear;
  const header = el('div','accordionHead');
  header.id = 'panelHead_'+id;
  header.dataset.panelId=id;
  header.appendChild(el('h2','', headerHTML));
  if(!skipPanelClear){
    const clearBtn = el('button','panelClear','Clear');
    clearBtn.setAttribute('data-testid','clear-panel-'+id);
    clearBtn.title = 'Clear this section without resetting the whole build';
    clearBtn.onclick = (e)=>{ e.stopPropagation(); clearPanel(id); };
    header.appendChild(clearBtn);
  }
  const chev = el('span','chev'+(panelCollapsed[id]?'':' open'), '&#9656;');
  header.appendChild(chev);
  header.onclick = ()=>{ panelCollapsed[id] = !panelCollapsed[id]; render(); };
  const body = el('div','panel'+(panelCollapsed[id]?' collapsed':''));
  body.dataset.panelBody=id;
  return {header, body};
}
// Small reusable per-item clear button, placed next to a slot's own
// Generic/Real toggle instead of clearing the whole panel at once.
function makeItemClearBtn(onClear){
  const btn = document.createElement('button');
  btn.className = 'panelClear';
  btn.textContent = 'Clear';
  btn.style.marginLeft = '8px';
  btn.onclick = (e)=>{ e.stopPropagation(); onClear(); render(); };
  return btn;
}
// QoL: clear just one section's selections on the fly, instead of scrolling
// up to Reset Build and starting the whole loadout over.
function clearPanel(id){
  switch(id){
    case 'p1': state.aspects=[]; state.fragments=[]; state.grenade=null; state.melee=null; state.super=defaultSuperFor(state.cls,state.element); break;
    case 'p2': state.exoticArmor=null; state.exoticTuning=null; state.classItemPerks={col1:null,col2:null}; break;
    case 'p3': state.activeExoticWeapon=null; state.exoticWeaponMod={Kinetic:null,Energy:null,Power:null}; state.exoticWeaponMW={Kinetic:false,Energy:false,Power:false}; break;
    case 'p4': state.legendary={Kinetic:null,Energy:null,Power:null}; state.legendaryMode={Kinetic:"generic",Energy:"generic",Power:"generic"}; state.legendaryRealItem={Kinetic:null,Energy:null,Power:null}; break;
    case 'p5': state.mods={Helmet:[],Arms:[],Chest:[],Legs:[],ClassItem:[]}; state.tuning={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null}; break;
    case 'p6': state.artifact=null; state.artifactPerks=[]; break;
  }
  render();
}
function openPanel(id){
  panelCollapsed[id] = false;
  render(()=>{
    const headerEl = document.getElementById('panelHead_'+id);
    if(headerEl && headerEl.scrollIntoView) headerEl.scrollIntoView({behavior:'smooth', block:'start'});
  });
  closeDrawer();
}


const equipmentEditorState={open:false,panelId:null,slot:null,kind:null,hydrating:false};
function advancedItemTitle(kind,slot){
  const weaponLabels={Kinetic:'Primary',Energy:'Secondary',Power:'Heavy'};
  const armorLabels={Helmet:'Helmet',Arms:'Gauntlets',Chest:'Chest',Legs:'Legs',ClassItem:'Class Item'};
  if(kind==='armor'){const item=state.armorRealItem?.[slot];return item?.name||armorLabels[slot]||'Armor';}
  const active=state.liveExoticWeapon&&((EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon)||{}).slot===slot)?state.liveExoticWeapon:state.legendaryRealItem?.[slot]||state.legendary?.[slot];
  return active?.name||weaponLabels[slot]||'Weapon';
}
function stashAdvancedPanels(){
  const staging=document.getElementById('advancedPanelStaging');
  const builderRoot=document.getElementById('builderCol');
  const editorBody=document.getElementById('equipmentEditorBody');
  if(!staging||!builderRoot)return;
  // renderBuilder() creates fresh advanced panels on every render. Remove the
  // previous staged/editor copies first so querySelector never finds a stale,
  // collapsed panel from an earlier render.
  staging.replaceChildren();
  editorBody?.querySelectorAll('[data-panel-body]').forEach(node=>node.remove());
  ['p3','p4','p5'].forEach(id=>{
    const head=builderRoot.querySelector(`[data-panel-id="${id}"]`);
    const body=builderRoot.querySelector(`[data-panel-body="${id}"]`);
    if(head){head.hidden=true;staging.appendChild(head);}
    if(body){body.hidden=true;staging.appendChild(body);}
  });
}
function equipmentEditorItem(kind,slot){
  if(kind==='armor'){
    const real=state.armorRealItem?.[slot];
    if(real)return real;
    const exotic=state.exoticArmor&&EXOTIC_ARMOR[state.cls]?.find(a=>a.name===state.exoticArmor);
    const mapped=({Head:'Helmet',Arms:'Arms',Chest:'Chest',Legs:'Legs',ClassItem:'ClassItem'})[exotic?.piece];
    return mapped===slot?exotic:null;
  }
  const exotic=state.activeExoticWeapon&&EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon&&w.slot===slot);
  return exotic||state.legendaryRealItem?.[slot]||state.legendary?.[slot]||null;
}
function buildEquipmentEditorSummary(kind,slot){
  const current=equipmentEditorItem(kind,slot);
  const card=el('section','equipmentInspectorSummary');
  const hero=el('div','equipmentInspectorHero');
  const icon=el('div','equipmentInspectorIcon');hero.appendChild(icon);
  if(current&&typeof attachLiveIcon==='function')attachLiveIcon(icon,current,kind==='armor'?'armor':'weapon',{size:64});
  const copy=el('div','equipmentInspectorCopy');
  copy.appendChild(el('span','workspaceEyebrow',kind==='armor'?'Armor Planning':'Weapon Analysis'));
  copy.appendChild(el('h3','',current?.name||'Empty slot'));
  const meta=[];
  if(current?.isExotic||EXOTIC_WEAPONS.some(w=>w.name===current?.name)||EXOTIC_ARMOR[state.cls]?.some(a=>a.name===current?.name))meta.push('Exotic');
  else if(current)meta.push('Legendary');
  if(current?.element)meta.push(current.element);
  if(current?.power)meta.push(`Power ${current.power}`);
  copy.appendChild(el('div','equipmentInspectorMeta',meta.length?meta.join(' · '):'Choose an item below to configure this slot.'));
  hero.appendChild(copy);card.appendChild(hero);
  const facts=el('div','equipmentInspectorFacts');
  if(kind==='armor'){
    const real=state.armorRealItem?.[slot];
    const capacity=Number(real?.energyCapacity ?? (state.armorTier[slot]>=4?11:10));
    const mw=real?.isMasterworked?5:Number(state.armorMasterwork[slot]?.level||0);
    const setName=state.liveArmorSetByPiece?.[slot]?.name||state.armorSetByPiece?.[slot]||'None';
    facts.appendChild(el('div','equipmentInspectorFact',`<span>Mod capacity</span><b>${capacity}</b>`));
    facts.appendChild(el('div','equipmentInspectorFact',`<span>Masterwork</span><b>${real?.isMasterworked?'5/5 · Complete':`${mw}/5 · Planned`}</b>`));
    facts.appendChild(el('div','equipmentInspectorFact',`<span>Set bonus</span><b>${setName}</b>`));
    const statPairs=Object.values(real?.stats||{}).map(stat=>{
      const name=STAT_HASH_TO_NAME?.[stat.statHash];return name?`${name} ${stat.value}`:null;
    }).filter(Boolean);
    if(statPairs.length)facts.appendChild(el('div','equipmentInspectorFact wide',`<span>Item stats</span><b>${statPairs.join(' · ')}</b>`));
    const mods=[...(state.mods?.[slot]||[]),state.tuning?.[slot]].filter(Boolean);
    if(mods.length)facts.appendChild(el('div','equipmentInspectorFact wide',`<span>Equipped / planned mods</span><b>${mods.join(' · ')}</b>`));
  }else{
    const real=state.legendaryRealItem?.[slot];
    const selected=state.legendary?.[slot];
    const known=[];
    (real?.matchedPerks||[]).forEach(p=>known.push(p.name));
    (real?.unmatchedPlugNames||[]).forEach(name=>known.push(name));
    ['barrel','mag','perk1','perk2','originTrait','mod'].forEach(key=>{if(selected?.[key])known.push(selected[key]);});
    const intrinsic=current?.name&&WEAPON_INTRINSICS[current.name];if(intrinsic)known.unshift(intrinsic.perk);
    facts.appendChild(el('div','equipmentInspectorFact',`<span>Slot</span><b>${({Kinetic:'Primary',Energy:'Secondary',Power:'Heavy'})[slot]||slot}</b>`));
    facts.appendChild(el('div','equipmentInspectorFact',`<span>Masterwork</span><b>${real?.isMasterworked||selected?.masterworked||state.exoticWeaponMW?.[slot]?'Complete':'Not complete'}</b>`));
    if(known.length)facts.appendChild(el('div','equipmentInspectorFact wide',`<span>Socketed / selected perks</span><b>${[...new Set(known)].join(' · ')}</b>`));
  }
  card.appendChild(facts);
  card.appendChild(el('div','equipmentInspectorCoach',kind==='armor'?'Build Coach: planned mods and Masterwork levels update the local build only. Verified effects flow into the Synergy readout.':'Build Coach: exact equipped perks remain visible here. Only verified effects affect numerical Synergy totals; utility and conditional perks stay labeled.'));
  return card;
}

function syncEquipmentEditor(){
  const overlay=document.getElementById('equipmentEditorOverlay');
  const bodyHost=document.getElementById('equipmentEditorBody');
  if(!overlay||!bodyHost)return;
  if(!equipmentEditorState.open){
    equipmentEditorState.hydrating=false;
    overlay.classList.remove('open');
    overlay.hidden=true;
    overlay.setAttribute('aria-hidden','true');
    return;
  }
  const panel=document.querySelector(`#advancedPanelStaging [data-panel-body="${equipmentEditorState.panelId}"]`);
  if(!panel){
    // renderBuilder() rebuilds these advanced panels. If a queued render has
    // not finished yet, retry on the next frame instead of opening an empty
    // sheet or throwing.
    requestAnimationFrame(syncEquipmentEditor);
    return;
  }
  const collapsedPlaceholder=[...panel.querySelectorAll('.empty-note')].some(node=>/^Expand to load/i.test((node.textContent||'').trim()));
  if(collapsedPlaceholder && !equipmentEditorState.hydrating){
    equipmentEditorState.hydrating=true;
    panelCollapsed[equipmentEditorState.panelId]=false;
    render(()=>requestAnimationFrame(()=>{
      equipmentEditorState.hydrating=false;
      syncEquipmentEditor();
    }));
    return;
  }
  bodyHost.innerHTML='';
  panel.hidden=false;
  panel.classList.remove('collapsed');
  panel.querySelectorAll('[data-equipment-slot]').forEach(node=>{
    node.hidden=!!equipmentEditorState.slot&&node.dataset.equipmentSlot!==equipmentEditorState.slot;
  });
  bodyHost.appendChild(buildEquipmentEditorSummary(equipmentEditorState.kind,equipmentEditorState.slot));
  bodyHost.appendChild(panel);
  const title=advancedItemTitle(equipmentEditorState.kind,equipmentEditorState.slot);
  const titleEl=document.getElementById('equipmentEditorTitle');if(titleEl)titleEl.textContent=title;
  const eyebrow=document.getElementById('equipmentEditorEyebrow');if(eyebrow)eyebrow.textContent=equipmentEditorState.kind==='armor'?'Armor Details':'Weapon Details';
  const subtitle=document.getElementById('equipmentEditorSubtitle');if(subtitle)subtitle.textContent=equipmentEditorState.kind==='armor'?'Stats, mod capacity, masterwork, set bonus, and planned mods':'Perks, origin trait, masterwork, mod, and synergy details';
  overlay.hidden=false;
  overlay.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>overlay.classList.add('open'));
}
function openEquipmentEditor(kind,slot,panelId){
  equipmentEditorState.open=true;
  equipmentEditorState.kind=kind;
  equipmentEditorState.slot=slot;
  equipmentEditorState.panelId=panelId;
  equipmentEditorState.hydrating=false;
  panelCollapsed[panelId]=false;
  render(()=>requestAnimationFrame(()=>requestAnimationFrame(syncEquipmentEditor)));
}
function closeEquipmentEditor(){
  if(equipmentEditorState.panelId)panelCollapsed[equipmentEditorState.panelId]=true;
  equipmentEditorState.open=false;
  equipmentEditorState.hydrating=false;
  const overlay=document.getElementById('equipmentEditorOverlay');
  overlay?.classList.remove('open');
  setTimeout(()=>{if(overlay)overlay.hidden=true;},180);
  render();
}
window.openEquipmentEditor=openEquipmentEditor;
document.getElementById('equipmentEditorCloseBtn')?.addEventListener('click',closeEquipmentEditor);
document.getElementById('equipmentEditorOverlay')?.addEventListener('click',e=>{if(e.target.id==='equipmentEditorOverlay')closeEquipmentEditor();});

function renderAlwaysVisibleEquipment(root){
  const slotLabels={Kinetic:'Primary',Energy:'Secondary',Power:'Heavy'};
  const armorLabels={Helmet:'Helmet',Arms:'Gauntlets',Chest:'Chest',Legs:'Legs',ClassItem:'Class Item'};
  const weaponPanel=el('section','panel equipmentOverview');
  weaponPanel.appendChild(el('div','equipmentTitle','<span class="n">03</span> Weapons <span>Current slots remain visible · Change opens the filtered list</span>'));
  const weaponGrid=el('div','equipmentGrid weaponEquipmentGrid');
  ['Kinetic','Energy','Power'].forEach(slot=>{
    const card=el('article','equipmentSlotCard');
    card.appendChild(el('div','equipmentSlotName',slotLabels[slot]));
    const activeExotic=state.activeExoticWeapon && (EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon)||{}).slot===slot
      ? EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon) : null;
    const real=state.legendaryRealItem[slot];
    const generic=state.legendary[slot];
    const current=activeExotic || real || generic;
    const hero=el('div','equipmentCurrent');
    const icon=el('div','equipmentIcon'); hero.appendChild(icon);
    if(current) attachLiveIcon(icon,current,'weapon',{size:48});
    const copy=el('div','equipmentCopy');
    copy.appendChild(el('strong','',current?.name || 'Empty slot'));
    copy.appendChild(el('span','',current ? `${activeExotic?'Exotic':(real?.isExotic?'Exotic':'Legendary')} · ${current.element||''}${current.power?' · ◈'+current.power:''}` : 'Choose a weapon'));
    hero.appendChild(copy); card.appendChild(hero);

    const rarity=el('div','segmented compact');
    [['all','All'],['exotic','Exotic'],['legendary','Legendary']].forEach(([v,label])=>{
      const b=el('button',state.equipmentRarityFilter[slot]===v?'active':'',label);
      b.type='button'; b.onclick=()=>{state.equipmentRarityFilter[slot]=v;render();}; rarity.appendChild(b);
    }); card.appendChild(rarity);

    const select=el('select','equipmentSelect');
    select.appendChild(new Option('— Choose weapon —',''));
    const rarityValue=state.equipmentRarityFilter[slot]||'all';
    const owned=(realWeaponsCache.bySlot[slot]||[]).filter(w=>rarityValue==='all'||(rarityValue==='exotic'?w.isExotic:!w.isExotic));
    owned.forEach(w=>{ const o=new Option(`${w.name} · ${w.element}${w.power?' · ◈'+w.power:''}`,'owned:'+w.instanceId); if(real?.instanceId===w.instanceId)o.selected=true; select.appendChild(o); });
    if(rarityValue!=='legendary') EXOTIC_WEAPONS.filter(w=>w.slot===slot).forEach(w=>{ if(owned.some(o=>liveNameMatches(o.name,w.name)))return; const o=new Option(`${w.name} · ${effectiveExoticWeaponElement(w)} · Exotic`,'exotic:'+w.name); if(activeExotic?.name===w.name)o.selected=true; select.appendChild(o); });
    select.onchange=()=>{
      const [kind,...rest]=select.value.split(':'); const value=rest.join(':');
      if(!value)return;
      if(kind==='owned'){
        const item=(realWeaponsCache.bySlot[slot]||[]).find(w=>w.instanceId===value); if(!item)return;
        if(item.isExotic){ state.activeExoticWeapon=item.name; state.liveExoticWeapon=item; state.legendaryRealItem[slot]=null; }
        else { if(activeExotic) state.activeExoticWeapon=null; selectRealWeapon(slot,item); return; }
      } else if(kind==='exotic') { state.activeExoticWeapon=value; state.legendaryRealItem[slot]=null; validateSelectedExoticWeaponElement(value); }
      render();
    };
    card.appendChild(select);
    const edit=el('button','equipmentEdit','Perks, stats &amp; mods'); edit.type='button'; edit.onclick=()=>openEquipmentEditor('weapon',slot,activeExotic?'p3':'p4'); card.appendChild(edit);
    weaponGrid.appendChild(card);
  });
  weaponPanel.appendChild(weaponGrid); root.appendChild(weaponPanel);

  const armorPanel=el('section','panel equipmentOverview');
  armorPanel.appendChild(el('div','equipmentTitle','<span class="n">04</span> Armor <span>Equipped piece, planned mods and masterwork capacity</span>'));
  const armorGrid=el('div','equipmentGrid armorEquipmentGrid');
  ['Helmet','Arms','Chest','Legs','ClassItem'].forEach(slot=>{
    const card=el('article','equipmentSlotCard armorSlotCard'); card.appendChild(el('div','equipmentSlotName',armorLabels[slot]));
    const real=state.armorRealItem[slot];
    const current=real || ((state.exoticArmor && (({Head:'Helmet',Arms:'Arms',Chest:'Chest',Legs:'Legs',ClassItem:'ClassItem'})[(EXOTIC_ARMOR[state.cls].find(a=>a.name===state.exoticArmor)||{}).piece]===slot)) ? EXOTIC_ARMOR[state.cls].find(a=>a.name===state.exoticArmor) : null);
    const hero=el('div','equipmentCurrent'); const icon=el('div','equipmentIcon'); hero.appendChild(icon); if(current)attachLiveIcon(icon,current,'armor',{size:48});
    const copy=el('div','equipmentCopy'); copy.appendChild(el('strong','',current?.name||'Empty slot')); copy.appendChild(el('span','',real?`${real.isExotic?'Exotic':'Legendary'}${real.power?' · ◈'+real.power:''}`:'Choose armor')); hero.appendChild(copy); card.appendChild(hero);
    const select=el('select','equipmentSelect'); select.appendChild(new Option(realGearCache.fetchedAt?'— Choose owned armor —':'— Sign in or sync to load owned armor —',''));
    (realGearCache.armorBySlot[slot]||[]).filter(a=>(state.armorRarityFilter[slot]||'all')==='all'||((state.armorRarityFilter[slot]==='exotic')===!!a.isExotic)).forEach(a=>{const o=new Option(`${a.name}${a.power?' · ◈'+a.power:''}`,a.instanceId);if(real?.instanceId===a.instanceId)o.selected=true;select.appendChild(o);});
    select.onchange=()=>{const item=(realGearCache.armorBySlot[slot]||[]).find(a=>a.instanceId===select.value);if(item)selectRealArmor(slot,item);}; card.appendChild(select);
    const mods=(state.mods[slot]||[]).filter(Boolean);
    const modSummary=el('div','equipmentModSummary');
    modSummary.textContent=mods.length?mods.join(' · '):(real?.matchedMods===undefined&&real?'Resolving equipped mods…':real?.matchedMods?.length?real.matchedMods.map(m=>m.name).join(' · '):'No mods equipped or planned');
    card.appendChild(modSummary);
    const liveSet=state.liveArmorSetByPiece?.[slot]; const plannedSet=state.armorSetByPiece?.[slot]; const setName=liveSet?.name||plannedSet||'';
    const counts={};Object.values({...state.armorSetByPiece,...Object.fromEntries(Object.entries(state.liveArmorSetByPiece||{}).map(([k,v])=>[k,v?.name]))}).forEach(n=>{if(n)counts[n]=(counts[n]||0)+1;});
    const count=setName?(counts[setName]||1):0;const setDef=(window.ARMOR_SETS||[]).find(x=>x.name===setName);
    const setStatus=setName?(setDef?`${setName} · ${count}/4 · ${count>=4?'4-piece active':count>=2?'2-piece active':`need ${2-count} more`}`:`${setName} · ${count} piece${count===1?'':'s'}`):'No set bonus detected';
    const capacity=Number(real?.energyCapacity ?? (state.armorTier[slot]>=4?11:10));
    const mwLevel=real?.isMasterworked?5:Number(state.armorMasterwork[slot]?.level||0);
    const statusGrid=el('div','armorStatusGrid');
    statusGrid.appendChild(el('div','armorStatusCell',`<span>Mod capacity</span><b>${capacity}</b>`));
    statusGrid.appendChild(el('div',`armorStatusCell ${mwLevel===5?'good':''}`,`<span>Masterwork</span><b>${mwLevel?`Level ${mwLevel}`:'Not masterworked'}</b>`));
    statusGrid.appendChild(el('div',`armorStatusCell ${count>=2?'good':''}`,`<span>Set bonus</span><b>${setStatus}</b>`));
    card.appendChild(statusGrid);
    const edit=el('button','equipmentEdit','Open armor details');edit.type='button';edit.onclick=()=>openEquipmentEditor('armor',slot,'p5');card.appendChild(edit);
    armorGrid.appendChild(card);
  });
  armorPanel.appendChild(armorGrid); root.appendChild(armorPanel);
}

function renderBuilder(){
  const root = document.getElementById('builderCol');
  root.innerHTML = "";

  // Class + Element panel
  const {header: p1Head, body: p1} = makePanel('p1', '<span class="n">01</span> Class &amp; Subclass');
  root.appendChild(p1Head);
  const clsRow=el('div','row builderClassRow');
  const hasLiveGuardian=!!(typeof liveSyncState!=='undefined'&&liveSyncState.characters?.length&&state.selectedCharId);
  if(hasLiveGuardian){
    const badge=el('div','selectedGuardianClass',`<span>Selected Guardian</span><strong>${state.cls}</strong>`);
    badge.title='Change characters with the emblem cards across the top.';clsRow.appendChild(badge);
  }else{
    const clsSel=el('select');clsSel.setAttribute('aria-label','Manual Guardian class');
    ["Titan","Hunter","Warlock"].forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===state.cls)o.selected=true;clsSel.appendChild(o);});
    clsSel.onchange=()=>{state.cls=clsSel.value;state.aspects=[];state.exoticArmor=null;state.exoticTuning=null;state.classItemPerks={col1:null,col2:null};state.super=defaultSuperFor(state.cls,state.element);state.melee=null;render();};
    clsRow.appendChild(clsSel);
  }
  p1.appendChild(clsRow);

  const tabs = el('div','subclasstabs');
  ELEMENTS.forEach(elem=>{
    const b = document.createElement('button');
    b.textContent = elem;
    if(elem===state.element){ b.classList.add('active'); b.style.background=ELEMENT_COLOR[elem]; b.style.color="#0a0c0f"; b.style.borderColor=ELEMENT_COLOR[elem]; }
    b.onclick=()=>{ state.element=elem; state.aspects=[]; state.fragments=[]; state.super=defaultSuperFor(state.cls,elem); state.grenade=null; state.melee=null; render(); };
    tabs.appendChild(b);
  });
  p1.appendChild(document.createElement('div')).style.height="10px";
  p1.appendChild(tabs);
  appendLiveSubclassIconSummary(p1);

  const sc = SUBCLASSES[state.cls][state.element];

  p1.appendChild(el('div','', '<div style="font-size:11px;color:var(--muted);margin:2px 0 6px;text-transform:uppercase;letter-spacing:.06em;">Super <span style="color:var(--muted2);text-transform:none;">(pick one)</span></div>'));
  const superGrid = el('div','chipgrid');
  (sc.supers||[]).forEach(s=>{
    const active = state.super===s.name;
    const chip = el('div','chip'+(active?' active':''), `<span class="nm">${s.name}</span><span class="desc">${s.effects.map(e=>e.note||BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')).join(', ')}</span>`);
    chip.style.setProperty('--accent', ELEMENT_COLOR[state.element]);
    chip.onclick=()=>{ state.super = s.name; render(); };
    superGrid.appendChild(chip);
    attachLiveIcon(chip, s, 'super', {size:36});
  });
  p1.appendChild(superGrid);
  p1.appendChild(document.createElement('div')).style.height="6px";

  const aspectGrid = el('div','chipgrid');
  sc.aspects.forEach(a=>{
    const active = state.aspects.includes(a.name);
    const chip = el('div','chip'+(active?' active':''), `<span class="nm">${a.name}</span><span class="desc">${a.effects.map(e=>e.note||BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%').join(', ')}</span>`);
    chip.style.setProperty('--accent', ELEMENT_COLOR[state.element]);
    chip.onclick=()=>{
      if(active){ state.aspects=state.aspects.filter(x=>x!==a.name); }
      else { if(state.aspects.length>=2) state.aspects.shift(); state.aspects.push(a.name); }
      render();
    };
    aspectGrid.appendChild(chip);
    attachLiveIcon(chip, a, 'aspect', {size:36});
  });
  p1.appendChild(el('div','', '<div style="font-size:11px;color:var(--muted);margin:8px 0 2px;text-transform:uppercase;letter-spacing:.06em;">Aspects (max 2)</div>'));
  p1.appendChild(aspectGrid);

  // Grenade + Melee — Prismatic can pull from any element's pool for both;
  // other elements are locked to their own grenade pool and this class's
  // melee for that element.
  const grenadeOptions = state.element==="Prismatic"
    ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>GRENADES[e])
    : (GRENADES[state.element]||[]);
  const meleeOptions = state.element==="Prismatic"
    ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>MELEES[state.cls][e])
    : (MELEES[state.cls][state.element]||[]);

  const abilityRow = el('div','row');
  abilityRow.style.display='flex'; abilityRow.style.gap='10px'; abilityRow.style.margin='8px 0';

  const grenadeWrap = el('div',''); grenadeWrap.style.flex='1';
  grenadeWrap.appendChild(el('div','', '<div style="font-size:11px;color:var(--muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.06em;">Grenade</div>'));
  const grenadeSel = el('select');
  const gNone = document.createElement('option'); gNone.value=""; gNone.textContent="— none —"; grenadeSel.appendChild(gNone);
  grenadeOptions.forEach(g=>{
    const o=document.createElement('option'); o.value=g.name; o.textContent=g.name;
    if(state.grenade===g.name) o.selected=true;
    grenadeSel.appendChild(o);
  });
  grenadeSel.onchange=()=>{ state.grenade = grenadeSel.value||null; render(); };
  grenadeWrap.appendChild(grenadeSel);
  abilityRow.appendChild(grenadeWrap);

  const meleeWrap = el('div',''); meleeWrap.style.flex='1';
  meleeWrap.appendChild(el('div','', '<div style="font-size:11px;color:var(--muted);margin-bottom:2px;text-transform:uppercase;letter-spacing:.06em;">Melee</div>'));
  const meleeSel = el('select');
  const mNone = document.createElement('option'); mNone.value=""; mNone.textContent="— none —"; meleeSel.appendChild(mNone);
  meleeOptions.forEach(m=>{
    const o=document.createElement('option'); o.value=m.name; o.textContent=m.name;
    if(state.melee===m.name) o.selected=true;
    meleeSel.appendChild(o);
  });
  meleeSel.onchange=()=>{ state.melee = meleeSel.value||null; render(); };
  meleeWrap.appendChild(meleeSel);
  abilityRow.appendChild(meleeWrap);

  p1.appendChild(abilityRow);

  if(state.grenade){
    const g = grenadeOptions.find(x=>x.name===state.grenade);
    if(g){
      const note = el('div','empty-note', `${g.name}: ${g.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', ')}`);
      note.style.fontStyle='normal'; note.style.marginBottom='4px';
      p1.appendChild(note);
      attachLiveIcon(note, state.liveSubclass?.grenade || g, 'grenade', {size:36});
    }
  }
  if(state.melee){
    const m = meleeOptions.find(x=>x.name===state.melee);
    if(m){
      const note = el('div','empty-note', `${m.name}: ${m.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', ')}`);
      note.style.fontStyle='normal'; note.style.marginBottom='8px';
      p1.appendChild(note);
      attachLiveIcon(note, state.liveSubclass?.melee || m, 'melee', {size:36});
    }
  }
  if(state.classAbility){
    const liveClass = state.liveSubclass?.classAbility || {name:state.classAbility};
    const note = el('div','empty-note', `<b style="font-style:normal;color:var(--gold);">Class ability:</b> ${state.classAbility}`);
    note.style.fontStyle='normal'; note.style.marginBottom='8px';
    p1.appendChild(note);
    attachLiveIcon(note, liveClass, 'classAbility', {size:36});
  }

  // Match manifest names without requiring punctuation/casing to be identical.
  // This is especially important for live Prismatic Facets and localized names.
  const fragmentNameKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[’'`]/g,'').replace(/[–—]/g,'-').replace(/\s*\([^)]*\)\s*/g,' ')
    .replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
  const fragmentNamesMatch=(a,b)=>{
    const left=fragmentNameKey(a),right=fragmentNameKey(b);
    return !!left&&!!right&&(left===right||left.startsWith(right+' ')||right.startsWith(left+' '));
  };
  const meaningfulFragment=isMeaningfulEquippedEntry;
  state.fragments=(state.fragments||[]).filter(meaningfulFragment);
  const liveFragmentObjects=(state.liveSubclass?.fragments||[]).filter(meaningfulFragment);
  const equippedAspectDefs=sc.aspects.filter(aspect=>state.aspects.some(name=>fragmentNamesMatch(aspect.name,name)));
  const calculatedSlots=equippedAspectDefs.reduce((sum,aspect)=>sum+(aspect.fragSlots||2),0);
  // Never delete exact live sockets merely because the curated table has not
  // yet learned a newly renamed Aspect. Manual builds still honor their cap.
  const maxFragments=calculatedSlots||Math.max(state.fragments.length,2);
  if(!state.liveSubclass&&state.fragments.length>maxFragments){
    state.fragments=state.fragments.slice(state.fragments.length-maxFragments);
  }

  const fragGrid=el('div','chipgrid');
  const curatedFragments=FRAGMENTS[state.element]||[];
  curatedFragments.forEach(f=>{
    const active=state.fragments.some(name=>fragmentNamesMatch(name,f.name));
    const liveMatch=liveFragmentObjects.find(item=>fragmentNamesMatch(item.name,f.name));
    const chip=el('div','chip'+(active?' active equippedFragment':''), `<span class="nm">${f.name}${liveMatch?'<span class="liveEquippedTag">Equipped</span>':''}</span><span class="desc">${f.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')).join(', ')}</span>`);
    chip.style.setProperty('--accent',ELEMENT_COLOR[state.element]);
    chip.onclick=()=>{
      if(active){state.fragments=state.fragments.filter(name=>!fragmentNamesMatch(name,f.name));}
      else{if(state.fragments.length>=maxFragments)state.fragments.shift();state.fragments.push(f.name);}
      // Any manual edit intentionally detaches the exact live snapshot.
      state.liveSubclass=null;
      render();
    };
    fragGrid.appendChild(chip);
    attachLiveIcon(chip,liveMatch||f,'fragment',{size:34});
  });
  // Preserve exact equipped fragments that do not yet exist in the curated
  // synergy table, rather than silently making them disappear from the tree.
  liveFragmentObjects.filter(item=>!curatedFragments.some(f=>fragmentNamesMatch(f.name,item.name))).forEach(item=>{
    const chip=el('div','chip active equippedFragment liveOnlyFragment',`<span class="nm">${item.name}<span class="liveEquippedTag">Equipped</span></span><span class="desc">Exact socket from the selected Guardian.</span>`);
    chip.style.setProperty('--accent',ELEMENT_COLOR[state.element]);
    chip.title='This equipped fragment is live from Bungie but is not yet mapped in the curated synergy table.';
    fragGrid.appendChild(chip);
    attachLiveIcon(chip,item,'fragment',{size:34});
  });
  const equippedCount=state.fragments.length;
  p1.appendChild(el('div','', `<div style="font-size:11px;color:var(--muted);margin:10px 0 2px;text-transform:uppercase;letter-spacing:.06em;">Fragments (${equippedCount}/${maxFragments} equipped — exact live sockets highlighted)</div>`));
  p1.appendChild(fragGrid);
  root.appendChild(p1);

  // Exotic Armor
  const {header: p2Head, body: p2} = makePanel('p2', '<span class="n">02</span> Exotic Armor');
  root.appendChild(p2Head);

  const isPrismatic = state.element === "Prismatic";
  const filterRow = el('div','row');
  filterRow.style.marginBottom='10px';
  const filterSel = el('select');
  const filterOptions = [
    {value:"synergy", label: isPrismatic ? "All (Prismatic blends every subclass)" : `Synergy: ${state.element} + Universal`},
    {value:"all", label:"All Exotics"},
    {value:"Arc", label:"Arc burn"},
    {value:"Solar", label:"Solar burn"},
    {value:"Void", label:"Void burn"},
    {value:"Stasis", label:"Stasis burn"},
    {value:"Strand", label:"Strand burn"},
    {value:"Any", label:"Universal / Kinetic (Any)"},
  ];
  filterOptions.forEach(opt=>{
    const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label;
    if(state.armorFilter===opt.value) o.selected=true;
    filterSel.appendChild(o);
  });
  filterSel.onchange=()=>{ state.armorFilter = filterSel.value; render(); };
  filterRow.appendChild(filterSel);
  p2.appendChild(filterRow);

  const allArmor = EXOTIC_ARMOR[state.cls];
  let burnFiltered;
  if(state.armorFilter==="all"){
    burnFiltered = allArmor;
  } else if(state.armorFilter==="synergy"){
    burnFiltered = isPrismatic ? allArmor : allArmor.filter(a=>a.synergy.includes(state.element)||a.synergy.includes("Any"));
  } else if(state.armorFilter==="Any"){
    burnFiltered = allArmor.filter(a=>a.synergy.includes("Any"));
  } else {
    burnFiltered = allArmor.filter(a=>a.synergy.includes(state.armorFilter)||a.synergy.includes("Any"));
  }

  const pieceLabels = {Head:"Head", Arms:"Arms", Chest:"Chest", Legs:"Legs", ClassItem:"Class Item"};
  const pieceOrder = isPrismatic ? ["Head","Arms","Chest","Legs","ClassItem"] : ["Head","Arms","Chest","Legs"];
  const activeArmorPiece = state.exoticArmor ? (allArmor.find(a=>a.name===state.exoticArmor)||{}).piece : null;
  pieceOrder.forEach(piece=>{
    const piecesForSlot = burnFiltered.filter(a=>a.piece===piece);
    const isLockedOut = activeArmorPiece && activeArmorPiece !== piece;
    const row = el('div','slotrow');
    row.style.marginBottom='8px';
    if(isLockedOut) row.style.opacity='0.4';
    row.appendChild(el('label','',pieceLabels[piece]));
    const selectedForPiece = state.exoticArmor && activeArmorPiece===piece ? allArmor.find(a=>a.name===state.exoticArmor) : null;
    if(selectedForPiece){
      const iconSlot = el('span','selectIconSlot');
      row.appendChild(iconSlot);
      const source = state.liveExoticArmor && liveNameMatches(state.liveExoticArmor.name, selectedForPiece.name) ? state.liveExoticArmor : selectedForPiece;
      attachLiveIcon(iconSlot, source, 'armor', {size:38});
    }
    const sel = el('select');
    sel.disabled = isLockedOut;
    const noneOpt = document.createElement('option'); noneOpt.value=""; noneOpt.textContent= isLockedOut ? "— locked (exotic equipped elsewhere) —" : "— none —"; sel.appendChild(noneOpt);
    piecesForSlot.forEach(a=>{
      const o=document.createElement('option'); o.value=a.name; o.textContent=a.name;
      if(state.exoticArmor===a.name) o.selected=true;
      sel.appendChild(o);
    });
    sel.onchange=()=>{ state.exoticArmor = sel.value || null; render(); };
    row.appendChild(sel);
    p2.appendChild(row);
  });

  const chosenArmor = allArmor.find(a=>a.name===state.exoticArmor);
  if(state.liveExoticArmor && !chosenArmor){
    const liveCard = el('div','liveManifestStandaloneCard');
    liveCard.appendChild(el('div','', `<b style="color:#ceae33;">${state.liveExoticArmor.name}</b><br><span style="color:var(--muted);font-size:11px;">Equipped exotic armor from the live manifest; no curated synergy entry exists yet.</span>`));
    p2.appendChild(liveCard);
    attachLiveIcon(liveCard, state.liveExoticArmor, 'armor', {size:48});
  }
  const classItemPool = EXOTIC_CLASS_ITEM_PERKS[state.cls];
  const isClassItemChosen = chosenArmor && classItemPool && chosenArmor.name === classItemPool.name;

  if(chosenArmor && !isClassItemChosen){
    const tagColor = chosenArmor.synergy.includes("Any") ? "var(--muted)" : ELEMENT_COLOR[chosenArmor.synergy[0]];
    const note = el('div','empty-note', `<span style="color:${tagColor};">[${chosenArmor.synergy.join('/')}]</span> ${chosenArmor.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', ')}`);
    note.style.fontStyle='normal'; note.style.marginTop='6px';
    p2.appendChild(note);
    attachLiveIcon(note, state.liveExoticArmor || chosenArmor, 'armor', {size:42});
  }

  if(isClassItemChosen){
    const perkNote = el('div','', `<div style="font-size:11px;color:var(--muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">${classItemPool.name} — pick 2 perks (one per column)</div>`);
    p2.appendChild(perkNote);
    attachLiveIcon(perkNote, state.liveExoticArmor || chosenArmor, 'armor', {size:42});

    const col1Row = el('div','slotrow');
    col1Row.style.marginBottom='6px';
    col1Row.appendChild(el('label','','Perk 1'));
    const col1Sel = el('select');
    const none1 = document.createElement('option'); none1.value=""; none1.textContent="— none —"; col1Sel.appendChild(none1);
    classItemPool.column1.forEach(p=>{
      const o=document.createElement('option'); o.value=p.name; o.textContent=p.name;
      if(state.classItemPerks.col1===p.name) o.selected=true;
      col1Sel.appendChild(o);
    });
    col1Sel.onchange=()=>{ state.classItemPerks.col1 = col1Sel.value || null; render(); };
    col1Row.appendChild(col1Sel);
    p2.appendChild(col1Row);
    const p1chosen = classItemPool.column1.find(p=>p.name===state.classItemPerks.col1);
    if(p1chosen){
      const d1 = el('div','empty-note', p1chosen.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', '));
      d1.style.margin='2px 0 8px'; d1.style.marginLeft='86px';
      p2.appendChild(d1);
    }

    const col2Row = el('div','slotrow');
    col2Row.style.marginBottom='6px';
    col2Row.appendChild(el('label','','Perk 2'));
    const col2Sel = el('select');
    const none2 = document.createElement('option'); none2.value=""; none2.textContent="— none —"; col2Sel.appendChild(none2);
    classItemPool.column2.forEach(p=>{
      const o=document.createElement('option'); o.value=p.name; o.textContent=p.name;
      if(state.classItemPerks.col2===p.name) o.selected=true;
      col2Sel.appendChild(o);
    });
    col2Sel.onchange=()=>{ state.classItemPerks.col2 = col2Sel.value || null; render(); };
    col2Row.appendChild(col2Sel);
    p2.appendChild(col2Row);
    const p2chosen = classItemPool.column2.find(p=>p.name===state.classItemPerks.col2);
    if(p2chosen){
      const d2 = el('div','empty-note', p2chosen.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', '));
      d2.style.margin='2px 0 8px'; d2.style.marginLeft='86px';
      p2.appendChild(d2);
    }
  }

  // Exotic Armor Tuning — every Exotic armor piece can equip any tuning option.
  if(chosenArmor){
    const tuneWrap = el('div','');
    tuneWrap.style.marginTop = '10px';
    tuneWrap.appendChild(el('div','', `<div style="font-size:11px;color:var(--gold);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">Exotic Tuning</div>`));
    const etRow = el('div','slotrow');
    etRow.appendChild(el('label','','Tuning'));
    const etSel = el('select');
    etSel.setAttribute('data-testid','exotic-tuning-select');
    const noneEt = document.createElement('option'); noneEt.value=""; noneEt.textContent="— no tuning —"; etSel.appendChild(noneEt);
    EXOTIC_TUNING_OPTIONS.forEach(t=>{
      const o=document.createElement('option'); o.value=t.name; o.textContent=t.name;
      if(state.exoticTuning===t.name) o.selected=true;
      etSel.appendChild(o);
    });
    etSel.onchange=()=>{ state.exoticTuning = etSel.value || null; render(); };
    etRow.appendChild(etSel);
    tuneWrap.appendChild(etRow);
    const chosenEt = EXOTIC_TUNING_OPTIONS.find(t=>t.name===state.exoticTuning);
    if(chosenEt){
      const deltas = parseTuningStatDeltas(chosenEt.name);
      const dtxt = Object.entries(deltas).map(([s,v])=>`${v>=0?'+':''}${v} ${s}`).join(', ') || 'balanced';
      const etNote = el('div','empty-note', `Stat change: ${dtxt}`);
      etNote.style.margin='4px 0 0'; etNote.style.marginLeft='86px';
      tuneWrap.appendChild(etNote);
    }
    p2.appendChild(tuneWrap);
  }

  if(!isPrismatic){
    const hint = el('div','empty-note', 'Exotic Class Items are Prismatic-only — switch to the Prismatic tab above to see that slot.');
    hint.style.marginTop='8px';
    p2.appendChild(hint);
  }
  root.appendChild(p2);

  renderAlwaysVisibleEquipment(root);

  // Advanced weapon configuration — kept collapsed so the always-visible slots stay fast and uncluttered.
  // Exotic Weapon — one dropdown per slot; picking one clears the others
  // since only a single exotic weapon can be equipped at a time.
  const {header: p3Head, body: p3} = makePanel('p3', '<span class="n">03</span> Exotic Weapon <span style="color:var(--muted2);font-family:Inter;text-transform:none;font-size:11px;">(one equipped, any slot)</span>');
  root.appendChild(p3Head);

  const slotLabels = {Kinetic:"Primary (Kinetic)", Energy:"Secondary (Energy)", Power:"Heavy (Power)"};
  const burnFilterOptions = [
    {value:"all", label:"All burns"},
    {value:"Kinetic", label:"Kinetic"},
    {value:"Arc", label:"Arc"},
    {value:"Solar", label:"Solar"},
    {value:"Void", label:"Void"},
    {value:"Stasis", label:"Stasis"},
    {value:"Strand", label:"Strand"},
  ];
  ["Kinetic","Energy","Power"].forEach(slot=>{
    const wrap = el('div','');
    wrap.dataset.equipmentSlot=slot;
    wrap.style.marginBottom="12px";
    wrap.appendChild(el('div','', `<div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">${slotLabels[slot]}</div>`));

    const activeExoticSlot = state.activeExoticWeapon ? (EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon)||{}).slot : null;
    const isLockedOut = activeExoticSlot && activeExoticSlot !== slot;
    if(isLockedOut) wrap.style.opacity='0.4';

    const filterRow = el('div','row');
    filterRow.style.marginBottom='6px';
    const filterSel = el('select');
    filterSel.disabled = isLockedOut;
    burnFilterOptions.forEach(opt=>{
      const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label;
      if(state.exoticWeaponFilter[slot]===opt.value) o.selected=true;
      filterSel.appendChild(o);
    });
    filterSel.onchange=()=>{ state.exoticWeaponFilter[slot] = filterSel.value; render(); };
    filterRow.appendChild(filterSel);
    wrap.appendChild(filterRow);

    const row = el('div','slotrow');
    const selectedWeaponForSlot = state.activeExoticWeapon ? EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon && w.slot===slot) : null;
    if(selectedWeaponForSlot){
      const iconSlot = el('span','selectIconSlot');
      row.appendChild(iconSlot);
      const source = state.liveExoticWeapon && liveNameMatches(state.liveExoticWeapon.name, selectedWeaponForSlot.name) ? state.liveExoticWeapon : selectedWeaponForSlot;
      attachLiveIcon(iconSlot, source, 'weapon', {size:40});
    }
    const sel = el('select');
    sel.disabled = isLockedOut;
    const noneOpt = document.createElement('option'); noneOpt.value=""; noneOpt.textContent= isLockedOut ? "— locked (exotic equipped elsewhere) —" : "— none —"; sel.appendChild(noneOpt);
    const burnFilter = state.exoticWeaponFilter[slot];
    EXOTIC_WEAPONS.filter(w=>w.slot===slot && (burnFilter==="all" || effectiveExoticWeaponElement(w)===burnFilter)).forEach(w=>{
      const o=document.createElement('option'); o.value=w.name; o.textContent=`${w.name} (${w.element})`;
      if(state.activeExoticWeapon===w.name) o.selected=true;
      sel.appendChild(o);
    });
    sel.onchange=()=>{ state.activeExoticWeapon = sel.value || null; render(); if(sel.value) validateSelectedExoticWeaponElement(sel.value); };
    row.appendChild(sel);
    wrap.appendChild(row);
    p3.appendChild(wrap);
  });
  if(state.liveExoticWeapon && !state.activeExoticWeapon){
    const liveCard = el('div','liveManifestStandaloneCard');
    liveCard.appendChild(el('div','', `<b style="color:#ceae33;">${state.liveExoticWeapon.name}</b><br><span style="color:var(--muted);font-size:11px;">Equipped exotic weapon from the live manifest; no curated synergy entry exists yet.</span>`));
    p3.appendChild(liveCard);
    attachLiveIcon(liveCard, state.liveExoticWeapon, 'weapon', {size:48});
  }
  if(state.activeExoticWeapon){
    const ew = EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon);
    if(ew){
      const intrinsic = WEAPON_INTRINSICS[ew.name];
      if(intrinsic){
        const perkNote = el('div','empty-note', `<b style="color:var(--gold);font-style:normal;">${intrinsic.perk}</b> — ${intrinsic.desc}`);
        perkNote.style.marginTop='8px';
        p3.appendChild(perkNote);
        attachLiveIcon(perkNote, state.liveExoticWeapon || ew, 'weapon', {size:44});
      }
      const synergyNote = el('div','empty-note', `Build synergy: ${ew.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', ')}`);
      synergyNote.style.fontStyle='normal'; synergyNote.style.marginTop='6px';
      p3.appendChild(synergyNote);
    }
  }
  root.appendChild(p3);

  // Legendary tiered weapons — archetype + element + pick 2 perks each
  try {
  const {header: p4Head, body: p4} = makePanel('p4', '<span class="n">04</span> Tiered Legendary Weapons', {skipPanelClear:true});
  root.appendChild(p4Head);
  if(panelCollapsed['p4']){
    p4.appendChild(el('div','empty-note','Expand to load (this panel builds several hundred dropdown options).'));
  } else {
  ["Kinetic","Energy","Power"].forEach(slot=>{
    const activeExoticSlot = state.activeExoticWeapon ? (EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon)||{}).slot : null;
    if(activeExoticSlot === slot){
      const ew = EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon);
      const lockedWrap = el('div','');
      lockedWrap.dataset.equipmentSlot=slot;
      lockedWrap.style.marginBottom="14px";
      lockedWrap.style.paddingBottom="10px";
      lockedWrap.style.borderBottom="1px solid var(--line-soft)";
      lockedWrap.appendChild(el('div','', `<div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">${slotLabels[slot]}</div>`));
      const occNote = el('div','empty-note', `Occupied by exotic <b style="font-style:normal;color:#ceae33;">${state.activeExoticWeapon}</b> (${ew?effectiveExoticWeaponElement(ew):''}) — it inherits this slot's mod &amp; masterwork below.`);
      occNote.style.fontStyle='normal'; occNote.style.marginBottom='6px';
      lockedWrap.appendChild(occNote);
      if(ew) attachLiveIcon(occNote, state.liveExoticWeapon || ew, 'weapon', {size:42});
      if(state.legendary[slot]) state.legendary[slot] = null;
      // Weapon Mod (inherited slot context)
      const modRow = el('div','slotrow');
      modRow.appendChild(el('label','','Mod'));
      const modSel = el('select');
      modSel.setAttribute('data-testid','exotic-weapon-mod-'+slot);
      const noneM = document.createElement('option'); noneM.value=""; noneM.textContent="— no mod —"; modSel.appendChild(noneM);
      MODS.forEach(m=>{ const o=document.createElement('option'); o.value=m.name; o.textContent=m.name; if(state.exoticWeaponMod[slot]===m.name) o.selected=true; modSel.appendChild(o); });
      modSel.onchange=()=>{ state.exoticWeaponMod[slot] = modSel.value || null; render(); };
      modRow.appendChild(modSel);
      lockedWrap.appendChild(modRow);
      // Masterwork toggle (inherited slot context)
      const mwLabel = document.createElement('label');
      mwLabel.style.display='flex'; mwLabel.style.alignItems='center'; mwLabel.style.gap='6px'; mwLabel.style.cursor='pointer'; mwLabel.style.marginTop='6px';
      const mwCb = document.createElement('input'); mwCb.type='checkbox'; mwCb.checked=!!state.exoticWeaponMW[slot];
      mwCb.setAttribute('data-testid','exotic-weapon-mw-'+slot);
      mwCb.onchange=()=>{ state.exoticWeaponMW[slot]=mwCb.checked; render(); };
      mwLabel.appendChild(mwCb);
      mwLabel.appendChild(document.createTextNode('Masterworked (generates Orbs of Power on multikills)'));
      lockedWrap.appendChild(mwLabel);
      p4.appendChild(lockedWrap);
      return;
    }
    const wrap = el('div','', '');
    wrap.dataset.equipmentSlot=slot;
    wrap.style.marginBottom="14px";
    wrap.style.paddingBottom="10px";
    wrap.style.borderBottom="1px solid var(--line-soft)";

    // Generic Frame vs My Real Weapons toggle
    const modeRow = el('div','subclasstabs');
    modeRow.style.marginBottom = '8px';
    [{v:"generic",label:"Generic Frame"},{v:"real",label:"My Real Weapons"}].forEach(opt=>{
      const b = document.createElement('button');
      b.textContent = opt.label;
      if(state.legendaryMode[slot] === opt.v) b.classList.add('active');
      b.onclick = ()=>{ state.legendaryMode[slot] = opt.v; render(); };
      modeRow.appendChild(b);
    });
    modeRow.appendChild(makeItemClearBtn(()=>{
      state.legendary[slot] = null;
      state.legendaryMode[slot] = "generic";
      state.legendaryRealItem[slot] = null;
    }));
    wrap.appendChild(modeRow);

    if(state.legendaryMode[slot] === "real"){
      const auth = typeof getStoredAuth==='function' ? getStoredAuth() : null;
      if(!auth){
        wrap.appendChild(el('div','empty-note', 'Sign in with Bungie (hamburger menu) to pick from your real owned weapons here.'));
        p4.appendChild(wrap);
        return;
      }
      const realRow = el('div','slotrow');
      realRow.appendChild(el('label','',slotLabels[slot]));
      const realSel = el('select');
      const noneReal = document.createElement('option'); noneReal.value=""; noneReal.textContent = realWeaponsCache.fetchedAt ? "— none —" : "— sign in or sync a character to load owned weapons —"; realSel.appendChild(noneReal);
      (realWeaponsCache.bySlot[slot]||[]).forEach(w=>{
        const o = document.createElement('option'); o.value = w.instanceId; o.textContent = `${w.name} (${w.element}, \u25C8${w.power||'?'})`;
        if(state.legendaryRealItem[slot] && state.legendaryRealItem[slot].instanceId === w.instanceId) o.selected = true;
        realSel.appendChild(o);
      });
      realSel.onchange = ()=>{
        const chosen = (realWeaponsCache.bySlot[slot]||[]).find(w=>w.instanceId===realSel.value);
        if(chosen) selectRealWeapon(slot, chosen);
        else { state.legendaryRealItem[slot] = null; render(); }
      };
      realRow.appendChild(realSel);
      wrap.appendChild(realRow);

      const item = state.legendaryRealItem[slot];
      if(item){
        attachLiveIcon(wrap, item, 'weapon', {size:46});
        const detailNote = el('div','empty-note',
          item.matchedPerks === undefined ? 'Resolving real perks...' :
          (item.matchedPerks.length
            ? item.matchedPerks.map(p=>`<b style="color:var(--gold);font-style:normal;">${p.name}</b>`).join(', ') + (item.isMasterworked ? ' <span style="color:var(--gold);">\u2022 Masterworked</span>' : '')
            : 'No socketed perks matched this tool\u2019s known perk list \u2014 they may not contribute synergy numbers.')
        );
        detailNote.style.marginTop = '6px'; detailNote.style.marginLeft = '86px';
        wrap.appendChild(detailNote);
        if(item.unmatchedPlugNames && item.unmatchedPlugNames.length){
          const unmatchedNote = el('div','empty-note', `Also socketed (not in this tool\u2019s known list): ${item.unmatchedPlugNames.join(', ')}`);
          unmatchedNote.style.marginTop = '2px'; unmatchedNote.style.marginLeft = '86px'; unmatchedNote.style.opacity = '0.7';
          wrap.appendChild(unmatchedNote);
        }
      }
      p4.appendChild(wrap);
      return;
    }
    const row = el('div','slotrow');
    row.appendChild(el('label','',slotLabels[slot]));
    const sel = el('select');
    const noneOpt = document.createElement('option'); noneOpt.value=""; noneOpt.textContent="— none —"; sel.appendChild(noneOpt);
    LEGENDARY_ARCHETYPES.filter(a=>a.slots.includes(slot)).forEach(a=>{
      const o=document.createElement('option'); o.value=a.name; o.textContent=a.name;
      if(state.legendary[slot] && state.legendary[slot].name===a.name) o.selected=true;
      sel.appendChild(o);
    });
    sel.onchange=()=>{
      if(!sel.value){ state.legendary[slot]=null; }
      else {
        const defaultElement = slot==="Kinetic" ? "Kinetic" : "Solar";
        state.legendary[slot]={name:sel.value, tier:(state.legendary[slot]&&state.legendary[slot].tier)||3, element:defaultElement, barrel:null, mag:null, perk1:null, perk2:null, originTrait:null, mod:null, masterworked:false};
      }
      render();
    };
    row.appendChild(sel);
    wrap.appendChild(row);

    if(state.legendary[slot]){
      const arch = LEGENDARY_ARCHETYPES.find(a=>a.name===state.legendary[slot].name);
      const tp = el('div','tierpick');
      tp.style.marginLeft="86px"; tp.style.marginBottom="8px";
      for(let t=1;t<=5;t++){
        const b=document.createElement('button'); b.textContent="T"+t;
        if(state.legendary[slot].tier===t) b.classList.add('active');
        b.onclick=()=>{ state.legendary[slot].tier=t; render(); };
        tp.appendChild(b);
      }
      wrap.appendChild(tp);

      // Element picker (Kinetic slot is always Kinetic-only)
      const elementOptions = slot==="Kinetic" ? ["Kinetic"] : ["Solar","Arc","Void","Stasis","Strand","Kinetic"];
      if(elementOptions.length>1){
        const elRow = el('div','slotrow');
        elRow.style.marginBottom="8px";
        elRow.appendChild(el('label','','Element'));
        const elSel = el('select');
        elementOptions.forEach(elemName=>{
          const o=document.createElement('option'); o.value=elemName; o.textContent=elemName;
          if(state.legendary[slot].element===elemName) o.selected=true;
          elSel.appendChild(o);
        });
        elSel.onchange=()=>{ state.legendary[slot].element = elSel.value; state.legendary[slot].perks=[]; render(); };
        elRow.appendChild(elSel);
        wrap.appendChild(elRow);
      }

      // 6 weapon customization slots, laid out left-to-right to keep this
      // panel compact: Barrel, Mag, Perk 1, Perk 2, Origin Trait, Mod.
      const elem = state.legendary[slot].element;
      const resolvedPerkPool = perkPoolForArchetype(arch, elem);
      const slotDefs = [
        {field:'barrel', label:'Barrel', pool:(FRAME_BARREL_POOLS[arch.framePool]||{})[elem]||[]},
        {field:'mag', label:'Mag', pool:(FRAME_MAG_POOLS[arch.framePool]||{})[elem]||[]},
        {field:'perk1', label:'Perk 1', pool:resolvedPerkPool},
        {field:'perk2', label:'Perk 2', pool:resolvedPerkPool},
        {field:'originTrait', label:'Origin', pool:(FRAME_ORIGIN_TRAIT_POOLS[arch.framePool]||{})[elem]||[]},
        {field:'mod', label:'Mod', pool:(FRAME_MOD_POOLS[arch.framePool]||{})[elem]||[]},
      ];

      const slotLabel = el('div','', '<div style="font-size:11px;color:var(--muted);margin:6px 0 4px;text-transform:uppercase;letter-spacing:.06em;">Customization</div>');
      wrap.appendChild(slotLabel);

      const slotsRow = el('div','row');
      slotsRow.style.flexWrap = 'wrap';
      slotsRow.style.gap = '6px';
      const chosenItems = [];
      slotDefs.forEach(def=>{
        const col = el('div','');
        col.style.minWidth = '110px'; col.style.flex = '1 1 110px';
        col.appendChild(el('div','', `<div style="font-size:10px;color:var(--muted2);margin-bottom:2px;">${def.label}</div>`));
        const sel = el('select');
        sel.style.width = '100%'; sel.style.fontSize = '11px'; sel.style.padding = '5px 4px';
        const noneOpt = document.createElement('option'); noneOpt.value=""; noneOpt.textContent="— none —"; sel.appendChild(noneOpt);
        def.pool.forEach(item=>{
          const o=document.createElement('option'); o.value=item.name; o.textContent=item.name;
          if(state.legendary[slot][def.field]===item.name) o.selected=true;
          sel.appendChild(o);
        });
        sel.onchange=()=>{ state.legendary[slot][def.field] = sel.value || null; render(); };
        col.appendChild(sel);
        slotsRow.appendChild(col);

        const chosen = def.pool.find(p=>p.name===state.legendary[slot][def.field]);
        if(chosen) chosenItems.push({label:def.label, item:chosen});
      });
      wrap.appendChild(slotsRow);

      // Weapon Masterwork — real mechanic is +1/tier to a raw weapon stat
      // (not modeled, this tool doesn't track Range/Stability/etc.) plus
      // generating Orbs of Power on multikills, which IS modeled.
      const mwWeaponLabel = document.createElement('label');
      mwWeaponLabel.style.display = 'flex'; mwWeaponLabel.style.alignItems = 'center'; mwWeaponLabel.style.gap = '6px'; mwWeaponLabel.style.cursor = 'pointer'; mwWeaponLabel.style.marginTop = '6px';
      const mwWeaponCheckbox = document.createElement('input');
      mwWeaponCheckbox.type = 'checkbox';
      mwWeaponCheckbox.checked = !!state.legendary[slot].masterworked;
      mwWeaponCheckbox.onchange = ()=>{ state.legendary[slot].masterworked = mwWeaponCheckbox.checked; render(); };
      mwWeaponLabel.appendChild(mwWeaponCheckbox);
      mwWeaponLabel.appendChild(document.createTextNode('Masterworked (generates Orbs of Power on multikills)'));
      wrap.appendChild(mwWeaponLabel);

      if(chosenItems.length){
        const combinedDesc = chosenItems.map(({label,item})=>
          `<b style="font-style:normal;color:var(--gold);">${label}: ${item.name}</b> — ${item.effects && item.effects.length ? item.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'') ).join(', ') : (item.desc||'utility only')}`
        ).join('<br>');
        const descNote = el('div','empty-note', combinedDesc);
        descNote.style.margin='6px 0'; descNote.style.fontStyle='normal';
        wrap.appendChild(descNote);
        chosenItems.forEach(({item})=> attachLiveIcon(descNote, item.name, 'perk'));
      } else {
        const emptyNote = el('div','empty-note', 'No customization data loaded yet for this frame/burn — pools are ready to be filled in.');
        emptyNote.style.margin='6px 0';
        wrap.appendChild(emptyNote);
      }
    }
    p4.appendChild(wrap);
  });
  }
  root.appendChild(p4);
  } catch(e){ console.error('Panel 4 (Legendary Weapons) render failed:', e); root.appendChild(el('div','panel', '<div style="color:var(--danger);padding:8px;">Error rendering Tiered Legendary Weapons: '+e.message+'</div>')); }

  // Armor Mods — one regular mod + one Tier 5 tuning mod per armor slot
  try {
  const {header: p5Head, body: p5} = makePanel('p5', '<span class="n">05</span> Armor Mods <span style="color:var(--muted2);font-family:Inter;text-transform:none;font-size:11px;">(4 mod slots + 1 tuning slot per piece)</span>', {skipPanelClear:true});
  root.appendChild(p5Head);
  if(panelCollapsed['p5']){
    p5.appendChild(el('div','empty-note','Expand to load (this panel builds several hundred dropdown options).'));
  } else {
  const slotDisplayNames = {Helmet:"Helmet", Arms:"Arms", Chest:"Chest", Legs:"Legs", ClassItem:"Class Item"};
  ["Helmet","Arms","Chest","Legs","ClassItem"].forEach(slotName=>{
    const wrap = el('div','');
    wrap.dataset.equipmentSlot=slotName;
    wrap.style.marginBottom="14px";
    wrap.style.paddingBottom="10px";
    wrap.style.borderBottom="1px solid var(--line-soft)";
    const chosen = state.mods[slotName]||[];
    const PIECE_TO_SLOT = {Head:"Helmet", Arms:"Arms", Chest:"Chest", Legs:"Legs", ClassItem:"ClassItem"};
    const exoticArmorObj = state.exoticArmor ? EXOTIC_ARMOR[state.cls].find(a=>a.name===state.exoticArmor) : null;
    const exoticInThisSlot = exoticArmorObj && PIECE_TO_SLOT[exoticArmorObj.piece] === slotName;
    wrap.appendChild(el('div','', `<div style="font-size:12px;color:var(--gold);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${slotDisplayNames[slotName]}${exoticInThisSlot?` <span style="color:#ceae33;font-family:Inter;text-transform:none;font-size:11px;">◆ Exotic: ${state.exoticArmor} (mods below apply to it)</span>`:''}</div>`));

    // Generic (manual tier/mods/masterwork) vs My Real Armor (synced from account)
    const armorModeRow = el('div','subclasstabs');
    armorModeRow.style.marginBottom = '8px';
    [{v:"generic",label:"Generic"},{v:"real",label:"My Real Armor"}].forEach(opt=>{
      const b = document.createElement('button');
      b.textContent = opt.label;
      if(state.armorMode[slotName] === opt.v) b.classList.add('active');
      b.onclick = ()=>{ state.armorMode[slotName] = opt.v; render(); };
      armorModeRow.appendChild(b);
    });
    armorModeRow.appendChild(makeItemClearBtn(()=>{
      state.mods[slotName] = [];
      state.tuning[slotName] = null;
      state.armorMasterwork[slotName] = {level:0, stats:[]};
      state.armorMode[slotName] = "generic";
      state.armorRealItem[slotName] = null;
    }));
    wrap.appendChild(armorModeRow);

    if(state.armorMode[slotName] === "real"){
      const auth = typeof getStoredAuth==='function' ? getStoredAuth() : null;
      if(!auth){
        wrap.appendChild(el('div','empty-note', 'Sign in with Bungie (hamburger menu) to sync a real owned piece here.'));
        p5.appendChild(wrap);
        return;
      }
      const realArmorRow = el('div','slotrow');
      realArmorRow.appendChild(el('label','',slotDisplayNames[slotName]));
      const realArmorSel = el('select');
      const noneReal = document.createElement('option'); noneReal.value=""; noneReal.textContent = realGearCache.fetchedAt ? "— none —" : "— sign in or sync a character to load owned armor —"; realArmorSel.appendChild(noneReal);
      (realGearCache.armorBySlot[slotName]||[]).forEach(a=>{
        const o = document.createElement('option'); o.value = a.instanceId; o.textContent = `${a.name} (\u25C8${a.power||'?'})`;
        if(state.armorRealItem[slotName] && state.armorRealItem[slotName].instanceId === a.instanceId) o.selected = true;
        realArmorSel.appendChild(o);
      });
      realArmorSel.onchange = ()=>{
        const chosenArmor = (realGearCache.armorBySlot[slotName]||[]).find(a=>a.instanceId===realArmorSel.value);
        if(chosenArmor) selectRealArmor(slotName, chosenArmor);
        else { state.armorRealItem[slotName] = null; render(); }
      };
      realArmorRow.appendChild(realArmorSel);
      wrap.appendChild(realArmorRow);

      const realItem = state.armorRealItem[slotName];
      if(realItem){
        attachLiveIcon(wrap, realItem, 'armor', {size:46});
        const statLine = Object.values(realItem.stats||{}).map(s=>{
          const n = STAT_HASH_TO_NAME[s.statHash]; return n ? `${n} ${s.value}` : null;
        }).filter(Boolean).join(' \u00b7 ');
        if(statLine){
          const statNote = el('div','empty-note', statLine);
          statNote.style.marginTop = '6px'; statNote.style.marginLeft = '86px';
          wrap.appendChild(statNote);
        }
        const modDetailNote = el('div','empty-note',
          realItem.matchedMods === undefined ? 'Resolving real mods...' :
          (realItem.matchedMods.length
            ? realItem.matchedMods.map(m=>`<b style="color:var(--gold);font-style:normal;">${m.name}</b>`).join(', ') + (realItem.isMasterworked ? ' <span style="color:var(--gold);">\u2022 Masterworked</span>' : '')
            : 'No socketed mods matched this tool\u2019s known list.')
        );
        modDetailNote.style.marginTop = '2px'; modDetailNote.style.marginLeft = '86px';
        wrap.appendChild(modDetailNote);
        if(realItem.unmatchedPlugNames && realItem.unmatchedPlugNames.length){
          const unmatchedNote = el('div','empty-note', `Also socketed (not in this tool\u2019s known list): ${realItem.unmatchedPlugNames.join(', ')}`);
          unmatchedNote.style.marginTop = '2px'; unmatchedNote.style.marginLeft = '86px'; unmatchedNote.style.opacity = '0.7';
          wrap.appendChild(unmatchedNote);
        }
      }
      p5.appendChild(wrap);
      return;
    }


    // Armor 3.0 tier (1-5). Tier 4 & 5 have 11 mod energy; T1-3 have 10.
    // Tier 5 also unlocks the stat-tuning slot.
    const tier = state.armorTier[slotName] || 5;
    const tierRow = el('div','slotrow');
    tierRow.style.marginBottom="8px";
    tierRow.appendChild(el('label','','Tier'));
    const tierSel = el('select');
    [1,2,3,4,5].forEach(tv=>{
      const o=document.createElement('option'); o.value=String(tv);
      o.textContent = `Tier ${tv} — ${tv>=4?11:10} energy${tv===5?' + tuning slot':''}`;
      if(tier===tv) o.selected=true;
      tierSel.appendChild(o);
    });
    tierSel.onchange=()=>{ state.armorTier[slotName] = parseInt(tierSel.value,10); render(); };
    tierRow.appendChild(tierSel);
    wrap.appendChild(tierRow);

    for(let i=0;i<4;i++){
      const slotRow = el('div','slotrow');
      slotRow.style.marginBottom="6px";
      slotRow.appendChild(el('label','','Slot '+(i+1)));
      const modSel = el('select');
      const noneOpt = document.createElement('option'); noneOpt.value=""; noneOpt.textContent="— empty —"; modSel.appendChild(noneOpt);
      ARMOR_MODS_BY_SLOT[slotName].forEach(m=>{
        const o=document.createElement('option'); o.value=m.name;
        o.textContent = `${m.name}  [${m.energy||0}\u26A1]` + (m.effects && m.effects.length ? "" : " (utility)");
        if(chosen[i]===m.name) o.selected=true;
        modSel.appendChild(o);
      });
      modSel.onchange=()=>{
        const cur = (state.mods[slotName]||[]).slice();
        while(cur.length<4) cur.push(null);
        cur[i] = modSel.value || null;
        state.mods[slotName] = cur;
        render();
      };
      slotRow.appendChild(modSel);
      wrap.appendChild(slotRow);

      const chosenMod = ARMOR_MODS_BY_SLOT[slotName].find(m=>m.name===chosen[i]);
      if(chosenMod){
        const desc = chosenMod.effects && chosenMod.effects.length
          ? chosenMod.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' '+(e.value>=0?'+':'')+e.value+'%'+(e.cond?` (if ${e.cond})`:'')).join(', ')
          : (chosenMod.desc||'utility only');
        const note = el('div','empty-note', desc + ` &nbsp;&middot;&nbsp; <span style="color:var(--gold);">${chosenMod.energy||0}\u26A1 energy</span>`);
        note.style.margin="2px 0 6px"; note.style.marginLeft="86px";
        wrap.appendChild(note);
        attachLiveIcon(note, chosenMod.name, 'mod');
      }
    }

    // Armor 3.0 energy budget: Tier 4 & 5 pieces have 11 energy, else 10.
    const ARMOR_ENERGY_CAP = tier >= 4 ? 11 : 10;
    const usedEnergy = (state.mods[slotName]||[]).reduce((sum,name)=>{
      const m = ARMOR_MODS_BY_SLOT[slotName].find(x=>x.name===name);
      return sum + (m ? (m.energy||0) : 0);
    }, 0);
    const over = usedEnergy > ARMOR_ENERGY_CAP;
    const energyRow = el('div','', `<span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${over?'var(--danger)':'var(--muted)'};">Mod energy: ${usedEnergy} / ${ARMOR_ENERGY_CAP}${over?' \u2014 over capacity':''}</span>`);
    energyRow.style.margin="6px 0 2px";
    wrap.appendChild(energyRow);

    // Stat-tuning slot is Tier 5 only, and costs 0 mod energy.
    if(tier >= 5){
      const tuneSel = el('select');
      tuneSel.style.marginTop="8px";
      const noneTuneOpt = document.createElement('option'); noneTuneOpt.value=""; noneTuneOpt.textContent="— no tuning (0 energy) —"; tuneSel.appendChild(noneTuneOpt);
      TUNING_MODS_BY_SLOT[slotName].forEach(t=>{
        const o=document.createElement('option'); o.value=t.name; o.textContent=t.name;
        if(state.tuning[slotName]===t.name) o.selected=true;
        tuneSel.appendChild(o);
      });
      tuneSel.onchange=()=>{ state.tuning[slotName] = tuneSel.value || null; render(); };
      wrap.appendChild(tuneSel);
      const chosenTune = TUNING_MODS_BY_SLOT[slotName].find(t=>t.name===state.tuning[slotName]);
      if(chosenTune){
        const tdesc = chosenTune.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' '+(e.value>=0?'+':'')+e.value+'%').join(', ');
        const tnote = el('div','empty-note', tdesc);
        tnote.style.margin="4px 0 0";
        wrap.appendChild(tnote);
      }
    } else {
      if(state.tuning[slotName]){ state.tuning[slotName] = null; } // clear tuning if tier dropped below 5
      const noTune = el('div','empty-note', 'Stat-tuning slot unlocks at Tier 5.');
      noTune.style.marginTop="8px";
      wrap.appendChild(noTune);
    }

    // Armor 3.0 Masterwork — raises this piece's 3 lowest stats by +1 per
    // level (max +5 each at level 5). No longer affects mod energy. Real
    // per-item rolls aren't modeled, so pick which 3 stats benefit here.
    const mwState = state.armorMasterwork[slotName];
    const mwRow = el('div','slotrow');
    mwRow.style.marginTop = '10px';
    mwRow.appendChild(el('label','','Masterwork'));
    const mwSel = el('select');
    [0,1,2,3,4,5].forEach(lv=>{
      const o=document.createElement('option'); o.value=String(lv);
      o.textContent = lv===0 ? 'Not masterworked' : `Level ${lv} (+${lv} to 3 stats)`;
      if(mwState.level===lv) o.selected=true;
      mwSel.appendChild(o);
    });
    mwSel.onchange = ()=>{ mwState.level = parseInt(mwSel.value,10); render(); };
    mwRow.appendChild(mwSel);
    wrap.appendChild(mwRow);
    if(mwState.level > 0){
      const statPickRow = el('div','');
      statPickRow.style.display = 'flex'; statPickRow.style.flexWrap = 'wrap'; statPickRow.style.gap = '8px'; statPickRow.style.marginTop = '6px';
      STAT_NAMES.forEach(stat=>{
        const isChosen = mwState.stats.includes(stat);
        const statLabel = document.createElement('label');
        statLabel.style.display = 'flex'; statLabel.style.alignItems = 'center'; statLabel.style.gap = '4px'; statLabel.style.fontSize = '12px'; statLabel.style.cursor = 'pointer';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isChosen;
        cb.onchange = ()=>{
          const arr = mwState.stats;
          if(cb.checked){
            if(arr.length >= 3){ cb.checked = false; return; } // real mechanic caps at 3 stats per piece
            arr.push(stat);
          } else {
            mwState.stats = arr.filter(s=>s!==stat);
          }
          render();
        };
        statLabel.appendChild(cb);
        statLabel.appendChild(document.createTextNode(stat));
        statPickRow.appendChild(statLabel);
      });
      wrap.appendChild(statPickRow);
      if(mwState.stats.length < 3){
        const capNote = el('div','empty-note', `${3 - mwState.stats.length} more stat${3 - mwState.stats.length===1?'':'s'} to pick (real armor always benefits exactly 3).`);
        capNote.style.marginTop = '4px';
        wrap.appendChild(capNote);
      }
    }

    p5.appendChild(wrap);
  });
  }
  root.appendChild(p5);
  } catch(e){ console.error('Panel 5 (Armor Mods) render failed:', e); root.appendChild(el('div','panel', '<div style="color:var(--danger);padding:8px;">Error rendering Armor Mods: '+e.message+'</div>')); }

  // Artifact
  const artifactRoot=document.getElementById('artifactWorkspaceBody');
  try {
  if(artifactRoot)artifactRoot.innerHTML='';
  panelCollapsed.p6=false;
  const {body: p6} = makePanel('p6', '<span class="n">Seasonal Artifact</span>', {skipPanelClear:true});

  const artModeRow = el('div','subclasstabs');
  artModeRow.style.marginBottom = '8px';
  [{v:"generic",label:"Generic"},{v:"real",label:"My Real Live Build"}].forEach(opt=>{
    const b = document.createElement('button');
    b.textContent = opt.label;
    if(state.artifactMode === opt.v) b.classList.add('active');
    b.onclick = ()=>{ state.artifactMode = opt.v; render(); };
    artModeRow.appendChild(b);
  });
  artModeRow.appendChild(makeItemClearBtn(()=>{
    state.artifact = null;
    state.artifactPerks = [];
    state.artifactMode = "generic";
  }));
  p6.appendChild(artModeRow);

  if(state.artifactMode === "real"){
    const artifactAuth=typeof getStoredAuth==='function'&&getStoredAuth();
    if(!artifactAuth){
      p6.appendChild(el('div','empty-note', 'Sign in with Bungie (hamburger menu) to sync your real active artifact perks here.'));
      artifactRoot?.appendChild(p6);
    } else {
      if(state.artifact){
        const liveNote = el('div','empty-note', `<b style="color:var(--gold);font-style:normal;">${state.artifact}</b> \u2014 ${state.artifactPerks.length} active perk${state.artifactPerks.length===1?'':'s'} synced from your real account.`);
        liveNote.style.margin = '6px 0';
        p6.appendChild(liveNote);
        if(state.liveArtifact?.artifactHash || state.liveArtifact?.icon) attachLiveIcon(liveNote, {...state.liveArtifact,hash:state.liveArtifact.artifactHash}, 'perk', {size:40});
        const liveGrid = el('div','chipgrid');
        state.artifactPerks.forEach(name=>{
          const perk = ARTIFACT_PERK_LIBRARY[name];
          if(!perk) return;
          const desc = (perk.effects && perk.effects.length
            ? perk.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')).join(', ')
            : (perk.desc||'utility only'));
          const chip = el('div','chip active', `<span class="nm">${name}</span><span class="desc">${desc}</span>`);
          attachLiveIcon(chip, name, 'perk');
          liveGrid.appendChild(chip);
        });
        p6.appendChild(liveGrid);
      } else {
        p6.appendChild(el('div','empty-note', 'No active artifact perks were returned for the selected Guardian. Reload the account data or choose Generic to plan manually.'));
      }
      artifactRoot?.appendChild(p6);
    }
  } else {
  const artSel = el('select');
  const noneOpt2=document.createElement('option'); noneOpt2.value=""; noneOpt2.textContent="— none —"; artSel.appendChild(noneOpt2);
  ARTIFACTS.forEach(a=>{
    const o=document.createElement('option'); o.value=a.name; o.textContent=a.name+" — "+a.theme;
    if(state.artifact===a.name) o.selected=true;
    artSel.appendChild(o);
  });
  artSel.onchange=()=>{ state.artifact = artSel.value||null; state.artifactPerks=[]; render(); };
  p6.appendChild(artSel);
  if(state.artifact){
    const art = ARTIFACTS.find(a=>a.name===state.artifact);
    const c1Count = state.artifactPerks.filter(n=>art.column1.includes(n)).length;
    const c12Count = state.artifactPerks.filter(n=>art.column1.includes(n)||art.column2.includes(n)).length;
    const col2Unlocked = c1Count>=2;
    const col3Unlocked = c12Count>=5;
    const totalCount = state.artifactPerks.length;
    const atCap = totalCount>=7;

    const progressNote = el('div','empty-note',
      `${totalCount}/7 slots used · Column 1: ${c1Count}/2 needed to unlock Column 2 ${col2Unlocked?'✓':''} · `+
      `Columns 1+2 combined: ${c12Count}/5 needed to unlock Column 3 ${col3Unlocked?'✓':''}`
    );
    progressNote.style.margin="8px 0"; p6.appendChild(progressNote);

    function renderPerkColumn(colNum, names, unlocked){
      const hasActiveInCol = names.some(n=>state.artifactPerks.includes(n));
      const show = unlocked || hasActiveInCol;
      const label = el('div','', `<div style="font-size:11px;color:${show?'var(--gold)':'var(--muted2)'};margin:10px 0 4px;text-transform:uppercase;letter-spacing:.06em;">Column ${colNum}${show?'':' (locked)'}</div>`);
      p6.appendChild(label);
      if(!show){
        const lockNote = el('div','empty-note', colNum===2 ? 'Pick 2 perks from Column 1 to unlock.' : 'Pick 5 total perks from Columns 1+2 to unlock.');
        p6.appendChild(lockNote);
        return;
      }
      const pg = el('div','chipgrid');
      names.forEach(name=>{
        const perk = ARTIFACT_PERK_LIBRARY[name];
        const active = state.artifactPerks.includes(name);
        const disabled = !active && (atCap || !unlocked);
        const allText = JSON.stringify(perk);
        const isVerified = allText.includes('VERIFIED');
        const tag = isVerified
          ? '<span style="color:var(--good);font-size:9px;">✓ verified</span>'
          : '<span style="color:var(--muted2);font-size:9px;">estimated</span>';
        const desc = (perk.effects && perk.effects.length
          ? perk.effects.map(e=>BUCKETS.find(b=>b.id===e.bucket).name+' +'+e.value+'%'+(e.cond?` (if ${e.cond})`:'')+(e.note?' — '+e.note:'')).join(', ')
          : (perk.desc||'utility only')).replace(/ *\(unverified — estimated from name\)/,'').replace(/VERIFIED — /,'');
        const chip = el('div','chip'+(active?' active':'')+(disabled?' disabled':''), `<span class="nm">${name} ${tag}</span><span class="desc">${desc}</span>`);
        chip.onclick=()=>{
          if(disabled) return;
          if(active){ state.artifactPerks = state.artifactPerks.filter(x=>x!==name); }
          else { state.artifactPerks.push(name); }
          render();
        };
        if(active) attachLiveIcon(chip, name, 'perk');
        pg.appendChild(chip);
      });
      p6.appendChild(pg);
    }

    renderPerkColumn(1, art.column1, true);
    renderPerkColumn(2, art.column2, col2Unlocked);
    renderPerkColumn(3, art.column3, col3Unlocked);

    if(atCap){
      const capNote = el('div','empty-note', 'All 7 slots filled — deselect a perk to pick a different one.');
      capNote.style.marginTop='8px'; p6.appendChild(capNote);
    }
  }
  artifactRoot?.appendChild(p6);
  }
  } catch(e){ console.error('Panel 6 (Artifact) render failed:', e); artifactRoot?.appendChild(el('div','panel', '<div style="color:var(--danger);padding:8px;">Error rendering Seasonal Artifact: '+e.message+'</div>')); }

}

function effectiveExoticWeaponElement(weapon){
  if(!weapon) return null;
  const live=state.liveExoticWeapon;
  if(live&&liveNameMatches(live.name,weapon.name)&&live.element) return live.element;
  for(const slot of ['Kinetic','Energy','Power']){
    const real=(realWeaponsCache?.bySlot?.[slot]||[]).find(item=>liveNameMatches(item.name,weapon.name));
    if(real?.element) return real.element;
  }
  return weapon.manifestElement||weapon.element||null;
}
async function validateSelectedExoticWeaponElement(name){
  const weapon=EXOTIC_WEAPONS.find(w=>w.name===name);
  if(!weapon||typeof resolveAuthoritativeWeaponDefinitionByName!=='function') return;
  const def=await resolveAuthoritativeWeaponDefinitionByName(name);
  const element=typeof manifestWeaponElement==='function'?manifestWeaponElement(def):null;
  if(!element) return;
  weapon.manifestHash=def.hash; weapon.manifestElement=element; weapon.icon=weapon.icon||def.icon;
  // A manifest correction may move the weapon between inventory slots.
  const slot=({1498876634:'Kinetic',2465295065:'Energy',953998645:'Power'})[Number(def.bucketHash)]||weapon.slot;
  if(slot) weapon.slot=slot;
  if(state.activeExoticWeapon===name) render();
}


