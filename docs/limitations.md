# Limitations and threats to validity

Global Map shows where sourced records say things happened. It does not show where things happen. Read every map,
chart, hotspot and p-value with the limits below in mind. The app shows the same caveats next to the numbers they
affect (Analyze bias panel, Data panel caveat column, dossier source rows).

## What the case set is

- **One national archive dominates.** 2,454 of the 2,624 plotted cases (94 %) are GEIPAN (CNES) reports from France
  and its overseas territories. Any map of "where cases are" is mostly a map of where GEIPAN collects reports. Filter by
  dataset before comparing countries or continents.
- **Curated rows are a selection.** The PDF 7 and curated layers were chosen by people, for interest. They are not a
  sample of anything, so their counts cannot be compared with each other or with GEIPAN.
- **Private data is left out.** NUFORC is built only into the git-ignored `data/private/` folder, so public results
  never include it, and results run with it are not reproducible from the repository.

## Reporting bias

Reports come from where people, sensors and reporting channels are. Cities, airports, coasts, military bases and
conflict zones have more observers, more radar and more official paperwork. Proximity to a base or a nuclear site can
partly reflect who was there to see and report. The Analyze panel's population-weighted baseline is a partial control
for observer density; it does not model sensor coverage, secrecy, language or the existence of a reporting body.

## Geocoding and precision

- Most case coordinates are a **commune or town centre** (`coord_precision = locality`, 10 km circle), not the
  sighting site. Only `exact_site` and `within_1km` rows are drawn as pins, and Analyze can be limited to them.
- Distances such as `nearest_military_site_km` are measured from the published point, so for a locality row they can
  be wrong by about the circle radius.
- A French commune centre near a border can fall just outside France in the Natural Earth 10m boundaries (21 GEIPAN
  rows geocode to Belgium, Switzerland, Luxembourg, Monaco or an overseas territory code). The source commune and its
  INSEE code are kept in `coord_source`.
- Points on the Antarctic ice shelf may get no continent, because Natural Earth land polygons exclude ice shelves.
- Several records can share one coordinate (a commune centre). They are stacked, never jittered.

## Dates

- Year- and month-precision dates are stored on the 1st of the period; check `date_precision` before reading a day.
- The timeline ends at a fixed day (`NDAYS`); a unit test fails if any case falls after it.
- BCE dates use astronomical year numbering (`-0011` = 12 BCE).

## Reference layers

- Military sites combine MIRTA, Wikidata, OSM and QWM seeds. Coverage outside the US and Europe is thinner, and
  closed or secret sites are missing by nature. Gendarmerie and fort rows are shown but excluded from every analysis.
- Wikidata rows whose dissolution date is "unknown value" are shown with status `dissolved (date unknown in Wikidata)`
  and are counted as active in analysis, because the date they closed is not known.
- Conflict layers (UCDP GED v25.1, COW and the genocide list) count recorded deaths; under-recording varies by country
  and decade.

## Statistics

- Every test is **observational**. Correlation is not causation, and confounders (population, coastline, military
  presence near borders and coasts) are not modelled beyond the baselines shown.
- **Multiple comparisons.** Analyze runs many baseline tests at once and prints the Bonferroni threshold; the Data panel
  battery reports Holm-adjusted p-values. Treat any single p near 0.05 as noise.
- p-values come from seeded Monte Carlo or permutation runs; the smallest reportable p is 1/(iterations + 1) (the exact 2×2 tests excepted). Rerunning
  with the same seed gives the same numbers; a different seed gives slightly different ones.
- USO (water) rows are confounded with naval activity: many were reported by ship and aircraft crews.
- Hotspot scores weight rows by grade (see [data-and-grading.md](data-and-grading.md#grades)). The weights are a
  house policy, not an estimate of truth.

## What the app does not do

It does not verify claims, rank witnesses' honesty, geocode free text at run time, or fill in missing values. Blank
means the source did not say.
