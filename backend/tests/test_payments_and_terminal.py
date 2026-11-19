"""Unit and router tests for CSOB Ingenico terminal and QR payment endpoints."""
import os
import socket
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from models import StoreConfigModel
from services.csob_terminal_service import (
    CSOBTerminalService,
    DEFAULT_CSOB_PORT,
    ETX,
    STX,
)
from services.email_payment_listener import payment_cache
from tests.temp_db import TempDbTestCase


class TestCSOBTerminalService(unittest.TestCase):
    """Unit tests for GPE protocol framing, parsing, and mocked TCP socket paths."""

    def test_is_configured_checks_enabled_ip_and_port(self):
        self.assertFalse(CSOBTerminalService(ip="192.168.1.50", port=8888, enabled=False).is_configured())
        self.assertFalse(CSOBTerminalService(ip="   ", port=8888, enabled=True).is_configured())

        svc = CSOBTerminalService(ip=" 192.168.1.50 ", port=0, terminal_id=" TID01 ", enabled=True)
        self.assertTrue(svc.is_configured())
        self.assertEqual(svc.ip, "192.168.1.50")
        self.assertEqual(svc.port, DEFAULT_CSOB_PORT)
        self.assertEqual(svc.terminal_id, "TID01")

    def test_calculate_lrc_xor(self):
        svc = CSOBTerminalService()
        self.assertEqual(svc.calculate_lrc(b""), b"\x00")
        self.assertEqual(svc.calculate_lrc(b"\x01\x02\x03"), b"\x00")

        payload = b"SALE|15050|203|T1|VS1\x03"
        expected = 0
        for byte in payload:
            expected ^= byte
        self.assertEqual(svc.calculate_lrc(payload), bytes([expected]))

    def test_build_gpe_request_frame_sale_and_reconcile(self):
        svc = CSOBTerminalService(ip="10.0.0.10", port=8888, terminal_id="T1", enabled=True)

        sale_frame = svc.build_gpe_request_frame(150.50, transaction_type="SALE", variable_symbol="20260001")
        self.assertTrue(sale_frame.startswith(STX))
        expected_content = b"SALE|15050|203|T1|20260001" + ETX
        self.assertEqual(sale_frame[1:-1], expected_content)
        self.assertEqual(sale_frame[-1:], svc.calculate_lrc(expected_content))

        edge_frame = svc.build_gpe_request_frame(19.99, transaction_type="SALE", variable_symbol="")
        self.assertIn(b"SALE|1999|203|T1|", edge_frame)

        reconcile_frame = svc.build_gpe_request_frame(0.0, transaction_type="RECONCILE")
        self.assertIn(b"RECONCILE|0|203|T1|", reconcile_frame)

    def test_parse_gpe_response_frame_variants(self):
        svc = CSOBTerminalService()

        empty = svc.parse_gpe_response_frame(b"")
        self.assertFalse(empty["success"])
        self.assertEqual(empty["status"], "EMPTY_RESPONSE")

        approved = svc.parse_gpe_response_frame(b"\x0200|998877|4111****1111|TX999|Uctenka\x03\x12")
        self.assertTrue(approved["success"])
        self.assertEqual(approved["status"], "APPROVED")
        self.assertEqual(approved["response_code"], "00")
        self.assertEqual(approved["auth_code"], "998877")
        self.assertEqual(approved["card_mask"], "4111****1111")
        self.assertEqual(approved["transaction_id"], "TX999")
        self.assertEqual(approved["receipt_text"], "Uctenka")

        for code in ("000", "OK", "APPROVED"):
            res = svc.parse_gpe_response_frame(f"\x02{code}|A1\x03\x00".encode("utf-8"))
            self.assertTrue(res["success"])
            self.assertEqual(res["status"], "APPROVED")
            self.assertEqual(res["card_mask"], "**** **** **** ****")

        declined = svc.parse_gpe_response_frame(b"\x0251||4111****1111|TX100|Insufficient funds\x03\x00")
        self.assertFalse(declined["success"])
        self.assertEqual(declined["status"], "DECLINED")
        self.assertEqual(declined["response_code"], "51")
        self.assertIn("51", declined["message"])

        unframed = svc.parse_gpe_response_frame(b"00|AUTH2|5200****9999|TX2")
        self.assertTrue(unframed["success"])
        self.assertEqual(unframed["auth_code"], "AUTH2")

    @patch("services.csob_terminal_service.socket.create_connection")
    def test_ping_terminal_outcomes(self, mock_connect):
        unconfigured = CSOBTerminalService(ip="", port=8888)
        res_empty = unconfigured.ping_terminal()
        self.assertFalse(res_empty["success"])
        self.assertEqual(res_empty["status"], "NOT_CONFIGURED")
        mock_connect.assert_not_called()

        svc = CSOBTerminalService(ip="192.168.1.50", port=8888, enabled=True)

        mock_sock = MagicMock()
        mock_connect.return_value = mock_sock
        ok = svc.ping_terminal()
        self.assertTrue(ok["success"])
        self.assertEqual(ok["status"], "REACHABLE")
        mock_sock.close.assert_called_once()

        mock_connect.side_effect = socket.timeout("timed out")
        timed_out = svc.ping_terminal()
        self.assertFalse(timed_out["success"])
        self.assertEqual(timed_out["status"], "TIMEOUT")

        mock_connect.side_effect = ConnectionRefusedError("refused")
        refused = svc.ping_terminal()
        self.assertFalse(refused["success"])
        self.assertEqual(refused["status"], "REFUSED")

        mock_connect.side_effect = OSError("Network unreachable")
        err = svc.ping_terminal()
        self.assertFalse(err["success"])
        self.assertEqual(err["status"], "ERROR")

    def test_read_gpe_frame_segmented_and_timeout_and_eof(self):
        svc = CSOBTerminalService()

        sock_seg = MagicMock()
        sock_seg.recv.side_effect = [b"\x0200|AUTH", b"|MASK\x03", b"\x42"]
        self.assertEqual(svc._read_gpe_frame(sock_seg, overall_timeout=2.0), b"\x0200|AUTH|MASK\x03\x42")

        sock_timeout = MagicMock()
        sock_timeout.recv.side_effect = [b"\x0200|AUTH\x03", socket.timeout()]
        self.assertEqual(svc._read_gpe_frame(sock_timeout, overall_timeout=2.0), b"\x0200|AUTH\x03")

        sock_eof = MagicMock()
        sock_eof.recv.side_effect = [b"\x0200|PART", b""]
        self.assertEqual(svc._read_gpe_frame(sock_eof, overall_timeout=2.0), b"\x0200|PART")

    @patch("services.csob_terminal_service.socket.create_connection")
    def test_process_payment_guards_and_socket_paths(self, mock_connect):
        no_ip = CSOBTerminalService(ip="", port=8888, enabled=True).process_payment(249.50)
        self.assertEqual(no_ip["status"], "NOT_CONFIGURED")
        self.assertFalse(no_ip["success"])

        disabled = CSOBTerminalService(ip="192.168.1.50", port=8888, enabled=False).process_payment(249.50)
        self.assertEqual(disabled["status"], "DISABLED")
        self.assertFalse(disabled["success"])
        mock_connect.assert_not_called()

        svc = CSOBTerminalService(ip="192.168.1.50", port=8888, terminal_id="T1", enabled=True)
        mock_sock = MagicMock()
        mock_sock.recv.return_value = b"\x0200|AUTH1|5500****1234|TX42|OK\x03\x00"
        mock_connect.return_value.__enter__.return_value = mock_sock

        res = svc.process_payment(249.50, variable_symbol="VS99")
        expected_frame = svc.build_gpe_request_frame(249.50, "SALE", "VS99")
        mock_sock.sendall.assert_called_once_with(expected_frame)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "APPROVED")
        self.assertEqual(res["amount"], 249.50)
        self.assertEqual(res["auth_code"], "AUTH1")

        mock_connect.side_effect = socket.timeout("card timeout")
        timeout_res = svc.process_payment(249.50)
        self.assertFalse(timeout_res["success"])
        self.assertEqual(timeout_res["status"], "TIMEOUT")
        self.assertEqual(timeout_res["amount"], 249.50)

        mock_connect.side_effect = ConnectionRefusedError("down")
        conn_err = svc.process_payment(249.50)
        self.assertFalse(conn_err["success"])
        self.assertEqual(conn_err["status"], "CONNECTION_ERROR")
        self.assertEqual(conn_err["amount"], 249.50)

    @patch("services.csob_terminal_service.socket.create_connection")
    def test_reconcile_terminal_paths(self, mock_connect):
        unconfigured = CSOBTerminalService(ip="", port=8888).reconcile_terminal()
        self.assertFalse(unconfigured["success"])
        self.assertEqual(unconfigured["status"], "NOT_CONFIGURED")
        mock_connect.assert_not_called()

        svc = CSOBTerminalService(ip="192.168.1.50", port=8888, terminal_id="T1", enabled=True)
        mock_sock = MagicMock()
        mock_sock.recv.return_value = b"\x0200|REC1||TX9|UZAVERKA OK\x03\x00"
        mock_connect.return_value.__enter__.return_value = mock_sock

        ok = svc.reconcile_terminal()
        self.assertTrue(ok["success"])
        self.assertEqual(ok["status"], "APPROVED")
        sent_frame = mock_sock.sendall.call_args[0][0]
        self.assertIn(b"RECONCILE|0|203|T1|", sent_frame)

        mock_connect.side_effect = OSError("broken pipe")
        err = svc.reconcile_terminal()
        self.assertFalse(err["success"])
        self.assertEqual(err["status"], "CONNECTION_ERROR")


