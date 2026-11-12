// Shared list of UI views for the audit (test/ui_audit.mjs) and the accessibility check (test/a11y.mjs):
// each entry opens one view on a page that has booted with ?intro=0&private=0.
const key = (k) => async (p) => p.keyboard.press(k);
export const closeAll = async (p) => {
  for (let i = 0; i < 3; i++) await p.keyboard.press('Escape');
  // a click on empty page background, as a user would do to dismiss an open menu
  await p.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.body.click();
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
    'multi_open',
    async (p) => {
      // the ergonomic worst case: several panels at once
      await p.evaluate(() => window.__open(window.__case(0)));
      await p.keyboard.press('w');
      await p.keyboard.press('v');
    },
  ],
];
