# User guide

## Start

Open `index.html` (or `launch.cmd` on Windows). The boot screen shows the dataset status; press **ENGAGE** (or Enter).
ENGAGE turns on sound, asks for full screen if you launched with `?fullscreen=1`, flies in, and starts the tour if
you asked for it. Press **Esc** to skip.

## The tour (T)

Twenty steps: welcome, layers, timeline, search, dossiers, graph, analysis, reports, glossary, the state of the
dataset, the five best-sourced precise cases (with an orbit), the top three hotspots, the findings, the water/USO
caveat, what is happening now, and your turn. ←/→ or Space to move, Esc to stop. Settings (,) → *Replay tour*.

## Reading the globe

- **Pins** are exact or within 1 km. **Circles** are uncertainty areas (locality 10 km, region 100 km, or the row's own
  radius). Nothing is jittered.
- Colours follow the category legend in the Layers panel. Badges in dossiers show grade, precision, *conflict* (sources
  disagree) and *[verify]* (citation flagged for checking).
- The night side, the terminator and the glow of active wars follow the timeline date.

## Layers (L)

Groups › layers › sub-layers, each tri-state. ⓘ shows source, licence and legend. Highlights:

| Layer | What it shows |
|---|---|
| Off-limits mountains | 13 off-limits, high-strangeness mountains (QWM PDF 7 G12.19 / G12.14.1.5), plus QWM's nuclear-storage table and literal "secret" place names as sub-layers. Click for source, grade, coordinate source and the computed distance to the nearest military site. |
| Unmapped seafloor | ocean cells the GEBCO 2025 TID grid marks as not directly measured |
| HydroLAKES | lakes ≥ 10 km² always, 1–10 km² when you zoom in; dark blue = depth modelled, not measured |
| Oceanic trenches | Wikidata trench centre points and named deeps (with depth where stated) |
| Fireballs | NASA JPL CNEOS fireballs and bolides, sized by impact energy |
| USO / Satellite anomalies | water and satellite cases; off-world records are in Index › Off-world |

## Filters (F)

Category and subtype tree, grade, era, precision, country or area, water (over water, ≤ 5/25/100 km from shore),
*conflicting values only*, *citation needs verification*.

## Hotspots (Z)

Where many kinds of record meet. Choose cell size, minimum layers, top %, and whether to use the timeline window.
Click a cluster for its dossier (score breakdown, members, sources, co-occurrence). Formula: [convergence.md](convergence.md).

## Reports (E)

Pick a scope (current selection, a country, an era, a category, or everything) and **Generate**. Print/PDF or export
a standalone HTML file.

## Index (I)

Sources, glossary, A–Z, sites, countries, coverage (breadth × depth, see [TAXONOMY.md](audit/TAXONOMY.md)), off-world
and credits. Everything links back to the globe.

## Analyze (A)

Nearest military base, nuclear site and conflict event for each UAP-type case against three baselines. Read the
bias panel: correlation is not causation, and many comparisons are being made at once (a Bonferroni-adjusted threshold
is shown).

## Settings (,)

Master, music and effects volume; post effects; chromatic aberration; HUD; performance mode; reduced motion; satellite
basemap; replay intro and tour. Settings are kept in your browser.

## Exports

CSV and GeoJSON of the filtered cases, Markdown or printable dossiers, reports, workspaces (JSON), screenshots.
