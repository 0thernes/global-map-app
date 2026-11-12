#!/usr/bin/env python3
"""v1.2 data gap audit: inventory every table, figure, statistic, list and dataset in PDF 7 and under /workspace/qwm,
and say whether the app carries it (present / partial / missing) before v1.2 (v1.1.0) and after (built artifacts).

Each gap (partial or missing in v1.1) carries exactly one label:
  bug      app code drops or mishandles data it already loads
  error    a value in the app is wrong
  issue    the data exists in a usable form but the app does not surface it
  problem  structural obstacle: the item is not a place (non-spatial) and the app had nowhere to put it
  dilemma  judgment call: out of scope, licence/privacy, editorial or raw material
  conflict two sources disagree (count in the PDF text vs the CSV, two versions of a file)
The 'after' columns are computed from data/pdf7_data.js, data/unplaced.js and src/ui_data.js, never asserted by hand.
Usage: python3 data/tools/gap_audit.py  -> docs/audit/v1.2-data-gap-audit.{csv,md}"""
import csv, json, os, re, sys, collections, filecmp, glob
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.dirname(HERE); ROOT = os.path.dirname(DATA)
QWM = os.environ.get('QWM_DIR', '/workspace/qwm'); WIW = os.path.join(QWM, 'wiw'); MAP = os.path.join(WIW, 'data', 'map')
OUT = os.path.join(ROOT, 'docs', 'audit')

def js(path, var):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p): return None
    s = open(p, encoding='utf-8').read(); return json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))

D = js('data/pdf7_data.js', 'GM_PDF7_DATA') or {}
UNPL = js('data/unplaced.js', 'GM_UNPLACED') or {}
CAT = js('data/catalog.js', 'GM_CATALOG')
UI = open(os.path.join(ROOT, 'src', 'ui_data.js'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'src', 'ui_data.js')) else ''
TABLE_IDS = {t['id'] for t in D.get('tables', [])}
ENTRY_IDS = {e['id'] for e in D.get('entries', [])}
catalog = {f['file']: f for f in CAT['files']}
status7 = {r['path']: r for r in csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'status.csv'), encoding='utf-8'))}
tables = json.load(__import__('gzip').open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'tables.json.gz'), 'rt', encoding='utf-8'))
figures = list(csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'figures.csv'), encoding='utf-8')))
theories = list(csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'theories.csv'), encoding='utf-8')))
glitches = list(csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'glitches.csv'), encoding='utf-8')))
citrows = list(csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'cit.csv'), encoding='utf-8')))
citreg = list(csv.DictReader(open(os.path.join(DATA, 'sources', 'pdf7', 'snap', 'cit_register.csv'), encoding='utf-8')))
items = []

def ui(marker): return bool(UI) and marker in UI

def add(id, kind, where, title, size, st, where11, label, finding, after):
    assert (st == 'present') == (label == ''), (id, st, label)
    assert label in ('', 'bug', 'error', 'issue', 'problem', 'dilemma', 'conflict'), label
    a_st, a_where = after() if after else ('', '')
    items.append(dict(id=id, kind=kind, location=where, title=title[:140], size=size, v1_1_status=st, v1_1_where=where11,
                      label=label, finding=finding, v1_2_status=a_st or st, v1_2_where=a_where or where11))

def t_after(tid, note='Data panel > PDF 7 tables (sortable)'):
    return lambda: ('present', note) if tid in TABLE_IDS and ui('data-tables') else ('', '')

def pg(t): return '§%s p.%s' % (t['sec'] or '?', t['page'] or '?')

