# AGENTS.md

Canonical instructions for every coding agent working in `0thernes/global-map-app`
(Codex, Claude Code, Gemini CLI, Antigravity, Cursor, Grok, and others).
`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/build-standard.mdc`, and `llms.txt` only point here.
Edit this file, never the pointer files.

## Project

- Name: `global-map-app` (Global Map)
- Purpose: Static, keyless 3D CesiumJS OSINT globe plotting 2,624 public sourced UAP and high-strangeness cases against military, nuclear, conflict, water, seafloor, and sky reference layers, with an 8000 BCE to present timeline, provenance-first dossiers, seeded statistical analysis, WCAG 2.2 AA console UI, and a 127-pass hardening audit record.
- Author: Alexander Stephen Donahue (`0thernes`, ORCID `0009-0006-8168-9648`, `0_0@0thernes.art`, Independent Researcher, Spokane, WA, USA). Never assert `"0thernes LLC"` or `"0thernes L.L.C."` in any file you create or edit. Do not modify copyright holders in existing `LICENSE` / `DATA_LICENSE.md` files without explicit owner instruction.
- Manifest: `repo.yaml` (Build Standard for LLMs v1.2.0)
- Single version source: `VERSION` (`1.5.1`, kept consistent with `package.json`, `package-lock.json`, `CITATION.cff`, `CHANGELOG.md`, and `index.html` — verified by hardening pass `K06`)
- Stack: Vanilla ES modules (`src/`) bundled via `esbuild` to `js/app.js`, CesiumJS 1.147 (`vendor/cesium/`), Node.js >= 22 (`node:test`, ESLint 9, Prettier 3, Playwright + axe-core), Python 3.12 (stdlib data build, CSV schema validator, hardening audit tooling)
- License: Code MIT (`LICENSE`); per-dataset data licences in `DATA_LICENSE.md` and `CREDITS.md`
- Status: active (v1.5.1)

## Layout

- `index.html`, `css/`: Static browser entry point (with strict CSP), design tokens (`css/tokens.css`), components, and console styles
- `src/`: ES modules (pure logic in `src/geo.js`, `src/stats.js`, `src/grades.js`, `src/cesium/graticule.js`, `src/cesium/flight.js`, `src/ui/*`; Cesium renderer and panels)
- `js/app.js`: Committed esbuild bundle (rebuild with `npm run build` after any `src/` edit)
- `data/`: Built JS payloads (`cases.js`, `catalog.js`, `layers/*.js`), Python build pipeline (`build_data.py`, `tools/*.py`), public snapshots (`sources/`), and git-ignored `private/` (NUFORC stays local-only)
- `test/unit/*.test.mjs`: 181 Node unit tests; `test/py/test_*.py`: Python pipeline & audit tests; `test/{smoke,a11y,perf,ui_audit}.mjs`: Playwright headless browser suites
- `scripts/`: `build.mjs`, `validate_data.py`, `package.mjs`, `gen_icons.mjs`, and `scripts/audit/` (`hardening_passes.py`, `index_repo.py`, `hardening_report.py`)
- `docs/`: Architecture, ADRs (`docs/adr/`), `limitations.md`, `data-sources.md`, `data-dictionary.md`, `repo-checklist.md`, and audit records (`docs/audit/hardening/`)

## Commands

Run from the repository root (`package.json` scripts and `justfile`):

- Install pinned dev deps: `npm ci`
- Lint + format check: `npm run lint` (`eslint .` + `prettier --check .`)
- Auto-format: `npm run format`
- Unit tests (181 Node tests): `npm test`
- CSV schema + built-data validation: `npm run test:data` (or `python scripts/validate_data.py`)
- Python unit tests: `npm run test:py` (or `python -m unittest discover -s test/py -p "test_*.py"`)
- Rebuild bundle and check zero drift: `npm run build && git diff --exit-code -- js/app.js`
- Regenerate tracked-file index after adding/removing files: `python scripts/audit/index_repo.py`
- Browser checks (require Chromium via `npx playwright install chromium`): `npm run test:smoke`, `npm run test:a11y`, `npm run test:perf`

