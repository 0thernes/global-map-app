#!/usr/bin/env python3
"""Build the non-spatial PDF 7 data layer (data/pdf7_data.js) and its snapshot (data/sources/pdf7/snap/).

Every record keeps a pointer back to the PDF: section number and page from main.aux / main.toc, or the source
file and row for CSV-derived aggregates. Nothing here is geocoded and nothing is drawn on the globe; placement
status is copied from data/sources/pdf7/status.csv (written by pdf7_mine.py).

With /workspace/qwm present the snapshot is refreshed from the live files; without it the committed snapshot
is used, so the build is reproducible from the repo alone. Usage: python3 data/tools/pdf7_dataset.py"""
import csv, gzip, json, os, re, sys, time
from urllib.parse import urlparse
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import pdf7_tex as P
QWM = os.environ.get('QWM_DIR', '/workspace/qwm'); WIW = os.path.join(QWM, 'wiw')
SNAP = os.path.join(DATA, 'sources', 'pdf7', 'snap'); OUT = os.path.join(DATA, 'pdf7_data.js')
CSVS = {'theories': 'What-Is-What-of-the-What-entries.csv', 'glitches': 'What-Is-What-of-the-What-glitches.csv',
        'uapnhi': 'What-Is-What-of-the-What-UAP-NHI.csv', 'cit': 'What-Is-What-of-the-What-CIT-sources.csv'}
AGG = ['counts_by_country', 'counts_by_era', 'counts_by_grade', 'nuclear_tests_by_state_environment',
       'nuclear_yield_by_environment', 'pyramids_by_country', 'uap_distance_analysis']
# kind is derived from the PDF 7 domain only (documented in docs/adr/0002-non-spatial-data-layer.md)
KIND = {'Cosmology anomalies': 'off-Earth observation', 'Space and signals': 'off-Earth observation',
        'Particle and quantum anomalies': 'lab result', 'Biology and origin of life': 'lab result',
        'Mind and neuroscience': 'lab result', 'Engineering and technology': 'lab result',
        'Math and logic': 'formal result', 'Psychology and parapsychology claims': 'claim',
        'History and archaeology': 'claim', 'Theology and philosophy': 'claim',
        'FRINGE (clearly marked; not endorsed)': 'claim', 'REAL EVENTS: Extreme Mass High Strangeness': 'case'}
SRC_TYPES = [  # first match wins; host suffix or substring
    ('government / military', r'(^gov\.[a-z]{2}$|\.gov(\.[a-z]{2})?$|\.mil$|\.gc\.ca$|\.gouv\.fr$|\.gov\.uk$|parliament|congress\.gov|nasa\.gov|europa\.eu|\.int$|\bcnes\b)'),
    ('archive / FOIA', r'(archive\.org|theblackvault|nationalarchives|archives\.gov|foia|documentcloud)'),
    ('academic / journal', r'(doi\.org|arxiv\.org|nature\.com|science\.org|springer|wiley|sciencedirect|jstor|aps\.org|iop\.org|\.edu$|\.ac\.[a-z]{2}$|pubmed|ncbi|researchgate|scientificamerican|aanda|oup\.com|cambridge\.org)'),
    ('encyclopedia', r'(wikipedia\.org|wikidata\.org|britannica)'),
    ('news / press', r'(nytimes|washingtonpost|bbc\.|cnn\.|reuters|apnews|theguardian|politico|nbcnews|cbsnews|abcnews|foxnews|newsweek|time\.com|independent\.co|telegraph|latimes|wsj\.com|thehill|npr\.org|vice\.com|wired|theatlantic|usatoday|nypost|smithsonianmag|twz\.com|upi\.com|indiatoday|miamiherald|elpais|nzherald|arstechnica|laist|c5n|mysterywire|cbc\.ca|abc\.net|lemonde|spiegel|guardian|times|post|dailymail|axios|bloomberg|news)'),
    ('video / social / podcast', r'(twimg|youtube|youtu\.be|x\.com|twitter|facebook|instagram|tiktok|reddit|podcast|spotify|rumble|substack|medium\.com)'),
    ('fact-check', r'(snopes|politifact|factcheck|correctiv|maldita|leadstories|fullfact)'),
    ('research org / NGO', r'(nicap|ncas|mufon|cufos|sol-foundation|thesolfoundation|scu|uapcheck|enigma|skeptic|csicop|aaro)'),
]

def src_type(url):
    h = (urlparse(url).hostname or '').lower().removeprefix('www.')
    for name, rx in SRC_TYPES:
        if re.search(rx, h): return name, h
    return 'other web', h

def num(x):
    try: return float(x) if x not in ('', None) else None
    except ValueError: return None

