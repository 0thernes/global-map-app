// Entry point: boot, globe, cases, clustering, picking, labels, render loop.
import { expandCases } from './cases_codec.js';
import {
  dateToDay,
  THREE,
  ctx,
  st,
  $,
  esc,
  emit,
  on,
  prepCases,
  caseVisibleF,
  catColor,
  PRECISE,
  setStatus,
  loadLayer,
  dayToDate,
  dayLabel,
  NDAYS,
  ll2v,
  v2ll,
} from './app_core.js';
import { Globe } from './globe_cesium.js';
import { Labels } from './labels_cesium.js';
import { initImagery } from './basemap.js';
import { loadTexURI, inject } from './loader.js';
import { buildRegistry, ensureLayer, applyLayerVis, layerItemsOn, hydroTiles } from './layers.js';
import { initTimeline, tickPlayback } from './ui_timeline.js';
import { initPanels, openDossier } from './ui_panels.js';
import { initConflicts, updateConflictGlow } from './ui_conflicts.js';
import { initAnalysis } from './ui_analysis.js';
import { initCharts } from './ui_charts.js';
import { initGraph } from './ui_graph.js';
import { initMisc } from './ui_misc.js';
import { initCinema } from './cinema.js';
import { initHotspots } from './ui_hotspots.js';
import { initReports } from './ui_reports.js';
import { initReference } from './ui_reference.js';

const fpsHist = [],
  cpuHist = [];
window.GM_PERF = {
  cpuMs: () => (cpuHist.length ? cpuHist.reduce((a, b) => a + b, 0) / cpuHist.length : 0),
  fps: () => (fpsHist.length ? fpsHist.length / ((fpsHist[fpsHist.length - 1] - fpsHist[0]) / 1000 || 1) : 0),
  frames: fpsHist,
};

async function boot() {
  const g = new Globe($('#globe'), { onStatus: setStatus });
  const canvas = g.canvas;
  ctx.globe = g;
  ctx.labels = new Labels(g);
  initImagery(g);
  buildRegistry();
  // bundled 2K day/night textures: offline basemap and night-lights fallback (streamed imagery is the default)
  const tx = async (slot, name, o) => g.setTexture(slot, await loadTexURI(name), o);
  Promise.all([tx('dayTex', 'day2k'), tx('nightTex', 'night2k')]).catch((e) => console.warn(e));
  // country id map (for country glow / hit tests)
  loadLayer('countries').then((p) => {
    ctx.countries = p;
    p.countries.forEach((c) => {
      ctx.countryById[c.i] = c;
      ctx.countryByIso[c.iso3] = c;
      ctx.countryByIso[c.a3] = c;
      if (c.iso2) ctx.countryByIso2[c.iso2] = c;
    });
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = im.width;
      cv.height = im.height;
      const c2 = cv.getContext('2d');
      c2.drawImage(im, 0, 0);
      ctx.idmap = { w: im.width, h: im.height, d: c2.getImageData(0, 0, im.width, im.height).data };
      g.setTexture('idTex', p.idmap, { nearest: true });
      emit('countries-loaded', p);
    };
    im.src = p.idmap;
  });
  // optional local-only rows (gitignored data/private/, e.g. NUFORC: no redistribution licence). Absent in a fresh clone.
  const priv =
    new URLSearchParams(location.search).get('private') === '0'
      ? []
      : await inject('data/private/cases_private.js').then(
          () => expandCases(window.GM_CASES_PRIVATE_COLS),
          () => [],
        );
  ctx.privateCount = priv.length;
  if (priv.length) await inject('data/private/private_links.js').catch(() => {});
  const plinks = window.GM_PRIVATE_LINKS || {};
  await inject('data/url_status.js').then(
    () => {
      ctx.urlLive = new Map(Object.entries(window.GM_URL_STATUS.urls).map(([k, v]) => [k, !!v]));
      ctx.urlChecked = window.GM_URL_STATUS.checked;
    },
    () => {},
  );
  const pubRows = (window.GM_CASES || expandCases(window.GM_CASES_COLS)).map((c) =>
    plinks[c.id]
      ? {
          ...c,
          same_as: [...(c.same_as || []), ...plinks[c.id].same_as],
          conflicts: [...(c.conflicts || []), ...plinks[c.id].conflicts],
        }
      : c,
  );
  ctx.cases = prepCases([...pubRows, ...priv]);
  buildCases();
  initTimeline();
  initPanels();
  initConflicts();
  initAnalysis();
  initCharts();
  initGraph();
  initMisc();
  initHotspots();
  initReports();
  initReference();
  initCinema();
  for (const l of ctx.layers) if (l.on && !l.loaded) ensureLayer(l);
  initLabels();
  bindPointer(canvas);
  window.addEventListener('resize', resize);
  resize();
  st.cur = NDAYS;
  emit('time', st.cur);
  {
    const v = ll2v(28, -35, 3.3);
    g.camera.position.copy(v);
  }
  emit('filters');
  requestAnimationFrame(loop);
  // offline basemap only: upgrade the bundled textures to 8K (streamed imagery needs no bundled texture)
  if (g.basemapId === 'local')
    Promise.all([tx('dayTex', 'day8k'), tx('nightTex', 'night8k')])
      .then(() => (document.body.dataset.hires = '1'))
      .catch((e) => console.warn('hi-res textures', e));
  document.body.dataset.ready = '1';
}

