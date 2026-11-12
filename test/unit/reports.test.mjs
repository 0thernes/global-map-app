// Report + index generation on SYNTHETIC rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportHTML, caseRank, HEADER_TAG } from '../../src/report_gen.js';
import {
  buildCaseIndex,
  buildCountryIndex,
  buildSourcesIndex,
  searchItems,
  buildSiteIndex,
} from '../../src/index_gen.js';
import { GLOSSARY } from '../../src/glossary.js';

const rows = [
  {
    id: 'a',
    name: 'Alpha event',
    date: '1967-03-24',
    lat: 47.5,
    lon: -111.2,
    grade: 'CIT',
    coord_precision: 'exact_site',
    category: 'UAP case',
    _area: 'United States of America',
    source_url: 'https://example.org/a',
    summary: 'S1',
  },
  {
    id: 'b',
    name: 'beta <script>',
    date: '1975-10-27',
    lat: 46.9,
    lon: -67.8,
    grade: 'Official record',
    coord_precision: 'locality',
    category: 'UAP case',
    _area: 'United States of America',
    source_url: 'https://www.example.com/b',
  },
  {
    id: 'c',
    name: 'Ébène',
    date: '-2500',
    lat: 30,
    lon: 31,
    grade: 'TE',
    coord_precision: 'region',
    category: 'Abduction',
    _area: 'Egypt',
    source_url: 'https://example.org/c',
  },
  {
    id: 'd',
    name: 'No source',
    date: '2000-01-01',
    lat: 0,
    lon: 0,
    grade: 'CIT',
    category: 'UAP case',
    _area: 'Ocean/International waters',
  },
];
test('report counts only sourced rows and reports the excluded count', () => {
  const r = buildReport(rows);
  assert.equal(r.n, 3);
  assert.equal(r.excludedUnsourced, 1);
  assert.deepEqual(
    r.grades.map((g) => g[1]),
    [1, 1, 0, 1, 0, 0],
  );
  assert.equal(r.firstYear, -2500);
  assert.equal(r.lastYear, 1975);
  assert.equal(r.countries[0][0], 'United States of America');
  assert.equal(r.sources.length, 2);
});
test('top cases ranked by grade then precision', () => {
  const r = buildReport(rows);
  assert.deepEqual(
    r.top.map((c) => c.id),
    ['a', 'b', 'c'],
  );
  assert.ok(caseRank(rows[0], rows[1]) < 0);
});
test('report HTML escapes text fields and carries the styling-only disclaimer', () => {
  const h = reportHTML(buildReport(rows, { title: 'T <b>' }));
  assert.ok(!h.includes('<script>'));
  assert.ok(h.includes('&lt;script&gt;'));
  assert.ok(h.includes('T &lt;b&gt;'));
  assert.ok(h.includes(HEADER_TAG));
  assert.match(h, /not a government document/);
});
test('A-Z index groups by first letter (accents folded), # last', () => {
  const ix = buildCaseIndex([...rows, { id: 'e', name: '1952 flap' }]);
  assert.deepEqual(
    ix.map((g) => g.letter),
    ['A', 'B', 'E', 'N', '#'],
  );
});
test('country and sources index', () => {
  const ci = buildCountryIndex(rows.map((r) => ({ ...r, _gc: r.grade === 'TE' ? 'Testimony' : r.grade })));
  assert.equal(ci[0].area, 'United States of America');
  assert.equal(ci[0].cases, 2);
  assert.equal(ci[0].first, '1967-03-24');
  const si = buildSourcesIndex(rows, [
    { id: 'x', name: 'Zed' },
    { id: 'y', name: 'Abc' },
  ]);
  assert.deepEqual(
    si.datasets.map((d) => d.name),
    ['Abc', 'Zed'],
  );
  assert.equal(si.domains[0].domain, 'example.org');
});
test('site index and search', () => {
  const s = buildSiteIndex([
    {
      id: 'L',
      name: 'Layer',
      items: [
        { name: 'Zulu', lat: 1, lon: 1 },
        { name: 'alpha', lat: 2, lon: 2 },
        { lat: 3, lon: 3 },
      ],
    },
  ]);
  assert.deepEqual(
    s[0].items.map((x) => x.name),
    ['alpha', 'Zulu'],
  );
  assert.equal(searchItems(rows, 'ebene', ['name']).length, 1);
  assert.equal(searchItems(rows, 'alpha 1967', ['name', 'date']).length, 1);
});
test('glossary: every entry has a term, a definition and a source', () => {
  assert.ok(GLOSSARY.length >= 30);
  for (const g of GLOSSARY) {
    assert.ok(g.term && g.def && g.src, g.term);
    assert.ok(/^https:\/\//.test(g.src) || g.src.startsWith('docs/'), g.term);
  }
  const cit = GLOSSARY.find((g) => g.term === 'CIT');
  assert.match(cit.def, /Hastings/);
  assert.match(cit.def, /Pasulka/);
});
import { measure, coverageTree, treeToMarkdown, profileOf } from '../../src/coverage.js';
test('coverage: breadth and depth measures on synthetic rows', () => {
  const m = measure(rows);
  assert.equal(m.depth.n, 4);
  assert.equal(m.breadth.countries, 3);
  assert.equal(m.depth.precise, 0.25);
  assert.ok(m.depth.completeness > 0 && m.depth.completeness <= 1);
  assert.equal(profileOf(0.5, 0.2, 10), 'wide but shallow');
  assert.equal(profileOf(0.1, 0.7, 10), 'deep but narrow');
});
test('coverage tree has layer > sub-layer > subtype and renders markdown', () => {
  const t = coverageTree([
    { domain: 'Cases', layer: 'Synthetic', rows: [...rows, { ...rows[0], id: 'z', subtype: 'x' }] },
  ]);
  assert.equal(t[0].level, 'layer');
  assert.equal(t[0].children[0].level, 'sub-layer');
  assert.ok(treeToMarkdown(t).includes('| **Cases** | domain'));
});
