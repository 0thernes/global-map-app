// v1.4 symbology: one source of category colour + icon and of the pin-vs-circle rule for map, legend and dossier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTE,
  CAT_ICON,
  catColor,
  catIcon,
  markerOf,
  isPrecise,
  legendModel,
  compact,
  PRECISION,
  MARKER_RULE,
} from '../../src/ui/symbology.js';
import { ICONS } from '../../src/icons.js';
import { GRADES } from '../../src/grades.js';

test('every top-level category has a colour and an icon that ships in src/icons.js', () => {
  for (const k of Object.keys(PALETTE).filter((k) => !k.includes(':'))) {
    assert.ok(CAT_ICON[k], `icon for ${k}`);
    assert.ok(ICONS[CAT_ICON[k]], `icon ${CAT_ICON[k]} is generated`);
    assert.match(PALETTE[k], /^#[0-9a-f]{6}$/);
  }
  assert.ok(ICONS[catIcon('Something new')], 'fallback icon ships');
});
test('category colours: animal-mutilation subtypes, fallback', () => {
  assert.equal(catColor('Animal mutilation', 'cattle'), PALETTE['Animal mutilation: cattle']);
  assert.equal(catColor('Animal mutilation', 'goat'), PALETTE['Animal mutilation']);
  assert.equal(catColor('Unknown'), '#d0d0d0');
  assert.equal(catIcon('Animal mutilation: horse'), CAT_ICON['Animal mutilation']);
});
test('pins only for exact_site and within_1km; everything else is an uncertainty circle', () => {
  assert.equal(markerOf({ coord_precision: 'exact_site' }).kind, 'pin');
  assert.equal(markerOf({ coord_precision: 'within_1km' }).kind, 'pin');
  for (const p of ['locality', 'region', '', undefined, 'country'])
    assert.equal(markerOf({ coord_precision: p, coord_radius_km: 25 }).kind, 'circle', String(p));
  assert.equal(markerOf({ coord_precision: 'region', coord_radius_km: 120 }).radiusKm, 120);
  assert.match(markerOf({ coord_precision: 'locality', coord_radius_km: 2.5 }).text, /±2\.5 km/);
  assert.equal(markerOf({ coord_precision: 'locality' }).radiusKm, 10, 'same default radius as prepCases (_r)');
  assert.deepEqual(
    Object.keys(PRECISION).filter((p) => isPrecise(p)),
    ['exact_site', 'within_1km'],
  );
  assert.deepEqual(
    MARKER_RULE.map((r) => r.kind),
    ['pin', 'circle', 'cluster'],
  );
});
test('legend model counts categories (sorted), grades (all classes, in GRADES order) and marker kinds', () => {
  const rows = [
    { category: 'UAP case', _gc: 'CIT', coord_precision: 'exact_site' },
    { category: 'UAP case', _gc: 'Official record', coord_precision: 'region' },
    { category: 'Abduction', _gc: 'ST', coord_precision: 'locality' },
  ];
  const m = legendModel(rows);
  assert.equal(m.total, 3);
  assert.deepEqual(
    m.categories.map((c) => [c.k, c.n]),
    [
      ['UAP case', 2],
      ['Abduction', 1],
    ],
  );
  assert.deepEqual(
    m.grades.map((g) => g.k),
    GRADES.map((g) => g.k),
  );
  assert.equal(m.grades.find((g) => g.k === 'CIT').n, 1);
  assert.deepEqual(m.marks, { pin: 1, circle: 2 });
  assert.equal(legendModel([]).total, 0);
});
test('compact counts', () => {
  assert.deepEqual([0, 999, 1000, 1234, 9999, 12345, 999999, 1250000].map(compact), [
    '0',
    '999',
    '1k',
    '1.2k',
    '9.9k',
    '12k',
    '999k',
    '1.2M',
  ]);
  assert.equal(compact(NaN), '0');
});

// v1.5: grade gauge pins (ADR 0005 section 4)
import { GRADE_GAUGE, pinShape, PIN_SHAPE_BASE } from '../../src/ui/symbology.js';
import { GAUGES } from '../../src/cesium/icons.js';
test('every grade class has a gauge fraction, in GRADES order, matching the drawn icons', () => {
  assert.deepEqual(
    GRADES.map((g) => GRADE_GAUGE[g.k]),
    GAUGES,
  );
  GRADES.forEach((g, i) => assert.equal(pinShape(g.k), PIN_SHAPE_BASE + i));
  assert.equal(pinShape('nonsense'), PIN_SHAPE_BASE + GRADES.length - 1);
  // weight never increases down the grade ladder
  for (let i = 1; i < GAUGES.length; i++) assert.ok(GAUGES[i] <= GAUGES[i - 1]);
});
