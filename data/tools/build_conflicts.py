"""Wars / conflicts / genocides layer. Sources (all open, cited per item):
 UCDP/PRIO Armed Conflict Dataset v25.1 (1946-2024), UCDP Battle-Related Deaths v25.1 (conflict-year, 1989-2024),
 UCDP One-Sided Violence v25.1, UCDP GED v25.1 (aggregated), Correlates of War Inter/Intra/Extra-State War Data (v4.0/4.1/4.0).
 Genocides: only tolls stated by USHMM, UN, ICTY, Yale GSP (URLs per item). No tolls are interpolated; sums of
 sourced annual figures are labelled as sums."""
import csv, json, os, sys, collections, datetime, pickle
RAW=sys.argv[1] if len(sys.argv)>1 else '/workspace/gm_build'
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'layers')
W=os.path.join(RAW,'war')
cmeta=pickle.load(open(os.path.join(RAW,'cmeta.pkl'),'rb'))['cmeta']
byname={}
for m in cmeta:
    for k in (m['name'],m['admin']): byname[k.lower()]=m['iso3']
ALIAS={'united states of america':['USA'],'russia (soviet union)':['RUS'],'russia':['RUS'],'ussr':['RUS'],'soviet union':['RUS'],'ottoman empire':['TUR'],'turkey':['TUR'],
 'austria-hungary':['AUT','HUN'],'german federal republic':['DEU'],'german democratic republic':['DEU'],'germany':['DEU'],'prussia':['DEU'],'czechoslovakia':['CZE','SVK'],
 'yugoslavia':['SRB','MNE','BIH','HRV','SVN','MKD','XKX'],'serbia (yugoslavia)':['SRB'],'serbia':['SRB'],'yemen arab republic':['YEM'],"yemen people's republic":['YEM'],'yemen (north yemen)':['YEM'],'south yemen':['YEM'],
 'korea':['KOR','PRK'],'north korea':['PRK'],'south korea':['KOR'],'vietnam':['VNM'],'vietnam (north vietnam)':['VNM'],'republic of vietnam':['VNM'],'south vietnam':['VNM'],'drv':['VNM'],
 'cambodia (kampuchea)':['KHM'],'cambodia':['KHM'],'myanmar (burma)':['MMR'],'myanmar':['MMR'],'burma':['MMR'],'dr congo (zaire)':['COD'],'democratic republic of the congo':['COD'],'zaire':['COD'],'congo':['COG'],
 'ivory coast':['CIV'],"cote d'ivoire":['CIV'],'zimbabwe (rhodesia)':['ZWE'],'rhodesia':['ZWE'],'madagascar (malagasy)':['MDG'],'iran':['IRN'],'persia':['IRN'],'bosnia-herzegovina':['BIH'],'bosnia and herzegovina':['BIH'],
 'united kingdom':['GBR'],'tanzania':['TZA'],'syria':['SYR'],'laos':['LAO'],'east timor':['TLS'],'timor-leste':['TLS'],'macedonia, fyr':['MKD'],'macedonia':['MKD'],'north macedonia':['MKD'],'eswatini':['SWZ'],'swaziland':['SWZ'],
 'cabinda':['AGO'],'hyderabad':['IND'],'tibet':['CHN'],'manchuria':['CHN'],'surinam':['SUR'],'kingdom of yugoslavia':['SRB'],'guinea-bissau':['GNB'],'central african republic':['CAF'],'south sudan':['SSD'],'sudan':['SDN'],
 'bolivia':['BOL'],'venezuela':['VEN'],'moldova':['MDA'],'czech republic':['CZE'],'gambia':['GMB'],'comoros':['COM'],'brunei':['BRN'],'taiwan':['TWN'],'china':['CHN'],'india':['IND'],'israel':['ISR'],'palestine':['PSE'],
 'papua new guinea':['PNG'],'trinidad and tobago':['TTO'],'dominican republic':['DOM'],'equatorial guinea':['GNQ'],'cape verde':['CPV'],'solomon islands':['SLB']}
