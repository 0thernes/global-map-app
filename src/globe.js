import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ll2v } from './geo.js';
import { subsolar } from './sun.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// final cinematic pass: vignette + film grain + chromatic aberration (CA ramps up only during camera transitions)
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.35 }, grain: { value: 0.035 }, ca: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, ca; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){ vec2 d=vUv-0.5; float r2=dot(d,d); vec2 off=d*ca*0.012*(0.4+r2*2.0);
    vec3 c=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
    c*=1.0-vignette*smoothstep(0.12,0.62,r2*1.6);
    c+=(h(vUv*vec2(1733.0,977.0)+fract(time*7.13))-0.5)*grain;
    gl_FragColor=vec4(c,1.0); }`,
};

const earthVS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
void main(){ vUv=uv; vN=normalize(normal); vPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.0); }`;
const earthFS = `
precision highp float;
uniform sampler2D dayTex, nightTex, specTex, bumpTex, idTex, glowTex;
uniform vec3 sunDir; uniform vec3 camPos; uniform float time; uniform float bumpScale; uniform vec2 bumpTexel;
uniform float glowOn; uniform vec3 glowColor; uniform float hiId; uniform float nightGain; uniform float dayGain; uniform float lightingOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
void main(){
  vec3 n=normalize(vN);
  // bump: gradient of elevation in texture space mapped to east/north tangents
  float h0=texture2D(bumpTex,vUv).r, hx=texture2D(bumpTex,vUv+vec2(bumpTexel.x,0.)).r, hy=texture2D(bumpTex,vUv+vec2(0.,bumpTexel.y)).r;
  vec3 east=normalize(cross(vec3(0.,1.,0.),n)+vec3(1e-5)); vec3 north=normalize(cross(n,east));
  vec3 nb=normalize(n - bumpScale*((hx-h0)*east + (hy-h0)*north));
  vec3 V=normalize(camPos-vPos);
  float ndl=dot(n,sunDir);
  float dif=max(dot(nb,sunDir),0.0);
  float dayMix=smoothstep(-0.12,0.18,ndl);
  if(lightingOn<0.5){ dayMix=1.0; dif=0.85; }
  vec3 day=texture2D(dayTex,vUv).rgb*dayGain;
  vec3 night=texture2D(nightTex,vUv).rgb;
  night=pow(night,vec3(1.4))*nightGain*vec3(1.0,0.85,0.6)*1.6;
  float water=texture2D(specTex,vUv).r;
  vec3 H=normalize(sunDir+V); float spec=pow(max(dot(nb,H),0.0),60.0)*water*0.55*step(0.0,ndl);
  vec3 col=mix(night, day*(0.12+0.95*dif), dayMix) + vec3(0.9,0.85,0.7)*spec*dayMix;
  // twilight tint
  col+=vec3(0.35,0.12,0.02)*exp(-pow(ndl*9.0,2.0))*0.25;
  // rim / atmosphere scattering on the disc
  float fres=pow(1.0-max(dot(n,V),0.0),3.0);
  col+=vec3(0.25,0.55,1.0)*fres*(0.25+0.75*smoothstep(-0.2,0.5,ndl));
  // country id highlights (conflict glow + hover)
  vec4 idc=texture2D(idTex,vUv); float id=floor(idc.r*255.0+0.5)+floor(idc.g*255.0+0.5)*256.0;
  if(id>0.5){
    float g=texture2D(glowTex,vec2((id+0.5)/512.0,0.5)).r*glowOn;
    float pulse=0.75+0.25*sin(time*2.4+id);
    col=mix(col, col+glowColor*0.75, clamp(g*pulse,0.0,1.0)*0.7);
    if(abs(id-hiId)<0.5) col+=vec3(0.05,0.18,0.25);
  }
  gl_FragColor=vec4(col,1.0);
}`;
const atmoVS = `varying vec3 vN; varying vec3 vPos; void main(){ vN=normalize(normal); vPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.0);} `;
const atmoFS = `uniform vec3 sunDir; uniform vec3 camPos; varying vec3 vN; varying vec3 vPos;
void main(){ vec3 V=normalize(camPos-vPos); float f=pow(clamp(1.0+dot(V,vN)*1.0,0.0,1.0),0.0); float rim=dot(-V,vN);
 float a=pow(clamp(rim,0.0,1.0),2.4); float lit=0.35+0.65*smoothstep(-0.35,0.45,dot(normalize(vPos),sunDir));
 gl_FragColor=vec4(vec3(0.3,0.6,1.0)*lit, a*0.95*lit); }`;

