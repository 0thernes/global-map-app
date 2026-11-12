# Convergence hotspots

Press **Z** (or the hotspot button in the top bar). The app divides the globe into cells and asks, for each cell:
_how many different kinds of strange, military, nuclear, conflict, water and sky records meet here, how strong are
they, and is that more than the local population would explain?_ Implementation: `src/convergence.js` (pure,
unit-tested) and `src/ui_hotspots.js` (panel, globe overlay, dossier).

## Inputs

- Every visible case (after filters), weighted by grade and coordinate precision.
- Reference layers: military (forts, historic fortifications and gendarmerie barracks excluded), reactors, nuclear sites and tests, UCDP conflict events, volcanoes, fireballs, lakes, trenches,
  pyramids, megaliths, caves, ocean anomalies, off-limits mountains, ancient cities, weird coordinates.
- One "unmapped seafloor" pseudo-record per cell where the GEBCO 2025 TID grid says the seafloor was never directly
  measured.
- Zero-weight rows (Greer, Maussan) are listed in the dossier but add nothing to the score.

## Score

```
record weight      w   = G(grade) × P(precision)           reference rows: G = 0.5
layer contribution c_g = ln(1 + Σ w over that layer group's records in the cell)
diversity          D   = number of different layer groups present
raw score          R   = D × Σ_g c_g
population factor  F   = √(1 + pop_cell / pop_ref)          pop_cell = GeoNames cities ≥ 15k in the cell
score              S   = R / F
```

G: CIT 1, Official record 0.8, ST 0.6, Testimony 0.3, Online claim 0.1, other 0.2.
P: exact_site and within_1km 1, locality 0.7, region 0.3, unspecified 0.2.

Clusters are connected cells with D ≥ _min layers_ and S above the chosen percentile. Controls: cell size (50–400 km),
minimum layers, top %, and a time window (only records inside the timeline window count).

## Evidence grade of a cluster

```
E = 0.5 × strong + 0.3 × precise + 0.2 × min(1, sources / 5)
A ≥ 0.75 · B ≥ 0.60 · C ≥ 0.45 · D ≥ 0.30 · E ≥ 0.15 · else F
```

strong = share of case records graded CIT or Official record; precise = share with exact or ≤ 1 km coordinates;
sources = distinct source domains.

## Naming

A cluster is named after the nearest city ≥ 15,000 people within 150 km, else its most prominent member, else the
country or ocean.

## Reading it honestly

A hotspot says _several kinds of record share a place_. It does not say one causes another. Military bases, nuclear
sites and UAP reports all cluster where people, airspace and reporting exist; the population factor reduces but does not
remove that. The cluster dossier shows the score breakdown, co-occurrence within ±1 year, every source, and this note.
For a statistical test against baselines, use **Analyze (A)**.
