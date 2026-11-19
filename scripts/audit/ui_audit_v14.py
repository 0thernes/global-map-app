#!/usr/bin/env python3
"""Build docs/audit/v1.4-ui-audit.md and .csv: v1.3.0 against v1.4.0.

Two kinds of finding, each with exactly one label (bug, error, issue, problem, dilemma, conflict):

* measured: the checks in test/ui_audit.mjs on both builds at 1280x800, 1920x1080 and 3840x2160 (metrics.json under
  <shots>/<phase>/<vp>/). v1.3 is captured with its own script (same measurements) plus a v1.4-script pass for the
  32 px chrome check (--chrome). Every measured finding on either side is listed with its v1.4 status.
* review: findings from the heuristic and ergonomic review of v1.3 against the OSINT-console brief (ADR 0004). They
  are kept in REVIEW below with the evidence and what v1.4 did.

Usage: python3 scripts/audit/ui_audit_v14.py [--shots ../gma-ui-shots14] [--before before] [--chrome v13chrome] [--after after]
"""
import argparse
import csv
import json
import os
from collections import Counter, defaultdict

LABELS = ['bug', 'error', 'issue', 'problem', 'dilemma', 'conflict']
VPS = ['1280x800', '1920x1080', '3840x2160']
SHORT = {'1280x800': '1280', '1920x1080': '1920', '3840x2160': '4K'}

# label per measured check: a broken layout is a bug, an accessibility failure is an error, nested scroll bars are a
# problem (they work but fight each other), sizes below the house minimum are issues
CHECKS = {
    'overlap': ('bug', 'high', 'layout', 'Docked parts overlap'),
    'cut': ('bug', 'high', 'clipping', 'Control clipped or off screen'),
    'nested': ('problem', 'medium', 'scrolling', 'Nested scroll region (double scroll bars)'),
    'tiny': ('issue', 'medium', 'typography', 'Text under 12 px'),
    'small': ('issue', 'medium', 'targets', 'Target under 24 px (WCAG 2.5.8)'),
    'chrome': ('issue', 'low', 'targets', 'Console control under 32 px at comfortable density'),
    'axe': ('error', 'high', 'accessibility', 'axe-core violation'),
    'failed': ('bug', 'high', 'layout', 'View cannot be opened'),
}

