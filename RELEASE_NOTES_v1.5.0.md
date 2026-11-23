# Global Map App v1.5.0: the globe release

**Read coordinates, light and evidence straight off the globe.** v1.5 works on the globe itself and on the system
around it. It started with a decision record ([ADR 0005](docs/adr/0005-globe-visual-system.md)) and new wireframes
at 1280x800, 1920x1080 and 4K. No data changed: only sourced rows are plotted, pins are only for `exact_site` and
`within_1km`, everything else is an uncertainty circle at its stated radius, nothing is jittered, and the coordinate
source is on every case. NUFORC stays private, and Gendarmerie rows are drawn but kept out of analysis.

## Highlights

- **Latitude / longitude grid (`J`)**:
  - The spacing follows the zoom, from 30° in orbit to 0.25° at street level.
  - Labels sit on the parallel and meridian nearest the view centre.
  - The equator and Greenwich are drawn brighter.
- **Terminator and twilight (`Y`)**:
  - The sunrise and sunset line for the timeline date is drawn in amber.
  - Civil, nautical and astronomical twilight limits are dashed. Scrub the timeline and they move with the Sun.
- **Pins show the evidence grade.** The ring is a gauge:
  - full for CIT and official records (CIT adds a halo)
  - three quarters for ST
  - a half for testimony
  - a quarter for online claims and ungraded rows

  The category is still the colour, so you can read either one without the other.

- **Uncertainty circles look uncertain.** They have a dashed edge, a lighter fill and a hollow diamond at the
  centre. From orbit they no longer read as big pins.
- **Flights fit the trip.** A short hop is quick and eases out. An intercontinental flight eases in and out and
  rises for context. Reduced motion makes every flight instant.
- **Map tools**: home, lasso and random; grid, terminator and heatmap; legend. Pressed toggles are drawn in the
  accent colour.
- **Every panel says loading, empty or failed the same way.** Screen readers announce it, and the feed offers
  **Try again** when the live feeds can't be reached.
- **Visuals**:
  - a crisper atmosphere limb
  - less blue wash over the imagery
  - brighter NASA Black Marble city lights on the night side
  - time-lapse arrivals that pop and settle

  Everything is still keyless, with no Cesium ion.

## Engineering

- **New pure modules with unit tests:**
  - `src/cesium/graticule.js`: grid, small circles, terminator, dashed rings
  - `src/cesium/flight.js`: flight planning
  - `src/ui/states.js`: panel states
  - `src/ui/breakpoints.js`: the breakpoint list

  The suite now has 153 unit tests.

- **Overlays moved out of the globe adapter** into `src/cesium/reference.js`.
- **Breakpoints:** CSS media queries use range syntax and only listed breakpoints, and a test enforces it. This
  fixed a 900 px disagreement between CSS and JS.
- **Focus ring:** declared once, with a real outline in forced-colors mode.
- **Performance:** render on demand still holds with the overlays on. On SwiftShader an idle globe drew 4 frames in
  10 s, against a budget of 20.

## Keyboard

| Key                 | Action                                                    |
| ------------------- | --------------------------------------------------------- |
| `Ctrl+K`, `/`       | omnibox: search and commands                              |
| `?`                 | keyboard help                                             |
| `L` `F`             | layers, filters                                           |
| `W` `A` `Z` `V` `G` | wars, analyze, hotspots, charts, graph                    |
| `C` `E` `D` `I` `B` | compare, reports, data, index, briefings                  |
| `N`                 | activity feed                                             |
| `Space`, `←` `→`    | play or pause; step a day (Shift: month, Alt: year)       |
| `O` `S` `R` `H`     | home view, lasso, random case, heatmap                    |
| `J` `Y`             | latitude / longitude grid, terminator and twilight (new)  |
| `K` `U` `X`         | legend (expand), density, high contrast                   |
| `T` `M` `,` `P` `0` | tour, mute, settings, frame rate, reset window layout     |
| `Esc`               | close the menu, then the focused window, then the top one |

See [docs/audit/v1.5-ui-audit.md](docs/audit/v1.5-ui-audit.md),
[ADR 0005](docs/adr/0005-globe-visual-system.md), the [wireframes](docs/design/wireframes/README.md) and the before /
after screenshots in [docs/screenshots/v1.5/](docs/screenshots/v1.5/README.md).
