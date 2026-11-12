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
