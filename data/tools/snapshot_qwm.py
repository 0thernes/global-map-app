"""Copy the QWM layer drops into data/sources/qwm/*.csv.gz (the public, reproducible input snapshot).
Rows from datasets without a redistribution licence (see PRIVATE_DATASETS in data/build_data.py) are left out;
map_conflict_events_ucdp.csv is left out because it is the same UCDP GED v25.1 the app builds from upstream."""
import csv, glob, gzip, io, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build_data import PRIVATE_DATASETS
SRC = os.environ.get('GM_MAP_DIR', '/workspace/qwm/wiw/data/map')
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sources', 'qwm')
SKIP = {'map_conflict_events_ucdp.csv'}
shutil.rmtree(DST, ignore_errors=True); os.makedirs(DST)
for fn in sorted(glob.glob(os.path.join(SRC, 'map_*.csv'))) + [os.path.join(SRC, n) for n in ('sources_registry.csv', 'languages_searched.csv')]:
    b = os.path.basename(fn)
    if b in SKIP or not os.path.exists(fn): continue
    with open(fn, encoding='utf-8-sig', newline='') as f: rows = list(csv.DictReader(f)); cols = rows[0].keys() if rows else open(fn).readline().strip().split(',')
    keep = [r for r in rows if r.get('dataset') not in PRIVATE_DATASETS]
    buf = io.StringIO(); w = csv.DictWriter(buf, list(cols), lineterminator='\n'); w.writeheader(); w.writerows(keep)
    with gzip.GzipFile(os.path.join(DST, b + '.gz'), 'wb', mtime=0) as g: g.write(buf.getvalue().encode('utf-8'))
    print(b, len(rows), '->', len(keep))
