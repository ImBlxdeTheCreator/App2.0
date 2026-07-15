/* Armor mods, tuning mods, and armor set data
   Extracted from the original monolithic index.html without behavioral rewrites. */
// ---- ARMOR MODS BY SLOT (Armor 3.0) ----
// Real mods split by which armor piece they socket into. Many are pure
// ammo/utility mods (ammo finders, targeting, unflinching, loaders,
// dexterity, reserves) that don't move any of this tool's synergy % buckets —
// those are still listed (so the full roster is here) but marked utility-only
// via `desc` instead of `effects`, rather than faked with invented numbers.
// Elemental families. Order matters for the dropdown; Harmonic (matches your
// subclass element) leads, then Kinetic, then the five subclass elements.
const ELEMENTS_FOR_MODS = ["Harmonic","Kinetic","Arc","Solar","Void","Stasis","Strand"];

function elementalUtilityMods(prefix, descTemplate, energy){
  return ELEMENTS_FOR_MODS.map(e=>({name:`${e} ${prefix}`, grants:[], effects:[], desc:descTemplate(e), energy: energy || 1}));
}
// Weapon Surge exists for every element including Kinetic and Harmonic.
function elementalWeaponSurge(){
  return ELEMENTS_FOR_MODS.map(e=>({name:`${e} Weapon Surge`, grants:[], effects:[{bucket:"damage",value:6,cond:"matching-element",note:`${e} weapon damage buff while you have Armor Charge (stacks 10%/17%/22%)`}], energy:3}));
}
// Siphon spawns an Orb of Power from rapid matching-element weapon final
// blows — the primary Armor Charge generator. Harmonic costs a little more.
function elementalSiphon(){
  return ELEMENTS_FOR_MODS.map(e=>({name:`${e} Siphon`, grants:[], effects:[{bucket:"grenadeEnergy",value:4,cond:"matching-element",note:`rapid ${e} weapon final blows spawn an Orb of Power`}], energy: e==="Harmonic"?2:1}));
}
// Holster gradually reloads a stowed weapon of the matching family (Legs).
function elementalHolster(){
  return ELEMENTS_FOR_MODS.map(e=>({name:`${e} Holster`, grants:[], effects:[], desc:`stowed ${e} weapons steadily reload while holstered — utility only`, energy: e==="Harmonic"?2:1}));
}

