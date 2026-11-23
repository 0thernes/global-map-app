// Globe reference tools (v1.5, ADR 0005): lat/lon grid (J), terminator and twilight rings (Y) and the density
// heatmap (H) as map-tool toggles, a Globe section in Settings, and the choices remembered in localStorage.
// These overlays are drawn from the camera and the timeline date; they never add, move or hide a case.
import { ctx, $, on, setStatus, layerById } from '../app_core.js';
import { icon } from '../icons.js';

const LSK = { grid: 'gm.ui.grid', term: 'gm.ui.terminator' };
const get = (k) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const put = (k, on) => {
  try {
    localStorage.setItem(k, on ? '1' : '0');
  } catch {}
};
const press = (sel, on) => {
  const b = $(sel);
  if (b) b.setAttribute('aria-pressed', String(!!on));
};
export function setGrid(on, quiet) {
  put(LSK.grid, on);
  ctx.globe.setGraticule(on);
  press('#btn-grid', on);
  const cb = $('#s-grid');
  if (cb) cb.checked = !!on;
  if (!quiet) setStatus(`Lat/lon grid ${on ? 'on: spacing follows the zoom' : 'off'}`);
}
export function setTerminator(on, quiet) {
  put(LSK.term, on);
  ctx.globe.setTerminator(on);
  press('#btn-term', on);
  const cb = $('#s-term');
  if (cb) cb.checked = !!on;
  if (!quiet)
    setStatus(on ? 'Terminator on: sunrise/sunset line and twilight rings for the timeline date' : 'Terminator off');
}
export const toggleGrid = () => setGrid(!get(LSK.grid));
export const toggleTerminator = () => setTerminator(!get(LSK.term));
export const syncHeatButton = () => press('#btn-heat', layerById('heat')?.on);

function settingsSection() {
  const host = $('#set-body');
  if (!host || host.querySelector('#set-globe')) return;
  host.insertAdjacentHTML(
    'beforeend',
    `<div id="set-globe"><h4>${icon('grid-3x3', 14)} Globe reference</h4>
     <label class="tog"><input type="checkbox" id="s-grid" ${get(LSK.grid) ? 'checked' : ''}> Latitude / longitude grid (J)</label>
     <label class="tog"><input type="checkbox" id="s-term" ${get(LSK.term) ? 'checked' : ''}> Terminator and twilight rings (Y)</label>
     <p class="small muted">Both are drawn from the camera and the timeline date. Pins mark exact or ≤1 km rows and their ring shows the evidence grade; dashed circles mark locality or region rows at their stated radius.</p></div>`,
  );
  $('#s-grid').onchange = (e) => setGrid(e.target.checked);
  $('#s-term').onchange = (e) => setTerminator(e.target.checked);
}

export function initGlobeTools() {
  $('#btn-grid').onclick = toggleGrid;
  $('#btn-term').onclick = toggleTerminator;
  $('#btn-heat').onclick = () => import('../ui_misc.js').then((m) => m.runAction('heat'));
  setGrid(get(LSK.grid), true);
  setTerminator(get(LSK.term), true);
  syncHeatButton();
  on('layers-changed', syncHeatButton);
  new MutationObserver(settingsSection).observe($('#set-body'), { childList: true });
  // high-contrast theme: the overlays switch to opaque white / yellow (src/cesium/reference.js REF_COLORS)
  const hc = () => ctx.globe.ref.setContrast(document.body.classList.contains('theme-hc'));
  new MutationObserver(hc).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  hc();
  window.__ref = (grid, term) => {
    setGrid(!!grid, true);
    setTerminator(!!term, true);
  };
}
