"""Build all reference layers for the Global Map App from raw open datasets.
Usage: python build_layers.py RAW_DIR   (RAW_DIR holds the downloads listed in CREDITS.md)
Every output is a JS file calling GM.reg(name, payload) so it loads from file:// without a server.
Nothing here invents data: each record comes from a cited dataset; only geometry is simplified."""
import json, csv, os, sys, re, zipfile, io, math, base64, collections, datetime
from shapely.geometry import shape, LineString, MultiLineString, Point, mapping
from shapely.prepared import prep
from shapely.strtree import STRtree
RAW=sys.argv[1] if len(sys.argv)>1 else '/workspace/gm_build'
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'layers')
os.makedirs(OUT,exist_ok=True); os.makedirs(os.path.join(OUT,'postal'),exist_ok=True)
def R(p): return os.path.join(RAW,p)
def gj(p): return json.load(open(R(p),encoding='utf-8'))
def write(name,payload,sub=''):
    fn=os.path.join(OUT,sub,name+'.js')
    s='GM.reg(%s,%s);\n'%(json.dumps((sub+'/' if sub else '')+name),json.dumps(payload,separators=(',',':'),ensure_ascii=False))
    open(fn,'w',encoding='utf-8').write(s); print('wrote',fn,round(len(s)/1e6,2),'MB')
Q=1000  # coordinate quantization: 1e-3 deg (~110 m)
def qline(coords):
    out=[]
    for c in coords: out+= [int(round(c[0]*Q)),int(round(c[1]*Q))]
    return out
def lines_from(geom,tol):
    g=geom.simplify(tol,preserve_topology=False) if tol else geom
    if g.is_empty: return []
    if g.geom_type=='LineString': gs=[g]
    elif g.geom_type in('MultiLineString','GeometryCollection'): gs=[x for x in g.geoms if x.geom_type=='LineString']
    elif g.geom_type=='Polygon': gs=[LineString(g.exterior.coords)]+[LineString(i.coords) for i in g.interiors]
    elif g.geom_type=='MultiPolygon': gs=[LineString(p.exterior.coords) for p in g.geoms]
    else: gs=[]
    return [qline(x.coords) for x in gs if len(x.coords)>1]
def line_layer(src,name,tol,meta,filt=None,props=None):
    d=gj(src); L=[]; P=[]
    for f in d['features']:
        if not f.get('geometry'): continue
        if filt and not filt(f['properties']): continue
        ls=lines_from(shape(f['geometry']),tol)
        for l in ls:
            L.append(l)
            if props: P.append(props(f['properties']))
    pl=dict(meta,type='lines',q=Q,lines=L)
    if props: pl['props']=P
    write(name,pl); return pl

# ---------- base geography ----------
NE='Natural Earth (public domain), naturalearthdata.com'
line_layer('ne_50m_coastline.geojson','coast50',0,dict(title='Coastlines 1:50m',source=NE))
line_layer('ne_50m_admin_0_boundary_lines_land.geojson','admin0_50',0,dict(title='Country borders 1:50m',source=NE))
line_layer('ne_10m_admin_0_boundary_lines_land.geojson','admin0_10',0.002,dict(title='Country borders 1:10m',source=NE))
line_layer('ne_10m_coastline.geojson','coast10',0.003,dict(title='Coastlines 1:10m',source=NE))
line_layer('ne_10m_admin_1_states_provinces_lines.geojson','admin1_10',0.003,dict(title='States/provinces 1:10m',source=NE))
# countries: meta + id raster for shader highlights + label points
countries=gj('ne_10m_admin_0_countries.geojson')['features']
cmeta=[]; cshapes=[]
for i,f in enumerate(countries):
    p=f['properties']; g=shape(f['geometry']); cshapes.append(g)
    iso=p['ISO_A3'] if p['ISO_A3']!='-99' else (p['ISO_A3_EH'] if p['ISO_A3_EH']!='-99' else p['ADM0_A3'])
    b=g.bounds
    cmeta.append(dict(i=i+1,name=p['NAME'],admin=p['ADMIN'],iso3=iso,a3=p['ADM0_A3'],iso2=p['ISO_A2_EH'],continent=p['CONTINENT'],lx=p['LABEL_X'],ly=p['LABEL_Y'],minl=p['MIN_LABEL'],pop=p['POP_EST'],bbox=[round(x,2) for x in b]))
