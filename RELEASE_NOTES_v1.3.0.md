# Global Map App v1.3.0: one design system

**Every box, scroll bar, tab and window control now works the same way.** v1.3 began with a measured audit of the
v1.2 interface: 38 views at three screen sizes, every finding labelled. It then rebuilt the front end on one set of
design tokens, one window component and one tab component. No feature or data rule changed.

## Highlights

- **Windows**: every panel has the same header with minimize, maximize and close.
  - Drag a title bar to move a window, or drop it on the left, right or bottom edge to dock it.
  - Resize from the corner, or from a docked window's inner edge.
  - Layouts are remembered. Press `0`, or use Export › Reset window layout, to go back to the defaults.
  - Docked windows never cover the top bar, the timeline or the globe credits, and the globe re-centres in the space
    left over.
- **One scroll bar per window.** It is slim and themed. Tabs and filters stay fixed above it, and table headers stick
  to its top.
- **Tabs**: one underline style everywhere, with keyboard arrows, ARIA roles and overflow arrows. Labels never wrap.
- **Type and colour**:
  - Inter for the interface and JetBrains Mono for numbers, both vendored, with no CDN.
  - A 1.2 type scale with a 12 px floor, and an 8 px spacing grid.
  - One z-index ladder and a dark palette that passes WCAG AA.
- **Tables and charts**:
  - Tables have zebra rows, and numbers are right-aligned with tabular numerals.
  - Charts take their colours and 12 px axis text from the tokens.
- **Icons**: a single Lucide set replaces the Unicode glyph buttons.
- **Accessibility**: `npm run test:a11y` runs axe-core (WCAG 2.0, 2.1 and 2.2, levels A and AA) on every view, and
  the release requires 0 violations.
- **Small screens**: the toolbar is icon-only below 1760 px and windows become bottom sheets below 900 px. At 1280 px
  the toolbar no longer runs off the screen.

See [docs/audit/v1.3-ui-audit.md](docs/audit/v1.3-ui-audit.md),
[ADR 0003](docs/adr/0003-design-system.md), the [style guide](docs/design/style-guide.md) and the before / after
screenshots in [docs/screenshots/v1.3/](docs/screenshots/v1.3/).
