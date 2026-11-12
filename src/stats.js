// Pure statistics / geometry helpers. No DOM, no three.js: unit-tested in test/stats.test.mjs.
export const R_EARTH = 6371.0088; // km (IUGG mean radius)
const D2R = Math.PI / 180;

export function haversine(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dp = p2 - p1, dl = (lon2 - lon1) * D2R;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
// distance from point to great-circle segment (km) using a local azimuthal-equidistant-like projection around the point
// (accurate to <1% for segments shorter than a few hundred km, which holds for simplified fault/river vertices)
export function pointSegmentKm(lat, lon, la1, lo1, la2, lo2) {
  const k = Math.cos(lat * D2R);
  const wrap = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  const ax = wrap(lo1 - lon) * k * D2R * R_EARTH, ay = (la1 - lat) * D2R * R_EARTH;
  const bx = wrap(lo2 - lon) * k * D2R * R_EARTH, by = (la2 - lat) * D2R * R_EARTH;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L > 0 ? -(ax * dx + ay * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, py = ay + t * dy;
  const flat = Math.hypot(px, py);
  if (flat < 300) return flat;
  // far away: fall back to haversine to the nearest endpoint / projected point
  const plat = la1 + t * (la2 - la1), plon = lo1 + t * wrap(lo2 - lo1);
  return haversine(lat, lon, plat, plon);
}

// Seeded PRNG (mulberry32) so baselines are reproducible; the seed is shown in the UI.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spatial grid index over points [{lat,lon,...}] or segments, cell size in degrees.
export class GeoIndex {
  constructor(cell = 2) { this.cell = cell; this.map = new Map(); this.n = 0; }
  key(i, j) { return i * 100000 + j; }
  cellOf(lat, lon) { return [Math.floor((lat + 90) / this.cell), Math.floor((((lon + 180) % 360) + 360) % 360 / this.cell)]; }
  addPoint(lat, lon, ref) { const [i, j] = this.cellOf(lat, lon); this._push(i, j, { t: 0, lat, lon, ref }); }
  addSegment(la1, lo1, la2, lo2, ref) {
    const [i1, j1] = this.cellOf(la1, lo1), [i2, j2] = this.cellOf(la2, lo2);
    const it = { t: 1, la1, lo1, la2, lo2, ref };
    const ncol = Math.round(360 / this.cell);
    let jA = j1, jB = j2; if (Math.abs(jB - jA) > ncol / 2) { jA = j1; jB = j1; } // antimeridian crossing: register at first cell
    for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++)
      for (let j = Math.min(jA, jB); j <= Math.max(jA, jB); j++) this._push(i, j, it);
  }
  _push(i, j, it) { const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(it); this.n++; }
  // nearest item: expands rings of cells until the ring's minimum possible distance exceeds the best found
  nearest(lat, lon, maxKm = 20038, filter = null) {
    if (!this.n) return null;
    const [ci, cj] = this.cellOf(lat, lon); const nrow = Math.round(180 / this.cell), ncol = Math.round(360 / this.cell);
    let best = null, bestD = Infinity; const seen = new Set();
    const kmPerCellLat = this.cell * 111.195;
    for (let r = 0; r <= Math.max(nrow, ncol / 2); r++) {
      const ringMin = Math.max(0, (r - 1) * kmPerCellLat * Math.max(0.05, Math.cos(Math.min(89, Math.abs(lat) + r * this.cell) * D2R)));
      if (ringMin > bestD || ringMin > maxKm) break;
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || i >= nrow) continue;
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          const jj = ((j % ncol) + ncol) % ncol; const a = this.map.get(this.key(i, jj)); if (!a) continue;
          for (const it of a) {
            if (seen.has(it)) continue; seen.add(it);
            if (filter && !filter(it.ref)) continue;
            const d = it.t === 0 ? haversine(lat, lon, it.lat, it.lon) : pointSegmentKm(lat, lon, it.la1, it.lo1, it.la2, it.lo2);
            if (d < bestD) { bestD = d; best = it; }
          }
        }
      }
      // polar / wide rows: if very high latitude, a full row scan is cheap enough; continue loop
    }
    return best ? { d: bestD, ref: best.ref } : null;
  }
}

export function median(a) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
export function quantile(a, q) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); }
export function fracWithin(a, km) { return a.length ? a.filter((d) => d <= km).length / a.length : NaN; }

