// Place labels and cluster badges as Cesium primitives anchored to the globe surface (they move with the globe, never
// float). Level of detail by camera altitude plus greedy screen-space collision avoidance decide WHICH labels are shown;
// the selection is refreshed while the camera moves (throttled), positions are always world-anchored.
import * as THREE from 'three';
import { ll2v } from './geo.js';
import { clusterBadge } from './cesium/icons.js';
import { Cesium } from './cesium/C.js';

export class Labels {
  constructor(globe) {
    const C = Cesium;
    this.C = C;
    this.g = globe;
    this.sets = {};
    this.on = true;
    const prims = globe.scene.primitives;
    this.dots = prims.add(new C.PointPrimitiveCollection());
    this.lc = prims.add(new C.LabelCollection());
    this.badges = prims.add(new C.BillboardCollection());
    this.m = document.createElement('canvas').getContext('2d');
    this._last = new THREE.Vector3();
    this._dirty = true;
    this._t = 0;
    this._clusters = null;
    this.lastDrawn = 0;
  }
  // items: [{name, lat, lon, pri}]; style.minAlt/maxAlt in Earth radii above the surface
  addSet(key, items, style) {
    if (this.sets[key]) this.removeSet(key);
    const xyz = new Float32Array(items.length * 3);
    const v = new THREE.Vector3();
    items.forEach((it, i) => {
      ll2v(it.lat, it.lon, 1, v);
      xyz[i * 3] = v.x;
      xyz[i * 3 + 1] = v.y;
      xyz[i * 3 + 2] = v.z;
    });
    const C = this.C;
    this.sets[key] = {
      items,
      xyz,
      style,
      live: new Map(),
      fill: C.Color.fromCssColorString(style.color || '#fff'),
      dot: style.dot ? C.Color.fromCssColorString(style.dot) : null,
    };
    this._dirty = true;
  }
  removeSet(k) {
    const S = this.sets[k];
    if (!S) return;
    for (const o of S.live.values()) this._kill(o);
    delete this.sets[k];
    this._dirty = true;
  }
  _kill(o) {
    this.lc.remove(o.l);
    if (o.d) this.dots.remove(o.d);
  }
  resize() {
    this._dirty = true;
  }
  _make(S, it) {
    const C = this.C,
      st = S.style;
    const pos = C.Cartesian3.fromDegrees(it.lon, it.lat, 0);
    const o = {
      l: this.lc.add({
        position: pos,
        text: st.upper ? it.name.toUpperCase() : it.name,
        font: st.font,
        fillColor: S.fill,
        outlineColor: C.Color.BLACK.withAlpha(0.8),
        outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: C.HorizontalOrigin.CENTER,
        verticalOrigin: C.VerticalOrigin.CENTER,
        pixelOffset: new C.Cartesian2(0, st.dy || 0),
        show: false,
      }),
      d: S.dot ? this.dots.add({ position: pos, pixelSize: 4, color: S.dot, show: false }) : null,
    };
    return o;
  }
  _badges(clusters) {
    if (clusters === this._clusters) return;
    this._clusters = clusters;
    const C = this.C;
    this.badges.removeAll();
    for (const c of clusters) {
      if (c.lat == null) continue;
      const rad = 10 + Math.min(14, Math.sqrt(c.n) * 3);
      const sz = Math.ceil(rad * 2 + 6);
      this.badges.add({
        position: C.Cartesian3.fromDegrees(c.lon, c.lat, 0),
        image: clusterBadge(c.n, c.color),
        width: sz,
        height: sz,
        id: { cluster: c },
      });
    }
  }
  draw(clusters = []) {
    this._badges(clusters);
    const cam = this.g.camera.position;
    const moved = cam.distanceToSquared(this._last) > 1e-12;
    const now = performance.now();
    if (!this._dirty && !moved) return;
    if (!this._dirty && now - this._t < 110) return;
    this._last.copy(cam);
    this._t = now;
    this._dirty = false;
    this._select();
  }
  _select() {
    const g = this.g;
    const cam = g.camera.position;
    const alt = cam.length() - 1;
    const cn = cam.clone().normalize();
    const W = g.canvas.clientWidth,
      H = g.canvas.clientHeight;
    const boxes = [];
    const coll = (b) => {
      for (const o of boxes) if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) return true;
      return false;
    };
    // cluster badges reserve their space first
    for (const c of this._clusters || []) {
      if (c.lat == null) continue;
      const p = g.project(c.lat, c.lon);
      if (!p) continue;
      const rad = 10 + Math.min(14, Math.sqrt(c.n) * 3);
      boxes.push({ x: p.x - rad, y: p.y - rad, w: rad * 2, h: rad * 2 });
    }
    const capCos = Math.min(0.999, 1 / (1 + alt));
    const viewCos = Math.max(capCos, 1 - (alt * 0.9 + 0.02));
    const keys = Object.keys(this.sets).sort((a, b) => (this.sets[a].style.z || 0) - (this.sets[b].style.z || 0));
    let drawn = 0;
    for (const k of keys) {
      const S = this.sets[k],
        st = S.style;
      const show = new Set();
      if (this.on && alt <= st.maxAlt && alt >= (st.minAlt || 0)) {
        const cand = [];
        const xyz = S.xyz;
        for (let i = 0; i < S.items.length; i++) {
          const d = xyz[i * 3] * cn.x + xyz[i * 3 + 1] * cn.y + xyz[i * 3 + 2] * cn.z;
          if (d < viewCos) continue;
          if (st.priMax !== undefined && S.items[i].pri > st.priMax(alt)) continue;
          cand.push(i);
        }
        cand.sort((a, b) => S.items[a].pri - S.items[b].pri);
        this.m.font = st.font;
        const lim = st.limit || 400;
        for (const i of cand) {
          if (show.size >= lim) break;
          const it = S.items[i];
          const p = g.project(it.lat, it.lon, 1.0);
          if (!p || p.x < -50 || p.y < -20 || p.x > W + 50 || p.y > H + 20) continue;
          const txt = st.upper ? it.name.toUpperCase() : it.name;
          const tw = this.m.measureText(txt).width;
          const th = st.h || 12;
          const b = { x: p.x - tw / 2 - 3, y: p.y - th / 2 - 2 + (st.dy || 0), w: tw + 6, h: th + 4 };
          if (coll(b)) continue;
          boxes.push(b);
          show.add(i);
        }
      }
      // apply: create on demand, hide the rest, cap memory
      for (const [i, o] of S.live) {
        if (!show.has(i)) {
          o.l.show = false;
          if (o.d) o.d.show = false;
        }
      }
      for (const i of show) {
        let o = S.live.get(i);
        if (!o) S.live.set(i, (o = this._make(S, S.items[i])));
        o.l.show = true;
        if (o.d) o.d.show = true;
      }
      if (S.live.size > (st.limit || 400) * 6)
        for (const [i, o] of S.live)
          if (!show.has(i)) {
            this._kill(o);
            S.live.delete(i);
          }
      drawn += show.size;
    }
    this.lastDrawn = drawn;
  }
}
