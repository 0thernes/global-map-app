// OSINT console chrome (v1.4, ADR 0004): command-bar status strip and clocks, activity bar state, map legend, map
// tools, selection reticle, hover card, density and high-contrast themes. Reads the shared symbology
// (src/ui/symbology.js) and shortcut registry (src/ui/shortcuts.js); never invents data: every number shown is a
// count of loaded rows, and every label comes from a row field or the grading policy (src/grades.js).
import { ctx, st, $, $$, esc, on, emit, filteredCases, dayLabel, NDAYS, gradeColor } from '../app_core.js';
import { icon } from '../icons.js';
import { emptyState } from './states.js';
import { legendModel, markerOf, catColor, catIcon, compact, MARKER_RULE, GRADE_GAUGE } from './symbology.js';
import { SHORTCUTS, overlay } from './shortcuts.js';
import { utc, zoned, ageDays } from './clock.js';
import { LIVE, onLive } from '../live_feeds.js';
import { initTips } from './tips.js';

const LSK = { density: 'gm.ui.density', contrast: 'gm.ui.contrast', legend: 'gm.ui.legend' };
const ls = {
  get: (k, d) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
const keyOf = Object.fromEntries(SHORTCUTS.filter((s) => s.key != null).map((s) => [s.id, s.kbd.join(' ')]));

// ---------------------------------------------------------------- activity bar
// button id -> [window element id or state test, registry id]
const ACT = {
  'btn-layers': [() => railOpen('layers'), 'layers'],
  'btn-filters': [() => railOpen('filters'), 'filters'],
  'btn-wars': ['wars', 'wars'],
  'btn-analyze': ['analysis', 'analyze'],
  'btn-hotspots': ['hotspots', 'hotspots'],
  'btn-charts': ['charts', 'charts'],
  'btn-graph': ['graph', 'graph'],
  'btn-compare': [() => document.body.classList.contains('comparing'), 'compare'],
  'btn-reports': ['reports', 'reports'],
  'btn-data': ['datap', 'data'],
  'btn-index': ['reference', 'index'],
  'btn-brief': ['brief', 'brief'],
  'btn-feed': ['feed', 'feed'],
};
function railOpen(tab) {
  if (document.body.classList.contains('rail-collapsed')) return false;
  const p = $('#pane-' + tab);
  return !!p && !p.hidden;
}
function syncActbar() {
  for (const [id, [test]] of Object.entries(ACT)) {
    const b = document.getElementById(id);
    if (!b) continue;
    const on = typeof test === 'function' ? test() : !document.getElementById(test)?.hidden;
    b.setAttribute('aria-pressed', String(!!on));
  }
  const lg = $('#btn-legend');
  if (lg) lg.setAttribute('aria-pressed', String(legendState() === 'open'));
}
function initActbar(railTab) {
  for (const [id, [, rid]] of Object.entries(ACT)) {
    const b = document.getElementById(id);
    if (!b) continue;
    const label = b.getAttribute('aria-label');
    b.title = `${label} (${keyOf[rid] || b.dataset.key})`;
    b.setAttribute('aria-keyshortcuts', b.dataset.key || '');
  }
  // rail buttons: a click on the active rail view collapses the rail (editor-style), otherwise opens that tab
  const rail = (tab) => () => {
    if (railOpen(tab)) $('#rail-toggle').click();
    else railTab(tab);
    syncActbar();
  };
  $('#btn-layers').onclick = rail('layers');
  $('#btn-filters').onclick = rail('filters');
  // synchronous with the change (a MutationObserver batches already): no stale pressed state while frames lag
  const mo = new MutationObserver(syncActbar);
  for (const el of $$('.panel, #rail .pane, #legend'))
    mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncActbar();
}

// ---------------------------------------------------------------- status strip + clocks
function liveDot(id, name) {
  const s = LIVE[id];
  const txt =
    s.state === 'ok'
      ? `${name}: ${s.n} items, fetched ${new Date(s.t).toISOString().slice(11, 16)}Z`
      : s.state === 'error'
        ? `${name}: failed (${s.err || 'network'})`
        : s.state === 'loading'
          ? `${name}: loading`
          : `${name}: not loaded (open the feed or switch the live layer on)`;
  return `<span class="live live-${s.state}" title="${esc(txt)}"><i aria-hidden="true"></i><span class="lv-n">${esc(name)}</span><span class="sr-only"> ${esc(s.state)}</span></span>`;
}
function renderStatus() {
  const el = $('#statusbar');
  if (!el) return;
  const m = legendModel(filteredCases());
  const built = (window.GM_CATALOG && window.GM_CATALOG.built) || '';
  const age = ageDays(built);
  el.innerHTML =
    `<span class="st-total" title="Cases that pass the current filters at the timeline date (same count as the Layers panel)"><b class="mono">${m.total.toLocaleString('en-US')}</b> cases</span>` +
    `<span class="st-grades" role="group" aria-label="Filter cases by evidence grade">${m.grades
      .map((g) => {
        const on = st.f.grades.has(g.k);
        return `<button type="button" class="gchip" data-grade="${esc(g.k)}" aria-pressed="${on}" style="--c:${g.color}" title="${esc(g.label)}: ${g.n.toLocaleString('en-US')} cases. ${esc(g.desc)} Click to ${on ? 'remove this grade from' : 'add this grade to'} the grade filter."><i aria-hidden="true"></i><span class="gl">${esc(g.k === 'Official record' ? 'Official' : g.k === 'Online claim' ? 'Online' : g.k === 'Testimony' ? 'TE' : g.k)}</span> <b class="mono">${compact(g.n)}</b></button>`;
      })
      .join('')}</span>` +
    `<span class="st-fresh" title="Dataset built ${esc(built.replace('T', ' '))}${age != null ? ` (${age} d ago)` : ''}; latest dated case ${esc(dayLabel(NDAYS))}">${icon('database', 14)}<span class="mono">${esc(built.slice(0, 10))}</span></span>` +
    `<span class="st-live" aria-label="Live feeds">${liveDot('usgs', 'USGS')}${liveDot('eonet', 'EONET')}</span>`;
}
// grade chips in the status strip are filters (the same set as the Filters panel's Grade chips)
function bindStatus() {
  $('#statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('.gchip[data-grade]');
    if (!b) return;
    const k = b.dataset.grade;
    st.f.grades.has(k) ? st.f.grades.delete(k) : st.f.grades.add(k);
    emit('filters');
  });
}
function tickClock() {
  const d = new Date();
  const u = $('#clk-utc'),
    p = $('#clk-pt');
  if (!u) return;
  // seconds sit in their own span so narrow screens can hide them (css/console.css)
  const sec = (t) => t.replace(/:(\d\d)(Z?)$/, '<span class="sec">:$1</span>$2');
  u.innerHTML = sec(utc(d));
  u.dateTime = d.toISOString();
  const z = zoned(d);
  p.innerHTML = sec(z.time);
  $('#clk-pt-z').textContent = z.zone;
  p.parentElement.title = `US Pacific (America/Los_Angeles), ${z.date}`;
  u.parentElement.title = `Coordinated Universal Time, ${d.toISOString().slice(0, 10)}`;
}

