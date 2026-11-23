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
- [ ] No orphaned headless Chrome is left from an earlier run (`pgrep -fa chrome`; stop them first). Two SwiftShader
      runs at once slow each other down and time out
- [ ] `npm run test:smoke` passes. It serves the repo over HTTP, boots, checks markers are glued to the surface,
      switches basemap and terrain, opens every panel, cycles every window through minimize, restore, maximize, drag,
      dock and close, and runs the tour, with zero console or page errors and zero
      Cesium ion requests **(CI)**
- [ ] `npm run test:a11y` passes: axe-core 4.11 (WCAG 2.0 / 2.1 / 2.2 A + AA, including colour contrast) on every UI
      view at 1920x1080 reports 0 violations
- [ ] `npm run test:perf` passes: an idle globe renders at most 20 frames in 10 s (render on demand, also with the
      grid and terminator on) and a dossier
      opens and captures in under 60 s on SwiftShader; `ui_audit --check` also fails a view over its time budget
- [ ] CodeQL reports no new alerts **(CI)**

## Design system (v1.3, [ADR 0003](adr/0003-design-system.md), [style guide](design/style-guide.md))

- [ ] New CSS uses tokens from `css/tokens.css` (spacing `--s-*`, type `--fs-*`, z-index `--z-*`, colours); no raw
      px font sizes below 12 px and no literal z-index values
- [ ] Every panel is a window from `src/ui/window.js` (standard header with minimize / maximize / close, one
      `.win-body` scroll region) and is listed in `initWindows()`; no inner `max-height` scroll boxes
- [ ] Every tab bar is built with `makeTabs()` from `src/ui/tabs.js` (ARIA roles, arrow keys, overflow arrows)
- [ ] Icons come from Lucide via `scripts/gen_icons.mjs` (`npm run icons`); no Unicode glyphs as icons
- [ ] Only Inter and JetBrains Mono are vendored and used (`vendor/fonts`, SIL OFL licences alongside)
- [ ] The UI audit has been re-run for UI changes (`npm run audit:ui -- --phase after --check`, then
      `python3 scripts/audit/ui_audit_v15.py`) and `docs/audit/v1.5-ui-audit.md` has no open bugs or errors

## OSINT console (v1.4, [ADR 0004](adr/0004-osint-console-information-architecture.md))

- [ ] `npm run audit:ui -- --phase after --check` passes at 1280x800, 1920x1080 and 3840x2160: no overlaps between
      docked parts, no clipped controls, no nested scroll bars, no text under 12 px, no target under 24 px, no chrome
      control under 32 px at comfortable density, 0 axe violations
- [ ] A new view has an activity-bar button, a registry key in `src/ui/shortcuts.js` with a handler in `ACTIONS`
      (`src/ui_misc.js`), an omnibox command and an audit view in `test/ui_views.mjs`
- [ ] A new category has a colour and a Lucide icon in `src/ui/symbology.js`; the legend, dossier, hover card,
      omnibox and globe pick it up from there. No colour or icon map anywhere else
- [ ] Pins only for `exact_site` / `within_1km` (`markerOf()`); the dossier Provenance block shows the coordinate
      source and precision for every case
- [ ] The status strip shows grades, data freshness and live feeds only; no classification or caveat markings
- [ ] Times are shown in UTC and US Pacific; numbers, coordinates and dates use tabular numerals
- [ ] Dynamic `import()` uses literal paths only, so esbuild bundles the module (a variable path 404s at run time)
- [ ] Wireframes are regenerated when the layout tokens change (`node scripts/design/wireframes_v15.mjs`; the v1.4
      set is archived and regenerated with `wireframes_v14.mjs`)
- [ ] Rail layer names are short and human; dataset ids, versions and caveats go into `NICE` / `l.note`
      (`src/layers.js`), shown in the tooltip and the row details, never in the label
- [ ] Icon-only controls have an `aria-label` and are matched by the tooltip selector in `src/ui/tips.js`
- [ ] State changes that the globe must show outside a camera move call `globe.requestRender()` (or go through
      `emit()`), so render on demand never shows a stale frame

## Globe visual system (v1.5, [ADR 0005](adr/0005-globe-visual-system.md))

- [ ] Reference geometry (grid, terminator, rings, dashed circles, flight plans) lives in pure modules
      (`src/cesium/graticule.js`, `src/cesium/flight.js`) with unit tests; Cesium adapters only draw it
- [ ] Overlays never add, move or hide a case; they rebuild only on a key change and call `requestRender()`.
      `npm run test:perf` checks idle frames with the grid and terminator on
- [ ] Pins carry the grade gauge (`pinShape()` / `GRADE_GAUGE`); `GAUGES` in `src/cesium/icons.js` equals it (unit
      test); circles stay dashed at the stated radius; the legend glyphs match the sprites
- [ ] Loading, empty and error use `src/ui/states.js` (live-region roles); an error offers one recovery action where
      one exists
- [ ] Media queries use range syntax and only widths from `src/ui/breakpoints.js` (unit test); JS reads the same list
- [ ] `:focus-visible` is defined only in `css/tokens.css` and still shows under `forced-colors: active`
- [ ] Motion respects both the OS preference and the in-app Reduced motion setting (instant flights, no flash scale,
      zeroed `--dur-*`)
- [ ] The UI audit for the release is regenerated (`python3 scripts/audit/ui_audit_v15.py`), with one label per
      finding and no open bugs or errors; before / after pairs come from `scripts/audit/pair_shots.py --release 1.5`

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

- [ ] `CHANGELOG.md` has a dated section and compare links for the new tag
- [ ] `RELEASE_NOTES_vX.Y.Z.md` exists (the release workflow reads it)
- [ ] ADRs exist for architectural changes (`docs/adr/`)
- [ ] README badges and screenshots are real captures of this build (`node test/screens.mjs`), taken at several zoom
      levels including street level
- [ ] Before / after pairs for UI releases are in `docs/screenshots/vX.Y/` (`python3 scripts/audit/pair_shots.py`),
      quantised to 256 colours, same view, viewport and script on both sides
- [ ] `CREDITS.md` and `docs/data-sources.md` list every imagery, terrain and live-feed source with its attribution
- [ ] No `.github/dependabot.yml`, no pull-request template, no review or coding bots configured; dependency upgrades
      are manual
- [ ] Annotated tag `vX.Y.Z` on `main`; bundle or zip produced with `npm run package -- --zip`
- [ ] For an offline hand-off, an incremental git bundle (`git bundle create … main vX.Y.Z ^<last pushed>`) passes
      `git bundle verify`, is split into 4 MiB parts with `SHA256SUMS`, and the full-bundle SHA-256 is recorded
- [ ] Versions agree: `package.json`, `package-lock.json`, `CITATION.cff` (`version` and `date-released`), the README
      citation and the brand label in `index.html`
- [ ] The GitHub Pages deploy loads with no console errors, and the imagery attribution is visible at the bottom left
