// v1.5 globe reference geometry: adaptive graticule, terminator and twilight rings, dashed uncertainty rings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  graticuleStep,
  graticuleLines,
  graticuleLabel,
  smallCircle,
  angDeg,
  terminatorRings,
  dashedRing,
  wrapLon,
  R_KM,
} from '../../src/cesium/graticule.js';
import { subsolar } from '../../src/sun.js';

test('graticule spacing gets finer as the camera descends and never increases', () => {
  const hs = [3e7, 1e7, 5e6, 2e6, 8e5, 3e5, 1e5, 3e4, 5e3, 0];
  const steps = hs.map(graticuleStep);
  assert.equal(steps[0], 30);
  assert.equal(steps.at(-2), 0.25);
  for (let i = 1; i < hs.length - 1; i++) assert.ok(steps[i] <= steps[i - 1], `step at ${hs[i]}`);
  assert.equal(graticuleStep(NaN), 30);
});
test('whole-globe 30 deg graticule: 12 meridians, 5 parallels, equator and Greenwich are major', () => {
  const L = graticuleLines(30);
  const mer = L.filter((l) => l.kind === 'meridian');
  const par = L.filter((l) => l.kind === 'parallel');
  assert.equal(mer.length, 12);
  assert.deepEqual(
    par.map((p) => p.value),
    [-60, -30, 0, 30, 60],
  );
  assert.deepEqual(
    L.filter((l) => l.major).map((l) => `${l.kind}:${l.value}`),
    ['meridian:-180', 'meridian:0', 'parallel:0'],
  );
  for (const l of L) for (const [la, lo] of l.pts) assert.ok(Math.abs(la) <= 90 && lo >= -180 && lo < 180.0001);
  // a parallel closes the ring (first and last longitudes meet)
  const eq = par.find((p) => p.value === 0);
  assert.equal(eq.pts[0][1], -180);
  assert.equal(Math.abs(eq.pts.at(-1)[1]), 180);
});
test('a view box limits the lines, also across the antimeridian', () => {
  const L = graticuleLines(5, { west: 170, east: -170, south: 10, north: 20 });
  const mer = L.filter((l) => l.kind === 'meridian').map((l) => l.value);
  assert.deepEqual(mer, [170, 175, -180, -175, -170]);
  const par = L.filter((l) => l.kind === 'parallel').map((l) => l.value);
  assert.deepEqual(par, [10, 15, 20]);
  assert.ok(graticuleLines(0.25, { west: -180, east: 180, south: -90, north: 90 }).length <= 800, 'capped');
});
test('labels', () => {
  assert.equal(graticuleLabel('parallel', 30), '30°N');
  assert.equal(graticuleLabel('parallel', -15), '15°S');
  assert.equal(graticuleLabel('meridian', -45), '45°W');
  assert.equal(graticuleLabel('meridian', 0.5), '0.5°E');
  assert.equal(graticuleLabel('meridian', 180), '180°');
  assert.equal(graticuleLabel('parallel', 0), '0° (Equator)');
  assert.equal(wrapLon(190), -170);
  assert.equal(wrapLon(-180), -180);
});
test('small circles keep their angular radius everywhere, including near a pole', () => {
  for (const [la, lo, d] of [
    [0, 0, 90],
    [51.5, -0.1, 0.2],
    [-89, 120, 10],
    [23.4, 179.9, 96],
  ]) {
    const ring = smallCircle(la, lo, d, 64);
    assert.equal(ring.length, 65);
    assert.deepEqual(ring[0], ring[64]);
    for (const p of ring) assert.ok(Math.abs(angDeg([la, lo], p) - d) < 1e-6, `${la},${lo},${d}`);
  }
});
test('terminator: 90 deg from the sub-solar point; twilight rings at 96, 102 and 108 deg', () => {
  const sub = subsolar(new Date('2026-06-21T12:00:00Z'));
  assert.ok(Math.abs(sub.lat - 23.44) < 0.05, 'June solstice declination');
  const R = terminatorRings(sub, 90);
  assert.deepEqual(
    R.map((r) => r.deg),
    [90, 96, 102, 108],
  );
  for (const r of R) for (const p of r.pts) assert.ok(Math.abs(angDeg([sub.lat, sub.lon], p) - r.deg) < 1e-6);
  // at the June solstice the terminator reaches 66.56 deg (the polar circles)
  const maxLat = Math.max(...R[0].pts.map((p) => p[0]));
  assert.ok(Math.abs(maxLat - (90 - sub.lat)) < 0.2);
});
test('dashed uncertainty ring: half the chords of an n-gon at the stated radius', () => {
  const segs = dashedRing(48.85, 2.35, 25, 48);
  assert.equal(segs.length, 24);
  const deg = (25 / R_KM) * (180 / Math.PI);
  for (const [a, b] of segs) {
    assert.ok(Math.abs(angDeg([48.85, 2.35], a) - deg) < 1e-9);
    assert.ok(Math.abs(angDeg([48.85, 2.35], b) - deg) < 1e-9);
  }
});
test('reference lines are lifted by their chord sag so the ellipsoid never hides a segment', async () => {
  const { sagH, ecefH } = await import('../../src/cesium/reference.js');
  assert.equal(sagH(0.01), 20, 'floor');
  // a 2 deg chord sags ~0.97 km below the surface: lifted by 1.4x
  assert.ok(Math.abs(sagH(2) - 0.9707e3 * 1.4) < 15);
  const o = new Float64Array(3);
  ecefH(0, 0, 100, o, 0);
  assert.ok(Math.abs(o[0] - 6378237) < 1e-6 && Math.abs(o[1]) < 1e-6 && Math.abs(o[2]) < 1e-6);
  ecefH(90, 0, 0, o, 0);
  assert.ok(Math.abs(o[2] - 6356752.314) < 0.01, 'polar radius');
});
