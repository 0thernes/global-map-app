// Keyboard, help, compare (swipe/split), briefings, heatmap, lasso, screenshot, random case, FPS HUD.
import { marked } from 'marked';
import {
  ctx,
  st,
  $,
  esc,
  fmt,
  emit,
  on,
  S,
  filteredCases,
  dateToDay,
  dayToDate,
  dayToISO,
  dayLabel,
  setStatus,
  layerById,
} from './app_core.js';
import { togglePlay, stepTime, drawTimeline } from './ui_timeline.js';
import { railTab, openDossier, closeDossier } from './ui_panels.js';
import { toggleWars } from './ui_conflicts.js';
import { toggleAnalysis } from './ui_analysis.js';
import { toggleCharts } from './ui_charts.js';
import { toggleGraph } from './ui_graph.js';
import { setLayerOn } from './layers.js';

const RDOCKS = ['#wars', '#analysis', '#graph'];
const ex =
  (id, f) =>
  (...a) => {
    if ($(id).hidden)
      for (const d of RDOCKS)
        if (d !== id && !$(d).hidden)
          ({ '#wars': toggleWars, '#analysis': toggleAnalysis, '#graph': toggleGraph })[d](false);
    return f(...a);
  };
const tWars = ex('#wars', () => toggleWars()),
  tAn = ex('#analysis', () => toggleAnalysis()),
  tGraph = ex('#graph', () => toggleGraph());
