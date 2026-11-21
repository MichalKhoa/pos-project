import os
import sys
import uuid
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, init_db_schema
from models import PresetModel, StockMovementModel, StoreConfigModel


class TestInventoryToggle(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db_schema()
        self.db = SessionLocal()
        self.created_sale_ids = []
        self.created_preset_ids = []

        cfg = self.db.query(StoreConfigModel).first()
        if not cfg:
            cfg = StoreConfigModel()
            self.db.add(cfg)
            self.db.commit()
            self.db.refresh(cfg)
        self._prev_inventory_enabled = cfg.inventory_enabled

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

        cfg = self.db.query(StoreConfigModel).first()
        if cfg is not None:
            cfg.inventory_enabled = self._prev_inventory_enabled
            self.db.commit()
        self.db.close()

    def _create_tracked_preset(self, stock_quantity=10.0):
        pid = f"toggle-preset-{uuid.uuid4().hex[:8]}"
        preset = PresetModel(
            id=pid,
            name="Toggle Test Položka",
            price=100.0,
            category="custom",
            vat=21,
            stock_quantity=stock_quantity,
            track_stock=True,
            min_stock_alert=2.0,
            cost_price=50.0,
        )
        self.db.add(preset)
        self.db.commit()
        self.created_preset_ids.append(pid)
        return pid

    def test_config_default_and_toggle_persistence(self):
        col_default = StoreConfigModel.inventory_enabled.default.arg
        self.assertIs(col_default, False)

        res = self.client.post("/api/v1/config", json={"inventoryEnabled": True})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(self.client.get("/api/v1/config").json()["inventoryEnabled"])

        res = self.client.post("/api/v1/config", json={"inventoryEnabled": False})
        self.assertEqual(res.status_code, 200)
        self.assertFalse(self.client.get("/api/v1/config").json()["inventoryEnabled"])

    def test_sale_and_refund_skip_stock_when_inventory_disabled(self):
        self.client.post("/api/v1/config", json={"inventoryEnabled": False})
        pid = self._create_tracked_preset(stock_quantity=10.0)
        sale_id = f"sale-inv-off-{uuid.uuid4().hex[:8]}"
        self.created_sale_ids.append(sale_id)

        res = self.client.post("/api/v1/sales/", json={
            "id": sale_id,
            "receiptNumber": f"2026-OFF-{uuid.uuid4().hex[:6]}",
            "totalAmount": 200.0,
            "paymentMethod": "cash",
            "taxSummary": {"21": {"net": 165.29, "tax": 34.71, "gross": 200.0}},
            "items": [{
                "id": pid,
                "name": "Toggle Test Položka",
                "price": 100.0,
                "quantity": 2.0,
                "vat": 21,
            }],
        })
        self.assertEqual(res.status_code, 201)

        ref_res = self.client.put(f"/api/v1/sales/{sale_id}/refund-status", json={
            "refund_status": "FULL",
            "refunded_amount": 200.0,
            "restock": True,
        })
        self.assertEqual(ref_res.status_code, 200)

        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertAlmostEqual(preset.stock_quantity, 10.0, places=3)
        movs = self.db.query(StockMovementModel).filter(StockMovementModel.preset_id == pid).all()
        self.assertEqual(movs, [])

    def test_sale_deducts_stock_when_inventory_enabled(self):
        self.client.post("/api/v1/config", json={"inventoryEnabled": True})
        pid = self._create_tracked_preset(stock_quantity=10.0)
        sale_id = f"sale-inv-on-{uuid.uuid4().hex[:8]}"
        self.created_sale_ids.append(sale_id)

        res = self.client.post("/api/v1/sales/", json={
            "id": sale_id,
            "receiptNumber": f"2026-ON-{uuid.uuid4().hex[:6]}",
            "totalAmount": 200.0,
            "paymentMethod": "cash",
            "taxSummary": {"21": {"net": 165.29, "tax": 34.71, "gross": 200.0}},
            "items": [{
                "id": pid,
                "name": "Toggle Test Položka",
                "price": 100.0,
                "quantity": 2.0,
                "vat": 21,
            }],
        })
        self.assertEqual(res.status_code, 201)

        self.db.expire_all()
        preset = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertAlmostEqual(preset.stock_quantity, 8.0, places=3)


if __name__ == "__main__":
    unittest.main()
