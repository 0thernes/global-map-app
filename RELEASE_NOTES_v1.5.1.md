# Global Map App v1.5.1: the hardening release

**Same globe, fewer ways to be wrong.** v1.5.1 is the result of a repository-wide audit: 127 passes over a generated
table of contents of every tracked file, covering code, data, pipeline, CI, security, accessibility, docs and
methodology. It recorded 57 findings. 42 are fixed, each bug with a regression test; 15 are decided, with the reason
written down. Nothing was added to or removed from the data: the data fixes correct format and provenance against the
source files, and the rebuilt files were diffed field by field.

## What changed for you

- **Conflict dates are right again.** Since v1.5.0, 188 UCDP conflict start dates and 236 end dates were shown as
  1 January. They now keep the day the source gives.
- **Dates never claim more precision than they have.** A source date that is not a real day (GEIPAN `2000-09-31`)
  is kept to the month, and the dossier says why.
- **Cleaner values**: French postal codes keep their leading zero (`08430`, not `8430.0`), witness counts read `1`,
  not `1.0`, and 337 reference rows no longer show Wikidata's `http://www` placeholder as a date or status.
- **Provenance on every click**: reference-layer dossiers now show where the coordinate came from, and every case
  names its dataset.
- **Search ignores accents**: `Bacouel` finds `Bacouël`.
- **Safer exports**: CSV files follow RFC 4180 and neutralise spreadsheet formulas; workspace files are validated
  before they are applied.
- **Honest failure**: a blocked pop-up or a failed boot now tells you what happened.
- The dossier's nearest military site follows the same rule as the analysis (no gendarmerie, no forts), and a note
  about a nearby case can no longer raise a row's grade.

## New documents

- [Data dictionary](docs/data-dictionary.md): every export column and every derived field.
- [Limitations](docs/limitations.md): GEIPAN dominance (94 % of cases), reporting and geocoding bias, confounding,
  multiple comparisons.
- [Hardening audit](docs/audit/hardening/): the index, the passes, the findings and how to re-run them
  (`npm run audit:index`, `npm run audit:hardening`, `npm run audit:findings`).

## Checks for this release

- Lint (ESLint, Prettier), 176 Node unit tests, 13 Python tests, data validation (0 errors), ruff, actionlint,
  `npm audit` (0 vulnerabilities).
- Perf, UI audit `--check` at 1280x800, 1920x1080 and 3840x2160, axe and the full smoke test: see the
  [CHANGELOG](CHANGELOG.md#151---2026-11-24) and `docs/audit/hardening/PROGRESS.md` for the run results.

The rules have not changed: only sourced rows are plotted, pins only for `exact_site` and `within_1km`, uncertainty
circles otherwise, nothing jittered, `coord_source` on every click, NUFORC private, Gendarmerie shown but kept out of
analysis, and no keys or Cesium ion.
