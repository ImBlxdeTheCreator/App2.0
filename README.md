# D2Synergy — Organized Source

This build is a structural refactor of the original single-file application. Code was moved into ordered files without converting it to ES modules and without rewriting application behavior. Classic script tags are intentionally used so the original top-level globals and initialization order remain available across files.

## Run it

Do not open `index.html` with a `file://` URL for Bungie authentication. Serve the folder with a local or deployed web server. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Bungie OAuth may still require the exact registered production origin.

## JavaScript load order

1. Data files
2. State and synergy engine
3. Builder and readout UI
4. Bungie API and account drawer
5. Vault, activities/vendors, live sync, item detail
6. Finalize-loadout and startup

Do not arbitrarily reorder the script tags in `index.html`; some later files intentionally depend on declarations from earlier files.

## Intentional correction

One unmatched closing brace after the mobile vault media query was removed from the original CSS. No functional JavaScript was deleted or rewritten.

## Original safety copy

Keep your original monolithic file as a rollback copy.
