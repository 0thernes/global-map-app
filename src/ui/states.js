// Panel states (v1.5, ADR 0005 section 5): one markup for loading, empty and error, so every panel tells the user the
// same three things the same way: what is happening, why, and what to do next. Pure string builders (no DOM), so the
// markup is unit-tested (test/unit/states.test.mjs). Loading and empty are polite live regions; error is an alert.
import { icon } from '../icons.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const STATE_KINDS = {
  loading: { icon: 'loader-circle', role: 'status', live: 'polite' },
  empty: { icon: 'inbox', role: 'status', live: 'polite' },
  error: { icon: 'circle-alert', role: 'alert', live: 'assertive' },
};
/**
 * @param {'loading'|'empty'|'error'} kind
 * @param {string} title  one short sentence: what is happening
 * @param {object} [o]
 * @param {string} [o.detail]  why, or what the panel needs
 * @param {{id: string, label: string}} [o.action]  one recovery button (the caller binds it by id)
 * @param {boolean} [o.compact]  inline variant for lists
 */
export function panelState(kind, title, o = {}) {
  const k = STATE_KINDS[kind] || STATE_KINDS.empty;
  const cls = `pstate pstate-${STATE_KINDS[kind] ? kind : 'empty'}${o.compact ? ' compact' : ''}`;
  const act = o.action
    ? `<button class="btn sm pstate-act" id="${esc(o.action.id)}" type="button">${icon('refresh-cw', 14)} ${esc(o.action.label)}</button>`
    : '';
  return (
    `<div class="${cls}" role="${k.role}" aria-live="${k.live}"${kind === 'loading' ? ' aria-busy="true"' : ''}>` +
    `<span class="pstate-ico" aria-hidden="true">${icon(k.icon, o.compact ? 16 : 22)}</span>` +
    `<div class="pstate-txt"><p class="pstate-title">${esc(title)}</p>` +
    (o.detail ? `<p class="pstate-detail">${esc(o.detail)}</p>` : '') +
    `${act}</div></div>`
  );
}
export const loadingState = (title, o) => panelState('loading', title, o);
export const emptyState = (title, o) => panelState('empty', title, o);
export const errorState = (title, o) => panelState('error', title, o);

/**
 * What to tell the user when the app cannot start (v1.5.1 hardening). A WebGL failure is the common case (hardware
 * acceleration off, blocked GPU, very old browser); anything else is reported as it is, with the same recovery.
 * @param {unknown} err
 * @returns {{title: string, detail: string}}
 */
export function bootFailure(err) {
  const msg = String((err && err.message) || err || 'unknown error').slice(0, 300);
  const gl = /webgl|context|gpu|getContext/i.test(msg);
  return gl
    ? {
        title: 'The 3D globe could not start: WebGL is not available.',
        detail: `Turn on hardware acceleration in the browser settings, update the graphics driver, or try a current Chrome, Edge or Firefox. (${msg})`,
      }
    : {
        title: 'Global Map could not start.',
        detail: `Reload the page. If it happens again, open an issue with this message: ${msg}`,
      };
}
