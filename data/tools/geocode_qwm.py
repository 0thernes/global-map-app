"""Build data/sources/qwm_uap_cases.csv from QWM source CSVs.
Geocodes place names via OSM Nominatim (1 req/s, polite UA, cached).
Never invents rows: every plotted row comes from a sourced QWM row with a source URL.
Rows whose place is too vague / multi-site go to data/unplotted.csv with a reason."""
import csv, json, os, re, time, urllib.parse, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.dirname(HERE)
HS='/workspace/qwm/wiw/hs_candidates.csv'; GL='/workspace/qwm/What-Is-What-of-the-What-glitches.csv'
CACHE=os.path.join(HERE,'geocode_cache.json')
cache=json.load(open(CACHE)) if os.path.exists(CACHE) else {}
UA='GlobalMapApp/1.0 (personal OSINT research tool; Alex Donahue)'
def nominatim(q):
    if q in cache: return cache[q]
    url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'jsonv2','limit':1,'addressdetails':1})
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'en'})
    time.sleep(1.1)
    res=json.load(urllib.request.urlopen(req,timeout=30))
    cache[q]=res[0] if res else None
    json.dump(cache,open(CACHE,'w'),indent=1,ensure_ascii=False)
    return cache[q]
MON={m:i+1 for i,m in enumerate('jan feb mar apr may jun jul aug sep oct nov dec'.split())}
def parse_date(s):
    """Return (iso, precision). Uses the first concrete date in the string."""
    t=s.replace('Sept','Sep')
    m=re.search(r'(\d{1,2})(?:[-/]\d{1,2}| and [\d -]+)?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})',t)
    if m: return f"{int(m.group(3)):04d}-{MON[m.group(2).lower()[:3]]:02d}-{int(m.group(1)):02d}",'day'
    m=re.search(r'\b([A-Za-z]{3})[a-z]*\s+(\d{4})',t)
    if m and m.group(1).lower()[:3] in MON: return f"{m.group(2)}-{MON[m.group(1).lower()[:3]]:02d}-01",'month'
    m=re.search(r'(\d{4})',t)
    if m: return f"{m.group(1)}-01-01",'year'
    return '',''
