// Globe reference overlays (v1.5, ADR 0005 section 2): the adaptive latitude/longitude graticule with labels, and the
// solar terminator with civil / nautical / astronomical twilight rings. Geometry comes from the pure module
// ./graticule.js; this file only turns it into batched Cesium GL_LINES primitives and labels. Rebuilds are throttled
// (200 ms) and keyed, and each one asks the render-on-demand loop for frames (requestRender), so an idle globe
// with both overlays on still renders nothing (test/perf.mjs).
import { graticuleStep, graticuleLines, graticuleLabel, terminatorRings } from './graticule.js';
import { subsolar } from '../sun.js';
import { uiScale } from './icons.js';

const D = 180 / Math.PI;
const A_WGS = 6378137,
  E2_WGS = 0.0066943799901413165;
// same, at height h metres (reference lines are lifted by their chord sag so the globe never hides a segment)
export function ecefH(lat, lon, h, out, o) {
  const la = lat / D,
    lo = lon / D;
  const s = Math.sin(la),
    c = Math.cos(la);
  const N = A_WGS / Math.sqrt(1 - E2_WGS * s * s);
  out[o] = (N + h) * c * Math.cos(lo);
  out[o + 1] = (N + h) * c * Math.sin(lo);
  out[o + 2] = (N * (1 - E2_WGS) + h) * s;
}
/** Height that keeps a straight chord of `deg` degrees of arc above the ellipsoid (sagitta x 1.4, at least 20 m). */
export const sagH = (deg) => Math.max(20, ((deg * 111195) ** 2 / (8 * 6371008.8)) * 1.4);

