# Data licence

The **code** in this repository is MIT-licensed (see [LICENSE](LICENSE)). The **data** is not ours to relicense: every
dataset keeps the licence its publisher gave it. This file says what that means in practice. Per-dataset details and
attributions: [CREDITS.md](CREDITS.md).

## Compiled case and reference rows (data/cases.js, data/layers/map_*.js, data/sources/qwm/)

Compiled by QWM / 0thernes L.L.C. from the sources cited in each row's `source_url` and `coord_source`. Facts
(names, dates, coordinates) are not copyrightable in most jurisdictions; where a row quotes or summarises a source,
the source keeps its rights. Our compilation (selection, grading, normalisation, coordinate-precision labels) is
offered under **CC BY 4.0**: credit "Global Map / 0thernes L.L.C." and keep the per-row citations.

Exceptions that carry their own terms:

| Data | Licence | What it means |
|---|---|---|
| Rows with `coord_source` from OpenStreetMap Nominatim | ODbL 1.0 | Attribute "© OpenStreetMap contributors"; if you publish a *database* derived from these geocodes, it must be shared under ODbL too. |
| UCDP GED / ACD / BRD (conflicts) | CC BY 4.0 | Attribute UCDP. |
| GeoNames (cities, postal codes, population baseline) | CC BY 4.0 | Attribute GeoNames. |
| GeoNuclearData (reactors) | ODbL 1.0 | Attribute; share-alike for derived databases. |
| HydroLAKES (lakes) | CC BY 4.0 | Attribute Messager et al. 2016. |
| GEBCO 2025 TID (unmapped seafloor) | public domain, attribution requested | Cite GEBCO Compilation Group (2025). |
| GEM Global Active Faults | CC BY-SA 4.0 | Share-alike. |
| Wikidata-derived rows | CC0 | No conditions. |
| Natural Earth, NASA imagery, USGS, DoD MIRTA | public domain | No conditions (credit appreciated). |
| GEIPAN | Licence Ouverte / Etalab 2.0 | Attribute CNES/GEIPAN. |
| SIPRI/FOA nuclear explosions | research report, attribution required | Cite Bergkvist & Ferm (2000). |
| NASA JPL CNEOS fireballs | NASA/JPL-Caltech, use with credit | Credit CNEOS. |
| EOxCloudless 2016 (optional online basemap) | CC BY 4.0 | Not stored in the repo; loaded from EOX on demand. |

## Not included: NUFORC

The NUFORC report extract used by QWM states **no licence**. Its 80,000+ rows are therefore **not** in the repository,
the releases or the GitHub Pages site. The build writes them to the git-ignored `data/private/` so they work on your
own machine only. Options for changing this are logged as a *dilemma* in `docs/audit/SUMMARY.md`.

## Your contributions

By contributing data you confirm you have the right to share it under the terms above and that every value comes
from the cited source (see [CONTRIBUTING.md](CONTRIBUTING.md)).
