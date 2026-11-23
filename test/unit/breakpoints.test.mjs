// v1.5 breakpoints: every width in a stylesheet media query is a listed breakpoint, and JS uses the same numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BREAKPOINTS, SHORT_HEIGHT, band } from '../../src/ui/breakpoints.js';
import { NARROW } from '../../src/ui/window.js';

const cssDir = new URL('../../css/', import.meta.url);
const sheets = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
test('stylesheets use range syntax and only listed widths', () => {
  const allowed = new Set(Object.values(BREAKPOINTS));
  let n = 0;
  for (const f of sheets) {
    const css = readFileSync(new URL(f, cssDir), 'utf8');
    assert.doesNotMatch(css, /\((max|min)-(width|height)\s*:/, `${f}: use (width < N) / (width >= N)`);
    for (const m of css.matchAll(/@media[^{]*\(width\s*(<|>=)\s*(\d+)px\)/g)) {
      n++;
      assert.ok(allowed.has(+m[2]), `${f}: ${m[2]}px is not in src/ui/breakpoints.js`);
    }
    for (const m of css.matchAll(/@media[^{]*\(height\s*<\s*(\d+)px\)/g)) assert.equal(+m[1], SHORT_HEIGHT, f);
  }
  assert.ok(n >= 10, 'media queries found');
});
test('JS layout uses the same numbers; bands are ordered', () => {
  assert.equal(NARROW, BREAKPOINTS.sheet);
  const v = Object.values(BREAKPOINTS);
  assert.deepEqual(
    v,
    [...v].sort((a, b) => a - b),
  );
  assert.equal(band(800), 'phone');
  assert.equal(band(1280), 'laptop');
  assert.equal(band(1920), 'wide');
  assert.equal(band(3840), 'uhd');
  assert.equal(band(1759), 'desktop');
});