# ---- 1. PDF 7 tables ---------------------------------------------------------------------------------------------
placed_paths = {p for p, r in status7.items() if r['action'] in ('add', 'link', 'merge') or r['action'].startswith('merge')}
for t in tables:
    tid, title = t['id'], (t['caption'] or t['subsection'] or t['section'])
    head = ' | '.join(t['rows'][0][:4])[:80] if t['rows'] else ''
    title = '%s: %s [%s]' % (t['section'][:50], title[:70], head) if title != t['section'] else '%s [%s]' % (title[:80], head)
    n = '%d rows' % max(0, len(t['rows']) - 1)
    part, sec, case, line = t['part'], t['section'], t['case'], t['line']
    if case:
        if case in placed_paths:
            st, w, lab, f = 'partial', 'case dossier (summary + §ref) for the mapped case', 'issue', 'per-case evidence table not reproduced; the dossier only links to the PDF page'
        else:
            st, w, lab, f = 'missing', '-', 'problem', 'case has no single place, so v1.1 had no view for its tables'
    elif part.startswith('Part I ') or part.startswith('Part I:') or (part.startswith('Part I') and 'II' not in part and 'III' not in part and 'IV' not in part):
        st, w, lab, f = 'missing', '-', 'problem', 'Part I theories are not places; v1.1 had no non-spatial layer'
    elif part.startswith('Part II') and re.match(r'G\d+ ', t['section']):
        st, w, lab, f = 'partial', 'Index > PDF 7 index (path, name, §, page, placement)', 'issue', 'grade, reality, glitch score, radicalness, claim and explanation columns not shown; no table view'
    elif 'taxonomy' in t['section'].lower() and part.startswith('Part II'):
        st, w, lab, f = 'missing', '-', 'issue', 'UAP/NHI taxonomy CSV exists but was not loaded'
    elif part.startswith('Part II') or part.startswith('Part III') or part.startswith('Part IV'):
        st, w, lab, f = 'missing', '-', 'problem', 'synthesis/ranking table; non-spatial, no view in v1.1'
    elif tid == 'T001':
        st, w, lab, f = 'missing', '-', 'issue', 'headline counts not shown anywhere in the app'
    elif 'Part V' in part:
        cap = (t['caption'] + ' ' + t['subsection']).lower()
        if 'off-limits mountains: restrict' in cap or 'literally named' in cap or 'nuclear-weapons storage' in cap:
            st, w, lab, f = 'present', 'globe layer Off-limits mountains', '', ''
            if 'restrict' in cap: st, lab, f = 'partial', 'issue', '13 rows of offlimits_mountains.csv lack a source_url and are not shown'
        elif 'remote-sensing' in cap:
            st, w, lab, f = 'partial', 'globe layer Remote-sensing ancient cities', 'bug', "the region-scale row (Amazonia, no single point) is dropped from every view, not just the globe"
        elif 'megaliths ranked' in cap:
            st, w, lab, f = 'partial', 'globe layer Megaliths (sites only)', 'issue', 'ranking by heaviest stone not shown'
        elif 'by country' in cap and 'nuclear' in cap:
            st, w, lab, f = 'partial', 'G12.10 member sites on globe', 'issue', 'country counts table not shown'
        elif t['section'].startswith('REAL EVENTS') and t['rows'] and t['rows'][0][:2] == ['Path', 'Case']:
            st, w, lab, f = 'partial', 'Index > PDF 7 index lists G12 paths', 'issue', 'status and two-layer grade columns not shown'
        elif 'part v taxonomy' in cap:
            st, w, lab, f = 'missing', '-', 'issue', 'group sizes not shown'
        elif 'checked, not added' in cap:
            st, w, lab, f = 'missing', '-', 'issue', 'negative results (rejected candidates) not shown'
        elif 'dyatlov' in cap:
            st, w, lab, f = 'missing', '-', 'problem', 'feature matrix across cases; non-spatial'
        else:
            st, w, lab, f = 'missing', '-', 'issue', 'register/list exists in PDF 7 but not in the app'
    elif 'CIT' in t['section']:
        st, w, lab, f = 'missing', '-', 'issue', 'testimony source register not loaded'
    elif 'Corrections' in t['section']:
        st, w, lab, f = 'missing', '-', 'issue', 'seed corrections not shown'
    else:
        st, w, lab, f = 'missing', '-', 'issue', 'not in the app'
    add(tid, 'table', 'PDF 7 ' + pg(t) + ' (main.tex line %s)' % line, title, n, st, w, lab, f, t_after(tid) if st != 'present' else None)