// ---- ARMOR MODS BY SLOT (Armor 3.0, current game) ----
// Slotting mirrors the live game: ammo/Siphon/Targeting/Super-gen on the
// Helmet; Loaders/Dexterity/ability-kickstarts/orb-gen on Arms; Resistances/
// Unflinching/Reserves/Armor-Charge on the Chest; Scavenger/Surge/Holster/
// orb-pickup mods on the Legs; class-ability + finisher mods on the Class
// Item. Removed the pre-Lightfall Charged-with-Light / elemental-well "Font"
// mods that no longer exist in-game. Every mod carries an Armor 3.0 `energy`
// cost. Pure utility mods (no synergy-bucket effect) list a `desc` instead.
const ARMOR_MODS_BY_SLOT = {
  Helmet: [
    ...elementalSiphon(),
    ...elementalUtilityMods("Targeting", e=>`improved aim assist / accuracy / ADS for ${e} weapons — utility only`, 3),
    {name:"Special Ammo Finder", grants:[], effects:[], desc:"generates Special ammo over time / from kills — ammo economy", energy:1},
    {name:"Heavy Ammo Finder", grants:[], effects:[], desc:"increases Heavy ammo drops from powerful combatants — ammo economy", energy:3},
    {name:"Ashes to Assets", grants:[], effects:[{bucket:"superEnergy",value:6,note:"gain Super energy on grenade final blows"}], energy:1},
    {name:"Hands-On", grants:[], effects:[{bucket:"superEnergy",value:6,note:"gain Super energy on powered melee final blows"}], energy:1},
    {name:"Dynamo", grants:[], effects:[{bucket:"superEnergy",value:5,note:"using your class ability near enemies grants Super energy"}], energy:3},
  ],
  Arms: [
    ...elementalUtilityMods("Loader", e=>`faster reload for ${e} weapons — utility only`, 1),
    ...elementalUtilityMods("Dexterity", e=>`faster ready/stow (handling) for ${e} weapons — utility only`, 1),
    {name:"Fastball", grants:[], effects:[], desc:"increases grenade throw distance/speed — no damage change", energy:1},
    {name:"Grenade Kickstart", grants:[], effects:[{bucket:"grenadeEnergy",value:6,cond:"matching-element",note:"restores grenade energy when fully depleted (consumes Armor Charge)"}], energy:3},
    {name:"Melee Kickstart", grants:[], effects:[{bucket:"meleeEnergy",value:6,cond:"matching-element",note:"restores melee energy when fully depleted (consumes Armor Charge)"}], energy:3},
    {name:"Impact Induction", grants:[], effects:[{bucket:"meleeEnergy",value:6,note:"grenade damage reduces your melee cooldown"}], energy:2},
    {name:"Momentum Transfer", grants:[], effects:[{bucket:"grenadeEnergy",value:6,note:"melee damage reduces your grenade cooldown"}], energy:2},
    {name:"Bolstering Detonation", grants:[], effects:[{bucket:"classEnergy",value:6,note:"grenade damage grants class ability energy"}], energy:3},
    {name:"Focusing Strike", grants:[], effects:[{bucket:"classEnergy",value:6,note:"melee damage grants class ability energy"}], energy:3},
    {name:"Heavy Handed", grants:[], effects:[{bucket:"superEnergy",value:4,note:"powered melee final blows generate an Orb of Power and refund melee energy"}], energy:1},
    {name:"Firepower", grants:[], effects:[{bucket:"superEnergy",value:4,note:"grenade final blows generate an Orb of Power"}], energy:1},
  ],
  Chest: [
    {name:"Concussive Dampener", grants:[], effects:[{bucket:"dr",value:8,note:"reduces incoming area/splash damage"}], energy:3},
    {name:"Sniper Damage Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces damage from Sniper Rifle-wielding combatants"}], energy:2},
    {name:"Melee Damage Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming melee damage"}], energy:2},
    {name:"Arc Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming Arc damage"}], energy:2},
    {name:"Solar Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming Solar damage"}], energy:2},
    {name:"Void Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming Void damage"}], energy:2},
    {name:"Stasis Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming Stasis damage"}], energy:2},
    {name:"Strand Resistance", grants:[], effects:[{bucket:"dr",value:6,note:"reduces incoming Strand damage"}], energy:2},
    ...elementalUtilityMods("Unflinching", e=>`reduced flinch while aiming ${e} weapons — utility only`, 3),
    {name:"Kinetic Reserves", grants:[], effects:[], desc:"increases Kinetic-slot ammo reserves — utility only", energy:2},
    {name:"Arc Reserves", grants:[], effects:[], desc:"increases Arc weapon ammo reserves — utility only", energy:2},
    {name:"Solar Reserves", grants:[], effects:[], desc:"increases Solar weapon ammo reserves — utility only", energy:2},
    {name:"Void Reserves", grants:[], effects:[], desc:"increases Void weapon ammo reserves — utility only", energy:2},
    {name:"Stasis Reserves", grants:[], effects:[], desc:"increases Stasis weapon ammo reserves — utility only", energy:2},
    {name:"Strand Reserves", grants:[], effects:[], desc:"increases Strand weapon ammo reserves — utility only", energy:2},
    {name:"Harmonic Reserves", grants:[], effects:[], desc:"increases reserves for weapons matching your subclass element — utility only", energy:2},
    {name:"Charged Up", grants:[], effects:[], desc:"+1 to your maximum Armor Charge stacks — utility only", energy:3},
    {name:"Emergency Reinforcement", grants:[], effects:[{bucket:"dr",value:8,note:"breaking your shields grants brief damage resistance"}], energy:1},
  ],
  Legs: [
    {name:"Recuperation", grants:[], effects:[{bucket:"healing",value:6,note:"picking up an Orb of Power starts health regeneration"}], energy:1},
    {name:"Better Already", grants:[], effects:[{bucket:"healing",value:8,note:"picking up an Orb while critically wounded rapidly heals you"}], energy:3},
    {name:"Absolution", grants:[], effects:[{bucket:"classEnergy",value:6,note:"picking up an Orb reduces all ability cooldowns"},{bucket:"grenadeEnergy",value:4},{bucket:"meleeEnergy",value:4}], energy:1},
    {name:"Innervation", grants:[], effects:[{bucket:"grenadeEnergy",value:8,note:"picking up an Orb of Power grants grenade energy"}], energy:1},
    {name:"Invigoration", grants:[], effects:[{bucket:"meleeEnergy",value:8,note:"picking up an Orb of Power grants melee energy"}], energy:1},
    {name:"Insulation", grants:[], effects:[{bucket:"classEnergy",value:8,note:"picking up an Orb of Power grants class ability energy"}], energy:1},
    {name:"Orbs of Restoration", grants:[], effects:[{bucket:"classEnergy",value:5,note:"picking up an Orb at low ability energy grants ability energy"}], energy:1},
    ...elementalUtilityMods("Scavenger", e=>`bonus reserves when picking up ${e} weapon ammo — utility only`, 3),
    ...elementalWeaponSurge(),
    ...elementalHolster(),
    {name:"Stacks on Stacks", grants:[], effects:[], desc:"picking up an Orb of Power grants +1 extra Armor Charge — utility only", energy:4},
  ],
  ClassItem: [
    {name:"Reaper", grants:[], effects:[{bucket:"superEnergy",value:5,note:"after using your class ability, your next weapon final blow spawns an Orb of Power"}], energy:1},
    {name:"Bomber", grants:[], effects:[{bucket:"grenadeEnergy",value:8,note:"using your class ability grants grenade energy"}], energy:3},
    {name:"Outreach", grants:[], effects:[{bucket:"meleeEnergy",value:8,note:"using your class ability grants melee energy"}], energy:3},
    {name:"Distribution", grants:[], effects:[{bucket:"classEnergy",value:6,note:"using your class ability near enemies reduces all ability cooldowns"},{bucket:"grenadeEnergy",value:4},{bucket:"meleeEnergy",value:4}], energy:4},
    {name:"Utility Kickstart", grants:[], effects:[{bucket:"classEnergy",value:6,cond:"matching-element",note:"restores class ability energy when fully depleted (consumes Armor Charge)"}], energy:3},
    {name:"Proximity Ward", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield",note:"finishers grant an overshield to you and nearby allies"}], energy:4},
    {name:"Bulwark Finisher", grants:["overshield"], effects:[{bucket:"dr",value:8,cond:"overshield",note:"finishers grant an overshield"}], energy:3},
    {name:"Healthy Finisher", grants:[], effects:[{bucket:"healing",value:8,note:"finishers restore a portion of your health"}], energy:1},
    {name:"Explosive Finisher", grants:[], effects:[{bucket:"damage",value:6,note:"finishers trigger an elemental detonation"}], energy:4},
    {name:"Special Finisher", grants:[], effects:[], desc:"finishers generate Special ammo — utility only", energy:1},
    {name:"Snapload Finisher", grants:[], effects:[], desc:"finishers reload all your weapons — utility only", energy:1},
    {name:"Time Dilation", grants:[], effects:[], desc:"increases the duration of your Armor Charge before it decays — utility only", energy:2},
    {name:"Perpetuation", grants:[], effects:[], desc:"reduces the Armor Charge cost of your other mods — utility only", energy:1},
  ],
};

