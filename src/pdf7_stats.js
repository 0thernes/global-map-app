// Pure derivations for the Data panel (no DOM): counts, histograms, contingency tests and rank correlations.
// p-values come from seeded permutation (exact for 2x2 via the hypergeometric distribution), so every number
// shown can be re-derived from the shipped data with the same seed.
import { rng, shuffle } from './stats.js';

/** QWM era bins (same labels as wiw/data/map/counts_by_era.csv); years are integers, negative = BCE. */
export const ERAS = [
  ['prehistory (<3000 BCE)', -1e9, -3001],
  ['ancient (3000-500 BCE)', -3000, -501],
  ['classical (500 BCE-500 CE)', -500, 499],
  ['medieval (500-1500)', 500, 1499],
  ['early modern (1500-1899)', 1500, 1899],
  ['1900-1946', 1900, 1946],
  ['1947-1969', 1947, 1969],
  ['1970-1989', 1970, 1989],
  ['1990-2009', 1990, 2009],
  ['2010-2026', 2010, 2026],
];
export function eraOf(y) {
  if (y == null || Number.isNaN(y)) return 'undated';
  const e = ERAS.find(([, lo, hi]) => y >= lo && y <= hi);
  return e ? e[0] : 'undated';
}
export function countBy(arr, f) {
  const m = new Map();
  for (const x of arr) {
    const ks = f(x);
    for (const k of Array.isArray(ks) ? ks : [ks]) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
/** sorted [key, n] pairs, largest first (ties by key) */
export function ranked(m) {
  return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}
export function crosstab(arr, fa, fb) {
  const rows = [...new Set(arr.map(fa))].sort(),
    cols = [...new Set(arr.map(fb))].sort();
  const t = rows.map(() => cols.map(() => 0));
  for (const x of arr) t[rows.indexOf(fa(x))][cols.indexOf(fb(x))]++;
  return { rows, cols, t };
}
/** Pearson chi-square statistic for an r x c table (cells with zero expected are skipped) */
export function chiSquare(t) {
  const R = t.map((r) => r.reduce((a, b) => a + b, 0)),
    C = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0)),
    N = R.reduce((a, b) => a + b, 0);
  let x = 0,
    minE = Infinity;
  for (let i = 0; i < t.length; i++)
    for (let j = 0; j < C.length; j++) {
      const e = (R[i] * C[j]) / N;
      if (!e) continue;
      minE = Math.min(minE, e);
      x += (t[i][j] - e) ** 2 / e;
    }
  const k = Math.min(t.length, C.length);
  return {
    x2: x,
    df: (t.length - 1) * (C.length - 1),
    n: N,
    minExpected: minE,
    cramerV: k > 1 ? Math.sqrt(x / (N * (k - 1))) : 0,
  };
}
/** Independence test by permuting one label column (Monte Carlo; p = (b+1)/(iters+1)) */
export function chiSquarePerm(a, b, { iters = 1999, seed = 7 } = {}) {
  const tab = (bb) => {
    const rows = [...new Set(a)].sort(),
      cols = [...new Set(b)].sort();
    const t = rows.map(() => cols.map(() => 0));
    a.forEach((x, i) => t[rows.indexOf(x)][cols.indexOf(bb[i])]++);
    return t;
  };
  const obs = chiSquare(tab(b));
  const r = rng(seed);
  let ge = 0;
  for (let k = 0; k < iters; k++) {
    const bb = shuffle(b, r);
    if (chiSquare(tab(bb)).x2 >= obs.x2 - 1e-12) ge++;
  }
  return {
    ...obs,
    p: (ge + 1) / (iters + 1),
    iters,
    method: `chi-square, permutation p (${iters} shuffles, seed ${seed})`,
  };
}
function lfact(n) {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
/** Fisher exact test, two-sided (sum of tables no more likely than the observed one) for [[a,b],[c,d]] */
export function fisher2x2([[a, b], [c, d]]) {
  const r1 = a + b,
    r2 = c + d,
    c1 = a + c,
    n = r1 + r2;
  const lp = (x) =>
    lfact(r1) +
    lfact(r2) +
    lfact(c1) +
    lfact(n - c1) -
    lfact(n) -
    lfact(x) -
    lfact(r1 - x) -
    lfact(c1 - x) -
    lfact(r2 - c1 + x);
  const p0 = lp(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const q = lp(x);
    if (q <= p0 + 1e-9) p += Math.exp(q);
  }
  const or = b * c ? (a * d) / (b * c) : Infinity;
  return { p: Math.min(1, p), oddsRatio: or, n, method: 'Fisher exact, two-sided' };
}
export function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(x, y) {
  const n = x.length,
    mx = x.reduce((a, b) => a + b, 0) / n,
    my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sx = 0,
    sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return sx && sy ? sxy / Math.sqrt(sx * sy) : 0;
}
/** Spearman rank correlation with a two-sided permutation p-value */
export function spearman(x, y, { iters = 1999, seed = 11 } = {}) {
  const rx = ranks(x),
    ry = ranks(y),
    rho = pearson(rx, ry);
  const r = rng(seed);
  let ge = 0;
  for (let k = 0; k < iters; k++) {
    const yy = shuffle(ry, r);
    if (Math.abs(pearson(rx, yy)) >= Math.abs(rho) - 1e-12) ge++;
  }
  return {
    rho,
    n: x.length,
    p: (ge + 1) / (iters + 1),
    iters,
    method: `Spearman rho, permutation p (${iters} shuffles, seed ${seed})`,
  };
}
/** Two-sample test on the difference of medians, permutation p (two-sided) */
export function medianDiffPerm(A, B, { iters = 1999, seed = 5 } = {}) {
  const med = (a) => {
    const s = a.slice().sort((p, q) => p - q),
      m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const obs = med(A) - med(B),
    r = rng(seed);
  let all = A.concat(B);
  let ge = 0;
  for (let k = 0; k < iters; k++) {
    all = shuffle(all, r);
    if (Math.abs(med(all.slice(0, A.length)) - med(all.slice(A.length))) >= Math.abs(obs) - 1e-12) ge++;
  }
  return {
    medA: med(A),
    medB: med(B),
    diff: obs,
    nA: A.length,
    nB: B.length,
    p: (ge + 1) / (iters + 1),
    iters,
    method: `difference of medians, permutation p (${iters} shuffles, seed ${seed})`,
  };
}
/** Holm step-down adjustment; returns adjusted p-values in the input order */
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(ps.length);
  let run = 0;
  o.forEach(([p, i], k) => {
    run = Math.max(run, Math.min(1, p * (ps.length - k)));
    adj[i] = run;
  });
  return adj;
}
export function histogram(values, edges) {
  const h = new Array(edges.length - 1).fill(0);
  for (const v of values) {
    if (v == null) continue;
    for (let i = 0; i < edges.length - 1; i++)
      if (v >= edges[i] && (v < edges[i + 1] || (i === edges.length - 2 && v === edges[i + 1]))) {
        h[i]++;
        break;
      }
  }
  return h;
}
/** numeric-aware comparator for table sorting: numbers (incl. '1,234', '+23.8', '12 %') before text, blanks last */
export function cellKey(s) {
  const t = String(s ?? '').trim();
  if (!t || t === '–' || t === '—' || t === '-') return [2, ''];
  const m = t.replace(/[,\s]/g, '').match(/^[+-]?\d+(\.\d+)?/);
  return m ? [0, parseFloat(m[0])] : [1, t.toLowerCase()];
}
export function sortRows(rows, col, dir = 1) {
  return rows
    .map((r, i) => [cellKey(r[col]), i, r])
    .sort((a, b) => {
      const [ka, kb] = [a[0], b[0]];
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] < kb[1]) return -dir;
      if (ka[1] > kb[1]) return dir;
      return a[1] - b[1];
    })
    .map((x) => x[2]);
}
/** grade class for Part II/V grades: the claim-layer half of 'event / claim' */
export function gradeClass(g) {
  const s = String(g || '').split(' / ');
  return (s[1] || s[0] || '').trim() || 'ungraded';
}

