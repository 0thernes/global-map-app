// Tab component (v1.3, ADR 0003): one underline tab style everywhere, ARIA tablist / tab / tabpanel roles,
// roving tabindex with Left / Right / Home / End keys (automatic activation), and scroll arrows when the tabs
// overflow their row. The key handling is a pure function (nextTab) so it is unit-tested without a browser.
import { icon } from '../icons.js';

/** Index of the tab that a key press moves to, or -1 for keys the tablist does not handle. */
export function nextTab(i, key, n) {
  if (n <= 0) return -1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return -1;
}

/**
 * Render tabs into `host`. tabs: [[id, label, extra?]]; opts: { active, onChange(id), attr: 'dt' (data-dt="id"),
 * panel: element id the tabs control, label: accessible name }. Returns { set(id), el }.
 */
export function makeTabs(host, tabs, { active, onChange, attr = 'tab', panel, label, kbd } = {}) {
  host.classList.add('tabbar');
  host.classList.remove('tabs');
  host.removeAttribute('role');
  host.innerHTML = '';
  const prev = arrow('prev', 'Scroll tabs left', 'chevron-left');
  const next = arrow('next', 'Scroll tabs right', 'chevron-right');
  const list = document.createElement('div');
  list.className = 'tablist';
  list.setAttribute('role', 'tablist');
  if (label) list.setAttribute('aria-label', label);
  const btns = tabs.map(([id, text, extra]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.id = `${host.id || 'tabs'}-${id}`;
    b.dataset[attr] = id;
    b.setAttribute('role', 'tab');
    if (panel) b.setAttribute('aria-controls', panel);
    b.innerHTML = `<span>${text}</span>${extra ? ` ${extra}` : ''}${kbd && kbd[id] ? ` <kbd>${kbd[id]}</kbd>` : ''}`;
    b.onclick = () => select(id, true);
    list.append(b);
    return b;
  });
  host.append(prev, list, next);
  let cur = null;
  function select(id, fire) {
    cur = id;
    for (const b of btns) {
      const on = b.dataset[attr] === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && fire && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (panel) {
      const p = document.getElementById(panel);
      const on = btns.find((b) => b.dataset[attr] === id);
      if (p && on) {
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', on.id);
      }
    }
    if (fire && onChange) onChange(id);
  }
  list.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    const j = nextTab(i, e.key, btns.length);
    if (i < 0 || j < 0) return;
    e.preventDefault();
    btns[j].focus();
    select(btns[j].dataset[attr], true);
  });
  // Overflow is judged against the host (the whole tab bar), not the scrolling list: showing the arrows narrows the
  // list, so measuring the list inside a ResizeObserver on it fed back into its own size ("ResizeObserver loop
  // completed with undelivered notifications", F-B21-1). The host width does not change when the arrows toggle.
  const sync = () => {
    const s = overflowState({
      content: list.scrollWidth,
      host: host.clientWidth,
      left: list.scrollLeft,
      view: list.clientWidth,
    });
    if (host.classList.contains('overflow') !== s.over) host.classList.toggle('overflow', s.over);
    prev.disabled = s.prevOff;
    next.disabled = s.nextOff;
  };
  prev.onclick = () => list.scrollBy({ left: -list.clientWidth * 0.7, behavior: 'smooth' });
  next.onclick = () => list.scrollBy({ left: list.clientWidth * 0.7, behavior: 'smooth' });
  list.addEventListener('scroll', sync, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sync).observe(host);
  select(active ?? tabs[0]?.[0], false);
  sync();
  return { el: host, list, set: (id) => select(id, false), get: () => cur, sync };
}
/** Pure: does the tab content overflow its bar, and which scroll arrows are disabled. Widths in px. */
export function overflowState({ content, host, left = 0, view = host }) {
  const over = content > host + 1;
  return { over, prevOff: !over || left <= 0, nextOff: !over || left + view >= content - 1 };
}
function arrow(cls, label, ic) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab-arrow ' + cls;
  b.setAttribute('aria-label', label);
  b.tabIndex = -1;
  b.innerHTML = icon(ic, 16);
  return b;
}
