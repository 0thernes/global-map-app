// Convergence hotspots view: computes src/convergence.js over the loaded layers, draws ranked clusters on the globe,
// lists the top 50 in a dock, and opens a cluster dossier. Names come from real places only (nearest GeoNames city
// >= 15k people within 150 km, else the nearest named member record, else the country / ocean at the centroid).
import {
  ctx,
  st,
  $,
  esc,
  fmt,
  emit,
  on,
  S,
  caseVisibleF,
  layerById,
  dayLabel,
  countryIdAt,
  UAP_TYPES,
  loadLayer,
} from './app_core.js';
import { ensureLayer } from './layers.js';
import { computeHotspots, FORMULA, TIERS } from './convergence.js';
import { domainOf } from './report_gen.js';

export const GLYPH = {
  UAP: ['◉', 'UAP / UFO cases'],
  Abduction: ['⇡', 'abductions'],
  'Animal mutilation': ['♉', 'animal mutilations'],
  'Missing person': ['?', 'missing persons'],
  'Human mutilation': ['✚', 'human mutilations'],
  USO: ['≈', 'USO / water cases'],
  Satellite: ['⌖', 'satellite-imagery anomalies'],
  Weird: ['⌗', 'weird coordinates'],
  Ancient: ['△', 'pyramids / megaliths / caves / ancient cities'],
  'Ocean anomaly': ['◒', 'ocean anomalies'],
  'Off-limits mountain': ['⋀', 'off-limits mountains'],
  'Nuclear site': ['☢', 'nuclear sites / reactors'],
  'Nuclear test': ['✹', 'nuclear tests'],
  Military: ['✪', 'military bases'],
  Conflict: ['☠', 'conflict events (UCDP GED)'],
  Volcano: ['▲', 'volcanoes'],
  Fireball: ['☄', 'fireballs (CNEOS)'],
  Lake: ['◌', 'lakes (HydroLAKES >= 10 km2)'],
  'Unmapped seafloor': ['▒', 'seafloor never directly measured (GEBCO TID)'],
};
const CASE_GROUP = (c) =>
  c.category === 'USO (water)'
    ? 'USO'
    : c.category === 'Satellite anomaly'
      ? 'Satellite'
      : UAP_TYPES.includes(c.category) && c.category !== 'Abduction'
        ? 'UAP'
        : GLYPH[c.category]
          ? c.category
          : 'UAP';
const REF_GROUPS = {
  military: 'Military',
  nuclear: 'Nuclear site',
  map_nuclear_sites: 'Nuclear site',
  map_nuclear_tests: 'Nuclear test',
  ged: 'Conflict',
  volcanoes: 'Volcano',
  map_weird_coordinates: 'Weird',
  map_pyramids: 'Ancient',
  map_megaliths: 'Ancient',
  map_caves_underground: 'Ancient',
  map_ancient_cities_remote_sensing: 'Ancient',
  map_ocean: 'Ocean anomaly',
  map_offlimits_mountains: 'Off-limits mountain',
  fireballs: 'Fireball',
  trenches: 'Trench',
  hydrolakes: 'Lake',
};
export const hs = {
  opts: { cellKm: 150, minLayers: 3, pct: 0.9, windowYears: 0 },
  result: null,
  shown: false,
  pop: null,
  mask: null,
};

