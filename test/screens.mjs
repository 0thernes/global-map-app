// Render the README/doc screenshots into docs/screenshots (headless Chromium + SwiftShader).
// Usage: node test/screens.mjs [--only name]   (takes a few minutes; the satellite basemap shot needs network)
import { chromium } from 'playwright';
import { startServer } from './static_server.mjs';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// served over http like GitHub Pages, so streamed imagery and 3D terrain are on (they need network)
const { server, origin } = await startServer();
const base = origin + '/index.html';
const browser = await chromium.launch({ args: ARGS });
const done = [];
async function open(q) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  p.setDefaultTimeout(120000);
  await p.goto(base + q);
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
  return p;
}
async function shot(p, name, fn, wait = 1500) {
  if (only && !only.includes(name)) return;
  try {
    await fn();
    await p.waitForTimeout(wait);
    await p.screenshot({ timeout: 180000, path: `${OUT}/${name}.png` });
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
    await p.keyboard.press('l');
    await p.evaluate(() => window.__fly(37.2, -116.6, 1.12));
  },
  7000,
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
  '05b_dossier_pdf7_ref',
  async () => {
    await p.evaluate(() => window.__open(window.__case('UAP-PDF7-rendlesham-1980')));
  },
  9000,
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
for (const t of ['glossary', 'coverage', 'offworld', 'sources', 'pdf7']) {
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
// v1.2 Data panel (PDF 7 as data): one shot per tab that carries new analytics
for (const [name, tab, table, sel] of [
  ['19_data_overview', 'overview', null, '.data-overview'],
  ['20_data_entries', 'entries', null, '.data-entries'],
  ['21_data_charts', 'charts', null, '.fig-tier-bars'],
  ['22_data_tables', 'tables', 'T038', '.data-tables'],
  ['23_data_sources', 'sources', null, '.data-sources'],
  ['24_data_stats', 'stats', null, '.data-corr'],
  ['25_data_unplaced', 'unplaced', null, '.data-unplaced'],
])
  await shot(
    p,
    name,
    async () => {
      await p.evaluate(([t, tb]) => window.__data(t, tb), [tab, table]);
      await p.waitForSelector('#data-body ' + sel, { timeout: 120000 });
    },
    800,
  );
await p.evaluate(() => document.querySelector('#data-close').click());
await p.close();
// streamed imagery at several zoom levels: labels and markers stay glued to the ground
const z = await open('?intro=0&private=0&basemap=hybrid');
const settle = (pg, ms) => pg.waitForTimeout(ms);
const R = 6371008.8;
const views = [
  ['13_zoom_regional_europe', 48.5, 6.0, 2600e3, 25000],
  ['14_zoom_city_london', 51.507, -0.128, 40e3, 35000],
  ['15_zoom_street_nyc', 40.758, -73.9855, 1.2e3, 45000],
  ['16_zoom_terrain_everest', 27.988, 86.925, 30e3, 60000],
  ['17_zoom_case_rendlesham', 52.09, 1.44, 25e3, 35000],
];
for (const [name, lat, lon, alt, ms] of views)
  await shot(
    z,
    name,
    async () => {
      // daylight at the target: set the timeline's UTC hour to local solar noon
      await z.evaluate(
        (h) => {
          const el = document.querySelector('#tl-hour');
          el.value = String(h);
          el.dispatchEvent(new Event('input'));
        },
        ((Math.round(12 - lon / 15) % 24) + 24) % 24,
      );
      await z.evaluate(([a, b, d]) => window.__fly(a, b, d), [lat, lon, 1 + alt / R]);
      await settle(z, ms);
    },
    2000,
  );
await z.close();
const s = await open('?intro=0&private=0&basemap=s2');
await shot(
  s,
  '18_sentinel2_basemap',
  async () => {
    await s.waitForTimeout(15000);
  },
  2000,
);
await browser.close();
server.close();
console.log('screens', done.length, done.join(' '));