// ---------------------------------------------------------------- legend
// v1.5: legend glyphs drawn like the globe sprites (src/cesium/icons.js): a pin is a ring gauge with crosshair
// ticks; a circle is dashed with a hollow diamond centre (ADR 0005 section 4)
const arcPath = (f, r = 6.2, c = 10) => {
  if (f >= 1) return `<circle cx="${c}" cy="${c}" r="${r}"/>`;
  const a = -Math.PI / 2 + f * 2 * Math.PI;
  const x = (c + r * Math.cos(a)).toFixed(2),
    y = (c + r * Math.sin(a)).toFixed(2);
  return `<path d="M${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}"/>`;
};
const pinSVG = (c = 'var(--accent)', f = 1) =>
  `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><g fill="none" stroke="${c}"><circle cx="10" cy="10" r="6.2" stroke-opacity="0.35" stroke-width="1.6"/><g stroke-width="2.4">${arcPath(f)}</g><path d="M10 0.5v3M10 16.5v3M0.5 10h3M16.5 10h3" stroke-width="1.6"/></g><circle cx="10" cy="10" r="2.2" fill="${c}"/></svg>`;
const circSVG = (c = 'var(--accent)') =>
  `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="1.4" stroke-dasharray="2.6 2.4"/><path d="M10 7.4 12.6 10 10 12.6 7.4 10z" fill="none" stroke="${c}" stroke-width="1.3"/></svg>`;
