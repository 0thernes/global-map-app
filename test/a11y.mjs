// Automated accessibility check (v1.3): opens every UI view (test/ui_views.mjs) at 1920x1080 and runs axe-core
// with the WCAG 2.0 / 2.1 / 2.2 A + AA rule sets, including colour contrast. Fails on any violation.
// Excluded: #globe (the WebGL canvas: axe cannot read pixels; the globe has its own role and label) and #boot
// (the title card, not shown with ?intro=0). Usage: node test/a11y.mjs [--vp 1920x1080] [--only a,b]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { startServer } from './static_server.mjs';
import { VIEWS, closeAll } from './ui_views.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const [W, H] = arg('vp', '1920x1080').split('x').map(Number);
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const AXE = await readFile('node_modules/axe-core/axe.min.js', 'utf8');
const { server, origin } = await startServer();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(60000);
await page.goto(`${origin}/index.html?intro=0&private=0&basemap=local&terrain=off`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
await page.evaluate(AXE);
let bad = 0,
  n = 0;
const t0 = Date.now();
for (const [name, open] of VIEWS) {
  if (ONLY && !ONLY.includes(name)) continue;
  try {
    await open(page);
    await page.waitForTimeout(800);
    const v = await page.evaluate(async () => {
      const r = await window.axe.run(
        { exclude: [['#globe'], ['#boot']] },
        {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
          resultTypes: ['violations'],
        },
      );
      return r.violations.map((x) => ({
        id: x.id,
        impact: x.impact,
        nodes: x.nodes.slice(0, 4).map((nd) => nd.target.join(' ') + ' :: ' + (nd.failureSummary || '').split('\n')[1]),
        n: x.nodes.length,
      }));
    });
    n++;
    if (v.length) {
      bad += v.length;
      console.log(`✗ ${name}`);
      for (const x of v) console.log(`   ${x.id} (${x.impact}, ${x.n} nodes)\n     ${x.nodes.join('\n     ')}`);
    } else console.log(`✓ ${name}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${name}: could not open (${e.message.split('\n')[0]})`);
  }
  await closeAll(page);
  await page.waitForTimeout(300);
}
console.log(
  `\naxe-core ${await page.evaluate(() => window.axe.version)}: ${n} views at ${W}x${H}, ${bad} violations, ${((Date.now() - t0) / 1000) | 0} s`,
);
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