# ---- 2. PDF 7 figures --------------------------------------------------------------------------------------------
FIG = {  # file stem -> (v1.1 status, where, label, finding, ui marker that reproduces it in v1.2 or None)
    'docmap': ('missing', 'dilemma', 'diagram of how the PDFs relate; editorial, no data', None),
    'tax_full': ('missing', 'problem', 'taxonomy tree of non-spatial entries', 'fig-tax'), 'sunburst_th': ('missing', 'problem', 'hierarchy of non-spatial entries', 'fig-tax'),
    'tier_bars': ('missing', 'problem', 'entries per domain by tier', 'fig-tier-bars'), 'tier_heat': ('missing', 'problem', 'tier x domain counts', 'fig-tier-heat'),
    'timeline_th': ('missing', 'problem', 'time series of idea origin years', 'fig-timeline'), 'network': ('missing', 'problem', 'relation graph; edge list not exported to any CSV', None),
    'testability': ('missing', 'problem', 'testability x tier matrix', 'fig-testability'),
    'gtax_full': ('missing', 'problem', 'Part II taxonomy tree', 'fig-tax'), 'sunburst_gl': ('missing', 'problem', 'Part II hierarchy', 'fig-tax'),
    'grade_bars': ('missing', 'issue', 'glitches per domain by grade; grades exist in the CSV', 'fig-grade-bars'), 'glitch_grade_heat': ('missing', 'issue', 'grade x domain counts', 'fig-grade-bars'),
    'timeline_gl': ('missing', 'issue', 'first-report years; years exist in the CSV', 'fig-timeline'),
    'uap_tree': ('missing', 'issue', 'UAP taxonomy; CSV exists', 'fig-taxonomy'), 'nhi_tree': ('missing', 'issue', 'NHI taxonomy; CSV exists', 'fig-taxonomy'),
    'scores': ('missing', 'problem', 'composite score distribution (Part I)', 'fig-scores'), 'possibility': ('missing', 'problem', 'possibility map: score vs radicalness', 'fig-possibility'),
    'compat_matrix': ('missing', 'problem', 'compatibility matrix; values only in generator code, not a CSV', None), 'compat_network': ('missing', 'problem', 'compatibility network; no CSV', None),
    'programs': ('missing', 'dilemma', 'editorial placement (author judgement axes)', None), 'toe_stack': ('missing', 'dilemma', 'editorial diagram', None),
    'toe_weigh': ('missing', 'problem', 'prior vs weighted index; numbers in tables T034/T035', 'data-tables'),
    'p4_matrix': ('missing', 'problem', '100-outcome matrix; numbers in Part IV tables', 'data-tables'), 'p4_possibility': ('missing', 'problem', 'paradigm index plot; numbers in table T038', 'data-tables'),
    'hs_timeline': ('missing', 'issue', 'Part V case timeline; years in glitches CSV (G12 rows)', 'fig-timeline'),
    'hs_banner': ('missing', 'dilemma', 'third-party image (X CDN); provenance only, licence unclear', None),
    'hs_offlimits_map': ('present', '', '', None), 'hs_offlimits_matrix': ('missing', 'issue', 'restriction x strangeness counts; columns exist in offlimits_mountains.csv', 'fig-offlimits'),
    'hs_witness': ('missing', 'issue', 'witness counts per case; only in hs.py CASES and map rows', None),
    'hs_grades': ('missing', 'issue', 'Part V cases by group and grade', 'fig-hs-grades'),
    'hs_nuclear_map': ('partial', 'issue', 'member sites mapped; figure-specific grouping not', None),
    'hs_megaliths': ('partial', 'issue', 'megalith sites mapped; heaviest-stone ranking not', 'data-tables'),
    'hs_map': ('missing', 'dilemma', 'editorial axes (public-record depth vs strangeness)', None),
    'cit_sources': ('missing', 'issue', 'testimony sources by affiliation and tier; CSV exists', 'fig-cit'),
}
for f in figures:
    stem = os.path.splitext(os.path.basename(f['file']))[0]
    if stem.startswith('sub_') or stem.startswith('gsub_'):
        st, lab, fnd, mk = 'missing', 'problem', 'subtree of non-spatial entries', 'fig-tax'
    else:
        st, lab, fnd, mk = FIG[stem]
    w = 'globe layer Off-limits mountains' if stem == 'hs_offlimits_map' else ('globe layers' if st == 'partial' else '-')
    after = (lambda mk=mk: ('present' if mk and ui(mk) else '', 'Data panel (%s)' % mk if mk and ui(mk) else '')) if st != 'present' else None
    add(f['id'], 'figure', 'PDF 7 §%s p.%s (%s)' % (f['sec'] or '?', f['page'] or '?', f['file']), f['caption'], '', st, w, lab, fnd, after)

# ---- 3. statistics stated in PDF 7 text, checked against the CSVs -----------------------------------------------
def stat(id, where, title, stated, actual, why=''):
    ok = str(stated) == str(actual)
    st = 'missing'; lab = 'issue' if ok else 'conflict'
    fnd = ('PDF states %s; CSV gives %s. ' % (stated, actual)) + (why if not ok else 'Matches; not shown in v1.1.')
    after = lambda: ('present' if ui('data-overview') and D else '', 'Data panel > Overview (stated vs computed)' if ui('data-overview') else '')
    add(id, 'statistic', where, title, str(stated), st, '-', lab, fnd, after)
