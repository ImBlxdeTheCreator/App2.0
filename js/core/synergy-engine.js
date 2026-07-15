/* Component collection, character stats, and synergy calculations
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   ENGINE
   ========================================================================= */
function collectComponents(){
  const comps = [];
  const sc = SUBCLASSES[state.cls][state.element];
  const chosenSuper = (sc.supers||[]).find(s=>s.name===state.super) || (sc.supers||[])[0];
  if(chosenSuper) comps.push({source:`${state.element} Super: ${chosenSuper.name}`, grants:chosenSuper.grants, effects:chosenSuper.effects});
  sc.aspects.forEach(a=>{
    if(state.aspects.includes(a.name)) comps.push({source:`Aspect: ${a.name}`, grants:a.grants, effects:a.effects});
  });
  (FRAGMENTS[state.element]||[]).forEach(f=>{
    if(state.fragments.includes(f.name)) comps.push({source:`Fragment: ${f.name}`, grants:f.grants, effects:f.effects});
  });
  if(state.grenade){
    const grenadePool = state.element==="Prismatic" ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>GRENADES[e]) : (GRENADES[state.element]||[]);
    const g = grenadePool.find(x=>x.name===state.grenade);
    if(g) comps.push({source:`Grenade: ${g.name}`, grants:g.grants, effects:g.effects});
  }
  if(state.melee){
    const meleePool = state.element==="Prismatic" ? ["Arc","Solar","Void","Stasis","Strand"].flatMap(e=>MELEES[state.cls][e]) : (MELEES[state.cls][state.element]||[]);
    const m = meleePool.find(x=>x.name===state.melee);
    if(m) comps.push({source:`Melee: ${m.name}`, grants:m.grants, effects:m.effects});
  }
  if(state.exoticArmor){
    const ea = EXOTIC_ARMOR[state.cls].find(e=>e.name===state.exoticArmor);
    if(ea){
      if(ea.effects && ea.effects.length) comps.push({source:`Exotic Armor: ${ea.name}`, grants:ea.grants, effects:ea.effects});
      const classItemPool = EXOTIC_CLASS_ITEM_PERKS[state.cls];
      if(classItemPool && ea.name === classItemPool.name){
        const p1 = classItemPool.column1.find(p=>p.name===state.classItemPerks.col1);
        const p2 = classItemPool.column2.find(p=>p.name===state.classItemPerks.col2);
        if(p1) comps.push({source:`${ea.name} — ${p1.name}`, grants:p1.grants, effects:p1.effects});
        if(p2) comps.push({source:`${ea.name} — ${p2.name}`, grants:p2.grants, effects:p2.effects});
      }
    }
    if(state.exoticTuning){
      const et = EXOTIC_TUNING_OPTIONS.find(t=>t.name===state.exoticTuning);
      if(et && et.effects && et.effects.length) comps.push({source:`Exotic Tuning: ${et.name}`, grants:[], effects:et.effects});
    }
  }
  if(state.activeExoticWeapon){
    const ew = EXOTIC_WEAPONS.find(e=>e.name===state.activeExoticWeapon);
    if(ew){
      comps.push({source:`Exotic Weapon: ${ew.name}`, grants:ew.grants, effects:ew.effects});
      // Phase 2 — the exotic occupies its weapon slot and inherits that slot's
      // mod + masterwork context, exactly like the legendary it replaced.
      const slot = ew.slot;
      const exModName = state.exoticWeaponMod[slot];
      if(exModName){
        const m = MODS.find(x=>x.name===exModName);
        if(m && m.effects && m.effects.length) comps.push({source:`${slot} (Exotic) ${ew.name} — Mod: ${m.name}`, grants:m.grants||[], effects:m.effects});
      }
      if(state.exoticWeaponMW[slot]){
        comps.push({source:`${slot} (Exotic) ${ew.name} — Masterworked`, grants:["orbOfPower"], effects:[{bucket:"superEnergy",value:4,cond:"orbOfPower",note:"generates Orbs of Power on multikills"}]});
      }
    }
  }
  // "My Real Weapons" mode — synergy sourced from an actual owned weapon's
  // real socketed perks (matched by name against this tool's own perk
  // library when the weapon was selected), not a generic frame estimate.
  Object.entries(state.legendaryRealItem).forEach(([slot,item])=>{
    if(!item || state.legendaryMode[slot] !== "real") return;
    (item.matchedPerks || []).forEach(perk=>{
      if(perk.effects && perk.effects.length){
        comps.push({source:`${slot} (real: ${item.name}) — ${perk.name}`, grants:perk.grants||[], effects:perk.effects});
      }
    });
    if(item.isMasterworked){
      comps.push({source:`${slot} (real: ${item.name}) — Masterworked`, grants:["orbOfPower"], effects:[{bucket:"superEnergy",value:4,cond:"orbOfPower",note:"generates Orbs of Power on multikills"}]});
    }
  });

  Object.entries(state.legendary).forEach(([slot,val])=>{
    if(state.legendaryMode[slot] === "real") return; // handled above instead
    if(!val) return;
    const arch = LEGENDARY_ARCHETYPES.find(a=>a.name===val.name);
    if(!arch) return;
    const tierMult = 1 + (val.tier-1)*WEAPON_TIER_DMG_PER_TIER;
    const elem = val.element || 'Kinetic';
    const perkPool = perkPoolForArchetype(arch, elem);
    const poolLookups = [
      {field:'barrel', pool:FRAME_BARREL_POOLS, label:'Barrel'},
      {field:'mag', pool:FRAME_MAG_POOLS, label:'Mag'},
      {field:'perk1', options:perkPool, label:'Perk 1'},
      {field:'perk2', options:perkPool, label:'Perk 2'},
      {field:'originTrait', pool:FRAME_ORIGIN_TRAIT_POOLS, label:'Origin Trait'},
      {field:'mod', pool:FRAME_MOD_POOLS, label:'Mod'},
    ];
    poolLookups.forEach(({field, pool, options, label})=>{
      const chosenName = val[field];
      if(!chosenName) return;
      const resolvedOptions = options || (pool[arch.framePool] && pool[arch.framePool][elem]) || [];
      const item = resolvedOptions.find(p=>p.name===chosenName);
      if(item && item.effects && item.effects.length){
        const scaled = item.effects.map(e=>({...e, value: Math.round(e.value*tierMult*10)/10}));
        comps.push({source:`${slot} (T${val.tier}) ${arch.name} [${elem}] — ${label}: ${item.name}`, grants:item.grants||[], effects:scaled});
      }
    });
    // Weapon masterwork: real mechanic is +1 to one stat per tier (max +10,
    // not modeled here since this tool doesn't track raw weapon stats like
    // Range/Stability) plus generating Orbs of Power on multikills — that
    // part IS representable here as a Super Energy contribution.
    if(val.masterworked){
      comps.push({source:`${slot} (T${val.tier}) ${arch.name} — Masterworked`, grants:["orbOfPower"], effects:[{bucket:"superEnergy",value:4,cond:"orbOfPower",note:"generates Orbs of Power on multikills"}]});
    }
  });
  ["Helmet","Arms","Chest","Legs","ClassItem"].forEach(slotName=>{
    // "My Real Armor" mode: use the piece's actually-socketed mods (matched
    // by name against this tool's own library) instead of manual picks.
    if(state.armorMode[slotName] === "real" && state.armorRealItem[slotName]){
      const item = state.armorRealItem[slotName];
      (item.matchedMods || []).forEach(m=>{
        if(m.effects && m.effects.length) comps.push({source:`${slotName} (real: ${item.name}) — ${m.name}`, grants:m.grants||[], effects:m.effects});
      });
      return; // skip the generic mod/tuning picks for this piece
    }
    (state.mods[slotName]||[]).forEach(modName=>{
      const m = ARMOR_MODS_BY_SLOT[slotName].find(x=>x.name===modName);
      if(m && m.effects && m.effects.length) comps.push({source:`${slotName} Mod: ${m.name}`, grants:m.grants||[], effects:m.effects});
    });
    const tuneName = state.tuning[slotName];
    if(tuneName){
      const t = TUNING_MODS_BY_SLOT[slotName].find(x=>x.name===tuneName);
      if(t) comps.push({source:`${slotName} Tuning: ${t.name}`, grants:[], effects:t.effects});
    }
  });
  if(state.artifact){
    const art = ARTIFACTS.find(a=>a.name===state.artifact);
    if(art){
      state.artifactPerks.forEach(perkName=>{
        const perk = ARTIFACT_PERK_LIBRARY[perkName];
        if(perk && perk.effects && perk.effects.length) comps.push({source:`Artifact: ${perkName}`, grants:perk.grants||[], effects:perk.effects});
      });
    }
  }
  // Armor 3.0: each of the 5 armor pieces can be independently socketed with
  // ANY set's bonus perk — you're not required to wear a matching physical
  // set. So count how many pieces currently have EACH set name selected;
  // any set reaching 2 gets its 2pc bonus, reaching 4 also adds its 4pc
  // bonus, and multiple different sets can all be active at once this way.
  const setCounts = {};
  Object.values(state.armorSetByPiece).forEach(setName=>{
    if(setName) setCounts[setName] = (setCounts[setName]||0) + 1;
  });
  Object.entries(setCounts).forEach(([setName, count])=>{
    if(count < 2) return;
    const set = ARMOR_SETS.find(s=>s.name===setName);
    if(!set) return;
    comps.push({source:`Armor Set (2pc): ${set.twoPiece.name}`, grants:set.twoPiece.grants||[], effects:set.twoPiece.effects});
    if(count >= 4){
      comps.push({source:`Armor Set (4pc): ${set.fourPiece.name}`, grants:set.fourPiece.grants||[], effects:set.fourPiece.effects});
    }
  });
  return comps;
}

