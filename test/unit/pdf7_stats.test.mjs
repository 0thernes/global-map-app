// Derivations behind the Data panel: known textbook values, determinism and edge cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as S from '../../src/pdf7_stats.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('eraOf uses the QWM era bins, BCE as negative years', () => {
  assert.equal(S.eraOf(-9600), 'prehistory (<3000 BCE)');
  assert.equal(S.eraOf(-3000), 'ancient (3000-500 BCE)');
  assert.equal(S.eraOf(1946), '1900-1946');
  assert.equal(S.eraOf(1947), '1947-1969');
  assert.equal(S.eraOf(2026), '2010-2026');
  assert.equal(S.eraOf(null), 'undated');
});
test('Fisher exact: tea-tasting table [[3,1],[1,3]] two-sided p = 0.4857', () => {
  close(
    S.fisher2x2([
      [3, 1],
      [1, 3],
    ]).p,
    0.4857142857,
    1e-6,
  );
  close(
    S.fisher2x2([
      [10, 0],
      [0, 10],
    ]).p,
    1.0825088e-5,
    1e-9,
  );
});
test('chi-square statistic for a known 2x2 table', () => {
  const r = S.chiSquare([
    [20, 30],
    [30, 20],
  ]);
  close(r.x2, 4);
  assert.equal(r.df, 1);
  close(r.cramerV, 0.2);
});
test('Spearman: perfect monotone = 1, reversed = -1, ties use average ranks', () => {
  assert.equal(S.spearman([1, 2, 3, 4, 5], [2, 4, 8, 16, 32], { iters: 99 }).rho.toFixed(6), '1.000000');
  assert.equal(S.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1], { iters: 99 }).rho.toFixed(6), '-1.000000');
  assert.deepEqual(S.ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});
test('permutation p-values are deterministic per seed and never 0', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    b = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9];
  const r1 = S.spearman(a, b, { iters: 499, seed: 3 }),
    r2 = S.spearman(a, b, { iters: 499, seed: 3 });
  assert.equal(r1.p, r2.p);
  assert.ok(r1.p >= 1 / 500);
  const m = S.medianDiffPerm([1, 1, 1, 1, 1], [1, 1, 1, 1, 1], { iters: 99 });
  assert.equal(m.p, 1);
});
test('Holm adjustment is monotone and capped at 1', () => {
  assert.deepEqual(S.holm([0.01, 0.04, 0.03, 0.2]), [0.04, 0.09, 0.09, 0.2]);
  assert.deepEqual(S.holm([0.6, 0.9]), [1, 1]);
});
test('sortRows: numbers before text, blanks last, stable, both directions', () => {
  const rows = [['b'], ['10'], [''], ['2'], ['1,200'], ['a'], ['+3.5']];
  assert.deepEqual(
    S.sortRows(rows, 0, 1).map((r) => r[0]),
    ['2', '+3.5', '10', '1,200', 'a', 'b', ''],
  );
  assert.deepEqual(
    S.sortRows(rows, 0, -1).map((r) => r[0]),
    ['1,200', '10', '+3.5', '2', 'b', 'a', ''],
  );
});
test('histogram includes the right edge in the last bin', () => {
  assert.deepEqual(S.histogram([0, 5, 10, 10, null], [0, 5, 10]), [1, 3]);
});
test('gradeClass takes the claim layer of "event / claim" grades', () => {
  assert.equal(S.gradeClass('Official record / Cred. Insider Testimony'), 'Cred. Insider Testimony');
  assert.equal(S.gradeClass('Disputed'), 'Disputed');
  assert.equal(S.gradeClass(''), 'ungraded');
});
test('battery on the shipped data: 7 tests, p in (0,1], Holm >= raw, reproducible', () => {
  const w = {};
  vm.runInNewContext(readFileSync('data/pdf7_data.js', 'utf8') + readFileSync('data/cases.js', 'utf8'), { window: w });
  const a = S.battery(w.GM_PDF7_DATA, w.GM_CASES, { iters: 199 }),
    b = S.battery(w.GM_PDF7_DATA, w.GM_CASES, { iters: 199 });
  assert.equal(a.length, 7);
  for (const [i, t] of a.entries()) {
    assert.ok(t.p > 0 && t.p <= 1 && t.pHolm >= t.p - 1e-12 && t.pHolm <= 1, t.id);
    assert.ok(t.caveat.length > 40 && t.data && t.method, t.id);
    assert.equal(t.p, b[i].p);
  }
});
