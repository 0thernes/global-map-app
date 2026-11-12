// CesiumJS globe adapter (ADR 0001). Keeps the public surface of the old three.js Globe so the UI modules barely change,
// while the rendering moves to Cesium: streamed, level-of-detail imagery and terrain, world-anchored markers and labels,
// physically based atmosphere and sun lighting. No Cesium ion token or asset is used: every source is keyless.
import * as THREE from 'three';
import { ll2v, v2ll } from './geo.js';
import { subsolar } from './sun.js';
import { BASEMAPS, NIGHT, TERRAINS } from './cesium/sources.js';
import { createTerrariumProvider } from './cesium/terrarium.js';
import { shapeIcons, ringIcon } from './cesium/icons.js';
import { Cesium } from './cesium/C.js';

export const R_EARTH = 6371008.8; // metres per app unit (the UI measures altitude in Earth radii)
const D = 180 / Math.PI;
const A_WGS = 6378137,
  E2_WGS = 0.0066943799901413165;
// fast geodetic -> ECEF for h = 0 (hot path for line layers)
function ecef0(lat, lon, out, o) {
  const la = lat / D,
    lo = lon / D;
  const s = Math.sin(la),
    c = Math.cos(la);
  const N = A_WGS / Math.sqrt(1 - E2_WGS * s * s);
  out[o] = N * c * Math.cos(lo);
  out[o + 1] = N * c * Math.sin(lo);
  out[o + 2] = N * (1 - E2_WGS) * s;
}
const tc = new THREE.Color();
const toCesiumColor = (C, c, a = 1) => {
  tc.set(c);
  return new C.Color(tc.r, tc.g, tc.b, a);
};

// lens stage: cheap 8-tap highlight glow (bloom), chromatic aberration on transitions, vignette and film grain.
// Cesium's built-in bloom stage was dropped: it darkens and hazes satellite imagery.
const LENS_FS = `uniform sampler2D colorTexture; uniform float time; uniform float ca; uniform float bloom; in vec2 v_textureCoordinates;
vec3 hi(vec2 p){ vec3 c=texture(colorTexture,p).rgb; float l=dot(c,vec3(0.299,0.587,0.114)); return c*smoothstep(0.72,1.0,l); }
void main(){ vec2 uv=v_textureCoordinates; vec2 d=uv-0.5; float r=dot(d,d);
 vec2 off=d*ca*0.02; vec3 c=vec3(texture(colorTexture,uv+off).r, texture(colorTexture,uv).g, texture(colorTexture,uv-off).b);
 if(bloom>0.01){ vec2 px=vec2(dFdx(uv.x),dFdy(uv.y))*7.0; vec3 g=vec3(0.0);
  for(int i=0;i<8;i++){ float a=float(i)*0.7853982; g+=hi(uv+vec2(cos(a),sin(a))*px)+hi(uv+vec2(cos(a),sin(a))*px*2.2)*0.6; }
  c+=g*(0.06*bloom); }
 c*=mix(0.7,1.0,smoothstep(0.62,0.12,r*1.5));
 float n=fract(sin(dot(uv*vec2(12.9898,78.233)+fract(time),vec2(1.0,1.0)))*43758.5453); c+=(n-0.5)*0.025;
 out_FragColor=vec4(c,1.0); }`;

