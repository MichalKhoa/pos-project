import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine


class TestSystemRouter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def test_open_keyboard_remote_ip_forbidden(self):
        """Requests from non-loopback IPs must receive 403 Forbidden."""
        remote_client = TestClient(app)
        remote_client._transport.client = ("192.168.1.50", 54321)
        res = remote_client.post("/api/v1/system/open-keyboard")
        self.assertEqual(res.status_code, 403)
        self.assertIn("detail", res.json())

    def test_open_keyboard_untrusted_origin_forbidden(self):
        """Requests from untrusted web origins must receive 403 Forbidden."""
        bad_headers = {"Origin": "https://malicious-site.com"}
        res = self.client.post("/api/v1/system/open-keyboard", headers=bad_headers)
        self.assertEqual(res.status_code, 403)
        self.assertIn("externího webového původu", res.json().get("detail", ""))

    def test_open_keyboard_non_windows_skipped(self):
        """On non-Windows platforms (e.g. Linux/macOS), endpoint returns SKIPPED status."""
        with patch("sys.platform", "linux"):
            res = self.client.post("/api/v1/system/open-keyboard")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data.get("status"), "SKIPPED")
            self.assertIn("Windows", data.get("message", ""))

    def test_open_keyboard_windows_tabtip_startfile_success(self):
        """On Windows, if TabTip.exe exists and os.startfile succeeds, returns SUCCESS."""
        with patch("sys.platform", "win32"), \
             patch("os.path.exists", return_value=True), \
             patch("os.startfile", create=True) as mock_startfile:
            res = self.client.post("/api/v1/system/open-keyboard")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data.get("status"), "SUCCESS")
            mock_startfile.assert_called_once()

    def test_open_keyboard_windows_tabtip_popen_success(self):
        """On Windows, if TabTip.exe exists without os.startfile, launches via subprocess.Popen."""
        with patch("sys.platform", "win32"), \
             patch("os.path.exists", return_value=True), \
             patch("subprocess.Popen") as mock_popen:
            with patch("routers.system.hasattr", side_effect=lambda obj, name: False if name == "startfile" else hasattr(obj, name)):
                res = self.client.post("/api/v1/system/open-keyboard")
                self.assertEqual(res.status_code, 200)
                data = res.json()
                self.assertEqual(data.get("status"), "SUCCESS")

    def test_open_keyboard_windows_osk_fallback_success(self):
        """If TabTip.exe is missing, falls back to osk.exe via subprocess.Popen."""
        def mock_exists(path):
            return "TabTip.exe" not in path

        with patch("sys.platform", "win32"), \
             patch("os.path.exists", side_effect=mock_exists), \
             patch("subprocess.Popen") as mock_popen:
            res = self.client.post("/api/v1/system/open-keyboard")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data.get("status"), "SUCCESS")
            mock_popen.assert_called()

    def test_open_keyboard_windows_launch_failure(self):
        """If all launch attempts fail with exception, returns ERROR status."""
        with patch("sys.platform", "win32"), \
             patch("os.path.exists", return_value=False), \
             patch("subprocess.Popen", side_effect=Exception("Execution blocked by system")):
            res = self.client.post("/api/v1/system/open-keyboard")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data.get("status"), "ERROR")
            self.assertIn("Nepodařilo se spustit", data.get("message", ""))


if __name__ == "__main__":
    unittest.main()
