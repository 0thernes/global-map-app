// v1.5.1 hardening audit (docs/audit/hardening/FINDINGS.md): one regression test per bug or issue fixed in code.
// Finding ids are in the test names so a failure points at the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { gradeClass } from '../../src/grades.js';
import { militaryInAnalysis } from '../../src/taxonomy.js';
import { cleanWikidataPlaceholders } from '../../src/data_clean.js';
import { fold, csvCell, toCSV } from '../../src/text.js';
import { sanitizeWorkspace } from '../../src/ui/workspace.js';
import { safeHTML } from '../../src/ui/sanitize.js';
import { DEFAULT_RADIUS_KM, radiusKm, markerOf } from '../../src/ui/symbology.js';
import { bootFailure } from '../../src/ui/states.js';
import { dbscan, weightedSampler, GeoIndex, rng } from '../../src/stats.js';
import { dateToDay, NDAYS, DAYMIN } from '../../src/geo.js';

const loadReg = (path) => {
  const reg = {};
  vm.runInNewContext(readFileSync(path, 'utf8'), { GM: { reg: (k, v) => (reg[k] = v) } });
  return reg;
};
const publicCases = () => {
  const w = {};
  vm.runInNewContext(readFileSync('data/cases.js', 'utf8'), { window: w });
  return w.GM_CASES;
};

test('F-D11-1: gendarmerie and forts are excluded from every military analysis, other kinds are kept', () => {
  assert.equal(militaryInAnalysis({ kind: 'gendarmerie/police barracks (Wikidata)' }), false);
  assert.equal(militaryInAnalysis({ kind: 'fort (Wikidata; often historic)' }), false);
  assert.equal(militaryInAnalysis({ kind: 'air base (Wikidata)' }), true);
  assert.equal(militaryInAnalysis({ kind: 'military base', src: 'MIRTA' }), true);
  assert.equal(militaryInAnalysis({}), true);
  // the dossier, analysis and hotspots all import the one predicate (no private copies of the regex)
  for (const f of ['src/ui_panels.js', 'src/ui_analysis.js', 'src/ui_hotspots.js'])
    assert.match(readFileSync(f, 'utf8'), /militaryInAnalysis/, f);
  assert.doesNotMatch(readFileSync('src/ui_analysis.js', 'utf8'), /\^\(fort\|gendarmerie\)/);
});

test('F-B13-1/2: a parenthetical about another case never raises the grade; "unofficial" is not Official', () => {
  assert.equal(gradeClass('Origin note (nearby case CIT)'), 'Other');
  assert.equal(gradeClass('Official record / Origin note'), 'Official record');
  assert.equal(gradeClass('Official record / CIT'), 'CIT');
  assert.equal(gradeClass('Online claim (ungraded)'), 'Online claim');
  assert.equal(gradeClass('Online claim (trail only)'), 'Online claim');
  assert.equal(gradeClass('unofficial report'), 'Other');
  assert.equal(gradeClass('non-official testimony'), 'Testimony');
  assert.equal(gradeClass('Credible Insider Testimony'), 'CIT');
});

test('F-D16-1: Wikidata unknown-value placeholders become explicit unknowns; real links are untouched', () => {
  const r = cleanWikidataPlaceholders({
    name: 'Base X',
    status: 'dissolved http://www',
    dissolved: 'http://www',
    inception: 'http://www',
    country: 'http://www.wikidata.org/.well-known/genid/7fbae720ce961feb0b6dd11c44602f89',
    url: 'http://www.example.org/base',
    summary: 'nuclear power plant; closed http://www',
  });
  assert.equal(r.status, 'dissolved (date unknown in Wikidata)');
  assert.equal(r.dissolved, '');
  assert.equal(r.inception, '');
  assert.equal(r.country, '');
  assert.equal(r.url, 'http://www.example.org/base');
  assert.equal(r.summary, 'nuclear power plant; closed (date unknown in Wikidata)');
  assert.deepEqual(r._unknown.sort(), ['country', 'dissolved', 'inception', 'status', 'summary']);
  const clean = { name: 'y', url: 'https://www.wikidata.org/wiki/Q1' };
  assert.equal(cleanWikidataPlaceholders(clean), clean, 'rows without placeholders are returned as is (no copy)');
});

