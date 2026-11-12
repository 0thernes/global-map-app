# Analysis summary (generated 2026-11-12)

## UAP distance analysis — correlation only

Points: UAP rows with locality-or-better coordinates. Baselines are drawn from the SAME countries in the same proportions: (a) uniform random land points, (b) GeoNames cities ≥15k weighted by population. Military reference = 9,176 Wikidata installations; nuclear = 833 Wikidata sites + test areas; conflict = nearest UCDP event within ±1 calendar year (1989-2024 reports only).

| group                            | target                                              |   n_uap |   median_uap_km |   median_land_km |   median_pop_km |   pct50_uap |   pct50_land |   pct50_pop |   p_vs_land |   p_vs_pop |
|:---------------------------------|:----------------------------------------------------|--------:|----------------:|-----------------:|----------------:|------------:|-------------:|------------:|------------:|-----------:|
| NUFORC (US-dominated, TE)        | nearest military installation (Wikidata reference)  |   20000 |           15.65 |            64.4  |            8.98 |       84.3  |        38.47 |       94.64 |        0    |       0    |
| NUFORC (US-dominated, TE)        | nearest nuclear site (Wikidata + test areas)        |   20000 |           79.82 |           198.5  |           64.94 |       30.26 |         8.45 |       35.07 |        0    |       0    |
| NUFORC (US-dominated, TE)        | nearest UCDP conflict event within ±1 calendar year |   18519 |         1497.43 |          1684.91 |         1352.74 |        1.88 |         0.71 |        3.7  |        0    |       0    |
| GEIPAN (France, Official record) | nearest military installation (Wikidata reference)  |    2423 |           16.53 |            27.61 |            3.3  |       91.75 |        80.31 |       96.95 |        0    |       0    |
| GEIPAN (France, Official record) | nearest nuclear site (Wikidata + test areas)        |    2423 |           58.06 |            78.21 |           33.17 |       41.93 |        26.33 |       61.74 |        0    |       0    |
| GEIPAN (France, Official record) | nearest UCDP conflict event within ±1 calendar year |    1756 |          396.82 |           439.73 |          411.92 |        7.29 |         1.48 |       15.83 |        0    |       0.22 |
| Curated CIT/ST/Official (global) | nearest military installation (Wikidata reference)  |      60 |           17.24 |            79.18 |            9.7  |       75    |        33.33 |       84.75 |        0    |       0.39 |
| Curated CIT/ST/Official (global) | nearest nuclear site (Wikidata + test areas)        |      60 |          129.2  |           215.88 |           66.13 |       28.33 |        13.33 |       40.68 |        0    |       0.13 |
| Curated CIT/ST/Official (global) | nearest UCDP conflict event within ±1 calendar year |      16 |          663.45 |          1802.27 |         1159    |        6.25 |         0    |        6.25 |        0.01 |       0.17 |

**Reading:** UAP reports sit much closer to military/nuclear sites than random land, but *farther* than the population-weighted baseline in every NUFORC/GEIPAN test (e.g. NUFORC median 15.6 km to an installation vs 9.0 km for population-weighted points). That proximity fits people reporting where people live; it is not evidence of a base-attraction effect. The curated CIT/ST/Official set (n=60) is closer to installations than random land and not distinguishable from population (p=0.39). Conflict proximity is negligible for the US/France-dominated data. Biases: Wikidata reference coverage is uneven by country; NUFORC is US/English-centric and ends 2014.

## Nuclear tests by environment

| environment   |   tests |   with_yield |   sum_kt |   median_kt |   max_kt |
|:--------------|--------:|-------------:|---------:|------------:|---------:|
| atmospheric   |     413 |          409 | 388751   |        20   |    50000 |
| space         |       4 |            4 |    602.4 |       150.6 |      300 |
| surface       |     105 |          105 | 105545   |        14   |    15000 |
| underground   |    1527 |         1526 | 167080   |        20   |    10000 |
| underwater    |       8 |            8 |    106.3 |         9.5 |       30 |

## Top conflicts by upper death estimate

