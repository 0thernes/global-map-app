# ADR 0003: One design system for the console (tokens, windows, tabs)

- Status: accepted (v1.3.0)
- Date: 2026-11-13
- Deciders: 0thernes

## Context

The owner's verdict on v1.2 was that the front end "is a mess in the boxes and scroll bars and tabs and minimize or
close options and visuals". The v1.3 UI audit (`docs/audit/v1.3-ui-audit.md`, made by `test/ui_audit.mjs` and
`scripts/audit/ui_audit_report.py`) measured 38 views at 1280x800, 1920x1080 and 3840x2160 and agreed. Its main
findings were these:

- Fourteen panels, each placed with its own fixed CSS offsets. Open three and they stack on top of each other.
  Some cover the timeline and the rail. At 1280 px the toolbar runs off the screen and the export, settings and
  help buttons cannot be reached.
- Close (×) is the only window control. Nothing can be minimized, maximized, moved, resized or docked, and Esc
  closes panels in a hard-coded order.
- The Data and Index dialogs scroll inside an outer scroll region, so there are two or three scroll bars in one box.
- Three tab bars share one pill style. They have no `role="tab"` or `aria-selected` and no arrow keys, and their
  labels wrap.
- There are 13 font sizes, from 10 to 28 px, and three font families. The audit found 17 literal z-index values,
  Unicode glyphs used as icons, and default scroll bars.

## Decision

1. **Tokens first.** `css/tokens.css` holds every value. The ladders are:
   - spacing: an 8 px grid with a 4 px half-step (`--s-h`, `--s-1` … `--s-8`)
   - type: a modular scale with ratio 1.2 on 14 px (`--fs-1` 12 … `--fs-6` 29); 12 px is the floor
   - controls: `--ctl-sm` 24, `--ctl` 32 and `--ctl-lg` 40 px; 24 px is the WCAG 2.2 target size
   - radii, three shadows, `--blur`, and the colours of a dark AA palette
   - a categorical chart palette (`--chart-1` … `--chart-12`)
   - one z-index ladder (`--z-globe` 0 … `--z-boot` 100)
2. **Two faces.** Inter for the UI and titles, JetBrains Mono for data and numbers. Both are vendored under SIL
   OFL 1.1, with no CDN. Rajdhani and IBM Plex Mono are removed.
3. **One window component.** `src/ui/window.js` turns every `.panel` into a window. Each window has:
   - a standard 48 px header: the title, then minimize, maximize and close (Lucide icons)
   - one scroll region (`.win-body`); tab and filter rows stay fixed above it in `.win-tools`
   - drag by the title bar, with snapping to left, right and bottom dock zones and a dashed preview
   - a corner grip to resize floating windows and an inner edge to resize docked ones
   - per-window state in `localStorage` (`gm.win.<id>`), and a "Reset window layout" control (menu and `0` key)
   - Esc closes the window that has focus, or else the top one
   - `role="dialog"` and `aria-modal` for modal windows, which take focus when they open (on the selected tab, never a
     text field) and trap Tab
   - The geometry is pure, unit-tested functions: `safeArea`, `clampRect`, `snapZone`, `layoutWindows` and
     `parseState`.
4. **A safe area.** Windows are laid out in the viewport minus the top bar, the timeline and the globe credit line,
   and beside the rail. Docked windows tile inwards from their edge and never overlap. Bottom docks span the gap
   between the side docks. Side docks shrink when they would leave less than 30 % of the width. The globe is
   re-centred in the space that is left, through `occupied()` and `onLayout()`.
5. **One tab component.** `src/ui/tabs.js` `makeTabs()` is used by the rail, Data and Index. It has:
   - one underline style
   - `tablist`, `tab` and `tabpanel` roles, `aria-selected` and a roving tabindex
   - Left, Right, Home and End keys with automatic activation
   - scroll arrows that appear only when the tabs overflow, and labels that never wrap
   - the existing `data-*` attributes, kept so links and tests still work
6. **Tables and charts use the tokens.** Header rows are sticky against the window body. Rows are zebra-striped.
   Numeric columns (`src/ui/table.js`: at least 80 % of their cells are numbers) are right-aligned with tabular
   numerals, and headers are sortable by keyboard with `aria-sort`. Chart fills use `--chart-*` and axis text uses
   `--chart-axis` at 12 px. The Data "PDF 7 tables" picker became a `<select>` with previous and next buttons, so
   there is no scrolling list inside the scrolling window.
7. **Responsive.** Below 1760 px the toolbar is icon-only; the names stay as accessible text and tooltips. Below
   900 px every window becomes a full-width bottom sheet. With reduced motion (the OS setting or Settings), all window
   and tab transitions are removed.

## Consequences

- Every feature and data rule is unchanged: pin vs circle, `coord_source`, grades, and sources on click. This is a
  presentation change only. Module code still opens and closes panels with `hidden`; the window manager watches
  that attribute.
- New checks: `test/unit/window.test.mjs` and `test/unit/tabs.test.mjs` (jsdom); a smoke step that opens,
  minimizes, restores, maximizes, drags, docks and closes each window; and `npm run test:a11y`, which runs axe-core
  on every view and must report 0 violations.
- Kept on purpose (the audit calls these dilemmas):
  - Long layer names in the 320 px rail are still truncated. The full name is in the tooltip and the Index, and
    wrapping would double the rail's height.
  - At 3840x2160 with a device pixel ratio of 1 the console keeps its 14 px density rather than scaling up. 4K
    screens normally run at DPR 2, and scaling would take space from the globe.
- Cost: about 20 KB of JS and 12 KB of CSS (unminified), two npm devDependencies for tests (axe-core and jsdom)
  and one for icon generation (lucide-static). Nothing new ships at runtime from a CDN or a keyed API.
