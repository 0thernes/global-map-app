#!/usr/bin/env python3
"""Hardening pass catalogue and runner (v1.5.1 hardening audit).

Each pass is one lens applied to one scope. `auto` passes are executed by this script and their raw result is written
to docs/audit/hardening/passes_run.json; `manual` passes are file-by-file reviews whose record (what was read, what was
found) lives in the `note` field and in findings.csv. PASSES.md is generated from this registry, so the catalogue,
the run record and the counts cannot drift apart.

Run:  python3 scripts/audit/hardening_passes.py            # run every auto pass, write passes_run.json + PASSES.md
      python3 scripts/audit/hardening_passes.py --only C07  # run one pass
      python3 scripts/audit/hardening_passes.py --skip-slow # skip passes that need npm/node runs (lint, tests, build)
Exit status is 1 when an auto pass that is expected to be clean is not clean.
"""
import csv
import gzip
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/audit/hardening'
os.chdir(ROOT)

LAYERS = {
    'A': 'Inventory and repository hygiene',
    'B': 'Code correctness',
    'C': 'Security and supply chain',
    'D': 'Data integrity and provenance',
    'E': 'Accessibility',
    'F': 'Performance',
    'G': 'Internationalisation and Unicode',
    'H': 'Error handling and offline / keyless robustness',
    'I': 'Tests and coverage',
    'J': 'CI and workflows',
    'K': 'Documentation accuracy against code',
    'L': 'Licensing and attribution',
    'M': 'Academic rigour (citation, methodology, limitations, data dictionary)',
    'N': 'Repository checklist',
    'O': 'Configuration drift',
    'P': 'Dependency hygiene',
    'Q': 'Python data / audit tooling',
}

TEXT_SKIP = re.compile(r'\.(png|jpe?g|gif|webp|mp3|wasm|gz|woff2?|ico|pdf|ktx2|glb|bin)$', re.I)


def sh(cmd, timeout=900):
    p = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, timeout=timeout)
    return p.returncode, (p.stdout + p.stderr)


def tracked(pattern=None):
    args = ['git', 'ls-files'] + ([pattern] if pattern else [])
    return [f for f in subprocess.run(args, capture_output=True, text=True).stdout.split('\n') if f]


def text_files(prefixes=None, exclude_vendor=True):
    out = []
    for f in tracked():
        if TEXT_SKIP.search(f) or (exclude_vendor and f.startswith(('vendor/', 'js/app.js'))):
            continue
        if prefixes and not f.startswith(tuple(prefixes)):
            continue
        out.append(f)
    return out


def grep(regex, files, flags=0):
    rx = re.compile(regex, flags)
    hits = []
    for f in files:
        try:
            for i, line in enumerate(open(f, encoding='utf-8', errors='replace'), 1):
                if rx.search(line):
                    hits.append(f'{f}:{i}: {line.strip()}')
        except (IsADirectoryError, FileNotFoundError):
            pass
    return hits


def ok_if_empty(hits, what):
    return (not hits, f'{len(hits)} {what}', hits[:25])


# ---------------------------------------------------------------- auto pass implementations
def a01():
    idx = list(csv.DictReader(open(OUT / 'index.csv')))
    t = tracked()
    missing = sorted(set(t) - {r['path'] for r in idx})
    return (not missing, f'{len(idx)} indexed / {len(t)} tracked', missing[:25])


def a02():
    big = [f for f in tracked() if os.path.exists(f) and os.path.getsize(f) > 50e6]
    _, st = sh('git status --porcelain --untracked-files=no')
    return (not big, f'{len(big)} files over 50 MB; working tree changes: {len(st.splitlines())}', big)


def a03():
    idx = list(csv.DictReader(open(OUT / 'index.csv')))
    other = [r['path'] for r in idx if r['role'] == 'Other']
    return ok_if_empty(other, 'files without a role')


def b01():
    rc, out = sh('npx eslint .')
    return (rc == 0, 'eslint exit %d' % rc, out.splitlines()[-15:])


def b02():
    rc, out = sh('npx prettier --check .')
    return (rc == 0, 'prettier exit %d' % rc, out.splitlines()[-10:])


def b03():
    rc, out = sh('node scripts/build.mjs && git diff --stat --exit-code -- js/app.js')
    return (rc == 0, 'bundle reproducible' if rc == 0 else 'js/app.js differs after build', out.splitlines()[-5:])


def b04():
    rc, out = sh('node --test "test/unit/*.test.mjs"', timeout=900)
    m = {k: re.search(rf'ℹ {k} (\d+)', out) for k in ('tests', 'pass', 'fail')}
    s = ' / '.join(f'{k} {v.group(1)}' for k, v in m.items() if v)
    return (rc == 0, s, [ln for ln in out.splitlines() if ln.startswith('✖')][:20])


def b05():
    return ok_if_empty(grep(r'\bvoid [a-z_]\w*;|if \(false\)|\bdebugger\b', text_files(['src/'])), 'dead-code markers in src/')


def b06():
    return ok_if_empty(grep(r'console\.(log|debug)\(|\b(TODO|FIXME|XXX|HACK)\b', text_files(['src/', 'css/', 'index.html'])),
                       'console.log / TODO markers in shipped code')


def b07():
    return ok_if_empty(grep(r'import\(\s*[^\'"\s)]', text_files(['src/'])), 'dynamic import() with a non-literal path')


def b08():
    files = text_files(['src/'])
    hits = []
    for f in files:
        lines = open(f, encoding='utf-8').read().split('\n')
        for i, ln in enumerate(lines):
            if 'JSON.parse(' in ln and not any('try' in x or 'catch' in x for x in lines[max(0, i - 4):i + 4]):
                hits.append(f'{f}:{i + 1}: {ln.strip()[:120]}')
    return ok_if_empty(hits, 'JSON.parse calls with no try/catch nearby')


def b09():
    files = text_files(['src/'])
    hits = []
    for f in files:
        lines = open(f, encoding='utf-8').read().split('\n')
        for i, ln in enumerate(lines):
            if re.search(r'localStorage\.(get|set|remove)Item', ln) and not any('try' in x for x in lines[max(0, i - 4):i + 1]):
                hits.append(f'{f}:{i + 1}: {ln.strip()[:120]}')
    return ok_if_empty(hits, 'localStorage calls outside try (throws in privacy mode / quota)')


def b10():
    files = text_files(['src/'])
    hits = []
    for f in files:
        lines = open(f, encoding='utf-8').read().split('\n')
        for i, ln in enumerate(lines):
            if 'window.open(' in ln and not any(re.search(r'if \(!?w\b|\?\.', x) for x in lines[i:i + 3]):
                hits.append(f'{f}:{i + 1}: {ln.strip()[:120]}')
    return ok_if_empty(hits, 'window.open() results used without a popup-blocked check')


def b21():
    hits = []
    for f in text_files(['src/']):
        src = open(f, encoding='utf-8').read()
        for m in re.finditer(r'function (render\w*|draw\w*)\([^)]*\)\s*\{', src):
            body = src[m.end():m.end() + 3000]
            depth, j = 1, 0
            while j < len(body) and depth:
                depth += {'{': 1, '}': -1}.get(body[j], 0)
                j += 1
            if re.search(r'document\.addEventListener|window\.addEventListener', body[:j]):
                hits.append(f'{f}: {m.group(1)}() adds a document/window listener on every render')
    return ok_if_empty(hits, 'render functions that add global listeners')


