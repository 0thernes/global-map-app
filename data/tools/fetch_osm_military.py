import requests, json, time, os, sys
UA={'User-Agent':'GlobalMapApp/1.0 (personal research; contact via Alex Donahue)'}
EP=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter']
Q='''[out:json][timeout:300];
(
 nwr["military"~"^(base|naval_base|airfield|barracks|range|training_area|nuclear_explosion_site|office|checkpoint)$"]({s},{w},{n},{e});
 nwr["landuse"="military"]["name"]({s},{w},{n},{e});
);
out center tags;'''
chunks=[]
for la in [(-90,-40),(-40,-20),(-20,0),(0,20),(20,30),(30,40),(40,50),(50,60),(60,90)]:
    for lo in range(-180,180,30):
        chunks.append((la[0],lo,la[1],lo+30))
os.chdir(os.path.dirname(__file__))
for i,(s,w,n,e) in enumerate(chunks):
    fn=f'chunk_{i:02d}.json'
    if os.path.exists(fn) and os.path.getsize(fn)>100: continue
    for attempt in range(9):
        ep=EP[attempt%len(EP)]
        try:
            r=requests.post(ep,data={'data':Q.format(s=s,w=w,n=n,e=e)},headers=UA,timeout=330)
            if r.status_code==200 and r.text.startswith('{'):
                j=r.json()
                if 'remark' in j and 'error' in j.get('remark','').lower() : raise Exception(j['remark'][:200])
                json.dump(j,open(fn,'w')); print(i,(s,w,n,e),len(j['elements']),ep,flush=True); break
            print(i,'status',r.status_code,ep,r.text[:150].replace('\n',' '),flush=True)
        except Exception as ex: print(i,'err',ep,str(ex)[:200],flush=True)
        time.sleep(10)
    time.sleep(2)
print('DONE')
