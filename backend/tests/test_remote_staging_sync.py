import unittest
import os
import sys
from unittest.mock import MagicMock, patch
import json
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import (
    Base,
    StoreConfigModel,
    PresetModel,
    StockMovementModel,
    AppliedSyncEventModel,
)
from services.remote_staging_sync import RemoteStagingSyncService
from main import app


class TestRemoteStagingSync(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed initial store config
        self.config = StoreConfigModel(
            id=1,
            store_name="Test Shop",
            cloud_staging_enabled=True,
            cloud_staging_url="http://mock-cloud.test/api/v1",
            cloud_staging_token="secret_token_123",
            admin_pin="1234",
            cashier_pin="1234",
        )
        self.db.add(self.config)

        # Seed an existing preset
        self.preset1 = PresetModel(
            id="preset_coke",
            name="Coca Cola 0.5l",
            price=35.0,
            cost_price=20.0,
            stock_quantity=10.0,
            track_stock=True,
            barcode="8590001112223",
            unit="ks",
            vat=21,
            category="Nápoje",
        )
        self.db.add(self.preset1)
        self.db.commit()

        self.service = RemoteStagingSyncService(timeout=2.0)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_sync_disabled(self):
        self.config.cloud_staging_enabled = False
        self.db.commit()

        res = self.service.sync_pending_batches(self.db, self.config)
        self.assertEqual(res["status"], "SKIPPED")
        self.assertIn("disabled", res["reason"])

    def test_sync_empty_url(self):
        self.config.cloud_staging_url = ""
        self.db.commit()

        res = self.service.sync_pending_batches(self.db, self.config)
        self.assertEqual(res["status"], "SKIPPED")
        self.assertIn("not configured", res["reason"])

    def test_sync_empty_pending(self):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"products": [], "price_changes": [], "intakes": []}
        mock_client.get.return_value = mock_resp

        res = self.service.sync_pending_batches(self.db, self.config, client=mock_client)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["applied"]["products"], 0)
        self.assertEqual(self.config.cloud_staging_last_status, "SUCCESS_EMPTY")

    def test_sync_product_insert_and_update(self):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "products": [
                {
                    "id": "PRD-NEW-01",
                    "idempotency_key": "idemp-prd-01",
                    "name": "Mattoni Citron 1.5l",
                    "barcode": "8590009998881",
                    "price": 24.90,
                    "cost_price": 14.50,
                    "vat": 12,
                    "stock_quantity": 30.0,
                    "track_stock": True,
                    "category": "Nápoje",
                    "unit": "ks",
                },
                {
                    "id": "PRD-UPDATE-COKE",
                    "idempotency_key": "idemp-prd-02",
                    "name": "Coca Cola 0.5l Original",
                    "barcode": "8590001112223",
                    "price": 38.00,
                    "cost_price": 22.00,
                    "vat": 21,
                    "stock_quantity": 10.0,
                    "track_stock": True,
                    "category": "Nápoje",
                    "unit": "ks",
                },
            ],
            "price_changes": [],
            "intakes": [],
        }
        mock_client.get.return_value = mock_resp
        mock_ack_resp = MagicMock()
        mock_ack_resp.status_code = 200
        mock_client.post.return_value = mock_ack_resp

        with patch("httpx.Client", return_value=mock_client):
            res = self.service.sync_pending_batches(self.db, self.config, client=mock_client)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["applied"]["products"], 2)

        # Verify new product created
        mattoni = self.db.query(PresetModel).filter(PresetModel.barcode == "8590009998881").first()
        self.assertIsNotNone(mattoni)
        self.assertEqual(mattoni.name, "Mattoni Citron 1.5l")
        self.assertEqual(float(mattoni.price), 24.90)
        self.assertEqual(mattoni.vat, 12)

        # Verify existing product updated
        coke = self.db.query(PresetModel).filter(PresetModel.barcode == "8590001112223").first()
        self.assertEqual(coke.name, "Coca Cola 0.5l Original")
        self.assertEqual(float(coke.price), 38.00)

        # Verify idempotency table
        events = self.db.query(AppliedSyncEventModel).all()
        self.assertEqual(len(events), 2)
        event_keys = [e.idempotency_key for e in events]
        self.assertIn("idemp-prd-01", event_keys)
        self.assertIn("idemp-prd-02", event_keys)

    def test_sync_price_change(self):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "products": [],
            "price_changes": [
                {
                    "id": "PRC-001",
                    "idempotency_key": "idemp-prc-01",
                    "ean": "8590001112223",
                    "product_name": "Coca Cola 0.5l",
                    "new_retail_price": 42.50,
                }
            ],
            "intakes": [],
        }
        mock_client.get.return_value = mock_resp
        mock_ack = MagicMock()
        mock_ack.status_code = 200
        mock_client.post.return_value = mock_ack

        with patch("httpx.Client", return_value=mock_client):
            res = self.service.sync_pending_batches(self.db, self.config, client=mock_client)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["applied"]["price_changes"], 1)

        coke = self.db.query(PresetModel).filter(PresetModel.id == "preset_coke").first()
        self.assertEqual(float(coke.price), 42.50)

    def test_sync_intake_with_vap_calculation(self):
        # Preset starts at stock=10.0, cost=20.0 (total value 200.0)
        # Intake arrives: qty=10.0, cost=30.0 (total value 300.0)
        # New VAP = (200 + 300) / 20 = 25.0
        # New stock = 20.0
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "products": [],
            "price_changes": [],
            "intakes": [
                {
                    "id": "INT-999",
                    "idempotency_key": "idemp-int-999",
                    "supplier_name": "Makro Cash & Carry",
                    "supplier_ico": "26450691",
                    "invoice_number": "FA-2026-0045",
                    "items": [
                        {
                            "name": "Coca Cola 0.5l",
                            "barcode": "8590001112223",
                            "quantity": 10.0,
                            "cost_price": 30.0,
                            "vat": 21,
                        }
                    ],
                }
            ],
        }
        mock_client.get.return_value = mock_resp
        mock_ack = MagicMock()
        mock_ack.status_code = 200
        mock_client.post.return_value = mock_ack

        with patch("httpx.Client", return_value=mock_client):
            res = self.service.sync_pending_batches(self.db, self.config, client=mock_client)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["applied"]["intakes"], 1)

        coke = self.db.query(PresetModel).filter(PresetModel.id == "preset_coke").first()
        self.assertEqual(float(coke.stock_quantity), 20.0)
        self.assertEqual(float(coke.cost_price), 25.0)

        # Check stock movement entry
        smov = self.db.query(StockMovementModel).filter(StockMovementModel.preset_id == "preset_coke").first()
        self.assertIsNotNone(smov)
        self.assertEqual(smov.movement_type, "RECEIPT")
        self.assertEqual(float(smov.quantity_delta), 10.0)
        self.assertEqual(float(smov.unit_cost), 30.0)
        self.assertEqual(smov.supplier_name, "Makro Cash & Carry")
        self.assertEqual(smov.supplier_ico, "26450691")
        self.assertEqual(smov.document_ref, "FA-2026-0045")

    def test_idempotency_replay_protection(self):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "products": [],
            "price_changes": [
                {
                    "id": "PRC-002",
                    "idempotency_key": "idemp-repeat-01",
                    "ean": "8590001112223",
                    "product_name": "Coca Cola 0.5l",
                    "new_retail_price": 49.00,
                }
            ],
            "intakes": [],
        }
        mock_client.get.return_value = mock_resp
        mock_ack = MagicMock()
        mock_ack.status_code = 200
        mock_client.post.return_value = mock_ack

        with patch("httpx.Client", return_value=mock_client):
            # First run: applies
            res1 = self.service.sync_pending_batches(self.db, self.config, client=mock_client)
            self.assertEqual(res1["applied"]["price_changes"], 1)

            # Second run: duplicate idempotency key -> skipped
            res2 = self.service.sync_pending_batches(self.db, self.config, client=mock_client)
            self.assertEqual(res2["applied"]["price_changes"], 0)

    def test_network_error_handled(self):
        mock_client = MagicMock()
        mock_client.get.side_effect = Exception("Connection refused by peer")

        res = self.service.sync_pending_batches(self.db, self.config, client=mock_client)
        self.assertEqual(res["status"], "ERROR")
        self.assertIn("Connection refused", res["error"])
        self.assertIn("Connection refused", self.config.cloud_staging_last_status)

    def test_system_sync_staging_api(self):
        client = TestClient(app)
        # Without technician pin: 401
        res_unauth = client.post("/api/v1/system/sync-staging")
        self.assertEqual(res_unauth.status_code, 401)

        # With admin PIN header
        res_auth = client.post(
            "/api/v1/system/sync-staging",
            headers={"X-Admin-PIN": "1234", "X-Admin-Override": "true"},
        )
        self.assertEqual(res_auth.status_code, 200)


if __name__ == "__main__":
    unittest.main()
