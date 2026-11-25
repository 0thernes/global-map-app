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
     'Legend on the globe: marker rule, categories with colour, icon and count, grades; since the polish pass a '
     'collapsed chip with the pin and circle counts, K expands it'),
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
     'Long layer names in the rail are truncated with an ellipsis at 288 px', 'rail at 1280x800', 'decided',
     'Polish pass: short human names that wrap to two lines, a 336 px rail (304 px below 1440, 420 px at 4K); '
     'dataset ids and caveats in the tooltip and the details row (see V14 polish rows)'),
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

# Second front-end review of the v1.4 beta (Alex, 2026-11-18: "improve upgrade better update, especially the front
# end"), from the 1920x1080 beta screenshots and the ui_audit timings. Same columns; the evidence is in the v1.4 beta.
POLISH = [
    ('p-rail-names', 'issue', 'high', 'layer rail',
     'Layer names truncate and leak raw dataset ids and caveats into the label',
     "v1.4 beta: 'Cases (all case laye…', 'Abduction (map_abducti…', 'Labels (LOD: continents t…', "
     "'Lakes: HydroLAKES (>=1…'", 'fixed',
     'Human names (All cases, Place labels, Large lakes …); id, dataset and caveat in the tooltip and the details row; '
     'names wrap to two lines; the six QWM case files fold into one Case source files list'),
    ('p-rail-sliders', 'issue', 'medium', 'layer rail',
     'An always-visible 64 px opacity slider on every row squeezes the label column',
     'v1.4 beta rail: name, slider and (i) on one 288-320 px row', 'fixed',
     'Opacity moves into the row details (sliders icon) with a % read-out; the row keeps name, count and one button'),
    ('p-legend', 'problem', 'high', 'symbology',
     'The legend opens expanded by default and floats over the globe beside the rail',
     'v1.4 beta main view: 330 x 300 px legend over the Atlantic at 1920x1080', 'fixed',
     'Docked bottom-left above the timeline as a collapsed chip that still shows the pin and circle counts; '
     'K or the chip expands it upward; the state is remembered; Settings can hide it'),
    ('p-tl-scale', 'problem', 'high', 'timeline',
     'Nearly all cases sit in a sliver at the right of the histogram (8000 BCE to 2026 on one bar)',
     'v1.4 beta timeline: the post-1940 cases fill the last ~15 % of the width', 'fixed',
     'Focus + context: an overview strip of the whole span with the focus window, and a linear detail track; era '
     'presets (All time, Ancient, 1900-1945, Cold War, 1990-now, Last 10 y), wheel zoom, click the strip to pan; '
     'bins coloured by their dominant category'),
    ('p-tl-controls', 'issue', 'medium', 'timeline',
     'Cramped and cryptic transport row', "v1.4 beta: '-Y -M -D +D +M +Y', '1 year/s' and 'cumulative (fade in)' "
     'selects, no group labels', 'fixed',
     'Labelled groups: a large Play / Pause, Step (−1y … +1y with spoken labels), Speed and Show as segmented '
     'controls with tooltips; captions drop below 1440 px'),
    ('p-hud', 'bug', 'medium', 'layout',
     'The coordinates / altitude read-out sits on the timeline border and overlaps it',
     'v1.4 beta: 28.000°N 35.000°W ALT 14,653 KM drawn over the top edge of the timeline', 'fixed',
     'Read-out moved into the timeline status row with tabular numerals and figure-space padding'),
    ('p-count', 'error', 'medium', 'situational awareness',
     'Two counts with two names: the status strip said rows, the rail said cases',
     "v1.4 beta: '2.6k rows' in the command bar next to '2624 of 2624 cases shown' in the rail", 'fixed',
     "One count, one noun: '2,624 cases' in the strip and '2,624 of 2,624 cases at <date>' in the rail"),
    ('p-gchips', 'issue', 'low', 'situational awareness',
     'Grade chips in the status strip look like controls but do nothing', 'v1.4 beta: span.gchip with cursor: help',
     'fixed', 'Grade chips are toggle buttons (aria-pressed) on the same grade filter as the Filters panel'),
    ('p-clusters', 'bug', 'high', 'globe',
     'Cluster badges in Europe pile on top of each other',
     'v1.4 beta main view: 91, 460, 66, 52, 598, 383, 28, 5 badges overlapping over France, Italy and Germany',
     'fixed', 'Screen-space grid, then a collision pass that merges touching badges into the larger one (unit-tested: '
     'no two badges overlap); radius by log10(count); 1.25x at 4K'),
    ('p-tooltips', 'issue', 'medium', 'navigation',
     'Icon-only activity bar and map tools rely on the native title tooltip (slow, not on keyboard focus)',
     'v1.4 beta: 13 activity icons and 4 map tools with title attributes only', 'fixed',
     'Shared tooltip (role=tooltip, aria-describedby) on hover after 350 ms and at once on keyboard focus, with the '
     'shortcut as a key chip'),
    ('p-glyphs', 'issue', 'low', 'navigation',
     'Single letters under the activity icons read as stray glyphs',
     "v1.4 beta: 'F', 'N', 'B' … in 12 px mono at the icon corner", 'fixed',
     'Removed; the key shows in the tooltip and stays in aria-keyshortcuts'),
    ('p-perf', 'bug', 'high', 'performance',
     'Opening the dossier view in test/ui_audit.mjs took 5,501,793 ms (92 min) at 1920x1080 on SwiftShader',
     'v1.4 beta audit log; other views 15-45 s; a re-run of the same sequence took 29 s, so the stall depends on '
     'load: the page re-rendered the whole globe on every animation frame (about 1 fps after the fly-in) and '
     'starved the capture under CPU contention', 'fixed',
     'Render on demand (Cesium requestRenderMode plus app render requests on state change and input; 2.5 s '
     'heartbeat on software WebGL): an idle globe draws about 6 frames in 10 s; test/perf.mjs and the ui_audit '
     'gate fail a view over its budget, and a 300 s hard limit stops a hang'),
    ('p-hierarchy', 'issue', 'low', 'visual design',
     'Weak panel hierarchy: window headers, rail sections and the legend use the same weight and border',
     'v1.4 beta screenshots', 'fixed',
     'Stronger header band (glass-head, strong rule, 650 weight), section rules in the rail, hover rows, fewer '
     'inner borders; same category colour and icon source for map, legend, charts, timeline bins and dossier'),
    ('p-tl-height', 'dilemma', 'medium', 'layout',
     'The richer timeline needs height the globe gives up', 'timeline 112 px → 160 px at 1080p (200 px at 4K)',
     'decided', 'Accepted: three rows (transport, overview + detail, focus + read-out) at 32 px targets; compact '
     'density brings it to 140 px'),
    ('p-grain', 'dilemma', 'low', 'performance',
     'Render on demand stops the animated lens grain between frames on software WebGL',
     'post-process stage with a time uniform', 'decided',
     'On a real GPU the grain still animates (the lens counts as activity); on software WebGL it updates on the '
     'heartbeat. Performance wins'),
    ('p-cluster-merge', 'dilemma', 'low', 'globe',
     'Merging touching badges makes one badge stand for a wider area', 'collision pass', 'decided',
     'Accepted: overlapping discs could not be read or clicked. Zooming in splits them; the hover card and the '
     'cluster click still list the members'),
    ('p-focus-default', 'dilemma', 'low', 'timeline',
     'Should the timeline open on All time or on a modern focus (1990-now) where most cases are?',
     'distribution of dated cases', 'open',
     'All time for now (nothing hidden on first load); the choice is remembered per browser. Alex to decide the '
     'default'),
    ('p-k-key', 'conflict', 'low', 'keyboard',
     'K used to hide and show the legend; with the chip, hiding it would also hide the pin and circle counts',
     'v1.4 beta K binding', 'decided', 'K expands and collapses; hiding the legend completely is a Settings switch'),
    ('p-title', 'conflict', 'low', 'accessibility',
     'A visible tooltip plus the native title shows two tooltips; removing title loses the browser fallback',
     'src/ui/tips.js', 'decided',
     'The title moves into data-tip when the tooltip layer starts; every icon button keeps its aria-label, so the '
     'accessible name is unchanged'),
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
    for k, label, sev, cat, title, ev, status, fix in POLISH:
        rows.append(dict(id='', source='review (polish)', label=label, severity=sev, category=cat, finding=title,
                         evidence_v1_3=ev, status_v1_4=status, fix_v1_4=fix, views='', viewports=''))
    for key in sorted(set(FB) | set(FA), key=lambda k: (k[0], str(k[1]))):
        check, item = key
        label, sev, cat, title = CHECKS[check]
        inb, ina = key in FB, key in FA
        status = 'open' if ina else 'fixed'
        if ina and not inb:
            status = 'open (new in v1.4)'
        if status == 'fixed' and check == 'small' and isinstance(item, str) and 'label' in item and '> input' in item:
            # not a UI change: v1.4's audit measures a labelled checkbox by its (>= 24 px) label, as WCAG 2.5.8 does
            status = 'fixed (re-measured: the label is the target)'
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
         'OSINT-console brief, plus a second review of the v1.4 beta (the polish pass, `review (polish)` rows); see [ADR 0004](../adr/0004-osint-console-information-architecture.md) and the '
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
         '| Label | review | polish review | measured | total |', '|---|---:|---:|---:|---:|']
    for l in LABELS:
        rv = sum(1 for r in rows if r['label'] == l and r['source'] == 'review')
        pv = sum(1 for r in rows if r['label'] == l and r['source'] == 'review (polish)')
        ms = sum(1 for r in rows if r['label'] == l and r['source'] == 'measured')
        L.append(f'| {l} | {rv} | {pv} | {ms} | {rv + pv + ms} |')
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
        seen = f"{seen} ({nv} view{'s' if nv != 1 else ''})" if nv else r['source']
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
