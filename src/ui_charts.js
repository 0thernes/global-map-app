// Analytics view: linked charts (click/brush filters the globe; globe lasso and filters update the charts).
import {
  ctx,
  st,
  $,
  $$,
  esc,
  fmt,
  emit,
  on,
  caseVisibleF,
  catColor,
  CASE_CATS,
  PALETTE,
  GRADES,
  civil,
  dayOf,
  layerById,
} from './app_core.js';
import { setDay } from './ui_timeline.js';
import { openDossier } from './ui_panels.js';

let open = false;
export function initCharts() {
  $('#charts-close').onclick = () => toggleCharts(false);
  for (const ev of ['filters', 'layers-changed', 'analysis', 'conflicts-loaded']) on(ev, () => open && render());
}
export function toggleCharts(show) {
  const el = $('#charts');
  open = show ?? el.hidden;
  el.hidden = !open;
  document.body.classList.toggle('charts-open', open);
  if (open) render();
  emit('resize');
}
// each chart ignores its own dimension so the user can see what else is available (standard crossfilter behaviour)
const without = (dim) => {
  const f = st.f;
  const save = f[dim];
  f[dim] = dim === 'range' ? null : new Set();
  const r = ctx.cases.filter((c) => caseVisibleF(c));
  f[dim] = save;
  return r;
};
function render() {
  const el = $('#charts-body');
  el.innerHTML = `<div class="cgrid">
   <figure class="wide"><figcaption>Cases per year 1900-2026 by category <small>drag to brush a date range · ${ctx.cases.filter((c) => c._day < dayOf(1900)).length} cases before 1900 not shown here</small></figcaption><div id="ch-years"></div></figure>
   <figure><figcaption>Category <small>click to filter</small></figcaption><div id="ch-cat"></div></figure>
   <figure><figcaption>Grade</figcaption><div id="ch-grade"></div></figure>
   <figure><figcaption>Country / area (top 12)</figcaption><div id="ch-country"></div></figure>
   <figure><figcaption>Location precision</figcaption><div id="ch-prec"></div></figure>
   <figure class="wide"><figcaption>Context: nuclear tests per year (SIPRI/FOA) and UCDP battle deaths per year <small>click a year to jump</small></figcaption><div id="ch-context"></div></figure>
   <figure class="wide"><figcaption>Hypothesis analysis: nearest military vs nuclear distance per case <small>run Analyze (A) first; log scales</small></figcaption><div id="ch-scatter"></div></figure></div>`;
  years();
  bars(
    '#ch-cat',
    'cats',
    CASE_CATS.map((k) => [k, PALETTE[k]]),
    (c) => c.category,
  );
  bars(
    '#ch-grade',
    'grades',
    GRADES.map((g) => [g.k, g.color]),
    (c) => c._gc,
  );
  const cc = {};
  without('countries').forEach((c) => (cc[c._area] = (cc[c._area] || 0) + 1));
  bars(
    '#ch-country',
    'countries',
    Object.entries(cc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => [k, '#7C9CFF']),
    (c) => c._area,
  );
  bars(
    '#ch-prec',
    'prec',
    [
      ['exact_site', '#6DFF8E'],
      ['within_1km', '#6DFF8E'],
      ['locality', '#38E8FF'],
      ['region', '#7C9CFF'],
      ['unspecified', '#7A90A3'],
    ],
    (c) => c.coord_precision,
  );
  context();
  scatter();
}
function bars(sel, dim, keys, fn) {
  const data = without(dim);
  const counts = keys.map(([k, col]) => [k, col, data.filter((c) => fn(c) === k).length]);
  const mx = Math.max(1, ...counts.map((x) => x[2]));
  const W = 300,
    rh = 18,
    H = counts.length * rh + 4;
  $(sel).innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="bars">${counts
    .map(([k, col, n], i) => {
      const on = st.f[dim].has(k);
      const dim2 = st.f[dim].size && !on;
      return `<g class="bar" data-k="${esc(k)}" tabindex="0" role="button" aria-pressed="${on}"><text x="0" y="${i * rh + 13}" font-size="11" fill="${dim2 ? '#7A90A3' : '#E6F1F7'}">${esc(k.length > 26 ? k.slice(0, 25) + '…' : k)}</text><rect x="150" y="${i * rh + 3}" width="${Math.max(n ? 2 : 0, (n / mx) * 120)}" height="12" rx="2" fill="${col}" opacity="${dim2 ? 0.3 : 0.9}"/>${on ? `<rect x="148" y="${i * rh + 1}" width="${(n / mx) * 120 + 4}" height="16" fill="none" stroke="#fff" rx="3"/>` : ''}<text x="${154 + (n / mx) * 120}" y="${i * rh + 13}" font-size="11" fill="#9DB1C2">${n}</text></g>`;
    })
    .join('')}</svg>`;
  $$(`${sel} .bar`).forEach(
    (g) =>
      (g.onclick = () => {
        const s = st.f[dim];
        const k = g.dataset.k;
        s.has(k) ? s.delete(k) : s.add(k);
        emit('filters');
      }),
  );
}
function years() {
  const W = 900,
    H = 150,
    P = 28;
  const y0 = 1900,
    y1 = 2026;
  const n = y1 - y0 + 1;
  const bw = (W - P) / n;
  const data = without('range');
  const stack = Array.from({ length: n }, () => ({}));
  for (const c of data) {
    const y = civil(c._day).y;
    if (y < y0 || y > y1) continue;
    const s = stack[y - y0];
    s[c.category] = (s[c.category] || 0) + 1;
  }
  const mx = Math.max(1, ...stack.map((s) => Object.values(s).reduce((a, b) => a + b, 0)));
  let rects = '';
  stack.forEach((s, i) => {
    let acc = 0;
    for (const [k, v] of Object.entries(s)) {
      const h = (v / mx) * (H - 30);
      rects += `<rect x="${P + i * bw}" y="${H - 18 - acc - h}" width="${Math.max(1, bw - 1)}" height="${h}" fill="${catColor(k)}"><title>${y0 + i}: ${v} ${esc(k)}</title></rect>`;
      acc += h;
    }
  });
  const r = st.f.range;
  const rx = (d) => P + (Math.max(y0, Math.min(y1 + 1, civil(d).y + (civil(d).m - 1) / 12)) - y0) * bw;
  const brush = r
    ? `<rect x="${rx(r[0])}" y="4" width="${Math.max(2, rx(r[1]) - rx(r[0]))}" height="${H - 22}" fill="rgba(56,232,255,0.12)" stroke="#38E8FF"/>`
    : '';
  const cur = civil(st.cur).y;
  const ticks = [1900, 1920, 1940, 1960, 1980, 2000, 2020]
    .map((y) => `<text x="${P + (y - y0) * bw}" y="${H - 4}" font-size="10" fill="#9DB1C2">${y}</text>`)
    .join('');
  $('#ch-years').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" id="yrsvg">${rects}${brush}${ticks}<text x="2" y="12" font-size="10" fill="#9DB1C2">${mx}</text>${cur >= y0 ? `<rect x="${P + (cur - y0) * bw}" y="0" width="1.5" height="${H - 16}" fill="#38E8FF"/>` : ''}</svg>`;
  const svg = $('#yrsvg');
  let a = null;
  const toYear = (e) => {
    const b = svg.getBoundingClientRect();
    return y0 + (((e.clientX - b.left) / b.width) * W - P) / bw;
  };
  svg.onpointerdown = (e) => {
    a = toYear(e);
    svg.setPointerCapture(e.pointerId);
  };
  svg.onpointermove = (e) => {
    if (a == null) return;
    const b2 = toYear(e);
    const lo = Math.max(y0, Math.min(a, b2)),
      hi = Math.min(y1 + 1, Math.max(a, b2));
    if (hi - lo < 0.5) return;
    st.f.range = [
      dayOf(Math.floor(lo), 1 + Math.floor((lo % 1) * 12)),
      dayOf(Math.floor(hi), 1 + Math.floor((hi % 1) * 12)),
    ];
    emit('filters');
  };
  svg.onpointerup = (e) => {
    if (a != null && Math.abs(toYear(e) - a) < 0.3) {
      st.f.range = null;
      emit('filters');
    }
    a = null;
  };
}
function context() {
  const W = 900,
    H = 120,
    P = 28,
    y0 = 1900,
    y1 = 2026,
    n = y1 - y0 + 1,
    bw = (W - P) / n;
  const nt = new Array(n).fill(0);
  const tl = layerById('map_nuclear_tests');
  ((tl && tl.items) || []).forEach((t) => {
    const y = civil(t._day).y;
    if (y >= y0 && y <= y1) nt[y - y0]++;
  });
  const bd = new Array(n).fill(0);
  (ctx.conflicts ? ctx.conflicts.items : []).forEach((c) => {
    for (const [y, v] of Object.entries(c.peryear || {})) if (+y >= y0 && +y <= y1) bd[+y - y0] += v.best || 0;
  });
  const m1 = Math.max(1, ...nt),
    m2 = Math.max(1, ...bd);
  const rects = nt
    .map(
      (v, i) =>
        `<rect x="${P + i * bw}" y="${H - 18 - (v / m1) * (H - 30)}" width="${Math.max(1, bw - 1)}" height="${(v / m1) * (H - 30)}" fill="#FF9A3C" opacity="0.8" data-y="${y0 + i}"><title>${y0 + i}: ${v} nuclear tests</title></rect>`,
    )
    .join('');
  const pts = bd.map((v, i) => `${P + i * bw + bw / 2},${H - 18 - (v / m2) * (H - 30)}`).join(' ');
  const ticks = [1900, 1920, 1940, 1960, 1980, 2000, 2020]
    .map((y) => `<text x="${P + (y - y0) * bw}" y="${H - 4}" font-size="10" fill="#9DB1C2">${y}</text>`)
    .join('');
  $('#ch-context').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" id="ctxsvg">${rects}<polyline points="${pts}" fill="none" stroke="#FF5A2B" stroke-width="1.5"/>${ticks}<text x="${W - 4}" y="12" text-anchor="end" font-size="10" fill="#9DB1C2"><tspan fill="#FF9A3C">■ nuclear tests/yr (max ${m1})</tspan> <tspan fill="#FF5A2B">— UCDP BRD best/yr (max ${fmt(m2)})</tspan>${tl && tl.items ? '' : ' · load the Nuclear tests layer'}${ctx.conflicts ? '' : ' · load Conflicts'}</text></svg>`;
  $('#ctxsvg').onclick = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const y = Math.round(y0 + (((e.clientX - b.left) / b.width) * W - P) / bw);
    if (y >= y0 && y <= y1) setDay(dayOf(y, 7, 1));
  };
}
function scatter() {
  const W = 900,
    H = 200,
    P = 36;
  const cs = ctx.cases.filter((c) => c._an && c._an.military && c._an.nuclear && caseVisibleF(c));
  if (!cs.length) {
    $('#ch-scatter').innerHTML = '<p class="muted small">No analysis results yet.</p>';
    return;
  }
  const lx = (d) => P + (Math.log10(Math.max(1, d)) / 4.3) * (W - P - 10),
    ly = (d) => H - 20 - (Math.log10(Math.max(1, d)) / 4.3) * (H - 30);
  const ticks = [1, 10, 100, 1000, 10000]
    .map(
      (d) =>
        `<text x="${lx(d)}" y="${H - 6}" font-size="10" fill="#9DB1C2">${fmt(d)}</text><text x="2" y="${ly(d) + 3}" font-size="10" fill="#9DB1C2">${fmt(d)}</text>`,
    )
    .join('');
  $('#ch-scatter').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}">${ticks}${cs.map((c) => `<circle cx="${lx(c._an.military.d)}" cy="${ly(c._an.nuclear.d)}" r="4" fill="${catColor(c.category)}" opacity="0.85" data-id="${esc(c.id)}"><title>${esc(c.name)}: military ${fmt(c._an.military.d)} km, nuclear ${fmt(c._an.nuclear.d)} km</title></circle>`).join('')}<text x="${W - 4}" y="${H - 6}" text-anchor="end" font-size="10" fill="#9DB1C2">x: km to nearest military site · y: km to nearest nuclear site</text></svg>`;
  $$('#ch-scatter circle').forEach(
    (ci) => (ci.onclick = () => openDossier(ctx.cases.find((c) => c.id === ci.dataset.id))),
  );
}
