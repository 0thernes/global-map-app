// Reference apparatus: Sources index, Glossary, A-Z cases, Sites, Countries, Coverage, Off-world, Credits. All searchable and
// cross-linked to the globe (click flies there / opens the dossier).
import { ctx, st, $, $$, esc, fmt, link, emit, caseSub } from './app_core.js';
import { GLOSSARY } from './glossary.js';
import { buildCaseIndex, buildSiteIndex, buildCountryIndex, buildSourcesIndex, searchItems } from './index_gen.js';
import { coverageTree } from './coverage.js';
import { AUDIO_CREDITS } from './audio.js';
import { SUB_FIELD } from './layers.js';

const TABS = [['sources', 'Sources'], ['glossary', 'Glossary'], ['az', 'Cases A–Z'], ['sites', 'Sites'], ['countries', 'Countries'], ['coverage', 'Coverage'], ['offworld', 'Off-world'], ['credits', 'Credits']];
let tab = 'glossary', q = '';
export function initReference() {
  $('#ref-close').onclick = () => toggleReference(false);
  $('#ref-tabs').innerHTML = TABS.map(([k, t]) => `<button class="tab" data-rt="${k}">${t}</button>`).join('');
  $$('#ref-tabs [data-rt]').forEach((b) => (b.onclick = () => { tab = b.dataset.rt; render(); }));
  $('#ref-q').oninput = (e) => { q = e.target.value; clearTimeout(initReference.t); initReference.t = setTimeout(render, 120); };
}
export function toggleReference(show, which) {
  const el = $('#reference'); const s = show ?? el.hidden; el.hidden = !s; if (which) tab = which; if (s) render();
}
const DATASETS = () => {
  const cat = window.GM_CATALOG || {};
  const files = (cat.files || []).map((f) => ({ id: f.layer, name: `${f.layer} (${f.file})`, license: 'per row (see source_url); QWM compilation', count: f.plotted, rows: f.rows, note: f.note || '' }));
  const layers = ctx.layers.filter((l) => l.source || l.payload).map((l) => ({ id: l.id, name: l.name, source: l.source || '', count: l.items ? l.items.length : null }));
  return [...files, ...layers];
};
function render() {
  $$('#ref-tabs [data-rt]').forEach((b) => b.classList.toggle('on', b.dataset.rt === tab));
  const out = $('#ref-body'); const Q = q.trim();
  if (tab === 'glossary') {
    const items = searchItems(GLOSSARY, Q, ['term', 'def', 'group']); const groups = {}; for (const g of items) (groups[g.group] = groups[g.group] || []).push(g);
    out.innerHTML = Object.entries(groups).map(([k, gs]) => `<h4>${esc(k)}</h4><dl class="gloss">${gs.map((g) => `<dt id="g-${esc(g.term)}">${esc(g.term)}</dt><dd>${esc(g.def)} <small>${g.src.startsWith('http') ? link(g.src, 'source') : `see ${esc(g.src)}`}</small></dd>`).join('')}</dl>`).join('') || '<p class="muted">No match.</p>';
  } else if (tab === 'sources') {
    const si = buildSourcesIndex(ctx.cases, DATASETS());
    const ds = searchItems(si.datasets, Q, ['name', 'source', 'id']); const dm = searchItems(si.domains, Q, ['domain']);
    out.innerHTML = `<h4>Datasets and layers (${ds.length})</h4><table class="kv idx"><tr><th>Dataset / layer</th><td><b>Records</b></td><td><b>Source and licence</b></td></tr>${ds.map((d) => `<tr><th>${esc(d.name)}</th><td>${d.count != null ? fmt(d.count) : ''}${d.rows != null && d.rows !== d.count ? ` <small>of ${fmt(d.rows)}</small>` : ''}</td><td class="small">${esc(d.source || d.license || '')}${d.note ? ` <i>${esc(d.note)}</i>` : ''}</td></tr>`).join('')}</table>
      <p class="small muted">Full licence list: CREDITS.md and DATA_LICENSE.md in the repository.</p>
      <h4>Source domains cited by cases (${fmt(dm.length)})</h4><table class="kv idx">${dm.slice(0, 400).map((d) => `<tr><th>${link('https://' + d.domain, d.domain)}</th><td>${fmt(d.cases)} cases</td><td><button class="btn sm" data-dom="${esc(d.domain)}">Show on globe</button></td></tr>`).join('')}</table>`;
    out.querySelectorAll('[data-dom]').forEach((b) => (b.onclick = () => { st.f.q = b.dataset.dom; emit('filters'); }));
  } else if (tab === 'az') {
    const ix = buildCaseIndex(searchItems(ctx.cases, Q, ['name', 'id', '_area', 'date']));
    out.innerHTML = `<p class="az-jump">${ix.map((g) => `<a href="#az-${g.letter}">${g.letter}</a>`).join(' ')}</p>${ix.map((g) => `<h4 id="az-${g.letter}">${g.letter} <small>${fmt(g.items.length)}</small></h4><ul class="idxl">${g.items.slice(0, 300).map((c) => `<li><a href="#" data-case="${esc(c.id)}">${esc(c.name)}</a> <small>${esc(c.date)} · ${esc(c.area)}</small></li>`).join('')}${g.items.length > 300 ? `<li class="muted">+${fmt(g.items.length - 300)} more (refine the search)</li>` : ''}</ul>`).join('')}`;
  } else if (tab === 'sites') {
    const si = buildSiteIndex(ctx.layers.filter((l) => l.items && l.kind === 'points'));
    out.innerHTML = si.length ? si.map((L) => { const it = searchItems(L.items, Q, ['name', 'country']); return `<details ${Q ? 'open' : ''}><summary>${esc(L.layerName)} <small>${fmt(it.length)}</small></summary><ul class="idxl">${it.slice(0, 300).map((x) => `<li><a href="#" data-fly="${x.lat},${x.lon}">${esc(x.name)}</a> <small>${esc(x.country)}</small></li>`).join('')}</ul></details>`; }).join('') : '<p class="muted">Turn on reference layers (Layers panel) to index their sites here.</p>';
  } else if (tab === 'countries') {
    const ci = searchItems(buildCountryIndex(ctx.cases, ctx.layers.filter((l) => l.items)), Q, ['area']);
    out.innerHTML = `<table class="kv idx"><tr><th>Country / area</th><td><b>Cases</b></td><td><b>CIT · Official · ST · TE</b></td><td><b>First → last</b></td><td><b>Sites</b></td></tr>${ci.map((c) => `<tr><th><a href="#" data-area="${esc(c.area)}">${esc(c.area)}</a></th><td>${fmt(c.cases)}</td><td class="mono small">${[c.grades.CIT, c.grades['Official record'], c.grades.ST, c.grades.Testimony].map((x) => fmt(x || 0)).join(' · ')}</td><td class="small">${esc(c.first || '')} → ${esc(c.last || '')}</td><td>${fmt(c.sites)}</td></tr>`).join('')}</table>`;
    out.querySelectorAll('[data-area]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); st.f.countries = new Set([a.dataset.area]); emit('filters'); }));
  } else if (tab === 'coverage') renderCoverage(out, Q);
  else if (tab === 'offworld') {
    const ow = (window.GM_CATALOG || {}).offworld || [];
    out.innerHTML = `<p class="small muted">Records about other bodies are never plotted on Earth. Coordinates are planetocentric as published${ow.some((o) => /verify/i.test(o.notes)) ? '; rows marked [verify] need their citation checked' : ''}.</p><table class="kv idx"><tr><th>Body</th><td><b>Record</b></td><td><b>Body lat/lon</b></td><td><b>Grade</b></td><td><b>Source</b></td></tr>${searchItems(ow, Q, ['name', 'body']).map((o) => `<tr><th>${esc(o.body)}</th><td>${esc(o.name)}<br><small>${esc(o.summary || '')}</small>${/verify/i.test(o.notes || '') ? ' <span class="vbadge">citation needs verification</span>' : ''}</td><td class="mono">${esc(o.body_lat || '—')}, ${esc(o.body_lon || '—')}</td><td>${esc(o.grade)}</td><td>${link(o.source_url, 'source')}${o.imagery ? `<br><small>${esc(o.imagery)}</small>` : ''}</td></tr>`).join('')}</table>`;
  } else if (tab === 'credits') {
    out.innerHTML = `<h4>Audio (all CC0 1.0)</h4><table class="kv idx">${AUDIO_CREDITS.map((a) => `<tr><th>${esc(a.use)}</th><td>${esc(a.title)} by ${esc(a.author)} · ${esc(a.license)} · ${link(a.url, 'OpenGameArt')}</td></tr>`).join('')}</table>
      <h4>Fonts (SIL Open Font License 1.1)</h4><p>Rajdhani (Indian Type Foundry) for titles · Inter (Rasmus Andersson) for UI · IBM Plex Mono (IBM) for data. Vendored in vendor/fonts with licences.</p>
      <h4>Icons</h4><p>Lucide (ISC licence), vendor/icons/LICENSE-Lucide.txt.</p>
      <h4>Imagery and maps</h4><p>NASA Blue Marble / Black Marble (public domain) · Natural Earth (public domain) · GEBCO 2025 Grid and TID (GEBCO Compilation Group 2025) · Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data), CC BY 4.0, loaded only when you open a close-up.</p>
      <h4>Data</h4><p>Every dataset and its licence: Sources tab, CREDITS.md and DATA_LICENSE.md. Software: three.js (MIT), d3-force (ISC), marked (MIT).</p>`;
  }
  out.querySelectorAll('[data-case]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const c = ctx.cases.find((x) => x.id === a.dataset.case); if (c) import('./ui_panels.js').then((m) => m.openDossier(c)); }));
  out.querySelectorAll('[data-fly]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const [la, lo] = a.dataset.fly.split(',').map(Number); ctx.globe.flyTo(la, lo, 1.12, 1600); }));
}
export function coverageGroups() {
  const byLayer = {}; for (const c of ctx.cases) (byLayer[c.layer || 'local'] = byLayer[c.layer || 'local'] || []).push(c);
  const g = Object.entries(byLayer).map(([k, rows]) => ({ domain: 'Cases', layer: k, rows, sub: (r) => r.category, subtype: caseSub }));
  for (const l of ctx.layers) if (l.items && l.items.length && l.kind !== 'cases') g.push({ domain: 'Reference', layer: l.name, rows: l.items, sub: SUB_FIELD[l.id] || ((r) => r.subtype || r.category || r.kind || 'all') });
  return g;
}
function renderCoverage(out, Q) {
  const tree = coverageTree(coverageGroups(), { live: ctx.urlLive });
  const P = (x) => (x == null ? '—' : (100 * x).toFixed(0) + '%');
  const bar = (x, c) => `<i class="cbar" style="--w:${Math.round(100 * Math.min(1, x))}%;--c:${c}"></i>`;
  const row = (n, d) => `<tr class="lvl${d}"><th style="padding-left:${8 + d * 14}px">${esc(n.name)} <small class="muted">${n.level}</small></th><td>${fmt(n.depth.n)}</td><td>${n.breadth.countries}</td><td>${n.breadth.decades}</td><td>${n.breadth.sources}</td><td>${P(n.depth.completeness)}</td><td>${P(n.depth.precise)}</td><td>${P(n.depth.graded)}</td><td>${n.depth.corroboration.toFixed(2)}</td><td>${P(n.depth.live)}</td><td>${bar(n.B, '#38e8ff')}${n.B.toFixed(2)}</td><td>${bar(n.D, '#ffd23f')}${n.D.toFixed(2)}</td><td class="prof" data-p="${esc(n.profile)}">${esc(n.profile)}</td></tr>`;
  let h = ''; for (const n of tree) { if (Q && !n.name.toLowerCase().includes(Q.toLowerCase())) continue; h += row(n, 0); for (const c of n.children.slice(0, 30)) { h += row(c, 1); for (const k of c.children) h += row(k, 2); } }
  out.innerHTML = `<p class="small">Breadth = countries/areas (of 249 ISO 3166-1), decades, sources. Depth = field completeness, exact/1 km share, graded share, corroborating records per case, live sources (from the URL audit; — = not checked). Definitions: docs/audit/TAXONOMY.md. Reference layers appear once loaded.</p>
  <table class="cov"><thead><tr><th>Domain › layer › sub-layer › subtype</th><td>Records</td><td>Countries</td><td>Decades</td><td>Sources</td><td>Complete</td><td>Exact</td><td>Graded</td><td>Corrob.</td><td>Live</td><td>Breadth</td><td>Depth</td><td>Profile</td></tr></thead><tbody>${h}</tbody></table>`;
}
