// Convergence hotspots (pure, no DOM; unit-tested on synthetic data in test/unit/convergence.test.mjs).
// Grid: equal-area-ish cells of about `cellKm` on a side (latitude bands, longitude step widened by 1/cos(lat)).
// Formula (shown in the app tooltip and docs/convergence.md):
//   record weight      w = G(grade) x P(precision)       (reference-layer rows: G = 0.5)
//   layer contribution c_g = ln(1 + sum of w over the layer's records in the cell)
//   diversity          D = number of different layer groups present
//   raw score          R = D x sum_g c_g
//   population factor  F = sqrt(1 + pop_cell / pop_ref)   (pop_cell = GeoNames cities>=15k population in the cell)
//   score              S = R / F       so dense cities are not hotspots just because people live there
// Clusters: 4/8-connected cells with D >= minLayers and S >= the chosen percentile of non-empty cells; components larger
// than maxCells (12) are split at their score peaks (steepest-ascent watershed) so one dense region is not one cluster.
// Evidence grade of a cluster: E = 0.5 x strong + 0.3 x precise + 0.2 x min(1, sources / 5)
//   strong  = share of case records graded CIT or Official record
//   precise = share of case records with exact_site / within_1km coordinates
//   sources = number of distinct source domains/datasets among all records
//   A >= 0.75, B >= 0.6, C >= 0.45, D >= 0.3, E >= 0.15, else F
export const GRADE_W = { CIT: 1.0, 'Official record': 0.8, ST: 0.6, Testimony: 0.3, 'Online claim': 0.1, Other: 0.2 };
export const PREC_W = { exact_site: 1, within_1km: 1, locality: 0.7, region: 0.3, unspecified: 0.2 };
export const REF_W = 0.5;
export const TIERS = [
  ['A', 0.75, '#38e8ff'],
  ['B', 0.6, '#6dff8e'],
  ['C', 0.45, '#ffd23f'],
  ['D', 0.3, '#ff9a3c'],
  ['E', 0.15, '#ff6b6b'],
  ['F', -1, '#7a90a3'],
];
export const FORMULA =
  'S = D x sum_g ln(1 + sum w) / sqrt(1 + pop/pop_ref); w = grade weight (CIT 1, Official 0.8, ST 0.6, TE 0.3, online claim 0.1, other 0.2; reference rows 0.5) x precision weight (exact/1 km 1, locality 0.7, region 0.3, unspecified 0.2); D = number of different layers. Evidence grade E = 0.5 x share CIT/Official + 0.3 x share exact/1 km + 0.2 x min(1, distinct sources / 5): A>=0.75, B>=0.6, C>=0.45, D>=0.3, E>=0.15, else F.';

export function makeGrid(cellKm = 100) {
  const dLat = cellKm / 111.195;
  const rows = Math.ceil(180 / dLat);
  const ncol = [];
  for (let r = 0; r < rows; r++) {
    const latc = -90 + (r + 0.5) * dLat;
    ncol.push(Math.max(1, Math.round((360 * Math.cos((latc * Math.PI) / 180) * 111.195) / cellKm)));
  }
  const cellOf = (lat, lon) => {
    const r = Math.min(rows - 1, Math.max(0, Math.floor((lat + 90) / dLat)));
    const n = ncol[r];
    const c = Math.min(n - 1, Math.max(0, Math.floor(((((lon + 180) % 360) + 360) % 360) / (360 / n))));
    return r * 100000 + c;
  };
  const center = (id) => {
    const r = Math.floor(id / 100000),
      c = id % 100000,
      n = ncol[r];
    return { lat: -90 + (r + 0.5) * dLat, lon: -180 + (c + 0.5) * (360 / n) };
  };
  const neighbors = (id) => {
    const r = Math.floor(id / 100000),
      c = id % 100000,
      n = ncol[r];
    const out = [r * 100000 + ((c + 1) % n), r * 100000 + ((c - 1 + n) % n)];
    const lon0 = -180 + c * (360 / n),
      lon1 = lon0 + 360 / n;
    for (const rr of [r - 1, r + 1]) {
      if (rr < 0 || rr >= rows) continue;
      const m = ncol[rr],
        w = 360 / m;
      const a = Math.floor((lon0 + 180) / w),
        b = Math.floor((lon1 + 180 - 1e-9) / w);
      for (let k = a - 1; k <= b + 1; k++) out.push(rr * 100000 + (((k % m) + m) % m));
    }
    return out;
  };
  return { cellKm, rows, ncol, cellOf, center, neighbors };
}

export const tierOf = (e) => TIERS.find((t) => e >= t[1]);
const domainOf = (u) => {
  const m = /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(String(u || ''));
  return m ? m[1].toLowerCase() : '';
};

/**
 * @param {{lat:number, lon:number, group:string, isCase?:boolean, grade?:string, prec?:string, day?:number, src?:string}[]} records
 * @param {{lat:number, lon:number, pop:number}[]} pop
 * @param {{cellKm?:number, minLayers?:number, pct?:number, window?:[number,number]|null, popRef?:number}} opt
 */
