// Performance guard (v1.4 polish): headless Chromium on software WebGL (SwiftShader, as in CI).
// 1. Render on demand: an idle globe must not re-render every animation frame (budget: IDLE_MAX frames in 10 s).
// 2. Opening a dossier (fly-to, related-case arcs, reticle) and capturing it must finish within OPEN_MAX ms.
//    test/ui_audit.mjs once spent 92 min on this view; the budget makes a regression fail fast instead of hanging.
// Usage: node test/perf.mjs [--vp 1920x1080]
import { chromium } from 'playwright';
import { startServer } from './static_server.mjs';

const IDLE_MAX = 20;
const OPEN_MAX = 60000;
const i = process.argv.indexOf('--vp');
const [w, h] = (i > 0 ? process.argv[i + 1] : '1920x1080').split('x').map(Number);
const { server, origin } = await startServer();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fails = [];
const withBudget = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} over ${ms} ms`)), ms))]);
try {
  await page.goto(`${origin}/index.html?intro=0&private=0&basemap=local&terrain=off`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 300000 });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(8000); // boot frames, label and layer loading settle
  // Cesium keeps requesting frames while globe tiles stream in (by design); idle starts once they have loaded
  const tilesMs = Date.now();
  await page
    .waitForFunction(() => window.__globe().scene.globe.tilesLoaded, null, { timeout: 120000, polling: 500 })
    .catch(() => fails.push('globe tiles still loading after 120 s'));
  console.log(`tiles loaded after a further ${Date.now() - tilesMs} ms`);
  await page.waitForTimeout(1000);
  const a = await page.evaluate(() => window.__perf());
  await page.waitForTimeout(10000);
  const b = await page.evaluate(() => window.__perf());
  const idle = b.frames - a.frames;
  console.log(`idle: ${idle} frames rendered in 10 s (budget ${IDLE_MAX}); loop CPU ${b.cpuMs} ms/frame`);
  if (idle > IDLE_MAX) fails.push(`idle globe rendered ${idle} frames in 10 s (render on demand broken?)`);
  const t0 = Date.now();
  await withBudget(
    (async () => {
      await page.evaluate(() => window.__open(window.__case(0)));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: '/tmp/gma-perf-dossier.png' });
    })(),
    OPEN_MAX,
    'dossier open + capture',
  );
  console.log(`dossier open + capture: ${Date.now() - t0} ms (budget ${OPEN_MAX})`);
  // the globe must still draw after a state change (a frame arrives once the dossier fly-to ends)
  const c = await page.evaluate(() => window.__perf());
  await page.evaluate(() => window.__fly(10, 10, 2.5));
  await page.waitForTimeout(4000);
  const d = await page.evaluate(() => window.__perf());
  if (d.frames <= c.frames) fails.push('no frame rendered after a fly-to');
} catch (e) {
  fails.push(String(e.message || e));
}
await browser.close();
server.close();
if (errors.length) fails.push('page errors: ' + errors.slice(0, 5).join(' | '));
console.log(fails.length ? 'perf: FAIL\n  ' + fails.join('\n  ') : 'perf: ok');
process.exit(fails.length ? 1 : 0);
