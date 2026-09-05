import os
import sys
import unittest
import io
import zipfile
import sqlite3
import tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from main import app
from database import Base, engine, SessionLocal, DB_PATH
from models import StoreConfigModel
from paths import LOGS_DIR


class TestSystemDiagnostics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        # Ensure default config exists
        cfg = self.db.query(StoreConfigModel).first()
        if not cfg:
            cfg = StoreConfigModel()
            self.db.add(cfg)
            self.db.commit()
            self.db.refresh(cfg)

    def tearDown(self):
        self.db.close()

    def test_verify_admin_pin_endpoint(self):
        """Test POST /api/v1/config/verify-admin-pin with correct and incorrect PIN."""
        # 1. Correct default PIN
        res = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "1234"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("valid"))

        # 2. Master Recovery Key
        res_master = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "VOLTFLOW-ADMIN-MASTER-RECOVERY"})
        self.assertEqual(res_master.status_code, 200)
        self.assertTrue(res_master.json().get("valid"))

        # 3. Incorrect PIN
        res_fail = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "9999"})
        self.assertEqual(res_fail.status_code, 401)

    def test_diagnostics_requires_auth(self):
        """Test GET /api/v1/system/diagnostics authentication checks."""
        # 1. No auth -> 401
        res = self.client.get("/api/v1/system/diagnostics")
        self.assertEqual(res.status_code, 401)

        # 2. Wrong PIN -> 401
        res_wrong = self.client.get("/api/v1/system/diagnostics", headers={"X-Admin-PIN": "0000"})
        self.assertEqual(res_wrong.status_code, 401)

        # 3. Correct PIN -> 200
        res_ok = self.client.get("/api/v1/system/diagnostics", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("database", data)
        self.assertIn("system", data)
        self.assertIn("eet", data)
        self.assertIn("litestream", data)
        self.assertEqual(data["database"]["integrity"], "ok")

    def test_vacuum_endpoint(self):
        """Test POST /api/v1/system/db/vacuum requires auth and succeeds."""
        # 1. No auth -> 401
        res_no_auth = self.client.post("/api/v1/system/db/vacuum")
        self.assertEqual(res_no_auth.status_code, 401)

        # 2. Valid auth -> 200
        res = self.client.post("/api/v1/system/db/vacuum", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertGreater(data["db_size_bytes"], 0)

    def test_logs_endpoint(self):
        """Test GET /api/v1/system/logs tailing and filtering."""
        # Create a test log entry
        log_file = os.path.join(LOGS_DIR, "pos_backend.log")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write("[2026-09-05 00:00:00] [INFO] [test] Test log line for diagnostic inspection\n")
            f.write("[2026-09-05 00:00:01] [ERROR] [test] Test error line for diagnostic inspection\n")

        # 1. Fetch logs with auth
        res = self.client.get("/api/v1/system/logs?lines=50", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("lines", data)
        self.assertGreaterEqual(len(data["lines"]), 1)

        # 2. Filter by level ERROR
        res_err = self.client.get("/api/v1/system/logs?lines=50&level=ERROR", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res_err.status_code, 200)
        for line in res_err.json()["lines"]:
            self.assertIn("[ERROR]", line)

    def test_db_backup_download(self):
        """Test GET /api/v1/system/db/backup downloads valid ZIP."""
        res = self.client.get("/api/v1/system/db/backup", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/zip")
        # Verify valid ZIP content
        zf = zipfile.ZipFile(io.BytesIO(res.content))
        self.assertIn("pos_store.db", zf.namelist())

    def test_export_diagnostic_bundle(self):
        """Test GET /api/v1/system/export-bundle generates diagnostic bundle ZIP."""
        res = self.client.get("/api/v1/system/export-bundle", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/zip")
        zf = zipfile.ZipFile(io.BytesIO(res.content))
        namelist = zf.namelist()
        self.assertIn("diagnostics.json", namelist)
        self.assertIn("recent_pos_backend.log", namelist)
        self.assertIn("generated_at.txt", namelist)

    def test_remote_client_ip_restriction(self):
        """Test that requests from non-loopback IPs receive 403 Forbidden."""
        remote_client = TestClient(app)
        remote_client._transport.client = ("192.168.1.100", 54321)
        # 1. Diagnostics endpoint
        res = remote_client.get("/api/v1/system/diagnostics", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("detail", res.json())

        # 2. VACUUM endpoint
        res_vac = remote_client.post("/api/v1/system/db/vacuum", headers={"X-Admin-PIN": "1234"})
        self.assertEqual(res_vac.status_code, 403)

        # 3. Trigger backup endpoint
        res_bkp = remote_client.post("/api/v1/system/trigger-backup")
        self.assertEqual(res_bkp.status_code, 403)

        # 4. Restore endpoint
        res_rst = remote_client.post("/api/v1/system/restore", json={"filename": "fake.zip"})
        self.assertEqual(res_rst.status_code, 403)

        # 5. Shutdown endpoint
        res_shut = remote_client.post("/api/v1/system/shutdown")
        self.assertEqual(res_shut.status_code, 403)

    def test_remote_origin_restriction(self):
        """Test that requests with untrusted Origin header receive 403 Forbidden."""
        # 1. Untrusted web origin -> 403
        bad_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "https://malicious-website.com"
        }
        res = self.client.get("/api/v1/system/diagnostics", headers=bad_headers)
        self.assertEqual(res.status_code, 403)
        self.assertIn("externího webového původu", res.json().get("detail", ""))

        # 2. Untrusted LAN origin -> 403
        bad_lan_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "http://192.168.1.88:3000"
        }
        res_lan = self.client.post("/api/v1/system/db/vacuum", headers=bad_lan_headers)
        self.assertEqual(res_lan.status_code, 403)

        # 3. Allowed local origin (localhost:5173) -> 200
        good_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "http://localhost:5173"
        }
        res_ok = self.client.get("/api/v1/system/diagnostics", headers=good_headers)
        self.assertEqual(res_ok.status_code, 200)

        # 4. Allowed Tauri origin (tauri://localhost) -> 200
        tauri_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "tauri://localhost"
        }
        res_tauri = self.client.get("/api/v1/system/diagnostics", headers=tauri_headers)
        self.assertEqual(res_tauri.status_code, 200)

    def test_db_restore_simulated_corruption(self):
        """Test POST /api/v1/system/db/restore under simulated corruption scenarios."""
        # 1. Upload non-SQLite plain text file -> 400
        fake_txt = io.BytesIO(b"This is not a SQLite database file at all.")
        res_corrupt_file = self.client.post(
            "/api/v1/system/db/restore",
            files={"file": ("corrupt.db", fake_txt, "application/octet-stream")},
            headers={"X-Admin-PIN": "1234"}
        )
        self.assertEqual(res_corrupt_file.status_code, 400)
        self.assertIn("není platná SQLite", res_corrupt_file.json().get("detail", ""))

        # 2. Upload ZIP file missing pos_store.db -> 400
        bad_zip_buf = io.BytesIO()
        with zipfile.ZipFile(bad_zip_buf, "w") as zf:
            zf.writestr("random_file.txt", "hello world")
        bad_zip_buf.seek(0)

        res_bad_zip = self.client.post(
            "/api/v1/system/db/restore",
            files={"file": ("bad_archive.zip", bad_zip_buf, "application/zip")},
            headers={"X-Admin-PIN": "1234"}
        )
        self.assertEqual(res_bad_zip.status_code, 400)
        self.assertIn("pos_store.db", res_bad_zip.json().get("detail", ""))

        # 3. Upload file with valid SQLite header but corrupt internal pages -> 400
        # Header is 100 bytes of SQLite format, followed by random junk
        corrupt_pages = b"SQLite format 3\0" + (b"\x00" * 84) + (b"\xFF" * 1024)
        corrupt_pages_io = io.BytesIO(corrupt_pages)
        res_bad_pages = self.client.post(
            "/api/v1/system/db/restore",
            files={"file": ("corrupt_pages.db", corrupt_pages_io, "application/octet-stream")},
            headers={"X-Admin-PIN": "1234"}
        )
        self.assertEqual(res_bad_pages.status_code, 400)
        self.assertIn("poškozena", res_bad_pages.json().get("detail", ""))

    def test_db_restore_valid_database(self):
        """Test POST /api/v1/system/db/restore with a valid SQLite database snapshot."""
        # Backup the current active DB bytes so we don't clobber other test suites
        original_db_backup = None
        if os.path.exists(DB_PATH):
            with open(DB_PATH, "rb") as f:
                original_db_backup = f.read()

        # Create a temporary valid SQLite database
        temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
        os.close(temp_db_fd)
        try:
            conn = sqlite3.connect(temp_db_path)
            conn.execute("CREATE TABLE test_table (id INTEGER PRIMARY KEY, note TEXT);")
            conn.execute("INSERT INTO test_table (note) VALUES ('restore_verification_test');")
            conn.commit()
            conn.close()

            with open(temp_db_path, "rb") as f:
                valid_content = f.read()

            res = self.client.post(
                "/api/v1/system/db/restore",
                files={"file": ("valid_backup.db", io.BytesIO(valid_content), "application/octet-stream")},
                headers={"X-Admin-PIN": "1234"}
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "SUCCESS")
            self.assertIn("backup_filename", res.json())
        finally:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)
            if original_db_backup:
                engine.dispose()
                with open(DB_PATH, "wb") as f:
                    f.write(original_db_backup)
            Base.metadata.create_all(bind=engine)
            from migrations import run_schema_migrations
            run_schema_migrations(engine)


if __name__ == "__main__":
    unittest.main()
