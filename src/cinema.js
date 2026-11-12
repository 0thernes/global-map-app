// Cinematic layer: boot / title card, ENGAGE launch, URL params, guided tour with lower-thirds, HUD, typed reveals,
// settings (audio, FX, performance, reduced motion). Every caption is built from loaded data fields; nothing is invented.
import { ctx, st, $, $$, esc, fmt, dayLabel, NDAYS, v2ll, PRECISE, layerById } from './app_core.js';
import { audio, unlockAudio, setMuted, setVolumes, sfx } from './audio.js';
import { caseRank, domainOf } from './report_gen.js';
import { icon } from './icons.js';
import { setDay } from './ui_timeline.js';
import { basemap, setSatelliteBasemap } from './basemap.js';

const P = new URLSearchParams(location.search);
export const params = {
  tour: P.get('tour'),
  audio: P.get('audio'),
  fullscreen: P.get('fullscreen') === '1',
  intro: P.get('intro'),
  perf: P.get('perf') === '1',
  basemap: P.get('basemap'),
  fx: P.get('fx'),
  step: +P.get('step') || 0,
};
const LS = {
  get: (k, d) => {
    try {
      const v = localStorage.getItem('gm.' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem('gm.' + k, JSON.stringify(v));
    } catch {}
  },
};
export const cine = {
  settings: {
    fx: true,
    bloom: 0.55,
    ca: true,
    hud: true,
    perf: false,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    ...LS.get('cine', {}),
  },
  tour: null,
};
const reduced = () => cine.settings.reduced;

// ---------- typed text ----------
export function typeInto(el, text, cps = 90) {
  if (!el) return Promise.resolve();
  if (reduced() || !text) {
    el.textContent = text || '';
    return Promise.resolve();
  }
  clearInterval(el._ty);
  el.textContent = '';
  el.classList.add('typing');
  let i = 0;
  return new Promise((res) => {
    el._ty = setInterval(() => {
      i = Math.min(text.length, i + Math.max(1, Math.round(cps / 30)));
      el.textContent = text.slice(0, i);
      if (i % 24 === 0) sfx('chatter', 0.15);
      if (i >= text.length) {
        clearInterval(el._ty);
        el.classList.remove('typing');
        res();
      }
    }, 33);
  });
}

// ---------- settings ----------
function applySettings() {
  const s = cine.settings,
    g = ctx.globe;
  LS.set('cine', s);
  g.reducedMotion = s.reduced;
  document.body.classList.toggle('reduced-motion', s.reduced);
  const fxOn = s.fx && !s.perf;
  g.setPostFX(fxOn);
  g.fx.bloom = s.bloom;
  g.fx.caEnabled = s.ca;
  if (!s.ca) g.fx.caPulse = 0;
  g.renderer.setPixelRatio(s.perf ? 1 : Math.min(2, window.devicePixelRatio || 1));
  window.dispatchEvent(new Event('resize'));
  document.body.classList.toggle('perf', s.perf);
  $('#hud').hidden = !s.hud;
}
function renderSettings() {
  const s = cine.settings;
  $('#set-body').innerHTML = `<h4>${icon('volume-2', 14)} Audio</h4>
   <label class="tog"><input type="checkbox" id="s-mute" ${audio.muted ? 'checked' : ''}> Mute all</label>
   <label>Music <input type="range" id="s-music" min="0" max="1" step="0.05" value="${audio.music}"></label>
   <label>Effects <input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${audio.sfx}"></label>
   <p class="small muted">Sound stays off until you interact (browser autoplay rules). All audio is CC0; see Index › Credits.</p>
   <h4>${icon('sparkles', 14)} Visual effects</h4>
   <label class="tog"><input type="checkbox" id="s-fx" ${s.fx ? 'checked' : ''}> Post-processing (bloom, vignette, grain)</label>
   <label>Bloom <input type="range" id="s-bloom" min="0" max="1.5" step="0.05" value="${s.bloom}"></label>
   <label class="tog"><input type="checkbox" id="s-ca" ${s.ca ? 'checked' : ''}> Chromatic aberration on transitions</label>
   <label class="tog"><input type="checkbox" id="s-hud" ${s.hud ? 'checked' : ''}> HUD (reticle, coordinates, sweep)</label>
   <label class="tog"><input type="checkbox" id="s-perf" ${s.perf ? 'checked' : ''}> Performance mode (no post-FX, 1× pixel ratio)</label>
   <label class="tog"><input type="checkbox" id="s-red" ${s.reduced ? 'checked' : ''}> Reduced motion (instant fly-to, no typing, no sweeps)</label>
   <h4>${icon('globe', 14)} Basemap</h4>
   <label class="tog"><input type="checkbox" id="s-s2" ${basemap.on ? 'checked' : ''}> Satellite basemap (Sentinel-2 cloudless 2016, EOX, CC BY 4.0; online)</label>
   <h4>${icon('clapperboard', 14)} Intro</h4><button class="btn" id="s-intro">Replay intro</button> <button class="btn" id="s-tour">Start guided tour</button>`;
  $('#s-mute').onchange = (e) => setMuted(e.target.checked);
  $('#s-music').oninput = (e) => setVolumes({ music: e.target.value });
  $('#s-sfx').oninput = (e) => setVolumes({ sfx: e.target.value });
  const b = (id, k) =>
    ($(id).onchange = (e) => {
      s[k] = e.target.checked;
      applySettings();
    });
  b('#s-fx', 'fx');
  b('#s-ca', 'ca');
  b('#s-hud', 'hud');
  b('#s-perf', 'perf');
  b('#s-red', 'reduced');
  $('#s-s2').onchange = (e) => setSatelliteBasemap(e.target.checked);
  $('#s-bloom').oninput = (e) => {
    s.bloom = +e.target.value;
    applySettings();
  };
  $('#s-intro').onclick = () => {
    toggleSettings(false);
    showBoot(true);
  };
  $('#s-tour').onclick = () => {
    toggleSettings(false);
    startTour();
  };
  syncMute();
}
export function toggleSettings(show) {
  const el = $('#settings');
  const s = show ?? el.hidden;
  el.hidden = !s;
  if (s) renderSettings();
}
function syncMute() {
  const b = $('#btn-mute');
  if (b) {
    b.innerHTML = icon(audio.muted ? 'volume-x' : 'volume-2', 16);
    b.setAttribute('aria-pressed', String(!audio.muted));
    b.title = audio.muted ? 'Sound off (M)' : 'Sound on (M)';
  }
}
export function toggleMute() {
  setMuted(!audio.muted);
  syncMute();
}

// ---------- HUD ----------
function hudFrame() {
  const g = ctx.globe;
  const p = g.camera.position;
  const ll = v2ll(p.clone());
  const altKm = (p.length() - 1) * 6371;
  const NS = ll.lat >= 0 ? 'N' : 'S',
    EW = ll.lon >= 0 ? 'E' : 'W';
  $('#hud-coord').textContent =
    `${Math.abs(ll.lat).toFixed(3)}°${NS} ${Math.abs(ll.lon).toFixed(3)}°${EW}  ALT ${fmt(altKm)} KM`;
  $('#hud-date').textContent = `T ${dayLabel(st.cur)}`;
}
export function sweep() {
  if (reduced() || !cine.settings.hud) return;
  const s = $('#hud-sweep');
  s.classList.remove('go');
  void s.offsetWidth;
  s.classList.add('go');
}

// ---------- boot / title card ----------
let starRAF = 0;
function starfield(cv) {
  const c = cv.getContext('2d');
  const N = 600;
  const stars = Array.from({ length: N }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random(),
  }));
  const frame = () => {
    const w = (cv.width = cv.clientWidth),
      h = (cv.height = cv.clientHeight);
    c.fillStyle = '#02040a';
    c.fillRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduced()) {
        s.z -= 0.0035;
        if (s.z <= 0.02) {
          s.z = 1;
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
        }
      }
      const k = 0.6 / s.z,
        x = w / 2 + s.x * k * w * 0.5,
        y = h / 2 + s.y * k * h * 0.5;
      if (x < 0 || y < 0 || x > w || y > h) continue;
      const a = Math.min(1, (1 - s.z) * 1.4);
      c.fillStyle = `rgba(200,235,255,${a})`;
      c.fillRect(x, y, 1 + (1 - s.z) * 1.6, 1 + (1 - s.z) * 1.6);
    }
    starRAF = requestAnimationFrame(frame);
  };
  frame();
}
function datasetLines() {
  const cat = window.GM_CATALOG || {};
  const n = ctx.cases.length;
  const exact = ctx.cases.filter(PRECISE).length;
  const graded = ctx.cases.filter((c) => c.grade).length;
  const srcs = new Set(ctx.cases.map((c) => c._dom).filter(Boolean)).size;
  const refLayers = ctx.layers.filter((l) => l.kind === 'points' || l.kind === 'overlay').length;
  return [
    `${fmt(n)} sourced cases loaded${ctx.privateCount ? ` (${fmt(ctx.privateCount)} from your local private set)` : ''}`,
    `${fmt(exact)} exact-site or within-1 km · ${fmt(graded)} graded · ${fmt(srcs)} source domains`,
    `${refLayers} reference layers · data built ${esc(cat.built || cat.generated || '')}`.trim(),
    'Pins only where the source fixes the spot. Everything else is an uncertainty circle.',
  ];
}
export function showBoot(force) {
  const el = $('#boot');
  el.hidden = false;
  document.body.classList.add('booting');
  starfield($('#boot-stars'));
  const lines = $('#boot-lines');
  lines.innerHTML = '';
  (async () => {
    for (const t of datasetLines()) {
      const p = document.createElement('p');
      lines.append(p);
      await typeInto(p, t, 140);
    }
  })();
  $('#boot-engage').focus();
}
function hideBoot() {
  $('#boot').hidden = true;
  document.body.classList.remove('booting');
  cancelAnimationFrame(starRAF);
  LS.set('introSeen', true);
}
async function engage(withTour) {
  unlockAudio();
  if (params.audio !== 'off') setMuted(false);
  syncMute();
  sfx('boom', 0.8);
  if (params.fullscreen || withTour) document.documentElement.requestFullscreen?.().catch(() => {});
  hideBoot();
  flyIn();
  if (withTour) setTimeout(() => startTour(params.step), reduced() ? 50 : 2600);
}
function flyIn() {
  const g = ctx.globe;
  if (!reduced()) {
    g.camera.position.multiplyScalar(4.5);
  }
  g.flyTo(28, -35, 2.4, 2400);
  sweep();
}