def c01():
    html = open('index.html', encoding='utf-8').read()
    csp = re.search(r'Content-Security-Policy"\s*content="([^"]+)"', html).group(1)
    hosts = set(re.findall(r'https://([^\s;]+)', csp))
    used = set()
    for f in text_files(['src/']):
        t = open(f, encoding='utf-8').read()
        # URLs in url:/fetch/get()/src= positions are requests; credit links in prose are not
        used |= set(re.findall(r'(?:url:\s*|get\(|fetch\(|src=")[\'"`]?https://([a-z0-9.{}*-]+\.[a-z]{2,})', t))
        used |= set(re.findall(r"^\s*'https://([a-z0-9.{}*-]+\.[a-z]{2,})/[^']*\{z\}", t, re.M))
    fetched = {h for h in used if any(k in h for k in ('arcgis', 'eox', 'openstreetmap', 'cartocdn', 'gibs', 'amazonaws', 'usgs', 'eonet'))}
    norm = {h.replace('{s}.', '*.') for h in fetched}
    missing = sorted(h for h in norm if h not in hosts)
    unused = sorted(h for h in hosts if h not in norm)
    bad = [d for d in ("'unsafe-eval'", "script-src 'self' file: 'unsafe-inline'") if d in csp]
    return (not missing and not bad, f'{len(hosts)} CSP hosts; fetched-but-not-allowed {missing}; allowed-but-unused {unused}', bad)


def c02():
    hits = []
    for f in text_files(['src/']):
        for i, ln in enumerate(open(f, encoding='utf-8'), 1):
            if re.search(r'innerHTML\s*\+?=|insertAdjacentHTML|outerHTML\s*=', ln):
                hits.append(f'{f}:{i}')
    return (True, f'{len(hits)} HTML sinks inventoried (each reviewed manually, see note)', hits[:200])


def c03():
    files = text_files(['src/'])
    hits = grep(r'href="\$\{(?!esc\()', files) + grep(r'src="\$\{(?!esc\()', files)
    hits = [h for h in hits if not re.search(r'href="\$\{(u|url|href)\}"', h)]
    return (True, f'{len(hits)} attribute interpolations without esc() (reviewed: ids, numbers, constants)', hits[:40])


def c05():
    return ok_if_empty([h for h in grep(r'target=.?_blank', text_files(['src/', 'index.html'])) if 'noopener' not in h and 'setAttribute' not in h],
                       'target=_blank without rel=noopener')


def c06():
    hits = grep(r'\beval\(|new Function\(|setTimeout\(\s*[\'"`]|setInterval\(\s*[\'"`]|document\.write\(', text_files(['src/']))
    # allow-listed: the printable dossier writes escaped markup into its own about:blank window (F-C06-1, decided)
    hits = [h for h in hits if not (h.startswith('src/ui_panels.js:') and 'w.document.write(' in h)]
    return ok_if_empty(hits, 'eval / new Function / string timers / document.write (printable dossier allow-listed, F-C06-1)')


