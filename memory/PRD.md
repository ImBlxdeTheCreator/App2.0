# D2Synergy — PRD

## Original problem statement
Frontend-only enhancement of D2Synergy, a Destiny 2 build-crafting web app: a single-file
vanilla HTML/CSS/JS app on GitHub Pages + an existing Cloudflare Worker for Bungie OAuth
(the Worker is NOT touched). Data source: Bungie API + Manifest.

## Architecture
- Frontend: single file `index.html` (vanilla JS). 3 synced copies: `/app/index.html`,
  `/app/D2Synergy/index.html`, and `/app/frontend/public/index.html` (served in the Emergent
  preview; React intentionally NOT mounted — `src/index.js` is a no-op).
- Backend: existing Cloudflare Worker at https://morning-sea-6b9d.ehurd37.workers.dev (untouched).
- Bungie app client ID 53783, API key embedded client-side. OAuth scope MoveEquipDestinyItems.
- IMPORTANT: OAuth sign-in + ALL authenticated live data only work on the deployed GitHub Pages
  domain (Bungie's registered redirect/origin). In the Emergent preview, signed-out UI + public
  endpoints (Milestones, manifest) work; auth flows show a friendly "not signed in".

## Implemented (2026-06 baseline): reliability core, full-screen vault, armor 3.0 mods/tier/
masterwork, QoL clears, vendors + activities windows. (see git history)

## Implemented — 7-phase update (2026-06, this session)
- Phase 1 Layout+currencies: added sticky CHARACTER bar at the very top (class dropdown +
  element pills, testid `character-bar`/`charbar-class-select`); moved "Sign in with Bungie" to
  the BOTTOM of the hamburger drawer (`renderSignInSection`); full-screen vault now shows
  ProfileCurrencies (component 103) as a currency strip (Glimmer/Bright Dust/Shards/etc).
- Phase 2 Exotic slot merge: an exotic weapon occupies its Kinetic/Energy/Power slot and
  inherits that slot's Mod + Masterwork (new state `exoticWeaponMod`/`exoticWeaponMW`, wired
  into `collectComponents` synergy). Exotic armor's slot is flagged in the Armor Mods panel
  (mods for that slot apply to the exotic). Synergy + stat calc updated.
- Phase 3 DIM-style item detail: `openItemDetail()` modal (stat bars via component 302, sockets/
  perks/shaders/ornaments via 305 + manifest plug defs, power/element/masterwork). Opened via
  "View details" in the full-screen vault item menu.
- Phase 4 Character inventory pop-out: "View My Inventory" now opens the wide multi-column
  full-screen vault (characters + vault side by side) instead of the cramped drawer list.
- Phase 5 Performance: rAF-batched `render()` (coalesces multiple state changes into one DOM
  rebuild), `renderReadoutOnly()` partial path; manifest/def caching + in-flight dedupe already
  existed.
- Phase 6 Live-equipped sync: `loadLiveCharacters()` + top-bar character cards; selecting a
  character runs `applyLiveLoadout()` to auto-populate the builder from equipped subclass/super/
  aspects/fragments/grenade/melee/exotics/armor-mods (best-effort name matching). Edits staged
  locally only.
- Phase 7 Finalize Loadout: `openFinalizeModal()` builds a plan (equip exotic weapon/armor,
  insert subclass plugs, insert armor mods) with a confirmation summary FIRST; `runFinalize()`
  runs an ordered pipeline (transfer -> EquipItems -> InsertSocketPlugFree) with a progress bar,
  per-step report, ~2 socket actions/sec spacing, orbit-only error hints, "Please re-acquire
  item" for unowned gear, and visible manual-step notices (weapon mods, masterwork, tuning,
  artifact — not settable via API). Socket indices resolved via components 305 + 310.

## Verified
- Preview (signed-out, testing agent iteration_7): char bar renders above readout, class switch
  works, element pills work, sign-in row is LAST in the drawer, 0 console errors. Phase 2 code
  confirmed present via source review. JS syntax check passes (node --check).
- NOT verifiable in preview (auth only works on deployed domain): Phases 3/4/6/7 live flows and
  Finalize write pipeline. Account owner is the first live test (per user).

## Backlog / next
- P0: User to verify Phases 6 & 7 on the deployed GitHub Pages site (live sync accuracy +
  Finalize writes) in orbit; report any Bungie error codes for tuning.
- P1: Add per-dropdown data-testids (exotic-armor-<piece>, legendary-weapon-<slot>, set-bonus-
  <piece>) to reduce automation selector collisions.
- P1: Verified seasonal artifact perks from live manifest (DestinyArtifactDefinition).
- P2: Split the single 5k-line file into modules; shareable Build Card PNG export.

## Notes / credentials
- No app test account: authentication is the user's own Bungie.net account on the DEPLOYED site.