t1 = next(t for t in tables if t['id'] == 'T001'); hc = {r[0]: r[1:] for r in t1['rows']}
pI = len(theories); pII = sum(1 for r in glitches if not r['path_id'].startswith('G12')); pV = sum(1 for r in glitches if r['path_id'].startswith('G12'))
deep = sum(1 for r in theories if r['deep_profile'].strip().lower() in ('yes', 'true', '1', 'y'))
stat('S01', 'PDF 7 §front p.%s T001' % t1['page'], 'Part I entries', hc['Entries'][0], pI)
stat('S02', 'PDF 7 §front T001', 'Part II entries (G1-G11)', hc['Entries'][1], pII)
stat('S03', 'PDF 7 §front T001', 'Part I deep profiles', hc['Deep profiles'][0], deep)
stat('S04', 'PDF 7 §front T001', 'Part I domains', hc['Domains'][0], len({r['domain'] for r in theories}))
stat('S05', 'PDF 7 §front T001', 'Part II domains (G1-G11)', hc['Domains'][1], len({r['domain'] for r in glitches if not r['path_id'].startswith('G12')}))
cit_n = collections.Counter(r['tier'] for r in citrows)
stat('S06', 'PDF 7 §front T001', 'CIT / ST testimony sources', hc['CIT / ST testimony sources'][1], '%d / %d' % (cit_n['CIT'], cit_n['ST']),
     'The register in the PDF appendix (§50) has %d labelled entries; the CIT-sources CSV has %d rows, so the CSV is newer or broader than the printed register.' % (len(citreg), len(citrows)))
stat('S07', 'PDF 7 §front T001', 'FRINGE-marked Part I (tier)', hc['FRINGE-marked'][0].split()[0], sum(1 for r in theories if r['tier'] == 'Fringe'))
stat('S08', 'PDF 7 §front T001', 'FRINGE domain G11 entries', hc['FRINGE-marked'][1].split()[0], sum(1 for r in glitches if r['path_id'].startswith('G11.')))
stat('S09', 'PDF 7 §front T001', 'Part V case files (G12)', hc['Part V high-strangeness case files (G12)'][1].split()[0], pV)
dom_order = list(dict.fromkeys(r['domain'] for r in theories))
for f in figures:
    m = re.match(r'Subtree for domain (\d+) \((\d+) entries\)', f['caption'])
    if m:
        k = int(m.group(1)); dn = dom_order[k - 1] if k <= len(dom_order) else '?'
        stat('S-%s' % f['id'], 'PDF 7 §%s p.%s %s caption' % (f['sec'], f['page'], f['id']), 'Part I domain %d (%s) entry count' % (k, dn), m.group(2), sum(1 for r in theories if r['domain'] == dn))
    m = re.match(r'Subtree for (G\d+) \((\d+) glitches\)', f['caption'])
    if m:
        stat('S-%s' % f['id'], 'PDF 7 §%s p.%s %s caption' % (f['sec'], f['page'], f['id']), '%s glitch count' % m.group(1), m.group(2), sum(1 for r in glitches if r['path_id'].startswith(m.group(1) + '.')))
tx = next(t for t in tables if t['rows'] and t['rows'][0][:3] == ['Path', 'Group', 'Case files'])
for r in tx['rows'][1:]:
    if re.match(r'G12\.\d+$', r[0]) and r[2].isdigit():
        n = sum(1 for g in glitches if g['path_id'].startswith(r[0] + '.'))
        stat('S-%s' % r[0], 'PDF 7 %s %s' % (pg(tx), tx['id']), 'Part V group %s (%s) case files' % (r[0], r[1][:40]), r[2], n)

# date basis: PDF 7 'year' (first report / publication) vs the event date on the mapped row
CASES = js('data/cases.js', 'GM_CASES') or []
if isinstance(CASES, dict): CASES = []
byid = {c.get('id'): c for c in CASES if isinstance(c, dict)}
for e in D.get('entries', []):
    for mid in e.get('map', []):
        c = byid.get(mid)
        if not c or not c.get('date') or e.get('year') is None: continue
        y = int(c['date'][:4])
        if abs(y - e['year']) > 1:
            add('S-date-' + e['id'], 'statistic', 'PDF 7 §%s p.%s vs map row %s' % (e['sec'], e['page'], mid), '%s: year %s in PDF 7, date %s on the map' % (e['name'][:60], e['year'], c['date']),
                '', 'partial', 'globe (map date) and PDF 7 index (no year)', 'conflict',
                'PDF 7 year is the first report or publication; the map row carries the event date. Both are sourced; neither is changed.',
                lambda: ('present', 'Data panel > Entries shows PDF year and map date side by side') if ui('data-datebasis') else ('', ''))

