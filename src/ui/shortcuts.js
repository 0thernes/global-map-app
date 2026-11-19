// One shortcut registry (v1.4, ADR 0004). The key handler (src/ui_misc.js), the `?` overlay and the omnibox
// commands (src/ui/console.js) are all generated from this list, so Help cannot drift from the code.
// Pure (no DOM): test/unit/shortcuts.test.mjs checks uniqueness and that every action id has a handler.
//   id     action id; the handler map in src/ui_misc.js must cover every id with `key` (unless doc-only)
//   key    the KeyboardEvent.key that fires it (letters match either case); omitted for doc-only rows
//   kbd    how the key is shown (array = separate <kbd> chips)
//   group  overlay section; cmd: listed in the omnibox as a command
export const GROUPS = ['Navigate', 'Views', 'Globe and time', 'Windows', 'Display'];
export const SHORTCUTS = [
  { id: 'palette', key: '/', kbd: ['/'], alt: 'Ctrl+K', label: 'Search and commands (omnibox)', group: 'Navigate' },
  { id: 'help', key: '?', kbd: ['?'], label: 'Keyboard shortcuts (this overlay)', group: 'Navigate', cmd: true },
  { id: 'escape', kbd: ['Esc'], label: 'Close the menu, then the focused or top window', group: 'Navigate', doc: true },
  { id: 'layers', key: 'l', kbd: ['L'], label: 'Layers rail', group: 'Views', cmd: true },
  { id: 'filters', key: 'f', kbd: ['F'], label: 'Filters rail', group: 'Views', cmd: true },
  { id: 'wars', key: 'w', kbd: ['W'], label: 'Wars and conflicts ranked', group: 'Views', cmd: true },
  { id: 'analyze', key: 'a', kbd: ['A'], label: 'Hypothesis analysis', group: 'Views', cmd: true },
  { id: 'hotspots', key: 'z', kbd: ['Z'], label: 'Convergence hotspots', group: 'Views', cmd: true },
  { id: 'charts', key: 'v', kbd: ['V'], label: 'Charts and analytics', group: 'Views', cmd: true },
  { id: 'graph', key: 'g', kbd: ['G'], label: 'Link graph', group: 'Views', cmd: true },
  { id: 'compare', key: 'c', kbd: ['C'], label: 'Compare two dates', group: 'Views', cmd: true },
  { id: 'reports', key: 'e', kbd: ['E'], label: 'Reports and briefs', group: 'Views', cmd: true },
  { id: 'data', key: 'd', kbd: ['D'], label: 'Data (PDF 7 entries, tables, charts, stats)', group: 'Views', cmd: true },
  {
    id: 'index',
    key: 'i',
    kbd: ['I'],
    label: 'Index (sources, glossary, coverage, credits)',
    group: 'Views',
    cmd: true,
  },
  { id: 'brief', key: 'b', kbd: ['B'], label: 'Briefings', group: 'Views', cmd: true },
  { id: 'feed', key: 'n', kbd: ['N'], label: 'Activity feed (live USGS / EONET, recent)', group: 'Views', cmd: true },
  { id: 'play', key: ' ', kbd: ['Space'], label: 'Play / pause the timeline', group: 'Globe and time', cmd: true },
  { id: 'step', kbd: ['←', '→'], label: '±1 day (Shift: month, Alt: year)', group: 'Globe and time', doc: true },
  { id: 'home', key: 'o', kbd: ['O'], label: 'Home view (reset the camera)', group: 'Globe and time', cmd: true },
  { id: 'lasso', key: 's', kbd: ['S'], label: 'Lasso-select cases on the globe', group: 'Globe and time', cmd: true },
  { id: 'random', key: 'r', kbd: ['R'], label: 'Fly to a random case', group: 'Globe and time', cmd: true },
  { id: 'heat', key: 'h', kbd: ['H'], label: 'Case density heatmap', group: 'Globe and time', cmd: true },
  {
    id: 'legend',
    key: 'k',
    kbd: ['K'],
    label: 'Map legend (pin vs circle, categories, grades)',
    group: 'Globe and time',
    cmd: true,
  },
  {
    id: 'tour',
    key: 't',
    kbd: ['T'],
    label: 'Guided tour (← → step, Space pause, Esc exit)',
    group: 'Globe and time',
    cmd: true,
  },
  { id: 'reset', key: '0', kbd: ['0'], label: 'Reset window layout', group: 'Windows', cmd: true },
  {
    id: 'windows',
    kbd: ['Drag'],
    label: 'Drag a title bar to move; drop on the left, right or bottom edge to dock; double-click to maximize',
    group: 'Windows',
    doc: true,
  },
  {
    id: 'settings',
    key: ',',
    kbd: [','],
    label: 'Settings (audio, FX, performance, motion, density)',
    group: 'Display',
    cmd: true,
  },
  { id: 'mute', key: 'm', kbd: ['M'], label: 'Sound on / off', group: 'Display', cmd: true },
  { id: 'fps', key: 'p', kbd: ['P'], label: 'FPS meter', group: 'Display', cmd: true },
  { id: 'density', key: 'u', kbd: ['U'], label: 'Density: comfortable / compact', group: 'Display', cmd: true },
  { id: 'contrast', key: 'x', kbd: ['X'], label: 'High-contrast theme on / off', group: 'Display', cmd: true },
];

/** key -> shortcut (letters folded to lower case). */
export function keyMap(list = SHORTCUTS) {
  const m = new Map();
  for (const s of list) if (s.key != null) m.set(s.key.length === 1 ? s.key.toLowerCase() : s.key, s);
  return m;
}
/** Resolve a KeyboardEvent-like {key} to a shortcut, or null. */
export function match(e, map = keyMap()) {
  if (!e || e.key == null) return null;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return map.get(k) || null;
}
/** Overlay model: [{ group, rows: [{ kbd, alt, label }] }] in GROUPS order. */
export function overlay(list = SHORTCUTS) {
  return GROUPS.map((g) => ({
    group: g,
    rows: list.filter((s) => s.group === g).map((s) => ({ id: s.id, kbd: s.kbd, alt: s.alt || '', label: s.label })),
  })).filter((g) => g.rows.length);
}
