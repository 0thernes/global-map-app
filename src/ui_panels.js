// Top bar (search, export, workspace), left rail (layers, filters), dossier panel with cross-links.
import { ctx, st, $, $$, esc, fmt, link, row, emit, on, S, filteredCases, catColor, PALETTE, CASE_CATS, GRADES, gradeColor, ERAS, SPECIAL_AREAS, PRECISE, dayLabel, download, toCSV, COMMON, setStatus, layerById, caseSub } from './app_core.js';
import { setLayerOn, ensureLayer, applyLayerVis } from './layers.js';
import { setDay } from './ui_timeline.js';
import { loadCaseDetails } from './loader.js';
import { subKey, applySub } from './layers.js';

export function initPanels() {
  // ---------- search (typeahead over cases, reference items, countries) ----------
  const inp = $('#search'), res = $('#search-results'); let sel = -1, hits = [];
  const run = () => {
    const q = inp.value.trim().toLowerCase(); hits = []; sel = -1;
    if (q.length < 2) { res.hidden = true; return; }
    for (const c of ctx.cases) if (c._search.includes(q)) hits.push({ t: 'case', it: c, label: c.name, sub: `${c.category} · ${dayLabel(c._day)} · ${c._area}` });
    for (const l of ctx.layers) if (l.items && l.kind !== 'ged') for (const it of l.items) { if (hits.length > 60) break; if (String(it.name || '').toLowerCase().includes(q)) hits.push({ t: l.id, it, label: it.name, sub: l.name }); }
    if (ctx.countries) for (const c of ctx.countries.countries) if (c.name.toLowerCase().includes(q)) hits.push({ t: 'country', it: c, label: c.name, sub: 'country · ' + c.continent });
    hits = hits.slice(0, 40);
    res.innerHTML = hits.length ? hits.map((h, i) => `<li role="option" data-i="${i}"><span class="dot" style="background:${h.t === 'case' ? catColor(h.it.category) : '#9db1c2'}"></span><b>${hl(h.label, q)}</b><small>${esc(h.sub)}</small></li>`).join('') + `<li class="foot">Enter: open · Shift+Enter: filter cases by “${esc(q)}”</li>` : '<li class="foot">No matches in loaded data</li>';
    res.hidden = false;
  };
  const hl = (s, q) => { s = String(s || ''); const i = s.toLowerCase().indexOf(q); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length)); };
  const go = (h) => { res.hidden = true; if (h.t === 'country') { ctx.globe.flyTo(h.it.ly, h.it.lx, 1.9); return; } openDossier(h.it, h.t); };
  inp.addEventListener('input', run);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('li', res).forEach((li, i) => li.classList.toggle('active', i === sel)); }
    else if (e.key === 'Enter') { if (e.shiftKey) { st.f.q = inp.value.trim().toLowerCase(); emit('filters'); res.hidden = true; } else if (hits[Math.max(0, sel)]) go(hits[Math.max(0, sel)]); }
    else if (e.key === 'Escape') { res.hidden = true; inp.blur(); }
  });
  res.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) go(hits[+li.dataset.i]); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.searchbox')) res.hidden = true; });

  // ---------- export ----------
  $('#btn-export').onclick = () => toggleMenu('#menu-export');
  $('#exp-csv').onclick = () => exportCases('csv'); $('#exp-geojson').onclick = () => exportCases('geojson');
  $('#exp-ws').onclick = () => download('globalmap-workspace.json', JSON.stringify(workspace(), null, 2), 'application/json');
  $('#imp-ws').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then((t) => restore(JSON.parse(t))); };
  $('#ws-save').onclick = () => { localStorage.setItem('gm-workspace', JSON.stringify(workspace())); setStatus('Workspace saved in this browser'); };
  $('#ws-load').onclick = () => { const s = localStorage.getItem('gm-workspace'); if (s) restore(JSON.parse(s)); else setStatus('No saved workspace yet'); };

  // ---------- rail tabs ----------
  $$('#rail .tab').forEach((t) => (t.onclick = () => railTab(t.dataset.tab)));
  $('#rail-toggle').onclick = () => document.body.classList.toggle('rail-collapsed');
  renderLayers(); renderFilters();
  on('layers-changed', renderLayers); on('filters', () => { renderFilters(); countLine(); }); on('time', countLine); on('countries-loaded', renderFilters);
  $('#dossier-close').onclick = closeDossier;
  countLine();
}
function toggleMenu(sel) { const m = $(sel); m.hidden = !m.hidden; if (!m.hidden) setTimeout(() => document.addEventListener('click', function h(e) { if (!e.target.closest(sel) && !e.target.closest('[data-menu]')) { m.hidden = true; document.removeEventListener('click', h); } }), 0); }
export function railTab(t) { document.body.classList.remove('rail-collapsed'); $$('#rail .tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === t)); $$('#rail .pane').forEach((p) => (p.hidden = p.id !== 'pane-' + t)); }
function countLine() { const n = filteredCases().length; const all = ctx.cases.length; $('#count').innerHTML = `<b>${n}</b> of ${all} cases shown at ${esc(dayLabel(st.cur))}` + (st.f.lasso ? ' · lasso' : '') + (st.f.range ? ' · date range' : '') + (st.f.q ? ` · “${esc(st.f.q)}”` : ''); }

// ---------- layers ----------
export function renderLayers() {
  const el = $('#pane-layers'); const groups = {};
  for (const l of ctx.layers) (groups[l.group] = groups[l.group] || []).push(l);
  el.innerHTML = Object.entries(groups).map(([g, ls]) => `<section class="lg"><h4>${esc(g)}</h4>${ls.map((l) => layerRow(l) + subTree(l)).join('')}</section>`).join('') +
    `<section class="lg"><h4>Display</h4>
      <label class="tog"><input type="checkbox" id="opt-cluster" ${st.clustering ? 'checked' : ''}> Cluster cases when zoomed out</label>
      <label class="tog"><input type="checkbox" id="opt-light" ${st.lighting ? 'checked' : ''}> Day/night lighting from the timeline date</label>
      <label class="tog"><input type="checkbox" id="opt-rot" ${st.autoRotate ? 'checked' : ''}> Auto-rotate</label>
      <label class="tog"><input type="checkbox" id="opt-nuct" ${st.nucTime ? 'checked' : ''}> Reactors only while operating (timeline)</label>
      <label class="tog"><input type="checkbox" id="opt-gedh" ${st.gedHistory ? 'checked' : ''}> Keep past conflict events faintly visible</label></section>`;
  el.querySelectorAll('[data-layer]').forEach((cb) => (cb.onchange = () => setLayerOn(cb.dataset.layer, cb.checked)));
  el.querySelectorAll('[data-op]').forEach((r) => (r.oninput = () => { const l = layerById(r.dataset.op); l.opacity = +r.value; applyLayerVis(l); }));
  // tri-state tree: sub-layers (reference layers) and category > subtype (cases)
  el.querySelectorAll('input[data-tri]').forEach((cb) => { cb.indeterminate = cb.dataset.tri === 'mixed'; });
  el.querySelectorAll('[data-sub]').forEach((cb) => (cb.onchange = () => { const l = layerById(cb.dataset.sub); l.subOff = l.subOff || new Set(); cb.checked ? l.subOff.delete(cb.dataset.k) : l.subOff.add(cb.dataset.k); applySub(l); renderLayers(); }));
  el.querySelectorAll('[data-subs-all]').forEach((cb) => (cb.onchange = () => { const l = layerById(cb.dataset.subsAll); l.subOff = cb.checked ? new Set() : new Set(Object.keys(subCounts(l))); applySub(l); renderLayers(); }));
  el.querySelectorAll('[data-ccat]').forEach((cb) => (cb.onchange = () => { const k = cb.dataset.ccat; cb.checked ? st.f.catOff.delete(k) : st.f.catOff.add(k); for (const key of [...st.f.subOff]) if (key.startsWith(k + '|')) st.f.subOff.delete(key); emit('filters'); renderLayers(); }));
  el.querySelectorAll('[data-csub]').forEach((cb) => (cb.onchange = () => { const k = cb.dataset.csub; cb.checked ? st.f.subOff.delete(k) : st.f.subOff.add(k); emit('filters'); renderLayers(); }));
  el.querySelectorAll('[data-info]').forEach((b) => (b.onclick = () => { b.closest('.lrow').querySelector('.lsrc').classList.toggle('open'); }));
  $('#opt-cluster').onchange = (e) => { st.clustering = e.target.checked; emit('filters'); };
  $('#opt-light').onchange = (e) => { st.lighting = e.target.checked; };
  $('#opt-rot').onchange = (e) => { st.autoRotate = e.target.checked; };
  $('#opt-nuct').onchange = (e) => { st.nucTime = e.target.checked; const l = layerById('nuclear'); if (l.pts) l.pts.u.timeAware.value = st.nucTime ? 1 : 0; };
  $('#opt-gedh').onchange = (e) => { st.gedHistory = e.target.checked; const l = layerById('ged'); if (l.pts) l.pts.u.history.value = st.gedHistory ? 0.25 : 0; };
}
function subCounts(l) { const m = {}; for (const it of l.items || []) { const k = subKey(l, it); m[k] = (m[k] || 0) + 1; } return m; }
function subTree(l) {
  if (l.id === 'cases') {
    const cats = {}; for (const c of ctx.cases) { const e = (cats[c.category] = cats[c.category] || { n: 0, subs: {} }); e.n++; const sk = caseSub(c); e.subs[sk] = (e.subs[sk] || 0) + 1; }
    return `<details class="tree"><summary>Categories &amp; subtypes</summary>${Object.entries(cats).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => {
      const subs = Object.entries(e.subs).sort((a, b) => b[1] - a[1]); const offN = subs.filter(([sk]) => st.f.subOff.has(k + '|' + sk)).length;
      const on = !st.f.catOff.has(k); const tri = on && offN && offN < subs.length ? 'mixed' : '';
      return `<div class="tnode"><label><input type="checkbox" data-ccat="${esc(k)}" data-tri="${tri}" ${on && offN < subs.length ? 'checked' : ''}><i class="sw" style="background:${catColor(k)}"></i>${esc(k)} <span class="n">${fmt(e.n)}</span></label>
      ${subs.length > 1 || (subs[0] && subs[0][0]) ? `<div class="tkids">${subs.slice(0, 40).map(([sk, n]) => `<label><input type="checkbox" data-csub="${esc(k + '|' + sk)}" ${on && !st.f.subOff.has(k + '|' + sk) ? 'checked' : ''}>${esc(sk || '(no subtype)')} <span class="n">${fmt(n)}</span></label>`).join('')}${subs.length > 40 ? `<small class="muted">+${subs.length - 40} more subtypes</small>` : ''}</div>` : ''}</div>`; }).join('')}</details>`;
  }
  if (!l.items || !l.pts) return '';
  const m = subCounts(l); const keys = Object.entries(m).sort((a, b) => b[1] - a[1]); if (keys.length < 2) return '';
  const off = l.subOff || new Set(); const offN = keys.filter(([k]) => off.has(k)).length;
  return `<details class="tree"><summary><input type="checkbox" data-subs-all="${l.id}" data-tri="${offN && offN < keys.length ? 'mixed' : ''}" ${offN < keys.length ? 'checked' : ''} aria-label="all sub-layers"> Sub-layers (${keys.length})</summary><div class="tkids">${keys.slice(0, 40).map(([k, n]) => `<label><input type="checkbox" data-sub="${l.id}" data-k="${esc(k)}" ${off.has(k) ? '' : 'checked'}>${esc(k)} <span class="n">${fmt(n)}</span></label>`).join('')}</div></details>`;
}
function layerRow(l) {
  const waiting = l.present === false; const dis = waiting || l.kind === 'expected' || l.kind === 'merged';
  const cnt = l.items ? ` <span class="n">${fmt(l.items.length)}</span>` : l.id === 'cases' ? ` <span class="n">${ctx.cases.length}</span>` : '';
  const leg = (l.legend || []).slice(0, 8).map(([k, c]) => `<span class="lgd"><i style="background:${c}"></i>${esc(k)}</span>`).join('');
  return `<div class="lrow ${waiting ? 'waiting' : ''}">
    <label><input type="checkbox" data-layer="${l.id}" ${l.on ? 'checked' : ''} ${dis ? 'disabled' : ''}> <span>${esc(l.name)}</span>${cnt}${l.loading && !l.loaded ? ' <span class="spin" aria-label="loading"></span>' : ''}</label>
    ${dis ? '' : `<input type="range" class="op" min="0" max="1" step="0.05" value="${l.opacity ?? 1}" data-op="${l.id}" title="opacity" aria-label="${esc(l.name)} opacity">`}
    <button class="info" data-info="${l.id}" title="source & legend" aria-label="source">i</button>
    <div class="lsrc">${leg}<div class="src">${esc(l.status || '')}${l.status ? '<br>' : ''}${esc(l.source || 'source shown once loaded; see CREDITS.md')}</div></div></div>`;
}

// ---------- filters ----------
export function renderFilters() {
  const el = $('#pane-filters'); const f = st.f; const all = ctx.cases;
  const count = (fn) => all.filter(fn).length;
  const chip = (group, key, label, color, n) => `<button class="chip ${f[group].has(key) ? 'on' : ''}" data-g="${group}" data-k="${esc(key)}" aria-pressed="${f[group].has(key)}">${color ? `<i style="background:${color}"></i>` : ''}${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`;
  const areas = new Set(all.map((c) => c._area).filter(Boolean)); const countryNames = ctx.countries ? ctx.countries.countries.map((c) => c.name).sort() : [];
  el.innerHTML = `
    <div class="fhead"><span id="count2"></span><button class="btn sm ghost" id="f-clear">Clear all</button></div>
    <h4>Category</h4><div class="chips">${CASE_CATS.map((c) => chip('cats', c, c, PALETTE[c], count((x) => x.category === c))).join('')}</div>
    <h4>Grade</h4><div class="chips">${GRADES.map((g) => chip('grades', g.k, g.label, g.color, count((x) => x._gc === g.k))).join('')}</div>
    <p class="hint">${GRADES.slice(0, 3).map((g) => `<b>${esc(g.label)}</b>: ${esc(g.desc)}`).join('<br>')}</p>
    <h4>Era</h4><div class="chips">${ERAS.map((e) => chip('eras', e[0], e[0], null, count((x) => x._era === e[0]))).join('')}</div>
    <h4>Location precision</h4><div class="chips">${['exact_site', 'within_1km', 'locality', 'region', 'unspecified'].map((p) => chip('prec', p, p.replace('_', ' '), null, count((x) => x.coord_precision === p))).join('')}</div>
    <h4>Country / area <small>(${countryNames.length} Natural Earth admin-0 units + special areas)</small></h4>
    <div class="row"><input id="f-country" list="dl-country" placeholder="type a country, Ocean/International waters, Antarctica, Space…"><button class="btn sm" id="f-country-add">Add</button></div>
    <datalist id="dl-country">${[...SPECIAL_AREAS, ...countryNames].map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="chips">${SPECIAL_AREAS.map((a) => chip('countries', a, a, null, count((x) => x._area === a))).join('')}${[...areas].filter((a) => !SPECIAL_AREAS.includes(a)).sort().map((a) => chip('countries', a, a, null, count((x) => x._area === a))).join('')}${[...f.countries].filter((a) => !areas.has(a) && !SPECIAL_AREAS.includes(a)).map((a) => chip('countries', a, a, null, 0)).join('')}</div>
    <h4>Water <small>(USO / transmedium context; Natural Earth 10 m land, lakes, coastline)</small></h4>
    <div class="chips">${[[null, 'any'], [0, 'over water'], [5, '≤ 5 km of shore'], [25, '≤ 25 km'], [100, '≤ 100 km']].map(([v, t]) => `<button class="chip ${f.water === v ? 'on' : ''}" data-water="${v}" aria-pressed="${f.water === v}">${t}${v != null ? ` <span class="n">${count((x) => x.over_water || (x.shore_km != null && x.shore_km <= v))}</span>` : ''}</button>`).join('')}</div>
    <h4>Data quality</h4><div class="chips"><button class="chip ${f.conflictOnly ? 'on' : ''}" id="f-conf" aria-pressed="${!!f.conflictOnly}">conflicting values between datasets <span class="n">${count((x) => x.conflicts && x.conflicts.length)}</span></button><button class="chip ${f.verify ? 'on' : ''}" id="f-verify" aria-pressed="${!!f.verify}">citation needs verification <span class="n">${count((x) => x.verify)}</span></button></div>
    ${st.f.lasso ? `<p class="hint">Lasso selection active (${st.f.lasso.size}). <button class="btn sm" id="f-lasso-clear">Clear lasso</button></p>` : ''}
    ${st.f.q ? `<p class="hint">Text filter “${esc(st.f.q)}” <button class="btn sm" id="f-q-clear">Clear</button></p>` : ''}`;
  el.querySelectorAll('.chip[data-g]').forEach((b) => (b.onclick = () => { const s = f[b.dataset.g]; s.has(b.dataset.k) ? s.delete(b.dataset.k) : s.add(b.dataset.k); emit('filters'); }));
  el.querySelectorAll('[data-water]').forEach((b) => (b.onclick = () => { f.water = b.dataset.water === 'null' ? null : +b.dataset.water; emit('filters'); }));
  $('#f-conf').onclick = () => { f.conflictOnly = !f.conflictOnly; emit('filters'); };
  $('#f-verify').onclick = () => { f.verify = !f.verify; emit('filters'); };
  $('#f-clear').onclick = () => { for (const k of ['cats', 'grades', 'eras', 'countries', 'prec', 'catOff', 'subOff']) f[k].clear(); f.range = null; f.lasso = null; f.q = ''; f.water = null; f.conflictOnly = false; f.verify = false; emit('filters'); };
  const addC = () => { const v = $('#f-country').value.trim(); if (v) { f.countries.add(v); emit('filters'); } };
  $('#f-country-add').onclick = addC; $('#f-country').onkeydown = (e) => e.key === 'Enter' && addC();
  if ($('#f-lasso-clear')) $('#f-lasso-clear').onclick = () => { f.lasso = null; emit('filters'); };
  if ($('#f-q-clear')) $('#f-q-clear').onclick = () => { f.q = ''; $('#search').value = ''; emit('filters'); };
  $('#count2').textContent = `${filteredCases().length} shown`;
}

// ---------- dossier ----------
const PREC_TXT = { exact_site: 'exact site (pin)', within_1km: 'within 1 km (pin)', locality: 'locality (uncertainty circle)', region: 'region (uncertainty circle)', unspecified: 'unspecified (circle)' };
export function openDossier(it, kind = 'case') {
  if (kind === 'case' && it._chunk != null && !it._full) { // slim row: fetch the full record lazily, then re-render
    loadCaseDetails(it._chunk).then((rows) => { const full = rows.find((r) => r.id === it.id); if (full) for (const [k, v] of Object.entries(full)) if (!(k in it) || k === 'summary') it[k] = v; it._full = true; if (st.selected === it) openDossier(it, kind); }).catch(() => (it._full = true));
  }
  st.selected = it; emit('select', it); const d = $('#dossier'); d.hidden = false; document.body.classList.add('dossier-open');
  const body = $('#dossier-body'); const g = ctx.globe; g.clearArcs();
  if (it.lat != null) g.flyTo(it.lat, it.lon, Math.min(g.camera.position.length(), kind === 'case' ? (PRECISE(it) ? 1.08 : 1 + Math.max(0.12, Math.min(0.6, (it._r || 10) / 250))) : 1.25));
  if (kind === 'case') body.innerHTML = caseHTML(it); else body.innerHTML = refHTML(it, kind);
  body.querySelectorAll('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const c = ctx.cases.find((x) => x.id === a.dataset.goto); if (c) openDossier(c); }));
  body.querySelectorAll('[data-date]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); setDay(+a.dataset.date); }));
  const ex = body.querySelector('#dz-md'); if (ex) ex.onclick = () => download(`dossier-${it.id}.md`, dossierMD(it), 'text/markdown');
  const ph = body.querySelector('#dz-html'); if (ph) ph.onclick = () => { const w = window.open('', '_blank'); w.document.write(`<!doctype html><meta charset=utf-8><title>${esc(it.name)}</title><style>body{font:14px/1.5 Inter,system-ui,sans-serif;max-width:760px;margin:32px auto;color:#111}th{text-align:left;vertical-align:top;padding-right:12px;color:#555}a{color:#0645ad}</style>` + dossierPrintable(it)); w.document.close(); w.print(); };
  const pin = body.querySelector('#dz-pin'); if (pin) pin.onclick = () => { st.pinned.has(it.id) ? st.pinned.delete(it.id) : st.pinned.add(it.id); pin.textContent = st.pinned.has(it.id) ? '★ Pinned' : '☆ Pin'; emit('pinned'); };
  const ld = body.querySelector('#dz-loadrefs'); if (ld) ld.onclick = async () => { for (const id of ['military', 'nuclear', 'map_nuclear_sites', 'volcanoes', 'ged']) { const l = layerById(id); if (l && l.present !== false) await ensureLayer(l); } openDossier(it, kind); };
  if (kind === 'case') for (const r of related(it).slice(0, 8)) g.addArc(it, r.c, 0xffe066, 0.55);
}
export function closeDossier() { $('#dossier').hidden = true; document.body.classList.remove('dossier-open'); st.selected = null; ctx.globe.clearArcs(); emit('select', null); }
const badge = (gc, raw) => `<span class="badge" style="--c:${gradeColor(gc)}" title="${esc(raw || '')}">${esc(gc)}</span>`;
function caseHTML(c) {
  const rel = related(c); const near = nearby(c);
  const dateTxt = `${esc(c.date_original || c.date)}${c.date_precision ? ` <small>(${esc(c.date_precision)})</small>` : ''}` + ((c._hi - c._lo > 1) ? `<br><small>range ${esc(dayLabel(c._lo))} → ${esc(dayLabel(c._hi))}${c.date_disputed ? ' · disputed' : ''}</small>` : '');
  return `<div class="kicker"><span class="dot" style="background:${catColor(c.category, c.subtype)}"></span>${esc(c.category)}${c.subtype ? ' · ' + esc(c.subtype) : ''} ${badge(c._gc, c.grade)} <span class="pbadge ${PRECISE(c) ? 'pin' : 'circ'}">${esc(PREC_TXT[c.coord_precision] || c.coord_precision)}</span></div>
  ${c.conflicts && c.conflicts.length ? `<span class="cbadge" title="Another dataset disagrees on some fields; both values are shown below">conflict</span>` : ''}${c.verify ? `<span class="vbadge" title="${esc(c.verify)}">citation needs verification</span>` : ''}
  <h2>${esc(c.name)}</h2>
  <table class="kv">${row('Date', `<a href="#" data-date="${c._day}">${dateTxt}</a>`)}${row('Place', esc(c.place || [c.locality, c.admin1, c.country].filter(Boolean).join(', ')))}${row('Area', esc(c._area))}
  ${row('Coordinates', `<span class="mono">${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}</span>${PRECISE(c) ? '' : ` <small>± ${fmt(c._r)} km</small>`}`)}${row('Coord. source', esc(c.coord_source))}${row('Urban / rural', esc(c.urban_rural))}${c.shore_km != null ? row('Water', `${c.over_water ? `over ${esc(c.over_water)} · ` : ''}<span class="mono">${fmt(c.shore_km)} km</span> to the nearest shoreline <small>(NE 10m coast + lakes)</small>`) : ''}
  ${row('Grade', esc(c.grade))}${row('Witnesses', esc(c.witnesses))}${row('Witness count', esc(c.witness_count))}${row('Count', esc(c.count))}</table>
  ${c.summary || c.description ? `<h4>What happened</h4><p class="typed">${esc(c.summary || c.description)}</p>` : ''}
  ${conflictsHTML(c)}
  ${c.official_position ? `<h4>Official position</h4><p>${esc(c.official_position)}</p>` : ''}
  <h4>Sources</h4><p>${link(c.source_url, c.source_title || c.source_url)}${c.source_type ? ` <small>(${esc(c.source_type)})</small>` : ''}${c.extra_sources ? '<br>' + String(c.extra_sources).split(/\s*[;|]\s*/).map((u) => link(u)).join('<br>') : ''}</p>
  ${row('Dataset', '') }${c.dataset || c.file ? `<p class="muted small">Dataset: ${esc(c.dataset || '')} ${esc(c.file || '')}${c.origin ? ' · ' + esc(c.origin) : ''}</p>` : ''}
  ${c.notes || c.flag ? `<h4>Notes</h4><p>${esc([c.notes, c.flag].filter(Boolean).join(' · '))}</p>` : ''}
  <h4>Related cases <small>(${rel.length})</small></h4>${rel.length ? `<ul class="rel">${rel.slice(0, 12).map((r) => `<li><a href="#" data-goto="${esc(r.c.id)}"><span class="dot" style="background:${catColor(r.c.category)}"></span>${esc(r.c.name)}</a><small>${esc(r.why.join(' · '))}</small></li>`).join('')}</ul>` : '<p class="muted">None by the link rules (linked_case, same category ≤500 km, ±1 year, shared witnesses/keywords).</p>'}
  <h4>Nearest reference sites</h4>${near.length ? `<table class="kv">${near.map((n) => row(n.layer, `${esc(n.name)} <span class="mono">${fmt(n.d)} km</span>`)).join('')}</table>` : ''}<button class="btn sm" id="dz-loadrefs">Load military / nuclear / conflict layers to compute</button>
  ${imageryHTML(c)}
  <div class="dz-actions"><button class="btn sm" id="dz-pin">${st.pinned.has(c.id) ? '★ Pinned' : '☆ Pin'}</button><button class="btn sm" id="dz-md">Export Markdown</button><button class="btn sm" id="dz-html">Printable</button></div>`;
}
function refHTML(it, kind) {
  const l = layerById(kind); const skip = new Set(['lat', 'lon', '_layer', '_day', '_t1', 'name', 'source_url', 'url', 'seed_url']);
  const kv = Object.entries(it).filter(([k, v]) => !skip.has(k) && !k.startsWith('_') && v !== '' && v != null && typeof v !== 'object');
  const prec = it.coord_precision || (it.coord_note && /approx/i.test(it.coord_note) ? 'approximate (area centre)' : '');
  return `<div class="kicker"><span class="dot" style="background:${(l && l.color) || '#9db1c2'}"></span>${esc(l ? l.name : kind)} ${it.grade ? badge(gradeOf(it.grade), it.grade) : ''} ${prec ? `<span class="pbadge">${esc(prec)}</span>` : ''}</div>
   <h2>${esc(it.name || it.conflict || '(unnamed)')}</h2>
   <table class="kv">${row('Coordinates', `<span class="mono">${(+it.lat).toFixed(4)}, ${(+it.lon).toFixed(4)}</span>`)}${isFinite(it._day) ? row('Date', `<a href="#" data-date="${it._day}">${esc(dayLabel(it._day))}</a>`) : ''}${kv.map(([k, v]) => row(k.replace(/_/g, ' '), esc(v))).join('')}</table>
   ${it.why_weird ? `<h4>Why weird</h4><p>${esc(it.why_weird)}</p>` : ''}
   <h4>Source</h4><p>${link(it.source_url || it.url || it.seed_url, it.source_title)}</p><p class="muted small">${esc(l ? l.source || '' : '')}</p>${imageryHTML(it)}`;
}
import { gradeClass as gradeOf } from './app_core.js';
// both values of every field another dataset disagrees on, each with its record id and source (never silently pick one)
function conflictsHTML(c) {
  if (!c.conflicts || !c.conflicts.length) return '';
  const own = (f) => (f === 'lat' || f === 'lon' ? (+c[f]).toFixed(4) : c[f]);
  return `<h4>Conflicting records <span class="cbadge">conflict</span></h4><table class="kv conf"><tr><th>Field</th><td><b>This record</b> (${esc(c.dataset || c.layer || '')})</td><td><b>Other record</b></td></tr>${c.conflicts.map((x) => `<tr><th>${esc(x.field)}</th><td class="mono">${esc(own(x.field))}</td><td class="mono">${esc(x.other_field_value ?? x.other_value)} <small>· <a href="#" data-goto="${esc(x.other_id)}">${esc(x.other_id)}</a> · ${esc(x.other_dataset || '')}${x.other_source ? ` · ${link(x.other_source, 'source')}` : ''}</small></td></tr>`).join('')}</table>`;
}
// 'view imagery' links + a Sentinel-2 cloudless close-up (EOxCloudless 2016, CC BY 4.0; 2018+ vintages are non-commercial) at the record's coordinates
export function imageryHTML(it) {
  const la = +it.lat, lo = +it.lon; if (!isFinite(la) || !isFinite(lo)) return '';
  const z = 13; const n = 2 ** z; const x = Math.floor(((lo + 180) / 360) * n); const y = Math.floor(((1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2) * n);
  const tiles = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push(`<img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y + dy}/${((x + dx) % n + n) % n}.jpg">`);
  return `<h4>Imagery</h4><details class="imgry"><summary>Sentinel-2 cloudless close-up (loads from EOX when opened)</summary><div class="s2grid">${tiles.join('')}<i class="s2x"></i></div><p class="muted small">EOxCloudless <a href="https://cloudless.eox.at" target="_blank" rel="noopener">https://cloudless.eox.at</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 &amp; 2017), CC BY 4.0. Centre tile contains the point; ~5 km across at this latitude scale.</p></details>
  <p class="imgl">${link(`https://www.google.com/maps/@${la},${lo},2000m/data=!3m1!1e3`, 'Google Maps satellite')} · ${link(`https://s2maps.eu/#lat=${la}&lng=${lo}&zoom=14`, 'EOX Sentinel-2')} · ${link(`https://worldview.earthdata.nasa.gov/?v=${lo - 0.5},${la - 0.3},${lo + 0.5},${la + 0.3}`, 'NASA Worldview')}</p>`;
}
export function related(c) {
  const out = [];
  for (const o of ctx.cases) {
    if (o === c) continue; const why = [];
    if (c._links.includes(o.id) || o._links.includes(c.id)) why.push('linked_case');
    const d = S.haversine(c.lat, c.lon, o.lat, o.lon);
    if (o.category === c.category && d <= 500) why.push(`same category, ${Math.round(d)} km`);
    if (isFinite(c._day) && Math.abs(o._day - c._day) <= 365) why.push(`${Math.abs(o._day - c._day)} days apart`);
    const sw = [...c._toks.wit].filter((x) => o._toks.wit.has(x)); if (sw.length) why.push('shared witness: ' + sw.join(', '));
    const kw = [...c._toks.w].filter((x) => o._toks.w.has(x)); if (kw.length >= 4) why.push('keywords: ' + kw.slice(0, 4).join(', '));
    if (why.length) out.push({ c: o, why, score: (why[0] === 'linked_case' ? 10 : 0) + why.length + (sw.length ? 3 : 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}
export function nearby(c) {
  const out = [];
  for (const id of ['military', 'nuclear', 'map_nuclear_sites', 'map_nuclear_tests', 'volcanoes', 'ged']) {
    const l = layerById(id); if (!l || !l.items) continue; let best = null, bd = Infinity;
    for (const it of l.items) { if (id === 'ged' && (Math.abs(it._day - c._day) > st.coWin)) continue; const d = S.haversine(c.lat, c.lon, it.lat, it.lon); if (d < bd) { bd = d; best = it; } }
    if (best) out.push({ layer: l.name + (id === 'ged' ? ` (±${st.coWin} d)` : ''), name: best.name || best.conflict || '', d: bd });
  }
  return out;
}
function dossierMD(c) {
  const rel = related(c).slice(0, 10);
  return `# ${c.name}\n\n- Category: ${c.category}${c.subtype ? ' / ' + c.subtype : ''}\n- Grade: ${c.grade || ''} (${c._gc})\n- Date: ${c.date_original || c.date} (${c.date_precision || ''})${c._hi - c._lo > 1 ? `; range ${dayLabel(c._lo)} to ${dayLabel(c._hi)}` : ''}\n- Place: ${c.place || ''} (${c._area})\n- Coordinates: ${c.lat}, ${c.lon} (${c.coord_precision}${PRECISE(c) ? '' : ', ±' + c._r + ' km'}); ${c.coord_source}\n- Witnesses: ${c.witnesses || ''}\n\n## What happened\n${c.summary || c.description || ''}\n\n## Official position\n${c.official_position || ''}\n\n## Sources\n- ${c.source_url}${c.extra_sources ? '\n- ' + String(c.extra_sources).split(/\s*[;|]\s*/).join('\n- ') : ''}\n\n## Related\n${rel.map((r) => `- ${r.c.name} (${r.c.date}): ${r.why.join('; ')}`).join('\n')}\n\n## Analyst notes\n${st.notes || ''}\n`;
}
function dossierPrintable(c) { return `<h1>${esc(c.name)}</h1><p>${esc(c.category)} · grade ${esc(c.grade || '')}</p><table>${row('Date', esc(c.date_original || c.date))}${row('Place', esc(c.place || c._area))}${row('Coordinates', `${c.lat}, ${c.lon} (${esc(c.coord_precision)})`)}${row('Coord. source', esc(c.coord_source))}${row('Witnesses', esc(c.witnesses))}</table><h3>What happened</h3><p>${esc(c.summary || c.description || '')}</p><h3>Official position</h3><p>${esc(c.official_position || '')}</p><h3>Source</h3><p>${link(c.source_url)}</p>`; }

// ---------- export ----------
export function exportCases(kind) {
  const rows = filteredCases(); const extra = ['place', 'date_original', 'coord_radius_km', 'witnesses', 'official_position', 'description', 'extra_sources', 'origin', 'file', 'country_display'];
  if (kind === 'csv') download('globalmap-cases-filtered.csv', toCSV(rows, [...COMMON, ...extra]), 'text/csv');
  else download('globalmap-cases-filtered.geojson', JSON.stringify({ type: 'FeatureCollection', features: rows.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: Object.fromEntries([...COMMON, ...extra].filter((k) => !['lat', 'lon'].includes(k) && c[k] != null).map((k) => [k, c[k]])) })) }), 'application/geo+json');
  setStatus(`Exported ${rows.length} cases`);
}
// ---------- workspace ----------
export function workspace() {
  const cam = ctx.globe.camera.position; const f = st.f;
  return { v: 1, saved: new Date().toISOString(), cur: st.cur, hour: st.hour, camera: [cam.x, cam.y, cam.z], layers: ctx.layers.filter((l) => l.on).map((l) => l.id), filters: { cats: [...f.cats], grades: [...f.grades], eras: [...f.eras], countries: [...f.countries], prec: [...f.prec], range: f.range, q: f.q }, notes: st.notes, pinned: [...st.pinned], selected: st.selected && st.selected.id };
}
export function restore(w) {
  st.cur = w.cur; st.hour = w.hour ?? 12; ctx.globe.camera.position.set(...w.camera);
  for (const l of ctx.layers) if (!['expected', 'merged'].includes(l.kind)) setLayerOn(l.id, w.layers.includes(l.id));
  const f = st.f; for (const k of ['cats', 'grades', 'eras', 'countries', 'prec']) f[k] = new Set(w.filters[k] || []); f.range = w.filters.range; f.q = w.filters.q || '';
  st.notes = w.notes || ''; st.pinned = new Set(w.pinned || []); const n = $('#notes'); if (n) n.value = st.notes;
  emit('filters'); emit('time', st.cur); if (w.selected) { const c = ctx.cases.find((x) => x.id === w.selected); if (c) openDossier(c); } setStatus('Workspace restored');
}
