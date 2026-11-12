import requests, json, time
UA={'User-Agent':'GlobalMapApp/1.0 (personal research; Alex Donahue)','Accept':'application/sparql-results+json'}
CLASSES={'Q18691599':'military base','Q695850':'air base','Q1324633':'naval base','Q1785071':'fort','Q4127976':'military airfield','Q245016':'military installation','Q1248784':'airport (military)'}
out={}
for q,label in CLASSES.items():
    sparql='''SELECT ?s ?sLabel ?coord ?cc ?ccLabel ?inc ?dis WHERE { ?s wdt:P31/wdt:P279* wd:%s ; wdt:P625 ?coord . OPTIONAL{?s wdt:P17 ?cc} OPTIONAL{?s wdt:P571 ?inc} OPTIONAL{?s wdt:P576 ?dis}
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,es,ru,zh,ja,ar". } }'''%q
    if q=='Q1248784': continue
    for a in range(4):
        try:
            r=requests.get('https://query.wikidata.org/sparql',params={'query':sparql},headers=UA,timeout=200)
            if r.status_code==200: break
            print(q,r.status_code); time.sleep(20)
        except Exception as ex: print(q,ex); time.sleep(20)
    else: continue
    rows=r.json()['results']['bindings']; print(label,len(rows),flush=True)
    for b in rows:
        qid=b['s']['value'].rsplit('/',1)[1]
        if qid in out: continue
        c=b['coord']['value']
        if not c.startswith('Point('): continue
        lon,lat=map(float,c[6:-1].split())
        out[qid]=dict(qid=qid,name=b.get('sLabel',{}).get('value',qid),lat=lat,lon=lon,cls=label,country=b.get('ccLabel',{}).get('value',''),inception=b.get('inc',{}).get('value','')[:10],dissolved=b.get('dis',{}).get('value','')[:10])
    time.sleep(5)
json.dump(list(out.values()),open('wd_military.json','w'))
print('DONE',len(out))
