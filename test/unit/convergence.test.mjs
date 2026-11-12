// Convergence scoring on SYNTHETIC records only (nothing here is shipped or plotted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHotspots, makeGrid, tierOf } from '../../src/convergence.js';

const rec = (lat, lon, group, o = {}) => ({ lat, lon, group, ...o });
test('grid: every point maps to a cell whose centre is within one cell', () => {
  const g = makeGrid(100);
  for (const [la, lo] of [
    [0, 0],
    [45, 179.9],
    [-60, -179.9],
    [89.9, 10],
    [-89.9, -10],
  ]) {
    const c = g.center(g.cellOf(la, lo));
    assert.ok(Math.abs(c.lat - la) <= 1);
  }
});
test('grid neighbours wrap across the antimeridian', () => {
  const g = makeGrid(100);
  const a = g.cellOf(0, 179.9),
    b = g.cellOf(0, -179.9);
  assert.ok(g.neighbors(a).includes(b));
});
test('diversity beats volume: 3 layers outrank 30 records of 1 layer', () => {
  const R = [];
  for (let i = 0; i < 30; i++) R.push(rec(10, 10, 'uap', { isCase: true, grade: 'Testimony', prec: 'locality' }));
  R.push(
    rec(-20, 40, 'uap', { isCase: true, grade: 'CIT', prec: 'exact_site' }),
    rec(-20, 40.1, 'nuclear'),
    rec(-20.1, 40, 'military'),
  );
  const h = computeHotspots(R, [], { minLayers: 1, pct: 0 });
  const top = h.cells.sort((a, b) => b.S - a.S)[0];
  assert.equal(top.D, 3);
});
test('population normalisation lowers a city cell', () => {
  const R = [
    rec(1, 1, 'a', { isCase: true, grade: 'CIT' }),
    rec(1, 1, 'b'),
    rec(30, 30, 'a', { isCase: true, grade: 'CIT' }),
    rec(30, 30, 'b'),
  ];
  const h = computeHotspots(R, [{ lat: 1, lon: 1, pop: 9e6 }], { minLayers: 1, pct: 0 });
  const s = Object.fromEntries(h.cells.map((c) => [Math.round(c.lat), c.S]));
  assert.ok(s[1] < s[30]);
});
test('contiguous hot cells merge into one cluster; minLayers filters', () => {
  const R = [];
  for (const lon of [0, 1, 2]) R.push(rec(0.2, lon, 'x'), rec(0.2, lon, 'y'), rec(0.2, lon, 'z'));
  R.push(rec(50, 50, 'x'));
  const h = computeHotspots(R, [], { cellKm: 100, minLayers: 3, pct: 0 });
  assert.equal(h.clusters.length, 1);
  assert.equal(h.clusters[0].cells.length, 3);
});
test('time window excludes dated records outside it, keeps undated ones', () => {
  const R = [rec(0, 0, 'a', { day: 100 }), rec(0, 0, 'b', { day: 5000 }), rec(0, 0, 'c')];
  const h = computeHotspots(R, [], { minLayers: 1, pct: 0, window: [0, 1000] });
  assert.equal(h.cells[0].D, 2);
});
test('evidence tiers', () => {
  assert.equal(tierOf(0.8)[0], 'A');
  assert.equal(tierOf(0.5)[0], 'C');
  assert.equal(tierOf(0)[0], 'F');
  const strong = [];
  for (let i = 0; i < 5; i++)
    strong.push(rec(0, 0, 'uap', { isCase: true, grade: 'CIT', prec: 'exact_site', src: `https://s${i}.org/x` }));
  strong.push(rec(0, 0, 'nuclear'), rec(0, 0, 'military'));
  const h = computeHotspots(strong, [], { minLayers: 3, pct: 0 });
  assert.equal(h.clusters[0].tier, 'A');
});

test('zero-weight rows (Greer/Maussan rule) add no score', async () => {
  const { computeHotspots } = await import('../../src/convergence.js');
  const base = [
    { lat: 10, lon: 10, group: 'UAP', isCase: true, grade: 'CIT', prec: 'exact_site' },
    { lat: 10.1, lon: 10.1, group: 'Military' },
  ];
  const a = computeHotspots(base, [], { cellKm: 200, minLayers: 1, pct: 0 });
  const b = computeHotspots(
    [...base, { lat: 10, lon: 10, group: 'UAP', isCase: true, grade: 'CIT', prec: 'exact_site', zero: true }],
    [],
    { cellKm: 200, minLayers: 1, pct: 0 },
  );
  assert.equal(a.clusters[0].score.toFixed(6), b.clusters[0].score.toFixed(6));
});
test('a zero-weight row alone does not add a layer (D)', () => {
  const r = computeHotspots(
    [
      { lat: 0, lon: 0, group: 'Military' },
      { lat: 0, lon: 0, group: 'UAP', isCase: true, grade: 'CIT', zero: true },
    ],
    [],
    { cellKm: 200, minLayers: 1, pct: 0 },
  );
  assert.equal(r.clusters[0].D, 1);
});
