import os
import glob
import sqlite3
import zipfile
import logging
from datetime import datetime, timedelta
from database import DB_PATH, BASE_DIR

logger = logging.getLogger("pos-backup-service")
BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)


def create_database_backup() -> dict:
    """
    Takes a live online SQLite backup using sqlite3.Connection.backup() API
    and compresses it into a timestamped ZIP archive inside backend/backups/.
    Auto-purges local backups older than 30 days.
    """
    if not os.path.exists(DB_PATH):
        return {"status": "ERROR", "message": f"Database file not found at {DB_PATH}"}

    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    temp_db_path = os.path.join(BACKUPS_DIR, f"temp_{timestamp_str}.db")
    zip_filename = f"pos_backup_{timestamp_str}.zip"
    zip_file_path = os.path.join(BACKUPS_DIR, zip_filename)

    try:
        # 1. Perform online SQLite backup without blocking WAL readers/writers
        src_conn = sqlite3.connect(DB_PATH)
        dest_conn = sqlite3.connect(temp_db_path)
        with dest_conn:
            src_conn.backup(dest_conn)
        dest_conn.close()
        src_conn.close()

        # 2. Compress backup database file to ZIP
        with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(temp_db_path, arcname="pos_store.db")

        # Clean up temporary uncompressed db file
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

        zip_size = os.path.getsize(zip_file_path)
        logger.info(f"Database backup created successfully: {zip_filename} ({zip_size} bytes)")

        # 3. Auto-purge backups older than 30 days
        purge_old_backups(max_days=30)

        return {
            "status": "SUCCESS",
            "filename": zip_filename,
            "path": zip_file_path,
            "size_bytes": zip_size,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except Exception:
                pass
        return {"status": "ERROR", "message": str(e)}


def purge_old_backups(max_days: int = 30):
    """Deletes local ZIP backup files older than max_days."""
    cutoff_date = datetime.now() - timedelta(days=max_days)
    pattern = os.path.join(BACKUPS_DIR, "pos_backup_*.zip")
    for file_path in glob.glob(pattern):
        try:
            file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
            if file_mtime < cutoff_date:
                os.remove(file_path)
                logger.info(f"Purged expired backup: {os.path.basename(file_path)}")
        except Exception as e:
            logger.warning(f"Error purging backup {file_path}: {e}")


def get_backup_status() -> dict:
    """Returns status metrics of local backups, DB file size, and WAL size."""
    db_exists = os.path.exists(DB_PATH)
    wal_path = DB_PATH + "-wal"
    wal_exists = os.path.exists(wal_path)

    db_size = os.path.getsize(DB_PATH) if db_exists else 0
    wal_size = os.path.getsize(wal_path) if wal_exists else 0

    backup_files = sorted(glob.glob(os.path.join(BACKUPS_DIR, "pos_backup_*.zip")), key=os.path.getmtime, reverse=True)
    last_backup_time = None
    last_backup_file = None

    if backup_files:
        last_backup_file = os.path.basename(backup_files[0])
        last_backup_time = datetime.fromtimestamp(os.path.getmtime(backup_files[0])).isoformat()

    return {
        "status": "SUCCESS",
        "db_size_bytes": db_size,
        "wal_size_bytes": wal_size,
        "backup_count": len(backup_files),
        "last_backup_filename": last_backup_file,
        "last_backup_timestamp": last_backup_time
    }