iso_set={m['iso3'] for m in cmeta}
def to_iso(name):
    n=name.strip().lower()
    if n in ALIAS: return [x for x in ALIAS[n] if x in iso_set]
    if n in byname: return [byname[n]]
    return []
cow_names={}
for r in csv.DictReader(open(os.path.join(W,'COW-country-codes.csv'),encoding='latin-1',newline='')):
    cow_names[int(r['CCode'])]=r['StateNme']
def gw_iso(code):
    try: c=int(code)
    except: return []
    return to_iso(cow_names.get(c,''))
unmapped=collections.Counter()
items=[]
TYPE_UCDP={'1':'extra-state','2':'interstate','3':'civil','4':'civil (internationalized)'}
# ---- UCDP ACD ----
acd=collections.defaultdict(list)
for r in csv.DictReader(open(os.path.join(W,'UcdpPrioConflict_v25_1.csv'),encoding='utf-8')): acd[r['conflict_id']].append(r)
brd=collections.defaultdict(dict)
for r in csv.DictReader(open(os.path.join(W,'BattleDeaths_v25_1_conf.csv'),encoding='utf-8')):
    brd[r['conflict_id']][int(r['year'])]=(int(r['bd_best']),int(r['bd_low']),int(r['bd_high']))
osv=list(csv.DictReader(open(os.path.join(W,'OneSided_v25_1.csv'),encoding='utf-8')))
for cid,rows in acd.items():
    rows.sort(key=lambda r:int(r['year'])); last=rows[-1]; first=rows[0]
    years=[int(r['year']) for r in rows]
    isos=[]
    for code in set(','.join(r['gwno_loc'] for r in rows).split(',')):
        for i in gw_iso(code.strip()):
            if i not in isos: isos.append(i)
    if not isos:
        for nm in last['location'].split(','):
            isos+=to_iso(nm)
            if not to_iso(nm): unmapped[nm.strip()]+=1
    end = last['ep_end_date'] if last['ep_end']=='1' and last['ep_end_date'] else (str(last['year'])+'-12-31')
    ongoing = last['year']=='2024' and last['ep_end']!='1'
    b=brd.get(cid,{})
    peryear={y:{'best':v[0],'low':v[1],'high':v[2]} for y,v in sorted(b.items())}
    peak=max(b.items(),key=lambda kv:kv[1][0])[0] if b else None
    tot=(sum(v[1] for v in b.values()),sum(v[2] for v in b.values()),sum(v[0] for v in b.values())) if b else None
    # civilians: UCDP one-sided violence by conflict parties (actor-name match), within conflict years
    parties={x.strip() for r in rows for x in (r['side_a']+', '+r['side_b']).split(',') if x.strip()}
    cs=[(int(o['best_fatality_estimate']),int(o['low_fatality_estimate']),int(o['high_fatality_estimate'])) for o in osv if o['actor_name'] in parties and int(o['year']) in years]
    civ=dict(low=sum(x[1] for x in cs),high=sum(x[2] for x in cs),best=sum(x[0] for x in cs),src='UCDP One-Sided Violence v25.1: sum of annual fatalities by actors that are parties to this conflict, in its active years (actor-name match)') if cs else None
    items.append(dict(id='ucdp-'+cid,name='%s vs %s'%(last['side_a'],last['side_b'])+(' ('+last['territory_name']+')' if last['territory_name'] else ''),
      type=TYPE_UCDP.get(last['type_of_conflict'],'?'),start=first['start_date'],end=('' if ongoing else end),ongoing_as_of=('2024 (UCDP v25.1 last year)' if ongoing else ''),
      years=years,intensity={r['year']:int(r['intensity_level']) for r in rows},location=last['location'],countries=isos,
      deaths=(dict(low=tot[0],high=tot[1],best=tot[2],src='UCDP Battle-Related Deaths v25.1: sum of annual low/high/best estimates, %d-%d'%(min(b),max(b))) if tot else None),
      peryear=peryear,peak=(dict(year=peak,best=b[peak][0],src='UCDP BRD v25.1: year of maximum annual best estimate') if peak else None),civilians=civ,displaced=None,
      source='UCDP/PRIO Armed Conflict Dataset v25.1 (Davies, Engström, Pettersson & Öberg 2025; Gleditsch et al. 2002), ucdp.uu.se, CC BY 4.0',url='https://ucdp.uu.se/conflict/'+cid,dataset='UCDP'))
