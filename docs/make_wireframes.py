# Generates docs/wireframes/*.svg (rendered to PNG by tools/shoot.py). Boxes are layout regions, not data.
import os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'wireframes')
W,H=1440,900
def svg(name,title,boxes,notes=''):
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Inter, sans-serif">',
       f'<rect width="{W}" height="{H}" fill="#03060C"/>',
       '<defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#0f2236" stroke-width="1"/></pattern></defs>',
       f'<rect width="{W}" height="{H}" fill="url(#g)"/>',
       f'<text x="24" y="{H-16}" fill="#7A90A3" font-size="14">WIREFRAME · {title}{" · "+notes if notes else ""}</text>']
    for x,y,w,h,label,kind in boxes:
        col={'globe':'#38E8FF','panel':'#7C9CFF','bar':'#9DB1C2','accent':'#FFC857','danger':'#FF6B6B'}[kind]
        if kind=='globe':
            s.append(f'<circle cx="{x+w/2}" cy="{y+h/2}" r="{min(w,h)/2-10}" fill="#0B1F33" stroke="{col}" stroke-width="2" stroke-dasharray="6 6"/>')
        else:
            s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(16,26,43,0.85)" stroke="{col}" stroke-width="1.5"/>')
        for i,line in enumerate(label.split('\n')):
            s.append(f'<text x="{x+12}" y="{y+24+i*18}" fill="{col if i==0 else "#C9D7E2"}" font-size="{15 if i==0 else 12}" font-weight="{600 if i==0 else 400}">{line}</text>')
    s.append('</svg>'); open(os.path.join(OUT,name+'.svg'),'w').write('\n'.join(s))
TOP=(0,0,W,56,'TOP BAR  [/] search-everything (cases · people · sites · sources · places)   |  investigation ▾  save  export ▾  ?','bar')
RAIL=(0,56,320,732,'LEFT RAIL (L)  collapsible\nLayers: on · opacity · ▲▼ order · A/B side\nFilters: category · grade · era · country\nprecision · search\nCounts + mini charts (brushable)','panel')
TL=(0,788,W,112,'TIMELINE  ▶ ❚❚  −Y −M −D  [1900 ━━━━━━━━━●━━ 2026]  +D +M +Y   speed ▾  mode ▾  ±N d / km\nevent-density sparkline (drag = brush a date range)  ·  date readout 1976-09-19 12:00 UTC  ·  co-occurrence count','bar')
svg('01_main_console','Main console',[TOP,RAIL,(320,56,700,732,'GLOBE (center never covered)','globe'),(1020,56,420,732,'RIGHT DOSSIER (Esc closes)\ncase / site / conflict / country\nsource + grade badges, precision\nrelated, nearby sites, mini timeline\nexport md / html','panel'),TL])
svg('02_dossier','Case dossier',[TOP,(320,56,700,732,'GLOBE (flies to case; uncertainty circle)','globe'),(1020,56,420,732,'DOSSIER\nUAP CASE · grade [CIT]  precision [locality ±10 km]\nTitle 20/600\nDate · original string · precision\nPlace · coord_source · geocoder\nWhat happened / witnesses / official position\nSource link (+ more sources)\nRelated cases (reason chips)\nNearby reference sites (km): base, reactor, fault, volcano\nMini timeline: case vs nearby GED / cases\n[Export .md] [Printable HTML] [Pin to graph]','panel'),TL])
svg('03_link_graph','Entity & link graph (G)',[TOP,RAIL,(320,56,560,732,'GLOBE (selection synced)','globe'),(880,56,560,732,'LINK GRAPH (force-directed)\nnodes: case · person · site · source · place\nedges: shared witness / shared source /\nproximity ≤ X km / co-occurrence ±N d\nhover edge = reason; click node = select on globe\nfilters: edge types, X km, N days','panel'),TL])
svg('04_compare','Compare (C): swipe or split',[TOP,(0,56,720,732,'SIDE A  (date A, layer set A)','globe'),(720,56,720,732,'SIDE B  (date B, layer set B)','globe'),(712,56,16,732,'','accent'),TL],'swipe divider drag')
svg('05_hypothesis','Hypothesis analysis',[TOP,RAIL,(320,56,520,732,'GLOBE + hotspot overlay (obs ÷ pop. baseline)','globe'),(840,56,600,732,'ANALYZE · UAP vs military / nuclear / conflict\nCorrelation, not causation; baseline assumptions shown.\nOptions: exact/≤1 km only ☑  window ±365 d  iters  seed\nPer reference: obs median (CI) vs uniform-land / pop-weighted / time-matched\nratio · Monte Carlo p · histograms obs vs baseline\nBreakdowns: country · decade\nSample-size warnings · Bias panel\n[Export CSV]','panel'),TL])
svg('06_briefings','Briefings',[TOP,RAIL,(320,56,1120,732,'BRIEFINGS (B)\nanalysis_summary.md rendered (typeset 16/1.45)\nfigures (PNGs) in a grid, click to enlarge\nsources_registry table','panel'),TL])
print('ok')