class TestPaymentsRouter(TempDbTestCase):
    """API tests for /api/v1/payments/* endpoints using isolated temp SQLite DB."""

    def setUp(self):
        payment_cache._cache.clear()
        db = SessionLocal()
        try:
            db.query(StoreConfigModel).delete()
            db.commit()
        finally:
            db.close()

    def tearDown(self):
        payment_cache._cache.clear()

    def _seed_store_config(self, **fields):
        db = SessionLocal()
        try:
            cfg = db.query(StoreConfigModel).first()
            if not cfg:
                cfg = StoreConfigModel(id=1)
                db.add(cfg)
            for key, value in fields.items():
                setattr(cfg, key, value)
            db.commit()
        finally:
            db.close()

    def test_generate_qr_string_rejects_missing_or_placeholder_iban(self):
        res_missing = self.client.post(
            "/api/v1/payments/generate-qr-string",
            json={"amount": 100.0, "variableSymbol": "20260001"},
        )
        self.assertEqual(res_missing.status_code, 400)

        self._seed_store_config(bank_account_iban="CZ65 0800 0000 0012 3456 7890")
        res_placeholder = self.client.post(
            "/api/v1/payments/generate-qr-string",
            json={"amount": 100.0, "variableSymbol": "20260001"},
        )
        self.assertEqual(res_placeholder.status_code, 400)

    def test_generate_qr_string_success(self):
        self._seed_store_config(bank_account_iban="CZ58 5500 0000 1265 0980 0100")
        res = self.client.post(
            "/api/v1/payments/generate-qr-string",
            json={"amount": 199.5, "variableSymbol": "20260001", "message": "Test nakup"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "OK")
        self.assertEqual(
            data["spd_string"],
            "SPD*1.0*ACC:CZ5855000000126509800100*AM:199.50*CC:CZK*X-VS:20260001*X-KS:0008*MSG:Test nakup",
        )

    def test_verify_qr_payment_pending_underpaid_and_paid(self):
        pending = self.client.post(
            "/api/v1/payments/verify-qr",
            json={"variableSymbol": "20260099", "expectedAmount": 100.0},
        )
        self.assertEqual(pending.status_code, 200)
        self.assertEqual(pending.json()["status"], "PENDING")
        self.assertEqual(pending.json()["received_amount"], 0.0)

        payment_cache.add_payment("20260099", 99.0, "Underpaid")
        underpaid = self.client.post(
            "/api/v1/payments/verify-qr",
            json={"variableSymbol": "20260099", "expectedAmount": 100.0},
        )
        self.assertEqual(underpaid.status_code, 200)
        self.assertEqual(underpaid.json()["status"], "PENDING")

        payment_cache.add_payment("20260099", 100.0, "Paid in full")
        paid = self.client.post(
            "/api/v1/payments/verify-qr",
            json={"variableSymbol": "20260099", "expectedAmount": 100.0},
        )
        self.assertEqual(paid.status_code, 200)
        body = paid.json()
        self.assertEqual(body["status"], "PAID")
        self.assertEqual(body["expected_amount"], 100.0)
        self.assertEqual(body["received_amount"], 100.0)

    def test_terminal_config_get_and_post(self):
        initial = self.client.get("/api/v1/payments/terminal/config")
        self.assertEqual(initial.status_code, 200)
        self.assertEqual(
            initial.json(),
            {"enabled": False, "ip": "", "port": 8888, "terminalId": "", "is_configured": False},
        )

        saved = self.client.post(
            "/api/v1/payments/terminal/config",
            json={"enabled": True, "ip": " 192.168.1.99 ", "port": 0, "terminalId": " TERM7 "},
        )
        self.assertEqual(saved.status_code, 200)
        saved_json = saved.json()
        self.assertEqual(saved_json["status"], "SUCCESS")
        self.assertEqual(
            saved_json["config"],
            {"enabled": True, "ip": "192.168.1.99", "port": 8888, "terminalId": "TERM7"},
        )

        fetched = self.client.get("/api/v1/payments/terminal/config")
        self.assertEqual(fetched.status_code, 200)
        self.assertTrue(fetched.json()["is_configured"])
        self.assertEqual(fetched.json()["ip"], "192.168.1.99")
        self.assertEqual(fetched.json()["terminalId"], "TERM7")

    @patch("routers.payments.CSOBTerminalService.reconcile_terminal")
    @patch("routers.payments.CSOBTerminalService.process_payment")
    @patch("routers.payments.CSOBTerminalService.ping_terminal")
    def test_terminal_ping_pay_and_reconcile_endpoints(self, mock_ping, mock_pay, mock_reconcile):
        self.client.post(
            "/api/v1/payments/terminal/config",
            json={"enabled": True, "ip": "192.168.1.99", "port": 9000, "terminalId": "TID1"},
        )

        mock_ping.return_value = {"success": True, "status": "REACHABLE"}
        res_ping_db = self.client.post("/api/v1/payments/terminal/ping", json={})
        self.assertEqual(res_ping_db.status_code, 200)
        self.assertEqual(res_ping_db.json()["status"], "REACHABLE")
        mock_ping.assert_called_with(target_ip="192.168.1.99", target_port=9000)

        res_ping_override = self.client.post(
            "/api/v1/payments/terminal/ping",
            json={"ip": "10.0.0.5", "port": 7777},
        )
        self.assertEqual(res_ping_override.status_code, 200)
        mock_ping.assert_called_with(target_ip="10.0.0.5", target_port=7777)

        mock_pay.return_value = {"success": True, "status": "APPROVED", "amount": 320.0}
        res_pay = self.client.post(
            "/api/v1/payments/terminal/pay",
            json={"amount": 320.0, "variableSymbol": "VS55"},
        )
        self.assertEqual(res_pay.status_code, 200)
        self.assertEqual(res_pay.json()["status"], "APPROVED")
        mock_pay.assert_called_once_with(amount=320.0, variable_symbol="VS55")

        mock_reconcile.return_value = {"success": True, "status": "APPROVED"}
        res_rec = self.client.post("/api/v1/payments/terminal/reconcile")
        self.assertEqual(res_rec.status_code, 200)
        self.assertEqual(res_rec.json()["status"], "APPROVED")
        mock_reconcile.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
