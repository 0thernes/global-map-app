// Renderer support code that runs without WebGL: keyless source catalogue and the terrarium terrain maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASEMAPS, NIGHT, TERRAINS } from '../../src/cesium/sources.js';
import { mercTile, decodeTerrarium } from '../../src/cesium/terrarium.js';

test('sources: every imagery/terrain URL is https and keyless (no key/token/ion parameter)', () => {
  const urls = [
    ...BASEMAPS.flatMap((b) => [b.url, ...(b.overlays || [])]),
    NIGHT.url,
    ...TERRAINS.map((t) => t.url),
  ].filter(Boolean);
  assert.ok(urls.length >= 10);
  for (const u of urls) {
    assert.match(u, /^https:\/\//, u);
    assert.doesNotMatch(u, /key=|token=|access_token|apikey|ion\.cesium|cesium\.com/i, u);
  }
});
test('sources: every basemap has a credit line and a unique id; an offline option exists', () => {
  const ids = new Set();
  for (const b of BASEMAPS) {
    assert.ok(b.credit && b.credit.length > 8, b.id);
    assert.ok(!ids.has(b.id), b.id);
    ids.add(b.id);
  }
  assert.ok(BASEMAPS.some((b) => b.local));
  assert.ok(TERRAINS.some((t) => t.id === 'off'));
});
test('terrarium: decode matches the published formula (R*256 + G + B/256 - 32768)', () => {
  assert.equal(decodeTerrarium(128, 0, 0), 0);
  assert.equal(decodeTerrarium(128, 100, 128), 100.5);
  assert.equal(decodeTerrarium(0, 0, 0), -32768);
});
test('terrarium: web-mercator tile maths (slippy-map convention)', () => {
  const t = mercTile(0, 0, 1);
  assert.deepEqual([Math.floor(t.x), Math.floor(t.y)], [1, 1]);
  const ny = mercTile(40.7484, -73.9857, 19);
  assert.deepEqual([Math.floor(ny.x), Math.floor(ny.y)], [154394, 197053]);
  // poles clamp to the mercator limit instead of returning NaN/Infinity
  const p = mercTile(90, 180, 3);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x < 8 && p.y >= 0);
});
