# Style guide (v1.3 design system, v1.4 OSINT console)

This page is the working reference for the console UI. The decision record is
[ADR 0003](../adr/0003-design-system.md). Tokens are in [`css/tokens.css`](../../css/tokens.css), components in
[`css/components.css`](../../css/components.css), [`src/ui/window.js`](../../src/ui/window.js) and
[`src/ui/tabs.js`](../../src/ui/tabs.js). Before and after screenshots are in
[`docs/screenshots/v1.3/`](../screenshots/v1.3/).

## Principles

1. **The globe comes first.** Windows dock around it, never over the top bar, the timeline or the globe
   credits, and the globe re-centres in the space that is left.
2. **One of everything.** One window, one tab style, one table style, one icon set, one z-index ladder.
3. **Tokens, not literals.** No raw px for spacing, type or z-index in new CSS. If a value is missing, add a token.
4. **Readable by default.** 12 px is the smallest text. Body text is 14 px. Colour pairs pass WCAG AA, and
   `npm run test:a11y` enforces it.
5. **Sources stay one click away.** The design never hides a source, grade or `coord_source`.

## Type

| Token    | Size  | Use                                        | Face           |
| -------- | ----- | ------------------------------------------ | -------------- |
| `--fs-1` | 12 px | captions, tables, kbd, chart axes, h4 caps | Inter / mono   |
| `--fs-2` | 14 px | body, controls, tabs                       | Inter          |
| `--fs-3` | 17 px | window titles                              | Inter 600      |
| `--fs-4` | 20 px | dossier and section titles                 | Inter 600      |
| `--fs-5` | 24 px | report headings                            | Inter 700      |
| `--fs-6` | 29 px | display (title card, tour caption)         | Inter 700 caps |

- The scale has a ratio of 1.2 (minor third). Line height is `--lh` 1.5 for body text and `--lh-tight` 1.25 for
  titles.
- Numbers, coordinates and IDs use **JetBrains Mono** (`.mono`, `.num`, `code`, `kbd`). All other text uses
  **Inter**. Both are vendored in `vendor/fonts` under SIL OFL 1.1.
- Section labels (`h4`) are 12 px, weight 600, uppercase and tracked `--track-caps`.

## Spacing and size

- **Grid:** 8 px, with one 4 px half-step: `--s-h` 4, `--s-1` 8, `--s-2` 16, `--s-3` 24, `--s-4` 32, `--s-6` 48
  and `--s-8` 64.
- **Controls:** `--ctl-sm` 24 px (the smallest target), `--ctl` 32 px (buttons and window controls) and `--ctl-lg`
  40 px (tabs).
- **Window header:** 48 px high, padding 8 / 8 / 8 / 16.
- **Content:** padding is 16 px (`--s-2`), and gaps between figures are 8 or 16 px.

## Colour

| Token          | Value                  | Contrast on `--bg-1` | Use                  |
| -------------- | ---------------------- | -------------------- | -------------------- |
| `--fg`         | #E6F1F7                | 15.6:1               | text                 |
| `--fg-muted`   | #A9BCCB                | 9.4:1                | secondary text, axes |
| `--fg-dim`     | #8DA2B4                | 6.9:1                | tertiary text        |
| `--accent`     | #38E8FF                | 11.9:1               | links, focus, active |
| `--warn`       | #FFC857                | 11.6:1               | caveats              |
| `--danger`     | #FF7A7A                | 7.0:1                | errors, close hover  |
| `--glass`      | rgba(9, 16, 28, 0.92)  |                      | window background    |
| `--glass-head` | rgba(14, 24, 40, 0.96) |                      | headers, sticky rows |

- Charts use `--chart-1` … `--chart-12` for categories, in order, and `--chart-axis` and `--chart-grid` for their
  frame.
- Tier colours (`--tier-a` … `--tier-f`) are shared with the globe markers, so a chart and the map always agree.

## Elevation and layers

The z-index ladder (`--z-*`), from bottom to top:

| Layer   | Value | What sits there                        |
| ------- | ----- | -------------------------------------- |
| globe   | 0     | the globe                              |
| hud     | 5     | HUD                                    |
| credit  | 6     | globe credits                          |
| overlay | 9     | compare divider                        |
| rail    | 10    | the layer rail                         |
| win     | 20–28 | windows (the focused one is raised)    |
| chrome  | 30    | top bar, timeline, compare bar, status |
| modal   | 40–48 | dialogs                                |
| snap    | 49    | dock preview                           |
| menu    | 50    | menus and search results               |
| lasso   | 55    | lasso                                  |
| tooltip | 60    | tooltips                               |
| tour    | 70    | tour caption and spotlight             |
| boot    | 100   | title card                             |

Shadows: `--shadow-1` for menus, `--shadow` for windows and `--shadow-2` for dialogs. Glass blur is `--blur`, which
is off in performance mode.