const CSV_I = 'What-Is-What-of-the-What-entries.csv',
  CSV_G = 'What-Is-What-of-the-What-glitches.csv';
/**
 * The cross-layer test battery shown in Data > Stats. D = GM_PDF7_DATA, cases = public map rows.
 * Each test says what data it used, how many rows, the statistic, a raw and a Holm-adjusted p-value, and its caveat.
 */
export function battery(D, cases, opt = {}) {
  const it = opt.iters || 1999;
  const E = D.entries,
    P1 = E.filter((e) => e.part === 'I'),
    P2 = E.filter((e) => e.part === 'II'),
    P5 = E.filter((e) => e.part === 'V');
  const T = [];
  {
    const g = P2.map((e) => gradeClass(e.grade)),
      f = P2.map((e) => (e.fringe ? 'FRINGE (G11)' : 'G1-G10'));
    const r = chiSquarePerm(g, f, { iters: it, seed: 7 });
    T.push({
      id: 'B1',
      title: 'Part II: evidence grade vs FRINGE domain',
      data: `${CSV_G}: evidence_grade (claim layer), domain; G1-G11 rows`,
      n: r.n,
      stat: `χ² = ${r.x2.toFixed(1)}, df ${r.df}, Cramér's V ${r.cramerV.toFixed(2)}`,
      p: r.p,
      method: r.method,
      caveat:
        'FRINGE is an editorial domain, and grades were assigned by the same editor, so association is expected by construction. Smallest expected cell ' +
        r.minExpected.toFixed(1) +
        ' (permutation p does not rely on the chi-square approximation).',
    });
  }
  {
    const s = P2.filter((e) => e.reality != null && e.radical != null);
    const r = spearman(
      s.map((e) => e.reality),
      s.map((e) => e.radical),
      { iters: it, seed: 11 },
    );
    T.push({
      id: 'B2',
      title: 'Part II: reality score vs radicalness',
      data: `${CSV_G}: reality_0_5, radicalness`,
      n: r.n,
      stat: `ρ = ${r.rho.toFixed(2)}`,
      p: r.p,
      method: r.method,
      caveat:
        'Both are editorial scores on short ordinal scales with many ties; rho describes the scoring, not the world.',
    });
  }
  {
    const s = P2.concat(P5).filter((e) => e.tw != null && e.reality != null);
    const r = spearman(
      s.map((e) => e.tw),
      s.map((e) => e.reality),
      { iters: it, seed: 13 },
    );
    T.push({
      id: 'B3',
      title: 'Parts II+V: testimony weight vs reality score',
      data: `${CSV_G}: testimony_weight, reality_0_5 (G1-G12)`,
      n: r.n,
      stat: `ρ = ${r.rho.toFixed(2)}`,
      p: r.p,
      method: r.method,
      caveat:
        "Partly circular: under Alex's rule, credible insider testimony can raise the reality score, so a positive rho is built into the method.",
    });
  }
  {
    const r = chiSquarePerm(
      P1.map((e) => e.testable),
      P1.map((e) => e.tier),
      { iters: it, seed: 17 },
    );
    T.push({
      id: 'B4',
      title: 'Part I: testability vs tier',
      data: `${CSV_I}: testable, tier`,
      n: r.n,
      stat: `χ² = ${r.x2.toFixed(1)}, df ${r.df}, Cramér's V ${r.cramerV.toFixed(2)}`,
      p: r.p,
      method: r.method,
      caveat:
        "Tier definitions mention testability ('Established' requires evidence), so the two labels are not independent measurements.",
    });
  }
  {
    const s = P1.filter((e) => e.year != null && e.composite != null);
    const r = spearman(
      s.map((e) => e.year),
      s.map((e) => e.composite),
      { iters: it, seed: 19 },
    );
    T.push({
      id: 'B5',
      title: 'Part I: origin year vs composite score',
      data: `${CSV_I}: year, composite`,
      n: r.n,
      stat: `ρ = ${r.rho.toFixed(2)}`,
      p: r.p,
      method: r.method,
      caveat:
        'Older ideas have had longer to be tested or discarded (survivorship); the year is the first source, not the idea’s real age.',
    });
  }
  {
    const placed = (e) => ['add', 'link', 'merge'].includes(e.place) || String(e.place).startsWith('merge');
    const cit = (e) => /Insider|CIT/i.test(gradeClass(e.grade));
    const t = [
      [P5.filter((e) => placed(e) && cit(e)).length, P5.filter((e) => placed(e) && !cit(e)).length],
      [P5.filter((e) => !placed(e) && cit(e)).length, P5.filter((e) => !placed(e) && !cit(e)).length],
    ];
    const r = fisher2x2(t);
    T.push({
      id: 'B6',
      title: 'Part V: on the globe vs CIT-graded claim',
      data: `${CSV_G} G12 rows: evidence_grade; placement from data/sources/pdf7/status.csv`,
      n: r.n,
      stat: `table [[${t[0]}],[${t[1]}]] (placed/unplaced × CIT/other), odds ratio ${Number.isFinite(r.oddsRatio) ? r.oddsRatio.toFixed(2) : '∞'}`,
      p: r.p,
      method: r.method,
      caveat:
        'Placement depends on whether a case names one point, which is unrelated to evidence by design; a small p would flag a selection effect in the map, not a fact about UAP.',
    });
  }
  {
    const pub = cases.filter(
      (c) =>
        c.nearest_nuclear_site_km != null &&
        c.nearest_nuclear_site_km !== '' &&
        !Number.isNaN(+c.nearest_nuclear_site_km),
    );
    const A = pub.filter((c) => c.pdf7_ref).map((c) => +c.nearest_nuclear_site_km),
      B = pub.filter((c) => !c.pdf7_ref).map((c) => +c.nearest_nuclear_site_km);
    if (A.length >= 5 && B.length >= 5) {
      const r = medianDiffPerm(A, B, { iters: it, seed: 23 });
      T.push({
        id: 'B7',
        title: 'Cross-layer: distance to nearest nuclear site, PDF 7 cases vs other public cases',
        data: 'public map rows: nearest_nuclear_site_km (QWM, Wikidata + test areas), pdf7_ref',
        n: r.nA + r.nB,
        stat: `median ${r.medA.toFixed(0)} km (PDF 7, n=${r.nA}) vs ${r.medB.toFixed(0)} km (other, n=${r.nB})`,
        p: r.p,
        method: r.method,
        caveat:
          'PDF 7 picks notable cases, and its G12.10 cluster is chosen for nuclear proximity, so the PDF 7 group is not a random sample. Distances come from QWM rows only; PDF 7 rows added in v1.1 have no distance yet.',
      });
    }
  }
  const adj = holm(T.map((t) => t.p));
  T.forEach((t, i) => (t.pHolm = adj[i]));
  return T;
}
