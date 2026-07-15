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