// ---------- tour ----------
const top = (n, f = () => true) =>
  ctx.cases
    .filter((c) => c.source_url && f(c))
    .sort(caseRank)
    .slice(0, n);
const caption = (c) =>
  [
    c.date ? dayLabel(c._day) : 'undated',
    c.place || c.locality || c._area,
    c.grade ? `grade ${c.grade}` : '',
    c.coord_precision,
    domainOf(c.source_url),
  ]
    .filter(Boolean)
    .join(' · ');
const spot = (sel) => {
  $$('.spotlight').forEach((e) => e.classList.remove('spotlight'));
  if (sel) $$(sel).forEach((e) => e.classList.add('spotlight'));
};
async function closeAll() {
  const m = await import('./ui_misc.js').catch(() => null);
  for (const id of ['#analysis', '#graph', '#charts', '#wars', '#reports', '#reference', '#hotspots', '#brief']) {
    const e = $(id);
    if (e && !e.hidden) {
      e.hidden = true;
      document.body.classList.remove(id.slice(1) + '-open');
    }
  }
  return m;
}
function buildSteps() {
  const S = [];
  const nL = new Set(ctx.cases.map((c) => c.layer).filter(Boolean)).size;
  S.push({
    t: 'Global Map',
    x: `A 3D OSINT globe of ${fmt(ctx.cases.length)} sourced cases from ${nL} case layers, laid against military, nuclear, conflict, water, sky and ancient-site references. Every point carries a source link and a grade.`,
    at: [25, -30, 2.6],
  });
  S.push({
    t: 'Layers',
    x: 'Turn layers on and off here. Each layer opens into sub-layers with counts; a half-filled box means only some of its children are on.',
    spot: '#rail',
    go: async () => (await import('./ui_panels.js')).railTab('layers'),
  });
  S.push({
    t: 'Timeline',
    x: 'Scrub or play through time from 8000 BCE to today. Points appear on their date and fade; Shift-drag selects a date range.',
    spot: '#timeline',
  });
  S.push({ t: 'Search', x: 'Search cases, sites, people and countries. Press / from anywhere.', spot: '.searchbox' });
  const lead = top(1, (c) => PRECISE(c) && c._gc === 'CIT')[0] || top(1)[0];
  if (lead)
    S.push({
      t: 'Dossiers',
      x: `Click any point for its dossier: fields, sources, linked cases, conflicts between datasets. Here: ${lead.name}.`,
      at: [lead.lat, lead.lon, 1.3],
      go: async () => (await import('./ui_panels.js')).openDossier(lead),
    });
  S.push({
    t: 'Link graph',
    x: 'Cases joined by linked_case, shared named witnesses, source domain, distance and date.',
    spot: '#graph',
    go: async () => {
      (await import('./ui_panels.js')).closeDossier();
      (await import('./ui_graph.js')).toggleGraph(true);
    },
  });
  S.push({
    t: 'Analysis',
    x: 'Tests whether UAP cases sit closer to bases, nuclear sites and conflicts than chance, against three baselines.',
    spot: '#analysis',
    go: async () => {
      await closeAll();
      (await import('./ui_analysis.js')).toggleAnalysis(true);
    },
  });
  S.push({
    t: 'Reports',
    x: 'One-click briefs for a selection, country, era or category, printable to PDF.',
    spot: '#reports',
    go: async () => {
      await closeAll();
      const m = await import('./ui_reports.js');
      m.toggleReports(true);
      m.generate('all');
    },
  });
  S.push({
    t: 'Glossary and indexes',
    x: 'Sources with licences, a sourced glossary, A–Z cases, sites, countries, coverage and credits.',
    spot: '#reference',
    go: async () => {
      await closeAll();
      (await import('./ui_reference.js')).toggleReference(true, 'glossary');
    },
  });
  // state of the dataset
  const byLayer = {};
  for (const c of ctx.cases) byLayer[c.layer || 'local'] = (byLayer[c.layer || 'local'] || 0) + 1;
  const tl = Object.entries(byLayer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/^map_/, '').replace(/_/g, ' ')} ${fmt(v)}`)
    .join(' · ');
  const ex = ctx.cases.filter(PRECISE).length / (ctx.cases.length || 1),
    gr = ctx.cases.filter((c) => c.grade).length / (ctx.cases.length || 1);
  S.push({
    t: 'State of the dataset',
    x: `Largest case layers: ${tl}. ${(100 * ex).toFixed(1)}% have exact or 1 km coordinates; ${(100 * gr).toFixed(0)}% carry a grade. Full breadth and depth: Index › Coverage.`,
    go: async () => {
      await closeAll();
      (await import('./ui_reference.js')).toggleReference(true, 'coverage');
    },
  });
  top(5, (c) => PRECISE(c)).forEach((c, i) =>
    S.push({
      t: c.name,
      x: `${caption(c)}. ${String(c.summary || '').slice(0, 220)}`,
      at: [c.lat, c.lon, 1.18],
      orbit: true,
      kicker: `Top sourced case ${i + 1} of 5`,
      go: async () => {
        await closeAll();
      },
      src: c.source_url,
    }),
  );
  S.push({
    t: 'Convergence hotspots',
    x: 'Grid cells where many different layers meet, scored by grade and precision and divided by a population factor. Graded A–F by evidence quality.',
    spot: '#hotspots',
    go: async () => {
      await closeAll();
      const m = await import('./ui_hotspots.js');
      m.toggleHotspots(true);
      const r = m.hs.result || (await m.computeAll());
      const tt = r.clusters.slice(0, 3);
      if (tt.length) {
        $('#lt-text').textContent += ` Top three now: ${tt.map((c) => `${c.tier} ${c.name}`).join(', ')}.`;
        ctx.globe.flyTo(tt[0].lat, tt[0].lon, 1.6, 2200);
      }
    },
  });
  S.push({
    t: 'UAP vs military, nuclear and conflict',
    x: 'Running the proximity test on the current data…',
    go: findings,
  });
  S.push({
    t: 'Water and USO caveat',
    x: 'USO reports cluster at sea and many come from US Navy crews, so their distance to military sites is confounded by who was observing. Read their military ratios with that in mind.',
    go: async () => {
      await closeAll();
      const l = layerById('hydrolakes');
      if (l && !l.on) (await import('./layers.js')).setLayerOn('hydrolakes', true);
    },
  });
  S.push({ t: 'Now', x: 'Loading what is active at the end of the timeline…', go: nowSegment });
  S.push({
    t: 'Your turn',
    x: 'Correlation is not causation, and every number here traces back to a source you can open. Press ? for shortcuts. Explore.',
    at: [25, -30, 2.6],
    go: async () => {
      await closeAll();
      spot(null);
    },
  });
  return S;
}
async function findings() {
  const m = await import('./ui_analysis.js');
  await closeAll();
  m.toggleAnalysis(true);
  const r = m.lastAnalysis() || (await m.runAnalysis());
  const parts = Object.entries(r.refs)
    .map(([k, x]) => {
      const b = x.B.pop;
      return b
        ? `${k}: median ${fmt(x.med)} km vs ${fmt(b.med)} km population baseline (ratio ${b.ratio.toFixed(2)}, p ${b.p.toFixed(3)})`
        : null;
    })
    .filter(Boolean);
  const nT = Object.values(r.refs).reduce((a, x) => a + Object.values(x.B).filter(Boolean).length, 0);
  $('#lt-text').textContent =
    `${fmt(r.n)} UAP-type cases. ${parts.join('; ')}. ${nT} tests were run, so p-values near 0.05 are expected by chance (Bonferroni threshold ${(0.05 / Math.max(1, nT)).toFixed(4)}). Correlation, not causation.`;
}
async function nowSegment() {
  await closeAll();
  setDay(NDAYS);
  const w = await import('./ui_conflicts.js');
  await w.toggleWars(true);
  const act = w.activeConflicts(NDAYS).filter((c) => /ucdp/i.test(c.dataset || ''));
  const recent = ctx.cases
    .filter((c) => isFinite(c._day) && c._day <= NDAYS)
    .sort((a, b) => b._day - a._day)
    .slice(0, 3);
  const nt = layerById('map_nuclear_tests');
  if (nt && !nt.loaded) await (await import('./layers.js')).ensureLayer(nt).catch(() => {});
  const lastTest = (nt && nt.items ? nt.items : [])
    .filter((x) => x.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  $('#lt-text').textContent = `${dayLabel(NDAYS)}: ${act.length} UCDP-listed conflicts active${
    act.length
      ? ` (e.g. ${act
          .slice(0, 3)
          .map((c) => c.name)
          .join('; ')})`
      : ''
  }. Most recent cases: ${recent.map((c) => `${c.name} (${dayLabel(c._day)})`).join('; ')}.${lastTest ? ` Latest nuclear test on record: ${lastTest.name}, ${lastTest.date}.` : ''}`;
  if (lastTest) ctx.globe.flyTo(+lastTest.lat, +lastTest.lon, 1.5, 2200);
}
export function startTour(from = 0) {
  if (!ctx.cases.length) return;
  unlockAudio();
  const steps = buildSteps();
  cine.tour = { steps, i: Math.max(0, Math.min(steps.length - 1, from)), paused: false, timer: 0 };
  $('#lowerthird').hidden = false;
  document.body.classList.add('touring');
  show();
}
export function stopTour() {
  const t = cine.tour;
  if (!t) return;
  clearTimeout(t.timer);
  cine.tour = null;
  $('#lowerthird').hidden = true;
  document.body.classList.remove('touring');
  spot(null);
  ctx.globe.setOrbit(null);
}
async function show() {
  const t = cine.tour;
  if (!t) return;
  clearTimeout(t.timer);
  const s = t.steps[t.i];
  ctx.globe.setOrbit(null);
  spot(s.spot);
  $('#lt-kicker').textContent = s.kicker || `${t.i + 1} / ${t.steps.length}`;
  $('#lt-title').textContent = s.t;
  $('#lt-src').innerHTML = s.src
    ? `<a href="${esc(s.src)}" target="_blank" rel="noopener">${esc(domainOf(s.src))}</a>`
    : '';
  $('#lt-pause').innerHTML = icon(t.paused ? 'play' : 'pause', 16);
  $('#lt-progress').style.setProperty('--p', ((t.i + 1) / t.steps.length) * 100 + '%');
  if (s.at) {
    ctx.globe.flyTo(s.at[0], s.at[1], s.at[2], 2200);
    sweep();
  }
  const typing = typeInto($('#lt-text'), s.x, 120);
  try {
    if (s.go) await s.go();
  } catch (e) {
    console.warn('tour step', e);
  }
  if (s.orbit && !reduced())
    setTimeout(() => cine.tour && cine.tour.steps[cine.tour.i] === s && ctx.globe.setOrbit(s.at[0], s.at[1]), 2300);
  await typing;
  schedule();
}
function schedule() {
  const t = cine.tour;
  if (!t || t.paused) return;
  clearTimeout(t.timer);
  const len = $('#lt-text').textContent.length;
  t.timer = setTimeout(() => next(1), Math.max(6000, 2500 + len * 45));
}
export function next(d) {
  const t = cine.tour;
  if (!t) return;
  const j = t.i + d;
  if (j >= t.steps.length) return stopTour();
  t.i = Math.max(0, j);
  sfx('tick', 0.5);
  show();
}
export function pauseTour() {
  const t = cine.tour;
  if (!t) return;
  t.paused = !t.paused;
  $('#lt-pause').innerHTML = icon(t.paused ? 'play' : 'pause', 16);
  if (t.paused) clearTimeout(t.timer);
  else schedule();
}

// ---------- init ----------
export function initCinema() {
  // icons into the top bar
  for (const b of $$('[data-icon]')) b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon, 16));
  $('#btn-mute').onclick = toggleMute;
  $('#btn-settings').onclick = () => toggleSettings();
  $('#set-close').onclick = () => toggleSettings(false);
  $('#btn-tour').onclick = () => (cine.tour ? stopTour() : startTour());
  $('#lt-back').onclick = () => next(-1);
  $('#lt-next').onclick = () => next(1);
  $('#lt-pause').onclick = pauseTour;
  $('#lt-exit').onclick = stopTour;
  $('#boot-engage').onclick = () => engage(true);
  $('#boot-explore').onclick = () => engage(false);
  $('#boot-skip').onclick = () => {
    hideBoot();
  };
  $('#lt-back').innerHTML = icon('skip-forward', 16).replace('<svg', '<svg style="transform:scaleX(-1)"');
  $('#lt-next').innerHTML = icon('skip-forward', 16);
  $('#lt-exit').innerHTML = icon('x', 16);
  ctx.globe.onFly = (ang) => {
    if (ang > 0.05) sfx('whoosh', Math.min(1, 0.3 + ang));
    if (!cine.settings.ca) ctx.globe.fx.caPulse = 0;
  };
  document.addEventListener(
    'click',
    (e) => {
      unlockAudio();
      if (e.target.closest('.btn,.tab,button')) sfx('blip', 0.35);
    },
    true,
  );
  // tour / boot keys take precedence (capture phase)
  document.addEventListener(
    'keydown',
    (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (!$('#boot').hidden) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          engage(true);
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          hideBoot();
        }
        return;
      }
      if (cine.tour && !typing) {
        const k = e.key;
        let used = true;
        if (k === 'Escape') stopTour();
        else if (k === 'ArrowRight' || k === 'PageDown') next(1);
        else if (k === 'ArrowLeft' || k === 'PageUp') next(-1);
        else if (k === ' ' || k === 'k') pauseTour();
        else used = false;
        if (used) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (typing || e.ctrlKey || e.metaKey) return;
      if (e.key === 't' || e.key === 'T') {
        e.stopPropagation();
        cine.tour ? stopTour() : startTour();
      } else if (e.key === 'm' || e.key === 'M') {
        e.stopPropagation();
        toggleMute();
      } else if (e.key === ',') {
        e.stopPropagation();
        toggleSettings();
      }
    },
    true,
  );
  // dossier typed reveal + boom on open
  new MutationObserver(() => {
    const p = $('#dossier-body .typed');
    if (p && !p._done) {
      p._done = true;
      typeInto(p, p.textContent, 260);
      sfx('boom', 0.35);
    }
  }).observe($('#dossier-body'), { childList: true });
  let lastH = 0;
  ctx.hooks.frame2 = (now) => {
    if (now - lastH > 100 && cine.settings.hud) {
      lastH = now;
      hudFrame();
    }
  };
  if (params.perf) cine.settings.perf = true;
  if (params.fx === '0') cine.settings.fx = false;
  applySettings();
  syncMute();
  if (params.basemap === 's2') setSatelliteBasemap(true);
  // launch logic: ?tour=intro shows ENGAGE every time; otherwise the title card plays once (remembered); ?intro=0 skips it
  if (params.tour) {
    showBoot(true);
    $('#boot-engage').textContent = 'ENGAGE';
  } else if (params.intro !== '0' && !LS.get('introSeen', false)) showBoot();
  window.__tour = (i) => startTour(i || 0);
  window.__stopTour = stopTour;
}