def c07():
    rx = r'(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|eyJhbGciOi[A-Za-z0-9_-]{20,}\.)'
    hits = [h for h in grep(rx, text_files(exclude_vendor=False))
            if not (h.startswith(('js/app.js:', 'js/app.js.map:')) and 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' in h)]
    return ok_if_empty(hits, 'secret-shaped strings in tracked text files (Cesium default ion token in the bundle allow-listed, F-C07-1)')


def c08():
    bad = []
    for f in tracked('.github/workflows/*.yml'):
        y = open(f).read()
        if not re.search(r'^permissions:', y, re.M):
            bad.append(f'{f}: no top-level permissions')
        if re.search(r'write-all|contents:\s*write', y) and 'release' not in f:
            bad.append(f'{f}: write permission outside the release workflow')
        if 'pull_request_target' in y:
            bad.append(f'{f}: pull_request_target')
    return ok_if_empty(bad, 'workflow permission problems')


def c09():
    refs = []
    for f in tracked('.github/workflows/*.yml'):
        refs += [f'{f}: {m}' for m in re.findall(r'uses:\s*(\S+)', open(f).read())]
    unpinned = [r for r in refs if not re.search(r'@[0-9a-f]{40}\b', r)]
    return (True, f'{len(refs)} action refs, {len(unpinned)} pinned to a major tag rather than a SHA (decided: see H-finding)', unpinned)


def c10():
    rc, out = sh('npm audit --json')
    try:
        v = json.loads(out[out.index('{'):])['metadata']['vulnerabilities']
    except Exception:
        return (False, 'npm audit failed to run', out.splitlines()[-5:])
    bad = {k: n for k, n in v.items() if n and k != 'total'}
    return (not bad, f'npm audit: {bad or "0 vulnerabilities"}', [])


def c11():
    lock = json.load(open('package-lock.json'))
    bad = [k for k, v in lock.get('packages', {}).items()
           if k and not v.get('link') and (not v.get('integrity') or not str(v.get('resolved', '')).startswith('https://registry.npmjs.org/'))]
    return ok_if_empty(bad, 'lockfile entries without integrity or not from registry.npmjs.org')


def c12():
    files = [f for f in tracked('*.py') if not f.endswith('hardening_passes.py')]
    hits = grep(r'shell=True|\beval\(|\bexec\(|pickle\.load|yaml\.load\(|verify=False', files)
    hits += [h for h in grep(r'urlopen\(|requests\.(get|post)\(', files) if 'timeout' not in h]
    return ok_if_empty(hits, 'risky calls in Python tooling')


def c14():
    rc1, o1 = sh('actionlint')
    rc2, o2 = sh(['shellcheck'] + tracked('*.sh'))
    lines = [ln for ln in (o1 + o2).splitlines() if ln.strip()]
    return (rc1 == 0 and rc2 == 0, f'actionlint exit {rc1}, shellcheck exit {rc2}', lines[:20])


def c15():
    hits = [h for h in grep(r'Ion\.defaultAccessToken\s*=\s*[\'"][A-Za-z0-9]|api\.cesium\.com|assets\.ion\.cesium', text_files(['src/', 'index.html']))]
    return ok_if_empty(hits, 'Cesium ion token or ion endpoint references')


def g04():
    rx = r'[\u202A-\u202E\u2066-\u2069\u200B\uFEFF]'
    return ok_if_empty(grep(rx, text_files(exclude_vendor=True)), 'bidi-control / zero-width characters (Trojan Source)')


def d01():
    rc, out = sh('python3 scripts/validate_data.py')
    m = re.search(r'validated (\d+) CSV files: (\d+) errors, (\d+) warnings', out)
    return (rc == 0, m.group(0) if m else out.splitlines()[-1:], [])


def load_js(path, var=None):
    t = open(path, encoding='utf-8').read()
    i = t.index('{') if var is None else t.index('=') + 1
    j = t.rindex('}') + 1
    if var is None and t.lstrip().startswith(('/*', 'window')) and '=' in t[:t.index('{')]:
        i = t.index('=') + 1
    return json.loads(t[i:j] if var is None else t[i:].strip().rstrip(';'))


def cases():
    t = open('data/cases.js', encoding='utf-8').read()
    return json.loads(t[t.index('=') + 1:].strip().rstrip(';'))


def d02():
    bad = [c['id'] for c in cases() if c.get('coord_precision') not in ('exact_site', 'within_1km', 'locality', 'region')]
    return ok_if_empty(bad, 'public cases with a coord_precision outside the plotting vocabulary')


def d03():
    bad = [c['id'] for c in cases() if not re.match(r'^https?://', str(c.get('source_url', '')))]
    return ok_if_empty(bad, 'public cases without an http(s) source_url')


def d04():
    bad = [c['id'] for c in cases() if not c.get('coord_source')]
    return ok_if_empty(bad, 'public cases without coord_source')


def d05():
    bad = [c['id'] for c in cases() if not (isinstance(c.get('lat'), (int, float)) and abs(c['lat']) <= 90 and abs(c['lon']) <= 180)
           or (abs(c['lat']) < 0.01 and abs(c['lon']) < 0.01)]
    return ok_if_empty(bad, 'cases with out-of-range or null-island coordinates')


def d06():
    from collections import Counter
    n = Counter(c['id'] for c in cases())
    return ok_if_empty([k for k, v in n.items() if v > 1], 'duplicate case ids')


def d07():
    bad = []
    rx = re.compile(r'^-?\d{4,}(-\d\d(-\d\d)?)?$')
    for c in cases():
        for k in ('date', 'date_low', 'date_high'):
            v = c.get(k)
            if v and not rx.match(v):
                bad.append(f"{c['id']}.{k}={v}")
            elif v and len(v) >= 10 and not v.startswith('-'):
                m, d = int(v[5:7]), int(v[8:10])
                if not (1 <= m <= 12 and 1 <= d <= 31):
                    bad.append(f"{c['id']}.{k}={v}")
        lo, hi = c.get('date_low'), c.get('date_high')
        if lo and hi and not lo.startswith('-') and not hi.startswith('-') and lo > hi:
            bad.append(f"{c['id']}: date_low > date_high")
    return ok_if_empty(bad, 'case date problems')


def d09():
    sys.path.insert(0, str(ROOT))
    grades = {}
    for c in cases():
        grades[c.get('grade', '')] = grades.get(c.get('grade', ''), 0) + 1
    rc, out = sh(['node', '-e', 'import("./src/grades.js").then(g=>{const a=JSON.parse(process.argv[1]);console.log(JSON.stringify(Object.fromEntries(a.map(s=>[s,g.gradeClass(s)]))))})', json.dumps(list(grades))])
    m = json.loads(out.strip().splitlines()[-1])
    other = {k: grades[k] for k, v in m.items() if v == 'Other'}
    return (True, f'{len(grades)} raw grade strings; mapped to Other: {other}', [f'{k!r} -> {v}' for k, v in m.items()])


def d10():
    hits = [f for f in tracked() if f.startswith('data/private/') and f != 'data/private/README.md']
    rows = [h for h in grep(r'"dataset":\s*"NUFORC|nuforc\.org/webreports|nuforc\.org/sighting', text_files(['data/']))
            if not h.startswith('data/catalog.js:')]  # aggregate statistics only, decided in F-D10-1
    _, site = sh("node -e \"\"")  # package exclusion is checked in the source below
    pkg = open('scripts/package.mjs').read()
    excl = r'/^data\/private\//' in pkg
    return (not hits and not rows and excl, f'tracked private files {len(hits)}, NUFORC rows in public data {len(rows)}, package excludes data/private: {excl}', hits + rows[:10])


def d12():
    hits = [h for h in grep(r'jitter|Math\.random\(\)\s*\*\s*0\.\d|\+\s*\(Math\.random', text_files(['src/']))
            if not re.search(r'never jitter|never jittered|Nothing is invented|ui_data\.js', h)]
    return ok_if_empty(hits, 'jitter / random coordinate offsets in map code')


def d16():
    # the shipped layer files keep the upstream bytes; the app cleans placeholders at load (src/data_clean.js), so the
    # pass measures what a user can see: rows that still show a placeholder after cleaning
    js = r"""
import("./src/data_clean.js").then(({cleanWikidataPlaceholders:c})=>{const fs=require("fs"),vm=require("vm");let raw=0,left=0;
for(const [f,n] of [["data/layers/military.js","military"],["data/layers/map_nuclear_sites.js","map_nuclear_sites"],["data/cases.js",null]]){
 const reg={},w={};vm.runInNewContext(fs.readFileSync(f,"utf8"),{GM:{reg:(k,v)=>reg[k]=v},window:w});
 const items=n?reg[n].items:w.GM_CASES;const bad=(it)=>Object.entries(it).some(([k,v])=>typeof v==="string"&&!/url$/.test(k)&&/(^|\s)https?:\/\/www(\.wikidata\.org\/\.well-known|$)/.test(v));
 raw+=items.filter(bad).length;left+=items.map(c).filter(bad).length}
console.log(JSON.stringify({raw,left}))})"""
    rc, out = sh(['node', '-e', js])
    try:
        r = json.loads(out.strip().splitlines()[-1])
    except Exception:
        return (False, 'pass crashed', out.splitlines()[-5:])
    return (r['left'] == 0, f"{r['raw']} rows carry a Wikidata unknown-value placeholder in the shipped files; {r['left']} still show one after load-time cleaning", [])


def d20():
    out = []
    for f in sorted(Path('data/sources/qwm').glob('map_*.csv.gz')):
        stem = f.name[:-7]
        lj = Path('data/layers') / f'{stem}.js'
        if not lj.exists():
            continue
        n_src = sum(1 for _ in csv.DictReader(gzip.open(f, 'rt', encoding='utf-8')))
        t = lj.read_text(encoding='utf-8')
        n_built = t.count('"id":"')
        out.append(f'{stem}: source {n_src} rows, built {n_built} items')
    return (True, f'{len(out)} QWM reference layers reconciled (built ≤ source; differences are unsourced / unplaceable rows, listed in the Data panel)', out)


def e06():
    html = open('index.html', encoding='utf-8').read()
    btns = re.findall(r'(<button\b[^>]*>)(.*?)</button>', html, re.S)
    bad = [b[:100] for b, inner in btns if 'data-icon' in b and 'aria-label' not in b and not re.sub(r'<[^>]+>', '', inner).strip()]
    return ok_if_empty(bad, 'icon-only buttons in index.html without aria-label')


def e08():
    html = open('index.html', encoding='utf-8').read()
    miss = [k for k, rx in (('lang', r'<html lang="'), ('title', r'<title>[^<]+'), ('viewport', r'name="viewport"'), ('description', r'name="description"')) if not re.search(rx, html)]
    return ok_if_empty(miss, 'missing document-level a11y metadata')


def f02():
    rc, out = sh(['node', '-e', '''
import("esbuild").then(async ({build})=>{const r=await build({entryPoints:["src/app.js"],bundle:true,write:false,minify:true,format:"iife",metafile:true,outdir:"/tmp/hb",logLevel:"silent",
plugins:[{name:"t",setup(b){b.onResolve({filter:/^three$/},()=>({path:process.cwd()+"/vendor/three/three.module.min.js"}))}}]});
const o=Object.values(r.metafile.outputs)[0];const by={};for(const[k,v]of Object.entries(o.inputs)){const p=k.includes("node_modules")?k.split("node_modules/")[1].split("/").slice(0,k.includes("@")?2:1).join("/"):k.split("/").slice(0,2).join("/");by[p]=(by[p]||0)+v.bytesInOutput}
console.log(JSON.stringify(Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8)))})'''])
    return (True, 'bundle composition (bytes in output)', out.strip().splitlines()[-1:])


def f04():
    big = sorted(((os.path.getsize(f), f) for f in tracked() if os.path.exists(f) and os.path.getsize(f) > 5e6), reverse=True)
    return (True, f'{len(big)} tracked files over 5 MB', [f'{s / 1e6:.1f} MB {f}' for s, f in big])


def g02():
    hits = [h for h in grep(r'toLocaleString\(\)|toLocaleDateString\(\)|toLocaleTimeString\(\)', text_files(['src/']))]
    return ok_if_empty(hits, 'locale-dependent formatting without an explicit locale')


def g03():
    bad = [f for f in tracked() if not re.match(r'^[A-Za-z0-9._/@+-]+$', f)]
    return ok_if_empty(bad, 'tracked paths with spaces or non-ASCII characters')


def i01():
    srcs = sorted(p for p in tracked('src/*.js') + tracked('src/**/*.js'))
    tests = '\n'.join(open(f, encoding='utf-8').read() for f in tracked('test/unit/*.mjs'))
    untested = [s for s in sorted(set(srcs)) if Path(s).stem not in tests and s.replace('src/', '') not in tests]
    return (True, f'{len(set(srcs)) - len(untested)} of {len(set(srcs))} src modules imported by a unit test', untested)


def j01():
    bad = []
    for f in tracked('.github/workflows/*.yml'):
        y = open(f).read()
        jobs = y[y.index('\njobs:'):] if '\njobs:' in y else ''
        for job in re.findall(r'^  ([a-z_-]+):\n((?:    .*\n|\n)+)', jobs, re.M):
            if 'timeout-minutes' not in job[1]:
                bad.append(f'{f}: job {job[0]} has no timeout-minutes')
    return ok_if_empty(bad, 'jobs without a timeout')


def k03():
    c = open('CITATION.cff').read()
    v = re.search(r'^cff-version:\s*(\S+)', c, re.M).group(1)
    issues = []
    if v not in ('1.2.0',):
        issues.append(f'cff-version {v} is not a published CFF schema version (latest 1.2.0)')
    if 'three.js' in c:
        issues.append('abstract/keywords still describe a three.js globe (renderer is CesiumJS, ADR 0001)')
    pv = json.load(open('package.json'))['version']
    if f'version: {pv}' not in c:
        issues.append(f'version differs from package.json {pv}')
    return ok_if_empty(issues, 'CITATION.cff problems')


def k06():
    pv = json.load(open('package.json'))['version']
    lv = json.load(open('package-lock.json'))['version']
    hv = re.search(r'OSINT · v([\d.]+)', open('index.html', encoding='utf-8').read()).group(1)
    cv = re.search(r'^version:\s*(\S+)', open('CITATION.cff').read(), re.M).group(1)
    ch = re.search(r'^## \[(\d+\.\d+\.\d+)\]', open('CHANGELOG.md').read(), re.M).group(1)
    vals = dict(package=pv, lock=lv, html=hv, citation=cv, changelog=ch)
    return (len(set(vals.values())) == 1, str(vals), [])


def k05():
    bad = []
    for f in tracked('*.md'):
        t = open(f, encoding='utf-8').read()
        for m in re.finditer(r'\]\(([^)\s]+)\)', t):
            u = m.group(1)
            if u.startswith(('http', 'mailto:', '#')):
                continue
            p = u.split('#')[0]
            if p and not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(f), p))):
                bad.append(f'{f}: {u}')
    return ok_if_empty(bad, 'broken relative links in Markdown')


