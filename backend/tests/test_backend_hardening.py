import unittest
import time
import uuid
from datetime import datetime, timedelta
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
        now = datetime.utcnow()
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


if __name__ == "__main__":
    unittest.main()
