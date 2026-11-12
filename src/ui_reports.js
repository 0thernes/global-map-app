// Reports module: intelligence briefs per selection, country, era or category; printable (print CSS) and exportable HTML.
import { ctx, st, $, esc, fmt, filteredCases, caseVisibleF, ERAS, CASE_CATS, download, setStatus } from './app_core.js';
import { buildReport, reportHTML } from './report_gen.js';
import { sfx } from './audio.js';

let open = false;
export function initReports() {
  $('#rep-close').onclick = () => toggleReports(false);
}
export function toggleReports(show) {
  const el = $('#reports');
  open = show ?? el.hidden;
  el.hidden = !open;
  if (open) renderForm();
}
function renderForm() {
  const areas = [...new Set(ctx.cases.map((c) => c._area).filter(Boolean))].sort();
  $('#rep-form').innerHTML =
    `<label>Scope <select id="rep-scope"><option value="sel">Current filters and timeline date</option><option value="country">Country / area</option><option value="era">Era</option><option value="cat">Category</option><option value="all">All cases</option></select></label>
   <select id="rep-country" hidden>${areas.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
   <select id="rep-era" hidden>${ERAS.map((e) => `<option>${esc(e[0])}</option>`).join('')}</select>
   <select id="rep-cat" hidden>${CASE_CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
   <label class="tog"><input type="checkbox" id="rep-snap" checked> include globe snapshot</label>
   <button class="btn primary" id="rep-go">Generate brief</button><button class="btn" id="rep-print" disabled>Print / PDF</button><button class="btn" id="rep-html" disabled>Export HTML</button>`;
  const sc = $('#rep-scope');
  sc.onchange = () => {
    for (const k of ['country', 'era', 'cat']) $('#rep-' + k).hidden = sc.value !== k;
  };
  $('#rep-go').onclick = generate;
  $('#rep-print').onclick = () => {
    document.body.classList.add('printing-report');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-report'), 500);
  };
  $('#rep-html').onclick = () => download(`brief-${Date.now()}.html`, standalone($('#rep-out').innerHTML), 'text/html');
}
export function generate(scopeOverride) {
  const sc = scopeOverride || $('#rep-scope').value;
  let rows, title, scope;
  if (sc === 'sel') {
    rows = filteredCases();
    title = 'Current selection';
    scope = `Filters as set in the app, cases up to the timeline date (${rows.length} cases)`;
  } else if (sc === 'country') {
    const a = $('#rep-country').value;
    rows = ctx.cases.filter((c) => c._area === a);
    title = a;
    scope = `Country / area: ${a}`;
  } else if (sc === 'era') {
    const e = $('#rep-era').value;
    rows = ctx.cases.filter((c) => c._era === e);
    title = `Era ${e}`;
    scope = `Era: ${e}`;
  } else if (sc === 'cat') {
    const k = $('#rep-cat').value;
    rows = ctx.cases.filter((c) => c.category === k && caseVisibleF(c, { ...st.f, cats: new Set() }));
    title = k;
    scope = `Category: ${k}`;
  } else {
    rows = ctx.cases;
    title = 'All cases';
    scope = 'Every case loaded in the app';
  }
  const r = buildReport(rows, {
    title,
    scope,
    generated: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC (local clock)',
  });
  let snap = '';
  if ($('#rep-snap') && $('#rep-snap').checked) {
    try {
      snap = ctx.globe.canvas.toDataURL('image/jpeg', 0.72);
    } catch {}
  }
  const out = $('#rep-out');
  out.innerHTML = reportHTML(r, { snapshot: snap });
  out.querySelectorAll('[data-case]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        const c = ctx.cases.find((x) => x.id === a.dataset.case);
        if (c) import('./ui_panels.js').then((m) => m.openDossier(c));
      }),
  );
  $('#rep-print').disabled = $('#rep-html').disabled = false;
  sfx('boom', 0.5);
  setStatus(`Brief generated: ${fmt(r.n)} cases`);
  return r;
}
function standalone(inner) {
  const css = [...document.styleSheets]
    .flatMap((s) => {
      try {
        return [...s.cssRules].map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .filter((t) => /rp-|tier|:root|@font-face/.test(t))
    .join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Global Map brief</title><style>${css}\nbody{background:#fff;color:#111;margin:24px}</style><body class="report-standalone">${inner}</body></html>`;
}