# Review findings. key, label, severity, category, finding, evidence in v1.3, status in v1.4, what v1.4 did
REVIEW = [
    ('ia', 'problem', 'high', 'information architecture',
     'No information architecture: 13 views and 9 tools share one top row with no grouping',
     'v1.3 top bar: Layers … Briefings, then lasso, random, shot, export, settings, help, mute in one strip; '
     'icon-only below 1760 px with no group cues',
     'fixed', 'Activity bar with Explore / Analyze / Reference groups and key hints; utilities stay in the command bar'),
    ('status', 'problem', 'high', 'situational awareness',
     'No status line: the analyst cannot see how many rows are in view, of which grade, or how fresh the data is',
     'v1.3 showed one total at the top of the rail, with no grade breakdown, no build date and no feed state',
     'fixed', 'Status strip: rows by grade in grade colours, data build date and age, live-feed dots'),
    ('clock', 'issue', 'medium', 'situational awareness',
     'No reference clock; dates in the feeds and timeline are UTC but nothing on screen says so',
     'no clock anywhere in v1.3', 'fixed', 'UTC and US Pacific (PST/PDT) clocks with tabular numerals'),
    ('legend', 'problem', 'high', 'symbology',
     'No map legend: pin versus uncertainty circle is explained only in Help and the user guide',
     'v1.3 category colours appear only as dots in the Layers tree', 'fixed',
     'Legend on the globe: marker rule, categories with colour, icon and count, grades; K toggles it'),
    ('colour-only', 'issue', 'medium', 'symbology',
     'Categories are told apart by colour alone on the globe, in search results and in dossiers (WCAG 1.4.1 risk)',
     'no category icons in v1.3', 'fixed',
     'One Lucide icon per category from src/ui/symbology.js, used in the legend, dossier, hover card, omnibox and feed'),
    ('omnibox', 'issue', 'medium', 'navigation',
     'Search finds cases, places and reference, but not commands or layers; there is no command palette',
     'v1.3 search listbox: cases, countries, reference', 'fixed',
     'Omnibox (Ctrl+K or /) with Commands, Cases, Places, Layers and Reference groups'),
    ('keys-drift', 'error', 'medium', 'keyboard',
     'Two hand-written key lists (Help and README) and the key handler drifted: README lacked P and 0',
     'README.md v1.3 Keyboard section; src/ui_misc.js handler', 'fixed',
     'One registry (src/ui/shortcuts.js); handler and ? overlay generated from it; unit test checks every key has a handler'),
    ('hover', 'issue', 'medium', 'globe',
     'The hover tooltip has no grade, category or coordinate source, so the analyst must click to judge a point',
     'v1.3 #tooltip shows the name, date and coord_precision', 'fixed', 'Hover card: icon, title, date, grade, pin or circle, coord source'),
    ('selection', 'problem', 'medium', 'globe',
     'The open case has no marker on the globe; after panning, the analyst loses which point the dossier describes',
     'v1.3 draws nothing for the selection', 'fixed',
     'Amber selection reticle that follows the case and is sized to its uncertainty circle'),
    ('clusters', 'issue', 'low', 'globe',
     'Cluster badges show one colour, so a mixed cluster looks like a single category',
     'v1.3 badge colour = majority category', 'fixed', 'Ring split by category share (top 5 plus other); 1.2k-style counts'),
    ('provenance', 'problem', 'medium', 'dossier',
     'The dossier splits provenance: the source link sits below the summary, PDF 7 and conflict blocks, the grade is a '
     'bare letter, and precision is a ± km figure that does not say pin or circle',
     'v1.3 caseHTML: key-value table (date, place, coordinates, grade), summary, PDF 7, conflicts, then Sources',
     'fixed',
     'Provenance block first: source and domain, grade and meaning, coord source, precision, coordinates, date'),
    ('feed', 'problem', 'medium', 'situational awareness',
     'No activity feed: live USGS and EONET events appear only as globe layers, and there is no session history',
     'v1.3 live layers have no list view', 'fixed', 'Activity feed (N): Live and Recent tabs'),
    ('density', 'issue', 'medium', 'ergonomics',
     'One density only; many console controls are 24 px, the WCAG minimum, not a comfortable desktop target',
     'v1.3 --ctl-sm 24 px for timeline, rail and window controls', 'fixed',
     'Comfortable density by default (32 px); compact (24 px) on U'),
    ('hc', 'issue', 'low', 'accessibility',
     'No high-contrast theme for bright rooms or low vision', 'v1.3 has one dark theme', 'fixed',
     'High-contrast theme on X: black, white borders, yellow accent and focus ring'),
    ('toast', 'issue', 'low', 'layout',
     'The status toast sits just above the timeline, where it covers a bottom-docked window',
     'measured v1.3 overlaps #datap x #status and #reference x #status at 1280x800', 'fixed',
     'Status toast moved to the top centre of the free globe area'),
    ('4k', 'dilemma', 'medium', 'layout',
     'At 3840x2160 and 100 % zoom, should the console scale up or show more globe?',
     'v1.3 deferred this (v1.3 audit dilemma)', 'decided',
     '1.25x token ladder at 2560 px and wider; the globe still gains area. Revisit if users run 4K at 150 % OS scaling'),
    ('ctrlk', 'conflict', 'medium', 'keyboard',
     'Ctrl+K is the browser shortcut for the address-bar search in Chrome, Edge and Firefox',
     'standard browser binding', 'decided',
     'The app takes Ctrl+K while it has focus (the console convention); / does the same for anyone who wants the browser key'),
    ('k-tour', 'conflict', 'low', 'keyboard',
     'K pauses the tour (cinema) but also toggles the legend', 'src/cinema.js capture-phase handler', 'decided',
     'While the tour runs, the tour handler wins; otherwise K is the legend. Documented in the registry'),
    ('right-docks', 'dilemma', 'medium', 'layout',
     'Two right-docked windows (dossier and feed) tile side by side and take 780 px at 1920',
     'v1.4 full-console view', 'open',
     'Kept: stacking them would halve the dossier height. Alex to decide whether the feed should share the dossier column'),
    ('rail-trunc', 'dilemma', 'low', 'layout',
     'Long layer names in the rail are truncated with an ellipsis at 288 px', 'rail at 1280x800', 'open',
     'Full names are in the tooltip and the layer info. A wider rail costs globe width'),
    ('legend-1280', 'dilemma', 'low', 'layout',
     'At 1280x800 with a bottom dock, the legend has little room above it', 'console_full at 1280x800', 'decided',
     'Category and grade sections fold below 960 px tall; the marker rule always shows'),
    ('clock-live', 'dilemma', 'low', 'accessibility',
     'Should the ticking clocks be an aria-live region?', 'v1.4 #clocks', 'decided',
     'No: a live region that changes every second floods screen readers. The clocks are a labelled group read on demand'),
    ('feed-offline', 'dilemma', 'low', 'situational awareness',
     'The Live feed needs the network; offline or on file:// it is empty', 'USGS and EONET are fetched live', 'decided',
     'Each feed shows its state (loading, n items, or unavailable with the reason) and the tab says the feeds need a network; nothing is cached or invented'),
]