def k01():
    rd = open('README.md', encoding='utf-8').read()
    _, out = sh('node --test "test/unit/*.test.mjs"')
    m = re.search(r'ℹ tests (\d+)', out)
    n = m.group(1) if m else '?'
    b = re.search(r'unit%20tests-(\d+)', rd)
    return (b and b.group(1) == n, f'README badge {b.group(1) if b else None} vs actual {n}', [])


def l02():
    need = ['vendor/cesium/LICENSE.md', 'vendor/three/LICENSE']
    fonts = [f for f in tracked('vendor/fonts/*')]
    miss = [n for n in need if not os.path.exists(n)]
    if not any('OFL' in f or 'LICENSE' in f.upper() for f in fonts):
        miss.append('vendor/fonts: no OFL licence file')
    return ok_if_empty(miss, 'vendored third-party code without its licence')


def l01():
    credits = open('CREDITS.md', encoding='utf-8').read().lower() + open('DATA_LICENSE.md', encoding='utf-8').read().lower()
    keys = {'ucdp': 'UCDP', 'geipan': 'GEIPAN', 'smithsonian': 'GVP', 'mirta': 'MIRTA', 'openstreetmap': 'OSM', 'wikidata': 'Wikidata',
            'natural earth': 'Natural Earth', 'geonames': 'GeoNames', 'hydrolakes': 'HydroLAKES', 'gebco': 'GEBCO', 'cneos': 'CNEOS',
            'geonucleardata': 'GeoNuclearData', 'usgs': 'USGS', 'eonet': 'EONET', 'pb2002': 'PB2002', 'gem': 'GEM faults',
            'correlates of war': 'COW', 'esri': 'Esri imagery', 'eox': 'EOX Sentinel-2', 'carto': 'CARTO', 'gibs': 'NASA GIBS', 'opengameart': 'audio'}
    miss = [v for k, v in keys.items() if k not in credits]
    return ok_if_empty(miss, 'datasets / providers used by the app but absent from CREDITS.md + DATA_LICENSE.md')


def l03():
    cr = open('CREDITS.md', encoding='utf-8').read()
    miss = [Path(f).name for f in tracked('assets/audio/*') if Path(f).stem.split('_')[0] not in cr and Path(f).name not in cr]
    return ok_if_empty(miss, 'audio files not attributed in CREDITS.md')


def m03():
    from_code = open('src/app_core.js', encoding='utf-8').read()
    cols = re.search(r"export const COMMON =\s*'([^']+)'", from_code).group(1).split(',')
    doc = ''.join(open(f, encoding='utf-8').read() for f in ('docs/data-and-grading.md', 'docs/data-pipeline.md', 'docs/data-sources.md') if os.path.exists(f))
    doc += open('docs/audit/hardening/DATA_DICTIONARY.md', encoding='utf-8').read() if os.path.exists('docs/audit/hardening/DATA_DICTIONARY.md') else ''
    doc += open('docs/data-dictionary.md', encoding='utf-8').read() if os.path.exists('docs/data-dictionary.md') else ''
    miss = [c for c in cols if f'`{c}`' not in doc]
    return ok_if_empty(miss, 'COMMON export columns not defined in a data dictionary')


def _js_items(path, key=None):
    t = open(path, encoding='utf-8').read()
    if key is None:  # data/cases.js: window.GM_CASES = [...]
        return json.loads(t[t.index('['):t.rindex(']') + 1])
    return json.loads(t[t.index(',') + 1:t.rindex(')')])['items']


def d22():
    items = _js_items('data/layers/map_conflicts.js', 'map_conflicts')
    ends = [r['date_high'] for r in items if r.get('date_high')]
    jan1 = sum(1 for d in ends if d.endswith('-01-01'))
    return (jan1 < len(ends) / 2, f'{jan1} of {len(ends)} UCDP conflict end dates fall on 1 January (truncation check, F-D22-1)', [])


def d23():
    import datetime as _dt
    cases = _js_items('data/cases.js')
    bad = []
    for c in cases:
        d = c.get('date', '')
        if not d or d.startswith('-'):
            continue
        try:
            _dt.date.fromisoformat(d)
        except ValueError:
            bad.append(f"{c['id']}: {d}")
    # GEIPAN titles end with the case date (DD.MM.YYYY); where it differs from the observation date both stay as published
    title = [c['id'] for c in cases if c.get('date_precision') == 'day' and (m := re.search(r'(\d\d)\.(\d\d)\.(\d{4})\s*$', c.get('name', '')))
             and f'{m[3]}-{m[2]}-{m[1]}' != c.get('date')]
    return (not bad, f'{len(bad)} case dates that are not calendar dates (F-D23-1); {len(title)} GEIPAN titles whose date differs from the observation date (F-D23-2, kept as published)', bad + title[:20])


