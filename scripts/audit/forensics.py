#!/usr/bin/env python3
"""Audit passes 2-6 and 8 (data forensics). Reads the QWM v2 drop (MAP_DIR, full, including private rows for checking
only), the built layers in data/layers, and the v1 build (for 'grades only go up'). Writes:
  docs/audit/qwm-data-issues.csv   one row per finding (private NUFORC rows: id + issue only, no content)
  docs/audit/findings.json         counts per pass and class, plus examples, for the pass-NN.md files
Every finding has exactly one class: bug | error | issue | problem | dilemma | conflict (definitions in TAXONOMY.md).
Nothing in the source data is modified; QWM rows are flagged, never silently regraded or moved.
"""
import csv, gzip, glob, json, math, os, re, random, sys, zipfile, collections, datetime
from shapely.geometry import Point, shape
from shapely.strtree import STRtree
import shapefile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAP_DIR = os.environ.get('QWM_MAP_DIR', '/workspace/qwm/wiw/data/map')
RAW = os.path.join(MAP_DIR, 'raw')
OUT = os.path.join(ROOT, 'docs', 'audit')
TODAY = datetime.date(2026, 11, 12)
PRIVATE = ('NUFORC',)
CASE_LAYERS = ['map_uap_cit', 'map_abductions', 'map_animal_mutilations', 'map_missing_unsolved', 'map_uso_water', 'map_satellite_anomalies']
REF_LAYERS = ['map_offlimits_mountains', 'map_nuclear_sites', 'map_nuclear_tests', 'map_conflicts', 'map_pyramids', 'map_megaliths', 'map_caves_underground', 'map_ancient_cities_remote_sensing', 'map_ocean', 'map_weird_coordinates']
findings = []
counts = collections.defaultdict(collections.Counter)
examples = collections.defaultdict(list)


# found and fixed during the build (code review, build logs, screenshots); see pass-NN.md for detail
MANUAL = [
    (1, 'error', 'EOX imagery', 'licence', 'satellite close-ups used EOX s2cloudless 2023 (CC BY-NC-SA 4.0, non-commercial); switched to the 2016 vintage (CC BY 4.0). FIXED'),
    (1, 'problem', 'nuclear_osm', 'rows', 'OSM nuclear test site layer is empty (Overpass unavailable during the build); layer shows 0 rows. OPEN (staged)'),
    (1, 'problem', 'military', 'OSM', 'OSM military extract not merged (Overpass 502s); bases layer is MIRTA + Wikidata only. OPEN (staged)'),
    (2, 'error', 'military', 'kind', 'Wikidata P279* walk pulled 2,624 non-military items (fire lookout towers, belfries, bird hides, acropolises, churches) into the bases layer; removed by class policy. FIXED'),
    (2, 'issue', 'military', 'kind', '9,149 historic fortifications and 3,688 gendarmerie/police barracks were counted as military bases in the analysis; relabelled and excluded. FIXED'),
    (5, 'bug', 'build_data.py', 'ingest', 'offlimits_mountains.csv ingested twice (notes file and data/sources snapshot): 12 duplicate rows with ~suffix ids. FIXED'),
    (5, 'bug', 'build_data.py', 'grade', "composite grades duplicated by the QWM merge ('Official record / Official record'); collapsed, raw kept in grade_raw. FIXED"),
    (5, 'bug', 'build_data.py', 'same_as/conflicts', 'public rows carried values copied from private NUFORC rows via conflicts/same_as; moved to data/private/private_links.js. FIXED'),
    (6, 'bug', 'forensics.py', 'spot-check', "country spot-check compared only the first word of names: 'Dem. Rep. Congo' vs 'Democratic Republic of the Congo' and territories (American Samoa vs United States) were false conflicts; now uses all Natural Earth name forms and the sovereign. FIXED"),
    (7, 'issue', 'stats_crosscheck.py', 'agree', 'agreement test used only the Python Monte Carlo error; now combines both runs. Conflict pop/time p for all-precision cases differ (pooled vs paired null), borderline. FIXED (test) / NOTED (method)'),
    (8, 'bug', 'forensics.py', 'glossary', "pass-8 regex missed glossary entries whose src is a named constant (src: POLICY). FIXED"),
    (9, 'bug', 'ui_misc.js', 'innerHTML', 'briefing Markdown was only stripped of <script>; now allow-list sanitised (no handlers, styles, iframes, non-http links). FIXED'),
    (9, 'bug', 'app_core.js', 'link()', 'data URLs were linked without a scheme check (javascript: possible from a data file); now http(s)/mailto only. FIXED'),
    (9, 'bug', 'cinema.js', 'imports', 'unused imports (emit, on) failed ESLint. FIXED'),
    (9, 'issue', 'ui_analysis.js', 'performance', 'all-precision analysis (~2.5k cases, time permutation on 114k GED events) takes minutes under software WebGL; run on demand, iterations capped. OPEN'),
    (9, 'issue', 'ui_reports.js', 'performance', 'report generation with 83k local private rows took ~16 s headless; smoke test runs with ?private=0. OPEN'),
    (10, 'bug', 'test/smoke.mjs', 'hooks', 'smoke test opened dossiers from raw rows instead of prepared cases (window.__case added). FIXED'),
    (10, 'bug', 'ui_misc.js', 'captions', 'briefing gallery captions looked up by path, not basename; captions were missing. FIXED'),
    (10, 'issue', 'smoke', 'panels', 'with private rows loaded, slow panels stayed open and blocked later clicks in the headless run. FIXED (test uses ?private=0)'),
]


