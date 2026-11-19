"""Tests for customer display router/LCD, system updater router, and printer discovery."""
import asyncio
import os
import sys
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
import routers.display as display_router
import routers.updater as updater_router
from services.hardware_display_service import HardwareLCDService, detect_vfd_com_port
from services.printer_discovery import detect_connected_printers


class TestDisplayRouterAndHardwareLCD(unittest.TestCase):
    """Tests for WebSocket/HTTP customer display broadcast and VFD serial output."""

    def setUp(self):
        display_router.manager.active_connections.clear()
        display_router.manager.last_payload = {"type": "CART_CLEAR", "cart": [], "totalAmount": 0}
        self.client = TestClient(app)

    def tearDown(self):
        display_router.manager.active_connections.clear()
        display_router.manager.last_payload = {"type": "CART_CLEAR", "cart": [], "totalAmount": 0}

    def test_broadcast_rejects_invalid_message_type(self):
        res = self.client.post("/api/v1/display/broadcast", json={"type": "INVALID"})
        self.assertEqual(res.status_code, 400)

    @patch("routers.display.hardware_lcd.send_display_update")
    def test_websocket_receives_initial_and_broadcast_payloads(self, mock_lcd):
        payload = {
            "type": "CART_UPDATE",
            "cart": [{"name": "Rohlik", "price": 3.5, "quantity": 2}],
            "totalAmount": 7.0,
        }
        with self.client.websocket_connect("/api/v1/ws/customer-display") as ws:
            initial = ws.receive_json()
            self.assertEqual(initial["type"], "CART_CLEAR")

            res = self.client.post("/api/v1/display/broadcast", json=payload)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["active_displays"], 1)

            received = ws.receive_json()
            self.assertEqual(received, payload)
            mock_lcd.assert_called_once_with(payload)

    def test_connection_manager_prunes_broken_websocket(self):
        broken_ws = MagicMock()
        broken_ws.send_json = AsyncMock(side_effect=RuntimeError("closed"))
        display_router.manager.active_connections.append(broken_ws)

        asyncio.run(display_router.manager.broadcast_cart_update({"type": "CART_CLEAR"}))
        self.assertNotIn(broken_ws, display_router.manager.active_connections)

    @patch("services.hardware_display_service.serial.Serial")
    def test_hardware_lcd_formats_all_states_and_transliterates(self, mock_serial_cls):
        lcd = HardwareLCDService(port="COM3")
        states = [
            {"type": "CART_UPDATE", "cart": [{"name": "Rohlík čerstvý", "price": 3.5, "quantity": 2}], "totalAmount": 7.0},
            {"type": "PAYMENT_PENDING", "totalAmount": 150.0},
            {"type": "PAYMENT_SUCCESS"},
            {"type": "CART_CLEAR"},
        ]

        for payload in states:
            mock_ser = MagicMock()
            mock_serial_cls.return_value = mock_ser
            lcd.send_display_update(payload, store_name="Obchod Žlutý")

            calls = [c.args[0] for c in mock_ser.write.call_args_list]
            self.assertEqual(calls[0], b"\x0c")
            self.assertEqual(calls[1], b"\x1b\x40")
            self.assertEqual(len(calls[2]), 40)
            decoded = calls[2].decode("cp852")
            self.assertTrue(decoded.isascii())
            mock_ser.close.assert_called_once()

        mock_serial_cls.side_effect = OSError("port busy")
        lcd.send_display_update({"type": "CART_CLEAR"})

    def test_detect_vfd_com_port_fallback(self):
        with patch.dict(sys.modules, {"win32com": None, "win32com.client": None}):
            self.assertEqual(detect_vfd_com_port(), "COM3")