def d24():
    cases = _js_items('data/cases.js')
    bad = [f"{c['id']}: {k}={c[k]}" for c in cases for k in ('postal_code', 'witness_count', 'count') if re.fullmatch(r'-?\d+\.0+', str(c.get(k, '')))]
    bad += [f"{c['id']}: postal_code={c['postal_code']}" for c in cases if 'INSEE' in str(c.get('coord_source', '')) and not re.fullmatch(r'\d{5}', str(c.get('postal_code', '00000')))]
    return ok_if_empty(bad, 'integer fields with a spreadsheet float tail or a French postal code without 5 digits (F-D24-1)')


def d25():
    return ok_if_empty([c['id'] for c in _js_items('data/cases.js') if not c.get('dataset')], 'public cases without a dataset label (F-D25-1)')


def q04():
    hits = grep(r'^\s*import pickle|^\s*from pickle|pickle\.(load|dump)', [f for f in tracked('*.py') if not f.endswith('hardening_passes.py')])
    return ok_if_empty(hits, 'pickle uses in the Python pipeline (cmeta now JSON, F-C12-1)')


def k08():
    doc = open('docs/architecture.md', encoding='utf-8').read()
    files = [f for f in tracked('src/*.js') + tracked('src/**/*.js')]
    miss = sorted({f for f in files if f'`{f[4:]}`' not in doc and f'`{os.path.basename(f)}`' not in doc
                   and not (f.startswith('src/cesium/') and '`cesium/*`' in doc)})
    return ok_if_empty(miss, 'src/ files missing from the architecture module index (F-K08-1)')


def n01():
    want = ['README.md', 'LICENSE', 'DATA_LICENSE.md', 'CHANGELOG.md', 'CITATION.cff', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md',
            'SECURITY.md', 'SUPPORT.md', 'CREDITS.md', '.github/CODEOWNERS', '.github/ISSUE_TEMPLATE/bug_report.yml',
            '.github/ISSUE_TEMPLATE/feature_request.yml', '.github/ISSUE_TEMPLATE/config.yml', '.github/workflows/ci.yml',
            '.github/workflows/codeql.yml', '.github/workflows/pages.yml', '.github/workflows/release.yml', '.gitignore',
            '.editorconfig', '.gitattributes', '.nvmrc', 'package-lock.json', 'docs/repo-checklist.md', 'docs/architecture.md',
            'docs/adr/0001-cesium-renderer.md', 'eslint.config.js', '.prettierignore']
    miss = [w for w in want if w not in set(tracked())]
    return ok_if_empty(miss, f'of {len(want)} checklist files missing')


def n02():
    bad = [f for f in tracked() if re.search(r'(^|/)\.github/(dependabot\.ya?ml|pull_request_template\.md|PULL_REQUEST_TEMPLATE)', f)]
    return ok_if_empty(bad, 'bot / PR files present against the no-PR, no-bot policy')


def o01():
    p = set(x.strip().rstrip('/') for x in open('.prettierignore') if x.strip() and not x.startswith('#'))
    e = set(re.findall(r"'([^']+)/'", open('eslint.config.js').read()))
    return (True, f'eslint ignores {sorted(e)}; prettier ignores {sorted(p)}', sorted(e ^ {x for x in p if '.' not in x}))


def o02():
    eng = json.load(open('package.json'))['engines']['node']
    ver = set(re.findall(r'node-version:\s*(\S+)', ''.join(open(f).read() for f in tracked('.github/workflows/*.yml'))))
    nv = open('.nvmrc').read().strip() if os.path.exists('.nvmrc') else None
    return (ver <= {'22', str(nv)} if nv else len(ver) == 1, f'engines {eng}; workflows {sorted(ver)}; .nvmrc {nv}', [])


def p01():
    rc, out = sh('npm outdated --json')
    try:
        d = json.loads(out or '{}')
    except Exception:
        d = {}
    rows = [f"{k}: {v.get('current')} → wanted {v.get('wanted')} / latest {v.get('latest')}" for k, v in d.items()]
    return (True, f'{len(rows)} outdated devDependencies (majors decided per finding)', rows)


def p02():
    pkg = json.load(open('package.json'))['devDependencies']
    corpus = '\n'.join(open(f, encoding='utf-8').read() for f in text_files(['src/', 'scripts/', 'test/']) + ['eslint.config.js'])
    corpus += json.dumps(json.load(open('package.json'))['scripts'])
    unused = [d for d in pkg if d not in corpus]
    return ok_if_empty(unused, 'devDependencies not referenced by src/, scripts/ or test/')


def q01():
    rc, out = sh('python3 -m compileall -q ' + ' '.join(tracked('*.py')))
    return (rc == 0, 'compileall exit %d' % rc, out.splitlines()[:10])


def q02():
    rc, out = sh('ruff check --select F,E9 --output-format concise ' + ' '.join(tracked('*.py')))
    lines = [ln for ln in out.splitlines() if ':' in ln and not ln.startswith('Found')]
    return (rc == 0, f'ruff F,E9: {len(lines)} problems', lines[:30])


def q03():
    rc, out = sh('python3 -m unittest discover -s test/py -p "test_*.py"')
    m = re.search(r'Ran (\d+) tests?', out)
    return (rc == 0, (m.group(0) if m else 'no Python tests') + (' OK' if rc == 0 else ' FAILED'), out.splitlines()[-5:])


