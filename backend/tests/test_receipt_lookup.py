import unittest
import sys
import os
import uuid
from datetime import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, init_db_schema
from models import SaleModel, SaleItemModel

class TestReceiptLookup(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db_schema()
        self.created_sale_ids = []

    def tearDown(self):
        for sale_id in self.created_sale_ids:
            try:
                self.client.delete(f'/api/v1/sales/{sale_id}', headers={'X-Admin-Override': 'true'})
            except Exception:
                pass

    def test_case_insensitive_receipt_lookup(self):
        sale_id = f'test-sale-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(sale_id)
        receipt_no = f'RCP-{uuid.uuid4().hex[:6].upper()}'

        sale_payload = {
            'id': sale_id,
            'receiptNumber': receipt_no,
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': 250.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': 300.0,
            'changeDue': 50.0,
            'taxSummary': {
                '21': {'rate': 21, 'net': 206.61, 'tax': 43.39, 'gross': 250.0}
            },
            'items': [
                {
                    'id': 'prod-1',
                    'name': 'Tričko Bavlněné',
                    'price': 250.0,
                    'quantity': 1,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ]
        }

        res = self.client.post('/api/v1/sales/', json=sale_payload)
        self.assertEqual(res.status_code, 201)

        # 1. Lookup exact casing
        res_exact = self.client.get(f'/api/v1/sales/by-receipt/{receipt_no}')
        self.assertEqual(res_exact.status_code, 200)
        data_exact = res_exact.json()
        self.assertEqual(data_exact['id'], sale_id)
        self.assertEqual(data_exact['receipt_number'], receipt_no)
        self.assertEqual(len(data_exact['items']), 1)
        self.assertEqual(data_exact['items'][0]['remaining_quantity'], 1)
        self.assertEqual(data_exact['items'][0]['refunded_quantity'], 0)

        # 2. Lookup lowercase casing
        res_lower = self.client.get(f'/api/v1/sales/by-receipt/{receipt_no.lower()}')
        self.assertEqual(res_lower.status_code, 200)
        data_lower = res_lower.json()
        self.assertEqual(data_lower['id'], sale_id)

        # 3. Lookup non-existent receipt
        res_404 = self.client.get('/api/v1/sales/by-receipt/NON-EXISTENT-9999')
        self.assertEqual(res_404.status_code, 404)

    def test_refundable_quantity_tracking_after_partial_refund(self):
        orig_sale_id = f'orig-sale-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(orig_sale_id)
        orig_receipt = f'2026-{uuid.uuid4().hex[:6].upper()}'

        sale_payload = {
            'id': orig_sale_id,
            'receiptNumber': orig_receipt,
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': 500.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'card',
            'tenderedAmount': 0.0,
            'changeDue': 0.0,
            'taxSummary': {
                '21': {'rate': 21, 'net': 413.22, 'tax': 86.78, 'gross': 500.0}
            },
            'items': [
                {
                    'id': 'prod-item-1',
                    'name': 'Ponožky Vlněné',
                    'price': 100.0,
                    'quantity': 3,
                    'vat': 21,
                    'discount_percent': 0.0
                },
                {
                    'id': 'prod-item-2',
                    'name': 'Rukavice Kožené',
                    'price': 200.0,
                    'quantity': 1,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ]
        }

        res = self.client.post('/api/v1/sales/', json=sale_payload)
        self.assertEqual(res.status_code, 201)

        # Initial lookup: 3 socks remaining, 1 gloves remaining
        lookup_res = self.client.get(f'/api/v1/sales/by-receipt/{orig_receipt}')
        self.assertEqual(lookup_res.status_code, 200)
        lookup_data = lookup_res.json()
        item1 = next(i for i in lookup_data['items'] if i['item_id'] == 'prod-item-1')
        item2 = next(i for i in lookup_data['items'] if i['item_id'] == 'prod-item-2')
        self.assertEqual(item1['quantity'], 3)
        self.assertEqual(item1['refunded_quantity'], 0)
        self.assertEqual(item1['remaining_quantity'], 3)
        self.assertEqual(item2['quantity'], 1)
        self.assertEqual(item2['refunded_quantity'], 0)
        self.assertEqual(item2['remaining_quantity'], 1)

        # Post partial refund: refund 2 socks
        storno_sale_id = f'storno-sale-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(storno_sale_id)
        storno_payload = {
            'id': storno_sale_id,
            'receiptNumber': f'STORNO-{orig_receipt}',
            'timestamp': datetime.utcnow().isoformat(),
            'totalAmount': -200.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': -200.0,
            'changeDue': 0.0,
            'taxSummary': {
                '21': {'rate': 21, 'net': -165.29, 'tax': -34.71, 'gross': -200.0}
            },
            'items': [
                {
                    'id': 'prod-item-1',
                    'name': 'STORNO: Ponožky Vlněné',
                    'price': 100.0,
                    'quantity': -2,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ],
            'isRefund': True,
            'originalReceiptNumber': orig_receipt,
            'refundReason': 'Vada / poškození zboží'
        }

        storno_res = self.client.post('/api/v1/sales/', json=storno_payload)
        self.assertEqual(storno_res.status_code, 201)

        # Query lookup again: socks should have 2 refunded, 1 remaining; gloves unchanged
        lookup_res2 = self.client.get(f'/api/v1/sales/by-receipt/{orig_receipt}')
        self.assertEqual(lookup_res2.status_code, 200)
        lookup_data2 = lookup_res2.json()

        item1_after = next(i for i in lookup_data2['items'] if i['item_id'] == 'prod-item-1')
        item2_after = next(i for i in lookup_data2['items'] if i['item_id'] == 'prod-item-2')

        self.assertEqual(item1_after['quantity'], 3)
        self.assertEqual(item1_after['refunded_quantity'], 2)
        self.assertEqual(item1_after['remaining_quantity'], 1)

        self.assertEqual(item2_after['quantity'], 1)
        self.assertEqual(item2_after['refunded_quantity'], 0)
        self.assertEqual(item2_after['remaining_quantity'], 1)

    def test_full_refund_ledger_immutability(self):
        orig_sale_id = f'orig-sale-full-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(orig_sale_id)
        orig_receipt = f'2026-FULL-{uuid.uuid4().hex[:4].upper()}'

        sale_payload = {
            'id': orig_sale_id,
            'receiptNumber': orig_receipt,
            'timestamp': datetime.now().isoformat(),
            'totalAmount': 150.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': 150.0,
            'changeDue': 0.0,
            'taxSummary': {
                '21': {'rate': 21, 'net': 123.97, 'tax': 26.03, 'gross': 150.0}
            },
            'items': [
                {
                    'id': 'prod-item-full',
                    'name': 'Káva Espresso',
                    'price': 50.0,
                    'quantity': 3,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ]
        }

        res = self.client.post('/api/v1/sales/', json=sale_payload)
        self.assertEqual(res.status_code, 201)

        # Issue full refund
        storno_sale_id = f'storno-full-{uuid.uuid4().hex[:8]}'
        self.created_sale_ids.append(storno_sale_id)
        storno_payload = {
            'id': storno_sale_id,
            'receiptNumber': f'STORNO-{orig_receipt}',
            'timestamp': datetime.now().isoformat(),
            'totalAmount': -150.0,
            'cartDiscountPercent': 0.0,
            'paymentMethod': 'cash',
            'tenderedAmount': -150.0,
            'changeDue': 0.0,
            'taxSummary': {
                '21': {'rate': 21, 'net': -123.97, 'tax': -26.03, 'gross': -150.0}
            },
            'items': [
                {
                    'id': 'prod-item-full',
                    'name': 'STORNO: Káva Espresso',
                    'price': 50.0,
                    'quantity': -3,
                    'vat': 21,
                    'discount_percent': 0.0
                }
            ],
            'isRefund': True,
            'originalReceiptNumber': orig_receipt,
            'refundReason': 'Odstoupení od smlouvy'
        }

        storno_res = self.client.post('/api/v1/sales/', json=storno_payload)
        self.assertEqual(storno_res.status_code, 201)

        # Verify receipt lookup reports remaining quantity 0 and 3 refunded
        lookup_res = self.client.get(f'/api/v1/sales/by-receipt/{orig_receipt}')
        self.assertEqual(lookup_res.status_code, 200)
        lookup_data = lookup_res.json()
        item = lookup_data['items'][0]
        self.assertEqual(item['quantity'], 3)
        self.assertEqual(item['refunded_quantity'], 3)
        self.assertEqual(item['remaining_quantity'], 0)

        # Verify original sale in ledger remains intact (immutable original record)
        orig_fetch = self.client.get(f'/api/v1/sales/{orig_sale_id}')
        self.assertEqual(orig_fetch.status_code, 200)
        orig_data = orig_fetch.json()
        self.assertEqual(orig_data['total_amount'], 150.0)
        self.assertEqual(len(orig_data['items']), 1)
        self.assertEqual(orig_data['items'][0]['quantity'], 3)

if __name__ == '__main__':
    unittest.main()
