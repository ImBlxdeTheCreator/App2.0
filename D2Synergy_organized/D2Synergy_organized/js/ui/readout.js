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
  if(hintEl){
    const topBuckets = BUCKETS
      .map(b=>({name:b.name, val:Math.round(totals[b.id]*10)/10}))
      .filter(b=>Math.abs(b.val)>0.1)
      .sort((a,b)=>Math.abs(b.val)-Math.abs(a.val))
      .slice(0,3);
    hintEl.textContent = topBuckets.length
      ? topBuckets.map(b=>`${b.name} ${b.val>=0?'+':''}${b.val}%`).join('  •  ')
      : "no synergy yet";
  }

  const summary = el('div','summarybar');
  summary.appendChild(el('div','sb', `<b style="color:${ELEMENT_COLOR[state.element]}">${state.cls}</b>${state.element}`));
  summary.appendChild(el('div','sb', `<b>${state.activeExoticWeapon||'—'}</b>Exotic Weapon`));
  summary.appendChild(el('div','sb', `<b>${state.exoticArmor||'—'}</b>Exotic Armor`));
  summary.appendChild(el('div','sb', `<b>${activeTags.length}</b>Active Verbs`));
  root.appendChild(summary);

  // Character stats, shown right alongside the synergy bonuses — so you see
  // both the % bonuses AND the raw stat totals (from armor/masterwork/
  // tuning) in one place, not just buried in the separate Character Stats
  // accordion.
  const {totals: statTotals} = computeCharacterStats();
  const statBar = el('div','summarybar');
  statBar.style.marginTop = '4px';
  STAT_NAMES.forEach(stat=>{
    const val = Math.min(200, statTotals[stat] || 0);
    const tier = statTier(val);
    statBar.appendChild(el('div','sb', `<b>${val} <span style="color:var(--muted2);font-size:10px;">(T${tier})</span></b>${stat}`));
  });
  root.appendChild(statBar);

  if(activeTags.length){
    const tagPanel = el('div','panel');
    tagPanel.appendChild(el('h3','','Active Build Verbs'));
    tagPanel.appendChild(el('div','', activeTags.map(t=>`<span class="mono" style="display:inline-block;background:var(--panel2);border:1px solid var(--line);padding:3px 8px;margin:2px;font-size:11px;border-radius:2px;">${t}</span>`).join('')));
    root.appendChild(tagPanel);
  }

  const BAR_SCALE_MAX = 100; // bars are drawn on a fixed 0-100% scale, not relative to the current highest stat
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
    track.appendChild(fill);
    row.appendChild(track);

    const contribs = contributors[b.id].filter(c=>!c.inactive);
    const inactives = contributors[b.id].filter(c=>c.inactive);
    if(contribs.length || inactives.length){
      const srcBox = el('div','sources');
      contribs.forEach(c=>{
        srcBox.appendChild(el('div','', `<span class="sv">+${c.value}%</span> ${c.source}${c.note?' — '+c.note:''}`));
      });
      inactives.forEach(c=>{
        const d = el('div','', `<span class="sv" style="color:var(--muted2);">+0%</span> ${c.source} — ${c.note}`);
        d.style.opacity="0.55";
        srcBox.appendChild(d);
      });
      row.appendChild(srcBox);
    } else {
      row.appendChild(el('div','empty-note','No sources selected yet.'));
    }
    panel.appendChild(row);
    root.appendChild(panel);
  });

  const disclaimer = el('div','empty-note', 'Percentages are relative synergy estimates for build comparison — not verbatim in-game combat log numbers. Edit the DATA objects in this file to add weapons, mods, or artifacts as the sandbox evolves.');
  disclaimer.style.padding="10px 4px 20px";
  root.appendChild(disclaimer);
}

function renderCharacterStatsPanel(){
  const root = document.getElementById('statsCol');
  root.innerHTML = "";
  const {totals: statTotals, contributors: statContributors} = computeCharacterStats();

  const hintEl = document.getElementById('statsHint');
  if(hintEl){
    const topStats = STAT_NAMES
      .map(s=>({name:s, val:statTotals[s]}))
      .filter(s=>s.val!==0)
      .sort((a,b)=>Math.abs(b.val)-Math.abs(a.val))
      .slice(0,3);
    hintEl.textContent = topStats.length
      ? topStats.map(s=>`${s.name} ${s.val>=0?'+':''}${s.val}`).join('  •  ')
      : "no stat mods yet";
  }

  STAT_NAMES.forEach(stat=>{
    const rawPoints = statTotals[stat];
    const points = Math.min(200, rawPoints); // stats cap at 200 in-game; anything beyond is wasted
    const wasted = rawPoints > 200 ? rawPoints - 200 : 0;
    const tier = statTier(points);
    const panel = el('div','panel');
    const row = el('div','barrow');
    const lbl = el('div','lbl', `<span class="name">${stat}</span><span class="val ${points>=0?'pos':'neg'} mono">${points>=0?'+':''}${points} <span style="color:var(--muted2);">(T${tier})</span>${wasted?` <span style="color:var(--danger);font-size:10px;">+${wasted} wasted</span>`:''}</span>`);
    row.appendChild(lbl);
    const track = el('div','track');
    const fill = el('div','fill');
    fill.style.width = Math.max(0, Math.min(100, (points/200)*100))+"%";
    if(points<0) fill.style.background="var(--danger)";
    track.appendChild(fill);
    row.appendChild(track);

    const contribs = statContributors[stat];
    if(contribs.length){
      const srcBox = el('div','sources');
      contribs.forEach(c=>{
        srcBox.appendChild(el('div','', `<span class="sv">${c.value>=0?'+':''}${c.value}</span> ${c.source}`));
      });
      row.appendChild(srcBox);
    } else {
      row.appendChild(el('div','empty-note','No tuning mods selected — base armor stat rolls aren\u2019t modeled yet.'));
    }
    panel.appendChild(row);
    root.appendChild(panel);
  });
  const statsDisclaimer = el('div','empty-note', 'Currently reflects Tier 5 Armor Tuning mod trades only \u2014 real per-piece base stat rolls (exotic armor, legendary armor) aren\u2019t modeled yet, so these numbers are a partial picture, not your true in-game total.');
  statsDisclaimer.style.padding="10px 4px 20px";
  root.appendChild(statsDisclaimer);
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

