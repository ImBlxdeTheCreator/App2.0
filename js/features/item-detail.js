/* DIM-style item detail modal
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   PHASE 3 — DIM-STYLE ITEM DETAIL
   ========================================================================= */
const idOverlay = document.getElementById('itemDetailOverlay');
function closeItemDetail(){ idOverlay.classList.remove('open'); }
idOverlay.onclick = (e)=>{ if(e.target===idOverlay) closeItemDetail(); };
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && idOverlay.classList.contains('open')) closeItemDetail(); });
const IGNORE_STAT_HASHES = new Set([1935470627]);
async function openItemDetail(it){
  const def = it._def || await getItemDefinition(it.hash);
  const card = document.getElementById('itemDetailCard');
  const dmg = FS_DMG[def.damageType];
  card.innerHTML = '';
  const head = el('div','idHead'+(def.tierType===6?' exotic':''));
  if(def.icon){ const im=document.createElement('img'); im.className='idIcon'; im.src=def.icon; head.appendChild(im); }
  const titleWrap = el('div','');
  titleWrap.appendChild(el('div','idName', def.name));
  titleWrap.appendChild(el('div','idType', `${def.typeName||''}${dmg?` • ${dmg.n}`:''}${def.tierType===6?' • Exotic':''}${it.isMasterworked?'<span class="idMwBadge">◆ Masterworked</span>':''}`));
  head.appendChild(titleWrap);
  if(it.power) head.appendChild(el('div','idPower', '◈ '+it.power));
  const closeB = el('button','idClose','×'); closeB.setAttribute('data-testid','item-detail-close'); closeB.onclick = closeItemDetail;
  head.appendChild(closeB);
  card.appendChild(head);
  const bodyEl = el('div','idBody'); card.appendChild(bodyEl);
  idOverlay.classList.add('open');
  if(it.stats && Object.keys(it.stats).length){
    bodyEl.appendChild(el('div','idSectionLabel','Stats'));
    const statHost = el('div',''); bodyEl.appendChild(statHost);
    const entries = Object.values(it.stats).filter(s=>!IGNORE_STAT_HASHES.has(s.statHash));
    for(const s of entries){
      const row = el('div','idStat');
      row.appendChild(el('div','sn','…'));
      const track = el('div','st'); const fill = el('div','sf');
      fill.style.width = Math.max(2, Math.min(100, (s.value/(s.value>100?200:100))*100))+'%';
      track.appendChild(fill); row.appendChild(track);
      row.appendChild(el('div','sv', String(s.value)));
      statHost.appendChild(row);
      getManifestEntity('DestinyStatDefinition', s.statHash).then(sd=>{ row.querySelector('.sn').textContent = sd?.displayProperties?.name || ('#'+s.statHash); }).catch(()=>{ row.querySelector('.sn').textContent = '#'+s.statHash; });
    }
  }
  const plugHashes = (it.sockets||[]).filter(s=>s.plugHash).map(s=>s.plugHash);
  if(plugHashes.length){
    bodyEl.appendChild(el('div','idSectionLabel','Perks, Mods, Shaders & Ornaments'));
    const host = el('div','idSockets'); bodyEl.appendChild(host);
    for(const ph of plugHashes){
      const plug = el('div','idPlug'); plug.textContent='…'; host.appendChild(plug);
      getItemDefinition(ph).then(pd=>{ plug.textContent=''; if(pd.icon){ const im=document.createElement('img'); im.src=pd.icon; plug.appendChild(im); } plug.appendChild(el('span','', pd.name||('#'+ph))); }).catch(()=>{ plug.textContent = '#'+ph; });
    }
  }
  if((!it.stats || !Object.keys(it.stats).length) && !plugHashes.length){
    bodyEl.appendChild(el('div','empty-note','No detailed stat/socket data available (non-instanced item, or not returned by the API).'));
  }
}

