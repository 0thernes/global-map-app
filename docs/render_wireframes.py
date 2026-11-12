"""Render docs/wireframes/*.svg to PNG with headless Chromium."""
import glob, os
from playwright.sync_api import sync_playwright
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wireframes')
with sync_playwright() as pw:
    b = pw.chromium.launch(); p = b.new_page(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
    for svg in sorted(glob.glob(os.path.join(D, '*.svg'))):
        p.goto('file://' + svg); el = p.query_selector('svg'); el.screenshot(path=svg[:-4] + '.png'); print(svg[:-4] + '.png')
    b.close()
