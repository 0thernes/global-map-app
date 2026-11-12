# Pass 09: Code, security, performance and licences

**Goal.** Lint, tests, bundle, CSP, escaping, dependency licences and performance.

**Method.** ESLint 9, Prettier 3, Node test runner, esbuild bundle size, CSP review, grep for innerHTML sinks, dependency licence list, headless timings.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   3 |     0 |     2 |       0 |       0 |        0 |     5 |

## Notes

- CSP: `default-src 'self' file:`, no inline script, images only from self, data:, blob: and tiles.maps.eox.at, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
- Every data value that reaches innerHTML goes through `esc()`; links go through `link()` (http(s)/mailto only); briefing Markdown is allow-list sanitised.
- Dependencies bundled: three.js (MIT), d3-force/quadtree/dispatch/timer (ISC), marked (MIT). Fonts OFL 1.1, icons ISC, audio CC0. Dev only: ESLint, Prettier (MIT), Playwright (Apache-2.0).
- No secrets, tokens or personal paths in the tree; private data is git-ignored and checked by the validator.

## Examples

| class | dataset        | record         | finding                                                                                                                                              |
| ----- | -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| bug   | app_core.js    | app_core.js    | data URLs were linked without a scheme check (javascript: possible from a data file); now http(s)/mailto only. FIXED                                 |
| bug   | cinema.js      | cinema.js      | unused imports (emit, on) failed ESLint. FIXED                                                                                                       |
| bug   | ui_misc.js     | ui_misc.js     | briefing Markdown was only stripped of <script>; now allow-list sanitised (no handlers, styles, iframes, non-http links). FIXED                      |
| issue | ui_analysis.js | ui_analysis.js | all-precision analysis (~2.5k cases, time permutation on 114k GED events) takes minutes under software WebGL; run on demand, iterations capped. OPEN |
| issue | ui_reports.js  | ui_reports.js  | report generation with 83k local private rows took ~16 s headless; smoke test runs with ?private=0. OPEN                                             |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 9`).
