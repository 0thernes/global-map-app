// Imagery and terrain selection for the Cesium globe (ADR 0001). All sources are keyless; see src/cesium/sources.js,
// CREDITS.md and docs/data-sources.md. Choice persists in localStorage; URL params ?basemap=<id> and ?terrain=<id> win.
import { BASEMAPS, TERRAINS } from './cesium/sources.js';
import { ctx, setStatus } from './app_core.js';

export { BASEMAPS, TERRAINS };
const ALIAS = { s2: 's2', satellite: 'esri', eox: 's2', offline: 'local', flat: 'off', none: 'off' };
const store = {
  get: (k) => {
    try {
      return localStorage.getItem('gm.' + k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem('gm.' + k, v);
    } catch {
      /* private mode */
    }
  },
};
export const imagery = { basemap: 'esri', terrain: 'off' };
const norm = (v) => (v ? ALIAS[v] || v : v);

export function initImagery(g) {
  const P = new URLSearchParams(location.search);
  const b = norm(P.get('basemap')) || store.get('basemap') || 'esri';
  // workers (terrain meshing) need http(s); a plain file:// page falls back to the ellipsoid
  const tDefault = location.protocol === 'file:' ? 'off' : 'terrarium';
  const t = norm(P.get('terrain')) || store.get('terrain') || tDefault;
  setBasemap(b, { g, quiet: true, persist: false });
  setTerrain(t, { g, persist: false });
}
export function setBasemap(id, { g = ctx.globe, quiet = false, persist = true } = {}) {
  const b = g.setBasemap(id);
  imagery.basemap = b.id;
  if (persist) store.set('basemap', b.id);
  document.body.dataset.basemap = b.id;
  if (!quiet) setStatus(`Basemap: ${b.name}. ${b.credit}`);
  return b;
}
export async function setTerrain(id, { g = ctx.globe, persist = true } = {}) {
  const t = await g.setTerrain(id);
  imagery.terrain = t;
  if (persist) store.set('terrain', t);
  document.body.dataset.terrain = t;
  return t;
}
