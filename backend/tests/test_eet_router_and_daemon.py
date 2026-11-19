"""Tests for EET 2.0 service, offline resend daemon, and /api/v1/eet/* router."""
import os
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from models import EetAuditLogModel, SaleModel, StoreConfigModel
import routers.eet as eet_router
import services.eet_resend_daemon as eet_daemon
from services.eet_service import CzechEETService
from tests.temp_db import TempDbTestCase

PLAYGROUND_CERT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "certs", "CA_EET-Playground-CZ00000019.p12")
)
PLAYGROUND_PWD = "aaaa1111"


def _reset_eet_tables():
    db = SessionLocal()
    try:
        db.query(EetAuditLogModel).delete()
        db.query(SaleModel).delete()
        db.query(StoreConfigModel).delete()
        db.commit()
    finally:
        db.close()


def _seed_config(**fields):
    db = SessionLocal()
    try:
        cfg = StoreConfigModel(id=1, **fields)
        db.add(cfg)
        db.commit()
    finally:
        db.close()


def _seed_pending_sale(sale_id: str, receipt_number: str):
    db = SessionLocal()
    try:
        sale = SaleModel(
            id=sale_id,
            receipt_number=receipt_number,
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            total_amount=121.0,
            payment_method="cash",
            tax_summary={"21": {"rate": 21, "net": 100.0, "tax": 21.0, "gross": 121.0}},
            eet_status="OFFLINE_PENDING",
            is_sent_to_eet=False,
            eet_retry_count=0,
        )
        db.add(sale)
        db.commit()
    finally:
        db.close()


class TestCzechEETService(unittest.TestCase):
    """Unit tests for CzechEETService signing, submission, and verification."""

    def test_get_crypto_manager_caches_by_path_and_password(self):
        svc = CzechEETService()
        m1 = svc.get_crypto_manager(PLAYGROUND_CERT, PLAYGROUND_PWD)
        m2 = svc.get_crypto_manager(PLAYGROUND_CERT, PLAYGROUND_PWD)
        m3 = svc.get_crypto_manager(PLAYGROUND_CERT, "wrong")

        self.assertIs(m1, m2)
        self.assertIsNot(m1, m3)

    @patch("services.eet_service.EETSoapClient.send_sale_to_eet")
    def test_sign_and_submit_sale_online_and_offline_fallback(self, mock_send):
        svc = CzechEETService()
        sale_data = {
            "receiptNumber": "2026-000010",
            "totalAmount": 250.0,
            "timestamp": "2026-11-19T10:00:00Z",
        }
        with self.assertRaises(ValueError):
            svc.sign_and_submit_sale(sale_data, {})

        cfg = {
            "dic": "CZ00000019",
            "id_provozovny": "11",
            "id_pokl": "1",
            "eet_cert_path": PLAYGROUND_CERT,
            "eet_cert_password": PLAYGROUND_PWD,
            "eet_environment": "playground",
        }

        mock_send.return_value = {"status": "EVD_OK", "fik": "FIK-123", "pok": "POK-123"}
        online_res = svc.sign_and_submit_sale(sale_data, cfg)
        self.assertTrue(online_res["is_sent_to_eet"])
        self.assertEqual(online_res["eet_status"], "EVD_OK")
        self.assertEqual(online_res["fik"], "FIK-123")
        self.assertEqual(online_res["pok"], "POK-123")
        self.assertTrue(online_res["bkp"])
        self.assertTrue(online_res["pkp"])

        mock_send.return_value = {"status": "OFFLINE_PENDING", "fik": None}
        offline_res = svc.sign_and_submit_sale(sale_data, {**cfg, "offline_mode": True})
        self.assertFalse(offline_res["is_sent_to_eet"])
        self.assertEqual(offline_res["eet_status"], "OFFLINE_PENDING")
        self.assertTrue(offline_res["bkp"])
        self.assertTrue(offline_res["pkp"])

    @patch("services.eet_service.EETSoapClient.send_sale_to_eet")
    def test_verify_eet_connection_success_and_error(self, mock_send):
        svc = CzechEETService()
        with self.assertRaises(ValueError):
            svc.verify_eet_connection({})

        cfg = {
            "dic": "CZ00000019",
            "eet_cert_path": PLAYGROUND_CERT,
            "eet_cert_password": PLAYGROUND_PWD,
            "eet_environment": "playground",
        }

        mock_send.return_value = {"status": "EVD_OK", "fik": "FIK-V", "pok": "POK-V"}
        ok = svc.verify_eet_connection(cfg)
        self.assertEqual(ok["status"], "SUCCESS")
        self.assertTrue(ok["certificate_info"]["loaded"])
        self.assertTrue(mock_send.call_args.kwargs["overeni"])

        mock_send.return_value = {"status": "ERROR", "error": "SOAP fault"}
        err = svc.verify_eet_connection(cfg)
        self.assertEqual(err["status"], "ERROR")
        self.assertEqual(err["detail"], "SOAP fault")


