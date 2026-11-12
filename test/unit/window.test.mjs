// Window manager (src/ui/window.js): pure geometry plus DOM behaviour in jsdom (header controls, single scroll
// region, minimize / maximize / close, state in localStorage, Esc via closeTop, focus trap, reset layout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  safeArea,
  clampRect,
  snapZone,
  layoutWindows,
  parseState,
  HEAD_H,
  MIN_W,
  GAP,
  KEY,
} from '../../src/ui/window.js';

const SAFE = safeArea({ vw: 1920, vh: 1080, top: 56, bottom: 112, railRight: 328 });
const overlap = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);

test('safeArea: excludes top bar, timeline + credit line and the rail, with an 8 px gap', () => {
  assert.equal(SAFE.y, 64);
  assert.equal(SAFE.x, 336);
  assert.equal(SAFE.b, 1080 - 112 - 16 - 8);
  assert.equal(SAFE.r, 1912);
  assert.equal(SAFE.w, SAFE.r - SAFE.x);
});
test('clampRect: keeps a window inside the safe area and at least the minimum size', () => {
  const r = clampRect({ x: -500, y: 5000, w: 50, h: 20 }, SAFE);
  assert.equal(r.x, SAFE.x);
  assert.ok(r.w >= MIN_W);
  assert.ok(r.y + r.h <= SAFE.y + SAFE.h);
  const big = clampRect({ x: 0, y: 0, w: 99999, h: 99999 }, SAFE);
  assert.equal(big.w, SAFE.w);
  assert.equal(big.h, SAFE.h);
});
test('snapZone: left / right / bottom edges, nothing in the middle', () => {
  assert.equal(snapZone(SAFE.x + 2, 500, SAFE), 'left');
  assert.equal(snapZone(SAFE.r - 2, 500, SAFE), 'right');
  assert.equal(snapZone(900, SAFE.b - 2, SAFE), 'bottom');
  assert.equal(snapZone(900, 500, SAFE), null);
});
test('layoutWindows: docked windows tile without overlapping each other or the chrome', () => {
  const wins = [
    { id: 'dossier', mode: 'right', w: 420, order: -10 },
    { id: 'wars', mode: 'right', w: 600, order: 1 },
    { id: 'hs', mode: 'left', w: 440, order: 2 },
    { id: 'charts', mode: 'bottom', h: 400, order: 3 },
  ];
  const { rects, occ } = layoutWindows(wins, SAFE);
  const ids = Object.keys(rects);
  assert.equal(ids.length, 4);
  for (let i = 0; i < ids.length; i++) {
    const r = rects[ids[i]];
    assert.ok(r.x >= SAFE.x && r.y >= SAFE.y && r.x + r.w <= SAFE.r + 0.5 && r.y + r.h <= SAFE.b + 0.5, ids[i]);
    for (let j = i + 1; j < ids.length; j++) assert.ok(!overlap(r, rects[ids[j]]), ids[i] + ' vs ' + ids[j]);
  }
  // the dossier (lowest order) sits on the outer right edge, the other right dock inside it
  assert.equal(rects.dossier.x + rects.dossier.w, SAFE.r);
  assert.ok(rects.wars.x + rects.wars.w <= rects.dossier.x - GAP);
  // the bottom dock spans between the left and right docks
  assert.ok(rects.charts.x >= rects.hs.x + rects.hs.w);
  assert.ok(rects.charts.x + rects.charts.w <= rects.wars.x);
  assert.ok(occ.left > SAFE.x && occ.right < SAFE.r);
});
test('layoutWindows: side docks shrink when they would leave less than 30 % of the width', () => {
  const wins = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, mode: 'right', w: 700, order: i }));
  const { rects } = layoutWindows(wins, SAFE);
  const used = Object.values(rects).reduce((a, r) => a + r.w, 0);
  assert.ok(used <= SAFE.w * 0.75, `used ${used} of ${SAFE.w}`);
});
test('layoutWindows: minimized keeps only the header; max fills the safe area; floats are clamped', () => {
  const { rects } = layoutWindows(
    [
      { id: 'm', mode: 'right', w: 500, min: true },
      { id: 'x', mode: 'max' },
      { id: 'f', mode: 'float', w: 3000, x: -50, y: -50, h: 5000 },
    ],
    SAFE,
  );
  assert.equal(rects.m.h, HEAD_H);
  assert.deepEqual(rects.x, { x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h });
  assert.equal(rects.f.w, SAFE.w);
  assert.equal(rects.f.x, SAFE.x);
  assert.equal(rects.f.y, SAFE.y);
  assert.equal(rects.f.h, SAFE.h);
});
test('layoutWindows: narrow screens turn every window into a full-width bottom sheet', () => {
  const s = safeArea({ vw: 700, vh: 900 });
  const { rects } = layoutWindows([{ id: 'a', mode: 'right', w: 600 }], s, { narrow: true });
  assert.equal(rects.a.w, s.w);
  assert.equal(rects.a.y + rects.a.h, s.y + s.h);
});
test('parseState: accepts good state, drops junk and bad JSON', () => {
  assert.deepEqual(parseState('{"mode":"left","w":400,"min":true}'), { mode: 'left', w: 400, min: true });
  assert.deepEqual(parseState('{"mode":"sideways","w":-5,"x":"a"}'), {});
  assert.equal(parseState('{oops'), null);
  assert.equal(parseState('null'), null);
  assert.equal(KEY('datap'), 'gm.win.datap');
});

