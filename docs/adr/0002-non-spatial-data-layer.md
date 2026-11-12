# ADR 0002: A non-spatial data layer for PDF 7 and unplaceable rows

- Status: accepted (v1.2.0)
- Date: 2026-11-12
- Deciders: 0thernes

## Context

Up to v1.1 the app had one way to show a record: a pin or circle on the globe. PDF 7 (_What Is What of the What_,
257 pages) is mostly not about places. It has 279 Part I theories, 273 Part II glitches (many of them lab results
or off-Earth observations) and 108 Part V case files. It also has 165 tables, 58 figures, a testimony register and
several stated counts. The v1.2 gap audit (`docs/audit/v1.2-data-gap-audit.md`) found 356 items. In v1.1.0, 185 of
them were missing and 137 were partial. Most of the missing items were non-spatial: the app had nowhere to put them.

The loader had the same blind spot for map rows. A row without a single point was written to a CSV and then left out
of every view, including the analytics, even when it had a good source. GEIPAN cases without a commune are one
example; multi-site waves and region-scale discoveries are others.

The user's rule is that unplaceable items go into analytics and never onto the map as fake pins.

## Decision

1. Add a second, non-spatial data product next to the case and layer files:
   - `data/pdf7_data.js` (`window.GM_PDF7_DATA`), built by `data/tools/pdf7_dataset.py` from a committed snapshot
     (`data/sources/pdf7/snap/`). It holds:
     - entries: Part I, II and V
     - testimony sources and the UAP/NHI/HS taxonomy
     - Part V document links, each typed by a host rule
     - every PDF 7 table as rows, plus seven QWM aggregate tables
     - figures and sections
   - `data/unplaced.js` (`window.GM_UNPLACED`), written by `data/build_data.py`. It holds the rejected public rows
     that have a source but no point, plus a count of the rows that have no source. NUFORC and other private rows
     never enter it.
2. Every record carries its PDF 7 section and printed page, or its source file. Sections come from the label's
   position in `main.tex`, because `main.aux` records the longtable counter for labels inside table rows (see the
   v1.2 audit item E01). Pages come from `main.aux`, and for tables from the PDF text layer.
3. **Kind** is derived only from the PDF 7 domain, using the mapping in `pdf7_dataset.py` (`KIND`):
   - Part I is a theory.
   - G1 and G3 are off-Earth observations.
   - G2, G5, G6 and G9 are lab results.
   - G4 is a formal result.
   - G7, G8, G10 and G11 are claims.
   - G12 is a case.

   The mapping is coarse on purpose and shown in the UI as derived.

4. A new **Data** panel (key `D`, `src/ui_data.js`) loads both files lazily on first open. Its derivations live in a
   pure module (`src/pdf7_stats.js`) with unit tests.
5. Statistical tests use seeded permutation or exact methods. Each test is reported with:
   - n
   - the statistic
   - raw and Holm-adjusted p-values
   - the method
   - a caveat

   The battery is fixed in code, so it cannot be tuned after looking at the results.

## Consequences

- The globe is unchanged. Nothing in either new file has coordinates, and the pin-vs-circle rule, `coord_source` and
  grades are untouched.
- Start-up cost is unchanged. The ~1 MB data layer loads only when the Data panel opens.
- The PDF 7 tables are LaTeX with the markup removed, not a perfect typographic copy. Cell text can include the
  PDF's inline labels (for example `Origin: …`).
- Some figures cannot be rebuilt from data. They stay listed as open in the audit, with a reason:
  - editorial diagrams
  - relation graphs whose edges were never exported to CSV
  - a third-party image of unclear licence
- Conflicts between the PDF and the CSVs are shown side by side and never edited away. Examples are the CIT/ST
  register count, and the PDF year versus the map event date.

## Alternatives considered

- **Fake pins at a country centroid** for unplaceable items: rejected. This breaks the "never invent coordinates"
  rule, and it would distort every spatial statistic.
- **Embedding the PDF figures as images**: rejected as the main path. Images cannot be sorted, filtered or checked.
  The charts are rebuilt from the CSVs instead, and each one names the figure it reproduces.
- **Parsing `pdftotext` output for tables**: rejected. Column order is lost in multi-column cells. Parsing `main.tex`
  keeps the cell boundaries.
