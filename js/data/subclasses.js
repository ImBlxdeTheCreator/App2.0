/* Subclass, element, bucket, and Prismatic data
   Extracted from the original monolithic index.html without behavioral rewrites. */
/* =========================================================================
   DATA MODEL
   Everything below is representative, hand-curated data meant to be
   extended. Add more entries to any array following the same shape.
   Tag vocabulary (verbs/conditions a piece can GRANT to the build, or
   REQUIRE as a condition for one of its effects):
   radiant, restoration, cure, devour, invisible, overshield, amplified,
   weaken, sever, jolt, blind, scorch, ignite, unravel, suspend, volatile,
   frozen, shatter, woven-mail, tangle, orbOfPower, matching-element
   ========================================================================= */

const ELEMENTS = ["Solar","Arc","Void","Stasis","Strand","Prismatic"];
const ELEMENT_COLOR = {Solar:"var(--solar)",Arc:"var(--arc)",Void:"var(--void)",Stasis:"var(--stasis)",Strand:"var(--strand)",Prismatic:"var(--gold)",Kinetic:"var(--kinetic)"};

const BUCKETS = [
  {id:"damage", name:"Damage Output"},
  {id:"dr", name:"Damage Resistance"},
  {id:"healing", name:"Healing / Survivability"},
  {id:"superEnergy", name:"Super Energy Gain"},
  {id:"meleeEnergy", name:"Melee Energy Gain"},
  {id:"grenadeEnergy", name:"Grenade Energy Gain"},
  {id:"classEnergy", name:"Class Ability Energy Gain"},
  {id:"meleeDamage", name:"Melee Damage"},
  {id:"grenadeDamage", name:"Grenade Damage"},
];

