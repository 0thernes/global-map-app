// Render the README/doc screenshots into docs/screenshots (headless Chromium + SwiftShader).
// Usage: node test/screens.mjs [--only name]   (takes a few minutes; the satellite basemap shot needs network)
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--allow-file-access-from-files',
];
const base = pathToFileURL(resolve('index.html')).href;
const browser = await chromium.launch({ args: ARGS });
const done = [];
async function open(q) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(base + q);
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
  return p;
}
async function shot(p, name, fn, wait = 1500) {
  if (only && only !== name) return;
  try {
    await fn();
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    done.push(name);
    console.log('ok', name);
  } catch (e) {
    console.log('FAIL', name, e.message.split('\n')[0]);
  }
}
const esc = async (p, n = 2) => {
  for (let i = 0; i < n; i++) await p.keyboard.press('Escape');
};

// 1. boot / ENGAGE screen
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await shot(
    p,
    '01_engage',
    async () => {
      await p.goto(base + '?private=0&intro=1');
      await p.waitForSelector('#boot:not([hidden])', { timeout: 120000 });
    },
    6000,
  );
  await p.close();
}
const p = await open('?intro=0&private=0');
await shot(p, '02_globe', async () => {}, 3000);
await shot(p, '03_layers_tree', async () => {
  await p.keyboard.press('l');
  await p.evaluate(() => document.querySelectorAll('#layers details').forEach((d) => (d.open = true)));
});
await esc(p);
await shot(
  p,
  '04_offlimits_layer',
  async () => {
    await p.keyboard.press('l');
    await p.evaluate(() => {
      const c = document.querySelector('input[data-layer="map_offlimits_mountains"]');
      if (c && !c.checked) c.click();
      const m = document.querySelector('input[data-layer="military"]');
      if (m && !m.checked) m.click();
    });
    await p.keyboard.press('Escape');
    await p.evaluate(() => window.__fly(37.18, -115.84, 1.25));
  },
  5000,
);
await shot(
  p,
  '05_dossier',
  async () => {
    await p.evaluate(() => window.__open(window.__case(0)));
  },
  2500,
);
await esc(p);
await shot(
  p,
  '06_tour',
  async () => {
    await p.evaluate(() => window.__tour(4));
    await p.waitForSelector('#lowerthird:not([hidden])');
  },
  5000,
);
await esc(p);
await shot(
  p,
  '07_hotspots',
  async () => {
    await p.keyboard.press('z');
    await p.waitForSelector('.hsb', { timeout: 180000 });
    await p.click('.hsb');
  },
  2500,
);
await esc(p, 3);
await shot(
  p,
  '08_report',
  async () => {
    await p.keyboard.press('e');
    await p.click('#rep-go');
    await p.waitForSelector('.rp-doc', { timeout: 120000 });
  },
  1500,
);
await esc(p);
for (const t of ['glossary', 'coverage', 'offworld', 'sources']) {
  await shot(
    p,
    `09_index_${t}`,
    async () => {
      await p.keyboard.press('i');
      await p.click(`[data-rt="${t}"]`);
    },
    1000,
  );
  await esc(p);
}
await shot(
  p,
  '10_charts',
  async () => {
    await p.keyboard.press('v');
  },
  2500,
);
await esc(p);
await shot(
  p,
  '11_analysis',
  async () => {
    await p.keyboard.press('a');
    await p.click('#an-run');
    await p.waitForSelector('#an-out .an-ref', { timeout: 180000 });
  },
  1500,
);
await esc(p);
await shot(
  p,
  '12_settings',
  async () => {
    await p.keyboard.press(',');
    await p.waitForSelector('#set-body h4');
  },
  800,
);
await esc(p);
await p.close();
const s = await open('?intro=0&private=0&basemap=s2');
await shot(
  s,
  '13_satellite_basemap',
  async () => {
    await s.waitForTimeout(15000);
  },
  2000,
);
await browser.close();
console.log('screens', done.length, done.join(' '));
