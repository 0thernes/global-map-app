// Live, keyless, CORS-enabled public feeds (found via github.com/public-apis/public-apis; see docs/data-sources.md).
// Fetched on demand when the layer is switched on; nothing is cached to disk or redistributed.
const get = async (url) => {
  const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// USGS Earthquake Hazards Program: M4.5+ in the past 30 days (GeoJSON summary feed, public domain)
export async function usgsQuakes() {
  const j = await get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson');
  return {
    source: 'USGS Earthquake Hazards Program, M4.5+ past 30 days (live GeoJSON feed, public domain)',
    items: j.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => ({
        name: `M${(+f.properties.mag).toFixed(1)} ${f.properties.place || ''}`.trim(),
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth_km: f.geometry.coordinates[2],
        mag: f.properties.mag,
        date: iso(f.properties.time),
        kind: 'earthquake',
        source_url: f.properties.url,
        coord_source: 'USGS ComCat epicentre',
      })),
  };
}
// NASA EONET v3: open natural events (wildfires, storms, volcanoes, ice, floods), latest geometry point
export async function nasaEonet() {
  const j = await get('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60');
  const items = [];
  for (const e of j.events || []) {
    const g = (e.geometry || []).filter((x) => x.type === 'Point').pop();
    if (!g) continue;
    items.push({
      name: e.title,
      lon: g.coordinates[0],
      lat: g.coordinates[1],
      date: String(g.date || '').slice(0, 10),
      kind: (e.categories || []).map((c) => c.title).join(', '),
      source_url: (e.sources || [])[0]?.url || e.link,
      coord_source: 'NASA EONET event geometry',
    });
  }
  return { source: 'NASA Earth Observatory Natural Event Tracker (EONET v3), open events, last 60 days (live)', items };
}
