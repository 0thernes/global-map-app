# Global Map data drop (QWM / wiw)

All coordinates are WGS84 decimal degrees. `coord_precision`: exact_site (published site coordinate), within_1km, locality (town/commune/city geocode), region (country/admin/macro-region proxy, never a site), not_plotted (no verifiable coordinate; lat/lon blank). No jitter, no invented points. Dates ISO; BCE as negative years. Country = 2026 name from Natural Earth reverse lookup.

Grades (Alex rules): CIT = credible on-record insiders (incl. Hastings and Pasulka as of 2026-11-12); ST = experiencers; TE = public filers; Official record = government/archive/peer-reviewed datasets; Online claim (ungraded) = provenance trail only.

## Files

- `map_uap_cit.csv` — UAP sightings: NUFORC 1906-2014 (TE), GEIPAN (Official record), PDF 7 curated + additions (CIT/ST/Official). Extra cols: geipan_class, nuforc_shape, duration_s, date_posted, grade_secondary.
- `map_abductions.csv` — Abduction cases (curated).
- `map_animal_mutilations.csv` — Animal-mutilation cases (curated; FBI Vault, press).
- `map_missing_unsolved.csv` — Missing/unsolved cases (curated).
- `map_nuclear_tests.csv` — 2,057 nuclear tests (SIPRI/FOA 1945-1998 + 6 DPRK from USGS). environment lowercase; yield_kt, yield_kt_low/high. SIPRI coordinates are region-level (see audit).
- `map_weird_coordinates.csv` — Coordinates published in puzzles, codes, sightings and media (Rendlesham binary, Cicada 3301, Kryptos …). Extra cols: coord_text_original, decoding_method, origin venue/date/URL/Wayback, what_is_there, why_weird.
- `map_pyramids.csv` — Pyramids, platform mounds, ziggurats (known / disputed). status column.
- `map_megaliths.csv` — Megaliths: disputed-megalith table + largest monoliths, heaviest stone in tonnes.
- `map_caves_underground.csv` — Caves/underground incl. 8 Egypt subsurface rows.
- `map_ocean.csv` — Ocean/seabed anomalies and sounds.
- `map_ancient_cities_remote_sensing.csv` — Ancient settlements found by LiDAR/satellite/GPR 2011-2024 (team, method, journal).
- `map_conflicts.csv` — Wars (Wikipedia list), genocides (Wikipedia list) and UCDP GED conflicts ≥1,000 deaths; deaths_low/high/best, peak_year, displaced (blank where unsourced), rank_by_deaths_high.
- `map_conflict_events_ucdp.csv` — 385,918 UCDP GED 25.1 events (slim) for heatmaps/distance analysis.
- `map_nuclear_sites.csv` — Nuclear power/research reactors, missile fields, repositories (Wikidata) + 82 test-area medians (region).
- `map_military_bases.csv` — Seed layer for sites NOT in Wikidata or MIRTA (currently 0 rows; columns not_in_wikidata_or_mirta, check_method). The former Wikidata copy is raw/ref_military_bases_wikidata.csv (analytics only).
- `part_uap_*.csv` — build parts of map_uap_cit.
- `counts_by_*.csv, pyramids_by_country.csv, nuclear_yield_by_environment.csv, nuclear_tests_by_state_environment.csv, uap_distance_analysis.csv` — analytics tables
- `sources_registry.csv` — every source: owner, coverage, URL, licence, rows used
- `languages_searched.csv` — languages actually used
- `L*.py, common.py, cur.py, wd.py` — build scripts. Order: L01a,L01b,L01c → L02_04 … L12b → L98_fixes → L01z_combine → L10, L11 → L99_analytics
- `L98_fixes.log` — what the 2026-11-12 audit changed

## PNG figures (png/)

