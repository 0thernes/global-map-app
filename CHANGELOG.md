# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.1] - 2026-11-24

The hardening release. A repository-wide audit (127 passes over an indexed table of contents of every tracked file)
recorded 66 findings; 50 are fixed with a regression test for every bug, 15 are decided with the reason recorded, and
1 is open, a 4K hover timing that tracks box load ([FINDINGS.md](docs/audit/hardening/FINDINGS.md),
[PASSES.md](docs/audit/hardening/PASSES.md)). No row was added, removed or moved; the data fixes correct format and
provenance against the source files.

### Fixed

- **Conflict dates.** Since v1.5.0 the build read spreadsheet datetimes (`1991-12-01 00:00:00.000`) as a bare year,
  so 188 UCDP conflict start dates and 236 end dates were shown as 1 January while labelled day precision. They now
  keep their day.
- **Date precision is never finer than the date.** An impossible source date (GEIPAN `2000-09-31`) is kept to the
  month, with a `date_note` in the dossier. Impossible months and days no longer roll over, ids such as `Q836568` are
  no longer mined for a year, and future years in free text are refused.
- **Spreadsheet artefacts**: 2,454 French postal codes lost their leading zero or carried `.0` (`8430.0` is now
  `08430`), and 1,926 witness counts read `1.0`.
- **Wikidata "unknown value" placeholders** (`http://www…`) no longer appear as dissolution dates, statuses or
  countries on 337 reference rows; military sites with an unknown dissolution date say so.
- **Provenance**: every reference-layer dossier now has a Coord. source row, and two cases without a dataset label
  name their source file.
- **Nearest military site** in the dossier no longer counts gendarmerie and forts, matching the analysis rule.
- **Grades**: a parenthetical about another case (`(nearby case CIT)`) or "unofficial" no longer raises a grade.
- **CSV exports** are RFC 4180 (quoted CR, CRLF rows) and neutralise spreadsheet formulas from the data.
- **Workspace import** validates and clamps every field and reports a bad file instead of throwing.
- **Printable dossier** reports a blocked pop-up instead of failing silently.
- **Uncertainty radii** in the app come from one table that a test keeps equal to the pipeline's.
- **Statistics**: antimeridian-crossing segments are indexed the short way round; an all-zero-weight sampler draws
  nothing.
- **Boot failure** (no WebGL, data load error) shows a message with a Reload button instead of a blank page.
- **Accessibility at every view and size** (UI audit over all 49 views at 1280x800, 1920x1080 and 3840x2160): legend
  cluster glyph text is 12 px (was 9), checkbox toggles, index links and window buttons have 24 px targets, long
  window buttons wrap instead of running past the edge, the map tools hide while a window covers their column, and the
  open legend no longer slides under the map-tool column beside a right dock.
- **Tab bars** measure overflow on the bar itself, so showing the scroll arrows no longer feeds back into the resize
  observer ("ResizeObserver loop" console messages).

### Changed

- **Search ignores accents** (`Bacouel` finds `Bacouël`) in the omnibox, the filter and case search.
- The console says "end of the timeline" for the fixed timeline end and measures the latest case from the data.
- New-tab links send no referrer; the CSP drops a host no code uses.
- The site package ships git-tracked files only; the Python pipeline passes JSON instead of a pickle.
- esbuild 0.25.12 (clears a moderate advisory; `npm audit` reports 0 vulnerabilities).
- CI runs the Python unit tests and ruff, and every workflow job has a timeout.

### Added

- `docs/data-dictionary.md` (every export column), `docs/limitations.md` (threats to validity) and a module index in
  `docs/architecture.md`.
- `docs/audit/hardening/`: `INDEX.md` (generated table of contents), the pass runner
  (`npm run audit:hardening`), `findings.csv` with a validating report generator (`npm run audit:findings`) and
  `PROGRESS.md`.
- 27 Node regression tests (181 in total) and 13 Python tests (`npm run test:py`); `.nvmrc`.

## [1.5.0] - 2026-11-23

The globe release: geographic reference on the map, a marker grammar that shows evidence grade without colour,
proportionate camera flights, and one way for every panel to say loading, empty or failed. No data changed; every
plotted row is still a sourced row, pins are still only for `exact_site` and `within_1km`, and nothing is jittered.

### Added

