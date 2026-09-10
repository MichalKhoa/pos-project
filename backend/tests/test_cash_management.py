import unittest
import sys
import os
import uuid
from datetime import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, init_db_schema
from models import ShiftSessionModel, CashMovementModel, SaleModel, SaleItemModel


class TestCashManagement(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db_schema()
        self.db = SessionLocal()
        self.created_sale_ids = []

    def tearDown(self):
        for sale_id in self.created_sale_ids:
            try:
                self.client.delete(f'/api/v1/sales/{sale_id}', headers={'X-Admin-Override': 'true'})
            except Exception:
                pass
        self.db.close()

    def test_current_shift_auto_creation_and_movements(self):
        # 1. Fetch current shift
        res = self.client.get('/api/v1/cash/current-shift')
        self.assertEqual(res.status_code, 200)
        shift = res.json()
        self.assertFalse(shift['is_closed'])
        self.assertIn('expected_cash', shift)
        self.assertIn('movements', shift)

        init_expected = shift['expected_cash']

        # 2. Add Float In (Vklad)
        move_res = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'FLOAT_IN',
            'amount': 1000.0,
            'reason': 'Ranní vklad do pokladny'
        })
        self.assertEqual(move_res.status_code, 200)
        move_data = move_res.json()
        self.assertEqual(move_data['movement']['movement_type'], 'FLOAT_IN')
        self.assertEqual(move_data['movement']['amount'], 1000.0)
        self.assertAlmostEqual(move_data['shift']['expected_cash'], init_expected + 1000.0, places=2)

        # 3. Add Payout (Výběr - dodavatel)
        payout_res = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'PAYOUT',
            'amount': 250.0,
            'reason': 'Pekárna dodávka pečiva'
        })
        self.assertEqual(payout_res.status_code, 200)
        self.assertAlmostEqual(payout_res.json()['shift']['expected_cash'], init_expected + 750.0, places=2)

        # 4. Add Safe Drop (Odvod do trezoru)
        drop_res = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'SAFE_DROP',
            'amount': 500.0,
            'reason': 'Odvod přebytečné hotovosti'
        })
        self.assertEqual(drop_res.status_code, 200)
        self.assertAlmostEqual(drop_res.json()['shift']['expected_cash'], init_expected + 250.0, places=2)

        # 5. Invalid movement validations
        err1 = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'INVALID_TYPE',
            'amount': 100.0
        })
        self.assertEqual(err1.status_code, 400)

        err2 = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'FLOAT_IN',
            'amount': -50.0
        })
        self.assertEqual(err2.status_code, 400)

    def test_sales_and_refunds_impact_on_expected_cash(self):
        res = self.client.get('/api/v1/cash/current-shift')
        self.assertEqual(res.status_code, 200)
        base_expected = res.json()['expected_cash']

        # 1. Cash sale of 350 CZK
        cash_sale_id = f'sale-cash-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(cash_sale_id)
        sale_res = self.client.post('/api/v1/sales/', json={
            'id': cash_sale_id,
            'receiptNumber': f'RCP-CASH-{uuid.uuid4().hex[:4]}',
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': 350.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': 500.0,
            'changeDue': 150.0,
            'taxSummary': {'21': {'rate': 21, 'net': 289.26, 'tax': 60.74, 'gross': 350.0}},
            'items': [{'name': 'Rohlík', 'price': 350.0, 'quantity': 1.0, 'vat': 21}]
        })
        self.assertEqual(sale_res.status_code, 201)

        # 2. Card sale of 1000 CZK (should NOT affect cash drawer)
        card_sale_id = f'sale-card-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(card_sale_id)
        sale_card = self.client.post('/api/v1/sales/', json={
            'id': card_sale_id,
            'receiptNumber': f'RCP-CARD-{uuid.uuid4().hex[:4]}',
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': 1000.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'card',
            'tenderedAmount': 1000.0,
            'changeDue': 0.0,
            'taxSummary': {'21': {'rate': 21, 'net': 826.45, 'tax': 173.55, 'gross': 1000.0}},
            'items': [{'name': 'Drahé zboží', 'price': 1000.0, 'quantity': 1.0, 'vat': 21}]
        })
        self.assertEqual(sale_card.status_code, 201)

        # Check shift expected cash
        shift_after_sales = self.client.get('/api/v1/cash/current-shift').json()
        self.assertAlmostEqual(shift_after_sales['expected_cash'], base_expected + 350.0, places=2)

        # 3. Cash refund of 50 CZK
        refund_id = f'refund-cash-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(refund_id)
        ref_res = self.client.post('/api/v1/sales/', json={
            'id': refund_id,
            'receiptNumber': f'RCP-REF-{uuid.uuid4().hex[:4]}',
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': -50.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': 0.0,
            'changeDue': 0.0,
            'taxSummary': {'21': {'rate': 21, 'net': -41.32, 'tax': -8.68, 'gross': -50.0}},
            'isRefund': True,
            'originalReceiptNumber': 'RCP-CASH',
            'refundReason': 'Zákazník vrátil vadné zboží',
            'items': [{'name': 'Rohlík', 'price': -50.0, 'quantity': 1.0, 'vat': 21}]
        })
        self.assertEqual(ref_res.status_code, 201)

        shift_after_refund = self.client.get('/api/v1/cash/current-shift').json()
        self.assertAlmostEqual(shift_after_refund['expected_cash'], base_expected + 350.0 - 50.0, places=2)

    def test_close_shift_and_discrepancy_calculation(self):
        shift_resp = self.client.get('/api/v1/cash/current-shift').json()
        expected = shift_resp['expected_cash']
        shift_num = shift_resp['shift_number']
        z_seq = shift_resp['z_seq']

        # 1. Close shift with surplus (actual > expected by 100 CZK)
        close_res = self.client.post('/api/v1/cash/close-shift', json={
            'actual_cash': expected + 100.0,
            'notes': 'Přebytek 100 Kč zjištěn při přepočítání mincí'
        })
        self.assertEqual(close_res.status_code, 200)
        z_report = close_res.json()
        self.assertEqual(z_report['status'], 'CLOSED')
        self.assertTrue(z_report['shift']['is_closed'])
        self.assertAlmostEqual(z_report['shift']['discrepancy'], 100.0, places=2)
        self.assertEqual(z_report['z_seq'], z_seq)

        # 2. Next current-shift call automatically starts new shift with incremented sequence
        new_shift_res = self.client.get('/api/v1/cash/current-shift')
        self.assertEqual(new_shift_res.status_code, 200)
        new_shift = new_shift_res.json()
        self.assertFalse(new_shift['is_closed'])
        self.assertEqual(new_shift['shift_number'], shift_num + 1)
        self.assertEqual(new_shift['z_seq'], z_seq + 1)

        # 3. Close new shift with shortage (manko: actual < expected by 50 CZK)
        new_expected = new_shift['expected_cash']
        close_manko = self.client.post('/api/v1/cash/close-shift', json={
            'actual_cash': new_expected - 50.0,
            'notes': 'Manko 50 Kč'
        })
        self.assertEqual(close_manko.status_code, 200)
        self.assertAlmostEqual(close_manko.json()['shift']['discrepancy'], -50.0, places=2)

    def test_print_movement_slip_and_z_report_endpoints(self):
        # 1. Test print movement slip
        slip_res = self.client.post('/api/v1/cash/print-movement-slip', json={
            'movementData': {
                'movement_type': 'FLOAT_IN',
                'amount': 500.0,
                'reason': 'Vklad drobných',
                'shift_number': 1
            },
            'storeConfig': {'storeName': 'VoltFlow Test Store'}
        })
        self.assertEqual(slip_res.status_code, 200)
        self.assertTrue(slip_res.json()['success'])

        # 2. Test print Z-Report
        z_res = self.client.post('/api/v1/cash/print-z-report', json={
            'zReportData': {
                'z_seq': 42,
                'shift_number': 3,
                'total_revenue': 12500.0,
                'card_sales': 5000.0,
                'qr_sales': 0.0,
                'receipts_count': 35,
                'shift': {
                    'opening_cash': 2000.0,
                    'total_cash_sales': 7500.0,
                    'total_cash_refunds': 0.0,
                    'float_in': 500.0,
                    'payouts': 200.0,
                    'safe_drops': 5000.0,
                    'expected_cash': 4800.0,
                    'actual_cash': 4800.0,
                    'discrepancy': 0.0,
                    'opened_at': '2026-09-10 08:00',
                    'closed_at': '2026-09-10 20:00'
                }
            },
            'storeConfig': {'storeName': 'VoltFlow Test Store'},
            'openDrawer': True
        })
        self.assertEqual(z_res.status_code, 200)
        self.assertTrue(z_res.json()['success'])


if __name__ == '__main__':
    unittest.main()
