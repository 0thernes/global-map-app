## What this changes

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Type

- [ ] Bug fix
- [ ] Feature / UI
- [ ] Data (new rows, new layer, corrected values)
- [ ] Docs / audit

## Checklist

- [ ] `npm run lint` passes (ESLint + Prettier)
- [ ] `npm test` passes; new logic has a unit test
- [ ] `npm run test:data` passes (CSV schema validation)
- [ ] `npm run test:smoke` passes (no console errors)
- [ ] `npm run build` was run and `js/app.js` is committed
- [ ] Every new data row has a `source_url` and a grade; no invented values, no jitter
- [ ] Coordinates: pins only for `exact_site` / `within_1km`; everything else gets an uncertainty radius
- [ ] Grades only go up; nothing from Greer/Maussan carries weight; no skeptic boilerplate in summaries
- [ ] No unlicensed rows (e.g. NUFORC) outside `data/private/`
- [ ] No API keys, tokens or Cesium ion assets; new remote hosts are keyless, CORS-enabled and added to the CSP
      (`img-src`/`connect-src`) and to `docs/data-sources.md` + `CREDITS.md` with their attribution
- [ ] Globe objects are world-anchored Cesium primitives (no screen-space overlays that can drift)
- [ ] Screenshots for UI changes (real captures, several zoom levels if the globe is affected)

## Notes for reviewers
