"""Extra reference layers: CNEOS fireballs, HydroLAKES, GEBCO TID 'never directly mapped' overlay.
Usage: python data/tools/build_extra.py [RAW_DIR]   (RAW_DIR default /workspace/gm_build/new)
Inputs (downloaded once, not committed except the small fireball JSON):
  data/sources/external/cneos_fireball.json      https://ssd-api.jpl.nasa.gov/fireball.api?req-loc=true&req-alt=true&req-vel=true
  RAW/hl/HydroLAKES_points_v10_shp/*.shp          https://data.hydrosheds.org/file/hydrolakes/HydroLAKES_points_v10_shp.zip
  data/sources/external/wikidata_trenches.json   Wikidata SPARQL: instances of oceanic trench (Q119253) with P625, P4511, P2043
  data/sources/external/wikidata_deeps.json      Wikidata entity data for named deeps (Challenger, Sirena, Horizon, Milwaukee, Molloy, ...)
  RAW/tid/*.tif                                   GEBCO 2025 TID grid (GeoTIFF), https://www.gebco.net/data-products/gridded-bathymetry-data
"""
import base64, glob, io, json, math, os, sys
DATA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAY = os.path.join(DATA, 'layers')
RAW = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != 'trenches' else '/workspace/gm_build/new'

def reg(name, payload):
    open(os.path.join(LAY, name + '.js'), 'w', encoding='utf-8').write('GM.reg(%s,%s);\n' % (json.dumps(name), json.dumps(payload, ensure_ascii=False, separators=(',', ':'))))

def fireballs():
    d = json.load(open(os.path.join(DATA, 'sources', 'external', 'cneos_fireball.json')))
    F = d['fields']; items = []
    for row in d['data']:
        r = dict(zip(F, row))
        if not r.get('lat') or not r.get('lon'): continue
        lat = float(r['lat']) * (1 if r['lat-dir'] == 'N' else -1); lon = float(r['lon']) * (1 if r['lon-dir'] == 'E' else -1)
        items.append(dict(name='Fireball ' + r['date'][:16] + ' UTC', date=r['date'][:10], time_utc=r['date'][11:], lat=lat, lon=lon,
                          energy_e10j=r['energy'], impact_energy_kt=r['impact-e'], alt_km=r.get('alt'), vel_kms=r.get('vel'),
                          coord_precision='locality', source_url='https://cneos.jpl.nasa.gov/fireballs/', dataset='NASA JPL CNEOS fireball and bolide reports'))
    reg('fireballs', dict(title='CNEOS fireballs and bolides', type='points', items=items, api_signature=d.get('signature'),
                          source='NASA JPL Center for Near Earth Object Studies (CNEOS), Fireball and Bolide Reports, data reported by US Government sensors; ssd-api.jpl.nasa.gov/fireball.api (US Government work, public domain)'))
    print('fireballs', len(items))

def hydrolakes():
    import shapefile
    shp = glob.glob(os.path.join(RAW, 'hl', '**', '*.shp'), recursive=True)
    if not shp: print('hydrolakes: skipped (no shapefile)'); return
    r = shapefile.Reader(shp[0], encoding='cp1252', encodingErrors='replace'); big = []; tiles = {}
    VS = {1: 'reported (literature)', 2: 'reported (GRanD reservoir)', 3: 'modelled (no reported volume/bathymetry)'}
    for sr in r.iterShapeRecords():
        a = sr.record.as_dict(); x, y = sr.shape.points[0]
        it = [a['Hylak_id'], a['Lake_name'] or '', round(x, 4), round(y, 4), round(a['Lake_area'], 2), a['Depth_avg'], a['Vol_total'], a['Vol_src'], a['Country'] or '', a['Lake_type'], a['Elevation']]
        if a['Lake_area'] >= 10: big.append(it)
        elif a['Lake_area'] >= 1:
            k = '%d_%d' % (math.floor(y / 10) * 10, math.floor(x / 10) * 10); tiles.setdefault(k, []).append(it)
    cols = ['id', 'name', 'lon', 'lat', 'area_km2', 'depth_avg_m', 'vol_total_mcm', 'vol_src', 'country', 'lake_type', 'elevation_m']
    src = 'HydroLAKES v1.0 (Messager et al. 2016, Nature Communications 7:13603), HydroSHEDS, CC BY 4.0; points are lake pour points (outlets)'
    reg('hydrolakes', dict(title='HydroLAKES (area >= 10 km2)', type='points', cols=cols, rows=big, vol_src=VS, source=src, tiles=sorted(tiles)))
    td = os.path.join(LAY, 'hydrolakes_tiles'); os.makedirs(td, exist_ok=True)
    for f in glob.glob(os.path.join(td, '*.js')): os.remove(f)
    for k, rows in tiles.items(): reg('hydrolakes_tiles/' + k, dict(cols=cols, rows=rows))
    print('hydrolakes big', len(big), 'tiled 1-10 km2', sum(len(v) for v in tiles.values()), 'in', len(tiles), 'tiles; <1 km2 staged:', r.numRecords - len(big) - sum(len(v) for v in tiles.values()))

