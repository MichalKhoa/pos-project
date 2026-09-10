import unittest
import sys
import os
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, init_db_schema
from models import SaleModel, SaleItemModel, CashMovementModel, StoreConfigModel
from services.pohoda_export import generate_pohoda_datapack_xml, calculate_sale_vat_breakdown, map_payment_type


class TestPohodaExport(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db_schema()
        self.db = SessionLocal()
        self.created_sale_ids = []
        self.created_movement_ids = []

    def tearDown(self):
        for s_id in self.created_sale_ids:
            try:
                self.client.delete(f'/api/v1/sales/{s_id}', headers={'X-Admin-Override': 'true'})
            except Exception:
                pass
        for m_id in self.created_movement_ids:
            try:
                mov = self.db.query(CashMovementModel).filter(CashMovementModel.id == m_id).first()
                if mov:
                    self.db.delete(mov)
                    self.db.commit()
            except Exception:
                pass
        self.db.close()

    def test_calculate_sale_vat_breakdown_with_tax_summary(self):
        """Test VAT breakdown calculation from structured tax_summary."""
        sale = {
            "total_amount": 371.0,
            "tax_summary": {
                "21": {"rate": 21, "net": 100.0, "tax": 21.0, "gross": 121.0},
                "12": {"rate": 12, "net": 200.0, "tax": 24.0, "gross": 224.0},
                "0": {"rate": 0, "net": 26.0, "tax": 0.0, "gross": 26.0}
            }
        }
        res = calculate_sale_vat_breakdown(sale)
        self.assertEqual(res["price_high"], Decimal("100.00"))
        self.assertEqual(res["price_high_vat"], Decimal("21.00"))
        self.assertEqual(res["price_low"], Decimal("200.00"))
        self.assertEqual(res["price_low_vat"], Decimal("24.00"))
        self.assertEqual(res["price_none"], Decimal("26.00"))
        self.assertEqual(res["price_total"], Decimal("371.00"))

    def test_calculate_sale_vat_breakdown_from_items(self):
        """Test VAT breakdown calculation fallback from line items."""
        sale = {
            "total_amount": 233.0,
            "tax_summary": None,
            "items": [
                {"name": "Pivo 21%", "price": 121.0, "quantity": 1.0, "vat": 21},
                {"name": "Chléb 12%", "price": 112.0, "quantity": 1.0, "vat": 12},
            ]
        }
        res = calculate_sale_vat_breakdown(sale)
        self.assertEqual(res["price_high"], Decimal("100.00"))
        self.assertEqual(res["price_high_vat"], Decimal("21.00"))
        self.assertEqual(res["price_low"], Decimal("100.00"))
        self.assertEqual(res["price_low_vat"], Decimal("12.00"))
        self.assertEqual(res["price_total"], Decimal("233.00"))

    def test_payment_type_mapping(self):
        """Verify payment method mapping to POHODA paymentType."""
        self.assertEqual(map_payment_type("cash"), "cash")
        self.assertEqual(map_payment_type("card"), "card")
        self.assertEqual(map_payment_type("qr"), "bank")
        self.assertEqual(map_payment_type("bank_transfer"), "bank")
        self.assertEqual(map_payment_type("split"), "split")
        self.assertEqual(map_payment_type("unknown"), "cash")

    def test_generate_pohoda_datapack_xml_validity(self):
        """Generate full XML and ensure it is well-formed XML with expected elements."""
        sales = [
            {
                "id": "sale-001",
                "receipt_number": "2026-000001",
                "timestamp": "2026-09-10T10:15:00",
                "total_amount": 242.0,
                "payment_method": "card",
                "is_refund": False,
                "tax_summary": {
                    "21": {"rate": 21, "net": 200.0, "tax": 42.0, "gross": 242.0}
                },
                "items": [
                    {"name": "Káva Espresso", "price": 121.0, "quantity": 2.0, "vat": 21}
                ]
            },
            {
                "id": "sale-002",
                "receipt_number": "2026-000002",
                "timestamp": "2026-09-10T11:00:00",
                "total_amount": -121.0,
                "payment_method": "cash",
                "is_refund": True,
                "tax_summary": {
                    "21": {"rate": 21, "net": -100.0, "tax": -21.0, "gross": -121.0}
                },
                "items": [
                    {"name": "STORNO: Káva Espresso", "price": 121.0, "quantity": -1.0, "vat": 21}
                ]
            }
        ]
        movements = [
            {
                "id": "mov-001",
                "movement_type": "FLOAT_IN",
                "amount": 2000.0,
                "reason": "Ranní vklad",
                "created_at": "2026-09-10T08:00:00"
            },
            {
                "id": "mov-002",
                "movement_type": "PAYOUT",
                "amount": 350.0,
                "reason": "Platba dodavateli pečiva",
                "created_at": "2026-09-10T12:00:00"
            }
        ]
        store_config = {
            "ico": "12345678"
        }

        xml_str = generate_pohoda_datapack_xml(sales, movements, store_config, "2026-09")
        self.assertTrue(xml_str.startswith('<?xml version="1.0" encoding="UTF-8"?>'))

        # Parse with standard XML parser to verify syntax
        root = ET.fromstring(xml_str)
        self.assertIn("dataPack", root.tag)
        self.assertEqual(root.attrib.get("id"), "EXPORT_2026-09")
        self.assertEqual(root.attrib.get("ico"), "12345678")
        self.assertEqual(root.attrib.get("application"), "VoltFlow POS")
        self.assertEqual(root.attrib.get("version"), "2.0")

        # Verify items inside dataPack
        self.assertIn("<inv:invoiceType>issuedInvoice</inv:invoiceType>", xml_str)
        self.assertIn("<typ:numberRequested>2026-000001</typ:numberRequested>", xml_str)
        self.assertIn("<inv:text>Prodejka 2026-000001</inv:text>", xml_str)
        self.assertIn("<inv:text>Storno 2026-000002</inv:text>", xml_str)
        self.assertIn("<typ:paymentType>card</typ:paymentType>", xml_str)
        self.assertIn("<typ:paymentType>cash</typ:paymentType>", xml_str)

        # Verify vouchers
        self.assertIn('<dat:dataPackItem id="vch-mov-001"', xml_str)
        self.assertIn("<vch:voucherType>receipt</vch:voucherType>", xml_str)
        self.assertIn("<vch:priceTotal>2000.00</vch:priceTotal>", xml_str)
        self.assertIn('<dat:dataPackItem id="vch-mov-002"', xml_str)
        self.assertIn("<vch:voucherType>expense</vch:voucherType>", xml_str)
        self.assertIn("<vch:priceTotal>350.00</vch:priceTotal>", xml_str)

    def test_pohoda_export_endpoint(self):
        """Test GET /api/v1/sales/export/pohoda returns 200 with XML content."""
        # 1. Create a test sale
        sale_id = f"test-pohoda-sale-{uuid.uuid4().hex[:8]}"
        self.created_sale_ids.append(sale_id)
        current_month = datetime.now().strftime("%Y-%m")

        sale_payload = {
            "id": sale_id,
            "receiptNumber": f"{datetime.now().year}-999001",
            "timestamp": datetime.now().isoformat(),
            "totalAmount": 150.0,
            "cartDiscountPercent": 0.0,
            "paymentMethod": "cash",
            "tenderedAmount": 200.0,
            "changeDue": 50.0,
            "taxSummary": {
                "21": {"rate": 21, "net": 123.97, "tax": 26.03, "gross": 150.0}
            },
            "items": [
                {
                    "id": "item-1",
                    "name": "Test POHODA Polozka",
                    "price": 150.0,
                    "quantity": 1.0,
                    "vat": 21
                }
            ]
        }
        res_create = self.client.post('/api/v1/sales/', json=sale_payload)
        self.assertEqual(res_create.status_code, 201)

        # 2. Create cash movement
        mov_res = self.client.post('/api/v1/cash/movement', json={
            'movement_type': 'FLOAT_IN',
            'amount': 500.0,
            'reason': 'POHODA test vklad'
        })
        self.assertEqual(mov_res.status_code, 200)
        mov_data = mov_res.json()
        self.created_movement_ids.append(mov_data['movement']['id'])

        # 3. Call GET /api/v1/sales/export/pohoda?month=...
        export_res = self.client.get(f'/api/v1/sales/export/pohoda?month={current_month}')
        self.assertEqual(export_res.status_code, 200)
        self.assertIn("application/xml", export_res.headers.get("content-type", ""))
        self.assertIn(f'attachment; filename="pohoda_export_{current_month}.xml"', export_res.headers.get("content-disposition", ""))

        xml_body = export_res.text
        self.assertIn("<?xml", xml_body)
        self.assertIn("<dat:dataPack", xml_body)
        self.assertIn(f'id="{sale_id}"', xml_body)
        self.assertIn(f'id="vch-{mov_data["movement"]["id"]}"', xml_body)

        # Parse response XML
        root = ET.fromstring(xml_body)
        self.assertIn("dataPack", root.tag)

    def test_pohoda_export_endpoint_date_range(self):
        """Test GET /api/v1/sales/export/pohoda with from_date and to_date."""
        today_str = datetime.now().strftime("%Y-%m-%d")
        export_res = self.client.get(f'/api/v1/sales/export/pohoda?from_date={today_str}&to_date={today_str}')
        self.assertEqual(export_res.status_code, 200)
        self.assertIn("application/xml", export_res.headers.get("content-type", ""))
        self.assertIn("attachment; filename=", export_res.headers.get("content-disposition", ""))

    def test_pohoda_export_invalid_month(self):
        """Test invalid month format returns 400 Bad Request."""
        res = self.client.get('/api/v1/sales/export/pohoda?month=invalid-month')
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid month format", res.json().get("detail", ""))


if __name__ == '__main__':
    unittest.main()