// ---- SUBCLASSES: per class, per element ----
// aspects: 2 each. fragments: pulled from shared FRAGMENTS pool by element.
const SUBCLASSES = {
  Titan: {
    Solar: {supers:[
        {name:"Hammer of Sol", grants:["scorch","ignite"], effects:[{bucket:"damage",value:10,cond:"scorch",note:"vs scorched targets"}]},
        {name:"Burning Maul", grants:["scorch","ignite"], effects:[{bucket:"damage",value:14,note:"spinning maul AoE"}]},
      ],
      aspects:[
        {name:"Sol Invictus", grants:["restoration"], effects:[{bucket:"healing",value:12,note:"sunspot healing"}], fragSlots:2},
        {name:"Roaring Flames", grants:["scorch"], effects:[{bucket:"grenadeDamage",value:12,cond:"scorch"},{bucket:"meleeDamage",value:8,cond:"scorch"}], fragSlots:2},
        {name:"Consecration", grants:["ignite"], effects:[{bucket:"meleeDamage",value:15,note:"slam ignition"}], fragSlots:3},
        {name:"Shieldburst", grants:["scorch"], effects:[{bucket:"damage",value:10,note:"charged Barricade remote detonation"},{bucket:"grenadeEnergy",value:6}], fragSlots:3}
      ]},
    Arc: {supers:[
        {name:"Fists of Havoc", grants:["amplified"], effects:[{bucket:"meleeDamage",value:18,note:"slam AoE"}]},
        {name:"Thundercrash", grants:["jolt"], effects:[{bucket:"damage",value:25,note:"single burst super"}]},
      ],
      aspects:[
        {name:"Knockout", grants:["amplified"], effects:[{bucket:"meleeDamage",value:20,cond:"amplified"},{bucket:"healing",value:8,cond:"amplified"}], fragSlots:2},
        {name:"Touch of Thunder", grants:["jolt"], effects:[{bucket:"grenadeDamage",value:10,cond:"jolt"},{bucket:"grenadeEnergy",value:8}], fragSlots:2},
        {name:"Juggernaut", grants:["overshield"], effects:[{bucket:"dr",value:15,cond:"overshield"}], fragSlots:2},
        {name:"Storm's Keep", grants:[], effects:[{bucket:"meleeDamage",value:8,note:"class ability grants Bolt Charge stacks to you and allies"},{bucket:"dr",value:6,note:"behind Barricade, stacks build over time"}], fragSlots:2}
      ]},
    Void: {supers:[
        {name:"Ward of Dawn", grants:["overshield"], effects:[{bucket:"dr",value:30,note:"inside bubble"}]},
        {name:"Sentinel Shield", grants:["overshield"], effects:[{bucket:"meleeDamage",value:15,note:"shield throw/melee"}]},
        {name:"Twilight Arsenal", grants:["weaken"], effects:[{bucket:"damage",value:20,cond:"weaken",note:"thrown Void axes, retrievable for a second attack"}]},
      ],
      aspects:[
        {name:"Bastion", grants:["overshield"], effects:[{bucket:"dr",value:10,cond:"overshield"}], fragSlots:3},
        {name:"Controlled Demolition", grants:["volatile"], effects:[{bucket:"damage",value:10,cond:"volatile",note:"Void debuffed targets take DoT"}], fragSlots:2},
        {name:"Offensive Bulwark", grants:["overshield"], effects:[{bucket:"meleeEnergy",value:10,cond:"overshield"},{bucket:"grenadeEnergy",value:10,cond:"overshield"}], fragSlots:2},
        {name:"Unbreakable", grants:["overshield"], effects:[{bucket:"dr",value:20,note:"while blocking"}], fragSlots:2}
      ]},
    Stasis: {supers:[
        {name:"Glacial Quake", grants:["shatter","frozen"], effects:[{bucket:"damage",value:20,cond:"shatter"}]},
      ],
      aspects:[
        {name:"Cryoclasm", grants:["frozen"], effects:[{bucket:"classEnergy",value:8,cond:"frozen"},{bucket:"dr",value:6,note:"near stasis crystals"}], fragSlots:3},
        {name:"Tectonic Harvest", grants:["frozen"], effects:[{bucket:"grenadeEnergy",value:15,cond:"shatter"}], fragSlots:2},
        {name:"Howl of the Storm", grants:["shatter"], effects:[{bucket:"superEnergy",value:8,cond:"shatter"}], fragSlots:2},
        {name:"Diamond Lance", grants:["frozen"], effects:[{bucket:"damage",value:12,cond:"frozen"}], fragSlots:3}
      ]},
    Strand: {supers:[
        {name:"Bladefury", grants:["sever"], effects:[{bucket:"damage",value:15,cond:"sever"}]},
      ],
      aspects:[
        {name:"Drengr's Lash", grants:["suspend"], effects:[{bucket:"meleeEnergy",value:15,cond:"suspend"}], fragSlots:3},
        {name:"Into the Fray", grants:["woven-mail"], effects:[{bucket:"dr",value:15,cond:"woven-mail"}], fragSlots:2},
        {name:"Flechette Storm", grants:[], effects:[{bucket:"meleeDamage",value:12,note:"Frenzied Blade throws multiple blades"}], fragSlots:2},
        {name:"Banner of War", grants:["woven-mail"], effects:[{bucket:"healing",value:10,note:"melee kills heal + empower melee"},{bucket:"meleeDamage",value:10}], fragSlots:3}
      ]},
  },
  Hunter: {
    Solar: {supers:[
        {name:"Golden Gun: Deadshot", grants:["scorch"], effects:[{bucket:"damage",value:20,note:"rapid-fire flaming pistol"}]},
        {name:"Golden Gun: Marksman", grants:["scorch"], effects:[{bucket:"damage",value:24,note:"precision overpenetration"}]},
        {name:"Blade Barrage", grants:["scorch"], effects:[{bucket:"damage",value:22,note:"knife barrage"}]},
      ],
      aspects:[
        {name:"Knock 'Em Down", grants:["scorch"], effects:[{bucket:"meleeEnergy",value:15,cond:"scorch"}], fragSlots:2},
        {name:"On Your Mark", grants:["amplified"], effects:[{bucket:"classEnergy",value:12}, {bucket:"damage",value:8,note:"team reload/handling proxy"}], fragSlots:3},
        {name:"Gunpowder Gamble", grants:["scorch"], effects:[{bucket:"grenadeDamage",value:14,cond:"scorch"}], fragSlots:2},
        {name:"Crackshot", grants:["scorch"], effects:[{bucket:"damage",value:10,note:"3-target dodge marks, cure on full clear"},{bucket:"healing",value:6}], fragSlots:2}
      ]},
    Arc: {supers:[
        {name:"Arc Staff", grants:["jolt"], effects:[{bucket:"meleeDamage",value:16,note:"melee staff combo"}]},
        {name:"Gathering Storm", grants:["jolt"], effects:[{bucket:"damage",value:20,cond:"jolt"}]},
        {name:"Storm's Edge", grants:["jolt"], effects:[{bucket:"damage",value:20,cond:"jolt",note:"thrown dagger + teleport strike, chainable"}]},
      ],
      aspects:[
        {name:"Flow State", grants:["amplified"], effects:[{bucket:"classEnergy",value:10,cond:"amplified"},{bucket:"meleeEnergy",value:8,cond:"amplified"}], fragSlots:2},
        {name:"Lethal Current", grants:["jolt"], effects:[{bucket:"meleeDamage",value:15,cond:"jolt"}], fragSlots:2},
        {name:"Tempest Strike", grants:["jolt"], effects:[{bucket:"meleeDamage",value:12,note:"melee follow-through arc explosion"}], fragSlots:2},
        {name:"Ascension", grants:["amplified"], effects:[{bucket:"dr",value:10,note:"airborne evasion"}], fragSlots:3}
      ]},
    Void: {supers:[
        {name:"Shadowshot: Deadfall", grants:["weaken"], effects:[{bucket:"damage",value:15,cond:"weaken"}]},
        {name:"Spectral Blades", grants:["invisible"], effects:[{bucket:"meleeDamage",value:14,cond:"invisible"}]},
      ],
      aspects:[
        {name:"Trapper's Ambush", grants:["weaken"], effects:[{bucket:"grenadeEnergy",value:10},{bucket:"damage",value:8,cond:"weaken"}], fragSlots:3},
        {name:"Vanishing Step", grants:["invisible"], effects:[{bucket:"dr",value:8,cond:"invisible"}], fragSlots:2},
        {name:"Stylish Executioner", grants:["invisible"], effects:[{bucket:"grenadeEnergy",value:15,cond:"invisible"}], fragSlots:2},
        {name:"On the Prowl", grants:["invisible","weaken"], effects:[{bucket:"classEnergy",value:8,note:"priority target defeats grant reload/stability + ability energy"},{bucket:"meleeEnergy",value:6}], fragSlots:3}
      ]},
    Stasis: {supers:[
        {name:"Silence and Squall", grants:["shatter","frozen"], effects:[{bucket:"damage",value:18,cond:"frozen"}]},
      ],
      aspects:[
        {name:"Grim Harvest", grants:["frozen"], effects:[{bucket:"grenadeEnergy",value:12,cond:"shatter"}], fragSlots:3},
        {name:"Shatterdrive", grants:["frozen"], effects:[{bucket:"dr",value:8,cond:"frozen"},{bucket:"classEnergy",value:6}], fragSlots:2},
        {name:"Winter's Shroud", grants:["frozen"], effects:[{bucket:"dr",value:10,cond:"frozen"}], fragSlots:2},
        {name:"Touch of Winter", grants:["frozen"], effects:[{bucket:"grenadeEnergy",value:8,cond:"frozen"}], fragSlots:2}
      ]},
    Strand: {supers:[
        {name:"Silkstrike", grants:["sever"], effects:[{bucket:"damage",value:18,cond:"sever"}]},
      ],
      aspects:[
        {name:"Ensnaring Slam", grants:["suspend"], effects:[{bucket:"meleeDamage",value:15,cond:"suspend"}], fragSlots:2},
        {name:"Widow's Silk", grants:["tangle"], effects:[{bucket:"grenadeEnergy",value:12,cond:"tangle"}], fragSlots:2},
        {name:"Threaded Specter", grants:["suspend"], effects:[{bucket:"dr",value:8},{bucket:"meleeEnergy",value:6,cond:"suspend"}], fragSlots:2},
        {name:"Whirling Maelstrom", grants:["sever"], effects:[{bucket:"meleeDamage",value:10,cond:"sever",note:"dodge-triggered parry counter"}], fragSlots:2}
      ]},
  },
  Warlock: {
    Solar: {supers:[
        {name:"Daybreak", grants:["radiant","scorch"], effects:[{bucket:"damage",value:20,note:"solar sword sweeps"}]},
        {name:"Well of Radiance", grants:["radiant","restoration"], effects:[{bucket:"healing",value:25,cond:"restoration"},{bucket:"damage",value:15,cond:"radiant"}]},
        {name:"Song of Flame", grants:["radiant","amplified"], effects:[{bucket:"damage",value:15,note:"team-wide Solar/Arc buff burst, overcharges melee"}]},
      ],
      aspects:[
        {name:"Heat Rises", grants:["radiant"], effects:[{bucket:"meleeEnergy",value:8,cond:"radiant"},{bucket:"classEnergy",value:6}], fragSlots:2},
        {name:"Icarus Dash", grants:["radiant"], effects:[{bucket:"classEnergy",value:10}], fragSlots:3},
        {name:"Touch of Flame", grants:["scorch","ignite"], effects:[{bucket:"grenadeDamage",value:15,cond:"scorch"}], fragSlots:2},
        {name:"Hellion", grants:["scorch"], effects:[{bucket:"grenadeEnergy",value:8},{bucket:"damage",value:8,cond:"scorch",note:"turret grenade companion"}], fragSlots:2}
      ]},
    Arc: {supers:[
        {name:"Stormtrance", grants:["jolt","amplified"], effects:[{bucket:"damage",value:18,note:"sustained arc bolts"}]},
        {name:"Chaos Reach", grants:["jolt"], effects:[{bucket:"damage",value:22,note:"sustained beam"}]},
      ],
      aspects:[
        {name:"Arc Soul", grants:[], effects:[{bucket:"damage",value:8,note:"floating companion turret fires with you"}], fragSlots:2},
        {name:"Lightning Surge", grants:["amplified"], effects:[{bucket:"meleeDamage",value:14,cond:"amplified",note:"slide-melee dash"}], fragSlots:3},
        {name:"Electrostatic Mind", grants:["jolt"], effects:[{bucket:"meleeEnergy",value:12,cond:"jolt"}], fragSlots:2},
        {name:"Ionic Sentry", grants:["jolt","blind"], effects:[{bucket:"grenadeDamage",value:10,cond:"jolt",note:"Arc turret chains lightning, blinds on impact, grants Bolt Charge on kills"},{bucket:"meleeEnergy",value:6}], fragSlots:2}
      ]},
    Void: {supers:[
        {name:"Nova Bomb: Cataclysm", grants:["weaken"], effects:[{bucket:"damage",value:24,note:"tracking void bomb"}]},
        {name:"Nova Warp", grants:["devour"], effects:[{bucket:"damage",value:20,note:"teleport detonation"}]},
      ],
      aspects:[
        {name:"Chaos Accelerant", grants:["weaken"], effects:[{bucket:"grenadeDamage",value:15,cond:"weaken"}], fragSlots:2},
        {name:"Feed the Void", grants:["devour"], effects:[{bucket:"healing",value:15,cond:"devour"}], fragSlots:2},
        {name:"Child of the Old Gods", grants:["weaken"], effects:[{bucket:"meleeDamage",value:8,cond:"weaken"},{bucket:"healing",value:6}], fragSlots:3},
        {name:"Soul Siphon", grants:["overshield"], effects:[{bucket:"dr",value:10,cond:"overshield"},{bucket:"classEnergy",value:8}], fragSlots:2}
      ]},
    Stasis: {supers:[
        {name:"Winter's Wrath", grants:["shatter","frozen"], effects:[{bucket:"damage",value:20,cond:"frozen"}]},
      ],
      aspects:[
        {name:"Bleak Watcher", grants:["frozen"], effects:[{bucket:"grenadeEnergy",value:10,cond:"frozen"}], fragSlots:2},
        {name:"Frostpulse", grants:["frozen"], effects:[{bucket:"dr",value:8,cond:"frozen"},{bucket:"classEnergy",value:6}], fragSlots:3},
        {name:"Iceflare Bolts", grants:["frozen"], effects:[{bucket:"grenadeEnergy",value:12,cond:"shatter"}], fragSlots:2},
        {name:"Glacial Harvest", grants:["frozen"], effects:[{bucket:"healing",value:8,cond:"shatter"}], fragSlots:3}
      ]},
    Strand: {supers:[
        {name:"Needlestorm", grants:["sever","suspend"], effects:[{bucket:"damage",value:18,cond:"sever"}]},
      ],
      aspects:[
        {name:"Weaver's Call", grants:["woven-mail"], effects:[{bucket:"dr",value:12,cond:"woven-mail"}], fragSlots:2},
        {name:"Mindspun Invocation", grants:["tangle"], effects:[{bucket:"grenadeEnergy",value:12,cond:"tangle"}], fragSlots:2},
        {name:"The Wanderer", grants:[], effects:[{bucket:"classEnergy",value:8,note:"grapple decoy"},{bucket:"dr",value:6}], fragSlots:2},
        {name:"Weavewalk", grants:["woven-mail"], effects:[{bucket:"healing",value:8,note:"rift-like Strand phase"},{bucket:"dr",value:6}], fragSlots:2}
      ]},
  }
};