# ---- COW ----
def cdate(y,m,d):
    try: y=int(y); m=int(m or -9); d=int(d or -9)
    except ValueError: return ''
    if y<0: return ''
    return '%04d-%02d-%02d'%(y,m if m>0 else 1,d if d>0 else 1)
def ii(x):
    x=(x or '').replace(',','').strip()
    try: return int(float(x))
    except: return -9
def cow_read(fn): return list(csv.DictReader(open(os.path.join(W,fn),encoding='latin-1',newline='')))
REG={'1':'W. Hemisphere','2':'Europe','4':'Africa','6':'Middle East','7':'Asia','9':'Oceania','11':'Europe & Middle East','12':'Europe & Asia','13':'W. Hemisphere & Asia','14':'Europe, Africa & Middle East','15':'Europe, Africa, Middle East & Asia','16':'Africa, Middle East & Asia','17':'Asia & Oceania','18':'Asia & Middle East','19':'Europe, Africa, Middle East, Asia & Oceania'}
def span(rows,ks=('StartYear1','StartMonth1','StartDay1'),ke=('EndYear1','EndMonth1','EndDay1')):
    st=[cdate(r[ks[0]],r[ks[1]],r[ks[2]]) for r in rows]; en=[]
    for r in rows:
        en.append(cdate(r[ke[0]],r[ke[1]],r[ke[2]]))
        if 'EndYear2' in r and int((r['EndYear2'] or '-8').strip() or -8)>0: en.append(cdate(r['EndYear2'],r['EndMonth2'],r.get('EndDay2',r.get('EndDay2 ','-9'))))
        if False and 'EndDay2 ' in r and int((r.get('EndYear2') or '-8').strip() or -8)>0: en.append(cdate(r['EndYear2'],r['EndMonth2'],r['EndDay2 ']))
    st=[s for s in st if s]; en=[e for e in en if e]
    return (min(st) if st else ''),(max(en) if en else '')
COWSRC='Correlates of War Project, %s (Sarkees & Wayman 2010, Resort to War), correlatesofwar.org'
inter=collections.defaultdict(list)
for r in cow_read('Inter-StateWarData_v4.0.csv'): inter[r['WarNum']].append(r)
for wn,rows in inter.items():
    s,e=span(rows)
    if not e or e<'1900': continue
    bd=[ii(r['BatDeath']) for r in rows]; known=[x for x in bd if x>=0]
    isos=[]
    for r in rows:
        for i in to_iso(r['StateName']) or gw_iso(r['ccode']):
            if i not in isos: isos.append(i)
    d=None
    if known:
        tot=sum(known); d=dict(low=tot,high=tot,best=tot,src='COW Inter-State War v4.0: sum of participant battle deaths'+(' (%d participant(s) unknown, so this is a floor)'%(len(bd)-len(known)) if len(known)<len(bd) else ''))
    items.append(dict(id='cow-inter-'+wn,name=rows[0]['WarName'],type='interstate',start=s,end=e,location=REG.get(rows[0]['WhereFought'],''),countries=isos,countries_note='participant states (modern borders), not only where fought',
      deaths=d,peryear={},peak=None,civilians=None,displaced=None,source=COWSRC%'Inter-State War Data v4.0',url='https://correlatesofwar.org/data-sets/cow-war/',dataset='COW'))