class TestUpdaterRouter(unittest.TestCase):
    """Tests for /api/v1/update/* status and local-only update triggers."""

    def test_run_git_command_success_and_exception(self):
        with patch("routers.updater.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="abc1234\n", stderr="")
            self.assertEqual(updater_router.run_git_command(["rev-parse", "HEAD"]), (True, "abc1234", ""))

            mock_run.side_effect = OSError("git missing")
            self.assertEqual(updater_router.run_git_command(["status"]), (False, "", "git missing"))

    def test_update_status_up_to_date_and_behind(self):
        client = TestClient(app)

        with patch(
            "routers.updater.run_git_command",
            side_effect=[
                (True, "", ""),
                (True, "abc1234", ""),
                (True, "1 hour ago", ""),
                (True, "abc1234", ""),
                (True, "init", ""),
                (True, "1 hour ago", ""),
                (True, "0\t0", ""),
            ],
        ):
            up_to_date = client.get("/api/v1/update/status")
            self.assertEqual(up_to_date.status_code, 200)
            self.assertFalse(up_to_date.json()["is_update_available"])
            self.assertEqual(up_to_date.json()["behind_commits_count"], 0)

        with patch(
            "routers.updater.run_git_command",
            side_effect=[
                (True, "", ""),
                (True, "abc1234", ""),
                (True, "2 days ago", ""),
                (True, "def5678", ""),
                (True, "fix: bug", ""),
                (True, "5 minutes ago", ""),
                (True, "0\t3", ""),
            ],
        ):
            behind = client.get("/api/v1/update/status")
            self.assertEqual(behind.status_code, 200)
            data = behind.json()
            self.assertTrue(data["is_update_available"])
            self.assertEqual(data["behind_commits_count"], 3)
            self.assertEqual(data["latest_version"]["message"], "fix: bug")

    def test_apply_update_forbids_remote_caller(self):
        remote_client = TestClient(app, client=("192.168.1.50", 50000))
        res = remote_client.post("/api/v1/update/apply")
        self.assertEqual(res.status_code, 403)

    def test_apply_update_missing_script_and_success(self):
        local_client = TestClient(app)
        with patch("routers.updater.os.path.exists", return_value=False):
            missing = local_client.post("/api/v1/update/apply")
            self.assertEqual(missing.status_code, 500)

        with patch("routers.updater.os.path.exists", return_value=True), \
             patch("routers.updater.subprocess.Popen") as mock_popen:
            ok = local_client.post("/api/v1/update/apply")
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(ok.json()["status"], "UPDATE_INITIATED")
            mock_popen.assert_called_once()


class TestPrinterDiscovery(unittest.TestCase):
    """Tests for cross-platform printer device enumeration."""

    def test_fallback_default_usb_when_no_hardware_found(self):
        with patch("services.printer_discovery.os.name", "posix"), \
             patch("services.printer_discovery.sys.platform", "linux"), \
             patch("services.printer_discovery.glob.glob", return_value=[]), \
             patch("services.printer_discovery.subprocess.run", side_effect=FileNotFoundError):
            devices = detect_connected_printers()

        self.assertEqual([d["id"] for d in devices], ["/dev/usb/lp0", "network-custom", "browser-print"])
        self.assertEqual(devices[0]["status"], "DEFAULT")
        self.assertTrue(devices[0]["is_default"])

    def test_detects_usb_serial_and_cups_on_linux(self):
        def fake_glob(pattern):
            if pattern == "/dev/usb/lp*":
                return ["/dev/usb/lp0"]
            if pattern == "/dev/ttyUSB*":
                return ["/dev/ttyUSB0"]
            return []

        lpstat = MagicMock(returncode=0, stdout="printer EPSON_TM_T20 is idle.\n")
        with patch("services.printer_discovery.os.name", "posix"), \
             patch("services.printer_discovery.sys.platform", "linux"), \
             patch("services.printer_discovery.glob.glob", side_effect=fake_glob), \
             patch("services.printer_discovery.subprocess.run", return_value=lpstat):
            devices = detect_connected_printers()

        by_id = {d["id"]: d for d in devices}
        self.assertTrue(by_id["/dev/usb/lp0"]["is_default"])
        self.assertEqual(by_id["/dev/usb/lp0"]["status"], "CONNECTED")
        self.assertEqual(by_id["/dev/ttyUSB0"]["interface"], "SERIAL")
        self.assertEqual(by_id["cups-EPSON_TM_T20"]["interface"], "CUPS")
        self.assertFalse(any(d["status"] == "DEFAULT" for d in devices))

    def test_windows_win32print_sorting_and_default_selection(self):
        fake_win32print = types.SimpleNamespace(
            PRINTER_ENUM_LOCAL=2,
            PRINTER_ENUM_CONNECTIONS=4,
            PRINTER_ATTRIBUTE_WORK_OFFLINE=0x400,
            GetDefaultPrinter=lambda: "",
            EnumPrinters=lambda _flags: [
                (0, "USB001", "EPSON TM-T20 Offline", ""),
                (0, "PORTPROMPT:", "Microsoft Print to PDF", ""),
                (0, "USB002", "Star TSP143 POS", ""),
            ],
            OpenPrinter=lambda name: name,
            GetPrinter=lambda handle, _lvl: {"Attributes": 0x400 if "Offline" in handle else 0},
            ClosePrinter=lambda _handle: None,
        )

        with patch("services.printer_discovery.os.name", "nt"), \
             patch("services.printer_discovery.sys.platform", "win32"), \
             patch("services.printer_discovery.glob.glob", return_value=[]), \
             patch.dict(sys.modules, {"win32print": fake_win32print}):
            devices = detect_connected_printers()

        win_devices = [d for d in devices if d["interface"] == "WIN32"]
        self.assertEqual(
            [d["id"] for d in win_devices],
            ["Star TSP143 POS", "Microsoft Print to PDF", "EPSON TM-T20 Offline"],
        )
        self.assertTrue(win_devices[0]["is_default"])
        self.assertEqual(win_devices[2]["status"], "OFFLINE")


if __name__ == "__main__":
    unittest.main()
