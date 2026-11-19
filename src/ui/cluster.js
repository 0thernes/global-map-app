// Cluster badge collision pass (v1.4 polish). Pure: no DOM, no Cesium, unit-tested in test/unit/cluster.test.mjs.
// Input groups are { m: members[], v: summed unit vector (anything with add()/clone()) }. Largest first: a group whose
// badge disc would touch an accepted badge (distance < r(a) + r(b) + gap) merges into it. Repeats until stable (at most
// `passes` times) because a merged badge moves to its new centroid and may then touch another one.
export function mergeColliding(groups, project, radius, gap = 4, passes = 4) {
  let cur = groups.map((b) => ({ m: b.m.slice(), v: b.v.clone(), p: null }));
  for (let pass = 0; pass < passes; pass++) {
    for (const b of cur) b.p = project(b);
    cur.sort((a, b) => b.m.length - a.m.length);
    const out = [];
    let merged = false;
    for (const b of cur) {
      let host = null;
      if (b.p)
        for (const o of out) {
          if (!o.p) continue;
          const d = Math.hypot(o.p.x - b.p.x, o.p.y - b.p.y);
          if (d < radius(o.m.length) + radius(b.m.length) + gap) {
            host = o;
            break;
          }
        }
      if (host) {
        for (const c of b.m) host.m.push(c);
        host.v.add(b.v);
        merged = true;
      } else out.push(b);
    }
    cur = out;
    if (!merged) break;
  }
  return cur;
}
