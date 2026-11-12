# Credits, sources and licences

See also [DATA_LICENSE.md](DATA_LICENSE.md) for what you may do with the data, and the in-app **Index › Sources** and **Index › Credits** tabs.

Every layer shows its source in-app (Layers → ⓘ). Nothing on the globe is invented: every point is a row from a cited dataset, never jittered; imprecise rows are drawn as uncertainty circles.

## Earth imagery (textures/)
| File | Source | Licence | Resolution shipped |
|---|---|---|---|
| day8k / day2k | NASA Visible Earth, Blue Marble Next Generation, *world.topo.200408* (Aug 2004), 21600×10800 original | NASA imagery, public domain (credit NASA Earth Observatory / Reto Stöckli) | 8192×4096 JPEG (2048×1024 quick-load) |
| night8k / night2k | NASA Earth Observatory, Black Marble 2016 (3 km) | public domain (credit NASA Earth Observatory / Joshua Stevens, Suomi NPP VIIRS) | 8192×4096 JPEG (2048×1024 quick-load) |
| bump4k | GEBCO_08 elevation shaded relief via NASA Visible Earth (*gebco_08_rev_elev_21600x10800*) | NASA/GEBCO, public domain | 4096×2048 |
| spec4k | derived water mask from GEBCO_08 bathymetry (*gebco_08_rev_bath*) | NASA/GEBCO, public domain | 4096×2048 |
Downloaded from assets.science.nasa.gov (the eoimages.gsfc.nasa.gov host refused TLS from the box). Textures are base64-inlined into `textures/*.js` so `index.html` works from file://.

## Reference layers (data/layers/)
| Layer | Source | Licence |
|---|---|---|
| Countries, borders, coastlines, states/provinces, labels, lakes, rivers, urban areas, land mask | Natural Earth 1:10m / 1:50m (admin-0, admin-1, coastline, lakes, rivers+lake centerlines, urban areas, populated places, geography regions) | public domain |
| Cities ≥15k, towns 5–15k | GeoNames cities15000 / cities5000 | CC BY 4.0 |
| Postal / ZIP codes (AU, BR, CA, DE, FR, GB, IN, JP, MX, US; lazy per country) | GeoNames postal code dumps (download.geonames.org/export/zip) | CC BY 4.0 |
| Military bases & sites | US DoD MIRTA "DoD Sites – Points" (DISDI, data.gov); Wikidata items (military base Q18691599, military installation Q245016, air base Q695850, naval base Q1324633, fort Q1785071 and subclasses) with P625 coordinates, queried 2026-11-12; QWM `map_military_bases.csv` seeds (Wikidata-derived; deduped); OpenStreetMap military=* via Overpass when reachable | public domain; CC0; CC0; ODbL 1.0 (© OpenStreetMap contributors) |
| Nuclear power reactors | GeoNuclearData v0.17 (Cristian Stoica), derived from IAEA PRIS and World Nuclear Association | ODbL 1.0 (cite IAEA PRIS + WNA) |
| Nuclear sites (QWM / Wikidata) | QWM `map_nuclear_sites.csv` (Wikidata SPARQL, per-row Wikidata URL) | CC0 |
| Nuclear tests 1945–1998(+) | QWM `map_nuclear_tests.csv`, built from `/workspace/qwm/wiw/data/nuclear_explosions.csv` = Bergkvist & Ferm (2000) *Nuclear Explosions 1945–1998*, FOA/SIPRI, via TidyTuesday 2019-08-20 | research dataset, cited per row |
| Wars & conflicts | UCDP/PRIO Armed Conflict Dataset v25.1; UCDP Battle-Related Deaths v25.1; UCDP One-Sided Violence v25.1; UCDP GED v25.1 (Sundberg & Melander 2013; Davies et al. 2025) | CC BY 4.0 |
| Wars (pre-1946) | Correlates of War Inter-State v4.0, Intra-State v4.1, Extra-State v4.0 (Sarkees & Wayman 2010) | free for research, cite COW |
| Genocides | USHMM Holocaust Encyclopedia; UN (Rwanda, Srebrenica); ICTY; Yale Genocide Studies Program (Cambodia) – figures quoted with URLs per item | cited per item |
| Active faults | GEM Global Active Faults Database (Styron & Pagani 2020) | CC BY-SA 4.0 |
| Quaternary faults (US) | USGS Quaternary Fault and Fold Database | public domain |
| Plate boundaries | Bird (2003) PB2002, GeoJSON by fraxen/tectonicplates | ODC-By 1.0 |
| Volcanoes | Smithsonian Global Volcanism Program, Volcanoes of the World v5 (Holocene list) | cite GVP (doi:10.5479/si.GVP.VOTW5-2024.5.2) |
| Population-weighted baseline (analysis) | GeoNames cities15000 weighted by population (fallback; GHS-POP / GPW v4 not bundled) | CC BY 4.0 |

