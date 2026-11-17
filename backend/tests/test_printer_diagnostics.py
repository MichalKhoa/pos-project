"""Printer self-diagnostics: raw print preview, print-attempt log, drawer pin setting."""
import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import DEFAULT_SALE, receipt_lines
from main import app
from database import Base, engine, SessionLocal
from models import PrintLogModel
from services.escpos_service import ESCPOSPrinterService


class PreviewReceiptTests(unittest.TestCase):
    def test_preview_matches_what_a_real_print_would_decode_to(self):
        service = ESCPOSPrinterService("DUMMY")
        res = service.preview_receipt(DEFAULT_SALE, {"storeName": "Test"})
        self.assertTrue(res["success"])
        text = "\n".join(res["lines"])
        self.assertIn("Test", text)
        self.assertIn(DEFAULT_SALE["items"][0]["name"], text)

    def test_preview_never_opens_the_cash_drawer(self):
        service = ESCPOSPrinterService("DUMMY")
        res = service.preview_receipt({**DEFAULT_SALE, "paymentMethod": "cash"}, {"storeName": "Test"})
        self.assertNotIn("\\x1bp", repr(res["lines"]))

    def test_preview_reports_failure_instead_of_a_false_success(self):
        from unittest.mock import patch

        service = ESCPOSPrinterService("DUMMY")
        with patch("services.escpos_service.wrap_text", side_effect=RuntimeError("boom")):
            res = service.preview_receipt(DEFAULT_SALE, {"storeName": "Test"})
        self.assertFalse(res["success"])
        self.assertIn("boom", res.get("error", ""))

    def test_preview_is_not_blocked_by_a_real_job_holding_the_hardware_lock(self):
        import threading
        import time
        from services.escpos_service import _hardware_printer_lock

        service = ESCPOSPrinterService("DUMMY")
        release_event = threading.Event()

        def hold_lock_on_another_thread():
            with _hardware_printer_lock:
                release_event.wait(timeout=2)

        holder = threading.Thread(target=hold_lock_on_another_thread)
        holder.start()
        try:
            time.sleep(0.05)  # let the other thread take the lock first
            start = time.monotonic()
            res = service.preview_receipt(DEFAULT_SALE, {"storeName": "Test"})
            elapsed = time.monotonic() - start
        finally:
            release_event.set()
            holder.join(timeout=2)

        self.assertTrue(res["success"])
        self.assertLess(elapsed, 1.0, "preview waited on the hardware lock held by another thread's real job")


class PreviewEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_preview_endpoint_returns_decoded_lines(self):
        res = self.client.post("/api/v1/printer/preview", json={
            "saleData": DEFAULT_SALE,
            "storeConfig": {"storeName": "Test Shop"}
        })
        self.assertEqual(res.status_code, 200)
        lines = res.json()["lines"]
        self.assertTrue(any("Test Shop" in line for line in lines))


class PrintLogTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)
        db = SessionLocal()
        db.query(PrintLogModel).delete()
        db.commit()
        db.close()

    def test_a_print_attempt_is_logged_and_listed_newest_first(self):
        self.client.post("/api/v1/printer/print-ruler", json={"storeConfig": {}})
        self.client.post("/api/v1/printer/open-drawer", json={"storeConfig": {}})

        res = self.client.get("/api/v1/printer/print-log")
        self.assertEqual(res.status_code, 200)
        attempts = res.json()["attempts"]
        self.assertGreaterEqual(len(attempts), 2)
        self.assertEqual(attempts[0]["kind"], "open-drawer")
        self.assertEqual(attempts[1]["kind"], "print-ruler")
        self.assertTrue(all(a["success"] for a in attempts[:2]))

    def test_log_is_pruned_to_the_retention_limit(self):
        from routers.printer import PRINT_LOG_RETENTION

        for _ in range(PRINT_LOG_RETENTION + 5):
            self.client.post("/api/v1/printer/open-drawer", json={"storeConfig": {}})

        db = SessionLocal()
        try:
            count = db.query(PrintLogModel).count()
        finally:
            db.close()
        self.assertLessEqual(count, PRINT_LOG_RETENTION)


class DrawerPinSettingTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_drawer_pin_round_trips_through_config(self):
        self.client.post("/api/v1/config", json={"drawerPin": 5})
        res = self.client.get("/api/v1/config")
        self.assertEqual(res.json()["drawerPin"], 5)

        self.client.post("/api/v1/config", json={"drawerPin": 2})
        res = self.client.get("/api/v1/config")
        self.assertEqual(res.json()["drawerPin"], 2)


if __name__ == "__main__":
    unittest.main()