# ---------------------------------------------------------------- registry
A, M = 'auto', 'manual'
PASSES = [
    # id, layer, lens, scope, kind, fn-or-note, slow
    ('A01', 'A', 'Index completeness', 'every tracked file vs index.csv', A, a01, False),
    ('A02', 'A', 'Large files and working-tree hygiene', 'all tracked files', A, a02, False),
    ('A03', 'A', 'Role classification', 'index.csv roles', A, a03, False),
    ('B01', 'B', 'ESLint (recommended + project rules)', 'src/, scripts/, test/', A, b01, True),
    ('B02', 'B', 'Prettier formatting', 'whole repo (minus ignores)', A, b02, True),
    ('B03', 'B', 'Bundle reproducibility', 'src/ -> js/app.js', A, b03, True),
    ('B04', 'B', 'Unit tests', 'test/unit/*.test.mjs', A, b04, True),
    ('B05', 'B', 'Dead-code markers', 'src/', A, b05, False),
    ('B06', 'B', 'Debug leftovers', 'src/, css/, index.html', A, b06, False),
    ('B07', 'B', 'Dynamic import literal paths', 'src/', A, b07, False),
    ('B08', 'B', 'Unchecked JSON.parse', 'src/', A, b08, False),
    ('B09', 'B', 'Unguarded localStorage', 'src/', A, b09, False),
    ('B10', 'B', 'Popup-blocked window.open', 'src/', A, b10, False),
    ('B11', 'B', 'Calendar maths review', 'src/geo.js (proleptic Gregorian, BCE, NDAYS)', M, 'Read every line. dateToDay/civil verified against known anchors by unit tests; NDAYS is a fixed constant (2026-11-11) presented in the UI as "latest dated case" (F-B11-1). dateToDay accepts out-of-range month/day silently (validated upstream by validate_data.py; decided).', False),
    ('B12', 'B', 'Statistics review', 'src/stats.js', M, 'Read every line. Haversine, Wilson, Monte Carlo (+1 correction), permutation test and bootstrap verified; DBSCAN expansion uses Array.includes (O(n^3) worst case, F-B12-1); weightedSampler with all-zero weights returns item 0 (F-B12-2).', False),
    ('B13', 'B', 'Grade classifier review', 'src/grades.js vs every grade string in data', M, 'Every raw grade string in data/cases.js and data/layers/*.js run through gradeClass(). "Origin note (nearby case CIT)" classed as CIT (F-B13-1); "unofficial"/"non-official" would class as Official record (F-B13-2).', False),
    ('B14', 'B', 'Marker rule review', 'src/ui/symbology.js, src/layers.js shapeFn, src/app.js buildCases', M, 'Pins only for exact_site/within_1km confirmed for cases and QWM layers. Case circle default radius is 10 km for every precision while layers use locality 10 / region 100 / unspecified 25 (F-B14-1, conflict with glossary).', False),
    ('B15', 'B', 'Workspace import / export review', 'src/ui_panels.js workspace()/restore()', M, 'restore() trusts the file: no try/catch around JSON.parse, no shape or range checks, camera spread of undefined throws, localStorage unguarded (F-B15-1).', False),
    ('B16', 'B', 'CSV / GeoJSON export review', 'src/app_core.js toCSV, exportCases', M, 'toCSV quotes on [",\\n] but not \\r, and does not neutralise spreadsheet formulas (=,+,-,@) from third-party text (F-B16-1).', False),
    ('B17', 'B', 'Omnibox / search review', 'src/ui_panels.js search, prepCases._search', M, 'Search is case-folded but not accent-folded: "nurnberg" does not find "Nürnberg" (F-G01-1).', False),
    ('B18', 'B', 'Timeline bounds review', 'src/geo.js NDAYS vs data max date, ui_timeline setDay clamp', M, 'Latest public case 2026-04-25 <= NDAYS; no unit test guards that a future data refresh stays inside the timeline (F-B11-1).', False),
    ('B19', 'B', 'Dossier review', 'src/ui_panels.js caseHTML/refHTML/printable', M, 'Every interpolation reviewed: escaped. Printable view calls w.document.write on a possibly null popup (F-B10-1); stray row("Dataset", "") call (F-B05-2); reference-layer dossiers have no Coord. source row (F-D15-1); nearby() counts forts and gendarmerie as military (F-D11-1).', False),
    ('B20', 'B', 'Layer build review', 'src/layers.js normItem/buildPoints/buildGed/hydroTiles', M, 'Read every line. Dead block `if (l.id === "hydrolakes") { const f = colorFn; void f; }` (F-B05-1). Live layers are not time-filtered (correct).', False),
    ('B21', 'B', 'Listener leaks in render paths', 'src/', A, b21, False),
    ('B22', 'B', 'Boot path review', 'src/app.js boot()', M, 'A WebGL / Cesium construction failure only writes one line to #status; no visible, accessible error with a recovery hint (F-H01-1).', False),
    ('C01', 'C', 'CSP vs hosts actually fetched', 'index.html CSP, src/', A, c01, False),
    ('C02', 'C', 'HTML sink inventory', 'src/ innerHTML / insertAdjacentHTML', A, c02, False),
    ('C03', 'C', 'Attribute interpolation audit', 'src/ href/src templates', A, c03, False),
    ('C04', 'C', 'Markdown sanitizer review', 'src/ui_misc.js safeHTML + marked', M, 'Allow-list of URL schemes and removal of active elements/attributes reviewed; sound, but untested and SECURITY.md describes it as "<script> removal" (F-C04-1, F-K02-2).', False),
    ('C05', 'C', 'Reverse tabnabbing', 'src/, index.html', A, c05, False),
    ('C06', 'C', 'Code-execution sinks', 'src/', A, c06, False),
    ('C07', 'C', 'Secret scan', 'every tracked text file incl. vendor', A, c07, False),
    ('C08', 'C', 'Workflow permissions', '.github/workflows', A, c08, False),
    ('C09', 'C', 'Action pinning', '.github/workflows', A, c09, False),
    ('C10', 'C', 'npm audit', 'package-lock.json', A, c10, True),
    ('C11', 'C', 'Lockfile integrity', 'package-lock.json', A, c11, False),
    ('C12', 'C', 'Python risky calls', 'all tracked .py', A, c12, False),
    ('C13', 'C', 'Debug globals', 'src/app.js window.__*', M, 'window.__case/__open/__pick/__fly/__globe and window.GMAPP are test hooks used by Playwright; a static site with no secrets or accounts, so exposure has no confidentiality impact (F-C13-1, decided).', False),
    ('C14', 'C', 'actionlint + shellcheck', '.github/workflows, *.sh', A, c14, False),
    ('C15', 'C', 'Cesium ion independence', 'src/, index.html', A, c15, False),
    ('C16', 'C', 'XSS via data fields (dossier, hover card, omnibox, feed, charts)', 'all src/ templates that interpolate row fields', M, 'Grepped every ${...} that reads a row field (name, summary, notes, source_*, place, country, witnesses, id, ...) and opened each in context: all go through esc()/link()/textContent or Cesium label text. No unescaped data field reaches innerHTML.', False),
    ('D01', 'D', 'CSV schema validation', 'data/sources/**/*.csv(.gz)', A, d01, True),
    ('D02', 'D', 'coord_precision vocabulary', 'data/cases.js', A, d02, False),
    ('D03', 'D', 'source_url present and http(s)', 'data/cases.js', A, d03, False),
    ('D04', 'D', 'coord_source present', 'data/cases.js', A, d04, False),
    ('D05', 'D', 'Coordinate ranges / null island', 'data/cases.js', A, d05, False),
    ('D06', 'D', 'Duplicate ids', 'data/cases.js', A, d06, False),
    ('D07', 'D', 'Dates ISO, ranges, low <= high', 'data/cases.js', A, d07, False),
    ('D08', 'D', 'BCE handling in the pipeline', 'data/build_data.py norm_date, case sort', M, 'A first case sort with key (False, date) looked lexicographic for BCE rows, but a later numeric sort overrides it, so it was redundant dead code, not a mis-sort (F-D08-1, removed). norm_date fallback pulls any 3-4 digit run out of free text and accepts month 13 / day 45 (F-D08-2).', False),
    ('D09', 'D', 'Grade vocabulary mapping', 'data/cases.js grades -> gradeClass', A, d09, False),
    ('D10', 'D', 'NUFORC privacy', 'tracked tree, public data, site package', A, d10, False),
    ('D11', 'D', 'Gendarmerie excluded from analysis', 'src/ (analysis, hotspots, dossier nearby), data/build_data.py', M, 'ui_analysis, ui_hotspots and build_data.nearest_military exclude fort/gendarmerie; the dossier "Nearest reference sites" (nearby()) does not (F-D11-1).', False),
    ('D12', 'D', 'Never jitter', 'src/ map code', A, d12, False),
    ('D13', 'D', 'Stacked identical coordinates', 'data/cases.js', M, '44 cases share 48.8589,2.347 (Paris commune centroid, GEIPAN locality) — correct per never-jitter; drawn as one circle with a count badge (F-D13-1, decided).', False),
    ('D14', 'D', 'Reference-layer provenance', 'data/layers/*.js', M, 'Every QWM row has source_url + coord_source. 46 GeoNuclearData reactors have no row URL; the dataset-level citation is shown (F-D14-1, decided).', False),
    ('D15', 'D', 'coord_source shown on click', 'cases, QWM layers, reference layers', M, 'Cases and QWM rows show it; reference layers (volcanoes, reactors, military, fireballs, GED) show none (F-D15-1).', False),
    ('D16', 'D', 'Wikidata placeholder artefacts', 'data/layers, data/cases.js', A, d16, False),
    ('D17', 'D', 'Radius defaults by precision', 'build_data PREC, layers PR, app_core _r, glossary', M, 'build_data writes coord_radius_km for every public case (PREC table), so the 10 km fallback in prepCases is only reached by private/local rows; it still contradicts PREC for region (100) and unspecified (25) (F-B14-1).', False),
    ('D18', 'D', 'Source URL liveness record', 'data/url_status.js, docs/audit/url_status.csv', M, 'url_status.js checked date reviewed; re-checking 2.6k URLs from the box is not cheap and some hosts block bots, so the stored check is kept and its date is shown in the UI (F-D18-1, decided).', False),
    ('D19', 'D', 'Private data in aggregates', 'data/catalog.js', M, 'catalog.js carries aggregate NUFORC distance statistics (no rows, no identifiers) from the analysis briefing (F-D10-1, decided).', False),
    ('D20', 'D', 'Source -> built row reconciliation', 'data/sources/qwm vs data/layers', A, d20, False),
    ('D21', 'D', 'Spreadsheet float years in QWM snapshot', 'data/sources/qwm/*.csv.gz', M, '38 date cells written as floats ("1723.0", "-2480.0") by the upstream export; norm_date reads them correctly as years and the validator warns (F-D21-1, decided: snapshot is kept byte-identical to the cited drop).', False),
    ('D22', 'D', 'Datetime truncation', 'data/layers/map_conflicts.js', A, d22, False),
    ('D23', 'D', 'Date precision vs date', 'data/cases.js', A, d23, False),
    ('D24', 'D', 'Integer text artefacts', 'data/cases.js', A, d24, False),
    ('D25', 'D', 'Dataset label on every case', 'data/cases.js', A, d25, False),
    ('E01', 'E', 'axe-core WCAG 2.2 AA', 'every UI view at 1920x1080', M, 'npm run test:a11y (Step 4 re-verification).', False),
    ('E02', 'E', 'UI audit --check 1280x800', 'all views', M, 'node test/ui_audit.mjs --check (Step 4).', False),
    ('E03', 'E', 'UI audit --check 1920x1080', 'all views', M, 'node test/ui_audit.mjs --check (Step 4).', False),
    ('E04', 'E', 'UI audit --check 3840x2160', 'all views', M, 'node test/ui_audit.mjs --check (Step 4).', False),
    ('E05', 'E', 'Shortcut collisions', 'src/ui/shortcuts.js', M, 'Covered by test/unit/shortcuts.test.mjs (unique keys, every key has a handler).', False),
    ('E06', 'E', 'Icon-button names', 'index.html', A, e06, False),
    ('E07', 'E', 'Reduced motion', 'css/tokens.css, src/globe_cesium.js, cinema', M, 'prefers-reduced-motion and the in-app setting both zero --dur-* and make flights instant; boot error state added in this audit respects it (no animation).', False),
    ('E08', 'E', 'Document metadata', 'index.html', A, e08, False),
    ('F01', 'F', 'Render-on-demand budget', 'test/perf.mjs', M, 'node test/perf.mjs (Step 4).', False),
    ('F02', 'F', 'Bundle composition', 'js/app.js inputs', A, f02, True),
    ('F03', 'F', 'Algorithmic complexity', 'src/stats.js dbscan, kde; src/ui_hotspots.js', M, 'DBSCAN seed expansion de-duplicated with Array.includes -> Set (F-B12-1).', False),
    ('F04', 'F', 'Large tracked files', 'all tracked files', A, f04, False),
    ('G01', 'G', 'Accent-insensitive search', 'src/app_core.js, src/ui_panels.js', M, 'See B17 (F-G01-1).', False),
    ('G02', 'G', 'Explicit locale formatting', 'src/', A, g02, False),
    ('G03', 'G', 'Portable paths', 'all tracked paths', A, g03, False),
    ('G04', 'G', 'Trojan Source characters', 'all tracked text (minus vendor)', A, g04, False),
    ('G05', 'G', 'Time zones', 'src/ui/clock.js, docs', M, 'Clocks use Intl with America/Los_Angeles and derive PST/PDT from the offset (unit-tested in clock.test.mjs); data dates are civil dates with no zone, documented as such.', False),
    ('H01', 'H', 'Boot failure UX', 'src/app.js', M, 'See B22 (F-H01-1).', False),
    ('H02', 'H', 'Live-feed failure states', 'src/live_feeds.js, src/ui/feed.js', M, 'Errors set state=error with a Refresh action; memo is cleared on failure so a retry refetches. Sound.', False),
    ('H03', 'H', 'Tile-failure fallback', 'src/globe_cesium.js _watchErrors', M, 'Streaming basemap errors switch to the bundled offline basemap with a status message. Sound.', False),
    ('H04', 'H', 'file:// mode', 'launch.cmd, src/loader.js', M, 'Data is JS (GM.reg) so file:// works with no fetch; launch.cmd passes --allow-file-access-from-files. Sound.', False),
    ('H05', 'H', 'Absent private data', 'src/app.js', M, 'Missing data/private/*.js rejects and falls back to [] (one 404 in the network log on Pages; no console error). Sound.', False),
    ('I01', 'I', 'Module test coverage map', 'src/ vs test/unit', A, i01, False),
    ('I02', 'I', 'Regression tests for every bug fixed here', 'test/unit, test/py', M, 'Each bug in findings.csv cites its test (see the fix column).', False),
    ('I03', 'I', 'Full smoke test', 'test/smoke.mjs', M, 'Detached run in Step 4, log in /workspace/gma16/.', False),
    ('I04', 'I', 'Test determinism', 'seeded RNGs in analysis and tests', M, 'stats.rng(seed) everywhere in analysis; cinema starfield uses Math.random (visual only); ui_misc randomCase is a user "surprise me" action. Sound.', False),
    ('J01', 'J', 'Job timeouts', '.github/workflows', A, j01, False),
    ('J02', 'J', 'Concurrency groups', '.github/workflows', M, 'CI and Pages have concurrency groups; Release runs once per tag; CodeQL is idempotent. Sound.', False),
    ('J03', 'J', 'CI gate scope', 'ci.yml vs npm run check', M, 'CI runs lint, unit, data, build-diff, smoke. a11y/perf/ui_audit are release gates run locally (SwiftShader minutes) (F-J03-1, decided). Python lint was not in CI (F-Q02-1).', False),
    ('J04', 'J', 'Release workflow', 'release.yml', M, 'Uses RELEASE_NOTES_<tag>.md when present, else CHANGELOG; SC2086 unquoted zip path (F-C14-1).', False),
    ('J05', 'J', 'Pages artefact contents', 'pages.yml + scripts/package.mjs', M, 'Excludes data/private, data/tools, data/sources, *.py. package.mjs walks the filesystem rather than git ls-files, so a local zip can pick up untracked files (F-J05-1).', False),
    ('K01', 'K', 'README test badge vs actual', 'README.md', A, k01, True),
    ('K02', 'K', 'SECURITY.md accuracy', 'SECURITY.md vs index.html CSP, safeHTML, versions', M, 'Supported versions table says 1.0.x (F-K02-1); CSP and Markdown sanitiser descriptions are stale (F-K02-2).', False),
    ('K03', 'K', 'CITATION.cff validity', 'CITATION.cff', A, k03, False),
    ('K04', 'K', 'CHANGELOG structure', 'CHANGELOG.md', M, 'Keep a Changelog headings, newest first, one section per tag; compare links checked.', False),
    ('K05', 'K', 'Relative links', 'every tracked .md', A, k05, False),
    ('K06', 'K', 'Version consistency', 'package.json, lockfile, index.html, CITATION.cff, CHANGELOG', A, k06, False),
    ('K07', 'K', 'Glossary vs code', 'src/glossary.js', M, 'Uncertainty-circle definition matched against code after the radius fix (F-B14-1).', False),
    ('K08', 'K', 'Architecture doc vs tree', 'docs/architecture.md vs src/', A, k08, False),
    ('K09', 'K', 'Data-sources doc vs live endpoints', 'docs/data-sources.md vs src/live_feeds.js, src/cesium/sources.js', M, 'USGS 4.5_month, EONET v3 open/60 d, Esri/EOX/OSM/CARTO/GIBS/Terrarium endpoints match.', False),
    ('L01', 'L', 'Dataset attribution coverage', 'CREDITS.md + DATA_LICENSE.md', A, l01, False),
    ('L02', 'L', 'Vendored licences', 'vendor/', A, l02, False),
    ('L03', 'L', 'Audio attribution', 'assets/audio vs CREDITS.md', A, l03, False),
    ('L04', 'L', 'Imagery attribution on screen', 'Cesium credit container, basemap status', M, 'Every basemap passes its credit to Cesium credits and to the status line on switch. Sound.', False),
    ('L05', 'L', 'Share-alike obligations', 'OSM-derived military, GeoNuclearData (ODbL)', M, 'DATA_LICENSE.md states ODbL for OSM and GeoNuclearData derived layers and keeps them as separate databases. Sound.', False),
    ('M01', 'M', 'Methodology document', 'docs/data-and-grading.md, docs/convergence.md', M, 'Present; grading policy, baselines and convergence score documented.', False),
    ('M02', 'M', 'Limitations and threats to validity', 'docs/', M, 'Limitations were scattered across docs; no single section on reporting bias, geocoding bias, multiple comparisons, confounding (F-M02-1, fixed: docs/limitations.md).', False),
    ('M03', 'M', 'Data dictionary', 'COMMON export columns', A, m03, False),
    ('M04', 'M', 'Statistical reporting', 'ui_analysis, stats', M, 'Seeds, iterations and one-sided p are shown; Analyze prints a Bonferroni threshold for its baseline tests (src/ui_analysis.js) and the Data panel battery gives Holm-adjusted p (src/pdf7_stats.js holm). No finding; an earlier draft note claiming no correction was wrong and is withdrawn.', False),
    ('M05', 'M', 'Citation metadata', 'CITATION.cff', M, 'See K03 (F-K03-1).', False),
    ('N01', 'N', 'Checklist files present', 'repo root, .github', A, n01, False),
    ('N02', 'N', 'No-bot / no-PR policy files', '.github', A, n02, False),
    ('O01', 'O', 'ESLint vs Prettier ignore lists', 'eslint.config.js, .prettierignore', A, o01, False),
    ('O02', 'O', 'Node version pins', 'package.json engines, workflows, .nvmrc', A, o02, False),
    ('O03', 'O', 'Breakpoints CSS vs JS', 'src/ui/breakpoints.js', M, 'Covered by test/unit/breakpoints.test.mjs.', False),
    ('P01', 'P', 'Outdated dependencies', 'package.json', A, p01, True),
    ('P02', 'P', 'Unused dependencies', 'package.json', A, p02, False),
    ('Q01', 'Q', 'Python byte-compile', 'all tracked .py', A, q01, False),
    ('Q02', 'Q', 'Python lint (ruff F, E9)', 'all tracked .py', A, q02, False),
    ('Q03', 'Q', 'Python unit tests', 'test/py', A, q03, False),
    ('Q04', 'Q', 'Pipeline determinism / pickle', 'data/tools/*.py', A, q04, False),
]


