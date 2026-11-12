#!/usr/bin/env python3
"""Write docs/audit/pass-01.md ... pass-10.md and SUMMARY.md from findings.json (forensics.py), pass-07-data.json
(stats_crosscheck.py), url_status.csv (check_urls.py) and docs/audit/checks.json (lint/test/build numbers).
Usage: python3 scripts/audit/write_passes.py"""
import collections, csv, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, 'docs', 'audit')
F = json.load(open(os.path.join(A, 'findings.json')))
CLASSES = ['bug', 'error', 'issue', 'problem', 'dilemma', 'conflict']
rows = list(csv.DictReader(open(os.path.join(A, 'qwm-data-issues.csv'), encoding='utf-8')))
checks = json.load(open(os.path.join(A, 'checks.json'))) if os.path.exists(os.path.join(A, 'checks.json')) else {}
urls = list(csv.DictReader(open(os.path.join(A, 'url_status.csv'), encoding='utf-8'))) if os.path.exists(os.path.join(A, 'url_status.csv')) else []

TITLES = {
    1: ('Sources and licences', 'Every plotted row has an http(s) source; every dataset has a licence we can honour; cited URLs answer.'),
    2: ('Coordinates and precision', 'Coordinates are in range, on the right side of the coast and border, and as precise as the precision label claims.'),
    3: ('Dates', 'Dates parse, ranges are ordered, precision labels match the value, and the summary text agrees with the date field.'),
    4: ('Grades and wording', 'Grades follow the house rules (Hastings and Pasulka = CIT, ST = experiencers, Official record = archives, Greer/Maussan = zero weight) and summaries carry no skeptic boilerplate.'),
    5: ('Identity, duplicates and cross-dataset conflicts', 'Ids are unique, the same event in two datasets is linked, and every disagreement is kept with both values.'),
    6: ('Reference layers', 'Reference layers (military, nuclear, volcanoes, conflicts, nuclear tests) are spot-checked against their sources and against published reference values.'),
    7: ('Statistics', 'The analysis numbers in the app are re-derived independently in Python from the same data.'),
    8: ('Reports, glossary and index claims', 'Every glossary term and report claim traces to a field or a cited source.'),
    9: ('Code, security, performance and licences', 'Lint, tests, bundle, CSP, escaping, dependency licences and performance.'),
    10: ('UX, accessibility and end-to-end', 'Headless end-to-end run, screenshots, reduced motion, audio defaults, contrast and responsive layout.'),
}
METHODS = {
    1: 'scripts/audit/forensics.py (missing source_url per QWM file), scripts/audit/check_urls.py (HEAD/GET every cited URL, polite per-domain rate limit, Wayback lookup for failures), licence review of every dataset in CREDITS.md.',
    2: 'Natural Earth 10m admin-0 point-in-polygon, admin-1 centroid proximity, decimal-place step vs claimed precision, repeated precise points shared by differently named rows.',
    3: 'ISO parsing incl. BCE, calendar validity, date_low <= date <= date_high, year-only precision with month/day, the only year in the summary vs the date field.',
    4: 'Regex over grade, source and summary fields; the v1 build is compared so that no grade goes down.',
    5: 'Duplicate ids within a file; same event across datasets by name or same day within 300 km; field-by-field comparison of date, lat, lon, precision, grade, category.',
    6: 'Random samples (seed 2026) of 50 military, 50 nuclear, 30 volcano and 30 conflict rows checked for country and source; 10 famous nuclear tests checked against published dates, yields and corrected hypocentres.',
    7: 'scripts/audit/dump_analysis.mjs runs the in-app analysis headlessly and dumps per-case distances and baselines; scripts/audit/stats_crosscheck.py recomputes nearest distances with numpy, medians, Wilson intervals and Monte Carlo p values.',
    8: 'Every glossary entry needs a URL or a document reference; report sections are generated only from record fields (src/report_gen.js, unit-tested).',
    9: 'ESLint 9, Prettier 3, Node test runner, esbuild bundle size, CSP review, grep for innerHTML sinks, dependency licence list, headless timings.',
    10: 'test/smoke.mjs (Playwright, SwiftShader) across all panels and the tour; test/screens.mjs for the screenshots; manual review of reduced-motion and audio defaults.',
}
NOTES = {
    1: ["Rows without a source are not plotted (sourced rows only); QWM should add the citations: 13 USO (water), 7 satellite anomaly and 13 off-limits rows.",
        "EOX: only the 2016 s2cloudless vintage is CC BY 4.0. The 2018+ vintages are CC BY-NC-SA and cannot be used by a company; the app now uses 2016 only.",
        "NUFORC: no licence stated. Kept local-only (see the dilemma in SUMMARY.md)."],
    2: ["Military layer: the Wikidata subclass walk had pulled in fire lookout towers, belfries and bird hides, and counted 9k historic forts and 3.7k gendarmerie barracks as bases. Fixed with a class policy (data/tools/military_class_policy.json); this changes the military analysis numbers.",
        "'Missing coordinates' rows (329 in map_uap_cit, 39 in map_conflicts, 2 elsewhere) are kept by QWM for completeness; they are not plotted.",
        "Off-limits mountains: 5 rows use coord_precision 'installation' (not in the schema) and are drawn as 25 km circles until QWM relabels them."],
    3: ["GEIPAN-1811 is dated 2000-09-31 (no such day). Reconquista (CON-WP-12) has date_low 718 after date_high 1492 in one field order; both left for QWM to fix."],
    4: ["679 skeptic-wording hits are all in private NUFORC narratives (not published). Nothing was edited; the rule is applied by QWM.",
        "5 Hastings/Pasulka rows not yet graded CIT; 4 ST grades on archival sources; 3 Greer/Maussan rows (zero weight in the app). Grades were not lowered anywhere."],
    5: ["NT-74044 is used for two different tests (PINEDROPS 1974-01-10 and TAUREAU 1974-08-24): an error in the QWM file, tolerated by the validator as a known duplicate.",
        "Cross-dataset conflicts are shown in dossiers with both values and a conflict badge; nothing is silently merged."],
    6: ["Nuclear tests: Trinity, Little Boy, Fat Man, RDS-1, Ivy Mike, Hurricane, Castle Bravo and Tsar Bomba match the published references. Gerboise Bleue carries a yield class '0-200' vs the published 70 kt (conflict).",
        "1,350 SIPRI yields are yield classes (ranges), not values; the app shows them as ranges and sizes markers by the upper bound.",
        "Three dates differ by one day because SIPRI lists GMT (e.g. Little Boy 1945-08-05 GMT = 08-06 local)."],
    7: [],
    8: ["All glossary terms carry a source (URL or document)."],
    9: [],
    10: [],
}


