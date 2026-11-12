// Layer registry: every toggleable layer, its legend, source and how to build it on the globe.
import { ctx, st, L, loadLayer, dateToDay, PALETTE, emit, setStatus } from './app_core.js';

const ENV_COLOR = { atmospheric: '#ff9a3c', underground: '#b07cff', underwater: '#3fa9ff', surface: '#ffd23f', space: '#ffffff', 'high-altitude': '#e0f0ff' };
export const MAP_LAYER_STYLE = {
  // QWM layer drops (/workspace/qwm/wiw/data/map/map_<id>.csv). Case-type files go into the Cases layer instead.
  map_nuclear_tests: { name: 'Nuclear tests (1945-2017)', group: 'Military & nuclear', color: '#ff9a3c', legend: Object.entries(ENV_COLOR).map(([k, v]) => [k, v]), timeAware: true },
  map_nuclear_sites: { name: 'Nuclear sites (QWM / Wikidata)', group: 'Military & nuclear', color: '#ffe14d' },
  map_military_bases: { name: 'Military bases (QWM seeds)', group: 'Military & nuclear', color: '#9fb8ff', merged: 'military' },
  map_conflicts: { name: 'Conflicts (QWM ranked)', group: 'Conflicts', color: '#ff5a2b', timeAware: true },
  map_weird_coordinates: { name: 'Weird coordinates (breadcrumbs)', group: 'Anomalies & ancient sites', color: '#7dff6a', shape: 3 },
  map_pyramids: { name: 'Pyramids', group: 'Anomalies & ancient sites', color: '#ffcf6b' },
  map_megaliths: { name: 'Megaliths & monoliths', group: 'Anomalies & ancient sites', color: '#d8c39a' },
  map_caves_underground: { name: 'Caves & underground', group: 'Anomalies & ancient sites', color: '#a58cff' },
  map_ocean: { name: 'Ocean & seabed', group: 'Anomalies & ancient sites', color: '#3fd0ff' },
  map_offlimits_mountains: { name: 'Off-limits mountains (+ nuclear storage, literal \'secret\' names)', group: 'Anomalies & ancient sites', color: '#c6f0ff', file_hint: 'notes/offlimits_mountains.csv', legend: [['off-limits mountain', '#c6f0ff'], ['nuclear-weapons storage', '#ffe14d'], ["literal 'secret' place name", '#b48cff']] },
  map_ancient_cities_remote_sensing: { name: 'Ancient cities (remote sensing)', group: 'Anomalies & ancient sites', color: '#ff9e57' },
};
export const EXPECTED_CASE_FILES = { map_uap_cit: 'CIT UFO sighting', map_abductions: 'Abduction', map_animal_mutilations: 'Animal mutilation', map_missing_unsolved: 'Missing person', map_uso_water: 'USO (water)', map_satellite_anomalies: 'Satellite anomaly' };
// sub-layer key per item (layer > sub-layer > subtype tree in the Layers panel)
export { SUB_FIELD, nucKind } from './taxonomy.js';
import { SUB_FIELD } from './taxonomy.js';
export const subKey = (l, it) => (SUB_FIELD[l.id] ? SUB_FIELD[l.id](it) : it.subtype || it.category || it.kind || 'all');
export function applySub(l) {
  if (!l.pts) return; const off = l.subOff || new Set();
  ctx.globe.setVis(l.pts, (it) => !off.has(subKey(l, it)));
  if (l.circ) ctx.globe.setCircleVis(l.circ, (it) => !off.has(subKey(l, it)));
  for (const t of l.tiles || []) ctx.globe.setVis(t, (it) => !off.has(subKey(l, it)));
}