- `png/map_uap_cit.png` — World map of the UAP sightings layer: 82,865 plotted points of 83,194 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_abductions.png` — World map of the Abductions layer: 11 plotted points of 11 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_animal_mutilations.png` — World map of the Animal mutilations layer: 15 plotted points of 15 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_missing_unsolved.png` — World map of the Missing/unsolved layer: 14 plotted points of 14 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_nuclear_tests.png` — World map of the Nuclear tests layer: 2,057 plotted points of 2,057 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_weird_coordinates.png` — World map of the Weird coordinates layer: 38 plotted points of 38 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_pyramids.png` — World map of the Pyramids layer: 580 plotted points of 580 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_megaliths.png` — World map of the Megaliths layer: 50 plotted points of 50 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_caves_underground.png` — World map of the Caves/underground layer: 30 plotted points of 30 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_ocean.png` — World map of the Ocean layer: 16 plotted points of 17 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_ancient_cities_remote_sensing.png` — World map of the Remote-sensing ancient cities layer: 17 plotted points of 18 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_conflicts.png` — World map of the Conflicts layer: 370 plotted points of 409 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_nuclear_sites.png` — World map of the Nuclear sites layer: 833 plotted points of 833 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/ref_military_bases_wikidata.png` — Wikidata military installations used only as the distance-analysis reference (the app already carries Wikidata/MIRTA bases).
- `png/map_combined_overlay.png` — All map layers on one Robinson map; UAP randomly thinned to 15,000 points for legibility (legend counts = full plotted counts).
- `png/heatmap_uap_cit.png` — Log-scaled hexbin density of UAP sightings points (reporting density, not per-capita rate).
- `png/heatmap_nuclear_tests.png` — Log-scaled hexbin density of Nuclear tests points (reporting density, not per-capita rate).
- `png/heatmap_conflict_deaths_ucdp.png` — Sum of UCDP GED best-estimate fatalities per hexagon, 385,918 events 1989-2024.
- `png/timeline_by_year_1900_2026.png` — Rows per year 1900-2026 per layer, log scale. UAP curve reflects NUFORC/GEIPAN coverage (NUFORC extract ends 2014).
- `png/timeline_by_era.png` — Dated rows by era bin per layer, log scale; full table incl. undated in counts_by_era.csv.
- `png/counts_by_country.png` — Left: UAP rows per present-day country (log). Right: all other layers per country. Table: counts_by_country.csv.
- `png/counts_by_grade.png` — Rows by grade (CIT, ST, TE, Official record, Online claim) per layer under Alex's grading rules; table counts_by_grade.csv.
- `png/nuclear_yield_by_environment.png` — Nuclear test yields (upper bound of published range) by environment, SIPRI/FOA 1945-1998 + DPRK 2006-2017.
- `png/uap_distance_vs_baselines.png` — Cumulative distance (log km) from UAP report points (locality or better) to the nearest military installation, nuclear site, and nearest UCDP conflict event within ±1 year (1989-2024 reports), vs country-stratified random-land and population-weighted baselines. Correlation only.

## Added 2026-11-12 (second batch)
- `map_uso_water.csv` — water-related UAP/USO cases (ocean, lakes, seabed, ghost-sub hunts). Region rows state an uncertainty radius in `notes`. `linked_case` uses PDF 7 slugs (shag-harbour-1967, aguadilla-2013, navy-2004-2015, uso-transmedium, baikal-1982, baltic-anomaly-2011, kaikoura-1978, campeche-2004, chile-2014, valentich-1978) and map ids (MIS-…).
- `map_satellite_anomalies.csv` — satellite/aerial-imagery anomalies and discoveries (Google Earth reports, declassified CORONA/HEXAGON/U-2 archaeology, NASA imagery). Extra cols: body, body_lat, body_lon (off-Earth rows are not plotted on the Earth map), imagery, reporter.
- `L13_uso_sat.py` — builds both. `[verify]` marks unconfirmed details.
- `png/map_uso_water.png` — World map of the USO / water UAP layer: 22 plotted points of 22 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
- `png/map_satellite_anomalies.png` — World map of the Satellite-imagery anomalies layer: 15 plotted points of 20 rows; marker = coordinate precision (circle exact/≤1 km, square locality, triangle region).
