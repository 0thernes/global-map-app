# Global Map: OSINT globe (v1)

Self-contained static web app. **Double-click `index.html`** (works from file://, a file share, offline). No server needed: data and textures are JS files that register themselves (`GM.reg(...)`). If a browser blocks file:// scripts, serve the folder: `python3 -m http.server 8000` and open http://localhost:8000.

## What it does
- three.js globe: NASA Blue Marble day (8K) / Black Marble night (8K) blended by a real sun terminator for the timeline date and UTC hour, bump-mapped relief (4K), ocean specular, fresnel atmosphere, starfield, country-glow for active wars. DPR capped at 2, anisotropic filtering, MSAA.
- Timeline 8000 BCE → 2026-11-11: segmented scale (8000 BCE–1 CE, 1–1500, 1500–1900 compressed; 1900–2026 at day resolution), day/month/year steps, speeds 1 day/s … 100 years/s + adaptive, cumulative or flash playback, pulse rings when cases appear, Shift-drag to brush a date range, range bars for disputed / imprecise dates (`date_low`–`date_high`). Internally dates are integer day numbers in the proleptic Gregorian calendar (negative ISO years = BCE; JS `Date` is not used for history).
- Markers follow Alex's precision rule: sharp pin only for `exact_site` / `within_1km`; `locality` / `region` / `unspecified` get a translucent uncertainty circle (radius = `coord_radius_km`, default 10 / 100 / 25 km) with a faint centre dot. No jitter anywhere.
- Level of detail: continents → countries (Natural Earth 10 m) → states/provinces → cities ≥15k → towns 5–15k → postal/ZIP codes (GeoNames, lazily per country when zoomed in). Borders/coasts swap 50 m → 10 m on zoom.
- Layers (toggle, opacity, source + legend via ⓘ): cases, heatmap, borders, coasts, states, labels, postcodes, urban areas, rivers, lakes, plate boundaries, GEM faults, USGS faults, volcanoes, military bases (MIRTA + Wikidata + QWM seeds + OSM), nuclear reactors (operating-period aware), QWM nuclear sites, nuclear tests (by environment, sized by yield), OSM nuclear test sites, war/conflict glow, UCDP GED events, and every expected QWM layer (pyramids, megaliths, caves, ocean, ancient cities, weird coordinates with a glitch/RGB-split marker, conflicts). Missing files show "waiting for QWM file …" and light up after `data/refresh.sh`.
- OSINT tools: typeahead search (`/`) over cases, sites and countries with fly-to (Shift+Enter filters by the text); filters for category, grade (CIT / Official record / ST / TE-testimony / other), era, location precision, country or area (Natural Earth admin-0 + `Ocean/International waters`, `Antarctica`, `Space`); clustering that splits on zoom; dossier with grade and precision badges, coordinates source, related cases (linked_case, same category ≤500 km, ±1 year, shared witnesses/keywords; arcs on the globe), nearest reference sites, Markdown / printable export, pin; CSV / GeoJSON export of the filtered set; workspaces (browser save/load, JSON export/import, notes).
- Wars (W): conflicts active at the timeline date ranked by deaths high/low, deaths this year, civilian toll or displaced; start · sourced peak · end; ranges where estimates differ; blanks where no figure is sourced. Glow swells/fades with UCDP annual deaths; flat glow without per-year data.
- Analyze (A): UAP-type cases vs nearest military base, nuclear site (reactors operating at the case date) and UCDP conflict event (±window), against uniform-land, population-weighted and time-matched (date-permuted) baselines: medians with bootstrap CIs, ratios, Monte Carlo p-values, ≤50/100 km shares with Wilson CIs, histograms, by-country and by-decade breakdowns, hotspot overlay, bias panel, sample-size warnings, CSV export. "Exact / within 1 km only" is on by default; with it off, uncertainty radii are reported.
- Charts (V): linked crossfilter charts (years by category with brushing, category, grade, country, precision, nuclear-test / battle-death context, analysis scatter). Globe lasso (S) filters charts, graph and exports.
- Graph (G): d3-force entity graph (cases, witnesses, source domains) with edge reasons on hover; capped at 600 cases.
- Compare (C): swipe or split view of two dates (sun, cases and dated layers per side).
- Briefings (B): renders QWM `analysis_summary.md`, `README.md`, PNG charts, `sources_registry.csv`, `languages_searched.csv` and the data-drop status.

Keyboard: `/` search · `Space` play · `←/→` day (Shift month, Alt year) · `L` layers · `F` filters · `G` graph · `C` compare · `A` analyze · `V` charts · `W` wars · `B` briefings · `S` lasso · `H` heatmap · `R` random · `P` FPS · `Esc` close · `?` help.

## Data pipeline
```
data/refresh.sh            # = tools/build_military.py + build_data.py (re-run whenever QWM drops a file)
data/build_data.py [extra.csv|dir ...]
```
Inputs: `data/sources/*.csv` (local curated) and `/workspace/qwm/wiw/data/map/map_*.csv` (+ `sources_registry.csv`, `languages_searched.csv`, `analysis_summary.md`, `README.md`, `*.png`). Override the folder with `GM_MAP_DIR`. `part_*.csv` intermediates are ignored.

### Common CSV schema (primary)
`id, name, date, date_precision, date_low, date_high, date_disputed, lat, lon, coord_precision, coord_source, continent, country_iso, country, admin1, admin2, locality, postal_code, urban_rural, category, subtype, count, summary, source_title, source_url, source_type, dataset, grade, witness_count, nearest_military_site_km, nearest_nuclear_site_km, linked_case, notes` (+ any extra columns, kept and shown in the dossier).
- Required to plot: `lat`, `lon`, `name`, `source_url` (http…); case layers also need a parseable `date`. Rejected rows go to `data/unplotted_loader.csv` with the reason.
- `date`: ISO `YYYY-MM-DD`, `YYYY-MM`, `YYYY`; negative years for BCE (`-2560`). `date_low` / `date_high` draw a range bar; `date_disputed` marks it.
- `coord_precision`: `exact_site` | `within_1km` | `locality` | `region` (optional `coord_radius_km` overrides the default circle radius). Anything else → `unspecified` (circle).
- `category`: free text or QWM codes (`uap_case`, `uap_report`, `abduction`, `animal_mutilation`, `human_mutilation`, `missing_person`, …) mapped to the palette: UAP case · CIT UFO sighting · UAP report (public database) · Nuclear-site incident · Wartime sighting · Mass sighting · Abduction · Animal mutilation (cattle/horse/dog/wildlife via `subtype`) · Human mutilation · Missing person.
- `linked_case`: ids separated by `;` → explicit edges in the graph and "Related cases".
- Case files by name: `map_uap_cit`, `map_abductions`, `map_animal_mutilations`, `map_missing_unsolved` (and `map_human_mutilations`). Reference files: `map_nuclear_tests`, `map_weird_coordinates`, `map_pyramids`, `map_megaliths`, `map_caves_underground`, `map_ocean`, `map_ancient_cities_remote_sensing`, `map_conflicts`, `map_nuclear_sites`; `map_military_bases` is merged and deduped into the military layer.
- Weird coordinates: extra columns `coord_text_original, decoding_method, origin, what_is_there, why_weird` are shown (tooltip = `why_weird`).
- Over 15,000 cases (`GM_SLIM_OVER`): `cases.js` keeps slim rows and full records go to `data/case_details/NNNN.js`, loaded when a dossier opens.
- Local curated rows that QWM later publishes are superseded by the QWM row (logged in `unplotted_loader.csv`).

Other builders (need the raw downloads in /workspace/gm_build): `data/tools/build_layers.py` (Natural Earth, GeoNames, faults, plates, volcanoes, postcodes, textures index), `build_conflicts.py` (UCDP/COW/genocides), `build_military.py`, `wd_mil.py` (Wikidata military query), `fetch_osm_military.py` (Overpass, regional chunks), `geocode_qwm.py` (Nominatim, for the local curated CSV only).

## Code
`src/` ES modules → `js/app.js` via `./build.sh` (esbuild; three.js r170 vendored in `vendor/three`). `src/stats.js` holds the statistics (tests: `node test/stats.test.mjs`). `test/shots.py` renders headlessly (Chromium + SwiftShader) and writes `shots/` + `shots/report.json`.

## Staged plan (not in v1)
1. OSM military extract: Overpass endpoints were overloaded/502 during the build; `fetch_osm_military.py` resumes chunk by chunk, then `refresh.sh` merges and dedupes. A prebuilt planet extract (osmium `military=*`) would be the robust path.
2. Population grid baseline: swap GeoNames-city weighting for GHS-POP 2025 (1 km) or GPW v4 when the rasters are bundled (≈ 100–400 MB; would be tiled).
3. Urban/rural: Natural Earth urban polygons are used now (MODIS 2002–03 era); GHS-SMOD degree of urbanisation by epoch is the planned upgrade.
4. Postal codes: 10 countries bundled; drop more GeoNames dumps (`download.geonames.org/export/zip/XX.zip`) into `/workspace/gm_build/postal/` and re-run `data/tools/build_layers.py`; the app picks them up from `postal_index.js`.
5. HydroLAKES / HydroRIVERS close-zoom tiles (NE 10 m used for now); vector tiles for admin-2 / municipalities.
6. Displaced-people figures (UNHCR / IDMC) for the wars ranking (column present, blank until sourced).
7. GPU picking and GPU-side clustering if case counts pass ~250k.
