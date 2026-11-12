// Sub-solar point (low-precision solar ephemeris, ~0.01 deg; adequate for a day/night terminator)
const D2R = Math.PI / 180;
export function subsolar(date) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const e = (23.439 - 0.00000036 * d) * D2R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24; // hours
  let lon = ra / D2R - gmst * 15;
  lon = ((lon + 540) % 360) - 180;
  return { lat: dec / D2R, lon };
}
