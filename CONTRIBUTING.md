# Contributing

Thanks for helping. Global Map is evidence-first: a contribution is only as good as its sources.

## Ground rules for data

1. **Every row needs a source.** An `http(s)` `source_url` that supports the row. No source, no plot.
2. **Do not invent or estimate.** Leave a field blank rather than guess. No coordinate jitter, no filled-in yields or
   death tolls, no "approximately" dates without `date_low`/`date_high`.
3. **Say how precise the place is.** `coord_precision` = `exact_site`, `within_1km`, `locality`, or `region`, and
   `coord_source` (e.g. `USGS GNIS 1403263`, `OSM way 387357310 centroid`, `geocoded from place name`).
4. **Grade honestly** with the house grades (CIT, Official record, ST, Testimony; see
   [docs/data-and-grading.md](docs/data-and-grading.md)). Grades are not lowered to add balance, and no skeptic
   boilerplate is added to summaries.
5. **Disagreements stay visible.** If your source disagrees with an existing row, add your row; the build links them and
   shows both values.
6. **Licences matter.** Only add data you may redistribute. If a dataset has no licence, open a _data source_ issue first.

Use the **Data source** issue template, or a pull request that edits a CSV in `data/sources/` using the common schema
(see `data/build_data.py`, `COMMON`).

## Code

```bash
npm ci
npm run build
npm run check      # lint, format check, unit tests, data validation, build, headless smoke test
```

- ES modules in `src/`, bundled to `js/app.js` by esbuild. Commit the rebuilt bundle with your change.
- Keep pure logic (statistics, scoring, coverage) in DOM-free modules with unit tests in `test/unit/`.
- Escape every data value that reaches `innerHTML` (`esc`, `link` in `src/app_core.js`).
- Respect `prefers-reduced-motion`, keep audio muted until a user gesture, and keep the app working from `file://`.
- Prettier formats, ESLint lints; CI runs both.

## Commits and pull requests

- Small, focused commits with a clear message (`area: what and why`).
- Fill in the pull-request template, including the sources checklist for data changes.
- Add a line to `CHANGELOG.md` under _Unreleased_.

## Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Contact: 0_0@0thernes.art.