from PIL import Image, ImageDraw
W,H=4096,2048
img=Image.new('RGB',(W,H),(0,0,0)); dr=ImageDraw.Draw(img)
def px(x,y): return ((x+180)/360*W,(90-y)/180*H)
for m,g in zip(cmeta,cshapes):
    col=(m['i']%256,m['i']//256,0)
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
    for pg in polys:
        dr.polygon([px(x,y) for x,y in pg.exterior.coords],fill=col)
        for h in pg.interiors: dr.polygon([px(x,y) for x,y in h.coords],fill=(0,0,0))
buf=io.BytesIO(); img.save(buf,'PNG',optimize=True)
write('countries',dict(title='Countries (Natural Earth 1:10m admin-0)',source=NE,countries=cmeta,idmap='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()))
ctree=STRtree(cshapes)
def country_at(lon,lat):
    pt=Point(lon,lat)
    for idx in ctree.query(pt):
        if cshapes[idx].contains(pt): return cmeta[idx]
    # nearest within ~50 km for coastal/offshore points
    idx=ctree.nearest(pt)
    if idx is not None and cshapes[idx].distance(pt)<0.5: return cmeta[idx]
    return None
# continents labels
cont=[]
for f in gj('ne_110m_geography_regions_polys.geojson')['features']:
    p=f['properties']
    if p['FEATURECLA']=='Continent':
        c=shape(f['geometry']).representative_point(); cont.append([p['NAME_EN'] or p['NAME'],round(c.x,2),round(c.y,2)])
# places (NE populated places)
places=[]
for f in gj('ne_10m_populated_places_simple.geojson')['features']:
    p=f['properties']; places.append([p['name'],round(p['longitude'],4),round(p['latitude'],4),p['scalerank'],p['pop_max'],p['adm0name'],p['featurecla']])
write('labels_base',dict(title='Labels: continents, countries, populated places',source=NE+' (geography regions, admin-0 label points, populated places)',continents=cont,places=places))
# admin1 labels (lazy)
a1=[[p['properties']['name'],round(p['properties']['longitude'],3),round(p['properties']['latitude'],3),p['properties']['admin'],p['properties']['labelrank']] for p in gj('ne_10m_admin_1_states_provinces.geojson')['features'] if p['properties'].get('name')]
write('labels_admin1',dict(title='States/provinces labels',source=NE,items=a1))
# GeoNames cities
def geonames_cities(zipname,minpop,exclude=None):
    z=zipfile.ZipFile(R(zipname)); txt=z.read(z.namelist()[0]).decode('utf-8')
    out=[]
    for line in txt.splitlines():
        c=line.split('\t')
        if exclude and c[0] in exclude: continue
        out.append([c[1],round(float(c[5]),4),round(float(c[4]),4),int(c[14] or 0),c[8],c[0]])
    return out
c15=geonames_cities('cities15000.zip',15000)
ids15={x[5] for x in c15}
write('cities15000',dict(title='Cities (pop >= 15,000)',source='GeoNames cities15000 (CC BY 4.0), geonames.org',items=[x[:5] for x in c15]))
c5=geonames_cities('cities5000.zip',5000,exclude=ids15)
write('cities5000',dict(title='Towns/municipalities (pop 5,000-15,000)',source='GeoNames cities5000 (CC BY 4.0), geonames.org',items=[x[:5] for x in c5]))
# postal codes (lazy per country)
pidx={}
for fn in sorted(os.listdir(R('postal'))):
    cc=fn[:2]; z=zipfile.ZipFile(R('postal/'+fn)); txt=z.read(cc+'.txt').decode('utf-8'); items=[]
    for line in txt.splitlines():
        c=line.split('\t')
        try: items.append([c[1],c[2],round(float(c[10]),4),round(float(c[9]),4),c[3],int(c[11] or 0)])
        except: pass
    write(cc,dict(title='Postal codes '+cc,source='GeoNames postal code dump %s (CC BY 4.0), download.geonames.org/export/zip'%cc,items=items),sub='postal')
    pidx[cc]=len(items)
write('postal_index',dict(countries=pidx,source='GeoNames postal codes (CC BY 4.0)'))
# urban areas (outline layer) + designation helper
urb=[shape(f['geometry']) for f in gj('ne_10m_urban_areas.geojson')['features']]
utree=STRtree(urb)
def urban_at(lon,lat):
    pt=Point(lon,lat)
    for i in utree.query(pt):
        if urb[i].contains(pt): return 'Urban (inside a Natural Earth 1:10m urban-area polygon, derived from 2002-03 MODIS)'
    i=utree.nearest(pt); d=urb[i].distance(pt)*111
    return 'Outside mapped urban areas (rural or small town; nearest NE urban polygon ~%d km)'%round(d)
line_layer('ne_10m_urban_areas.geojson','urban',0.003,dict(title='Urban areas (outlines)',source=NE+' 1:10m urban areas (MODIS 2002-2003 derived)'))
# ---------- water ----------
line_layer('ne_10m_rivers_lake_centerlines.geojson','rivers10',0.003,dict(title='Rivers & lake centerlines 1:10m',source=NE),props=lambda p:[p.get('name') or '',p.get('scalerank')])
line_layer('ne_10m_lakes.geojson','lakes10',0.003,dict(title='Lakes 1:10m (outlines)',source=NE),props=lambda p:[p.get('name') or '',p.get('scalerank')])
# ---------- geology ----------
line_layer('pb2002_boundaries.json','plates',0,dict(title='Plate boundaries (Bird 2003, PB2002)',source='Bird, P. (2003) An updated digital model of plate boundaries, G3 4(3) 1027; GeoJSON by fraxen/tectonicplates (ODC-By 1.0)'),props=lambda p:[p.get('Name',''),p.get('Type',''),p.get('Source','')])
line_layer('gem_faults.geojson','faults_gem',0.002,dict(title='GEM Global Active Faults',source='GEM Global Active Faults Database (Styron & Pagani 2020, Earthquake Spectra), CC BY-SA 4.0, github.com/GEMScienceTools/gem-global-active-faults'),props=lambda p:[p.get('name') or '',p.get('slip_type') or '',p.get('net_slip_rate') or '',p.get('catalog_name') or ''])
try:
    import shapefile
    z=zipfile.ZipFile(R('qfaults.zip')); tmp=R('qf'); z.extractall(tmp)
    sf=shapefile.Reader(os.path.join(tmp,'SHP','Qfaults_US_Database.shp'))
    flds=[f[0] for f in sf.fields[1:]]; print('qfaults fields',flds[:30])
    L=[];P=[]
    for sr in sf.iterShapeRecords():
        rec=dict(zip(flds,sr.record)); g=shape(sr.shape.__geo_interface__)
        for l in lines_from(g,0.002):
            L.append(l); P.append([str(rec.get('fault_name') or rec.get('FaultName') or rec.get('NAME') or ''),str(rec.get('age') or rec.get('Age') or ''),str(rec.get('slip_sense') or rec.get('SlipSense') or rec.get('slip_rate') or '')])
    write('faults_usgs',dict(title='USGS Quaternary Faults (US)',source='USGS Quaternary Fault and Fold Database of the United States (public domain), usgs.gov/programs/earthquake-hazards/faults',type='lines',q=Q,lines=L,props=P))
except Exception as ex: print('qfaults failed',ex)
# volcanoes
V=[]
for f in gj('gvp_holocene.json')['features']:
    p=f['properties']; ly=p.get('Last_Eruption_Year')
    V.append(dict(name=p['Volcano_Name'],lon=p['Longitude'],lat=p['Latitude'],type=p.get('Primary_Volcano_Type'),last_eruption=('%d CE'%ly if ly is not None and ly>=0 else ('%d BCE'%-ly if ly is not None else 'Unknown')),elevation_m=p.get('Elevation'),country=p.get('Country'),evidence=p.get('Evidence_Category'),url='https://volcano.si.edu/volcano.cfm?vn=%s'%p['Volcano_Number']))
write('volcanoes',dict(title='Holocene volcanoes (Smithsonian GVP)',source='Global Volcanism Program, Smithsonian Institution: Volcanoes of the World v5 (Holocene list), via GVP WFS; cite: Global Volcanism Program (2024) Volcanoes of the World, doi:10.5479/si.GVP.VOTW5-2024.5.2',type='points',items=V))
# nuclear power reactors
N=[]
for r in csv.DictReader(open(R('GeoNuclearData-master/data/csv/denormalized/nuclear_power_plants.csv'),encoding='utf-8')):
    if not r['Latitude']: continue
    N.append(dict(name=r['Name'],lon=float(r['Longitude']),lat=float(r['Latitude']),kind='Power reactor',country=r['Country'],status=r['Status'],reactor=r['ReactorType']+(' '+r['ReactorModel'] if r['ReactorModel'] else ''),capacity_mw=r['Capacity'],construction_start=r['ConstructionStartAt'],operational_from=r['OperationalFrom'],operational_to=r['OperationalTo'],src=r['Source'],iaea_id=r['IAEAId'],url=('https://pris.iaea.org/PRIS/CountryStatistics/ReactorDetails.aspx?current=%s'%r['IAEAId']) if r['IAEAId'] else '',coord_note='GeoNuclearData coordinates (site-level; from WNA/IAEA/Google Maps per row)'))
write('nuclear',dict(title='Nuclear power reactors',source='GeoNuclearData v0.17 (Cristian Stoica, ODbL 1.0), derived from IAEA PRIS and World Nuclear Association; github.com/cristianst85/GeoNuclearData',type='points',items=N))
json.dump(dict(),open(os.path.join(OUT,'..','tools','.layers_ok'),'w'))
# export helpers for other scripts
import pickle
pickle.dump(dict(cmeta=cmeta),open(os.path.join(RAW,'cmeta.pkl'),'wb'))
if __name__=='__main__':
    pass
