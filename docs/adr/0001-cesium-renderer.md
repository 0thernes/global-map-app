# ADR 0001: Replace the three.js globe with CesiumJS

- Status: accepted (v1.1.0)
- Date: 2026-11-12
- Deciders: 0thernes

## Context

The v1.0 globe was a hand-written three.js sphere with one 8K equirectangular texture. User feedback on v1.0.0:

1. Glyphs and text labels seemed to float and rotate on their own instead of sticking to the globe. The labels were
   drawn on a 2D canvas overlay and re-projected every frame, and cluster badges were rebuilt in screen space while
   the camera moved, so the badges slid across the surface.
2. Imagery was a single static texture that turned soft and blurry when you zoomed in.
3. Nothing adapted to zoom the way Google Earth does: there was no tiling, no level of detail and no terrain.
4. The fix must not depend on paid or keyed APIs.

## Decision

Render the globe with **CesiumJS** (Apache-2.0), bundled from `@cesium/engine` and `@cesium/core` and pinned to
**engine 26.5.0 / core 0.1.1**, which is CesiumJS 1.147. The Cesium runtime files (Workers, Assets and the ThirdParty
wasm) are vendored under `vendor/cesium/`. There is no CDN, so the site runs on GitHub Pages and offline-first.

- **No Cesium ion.** `Ion.defaultAccessToken` is cleared, `baseLayer: false` is set, and every source is configured
  explicitly. No ion asset (World Terrain, Bing, OSM Buildings) is referenced, and the smoke test fails on any
  request to `cesium.com`.
- **Adapter, not rewrite.** `src/globe_cesium.js` keeps the public surface of the old `Globe` class (`addPoints`,
  `addCircles`, `addLines`, `setVis`, `flyTo`, `setOrbit`, `project`, `pickGlobe`, `camera.position` in Earth radii,
  `earthU`, `glowData`, `compare`, `fx`), so the UI modules changed by only a few lines. `camera.position` is a
  synced proxy: if the app writes it (auto-rotate, workspace restore, intro pull-back), the adapter applies it to
  the Cesium camera on the next frame.
- **Primitives, not Entities.** Point layers reach about 30k rows (military) and about 100k rows (UCDP GED). The adapter
  uses `BillboardCollection`, `LabelCollection`, `PointPrimitiveCollection` and batched `Primitive`s (one GL_LINES
  geometry per line layer, and one ellipse plus one outline primitive per circle layer with per-instance `show`).
  Entities would add a DataSource and property-evaluation cost per object per frame.
- **Glued to the surface.** Every marker, label and cluster badge has a world (ECEF) position, so it moves exactly
  with the ground. Level of detail and collision avoidance now only decide _which_ labels are shown. That set is
  refreshed while the camera moves, at most every 110 ms. Clustering is decided once the camera settles, and the
  badges sit at their members' geographic centroid. The smoke test checks that a case billboard projects to within
  3 px of its lat/lon after a fly-to.
- **Far side hidden.** `globe.depthTestAgainstTerrain = false`. Cesium then draws markers over terrain but still
  occludes them behind the globe with its ellipsoid depth plane. Case pins use `CLAMP_TO_GROUND`. Large reference
  layers sit at height 0, which avoids per-billboard terrain sampling; at very oblique angles over high mountains
  they can show a little parallax.
- **Uncertainty circles keep the pin-vs-circle rule.** Imprecise rows are geodesic ellipses with their real radius in
  metres plus a faint centre dot, never a pin. Exact and within-1 km rows are pins.
- **Imagery** (all keyless, switchable in Settings; see `docs/data-sources.md`): Esri World Imagery (default, to z19),
  an Esri hybrid with roads and places, EOX Sentinel-2 cloudless 2016 (CC BY 4.0), OpenStreetMap, CARTO dark, NASA
  GIBS Blue Marble, NASA GIBS MODIS Terra true colour _for the timeline day_ (2000 onwards), and an offline bundled
  Blue Marble. If more than 16 base tiles fail (offline or blocked), the app switches to the offline basemap.
- **Night lights:** NASA Black Marble (VIIRS) from GIBS as `nightAlpha` imagery, with the bundled night texture as the
  offline fallback.
