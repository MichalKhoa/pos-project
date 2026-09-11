import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, engine
from models import Base, PresetModel, CategoryModel, StockMovementModel, StockWriteOffModel, StockWriteOffItemModel


class TestStockWriteOff(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

        self.created_preset_ids = ["p_banana", "p_milk"]
        self.created_write_off_ids = []

        # Clean existing test records if any
        self.db.query(StockWriteOffItemModel).delete()
        self.db.query(StockWriteOffModel).delete()
        self.db.query(StockMovementModel).filter(StockMovementModel.preset_id.in_(self.created_preset_ids)).delete()
        self.db.query(PresetModel).filter(PresetModel.id.in_(self.created_preset_ids)).delete()
        self.db.query(CategoryModel).filter(CategoryModel.id.in_(["cat_produce", "cat_dairy"])).delete()

        # Seed categories with natural loss norms
        cat_produce = CategoryModel(id="cat_produce", name="Ovoce a zelenina", position=0, natural_loss_norm=4.0)
        cat_dairy = CategoryModel(id="cat_dairy", name="Mléčné výrobky", position=1, natural_loss_norm=0.0)
        self.db.add_all([cat_produce, cat_dairy])

        # Seed presets
        p1 = PresetModel(
            id="p_banana",
            name="Banány volné",
            price=40.0,
            cost_price=25.0,
            vat=12,
            category="cat_produce",
            stock_quantity=50.0,
            unit="kg",
            is_weighted=True
        )
        p2 = PresetModel(
            id="p_milk",
            name="Mléko plnotučné 1l",
            price=28.0,
            cost_price=18.0,
            vat=12,
            category="cat_dairy",
            stock_quantity=20.0,
            unit="ks",
            is_weighted=False
        )
        self.db.add_all([p1, p2])
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        for wid in self.created_write_off_ids:
            try:
                self.db.query(StockWriteOffItemModel).filter(StockWriteOffItemModel.write_off_id == wid).delete()
                self.db.query(StockWriteOffModel).filter(StockWriteOffModel.id == wid).delete()
            except Exception:
                pass

        try:
            self.db.query(StockMovementModel).filter(StockMovementModel.preset_id.in_(self.created_preset_ids)).delete()
            self.db.query(PresetModel).filter(PresetModel.id.in_(self.created_preset_ids)).delete()
            self.db.query(CategoryModel).filter(CategoryModel.id.in_(["cat_produce", "cat_dairy"])).delete()
            self.db.commit()
        except Exception:
            self.db.rollback()
        finally:
            self.db.close()

    def test_write_off_natural_loss_within_norm(self):
        """Test write-off with EXSPIRACE on produce (category norm 4%) -> tax deductible."""
        payload = {
            "reason": "EXSPIRACE",
            "responsible_person": "Jan Novák",
            "note": "Prošlá šarže banánů",
            "items": [
                {"preset_id": "p_banana", "quantity": 2.5}
            ]
        }
        res = self.client.post("/api/v1/inventory/write-off", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.created_write_off_ids.append(data["id"])

        self.assertTrue(data["protocol_number"].startswith("ODP-"))
        self.assertEqual(data["reason"], "EXSPIRACE")
        self.assertEqual(data["responsible_person"], "Jan Novák")
        self.assertEqual(data["total_cost_value"], 62.50)  # 2.5 * 25.0
        self.assertEqual(data["total_retail_value"], 100.0)  # 2.5 * 40.0
        self.assertTrue(data["is_tax_deductible"])
        self.assertFalse(data["vat_adjustment_required"])

        # Check stock decrement
        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == "p_banana").first()
        self.assertAlmostEqual(preset.stock_quantity, 47.5, places=2)

        # Check stock movement record
        movement = self.db.query(StockMovementModel).filter(StockMovementModel.preset_id == "p_banana").first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.movement_type, "WRITE_OFF")
        self.assertAlmostEqual(movement.quantity_delta, -2.5, places=2)
        self.assertEqual(movement.document_ref, data["protocol_number"])

    def test_write_off_theft_always_non_deductible(self):
        """Test write-off with KRADEZ -> always tax non-deductible with VAT adjustment notice."""
        payload = {
            "reason": "KRADEZ",
            "responsible_person": "Vedoucí směny",
            "note": "Zcizeno z regálu",
            "items": [
                {"preset_id": "p_milk", "quantity": 3.0}
            ]
        }
        res = self.client.post("/api/v1/inventory/write-off", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.created_write_off_ids.append(data["id"])

        self.assertFalse(data["is_tax_deductible"])
        self.assertTrue(data["vat_adjustment_required"])
        self.assertEqual(data["total_cost_value"], 54.0)  # 3 * 18.0

        # Check stock decrement
        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == "p_milk").first()
        self.assertAlmostEqual(preset.stock_quantity, 17.0, places=2)

    def test_write_off_validation_negative_or_zero_quantity(self):
        """Test rejection of non-positive write-off quantities."""
        payload = {
            "reason": "ZKAZA",
            "items": [
                {"preset_id": "p_banana", "quantity": 0.0}
            ]
        }
        res = self.client.post("/api/v1/inventory/write-off", json=payload)
        self.assertEqual(res.status_code, 400)

        payload["items"][0]["quantity"] = -5.0
        res2 = self.client.post("/api/v1/inventory/write-off", json=payload)
        self.assertEqual(res2.status_code, 400)

    def test_write_off_validation_invalid_reason(self):
        """Test rejection of invalid write-off reasons."""
        payload = {
            "reason": "INVALID_REASON",
            "items": [
                {"preset_id": "p_banana", "quantity": 1.0}
            ]
        }
        res = self.client.post("/api/v1/inventory/write-off", json=payload)
        self.assertEqual(res.status_code, 400)

    def test_print_write_off_protocol_slip(self):
        """Test ESC/POS printer endpoint for write-off liquidation protocol slip."""
        req_body = {
            "protocolData": {
                "protocol_number": "ODP-2026-0001",
                "reason": "EXSPIRACE",
                "responsible_person": "Jan Novák",
                "total_cost_value": 62.50,
                "total_retail_value": 100.0,
                "is_tax_deductible": True,
                "vat_adjustment_required": False,
                "timestamp": datetime.now().isoformat(),
                "items": [
                    {
                        "preset_name": "Banány volné",
                        "quantity": 2.5,
                        "unit": "kg",
                        "total_cost": 62.50
                    }
                ]
            },
            "storeConfig": {
                "storeName": "Moje Večerka",
                "ico": "12345678"
            }
        }
        res = self.client.post("/api/v1/printer/print-write-off", json=req_body)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["protocol_number"], "ODP-2026-0001")


if __name__ == "__main__":
    unittest.main()
