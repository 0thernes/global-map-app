# ADR 0005: Globe visual system, reference overlays and panel states

- Status: accepted (v1.5.0)
- Date: 2026-11-23
- Deciders: 0thernes
- Builds on: [ADR 0001](0001-cesium-renderer.md) (Cesium renderer, keyless sources),
  [ADR 0003](0003-design-system.md) (tokens) and [ADR 0004](0004-osint-console-information-architecture.md)
  (console layout). Nothing in those records is reversed.

## Context

v1.4 settled the console around the globe. The owner's v1.5 brief asks for the next step on the globe itself and on
the system around it: _"update upgrade improve better the UI UX Wireframing and ergonomics and globe and visuals and
graphics and system and design and engineering"_.

The v1.4 globe had these gaps (each one is a finding in `docs/audit/v1.5-ui-audit.md`):

1. **No geographic reference.** There is no latitude/longitude grid, so an analyst reading coordinates off the
   hover card can't relate them to the map. Day and night are shaded, but nothing marks where sunrise and sunset
   are, or how dark it was at a sighting. Observing conditions matter for a sighting report.
2. **Pins encode only the category.** The evidence grade, the second thing an analyst asks about a row, is only in
   the hover card and the dossier. It is coloured in the status strip but not on the map.
3. **Circles look too much like pins from orbit.** A filled translucent disc with a solid edge reads as a big pin.
   The cartographic convention for an uncertain extent is a dashed boundary.
4. **Every fly-to has the same 1.6 s cubic curve.** A 50 km hop and a flight to the other side of the planet take
   the same time, and long flights skim the surface instead of rising to show context.
5. **Each panel says "loading", "nothing here" or "failed" in its own way**, as a grey paragraph with no role, so
   screen readers don't announce it and there is no way to recover.
6. **Breakpoints drift.** The CSS used `(max-width: 900px)`, which includes 900, while `src/ui/window.js` switches to
   bottom sheets at `innerWidth < 900`. At exactly 900 px the two disagree. Other numbers are repeated by hand in
   three stylesheets and two scripts.
7. **The focus ring is declared twice** (`css/app.css`, `css/components.css`) and is a box-shadow only. Windows
   forced-colors mode removes box-shadows, so keyboard focus disappears there.
8. **`src/globe_cesium.js` is over 1,000 lines** and mixes imagery, layers, effects, camera and now overlays.

## Decision

### 1. Reference geometry is pure, tested maths

`src/cesium/graticule.js` has no Cesium or DOM. It holds the adaptive grid (`graticuleStep`, `graticuleLines`,
`graticuleLabel`), small circles by the destination-point formula (`smallCircle`), the terminator and twilight
rings (`terminatorRings`) and the dashed uncertainty ring (`dashedRing`). `test/unit/graticule.test.mjs` checks
every point's angular distance with haversine, the antimeridian case, the June-solstice terminator reaching the
polar circles, and the dash count.

### 2. Overlays: graticule (J) and terminator (Y)

`src/cesium/reference.js` turns that geometry into batched `GL_LINES` primitives, one per overlay, with labels:

- **Graticule:** 30° from orbit, then 15°, 10°, 5°, 2° and 1°, down to 0.25° at street level. From 5° down, only the
  visible rectangle plus a margin is built, so line counts stay bounded. Labels run along the parallel and meridian
  nearest the view centre. The equator and Greenwich are drawn brighter.
- **Terminator:** the line 90° from the sub-solar point (`src/sun.js`, about 0.01° accuracy) in solid amber. The
  civil, nautical and astronomical twilight rings (96°, 102° and 108°) are dashed and fade with depth. They follow
  the timeline date and rebuild when the sub-solar point moves more than 0.1°.
- **Chord sag:** lines are straight chords between samples, and a chord dips below the ellipsoid by L²/8R. Every
  overlay is lifted by 1.4 times its chord sag (`sagH`, at least 20 m) so the globe never hides a segment. It is
  never lifted by a visible amount.
- **Render on demand:** a rebuild is keyed by step and view box and throttled to 200 ms. Each rebuild asks for
  frames through `requestRender`. An idle globe with both overlays on stays under the 20-frames-in-10-s budget,
  and `test/perf.mjs` now checks this case too.
- **Controls:** both overlays are toggles in the map-tool column, which now has 7 targets: home, lasso and random;
  grid, terminator and heatmap; legend. They have shortcuts (J, Y), appear in the omnibox, and have a Globe section
  in Settings. The choice is remembered.

These overlays are reference geometry drawn from the camera and the date. They never add, move or hide a case.

**Considered and rejected:** Cesium's `GridImageryProvider` (it draws on tile edges, not on round degrees, and gives
no labels); `GroundPolylinePrimitive` (it clamps to terrain but costs one draw per line and loads extra workers on
SwiftShader); and a shaded terminator band from a second imagery layer (Cesium's own lighting already shades night,
and the line answers the question better).

### 3. Planned camera flights

`src/cesium/flight.js` (`planFlight`) works out each fly-to:

- **Duration:** 0.7 + 1.1·√angle + 0.32·|log₁₀(h₁/h₀)| seconds, clamped to 0.35–3.4 s. A caller's explicit
  duration is kept.
- **Easing:** `QUADRATIC_OUT` for short hops, `CUBIC_IN_OUT` for medium hops or deep zooms, `QUINTIC_IN_OUT` for
  intercontinental flights.
- **Apex height:** for hops over about 20°, the camera rises to about 0.55 × the arc length, capped at 22,000 km,
  so it keeps context.
