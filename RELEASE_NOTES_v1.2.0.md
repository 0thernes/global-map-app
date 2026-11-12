# Global Map App v1.2.0: PDF 7 as data

**A new Data panel (`D`) holds everything that is not a place.** That covers PDF 7's theories, lab results,
off-Earth observations, tables, figures, testimony register and stated counts, plus every sourced row that has no
single point. All of it is sortable, searchable, charted and exportable, and none of it is put on the globe as a fake
pin. Every number names its PDF 7 section and page, or its source file and column.

## Highlights

- **Overview**:
  - The counts PDF 7 states are shown next to the same counts recomputed from its CSVs.
  - One conflict is surfaced rather than hidden: the CIT/ST source count is 110/5 in the PDF and 139/5 in the CSV.
- **Entries**:
  - All 660 entries: 279 theories, 273 glitches and 108 Part V cases.
  - Each has its section and printed page. The PDF year is shown next to the map event date.
- **Charts** rebuilt from the CSVs:
  - tier by domain
  - testability
  - score histogram
  - timeline
  - grade by domain
  - possibility map
  - Part V grades
  - testimony sources
  - taxonomy
  - domain trees
- **PDF 7 tables**: all 165 tables, plus 7 QWM aggregate tables, as sortable data tables with section, page and
  source line. Any table downloads as CSV.
- **Sources**: the 237 Part V document links grouped by source type and host.
- **Stats**:
  - Seven pre-set tests, including cross-layer distance to nuclear sites.
  - Each reports seeded permutation or Fisher exact p-values, Holm adjustment, n, the method and an explicit caveat.
- **Unplaced**: 397 rows that have a source but no single point, plus a count of 37 rows that have no source.
  Examples include GEIPAN cases without a commune, multi-site waves, region-scale discoveries and redacted
  locations.

## Fixed

- **PDF 7 section numbers.** Every Part II reference cited the wrong section. LaTeX's `main.aux` stores the table
  counter for labels inside table rows, so Hubble tension showed "§14" instead of "§16". The pages were right and
  are unchanged.
- **Sourced rows without a point** were left out of every view, including analytics. They are now counted and listed.

## Audit

`docs/audit/v1.2-data-gap-audit.md` (with a CSV) inventories 356 items: every PDF 7 table, figure, stated count and
list, and every QWM dataset and notes file. Each item is marked present, partial or missing for v1.1.0 and v1.2.0, and
every gap has exactly one label (bug, error, issue, problem, dilemma, conflict). The v1.2 status is recomputed from the
built files by `data/tools/gap_audit.py`. Items that are still open each have a reason: editorial figures, relation
graphs without exported data, out-of-scope catalogs, raw caches and private NUFORC rows.

## Upgrade notes

- Workflow: commits go straight to `main`. Dependabot and the pull-request template are removed; the repo checklist
  is the gate.

- No new remote hosts, keys or tokens. The data layer is about 1 MB and loads only when the Data panel opens.
- Architecture: [ADR 0002](docs/adr/0002-non-spatial-data-layer.md).
