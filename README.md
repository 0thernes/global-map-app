<div align="center">

# Global Map

**A cinematic 3D OSINT globe of sourced UAP and high-strangeness cases, set against military, nuclear, conflict,
water and sky layers. Every plotted row cites its source.**

[![CI](https://github.com/0thernes/global-map-app/actions/workflows/ci.yml/badge.svg)](https://github.com/0thernes/global-map-app/actions/workflows/ci.yml)
[![Pages](https://github.com/0thernes/global-map-app/actions/workflows/pages.yml/badge.svg)](https://0thernes.github.io/global-map-app/)
[![CodeQL](https://github.com/0thernes/global-map-app/actions/workflows/codeql.yml/badge.svg)](https://github.com/0thernes/global-map-app/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/0thernes/global-map-app?sort=semver)](https://github.com/0thernes/global-map-app/releases)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Data: see DATA_LICENSE](https://img.shields.io/badge/data-per--dataset%20licences-informational.svg)](DATA_LICENSE.md)
[![CesiumJS 1.147](https://img.shields.io/badge/CesiumJS-1.147-6caddf.svg)](https://cesium.com/platform/cesiumjs/)
[![No API keys](https://img.shields.io/badge/API%20keys-none-success.svg)](docs/data-sources.md)
[![No Cesium ion](https://img.shields.io/badge/Cesium%20ion-not%20used-success.svg)](docs/adr/0001-cesium-renderer.md)
[![Static site](https://img.shields.io/badge/runs-GitHub%20Pages%20%7C%20file%3A%2F%2F-success.svg)](#quick-start)
[![X @0thernes_ai](https://img.shields.io/badge/X-%400thernes__ai-000000.svg)](https://x.com/0thernes_ai)

**[Live demo](https://0thernes.github.io/global-map-app/)** · [User guide](docs/user-guide.md) · [Layer catalog](docs/layer-catalog.md) · [Audit](docs/audit/SUMMARY.md) · [Data sources](docs/data-sources.md) · [ADR: Cesium](docs/adr/0001-cesium-renderer.md) · [Changelog](CHANGELOG.md)

![Global Map: CesiumJS globe with streamed satellite imagery, sun lighting, cases and surface-anchored labels](docs/screenshots/02_globe.png)

</div>

## Why

UAP, abduction, mutilation and other high-strangeness reports are scattered across archives, databases and
testimony. Global Map puts them on one time-aware globe next to the things people usually ask about (military bases,
nuclear sites and tests, wars, oceans and lakes, fireballs) and lets you test the questions instead of guessing.
It is strict about evidence: **sourced rows only, no invented values, no coordinate jitter, every disagreement between
sources shown rather than hidden.**

## Features

|                              |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Earth-style globe** | CesiumJS with streamed, level-of-detail imagery that stays sharp from orbit to **street level** (Esri World Imagery, EOX Sentinel‑2 2016, OSM, CARTO, NASA GIBS incl. MODIS imagery _of the timeline day_), keyless **3D terrain** (AWS Terrain Tiles), real sun lighting with NASA Black Marble night lights, atmosphere. Markers, circles and labels are anchored to the surface. **No API keys, no Cesium ion.**                   |
| **ENGAGE and the tour**      | Boot screen with an ENGAGE button (unlocks audio, fullscreen, fly-in), then a 20-step guided tour that flies to the best-sourced cases, hotspots and findings. Muted until you interact.                                                                                                                                                                                                                                              |
| **Timeline**                 | 8000 BCE to today; day resolution since 1900; playback, date brushing, range bars for uncertain dates.                                                                                                                                                                                                                                                                                                                                |
| **Cases**                    | 2,593 public sourced rows (plus local-only private rows), graded CIT / Official record / ST / Testimony; pins only for exact or ≤ 1 km sites, uncertainty circles otherwise.                                                                                                                                                                                                                                                          |
| **Layers of layers**         | Live USGS earthquakes and NASA EONET natural events, plus 30+ data layers in a tri-state tree (group › layer › sub-layer): military (MIRTA, Wikidata), reactors, nuclear sites and 2,057 tests, UCDP conflicts, volcanoes, faults, pyramids, megaliths, caves, ocean anomalies, **off-limits mountains**, **HydroLAKES**, **unmapped seafloor (GEBCO 2025)**, **oceanic trenches**, **CNEOS fireballs**, USO and satellite anomalies. |
| **Convergence hotspots**     | Grid score of where many kinds of record meet, corrected for population, with an evidence grade A–F and a dossier per cluster.                                                                                                                                                                                                                                                                                                        |
| **Analysis**                 | Distances to the nearest base / nuclear site / conflict event against uniform, population-weighted and date-permuted baselines; Monte Carlo p, bootstrap CIs, Bonferroni note; independently re-derived in Python.                                                                                                                                                                                                                    |
| **Reports**                  | One-click dossier-style reports for the selection, a country, an era or a category; print to PDF or export standalone HTML.                                                                                                                                                                                                                                                                                                           |
| **Reference**                | Sources, glossary, A–Z, sites, countries, coverage matrix (breadth × depth), off-world targets and credits.                                                                                                                                                                                                                                                                                                                           |
| **OSINT tools**              | Search, filters (grade, precision, water distance, conflicts, `[verify]`), link graph, compare view, charts, lasso, exports (CSV, GeoJSON, Markdown), workspaces.                                                                                                                                                                                                                                                                     |

<table>
<tr><td><img src="docs/screenshots/01_engage.png" alt="ENGAGE boot screen"></td><td><img src="docs/screenshots/07_hotspots.png" alt="Convergence hotspots"></td></tr>
<tr><td><img src="docs/screenshots/05_dossier.png" alt="Case dossier"></td><td><img src="docs/screenshots/08_report.png" alt="Report"></td></tr>
<tr><td><img src="docs/screenshots/03_layers_tree.png" alt="Layer tree"></td><td><img src="docs/screenshots/09_index_coverage.png" alt="Coverage matrix"></td></tr>
</table>

## Quick start

No install. Easiest: the **[live demo](https://0thernes.github.io/global-map-app/)**.

1. Download the [latest release](https://github.com/0thernes/global-map-app/releases) zip, or clone the repo.
2. **Best (3D terrain on):** serve the folder: `npm run serve` or `python3 -m http.server 8080`, then open
   <http://localhost:8080>.
   **Windows:** double-click `launch.cmd` (Chrome or Edge, full screen, intro and sound).
   **Anywhere:** open `index.html` in a current Chrome, Edge or Firefox.
3. Press **ENGAGE**.

Imagery and terrain stream from free keyless servers, so you need a connection for street-level detail. Offline, the
app falls back to the bundled NASA textures. On plain `file://` the globe is flat (no terrain), because browsers block
the web workers that build terrain meshes there. See [ADR 0001](docs/adr/0001-cesium-renderer.md).

It is a static browser app (HTML, CSS, one JavaScript bundle and data files); it is not Electron and installs nothing.

### URL options

| Parameter             | Effect                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `?tour=intro`         | start the guided tour after boot                                                         |
| `?audio=on`           | start with sound on (still needs one click in most browsers)                             |
| `?fullscreen=1`       | ask for full screen on ENGAGE                                                            |
| `?intro=0`            | skip the boot screen                                                                     |
| `?fx=low` / `?perf=1` | fewer post effects / performance mode                                                    |
| `?basemap=esri`       | basemap: `esri` (default), `hybrid`, `s2`, `osm`, `dark`, `bluemarble`, `modis`, `local` |
| `?terrain=terrarium`  | terrain: `terrarium` (default over http), `esri`, `off`                                  |
| `?private=0`          | do not try to load local-only private data                                               |

## Keyboard

`/` search · `Space` play · `←/→` day (Shift month, Alt year) · `L` layers · `F` filters · `Z` hotspots · `E` reports ·
`I` index · `A` analyze · `V` charts · `G` graph · `C` compare · `W` wars · `B` briefings · `S` lasso · `H` heatmap ·
`T` tour · `M` mute · `,` settings · `R` random case · `Esc` close · `?` help

## Architecture

```mermaid
flowchart LR
  subgraph Sources
    QWM[QWM layer drops<br/>map_*.csv]
    CUR[curated CSVs<br/>data/sources]
    EXT[external datasets<br/>NE, GeoNames, UCDP, SIPRI,<br/>MIRTA, Wikidata, GVP, GEBCO,<br/>HydroLAKES, CNEOS]
  end
  subgraph Build[Python build]
    BD[data/build_data.py]
    BT[data/tools/*.py]
  end
  subgraph Data[data/*.js  GM.reg payloads]
    CASES[cases.js]
    LAY[layers/*.js]
    PRIV[(private/<br/>git-ignored)]
  end
  subgraph App[Browser app  file:// or Pages]
    CORE[app_core + layers]
    GLOBE[globe_cesium.js CesiumJS<br/>keyless tiles + terrain]
    UI[panels, hotspots, reports,<br/>reference, analysis, cinema]
  end
  QWM --> BD
  CUR --> BD
  EXT --> BT
  BT --> LAY
  BD --> CASES
  BD --> PRIV
  BD --> LAY
  CASES --> CORE
  LAY --> CORE
  PRIV -. local only .-> CORE
  CORE --> GLOBE
  CORE --> UI
```

Details: [docs/architecture.md](docs/architecture.md) · [docs/data-pipeline.md](docs/data-pipeline.md).

## Data and grading

- **Sourced rows only.** No `source_url`, no plot. Rejected rows and the reason are in `data/unplotted_loader.csv`.
- **Grades:** CIT (Robert Hastings and Diana Pasulka count as CIT), Official record (archives), ST (experiencers),
  Testimony. Greer and Maussan rows are listed with zero weight. The audit only ever raises grades.
- **Precision:** pins for `exact_site` / `within_1km`; translucent circles for everything else. No jitter.
- **Conflicts** between sources are badged and both values are shown.
- **NUFORC** has no stated licence, so its rows stay in the git-ignored `data/private/` and load only on your machine.

Full rules: [docs/data-and-grading.md](docs/data-and-grading.md). Licences: [DATA_LICENSE.md](DATA_LICENSE.md),
[CREDITS.md](CREDITS.md).

## Audit

Ten forensic passes (sources, values, cross-dataset conflicts, grades, duplicates, reference layers, statistics,
glossary, code and security, UX) are in [docs/audit](docs/audit/SUMMARY.md). Every finding is classed as a bug, error,
issue, problem, dilemma or conflict ([TAXONOMY.md](docs/audit/TAXONOMY.md)) and listed in
[qwm-data-issues.csv](docs/audit/qwm-data-issues.csv).

## Development

```bash
npm ci
npm run build        # esbuild -> js/app.js
npm run check        # ESLint + Prettier + unit tests + data validation + build + headless smoke test (http)
npm run serve        # http://localhost:8080 (3D terrain needs http)
npm run package -- --zip   # reproducible release zip in dist/
```

Release checklist: [docs/repo-checklist.md](docs/repo-checklist.md).

Rebuild data (needs the raw downloads, see [data-pipeline.md](docs/data-pipeline.md)): `sh data/refresh.sh`.

## Roadmap

- [ ] OSM military extract (planet `military=*`) merged into the bases layer
- [ ] GHS-POP population grid for the population baseline
- [ ] HydroLAKES < 1 km² and HydroRIVERS as streamed vector tiles
- [x] Streamed globe tiles to street level and keyless 3D terrain (CesiumJS, v1.1)
- [ ] Live aircraft (OpenSky) and satellite tracks (CelesTrak + SGP4), keyless
- [ ] Bathymetry terrain option (seafloor relief) with sea-level-aware markers
- [ ] UNHCR / IDMC displacement figures for the wars ranking
- [ ] More postal-code countries; admin-2 boundaries
- [ ] GPU picking and clustering beyond ~250k cases
- [ ] A decision on NUFORC licensing (see the audit dilemmas)

## Contributing

Data and code contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Security reports: [SECURITY.md](SECURITY.md). Help: [SUPPORT.md](SUPPORT.md).

## Citation

If you use Global Map in research, cite it with [CITATION.cff](CITATION.cff) (GitHub shows a "Cite this repository"
button), and cite the underlying datasets listed in [CREDITS.md](CREDITS.md).

```
0thernes L.L.C. (2026). Global Map (Version 1.1.0) [Computer software]. https://github.com/0thernes/global-map-app
```

## Licence

Code: [MIT](LICENSE) © 2026 0thernes L.L.C. Data: each dataset keeps its own licence ([DATA_LICENSE.md](DATA_LICENSE.md)).

<sub>Made by [0thernes](https://0thernes.art) · [@0thernes_ai](https://x.com/0thernes_ai) · 0_0@0thernes.art</sub>