def main():
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    skip_slow = '--skip-slow' in sys.argv
    prev = {}
    if (OUT / 'passes_run.json').exists():
        prev = {r['id']: r for r in json.load(open(OUT / 'passes_run.json'))['passes']}
    res, fails = [], []
    for pid, layer, lens, scope, kind, fn, slow in PASSES:
        r = {'id': pid, 'layer': layer, 'lens': lens, 'scope': scope, 'kind': kind}
        if kind == A and (not only or pid in only) and not (skip_slow and slow):
            try:
                okk, summary, detail = fn()
            except Exception as e:  # a pass that crashes is a failed pass, never a silent skip
                okk, summary, detail = False, f'pass crashed: {e!r}', []
            r.update(ok=bool(okk), summary=summary, detail=[str(d)[:220] for d in detail])
            print(f"{pid} {'ok  ' if okk else 'FAIL'} {lens}: {summary}")
            if not okk:
                fails.append(pid)
        elif kind == A and pid in prev:
            r.update({k: prev[pid].get(k) for k in ('ok', 'summary', 'detail')})
        elif kind == M:
            r.update(ok=None, summary=fn, detail=[])
        res.append(r)
    tmp = OUT / 'passes_run.json.tmp'  # atomic: a crash while writing never leaves a truncated record behind
    with open(tmp, 'w') as fh:
        json.dump({'passes': res}, fh, indent=1, ensure_ascii=False)
    os.replace(tmp, OUT / 'passes_run.json')
    write_md(res)
    print(f'{len(PASSES)} passes in the catalogue ({sum(p[4] == A for p in PASSES)} auto, {sum(p[4] == M for p in PASSES)} manual); '
          f'failing auto passes: {fails or "none"}')
    return 1 if fails else 0