def snapshot():
    os.makedirs(SNAP, exist_ok=True)
    live = os.path.exists(os.path.join(WIW, 'main.tex'))
    if not live:
        print('QWM not found; using committed snapshot', file=sys.stderr); return
    import shutil
    for k, f in CSVS.items(): shutil.copy(os.path.join(QWM, f), os.path.join(SNAP, k + '.csv'))
    for a in AGG: shutil.copy(os.path.join(WIW, 'data', 'map', a + '.csv'), os.path.join(SNAP, a + '.csv'))
    sec, toc = P.load_aux(os.path.join(WIW, 'main.aux'))
    pos = P.label_sections(os.path.join(WIW, 'main.tex'), os.path.join(WIW, 'main.toc'))
    sec = {k: (pos.get(k) or v[0], v[1], v[2]) for k, v in sec.items()}  # aux section is the longtable counter for table rows
    with open(os.path.join(SNAP, 'labels.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n'); w.writerow(['label', 'section', 'page'])
        for k, (s, p, _) in sorted(sec.items()):
            if re.match(r'[tghc]:|sec:|p4:', k): w.writerow([k, s, p])
    tex = open(os.path.join(WIW, 'main.tex'), encoding='utf-8').read()
    toc_by_title = {}
    for m in re.finditer(r'\\contentsline \{(part|section|subsection)\}\{(?:\\numberline \{([\d.]+)\})?(.*?)\}\{(\d+)\}\{', open(os.path.join(WIW, 'main.toc'), encoding='utf-8').read()):
        toc_by_title.setdefault(P.tex2txt(m.group(3)), (m.group(2) or '', int(m.group(4)), m.group(1)))
    with open(os.path.join(SNAP, 'sections.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n'); w.writerow(['kind', 'num', 'title', 'page'])
        for t, (n, p, k) in toc_by_title.items(): w.writerow([k, n, t, p])
    pdf = P.PdfPages(os.path.join(WIW, 'main.pdf'))
    tables, figures, ti, fi = [], [], 0, 0
    for kind, d in P.walk(os.path.join(WIW, 'main.tex')):
        sn, sp, _ = toc_by_title.get(d['subsection'], toc_by_title.get(d['section'], ('', 0, '')))
        if not sp: sn, sp, _ = toc_by_title.get(d['section'], ('', 0, ''))
        secnum = toc_by_title.get(d['section'], ('', 0, ''))[0]
        if kind == 'table':
            ti += 1; page, basis = None, 'section start page (main.toc)'
            # body cells first: header rows repeat across longtables ('Path, name, tier') and would hit an earlier table
            body, head = d['rows'][1:4], d['rows'][:1]
            cands = [c for rr in (body, head) for r in rr for c in r if len(c) >= 12] + [c for r in d['rows'][:3] for c in r if 6 <= len(c) < 12]
            for c in cands:
                words = c.split()
                for n in (6, 4, 3):
                    needle = ' '.join(words[:n])
                    if len(needle) >= 8:
                        page = pdf.find(needle, max(1, sp) if sp else 1, span=60 if sp else pdf.n)
                        if page: break
                if page: basis = 'located in PDF text layer'; break
            figures_or = page or sp or None
            tables.append(dict(id='T%03d' % ti, env=d['env'], part=d['part'], sec=secnum, section=d['section'],
                               subsection=d['subsection'], case=d['case'], line=d['line'], page=figures_or,
                               page_basis=basis, caption=d['caption'], rows=d['rows']))
        else:
            fi += 1
            page = pdf.find(' '.join(d['caption'].split()[:6]), max(1, sp) if sp else 1, span=60 if sp else pdf.n)
            figures.append(dict(id='F%02d' % fi, file=d['file'], caption=d['caption'], part=d['part'], sec=secnum,
                                section=d['section'], subsection=d['subsection'], case=d['case'], line=d['line'],
                                page=page or sp or None, page_basis='located in PDF text layer' if page else 'section start page (main.toc)'))
    with open(os.path.join(SNAP, 'tables.json.gz'), 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0) as gz:  # mtime=0: byte-stable
        gz.write(json.dumps(tables, ensure_ascii=False).encode('utf-8'))
    with open(os.path.join(SNAP, 'figures.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, list(figures[0]), lineterminator='\n'); w.writeheader(); w.writerows(figures)
    # Part V document links per case file (\url / \href inside each deep block)
    docs = []
    for m in re.finditer(r'\\begin\{deep\}\{[^}]*\}\{(G12[\d.]+)~~(.*?)\\end\{deep\}', tex, re.S):
        for u in re.findall(r'\\(?:url|href)\{([^}]+)\}', m.group(2)):
            if u.startswith('http'): docs.append((m.group(1), u))
    with open(os.path.join(SNAP, 'case_docs.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n'); w.writerow(['path', 'url']); w.writerows(docs)
    # CIT register membership: \label{c:slug}\textbf{Name}
    with open(os.path.join(SNAP, 'cit_register.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator='\n'); w.writerow(['label', 'name'])
        for m in re.finditer(r'\\label\{(c:[^}]+)\}\\textbf\{([^}]*)\}', tex): w.writerow([m.group(1), P.tex2txt(m.group(2))])
    # path -> label for Part I (t:) entries
    with open(os.path.join(SNAP, 'path_labels.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n'); w.writerow(['path', 'label'])
        for m in re.finditer(r'\\label\{(t:[^}]+)\}\\texttt\{\\scriptsize ([\d.]+)\}', tex): w.writerow([m.group(2), m.group(1)])
        for m in re.finditer(r'\\label\{(t:[^}]+)\}\\begin\{deep\}\{[^}]*\}\{([\d.]+)~~', tex): w.writerow([m.group(2), m.group(1)])

def rd(name): return list(csv.DictReader(open(os.path.join(SNAP, name), encoding='utf-8')))

def build():
    lab = {r['label']: (r['section'], int(r['page'])) for r in rd('labels.csv')}
    plab = {r['path']: r['label'] for r in rd('path_labels.csv')}
    ent7 = {r['path']: r for r in csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'pdf7_entries.csv'), encoding='utf-8'))}
    status = {r['path']: r for r in csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'status.csv'), encoding='utf-8'))}
    entries = []
    for r in rd('theories.csv'):
        s, p = lab.get(plab.get(r['path_id'], ''), ('', None))
        entries.append(dict(id=r['path_id'], part='I', kind='theory', domain=r['domain'], category=r['category'], name=r['name'],
                            year=int(r['year']) if r['year'].lstrip('-').isdigit() else None, grade=r['tier'], tier=r['tier'],
                            testable=r['testable'], deep=r['deep_profile'].strip().lower() in ('yes', 'true', '1', 'y'), composite=num(r['composite']), band=r['possibility_band'], radical=num(r['radicalness']),
                            src=r['origin_source'][:160], sec=s, page=p, place='theory (not a place)', map=[]))
    for r in rd('glitches.csv'):
        e = ent7.get(r['path_id'], {}); st = status.get(r['path_id'], {})
        g12 = r['path_id'].startswith('G12')
        entries.append(dict(id=r['path_id'], part='V' if g12 else 'II', kind=KIND.get(r['domain'], 'claim'), domain=r['domain'],
                            category=r['category'], name=r['name'], year=int(r['year']) if r['year'].lstrip('-').isdigit() else None,
                            grade=r['evidence_grade'], grade_ev=r['prior_grade_evidence_only'], fringe=r['fringe'] == 'yes' or r['domain'].startswith('FRINGE'),
                            reality=num(r['reality_0_5']), score=num(r['glitch_score']), radical=num(r['radicalness']),
                            tw=num(r['testimony_weight']), cit=int(num(r['testimony_cit']) or 0), stn=int(num(r['testimony_st']) or 0),
                            corr=num(r['corroboration']), src=r['source'][:160], sec=e.get('section', ''), page=int(e['page']) if e.get('page') else None,
                            place=st.get('action', ''), map=[m for m in st.get('map_ids', '').split(';') if m], reason=st.get('reason', '')))
    reg = {r['name'].strip().lower(): r['label'] for r in rd('cit_register.csv')}
    cit = []
    for r in rd('cit.csv'):
        l = reg.get(r['name'].strip().lower(), ''); s, p = lab.get(l, ('', None))
        cit.append(dict(name=r['name'], tier=r['tier'], weight=num(r['testimony_weight']), stance=r['stance'], credential=r['credential'][:120],
                        affiliation=r['affiliation'][:120], linked=r['linked_entries'][:200], flag=r['flag'], in_register=bool(l), sec=s, page=p))
    tax = [dict(taxonomy=r['taxonomy'], path=r['path'], name=r['name'], source_class=r['source_class'], grade=r['grade'][:120]) for r in rd('uapnhi.csv')]
    docs = []
    for r in rd('case_docs.csv'):
        t, h = src_type(r['url']); docs.append(dict(path=r['path'], host=h, type=t, url=r['url']))
    tables = json.load(gzip.open(os.path.join(SNAP, 'tables.json.gz'), 'rt', encoding='utf-8'))
    for a in AGG:
        rows = list(csv.reader(open(os.path.join(SNAP, a + '.csv'), encoding='utf-8')))
        tables.append(dict(id='Q-' + a, env='csv', part='QWM data (wiw/data/map)', sec='', section=a + '.csv', subsection='', case='',
                           line=None, page=None, page_basis='source file ' + a + '.csv (rows as published)', caption=a.replace('_', ' '), rows=rows))
    figures = rd('figures.csv')
    for f in figures: f['page'] = int(f['page']) if f['page'] else None
    sections = [dict(kind=r['kind'], num=r['num'], title=r['title'], page=int(r['page'])) for r in rd('sections.csv')]
    unplaced = list(csv.DictReader(open(os.path.join(os.path.dirname(DATA), 'docs', 'audit', 'pdf7-unplaced.csv'), encoding='utf-8')))
    out = dict(built=time.strftime('%Y-%m-%dT%H:%M:%S'), pdf=dict(file='What-Is-What-of-the-What.pdf', pages=257),
               sections=sections, entries=entries, cit=cit, taxonomy=tax, docs=docs, tables=tables, figures=figures, unplaced=unplaced)
    s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    open(OUT, 'w', encoding='utf-8').write('window.GM_PDF7_DATA=' + s + ';\n')
    print('pdf7_data.js', len(s) // 1024, 'KiB;', len(entries), 'entries,', len(tables), 'tables,', len(figures), 'figures,', len(docs), 'doc links,', len(cit), 'CIT rows')

if __name__ == '__main__':
    snapshot(); build()
