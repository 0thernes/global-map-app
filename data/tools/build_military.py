"""Military sites layer: US DoD MIRTA points (public domain) + OpenStreetMap military features (ODbL) fetched via
Overpass in regional chunks (data/tools/fetch_osm_military.py -> RAW/osm/chunk_*.json). Coordinates from OSM ways/relations are
feature centers (flagged approximate). Nuclear test sites tagged military=nuclear_explosion_site go to nuclear_osm.js."""
import json, os, sys, glob
RAW=sys.argv[1] if len(sys.argv)>1 else '/workspace/gm_build'
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'layers')
def write(name,payload):
    s='GM.reg(%s,%s);\n'%(json.dumps(name),json.dumps(payload,separators=(',',':'),ensure_ascii=False)); open(os.path.join(OUT,name+'.js'),'w',encoding='utf-8').write(s); print('wrote',name,round(len(s)/1e6,2),'MB')
items=[]; nuc=[]
STAT={'act':'active','clsd':'closed','semi':'semi-active','inact':'inactive'}
for f in json.load(open(os.path.join(RAW,'mirta_pts.geojson')))['features']:
    p=f['properties']; x,y=f['geometry']['coordinates'][:2]
    items.append(dict(name=p['SITENAME'] or p['FEATURENAME'],lon=round(x,5),lat=round(y,5),kind='DoD site (%s)'%(p['SITEREPORTINGCOMPONENT'] or '').upper(),country='United States'+(' ('+p['STATENAMECODE'].upper()+')' if p.get('STATENAMECODE') else ''),
      status=STAT.get(p['SITEOPERATIONALSTATUS'],p['SITEOPERATIONALSTATUS']),joint_base=p['ISJOINTBASE'],src='MIRTA',coord_note='MIRTA point (authoritative DoD site point)'))
seen=set(); nchunks=0
for fn in sorted(glob.glob(os.path.join(RAW,'osm','chunk_*.json'))):
    nchunks+=1
    for e in json.load(open(fn))['elements']:
        k=(e['type'],e['id'])
        if k in seen: continue
        seen.add(k); t=e.get('tags',{})
        if 'lat' in e: lat,lon,approx=e['lat'],e['lon'],e['type']!='node'
        elif 'center' in e: lat,lon,approx=e['center']['lat'],e['center']['lon'],True
        else: continue
        rec=dict(name=t.get('name:en') or t.get('name') or '(unnamed)',lon=round(lon,5),lat=round(lat,5),kind=t.get('military') or ('landuse=military' if t.get('landuse')=='military' else ''),
          country=t.get('addr:country',''),status=('disused/abandoned' if any(x in t for x in ('disused:military','abandoned:military','disused','abandoned')) else ''),operator=t.get('operator',''),
          src='OSM',url='https://www.openstreetmap.org/%s/%d'%(e['type'],e['id']),coord_note=('center of OSM area (approximate)' if approx else 'OSM node'))
        if t.get('military')=='nuclear_explosion_site':
            rec.update(kind='Nuclear test site (OSM military=nuclear_explosion_site)'); nuc.append(rec)
        else: items.append(rec)
# ---- Wikidata (CC0): military bases / installations / air & naval bases / forts with P625 coordinates (data/tools/wd_mil.py) ----
WD=os.path.join(RAW,'wd','wd_military.json'); wd_n=0
def _hav(a,b,c,d):
    import math; r=math.radians; x=math.sin(r(c-a)/2)**2+math.cos(r(a))*math.cos(r(c))*math.sin(r(d-b)/2)**2; return 12742*math.asin(min(1,math.sqrt(x)))
