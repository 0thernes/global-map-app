// UI audit capture (v1.3): opens every view at several viewports, screenshots it and measures the DOM:
// floating boxes (clipping, overlaps, z-index), scroll containers (nested / double scroll bars), header
// controls (minimize / maximize / close), tab markup and style, typography, spacing, target sizes, plus axe-core.
// Usage: node test/ui_audit.mjs --phase before|after [--vp 1280x800,1920x1080,3840x2160] [--only name,name]
// Writes <out>/<phase>/<vp>/<view>.png and <out>/<phase>/<vp>/metrics.json (out defaults to ../gma-ui-shots).
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { startServer } from './static_server.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const PHASE = arg('phase', 'before');
const OUT = arg('out', '../gma-ui-shots');
const VPS = arg('vp', '1280x800,1920x1080,3840x2160').split(',');
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const AXE = await readFile('node_modules/axe-core/axe.min.js', 'utf8');
const { server, origin } = await startServer();
const url = `${origin}/index.html?intro=0&private=0&basemap=local&terrain=off`;

import { VIEWS, closeAll as close } from './ui_views.mjs';

// In-page measurement. Kept self-contained: it runs inside the page.
function measure() {
  const vw = innerWidth,
    vh = innerHeight;
  const cs = (e) => getComputedStyle(e);
  const shown = (e) => {
    if (!e || e.hidden) return false;
    const s = cs(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const sel = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : ''));
  const path = (e) => {
    const out = [];
    for (let n = e; n && n !== document.body && out.length < 4; n = n.parentElement) {
      out.unshift(sel(n));
      if (n.id) break;
    }
    return out.join(' > ');
  };
  const floatSel =
    '#topbar, #rail, #timeline, #count, .panel, #lowerthird, #search-results, .menu, #credits, #status, .popover, .info-pop, [role=tooltip], #hud-coord, #hud-date';
  const floats = [...document.querySelectorAll(floatSel)].filter(shown).filter((e) => {
    const p = cs(e).position;
    return p === 'fixed' || p === 'absolute' || p === 'sticky';
  });
  const R = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  const boxes = floats.map((e) => {
    const r = e.getBoundingClientRect();
    const s = cs(e);
    const hdr = e.querySelector(':scope > header, :scope > .win-head');
    const btns = [...e.querySelectorAll(':scope > header button, :scope > .win-head button, :scope > button.close')];
    const lab = (b) => (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
    const head = hdr ? cs(hdr) : null;
    return {
      sel: sel(e),
      rect: R(r),
      z: s.zIndex,
      pos: s.position,
      clip: {
        left: Math.max(0, -Math.round(r.left)),
        top: Math.max(0, -Math.round(r.top)),
        right: Math.max(0, Math.round(r.right - vw)),
        bottom: Math.max(0, Math.round(r.bottom - vh)),
      },
      header: !!hdr,
      title: hdr ? (hdr.querySelector('h2,h3,h4')?.textContent || '').trim().slice(0, 40) : '',
      ctrl: {
        close: btns.some((b) => /close|×|✕/.test(lab(b)) || b.classList.contains('close')),
        min: btns.some((b) => /minimi[sz]e|collapse/.test(lab(b))),
        max: btns.some((b) => /maximi[sz]e|restore|expand/.test(lab(b))),
        closeGlyph: btns
          .filter((b) => b.classList.contains('close'))
          .map((b) => b.textContent.trim())
          .join(''),
        closeSize: btns
          .filter((b) => b.classList.contains('close'))
          .map((b) => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))
          .join(','),
      },
      headPad: head ? head.padding : '',
      pad: s.padding,
      radius: s.borderRadius,
      blur: s.backdropFilter || s.webkitBackdropFilter || '',
      shadow: s.boxShadow === 'none' ? '' : 'y',
      resizable: s.resize !== 'none',
      draggable: !!e.querySelector('[data-drag], .win-head'),
      role: e.getAttribute('role') || '',
      modal: e.getAttribute('aria-modal') || '',
      overflow: s.overflowY,
    };
  });
  // overlaps between floating boxes (only those that are not ancestors of each other)
  const overlaps = [];
  for (let i = 0; i < floats.length; i++)
    for (let j = i + 1; j < floats.length; j++) {
      const a = floats[i],
        b = floats[j];
      if (a.contains(b) || b.contains(a)) continue;
      const A = a.getBoundingClientRect(),
        B = b.getBoundingClientRect();
      const w = Math.min(A.right, B.right) - Math.max(A.left, B.left);
      const h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (w > 4 && h > 4)
        overlaps.push({ a: sel(a), b: sel(b), w: Math.round(w), h: Math.round(h), za: cs(a).zIndex, zb: cs(b).zIndex });
    }
  // scroll containers and nesting
  const scrolls = [];
  const all = [...document.querySelectorAll('body *')].filter((e) => !e.closest('#globe') && !e.closest('#boot'));
  for (const e of all) {
    const s = cs(e);
    const y = /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2;
    const x = /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2;
    if ((y || x) && shown(e)) {
      let anc = null;
      for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
        const t = cs(n);
        if (
          (/(auto|scroll)/.test(t.overflowY) && n.scrollHeight > n.clientHeight + 2) ||
          (/(auto|scroll)/.test(t.overflowX) && n.scrollWidth > n.clientWidth + 2)
        ) {
          anc = path(n);
          break;
        }
      }
      scrolls.push({
        sel: path(e),
        y,
        x,
        h: e.clientHeight,
        sh: e.scrollHeight,
        anc,
        sbw: s.scrollbarWidth || '',
        sbc: s.scrollbarColor || '',
      });
    }
  }
  // tabs
  const tablists = [...document.querySelectorAll('.tabs, [role=tablist]')].filter(shown).map((tl) => {
    const tabs = [...tl.querySelectorAll('button, [role=tab]')].filter(shown);
    const t = tabs.find((b) => !b.classList.contains('on') && b.getAttribute('aria-selected') !== 'true') || tabs[0];
    const on = tabs.find(
      (b) => b.classList.contains('on') || b.classList.contains('active') || b.getAttribute('aria-selected') === 'true',
    );
    const sig = (b) => {
      if (!b) return '';
      const s = cs(b);
      return [
        s.fontSize,
        s.fontWeight,
        s.padding,
        s.borderBottomWidth + ' ' + s.borderBottomStyle,
        s.borderRadius,
        s.backgroundColor,
        s.color,
        s.textTransform,
      ].join('|');
    };
    return {
      sel: path(tl),
      n: tabs.length,
      roleList: tl.getAttribute('role') === 'tablist',
      roleTab: tabs.length > 0 && tabs.every((b) => b.getAttribute('role') === 'tab'),
      ariaSel: tabs.some((b) => b.hasAttribute('aria-selected')),
      overflowing: tl.scrollWidth > tl.clientWidth + 2,
      wraps: tabs.length > 1 && new Set(tabs.map((b) => Math.round(b.getBoundingClientRect().top))).size > 1,
      sig: sig(t),
      sigOn: sig(on),
    };
  });
  // typography of visible text in the UI (not the globe)
  const fonts = {},
    families = {},
    lhs = {};
  let tiny = 0,
    tinyEx = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const e = n.parentElement;
    if (!e || seen.has(e) || !n.textContent.trim() || e.closest('#globe,#boot,script,style')) continue;
    seen.add(e);
    if (!shown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const s = cs(e);
    const fs = parseFloat(s.fontSize);
    fonts[fs] = (fonts[fs] || 0) + 1;
    const fam = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    families[fam] = (families[fam] || 0) + 1;
    const lh = s.lineHeight === 'normal' ? 'normal' : (parseFloat(s.lineHeight) / fs).toFixed(2);
    lhs[lh] = (lhs[lh] || 0) + 1;
    if (fs < 12) {
      tiny++;
      if (tinyEx.length < 8) tinyEx.push(path(e) + ' ' + fs + 'px');
    }
  }
  // interactive target sizes (WCAG 2.5.8 minimum 24x24)
  const small = [];
  for (const b of document.querySelectorAll('button, [role=button], a[href], input, select, summary')) {
    if (!shown(b) || b.closest('#globe,#boot')) continue;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue;
    if ((r.width < 24 || r.height < 24) && !(b.tagName === 'A' && cs(b).display === 'inline'))
      small.push(path(b) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  // controls pushed out of view or cut by an overflow:hidden ancestor, and truncated text
  const cut = [];
  for (const b of document.querySelectorAll('button, input, select, a[href], [role=tab]')) {
    if (!shown(b) || b.closest('#globe,#boot')) continue;
    const r = b.getBoundingClientRect();
    let why = '';
    // a control that is merely scrolled out of view inside a scroll region is reachable: skip it
    let inScroll = false;
    for (let n = b.parentElement; n && n !== document.body; n = n.parentElement)
      if (/(auto|scroll)/.test(cs(n).overflowY + cs(n).overflowX)) inScroll = true;
    if (inScroll && r.right <= vw + 2 && r.left >= -2) continue;
    if (r.right > vw + 2 || r.left < -2 || r.top < -2 || (r.bottom > vh + 2 && !b.closest('.panel')))
      why = 'off-viewport';
    else
      for (let n = b.parentElement; n && n !== document.body; n = n.parentElement) {
        const t = cs(n);
        if (t.overflowX === 'visible' && t.overflowY === 'visible') continue;
        const q = n.getBoundingClientRect();
        const scrollable = /(auto|scroll)/.test(t.overflowX + t.overflowY);
        if (!scrollable && (r.right > q.right + 4 || r.left < q.left - 4 || r.bottom > q.bottom + 4))
          why = 'clipped by ' + path(n);
        break;
      }
    if (why)
      cut.push(path(b) + ' [' + (b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20)) + '] ' + why);
  }
  const trunc = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('#globe,#boot') || !e.firstChild || e.children.length > 2) continue;
    const s = cs(e);
    if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && shown(e))
      trunc.push(path(e) + ' "' + e.textContent.trim().slice(0, 30) + '"');
  }
  const toolsOverflow = (() => {
    const n = document.querySelector('#topbar nav, #topbar .tools');
    return n ? { sw: n.scrollWidth, cw: n.clientWidth } : null;
  })();
  // icon consistency: glyph-only buttons vs svg icons
  const glyph = [...document.querySelectorAll('button')]
    .filter(
      (b) =>
        shown(b) && !b.querySelector('svg') && b.textContent.trim().length === 1 && /[^\w]/.test(b.textContent.trim()),
    )
    .map((b) => path(b) + ' "' + b.textContent.trim() + '"');
  const svgBtn = [...document.querySelectorAll('button svg')].filter((s) => shown(s)).length;
  return {
    vw,
    vh,
    boxes,
    overlaps,
    scrolls,
    tablists,
    fonts,
    families,
    lhs,
    tiny,
    tinyEx,
    small: small.slice(0, 40),
    nSmall: small.length,
    cut: [...new Set(cut)].slice(0, 40),
    nCut: cut.length,
    trunc: trunc.slice(0, 30),
    nTrunc: trunc.length,
    toolsOverflow,
    glyph: [...new Set(glyph)].slice(0, 30),
    svgBtn,
  };
}

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
for (const vp of VPS) {
  const [w, h] = vp.split('x').map(Number);
  const dir = `${OUT}/${PHASE}/${vp}`;
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.setDefaultTimeout(30000);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180000 });
  await page.evaluate(AXE);
  await page.waitForTimeout(4000);
  // with --only, merge into an existing metrics.json (re-running a view keeps the others)
  const res = ONLY ? JSON.parse(await readFile(`${dir}/metrics.json`, 'utf8').catch(() => '{}')) : {};
  for (const [name, fn] of VIEWS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const t0 = Date.now();
    try {
      await fn(page);
      await page.waitForTimeout(1200);
      const m = await page.evaluate(measure);
      m.axe = await page.evaluate(async () => {
        const r = await window.axe.run(
          { exclude: [['#globe'], ['#boot']] },
          {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
            resultTypes: ['violations'],
          },
        );
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          n: v.nodes.length,
          nodes: v.nodes
            .slice(0, 6)
            .map((n) => ({ t: n.target.join(' '), why: (n.any[0] || n.all[0] || n.none[0] || {}).message || '' })),
        }));
      });
      await page.screenshot({ path: `${dir}/${name}.png`, timeout: 180000 });
      res[name] = m;
      console.log(vp, name, 'ok', Date.now() - t0, 'ms');
    } catch (e) {
      res[name] = { failed: String(e.message || e).slice(0, 300) };
      console.log(vp, name, 'FAILED', e.message);
      await page.screenshot({ path: `${dir}/${name}.png` }).catch(() => {});
    }
    await close(page);
    await page.waitForTimeout(400);
  }
  await writeFile(`${dir}/metrics.json`, JSON.stringify(res, null, 1));
  await page.close();
}
await browser.close();
server.close();