export function initMisc() {
  // ---- top-bar buttons ----
  const B = {
    '#btn-wars': tWars,
    '#btn-analyze': tAn,
    '#btn-charts': () => toggleCharts(),
    '#btn-graph': tGraph,
    '#btn-compare': () => toggleCompare(),
    '#btn-brief': () => toggleBrief(),
    '#btn-help': () => toggleHelp(),
    '#btn-shot': screenshot,
    '#btn-random': randomCase,
    '#btn-lasso': startLasso,
    '#btn-hotspots': () => import('./ui_hotspots.js').then((m) => m.toggleHotspots()),
    '#btn-reports': () => import('./ui_reports.js').then((m) => m.toggleReports()),
    '#btn-index': () => import('./ui_reference.js').then((m) => m.toggleReference()),
    '#btn-data': () => import('./ui_data.js').then((m) => m.toggleData()),
  };
  for (const [s, f] of Object.entries(B)) $(s).onclick = f;
  $('#help-close').onclick = () => toggleHelp(false);
  $('#brief-close').onclick = () => toggleBrief(false);
  // ---- keyboard ----
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    if (e.key === 'Escape') {
      if (typing) {
        t.blur();
        return;
      }
      return escape();
    }
    if (typing || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === '/') {
      e.preventDefault();
      $('#search').focus();
      $('#search').select();
    } else if (k === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      stepTime((k === 'ArrowLeft' ? '-' : '+') + (e.altKey ? 'Y' : e.shiftKey ? 'M' : 'D'));
    } else if (k === 'l' || k === 'L') railTab('layers');
    else if (k === 'f' || k === 'F') railTab('filters');
    else if (k === 'g' || k === 'G') tGraph();
    else if (k === 'c' || k === 'C') toggleCompare();
    else if (k === 'a' || k === 'A') tAn();
    else if (k === 'v' || k === 'V') toggleCharts();
    else if (k === 'w' || k === 'W') tWars();
    else if (k === 'b' || k === 'B') toggleBrief();
    else if (k === 'r' || k === 'R') randomCase();
    else if (k === 'h' || k === 'H') setLayerOn('heat', !layerById('heat').on);
    else if (k === 'p' || k === 'P') $('#fps').hidden = !$('#fps').hidden;
    else if (k === 's' || k === 'S') startLasso();
    else if (k === '?') toggleHelp();
    else if (k === 'z' || k === 'Z') import('./ui_hotspots.js').then((m) => m.toggleHotspots());
    else if (k === 'e' || k === 'E') import('./ui_reports.js').then((m) => m.toggleReports());
    else if (k === 'i' || k === 'I') import('./ui_reference.js').then((m) => m.toggleReference());
    else if (k === 'd' || k === 'D') import('./ui_data.js').then((m) => m.toggleData());
  });
  // ---- compare ----
  $('#cmp-mode').onchange = (e) => setCompare(e.target.value);
  $('#cmp-date').onchange = (e) => {
    const d = dateToDay(e.target.value);
    if (isFinite(d)) {
      st.curB = d;
      drawTimeline();
    }
  };
  const div = $('#cmp-divider');
  let dr = false;
  div.onpointerdown = (e) => {
    dr = true;
    div.setPointerCapture(e.pointerId);
  };
  div.onpointerup = () => (dr = false);
  div.onpointermove = (e) => {
    if (!dr) return;
    const x = Math.max(0.05, Math.min(0.95, e.clientX / innerWidth));
    ctx.globe.compare.x = x;
    div.style.left = x * 100 + '%';
  };
  // ---- heatmap ----
  on('layers-changed', () => {
    const l = layerById('heat');
    if (l && l.on) {
      heatDirty = true;
    } else if (l && heatWasOn) {
      ctx.globe.hideOverlay();
      heatWasOn = false;
    }
  });
  on('filters', () => (heatDirty = true));
  on('time', () => (heatDirty = true));
  ctx.hooks.heatTick = heatTick;
  // ---- FPS HUD ----
  let lastHud = 0;
  ctx.hooks.frame = (now) => {
    if (now - lastHud < 500 || $('#fps').hidden) return;
    lastHud = now;
    const pts =
      ctx.layers.filter((l) => l.on && l.items && l.pts).reduce((a, l) => a + l.items.length, 0) + ctx.cases.length;
    $('#fps').textContent =
      `${window.GM_PERF.fps().toFixed(0)} fps · ${fmt(pts)} points loaded · DPR ${ctx.globe.renderer.getPixelRatio()}`;
  };
  // ---- notes ----
  const n = $('#notes');
  if (n) n.oninput = () => (st.notes = n.value);
}
function escape() {
  if (!$('#help').hidden) return toggleHelp(false);
  if (ctx.hooks.lassoActive) return endLasso(true);
  if (!$('#dossier').hidden) return closeDossier();
  for (const [id, f] of [
    ['#graph', toggleGraph],
    ['#analysis', toggleAnalysis],
    ['#charts', toggleCharts],
    ['#wars', toggleWars],
    ['#brief', toggleBrief],
  ])
    if (!$(id).hidden) return f(false);
  for (const id of ['#hs-dossier', '#hotspots', '#reports', '#reference', '#datap', '#settings']) {
    const e = $(id);
    if (e && !e.hidden) {
      if (id === '#hotspots') return import('./ui_hotspots.js').then((m) => m.toggleHotspots(false));
      e.hidden = true;
      return;
    }
  }
  if (ctx.globe.compare.mode !== 'off') return setCompare('off');
}
function toggleHelp(show) {
  const h = $('#help');
  h.hidden = !(show ?? h.hidden);
}
// ---- compare ----
function toggleCompare() {
  setCompare(ctx.globe.compare.mode === 'off' ? 'swipe' : 'off');
}
function setCompare(mode) {
  const g = ctx.globe;
  g.compare.mode = mode;
  $('#cmp-mode').value = mode;
  $('#compare-bar').hidden = mode === 'off';
  $('#cmp-divider').hidden = mode !== 'swipe';
  $('#cmp-date').value = dayToISO(st.curB);
  document.body.classList.toggle('comparing', mode !== 'off');
  ctx.hooks.compareSide =
    mode === 'off'
      ? null
      : (side) => {
          const d = side === 'A' ? st.cur : st.curB;
          const set = (L) => L && L.u && (L.u.cur.value = d);
          set(ctx.casePts);
          set(ctx.circ);
          for (const l of ctx.layers) {
            set(l.pts);
            set(l.circ);
          }
          const dt = dayToDate(d);
          dt.setUTCHours(st.hour);
          g.setDate(dt);
        };
  drawTimeline();
}
// ---- briefings: QWM analysis_summary.md, README.md, PNG charts, sources registry ----
function toggleBrief(show) {
  const el = $('#brief');
  const s = show ?? el.hidden;
  el.hidden = !s;
  if (!s) return;
  const cat = window.GM_CATALOG || {};
  const b = cat.briefings || { md: {}, png: [] };
  const exp = cat.expected || {};
  let h = `<h3>Data drops from QWM <small class="muted">(${esc(cat.map_dir || '')}, built ${esc(cat.built || '')})</small></h3><table class="kv">${Object.entries(
    exp,
  )
    .map(
      ([k, v]) =>
        `<tr><th>${esc(k)}</th><td>${v ? '<span class="ok">loaded</span>' : '<span class="muted">waiting</span>'}</td></tr>`,
    )
    .join('')}</table>
  <p class="muted small">Ingested files: ${(cat.files || []).map((f) => `${esc(f.file.split('/').pop())} (${f.plotted}/${f.rows})`).join(' · ')}</p>`;
  for (const [name, md] of Object.entries(b.md || {}))
    h += `<article class="md"><h3>${esc(name)}</h3>${safeHTML(marked.parse(md))}</article>`;
  if (!Object.keys(b.md || {}).length)
    h +=
      '<p class="muted">analysis_summary.md and README.md have not landed yet; they render here automatically after the next data/build_data.py run.</p>';
  if ((b.png || []).length)
    h += `<div class="gallery">${b.png
      .map((p) => {
        const nm = p.split('/').pop();
        const cap =
          (b.captions || {})[p] || Object.entries(b.captions || {}).find(([k]) => k.split('/').pop() === nm)?.[1] || '';
        return `<figure><a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="${esc(cap || nm)}" loading="lazy"></a><figcaption><b>${esc(nm)}</b>${cap ? `<br>${esc(cap)}` : ''}</figcaption></figure>`;
      })
      .join('')}</div>`;
  if (b.registry)
    h += `<h3>Sources registry (${b.registry.length})</h3><div class="scroll"><table class="kv small">${b.registry
      .slice(0, 400)
      .map(
        (r) =>
          `<tr><td>${Object.values(r)
            .slice(0, 4)
            .map((v) => esc(v))
            .join(' · ')}</td></tr>`,
      )
      .join('')}</table></div>`;
  if (b.languages)
    h += `<h3>Languages searched (${b.languages.length})</h3><p class="small">${b.languages.map((r) => esc(Object.values(r)[0])).join(', ')}</p>`;
  h += `<h3>Analyst notes <small class="muted">(saved with the workspace)</small></h3><textarea id="notes2" rows="6">${esc(st.notes)}</textarea>`;
  $('#brief-body').innerHTML = h;
  $('#brief-body')
    .querySelectorAll('a')
    .forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener';
    });
  $('#notes2').oninput = (e) => (st.notes = e.target.value);
}
// ---- heatmap (KDE of filtered cases, 300 km) ----
let heatDirty = false,
  heatWasOn = false,
  heatT = 0;
