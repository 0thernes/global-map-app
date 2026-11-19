// Clocks for the command bar (v1.4): UTC first, then US Pacific (the owner's zone). Pure formatting with Intl, so it
// is unit-tested (test/unit/clock.test.mjs); the DOM tick lives in src/ui/console.js.
export const PACIFIC = 'America/Los_Angeles';
const pad = (n) => String(n).padStart(2, '0');

export function utc(d, secs = true) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${secs ? ':' + pad(d.getUTCSeconds()) : ''}Z`;
}
const fmtCache = new Map();
function parts(d, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}
/** e.g. { time: '19:21:05', zone: 'PST', date: '2026-11-18' } */
export function zoned(d, tz = PACIFIC, secs = true) {
  const p = parts(d, tz);
  return {
    time: `${p.hour}:${p.minute}${secs ? ':' + p.second : ''}`,
    zone: p.timeZoneName || tz,
    date: `${p.year}-${p.month}-${p.day}`,
  };
}
/** Days between an ISO date/datetime and now, floored; null if unparseable. */
export function ageDays(iso, now = new Date()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 864e5)) : null;
}
