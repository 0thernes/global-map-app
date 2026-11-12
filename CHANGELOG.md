# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
