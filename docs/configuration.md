# Configuration

Runtime URL options, browser storage keys, and build/test environment notes for `global-map-app`
(Build Standard A33).

## Runtime URL parameters

Global Map is a static browser app requiring **no API keys, no Cesium ion token, and no `.env`
file**. Runtime behaviour is configured via query parameters on `index.html`:

| Parameter     | Values                                                                | Default                      | Effect                                                              |
| ------------- | --------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `tour`        | `intro`                                                               | unset                        | Start the 20-step guided tour after boot                            |
| `audio`       | `on`                                                                  | muted                        | Start with CC0 audio enabled after user interaction                 |
| `fullscreen`  | `1`                                                                   | unset                        | Request fullscreen on ENGAGE                                        |
| `intro`       | `0`                                                                   | boot shown                   | Skip the boot title card                                            |
| `fx` / `perf` | `low` / `1`                                                           | standard                     | Reduce visual effects / enable performance mode                     |
| `basemap`     | `esri`, `hybrid`, `s2`, `osm`, `dark`, `bluemarble`, `modis`, `local` | `esri`                       | Select keyless imagery provider (or bundled offline NASA texture)   |
| `terrain`     | `terrarium`, `esri`, `off`                                            | `terrarium` (over `http(s)`) | Select 3D terrain provider (`off` on `file://`)                     |
| `private`     | `0`                                                                   | auto-detect local            | Do not attempt to load local-only git-ignored `data/private/` files |

## Browser storage

User preferences (basemap, terrain, audio levels, density, high-contrast theme, window positions,
and intro-seen flag) are stored solely in browser `localStorage` inside `try/catch` guards
(verified by hardening pass `B09`). No cookies, accounts, or analytics telemetry are used.

## Local development environment

- Node.js version is pinned in `.nvmrc` (`22`, `engines.node >= 22` in `package.json`).
- `npm ci` installs all pinned dev dependencies from `package-lock.json`.
- Python scripts (`scripts/validate_data.py`, `data/build_data.py`, `scripts/audit/*.py`) use
  Python 3.12+ standard library only.