if os.path.exists(WD):
    g0={}
    for i,it in enumerate(items): g0.setdefault((round(it['lat']),round(it['lon'])),[]).append(i)
    # class policy: drop towers/churches/hides reached by the P279* traversal; relabel historic fortifications and
    # gendarmerie barracks (both excluded from the analysis like forts). Needs RAW/wd/wd_classes.json (data/tools/wd_mil.py --classes).
    POL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'military_class_policy.json')))['classes']
    WC = os.path.join(RAW, 'wd', 'wd_classes.json'); CLS = json.load(open(WC))['classes'] if os.path.exists(WC) else {}
    pol_n = {'drop': 0, 'historic': 0, 'police': 0}
    def wd_policy(qid, cls):
        ps = [POL.get(c, {}).get('policy', 'keep') for c in CLS.get(qid, [])]
        if not ps or 'keep' in ps: return cls if cls != 'fort' else 'fort'
        if all(p == 'drop' for p in ps): return None
        if 'police' in ps: return 'gendarmerie/police barracks'
        return 'fort'
    for w in json.load(open(WD)):
        k = wd_policy(w['qid'], w['cls'])
        if k is None: pol_n['drop'] += 1; continue
        if k != w['cls']: pol_n['police' if k.startswith('gend') else 'historic'] += 1; w = dict(w, cls=k)
        if any(_hav(w['lat'],w['lon'],items[i]['lat'],items[i]['lon'])<0.5 for dy in (-1,0,1) for dx in (-1,0,1) for i in g0.get((round(w['lat'])+dy,round(w['lon'])+dx),[])): continue
        items.append(dict(name=w['name'],lat=round(w['lat'],5),lon=round(w['lon'],5),kind=w['cls']+(' (Wikidata; often historic)' if w['cls'] in ('fort', 'gendarmerie/police barracks') else ' (Wikidata)'),country=w['country'],status=('dissolved '+w['dissolved'] if w['dissolved'] else ''),
            inception=w['inception'],dissolved=w['dissolved'],src='Wikidata',url='https://www.wikidata.org/wiki/'+w['qid'],coord_note='Wikidata P625 (usually the site; large bases are one representative point)'))
        wd_n+=1
print('wikidata added',wd_n,'class policy',pol_n if os.path.exists(WD) else {})
# ---- merge QWM seeds (map_military_bases.csv, common schema) and dedupe against MIRTA/OSM ----
import csv, math, re
SEEDS=os.environ.get('GM_MAP_DIR','/workspace/qwm/wiw/data/map')+'/map_military_bases.csv'
def hav(a,b,c,d):
    r=math.radians; x=math.sin(r(c-a)/2)**2+math.cos(r(a))*math.cos(r(c))*math.sin(r(d-b)/2)**2; return 12742*math.asin(min(1,math.sqrt(x)))
def nk(s): return re.sub(r'[^a-z0-9]','',(s or '').lower().replace('air force base','afb').replace('naval air station','nas'))
grid={}
for i,it in enumerate(items): grid.setdefault((round(it['lat']),round(it['lon'])),[]).append(i)
seeds_added=seeds_merged=0
if os.path.exists(SEEDS):
    for r in csv.DictReader(open(SEEDS,encoding='utf-8-sig')):
        try: lat=float(r['lat']); lon=float(r['lon'])
        except Exception: continue
        if not (r.get('source_url') or '').startswith('http'): continue
        dup=None
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                for i in grid.get((round(lat)+dy,round(lon)+dx),[]):
                    d=hav(lat,lon,items[i]['lat'],items[i]['lon'])
                    if d<0.5 or (d<5 and nk(items[i]['name'])[:8]==nk(r.get('name'))[:8]): dup=i
        if dup is not None:
            items[dup].setdefault('also_in','QWM seed '+(r.get('id') or '')); items[dup]['modern_military_flag']=r.get('modern_military_flag',''); items[dup].setdefault('seed_url',r['source_url']); seeds_merged+=1; continue
        items.append(dict(name=r.get('name') or '(unnamed)',lat=round(lat,5),lon=round(lon,5),kind=r.get('subtype') or 'military site (QWM seed)',country=r.get('country',''),status=r.get('notes','')[:80],
            src='QWM seed',url=r['source_url'],coord_note='%s; %s'%(r.get('coord_precision',''),r.get('coord_source','')),coord_precision=r.get('coord_precision','')))
        seeds_added+=1
print('seeds added',seeds_added,'merged',seeds_merged)
COORD_NOTES={}
for it in items:
    n=it.pop('coord_note',None)
    if n: COORD_NOTES.setdefault(it.get('src',''),n)
    for k in [k for k,v in it.items() if v in ('',None)]: del it[k]
write('military',dict(title='Military bases & sites',source='US DoD MIRTA DoD Sites - Points (public domain, DISDI via data.gov/ArcGIS FeatureServer) + Wikidata (CC0) military base/installation/air base/naval base/fort items with coordinates + OpenStreetMap contributors (ODbL 1.0) military=base|naval_base|airfield|barracks|range|training_area|office|checkpoint and named landuse=military; %d OSM chunks loaded%s'%(nchunks,('; QWM map_military_bases seeds: %d added, %d merged as duplicates (<0.5 km, or <5 km with matching name)'%(seeds_added,seeds_merged)) if os.path.exists(SEEDS) else ''),type='points',items=items,osm_chunks=nchunks,coord_notes=COORD_NOTES))
write('nuclear_osm',dict(title='Nuclear test sites (OSM)',source='OpenStreetMap contributors (ODbL 1.0), military=nuclear_explosion_site; area centers approximate',type='points',items=nuc))
print(len(items),len(nuc))
