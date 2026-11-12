# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/0thernes/global-map-app/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/0thernes/global-map-app/releases/tag/v1.0.0
