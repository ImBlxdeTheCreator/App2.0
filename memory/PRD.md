# D2Synergy — PRD

## Original problem statement
Frontend-only enhancement of D2Synergy, a Destiny 2 build-crafting web app: a single-file
vanilla HTML/CSS/JS app on GitHub Pages + an existing Cloudflare Worker for Bungie OAuth
(the Worker is NOT touched). Data source: Bungie API + Manifest.

## Architecture
- Frontend: single file `index.html` (vanilla JS). Canonical/deployable copy at
  `/app/D2Synergy/index.html`; the same file is served in the Emergent preview via
  `/app/frontend/public/index.html` (React is intentionally NOT mounted — `src/index.js` is a no-op).
- Backend: existing Cloudflare Worker at https://morning-sea-6b9d.ehurd37.workers.dev (untouched).
- Bungie app client ID 53783, API key embedded client-side.
- IMPORTANT: OAuth sign-in + all authenticated live data only work on the deployed GitHub
  Pages domain (Bungie's registered redirect URI). In the Emergent preview, signed-out UI works
  and public endpoints (Milestones, manifest) work; auth flows show a friendly "not signed in".

## Implemented (dates)
- 2026-06 Phase 1 (reliability core): config block; `rateLimitedFetch` (spacing + retry/backoff on
  429/5xx); persistent versioned manifest/icon cache (localStorage, `MANIFEST_CACHE_VERSION`);
  async-race fix via in-flight de-dupe in `getItemDefinition`.
- 2026-06 Phase 2 (Full-Screen Vault view): DIM/Ishtar-style overlay, all characters + vault side by
  side, weapons Kinetic/Energy/Power + armor by slot, power/masterwork/equipped indicators,
  search + element/type filters, character↔vault↔character transfers.
- 2026-06 Armor Mods rewrite: corrected Armor 3.0 slotting; removed obsolete Charged-with-Light/Font
  mods; added Holster/Kinetic+Harmonic Surge/finisher/Harmonic Reserves; per-mod energy costs.
- 2026-06 Armor 3.0 tier + masterwork: per-slot Tier selector (T1-3=10, T4/5=11 energy), Tier-5-only
  tuning slot (0 energy), masterwork changed from checkbox to Level 0-5 (+level to 3 chosen stats).
- 2026-06 QoL: per-panel "Clear" buttons (clear one section without full reset); sticky top header.
- 2026-06 Phase 3: Vendor Inventories window (GetVendors 400/402, auth) + Daily & Weekly Activities
  window (public Milestones + manifest defs), reset countdowns (daily/weekly 17:00 UTC), Trials
  weekend + Iron Banner event detection.

## Verified
- iteration_1: Full-Screen Vault UI. iteration_2: armor mod slotting. iteration_3: tier/masterwork +
  vault menu consolidation. iteration_4: QoL clears + Phase 3 windows (all 100%, 0 console errors;
  CORS confirmed OK from preview).

## Backlog / next
- P0: Verified artifact perks — resolve the CURRENT seasonal artifact from the live manifest
  (DestinyArtifactDefinition) so perk effects/descriptions are authoritative instead of the current
  hardcoded "(unverified — estimated from name)" list; wire verified data into the synergy engine.
- P1: Phase 4 — shareable Build Card image export (subclass/super/aspects/fragments/abilities/
  exotics/weapons+perks/mods + full stat & synergy readout → downloadable dark-themed PNG).
- P1: Vendor window happy-path verification on deployed site (needs sign-in + vendor scope).
- P2: Phase 5 (mobile Builder rework, transfer polish) & Phase 6 (tooltips, accessibility, code split).

## Notes / credentials
- No app test account: authentication is the user's own Bungie.net account on the deployed site.
