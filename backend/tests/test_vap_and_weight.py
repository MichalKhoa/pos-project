import unittest
import sys
import os
import uuid
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import PresetModel, StoreConfigModel, StockMovementModel
from services.escpos_service import ESCPOSPrinterService

class TestVAPAndWeight(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.created_presets = []
        self.created_movements = []

    def tearDown(self):
        self.db.rollback()
        for pid in self.created_presets:
            try:
                self.db.query(StockMovementModel).filter(StockMovementModel.preset_id == pid).delete()
                self.db.query(PresetModel).filter(PresetModel.id == pid).delete()
            except Exception:
                pass
        self.db.commit()
        self.db.close()

    def test_vap_calculation_positive_stock(self):
        """VAP calculation with positive starting inventory: ((cur_stock * cur_cost) + (qty * cost)) / (cur_stock + qty)."""
        pid = f"preset-vap-pos-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid)

        preset = PresetModel(
            id=pid,
            name="VAP Test Item",
            price=150.0,
            vat=21,
            category="custom",
            stock_quantity=10.0,
            cost_price=100.0,
            track_stock=True
        )
        self.db.add(preset)
        self.db.commit()

        # Intake 10 units at 120 CZK -> new VAP = ((10 * 100) + (10 * 120)) / 20 = 110.00 CZK
        payload = {
            "supplier_ico": "12345678",
            "supplier_name": "Dodavatel s.r.o.",
            "document_ref": "DOK-2026-001",
            "note": "Příjemka 1",
            "items": [
                {
                    "preset_id": pid,
                    "quantity": 10.0,
                    "cost_price": 120.0
                }
            ]
        }
        res = self.client.post("/api/v1/inventory/intake", json=payload)
        self.assertEqual(res.status_code, 201)

        self.db.expire_all()
        updated = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertAlmostEqual(updated.stock_quantity, 20.0, places=3)
        self.assertAlmostEqual(updated.cost_price, 110.0, places=2)

    def test_vap_calculation_zero_or_negative_stock(self):
        """VAP calculation with zero or negative initial stock defaults to intake cost."""
        # Test zero stock
        pid_zero = f"preset-vap-zero-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid_zero)

        preset_zero = PresetModel(
            id=pid_zero,
            name="VAP Zero Stock",
            price=200.0,
            vat=21,
            category="custom",
            stock_quantity=0.0,
            cost_price=50.0,
            track_stock=True
        )
        self.db.add(preset_zero)

        # Test negative stock
        pid_neg = f"preset-vap-neg-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid_neg)

        preset_neg = PresetModel(
            id=pid_neg,
            name="VAP Negative Stock",
            price=200.0,
            vat=21,
            category="custom",
            stock_quantity=-2.5,
            cost_price=50.0,
            track_stock=True
        )
        self.db.add(preset_neg)
        self.db.commit()

        intake_payload = {
            "items": [
                {"preset_id": pid_zero, "quantity": 5.0, "cost_price": 85.50},
                {"preset_id": pid_neg, "quantity": 10.0, "cost_price": 92.00}
            ]
        }
        res = self.client.post("/api/v1/inventory/intake", json=intake_payload)
        self.assertEqual(res.status_code, 201)

        self.db.expire_all()
        updated_zero = self.db.query(PresetModel).filter(PresetModel.id == pid_zero).first()
        self.assertAlmostEqual(updated_zero.stock_quantity, 5.0, places=3)
        self.assertAlmostEqual(updated_zero.cost_price, 85.50, places=2)

        updated_neg = self.db.query(PresetModel).filter(PresetModel.id == pid_neg).first()
        self.assertAlmostEqual(updated_neg.stock_quantity, 7.5, places=3)
        self.assertAlmostEqual(updated_neg.cost_price, 92.00, places=2)

    def test_atomic_sell_price_update_from_intake(self):
        """Intake with new_selling_price updates preset selling price atomically."""
        pid = f"preset-sell-update-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid)

        preset = PresetModel(
            id=pid,
            name="Selling Price Update Item",
            price=100.0,
            vat=21,
            category="custom",
            stock_quantity=5.0,
            cost_price=60.0
        )
        self.db.add(preset)
        self.db.commit()

        payload = {
            "items": [
                {
                    "preset_id": pid,
                    "quantity": 10.0,
                    "cost_price": 70.0,
                    "new_selling_price": 139.90
                }
            ]
        }
        res = self.client.post("/api/v1/inventory/intake", json=payload)
        self.assertEqual(res.status_code, 201)

        self.db.expire_all()
        updated = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertAlmostEqual(float(updated.price), 139.90, places=2)

        # Intake without new_selling_price leaves preset selling price unchanged
        payload_no_change = {
            "items": [
                {
                    "preset_id": pid,
                    "quantity": 5.0,
                    "cost_price": 75.0,
                    "new_selling_price": None
                }
            ]
        }
        res2 = self.client.post("/api/v1/inventory/intake", json=payload_no_change)
        self.assertEqual(res2.status_code, 201)

        self.db.expire_all()
        updated2 = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertAlmostEqual(float(updated2.price), 139.90, places=2)

    def test_price_history_endpoint_and_trend(self):
        """GET /api/v1/inventory/price-history/{preset_id} returns chronological receipts and accurate trends."""
        pid = f"preset-hist-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid)

        preset = PresetModel(
            id=pid,
            name="History Trend Item",
            price=100.0,
            vat=21,
            category="custom",
            stock_quantity=0.0,
            cost_price=0.0
        )
        self.db.add(preset)
        self.db.commit()

        # Submit sequential intakes with different cost prices
        intake_steps = [
            (100.0, "stable"),
            (120.0, "rose"),
            (110.0, "fell"),
            (110.0, "stable")
        ]

        for idx, (cost, _) in enumerate(intake_steps):
            res = self.client.post("/api/v1/inventory/intake", json={
                "supplier_ico": f"ICO{idx}",
                "supplier_name": f"Supplier {idx}",
                "document_ref": f"DOC-{idx}",
                "note": f"Receipt {idx}",
                "items": [{"preset_id": pid, "quantity": 5.0, "cost_price": cost}]
            })
            self.assertEqual(res.status_code, 201)

        res = self.client.get(f"/api/v1/inventory/price-history/{pid}")
        self.assertEqual(res.status_code, 200)
        history = res.json()

        self.assertEqual(len(history), 4)
        for idx, (_, expected_trend) in enumerate(intake_steps):
            item = history[idx]
            self.assertEqual(item["trend"], expected_trend)
            self.assertAlmostEqual(item["unit_cost"], intake_steps[idx][0], places=2)
            self.assertEqual(item["supplier_ico"], f"ICO{idx}")
            self.assertEqual(item["supplier_name"], f"Supplier {idx}")
            self.assertEqual(item["document_ref"], f"DOC-{idx}")
            self.assertIsNotNone(item["timestamp"])
            self.assertIsNotNone(item["id"])

    def test_preset_serialization_with_unit_weight_margin(self):
        """Preset CRUD serializes unit, isWeighted, marginCoefficient correctly."""
        pid = f"preset-weight-{uuid.uuid4().hex[:6]}"
        self.created_presets.append(pid)

        payload = {
            "id": pid,
            "name": "Brambory konzumní",
            "price": 24.90,
            "category": "produce",
            "vat": 12,
            "color": "#10b981",
            "isOpenPrice": False,
            "isGeneralPreset": False,
            "position": 1,
            "stockQuantity": 50.5,
            "trackStock": True,
            "minStockAlert": 10.0,
            "barcode": "8590001234567",
            "unit": "kg",
            "isWeighted": True,
            "marginCoefficient": 1.40
        }

        # Create preset
        res = self.client.post("/api/v1/catalog/presets", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["unit"], "kg")
        self.assertEqual(data["isWeighted"], True)
        self.assertAlmostEqual(data["marginCoefficient"], 1.40, places=2)

        # Query all presets
        all_res = self.client.get("/api/v1/catalog/presets")
        self.assertEqual(all_res.status_code, 200)
        matching = [p for p in all_res.json() if p["id"] == pid]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["unit"], "kg")
        self.assertEqual(matching[0]["isWeighted"], True)
        self.assertAlmostEqual(matching[0]["marginCoefficient"], 1.40, places=2)

        # Query barcode lookup
        bc_res = self.client.get("/api/v1/catalog/barcode/8590001234567")
        self.assertEqual(bc_res.status_code, 200)
        bc_data = bc_res.json()
        self.assertEqual(bc_data["unit"], "kg")
        self.assertEqual(bc_data["isWeighted"], True)
        self.assertAlmostEqual(bc_data["marginCoefficient"], 1.40, places=2)

        # Bulk save update
        payload["marginCoefficient"] = 1.45
        payload["unit"] = "g"
        bulk_res = self.client.post("/api/v1/catalog/presets/bulk", json=[payload])
        self.assertEqual(bulk_res.status_code, 200)

        self.db.expire_all()
        updated = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertEqual(updated.unit, "g")
        self.assertEqual(updated.is_weighted, True)
        self.assertAlmostEqual(updated.margin_coefficient, 1.45, places=2)

    def test_store_config_default_margin_coefficient(self):
        """Store config includes and updates default_margin_coefficient."""
        res = self.client.get("/api/v1/config")
        self.assertEqual(res.status_code, 200)
        cfg = res.json()
        self.assertIn("defaultMarginCoefficient", cfg)
        orig_val = cfg["defaultMarginCoefficient"]

        # Update margin
        update_res = self.client.post("/api/v1/config", json={"defaultMarginCoefficient": 1.35})
        self.assertEqual(update_res.status_code, 200)

        get_res = self.client.get("/api/v1/config")
        self.assertEqual(get_res.status_code, 200)
        self.assertAlmostEqual(get_res.json()["defaultMarginCoefficient"], 1.35, places=2)

        # Restore
        self.client.post("/api/v1/config", json={"defaultMarginCoefficient": orig_val})

    def test_printer_label_request_validity_date(self):
        """POST /api/v1/printer/print-label accepts validityDate and formats shelf label."""
        req_payload = {
            "itemData": {
                "name": "Hrušky William",
                "price": 49.90,
                "vat": 12,
                "barcode": "8590009998887",
                "unit": "kg",
                "is_weighted": True
            },
            "storeConfig": {"storeName": "VoltFlow Test Store"},
            "copies": 1,
            "validityDate": "2026-09-11"
        }
        res = self.client.post("/api/v1/printer/print-label", json=req_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))

    def test_escpos_service_barcode_label_unit_and_weight(self):
        """ESCPOSPrinterService formats unit, validity date, and weighted unit price."""
        service = ESCPOSPrinterService(interface_type="USB", address="/nonexistent/usb")
        res = service.print_barcode_label(
            item_data={
                "name": "Brambory",
                "price": 25.0,
                "vat": 12,
                "barcode": "1234567890128",
                "unit": "kg",
                "is_weighted": True
            },
            store_config={"storeName": "VoltFlow"},
            copies=1,
            validity_date="11.09.2026"
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["unit"], "kg")
        self.assertEqual(res["validityDate"], "11.09.2026")
        self.assertTrue(res["isWeighted"])

if __name__ == "__main__":
    unittest.main()
