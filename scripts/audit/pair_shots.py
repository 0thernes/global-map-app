"""Copy matching before / after audit screenshots into docs/screenshots/v1.3/ and write an index.

Usage: python3 scripts/audit/pair_shots.py --shots /workspace/gma-ui-shots
Images are palette-quantised (256 colours) to keep the repo small. Both phases use the same view script
(test/ui_views.mjs) at the same viewport, so each pair shows the same state before and after v1.3.
"""

import argparse
import os

from PIL import Image

PAIRS = [
    ("1920x1080", v)
    for v in [
        "main", "rail_layers", "dossier", "wars", "charts", "help", "settings", "data_overview",
        "data_tables", "data_stats", "index_glossary", "hotspots", "multi_open",
    ]
] + [("1280x800", "main"), ("1280x800", "multi_open"), ("3840x2160", "main")]

ap = argparse.ArgumentParser()
ap.add_argument("--shots", default="../gma-ui-shots")
ap.add_argument("--out", default="docs/screenshots/v1.3")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
rows = []
for vp, view in PAIRS:
    names = []
    for phase in ("before", "after"):
        src = os.path.join(a.shots, phase, vp, view + ".png")
        name = f"{vp}_{view}_{phase}.png"
        im = Image.open(src).convert("RGB")
        if vp == "3840x2160":
            im = im.resize((1920, 1080), Image.LANCZOS)
        im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(
            os.path.join(a.out, name), optimize=True
        )
        names.append(name)
    rows.append(f"| `{view}` | {vp} | ![before]({names[0]}) | ![after]({names[1]}) |")
with open(os.path.join(a.out, "README.md"), "w") as f:
    f.write(
        "# v1.3 before / after\n\n"
        "Same view, same viewport, same script (`test/ui_views.mjs`). Before = v1.2.0, after = v1.3.0.\n"
        "4K shots are scaled to 1920x1080 here. Full sets: `node test/ui_audit.mjs --phase <before|after>`.\n\n"
        "| View | Viewport | Before (v1.2.0) | After (v1.3.0) |\n|---|---|---|---|\n" + "\n".join(rows) + "\n"
    )
print(len(rows), "pairs ->", a.out)
