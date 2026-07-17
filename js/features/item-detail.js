/* DIM-inspired item detail modal.
   Uses the exact item instance, Bungie manifest stats, equipped socket plugs,
   reusable plugs, and plug-set definitions. It is display-only: clicking a
   socket inspects it but never changes the in-game roll. */
const idOverlay=document.getElementById('itemDetailOverlay');
const IGNORE_STAT_HASHES=new Set([1935470627]);
const DIM_UTILITY_SOCKET_RE=/(shader|ornament|tracker|masterwork|memento|enhancement|crafting|empty|default ornament|gear tier|deepsight|kill tracker)/i;
const DIM_HIDDEN_PLACEHOLDER_RE=/^(empty|no perk|none|deprecated)$/i;
const DIM_STAT_NAME_ORDER=['Impact','Range','Stability','Handling','Reload Speed','Aim Assistance','Zoom','Airborne Effectiveness','Recoil Direction','Rounds Per Minute','Charge Time','Draw Time','Magazine','Blast Radius','Velocity','Guard Resistance','Guard Endurance','Swing Speed','Shield Duration','Ammo Capacity','Mobility','Resilience','Recovery','Discipline','Intellect','Strength'];
let __dimDetailToken=0;
let __dimDetailContext=null;

function closeItemDetail(){
  __dimDetailToken+=1;__dimDetailContext=null;idOverlay.classList.remove('open');document.body.classList.remove('itemDetailOpen');
  document.getElementById('dimMoveMenu')?.remove();
}
idOverlay.onclick=e=>{if(e.target===idOverlay)closeItemDetail();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&idOverlay.classList.contains('open'))closeItemDetail();});

function dimText(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
function dimIcon(src,cls,alt,type='universal'){const img=document.createElement('img');if(cls)img.className=cls;D2Assets.setImage(img,{name:alt||'',icon:src},type,{alt:alt||''});return img;}
function dimDamageClass(damageType){return({2:'arc',3:'solar',4:'void',6:'stasis',7:'strand',1:'kinetic'})[damageType]||'neutral';}
function dimCategoryLabel(def){
  const id=String(def?.plugCategoryIdentifier||'').replace(/[._-]+/g,' ').trim();
  const text=`${id} ${def?.typeName||''} ${def?.name||''}`;
  if(/intrinsic|frame/i.test(text))return'Intrinsic Trait';
  if(/barrel|scope|sight/i.test(text))return'Barrel / Sight';
  if(/magazine|battery|mag perk/i.test(text))return'Magazine / Battery';
  if(/origin/i.test(text))return'Origin Trait';
  if(/trait|perk/i.test(text))return'Trait';
  if(/masterwork|enhancement|crafting/i.test(text))return'Masterwork / Enhancement';
  if(/shader/i.test(text))return'Shader';
  if(/ornament/i.test(text))return'Ornament';
  if(/tracker/i.test(text))return'Tracker';
  if(/mod/i.test(text))return'Mod';
  return def?.typeName||'Socketed Perk';
}
function dimIsUtilityPlug(def){return DIM_UTILITY_SOCKET_RE.test(`${def?.plugCategoryIdentifier||''} ${def?.name||''} ${def?.typeName||''}`);}
function dimShouldHidePlug(def){const n=String(def?.name||'').trim();return!n||DIM_HIDDEN_PLACEHOLDER_RE.test(n);}
function dimStatSort(a,b){const ai=DIM_STAT_NAME_ORDER.indexOf(a.name),bi=DIM_STAT_NAME_ORDER.indexOf(b.name);if(ai!==-1||bi!==-1)return(ai===-1?999:ai)-(bi===-1?999:bi);return a.name.localeCompare(b.name);}
function dimStatMax(name,value){if(/Rounds Per Minute|Charge Time|Draw Time|Magazine|Zoom/i.test(name))return Math.max(value,100);return 100;}

function d2ChampionCapability(def,groups=[]){
  if(Number(def?.itemType)!==3)return null;
  const intrinsic=groups.flatMap(g=>[g.selectedDef,...g.choices.map(c=>c.def)]).filter(Boolean).map(x=>`${x.name||''} ${x.typeName||''} ${x.description||''}`).join(' ');
  const text=`${def?.name||''} ${def?.typeName||''} ${intrinsic}`.toLowerCase();
  // Update 9.7.0 Anti-Champion 2.0: specific frames override the base frame family.
  const specific=[
    [/support.*auto|support frame/,'Overload'],[/adaptive burst.*linear|adaptive burst.*lfr/,'Barrier'],[/area denial.*grenade|area denial.*gl/,'Overload'],
    [/(double fire|micro-missile|wave frame).*grenade|compressed wave.*grenade/,'Unstoppable'],[/heavy burst.*hand cannon/,'Unstoppable'],[/spread shot.*hand cannon/,'Overload'],
    [/aggressive burst.*smg/,'Unstoppable'],[/aggressive burst.*pulse|heavy burst.*pulse|rocket-assisted pulse/,'Unstoppable'],[/legacy pr-55/,'Barrier'],
    [/rocket-assisted sidearm/,'Unstoppable'],[/disruption.*sniper/,'Barrier'],[/caster.*sword/,'Barrier'],[/vortex.*sword/,'Overload'],[/wave.*sword/,'Unstoppable'],
    [/(dynamic heat|balanced heat)/,'Overload']
  ];
  for(const [re,effect] of specific)if(re.test(text))return{effect,source:'Weapon frame'};
  if(/precision/.test(text))return{effect:'Barrier',source:'Precision frame'};
  if(/adaptive/.test(text))return{effect:'Barrier',source:'Adaptive frame'};
  if(/lightweight/.test(text))return{effect:'Overload',source:'Lightweight frame'};
  if(/rapid[- ]?fire/.test(text))return{effect:'Overload',source:'Rapid-Fire frame'};
  if(/aggressive/.test(text))return{effect:'Unstoppable',source:'Aggressive frame'};
  if(/high[- ]?impact/.test(text))return{effect:'Unstoppable',source:'High-Impact frame'};
  return{effect:'Unknown',source:'Frame definition unavailable'};
}
window.D2ChampionCapability=d2ChampionCapability;

function dimSetActiveTab(card,tabName){card.querySelectorAll('.dimTab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tabName));card.querySelectorAll('.dimTabPanel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tabName));}

