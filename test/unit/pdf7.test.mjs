// PDF 7 mining output: placed rows follow the coordinate rules, every reference resolves, unplaced rows are logged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = (f, v) => {
  const w = {};
  vm.runInNewContext(readFileSync(f, 'utf8'), { window: w });
  return w[v];
};
const P = load('data/pdf7_index.js', 'GM_PDF7');
const CASES = load('data/cases.js', 'GM_CASES') || null;

test('PDF 7 index covers all 381 entries', () => {
  const n = Object.values(P.counts).reduce((a, b) => a + b, 0);
  assert.equal(n, 381);
  assert.ok(P.counts.add > 0 && P.counts.link > 0);
});

test('every listed entry has a section, page and path', () => {
  for (const e of P.entries) {
    assert.match(e.path, /^G\d+(\.\d+)+$/);
    assert.ok(e.section && e.page, e.path);
  }
});

test('placed entries point at map rows; unplaced ones carry a reason', () => {
  for (const e of P.entries) {
    if (e.action === 'unplaced') assert.ok(e.reason, e.path);
    else assert.ok(e.map.length > 0, `${e.path} has no map entry`);
  }
});

test('unplaced audit file lists the same entries', () => {
  const rows = readFileSync('docs/audit/pdf7-unplaced.csv', 'utf8').trim().split('\n').slice(1);
  assert.equal(rows.length, P.counts.unplaced);
});

test('new rows: Wikidata coordinates, a cited source and a PDF 7 reference', () => {
  const lines = readFileSync('data/sources/pdf7_cases.csv', 'utf8').trim().split('\n');
  assert.equal(lines.length - 1, P.counts.add);
  for (const l of lines.slice(1)) {
    assert.match(l, /Wikidata Q\d+ \(.*\) P625/);
    assert.match(l, /PDF 7 citation: /);
    assert.match(l, /PDF 7 §[\d.]+ \(p\. \d+\) · G[\d.]+/);
    assert.match(l, /,(exact_site|within_1km|locality|region),/);
  }
  if (CASES) assert.ok(CASES.some((c) => c.id.startsWith('PDF7-')));
});
