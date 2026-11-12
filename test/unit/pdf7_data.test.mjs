// v1.2 non-spatial PDF 7 layer: every record traces to a § and page or a source file, counts agree with the PDF,
// unplaced rows carry a source and no coordinates, and no private (NUFORC) row reaches the public build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = (f, v) => {
  const w = {};
  vm.runInNewContext(readFileSync(f, 'utf8'), { window: w });
  return w[v];
};
const D = load('data/pdf7_data.js', 'GM_PDF7_DATA');
const U = load('data/unplaced.js', 'GM_UNPLACED');
const by = (a, f) => a.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});

test('entries: 279 theories + 273 glitches + 108 Part V cases, unique paths', () => {
  assert.deepEqual(
    by(D.entries, (e) => e.part),
    { I: 279, II: 273, V: 108 },
  );
  assert.equal(new Set(D.entries.map((e) => e.id)).size, 660);
});
test('every entry has a section number and a printed page inside the PDF', () => {
  for (const e of D.entries) {
    assert.match(String(e.sec), /^\d+(\.\d+)*$/, e.id);
    assert.ok(Number.isInteger(e.page) && e.page >= 1 && e.page <= D.pdf.pages, `${e.id} page ${e.page}`);
  }
});
test('entry pages fall inside their section (section start page <= entry page)', () => {
  const start = Object.fromEntries(D.sections.filter((s) => s.kind === 'section' && s.num).map((s) => [s.num, s.page]));
  for (const e of D.entries) {
    const top = String(e.sec).split('.')[0];
    if (start[top] != null) assert.ok(e.page >= start[top], `${e.id} p.${e.page} before §${top} p.${start[top]}`);
  }
});
test('only theories are "not a place"; Part II/V placement comes from status.csv actions', () => {
  for (const e of D.entries) {
    if (e.part === 'I') assert.equal(e.place, 'theory (not a place)');
    else
      assert.ok(
        ['add', 'link', 'merge', 'unplaced', 'no_place'].includes(e.place) || e.place.startsWith('merge'),
        `${e.id} ${e.place}`,
      );
    if (e.place === 'no_place' || e.place === 'unplaced') assert.equal((e.map || []).length, 0, e.id);
  }
});
test('165 PDF 7 tables, each with rows, section and page; 7 QWM aggregate tables cite their file', () => {
  const pdf = D.tables.filter((t) => t.env !== 'csv'),
    q = D.tables.filter((t) => t.env === 'csv');
  assert.equal(pdf.length, 165);
  assert.equal(q.length, 7);
  for (const t of pdf) {
    assert.ok(t.rows.length >= 2, t.id);
    assert.ok(t.page >= 1 && t.page <= D.pdf.pages, t.id);
    assert.ok(t.line > 0, t.id);
  }
  for (const t of q) assert.match(t.page_basis, /^source file \w+\.csv/);
});
test('front-matter table T001 says 279 / 273 entries, matching the CSVs', () => {
  const t = D.tables.find((x) => x.id === 'T001');
  const r = Object.fromEntries(t.rows.map((x) => [x[0], x.slice(1)]));
  assert.equal(r['Entries'].join('|'), '279|273');
});
test('Part V taxonomy table counts equal the G12 rows per group', () => {
  const t = D.tables.find((x) => x.rows[0] && x.rows[0].join('|') === 'Path|Group|Case files');
  const n = by(
    D.entries.filter((e) => e.part === 'V'),
    (e) => e.id.split('.').slice(0, 2).join('.'),
  );
  for (const r of t.rows.slice(1)) if (/^G12\.\d+$/.test(r[0])) assert.equal(String(n[r[0]] || 0), r[2], r[0]);
});
test('figures: 58 with file, caption and page', () => {
  assert.equal(D.figures.length, 58);
  for (const f of D.figures) assert.ok(f.file && f.caption && f.page >= 1, f.id);
});
test('CIT register: 144 CSV rows, 115 found in the printed register (known conflict, kept visible)', () => {
  assert.equal(D.cit.length, 144);
  assert.equal(D.cit.filter((c) => c.in_register).length, 115);
});
test('Part V document links are http(s) and typed', () => {
  assert.ok(D.docs.length > 200);
  for (const d of D.docs) {
    assert.match(d.url, /^https?:\/\//);
    assert.ok(d.type && d.host, d.url);
    assert.match(d.path, /^G12\./);
  }
});
test('unplaced rows: sourced, no coordinates, never NUFORC', () => {
  assert.ok(U.rows.length > 300);
  for (const r of U.rows) {
    assert.ok((r.source_url || '').startsWith('http') || r.pdf7_ref, r.id);
    assert.equal(r.lat, undefined, r.id);
    assert.equal(r.lon, undefined, r.id);
    assert.ok(!/nuforc/i.test(`${r.id} ${r.dataset || ''}`), r.id);
  }
  for (const u of U.unsourced) assert.ok(!/nuforc/i.test(u.id), u.id);
  assert.equal(new Set(U.rows.map((r) => r.id)).size, U.rows.length);
});
test('the public data layer carries no NUFORC rows', () => {
  const s = JSON.stringify(D.entries) + JSON.stringify(U);
  assert.ok(!/"dataset":"NUFORC/.test(s));
});