function heatTick() {
  const l = layerById('heat');
  if (!l || !l.on || !heatDirty || performance.now() - heatT < 400) return;
  heatDirty = false;
  heatT = performance.now();
  heatWasOn = true;
  const pts = filteredCases();
  const W = 720,
    H = 360;
  const g = S.kdeGrid(pts, 300, W, H);
  let mx = 0;
  for (const v of g) mx = Math.max(mx, v);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c2 = cv.getContext('2d');
  const img = c2.createImageData(W, H);
  for (let i = 0; i < g.length; i++) {
    const t = mx ? g[i] / mx : 0;
    if (t < 0.02) continue;
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = Math.round(60 + 190 * t);
    img.data[i * 4 + 2] = Math.round(40 * t);
    img.data[i * 4 + 3] = Math.round(40 + 190 * Math.sqrt(t));
  }
  c2.putImageData(img, 0, 0);
  ctx.globe.setOverlayTexture(cv, 0.75 * (l.opacity ?? 1));
}
// ---- lasso on the globe (filters charts, graph and exports) ----
let lassoPts = [];
function startLasso() {
  const ov = $('#lasso');
  ov.hidden = false;
  ctx.hooks.lassoActive = true;
  lassoPts = [];
  const c2 = ov.getContext('2d');
  ov.width = innerWidth;
  ov.height = innerHeight;
  setStatus('Lasso: drag around cases on the globe (Esc cancels)');
  ov.onpointerdown = (e) => {
    lassoPts = [[e.clientX, e.clientY]];
    ov.setPointerCapture(e.pointerId);
  };
  ov.onpointermove = (e) => {
    if (!lassoPts.length) return;
    lassoPts.push([e.clientX, e.clientY]);
    c2.clearRect(0, 0, ov.width, ov.height);
    c2.strokeStyle = '#38E8FF';
    c2.fillStyle = 'rgba(56,232,255,0.08)';
    c2.lineWidth = 2;
    c2.setLineDash([6, 4]);
    c2.beginPath();
    lassoPts.forEach(([x, y], i) => (i ? c2.lineTo(x, y) : c2.moveTo(x, y)));
    c2.closePath();
    c2.fill();
    c2.stroke();
  };
  ov.onpointerup = () => endLasso(false);
}
function endLasso(cancel) {
  const ov = $('#lasso');
  ov.hidden = true;
  ctx.hooks.lassoActive = false;
  setStatus('');
  if (cancel || lassoPts.length < 3) return;
  const r = $('#globe').getBoundingClientRect();
  const sel = new Set();
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = lassoPts.length - 1; i < lassoPts.length; j = i++) {
      const [xi, yi] = lassoPts[i],
        [xj, yj] = lassoPts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (const c of ctx.cases) {
    const p = ctx.globe.project(c.lat, c.lon);
    if (p && inside(p.x + r.left, p.y + r.top)) sel.add(c._i);
  }
  st.f.lasso = sel;
  emit('filters');
  setStatus(`Lasso: ${sel.size} cases selected (Filters tab to clear)`);
}
// ---- screenshot (globe + labels composited) ----
function screenshot() {
  // the Cesium canvas draws markers and labels itself; it may be wider than the window (panel centring), so crop to it
  const g = ctx.globe.canvas;
  const r = g.getBoundingClientRect();
  const k = g.width / r.width;
  const cv = document.createElement('canvas');
  cv.width = Math.round(innerWidth * k);
  cv.height = g.height;
  const c2 = cv.getContext('2d');
  c2.drawImage(g, Math.round(-r.left * k), 0, cv.width, cv.height, 0, 0, cv.width, cv.height);
  c2.fillStyle = 'rgba(230,241,247,0.8)';
  c2.font = `${14 * k}px Inter, sans-serif`;
  c2.fillText(`Global Map · ${dayLabel(st.cur)} · ${filteredCases().length} cases`, 16, cv.height - 16);
  const a = document.createElement('a');
  a.download = `globalmap-${dayToISO(st.cur)}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
}
// briefings Markdown comes from the QWM folder: allow-list sanitise the rendered HTML (CSP also blocks inline script)
function safeHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  t.content
    .querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,base,svg,math')
    .forEach((n) => n.remove());
  t.content.querySelectorAll('*').forEach((n) => {
    for (const a of [...n.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (
        /^on/i.test(a.name) ||
        a.name === 'style' ||
        (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) &&
          !/^(https?:|mailto:|#|data\/|\.\/|[a-z0-9_-]+\.(png|jpe?g|svg|md)$)/.test(v))
      )
        n.removeAttribute(a.name);
    }
    if (n.tagName === 'A') {
      n.setAttribute('rel', 'noopener noreferrer');
      n.setAttribute('target', '_blank');
    }
  });
  return t.innerHTML;
}
function randomCase() {
  const cs = filteredCases();
  if (cs.length) openDossier(cs[Math.floor(Math.random() * cs.length)]);
}
