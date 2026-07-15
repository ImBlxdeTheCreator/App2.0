# D2Synergy — Claude redesign merged

This project merges the CSS/HTML redesign from `D2Synergy destiny aesthetic COMBINED.html` with the latest split JavaScript build. The application logic was preserved from the current working project; the monolithic JavaScript embedded in the redesign file was not used because it may predate the inventory, Postmaster, currency, transfer, stat, and legendary-weapon fixes.

Upload the contents of this folder directly to the GitHub repository root.

## Structure
- `index.html` — page shell and ordered external file references
- `css/` — redesign split into five logical stylesheets
- `js/` — latest application logic preserved in its existing folders

## Validation
All active JavaScript files pass Node syntax checks, all local references resolve, and stylesheet braces are balanced.