intra=collections.defaultdict(list)
for r in cow_read('Intra-StateWarData_v4.1.csv'): intra[r['WarNum']].append(r)
for wn,rows in intra.items():
    s,e=span(rows)
    if not e or e<'1900': continue
    sides={}
    for r in rows:
        for nm,v in ((r['SideA'],ii(r['SideADeaths'])),(r['SideB'],ii(r['SideBDeaths']))):
            if nm and nm!='-8': sides[nm]=max(sides.get(nm,-9),v)
    known=[v for v in sides.values() if v>=0]; d=None
    if known: tot=sum(known); d=dict(low=tot,high=tot,best=tot,src='COW Intra-State War v4.1: sum of battle deaths per distinct side'+('' if len(known)==len(sides) else ' (%d side(s) unknown; floor)'%(len(sides)-len(known))))
    isos=[]
    for r in rows:
        for i in gw_iso(r['CcodeA'])+gw_iso(r['CcodeB']):
            if i not in isos: isos.append(i)
    items.append(dict(id='cow-intra-'+wn,name=rows[0]['WarName'],type='civil',start=s,end=e,location=REG.get(rows[0]['WhereFought'],''),countries=isos,
      deaths=d,peryear={},peak=None,civilians=None,displaced=None,source=COWSRC%'Intra-State War Data v4.1',url='https://correlatesofwar.org/data-sets/cow-war/',dataset='COW'))
extra=collections.defaultdict(list)
for r in cow_read('Extra-StateWarData_v4.0.csv'): extra[r['WarNum']].append(r)
for wn,rows in extra.items():
    s,e=span(rows)
    if not e or e<'1900': continue
    bd=[ii(r['BatDeath']) for r in rows if ii(r['BatDeath'])>=0]; ns=[ii(r['NonStateDeaths']) for r in rows if ii(r['NonStateDeaths'])>=0]
    d=None
    if bd or ns: tot=sum(bd)+sum(ns); d=dict(low=tot,high=tot,best=tot,src='COW Extra-State War v4.0: state battle deaths + non-state deaths (where reported)')
    isos=[]
    for r in rows:
        for i in to_iso(r['SideB']):
            if i not in isos: isos.append(i)
    items.append(dict(id='cow-extra-'+wn,name=rows[0]['WarName'],type='extra-state',start=s,end=e,location=REG.get(rows[0]['WhereFought'],''),countries=isos,countries_note='highlight only where side B names a modern state; otherwise listed without area',
      deaths=d,peryear={},peak=None,civilians=None,displaced=None,source=COWSRC%'Extra-State War Data v4.0',url='https://correlatesofwar.org/data-sets/cow-war/',dataset='COW'))
