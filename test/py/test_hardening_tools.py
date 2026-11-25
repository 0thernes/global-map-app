"""Regression tests for the audit tooling (docs/audit/hardening/FINDINGS.md)."""
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class HardeningTools(unittest.TestCase):
    def test_F_A02_1_pass_record_is_written_atomically(self):
        # a crash while writing must never leave a truncated passes_run.json behind
        src = (ROOT / 'scripts/audit/hardening_passes.py').read_text(encoding='utf-8')
        self.assertIn("os.replace(tmp, OUT / 'passes_run.json')", src)
        self.assertNotIn("json.dump({'passes': res}, open(", src)

    def test_F_A02_1_record_is_valid_json(self):
        json.loads((ROOT / 'docs/audit/hardening/passes_run.json').read_text(encoding='utf-8'))

    def test_findings_validate(self):
        r = subprocess.run([sys.executable, 'scripts/audit/hardening_report.py', '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == '__main__':
    unittest.main()
