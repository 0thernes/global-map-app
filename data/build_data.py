#!/usr/bin/env python3
"""Global Map App - data loader / builder (stdlib only; shapely optional).

Inputs (auto-detected by columns):
  * data/sources/*.csv                      (local curated CSVs)
  * $GM_MAP_DIR or /workspace/qwm/wiw/data/map/*.csv   (QWM layer drops: map_<layer>.csv)
  * extra paths given on the command line
Primary schema (QWM common schema):
  id, name, date, date_precision, date_low, date_high, date_disputed, lat, lon, coord_precision, coord_source,
  continent, country_iso, country, admin1, admin2, locality, postal_code, urban_rural, category, subtype, count,
  summary, source_title, source_url, source_type, dataset, grade, witness_count, nearest_military_site_km,
  nearest_nuclear_site_km, linked_case, notes   (+ any extra columns, passed through)
Minimum to plot: lat, lon, name, source_url (+ date for timeline layers). Rows without them go to data/unplotted_loader.csv.
Dates: ISO, negative years = BCE (astronomical numbering), or a bare year. Undated reference sites are allowed (always visible).
Outputs: data/cases.js (event/case layers), data/layers/map_<layer>.js (reference layers), data/catalog.js (what was ingested),
         data/briefings/ (analysis_summary.md, README.md, PNGs, sources_registry.csv, languages_searched.csv).
Nothing is invented: no geocoding, no jitter, no imputed dates here. Imprecise coords keep their coord_precision and are drawn as circles.
Re-run any time more files land:  python data/build_data.py
"""
import csv, json, os, sys, glob, re, shutil, math, datetime
csv.field_size_limit(1 << 30)
HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sources', 'qwm')  # vendored, gzipped QWM drops
MAP_DIR = os.environ.get('GM_MAP_DIR') or ('/workspace/qwm/wiw/data/map' if os.path.isdir('/workspace/qwm/wiw/data/map') else SNAPSHOT_DIR)
NOTES_DIR = os.environ.get('GM_NOTES_DIR', os.path.join(os.path.dirname(os.path.dirname(MAP_DIR)), 'notes'))
# extra QWM drops that live outside data/map: file -> layer id
EXTRA_FILES = {'offlimits_mountains.csv': 'map_offlimits_mountains'}
LAYERS_DIR = os.path.join(HERE, 'layers'); BRIEF = os.path.join(HERE, 'briefings')
CASE_LAYERS = {'map_uap_cit': 'CIT UFO sighting', 'map_abductions': 'Abduction', 'map_animal_mutilations': 'Animal mutilation', 'map_missing_unsolved': 'Missing person', 'map_human_mutilations': 'Human mutilation', 'map_uso_water': 'USO (water)', 'map_satellite_anomalies': 'Satellite anomaly'}
REF_LAYERS = ['map_nuclear_tests', 'map_weird_coordinates', 'map_pyramids', 'map_megaliths', 'map_caves_underground', 'map_ocean', 'map_ancient_cities_remote_sensing', 'map_conflicts', 'map_nuclear_sites', 'map_military_bases', 'map_offlimits_mountains', 'map_conflict_events_ucdp']
CAT_MAP = {'uso_water': 'USO (water)', 'satellite_anomaly': 'Satellite anomaly', 'uap_case': 'UAP case', 'uap_report': 'UAP report (public database)', 'cit_sighting': 'CIT UFO sighting', 'uap_cit': 'CIT UFO sighting', 'abduction': 'Abduction', 'animal_mutilation': 'Animal mutilation',
           'human_mutilation': 'Human mutilation', 'missing_person': 'Missing person', 'missing_unsolved': 'Missing person', 'missing': 'Missing person', 'nuclear_site_incident': 'Nuclear-site incident',
           'nuclear_incident': 'Nuclear-site incident', 'wartime_sighting': 'Wartime sighting', 'mass_sighting': 'Mass sighting'}
