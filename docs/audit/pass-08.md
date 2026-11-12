# Pass 08: Reports, glossary and index claims

**Goal.** Every glossary term and report claim traces to a field or a cited source.

**Method.** Every glossary entry needs a URL or a document reference; report sections are generated only from record fields (src/report_gen.js, unit-tested).

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   1 |     0 |     0 |       0 |       0 |        0 |     1 |

## Notes

- All glossary terms carry a source (URL or document).

## Examples

| class | dataset      | record       | finding                                                                                 |
| ----- | ------------ | ------------ | --------------------------------------------------------------------------------------- |
| bug   | forensics.py | forensics.py | pass-8 regex missed glossary entries whose src is a named constant (src: POLICY). FIXED |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 8`).
