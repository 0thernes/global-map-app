# Repository and release checklist

Use this list before every push to `main` and before tagging a release. CI covers the items marked **(CI)**.

Workflow: commits go straight to `main`. There are no pull requests and no bots: no Dependabot, CodeRabbit or
Copilot, and no `.github/dependabot.yml` or pull-request template. This list replaces the PR template.

## Code quality

- [ ] `npm ci` succeeds from a clean clone (pinned versions: `@cesium/engine` 26.5.0, `@cesium/core` 0.1.1,
      esbuild, ESLint 9, Prettier 3, Playwright)
- [ ] `npm run lint` passes: ESLint and Prettier **(CI)**
- [ ] `npm test` passes: Node unit tests, including the keyless-source and terrarium maths tests **(CI)**
- [ ] `npm run test:data` passes: CSV schema validation, 0 errors **(CI)**
- [ ] `npm run build` has been run and the regenerated `js/app.js` and `js/app.js.map` are committed
- [ ] `npm run test:smoke` passes. It serves the repo over HTTP, boots, checks markers are glued to the surface,
      switches basemap and terrain, opens every panel, cycles every window through minimize, restore, maximize, drag,
      dock and close, and runs the tour, with zero console or page errors and zero
      Cesium ion requests **(CI)**
- [ ] `npm run test:a11y` passes: axe-core 4.11 (WCAG 2.0 / 2.1 / 2.2 A + AA, including colour contrast) on every UI
      view at 1920x1080 reports 0 violations
- [ ] CodeQL reports no new alerts **(CI)**

## Design system (v1.3, [ADR 0003](adr/0003-design-system.md), [style guide](design/style-guide.md))

- [ ] New CSS uses tokens from `css/tokens.css` (spacing `--s-*`, type `--fs-*`, z-index `--z-*`, colours); no raw
      px font sizes below 12 px and no literal z-index values
- [ ] Every panel is a window from `src/ui/window.js` (standard header with minimize / maximize / close, one
      `.win-body` scroll region) and is listed in `initWindows()`; no inner `max-height` scroll boxes
- [ ] Every tab bar is built with `makeTabs()` from `src/ui/tabs.js` (ARIA roles, arrow keys, overflow arrows)
- [ ] Icons come from Lucide via `scripts/gen_icons.mjs` (`npm run icons`); no Unicode glyphs as icons
- [ ] Only Inter and JetBrains Mono are vendored and used (`vendor/fonts`, SIL OFL licences alongside)
- [ ] The UI audit has been re-run for UI changes (`npm run audit:ui -- --phase after`, then
      `python3 scripts/audit/ui_audit_report.py --after`) and `docs/audit/v1.3-ui-audit.md` has no new bugs or errors

## Security and privacy

- [ ] No API keys, tokens or ion assets anywhere: `rg -i "key=|token=|ion\.cesium|cesium\.com/" src index.html`
      finds nothing
- [ ] The CSP in `index.html` lists only the hosts in use. The only relaxation is `'wasm-unsafe-eval'`; there is no
      `'unsafe-eval'` and no inline script
- [ ] `data/private/` holds only its README in git (NUFORC and other unlicensed rows never ship)
- [ ] The briefings sanitiser and the link scheme check are still in place (`safeHTML`, `link()` allows only
      http(s) and mailto)

## Data

- [ ] Non-spatial items (theories, lab results, off-Earth objects, unplaceable rows) go to the Data panel, not onto
      the globe; every number traces to a PDF 7 § and page or a source row
- [ ] Grades only go up; nothing from Greer/Maussan carries weight; no skeptic boilerplate in summaries
- [ ] Every new plotted row has a `source_url`, a grade, `coord_source` and `coord_precision`
- [ ] Pins are used only for `exact_site` and `within_1km`; every other row gets an uncertainty circle at its real
      radius
- [ ] Geocodes come only from GNIS, GeoNames, Wikidata or OSM, and the one used is recorded. Coordinates are never
      invented or jittered
- [ ] Rows that cannot be placed are logged (for example `docs/audit/pdf7-unplaced.csv`) and appear in Data ›
      Unplaced (`data/unplaced.js`), never as pins
- [ ] `python3 data/tools/pdf7_dataset.py` and `python3 data/tools/gap_audit.py` have been re-run. Every open gap in
      `docs/audit/v1.2-data-gap-audit.md` has a reason, and stated-vs-computed conflicts are shown, not edited away
- [ ] Every number in the Data panel names its PDF 7 § and page or its source column; new statistical tests are
      seeded, report n, method, raw and Holm p, and a caveat, and have a unit test
- [ ] `docs/layer-catalog.md` is regenerated (`python3 scripts/layer_catalog.py`)

## Docs and release

- [ ] `CHANGELOG.md` has a dated section; `package.json`, `CITATION.cff` and the README citation use the same version
- [ ] `RELEASE_NOTES_vX.Y.Z.md` exists (the release workflow reads it)
- [ ] ADRs exist for architectural changes (`docs/adr/`)
- [ ] README badges and screenshots are real captures of this build (`node test/screens.mjs`), taken at several zoom
      levels including street level
- [ ] `CREDITS.md` and `docs/data-sources.md` list every imagery, terrain and live-feed source with its attribution
- [ ] No `.github/dependabot.yml`, no pull-request template, no review or coding bots configured; dependency upgrades
      are manual
- [ ] Annotated tag `vX.Y.Z` on `main`; bundle or zip produced with `npm run package -- --zip`
- [ ] The GitHub Pages deploy loads with no console errors, and the imagery attribution is visible at the bottom left
