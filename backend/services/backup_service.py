import os
import glob
import sqlite3
import zipfile
import logging
from datetime import datetime, timedelta
import shutil
from database import DB_PATH, BASE_DIR
from paths import DATA_DIR

logger = logging.getLogger("pos-backup-service")
BACKUPS_DIR = os.getenv("POS_BACKUPS_DIR") or os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)

# Auto-migrate legacy backups if stored in BASE_DIR
legacy_backups_dir = os.path.join(BASE_DIR, "backups")
if os.path.exists(legacy_backups_dir) and os.path.abspath(legacy_backups_dir) != os.path.abspath(BACKUPS_DIR):
    for legacy_f in glob.glob(os.path.join(legacy_backups_dir, "pos_backup_*.zip")):
        try:
            dest_f = os.path.join(BACKUPS_DIR, os.path.basename(legacy_f))
            if not os.path.exists(dest_f):
                shutil.move(legacy_f, dest_f)
                logger.info(f"Migrated legacy backup archive: {os.path.basename(legacy_f)}")
        except Exception:
            pass


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


def list_backups() -> list:
    """Returns sorted list of available database backup ZIP files."""
    pattern = os.path.join(BACKUPS_DIR, "pos_backup_*.zip")
    files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    results = []
    for f in files:
        results.append({
            "filename": os.path.basename(f),
            "size_bytes": os.path.getsize(f),
            "timestamp": datetime.fromtimestamp(os.path.getmtime(f)).isoformat()
        })
    return results


def restore_database_from_backup(zip_filename: str) -> dict:
    """
    Restores database from a selected ZIP backup file.
    1. Validates the target backup ZIP.
    2. Extracts pos_store.db to temporary location and tests SQLite integrity.
    3. Takes safety snapshot of active DB.
    4. Replaces active DB and cleans up WAL/SHM.
    """
    safe_filename = os.path.basename(zip_filename)
    zip_path = os.path.join(BACKUPS_DIR, safe_filename)
    if not os.path.exists(zip_path) or not zipfile.is_zipfile(zip_path):
        return {"status": "ERROR", "message": f"Záložní soubor {safe_filename} nebyl nalezen nebo je poškozen."}

    temp_restore_db = os.path.join(BACKUPS_DIR, "temp_restore_check.db")
    pre_restore_backup = None

    try:
        # 1. Extract and verify integrity
        with zipfile.ZipFile(zip_path, "r") as zipf:
            target_entry = None
            for name in zipf.namelist():
                if name.endswith(".db"):
                    target_entry = name
                    break
            if not target_entry:
                return {"status": "ERROR", "message": "Záložní archiv neobsahuje platný databázový soubor .db"}
            with open(temp_restore_db, "wb") as f_out:
                f_out.write(zipf.read(target_entry))

        # Quick integrity test on extracted DB
        test_conn = sqlite3.connect(temp_restore_db)
        cursor = test_conn.cursor()
        cursor.execute("PRAGMA quick_check")
        res = cursor.fetchone()
        test_conn.close()
        if not res or res[0] != "ok":
            if os.path.exists(temp_restore_db):
                os.remove(temp_restore_db)
            return {"status": "ERROR", "message": "Extrahovaná záloha neprošla kontrolou integrity SQLite."}

        # 2. Take immediate safety backup of current active DB
        if os.path.exists(DB_PATH):
            pre_restore_backup = create_database_backup()

        # 3. Close open connections and replace DB
        from database import engine
        engine.dispose()

        import shutil
        shutil.copy2(temp_restore_db, DB_PATH)
        os.remove(temp_restore_db)

        # Remove old WAL/SHM so restored DB starts clean
        for ext in ["-wal", "-shm"]:
            p = DB_PATH + ext
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

        logger.info(f"Database successfully restored from {safe_filename}")
        return {
            "status": "SUCCESS",
            "restored_from": safe_filename,
            "safety_backup": pre_restore_backup.get("filename") if pre_restore_backup else None,
            "message": f"Databáze byla úspěšně obnovena ze zálohy {safe_filename}."
        }

    except Exception as e:
        logger.error(f"Failed to restore database from {safe_filename}: {e}")
        if os.path.exists(temp_restore_db):
            try:
                os.remove(temp_restore_db)
            except Exception:
                pass
        return {"status": "ERROR", "message": f"Chyba při obnově databáze: {str(e)}"}
