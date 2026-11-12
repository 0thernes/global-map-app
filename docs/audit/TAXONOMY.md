# Taxonomy: breadth, depth, layers of layers, and finding classes

This file defines the words the audit and the in-app **Index › Coverage** tab use. The same definitions are
implemented in `src/coverage.js` (tested in `test/unit/reports.test.mjs`) and rendered by `scripts/coverage.mjs`
into [coverage.md](coverage.md).

## BREADTH: how far a layer reaches

Breadth asks _how much of the world and of history does this layer touch?_

```
B = 0.45 · countryShare + 0.25 · min(1, decades / 30) + 0.30 · min(1, distinctSources / 20)
```

| Term            | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| countryShare    | distinct ISO countries or areas with at least one row ÷ 249 (ISO 3166-1 total) |
| decades         | distinct calendar decades with at least one dated row (30 decades = 1726–2026) |
| distinctSources | distinct source domains (host of `source_url`)                                 |

## DEPTH: how much each row tells you

Depth asks _for the rows we have, how complete, precise, well graded and corroborated are they?_

```
D = 0.30 · completeness + 0.25 · precise + 0.25 · gradeStrength + 0.10 · corroboration + 0.10 · witnesses
```

| Term          | Meaning                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| completeness  | share of the 12 core fields filled: name, date, lat, lon, coord_precision, coord_source, country, category, subtype, summary, source_url, grade            |
| precise       | share of rows with `coord_precision` = `exact_site` or `within_1km` (the only rows that get a sharp pin)                                                   |
| gradeStrength | mean over graded rows of CIT = 1, Official record = 0.8, ST = 0.6, Testimony = 0.3, Online claim = 0.1, other = 0.2; zero-weight rows (Greer, Maussan) = 0 |
| corroboration | min(1, 2 × (mean records per case − 1)), where records per case = 1 + its `same_as` links to other datasets                                                |
| witnesses     | share of rows with a witness count > 0 or named witnesses                                                                                                  |

The coverage panel also reports _graded_ (share of rows with any grade) and _live_ (share of cited URLs that
answered in the URL audit) beside the index; they are not part of D.

## Coverage profiles

| Profile            | Rule                  | Reading                                                                 |
| ------------------ | --------------------- | ----------------------------------------------------------------------- |
| wide but shallow   | B ≥ 0.35 and D < 0.40 | many places and decades, thin rows (typical of public report databases) |
| deep but narrow    | B < 0.20 and D ≥ 0.50 | few places, rich well-sourced rows (typical of curated case files)      |
| wide and deep      | B ≥ 0.35 and D ≥ 0.50 | the goal                                                                |
| narrow and shallow | B < 0.20 and D < 0.40 | a stub; first candidate for new research                                |
| moderate           | anything else         |                                                                         |

## LAYERS OF LAYERS

The Layers panel and the coverage report share one hierarchy: domain › layer › sub-layer › subtype › record (and
each record's sources, witnesses and linked cases). The panel shows the first three levels:

```
group (Cases, Military & nuclear, Conflicts, Water, Sky & space, Earth hazards, Anomalies & ancient sites, Geography)
 └─ layer (e.g. Cases, Nuclear tests, Off-limits mountains, HydroLAKES)
     └─ sub-layer (e.g. Animal mutilation › cattle / horse / dog / wildlife; Nuclear tests › atmospheric / underground /
        underwater / space; Military › US DoD (MIRTA) / Wikidata / fort / gendarmerie; Off-limits › mountain /
        nuclear-weapons storage / literal 'secret' name)
```

Each checkbox is tri-state (on, off, mixed). Sub-layer keys come from one shared function (`src/taxonomy.js`) so
the panel, the filters, the reports and the coverage numbers can never disagree. Breadth and depth are reported at
every level of the tree, so a deep layer hiding a shallow sub-layer is visible.

## Finding classes (audit)

Every audit finding has exactly one class.

| Class        | Definition                                                                                 | Example                                               |
| ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **bug**      | our code does the wrong thing                                                              | a dossier hook read raw rows instead of prepared rows |
| **error**    | a value is verifiably wrong against its own cited source                                   | a QWM id used for two different nuclear tests         |
| **issue**    | a value looks wrong or is unusual, but is not proven wrong                                 | a yield given as a class range instead of a number    |
| **problem**  | something systemic or missing (coverage gap, missing field, missing source)                | 13 USO rows without `source_url`, so not plotted      |
| **dilemma**  | a decision only Alex (as owner) can make; we implement a safe default and list the options | NUFORC rows have no licence                           |
| **conflict** | two sources disagree and both values are kept and shown                                    | two datasets give different coordinates for one case  |

Grades follow the house rules: CIT (credible insider testimony; Robert Hastings and
Diana Pasulka count as CIT), Official record (archives), ST (experiencers), TE (testimony), other. Greer and Maussan
rows are kept and listed but carry zero weight. Grades are never lowered by the audit.
