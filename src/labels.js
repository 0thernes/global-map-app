// Canvas-2D label overlay with level-of-detail by camera altitude and greedy collision avoidance.
import { ll2v } from './geo.js';
import * as THREE from 'three';
export class Labels {
  constructor(canvas, globe) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = globe; this.sets = {}; this.v = new THREE.Vector3(); this.on = true; this.extra = []; }
  // items: [{name, lat, lon, pri}] ; minAlt/maxAlt in globe radii above surface
  addSet(key, items, style) {
    const xyz = new Float32Array(items.length * 3); const v = new THREE.Vector3();
    items.forEach((it, i) => { ll2v(it.lat, it.lon, 1, v); xyz.set([v.x, v.y, v.z], i * 3); });
    this.sets[key] = { items, xyz, style };
  }
  removeSet(k) { delete this.sets[k]; }
  resize() { const r = Math.min(2, window.devicePixelRatio || 1); this.c.width = this.c.clientWidth * r; this.c.height = this.c.clientHeight * r; this.ratio = r; }
  draw(clusters = []) {
    const ctx = this.ctx; const r = this.ratio || 1; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, this.c.width, this.c.height);
    const cam = this.g.camera.position; const alt = cam.length() - 1; const cn = cam.clone().normalize();
    const W = this.c.clientWidth, H = this.c.clientHeight; const boxes = [];
    const coll = (b) => { for (const o of boxes) if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) return true; return false; };
    // cluster badges first (priority)
    for (const c of clusters) {
      ctx.beginPath(); const rad = 10 + Math.min(14, Math.sqrt(c.n) * 3);
      ctx.fillStyle = 'rgba(10,20,35,0.78)'; ctx.strokeStyle = c.color || '#5ff'; ctx.lineWidth = 2; ctx.arc(c.x, c.y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8fbff'; ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(c.n), c.x, c.y + 0.5);
      boxes.push({ x: c.x - rad, y: c.y - rad, w: rad * 2, h: rad * 2 });
    }
    if (!this.on) return;
    const keys = Object.keys(this.sets).sort((a, b) => (this.sets[a].style.z || 0) - (this.sets[b].style.z || 0));
    // cos of angular radius of visible cap (approx)
    const capCos = Math.min(0.999, 1 / (1 + alt)) ; const viewCos = Math.max(capCos, 1 - (alt * 0.9 + 0.02));
    let drawn = 0;
    for (const k of keys) {
      const S = this.sets[k], st = S.style; if (alt > st.maxAlt || alt < (st.minAlt || 0)) continue;
      const cand = []; const xyz = S.xyz;
      const lim = st.limit || 400;
      for (let i = 0; i < S.items.length; i++) {
        const d = xyz[i * 3] * cn.x + xyz[i * 3 + 1] * cn.y + xyz[i * 3 + 2] * cn.z; if (d < viewCos) continue;
        const it = S.items[i]; if (st.priMax !== undefined && it.pri > st.priMax(alt)) continue;
        cand.push(i);
      }
      cand.sort((a, b) => S.items[a].pri - S.items[b].pri);
      ctx.font = st.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let n = 0;
      for (const i of cand) {
        if (n >= lim) break; const it = S.items[i]; const p = this.g.project(it.lat, it.lon, 1.0, this.v); if (!p || p.x < -50 || p.y < -20 || p.x > W + 50 || p.y > H + 20) continue;
        const txt = st.upper ? it.name.toUpperCase() : it.name; const tw = ctx.measureText(txt).width; const th = st.h || 12;
        const b = { x: p.x - tw / 2 - 3, y: p.y - th / 2 - 2 + (st.dy || 0), w: tw + 6, h: th + 4 }; if (coll(b)) continue; boxes.push(b);
        if (st.dot) { ctx.fillStyle = st.dot; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(txt, p.x, p.y + (st.dy || 0)); ctx.fillStyle = st.color; ctx.fillText(txt, p.x, p.y + (st.dy || 0));
        n++; drawn++;
      }
    }
    this.lastDrawn = drawn;
  }
}