// ---- TIER 5 ARMOR TUNING MODS ----
// +5/-5 stat swaps between core armor stats. Only stats that map to one of
// this tool's synergy buckets show a number (Weapons stat has no bucket here
// since it governs handling/reload rather than ability economy) — the trade
// is still shown in the name so you know what you're giving up.
const TUNING_MODS_BY_SLOT = {
  Helmet: [
    {name:"Helmet Balanced Tuning (+1 Class/Melee/Grenade)", effects:[{bucket:"classEnergy",value:2},{bucket:"meleeEnergy",value:2},{bucket:"grenadeEnergy",value:2}]},
    {name:"Helmet Swap: +5 Weapons / -5 Super", effects:[{bucket:"superEnergy",value:-4}]},
    {name:"Helmet Swap: +5 Health / -5 Super", effects:[{bucket:"healing",value:4},{bucket:"superEnergy",value:-4}]},
    {name:"Helmet Swap: +5 Class / -5 Super", effects:[{bucket:"classEnergy",value:4},{bucket:"superEnergy",value:-4}]},
    {name:"Helmet Swap: +5 Melee / -5 Super", effects:[{bucket:"meleeEnergy",value:4},{bucket:"superEnergy",value:-4}]},
    {name:"Helmet Swap: +5 Grenade / -5 Super", effects:[{bucket:"grenadeEnergy",value:4},{bucket:"superEnergy",value:-4}]},
  ],
  Arms: [
    {name:"Arms Balanced Tuning (+1 Weapons/Health/Super)", effects:[{bucket:"healing",value:2},{bucket:"superEnergy",value:2}]},
    {name:"Arms Swap: +5 Melee / -5 Weapons", effects:[{bucket:"meleeEnergy",value:4}]},
    {name:"Arms Swap: +5 Grenade / -5 Weapons", effects:[{bucket:"grenadeEnergy",value:4}]},
    {name:"Arms Swap: +5 Class / -5 Weapons", effects:[{bucket:"classEnergy",value:4}]},
    {name:"Arms Swap: +5 Health / -5 Weapons", effects:[{bucket:"healing",value:4}]},
    {name:"Arms Swap: +5 Super / -5 Weapons", effects:[{bucket:"superEnergy",value:4}]},
  ],
  Chest: [
    {name:"Chest Balanced Tuning (+1 Weapons/Melee/Grenade)", effects:[{bucket:"meleeEnergy",value:2},{bucket:"grenadeEnergy",value:2}]},
    {name:"Chest Swap: +5 Health / -5 Class", effects:[{bucket:"healing",value:4},{bucket:"classEnergy",value:-4}]},
    {name:"Chest Swap: +5 Weapons / -5 Class", effects:[{bucket:"classEnergy",value:-4}]},
    {name:"Chest Swap: +5 Super / -5 Class", effects:[{bucket:"superEnergy",value:4},{bucket:"classEnergy",value:-4}]},
    {name:"Chest Swap: +5 Melee / -5 Class", effects:[{bucket:"meleeEnergy",value:4},{bucket:"classEnergy",value:-4}]},
    {name:"Chest Swap: +5 Grenade / -5 Class", effects:[{bucket:"grenadeEnergy",value:4},{bucket:"classEnergy",value:-4}]},
  ],
  Legs: [
    {name:"Legs Balanced Tuning (+1 Health/Class/Super)", effects:[{bucket:"healing",value:2},{bucket:"classEnergy",value:2},{bucket:"superEnergy",value:2}]},
    {name:"Legs Swap: +5 Weapons / -5 Grenade", effects:[{bucket:"grenadeEnergy",value:-4}]},
    {name:"Legs Swap: +5 Health / -5 Grenade", effects:[{bucket:"healing",value:4},{bucket:"grenadeEnergy",value:-4}]},
    {name:"Legs Swap: +5 Class / -5 Grenade", effects:[{bucket:"classEnergy",value:4},{bucket:"grenadeEnergy",value:-4}]},
    {name:"Legs Swap: +5 Melee / -5 Grenade", effects:[{bucket:"meleeEnergy",value:4},{bucket:"grenadeEnergy",value:-4}]},
    {name:"Legs Swap: +5 Super / -5 Grenade", effects:[{bucket:"superEnergy",value:4},{bucket:"grenadeEnergy",value:-4}]},
  ],
  ClassItem: [
    {name:"Class Item Balanced Tuning (+1 Weapons/Health/Grenade)", effects:[{bucket:"healing",value:2},{bucket:"grenadeEnergy",value:2}]},
    {name:"Class Item Swap: +5 Super / -5 Melee", effects:[{bucket:"superEnergy",value:4},{bucket:"meleeEnergy",value:-4}]},
    {name:"Class Item Swap: +5 Weapons / -5 Melee", effects:[{bucket:"meleeEnergy",value:-4}]},
    {name:"Class Item Swap: +5 Health / -5 Melee", effects:[{bucket:"healing",value:4},{bucket:"meleeEnergy",value:-4}]},
    {name:"Class Item Swap: +5 Class / -5 Melee", effects:[{bucket:"classEnergy",value:4},{bucket:"meleeEnergy",value:-4}]},
    {name:"Class Item Swap: +5 Grenade / -5 Melee", effects:[{bucket:"grenadeEnergy",value:4},{bucket:"meleeEnergy",value:-4}]},
  ],
};


