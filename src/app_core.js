// Core state, data prep and layer registry shared by the UI modules.
import * as THREE from 'three';
import * as S from './stats.js';
import { ll2v, v2ll, DAY0, DAYMIN, NDAYS, dateToDay, dayToDate, dayToISO, dayLabel, civil, dayOf } from './geo.js';
import { loadLayer, hasLayer } from './loader.js';
export { THREE, S, ll2v, v2ll, DAY0, DAYMIN, NDAYS, dateToDay, dayToDate, dayToISO, dayLabel, civil, dayOf, loadLayer, hasLayer };

export const PALETTE = {
  'UAP case': '#38e8ff', 'CIT UFO sighting': '#8af6ff', 'UAP report (public database)': '#4f9dff', 'Nuclear-site incident': '#ffd23f', 'Wartime sighting': '#ff8c4a', 'Mass sighting': '#b98cff', 'Abduction': '#ff5fd2',
  'Animal mutilation': '#ff3b5c', 'Animal mutilation: cattle': '#ff4d6a', 'Animal mutilation: horse': '#ff7088', 'Animal mutilation: dog': '#ff92a8', 'Animal mutilation: wildlife': '#ffb3c6',
  'Human mutilation': '#ff1f1f', 'Missing person': '#6dff8e', 'USO (water)': '#3fd0ff', 'Satellite anomaly': '#c6ff4a',
};
export const CASE_CATS = Object.keys(PALETTE).filter((k) => !k.includes(':'));
export const UAP_TYPES = ['UAP case', 'CIT UFO sighting', 'UAP report (public database)', 'Nuclear-site incident', 'Wartime sighting', 'Mass sighting', 'Abduction', 'USO (water)'];
export function catColor(c, sub) {
  if (c === 'Animal mutilation' && sub) { const k = 'Animal mutilation: ' + String(sub).toLowerCase().split(/[\s/;,]/)[0]; if (PALETTE[k]) return PALETTE[k]; }
  return PALETTE[c] || (c && c.startsWith('Animal mutilation') ? PALETTE['Animal mutilation'] : '#d0d0d0');
}
export { GRADES, gradeClass, gradeColor } from './grades.js';
import { gradeClass } from './grades.js';
export const ERAS = [
  ['Deep past (before 3000 BCE)', -1e9, dayOf(-2999)], ['Ancient (3000 BCE - 500 CE)', dayOf(-2999), dayOf(500)], ['Medieval (500-1500)', dayOf(500), dayOf(1500)],
  ['Early modern (1500-1899)', dayOf(1500), dayOf(1900)], ['1900-1945', dayOf(1900), dayOf(1946)], ['1946-1989', dayOf(1946), dayOf(1990)], ['1990-2009', dayOf(1990), dayOf(2010)], ['2010-2026', dayOf(2010), 1e9],
];
export const eraOf = (d) => (isFinite(d) ? (ERAS.find((e) => d >= e[1] && d < e[2]) || [''])[0] : 'Undated');
export const SPECIAL_AREAS = ['Ocean/International waters', 'Antarctica', 'Space'];
export const PRECISE = (c) => c.coord_precision === 'exact_site' || c.coord_precision === 'within_1km';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export const fmt = (n) => (n == null || n === '' || isNaN(n) ? '' : Math.round(n).toLocaleString('en-US'));
// only http(s)/mailto become links (no javascript:/data: URLs from data files); anything else is shown as text
export const link = (u, t) => (!u ? '' : /^(https?:|mailto:)/i.test(String(u).trim()) ? `<a href="${esc(String(u).trim())}" target="_blank" rel="noopener noreferrer">${esc(t || u)}</a>` : esc(t || u));
export const row = (k, v) => (v === undefined || v === null || v === '' ? '' : `<tr><th>${esc(k)}</th><td>${v}</td></tr>`);
export const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

export const st = {
  cur: NDAYS, curB: dateToDay('1975-01-01'), playing: false, speed: 30, hour: 12, mode: 0, fade: 365,
  f: { cats: new Set(), grades: new Set(), eras: new Set(), countries: new Set(), range: null, lasso: null, prec: new Set(), q: '', catOff: new Set(), subOff: new Set(), water: null, verify: false, conflictOnly: false, datasets: new Set() },
  exactOnly: true, coWin: 365, coKm: 500, autoRotate: false, nucTime: true, gedHistory: true, clustering: true, lighting: true,
  conf: { types: new Set(['interstate', 'civil', 'civil (internationalized)', 'extra-state', 'genocide']), minDeaths: 0, metric: 'deaths_high', datasets: new Set(['UCDP', 'COW', 'Genocide (recognized sources)', 'QWM']) },
  selected: null, notes: '', pinned: new Set(),
};
export const ctx = { globe: null, labels: null, cases: [], refs: {}, layers: [], idmap: null, countries: null, casePts: null, circ: null, countryByIso: {}, countryByIso2: {}, countryById: {}, hooks: {}, bus: new EventTarget() };
window.GMAPP = { st, ctx };
export const emit = (type, detail) => ctx.bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => ctx.bus.addEventListener(type, (e) => fn(e.detail));