- **Latitude / longitude grid** (`J`, map tools, Settings › Globe reference). The spacing adapts from 30° in orbit to
  0.25° at street level, with labels along the parallel and meridian nearest the view centre. Only the visible part
  is built when you are close (`src/cesium/graticule.js`, `src/cesium/reference.js`).
- **Terminator and twilight rings** (`Y`): the sunrise and sunset line for the timeline date in amber, and the civil,
  nautical and astronomical twilight limits (Sun 6°, 12° and 18° below the horizon) dashed. They move with the
  timeline.
- **Heatmap toggle in the map tools** (`H` already existed). The map-tool column is now home, lasso and random; grid,
  terminator and heatmap; legend. Pressed toggles are drawn in the accent colour.
- **Panel states** (`src/ui/states.js`): one loading, empty and error markup with live-region roles. The feed, Data,
  Analysis, Hotspots and the legend use it, and the feed's error state has a **Try again** button.
- **ADR 0005** ([globe visual system](docs/adr/0005-globe-visual-system.md)) and **v1.5 wireframes**: 12 frames at
  1280x800, 1920x1080 and 3840x2160, including the globe reference state and the panel states
  (`scripts/design/wireframes_v15.mjs`). The v1.4 set is archived in `docs/design/wireframes/v1.4/`.
- **Unit tests** for the new modules: `graticule`, `flight`, `states` and `breakpoints`, plus the grade gauge in
  `symbology` (154 tests, up from 135).
- **Audit views** `globe_reference` and `markers_close` in `test/ui_views.mjs`. `test/perf.mjs` also checks idle
  frames with the grid and terminator on.

### Changed

- **Pins show the evidence grade.** The ring is a gauge: full for CIT and official records (CIT adds a halo), three
  quarters for ST, a half for testimony, and a quarter for online claims and ungraded rows. The category stays the
  colour. The legend draws the same glyphs.
- **Uncertainty circles are dashed**, with a lighter fill (7 %) and a hollow diamond at the centre, so a locality or
  region row can't be read as a pin. The radius is still the stated uncertainty on the true geodesic.
- **Camera flights are planned per hop** (`src/cesium/flight.js`). The duration follows the distance and the change
  of altitude, short hops ease out, long ones ease in and out and rise to an apex for context, and reduced motion
  makes them instant.
- **Time-lapse arrivals** pop and settle (the flash eases out) and stay at rest size under reduced motion.
- **Atmosphere and night lights**: a crisper limb and less blue wash on the ground, and brighter, higher-contrast
  NASA Black Marble city lights on the night side. Everything is still keyless.
- **Breakpoints**: one list in `src/ui/breakpoints.js`. Every stylesheet uses range syntax (`width < N`), and a unit
  test rejects unlisted widths.
- **High-contrast theme** also switches the grid and terminator to opaque white and yellow.
- **Focus ring** is declared once, in `css/tokens.css`. The in-app Reduced motion setting zeroes the motion tokens.
- `src/globe_cesium.js` delegates the overlays to `ReferenceOverlays`. Version 1.5.0.

### Fixed

- **At exactly 900 px wide**, CSS and JS disagreed about bottom sheets. CSS used `max-width: 900px`, which includes
  900; JS used `innerWidth < 900`.
- **Keyboard focus was invisible in Windows forced-colors mode.** The ring was a box-shadow only; it now gets an
  outline there.
- **Loading and error messages were not announced** to screen readers. They were plain paragraphs with no live
  region.

## [1.4.0] - 2026-11-18

The OSINT console release: a new information architecture around the globe, keyboard-first ergonomics and one
symbology shared by every view. No data changed; every plotted row is still a sourced row.

### Added

- **Wireframes and ADR**: [`docs/design/wireframes/`](docs/design/wireframes/README.md) at 1280x800, 1920x1080 and
  3840x2160 (generated by `scripts/design/wireframes_v14.mjs` from the same layout model as the CSS), and
  [ADR 0004](docs/adr/0004-osint-console-information-architecture.md), which records the patterns taken from
  analyst consoles, ADS-B and satellite trackers, conflict maps and weather globes, and what was left out.
