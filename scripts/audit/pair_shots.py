"""Copy matching before / after audit screenshots into docs/screenshots/vX.Y/ and write an index.

Usage: python3 scripts/audit/pair_shots.py --release 1.4 --shots ../gma-ui-shots14
       python3 scripts/audit/pair_shots.py --release 1.3 --shots ../gma-ui-shots
Images are palette-quantised (256 colours) to keep the repo small. Both phases use the same view script
(test/ui_views.mjs) at the same viewport. A view that is new in the release is paired with the closest earlier state
(for example the v1.4 omnibox with the v1.3 search list); the index says so.
"""

import argparse
import os

from PIL import Image

# release -> (before label, after label, [(viewport, after view, before view)])
RELEASES = {
    "1.3": ("v1.2.0", "v1.3.0", [
        ("1920x1080", v, v)
        for v in [
            "main", "rail_layers", "dossier", "wars", "charts", "help", "settings", "data_overview",
            "data_tables", "data_stats", "index_glossary", "hotspots", "multi_open",
        ]
    ] + [("1280x800", "main", "main"), ("1280x800", "multi_open", "multi_open"), ("3840x2160", "main", "main")]),
    "1.4": ("v1.3.0", "v1.4.0", [
        ("1920x1080", "main", "main"),
        ("1920x1080", "console_full", "multi_open"),
        ("1920x1080", "dossier", "dossier"),
        ("1920x1080", "palette_query", "search"),
        ("1920x1080", "hover_card", "main"),
        ("1920x1080", "feed", "main"),
        ("1920x1080", "rail_layers", "rail_layers"),
        ("1920x1080", "rail_filters", "rail_filters"),
        ("1920x1080", "help", "help"),
        ("1920x1080", "settings", "settings"),
        ("1920x1080", "charts", "charts"),
        ("1920x1080", "hotspots", "hotspots"),
        ("1920x1080", "high_contrast", "main"),
        ("1920x1080", "compact", "main"),
        ("1280x800", "main", "main"),
        ("1280x800", "console_full", "multi_open"),
        ("3840x2160", "main", "main"),
        ("3840x2160", "dossier", "dossier"),
    ]),
}

ap = argparse.ArgumentParser()
ap.add_argument("--release", default="1.4", choices=sorted(RELEASES))
ap.add_argument("--shots", default=None)
ap.add_argument("--out", default=None)
a = ap.parse_args()
shots = a.shots or ("../gma-ui-shots14" if a.release == "1.4" else "../gma-ui-shots")
out = a.out or f"docs/screenshots/v{a.release}"
bl, al, pairs = RELEASES[a.release]
os.makedirs(out, exist_ok=True)


def save(src, name, vp):
    im = Image.open(src).convert("RGB")
    if vp == "3840x2160":
        im = im.resize((1920, 1080), Image.LANCZOS)
    im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(
        os.path.join(out, name), optimize=True
    )


rows = []
for vp, view, before in pairs:
    bn, an = f"{vp}_{view}_before.png", f"{vp}_{view}_after.png"
    save(os.path.join(shots, "before", vp, before + ".png"), bn, vp)
    save(os.path.join(shots, "after", vp, view + ".png"), an, vp)
    label = f"`{view}`" if before == view else f"`{view}` (before: `{before}`)"
    rows.append(f"| {label} | {vp} | ![before]({bn}) | ![after]({an}) |")
with open(os.path.join(out, "README.md"), "w") as f:
    f.write(
        f"# v{a.release} before / after\n\n"
        f"Same viewport, same script (`test/ui_views.mjs`). Before = {bl}, after = {al}. "
        "Where a view is new, the before column shows the closest earlier state, named in brackets.\n"
        "4K shots are scaled to 1920x1080 here. Full sets: `node test/ui_audit.mjs --phase <before|after>`.\n\n"
        f"| View | Viewport | Before ({bl}) | After ({al}) |\n|---|---|---|---|\n" + "\n".join(rows) + "\n"
    )
print(len(rows), "pairs ->", out)