async function inputs() {
  for (const id of Object.keys(REF_GROUPS)) {
    const l = layerById(id);
    if (l && l.present !== false && !l.loaded) await ensureLayer(l).catch(() => {});
  }
  if (!hs.pop) hs.pop = (await loadLayer('cities15000')).items.map(([n, lon, lat, pop]) => ({ n, lat, lon, pop }));
  if (!hs.mask) {
    const l = layerById('gebco_unmapped');
    if (l) {
      await ensureLayer(l).catch(() => {});
      if (l.payload) hs.mask = await maskFrom(l.payload.uri);
    }
  }
  const recs = [];
  for (const c of ctx.cases)
    if (caseVisibleF(c))
      recs.push({
        lat: c.lat,
        lon: c.lon,
        group: CASE_GROUP(c),
        isCase: true,
        zero: c._zero,
        grade: c._gc,
        prec: c.coord_precision,
        day: c._day,
        src: c.source_url,
        name: c.name,
        id: c.id,
      });
  for (const [id, g] of Object.entries(REF_GROUPS)) {
    const l = layerById(id);
    for (const it of (l && l.items) || [])
      if (!(id === 'military' && /^(fort|gendarmerie)/.test(it.kind || '')))
        recs.push({
          lat: +it.lat,
          lon: +it.lon,
          group: g,
          day: isFinite(it._day) ? it._day : null,
          src: it.source_url || it.dataset || id,
          name: it.name || it.conflict || '',
          ref: id,
        });
  }
  return recs;
}
function maskFrom(uri) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 512;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0, 1024, 512);
      res({ w: 1024, h: 512, d: x.getImageData(0, 0, 1024, 512).data });
    };
    im.onerror = () => res(null);
    im.src = uri;
  });
}
const unmappedAt = (lat, lon) => {
  const m = hs.mask;
  if (!m) return false;
  const x = Math.min(m.w - 1, Math.floor(((lon + 180) / 360) * m.w)),
    y = Math.min(m.h - 1, Math.floor(((90 - lat) / 180) * m.h));
  return m.d[(y * m.w + x) * 4 + 3] > 0;
};

