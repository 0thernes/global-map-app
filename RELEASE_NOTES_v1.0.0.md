# Global Map v1.0.0

Released 2026-11-12 by 0thernes L.L.C. · [Live demo](https://0thernes.github.io/global-map-app/) · [Changelog](CHANGELOG.md)

A cinematic 3D OSINT globe of sourced UAP and high-strangeness cases, set against military, nuclear, conflict, water
and sky layers. Static browser app: no install, no server, works offline from `file://`.

## Get it

- Download `global-map-app-v1.0.0.zip` below, unzip, and open `index.html` (Windows: double-click `launch.cmd`).
- Or use the live demo on GitHub Pages.

## Highlights

- **ENGAGE** boot screen and a 20-step guided tour; HUD, lower thirds, CC0 sound (muted until you interact).
- **2,593 public sourced cases** with grades and precision pins/circles; conflicts between sources shown, never hidden.
- **Layers of layers:** tri-state group › layer › sub-layer tree over 30+ data layers, including new **Off-limits
  mountains** (with computed distance to the nearest military site), **HydroLAKES**, **GEBCO 2025 unmapped
  seafloor**, **oceanic trenches**, **CNEOS fireballs**, **USO** and **satellite anomalies** (off-world panel).
- **Convergence hotspots** with population correction and evidence grades; big regions split at score peaks.
- **Reports** (print/PDF, standalone HTML) and a **Reference index** with a breadth × depth coverage matrix.
- **Ten-pass forensic audit:** 3,072 findings classed as bug, error, issue, problem, dilemma or conflict; statistics
  re-derived independently in Python.

## Important result change

The military layer now excludes fire lookout towers and similar items pulled in by the Wikidata class walk, and the
analysis excludes historic fortifications and gendarmerie barracks. For all public UAP-type cases the median distance
to the nearest military site is 16.0 km (was 2.6 km) and the population-weighted test is no longer significant. For
the 24 precisely located cases the result is unchanged. Details: [docs/audit/SUMMARY.md](docs/audit/SUMMARY.md).

## Data and licences

Code is MIT. Each dataset keeps its own licence ([DATA_LICENSE.md](DATA_LICENSE.md), [CREDITS.md](CREDITS.md)).
NUFORC rows have no stated licence and are **not** included; they build into the git-ignored `data/private/` for
local use. The satellite basemap uses the CC BY 4.0 EOX Sentinel‑2 cloudless **2016** vintage.

## Known limitations

- OSM military and nuclear-test-site extracts are staged (Overpass was unavailable during the build).
- The all-precision analysis and reports over very large local datasets are slow on software rendering.
- HydroLAKES below 1 km² and streamed high-zoom globe tiles are on the roadmap.

## Checks

ESLint and Prettier clean · 66 unit tests pass · data validation 0 errors · headless end-to-end smoke test passes ·
no file over 95 MB.