# hs_candidates: place -> (geocoder query or None=unplotted, note)
HS_Q={
 'Tehran, Iran':('Tehran, Iran',''),
 'Shag Harbour, Nova Scotia, Canada':('Shag Harbour, Nova Scotia',''),
 'Socorro, New Mexico, USA':('Socorro, New Mexico',''),
 'Kecksburg, Pennsylvania, USA':('Kecksburg, Pennsylvania',''),
 'Kelly, Christian County, Kentucky, USA':('Kelly, Christian County, Kentucky',''),
 'Lubbock, Texas, USA':('Lubbock, Texas',''),
 'Godman Field / Franklin, Kentucky, USA':('Godman Army Airfield, Kentucky','two named places ~150 km apart; plotted at the first named (Godman Field, where the chase began)'),
 'RAF Lakenheath / Bentwaters, UK':('RAF Lakenheath','two named bases ~50 km apart; plotted at the first named (RAF Lakenheath)'),
 'Mississippi-Texas-Oklahoma, USA':(None,'multi-state flight track (MS-TX-OK), no single place'),
 'Levelland, Hockley County, Texas, USA':('Levelland, Texas',''),
 'Northern Sweden':('Kölmjärv','place given only as "Northern Sweden"; plotted at Lake Kölmjärv, which the case name specifies (19 Jul 1946 event)'),
 'Los Angeles, California, USA':('Los Angeles, California',''),
 'Minot AFB, North Dakota, USA':('Minot Air Force Base',''),
 'Near Mansfield, Ohio, USA':('Mansfield, Ohio','"near" Mansfield; plotted at the city'),
 'Zeitoun, Cairo, Egypt':('Zeitoun, Cairo, Egypt',''),
 'Petrozavodsk, Karelia, USSR':('Petrozavodsk, Karelia, Russia',''),
 'Bass Strait, Australia':('Bass Strait','body of water; plotted at the strait centroid (very approximate)'),
 'Kaikoura coast, New Zealand':('Kaikoura, New Zealand','"Kaikoura coast"; plotted at Kaikoura town'),
 'Huffman, Texas, USA':('Huffman, Texas',''),
 'Trans-en-Provence, Var, France':('Trans-en-Provence, Var, France',''),
 'São Paulo / Rio / Goiás, Brazil':(None,'multi-site event across three states (São Paulo / Rio / Goiás), no single place'),
 'Over Alaska, USA':(None,'"Over Alaska": in-flight event with no specific place in the row'),
 'Varginha, Minas Gerais, Brazil':('Varginha, Minas Gerais',''),
 'Campeche, Mexico':('Campeche, Campeche, Mexico','"Campeche, Mexico" (city or state ambiguous); plotted at Campeche city; FLIR flight was offshore/over the state'),
 "O'Hare Airport, Chicago, USA":("O'Hare International Airport",''),
 'Stephenville / Dublin, Texas, USA':('Stephenville, Texas','two nearby towns (~20 km apart); plotted at Stephenville'),
 'Aguadilla, Puerto Rico':('Aguadilla, Puerto Rico',''),
 'Off San Antonio-Quintero, Chile':('San Antonio, Valparaíso, Chile','offshore "off San Antonio-Quintero"; plotted at San Antonio port (approximate)'),
 'Off Yemen':(None,'"Off Yemen": no specific place'),
 'Near an undisclosed US military facility':(None,'location redacted/undisclosed in source'),
 'Barksdale AFB, Louisiana, USA':('Barksdale Air Force Base',''),
}
GL_EXTRA={ # glitch path_id -> (category, place label, query or None, date override or None, note)
 'G12.1.1.1':(None,'Washington, DC',None,None,'not an anomaly sighting (criminal attack + online "time traveller" claim); out of scope for incident map'),
 'G12.1.1.2':('UAP case','Bayside Marketplace, Miami, Florida, USA','Bayside Marketplace, Miami','1 Jan 2024',''),
 'G12.2.1.1':('UAP case','Aztec, New Mexico, USA','Aztec, New Mexico','25 Mar 1948','claimed crash; second/third-hand accounts only'),
 'G12.2.1.2':('Nuclear-site incident','Honolulu, Hawaii, USA (effects observed)','Honolulu, Hawaii','9 Jul 1962','source names Honolulu (EMP effects, ~1,450 km from the detonation); plotted where effects were observed, not the burst point'),
 'G12.2.1.3':('Wartime sighting','North of Strasbourg, France','Strasbourg, France','27 Nov 1944','first named report "north of Strasbourg" (27 Nov 1944); wave continued into 1945'),
 'G12.2.1.4':(None,'UK bases / European airports',None,None,'multi-site drone waves (UK bases Nov 2024; European airports Sep-Nov 2025), no single place'),
 'G12.4.1.5':('Mass sighting','Hudson Valley, New York, USA','Hudson Valley, New York','31 Dec 1982','regional wave 1982-1986; plotted at the Hudson Valley region (very approximate)'),
 'G12.4.1.8':(None,'13 Chinese provinces',None,None,'sighted across 13 provinces (Xinjiang to Anhui); no single place'),
 'G12.4.1.9':('Mass sighting','Hangzhou Xiaoshan Airport, China','Hangzhou Xiaoshan International Airport','7 Jul 2010',''),
 'G12.4.1.10':('Mass sighting','Chongqing, China','Shapingba, Chongqing','5 Jul 2010','event spans July 2010 (date = first documented posts); plotted at Shapingba district, where the row names Sanxia Square as a viewing site'),
 'G12.4.1.11':('Mass sighting','Thakung, Ladakh, India','Thakung, Ladakh','1 Aug 2012','reports 1 Aug-15 Oct 2012'),
 'G12.6.1.2':('UAP case','Flatwoods, West Virginia, USA','Flatwoods, West Virginia','12 Sep 1952',''),
 'G12.6.1.4':('UAP case','Voronezh, Russia','Voronezh, Russia','27 Sep 1989','park landing; plotted at city centroid'),
 'G12.6.1.5':('UAP case','Broad Haven, Pembrokeshire, Wales, UK','Broad Haven, Pembrokeshire','4 Feb 1977',''),
 'G12.6.1.6':('UAP case','Samudra Tapu glacier, Lahaul, Himachal Pradesh, India','Samudra Tapu','27 Sep 2004','high-altitude glacier camp (~17,000 ft); plotted at glacier'),
}
FIELDS=['id','name','date','date_original','date_precision','place','lat','lon','coord_precision','coord_radius_km','coord_source','coord_method','category','subcategory','grade','description','witnesses','official_position','source_url','extra_sources','flag','origin']
rows=[]; unpl=[]
for r in csv.DictReader(open(HS,encoding='utf-8')):
    q,note=HS_Q[r['place']]
    iso,prec=parse_date(r['date'])
    base=dict(id=f"qwm-hs-{int(r['n']):02d}",name=r['name'],date=iso,date_original=r['date'],date_precision=prec,place=r['place'],
      category='UAP case',subcategory='',grade=r['provisional_grade'],description=r['what_happened'],witnesses=r['key_witnesses_credentials'],
      official_position=r['official_position'],source_url=r['source_url'],extra_sources='',flag=r['flag'],origin='qwm/wiw/hs_candidates.csv row '+r['n'])
    if not q: unpl.append(dict(id=base['id'],name=r['name'],date=r['date'],place=r['place'],source_url=r['source_url'],origin=base['origin'],reason=note)); continue
    g=nominatim(q)
    if not g: unpl.append(dict(id=base['id'],name=r['name'],date=r['date'],place=r['place'],source_url=r['source_url'],origin=base['origin'],reason='geocoder returned no result for '+q)); continue
    base.update(lat=round(float(g['lat']),5),lon=round(float(g['lon']),5),
      coord_method='geocoded from place name (city/region centroid) via OSM Nominatim query "%s" -> %s%s'%(q,g.get('display_name','')[:120],('; NOTE: '+note) if note else ''))
    rows.append(base)
