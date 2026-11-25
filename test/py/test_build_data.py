"""Unit tests for the data pipeline's date normalisation (data/build_data.py). Run: npm run test:py"""
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('build_data', os.path.join(HERE, '..', '..', 'data', 'build_data.py'))
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)


class NormDate(unittest.TestCase):
    def test_iso_and_precision(self):
        self.assertEqual(bd.norm_date('1976-09-19'), ('1976-09-19', 'day'))
        self.assertEqual(bd.norm_date('1976-09'), ('1976-09-01', 'month'))
        self.assertEqual(bd.norm_date('1976'), ('1976-01-01', 'year'))

    def test_bce_astronomical(self):
        self.assertEqual(bd.norm_date('-2560'), ('-2560-01-01', 'year'))
        self.assertEqual(bd.norm_date('-0450-03-15'), ('-0450-03-15', 'day'))

    def test_spreadsheet_float_years(self):
        self.assertEqual(bd.norm_date('1723.0'), ('1723-01-01', 'year'))
        self.assertEqual(bd.norm_date('-2480.0'), ('-2480-01-01', 'year'))

    def test_impossible_month_or_day_never_rolls_over(self):
        self.assertEqual(bd.norm_date('1980-13-05'), ('1980-01-01', 'year'))
        self.assertEqual(bd.norm_date('1981-02-29'), ('1981-02-01', 'month'))
        self.assertEqual(bd.norm_date('1980-02-29'), ('1980-02-29', 'day'))
        self.assertEqual(bd.norm_date('1900-02-29'), ('1900-02-01', 'month'))

    def test_placeholders_and_ids_are_not_dates(self):
        self.assertEqual(bd.norm_date('http://www'), ('', ''))
        self.assertEqual(bd.norm_date('Q836568'), ('', ''))
        self.assertEqual(bd.norm_date('case 98765'), ('', ''))
        self.assertEqual(bd.norm_date('unknown'), ('', ''))

    def test_free_text_year(self):
        self.assertEqual(bd.norm_date('c. 1950'), ('1950-01-01', 'year'))
        self.assertEqual(bd.norm_date('19 Sep 1976'), ('1976-09-19', 'day'))
        self.assertEqual(bd.norm_date('198-'), ('1980-01-01', 'decade'))
        self.assertEqual(bd.norm_date('2999'), ('2999-01-01', 'year'))  # explicit ISO year is kept as written
        self.assertEqual(bd.norm_date('around 2999'), ('', ''))  # but a future year mined from free text is not


if __name__ == '__main__':
    unittest.main()
