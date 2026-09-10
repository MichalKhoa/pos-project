import unittest
import sys
import os
import time
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, init_db_schema, engine
from services.hardware_profile import get_hardware_profile, HardwareProfile
from routers.sales import (
    BoundedTTLReceiptCache,
    MonthlyStatsCache,
    receipt_cache,
    monthly_stats_cache,
    invalidate_sales_caches,
    get_sales_cache_stats
)
from routers.printer import (
    get_cached_printer_devices,
    invalidate_printer_devices_cache
)


class TestHardwareProfileAndPragmas(unittest.TestCase):
    def tearDown(self):
        get_hardware_profile(force_refresh=True)

    def test_tier_1_detection(self):
        mock_vm = MagicMock()
        mock_vm.total = int(4.0 * (1024 ** 3))
        with patch('services.hardware_profile.psutil.virtual_memory', return_value=mock_vm):
            profile = get_hardware_profile(force_refresh=True)
            self.assertEqual(profile.tier, 1)
            self.assertEqual(profile.sqlite_cache_size, -16384)
            self.assertEqual(profile.mmap_size, 67108864)
            self.assertEqual(profile.lru_receipt_cache_size, 200)
            self.assertEqual(profile.prewarm_months, 6)

    def test_tier_2_detection(self):
        mock_vm = MagicMock()
        mock_vm.total = int(8.0 * (1024 ** 3))
        with patch('services.hardware_profile.psutil.virtual_memory', return_value=mock_vm):
            profile = get_hardware_profile(force_refresh=True)
            self.assertEqual(profile.tier, 2)
            self.assertEqual(profile.sqlite_cache_size, -65536)
            self.assertEqual(profile.mmap_size, 268435456)
            self.assertEqual(profile.lru_receipt_cache_size, 1000)
            self.assertEqual(profile.prewarm_months, 12)

    def test_tier_3_detection(self):
        mock_vm = MagicMock()
        mock_vm.total = int(32.0 * (1024 ** 3))
        with patch('services.hardware_profile.psutil.virtual_memory', return_value=mock_vm):
            profile = get_hardware_profile(force_refresh=True)
            self.assertEqual(profile.tier, 3)
            self.assertEqual(profile.sqlite_cache_size, -131072)
            self.assertEqual(profile.mmap_size, 536870912)
            self.assertEqual(profile.lru_receipt_cache_size, 2500)
            self.assertEqual(profile.prewarm_months, 36)

    def test_psutil_exception_fallback(self):
        with patch('services.hardware_profile.psutil.virtual_memory', side_effect=Exception('RAM query error')):
            profile = get_hardware_profile(force_refresh=True)
            self.assertEqual(profile.tier, 2)
            self.assertEqual(profile.sqlite_cache_size, -65536)
            self.assertEqual(profile.mmap_size, 268435456)
            self.assertEqual(profile.lru_receipt_cache_size, 1000)
            self.assertEqual(profile.prewarm_months, 12)

    def test_caching_behavior(self):
        mock_vm = MagicMock()
        mock_vm.total = int(16.0 * (1024 ** 3))
        with patch('services.hardware_profile.psutil.virtual_memory', return_value=mock_vm) as mock_func:
            p1 = get_hardware_profile(force_refresh=True)
            p2 = get_hardware_profile()
            self.assertIs(p1, p2)
            self.assertEqual(mock_func.call_count, 1)

    def test_sqlite_pragmas_applied_on_connect(self):
        engine.dispose()
        profile = get_hardware_profile(force_refresh=True)
        with engine.connect() as conn:
            res_temp = conn.exec_driver_sql('PRAGMA temp_store;').scalar()
            self.assertEqual(res_temp, 2)

            res_cache = conn.exec_driver_sql('PRAGMA cache_size;').scalar()
            self.assertEqual(res_cache, profile.sqlite_cache_size)

            res_mmap = conn.exec_driver_sql('PRAGMA mmap_size;').scalar()
            self.assertEqual(res_mmap, profile.mmap_size)


