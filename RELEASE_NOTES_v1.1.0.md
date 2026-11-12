# Global Map App v1.1.0: a Google Earth-style globe, keyless

**The globe is now CesiumJS.** Markers, uncertainty circles and labels are attached to the ground, so they no longer
float or rotate against the Earth. Imagery streams as tiles and stays sharp from orbit to street level. 3D terrain,
real sun lighting, NASA night lights and atmosphere are back. Everything is keyless: no API keys, no Cesium ion.

## Highlights

- **Imagery** (Settings → Imagery and terrain, or `?basemap=`):
  - Esri World Imagery (default) and Esri hybrid
  - Sentinel-2 cloudless 2016 (EOX)
  - OpenStreetMap
  - CARTO dark
  - NASA Blue Marble
  - NASA MODIS imagery _of the timeline day_
  - Offline Blue Marble, used automatically when tiles fail
- **Terrain** (`?terrain=`): AWS Terrain Tiles (Mapzen terrarium), Esri World Elevation, or flat.
- **Labels** thin out with distance and avoid overlapping; dense areas become cluster badges, and clicking a badge zooms in.
- **Live layers**: USGS earthquakes M4.5+ (30 days) and NASA EONET open natural events.
- **PDF 7 as a source**:
  - All 381 entries were cross-checked against the map.
  - 31 Wikidata-geocoded rows were added, and 134 existing rows now carry **PDF 7 §x.y (p. n)**.
  - 32 unplaceable entries are logged in `docs/audit/pdf7-unplaced.csv`.
  - A new **PDF 7 index** tab maps sections to map entries.
- Everything from 1.0 is kept:
  - the pin and circle rule
  - source, grade and coordinate source on click
  - the layer tree, filters and timeline
  - hotspots, analysis and reports
  - the tour, ENGAGE and audio
  - the compare swipe, glow and post effects

## Notes

- Serve the folder over HTTP (`npm run serve`). Opening `index.html` from disk still works, but terrain is flat there
  (browsers block module workers on `file://`).
- The CSP adds only `'wasm-unsafe-eval'` (Cesium's WebAssembly) and the tile hosts. There is no `'unsafe-eval'`.
- Decision record: `docs/adr/0001-cesium-renderer.md`. Sources: `docs/data-sources.md`. Full list: `CHANGELOG.md`.
