// One symbology for the whole console (v1.4, ADR 0004): category colour + icon, marker kind per coordinate
// precision, and the legend model. Pure (no DOM), so the map (src/app.js), legend and hover card (src/ui/console.js),
// dossier (src/ui_panels.js), omnibox, feed and charts all read the same values and are unit-tested together
// (test/unit/symbology.test.mjs).
import { GRADES } from '../grades.js';

/** Category colours (moved here from app_core.js in v1.4; app_core re-exports them). */
export const PALETTE = {
  'UAP case': '#38e8ff',
  'CIT UFO sighting': '#8af6ff',
  'UAP report (public database)': '#4f9dff',
  'Nuclear-site incident': '#ffd23f',
  'Wartime sighting': '#ff8c4a',
  'Mass sighting': '#b98cff',
  Abduction: '#ff5fd2',
  'Animal mutilation': '#ff3b5c',
  'Animal mutilation: cattle': '#ff4d6a',
  'Animal mutilation: horse': '#ff7088',
  'Animal mutilation: dog': '#ff92a8',
  'Animal mutilation: wildlife': '#ffb3c6',
  'Human mutilation': '#ff1f1f',
  'Missing person': '#6dff8e',
  'USO (water)': '#3fd0ff',
  'Satellite anomaly': '#c6ff4a',
  'PDF 7 place': '#ffc6f2',
};
export const FALLBACK_COLOR = '#d0d0d0';

/** Lucide icon per case category (names must exist in src/icons.js; the unit test checks). */
export const CAT_ICON = {
  'UAP case': 'scan-eye',
  'CIT UFO sighting': 'eye',
  'UAP report (public database)': 'database',
  'Nuclear-site incident': 'radiation',
  'Wartime sighting': 'swords',
  'Mass sighting': 'users',
  Abduction: 'user-x',
  'Animal mutilation': 'paw-print',
  'Human mutilation': 'skull',
  'Missing person': 'footprints',
  'USO (water)': 'waves',
  'Satellite anomaly': 'satellite',
  'PDF 7 place': 'book-marked',
};
export const FALLBACK_ICON = 'map-pin';

export function catColor(c, sub) {
  if (c === 'Animal mutilation' && sub) {
    const k =
      'Animal mutilation: ' +
      String(sub)
        .toLowerCase()
        .split(/[\s/;,]/)[0];
    if (PALETTE[k]) return PALETTE[k];
  }
  return PALETTE[c] || (c && c.startsWith('Animal mutilation') ? PALETTE['Animal mutilation'] : FALLBACK_COLOR);
}
export const catIcon = (c) =>
  CAT_ICON[c] || (c && String(c).startsWith('Animal mutilation') ? CAT_ICON['Animal mutilation'] : FALLBACK_ICON);

/**
 * Marker kind per coord_precision. The project rule: a sharp pin only for exact_site / within_1km; locality and
 * region get an uncertainty circle (radius = coord_radius_km) with a faint centre dot; never jittered.
 */
export const PRECISION = {
  exact_site: { marker: 'pin', label: 'Exact site', short: 'exact' },
  within_1km: { marker: 'pin', label: 'Within 1 km', short: '≤1 km' },
  locality: { marker: 'circle', label: 'Locality (uncertainty circle)', short: 'locality' },
  region: { marker: 'circle', label: 'Region (uncertainty circle)', short: 'region' },
};
export const isPrecise = (p) => p === 'exact_site' || p === 'within_1km';
export function markerOf(c) {
  const p = c && c.coord_precision;
  const def = PRECISION[p];
  const r = +(c && c.coord_radius_km) || 10;
  if (isPrecise(p)) return { kind: 'pin', label: def.label, precision: p, text: `Pin · ${def.label.toLowerCase()}` };
  return {
    kind: 'circle',
    label: def ? def.label : 'Unknown precision (uncertainty circle)',
    precision: p || 'unknown',
    radiusKm: r,
    text: `Circle · ±${r >= 10 ? Math.round(r) : r.toFixed(1)} km · ${p || 'precision unknown'}`,
  };
}
export const MARKER_RULE = [
  { kind: 'pin', title: 'Pin', text: 'exact site or within 1 km' },
  { kind: 'circle', title: 'Circle', text: 'locality or region; radius = stated uncertainty; never jittered' },
  { kind: 'cluster', title: 'Cluster badge', text: '3+ nearby cases; ring = majority category; click to zoom' },
];

/** Legend model from the currently visible cases: categories present (with counts) and grade counts. */
export function legendModel(cases) {
  const cats = new Map(),
    grades = new Map(GRADES.map((g) => [g.k, 0])),
    marks = { pin: 0, circle: 0 };
  for (const c of cases) {
    cats.set(c.category, (cats.get(c.category) || 0) + 1);
    const g = c._gc || 'Other';
    grades.set(g, (grades.get(g) || 0) + 1);
    marks[isPrecise(c.coord_precision) ? 'pin' : 'circle']++;
  }
  return {
    categories: [...cats]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([k, n]) => ({ k, n, color: catColor(k), icon: catIcon(k) })),
    grades: GRADES.map((g) => ({ k: g.k, label: g.label, desc: g.desc, color: g.color, n: grades.get(g.k) || 0 })),
    marks,
    total: cases.length,
  };
}

/** Compact count for status chips: 999, 1.2k, 12k, 1.3M (tabular in CSS). */
export function compact(n) {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1e6) return Math.floor(n / 1000) + 'k';
  return (Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '') + 'M';
}