# ---- 4. lists in PDF 7 --------------------------------------------------------------------------------------------
add('L01', 'list', 'PDF 7 back matter (glossary, main.tex ~line 2496)', 'PDF 7 glossary', '', 'partial', 'Index > Glossary (app glossary, own wording)', 'issue',
    "app glossary is the app's own; PDF 7 glossary terms not cross-checked", None)
add('L02', 'list', 'PDF 7 back matter (index, main.tex ~line 2618)', 'PDF 7 A-Z index (path + page per name/alias)', '%d entries' % (pI + pII + pV), 'partial',
    'Index > PDF 7 index (paths, no aliases)', 'issue', 'aliases and Part I names not searchable',
    lambda: ('present', 'Data panel > Entries (search name/alias, all 660 entries with §/page)') if ui('data-entries') and len(ENTRY_IDS) == pI + pII + pV else ('', ''))
add('L03', 'list', 'PDF 7 Part V document links (\\url in case files)', 'Source documents cited in G12 case files', '%d links' % len(D.get('docs', [])), 'missing', '-', 'issue',
    'source-type breakdown impossible without this list', lambda: ('present', 'Data panel > Sources (types by host rule)') if ui('data-sources') else ('', ''))
add('L04', 'list', 'docs/audit/pdf7-unplaced.csv + data/unplotted_loader.csv', 'Unplaced but sourced items (PDF 7 entries and QWM rows without one point)', '', 'partial',
    'CSV files only (not in the app)', 'bug', 'rows without coordinates were dropped from every view, including analytics, instead of only from the globe',
    lambda: ('present', 'Data panel > Unplaced (%d rows)' % len(UNPL.get('rows', []))) if ui('data-unplaced') and UNPL else ('', ''))

# ---- 5. datasets and notes files under /workspace/qwm ----------------------------------------------------------
def rows_of(p):
    try:
        if p.endswith('.json'): d = json.load(open(p, encoding='utf-8', errors='replace')); return '%d items' % len(d)
        with open(p, encoding='utf-8', errors='replace') as f: return '%d lines' % sum(1 for _ in f)
    except Exception: return ''
