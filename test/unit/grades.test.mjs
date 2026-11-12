// Grade classification (docs/data-and-grading.md). Grades key on the grade string, never on names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeClass, GRADES } from '../../src/grades.js';

const cases = {
  CIT: 'CIT',
  'CIT (Hastings)': 'CIT',
  'Credible insider testimony': 'CIT',
  'CIT + Official record': 'CIT',
  'Official record': 'Official record',
  'ST': 'ST',
  'Serious testimony (experiencer)': 'ST',
  TE: 'Testimony',
  'TE / filer': 'Testimony',
  'testimony': 'Testimony',
  '': 'Other',
  'peer-reviewed': 'Other',
  'Online claim (trail only)': 'Online claim',
  'Online claim (ungraded)': 'Online claim',
};
for (const [g, want] of Object.entries(cases)) test(`gradeClass(${JSON.stringify(g)}) = ${want}`, () => assert.equal(gradeClass(g), want));
test('legend has six classes with colours', () => {
  assert.deepEqual(GRADES.map((g) => g.k), ['CIT', 'Official record', 'ST', 'Testimony', 'Online claim', 'Other']);
  for (const g of GRADES) assert.match(g.color, /^#[0-9a-f]{6}$/i);
});
test('CIT legend records the 2026-11-12 update (Hastings, Diana Pasulka)', () => {
  assert.match(GRADES[0].desc, /Hastings/);
  assert.match(GRADES[0].desc, /Pasulka/);
});
