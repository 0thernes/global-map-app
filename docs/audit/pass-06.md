# Pass 06: Reference layers

**Goal.** Reference layers (military, nuclear, volcanoes, conflicts, nuclear tests) are spot-checked against their sources and against published reference values.

**Method.** Random samples (seed 2026) of 50 military, 50 nuclear, 30 volcano and 30 conflict rows checked for country and source; 10 famous nuclear tests checked against published dates, yields and corrected hypocentres.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   1 |     0 |  1353 |       3 |       1 |        1 |  1359 |

## Notes

- Nuclear tests: Trinity, Little Boy, Fat Man, RDS-1, Ivy Mike, Hurricane, Castle Bravo and Tsar Bomba match the published references. Gerboise Bleue carries a yield class '0-200' vs the published 70 kt (conflict).
- 1,350 SIPRI yields are yield classes (ranges), not values; the app shows them as ranges and sizes markers by the upper bound.
- Three dates differ by one day because SIPRI lists GMT (e.g. Little Boy 1945-08-05 GMT = 08-06 local).

## Examples

| class    | dataset           | record                       | finding                                                                                                                                                                                                                      |
| -------- | ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bug      | forensics.py      | forensics.py                 | country spot-check compared only the first word of names: 'Dem. Rep. Congo' vs 'Democratic Republic of the Congo' and territories (American Samoa vs United States) were false conflicts; now uses all Natural Earth name fo |
| conflict | map_nuclear_tests | NT-60001 GERBOISE BLEUE      | yield differs from the published reference value by >15%                                                                                                                                                                     |
| dilemma  | map_nuclear_tests | SIPRI DD.MM coordinates      | 2048 SIPRI rows are region precision: their DD.MM-style values could be converted to decimal degrees only if verified against SIPRI; not converted (no verifiable copy). Options: keep region (current) / request SIPRI orig |
| issue    | map_nuclear_tests | NT-45002 LITTLEBOY           | date is one day off the local-time date (SIPRI lists GMT); not an error, but captions should say GMT                                                                                                                         |
| issue    | map_nuclear_tests | NT-51012 ABLE                | yield is a SIPRI yield-class range, not a value                                                                                                                                                                              |
| issue    | map_nuclear_tests | NT-52010 MIKE                | date is one day off the local-time date (SIPRI lists GMT); not an error, but captions should say GMT                                                                                                                         |
| issue    | map_nuclear_tests | NT-54013 USSR test 54013     | yield is a SIPRI yield-class range, not a value                                                                                                                                                                              |
| problem  | conflicts (QWM)   | Deccan wars                  | spot-check: no coordinates                                                                                                                                                                                                   |
| problem  | military          | Fort Bragg                   | spot-check: missing url                                                                                                                                                                                                      |
| problem  | military          | Davis-Monthan Air Force Base | spot-check: missing url                                                                                                                                                                                                      |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 6`).
