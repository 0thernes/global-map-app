// Coverage matrix (pure; used by the in-app Coverage panel and scripts/coverage.mjs -> docs/audit/coverage.md).
// Definitions: docs/audit/TAXONOMY.md.
//   BREADTH  how wide a node reaches: countries/areas covered (of 249 ISO 3166-1 + specials), decades covered,
//            categories and subtypes present, distinct sources.
//   DEPTH    how thorough its records are: field completeness, coordinate precision mix, grade presence and strength,
//            corroborating records per case (same_as), witness counts, source liveness (from the URL audit).
//   LAYERS OF LAYERS  domain > layer > sub-layer > subtype > record (> its sources / witnesses / linked cases).
import { gradeClass } from './grades.js';

export const ISO_TOTAL = 249;
export const CORE_FIELDS = [
  'name',
  'date',
  'lat',
  'lon',
  'coord_precision',
  'coord_source',
  'country',
  'category',
  'subtype',
  'summary',
  'source_url',
  'grade',
];
const GW = { CIT: 1, 'Official record': 0.8, ST: 0.6, Testimony: 0.3, 'Online claim': 0.1, Other: 0.2 };
const dom = (u) => {
  const m = /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(String(u || ''));
  return m ? m[1].toLowerCase() : '';
};
const decade = (iso) => {
  const m = /^(-?\d{1,6})/.exec(String(iso || ''));
  return m ? Math.floor(+m[1] / 10) * 10 : null;
};
const filled = (v) => v !== undefined && v !== null && v !== '';

/** @param {object[]} rows @param {{live?:Map<string,boolean>}} opt */
export function measure(rows, opt = {}) {
  const n = rows.length;
  const countries = new Set(),
    decades = new Set(),
    cats = new Set(),
    subs = new Set(),
    sources = new Set();
  let comp = 0,
    precise = 0,
    graded = 0,
    gsum = 0,
    corro = 0,
    wit = 0,
    urls = 0,
    live = 0;
  for (const r of rows) {
    const c = r.country_iso || r._area || r.country_display || r.country;
    if (c) countries.add(c);
    const d = decade(r.date);
    if (d !== null) decades.add(d);
    if (r.category) cats.add(r.category);
    if (r.subtype) subs.add(r.subtype);
    const s = dom(r.source_url) || r.dataset;
    if (s) sources.add(s);
    comp += CORE_FIELDS.filter((f) => filled(r[f])).length / CORE_FIELDS.length;
    if (r.coord_precision === 'exact_site' || r.coord_precision === 'within_1km') precise++;
    if (filled(r.grade)) {
      graded++;
      gsum += r._zero ? 0 : (GW[r._gc || gradeClass(r.grade)] ?? 0.2);
    }
    corro += 1 + (Array.isArray(r.same_as) ? r.same_as.length : 0);
    if (+r.witness_count > 0 || filled(r.witnesses)) wit++;
    if (opt.live && r.source_url) {
      const v = opt.live.get(r.source_url);
      if (v !== undefined) {
        urls++;
        if (v) live++;
      }
    }
  }
  const pct = (k) => (n ? k / n : 0);
  const breadth = {
    countries: countries.size,
    countryShare: Math.min(1, countries.size / ISO_TOTAL),
    decades: decades.size,
    span: decades.size ? [Math.min(...decades), Math.max(...decades)] : null,
    categories: cats.size,
    subtypes: subs.size,
    sources: sources.size,
  };
  const depth = {
    n,
    completeness: pct(comp),
    precise: pct(precise),
    graded: pct(graded),
    gradeStrength: graded ? gsum / graded : 0,
    corroboration: n ? corro / n : 0,
    witnesses: pct(wit),
    live: urls ? live / urls : null,
  };
  // single 0..1 indices so nodes can be compared and labelled
  const B =
    0.45 * breadth.countryShare + 0.25 * Math.min(1, breadth.decades / 30) + 0.3 * Math.min(1, breadth.sources / 20);
  const D =
    0.3 * depth.completeness +
    0.25 * depth.precise +
    0.25 * depth.gradeStrength +
    0.1 * Math.min(1, (depth.corroboration - 1) * 2) +
    0.1 * depth.witnesses;
  return { breadth, depth, B, D, profile: profileOf(B, D, n) };
}
export function profileOf(B, D, n) {
  if (!n) return 'empty';
  if (B >= 0.35 && D < 0.4) return 'wide but shallow';
  if (B < 0.2 && D >= 0.5) return 'deep but narrow';
  if (B >= 0.35 && D >= 0.5) return 'wide and deep';
  if (B < 0.2 && D < 0.4) return 'narrow and shallow';
  return 'moderate';
}
/**
 * Build the layers-of-layers tree.
 * @param {{domain:string, layer:string, rows:object[], sub?:(r:object)=>string, subtype?:(r:object)=>string}[]} groups
 */
export function coverageTree(groups, opt = {}) {
  const tree = [];
  for (const g of groups) {
    const subFn = g.sub || ((r) => r.category || r.subtype || 'all');
    const bySub = new Map();
    for (const r of g.rows) {
      const k = subFn(r) || '(none)';
      if (!bySub.has(k)) bySub.set(k, []);
      bySub.get(k).push(r);
    }
    const children = [...bySub.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([k, rs]) => {
        const bySt = new Map();
        for (const r of rs) {
          const s = (g.subtype ? g.subtype(r) : r.subtype) || '(no subtype)';
          if (!bySt.has(s)) bySt.set(s, []);
          bySt.get(s).push(r);
        }
        const kids =
          bySt.size > 1
            ? [...bySt.entries()]
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 25)
                .map(([s, x]) => ({ name: s, level: 'subtype', ...measure(x, opt) }))
            : [];
        return { name: k, level: 'sub-layer', ...measure(rs, opt), children: kids };
      });
    tree.push({ name: g.layer, domain: g.domain, level: 'layer', ...measure(g.rows, opt), children });
  }
  return tree;
}
export function treeToMarkdown(tree) {
  const P = (x) => (x == null ? 'n/a' : (100 * x).toFixed(0) + '%');
  const line = (node, depth) =>
    `| ${'&nbsp;&nbsp;'.repeat(depth * 2)}${depth ? '└ ' : ''}${node.name.replace(/\|/g, '/')} | ${node.level} | ${node.depth.n} | ${node.breadth.countries} | ${node.breadth.decades} | ${node.breadth.sources} | ${P(node.depth.completeness)} | ${P(node.depth.precise)} | ${P(node.depth.graded)} | ${node.depth.gradeStrength.toFixed(2)} | ${node.depth.corroboration.toFixed(2)} | ${P(node.depth.witnesses)} | ${P(node.depth.live)} | ${node.B.toFixed(2)} | ${node.D.toFixed(2)} | ${node.profile} |`;
  const out = [
    '| Node | Level | Records | Countries | Decades | Sources | Complete | Exact/1 km | Graded | Grade str. | Corrob. | Witnesses | Live src | Breadth | Depth | Profile |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];
  const walk = (n, d) => {
    out.push(line(n, d));
    for (const c of n.children || []) walk(c, d + 1);
  };
  let dom0 = null;
  for (const n of tree) {
    if (n.domain !== dom0) {
      out.push(`| **${n.domain}** | domain | | | | | | | | | | | | | | |`);
      dom0 = n.domain;
    }
    walk(n, 1);
  }
  return out.join('\n');
}
