// Reference indexes (pure, no DOM): A-Z case index, site index, country index, sources index, and a shared search.
import { domainOf } from './report_gen.js';

const letterOf = (s) => {
  const ch = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
};
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' });

/** A-Z case index: [{letter, items:[{id,name,date,area}]}], letters in order, '#' last */
export function buildCaseIndex(cases) {
  const m = new Map();
  for (const c of cases) {
    if (!c || !c.name) continue;
    const L = letterOf(c.name);
    if (!m.has(L)) m.set(L, []);
    m.get(L).push({
      id: c.id,
      name: c.name,
      date: c.date || '',
      area: c._area || c.country_display || c.country || '',
    });
  }
  return [...m.entries()]
    .sort((a, b) => (a[0] === '#') - (b[0] === '#') || a[0].localeCompare(b[0]))
    .map(([letter, items]) => ({ letter, items: items.sort(byName) }));
}
/** site index over reference layers: [{layer, layerName, items:[{name, lat, lon, country}]}] */
export function buildSiteIndex(layers) {
  return layers
    .filter((l) => l.items && l.items.length)
    .map((l) => ({
      layer: l.id,
      layerName: l.name,
      items: l.items
        .filter((x) => x.name)
        .map((x) => ({
          name: x.name,
          lat: x.lat,
          lon: x.lon,
          country: x.country || x.country_display || '',
          url: x.source_url || x.url || '',
        }))
        .sort(byName),
    }));
}
/** country index: [{area, cases, grades:{CIT:..}, sites}] sorted by cases desc then name */
export function buildCountryIndex(cases, siteLayers = []) {
  const m = new Map();
  const get = (k) => {
    if (!m.has(k)) m.set(k, { area: k, cases: 0, grades: {}, sites: 0, first: null, last: null });
    return m.get(k);
  };
  for (const c of cases) {
    const k = c._area || c.country_display || c.country;
    if (!k) continue;
    const e = get(k);
    e.cases++;
    const g = c._gc || 'Other';
    e.grades[g] = (e.grades[g] || 0) + 1;
    if (c.date) {
      if (!e.first || c.date < e.first) e.first = c.date;
      if (!e.last || c.date > e.last) e.last = c.date;
    }
  }
  for (const l of siteLayers) for (const x of l.items || []) if (x.country) get(x.country).sites++;
  return [...m.values()].sort((a, b) => b.cases - a.cases || a.area.localeCompare(b.area));
}
/**
 * Sources index: every dataset/layer with licence + record count, and every source domain cited by case rows.
 * @param {{id:string,name:string,source?:string,license?:string,url?:string,count?:number}[]} datasets
 */
export function buildSourcesIndex(cases, datasets = []) {
  const dom = new Map();
  for (const c of cases) {
    const d = domainOf(c.source_url);
    if (!d) continue;
    const e = dom.get(d) || { domain: d, cases: 0, example: c.source_url };
    e.cases++;
    dom.set(d, e);
  }
  return {
    datasets: datasets.slice().sort((a, b) => a.name.localeCompare(b.name)),
    domains: [...dom.values()].sort((a, b) => b.cases - a.cases || a.domain.localeCompare(b.domain)),
  };
}
/** case-insensitive, accent-insensitive multi-term AND search over chosen string fields */
export function searchItems(items, q, fields) {
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return items;
  return items.filter((it) => {
    const hay = fields.map((f) => norm(it[f])).join(' ');
    return terms.every((t) => hay.includes(t));
  });
}
