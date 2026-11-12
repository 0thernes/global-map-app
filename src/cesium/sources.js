// Keyless imagery and terrain sources for the Cesium globe. Every entry is free to use without an API key or token;
// terms and attributions are listed in CREDITS.md and docs/data-sources.md. No Cesium ion asset is used anywhere.
export const BASEMAPS = [
  {
    id: 'esri',
    name: 'Satellite (Esri World Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    max: 19,
    credit: 'Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  {
    id: 'hybrid',
    name: 'Hybrid (Esri imagery + roads + places)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    max: 19,
    credit: 'Imagery and reference: Esri, Maxar, Earthstar Geographics, HERE, Garmin, and the GIS User Community',
    overlays: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
  },
  {
    id: 's2',
    name: 'Sentinel-2 cloudless 2016 (EOX, CC BY 4.0)',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
    max: 15,
    credit:
      'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017)',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap (standard)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    max: 19,
    credit: '© OpenStreetMap contributors (ODbL)',
  },
  {
    id: 'dark',
    name: 'Dark (CARTO)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    sub: ['a', 'b', 'c', 'd'],
    max: 19,
    credit: '© OpenStreetMap contributors © CARTO',
  },
  {
    id: 'bluemarble',
    name: 'Blue Marble (NASA GIBS)',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    max: 8,
    credit: 'Blue Marble: NASA Earth Observatory, served by NASA GIBS',
  },
  {
    id: 'modis',
    name: 'Satellite of the timeline day (NASA GIBS MODIS Terra)',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    max: 9,
    daily: '2000-02-24',
    credit: 'MODIS Terra Corrected Reflectance: NASA EOSDIS GIBS',
  },
  {
    id: 'local',
    name: 'Offline (bundled Blue Marble texture)',
    local: true,
    credit: 'Blue Marble: NASA Visible Earth',
  },
];
export const NIGHT = {
  url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
  max: 8,
  credit: 'Night lights: NASA Black Marble (VIIRS), served by NASA GIBS',
};
export const TERRAINS = [
  {
    id: 'terrarium',
    name: '3D terrain: AWS Terrain Tiles (open data, Mapzen)',
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    max: 14,
    credit: 'Terrain: Mapzen / AWS Open Data Terrain Tiles (SRTM, GMTED, ETOPO1, NED and others)',
  },
  {
    id: 'esri',
    name: '3D terrain: Esri World Elevation (keyless)',
    url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    credit: 'Terrain: Esri World Elevation 3D',
  },
  { id: 'off', name: 'Flat (ellipsoid, fastest)' },
];
