// Activity feed window (v1.4, ADR 0004, key N). Two tabs:
//   Live    USGS M4.5+ (30 days) and NASA EONET open events, fetched only when the feed opens (keyless, CORS,
//           shared with the live globe layers through src/live_feeds.js; nothing stored or redistributed)
//   Recent  what this session did: dossiers opened and filter changes (in memory only; never sent anywhere)
// A live row flies the globe to its coordinates; a recent case row reopens its dossier.
import { ctx, st, $, esc, on, filteredCases, dayLabel } from '../app_core.js';
import { icon } from '../icons.js';
import { makeTabs } from './tabs.js';
import { loadingState, emptyState, errorState } from './states.js';
import { catColor, catIcon } from './symbology.js';
import { usgsQuakes, nasaEonet, refreshLive, LIVE, onLive } from '../live_feeds.js';

const recent = [];
const MAX = 60;
let tab = 'live',
  tabs = null,
  live = { usgs: null, eonet: null };

const kindIcon = (k) => {
  const s = String(k || '').toLowerCase();
  if (s === 'earthquake') return 'activity';
  if (/wildfire|fire/.test(s)) return 'flame';
  if (/volcano/.test(s)) return 'mountain';
  if (/storm|cyclone/.test(s)) return 'zap';
  if (/ice|snow/.test(s)) return 'snowflake';
  if (/flood|water/.test(s)) return 'droplets';
  return 'cloud';
};
const hhmm = (t) => new Date(t).toISOString().slice(11, 19) + 'Z';

function log(e) {
  recent.unshift({ t: Date.now(), ...e });
  if (recent.length > MAX) recent.length = MAX;
  if (!$('#feed').hidden && tab === 'recent') render();
}
let lastFilterSig = '';
function filterSig() {
  const f = st.f;
  const parts = [];
  for (const [k, v] of Object.entries(f)) {
    if (v instanceof Set && v.size) parts.push(`${k}: ${[...v].slice(0, 3).join(', ')}${v.size > 3 ? '…' : ''}`);
    else if (Array.isArray(v) && v.length === 2 && k === 'range')
      parts.push(`range ${dayLabel(v[0])} → ${dayLabel(v[1])}`);
    else if (typeof v === 'string' && v) parts.push(`${k}: “${v}”`);
    else if (v === true) parts.push(k);
  }
  return parts.join(' · ') || 'no filters';
}

async function load(force) {
  for (const [id, fn] of [
    ['usgs', usgsQuakes],
    ['eonet', nasaEonet],
  ]) {
    if (force) refreshLive(id);
    if (live[id] && !force) continue;
    fn().then(
      (r) => {
        live[id] = r;
        if (!$('#feed').hidden) render();
      },
      () => !$('#feed').hidden && render(),
    );
  }
  render();
}

