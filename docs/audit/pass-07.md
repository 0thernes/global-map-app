# Pass 07: Statistics

**Goal.** The analysis numbers in the app are re-derived independently in Python from the same data.

**Method.** scripts/audit/dump_analysis.mjs runs the in-app analysis headlessly and dumps per-case distances and baselines; scripts/audit/stats_crosscheck.py recomputes nearest distances with numpy, medians, Wilson intervals and Monte Carlo p values.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   0 |     0 |     1 |       0 |       0 |        0 |     1 |

## Independent re-derivation

| run | reference | pairs | max |Δ| km | median py / js (km) | Monte Carlo p (py / js / agree) |
|---|---|---:|---:|---|---|
| analysis.json (n=24) | military | 24 | 0.0 | 3.88 / 3.88 | uniform 0.0002 / 0.001 / yes; pop 0.003 / 0.002 / yes |
| analysis.json (n=24) | nuclear | 24 | 0.2913 | 92.62 / 92.62 | uniform 0.0002 / 0.001 / yes; pop 0.0128 / 0.022 / yes; time 0.5316 / 0.522 / yes |
| analysis.json (n=24) | conflict | 9 | 0.0 | 1371.8 / 1371.8 | uniform 0.8176 / 0.809 / yes; pop 0.9254 / 0.938 / yes; time 0.8462 / 0.846 / yes |
| analysis_all.json (n=2556) | military | 2556 | 0.0 | 16.03 / 16.03 | uniform 0.0002 / 0.01 / yes; pop 0.2922 / 0.31 / yes |
| analysis_all.json (n=2556) | nuclear | 2556 | 0.7771 | 59.52 / 59.52 | uniform 0.0002 / 0.01 / yes; pop 0.0002 / 0.01 / yes; time 0.5044 / 0.55 / yes |
| analysis_all.json (n=2556) | conflict | 1844 | 0.0 | 551.11 / 551.11 | uniform 0.0002 / 0.01 / yes; pop 0.541 / 0.48 / yes; time 0.2976 / 0.51 / yes |

Observed nearest distances agree pair for pair (max difference under 1 km, from the spatial index cell edge), medians agree exactly, and Wilson intervals agree. For the all-precision run the JS used 99 iterations, so its p values have about ±0.05 Monte Carlo error. Python resamples i.i.d. from the pooled JS null; for the paired population and date-permutation nulls that approximation is narrower, which explains the borderline conflict/time p.

## Notes

- **Material change from the military class policy (pass 2).** For all 2,556 public UAP-type cases (any precision), the median distance to the nearest military site rose from 2.6 km to 16.0 km once fire lookouts were removed and historic forts and gendarmerie barracks were excluded, and the population-weighted p went from 0.0002 to about 0.3. The earlier 'very close to military sites' result for the public report databases was an artefact of gendarmerie barracks in almost every French commune (GEIPAN rows are geocoded to communes). For the 24 exact or within-1 km cases the result is unchanged (median 3.9 km, population-weighted p ≈ 0.003).
- Correlation is not causation; the analysis panel repeats this, shows its baselines and a Bonferroni-adjusted threshold.

## Examples

| class | dataset             | record              | finding                                                                                                                                                                                              |
| ----- | ------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| issue | stats_crosscheck.py | stats_crosscheck.py | agreement test used only the Python Monte Carlo error; now combines both runs. Conflict pop/time p for all-precision cases differ (pooled vs paired null), borderline. FIXED (test) / NOTED (method) |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 7`).
