#!/bin/sh
# Re-ingest QWM layer drops and rebuild the generated data/*.js files. Safe to run any time.
#   GM_MAP_DIR  QWM drop folder (default: /workspace/qwm/wiw/data/map if present, else data/sources/qwm snapshot)
#   GM_RAW      raw downloads for the military merge (default /workspace/gm_build; step is skipped if missing)
#   PYTHON      interpreter (default python3; needs shapely for the country lookup)
cd "$(dirname "$0")" || exit 1
PY=${PYTHON:-python3}
RAW=${GM_RAW:-/workspace/gm_build}
if [ -d "$RAW" ]; then
  $PY tools/build_military.py "$RAW"   # MIRTA + Wikidata + OSM chunks + QWM map_military_bases seeds (dedupe)
else
  echo "skip military merge: $RAW not found (data/layers/military.js kept as committed)"
fi
$PY build_data.py "$@"                # cases.js, case_details/, layers/map_*.js, catalog.js, briefings/
rm -f layers/map_military_bases.js