// ---- CHARACTER STATS (real Armor 3.0 system: Weapons/Health/Class/Grenade/
// Super/Melee, 0-200 each, T0-T20 in steps of 10) ----
// Tuning mod NAMES already literally encode real stat point trades (e.g.
// "+5 Weapons / -5 Super", "Balanced Tuning (+1 Class/Melee/Grenade)"), so
// rather than inventing separate data, we parse the real point deltas
// straight out of the names already in TUNING_MODS_BY_SLOT.
const STAT_NAMES = ["Weapons","Health","Class","Grenade","Super","Melee"];
// Real Bungie stat hashes — Edge of Fate renamed these stats but kept the
// same underlying hashes (Mobility->Weapons, Resilience->Health,
// Recovery->Class, Discipline->Grenade, Intellect->Super, Strength->Melee).
const STAT_HASH_TO_NAME = {
  2996146975: "Weapons",  // formerly Mobility
  392767087: "Health",    // formerly Resilience
  1943323491: "Class",    // formerly Recovery
  1735777505: "Grenade",  // formerly Discipline
  144602215: "Super",     // formerly Intellect
  4244567218: "Melee",    // formerly Strength
};
function parseTuningStatDeltas(name){
  const deltas = {};
  const balancedMatch = name.match(/Balanced Tuning \(\+(\d+) ([A-Za-z/]+)\)/);
  if(balancedMatch){
    const amt = parseInt(balancedMatch[1],10);
    balancedMatch[2].split("/").forEach(stat=>{ deltas[stat] = (deltas[stat]||0) + amt; });
    return deltas;
  }
  const swapMatch = name.match(/\+(\d+) (\w+) \/ -(\d+) (\w+)/);
  if(swapMatch){
    deltas[swapMatch[2]] = (deltas[swapMatch[2]]||0) + parseInt(swapMatch[1],10);
    deltas[swapMatch[4]] = (deltas[swapMatch[4]]||0) - parseInt(swapMatch[3],10);
  }
  return deltas;
}

