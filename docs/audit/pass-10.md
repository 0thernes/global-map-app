# Pass 10: UX, accessibility and end-to-end

**Goal.** Headless end-to-end run, screenshots, reduced motion, audio defaults, contrast and responsive layout.

**Method.** test/smoke.mjs (Playwright, SwiftShader) across all panels and the tour; test/screens.mjs for the screenshots; manual review of reduced-motion and audio defaults.

## Findings by class

| bug | error | issue | problem | dilemma | conflict | total |
| --: | ----: | ----: | ------: | ------: | -------: | ----: |
|   2 |     0 |     2 |       0 |       0 |        0 |     4 |

## Notes

- Audio is muted until a user gesture; ENGAGE is the gesture. Reduced motion (OS setting or Settings) gives instant fly-to, no typing and no sweeps.
- Contrast (WCAG, computed from css/tokens.css): text --fg 13.6–17.7:1, muted 7.1–9.2:1, dim 4.7–6.1:1 on the four panel backgrounds, so all pass AA. Esc closes the top panel; every panel has a key.
- Responsive breakpoints at 1100 px and 820 px; print stylesheet for reports and dossiers.
- Open: the HUD reticle marks the screen centre while camera flights centre the target in the free area right of the docked panel (about 100 px apart at 1600 px wide).

## Examples

| class | dataset        | record         | finding                                                                                                                                                        |
| ----- | -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bug   | test/smoke.mjs | test/smoke.mjs | smoke test opened dossiers from raw rows instead of prepared cases (window.__case added). FIXED                                                                |
| bug   | ui_misc.js     | ui_misc.js     | briefing gallery captions looked up by path, not basename; captions were missing. FIXED                                                                        |
| issue | cinema.js      | cinema.js      | HUD reticle marks the screen centre, while camera flights centre the target in the free area right of the docked Layers panel (~100 px apart at 1600 px). OPEN |
| issue | smoke          | smoke          | with private rows loaded, slow panels stayed open and blocked later clicks in the headless run. FIXED (test uses ?private=0)                                   |

All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = 10`).