const DBG = new URLSearchParams(location.search).get('gmdbg') || '';
export class Globe {
  constructor(host, opts = {}) {
    const C = Cesium;
    this.C = C;
    C.Ion.defaultAccessToken = undefined; // never talk to Cesium ion
    C.buildModuleUrl.setBaseUrl(new URL('vendor/cesium/', document.baseURI).href); // workers, assets, wasm
    this.host = host;
    const credits = document.createElement('div');
    credits.id = 'credits';
    document.body.appendChild(credits);
    this.w = new C.CesiumWidget(host, {
      baseLayer: false,
      terrainProvider: new C.EllipsoidTerrainProvider(),
      useDefaultRenderLoop: false,
      useBrowserRecommendedResolution: false,
      scene3DOnly: true,
      creditContainer: credits,
      contextOptions: { webgl: { preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' } },
      orderIndependentTranslucency: false,
      msaaSamples: 1,
      shouldAnimate: false,
      blurActiveElementOnCanvasFocus: false,
    });
    const sc = (this.scene = this.w.scene);
    // MSAA on real GPUs only; software rasterisers (SwiftShader in CI) get FXAA alone
    try {
      const glc = sc.context._gl;
      const dbg = glc.getExtension('WEBGL_debug_renderer_info');
      this.gpu = String(glc.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : glc.RENDERER));
    } catch {
      this.gpu = '';
    }
    this.software = /swiftshader|llvmpipe|software/i.test(this.gpu);
    if (!this.software) sc.msaaSamples = 4;
    this.canvas = this.w.canvas;
    this.canvas.setAttribute('aria-label', '3D globe');
    this.canvas.tabIndex = 0;
    const gl = sc.globe;
    gl.enableLighting = true;
    gl.dynamicAtmosphereLighting = true;
    gl.dynamicAtmosphereLightingFromSun = true;
    gl.showGroundAtmosphere = true;
    // day/night lighting from orbit; fades out when you get close so a city at night is still readable (Google Earth-like)
    gl.lightingFadeOutDistance = 6.5e5;
    gl.lightingFadeInDistance = 1.6e6;
    gl.nightFadeOutDistance = 6.5e5;
    gl.nightFadeInDistance = 1.6e6;
    gl.depthTestAgainstTerrain = false; // markers stay on top of terrain but are still hidden on the far side (depth plane)
    gl.baseColor = C.Color.fromCssColorString('#0b1a2a');
    gl.maximumScreenSpaceError = 1.5; // sharper imagery than the default 2
    gl.tileCacheSize = 400;
    gl.preloadAncestors = true;
    sc.skyAtmosphere.show = true;
    sc.fog.enabled = true;
    sc.backgroundColor = C.Color.fromCssColorString('#01030a');
    sc.highDynamicRange = false;
    const ctl = sc.screenSpaceCameraController;
    ctl.minimumZoomDistance = 25;
    ctl.maximumZoomDistance = 8 * R_EARTH;
    ctl.enableCollisionDetection = true;
    // public surface kept from the three.js version
    this.camera = { position: new THREE.Vector3(0.8, 1.2, 3.6), fov: 40 };
    Object.defineProperty(this.camera, 'fov', { get: () => sc.camera.frustum.fovy * D });
    this._lastPos = null;
    this.lineLayers = {};
    this.pointLayers = {};
    this.circleLayers = {};
    this.time = 0;
    this.compare = { mode: 'off', x: 0.5 };
    this.fx = { on: false, bloom: 0.55, ca: 0, caPulse: 0, caEnabled: true };
    this.orbit = null;
    this.onFly = null;
    this.onStatus = opts.onStatus || (() => {});
    this.reducedMotion = false;
    this.centerShift = 0;
    this._flying = false;
    this.glowData = new Uint8Array(512 * 4);
    const self = this;
    this.glowTex = {
      set needsUpdate(v) {
        if (v) self._idDirty = true;
      },
    };
    this.earthU = { lightingOn: { value: 1 }, glowOn: { value: 1 }, hiId: { value: -1 }, time: { value: 0 } };
    this._applied = { lighting: null, glow: null, hi: null };
    this._uris = {};
    this.renderer = {
      getPixelRatio: () => +(this.w.resolutionScale * (window.devicePixelRatio || 1)).toFixed(2),
      setPixelRatio: (r) => {
        this._pr = r;
        this.w.resolutionScale = r / (window.devicePixelRatio || 1);
      },
    };
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this._watchDpr();
    // primitives
    this.arcs = sc.primitives.add(new C.PolylineCollection());
    this.fxBillboards = sc.primitives.add(new C.BillboardCollection());
    this.rings = [];
    this._ringImg = ringIcon();
    this.overlays = {};
    this.basemapId = null;
    this._base = [];
    this._night = null;
    this.terrainId = 'off';
    // stop the cinematic orbit and any fly-to when the user grabs the globe
    for (const ev of ['pointerdown', 'wheel'])
      this.canvas.addEventListener(ev, () => {
        if (this.orbit) this.setOrbit(null);
      });
    this._initNight();
    this.resize();
  }
  // ---------- imagery ----------
  _urlProvider(url, max, credit, sub) {
    const C = this.C;
    return new C.UrlTemplateImageryProvider({
      url,
      subdomains: sub,
      maximumLevel: max,
      credit: credit ? new C.Credit(credit) : undefined,
      tilingScheme: new C.WebMercatorTilingScheme(),
      enablePickFeatures: false,
    });
  }
  _watchErrors(provider, onFail, limit = 16) {
    let n = 0;
    provider.errorEvent.addEventListener((e) => {
      if (++n === limit) onFail(e);
    });
  }
  _localLayer(uri, credit) {
    const C = this.C;
    return C.ImageryLayer.fromProviderAsync(
      C.SingleTileImageryProvider.fromUrl(uri, { credit: credit ? new C.Credit(credit) : undefined }),
    );
  }
  setBasemap(id) {
    const C = this.C;
    const b = BASEMAPS.find((x) => x.id === id) || BASEMAPS[0];
    for (const l of this._base) this.scene.imageryLayers.remove(l, true);
    this._base = [];
    if (b.local) {
      if (this._uris.dayTex) this._base.push(this._localLayer(this._uris.dayTex, b.credit));
    } else {
      const date = this._dailyDate(b);
      const urls = [b.url, ...(b.overlays || [])];
      urls.forEach((u, i) => {
        const p = this._urlProvider(u.replace('{date}', date), b.max, i ? null : b.credit, b.sub);
        if (!i)
          this._watchErrors(p, () => {
            if (this.basemapId !== b.id) return;
            this.onStatus(`${b.name}: tiles failing (offline or blocked); switched to the bundled offline basemap`);
            this.setBasemap('local');
          });
        this._base.push(new C.ImageryLayer(p));
      });
    }
    this._base.forEach((l, i) => this.scene.imageryLayers.add(l, i));
    this.basemapId = b.id;
    this._baseDate = b.daily ? this._dailyDate(b) : null;
    return b;
  }
  _dailyDate(b) {
    if (!b.daily) return '';
    const d = this._date ? this._date.toISOString().slice(0, 10) : '2024-06-01';
    const today = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    return d < b.daily ? b.daily : d > today ? today : d;
  }
  _initNight() {
    const p = this._urlProvider(NIGHT.url, NIGHT.max, NIGHT.credit);
    this._watchErrors(p, () => {
      if (this._uris.nightTex) this._setNight(this._localLayer(this._uris.nightTex, 'Night lights: NASA Black Marble'));
    });
    this._setNight(new this.C.ImageryLayer(p));
  }
  _setNight(layer) {
    const L = this.scene.imageryLayers;
    if (this._night) L.remove(this._night, true);
    layer.dayAlpha = 0;
    layer.nightAlpha = 1;
    layer.brightness = 1.4;
    L.add(layer, this._base.length);
    this._night = layer;
    this._applied.lighting = null;
  }
  async setTerrain(id) {
    const C = this.C;
    const t = TERRAINS.find((x) => x.id === id) || TERRAINS[TERRAINS.length - 1];
    let prov;
    try {
      if (t.id === 'terrarium') prov = createTerrariumProvider(C, t);
      else if (t.id === 'esri') prov = await C.ArcGISTiledElevationTerrainProvider.fromUrl(t.url);
    } catch (e) {
      console.warn('terrain', e);
      this.onStatus('Terrain source unavailable; using the flat ellipsoid');
    }
    this.scene.terrainProvider = prov || new C.EllipsoidTerrainProvider();
    this.terrainId = prov ? t.id : 'off';
    if (prov) prov.errorEvent?.addEventListener(() => {});
    return this.terrainId;
  }
  setTexture(slot, uri, opts = {}) {
    this._uris[slot] = uri;
    if (slot === 'dayTex' && this.basemapId === 'local') this.setBasemap('local');
    if (slot === 'idTex') return this._loadIdMap(uri, opts);
    return Promise.resolve();
  }
  // ---------- country id map: conflict glow + hover highlight, baked into one imagery overlay ----------
  _loadIdMap(uri) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        const w = Math.min(1024, im.width),
          h = Math.round((w * im.height) / im.width);
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const c2 = cv.getContext('2d', { willReadFrequently: true });
        c2.imageSmoothingEnabled = false;
        c2.drawImage(im, 0, 0, w, h);
        this._id = { w, h, d: c2.getImageData(0, 0, w, h).data, cv, c2 };
        this._idDirty = true;
        res();
      };
      im.onerror = () => res();
      im.src = uri;
    });
  }
  _rebuildIdOverlay() {
    const I = this._id;
    if (!I || this._idBusy) return;
    this._idDirty = false;
    this._idBusy = true;
    const { w, h, d } = I;
    const out = I.c2.createImageData(w, h);
    const o = out.data,
      gd = this.glowData,
      hi = this.earthU.hiId.value,
      gOn = this.earthU.glowOn.value > 0;
    for (let i = 0, n = w * h; i < n; i++) {
      const id = d[i * 4] + d[i * 4 + 1] * 256;
      if (!id) continue;
      const gv = gOn && id < 512 ? gd[id * 4] : 0;
      const k = i * 4;
      if (gv) {
        o[k] = 255;
        o[k + 1] = 70;
        o[k + 2] = 24;
        o[k + 3] = Math.round(gv * 0.5);
      }
      if (id === hi) {
        o[k] = Math.max(o[k], 90);
        o[k + 1] = 210;
        o[k + 2] = 255;
        o[k + 3] = Math.max(o[k + 3], 64);
      }
    }
    I.c2.putImageData(out, 0, 0);
    I.cv.toBlob((blob) => {
      this._idBusy = false;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const C = this.C;
      const layer = new C.ImageryLayer(new C.SingleTileImageryProvider({ url, tileWidth: w, tileHeight: h }));
      layer.alpha = 0.9;
      this.scene.imageryLayers.add(layer, this._base.length + 1);
      const old = this._idLayer;
      this._idLayer = layer;
      if (old)
        setTimeout(() => {
          this.scene.imageryLayers.remove(old, true);
          URL.revokeObjectURL(old._gmUrl);
        }, 350);
      layer._gmUrl = url;
    }, 'image/png');
  }
  setDate(date) {
    this._date = date;
    this.subsolar = subsolar(date);
    this.w.clock.currentTime = this.C.JulianDate.fromDate(date);
    const b = BASEMAPS.find((x) => x.id === this.basemapId);
    if (b && b.daily && this._dailyDate(b) !== this._baseDate) {
      clearTimeout(this._dailyT);
      this._dailyT = setTimeout(() => this.setBasemap(b.id), 700);
    }
  }
  // ---------- line layers: one batched GL_LINES primitive per layer ----------
  addLines(name, payload, { color = 0x88ccff, opacity = 0.5, filter = null } = {}) {
    const C = this.C;
    if (this.lineLayers[name]) this._removeLines(name);
    const q = payload.q || 1000;
    let n = 0;
    payload.lines.forEach((l, li) => {
      if (!filter || filter(li)) n += Math.max(0, (l.length >> 1) - 1);
    });
    const values = new Float64Array(n * 6);
    let o = 0;
    payload.lines.forEach((l, li) => {
      if (filter && !filter(li)) return;
      for (let i = 0; i + 3 < l.length; i += 2) {
        ecef0(l[i + 1] / q, l[i] / q, values, o);
        ecef0(l[i + 3] / q, l[i + 2] / q, values, o + 3);
        o += 6;
      }
    });
    const obj = new LineObj(this, name, toCesiumColor(C, color), opacity);
    if (n && !DBG.includes('l')) {
      const geometry = new C.Geometry({
        attributes: {
          position: new C.GeometryAttribute({
            componentDatatype: C.ComponentDatatype.DOUBLE,
            componentsPerAttribute: 3,
            values,
          }),
        },
        primitiveType: C.PrimitiveType.LINES,
        boundingSphere: C.BoundingSphere.fromVertices(values),
      });
      obj.prim = this.scene.primitives.add(
        new C.Primitive({
          geometryInstances: new C.GeometryInstance({
            geometry,
            id: name,
            attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(obj.color.withAlpha(opacity)) },
          }),
          appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
          asynchronous: false,
          allowPicking: false,
          compressVertices: false,
        }),
      );
    }
    this.lineLayers[name] = obj;
    return obj;
  }
  _removeLines(name) {
    const o = this.lineLayers[name];
    if (o && o.prim) this.scene.primitives.remove(o.prim);
    delete this.lineLayers[name];
  }
  // ---------- point layers: billboards, world-anchored, time-aware alpha computed on the CPU when inputs change ----------
  addPoints(
    name,
    items,
    {
      colorFn,
      sizeFn = () => 6,
      t0Fn = null,
      t1Fn = null,
      shapeFn = null,
      radius = 1.004,
      mode = 0,
      timeAware = false,
      opacity = 1,
      clamp = false,
    } = {},
  ) {
    const C = this.C;
    if (this.pointLayers[name]) this.removePoints(name);
    const icons = shapeIcons();
    const n = items.length;
    const pos = new Float32Array(n * 3),
      vis = new Float32Array(n).fill(1),
      t0 = new Float64Array(n),
      t1 = new Float64Array(n),
      shp = new Uint8Array(n),
      col = new Array(n);
    const coll = new C.BillboardCollection({ scene: clamp ? this.scene : undefined });
    const nfs = new C.NearFarScalar(1.5e5, 1.3, 2.2e7, 0.5);
    const v = new THREE.Vector3();
    const bbs = new Array(n);
    const ecef = new Float64Array(3);
    items.forEach((it, i) => {
      ll2v(it.lat, it.lon, radius, v);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      const a0 = t0Fn ? t0Fn(it) : -1e9,
        a1 = t1Fn ? t1Fn(it) : 1e12;
      t0[i] = isFinite(a0) ? a0 : -1e9;
      t1[i] = isFinite(a1) ? a1 : 1e12;
      const s = (shp[i] = shapeFn ? shapeFn(it) : 0);
      col[i] = s === 3 ? new C.Color(1, 1, 1, 1) : toCesiumColor(C, colorFn(it));
      const px = sizeFn(it) * (s === 1 ? 1.9 : 2.3);
      ecef0(it.lat, it.lon, ecef, 0);
      bbs[i] = coll.add({
        position: new C.Cartesian3(ecef[0], ecef[1], ecef[2]),
        image: icons[s] || icons[0],
        width: px,
        height: px,
        color: col[i],
        scaleByDistance: nfs,
        heightReference: clamp ? C.HeightReference.CLAMP_TO_GROUND : C.HeightReference.NONE,
        id: { layer: name, i },
      });
    });
    const u = {
      cur: { value: 0 },
      fade: { value: 180 },
      mode: { value: mode },
      flash: { value: 30 },
      history: { value: 0.0 },
      timeAware: { value: timeAware ? 1 : 0 },
      opacity: { value: opacity },
      pxScale: { value: 1 },
    };
    this.scene.primitives.add(coll);
    const L = { name, items, u, pos, vis, radius, coll, bbs, t0, t1, shp, col, _sig: '', _dirty: true, _t: 0 };
    L.obj = {
      get visible() {
        return coll.show;
      },
      set visible(b) {
        coll.show = !!b;
        if (L.collB) L.collB.show = !!b;
      },
    };
    this.pointLayers[name] = L;
    return L;
  }
  removePoints(name) {
    const L = this.pointLayers[name];
    if (!L) return;
    this.scene.primitives.remove(L.coll);
    if (L.collB) this.scene.primitives.remove(L.collB);
    delete this.pointLayers[name];
  }
  setVis(L, fn) {
    for (let i = 0; i < L.items.length; i++) L.vis[i] = fn(L.items[i], i) ? 1 : 0;
    L._dirty = true;
  }
  _alpha(L, bbs, cur) {
    const C = this.C,
      u = L.u;
    const ta = u.timeAware.value > 0.5,
      mode = u.mode.value,
      fade = Math.max(u.fade.value, 1e-3),
      flash = Math.max(u.flash.value, 1e-3),
      hist = u.history.value,
      op = u.opacity.value;
    const c = this._sc || (this._sc = new C.Color());
    for (let i = 0; i < bbs.length; i++) {
      let a = L.vis[i],
        fl = 0;
      if (a > 0 && ta) {
        const t0 = L.t0[i];
        if (cur < t0) a = 0;
        else if (mode < 0.5) {
          const k = Math.min(1, (cur - t0) / fade);
          a *= k;
          fl = 1 - k;
        } else {
          const k = Math.exp(-(cur - t0) / flash);
          a *= Math.max(k, hist);
          fl = k;
        }
        if (cur > L.t1[i]) a *= 0.25;
      }
      const b = bbs[i];
      const show = a > 0.004;
      if (b.show !== show) b.show = show;
      if (!show) continue;
      const bc = L.col[i];
      c.red = bc.red;
      c.green = bc.green;
      c.blue = bc.blue;
      c.alpha = Math.min(1, a * op);
      b.color = c;
      const s = 1 + fl * 1.5;
      if (b.scale !== s) b.scale = s;
    }
  }
  _updatePoints(L, now) {
    const u = L.u;
    const sig = `${u.cur.value},${u.fade.value},${u.mode.value},${u.flash.value},${u.history.value},${u.timeAware.value},${u.opacity.value},${L.curB}`;
    if (!L._dirty && sig === L._sig) return;
    if (!L._dirty && now - L._t < 60) return;
    L._dirty = false;
    L._sig = sig;
    L._t = now;
    this._alpha(L, L.bbs, u.cur.value);
    if (L.bbsB) this._alpha(L, L.bbsB, L.curB);
  }
  // ---------- uncertainty circles: true geodesic radii in metres; never a pin ----------
  addCircles(name, items, { colorFn, radiusKmFn, t0Fn = null, timeAware = true, opacity = 0.9 } = {}) {
    const C = this.C;
    if (this.circleLayers[name]) this._removeCircles(name);
    const fill = [],
      edge = [];
    const t0 = new Float64Array(items.length);
    items.forEach((it, i) => {
      const r = Math.max(50, radiusKmFn(it) * 1000);
      const center = C.Cartesian3.fromDegrees(it.lon, it.lat, 0);
      // Cesium's ellipse tessellation treats granularity as a parametric angle (x8): 0.012 gives ~64 edge points at any radius
      const gran = 0.012;
      const c = toCesiumColor(C, colorFn(it));
      t0[i] = t0Fn ? t0Fn(it) : -1e9;
      const show = new C.ShowGeometryInstanceAttribute(true);
      fill.push(
        new C.GeometryInstance({
          id: i,
          geometry: new C.EllipseGeometry({
            center,
            semiMajorAxis: r,
            semiMinorAxis: r,
            granularity: gran * 1.5,
            vertexFormat: C.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
          }),
          attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(c.withAlpha(0.15 * opacity)), show },
        }),
      );
      edge.push(
        new C.GeometryInstance({
          id: i,
          geometry: new C.EllipseOutlineGeometry({ center, semiMajorAxis: r, semiMinorAxis: r, granularity: gran }),
          attributes: {
            color: C.ColorGeometryInstanceAttribute.fromColor(c.withAlpha(0.8 * opacity)),
            show: new C.ShowGeometryInstanceAttribute(true),
          },
        }),
      );
    });
    const mk = (inst) =>
      inst.length
        ? this.scene.primitives.add(
            new C.Primitive({
              geometryInstances: inst,
              appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }),
              asynchronous: false,
              allowPicking: false,
              releaseGeometryInstances: true,
            }),
          )
        : null;
    if (DBG.includes('c')) fill.length = edge.length = 0;
    const L = {
      name,
      items,
      vis: new Float32Array(items.length).fill(1),
      t0,
      fill: mk(fill),
      edge: mk(edge),
      u: {
        cur: { value: 0 },
        fade: { value: 0 },
        timeAware: { value: timeAware ? 1 : 0 },
        opacity: { value: opacity },
      },
      _dirty: true,
      _sig: '',
      _shown: new Uint8Array(items.length).fill(1),
    };
    L.obj = {
      get visible() {
        return L.fill ? L.fill.show : false;
      },
      set visible(b) {
        if (L.fill) L.fill.show = !!b;
        if (L.edge) L.edge.show = !!b;
      },
    };
    this.circleLayers[name] = L;
    return L;
  }
  _removeCircles(name) {
    const L = this.circleLayers[name];
    if (!L) return;
    if (L.fill) this.scene.primitives.remove(L.fill);
    if (L.edge) this.scene.primitives.remove(L.edge);
    delete this.circleLayers[name];
  }
  setCircleVis(L, fn) {
    for (let i = 0; i < L.items.length; i++) L.vis[i] = fn(L.items[i], i) ? 1 : 0;
    L._dirty = true;
  }
  _updateCircles(L, now) {
    if (!L.fill || !L.fill.ready || !L.edge.ready) return;
    const ta = L.u.timeAware.value > 0.5,
      cur = L.u.cur.value;
    const sig = ta ? String(cur) : '';
    if (!L._dirty && sig === L._sig) return;
    if (!L._dirty && now - (L._t || 0) < 80) return;
    L._dirty = false;
    L._sig = sig;
    L._t = now;
    const SG = this.C.ShowGeometryInstanceAttribute;
    for (let i = 0; i < L.items.length; i++) {
      const s = L.vis[i] > 0 && (!ta || cur >= L.t0[i]) ? 1 : 0;
      if (s === L._shown[i]) continue;
      L._shown[i] = s;
      for (const p of [L.fill, L.edge]) {
        const a = p.getGeometryInstanceAttributes(i);
        a.show = SG.toValue(!!s, a.show);
      }
    }
  }
  // ---------- effects ----------
  pulse(lat, lon, color) {
    const C = this.C;
    if (this.rings.length > 24) return;
    const b = this.fxBillboards.add({
      position: C.Cartesian3.fromDegrees(lon, lat, 0),
      image: this._ringImg,
      width: 12,
      height: 12,
      color: toCesiumColor(C, color, 0.9),
    });
    this.rings.push({ b, t: 0 });
  }
  clearArcs() {
    this.arcs.removeAll();
  }
  addArc(a, b, color = 0xffe066, opacity = 0.9) {
    const C = this.C;
    const va = ll2v(a.lat, a.lon, 1),
      vb = ll2v(b.lat, b.lon, 1);
    const ang = va.angleTo(vb);
    const pts = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      v.copy(va).lerp(vb, t).normalize();
      const ll = v2ll(v);
      const h = Math.sin(Math.PI * t) * Math.min(0.25, 0.05 + ang * 0.35) * R_EARTH * 0.6;
      pts.push(C.Cartesian3.fromDegrees(ll.lon, ll.lat, h));
    }
    this.arcs.add({
      positions: pts,
      width: 2,
      material: C.Material.fromType('Color', { color: toCesiumColor(C, color, opacity) }),
    });
  }
  _imageLayer(url, opacity, { top = true } = {}) {
    const C = this.C;
    const layer = C.ImageryLayer.fromProviderAsync(C.SingleTileImageryProvider.fromUrl(url));
    layer.alpha = opacity;
    this.scene.imageryLayers.add(layer);
    if (!top) this.scene.imageryLayers.lower(layer);
    return layer;
  }
  // dynamic equirectangular canvas overlays (heatmap, analysis surfaces); throttled re-upload
  setOverlayTexture(canvas, opacity = 0.85) {
    this._ovPending = { canvas, opacity };
    if (this._ovBusy) return;
    const run = () => {
      const p = this._ovPending;
      if (!p) return;
      this._ovPending = null;
      this._ovBusy = true;
      p.canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const C = this.C;
        const layer = new C.ImageryLayer(
          new C.SingleTileImageryProvider({ url, tileWidth: p.canvas.width, tileHeight: p.canvas.height }),
        );
        layer.alpha = p.opacity;
        this.scene.imageryLayers.add(layer);
        const old = this.overlay;
        this.overlay = layer;
        layer._gmUrl = url;
        setTimeout(() => {
          if (old) {
            this.scene.imageryLayers.remove(old, true);
            URL.revokeObjectURL(old._gmUrl);
          }
          this._ovBusy = false;
          if (this._ovPending) run();
        }, 250);
      }, 'image/png');
    };
    run();
  }
  // static equirectangular overlays (e.g. GEBCO 'never directly measured' mask)
  addTexOverlay(name, image, opacity = 0.8) {
    const layer = this._imageLayer(image.src || image, opacity);
    const o = {
      layer,
      get visible() {
        return layer.show;
      },
      set visible(b) {
        layer.show = !!b;
      },
      material: {
        get opacity() {
          return layer.alpha;
        },
        set opacity(a) {
          layer.alpha = a;
        },
      },
    };
    this.overlays[name] = o;
    return o;
  }
  hideOverlay() {
    this._ovPending = null;
    if (this.overlay) this.overlay.show = false;
  }
  // ---------- camera ----------
  _appPos(out = new THREE.Vector3()) {
    const c = this.scene.camera.positionCartographic;
    return ll2v(c.latitude * D, c.longitude * D, 1 + c.height / R_EARTH, out);
  }
  _setFromApp(p) {
    const C = this.C;
    const ll = v2ll(p);
    const h = Math.max(30, (p.length() - 1) * R_EARTH);
    this.scene.camera.setView({
      destination: C.Cartesian3.fromDegrees(ll.lon, ll.lat, h),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
    });
  }
  get _fly() {
    return this._flying ? { active: true } : null;
  }
  set _fly(v) {
    if (!v && this._flying) {
      this.scene.camera.cancelFlight();
      this._flying = false;
    }
  }
  // fly to a point; dist = camera distance from the Earth's centre in Earth radii (as before). Oblique when close.
  flyTo(lat, lon, dist = 1.9, ms = 1600) {
    const C = this.C;
    const h = Math.max(80, (dist - 1) * R_EARTH);
    const s0 = this.camera.position.clone().normalize();
    const ang = s0.angleTo(ll2v(lat, lon, 1));
    this.setOrbit(null);
    const pitch = h > 2.5e6 ? -Math.PI / 2 : h > 4e5 ? -1.2 : h > 3e4 ? -0.85 : -0.6;
    this._flying = true;
    const done = () => (this._flying = false);
    this.scene.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat, 0), 1), {
      offset: new C.HeadingPitchRange(0, pitch, h),
      duration: this.reducedMotion ? 0 : Math.max(0.2, ms / 1000),
      easingFunction: C.EasingFunction.CUBIC_IN_OUT,
      complete: done,
      cancel: done,
    });
    this.fx.caPulse = Math.min(1, 0.3 + ang);
    if (this.onFly) this.onFly(ang);
  }
  // slow cinematic orbit around a target (tour); any user input stops it
  setOrbit(lat, lon) {
    const C = this.C,
      cam = this.scene.camera;
    if (lat == null) {
      if (this.orbit) cam.lookAtTransform(C.Matrix4.IDENTITY);
      this.orbit = null;
      return;
    }
    const target = C.Cartesian3.fromDegrees(lon, lat, 0);
    const range = C.Cartesian3.distance(cam.positionWC, target);
    this.orbit = { target, heading: cam.heading, pitch: Math.max(-Math.PI / 2 + 0.01, cam.pitch), range, speed: 0.05 };
  }
  setPostFX(on) {
    const C = this.C;
    this.fx.on = !!on;
    const st = this.scene.postProcessStages;
    if (on && !this.lens) {
      this.lens = st.add(
        new C.PostProcessStage({
          fragmentShader: LENS_FS,
          uniforms: {
            time: () => this.time,
            ca: () => (this.fx.caEnabled === false ? 0 : this.fx.ca + this.fx.caPulse * 1.6),
            bloom: () => this.fx.bloom,
          },
        }),
      );
    }
    if (this.lens) this.lens.enabled = !!on;
    st.bloom.enabled = false;
    st.fxaa.enabled = true;
  }
  // keep the globe centred in the area not covered by docked panels: widen/shift the canvas instead of skewing the
  // projection (Cesium's multi-frustum rendering does not support an off-centre frustum reliably)
  setCenterShift(px) {
    this.centerShift = px;
    this.resize();
  }
  resize() {
    const s = Math.round(this.centerShift || 0);
    const st = this.host.style;
    st.left = (s < 0 ? 2 * s : 0) + 'px';
    st.width = `calc(100vw + ${Math.abs(2 * s)}px)`;
    this.w.resize();
  }
  _watchDpr() {
    const dpr = window.devicePixelRatio || 1;
    const mq = window.matchMedia?.(`(resolution: ${dpr}dppx)`);
    if (!mq) return;
    mq.addEventListener(
      'change',
      () => {
        const auto = this._pr === Math.min(2, dpr);
        if (auto) this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        else this.renderer.setPixelRatio(this._pr);
        this._watchDpr();
      },
      { once: true },
    );
  }
  update(dt) {
    const C = this.C,
      cam = this.scene.camera;
    this.time += dt;
    this.earthU.time.value = this.time;
    const p = this.camera.position;
    if ((!this._lastPos || !p.equals(this._lastPos)) && !this._flying && !this.orbit) this._setFromApp(p);
    if (this.orbit && !this._flying) {
      const o = this.orbit;
      o.heading += dt * o.speed;
      o.pitch += (-1.0 - o.pitch) * Math.min(1, dt * 0.35);
      cam.lookAt(o.target, new C.HeadingPitchRange(o.heading, o.pitch, o.range));
    }
    this.fx.caPulse = Math.max(0, this.fx.caPulse - dt * 0.9);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / 2.2;
      r.b.width = r.b.height = 10 + k * 110;
      const c = r.b.color.clone();
      c.alpha = Math.max(0, 0.9 * (1 - k));
      r.b.color = c;
      if (k >= 1) {
        this.fxBillboards.remove(r.b);
        this.rings.splice(i, 1);
      }
    }
    this._appPos(p);
    (this._lastPos ||= new THREE.Vector3()).copy(p);
  }
  _applyEarthUniforms() {
    const U = this.earthU,
      A = this._applied,
      gl = this.scene.globe;
    const lit = U.lightingOn.value > 0.5;
    if (A.lighting !== lit) {
      A.lighting = lit;
      gl.enableLighting = lit;
      gl.dynamicAtmosphereLighting = lit;
      if (this._night) this._night.show = lit;
    }
    const gOn = U.glowOn.value > 0;
    if (A.glow !== gOn) {
      A.glow = gOn;
      this._idDirty = true;
    }
    if (A.hi !== U.hiId.value) {
      A.hi = U.hiId.value;
      this._idDirty = true;
    }
    // the night-lights layer is only meaningful while lighting is active (it would otherwise cover the day imagery)
    if (this._night) {
      const h = this.scene.camera.positionCartographic.height;
      const k = Math.max(
        0,
        Math.min(1, (h - gl.lightingFadeOutDistance) / (gl.lightingFadeInDistance - gl.lightingFadeOutDistance)),
      );
      this._night.alpha = k;
      this._night.show = lit && k > 0.001;
    }
    const now = performance.now();
    if (this._idDirty && now - (this._idT || 0) > 120) {
      this._idT = now;
      this._rebuildIdOverlay();
    }
  }
  // compare: Cesium renders once, so the B side is a split twin of each time-aware billboard layer (scene split)
  _syncCompare(sideHook) {
    const C = this.C;
    const on = this.compare.mode !== 'off' && !!sideHook;
    this.scene.splitPosition = this.compare.mode === 'split' ? 0.5 : this.compare.x;
    for (const L of Object.values(this.pointLayers)) {
      const ta = L.u.timeAware.value > 0.5;
      if (on && ta && !L.collB) {
        L.collB = this.scene.primitives.add(new C.BillboardCollection());
        L.bbsB = L.bbs.map((b, i) =>
          L.collB.add({
            position: b.position,
            image: shapeIcons()[L.shp[i]] || shapeIcons()[0],
            width: b.width,
            height: b.height,
            color: b.color,
            scaleByDistance: b.scaleByDistance,
            splitDirection: C.SplitDirection.RIGHT,
            id: b.id,
          }),
        );
        L.collB.show = L.coll.show;
        for (const b of L.bbs) b.splitDirection = C.SplitDirection.LEFT;
        L._dirty = true;
      } else if ((!on || !ta) && L.collB) {
        this.scene.primitives.remove(L.collB);
        L.collB = L.bbsB = null;
        L.curB = undefined;
        for (const b of L.bbs) b.splitDirection = C.SplitDirection.NONE;
        L._dirty = true;
      }
    }
    if (!on) return;
    sideHook('B');
    for (const L of Object.values(this.pointLayers)) if (L.collB) L.curB = L.u.cur.value;
    sideHook('A');
  }
  render(sideHook) {
    const now = performance.now();
    this._syncCompare(sideHook);
    for (const L of Object.values(this.pointLayers)) this._updatePoints(L, now);
    for (const L of Object.values(this.circleLayers)) this._updateCircles(L, now);
    for (const o of Object.values(this.lineLayers)) o._apply();
    this._applyEarthUniforms();
    this.w.resize();
    const t0 = performance.now();
    this.w.render();
    const dt = performance.now() - t0;
    if (DBG && dt > 400) console.info('[render] slow frame ms', dt | 0);
  }
  // project a lat/lon to CSS pixels relative to the canvas; null on the far side or behind the camera
  project(lat, lon, r = 1.004, v = new THREE.Vector3()) {
    ll2v(lat, lon, r, v);
    const cp = this.camera.position;
    if (v.x * (cp.x - v.x) + v.y * (cp.y - v.y) + v.z * (cp.z - v.z) < 0) return null;
    const C = this.C;
    const e = this._pe || (this._pe = new Float64Array(3));
    ecef0(lat, lon, e, 0);
    const w = (this._pw ||= new C.Cartesian3());
    w.x = e[0];
    w.y = e[1];
    w.z = e[2];
    const s = C.SceneTransforms.worldToWindowCoordinates(this.scene, w, this._ps || (this._ps = new C.Cartesian2()));
    return s ? { x: s.x, y: s.y } : null;
  }
  pickGlobe(x, y) {
    const C = this.C,
      cam = this.scene.camera;
    const sp = new C.Cartesian2(x, y);
    let c = null;
    const ray = cam.getPickRay(sp);
    if (ray && this.terrainId !== 'off') c = this.scene.globe.pick(ray, this.scene);
    if (!c) c = cam.pickEllipsoid(sp);
    if (!c) return null;
    const g = C.Cartographic.fromCartesian(c);
    return ll2v(g.latitude * D, g.longitude * D, 1);
  }
}
// wrapper so layers.js can keep toggling .visible and .material.opacity on line layers
class LineObj {
  constructor(globe, name, color, opacity) {
    this.g = globe;
    this.name = name;
    this.color = color;
    this._vis = true;
    this._op = opacity;
    this._dirty = false;
    this.prim = null;
    const self = this;
    this.material = {
      get opacity() {
        return self._op;
      },
      set opacity(a) {
        if (a !== self._op) {
          self._op = a;
          self._dirty = true;
        }
      },
    };
  }
  get visible() {
    return this._vis;
  }
  set visible(b) {
    this._vis = !!b;
    if (this.prim) this.prim.show = this._vis;
  }
  _apply() {
    if (!this._dirty || !this.prim || !this.prim.ready) return;
    this._dirty = false;
    const C = this.g.C;
    const a = this.prim.getGeometryInstanceAttributes(this.name);
    a.color = C.ColorGeometryInstanceAttribute.toValue(this.color.withAlpha(this._op), a.color);
  }
}
