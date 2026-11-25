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


    def test_spreadsheet_datetimes_keep_the_day(self):
        # v1.5.0 bug: '1991-12-01 00:00:00.000' fell through to the free-text year rule -> 1991-01-01 (188 UCDP starts)
        self.assertEqual(bd.norm_date('1991-12-01 00:00:00.000'), ('1991-12-01', 'day'))
        self.assertEqual(bd.norm_date('2024-12-31T00:00:00Z'), ('2024-12-31', 'day'))
        self.assertEqual(bd.norm_date('1996-02-29 10:00'), ('1996-02-29', 'day'))

    def test_source_precision_never_finer_than_the_date(self):
        self.assertEqual(bd.coarser_precision('day', 'month'), 'month')  # '2000-09-31' labelled 'day' in GEIPAN
        self.assertEqual(bd.coarser_precision('year', 'day'), 'year')
        self.assertEqual(bd.coarser_precision('', 'day'), 'day')
        self.assertEqual(bd.coarser_precision('approximate', 'day'), 'approximate')  # unknown label: source wins

    def test_integer_text_artefacts(self):
        c = bd.fix_integer_text({'postal_code': '8430.0', 'country_iso': 'FR', 'witness_count': '10.0', 'count': '3'})
        self.assertEqual((c['postal_code'], c['witness_count'], c['count']), ('08430', '10', '3'))
        c = bd.fix_integer_text({'postal_code': '8600.0', 'country_iso': 'BE', 'coord_source': 'geo.api.gouv.fr commune centre: Givet (INSEE 08190)'})
        self.assertEqual(c['postal_code'], '08600')  # GEIPAN commune: French code even when the point geocodes abroad
        c = bd.fix_integer_text({'postal_code': '1000', 'country_iso': 'BE'})
        self.assertEqual(c['postal_code'], '1000')  # Belgian codes are 4 digits: untouched
        self.assertEqual(bd.fix_integer_text({'count': '2.5'})['count'], '2.5')


    def test_dataset_label_from_the_file_never_guessed(self):
        self.assertEqual(bd.dataset_of({'file': 'qwm_uap_cases.csv', 'origin': 'qwm/wiw/hs_candidates.csv row 1'}),
                         'local CSV qwm_uap_cases.csv (from qwm/wiw/hs_candidates.csv)')
        self.assertEqual(bd.dataset_of({'file': 'x.csv'}), 'local CSV x.csv')


if __name__ == '__main__':
    unittest.main()
