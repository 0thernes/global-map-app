// Calendar + timeline-scale tests for src/geo.js (proleptic Gregorian, negative years, nonlinear slider).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../src/geo.js';

test('day 0 is 1900-01-01', () => {
  assert.equal(G.dayToISO(0), '1900-01-01');
  assert.equal(G.dateToDay('1900-01-01'), 0);
});
test('NDAYS is 2026-11-11', () => assert.equal(G.dayToISO(G.NDAYS), '2026-11-11'));
test('DAYMIN is 8000 BCE (astronomical year -8000)', () => {
  assert.equal(G.civil(G.DAYMIN).y, -8000);
  assert.equal(G.dayLabel(G.DAYMIN), '8001 BCE');
});
test('ISO round-trip across eras', () => {
  for (const iso of ['1947-07-08', '1561-04-14', '0001-01-01', '2000-02-29', '1980-12-26', '2024-12-31']) {
    assert.equal(G.dayToISO(G.dateToDay(iso)), iso);
  }
});
test('negative ISO years parse', () => {
  const d = G.dateToDay('-2560-01-01');
  assert.equal(G.civil(d).y, -2560);
});
test('leap-year rules', () => {
  assert.equal(G.dayOf(2000, 3, 1) - G.dayOf(2000, 2, 28), 2);
  assert.equal(G.dayOf(1900, 3, 1) - G.dayOf(1900, 2, 28), 1);
});
test('civil(day) inverts dayOf for 5,000 random days', () => {
  let s = 1;
  for (let i = 0; i < 5000; i++) {
    s = (s * 16807) % 2147483647;
    const d = G.DAYMIN + (s % (G.NDAYS - G.DAYMIN));
    const c = G.civil(d);
    assert.equal(G.dayOf(c.y, c.m, c.d), d);
  }
});
test('addMonths / addYears', () => {
  assert.equal(G.dayToISO(G.addMonths(G.dateToDay('1999-11-15'), 3)), '2000-02-15');
  assert.equal(G.dayToISO(G.addYears(G.dateToDay('1999-11-15'), -10)), '1989-11-15');
});
test('timeline scale is monotonic and invertible', () => {
  let prev = -Infinity;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const d = G.posToDay(Math.min(p, 1));
    assert.ok(d >= prev);
    prev = d;
    assert.ok(Math.abs(G.dayToPos(d) - Math.min(p, 1)) < 1e-6);
  }
  assert.equal(G.posToDay(0), G.DAYMIN);
});
test('ll2v / v2ll round-trip', () => {
  for (const [lat, lon] of [[0, 0], [51.5, -0.12], [-33.9, 151.2], [89, 179]]) {
    const ll = G.v2ll(G.ll2v(lat, lon));
    assert.ok(Math.abs(ll.lat - lat) < 1e-9 && Math.abs(ll.lon - lon) < 1e-9);
  }
});
