# Global Map: wireframes

Rendered images live in `docs/wireframes/*.png` (from the SVGs next to them; regenerate with `python docs/make_wireframes.py`).

## 1. Main console

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◉ GLOBAL MAP   [/ search everything…………………]   investigation ▾  ⤓  ?      │ top bar 56px
├────────────┬──────────────────────────────────────────────┬─────────────────┤
│ LAYERS (L) │                                              │ DOSSIER         │
│ ☑ Cases    │                                              │ (opens on click,│
│ ☑ Conflict │                 3D GLOBE                     │  Esc closes)    │
│ ☐ Military │        (center is never covered;             │                 │
│ … opacity  │         panels dock to edges)                │                 │
│ FILTERS    │                                              │                 │
│ category   │                                              │                 │
│ grade/era  │                                              │                 │
│ country    │                                              │                 │
├────────────┴──────────────────────────────────────────────┴─────────────────┤
│ ▶  −Y −M −D [1900 ▁▂▁▃█▁▂ ●━━━━━━━━ 2026] +D +M +Y  1976-09-19 12:00 UTC   │ timeline 112px
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Dossier (right panel)

Kicker (category, grade badge, precision badge) → title → date/place/coords → narrative fields → sources → related → nearby reference sites → mini timeline → export (Markdown / printable HTML).

## 3. Link graph (G)

Right half: force-directed graph of entities (case, person, site, source, place). Edges only from real fields: shared witness surname, shared source domain, proximity ≤ X km, co-occurrence within ±N days. Hover an edge to see its reason; clicking a node selects it on the globe and vice versa.

## 4. Compare (C)

Swipe divider (drag) or split view; each side has its own date and layer set (layer manager shows A/B/A+B selectors).

## 5. Hypothesis analysis

Analyze drawer: options (exact/≤1 km only, window, iterations, seed) → per-reference tables (observed vs uniform-land / population-weighted / time-matched) with ratio, p, CI, histograms → breakdown by country/decade → bias panel → CSV export. Banner: "Correlation, not causation; baseline assumptions shown."

## 6. Briefings (B)

Renders `analysis_summary.md` and its PNG figures from `/workspace/qwm/wiw/data/map/` (copied into `data/briefings/` by `build_data.py`).

## Keyboard (as implemented)

`/` search · `Space` play/pause · `←/→` ±1 day (Shift: month, Alt: year) · `L` layers · `F` filters · `G` graph · `C` compare · `A` analyze · `V` charts · `W` wars list · `B` briefings · `S` lasso · `H` heatmap · `R` random case · `P` FPS meter · `Esc` close · `?` help

Note: the timeline in the shipped build is segmented (8000 BCE-1 CE, 1-1500, 1500-1900 compressed; 1900-2026 at day resolution), superseding the 1900-2026 bar sketched in the wireframes.

## 7. Boot and ENGAGE

```
┌──────────────────────────────────────────────────────────────┐
│                     (starfield, slow drift)                  │
│              [ HIGH STRANGENESS // SOURCED ]                 │
│                        G L O B A L                           │
│                           M A P                              │
│        2,593 sourced cases · 29 exact · 62 source domains    │ typed status lines from loaded data
│                    ┌──────────────┐                          │
│                    │   ENGAGE     │  Enter                   │ unlock audio, fullscreen, fly-in, tour
│                    └──────────────┘                          │
│          [Explore without the tour]   [Skip (Esc)]           │
└──────────────────────────────────────────────────────────────┘
```

## 8. Tour and lower third

```
┌ HUD corners ───────────────────────────────────── 37.18°N 115.84°W ┐
│                         (camera orbit)                              │
│  ┌──────────────────────────────────────────────┐                   │
│  │ 05 / 20  DOSSIERS                            │  ← → Space Esc    │ lower third, typed caption
│  │ caption built from the record's fields       │                   │
│  └──────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────── 2026-11-11 ┘
```

## 9. Hotspots (Z), Reports (E), Index (I), Settings (,)

- **Hotspots:** right panel with controls (cell size, min layers, top %, window) and the ranked list (evidence grade
  badge, layer glyphs, record count, score). Clicking opens the cluster dossier on the left (score by layer, E formula,
  co-occurrence, members, sources). Circles and labels on the globe.
- **Reports:** scope picker (selection, country, era, category, all) → paper-style document (summary, charts, tables,
  sources) → Print/PDF, Export HTML.
- **Index:** tabs Sources · Glossary · A–Z · Sites · Countries · Coverage · Off-world · Credits, with search; every
  entry links to the globe or a dossier.
- **Settings:** audio sliders, effects, chromatic aberration, HUD, performance, reduced motion, satellite basemap,
  replay intro, replay tour.

Screenshots of the shipped screens: [docs/screenshots](screenshots/).
