// Window manager (v1.3, ADR 0003): turns every `.panel` into one consistent window with a standard header
// (title + minimize / maximize / close), a single scroll region (.win-body), drag to move, a resize grip,
// snapping to left / right / bottom dock zones that never cover the top bar, timeline or globe credits,
// state remembered per window in localStorage (gm.win.<id>), Esc closes the top window, and a focus trap
// for modal windows. The geometry below is pure and unit-tested (test/unit/window.test.mjs); the DOM part
// only runs when initWindows() is called.
import { icon } from '../icons.js';

export const SNAP = 32; // px from a safe-area edge that triggers a dock preview
export const MIN_W = 280;
export const MIN_H = 160;
export const HEAD_H = 48; // header height: 8 + 32 + 8 on the 8 px grid (minimized windows keep only this)
export const GAP = 8;
export const NARROW = 900; // below this width every window becomes a full-width bottom sheet
export const MODES = ['left', 'right', 'bottom', 'float', 'max'];
export const KEY = (id) => 'gm.win.' + id;

/** Safe area for windows: the viewport minus the top bar, the timeline (+ globe credit line) and the rail. */
export function safeArea({ vw, vh, top = 56, bottom = 112, railRight = 0, credit = 16 }) {
  const t = top + GAP;
  const b = vh - bottom - credit - GAP;
  const l = (railRight > 0 ? railRight : 0) + GAP;
  const r = vw - GAP;
  return { x: l, y: t, w: Math.max(0, r - l), h: Math.max(0, b - t), r, b };
}

/** Keep a rectangle inside the safe area and at least the minimum size. */
export function clampRect(rect, safe, min = { w: MIN_W, h: MIN_H }) {
  const w = Math.round(Math.min(Math.max(rect.w ?? min.w, Math.min(min.w, safe.w)), safe.w));
  const hh = rect.h == null ? null : Math.round(Math.min(Math.max(rect.h, Math.min(min.h, safe.h)), safe.h));
  const x = Math.round(Math.min(Math.max(rect.x ?? safe.x, safe.x), safe.x + safe.w - w));
  const y = Math.round(Math.min(Math.max(rect.y ?? safe.y, safe.y), safe.y + safe.h - (hh ?? HEAD_H)));
  return { x, y, w, h: hh };
}

/** Which dock zone (if any) a pointer at (px, py) is over while dragging. */
export function snapZone(px, py, safe, t = SNAP) {
  if (px <= safe.x + t) return 'left';
  if (px >= safe.x + safe.w - t) return 'right';
  if (py >= safe.y + safe.h - t) return 'bottom';
  return null;
}

/**
 * Lay out visible windows. Docked windows tile inwards from their edge and never overlap each other; bottom
 * docks span the space between the left and right docks; floating windows are clamped; `max` fills the
 * safe area; minimized windows keep only their header. Returns { rects: {id: rect}, occ: {left, right} }.
 * wins: [{ id, mode, w, h, x, y, min, order }], order = dock order (lower = closer to the edge).
 */
