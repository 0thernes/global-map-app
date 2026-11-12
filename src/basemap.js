// Toggleable satellite basemap: EOxCloudless (Sentinel-2 cloudless) 2016 vintage, CC BY 4.0, the only EOX vintage that
// permits commercial use (2018+ are CC BY-NC-SA). 64 Web-Mercator tiles at z3 are fetched on demand, reprojected to an
// equirectangular 2048x1024 texture and swapped in for the day texture. Off restores the NASA Blue Marble texture.
import { ctx, setStatus } from './app_core.js';
import { loadTexURI } from './loader.js';

export const S2_ATTRIBUTION = 'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017), CC BY 4.0';
const TILE = (z, y, x) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;
let cache = null;
export const basemap = { on: false, busy: false };

function img(src) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.referrerPolicy = 'no-referrer'; i.onload = () => res(i); i.onerror = () => rej(new Error('tile ' + src)); i.src = src; });
}
async function build(z = 3) {
  const n = 2 ** z, T = 256; const merc = document.createElement('canvas'); merc.width = merc.height = n * T; const mc = merc.getContext('2d');
  await Promise.all(Array.from({ length: n * n }, (_, k) => img(TILE(z, Math.floor(k / n), k % n)).then((im) => mc.drawImage(im, (k % n) * T, Math.floor(k / n) * T))));
  const W = n * T, H = W / 2; const eq = document.createElement('canvas'); eq.width = W; eq.height = H; const ec = eq.getContext('2d');
  ec.fillStyle = '#0b1a2a'; ec.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) { // one output row per latitude; Web Mercator covers |lat| <= 85.0511
    const lat = 90 - ((y + 0.5) / H) * 180; if (Math.abs(lat) > 85.05) continue;
    const my = ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * merc.height;
    ec.drawImage(merc, 0, Math.floor(my), W, 1, 0, y, W, 1);
  }
  return eq.toDataURL('image/jpeg', 0.9);
}
export async function setSatelliteBasemap(on) {
  if (basemap.busy) return; basemap.busy = true;
  try {
    if (on) { setStatus('Loading Sentinel-2 cloudless basemap (EOX)…'); cache = cache || (await build()); await ctx.globe.setTexture('dayTex', cache); setStatus(S2_ATTRIBUTION); }
    else await ctx.globe.setTexture('dayTex', await loadTexURI(document.body.dataset.hires ? 'day8k' : 'day2k'));
    basemap.on = on; document.body.classList.toggle('basemap-s2', on);
  } catch (e) { console.warn('basemap', e); setStatus('Satellite basemap unavailable offline or blocked: ' + e.message); basemap.on = false; }
  finally { basemap.busy = false; }
}
