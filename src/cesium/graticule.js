// Reference geometry for the globe (v1.5, ADR 0005): an adaptive latitude/longitude graticule, the solar terminator
// and the civil / nautical / astronomical twilight rings. Pure spherical maths with no Cesium or DOM, so it is
// unit-tested in Node (test/unit/graticule.test.mjs). Every point is [lat, lon] in degrees.
// None of this is data: it is drawn from the date and the camera, and it never moves or adds a case.
const D2R = Math.PI / 180;
export const R_KM = 6371.0088; // IUGG mean Earth radius

/** Graticule spacing in degrees for a camera height in metres: coarse from orbit, finer as you zoom in. */
export function graticuleStep(heightM) {
  if (!(heightM > 0)) return 30;
  if (heightM > 9e6) return 30;
  if (heightM > 4e6) return 15;
  if (heightM > 1.6e6) return 10;
  if (heightM > 6e5) return 5;
  if (heightM > 1.8e5) return 2;
  if (heightM > 6e4) return 1;
  if (heightM > 2e4) return 0.5;
  return 0.25;
}

const clampLat = (v) => Math.max(-90, Math.min(90, v));
/** Normalise a longitude into [-180, 180). */
export const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * Graticule polylines for one step. `bbox` = {west, south, east, north} in degrees (east < west when the view crosses
 * the antimeridian), or null for the whole globe. Lines are sampled every `sample` degrees so they follow the
 * curvature when drawn as straight segments. Meridians stop at +-85 deg (they converge at the poles).
 * Returns [{kind: 'meridian'|'parallel', value, major, pts: [[lat, lon], ...]}].
 */
export function graticuleLines(step, bbox = null, { sample = 2, maxLines = 400 } = {}) {
  const s = Math.max(0.01, step);
  const smp = Math.min(sample, s);
  let west = -180,
    east = 180,
    south = -90,
    north = 90;
  if (bbox) {
    west = bbox.west;
    east = bbox.east;
    south = clampLat(bbox.south);
    north = clampLat(bbox.north);
    if (east < west) east += 360; // crosses the antimeridian
  }
  const out = [];
  const isMajor = (v) => Math.abs(v) < 1e-9 || Math.abs(Math.abs(v) - 180) < 1e-9;
  // meridians
  const lat0 = Math.max(-85, south),
    lat1 = Math.min(85, north);
  for (let lon = Math.ceil(west / s) * s; lon <= east + 1e-9 && out.length < maxLines; lon += s) {
    if (bbox === null && lon >= 180 - 1e-9) break; // -180 and 180 are the same meridian
    const L = wrapLon(+lon.toFixed(6));
    const pts = [];
    for (let la = lat0; la < lat1; la += smp) pts.push([+la.toFixed(6), L]);
    pts.push([lat1, L]);
    out.push({ kind: 'meridian', value: L, major: isMajor(L), pts });
  }
  // parallels
  const lonSample = Math.min(smp, Math.max(0.05, (east - west) / 180));
  for (let la = Math.ceil(south / s) * s; la <= north + 1e-9 && out.length < maxLines * 2; la += s) {
    const v = +la.toFixed(6);
    if (Math.abs(v) >= 90) continue;
    const pts = [];
    for (let lo = west; lo < east; lo += lonSample) pts.push([v, wrapLon(+lo.toFixed(6))]);
    pts.push([v, wrapLon(east === 180 && west === -180 ? 180 : east)]);
    out.push({ kind: 'parallel', value: v, major: Math.abs(v) < 1e-9, pts });
  }
  return out;
}

/** Label text for a graticule value: 30°N, 0°, 45°W, 0.5°E (no trailing zeros). */
export function graticuleLabel(kind, v) {
  const a = Math.abs(v);
  const t = (a % 1 ? +a.toFixed(2) : a) + '°';
  if (a < 1e-9) return kind === 'parallel' ? '0° (Equator)' : '0° (Greenwich)';
  if (kind === 'meridian' && Math.abs(a - 180) < 1e-9) return '180°';
  return t + (kind === 'parallel' ? (v > 0 ? 'N' : 'S') : v > 0 ? 'E' : 'W');
}

/**
 * Small circle of angular radius `deg` around (lat0, lon0): the destination-point formula for every bearing.
 * n points, the first repeated at the end so the ring closes.
 */
export function smallCircle(lat0, lon0, deg, n = 128) {
  const p1 = lat0 * D2R,
    l1 = lon0 * D2R,
    d = deg * D2R;
  const sp = Math.sin(p1),
    cp = Math.cos(p1),
    sd = Math.sin(d),
    cd = Math.cos(d);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const th = ((i % n) / n) * 2 * Math.PI;
    const s2 = sp * cd + cp * sd * Math.cos(th);
    const p2 = Math.asin(Math.max(-1, Math.min(1, s2)));
    const l2 = l1 + Math.atan2(Math.sin(th) * sd * cp, cd - sp * s2);
    out.push([p2 / D2R, wrapLon(l2 / D2R)]);
  }
  return out;
}

/** Great-circle distance in degrees (haversine). */
export function angDeg(a, b) {
  const p1 = a[0] * D2R,
    p2 = b[0] * D2R,
    dp = p2 - p1,
    dl = (b[1] - a[1]) * D2R;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / D2R;
}

/**
 * Terminator and twilight rings around the sub-solar point (sun.js). The terminator is 90 deg from the sub-solar
 * point (geometric, no refraction); civil, nautical and astronomical twilight end where the Sun is 6, 12 and 18 deg
 * below the horizon, i.e. 96, 102 and 108 deg away.
 */
export const TWILIGHT = [
  { id: 'terminator', deg: 90, label: 'Terminator (sunrise / sunset line)' },
  { id: 'civil', deg: 96, label: 'Civil twilight ends (Sun 6° below the horizon)' },
  { id: 'nautical', deg: 102, label: 'Nautical twilight ends (Sun 12° below)' },
  { id: 'astronomical', deg: 108, label: 'Astronomical twilight ends (Sun 18° below)' },
];
export function terminatorRings(sub, n = 180) {
  return TWILIGHT.map((t) => ({ ...t, pts: smallCircle(sub.lat, sub.lon, t.deg, n) }));
}

/**
 * Dashed ring for an uncertainty circle: radius in km -> segment pairs [[a, b], ...] (every other chord of an
 * n-gon), so a locality / region circle reads as "somewhere in here" and never as a pin (ADR 0005 section 4).
 */
export function dashedRing(lat, lon, radiusKm, n = 48) {
  const pts = smallCircle(lat, lon, radiusKm / R_KM / D2R, n);
  const segs = [];
  for (let i = 0; i < n; i += 2) segs.push([pts[i], pts[i + 1]]);
  return segs;
}