FILES = {  # relative path -> (status, where, label, finding, after-check)
    'What-Is-What-of-the-What-entries.csv': ('missing', '-', 'problem', 'Part I theories (279); non-spatial', lambda: ENTRY_IDS >= {r['path_id'] for r in theories}),
    'What-Is-What-theories.csv': ('missing', '-', 'problem', 'byte-identical copy of What-Is-What-of-the-What-entries.csv', lambda: ENTRY_IDS >= {r['path_id'] for r in theories}),
    'What-Is-What-of-the-What-glitches.csv': ('partial', 'data/sources/pdf7/pdf7_entries.csv (path, name, grade, citation, summary) + PDF 7 index', 'issue', 'scores, reality, testimony counts, corroboration and fringe flag dropped', lambda: ENTRY_IDS >= {r['path_id'] for r in glitches}),
    'What-Is-What-glitches.csv': ('partial', 'as What-Is-What-of-the-What-glitches.csv', 'issue', 'byte-identical copy of What-Is-What-of-the-What-glitches.csv', lambda: ENTRY_IDS >= {r['path_id'] for r in glitches}),
    'What-Is-What-of-the-What-UAP-NHI.csv': ('missing', '-', 'issue', 'UAP/NHI/HS taxonomy (169 rows) not loaded', lambda: len(D.get('taxonomy', [])) == 169),
    'What-Is-What-of-the-What-CIT-sources.csv': ('missing', '-', 'conflict', '144 rows vs 115 labelled entries in the printed register (§50); not loaded', lambda: len(D.get('cit', [])) == 144),
    'catalog-capabilities.json': ('missing', '-', 'dilemma', 'belongs to the separate AI-capability catalog PDF, not PDF 7; out of scope', None),
    'catalog-dedup.json': ('missing', '-', 'dilemma', 'AI catalog (other PDF); out of scope', None), 'catalog-sensors.json': ('missing', '-', 'dilemma', 'AI catalog (other PDF); out of scope', None),
    'omni-harness-catalog.csv': ('missing', '-', 'dilemma', 'AI catalog (other PDF); out of scope', None), 'omni-harness-catalog.md': ('missing', '-', 'dilemma', 'AI catalog (other PDF); out of scope', None),
    'gn_secret.csv': ('partial', 'via literal_secret_names.csv (curated subset)', 'dilemma', "raw GeoNames hits for 'secret' names; publishing uncurated hits would add unreviewed pins", None),
    'gnis_secret.csv': ('partial', 'via literal_secret_names.csv (curated subset)', 'dilemma', 'raw GNIS hits; same judgement as gn_secret.csv', None),
    'literal_secret_names.csv': ('present', 'globe layer Off-limits mountains (literal names)', '', '', None),
    'offlimits_mountains.csv': ('partial', 'globe layer Off-limits mountains', 'issue', '13 rows without source_url are not shown', lambda: any(r['file'] == 'offlimits_mountains.csv' for r in UNPL.get('unsourced', []))),
    'inputs/alex-thought-experiments-seed-2026-11-11.md': ('missing', '-', 'dilemma', 'personal seed notes; their corrections are PDF 7 table T164', lambda: 'T164' in TABLE_IDS),
    'r5base/toe.txt': ('missing', '-', 'issue', 'ToE weighting numbers behind T034/T035', lambda: {'T034', 'T035'} <= TABLE_IDS),
    'wiw/data/geipan_cas.csv': ('partial', 'GEIPAN rows inside map_uap_cit (case layer)', 'issue', 'raw GEIPAN export; rows without a commune point were not visible', lambda: any(r.get('dataset', '').upper().startswith('GEIPAN') for r in UNPL.get('rows', []))),
    'wiw/data/geipan_D_geo.json': ('present', 'GEIPAN class-D rows in map_uap_cit', '', '', None),
    'wiw/data/nuclear_explosions.csv': ('present', 'globe layer Nuclear tests (map_nuclear_tests)', '', '', None),
    'wiw/hs_candidates.csv': ('present', 'data/sources/qwm_uap_cases.csv (geocoded; unplaceable rows in data/unplotted.csv)', '', '', None),
    'wiw/hs_candidates.md': ('present', 'same rows as hs_candidates.csv', '', '', None),
    'wiw/notes/COORD_from_second_executor.md': ('present', 'coordinates applied in data/tools/geocode_qwm.py', '', '', None),
    'wiw/notes/research_hs3.md': ('partial', 'facts carried into PDF 7 Part V', 'dilemma', 'prose research notes; the app cites the PDF, not the notes', None),
    'wiw/notes/research_offlimits_mountains.md': ('partial', 'facts carried into offlimits_mountains.csv', 'dilemma', 'prose notes behind the off-limits layer', None),
    'wiw/notes/literal_secret_names.csv': ('present', 'byte-identical to /workspace/qwm/literal_secret_names.csv', '', '', None),
    'wiw/notes/offlimits_mountains.csv': ('partial', 'byte-identical to /workspace/qwm/offlimits_mountains.csv (the copy the build reads)', 'issue', '13 rows without source_url are not shown', lambda: any(r['file'] == 'offlimits_mountains.csv' for r in UNPL.get('unsourced', []))),
    'wiw/data/map/README.md': ('present', 'Reports > briefings', '', '', None), 'wiw/data/map/analysis_summary.md': ('present', 'Reports > briefings', '', '', None),
    'wiw/data/map/png/captions.json': ('present', 'Reports > briefings captions', '', '', None),
    'wiw/data/map/languages_searched.csv': ('present', 'Reports > briefings', '', '', None), 'wiw/data/map/sources_registry.csv': ('present', 'Index > Sources', '', '', None),
    'wiw/data/map/part_uap_curated.csv': ('present', 'merged into map_uap_cit by QWM', '', '', None),
    'wiw/data/map/part_uap_geipan.csv': ('present', 'merged into map_uap_cit by QWM', '', '', None),
    'wiw/data/map/part_uap_nuforc.csv': ('partial', 'private build only (data/private, gitignored)', 'dilemma', 'NUFORC rows must not be published; only counts may appear', None),
    'wiw/data/map/map_military_bases.csv': ('present', 'file is empty (0 rows); app uses its own Wikidata military layer', '', '', None),
    'wiw/data/map/map_conflict_events_ucdp.csv': ('present', 'globe layer UCDP GED (merged elsewhere)', '', '', None),
}
for a, png in (('counts_by_country', 'counts_by_country.png'), ('counts_by_era', 'timeline_by_era.png'), ('counts_by_grade', 'counts_by_grade.png'),
               ('nuclear_tests_by_state_environment', None), ('nuclear_yield_by_environment', 'nuclear_yield_by_environment.png'), ('pyramids_by_country', None),
               ('uap_distance_analysis', 'uap_distance_vs_baselines.png')):
    FILES['wiw/data/map/%s.csv' % a] = (('partial', 'Reports > briefings image %s (no data table)' % png, 'issue', 'figure only; numbers not readable or sortable') if png else
                                         ('missing', '-', 'issue', 'aggregate table not shown')) + ((lambda a=a: 'Q-' + a in TABLE_IDS and ui('data-tables')),)
