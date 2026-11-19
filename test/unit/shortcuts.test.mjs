// v1.4 shortcut registry: unique keys, every group used, overlay generated, and every key bound to a handler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHORTCUTS, GROUPS, keyMap, match, overlay } from '../../src/ui/shortcuts.js';

test('ids and keys are unique; groups are known', () => {
  const ids = SHORTCUTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const keys = SHORTCUTS.filter((s) => s.key != null).map((s) => s.key.toLowerCase());
  assert.equal(new Set(keys).size, keys.length, 'duplicate key');
  for (const s of SHORTCUTS) {
    assert.ok(GROUPS.includes(s.group), s.id);
    assert.ok(Array.isArray(s.kbd) && s.kbd.length, s.id);
    assert.ok(s.label.length > 3, s.id);
    assert.ok(s.doc || s.key != null, `${s.id}: needs a key or doc: true`);
  }
});
test('match folds letter case and ignores unknown keys', () => {
  const m = keyMap();
  assert.equal(match({ key: 'L' }, m).id, 'layers');
  assert.equal(match({ key: 'l' }, m).id, 'layers');
  assert.equal(match({ key: '?' }, m).id, 'help');
  assert.equal(match({ key: ' ' }, m).id, 'play');
  assert.equal(match({ key: 'q' }, m), null);
  assert.equal(match({}, m), null);
});
test('overlay lists every row once, grouped in GROUPS order', () => {
  const o = overlay();
  assert.deepEqual(
    o.map((g) => g.group),
    GROUPS,
  );
  assert.equal(
    o.reduce((a, g) => a + g.rows.length, 0),
    SHORTCUTS.length,
  );
});
test('every bound key has a handler (src/ui_misc.js ACTIONS, or the capture-phase keys in src/cinema.js)', () => {
  const misc = readFileSync(new URL('../../src/ui_misc.js', import.meta.url), 'utf8');
  const block = misc.slice(misc.indexOf('const ACTIONS = {'), misc.indexOf('}; // ACTIONS'));
  assert.ok(block.length > 50, 'ACTIONS block found');
  const cinema = ['tour', 'mute', 'settings']; // handled first in src/cinema.js (capture phase)
  for (const s of SHORTCUTS.filter((x) => x.key != null && !cinema.includes(x.id)))
    assert.match(block, new RegExp(`\\b${s.id}:`), `handler for ${s.id}`);
});
