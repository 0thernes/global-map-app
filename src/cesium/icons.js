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
export function clusterBadge(n, color) {
  const k = n + color;
  let c = badgeCache.get(k);
  if (c) return c;
  const rad = 10 + Math.min(14, Math.sqrt(n) * 3);
  const sz = Math.ceil(rad * 2 + 6) * 2;
  c = document.createElement('canvas');
  c.width = c.height = sz;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const h = sz / 4;
  g.fillStyle = 'rgba(10,20,35,0.82)';
  g.strokeStyle = color || '#5ff';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(h, h, rad, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#e8fbff';
  g.font = '600 12px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), h, h + 0.5);
  c = c.toDataURL('image/png');
  if (badgeCache.size > 400) badgeCache.clear();
  badgeCache.set(k, c);
  return c;
}