async function dimResolveDefinition(hash){try{return await getItemDefinition(hash);}catch(e){return null;}}
async function dimPlugSetHashes(entry){
  const hashes=[];
  for(const setHash of [entry?.reusablePlugSetHash,entry?.randomizedPlugSetHash]){
    if(!setHash)continue;
    try{
      const set=await getManifestEntity('DestinyPlugSetDefinition',setHash);
      (set?.reusablePlugItems||[]).forEach(p=>{if(p.plugItemHash)hashes.push(p.plugItemHash);});
    }catch(e){}
  }
  return hashes;
}
async function dimBuildSocketGroups(it,itemDef,token){
  const visible=(it.sockets||[]).filter(s=>s.plugHash&&s.isVisible!==false);
  const selectedDefs=await Promise.all(visible.map(s=>dimResolveDefinition(s.plugHash)));
  if(token!==__dimDetailToken)return[];
  return Promise.all(visible.map(async(socket,index)=>{
    const selectedDef=selectedDefs[index];
    if(!selectedDef||dimShouldHidePlug(selectedDef))return null;
    const utility=dimIsUtilityPlug(selectedDef);
    let candidateHashes=[socket.plugHash,...(socket.reusablePlugHashes||[])];
    if(!utility){
      const entry=itemDef.socketEntries?.[socket.index];
      candidateHashes.push(...(entry?.reusablePlugItemHashes||[]));
      candidateHashes.push(...await dimPlugSetHashes(entry));
    }
    // Tiered weapons can expose 2/4/6 choices per column. Keep every
    // per-instance reusable plug, inline socket plug, and Plug Set entry.
    candidateHashes=Array.from(new Set(candidateHashes.filter(Boolean))).slice(0,utility?1:120);
    const defs=await Promise.all(candidateHashes.map(dimResolveDefinition));
    const choices=[];const seen=new Set();
    defs.forEach(def=>{
      if(!def||dimShouldHidePlug(def)||seen.has(def.hash))return;
      if(utility&&def.hash!==socket.plugHash)return;
      seen.add(def.hash);choices.push({def,selected:def.hash===socket.plugHash});
    });
    if(!choices.some(c=>c.selected))choices.unshift({def:selectedDef,selected:true});
    choices.sort((a,b)=>Number(b.selected)-Number(a.selected)||a.def.name.localeCompare(b.def.name));
    return {socket,selectedDef,utility,category:dimCategoryLabel(selectedDef),choices};
  })).then(groups=>{
    // Bungie can expose mirrored/enhanced socket entries that resolve to the
    // exact same selected plug and choice pool. Collapse those duplicates so
    // barrels, magazines, traits, and origin traits render once per real column.
    const unique=[];const seen=new Set();
    for(const group of groups.filter(Boolean)){
      const selectedHash=group.selectedDef?.hash||group.socket?.plugHash||0;
      const choiceHashes=group.choices.map(c=>c.def?.hash).filter(Boolean).sort((a,b)=>a-b);
      const signature=`${group.category}|${selectedHash}|${choiceHashes.join(',')}`;
      if(seen.has(signature))continue;
      seen.add(signature);unique.push(group);
    }
    return unique;
  });
}

