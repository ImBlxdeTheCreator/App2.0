/* Synergy readout, character stats, and accordion behavior
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   RENDER — READOUT (right column)
   ========================================================================= */
function renderReadout(){
  const root = document.getElementById('readoutCol');
  root.innerHTML = "";
  const {totals, contributors, activeTags} = computeSynergy();

  const hintEl = document.getElementById('readoutHint');
  if(hintEl) hintEl.textContent = `${activeTags.length} active effects`;

  // Uses the existing synergy-engine outputs; no new unverified modifier is
  // invented by the layout. This is an aggregate index of the currently
  // calculated buckets, with conditional/utility effects remaining in their
  // existing categorized rows below.
  const totalSynergy = Math.round(BUCKETS.reduce((sum,b)=>sum+Math.max(0,Number(totals[b.id])||0),0)*10)/10;
  const hero=el('section','synergyHero');
  hero.appendChild(el('div','synergyHeroLabel','Total Synergy'));
  hero.appendChild(el('div','synergyHeroValue',`+${totalSynergy}%`));
  hero.appendChild(el('div','synergyHeroState',`${activeTags.length?'● Active':'○ Incomplete'}`));
  root.appendChild(hero);

  const allContributors=BUCKETS.flatMap(b=>(contributors[b.id]||[]).filter(c=>!c.inactive));
  const sumFor=predicate=>Math.round(allContributors.filter(c=>predicate(String(c.source||''))).reduce((sum,c)=>sum+(Number(c.value)||0),0)*10)/10;
  const weaponNames=[state.activeExoticWeapon,...Object.values(state.legendaryWeapons||{}).flatMap(v=>Array.isArray(v)?v:[v])].filter(Boolean);
  const armorNames=[state.exoticArmor,state.exoticTuning].filter(Boolean);
  const artifactNames=(state.artifactPerks||[]).filter(Boolean);
  const sourceGroups={
    Weapons:sumFor(src=>weaponNames.some(name=>src.includes(name))),
    Armor:sumFor(src=>armorNames.some(name=>src.includes(name))||/armor|mod|surge|font/i.test(src)),
    Artifact:sumFor(src=>artifactNames.some(name=>src.includes(name))||/artifact/i.test(src)),
    Subclass:sumFor(src=>/fragment|aspect|grenade|melee|super|class ability|radiant|restoration|woven|overshield|frost/i.test(src))
  };
  const categoryGrid=el('div','synergyCategoryGrid');
  Object.entries(sourceGroups).forEach(([name,value])=>{
    categoryGrid.appendChild(el('span','',name));
    categoryGrid.appendChild(el('b','',`${value>=0?'+':''}${value}%`));
  });
  root.appendChild(categoryGrid);

  const breakdownButton=el('button','synergyBreakdownButton','› Breakdown');
  breakdownButton.type='button';
  root.appendChild(breakdownButton);
  const details=el('div','readoutDetails collapsedDetails');
  breakdownButton.onclick=()=>{
    const closed=details.classList.toggle('collapsedDetails');
    breakdownButton.textContent=`${closed?'›':'⌄'} Breakdown`;
  };

  if(activeTags.length){
    const tagPanel = el('div','panel');
    tagPanel.appendChild(el('h3','','Active Build Verbs'));
    tagPanel.appendChild(el('div','', activeTags.map(t=>`<span class="mono" style="display:inline-block;background:var(--panel2);border:1px solid var(--line);padding:3px 8px;margin:2px;font-size:11px;border-radius:2px;">${t}</span>`).join('')));
    details.appendChild(tagPanel);
  }

  const BAR_SCALE_MAX = 100;
  BUCKETS.forEach(b=>{
    const val = Math.round(totals[b.id]*10)/10;
    const panel = el('div','panel');
    const row = el('div','barrow');
    const lbl = el('div','lbl', `<span class="name">${b.name}</span><span class="val ${val>=0?'pos':'neg'} mono">${val>=0?'+':''}${val}%</span>`);
    row.appendChild(lbl);
    const track = el('div','track');
    const fill = el('div','fill');
    fill.style.width = Math.min(100, Math.abs(val)/BAR_SCALE_MAX*100)+"%";
    if(val<0) fill.style.background="var(--danger)";
    track.appendChild(fill); row.appendChild(track);
    const contribs = contributors[b.id].filter(c=>!c.inactive);
    const inactives = contributors[b.id].filter(c=>c.inactive);
    if(contribs.length || inactives.length){
      const srcBox = el('div','sources');
      contribs.forEach(c=>srcBox.appendChild(el('div','', `<span class="sv">+${c.value}%</span> ${c.source}${c.note?' — '+c.note:''}`)));
      inactives.forEach(c=>{
        const d=el('div','', `<span class="sv" style="color:var(--muted2);">+0%</span> ${c.source} — ${c.note}`);
        d.style.opacity="0.55"; srcBox.appendChild(d);
      });
      row.appendChild(srcBox);
    } else row.appendChild(el('div','empty-note','No sources selected yet.'));
    panel.appendChild(row); details.appendChild(panel);
  });
  const disclaimer = el('div','empty-note', 'Only effects currently represented by the synergy engine contribute to this readout. Conditional and informational effects remain visible in the breakdown and are not silently treated as always active.');
  disclaimer.style.padding="10px 4px 20px"; details.appendChild(disclaimer);
  root.appendChild(details);
}
function renderCharacterStatsPanel(){
  const root = document.getElementById('statsCol');
  root.innerHTML = "";
  const {totals: statTotals, contributors: statContributors} = computeCharacterStats();
  const hintEl = document.getElementById('statsHint');
  if(hintEl) hintEl.textContent = 'Select a stat for details';

  const icons={Mobility:'✦',Resilience:'▥',Recovery:'◉',Discipline:'◈',Intellect:'△',Strength:'⌖'};
  const rail=el('div','statRail');
  STAT_NAMES.forEach(stat=>{
    const rawPoints=Number(statTotals[stat])||0;
    const points=Math.min(200,rawPoints);
    const tier=statTier(points);
    const item=el('button','statRailItem');
    item.type='button';
    item.setAttribute('aria-expanded','false');
    item.innerHTML=`<span class="statRailIcon" aria-hidden="true">${icons[stat]||'◇'}</span><span class="statRailValue">${points}</span><span class="statRailTier">${stat} · T${tier}</span>`;
    const details=el('span','statRailDetails');
    details.innerHTML=`<span>Tier ${tier}</span><span class="statRailSource"><span>Points</span><b>${points}</b></span>`;
    const sources=statContributors[stat]||[];
    if(sources.length){
      sources.slice(0,5).forEach(c=>details.insertAdjacentHTML('beforeend',`<span class="statRailSource"><span>${c.source}</span><b>${c.value>=0?'+':''}${c.value}</b></span>`));
    }else details.insertAdjacentHTML('beforeend','<span style="display:block;margin-top:4px;">No modeled source breakdown.</span>');
    if(rawPoints>200)details.insertAdjacentHTML('beforeend',`<span style="display:block;margin-top:4px;color:var(--danger);">${rawPoints-200} points above cap</span>`);
    item.appendChild(details);
    item.onclick=()=>{
      const open=!item.classList.contains('open');
      rail.querySelectorAll('.statRailItem.open').forEach(other=>{other.classList.remove('open');other.setAttribute('aria-expanded','false');});
      if(open){item.classList.add('open');item.setAttribute('aria-expanded','true');}
    };
    rail.appendChild(item);
  });
  root.appendChild(rail);
}
let __renderQueued = false;
let __renderCallbacks = [];
// Phase 5 — coalesce multiple state changes in the same tick into ONE DOM
// rebuild (rAF-batched) instead of rebuilding synchronously on every tweak.
function render(cb){
  if(cb) __renderCallbacks.push(cb);
  if(__renderQueued) return;
  __renderQueued = true;
  requestAnimationFrame(()=>{
    __renderQueued = false;
    // Each of these used to run as one unbroken chain — if any single one
    // threw (e.g. a bug in one builder panel), everything after it in the
    // SAME call would silently never run, which is exactly how "several
    // unrelated sections just stopped displaying" bugs happen. Isolating
    // them means one broken piece can't take the others down with it.
    try { renderCharBar(); } catch(e){ console.error('renderCharBar failed:', e); }
    try { renderBuilder(); } catch(e){ console.error('renderBuilder failed:', e); }
    try { renderReadout(); } catch(e){ console.error('renderReadout failed:', e); }
    try { renderCharacterStatsPanel(); } catch(e){ console.error('renderCharacterStatsPanel failed:', e); }
    const cbs = __renderCallbacks; __renderCallbacks = [];
    cbs.forEach(fn=>{ try{ fn(); }catch(e){} });
  });
}
// Partial re-render: only the readout + stats panels (used when the builder
// DOM structure hasn't changed), avoiding a full builder rebuild.
function renderReadoutOnly(){
  renderReadout();
  renderCharacterStatsPanel();
}

document.getElementById('resetBtn').onclick = resetState;

let readoutCollapsed = false;
function applyReadoutCollapse(){
  const col = document.getElementById('readoutCol');
  const chev = document.getElementById('readoutChev');
  if(readoutCollapsed){ col.classList.add('collapsed'); chev.classList.remove('open'); }
  else { col.classList.remove('collapsed'); chev.classList.add('open'); }
}
document.getElementById('readoutToggle').onclick = ()=>{
  readoutCollapsed = !readoutCollapsed;
  applyReadoutCollapse();
};
applyReadoutCollapse();

let statsCollapsed = true;
function applyStatsCollapse(){
  const col = document.getElementById('statsCol');
  const chev = document.getElementById('statsChev');
  if(statsCollapsed){ col.classList.add('collapsed'); chev.classList.remove('open'); }
  else { col.classList.remove('collapsed'); chev.classList.add('open'); }
}
document.getElementById('statsToggle').onclick = ()=>{
  statsCollapsed = !statsCollapsed;
  applyStatsCollapse();
};
applyStatsCollapse();