- **Command bar**: brand, an omnibox, a status strip, clocks and the utilities.
  - The **omnibox** (`Ctrl+K` or `/`) searches commands, cases, places, layers and reference in one grouped list.
    Every view, tool and setting can be run from it.
  - The **status strip** shows the rows in view by grade, in the grade colours, the data build date and its age,
    and a dot for each live feed (USGS, EONET). It is not a classification banner.
  - **Clocks**: UTC and US Pacific (PST or PDT), with tabular numerals.
- **Activity bar** on the left: the 13 views in three groups (Explore, Analyze, Reference), 40 px targets,
  `aria-pressed` and a key hint on each. Clicking the active Layers or Filters button collapses the rail.
- **Legend** at the bottom left of the globe: pin versus uncertainty circle, the category colours and icons with
  counts, and the grades. `K` expands or collapses it.
- **Map tools** at the top right of the globe: home view (`O`), lasso, random case and legend.
- **Selection reticle**: amber corner brackets that follow the open case on the globe, sized to its uncertainty circle, so the selection is not lost after you pan.
- **Hover card**: category icon, title, date, grade, marker type and coordinate source, before you click.
- **Activity feed** (`N`): a Live tab with USGS earthquakes and NASA EONET events, and a Recent tab with the cases
  you opened and the filters you changed this session.
- **Cluster badges** show the category mix as a ring around the count, and counts over 999 as 1.2k.
- **Density** (`U`): comfortable (default, 32 px controls) or compact (24 px). **High contrast** (`X`): black
  surfaces, white text and borders, yellow accent. Both are saved and are also in Settings › Console.
- **Shortcut registry** (`src/ui/shortcuts.js`): the only list of keys. The key handler, the `?` overlay and the
  omnibox commands are generated from it.
- **Symbology module** (`src/ui/symbology.js`): one map from category to colour and icon, and from
  `coord_precision` to pin or circle, used by the legend, dossier, hover card, omnibox, feed and globe.
- **Checks**:
  - `npm run audit:ui -- --check` fails on overlaps between docked parts, clipped controls, nested scroll bars, text
    under 12 px, targets under 24 px, chrome controls under 32 px (comfortable density) and axe violations.
  - New audit views: omnibox, omnibox with a query, hover card, legend hidden, feed live and recent, compact, high
    contrast and the full console (dossier, feed and charts docked together).
  - Unit tests for the symbology, the shortcut registry (each key has a handler) and the clocks.
  - A smoke step for the omnibox, legend, activity bar, density, contrast, clocks and status strip.
- **UI audit v1.4** ([`docs/audit/v1.4-ui-audit.md`](docs/audit/v1.4-ui-audit.md) and `.csv`): v1.3 versus v1.4 at
  three resolutions. Every finding has one label: bug, error, issue, problem, dilemma or conflict.
- Before and after screenshots in [`docs/screenshots/v1.4/`](docs/screenshots/v1.4/README.md).

### Polished (second front-end review before release)

- **Layer rail**: short human names (All cases, Place labels, Large lakes, Live earthquakes …) that wrap to two
  lines instead of truncating; dataset ids, versions and caveats moved to the tooltip and the details row. Opacity
  moved off every row into the details row (sliders button) with a % read-out. The six QWM case files fold into one
  "Case source files" list. Wider rail: 336 px (304 px below 1440 px, 420 px at 4K).
- **Legend**: docked bottom-left above the timeline as a collapsed chip that still shows the pin and circle counts.
  `K` or the chip expands it upward; the state is remembered; Settings › Console hides it completely.
- **Timeline**: focus + context. An overview strip shows the whole 8000 BCE to today span with the focus window;
  the detail track shows the window on a linear scale. Era presets (All time, Ancient, 1900–1945, Cold War,
  1990–now, Last 10 y), wheel zoom on the track, click or drag the strip to pan. Histogram bins take the colour of
  their dominant category. The transport row has labelled groups: a large Play / Pause, Step (−1y … +1y, with
  spoken labels), Speed and Show as segmented controls with tooltips.
- **Status row**: the camera position, altitude and timeline date moved from the globe (where they sat on the
  timeline border) into the timeline's bottom row, with tabular numerals.
- **Status strip**: one count and one noun ("2,624 cases", as in the rail); the grade chips are now toggle buttons
  on the grade filter.
- **Cluster badges**: a collision pass merges badges whose discs would touch, so dense regions read as one badge per
  area; radius grows with log10(count); 1.25x at 4K.
