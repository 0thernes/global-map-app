// Data panel (D): the non-spatial PDF 7 layer and everything that cannot be a pin. Entries, PDF 7 tables as sortable
// data tables, charts that reproduce PDF 7 figures from the CSVs, source types, a cross-layer test battery with
// honest p-values, and the unplaced-but-sourced list. Every number names its PDF 7 § and page or its source column.
import { ctx, $, $$, esc, fmt, link, download } from './app_core.js';
import { inject } from './loader.js';
import { makeTabs } from './ui/tabs.js';
import { icon } from './icons.js';
import { numericCols } from './ui/table.js';

// Heat fill strength (8–88 %). Between ~45 % and ~57 % neither light nor dark text reaches 4.5:1 on the cyan fill,
// so those cells are pushed to 42 % (light text) or 58 % (dark text).
const heatPct = (v, m) => {
  const p = Math.round(8 + (80 * v) / m);
  return p < 50 ? Math.min(p, 42) : Math.max(p, 58);
};
import { openDossier } from './ui_panels.js';
import { countBy, ranked, crosstab, eraOf, ERAS, histogram, sortRows, gradeClass, battery } from './pdf7_stats.js';

const TABS = [
  ['overview', 'Overview'],
  ['entries', 'Entries'],
  ['charts', 'Charts'],
  ['tables', 'PDF 7 tables'],
  ['sources', 'Sources'],
  ['stats', 'Stats'],
  ['unplaced', 'Unplaced'],
];
// categorical chart palette: design tokens --chart-1..12 (css/tokens.css), tuned for AA contrast on --bg-2
const COLORS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);
const PART = { I: 'Part I theories', II: 'Part II glitches', V: 'Part V cases' };
let tab = 'overview',
  q = '',
  D = null,
  U = null,
  sel = 'T001',
  sortState = {},
  shown = 200,
  filt = { part: '', kind: '', place: '' },
  bat = null,
  dtabs = null;

export function initData() {
  $('#data-close').onclick = () => toggleData(false);
  dtabs = makeTabs($('#data-tabs'), TABS, {
    active: tab,
    attr: 'dt',
    panel: 'data-body',
    label: 'Data views',
    onChange: (id) => {
      tab = id;
      shown = 200;
      render();
    },
  });
  $('#data-q').oninput = (e) => {
    q = e.target.value;
    clearTimeout(initData.t);
    initData.t = setTimeout(render, 150);
  };
}
async function load() {
  if (D) return;
  await Promise.all([inject('data/pdf7_data.js'), inject('data/unplaced.js')]);
  D = window.GM_PDF7_DATA;
  U = window.GM_UNPLACED || { rows: [], unsourced: [] };
}
export async function toggleData(show, which) {
  const el = $('#datap');
  const s = show ?? el.hidden;
  el.hidden = !s;
  if (which) tab = which;
  if (!s) return;
  $('#data-body').innerHTML = '<p class="muted">Loading the PDF 7 data layer…</p>';
  await load();
  render();
}
const figRef = (file) => {
  const f = D.figures.find((x) => x.file === file);
  return f ? `reproduces PDF 7 ${esc(f.id)} (§${esc(f.sec || '?')} p.${esc(f.page || '?')})` : '';
};
const src = (s) => `<small class="muted dsrc">Source: ${s}</small>`;

