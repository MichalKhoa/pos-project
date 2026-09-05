import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal, DB_PATH, init_db_schema
from models import StoreConfigModel


class TestCloudBackupAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        init_db_schema()
        self.db = SessionLocal()
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        if not config:
            config = StoreConfigModel(id=1)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)

        # Reset configuration to predictable baseline
        config.admin_pin = "1234"
        config.cloud_backup_enabled = False
        config.cloud_backup_endpoint = "https://example.r2.cloudflarestorage.com"
        config.cloud_backup_bucket = "pos-backups"
        config.cloud_backup_access_key = "test_access_key"
        config.set_encrypted_cloud_secret("test_secret_key")
        config.cloud_backup_prefix = "store_test"
        config.cloud_backup_retention_days = 30
        config.cloud_backup_last_sync = "2026-09-05T12:00:00"
        config.cloud_backup_last_status = "SUCCESS"
        config.cloud_backup_last_error = ""
        self.db.commit()

        self.auth_headers = {"X-Admin-PIN": "1234"}

    def tearDown(self):
        self.db.close()

    def test_loopback_restriction(self):
        """Test that requests from non-loopback IP receive 403 Forbidden across all cloud endpoints."""
        remote_client = TestClient(app)
        remote_client._transport.client = ("192.168.1.100", 54321)

        endpoints = [
            ("GET", "/api/v1/system/cloud-backup/status", None),
            ("POST", "/api/v1/system/cloud-backup/test", {}),
            ("POST", "/api/v1/system/cloud-backup/configure", {}),
            ("POST", "/api/v1/system/cloud-backup/upload-now", None),
            ("GET", "/api/v1/system/cloud-backup/backups", None),
            ("POST", "/api/v1/system/cloud-backup/restore", {"filename": "test.zip"}),
        ]

        for method, url, payload in endpoints:
            if method == "GET":
                res = remote_client.get(url, headers=self.auth_headers)
            else:
                res = remote_client.post(url, json=payload, headers=self.auth_headers)
            self.assertEqual(res.status_code, 403, f"{method} {url} allowed non-loopback access")
            self.assertIn("lokální pokladny", res.json().get("detail", ""))

    def test_origin_restriction(self):
        """Test that untrusted Origin header is rejected with 403 Forbidden."""
        bad_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "https://malicious-site.com"
        }
        res = self.client.get("/api/v1/system/cloud-backup/status", headers=bad_headers)
        self.assertEqual(res.status_code, 403)
        self.assertIn("externího webového původu", res.json().get("detail", ""))

        good_headers = {
            "X-Admin-PIN": "1234",
            "Origin": "http://localhost:5173"
        }
        res_ok = self.client.get("/api/v1/system/cloud-backup/status", headers=good_headers)
        self.assertEqual(res_ok.status_code, 200)

    def test_technician_auth_required(self):
        """Test that missing or invalid technician PIN yields 401 Unauthorized."""
        # 1. Missing auth
        res_no_auth = self.client.get("/api/v1/system/cloud-backup/status")
        self.assertEqual(res_no_auth.status_code, 401)

        # 2. Wrong PIN
        res_bad_pin = self.client.get(
            "/api/v1/system/cloud-backup/status",
            headers={"X-Admin-PIN": "9999"}
        )
        self.assertEqual(res_bad_pin.status_code, 401)

        # 3. Master Recovery Key succeeds
        res_master = self.client.get(
            "/api/v1/system/cloud-backup/status",
            headers={"X-Admin-PIN": "VOLTFLOW-ADMIN-MASTER-RECOVERY"}
        )
        self.assertEqual(res_master.status_code, 200)

    def test_get_cloud_backup_status(self):
        """Test GET /api/v1/system/cloud-backup/status returns config and masks secret key."""
        res = self.client.get("/api/v1/system/cloud-backup/status", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["status"], "SUCCESS")
        self.assertFalse(data["enabled"])
        self.assertEqual(data["endpoint"], "https://example.r2.cloudflarestorage.com")
        self.assertEqual(data["bucket"], "pos-backups")
        self.assertEqual(data["access_key"], "test_access_key")
        self.assertTrue(data["has_secret_key"])
        self.assertNotIn("secret_key", data)  # Ensure plaintext secret is not leaked
        self.assertEqual(data["prefix"], "store_test")
        self.assertEqual(data["retention_days"], 30)
        self.assertEqual(data["last_sync"], "2026-09-05T12:00:00")
        self.assertEqual(data["last_status"], "SUCCESS")

    def test_configure_cloud_backup(self):
        """Test POST /api/v1/system/cloud-backup/configure saves and encrypts secret at rest."""
        new_config = {
            "enabled": True,
            "endpoint": "https://new-account.r2.cloudflarestorage.com",
            "bucket": "new-bucket-name",
            "access_key": "new_access_key",
            "secret_key": "super_secret_token_123",
            "prefix": "branch_02",
            "retention_days": 45
        }

        res = self.client.post(
            "/api/v1/system/cloud-backup/configure",
            json=new_config,
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertTrue(data["config"]["enabled"])
        self.assertTrue(data["config"]["has_secret_key"])

        # Verify database model directly
        cfg = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        self.assertTrue(cfg.cloud_backup_enabled)
        self.assertEqual(cfg.cloud_backup_endpoint, "https://new-account.r2.cloudflarestorage.com")
        self.assertEqual(cfg.cloud_backup_bucket, "new-bucket-name")
        self.assertEqual(cfg.cloud_backup_access_key, "new_access_key")
        self.assertEqual(cfg.cloud_backup_prefix, "branch_02")
        self.assertEqual(cfg.cloud_backup_retention_days, 45)

        # Cipher text must not match plaintext
        self.assertNotEqual(cfg.cloud_backup_secret_key, "super_secret_token_123")
        # Decrypted secret must match plaintext
        self.assertEqual(cfg.get_decrypted_cloud_secret(), "super_secret_token_123")

    @patch("services.cloud_sync_service.boto3.client")
    def test_test_connection_success(self, mock_boto_client):
        """Test POST /api/v1/system/cloud-backup/test connectivity success."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.list_objects_v2.return_value = {"Contents": []}

        res = self.client.post(
            "/api/v1/system/cloud-backup/test",
            json={
                "endpoint": "https://test.r2.cloudflarestorage.com",
                "bucket": "pos-backups",
                "access_key": "acc_key",
                "secret_key": "sec_key"
            },
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("úspěšně", data["message"])

    @patch("services.cloud_sync_service.boto3.client")
    def test_test_connection_fallback_to_stored(self, mock_boto_client):
        """Test POST /api/v1/system/cloud-backup/test falls back to stored credentials if empty."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.list_objects_v2.return_value = {"Contents": []}

        res = self.client.post(
            "/api/v1/system/cloud-backup/test",
            json={},  # Empty payload triggers stored credentials fallback
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        mock_s3.list_objects_v2.assert_called_once_with(Bucket="pos-backups", MaxKeys=1)

    @patch("services.cloud_sync_service.boto3.client")
    def test_test_connection_failure(self, mock_boto_client):
        """Test POST /api/v1/system/cloud-backup/test connectivity error handling."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.list_objects_v2.side_effect = Exception("Bucket does not exist")

        res = self.client.post(
            "/api/v1/system/cloud-backup/test",
            json={
                "endpoint": "https://test.r2.cloudflarestorage.com",
                "bucket": "non-existent-bucket",
                "access_key": "acc_key",
                "secret_key": "sec_key"
            },
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ERROR")
        self.assertIn("selhal", data["message"])

    def test_upload_now_when_disabled(self):
        """Test POST /api/v1/system/cloud-backup/upload-now returns 400 when sync disabled."""
        cfg = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        cfg.cloud_backup_enabled = False
        self.db.commit()

        res = self.client.post("/api/v1/system/cloud-backup/upload-now", headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("není povoleno", res.json().get("detail", ""))

    @patch("services.cloud_sync_service.boto3.client")
    def test_upload_now_success(self, mock_boto_client):
        """Test POST /api/v1/system/cloud-backup/upload-now performs backup snapshot and uploads."""
        cfg = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        cfg.cloud_backup_enabled = True
        self.db.commit()

        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        res = self.client.post("/api/v1/system/cloud-backup/upload-now", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("pos_backup_", data["filename"])
        self.assertTrue(data["key"].startswith("store_test/pos_backup_"))
        mock_s3.upload_file.assert_called_once()

    def test_get_remote_backups_disabled(self):
        """Test GET /api/v1/system/cloud-backup/backups returns empty list when disabled."""
        cfg = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        cfg.cloud_backup_enabled = False
        self.db.commit()

        res = self.client.get("/api/v1/system/cloud-backup/backups", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    @patch("services.cloud_sync_service.boto3.client")
    def test_get_remote_backups_success(self, mock_boto_client):
        """Test GET /api/v1/system/cloud-backup/backups lists remote archive objects."""
        cfg = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        cfg.cloud_backup_enabled = True
        self.db.commit()

        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_paginator = MagicMock()
        mock_s3.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Contents": [
                    {
                        "Key": "store_test/pos_backup_2026-09-05_120000.zip",
                        "Size": 102400,
                        "LastModified": MagicMock(isoformat=lambda: "2026-09-05T12:00:00+00:00")
                    },
                    {
                        "Key": "store_test/pos_backup_2026-09-04_120000.zip",
                        "Size": 98000,
                        "LastModified": MagicMock(isoformat=lambda: "2026-09-04T12:00:00+00:00")
                    }
                ]
            }
        ]

        res = self.client.get("/api/v1/system/cloud-backup/backups", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["filename"], "pos_backup_2026-09-05_120000.zip")
        self.assertEqual(data[0]["size_bytes"], 102400)

    def test_restore_empty_filename(self):
        """Test POST /api/v1/system/cloud-backup/restore requires non-empty filename."""
        res = self.client.post(
            "/api/v1/system/cloud-backup/restore",
            json={"filename": "   "},
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("nesmí být prázdný", res.json().get("detail", ""))

    @patch("services.cloud_sync_service.CloudSyncService.download_and_restore")
    def test_restore_success(self, mock_download_and_restore):
        """Test POST /api/v1/system/cloud-backup/restore delegates to CloudSyncService."""
        mock_download_and_restore.return_value = {
            "status": "SUCCESS",
            "restored_from": "pos_backup_2026-09-05_100000.zip",
            "safety_backup": "pos_backup_safety_2026-09-05_110000.zip",
            "message": "Databáze byla úspěšně obnovena."
        }

        res = self.client.post(
            "/api/v1/system/cloud-backup/restore",
            json={"filename": "pos_backup_2026-09-05_100000.zip"},
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["restored_from"], "pos_backup_2026-09-05_100000.zip")
        self.assertEqual(data["safety_backup"], "pos_backup_safety_2026-09-05_110000.zip")
        mock_download_and_restore.assert_called_once_with("pos_backup_2026-09-05_100000.zip")

    @patch("services.cloud_sync_service.CloudSyncService.download_and_restore")
    def test_restore_failure(self, mock_download_and_restore):
        """Test POST /api/v1/system/cloud-backup/restore returns 400 when restore fails."""
        mock_download_and_restore.return_value = {
            "status": "ERROR",
            "message": "Extrahovaná cloudová záloha neprošla kontrolou SQLite quick_check."
        }

        res = self.client.post(
            "/api/v1/system/cloud-backup/restore",
            json={"filename": "corrupt_backup.zip"},
            headers=self.auth_headers
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("quick_check", res.json().get("detail", ""))


if __name__ == "__main__":
    unittest.main()
