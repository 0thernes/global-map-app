// Timeline focus + context (v1.4 polish). Pure: no DOM; unit-tested in test/unit/timescale.test.mjs.
// The overview strip always shows the whole 8000 BCE -> today span on the segmented scale (src/geo.js); the detail
// track shows a focus window. 'All time' keeps the segmented scale; every other window is linear in days.
import { dayOf, civil, posToDay, dayToPos, DAYMIN, NDAYS } from '../geo.js';

export const ERAS = [
  { id: 'all', label: 'All time', title: '8000 BCE to the end of the timeline, on the segmented scale', w: null },
  { id: 'ancient', label: 'Ancient', title: '8000 BCE to 1500 CE', w: [DAYMIN, dayOf(1500)] },
  { id: 'ww', label: '1900–1945', title: '1900 to 1945: the world wars', w: [dayOf(1900), dayOf(1946)] },
  { id: 'cold', label: 'Cold War', title: '1947 to 1991', w: [dayOf(1947), dayOf(1992)] },
  { id: 'modern', label: '1990–now', title: '1990 to the end of the timeline', w: [dayOf(1990), NDAYS] },
  { id: 'recent', label: 'Last 10 y', title: 'The ten years up to the end of the timeline', w: [NDAYS - 3653, NDAYS] },
];
export const eraById = (id) => ERAS.find((e) => e.id === id) || ERAS[0];

/** A scale for the detail track: day <-> 0..1. w = null (segmented, whole span) or [d0, d1] (linear). */
export function makeScale(w) {
  if (!w) return { w: null, pos: dayToPos, day: posToDay, d0: DAYMIN, d1: NDAYS };
  const [d0, d1] = w;
  const span = Math.max(1, d1 - d0);
  return { w, pos: (d) => (d - d0) / span, day: (p) => d0 + p * span, d0, d1 };
}

/** Zoom the window around day `at` by factor k (k < 1 zooms in), clamped to the data span; at least 30 days. */
export function zoomWindow(w, at, k) {
  const [d0, d1] = w || [dayOf(1900), NDAYS];
  let span = Math.min(NDAYS - DAYMIN, Math.max(30, (d1 - d0) * k));
  const f = (at - d0) / Math.max(1, d1 - d0);
  let a = at - f * span;
  a = Math.max(DAYMIN, Math.min(NDAYS - span, a));
  if (span >= NDAYS - DAYMIN - 1) return null; // fully zoomed out: back to the segmented whole span
  return [Math.round(a), Math.round(a + span)];
}
/** Pan the window so that `at` sits in the middle (clamped). */
export function centerWindow(w, at) {
  if (!w) return null;
  const span = w[1] - w[0];
  const a = Math.max(DAYMIN, Math.min(NDAYS - span, Math.round(at - span / 2)));
  return [a, a + span];
}

const STEPS_Y = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
/** Tick marks for a linear window: years (or months for short windows), about `n` of them. */
export function ticks(w, n = 10) {
  const [d0, d1] = w;
  const years = (d1 - d0) / 365.25;
  const out = [];
  if (years < 3) {
    const mStep = years < 0.6 ? 1 : years < 1.5 ? 2 : 3;
    const c = civil(d0);
    let y = c.y,
      m = Math.ceil(c.m / mStep) * mStep;
    for (let i = 0; i < 60; i++) {
      if (m > 12) {
        y++;
        m -= 12;
      }
      const d = dayOf(y, m, 1);
      if (d > d1) break;
      if (d >= d0) out.push({ d, label: m === 1 ? String(y) : `${y}-${String(m).padStart(2, '0')}`, major: m === 1 });
      m += mStep;
    }
    return out;
  }
  const step = STEPS_Y.find((s) => years / s <= n) || 5000;
  const y0 = civil(d0).y,
    y1 = civil(d1).y;
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const d = dayOf(y);
    if (d >= d0 && d <= d1) out.push({ d, label: y <= 0 ? `${1 - y} BCE` : String(y), major: y % (step * 5) === 0 });
  }
  return out;
}