|   rank_by_deaths_high | name                            |   deaths_low |   deaths_high |   date |   date_high | subtype   | dataset         |
|----------------------:|:--------------------------------|-------------:|--------------:|-------:|------------:|:----------|:----------------|
|                     1 | World War II                    |      7e+07   |       8.5e+07 |   1939 |        1945 | war       | Wikipedia lists |
|                     2 | Taiping Rebellion               |      2e+07   |       7e+07   |   1850 |        1864 | war       | Wikipedia lists |
|                     3 | Mongol conquests                |      2e+07   |       6e+07   |   1206 |        1368 | war       | Wikipedia lists |
|                     4 | Three Kingdoms                  |      3.4e+07 |       3.4e+07 |    184 |         280 | war       | Wikipedia lists |
|                     5 | Transition from Ming to Qing    |      2.5e+07 |       2.5e+07 |   1618 |        1683 | war       | Wikipedia lists |
|                     6 | World War I                     |      1.5e+07 |       2.2e+07 |   1914 |        1918 | war       | Wikipedia lists |
|                     7 | Timurid conquests and invasions |      7e+06   |       1.7e+07 |   1369 |        1405 | war       | Wikipedia lists |
|                     8 | An Lushan rebellion             |      1.3e+07 |       1.3e+07 |    754 |         763 | war       | Wikipedia lists |
|                     9 | Russian Civil War               |      7e+06   |       1e+07   |   1917 |        1922 | war       | Wikipedia lists |
|                    10 | Chinese Civil War               |      4e+06   |       9e+06   |   1927 |        1949 | war       | Wikipedia lists |

## Pyramids by country (top 15)

| country                    |   disputed |   known |   known (huaca/platform mound) |   known (platform mound) |   suspected/disputed |   total |
|:---------------------------|-----------:|--------:|-------------------------------:|-------------------------:|---------------------:|--------:|
| United States of America   |          0 |       7 |                              0 |                      111 |                    0 |     118 |
| Egypt                      |          0 |      97 |                              0 |                        0 |                    0 |      97 |
| Mexico                     |          0 |      81 |                              0 |                       15 |                    0 |      96 |
| Peru                       |          0 |       4 |                             70 |                        2 |                    0 |      76 |
| Sudan                      |          0 |      20 |                              0 |                        0 |                    0 |      20 |
| France                     |          0 |      18 |                              0 |                        0 |                    0 |      18 |
| Guatemala                  |          0 |      18 |                              0 |                        0 |                    0 |      18 |
| Germany                    |          0 |      16 |                              0 |                        0 |                    0 |      16 |
| People's Republic of China |          0 |      15 |                              0 |                        0 |                    0 |      15 |
| United Kingdom             |          0 |      15 |                              0 |                        0 |                    0 |      15 |
| Belize                     |          0 |       9 |                              0 |                        0 |                    0 |       9 |
| Russia                     |          0 |       8 |                              0 |                        0 |                    0 |       8 |
| Italy                      |          0 |       5 |                              0 |                        0 |                    1 |       6 |
| Iraq                       |          0 |       6 |                              0 |                        0 |                    0 |       6 |
| Argentina                  |          0 |       4 |                              0 |                        1 |                    0 |       5 |

## Coordinate audit 2026-11-12

NUFORC: 589 country/state-centroid rows -> region; 42 shared-fallback-point rows -> region; 0 0,0 rows -> not_plotted
part_uap_geipan.csv: 0 centroid rows downgraded
part_uap_curated.csv: 0 centroid rows downgraded
map_abductions.csv: 0 centroid rows downgraded
map_animal_mutilations.csv: 0 centroid rows downgraded
map_caves_underground.csv: 0 centroid rows downgraded
map_megaliths.csv: 0 centroid rows downgraded
map_missing_unsolved.csv: 0 centroid rows downgraded
map_nuclear_sites.csv: 0 centroid rows downgraded
map_nuclear_tests.csv: 0 centroid rows downgraded
map_ocean.csv: 0 centroid rows downgraded
map_pyramids.csv: 0 centroid rows downgraded
map_weird_coordinates.csv: 0 centroid rows downgraded
Strieber filled: [['41.79812', '-74.2293', 'region']]
nuclear tests: Trinity/Hiroshima/Nagasaki replaced; 2051 SIPRI rows locality->region
military bases: Wikidata copy moved to raw/ref_military_bases_wikidata.csv (analytics reference only); seed layer has 0 rows
Hastings/Pasulka: 1 curated rows raised to CIT: UAP-PDF7-nuclear-cluster

## Change log 2026-11-12 (second batch)
- Added map_uso_water.csv: 22 rows; precision {'region': 20, 'locality': 2}; grades {'Official record': 13, 'CIT': 6, 'ST': 3}.
- Added map_satellite_anomalies.csv: 20 rows (5 off-Earth, not plotted); precision {'region': 11, 'not_plotted': 5, 'locality': 2, 'within_1km': 1, 'exact_site': 1}; grades {'CIT': 11, 'Official record': 5, 'Online claim (ungraded)': 3, 'TE': 1}.
- Both layers carry nearest_military_site_km / nearest_nuclear_site_km (L99). USO median distance to nearest military installation: 58 km (region-level reference points; correlation only, many cases are Navy events by construction).
