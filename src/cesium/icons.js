// Canvas-drawn marker icons for Cesium billboards, returned as data URLs. Drawn white so the per-billboard colour tints them.
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
    // 2: faint centre dot for imprecise rows (the uncertainty circle carries the extent)
    mk((g, h) => {
      const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
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
  ];
  return cache;
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
export function clusterBadge(n, color, mix) {
  const segs = mix && mix.length ? mix : [[color || '#5ff', n]];
  const tot = segs.reduce((a, s) => a + s[1], 0) || 1;
  // cache key: count + each colour with its share quantised to 1/24 of the ring
  const k = n + '|' + segs.map(([c, m]) => c + Math.round((m / tot) * 24)).join(',');
  let c = badgeCache.get(k);
  if (c) return c;
  const rad = 10 + Math.min(14, Math.sqrt(n) * 3);
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
  g.lineWidth = 3;
  let a0 = -Math.PI / 2;
  for (const [col, m] of segs) {
    const a1 = a0 + (m / tot) * Math.PI * 2;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(h, h, rad - 1.5, a0, a1);
    g.stroke();
    a0 = a1;
  }
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.beginPath();
  g.arc(h, h, rad + 0.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#eef8ff';
  g.font = `600 ${n >= 1000 ? 11 : 12}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n), h, h + 0.5);
  c = c.toDataURL('image/png');
  if (badgeCache.size > 400) badgeCache.clear();
  badgeCache.set(k, c);
  return c;
}