for p in sorted(glob.glob(os.path.join(MAP, 'map_*.csv'))):
    rel = os.path.relpath(p, QWM); name = os.path.basename(p)
    if rel in FILES: continue
    c = catalog.get(name, {})
    if c.get('rejected'):
        FILES[rel] = ('partial', 'globe layer %s (%s of %s rows)' % (c['layer'], c['plotted'], c['rows']), 'bug',
                      '%d rows rejected (no point or no source_url) and dropped from every view, including analytics' % c['rejected'],
                      lambda name=name: any(r['file'] == name for r in UNPL.get('rows', []) + UNPL.get('unsourced', [])))
    else:
        FILES[rel] = ('present', 'globe layer %s (%s rows)' % (c.get('layer', '?'), c.get('plotted', '?')), '', '', None)
for rel in sorted(os.path.relpath(p, QWM) for p in glob.glob(os.path.join(QWM, 'r5base', '*.csv'))):
    cur = os.path.join(QWM, os.path.basename(rel))
    same = filecmp.cmp(os.path.join(QWM, rel), cur, shallow=False)
    FILES[rel] = ('present', 'older revision; byte-identical to the current file' if same else 'older revision (%s vs %s); app uses the current file' % (rows_of(os.path.join(QWM, rel)), rows_of(cur)), '', '', None)
for rel, (st, w, lab, fnd, chk) in FILES.items():
    p = os.path.join(QWM, rel)
    if not os.path.exists(p): continue
    after = (lambda chk=chk: ('present', 'Data panel / data/pdf7_data.js / data/unplaced.js') if chk and D and UI and chk() else ('', ''))
    add('Q-' + rel, 'dataset' if not rel.endswith('.md') else 'notes', '/workspace/qwm/' + rel, os.path.basename(rel), rows_of(p), st, w, lab, fnd, after if st != 'present' else None)
# bulk groups (counted as one item each)
for rel, title, st, w, lab, fnd in (
        ('gnis', 'USGS GNIS DomesticNames gazetteer extracts (7 files)', 'present', 'used for geocoding only (coord_source=GNIS)', '', ''),
        ('wiw/data/map/raw', 'raw third-party downloads (44 files: Natural Earth, GeoNames, UCDP GED, NUFORC scrub, KML)', 'partial', 'used by the build; never published raw', 'dilemma', 'raw inputs; NUFORC scrub is private, the rest are reference geometry'),
        ('wiw/data/map/cache', 'API response cache (Wikidata/GeoNames JSON)', 'partial', 'consumed by QWM scripts', 'dilemma', 'cache, not a dataset'),
        ('wiw/data/map/png', 'QWM briefing figures (27 PNG)', 'present', 'Reports > briefings', '', '')):
    p = os.path.join(QWM, rel); n = sum(len(fs) for _, _, fs in os.walk(p)) if os.path.isdir(p) else 0
    add('Q-' + rel + '/', 'dataset', '/workspace/qwm/' + rel + '/', title, '%d files' % n, st, w, lab, fnd, None)
used = {os.path.basename(f['file']) for f in figures}
for p in sorted(glob.glob(os.path.join(WIW, 'fig', '*'))):
    if os.path.basename(p) not in used:
        add('Q-fig/' + os.path.basename(p), 'figure', '/workspace/qwm/wiw/fig/' + os.path.basename(p), 'figure file not used in PDF 7', '', 'missing', '-', 'dilemma', 'unused draft figure', None)
