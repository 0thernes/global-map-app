# Pass 03: Dates

**Goal.** Dates parse, ranges are ordered, precision labels match the value, and the summary text agrees with the date field.

**Method.** ISO parsing incl. BCE, calendar validity, date_low <= date <= date_high, year-only precision with month/day, the only year in the summary vs the date field.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   0 |     5 |   188 |       0 |       0 |      179 |   372 |

## Notes

- GEIPAN-1811 is dated 2000-09-31 (no such day). Reconquista (CON-WP-12) has date_low 718 after date_high 1492 in one field order; both left for QWM to fix.

## Examples

| class    | dataset              | record                                       | finding                                                                      |
| -------- | -------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| conflict | map_missing_unsolved | MIS-atadero-1999 Death of Jaryd Atadero      | summary/date conflict: the only year in the text differs from the date field |
| conflict | map_missing_unsolved | MIS-dyatlov-1959 Dyatlov Pass incident       | summary/date conflict: the only year in the text differs from the date field |
| error    | map_conflicts        | CON-WP-12 Reconquista                        | date_low after date_high                                                     |
| error    | map_conflicts        | CON-WP-12 Reconquista                        | date outside [date_low, date_high]                                           |
| error    | map_conflicts        | CON-WP-41 Jewish–Roman wars                  | date_low after date_high                                                     |
| error    | map_conflicts        | CON-WP-41 Jewish–Roman wars                  | date outside [date_low, date_high]                                           |
| error    | map_uap_cit          | GEIPAN-1811 BACOUEL (60) 31.09.2000          | impossible calendar date                                                     |
| issue    | map_nuclear_sites    | NUC-Q1029375 Yangjiang Nuclear Power Station | date_precision says year but the date carries month/day                      |
| issue    | map_nuclear_sites    | NUC-Q1032792 Kozloduy Nuclear Power Plant    | date_precision says year but the date carries month/day                      |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 3`).
