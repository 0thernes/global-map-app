# Pass 01: Sources and licences

**Goal.** Every plotted row has an http(s) source; every dataset has a licence we can honour; cited URLs answer.

**Method.** scripts/audit/forensics.py (missing source_url per QWM file), scripts/audit/check_urls.py (HEAD/GET every cited URL, polite per-domain rate limit, Wayback lookup for failures), licence review of every dataset in CREDITS.md.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   0 |     1 |     0 |      35 |       2 |        0 |    38 |

## URL liveness

1483 distinct cited URLs checked (live 1450, blocked 20, unreachable 8, server-error 4, http-405 1). 'blocked' (401/403/429) is bot protection, not evidence a page is gone. 11 dead or unreachable URLs have a Wayback Machine copy, offered as the alternate link in the app. Full list: [url_status.csv](url_status.csv).

## Notes

- Rows without a source are not plotted (sourced rows only); QWM should add the citations: 13 USO (water) rows, 7 satellite-anomaly Earth rows, and 13 rows of the nuclear-storage table in offlimits_mountains.csv (NUC-001 to NUC-014 except NUC-006). All 13 off-limits mountains themselves are sourced and plotted.
- EOX: only the 2016 s2cloudless vintage is CC BY 4.0. The 2018+ vintages are CC BY-NC-SA and cannot be used by a company; the app now uses 2016 only.
- NUFORC: no licence stated. Kept local-only (see the dilemma in SUMMARY.md).

## Examples

| class   | dataset                 | record                                                                          | finding                                                                                                                                                                                                                      |
| ------- | ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dilemma | NUFORC                  | NUFORC                                                                          | NUFORC report extract (83k rows) states no licence. Default: excluded from the repo, built into git-ignored data/private/ and loaded locally only. Options: keep local-only; ask NUFORC for permission and publish with attr |
| dilemma | OSM geocodes            | OSM geocodes                                                                    | some QWM coordinates come from OSM Nominatim (ODbL): publishing the compiled database triggers ODbL attribution and share-alike for that derived database. Default: attribute and note ODbL in DATA_LICENSE.md. Options: kee |
| error   | EOX imagery             | EOX imagery                                                                     | satellite close-ups used EOX s2cloudless 2023 (CC BY-NC-SA 4.0, non-commercial); switched to the 2016 vintage (CC BY 4.0). FIXED                                                                                             |
| problem | map_offlimits_mountains | NUC-001 KUMMSC (Kirtland Underground Munitions Maintenance and Storage Complex) | no source_url: row is not plotted (sourced rows only); QWM to add the citation                                                                                                                                               |
| problem | map_offlimits_mountains | NUC-002 Clarksville Base (Fort Campbell)                                        | no source_url: row is not plotted (sourced rows only); QWM to add the citation                                                                                                                                               |
| problem | military                | military                                                                        | OSM military extract not merged (Overpass 502s); bases layer is MIRTA + Wikidata only. OPEN (staged)                                                                                                                         |
| problem | nuclear_osm             | nuclear_osm                                                                     | OSM nuclear test site layer is empty (Overpass unavailable during the build); layer shows 0 rows. OPEN (staged)                                                                                                              |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 1`).