export function layoutWindows(wins, safe, { narrow = false } = {}) {
  const rects = {};
  const H = (w, full) => (w.min ? HEAD_H : full);
  if (narrow) {
    // full-width bottom sheets; the most recent sits on top (z handled by the caller)
    for (const w of wins) {
      const h = w.min ? HEAD_H : Math.round(safe.h * 0.62);
      rects[w.id] = { x: safe.x, y: safe.y + safe.h - h, w: safe.w, h };
    }
    return { rects, occ: { left: safe.x, right: safe.x + safe.w } };
  }
  const by = (m) => wins.filter((w) => w.mode === m).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const L = by('left'),
    R = by('right'),
    B = by('bottom');
  // shrink side docks proportionally if together they would leave less than 30 % of the width for the globe
  const avail = safe.w * 0.7;
  const sum = [...L, ...R].reduce((a, w) => a + Math.max(MIN_W, w.w || MIN_W) + GAP, 0);
  const k = sum > avail ? avail / sum : 1;
  let lx = safe.x;
  for (const w of L) {
    const ww = Math.round(Math.max(MIN_W * Math.min(1, k * 1.2), (w.w || MIN_W) * k));
    rects[w.id] = { x: lx, y: safe.y, w: ww, h: H(w, safe.h) };
    lx += ww + GAP;
  }
  let rx = safe.x + safe.w;
  for (const w of R) {
    const ww = Math.round(Math.max(MIN_W * Math.min(1, k * 1.2), (w.w || MIN_W) * k));
    rx -= ww;
    rects[w.id] = { x: rx, y: safe.y, w: ww, h: H(w, safe.h) };
    rx -= GAP;
  }
  if (B.length) {
    const bx = lx,
      bw = Math.max(MIN_W, rx - lx);
    const each = Math.floor((bw - GAP * (B.length - 1)) / B.length);
    B.forEach((w, i) => {
      const hh = w.min ? HEAD_H : Math.round(Math.min(Math.max(w.h || 360, MIN_H), safe.h * 0.8));
      rects[w.id] = { x: bx + i * (each + GAP), y: safe.y + safe.h - hh, w: each, h: hh };
    });
  }
  for (const w of wins) {
    if (w.mode === 'max') rects[w.id] = { x: safe.x, y: safe.y, w: safe.w, h: H(w, safe.h) };
    else if (w.mode === 'float') {
      const ww = Math.min(w.w || 860, safe.w);
      const c = clampRect(
        { x: w.x ?? safe.x + (safe.w - ww) / 2, y: w.y ?? safe.y + GAP * 2, w: ww, h: w.min ? HEAD_H : w.h },
        safe,
        { w: Math.min(MIN_W, ww), h: w.min ? HEAD_H : MIN_H },
      );
      rects[w.id] = c;
    }
  }
  return { rects, occ: { left: L.length ? lx - GAP : safe.x, right: R.length ? rx + GAP : safe.x + safe.w } };
}

