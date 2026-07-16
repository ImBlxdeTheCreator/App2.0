/* Legendary weapon perks, traits, mods, pools, and archetypes
   Extracted from the original monolithic index.html without behavioral rewrites. */
// ---- FRAME PERK POOLS (real per-archetype, per-burn perk pools) ----
// Raw pools transcribed from the actual game's perk tables. Each frame lists
// its "top slot" perks (valid on Kinetic/Stasis/Strand weapons of that frame)
// with inline "(X Only)" tags for anything burn- or weapon-type-locked, plus
// a short list of what additionally unlocks on an Arc/Solar/Void ("energy")
// version of that frame, and which top-slot perks DON'T carry over to energy
// versions. A small parser below expands this into per-element arrays so the
// UI can just ask FRAME_PERK_POOLS[frame][element].
const FRAME_POOL_RAW = {
  "Aggressive Frame (Primary)": {
    top: "",
    energyExcludes: ["Firefly","Kinetic Tremors"],
    energyExtra: "",
  },
  "High-Impact Frame (Primary)": {
    top: "",
    energyExcludes: ["Dragonfly","Firefly","Headstone","Kinetic Tremors"],
    energyExtra: "",
  },
  "Precision Frame (Primary)": {
    top: "",
    energyExcludes: ["Dragonfly","Firefly","Headstone","Kinetic Tremors"],
    energyExtra: "",
  },
  "Adaptive Frame (Primary)": {
    top: "",
    energyExcludes: ["Dragonfly","Firefly","Headstone","Kinetic Tremors"],
    energyExtra: "",
  },
  "Rapid-Fire Frame (Primary)": {
    top: "",
    energyExcludes: ["Dragonfly","Firefly","Headstone","Kinetic Tremors"],
    energyExtra: "",
  },
  "Lightweight Frame (Primary)": { same: "Rapid-Fire Frame (Primary)" },
  "Support Frame (Primary)": {
    top: "",
    energyExcludes: [],
    energyExtra: "",
    singleList: true,
  },
  "Rapid-Fire Frame (Special)": {
    top: "",
    energyExcludes: ["Chill Clip"],
    energyExtra: "",
  },
  "Adaptive Frame (Special)": { same: "Rapid-Fire Frame (Special)" },
  "High-Impact Frame (Special)": {
    top: "",
    energyExcludes: ["Chill Clip"],
    energyExtra: "",
  },
  "Aggressive Frame (Special)": { same: "High-Impact Frame (Special)" },
  "Lightweight Frame (Special)": {
    top: "",
    energyExcludes: [],
    energyExtra: "",
  },
  "Wave Frame (Special)": {
    top: "",
    energyExcludes: [],
    energyExtra: "",
  },
  "Rocket-Assisted Frame (Special)": { same: "Wave Frame (Special)" },
  "Adaptive Frame (Heavy)": {
    top: "",
    energyExcludes: ["Chill Clip"],
    energyExtra: "",
  },
  "Aggressive Frame (Heavy)": { same: "Adaptive Frame (Heavy)" },
  "Precision Frame (Heavy)": {
    top: "",
    energyExcludes: [],
    energyExtra: "",
  },
  "High-Impact Frame (Heavy)": { same: "Precision Frame (Heavy)" },
  "Rapid-Fire Frame (Heavy)": { same: "Precision Frame (Heavy)" },
  "Sword Frame (Heavy)": {
    top: "",
    energyExcludes: ["Cold Steel"],
    energyExtra: "",
  },
};

// Resolve "same as" aliases so every frame key has real data.
Object.keys(FRAME_POOL_RAW).forEach(key=>{
  if(FRAME_POOL_RAW[key].same) FRAME_POOL_RAW[key] = FRAME_POOL_RAW[FRAME_POOL_RAW[key].same];
});