def load(shots, phase):
    out = {}
    for vp in VPS:
        p = os.path.join(shots, phase, vp, 'metrics.json')
        if os.path.exists(p):
            out[vp] = json.load(open(p))
    return out


OVERLAY_SEL = ('#search-results', '#lowerthird', '#tooltip', '#tip', '.menu', '#export-menu')


def normalise(M, extra):
    """Before metrics come from the v1.3 capture script, whose measurements are the same except that it does not flag
    intended overlays or measure 32 px chrome. Flag overlays from the box list (aria-modal dialogs, menus, the search
    list, tooltips, the tour caption) and merge chromeSmall from a v1.4-script pass over the same build (extra)."""
    for vp, views in M.items():
        for view, m in views.items():
            if m.get('failed'):
                continue
            modal = {b['sel'] for b in m.get('boxes', []) if b.get('modal') == 'true'}
            for o in m.get('overlaps', []):
                if 'ok' not in o:
                    o['ok'] = any(x in modal or x.startswith(OVERLAY_SEL) for x in (o['a'], o['b']))
            e = extra.get(vp, {}).get(view)
            if e and not e.get('failed') and 'chromeSmall' not in m:
                m['chromeSmall'] = e.get('chromeSmall', [])
    return M


def measured(M):
    """(check, key) -> {views, vps, detail}"""
    F = {}

    def add(check, key, detail, view, vp):
        f = F.setdefault((check, key), dict(views=set(), vps=set(), detail=detail))
        f['views'].add(view)
        f['vps'].add(vp)

    for vp, views in M.items():
        for view, m in views.items():
            if m.get('failed'):
                add('failed', view, m['failed'].splitlines()[0][:160], view, vp)
                continue
            for o in m.get('overlaps', []):
                if o.get('ok'):
                    continue
                add('overlap', tuple(sorted([o['a'], o['b']])), f"{o['w']}x{o['h']} px", view, vp)
            for c in m.get('cut', []):
                add('cut', c.split(' [')[0], c, view, vp)
            for s in m.get('scrolls', []):
                if s.get('anc'):
                    add('nested', (s['sel'], s['anc']), f"{s['sel']} inside {s['anc']}", view, vp)
            for t in m.get('tinyEx', [])[: m.get('tiny', 0)]:
                add('tiny', t.rsplit(' ', 1)[0], t, view, vp)
            for t in m.get('small', []):
                add('small', t.rsplit(' ', 1)[0], t, view, vp)
            for t in m.get('chromeSmall', []) or []:
                add('chrome', t.rsplit(' ', 1)[0], t, view, vp)
            for a in m.get('axe', []) or []:
                add('axe', a['id'], f"{a['id']} ({a.get('impact')}, {a.get('n')} nodes)", view, vp)
    return F


