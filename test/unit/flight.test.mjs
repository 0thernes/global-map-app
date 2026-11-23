// v1.5 camera flight planning: duration from the hop, easing per hop size, apex height, reduced motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFlight } from '../../src/cesium/flight.js';

test('longer hops take longer, within 0.35 to 3.4 s', () => {
  const a = planFlight({ ang: 0.01, h0: 1e6, h1: 1e6 });
  const b = planFlight({ ang: 0.5, h0: 1e6, h1: 1e6 });
  const c = planFlight({ ang: 3, h0: 1e7, h1: 1e3 });
  assert.ok(a.duration < b.duration && b.duration < c.duration);
  for (const p of [a, b, c]) assert.ok(p.duration >= 0.35 && p.duration <= 3.4);
});
test('easing: short hops ease out; long hops ease in and out', () => {
  assert.equal(planFlight({ ang: 0.01, h0: 5e5, h1: 6e5 }).easing, 'QUADRATIC_OUT');
  assert.equal(planFlight({ ang: 0.3, h0: 5e5, h1: 6e5 }).easing, 'CUBIC_IN_OUT');
  assert.equal(planFlight({ ang: 0.01, h0: 2e7, h1: 1e3 }).easing, 'CUBIC_IN_OUT', 'a deep zoom is not a short hop');
  assert.equal(planFlight({ ang: 1.5, h0: 1e7, h1: 1e7 }).easing, 'QUINTIC_IN_OUT');
});
test('apex height only for long hops, never below either end, capped at 22,000 km', () => {
  assert.equal(planFlight({ ang: 0.2, h0: 1e5, h1: 1e5 }).maxHeight, undefined);
  const p = planFlight({ ang: 1, h0: 2e5, h1: 3e4 });
  assert.ok(p.maxHeight >= 2e5 && p.maxHeight <= 2.2e7);
  assert.equal(planFlight({ ang: 3.1, h0: 3e7, h1: 3e7 }).maxHeight, 2.2e7);
});
test('explicit duration is kept; 0 ms and reduced motion are instant', () => {
  assert.equal(planFlight({ ang: 1, h0: 1e6, h1: 1e6, ms: 1200 }).duration, 1.2);
  assert.equal(planFlight({ ang: 1, h0: 1e6, h1: 1e6, ms: 0 }).duration, 0);
  assert.equal(planFlight({ ang: 1, h0: 1e6, h1: 1e6, reduced: true }).duration, 0);
  assert.equal(planFlight({ ang: NaN, h0: undefined, h1: -5 }).easing, 'QUADRATIC_OUT');
});