class TestCachingAndQueries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db_schema()

    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        invalidate_sales_caches(clear_all=True)
        invalidate_printer_devices_cache()
        self.created_sale_ids = []

    def tearDown(self):
        for sid in self.created_sale_ids:
            try:
                self.client.delete(f'/api/v1/sales/{sid}', headers={'X-Admin-Override': 'true'})
            except Exception:
                pass
        self.db.close()
        invalidate_sales_caches(clear_all=True)
        invalidate_printer_devices_cache()

    def _create_test_sale(self, sale_id=None, receipt_number=None, is_refund=False, original_receipt=None, amount=100.0, timestamp_str=None):
        sid = sale_id or f'test-cache-{uuid.uuid4().hex[:8]}'
        rnum = receipt_number or f'2026-{uuid.uuid4().hex[:6].upper()}'
        ts = timestamp_str or datetime.now().isoformat()
        payload = {
            'id': sid,
            'receiptNumber': rnum,
            'timestamp': ts,
            'totalAmount': -amount if is_refund else amount,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': -amount if is_refund else amount,
            'changeDue': 0.0,
            'taxSummary': {'21': {'rate': 21, 'net': 82.64, 'tax': 17.36, 'gross': 100.0}},
            'items': [
                {
                    'id': 'item-1',
                    'name': 'STORNO: Test Polozka' if is_refund else 'Test Polozka',
                    'price': 100.0,
                    'quantity': -1 if is_refund else 1,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ],
            'isRefund': is_refund,
            'originalReceiptNumber': original_receipt
        }
        res = self.client.post('/api/v1/sales/', json=payload)
        self.assertEqual(res.status_code, 201)
        self.created_sale_ids.append(sid)
        return sid, rnum

    def test_status_endpoint_hardware_profile(self):
        for path in ['/api/v1/status', '/api/status']:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn('hardware_tier', data)
            self.assertIn('ram_gb', data)
            self.assertIn('sqlite_cache_size', data)
            self.assertIn('mmap_size', data)
            self.assertIn(data['hardware_tier'], [1, 2, 3])
            self.assertGreater(data['ram_gb'], 0)

    def test_bounded_ttl_receipt_cache_lru_and_expiry(self):
        cache = BoundedTTLReceiptCache(max_size=3, ttl_seconds=0.1)
        cache.set('k1', 'v1')
        cache.set('k2', 'v2')
        cache.set('k3', 'v3')
        self.assertEqual(cache.get('k1'), 'v1')
        self.assertEqual(cache.get('k2'), 'v2')
        self.assertEqual(cache.get('k3'), 'v3')

        cache.set('k4', 'v4')
        self.assertIsNone(cache.get('k1'))
        self.assertEqual(cache.get('k4'), 'v4')

        time.sleep(0.12)
        self.assertIsNone(cache.get('k2'))
        self.assertIsNone(cache.get('k3'))
        self.assertIsNone(cache.get('k4'))

    def test_receipt_lookup_caching_and_invalidation(self):
        sid, rnum = self._create_test_sale()

        stats_before = get_sales_cache_stats()
        self.assertEqual(stats_before['receipt_cache']['active_items'], 0)

        res1 = self.client.get(f'/api/v1/sales/by-receipt/{rnum}')
        self.assertEqual(res1.status_code, 200)

        stats_after = get_sales_cache_stats()
        self.assertEqual(stats_after['receipt_cache']['active_items'], 1)

        res_id = self.client.get(f'/api/v1/sales/{sid}')
        self.assertEqual(res_id.status_code, 200)

        stats_after_id = get_sales_cache_stats()
        self.assertEqual(stats_after_id['receipt_cache']['active_items'], 2)

        ref_payload = {
            'refund_status': 'FULL',
            'refunded_amount': 100.0,
            'restock': False
        }
        res_ref = self.client.put(f'/api/v1/sales/{sid}/refund-status', json=ref_payload)
        self.assertEqual(res_ref.status_code, 200)

        stats_invalidated = get_sales_cache_stats()
        self.assertEqual(stats_invalidated['receipt_cache']['active_items'], 0)

    def test_sargable_monthly_sales_stats_and_caching(self):
        cur_year = datetime.now().year
        cur_month = datetime.now().month
        cur_month_str = f'{cur_year:04d}-{cur_month:02d}'

        sid, rnum = self._create_test_sale()

        res = self.client.get(f'/api/v1/sales/stats/daily?month={cur_month_str}')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, dict)

        stats_cache = get_sales_cache_stats()['monthly_stats_cache']
        self.assertIn(cur_month_str, stats_cache['current_months'])

        new_sid, new_rnum = self._create_test_sale()
        stats_cache_after_sale = get_sales_cache_stats()['monthly_stats_cache']
        self.assertNotIn(cur_month_str, stats_cache_after_sale['current_months'])

        res_past = self.client.get('/api/v1/sales/stats/daily?month=2024-01')
        self.assertEqual(res_past.status_code, 200)
        stats_cache_past = get_sales_cache_stats()['monthly_stats_cache']
        self.assertIn('2024-01', stats_cache_past['immutable_months'])

        self._create_test_sale()
        stats_cache_past_persist = get_sales_cache_stats()['monthly_stats_cache']
        self.assertIn('2024-01', stats_cache_past_persist['immutable_months'])

    def test_printer_devices_memoization(self):
        with patch('routers.printer.detect_connected_printers', return_value=[{'name': 'USB-Printer-1'}]) as mock_detect:
            res1 = self.client.get('/api/v1/printer/devices')
            self.assertEqual(res1.status_code, 200)
            self.assertEqual(res1.json()['devices'], [{'name': 'USB-Printer-1'}])
            self.assertEqual(mock_detect.call_count, 1)

            res2 = self.client.get('/api/v1/printer/devices')
            self.assertEqual(res2.status_code, 200)
            self.assertEqual(mock_detect.call_count, 1)

            invalidate_printer_devices_cache()
            res3 = self.client.get('/api/v1/printer/devices')
            self.assertEqual(res3.status_code, 200)
            self.assertEqual(mock_detect.call_count, 2)


if __name__ == '__main__':
    unittest.main()