- **Reduced motion:** with reduced motion, or an explicit 0 ms, the flight is instant.

### 4. Marker grammar

- **Pin** (`exact_site` or `within_1km` only, unchanged): a **ring gauge**. A dim full track carries a bright arc from
  12 o'clock whose length is the weight of the evidence grade (`GRADE_GAUGE` in `src/ui/symbology.js`):
  - CIT and official record: a full ring. CIT adds a thin outer halo.
  - ST: three quarters.
  - Testimony: a half.
  - Online claim and other: a quarter.

  Crosshair ticks keep the "this is a point" reading. The category is still the tint, so grade reads without colour
  and category reads without shape. The six sprites are drawn once (shapes 4–9 in `src/cesium/icons.js`), and a unit
  test keeps the drawn fractions equal to `GRADE_GAUGE`.

- **Uncertainty circle** (`locality` or `region`): the radius is still the row's stated uncertainty, on the true
  geodesic. The edge is now **dashed**: every other chord of a 48-gon. The fill drops from 15 % to 7 % alpha, and the
  centre mark is a hollow diamond, not a dot. A circle can no longer be mistaken for a pin.
- **Unchanged rules:** never jitter. `coord_source` is shown on click (hover card and dossier). NUFORC stays private
  (`?private=0` in the tests), and Gendarmerie rows are drawn but excluded from analysis.
- **Legend:** the legend glyphs are the same drawings in SVG (`GLYPH` in `src/ui/console.js`). The grade rows show
  each grade's gauge.

**Considered and rejected:**

- **Category glyphs inside each pin.** At 21 px the glyph core is about 9 px and the icons blur into blobs. Each
  icon would also need an async SVG-to-canvas raster per category. Glyphs stay in the hover card, legend, feed and
  dossier, where they are legible. This is recorded as a dilemma in the audit.
- **A second billboard per pin for a coloured grade ring.** It doubles the billboard count (2,624 cases) and the
  per-frame alpha work on time-aware layers.

### 5. Atmosphere and night lights (keyless)

- The sky atmosphere is slightly brighter (+0.06) and less saturated (−0.08), so the limb separates from the star
  field.
- The ground atmosphere's light intensity is 11 and its saturation −0.1, so streamed imagery keeps its colour.
- The NASA Black Marble city lights (GIBS, keyless) get brightness 1.7, contrast 1.25 and gamma 0.9, so
  settlements read on the night side. They keep the existing fade-out below 650 km.
- No Cesium ion asset or token is used. The star box is the one vendored with `@cesium/engine`.

### 6. Panel states

`src/ui/states.js` builds one markup for `loading`, `empty` and `error`:

- an icon
- a title that says what is happening
- an optional detail that says why
- an optional single recovery button

Loading and empty are `role="status"` polite live regions, and loading also sets `aria-busy`. Error is
`role="alert"`. The feed, Data, Analysis, Hotspots and the legend use it. The feed's error state has a **Try again**
button that refetches the live feeds.

### 7. One breakpoint list, one focus ring

- `src/ui/breakpoints.js` is the only list of widths: phone 820, sheet 900, tablet 1100, laptop 1440, desktop 1760
  and uhd 2560. Every stylesheet uses media-query range syntax, `(width < N)` and `(width >= 2560px)`.
  `test/unit/breakpoints.test.mjs` fails on any width that isn't listed, and on any `max-width` or `min-width`. This
  closes the 900 px disagreement.
- `:focus-visible` is declared once, in `css/tokens.css`. Under `forced-colors: active` it is a real 2 px
  `CanvasText` outline.
- The in-app Reduced motion setting zeroes the motion tokens, as the OS preference does.

### 8. Modules

The overlays moved out of `src/globe_cesium.js` into `src/cesium/reference.js`. That file only adapts
pure geometry, so the globe adapter gets no new responsibilities. New modules:

| Module                    | Kind                          | Tests                  |
| ------------------------- | ----------------------------- | ---------------------- |
| `src/cesium/graticule.js` | pure                          | `graticule.test.mjs`   |
| `src/cesium/flight.js`    | pure                          | `flight.test.mjs`      |
| `src/cesium/reference.js` | Cesium adapter (pure helpers) | `graticule.test.mjs`   |
| `src/ui/states.js`        | pure                          | `states.test.mjs`      |
| `src/ui/breakpoints.js`   | pure                          | `breakpoints.test.mjs` |
| `src/ui/globe_tools.js`   | DOM wiring                    | smoke, ui_audit views  |

## Consequences

- **Good:**
  - An analyst can read coordinates and lighting conditions off the globe.
  - The grade is visible on the map without colour.
  - Uncertain locations look uncertain.
  - Flights feel proportionate.
  - Every empty or failed panel is announced and says what to do.
  - Breakpoint drift and focus loss in forced-colors mode are now caught by tests.
- **Cost:**
  - The map-tool column is 3 targets taller (about 130 px). At 1280x800 it still ends above the legend chip.
  - Labelled grids at 0.25° can build up to about 800 lines. They are view-limited and rebuilt only when the key
    changes.
- **Risk:** On software WebGL the overlay rebuild costs one frame. The perf test covers it.

## Wireframes

[`docs/design/wireframes/`](../design/wireframes/README.md) has 12 frames at 1280x800, 1920x1080 and 3840x2160. They
include the globe reference state and the panel states, generated by `scripts/design/wireframes_v15.mjs`.
The v1.4 set is archived in `docs/design/wireframes/v1.4/`.