const ptsVS = `
attribute vec3 color; attribute float size; attribute float t0; attribute float t1; attribute float vis; attribute float shape;
uniform float cur; uniform float fade; uniform float mode; uniform float pxScale; uniform float flash; uniform float history; uniform float timeAware;
uniform vec3 camPos;
varying vec3 vCol; varying float vA; varying float vFlash; varying float vShape;
void main(){
  vShape=shape;
  vec4 wp=modelMatrix*vec4(position,1.0);
  float a=vis;
  float fl=0.0;
  if(timeAware>0.5){
    if(cur<t0) a=0.0;
    else if(mode<0.5){ float k=clamp((cur-t0)/max(fade,0.001),0.0,1.0); a*=mix(0.0,1.0,k); fl=1.0-k; }
    else { float dt=cur-t0; float k=exp(-dt/max(flash,0.001)); a*=max(k,history); fl=k; }
    if(cur>t1) a*=0.25;
  }
  vec3 n=normalize(wp.xyz); vec3 V=normalize(camPos-wp.xyz);
  float facing=dot(n,V); if(facing< -0.05) a=0.0;
  vCol=color; vA=a; vFlash=fl;
  vec4 mv=viewMatrix*wp; gl_Position=projectionMatrix*mv;
  gl_PointSize=size*pxScale*(1.0+fl*1.5)/max(0.35,-mv.z*0.6);
  if(a<=0.001) gl_PointSize=0.0;
}`;
const ptsFS = `
uniform float opacity; uniform float time; varying vec3 vCol; varying float vA; varying float vFlash; varying float vShape;
float hash(float n){ return fract(sin(n)*43758.5453); }
void main(){ vec2 c=gl_PointCoord-0.5; float r=length(c)*2.0; if(r>1.0) discard;
 vec3 col; float a;
 if(vShape<0.5){ // glow marker
   float core=smoothstep(0.42,0.18,r); float glow=pow(1.0-r,2.0);
   col=mix(vCol*1.2,vec3(1.0),core*0.55+vFlash*0.4); a=core*0.95+glow*0.6;
 } else if(vShape<1.5){ // sharp pin (exact_site / within_1km): crisp ring + white core + crosshair ticks
   float ring=smoothstep(0.10,0.0,abs(r-0.72)); float core=smoothstep(0.30,0.2,r);
   float tick=(abs(c.x)<0.035||abs(c.y)<0.035)?step(0.78,r)*step(r,1.0):0.0;
   col=mix(vCol,vec3(1.0),core*0.8+vFlash*0.4); a=max(max(ring,core),tick)+vFlash*0.3;
 } else if(vShape<2.5){ // faint centre dot for imprecise points (the circle carries the uncertainty)
   float core=smoothstep(0.5,0.2,r); col=mix(vCol,vec3(1.0),0.3+vFlash*0.4); a=core*0.7+vFlash*0.4;
 } else { // glitch: RGB split + flicker (weird coordinates)
   float t=floor(time*12.0); float jit=(hash(t+vCol.r*91.0)-0.5)*0.18;
   float rr=smoothstep(0.55,0.3,length(c+vec2(0.12+jit,0.0))*2.0);
   float gg=smoothstep(0.55,0.3,length(c)*2.0);
   float bb=smoothstep(0.55,0.3,length(c-vec2(0.12-jit,0.0))*2.0);
   float scan=0.75+0.25*step(0.5,fract(gl_PointCoord.y*6.0+time*3.0));
   float flick=0.55+0.45*step(0.25,hash(t*1.7+vCol.g*13.0));
   col=vec3(rr,gg*0.9+0.1*vCol.g,bb)*1.3; a=max(rr,max(gg,bb))*scan*flick;
 }
 gl_FragColor=vec4(col,a*vA*opacity); }`;

