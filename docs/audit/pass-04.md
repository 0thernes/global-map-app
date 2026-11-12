# Pass 04: Grades and wording

**Goal.** Grades follow the house rules (Hastings and Pasulka = CIT, ST = experiencers, Official record = archives, Greer/Maussan = zero weight) and summaries carry no skeptic boilerplate.

**Method.** Regex over grade, source and summary fields; the v1 build is compared so that no grade goes down.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   0 |     0 |   700 |       0 |       0 |        0 |   700 |

## Notes

- 679 skeptic-wording hits are all in private NUFORC narratives (not published). Nothing was edited; the rule is applied by QWM.
- 5 Hastings/Pasulka rows not yet graded CIT; 4 ST grades on archival sources; 3 Greer/Maussan rows (zero weight in the app). Grades were not lowered anywhere.

## Examples

| class | dataset                 | record                                                             | finding                                                                                                        |
| ----- | ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| issue | map_abductions          | ABD-allagash-1976 Allagash abductions (Eagle Lake)                 | ST on an archival/official source: rule says ST is for experiencers, Official record for archives              |
| issue | map_abductions          | ABD-cahill-1993 Kelly Cahill abduction (Narre Warren North)        | ST on an archival/official source: rule says ST is for experiencers, Official record for archives              |
| issue | map_satellite_anomalies | SAT-blair-cuspids Blair Cuspids (Lunar Orbiter 2, Nov 1966)        | citation needs verification ([verify] tag); shown with a badge in the app                                      |
| issue | map_satellite_anomalies | SAT-ceres-spots Bright spots in Occator crater, Ceres (Dawn, 2015) | citation needs verification ([verify] tag); shown with a badge in the app                                      |
| issue | map_uap_cit             | NUFORC-S10017                                                      | skeptic boilerplate wording in summary (rule: none); not edited                                                |
| issue | map_uap_cit             | NUFORC-S10215                                                      | skeptic boilerplate wording in summary (rule: none); not edited                                                |
| issue | map_uap_cit             | NUFORC-S15439                                                      | Greer/Maussan-linked row: rule is zero weight (the app applies weight 0 in hotspots; grade left as-is for QWM) |
| issue | map_uap_cit             | NUFORC-S23532                                                      | Hastings/Pasulka source not graded CIT (rule update: both count as CIT)                                        |
| issue | map_uap_cit             | NUFORC-S27240                                                      | Hastings/Pasulka source not graded CIT (rule update: both count as CIT)                                        |
| issue | map_uap_cit             | NUFORC-S74224                                                      | Greer/Maussan-linked row: rule is zero weight (the app applies weight 0 in hotspots; grade left as-is for QWM) |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 4`).
