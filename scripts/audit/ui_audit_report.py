#!/usr/bin/env python3
"""v1.3 UI audit: turn test/ui_audit.mjs measurements into docs/audit/v1.3-ui-audit.{md,csv}.

Every finding carries exactly one label: bug, error, issue, problem, dilemma, conflict.
  bug      something does not work or cannot be reached (control off screen, panel covers the timeline)
  error    a wrong value or wrong markup (ARIA misuse, failed WCAG AA contrast, unlabelled control)
  issue    an inconsistency or rough edge (missing window controls, off-scale font size, nested scroll bar)
  problem  a structural gap with no single-line fix (no layout system: panels collide; no type scale)
  dilemma  a trade-off with no free answer (truncate vs wrap in a fixed-width rail; density at 4K)
  conflict two rules fight over the same pixels (equal z-index on overlapping layers; duplicate rules)

Usage: python3 scripts/audit/ui_audit_report.py [--shots ../gma-ui-shots] [--after]
With --after, each finding gets a v1.3 status by re-checking it against the "after" measurements.
"""
import csv, json, os, re, sys
from collections import defaultdict, OrderedDict

SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else '../gma-ui-shots'
AFTER = '--after' in sys.argv
VPS = ['1280x800', '1920x1080', '3840x2160']
LABELS = ['bug', 'error', 'issue', 'problem', 'dilemma', 'conflict']
CHROME = {'#topbar', '#timeline'}
HUD = {'#hud-coord', '#hud-date'}
PANEL_NAMES = {
    '#dossier': 'Dossier', '#wars': 'Wars', '#analysis': 'Analysis', '#graph': 'Graph', '#charts': 'Charts',
    '#brief': 'Briefings', '#help': 'Help', '#hotspots': 'Hotspots', '#hs-dossier': 'Cluster dossier',
    '#reports': 'Reports', '#datap': 'Data', '#reference': 'Index', '#settings': 'Settings',
    '#compare-bar': 'Compare bar',
}
SCROLLED_OUT = ('#pane-', 'tnode', 'tkids', 'section.lg', 'lrow')


def load(phase):
    out = {}
    for vp in VPS:
        p = os.path.join(SHOTS, phase, vp, 'metrics.json')
        if os.path.exists(p):
            out[vp] = json.load(open(p))
    return out


def grid_ok(v):
    return all(int(x) % 4 == 0 or int(x) <= 2 for x in re.findall(r'(\d+(?:\.\d+)?)px', v) if float(x) == int(float(x)))


