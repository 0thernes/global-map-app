#!/usr/bin/env python3
"""Build docs/audit/v1.5-ui-audit.md and .csv: v1.4.0 against v1.5.0.

Two kinds of finding, each with exactly one label (bug, error, issue, problem, dilemma, conflict):

* measured: the checks in test/ui_audit.mjs (overlaps, clipping, nested scroll, text under 12 px, targets under
  24 px, chrome under 32 px, axe-core) on both builds at 1280x800, 1920x1080 and 3840x2160, read from
  <shots>/<phase>/<vp>/metrics.json. v1.4.0 is captured from a v1.4.0 worktree with the v1.5 view list.
* review: the v1.5 review of the globe, visuals, ergonomics and system design against the owner's brief (ADR 0005),
  kept in REVIEW below with the evidence in v1.4 and what v1.5 did.

Usage: python3 scripts/audit/ui_audit_v15.py [--shots ../gma-ui-shots15]
"""
import argparse
import csv
import importlib.util
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('v14', os.path.join(HERE, 'ui_audit_v14.py'))
v14 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v14)
LABELS, VPS, SHORT, CHECKS = v14.LABELS, v14.VPS, v14.SHORT, v14.CHECKS
SEV = {'high': 0, 'medium': 1, 'low': 2}

# key, label, severity, category, finding, evidence in v1.4, status in v1.5, what v1.5 did
REVIEW = [
    ('grid', 'problem', 'high', 'geographic reference',
     'No latitude/longitude reference on the globe: coordinates in the hover card cannot be related to the map',
     'v1.4 draws coastlines and borders only; no graticule at any zoom',
     'fixed', 'Adaptive graticule (J): 30° in orbit to 0.25° at street level, labels at the view centre; '
     'equator and Greenwich brighter (src/cesium/graticule.js, src/cesium/reference.js)'),
    ('terminator', 'problem', 'medium', 'geographic reference',
     'Day/night is shaded but nothing marks sunrise/sunset or twilight, which matter for a sighting\'s observing '
     'conditions', 'v1.4 Cesium lighting only; no line, no twilight limits',
     'fixed', 'Terminator (Y) in amber plus dashed civil, nautical and astronomical twilight rings for the timeline '
     'date; unit-tested against the sub-solar point'),
    ('grade-on-map', 'issue', 'high', 'symbology',
     'Evidence grade is not visible on the map; only the hover card and dossier say it',
     'v1.4 pin sprite: one ring + core for every grade', 'fixed',
     'Ring gauge: arc length = grade weight (full CIT / official, 3/4 ST, 1/2 testimony, 1/4 online / other), '
     'CIT halo; colour-independent; legend draws the same glyphs'),
    ('circle-vs-pin', 'problem', 'high', 'symbology',
     'From orbit an uncertainty circle (filled disc, solid edge) reads as a large pin, against the pin-vs-circle rule',
     'v1.4 circle: 15 % fill, solid 80 % edge', 'fixed',
     'Dashed edge (every other chord of a 48-gon), 7 % fill; radius still the stated uncertainty, never jittered'),
    ('centre-dot', 'issue', 'medium', 'symbology',
     'The centre of an imprecise row is a soft dot that looks like a small precise point',
     'v1.4 shape 2: radial-gradient dot', 'fixed', 'Hollow diamond centre mark, distinct from the pin core'),
    ('flight-time', 'issue', 'medium', 'motion',
     'Every fly-to takes the same 1.6 s cubic curve, from a 50 km hop to the antipode',
     'src/globe_cesium.js v1.4 flyTo: duration = ms / 1000, CUBIC_IN_OUT', 'fixed',
     'planFlight: duration from angle and log altitude change (0.35–3.4 s), easing per hop, unit-tested'),
    ('flight-apex', 'issue', 'low', 'motion',
     'Long flights skim the surface instead of rising, so the user loses context mid-flight',
     'no maximumHeight in v1.4 flyTo', 'fixed', 'Apex height ~0.55 x arc length for hops over ~20°, capped at 22,000 km'),
    ('states-live', 'error', 'medium', 'accessibility',
     'Loading and failure messages are plain paragraphs: screen readers do not announce them (WCAG 4.1.3)',
     'v1.4 feed / data / analysis / hotspots: <p class="muted">Loading…</p>', 'fixed',
     'src/ui/states.js: role=status (aria-busy while loading) or role=alert for errors'),
    ('states-recover', 'issue', 'medium', 'states',
     'When both live feeds fail there is no way to retry from the feed panel',
     'v1.4 feed: "No live events loaded" text only', 'fixed', 'Error state names the failing feed and offers Try again'),
    ('states-consistent', 'issue', 'low', 'states',
     'Each panel words and styles loading, empty and failed differently',
     'five hand-written variants in v1.4', 'fixed', 'One markup and style for the three states; unit-tested'),
    ('bp-900', 'conflict', 'medium', 'responsive',
     'At exactly 900 px CSS and JS disagree about bottom sheets: CSS max-width: 900px includes 900, JS uses < 900',
     'css/components.css @media (max-width: 900px); src/ui/window.js NARROW = 900 with innerWidth < NARROW',
     'fixed', 'src/ui/breakpoints.js is the one list; all media queries use range syntax; a test rejects strays'),
    ('bp-drift', 'issue', 'low', 'responsive',
     'Breakpoint numbers are repeated by hand in three stylesheets and two scripts',
     '1439 / 1440, 1759 / 1760 and 2560 written separately in css/*.css, window.js and icons.js',
     'fixed', 'BREAKPOINTS imported by window.js and icons.js; CSS checked by test/unit/breakpoints.test.mjs'),
    ('focus-forced', 'error', 'medium', 'accessibility',
     'Keyboard focus disappears in Windows forced-colors mode: the ring is a box-shadow only (WCAG 2.4.7)',
     ':focus-visible { outline: none; box-shadow: var(--focus) } in v1.4', 'fixed',
     '@media (forced-colors: active) gives :focus-visible a 2 px CanvasText outline'),
    ('focus-dup', 'issue', 'low', 'design system',
     'The focus ring is declared twice (app.css and components.css) with different radii',
     'two :focus-visible rules in v1.4', 'fixed', 'Declared once in css/tokens.css'),
    ('rm-tokens', 'issue', 'low', 'motion',
     'The in-app Reduced motion setting kills animations but leaves the motion tokens at full length',
     'only @media (prefers-reduced-motion) zeroed --dur-*', 'fixed', 'body.reduced-motion zeroes --dur-1..4'),
    ('rm-flash', 'issue', 'medium', 'motion',
     'Under reduced motion the time-lapse arrival flash still scales markers up to 2.5x',
     'src/globe_cesium.js v1.4 _alpha: scale = 1 + fl * 1.5 always', 'fixed',
     'Scale stays 1 under reduced motion (alpha still carries time); otherwise the flash eases out (fl^1.6)'),
    ('heat-tool', 'issue', 'low', 'ergonomics',
     'The density heatmap is reachable only by H or a layer row, not from the map tools',
     'v1.4 map tools: home, lasso, random, legend', 'fixed',
     'Map tools: home, lasso, random | grid, terminator, heatmap | legend; pressed state in accent colour'),
    ('night-lights', 'problem', 'medium', 'visuals',
     'City lights on the night side are too dim to read settlements from orbit',
     'Black Marble layer brightness 1.4, default contrast', 'fixed', 'Brightness 1.7, contrast 1.25, gamma 0.9 (keyless GIBS)'),
    ('atmo-wash', 'issue', 'low', 'visuals',
     'The ground atmosphere washes streamed imagery blue at mid altitudes',
     'Cesium defaults (light intensity 10, no saturation shift)', 'fixed',
     'Ground atmosphere intensity 11, saturation −0.1; sky limb +0.06 brightness, −0.08 saturation'),
    ('globe-size', 'problem', 'low', 'engineering',
     'src/globe_cesium.js is over 1,000 lines and mixes imagery, layers, effects, camera and overlays',
     '1,068 lines at v1.4.0', 'fixed (partly)',
     'Overlays moved to src/cesium/reference.js; geometry and flight maths in pure modules; imagery and layers stay '
     'for a later split'),
    ('glyph-in-pin', 'dilemma', 'medium', 'symbology',
     'Category glyphs inside each globe pin would add information but are illegible at 21 px and need a raster per '
     'category', 'proposed in the v1.5 brief', 'decided',
     'Not drawn on the globe; the glyph stays in the legend, hover card, feed and dossier (ADR 0005 §4)'),
    ('grade-colour', 'dilemma', 'medium', 'symbology',
     'A coloured grade ring would fight the category tint (one billboard has one tint) or double the billboards',
     '2,624 case billboards; per-frame alpha on time-aware layers', 'decided',
     'Grade is encoded by arc length (shape), category by colour; no second billboard'),
    ('grid-labels', 'dilemma', 'low', 'geographic reference',
     'Grid labels at the screen edge collide with the rail, docks and map tools; labels at the view centre sit over data',
     'n/a (new in v1.5)', 'decided',
     'Labels along the parallel and meridian nearest the view centre, small, outlined, offset from the crossing'),
    ('refraction', 'dilemma', 'low', 'geographic reference',
     'The terminator is geometric (90°); atmospheric refraction (~0.83°) moves the visible sunrise line',
     'n/a (new in v1.5)', 'decided',
     'Keep the geometric line and say so in the label and ADR; the twilight rings bound the uncertainty'),
    ('tools-height', 'conflict', 'low', 'layout',
     'Three more map tools make the column about 130 px taller; at 1280x800 it competes with the legend chip',
     'n/a (new in v1.5)', 'decided',
     'Kept: the --check run at 1280x800 reports no overlap; the column ends above the legend chip'),
    ('hc-overlays', 'issue', 'low', 'accessibility',
     'In the high-contrast theme the grid and terminator keep their normal translucent colours',
     'n/a (new in v1.5)', 'fixed',
     'REF_COLORS.hc: opaque white / yellow overlays while body.theme-hc is set; normal palette mirrors --ref-* (unit test)'),
    ('wireframes', 'issue', 'low', 'documentation',
     'The v1.4 wireframes show four map tools and no panel states',
     'docs/design/wireframes v1.4', 'fixed',
     '12 v1.5 wireframes incl. globe reference and panel states; v1.4 set archived'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='../gma-ui-shots15')
    a = ap.parse_args()
    B = v14.normalise(v14.load(a.shots, 'before'), {})
    A = v14.normalise(v14.load(a.shots, 'after'), {})
    if not A:
        raise SystemExit(f'no after metrics under {a.shots}/after')
    FB, FA = v14.measured(B), v14.measured(A)
    rows = []
    n = 0
    both = {vp: set(B.get(vp, {})) & set(A.get(vp, {})) for vp in VPS}
    for key in sorted(set(FB) | set(FA), key=lambda k: (SEV[CHECKS[k[0]][1]], str(k))):
        check = key[0]
        lab, sev, cat, title = CHECKS[check]
        fb, fa = FB.get(key), FA.get(key)
        # a before-only finding counts as fixed only if v1.5 measured the same view at the same size
        if fb and not fa:
            if not any(v in both.get(vp, ()) for v in fb['views'] for vp in fb['vps']):
                continue
            status = 'fixed'
        else:
            status = 'open' if fb else 'new (open)'
        f = fa or fb
        n += 1
        rows.append(dict(id=f'V15-{n:03d}', source='measured', label=lab, severity=sev, category=cat,
                         finding=f'{title}: {key[1] if isinstance(key[1], str) else " / ".join(key[1])}',
                         evidence_v1_4=(fb or {}).get('detail', 'not present'), status_v1_5=status,
                         fix_v1_5='' if status != 'fixed' else 'not reproduced in v1.5 at the same view and size',
                         views=';'.join(sorted(f['views'])), viewports=';'.join(sorted(f['vps']))))
    for k, lab, sev, cat, finding, ev, status, fix in REVIEW:
        assert lab in LABELS, k
        n += 1
        rows.append(dict(id=f'V15-{n:03d}', source='review', label=lab, severity=sev, category=cat, finding=finding,
                         evidence_v1_4=ev, status_v1_5=status, fix_v1_5=fix, views='', viewports=''))
    os.makedirs('docs/audit', exist_ok=True)
    with open('docs/audit/v1.5-ui-audit.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    by = Counter(r['label'] for r in rows)
    st = Counter(r['status_v1_5'].split(' ')[0] for r in rows)
    cB, cA = v14.counts(B, both), v14.counts(A, both)
    cAll = v14.counts(A)
    L = [
        '# v1.5 UI audit: v1.4.0 → v1.5.0',
        '',
        'Generated by `scripts/audit/ui_audit_v15.py` from `test/ui_audit.mjs` metrics (Playwright, SwiftShader, DPR 1, '
        'axe-core 4.11 WCAG 2.0 / 2.1 / 2.2 A + AA) at 1280x800, 1920x1080 and 3840x2160. v1.4.0 was captured from a '
        'v1.4.0 worktree with the v1.5 view list, so both columns show the same camera and the same view. Review '
        'findings come from the v1.5 review of the globe, visuals, ergonomics and system design against the owner\'s '
        'brief; see [ADR 0005](../adr/0005-globe-visual-system.md) and the [wireframes](../design/wireframes/README.md). '
        'Every finding has exactly one label: bug, error, issue, problem, dilemma or conflict.',
        '',
        '## Summary',
        '',
        f'- **{len(rows)} findings**: ' + ', '.join(f'{by[l]} {l}' for l in LABELS if by[l]) + '.',
        '- **Status:** ' + ', '.join(f'{v} {k}' for k, v in st.most_common()) + '.',
        '- Open bugs or errors: '
        + str(sum(1 for r in rows if r['label'] in ('bug', 'error') and r['status_v1_5'].startswith(('open', 'new'))))
        + '.',
        '',
        '## Measured checks',
        '',
        'Views measured on both builds at each size (same script):',
        '',
        '| Size | Views | Overlaps | Clipped | Nested scroll | Text < 12 px | Targets < 24 px | Chrome < 32 px | axe nodes |',
        '| ---- | ----: | -------- | ------- | ------------- | ------------ | --------------- | -------------- | --------- |',
    ]
    for vp in VPS:
        if not both.get(vp):
            continue
        b, c = cB[vp], cA[vp]
        cell = lambda k: f'{b[k]} → {c[k]}'
        L.append(f'| {SHORT[vp]} | {c["views"]} | {cell("overlap")} | {cell("cut")} | {cell("nested")} | {cell("tiny")} | '
                 f'{cell("small")} | {cell("chrome")} | {cell("axe")} |')
    L += ['', 'All v1.5 views measured with `--check` (the release gate):', '',
          '| Size | Views | Overlaps | Clipped | Nested scroll | Text < 12 px | Targets < 24 px | Chrome < 32 px | axe nodes | Failed |',
          '| ---- | ----: | -------: | ------: | ------------: | -----------: | --------------: | -------------: | --------: | -----: |']
    for vp in VPS:
        c = cAll.get(vp)
        if not c:
            continue
        L.append(f'| {SHORT[vp]} | {c["views"]} | {c["overlap"]} | {c["cut"]} | {c["nested"]} | {c["tiny"]} | {c["small"]} | '
                 f'{c["chrome"]} | {c["axe"]} | {c["failed"]} |')
    L += ['', '## Findings', '',
          '| ID | Label | Severity | Category | Finding | Evidence in v1.4 | v1.5 status | What v1.5 did | Source |',
          '| -- | ----- | -------- | -------- | ------- | ---------------- | ----------- | ------------- | ------ |']
    md = v14.md
    for r in rows:
        L.append(f'| {r["id"]} | {r["label"]} | {r["severity"]} | {md(r["category"])} | {md(r["finding"])} | '
                 f'{md(r["evidence_v1_4"])} | {md(r["status_v1_5"])} | {md(r["fix_v1_5"])} | {r["source"]} |')
    L += ['', 'CSV: [`v1.5-ui-audit.csv`](v1.5-ui-audit.csv). Screenshots: '
          '[`docs/screenshots/v1.5/`](../screenshots/v1.5/README.md).', '']
    open('docs/audit/v1.5-ui-audit.md', 'w').write('\n'.join(L))
    print(len(rows), 'findings', dict(by), dict(st))


if __name__ == '__main__':
    main()