// Prismatic aspect/super rosters are curated per-class (a specific subset
// pulled from each source element), matching how Prismatic actually works
// in-game — not an automatic union of everything.
const PRISMATIC_ASPECTS = {
  Titan: [
    {name:"Knockout", element:"Arc", fragSlots:2},
    {name:"Consecration", element:"Solar", fragSlots:2},
    {name:"Unbreakable", element:"Void", fragSlots:2},
    {name:"Diamond Lance", element:"Stasis", fragSlots:2},
    {name:"Drengr's Lash", element:"Strand", fragSlots:2},
  ],
  Hunter: [
    {name:"Ascension", element:"Arc", fragSlots:2},
    {name:"Gunpowder Gamble", element:"Solar", fragSlots:2},
    {name:"Stylish Executioner", element:"Void", fragSlots:2},
    {name:"Winter's Shroud", element:"Stasis", fragSlots:2},
    {name:"Threaded Specter", element:"Strand", fragSlots:2},
  ],
  Warlock: [
    {name:"Lightning Surge", element:"Arc", fragSlots:2},
    {name:"Hellion", element:"Solar", fragSlots:2},
    {name:"Feed the Void", element:"Void", fragSlots:2},
    {name:"Bleak Watcher", element:"Stasis", fragSlots:2},
    {name:"Weaver's Call", element:"Strand", fragSlots:2},
  ],
};