class TestEETResendDaemon(TempDbTestCase):
    """Tests for offline EET batch resend logic, audit logs, and circuit breaker."""

    def setUp(self):
        _reset_eet_tables()

    def test_returns_zero_when_disabled_or_queue_empty(self):
        _seed_config(dic="CZ00000019", eet_enabled=False)
        self.assertEqual(eet_daemon.resend_pending_offline_sales(), 0)

        _reset_eet_tables()
        _seed_config(dic="CZ00000019", eet_enabled=True)
        self.assertEqual(eet_daemon.resend_pending_offline_sales(), 0)

    @patch("services.eet_resend_daemon.eet_service.sign_and_submit_sale")
    def test_resends_pending_sales_updates_db_and_writes_audit_log(self, mock_submit):
        _seed_config(dic="CZ00000019", eet_enabled=True)
        _seed_pending_sale("sale-1", "2026-000001")
        mock_submit.return_value = {"eet_status": "EVD_OK", "fik": "FIK-OK-1", "bkp": "BKP-1"}

        processed = eet_daemon.resend_pending_offline_sales()
        self.assertEqual(processed, 1)

        db = SessionLocal()
        try:
            sale = db.query(SaleModel).filter(SaleModel.id == "sale-1").one()
            self.assertTrue(sale.is_sent_to_eet)
            self.assertEqual(sale.eet_status, "EVD_OK")
            self.assertEqual(sale.fik_code, "FIK-OK-1")
            self.assertEqual(sale.bkp_code, "BKP-1")
            self.assertEqual(sale.eet_retry_count, 1)

            logs = db.query(EetAuditLogModel).all()
            self.assertEqual(len(logs), 1)
            self.assertEqual(logs[0].action, "RETRY_SEND")
            self.assertEqual(logs[0].status, "EVD_OK")
            self.assertEqual(logs[0].fik, "FIK-OK-1")
        finally:
            db.close()

    @patch("services.eet_resend_daemon.eet_service.sign_and_submit_sale")
    def test_circuit_breaker_stops_after_three_consecutive_failures(self, mock_submit):
        _seed_config(dic="CZ00000019", eet_enabled=True)
        for idx in range(1, 5):
            _seed_pending_sale(f"sale-{idx}", f"2026-00000{idx}")
        mock_submit.return_value = {"eet_status": "OFFLINE_PENDING", "fik": None, "bkp": "BKP-X", "error": "timeout"}

        processed = eet_daemon.resend_pending_offline_sales()
        self.assertEqual(processed, 0)
        self.assertEqual(mock_submit.call_count, 3)

        db = SessionLocal()
        try:
            self.assertEqual(db.query(EetAuditLogModel).count(), 3)
            fourth = db.query(SaleModel).filter(SaleModel.id == "sale-4").one()
            self.assertEqual(fourth.eet_retry_count, 0)
        finally:
            db.close()

    @patch("services.eet_resend_daemon.eet_service.sign_and_submit_sale")
    def test_circuit_breaker_stops_after_three_exceptions(self, mock_submit):
        _seed_config(dic="CZ00000019", eet_enabled=True)
        for idx in range(1, 5):
            _seed_pending_sale(f"sale-ex-{idx}", f"2026-00001{idx}")
        mock_submit.side_effect = RuntimeError("network unreachable")

        processed = eet_daemon.resend_pending_offline_sales()
        self.assertEqual(processed, 0)
        self.assertEqual(mock_submit.call_count, 3)

        db = SessionLocal()
        try:
            logs = db.query(EetAuditLogModel).all()
            self.assertEqual(len(logs), 3)
            self.assertTrue(all(log.status == "ERROR" and "network unreachable" in (log.error_message or "") for log in logs))
            fourth = db.query(SaleModel).filter(SaleModel.id == "sale-ex-4").one()
            self.assertEqual(fourth.eet_retry_count, 0)
        finally:
            db.close()

    def test_start_eet_resend_daemon_is_idempotent(self):
        orig_started = eet_daemon._daemon_started
        eet_daemon._daemon_started = False
        try:
            with patch("services.eet_resend_daemon.threading.Thread") as mock_thread_cls:
                mock_thread = MagicMock()
                mock_thread_cls.return_value = mock_thread
                eet_daemon.start_eet_resend_daemon()
                eet_daemon.start_eet_resend_daemon()

                mock_thread_cls.assert_called_once()
                mock_thread.start.assert_called_once()
        finally:
            eet_daemon._daemon_started = orig_started