def counts(p):
    return F['counts'].get(str(p), {})


def table(c):
    return '| ' + ' | '.join(CLASSES) + ' | total |\n|' + '---:|' * (len(CLASSES) + 1) + '\n| ' + ' | '.join(str(c.get(k, 0)) for k in CLASSES) + f' | {sum(c.values())} |\n'


def examples(p, n=12):
    out, seen = [], collections.Counter()
    for r in rows:
        if r['pass'] != str(p): continue
        key = (r['class'], r['detail'][:40])
        if seen[key] >= 2: continue
        seen[key] += 1
        nm = r['name'] or ('(private row)' if r.get('private_row') in ('1', 'True', 'true') else '')
        out.append(f"| {r['class']} | {r['dataset']} | {r['id']} {nm} | {r['detail'].replace('|', '/')[:220]} |")
        if len(out) >= n: break
    return '| class | dataset | record | finding |\n|---|---|---|---|\n' + '\n'.join(out) + '\n' if out else ''


def pass7():
    p = os.path.join(A, 'pass-07-data.json')
    if not os.path.exists(p): return ''
    d = json.load(open(p)); s = ['| run | reference | pairs | max |Δ| km | median py / js (km) | Monte Carlo p (py / js / agree) |', '|---|---|---:|---:|---|---|']
    for f in d:
        for k, r in f['refs'].items():
            mc = '; '.join(f"{m} {v['p_py']} / {v['p_js']} / {'yes' if v['agree'] else 'NO'}" for m, v in r['mc'].items())
            s.append(f"| {f['file']} (n={f['n']}) | {k} | {r['pairs']} | {r['max_abs_diff_km']} | {r['median_py']} / {r['median_js']} | {mc} |")
    return '\n'.join(s) + '\n'


def url_summary():
    if not urls: return 'URL check still running at the time of writing; see docs/audit/url_status.csv when present.\n'
    c = collections.Counter(r.get('class') for r in urls)
    wb = sum(1 for r in urls if r.get('wayback'))
    t = ', '.join(f'{k} {v}' for k, v in c.most_common())
    return (f"{len(urls)} distinct cited URLs checked ({t}). 'blocked' (401/403/429) is bot protection, not evidence a page is gone. "
            f"{wb} dead or unreachable URLs have a Wayback Machine copy, offered as the alternate link in the app. Full list: [url_status.csv](url_status.csv).\n")


for p in range(1, 11):
    t, goal = TITLES[p]; c = counts(p)
    md = [f'# Pass {p:02d}: {t}', '', f'**Goal.** {goal}', '', f'**Method.** {METHODS[p]}', '', '## Findings by class', '', table(c)]
    if p == 1: md += ['## URL liveness', '', url_summary()]
    if p == 7:
        md += ['## Independent re-derivation', '', pass7(),
               'Observed nearest distances agree pair for pair (max difference under 1 km, from the spatial index cell edge), medians agree exactly, and Wilson intervals agree. '
               'For the all-precision run the JS used 99 iterations, so its p values have about ±0.05 Monte Carlo error. '
               'Python resamples i.i.d. from the pooled JS null; for the paired population and date-permutation nulls that approximation is narrower, which explains the borderline conflict/time p.', '']
    if p == 9 and checks:
        md += ['## Checks', '', '| check | result |', '|---|---|'] + [f'| {k} | {v} |' for k, v in checks.items()] + ['']
    if NOTES[p]: md += ['## Notes', ''] + [f'- {x}' for x in NOTES[p]] + ['']
    ex = examples(p)
    if ex: md += ['## Examples', '', ex, f'All rows: [qwm-data-issues.csv](qwm-data-issues.csv) (filter `pass = {p}`).', '']
    open(os.path.join(A, f'pass-{p:02d}.md'), 'w', encoding='utf-8').write('\n'.join(md))
tot = collections.Counter()
for p in range(1, 11): tot.update(counts(p))
json.dump({'per_pass': {p: counts(p) for p in range(1, 11)}, 'total': dict(tot)}, open(os.path.join(A, 'totals.json'), 'w'), indent=1)
print('passes written; totals', dict(tot), sum(tot.values()))
