// Shared list of UI views for the audit (test/ui_audit.mjs) and the accessibility check (test/a11y.mjs), v1.4:
// each entry opens one view on a page that has booted with ?intro=0&private=0.
const key = (k) => async (p) => p.keyboard.press(k);
export const closeAll = async (p) => {
  for (let i = 0; i < 3; i++) await p.keyboard.press('Escape');
  // a click on empty page background, as a user would do to dismiss an open menu
  await p.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.body.click();
    if (
      window.__uiReset &&
      (document.body.classList.contains('density-compact') || document.body.classList.contains('theme-hc'))
    )
      window.__uiReset();
    const lg = document.querySelector('#legend');
    if (lg && lg.hidden) document.querySelector('#btn-legend').click();
  });
};
export const VIEWS = [
  ['main', async () => {}],
  [
    'rail_layers',
    async (p) => {
      await p.keyboard.press('l');
      await p.evaluate(() => document.querySelectorAll('#pane-layers details').forEach((d) => (d.open = true)));
    },
  ],
  ['rail_filters', key('f')],
  ['rail_collapsed', async (p) => p.click('#rail-toggle')],
  [
    'legend_info',
    async (p) => {
      await p.evaluate(
        () =>
          document.querySelector('#rail-toggle') &&
          document.body.classList.contains('rail-collapsed') &&
          document.querySelector('#rail-toggle').click(),
      );
      await p.keyboard.press('l');
      await p.evaluate(() => document.querySelector('#pane-layers button.info').click());
    },
  ],
  [
    'search',
    async (p) => {
      await p.fill('#search', 'ross');
      await p.waitForTimeout(800);
    },
  ],
  [
    'palette',
    async (p) => {
      await p.keyboard.press('Control+k');
      await p.waitForSelector('#search-results:not([hidden])');
    },
  ],
  [
    'palette_query',
    async (p) => {
      await p.keyboard.press('Control+k');
      await p.keyboard.type('nuc');
      await p.waitForTimeout(600);
    },
  ],
  [
    'hover_card',
    async (p) => {
      const pt = await p.evaluate(async () => {
        const c = window.__case(0);
        window.__fly(c.lat, c.lon, 1.6);
        await new Promise((r) => setTimeout(r, 2500));
        return window.__globe().project(c.lat, c.lon);
      });
      await p.mouse.move(pt.x + 2, pt.y + 2);
      await p.mouse.move(pt.x, pt.y);
      await p.waitForSelector('#tooltip:not([hidden])', { timeout: 15000 });
    },
  ],
  ['legend_hidden', key('k')],
  [
    'feed',
    async (p) => {
      await p.keyboard.press('n');
      await p.waitForSelector('#feed:not([hidden])');
      await p.waitForTimeout(2500);
    },
  ],
  [
    'feed_recent',
    async (p) => {
      await p.evaluate(() => window.__open(window.__case(0)));
      await p.keyboard.press('n');
      await p.waitForSelector('#feed:not([hidden])');
      await p.click('[data-ft="recent"]');
    },
  ],
  ['export_menu', async (p) => p.evaluate(() => document.querySelector('#btn-export').click())],
  ['dossier', async (p) => p.evaluate(() => window.__open(window.__case(0)))],
  ['dossier_pdf7', async (p) => p.evaluate(() => window.__open(window.__case('UAP-PDF7-rendlesham-1980')))],
  ['wars', key('w')],
  [
    'analysis',
    async (p) => {
      await p.keyboard.press('a');
      await p.click('#an-run');
      await p.waitForSelector('#an-out .an-ref', { timeout: 240000 });
    },
  ],
  ['graph', key('g')],
  ['charts', key('v')],
  ['briefings', key('b')],
  ['compare', key('c')],
  ['help', key('?')],
  [
    'settings',
    async (p) => {
      await p.keyboard.press(',');
      await p.waitForSelector('#set-body h4');
    },
  ],
  [
    'reports',
    async (p) => {
      await p.keyboard.press('e');
      await p.click('#rep-go');
      await p.waitForSelector('.rp-doc', { timeout: 240000 });
    },
  ],
  ...['overview', 'entries', 'charts', 'tables', 'sources', 'stats', 'unplaced'].map((t) => [
    'data_' + t,
    async (p) => {
      await p.evaluate(([a, b]) => window.__data(a, b), [t, t === 'tables' ? 'T038' : null]);
      await p.waitForTimeout(1500);
    },
  ]),
  ...['sources', 'glossary', 'az', 'sites', 'countries', 'coverage', 'offworld', 'pdf7', 'credits'].map((t) => [
    'index_' + t,
    async (p) => {
      await p.keyboard.press('i');
      await p.click(`[data-rt="${t}"]`);
    },
  ]),
  [
    'hotspots',
    async (p) => {
      await p.keyboard.press('z');
      await p.waitForSelector('.hsb', { timeout: 240000 });
    },
  ],
  [
    'hs_dossier',
    async (p) => {
      await p.keyboard.press('z');
      await p.waitForSelector('.hsb', { timeout: 240000 });
      await p.click('.hsb');
    },
  ],
  [
    'tour',
    async (p) => {
      await p.evaluate(() => window.__tour(4));
      await p.waitForSelector('#lowerthird:not([hidden])');
    },
  ],
  [
    'compact',
    async (p) => {
      await p.keyboard.press('u');
      await p.evaluate(() => window.__open(window.__case(0)));
    },
  ],
  [
    'high_contrast',
    async (p) => {
      await p.keyboard.press('x');
      await p.evaluate(() => window.__open(window.__case(0)));
    },
  ],
  [
    'multi_open',
    async (p) => {
      // the ergonomic worst case: several panels at once
      await p.evaluate(() => window.__open(window.__case(0)));
      await p.keyboard.press('w');
      await p.keyboard.press('v');
    },
  ],
  [
    'console_full',
    async (p) => {
      // v1.4 worst case: dossier + feed on the right, charts docked at the bottom, legend and map tools
      await p.evaluate(() => window.__open(window.__case(0)));
      await p.keyboard.press('n');
      await p.keyboard.press('v');
      await p.waitForSelector('#charts:not([hidden])');
    },
  ],
];
