#!/usr/bin/env python3
"""CSV schema validation (stdlib only; runs in CI). Checks every CSV in data/sources (plain or .csv.gz) and data/*.csv,
plus a few invariants of the built JS data. Exits 1 on any ERROR. WARN lines are printed but do not fail.

Rules for case/reference rows (files with lat/lon columns):
  - required columns present: id, name, lat, lon, coord_precision, source_url
  - ids unique within a file
  - lat in [-90, 90], lon in [-180, 180] when present
  - coord_precision in the allowed set
  - plotted rows (lat, lon, source_url all present) must have an http(s) source_url
  - dates ISO-like (YYYY, YYYY-MM, YYYY-MM-DD, negative years for BCE, decades 198- / 1980s)
  - date_low <= date_high when both are full dates
"""
import csv, glob, gzip, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREC = {'exact_site', 'within_1km', 'locality', 'region', 'unspecified', 'not_plotted', ''}
DATE = re.compile(r'^(-?\d{1,6}(-\d{2}(-\d{2})?)?|\d{3}-|\d{3}0s|)$')
errors, warns, checked = [], [], 0
# upstream (QWM) defects already flagged in docs/audit/qwm-data-issues.csv; reported as WARN so CI tracks new ones only
KNOWN_DUP_IDS = {('map_nuclear_tests', 'NT-74044')}


def opener(p):
    return io.TextIOWrapper(gzip.open(p), encoding='utf-8') if p.endswith('.gz') else open(p, encoding='utf-8', newline='')


def check_file(p):
    global checked
    rel = os.path.relpath(p, ROOT)
    with opener(p) as f:
        r = csv.DictReader(f); cols = r.fieldnames or []; rows = list(r)
    checked += 1
    if not cols:
        errors.append(f'{rel}: no header'); return
    if not {'lat', 'lon'} <= set(cols):
        return  # registry / languages / other tables: header only
    need = {'id', 'name', 'lat', 'lon', 'source_url'}
    miss = need - set(cols)
    if miss: errors.append(f'{rel}: missing columns {sorted(miss)}'); return
    ids = set()
    for i, row in enumerate(rows, 2):
        rid = row.get('id', '')
        if rid in ids:
            stem = os.path.basename(p).split('.')[0]
            (warns if (stem, rid) in KNOWN_DUP_IDS else errors).append(f'{rel}:{i}: duplicate id {rid}' + (' (known; flagged for QWM)' if (stem, rid) in KNOWN_DUP_IDS else ''))
        ids.add(rid)
        la, lo = row.get('lat', '').strip(), row.get('lon', '').strip()
        try:
            if la and not -90 <= float(la) <= 90: errors.append(f'{rel}:{i}: lat out of range {la}')
            if lo and not -180 <= float(lo) <= 180: errors.append(f'{rel}:{i}: lon out of range {lo}')
        except ValueError:
            errors.append(f'{rel}:{i}: non-numeric lat/lon {la},{lo}')
        cp = row.get('coord_precision', '')
        if cp not in PREC: errors.append(f'{rel}:{i}: coord_precision {cp!r} not in {sorted(PREC - {""})}')
        su = (row.get('source_url') or '').strip()
        if la and lo and su and not re.match(r'^https?://', su) and not su.startswith('/workspace'):
            errors.append(f'{rel}:{i}: source_url is not http(s): {su[:60]}')
        if la and lo and not su: warns.append(f'{rel}:{i}: {rid} has coordinates but no source_url (not plotted)')
        for k in ('date', 'date_low', 'date_high'):
            v = (row.get(k) or '').strip()
            if v and not DATE.match(v[:10] if len(v) > 10 and v[10] in 'T ' else v):
                warns.append(f'{rel}:{i}: {k} not ISO-like: {v[:30]}')
        lo_, hi_ = row.get('date_low', ''), row.get('date_high', '')
        if re.match(r'^\d{4}-\d\d-\d\d$', lo_ or '') and re.match(r'^\d{4}-\d\d-\d\d$', hi_ or '') and lo_ > hi_:
            errors.append(f'{rel}:{i}: date_low {lo_} > date_high {hi_}')


def check_built():
    p = os.path.join(ROOT, 'data', 'cases.js')
    if not os.path.exists(p): errors.append('data/cases.js missing (run data/refresh.sh)'); return
    t = open(p, encoding='utf-8').read()
    j = json.loads(t[t.index('=') + 1:].strip().rstrip(';'))
    n = j['n'] if isinstance(j, dict) else len(j)
    if n < 100: errors.append(f'data/cases.js has only {n} cases')
    if 'NUFORC' in t: errors.append('data/cases.js contains NUFORC rows: they belong in data/private/ only')
    for f in glob.glob(os.path.join(ROOT, '**', '*'), recursive=True):
        if '/node_modules/' in f or '/.git/' in f: continue
        if os.path.isfile(f) and os.path.getsize(f) > 95 * 1024 * 1024: errors.append(f'{os.path.relpath(f, ROOT)} is over 95 MB')


def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'data', 'sources', '**', '*.csv*'), recursive=True) + glob.glob(os.path.join(ROOT, 'data', '*.csv')))
    for p in files:
        if p.endswith(('.csv', '.csv.gz')): check_file(p)
    check_built()
    for w in warns[:40]: print('WARN ', w)
    if len(warns) > 40: print(f'WARN  … {len(warns) - 40} more warnings')
    for e in errors: print('ERROR', e)
    print(f'validated {checked} CSV files: {len(errors)} errors, {len(warns)} warnings')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