test('F-D16-1: after load-time cleaning no shipped layer row shows a placeholder', () => {
  for (const [file, name] of [
    ['data/layers/military.js', 'military'],
    ['data/layers/map_nuclear_sites.js', 'map_nuclear_sites'],
  ]) {
    const items = loadReg(file)[name].items;
    const bad = items
      .map(cleanWikidataPlaceholders)
      .filter((it) =>
        Object.entries(it).some(
          ([k, v]) =>
            typeof v === 'string' && !/url$/.test(k) && /(^|\s)https?:\/\/www(\.wikidata\.org\/\.well-known|$)/.test(v),
        ),
      );
    assert.equal(bad.length, 0, `${name}: ${bad.length} rows still carry a placeholder`);
  }
});

test('F-B16-1: CSV cells are RFC 4180 quoted and spreadsheet formulas from data are neutralised', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
  assert.equal(csvCell('+1-555'), "'+1-555");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('-cmd|calc'), "'-cmd|calc");
  assert.equal(csvCell(-12.5), '-12.5');
  assert.equal(csvCell('-12.5'), '-12.5');
  assert.equal(csvCell('-2560-01-01'), '-2560-01-01', 'BCE ISO dates are data');
  assert.equal(csvCell('line1\rline2'), '"line1\rline2"', 'a bare CR is quoted too');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(['a', 'b']), '"[""a"",""b""]"', 'arrays are JSON, not "a,b" or [object Object]');
  assert.equal(toCSV([{ a: 1, b: 'x,y' }], ['a', 'b']), 'a,b\r\n1,"x,y"');
});

test('F-G01-1: search folding ignores case and diacritics', () => {
  assert.equal(fold('Nürnberg'), 'nurnberg');
  assert.equal(fold('GÉIPAN São Tomé'), 'geipan sao tome');
  assert.equal(fold('Ελληνικά'), 'ελληνικα');
  assert.ok(fold('Ciudad de México, Zócalo').includes(fold('mexico')));
  assert.equal(fold(null), '');
});