# ---- Genocides (recognized sources only) ----
G=[
 dict(id='gen-holocaust',name='The Holocaust',start='1933-01-30',end='1945-05-08',location='Europe (USHMM: "throughout Europe")',countries=[],countries_note='no area highlight: USHMM describes the area only as Europe',
      deaths=dict(low=6000000,high=6000000,best=6000000,src='USHMM Holocaust Encyclopedia: "six million European Jews" (single figure; USHMM notes millions of other victims, not counted here)'),url='https://encyclopedia.ushmm.org/content/en/article/introduction-to-the-holocaust',source='United States Holocaust Memorial Museum'),
 dict(id='gen-cambodia',name='Cambodian genocide (Khmer Rouge)',start='1975-04-17',end='1979-01-07',start_note='Yale GSP gives 1975-1979',location='Cambodia',countries=['KHM'],
      deaths=dict(low=1671000,high=1871000,best=1700000,src='Yale Genocide Studies Program: "approximately 1.7 million" (21%); Kiernan (Yale GSP) demographic range 1.671-1.871 million'),url='https://macmillan.yale.edu/gsp/cambodian-genocide-program',source='Yale Genocide Studies Program / Cambodian Genocide Program; ECCC 2018 genocide judgement'),
 dict(id='gen-rwanda',name='Genocide against the Tutsi in Rwanda',start='1994-04-06',end='1994-07-04',location='Rwanda',countries=['RWA'],
      deaths=dict(low=1000000,high=None,best=None,src='UN Outreach Programme: "more than one million people are estimated to have perished" (lower bound only)'),url='https://www.un.org/en/preventgenocide/rwanda/historical-background.shtml',source='United Nations Outreach Programme on the 1994 Genocide against the Tutsi; ICTR'),
 dict(id='gen-srebrenica',name='Srebrenica genocide',start='1995-07-11',end='1995-07-19',location='Srebrenica, Bosnia and Herzegovina',countries=['BIH'],
      deaths=dict(low=7000,high=8000,best=None,src='ICTY (Krstić appeal judgement 2004; ICTY outreach): "between 7,000 and 8,000 Bosnian Muslim men and boys"'),url='https://www.icty.org/x/cases/krstic/acjug/en/krs-aj040419e.htm',source='International Criminal Tribunal for the former Yugoslavia'),
]
for g in G:
    g.update(type='genocide',peryear={},peak=None,civilians=None,displaced=None,dataset='Genocide (recognized sources)'); items.append(g)
# ---- GED aggregated (1 deg cell x month x conflict) ----
agg={}
for r in csv.DictReader(open(os.path.join(W,'GEDEvent_v25_1.csv'),encoding='utf-8')):
    lat=float(r['latitude']); lon=float(r['longitude']); k=(r['conflict_new_id'],round(lat),round(lon),r['date_start'][:7])
    a=agg.get(k)
    if not a: a=agg[k]=[0.0,0.0,0,0,0,0,r['type_of_violence'],r['date_start'][:10],r['country'],r['conflict_name']]
    a[0]+=lat; a[1]+=lon; a[2]+=1; a[3]+=int(r['best']); a[4]+=int(r['low']); a[5]+=int(r['high'])
    if r['date_start'][:10]<a[7]: a[7]=r['date_start'][:10]
names={}; ev=[]
for k,a in agg.items():
    if a[9] not in names: names[a[9]]=len(names)
    ev.append([round(a[0]/a[2],2),round(a[1]/a[2],2),a[7],a[2],a[3],a[4],a[5],int(a[6]),names[a[9]],a[8]])
ev.sort(key=lambda x:x[2])
json_ev=dict(title='UCDP GED events (aggregated)',source='UCDP Georeferenced Event Dataset v25.1 (Sundberg & Melander 2013; Davies et al. 2025), ucdp.uu.se, CC BY 4.0. Aggregated by conflict x 1-degree cell x month: position = mean of event coordinates, date = earliest event date in the cell-month, deaths = sums of event best/low/high.',
   fields=['lat','lon','date','events','best','low','high','violence_type','conflict','country'],violence_types={'1':'state-based','2':'non-state','3':'one-sided'},conflicts=list(names.keys()),events=ev)
def write(name,payload):
    s='GM.reg(%s,%s);\n'%(json.dumps(name),json.dumps(payload,separators=(',',':'),ensure_ascii=False)); open(os.path.join(OUT,name+'.js'),'w',encoding='utf-8').write(s); print('wrote',name,round(len(s)/1e6,2),'MB')
write('conflicts',dict(title='Wars, conflicts & genocides 1900-2026',source='UCDP/PRIO ACD v25.1, UCDP BRD v25.1, UCDP One-Sided v25.1, COW War Data v4.x, USHMM, UN, ICTY, Yale GSP (per item)',
  note='Displaced-people figures (UNHCR/IDMC) not yet loaded: column left blank. ACLED skipped (license/account required).',items=items))
write('ged',json_ev)
print('items',len(items),collections.Counter(i['type'] for i in items),'no-country',sum(1 for i in items if not i['countries']))
print('unmapped',unmapped.most_common(30))