// Prismatic gets exactly ONE super per source element (5 total per class),
// not every super variant that element normally offers.
// Twilight Arsenal, Storm's Edge, and Song of Flame launched WITH The Final
// Shape as new additions to their base subclass (Void Titan / Arc Hunter /
// Solar Warlock) — they are not Prismatic-exclusive, Prismatic just also has
// access to them since it draws from every element's full kit.
const PRISMATIC_SUPERS = {
  Titan: [
    {name:"Thundercrash", element:"Arc"},
    {name:"Hammer of Sol", element:"Solar"},
    {name:"Twilight Arsenal", element:"Void"},
    {name:"Glacial Quake", element:"Stasis"},
    {name:"Bladefury", element:"Strand"},
  ],
  Hunter: [
    {name:"Storm's Edge", element:"Arc"},
    {name:"Golden Gun: Marksman", element:"Solar"},
    {name:"Shadowshot: Deadfall", element:"Void"},
    {name:"Silence and Squall", element:"Stasis"},
    {name:"Silkstrike", element:"Strand"},
  ],
  Warlock: [
    {name:"Stormtrance", element:"Arc"},
    {name:"Song of Flame", element:"Solar"},
    {name:"Nova Bomb: Cataclysm", element:"Void"},
    {name:"Winter's Wrath", element:"Stasis"},
    {name:"Needlestorm", element:"Strand"},
  ],
};

function buildPrismatic(cls){
  const src = SUBCLASSES[cls];
  const supers = PRISMATIC_SUPERS[cls].map(entry=>{
    const s = src[entry.element].supers.find(x=>x.name===entry.name);
    return {name:`${s.name} (${entry.element})`, grants:s.grants, effects:s.effects};
  });
  const aspects = PRISMATIC_ASPECTS[cls].map(entry=>{
    const a = src[entry.element].aspects.find(x=>x.name===entry.name);
    return {name:`${a.name} (${entry.element})`, grants:a.grants, effects:a.effects, fragSlots:entry.fragSlots};
  });
  return {supers, aspects};
}
["Titan","Hunter","Warlock"].forEach(cls=>{
  SUBCLASSES[cls].Prismatic = buildPrismatic(cls);
});
// shared fragment pool per element (name, grants, effects) — pick up to your
// current fragment-slot cap per build. Prismatic uses its own distinct pool
// ("Facets"), not a mix of the other elements' fragments.
