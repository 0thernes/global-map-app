// v1.5 low-fi wireframes (ADR 0005, building on ADR 0004): generates docs/design/wireframes/*.svg from one layout
// model and renders each to PNG with headless Chromium. Boxes are layout regions with their real pixel sizes from
// css/tokens.css and css/console.css; the text inside is annotation, not data. New in v1.5: the globe reference layer
// (graticule, terminator, twilight rings), the marker grammar (grade-gauge pins, dashed uncertainty circles), the
// 7-button map-tool column and the panel states (loading, empty, error).
// Usage: node scripts/design/wireframes_v15.mjs [--no-png]
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'docs/design/wireframes');

// ---- layout model: mirrors css/tokens.css + css/console.css (keep in sync; the unit test reads both) ----
export function model(vw, vh) {
  const big = vw >= 2560; // 4K at DPR 1: the 1.25x ladder
  const k = big ? 1.25 : 1;
  const px = (n) => Math.round(n * k);
  const top = px(56),
    act = px(56),
    tl = px(160), // polish pass: transport row, overview + detail track, focus + read-out row
    gap = px(8),
    credit = px(24);
  const rail = vw < 1440 ? 304 : big ? 420 : 336;
  const dossier = px(420);
  return { k, top, act, tl, gap, credit, rail, dossier, vw, vh, big };
}

const C = {
  bg: '#03060C',
  grid: '#0d1f33',
  chrome: '#9DB1C2',
  panel: '#7C9CFF',
  globe: '#38E8FF',
  accent: '#FFC857',
  ok: '#6DFF8E',
  text: '#C9D7E2',
  dim: '#7A90A3',
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(vw, vh, title, parts) {
  const fs = vw >= 2560 ? 1.25 : 1;
  const s = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" font-family="Inter, system-ui, sans-serif">`,
    `<rect width="${vw}" height="${vh}" fill="${C.bg}"/>`,
    `<defs><pattern id="g" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="${C.grid}" stroke-width="0.5"/></pattern></defs>`,
    `<rect width="${vw}" height="${vh}" fill="url(#g)" opacity="0.6"/>`,
  ];
  for (const p of parts) s.push(p(fs));
  s.push(
    `<text x="${vw - 16}" y="${vh - 6}" text-anchor="end" fill="${C.dim}" font-size="${11 * fs}">WIREFRAME v1.5 · ${esc(title)} · ${vw}x${vh} · boxes = regions at real px, not data</text>`,
  );
  s.push('</svg>');
  return s.join('\n');
}
const box =
  (x, y, w, h, label, kind = 'panel', lines = []) =>
  (fs) => {
    const col = C[kind] || C.panel;
    const out = [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${6 * fs}" fill="rgba(16,26,43,0.88)" stroke="${col}" stroke-width="${1.5 * fs}"/>`,
    ];
    const lh = 16 * fs;
    if (label)
      out.push(
        `<text x="${x + 10 * fs}" y="${y + 20 * fs}" fill="${col}" font-size="${13 * fs}" font-weight="600">${esc(label)}</text>`,
      );
    lines.forEach((l, i) => {
      if (y + 20 * fs + (i + 1) * lh < y + h - 4)
        out.push(
          `<text x="${x + 10 * fs}" y="${y + 20 * fs + (i + 1) * lh}" fill="${C.text}" font-size="${11.5 * fs}">${esc(l)}</text>`,
        );
    });
    return out.join('');
  };
const globe = (x, y, w, h, note) => (fs) =>
  `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2 - 20 * fs}" fill="#0B1F33" stroke="${C.globe}" stroke-width="${2 * fs}" stroke-dasharray="${8 * fs} ${6 * fs}"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" fill="${C.globe}" font-size="${15 * fs}" font-weight="600">GLOBE: dominant canvas, re-centred in the free area</text>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + 20 * fs}" text-anchor="middle" fill="${C.text}" font-size="${12 * fs}">${esc(note || 'pins = exact_site / within_1km · circles = locality / region · cluster badges · ground-clamped labels')}</text>`;