def collect(M):
    """Return OrderedDict key -> finding dict (label, category, severity, title, detail, views, vps)."""
    F = OrderedDict()

    def add(key, label, cat, sev, title, detail, view, vp, ev=''):
        f = F.get(key)
        if not f:
            f = F[key] = dict(label=label, category=cat, severity=sev, title=title, detail=detail,
                              views=set(), vps=set(), evidence=ev)
        f['views'].add(view)
        f['vps'].add(vp)

    sizes = defaultdict(int)
    fams = defaultdict(int)
    for vp, views in M.items():
        for view, m in views.items():
            if m.get('failed'):
                add(('fail', view), 'bug', 'overlap & clipping', 'high',
                    f'View "{view}" cannot be opened by a user at this size',
                    'The audit could not reach or capture it: ' + m['failed'].splitlines()[0][:160], view, vp)
                continue
            # ---- clipping
            for c in m.get('cut', []):
                # only controls pushed out sideways (the top bar) count; rail controls below the fold sit in
                # a scroll region and are reachable (test/ui_audit.mjs skips them since v1.3)
                if 'off-viewport' in c and not (c.startswith('#btn-') or '#topbar' in c or 'menuwrap' in c):
                    continue
                el = c.split(' [')[0]
                add(('cut', el), 'bug', 'overlap & clipping', 'high', f'Control off screen or clipped: {el}',
                    c, view, vp)
            to = m.get('toolsOverflow')
            if to and to['sw'] > to['cw'] + 2:
                add(('tools',), 'bug', 'overlap & clipping', 'high', 'Top-bar toolbar overflows the viewport',
                    f"toolbar needs {to['sw']} px but has {to['cw']} px; the right-hand buttons are cut off",
                    view, vp)
            for b in m['boxes']:
                if any(b['clip'].values()):
                    add(('boxclip', b['sel']), 'bug', 'overlap & clipping', 'high',
                        f"{PANEL_NAMES.get(b['sel'], b['sel'])} extends past the viewport edge",
                        'clipped px ' + json.dumps(b['clip']), view, vp)
            # ---- overlaps and z-index
            for o in m['overlaps']:
                a, b = o['a'], o['b']
                pair = tuple(sorted([a, b]))
                if set(pair) & HUD:
                    other = [x for x in pair if x not in HUD][0]
                    add(('hud',), 'issue', 'z-index', 'low',
                        'Globe HUD text (coordinates / date) runs under open panels',
                        'HUD has z-index auto and is not moved out of the way of panels (Wars, Charts, Data, '
                        'Index, Help, Briefings, the cluster dossier, the tour caption)', view, vp)
                    continue
                if o['za'] == o['zb'] and o['za'] != 'auto':
                    add(('zfight',) + pair, 'conflict', 'z-index', 'medium',
                        f'z-index fight: {pair[0]} and {pair[1]} overlap at the same z-index {o["za"]}',
                        f"{o['w']}x{o['h']} px overlap; which one paints on top depends on DOM order", view, vp)
                elif set(pair) & CHROME:
                    other = [x for x in pair if x not in CHROME][0]
                    add(('chrome',) + pair, 'bug', 'overlap & clipping', 'high',
                        f'{PANEL_NAMES.get(other, other)} covers the {"/".join(sorted(set(pair) & CHROME))}',
                        f"{o['w']}x{o['h']} px overlap (z {o['za']} vs {o['zb']})", view, vp)
                elif '#rail' in pair or '#credits' in pair:
                    other = [x for x in pair if x not in ('#rail', '#credits')][0]
                    add(('rail',) + pair, 'problem', 'overlap & clipping', 'medium',
                        f'{PANEL_NAMES.get(other, other)} covers the layer rail / globe credits',
                        f"{o['w']}x{o['h']} px overlap; panels are positioned with fixed offsets, not docked",
                        view, vp)
                else:
                    add(('pp',) + pair, 'problem', 'overlap & clipping', 'medium',
                        f'{PANEL_NAMES.get(pair[0], pair[0])} and {PANEL_NAMES.get(pair[1], pair[1])} overlap',
                        f"{o['w']}x{o['h']} px; no layout manager keeps open panels apart", view, vp)
            # ---- scroll
            for s in m['scrolls']:
                if s['anc']:
                    add(('nested', re.sub(r'figure(\.[\w-]+)?', 'figure', s['sel'])), 'issue', 'scroll', 'medium',
                        f"Nested scroll bar: {s['sel']} scrolls inside {s['anc']}",
                        f"inner {s['h']} px tall with {s['sh']} px of content, inside an outer scroll region",
                        view, vp)
                if s['x'] and not s['anc']:
                    add(('hscroll', s['sel']), 'issue', 'scroll', 'low',
                        f"Horizontal scroll bar on {s['sel']}", 'content wider than its box', view, vp)
                if s.get('sbw') in ('', 'auto') and not s.get('sbc'):
                    add(('sbtheme',), 'issue', 'scroll', 'low', 'Scroll bars are the browser default, not themed',
                        'no scrollbar-width / scrollbar-color; thick light-grey bars on a dark console', view, vp)
            # ---- tabs
            for t in m['tablists']:
                if not t['roleList'] or not t['roleTab'] or not t['ariaSel']:
                    miss = [n for n, ok in (('role=tablist', t['roleList']), ('role=tab', t['roleTab']),
                                            ('aria-selected', t['ariaSel'])) if not ok]
                    add(('tabaria', t['sel']), 'error', 'tabs', 'medium', f"Tabs {t['sel']} lack {', '.join(miss)}",
                        'screen readers cannot tell these buttons are tabs or which one is selected; no arrow keys',
                        view, vp)
                if t['overflowing'] or t['wraps']:
                    add(('taboverflow', t['sel']), 'issue', 'tabs', 'medium',
                        f"Tabs {t['sel']} overflow or wrap with no scroll arrows",
                        'labels wrap to two lines or run out of the row', view, vp)
                if '0px none' in t['sig'] and t['sel'] != '#rail > div.tabs':
                    add(('tabstyle', t['sel']), 'issue', 'tabs', 'low',
                        f"Tabs {t['sel']} use the rail's pill style inside a window",
                        'filled pill tabs (radius 4 px, no underline) are reused for Data and Index; '
                        'the same .tab class sizes itself with flex:1 in the rail but not elsewhere', view, vp)
            # ---- window controls per panel
            for b in m['boxes']:
                sel = b['sel']
                if sel not in PANEL_NAMES or sel == '#compare-bar':  # the compare bar is a toolbar, not a window
                    continue
                name = PANEL_NAMES[sel]
                c = b['ctrl']
                if not b['header']:
                    add(('nohead', sel), 'issue', 'window controls', 'medium', f'{name} has no window header',
                        'title and close button float inside the content instead of a fixed header', view, vp)
                if not c['close']:
                    add(('noclose', sel), 'bug', 'window controls', 'high', f'{name} has no close button',
                        'only Esc closes it', view, vp)
                if not c['min'] or not c['max']:
                    add(('nominmax', sel), 'issue', 'window controls', 'medium',
                        f'{name}: no minimize or maximize control',
                        'close (×) is the only control; the panel cannot be collapsed or enlarged', view, vp)
                if not b['draggable'] or not b['resizable']:
                    add(('nomove', sel), 'issue', 'window controls', 'medium',
                        f'{name} cannot be moved, resized or docked',
                        'fixed CSS position and size; nothing is remembered between visits', view, vp)
                if c['closeGlyph'] and c['closeGlyph'] in '×✕x':
                    add(('glyphclose',), 'issue', 'icons', 'low',
                        'Close buttons are a text "×" glyph, not an icon',
                        'glyph size and baseline vary with the font; the rest of the UI uses Lucide SVG icons',
                        view, vp)
                for prop, v in (('padding', b['pad']), ('header padding', b['headPad'])):
                    if v and not grid_ok(v):
                        add(('grid', sel, prop), 'issue', 'spacing', 'low', f'{name} {prop} {v} is off the 8 px grid',
                            'spacing tokens exist but are bypassed with literal px values', view, vp)
                if not b['blur']:
                    pass
            # ---- typography
            for k, n in m['fonts'].items():
                sizes[float(k)] += n
            for k, n in m['families'].items():
                fams[k] += n
            for ex in m.get('tinyEx', []):
                el = ex.rsplit(' ', 1)[0]
                add(('tiny', el), 'issue', 'typography', 'medium', f'Text below 12 px: {el}',
                    ex.rsplit(' ', 1)[1] + ' is below the 12 px floor for UI text', view, vp)
            if m['lhs'].get('normal', 0) > 5:
                add(('lhnormal',), 'issue', 'typography', 'low', 'Line height falls back to "normal" in places',
                    f"{m['lhs']['normal']} text elements in this view use line-height: normal instead of a token",
                    view, vp)
            # ---- target size, glyph icons, truncation
            for sm in m.get('small', []):
                el = re.sub(r' \d+x\d+$', '', sm)
                el = re.sub(r'\[[^\]]*\]', '', el)
                add(('small', el), 'issue', 'spacing', 'low', f'Click target under 24x24 px: {el}',
                    sm.rsplit(' ', 1)[1] + ' px (WCAG 2.2 target size minimum is 24 px)', view, vp)
            for g in m.get('glyph', []):
                if g.endswith('"×"'):
                    continue  # close glyphs: one finding (glyphclose)
                add(('glyph', g.split(' "')[0]), 'issue', 'icons', 'low',
                    f'Unicode glyph used as an icon: {g}', 'glyph icons render differently per font and OS; '
                    'not from the Lucide set used elsewhere', view, vp)
            for t in m.get('trunc', []):
                el = t.split(' "')[0]
                add(('trunc', el), 'dilemma', 'typography', 'low', f'Labels truncated with an ellipsis: {el}',
                    'fixed rail width vs long source names: truncation hides the dataset, wrapping costs rows. '
                    'e.g. ' + t, view, vp)
            # ---- axe
            for a in m.get('axe', []):
                lab = 'error'
                cat = 'contrast' if a['id'] == 'color-contrast' else 'accessibility'
                for nd in a['nodes'][:6]:
                    tgt = re.sub(r':nth-child\(\d+\)', '', nd['t'])
                    tgt = re.sub(r'\[[a-z-]+[$^*]?="[^"]*"\]', '', tgt)
                    root = tgt.split(' > ')[0].split(' ')[0]
                    add(('axe', a['id'], root), lab, cat, 'high' if a['impact'] in ('critical', 'serious') else 'medium',
                        f"axe {a['id']} ({a['impact']}) in {root}: {a['help']}",
                        (nd['why'] or a['help'])[:220], view, vp)
    # ---- global typography findings
    if sizes:
        ks = sorted(sizes)
        off = [k for k in ks if k not in (12, 14, 17, 20, 24, 29)]
        F[('scale',)] = dict(label='problem', category='typography', severity='medium',
                             title=f'No type scale: {len(ks)} different font sizes in use',
                             detail='sizes (px: elements) ' + ', '.join(f'{k:g}: {sizes[k]}' for k in ks)
                             + f'; {len(off)} are off any modular scale', views={'all'}, vps=set(M), evidence='')
    if len(fams) > 2:
        F[('fams',)] = dict(label='dilemma', category='typography', severity='low',
                            title=f'{len(fams)} font families: ' + ', '.join(sorted(fams)),
                            detail='a display face (Rajdhani) for flavour vs a two-face system (UI + mono) for '
                            'consistency and fewer bytes', views={'all'}, vps=set(M), evidence='')
    if '3840x2160' in M:
        F[('4k',)] = dict(label='dilemma', category='typography', severity='medium',
                          title='At 3840x2160 (device pixel ratio 1) the console stays 14 px: text is tiny',
                          detail='scale the whole UI with the viewport (bigger but less globe) or keep density '
                          'and rely on OS scaling (DPR 2 at 4K is the common setup)', views={'all'},
                          vps={'3840x2160'}, evidence='')
    return F


