#!/usr/bin/env python3
"""Mine PDF 7 ('What Is What of the What') for places and cross-check them against the map.

Inputs
  * QWM source (when present): /workspace/qwm/wiw/main.aux (section numbers and pages), main.tex (labels),
    /workspace/qwm/What-Is-What-of-the-What-glitches.csv (all 381 entries with their citations).
    These are snapshotted into data/sources/pdf7/pdf7_entries.csv so the build is reproducible without QWM.
  * data/sources/pdf7/curation.csv: one reviewed decision per entry that names a place:
      add       new map row (coordinates from Wikidata P625 only; recorded per row)
      link      the place is already on the map: map ids (| separated; '@disputed-megaliths' = rows whose notes
                cite that PDF 7 table; '@layer:<id>' = a whole layer)
      merge:X   same place as entry X (one row, both references)
      unplaced  names a place that cannot be placed honestly (reason in 'note')
    Part V (G12) entries default to the QWM row 'UAP-PDF7-<slug>' when it exists. Everything else is 'no_place'
    (theories, lab results without a named site, off-Earth objects).
Outputs
  * data/sources/pdf7_cases.csv          new case rows (common schema + pdf7_ref), ingested by data/build_data.py
  * data/sources/pdf7/links.csv          map id -> PDF 7 reference(s) (attached to existing rows by the build)
  * docs/audit/pdf7-unplaced.csv         entries with a place that could not be placed, and why
Never invents coordinates: every coordinate is Wikidata P625 of the cited item, fetched live (cached in
data/tools/geocode_cache.json under 'wd:<QID>')."""
import csv, gzip, json, os, re, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); DATA = os.path.dirname(HERE); ROOT = os.path.dirname(DATA)
QWM = os.environ.get('QWM_DIR', '/workspace/qwm')
SNAP = os.path.join(DATA, 'sources', 'pdf7', 'pdf7_entries.csv')
CUR = os.path.join(DATA, 'sources', 'pdf7', 'curation.csv')
CACHE = os.path.join(HERE, 'geocode_cache.json')
UA = {'User-Agent': 'GlobalMapApp/1.1 (personal OSINT research tool; 0_0@0thernes.art)'}
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def entries():
    aux, tex, gl = (os.path.join(QWM, 'wiw', 'main.aux'), os.path.join(QWM, 'wiw', 'main.tex'),
                    os.path.join(QWM, 'What-Is-What-of-the-What-glitches.csv'))
    if not all(map(os.path.exists, (aux, tex, gl))):
        return list(csv.DictReader(open(SNAP, encoding='utf-8')))
    lab = {}
    for m in re.finditer(r'\\newlabel\{([gh]:[^}]+)\}\{\{([^}]*)\}\{(\d+)\}', open(aux, encoding='utf-8').read()):
        lab[m.group(1)] = (m.group(2), m.group(3))
    import pdf7_tex  # section from the label's position in main.tex (aux records the longtable counter for table rows)
    secs = pdf7_tex.label_sections(tex, os.path.join(QWM, 'wiw', 'main.toc'))
    lab = {k: (secs.get(k) or v[0], v[1]) for k, v in lab.items()}
    t = open(tex, encoding='utf-8').read(); p2l = {}
    for m in re.finditer(r'\\label\{(g:[^}]+)\}\\texttt\{\\scriptsize (G[\d.]+)\}', t): p2l[m.group(2)] = m.group(1)
    for m in re.finditer(r'\\label\{(h:[^}]+)\}\\begin\{deep\}\{[^}]*\}\{(G[\d.]+)~~', t): p2l[m.group(2)] = m.group(1)
    out = []
    for r in csv.DictReader(open(gl, encoding='utf-8')):
        l = p2l.get(r['path_id'], ''); sec, page = lab.get(l, ('', ''))
        out.append(dict(path=r['path_id'], label=l, section=sec, page=page, domain=r['domain'], name=r['name'],
                        year=r['year'], citation=r['source'], grade=r['evidence_grade'], summary=r['observed_or_claim'][:400]))
    with open(SNAP, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, list(out[0]), lineterminator='\n'); w.writeheader(); w.writerows(out)
    return out

def wd(qid):
    k = 'wd:' + qid
    if k not in cache:
        u = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(dict(action='wbgetentities', ids=qid, props='claims|labels', languages='en', format='json'))
        e = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))['entities'][qid]
        c = e.get('claims', {}).get('P625'); v = c[0]['mainsnak'].get('datavalue', {}).get('value') if c else None
        cache[k] = dict(label=e.get('labels', {}).get('en', {}).get('value', ''), lat=v and v['latitude'], lon=v and v['longitude'])
        json.dump(cache, open(CACHE, 'w'), indent=1, ensure_ascii=False); time.sleep(0.3)
    return cache[k]

def ref(e):
    s = 'PDF 7 §%s' % e['section'] if e['section'] else 'PDF 7'
    return s + (' (p. %s)' % e['page'] if e['page'] else '') + ' · ' + e['path']

