// Timeline focus + context scale (src/ui/timescale.js), v1.4 polish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, makeScale, zoomWindow, centerWindow, ticks } from '../../src/ui/timescale.js';
import { dayOf, DAYMIN, NDAYS, dayToPos } from '../../src/geo.js';

test('eras are ordered windows inside the data span', () => {
  assert.equal(ERAS[0].w, null);
  for (const e of ERAS.slice(1)) {
    assert.ok(e.w[0] >= DAYMIN && e.w[1] <= NDAYS && e.w[0] < e.w[1], e.id);
    assert.ok(e.label && e.title);
  }
});
test('All time keeps the segmented scale; a window is linear and round-trips', () => {
  const s = makeScale(null);
  assert.equal(s.pos(dayOf(1900)), dayToPos(dayOf(1900)));
  const w = makeScale([dayOf(1947), dayOf(1992)]);
  assert.equal(w.pos(dayOf(1947)), 0);
  assert.equal(w.pos(dayOf(1992)), 1);
  assert.ok(Math.abs(w.day(w.pos(dayOf(1970))) - dayOf(1970)) < 1e-6);
});
test('zoom keeps the day under the cursor and clamps', () => {
  const w = [dayOf(1950), dayOf(2000)];
  const at = dayOf(1980);
  const z = zoomWindow(w, at, 0.5);
  const f0 = (at - w[0]) / (w[1] - w[0]),
    f1 = (at - z[0]) / (z[1] - z[0]);
  assert.ok(Math.abs(f0 - f1) < 0.01);
  assert.ok(z[1] - z[0] < w[1] - w[0]);
  assert.ok(zoomWindow([NDAYS - 40, NDAYS], NDAYS, 0.1)[1] <= NDAYS);
  assert.ok(zoomWindow([NDAYS - 40, NDAYS], NDAYS, 0.1)[1] - zoomWindow([NDAYS - 40, NDAYS], NDAYS, 0.1)[0] >= 30);
  assert.equal(zoomWindow([DAYMIN + 10, NDAYS - 10], dayOf(0), 4), null, 'fully out = All time');
});
test('centre pans without resizing', () => {
  const w = centerWindow([dayOf(1950), dayOf(1960)], dayOf(2025));
  assert.equal(w[1], NDAYS);
  assert.equal(w[1] - w[0], dayOf(1960) - dayOf(1950));
});
test('ticks: years for long windows, months for short ones', () => {
  const t = ticks([dayOf(1947), dayOf(1992)]);
  assert.ok(t.length >= 4 && t.length <= 12);
  assert.ok(t.every((x) => /^\d{4}$/.test(x.label)));
  const m = ticks([dayOf(2020, 1, 1), dayOf(2021, 1, 1)]);
  assert.ok(m.some((x) => /-\d\d$/.test(x.label)));
  const a = ticks([DAYMIN, dayOf(1500)]);
  assert.ok(a.some((x) => /BCE/.test(x.label)));
});