const circVS = `
attribute vec3 iColor; attribute float iT0; attribute float iVis;
uniform float cur; uniform float fade; uniform float timeAware; uniform vec3 camPos;
varying vec3 vCol; varying float vA; varying vec2 vUv;
void main(){
  vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);
  float a=iVis; if(timeAware>0.5 && cur<iT0) a=0.0;
  vec3 c=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz; if(dot(normalize(c),normalize(camPos-c))<-0.05) a=0.0;
  vCol=iColor; vA=a; vUv=uv; gl_Position=projectionMatrix*viewMatrix*wp; }`;
const circFS = `
uniform float opacity; varying vec3 vCol; varying float vA; varying vec2 vUv;
void main(){ float r=length(vUv-0.5)*2.0; if(r>1.0||vA<0.001) discard;
  float edge=smoothstep(0.86,0.97,r)*smoothstep(1.0,0.97,r); float fill=0.16*(1.0-r*0.4);
  gl_FragColor=vec4(vCol,(fill+edge*0.7)*vA*opacity); }`;

export class Globe {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false, logarithmicDepthBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x01030a);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.001, 200); this.camera.position.set(0.8, 1.2, 3.6);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.06, rotateSpeed: 0.45, zoomSpeed: 0.8, minDistance: 1.012, maxDistance: 9, enablePan: false });
    this.lineLayers = {}; this.pointLayers = {}; this.time = 0;
    this.compare = { mode: 'off', x: 0.5 };
    this.fx = { on: false, bloom: 0.55, ca: 0, caPulse: 0 }; this.orbit = null; this.onFly = null;
    this.sunDir = new THREE.Vector3(1, 0, 0);
    this._buildEarth(); this._buildAtmo(); this._buildStars();
    this.rings = []; this.ringGroup = new THREE.Group(); this.scene.add(this.ringGroup);
    this.arcGroup = new THREE.Group(); this.scene.add(this.arcGroup);
    this.overlayGroup = new THREE.Group(); this.scene.add(this.overlayGroup);
    this.resize();
  }
  _buildEarth() {
    const ph = new THREE.DataTexture(new Uint8Array([10, 20, 40, 255]), 1, 1); ph.needsUpdate = true;
    const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
    this.glowData = new Uint8Array(512 * 4); this.glowTex = new THREE.DataTexture(this.glowData, 512, 1); this.glowTex.needsUpdate = true;
    this.glowTex.magFilter = this.glowTex.minFilter = THREE.NearestFilter;
    this.earthU = {
      dayTex: { value: ph }, nightTex: { value: black }, specTex: { value: black }, bumpTex: { value: black }, idTex: { value: black }, glowTex: { value: this.glowTex },
      sunDir: { value: this.sunDir }, camPos: { value: this.camera.position }, time: { value: 0 }, bumpScale: { value: 2.0 }, bumpTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
      glowOn: { value: 1 }, glowColor: { value: new THREE.Color(1.0, 0.25, 0.08) }, hiId: { value: -1 }, nightGain: { value: 1.0 }, dayGain: { value: 1.0 }, lightingOn: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: earthFS, uniforms: this.earthU });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), mat); this.earth.renderOrder = 0;
    this.scene.add(this.earth);
  }
  setTexture(slot, uri, opts = {}) {
    return new Promise((res) => {
      new THREE.TextureLoader().load(uri, (t) => {
        if (opts.srgb !== false && (slot === 'dayTex' || slot === 'nightTex')) t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        if (opts.nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
        const old = this.earthU[slot].value; this.earthU[slot].value = t; if (old && old.dispose) old.dispose();
        if (slot === 'bumpTex') this.earthU.bumpTexel.value.set(1 / t.image.width, 1 / t.image.height);
        res(t);
      });
    });
  }
  _buildAtmo() {
    this.atmoU = { sunDir: { value: this.sunDir }, camPos: { value: this.camera.position } };
    const m = new THREE.ShaderMaterial({ vertexShader: atmoVS, fragmentShader: atmoFS, uniforms: this.atmoU, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), m); this.scene.add(this.atmo);
  }
  _buildStars() { // decorative background only (procedural, not data)
    const n = 6000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, d = 60 + r() * 30, c = Math.sqrt(1 - u * u);
      pos.set([d * c * Math.cos(th), d * u, d * c * Math.sin(th)], i * 3); const w = 0.55 + r() * 0.45, t = r(); col.set([w * (0.8 + 0.2 * t), w * 0.9, w * (1.0 - 0.2 * t)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
    this.scene.add(this.stars);
  }
  setDate(date) { const s = subsolar(date); ll2v(s.lat, s.lon, 1, this.sunDir).normalize(); this.subsolar = s; }
  // ---- line layers ----
  addLines(name, payload, { color = 0x88ccff, opacity = 0.5, radius = 1.0015, order = 1, filter = null } = {}) {
    const q = payload.q || 1000; const segs = []; const v = new THREE.Vector3();
    payload.lines.forEach((l, li) => {
      if (filter && !filter(li)) return;
      for (let i = 0; i + 3 < l.length; i += 2) {
        ll2v(l[i + 1] / q, l[i] / q, radius, v); segs.push(v.x, v.y, v.z); ll2v(l[i + 3] / q, l[i + 2] / q, radius, v); segs.push(v.x, v.y, v.z);
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const obj = new THREE.LineSegments(g, m); obj.renderOrder = order; this.scene.add(obj);
    this.lineLayers[name] = obj; return obj;
  }
  // ---- point layers ----
  addPoints(name, items, { colorFn, sizeFn = () => 6, t0Fn = null, t1Fn = null, shapeFn = null, radius = 1.004, order = 5, mode = 0, timeAware = false, opacity = 1 } = {}) {
    if (this.pointLayers[name]) this.removePoints(name);
    const n = items.length; const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), t0 = new Float32Array(n), t1 = new Float32Array(n), vis = new Float32Array(n).fill(1), shp = new Float32Array(n);
    const v = new THREE.Vector3(), c = new THREE.Color();
    items.forEach((it, i) => { ll2v(it.lat, it.lon, radius, v); pos.set([v.x, v.y, v.z], i * 3); c.set(colorFn(it)); col.set([c.r, c.g, c.b], i * 3); size[i] = sizeFn(it); t0[i] = t0Fn ? t0Fn(it) : -1e9; { const a0 = t0Fn ? t0Fn(it) : -1e9, a1 = t1Fn ? t1Fn(it) : 1e12; t0[i] = isFinite(a0) ? a0 : -1e9; t1[i] = isFinite(a1) ? a1 : 1e12; } shp[i] = shapeFn ? shapeFn(it) : 0; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('t0', new THREE.BufferAttribute(t0, 1)); g.setAttribute('t1', new THREE.BufferAttribute(t1, 1)); g.setAttribute('vis', new THREE.BufferAttribute(vis, 1)); g.setAttribute('shape', new THREE.BufferAttribute(shp, 1));
    const u = { cur: { value: 0 }, fade: { value: 180 }, mode: { value: mode }, pxScale: { value: this.renderer.getPixelRatio() }, flash: { value: 30 }, history: { value: 0.0 }, timeAware: { value: timeAware ? 1 : 0 }, opacity: { value: opacity }, camPos: { value: this.camera.position }, time: this.earthU.time };
    const m = new THREE.ShaderMaterial({ vertexShader: ptsVS, fragmentShader: ptsFS, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const obj = new THREE.Points(g, m); obj.renderOrder = order; obj.frustumCulled = false; this.scene.add(obj);
    const L = { obj, items, u, pos, vis, radius }; this.pointLayers[name] = L; return L;
  }
  removePoints(name) { const L = this.pointLayers[name]; if (!L) return; this.scene.remove(L.obj); L.obj.geometry.dispose(); L.obj.material.dispose(); delete this.pointLayers[name]; }
  // geodesic uncertainty circles (instanced discs tangent to the sphere; radius in km). Never a pin.
  addCircles(name, items, { colorFn, radiusKmFn, t0Fn = null, timeAware = true, opacity = 0.9 } = {}) {
    if (this.circleLayers && this.circleLayers[name]) { const o = this.circleLayers[name]; this.scene.remove(o.obj); o.obj.geometry.dispose(); o.obj.material.dispose(); }
    this.circleLayers = this.circleLayers || {};
    const n = Math.max(1, items.length); const geo = new THREE.CircleGeometry(1, 64);
    const col = new Float32Array(n * 3), t0 = new Float32Array(n), vis = new Float32Array(n);
    geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(col, 3)); geo.setAttribute('iT0', new THREE.InstancedBufferAttribute(t0, 1)); geo.setAttribute('iVis', new THREE.InstancedBufferAttribute(vis, 1));
    const u = { cur: { value: 0 }, fade: { value: 0 }, timeAware: { value: timeAware ? 1 : 0 }, opacity: { value: opacity }, camPos: { value: this.camera.position } };
    const m = new THREE.ShaderMaterial({ vertexShader: circVS, fragmentShader: circFS, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const obj = new THREE.InstancedMesh(geo, m, n); obj.frustumCulled = false; obj.renderOrder = 4;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3(), c = new THREE.Color(), v = new THREE.Vector3();
    items.forEach((it, i) => {
      ll2v(it.lat, it.lon, 1.0018, v); q.setFromUnitVectors(z, v.clone().normalize()); const r = Math.max(0.05, radiusKmFn(it)) / 6371.0088; sc.set(r, r, r);
      M.compose(v, q, sc); obj.setMatrixAt(i, M); c.set(colorFn(it)); col.set([c.r, c.g, c.b], i * 3); t0[i] = t0Fn ? t0Fn(it) : -1e9; vis[i] = 1;
    });
    if (!items.length) obj.count = 0;
    obj.instanceMatrix.needsUpdate = true; this.scene.add(obj);
    const L = { obj, items, u, vis, attr: geo.attributes.iVis }; this.circleLayers[name] = L; return L;
  }
  setCircleVis(L, fn) { for (let i = 0; i < L.items.length; i++) L.vis[i] = fn(L.items[i], i) ? 1 : 0; L.attr.needsUpdate = true; }
  setVis(L, fn) { const a = L.obj.geometry.attributes.vis; for (let i = 0; i < L.items.length; i++) a.array[i] = fn(L.items[i], i) ? 1 : 0; a.needsUpdate = true; }
  // ---- effects ----
  pulse(lat, lon, color) {
    const v = ll2v(lat, lon, 1.003); const geo = new THREE.RingGeometry(0.8, 1.0, 48);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(geo, m); ring.position.copy(v); ring.lookAt(v.clone().multiplyScalar(2)); ring.scale.setScalar(0.002);
    // particle trail: a short beam of particles rising from the surface
    const np = 24, pp = new Float32Array(np * 3); const nrm = v.clone().normalize();
    for (let i = 0; i < np; i++) { const h = 1.003 + i * 0.0025; pp.set([nrm.x * h, nrm.y * h, nrm.z * h], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const beam = new THREE.Points(pg, new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ringGroup.add(ring); this.ringGroup.add(beam); this.rings.push({ ring, beam, t: 0 });
    if (this.rings.length > 80) { const r = this.rings.shift(); this._killRing(r); }
  }
  _killRing(r) { this.ringGroup.remove(r.ring); this.ringGroup.remove(r.beam); r.ring.geometry.dispose(); r.ring.material.dispose(); r.beam.geometry.dispose(); r.beam.material.dispose(); }
  clearArcs() { while (this.arcGroup.children.length) { const c = this.arcGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); } }
  addArc(a, b, color = 0xffe066, opacity = 0.9) {
    const va = ll2v(a.lat, a.lon, 1), vb = ll2v(b.lat, b.lon, 1); const ang = va.angleTo(vb); const pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48; const v = new THREE.Vector3().copy(va).lerp(vb, t).normalize(); v.multiplyScalar(1.003 + Math.sin(Math.PI * t) * Math.min(0.25, 0.05 + ang * 0.35)); pts.push(v); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); l.renderOrder = 20; this.arcGroup.add(l);
  }
  setOverlayTexture(canvas, opacity = 0.85) {
    if (!this.overlay) {
      this.overlayTex = new THREE.CanvasTexture(canvas); this.overlayTex.colorSpace = THREE.NoColorSpace;
      this.overlay = new THREE.Mesh(new THREE.SphereGeometry(1.0025, 128, 96), new THREE.MeshBasicMaterial({ map: this.overlayTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.overlay.renderOrder = 3; this.overlayGroup.add(this.overlay);
    } else { this.overlayTex.image = canvas; this.overlayTex.needsUpdate = true; this.overlay.material.opacity = opacity; }
    this.overlay.visible = true;
  }
  // static texture overlays (e.g. GEBCO 'never directly measured' mask), equirectangular, drawn just above the surface
  addTexOverlay(name, image, opacity = 0.8) {
    const t = new THREE.Texture(image); t.needsUpdate = true; t.colorSpace = THREE.NoColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 160, 120), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false }));
    m.renderOrder = 2; this.overlayGroup.add(m); return m;
  }
  hideOverlay() { if (this.overlay) this.overlay.visible = false; }
  // eased great-circle fly-to: slerp the direction, raise the camera on an arc proportional to the angle travelled
  flyTo(lat, lon, dist = 1.9, ms = 1600) {
    const start = this.camera.position.clone(); const sd = start.length(); const end = ll2v(lat, lon, 1).normalize();
    const s0 = start.clone().normalize(); const ang = s0.angleTo(end);
    const q = new THREE.Quaternion().setFromUnitVectors(s0, end);
    const t0 = performance.now(); this._fly = { start: s0, end, q, ang, sd, ed: dist, t0, ms: ms * (this.reducedMotion ? 0.01 : 1) };
    this.orbit = null; this.fx.caPulse = Math.min(1, 0.3 + ang); if (this.onFly) this.onFly(ang);
  }
  setOrbit(lat, lon) { this.orbit = lat == null ? null : { axis: ll2v(lat, lon, 1).normalize(), speed: 0.18 }; }
  setPostFX(on) {
    this.fx.on = !!on;
    if (on && !this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
      rt.texture.colorSpace = THREE.SRGBColorSpace; // materials encode to sRGB as when drawing to the canvas, so FX on/off look alike
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), this.fx.bloom, 0.6, 0.72);
      this.composer.addPass(this.bloomPass);
      this.lensPass = new ShaderPass(LensShader); this.composer.addPass(this.lensPass);
      this.resize();
    }
  }
  // shift the projection centre (px) so the globe stays centred in the area not covered by docked panels
  setCenterShift(px) { this.centerShift = px; this.resize(); }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    if (this.centerShift) this.camera.setViewOffset(w, h, -this.centerShift, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    for (const k in this.pointLayers) this.pointLayers[k].u.pxScale.value = this.renderer.getPixelRatio() * Math.min(1.6, h / 700);
  }
  update(dt) {
    this.time += dt; this.earthU.time.value = this.time;
    if (this._fly) {
      const f = this._fly; let t = Math.min(1, (performance.now() - f.t0) / f.ms); const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const dir = f.start.clone().applyQuaternion(new THREE.Quaternion().slerp(f.q, e)).normalize();
      const lift = Math.sin(Math.PI * e) * Math.min(1.2, f.ang * 0.8);
      this.camera.position.copy(dir.multiplyScalar(f.sd + (f.ed - f.sd) * e + lift));
      if (t >= 1) this._fly = null;
    }
    if (this.orbit && !this._fly) this.camera.position.applyAxisAngle(this.orbit.axis, dt * this.orbit.speed);
    this.fx.caPulse = Math.max(0, this.fx.caPulse - dt * 0.9);
    this.controls.rotateSpeed = 0.45 * Math.min(1, (this.camera.position.length() - 1) * 1.2 + 0.02);
    this.controls.zoomSpeed = 0.8;
    this.controls.update();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / 2.2;
      r.ring.scale.setScalar(0.004 + k * 0.06); r.ring.material.opacity = Math.max(0, 0.9 * (1 - k));
      r.beam.material.opacity = Math.max(0, 0.9 * (1 - k)); r.beam.scale.setScalar(1 + k * 0.02);
      if (k >= 1) { this._killRing(r); this.rings.splice(i, 1); }
    }
  }
  render(sideHook) {
    const R = this.renderer, w = this.canvas.width, h = this.canvas.height;
    if (this.compare.mode === 'off' || !sideHook) {
      R.setScissorTest(false); R.setViewport(0, 0, w, h);
      if (this.fx.on && this.composer) {
        const u = this.lensPass.uniforms; u.time.value = this.time; u.ca.value = this.fx.caEnabled === false ? 0 : this.fx.ca + this.fx.caPulse * 1.6; this.bloomPass.strength = this.fx.bloom;
        this.composer.render();
      } else R.render(this.scene, this.camera);
      return;
    }
    const xs = Math.round(w * this.compare.x);
    R.setScissorTest(true);
    if (this.compare.mode === 'swipe') {
      sideHook('A'); R.setViewport(0, 0, w, h); R.setScissor(0, 0, xs, h); R.render(this.scene, this.camera);
      sideHook('B'); R.setScissor(xs, 0, w - xs, h); R.render(this.scene, this.camera);
    } else { // split: two synced half-width views
      const hw = Math.floor(w / 2); const asp = this.camera.aspect; this.camera.aspect = hw / h; this.camera.updateProjectionMatrix();
      sideHook('A'); R.setViewport(0, 0, hw, h); R.setScissor(0, 0, hw, h); R.render(this.scene, this.camera);
      sideHook('B'); R.setViewport(hw, 0, w - hw, h); R.setScissor(hw, 0, w - hw, h); R.render(this.scene, this.camera);
      this.camera.aspect = asp; this.camera.updateProjectionMatrix();
    }
    sideHook('A'); R.setScissorTest(false);
  }
  // project a lat/lon to CSS pixels; returns null if on the far side
  project(lat, lon, r = 1.004, v = new THREE.Vector3()) {
    ll2v(lat, lon, r, v); const cp = this.camera.position;
    if ((v.x * (cp.x - v.x) + v.y * (cp.y - v.y) + v.z * (cp.z - v.z)) < 0) return null;
    v.project(this.camera); const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }
  pickGlobe(x, y) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x / w * 2 - 1, -(y / h) * 2 + 1), this.camera);
    const hit = ray.intersectObject(this.earth)[0]; return hit ? hit.point : null;
  }
}
