// v1.4 command-bar clocks: UTC first, then US Pacific with the right DST abbreviation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utc, zoned, ageDays, PACIFIC } from '../../src/ui/clock.js';

test('UTC clock', () => {
  const d = new Date(Date.UTC(2026, 10, 19, 3, 21, 5));
  assert.equal(utc(d), '03:21:05Z');
  assert.equal(utc(d, false), '03:21Z');
});
test('Pacific clock: PST in November, PDT in July, date rolls back across midnight UTC', () => {
  const nov = zoned(new Date(Date.UTC(2026, 10, 19, 3, 21, 5)), PACIFIC);
  assert.deepEqual(nov, { time: '19:21:05', zone: 'PST', date: '2026-11-18' });
  const jul = zoned(new Date(Date.UTC(2026, 6, 4, 19, 0, 0)), PACIFIC, false);
  assert.equal(jul.time, '12:00');
  assert.equal(jul.zone, 'PDT');
});
test('data age in days', () => {
  const now = new Date(Date.UTC(2026, 10, 18, 12));
  assert.equal(ageDays('2026-11-12T09:54:54Z', now), 6);
  assert.equal(ageDays('2026-11-19', now), 0);
  assert.equal(ageDays('nope', now), null);
});