export const gaugeSVG = (k, c = 'var(--fg)') => pinSVG(c, GRADE_GAUGE[k] ?? 0.25);
const clusterSVG = () =>
  `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9.5" fill="#0b1220" stroke="var(--accent)" stroke-width="2"/><text x="11" y="14.5" text-anchor="middle" font-size="9" font-weight="700" fill="#e6f1f7">12</text></svg>`;
export const GLYPH = { pin: pinSVG, circle: circSVG, cluster: clusterSVG };
function renderLegend() {
  const el = $('#legend-body');
  if (!el || $('#legend').hidden) return;
  const m = legendModel(filteredCases());
  // the collapsed chip keeps the pin vs circle rule visible: counts of each marker kind
  $('#legend-sum').innerHTML =
    `<span title="Pins: exact site or within 1 km">${GLYPH.pin()}${m.marks.pin.toLocaleString('en-US')}</span>` +
    `<span title="Uncertainty circles: locality or region, never jittered">${GLYPH.circle()}${m.marks.circle.toLocaleString('en-US')}</span>`;
  if (legendState() !== 'open') return;
  // markers always show (they carry the pin vs circle rule); categories and grades fold, open by default on
  // tall screens, and keep the user's choice for the session
  const open = (k) => ((lgOpen[k] ?? innerHeight >= 960) ? ' open' : '');
  el.innerHTML =
    `<h3 class="lg-h">Markers</h3><ul class="lg-marks">${MARKER_RULE.map(
      (r) =>
        `<li>${GLYPH[r.kind]()}<span><b>${esc(r.title)}</b> <span class="muted">${esc(r.text)}</span></span>${r.kind === 'cluster' ? '' : `<b class="mono n">${m.marks[r.kind].toLocaleString('en-US')}</b>`}</li>`,
    ).join('')}</ul>` +
    `<details data-lg="cats"${open('cats')}><summary class="lg-h">Categories <span class="mono">${m.categories.length}</span></summary><ul class="lg-cats">${
      m.categories
        .map(
          (c) =>
            `<li style="--c:${c.color}"><span class="ci" aria-hidden="true">${icon(c.icon, 14)}</span><span class="cn">${esc(c.k)}</span><b class="mono n">${c.n.toLocaleString('en-US')}</b></li>`,
        )
        .join('') ||
      `<li>${emptyState('No cases pass the filters', { compact: true, detail: 'Clear a filter or widen the date range.' })}</li>`
    }</ul></details>` +
    `<details data-lg="grades"${open('grades')}><summary class="lg-h">Grades <span class="muted small">pin ring = weight</span></summary><ul class="lg-grades">${m.grades
      .filter((g) => g.n)
      .map(
        (g) =>
          `<li style="--c:${g.color}" title="${esc(g.desc)}">${gaugeSVG(g.k, g.color)}${esc(g.label)} <b class="mono">${g.n.toLocaleString('en-US')}</b></li>`,
      )
      .join('')}</ul></details>`;
  for (const d of el.querySelectorAll('details')) d.ontoggle = () => (lgOpen[d.dataset.lg] = d.open);
}
const lgOpen = {};
// legend states (v1.4 polish): 'chip' (default: a compact chip docked bottom-left above the timeline), 'open'
// (expanded upward from the chip) and 'off' (hidden from Settings). Remembered in localStorage.
function legendState() {
  const v = ls.get(LSK.legend, 'chip');
  return v === 'open' || v === 'off' ? v : 'chip';
}
function applyLegend() {
  const el = $('#legend');
  const s = legendState();
  el.hidden = s === 'off';
  el.classList.toggle('collapsed', s !== 'open');
  $('#legend-toggle').setAttribute('aria-expanded', String(s === 'open'));
  renderLegend();
  syncActbar();
}
/** K and the map-tools button: expand / collapse (and show the legend again if Settings hid it). */
export function toggleLegend(open) {
  const s = legendState();
  ls.set(LSK.legend, (open ?? s !== 'open') ? 'open' : 'chip');
  applyLegend();
}
function showLegend(on) {
  ls.set(LSK.legend, on ? 'chip' : 'off');
  applyLegend();
}

