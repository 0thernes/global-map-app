# Audit summary

Ten forensic passes over the QWM v2 drop, the built layers and the app code, run on 2026-11-12 (all times America/Los_Angeles). Every finding has exactly one class; definitions are in [TAXONOMY.md](TAXONOMY.md). Row-level findings: [qwm-data-issues.csv](qwm-data-issues.csv). Private (NUFORC) rows appear by id only.

## Findings per pass

|             pass | topic                                            |    bug |  error |    issue | problem | dilemma | conflict |    total |
| ---------------: | ------------------------------------------------ | -----: | -----: | -------: | ------: | ------: | -------: | -------: |
| [01](pass-01.md) | Sources and licences                             |      0 |      1 |        0 |      35 |       2 |        0 |       38 |
| [02](pass-02.md) | Coordinates and precision                        |      0 |     23 |      102 |     370 |       1 |        2 |      498 |
| [03](pass-03.md) | Dates                                            |      0 |      5 |      188 |       0 |       0 |      179 |      372 |
| [04](pass-04.md) | Grades and wording                               |      0 |      0 |      700 |       0 |       0 |        0 |      700 |
| [05](pass-05.md) | Identity, duplicates and cross-dataset conflicts |      3 |      1 |        0 |       0 |       0 |       90 |       94 |
| [06](pass-06.md) | Reference layers                                 |      1 |      0 |     1353 |       3 |       1 |        1 |     1359 |
| [07](pass-07.md) | Statistics                                       |      0 |      0 |        1 |       0 |       0 |        0 |        1 |
| [08](pass-08.md) | Reports, glossary and index claims               |      1 |      0 |        0 |       0 |       0 |        0 |        1 |
| [09](pass-09.md) | Code, security, performance and licences         |      3 |      0 |        2 |       0 |       0 |        0 |        5 |
| [10](pass-10.md) | UX, accessibility and end-to-end                 |      2 |      0 |        2 |       0 |       0 |        0 |        4 |
|                  | **total**                                        | **10** | **30** | **2348** | **408** |   **4** |  **272** | **3072** |

Most volume is mechanical and expected: 1,350 SIPRI yield classes (ranges, not values), 679 skeptic-wording hits inside private NUFORC narratives, 370 rows QWM keeps without coordinates, and 188 reactor dates with year precision but a full date. None of these change what is plotted; they are listed so QWM can clean them at source.

## What changed because of the audit

- Satellite close-ups used EOX s2cloudless 2023 (CC BY-NC-SA 4.0, non-commercial); switched to the 2016 vintage (CC BY 4.0) (pass 1, error).
- Wikidata P279* walk pulled 2,624 non-military items (fire lookout towers, belfries, bird hides, acropolises, churches) into the bases layer; removed by class policy (pass 2, error).
- 9,149 historic fortifications and 3,688 gendarmerie/police barracks were counted as military bases in the analysis; relabelled and excluded (pass 2, issue).
- Offlimits_mountains.csv ingested twice (notes file and data/sources snapshot): 12 duplicate rows with ~suffix ids (pass 5, bug).
- Composite grades duplicated by the QWM merge ('Official record / Official record'); collapsed, raw kept in grade_raw (pass 5, bug).
- Public rows carried values copied from private NUFORC rows via conflicts/same_as; moved to data/private/private_links.js (pass 5, bug).
- Country spot-check compared only the first word of names: 'Dem. Rep. Congo' vs 'Democratic Republic of the Congo' and territories (American Samoa vs United States) were false conflicts; now uses all Natural Earth name forms and the sovereign (pass 6, bug).
- Agreement test used only the Python Monte Carlo error; now combines both runs. Conflict pop/time p for all-precision cases differ (pooled vs paired null), borderline. Test fixed; method difference noted (pass 7, issue).
- Pass-8 regex missed glossary entries whose src is a named constant (src: POLICY) (pass 8, bug).
- Data URLs were linked without a scheme check (javascript: possible from a data file); now http(s)/mailto only (pass 9, bug).
- Unused imports (emit, on) failed ESLint (pass 9, bug).
- Briefing Markdown was only stripped of <script>; now allow-list sanitised (no handlers, styles, iframes, non-http links) (pass 9, bug).
- Smoke test opened dossiers from raw rows instead of prepared cases (window.__case added) (pass 10, bug).
- Briefing gallery captions looked up by path, not basename; captions were missing (pass 10, bug).
- With private rows loaded, slow panels stayed open and blocked later clicks in the headless run. Fixed: the test uses ?private=0 (pass 10, issue).

## The finding that matters most

The military-site layer had been built from a Wikidata subclass walk that also collected fire lookout towers, belfries and bird hides, and counted thousands of historic forts and gendarmerie barracks as bases. After the fix, the median distance from the 2,556 public UAP-type cases to the nearest military site is 16.0 km (was 2.6 km) and the population-weighted test is no longer significant (p ≈ 0.3, was 0.0002). For the 24 precisely located cases the result is unchanged (median 3.9 km, p ≈ 0.003). See [pass 7](pass-07.md).

## Open dilemmas (owner decisions)

1. **NUFORC**: NUFORC report extract (83k rows) states no licence. Default: excluded from the repo, built into git-ignored data/private/ and loaded locally only. Options: keep local-only; ask NUFORC for permission and publish with attribution; make the repo private.
2. **OSM geocodes**: some QWM coordinates come from OSM Nominatim (ODbL): publishing the compiled database triggers ODbL attribution and share-alike for that derived database. Default: attribute and note ODbL in DATA_LICENSE.md. Options: keep; re-geocode those rows from public-domain sources (GNIS, GeoNames CC BY).
3. **military**: whether gendarmerie, Guardia Civil and Carabinieri barracks count as military sites (they are military-status police). Default: shown, labelled, excluded from analysis and hotspots. This choice moves the all-case military result (pass 7).
4. **map_nuclear_tests**: 2048 SIPRI rows are region precision: their DD.MM-style values could be converted to decimal degrees only if verified against SIPRI; not converted (no verifiable copy). Options: keep region (current) / request SIPRI originals / convert with an ERROR-log entry per row

## Still open

- OSM military extract not merged (Overpass 502s); bases layer is MIRTA + Wikidata only. (staged) (pass 1, problem)
- OSM nuclear test site layer is empty (Overpass unavailable during the build); layer shows 0 rows. (staged) (pass 1, problem)
- All-precision analysis (~2.5k cases, time permutation on 114k GED events) takes minutes under software WebGL; run on demand, iterations capped. (pass 9, issue)
- Report generation with 83k local private rows took ~16 s headless; smoke test runs with ?private=0. (pass 9, issue)
- HUD reticle marks the screen centre, while camera flights centre the target in the free area right of the docked Layers panel (~100 px apart at 1600 px). (pass 10, issue)
- QWM data corrections listed as error, issue, problem and conflict rows in the CSV (QWM owns the source files; nothing was edited in place).

## Reproduce

```bash
python3 scripts/audit/check_urls.py            # pass 1 liveness (slow, polite)
python3 scripts/audit/forensics.py             # passes 1-6, 8 + recorded code findings
node scripts/audit/dump_analysis.mjs /tmp/analysis.json && node scripts/audit/dump_analysis.mjs /tmp/analysis_all.json all
python3 scripts/audit/stats_crosscheck.py /tmp/analysis.json /tmp/analysis_all.json > docs/audit/pass-07-data.json
node scripts/coverage.mjs && python3 scripts/audit/write_passes.py
```
