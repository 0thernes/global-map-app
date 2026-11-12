# data/private (local only, git-ignored)

This folder holds case rows whose source licence does **not** allow public redistribution. Everything here except this
README is ignored by git (see `.gitignore`), and nothing here is included in releases or GitHub Pages.

Currently: **NUFORC** public report database (scrubbed + geocoded extract by planetsig, github.com/planetsig/ufo-reports).
The extract states no licence. See the licensing *dilemma* in `docs/audit/SUMMARY.md` and `DATA_LICENSE.md`.

How it is built: `data/refresh.sh` (or `python3 data/build_data.py`) reads the full QWM drop and writes

- `cases_private.js`: slim columnar rows (`window.GM_CASES_PRIVATE_COLS`)
- `case_details/NNNN.js`: full records, loaded on demand
- `private_links.js`: cross-dataset links/conflicts between public rows and private rows

The app loads these automatically when present (`index.html` from your own disk). Add `?private=0` to the URL to start
without them. A fresh clone simply runs without them.