export function L(id, name, kind, extra = {}) { return { id, name, kind, on: false, opacity: 1, side: 'both', loaded: false, ...extra }; }
export const layerById = (id) => ctx.layers.find((l) => l.id === id);

// ---- cases ----
const STOP = new Set('the and with from that this were their there which into over near after before about while when what where object objects lights light report reports reported later official officials police military witnesses witness craft case cases said says also only than more most some other second first three during under unknown'.split(' '));
export function witnessNames(c) {
  const out = new Set(); for (const m of (c.witnesses || '').matchAll(/\b((?:[A-Z][a-z]+\.?\s){0,2}[A-Z][a-z]+(?:\s[A-Z]\.)?\s[A-Z][A-Za-z'-]{2,})\b/g)) { const n = m[1].replace(/^(Lt|Col|Cpl|Capt|Dr|Sgt|Maj|Gen|BG|Officer|Army|Navy|Rep|Sen)\.?\s/, '').trim(); if (n.split(' ').length >= 2) out.add(n); }
  return [...out];
}
// Alex's rule: material from Steven Greer or Jaime Maussan carries zero weight (rows stay visible; scoring ignores them)
export const ZERO_W = /\b(steven\s+greer|dr\.?\s*greer|jaime\s+maussan|maussan)\b/i;
export function prepCases(raw) {
  return raw.map((c, i) => {
    const text = `${c.name} ${c.summary || c.description || ''}`;
    const w = new Set(); for (const m of text.matchAll(/[A-Za-z][A-Za-z'-]{4,}/g)) { const t = m[0].toLowerCase(); if (!STOP.has(t)) w.add(t); }
    const people = witnessNames(c); const wit = new Set(people.map((p) => p.split(' ').pop().toLowerCase()));
    const d = dateToDay(c.date), lo = dateToDay(c.date_low), hi = dateToDay(c.date_high);
    const gc = gradeClass(c.grade);
    const links = String(c.linked_case || '').split(/[;|,\s]+/).filter(Boolean);
    return { ...c, _i: i, _day: d, _lo: isFinite(lo) ? lo : d, _hi: isFinite(hi) ? hi : d, _era: eraOf(d), _gc: gc, _r: +c.coord_radius_km || 10, _toks: { w, wit }, _people: people, _dom: domain(c.source_url), _links: links,
      _area: c.country_display || c.country || '', _zero: ZERO_W.test(`${c.name} ${c.summary || ''} ${c.source_title || ''} ${c.source_url || ''} ${c.witnesses || ''}`), _search: [c.name, c.place, c.summary, c.description, c.witnesses, c.country, c.admin1, c.locality, c.subtype, c.notes, c.id].join(' ').toLowerCase() };
  });
}
export function caseVisibleF(c, f = st.f) {
  if (f.cats.size && !f.cats.has(c.category)) return false;
  if (f.grades.size && !f.grades.has(c._gc)) return false;
  if (f.eras.size && !f.eras.has(c._era)) return false;
  if (f.countries.size && !f.countries.has(c._area)) return false;
  if (f.prec.size && !f.prec.has(c.coord_precision)) return false;
  if (f.range && (c._hi < f.range[0] || c._lo > f.range[1])) return false;
  if (f.lasso && !f.lasso.has(c._i)) return false;
  if (f.q && !c._search.includes(f.q)) return false;
  if (f.catOff && f.catOff.size && f.catOff.has(c.category)) return false;
  if (f.subOff && f.subOff.size && f.subOff.has(c.category + '|' + caseSub(c))) return false;
  if (f.water != null && !(c.over_water || (c.shore_km != null && c.shore_km <= f.water))) return false;
  if (f.conflictOnly && !(c.conflicts && c.conflicts.length)) return false;
  if (f.verify && !c.verify) return false;
  if (f.datasets && f.datasets.size && !f.datasets.has(c.dataset || c.layer || '')) return false;
  return true;
}
export { caseSub } from './taxonomy.js';
import { caseSub } from './taxonomy.js';
export const appeared = (c, cur = st.cur) => c._day <= cur;
export const filteredCases = (cur = st.cur) => ctx.cases.filter((c) => caseVisibleF(c) && appeared(c, cur));

export function countryIdAt(lat, lon) { const m = ctx.idmap; if (!m) return 0; const x = Math.min(m.w - 1, Math.floor((lon + 180) / 360 * m.w)), y = Math.min(m.h - 1, Math.floor((90 - lat) / 180 * m.h)); const i = (y * m.w + x) * 4; return m.d[i] + m.d[i + 1] * 256; }
export const isLand = (lat, lon) => countryIdAt(lat, lon) > 0;
export function setStatus(s) { const e = $('#status'); if (e) e.textContent = s; }
export function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export function toCSV(rows, cols) { const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n'); }
export const COMMON = 'id,name,date,date_precision,date_low,date_high,date_disputed,lat,lon,coord_precision,coord_source,continent,country_iso,country,admin1,admin2,locality,postal_code,urban_rural,category,subtype,count,summary,source_title,source_url,source_type,dataset,grade,witness_count,nearest_military_site_km,nearest_nuclear_site_km,linked_case,notes'.split(',');