// Exotic Armor Tuning (Armor 3.0) — every Exotic armor piece can equip any
// tuning option: a Balanced tune plus the full matrix of +5/-5 stat swaps
// across all six stats. Names are parsed by parseTuningStatDeltas() for the
// stat readout; effects[] feed the synergy engine (Weapons has no synergy
// bucket so it only affects the stat totals, not synergy).
const STAT_BUCKET = {Class:"classEnergy", Grenade:"grenadeEnergy", Super:"superEnergy", Melee:"meleeEnergy", Health:"healing"};
const EXOTIC_TUNING_OPTIONS = (function(){
  const opts = [{name:"Balanced Tuning (+2 Weapons/Health/Class)", effects:[{bucket:"healing",value:2,note:"balanced spread"},{bucket:"classEnergy",value:2,note:"balanced spread"}]}];
  STAT_NAMES.forEach(gain=>{
    STAT_NAMES.forEach(lose=>{
      if(gain===lose) return;
      const effects = [];
      if(STAT_BUCKET[gain]) effects.push({bucket:STAT_BUCKET[gain], value:4, note:`+5 ${gain}`});
      if(STAT_BUCKET[lose]) effects.push({bucket:STAT_BUCKET[lose], value:-4, note:`-5 ${lose}`});
      opts.push({name:`+5 ${gain} / -5 ${lose}`, effects});
    });
  });
  return opts;
})();