def tid():
    import numpy as np, tifffile
    from PIL import Image
    tifs = sorted(glob.glob(os.path.join(RAW, 'tid', '**', '*.tif'), recursive=True))
    if not tifs: print('tid: skipped (no GeoTIFFs)'); return
    W, H = 4096, 2048; mask = np.zeros((H, W), np.uint8)  # 0 land, 1 measured, 2 not directly measured
    meas_area = ocean_area = 0.0
    MEAS = set(range(10, 18)) | {44}
    for f in tifs:
        with tifffile.TiffFile(f) as t:
            a = t.asarray(); tags = t.pages[0].tags
            tie = tags['ModelTiepointTag'].value; sc = tags['ModelPixelScaleTag'].value
        lon0, lat0, dx, dy = tie[3], tie[4], sc[0], sc[1]
        h, w = a.shape
        lats = lat0 - (np.arange(h) + 0.5) * dy; wrow = np.cos(np.radians(lats))[:, None]
        ocean = a != 0; meas = np.isin(a, list(MEAS))
        ocean_area += float((ocean * wrow).sum()); meas_area += float((meas * wrow).sum())
        # downsample by sampling cell centres of the output grid (nearest)
        x0 = int(round((lon0 + 180) / 360 * W)); y0 = int(round((90 - lat0) / 180 * H))
        nx = int(round(w * dx / 360 * W)); ny = int(round(h * dy / 180 * H))
        ys = ((np.arange(ny) + 0.5) * h / ny).astype(int); xs = ((np.arange(nx) + 0.5) * w / nx).astype(int)
        sub = a[np.ix_(ys, xs)]
        m = np.where(sub == 0, 0, np.where(np.isin(sub, list(MEAS)), 1, 2)).astype(np.uint8)
        mask[y0:y0 + ny, x0:x0 + nx] = m
        del a
        print('tid tile', os.path.basename(f))
    pct = 100 * meas_area / ocean_area
    rgba = np.zeros((H, W, 4), np.uint8); un = mask == 2
    rgba[un] = (40, 120, 255, 120)  # translucent blue = never directly measured
    buf = io.BytesIO(); Image.fromarray(rgba, 'RGBA').save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    reg('gebco_unmapped', dict(title='Seafloor not directly measured (GEBCO TID)', type='overlay', uri=uri, w=W, h=H,
        pct_measured_computed=round(pct, 2), measured_codes='TID 10-17 and 44 (as in GEBCO WMS)', grid=os.path.basename(os.path.dirname(tifs[0])),
        source='GEBCO Compilation Group (2025) GEBCO 2025 Grid, Type Identifier (TID) grid (doi:10.5285/37c52e96-24ea-67ce-e063-7086abc05f29); downsampled to 4096x2048 by nearest sampling'))
    print('tid: area-weighted share of ocean grid cells with direct measurements (computed from TID): %.2f%%' % pct)

def trenches():
    """Oceanic trenches and named deeps from Wikidata (CC0). Coordinates are Wikidata's nominal point for the
    feature (a centroid for a trench, a sounding position for a deep), so precision is 'region' or 'locality'.
    Depth only where Wikidata states it (P4511); nothing is filled in."""
    items, seen = [], set()
    j = json.load(open(os.path.join(DATA, 'sources', 'external', 'wikidata_trenches.json')))
    for b in j['results']['bindings']:
        q = b['i']['value'].rsplit('/', 1)[1]; name = b['iLabel']['value']; c = b['coord']['value']
        if not c.startswith('Point(') or name == q or q in seen: continue
        seen.add(q); lon, lat = map(float, c[6:-1].split())
        d = b.get('depth', {}).get('value'); ln = b.get('len', {}).get('value')
        items.append(dict(name=name, kind='trench', lat=round(lat, 4), lon=round(lon, 4), depth_m=str(round(float(d))) if d else '',
                          length_km=str(round(float(ln) / 1000)) if ln else '', coord_precision='region',
                          coord_source='Wikidata P625 (nominal feature point)', source_url='https://www.wikidata.org/wiki/' + q, dataset='Wikidata (CC0)'))
    for q, e in json.load(open(os.path.join(DATA, 'sources', 'external', 'wikidata_deeps.json'))).items():
        if q in seen or not e.get('coord'): continue
        seen.add(q); d = (e.get('depth') or [''])[0]
        items.append(dict(name=e['label'], kind='deep', lat=round(e['coord']['latitude'], 4), lon=round(e['coord']['longitude'], 4),
                          depth_m=str(round(float(d))) if d else '', length_km='', coord_precision='locality', note=e.get('desc') or '',
                          coord_source='Wikidata P625', source_url='https://www.wikidata.org/wiki/' + q, dataset='Wikidata (CC0)'))
    reg('trenches', dict(title='Oceanic trenches and deeps (Wikidata)', type='points', items=items,
        source='Wikidata (CC0): instances of oceanic trench (Q119253) and named deeps; query in data/tools/build_extra.py'))
    print('trenches', len(items))

if __name__ == '__main__':
    os.makedirs(LAY, exist_ok=True)
    if 'trenches' in sys.argv: trenches(); sys.exit()
    fireballs(); hydrolakes(); tid(); trenches()
