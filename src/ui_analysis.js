// One-click hypothesis analysis: UAP-type cases vs military / nuclear / conflict, against explicit baselines.
import {
  dateToDay,
  ctx,
  st,
  $,
  esc,
  fmt,
  S,
  emit,
  UAP_TYPES,
  caseVisibleF,
  PRECISE,
  isLand,
  countryIdAt,
  loadLayer,
  download,
  toCSV,
  dayLabel,
  layerById,
} from './app_core.js';
import { ensureLayer } from './layers.js';
import { activeConflicts } from './ui_conflicts.js';

const EDGES = [0, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 20100];
let last = null;
export function initAnalysis() {
  $('#an-close').onclick = () => toggleAnalysis(false);
  $('#an-run').onclick = () => run();
  $('#an-exact').checked = st.exactOnly;
  $('#an-exact').onchange = (e) => (st.exactOnly = e.target.checked);
  $('#an-csv').onclick = () => last && exportCSV(last);
  $('#an-hot').onchange = (e) => {
    if (!e.target.checked) ctx.globe.hideOverlay();
    else if (last) hotspot(last);
  };
}
export function toggleAnalysis(show) {
  const el = $('#analysis');
  const s = show ?? el.hidden;
  el.hidden = !s;
  document.body.classList.toggle('analysis-open', s);
  if (!s) ctx.globe.hideOverlay();
  else if (last && $('#an-hot').checked) hotspot(last);
}

