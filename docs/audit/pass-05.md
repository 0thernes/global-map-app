# Pass 05: Identity, duplicates and cross-dataset conflicts

**Goal.** Ids are unique, the same event in two datasets is linked, and every disagreement is kept with both values.

**Method.** Duplicate ids within a file; same event across datasets by name or same day within 300 km; field-by-field comparison of date, lat, lon, precision, grade, category.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   3 |     1 |     0 |       0 |       0 |       90 |    94 |

## Notes

- NT-74044 is used for two different tests (PINEDROPS 1974-01-10 and TAUREAU 1974-08-24): an error in the QWM file, tolerated by the validator as a known duplicate.
- Cross-dataset conflicts are shown in dossiers with both values and a conflict badge; nothing is silently merged.

## Examples

| class    | dataset              | record                                                              | finding                                                                                                                         |
| -------- | -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| bug      | build_data.py        | build_data.py                                                       | offlimits_mountains.csv ingested twice (notes file and data/sources snapshot): 12 duplicate rows with ~suffix ids. FIXED        |
| bug      | build_data.py        | build_data.py                                                       | composite grades duplicated by the QWM merge ('Official record / Official record'); collapsed, raw kept in grade_raw. FIXED     |
| bug      | build_data.py        | build_data.py                                                       | public rows carried values copied from private NUFORC rows via conflicts/same_as; moved to data/private/private_links.js. FIXED |
| conflict | map_abductions       | ABD-hill-1961 Betty and Barney Hill abduction                       | cross-dataset conflict on category: shown with both values and a conflict badge                                                 |
| conflict | map_abductions       | ABD-walton-1975 Travis Walton abduction                             | cross-dataset conflict on category: shown with both values and a conflict badge                                                 |
| conflict | map_missing_unsolved | MIS-valentich-1978 Frederick Valentich disappearance                | cross-dataset conflict on lat: shown with both values and a conflict badge                                                      |
| conflict | map_missing_unsolved | MIS-valentich-1978 Frederick Valentich disappearance                | cross-dataset conflict on lon: shown with both values and a conflict badge                                                      |
| conflict | map_uap_cit          | GEIPAN-1027 TRANS-EN-PROVENCE (83) 08.01.1981                       | cross-dataset conflict on grade: shown with both values and a conflict badge                                                    |
| conflict | map_uap_cit          | UAP-PDF7-aguadilla-2013 Aguadilla thermal object (25/26 April 2013) | cross-dataset conflict on lat: shown with both values and a conflict badge                                                      |
| conflict | map_uap_cit          | UAP-PDF7-aguadilla-2013 Aguadilla thermal object (25/26 April 2013) | cross-dataset conflict on lon: shown with both values and a conflict badge                                                      |
| conflict | map_uap_cit          | UAP-PDF7-aguadilla-2013 Aguadilla thermal object (25/26 April 2013) | cross-dataset conflict on coord_precision: shown with both values and a conflict badge                                          |
| conflict | map_uap_cit          | UAP-PDF7-aguadilla-2013 Aguadilla thermal object (25/26 April 2013) | cross-dataset conflict on coord_precision: shown with both values and a conflict badge                                          |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 5`).
