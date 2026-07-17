/* Application state and reset logic
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   STATE
   ========================================================================= */
const state = {
  cls: "Titan",
  element: "Solar",
  super: null, // name of selected super within current subclass
  aspects: [], // names, max 2
  fragments: [], // names, max 3 (represents fragment slot count roughly)
  grenade: null, // name
  melee: null, // name
  classAbility: null, // exact live class ability name when synced
  liveSubclass: null, // manifest-driven equipped subclass details
  liveExoticWeapon: null, // exact equipped exotic even when absent from curated tables
  liveExoticArmor: null, // exact equipped exotic even when absent from curated tables
  liveArmorSetByPiece: {Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null},
  liveArtifact: null, // exact active artifact/perks from Bungie
  exoticArmor: null,
  exoticTuning: null,
  classItemPerks: {col1:null, col2:null}, // Prismatic-only exotic class item perk picks
  armorFilter: "synergy", // "synergy" = only show pieces matching current element + Any; "all" = show everything
  exoticWeaponSlot: {Kinetic:null, Energy:null, Power:null}, // only one exotic weapon equippable at a time really; we allow pick of one
  activeExoticWeapon: null, // name
  exoticWeaponFilter: {Kinetic:"all", Energy:"all", Power:"all"}, // burn filter per slot
  equipmentRarityFilter: {Kinetic:"all", Energy:"all", Power:"all"},
  armorRarityFilter: {Helmet:"all", Arms:"all", Chest:"all", Legs:"all", ClassItem:"all"},
  legendary: {Kinetic:null, Energy:null, Power:null}, // {name, tier, element, barrel, mag, perk1, perk2, originTrait, mod}
  // "My Real Weapons" mode — per slot, lets the person pick an actual owned
  // weapon (live from Bungie) instead of a generic archetype/frame.
  legendaryMode: {Kinetic:"generic", Energy:"generic", Power:"generic"}, // "generic" | "real"
  legendaryRealItem: {Kinetic:null, Energy:null, Power:null}, // the chosen real weapon object, when mode is "real"
  mods: {Helmet:[], Arms:[], Chest:[], Legs:[], ClassItem:[]}, // up to 4 regular mods per slot
  tuning: {Helmet:null, Arms:null, Chest:null, Legs:null, ClassItem:null}, // one Tier 5 tuning mod per slot
  artifact: null,
  artifactPerks: [], // up to 7 names total across column1/2/3, gated by progression
  armorSetByPiece: {Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null}, // each of the 5 pieces can be socketed with a different set's bonus
  // Armor 3.0 tier per piece (1-5). Tier 4 & 5 have 11 mod energy; T1-3 have
  // 10. Tier 5 also unlocks the stat-tuning slot (tuning costs 0 energy).
  armorTier: {Helmet:5, Arms:5, Chest:5, Legs:5, ClassItem:5},
  // Armor 3.0 masterwork: masterworking a piece raises its 3 lowest stats by
  // +1 per level, up to +5 each at level 5 (it NO LONGER affects mod energy).
  // Real per-item rolls aren't modeled, so you pick which 3 stats benefit.
  armorMasterwork: {
    Helmet: {level:0, stats:[]}, Arms: {level:0, stats:[]}, Chest: {level:0, stats:[]},
    Legs: {level:0, stats:[]}, ClassItem: {level:0, stats:[]},
  },
  // "My Real Armor" mode — per piece, lets the person pick an actual owned
  // armor piece (live from Bungie) instead of manually setting tier/mods/
  // masterwork level. Real stats/mods/masterwork are used directly.
  armorMode: {Helmet:"generic", Arms:"generic", Chest:"generic", Legs:"generic", ClassItem:"generic"}, // "generic" | "real"
  artifactMode: "generic", // "generic" | "real"
  armorSetMode: "generic", // "generic" | "real"
  armorRealItem: {Helmet:null, Arms:null, Chest:null, Legs:null, ClassItem:null},
  // Phase 2 — exotic occupies its weapon slot: the mod + masterwork context of
  // that slot now applies to the exotic living there.
  exoticWeaponMod: {Kinetic:null, Energy:null, Power:null},
  exoticWeaponMW: {Kinetic:false, Energy:false, Power:false},
  // Phase 6 — currently selected live character (charId) for live-equipped sync.
  selectedCharId: null,
  liveCharacterStats: null,
};

function defaultSuperFor(cls, element){
  const sc = SUBCLASSES[cls][element];
  return sc.supers && sc.supers.length ? sc.supers[0].name : null;
}
state.super = defaultSuperFor(state.cls, state.element);

function resetState(){
  state.cls="Titan"; state.element="Solar"; state.aspects=[]; state.fragments=[];
  state.grenade=null; state.melee=null; state.classAbility=null; state.liveSubclass=null;
  state.super = defaultSuperFor(state.cls, state.element);
  state.exoticArmor=null; state.exoticTuning=null; state.activeExoticWeapon=null; state.liveExoticArmor=null; state.liveExoticWeapon=null; state.armorFilter="synergy";
  state.exoticWeaponFilter={Kinetic:"all",Energy:"all",Power:"all"};
  state.equipmentRarityFilter={Kinetic:"all",Energy:"all",Power:"all"};
  state.armorRarityFilter={Helmet:"all",Arms:"all",Chest:"all",Legs:"all",ClassItem:"all"};
  state.classItemPerks={col1:null,col2:null};
  state.legendary={Kinetic:null,Energy:null,Power:null};
  state.legendaryMode={Kinetic:"generic",Energy:"generic",Power:"generic"};
  state.legendaryRealItem={Kinetic:null,Energy:null,Power:null};
  state.mods={Helmet:[],Arms:[],Chest:[],Legs:[],ClassItem:[]};
  state.tuning={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.artifact=null; state.artifactPerks=[];
  state.armorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.liveArmorSetByPiece={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null}; state.liveArtifact=null;
  state.armorTier={Helmet:5,Arms:5,Chest:5,Legs:5,ClassItem:5};
  state.armorMasterwork={Helmet:{level:0,stats:[]},Arms:{level:0,stats:[]},Chest:{level:0,stats:[]},Legs:{level:0,stats:[]},ClassItem:{level:0,stats:[]}};
  state.armorMode={Helmet:"generic",Arms:"generic",Chest:"generic",Legs:"generic",ClassItem:"generic"};
  state.artifactMode="generic";
  state.armorSetMode="generic";
  state.armorRealItem={Helmet:null,Arms:null,Chest:null,Legs:null,ClassItem:null};
  state.exoticWeaponMod={Kinetic:null,Energy:null,Power:null};
  state.exoticWeaponMW={Kinetic:false,Energy:false,Power:false};
  state.liveCharacterStats=null;
  render();
}

