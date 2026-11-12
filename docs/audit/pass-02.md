# Pass 02: Coordinates and precision

**Goal.** Coordinates are in range, on the right side of the coast and border, and as precise as the precision label claims.

**Method.** Natural Earth 10m admin-0 point-in-polygon, admin-1 centroid proximity, decimal-place step vs claimed precision, repeated precise points shared by differently named rows.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   0 |    23 |   102 |     370 |       1 |        2 |   498 |

## Notes

- Military layer: the Wikidata subclass walk had pulled in fire lookout towers, belfries and bird hides, and counted 9k historic forts and 3.7k gendarmerie barracks as bases. Fixed with a class policy (data/tools/military_class_policy.json); this changes the military analysis numbers.
- 'Missing coordinates' rows (329 in map_uap_cit, 39 in map_conflicts, 2 elsewhere) are kept by QWM for completeness; they are not plotted.
- Off-limits mountains: 5 rows use coord_precision 'installation' (not in the schema) and are drawn as 25 km circles until QWM relabels them.

## Examples

| class    | dataset                           | record                                                                     | finding                                                                                                                                                                                                                      |
| -------- | --------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| conflict | map_offlimits_mountains           | LIT-096 Secret Harbor Beach                                                | country conflict: point lies in U.S. Virgin Is. (VI) per Natural Earth 10m, 1878 km from the stated country US (a territory of the same sovereign)                                                                           |
| conflict | map_offlimits_mountains           | NUC-005 Naval museum complex Balaklava (Object 825 GTS, Mount Tavros)      | country conflict: point lies in Russia (RU) per Natural Earth 10m, 172 km from the stated country UA                                                                                                                         |
| dilemma  | military                          | military                                                                   | whether gendarmerie, Guardia Civil and Carabinieri barracks count as military sites (they are military-status police). Default: shown, labelled, excluded from analysis and hotspots. This choice moves the all-case militar |
| error    | map_ancient_cities_remote_sensing | RS-aguada-fenix Aguada Fénix monumental platform                           | precision mismatch: 1 decimal(s) (≥5 km step) marked within_1km                                                                                                                                                              |
| error    | map_conflicts                     | CON-UCDP-11706 FPRC - Civilians                                            | precision mismatch: 1 decimal(s) (≥5 km step) marked exact_site                                                                                                                                                              |
| error    | map_conflicts                     | CON-UCDP-4902 Hindus (India) - Muslims (India)                             | precision mismatch: 0 decimal(s) (≥5 km step) marked exact_site                                                                                                                                                              |
| error    | map_conflicts                     | CON-UCDP-540 LeJ - Civilians                                               | precision mismatch: 0 decimal(s) (≥5 km step) marked exact_site                                                                                                                                                              |
| error    | military                          | military                                                                   | Wikidata P279* walk pulled 2,624 non-military items (fire lookout towers, belfries, bird hides, acropolises, churches) into the bases layer; removed by class policy. FIXED                                                  |
| issue    | map_caves_underground             | CAVE-hypogeum Ħal Saflieni Hypogeum                                        | admin-1 centroid-looking coordinate: within 0.005° of Paola but marked within_1km                                                                                                                                            |
| issue    | map_caves_underground             | CAVE-kola-borehole Kola Superdeep Borehole ("well to hell" legend)         | precision mismatch: 2 decimals (~1.1 km step) marked exact_site                                                                                                                                                              |
| issue    | map_caves_underground             | EGY-big-void Great Pyramid "Big Void" (ScanPyramids muon scan)             | repeated coordinate: 3 differently named precise rows share this point (geocoder default?)                                                                                                                                   |
| issue    | map_caves_underground             | EGY-north-face-corridor Great Pyramid North Face Corridor (confirmed 2023) | repeated coordinate: 3 differently named precise rows share this point (geocoder default?)                                                                                                                                   |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 2`).