def F(pas, cls, ds, row, field, value, detail, other='', src=''):
    priv = any(p in (row.get('dataset') or '') for p in PRIVATE)
    findings.append({'pass': pas, 'class': cls, 'dataset': ds, 'id': row.get('id', ''), 'name': '' if priv else row.get('name', ''), 'field': field,
                     'value': '' if priv else str(value)[:200], 'other': '' if priv else str(other)[:200], 'detail': detail, 'source_url': '' if priv else (src or row.get('source_url', '')), 'private_row': 'yes' if priv else ''})
    counts[pas][cls] += 1
    key = (pas, detail.split(':')[0])
    if len(examples[key]) < 4 and not priv:
        examples[key].append({'id': row.get('id'), 'name': row.get('name'), 'value': str(value)[:120], 'other': str(other)[:120]})


NOTES = os.environ.get('QWM_NOTES_DIR', '/workspace/qwm/wiw/notes')
EXTRA = {'map_offlimits_mountains': 'offlimits_mountains.csv'}


def rows_of(stem):
    if stem in EXTRA:
        for q in (os.path.join(NOTES, EXTRA[stem]), os.path.join(ROOT, 'data', 'sources', EXTRA[stem])):
            if os.path.exists(q): return list(csv.DictReader(open(q, encoding='utf-8-sig')))
        return []
    p = os.path.join(MAP_DIR, stem + '.csv')
    if not os.path.exists(p):
        p = os.path.join(ROOT, 'data', 'sources', 'qwm', stem + '.csv.gz')
        if not os.path.exists(p): return []
        return list(csv.DictReader(gzip.open(p, 'rt', encoding='utf-8')))
    return list(csv.DictReader(open(p, encoding='utf-8')))


def fnum(v):
    try:
        x = float(v); return x if math.isfinite(x) else None
    except Exception:
        return None


def decimals(v):
    s = str(v).strip()
    return len(s.split('.')[1].rstrip('0')) if '.' in s else 0


def hav(a, b, c, d):
    R = 6371.0088; p1, p2 = math.radians(a), math.radians(c); dl = math.radians(d - b)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(h)))


# ---------- geometry ----------
def load_admin0():
    sf = shapefile.Reader(os.path.join(RAW, 'ne_10m_admin_0_countries.shp'), encoding='utf-8', encodingErrors='replace')
    flds = [f[0] for f in sf.fields[1:]]
    geoms, meta = [], []
    for sr in sf.iterShapeRecords():
        rec = dict(zip(flds, sr.record))
        g = shape(sr.shape.__geo_interface__)
        if not g.is_valid: g = g.buffer(0)
        geoms.append(g); meta.append({'a2': rec.get('ISO_A2_EH') or rec.get('ISO_A2'), 'a3': rec.get('ADM0_A3'), 'name': rec.get('NAME'), 'aliases': [rec.get(k) for k in ('NAME', 'NAME_LONG', 'ADMIN', 'SOVEREIGNT', 'FORMAL_EN', 'NAME_EN') if rec.get(k)], 'sov_a3': rec.get('SOV_A3'), 'lx': rec.get('LABEL_X'), 'ly': rec.get('LABEL_Y'), 'cx': g.centroid.x, 'cy': g.centroid.y})
    return geoms, meta, STRtree(geoms)


