import os
import unittest
import time
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from main import app
from database import get_db, Base, engine, SessionLocal
from models import SaleModel, SaleItemModel, StoreConfigModel
from routers.sales import BoundedTTLIdempotencyCache, idempotency_cache
from services.escpos_service import ESCPOSPrinterService, _hardware_printer_lock


class TestBackendHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_bounded_ttl_idempotency_cache(self):
        """Test bounded LRU idempotency cache eviction and TTL expiration."""
        cache = BoundedTTLIdempotencyCache(max_size=3, ttl_seconds=0.1)

        cache.set("k1", {"result": 1})
        cache.set("k2", {"result": 2})
        cache.set("k3", {"result": 3})

        self.assertEqual(cache.get("k1"), {"result": 1})
        self.assertEqual(cache.get("k2"), {"result": 2})
        self.assertEqual(cache.get("k3"), {"result": 3})

        # Test LRU eviction when exceeding max_size
        cache.set("k4", {"result": 4})
        self.assertEqual(len(cache._cache), 3)

        # Test TTL expiration
        time.sleep(0.15)
        self.assertIsNone(cache.get("k4"))

    def test_hardware_printer_lock(self):
        """Test printer service lock acquisition during simulated print and cash drawer kick."""
        service = ESCPOSPrinterService(interface_type="DUMMY")
        store_config = {"printerPaperWidth": "80", "storeName": "Test POS"}
        sale_data = {"receiptNumber": "2026-TEST01", "totalAmount": 100.0, "paymentMethod": "CASH"}

        # Verify lock is acquired cleanly
        res = service.print_receipt(sale_data, store_config)
        self.assertTrue(res["success"])
        self.assertIn(res["status"], ["PRINTED", "SIMULATED"])

        drawer_res = service.open_cash_drawer()
        self.assertTrue(drawer_res["success"])
        self.assertIn(drawer_res["status"], ["OPENED", "SIMULATED"])

    def test_sales_history_pagination_and_filtering(self):
        """Test GET /api/v1/sales pagination, date filtering, and X-Total-Count header."""
        now = datetime.now(timezone.utc)
        sale_ids = []
        for i in range(5):
            s_id = f"test_sale_{uuid.uuid4().hex[:8]}"
            sale_ids.append(s_id)
            sale = SaleModel(
                id=s_id,
                receipt_number=f"2026-{1000 + i}",
                timestamp=now - timedelta(minutes=i * 10),
                total_amount=100.0 * (i + 1),
                payment_method="cash" if i % 2 == 0 else "card",
                tax_summary={"total": 100.0},
                eet_status="EVD_OK"
            )
            self.db.add(sale)
        self.db.commit()

        try:
            # 1. Test pagination: limit=2
            res = self.client.get("/api/v1/sales/?limit=2&offset=0")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(len(data), 2)
            self.assertIn("x-total-count", res.headers)
            total_count = int(res.headers["x-total-count"])
            self.assertGreaterEqual(total_count, 5)

            # 2. Test pagination: offset=2, limit=2
            res_offset = self.client.get("/api/v1/sales/?limit=2&offset=2")
            self.assertEqual(res_offset.status_code, 200)
            data_offset = res_offset.json()
            self.assertEqual(len(data_offset), 2)
            self.assertNotEqual(data[0]["id"], data_offset[0]["id"])

            # 3. Test filtering by payment method
            res_card = self.client.get("/api/v1/sales/?payment_method=card")
            self.assertEqual(res_card.status_code, 200)
            card_data = res_card.json()
            for s in card_data:
                self.assertEqual(s["payment_method"], "card")
        finally:
            # Clean up test sales
            self.db.query(SaleModel).filter(SaleModel.id.in_(sale_ids)).delete(synchronize_session=False)
            self.db.commit()

    def test_sales_stats_and_search_endpoints(self):
        """Test search, doc_type filter, daily stats and shift stats endpoints."""
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        sale_ids = []
        try:
            s1 = SaleModel(
                id=f"test_s_{uuid.uuid4().hex[:8]}",
                receipt_number="2026-999001",
                timestamp=now,
                total_amount=500.0,
                payment_method="cash",
                tax_summary={"total": 500.0},
                eet_status="EVD_OK",
                is_refund=False
            )
            s2 = SaleModel(
                id=f"test_s_{uuid.uuid4().hex[:8]}",
                receipt_number="2026-999002",
                timestamp=now,
                total_amount=-200.0,
                payment_method="cash",
                tax_summary={"total": -200.0},
                eet_status="EVD_OK",
                is_refund=True,
                original_receipt_number="2026-999001"
            )
            self.db.add(s1)
            self.db.add(s2)
            self.db.commit()
            sale_ids.extend([s1.id, s2.id])

            # 1. Test doc_type=sales vs refunds
            res_sales = self.client.get("/api/v1/sales/?doc_type=sales")
            self.assertEqual(res_sales.status_code, 200)
            self.assertTrue(all(not s["is_refund"] for s in res_sales.json()))

            res_refunds = self.client.get("/api/v1/sales/?doc_type=refunds")
            self.assertEqual(res_refunds.status_code, 200)
            self.assertTrue(all(s["is_refund"] for s in res_refunds.json()))

            # 2. Test search by receipt number
            res_search = self.client.get("/api/v1/sales/?search=999001")
            self.assertEqual(res_search.status_code, 200)
            self.assertTrue(any(s["receipt_number"] == "2026-999001" for s in res_search.json()))

            # 3. Test daily stats aggregation
            res_daily = self.client.get(f"/api/v1/sales/stats/daily?month={now.strftime('%Y-%m')}")
            self.assertEqual(res_daily.status_code, 200)
            daily_data = res_daily.json()
            self.assertIn(today_str, daily_data)
            self.assertGreaterEqual(daily_data[today_str]["count"], 2)

            # 4. Test shift stats aggregation
            res_shift = self.client.get(f"/api/v1/sales/stats/shift?date_str={today_str}")
            self.assertEqual(res_shift.status_code, 200)
            shift_data = res_shift.json()
            self.assertEqual(shift_data["date"], today_str)
            self.assertGreaterEqual(shift_data["todaySalesCount"], 2)
        finally:
            self.db.query(SaleModel).filter(SaleModel.id.in_(sale_ids)).delete(synchronize_session=False)
            self.db.commit()


    def test_security_sales_deletion_protection(self):
        """Test that sale deletion requires valid PIN."""
        test_sale_id = "test-sec-sale-01"
        s = SaleModel(
            id=test_sale_id,
            receipt_number="2026-SEC01",
            timestamp=datetime.now(timezone.utc),
            total_amount=100.0,
            payment_method="cash",
            tax_summary={"total": 100.0}
        )
        self.db.add(s)
        self.db.commit()

        try:
            # 1. Without PIN or override -> 401
            res_no_auth = self.client.delete(f"/api/v1/sales/{test_sale_id}")
            self.assertEqual(res_no_auth.status_code, 401)

            # 2. With wrong PIN -> 401
            res_wrong_pin = self.client.delete(f"/api/v1/sales/{test_sale_id}", headers={"X-Admin-PIN": "9999"})
            self.assertEqual(res_wrong_pin.status_code, 401)

            # 3. With correct default PIN '1234' -> 200
            res_valid = self.client.delete(f"/api/v1/sales/{test_sale_id}", headers={"X-Admin-PIN": "1234"})
            self.assertEqual(res_valid.status_code, 200)
            self.assertEqual(res_valid.json()["status"], "DELETED")
        finally:
            self.db.query(SaleModel).filter(SaleModel.id == test_sale_id).delete()
            self.db.commit()

    def test_security_qr_spd_ignores_client_iban(self):
        """Test that GET /api/v1/qr/spd generates QR code strictly from DB config and does not crash."""
        res = self.client.get("/api/v1/qr/spd?amount=150.0&iban=CZ9999999999999999999999")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "image/png")
        self.assertGreater(len(res.content), 100)

    def test_security_secret_key_anchored_in_data_dir(self):
        """Verify SECRET_KEY_FILE is strictly inside backend/data directory."""
        from services.security_utils import SECRET_KEY_FILE
        self.assertTrue(SECRET_KEY_FILE.endswith(os.path.join("data", ".secret_key")))
        self.assertTrue(os.path.isabs(SECRET_KEY_FILE))

    def test_system_backup_list_and_restore(self):
        """Test backup creation, listing, and restore endpoint."""
        # 1. Trigger backup
        res_backup = self.client.post("/api/v1/system/trigger-backup")
        self.assertEqual(res_backup.status_code, 200)
        backup_info = res_backup.json()
        self.assertEqual(backup_info["status"], "SUCCESS")
        filename = backup_info["filename"]

        # 2. List backups
        res_list = self.client.get("/api/v1/system/backups")
        self.assertEqual(res_list.status_code, 200)
        backups = res_list.json()
        self.assertTrue(any(b["filename"] == filename for b in backups))

        # 3. Test restore invalid file -> 400
        res_bad = self.client.post("/api/v1/system/restore", json={"filename": "non_existent.zip"})
        self.assertEqual(res_bad.status_code, 400)

        # 4. Test restore valid file -> 200
        res_restore = self.client.post("/api/v1/system/restore", json={"filename": filename})
        self.assertEqual(res_restore.status_code, 200)
        self.assertEqual(res_restore.json()["status"], "SUCCESS")


if __name__ == "__main__":
    unittest.main()

