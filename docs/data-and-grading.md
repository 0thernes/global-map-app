# Data and grading rules

These are the house rules. The build (`data/build_data.py`), the validator (`scripts/validate_data.py`) and the audit
(`scripts/audit/forensics.py`) enforce them.

## Sourced rows only

- A row is plotted only if it has a valid `lat`/`lon`, a `name` and an `http(s)` `source_url`. Case rows also need a
  parseable `date`. Anything else goes to `data/unplotted_loader.csv` with the reason, and the audit lists it.
- Nothing is invented: blank stays blank. No coordinate jitter, no filled-in yields, no guessed dates.
- Where two datasets disagree, both values are kept and shown side by side with their sources (a *conflict*).

## Grades

| Grade | Use it for | Weight (hotspots, coverage) |
|---|---|---|
| **CIT** | credible insider testimony: military, intelligence, government, aviation or scientific insiders speaking on record. **Robert Hastings and Diana Pasulka count as CIT.** | 1.0 |
| **Official record** | archives and official documents (government files, FOIA releases, police and military records) | 0.8 |
| **ST** | serious testimony from **experiencers** (first-hand witnesses) | 0.6 |
| **Testimony (TE)** | other testimony | 0.3 |
| **Online claim** | ungraded online material | 0.1 |
| other | anything not mapped above | 0.2 |
| **zero weight** | **Steven Greer and Jaime Maussan** sourced rows: kept, listed, never counted in scores or layers | 0 |

The audit may raise a grade (for example Hastings or Pasulka rows that came in as ST) but never lowers one, and it adds
no skeptic boilerplate. Composite grades from QWM (e.g. `Official record / ST`) are kept as published; exact
duplicates (`X / X`) are collapsed to `X` and the raw value is kept in `grade_raw`.

## Coordinates: pin or circle

| `coord_precision` | Marker |
|---|---|
| `exact_site`, `within_1km` | sharp pin |
| `locality` (default radius 10 km), `region` (100 km), anything else → `unspecified` (25 km) | translucent uncertainty circle with a faint centre dot; `coord_radius_km` overrides the radius |

This applies to cases and to every reference layer that carries `coord_precision`.

## Dates

ISO `YYYY-MM-DD`, `YYYY-MM` or `YYYY`; negative years are BCE. `date_low`/`date_high` draw a range bar; decades
(`198-`, `1980s`) become a ten-year range. SIPRI nuclear-test dates are GMT; local-date differences are logged, not
"fixed".

## Water and space

- *USO (water)* rows are cases over or under water; the app shows distance to shore and an over-water filter.
  The USO caveat (navy and submarine activity confounds water sightings) is shown in the analysis and the tour.
- Satellite anomalies on Earth plot normally. Rows with a `body` other than Earth (Moon, Mars, …) are never plotted on
  the globe; they appear in **Index › Off-world**, with `[verify]` markers where QWM flagged the citation.

## Private data

Datasets without a redistribution licence (currently NUFORC) are built into the git-ignored `data/private/` and load
only locally. Add `?private=0` to the URL to run without them. See [DATA_LICENSE.md](../DATA_LICENSE.md).
