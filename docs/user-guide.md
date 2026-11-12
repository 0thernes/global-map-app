# User guide

## Start

Open `index.html` (or `launch.cmd` on Windows). The boot screen shows the dataset status; press **ENGAGE** (or Enter).
ENGAGE turns on sound, asks for full screen if you launched with `?fullscreen=1`, flies in, and starts the tour if
you asked for it. Press **Esc** to skip.

## The tour (T)

Twenty steps: welcome, layers, timeline, search, dossiers, graph, analysis, reports, glossary, the state of the
dataset, the five best-sourced precise cases (with an orbit), the top three hotspots, the findings, the water/USO
caveat, what is happening now, and your turn. ←/→ or Space to move, Esc to stop. Settings (,) → _Replay tour_.

## Reading the globe

- **Pins** are exact or within 1 km. **Circles** are uncertainty areas (locality 10 km, region 100 km, or the row's own
  radius). Nothing is jittered.
- Colours follow the category legend in the Layers panel. Badges in dossiers show grade, precision, _conflict_ (sources
  disagree) and _[verify]_ (citation flagged for checking).
- Markers, circles and labels are fixed to the ground: they stay in place as you tilt, rotate or zoom, and are hidden
  behind the horizon. Labels are thinned with distance and by collision; dense areas collapse into cluster badges that
  zoom in when clicked.
- Imagery streams in tiles and sharpens as you zoom, down to street level. Drag with the right button or Ctrl to tilt;
  mountains are shown in 3D when terrain is on.
- The night side (with NASA night lights), the terminator and the glow of active wars follow the timeline date.

## Layers (L)

Groups › layers › sub-layers, each tri-state. ⓘ shows source, licence and legend. Highlights:

| Layer                     | What it shows                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off-limits mountains      | 13 off-limits, high-strangeness mountains (QWM PDF 7 G12.19 / G12.14.1.5), plus QWM's nuclear-storage table and literal "secret" place names as sub-layers. Click for source, grade, coordinate source and the computed distance to the nearest military site. |
| Unmapped seafloor         | ocean cells the GEBCO 2025 TID grid marks as not directly measured                                                                                                                                                                                             |
| HydroLAKES                | lakes ≥ 10 km² always, 1–10 km² when you zoom in; dark blue = depth modelled, not measured                                                                                                                                                                     |
| Oceanic trenches          | Wikidata trench centre points and named deeps (with depth where stated)                                                                                                                                                                                        |
| Fireballs                 | NASA JPL CNEOS fireballs and bolides, sized by impact energy                                                                                                                                                                                                   |
| USO / Satellite anomalies | water and satellite cases; off-world records are in Index › Off-world                                                                                                                                                                                          |

## Filters (F)

Category and subtype tree, grade, era, precision, country or area, water (over water, ≤ 5/25/100 km from shore),
_conflicting values only_, _citation needs verification_.

## Hotspots (Z)

Where many kinds of record meet. Choose cell size, minimum layers, top %, and whether to use the timeline window.
Click a cluster for its dossier (score breakdown, members, sources, co-occurrence). Formula: [convergence.md](convergence.md).

## Reports (E)

Pick a scope (current selection, a country, an era, a category, or everything) and **Generate**. Print/PDF or export
a standalone HTML file.

## Index (I)

Sources, glossary, A–Z, sites, countries, coverage (breadth × depth, see [TAXONOMY.md](audit/TAXONOMY.md)), off-world,
**PDF 7 index** and credits. Everything links back to the globe.

The PDF 7 index lists every entry of PDF 7 (_What Is What of the What_) that names a place on Earth, by section and
page, with its status (added, already on the map, or unplaced with the reason) and links to its map rows. Rows that come
from or match PDF 7 show **PDF 7 §x.y (p. n) · G-path** in their dossier; click it to jump to the index.

## Data (D)

Everything in PDF 7 and the QWM data that is not a place lives here, never on the globe.

- **Overview.** The counts PDF 7 states (front-matter table, figure captions, Part V taxonomy) sit next to the same
  counts recomputed from its CSVs. A mismatch is shown as a conflict, not corrected. Below that are counts by part,
  kind, placement, era, grade, section and the country of linked map rows.
- **Entries.** All 660 entries (Part I theories, Part II glitches, Part V cases), each with its section and printed
  page. Filter by part, kind or placement, and click a header to sort. **PDF year** is the year of the first source
  in PDF 7, and **map date** is the event date on the linked map row. Both are kept when they differ.
- **Charts.** The PDF 7 figures rebuilt from the CSVs. Each caption names the figure and page it reproduces.
- **PDF 7 tables.** Every table in the PDF, plus the QWM aggregate tables, as a sortable data table with its section,
  page and source line.
- **Sources.** Part V document links grouped by source type, using a host rule that is documented in
  `data/tools/pdf7_dataset.py`.
- **Stats.** Seven pre-set tests. Read the caveat column first. p-values come from seeded permutations or Fisher's
  exact test and are shown raw and Holm-adjusted. The smallest p a permutation can report is 0.0005.
- **Unplaced.** Items that have a source but no single point: multi-site waves, region-scale finds, redacted
  locations and GEIPAN cases without a commune. They are counted here so analytics do not silently lose them.

Every table has a **CSV** button that downloads the rows as shown (current sort and filter).

## Analyze (A)

Nearest military base, nuclear site and conflict event for each UAP-type case against three baselines. Read the
bias panel: correlation is not causation, and many comparisons are being made at once (a Bonferroni-adjusted threshold
is shown).

## Settings (,)

Master, music and effects volume; post effects; chromatic aberration; HUD; performance mode; reduced motion; **imagery and terrain** (Esri, Esri
hybrid, Sentinel-2 cloudless, OpenStreetMap, CARTO dark, NASA Blue Marble, NASA MODIS imagery of the timeline day,
offline; terrain from AWS Terrain Tiles, Esri, or flat); replay intro and tour. Settings are kept in your browser.

## Exports

CSV and GeoJSON of the filtered cases, Markdown or printable dossiers, reports, workspaces (JSON), screenshots.