class TestEETRouter(TempDbTestCase):
    """API tests for /api/v1/eet/* endpoints."""

    def setUp(self):
        eet_router.eet_service.crypto_managers.clear()
        _reset_eet_tables()

    def tearDown(self):
        eet_router.eet_service.crypto_managers.clear()

    def test_get_eet_status_disabled_vs_enabled_pending_count(self):
        _seed_config(dic="CZ00000019", eet_enabled=False)
        _seed_pending_sale("sale-st-1", "2026-000101")

        res_off = self.client.get("/api/v1/eet/status")
        self.assertEqual(res_off.status_code, 200)
        self.assertFalse(res_off.json()["eet_enabled"])
        self.assertEqual(res_off.json()["pending_offline_sales"], 0)

        db = SessionLocal()
        try:
            cfg = db.query(StoreConfigModel).first()
            cfg.eet_enabled = True
            db.commit()
        finally:
            db.close()

        res_on = self.client.get("/api/v1/eet/status")
        self.assertEqual(res_on.status_code, 200)
        self.assertTrue(res_on.json()["eet_enabled"])
        self.assertEqual(res_on.json()["pending_offline_sales"], 1)

    @patch("routers.eet.eet_service.verify_eet_connection")
    def test_verify_eet_endpoint_delegates_to_service(self, mock_verify):
        _seed_config(dic="CZ00000019", eet_enabled=True)
        mock_verify.return_value = {"status": "SUCCESS", "environment": "playground"}

        res = self.client.post("/api/v1/eet/verify")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "SUCCESS")
        mock_verify.assert_called_once()

    def test_upload_cert_validations_and_success(self):
        cert_dir = os.path.join(self._tmp, "certs")
        os.makedirs(cert_dir, exist_ok=True)

        bad_ext = self.client.post(
            "/api/v1/eet/upload-cert",
            files={"file": ("bad.txt", b"hello", "text/plain")},
            data={"password": "", "environment": "playground"},
        )
        self.assertEqual(bad_ext.status_code, 400)

        oversized = self.client.post(
            "/api/v1/eet/upload-cert",
            files={"file": ("big.p12", b"x" * (2 * 1024 * 1024 + 10), "application/x-pkcs12")},
            data={"password": "", "environment": "playground"},
        )
        self.assertEqual(oversized.status_code, 413)

        with patch("routers.eet.CERTS_DIR", cert_dir):
            corrupt = self.client.post(
                "/api/v1/eet/upload-cert",
                files={"file": ("corrupt.p12", b"not-a-p12", "application/x-pkcs12")},
                data={"password": "bad", "environment": "playground"},
            )
            self.assertEqual(corrupt.status_code, 400)
            self.assertFalse(os.path.exists(os.path.join(cert_dir, "corrupt.p12")))

            with open(PLAYGROUND_CERT, "rb") as f:
                valid_bytes = f.read()

            ok = self.client.post(
                "/api/v1/eet/upload-cert",
                files={"file": ("playground_test.p12", valid_bytes, "application/x-pkcs12")},
                data={"password": PLAYGROUND_PWD, "environment": "playground"},
            )
            self.assertEqual(ok.status_code, 200)
            body = ok.json()
            self.assertEqual(body["status"], "SUCCESS")
            self.assertTrue(body["certificate"]["loaded"])

            db = SessionLocal()
            try:
                cfg = db.query(StoreConfigModel).first()
                self.assertEqual(cfg.eet_cert_path, os.path.join(cert_dir, "playground_test.p12"))
                self.assertEqual(cfg.get_decrypted_cert_password(), PLAYGROUND_PWD)
            finally:
                db.close()

    def test_offline_queue_process_queue_audit_logs_and_force_resend(self):
        _seed_config(dic="CZ00000019", eet_enabled=False)
        _seed_pending_sale("s-1", "2026-000201")
        _seed_pending_sale("s-2", "2026-000202")

        db = SessionLocal()
        try:
            db.add(EetAuditLogModel(sale_id="s-1", action="FIRST_SEND", status="OFFLINE_PENDING", bkp="BKP-0"))
            db.commit()
        finally:
            db.close()

        queue_res = self.client.get("/api/v1/eet/offline-queue")
        self.assertEqual(queue_res.status_code, 200)
        self.assertEqual(queue_res.json()["count"], 2)

        logs_res = self.client.get("/api/v1/eet/audit-logs?limit=10")
        self.assertEqual(logs_res.status_code, 200)
        self.assertEqual(logs_res.json()["count"], 1)

        disabled_res = self.client.post("/api/v1/eet/process-queue")
        self.assertEqual(disabled_res.status_code, 200)
        self.assertEqual(disabled_res.json()["status"], "EET_DISABLED")
        self.assertEqual(disabled_res.json()["processed"], 0)

        db = SessionLocal()
        try:
            cfg = db.query(StoreConfigModel).first()
            cfg.eet_enabled = True
            db.commit()
        finally:
            db.close()

        with patch(
            "routers.eet.eet_service.sign_and_submit_sale",
            side_effect=[
                {"eet_status": "EVD_OK", "is_sent_to_eet": True, "fik": "FIK-201"},
                {"eet_status": "OFFLINE_PENDING", "is_sent_to_eet": False, "error": "still offline"},
            ],
        ):
            proc_res = self.client.post("/api/v1/eet/process-queue")
            self.assertEqual(proc_res.status_code, 200)
            self.assertEqual(proc_res.json()["processed_count"], 1)
            self.assertEqual(proc_res.json()["synced_sales"], ["s-1"])

        db = SessionLocal()
        try:
            s1 = db.query(SaleModel).filter(SaleModel.id == "s-1").one()
            s2 = db.query(SaleModel).filter(SaleModel.id == "s-2").one()
            self.assertTrue(s1.is_sent_to_eet)
            self.assertEqual(s1.eet_status, "EVD_OK")
            self.assertEqual(s1.fik_code, "FIK-201")
            self.assertFalse(s2.is_sent_to_eet)
            self.assertEqual(s2.eet_status, "OFFLINE_PENDING")
        finally:
            db.close()

        with patch("services.eet_resend_daemon.resend_pending_offline_sales", return_value=1):
            force_res = self.client.post("/api/v1/eet/force-resend")
            self.assertEqual(force_res.status_code, 200)
            self.assertEqual(force_res.json()["processed_count"], 1)


if __name__ == "__main__":
    unittest.main()