function liveHTML() {
  const rows = liveRows;
  const head = ['usgs', 'eonet']
    .map((id) => {
      const s = LIVE[id];
      const name = id === 'usgs' ? 'USGS' : 'NASA EONET';
      return `<span class="live live-${s.state}"><i aria-hidden="true"></i>${name}: ${
        s.state === 'ok' ? `${s.n} items` : s.state === 'error' ? `unavailable (${esc(s.err)})` : esc(s.state)
      }</span>`;
    })
    .join('');
  const src = ['usgs', 'eonet']
    .filter((id) => live[id])
    .map((id) => `<li>${esc(live[id].source)}</li>`)
    .join('');
  return `<div class="feed-status">${head}</div>${
    rows.length
      ? `<ol class="feed-list" aria-label="Live events, newest first">${rows
          .slice(0, 120)
          .map(
            (r, i) =>
              `<li><button class="feed-row" data-live="${i}" title="Fly to ${esc(r.name)}"><span class="fi">${icon(kindIcon(r.kind), 14)}</span><span class="ft mono">${esc(r.date)}</span><span class="fn">${esc(r.name)}</span><span class="fk muted">${esc(r.feed)} · ${esc(r.kind)}</span></button>${r.source_url ? `<a class="fsrc" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer" aria-label="Source for ${esc(r.name)}">${icon('file-text', 14)}</a>` : ''}</li>`,
          )
          .join('')}</ol>`
      : liveEmpty()
  }<ul class="feed-src muted small">${src}</ul>`;
}
// v1.5: one state markup for loading, empty and error (src/ui/states.js)
function liveEmpty() {
  if (LIVE.usgs.state === 'loading' || LIVE.eonet.state === 'loading')
    return loadingState('Loading live feeds…', { detail: 'USGS earthquakes and NASA EONET events, read live.' });
  if (LIVE.usgs.state === 'error' && LIVE.eonet.state === 'error')
    return errorState('The live feeds could not be reached', {
      detail: `USGS: ${LIVE.usgs.err || 'network'} · EONET: ${LIVE.eonet.err || 'network'}. The rest of the console works offline.`,
      action: { id: 'feed-retry', label: 'Try again' },
    });
  return emptyState('No live events loaded', {
    detail: 'The feeds need a network connection; the rest of the console works offline.',
  });
}
function recentHTML() {
  if (!recent.length)
    return emptyState('Nothing yet', {
      detail: 'Open a case or change a filter and it shows up here (this session only, never stored).',
    });
  return `<ol class="feed-list" aria-label="This session, newest first">${recent
    .map((e, i) =>
      e.kind === 'case'
        ? `<li><button class="feed-row" data-recent="${i}"><span class="fi" style="color:${catColor(e.cat)}">${icon(catIcon(e.cat), 14)}</span><span class="ft mono">${hhmm(e.t)}</span><span class="fn">${esc(e.name)}</span><span class="fk muted">dossier · ${esc(e.cat)}</span></button></li>`
        : `<li><div class="feed-row static"><span class="fi">${icon('filter', 14)}</span><span class="ft mono">${hhmm(e.t)}</span><span class="fn">${esc(e.n.toLocaleString('en-US'))} rows</span><span class="fk muted">${esc(e.sig)}</span></div></li>`,
    )
    .join('')}</ol>`;
}
let liveRows = [];
function render() {
  const body = $('#feed-body');
  if (!body) return;
  if (tab === 'live') {
    liveRows = [];
    for (const id of ['usgs', 'eonet'])
      if (live[id]) for (const it of live[id].items) liveRows.push({ ...it, feed: id === 'usgs' ? 'USGS' : 'EONET' });
    liveRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    body.innerHTML = liveHTML();
    const retry = body.querySelector('#feed-retry');
    if (retry) retry.onclick = () => load(true);
  } else body.innerHTML = recentHTML();
}

export function toggleFeed(show) {
  const el = $('#feed');
  el.hidden = !(show ?? el.hidden);
  if (!el.hidden) load(false);
}
export function initFeed() {
  tabs = makeTabs(
    $('#feed-tabs'),
    [
      ['live', 'Live'],
      ['recent', 'Recent'],
    ],
    {
      active: 'live',
      attr: 'ft',
      label: 'Feed',
      panel: 'feed-body',
      onChange: (t) => {
        tab = t;
        render();
      },
    },
  );
  $('#feed-close').onclick = () => toggleFeed(false);
  $('#feed-refresh').onclick = () => load(true);
  $('#feed-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-live],[data-recent]');
    if (!b) return;
    if (b.dataset.live != null) {
      const r = liveRows[+b.dataset.live];
      if (r) ctx.globe.flyTo(+r.lat, +r.lon, 1.5);
    } else {
      const r = recent[+b.dataset.recent];
      const c = r && ctx.cases.find((x) => x.id === r.id);
      if (c) import('../ui_panels.js').then((m) => m.openDossier(c));
    }
  });
  on('select', (it) => {
    if (it && it.category && it.id) log({ kind: 'case', id: it.id, name: it.name, cat: it.category });
  });
  let tmr = 0;
  on('filters', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      const sig = filterSig();
      if (sig === lastFilterSig) return;
      lastFilterSig = sig;
      log({ kind: 'filters', sig, n: filteredCases().length });
    }, 600);
  });
  lastFilterSig = filterSig();
  onLive(() => !$('#feed').hidden && tab === 'live' && render());
  void tabs;
}