const lineL = (id, name, group, file, color, opacity, extra = {}) => L(id, name, 'lines', { group, file, color, opacity, legend: [[name, color]], ...extra });
export function buildRegistry() {
  const cat = window.GM_CATALOG || { expected: {}, ref_layers: [] };
  const Ls = [
    L('cases', 'Cases (all case layers)', 'cases', { group: 'Cases', on: true, loaded: true, legend: Object.entries(PALETTE).filter(([k]) => !k.includes(':')), source: 'data/cases.js built by data/build_data.py from data/sources/*.csv and QWM map_* case files (per-row source_url)' }),
    L('heat', 'Case density heatmap', 'heat', { group: 'Cases', legend: [['density (KDE)', '#ff6a3d']], source: 'computed in-app from the filtered cases (Gaussian KDE)' }),
    L('borders', 'Country borders', 'lod-lines', { group: 'Geography', on: true, files: ['admin0_50', 'admin0_10'], color: 0x9fd8ff, opacity: 0.42, legend: [['borders', '#9fd8ff']] }),
    L('coast', 'Coastlines', 'lod-lines', { group: 'Geography', on: true, files: ['coast50', 'coast10'], color: 0x7fd8ff, opacity: 0.34, legend: [['coast', '#7fd8ff']] }),
    lineL('admin1', 'States / provinces', 'Geography', 'admin1_10', 0x7fb2d8, 0.28, { on: true, minAltHide: 1.6 }),
    L('labels', 'Labels (LOD: continents to postcodes)', 'labels', { group: 'Geography', on: true, legend: [['continents/countries/states/cities/towns/postcodes', '#e6f1f7']] }),
    L('postal', 'Postal / ZIP codes (lazy, zoom in)', 'postal', { group: 'Geography', on: true, legend: [['postcode', '#ffc857']] }),
    lineL('urban', 'Urban areas (Natural Earth)', 'Geography', 'urban', 0xffc857, 0.45),
    lineL('rivers', 'Rivers (NE 10m)', 'Water', 'rivers10', 0x3fa9ff, 0.55),
    lineL('lakes', 'Lakes (NE 10m)', 'Water', 'lakes10', 0x6fd0ff, 0.6),
    lineL('plates', 'Plate boundaries (PB2002)', 'Earth hazards', 'plates', 0xff5a8a, 0.75),
    lineL('faults', 'Active faults (GEM)', 'Earth hazards', 'faults_gem', 0xff9e57, 0.55),
    lineL('qfaults', 'Quaternary faults (USGS, US)', 'Earth hazards', 'faults_usgs', 0xffb36b, 0.45),
    L('volcanoes', 'Volcanoes (Smithsonian GVP)', 'points', { group: 'Earth hazards', file: 'volcanoes', color: '#ff4f2b', legend: [['Holocene volcano', '#ff4f2b']] }),
    L('military', 'Military bases & sites', 'points', { group: 'Military & nuclear', file: 'military', color: '#9fb8ff', legend: [['US DoD (MIRTA)', '#9fb8ff'], ['Wikidata / OSM / QWM seed', '#c7d4ff'], ['fort / historic fortification', '#7f8db0'], ['gendarmerie / police barracks', '#6f7d98']] }),
    L('nuclear', 'Nuclear power reactors (PRIS)', 'points', { group: 'Military & nuclear', file: 'nuclear', color: '#ffd23f', timeAware: true, legend: [['operating', '#ffd23f'], ['shut down / not yet operating', '#8a7a3a']] }),
    L('nuclear_osm', 'Nuclear test sites (OSM)', 'points', { group: 'Military & nuclear', file: 'nuclear_osm', color: '#ff6a3d', legend: [['test site', '#ff6a3d']] }),
    L('conflicts', 'Wars, conflicts & genocides (country glow)', 'conflicts', { group: 'Conflicts', on: true, file: 'conflicts', legend: [['active conflict (intensity by sourced deaths)', '#ff5a2b']] }),
    L('fireballs', 'Fireballs & bolides (NASA JPL CNEOS)', 'points', { group: 'Sky & space', file: 'fireballs', color: '#ffe8a3', timeAware: true, legend: [['fireball (US Government sensors)', '#ffe8a3']] }),
    L('hydrolakes', 'Lakes: HydroLAKES (>=10 km2; 1-10 km2 load by region when zoomed)', 'points', { group: 'Water', file: 'hydrolakes', color: '#5fb8ff', legend: [['depth/volume reported', '#5fb8ff'], ['depth modelled (unmapped depth)', '#2f6aa8']] }),
    L('trenches', 'Oceanic trenches & deeps (Wikidata)', 'points', { group: 'Water', file: 'trenches', color: '#4f7dff', legend: [['trench (nominal centre point)', '#4f7dff'], ['named deep (sounding position)', '#9fb6ff']] }),
    L('gebco_unmapped', 'Seafloor never directly measured (GEBCO 2025 TID)', 'overlay', { group: 'Water', file: 'gebco_unmapped', legend: [['not directly measured', '#2878ff']], opacity: 0.8 }),
    L('ged', 'Conflict events (UCDP GED)', 'ged', { group: 'Conflicts', file: 'ged', legend: [['state-based', '#ff5a2b'], ['non-state', '#ff9e57'], ['one-sided (civilians)', '#ff2b7a']] }),
  ];
  for (const [id, s] of Object.entries(MAP_LAYER_STYLE)) {
    if (s.merged) { Ls.push(L(id, s.name, 'merged', { group: s.group, legend: [[`merged into ${s.merged}`, s.color]], present: !!cat.expected[id], status: cat.expected[id] ? 'merged and deduped into the Military layer' : 'waiting for file' })); continue; }
    const present = (cat.ref_layers || []).includes(id);
    Ls.push(L(id, s.name, 'points', { group: s.group, file: id, color: s.color, shape: s.shape || 0, timeAware: !!s.timeAware, common: true, present, legend: s.legend || [[s.name, s.color]], status: present ? '' : 'waiting for QWM file ' + (s.file_hint || id + '.csv') }));
  }
  for (const [id, c] of Object.entries(EXPECTED_CASE_FILES)) Ls.push(L('exp_' + id, `${c} (${id})`, 'expected', { group: 'Cases', present: !!cat.expected[id], legend: [[c, PALETTE[c]]], status: cat.expected[id] ? 'loaded into Cases' : 'waiting for QWM file ' + id + '.csv' }));
  ctx.layers = Ls; return Ls;
}