add('Q-wiw/hs.py:CASES', 'dataset', '/workspace/qwm/wiw/hs.py (CASES list)', 'Part V case records embedded in the generator (108)', '108 cases', 'partial',
    'G12 rows of the glitches CSV + mapped cases', 'issue', 'witness counts and document lists live only in code; the app takes the CSV and the PDF text instead',
    lambda: ('present', 'Data panel > Entries (G12) + Sources (document links from the PDF text)') if ui('data-sources') else ('', ''))

# ---- write --------------------------------------------------------------------------------------------------------
os.makedirs(OUT, exist_ok=True)
cols = list(items[0])
with open(os.path.join(OUT, 'v1.2-data-gap-audit.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, cols, lineterminator='\n'); w.writeheader(); w.writerows(items)
K = collections.Counter(i['kind'] for i in items)
S = collections.Counter(i['v1_1_status'] for i in items); S2 = collections.Counter(i['v1_2_status'] for i in items)
L = collections.Counter(i['label'] for i in items if i['label'])
L2 = collections.Counter(i['label'] for i in items if i['label'] and i['v1_2_status'] != 'present')
by = collections.defaultdict(collections.Counter)
for i in items: by[i['kind']][i['v1_1_status']] += 1
md = ['# v1.2 data gap audit', '',
      'Generated by `data/tools/gap_audit.py` from PDF 7 (`/workspace/qwm/wiw/main.tex`, `main.aux`, `main.pdf`), the QWM folders and the built app data. '
      'Full row-level detail is in [`v1.2-data-gap-audit.csv`](v1.2-data-gap-audit.csv). The v1.1 columns describe the app as tagged at v1.1.0; '
      'the v1.2 columns are recomputed from the built artifacts (`data/pdf7_data.js`, `data/unplaced.js`, `src/ui_data.js`) each time the tool runs.', '',
      '## Headline', '', '| | count |', '|---|---:|', '| inventory items | %d |' % len(items)]
md += ['| %s | %d |' % (k, K[k]) for k in sorted(K)]
md += ['', '| status | v1.1.0 | v1.2.0 |', '|---|---:|---:|'] + ['| %s | %d | %d |' % (s, S[s], S2[s]) for s in ('present', 'partial', 'missing')]
md += ['', '### Gaps by label (exactly one label per gap)', '', '| label | meaning | gaps in v1.1.0 | still open in v1.2.0 |', '|---|---|---:|---:|']
MEAN = dict(bug='app drops or mishandles data it loads', error='a value in the app is wrong', issue='data exists but was not surfaced',
            problem='not a place; v1.1 had nowhere to put it', dilemma='judgment call: scope, licence, privacy, editorial', conflict='two sources disagree')
md += ['| %s | %s | %d | %d |' % (k, MEAN[k], L[k], L2[k]) for k in MEAN]
md += ['', '### Status by kind (v1.1.0)', '', '| kind | present | partial | missing |', '|---|---:|---:|---:|']
md += ['| %s | %d | %d | %d |' % (k, by[k]['present'], by[k]['partial'], by[k]['missing']) for k in sorted(by)]
md += ['', '## Conflicts', ''] + ['- **%s** %s (%s): %s' % (i['id'], i['title'], i['location'], i['finding']) for i in items if i['label'] == 'conflict']
md += ['', '## Bugs', ''] + ['- **%s** %s: %s' % (i['id'], i['title'], i['finding']) for i in items if i['label'] == 'bug']
md += ['', '## Still open after v1.2 (with reason)', '']
md += ['- %s %s [%s]: %s' % (i['id'], i['title'][:90], i['label'], i['finding']) for i in items if i['label'] and i['v1_2_status'] != 'present']
md += ['', '## Method', '',
       '- Tables: every `tabular`/`longtable` in main.tex (165), parsed to rows; section from main.toc, page located in the PDF text layer (printed page numbers).',
       '- Figures: every `\\includegraphics` with a caption (58), plus unused files in `wiw/fig/`.',
       '- Statistics: counts stated in PDF 7 (front-matter table T001, figure captions, Part V taxonomy table) recomputed from the CSVs; a mismatch is a conflict.',
       '- Datasets: every CSV/JSON/MD/TXT under /workspace/qwm except bulk folders (raw downloads, API cache, gazetteers), which count as one item each.',
       '- Status rules and labels live in the tool, one rule per group, so a reviewer can change a judgement in one place.']
open(os.path.join(OUT, 'v1.2-data-gap-audit.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print(len(items), 'items', dict(S), 'labels', dict(L), 'after', dict(S2))