// ---- REAL PERK/ORIGIN/BARREL/MAG DATA (from user's alphabetical database) ----
// UNIVERSAL_PERKS: apply to any weapon regardless of frame/element (unless
// weapon-type-restricted, tracked separately in WEAPON_TYPE_PERKS below).
const UNIVERSAL_PERKS = [
  {name:"Outlaw", grants:[], effects:[{bucket:"damage",value:8,note:"precision kill grants +70 reload speed"}]},
  {name:"Disruption Break", grants:[], effects:[{bucket:"damage",value:8,note:"matching shield break grants target +50% Kinetic damage vulnerability"}]},
  {name:"Threat Remover", grants:[], effects:[{bucket:"damage",value:6,note:"pellet hits grant handling + reload speed buff"}]},
  {name:"Desperado", grants:[], effects:[{bucket:"damage",value:10,note:"precision kill + reload within 5.2s speeds up fire recovery"}]},
  {name:"Reconstruction", grants:[], effects:[{bucket:"damage",value:5,note:"not firing for a timer refills 25% mag from reserves, up to 100% overflow"}]},
  {name:"Explosive Payload", grants:[], effects:[{bucket:"damage",value:8,note:"50% of damage dealt as explosive payload, +15% body dmg"}]},
  {name:"Closing Time", grants:[], effects:[{bucket:"damage",value:6,note:"magazine below 50% scales range/handling/anim duration"}]},
  {name:"Adhesive Ordnance", grants:[], effects:[{bucket:"damage",value:8,note:"ammo pickup loads a sticky bomb into next shot"}]},
  {name:"Beacon Rounds", grants:[], effects:[{bucket:"damage",value:5,note:"weapon kill buffs reload + tracking cone width"}]},
  {name:"Bolt Scavenger", grants:[], effects:[{bucket:"damage",value:3,note:"pickup crossbow bolt buffs handling + reload"}]},
  {name:"Circle of Life", grants:[], effects:[{bucket:"damage",value:25,note:"trigger support frame boost buffs weapon damage 25%"}]},
  {name:"Detonator Beam", grants:[], effects:[{bucket:"damage",value:8,note:"sustained hits trigger an elemental explosion"}]},
  {name:"Dual Loader", grants:[], effects:[{bucket:"damage",value:3,note:"passive extra reload ammo"}]},
  {name:"Iron Gaze / Grip / Reach", grants:[], effects:[{bucket:"damage",value:5,note:"passive buff to AA/stability/range, minor tradeoff to the other"}]},
  {name:"Osmosis", grants:[], effects:[{bucket:"classEnergy",value:5,note:"grenade ability use matches weapon element to grenade"}]},
  {name:"Paracausal Affinity", grants:[], effects:[{bucket:"damage",value:20,note:"kill matching Light/Dark alignment buffs damage 20%"}]},
  {name:"Permeability", grants:[], effects:[{bucket:"classEnergy",value:5,note:"class ability use refills 50% mag, matches element to Super"}]},
  {name:"Physic", grants:["restoration"], effects:[{bucket:"healing",value:8,cond:"restoration",note:"trigger support frame boost grants matching buffs to user + ally"}]},
  {name:"Recombination", grants:[], effects:[{bucket:"damage",value:12,note:"elemental kills stack bonus damage on next shot, up to 100%"}]},
  {name:"Reciprocity", grants:[], effects:[{bucket:"healing",value:4,note:"support frame healing hit on ally restores you too"}]},
  {name:"Reversal of Fortune", grants:[], effects:[{bucket:"damage",value:3,note:"missing twice in 6s generates 1 ammo"}]},
  {name:"Supercharged Magazine", grants:[], effects:[{bucket:"damage",value:5,note:"amplified/speed booster refills mag + buffs mag stat"}]},
  {name:"Tap The Trigger", grants:[], effects:[{bucket:"damage",value:6,note:"firing burst/full-auto buffs stability + recoil control"}]},
  {name:"Timed Payload", grants:[], effects:[{bucket:"damage",value:8,note:"passive 55% dmg as matching explosion, +16.5% body dmg"}]},
  {name:"Transcendent Moment", grants:[], effects:[{bucket:"classEnergy",value:5,note:"kill grants alignment stats, both while Transcendent"}]},
  {name:"Trickle Charge", grants:[], effects:[{bucket:"damage",value:4,note:"heat/bolt charge gain or discharge refills mag + dissipates heat"}]},
  {name:"Adaptive Munitions", grants:[], effects:[{bucket:"damage",value:35,note:"stacking dmg vs shields, up to 69.5% max"}]},
  {name:"Adrenaline Junkie", grants:[], effects:[{bucket:"damage",value:20,note:"stacking on weapon/grenade kills, max 33.3% x5 stacks"}]},
  {name:"Aggregate Charge", grants:[], effects:[{bucket:"damage",value:22,note:"scales with unique debuffs on target, up to 33% at x3"}]},
  {name:"Air Assault", grants:[], effects:[{bucket:"classEnergy",value:12,note:"kills grant ammo gen, +32 per stack up to 2"}]},
  {name:"Air Trigger", grants:[], effects:[{bucket:"classEnergy",value:8,note:"airborne: ammo gen + reload boost"}]},
  {name:"All-Star", grants:[], effects:[{bucket:"damage",value:35,note:"ammo pickup refills mag + damage buff"}]},
  {name:"Ambitious Assassin", grants:[], effects:[{bucket:"damage",value:5,note:"reload after kill overflows mag up to 150%"}]},
  {name:"Ancillary Ordinance", grants:[], effects:[{bucket:"damage",value:8,note:"elemental kill streak spawns homing micro-missile"}]},
  {name:"Attrition Orbs", grants:[], effects:[{bucket:"superEnergy",value:6,note:"mag-hits spawn an orb of power"}]},
  {name:"Auto-Loading Holster", grants:[], effects:[{bucket:"damage",value:3,note:"stowed weapon refills from reserves"}]},
  {name:"Bait and Switch", grants:[], effects:[{bucket:"damage",value:30,note:"damage with all 3 weapons in 7s"}]},
  {name:"Bewildering Burst", grants:["blind"], effects:[{bucket:"damage",value:6,cond:"blind",note:"reload after kill launches a flashbang"}]},
  {name:"Blast Distributor", grants:[], effects:[{bucket:"grenadeEnergy",value:13,note:"explosive dmg stacks grenade stat, max +65"}]},
  {name:"Bottomless Grief", grants:[], effects:[{bucket:"damage",value:6,note:"kills while Last Standing refill mag, +30 mag size passively"}]},
  {name:"Box Breathing", grants:[], effects:[{bucket:"damage",value:40,note:"ADS without firing buffs next weakspot shot 40%"}]},
  {name:"Built To Blast", grants:[], effects:[{bucket:"dr",value:6,cond:"overshield",note:"active Void OS/Frost Armor/Woven grants stability + flinch resist"}]},
  {name:"Burning Ambition", grants:["scorch"], effects:[{bucket:"damage",value:8,cond:"scorch",note:"mag-hits proc a scorch shot"}]},
  {name:"Butterfly", grants:[], effects:[{bucket:"damage",value:8,note:"ADS without firing sets next kill to chain-explode"}]},
  {name:"Cascade Point", grants:[], effects:[{bucket:"damage",value:8,note:"multi-precision hits speed up fire recovery"}]},
  {name:"Celerity", grants:[], effects:[{bucket:"classEnergy",value:6,note:"Last Standing buffs handling/reload + radar"}]},
  {name:"Chain Reaction", grants:[], effects:[{bucket:"damage",value:10,note:"kills cause a matching elemental explosion"}]},
  {name:"Chaos Reshaped", grants:[], effects:[{bucket:"healing",value:5,note:"time in combat stacks dmg + healing, x2 gives 35% dmg + regen"}]},
  {name:"Clown Cartridge", grants:[], effects:[{bucket:"damage",value:6,note:"reload grants random bonus mag capacity, avg 31.5%"}]},
  {name:"Collective Action", grants:[], effects:[{bucket:"damage",value:8,cond:"matching-element",note:"pickup elemental item buffs damage 33%"}]},
  {name:"Collective Demolition", grants:[], effects:[{bucket:"grenadeEnergy",value:8,cond:"matching-element",note:"pickup elemental item buffs grenade energy on hits"}]},
  {name:"Collective Pugilism", grants:[], effects:[{bucket:"meleeEnergy",value:8,cond:"matching-element",note:"pickup elemental item buffs melee energy on hits"}]},
  {name:"Compulsive Reloader", grants:[], effects:[{bucket:"damage",value:3,note:"reload speed while mag is above 50%"}]},
  {name:"Cornered", grants:[], effects:[{bucket:"damage",value:5,note:"within 15m of 2 enemies buffs charge/draw and stability"}]},
  {name:"Deconstruct", grants:[], effects:[{bucket:"damage",value:8,note:"hits refill mag + big bonus vs constructs/vehicles"}]},
  {name:"Demoralize", grants:["weaken"], effects:[{bucket:"damage",value:8,cond:"weaken",note:"precision kill triggers a Void weaken burst"}]},
  {name:"Demolitionist", grants:[], effects:[{bucket:"grenadeEnergy",value:11,note:"kills grant grenade energy, ability use refills mag"}]},
  {name:"Desperate Measures", grants:[], effects:[{bucket:"damage",value:20,note:"stacking dmg from kills/grenade/melee, up to 30%"}]},
  {name:"Destabilizing Rounds", grants:["volatile"], effects:[{bucket:"damage",value:8,cond:"volatile",note:"kill triggers Void burst + volatile rounds"}]},
  {name:"Discord", grants:[], effects:[{bucket:"damage",value:6,note:"swap after diff-weapon kill buffs ADS + ammo energy"}]},
  {name:"Dragonfly", grants:[], effects:[{bucket:"damage",value:8,note:"precision kill triggers matching elemental explosion"}]},
  {name:"Dynamic Sway Reduction", grants:[], effects:[{bucket:"damage",value:4,note:"holding trigger builds stability/accuracy over 8 shots"}]},
  {name:"Eddy Current", grants:[], effects:[{bucket:"classEnergy",value:5,note:"sprinting buffs reload, more if amplified"}]},
  {name:"Elemental Capacitor", grants:[], effects:[{bucket:"damage",value:6,cond:"matching-element",note:"passive buff based on equipped subclass"}]},
  {name:"Elemental Honing", grants:[], effects:[{bucket:"damage",value:35,note:"elemental dmg stacks x5 for 35% elemental / 40% kinetic dmg"}]},
  {name:"Encore", grants:[], effects:[{bucket:"damage",value:6,note:"kills stack range/stability, precision kills count double"}]},
  {name:"Ensemble", grants:[], effects:[{bucket:"classEnergy",value:6,note:"ally nearby buffs handling + reload"}]},
  {name:"Envious Arsenal", grants:[], effects:[{bucket:"damage",value:5,note:"damage all 3 weapons then swap fully refills mag"}]},
  {name:"Envious Assassin", grants:[], effects:[{bucket:"damage",value:6,note:"kill diff weapon then swap overflows mag up to 200%"}]},
  {name:"Eye of the Storm", grants:[], effects:[{bucket:"dr",value:8,note:"low shield HP buffs handling + accuracy"}]},
  {name:"Feeding Frenzy", grants:[], effects:[{bucket:"damage",value:4,note:"kills stack reload speed, x5 gives +100 reload"}]},
  {name:"Field Prep", grants:[], effects:[{bucket:"grenadeEnergy",value:4,note:"crouched buffs reload + passive ammo gen"}]},
  {name:"Firefly", grants:["ignite"], effects:[{bucket:"damage",value:6,cond:"ignite",note:"precision kill causes a Solar explosion"}]},
  {name:"Firing Line", grants:[], effects:[{bucket:"damage",value:20,note:"near 2 allies buffs precision damage 20%"}]},
  {name:"Firmly Planted", grants:[], effects:[{bucket:"damage",value:3,note:"crouched buffs stability + handling"}]},
  {name:"Focused Fury", grants:[], effects:[{bucket:"damage",value:25,note:"35% of mag as precision hits buffs damage 25%"}]},
  {name:"Fourth Time's The Charm", grants:[], effects:[{bucket:"damage",value:3,note:"4 precision hits in 3s generate 2 ammo"}]},
  {name:"Fragile Focus", grants:[], effects:[{bucket:"damage",value:3,note:"shield active buffs range, deactivates on crit health"}]},
  {name:"Frenzy", grants:[], effects:[{bucket:"healing",value:3,note:"sustained combat buffs dmg + handling + reload"}]},
  {name:"Genesis", grants:[], effects:[{bucket:"grenadeEnergy",value:4,note:"breaking matching shield refills mag + ammo"}]},
  {name:"Golden Tricorn", grants:[], effects:[{bucket:"damage",value:15,note:"weapon then ability kill stacks dmg, x2 gives 50%"}]},
  {name:"Grave Robber", grants:[], effects:[{bucket:"meleeEnergy",value:5,note:"powered melee dmg/kill refills mag"}]},
  {name:"Gutshot Straight", grants:[], effects:[{bucket:"damage",value:20,note:"ADS buffs body damage 20% (10% for specials)"}]},
  {name:"Harmony", grants:[], effects:[{bucket:"damage",value:20,note:"kill with diff weapon buffs damage + handling"}]},
  {name:"Headseeker", grants:[], effects:[{bucket:"damage",value:8,note:"non-precision hit buffs AA + precision multiplier"}]},
  {name:"Heating Up", grants:[], effects:[{bucket:"damage",value:6,note:"kills stack stability + recoil control"}]},
  {name:"High Ground", grants:[], effects:[{bucket:"damage",value:25,note:"kills/height damage stack up to 25% dmg"}]},
  {name:"High-Impact Reserves", grants:[], effects:[{bucket:"damage",value:12,note:"mag below 55% scales dmg up to 25.6% at low ammo"}]},
  {name:"Hip-Fire Grip", grants:[], effects:[{bucket:"damage",value:5,note:"hipfiring buffs AA, precision threshold, stability"}]},
  {name:"Impulse Amplifier", grants:[], effects:[{bucket:"damage",value:5,note:"passive reload + projectile velocity buff"}]},
  {name:"Incandescent", grants:["scorch"], effects:[{bucket:"damage",value:8,cond:"scorch",note:"kill triggers matching explosion inflicting scorch"}]},
  {name:"Invisible Hand", grants:[], effects:[{bucket:"damage",value:3,note:"missing shots buffs stability temporarily"}]},
  {name:"Keep Away", grants:[], effects:[{bucket:"damage",value:6,note:"no enemies within 15m buffs range + reload"}]},
  {name:"Killing Tally", grants:[], effects:[{bucket:"damage",value:10,note:"kills stack dmg, max 30% primary / 15% special"}]},
  {name:"Killing Wind", grants:[], effects:[{bucket:"damage",value:6,note:"kill buffs range/mobility/handling/falloff"}]},
  {name:"Kill Clip", grants:[], effects:[{bucket:"damage",value:25,note:"reload within 3.6s of kill buffs damage 25%"}]},
  {name:"Kinetic Tremors", grants:[], effects:[{bucket:"damage",value:6,note:"sustained hits emit Kinetic shockwaves"}]},
  {name:"Magnificent Howl", grants:[], effects:[{bucket:"damage",value:55,note:"10 precision kills then reload buffs next shots 55%"}]},
  {name:"Master of Arms", grants:[], effects:[{bucket:"damage",value:15,note:"weapon kill stacks damage, x2 gives 25%"}]},
  {name:"Meganeura", grants:[], effects:[{bucket:"damage",value:10,note:"precision hits stack, x3 triggers explosion +67.7% dmg"}]},
  {name:"Mega Kill Clip", grants:[], effects:[{bucket:"damage",value:40,note:"reload after kill buffs damage 40% for extended duration"}]},
  {name:"Moving Target", grants:[], effects:[{bucket:"damage",value:5,note:"ADS buffs aim assist"}]},
  {name:"Mulligan", grants:[], effects:[{bucket:"damage",value:3,note:"missed shots chance to return ammo"}]},
  {name:"Multikill Clip", grants:[], effects:[{bucket:"damage",value:17,note:"reload after kills, x1 17% up to x3 50% dmg"}]},
  {name:"Nail Meet Hammer", grants:[], effects:[{bucket:"damage",value:8,note:"passive/shield-break bonus damage + ammo refund"}]},
  {name:"No Distractions", grants:[], effects:[{bucket:"dr",value:5,note:"ADS without firing buffs flinch resistance 35%"}]},
  {name:"Offhand Strike", grants:[], effects:[{bucket:"damage",value:6,note:"hipfire kill buffs AA + stability + accuracy"}]},
  {name:"One For All", grants:[], effects:[{bucket:"damage",value:35,note:"damage 3 separate enemies in 3s buffs damage 35%"}]},
  {name:"Opening Shot", grants:[], effects:[{bucket:"damage",value:6,note:"first shot after ADS buffs range + aim assist"}]},
  {name:"Overflow", grants:[], effects:[{bucket:"damage",value:4,note:"special/heavy ammo pickup overflows mag to 120%"}]},
  {name:"Perfect Float", grants:[], effects:[{bucket:"damage",value:4,note:"in-combat buffs ammo energy + flinch resist"}]},
  {name:"Perpetual Motion", grants:[], effects:[{bucket:"classEnergy",value:5,note:"moving buffs stability/handling/reload"}]},
  {name:"Precision Instrument", grants:[], effects:[{bucket:"damage",value:30,note:"direct hits stack, max 6 stacks for 30% precision dmg"}]},
  {name:"Proximity Power", grants:[], effects:[{bucket:"meleeEnergy",value:18,note:"kill within 15m stacks melee energy, max +54"}]},
  {name:"Pugilist", grants:[], effects:[{bucket:"meleeEnergy",value:11,note:"kill/melee hit buffs melee energy + handling"}]},
  {name:"Pulse Monitor", grants:[], effects:[{bucket:"healing",value:6,note:"low shield HP refills mag + handling buff"}]},
  {name:"Quickdraw", grants:[], effects:[{bucket:"classEnergy",value:5,note:"readying weapon buffs ready/stow speed"}]},
  {name:"Rampage", grants:[], effects:[{bucket:"damage",value:21,note:"stacking kill dmg, x1 10% up to x3 33.1%"}]},
  {name:"Rangefinder", grants:[], effects:[{bucket:"damage",value:5,note:"ADS buffs range + zoom + projectile velocity"}]},
  {name:"Rapid Hit", grants:[], effects:[{bucket:"damage",value:5,note:"precision hits stack stability + reload"}]},
  {name:"Recycled Energy", grants:[], effects:[{bucket:"classEnergy",value:22,note:"manual reload after kill grants ability energy"}]},
  {name:"Redirection", grants:[], effects:[{bucket:"damage",value:50,note:"stacking hits on trash consumed vs elites for +50% dmg"}]},
  {name:"Repulsor Brace", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield",note:"kill Void-debuffed target grants overshield"}]},
  {name:"Reservoir Burst", grants:[], effects:[{bucket:"damage",value:33,note:"full battery next shot buffs damage 33%, explodes"}]},
  {name:"Reverberation", grants:[], effects:[{bucket:"damage",value:8,note:"kill buffs blast radius"}]},
  {name:"Rewind Rounds", grants:[], effects:[{bucket:"damage",value:5,note:"emptying mag refills 70% of dmg instances scored"}]},
  {name:"Shield Disorient", grants:["blind"], effects:[{bucket:"damage",value:6,cond:"blind",note:"matching shield break disorients nearby enemies"}]},
  {name:"Shoot to Loot", grants:[], effects:[{bucket:"classEnergy",value:4,note:"hitting ammo/orb pickup refills all weapons"}]},
  {name:"Sleight of Hand", grants:[], effects:[{bucket:"damage",value:8,note:"ready after stowed kills buffs stability/handling/reload"}]},
  {name:"Slickdraw", grants:[], effects:[{bucket:"damage",value:3,note:"passive handling buff"}]},
  {name:"Slideshot", grants:[], effects:[{bucket:"damage",value:5,note:"sliding refills mag + range/stability"}]},
  {name:"Slideways", grants:[], effects:[{bucket:"damage",value:5,note:"sliding refills mag + stability/handling"}]},
  {name:"Snapshot Sights", grants:[], effects:[{bucket:"damage",value:4,note:"passive faster ADS"}]},
  {name:"Stats for All", grants:[], effects:[{bucket:"damage",value:8,note:"damage 3 separate targets buffs range/stability/handling/reload"}]},
  {name:"Steady Hands", grants:[], effects:[{bucket:"damage",value:6,note:"kill buffs handling for all equipped weapons"}]},
  {name:"Stopping Power", grants:[], effects:[{bucket:"damage",value:15,note:"damaging low-health enemy buffs AA + damage"}]},
  {name:"Strategist", grants:[], effects:[{bucket:"classEnergy",value:11,note:"kill grants class ability energy, more for specials"}]},
  {name:"Subsistence", grants:[], effects:[{bucket:"damage",value:3,note:"kill refills 20% of magazine"}]},
  {name:"Surplus", grants:[], effects:[{bucket:"damage",value:8,note:"per ability charge buffs stability/handling/reload"}]},
  {name:"Surrounded", grants:[], effects:[{bucket:"damage",value:47,note:"near 3 enemies buffs damage 47%"}]},
  {name:"Swashbuckler", grants:[], effects:[{bucket:"meleeDamage",value:6,note:"weapon/melee kill stacks dmg, max 33.3% x5"}]},
  {name:"Sword Logic", grants:[], effects:[{bucket:"damage",value:50,note:"kill-rank scaling, x4 boss kill gives 50% dmg"}]},
  {name:"Sympathetic Arsenal", grants:[], effects:[{bucket:"damage",value:5,note:"reload after kill refills stowed weapons"}]},
  {name:"Target Lock", grants:[], effects:[{bucket:"damage",value:28,note:"continuous hits scale damage up to 45% max"}]},
  {name:"Threat Detector", grants:[], effects:[{bucket:"damage",value:8,note:"enemies within 15m stack stability/handling/reload"}]},
  {name:"Thresh", grants:[], effects:[{bucket:"superEnergy",value:6,note:"kill grants super energy"}]},
  {name:"To The Pain", grants:[], effects:[{bucket:"healing",value:6,note:"taking damage stacks handling + aim assist"}]},
  {name:"Triple Tap", grants:[], effects:[{bucket:"damage",value:4,note:"3 precision hits in 3s generates 1 ammo"}]},
  {name:"Tunnel Vision", grants:[], effects:[{bucket:"damage",value:6,note:"reload after kill buffs aim assist + ADS handling"}]},
  {name:"Turnabout", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield",note:"shield/super break grants a temporary overshield"}]},
  {name:"Under-Over", grants:[], effects:[{bucket:"damage",value:55,note:"passive bonus vs shields (55%) and overshields (140%)"}]},
  {name:"Under Pressure", grants:[], effects:[{bucket:"damage",value:4,note:"mag below 50% linearly buffs accuracy + stability"}]},
  {name:"Unrelenting", grants:[], effects:[{bucket:"healing",value:8,note:"rapid multi-kills trigger health regen"}]},
  {name:"Vorpal Weapon", grants:[], effects:[{bucket:"damage",value:20,note:"passive dmg vs bosses/champions/supers"}]},
  {name:"Well-Rounded", grants:[], effects:[{bucket:"classEnergy",value:6,note:"ability/super use stacks range/stability/handling"}]},
  {name:"Wellspring", grants:[], effects:[{bucket:"classEnergy",value:9,note:"kill grants ability energy split between uncharged abilities"}]},
  {name:"Withering Gaze", grants:["weaken"], effects:[{bucket:"damage",value:8,cond:"weaken",note:"ADS without firing sets next shot to weaken"}]},
  {name:"Zen Moment", grants:[], effects:[{bucket:"dr",value:5,note:"hits stack flinch resist + stability"}]},
];

// ---- ELEMENT-LOCKED PERKS (only unlock on the matching burn) ----
const ELEMENT_LOCKED_PERKS = {
  Solar: [
    {name:"Heal Clip", grants:["restoration"], effects:[{bucket:"healing",value:12,note:"reload within 7s of kill grants Cure to you (x2) and allies"}]},
  ],
  Arc: [
    {name:"Voltshot", grants:["jolt"], effects:[{bucket:"damage",value:8,cond:"jolt",note:"reload after kill inflicts jolt on next shot"}]},
    {name:"Rolling Storm", grants:["jolt"], effects:[{bucket:"classEnergy",value:6,note:"kills build Bolt Charge stacks"}]},
  ],
  Void: [
    {name:"Repulsor Brace (Void)", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield"}]},
  ],
  Stasis: [
    {name:"Chill Clip", grants:["frozen"], effects:[{bucket:"damage",value:7,cond:"frozen",note:"hits above 40% mag proc a slow/freeze burst"}]},
    {name:"Headstone", grants:["frozen"], effects:[{bucket:"damage",value:7,cond:"frozen",note:"precision kill spawns a stasis crystal"}]},
    {name:"Cold Steel", grants:["frozen"], effects:[{bucket:"meleeDamage",value:8,cond:"frozen",note:"powered sword hit slows targets"}]},
    {name:"Rimstealer", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"frozen",note:"shatter/frozen kill grants Frost Armor stacks"}]},
    {name:"Crystalline Corpsebloom", grants:["frozen"], effects:[{bucket:"grenadeDamage",value:6,cond:"frozen",note:"kill spawns a seeker creating a large Stasis crystal"}]},
  ],
  Strand: [
    {name:"Hatchling", grants:["tangle"], effects:[{bucket:"damage",value:6,cond:"tangle",note:"precision kill or rapid kills spawn Threadlings"}]},
    {name:"Slice", grants:["sever"], effects:[{bucket:"damage",value:6,cond:"sever",note:"class ability use makes next 5 hits sever"}]},
    {name:"Tear", grants:["sever"], effects:[{bucket:"damage",value:6,cond:"sever",note:"precision kill inflicts sever in a radius"}]},
  ],
};

// ---- WEAPON-TYPE-LOCKED PERKS (matched to frame pools by keyword) ----
const WEAPON_TYPE_PERKS = {
  Bows: [
    {name:"Archer's Gambit", grants:[], effects:[{bucket:"damage",value:5,note:"hipfire precision hit buffs reload + draw time"}]},
    {name:"Archer's Tempo", grants:[], effects:[{bucket:"damage",value:5,note:"precision hit speeds up draw time"}]},
    {name:"Explosive Head", grants:[], effects:[{bucket:"damage",value:8,note:"arrows deal 50% dmg as explosive payload"}]},
    {name:"Sneak Bow", grants:[], effects:[{bucket:"classEnergy",value:4,note:"crouched buffs ammo gen + hold time + stealth"}]},
    {name:"Successful Warm-Up", grants:[], effects:[{bucket:"damage",value:6,note:"kill speeds up draw time, extends with more kills"}]},
  ],
  Swords: [
    {name:"Assassin's Blade", grants:[], effects:[{bucket:"meleeDamage",value:15,note:"kill buffs damage + move speed"}]},
    {name:"Close To Melee", grants:[], effects:[{bucket:"meleeDamage",value:60,note:"glaive kill buffs melee damage 60%"}]},
    {name:"Duelist's Trance", grants:[], effects:[{bucket:"meleeDamage",value:8,note:"sword kill buffs guard + charge rate"}]},
    {name:"En Garde", grants:[], effects:[{bucket:"meleeDamage",value:30,note:"readying sword buffs damage 30%"}]},
    {name:"Energy Transfer", grants:[], effects:[{bucket:"classEnergy",value:5,note:"guarding damage grants class energy"}]},
    {name:"Flash Counter", grants:["blind"], effects:[{bucket:"meleeDamage",value:6,cond:"blind",note:"guard damage triggers a disorienting blast"}]},
    {name:"Relentless Strikes", grants:[], effects:[{bucket:"meleeDamage",value:6,note:"3 powered hits return ammo"}]},
    {name:"Tireless Blade", grants:[], effects:[{bucket:"meleeDamage",value:5,note:"2 powered kills chance to refund ammo"}]},
    {name:"Valiant Charge", grants:[], effects:[{bucket:"meleeDamage",value:8,note:"receiving damage while guarding buffs lunge distance"}]},
    {name:"Whirlwind Blade", grants:[], effects:[{bucket:"meleeDamage",value:15,note:"powered sword hits stack up to 30% dmg"}]},
    {name:"Shattering Blade", grants:[], effects:[{bucket:"meleeDamage",value:67,note:"heavy attack consuming last ammo buffs grounded heavy attack 67%"}]},
  ],
  Glaives: [
    {name:"Counterattack", grants:[], effects:[{bucket:"meleeDamage",value:50,note:"guard dmg early buffs next hit 50%"}]},
    {name:"Immovable Object", grants:[], effects:[{bucket:"classEnergy",value:8,note:"blocking stationary buffs weapon energy gain"}]},
    {name:"Melee Momentum", grants:[], effects:[{bucket:"meleeEnergy",value:8,note:"glaive melee kill grants weapon energy"}]},
    {name:"Replenishing Aegis", grants:[], effects:[{bucket:"dr",value:6,note:"blocking damage refills ammo"}]},
    {name:"Tilting at Windmills", grants:[], effects:[{bucket:"classEnergy",value:6,note:"blocking buffs move speed"}]},
    {name:"Unstoppable Force", grants:[], effects:[{bucket:"damage",value:20,note:"blocking damage buffs projectile damage 20%"}]},
  ],
  Shotguns: [
    {name:"Barrel Constrictor", grants:[], effects:[{bucket:"damage",value:8,note:"kill tightens pellet spread"}]},
    {name:"Blunt Execution Rounds", grants:[], effects:[{bucket:"meleeDamage",value:100,note:"melee hit in 15m buffs damage massively"}]},
    {name:"One-Two Punch", grants:[], effects:[{bucket:"meleeDamage",value:100,note:"pellet hits buff melee damage 150%"}]},
    {name:"Trench Barrel", grants:[], effects:[{bucket:"damage",value:50,note:"melee damage buffs next 3 shots 50%"}]},
  ],
  Snipers: [
    {name:"Box Breathing", grants:[], effects:[{bucket:"damage",value:40,note:"ADS hold buffs next weakspot shot"}]},
    {name:"Firing Line", grants:[], effects:[{bucket:"damage",value:20,note:"near allies buffs precision damage"}]},
  ],
  Fusions: [
    {name:"Backup Plan", grants:[], effects:[{bucket:"damage",value:6,note:"readying buffs charge time + handling, minor dmg penalty"}]},
    {name:"Controlled Burst", grants:[], effects:[{bucket:"damage",value:20,note:"full burst hits buff damage + charge speed"}]},
    {name:"Kickstart", grants:[], effects:[{bucket:"damage",value:15,note:"slide after sprint buffs damage + charge time"}]},
    {name:"Reservoir Burst", grants:[], effects:[{bucket:"damage",value:33,note:"full battery next shot buffs damage 33%"}]},
  ],
  Launchers: [
    {name:"Bipod", grants:[], effects:[{bucket:"damage",value:5,note:"passive extra mag + reserves, minor blast/reload tradeoff"}]},
    {name:"Cluster Bomb", grants:[], effects:[{bucket:"damage",value:8,note:"impact releases cluster bombs"}]},
    {name:"Danger Zone", grants:[], effects:[{bucket:"damage",value:8,note:"near enemies buffs blast radius"}]},
    {name:"Explosive Light", grants:[], effects:[{bucket:"damage",value:8,note:"orb pickups buff damage + blast radius"}]},
    {name:"Full Court", grants:[], effects:[{bucket:"damage",value:8,note:"projectile lifetime scales damage up to +35%"}]},
    {name:"Tracking Module", grants:[], effects:[{bucket:"damage",value:5,note:"ADS enables rocket tracking"}]},
  ],
  MachineGuns: [
    {name:"Onslaught", grants:[], effects:[{bucket:"damage",value:10,note:"kills ramp fire rate + reload, max x3"}]},
    {name:"Target Lock", grants:[], effects:[{bucket:"damage",value:28,note:"continuous hits scale up to 45% dmg"}]},
  ],
};

// ---- ORIGIN TRAITS (real named, from raids/dungeons/vendors/foundries) ----
const ORIGIN_TRAITS = [
  {name:"Accelerated Assault", grants:[], effects:[{bucket:"damage",value:6,note:"3 hits refill mag/heat + buff damage"}]},
  {name:"Advanced Reflexes", grants:[], effects:[{bucket:"damage",value:5,note:"ADS/guard after damage buffs mobility/handling/charge"}]},
  {name:"Alacrity", grants:[], effects:[{bucket:"damage",value:6,note:"solo or near-dead ally buffs range/stability/reload/AA"}]},
  {name:"Ambush", grants:[], effects:[{bucket:"damage",value:9,note:"combat start buffs range/handling, LFR gets extra dmg"}]},
  {name:"Bray Inheritance", grants:[], effects:[{bucket:"classEnergy",value:6,note:"damage grants melee/grenade/class energy"}]},
  {name:"Bray Legacy", grants:[], effects:[{bucket:"classEnergy",value:8,note:"damage grants ability energy to most uncharged"}]},
  {name:"Carrion Munitions", grants:[], effects:[{bucket:"damage",value:8,note:"elite kill spawns a pursuing explosive drone"}]},
  {name:"Cast No Shadows", grants:[], effects:[{bucket:"meleeDamage",value:6,note:"melee damage refills mag + handling"}]},
  {name:"Classy Contender", grants:[], effects:[{bucket:"classEnergy",value:6,note:"weapon kill grants class ability energy"}]},
  {name:"Collective Purpose", grants:[], effects:[{bucket:"classEnergy",value:6,note:"ally nearby buffs range/handling/draw/charge"}]},
  {name:"Contending Cascade", grants:[], effects:[{bucket:"damage",value:8,note:"rapid kills buff handling/reload + trigger elemental explosion"}]},
  {name:"Crossing Over", grants:[], effects:[{bucket:"damage",value:6,note:"mag level scaling buffs range/handling or damage"}]},
  {name:"Cursed Thrall", grants:[], effects:[{bucket:"damage",value:8,note:"melee kill causes weapon kills to chain explode"}]},
  {name:"Dawning Surprise", grants:[], effects:[{bucket:"healing",value:8,note:"kill counter spawns a healing/ability gift"}]},
  {name:"Dealer's Choice", grants:[], effects:[{bucket:"superEnergy",value:6,note:"weapon kills grant super energy, scales with weapons used"}]},
  {name:"Dimensional Shift", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield",note:"void breach pickup buffs kills to grant overshield"}]},
  {name:"Disaster Plan", grants:[], effects:[{bucket:"damage",value:5,note:"ammo pickup buffs range + flinch resist"}]},
  {name:"Dragon's Vengeance", grants:[], effects:[{bucket:"damage",value:8,note:"crit health/ally death refills mag + buffs stats"}]},
  {name:"Dream Work", grants:[], effects:[{bucket:"healing",value:8,note:"assist/kill on ally-damaged target refills + overflows mag"}]},
  {name:"Elliptical Orbit", grants:[], effects:[{bucket:"classEnergy",value:6,note:"sprinting buffs ammo gen"}]},
  {name:"Explosive Pact", grants:[], effects:[{bucket:"classEnergy",value:6,note:"grenade use/kill stacks reload + stability"}]},
  {name:"Exhaustive Research", grants:[], effects:[{bucket:"damage",value:6,note:"ADS near enemy loads a bonus micro-rocket"}]},
  {name:"Extrovert", grants:[], effects:[{bucket:"healing",value:8,note:"kill near enemies/nightmare restores health"}]},
  {name:"Fail-Deadly", grants:[], effects:[{bucket:"damage",value:6,note:"damage stacks mag capacity, max grants big bonus"}]},
  {name:"Featherweight", grants:[], effects:[{bucket:"classEnergy",value:5,note:"kills stack move speed, max 10 stacks"}]},
  {name:"Field-Tested", grants:[], effects:[{bucket:"damage",value:8,note:"permanent build via hits/kills buffs all stats"}]},
  {name:"Fleet Footed", grants:[], effects:[{bucket:"classEnergy",value:5,note:"damage/kill buffs move speed + ammo energy"}]},
  {name:"Forge's Kin", grants:[], effects:[{bucket:"damage",value:6,note:"readying weapon buffs reload/ammo gen, stacks combat dmg"}]},
  {name:"Frame of Reference", grants:[], effects:[{bucket:"damage",value:5,note:"kills stack range/reload/dmg, max 7%"}]},
  {name:"Gear Shift", grants:[], effects:[{bucket:"damage",value:20,note:"reload after kill/amplified stacks dmg up to 35%"}]},
  {name:"Gravity Well", grants:[], effects:[{bucket:"classEnergy",value:4,note:"reload pulls in nearby ammo/motes/crests"}]},
  {name:"Gun and Run", grants:[], effects:[{bucket:"damage",value:6,note:"kill stacks then sprint refills mag repeatedly"}]},
  {name:"Häkke Breach Armaments", grants:[], effects:[{bucket:"damage",value:20,note:"passive bonus vs vehicles/turrets/constructs/stasis crystals"}]},
  {name:"Head Rush", grants:[], effects:[{bucket:"damage",value:15,note:"stand after crouch/slide buffs damage + handling + reload"}]},
  {name:"Heretical Behavior", grants:[], effects:[{bucket:"damage",value:8,note:"rapid hits buff dmg vs combatants + handling + reload"}]},
  {name:"Hot Swap", grants:[], effects:[{bucket:"classEnergy",value:6,note:"readying weapon after damage buffs handling"}]},
  {name:"Ignoble Deeds", grants:[], effects:[{bucket:"damage",value:8,note:"inflict debuffs stack, kill consumes for handling/reload"}]},
  {name:"Imperial Allegiance", grants:[], effects:[{bucket:"classEnergy",value:6,note:"allies nearby buff cooling/charge rate + damage"}]},
  {name:"Impromptu Ammunition", grants:[], effects:[{bucket:"classEnergy",value:4,note:"weapon kill buffs special/power ammo progress"}]},
  {name:"Indomitability", grants:[], effects:[{bucket:"classEnergy",value:6,note:"weapon kill grants ability energy"}]},
  {name:"Nadir Focus", grants:[], effects:[{bucket:"damage",value:6,note:"firing/swinging builds range + accuracy + velocity stacks"}]},
  {name:"Nano-Munitions", grants:[], effects:[{bucket:"classEnergy",value:5,note:"near ally stacks, readying power weapon refills mag"}]},
  {name:"Nanotech Tracer Missiles", grants:[], effects:[{bucket:"damage",value:10,note:"mag-hits spawn tracking rockets"}]},
  {name:"Noble Deeds", grants:[], effects:[{bucket:"classEnergy",value:6,note:"buffing ally stacks, kill consumes for handling/reload"}]},
  {name:"Omolon Fluid Dynamics", grants:[], effects:[{bucket:"damage",value:6,note:"top half of mag buffs stability + reload"}]},
  {name:"One Quiet Moment", grants:[], effects:[{bucket:"classEnergy",value:6,note:"out of combat stacks handling + reload"}]},
  {name:"Paracausal Affinity", grants:[], effects:[{bucket:"damage",value:20,note:"kill matching Light/Dark alignment buffs damage 20%"}]},
  {name:"Paracausal Fluid", grants:[], effects:[{bucket:"classEnergy",value:6,note:"dealing damage buffs handling/mobility/charge rate"}]},
  {name:"Photoinhibition", grants:["blind"], effects:[{bucket:"damage",value:8,cond:"blind",note:"passive shield dmg bonus + disorient on shield break"}]},
  {name:"Problem Solver", grants:[], effects:[{bucket:"damage",value:6,note:"multi-hits vs boss/champion buff reload/handling + exhaust"}]},
  {name:"Psychohack", grants:[], effects:[{bucket:"damage",value:6,note:"multi-hits inflict Exhaust on target"}]},
  {name:"Radiolaria Transposer", grants:[], effects:[{bucket:"damage",value:6,note:"kills build progress to explode targets + create pool"}]},
  {name:"Right Hook", grants:[], effects:[{bucket:"meleeDamage",value:6,note:"melee damage buffs range + aim assist"}]},
  {name:"Roar of Battle", grants:[], effects:[{bucket:"damage",value:6,note:"maintained combat buffs stability + handling"}]},
  {name:"Runneth Over", grants:[], effects:[{bucket:"damage",value:5,note:"reload near allies buffs mag capacity per ally"}]},
  {name:"Search Party", grants:[], effects:[{bucket:"classEnergy",value:4,note:"no allies nearby buffs ADS + movement"}]},
  {name:"Skulking Wolf", grants:[], effects:[{bucket:"dr",value:6,note:"kill at low HP buffs radar + stealth"}]},
  {name:"Souldrinker", grants:[], effects:[{bucket:"healing",value:8,note:"reload after hits restores health"}]},
  {name:"Splicer Surge", grants:[], effects:[{bucket:"damage",value:6,note:"reload after damage stacks handling/reload"}]},
  {name:"Sundering", grants:[], effects:[{bucket:"damage",value:6,note:"destroy vehicle/shield buffs reload + draw time"}]},
  {name:"Tenacity", grants:[], effects:[{bucket:"damage",value:6,note:"kill near enemies stacks dmg/handling/reload, max x20"}]},
  {name:"Tex Balanced Stock", grants:[], effects:[{bucket:"damage",value:6,note:"hipfire hits buff range/handling/reload"}]},
  {name:"Timelost Magazine", grants:[], effects:[{bucket:"superEnergy",value:8,note:"super end refills mag to 100% capacity, kills grant super"}]},
  {name:"To Excess", grants:[], effects:[{bucket:"grenadeEnergy",value:8,note:"kill with full super buffs grenade + melee stats"}]},
  {name:"Unburied Treasure", grants:[], effects:[{bucket:"damage",value:5,note:"readying weapon buffs range + accuracy briefly"}]},
  {name:"Unsated Hunger", grants:[], effects:[{bucket:"damage",value:6,note:"abilities uncharged buffs stability/handling/reload"}]},
  {name:"Vanguard Determination", grants:[], effects:[{bucket:"dr",value:6,note:"kill after class ability stacks damage resistance"}]},
  {name:"Vanguard's Vindication", grants:[], effects:[{bucket:"healing",value:6,note:"weapon kill restores health"}]},
  {name:"Veist Stinger", grants:[], effects:[{bucket:"damage",value:5,note:"hits chance to refill mag + reduce ADS move penalty"}]},
  {name:"Veteran's Wisdom", grants:[], effects:[{bucket:"damage",value:8,note:"precision/rapid kills trigger a kinetic shockwave"}]},
  {name:"Wild Card", grants:[], effects:[{bucket:"damage",value:8,note:"weapon kill spawns homing bolts"}]},
  {name:"Willing Vessel", grants:[], effects:[{bucket:"damage",value:8,note:"damage/kills build counter buffing stability/handling/reload"}]},
  {name:"Gun and Run", grants:[], effects:[{bucket:"damage",value:6,note:"kill stacks then sprint refills mag repeatedly"}]},
  {name:"Skulking Wolf", grants:[], effects:[{bucket:"dr",value:6,note:"kill at low HP buffs radar + stealth vs enemy targeting"}]},
  {name:"Winterized Gear", grants:[], effects:[{bucket:"damage",value:6,note:"dealing/receiving damage stacks stability/handling/reload"}]},
];

// ---- BARRELS ----
const BARRELS = [
  {name:"Full Choke", grants:[], effects:[{bucket:"damage",value:3,note:"ADS tightens pellet spread, small precision dmg tradeoff"}]},
  {name:"Smoothbore", grants:[], effects:[{bucket:"damage",value:3,note:"buffs range, widens pellet spread"}]},
  {name:"Standard Barrel", grants:[], effects:[], desc:"no special effect — baseline barrel"},
];

// ---- MAGS ----
const MAGS = [
  {name:"Alloy Magazine", grants:[], effects:[{bucket:"damage",value:3,note:"reload speed scales as mag empties"}]},
  {name:"Armor-Piercing Rounds", grants:[], effects:[{bucket:"damage",value:5,note:"range buff, minor shield dmg, overpenetrates once"}]},
  {name:"Drop Mag", grants:[], effects:[{bucket:"damage",value:4,note:"faster reload, smaller mag size"}]},
  {name:"Ricochet Rounds", grants:[], effects:[{bucket:"damage",value:4,note:"bullets ricochet, buffs range + stability"}]},
  {name:"Seraph Rounds", grants:[], effects:[{bucket:"damage",value:5,note:"overpenetrate + ricochet, buffs range + stability"}]},
  {name:"Swap Mag", grants:[], effects:[{bucket:"damage",value:3,note:"faster ready/stow duration"}]},
  {name:"High-Caliber Rounds", grants:[], effects:[{bucket:"damage",value:4,note:"increased flinch on target, buffs range"}]},
  {name:"Spike Grenades", grants:[], effects:[{bucket:"damage",value:6,note:"GL: increased impact damage + stability"}]},
  {name:"Sticky Grenades", grants:[], effects:[{bucket:"damage",value:8,note:"GL: sticks to surfaces, buffs explosive damage"}]},
  {name:"Impact Casing", grants:[], effects:[{bucket:"damage",value:5,note:"Rocket: buffs impact damage + stability"}]},
  {name:"Standard Mag", grants:[], effects:[], desc:"no special effect — baseline magazine"},
  {name:"Disorienting Grenades", grants:["blind"], effects:[{bucket:"damage",value:5,cond:"blind",note:"disorients rank-file/mini-boss, reduced blast/damage"}]},
  {name:"Heavy Bolts", grants:[], effects:[{bucket:"damage",value:5,note:"crossbow: more damage, slower heavier arc"}]},
  {name:"Serrated Bolts", grants:[], effects:[{bucket:"damage",value:5,note:"crossbow: recovering embedded bolts deals bonus damage"}]},
];

const ALL_ELEMENTS_FOR_PERKS = ["Kinetic","Arc","Solar","Void","Stasis","Strand"];

// Map a frame/archetype name to its weapon-type-locked perk category, if any.
function weaponCategoryFor(name){
  if(/Sword/i.test(name)) return "Swords";
  if(/Glaive/i.test(name)) return "Glaives";
  if(/Shotgun/i.test(name)) return "Shotguns";
  if(/Sniper/i.test(name)) return "Snipers";
  if(/Fusion Rifle/i.test(name)) return "Fusions";
  if(/Bow/i.test(name)) return "Bows";
  if(/Machine Gun/i.test(name)) return "MachineGuns";
  if(/Rocket|Grenade Launcher/i.test(name)) return "Launchers";
  return null;
}

// Builds the base perk pool for a given frame pool key + element: Universal
// perks (always available) + Element-locked perks for the chosen burn.
function buildElementPerkPool(elem){
  return [...UNIVERSAL_PERKS, ...(ELEMENT_LOCKED_PERKS[elem]||[])];
}
const FRAME_PERK_POOLS = {};
Object.keys(FRAME_POOL_RAW).forEach(key=>{
  FRAME_PERK_POOLS[key] = {};
  ALL_ELEMENTS_FOR_PERKS.forEach(e=>{ FRAME_PERK_POOLS[key][e] = buildElementPerkPool(e); });
});

// Resolves the correct perk pool for a specific archetype + element,
// correctly layering in weapon-type-locked perks (Bows, Swords, Glaives,
// etc.) even when the archetype's frame pool key is shared with other
// weapon types that don't get those same type-locked perks.
function perkPoolForArchetype(arch, elem){
  const base = FRAME_PERK_POOLS[arch.framePool][elem];
  const cat = weaponCategoryFor(arch.name);
  return cat ? [...base, ...(WEAPON_TYPE_PERKS[cat]||[])] : base;
}


// ---- WEAPON MODS (Generic + Adept only — no Fragile/Arms Day/Retired mods) ----
// Source: Shattered Vault weapon mods KB. Most of these are pure handling/
// stat mods (recoil, zoom, range) with no build-synergy relevance, so they're
// marked utility-only (desc, no bucket) rather than assigned a fake number —
// only the few with real ability-adjacent effects get a bucket value.
const MODS = [
  {name:"Abundant Ammo", grants:[], effects:[], desc:"slightly increased ammo generation"},
  {name:"Bandolier", grants:[], effects:[], desc:"~10% increased ammo generation"},
  {name:"Sweaty Confetti", grants:[], effects:[], desc:"festive celebration on precision final blow (one-time use)"},
  {name:"Full-Auto Retrofit", grants:[], effects:[], desc:"holding the trigger fires this weapon full-auto"},
  {name:"Counterbalance", grants:[], effects:[], desc:"+15 recoil deviation reduction"},
  {name:"Targeting Adjuster", grants:[], effects:[], desc:"+5 aim assistance, improved hitbox"},
  {name:"Freehand Grip", grants:[], effects:[], desc:"increased hip-fire accuracy + ready speed"},
  {name:"Icarus Grip", grants:[], effects:[], desc:"improved accuracy while airborne"},
  {name:"Backup Mag", grants:[], effects:[], desc:"+3 magazine, +30 ammo capacity"},
  {name:"Sprint Grip", grants:[], effects:[], desc:"brief ready speed/aiming boost after sprinting"},
  {name:"Quick Access Sling", grants:[], effects:[], desc:"faster weapon swap for a short time after emptying the mag"},
  {name:"Radar Tuner", grants:[], effects:[], desc:"radar returns immediately after ADS"},
  {name:"Radar Booster", grants:[], effects:[], desc:"slightly increased radar range"},
  {name:"Flight", grants:[], effects:[], desc:"+6 Blast Radius, +6 Velocity"},
  {name:"Anti-Flinch", grants:[], effects:[], desc:"+15 Flinch Resistance"},
  {name:"Ballistics", grants:[], effects:[], desc:"+6 Range, +6 Stability"},
  {name:"CQC Optics - High", grants:[], effects:[], desc:"+1 Zoom"},
  {name:"CQC Optics - Low", grants:[], effects:[], desc:"-1 Zoom"},
  {name:"Edge", grants:[], effects:[], desc:"sword: +6 Charge Rate, +6 Guard Resistance"},
  {name:"Marksman Optics - High", grants:[], effects:[], desc:"+2 Zoom"},
  {name:"Marksman Optics - Low", grants:[], effects:[], desc:"-2 Zoom"},
  {name:"Stunloader", grants:[], effects:[{bucket:"classEnergy",value:3,note:"stunning a Champion partially refills this weapon from reserves"}]},
  {name:"Synergy", grants:["orbOfPower"], effects:[{bucket:"classEnergy",value:4,cond:"orbOfPower",note:"final blows chance to create a matching elemental pickup or orb"}]},
  {name:"Tactical", grants:[], effects:[], desc:"+6 Reload Speed, +6 Handling"},
  {name:"Tension", grants:[], effects:[], desc:"-6 Draw Time, +6 Accuracy"},
  {name:"Adept Counterbalance", grants:[], effects:[], desc:"+25 recoil direction, +75 vertical bounce intensity (at a range cost)"},
  {name:"Adept Targeting", grants:[], effects:[], desc:"+10 Aim Assistance, -15 Stability"},
  {name:"Adept Icarus Grip", grants:[], effects:[], desc:"improved airborne accuracy, +5 Range"},
  {name:"Adept Accuracy", grants:[], effects:[], desc:"bow: +10 Accuracy"},
  {name:"Adept Impact", grants:[], effects:[], desc:"sword: +10 Impact"},
  {name:"Adept Draw Time", grants:[], effects:[], desc:"bow: -10 Draw Time"},
  {name:"Adept Blast Radius", grants:[], effects:[], desc:"+10 Blast Radius"},
  {name:"Adept Projectile Speed", grants:[], effects:[], desc:"+10 Velocity"},
  {name:"Adept Charge Time", grants:[], effects:[], desc:"fusion: +10 Charge Time"},
  {name:"Adept Handling", grants:[], effects:[], desc:"+10 Handling"},
  {name:"Adept Mag", grants:[], effects:[], desc:"+40 Magazine, -15 Handling"},
  {name:"Adept Range", grants:[], effects:[], desc:"+10 Range"},
  {name:"Adept Reload", grants:[], effects:[], desc:"+10 Reload Time"},
  {name:"Adept Stability", grants:[], effects:[], desc:"+10 Stability"},
];

const FRAME_BARREL_POOLS = {};
const FRAME_MAG_POOLS = {};
const FRAME_ORIGIN_TRAIT_POOLS = {};
const FRAME_MOD_POOLS = {}; // Mod = a 3rd perk-like pick from the same combined pool as Perk 1/2
Object.keys(FRAME_POOL_RAW).forEach(key=>{
  FRAME_BARREL_POOLS[key] = {}; FRAME_MAG_POOLS[key] = {}; FRAME_ORIGIN_TRAIT_POOLS[key] = {}; FRAME_MOD_POOLS[key] = {};
  ALL_ELEMENTS_FOR_PERKS.forEach(e=>{
    FRAME_BARREL_POOLS[key][e] = BARRELS;
    FRAME_MAG_POOLS[key][e] = MAGS;
    FRAME_ORIGIN_TRAIT_POOLS[key][e] = ORIGIN_TRAITS;
    // weapon-type-locked perks resolved per frame-pool-key here work for
    // exclusive keys like "Sword Frame (Heavy)"; shared keys (Adaptive Frame
    // (Primary), etc.) just get the base Universal+Element pool since no
    // weapon-type category applies to more than one shared frame key here.
    const cat = weaponCategoryFor(key);
    FRAME_MOD_POOLS[key][e] = MODS;
  });
});

// ---- TIERED LEGENDARY WEAPON ARCHETYPES (Gear Tier 1-5, exotics excluded) ----
// Each archetype references a framePool key (see FRAME_PERK_POOLS above) so
// its 2 perk dropdowns show the real perks available to that frame + chosen
// burn, instead of a generic universal list.
const LEGENDARY_ARCHETYPES = [
  // ==================== PRIMARY (Top slot: Kinetic/Stasis/Strand, Middle slot: Arc/Solar/Void) ====================
  // --- Auto Rifle ---
  {name:"Auto Rifle — High-Impact Frame (400 RPM)", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Primary)"},
  {name:"Auto Rifle — Precision Frame (450 RPM)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Auto Rifle — Adaptive Frame (600 RPM)", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Primary)"},
  {name:"Auto Rifle — Rapid-Fire Frame (720 RPM)", slots:["Kinetic","Energy"], framePool:"Rapid-Fire Frame (Primary)"},
  {name:"Auto Rifle — Support Frame (Healing)", slots:["Energy"], framePool:"Support Frame (Primary)"},
  // --- Hand Cannon ---
  {name:"Hand Cannon — Aggressive Frame (120 RPM)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  {name:"Hand Cannon — Adaptive Frame (140 RPM)", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Primary)"},
  {name:"Hand Cannon — Precision Frame (180 RPM)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Hand Cannon — Heavy Burst Frame (111 RPM, 2rb)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Hand Cannon — Spread Frame (pellet spread)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  // --- Pulse Rifle ---
  {name:"Pulse Rifle — High-Impact Frame (340 RPM)", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Primary)"},
  {name:"Pulse Rifle — Adaptive Frame (390 RPM)", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Primary)"},
  {name:"Pulse Rifle — Lightweight Frame (450 RPM)", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Primary)"},
  {name:"Pulse Rifle — Aggressive Burst Frame (450 RPM, 4rb)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  {name:"Pulse Rifle — Heavy Burst Frame (395 RPM, 2rb)", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Primary)"},
  // --- Scout Rifle ---
  {name:"Scout Rifle — High-Impact Frame (150 RPM)", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Primary)"},
  {name:"Scout Rifle — Precision Frame (180 RPM)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Scout Rifle — Lightweight Frame (200 RPM)", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Primary)"},
  {name:"Scout Rifle — Rapid-Fire Frame (260 RPM)", slots:["Kinetic","Energy"], framePool:"Rapid-Fire Frame (Primary)"},
  {name:"Scout Rifle — Aggressive Frame (120 RPM)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  // --- SMG ---
  {name:"SMG — Aggressive Frame (720 RPM)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  {name:"SMG — Precision Frame (600 RPM)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"SMG — Lightweight Frame (900 RPM)", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Primary)"},
  {name:"SMG — Adaptive Frame (900 RPM)", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Primary)"},
  // --- Sidearm ---
  {name:"Sidearm — Precision Frame (260 RPM)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Sidearm — Lightweight Frame (360 RPM)", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Primary)"},
  {name:"Sidearm — Aggressive Burst Frame (491 RPM)", slots:["Kinetic","Energy"], framePool:"Aggressive Frame (Primary)"},
  {name:"Sidearm — Adaptive Burst Frame (491 RPM)", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Primary)"},
  {name:"Sidearm — Rapid-Fire Frame (450 RPM)", slots:["Kinetic","Energy"], framePool:"Rapid-Fire Frame (Primary)"},
  {name:"Sidearm — Rocket-Assisted Frame (Special ammo)", slots:["Kinetic","Energy"], framePool:"Rocket-Assisted Frame (Special)"},
  // --- Bow ---
  {name:"Bow — Precision Frame (Compound)", slots:["Kinetic","Energy"], framePool:"Precision Frame (Primary)"},
  {name:"Bow — Lightweight Frame (Recurve)", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Primary)"},
  {name:"Bow — High-Impact Longbow Frame", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Primary)"},

  // ==================== SPECIAL AMMO (Top or Middle slot depending on weapon) ====================
  // --- Rocket Pulse Rifle ---
  {name:"Pulse Rifle — Micro-Missile Frame (Special ammo)", slots:["Kinetic","Energy"], framePool:"Wave Frame (Special)"},
  // --- Shotgun ---
  {name:"Shotgun — Aggressive Frame", slots:["Energy","Power"], framePool:"Aggressive Frame (Special)"},
  {name:"Shotgun — Precision Frame (Pellet)", slots:["Energy","Power"], framePool:"High-Impact Frame (Special)"},
  {name:"Shotgun — Pinpoint Slug Frame", slots:["Energy","Power"], framePool:"High-Impact Frame (Special)"},
  {name:"Shotgun — Lightweight Frame", slots:["Energy","Power"], framePool:"Lightweight Frame (Special)"},
  {name:"Shotgun — Rapid-Fire Frame", slots:["Energy","Power"], framePool:"Rapid-Fire Frame (Special)"},
  {name:"Shotgun — Shot Package Frame", slots:["Energy","Power"], framePool:"Adaptive Frame (Special)"},
  {name:"Shotgun — Heavy Burst Frame (2rb slug)", slots:["Energy","Power"], framePool:"High-Impact Frame (Special)"},
  // --- Fusion Rifle ---
  {name:"Fusion Rifle — High-Impact Frame", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Special)"},
  {name:"Fusion Rifle — Precision Frame", slots:["Kinetic","Energy"], framePool:"High-Impact Frame (Special)"},
  {name:"Fusion Rifle — Adaptive Frame", slots:["Kinetic","Energy"], framePool:"Adaptive Frame (Special)"},
  {name:"Fusion Rifle — Rapid-Fire Frame", slots:["Kinetic","Energy"], framePool:"Rapid-Fire Frame (Special)"},
  {name:"Fusion Rifle — Aggressive Frame (horizontal bolt)", slots:["Energy"], framePool:"Aggressive Frame (Special)"},
  // --- Breech Grenade Launcher (Special) ---
  {name:"Grenade Launcher (Special) — Lightweight Frame", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Special)"},
  {name:"Grenade Launcher (Special) — Wave Frame", slots:["Kinetic","Energy"], framePool:"Wave Frame (Special)"},
  {name:"Grenade Launcher (Special) — Double Fire Frame", slots:["Kinetic","Energy"], framePool:"Lightweight Frame (Special)"},
  {name:"Grenade Launcher (Special) — Micro-Missile Frame", slots:["Kinetic"], framePool:"Lightweight Frame (Special)"},
  {name:"Grenade Launcher (Special) — Area Denial Frame", slots:["Kinetic"], framePool:"Lightweight Frame (Special)"},
  // --- Sniper Rifle ---
  {name:"Sniper Rifle — Adaptive Frame", slots:["Kinetic","Energy","Power"], framePool:"Rapid-Fire Frame (Special)"},
  {name:"Sniper Rifle — Aggressive Frame", slots:["Kinetic","Energy","Power"], framePool:"High-Impact Frame (Special)"},
  {name:"Sniper Rifle — Rapid-Fire Frame", slots:["Kinetic","Energy","Power"], framePool:"Rapid-Fire Frame (Special)"},
  // --- Trace Rifle ---
  {name:"Trace Rifle — Adaptive Frame", slots:["Energy","Power"], framePool:"Adaptive Frame (Primary)"},
  // --- Glaive ---
  {name:"Glaive — Adaptive Frame", slots:["Energy"], framePool:"Wave Frame (Special)"},
  {name:"Glaive — Aggressive Frame", slots:["Energy"], framePool:"Wave Frame (Special)"},
  {name:"Glaive — Rapid-Fire Frame", slots:["Energy"], framePool:"Wave Frame (Special)"},

  // ==================== HEAVY / POWER ====================
  // --- Rocket Launcher ---
  {name:"Rocket Launcher — High-Impact Frame (massive blast radius)", slots:["Power"], framePool:"Precision Frame (Heavy)"},
  {name:"Rocket Launcher — Precision Frame (built-in tracking)", slots:["Power"], framePool:"Precision Frame (Heavy)"},
  {name:"Rocket Launcher — Adaptive Frame", slots:["Power"], framePool:"Adaptive Frame (Heavy)"},
  {name:"Rocket Launcher — Aggressive Frame", slots:["Power"], framePool:"Aggressive Frame (Heavy)"},
  // --- Drum Grenade Launcher (Heavy) ---
  {name:"Grenade Launcher (Heavy) — Adaptive Frame", slots:["Power"], framePool:"Adaptive Frame (Heavy)"},
  {name:"Grenade Launcher (Heavy) — Rapid-Fire Frame", slots:["Power"], framePool:"Rapid-Fire Frame (Heavy)"},
  {name:"Grenade Launcher (Heavy) — Compressed Wave Frame", slots:["Power"], framePool:"Adaptive Frame (Heavy)"},
  // --- Machine Gun ---
  {name:"Machine Gun — High-Impact Frame (360 RPM)", slots:["Power"], framePool:"Precision Frame (Heavy)"},
  {name:"Machine Gun — Adaptive Frame (450 RPM)", slots:["Power"], framePool:"Adaptive Frame (Heavy)"},
  {name:"Machine Gun — Rapid-Fire Frame (900 RPM)", slots:["Power"], framePool:"Rapid-Fire Frame (Heavy)"},
  // --- Linear Fusion Rifle ---
  {name:"Linear Fusion Rifle — Precision Frame (single bolt)", slots:["Power"], framePool:"Precision Frame (Heavy)"},
  {name:"Linear Fusion Rifle — Adaptive/Aggressive Burst (3rb)", slots:["Power"], framePool:"High-Impact Frame (Heavy)"},
  // --- Sword ---
  {name:"Sword — Adaptive Frame (uppercut)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
  {name:"Sword — Vortex Frame (360 spin)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
  {name:"Sword — Caster Frame (ranged projectile)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
  {name:"Sword — Lightweight Frame (sprint slash)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
  {name:"Sword — Aggressive Frame (overhead slam)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
  {name:"Sword — Wave Frame (ground shockwave)", slots:["Power"], framePool:"Sword Frame (Heavy)"},
];
const WEAPON_TIER_DMG_PER_TIER = 0.025; // +2.5% scaling per tier above 1, representative only

