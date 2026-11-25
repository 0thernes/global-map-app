// Workspace files (Export ▸ workspace JSON, Save / Load in this browser) are user-supplied input: validate the shape
// and clamp every value before it touches the app state. Pure (no DOM); unit-tested in test/unit/hardening.test.mjs.
export const WORKSPACE_VERSION = 1;
const MAX_LIST = 5000;
const MAX_TEXT = 100000;

const strList = (a, allow) =>
  Array.isArray(a)
    ? [...new Set(a.filter((x) => typeof x === 'string' && x.length <= 300 && (!allow || allow.has(x))))].slice(
        0,
        MAX_LIST,
      )
    : [];
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * @param {unknown} w parsed JSON
 * @param {{dayMin:number, dayMax:number, layerIds?:Iterable<string>}} lim
 * @returns {{cur:number, hour:number, camera:number[]|null, layers:string[], filters:object, notes:string, pinned:string[], selected:string|null}}
 * @throws {Error} with a user-facing message when the file is not a Global Map workspace
 */
export function sanitizeWorkspace(w, lim) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) throw new Error('not a Global Map workspace file');
  if (w.v != null && w.v !== WORKSPACE_VERSION) throw new Error(`workspace version ${w.v} is not supported`);
  const layerIds = lim.layerIds ? new Set(lim.layerIds) : null;
  const f = w.filters && typeof w.filters === 'object' ? w.filters : {};
  let range = null;
  if (Array.isArray(f.range) && f.range.length === 2 && f.range.every(finite)) {
    const a = clamp(Math.min(...f.range), lim.dayMin, lim.dayMax);
    const b = clamp(Math.max(...f.range), lim.dayMin, lim.dayMax);
    range = [Math.round(a), Math.round(b)];
  }
  const cam =
    Array.isArray(w.camera) && w.camera.length === 3 && w.camera.every(finite) && Math.hypot(...w.camera) > 0
      ? w.camera.slice()
      : null;
  return {
    cur: finite(w.cur) ? Math.round(clamp(w.cur, lim.dayMin, lim.dayMax)) : lim.dayMax,
    hour: finite(w.hour) ? clamp(w.hour, 0, 24) : 12,
    camera: cam,
    layers: strList(w.layers, layerIds),
    filters: {
      cats: strList(f.cats),
      grades: strList(f.grades),
      eras: strList(f.eras),
      countries: strList(f.countries),
      prec: strList(f.prec),
      range,
      q:
        typeof f.q === 'string'
          ? f.q
              .slice(0, 300)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
          : '',
    },
    notes: typeof w.notes === 'string' ? w.notes.slice(0, MAX_TEXT) : '',
    pinned: strList(w.pinned),
    selected: typeof w.selected === 'string' ? w.selected : null,
  };
}