CASE_CATS = set(CASE_LAYERS.values()) | set(CAT_MAP.values()) | {'UAP case', 'Nuclear-site incident', 'Wartime sighting', 'Mass sighting', 'Human mutilation'}
MERGED_ELSEWHERE = {'map_military_bases': 'merged into data/layers/military.js by data/tools/build_military.py', 'map_conflict_events_ucdp': 'same UCDP GED v25.1 events the app aggregates into data/layers/ged.js (data/tools/build_conflicts.py)'}
# rows whose source licence does not allow public redistribution: built into the gitignored data/private/ folder
PRIVATE_DATASETS = {'NUFORC (scrubbed)': 'nuforc'}
PRIVATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'private')
PREC = {'exact_site': 0.1, 'within_1km': 1.0, 'locality': 10.0, 'region': 100.0, 'unspecified': 25.0}
COMMON = 'id,name,date,date_precision,date_low,date_high,date_disputed,lat,lon,coord_precision,coord_source,continent,country_iso,country,admin1,admin2,locality,postal_code,urban_rural,category,subtype,count,summary,source_title,source_url,source_type,dataset,grade,witness_count,nearest_military_site_km,nearest_nuclear_site_km,linked_case,notes'.split(',')

def norm_date(s):
    """-> (iso, precision) ; accepts ISO with negative years, bare years, 'YYYY-MM', '19 Sep 1976'."""
    s = (s or '').strip()
    if not s or '://' in s: return '', ''   # Wikidata 'unknown value' placeholders etc. are not dates
    m = re.match(r'^(\d{3})(?:-|0s|x)$', s)  # decade only, e.g. GEIPAN '198-' / '1980s'
    if m: return '%04d-01-01' % (int(m.group(1)) * 10), 'decade'
    m = re.match(r'^([+-]?\d{1,6})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$', s)
    if m:
        y = int(m.group(1)); mo = int(m.group(2) or 1); d = int(m.group(3) or 1)
        prec = 'day' if m.group(3) else 'month' if m.group(2) else 'year'
        return ('-' if y < 0 else '') + '%04d-%02d-%02d' % (abs(y), mo, d), prec
    for fmt, prec in (('%d %b %Y', 'day'), ('%d %B %Y', 'day'), ('%Y%m%d', 'day'), ('%m/%d/%Y', 'day')):
        try: return datetime.datetime.strptime(s, fmt).strftime('%Y-%m-%d'), prec
        except ValueError: pass
    m = re.search(r'(-?\d{3,4})', s)
    if not m: return '', ''
    y = int(m.group(1))
    return ('-' if y < 0 else '') + '%04d-01-01' % abs(y), 'year'

def country_display(r):
    c = (r.get('country') or '').strip(); iso = (r.get('country_iso') or '').strip(); cont = (r.get('continent') or '').strip()
    env = ' '.join(str(r.get(k) or '') for k in ('environment', 'subtype', 'category')).lower()
    if 'space' in env.split() or c.lower() == 'space' or 'environment=space' in env: return 'Space'
    if cont == 'Antarctica' or c == 'Antarctica': return 'Antarctica'
    if not iso and (c.lower().startswith('ocean') or cont == 'Ocean' or 'international waters' in c.lower()): return 'Ocean/International waters'
    return c

