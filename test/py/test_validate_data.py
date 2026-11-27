"""Regression tests for scripts/validate_data.py (including bracketed checkout paths)."""
import importlib.util
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
spec = importlib.util.spec_from_file_location('validate_data', os.path.join(ROOT, 'scripts', 'validate_data.py'))
vd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vd)


class ValidateDataTests(unittest.TestCase):
    def test_find_csv_files_finds_repo_snapshots(self):
        files = vd.find_csv_files(ROOT)
        self.assertGreater(len(files), 0, 'validate_data.py must discover CSV snapshots even in bracketed paths')

    def test_find_csv_files_handles_bracketed_directory_names(self):
        # Regression: glob.glob() treated literal [...] path segments as character classes and returned [].
        with tempfile.TemporaryDirectory(prefix='test_[brackets]_') as tmp:
            src = os.path.join(tmp, 'data', 'sources', 'sub')
            os.makedirs(src, exist_ok=True)
            f1 = os.path.join(src, 'sample.csv')
            f2 = os.path.join(src, 'compressed.csv.gz')
            f3 = os.path.join(tmp, 'data', 'top.csv')
            for p in (f1, f2, f3):
                with open(p, 'wb') as fh:
                    fh.write(b'id,name\n1,a\n')
            found = vd.find_csv_files(tmp)
            self.assertEqual(found, sorted([f1, f2, f3]))


if __name__ == '__main__':
    unittest.main()
