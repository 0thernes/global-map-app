// Keyless 3D terrain: AWS Open Data "Terrain Tiles" (Mapzen terrarium PNG, height = R*256 + G + B/256 - 32768 m),
// resampled from Web Mercator tiles into Cesium's geographic heightmap tiles through CustomHeightmapTerrainProvider.
const SIZE = 65; // heightmap samples per tile edge
const MAX_INFLIGHT = 10;
const CACHE_MAX = 384;

export function mercTile(lat, lon, z) {
  const n = 2 ** z;
  const la = Math.max(-85.0511, Math.min(85.0511, lat)) * (Math.PI / 180);
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  return { x: Math.min(n - 1e-9, Math.max(0, x)), y: Math.min(n - 1e-9, Math.max(0, y)) };
}
export const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

export function createTerrariumProvider(C, { url, max = 14, credit } = {}) {
  const cache = new Map(); // key -> Promise<Float32Array|null>
  let inflight = 0;
  const queue = [];
  const pump = () => {
    while (inflight < MAX_INFLIGHT && queue.length) {
      const job = queue.shift();
      inflight++;
      job().finally(() => {
        inflight--;
        pump();
      });
    }
  };
  const decode = async (blob) => {
    const bmp = await createImageBitmap(blob);
    const cv =
      typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : document.createElement('canvas');
    cv.width = cv.height = 256;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    c2.drawImage(bmp, 0, 0);
    const d = c2.getImageData(0, 0, 256, 256).data;
    const h = new Float32Array(256 * 256);
    for (let i = 0; i < h.length; i++) h[i] = decodeTerrarium(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    return h;
  };
  const tile = (z, x, y) => {
    const k = z + '/' + x + '/' + y;
    let p = cache.get(k);
    if (p) {
      cache.delete(k);
      cache.set(k, p); // LRU touch
      return p;
    }
    p = new Promise((res) => {
      queue.push(() =>
        fetch(url.replace('{z}', z).replace('{x}', x).replace('{y}', y), { mode: 'cors', credentials: 'omit' })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? decode(b) : null))
          .catch(() => null)
          .then(res),
      );
      pump();
    });
    cache.set(k, p);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  };
  const ts = new C.GeographicTilingScheme();
  return new C.CustomHeightmapTerrainProvider({
    width: SIZE,
    height: SIZE,
    tilingScheme: ts,
    credit: credit ? new C.Credit(credit) : undefined,
    callback: async (x, y, level) => {
      const r = ts.tileXYToRectangle(x, y, level);
      const z = Math.min(max, level + 1);
      const D = 180 / Math.PI;
      const W = r.west * D,
        E = r.east * D,
        N = r.north * D,
        S = r.south * D;
      // all mercator tiles touching this rectangle
      const a = mercTile(N, W, z),
        b = mercTile(S, E, z);
      const need = new Map();
      for (let ty = Math.floor(a.y); ty <= Math.floor(b.y); ty++)
        for (let tx = Math.floor(a.x); tx <= Math.floor(b.x); tx++) need.set(tx + ':' + ty, tile(z, tx, ty));
      const got = new Map();
      await Promise.all([...need].map(([k, p]) => p.then((h) => got.set(k, h))));
      const out = new Float32Array(SIZE * SIZE);
      for (let j = 0; j < SIZE; j++) {
        const lat = N + ((S - N) * j) / (SIZE - 1);
        for (let i = 0; i < SIZE; i++) {
          const lon = W + ((E - W) * i) / (SIZE - 1);
          const m = mercTile(lat, lon, z);
          const tx = Math.floor(m.x),
            ty = Math.floor(m.y);
          const h = got.get(tx + ':' + ty);
          if (!h) continue;
          const px = Math.min(255, (m.x - tx) * 256),
            py = Math.min(255, (m.y - ty) * 256);
          const x0 = Math.min(254, Math.floor(px)),
            y0 = Math.min(254, Math.floor(py));
          const fx = px - x0,
            fy = py - y0;
          const v =
            h[y0 * 256 + x0] * (1 - fx) * (1 - fy) +
            h[y0 * 256 + x0 + 1] * fx * (1 - fy) +
            h[(y0 + 1) * 256 + x0] * (1 - fx) * fy +
            h[(y0 + 1) * 256 + x0 + 1] * fx * fy;
          out[j * SIZE + i] = Math.max(0, v); // sea floor flattened to sea level so ocean imagery and markers stay put
        }
      }
      return out;
    },
  });
}
