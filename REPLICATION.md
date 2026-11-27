# Replication protocol

How to reproduce the build, lint, unit tests, CSV/data validation, Python pipeline tests, and
browser smoke checks of `global-map-app` from a clean clone. (Build Standard v1.2.0: B01, B43, B44.)

## Requirements

- **Node.js:** >= 22 (pinned in `.nvmrc` as `22`, `package-lock.json` committed).
- **Python:** 3.12+ (stdlib only for `validate_data.py` and `test/py`).
- **Browser tests (optional locally; run in CI):** Chromium via Playwright
  (`npx playwright install --with-deps chromium`).

## Steps

```bash
git clone https://github.com/0thernes/global-map-app.git
cd global-map-app

# 1. Install pinned dev dependencies
npm ci

# 2. Lint (ESLint) and formatting (Prettier)
npm run lint

# 3. Run all 181 Node unit tests
npm test

# 4. Validate all CSV snapshots and built public cases
python scripts/validate_data.py

# 5. Run Python data-pipeline and audit-tooling unit tests
python -m unittest discover -s test/py -p "test_*.py" -v

# 6. Verify esbuild bundle reproducibility (zero diff against committed js/app.js)
npm run build
git diff --exit-code -- js/app.js

# 7. Optional: headless browser smoke, WCAG 2.2 AA a11y, and idle frame-budget perf tests
npx playwright install --with-deps chromium
npm run test:smoke
npm run test:a11y
npm run test:perf
```

To run the static app interactively with 3D terrain enabled:

```bash
npm run serve
# Open http://localhost:8080
```

## Expected results

| Check                                                   | Expected output                                                | Tolerance      |
| ------------------------------------------------------- | -------------------------------------------------------------- | -------------- |
| `npm run lint`                                          | ESLint exit 0; `All matched files use Prettier code style!`    | Exact          |
| `npm test`                                              | `tests 181`, `pass 181`, `fail 0`                              | Exact          |
| `python scripts/validate_data.py`                       | Exit 0 (`0 errors` across all CSV snapshots + `data/cases.js`) | Exact          |
| `python -m unittest discover -s test/py -p "test_*.py"` | `Ran 15 tests ... OK`                                          | Exact          |
| `npm run build && git diff --exit-code -- js/app.js`    | Exit 0 (0 diff)                                                | Byte-identical |
| `npm run test:smoke` (CI / Playwright)                  | Zero console/page errors, zero Cesium ion requests             | Exact          |

## Reporting

Open an issue on `https://github.com/0thernes/global-map-app/issues` with your OS, Node/Python
versions, commit SHA, command run, and observed output.

## Replication log

| Date       | Who                                     | Machine and OS                                  | Version / Commit           | Outcome | Notes                                                                                                                                                                                  |
| ---------- | --------------------------------------- | ----------------------------------------------- | -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25 | GitHub Actions CI                       | `ubuntu-latest`, Node 22, Python 3.12, Chromium | `v1.5.1` (`ddc2961`)       | PASS    | Run `45611478159`: lint, 181 unit tests, data validation, 13 py tests, ruff, bundle check, Playwright smoke                                                                            |
| 2026-11-27 | Local verification (author workstation) | Windows 11, Node 25.8.2, Python 3.12            | `1.5.1` (hardening commit) | PASS    | `npm test` 181/181, `npm run lint` clean, `validate_data.py` (fixed bracket-path glob bug) 0 errors, `test:py` 15/15, `npm run build` 0 diff; Playwright browser suites deferred to CI |
