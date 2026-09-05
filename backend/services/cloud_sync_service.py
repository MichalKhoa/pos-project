import os
import shutil
import sqlite3
import zipfile
import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, BotoCoreError

from database import SessionLocal, DB_PATH, engine, init_db_schema
from paths import DATA_DIR
from models import StoreConfigModel

logger = logging.getLogger("pos-cloud-sync")

BACKUPS_DIR = os.getenv("POS_BACKUPS_DIR") or os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)


class CloudSyncService:
    """
    Pure Python AWS S3 / Cloudflare R2 / MinIO cloud synchronization service.
    Handles backup uploads, remote listing, remote pruning, and safe restores.
    """

    def _build_s3_client(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        region_name: str = "auto"
    ) -> Any:
        """Constructs a configured boto3 S3 client supporting custom S3-compatible endpoints."""
        endpoint_clean = (endpoint or "").strip()
        if endpoint_clean and not endpoint_clean.startswith(("http://", "https://")):
            endpoint_clean = f"https://{endpoint_clean}"

        return boto3.client(
            "s3",
            endpoint_url=endpoint_clean if endpoint_clean else None,
            aws_access_key_id=(access_key or "").strip(),
            aws_secret_access_key=(secret_key or "").strip(),
            region_name=region_name or "auto",
            config=Config(signature_version="s3v4")
        )

    def get_config(self) -> Dict[str, Any]:
        """Retrieves cloud sync configuration from StoreConfigModel."""
        db = SessionLocal()
        try:
            config = db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
            if not config:
                return {
                    "enabled": False,
                    "endpoint": "",
                    "bucket": "himmel-pos-backups",
                    "access_key": "",
                    "secret_key": "",
                    "prefix": "store_01",
                    "retention_days": 30,
                    "last_sync": "",
                    "last_status": "",
                    "last_error": ""
                }
            return {
                "enabled": bool(config.cloud_backup_enabled),
                "endpoint": config.cloud_backup_endpoint or "",
                "bucket": config.cloud_backup_bucket or "himmel-pos-backups",
                "access_key": config.cloud_backup_access_key or "",
                "secret_key": config.get_decrypted_cloud_secret(),
                "prefix": (config.cloud_backup_prefix or "store_01").strip().strip("/"),
                "retention_days": config.cloud_backup_retention_days or 30,
                "last_sync": config.cloud_backup_last_sync or "",
                "last_status": config.cloud_backup_last_status or "",
                "last_error": config.cloud_backup_last_error or ""
            }
        finally:
            db.close()

    def is_enabled(self) -> bool:
        """Returns True if cloud backup is enabled with non-empty credentials."""
        cfg = self.get_config()
        return bool(cfg["enabled"] and cfg["bucket"] and cfg["access_key"] and cfg["secret_key"])

    def test_connection(
        self,
        endpoint: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        region_name: str = "auto"
    ) -> Dict[str, Any]:
        """Validates S3 connectivity and bucket access."""
        bucket_clean = (bucket or "").strip()
        if not bucket_clean:
            return {"status": "ERROR", "message": "Název bucketu nesmí být prázdný."}
        if not access_key or not secret_key:
            return {"status": "ERROR", "message": "Přístupové klíče (Access Key & Secret Key) nesmí být prázdné."}

        try:
            client = self._build_s3_client(endpoint, access_key, secret_key, region_name)
            # Check bucket access by listing up to 1 key
            client.list_objects_v2(Bucket=bucket_clean, MaxKeys=1)
            return {
                "status": "SUCCESS",
                "message": f"Připojení k S3 bucketu '{bucket_clean}' proběhlo úspěšně."
            }
        except (ClientError, BotoCoreError, Exception) as e:
            logger.warning(f"S3 connection test failed: {e}")
            return {
                "status": "ERROR",
                "message": f"Test připojení selhal: {str(e)}"
            }

    def upload_backup_file(self, local_zip_path: str) -> Dict[str, Any]:
        """
        Uploads local backup ZIP to configured cloud bucket.
        Updates StoreConfigModel sync metrics and prunes expired remote backups.
        """
        if not os.path.exists(local_zip_path):
            return {"status": "ERROR", "message": f"Soubor {local_zip_path} neexistuje."}

        cfg = self.get_config()
        if not cfg["bucket"] or not cfg["access_key"] or not cfg["secret_key"]:
            err_msg = "Cloudové zálohování není správně nakonfigurováno (chybí přístupové údaje)."
            self._update_status(status="ERROR", error=err_msg)
            return {"status": "ERROR", "message": err_msg}

        filename = os.path.basename(local_zip_path)
        prefix = cfg["prefix"]
        s3_key = f"{prefix}/{filename}" if prefix else filename

        try:
            client = self._build_s3_client(
                cfg["endpoint"],
                cfg["access_key"],
                cfg["secret_key"]
            )

            file_size = os.path.getsize(local_zip_path)
            logger.info(f"Uploading backup to s3://{cfg['bucket']}/{s3_key} ({file_size} bytes)...")
            client.upload_file(local_zip_path, cfg["bucket"], s3_key)

            sync_time = datetime.now().isoformat()
            self._update_status(status="SUCCESS", error="", sync_time=sync_time)
            logger.info(f"Backup uploaded successfully to s3://{cfg['bucket']}/{s3_key}")

            # Prune old remote backups asynchronously or inline
            pruned_count = 0
            try:
                pruned_count = self.prune_remote_backups(retention_days=cfg["retention_days"])
            except Exception as pe:
                logger.warning(f"Non-fatal error pruning remote backups: {pe}")

            return {
                "status": "SUCCESS",
                "filename": filename,
                "key": s3_key,
                "bucket": cfg["bucket"],
                "size_bytes": file_size,
                "timestamp": sync_time,
                "pruned_remote": pruned_count
            }

        except Exception as e:
            err_msg = str(e)
            logger.error(f"Failed to upload backup {filename} to cloud: {err_msg}")
            self._update_status(status="ERROR", error=err_msg)
            return {"status": "ERROR", "message": err_msg}

    def upload_backup_async(self, local_zip_path: str):
        """Asynchronously triggers upload_backup_file in a background daemon thread."""
        thread = threading.Thread(
            target=self.upload_backup_file,
            args=(local_zip_path,),
            daemon=True,
            name="CloudBackupUploadWorker"
        )
        thread.start()
        return thread

    def list_remote_backups(self) -> List[Dict[str, Any]]:
        """Lists available backup archives from the configured remote bucket."""
        cfg = self.get_config()
        if not cfg["bucket"] or not cfg["access_key"] or not cfg["secret_key"]:
            return []

        try:
            client = self._build_s3_client(
                cfg["endpoint"],
                cfg["access_key"],
                cfg["secret_key"]
            )

            prefix = cfg["prefix"]
            prefix_arg = f"{prefix}/" if prefix else ""

            paginator = client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=cfg["bucket"], Prefix=prefix_arg)

            results = []
            for page in pages:
                for obj in page.get("Contents", []):
                    key = obj.get("Key", "")
                    if not key.endswith(".zip"):
                        continue
                    last_mod = obj.get("LastModified")
                    results.append({
                        "filename": os.path.basename(key),
                        "key": key,
                        "size_bytes": obj.get("Size", 0),
                        "last_modified": last_mod.isoformat() if last_mod else None
                    })

            # Sort descending by last_modified
            results.sort(key=lambda x: x["last_modified"] or "", reverse=True)
            return results

        except Exception as e:
            logger.error(f"Failed to list remote backups: {e}")
            return []

    def prune_remote_backups(self, retention_days: int = 30) -> int:
        """Deletes remote backup ZIPs older than retention_days."""
        if retention_days <= 0:
            return 0

        cfg = self.get_config()
        if not cfg["bucket"] or not cfg["access_key"] or not cfg["secret_key"]:
            return 0

        try:
            client = self._build_s3_client(
                cfg["endpoint"],
                cfg["access_key"],
                cfg["secret_key"]
            )

            cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
            prefix = cfg["prefix"]
            prefix_arg = f"{prefix}/" if prefix else ""

            paginator = client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=cfg["bucket"], Prefix=prefix_arg)

            keys_to_delete = []
            for page in pages:
                for obj in page.get("Contents", []):
                    key = obj.get("Key", "")
                    if not key.endswith(".zip"):
                        continue
                    last_mod = obj.get("LastModified")
                    if last_mod and last_mod < cutoff:
                        keys_to_delete.append(key)

            if not keys_to_delete:
                return 0

            # Delete in batches of 1000 (S3 limit)
            deleted_count = 0
            for i in range(0, len(keys_to_delete), 1000):
                batch = keys_to_delete[i:i + 1000]
                client.delete_objects(
                    Bucket=cfg["bucket"],
                    Delete={"Objects": [{"Key": k} for k in batch]}
                )
                deleted_count += len(batch)
                logger.info(f"Pruned {len(batch)} expired remote backups from s3://{cfg['bucket']}")

            return deleted_count

        except Exception as e:
            logger.warning(f"Failed to prune remote backups: {e}")
            return 0

    def download_and_restore(self, remote_filename_or_key: str) -> Dict[str, Any]:
        """
        Downloads a remote backup ZIP, performs SQLite quick_check integrity check,
        takes a pre-restore local safety snapshot, disposes database engine,
        swaps pos_store.db, and runs init_db_schema.
        """
        from services.backup_service import create_database_backup

        cfg = self.get_config()
        if not cfg["bucket"] or not cfg["access_key"] or not cfg["secret_key"]:
            return {"status": "ERROR", "message": "Chybí konfigurace cloudového úložiště."}

        # Resolve remote key
        prefix = cfg["prefix"]
        if "/" in remote_filename_or_key:
            s3_key = remote_filename_or_key
        else:
            s3_key = f"{prefix}/{remote_filename_or_key}" if prefix else remote_filename_or_key

        safe_filename = os.path.basename(s3_key)
        temp_download_zip = os.path.join(BACKUPS_DIR, f"cloud_download_{safe_filename}")
        temp_extracted_db = os.path.join(BACKUPS_DIR, f"temp_cloud_restore_check.db")
        safety_backup = None

        try:
            client = self._build_s3_client(
                cfg["endpoint"],
                cfg["access_key"],
                cfg["secret_key"]
            )

            # 1. Download file from S3
            logger.info(f"Downloading s3://{cfg['bucket']}/{s3_key} to {temp_download_zip}...")
            client.download_file(cfg["bucket"], s3_key, temp_download_zip)

            if not os.path.exists(temp_download_zip) or not zipfile.is_zipfile(temp_download_zip):
                return {"status": "ERROR", "message": "Stažený soubor není platným archivem ZIP."}

            # 2. Extract pos_store.db and verify integrity
            with zipfile.ZipFile(temp_download_zip, "r") as zipf:
                target_entry = None
                for name in zipf.namelist():
                    if name.endswith(".db"):
                        target_entry = name
                        break
                if not target_entry:
                    return {"status": "ERROR", "message": "Archiv neobsahuje platný databázový soubor .db"}
                with open(temp_extracted_db, "wb") as f_out:
                    f_out.write(zipf.read(target_entry))

            test_conn = sqlite3.connect(temp_extracted_db)
            cursor = test_conn.cursor()
            cursor.execute("PRAGMA quick_check")
            check_res = cursor.fetchone()
            test_conn.close()

            if not check_res or check_res[0] != "ok":
                return {"status": "ERROR", "message": "Extrahovaná cloudová záloha neprošla kontrolou SQLite quick_check."}

            # 3. Take pre-restore safety snapshot of active local DB (do not upload to cloud)
            if os.path.exists(DB_PATH):
                safety_res = create_database_backup(upload_to_cloud=False)
                if safety_res.get("status") == "SUCCESS":
                    safety_backup = safety_res.get("filename")

            # 4. Dispose DB connections and replace DB file
            engine.dispose()
            shutil.copy2(temp_extracted_db, DB_PATH)

            # Clean up old WAL and SHM
            for ext in ["-wal", "-shm"]:
                wal_file = DB_PATH + ext
                if os.path.exists(wal_file):
                    try:
                        os.remove(wal_file)
                    except Exception:
                        pass

            # 5. Re-run schema migrations to ensure all current columns exist
            init_db_schema()

            logger.info(f"Successfully restored database from cloud backup {safe_filename}")
            return {
                "status": "SUCCESS",
                "restored_from": safe_filename,
                "safety_backup": safety_backup,
                "message": f"Databáze byla úspěšně obnovena z cloudové zálohy {safe_filename}."
            }

        except Exception as e:
            logger.error(f"Failed to restore from cloud backup {s3_key}: {e}")
            return {"status": "ERROR", "message": f"Chyba při obnově z cloudu: {str(e)}"}

        finally:
            for p in [temp_download_zip, temp_extracted_db]:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    def _update_status(self, status: str, error: str = "", sync_time: Optional[str] = None):
        """Updates cloud backup status columns in StoreConfigModel."""
        db = SessionLocal()
        try:
            config = db.query(StoreConfigModel).filter(StoreConfigModel.id == 1).first()
            if config:
                config.cloud_backup_last_status = status
                config.cloud_backup_last_error = error or ""
                if sync_time:
                    config.cloud_backup_last_sync = sync_time
                db.commit()
        except Exception as e:
            logger.warning(f"Failed to update StoreConfig cloud status: {e}")
            db.rollback()
        finally:
            db.close()


# Singleton accessor
_cloud_sync_service_instance: Optional[CloudSyncService] = None


def get_cloud_sync_service() -> CloudSyncService:
    """Returns singleton instance of CloudSyncService."""
    global _cloud_sync_service_instance
    if _cloud_sync_service_instance is None:
        _cloud_sync_service_instance = CloudSyncService()
    return _cloud_sync_service_instance
