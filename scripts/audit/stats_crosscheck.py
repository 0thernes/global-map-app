#!/usr/bin/env python3
"""Audit pass 7: independent re-derivation of the hypothesis statistics in Python (numpy), compared with the JS
results dumped by scripts/audit/dump_analysis.mjs. Different code, different RNG: deterministic quantities
(nearest distances, medians, Wilson intervals) must match to rounding; Monte Carlo quantities (p, baseline medians)
must agree within the combined Monte Carlo error of both runs (4 sigma).
Method note: Python resamples n values i.i.d. from the JS baseline pool. For the uniform baseline that is the same
null; for the population-weighted and time-permutation baselines the JS null is paired per case, so with large n the
pooled approximation is narrower and p values can legitimately differ even when every observed distance matches.
Usage: python3 scripts/audit/stats_crosscheck.py /tmp/analysis.json [more.json ...] > docs/audit/pass-07-data.json
"""
import json, math, os, sys, re
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R = 6371.0088


def layer(name):
    s = open(os.path.join(ROOT, 'data', 'layers', name + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index(',') + 1:s.rindex(')')])


def to_day(s):
    """days since 1970-01-01 for 'YYYY', 'YYYY-MM', 'YYYY-MM-DD' (proleptic Gregorian, same convention as dateToDay)."""
    m = re.match(r'^(-?\d{1,6})(?:-(\d\d))?(?:-(\d\d))?', str(s or ''))
    if not m: return math.nan
    y, mo, d = int(m.group(1)), int(m.group(2) or 1), int(m.group(3) or 1)
    # days from civil (H. Hinnant)
    y -= mo <= 2; era = (y if y >= 0 else y - 399) // 400; yoe = y - era * 400
    doy = (153 * (mo + (-3 if mo > 2 else 9)) + 2) // 5 + d - 1; doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468


def hav(lat, lon, la, lo):
    p1, p2 = np.radians(lat), np.radians(la); dl = np.radians(lo - lon)
    h = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * R * np.arcsin(np.minimum(1, np.sqrt(h)))


def wilson(k, n, z=1.96):
    if not n: return [math.nan, math.nan]
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); w = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [(c - w) / d, (c + w) / d]


def main():
    mil = [m for m in layer('military')['items'] if not str(m.get('kind', '')).startswith(('fort', 'gendarmerie'))]
    mlat = np.array([m['lat'] for m in mil]); mlon = np.array([m['lon'] for m in mil])
    ia = np.array([to_day(m.get('inception')) for m in mil]); db = np.array([to_day(m.get('dissolved')) for m in mil])
    nucs = layer('nuclear')['items'] + layer('map_nuclear_sites')['items']
    nlat = np.array([float(n['lat']) for n in nucs]); nlon = np.array([float(n['lon']) for n in nucs])
    ged = layer('ged'); gi = [dict(zip(ged['fields'], r)) for r in ged['events']]
    glat = np.array([g['lat'] for g in gi]); glon = np.array([g['lon'] for g in gi]); gday = np.array([to_day(g['date']) for g in gi])
    report = []
    for path in sys.argv[1:]:
        A = json.load(open(path)); win = A['win']; rows = []
        for c in A['cases']:
            day = to_day(c['date']) if c.get('date') else math.nan
            out = {'id': c['id']}
            d = hav(c['lat'], c['lon'], mlat, mlon)
            ok = ~((~np.isnan(db)) & (db < day)) & ~((~np.isnan(ia)) & (ia > day)) if not math.isnan(day) else np.ones(len(d), bool)
            out['military'] = float(d[ok].min()) if ok.any() else None
            out['nuclear'] = float(hav(c['lat'], c['lon'], nlat, nlon).min())
            okg = np.abs(gday - day) <= win if not math.isnan(day) else np.zeros(len(gday), bool)
            out['conflict'] = float(hav(c['lat'], c['lon'], glat[okg], glon[okg]).min()) if okg.any() else None
            for k in ('military', 'nuclear', 'conflict'):
                js = c['an'].get(k)
                out[k + '_js'] = js
            rows.append(out)
        res = {'file': os.path.basename(path), 'n': A['n'], 'refs': {}}
        for k in ('military', 'nuclear', 'conflict'):
            pairs = [(r[k], r[k + '_js']) for r in rows if r[k] is not None and r[k + '_js'] is not None]
            only_py = sum(1 for r in rows if r[k] is not None and r[k + '_js'] is None)
            only_js = sum(1 for r in rows if r[k] is None and r[k + '_js'] is not None)
            diffs = [abs(a - b) for a, b in pairs]
            py_obs = [r[k] for r in rows if r[k + '_js'] is not None and r[k] is not None]
            J = A['refs'].get(k, {})
            med_py = float(np.median(py_obs)) if py_obs else None
            k50 = sum(1 for x in py_obs if x <= 50)
            # independent Monte Carlo p against the JS baseline pool (resampling n from the pool), numpy PCG64 RNG
            mc = {}
            for bk, B in (J.get('B') or {}).items():
                pool = np.array(B['pool']); n = len(py_obs)
                if n and len(pool):
                    rng = np.random.default_rng(12345); its = 4999
                    stats = np.median(pool[rng.integers(0, len(pool), size=(its, n))], axis=1)
                    p = (np.sum(stats <= med_py) + 1) / (its + 1); se = math.sqrt(p * (1 - p) / its)
                    mc[bk] = {'p_py': round(float(p), 4), 'p_js': round(B['p'], 4), 'mc_se': round(se, 4), 'se_js': round(math.sqrt(max(B['p'] * (1 - B['p']), 1e-4) / A['iters']), 4),
                              'agree': bool(abs(p - B['p']) <= max(0.02, 4 * math.sqrt(se ** 2 + max(B['p'] * (1 - B['p']), 1e-4) / A['iters']) + 2 / (A['iters'] + 1))),
                              'baseline_med_py': round(float(np.median(stats)), 1), 'baseline_med_js': round(B['med'], 1), 'ratio_py': round(med_py / float(np.median(stats)), 3) if np.median(stats) else None, 'ratio_js': round(B['ratio'], 3)}
            res['refs'][k] = {'pairs': len(pairs), 'max_abs_diff_km': round(max(diffs), 4) if diffs else None, 'within_0.5km': sum(1 for x in diffs if x <= 0.5), 'only_py': only_py, 'only_js': only_js,
                              'median_py': round(med_py, 2) if med_py is not None else None, 'median_js': round(J.get('med'), 2) if J.get('med') is not None else None,
                              'w50_py': [round(x, 4) for x in wilson(k50, len(py_obs))], 'w50_js': [round(x, 4) for x in (J.get('w50ci') or [])], 'ci_js': J.get('ci'), 'mc': mc}
        report.append(res)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