function computeCharacterStats(){
  const totals = {}; STAT_NAMES.forEach(s=>totals[s]=0);
  const contributors = {}; STAT_NAMES.forEach(s=>contributors[s]=[]);
  // Bungie's CharacterComponent.stats is the authoritative total shown by DIM.
  // It already includes equipped armor, subclass effects, mods, and other live
  // character-level adjustments. Prefer it after live sync instead of summing
  // item stats and accidentally double-counting or omitting hidden modifiers.
  if(state.liveCharacterStats && Object.keys(state.liveCharacterStats).length){
    Object.entries(state.liveCharacterStats).forEach(([hash,value])=>{
      const statName=STAT_HASH_TO_NAME[Number(hash)];
      if(!statName || totals[statName]===undefined) return;
      totals[statName]=Number(value||0);
      contributors[statName].push({source:'Live character total (Bungie)',value:Number(value||0)});
    });
    return {totals,contributors,authoritative:true};
  }
  ["Helmet","Arms","Chest","Legs","ClassItem"].forEach(slotName=>{
    // "My Real Armor" mode: use the piece's actual stat roll directly —
    // real numbers, not tuning-mod-inferred or masterwork-guessed ones.
    if(state.armorMode[slotName] === "real" && state.armorRealItem[slotName]){
      const item = state.armorRealItem[slotName];
      Object.values(item.stats || {}).forEach(s=>{
        const statName = STAT_HASH_TO_NAME[s.statHash];
        if(!statName || totals[statName]===undefined) return;
        totals[statName]+=s.value;
        contributors[statName].push({source:`${slotName} (real: ${item.name})`, value:s.value});
      });
      return; // skip generic tuning/masterwork for this piece — real data already covers it
    }
    const tuneName = state.tuning[slotName];
    if(!tuneName) return;
    const deltas = parseTuningStatDeltas(tuneName);
    Object.entries(deltas).forEach(([stat,val])=>{
      if(totals[stat]===undefined) return; // ignore unrecognized stat tokens
      totals[stat]+=val;
      contributors[stat].push({source:`${slotName} tuning`, value:val});
    });
  });
  // Exotic armor tuning (applies once, not per slot).
  if(state.exoticTuning){
    const deltas = parseTuningStatDeltas(state.exoticTuning);
    Object.entries(deltas).forEach(([stat,val])=>{
      if(totals[stat]===undefined) return;
      totals[stat]+=val;
      contributors[stat].push({source:'Exotic tuning', value:val});
    });
  }
  // Armor 3.0 masterwork: +5 to each of the (up to 3) stats you've marked as
  // this piece's "weak" stats — real armor gives this to whichever 3 stats
  // aren't its primary/secondary/tertiary roll, which isn't data this tool
  // has per real item, so you choose which 3 apply.
  // Armor 3.0 masterwork: raises the (up to 3) stats you've marked as this
  // piece's lowest stats by +1 per masterwork level (max +5 each at level 5).
  ["Helmet","Arms","Chest","Legs","ClassItem"].forEach(slotName=>{
    if(state.armorMode[slotName] === "real") return; // real stats already include masterwork's contribution
    const mw = state.armorMasterwork[slotName];
    if(!mw || !mw.level) return;
    mw.stats.forEach(stat=>{
      if(totals[stat]===undefined) return;
      totals[stat]+=mw.level;
      contributors[stat].push({source:`${slotName} masterwork (T${mw.level})`, value:mw.level});
    });
  });
  return {totals, contributors};
}
function statTier(points){ return Math.max(0, Math.min(20, Math.floor(points/10))); }

function computeSynergy(){
  const comps = collectComponents();
  const activeTags = new Set();
  comps.forEach(c=>(c.grants||[]).forEach(g=>activeTags.add(g)));
  const totals = {}; BUCKETS.forEach(b=>totals[b.id]=0);
  const contributors = {}; BUCKETS.forEach(b=>contributors[b.id]=[]);
  comps.forEach(c=>{
    (c.effects||[]).forEach(e=>{
      const unlocked = !e.cond || activeTags.has(e.cond);
      if(unlocked){
        totals[e.bucket]+=e.value;
        contributors[e.bucket].push({source:c.source, value:e.value, note:e.note||"", cond:e.cond||null});
      } else {
        contributors[e.bucket].push({source:c.source, value:0, note:(e.note?e.note+" — ":"")+`inactive (needs "${e.cond}" from elsewhere in build)`, cond:e.cond, inactive:true});
      }
    });
  });
  return {totals, contributors, activeTags:[...activeTags]};
}