// ---------------------------------------------------------------- DOM (jsdom)
async function dom() {
  const html = `<!doctype html><body>
    <aside id="rail" style="position:fixed"></aside>
    <button id="opener">open</button>
    <section id="wars" class="panel" hidden aria-label="Wars"><header><h3>Wars <small>ranked</small></h3><button id="wars-close" class="close" aria-label="Close">×</button></header><div id="wars-body"><p>x</p></div></section>
    <section id="datap" class="panel" hidden aria-label="Data"><header><h3>Data</h3><button id="data-close" class="close">×</button></header><div class="ref-top"><div id="dt"></div><input id="q"></div><div id="data-body"><a href="#">a</a><button id="last">b</button></div></section>
    <aside id="dossier" class="panel" hidden aria-label="Dossier"><button id="dossier-close" class="close">×</button><div id="dossier-body"></div></aside>
  </body>`;
  const w = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true }).window;
  for (const k of [
    'window',
    'document',
    'localStorage',
    'MutationObserver',
    'getComputedStyle',
    'innerWidth',
    'innerHeight',
    'requestAnimationFrame',
    'addEventListener',
    'removeEventListener',
    'HTMLElement',
  ])
    globalThis[k] = k === 'window' ? w : typeof w[k] === 'function' && !/^[A-Z]/.test(k) ? w[k].bind(w) : w[k];
  Object.defineProperty(w, 'innerWidth', { value: 1920, configurable: true });
  Object.defineProperty(w, 'innerHeight', { value: 1080, configurable: true });
  globalThis.innerWidth = 1920;
  globalThis.innerHeight = 1080;
  const mod = await import('../../src/ui/window.js?dom=' + Math.random());
  return { w, d: w.document, mod };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