function dimRenderPlugInspector(host,plug){
  host.textContent='';
  if(!plug){host.appendChild(dimText('div','dimEmptyInspector','Select a perk to inspect it.'));return;}
  const top=dimText('div','dimInspectorTop');const iw=dimText('div','dimInspectorIcon');
  if(plug.def.icon)iw.appendChild(dimIcon(plug.def.icon,'',plug.def.name));
  top.appendChild(iw);const copy=dimText('div','dimInspectorCopy');copy.appendChild(dimText('div','dimInspectorCategory',dimCategoryLabel(plug.def)));copy.appendChild(dimText('div','dimInspectorName',plug.def.name));
  if(plug.selected)copy.appendChild(dimText('div','dimEquippedLabel','Equipped'));top.appendChild(copy);host.appendChild(top);
  host.appendChild(dimText('div','dimInspectorDescription',plug.def.description||'No description is available in the public manifest.'));
}
function dimSocketShape(def){
  const c=dimCategoryLabel(def).toLowerCase();
  if(/intrinsic|frame/.test(c))return' intrinsic';
  if(/origin/.test(c))return' origin';
  return'';
}
function dimBuildSocketChoice(choice,inspector,column){
  const b=dimText('button','dimSocketButton'+dimSocketShape(choice.def));b.type='button';b.title=`${dimCategoryLabel(choice.def)}: ${choice.def.name}`;b.setAttribute('aria-label',b.title);
  if(choice.def.icon)b.appendChild(dimIcon(choice.def.icon,'dimSocketIcon',choice.def.name));else b.appendChild(dimText('span','dimSocketFallback','◆'));
  if(choice.selected)b.classList.add('equipped','selected');
  b.onclick=()=>{column.closest('.dimSocketMatrix')?.querySelectorAll('.dimSocketButton').forEach(x=>x.classList.remove('inspecting'));b.classList.add('inspecting');dimRenderPlugInspector(inspector,choice);};
  return b;
}
function dimBuildSocketColumn(group,inspector){
  const col=dimText('div','dimSocketColumn');col.dataset.category=group.category;col.dataset.choiceCount=String(group.choices.length);
  group.choices.forEach(choice=>col.appendChild(dimBuildSocketChoice(choice,inspector,col)));
  col.appendChild(dimText('span','dimSocketChoiceCount',`${group.choices.length} choice${group.choices.length===1?'':'s'}`));
  return col;
}
function dimBuildMoveMenu(button,it,context){
  const store=context?.store,chars=context?.chars||[];
  if(!store||it.equipped||!it.instanceId||Number(it.transferStatus||0)!==0){button.disabled=true;button.title=it.equipped?'Equipped items must be unequipped before transfer.':'This item cannot be transferred.';return;}
  button.onclick=ev=>{
    ev.stopPropagation();const old=document.getElementById('dimMoveMenu');if(old){old.remove();return;}
    const menu=dimText('div','dimMoveMenu');menu.id='dimMoveMenu';
    if(store.kind==='character'){const b=dimText('button','','Vault');b.type='button';b.onclick=async()=>{menu.remove();closeItemDetail();await fsDoMove(it,store,{toVault:true});};menu.appendChild(b);}
    chars.forEach(c=>{if(store.kind==='character'&&c.charId===store.charId)return;const b=dimText('button','',CLASS_TYPE_NAMES[c.classType]||'Character');b.type='button';b.onclick=async()=>{menu.remove();closeItemDetail();await fsDoMove(it,store,{toCharacterId:c.charId});};menu.appendChild(b);});
    button.parentElement.appendChild(menu);
  };
}
function dimSummaryStats(statRows,it){
  const priority=['Impact','Range','Stability','Handling','Charge Time','Draw Time','Reload Speed','Mobility','Resilience','Recovery'];
  const picked=[];
  for(const name of priority){const s=statRows.find(x=>x.name===name);if(s&&!picked.includes(s))picked.push(s);if(picked.length===3)break;}
  for(const s of statRows){if(picked.length===3)break;if(!picked.includes(s))picked.push(s);}
  return [{name:'Power',value:it.power||'—',power:true},...picked];
}