## Water, seafloor and sky (added in 1.0)
| Layer | Source | Licence |
|---|---|---|
| Seafloor never directly mapped (overlay) | GEBCO Compilation Group (2025) *GEBCO 2025 Grid*, Type Identifier (TID) grid, doi:10.5285/37c52e96-24ea-67ce-e063-7086abc05f29; Nippon Foundation–GEBCO **Seabed 2030** Project | GEBCO grid: public domain, attribution requested ("GEBCO Compilation Group (2025) GEBCO 2025 Grid") |
| Lakes ≥ 10 km² (always) and 1–10 km² (lazy 10° tiles) | HydroLAKES v1.0 (Messager, M.L., Lehner, B., Grill, G., Nedeva, I., Schmitt, O. (2016): Estimating the volume and age of water stored in global lakes using a geo-statistical approach. *Nature Communications* 7: 13603, doi:10.1038/ncomms13603), www.hydrosheds.org | CC BY 4.0 |
| Fireballs and bolides | NASA JPL Center for Near Earth Object Studies (CNEOS), Fireball and Bolide Data API, cneos.jpl.nasa.gov/fireballs (snapshot in `data/sources/external/cneos_fireball.json`) | NASA/JPL-Caltech; US government-funded data, use with credit |
| Satellite basemap (optional, online) and dossier close-ups | EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017). Only the **2016** vintage is used: it is CC BY 4.0; 2018+ vintages are CC BY-NC-SA 4.0 (non-commercial) | CC BY 4.0 |
| "View imagery" links | Google Maps (satellite view), EOX/Sentinel Hub EO Browser, NASA Worldview: links only, nothing is copied | links |
| Geocodes in QWM rows (coord_source = OSM Nominatim) | © OpenStreetMap contributors | ODbL 1.0 (attribution; share-alike applies to the derived database) |

## Case data (data/cases.js)
- `data/sources/qwm_uap_cases.csv`: QWM `hs_candidates.csv` (31) + dated/located/sourced incidents from `What-Is-What-of-the-What-glitches.csv`; place names geocoded with OpenStreetMap Nominatim (ODbL; 1 req/s, cached in `data/tools/geocode_cache.json`). Rows QWM later publishes in a `map_*` layer are superseded by the QWM row.
- QWM layer drops in `/workspace/qwm/wiw/data/map/map_*.csv` (common schema, per-row `source_url`, `grade`, `coord_source`); a public snapshot is kept in `data/sources/qwm/*.csv.gz` so the build is reproducible from a fresh clone. The QWM `sources_registry.csv` (29 datasets, each with owner and licence) is rendered in Briefings.
- GEIPAN case files (CNES / GEIPAN via data.gouv.fr): Licence Ouverte / Etalab 2.0. Commune geocodes: geo.api.gouv.fr (Licence Ouverte 2.0).
- **NUFORC** public report database (scrubbed extract by planetsig, github.com/planetsig/ufo-reports): **no licence stated**. These rows are *not* in the repository; they are built into the git-ignored `data/private/` and load only on your own machine. See the licensing dilemma in `docs/audit/SUMMARY.md`.
- Nuclear tests: SIPRI/FOA (Bergkvist & Ferm 2000), USGS ComCat (DPRK tests), RERF DS02 and the Hiroshima Peace Media Center (Takesaki 2020) for the corrected Hiroshima and Nagasaki hypocentres.

## Audio (assets/audio/, all CC0 1.0 Universal)
| File | Use | Title | Author | Source |
|---|---|---|---|---|
| score_persistence_cinameng.mp3 | music bed | Persistence (loop) | cinameng | https://opengameart.org/content/persistence |
| drone_manaos_tozan.mp3 | ambient drone (first 90 s, faded) | Manaos Drones | Tozan | https://opengameart.org/content/manaos-drones |
| ui_blip.mp3 | UI blip | rollover2 (51 UI sound effects) | Kenney (kenney.nl) | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks |
| ui_tick.mp3 | tour step tick | click3 (51 UI sound effects) | Kenney | same pack |
| whoosh.mp3 | fly-to whoosh | swish-9 (swishes sound pack) | artisticdude | https://opengameart.org/content/swishes-sound-pack |
| boom_low.mp3 | reveal boom | lowDown (Digital Sound Effects), pitched down one octave and low-passed | Kenney | https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc |
| data_chatter.mp3 | data-chatter tick under typed text | tone1 (Digital Sound Effects) | Kenney | same pack |

Sound is muted until you interact; master mute, music and effects sliders are in Settings (`,`).

## Fonts (vendor/fonts/, SIL Open Font License 1.1; licence files alongside)
- **Rajdhani** (Indian Type Foundry), display face for titles only.
- **Inter** (Rasmus Andersson), UI text.
- **IBM Plex Mono** (IBM), data and coordinates.

## Icons
**Lucide** (ISC licence; `vendor/icons/LICENSE-Lucide.txt`), inlined as SVG strings in `src/icons.js`.

## Software (vendor/, bundled into js/app.js)
three.js r170 + OrbitControls, EffectComposer, UnrealBloomPass, ShaderPass (MIT) · d3-force/d3-quadtree/d3-dispatch/d3-timer (ISC) · marked (MIT) · build with esbuild (MIT). Dev only: ESLint (MIT), Prettier (MIT), Playwright (Apache-2.0).
