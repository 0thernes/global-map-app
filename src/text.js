// Text helpers shared by the UI and the unit tests (pure: no DOM, no three.js).
/** Search key: lower case with diacritics removed, so "nurnberg" finds "Nürnberg" and "geipan" finds "GÉIPAN". */
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
// RFC 4180 quoting (comma, quote, CR or LF) plus OWASP CSV-injection hardening: third-party text that a spreadsheet
// would evaluate as a formula (leading =, +, -, @, tab or CR) gets a leading apostrophe. Plain numbers such as a
// negative longitude are not text and are left exactly as they are.
// numbers and our own ISO dates with a BCE minus ("-2560-01-01") are data, not formulas
const NUMERIC_OR_ISO = /^([+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?|-\d{4,6}(-\d\d){0,2})$/;
export function csvCell(v) {
  if (v == null) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s) && !NUMERIC_OR_ISO.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCSV(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
}