hsnames={re.sub(r'[^a-z]','',x['name'].lower())[:10] for x in rows}
for r in csv.DictReader(open(GL,encoding='utf-8')):
    if r['path_id'] not in GL_EXTRA: continue
    cat,place,q,dt,note=GL_EXTRA[r['path_id']]
    urls=re.findall(r'https?://[^\s|]+',r['source'])
    if not urls: continue
    iso,prec=parse_date(dt or r['name'])
    if r['path_id']=='G12.4.1.10': prec='month'
    rid='qwm-gl-'+r['path_id']
    if not q:
        unpl.append(dict(id=rid,name=r['name'],date=r['year'],place=place,source_url=urls[0],origin='qwm/What-Is-What-of-the-What-glitches.csv '+r['path_id'],reason=note)); continue
    g=nominatim(q)
    if not g:
        unpl.append(dict(id=rid,name=r['name'],date=dt,place=place,source_url=urls[0],origin='qwm glitches '+r['path_id'],reason='geocoder returned no result for '+q)); continue
    rows.append(dict(id=rid,name=re.sub(r'\s*\([^)]*\d{4}[^)]*\)\s*$','',r['name']),date=iso,date_original=dt+(' ('+r['name']+')' if dt not in r['name'] else ''),date_precision=prec,place=place,
      lat=round(float(g['lat']),5),lon=round(float(g['lon']),5),
      coord_method='geocoded from place name (city/region centroid) via OSM Nominatim query "%s" -> %s%s'%(q,g.get('display_name','')[:120],('; NOTE: '+note) if note else ''),
      category=cat,subcategory=r['category'],grade=r['evidence_grade'],description=(r['observed_or_claim']+' | Timeline: '+r['documented'])[:1800],
      witnesses=r['testimony_sources'].replace(' | ','; '),official_position=r['mainstream_explanation'],source_url=urls[0],extra_sources=' '.join(urls[1:6]),
      flag=r['verify'] if r['verify'] not in ('','False') else '',origin='qwm/What-Is-What-of-the-What-glitches.csv '+r['path_id']))
# precision: never a pin for geocoded centroids (Alex rule). region for regions/coasts/offshore/'near'/split places/big-city skies
REGION_IDS={'qwm-hs-01','qwm-hs-07','qwm-hs-08','qwm-hs-12','qwm-hs-14','qwm-hs-17','qwm-hs-18','qwm-hs-24','qwm-hs-26','qwm-hs-28',
            'qwm-gl-G12.2.1.3','qwm-gl-G12.4.1.5','qwm-gl-G12.4.1.10','qwm-gl-G12.4.1.11','qwm-gl-G12.2.1.2'}
import math
def bbox_km(g):
    try:
        s_,n_,w_,e_=map(float,g['boundingbox']); lat=(s_+n_)/2
        dy=(n_-s_)*111.2; dx=(e_-w_)*111.2*math.cos(math.radians(lat)); return 0.5*math.hypot(dx,dy)
    except Exception: return None
for x in rows:
    q=re.search(r'query "([^"]+)"',x['coord_method']).group(1); g=cache.get(q) or {}
    bk=bbox_km(g)
    if x['id'] in REGION_IDS:
        x['coord_precision']='region'; x['coord_radius_km']=round(min(300,max(25,bk or 100)) if bk and bk>25 else 100,1)
    else:
        x['coord_precision']='locality'; x['coord_radius_km']=round(min(50,max(10,bk or 10)),1)
    x['coord_source']='geocoded from place name via OpenStreetMap Nominatim (osm %s/%s; radius from the result bounding box, floor %s km)'%(g.get('osm_type','?'),g.get('osm_id','?'),'100' if x['coord_precision']=='region' else '10')
# glitch rows in G12.2.2 lacking URLs -> note
for r in csv.DictReader(open(GL,encoding='utf-8')):
    if r['path_id'].startswith('G12.2.2'):
        unpl.append(dict(id='qwm-gl-'+r['path_id'],name=r['name'],date=r['year'],place='',source_url='',origin='qwm glitches '+r['path_id'],reason='no source URL in the row (cross-link entry only)'))
with open(os.path.join(DATA,'sources','qwm_uap_cases.csv'),'w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,FIELDS); w.writeheader(); [w.writerow(x) for x in rows]
with open(os.path.join(DATA,'unplotted.csv'),'w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,['id','name','date','place','source_url','origin','reason']); w.writeheader(); [w.writerow(x) for x in unpl]
print('plotted',len(rows),'unplotted',len(unpl))
for x in rows: print(x['id'],x['date'],x['lat'],x['lon'],x['coord_method'][60:150])