/** Parse a stored window state, dropping anything malformed. */
export function parseState(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    const out = {};
    if (MODES.includes(s.mode)) out.mode = s.mode;
    for (const k of ['x', 'y', 'w', 'h'])
      if (Number.isFinite(s[k]) && s[k] >= 0 && s[k] < 20000) out[k] = Math.round(s[k]);
    if (typeof s.min === 'boolean') out.min = s.min;
    if (MODES.includes(s.prev)) out.prev = s.prev;
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- DOM
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const wins = new Map();
let raiseN = 0,
  store = null,
  preview = null;
const listeners = new Set();

function storage() {
  if (store) return store;
  try {
    localStorage.setItem('gm.win.__t', '1');
    localStorage.removeItem('gm.win.__t');
    store = localStorage;
  } catch {
    const m = new Map();
    store = {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  return store;
}
const cssPx = (name, d) => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : d;
};
export function currentSafe() {
  const rail = document.getElementById('rail');
  const rr = rail && !rail.hidden && rail.offsetParent !== null ? rail.getBoundingClientRect() : null;
  const narrow = innerWidth < NARROW;
  return {
    safe: safeArea({
      vw: innerWidth,
      vh: innerHeight,
      top: cssPx('--topbar-h', 56),
      bottom: cssPx('--timeline-h', 112),
      // the rail is a fixed sidebar: windows dock beside it (on narrow screens they cover it as sheets)
      railRight: rr && !narrow && !document.body.classList.contains('rail-collapsed') ? rr.right : 0,
    }),
    narrow,
  };
}

function btn(cls, label, ic) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'win-btn ' + cls;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon(ic, 16);
  return b;
}

/** Enhance one panel element into a window. def: { mode, w, h, modal, title } */
export function enhance(el, def = {}) {
  if (!el || wins.has(el.id)) return wins.get(el?.id);
  el.classList.add('win');
  let head = el.querySelector(':scope > header');
  if (!head) {
    head = document.createElement('header');
    const h = document.createElement('h3');
    h.textContent = def.title || el.getAttribute('aria-label') || el.id;
    head.append(h);
    el.prepend(head);
  }
  head.classList.add('win-head');
  const title = head.querySelector('h2, h3');
  if (title) {
    title.id = title.id || el.id + '-title';
    title.classList.add('win-title');
  }
  // existing close button (modules bind their own close logic to it); move it into the header
  let close = el.querySelector(':scope > button.close, :scope > header button.close');
  if (!close) {
    close = document.createElement('button');
    close.className = 'close';
    close.onclick = () => (el.hidden = true);
  }
  close.classList.add('win-btn', 'win-close');
  close.setAttribute('aria-label', 'Close');
  close.title = 'Close (Esc)';
  close.innerHTML = icon('x', 16);
  const ctl = document.createElement('div');
  ctl.className = 'win-ctl';
  const bMin = btn('win-min', 'Minimize', 'minus');
  const bMax = btn('win-max', 'Maximize', 'maximize-2');
  ctl.append(bMin, bMax, close);
  head.append(ctl);
  // fixed tool rows (tabs + filter) stay above the single scroll region
  const tools = [...el.children].filter(
    (c) => c !== head && (c.matches('.ref-top, .win-tools-src') || c.dataset.winFixed != null),
  );
  let toolsEl = null;
  if (tools.length) {
    toolsEl = document.createElement('div');
    toolsEl.className = 'win-tools';
    toolsEl.append(...tools);
  }
  const body = document.createElement('div');
  body.className = 'win-body';
  body.tabIndex = 0; // keyboard users can scroll the body even when it holds no focusable content
  body.append(...[...el.children].filter((c) => c !== head));
  el.append(...[toolsEl, body].filter(Boolean));
  const edge = document.createElement('div');
  edge.className = 'win-edge';
  edge.setAttribute('aria-hidden', 'true');
  const grip = document.createElement('div');
  grip.className = 'win-grip';
  grip.setAttribute('aria-hidden', 'true');
  el.append(edge, grip);
  if (def.modal) {
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
  }
  if (title) el.setAttribute('aria-labelledby', title.id);
  el.removeAttribute('aria-label');
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
  const saved = parseState(storage().getItem(KEY(el.id))) || {};
  const w = {
    id: el.id,
    el,
    head,
    body,
    def,
    st: { mode: def.mode || 'float', w: def.w, h: def.h ?? null, min: false, ...saved },
    order: def.order ?? 0,
    z: 0,
    opener: null,
  };
  wins.set(el.id, w);
  bMin.onclick = () => minimize(el.id);
  bMax.onclick = () => maximize(el.id);
  head.addEventListener('dblclick', (e) => !e.target.closest('button, input, select') && maximize(el.id));
  head.addEventListener('pointerdown', (e) => startDrag(e, w));
  grip.addEventListener('pointerdown', (e) => startResize(e, w, 'grip'));
  edge.addEventListener('pointerdown', (e) => startResize(e, w, 'edge'));
  el.addEventListener('pointerdown', () => raise(el.id), true);
  el.addEventListener('focusin', () => raise(el.id));
  el.addEventListener('keydown', (e) => trap(e, w));
  new MutationObserver(() => (el.hidden ? onHide(w) : onShow(w))).observe(el, {
    attributes: true,
    attributeFilter: ['hidden'],
  });
  syncButtons(w);
  if (!el.hidden) onShow(w);
  return w;
}

function syncButtons(w) {
  const { el, st } = w;
  const bMin = el.querySelector('.win-min'),
    bMax = el.querySelector('.win-max');
  bMin.setAttribute('aria-label', st.min ? 'Restore' : 'Minimize');
  bMin.title = st.min ? 'Restore' : 'Minimize';
  bMin.setAttribute('aria-pressed', String(!!st.min));
  bMin.innerHTML = icon(st.min ? 'chevron-down' : 'minus', 16);
  const mx = st.mode === 'max';
  bMax.setAttribute('aria-label', mx ? 'Restore size' : 'Maximize');
  bMax.title = mx ? 'Restore size' : 'Maximize';
  bMax.setAttribute('aria-pressed', String(mx));
  bMax.innerHTML = icon(mx ? 'minimize-2' : 'maximize-2', 16);
  el.classList.toggle('min', !!st.min);
  el.dataset.mode = st.mode;
  w.body.hidden = !!st.min;
  const tools = el.querySelector(':scope > .win-tools');
  if (tools) tools.hidden = !!st.min;
}
function save(w) {
  const { mode, x, y, w: ww, h, min, prev } = w.st;
  storage().setItem(KEY(w.id), JSON.stringify({ mode, x, y, w: ww, h, min, prev }));
}
export function minimize(id, on) {
  const w = wins.get(id);
  if (!w) return;
  w.st.min = on ?? !w.st.min;
  syncButtons(w);
  save(w);
  layout();
}
export function maximize(id, on) {
  const w = wins.get(id);
  if (!w) return;
  const isMax = w.st.mode === 'max';
  const want = on ?? !isMax;
  if (want && !isMax) {
    w.st.prev = w.st.mode;
    w.st.mode = 'max';
  } else if (!want && isMax) w.st.mode = w.st.prev && w.st.prev !== 'max' ? w.st.prev : w.def.mode || 'float';
  w.st.min = false;
  syncButtons(w);
  save(w);
  layout();
}
export function dock(id, mode) {
  const w = wins.get(id);
  if (!w || !MODES.includes(mode)) return;
  w.st.mode = mode;
  w.st.min = false;
  syncButtons(w);
  save(w);
  layout();
}
function raise(id) {
  const w = wins.get(id);
  if (!w || w.z === raiseN) return;
  w.z = ++raiseN;
  applyZ();
}
function applyZ() {
  const vis = [...wins.values()].filter((w) => !w.el.hidden).sort((a, b) => a.z - b.z);
  vis.forEach((w, i) => {
    w.el.style.zIndex = `calc(var(${w.def.modal ? '--z-modal' : '--z-win'}) + ${Math.min(i, 8)})`;
    w.el.classList.toggle('top', i === vis.length - 1);
  });
}
function onShow(w) {
  if (w.shown) return;
  w.shown = true;
  w.opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  w.order = ++raiseN;
  raise(w.id);
  layout();
  if (w.def.modal) {
    // land keyboard users inside the dialog: on the selected tab if there is one, else on the window itself
    // (never on a text field, so single-key shortcuts and Esc keep working)
    requestAnimationFrame(() => {
      if (w.el.hidden || w.el.contains(document.activeElement)) return;
      const f = w.el.querySelector('[role=tab][aria-selected=true]');
      (f || w.el).focus({ preventScroll: true });
    });
  }
}
function onHide(w) {
  if (!w.shown) return;
  w.shown = false;
  w.z = 0;
  const had = w.el.contains(document.activeElement);
  layout();
  if (had && w.opener && w.opener.isConnected && w.opener.offsetParent !== null)
    w.opener.focus({ preventScroll: true });
}
function trap(e, w) {
  if (e.key !== 'Tab' || !w.def.modal) return;
  const f = [...w.el.querySelectorAll(FOCUSABLE)].filter(
    (n) => n.offsetParent !== null || n === document.activeElement,
  );
  if (!f.length) return;
  const first = f[0],
    last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === w.el)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Close the window that has focus, else the top-most visible one. Returns true if something closed. */
export function closeTop() {
  const vis = [...wins.values()].filter((w) => !w.el.hidden);
  if (!vis.length) return false;
  const w = vis.find((v) => v.el.contains(document.activeElement)) || vis.sort((a, b) => b.z - a.z)[0];
  closeWin(w.id);
  return true;
}
export function closeWin(id) {
  const w = wins.get(id);
  if (!w || w.el.hidden) return;
  w.el.querySelector('.win-close').click();
  if (!w.el.hidden) w.el.hidden = true; // a module without its own close logic
}

let occ = { left: 0, right: 0 };
export const occupied = () => occ;
export function onLayout(fn) {
  listeners.add(fn);
}
export function layout() {
  if (!wins.size) return;
  const { safe, narrow } = currentSafe();
  const vis = [...wins.values()].filter((w) => !w.el.hidden);
  const res = layoutWindows(
    vis.map((w) => ({ id: w.id, ...w.st, order: w.order })),
    safe,
    { narrow },
  );
  for (const w of vis) {
    const r = res.rects[w.id];
    const s = w.el.style;
    s.left = r.x + 'px';
    s.top = r.y + 'px';
    s.width = r.w + 'px';
    if (r.h == null) {
      s.height = '';
      s.maxHeight = safe.y + safe.h - r.y + 'px';
    } else {
      s.height = r.h + 'px';
      s.maxHeight = '';
    }
    w.el.dataset.mode = narrow ? 'sheet' : w.st.mode;
  }
  document.body.classList.toggle('win-narrow', narrow);
  applyZ();
  const railR = currentSafe().safe.x - GAP;
  const prev = occ;
  occ = { left: Math.max(railR, res.occ.left), right: innerWidth - res.occ.right };
  if (prev.left !== occ.left || prev.right !== occ.right) for (const fn of listeners) fn(occ);
}

function startDrag(e, w) {
  if (
    e.button !== 0 ||
    e.target.closest('button, input, select, a, textarea') ||
    document.body.classList.contains('win-narrow')
  )
    return;
  e.preventDefault();
  const r = w.el.getBoundingClientRect();
  const dx = e.clientX - r.left,
    dy = e.clientY - r.top;
  const { safe } = currentSafe();
  let moved = false,
    zone = null;
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
    if (!moved) {
      moved = true;
      w.el.classList.add('dragging');
      if (w.st.mode !== 'float') {
        w.st.w = w.st.mode === 'max' ? Math.min(860, safe.w) : Math.round(r.width);
        w.st.h = w.st.min ? w.st.h : Math.round(Math.min(r.height, safe.h * 0.8));
        w.st.mode = 'float';
        syncButtons(w);
      }
    }
    const ox = Math.min(dx, w.st.w - 40);
    w.st.x = ev.clientX - ox;
    w.st.y = ev.clientY - dy;
    zone = snapZone(ev.clientX, ev.clientY, safe);
    showPreview(zone, safe);
    layout();
  };
  const up = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    w.el.classList.remove('dragging');
    showPreview(null);
    if (!moved) return;
    if (zone) {
      w.st.mode = zone;
      if (zone === 'bottom') w.st.h = Math.round(Math.min(Math.max(w.st.h || 360, MIN_H), safe.h * 0.6));
      w.order = ++raiseN;
    }
    syncButtons(w);
    save(w);
    layout();
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
}
function startResize(e, w, kind) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const r = w.el.getBoundingClientRect();
  const { safe } = currentSafe();
  const mode = w.st.mode;
  if (mode === 'max') return;
  const move = (ev) => {
    if (mode === 'right') w.st.w = Math.round(r.right - ev.clientX);
    else if (mode === 'left') w.st.w = Math.round(ev.clientX - r.left);
    else if (mode === 'bottom') w.st.h = Math.round(r.bottom - ev.clientY);
    else {
      w.st.x = Math.round(r.left);
      w.st.y = Math.round(r.top);
      w.st.w = Math.round(ev.clientX - r.left);
      w.st.h = Math.round(ev.clientY - r.top);
    }
    w.st.w = Math.max(MIN_W, Math.min(w.st.w || MIN_W, safe.w));
    if (w.st.h != null) w.st.h = Math.max(MIN_H, Math.min(w.st.h, safe.h));
    layout();
  };
  const up = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    save(w);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  void kind;
}
function showPreview(zone, safe) {
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'win-snap';
    preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
  }
  preview.hidden = !zone;
  if (!zone) return;
  const w = Math.min(600, safe.w * 0.4),
    h = Math.min(420, safe.h * 0.5);
  const r =
    zone === 'left'
      ? { x: safe.x, y: safe.y, w, h: safe.h }
      : zone === 'right'
        ? { x: safe.x + safe.w - w, y: safe.y, w, h: safe.h }
        : { x: safe.x, y: safe.y + safe.h - h, w: safe.w, h };
  Object.assign(preview.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
}

