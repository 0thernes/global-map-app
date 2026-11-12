// Headless smoke test: load index.html from file://, wait for boot, exercise the main panels and the tour,
// and fail on any console error or page error. The optional gitignored private data file (data/private/) is the
// only whitelisted failure, because it is absent in a fresh clone by design.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('index.html')).href + '?intro=0&private=0';
const ALLOW = [/data\/private\//, /cases_private/];
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
page.on('console', (m) => {
  if (m.type() === 'error' && !ALLOW.some((r) => r.test(m.text() + ' ' + (m.location().url || ''))))
    errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  if (!ALLOW.some((x) => x.test(r.url())) && !/^https?:/.test(r.url())) errors.push('requestfailed: ' + r.url());
});
const t0 = Date.now();
await page.goto(url);
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
for (const s of steps) console.log(`${s[1].padEnd(4)} ${s[0]} (${s[2]} ms)`);
console.log(`boot+steps ${(Date.now() - t0) / 1000}s; errors: ${errors.length}`);
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'));
  process.exit(1);
}