def counts(M, only=None):
    c = defaultdict(Counter)
    for vp, views in M.items():
        for view, m in views.items():
            if only is not None and view not in only.get(vp, ()):
                continue
            if m.get('failed'):
                c[vp]['failed'] += 1
                continue
            c[vp]['views'] += 1
            c[vp]['overlap'] += sum(1 for o in m.get('overlaps', []) if not o.get('ok'))
            c[vp]['cut'] += len(m.get('cut', []))
            c[vp]['nested'] += sum(1 for s in m.get('scrolls', []) if s.get('anc'))
            c[vp]['tiny'] += m.get('tiny', 0)
            c[vp]['small'] += m.get('nSmall', len(m.get('small', [])))
            c[vp]['chrome'] += len(m.get('chromeSmall', []) or [])
            c[vp]['axe'] += sum(a.get('n', 1) for a in m.get('axe', []) or [])
    return c


def md(s):
    return str(s).replace('|', '\\|').replace('\n', ' ')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='../gma-ui-shots14')
    ap.add_argument('--before', default='before')
    ap.add_argument('--chrome', default='v13chrome', help='v1.4-script pass over v1.3 for the 32 px check')
    ap.add_argument('--after', default='after')
    a = ap.parse_args()
    B, A = normalise(load(a.shots, a.before), load(a.shots, a.chrome)), load(a.shots, a.after)
    if not A:
        raise SystemExit(f'no after metrics under {a.shots}/{a.after}')
    FB, FA = measured(B), measured(A)
    common = {vp: set(B.get(vp, {})) & set(A.get(vp, {})) for vp in VPS}
    CB, CA = counts(B, common), counts(A, common)

    rows = []
    for k, label, sev, cat, title, ev, status, fix in REVIEW:
        rows.append(dict(id='', source='review', label=label, severity=sev, category=cat, finding=title,
                         evidence_v1_3=ev, status_v1_4=status, fix_v1_4=fix, views='', viewports=''))
    for key in sorted(set(FB) | set(FA), key=lambda k: (k[0], str(k[1]))):
        check, item = key
        label, sev, cat, title = CHECKS[check]
        f = FA.get(key) or FB.get(key)
        inb, ina = key in FB, key in FA
        status = 'open' if ina else 'fixed'
        if ina and not inb:
            status = 'open (new in v1.4)'
        views = sorted((FB.get(key, {}).get('views', set()) | FA.get(key, {}).get('views', set())))
        vps = sorted((FB.get(key, {}).get('vps', set()) | FA.get(key, {}).get('vps', set())), key=VPS.index)
        rows.append(dict(id='', source='measured', label=label, severity=sev, category=cat,
                         finding=f"{title}: {item if isinstance(item, str) else ' x '.join(item)}",
                         evidence_v1_3=(FB[key]['detail'] if inb else 'not raised on v1.3'),
                         status_v1_4=status, fix_v1_4=(FA[key]['detail'] if ina else ''),
                         views=';'.join(views), viewports=';'.join(vps)))
    order = {l: i for i, l in enumerate(LABELS)}
    sevo = {'high': 0, 'medium': 1, 'low': 2}
    rows.sort(key=lambda r: (order[r['label']], sevo[r['severity']], r['source'], r['category']))
    for i, r in enumerate(rows, 1):
        r['id'] = f'V14-{i:03d}'

    os.makedirs('docs/audit', exist_ok=True)
    with open('docs/audit/v1.4-ui-audit.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    by = Counter(r['label'] for r in rows)
    open_rows = [r for r in rows if r['status_v1_4'].startswith('open')]
    L = ['# UI audit v1.4: v1.3.0 against the v1.4.0 OSINT console', '',
         'Generated by `scripts/audit/ui_audit_v14.py` from `test/ui_audit.mjs` metrics. Both builds were measured with '
         'the same checks at 1280x800, 1920x1080 and 3840x2160 (Playwright, SwiftShader, DPR 1, axe-core 4.11 '
         'WCAG 2.0 / 2.1 / 2.2 A + AA). Review findings come from a heuristic and ergonomic review of v1.3 against the '
         'OSINT-console brief; see [ADR 0004](../adr/0004-osint-console-information-architecture.md) and the '
         '[wireframes](../design/wireframes/README.md).', '',
         'Every finding has exactly one label:', '',
         '| Label | Meaning here |', '|---|---|',
         '| bug | the layout is broken: overlap, clipping, a view that cannot open |',
         '| error | a rule is violated: an axe / WCAG failure, or two sources of truth that disagree |',
         '| issue | works, but below the house standard (sizes, missing cue, colour-only encoding) |',
         '| problem | a missing capability that the analyst workflow needs |',
         '| dilemma | a trade-off with no free answer; the decision taken is recorded |',
         '| conflict | two rules or conventions collide; the resolution is recorded |', '',
         '## Totals', '',
         f'**{len(rows)} findings**: ' + ', '.join(f'{by[l]} {l}' for l in LABELS) + '.', '',
         f"Status in v1.4: {sum(1 for r in rows if r['status_v1_4'] == 'fixed')} fixed, "
         f"{sum(1 for r in rows if r['status_v1_4'] == 'decided')} decided, {len(open_rows)} open.", '',
         '| Label | review | measured | total |', '|---|---:|---:|---:|']
    for l in LABELS:
        rv = sum(1 for r in rows if r['label'] == l and r['source'] == 'review')
        ms = sum(1 for r in rows if r['label'] == l and r['source'] == 'measured')
        L.append(f'| {l} | {rv} | {ms} | {rv + ms} |')
    L += ['', '## Measured checks, v1.3 → v1.4', '',
          'Counts summed over the views measured on both builds at each size, with the same script. The v1.4-only '
          'views (omnibox, hover card, legend, feed, compact, high contrast, full console) are in the findings table '
          'and in the gate (`npm run audit:ui -- --check`).', '',
          '| Check | ' + ' | '.join(SHORT[v] for v in VPS) + ' |', '|---|' + '---|' * len(VPS)]
    for c in ['views', 'failed', 'overlap', 'cut', 'nested', 'tiny', 'small', 'chrome', 'axe']:
        name = {'views': 'views measured', 'failed': 'views that failed to open', 'overlap': 'overlaps (docked parts)',
                'cut': 'clipped controls', 'nested': 'nested scroll regions', 'tiny': 'text nodes < 12 px',
                'small': 'targets < 24 px', 'chrome': 'console controls < 32 px', 'axe': 'axe violation nodes'}[c]
        L.append(f'| {name} | ' + ' | '.join(f"{CB[v][c] if v in CB else '–'} → **{CA[v][c] if v in CA else '–'}**"
                                            for v in VPS) + ' |')
    L += ['', '## Findings', '',
          '| ID | Label | Sev | Category | Finding | v1.3 evidence | v1.4 | Seen at |', '|---|---|---|---|---|---|---|---|']
    for r in rows:
        seen = ', '.join(SHORT.get(v, v) for v in r['viewports'].split(';') if v)
        nv = len([v for v in r['views'].split(';') if v])
        seen = f"{seen} ({nv} view{'s' if nv != 1 else ''})" if nv else 'review'
        stx = r['status_v1_4'] + (': ' + r['fix_v1_4'] if r['fix_v1_4'] else '')
        L.append(f"| {r['id']} | {r['label']} | {r['severity']} | {r['category']} | {md(r['finding'])} | "
                 f"{md(r['evidence_v1_3'])} | {md(stx)} | {seen} |")
    if open_rows:
        L += ['', '## Open', '']
        L += [f"- {r['id']} ({r['label']}): {md(r['finding'])}. {md(r['fix_v1_4'])}" for r in open_rows]
    open('docs/audit/v1.4-ui-audit.md', 'w').write('\n'.join(L) + '\n')
    print(len(rows), 'findings', dict(by), 'open', len(open_rows))


if __name__ == '__main__':
    main()
