# Repository and release checklist

Use this list before tagging a release. CI covers the items marked **(CI)**.

## Code quality

- [ ] `npm ci` succeeds from a clean clone (pinned versions: `@cesium/engine` 26.5.0, `@cesium/core` 0.1.1,
      esbuild, ESLint 9, Prettier 3, Playwright)
- [ ] `npm run lint` passes: ESLint and Prettier **(CI)**
- [ ] `npm test` passes: Node unit tests, including the keyless-source and terrarium maths tests **(CI)**
- [ ] `npm run test:data` passes: CSV schema validation, 0 errors **(CI)**
- [ ] `npm run build` has been run and the regenerated `js/app.js` and `js/app.js.map` are committed
- [ ] `npm run test:smoke` passes. It serves the repo over HTTP, boots, checks markers are glued to the surface,
      switches basemap and terrain, opens every panel and runs the tour, with zero console or page errors and zero
      Cesium ion requests **(CI)**
- [ ] CodeQL reports no new alerts **(CI)**

## Security and privacy

- [ ] No API keys, tokens or ion assets anywhere: `rg -i "key=|token=|ion\.cesium|cesium\.com/" src index.html`
      finds nothing
- [ ] The CSP in `index.html` lists only the hosts in use. The only relaxation is `'wasm-unsafe-eval'`; there is no
      `'unsafe-eval'` and no inline script
- [ ] `data/private/` holds only its README in git (NUFORC and other unlicensed rows never ship)
- [ ] The briefings sanitiser and the link scheme check are still in place (`safeHTML`, `link()` allows only
      http(s) and mailto)

## Data

- [ ] Every new plotted row has a `source_url`, a grade, `coord_source` and `coord_precision`
- [ ] Pins are used only for `exact_site` and `within_1km`; every other row gets an uncertainty circle at its real
      radius
- [ ] Geocodes come only from GNIS, GeoNames, Wikidata or OSM, and the one used is recorded. Coordinates are never
      invented or jittered
- [ ] Rows that cannot be placed are logged (for example `docs/audit/pdf7-unplaced.csv`)
- [ ] `docs/layer-catalog.md` is regenerated (`python3 scripts/layer_catalog.py`)

## Docs and release

- [ ] `CHANGELOG.md` has a dated section; `package.json`, `CITATION.cff` and the README citation use the same version
- [ ] `RELEASE_NOTES_vX.Y.Z.md` exists (the release workflow reads it)
- [ ] ADRs exist for architectural changes (`docs/adr/`)
- [ ] README badges and screenshots are real captures of this build (`node test/screens.mjs`), taken at several zoom
      levels including street level
- [ ] `CREDITS.md` and `docs/data-sources.md` list every imagery, terrain and live-feed source with its attribution
- [ ] Annotated tag `vX.Y.Z` on `main`; bundle or zip produced with `npm run package -- --zip`
- [ ] The GitHub Pages deploy loads with no console errors, and the imagery attribution is visible at the bottom left