- **Terrain:** AWS Open Data _Terrain Tiles_ (Mapzen terrarium PNG, keyless, CORS `*`). Cesium has no terrarium
  provider, so `src/cesium/terrarium.js` resamples the Web Mercator PNG tiles into geographic 65×65 heightmaps
  through `CustomHeightmapTerrainProvider`. It runs at most 10 requests in flight and caches 384 tiles (LRU).
  Seafloor heights are clamped to 0 so ocean imagery and markers stay put. Esri World Elevation 3D is the
  alternative, and "flat" uses the ellipsoid.
- **Lighting and atmosphere:** `globe.enableLighting` with the sun at the timeline date and UTC hour, sky and ground
  atmosphere, and fog. Lighting fades out below about 650 km so a city is readable at night, as in Google Earth.
- **CSP:** the tile hosts are listed in `img-src` and `connect-src`, and `worker-src 'self' blob:` is set. The only
  relaxation is `'wasm-unsafe-eval'`, which permits WebAssembly compilation (meshoptimizer and draco in the engine)
  and **not** JS `eval`. That is why the prebuilt `Cesium.js` is not used: it embeds Knockout (`(0,eval)("this")`)
  for the Viewer widgets, which would need `'unsafe-eval'`. We use `CesiumWidget`, which has no Knockout.
- **Post FX:** a single custom `PostProcessStage` provides vignette, grain, chromatic aberration and an 8-tap
  highlight glow, plus FXAA. Cesium's bloom stage was rejected because it darkened and hazed the satellite imagery.
- **Centring next to docked panels:** the three.js version skewed the projection (`setViewOffset`). Cesium's
  multi-frustum rendering does not support a reliable off-centre frustum, so the canvas host is widened or shifted
  by twice the shift instead. The cost is rendering up to about 600 extra off-screen columns while a side panel is
  open.
- **DPI and resize:** `useBrowserRecommendedResolution: false`, so `resolutionScale × devicePixelRatio` is capped
  at 2. A `matchMedia` resolution watcher re-applies it when a window moves between monitors. The widget resizes
  every frame if needed.
- **Anti-aliasing:** MSAA ×4 on hardware GPUs. Software rasterisers (SwiftShader in CI) get FXAA only.

## Consequences

- Sharp imagery from orbit down to street level. 3D mountains come from open data. Labels and markers stay attached
  to the surface.
- `js/app.js` grows from about 0.9 MB to about 4.8 MB (minified and tree-shaken engine), and `vendor/cesium` adds
  8.7 MB.
- **Network:** streamed imagery and terrain need a connection. Offline, the app falls back to the bundled 2K/8K
  textures on the ellipsoid.
- **file:// limits:** Cesium's terrain meshing runs in module workers, which Chrome blocks on plain `file://`. Opened
  by double-click, the app therefore defaults to the flat ellipsoid; imagery, markers, labels and every panel still
  work. For terrain, serve the folder (`npm run serve` or `python3 -m http.server`) or use GitHub Pages.
- **Compare mode:** Cesium renders one view per frame. The B side is a split twin of each time-aware billboard layer
  (`SplitDirection.RIGHT`) at the compare date, with the swipe as `scene.splitPosition`. "Split" behaves as a swipe
  fixed at 50 %. Circles and lighting follow side A.
- **Country hover highlight and conflict glow** are baked into a 1024×512 equirectangular overlay from the country
  id map. They are blocky at street level, which is acceptable for a hover cue.
- **Debug flags:** `?gmdbg=c` skips circle primitives and `?gmdbg=l` skips line primitives (for bisecting performance);
  any `gmdbg` value logs frames slower than 400 ms.

## Alternatives considered

| Option                                | Why not                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Keep three.js and add a tile renderer | Re-implements quadtree LOD, terrain, horizon culling and label placement that Cesium ships. |
| MapLibre GL globe                     | Globe projection is 2.5D (no real terrain mesh from orbit); 3D labels limited.              |
| deck.gl `_GlobeView`                  | Experimental; no terrain on the globe view.                                                 |
| Google Photorealistic 3D Tiles        | Requires an API key and billing.                                                            |
| Cesium ion World Terrain / Bing       | Requires an ion token.                                                                      |
| Prebuilt `Cesium.js` from a CDN       | Needs `'unsafe-eval'` (Knockout) and a third-party script origin in the CSP.                |