// v1.5 marker grammar: a pin is a ring gauge (arc = grade weight) with crosshair ticks; a circle is dashed with a
// hollow diamond centre; neither is ever jittered
const pin =
  (x, y, f = 1) =>
  (fs) => {
    const r = 9 * fs;
    const a = -Math.PI / 2 + f * 2 * Math.PI;
    const arc =
      f >= 1
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.globe}" stroke-width="${3 * fs}"/>`
        : `<path d="M${x} ${y - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x + r * Math.cos(a)} ${y + r * Math.sin(a)}" fill="none" stroke="${C.globe}" stroke-width="${3 * fs}"/>`;
    const t = 14 * fs;
    return (
      `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.globe}" stroke-opacity="0.35" stroke-width="${2 * fs}"/>` +
      arc +
      `<circle cx="${x}" cy="${y}" r="${3 * fs}" fill="${C.globe}"/>` +
      `<path d="M${x} ${y - t}v${4 * fs}M${x} ${y + t}v${-4 * fs}M${x - t} ${y}h${4 * fs}M${x + t} ${y}h${-4 * fs}" stroke="${C.globe}" stroke-width="${1.5 * fs}"/>`
    );
  };
const ring = (x, y, r) => (fs) =>
  `<circle cx="${x}" cy="${y}" r="${r * fs}" fill="rgba(56,232,255,0.06)" stroke="${C.globe}" stroke-width="${1.2 * fs}" stroke-dasharray="${4 * fs} ${4 * fs}"/>` +
  `<path d="M${x} ${y - 4 * fs} l${4 * fs} ${4 * fs} l${-4 * fs} ${4 * fs} l${-4 * fs} ${-4 * fs}z" fill="none" stroke="${C.globe}" stroke-width="${1.2 * fs}"/>`;
// graticule and terminator drawn inside the globe disc (orthographic sketch, not to scale)
const reference = (cx, cy, R) => (fs) => {
  const out = [];
  for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const yy = cy + k * R,
      hw = Math.sqrt(1 - k * k) * R;
    out.push(
      `<line x1="${cx - hw}" y1="${yy}" x2="${cx + hw}" y2="${yy}" stroke="${k === 0 ? C.globe : '#A9D6FF'}" stroke-opacity="${k === 0 ? 0.6 : 0.3}" stroke-width="${fs}"/>`,
    );
    out.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(k) * R}" ry="${R}" fill="none" stroke="${k === 0 ? C.globe : '#A9D6FF'}" stroke-opacity="${k === 0 ? 0.6 : 0.3}" stroke-width="${fs}"/>`,
    );
  }
  out.push(
    `<path d="M${cx + 0.25 * R} ${cy - 0.97 * R} Q${cx + 0.62 * R} ${cy} ${cx + 0.25 * R} ${cy + 0.97 * R}" fill="none" stroke="${C.accent}" stroke-width="${2 * fs}"/>`,
  );
  for (const [i, op] of [
    [1, 0.45],
    [2, 0.32],
    [3, 0.22],
  ])
    out.push(
      `<path d="M${cx + (0.25 + i * 0.09) * R} ${cy - 0.95 * R} Q${cx + (0.62 + i * 0.1) * R} ${cy} ${cx + (0.25 + i * 0.09) * R} ${cy + 0.95 * R}" fill="none" stroke="${C.accent}" stroke-opacity="${op}" stroke-width="${1.2 * fs}" stroke-dasharray="${5 * fs} ${5 * fs}"/>`,
    );
  out.push(
    `<text x="${cx + 0.7 * R}" y="${cy - 0.62 * R}" fill="${C.accent}" font-size="${11 * fs}">terminator · civil · nautical · astronomical (Y)</text>`,
    `<text x="${cx - 0.95 * R}" y="${cy - 0.02 * R}" fill="${C.globe}" font-size="${11 * fs}">0° (Equator)</text>`,
    `<text x="${cx - 0.6 * R}" y="${cy - 0.69 * R}" fill="#A9D6FF" font-size="${11 * fs}">30°N  · grid spacing follows zoom (J)</text>`,
  );
  return out.join('');
};
const reticle = (x, y) => (fs) => {
  const s = 18 * fs,
    t = 7 * fs;
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
    .map(
      ([a, b]) =>
        `<path d="M${x + a * s} ${y + b * s + -b * t} V${y + b * s} H${x + a * s + -a * t}" fill="none" stroke="${C.accent}" stroke-width="${2 * fs}"/>`,
    )
    .join('');
};
const badge = (x, y, n) => (fs) =>
  `<circle cx="${x}" cy="${y}" r="${13 * fs}" fill="#0b1220" stroke="${C.globe}" stroke-width="${2 * fs}"/><text x="${x}" y="${y + 4 * fs}" text-anchor="middle" fill="${C.text}" font-size="${11 * fs}" font-weight="600">${n}</text>`;

