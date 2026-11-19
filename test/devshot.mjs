// Quick dev capture: node test/devshot.mjs --vp 1920x1080 --only main,dossier [--out /tmp/dev] [--q "&x=1"]
// Opens each named view from test/ui_views.mjs and saves a PNG plus any console errors. Not part of CI.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { startServer } from './static_server.mjs';
import { VIEWS, closeAll } from './ui_views.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const [W, H] = arg('vp', '1920x1080').split('x').map(Number);
const ONLY = arg('only', 'main').split(',');
const OUT = arg('out', '/tmp/dev');
await mkdir(OUT, { recursive: true });
const { server, origin } = await startServer();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)));
await page.goto(`${origin}/index.html?intro=0&private=0&basemap=local&terrain=off${arg('q', '')}`);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
await page.waitForTimeout(3000);
for (const [name, fn] of VIEWS.filter(([n]) => ONLY.includes(n))) {
  try {
    await fn(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${W}x${H}_${name}.png` });
    console.log('ok', name);
  } catch (e) {
    console.log('FAIL', name, e.message.split('\n')[0]);
  }
  await closeAll(page);
}
await browser.close();
server.close();