async function refs(win) {
  for (const id of ['military', 'nuclear', 'map_nuclear_sites', 'ged', 'conflicts']) {
    const l = layerById(id);
    if (l && l.present !== false && !l.loaded) await ensureLayer(l);
  }
  const R = {};
  const mil = (layerById('military').items || []).filter((m) => !/^(fort|gendarmerie)/.test(m.kind || ''));
  const mi = new S.GeoIndex(2);
  mil.forEach((m) => mi.addPoint(m.lat, m.lon, m));
  mil.forEach((m) => {
    m._ia = dateToDay(m.inception);
    m._db = dateToDay(m.dissolved);
  });
  const milOk = (m, day) => {
    const a = m._ia,
      b = m._db;
    return !(isFinite(b) && b < day) && !(isFinite(a) && a > day);
  };
  R.military = {
    label:
      'Military base / installation (excl. forts, historic fortifications and gendarmerie barracks; skips sites with a known founding after / closure before the case date)',
    n: mil.length,
    near: (lat, lon, day) => mi.nearest(lat, lon, 20038, (m) => milOk(m, day)),
    timeDep: false,
    src: layerById('military').source,
  };
  const nucs = [
    ...(layerById('nuclear').items || []).map((n) => ({ ...n, _kind: 'reactor' })),
    ...((layerById('map_nuclear_sites') || {}).items || []).map((n) => ({ ...n, _kind: 'site' })),
  ];
  const ni = new S.GeoIndex(2);
  nucs.forEach((n) => ni.addPoint(n.lat, n.lon, n));
  const operating = (n, day) =>
    n._kind === 'site' || !st.nucTime
      ? true
      : (isFinite(n._day) ? n._day <= day : false) && (!isFinite(n._t1) || n._t1 >= day);
  R.nuclear = {
    label:
      'Nuclear site' +
      (st.nucTime ? ' (reactors operating at the case date; QWM/Wikidata sites undated = always)' : ''),
    n: nucs.length,
    near: (lat, lon, day) => ni.nearest(lat, lon, 20038, (n) => operating(n, day)),
    timeDep: st.nucTime,
    src: 'GeoNuclearData (IAEA PRIS/WNA) + QWM map_nuclear_sites (Wikidata)',
  };
  const ged = layerById('ged').items || [];
  const gi = new S.GeoIndex(2);
  ged.forEach((e) => gi.addPoint(e.lat, e.lon, e));
  const g0 = Math.min(...ged.map((e) => e._day)),
    g1 = Math.max(...ged.map((e) => e._day));
  R.conflict = {
    label: `Conflict event (UCDP GED, within ±${win} days)`,
    n: ged.length,
    near: (lat, lon, day) => gi.nearest(lat, lon, 20038, (e) => Math.abs(e._day - day) <= win),
    timeDep: true,
    cover: [g0 - win, g1 + win],
    src: layerById('ged').source,
  };
  return R;
}
async function popSampler() {
  const p = await loadLayer('cities15000');
  const items = p.items.map(([n, lon, lat, pop]) => ({ lat, lon, pop }));
  return {
    draw: S.weightedSampler(items, (c) => c.pop),
    label:
      'Population-weighted: GeoNames cities15000 points weighted by population (fallback; GHS-POP / GPW v4 grids not bundled)',
  };
}
export const lastAnalysis = () => last;
export async function runAnalysis() {
  await run();
  return last;
}
async function run() {
  const out = $('#an-out');
  out.innerHTML = '<p class="muted">Loading reference layers and computing…</p>';
  await new Promise((r) => setTimeout(r, 30));
  const win = +$('#an-win').value || 365,
    iters = +$('#an-iters').value || 999,
    seed = +$('#an-seed').value || 42,
    M = 3000;
  const R = await refs(win);
  const pop = await popSampler();
  const rand = S.rng(seed);
  const all = ctx.cases.filter((c) => UAP_TYPES.includes(c.category) && caseVisibleF(c) && isFinite(c._day));
  const used = st.exactOnly ? all.filter(PRECISE) : all;
  const excluded = all.length - used.length;
  const dates = used.map((c) => c._day);
  // baseline pools (positions) with dates drawn from the case date distribution (time-matched)
  const uni = [],
    pw = [];
  for (let i = 0; i < M; i++) {
    const p = S.sampleOnLand(rand, isLand);
    if (p) uni.push({ ...p, _day: dates[Math.floor(rand() * dates.length)] });
    const c = pop.draw(rand);
    pw.push({ lat: c.lat, lon: c.lon, _day: dates[Math.floor(rand() * dates.length)] });
  }
  const res = {
    when: new Date().toISOString(),
    win,
    iters,
    seed,
    exactOnly: st.exactOnly,
    nAll: all.length,
    n: used.length,
    excluded,
    refs: {},
    perCase: [],
    popLabel: pop.label,
    cases: used,
  };
  for (const [k, r] of Object.entries(R)) {
    const inCover = (d) => !r.cover || (d >= r.cover[0] && d <= r.cover[1]);
    const cs = used.filter((c) => inCover(c._day));
    const obs = [];
    for (const c of cs) {
      const h = r.near(c.lat, c.lon, c._day);
      if (h) {
        obs.push(h.d);
        (c._an = c._an || {})[k] = { d: h.d, name: h.ref.name || h.ref.conflict || '' };
      }
    }
    const pool = (P) =>
      P.filter((p) => inCover(p._day))
        .map((p) => {
          const h = r.near(p.lat, p.lon, p._day);
          return h ? h.d : NaN;
        })
        .filter(isFinite);
    const pu = pool(uni),
      pp = pool(pw);
    const B = {};
    const mc = (arr, name) => {
      if (!obs.length || !arr.length) return null;
      const t = S.monteCarloTest(obs, (rr) => arr[Math.floor(rr() * arr.length)], { iters, seed });
      return {
        name,
        med: t.baselineStat,
        ratio: t.ratio,
        p: t.p,
        pool: arr,
        w50: S.fracWithin(arr, 50),
        w100: S.fracWithin(arr, 100),
      };
    };
    B.uniform = mc(pu, 'Uniform random over land (Natural Earth admin-0 land mask)');
    B.pop = mc(pp, pop.label);
    if (r.timeDep && obs.length > 2) {
      // third baseline: same places, dates permuted among cases (tests timing, not geography)
      const perm = [];
      const rr = S.rng(seed + 1);
      for (let k2 = 0; k2 < Math.min(200, iters); k2++) {
        const sh = S.shuffle(
          cs.map((c) => c._day),
          rr,
        );
        cs.forEach((c, i) => {
          const h = r.near(c.lat, c.lon, sh[i]);
          if (h) perm.push(h.d);
        });
      }
      B.time = mc(perm, 'Time-matched: same case places, case dates permuted');
    }
    const k50 = obs.filter((d) => d <= 50).length,
      k100 = obs.filter((d) => d <= 100).length;
    res.refs[k] = {
      label: r.label,
      src: r.src,
      nRef: r.n,
      nObs: obs.length,
      obs,
      med: S.median(obs),
      ci: S.bootstrapCI(obs, { seed }),
      w50: obs.length ? k50 / obs.length : NaN,
      w50ci: S.wilson(k50, obs.length),
      w100: obs.length ? k100 / obs.length : NaN,
      w100ci: S.wilson(k100, obs.length),
      B,
      cover: r.cover,
    };
  }
  // inside a country with an active conflict (UCDP/COW/genocide participants), ±window
  const inConf = (lat, lon, day) => {
    const id = countryIdAt(lat, lon);
    const cc = ctx.countryById[id];
    if (!cc) return false;
    for (let d = day - win; d <= day + win; d += Math.max(30, win / 6))
      if (activeConflicts(d).some((c) => (c.countries || []).includes(cc.iso3) || (c.countries || []).includes(cc.a3)))
        return true;
    return false;
  };
  const kc = used.filter((c) => inConf(c.lat, c.lon, c._day)).length;
  const kp = pw.slice(0, 600).filter((p) => inConf(p.lat, p.lon, p._day)).length;
  res.inConflictCountry = {
    k: kc,
    n: used.length,
    ci: S.wilson(kc, used.length),
    base: kp / 600,
    baseCi: S.wilson(kp, 600),
  };
  res.uniPts = uni;
  res.popPts = pw;
  last = res;
  render(res);
  if ($('#an-hot').checked) hotspot(res);
  emit('analysis', res);
}
const pct = (x) => (isFinite(x) ? (x * 100).toFixed(0) + '%' : '—');
const ci = (a, f = (x) => fmt(x)) => (a && isFinite(a[0]) ? `[${f(a[0])}–${f(a[1])}]` : '');
function warn(n) {
  return n === 0
    ? '<div class="warnbox">No cases meet the current precision rule. Untick “exact / within 1 km only” to include locality/region points (their uncertainty radius is shown below).</div>'
    : n < 10
      ? `<div class="warnbox">Very small sample (N=${n}): estimates are unstable; treat p-values and ratios as exploratory.</div>`
      : n < 30
        ? `<div class="warnbox soft">Small sample (N=${n}): wide confidence intervals.</div>`
        : '';
}
function render(r) {
  const out = $('#an-out');
  const radii = r.cases.filter((c) => !PRECISE(c)).map((c) => c._r);
  let h = `<div class="banner">Correlation, not causation; baseline assumptions shown.</div>
  <p><b>${r.n}</b> UAP-type cases analysed (of ${r.nAll} matching the filters)${r.excluded ? `; ${r.excluded} excluded by the exact/within-1 km rule` : ''}. ${radii.length ? `Includes ${radii.length} imprecise points: median uncertainty radius ${fmt(S.median(radii))} km (max ${fmt(Math.max(...radii))} km); distances below that radius are within the location uncertainty.` : ''}</p>${warn(r.n)}`;
  for (const x of Object.values(r.refs)) {
    h += `<section class="an-ref"><h4>${esc(x.label)}</h4><p class="muted small">${fmt(x.nRef)} reference features · ${esc(x.src || '')}${x.cover ? ` · coverage ${esc(dayLabel(x.cover[0]))} → ${esc(dayLabel(x.cover[1]))}; ${x.nObs} cases inside coverage` : ''}</p>${x.nObs < r.n ? warn(x.nObs) : ''}
    <table class="an"><thead><tr><th></th><th>median km</th><th>ratio obs/base</th><th>p (obs closer)</th><th>≤50 km</th><th>≤100 km</th></tr></thead><tbody>
    <tr><th>Observed</th><td class="mono">${fmt(x.med)} <small>${ci(x.ci)}</small></td><td></td><td></td><td class="mono">${pct(x.w50)} <small>${ci(x.w50ci, pct)}</small></td><td class="mono">${pct(x.w100)} <small>${ci(x.w100ci, pct)}</small></td></tr>
    ${Object.values(x.B)
      .filter(Boolean)
      .map(
        (b) =>
          `<tr><th title="${esc(b.name)}">${esc(b.name.split(':')[0])}</th><td class="mono">${fmt(b.med)}</td><td class="mono">${b.ratio.toFixed(2)}</td><td class="mono">${b.p.toFixed(3)}</td><td class="mono">${pct(b.w50)}</td><td class="mono">${pct(b.w100)}</td></tr>`,
      )
      .join('')}</tbody></table>
    ${histSVG(x)}</section>`;
  }
  const ic = r.inConflictCountry;
  h += `<section class="an-ref"><h4>Inside a country with an active war/conflict (±${r.win} days)</h4><p class="mono">Observed ${ic.k}/${ic.n} = ${pct(ic.k / ic.n)} ${ci(ic.ci, pct)} · population-weighted baseline ${pct(ic.base)} ${ci(ic.baseCi, pct)}</p><p class="muted small">UCDP/COW participant states and genocide areas (2026 borders); COW lists participant states, not only where fighting took place.</p></section>`;
  h += breakdown(r, '_area', 'Country / area') + breakdown(r, 'decade', 'Decade');
  h += `<section class="bias"><h4>Reporting-bias context</h4><p>More observers, radar and sensors sit near bases, nuclear sites and cities, and conflict zones attract surveillance, so proximity can partly reflect where people and instruments are. The population-weighted baseline is a partial control for observer density; it does not model sensor coverage, secrecy, or reporting channels. The uniform-land baseline shows the raw geographic expectation. Read the ratios side by side.</p>
  <p class="muted small">Baselines: ${S.median ? '' : ''}${esc(r.popLabel)}; uniform = random points on land (Natural Earth 10 m admin-0 raster mask), ${3000} draws each, dates drawn from the case date distribution. Time-matched = case places with permuted dates. p = one-sided Monte Carlo (${r.iters} iterations, seed ${r.seed}) on the median nearest distance. CIs: bootstrap (median), Wilson (proportions).</p></section>`;
  const uso = r.cases.filter((c) => c.category === 'USO (water)'),
    wet = r.cases.filter((c) => c.over_water || (c.shore_km != null && c.shore_km <= 5));
  const nT = Object.values(r.refs).reduce((a, x) => a + Object.values(x.B).filter(Boolean).length, 0);
  h += `<section class="bias"><h4>Water subset and USO caveat</h4><p>${wet.length} analysed cases are over water or within 5 km of a shore; ${uso.length} are USO rows. <b>Distance to military is confounded for USO rows</b>: many are US Navy events (reported by ship and aircraft crews), so they are near military assets by who observed them, not by where things happen. Re-run with the USO category switched off in the Layers tree to compare.</p></section>
  <section class="bias"><h4>Multiple comparisons</h4><p>${nT} baseline tests are shown. With that many, about ${(nT * 0.05).toFixed(1)} would fall under p = 0.05 by chance alone; the Bonferroni threshold is p &lt; ${(0.05 / Math.max(1, nT)).toFixed(4)}. Confidence-interval widths are printed beside each median and share; wide intervals mean the sample cannot separate the observed value from the baseline.</p></section>`;
  out.innerHTML = h;
}
function breakdown(r, key, title) {
  const groups = {};
  for (const c of r.cases) (groups[c[key] || '—'] = groups[c[key] || '—'] || []).push(c);
  const pm = (k) => (r.refs[k] && r.refs[k].B.pop ? r.refs[k].B.pop.med : NaN);
  const rows = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .map(
      ([g, cs]) =>
        `<tr><td>${esc(g)}</td><td class="mono">${cs.length}${cs.length < 5 ? ' ⚠' : ''}</td>${[
          'military',
          'nuclear',
          'conflict',
        ]
          .map((k) => {
            const ds = cs.map((c) => c._an && c._an[k] && c._an[k].d).filter(isFinite);
            const m = S.median(ds);
            return `<td class="mono">${ds.length ? fmt(m) : ''}${ds.length && isFinite(pm(k)) ? ` <small>(${(m / pm(k)).toFixed(2)}×)</small>` : ''}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  return `<section class="an-ref"><h4>By ${title}</h4><table class="an"><thead><tr><th>${title}</th><th>N</th><th>military km</th><th>nuclear km</th><th>conflict km</th></tr></thead><tbody>${rows}</tbody></table><p class="muted small">Median observed distance; (×) = ratio to the population-weighted baseline median. ⚠ = fewer than 5 cases.</p></section>`;
}
function histSVG(x) {
  const W = 420,
    H = 120,
    P = 24;
  const n = EDGES.length - 1;
  const bw = (W - P) / n;
  const norm = (a) => {
    const h = S.histogram(a, EDGES);
    const s = a.length || 1;
    return h.map((v) => v / s);
  };
  const o = norm(x.obs),
    u = x.B.uniform ? norm(x.B.uniform.pool) : null,
    p = x.B.pop ? norm(x.B.pop.pool) : null;
  const mx = Math.max(0.01, ...o, ...(u || []), ...(p || []));
  const bars = (arr, off, col, w) =>
    arr
      .map(
        (v, i) =>
          `<rect x="${P + i * bw + off}" y="${H - 18 - (v / mx) * (H - 28)}" width="${w}" height="${(v / mx) * (H - 28)}" fill="${col}"/>`,
      )
      .join('');
  return `<svg class="hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram of nearest distances, observed vs baselines">
   ${bars(o, 1, '#38E8FF', bw / 3 - 1)}${u ? bars(u, bw / 3, '#7A90A3', bw / 3 - 1) : ''}${p ? bars(p, (2 * bw) / 3, '#FFC857', bw / 3 - 1) : ''}
   ${EDGES.slice(0, -1)
     .map(
       (e, i) =>
         `<text x="${P + i * bw + 2}" y="${H - 4}" font-size="9" fill="#9DB1C2">${e >= 1000 ? e / 1000 + 'k' : e}</text>`,
     )
     .join('')}
   <text x="${W - 4}" y="10" font-size="10" text-anchor="end" fill="#9DB1C2"><tspan fill="#38E8FF">■ observed</tspan> <tspan fill="#7A90A3">■ uniform land</tspan> <tspan fill="#FFC857">■ pop-weighted</tspan> · km</text></svg>`;
}
function hotspot(r) {
  const W = 720,
    H = 360;
  const sig = 300;
  const o = S.kdeGrid(r.cases, sig, W, H);
  const b = S.kdeGrid(r.popPts, sig, W, H);
  const so = o.reduce((a, v) => a + v, 0) || 1,
    sb = b.reduce((a, v) => a + v, 0) || 1;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c2 = cv.getContext('2d');
  const img = c2.createImageData(W, H);
  let mx = 0;
  for (let i = 0; i < o.length; i++) mx = Math.max(mx, o[i] / so);
  for (let i = 0; i < o.length; i++) {
    const po = o[i] / so,
      pb = b[i] / sb;
    if (po < mx * 0.04) continue;
    const ratio = po / (pb + mx * 0.02);
    if (ratio < 1.5) continue;
    const t = Math.min(1, Math.log(ratio) / Math.log(20));
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = Math.round(80 + 175 * (1 - t));
    img.data[i * 4 + 2] = 40;
    img.data[i * 4 + 3] = Math.round(70 + 150 * t);
  }
  c2.putImageData(img, 0, 0);
  ctx.globe.setOverlayTexture(cv, 0.8);
}
function exportCSV(r) {
  const rows = r.cases.map((c) => ({
    id: c.id,
    name: c.name,
    date: c.date,
    category: c.category,
    grade: c.grade,
    lat: c.lat,
    lon: c.lon,
    coord_precision: c.coord_precision,
    uncertainty_km: PRECISE(c) ? '' : c._r,
    country: c._area,
    military_km: c._an?.military?.d?.toFixed(1) ?? '',
    military_nearest: c._an?.military?.name ?? '',
    nuclear_km: c._an?.nuclear?.d?.toFixed(1) ?? '',
    nuclear_nearest: c._an?.nuclear?.name ?? '',
    conflict_km: c._an?.conflict?.d?.toFixed(1) ?? '',
    conflict_nearest: c._an?.conflict?.name ?? '',
    source_url: c.source_url,
  }));
  const summ = Object.entries(r.refs).flatMap(([k, x]) => [
    {
      ref: k,
      baseline: 'observed',
      n: x.nObs,
      median_km: x.med,
      ci_low: x.ci[0],
      ci_high: x.ci[1],
      ratio: '',
      p: '',
      within50: x.w50,
      within100: x.w100,
    },
    ...Object.values(x.B)
      .filter(Boolean)
      .map((b) => ({
        ref: k,
        baseline: b.name,
        n: b.pool.length,
        median_km: b.med,
        ci_low: '',
        ci_high: '',
        ratio: b.ratio,
        p: b.p,
        within50: b.w50,
        within100: b.w100,
      })),
  ]);
  download('hypothesis-per-case.csv', toCSV(rows, Object.keys(rows[0] || { id: 1 })), 'text/csv');
  setTimeout(
    () =>
      download(
        'hypothesis-summary.csv',
        `# Correlation, not causation; baseline assumptions shown. window=${r.win}d iters=${r.iters} seed=${r.seed} exactOnly=${r.exactOnly}\n` +
          toCSV(summ, [
            'ref',
            'baseline',
            'n',
            'median_km',
            'ci_low',
            'ci_high',
            'ratio',
            'p',
            'within50',
            'within100',
          ]),
        'text/csv',
      ),
    400,
  );
}