def map_rows():
    rows = []
    for fn in sorted(os.listdir(os.path.join(DATA, 'sources', 'qwm'))):
        if fn.startswith('map_'):
            with gzip.open(os.path.join(DATA, 'sources', 'qwm', fn), 'rt', encoding='utf-8') as f:
                rows += [dict(id=r.get('id', ''), notes=' '.join(v or '' for v in r.values() if isinstance(v, str)), layer=fn[:-7]) for r in csv.DictReader(f)]
    for fn in ('offlimits_mountains.csv',):
        rows += [dict(id=r.get('id', ''), notes='', layer='map_offlimits_mountains') for r in csv.DictReader(open(os.path.join(DATA, 'sources', fn), encoding='utf-8'))]
    return rows

def main():
    E = entries(); by = {e['path']: e for e in E}
    cur = {r['path']: {k: (v or '').replace('; ', ', ').replace(';', ',') if k in ('name', 'note') else (v or '') for k, v in r.items()} for r in csv.DictReader(open(CUR, encoding='utf-8'))}
    M = map_rows(); ids = {r['id'] for r in M}
    links, cases, unplaced, status = {}, [], [], {}
    def link(mid, e):
        links.setdefault(mid, []).append(ref(e))
    for e in E:
        p = e['path']; c = cur.get(p); slug = e['label'][2:] if e['label'].startswith('h:') else ''
        default = 'UAP-PDF7-' + slug if slug and 'UAP-PDF7-' + slug in ids else ''
        act = c['action'] if c else ('link' if default else 'no_place')
        st = dict(action=act.split(':')[0], ids=[])
        if default and act in ('link', 'no_place'): st['ids'].append(default); link(default, e); st['action'] = 'link'
        if c and act == 'link':
            for mid in filter(None, c['map_ids'].split('|')):
                if mid == '@disputed-megaliths': hit = [r['id'] for r in M if 'disputed-megaliths' in r['notes']]
                elif mid.startswith('@layer:'): hit = [mid]
                elif mid.endswith('*'): hit = [r['id'] for r in M if r['id'].startswith(mid[:-1])]
                else: hit = [mid] if mid in ids else []
                if not hit: sys.exit('curation: %s map id %s not found' % (p, mid))
                for h in hit: st['ids'].append(h); link(h, e)
        elif c and act == 'add':
            g = wd(c['place_qid'])
            if g['lat'] is None: sys.exit('curation: %s place %s has no P625' % (p, c['place_qid']))
            topic = c['topic_qid'] or c['place_qid']
            refs = [ref(e)] + [ref(by[q]) for q, x in cur.items() if x['action'] == 'merge:' + p]
            rid = 'PDF7-' + p
            cases.append(dict(id=rid, name=c['name'], date=c['date'] or e['year'], lat=round(g['lat'], 6), lon=round(g['lon'], 6),
                coord_precision=c['precision'], coord_source='Wikidata %s (%s) P625, read %s' % (c['place_qid'], g['label'], time.strftime('%Y-%m-%d')),
                category=c.get('category') or 'PDF 7 place', subtype=e['domain'], grade=e['grade'] or 'cited', summary=e['summary'],
                source_title='PDF 7 citation: ' + e['citation'], source_url=c.get('source_url') or 'https://www.wikidata.org/wiki/' + topic,
                source_type='source cited in PDF 7; coordinate via Wikidata' if c.get('source_url') else 'literature citation in PDF 7; topic and coordinate via Wikidata', dataset='PDF 7 (What Is What of the What)',
                pdf7_ref=' | '.join(refs), notes=c['note']))
            st['ids'].append(rid)
            for mid in filter(None, c['map_ids'].split('|')): st['ids'].append(mid); link(mid, e)
        elif c and act.startswith('merge:'):
            st['ids'].append('PDF7-' + act.split(':')[1])
        elif c and act == 'unplaced':
            unplaced.append(dict(path=p, section=e['section'], page=e['page'], name=e['name'], citation=e['citation'], reason=c['note']))
        status[p] = st
    os.makedirs(os.path.join(ROOT, 'docs', 'audit'), exist_ok=True)
    def write(fn, rows, cols):
        with open(fn, 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, cols, lineterminator='\n'); w.writeheader(); w.writerows(rows)
    write(os.path.join(DATA, 'sources', 'pdf7_cases.csv'), cases, list(cases[0]))
    write(os.path.join(DATA, 'sources', 'pdf7', 'links.csv'), [dict(map_id=k, pdf7_ref=' | '.join(dict.fromkeys(v))) for k, v in sorted(links.items())], ['map_id', 'pdf7_ref'])
    write(os.path.join(ROOT, 'docs', 'audit', 'pdf7-unplaced.csv'), unplaced, ['path', 'section', 'page', 'name', 'citation', 'reason'])
    write(os.path.join(DATA, 'sources', 'pdf7', 'status.csv'), [dict(path=p, action=s['action'], map_ids='|'.join(dict.fromkeys(s['ids'])), reason=(cur.get(p) or {}).get('note', '') if s['action'] == 'unplaced' else '') for p, s in status.items()], ['path', 'action', 'map_ids', 'reason'])
    from collections import Counter
    print('entries', len(E), dict(Counter(s['action'] for s in status.values())), 'new rows', len(cases), 'linked map ids', len(links), 'unplaced', len(unplaced))

if __name__ == '__main__':
    main()
