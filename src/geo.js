import * as THREE from 'three';
const D2R = Math.PI / 180;
// lon/lat -> xyz on a unit sphere consistent with THREE.SphereGeometry UVs (u=0 at lon -180)
export function ll2v(lat, lon, r = 1, out = new THREE.Vector3()) { const la = lat * D2R, lo = lon * D2R, c = Math.cos(la); return out.set(r * c * Math.cos(lo), r * Math.sin(la), -r * c * Math.sin(lo)); }
export function v2ll(v) { const r = v.length(); return { lat: Math.asin(v.y / r) / D2R, lon: Math.atan2(-v.z, v.x) / D2R }; }
// ---- calendar: integer day numbers relative to 1900-01-01 in the proleptic Gregorian calendar.
// Works for negative (astronomical) years, unlike JS Date. ISO year -2560 == 2561 BCE.
function daysFromCivil(y, m, d) { y -= m <= 2 ? 1 : 0; const era = Math.floor(y / 400); const yoe = y - era * 400; const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1; const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; return era * 146097 + doe - 719468; }
const E1900 = daysFromCivil(1900, 1, 1);
export function civil(day) { const z = Math.floor(day) + E1900 + 719468; const era = Math.floor(z / 146097); const doe = z - era * 146097; const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365); const y = yoe + era * 400; const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); const mp = Math.floor((5 * doy + 2) / 153); const d = doy - Math.floor((153 * mp + 2) / 5) + 1; const m = mp + (mp < 10 ? 3 : -9); return { y: y + (m <= 2 ? 1 : 0), m, d }; }
export const dayOf = (y, m = 1, d = 1) => daysFromCivil(y, m, d) - E1900;
export const DAYMIN = dayOf(-8000, 1, 1); // ~10,000 BP
export const DAY0 = 0;
export const NDAYS = dayOf(2026, 11, 11);
export function dateToDay(iso) {
  if (iso == null || iso === '') return NaN; const s = String(iso).trim();
  const m = s.match(/^([+-]?\d{1,6})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/); if (!m) return NaN;
  return dayOf(+m[1], m[2] ? +m[2] : 1, m[3] ? +m[3] : 1);
}
const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
export function dayToISO(day) { const c = civil(day); return (c.y < 0 ? '-' : '') + pad(c.y, 4) + '-' + pad(c.m) + '-' + pad(c.d); }
export function dayLabel(day) { const c = civil(day); if (c.y > 0) return dayToISO(day); return `${1 - c.y} BCE`; }
export function dayToDate(day) { const c = civil(day); const dt = new Date(Date.UTC(2000, c.m - 1, c.d)); dt.setUTCFullYear(c.y); return dt; }
export const yearOf = (day) => civil(day).y;
export function addMonths(day, k) { const c = civil(day); let m = c.m - 1 + k, y = c.y + Math.floor(m / 12); m = ((m % 12) + 12) % 12; return dayOf(y, m + 1, Math.min(c.d, 28)); }
export function addYears(day, k) { const c = civil(day); return dayOf(c.y + k, c.m, Math.min(c.d, 28)); }
// ---- nonlinear (segmented) timeline: slider position 0..1 <-> day
const SEG = [[0, dayOf(-8000)], [0.10, dayOf(1)], [0.18, dayOf(1500)], [0.26, dayOf(1900)], [1, NDAYS + 1]];
export function posToDay(p) { for (let i = 0; i < SEG.length - 1; i++) { const [p0, d0] = SEG[i], [p1, d1] = SEG[i + 1]; if (p <= p1) return d0 + (d1 - d0) * (p - p0) / (p1 - p0); } return NDAYS; }
export function dayToPos(d) { for (let i = 0; i < SEG.length - 1; i++) { const [p0, d0] = SEG[i], [p1, d1] = SEG[i + 1]; if (d <= d1) return p0 + (p1 - p0) * (d - d0) / (d1 - d0); } return 1; }
export const TL_SEGMENTS = SEG;