// ---- cases on the globe: sharp pins for exact_site/within_1km, uncertainty circles + faint centre dot otherwise ----
export function buildCases() {
  const g = ctx.globe;
  const cs = ctx.cases;
  ctx.casePts = g.addPoints('cases', cs, {
    colorFn: (c) => catColor(c.category, c.subtype),
    sizeFn: (c) => (PRECISE(c) ? 11 : 6),
    shapeFn: (c) => (PRECISE(c) ? 1 : 2),
    t0Fn: (c) => c._day,
    timeAware: true,
    mode: st.mode,
    radius: 1.0045,
    clamp: true,
    order: 8,
  });
  const imp = cs.filter((c) => !PRECISE(c));
  ctx.circ = g.addCircles('cases', imp, {
    colorFn: (c) => catColor(c.category, c.subtype),
    radiusKmFn: (c) => c._r,
    t0Fn: (c) => c._day,
    timeAware: true,
    opacity: 0.95,
  });
  refreshCaseVis();
}
let clusterHidden = new Set();
ctx.clusters = [];
export function refreshCaseVis() {
  const g = ctx.globe;
  if (!ctx.casePts) return;
  g.setVis(ctx.casePts, (c) => caseVisibleF(c) && !clusterHidden.has(c._i) && layerOn('cases'));
  g.setCircleVis(ctx.circ, (c) => caseVisibleF(c) && !clusterHidden.has(c._i) && layerOn('cases'));
}
const layerOn = (id) => {
  const l = ctx.layers.find((x) => x.id === id);
  return l && l.on;
};
on('filters', () => {
  clusterDirty = true;
  refreshCaseVis();
});
on('layers-changed', () => {
  clusterDirty = true;
  refreshCaseVis();
});
on('time', () => {
  clusterDirty = true;
});

// ---- clustering (splits as you zoom). Grouping is decided in screen space once the camera settles; the badges are
// Cesium billboards at the members' geographic centroid, so they stay glued to the surface while the globe moves ----
let clusterDirty = true,
  lastCam = new THREE.Vector3(),
  lastMoveT = 0,
  settled = true;
function recluster(now) {
  const g = ctx.globe;
  const cam = g.camera.position;
  if (cam.distanceToSquared(lastCam) > 1e-9) {
    lastCam.copy(cam);
    lastMoveT = now;
    settled = false;
    return;
  }
  if (!settled && now - lastMoveT > 160) {
    settled = true;
    clusterDirty = true;
  }
  if (!clusterDirty) return;
  clusterDirty = false;
  const alt = cam.length() - 1;
  const prevHidden = clusterHidden;
  clusterHidden = new Set();
  ctx.clusters = [];
  if (st.clustering && layerOn('cases') && alt > 0.12) {
    const cell = 46;
    const grid = new Map();
    for (const c of ctx.cases) {
      if (!caseVisibleF(c) || c._day > st.cur) continue;
      const p = g.project(c.lat, c.lon);
      if (!p) continue;
      const k = Math.floor(p.x / cell) + ':' + Math.floor(p.y / cell);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = { m: [], v: new THREE.Vector3() }));
      b.m.push(c);
      b.v.add(ll2v(c.lat, c.lon, 1));
    }
    for (const b of grid.values())
      if (b.m.length >= 3) {
        const cnt = {};
        b.m.forEach((c) => (cnt[c.category] = (cnt[c.category] || 0) + 1));
        const top = Object.entries(cnt).sort((a, b2) => b2[1] - a[1])[0][0];
        const ll = v2ll(b.v);
        ctx.clusters.push({
          lat: ll.lat,
          lon: ll.lon,
          n: b.m.length,
          color: catColor(top),
          members: b.m,
        });
        b.m.forEach((c) => clusterHidden.add(c._i));
      }
  }
  if (clusterHidden.size !== prevHidden.size || [...clusterHidden].some((i) => !prevHidden.has(i))) refreshCaseVis();
}

