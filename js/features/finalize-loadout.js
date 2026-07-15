/* Finalize-loadout write pipeline, character bar, and application startup
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 7 — FINALIZE LOADOUT (writes to the live account)
   Ordered pipeline: transfer → equip gear → insert subclass plugs → insert
   armor mods, confirmation summary first, per-step report, ~2 socket
   actions/sec, re-acquire + manual-step notices. Untested against Bungie's
   live servers — the account owner is the first test. Orbit / social only.
   ========================================================================= */
const SOCKET_ACTION_SPACING_MS = 550;
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function bungiePostAuth(path, body, accessToken){
  const res = await rateLimitedFetch(BUNGIE_BASE + path, {
    method:'POST',
    headers:{ 'X-API-Key':BUNGIE_API_KEY, 'Authorization':'Bearer '+accessToken, 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return handleBungieJson(json);
}
async function equipItems(instanceIds, characterId){
  const auth = await getValidAccessToken(); if(!auth) throw new Error('Not signed in.');
  return bungiePostAuth('/Destiny2/Actions/Items/EquipItems/', { itemIds:instanceIds, characterId, membershipType:liveSyncState.membershipType }, auth.access_token);
}
async function insertSocketPlugFree(itemInstanceId, socketIndex, plugItemHash, characterId){
  const auth = await getValidAccessToken(); if(!auth) throw new Error('Not signed in.');
  return bungiePostAuth('/Destiny2/Actions/Items/InsertSocketPlugFree/', { itemId:itemInstanceId, plug:{ socketIndex, plugItemHash, socketArrayType:0 }, characterId, membershipType:liveSyncState.membershipType }, auth.access_token);
}
async function getItemSocketState(instanceId){
  const data = await bungieGet(`/Destiny2/${liveSyncState.membershipType}/Profile/${liveSyncState.membershipId}/Item/${instanceId}/?components=305,310`);
  return { sockets: data.sockets?.data?.sockets || [], reusable: data.reusablePlugs?.data?.plugs || {} };
}
async function findOwnedInstanceByName(name){
  if(!liveSyncState.full) return null;
  const char = liveSyncState.characters.find(c=>c.charId===state.selectedCharId);
  const pools = [];
  if(char){ pools.push(...char.equipped.map(i=>({i, holder:'char'})), ...char.inventory.map(i=>({i, holder:'char'}))); }
  liveSyncState.full.characters.forEach(c=>{ if(!char || c.charId!==char.charId) pools.push(...c.inventory.map(i=>({i, holder:'otherchar', charId:c.charId}))); });
  pools.push(...liveSyncState.full.vault.map(i=>({i, holder:'vault'})));
  for(const p of pools){
    if(!p.i.instanceId) continue;
    try { const d = p.i._def || await getItemDefinition(p.i.hash); p.i._def = d; if(d.name === name) return {item:p.i, holder:p.holder, charId:p.charId}; } catch(e){}
  }
  return null;
}
async function buildFinalizePlan(){
  const plan = { equips:[], subclassPlugs:[], armorMods:[], missing:[], manual:[] };
  const char = liveSyncState.characters ? liveSyncState.characters.find(c=>c.charId===state.selectedCharId) : null;
  if(!char) throw new Error('Select one of your live characters first (top bar).');
  const wantItems = [];
  if(state.activeExoticWeapon) wantItems.push({name:state.activeExoticWeapon, kind:'Exotic weapon'});
  if(state.exoticArmor) wantItems.push({name:state.exoticArmor, kind:'Exotic armor'});
  for(const w of wantItems){
    const found = await findOwnedInstanceByName(w.name);
    if(!found){ plan.missing.push(`${w.kind}: ${w.name} — Please re-acquire item (not found in inventory or vault).`); continue; }
    plan.equips.push({name:w.name, kind:w.kind, item:found.item, holder:found.holder, fromCharId:found.charId});
  }
  Object.entries(state.legendary).forEach(([slot,val])=>{ if(val) plan.manual.push(`${slot} legendary (${val.name}) — generic archetype, no specific owned roll to equip; set in-game.`); });
  const subItem = char.equipped.find(it=>it._def && it._def.bucketHash===SUBCLASS_BUCKET);
  const wantPlugNames = [];
  if(state.super) wantPlugNames.push(state.super.replace(/ \(.*\)$/,''));
  state.aspects.forEach(a=>wantPlugNames.push(a.replace(/ \(.*\)$/,'')));
  state.fragments.forEach(f=>wantPlugNames.push(f));
  if(state.grenade) wantPlugNames.push(state.grenade);
  if(state.melee) wantPlugNames.push(state.melee);
  if(subItem && subItem.instanceId && wantPlugNames.length){
    try {
      const ss = await getItemSocketState(subItem.instanceId);
      const candidateIndex = {};
      for(const [sidx, plugs] of Object.entries(ss.reusable)){
        for(const p of plugs){ try { const d = await getItemDefinition(p.plugItemHash); if(d.name) candidateIndex[d.name] = {socketIndex:parseInt(sidx,10), plugItemHash:p.plugItemHash}; } catch(e){} }
      }
      const currentByIndex = {};
      ss.sockets.forEach((s,idx)=>{ if(s.plugHash) currentByIndex[idx] = s.plugHash; });
      for(const wn of wantPlugNames){
        const cand = candidateIndex[wn];
        if(!cand){ plan.manual.push(`Subclass "${wn}" — couldn't resolve its socket on your equipped subclass; set in-game.`); continue; }
        if(currentByIndex[cand.socketIndex] === cand.plugItemHash) continue;
        plan.subclassPlugs.push({name:wn, itemId:subItem.instanceId, socketIndex:cand.socketIndex, plugItemHash:cand.plugItemHash});
      }
    } catch(e){ plan.manual.push('Subclass sockets — could not read layout: '+e.message); }
  } else if(wantPlugNames.length){ plan.manual.push('Subclass abilities — no equipped subclass instance found to modify.'); }
  for(const [slot, mods] of Object.entries(state.mods)){
    const chosen = (mods||[]).filter(Boolean);
    if(!chosen.length) continue;
    const bucketHash = Object.keys(ARMOR_BUCKET_TO_SLOT).find(k=>ARMOR_BUCKET_TO_SLOT[k]===slot);
    const armorItem = char.equipped.find(it=>it._def && String(it._def.bucketHash)===String(bucketHash));
    if(!armorItem || !armorItem.instanceId){ chosen.forEach(m=>plan.manual.push(`${slot} mod "${m}" — no equipped ${slot} to modify.`)); continue; }
    try {
      const ss = await getItemSocketState(armorItem.instanceId);
      const candidateIndex = {};
      for(const [sidx, plugs] of Object.entries(ss.reusable)){
        for(const p of plugs){ try { const d = await getItemDefinition(p.plugItemHash); if(d.name) candidateIndex[d.name] = {socketIndex:parseInt(sidx,10), plugItemHash:p.plugItemHash}; } catch(e){} }
      }
      for(const m of chosen){
        const cand = candidateIndex[m];
        if(!cand){ plan.manual.push(`${slot} mod "${m}" — not free/available on this armor (material cost or not owned) → set in-game.`); continue; }
        plan.armorMods.push({name:m, slot, itemId:armorItem.instanceId, socketIndex:cand.socketIndex, plugItemHash:cand.plugItemHash});
      }
    } catch(e){ plan.manual.push(`${slot} mods — could not read layout: ${e.message}`); }
  }
  Object.entries(state.tuning).forEach(([slot,t])=>{ if(t) plan.manual.push(`${slot} stat-tuning ("${t}") — material cost, not settable via API.`); });
  Object.entries(state.exoticWeaponMod).forEach(([slot,m])=>{ if(m) plan.manual.push(`${slot} weapon mod ("${m}") — weapon mods aren't settable via API.`); });
  if(state.artifactPerks.length) plan.manual.push(`Seasonal artifact perks (${state.artifactPerks.length}) — not settable via the API.`);
  Object.entries(state.armorMasterwork).forEach(([slot,mw])=>{ if(mw.level) plan.manual.push(`${slot} masterwork (Lv${mw.level}) — material cost, not settable via API.`); });
  return plan;
}
async function openFinalizeModal(){
  const card = document.getElementById('itemDetailCard');
  idOverlay.classList.add('open');
  card.innerHTML = '';
  const head = el('div','idHead');
  head.appendChild(el('div','', '<div class="idName">Finalize Loadout</div><div class="idType">Review before anything is written to your account</div>'));
  const closeB = el('button','idClose','×'); closeB.onclick = closeItemDetail; head.appendChild(closeB);
  card.appendChild(head);
  const body = el('div','idBody'); card.appendChild(body);
  body.appendChild(el('div','empty-note','Building plan — reading your equipped sockets from Bungie.net...'));
  try {
    const plan = await buildFinalizePlan();
    body.innerHTML = '';
    const sum = el('div','');
    const line = (label,n,color)=>`<div style="margin:4px 0;font-size:13px;"><b style="color:${color};font-family:'JetBrains Mono';">${n}</b> ${label}</div>`;
    sum.innerHTML =
      line('gear item(s) to equip (auto-transfer if needed)', plan.equips.length, 'var(--good)') +
      line('subclass plug(s) to insert', plan.subclassPlugs.length, 'var(--good)') +
      line('armor mod(s) to insert', plan.armorMods.length, 'var(--good)') +
      line('item(s) missing → re-acquire needed', plan.missing.length, 'var(--danger)') +
      line("manual step(s) (can't be set via API)", plan.manual.length, 'var(--gold)');
    body.appendChild(sum);
    const detailList = (title, arr)=>{ if(!arr.length) return; body.appendChild(el('div','idSectionLabel', title)); const ul = el('div',''); arr.forEach(x=>{ const d = el('div','empty-note', typeof x==='string'?x:`${x.kind||x.slot||''}: ${x.name}`); d.style.margin='2px 0'; ul.appendChild(d); }); body.appendChild(ul); };
    detailList('Will equip', plan.equips);
    detailList('Subclass plugs', plan.subclassPlugs.map(p=>p.name));
    detailList('Armor mods', plan.armorMods.map(p=>`${p.slot}: ${p.name}`));
    detailList('Missing — please re-acquire', plan.missing);
    detailList('Manual steps needed', plan.manual);
    const warn = el('div','empty-note', '⚠ Works only in orbit or a social space — it fails inside any activity. Socket changes are rate-limited to ~2/sec and queued with a progress bar. This writes to your REAL account.');
    warn.style.color='var(--gold)'; warn.style.margin='12px 0'; warn.style.fontStyle='normal';
    body.appendChild(warn);
    const canWrite = plan.equips.length || plan.subclassPlugs.length || plan.armorMods.length;
    const btn = el('button','reset', canWrite ? 'Confirm & Write to My Account' : 'Nothing to write');
    btn.setAttribute('data-testid','finalize-confirm-btn');
    btn.style.marginTop='6px'; btn.disabled = !canWrite;
    if(canWrite){ btn.style.borderColor='var(--good)'; btn.style.color='var(--good)'; }
    btn.onclick = ()=>runFinalize(plan);
    body.appendChild(btn);
    const progress = el('div',''); progress.id='finalizeProgress'; progress.style.marginTop='14px'; body.appendChild(progress);
  } catch(err){
    body.innerHTML=''; const e = el('div','empty-note', 'Could not build plan: ' + err.message); e.style.color='var(--danger)'; body.appendChild(e);
  }
}
async function runFinalize(plan){
  const host = document.getElementById('finalizeProgress'); host.innerHTML='';
  const totalSteps = plan.equips.length + plan.subclassPlugs.length + plan.armorMods.length; let done = 0;
  const bar = el('div',''); bar.style.cssText='height:8px;background:#1a1f25;border:1px solid var(--line-soft);overflow:hidden;margin-bottom:10px;';
  const fill = el('div',''); fill.style.cssText='height:100%;width:0;background:var(--good);transition:width .2s;'; bar.appendChild(fill); host.appendChild(bar);
  const log = el('div',''); host.appendChild(log);
  const report = (msg, ok)=>{ const d = el('div','empty-note', (ok?'✓ ':'✗ ')+msg); d.style.margin='2px 0'; d.style.color = ok?'var(--good)':'var(--danger)'; d.style.fontStyle='normal'; log.appendChild(d); };
  const step = ()=>{ done++; fill.style.width = Math.round(done/Math.max(1,totalSteps)*100)+'%'; };
  const orbitHint = (e)=>/(1665|activity|orbit|DestinyItemAction|1642|1623)/i.test(e.message) ? ' (are you in orbit/a social space? this fails inside activities)' : '';
  for(const g of plan.equips){
    try {
      if(g.holder==='vault'){ await transferItem({itemHash:g.item.hash, instanceId:g.item.instanceId, membershipType:liveSyncState.membershipType, characterId:state.selectedCharId, direction:'toCharacter'}); }
      else if(g.holder==='otherchar' && g.fromCharId){ await transferItem({itemHash:g.item.hash, instanceId:g.item.instanceId, membershipType:liveSyncState.membershipType, characterId:g.fromCharId, direction:'toVault'}); await transferItem({itemHash:g.item.hash, instanceId:g.item.instanceId, membershipType:liveSyncState.membershipType, characterId:state.selectedCharId, direction:'toCharacter'}); }
      await equipItems([g.item.instanceId], state.selectedCharId);
      report(`Equipped ${g.name}`, true);
    } catch(e){ report(`Equip ${g.name} failed: ${e.message}${orbitHint(e)}`, false); }
    step(); await sleep(SOCKET_ACTION_SPACING_MS);
  }
  for(const p of plan.subclassPlugs){
    try { await insertSocketPlugFree(p.itemId, p.socketIndex, p.plugItemHash, state.selectedCharId); report(`Set subclass: ${p.name}`, true); }
    catch(e){ report(`Set ${p.name} failed: ${e.message}${orbitHint(e)}`, false); }
    step(); await sleep(SOCKET_ACTION_SPACING_MS);
  }
  for(const m of plan.armorMods){
    try { await insertSocketPlugFree(m.itemId, m.socketIndex, m.plugItemHash, state.selectedCharId); report(`Set ${m.slot} mod: ${m.name}`, true); }
    catch(e){ report(`Set ${m.slot} mod ${m.name} failed: ${e.message}${orbitHint(e)}`, false); }
    step(); await sleep(SOCKET_ACTION_SPACING_MS);
  }
  fill.style.width='100%';
  report('Finalize complete. Re-check in-game; anything that failed can be set manually.', true);
}

// Phase 1 — character select bar at the very top of the page.
function renderCharBar(){
  const bar = document.getElementById('charBar');
  if(!bar) return;
  bar.innerHTML = '';
  bar.appendChild(el('span','cbLabel','Character'));
  const clsSel = el('select');
  clsSel.setAttribute('data-testid','charbar-class-select');
  ["Titan","Hunter","Warlock"].forEach(c=>{ const o=document.createElement('option'); o.value=c;o.textContent=c; if(c===state.cls)o.selected=true; clsSel.appendChild(o); });
  clsSel.onchange=()=>{ state.cls=clsSel.value; state.aspects=[]; state.exoticArmor=null; state.exoticTuning=null; state.classItemPerks={col1:null,col2:null}; state.super=defaultSuperFor(state.cls,state.element); state.melee=null; render(); };
  bar.appendChild(clsSel);
  const pills = el('div','cbPills');
  ELEMENTS.forEach(elem=>{
    const p = el('div','cbPill'+(elem===state.element?' active':''), elem);
    if(elem===state.element){ p.style.background=ELEMENT_COLOR[elem]; p.style.borderColor=ELEMENT_COLOR[elem]; }
    p.onclick=()=>{ state.element=elem; state.aspects=[]; state.fragments=[]; state.super=defaultSuperFor(state.cls,elem); state.grenade=null; state.melee=null; render(); };
    pills.appendChild(p);
  });
  bar.appendChild(pills);
  const auth = getStoredAuth();
  const right = el('div',''); right.style.cssText='display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;align-items:center;';
  if(auth && liveSyncState.characters){
    liveSyncState.characters.forEach(c=>{
      const cardc = el('div','charCard'+(state.selectedCharId===c.charId?' active':''));
      cardc.setAttribute('data-testid','charbar-live-'+c.charId);
      if(c.emblemPath){ const im=document.createElement('img'); im.className='cc-emblem'; im.src='https://www.bungie.net'+c.emblemPath; cardc.appendChild(im); }
      cardc.appendChild(el('div','', `<div class="cc-cls">${CLASS_TYPE_NAMES[c.classType]}</div><div class="cc-pw">◈ ${c.light||'?'}</div>`));
      cardc.onclick=()=>selectLiveCharacter(c.charId);
      right.appendChild(cardc);
    });
    if(state.selectedCharId){
      const finB = el('button','reset','Finalize Loadout ▸'); finB.setAttribute('data-testid','open-finalize-btn');
      finB.style.borderColor='var(--good)'; finB.style.color='var(--good)';
      finB.onclick=openFinalizeModal;
      right.appendChild(finB);
    }
  } else if(auth){
    const b = el('button','reset', liveSyncState.loading?'Loading…':'Load my characters'); b.setAttribute('data-testid','charbar-load-btn');
    b.disabled = liveSyncState.loading; b.onclick=()=>loadLiveCharacters();
    right.appendChild(b);
  } else {
    right.appendChild(el('span','empty-note','Sign in (menu ▸ bottom) to load your live characters & sync equipped gear.'));
  }
  bar.appendChild(right);
}


render();

// If we're returning from Bungie's sign-in page (?code=...), process it,
// then refresh the sign-in UI and pop the drawer open so the result is
// immediately visible rather than silently updating in the background.
(async ()=>{
  const cameFromOAuth = new URLSearchParams(window.location.search).has("code");
  if(cameFromOAuth){
    await handleOAuthRedirect();
    drawerAccordionOpen.signin = true;
    renderSyncPanel();
    openDrawer();
  }
})();
