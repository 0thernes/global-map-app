// Unit tests for src/stats.js on SYNTHETIC data only (never shipped in the app). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/stats.js';
const ok = (c, m) => test(m, () => assert.ok(c, m));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
// haversine: London-Paris ~343.5 km, quarter meridian = 10007.5 km
near(S.haversine(51.5074, -0.1278, 48.8566, 2.3522), 343.5, 2, 'London-Paris');
near(S.haversine(0, 0, 90, 0), Math.PI / 2 * S.R_EARTH, 0.01, 'equator-pole');
near(S.haversine(0, 179.5, 0, -179.5), 111.19, 0.1, 'antimeridian');
// point-segment: point 1 deg north of an equatorial segment -> ~111 km; beyond endpoint -> endpoint distance
near(S.pointSegmentKm(1, 0, 0, -5, 0, 5), 111.19, 0.5, 'perp to segment');
near(S.pointSegmentKm(0, 10, 0, -5, 0, 5), S.haversine(0, 10, 0, 5), 2, 'beyond endpoint');
// GeoIndex nearest == brute force
const r = S.rng(1); const pts = []; for (let i = 0; i < 2000; i++) pts.push({ lat: Math.asin(r() * 2 - 1) * 180 / Math.PI, lon: r() * 360 - 180, i });
const idx = new S.GeoIndex(3); pts.forEach((p) => idx.addPoint(p.lat, p.lon, p));
let agree = 0; for (let k = 0; k < 200; k++) {
  const q = { lat: Math.asin(r() * 2 - 1) * 180 / Math.PI, lon: r() * 360 - 180 };
  let bd = Infinity; for (const p of pts) bd = Math.min(bd, S.haversine(q.lat, q.lon, p.lat, p.lon));
  const n = idx.nearest(q.lat, q.lon); if (Math.abs(n.d - bd) < 1e-6) agree++;
}
ok(agree === 200, 'GeoIndex nearest matches brute force (' + agree + '/200)');
// segment index
const sidx = new S.GeoIndex(2); sidx.addSegment(10, 10, 10, 20, 'A'); sidx.addSegment(-30, 100, -32, 104, 'B');
ok(sidx.nearest(11, 15).ref === 'A' && Math.abs(sidx.nearest(11, 15).d - 111.2) < 1, 'segment nearest');
// rng reproducible
ok(S.rng(5)() === S.rng(5)(), 'rng reproducible');
// stats basics
ok(S.median([3, 1, 2]) === 2 && S.median([4, 1, 2, 3]) === 2.5, 'median');
const [lo, hi] = S.wilson(5, 10); ok(lo < 0.5 && hi > 0.5 && lo > 0.2 && hi < 0.8, 'wilson');
ok(JSON.stringify(S.histogram([0, 1, 2, 3, 4], [0, 2, 4, 6])) === '[2,2,1]', 'histogram');
// Monte Carlo: observed points clustered next to a reference point should give small p; uniform points should not
const ref = { lat: 0, lon: 0 };
const dist = (p) => S.haversine(p.lat, p.lon, ref.lat, ref.lon);
const rr = S.rng(3); const land = () => true;
const draw = (rand) => dist(S.sampleOnLand(rand, land));
const clustered = []; for (let i = 0; i < 40; i++) clustered.push(dist({ lat: (rr() - 0.5) * 4, lon: (rr() - 0.5) * 4 }));
const t1 = S.monteCarloTest(clustered, draw, { iters: 499, seed: 9 });
ok(t1.p < 0.01 && t1.ratio < 0.1, 'MC detects clustering p=' + t1.p);
const uniform = []; for (let i = 0; i < 40; i++) uniform.push(draw(rr));
const t2 = S.monteCarloTest(uniform, draw, { iters: 499, seed: 10 });
ok(t2.p > 0.05, 'MC no false positive on uniform p=' + t2.p);
// p-value calibration under the null: about 5% of p < 0.05
let rej = 0; const trials = 200; const cr = S.rng(77);
for (let k = 0; k < trials; k++) { const u = []; for (let i = 0; i < 30; i++) u.push(draw(cr)); if (S.monteCarloTest(u, draw, { iters: 199, seed: 1000 + k }).p < 0.05) rej++; }
ok(rej / trials < 0.10, 'null calibration rejection rate ' + rej / trials);
// permutation test
const A = [1, 2, 3, 2, 1, 2, 3, 1, 2, 2], B = [10, 12, 11, 13, 9, 12, 10, 11, 12, 10];
ok(S.permutationTest(A, B, { iters: 999 }).p < 0.01, 'permutation detects shift');
ok(S.permutationTest(A, A.map((x) => x + 0), { iters: 999 }).p > 0.3, 'permutation null');
// DBSCAN: two well-separated blobs + noise
const P = []; for (let i = 0; i < 10; i++) P.push({ lat: 10 + i * 0.01, lon: 10 }); for (let i = 0; i < 10; i++) P.push({ lat: -20, lon: 50 + i * 0.01 }); P.push({ lat: 60, lon: -100 });
const db = S.dbscan(P, 50, 3); ok(db.clusters === 2 && db.labels[20] === -1, 'dbscan clusters=' + db.clusters);
// KDE peak at the point
const g = S.kdeGrid([{ lat: 0.5, lon: 0.5 }], 200, 360, 180); let mi = 0; for (let i = 1; i < g.length; i++) if (g[i] > g[mi]) mi = i;
ok(Math.floor(mi / 360) === 89 && mi % 360 === 180, 'kde peak location ' + mi);
// weighted sampler respects weights
const ws = S.weightedSampler([{ w: 1, k: 'a' }, { w: 9, k: 'b' }], (x) => x.w); const wr = S.rng(4); let nb = 0; for (let i = 0; i < 10000; i++) if (ws(wr).k === 'b') nb++;
near(nb / 10000, 0.9, 0.02, 'weighted sampler');
const ci = S.bootstrapCI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); ok(ci[0] <= 5.5 && ci[1] >= 5.5, 'bootstrap CI covers median');