// ---- labels with level-of-detail ----
function initLabels() {
  const lb = ctx.labels;
  loadLayer('labels_base').then((p) => {
    lb.addSet(
      'continents',
      p.continents.map(([n, x, y]) => ({ name: n, lon: x, lat: y, pri: 0 })),
      { font: '600 13px Inter, sans-serif', color: '#bfe9ff', upper: true, minAlt: 1.1, maxAlt: 20, limit: 10, z: 0 },
    );
    lb.addSet(
      'places',
      p.places.map(([n, x, y, rank, pop]) => ({ name: n, lon: x, lat: y, pri: -Math.log10(1 + (pop || 0)) })),
      {
        font: '500 12px Inter, sans-serif',
        color: '#dfe9f2',
        dot: '#ffe6a0',
        maxAlt: 0.75,
        limit: 140,
        z: 3,
        priMax: (alt) => -Math.max(0, 7.2 - (0.75 - alt) * 5),
      },
    );
  });
  on('countries-loaded', (p) =>
    lb.addSet(
      'countries',
      p.countries.filter((c) => c.lx != null).map((c) => ({ name: c.name, lon: c.lx, lat: c.ly, pri: c.minl || 5 })),
      {
        font: '600 12px Inter, sans-serif',
        color: '#e6f1f7',
        upper: true,
        minAlt: 0.08,
        maxAlt: 2.8,
        limit: 120,
        z: 1,
        priMax: (alt) => (alt > 1.6 ? 3 : alt > 0.9 ? 4.5 : 99),
      },
    ),
  );
  loadLayer('labels_admin1').then((p) =>
    lb.addSet(
      'admin1',
      p.items.map(([n, x, y, cc, r]) => ({ name: n, lon: x, lat: y, pri: r })),
      { font: 'italic 500 11px Inter, sans-serif', color: '#a9c6dc', minAlt: 0.03, maxAlt: 0.6, limit: 90, z: 2 },
    ),
  );
  let citiesAsked = false,
    townsAsked = false;
  on('camera-alt', (alt) => {
    if (alt < 0.3 && !citiesAsked) {
      citiesAsked = true;
      loadLayer('cities15000').then((p) =>
        lb.addSet(
          'cities',
          p.items.map(([n, x, y, pop]) => ({ name: n, lon: x, lat: y, pri: -Math.log10(1 + pop) })),
          { font: '500 11px Inter, sans-serif', color: '#f2f6fa', dot: '#ffe6a0', maxAlt: 0.3, limit: 160, z: 4 },
        ),
      );
    }
    if (alt < 0.09 && !townsAsked) {
      townsAsked = true;
      loadLayer('cities5000').then((p) =>
        lb.addSet(
          'towns',
          p.items.map(([n, x, y, pop]) => ({ name: n, lon: x, lat: y, pri: -Math.log10(1 + pop) })),
          { font: '400 11px Inter, sans-serif', color: '#c9d6e2', dot: '#9db1c2', maxAlt: 0.09, limit: 160, z: 5 },
        ),
      );
    }
  });
}
// postal codes: lazily per country, only when zoomed far in
const postalLoaded = new Set();
function postalLOD(alt) {
  const l = ctx.layers.find((x) => x.id === 'postal');
  if (!l || !l.on || alt > 0.035 || !ctx.idmap) return;
  const ll = v2ll(ctx.globe.camera.position.clone());
  const c = ctx.countryById[(ctx.idmapCountry = countryAt(ll))];
  if (!c || !c.iso2 || postalLoaded.has(c.iso2)) return;
  postalLoaded.add(c.iso2);
  loadLayer('postal_index').then((pi) => {
    if (!pi.countries[c.iso2]) {
      setStatus(
        `No postal dump bundled for ${c.name}; add GeoNames ${c.iso2}.zip to gm_build/postal and re-run data/tools/build_layers.py`,
      );
      return;
    }
    loadLayer('postal/' + c.iso2).then((p) => {
      ctx.labels.addSet(
        'postal_' + c.iso2,
        p.items.map(([code, place, x, y]) => ({ name: code + ' ' + place, lon: x, lat: y, pri: 0 })),
        {
          font: '500 10px "IBM Plex Mono", monospace',
          color: '#ffc857',
          dot: '#ffc857',
          maxAlt: 0.035,
          limit: 120,
          z: 6,
          dy: 10,
        },
      );
      setStatus(`Postal codes loaded: ${c.name} (${p.items.length.toLocaleString()})`);
    });
  });
}
function countryAt(ll) {
  const m = ctx.idmap;
  const x = Math.min(m.w - 1, Math.floor(((ll.lon + 180) / 360) * m.w)),
    y = Math.min(m.h - 1, Math.floor(((90 - ll.lat) / 180) * m.h));
  const i = (y * m.w + x) * 4;
  return m.d[i] + m.d[i + 1] * 256;
}

