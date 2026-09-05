import os
import sys
import shutil
import sqlite3
import zipfile
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# Ensure paths
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import Base, SessionLocal, engine, init_db_schema
from models import StoreConfigModel
from services.cloud_sync_service import CloudSyncService, get_cloud_sync_service
from services.backup_service import create_database_backup


class TestCloudSyncService(unittest.TestCase):
    def setUp(self):
        # Initialize schema and clean store_config for testing
        init_db_schema()
        self.db = SessionLocal()
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        if not config:
            config = StoreConfigModel(id=1)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)

        # Reset cloud config fields
        config.cloud_backup_enabled = False
        config.cloud_backup_endpoint = ""
        config.cloud_backup_bucket = "test-bucket"
        config.cloud_backup_access_key = ""
        config.cloud_backup_secret_key = ""
        config.cloud_backup_prefix = "pos_test"
        config.cloud_backup_retention_days = 30
        config.cloud_backup_last_sync = ""
        config.cloud_backup_last_status = ""
        config.cloud_backup_last_error = ""
        self.db.commit()

        self.service = CloudSyncService()

        # Temporary files directory for tests
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        self.db.close()
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_store_config_secret_encryption(self):
        """Test AES-256 encryption and decryption of cloud secret access key."""
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        plain_secret = "secret-token-xyz-12345"
        config.set_encrypted_cloud_secret(plain_secret)
        self.db.commit()
        self.db.refresh(config)

        # Cipher text should not equal plain text
        self.assertNotEqual(config.cloud_backup_secret_key, plain_secret)
        self.assertTrue(len(config.cloud_backup_secret_key) > 0)

        # Decrypted secret should match original
        decrypted = config.get_decrypted_cloud_secret()
        self.assertEqual(decrypted, plain_secret)

    def test_store_config_empty_secret(self):
        """Test graceful handling of empty or None secret key."""
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.set_encrypted_cloud_secret("")
        self.db.commit()
        self.assertEqual(config.get_decrypted_cloud_secret(), "")

    @patch("services.cloud_sync_service.boto3.client")
    def test_test_connection_success(self, mock_boto_client):
        """Test S3 connection validation succeeds."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.list_objects_v2.return_value = {"Contents": []}

        res = self.service.test_connection(
            endpoint="https://example.r2.cloudflarestorage.com",
            bucket="test-bucket",
            access_key="test-key",
            secret_key="test-secret"
        )
        self.assertEqual(res["status"], "SUCCESS")
        mock_s3.list_objects_v2.assert_called_once_with(Bucket="test-bucket", MaxKeys=1)

    def test_test_connection_missing_fields(self):
        """Test connection fails early when bucket or credentials are missing."""
        res1 = self.service.test_connection(
            endpoint="",
            bucket="",
            access_key="key",
            secret_key="secret"
        )
        self.assertEqual(res1["status"], "ERROR")

        res2 = self.service.test_connection(
            endpoint="",
            bucket="test-bucket",
            access_key="",
            secret_key=""
        )
        self.assertEqual(res2["status"], "ERROR")

    @patch("services.cloud_sync_service.boto3.client")
    def test_test_connection_error(self, mock_boto_client):
        """Test connection failure when S3 client raises error."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.list_objects_v2.side_effect = Exception("403 Forbidden AccessDenied")

        res = self.service.test_connection(
            endpoint="https://example.r2.cloudflarestorage.com",
            bucket="test-bucket",
            access_key="bad-key",
            secret_key="bad-secret"
        )
        self.assertEqual(res["status"], "ERROR")
        self.assertIn("AccessDenied", res["message"])

    @patch("services.cloud_sync_service.boto3.client")
    def test_upload_backup_file_success(self, mock_boto_client):
        """Test uploading a backup file updates StoreConfigModel status and calls S3 upload."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        # Configure StoreConfigModel
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_enabled = True
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        config.cloud_backup_prefix = "store_01"
        self.db.commit()

        # Create dummy local zip file
        dummy_zip = os.path.join(self.test_dir, "pos_backup_2026-09-05.zip")
        with open(dummy_zip, "wb") as f:
            f.write(b"dummy zip data")

        res = self.service.upload_backup_file(dummy_zip)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["filename"], "pos_backup_2026-09-05.zip")
        self.assertEqual(res["key"], "store_01/pos_backup_2026-09-05.zip")

        mock_s3.upload_file.assert_called_once_with(
            dummy_zip,
            "my-backup-bucket",
            "store_01/pos_backup_2026-09-05.zip"
        )

        # Verify DB status updated
        self.db.refresh(config)
        self.assertEqual(config.cloud_backup_last_status, "SUCCESS")
        self.assertEqual(config.cloud_backup_last_error, "")
        self.assertTrue(len(config.cloud_backup_last_sync) > 0)

    @patch("services.cloud_sync_service.boto3.client")
    def test_upload_backup_file_failure(self, mock_boto_client):
        """Test upload error sets last_status=ERROR in StoreConfigModel."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.upload_file.side_effect = Exception("S3 Connection Refused")

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_enabled = True
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        self.db.commit()

        dummy_zip = os.path.join(self.test_dir, "pos_backup_fail.zip")
        with open(dummy_zip, "wb") as f:
            f.write(b"dummy")

        res = self.service.upload_backup_file(dummy_zip)
        self.assertEqual(res["status"], "ERROR")
        self.assertIn("S3 Connection Refused", res["message"])

        self.db.refresh(config)
        self.assertEqual(config.cloud_backup_last_status, "ERROR")
        self.assertIn("S3 Connection Refused", config.cloud_backup_last_error)

    @patch("services.cloud_sync_service.boto3.client")
    def test_upload_backup_async(self, mock_boto_client):
        """Test asynchronous upload worker runs and terminates."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_enabled = True
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        self.db.commit()

        dummy_zip = os.path.join(self.test_dir, "pos_backup_async.zip")
        with open(dummy_zip, "wb") as f:
            f.write(b"async data")

        thread = self.service.upload_backup_async(dummy_zip)
        thread.join(timeout=3.0)
        self.assertFalse(thread.is_alive())
        mock_s3.upload_file.assert_called_once()

    @patch("services.cloud_sync_service.boto3.client")
    def test_list_remote_backups(self, mock_boto_client):
        """Test listing remote backup objects with sorting and extension filtering."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        config.cloud_backup_prefix = "store_01"
        self.db.commit()

        mock_paginator = MagicMock()
        mock_s3.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Contents": [
                    {
                        "Key": "store_01/pos_backup_old.zip",
                        "Size": 1024,
                        "LastModified": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
                    },
                    {
                        "Key": "store_01/pos_backup_new.zip",
                        "Size": 2048,
                        "LastModified": datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
                    },
                    {
                        "Key": "store_01/some_other_file.txt",
                        "Size": 500,
                        "LastModified": datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
                    }
                ]
            }
        ]

        items = self.service.list_remote_backups()
        self.assertEqual(len(items), 2)
        # Verify sorted descending (newest first)
        self.assertEqual(items[0]["filename"], "pos_backup_new.zip")
        self.assertEqual(items[1]["filename"], "pos_backup_old.zip")
        self.assertEqual(items[0]["size_bytes"], 2048)

    @patch("services.cloud_sync_service.boto3.client")
    def test_prune_remote_backups(self, mock_boto_client):
        """Test remote pruning removes objects older than retention days."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        config.cloud_backup_prefix = "store_01"
        self.db.commit()

        old_date = datetime.now(timezone.utc) - timedelta(days=45)
        recent_date = datetime.now(timezone.utc) - timedelta(days=5)

        mock_paginator = MagicMock()
        mock_s3.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Contents": [
                    {"Key": "store_01/pos_backup_old.zip", "LastModified": old_date},
                    {"Key": "store_01/pos_backup_recent.zip", "LastModified": recent_date},
                ]
            }
        ]

        deleted_count = self.service.prune_remote_backups(retention_days=30)
        self.assertEqual(deleted_count, 1)
        mock_s3.delete_objects.assert_called_once_with(
            Bucket="my-backup-bucket",
            Delete={"Objects": [{"Key": "store_01/pos_backup_old.zip"}]}
        )

    @patch("services.cloud_sync_service.boto3.client")
    def test_download_and_restore_success(self, mock_boto_client):
        """Test downloading remote ZIP, validating integrity, and restoring SQLite DB."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        config.cloud_backup_prefix = "store_01"
        self.db.commit()

        # Create a valid SQLite DB and zip it
        valid_db_path = os.path.join(self.test_dir, "mock_store.db")
        conn = sqlite3.connect(valid_db_path)
        conn.execute("CREATE TABLE test_table (id INT, val TEXT);")
        conn.execute("INSERT INTO test_table VALUES (1, 'cloud_restored_data');")
        conn.commit()
        conn.close()

        valid_zip_path = os.path.join(self.test_dir, "pos_backup_mock.zip")
        with zipfile.ZipFile(valid_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(valid_db_path, arcname="pos_store.db")

        # Mock download_file to copy our valid zip to destination
        def mock_download(bucket, key, target_path):
            shutil.copy2(valid_zip_path, target_path)

        mock_s3.download_file.side_effect = mock_download

        res = self.service.download_and_restore("pos_backup_mock.zip")
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["restored_from"], "pos_backup_mock.zip")

    @patch("services.cloud_sync_service.boto3.client")
    def test_download_and_restore_corrupt_zip(self, mock_boto_client):
        """Test restore fails safely when downloaded file is corrupt."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        self.db.commit()

        corrupt_file = os.path.join(self.test_dir, "corrupt.zip")
        with open(corrupt_file, "wb") as f:
            f.write(b"not a real zip file header")

        def mock_download(bucket, key, target_path):
            shutil.copy2(corrupt_file, target_path)

        mock_s3.download_file.side_effect = mock_download

        res = self.service.download_and_restore("corrupt.zip")
        self.assertEqual(res["status"], "ERROR")

    @patch("services.cloud_sync_service.CloudSyncService.upload_backup_async")
    def test_backup_service_cloud_trigger(self, mock_upload_async):
        """Test create_database_backup dispatches async upload when enabled and upload_to_cloud=True."""
        config = self.db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
        config.cloud_backup_enabled = True
        config.cloud_backup_bucket = "my-backup-bucket"
        config.cloud_backup_access_key = "my-access-key"
        config.set_encrypted_cloud_secret("my-secret-key")
        self.db.commit()

        # Run backup with cloud upload enabled
        res = create_database_backup(upload_to_cloud=True)
        self.assertEqual(res["status"], "SUCCESS")
        mock_upload_async.assert_called_once()

        mock_upload_async.reset_mock()

        # Run backup with upload_to_cloud=False
        res_no_cloud = create_database_backup(upload_to_cloud=False)
        self.assertEqual(res_no_cloud["status"], "SUCCESS")
        mock_upload_async.assert_not_called()


if __name__ == "__main__":
    unittest.main()