// ---- builders ----
export async function ensureLayer(l) {
  if (l.loaded || l.loading) return l.loading;
  l.loading = (async () => {
    const g = ctx.globe; setStatus('loading ' + l.name + '…');
    try {
      if (l.kind === 'lines') { const p = await loadLayer(l.file); l.source = p.source; l.obj = g.addLines(l.id, p, { color: l.color, opacity: l.opacity }); l.payload = p; }
      else if (l.kind === 'lod-lines') { const [a, b] = await Promise.all(l.files.map(loadLayer)); l.source = a.source; l.objs = [g.addLines(l.id + '_lo', a, { color: l.color, opacity: l.opacity }), g.addLines(l.id + '_hi', b, { color: l.color, opacity: l.opacity })]; }
      else if (l.kind === 'points') await buildPoints(l);
      else if (l.kind === 'ged') await buildGed(l);
      else if (l.kind === 'overlay') { const p = await loadLayer(l.file); l.source = p.source; l.payload = p; const im = new Image(); await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = p.uri; }); l.obj = g.addTexOverlay(l.id, im, l.opacity ?? 0.8); l.items = null; }
      else if (l.kind === 'conflicts') { const p = await loadLayer('conflicts'); l.source = p.source; ctx.conflicts = p; emit('conflicts-loaded', p); }
      l.loaded = true; applyLayerVis(l); setStatus('');
    } catch (e) { l.status = 'unavailable: ' + e.message; l.failed = true; setStatus(l.name + ' unavailable'); }
    emit('layers-changed');
  })();
  return l.loading;
}
function normItem(it, l) {
  // common-schema rows (QWM) keep their fields; older reference payloads are mapped onto the same names
  const o = { ...it, _layer: l.id };
  if (l.common) { o._day = dateToDay(it.date_low || it.date); o._t1 = dateToDay(it.date_high); }
  if (l.id === 'nuclear') { o._day = dateToDay(it.operational_from || it.construction_start); o._t1 = dateToDay(it.operational_to); o.source_url = it.url; }
  if (l.id === 'volcanoes') o.source_url = it.url;
  if (l.id === 'fireballs') { o._day = dateToDay(it.date); }
  if (l.id === 'hydrolakes') { o.source_url = 'https://www.hydrosheds.org/products/hydrolakes'; o.name = it.name || `Lake #${it.id} (unnamed)`; o.depth_note = it.vol_src === 3 ? 'unmapped depth: volume and mean depth are modelled (HydroLAKES Vol_src 3), no reported bathymetry' : 'volume reported (HydroLAKES Vol_src ' + it.vol_src + ')'; }
  if (l.id === 'military' || l.id === 'nuclear_osm') o.source_url = it.url || it.seed_url || (it.src === 'MIRTA' ? 'https://catalog.data.gov/dataset/military-installations-ranges-and-training-areas' : '');
  return o;
}
async function buildPoints(l) {
  const p = await loadLayer(l.file); l.source = p.source; l.payload = p;
  const raw = p.items || (p.rows || []).map((r) => Object.fromEntries(p.cols.map((c, i) => [c, r[i]])));
  const items = raw.map((it) => normItem(it, l)); if (p.coord_notes) items.forEach((it) => { if (!it.coord_note && p.coord_notes[it.src]) it.coord_note = p.coord_notes[it.src]; }); l.items = items; ctx.refs[l.id] = items;
  if (p.status) l.status = p.status;
  const env = (it) => String(it.environment || '').toLowerCase();
  const colorFn = l.id === 'map_offlimits_mountains' ? (it) => ({ nuclear_storage: '#ffe14d', literal_name: '#b48cff' })[it.category] || l.color : l.id === 'trenches' ? (it) => (it.kind === 'deep' ? '#9fb6ff' : '#4f7dff') : l.id === 'hydrolakes' ? (it) => (it.vol_src === 3 ? '#2f6aa8' : '#5fb8ff') : l.id === 'map_nuclear_tests' ? (it) => ENV_COLOR[env(it)] || l.color : l.id === 'nuclear' ? (it) => (/operat/i.test(it.status) ? '#ffd23f' : '#8a7a3a') : l.id === 'military' ? (it) => (it.src === 'MIRTA' ? '#9fb8ff' : /^fort/.test(it.kind || '') ? '#7f8db0' : /^gendarmerie/.test(it.kind || '') ? '#6f7d98' : '#c7d4ff') : () => l.color;
  if (l.id === 'hydrolakes') { const f = colorFn; void f; }
  const sizeFn = l.id === 'hydrolakes' ? (it) => 2.5 + Math.min(7, Math.log10(1 + it.area_km2) * 1.6) : l.id === 'fireballs' ? (it) => 3 + Math.min(7, Math.log10(1 + +it.impact_energy_kt * 10) * 3) : l.id === 'map_nuclear_tests' ? (it) => 3.5 + Math.min(6.5, Math.log10(1 + (+it.yield_kt_high || +it.yield_kt || 1)) * 1.8) : l.id === 'military' ? () => 4 : () => 5.5;
  const timeAware = !!l.timeAware || (l.common && items.some((i) => isFinite(i._day)));
  const shapeFn = l.shape ? () => l.shape : (it) => (it.coord_precision && !['exact_site', 'within_1km'].includes(it.coord_precision) ? 2 : (l.common ? 1 : 0));
  l.pts = ctx.globe.addPoints(l.id, items, { colorFn, sizeFn, shapeFn, timeAware, t0Fn: (it) => it._day, t1Fn: (it) => it._t1, mode: l.id === 'map_nuclear_tests' ? 1 : 0, radius: 1.0035 });
  l.pts.u.history.value = 0.35; l.pts.u.flash.value = 120;
  const imprecise = items.filter((it) => it.coord_precision && !['exact_site', 'within_1km'].includes(it.coord_precision));
  if (imprecise.length) { const PR = { locality: 10, region: 100, unspecified: 25 }; l.circ = ctx.globe.addCircles(l.id, imprecise, { colorFn, radiusKmFn: (it) => +it.coord_radius_km || PR[it.coord_precision] || 25, t0Fn: (it) => (isFinite(it._day) ? it._day : -1e9), timeAware, opacity: 0.5 }); }
}
async function buildGed(l) {
  const p = await loadLayer('ged'); l.source = p.source; l.payload = p; const F = p.fields; const ix = Object.fromEntries(F.map((f, i) => [f, i]));
  const VC = { 1: '#ff5a2b', 2: '#ff9e57', 3: '#ff2b7a' };
  const items = p.events.map((e) => ({ lat: e[ix.lat], lon: e[ix.lon], date: e[ix.date], events: e[ix.events], best: e[ix.best], low: e[ix.low], high: e[ix.high], vt: e[ix.violence_type], conflict: p.conflicts[e[ix.conflict]] ?? e[ix.conflict], country: e[ix.country], _day: dateToDay(e[ix.date]), _layer: 'ged' }));
  l.items = items; ctx.refs.ged = items;
  l.pts = ctx.globe.addPoints('ged', items, { colorFn: (it) => VC[it.vt] || '#ff5a2b', sizeFn: (it) => 2.5 + Math.min(7, Math.log10(1 + it.best) * 2.2), t0Fn: (it) => it._day, timeAware: true, mode: 1, radius: 1.003, opacity: 0.85 });
  l.pts.u.flash.value = 90; l.pts.u.history.value = st.gedHistory ? 0.25 : 0.0;
}
export function applyLayerVis(l) {
  const g = ctx.globe; const vis = !!l.on;
  if (l.obj) l.obj.visible = vis;
  if (l.objs) { const alt = g.camera.position.length() - 1; const hi = alt < 0.9; l.objs[0].visible = vis && !hi; l.objs[1].visible = vis && hi; }
  if (l.pts) { l.pts.obj.visible = vis; l.pts.u.opacity.value = l.opacity ?? 1; }
  if (l.circ) l.circ.obj.visible = vis;
  for (const t of l.tiles || []) t.obj.visible = vis;
  if (l.kind === 'overlay' && l.obj) { l.obj.visible = vis; l.obj.material.opacity = l.opacity ?? 0.8; }
  if (l.obj && l.obj.material) l.obj.material.opacity = (l.baseOpacity ??= l.obj.material.opacity) * (l.opacity ?? 1);
}
export async function setLayerOn(id, on) {
  const l = ctx.layers.find((x) => x.id === id); if (!l) return;
  l.on = on; if (on && !l.loaded && ['lines', 'lod-lines', 'points', 'ged', 'conflicts', 'overlay'].includes(l.kind)) await ensureLayer(l);
  applyLayerVis(l); emit('layers-changed');
}
export function layerItemsOn() { return ctx.layers.filter((l) => l.on && l.items && l.pts); }

