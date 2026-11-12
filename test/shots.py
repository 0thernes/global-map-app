"""Headless render check + screenshots + FPS measurement. Usage: python test/shots.py [quick]
Chromium with SwiftShader (software WebGL); loads index.html over file:// (no server needed)."""
import sys, os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SHOTS = os.path.join(ROOT, 'shots'); os.makedirs(SHOTS, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'index.html')
errors = []; report = {}
def shot(page, name): p = os.path.join(SHOTS, name); page.screenshot(path=p); print('shot', p, flush=True)
def ev(page, js): return page.evaluate(js)
def layers_on(page, ids): ev(page, "async (ids)=>{for(const id of ids){const cb=document.querySelector(`[data-layer='${id}']`); if(cb&&!cb.checked){cb.click();}}}".replace('async (ids)', 'async ()').replace('ids)', json.dumps(ids) + ')', 1) if False else "async()=>{const ids=%s; for(const id of ids){const cb=document.querySelector(`[data-layer='${id}']`); if(cb&&!cb.checked){cb.click();}}}" % json.dumps(ids))
def wait_loaded(page, ids, t=180000): page.wait_for_function("()=>%s.every(id=>{const l=window.GMAPP.ctx.layers.find(x=>x.id===id); return l&&(l.loaded||l.failed)})" % json.dumps(ids), timeout=t)
def fps(page, ms=5000):
    page.wait_for_timeout(ms); return ev(page, "()=>({fps:+window.GM_PERF.fps().toFixed(1), cpu_ms_per_frame:+window.GM_PERF.cpuMs().toFixed(2), points:window.GMAPP.ctx.layers.filter(l=>l.on&&l.items&&l.pts).reduce((a,l)=>a+l.items.length,0)+window.GMAPP.ctx.cases.length, dpr: window.GMAPP.ctx.globe.renderer.getPixelRatio()})")
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'])
    page = b.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1)
    page.on('console', lambda m: (m.type in ('error', 'warning')) and errors.append(f'{m.type}: {m.text}'))
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(URL); page.wait_for_function('document.body.dataset.ready==="1"', timeout=120000)
    page.wait_for_function('document.body.dataset.hires==="1"', timeout=240000); page.wait_for_timeout(2500)
    shot(page, '01_globe_full.png'); report['fps_default'] = fps(page, 3000)
    if len(sys.argv) > 1 and sys.argv[1] == 'quick': print(json.dumps(errors, indent=1)); b.close(); sys.exit(0)
    ev(page, "()=>{const {ctx}=window.GMAPP; const c=ctx.cases.find(x=>/Rendlesham/i.test(x.name))||ctx.cases[0]; window.__open(c);}")
    page.wait_for_timeout(3500); shot(page, '02_zoom_dossier.png')
    ev(page, "()=>{document.querySelector('#dossier-close').click(); window.__setDay('1952-07-01'); const s=document.querySelector('#tl-speed'); s.value='4'; s.dispatchEvent(new Event('change')); window.__fly(30,-40,3.4); document.querySelector('#tl-play').click();}")
    page.wait_for_timeout(4000); shot(page, '03_timeline_playback.png'); ev(page, "()=>document.querySelector('#tl-play').click()")
    # reference layers: military, nuclear, tests, volcanoes, plates, faults
    ids = ['military', 'nuclear', 'map_nuclear_sites', 'map_nuclear_tests', 'volcanoes', 'plates', 'faults']
    layers_on(page, ids); wait_loaded(page, ids)
    ev(page, "()=>{window.__setDay('1962-10-30'); window.__fly(45,60,3.2);}"); page.wait_for_timeout(3500); shot(page, '04_reference_layers_1962.png')
    # wars panel + GED
    layers_on(page, ['ged']); wait_loaded(page, ['ged'])
    ev(page, "()=>{window.__setDay('1994-05-15'); window.__fly(5,25,2.8); document.querySelector('#btn-wars').click();}"); page.wait_for_timeout(4000); shot(page, '05_wars_ranked_1994.png')
    report['fps_all_layers'] = fps(page, 5000)
    report['js_ms_per_frame_all_layers'] = ev(page, """()=>{const {ctx}=window.GMAPP; const g=ctx.globe; const T={}; const N=20;
      let t=performance.now(); for(let i=0;i<N;i++) g.render(ctx.hooks.compareSide); T.render_submit=(performance.now()-t)/N;
      t=performance.now(); for(let i=0;i<N;i++) ctx.labels.draw(ctx.clusters); T.labels=(performance.now()-t)/N;
      t=performance.now(); for(let i=0;i<N;i++) g.update(0.016); T.controls_update=(performance.now()-t)/N;
      t=performance.now(); for(let i=0;i<5;i++) window.__pick(800,450); T.pick_click=(performance.now()-t)/5;
      for(const k in T) T[k]=+T[k].toFixed(2); return T;}""")
    ev(page, "()=>document.querySelector('#btn-wars').click()")
    # analysis (include imprecise points since all 38 current cases are locality/region)
    ev(page, "()=>{window.__setDay('2026-11-11'); document.querySelector('#btn-analyze').click(); const e=document.querySelector('#an-exact'); e.checked=false; e.dispatchEvent(new Event('change')); document.querySelector('#an-iters').value='499'; document.querySelector('#an-run').click(); window.__fly(35,-60,3.3);}")
    page.wait_for_function("()=>document.querySelector('#an-out .banner')", timeout=240000); page.wait_for_timeout(2500); shot(page, '06_hypothesis_analysis.png')
    page.evaluate("()=>document.querySelector('#an-out').scrollTop=900"); page.wait_for_timeout(400); shot(page, '06b_hypothesis_breakdown.png')
    report['analysis_text'] = ev(page, "()=>document.querySelector('#an-out').innerText.slice(0,3500)")
    ev(page, "()=>document.querySelector('#btn-analyze').click()")
    # charts (linked)
    ev(page, "()=>{document.querySelector('#btn-charts').click();}"); page.wait_for_timeout(1500); shot(page, '07_charts.png')
    ev(page, "()=>{document.querySelector('#ch-cat .bar').dispatchEvent(new MouseEvent('click',{bubbles:true}));}"); page.wait_for_timeout(1200); shot(page, '07b_charts_linked_filter.png')
    ev(page, "()=>{document.querySelector('#f-clear')&&document.querySelector('#f-clear').click(); const f=window.GMAPP.st.f; f.cats.clear(); document.querySelector('#btn-charts').click();}")
    # graph
    ev(page, "()=>document.querySelector('#btn-graph').click()"); page.wait_for_timeout(4000); shot(page, '08_link_graph.png'); ev(page, "()=>document.querySelector('#btn-graph').click()")
    # compare swipe 1962 vs 2024
    ev(page, "()=>{window.__setDay('1962-10-30'); document.querySelector('#btn-compare').click(); const d=document.querySelector('#cmp-date'); d.value='2024-06-01'; d.dispatchEvent(new Event('change')); window.__fly(40,40,3.0);}"); page.wait_for_timeout(3500); shot(page, '09_compare_swipe.png')
    ev(page, "()=>document.querySelector('#btn-compare').click()")
    # deep zoom: states -> cities -> postal codes (US)
    ev(page, "()=>{['map_nuclear_tests','ged','faults','plates','volcanoes','military','nuclear','map_nuclear_sites'].forEach(id=>{const cb=document.querySelector(`[data-layer='${id}']`); if(cb&&cb.checked) cb.click();}); window.__fly(39.0,-77.0,1.25);}")
    page.wait_for_timeout(3000); shot(page, '10_zoom_states.png')
    ev(page, "()=>window.__fly(38.9,-77.03,1.06)"); page.wait_for_timeout(4000); shot(page, '11_zoom_cities.png')
    ev(page, "()=>window.__fly(38.9,-77.03,1.012)"); page.wait_for_timeout(6000); shot(page, '12_zoom_postal.png')
    # briefings + help
    ev(page, "()=>{window.__fly(20,0,3.3); document.querySelector('#btn-brief').click();}"); page.wait_for_timeout(1500); shot(page, '13_briefings.png'); ev(page, "()=>document.querySelector('#brief-close').click()")
    ev(page, "()=>document.querySelector('#btn-help').click()"); page.wait_for_timeout(500); shot(page, '14_help_shortcuts.png'); ev(page, "()=>document.querySelector('#help-close').click()")
    # QWM anomaly / ancient-site layers that have landed (weird coordinates use the glitch marker)
    anom = ev(page, "()=>window.GMAPP.ctx.layers.filter(l=>['map_weird_coordinates','map_pyramids','map_megaliths','map_caves_underground','map_ocean','map_ancient_cities_remote_sensing'].includes(l.id)&&l.present).map(l=>l.id)")
    if anom:
        layers_on(page, anom); wait_loaded(page, anom); ev(page, "()=>{window.__setDay('2026-11-11'); window.__fly(27,20,2.9);}"); page.wait_for_timeout(3000); shot(page, '15_anomaly_layers.png'); report['anomaly_layers'] = anom
    print(json.dumps(report, indent=1)); print('ERRORS', json.dumps(errors, indent=1)); json.dump(dict(report=report, errors=errors), open(os.path.join(SHOTS, 'report.json'), 'w'), indent=1)
    b.close()