## Windows

Every panel is a window: Dossier, Wars, Analysis, Graph, Charts, Briefings, Help, Hotspots, Cluster dossier, Reports,
Data, Index and Settings.

```
┌───────────────────────────────────────────────────────┐
│ Title  subtitle…                         [–] [⤢] [×]  │  48 px header: drag to move, double-click to maximize
├───────────────────────────────────────────────────────┤
│ Tabs ‹ Overview  Entries  Charts  … ›   [filter…]     │  .win-tools: fixed, never scrolls
├───────────────────────────────────────────────────────┤
│                                                       │
│  .win-body: the only scroll region                    │  slim themed scroll bar
│  (table headers stick to its top)                     │
│                                                    ◢  │  resize grip (floating windows)
└───────────────────────────────────────────────────────┘
```

- **Modes:**
  - `right` and `left` docks: full height, tiled inwards from the edge
  - `bottom` dock: between the side docks
  - `float`: free position, clamped to the safe area
  - `max`: fills the safe area
  - `sheet`: below 900 px, full width above the timeline
- **Minimize** keeps only the header. The same button then reads "Restore". **Maximize** toggles to "Restore
  size".
- **Drag** the title bar. Dropping within 32 px of the left, right or bottom edge of the safe area docks the window,
  and a dashed preview shows where it will land.
- **Resize** a floating window from its corner grip, or a docked window from its inner edge.
- **State** is kept per window in `localStorage` under `gm.win.<id>`. **Reset window layout** is in the Export menu,
  or press `0`.
- **Esc** closes an open menu first, then the window that has focus, then the top window.
- **Dialogs** (Data, Index, Reports, Briefings, Help) have `role="dialog"`, `aria-modal="true"` and
  `aria-labelledby`. When one opens, focus moves to its selected tab or to the dialog itself, never to a text field,
  and Tab wraps inside it.

To add a window, give the element `class="panel"`, a `<header><h3>Title</h3><button class="close">` and its content,
then add it to the defaults in `initWindows()`.

## Tabs

`makeTabs(host, [[id, label]], { active, attr, panel, label, onChange, kbd })` gives:

- an underline style: muted text by default, `--fg` text with a 2 px `--accent` underline when selected, and a
  `--hover` background on hover
- `role="tablist"` / `"tab"` / `"tabpanel"`, `aria-selected`, `aria-controls` and a roving tabindex
- Left and Right (wrapping), Home and End, with automatic activation
- labels that never wrap; when the tabs overflow, ‹ › arrow buttons appear and the row scrolls

## Tables

- `.dtable` is used for data. `table.wars` and `table.an` share the same rules.
- Header cells are sticky, 12 px, weight 600, `--fg-muted`, and sortable by click or Enter / Space, with
  `aria-sort`.
- Rows are zebra-striped (`--zebra`) with a hover tint.
- Numeric columns (detected by `numericCols()`) get `.num`: right-aligned, JetBrains Mono, tabular numerals.
- Long cells wrap (`overflow-wrap: anywhere`). The table never gets its own scroll bar; the window body scrolls.

## Charts

- Bars, heat cells and points take their colours from `--chart-*`. Do not use hex literals.
- Axis and label text is `--fs-1` JetBrains Mono in `--chart-axis`.
- Every figure keeps its "Source:" line (`.dsrc`) with the PDF 7 § and page, or the source column.

## Icons

- The icon set is **Lucide**, ISC licence. `src/icons.js` is generated by `npm run icons` from `lucide-static`.
- To add an icon, add its name to `scripts/gen_icons.mjs` and re-run. Use it with `data-icon="name"` on a `.btn`, or
  `icon('name')` in JS.
- Icon-only buttons need `aria-label` and `title`. Unicode glyphs are not used as icons.

## States

| State    | Treatment                                                             |
| -------- | --------------------------------------------------------------------- |
| hover    | `--hover` background, or an `--accent` border on buttons and chips    |
| focus    | `--focus` ring (2 px dark plus 2 px accent), on `:focus-visible` only |
| active   | moves down 1 px; pressed toggles get `--accent-soft` and accent text  |
| disabled | opacity 0.45, `not-allowed` cursor                                    |
| selected | an accent underline (tabs) or an accent border and text (toggles)     |

## Motion

- Durations come from `--dur-1` … `--dur-4` and easing from `--ease-out` and `--ease-inout`.
- Windows animate their position and size over `--dur-2`, but not while being dragged.
- `prefers-reduced-motion` sets every duration to 0 ms. Settings › Reduced motion (`body.reduced-motion`) does the
  same in the app.

## Responsive

