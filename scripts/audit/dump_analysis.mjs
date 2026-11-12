// Pass 7 helper: run the in-app hypothesis analysis headlessly (public data only, default settings) and dump the
// per-case nearest distances and summary so scripts/audit/stats_crosscheck.py can re-derive them independently.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
});
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(pathToFileURL(resolve('index.html')).href + '?intro=0&private=0');
await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
await p.keyboard.press('a');
if (process.argv[3] === 'all') {
  await p.uncheck('#an-exact');
  await p.fill('#an-iters', '99');
}
await p.click('#an-run');
await p.waitForSelector('#an-out .an-ref', { timeout: 1200000 });
const out = await p.evaluate(async () => {
  const r = await window.__lastAnalysis();
  return {
    n: r.n,
    win: r.win,
    iters: r.iters,
    seed: r.seed,
    cases: r.cases.map((c) => ({
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      date: c.date,
      day: c._day,
      an: Object.fromEntries(Object.entries(c._an || {}).map(([k, v]) => [k, v.d])),
    })),
    refs: Object.fromEntries(
      Object.entries(r.refs).map(([k, x]) => [
        k,
        {
          nObs: x.nObs,
          med: x.med,
          ci: x.ci,
          w50: x.w50,
          w50ci: x.w50ci,
          B: Object.fromEntries(
            Object.entries(x.B)
              .filter(([, v]) => v)
              .map(([kk, v]) => [kk, { med: v.med, ratio: v.ratio, p: v.p, pool: v.pool.slice(0, 5000) }]),
          ),
        },
      ]),
    ),
    ic: r.inConflictCountry,
  };
});
writeFileSync(process.argv[2] || '/tmp/analysis.json', JSON.stringify(out));
console.log('dumped', out.n, 'cases');
await b.close();