def load_geo():
    try:
        from shapely.geometry import shape, Point
        from shapely.strtree import STRtree
    except ImportError: return None
    raw = os.environ.get('GM_RAW', '/workspace/gm_build')
    try:
        C = json.load(open(os.path.join(raw, 'ne_10m_admin_0_countries.geojson'), encoding='utf-8'))['features']
        U = json.load(open(os.path.join(raw, 'ne_10m_urban_areas.geojson'), encoding='utf-8'))['features']
    except OSError: return None
    cs = [shape(f['geometry']) for f in C]; cp = [f['properties'] for f in C]; ct = STRtree(cs)
    us = [shape(f['geometry']) for f in U]; ut = STRtree(us)
    def look(lon, lat):
        p = Point(lon, lat); hit = None
        for i in ct.query(p):
            if cs[i].contains(p): hit = cp[i]; break
        urban = 'non-urban (outside Natural Earth 10m urban areas)'
        for i in ut.query(p):
            if us[i].contains(p): urban = 'urban (inside Natural Earth 10m urban area)'; break
        return hit, urban
    # water proximity: over ocean (outside NE 10m land) / over a lake (inside NE 10m lakes) and km to the nearest shoreline
    try:
        from shapely.ops import nearest_points
        LND = [shape(f['geometry']) for f in json.load(open(os.path.join(raw, 'ne_10m_land.geojson'), encoding='utf-8'))['features']]
        LK = [shape(f['geometry']) for f in json.load(open(os.path.join(raw, 'ne_10m_lakes.geojson'), encoding='utf-8'))['features']]
        CO = [shape(f['geometry']) for f in json.load(open(os.path.join(raw, 'ne_10m_coastline.geojson'), encoding='utf-8'))['features']]
        lt, kt = STRtree(LND), STRtree(LK); shores = CO + [g.boundary for g in LK]; st = STRtree(shores)
        def water(lon, lat):
            p = Point(lon, lat)
            on_land = any(LND[i].contains(p) for i in lt.query(p))
            over = 'lake' if any(LK[i].contains(p) for i in kt.query(p)) else ('' if on_land else 'ocean')
            g = shores[st.nearest(p)]; q = nearest_points(p, g)[1]
            r = math.radians; x = math.sin(r(q.y - lat) / 2) ** 2 + math.cos(r(lat)) * math.cos(r(q.y)) * math.sin(r(q.x - lon) / 2) ** 2
            return over, round(12742 * math.asin(min(1, math.sqrt(x))), 2)
        look.water = water
    except OSError: pass
    return look

def _open(fn):
    import gzip
    return gzip.open(fn, 'rt', encoding='utf-8-sig', newline='') if fn.endswith('.gz') else open(fn, encoding='utf-8-sig', newline='')

def stem_of(fn):
    b = os.path.basename(fn)
    return b[:-7] if b.endswith('.csv.gz') else os.path.splitext(b)[0]

def read_csv(fn):
    with _open(fn) as f:
        sample = f.read(4096); f.seek(0)
        delim = ';' if sample.count(';') > sample.count(',') else ','
        return list(csv.DictReader(f, delimiter=delim))

def classify(fn, cols):
    stem = stem_of(fn)
    stem = EXTRA_FILES.get(stem + '.csv', stem)
    if stem in CASE_LAYERS: return 'cases', stem
    if stem in REF_LAYERS: return 'ref', stem
    if stem == 'sources_registry': return 'registry', stem
    if stem == 'languages_searched': return 'languages', stem
    if {'lat', 'lon', 'name', 'source_url'} <= set(cols):
        return ('cases', stem) if 'category' in cols else ('ref', stem)
    return 'skip', stem

