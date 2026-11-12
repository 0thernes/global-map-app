// Wars / conflicts / genocides: country glow driven by sourced per-year deaths + ranked list synced to the timeline.
import { ctx, st, $, esc, fmt, on, dateToDay, civil, dayLabel, layerById } from './app_core.js';
import { ensureLayer } from './layers.js';

const METRICS = [
  ['deaths_high', 'Deaths (high estimate)'],
  ['deaths_low', 'Deaths (low estimate)'],
  ['year_best', 'Deaths this year (UCDP BRD best)'],
  ['civilians', 'Civilian toll (one-sided violence)'],
  ['displaced', 'Displaced people'],
];
let items = [];
export function initConflicts() {
  on('conflicts-loaded', (p) => {
    items = p.items.map(prep);
    mergeQwm();
    renderList();
    updateConflictGlow(true);
  });
  on('layers-changed', () => {
    mergeQwm();
  });
  on('time', () => {
    if (!$('#wars').hidden) renderList();
  });
  $('#wars-close').onclick = () => toggleWars(false);
}
function prep(c) {
  return {
    ...c,
    _s: dateToDay(c.start),
    _e: c.end ? dateToDay(c.end) : c.ongoing_as_of ? dateToDay('2026-11-11') : dateToDay(c.start),
    _ys: civil(dateToDay(c.start)).y,
  };
}
function mergeQwm() {
  const l = layerById('map_conflicts');
  if (!l || !l.items || l._merged) return;
  l._merged = true;
  for (const r of l.items)
    items.push({
      id: r.id,
      name: r.name,
      type: (r.subtype || r.category || '').toLowerCase().includes('genocide') ? 'genocide' : r.subtype || 'conflict',
      start: r.start || r.date_low || r.date,
      end: r.end || r.date_high || '',
      peak: r.peak ? { year: +String(r.peak).slice(0, 4), src: r.source_title || 'QWM map_conflicts' } : null,
      deaths:
        r.deaths_low || r.deaths_high
          ? { low: +r.deaths_low || null, high: +r.deaths_high || null, src: r.source_title || r.source_url }
          : null,
      displaced: r.displaced ? { value: +r.displaced, src: r.source_title || r.source_url } : null,
      civilians: null,
      countries: r.country_iso ? [r.country_iso] : [],
      lat: r.lat,
      lon: r.lon,
      url: r.source_url,
      source: r.source_title || 'QWM map_conflicts',
      dataset: 'QWM',
      rank: r.rank,
    });
  items = items.map((c) => (c._s != null ? c : prep(c)));
  renderList();
}
export async function toggleWars(show) {
  const w = $('#wars');
  const s = show ?? w.hidden;
  w.hidden = !s;
  document.body.classList.toggle('wars-open', s);
  if (s) {
    const l = layerById('conflicts');
    if (!l.loaded) {
      l.on = true;
      await ensureLayer(l);
    }
    renderList();
  }
}
function metricVal(c, m, y) {
  if (m === 'deaths_high') return c.deaths ? (c.deaths.high ?? c.deaths.best) : null;
  if (m === 'deaths_low') return c.deaths ? (c.deaths.low ?? c.deaths.best) : null;
  if (m === 'year_best') return c.peryear && c.peryear[y] ? c.peryear[y].best : null;
  if (m === 'civilians') return c.civilians ? (c.civilians.high ?? c.civilians.best ?? c.civilians.value) : null;
  if (m === 'displaced') return c.displaced ? (c.displaced.high ?? c.displaced.value) : null;
}
const range = (o) =>
  !o
    ? ''
    : o.low != null && o.high != null && o.low !== o.high
      ? `${fmt(o.low)}–${fmt(o.high)}`
      : fmt(o.best ?? o.high ?? o.low ?? o.value);
