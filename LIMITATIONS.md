# Limitations

Honest limits of `global-map-app` (Global Map). Overclaiming costs more credibility than any
limitation. Full threats-to-validity analysis lives in [docs/limitations.md](docs/limitations.md).
(Build Standard v1.2.0: B41.)

## Summary of core data and statistical limits

- **Reporting-archive dominance:** 2,454 of the 2,624 public plotted cases (94%) come from France's
  GEIPAN (CNES) archive. Geographic density reflects where reporting archives exist, not true event
  frequency.
- **Observational statistics only:** Proximity tests (military bases, nuclear sites, conflicts,
  water) are observational correlations subject to population, coastline, sensor, and reporting
  confounders. Correlation is not causation.
- **Coordinate precision:** Most rows are commune/town centres (`locality`, 10 km uncertainty
  circle), never jittered. Only `exact_site` and `within_1km` rows render as pins.
- **Unlicensed data excluded:** NUFORC reports have no stated licence and are kept out of the
  public repository (git-ignored `data/private/` only).
- **No claim verification:** Global Map plots what cited sources report; it does not verify witness
  credibility or physical causes.

## Not tested in local non-browser runs

- `npm run test:smoke`, `npm run test:a11y`, `npm run test:perf`, and `npm run audit:ui` require a
  Playwright Chromium binary (`npx playwright install --with-deps chromium`). GitHub Actions CI runs
  `test:smoke` on every push to `main`; `test:a11y` and `test:perf` are run manually/on release.
- Live third-party tile/terrain/feed availability (Esri, EOX, OSM, CARTO, NASA GIBS, AWS Terrain,
  USGS, NASA EONET) depends on external hosts and network access; offline fallback uses bundled NASA
  textures without 3D terrain.
- Plain `file://` launches disable 3D terrain web workers due to browser same-origin restrictions.

## Platforms

| OS / Runtime                                               | Status                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Linux (`ubuntu-latest` CI, Node 22, Python 3.12, Chromium) | Tested in CI on every push (`lint`, `test`, `test:data`, `test:py`, `ruff`, `build`, `test:smoke`)                 |
| Windows 11 (Node 25, Python 3.12)                          | Locally verified (`npm test` 181/181, `npm run lint`, `validate_data.py`, `test:py` 15/15, `npm run build` 0 diff) |
| macOS                                                      | Static browser app runs in Chrome/Edge/Firefox; automated CI runs on Linux only                                    |

## Sample sizes and statistics

All statistical tests in the Analyze and Data panels are observational, report sample size `n`,
method (seeded Monte Carlo / permutation / Fisher exact), raw and multiple-comparison-adjusted
(`Bonferroni` / `Holm`) p-values, and explicit caveats next to every number. See
[docs/limitations.md](docs/limitations.md#statistics).

## Literal versus metaphor

| Term used                   | Literal meaning                                                                                                                 | Metaphor or marketing?                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "OSINT console" / "dossier" | Structured static web viewer displaying publicly sourced records, citations, and coordinates                                    | Aesthetic / domain framing — not a government or intelligence-agency product (`index.html` boot card explicitly states: "Styling only. Not a government document; no classification is implied.") |
| "ENGAGE" boot screen        | Splash dialog that unlocks browser Web Audio and optional fullscreen/guided tour after a user gesture                           | Thematic UI styling                                                                                                                                                                               |
| "High-strangeness"          | Umbrella label for the heterogeneous UAP, abduction, mutilation, and anomaly source categories compiled from archives and PDF 7 | Descriptive category label — not a claim that any report is anomalous or non-prosaic                                                                                                              |
| "Convergence hotspots"      | Population-adjusted grid score weighting co-located records by house evidence-grade weights                                     | Heuristic exploratory index — weights are a documented house policy (`docs/data-and-grading.md`), not a probability of truth                                                                      |

## Corrections to past claims and legal hygiene

- See `CHANGELOG.md` and `docs/audit/hardening/FINDINGS.md` for all v1.0.0–v1.5.1 data and UI
  corrections (including the v1.0.0 military-layer distance revision from 2.6 km to 16.0 km after
  removing non-military Wikidata subclass items).
- Playbook Finding 1 (2026-11-27): non-license active metadata (`CITATION.cff`, `package.json`,
  `README.md`, `SUPPORT.md`, `index.html`) updated from `"0thernes L.L.C."` to Alexander Stephen
  Donahue (`0thernes`, Independent Researcher). Existing `LICENSE` and `DATA_LICENSE.md` copyright
  notices remain owner-controlled and unmodified.