| Width     | Behaviour (v1.4)                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------- |
| ≥ 2560 px | the 1.25x ladder: every type, spacing, control and layout token is multiplied by 1.25 (4K at DPR 1)     |
| ≥ 1760 px | brand subtitle, the row total and grade names in the status strip                                       |
| < 1760 px | grade chips show the colour and count only (the name is in the tooltip); the data date shows as an icon |
| < 1440 px | rail 288 px; live-feed names and clock seconds hidden; omnibox shortcut hint hidden                     |
| < 1100 px | brand reduced to the logo; the data date leaves the strip                                               |
| < 900 px  | windows become bottom sheets                                                                            |

## Checks

| Command                                                                                      | What it checks                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm test`                                                                                   | window geometry, window DOM behaviour, tabs and numeric columns (jsdom)                     |
| `npm run test:smoke`                                                                         | every window opens, minimizes, restores, maximizes, drags, docks and closes                 |
| `npm run test:a11y`                                                                          | axe-core on every view at 1920x1080 (WCAG 2.0 / 2.1 / 2.2 A + AA); must report 0 violations |
| `npm run audit:ui -- --phase after`, then `python3 scripts/audit/ui_audit_report.py --after` | re-measures the audit                                                                       |
| `npm run audit:ui -- --phase after --check` (v1.4)                                           | fails on overlaps, clipped controls, nested scroll bars, tiny text, small targets, axe      |

## v1.4 OSINT console

The decision record is [ADR 0004](../adr/0004-osint-console-information-architecture.md). The wireframes are in
[`wireframes/`](wireframes/README.md). The CSS is in [`css/console.css`](../../css/console.css).

### Regions

| Region                  | Element              | Size (1x)                 | Notes                                                                                          |
| ----------------------- | -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Command bar             | `#topbar`            | 56 px tall                | brand, omnibox, status strip, clocks, utilities                                                |
| Omnibox                 | `#search`            | 40 px, 240–560 px wide    | `Ctrl+K` or `/`; grouped results: Commands, Cases, Places, Layers, Reference                   |
| Status strip            | `#statusbar`         | flexible                  | rows by grade (grade colours), data build date, live-feed dots. Never a classification banner. |
| Clocks                  | `#clocks`            | 2 lines                   | UTC first, then US Pacific with PST or PDT; tabular mono                                       |
| Activity bar            | `#actbar`            | 56 px wide, 40 px targets | 13 views in 3 groups; `aria-pressed` mirrors the window; key hint in the corner                |
| Rail                    | `#rail`              | 320 px (288 below 1440)   | beside the activity bar; collapses when its active button is clicked again                     |
| Legend                  | `#legend`            | 272 px                    | bottom left of the free globe area, above the credit strip and any bottom dock                 |
| Map tools               | `#maptools`          | 40 px buttons             | top right of the free globe area: home, lasso, random, legend                                  |
| Credit and camera strip | `#credits`, `#hud-*` | 24 px (`--credit-h`)      | outside the window safe area                                                                   |
| Timeline dock           | `#timeline`          | 112 px                    | grouped step buttons (segmented), 32 px targets, histogram scrubber                            |

### Symbology

`src/ui/symbology.js` is the only place that maps a category to its colour and icon, and a `coord_precision` to a
marker. The legend, dossier, hover card, omnibox, feed, charts and globe all import from it.

| Marker  | Rule                                                                     |
| ------- | ------------------------------------------------------------------------ |
| Pin     | `exact_site` or `within_1km`                                             |
| Circle  | `locality` or `region`; radius = `coord_radius_km`; faint centre dot     |
| Cluster | 3 or more cases in a 46 px cell; ring split by category share; the count |

Do not add a category without a colour and an icon. The unit test fails if an icon is missing from `src/icons.js`.

### Keyboard

`src/ui/shortcuts.js` is the only list of shortcuts. The key handler in `src/ui_misc.js`, the `?` overlay and the
omnibox commands are generated from it. To add a key, add a row there and a handler with the same id in `ACTIONS`;
the unit test fails if either is missing.

### Density and themes

| Setting        | Storage          | Effect                                                                           |
| -------------- | ---------------- | -------------------------------------------------------------------------------- |
| Comfortable    | `gm.ui.density`  | default; `--ctl-sm` is 32 px, so every button, input, summary and row is ≥ 32 px |
| Compact        | `gm.ui.density`  | `--ctl-sm` is 24 px (the WCAG 2.5.8 minimum); activity buttons 36 px             |
| High contrast  | `gm.ui.contrast` | black surfaces, white text, white control borders, yellow accent and focus ring  |
| Reduced motion | `gm.cine`        | OS setting or Settings: instant fly-to, no typing effect, no transitions         |

Keys: `U` density, `X` contrast, `K` legend. All three are also in Settings › Console and in the omnibox.

### Numbers

Coordinates, dates, times, counts and keys use tabular numerals (`font-variant-numeric: tabular-nums`) so columns
do not jitter while the timeline plays. Data values use JetBrains Mono; labels use Inter.
