// Canvas-drawn marker icons for Cesium billboards, returned as data URLs. Drawn white so the per-billboard colour tints them.
import { BREAKPOINTS } from '../ui/breakpoints.js';
const S = 64;
const mk = (draw) => {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'), S / 2);
  return c.toDataURL('image/png'); // a string id lets every billboard share one atlas slot
};
let cache = null;
export function shapeIcons() {
  if (cache) return cache;
  cache = [
    // 0: glow marker
    mk((g, h) => {
      const gr = g.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.32, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }),
    // 1: sharp pin (exact_site / within_1km): ring + core + crosshair ticks
    mk((g, h) => {
      g.strokeStyle = '#fff';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(h, h, h * 0.66, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(h, h, h * 0.24, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      for (const [x0, y0, x1, y1] of [
        [h, 0, h, h * 0.3],
        [h, S, h, S - h * 0.3],
        [0, h, h * 0.3, h],
        [S, h, S - h * 0.3, h],
      ]) {
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }),
    // 2: centre of an imprecise row (v1.5): a small hollow diamond, never a pin; the dashed uncertainty circle
    // carries the extent (ADR 0005 section 4)
    mk((g, h) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(h, h * 0.42);
      g.lineTo(h * 1.58, h);
      g.lineTo(h, h * 1.58);
      g.lineTo(h * 0.42, h);
      g.closePath();
      g.stroke();
    }),
    // 3: glitch (weird coordinates): RGB split, drawn in colour (not tinted)
    mk((g, h) => {
      g.globalCompositeOperation = 'lighter';
      for (const [dx, col] of [
        [-7, 'rgba(255,40,60,0.95)'],
        [0, 'rgba(60,255,120,0.9)'],
        [7, 'rgba(60,120,255,0.95)'],
      ]) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(h + dx, h, h * 0.42, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'destination-out';
      for (let y = 0; y < S; y += 8) g.fillRect(0, y, S, 2);
    }),
    // 4..9: case pins with a grade gauge (GRADES order: CIT, Official record, ST, Testimony, Online claim, Other)
    ...GAUGES.map((f, i) => mk((g, h) => gaugePin(g, h, f, i === 0))),
  ];
  return cache;
}
// gauge fractions in GRADES order (src/ui/symbology.js GRADE_GAUGE; test/unit/symbology.test.mjs keeps them equal)
export const GAUGES = [1, 1, 0.75, 0.5, 0.25, 0.25];
/** Pin with a grade gauge: dim full track, bright arc from 12 o'clock for `f` of the ring, core, crosshair ticks. */
function gaugePin(g, h, f, halo) {
  const r = h * 0.62;
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(255,255,255,0.32)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(h, h, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#fff';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(h, h, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
  g.stroke();
  if (halo) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(h, h, h * 0.9, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(h, h, h * 0.22, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  for (const [x0, y0, x1, y1] of [
    [h, 0, h, h * 0.24],
    [h, S, h, S - h * 0.24],
    [0, h, h * 0.24, h],
    [S, h, S - h * 0.24, h],
  ]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
}
export function ringIcon() {
  return mk((g, h) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(h, h, h - 4, 0, Math.PI * 2);
    g.stroke();
  });
}
const badgeCache = new Map();
/**
 * Cluster badge (v1.4): dark disc, count (1.2k style above 999), and a ring split by category share so the
 * badge shows the mix it hides; `mix` = [[colour, count], ...] sorted by count (falls back to one `color` ring).
 */
/** UI scale of the chrome: 1.25 at 4K (DPR 1), as the CSS token ladder (css/console.css, ADR 0004 §13). */
export const uiScale = () => (typeof innerWidth !== 'undefined' && innerWidth >= BREAKPOINTS.uhd ? 1.25 : 1);
/** Cluster badge radius in CSS px: grows with log10(count) so a 2,000-case badge is not 4x a 20-case one (v1.4). */
export const badgeRadius = (n, s = uiScale()) => Math.round((11 + 4.5 * Math.log10(Math.max(1, n))) * s * 10) / 10;
export function clusterBadge(n, color, mix) {
  const segs = mix && mix.length ? mix : [[color || '#5ff', n]];
  const tot = segs.reduce((a, s) => a + s[1], 0) || 1;
  // cache key: count + each colour with its share quantised to 1/24 of the ring
  const S = uiScale();
  const k = S + '|' + n + '|' + segs.map(([c, m]) => c + Math.round((m / tot) * 24)).join(',');
  let c = badgeCache.get(k);
  if (c) return c;
  const rad = badgeRadius(n, S);
  const sz = Math.ceil(rad * 2 + 8) * 2;
  c = document.createElement('canvas');
  c.width = c.height = sz;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const h = sz / 4;
  g.fillStyle = 'rgba(8,14,26,0.88)';
  g.beginPath();
  g.arc(h, h, rad, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3 * S;
  let a0 = -Math.PI / 2;
  for (const [col, m] of segs) {
    const a1 = a0 + (m / tot) * Math.PI * 2;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(h, h, rad - 1.5 * S, a0, a1);
    g.stroke();
    a0 = a1;
  }
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.beginPath();
  g.arc(h, h, rad + 0.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#eef8ff';
  g.font = `600 ${Math.round((n >= 1000 ? 11 : 12) * S)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n), h, h + 0.5);
  c = c.toDataURL('image/png');
  if (badgeCache.size > 400) badgeCache.clear();
  badgeCache.set(k, c);
  return c;
}