async function openItemDetail(it,context){
  const token=++__dimDetailToken;__dimDetailContext=context||null;
  const card=document.getElementById('itemDetailCard');card.textContent='';card.className='idCard dimDetailCard loading';idOverlay.classList.add('open');document.body.classList.add('itemDetailOpen');card.appendChild(dimText('div','dimLoading','Loading item details…'));
  let def;
  try{def=it._def||await getItemDefinition(it.hash);}catch(err){if(token!==__dimDetailToken)return;card.textContent='';card.appendChild(dimText('div','dimError',`Unable to load this item: ${err.message}`));return;}
  const [groups,statRows]=await Promise.all([
    dimBuildSocketGroups(it,def,token),
    Promise.all(Object.values(it.stats||{}).filter(s=>!IGNORE_STAT_HASHES.has(s.statHash)).map(async s=>{try{const sd=await getManifestEntity('DestinyStatDefinition',s.statHash);return{hash:s.statHash,name:sd?.displayProperties?.name||`#${s.statHash}`,value:s.value};}catch(e){return{hash:s.statHash,name:`#${s.statHash}`,value:s.value};}})),
  ]);
  if(token!==__dimDetailToken)return;statRows.sort(dimStatSort);
  const coreGroups=groups.filter(g=>!g.utility),utilityGroups=groups.filter(g=>g.utility);
  const originGroups=coreGroups.filter(g=>g.category==='Origin Trait');
  const perkGroups=coreGroups.filter(g=>g.category!=='Origin Trait');
  card.textContent='';card.className=`idCard dimDetailCard ${dimDamageClass(def.damageType)}${def.tierType===6?' exotic':''}`;

  const hero=dimText('header','dimHero');const iconFrame=dimText('div','dimItemIconFrame');if(def.icon)iconFrame.appendChild(dimIcon(def.icon,'dimItemIcon',def.name));hero.appendChild(iconFrame);
  const heroCopy=dimText('div','dimHeroCopy');heroCopy.appendChild(dimText('h2','dimItemName',def.name));
  const meta=[def.typeName||fsBucketLabel(it)];const dmg=FS_DMG[def.damageType];if(dmg)meta.push(dmg.n);if(def.tierType===6)meta.push('Exotic');if(Number(it.gearTier)>=1&&Number(it.gearTier)<=5)meta.push(`Tier ${Number(it.gearTier)}`);if(Number(it.quantity||1)>1)meta.push(`Quantity ${Number(it.quantity).toLocaleString()}`);
  heroCopy.appendChild(dimText('div','dimItemMeta',meta.join(' • ')));hero.appendChild(heroCopy);
  const close=dimText('button','dimClose','×');close.type='button';close.onclick=closeItemDetail;close.setAttribute('aria-label','Close item details');hero.appendChild(close);card.appendChild(hero);

  const tabs=dimText('nav','dimTabs');[['overview','Overview'],['perks','Perks'],['triage','Triage'],['compare','Compare'],['loadouts','Loadouts']].forEach(([id,label],i)=>{const b=dimText('button','dimTab'+(i===0?' active':''),label);b.type='button';b.dataset.tab=id;b.onclick=()=>dimSetActiveTab(card,id);tabs.appendChild(b);});card.appendChild(tabs);
  const content=dimText('div','dimContent');card.appendChild(content);
  const overview=dimText('section','dimTabPanel active');overview.dataset.panel='overview';const perksPanel=dimText('section','dimTabPanel');perksPanel.dataset.panel='perks';const triage=dimText('section','dimTabPanel');triage.dataset.panel='triage';const compare=dimText('section','dimTabPanel');compare.dataset.panel='compare';const loadouts=dimText('section','dimTabPanel');loadouts.dataset.panel='loadouts';content.append(overview,perksPanel,triage,compare,loadouts);

  const summary=dimText('section','dimSummaryBand');
  dimSummaryStats(statRows,it).forEach(s=>{const cell=dimText('div','dimSummaryCell'+(s.power?' power':''));cell.appendChild(dimText('div','dimSummaryValue',s.value));cell.appendChild(dimText('div','dimSummaryLabel',s.name));summary.appendChild(cell);});
  overview.appendChild(summary);

  const champion=d2ChampionCapability(def,groups);
  if(champion){const cap=dimText('section','dimSection dimChampionSection');cap.appendChild(dimText('div','dimSectionTitle','Champion Capability'));const row=dimText('div','dimChampionCapability');row.appendChild(dimText('strong','',champion.effect));row.appendChild(dimText('span','',champion.source+' · applies immediately on weapon hits'));cap.appendChild(row);overview.appendChild(cap);}
  const inspector=dimText('div','dimPlugInspector');
  const perkSection=dimText('section','dimSection dimSocketSection');perkSection.appendChild(dimText('div','dimSectionTitle','Weapon Perks'));
  if(perkGroups.length){const matrix=dimText('div','dimSocketMatrix');perkGroups.forEach(g=>matrix.appendChild(dimBuildSocketColumn(g,inspector)));perkSection.appendChild(matrix);const selected=perkGroups.flatMap(g=>g.choices).find(c=>c.selected)||perkGroups[0].choices[0];dimRenderPlugInspector(inspector,selected);perkSection.appendChild(inspector);}else{perkSection.appendChild(dimText('div','dimNoSockets','No weapon perk sockets were returned for this item.'));}
  overview.appendChild(perkSection);
  if(originGroups.length){
    const origin=dimText('section','dimSection dimOriginSection');origin.appendChild(dimText('div','dimSectionTitle','Origin Traits'));
    const originInspector=dimText('div','dimPlugInspector');const matrix=dimText('div','dimSocketMatrix');
    originGroups.forEach(g=>matrix.appendChild(dimBuildSocketColumn(g,originInspector)));origin.appendChild(matrix);
    const selectedOrigin=originGroups.flatMap(g=>g.choices).find(c=>c.selected)||originGroups[0]?.choices?.[0];
    if(selectedOrigin){dimRenderPlugInspector(originInspector,selectedOrigin);origin.appendChild(originInspector);}overview.appendChild(origin);
  }

  if(def.description){const desc=dimText('section','dimDescriptionBlock');desc.appendChild(dimText('div','dimDescriptionText',def.description));overview.appendChild(desc);}

  if(statRows.length){const stats=dimText('section','dimSection dimStatsSection');stats.appendChild(dimText('div','dimSectionTitle','Stats'));const grid=dimText('div','dimStatsGrid');statRows.forEach(stat=>{const row=dimText('div','dimStatRow');row.appendChild(dimText('div','dimStatName',stat.name));const track=dimText('div','dimStatTrack');const fill=dimText('div','dimStatFill');fill.style.width=Math.max(1,Math.min(100,(stat.value/dimStatMax(stat.name,stat.value))*100))+'%';track.appendChild(fill);row.appendChild(track);row.appendChild(dimText('div','dimStatValue',stat.value));grid.appendChild(row);});stats.appendChild(grid);overview.appendChild(stats);}

  if(utilityGroups.length){const util=dimText('section','dimSection dimUtilitySection');util.appendChild(dimText('div','dimSectionTitle','Cosmetics & Utilities'));const rail=dimText('div','dimUtilityRail');utilityGroups.forEach(g=>{const choice=g.choices.find(c=>c.selected)||g.choices[0];if(choice)rail.appendChild(dimBuildSocketChoice(choice,inspector,rail));});util.appendChild(rail);overview.appendChild(util);}

  const allPerks=dimText('div','dimAllPerks');groups.flatMap(g=>g.choices.filter(c=>c.selected)).forEach(choice=>{const row=dimText('article','dimPerkCard');const iw=dimText('div','dimPerkCardIcon');if(choice.def.icon)iw.appendChild(dimIcon(choice.def.icon,'',choice.def.name));row.appendChild(iw);const copy=dimText('div','dimPerkCardCopy');copy.appendChild(dimText('div','dimPerkCardCategory',dimCategoryLabel(choice.def)));copy.appendChild(dimText('div','dimPerkCardName',choice.def.name));copy.appendChild(dimText('div','dimPerkCardDescription',choice.def.description||'No public manifest description.'));row.appendChild(copy);allPerks.appendChild(row);});
  if(!allPerks.childElementCount)allPerks.appendChild(dimText('div','dimEmptyTab','No socketed perks were returned.'));perksPanel.appendChild(allPerks);
  triage.appendChild(dimText('div','dimEmptyTab','Triage notes are not assigned to this item yet.'));compare.appendChild(dimText('div','dimEmptyTab','Comparison opens when another item is selected.'));loadouts.appendChild(dimText('div','dimEmptyTab','No saved loadout references are available for this item.'));

  const actions=dimText('footer','dimActions');const lock=dimText('button','dimAction','Lock');lock.type='button';lock.disabled=true;lock.title='Item lock writing is not enabled.';const tag=dimText('button','dimAction','Tag');tag.type='button';tag.disabled=true;tag.title='Tags are local app metadata.';const move=dimText('button','dimAction primary','Move');move.type='button';dimBuildMoveMenu(move,it,context||{});const closeAction=dimText('button','dimAction','Close');closeAction.type='button';closeAction.onclick=closeItemDetail;actions.append(lock,tag,move,closeAction);card.appendChild(actions);
}