// overlay colours [r, g, b, a]: the normal palette mirrors the --ref-* tokens in css/tokens.css; the high-contrast
// theme (body.theme-hc) switches to opaque white / yellow so the overlays survive the black and white theme
export const REF_COLORS = {
  normal: {
    minor: [0.66, 0.84, 1, 0.26],
    major: [0.22, 0.91, 1, 0.55],
    labMinor: [0.8, 0.9, 1, 0.8],
    labMajor: [0.22, 0.91, 1, 0.95],
    term: [1, 0.78, 0.34, 0.85],
    civil: [1, 0.62, 0.3, 0.42],
    nautical: [0.62, 0.56, 1, 0.32],
    astro: [0.45, 0.5, 1, 0.24],
  },
  hc: {
    minor: [1, 1, 1, 0.6],
    major: [1, 0.92, 0.2, 1],
    labMinor: [1, 1, 1, 1],
    labMajor: [1, 0.92, 0.2, 1],
    term: [1, 0.92, 0.2, 1],
    civil: [1, 0.92, 0.2, 0.75],
    nautical: [1, 1, 1, 0.6],
    astro: [1, 1, 1, 0.45],
  },
};
export class ReferenceOverlays {
  constructor(globe) {
    this.g = globe;
    this.grid = false;
    this.term = false;
    this.gridKey = '';
    this.gridPrim = null;
    this.gridLabels = null;
    this.termPrim = null;
    this.termSub = null;
    this.hc = false;
  }
  /** High-contrast palette on or off (rebuilds whatever is shown). */
  setContrast(hc) {
    if (this.hc === !!hc) return;
    this.hc = !!hc;
    this.gridKey = '';
    this.termSub = null;
    this._t = 0;
    this.g.requestRender();
  }
  _col(k) {
    const c = REF_COLORS[this.hc ? 'hc' : 'normal'][k];
    return new this.g.C.Color(c[0], c[1], c[2], c[3]);
  }
  /** Latitude / longitude grid; spacing adapts to the camera height and only the visible part is built when close. */
  setGrid(on) {
    this.grid = !!on;
    this.gridKey = '';
    if (!on) this._dropGrid();
    this.g.requestRender();
  }
  /** Solar terminator plus civil / nautical / astronomical twilight rings for the timeline date. */
  setTerminator(on) {
    this.term = !!on;
    this.termSub = null;
    if (!on && this.termPrim) {
      this.g.scene.primitives.remove(this.termPrim);
      this.termPrim = null;
    }
    this.g.requestRender();
  }
  _dropGrid() {
    const R = this;
    if (R.gridPrim) this.g.scene.primitives.remove(R.gridPrim);
    if (R.gridLabels) this.g.scene.primitives.remove(R.gridLabels);
    R.gridPrim = R.gridLabels = null;
  }
  _linesPrim(groups) {
    // groups: [{ lines: [[ [lat, lon], ... ]], color: Cesium.Color, dashed?, sample }]; one batched GL_LINES primitive
    const C = this.g.C;
    const inst = [];
    groups.forEach((gp, gi) => {
      let n = 0;
      for (const l of gp.lines) n += gp.dashed ? l.length >> 1 : Math.max(0, l.length - 1);
      if (!n) return;
      const v = new Float64Array(n * 6);
      const h = sagH(gp.sample || 2);
      let o = 0;
      for (const l of gp.lines) {
        const stepI = gp.dashed ? 2 : 1;
        for (let i = 0; i + 1 < l.length; i += stepI) {
          ecefH(l[i][0], l[i][1], h, v, o);
          ecefH(l[i + 1][0], l[i + 1][1], h, v, o + 3);
          o += 6;
        }
      }
      const vals = o === v.length ? v : v.slice(0, o);
      inst.push(
        new C.GeometryInstance({
          id: 'ref' + gi,
          geometry: new C.Geometry({
            attributes: {
              position: new C.GeometryAttribute({
                componentDatatype: C.ComponentDatatype.DOUBLE,
                componentsPerAttribute: 3,
                values: vals,
              }),
            },
            primitiveType: C.PrimitiveType.LINES,
            boundingSphere: C.BoundingSphere.fromVertices(vals),
          }),
          attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(gp.color) },
        }),
      );
    });
    if (!inst.length) return null;
    return this.g.scene.primitives.add(
      new C.Primitive({
        geometryInstances: inst,
        appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
        asynchronous: false,
        allowPicking: false,
        compressVertices: false,
      }),
    );
  }
  _viewBox() {
    const r = this.g.scene.camera.computeViewRectangle(this.g.scene.globe.ellipsoid);
    if (!r) return null;
    return { west: r.west * D, south: r.south * D, east: r.east * D, north: r.north * D };
  }
  update(now, date) {
    const R = this;
    if (!R.grid && !R.term) return;
    if (now - (R._t || 0) < 200) return;
    R._t = now;
    const C = this.g.C;
    if (R.grid) {
      const cc = this.g.scene.camera.positionCartographic;
      const step = graticuleStep(cc.height);
      const box = step <= 5 ? this._viewBox() : null;
      const q = (v) => Math.round(v / (step * 4));
      const key = box ? `${step}|${q(box.west)}|${q(box.south)}|${q(box.east)}|${q(box.north)}` : `${step}|all`;
      if (key !== R.gridKey) {
        R.gridKey = key;
        this._dropGrid();
        const pad = step * 2;
        const bb = box && {
          west: box.west - pad,
          east: box.east + pad,
          south: box.south - pad,
          north: box.north + pad,
        };
        const sample = Math.min(2, step / 2);
        const lines = graticuleLines(step, bb, { sample });
        const minor = lines.filter((l) => !l.major).map((l) => l.pts);
        const major = lines.filter((l) => l.major).map((l) => l.pts);
        R.gridPrim = this._linesPrim([
          { lines: minor, color: this._col('minor'), sample },
          { lines: major, color: this._col('major'), sample },
        ]);
        // labels along the parallel and meridian nearest the view centre
        const lab = new C.LabelCollection();
        const cLat = cc.latitude * D,
          cLon = cc.longitude * D;
        const labLat = Math.round(cLat / step) * step,
          labLon = Math.round(cLon / step) * step;
        const font = `${Math.round(12 * uiScale())}px "JetBrains Mono", monospace`;
        let n = 0;
        for (const l of lines) {
          if (n++ > 72) break;
          const [la, lo] = l.kind === 'meridian' ? [Math.max(-80, Math.min(80, labLat)), l.value] : [l.value, labLon];
          lab.add({
            position: C.Cartesian3.fromDegrees(lo, la, sagH(sample)),
            text: graticuleLabel(l.kind, l.value),
            font,
            fillColor: this._col(l.major ? 'labMajor' : 'labMinor'),
            outlineColor: new C.Color(0.01, 0.02, 0.05, 0.9),
            outlineWidth: 3,
            style: C.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new C.Cartesian2(4, -4),
            horizontalOrigin: C.HorizontalOrigin.LEFT,
            verticalOrigin: C.VerticalOrigin.BOTTOM,
          });
        }
        R.gridLabels = this.g.scene.primitives.add(lab);
        this.g.requestRender(600);
      }
    }
    if (R.term && date) {
      const sub = subsolar(date);
      const p = R.termSub;
      if (!p || Math.abs(p.lat - sub.lat) > 0.1 || Math.abs(((p.lon - sub.lon + 540) % 360) - 180) > 0.1) {
        R.termSub = sub;
        if (R.termPrim) this.g.scene.primitives.remove(R.termPrim);
        const rings = terminatorRings(sub, 180);
        R.termPrim = this._linesPrim([
          { lines: [rings[0].pts], color: this._col('term'), sample: 2 },
          { lines: [rings[1].pts], color: this._col('civil'), dashed: true, sample: 2 },
          { lines: [rings[2].pts], color: this._col('nautical'), dashed: true, sample: 2 },
          { lines: [rings[3].pts], color: this._col('astro'), dashed: true, sample: 2 },
        ]);
        this.g.requestRender(600);
      }
    }
  }
}