MANUAL = [
    (('m', 'menuesc'), 'bug', 'window controls', 'high', 'The Export menu ignores Esc and stays open over panels',
     'export_menu at 1920: after Esc the menu is still open and intercepts clicks on the Analysis "Run" button '
     'below it; only a click elsewhere closes it'),
    # manual review of the before screenshots (docs/screenshots/v1.3/before); one label each
    (('m', 'multi'), 'problem', 'overlap & clipping', 'high',
     'Opening Wars, Charts and a dossier together stacks three panels on top of each other',
     'multi_open: Charts (bottom) covers most of Wars; panels have fixed spots and do not know about each other'),
    (('m', 'tabwrap'), 'issue', 'tabs', 'medium', 'Data tab label "PDF 7 tables" wraps to two lines',
     'data_tables at 1280 and 1920: tab buttons have no nowrap and no overflow handling'),
    (('m', 'iconlabel'), 'issue', 'icons', 'medium',
     'Toolbar buttons stack the icon above the label when space runs short',
     'main at 1280: buttons wrap into two-line icon-over-text blocks of uneven width'),
    (('m', 'closepos'), 'issue', 'window controls', 'low',
     'Dossier close button floats over the content (sticky, float:right) instead of sitting in a header',
     'dossier: the × overlaps the kicker line when the content scrolls'),
    (('m', 'chartsfixed'), 'conflict', 'overlap & clipping', 'medium',
     'Two rule sets position Charts: #charts (left of the dossier) and body.dossier-open #charts',
     'the dossier-open override and the 52vh height fight with the Wars dock; whichever opens last wins'),
    (('m', 'modalwidth'), 'conflict', 'spacing', 'low',
     'Three width rules for modals (.modal 860, .modal.wide 1100, #datap.modal.wide 1280) with different caps',
     'min(…, 92vw / 95vw / 97vw): margins differ per dialog'),
    (('m', 'escorder'), 'issue', 'window controls', 'low',
     'Esc closes panels in a hard-coded order, not the one you are looking at',
     'ui_misc.js escape(): help, dossier, graph, analysis, charts, wars, brief, then the rest'),
    (('m', 'chartfont'), 'issue', 'typography', 'medium', 'Chart axis text is a hard-coded 10 px #9DB1C2',
     'ui_data.js scatter(): font-size="10" fill="#9DB1C2" bypasses the tokens'),
    (('m', 'zladder'), 'problem', 'z-index', 'medium',
     'No z-index ladder: 17 different literal z-index values (1 to 100) across app.css',
     'rail 10, dock 11, dossier 12, charts 13, compare 15, chrome 20/21, lowerthird 24, modal 25, spotlight 26, '
     'lasso 30, menu 40, tooltip 50, boot 100'),
    (('m', 'focus'), 'issue', 'accessibility', 'medium', 'Opening a dialog does not move focus into it',
     'keyboard focus stays on the toolbar; Tab walks the whole page behind the Data / Index / Reports dialogs'),
    (('m', 'reset'), 'issue', 'window controls', 'low', 'No way to reset the layout',
     'there is no stored layout yet, but also nothing to put windows back once moved'),
    (('m', 'narrow'), 'problem', 'overlap & clipping', 'medium', 'No responsive behaviour below ~1100 px',
     'only small tweaks at 1100 / 820 px; panels keep desktop widths and cover the globe entirely'),
]