// ---- ARMOR 3.0 SET BONUSES ----
// Monument of Triumph gave every armor set in the game a 2-piece and 4-piece
// bonus (56 sets total across raids, dungeons, Vanguard/Crucible/Gambit Ops,
// and destinations). Wearing 2 pieces unlocks the first bonus; wearing 4
// unlocks both. This roster covers a real, representative slice by category
// — not all 56 — using confirmed named sets and bonuses.
const ARMOR_SETS = [
  {name:"Seventh Seraph", category:"Destination", twoPiece:{name:"Rasputin's Wrath", effects:[{bucket:"superEnergy",value:8,note:"AoE/Solar/Seventh Seraph-IKELOS final blows grant stacking Warmind Charges (weapon+grenade stats, up to 10)"}]},
    fourPiece:{name:"Rasputin's Reprisal", effects:[{bucket:"damage",value:10,cond:"orbOfPower",note:"while charged: powerful kills/tangle/construct destruction trigger a healing Solar detonation"},{bucket:"healing",value:8}]}},
  {name:"Network Admin (Raid)", category:"Raid", twoPiece:{name:"Network Admin", effects:[{bucket:"classEnergy",value:6,note:"near allies: improved handling/reload; near other Network Admins: bonus Health stat"}]},
    fourPiece:{name:"Network Upload", effects:[{bucket:"meleeEnergy",value:8,note:"weapon final blows grant wearer + nearby allies melee energy"}]}},
  {name:"Great Hunt (Last Wish)", category:"Raid", twoPiece:{name:"Hunter's Ward", effects:[{bucket:"dr",value:8,note:"grenade final blows temporarily reduce incoming damage"}]},
    fourPiece:{name:"Hunter's Cache", effects:[{bucket:"grenadeEnergy",value:8,note:"grenade final blows grant additional Heavy ammo progress"}]}},
  {name:"Techeun's Regalia (Shattered Throne)", category:"Dungeon", twoPiece:{name:"Techeun's Grasp", effects:[{bucket:"dr",value:10,note:"overshield during finishers"}]},
    fourPiece:{name:"Techeun's Chill", effects:[{bucket:"damage",value:8,note:"finisher releases a slowing burst"}]}},
  {name:"Cyberserpent Null (Gambit Ops)", category:"Gambit", twoPiece:{name:"Gun and Run", effects:[{bucket:"classEnergy",value:6,note:"sprinting grants reload speed/handling; final blows extend it"}]},
    fourPiece:{name:"Gun and Run (4pc)", effects:[{bucket:"damage",value:8,note:"while active: final blows grant Special ammo, more vs powerful/Guardians/Taken"}]}},
  {name:"Ferropotent (Vanguard Ops)", category:"Vanguard", twoPiece:{name:"Rapid Repair", effects:[{bucket:"healing",value:8,note:"class-ability-adjacent sustain"}]},
    fourPiece:{name:"Rapid Repair (4pc)", effects:[{bucket:"healing",value:6},{bucket:"dr",value:6}]}},
  {name:"SRL / Triumphal Anthem", category:"Competitive", twoPiece:{name:"Primary Chain", effects:[{bucket:"classEnergy",value:6,note:"primary weapon kills build stacking mobility/range/handling; resets on death"}]},
    fourPiece:{name:"Primary Honing", effects:[{bucket:"damage",value:6,note:"increases base mobility/sprint/slide distance (doesn't stack with movement exotics)"}]}},
  {name:"Veritas", category:"Destination", twoPiece:{name:"Truth to Power", effects:[{bucket:"superEnergy",value:6,note:"finishers/powered melee final blows generate an elemental pickup matching your subclass"}]},
    fourPiece:{name:"Truth to Power (4pc)", effects:[{bucket:"healing",value:8,note:"finishers on powerful combatants heal you and summon Void moths"}]}},
  {name:"Exodus Down", category:"Destination", twoPiece:{name:"Armor Charge Sustain", effects:[{bucket:"healing",value:6,note:"gaining/losing/spending Armor Charge heals briefly"}]},
    fourPiece:{name:"Armor Charge Sustain (4pc)", effects:[{bucket:"dr",value:8,note:"scales with amount of Armor Charge gained/lost/spent"}]}},
  {name:"Wayward Psyche", category:"Competitive", twoPiece:{name:"Superluminal Motion", effects:[{bucket:"healing",value:6,note:"health regen while moving (PvE only)"}]},
    fourPiece:{name:"Speed Booster", effects:[{bucket:"damage",value:6,note:"sliding while Speed Booster is active jolts nearby targets"}]}},
  {name:"Smoke Jumper", category:"Competitive", twoPiece:{name:"Ride Together, Die Together", effects:[{bucket:"dr",value:8,note:"damage resistance ceiling, lower than pre-nerf"}]},
    fourPiece:{name:"Ride Together, Die Together (4pc)", effects:[{bucket:"dr",value:6}]}},
  {name:"Iron Battalion (Iron Banner)", category:"Competitive", twoPiece:{name:"Iron Reserve", effects:[{bucket:"grenadeEnergy",value:6,note:"ammo pickups build a stacking bonus"}]},
    fourPiece:{name:"Iron Reserve (4pc)", effects:[{bucket:"healing",value:6}]}},
  {name:"Dreambane (Pit of Heresy)", category:"Dungeon", twoPiece:{name:"Nightmare Ward", effects:[{bucket:"dr",value:8,note:"debuffed-target proximity resistance"}]},
    fourPiece:{name:"Nightmare Ward (4pc)", effects:[{bucket:"damage",value:8,note:"vs debuffed/afflicted targets"}]}},
  {name:"Per Audacia", category:"Destination", twoPiece:{name:"Audacious Charge", effects:[{bucket:"meleeEnergy",value:6}]},
    fourPiece:{name:"Audacious Charge (4pc)", effects:[{bucket:"meleeDamage",value:8}]}},
  {name:"Cruel Electrum", category:"Destination", twoPiece:{name:"Electrum Feedback", effects:[{bucket:"classEnergy",value:6,note:"taking damage grants ability energy"}]},
    fourPiece:{name:"Electrum Feedback (4pc)", effects:[{bucket:"dr",value:6}]}},
  {name:"TM-EARP Custom", category:"Vanguard", twoPiece:{name:"Armor Charge Draw", effects:[{bucket:"healing",value:6,note:"picking up ammo grants Armor Charge (bonus Health per stack)"}]},
    fourPiece:{name:"Sustained Fire", effects:[{bucket:"damage",value:8,note:"sustained damage on minibosses/Champions/bosses ramps weapon damage"}]}},
];