- **Tooltips**: icon-only controls (activity bar, map tools, command-bar utilities, window buttons) show a visible
  tooltip with the shortcut as a key chip, on hover and on keyboard focus. The single letters under the activity
  icons are gone (the key stays in `aria-keyshortcuts`).
- **Visual hierarchy**: one strong window-header band, section rules in the rail, hover rows, fewer inner borders.

### Performance

- **Render on demand**: Cesium's `requestRenderMode` plus render requests from the app when state changes (time,
  filters, layers, selection, overlays) and on input. An idle globe draws about 6 frames in 10 s on software WebGL
  instead of one per animation frame (`test/perf.mjs` measures once the globe tiles have loaded: 4 frames in 10 s).
  This was behind a 92 min dossier capture in `test/ui_audit.mjs` (a re-run of
  the same sequence took 29 s; the continuous re-render starved the page under CPU load).
- `npm run test:perf` (`test/perf.mjs`): idle frame budget and dossier open + capture under 60 s on SwiftShader.
- `test/ui_audit.mjs --check` fails a view whose open phase takes over 60 s or whose capture takes over 180 s, stops
  a view after 300 s, and logs per-phase timings (open, measure, axe, shot).

### Changed

- The case dossier opens with a **Provenance** block: source and domain, grade and what it means, coordinate source,
  precision (pin or circle with its radius) and coordinates, then the place details. "Sources" is now "All sources".
- The status message moved from the bottom of the screen to the top centre, clear of the legend and timeline.
- At 2560 px and wider every token is scaled by 1.25, so 4K at 100 % zoom reads like 1080p at 125 %.
- Window defaults and docking account for the activity bar and the credit strip; docked windows report the space
  they take (`--occ-left`, `--occ-right`, `--occ-bottom`) so the legend and map tools move out of the way.
- Help (`?`) is generated from the registry and lists every key, including `N`, `O`, `K`, `U`, `X` and `Ctrl+K`.
- Live feeds are fetched once per session and shared by the globe layers and the feed.

### Fixed

- Cluster badges over Europe overlapped (91, 460, 66, 52, 598 … on top of each other at 1920x1080).
- The coordinate read-out overlapped the top border of the timeline.
- The status strip said "rows" and the rail said "cases" for the same number.
- The README key list had drifted from the key handler: `P` (frame rate) and `0` (reset windows) were missing.
- The status message sat just above the timeline, where it could cover a bottom-docked window.
- At 1280x800 a bottom-docked window (Analytics) was squeezed to under 280 px between the rail and the right docks
  and overlapped the feed; with under 400 px free it now runs under the right docks, which end above it.
- Settings window content ran off the right edge (long basemap names); toggles and sliders are now 24 px targets.
- Analytics bar rows were 18 px targets (3 px at 1280); they are 24 px rows with a full-width hit area, and the
  chart cards wrap at 300 px instead of shrinking.
- Related-case links, the UTC hour slider, the Cesium credit expander (10 px text) and hotspot glyphs (11 px) now
  meet the 24 px target and 12 px text floors.