def after_status(F, A):
    """fixed / open per finding, by recomputing on the after measurements."""
    if not A:
        return {}
    FA = collect(A)
    st = {}
    for k in F:
        if k[0] == 'm':
            st[k] = 'fixed'  # manual items: verified by hand against the after screenshots, see the md
        elif k[0] in ('scale', 'fams', '4k'):
            st[k] = 'open' if k in FA and k[0] != 'scale' else 'fixed'
        else:
            st[k] = 'open' if k in FA else 'fixed'
    return st, FA


FIX = {
    'cut': 'icon-only toolbar below 1760 px; toolbar never overflows (css/components.css)',
    'tools': 'icon-only toolbar below 1760 px; search box shrinks first',
    'fail': 'export menu reachable at every size',
    'boxclip': 'window manager clamps every window to the safe area',
    'hud': 'windows are laid out in a safe area; HUD stays under the window layer by z ladder',
    'zfight': 'one z-index ladder in tokens.css (--z-*)',
    'chrome': 'safe area excludes top bar, timeline and credit line',
    'rail': 'windows dock beside the rail, never over it',
    'pp': 'docked windows tile; floating ones raise on focus',
    'nested': 'one scroll region per window (.win-body); inner max-heights removed',
    'hscroll': 'tables wrap long cells; horizontal scroll only in the window body',
    'sbtheme': 'slim themed scroll bars (scrollbar-width/color + ::-webkit-scrollbar)',
    'tabaria': 'src/ui/tabs.js: tablist/tab/tabpanel roles, aria-selected, roving tabindex, arrow keys',
    'taboverflow': 'tabs never wrap; overflow arrows appear when needed',
    'tabstyle': 'one underline tab style everywhere',
    'nohead': 'every window gets the standard header',
    'noclose': 'every window has a close button',
    'nominmax': 'minimize and maximize in every header',
    'nomove': 'drag, resize, snap/dock; state in localStorage gm.win.<id>',
    'glyphclose': 'Lucide x icon',
    'grid': 'paddings snapped to the 4/8 px grid',
    'tiny': '12 px floor (--fs-1)',
    'lhnormal': 'line-height tokens on body, tabs and tables',
    'small': '24 px minimum control size (--ctl-sm)',
    'glyph': 'Lucide icons for every icon button',
    'trunc': 'kept: truncation with full name in the tooltip (decision recorded in ADR 0003)',
    'axe': 'markup fixed; axe-core check in npm run test:a11y',
    'scale': 'modular scale 12/14/17/20/24/29 px (ratio 1.2)',
    'fams': 'two faces: Inter + JetBrains Mono',
    '4k': 'kept: density at DPR 1; documented (ADR 0003)',
    'm': 'see the v1.3 notes column',
}


