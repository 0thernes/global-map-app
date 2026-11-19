// Visible tooltips for icon-only controls (v1.4 polish): activity bar, map tools, command-bar utilities, window
// header buttons and anything with data-tip. One shared role=tooltip element; shown after a short hover delay or at
// once on keyboard focus; the native title moves into data-tip so the browser does not show a second tooltip.
// "Layers (L)" renders as the label plus a <kbd>L</kbd> chip.
const SEL = '#actbar .act, #maptools .btn, #topbar .tools .btn, .win-btn, #rail-toggle, .info[data-info], [data-tip]';
let tip = null,
  cur = null,
  timer = 0;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function text(el) {
  if (el.title) {
    el.dataset.tip = el.title;
    el.removeAttribute('title');
  }
  return el.dataset.tip || el.getAttribute('aria-label') || '';
}
/** 'Layers (L)' -> label 'Layers', key 'L'. Exported for the unit test. */
export function splitTip(t) {
  const m = /^(.*?)\s*\(([^()]{1,12})\)$/.exec(t || '');
  return m && /^(?:[A-Z0-9,?/ ]|Ctrl.*|Shift.*|Alt.*|Space|Esc)+$/.test(m[2])
    ? { label: m[1], key: m[2] }
    : { label: t || '', key: '' };
}
function place(el) {
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const W = innerWidth,
    H = innerHeight,
    g = 8;
  let side = el.dataset.tipSide;
  if (!side) side = r.left < 96 ? 'right' : r.right > W - 96 ? 'left' : r.top < 96 ? 'below' : 'above';
  let x, y;
  if (side === 'right') [x, y] = [r.right + g, r.top + r.height / 2 - t.height / 2];
  else if (side === 'left') [x, y] = [r.left - g - t.width, r.top + r.height / 2 - t.height / 2];
  else if (side === 'below') [x, y] = [r.left + r.width / 2 - t.width / 2, r.bottom + g];
  else [x, y] = [r.left + r.width / 2 - t.width / 2, r.top - g - t.height];
  tip.style.left = Math.round(Math.max(4, Math.min(W - t.width - 4, x))) + 'px';
  tip.style.top = Math.round(Math.max(4, Math.min(H - t.height - 4, y))) + 'px';
  tip.dataset.side = side;
}
function show(el) {
  const t = text(el);
  if (!t) return;
  cur = el;
  const { label, key } = splitTip(t);
  tip.innerHTML = `<span>${esc(label)}</span>${key ? `<kbd>${esc(key)}</kbd>` : ''}`;
  tip.hidden = false;
  el.setAttribute('aria-describedby', 'uitip');
  place(el);
}
function hide() {
  clearTimeout(timer);
  if (cur) cur.removeAttribute('aria-describedby');
  cur = null;
  if (tip) tip.hidden = true;
}
export function initTips() {
  tip = document.createElement('div');
  tip.id = 'uitip';
  tip.className = 'uitip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  // move titles now so no native tooltip shows before the first hover
  for (const el of document.querySelectorAll(SEL)) text(el);
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (el === cur) return;
    hide();
    if (el) timer = setTimeout(() => show(el), 350);
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    hide();
    if (el && el.matches(':focus-visible')) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  addEventListener('scroll', hide, true);
}
