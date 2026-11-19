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
- **Legend**: pin versus circle, category colours and icons with counts, and grades. `K` toggles it.
- **Case dossier**: a Provenance block comes first, with the source, the grade and what it means, the coordinate
  source, the precision (pin or circle and radius) and the coordinates.
- **On the globe**:
  - a selection reticle that stays on the open case
  - a hover card with grade, marker type and coordinate source
  - cluster badges that show the category mix
- **Activity feed** (`N`): live USGS earthquakes and NASA EONET events, plus the cases and filters you touched this
  session.
- **Ergonomics**:
  - keyboard first, with every key in one registry and in the `?` overlay
  - 32 px targets by default, with a compact density (`U`)
  - a high-contrast theme (`X`)
  - reduced motion
  - tabular numerals for coordinates, dates and times
  - a 1.25x token ladder at 4K
- **Checks**: `npm run audit:ui -- --check` now fails the build on overlaps, clipped controls, nested scroll bars, tiny
  text, small targets or axe violations at 1280x800, 1920x1080 and 3840x2160.

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
| `K` `U` `X`         | legend, density, high contrast                            |
| `T` `M` `,` `P` `0` | tour, mute, settings, frame rate, reset window layout     |
| `Esc`               | close the menu, then the focused window, then the top one |

See [docs/audit/v1.4-ui-audit.md](docs/audit/v1.4-ui-audit.md),
[ADR 0004](docs/adr/0004-osint-console-information-architecture.md), the
[wireframes](docs/design/wireframes/README.md), the [style guide](docs/design/style-guide.md) and the before / after
screenshots in [docs/screenshots/v1.4/](docs/screenshots/v1.4/README.md).
