# global-map-app task runner (Build Standard A31, B01)
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: lint test test-data test-py

# Install pinned dev dependencies
setup:
    npm ci

# Rebuild esbuild bundle (js/app.js)
build:
    npm run build

# ESLint + Prettier check
lint:
    npm run lint

# Run all 181 Node unit tests
test:
    npm test

# Validate CSV snapshots and built data/cases.js
test-data:
    python scripts/validate_data.py

# Run Python pipeline and audit-tool unit tests
test-py:
    python -m unittest discover -s test/py -p "test_*.py" -v

# Serve locally on http://localhost:8080 (enables 3D terrain)
serve:
    npm run serve

# Clean-clone verification of lint, tests, data validation, and bundle reproducibility
reproduce:
    npm ci
    npm run lint
    npm test
    python scripts/validate_data.py
    python -m unittest discover -s test/py -p "test_*.py" -v
    npm run build
    git diff --exit-code -- js/app.js