/** Forget every stored window position and size, and lay out the defaults again. */
export function resetLayout() {
  const s = storage();
  for (const w of wins.values()) {
    s.removeItem(KEY(w.id));
    w.st = { mode: w.def.mode || 'float', w: w.def.w, h: w.def.h ?? null, min: false };
    syncButtons(w);
  }
  layout();
}
export const windows = () => wins;

/** Default window set for the app. Sizes follow the old fixed layout so nothing moves unexpectedly. */
export function initWindows() {
  const vw = innerWidth;
  const side = Math.round(Math.min(600, vw * 0.46));
  const D = {
    dossier: { mode: 'right', w: 420, order: -10, title: 'Dossier' },
    wars: { mode: 'right', w: side },
    analysis: { mode: 'right', w: side },
    graph: { mode: 'right', w: side },
    hotspots: { mode: 'right', w: Math.round(Math.min(480, vw * 0.4)) },
    settings: { mode: 'right', w: 360 },
    'hs-dossier': { mode: 'left', w: Math.round(Math.min(440, vw * 0.36)), title: 'Cluster dossier' },
    charts: { mode: 'bottom', h: Math.round(Math.min(innerHeight * 0.52, 560)) },
    brief: { mode: 'float', w: 860, modal: true },
    help: { mode: 'float', w: 860, modal: true },
    reports: { mode: 'float', w: 1100, modal: true },
    reference: { mode: 'float', w: 1100, modal: true },
    datap: { mode: 'float', w: 1280, modal: true },
  };
  for (const [id, def] of Object.entries(D)) enhance(document.getElementById(id), def);
  addEventListener('resize', () => layout());
  new MutationObserver(() => layout()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  layout();
}