def encode_cols(rows):
    keys = sorted({k for r in rows for k in r}, key=lambda k: (k != 'id', k))
    t = dict(n=len(rows), keys=keys, dict={}, col={})
    for k in keys:
        vals = [r.get(k) for r in rows]
        uniq = {v for v in vals if v is not None and not isinstance(v, (list, dict))}
        if any(isinstance(v, (list, dict)) for v in vals): t['col'][k] = vals; continue
        if all(isinstance(v, str) for v in uniq) and len(uniq) < max(50, len(rows) // 4):
            d = sorted(uniq); ix = {v: i for i, v in enumerate(d)}
            t['dict'][k] = d; t['col'][k] = [None if v is None else ix[v] for v in vals]
        else: t['col'][k] = vals
    return t

SLIM_KEYS = {'id', 'name', 'date', 'date_precision', 'date_low', 'date_high', 'date_disputed', 'lat', 'lon', 'coord_precision', 'coord_radius_km', 'category', 'subtype', 'grade', 'country', 'country_iso', 'country_display', 'continent', 'admin1', 'locality', 'place', 'source_url', 'linked_case', 'witness_count', 'witnesses', 'decade', 'layer', 'file', 'urban_rural', 'dataset', 'same_as', 'conflicts', 'shore_km', 'over_water', 'verify', 'coord_radius_source'}
CH = 2000

def write_cases(cases, out_js, det_dir, reg_prefix, var, force_slim=False):
    """Small sets: full rows in one file. Large sets: slim columnar rows + full records in lazily loaded chunks."""
    shutil.rmtree(det_dir, ignore_errors=True)
    if not force_slim and len(cases) <= int(os.environ.get('GM_SLIM_OVER', '15000')):
        open(out_js, 'w', encoding='utf-8').write('/* generated by data/build_data.py */\nwindow.%s=' % var + json.dumps(cases, ensure_ascii=False, separators=(',', ':')) + ';\n'); return
    os.makedirs(det_dir, exist_ok=True); slim = []
    for k in range(0, len(cases), CH):
        chunk = [{k2: v for k2, v in c.items() if k2 in ('id', 'summary') or k2 not in SLIM_KEYS} for c in cases[k:k + CH]]
        open(os.path.join(det_dir, '%04d.js' % (k // CH)), 'w', encoding='utf-8').write('GM.reg("%s/%04d",%s);\n' % (reg_prefix, k // CH, json.dumps(chunk, ensure_ascii=False, separators=(',', ':'))))
    for i, c in enumerate(cases):
        r = {k: v for k, v in c.items() if k in SLIM_KEYS}; sm = c.get('summary') or c.get('description') or ''
        if sm: r['summary'] = sm[:100] + ('…' if len(sm) > 100 else '')
        r['_chunk'] = '%s/%04d' % (reg_prefix, i // CH); slim.append(r)
    open(out_js, 'w', encoding='utf-8').write('/* generated by data/build_data.py (columnar; see src/cases_codec.js) */\nwindow.%s_COLS=' % var + json.dumps(encode_cols(slim), ensure_ascii=False, separators=(',', ':')) + ';\n')

CONFLICT_FIELDS = ('date', 'lat', 'lon', 'coord_precision', 'grade', 'category')
def resolve_entities(cases):
    """Entity resolution across layers/datasets. Never picks a winner: links the records (same_as) and lists every field
    whose values disagree (conflicts), each value with its record id and source_url, so the dossier can show both."""
    def nk(x): return re.sub(r'[^a-z0-9]', '', (x or '').lower())
    def hav(a, b, c, d):
        r = math.radians; x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2; return 12742 * math.asin(min(1, math.sqrt(x)))
    src = lambda c: c.get('dataset') or c.get('layer')
    pairs = set()
    by_day = {}
    for i, c in enumerate(cases): by_day.setdefault(c.get('date', '')[:10], []).append(i)
    for day, ix in by_day.items():
        if not day or len(ix) < 2 or len(ix) > 400: continue
        for a in range(len(ix)):
            for b in range(a + 1, len(ix)):
                p, q = cases[ix[a]], cases[ix[b]]
                if src(p) != src(q) and hav(p['lat'], p['lon'], q['lat'], q['lon']) < 50: pairs.add((ix[a], ix[b]))
    curated = [i for i, c in enumerate(cases) if c.get('dataset') not in PRIVATE_DATASETS]
    by_name = {}
    for i in curated:
        k = nk(cases[i].get('name'))
        if len(k) >= 12: by_name.setdefault(k, []).append(i)
    for k, ix in by_name.items():
        for a in range(len(ix)):
            for b in range(a + 1, len(ix)):
                if src(cases[ix[a]]) != src(cases[ix[b]]): pairs.add((ix[a], ix[b]))
    for a, b in pairs:
        p, q = cases[a], cases[b]
        p.setdefault('same_as', []).append(q['id']); q.setdefault('same_as', []).append(p['id'])
        for f in CONFLICT_FIELDS:
            vp, vq = p.get(f), q.get(f)
            if f in ('lat', 'lon'):
                if vp is None or vq is None or abs(float(vp) - float(vq)) < 0.01: continue
            elif str(vp or '') == str(vq or '') or not vp or not vq: continue
            for x, y in ((p, q), (q, p)):
                x.setdefault('conflicts', []).append(dict(field=f, other_id=y['id'], other_value=y.get(f), other_source=y.get('source_url', ''), other_dataset=src(y)))
    return pairs

def nearest_military(rows):
    p = os.path.join(LAYERS_DIR, 'military.js')
    if not os.path.exists(p): return
    t = open(p, encoding='utf-8').read(); mil = json.loads(t[t.index(',') + 1:t.rindex(')')])['items']
    mil = [m for m in mil if not str(m.get('kind', '')).startswith(('fort', 'gendarmerie'))]
    rad = math.radians
    for c in rows:
        best, bm = 1e9, None
        for m in mil:
            x = math.sin(rad(m['lat'] - c['lat']) / 2) ** 2 + math.cos(rad(c['lat'])) * math.cos(rad(m['lat'])) * math.sin(rad(m['lon'] - c['lon']) / 2) ** 2
            d = 12742 * math.asin(min(1, math.sqrt(x)))
            if d < best: best, bm = d, m
        if bm is None: continue
        if c.get('nearest_military_site_km'): c['qwm_nearest_military_site_km'] = c['nearest_military_site_km']
        c['nearest_military_site_km'] = round(best, 1); c['nearest_military_site'] = bm.get('name', '')
        c['nearest_military_site_source'] = bm.get('source_url') or bm.get('src') or 'data/layers/military.js'
        c['nearest_military_site_method'] = 'haversine (R = 6371 km) to the nearest non-fort, non-gendarmerie site in data/layers/military.js'

def main(args):
    files = sorted(f for f in glob.glob(os.path.join(HERE, 'sources', '*.csv')) if os.path.basename(f) not in EXTRA_FILES)
    # QWM drops: only the published layer files (map_*.csv) and the two registries; part_*.csv are QWM's intermediates
    if os.path.isdir(MAP_DIR): files += sorted(f for f in glob.glob(os.path.join(MAP_DIR, '*.csv')) + glob.glob(os.path.join(MAP_DIR, '*.csv.gz')) if stem_of(f).startswith('map_') or stem_of(f) in ('sources_registry', 'languages_searched'))
    # extra files: the live QWM notes copy wins, else the snapshot in data/sources (one copy only, never both)
    for name in EXTRA_FILES:
        p = next((q for q in (os.path.join(NOTES_DIR, name), os.path.join(HERE, 'sources', name)) if os.path.exists(q)), None)
        if p and p not in files: files.append(p)
    for a in args: files += sorted(glob.glob(os.path.join(a, '*.csv'))) if os.path.isdir(a) else [a]
    look = load_geo(); os.makedirs(LAYERS_DIR, exist_ok=True); shutil.rmtree(BRIEF, ignore_errors=True); os.makedirs(BRIEF, exist_ok=True)
    cases, bad, catalog, refs, offworld = [], [], [], {}, []
    seen = set()
    for fn in files:
        try: rows = read_csv(fn)
        except Exception as ex: catalog.append(dict(file=fn, kind='error', error=str(ex))); continue
        cols = list(rows[0].keys()) if rows else []
        kind, stem = classify(fn, cols)
        if stem == 'map_conflict_events_ucdp':
            catalog.append(dict(file=os.path.basename(fn), kind='ref', layer=stem, rows=len(rows), plotted=0, rejected=0, note=MERGED_ELSEWHERE[stem])); continue
        entry = dict(file=os.path.basename(fn), kind=kind, layer=stem, rows=len(rows), plotted=0, rejected=0)
        catalog.append(entry)
        if kind in ('registry', 'languages'):
            shutil.copy(fn, os.path.join(BRIEF, os.path.basename(fn))); entry['plotted'] = len(rows); continue
        if kind == 'skip': continue
        out = []
        for i, r in enumerate(rows):
            r = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k}
            # map legacy local columns onto the common schema
            r.setdefault('summary', r.get('description', '')); r.setdefault('subtype', r.get('subcategory', ''))
            if not r.get('summary'): r['summary'] = r.get('description', '')
            if not r.get('subtype'): r['subtype'] = r.get('subcategory', '')
            reason = []
            body = (r.get('body') or '').strip()
            if body and body.lower() != 'earth':  # off-world target: never plotted on Earth
                offworld.append({k: r.get(k, '') for k in ('id', 'name', 'date', 'body', 'body_lat', 'body_lon', 'grade', 'summary', 'source_url', 'source_title', 'imagery', 'reporter', 'notes')} | dict(layer=stem)); continue
            try:
                lat = float(r.get('lat')); lon = float(r.get('lon')); assert -90 <= lat <= 90 and -180 <= lon <= 180
            except Exception: reason.append('no/invalid lat,lon')
            if not (r.get('source_url') or '').startswith('http'): reason.append('no source_url')
            iso, prec = norm_date(r.get('date'))
            if kind == 'cases' and not iso: reason.append('no parseable date')
            rid = r.get('id') or '%s-%d' % (stem, i + 1)
            if reason:
                bad.append(dict(id=rid, name=r.get('name', ''), file=os.path.basename(fn), reason='; '.join(reason))); entry['rejected'] += 1; continue
            if rid in seen: rid = '%s~%s' % (rid, stem)
            seen.add(rid)
            c = {k: v for k, v in r.items() if v not in (None, '')}
            if c.get('grade'):  # 'X / X' (QWM merge artefact) -> 'X'; distinct halves are kept
                parts = [g.strip() for g in c['grade'].split(' / ')]
                if len(parts) > 1 and len(set(parts)) == 1: c['grade_raw'] = c['grade']; c['grade'] = parts[0]
            c.update(id=rid, lat=round(lat, 6), lon=round(lon, 6), layer=stem, file=os.path.basename(fn))
            if iso:
                c['date'] = iso; c['date_precision'] = r.get('date_precision') or prec
            for k in ('date_low', 'date_high'):
                v = norm_date(r[k])[0] if r.get(k) else ''
                if v: c[k] = v
                else: c.pop(k, None)
            if prec == 'decade' and iso and not c.get('date_low'):
                y0 = int(iso[:4]); c['date_low'] = iso; c['date_high'] = '%04d-12-31' % (y0 + 9)
            pr = (r.get('coord_precision') or '').strip().lower().replace(' ', '_')
            c['coord_precision'] = pr if pr in PREC else 'unspecified'
            try: c['coord_radius_km'] = float(r.get('coord_radius_km') or PREC[c['coord_precision']])
            except ValueError: c['coord_radius_km'] = PREC[c['coord_precision']]
            mr = re.search(r'uncertainty radius ~?\s*([\d.]+)\s*km', r.get('notes') or '')
            if mr and not r.get('coord_radius_km'): c['coord_radius_km'] = float(mr.group(1)); c['coord_radius_source'] = 'notes'
            vf = [k for k in ('name', 'summary', 'notes', 'source_title', 'coord_source') if '[verify' in (r.get(k) or '').lower()]
            if vf: c['verify'] = '; '.join(m.group(0) for k in vf for m in re.finditer(r'[^.;]*\[verify[^\]]*\]', r.get(k) or ''))[:300] or 'citation needs verification'
            c.setdefault('coord_source', 'not stated in source CSV')
            raw = (c.get('category') or '').strip()
            if kind == 'cases' and raw.lower() in CAT_MAP: c['category_raw'] = raw; c['category'] = CAT_MAP[raw.lower()]
            if kind == 'cases' and stem in CASE_LAYERS and c.get('category') not in CASE_CATS:
                if c.get('category'): c['category_raw'] = c['category']
                c['category'] = CASE_LAYERS[stem]
            if kind == 'cases' and not c.get('category'): c['category'] = 'UAP case'
            if iso:
                y = int(iso[:5]) if iso.startswith('-') else int(iso[:4])
                c['decade'] = '%ds' % (y // 10 * 10) if y >= 1000 else ('%d BCE' % (-(y // 1000) * 1000) if y < 0 else '%ds' % (y // 100 * 100))
                c['century'] = '%d00s' % (y // 100) if y >= 0 else '%d BCE (century)' % (-(y // 100) * 100)
            if look and (kind == 'cases' or not c.get('country')):
                hit, urban = look(lon, lat)
                if kind == 'cases' and hasattr(look, 'water'):
                    over, km = look.water(lon, lat); c['shore_km'] = km
                    if over: c['over_water'] = over
                if hit and not c.get('country'): c['country'] = hit['NAME']; c.setdefault('country_iso', hit['ISO_A2_EH']); c.setdefault('continent', hit['CONTINENT'])
                if not hit and not c.get('country'): c['country'] = 'Ocean/International waters'
                c.setdefault('urban_rural', urban)
            c['country_display'] = country_display(c) or c.get('country', '')
            out.append(c)
        entry['plotted'] = len(out)
        if kind == 'cases': cases += out
        elif stem in MERGED_ELSEWHERE: entry['note'] = MERGED_ELSEWHERE[stem]
        else: refs.setdefault(stem, []).extend(out)
    # off-limits mountains: nearest military site from our merged bases layer (MIRTA + Wikidata + OSM + QWM seeds;
    # historic forts excluded, as in the analysis). QWM's nearest_nuclear_site_km is kept as published.
    if refs.get('map_offlimits_mountains'): nearest_military(refs['map_offlimits_mountains'])
    # de-duplicate: local curated rows (data/sources) that QWM now publishes in a map_* case layer are superseded by the QWM row
    def nk(x): return re.sub(r'[^a-z0-9]', '', (x or '').lower())[:18]
    def hav(a, b, c, d):
        r = math.radians; x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2; return 12742 * math.asin(min(1, math.sqrt(x)))
    qwm = [c for c in cases if c['layer'].startswith('map_')]; superseded = []
    if qwm:
        keep = []
        for c in cases:
            if not c['layer'].startswith('map_'):
                hit = next((q for q in qwm if (nk(q['name']) == nk(c['name'])) or (q.get('date', '')[:10] == c.get('date', '')[:10] and hav(q['lat'], q['lon'], c['lat'], c['lon']) < 300)), None)
                if hit:
                    superseded.append(dict(id=c['id'], name=c['name'], file=c['file'], reason='merged into QWM %s row %s (differing fields kept as conflicts on that row)' % (hit['layer'], hit['id']))); hit.setdefault('also_in', c['id'])
                    for f in CONFLICT_FIELDS:
                        if f in ('lat', 'lon'): diff = abs(float(hit[f]) - float(c[f])) >= 0.01
                        else: diff = bool(hit.get(f)) and bool(c.get(f)) and str(hit.get(f)) != str(c.get(f))
                        if diff: hit.setdefault('conflicts', []).append(dict(field=f, other_id=c['id'], other_value=c.get(f), other_source=c.get('source_url', ''), other_dataset='local curated (data/sources/%s)' % c['file']))
                    continue
            keep.append(c)
        cases = keep; bad += superseded
    cases.sort(key=lambda c: (c['date'].startswith('-'), c['date']) if not c['date'].startswith('-') else (False, c['date']))
    def dkey(c):
        d = c.get('date', ''); m = re.match(r'^(-?\d+)-(\d\d)-(\d\d)', d)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else (99999, 0, 0)
    cases.sort(key=dkey)
    resolve_entities(cases)
    pub = [c for c in cases if c.get('dataset') not in PRIVATE_DATASETS]
    priv = [c for c in cases if c.get('dataset') in PRIVATE_DATASETS]
    # public rows must not carry values from private rows: move links/conflicts that point at private records into the
    # private file (merged back by the app only when the private set is present locally)
    priv_ids = {c['id'] for c in priv}; priv_links = {}
    for c in pub:
        sa = [x for x in c.get('same_as') or [] if x in priv_ids]; cf = [x for x in c.get('conflicts') or [] if x.get('other_id') in priv_ids]
        if sa or cf:
            priv_links[c['id']] = dict(same_as=sa, conflicts=cf)
            c['same_as'] = [x for x in c.get('same_as') or [] if x not in priv_ids] or None
            c['conflicts'] = [x for x in c.get('conflicts') or [] if x.get('other_id') not in priv_ids] or None
            for k in ('same_as', 'conflicts'):
                if c[k] is None: del c[k]
    write_cases(pub, os.path.join(HERE, 'cases.js'), os.path.join(HERE, 'case_details'), 'case_details', 'GM_CASES')
    for f in glob.glob(os.path.join(PRIVATE_DIR, '*')):
        if os.path.basename(f) != 'README.md': shutil.rmtree(f, ignore_errors=True) if os.path.isdir(f) else os.remove(f)
    if priv:
        os.makedirs(PRIVATE_DIR, exist_ok=True)
        open(os.path.join(PRIVATE_DIR, 'private_links.js'), 'w', encoding='utf-8').write('window.GM_PRIVATE_LINKS=' + json.dumps(priv_links, ensure_ascii=False, separators=(',', ':')) + ';\n')
        write_cases(priv, os.path.join(PRIVATE_DIR, 'cases_private.js'), os.path.join(PRIVATE_DIR, 'case_details'), 'private/case_details', 'GM_CASES_PRIVATE', force_slim=True)
    print('public cases', len(pub), '| private (gitignored) cases', len(priv))
    for stem, items in refs.items():
        payload = dict(title=stem, source='QWM layer file %s.csv (per-row source_url / dataset)' % stem, type='points', schema='common', items=items)
        open(os.path.join(LAYERS_DIR, stem + '.js'), 'w', encoding='utf-8').write('GM.reg(%s,%s);\n' % (json.dumps(stem), json.dumps(payload, ensure_ascii=False, separators=(',', ':'))))
    # briefings: markdown + PNGs
    brief = dict(md={}, png=[], registry=None, languages=None)
    if os.path.isdir(MAP_DIR):
        for name in ('analysis_summary.md', 'README.md'):
            p = os.path.join(MAP_DIR, name)
            if os.path.exists(p): shutil.copy(p, os.path.join(BRIEF, name)); brief['md'][name] = open(p, encoding='utf-8').read()
        caps = {}
        cp = os.path.join(MAP_DIR, 'png', 'captions.json')
        if os.path.exists(cp): caps = {os.path.basename(k): v for k, v in json.load(open(cp, encoding='utf-8')).items()}
        for p in sorted(glob.glob(os.path.join(MAP_DIR, '*.png')) + glob.glob(os.path.join(MAP_DIR, 'png', '*.png'))):
            shutil.copy(p, os.path.join(BRIEF, os.path.basename(p))); brief['png'].append('data/briefings/' + os.path.basename(p))
        brief['captions'] = {'data/briefings/' + os.path.basename(k): v for k, v in caps.items()}
    for key, name in (('registry', 'sources_registry.csv'), ('languages', 'languages_searched.csv')):
        p = os.path.join(BRIEF, name)
        if os.path.exists(p): brief[key] = read_csv(p)
    expected = {s: any(os.path.exists(os.path.join(MAP_DIR, s + e)) for e in ('.csv', '.csv.gz')) for s in list(CASE_LAYERS) + REF_LAYERS}
    for name, lid in EXTRA_FILES.items(): expected[lid] = any(os.path.exists(os.path.join(d, name)) for d in (NOTES_DIR, os.path.join(HERE, 'sources')))
    with open(os.path.join(HERE, 'catalog.js'), 'w', encoding='utf-8') as f:
        f.write('window.GM_CATALOG=' + json.dumps(dict(built=datetime.datetime.now().isoformat(timespec='seconds'), map_dir=os.path.relpath(MAP_DIR, HERE) if MAP_DIR.startswith(HERE) else MAP_DIR, files=catalog, expected=expected, offworld=offworld, ref_layers=sorted(refs), briefings=brief), ensure_ascii=False) + ';\n')
    with open(os.path.join(HERE, 'unplotted_loader.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, ['id', 'name', 'file', 'reason']); w.writeheader(); [w.writerow(b) for b in bad]
    print('cases', len(cases), '| ref layers', {k: len(v) for k, v in refs.items()}, '| rejected', len(bad))
    for e in catalog: print('  ', e['kind'], e.get('rows'), e.get('plotted'), e.get('rejected'), e['file'])
if __name__ == '__main__': main(sys.argv[1:])