// ---------------------------------------------------------------- density, contrast
function applyTheme() {
  const d = ls.get(LSK.density, 'comfortable');
  const hc = ls.get(LSK.contrast, '0') === '1';
  document.body.classList.toggle('density-compact', d === 'compact');
  document.body.classList.toggle('density-comfortable', d !== 'compact');
  document.body.classList.toggle('theme-hc', hc);
  document.documentElement.style.colorScheme = 'dark';
  window.dispatchEvent(new Event('resize'));
}
export function setDensity(d) {
  ls.set(LSK.density, d === 'compact' ? 'compact' : 'comfortable');
  applyTheme();
  status(`Density: ${d === 'compact' ? 'compact (24 px targets)' : 'comfortable (32 px targets)'}`);
}
export const toggleDensity = () =>
  setDensity(document.body.classList.contains('density-compact') ? 'comfortable' : 'compact');
export function setContrast(on) {
  ls.set(LSK.contrast, on ? '1' : '0');
  applyTheme();
  status(`High contrast ${on ? 'on' : 'off'}`);
}
export const toggleContrast = () => setContrast(!document.body.classList.contains('theme-hc'));
const status = (s) => import('../app_core.js').then((m) => m.setStatus(s));
function settingsSection() {
  const host = $('#set-body');
  if (!host || host.querySelector('#set-console')) return;
  const dens = document.body.classList.contains('density-compact') ? 'compact' : 'comfortable';
  host.insertAdjacentHTML(
    'beforeend',
    `<div id="set-console"><h4>${icon('rows-3', 14)} Console</h4>
     <label>Density <select id="s-density"><option value="comfortable" ${dens === 'comfortable' ? 'selected' : ''}>Comfortable (32 px targets)</option><option value="compact" ${dens === 'compact' ? 'selected' : ''}>Compact (24 px targets)</option></select></label>
     <label class="tog"><input type="checkbox" id="s-hc" ${document.body.classList.contains('theme-hc') ? 'checked' : ''}> High contrast (black, white, yellow focus)</label>
     <label class="tog"><input type="checkbox" id="s-legend" ${$('#legend').hidden ? '' : 'checked'}> Map legend (K expands it)</label>
     <p class="small muted">Shortcuts: U density · X contrast · K legend · ? all keys.</p></div>`,
  );
  $('#s-density').onchange = (e) => setDensity(e.target.value);
  $('#s-hc').onchange = (e) => setContrast(e.target.checked);
  $('#s-legend').onchange = (e) => showLegend(e.target.checked);
}

// ---------------------------------------------------------------- help overlay (generated)
function renderHelp() {
  const el = $('#help-body');
  if (!el) return;
  el.innerHTML = overlay()
    .map(
      (g) =>
        `<section class="hk"><h4>${esc(g.group)}</h4><table class="kv keys">${g.rows
          .map(
            (r) =>
              `<tr><th>${r.kbd.map((k) => `<kbd>${esc(k)}</kbd>`).join(' ')}${r.alt ? ` <span class="muted">or</span> <kbd>${esc(r.alt)}</kbd>` : ''}</th><td>${esc(r.label)}</td></tr>`,
          )
          .join('')}</table></section>`,
    )
    .join('');
}