// Monte Carlo test: is the observed statistic (median nearest distance) smaller than for n points drawn from the baseline?
// baselineDraw(rand) -> distance of one baseline point. Returns p (one-sided, "observed is closer"), baseline distribution of stats.
export function monteCarloTest(observed, baselineDraw, { iters = 999, seed = 42, stat = median } = {}) {
  const rand = rng(seed); const n = observed.length; const sObs = stat(observed);
  const stats = []; let le = 0; const pooled = [];
  for (let k = 0; k < iters; k++) {
    const s = []; for (let i = 0; i < n; i++) { const d = baselineDraw(rand); s.push(d); if (k < 20) pooled.push(d); }
    const v = stat(s); stats.push(v); if (v <= sObs) le++;
  }
  const p = (le + 1) / (iters + 1);
  const bMed = median(stats);
  return { n, observedStat: sObs, baselineStat: bMed, ratio: sObs / bMed, p, iters, seed, baselineStats: stats, baselineSample: pooled };
}
// bootstrap percentile CI of a statistic
export function bootstrapCI(a, { iters = 1000, seed = 7, stat = median, alpha = 0.05 } = {}) {
  if (a.length < 2) return [NaN, NaN];
  const rand = rng(seed); const v = [];
  for (let k = 0; k < iters; k++) { const s = []; for (let i = 0; i < a.length; i++) s.push(a[Math.floor(rand() * a.length)]); v.push(stat(s)); }
  return [quantile(v, alpha / 2), quantile(v, 1 - alpha / 2)];
}
// Wilson score interval for a proportion
export function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - w) / d, (c + w) / d];
}
// two-sample permutation test on medians (labels shuffled); one-sided: A smaller than B
export function permutationTest(A, B, { iters = 999, seed = 11, stat = median } = {}) {
  const rand = rng(seed); const obs = stat(A) - stat(B); const all = [...A, ...B]; let le = 0;
  for (let k = 0; k < iters; k++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const d = stat(all.slice(0, A.length)) - stat(all.slice(A.length)); if (d <= obs) le++;
  }
  return { diff: obs, p: (le + 1) / (iters + 1), iters, seed };
}
// histogram with shared bins
export function histogram(values, edges) {
  const h = new Array(edges.length - 1).fill(0);
  for (const v of values) { for (let i = 0; i < edges.length - 1; i++) if (v >= edges[i] && (v < edges[i + 1] || (i === edges.length - 2 && v <= edges[i + 1]))) { h[i]++; break; } }
  return h;
}
// DBSCAN on the sphere (haversine), O(n^2) - fine for thousands of points
export function dbscan(points, epsKm, minPts) {
  const n = points.length, label = new Array(n).fill(undefined); let c = 0;
  const neigh = (i) => { const r = []; for (let j = 0; j < n; j++) if (haversine(points[i].lat, points[i].lon, points[j].lat, points[j].lon) <= epsKm) r.push(j); return r; };
  for (let i = 0; i < n; i++) {
    if (label[i] !== undefined) continue;
    const N = neigh(i); if (N.length < minPts) { label[i] = -1; continue; }
    label[i] = c; const S = N.filter((j) => j !== i);
    for (let k = 0; k < S.length; k++) {
      const j = S[k]; if (label[j] === -1) label[j] = c; if (label[j] !== undefined) continue;
      label[j] = c; const N2 = neigh(j); if (N2.length >= minPts) for (const q of N2) if (!S.includes(q)) S.push(q);
    }
    c++;
  }
  return { labels: label, clusters: c };
}
// kernel density on an equirectangular grid using a spherical Gaussian kernel (sigma in km); weights optional
export function kdeGrid(points, sigmaKm, W = 360, H = 180, weights = null) {
  const g = new Float32Array(W * H); const sigRad = sigmaKm / R_EARTH; const cut = 3 * sigRad; const cutDeg = cut / D2R;
  for (let k = 0; k < points.length; k++) {
    const p = points[k], w = weights ? weights[k] : 1; const pl = p.lat * D2R, po = p.lon * D2R; const sp = Math.sin(pl), cp = Math.cos(pl);
    const r0 = Math.max(0, Math.floor((90 - p.lat - cutDeg) / 180 * H)), r1 = Math.min(H - 1, Math.ceil((90 - p.lat + cutDeg) / 180 * H));
    for (let r = r0; r <= r1; r++) {
      const lat = 90 - (r + 0.5) * 180 / H; const cl = Math.cos(lat * D2R);
      const span = cl > 0.01 ? Math.min(180, cutDeg / cl) : 180;
      const c0 = Math.floor((p.lon - span + 180) / 360 * W), c1 = Math.ceil((p.lon + span + 180) / 360 * W);
      const sl = Math.sin(lat * D2R);
      for (let cc = c0; cc <= c1; cc++) {
        const col = ((cc % W) + W) % W; const lon = -180 + (col + 0.5) * 360 / W;
        const cosd = sp * sl + cp * cl * Math.cos(lon * D2R - po); const d = Math.acos(Math.max(-1, Math.min(1, cosd)));
        if (d <= cut) g[r * W + col] += w * Math.exp(-(d * d) / (2 * sigRad * sigRad));
      }
    }
  }
  return g;
}
// uniform-on-sphere sampler restricted by a land test (rejection sampling)
export function sampleOnLand(rand, isLand, maxTries = 1000) {
  for (let t = 0; t < maxTries; t++) {
    const lon = rand() * 360 - 180, lat = Math.asin(rand() * 2 - 1) / D2R;
    if (isLand(lat, lon)) return { lat, lon };
  }
  return null;
}
// weighted sampler (alias-free cumulative) over items with weight w
export function weightedSampler(items, weightFn) {
  const cum = []; let s = 0; for (const it of items) { s += Math.max(0, weightFn(it)); cum.push(s); }
  return (rand) => { const x = rand() * s; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return items[lo]; };
}
export function shuffle(a, rand) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
