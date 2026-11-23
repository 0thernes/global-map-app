// Camera flight planning (v1.5, ADR 0005 section 3). Pure, unit-tested in test/unit/flight.test.mjs.
// A fly-to gets a duration from how far it travels (great-circle angle and the change of altitude on a log scale),
// an easing that fits the hop (short hops ease out, long ones ease in and out) and, for long hops, an apex height so
// the camera rises far enough to keep context instead of skimming the surface. Reduced motion makes every flight 0 s.
export const R_EARTH_M = 6371008.8;

/**
 * @param {object} p
 * @param {number} p.ang   great-circle angle between start and target, radians
 * @param {number} p.h0    start height, metres
 * @param {number} p.h1    target height, metres
 * @param {number} [p.ms]  caller's explicit duration in ms (kept, but capped and still 0 under reduced motion)
 * @param {boolean} [p.reduced]
 * @returns {{duration: number, easing: string, maxHeight: number|undefined}} duration in seconds; easing is a
 *   Cesium.EasingFunction key
 */
export function planFlight({ ang, h0, h1, ms, reduced = false }) {
  const a = Math.max(0, Math.min(Math.PI, +ang || 0));
  const hh0 = Math.max(30, +h0 || 30),
    hh1 = Math.max(30, +h1 || 30);
  const dz = Math.abs(Math.log10(hh1 / hh0));
  let duration = ms != null ? ms / 1000 : 0.7 + 1.1 * Math.sqrt(a) + 0.32 * dz;
  duration = Math.max(0.35, Math.min(3.4, duration));
  if (reduced || ms === 0) duration = 0;
  const easing = a > 0.6 ? 'QUINTIC_IN_OUT' : a > 0.08 || dz > 1.2 ? 'CUBIC_IN_OUT' : 'QUADRATIC_OUT';
  // apex: rise to about a third of the arc length (as a chord seen from above) for hops over ~20 deg
  let maxHeight;
  if (a > 0.35) maxHeight = Math.min(2.2e7, Math.max(hh0, hh1, a * R_EARTH_M * 0.55));
  return { duration, easing, maxHeight };
}