function frame(
  m,
  {
    rail = true,
    dossier = false,
    feed = false,
    bottom = false,
    palette = false,
    tooltip = false,
    ref = false,
    states = false,
  },
) {
  const { vw, vh, top, act, tl, gap, credit, k } = m;
  const P = [];
  const narrowBar = vw < 1440;
  // command bar
  P.push(box(0, 0, vw, top, '', 'chrome'));
  const segs = narrowBar
    ? [
        [140, 'GLOBAL MAP'],
        [300, 'Search or command … Ctrl K'],
        [330, 'Grades ● ● ● ● ● ● (filtered counts)'],
        [150, 'UTC 03:21Z · PT 19:21'],
        [190, 'shot · export · sound · ⚙ · ?'],
      ]
    : [
        [200, 'GLOBAL MAP  v1.5 · sourced'],
        [560, 'Search cases, places, layers, commands …  Ctrl K'],
        [
          vw >= 2560 ? 900 : 470,
          'CIT 12 · Official 940 · ST 31 · TE 1.2k · Online 88 · Other 9 | data 2026-11-12 | USGS ● EONET ●',
        ],
        [220, 'UTC 03:21:05Z  ·  PT 19:21:05'],
        [220, 'shot · export · sound · settings · help'],
      ];
  let x = gap;
  const total = segs.reduce((a, s) => a + s[0] * k, 0) + gap * (segs.length + 1);
  const spare = Math.max(0, vw - total);
  segs.forEach(([w, l], i) => {
    const ww = w * k + (i === 2 ? spare : 0);
    P.push(box(x, gap, ww, top - 2 * gap, l, i === 1 ? 'accent' : 'chrome'));
    x += ww + gap;
  });
  // activity bar
  const ab = vh - top - tl;
  P.push(box(0, top, act, ab, '', 'chrome', []), (fs) => {
    // 13 view buttons in 3 groups (rail · analysis · intel), 40 px targets on a 44 px pitch, 8 px group gaps
    const out = [];
    let y = top + 8 * k;
    [2, 6, 5].forEach((n, g) => {
      for (let i = 0; i < n; i++, y += 44 * k)
        out.push(
          `<rect x="${8 * k}" y="${y}" width="${40 * k}" height="${40 * k}" rx="${4 * fs}" fill="none" stroke="${g === 0 ? C.accent : C.chrome}" stroke-width="${fs}"/>`,
        );
      y += 8 * k;
    });
    return out.join('');
  });
  const L = act + gap;
  let left = act;
  if (rail) {
    P.push(
      box(L, top + gap, m.rail, ab - 2 * gap, 'LAYER / FILTER RAIL (L / F, collapsible)', 'panel', [
        'tabs: Layers | Filters  · count line (tabular)',
        'Filters: category · grade · era · country',
        '          coord_precision (exact · 1 km · locality · region)',
        'Layers: groups, opacity, info',
        'one scroll region; sticky group headers',
      ]),
    );
    left = L + m.rail;
  }
  let right = vw;
  if (dossier) {
    right -= m.dossier + gap;
    P.push(
      box(right, top + gap, m.dossier, ab - 2 * gap, 'CASE DOSSIER (right dock)', 'panel', [
        '[icon] CATEGORY · grade chip · marker chip (pin / circle)',
        'Title (Inter 600, fs-4)',
        'PROVENANCE  source · grade · coord_source · precision',
        'date · place · coordinates (mono, tabular)',
        'What happened · links (domain shown)',
        'Related cases · nearby reference sites',
        'export .md / printable',
      ]),
    );
  }
  if (feed) {
    const fw = Math.round(340 * k);
    right -= fw + gap;
    P.push(
      box(right, top + gap, fw, ab - 2 * gap, 'ACTIVITY FEED (N)', 'panel', [
        'tabs: Live | Recent',
        'USGS M4.5+ 30 d · NASA EONET open',
        'each row: time (UTC) · kind · place',
        'click = fly to; source link',
        'Recent: dossiers opened, filters applied',
      ]),
    );
    if (states) {
      const fx = right + 10 * k,
        fwi = fw - 20 * k;
      [
        ['LOADING  ◌ spinner · role=status · aria-busy', 'what is happening, what is being read'],
        ['EMPTY  ▭ inbox · role=status', 'why nothing shows · how to get something'],
        ['ERROR  ⚠ role=alert · red edge', 'what failed (USGS / EONET) · [Try again]'],
      ].forEach(([t, d], i) =>
        P.push(box(fx, top + gap + (150 + i * 96) * k, fwi, 84 * k, t, i === 2 ? 'accent' : 'ok', [d])),
      );
    }
  }
  const gl = left,
    gr = right;
  let gb = vh - tl - credit;
  if (bottom) {
    const bh = Math.round((vh - top - tl) * 0.38);
    P.push(
      box(gl + gap, vh - tl - gap - bh, gr - gl - 2 * gap, bh, 'BOTTOM DOCK (charts / analysis)', 'panel', [
        'docked windows tile, never overlap; globe re-centres',
      ]),
    );
    gb = vh - tl - gap - bh - gap;
  }
  // v1.5 map tools: 7 targets (home · lasso · random | grid · terminator · heat | legend), 40 px on a 44 px pitch
  P.push(box(gr - gap - 48 * k, top + gap, 48 * k, 7 * 44 * k + 17 * k, '', 'chrome'), (fs) =>
    ['home O', 'lasso S', 'random R', '— grid J', 'terminator Y', 'heat H', '— legend K']
      .map(
        (t, i) =>
          `<text x="${gr - gap - 56 * k}" y="${top + gap + (26 + i * 44) * k}" text-anchor="end" fill="${C.text}" font-size="${11 * fs}">${esc(t)}</text>`,
      )
      .join(''),
  );
  P.push(
    globe(
      gl,
      top,
      gr - gl,
      gb - top,
      dossier
        ? 'selection reticle on the open case · hover card on pointer'
        : 'pins: ring arc = evidence grade · dashed circles: locality / region at stated radius · never jittered',
    ),
  );
  const cx = (gl + gr) / 2,
    cy = (top + gb) / 2;
  if (ref) P.push(reference(cx, cy, Math.min(gr - gl, gb - top) / 2 - 20 * k));
  P.push(
    pin(cx - 60 * k, cy - 70 * k, 1),
    pin(cx - 20 * k, cy - 100 * k, 0.5),
    pin(cx + 10 * k, cy - 72 * k, 0.25),
    ring(cx + 70 * k, cy - 40 * k, 22),
    badge(cx - 120 * k, cy + 50 * k, 42),
  );
  if (dossier) P.push(reticle(cx + 70 * k, cy - 40 * k));
  if (tooltip)
    P.push(
      box(cx + 20 * k, cy + 10 * k, 280 * k, 112 * k, 'HOVER CARD', 'accent', [
        '[icon] title · date (mono)',
        'category · grade chip',
        'pin: exact site | circle: ±r km',
        'coord_source: …',
      ]),
    );
  // legend + credit strip
  // polish pass: the legend is a chip (pin / circle counts) that expands upward on K
  const lw = Math.round(220 * k),
    lh = Math.round(32 * k);
  P.push(box(gl + gap, gb - lh - gap, lw, lh, 'LEGEND chip · pin n · circle n  ⌃ (K)', 'panel'));
  P.push(box(gl + gap, vh - tl - credit + 2, gr - gl - 2 * gap, credit - 4, 'imagery credits · status', 'chrome'));
  // timeline dock
  P.push(
    box(0, vh - tl, vw, tl, 'TIMELINE DOCK', 'chrome', [
      '▶ Play · STEP −1y −1m −1d +1d +1m +1y · SPEED 1d 1w 1mo 1y 10y 100y Auto · SHOW Cumulative | Recent · DATE · UTC · Latest',
      'overview strip (8000 BCE … today, focus window) / detail track (focus window, linear): drag = scrub, Shift+drag = range, wheel = zoom',
      'FOCUS All time · Ancient · 1900–1945 · Cold War · 1990–now · Last 10 y   |  brush chip  |  lat lon · alt · T date (mono)',
    ]),
  );
  if (palette) {
    const pw = Math.min(720 * k, vw - 2 * L),
      ph = Math.min(440 * k, vh - top - tl - 40);
    P.push(
      (fs) => `<rect x="0" y="0" width="${vw}" height="${vh}" fill="rgba(0,0,0,0.35)"/>`,
      box((vw - pw) / 2 + 0, top - 4, pw, ph, 'COMMAND PALETTE (Ctrl K or /)', 'accent', [
        '> query___________________________________',
        'COMMANDS   Open Charts (V) · Toggle legend (K) · Density: compact',
        'CASES      ● 1561 celestial phenomenon over Nuremberg · 1561-04-14 · Germany',
        'PLACES     Nuremberg, Germany (country / city label)',
        'LAYERS     ☐ Nuclear tests · ☑ Country borders',
        'REFERENCE  sites, conflicts …',
        '↑↓ move · Enter open · Shift+Enter filter cases · Esc close',
      ]),
    );
  }
  return P;
}

