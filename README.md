# D2Synergy Performance Foundation v9

This release is the first real performance architecture pass built on the v8 PWA/workspace foundation. It preserves the existing redesign, builder, Bungie sync, Vault, activities, vendors, item details, saved loadouts, and PWA behavior.

## What changed

- The startup choice and Ghost loader now paint before the large application code is evaluated.
- Builder/data/Bungie scripts are prefetched at idle priority and loaded in their original dependency order only after **Load Offline** or **Sign in with Bungie** is selected.
- The Ghost loader now reports real bootstrap phases and progress.
- The service worker cache was rebuilt as v9 with current asset URLs, network-first HTML, and stale-while-revalidate static assets.
- The service worker checks for updates on launch without requiring manual URL query parameters.
- Vault item-definition resolution deduplicates manifest hashes before attaching definitions to item instances.
- Vault search is debounced to avoid rebuilding every store for every keystroke.
- Vault drag visuals are updated once per animation frame using compositor transforms, reducing pointer lag.
- Inventory images now prefer lazy loading and asynchronous decoding.
- Off-screen builder/readout/inventory sections use `content-visibility` where supported to reduce layout and paint work.
- Live Guardian sync and Vault loading now use the shared Ghost loading system with real progress stages.

## Deployment

Upload the **contents** of this folder directly to the repository root. Do not upload the containing folder itself.

The normal GitHub Pages URL should be used after deployment. A one-time refresh may be needed while an older service worker is replaced, but users should not need to add version text to the URL on ordinary launches.

## Preserved behavior

No curated build data or existing live-account logic was intentionally removed. Fireteam, Collections, and Fashion remain staged workspaces; they are not represented as completed features in this release.


## Startup click hotfix
Fixed an invisible global loading overlay that was still receiving pointer input while marked `hidden`. The loader now uses `display:none` while hidden and only accepts pointer input when open. The startup backdrop can no longer capture clicks, and cache identifiers were bumped so deployed sites fetch the corrected CSS.


## v11 ritual vendor pass

- Vendor roster is locked to Commander Zavala, Lord Shaxx, The Drifter, Saint-14, Ada-1, and Xûr in that order.
- Vendor logos prefer the official faction emblem from DestinyFactionDefinition.
- Live VendorCategories (component 401) now drive the same interactive inventory blocks and rendering order returned by Bungie.
- Category contents hydrate only when opened, reducing initial vendor loading work.
- Vendor information buttons now sit beside each vendor name.
- Vendor item cards open the existing item-detail view.
- App scripts begin preloading immediately while the startup gate is visible to reduce launch wait after a mode is selected.


## v12 operations, workspaces, kiosks, subclass, and tiered-roll pass

- Real workspace panels now switch visibly; heavy Inventory, Operations, Vendors, and Loadouts remain dedicated overlays.
- Boot scripts download in parallel by dependency phase to reduce first-launch wait time.
- Ritual vendors render in the requested Zavala → Shaxx → Drifter → Saint-14 → Ada-1 → Xûr order with faction emblems, name-adjacent information buttons, and interactive category blocks.
- Authenticated profile Kiosks are resolved into Monument of Triumph sections and grouped using their vendor category definitions.
- Operations merge public milestones with signed-in CharacterActivities when available, grouping Vanguard, Crucible, Gambit, raid, and dungeon rotations with modifiers and reward previews.
- Exact equipped subclass fragments remain highlighted, including live fragments that are not yet present in the curated synergy table.
- Item detail combines per-instance reusable plugs, inline socket plugs, and reusable/randomized Plug Sets so tier 1–5 weapon columns can show their full available choices.

Live Bungie authentication, profile kiosk contents, activity rotations, and transfers must still be smoke-tested on the deployed origin with a real account.