- The activity bar clipped its last button on 800 px tall screens.
- The narrow command bar hid live-feed names with `font-size: 0` (which also blanked the feed's status line); the
  names are now visually hidden in the command bar only.
- Hover card: the 70 ms pick throttle dropped the last pointer move, so a quick move could leave the card hidden; a
  trailing pick now follows the throttle.
- `test/ui_audit.mjs` measures a checkbox inside a `<label>` by the label box (WCAG 2.5.8 target) and measures after
  window transitions settle.

## [1.3.0] - 2026-11-13

### Added

- **UI audit** (`docs/audit/v1.3-ui-audit.md` and `.csv`): 38 views measured at 1280x800, 1920x1080 and 3840x2160 by
  `test/ui_audit.mjs` (Playwright + axe-core). Each finding has exactly one label (bug, error, issue, problem,
  dilemma or conflict) and a v1.3 status. It is regenerated by `scripts/audit/ui_audit_report.py`.
- **Design system** ([ADR 0003](docs/adr/0003-design-system.md), [style guide](docs/design/style-guide.md)):
  - `css/tokens.css` holds all values: an 8 px spacing grid, a type scale with ratio 1.2 (12–29 px, 12 px floor),
    control sizes, radii, shadows, blur, an AA dark palette, a chart palette and one z-index ladder.
  - `css/components.css` holds the components.
- **Windows** (`src/ui/window.js`): every panel now works the same way.
  - A 48 px header with the title and minimize, maximize and close.
  - One scroll region with slim, themed scroll bars.
  - Drag the title bar to move a window; drop it on the left, right or bottom edge to dock it (a preview shows
    where). Resize from the corner grip or a docked window's inner edge. Double-click the title to maximize.
  - Position and size are remembered per window. **Reset window layout** is in the Export menu, or press `0`.
  - Esc closes an open menu, then the focused window, then the top one. Dialogs take focus and trap Tab.
  - Docked windows tile beside the rail and never cover the top bar, the timeline or the globe credits. The globe
    re-centres in the space that is left.
  - Below 900 px, windows become full-width bottom sheets.
- **Tabs** (`src/ui/tabs.js`): one underline style for the rail, Data and Index. Tabs use ARIA tablist / tab /
  tabpanel roles, support Left, Right, Home and End, never wrap, and show scroll arrows when they overflow.
- **Checks**:
  - `npm run test:a11y`: axe-core on every view, WCAG 2.0 / 2.1 / 2.2 A and AA including contrast, 0 violations
    required.
  - Unit tests for the window geometry, window behaviour, tabs and numeric-column detection (jsdom).
  - A smoke step that opens, minimizes, restores, maximizes, drags, docks, resets and closes every window.
- `npm run icons`: regenerates `src/icons.js` from `lucide-static`.

### Changed

- Two typefaces only: Inter for UI and titles, JetBrains Mono (vendored, OFL) for data and numbers. Rajdhani and IBM
  Plex Mono are removed.
- Tables have sticky headers and zebra rows. Numeric columns are right-aligned with tabular numerals. Headers can be
  sorted from the keyboard and report `aria-sort`.
- Charts use the `--chart-*` tokens, with 12 px axis text. Heat cells switch to dark text on bright fills.
- Data › PDF 7 tables: the table list is now a picker with previous and next buttons, so there is no scrolling list
  inside the scrolling window.
- Lucide icons replace the Unicode glyph buttons: lasso, random, screenshot, export, help, close, rail toggle,
  play / pause, pin, layer info.
- Below 1760 px the toolbar is icon-only, with names kept as tooltips and accessible text, so it no longer runs off
  the screen at 1280 px.
- Search is an ARIA combobox / listbox. Form controls, layer-info toggles and notes have accessible names. All click
  targets are at least 24 px.

### Fixed

- At 1280 px the export, settings, help and five other toolbar buttons were off screen.
- The Export menu ignored Esc.
- Panels overlapped each other, the rail and the timeline.
- Data and Index had nested scroll bars.
- Tab labels wrapped.
- Tabs had no `role="tab"` and no `aria-selected`.
- Text was 10–11 px in badges, counts and chart axes.
- Contrast failed on the conflict badge and on bright heat-map cells.

All data rules are unchanged: pin vs circle, `coord_source`, grades and sources on click.

## [1.2.0] - 2026-11-12

### Added

- **Data panel** (`D`, top-bar **Data**): PDF 7 and other non-spatial data, never drawn on the globe. See
  [ADR 0002](docs/adr/0002-non-spatial-data-layer.md). Tabs:
  - **Overview:**
    - counts stated in PDF 7 next to the counts recomputed from its CSVs, with conflicts flagged
    - counts by part, kind, placement, era, grade, section and country
  - **Entries:** all 660 entries (279 theories, 273 glitches, 108 Part V cases), sortable and filterable.
    - Each entry shows its section and printed page.
    - The PDF year is shown next to the map event date.
  - **Charts:** the PDF 7 figures rebuilt from the CSVs. Each chart names the figure it reproduces:
    - tier by domain
    - testability
    - composite score histogram
    - timeline
    - grade by domain
    - possibility map
    - Part V grades
    - testimony sources
    - taxonomy
    - domain trees
  - **PDF 7 tables:** all 165 LaTeX tables, plus 7 QWM aggregate tables, as sortable data tables. Each shows its
    section, printed page and `main.tex` line.
  - **Sources:** a source-type breakdown of the 237 Part V document links, map rows by `source_type`, and unplaced
    rows by dataset.
  - **Stats:** seven pre-set tests, including two cross-layer ones. Each reports n, the statistic, a seeded
    permutation or Fisher exact p-value, the Holm-adjusted p-value, the method and a caveat.
  - **Unplaced:** 397 rows that have a source but no single point, plus a count of 37 rows that have no source.
  - CSV download for every table, using the current sort and filter.
- `data/pdf7_data.js`: the non-spatial PDF 7 layer, built by `data/tools/pdf7_dataset.py` from a committed snapshot
  (`data/sources/pdf7/snap/`).
- `data/unplaced.js`: written by `data/build_data.py`.
- `data/tools/pdf7_tex.py`: the LaTeX table and figure parser, which finds pages through the PDF text layer.
- `docs/audit/v1.2-data-gap-audit.{md,csv}` and `data/tools/gap_audit.py`:
  - 356 inventory items, each marked present, partial or missing for v1.1.0 and v1.2.0
  - exactly one label per gap
  - the v1.2 status is recomputed from the built files
- Tests: `test/unit/pdf7_data.test.mjs` and `test/unit/pdf7_stats.test.mjs` (22 tests). The smoke test now covers
  every Data tab, sorting and Escape.
- Screenshots 19–25 of the Data panel.

### Removed

- `.github/dependabot.yml` and the pull-request template. Commits go straight to `main`, with no pull requests and
  no Dependabot, CodeRabbit or Copilot. CI and CodeQL run on pushes to `main`, not on pull requests.
  `docs/repo-checklist.md` now covers what the PR template used to, and `CONTRIBUTING.md` says data arrives
  through issues.

### Fixed

- **PDF 7 section numbers.** All 273 Part II references cited the longtable counter as the section. For example,
  Hubble tension was cited as "§14" but is in §16. Sections now come from the label's position in `main.tex`; the
  pages were already correct.
- Rows with a source but no single point (314 GEIPAN cases, 39 conflicts, PDF 7 Part V rows and others) were left
  out of every view, including analytics. They are now listed and counted in Data › Unplaced, and still never drawn
  as pins.

## [1.1.0] - 2026-11-12

### Changed

- **Renderer: three.js → CesiumJS 1.147** (Apache-2.0, bundled from `@cesium/engine` 26.5.0 / `@cesium/core` 0.1.1;
  runtime vendored in `vendor/cesium/`). See [ADR 0001](docs/adr/0001-cesium-renderer.md).
  - Markers, uncertainty circles, labels and cluster badges are now world-anchored primitives. They stay glued to the
    surface instead of floating over it, and they are hidden on the far side of the globe.
  - Streamed level-of-detail imagery stays sharp from orbit to street level, instead of one static 8K texture.
  - Keyless 3D terrain from AWS Terrain Tiles (Mapzen terrarium), with Esri World Elevation and flat as options.
  - Real sun lighting for the timeline date and hour, NASA Black Marble night lights, atmosphere and fog. Lighting
    fades out near the ground so cities stay readable.
  - Fly-tos tilt the camera when close (Google Earth-style). The tour orbit circles the target.
  - Clustering is decided once the camera settles; badges sit at the members' centroid.
  - Responsive to window and DPI changes; MSAA on hardware GPUs, FXAA everywhere.
- Settings: the basemap checkbox is replaced by **Basemap** and **Terrain** pickers. The choice persists, and
  `?basemap=` and `?terrain=` URL parameters set it.
- CSP: tile hosts added to `img-src`/`connect-src`. `'wasm-unsafe-eval'` is the only relaxation; there is still no
  `'unsafe-eval'`.
- Smoke test: serves the repo over HTTP like GitHub Pages. It asserts that markers are anchored (≤ 3 px) and that no
  Cesium ion request is made, and it switches basemap and terrain.

### Added

- Keyless basemaps: Esri World Imagery (default) and Esri hybrid; EOX Sentinel-2 cloudless 2016; OpenStreetMap;
  CARTO dark; NASA GIBS Blue Marble; **NASA MODIS Terra imagery of the timeline day**; offline bundled Blue Marble.
  An automatic offline fallback kicks in when tiles fail.
- Live layers: **USGS earthquakes M4.5+ (30 days)** and **NASA EONET open natural events**.
- `docs/data-sources.md`: review of keyless sources from public-apis and other hubs, covering what is used, what is
  documented for later, and why.
- `docs/adr/0001-cesium-renderer.md`, `docs/repo-checklist.md`, unit tests for the source catalogue and terrarium
  maths. The PR template checks keyless sources and anchored globe objects.

### Added: PDF 7 (_What Is What of the What_) as a source

- `data/tools/pdf7_mine.py` reads all 381 PDF 7 entries, with section numbers and pages taken from the LaTeX
  build (`main.aux`). It applies a reviewed curation file (`data/sources/pdf7/curation.csv`) and cross-checks
  every entry against the map.
  - 31 new map rows. Coordinates come only from Wikidata P625, and each row records its Q-id. Each row cites the
    PDF 7 citation and a source URL, and the pin vs circle rule applies.
  - 119 entries were already on the map. The 134 matching map rows now carry their PDF 7 reference.
  - 32 entries name a place that cannot be placed honestly; they are logged with reasons in
    `docs/audit/pdf7-unplaced.csv`.
  - 198 entries have no place (theories, laboratory results without a named site, off-Earth objects).
- Clicking a row shows **PDF 7 §x.y (p. n) · G-path**. The new **PDF 7 index** tab (Index panel) lists every placed or
  unplaced entry by section, with links to its map entries.
- A new case category, **PDF 7 place**, covers sites that are not UAP cases (for example Tunguska, Wow! signal, Antikythera).

### Removed

- `src/globe.js` (three.js scene and shaders), `src/labels.js` (2D canvas label overlay) and the z3 EOX reprojection.
  three.js remains only for vector maths.

## [1.0.0] - 2026-11-12

First public release.

### Added

- Cinematic 3D globe (three.js r170): day/night shader with real sun terminator, relief, specular ocean, atmosphere,
  bloom, grain, chromatic aberration, HUD frame, starfield boot screen and **ENGAGE** button.
- Guided 20-step tour, lower thirds, typed text, Rajdhani display type, motion tokens, reduced-motion support.
- Audio: CC0 music bed, drone and UI effects; muted until interaction; master/music/effects sliders.
- URL launch options (`tour`, `audio`, `fullscreen`, `intro`, `fx`, `perf`, `basemap`, `private`) and `launch.cmd`
  for Windows.
- Timeline from 8000 BCE to today with day resolution since 1900, playback and date brushing.
- Cases layer with grades, precision pins/circles, conflict badges and `[verify]` markers.
- Layers of layers: tri-state group › layer › sub-layer tree with a shared taxonomy.
- New layers: **Off-limits mountains** (QWM, with computed nearest military site), **HydroLAKES**, **GEBCO 2025
  unmapped seafloor**, **oceanic trenches and deeps** (Wikidata), **CNEOS fireballs**, **USO (water)** and
  **satellite anomalies** (off-world records in a separate panel), optional **EOX Sentinel‑2 2016** basemap.
- Convergence hotspots with population correction, evidence grade and cluster dossiers.
- Reports (selection, country, era, category) with print/PDF and standalone HTML export.
- Reference index: sources, glossary, A–Z, sites, countries, coverage matrix, off-world, credits.
- Analysis additions: water subset and USO caveat, multiple-comparisons note.
- Filters: water distance, conflicting values, citations needing verification.
- Ten-pass forensic audit with findings CSV and taxonomy; independent Python re-derivation of the statistics.
- Repository: MIT licence, data licence, credits, citation, contributing, conduct, security and support policies,
  issue and PR templates, CI, Pages, release and CodeQL workflows.

### Changed

- Military layer: Wikidata class policy removes 2,624 non-military items reached by the subclass walk and relabels
  historic fortifications and gendarmerie barracks; the analysis and hotspots exclude them.
- NUFORC rows moved to the git-ignored `data/private/` (no licence); public rows no longer carry private values.

### Fixed

- Satellite close-ups used a non-commercial (CC BY-NC-SA) EOX vintage; now the CC BY 4.0 2016 vintage.
- Off-limits mountains were ingested twice (notes file and snapshot).
- Duplicated composite grades (`X / X`) collapsed.
- Briefing Markdown is sanitised with an allow-list; data links are limited to http(s) and mailto.

[Unreleased]: https://github.com/0thernes/global-map-app/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/0thernes/global-map-app/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/0thernes/global-map-app/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/0thernes/global-map-app/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/0thernes/global-map-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/0thernes/global-map-app/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/0thernes/global-map-app/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/0thernes/global-map-app/releases/tag/v1.0.0
