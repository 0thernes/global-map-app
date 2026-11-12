// Intelligence-brief generator. Pure (no DOM): builds a report model from case rows and renders it to HTML.
// Every number in a report is counted from the rows passed in; every listed case links to its own source_url.
// Nothing is summarised by a model or invented: text fields are copied from the case rows verbatim.
import { GRADES, gradeClass } from './grades.js';

const GRADE_RANK = { CIT: 0, 'Official record': 1, ST: 2, Testimony: 3, Other: 4, 'Online claim': 5 };
const PREC_RANK = { exact_site: 0, within_1km: 1, locality: 2, region: 3, unspecified: 4 };
export const HEADER_TAG = 'HIGH STRANGENESS // SOURCED';
export const DISCLAIMER =
  'Styling only: this is not a government document and carries no real classification. Generated from the sourced rows in this app.';

const escH = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
  );
const count = (arr, fn) => {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (k === undefined || k === null || k === '') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
export const domainOf = (u) => {
  const m = /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(String(u || ''));
  return m ? m[1].toLowerCase() : '';
};
const yearOf = (iso) => {
  const m = /^(-?\d{1,6})/.exec(String(iso || ''));
  return m ? +m[1] : null;
};
const gc = (c) => c._gc || gradeClass(c.grade);

/** rank used for "top cases": best grade, then most precise location, then has a summary, then oldest first */
export function caseRank(a, b) {
  return (
    GRADE_RANK[gc(a)] - GRADE_RANK[gc(b)] ||
    (PREC_RANK[a.coord_precision] ?? 5) - (PREC_RANK[b.coord_precision] ?? 5) ||
    (b.summary ? 1 : 0) - (a.summary ? 1 : 0) ||
    String(a.date || '').localeCompare(String(b.date || ''))
  );
}

/**
 * @param {object[]} cases rows (common schema)
 * @param {{title?:string, scope?:string, generated?:string, top?:number}} opt
 */
export function buildReport(cases, opt = {}) {
  const rows = cases.filter((c) => c && c.source_url);
  const years = rows.map((c) => yearOf(c.date)).filter((y) => y !== null);
  const decades = count(rows, (c) => {
    const y = yearOf(c.date);
    return y === null ? null : Math.floor(y / 10) * 10;
  }).sort((a, b) => a[0] - b[0]);
  const grades = GRADES.map((g) => [g.k, rows.filter((c) => gc(c) === g.k).length, g.color]);
  const sources = count(rows, (c) => domainOf(c.source_url));
  const datasets = count(rows, (c) => c.dataset || null);
  const top = rows
    .slice()
    .sort(caseRank)
    .slice(0, opt.top ?? 12);
  return {
    title: opt.title || 'Intelligence brief',
    scope: opt.scope || 'Current selection',
    generated: opt.generated || '',
    n: rows.length,
    excludedUnsourced: cases.length - rows.length,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    grades,
    categories: count(rows, (c) => c.category),
    countries: count(rows, (c) => c._area || c.country_display || c.country),
    precision: count(rows, (c) => c.coord_precision),
    decades,
    sources,
    datasets,
    top,
    points: rows.map((c) => [+c.lat, +c.lon, gc(c)]).filter((p) => isFinite(p[0]) && isFinite(p[1])),
  };
}

const fmtN = (n) => Number(n).toLocaleString('en-US');
const yr = (y) => (y === null ? '?' : y <= 0 ? `${1 - y} BCE` : String(y));
function barsSVG(list, color, w = 320, max = 10) {
  const L = list.slice(0, max);
  const mx = Math.max(1, ...L.map((x) => x[1]));
  const rh = 18;
  return `<svg class="rp-bars" viewBox="0 0 ${w} ${L.length * rh + 2}" role="img">${L.map(
    ([k, v, c], i) =>
      `<text x="0" y="${i * rh + 13}">${escH(String(k).slice(0, 30))}</text><rect x="150" y="${i * rh + 4}" width="${((w - 200) * v) / mx}" height="11" fill="${c || color}"/><text x="${w}" y="${i * rh + 13}" text-anchor="end">${fmtN(v)}</text>`,
  ).join('')}</svg>`;
}
function decadesSVG(decades, w = 640, h = 110) {
  if (!decades.length) return '';
  const d0 = decades[0][0],
    d1 = decades[decades.length - 1][0];
  const n = (d1 - d0) / 10 + 1;
  const bw = w / n;
  const mx = Math.max(...decades.map((x) => x[1]));
  const m = new Map(decades);
  let s = '';
  for (let i = 0; i < n; i++) {
    const v = m.get(d0 + i * 10) || 0;
    const bh = ((h - 20) * v) / mx;
    s += `<rect x="${i * bw}" y="${h - 16 - bh}" width="${Math.max(1, bw - 1)}" height="${bh}"><title>${yr(d0 + i * 10)}s: ${v}</title></rect>`;
  }
  return `<svg class="rp-hist" viewBox="0 0 ${w} ${h}" role="img">${s}<text x="0" y="${h - 2}">${yr(d0)}s</text><text x="${w}" y="${h - 2}" text-anchor="end">${yr(d1)}s</text><text x="0" y="10">max ${fmtN(mx)}/decade</text></svg>`;
}
/** equirectangular dot map (graticule only; no basemap needed, works offline and in print) */
export function insetSVG(points, w = 360, h = 180) {
  const grat = [];
  for (let lon = -180; lon <= 180; lon += 30)
    grat.push(`<line x1="${((lon + 180) / 360) * w}" y1="0" x2="${((lon + 180) / 360) * w}" y2="${h}"/>`);
  for (let lat = -60; lat <= 60; lat += 30)
    grat.push(`<line x1="0" y1="${((90 - lat) / 180) * h}" x2="${w}" y2="${((90 - lat) / 180) * h}"/>`);
  const col = Object.fromEntries(GRADES.map((g) => [g.k, g.color]));
  const P = points.length > 6000 ? points.filter((_, i) => i % Math.ceil(points.length / 6000) === 0) : points;
  const dots = P.map(
    ([la, lo, g]) =>
      `<circle cx="${(((lo + 180) / 360) * w).toFixed(1)}" cy="${(((90 - la) / 180) * h).toFixed(1)}" r="1.3" fill="${col[g] || '#9db1c2'}"/>`,
  ).join('');
  return `<svg class="rp-inset" viewBox="0 0 ${w} ${h}" role="img" aria-label="Case locations (equirectangular)"><rect width="${w}" height="${h}" class="rp-sea"/><g class="rp-grat">${grat.join('')}</g>${dots}</svg>`;
}

/** @param {ReturnType<typeof buildReport>} r @param {{snapshot?:string}} opt */
export function reportHTML(r, opt = {}) {
  const pct = (v) => (r.n ? ((100 * v) / r.n).toFixed(1) + '%' : '');
  const top = r.top
    .map(
      (
        c,
        i,
      ) => `<tr><td class="rp-n">${i + 1}</td><td><a href="#" data-case="${escH(c.id)}">${escH(c.name)}</a><div class="rp-sub">${escH(c.summary || '')}</div></td>
      <td>${escH(c.date || '')}</td><td>${escH(c._area || c.country_display || c.country || '')}</td><td><span class="rp-grade" data-g="${escH(gc(c))}">${escH(c.grade || gc(c))}</span></td>
      <td>${escH(c.coord_precision || '')}</td><td><a href="${escH(c.source_url)}" target="_blank" rel="noopener">${escH(domainOf(c.source_url))}</a></td></tr>`,
    )
    .join('');
  return `<article class="rp-doc">
<div class="rp-bar">${HEADER_TAG}</div>
<header class="rp-head"><div class="rp-kicker">GLOBAL MAP · INTELLIGENCE BRIEF</div><h1>${escH(r.title)}</h1>
<table class="rp-meta"><tr><th>Scope</th><td>${escH(r.scope)}</td></tr><tr><th>Records</th><td>${fmtN(r.n)} sourced cases${r.excludedUnsourced ? ` (${fmtN(r.excludedUnsourced)} rows without source_url left out)` : ''}</td></tr>
<tr><th>Span</th><td>${yr(r.firstYear)} to ${yr(r.lastYear)}</td></tr>${r.generated ? `<tr><th>Generated</th><td>${escH(r.generated)}</td></tr>` : ''}</table></header>
<section class="rp-sec"><h2>1. Summary</h2><ul class="rp-kpis">
${r.grades.map(([k, v, c]) => `<li><b style="color:${c}">${fmtN(v)}</b><span>${escH(k)} · ${pct(v)}</span></li>`).join('')}</ul>
<p>${fmtN(r.n)} cases across ${fmtN(r.countries.length)} countries/areas and ${fmtN(r.categories.length)} categories, from ${fmtN(r.sources.length)} source domains. ${r.precision.find((p) => p[0] === 'exact_site' || p[0] === 'within_1km') ? `${fmtN(r.precision.filter((p) => p[0] === 'exact_site' || p[0] === 'within_1km').reduce((a, p) => a + p[1], 0))} have a site-level location (exact or within 1 km).` : ''}</p></section>
<section class="rp-sec rp-cols"><div><h2>2. Map inset</h2>${opt.snapshot ? `<img class="rp-snap" src="${opt.snapshot}" alt="Globe view at report time">` : ''}${insetSVG(r.points)}<p class="rp-cap">Dots coloured by grade. Imprecise locations are shown at their recorded point; see coord_precision.</p></div>
<div><h2>3. Grade breakdown</h2>${barsSVG(
    r.grades.filter((g) => g[1]),
    '#38e8ff',
  )}<h2>4. Categories</h2>${barsSVG(r.categories, '#7c9cff', 320, 8)}</div></section>
<section class="rp-sec"><h2>5. Timeline (cases per decade)</h2>${decadesSVG(r.decades)}</section>
<section class="rp-sec rp-cols"><div><h2>6. Countries / areas</h2>${barsSVG(r.countries, '#7c9cff', 320, 10)}</div><div><h2>7. Location precision</h2>${barsSVG(r.precision, '#6dff8e', 320, 6)}</div></section>
<section class="rp-sec"><h2>8. Top cases</h2><p class="rp-cap">Ranked by grade, then location precision, then oldest first. Text is copied from each record.</p>
<table class="rp-table"><thead><tr><th>#</th><th>Case</th><th>Date</th><th>Country / area</th><th>Grade</th><th>Precision</th><th>Source</th></tr></thead><tbody>${top}</tbody></table></section>
<section class="rp-sec"><h2>9. Sources cited</h2><p class="rp-cap">Domains of each case's source_url, with record counts${r.datasets.length ? '; datasets as named in the rows' : ''}.</p>
<ol class="rp-src">${r.sources
    .slice(0, 40)
    .map(
      ([d, v]) =>
        `<li><a href="https://${escH(d)}" target="_blank" rel="noopener">${escH(d)}</a> <span>${fmtN(v)}</span></li>`,
    )
    .join(
      '',
    )}</ol>${r.sources.length > 40 ? `<p class="rp-cap">…and ${fmtN(r.sources.length - 40)} more domains.</p>` : ''}
${r.datasets.length ? `<ul class="rp-src">${r.datasets.map(([d, v]) => `<li>${escH(d)} <span>${fmtN(v)}</span></li>`).join('')}</ul>` : ''}</section>
<footer class="rp-foot">${DISCLAIMER}</footer>
<div class="rp-bar">${HEADER_TAG}</div></article>`;
}
