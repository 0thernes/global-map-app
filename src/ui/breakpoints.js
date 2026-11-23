// Responsive breakpoints (v1.5, ADR 0005 section 5): one list for CSS and JS. Media queries cannot read custom
// properties, so css/*.css repeats these numbers in range syntax, `(width < N)` and `(width >= 2560px)`, and
// test/unit/breakpoints.test.mjs fails if a stylesheet uses a width that is not listed here.
export const BREAKPOINTS = {
  phone: 820, // below: report columns and index lists go single-column; toolbar labels hide
  sheet: 900, // below: every window becomes a full-width bottom sheet (src/ui/window.js)
  tablet: 1100, // below: narrower rail and dossier; toolbar separators hide
  laptop: 1440, // below: 304 px rail, compact command bar, bottom dock under the right docks
  desktop: 1760, // below: toolbar views are icon-only
  uhd: 2560, // at or above: the 1.25x chrome ladder for 4K at DPR 1
};
export const SHORT_HEIGHT = 900; // below: denser timeline and legend
/** Name of the band a viewport width falls in: 'phone' | 'sheet' | 'tablet' | 'laptop' | 'desktop' | 'wide' | 'uhd'. */
export function band(w) {
  if (w >= BREAKPOINTS.uhd) return 'uhd';
  for (const k of ['phone', 'sheet', 'tablet', 'laptop', 'desktop']) if (w < BREAKPOINTS[k]) return k;
  return 'wide';
}
