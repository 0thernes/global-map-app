// v1.5 panel states: one markup for loading / empty / error, escaped, with the right live-region semantics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelState, loadingState, emptyState, errorState, STATE_KINDS } from '../../src/ui/states.js';
import { ICONS } from '../../src/icons.js';

test('each kind has a shipped icon and the right role', () => {
  for (const [k, v] of Object.entries(STATE_KINDS)) assert.ok(ICONS[v.icon], `${k}: icon ${v.icon}`);
  assert.match(loadingState('x'), /role="status"[^>]*aria-busy="true"/);
  assert.match(emptyState('x'), /role="status" aria-live="polite"/);
  assert.match(errorState('x'), /role="alert" aria-live="assertive"/);
  assert.doesNotMatch(emptyState('x'), /aria-busy/);
});
test('text is escaped; detail and action are optional', () => {
  const h = errorState('<b>bad</b>', { detail: 'a & "b"', action: { id: 'r1', label: 'Retry <now>' } });
  assert.ok(!h.includes('<b>bad'));
  assert.ok(h.includes('&lt;b&gt;bad&lt;/b&gt;'));
  assert.ok(h.includes('a &amp; &quot;b&quot;'));
  assert.match(h, /<button class="btn sm pstate-act" id="r1" type="button">/);
  assert.ok(h.includes('Retry &lt;now&gt;'));
  assert.doesNotMatch(emptyState('plain'), /pstate-detail|<button/);
});
test('unknown kind falls back to empty; compact adds the class', () => {
  assert.match(panelState('nope', 't'), /pstate pstate-empty/);
  assert.match(emptyState('t', { compact: true }), /pstate pstate-empty compact/);
});