export const SETS = [
  ['1280x800', 'main', {}],
  ['1280x800', 'dossier', { dossier: true, rail: false }],
  ['1280x800', 'reference', { ref: true, rail: false }],
  ['1920x1080', 'main', {}],
  ['1920x1080', 'dossier', { dossier: true, tooltip: true }],
  ['1920x1080', 'reference', { ref: true }],
  ['1920x1080', 'states', { feed: true, states: true }],
  ['1920x1080', 'palette', { palette: true }],
  ['1920x1080', 'analysis', { feed: true, bottom: true }],
  ['3840x2160', 'main', {}],
  ['3840x2160', 'reference', { ref: true, dossier: true }],
  ['3840x2160', 'dossier', { dossier: true, feed: true, tooltip: true }],
];

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await mkdir(OUT, { recursive: true });
  const files = [];
  for (const [vp, name, opt] of SETS) {
    const [w, h] = vp.split('x').map(Number);
    const f = path.join(OUT, `${vp}_${name}.svg`);
    await writeFile(f, svg(w, h, name, frame(model(w, h), opt)));
    files.push([f, w, h]);
  }
  if (!process.argv.includes('--no-png')) {
    const { chromium } = await import('playwright');
    const b = await chromium.launch();
    for (const [f, w, h] of files) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.goto('file://' + f);
      await p.screenshot({ path: f.replace(/\.svg$/, '.png') });
      await p.close();
    }
    await b.close();
  }
  console.log(files.length, 'wireframes ->', path.relative(root, OUT));
}
