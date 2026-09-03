import unittest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal, init_db_schema
from models import SaleModel, SaleItemModel, PresetModel
from routers.sales import generate_next_receipt_number

class TestSales(unittest.TestCase):
    def test_vat_and_cart_discount_calculations(self):
        price_gross = 100.0
        vat_rate = 21
        net_price = round(price_gross / (1 + vat_rate / 100.0), 2)
        tax_amount = round(price_gross - net_price, 2)

        self.assertEqual(net_price, 82.64)
        self.assertEqual(tax_amount, 17.36)
        self.assertEqual(round(net_price + tax_amount, 2), 100.0)

    def test_atomic_receipt_numbering(self):
        db = SessionLocal()
        try:
            init_db_schema()
            r1 = generate_next_receipt_number(db, 2026)
            r2 = generate_next_receipt_number(db, 2026)

            num1 = int(r1.split("-")[1])
            num2 = int(r2.split("-")[1])

            self.assertTrue(r1.startswith("2026-"))
            self.assertTrue(r2.startswith("2026-"))
            self.assertEqual(num2, num1 + 1)
        finally:
            db.close()

    def test_sales_history_serialization_preserves_items(self):
        from fastapi.testclient import TestClient
        from main import app
        import uuid

        client = TestClient(app)
        test_id = f"test-sale-{uuid.uuid4().hex[:8]}"
        sale_payload = {
            "id": test_id,
            "receiptNumber": "",
            "timestamp": "2026-09-03T12:00:00.000Z",
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
                    "id": "preset-item-1",
                    "name": "Káva Espresso",
                    "price": 75.0,
                    "quantity": 2,
                    "vat": 21,
                    "discount_percent": 0.0
                }
            ]
        }

        try:
            # 1. Create sale
            create_res = client.post("/api/v1/sales/", json=sale_payload)
            self.assertEqual(create_res.status_code, 201)

            # 2. Query history list endpoint
            history_res = client.get("/api/v1/sales/")
            self.assertEqual(history_res.status_code, 200)
            sales = history_res.json()
            matched = [s for s in sales if s.get("id") == test_id]
            self.assertTrue(len(matched) == 1)
            sale = matched[0]

            # 3. Assert items are present and intact
            items = sale.get("items", [])
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["name"], "Káva Espresso")
            self.assertEqual(items[0]["price"], 75.0)
            self.assertEqual(items[0]["quantity"], 2)
            self.assertEqual(items[0]["vat"], 21)

            # 4. Query single sale endpoint
            single_res = client.get(f"/api/v1/sales/{test_id}")
            self.assertEqual(single_res.status_code, 200)
            single_sale = single_res.json()
            self.assertEqual(len(single_sale.get("items", [])), 1)
            self.assertEqual(single_sale["items"][0]["name"], "Káva Espresso")
        finally:
            # Clean up test sale
            client.delete(f"/api/v1/sales/{test_id}", headers={"X-Admin-Override": "true"})


if __name__ == "__main__":
    unittest.main()