// ---------- small SVG/HTML chart helpers ----------
function hbars(pairs, { color = () => 'var(--chart-1)', max = null, unit = '' } = {}) {
  const m = max || Math.max(1, ...pairs.map((p) => p[1]));
  return `<table class="dbars">${pairs
    .map(
      ([k, n], i) =>
        `<tr><th title="${esc(k)}">${esc(k)}</th><td><span style="width:${((n / m) * 100).toFixed(1)}%;background:${color(k, i)}"></span></td><td class="n num">${fmt(n)}${unit}</td></tr>`,
    )
    .join('')}</table>`;
}
function stacked(rows, segs, cell, { colors = COLORS } = {}) {
  // rows: labels; segs: segment labels; cell(r,s) -> count
  const tot = rows.map((r) => segs.reduce((a, s) => a + cell(r, s), 0));
  const m = Math.max(1, ...tot);
  const legend = segs
    .map((s, i) => `<span class="lg"><i style="background:${colors[i % colors.length]}"></i>${esc(s)}</span>`)
    .join('');
  return `<div class="dlegend">${legend}</div><table class="dbars">${rows
    .map(
      (r, ri) =>
        `<tr><th title="${esc(r)}">${esc(r)}</th><td>${segs
          .map((s, i) => {
            const v = cell(r, s);
            return v
              ? `<span style="width:${((v / m) * 100).toFixed(2)}%;background:${colors[i % colors.length]}" title="${esc(r)} · ${esc(s)}: ${v}"></span>`
              : '';
          })
          .join('')}</td><td class="n num">${tot[ri]}</td></tr>`,
    )
    .join('')}</table>`;
}
function heat(ct) {
  const m = Math.max(1, ...ct.t.flat());
  return `<div class="dscroll"><table class="dheat"><tr><th></th>${ct.cols.map((c) => `<th title="${esc(c)}">${esc(c)}</th>`).join('')}</tr>${ct.rows
    .map(
      (r, i) =>
        `<tr><th title="${esc(r)}">${esc(r)}</th>${ct.t[i].map((v) => `<td class="num${heatPct(v, m) >= 58 ? ' hi' : ''}" style="background:color-mix(in srgb, var(--chart-1) ${heatPct(v, m)}%, transparent)">${v || ''}</td>`).join('')}</tr>`,
    )
    .join('')}</table></div>`;
}
function scatter(pts, { xl, yl, W = 860, H = 260 }) {
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const P = 36,
    sx = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - P - 10),
    sy = (y) => H - 24 - ((y - y0) / (y1 - y0 || 1)) * (H - 34);
  const jit = (i) => ((i * 9301 + 49297) % 233280) / 233280 - 0.5; // deterministic jitter for tied ordinal scores
  return `<svg viewBox="0 0 ${W} ${H}" class="dsvg">${pts
    .map(
      (p, i) =>
        `<${p.shape === 'sq' ? 'rect' : 'circle'} ${p.shape === 'sq' ? `x="${sx(p.x) + jit(i) * 8 - 3}" y="${sy(p.y) + jit(i + 7) * 8 - 3}" width="6" height="6"` : `cx="${sx(p.x) + jit(i) * 8}" cy="${sy(p.y) + jit(i + 7) * 8}" r="3"`} style="fill:${p.c}" opacity="0.75"><title>${esc(p.t)}</title></${p.shape === 'sq' ? 'rect' : 'circle'}>`,
    )
    .join(
      '',
    )}<text class="ax" x="${P}" y="${H - 6}">${esc(xl)}: ${fmt(x0)} → ${fmt(x1)}</text><text class="ax" x="4" y="14">${esc(yl)}: ${fmt(y0)} → ${fmt(y1)}</text></svg>`;
}
function hist(values, edges, labels, color = 'var(--chart-1)') {
  const h = histogram(values, edges);
  return hbars(
    h.map((n, i) => [labels ? labels[i] : `${edges[i]}–${edges[i + 1]}`, n]),
    { color: () => color },
  );
}
const csvReg = new Map();
const csvCell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
function sortable(id, head, rows, { limit = 0, html = null } = {}) {
  const s = sortState[id] || { col: -1, dir: 1 };
  const rs = s.col >= 0 ? sortRows(rows, s.col, s.dir) : rows;
  csvReg.set(id, [head, rs]);
  const vis = limit ? rs.slice(0, limit) : rs;
  const num = numericCols(head.length, rows);
  const nc = (i) => (num[i] ? ' num' : '');
  return `<p class="dtools"><button class="btn small" data-csv="${esc(id)}" title="Download these ${rs.length} rows (current sort and filter) as CSV">CSV (${rs.length} rows)</button></p><div class="dscroll"><table class="dtable" data-sort="${esc(id)}"><thead><tr>${head
    .map(
      (h, i) =>
        `<th data-col="${i}" scope="col" tabindex="0" aria-sort="${s.col === i ? (s.dir > 0 ? 'ascending' : 'descending') : 'none'}" class="${s.col === i ? (s.dir > 0 ? 'asc' : 'desc') : ''}${nc(i)}" title="Sort by ${esc(h)}">${esc(h)}</th>`,
    )
    .join('')}</tr></thead><tbody>${vis
    .map(
      (r, ri) =>
        `<tr>${r.map((c, ci) => `<td class="${nc(ci).trim()}">${html ? html(r, ci, c, ri) : esc(c)}</td>`).join('')}</tr>`,
    )
    .join(
      '',
    )}</tbody></table></div>${limit && rs.length > limit ? `<p><button class="btn" id="d-more">Show more (${rs.length - limit} left)</button></p>` : ''}`;
}
function wireSort() {
  $$('#data-body table[data-sort] th[data-col]').forEach(
    (th) =>
      (th.onclick = th.onkeydown =
        (e) => {
          if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const id = th.closest('table').dataset.sort,
            col = +th.dataset.col;
          const s = sortState[id] || { col: -1, dir: 1 };
          sortState[id] = { col, dir: s.col === col ? -s.dir : 1 };
          render();
          const again = $(`#data-body table[data-sort="${id}"] th[data-col="${col}"]`);
          if (again && e.type === 'keydown') again.focus();
        }),
  );
  $$('#data-body [data-csv]').forEach(
    (b) =>
      (b.onclick = () => {
        const [head, rows] = csvReg.get(b.dataset.csv);
        download(
          `pdf7-${b.dataset.csv}.csv`,
          [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n',
          'text/csv',
        );
      }),
  );
  const more = $('#d-more');
  if (more)
    more.onclick = () => {
      shown += 500;
      render();
    };
}
const match = (txt) => !q.trim() || txt.toLowerCase().includes(q.trim().toLowerCase());

// ---------- tabs ----------
function overview() {
  const E = D.entries;
  const T1 = D.tables.find((t) => t.id === 'T001');
  const hc = Object.fromEntries(T1.rows.map((r) => [r[0], r.slice(1)]));
  const P1 = E.filter((e) => e.part === 'I'),
    P2 = E.filter((e) => e.part === 'II'),
    P5 = E.filter((e) => e.part === 'V');
  const tiers = countBy(D.cit, (c) => c.tier);
  const checks = [
    ['Part I entries', hc['Entries'][0], P1.length, 'entries CSV rows'],
    ['Part II entries (G1–G11)', hc['Entries'][1], P2.length, 'glitches CSV rows G1–G11'],
    ['Deep profiles (Part I)', hc['Deep profiles'][0], P1.filter((e) => e.deep).length, 'deep_profile = yes'],
    [
      'Domains (Part I / Part II)',
      `${hc['Domains'][0]} / ${hc['Domains'][1]}`,
      `${new Set(P1.map((e) => e.domain)).size} / ${new Set(P2.map((e) => e.domain)).size}`,
      'distinct domain values',
    ],
    [
      'CIT / ST testimony sources',
      hc['CIT / ST testimony sources'][1],
      `${tiers.get('CIT') || 0} / ${tiers.get('ST') || 0}`,
      `CIT-sources CSV tier; printed register has ${D.cit.filter((c) => c.in_register).length} labelled entries`,
    ],
    [
      'FRINGE-marked (Part I tier / G11)',
      `${hc['FRINGE-marked'][0].split(' ')[0]} / ${hc['FRINGE-marked'][1].split(' ')[0]}`,
      `${P1.filter((e) => e.tier === 'Fringe').length} / ${P2.filter((e) => e.fringe).length}`,
      'tier = Fringe; domain G11',
    ],
    [
      'Part V case files (G12)',
      hc['Part V high-strangeness case files (G12)'][1].split(' ')[0],
      P5.length,
      'glitches CSV rows G12',
    ],
  ];
  const place = countBy(
    E.filter((e) => e.part !== 'I'),
    (e) =>
      ({
        add: 'on globe (added)',
        link: 'on globe (linked)',
        merge: 'on globe (merged)',
        unplaced: 'names a place, unplaceable',
        no_place: 'not a place',
      })[e.place] || e.place,
  );
  const secTitle = Object.fromEntries(D.sections.filter((s) => s.num).map((s) => [s.num, s.title]));
  const bySec = ranked(
    countBy(
      E.filter((e) => e.sec),
      (e) => e.sec,
    ),
  ).map(([s, n]) => [`§${s} ${secTitle[s] || ''}`, n]);
  const mapped = new Map(ctx.cases.map((c) => [c.id, c]));
  const ctry = countBy(
    E.flatMap((e) => (e.map || []).map((id) => mapped.get(id)).filter(Boolean)),
    (c) => c._area || c.country || 'unknown',
  );
  return `<div class="data-overview">
  <p class="small muted">PDF 7, <i>What Is What of the What</i> (${D.pdf.pages} pages), as data: ${E.length} entries (${P1.length} theories, ${P2.length} glitches, ${P5.length} Part V case files), ${D.tables.length - 7} PDF 7 tables + 7 QWM aggregate tables, ${D.figures.length} figures, ${D.cit.length} testimony sources, ${D.taxonomy.length} taxonomy rows, ${D.docs.length} Part V document links. Items that are not places live here, not on the globe.</p>
  <div class="cgrid">
   <figure class="wide"><figcaption>Stated in PDF 7 vs recomputed from the CSVs ${src(`PDF 7 table T001 (§front, p.${T1.page}) and the PDF 7 CSVs`)}</figcaption>
   <table class="kv"><tr><th>Count</th><td><b>PDF 7 says</b></td><td><b>CSV gives</b></td><td><b>Basis</b></td></tr>${checks
     .map(
       ([k, a, b, basis]) =>
         `<tr class="${String(a) === String(b) ? '' : 'dconf'}"><th>${esc(k)}</th><td>${esc(a)}</td><td>${esc(b)}${String(a) === String(b) ? ' ✓' : ' <b>≠ conflict</b>'}</td><td><small>${esc(basis)}</small></td></tr>`,
     )
     .join('')}</table></figure>
   <figure><figcaption>Entries by part and kind ${src('kind derived from PDF 7 domain (ADR 0002)')}</figcaption>${stacked(
     ['I', 'II', 'V'].map((p) => PART[p]),
     [...new Set(E.map((e) => e.kind))].sort(),
     (r, s) => E.filter((e) => PART[e.part] === r && e.kind === s).length,
   )}</figure>
   <figure><figcaption>Placement of Part II and V entries ${src('data/sources/pdf7/status.csv')}</figcaption>${hbars(ranked(place))}</figure>
   <figure><figcaption>Entries by era (first source year) ${src('year column of both CSVs; QWM era bins')}</figcaption>${stacked(
     ERAS.map((e) => e[0]).concat(['undated']),
     ['I', 'II', 'V'].map((p) => PART[p]),
     (r, s) => E.filter((e) => PART[e.part] === s && eraOf(e.year) === r).length,
   )}</figure>
   <figure><figcaption>Grade distribution ${src('Part I tier; Parts II/V evidence_grade (claim layer)')}</figcaption>${stacked(
     [...new Set(E.map((e) => (e.part === 'I' ? e.tier : gradeClass(e.grade))))].sort(),
     ['I', 'II', 'V'].map((p) => PART[p]),
     (r, s) => E.filter((e) => PART[e.part] === s && (e.part === 'I' ? e.tier : gradeClass(e.grade)) === r).length,
   )}</figure>
   <figure><figcaption>Entries by PDF 7 section ${src('section numbers from main.aux labels')}</figcaption><div class="dscroll short">${hbars(bySec)}</div></figure>
   <figure><figcaption>Country of the map rows PDF 7 entries point to ${src('country of linked/added map rows (public build)')}</figcaption><div class="dscroll short">${hbars(ranked(ctry))}</div></figure>
  </div></div>`;
}
function entries() {
  const mapped = new Map(ctx.cases.map((c) => [c.id, c]));
  const E = D.entries.filter(
    (e) =>
      (!filt.part || e.part === filt.part) &&
      (!filt.kind || e.kind === filt.kind) &&
      (!filt.place || e.place === filt.place) &&
      match(`${e.id} ${e.name} ${e.domain} ${e.category} ${e.grade} ${e.src}`),
  );
  const opt = (k, vals) =>
    `<select data-f="${k}" aria-label="Filter by ${k}"><option value="">all ${k}s</option>${vals.map((v) => `<option ${filt[k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const rows = E.map((e) => {
    const md = (e.map || []).map((id) => mapped.get(id)).find((c) => c && c.date);
    return [
      e.id,
      e.part,
      e.kind,
      e.name,
      e.year ?? '',
      md ? md.date.slice(0, 10) : '',
      eraOf(e.year),
      e.part === 'I' ? e.tier : e.grade,
      e.reality ?? e.composite ?? '',
      e.sec,
      e.page ?? '',
      e.place,
      (e.map || []).join(' '),
    ];
  });
  return `<div class="data-entries data-datebasis"><p class="small muted">All ${D.entries.length} PDF 7 entries with section and printed page. <b>PDF year</b> is the year of the first source in PDF 7; <b>map date</b> is the event date on the linked map row. Where they differ by more than a year, both are kept and the audit lists the pair as a conflict. Click a header to sort; click a mapped entry to open it on the globe.</p>
  <p class="dfilters">${opt('part', ['I', 'II', 'V'])} ${opt('kind', [...new Set(D.entries.map((e) => e.kind))].sort())} ${opt('place', [...new Set(D.entries.map((e) => e.place))].sort())} <span class="muted small">${E.length} shown</span></p>
  ${sortable(
    'entries',
    [
      'Path',
      'Part',
      'Kind',
      'Name',
      'PDF year',
      'Map date',
      'Era',
      'Tier / grade',
      'Reality (II/V) or composite (I)',
      '§',
      'Page',
      'Placement',
      'Map rows',
    ],
    rows,
    {
      limit: shown,
      html: (r, ci, c) =>
        ci === 3 && r[12]
          ? `<a href="#" data-open="${esc(String(r[12]).split(' ')[0])}">${esc(c)}</a>`
          : ci === 12
            ? `<small class="mono">${esc(c)}</small>`
            : ci === 5 && c && Math.abs(+String(c).slice(0, 4) - +r[4]) > 1
              ? `<b class="dconf" title="differs from the PDF year">${esc(c)}</b>`
              : esc(c),
    },
  )}</div>`;
}
function charts() {
  const E = D.entries,
    P1 = E.filter((e) => e.part === 'I'),
    P2 = E.filter((e) => e.part === 'II'),
    P5 = E.filter((e) => e.part === 'V');
  const tiers = ['Established', 'Serious hypothesis', 'Contested', 'Thought-experiment tool', 'Fringe', 'Pure fiction'];
  const domsI = [...new Set(P1.map((e) => e.domain))];
  const grades2 = ranked(countBy(P2, (e) => gradeClass(e.grade))).map((x) => x[0]);
  const domsII = [...new Set(P2.map((e) => e.domain))];
  const yrs = E.filter((e) => e.year != null);
  const edges = [-10000, -500, 500, 1500, 1800, 1900, 1925, 1950, 1975, 2000, 2010, 2020, 2027];
  const lbl = [
    '< 500 BCE',
    '500 BCE–500',
    '500–1500',
    '1500–1800',
    '1800–1900',
    '1900–24',
    '1925–49',
    '1950–74',
    '1975–99',
    '2000–09',
    '2010–19',
    '2020–26',
  ];
  const groups5 = [...new Set(P5.map((e) => e.id.split('.').slice(0, 2).join('.')))];
  const grades5 = ranked(countBy(P5, (e) => gradeClass(e.grade))).map((x) => x[0]);
  const aff = ranked(countBy(D.cit, (c) => (c.affiliation || 'unstated').split(/[;,(]/)[0].trim() || 'unstated')).slice(
    0,
    15,
  );
  const tierCol = (k) => COLORS[tiers.indexOf(k) % COLORS.length];
  return `<div class="cgrid">
   <figure class="wide fig-tier-bars"><figcaption>Part I entries per domain by tier ${src(`entries CSV domain, tier · ${figRef('fig/tier_bars.png')}`)}</figcaption>${stacked(domsI, tiers, (d, t) => P1.filter((e) => e.domain === d && e.tier === t).length)}</figure>
   <figure class="wide fig-tier-heat"><figcaption>Tier × domain (Part I) ${src(`entries CSV · ${figRef('fig/tier_heat.png')}`)}</figcaption>${heat(
     crosstab(
       P1,
       (e) => e.domain,
       (e) => e.tier,
     ),
   )}</figure>
   <figure class="fig-testability"><figcaption>Testability × tier (Part I) ${src(`entries CSV testable, tier · ${figRef('fig/testability.png')}`)}</figcaption>${heat(
     crosstab(
       P1,
       (e) => e.testable,
       (e) => e.tier,
     ),
   )}</figure>
   <figure class="fig-scores"><figcaption>Composite score distribution (Part I) ${src(`entries CSV composite · ${figRef('fig/scores.png')}`)}</figcaption>${hist(
     P1.map((e) => e.composite),
     [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101],
     ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100'],
   )}</figure>
   <figure class="wide fig-timeline"><figcaption>Timeline: entries by first-source year and part ${src(`year column of both CSVs (${yrs.length} of ${E.length} dated) · ${figRef('fig/timeline_th.png')}; ${figRef('fig/timeline_gl.png')}; ${figRef('fig/hs_timeline.png')}`)}</figcaption>${stacked(
     lbl,
     ['I', 'II', 'V'].map((p) => PART[p]),
     (b, s) => {
       const i = lbl.indexOf(b);
       return yrs.filter((e) => PART[e.part] === s && e.year >= edges[i] && e.year < edges[i + 1]).length;
     },
   )}</figure>
   <figure class="wide fig-grade-bars"><figcaption>Part II glitches per domain by evidence grade ${src(`glitches CSV evidence_grade, domain · ${figRef('fig/grade_bars.png')}; ${figRef('fig/glitch_grade_heat.png')}`)}</figcaption>${stacked(domsII, grades2, (d, g) => P2.filter((e) => e.domain === d && gradeClass(e.grade) === g).length)}</figure>
   <figure class="wide fig-possibility"><figcaption>Possibility map: score vs radicalness ${src(`Part I composite (dots) and Part II glitch_score (squares) against radicalness · ${figRef('fig/possibility.png')}`)}</figcaption>${scatter(
     P1.filter((e) => e.composite != null && e.radical != null)
       .map((e) => ({
         x: e.radical,
         y: e.composite,
         c: tierCol(e.tier),
         t: `${e.id} ${e.name}: composite ${e.composite}, radicalness ${e.radical}`,
       }))
       .concat(
         P2.filter((e) => e.score != null && e.radical != null).map((e) => ({
           x: e.radical,
           y: e.score,
           c: e.fringe ? 'var(--chart-5)' : 'var(--chart-2)',
           shape: 'sq',
           t: `${e.id} ${e.name}: glitch score ${e.score}, radicalness ${e.radical}`,
         })),
       ),
     { xl: 'radicalness', yl: 'score (0–100)' },
   )}</figure>
   <figure class="wide fig-hs-grades"><figcaption>Part V case files by group and claim-layer grade ${src(`glitches CSV G12 rows · ${figRef('fig/hs_grades.png')}`)}</figcaption>${stacked(groups5, grades5, (g, gr) => P5.filter((e) => e.id.startsWith(g + '.') && gradeClass(e.grade) === gr).length)}</figure>
   <figure class="fig-cit"><figcaption>Testimony sources by affiliation (top 15) ${src(`CIT-sources CSV affiliation (first clause) · ${figRef('fig/cit_sources.png')}`)}</figcaption>${hbars(aff)}</figure>
   <figure class="fig-cit"><figcaption>Testimony sources by tier and stance ${src('CIT-sources CSV tier, stance')}</figcaption>${heat(
     crosstab(
       D.cit,
       (c) => c.tier,
       (c) => c.stance,
     ),
   )}</figure>
   <figure class="wide fig-taxonomy"><figcaption>UAP / NHI / HS taxonomy by source class ${src(`UAP-NHI CSV taxonomy, source_class · ${figRef('fig/uap_tree.png')}; ${figRef('fig/nhi_tree.png')}`)}</figcaption>${heat(
     crosstab(
       D.taxonomy,
       (t) => t.source_class || '(none given)',
       (t) => t.taxonomy,
     ),
   )}</figure>
   <figure class="wide fig-tax"><figcaption>Taxonomy trees as counts: domain → category ${src(`both CSVs domain, category · reproduces the PDF 7 subtree figures F09–F21 and F27–F37 as counts`)}</figcaption><div class="dscroll">${[
     'I',
     'II',
     'V',
   ]
     .map(
       (p) =>
         `<h4>${PART[p]}</h4>${[
           ...countBy(
             E.filter((e) => e.part === p),
             (e) => e.domain,
           ),
         ]
           .map(
             ([d, n]) =>
               `<details><summary>${esc(d)} <b>${n}</b></summary>${hbars(
                 ranked(
                   countBy(
                     E.filter((e) => e.part === p && e.domain === d),
                     (e) => e.category,
                   ),
                 ),
               )}</details>`,
           )
           .join('')}`,
     )
     .join('')}</div></figure>
  </div>`;
}
function tables() {
  const list = D.tables.filter((t) =>
    match(`${t.id} ${t.section} ${t.subsection} ${t.caption} ${t.case} ${(t.rows[0] || []).join(' ')}`),
  );
  const t = D.tables.find((x) => x.id === sel) || D.tables[0];
  const name = (x) => x.caption || x.subsection || x.section;
  const head = t.rows[0] || [],
    body = t.rows.slice(1);
  const width = Math.max(head.length, ...body.map((r) => r.length));
  const pad = (r) => r.concat(new Array(Math.max(0, width - r.length)).fill(''));
  const i = list.findIndex((x) => x.id === t.id);
  const opt = (x) =>
    `<option value="${esc(x.id)}"${x.id === t.id ? ' selected' : ''}>${esc(x.id)} · ${x.env === 'csv' ? 'QWM csv' : `§${esc(x.sec || '?')} p.${esc(x.page ?? '?')}`} · ${esc(name(x).slice(0, 70))} (${Math.max(0, x.rows.length - 1)} rows${x.case ? ' · ' + esc(x.case) : ''})</option>`;
  return `<div class="data-tables"><div class="dpick"><label for="data-tsel">Table</label><select id="data-tsel">${(list.some((x) => x.id === t.id) ? list : [t, ...list]).map(opt).join('')}</select><button class="btn sm icon" data-t="${esc((list[i - 1] || list[list.length - 1] || t).id)}" aria-label="Previous table" title="Previous table">${icon('chevron-left')}</button><button class="btn sm icon" data-t="${esc((list[i + 1] || list[0] || t).id)}" aria-label="Next table" title="Next table">${icon('chevron-right')}</button><small class="muted">${list.length} of ${D.tables.length} tables match the filter</small></div><div class="dmain"><h4>${esc(t.id)} · ${esc(name(t))}</h4><p class="small muted">${t.env === 'csv' ? esc(t.page_basis) : `PDF 7 §${esc(t.sec || '?')} ${esc(t.section)}${t.subsection ? ' › ' + esc(t.subsection) : ''}${t.case ? ' · case file ' + esc(t.case) : ''}, printed page ${esc(t.page)} (${esc(t.page_basis)}); main.tex line ${esc(t.line)}`}. Cell text is the LaTeX source with markup removed; sort by clicking a header.</p>${sortable('tbl-' + t.id, pad(head.map((h, i) => h || `col ${i + 1}`)), body.map(pad))}</div></div>`;
}
function sources() {
  const types = ranked(countBy(D.docs, (d) => d.type));
  const hosts = ranked(countBy(D.docs, (d) => d.host)).slice(0, 20);
  const caseTypes = ranked(countBy(ctx.cases, (c) => c.source_type || 'unstated')).slice(0, 15);
  const unp = ranked(countBy(U.rows, (r) => r.dataset || r.file));
  return `<div class="cgrid data-sources">
   <figure><figcaption>Part V document links by source type ${src(`${D.docs.length} \\url/\\href links in the G12 case files (main.tex); type by host rule in data/tools/pdf7_dataset.py`)}</figcaption>${hbars(types)}</figure>
   <figure><figcaption>Top hosts cited in Part V ${src('same links, by host')}</figcaption>${hbars(hosts)}</figure>
   <figure><figcaption>Public map rows by source_type ${src('source_type column of the case rows')}</figcaption>${hbars(caseTypes)}</figure>
   <figure><figcaption>Unplaced-but-sourced rows by dataset ${src('data/unplaced.js')}</figcaption>${hbars(unp)}</figure>
   <figure class="wide"><figcaption>All Part V document links ${src('main.tex')}</figcaption>${sortable(
     'docs',
     ['Case path', 'Type', 'Host', 'URL'],
     D.docs.filter((d) => match(`${d.path} ${d.host} ${d.type}`)).map((d) => [d.path, d.type, d.host, d.url]),
     { html: (r, ci, c) => (ci === 3 ? link(c, c.length > 70 ? c.slice(0, 70) + '…' : c) : esc(c)) },
   )}</figure></div>`;
}
const pfmt = (p, iters) =>
  p <= 1 / (iters + 1) + 1e-12 ? `≤ ${(1 / (iters + 1)).toFixed(4)}` : p < 0.001 ? p.toExponential(1) : p.toFixed(3);
function statsTab() {
  if (!bat) bat = battery(D, ctx.cases);
  return `<div class="data-corr"><p class="small">Seven pre-set questions, run once on the data as shipped. p-values come from seeded permutations (1,999 shuffles, so the smallest reportable p is 0.0005) or Fisher's exact test, and are shown both raw and Holm-adjusted for the seven tests. <b>Read the caveat column first:</b> most PDF 7 scores are editorial, several pairs are related by construction, and no test here is evidence about the phenomena themselves. These are associations within this dataset, not causes.</p>
  ${sortable(
    'battery',
    ['Test', 'Question', 'Data (columns)', 'n', 'Statistic', 'p', 'p (Holm)', 'Method', 'Caveat'],
    bat.map((t) => [t.id, t.title, t.data, t.n, t.stat, pfmt(t.p, 1999), pfmt(t.pHolm, 1999), t.method, t.caveat]),
  )}</div>`;
}
function unplaced() {
  const rows = U.rows.filter((r) => match(`${r.name} ${r.dataset} ${r.reason} ${r.country || ''} ${r.pdf7_ref || ''}`));
  return `<div class="data-unplaced"><p class="small muted">${U.rows.length} items have a source but no single point (multi-site, region-scale, redacted, in flight, or no geocodable commune), so they are kept here and in the counts, never as a pin. ${U.unsourced.length} further rows have a point but no source URL and are not shown anywhere except this count. NUFORC rows are excluded from the public build.</p>
  <div class="cgrid"><figure><figcaption>By dataset</figcaption>${hbars(ranked(countBy(U.rows, (r) => r.dataset || r.file)))}</figure><figure><figcaption>By reason</figcaption>${hbars(ranked(countBy(U.rows, (r) => (r.reason || '').split(/[:;(]/)[0].slice(0, 60))).slice(0, 12))}</figure></div>
  ${sortable(
    'unplaced',
    ['Name', 'Date', 'Dataset', 'Grade', 'Country', 'Why not on the globe', 'Source', 'PDF 7'],
    rows.map((r) => [
      r.name,
      r.date || '',
      r.dataset || r.file,
      r.grade || '',
      r.country || r.admin1 || r.locality || '',
      r.reason,
      r.source_url || r.source_title || '',
      r.pdf7_ref || '',
    ]),
    { limit: shown, html: (r, ci, c) => (ci === 6 && String(c).startsWith('http') ? link(c, 'source') : esc(c)) },
  )}
  <details><summary>${U.unsourced.length} rows without a source URL (not shown elsewhere)</summary>${sortable(
    'unsourced',
    ['ID', 'Name', 'File', 'Reason'],
    U.unsourced.map((u) => [u.id, u.name, u.file, u.reason]),
  )}</details></div>`;
}
function render() {
  if (dtabs) dtabs.set(tab);
  if (!D) return;
  const out = $('#data-body');
  out.innerHTML = { overview, entries, charts, tables, sources, stats: statsTab, unplaced }[tab]();
  wireSort();
  const tsel = $('#data-tsel');
  if (tsel)
    tsel.onchange = () => {
      sel = tsel.value;
      render();
      $('#data-tsel')?.focus();
    };
  $$('#data-body [data-t]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        sel = a.dataset.t;
        render();
      }),
  );
  $$('#data-body [data-f]').forEach(
    (s) =>
      (s.onchange = () => {
        filt[s.dataset.f] = s.value;
        shown = 200;
        render();
      }),
  );
  $$('#data-body [data-open]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        const c = ctx.cases.find((x) => x.id === a.dataset.open);
        if (c) openDossier(c);
      }),
  );
}
/** open the Data panel on a tab, optionally selecting a PDF 7 table (used by tests and links) */
export function openData(which, table) {
  if (table) sel = table;
  return toggleData(true, which);
}
