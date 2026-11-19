# Global Map App v1.4.0: the OSINT console

**The globe stays in the middle; everything else is one keystroke away.** v1.4 redraws the interface as an
intelligence console. It started with wireframes at 1280x800, 1920x1080 and 4K and a decision record, then rebuilt
the chrome around them. No data changed: only sourced rows are plotted, pins are only for `exact_site` and
`within_1km`, everything else is an uncertainty circle, nothing is jittered, and the coordinate source is on every
case.

## Highlights

- **Command bar**:
  - An **omnibox** (`Ctrl+K` or `/`) finds commands, cases, places, layers and reference in one grouped list.
  - A **status strip** shows the rows in view by grade, the data build date and its age, and live-feed dots.
  - **UTC and US Pacific clocks**.
- **Activity bar**: the 13 views down the left edge in three groups, with key hints. Click Layers or Filters again to
  collapse the rail.
- **Legend**: a chip at the bottom left with the pin and circle counts; `K` expands it to the marker rule, category
  colours and icons with counts, and grades.
- **Layer rail**: plain layer names that wrap instead of truncating; dataset ids, caveats and opacity in each row's
  details.
- **Timeline**: an overview strip of the whole span plus a zoomable detail track, era presets (Ancient, 1900–1945,
  Cold War, 1990–now, Last 10 y), labelled Step, Speed and Show controls, and a status row with the camera position
  and date.
- **Case dossier**: a Provenance block comes first, with the source, the grade and what it means, the coordinate
  source, the precision (pin or circle and radius) and the coordinates.
- **On the globe**:
  - a selection reticle that stays on the open case
  - a hover card with grade, marker type and coordinate source
  - cluster badges that show the category mix, sized by log count and merged so they never overlap
- **Activity feed** (`N`): live USGS earthquakes and NASA EONET events, plus the cases and filters you touched this
  session.
- **Ergonomics**:
  - keyboard first, with every key in one registry and in the `?` overlay
  - 32 px targets by default, with a compact density (`U`)
  - a high-contrast theme (`X`)
  - reduced motion
  - tabular numerals for coordinates, dates and times
  - a 1.25x token ladder at 4K
  - visible tooltips with the shortcut on every icon-only control
  - on 1280x800 a bottom-docked window runs under the right docks instead of being squeezed between them
- **Faster**: the globe renders on demand, so an idle globe barely uses the GPU; `npm run test:perf` guards it.
- **Checks**: `npm run audit:ui -- --check` now fails the build on overlaps, clipped controls, nested scroll bars, tiny
  text, small targets, axe violations or a view over its time budget at 1280x800, 1920x1080 and 3840x2160.

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
| `K` `U` `X`         | legend (expand), density, high contrast                   |
| `T` `M` `,` `P` `0` | tour, mute, settings, frame rate, reset window layout     |
| `Esc`               | close the menu, then the focused window, then the top one |

See [docs/audit/v1.4-ui-audit.md](docs/audit/v1.4-ui-audit.md),
[ADR 0004](docs/adr/0004-osint-console-information-architecture.md), the
[wireframes](docs/design/wireframes/README.md), the [style guide](docs/design/style-guide.md) and the before / after
screenshots in [docs/screenshots/v1.4/](docs/screenshots/v1.4/README.md).