def write_md(res):
    L = ['# Hardening pass catalogue', '',
         'Generated by `python3 scripts/audit/hardening_passes.py` from the registry in that script. Each pass is one lens '
         'applied to one scope. **auto** passes are executed by the script (raw output: [passes_run.json](passes_run.json)); '
         '**manual** passes are line-by-line reviews whose record is the note below and the rows in [findings.csv](findings.csv).',
         '',
         f'**{len(res)} distinct passes** ({sum(r["kind"] == A for r in res)} auto, {sum(r["kind"] == M for r in res)} manual). '
         'The request asked for up to 200; this catalogue counts only passes that were actually defined and executed, '
         'and does not pad the number by re-running the same lens.', '']
    L += ['## Contents', ''] + [f'- [{k}. {v}](#{k.lower()}-{re.sub(r"[^a-z0-9]+", "-", v.lower()).strip("-")})' for k, v in LAYERS.items()]
    for k, v in LAYERS.items():
        L += ['', f'## {k}. {v}', '', '| Pass | Lens | Scope | Kind | Result |', '|---|---|---|---|---|']
        for r in res:
            if r['layer'] != k:
                continue
            if r['kind'] == A:
                state = {True: 'clean', False: 'findings', None: 'not run'}[r.get('ok')]
                out = f"{state}: {r.get('summary', '')}"
            else:
                out = r['summary']
            out = str(out).replace('|', '\\|').replace('\n', ' ')
            L.append(f"| {r['id']} | {r['lens']} | {r['scope'].replace('|', '/')} | {r['kind']} | {out} |")
    (OUT / 'PASSES.md').write_text('\n'.join(L) + '\n')


if __name__ == '__main__':
    sys.exit(main())