export function activeConflicts(day = st.cur) {
  const cf = st.conf;
  return items.filter((c) => c._s <= day && day <= c._e && cf.types.has(c.type) && cf.datasets.has(c.dataset));
}
function renderList() {
  const el = $('#wars-body');
  if (!el) return;
  const y = civil(st.cur).y;
  const m = st.conf.metric;
  const act = activeConflicts();
  const rows = act.map((c) => ({ c, v: metricVal(c, m, y) })).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const types = ['interstate', 'civil', 'civil (internationalized)', 'extra-state', 'genocide'];
  el.innerHTML = `<div class="wars-head"><label>Rank by <select id="w-metric">${METRICS.map(([k, l]) => `<option value="${k}" ${k === m ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
   <div class="chips">${types.map((t) => `<button class="chip ${st.conf.types.has(t) ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
   <div class="chips">${['UCDP', 'COW', 'Genocide (recognized sources)', 'QWM'].map((t) => `<button class="chip ${st.conf.datasets.has(t) ? 'on' : ''}" data-d="${esc(t)}">${esc(t)}</button>`).join('')}</div>
   <p class="muted small">${act.length} active on ${esc(dayLabel(st.cur))}. Blank = no sourced figure. Ranges shown where sources disagree.</p></div>
   <table class="wars"><thead><tr><th>#</th><th>Conflict</th><th>Start · peak · end</th><th>Deaths</th><th>Civilians</th><th>Displaced</th></tr></thead><tbody>
   ${rows
     .map(
       (
         { c, v },
         i,
       ) => `<tr data-id="${esc(c.id)}" tabindex="0"><td class="mono">${i + 1}</td><td><b>${esc(c.name)}</b><br><small>${esc(c.type)} · ${esc(c.location || '')}</small></td>
     <td class="mono small">${esc(c.start || '')}<br>${c.peak ? `peak ${c.peak.year}` : '<span class="muted">no sourced peak</span>'}<br>${esc(c.end || (c.ongoing_as_of ? 'ongoing' : ''))}</td>
     <td class="mono" title="${esc(c.deaths ? c.deaths.src : '')}">${range(c.deaths)}${m === 'year_best' && v != null ? `<br><small>${y}: ${fmt(v)}</small>` : ''}</td>
     <td class="mono" title="${esc(c.civilians ? c.civilians.src : '')}">${range(c.civilians)}</td><td class="mono" title="${esc(c.displaced ? c.displaced.src : '')}">${range(c.displaced)}</td></tr>`,
     )
     .join('')}</tbody></table>
   <p class="muted small">${esc(ctx.conflicts ? ctx.conflicts.source : '')}. ${esc(ctx.conflicts ? ctx.conflicts.note || '' : '')}</p>`;
  $('#w-metric').onchange = (e) => {
    st.conf.metric = e.target.value;
    renderList();
  };
  el.querySelectorAll('[data-t]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = st.conf.types;
        s.has(b.dataset.t) ? s.delete(b.dataset.t) : s.add(b.dataset.t);
        renderList();
        updateConflictGlow(true);
      }),
  );
  el.querySelectorAll('[data-d]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = st.conf.datasets;
        s.has(b.dataset.d) ? s.delete(b.dataset.d) : s.add(b.dataset.d);
        renderList();
        updateConflictGlow(true);
      }),
  );
  el.querySelectorAll('tr[data-id]').forEach(
    (tr) => (tr.onclick = () => flyToConflict(items.find((c) => c.id === tr.dataset.id))),
  );
}
function flyToConflict(c) {
  if (!c) return;
  if (c.lat != null) return ctx.globe.flyTo(+c.lat, +c.lon, 2.0);
  const cc = (c.countries || []).map((i) => ctx.countryByIso[i]).filter(Boolean);
  if (!cc.length) return;
  ctx.globe.flyTo(cc[0].ly, cc[0].lx, 2.2);
  flashCountries(cc.map((x) => x.i));
}
function flashCountries(ids) {
  const g = ctx.globe;
  ids.forEach((i) => (g.glowData[i * 4] = 255));
  g.glowTex.needsUpdate = true;
  setTimeout(() => updateConflictGlow(true), 1500);
}
let lastYear = null;
export function updateConflictGlow(force) {
  const g = ctx.globe;
  if (!g || !items.length) return;
  const y = civil(st.cur).y;
  const l = layerById('conflicts');
  const key = y + ':' + (l && l.on);
  if (!force && key === lastYear) return;
  lastYear = key;
  g.glowData.fill(0);
  g.earthU.glowOn.value = l && l.on ? 1 : 0;
  if (l && l.on)
    for (const c of activeConflicts()) {
      let v;
      const py = c.peryear || {};
      const hasPy = Object.keys(py).length > 0;
      if (hasPy) {
        const b = py[y] ? py[y].best : 0;
        v = b ? Math.min(1, 0.25 + Math.log10(1 + b) / 5.5) : 0.12;
      } // swell/fade with sourced annual deaths
      else v = 0.45; // flat glow between start and end when no per-year figures exist
      if (c.dataset === 'COW') v *= 0.55; // COW lists participant states, not only where fighting happened
      for (const iso of c.countries || []) {
        const cc = ctx.countryByIso[iso];
        if (cc) g.glowData[cc.i * 4] = Math.max(g.glowData[cc.i * 4], Math.round(v * 255));
      }
    }
  g.glowTex.needsUpdate = true;
}
