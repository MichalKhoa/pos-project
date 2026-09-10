import unittest
import sys
import os
import uuid
from datetime import datetime
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import PresetModel, SaleModel, SaleItemModel
from migrations import run_schema_migrations

class TestDecimalQuantity(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.test_ids = []

    def tearDown(self):
        for sid in self.test_ids:
            try:
                self.client.delete(f"/api/v1/sales/{sid}", headers={"X-Admin-Override": "true"})
            except Exception:
                pass
        self.db.close()

    def test_decimal_sale_creation_and_stock_deduction(self):
        """Verify sales creation with decimal kg quantity and accurate stock deduction."""
        preset_id = f"preset-apple-{uuid.uuid4().hex[:6]}"
        apple_preset = PresetModel(
            id=preset_id,
            name="Jablka Golden (kg)",
            price=39.0,
            vat=12,
            category="produce",
            stock_quantity=10.0,
            track_stock=True,
            min_stock_alert=2.0
        )
        self.db.add(apple_preset)
        self.db.commit()

        sale_id = f"test-decimal-sale-{uuid.uuid4().hex[:8]}"
        self.test_ids.append(sale_id)

        # 0.450 kg at 39.00 Kč/kg = 17.55 Kč
        sale_payload = {
            "id": sale_id,
            "receiptNumber": "",
            "timestamp": datetime.utcnow().isoformat(),
            "totalAmount": 17.55,
            "cartDiscountPercent": 0.0,
            "paymentMethod": "cash",
            "tenderedAmount": 20.0,
            "changeDue": 2.45,
            "taxSummary": {
                "12": {"rate": 12, "net": 15.67, "tax": 1.88, "gross": 17.55}
            },
            "items": [
                {
                    "id": preset_id,
                    "name": "Jablka Golden (kg)",
                    "price": 39.0,
                    "quantity": 0.450,
                    "vat": 12,
                    "discount_percent": 0.0
                }
            ]
        }

        try:
            res = self.client.post("/api/v1/sales/", json=sale_payload)
            self.assertEqual(res.status_code, 201)
            data = res.json()
            receipt_num = data["receipt_number"]

            # Query single sale
            get_res = self.client.get(f"/api/v1/sales/{sale_id}")
            self.assertEqual(get_res.status_code, 200)
            sale_data = get_res.json()
            self.assertEqual(len(sale_data["items"]), 1)
            self.assertAlmostEqual(sale_data["items"][0]["quantity"], 0.450, places=3)
            self.assertEqual(sale_data["items"][0]["name"], "Jablka Golden (kg)")

            # Verify stock deduction: 10.0 - 0.450 = 9.55
            self.db.expire_all()
            updated_preset = self.db.query(PresetModel).filter(PresetModel.id == preset_id).first()
            self.assertIsNotNone(updated_preset)
            self.assertAlmostEqual(updated_preset.stock_quantity, 9.550, places=3)

            # Test receipt lookup remaining quantity
            lookup_res = self.client.get(f"/api/v1/sales/by-receipt/{receipt_num}")
            self.assertEqual(lookup_res.status_code, 200)
            lookup_data = lookup_res.json()
            self.assertAlmostEqual(lookup_data["items"][0]["remaining_quantity"], 0.450, places=3)
            self.assertAlmostEqual(lookup_data["items"][0]["refunded_quantity"], 0.0, places=3)

        finally:
            # Clean up preset
            self.db.query(PresetModel).filter(PresetModel.id == preset_id).delete()
            self.db.commit()

    def test_decimal_quantity_refund_and_restock(self):
        """Verify partial decimal refund correctly tracks remaining quantity and restocks inventory."""
        preset_id = f"preset-banana-{uuid.uuid4().hex[:6]}"
        banana_preset = PresetModel(
            id=preset_id,
            name="Banány (kg)",
            price=29.90,
            vat=12,
            stock_quantity=5.0,
            track_stock=True,
            min_stock_alert=1.0
        )
        self.db.add(banana_preset)
        self.db.commit()

        orig_sale_id = f"orig-sale-{uuid.uuid4().hex[:8]}"
        storno_sale_id = f"storno-sale-{uuid.uuid4().hex[:8]}"
        self.test_ids.extend([orig_sale_id, storno_sale_id])

        # Original: 1.500 kg = 44.85 Kč
        orig_payload = {
            "id": orig_sale_id,
            "receiptNumber": "",
            "timestamp": datetime.utcnow().isoformat(),
            "totalAmount": 44.85,
            "paymentMethod": "card",
            "tenderedAmount": 44.85,
            "changeDue": 0.0,
            "taxSummary": {"12": {"rate": 12, "net": 40.04, "tax": 4.81, "gross": 44.85}},
            "items": [
                {
                    "id": preset_id,
                    "name": "Banány (kg)",
                    "price": 29.90,
                    "quantity": 1.500,
                    "vat": 12
                }
            ]
        }

        try:
            orig_res = self.client.post("/api/v1/sales/", json=orig_payload)
            self.assertEqual(orig_res.status_code, 201)
            orig_receipt = orig_res.json()["receipt_number"]

            # Stock should be 5.0 - 1.5 = 3.5
            self.db.expire_all()
            preset = self.db.query(PresetModel).filter(PresetModel.id == preset_id).first()
            self.assertAlmostEqual(preset.stock_quantity, 3.5, places=3)

            # Storno refund: 0.500 kg returned
            storno_payload = {
                "id": storno_sale_id,
                "receiptNumber": "",
                "timestamp": datetime.utcnow().isoformat(),
                "totalAmount": -14.95,
                "paymentMethod": "card",
                "isRefund": True,
                "originalReceiptNumber": orig_receipt,
                "refundReason": "Vrácení části zboží",
                "taxSummary": {"12": {"rate": 12, "net": -13.35, "tax": -1.60, "gross": -14.95}},
                "items": [
                    {
                        "id": preset_id,
                        "name": "STORNO: Banány (kg)",
                        "price": 29.90,
                        "quantity": -0.500,
                        "vat": 12
                    }
                ]
            }
            storno_res = self.client.post("/api/v1/sales/", json=storno_payload)
            self.assertEqual(storno_res.status_code, 201)

            # Storno with negative quantity (-0.5 kg) automatically restocks: 3.5 - (-0.5) = 4.0 kg
            self.db.expire_all()
            preset = self.db.query(PresetModel).filter(PresetModel.id == preset_id).first()
            self.assertAlmostEqual(preset.stock_quantity, 4.0, places=3)

            # Receipt lookup should reflect remaining: 1.500 - 0.500 = 1.000 kg
            lookup_res = self.client.get(f"/api/v1/sales/by-receipt/{orig_receipt}")
            self.assertEqual(lookup_res.status_code, 200)
            items = lookup_res.json()["items"]
            self.assertAlmostEqual(items[0]["refunded_quantity"], 0.500, places=3)
            self.assertAlmostEqual(items[0]["remaining_quantity"], 1.000, places=3)

        finally:
            self.db.query(PresetModel).filter(PresetModel.id == preset_id).delete()
            self.db.commit()

    def test_schema_migration_integer_to_float(self):
        """Verify run_schema_migrations safely migrates existing INTEGER columns to FLOAT without data loss."""
        engine = create_engine("sqlite:///:memory:")
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE presets (id VARCHAR PRIMARY KEY, name VARCHAR, stock_quantity INTEGER DEFAULT 0, min_stock_alert INTEGER DEFAULT 5)"))
            conn.execute(text("INSERT INTO presets (id, name, stock_quantity, min_stock_alert) VALUES ('p1', 'Pomerance', 42, 10)"))
            conn.execute(text("CREATE TABLE sales (id VARCHAR PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE sale_items (id INTEGER PRIMARY KEY, sale_id VARCHAR, name VARCHAR, price FLOAT, quantity INTEGER DEFAULT 1, vat INTEGER)"))
            conn.execute(text("INSERT INTO sale_items (id, sale_id, name, price, quantity, vat) VALUES (1, 's1', 'Pomerance', 30.0, 3, 12)"))
            conn.commit()

            # Confirm initial types are INTEGER
            p_info = conn.execute(text("PRAGMA table_info('presets')")).fetchall()
            col_types = {r[1]: r[2].upper() for r in p_info}
            self.assertEqual(col_types["stock_quantity"], "INTEGER")
            self.assertEqual(col_types["min_stock_alert"], "INTEGER")

            s_info = conn.execute(text("PRAGMA table_info('sale_items')")).fetchall()
            col_types_s = {r[1]: r[2].upper() for r in s_info}
            self.assertEqual(col_types_s["quantity"], "INTEGER")

        # Run migration
        res = run_schema_migrations(engine=engine)
        self.assertEqual(res["status"], "SUCCESS")

        # Verify columns now FLOAT and data preserved
        with engine.connect() as conn:
            p_info = conn.execute(text("PRAGMA table_info('presets')")).fetchall()
            col_types = {r[1]: r[2].upper() for r in p_info}
            self.assertIn("FLOAT", col_types["stock_quantity"])
            self.assertIn("FLOAT", col_types["min_stock_alert"])

            p_rows = conn.execute(text("SELECT id, stock_quantity, min_stock_alert FROM presets")).fetchall()
            self.assertEqual(p_rows[0][0], "p1")
            self.assertAlmostEqual(p_rows[0][1], 42.0)
            self.assertAlmostEqual(p_rows[0][2], 10.0)

            s_info = conn.execute(text("PRAGMA table_info('sale_items')")).fetchall()
            col_types_s = {r[1]: r[2].upper() for r in s_info}
            self.assertIn("FLOAT", col_types_s["quantity"])

            s_rows = conn.execute(text("SELECT id, quantity FROM sale_items")).fetchall()
            self.assertEqual(s_rows[0][0], 1)
            self.assertAlmostEqual(s_rows[0][1], 3.0)


if __name__ == "__main__":
    unittest.main()