export async function computeAll() {
  const recs = await inputs();
  const o = hs.opts;
  const win = o.windowYears > 0 ? [st.cur - o.windowYears * 365.25, st.cur] : null;
  // unmapped seafloor joins as one pseudo-record per occupied cell centre (a property of the cell, not an event)
  const r0 = computeHotspots(recs, hs.pop, { cellKm: o.cellKm, minLayers: 1, pct: 0, window: win });
  const extra = [];
  if (hs.mask)
    for (const c of r0.cells)
      if (unmappedAt(c.lat, c.lon))
        extra.push({ lat: c.lat, lon: c.lon, group: 'Unmapped seafloor', src: 'GEBCO 2025 TID' });
  const res = computeHotspots(recs.concat(extra), hs.pop, {
    cellKm: o.cellKm,
    minLayers: o.minLayers,
    pct: o.pct,
    window: win,
  });
  for (const cl of res.clusters) cl.name = nameFor(cl);
  hs.result = res;
  emit('hotspots', res);
  return res;
}
function nameFor(cl) {
  let best = null,
    bd = 150;
  for (const p of hs.pop) {
    if (Math.abs(p.lat - cl.lat) > 2) continue;
    const d = S.haversine(cl.lat, cl.lon, p.lat, p.lon);
    if (d < bd || (best && d < bd * 1.5 && p.pop > best.pop * 4 && d < 150)) {
      if (d < bd) bd = d;
      best = p;
    }
  }
  if (best) return `${best.n} cluster`;
  let nm = null,
    nd = Infinity;
  for (const r of cl.recs) {
    if (!r.name) continue;
    const d = S.haversine(cl.lat, cl.lon, r.lat, r.lon);
    if (d < nd) {
      nd = d;
      nm = r.name;
    }
  }
  if (nm) return `${nm.split(/[(,:]/)[0].trim()} cluster`;
  const c = ctx.countryById[countryIdAt(cl.lat, cl.lon)];
  return c ? `${c.name} cluster` : `Open ocean ${cl.lat.toFixed(1)}, ${cl.lon.toFixed(1)} cluster`;
}
export const glyphRow = (cl, html = true) => {
  const tot = Object.values(cl.groups).reduce((a, b) => a + b, 0) || 1;
  const g = Object.entries(cl.groups).sort((a, b) => b[1] - a[1]);
  return html
    ? g
        .map(
          ([k, v]) =>
            `<span class="gl" title="${esc(GLYPH[k] ? GLYPH[k][1] : k)}: ${((100 * v) / tot).toFixed(0)}% of score" style="font-size:${(11 + 9 * Math.sqrt(v / tot)).toFixed(0)}px">${GLYPH[k] ? GLYPH[k][0] : '•'}</span>`,
        )
        .join('')
    : g.map(([k]) => (GLYPH[k] ? GLYPH[k][0] : '•')).join('');
};
function draw() {
  const g = ctx.globe;
  const res = hs.result;
  if (ctx.hsCirc) ctx.hsCirc.obj.visible = false;
  ctx.labels.removeSet('hotspots');
  if (!hs.shown || !res) return;
  const top = res.clusters.slice(0, 50);
  ctx.hsCirc = g.addCircles('hotspots', top, {
    colorFn: (c) => c.tierColor,
    radiusKmFn: (c) => Math.max(hs.opts.cellKm * 0.7, Math.sqrt(c.cells.length) * hs.opts.cellKm * 0.75),
    timeAware: false,
    opacity: 1,
  });
  ctx.labels.addSet(
    'hotspots',
    top.map((c, i) => ({ name: `${c.tier} · ${c.name} ${glyphRow(c, false)}`, lat: c.lat, lon: c.lon, pri: i })),
    { font: '600 12px Rajdhani, Inter, sans-serif', color: '#ffe8a3', dot: '#ffe8a3', limit: 50, z: 9, dy: -14 },
  );
}
export function toggleHotspots(show) {
  const el = $('#hotspots');
  hs.shown = show ?? el.hidden;
  el.hidden = !hs.shown;
  document.body.classList.toggle('hotspots-open', hs.shown);
  if (hs.shown) {
    render();
    if (!hs.result) run();
    else draw();
  } else draw();
}
async function run() {
  $('#hs-list').innerHTML = '<p class="muted">Loading layers and scoring cells…</p>';
  await new Promise((r) => setTimeout(r, 20));
  await computeAll();
  render();
  draw();
}
function render() {
  const o = hs.opts;
  const res = hs.result;
  $('#hs-opts').innerHTML =
    `<label>Cell <select id="hs-cell">${[50, 100, 150, 250, 400].map((k) => `<option ${k === o.cellKm ? 'selected' : ''}>${k}</option>`).join('')}</select> km</label>
    <label>Min. layers <input id="hs-min" type="number" min="1" max="12" value="${o.minLayers}"></label>
    <label>Top <select id="hs-pct">${[
      [0.8, '20%'],
      [0.9, '10%'],
      [0.95, '5%'],
      [0.99, '1%'],
    ]
      .map(([v, t]) => `<option value="${v}" ${v === o.pct ? 'selected' : ''}>${t}</option>`)
      .join('')}</select> of cells</label>
    <label>Time window <select id="hs-win">${[
      [0, 'all time'],
      [1, '1 yr'],
      [5, '5 yr'],
      [10, '10 yr'],
      [25, '25 yr'],
    ]
      .map(([v, t]) => `<option value="${v}" ${v === o.windowYears ? 'selected' : ''}>${t}</option>`)
      .join('')}</select> <small>ending at the timeline date</small></label>
    <button class="btn primary sm" id="hs-run">Recompute</button>`;
  $('#hs-run').onclick = () => {
    o.cellKm = +$('#hs-cell').value;
    o.minLayers = +$('#hs-min').value;
    o.pct = +$('#hs-pct').value;
    o.windowYears = +$('#hs-win').value;
    run();
  };
  if (!res) return;
  $('#hs-formula').innerHTML =
    `<details><summary>Formula and evidence grade</summary><p class="small">${esc(FORMULA)}</p><p class="small">${TIERS.map((t) => `<span class="tier" style="--c:${t[2]}">${t[0]}</span>`).join(' ')}</p><p class="small muted">Correlation, not causation: co-location of layers says nothing about a common cause. Reference layers (bases, reactors, lakes) are dense where people and infrastructure are; the population factor reduces but does not remove that.</p></details>`;
  $('#hs-list').innerHTML =
    `<p class="small muted">${fmt(res.cells.length)} occupied cells · ${fmt(res.clusters.length)} clusters with ≥ ${o.minLayers} layers in the top ${Math.round((1 - o.pct) * 100)}% of cell scores</p><ol class="hsl">${res.clusters
      .slice(0, 50)
      .map(
        (c, i) =>
          `<li><button class="hsb" data-i="${i}"><span class="tier" style="--c:${c.tierColor}" title="evidence E = ${c.E.toFixed(2)}">${c.tier}</span><b>${esc(c.name)}</b><span class="glyphs">${glyphRow(c)}</span><small>${c.D} layers · ${fmt(c.n)} records · score ${c.score.toFixed(1)}</small></button></li>`,
      )
      .join('')}</ol>`;
  $('#hs-list')
    .querySelectorAll('.hsb')
    .forEach((b) => (b.onclick = () => openCluster(res.clusters[+b.dataset.i])));
}
export function openCluster(cl) {
  ctx.globe.flyTo(cl.lat, cl.lon, 1.35, 1800);
  const by = {};
  for (const r of cl.recs) (by[r.group] = by[r.group] || []).push(r);
  const span = cl.first != null ? `${dayLabel(cl.first)} → ${dayLabel(cl.last)}` : 'undated';
  // co-occurrence in time: case records within ±365 days of a dated reference event in the same cluster
  const cases = cl.recs.filter((r) => r.isCase && r.day != null);
  const evts = cl.recs.filter((r) => !r.isCase && r.day != null);
  const co = cases.filter((c) => evts.some((e) => Math.abs(e.day - c.day) <= 365)).length;
  const srcs = [...new Set(cl.recs.map((r) => domainOf(r.src) || r.src).filter(Boolean))];
  $('#hs-dossier').hidden = false;
  $('#hs-dossier').innerHTML =
    `<header><h3><span class="tier" style="--c:${cl.tierColor}">${cl.tier}</span> ${esc(cl.name)}</h3><button class="close" id="hsd-close" aria-label="Close">×</button></header>
  <p class="glyphs big">${glyphRow(cl)}</p>
  <table class="kv"><tr><th>Centre</th><td class="mono">${cl.lat.toFixed(3)}, ${cl.lon.toFixed(3)}</td></tr><tr><th>Cells</th><td>${cl.cells.length} × ~${hs.opts.cellKm} km</td></tr><tr><th>Time span</th><td>${esc(span)}</td></tr>
  <tr><th>Score</th><td>${cl.score.toFixed(2)} (D = ${cl.D} layers)</td></tr><tr><th>Evidence E</th><td>${cl.E.toFixed(2)} = 0.5 × ${cl.strong.toFixed(2)} (CIT/Official share) + 0.3 × ${cl.precise.toFixed(2)} (exact/1 km share) + 0.2 × min(1, ${cl.sources}/5) (sources)</td></tr>
  <tr><th>Co-occurrence</th><td>${co} of ${cases.length} dated cases within ±1 year of a dated reference event in the cluster</td></tr></table>
  <h4>Score by layer</h4><table class="kv">${Object.entries(cl.groups)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) =>
        `<tr><th>${GLYPH[k] ? GLYPH[k][0] : ''} ${esc(k)}</th><td>${v.toFixed(2)} <small>(${(by[k] || []).length} records)</small></td></tr>`,
    )
    .join('')}</table>
  <h4>Members</h4>${Object.entries(by)
    .map(
      ([k, rs]) =>
        `<details><summary>${esc(k)} (${rs.length})</summary><ul class="rel">${rs
          .slice(0, 60)
          .map(
            (r) =>
              `<li>${r.id ? `<a href="#" data-goto="${esc(r.id)}">${esc(r.name || r.id)}</a>` : esc(r.name || '(unnamed)')} <small>${r.day != null ? esc(dayLabel(r.day)) : ''} ${r.grade ? '· ' + esc(r.grade) : ''}</small></li>`,
          )
          .join('')}${rs.length > 60 ? `<li class="muted">+${rs.length - 60} more</li>` : ''}</ul></details>`,
    )
    .join('')}
  <h4>Sources (${srcs.length})</h4><p class="small">${srcs.slice(0, 40).map(esc).join(' · ')}</p>
  <p class="note">Correlation, not causation. A hotspot shows that several layers occur in the same cells; it is not evidence that they are related.</p>`;
  $('#hsd-close').onclick = () => ($('#hs-dossier').hidden = true);
  $('#hs-dossier')
    .querySelectorAll('[data-goto]')
    .forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          const c = ctx.cases.find((x) => x.id === a.dataset.goto);
          if (c) import('./ui_panels.js').then((m) => m.openDossier(c));
        }),
    );
}
export function initHotspots() {
  $('#hs-close').onclick = () => toggleHotspots(false);
  on('time', () => {
    if (hs.shown && hs.opts.windowYears > 0 && !st.playing) {
      clearTimeout(hs._t);
      hs._t = setTimeout(run, 400);
    }
  });
}