def load_admin1_centroids():
    sf = shapefile.Reader(os.path.join(RAW, 'ne_10m_admin_1_states_provinces.shp'), encoding='utf-8', encodingErrors='replace')
    flds = [f[0] for f in sf.fields[1:]]; out = []
    for sr in sf.iterShapeRecords():
        rec = dict(zip(flds, sr.record))
        try:
            g = shape(sr.shape.__geo_interface__); out.append((g.centroid.y, g.centroid.x, rec.get('name'), rec.get('latitude'), rec.get('longitude')))
        except Exception:
            pass
    return out


def main():
    print('loading geometry…', flush=True)
    geoms, meta, tree = load_admin0()
    land = shape({'type': 'MultiPolygon', 'coordinates': []})
    a1 = load_admin1_centroids()
    a1grid = collections.defaultdict(list)
    for la, lo, nm, lla, llo in a1:
        a1grid[(int(la // 1), int(lo // 1))].append((la, lo, nm))
        if lla is not None and llo is not None:
            try: a1grid[(int(float(lla) // 1), int(float(llo) // 1))].append((float(lla), float(llo), nm + ' (label point)'))
            except Exception: pass

    def country_at(lat, lon):
        p = Point(lon, lat)
        for i in tree.query(p):
            if geoms[i].contains(p): return i
        return None

    def dist_to_country_km(lat, lon, a2):
        p = Point(lon, lat); best = 1e9
        for i, m in enumerate(meta):
            if m['a2'] == a2:
                d = geoms[i].distance(p) * 111.0
                best = min(best, d)
        return best

    all_rows = {}
    for stem in CASE_LAYERS + REF_LAYERS:
        all_rows[stem] = rows_of(stem)
        print(stem, len(all_rows[stem]), flush=True)

    # ===== PASS 2: coordinates =====
    coordkey = collections.defaultdict(list)
    for stem, rows in all_rows.items():
        for r in rows:
            lat, lon = fnum(r.get('lat')), fnum(r.get('lon'))
            prec = r.get('coord_precision', '')
            if (r.get('body') or 'Earth') not in ('', 'Earth'):
                continue
            if lat is None or lon is None:
                F(2, 'problem', stem, r, 'lat/lon', f"{r.get('lat')},{r.get('lon')}", 'missing coordinates: row cannot be plotted'); continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                F(2, 'error', stem, r, 'lat/lon', f'{lat},{lon}', 'coordinates out of range'); continue
            precise = prec in ('exact_site', 'within_1km')
            if precise: coordkey[(round(lat, 4), round(lon, 4))].append((stem, r))
            i = country_at(lat, lon)
            iso = (r.get('country_iso') or '').strip().upper()
            cat = (r.get('category') or '') + ' ' + stem
            if i is None:
                if precise and iso and not re.search(r'ocean|uso|water|sea|weird|satellite', cat, re.I):
                    if dist_to_country_km(lat, lon, iso) > 5:
                        F(2, 'issue', stem, r, 'lat/lon', f'{lat},{lon}', 'ocean/land mismatch: precise point falls in the sea but the row names a country', iso)
            else:
                m = meta[i]
                if iso and len(iso) == 2 and m['a2'] not in (iso, '-99') and iso not in ('XK',):
                    d = dist_to_country_km(lat, lon, iso)
                    if d > 10:
                        F(2, 'conflict', stem, r, 'country_iso', iso, f'country conflict: point lies in {m["name"]} ({m["a2"]}) per Natural Earth 10m, {d:.0f} km from the stated country {iso}' + (' (a territory of the same sovereign)' if any(mm['a2'] == iso and mm.get('sov_a3') == m.get('sov_a3') for mm in meta) else ''), m['a2'])
            if precise:
                for m in ([meta[i]] if i is not None else []):
                    for (cx, cy, lbl) in ((m['cx'], m['cy'], 'polygon centroid'), (m['lx'], m['ly'], 'label point')):
                        if cx is not None and abs(lat - cy) < 0.02 and abs(lon - cx) < 0.02:
                            F(2, 'error', stem, r, 'coord_precision', prec, f'centroid-looking coordinate: within 0.02° of the {m["name"]} {lbl} but marked {prec}', f'{cy:.4f},{cx:.4f}')
                for la, lo, nm in a1grid.get((int(lat // 1), int(lon // 1)), []):
                    if abs(lat - la) < 0.005 and abs(lon - lo) < 0.005:
                        F(2, 'issue', stem, r, 'coord_precision', prec, f'admin-1 centroid-looking coordinate: within 0.005° of {nm} but marked {prec}', f'{la:.4f},{lo:.4f}'); break
                if lat == round(lat) and lon == round(lon):
                    F(2, 'error', stem, r, 'coord_precision', prec, f'round-number coordinate: whole degrees cannot be {prec}', f'{lat},{lon}')
                elif min(decimals(r['lat']), decimals(r['lon'])) <= 1:
                    F(2, 'error', stem, r, 'coord_precision', prec, f'precision mismatch: {min(decimals(r["lat"]), decimals(r["lon"]))} decimal(s) (≥5 km step) marked {prec}', f"{r['lat']},{r['lon']}")
                elif min(decimals(r['lat']), decimals(r['lon'])) == 2 and prec == 'exact_site':
                    F(2, 'issue', stem, r, 'coord_precision', prec, 'precision mismatch: 2 decimals (~1.1 km step) marked exact_site', f"{r['lat']},{r['lon']}")
    for k, lst in coordkey.items():
        names = {(r.get('name') or '').lower() for _, r in lst}
        if len(lst) >= 3 and len(names) >= 3:
            for stem, r in lst:
                F(2, 'issue', stem, r, 'lat/lon', f'{k[0]},{k[1]}', f'repeated coordinate: {len(lst)} differently named precise rows share this point (geocoder default?)', '; '.join(sorted(n for n in names if n)[:4]))

    # ===== PASS 3: dates =====
    def parse_year(s):
        m = re.match(r'^\s*(-?\d{1,6})(?:-(\d{2}))?(?:-(\d{2}))?', s or '')
        return (int(m.group(1)), m.group(2), m.group(3)) if m else None
    for stem, rows in all_rows.items():
        for r in rows:
            d, lo, hi = r.get('date', ''), r.get('date_low', ''), r.get('date_high', '')
            py = parse_year(d)
            if d and not py:
                F(3, 'error', stem, r, 'date', d, 'unparseable date'); continue
            if py:
                y, mo, dd = py
                try:
                    if mo and dd and y > 0 and datetime.date(y, int(mo), int(dd)) > TODAY: F(3, 'error', stem, r, 'date', d, 'future date (after 2026-11-12)')
                    elif mo and dd and y > 0: datetime.date(y, int(mo), int(dd))
                except ValueError:
                    F(3, 'error', stem, r, 'date', d, 'impossible calendar date')
                if y > TODAY.year: F(3, 'error', stem, r, 'date', d, 'future date (after 2026-11-12)')
                if y < 0 and stem in CASE_LAYERS: F(3, 'issue', stem, r, 'date', d, 'BCE date on a case row (check era handling)')
                prec = r.get('date_precision', '')
                if prec == 'day' and not dd: F(3, 'error', stem, r, 'date_precision', prec, 'date_precision says day but the date has no day', d)
                if prec == 'year' and dd: F(3, 'issue', stem, r, 'date_precision', prec, 'date_precision says year but the date carries month/day', d)
            pl, ph = parse_year(lo), parse_year(hi)
            if lo and hi and pl and ph and lo[:10] > hi[:10] and pl[0] >= 0 and ph[0] >= 0:
                F(3, 'error', stem, r, 'date_low/date_high', f'{lo} > {hi}', 'date_low after date_high')
            if d and lo and hi and pl and ph and py and py[0] >= 0 and pl[0] >= 0 and ph[0] >= 0 and not (lo[:len(d)] <= d <= hi[:len(d)] + '~'):
                F(3, 'error', stem, r, 'date', d, 'date outside [date_low, date_high]', f'{lo}..{hi}')
            if stem in CASE_LAYERS and py and py[0] > 1800:
                yrs = {int(x) for x in re.findall(r'\b(1[89]\d\d|20[0-2]\d)\b', (r.get('summary') or '') + ' ' + (r.get('name') or ''))}
                if len(yrs) == 1 and abs(next(iter(yrs)) - py[0]) > 1 and not re.search(r'report|declass|publish|release|interview|investigat|book|film|reopen|hearing|since|until', r.get('summary') or '', re.I):
                    F(3, 'conflict', stem, r, 'date', d, 'summary/date conflict: the only year in the text differs from the date field', next(iter(yrs)))

    # ===== PASS 4: grades =====
    RANK = {'CIT': 5, 'Official record': 4, 'ST': 3, 'TE': 2, 'Online claim (trail only)': 1}
    def gnorm(g):
        g = (g or '').strip()
        for k in RANK:
            if g.lower().startswith(k.lower()[:5]) or g == k: return k
        return g
    v1 = {}
    try:
        z = zipfile.ZipFile('/workspace/globalmap-v1.zip'); t = z.read('globalmap/data/cases.js').decode()
        for c in json.loads(t[t.index('=') + 1:].rstrip().rstrip(';')): v1[c['id']] = c.get('grade', '')
    except Exception as e:
        print('v1 compare unavailable', e)
    BOILER = re.compile(r'\b(debunk\w*|hoax(?:ed)?|misidentif\w+|explained as|prosaic explanation|skeptic\w*|no evidence (?:of|that)|likely (?:venus|a balloon|a satellite|starlink)|mass hysteria)\b', re.I)
    ZERO = re.compile(r'\b(steven\s+greer|dr\.?\s*greer|greer\b|jaime\s+maussan|maussan)\b', re.I)
    known = set(RANK) | {''}
    for stem in CASE_LAYERS:
        for r in all_rows[stem]:
            g = (r.get('grade') or '').strip(); gn = gnorm(g)
            if g and gn not in RANK: F(4, 'issue', stem, r, 'grade', g, 'grade not in the scheme (CIT / Official record / ST / TE / Online claim)')
            if not g: F(4, 'problem', stem, r, 'grade', '', 'ungraded case row')
            st = (r.get('source_type') or '').lower(); txt = ' '.join(r.get(k) or '' for k in ('summary', 'source_title', 'source_url', 'notes', 'witnesses'))
            if gn == 'ST' and re.search(r'archive|official|government|military record|foia|declassified', st):
                F(4, 'issue', stem, r, 'grade', g, 'ST on an archival/official source: rule says ST is for experiencers, Official record for archives', st)
            if gn == 'Official record' and re.search(r'testimony|interview|experiencer|witness account|podcast', st):
                F(4, 'issue', stem, r, 'grade', g, 'Official record on an experiencer source type', st)
            if ZERO.search(txt) and gn in RANK:
                F(4, 'issue', stem, r, 'grade', g, 'Greer/Maussan-linked row: rule is zero weight (the app applies weight 0 in hotspots; grade left as-is for QWM)', ZERO.search(txt).group(0))
            if BOILER.search(r.get('summary') or ''):
                F(4, 'issue', stem, r, 'summary', BOILER.search(r.get('summary') or '').group(0), 'skeptic boilerplate wording in summary (rule: none); not edited')
            if '[verify]' in txt.lower():
                F(4, 'issue', stem, r, 'notes', '[verify]', 'citation needs verification ([verify] tag); shown with a badge in the app')
            if r.get('id') in v1:
                old = gnorm(v1[r['id']])
                if old in RANK and gn in RANK and RANK[gn] < RANK[old]:
                    F(4, 'conflict', stem, r, 'grade', g, f'grade went DOWN between v1 and v2 (rule: grades only go up): {old} -> {gn}', old)
            if re.search(r'hastings|pasulka', txt, re.I) and gn != 'CIT':
                F(4, 'issue', stem, r, 'grade', g, 'Hastings/Pasulka source not graded CIT (rule update: both count as CIT)')

    # ===== PASS 5: dedupe / entity resolution =====
    for stem, rows_ in all_rows.items():
        seen = {}
        for r in rows_:
            if r.get('id') in seen:
                o = seen[r['id']]
                F(5, 'error', stem, r, 'id', r['id'], 'duplicate id within one QWM file (two different rows share it)', f"{o.get('name')} {o.get('date')} / {r.get('name')} {r.get('date')}")
            seen[r.get('id')] = r
        if stem in CASE_LAYERS or stem in EXTRA:
            for r in rows_:
                la, lo = fnum(r.get('lat')), fnum(r.get('lon'))
                pr = (r.get('coord_precision') or '').strip()
                if stem in EXTRA and pr and pr not in ('exact_site', 'within_1km', 'locality', 'region'):
                    F(2, 'issue', stem, r, 'coord_precision', pr, 'coord_precision value is not in the schema; plotted as unspecified (25 km circle)')
                if la is not None and lo is not None and not (r.get('source_url') or '').strip() and (r.get('body') or 'Earth') in ('', 'Earth'):
                    F(1, 'problem', stem, r, 'source_url', '', 'no source_url: row is not plotted (sourced rows only); QWM to add the citation')
    t = open(os.path.join(ROOT, 'data', 'cases.js'), encoding='utf-8').read()
    j = json.loads(t[t.index('=') + 1:].strip().rstrip(';'))
    if isinstance(j, dict):
        keys = j['keys']; rows = []
        for i in range(j['n']):
            o = {}
            for k in keys:
                col = j['col'][k]; v = col[i] if isinstance(col, list) else None
                if k in j.get('dict', {}) and isinstance(v, int): v = j['dict'][k][v]
                o[k] = v
            rows.append(o)
    else:
        rows = j
    groups = 0; conf = collections.Counter()
    for r in rows:
        if r.get('same_as'): groups += 1
        for c in r.get('conflicts') or []:
            conf[c.get('field')] += 1
            F(5, 'conflict', r.get('layer') or r.get('dataset') or 'cases', r, c.get('field'), r.get(c.get('field')), f"cross-dataset conflict on {c.get('field')}: shown with both values and a conflict badge", f"{c.get('other_value')} ({c.get('other_dataset')}, {c.get('other_id')})", c.get('other_source'))
    pass5 = {'linked_rows': groups, 'conflicts_by_field': dict(conf), 'public_rows': len(rows)}

    # anachronism: case near a site that did not exist yet (military inception / reactor construction)
    def layer_items(name):
        p = os.path.join(ROOT, 'data', 'layers', name + '.js')
        if not os.path.exists(p): return []
        s = open(p, encoding='utf-8').read(); return json.loads(s[s.index(',') + 1:s.rindex(')')]).get('items', [])
    sites = []
    for it in layer_items('military'):
        if it.get('inception'): sites.append((it['lat'], it['lon'], it['name'], str(it['inception'])[:10], 'military (Wikidata inception)', it.get('url', '')))
    for it in layer_items('nuclear'):
        s0 = it.get('construction_start') or it.get('operational_from')
        if s0: sites.append((it['lat'], it['lon'], it['name'], s0[:10], 'reactor (construction start)', it.get('url', '')))
    sg = collections.defaultdict(list)
    for s in sites: sg[(int(s[0] // 1), int(s[1] // 1))].append(s)
    for r in rows:
        if r.get('coord_precision') not in ('exact_site', 'within_1km') or not r.get('date'): continue
        la, lo = r.get('lat'), r.get('lon')
        if la is None: continue
        near = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for s in sg.get((int(la // 1) + dx, int(lo // 1) + dy), []):
                    d = hav(la, lo, s[0], s[1])
                    if d <= 5: near.append((d, s))
        if not near: continue
        d, s = min(near)
        if str(r['date'])[:10] < s[3] and re.search(r'base|plant|reactor|silo|facility|airfield|station|range', (r.get('summary') or '') + (r.get('name') or ''), re.I):
            F(5, 'issue', 'cases', r, 'date', r['date'], f'anachronism: tied to a site within {d:.1f} km that did not exist yet ({s[2]}, {s[4]} {s[3]})', s[3], s[5])

    # ===== PASS 6: reference spot-checks =====
    rnd = random.Random(2026)
    spot = {}
    mil = layer_items('military'); nuc = layer_items('map_nuclear_sites') or layer_items('nuclear'); vol = layer_items('volcanoes'); con = all_rows['map_conflicts']
    def chk(name, items, n, fields):
        smp = rnd.sample(items, min(n, len(items))); bad = 0; rows_ = []
        for it in smp:
            la, lo = fnum(it.get('lat')), fnum(it.get('lon')); probs = []
            if la is None or lo is None: probs.append('no coordinates')
            else:
                i = country_at(la, lo); cn = (it.get('country') or '')
                # match against every Natural Earth name form and the sovereign (territories such as American Samoa
                # count as their sovereign); 'Dem. Rep.' style abbreviations are expanded before comparing
                nz = lambda t: re.sub(r'[^a-z]', '', re.sub(r'\bdem\.?\s*rep\.?', 'democratic republic', re.sub(r'^the\s+', '', (t or '').lower())).replace(' of the ', ' of ').replace('of the', 'of'))
                if i is not None and cn and meta[i]['name'] and not any(nz(a) and (nz(a) in nz(cn) or nz(cn) in nz(a)) for a in meta[i].get('aliases', [meta[i]['name']])):
                    probs.append(f"point in {meta[i]['name']}, row says {cn}")
            for f in fields:
                if not it.get(f): probs.append(f'missing {f}')
            if probs: bad += 1
            rows_.append({'name': it.get('name'), 'lat': la, 'lon': lo, 'problems': probs})
        spot[name] = {'n': len(smp), 'flagged': bad, 'rows': rows_}
        for x in rows_:
            for p in x['problems']:
                F(6, 'conflict' if p.startswith('point in') else 'problem', name, {'id': '', 'name': x['name'], 'source_url': ''}, 'spot-check', f"{x['lat']},{x['lon']}", f'spot-check: {p}')
    chk('military', mil, 50, ['url']); chk('nuclear_sites', nuc, 50, ['source_url'] if nuc and 'source_url' in nuc[0] else ['url']); chk('volcanoes', vol, 30, ['url', 'last_eruption'])
    chk('conflicts (QWM)', con, 30, ['source_url', 'date'])
    # nuclear tests: published reference values (yield kt, date, coordinates where fixed by Alex/QWM)
    W = 'https://en.wikipedia.org/wiki/'
    REF = [  # (name in row, reference date (local), yield kt, source, corrected coordinates if any)
        ('TRINITY', '1945-07-16', 21, W + 'Trinity_(nuclear_test)', (33.6772, -106.4753)),
        ('LITTLEBOY', '1945-08-06', 15, W + 'Little_Boy', (34.394594, 132.454797)),
        ('FATMAN', '1945-08-09', 21, W + 'Fat_Man', (32.770167, 129.865667)),
        ('USSR TEST 49001', '1949-08-29', 22, W + 'RDS-1', None),
        ('MIKE', '1952-11-01', 10400, W + 'Ivy_Mike', None),
        ('HURRICANE', '1952-10-03', 25, W + 'Operation_Hurricane', None),
        ('BRAVO', '1954-03-01', 15000, W + 'Castle_Bravo', None),
        ('GERBOISE BLEUE', '1960-02-13', 70, W + 'Gerboise_Bleue', None),
        ('USSR TEST 61053', '1961-10-30', 50000, W + 'Tsar_Bomba', None),
    ]
    nt = all_rows['map_nuclear_tests']; ntcheck = []
    for nm, dt, ykt, src, ll in REF:
        d0 = datetime.date.fromisoformat(dt)
        hits = [r for r in nt if (r.get('name') or '').upper().replace(' ', '') == nm.replace(' ', '') and re.match(r'^\d{4}-\d\d-\d\d', r.get('date') or '') and abs((datetime.date.fromisoformat(r['date'][:10]) - d0).days) <= 1]
        if not hits:
            ntcheck.append({'test': nm, 'date': dt, 'found': False}); F(6, 'problem', 'map_nuclear_tests', {'id': '', 'name': nm}, 'name/date', dt, 'reference test not found by name+date', src=src); continue
        r = hits[0]; y = fnum(r.get('yield_kt')); lo_, hi_ = fnum(r.get('yield_kt_low')), fnum(r.get('yield_kt_high'))
        ok_y = y is not None and (abs(y - ykt) / ykt <= 0.15 or (lo_ is not None and hi_ is not None and lo_ <= ykt <= hi_))
        ok_ll = True if not ll else hav(fnum(r['lat']), fnum(r['lon']), ll[0], ll[1]) < 0.2
        if r['date'][:10] != dt: F(6, 'issue', 'map_nuclear_tests', r, 'date', r['date'], 'date is one day off the local-time date (SIPRI lists GMT); not an error, but captions should say GMT', dt, src)
        ntcheck.append({'row_date': r['date'], 'test': nm, 'date': dt, 'found': True, 'id': r.get('id'), 'yield_row': r.get('yield_kt'), 'yield_ref': ykt, 'yield_ok': ok_y, 'coord_ok': ok_ll, 'src': src})
        if not ok_y: F(6, 'conflict', 'map_nuclear_tests', r, 'yield_kt', r.get('yield_kt'), 'yield differs from the published reference value by >15%', ykt, src)
        if not ok_ll: F(6, 'error', 'map_nuclear_tests', r, 'lat/lon', f"{r['lat']},{r['lon']}", 'coordinates differ from the corrected value', ll, src)
    for r in nt:
        y, lo_, hi_ = fnum(r.get('yield_kt')), fnum(r.get('yield_kt_low')), fnum(r.get('yield_kt_high'))
        if y is not None and lo_ is not None and hi_ is not None and not (lo_ <= y <= hi_): F(6, 'error', 'map_nuclear_tests', r, 'yield_kt', y, 'yield outside its own low/high range', f'{lo_}..{hi_}')
        if re.match(r'^\d+(\.\d+)?-\d+', str(r.get('yield_kt') or '')):
            F(6, 'issue', 'map_nuclear_tests', r, 'yield_kt', r.get('yield_kt'), 'yield is a SIPRI yield-class range, not a value')
    sipri_region = sum(1 for r in nt if r.get('coord_precision') == 'region')
    F(6, 'dilemma', 'map_nuclear_tests', {'id': '', 'name': 'SIPRI DD.MM coordinates'}, 'lat/lon', sipri_region, f'{sipri_region} SIPRI rows are region precision: their DD.MM-style values could be converted to decimal degrees only if verified against SIPRI; not converted (no verifiable copy). Options: keep region (current) / request SIPRI originals / convert with an ERROR-log entry per row')

    # ===== PASS 8: reports / glossary / index claims trace to fields or sources =====
    gl = open(os.path.join(ROOT, 'src', 'glossary.js'), encoding='utf-8').read()
    terms = re.findall(r"term:\s*'([^']+)'", gl); srcs = re.findall(r"src:\s*([^,}]+)", gl)
    p8 = {'glossary_terms': len(terms), 'with_url': sum(1 for s in srcs if "'http" in s), 'with_doc': sum(1 for s in srcs if "'http" not in s)}
    if len(srcs) < len(terms): F(8, 'bug', 'glossary', {'id': '', 'name': 'glossary'}, 'src', len(srcs), 'glossary entry without a source', len(terms))

    # ===== findings from code review and build checks (passes 1, 2, 6, 9, 10), recorded here so the CSV is complete =====
    M = {'id': '', 'name': ''}
    for pas, cls, ds, field, detail in MANUAL:
        F(pas, cls, ds, dict(M, name=ds), field, '', detail)

    # ===== write =====
    os.makedirs(OUT, exist_ok=True)
    flds = ['pass', 'class', 'dataset', 'id', 'name', 'field', 'value', 'other', 'detail', 'source_url', 'private_row']
    with open(os.path.join(OUT, 'qwm-data-issues.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=flds); w.writeheader(); w.writerows(sorted(findings, key=lambda x: (x['pass'], x['class'], x['dataset'], x['id'])))
    by_detail = collections.defaultdict(collections.Counter)
    for x in findings: by_detail[x['pass']][(x['class'], re.sub(r'\d+(\.\d+)?', 'N', x['detail'].split(':')[0]))] += 1
    out = {'counts': {p: dict(c) for p, c in counts.items()}, 'by_detail': {p: [[k[0], k[1], v] for k, v in c.most_common()] for p, c in by_detail.items()},
           'examples': {f'{k[0]}|{k[1]}': v for k, v in examples.items()}, 'rows_checked': {k: len(v) for k, v in all_rows.items()}, 'pass5': pass5, 'pass6': {'spot': {k: {kk: vv for kk, vv in v.items() if kk != 'rows'} for k, v in spot.items()}, 'nuclear_tests': ntcheck}, 'pass8': p8, 'total': len(findings)}
    json.dump(out, open(os.path.join(OUT, 'findings.json'), 'w'), indent=1, default=str)
    print(json.dumps(out['counts'], indent=1), len(findings))


if __name__ == '__main__':
    main()