// HydroLAKES 1-10 km2: 10-degree tiles loaded around the camera when zoomed in (alt < 0.6)
const tileLoaded = new Set();
export function hydroTiles(alt, lat, lon) {
  const l = ctx.layers.find((x) => x.id === 'hydrolakes'); if (!l || !l.on || !l.loaded || alt > 0.6 || !l.payload) return;
  const have = new Set(l.payload.tiles || []);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const k = `${Math.floor(lat / 10) * 10 + dy * 10}_${(((Math.floor(lon / 10) * 10 + dx * 10 + 180) % 360) + 360) % 360 - 180}`;
    if (!have.has(k) || tileLoaded.has(k)) continue; tileLoaded.add(k);
    loadLayer('hydrolakes_tiles/' + k).then((p) => {
      const items = p.rows.map((r) => normItem(Object.fromEntries(p.cols.map((c, i) => [c, r[i]])), l));
      const t = ctx.globe.addPoints('hydrolakes_' + k, items, { colorFn: (it) => (it.vol_src === 3 ? '#2f6aa8' : '#5fb8ff'), sizeFn: () => 2.5, shapeFn: () => 0, timeAware: false, radius: 1.0034 });
      (l.tiles = l.tiles || []).push(t); l.items.push(...items); applySub(l); applyLayerVis(l); setStatus(`HydroLAKES tile ${k}: ${items.length} lakes 1-10 km2`);
    });
  }
}
