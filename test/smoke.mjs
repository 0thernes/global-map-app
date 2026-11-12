// Headless smoke test: serve the repo over http (as GitHub Pages does), wait for boot, exercise the main panels and
// the tour, and fail on any console error or page error. The optional gitignored private data file (data/private/)
// is the only whitelisted failure, because it is absent in a fresh clone by design. Remote tile errors (offline CI)
// are ignored; any request to Cesium ion is a failure (the app must stay keyless).
import { chromium } from 'playwright';
import { startServer } from './static_server.mjs';

const { server, origin } = await startServer();
const url = `${origin}/index.html?intro=0&private=0`;
const ALLOW = [/data\/private\//, /cases_private/];
const REMOTE = /arcgisonline|arcgis\.com|maps\.eox\.at|openstreetmap|cartocdn|gibs\.earthdata|amazonaws/;
const errors = [];
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(120000); // software WebGL in CI: Cesium frames can take ~1 s, so actions wait longer
page.on('console', (m) => {
  const t = m.text() + ' ' + (m.location().url || '');
  if (m.type() === 'error' && !ALLOW.some((r) => r.test(t)) && !REMOTE.test(t)) errors.push('console: ' + m.text());
});
page.on('request', (r) => /cesium\.com|ion\.cesium/.test(r.url()) && errors.push('Cesium ion request: ' + r.url()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  if (!ALLOW.some((x) => x.test(r.url())) && !/^https:/.test(r.url())) errors.push('requestfailed: ' + r.url());
});
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
const steps = [];
const step = async (name, fn) => {
  const s = Date.now();
  try {
    await fn();
    steps.push([name, 'ok', Date.now() - s]);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    steps.push([name, 'FAIL', Date.now() - s]);
  }
};
await step('cases loaded', async () => {
  const n = await page.evaluate(() => (window.GM_CASES ? window.GM_CASES.length : window.GM_CASES_COLS.n));
  if (!(n > 100)) throw new Error('too few cases ' + n);
});
await step('cesium globe + keyless imagery', async () => {
  const r = await page.evaluate(() => {
    const g = window.__globe();
    return { canvas: !!g.canvas.getContext, layers: g.scene.imageryLayers.length, base: g.basemapId };
  });
  if (!r.canvas || r.layers < 1 || !r.base) throw new Error('globe not initialised ' + JSON.stringify(r));
});
await step('markers glued to the surface', async () => {
  // a world-anchored primitive must move exactly with its lat/lon when the camera moves
  const d = await page.evaluate(async () => {
    const g = window.__globe();
    const c = window.__case(0);
    window.__fly(c.lat, c.lon, 1.6);
    await new Promise((r) => setTimeout(r, 2500));
    const L = g.pointLayers.cases;
    const b = L.bbs[0];
    const S = g.C.SceneTransforms.worldToWindowCoordinates(g.scene, b.position);
    const p = g.project(c.lat, c.lon);
    return S && p ? Math.hypot(S.x - p.x, S.y - p.y) : -1;
  });
  if (!(d >= 0 && d < 3)) throw new Error('marker not anchored, screen error px = ' + d);
});
await step('basemap + terrain switch', async () => {
  await page.evaluate(() => {
    const g = window.__globe();
    g.setBasemap('osm');
    g.setBasemap('esri');
    return g.setTerrain('off');
  });
});
await step('layers panel', () => page.keyboard.press('l'));
await step('filters panel', () => page.keyboard.press('f'));
await step('search', async () => {
  await page.keyboard.press('/');
  await page.keyboard.type('Rendlesham');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
});
await step('charts', async () => {
  await page.keyboard.press('v');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
});
await step('graph', async () => {
  await page.keyboard.press('g');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
});
await step('reports', async () => {
  await page.keyboard.press('e');
  await page.click('#rep-go');
  await page.waitForSelector('.rp-doc');
  await page.keyboard.press('Escape');
});
await step('index tabs', async () => {
  await page.keyboard.press('i');
  for (const t of ['sources', 'glossary', 'az', 'sites', 'countries', 'coverage', 'offworld', 'credits']) {
    await page.click(`[data-rt="${t}"]`);
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
});
await step('settings', async () => {
  await page.keyboard.press(',');
  await page.waitForSelector('#set-body h4');
  await page.keyboard.press('Escape');
});
await step('hotspots', async () => {
  await page.keyboard.press('z');
  await page.waitForSelector('.hsb', { timeout: 120000 });
  await page.click('.hsb');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});
await step('analysis', async () => {
  await page.keyboard.press('a');
  await page.click('#an-run');
  await page.waitForSelector('#an-out .an-ref', { timeout: 120000 });
  await page.keyboard.press('Escape');
});
await step('dossier', async () => {
  await page.evaluate(() => window.__open(window.__case(0)));
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
});
await step('tour', async () => {
  await page.evaluate(() => window.__tour(0));
  await page.waitForSelector('#lowerthird:not([hidden])');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape');
});
await step('timeline play', async () => {
  await page.keyboard.press(' ');
  await page.waitForTimeout(1500);
  await page.keyboard.press(' ');
});
await page.waitForTimeout(500);
await browser.close();
server.close();
for (const s of steps) console.log(`${s[1].padEnd(4)} ${s[0]} (${s[2]} ms)`);
console.log(`boot+steps ${(Date.now() - t0) / 1000}s; errors: ${errors.length}`);
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'));
  process.exit(1);
}
