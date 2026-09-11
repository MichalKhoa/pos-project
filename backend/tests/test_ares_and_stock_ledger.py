import unittest
import sys
import os
import uuid
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, init_db_schema
from models import PresetModel, StockMovementModel, SaleModel, SaleItemModel


class TestAresAndStockLedger(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db_schema()
        self.db = SessionLocal()
        self.created_sale_ids = []
        self.created_preset_ids = []

        # Create test tracked product preset
        self.test_preset_id = f"test-preset-{uuid.uuid4().hex[:8]}"
        preset = PresetModel(
            id=self.test_preset_id,
            name="Ledger Test Káva 1kg",
            price=250.0,
            category="custom",
            vat=21,
            stock_quantity=10.0,
            track_stock=True,
            min_stock_alert=3.0,
            cost_price=120.0
        )
        self.db.add(preset)
        self.db.commit()
        self.created_preset_ids.append(self.test_preset_id)

    def tearDown(self):
        for sid in self.created_sale_ids:
            try:
                self.client.delete(f"/api/v1/sales/{sid}", headers={"X-Admin-Override": "true"})
            except Exception:
                pass

        for pid in self.created_preset_ids:
            try:
                self.db.query(StockMovementModel).filter(StockMovementModel.preset_id == pid).delete()
                self.db.query(PresetModel).filter(PresetModel.id == pid).delete()
                self.db.commit()
            except Exception:
                self.db.rollback()

        self.db.close()

    # --- 1. ARES LOOKUP TESTS ---

    def test_ares_validation_invalid_ico(self):
        # Short IČO
        res = self.client.get("/api/v1/system/ares/12345")
        self.assertEqual(res.status_code, 400)
        self.assertIn("8 číslic", res.json()["detail"])

        # Non-numeric IČO
        res = self.client.get("/api/v1/system/ares/1234567A")
        self.assertEqual(res.status_code, 400)

    @patch("httpx.AsyncClient.get", new_callable=AsyncMock)
    def test_ares_successful_lookup(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "obchodniJmeno": "KÁVA SUPPLIER s.r.o.",
            "ico": "27082440",
            "dic": "CZ27082440",
            "sidlo": {
                "nazevUlice": "Vinohradská",
                "cisloDomovni": 184,
                "cisloOrientacni": 2,
                "nazevObce": "Praha 3",
                "psc": 13000
            }
        }
        mock_get.return_value = mock_resp

        res = self.client.get("/api/v1/system/ares/27082440")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["ico"], "27082440")
        self.assertEqual(data["name"], "KÁVA SUPPLIER s.r.o.")
        self.assertEqual(data["dic"], "CZ27082440")
        self.assertIn("Vinohradská 184/2", data["street"])
        self.assertEqual(data["city"], "Praha 3")
        self.assertEqual(data["zip"], "13000")
        self.assertEqual(data["formattedAddress"], "Vinohradská 184/2, 13000 Praha 3")

    @patch("httpx.AsyncClient.get", new_callable=AsyncMock)
    def test_ares_not_found(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        res = self.client.get("/api/v1/system/ares/00000000")
        self.assertEqual(res.status_code, 404)
        self.assertIn("nenalezeno", res.json()["detail"])

    @patch("httpx.AsyncClient.get", new_callable=AsyncMock)
    def test_ares_timeout(self, mock_get):
        mock_get.side_effect = httpx.TimeoutException("Timeout")

        res = self.client.get("/api/v1/system/ares/27082440")
        self.assertEqual(res.status_code, 504)
        self.assertIn("5 sekund", res.json()["detail"])

    # --- 2. STOCK INTAKE ENDPOINT TESTS ---

    def test_stock_intake_success(self):
        # Initial state: stock 10.0, cost 120.0
        intake_payload = {
            "supplier_ico": "27082440",
            "supplier_name": "KÁVA SUPPLIER s.r.o.",
            "document_ref": "FP-2026-9901",
            "note": "Pravidelná dodávka",
            "items": [
                {
                    "preset_id": self.test_preset_id,
                    "quantity": 15.0,
                    "cost_price": 135.50
                }
            ]
        }

        res = self.client.post("/api/v1/inventory/intake", json=intake_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["intake_count"], 1)
        self.assertEqual(data["document_ref"], "FP-2026-9901")

        # Verify preset stock and cost price updated
        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == self.test_preset_id).first()
        self.assertAlmostEqual(preset.stock_quantity, 25.0, places=2)
        # VAP: ((10.0 * 120.0) + (15.0 * 135.50)) / 25.0 = 129.30 Kč
        self.assertAlmostEqual(preset.cost_price, 129.30, places=2)

        # Verify RECEIPT movement recorded in ledger
        movement = (
            self.db.query(StockMovementModel)
            .filter(StockMovementModel.preset_id == self.test_preset_id, StockMovementModel.movement_type == "RECEIPT")
            .first()
        )
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity_delta, 15.0)
        self.assertEqual(movement.unit_cost, 135.50)
        self.assertEqual(movement.supplier_ico, "27082440")
        self.assertEqual(movement.supplier_name, "KÁVA SUPPLIER s.r.o.")
        self.assertEqual(movement.document_ref, "FP-2026-9901")

    def test_stock_intake_empty_items(self):
        res = self.client.post("/api/v1/inventory/intake", json={"items": []})
        self.assertEqual(res.status_code, 400)

    # --- 3. AUTO SALE MOVEMENT TEST ---

    def test_sale_auto_creates_sale_movement(self):
        sale_id = f"sale-{uuid.uuid4().hex[:8]}"
        self.created_sale_ids.append(sale_id)

        sale_payload = {
            "id": sale_id,
            "receiptNumber": "2026-TEST-LEDGER-01",
            "totalAmount": 500.0,
            "paymentMethod": "cash",
            "taxSummary": {"21": {"net": 413.22, "tax": 86.78, "gross": 500.0}},
            "items": [
                {
                    "id": self.test_preset_id,
                    "name": "Ledger Test Káva 1kg",
                    "price": 250.0,
                    "quantity": 2.0,
                    "vat": 21
                }
            ]
        }

        res = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertEqual(res.status_code, 201)

        # Verify preset stock decremented from 10.0 to 8.0
        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == self.test_preset_id).first()
        self.assertAlmostEqual(preset.stock_quantity, 8.0, places=2)

        # Verify SALE movement recorded in ledger
        mov = (
            self.db.query(StockMovementModel)
            .filter(
                StockMovementModel.preset_id == self.test_preset_id,
                StockMovementModel.movement_type == "SALE"
            )
            .first()
        )
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantity_delta, -2.0)
        self.assertEqual(mov.document_ref, "2026-TEST-LEDGER-01")
        self.assertEqual(mov.unit_cost, 120.0)

    # --- 4. AUTO RETURN MOVEMENT ON REFUND TEST ---

    def test_refund_auto_creates_return_movement(self):
        sale_id = f"sale-ref-{uuid.uuid4().hex[:8]}"
        self.created_sale_ids.append(sale_id)

        # 1. Complete sale
        sale_payload = {
            "id": sale_id,
            "receiptNumber": "2026-TEST-REF-01",
            "totalAmount": 250.0,
            "paymentMethod": "cash",
            "taxSummary": {"21": {"net": 206.61, "tax": 43.39, "gross": 250.0}},
            "items": [
                {
                    "id": self.test_preset_id,
                    "name": "Ledger Test Káva 1kg",
                    "price": 250.0,
                    "quantity": 1.0,
                    "vat": 21
                }
            ]
        }
        self.client.post("/api/v1/sales/", json=sale_payload)

        # 2. Refund sale with restock=True
        ref_res = self.client.put(f"/api/v1/sales/{sale_id}/refund-status", json={
            "refund_status": "FULL",
            "refunded_amount": 250.0,
            "restock": True
        })
        self.assertEqual(ref_res.status_code, 200)

        # Verify RETURN movement recorded in ledger
        self.db.expire_all()
        ret_mov = (
            self.db.query(StockMovementModel)
            .filter(
                StockMovementModel.preset_id == self.test_preset_id,
                StockMovementModel.movement_type == "RETURN"
            )
            .first()
        )
        self.assertIsNotNone(ret_mov)
        self.assertEqual(ret_mov.quantity_delta, 1.0)
        self.assertEqual(ret_mov.document_ref, "2026-TEST-REF-01")

    # --- 5. GET MOVEMENTS QUERY TEST ---

    def test_get_stock_movements_query(self):
        # Create 2 movements manually
        m1 = StockMovementModel(
            id=f"smov-{uuid.uuid4().hex[:8]}",
            preset_id=self.test_preset_id,
            movement_type="RECEIPT",
            quantity_delta=5.0,
            unit_cost=100.0,
            supplier_ico="12345678",
            supplier_name="Dodavatel Alfa",
            document_ref="FAK-001"
        )
        m2 = StockMovementModel(
            id=f"smov-{uuid.uuid4().hex[:8]}",
            preset_id=self.test_preset_id,
            movement_type="SALE",
            quantity_delta=-1.0,
            unit_cost=100.0,
            document_ref="2026-000001"
        )
        self.db.add_all([m1, m2])
        self.db.commit()

        # Query all movements for preset
        res = self.client.get(f"/api/v1/inventory/movements?preset_id={self.test_preset_id}")
        self.assertEqual(res.status_code, 200)
        movements = res.json()
        self.assertGreaterEqual(len(movements), 2)
        first = movements[0]
        self.assertIn("preset_name", first)
        self.assertEqual(first["preset_name"], "Ledger Test Káva 1kg")
        self.assertIn("movement_type", first)
        self.assertIn("quantity_delta", first)


if __name__ == "__main__":
    unittest.main()
