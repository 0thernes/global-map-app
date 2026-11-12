#!/usr/bin/env python3
"""Audit pass 1 (provenance): check every source_url / coord_source URL in the public QWM snapshot and the local case
CSV, plus a small sample of the private (NUFORC) rows if present. Polite: one request per domain at a time with a 1.5 s
gap, 12 domains in parallel, HEAD first then GET, 20 s timeout, identifying User-Agent. Failed URLs get an archive.org
Wayback alternate when one exists. Nothing is deleted; results feed docs/audit/pass-01.md and the in-app 'live source'
depth measure (data/url_status.js).
Usage: python3 scripts/audit/check_urls.py [--limit N]
"""
import csv, gzip, glob, json, os, random, sys, threading, time, urllib.parse, urllib.request, collections, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = 'global-map-app-audit/1.0 (+https://0thernes.art; polite link checker)'
OUT_CSV = os.path.join(ROOT, 'docs', 'audit', 'url_status.csv')
OUT_JS = os.path.join(ROOT, 'data', 'url_status.js')


def collect():
    urls = collections.defaultdict(lambda: {'rows': 0, 'datasets': set(), 'ids': []})
    def add(u, ds, rid):
        u = (u or '').strip()
        if not u.startswith('http'):
            return
        e = urls[u]; e['rows'] += 1; e['datasets'].add(ds)
        if len(e['ids']) < 5: e['ids'].append(rid)
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'sources', 'qwm', '*.csv.gz'))):
        ds = os.path.basename(f)[:-7]
        for r in csv.DictReader(gzip.open(f, 'rt', encoding='utf-8')):
            add(r.get('source_url'), ds, r.get('id')); add(r.get('coord_source'), ds + ':coord_source', r.get('id'))
    local = os.path.join(ROOT, 'data', 'sources', 'qwm_uap_cases.csv')
    if os.path.exists(local):
        for r in csv.DictReader(open(local, encoding='utf-8')):
            add(r.get('source_url'), 'local', r.get('id'))
    # NUFORC sample (private rows; only checked, never published)
    priv = '/workspace/qwm/wiw/data/map/map_uap_cit.csv'
    if os.path.exists(priv):
        rows = [r for r in csv.DictReader(open(priv, encoding='utf-8')) if 'NUFORC' in (r.get('dataset') or '')]
        random.Random(42).shuffle(rows)
        for r in rows[:40]:
            add(r.get('source_url'), 'NUFORC sample (private)', r.get('id'))
    return urls


locks = collections.defaultdict(threading.Lock)
last = {}


def fetch(u, method):
    req = urllib.request.Request(u, method=method, headers={'User-Agent': UA, 'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            if method == 'GET':
                r.read(2048)
            return r.status, r.geturl(), ''
    except urllib.error.HTTPError as e:
        return e.code, u, ''
    except Exception as e:  # DNS, TLS, timeout
        return 0, u, type(e).__name__ + ': ' + str(e)[:120]


def check(u):
    dom = urllib.parse.urlsplit(u).netloc.lower()
    with locks[dom]:
        gap = 1.5 - (time.time() - last.get(dom, 0))
        if gap > 0: time.sleep(gap)
        st, final, err = fetch(u, 'HEAD')
        if st in (0, 400, 401, 403, 405, 406, 429, 500, 501, 502, 503) or st >= 400:
            time.sleep(1.0)
            st2, final2, err2 = fetch(u, 'GET')
            if st2: st, final, err = st2, final2, err2
            elif not st: err = err2 or err
        last[dom] = time.time()
    return u, st, final, err


def wayback(u):
    try:
        q = 'https://archive.org/wayback/available?url=' + urllib.parse.quote(u, safe='')
        with urllib.request.urlopen(urllib.request.Request(q, headers={'User-Agent': UA}), timeout=30) as r:
            j = json.load(r)
        s = j.get('archived_snapshots', {}).get('closest')
        return (s or {}).get('url', '') if (s or {}).get('available') else ''
    except Exception:
        return ''


def classify(st, err):
    if 200 <= st < 400: return 'live'
    if st in (401, 403, 429): return 'blocked'  # bot protection / rate limit: not evidence of death
    if st in (404, 410): return 'dead'
    if st >= 500: return 'server-error'
    if st: return 'http-' + str(st)
    return 'unreachable'


def main():
    lim = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    urls = collect(); keys = sorted(urls)[:lim] if lim else sorted(urls)
    print(f'checking {len(keys)} unique URLs', flush=True)
    res = {}
    with cf.ThreadPoolExecutor(12) as ex:
        for i, (u, st, final, err) in enumerate(ex.map(check, keys)):
            res[u] = (st, final, err)
            if i % 100 == 0: print(i, st, u[:90], flush=True)
    rows = []
    for u in keys:
        st, final, err = res[u]; cls = classify(st, err)
        alt = wayback(u) if cls in ('dead', 'unreachable', 'server-error') else ''
        if alt: time.sleep(0.5)
        e = urls[u]
        rows.append({'url': u, 'status': st, 'class': cls, 'final_url': final if final != u else '', 'error': err, 'wayback': alt,
                     'rows': e['rows'], 'datasets': ';'.join(sorted(e['datasets'])), 'example_ids': ';'.join(x for x in e['ids'] if x)})
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    pub = {r['url']: 1 if r['class'] in ('live', 'blocked') else 0 for r in rows if 'private' not in r['datasets']}
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// generated by scripts/audit/check_urls.py: 1 = live or bot-blocked (exists), 0 = dead/unreachable\n')
        f.write('window.GM_URL_STATUS = ' + json.dumps({'checked': time.strftime('%Y-%m-%d'), 'urls': pub}, separators=(',', ':')) + ';\n')
    c = collections.Counter(r['class'] for r in rows)
    print(json.dumps(c), 'wayback alternates:', sum(1 for r in rows if r['wayback']))


if __name__ == '__main__':
    main()
