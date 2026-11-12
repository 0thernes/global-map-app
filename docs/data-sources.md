# Keyless imagery, terrain and live data sources

The app uses **no API key, no token and no paid service**. Each source below was checked on 2026-11-12 with
`curl -H "Origin: https://0thernes.github.io"`: every one answered `200` with a CORS header that allows a browser on
GitHub Pages to use it.

Candidates came from community API hubs:

- [public-apis/public-apis](https://github.com/public-apis/public-apis) (Geocoding, Open Data, Science & Math,
  Environment, Transportation)
- [Awesome GIS](https://github.com/sshuair/awesome-gis)
- the OSM wiki [raster tile providers](https://wiki.openstreetmap.org/wiki/Raster_tile_providers) list
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/)

## In the app

### Basemaps (Settings › Imagery and terrain)

| Id           | Source                                                          | Endpoint (template)                                                                                                                             | Max zoom          | Terms / attribution                                                                                                                         |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `esri`       | Esri World Imagery (default)                                    | `server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`                                                         | 19 (street level) | Esri terms of use; attribution "Esri, Maxar, Earthstar Geographics, and the GIS User Community"; keyless public tile service, use with care |
| `hybrid`     | Esri imagery + World Transportation + Boundaries and Places     | as above + `Reference/World_Transportation`, `Reference/World_Boundaries_and_Places`                                                            | 19                | as above (HERE, Garmin reference data)                                                                                                      |
| `s2`         | EOX Sentinel-2 cloudless **2016**                               | `tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg`                                                                       | 15                | **CC BY 4.0**; only the 2016 vintage is free for any use (2018+ is CC BY-NC-SA)                                                             |
| `osm`        | OpenStreetMap standard tiles                                    | `tile.openstreetmap.org/{z}/{x}/{y}.png`                                                                                                        | 19                | ODbL data; [tile usage policy](https://operations.osmfoundation.org/policies/tiles/): attribution shown, no bulk download, light use only   |
| `dark`       | CARTO Dark Matter                                               | `{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`                                                                                          | 19                | © OpenStreetMap contributors © CARTO; free for non-commercial / low volume under CARTO's basemap terms                                      |
| `bluemarble` | NASA Blue Marble shaded relief and bathymetry                   | `gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg` | 8                 | NASA, no restrictions; credit NASA EOSDIS GIBS                                                                                              |
| `modis`      | NASA MODIS Terra corrected reflectance **for the timeline day** | `.../MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`                                     | 9                 | NASA; daily from 2000-02-24, clamped to two days ago                                                                                        |
| `local`      | Bundled NASA Blue Marble textures (offline)                     | `textures/day2k.js`, `day8k.js`                                                                                                                 | n/a               | NASA Visible Earth                                                                                                                          |

Night lights: NASA **Black Marble** (VIIRS 2016) from GIBS
(`VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8`), drawn only on the dark side. The bundled night
texture is the fallback.

### Terrain

| Id          | Source                                                                                                      | Notes                                                                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terrarium` | AWS Open Data **Terrain Tiles** (Mapzen), `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Default over http(s). Built from SRTM, GMTED2010, ETOPO1, NED, EU-DEM, LINZ, ArcticDEM and others; attribution per [the data sources list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Decoded in-app (height = R×256 + G + B/256 − 32768) to z14. |
| `esri`      | Esri World Elevation 3D (`elevation3d.arcgis.com/.../Terrain3D/ImageServer`)                                | Keyless, LERC heightmaps through Cesium's `ArcGISTiledElevationTerrainProvider`; Esri terms apply.                                                                                                                                                                        |
| `off`       | WGS84 ellipsoid                                                                                             | Default on `file://` (Cesium terrain meshing uses module workers, which Chrome blocks on `file://`).                                                                                                                                                                      |

**Not used:** Cesium ion World Terrain and Google Photorealistic 3D Tiles both need a key. Open Topo Data
(public-apis › Geocoding) is point queries only, not tiles.

### Live feeds (Layers › Earth hazards, online only)

| Layer                            | Source                                                                                                                     | Hub entry                                                      | Licence       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- |
| LIVE: earthquakes M4.5+, 30 days | USGS Earthquake Hazards Program GeoJSON summary feed `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson` | public-apis › Science & Math › USGS Earthquake Hazards Program | public domain |
| LIVE: natural events             | NASA EONET v3 `eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60`                                                      | public-apis › Science & Math › NASA                            | public domain |

Each event's dossier links back to the feed's own page (`source_url`). Nothing is cached or redistributed.

## PDF 7 as data (since 1.2)

`data/tools/pdf7_dataset.py` builds `data/pdf7_data.js` from a committed snapshot in `data/sources/pdf7/snap/`. The
snapshot is refreshed from `/workspace/qwm` when that folder exists. Nothing in this file has coordinates.

| Part                 | Source                                                                                    | Traceability                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Entries (660)        | `What-Is-What-of-the-What-entries.csv` (Part I), `...-glitches.csv` (Parts II and V)      | § from the label position in `main.tex`; printed page from `main.aux`              |
| Tables (165 + 7)     | every `tabular`/`longtable` in `main.tex`; QWM `counts_by_*`, nuclear and distance tables | § from `main.toc`; page found in the PDF text layer; `main.tex` line; or file name |
| Figures (58)         | `\includegraphics` with caption                                                           | § and page                                                                         |
| CIT / ST (144)       | `What-Is-What-of-the-What-CIT-sources.csv`                                                | register label and page where the source is in the printed register (115)          |
| Taxonomy (169)       | `What-Is-What-of-the-What-UAP-NHI.csv`                                                    | taxonomy path                                                                      |
| Document links (237) | `\url`/`\href` inside the Part V case files                                               | case path; source type from the host rule                                          |

`data/unplaced.js` is written by `data/build_data.py`. It holds the public rows that the loader rejected for having no
valid point but that do have a source (397), plus the PDF 7 unplaced list and the QWM hs_candidates rows with no
single place. The same case is listed only once across these sources. It also counts rows that have a point but no
source (37). Private datasets (NUFORC) are never included.

## Reviewed, documented, not wired in (yet)

| Source                                                      | Hub                                     | Why it is interesting                                  | Why not now                                                                                                |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| OpenSky Network REST (`opensky-network.org/api/states/all`) | public-apis › Transportation            | live ADS-B aircraft, keyless (anonymous rate limit)    | 10 s anonymous quota; needs a polling layer and moving billboards                                          |
| CelesTrak GP data (`celestrak.org/NORAD/elements/gp.php`)   | public-apis › Science (via OrbitalWiki) | keyless TLEs for satellite tracks                      | SGP4 propagation needed (satellite.js, MIT); planned for the USO/satellite layer                           |
| Open-Meteo                                                  | public-apis › Weather                   | keyless historical weather for a case date and place   | non-commercial terms; better as a dossier lookup than a layer                                              |
| NASA FIRMS active fires                                     | NASA                                    | fire detections                                        | the API needs a MAP_KEY; EONET already carries wildfire events                                             |
| Nominatim / Overpass (OSM)                                  | public-apis › Geocoding                 | keyless geocoding                                      | usage policy forbids bulk or automated geocoding from a client app; used offline in the data pipeline only |
| GeoNames web services                                       | public-apis › Geocoding                 | gazetteer                                              | needs a username (a free account); the dumps are used offline instead                                      |
| GBIF occurrence API                                         | public-apis › Science                   | keyless species occurrence (animal-mutilation context) | out of scope for v1.1                                                                                      |
| Sunrise-Sunset API                                          | public-apis › Science                   | twilight times                                         | computed locally instead (src/sun.js)                                                                      |

## PDF 7 places and geocoding (since 1.1)

PDF 7 (_What Is What of the What_, QWM) is used as a source of places. `data/tools/pdf7_mine.py` reads all 381 entries
and their section numbers and pages, then applies the reviewed decisions in `data/sources/pdf7/curation.csv`.

| Item             | Rule                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which entries    | Only entries whose PDF 7 text names a place on Earth. Theories, lab results with no named site and off-Earth objects are `no_place`.                                                     |
| Cross-check      | Each entry is matched against every map layer (name, then proximity < 10 km). If it is already there, the existing rows get the PDF 7 reference instead of a duplicate.                  |
| Coordinates      | **Wikidata P625 only** (keyless `wbgetentities` API), and the Q-id and read date are recorded in `coord_source`. Allowed: GNIS, GeoNames, Wikidata, OSM. Never invented, never jittered. |
| Precision        | `within_1km` (pin) only for a specific building or site item; towns are `locality` (10 km circle) and ranges or areas are `region`.                                                      |
| Source           | Each row keeps the PDF 7 citation (`source_title`). `source_url` is the case document cited in PDF 7, or else the Wikidata item for the topic.                                           |
| Cannot be placed | Logged with the reason in [audit/pdf7-unplaced.csv](audit/pdf7-unplaced.csv), for example a sea region, a 1,000 km mountain range, or a site that PDF 7 does not name.                   |

Result (12 Nov 2026):

- 31 rows added and 1 merged into another row.
- 119 entries already on the map (134 rows tagged).
- 32 unplaced.
- 198 with no place.