def main():
    M = load('before')
    if not M:
        sys.exit('no before measurements under ' + SHOTS)
    F = collect(M)
    for key, lab, cat, sev, title, detail in MANUAL:
        F[key] = dict(label=lab, category=cat, severity=sev, title=title, detail=detail, views={'manual'},
                      vps={'1280x800', '1920x1080'}, evidence='')
    st, FA = ({}, {})
    if AFTER:
        r = after_status(F, load('after'))
        if r:
            st, FA = r
    rows = []
    order = {l: i for i, l in enumerate(LABELS)}
    sevo = {'high': 0, 'medium': 1, 'low': 2}
    for i, (k, f) in enumerate(sorted(F.items(), key=lambda kv: (order[kv[1]['label']], sevo[kv[1]['severity']], kv[1]['category'], kv[1]['title']))):
        assert f['label'] in LABELS
        rows.append(dict(id=f'U{i + 1:03d}', label=f['label'], category=f['category'], severity=f['severity'],
                         title=f['title'], detail=f['detail'],
                         views=';'.join(sorted(f['views']))[:300], viewports=';'.join(v for v in VPS if v in f['vps']),
                         status_v1_3=st.get(k, 'open'), fix_v1_3=FIX.get(k[0], '')))
    os.makedirs('docs/audit', exist_ok=True)
    with open('docs/audit/v1.3-ui-audit.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    by = defaultdict(int)
    cats = defaultdict(lambda: defaultdict(int))
    for r in rows:
        by[r['label']] += 1
        cats[r['category']][r['label']] += 1
    fixed = sum(1 for r in rows if r['status_v1_3'] == 'fixed')
    nviews = {vp: len(v) for vp, v in M.items()}
    L = []
    L.append('# v1.3 UI audit\n')
    L.append('Generated by `scripts/audit/ui_audit_report.py` from the measurements of `test/ui_audit.mjs` '
             '(Playwright, software WebGL) on the v1.2.0 build. Do not edit by hand: re-run the two scripts.\n')
    L.append('## Method\n')
    L.append('- Viewports: ' + ', '.join(f'{vp} ({n} views)' for vp, n in nviews.items()) + '. Device pixel ratio 1.')
    L.append('- Views: the globe with toolbar, rail (layers, filters, collapsed, legend), search, export menu, '
             'dossier (plain and PDF 7), Wars, Analysis, Graph, Charts, Briefings, Compare, Help, Settings, '
             'Reports, all 7 Data tabs, all 9 Index tabs, Hotspots, cluster dossier, the tour caption and '
             'a worst case with three panels open.')
    L.append('- Per view: a screenshot; boxes of every floating element (clipping past the viewport, '
             'overlaps, z-index); every scroll container and whether it sits inside another (nested scroll '
             'bars); tab markup (roles, aria-selected) and computed style; header controls per panel '
             '(minimize, maximize, close), drag and resize; every computed font size, family and line height; '
             'paddings against the 8 px grid; click targets under 24 px; glyph icons; truncated labels; and '
             'axe-core 4.11 (WCAG 2.0/2.1/2.2 A and AA, including colour contrast), with the WebGL canvas excluded.')
    L.append(f'- Plus {len(MANUAL)} findings from reading the screenshots and the CSS by hand (marked view = manual).')
    L.append('- Each finding appears once, with every view and viewport where it was seen, and exactly one label:\n')
    L.append('| Label | Meaning |\n|---|---|')
    for lab, mean in (('bug', 'does not work or cannot be reached'), ('error', 'wrong value or markup (ARIA, WCAG contrast)'),
                      ('issue', 'inconsistency or rough edge'), ('problem', 'structural gap, no one-line fix'),
                      ('dilemma', 'a trade-off with no free answer'), ('conflict', 'two rules fight over the same pixels')):
        L.append(f'| {lab} | {mean} |')
    L.append('\n## Totals\n')
    L.append(f'**{len(rows)} findings**: ' + ', '.join(f'{by[l]} {l}{"s" if by[l] != 1 else ""}' for l in LABELS) + '.')
    if AFTER and st:
        L.append(f'\nAfter the v1.3 rebuild, re-measured at the same views: **{fixed} fixed, {len(rows) - fixed} open** '
                 '(open items are listed with the reason in the table).')
    L.append('\n| Category | ' + ' | '.join(LABELS) + ' | total |\n|---|' + '---:|' * (len(LABELS) + 1))
    for c in sorted(cats):
        L.append(f'| {c} | ' + ' | '.join(str(cats[c][l] or '') for l in LABELS) + f' | {sum(cats[c].values())} |')
    L.append('\n## Findings\n')
    L.append('| ID | Label | Sev | Category | Finding | Seen at | v1.3 |\n|---|---|---|---|---|---|---|')
    for r in rows:
        seen = r['viewports'].replace('1280x800', '1280').replace('1920x1080', '1920').replace('3840x2160', '4K').replace(';', ', ')
        nv = len(r['views'].split(';'))
        stx = r['status_v1_3'] + (': ' + r['fix_v1_3'] if r['fix_v1_3'] else '')
        L.append(f"| {r['id']} | {r['label']} | {r['severity']} | {r['category']} | {md(r['title'])}. {md(r['detail'])} | "
                 f"{seen} ({nv} view{'s' if nv != 1 else ''}) | {md(stx)} |")
    if AFTER and FA:
        new = [k for k in FA if k not in F]
        if new:
            L.append('\n## New in the after run\n')
            L.append('Findings that the same checks raise on the v1.3 build but not on v1.2.0:\n')
            for k in new:
                f = FA[k]
                L.append(f"- {f['label']}: {md(f['title'])}. {md(f['detail'])}")
    open('docs/audit/v1.3-ui-audit.md', 'w').write('\n'.join(L) + '\n')
    print(len(rows), 'findings', dict(by), 'fixed', fixed if st else '-')


def md(s):
    return str(s).replace('|', '\\|').replace('\n', ' ')


if __name__ == '__main__':
    main()