## Hard rules (Build Standard v1.2.0)

- R1. Nothing may gate, block, or slow a commit or push. No branch protection, no required status checks, no commit/tag signing requirements, no git hooks, no push protection, no merge queues, and no blocking SAST/coverage gates (CodeQL is informational/report-only).
- R2. Commit and push straight to `main`. No pull requests and no feature branches. Fixes for failing checks are follow-up commits to `main`.
- R3. CI is informational. A red CI run is a finding to fix, never a barrier.
- R4. Banned tools and files: no `.github/dependabot.yml`, no Renovate config, no PR templates, no `.coderabbit.yaml`, no Copilot review or `.github/copilot-instructions.md`, no `FUNDING.yml` unless the owner asks.
- R5. One-person lean, not corporate. Prefer one file over a framework and one command over a checklist.
- R6. Never fabricate. Sourced rows only (`http(s)` `source_url`), never invent or jitter coordinates, never mix unlicensed `data/private/` (NUFORC) rows into public tracked files, and keep `CLAIMS.md`, `LIMITATIONS.md`, and `docs/limitations.md` honest.
- R7. Classify every finding as exactly one of: `bug`, `error`, `issue`, `problem`, `concern`, `dilemma`, `conflict`, `gap`, `hole`, `blindspot`.
- R8. Precedence when rules collide: owner's explicit instruction, then R1–R8, then Build Standard v1.2.0 items, then ecosystem conventions.

## Finding classes

- `bug`: Defect in program logic (code runs but diverges from spec/intent).
- `error`: Wrong artifact or failed execution outside program logic (wrong number, claim, doc, config, version, build, or command).
- `issue`: Weakness in something that exists (works and not wrong, but unclear, inconsistent, fragile, or hard to maintain).
- `problem`: External obstacle blocking progress not caused by this project's own code/artifacts.
- `concern`: Risk that has not caused harm yet (future failure, misleading wording, cost, security/legal exposure).
- `dilemma`: Trade-off between valid options depending on owner priorities.
- `conflict`: Two requirements, sources, or rules contradict each other.
- `gap`: Something required or expected is missing, while nothing present is wrong.
- `hole`: Missing check or safeguard that could let a defect slip through unnoticed.
- `blindspot`: Unexamined user, platform, failure mode, or assumption.

## Known traps

- **Prettier CI check (`npm run format:check`):** CI fails if any Markdown, JSON, YAML, HTML, CSS, or JS file not listed in `.prettierignore` deviates from `.prettierrc.json`. Run `npm run format` and `npm run lint` before committing.
- **Bundle sync (`js/app.js`):** CI runs `npm run build && git diff --exit-code -- js/app.js`. Always rebuild and commit `js/app.js` after editing `src/`.
- **Tracked-file index (`docs/audit/hardening/INDEX.md`):** Whenever you add or remove tracked files, update `scripts/audit/index_repo.py` if needed and re-run `python scripts/audit/index_repo.py` so hardening passes `A01` and `A03` stay clean.
- **Version lockstep (`K06`):** `VERSION`, `package.json`, `package-lock.json`, `CITATION.cff`, `CHANGELOG.md`, and `index.html` (`OSINT · vX.Y.Z`) must match.
- **README test badge (`K01`):** `README.md` unit-test count badge must match the actual `node --test "test/unit/*.test.mjs"` test count (`181`).
- **Windows bracketed path (`[Vibe Coded (AI)]`):** Never pass an unescaped repository root path to Python `glob.glob()`; use `glob.escape()` or `Path.rglob()` (regression-tested in `test/py/test_validate_data.py`), and use `-LiteralPath` in PowerShell.
- **NUFORC privacy firewall:** Never commit files under `data/private/` other than `data/private/README.md`.
