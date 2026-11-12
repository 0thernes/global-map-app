// Tab component (src/ui/tabs.js): keyboard model and ARIA wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { nextTab } from '../../src/ui/tabs.js';

test('nextTab: arrows wrap, Home / End jump, other keys ignored', () => {
  assert.equal(nextTab(0, 'ArrowRight', 3), 1);
  assert.equal(nextTab(2, 'ArrowRight', 3), 0);
  assert.equal(nextTab(0, 'ArrowLeft', 3), 2);
  assert.equal(nextTab(1, 'Home', 3), 0);
  assert.equal(nextTab(0, 'End', 3), 2);
  assert.equal(nextTab(0, 'a', 3), -1);
  assert.equal(nextTab(0, 'ArrowRight', 0), -1);
});

async function setup() {
  const w = new JSDOM('<!doctype html><div id="t" class="tabs"></div><div id="p"></div>', { pretendToBeVisual: true })
    .window;
  globalThis.document = w.document;
  const { makeTabs } = await import('../../src/ui/tabs.js');
  return { w, d: w.document, makeTabs };
}
test('makeTabs: ARIA roles, one tab in the tab order, data attribute kept for existing selectors', async () => {
  const { d, makeTabs } = await setup();
  const seen = [];
  const t = makeTabs(
    d.getElementById('t'),
    [
      ['a', 'Alpha'],
      ['b', 'Beta'],
      ['c', 'Gamma'],
    ],
    { active: 'b', attr: 'dt', panel: 'p', label: 'Views', onChange: (id) => seen.push(id) },
  );
  const list = d.querySelector('[role=tablist]');
  assert.equal(list.getAttribute('aria-label'), 'Views');
  const tabs = [...d.querySelectorAll('[role=tab]')];
  assert.equal(tabs.length, 3);
  assert.deepEqual(
    tabs.map((b) => b.getAttribute('aria-selected')),
    ['false', 'true', 'false'],
  );
  assert.deepEqual(
    tabs.map((b) => b.tabIndex),
    [-1, 0, -1],
  );
  assert.equal(tabs[0].dataset.dt, 'a');
  assert.equal(tabs[0].getAttribute('aria-controls'), 'p');
  assert.equal(d.getElementById('p').getAttribute('role'), 'tabpanel');
  assert.equal(d.getElementById('p').getAttribute('aria-labelledby'), tabs[1].id);
  assert.ok(!d.getElementById('t').classList.contains('tabs'), 'old pill style class removed');
  assert.equal(d.querySelectorAll('.tab-arrow').length, 2);
  tabs[2].click();
  assert.deepEqual(seen, ['c']);
  assert.equal(t.get(), 'c');
  t.set('a');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.deepEqual(seen, ['c'], 'set() does not fire onChange');
});
test('makeTabs: arrow keys move focus and select (automatic activation)', async () => {
  const { w, d, makeTabs } = await setup();
  const seen = [];
  makeTabs(
    d.getElementById('t'),
    [
      ['a', 'A'],
      ['b', 'B'],
    ],
    { onChange: (id) => seen.push(id) },
  );
  const tabs = [...d.querySelectorAll('[role=tab]')];
  tabs[0].focus();
  tabs[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(d.activeElement, tabs[1]);
  assert.deepEqual(seen, ['b']);
  tabs[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(d.activeElement, tabs[0]);
  assert.deepEqual(seen, ['b', 'a']);
});

test('numericCols: numeric columns are detected for right alignment (80 % rule, blanks ignored)', async () => {
  const { numericCols } = await import('../../src/ui/table.js');
  const rows = [
    ['X.1', 'Holographic', '80.2', '+11.39', ''],
    ['X.2', 'NHI', '69.5', '−2.5', '12%'],
    ['X.3', 'Crypto', '74,4', '1 024', '3%'],
  ];
  assert.deepEqual(numericCols(5, rows), [false, false, true, true, true]);
});