// ---------------------------------------------------------------- hover card + selection reticle
/** Hover card HTML for a picked item (case or reference row). Only row fields; nothing invented. */
export function hoverCard(it, kind) {
  if (kind === 'case') {
    const m = markerOf(it);
    const col = catColor(it.category, it.subtype);
    return `<div class="hc-head" style="--c:${col}"><span class="ci">${icon(catIcon(it.category), 16)}</span><b>${esc(it.name || '(unnamed)')}</b></div>
      <div class="hc-row"><span class="mono">${esc(dayLabel(it._day))}</span><span>${esc(it.category)}</span></div>
      <div class="hc-row"><span class="badge" style="--c:${gradeColor(it._gc)}">${esc(it._gc)}</span><span class="pbadge ${m.kind === 'pin' ? 'pin' : 'circ'}">${esc(m.text)}</span></div>
      <div class="hc-src"><span class="muted">coord_source</span> ${esc(it.coord_source || 'not stated')}</div>
      <div class="hc-foot muted">click for the dossier and sources</div>`;
  }
  const why = it.why_weird ? `<div class="why">${esc(it.why_weird)}</div>` : '';
  return `<div class="hc-head"><span class="ci">${icon('map-pin', 16)}</span><b>${esc(it.name || it.conflict || '(unnamed)')}</b></div>
    <div class="hc-row"><span class="mono">${esc(it.date ? dayLabel(it._day) : '')}</span><span>${esc(it.kind || it.type || it.subtype || '')}</span></div>${
      it.coord_precision || it.coord_source
        ? `<div class="hc-src"><span class="muted">coord_source</span> ${esc(it.coord_source || it.coord_precision)}</div>`
        : ''
    }${why}`;
}
let reticle = null;
function frameReticle() {
  const it = st.selected;
  const g = ctx.globe;
  if (!reticle) reticle = $('#sel-reticle');
  if (!it || it.lat == null || $('#dossier').hidden || !g) {
    if (!reticle.hidden) reticle.hidden = true;
    return;
  }
  const p = g.project(+it.lat, +it.lon);
  if (!p) {
    reticle.hidden = true;
    return;
  }
  let size = 44;
  if (it._r && it.coord_precision && !/^(exact_site|within_1km)$/.test(it.coord_precision)) {
    const q = g.project(Math.min(89.9, +it.lat + it._r / 111.2), +it.lon);
    if (q) size = Math.max(44, Math.min(480, 2 * Math.hypot(q.x - p.x, q.y - p.y) + 16));
  }
  reticle.hidden = false;
  const s = reticle.style;
  s.transform = `translate(${Math.round(p.x - size / 2)}px, ${Math.round(p.y - size / 2)}px)`;
  s.width = s.height = Math.round(size) + 'px';
}

// ---------------------------------------------------------------- init
let pend = 0;
const soon = () => {
  if (pend) return;
  pend = requestAnimationFrame(() => {
    pend = 0;
    renderStatus();
    renderLegend();
  });
};
export function initConsole({ railTab }) {
  applyTheme();
  initTips();
  initActbar(railTab);
  renderHelp();
  // legend: a collapsed chip by default (it still carries the pin vs circle counts); the choice is remembered
  if (!['chip', 'open', 'off'].includes(ls.get(LSK.legend, 'chip'))) ls.set(LSK.legend, 'chip'); // v1.4 beta values
  $('#legend-toggle').onclick = () => toggleLegend();
  $('#btn-legend').onclick = () => toggleLegend();
  on('filters', soon);
  on('layers-changed', soon);
  let lastDay = null;
  on('time', () => {
    // during playback the date changes every frame: refresh the counts at most 4 times a second
    if (lastDay !== null && Math.abs(st.cur - lastDay) < 1) return;
    lastDay = st.cur;
    clearTimeout(initConsole._t);
    initConsole._t = setTimeout(soon, 250);
  });
  onLive(soon);
  tickClock();
  setInterval(() => !document.hidden && tickClock(), 1000);
  ctx.hooks.frame3 = frameReticle;
  // settings window: append the console section whenever it renders
  new MutationObserver(settingsSection).observe($('#set-body'), { childList: true });
  bindStatus();
  renderStatus();
  applyLegend();
  // test hooks (test/ui_views.mjs): restore the default theme between views
  window.__uiReset = () => {
    ls.set(LSK.density, 'comfortable');
    ls.set(LSK.contrast, '0');
    applyTheme();
  };
  window.__legend = (s) => {
    ls.set(LSK.legend, s);
    applyLegend();
  };
  emit('console-ready');
}
