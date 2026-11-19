// Cluster badge collision pass (src/ui/cluster.js) and badge radius (src/cesium/icons.js), v1.4 polish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeColliding } from '../../src/ui/cluster.js';
import { badgeRadius } from '../../src/cesium/icons.js';

// a 2D stand-in for the summed unit vector: x, y in screen px, w = member count (centroid = x/w, y/w)
class V {
  constructor(x, y, w = 1) {
    Object.assign(this, { x, y, w });
  }
  clone() {
    return new V(this.x, this.y, this.w);
  }
  add(o) {
    this.x += o.x;
    this.y += o.y;
    this.w += o.w;
    return this;
  }
}
const grp = (x, y, n) => ({ m: Array.from({ length: n }, (_, i) => `${x},${y}#${i}`), v: new V(x * n, y * n, n) });
const project = (b) => ({ x: b.v.x / b.v.w, y: b.v.y / b.v.w });
const R = (n) => badgeRadius(n, 1);

test('badge radius grows with log10(count) and scales at 4K', () => {
  assert.equal(R(1), 11);
  assert.ok(R(10) > R(3) && R(1000) > R(100));
  assert.ok(R(2600) < 2.6 * R(3), 'a 2,600-case badge is not many times a 3-case badge');
  assert.ok(badgeRadius(100, 1.25) > R(100));
});
test('overlapping badges merge into the larger one; all members kept', () => {
  const out = mergeColliding([grp(100, 100, 50), grp(120, 104, 5), grp(400, 400, 4)], project, R, 4);
  assert.equal(out.length, 2);
  assert.equal(out[0].m.length, 55);
  assert.equal(
    out.reduce((a, b) => a + b.m.length, 0),
    59,
  );
});
test('after merging no two badges overlap', () => {
  const gs = [];
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 6; j++) gs.push(grp(40 + i * 48, 40 + j * 48, 3 + ((i * 7 + j * 13) % 400)));
  const out = mergeColliding(gs, project, R, 4, 8);
  const n = gs.reduce((a, b) => a + b.m.length, 0);
  assert.equal(
    out.reduce((a, b) => a + b.m.length, 0),
    n,
  );
  for (let a = 0; a < out.length; a++)
    for (let b = a + 1; b < out.length; b++) {
      const pa = project(out[a]),
        pb = project(out[b]);
      assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) >= R(out[a].m.length) + R(out[b].m.length) + 4 - 1e-9);
    }
});
test('far-side groups (no projection) are kept as they are', () => {
  const out = mergeColliding([grp(0, 0, 3)], () => null, R);
  assert.equal(out.length, 1);
});
