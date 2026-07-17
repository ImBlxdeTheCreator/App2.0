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
  const sourceGroups={
    Weapons:sumFor(src=>/^(Kinetic|Energy|Power) \(|^Exotic Weapon:|weapon mod|weapon masterwork/i.test(src)),
    Armor:sumFor(src=>/^(Helmet|Arms|Chest|Legs|ClassItem) \(|^Exotic Armor:|^Exotic Tuning:|^Armor Set \(/i.test(src)),
    Artifact:sumFor(src=>/^Artifact:/i.test(src)),
    Subclass:sumFor(src=>/^(Arc|Solar|Void|Stasis|Strand|Prismatic) Super:|^Aspect:|^Fragment:|^Grenade:|^Melee:/i.test(src))
  };
  const categoryGrid=el('div','synergyCategoryGrid');
  Object.entries(sourceGroups).forEach(([name,value])=>{
    categoryGrid.appendChild(el('span','',name));
    categoryGrid.appendChild(el('b','',`${value>=0?'+':''}${value}%`));
  });
  root.appendChild(categoryGrid);

  const coach=el('section','panel synergyCoach');
  coach.appendChild(el('h3','','Build Coach'));
  const statModel=computeCharacterStats();
  const statTierOf=name=>statTier(Number(statModel.totals?.[name])||0);
  const findings=[];
  if(statTierOf('Health')<3)findings.push({level:'warn',text:`Health is Tier ${statTierOf('Health')}. Tier 3 (100 points) is the usual baseline before harder activities.`});
  if(statTierOf('Class')<3)findings.push({level:'warn',text:`Class is Tier ${statTierOf('Class')}. Tier 3 (100 points) is the usual baseline for reliable class performance.`});
  const emptyWeapon=['Kinetic','Energy','Power'].filter(slot=>!state.legendaryRealItem?.[slot]&&!state.legendary?.[slot]&&!(state.activeExoticWeapon&&(EXOTIC_WEAPONS.find(w=>w.name===state.activeExoticWeapon)||{}).slot===slot));
  if(emptyWeapon.length)findings.push({level:'info',text:`${emptyWeapon.map(x=>({Kinetic:'Primary',Energy:'Secondary',Power:'Heavy'}[x])).join(', ')} weapon slot${emptyWeapon.length>1?'s are':' is'} empty.`});
  const liveSets=Object.values(state.liveArmorSetByPiece||{}).map(v=>v?.name).filter(Boolean);const plannedSets=Object.values(state.armorSetByPiece||{}).filter(Boolean);const setCounts={};[...liveSets,...plannedSets].forEach(n=>setCounts[n]=(setCounts[n]||0)+1);
  Object.entries(setCounts).forEach(([name,count])=>{if(count===1||count===3)findings.push({level:'info',text:`${name} has ${count} equipped piece${count===1?'':'s'}; one more piece reaches the next set threshold.`});});
  if(!findings.length)findings.push({level:'good',text:'No major stat-tier, empty-slot, or armor-set threshold warnings detected.'});
  findings.forEach(f=>coach.appendChild(el('div',`coachFinding ${f.level}`,f.text)));
  coach.appendChild(el('div','empty-note','Coach feedback uses visible build state and verified thresholds only. It does not invent damage or survivability percentages.'));
  root.appendChild(coach);

  root.appendChild(el('div','readoutBreakdownHeading','Breakdown'));
  const details=el('div','readoutDetails');

  if(activeTags.length){
    const tagPanel = el('div','panel');
    tagPanel.appendChild(el('h3','','Active Build Verbs'));
    tagPanel.appendChild(el('div','', activeTags.map(t=>`<span class="mono" style="display:inline-block;background:var(--panel2);border:1px solid var(--line);padding:3px 8px;margin:2px;font-size:11px;border-radius:2px;">${t}</span>`).join('')));
    details.appendChild(tagPanel);
  }

  const BAR_SCALE_MAX = 100;
  BUCKETS.filter(b=>{
    const value=Number(totals[b.id])||0;
    return value!==0||(contributors[b.id]||[]).length>0;
  }).forEach(b=>{
    const val = Math.round(totals[b.id]*10)/10;
    const contribs = contributors[b.id].filter(c=>!c.inactive);
    const inactives = contributors[b.id].filter(c=>c.inactive);
    const conditionalOnly=val===0&&!contribs.length&&inactives.length;
    const panel = el('div','panel');
    const row = el('div','barrow');
    const valueLabel=conditionalOnly?'Conditional':`${val>=0?'+':''}${val}%`;
    const lbl = el('div','lbl', `<span class="name">${b.name}</span><span class="val ${val>=0?'pos':'neg'} mono">${valueLabel}</span>`);
    row.appendChild(lbl);
    const track = el('div','track');
    const fill = el('div','fill');
    fill.style.width = conditionalOnly?'0%':Math.min(100, Math.abs(val)/BAR_SCALE_MAX*100)+"%";
    if(val<0) fill.style.background="var(--danger)";
    track.appendChild(fill); row.appendChild(track);
    const srcBox = el('div','sources');
    contribs.forEach(c=>srcBox.appendChild(el('div','', `<span class="sv">${c.value>=0?'+':''}${c.value}%</span> ${c.source}${c.note?' — '+c.note:''}`)));
    inactives.forEach(c=>{
      const d=el('div','', `<span class="sv" style="color:var(--muted2);">Conditional</span> ${c.source} — ${c.note}`);
      d.style.opacity="0.65"; srcBox.appendChild(d);
    });
    row.appendChild(srcBox);
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

  const icons={Health:'◇',Melee:'⌖',Grenade:'◈',Super:'✦',Class:'◉',Weapons:'▥'};
  const rail=el('div','statRail');
  const displayOrder=['Health','Melee','Grenade','Super','Class','Weapons'];
  displayOrder.forEach(stat=>{
    const rawPoints=Number(statTotals[stat])||0;
    const points=Math.min(200,rawPoints);
    const tier=statTier(points);
    const item=el('button','statRailItem');
    item.type='button';
    item.setAttribute('aria-expanded','false');
    item.innerHTML=`<span class="statRailIcon" aria-hidden="true">${icons[stat]||'◇'}</span><span class="statRailValue">${points}</span><span class="statRailTier">${stat} · T${tier}${points>=100?'<span class="statRailIdeal">Ideal+</span>':''}</span>`;
    const details=el('span','statRailDetails');
    const nextThreshold=tier>=5?200:tier*50;
    details.innerHTML=`<span>Tier ${tier} · thresholds 0 / 50 / 100 / 150 / 200</span><span class="statRailSource"><span>Points</span><b>${points}</b></span><span class="statRailSource"><span>${tier>=5?'Maximum tier':'Next tier'}</span><b>${tier>=5?'Reached':nextThreshold}</b></span>${points>=100?'<span style="display:block;margin-top:4px;color:var(--good);">100-point ideal baseline reached.</span>':''}`;
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
    try { if(typeof renderCharBar==='function') renderCharBar(); } catch(e){ console.error('renderCharBar failed:', e); }
    try { renderBuilder(); stashAdvancedPanels?.(); syncEquipmentEditor?.(); } catch(e){ console.error('renderBuilder failed:', e); }
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
  const col=document.getElementById('readoutCol');const chev=document.getElementById('readoutChev');
  col?.classList.remove('collapsed');chev?.classList.add('open');
}
document.getElementById('readoutToggle')?.setAttribute('aria-label','Build Synergy Readout is always open');
applyReadoutCollapse();

let statsCollapsed = false;
function applyStatsCollapse(){
  const col=document.getElementById('statsCol');const chev=document.getElementById('statsChev');
  col?.classList.remove('collapsed');chev?.classList.add('open');
}
document.getElementById('statsToggle')?.setAttribute('aria-label','Character Stats are always open');
applyStatsCollapse();