export function computeHotspots(records, pop = [], opt = {}) {
  const grid = makeGrid(opt.cellKm || 100);
  const minLayers = opt.minLayers ?? 3;
  const win = opt.window || null;
  const cells = new Map();
  const cell = (id) => {
    let c = cells.get(id);
    if (!c) cells.set(id, (c = { id, groups: {}, recs: [], pop: 0 }));
    return c;
  };
  for (const r of records) {
    if (!isFinite(r.lat) || !isFinite(r.lon)) continue;
    if (win && r.day != null && isFinite(r.day) && (r.day < win[0] || r.day > win[1])) continue;
    const c = cell(grid.cellOf(r.lat, r.lon));
    const w = r.zero
      ? 0
      : (r.isCase ? (GRADE_W[r.grade] ?? GRADE_W.Other) : REF_W) *
        (PREC_W[r.prec] ?? (r.isCase ? PREC_W.unspecified : 1));
    if (w > 0) c.groups[r.group] = (c.groups[r.group] || 0) + w; // zero-weight rows are listed but never add a layer
    c.recs.push(r);
  }
  for (const p of pop) {
    const c = cells.get(grid.cellOf(p.lat, p.lon));
    if (c) c.pop += p.pop;
  }
  const popRef = opt.popRef || 1e6;
  const list = [];
  for (const c of cells.values()) {
    const g = Object.entries(c.groups);
    c.D = g.length;
    c.contrib = Object.fromEntries(g.map(([k, v]) => [k, Math.log1p(v)]));
    c.R = c.D * Object.values(c.contrib).reduce((a, b) => a + b, 0);
    c.F = Math.sqrt(1 + c.pop / popRef);
    c.S = c.R / c.F;
    Object.assign(c, grid.center(c.id));
    list.push(c);
  }
  const sorted = list.map((c) => c.S).sort((a, b) => a - b);
  const thr = sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((opt.pct ?? 0.9) * sorted.length))]
    : Infinity;
  const hot = new Set(list.filter((c) => c.D >= minLayers && c.S >= thr).map((c) => c.id));
  const seen = new Set();
  const clusters = [];
  for (const id of hot) {
    if (seen.has(id)) continue;
    const q = [id],
      mem = [];
    seen.add(id);
    while (q.length) {
      const x = q.pop();
      mem.push(cells.get(x));
      for (const n of grid.neighbors(x))
        if (hot.has(n) && !seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    }
    // a very large component (dense regions such as western Europe) is split at its score peaks: every cell climbs to
    // its highest-scoring neighbour until it reaches a local maximum, and cells sharing a peak form one cluster
    if (mem.length > (opt.maxCells ?? 12))
      for (const part of splitAtPeaks(mem, grid, cells)) clusters.push(summarize(part));
    else clusters.push(summarize(mem));
  }
  clusters.sort((a, b) => b.score - a.score);
  return { grid, cells: list, clusters, threshold: thr };
}

export function splitAtPeaks(mem, grid, cells) {
  const inC = new Set(mem.map((c) => c.id));
  const peakOf = new Map();
  const climb = (id) => {
    const path = [];
    let x = id;
    while (!peakOf.has(x)) {
      path.push(x);
      let best = x;
      for (const n of grid.neighbors(x)) {
        if (!inC.has(n)) continue;
        const a = cells.get(n).S,
          b = cells.get(best).S;
        if (a > b || (a === b && n < best)) best = n; // ties: strict order on (S, id), so plateaus share one peak
      }
      if (best === x) {
        peakOf.set(x, x);
        break;
      }
      x = best;
    }
    const pk = peakOf.get(x);
    for (const y of path) peakOf.set(y, pk);
    return pk;
  };
  const parts = new Map();
  for (const c of mem) {
    const pk = climb(c.id);
    if (!parts.has(pk)) parts.set(pk, []);
    parts.get(pk).push(c);
  }
  return [...parts.values()];
}
export function summarize(mem) {
  const recs = mem.flatMap((c) => c.recs);
  const groups = {};
  for (const c of mem) for (const [k, v] of Object.entries(c.contrib)) groups[k] = (groups[k] || 0) + v;
  const cases = recs.filter((r) => r.isCase);
  const strong = cases.length
    ? cases.filter((r) => r.grade === 'CIT' || r.grade === 'Official record').length / cases.length
    : 0;
  const precise = cases.length
    ? cases.filter((r) => r.prec === 'exact_site' || r.prec === 'within_1km').length / cases.length
    : 0;
  const sources = new Set(recs.map((r) => r.src && (domainOf(r.src) || r.src)).filter(Boolean)).size;
  const E = 0.5 * strong + 0.3 * precise + 0.2 * Math.min(1, sources / 5);
  const t = tierOf(E);
  const wsum = mem.reduce((a, c) => a + c.S, 0) || 1;
  const days = recs.map((r) => r.day).filter((d) => d != null && isFinite(d));
  return {
    cells: mem.map((c) => c.id),
    lat: mem.reduce((a, c) => a + c.lat * c.S, 0) / wsum,
    lon: mem.reduce((a, c) => a + c.lon * c.S, 0) / wsum,
    score: mem.reduce((a, c) => a + c.S, 0),
    D: Object.keys(groups).length,
    groups,
    n: recs.length,
    nCases: cases.length,
    strong,
    precise,
    sources,
    E,
    tier: t[0],
    tierColor: t[2],
    first: days.length ? days.reduce((a, b) => (b < a ? b : a)) : null,
    last: days.length ? days.reduce((a, b) => (b > a ? b : a)) : null,
    recs,
  };
}