test('enhance: standard header with title + minimize / maximize / close, one scroll body, tools row', async () => {
  const { d, mod } = await dom();
  mod.enhance(d.getElementById('wars'), { mode: 'right', w: 600 });
  mod.enhance(d.getElementById('datap'), { mode: 'float', w: 1280, modal: true });
  mod.enhance(d.getElementById('dossier'), { mode: 'right', w: 420, title: 'Dossier' });
  for (const id of ['wars', 'datap', 'dossier']) {
    const el = d.getElementById(id);
    const head = el.querySelector(':scope > header.win-head');
    assert.ok(head, id + ' header');
    assert.ok(head.querySelector('.win-title'), id + ' title');
    const labels = [...head.querySelectorAll('.win-ctl button')].map((b) => b.getAttribute('aria-label'));
    assert.deepEqual(labels, ['Minimize', 'Maximize', 'Close'], id);
    assert.equal(el.querySelectorAll(':scope > .win-body').length, 1, id + ' one body');
    assert.ok(el.querySelector('.win-close svg'), id + ' close is an icon');
  }
  assert.equal(d.querySelector('#dossier .win-title').textContent, 'Dossier');
  assert.ok(d.querySelector('#wars .win-body #wars-body'));
  assert.ok(d.querySelector('#datap > .win-tools .ref-top'), 'tabs + filter stay outside the scroll body');
  assert.equal(d.getElementById('datap').getAttribute('role'), 'dialog');
  assert.equal(d.getElementById('datap').getAttribute('aria-modal'), 'true');
  assert.equal(d.getElementById('datap').getAttribute('aria-labelledby'), 'datap-title');
});
test('show / minimize / restore / maximize / close; state persists in localStorage', async () => {
  const { d, mod } = await dom();
  let closed = 0;
  const el = d.getElementById('wars');
  mod.enhance(el, { mode: 'right', w: 600 });
  d.getElementById('wars-close').onclick = () => {
    closed++;
    el.hidden = true;
  };
  el.hidden = false;
  await tick();
  assert.equal(el.dataset.mode, 'right');
  assert.ok(parseInt(el.style.width) > 0);
  el.querySelector('.win-min').click();
  assert.ok(el.classList.contains('min'));
  assert.equal(el.querySelector('.win-body').hidden, true);
  assert.equal(el.querySelector('.win-min').getAttribute('aria-label'), 'Restore');
  assert.equal(JSON.parse(localStorage.getItem('gm.win.wars')).min, true);
  el.querySelector('.win-min').click();
  assert.ok(!el.classList.contains('min'));
  el.querySelector('.win-max').click();
  assert.equal(el.dataset.mode, 'max');
  assert.equal(el.querySelector('.win-max').getAttribute('aria-pressed'), 'true');
  el.querySelector('.win-max').click();
  assert.equal(el.dataset.mode, 'right');
  mod.dock('wars', 'left');
  assert.equal(JSON.parse(localStorage.getItem('gm.win.wars')).mode, 'left');
  el.querySelector('.win-close').click();
  assert.equal(closed, 1, 'module close logic runs');
  assert.equal(el.hidden, true);
  mod.resetLayout();
  assert.equal(localStorage.getItem('gm.win.wars'), null);
});
test('closeTop: Esc closes the focused window first, then the most recently raised', async () => {
  const { d, mod } = await dom();
  const a = d.getElementById('wars'),
    b = d.getElementById('dossier');
  mod.enhance(a, { mode: 'right' });
  mod.enhance(b, { mode: 'right' });
  a.hidden = false;
  await tick();
  b.hidden = false;
  await tick();
  a.querySelector('.win-max').focus();
  assert.equal(mod.closeTop(), true);
  assert.equal(a.hidden, true);
  assert.equal(b.hidden, false);
  d.body.focus();
  assert.equal(mod.closeTop(), true);
  assert.equal(b.hidden, true);
  assert.equal(mod.closeTop(), false);
});
test('modal focus trap: Tab from the last control wraps to the first, Shift+Tab wraps back', async () => {
  const { w, d, mod } = await dom();
  const el = d.getElementById('datap');
  mod.enhance(el, { mode: 'float', modal: true });
  el.hidden = false;
  await tick();
  // jsdom has no layout: treat everything as visible for the trap
  for (const n of el.querySelectorAll('*')) Object.defineProperty(n, 'offsetParent', { value: d.body });
  const f = [...el.querySelectorAll('button, input, a[href]')];
  f.at(-1).focus();
  el.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  // the handler is on the window element; dispatch from the focused node so target is inside
  f.at(-1).dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  assert.equal(d.activeElement, f[0]);
  f[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  assert.equal(d.activeElement, f.at(-1));
});