// ---- picking (CPU, angular prefilter on unit vectors; cheap even for 100k+ points) ----
export function pickAt(x, y, radiusPx = 12) {
  const g = ctx.globe;
  for (const c of ctx.clusters) {
    const s = g.project(c.lat, c.lon);
    if (s && Math.hypot(s.x - x, s.y - y) < 10 + Math.min(14, Math.sqrt(c.n) * 3)) return { cluster: c };
  }
  const hit = g.pickGlobe(x, y);
  if (!hit) return null;
  const hn = hit.clone().normalize();
  const alt = g.camera.position.length() - 1;
  const pxAng = (alt * ((g.camera.fov * Math.PI) / 180)) / g.canvas.clientHeight;
  const cosT = Math.cos(Math.max(0.0005, pxAng * radiusPx * 1.6));
  let best = null,
    bd = radiusPx;
  const test = (L, it, i, kind) => {
    const p = L.pos;
    const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    if ((p[i * 3] * hn.x + p[i * 3 + 1] * hn.y + p[i * 3 + 2] * hn.z) / r < cosT) return;
    const s = g.project(it.lat, it.lon);
    if (!s) return;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) {
      bd = d;
      best = { item: it, kind };
    }
  };
  if (ctx.casePts && ctx.casePts.obj.visible)
    ctx.cases.forEach((c, i) => {
      if (caseVisibleF(c) && c._day <= st.cur) test(ctx.casePts, c, i, 'case');
    });
  if (!best) {
    // imprecise cases: click inside the uncertainty circle
    let bestR = Infinity;
    const ll = v2ll(hit);
    for (const c of ctx.cases)
      if (!PRECISE(c) && caseVisibleF(c) && c._day <= st.cur && layerOn('cases')) {
        const d = gc(ll.lat, ll.lon, c.lat, c.lon);
        if (d < c._r && d < bestR) {
          bestR = d;
          best = { item: c, kind: 'case' };
        }
      }
  }
  if (!best)
    for (const l of layerItemsOn()) {
      const vis = l.pts.vis;
      const ta = l.pts.u.timeAware.value > 0.5;
      const hist = l.pts.u.history.value;
      const mode = l.pts.u.mode.value;
      l.items.forEach((it, i) => {
        if (!vis[i]) return;
        if (
          ta &&
          isFinite(it._day) &&
          (it._day > st.cur || (mode > 0.5 && hist < 0.01 && st.cur - it._day > 3 * l.pts.u.flash.value))
        )
          return;
        test(l.pts, it, i, l.id);
      });
    }
  return best;
}
const gc = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
};
function bindPointer(canvas) {
  let down = null;
  const tip = $('#tooltip');
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    ctx.globe._fly = null;
    if (st.autoRotate) {
      st.autoRotate = false;
      emit('autorotate');
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
      down = null;
      return;
    }
    down = null;
    if (ctx.hooks.lassoActive) return;
    const r = canvas.getBoundingClientRect();
    const p = pickAt(e.clientX - r.left, e.clientY - r.top);
    if (!p) return;
    if (p.cluster) {
      const alt = ctx.globe.camera.position.length() - 1;
      ctx.globe.flyTo(p.cluster.lat, p.cluster.lon, 1 + alt * 0.4, 1000);
      return;
    }
    openDossier(p.item, p.kind);
  });
  let last = 0;
  canvas.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - last < 70 || down) return;
    last = now;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    const p = pickAt(x, y, 10);
    if (!p) {
      tip.hidden = true;
      canvas.style.cursor = '';
      const hit = ctx.globe.pickGlobe(x, y);
      if (hit && ctx.idmap) {
        const id = countryAt(v2ll(hit));
        ctx.globe.earthU.hiId.value = id || -1;
      }
      return;
    }
    canvas.style.cursor = 'pointer';
    tip.hidden = false;
    tip.style.left = x + 14 + 'px';
    tip.style.top = y + 12 + 'px';
    if (p.cluster) {
      tip.innerHTML = `<b>${p.cluster.n} cases</b><br><span class=muted>click to zoom in</span>`;
      return;
    }
    const it = p.item;
    const why = it.why_weird ? `<div class=why>${esc(it.why_weird)}</div>` : '';
    tip.innerHTML = `<b>${esc(it.name || it.conflict || '(unnamed)')}</b><br><span class=muted>${esc(it.date ? dayLabel(it._day) : it.kind || it.type || it.subtype || '')}${it.coord_precision ? ' · ' + esc(it.coord_precision) : ''}</span>${why}`;
  });
  canvas.addEventListener('pointerleave', () => (tip.hidden = true));
}
function centerShift() {
  const b = document.body.classList;
  const left = b.contains('rail-collapsed') ? 0 : 330;
  let right = 0;
  if (b.contains('dossier-open')) right += 430;
  if (b.contains('wars-open') || b.contains('analysis-open') || b.contains('graph-open'))
    right += Math.min(600, innerWidth * 0.46) + 8;
  return Math.round((left - right) / 2);
}
new MutationObserver(() => {
  const s = centerShift();
  if (ctx.globe && s !== ctx.globe.centerShift) {
    ctx.globe.setCenterShift(s);
    ctx.labels.resize();
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
function resize() {
  ctx.globe.centerShift = centerShift();
  ctx.globe.resize();
  ctx.labels.resize();
  emit('resize');
}

// ---- loop ----
let lastT = performance.now(),
  lastAlt = -1,
  lastDayDrawn = null;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  fpsHist.push(now);
  while (fpsHist.length && now - fpsHist[0] > 2000) fpsHist.shift();
  const g = ctx.globe;
  tickPlayback(dt);
  if (st.autoRotate && !g._fly) {
    const v = g.camera.position;
    const a = dt * 0.06;
    const x = v.x * Math.cos(a) + v.z * Math.sin(a),
      z = -v.x * Math.sin(a) + v.z * Math.cos(a);
    v.x = x;
    v.z = z;
  }
  g.update(dt);
  const alt = g.camera.position.length() - 1;
  if (Math.abs(alt - lastAlt) > 0.002) {
    lastAlt = alt;
    emit('camera-alt', alt);
    for (const l of ctx.layers)
      if (l.objs || l.minAltHide) {
        applyLayerVis(l);
        if (l.minAltHide && l.obj) l.obj.visible = l.on && alt < l.minAltHide;
      }
    postalLOD(alt);
    {
      const ll = v2ll(g.camera.position.clone());
      hydroTiles(alt, ll.lat, ll.lon);
    }
  }
  if (lastDayDrawn !== st.cur + st.hour / 24) {
    lastDayDrawn = st.cur + st.hour / 24;
    const d = dayToDate(st.cur);
    d.setUTCHours(st.hour);
    g.setDate(d);
    updateConflictGlow();
  }
  // per-layer time uniforms
  const setU = (L) => {
    if (L && L.u) {
      L.u.cur.value = st.cur;
      L.u.fade.value = st.fade;
    }
  };
  setU(ctx.casePts);
  if (ctx.casePts) ctx.casePts.u.mode.value = st.mode;
  if (ctx.circ) ctx.circ.u.cur.value = st.cur;
  for (const l of ctx.layers) {
    if (l.pts) setU(l.pts);
    if (l.circ) l.circ.u.cur.value = st.cur;
  }
  recluster(now);
  if (ctx.hooks.heatTick) ctx.hooks.heatTick();
  g.earthU.lightingOn.value = st.lighting ? 1 : 0;
  {
    const cl = ctx.layers.find((x) => x.id === 'conflicts');
    g.earthU.glowOn.value = cl && cl.on ? Math.max(0.12, Math.min(1, alt / 0.8)) : 0;
  }
  g.render(ctx.hooks.compareSide);
  ctx.labels.draw(ctx.clusters);
  if (ctx.hooks.frame) ctx.hooks.frame(now);
  if (ctx.hooks.frame2) ctx.hooks.frame2(now);
  cpuHist.push(performance.now() - now);
  if (cpuHist.length > 120) cpuHist.shift();
}
window.__case = (i) => ctx.cases[i];
window.__lastAnalysis = () => import('./ui_analysis.js').then((m) => m.lastAnalysis());
window.__open = (c) => import('./ui_panels.js').then((m) => m.openDossier(c));
window.__setDay = (iso) => import('./ui_timeline.js').then((m) => m.setDay(dateToDay(iso)));
window.__pick = (x, y) => pickAt(x, y);
window.__fly = (lat, lon, d) => ctx.globe.flyTo(lat, lon, d, 800);
window.__globe = () => ctx.globe;
boot().catch((e) => {
  console.error(e);
  setStatus('Boot error: ' + e.message);
});