test('F-B15-1: workspace files are validated and clamped before they touch app state', () => {
  const lim = { dayMin: DAYMIN, dayMax: NDAYS, layerIds: ['cases', 'military'] };
  assert.throws(() => sanitizeWorkspace(null, lim), /not a Global Map workspace/);
  assert.throws(() => sanitizeWorkspace([], lim), /not a Global Map workspace/);
  assert.throws(() => sanitizeWorkspace({ v: 9 }, lim), /version 9/);
  const w = sanitizeWorkspace(
    {
      v: 1,
      cur: 9e15,
      hour: 99,
      camera: [1, 'x', 3],
      layers: ['cases', 'nope', 7, 'cases'],
      filters: { cats: ['UAP case', { a: 1 }], range: [NDAYS + 50, -1e12], q: 'NÜRNBERG' },
      notes: 'n',
      pinned: 'not-a-list',
      selected: 5,
    },
    lim,
  );
  assert.equal(w.cur, NDAYS);
  assert.equal(w.hour, 24);
  assert.equal(w.camera, null, 'a malformed camera is dropped, not spread into set()');
  assert.deepEqual(w.layers, ['cases']);
  assert.deepEqual(w.filters.cats, ['UAP case']);
  assert.deepEqual(w.filters.range, [DAYMIN, NDAYS]);
  assert.equal(w.filters.q, 'nurnberg');
  assert.deepEqual(w.pinned, []);
  assert.equal(w.selected, null);
  const ok = sanitizeWorkspace({ cur: 100, camera: [1, 2, 3], filters: {} }, lim);
  assert.deepEqual(ok.camera, [1, 2, 3]);
  assert.equal(ok.cur, 100);
  // the UI wraps parse + restore and guards localStorage
  const ui = readFileSync('src/ui_panels.js', 'utf8');
  assert.match(ui, /export function restoreText/);
  assert.doesNotMatch(ui, /restore\(JSON\.parse/);
});

test('F-C04-1: the Markdown sanitiser strips active content and unsafe URLs', () => {
  const { document } = new JSDOM('').window;
  const vectors = [
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href=" JaVaScRiPt:alert(1)">x</a>',
    '<a href="java&#x09;script:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<svg><script>alert(1)</script></svg>',
    '<iframe src="https://evil.example"></iframe>',
    '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
    '<p style="background:url(javascript:alert(1))">x</p>',
    '<img srcset="javascript:alert(1) 1x">',
    '<form action="https://evil.example"><button>go</button></form>',
    '<template><img src=x onerror=alert(1)></template>',
    '<object data="x.swf"></object><embed src="x.swf">',
    '<base href="https://evil.example/">',
  ];
  for (const v of vectors) {
    const out = safeHTML(v, document);
    assert.doesNotMatch(
      out,
      /onerror|javascript:|<script|<iframe|<svg|<math|style=|srcset|<form|<object|<embed|<base|data:text/i,
      v,
    );
  }
  const keep = safeHTML('<p>See <a href="https://ucdp.uu.se/">UCDP</a> and <img src="map.png" alt="m"></p>', document);
  assert.match(keep, /href="https:\/\/ucdp\.uu\.se\/"/);
  assert.match(keep, /rel="noopener noreferrer"/);
  assert.match(keep, /src="map\.png"/);
});

test('F-B14-1: uncertainty radius defaults follow coord_precision and match the pipeline table', () => {
  assert.equal(radiusKm({ coord_precision: 'region' }), 100);
  assert.equal(radiusKm({ coord_precision: 'locality' }), 10);
  assert.equal(radiusKm({ coord_precision: 'installation' }), 25, 'unknown vocabulary is drawn as unspecified');
  assert.equal(radiusKm({ coord_precision: 'region', coord_radius_km: 40 }), 40, 'a stated radius always wins');
  assert.equal(markerOf({ coord_precision: 'region' }).radiusKm, 100);
  const py = readFileSync('data/build_data.py', 'utf8').match(/^PREC = (\{[^}]+\})/m)[1];
  assert.deepEqual(JSON.parse(py.replace(/'/g, '"')), DEFAULT_RADIUS_KM, 'build_data.PREC == DEFAULT_RADIUS_KM');
  assert.doesNotMatch(readFileSync('src/app_core.js', 'utf8'), /coord_radius_km \|\| 10/);
});

test('F-B11-1: every public case lies inside the timeline (a data refresh past NDAYS would hide rows)', () => {
  const late = publicCases().filter((c) => dateToDay(c.date) > NDAYS || dateToDay(c.date_low) > NDAYS);
  assert.equal(late.length, 0, late.map((c) => c.id).join(', '));
  assert.doesNotMatch(readFileSync('src/ui_timeline.js', 'utf8'), /latest dated case \(2026/);
});

test('F-B12-1/2: DBSCAN is unchanged by the Set rewrite; zero-weight samplers draw nothing', () => {
  const r = rng(3);
  const P = [];
  for (let i = 0; i < 300; i++) P.push({ lat: 10 + r() * 0.5, lon: 20 + r() * 0.5 });
  for (let i = 0; i < 300; i++) P.push({ lat: -40 + r() * 0.5, lon: 150 + r() * 0.5 });
  P.push({ lat: 70, lon: -100 });
  const t0 = performance.now();
  const d = dbscan(P, 30, 5);
  assert.equal(d.clusters, 2);
  assert.equal(d.labels[600], -1);
  assert.ok(performance.now() - t0 < 5000, 'dense clusters finish quickly');
  assert.equal(weightedSampler([{ w: 0 }, { w: 0 }], (x) => x.w)(Math.random), null);
  assert.equal(weightedSampler([], () => 1)(Math.random), null);
});

test('F-B12-3: segments crossing the antimeridian are indexed the short way round', () => {
  const ix = new GeoIndex(2);
  ix.addSegment(-17, 179.5, -17, -179.5, 'fiji');
  ix.addSegment(-17, 170, -17, 171, 'far');
  const n = ix.nearest(-17.2, -179.8);
  assert.equal(n.ref, 'fiji');
  assert.ok(n.d < 30, `distance ${n.d}`);
  assert.ok(ix.n <= 4, `registered in ${ix.n} cells, not the whole latitude band`);
});

test('F-H01-1: boot failures produce a user-facing message with a WebGL hint when relevant', () => {
  assert.match(bootFailure(new Error('WebGL initialization failed')).title, /WebGL is not available/);
  assert.match(bootFailure(new Error('x is undefined')).title, /could not start/);
  assert.match(bootFailure('weird').detail, /weird/);
  assert.match(readFileSync('src/app.js', 'utf8'), /bootFailure\(e\)/);
});

test('F-K06-1: one version string everywhere', () => {
  const v = JSON.parse(readFileSync('package.json', 'utf8')).version;
  assert.equal(JSON.parse(readFileSync('package-lock.json', 'utf8')).version, v);
  assert.match(readFileSync('index.html', 'utf8'), new RegExp(`OSINT · v${v.replace(/\./g, '\\.')}<`));
  assert.match(readFileSync('CITATION.cff', 'utf8'), new RegExp(`^version: ${v.replace(/\./g, '\\.')}$`, 'm'));
  assert.match(readFileSync('CITATION.cff', 'utf8'), /^cff-version: 1\.2\.0$/m);
  assert.match(readFileSync('CHANGELOG.md', 'utf8'), new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\]`, 'm'));
});

test('F-D22-1: spreadsheet datetimes keep their day (UCDP conflict starts/ends were truncated to 1 January)', () => {
  const items = loadReg('data/layers/map_conflicts.js').map_conflicts.items;
  const dated = items.filter((r) => r.date_high);
  assert.ok(dated.length > 300);
  // a real end-date distribution: most UCDP episodes do not end on 1 January
  assert.ok(dated.filter((r) => !/-01-01$/.test(r.date_high)).length > 200);
  assert.ok(items.every((r) => !r.date || /^-?\d{4}-\d\d-\d\d$/.test(r.date)));
});

test('F-D23-1: date_precision is never finer than the date (impossible GEIPAN day kept to the month)', () => {
  const c = publicCases().find((r) => r.id === 'GEIPAN-1811');
  assert.equal(c.date, '2000-09-01');
  assert.equal(c.date_precision, 'month');
  assert.match(c.date_note, /2000-09-31/);
});

test('F-D24-1: integer text has no spreadsheet float tail; French postal codes keep 5 digits', () => {
  const cases = publicCases();
  assert.ok(cases.every((r) => !/\.0$/.test(r.witness_count ?? '') && !/\.0$/.test(r.count ?? '')));
  const fr = cases.filter((r) => r.postal_code != null && /INSEE/.test(r.coord_source || ''));
  assert.ok(fr.length > 2000);
  assert.ok(
    fr.every((r) => /^\d{5}$/.test(r.postal_code)),
    'French postal codes are 5 digits',
  );
});

test('F-D25-1: every public case names its dataset', () => {
  const missing = publicCases().filter((r) => !r.dataset);
  assert.equal(missing.length, 0, missing.map((r) => r.id).join(', '));
});

test('F-C05-1: every new-tab link drops the opener and the referrer', () => {
  for (const f of [
    'src/app_core.js',
    'src/cinema.js',
    'src/report_gen.js',
    'src/ui_misc.js',
    'src/ui_panels.js',
    'src/ui/feed.js',
  ]) {
    const src = readFileSync(f, 'utf8');
    const blank = src.match(/target="_blank"[^>]*/g) || [];
    for (const a of blank) assert.match(a, /rel="noopener noreferrer"/, `${f}: ${a}`);
  }
});

test('F-B10-1 (static guard): the printable dossier checks for a blocked pop-up before writing to it', () => {
  const src = readFileSync('src/ui_panels.js', 'utf8');
  const i = src.indexOf("window.open('', '_blank')");
  assert.ok(i > 0);
  const after = src.slice(i, i + 400);
  assert.match(after, /if \(!w\)/);
  assert.match(after, /w\.opener = null/);
  assert.ok(after.indexOf('if (!w)') < after.indexOf('w.document.write'));
});

test('F-D15-1 / F-D23-1 (static guard): every reference dossier has a Coord. source row; case dossiers show date_note', () => {
  const src = readFileSync('src/ui_panels.js', 'utf8');
  const ref = src.slice(src.indexOf('function refHTML'), src.indexOf('function refHTML') + 4000);
  assert.match(ref, /row\('Coord\. source', esc\(csrc \|\| 'not stated'\)\)/);
  assert.match(ref, /As published in the/);
  assert.match(src.slice(src.indexOf('function caseHTML'), src.indexOf('function caseHTML') + 800), /c\.date_note/);
});

test('F-J05-1: the site package ships git-tracked files only', async () => {
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, rmSync, existsSync } = await import('node:fs');
  const probe = 'data/__untracked_probe.js';
  writeFileSync(probe, '// untracked probe\n');
  try {
    execFileSync('node', ['scripts/package.mjs', '--site'], { stdio: 'pipe' });
    assert.equal(existsSync('dist/site/' + probe), false);
    assert.equal(existsSync('dist/site/js/app.js'), true);
  } finally {
    rmSync(probe, { force: true });
  }
});
