import os
import shutil
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("pos-database")

# Ensure protected data directory exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
try:
    os.chmod(DATA_DIR, 0o700)
except Exception:
    pass

DB_PATH = os.path.join(DATA_DIR, "pos_store.db")

# Auto-migrate legacy DB file if present at root/backend level
legacy_paths = [
    os.path.join(BASE_DIR, "pos_store.db"),
    os.path.join(os.path.dirname(BASE_DIR), "pos_store.db")
]
if not os.path.exists(DB_PATH):
    for leg_path in legacy_paths:
        if os.path.exists(leg_path):
            try:
                shutil.move(leg_path, DB_PATH)
                logger.info(f"Migrated legacy database file from {leg_path} to {DB_PATH}")
                # Move WAL & SHM files if present
                for ext in ["-wal", "-shm"]:
                    if os.path.exists(leg_path + ext):
                        shutil.move(leg_path + ext, DB_PATH + ext)
                break
            except Exception as e:
                logger.warning(f"Could not migrate legacy database file {leg_path}: {e}")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Enable timeout=15.0 to prevent sqlite3.OperationalError database locks in concurrent API requests
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15.0}
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable Write-Ahead Logging (WAL) mode and Foreign Key enforcement."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA busy_timeout=15000;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db_schema():
    """Ensures all tables and missing columns exist in SQLite database."""
    Base.metadata.create_all(bind=engine)
    migrations = [
        ("store_config", "csob_terminal_enabled", "BOOLEAN DEFAULT 0"),
        ("store_config", "csob_terminal_ip", "VARCHAR DEFAULT ''"),
        ("store_config", "csob_terminal_port", "INTEGER DEFAULT 8888"),
        ("store_config", "csob_terminal_id", "VARCHAR DEFAULT ''"),
        ("store_config", "cashier_pin", "VARCHAR DEFAULT '1234'"),
        ("store_config", "auto_lock_minutes", "INTEGER DEFAULT 15"),
        ("store_config", "direct_hardware_print", "BOOLEAN DEFAULT 1"),
        ("store_config", "id_provozovny", "VARCHAR DEFAULT '11'"),
        ("store_config", "id_pokl", "VARCHAR DEFAULT '1'"),
        ("store_config", "eet_enabled", "BOOLEAN DEFAULT 0"),
        ("store_config", "eet_cert_path", "VARCHAR DEFAULT ''"),
        ("store_config", "eet_cert_password", "VARCHAR DEFAULT ''"),
        ("store_config", "eet_environment", "VARCHAR DEFAULT 'playground'"),
        ("store_config", "eet_mode", "INTEGER DEFAULT 0"),
        ("store_config", "printer_interface", "VARCHAR DEFAULT 'USB'"),
        ("store_config", "printer_address", "VARCHAR DEFAULT '/dev/usb/lp0'"),
        ("store_config", "printer_paper_width", "VARCHAR DEFAULT '80'"),
        ("store_config", "bank_account_iban", "VARCHAR DEFAULT 'CZ6508000000001234567890'"),
        ("store_config", "default_language", "VARCHAR DEFAULT 'cs'"),
        ("store_config", "cart_position", "VARCHAR DEFAULT 'left'"),
        ("sales", "cart_discount_percent", "FLOAT DEFAULT 0"),
        ("sales", "split_details", "VARCHAR DEFAULT ''"),
        ("sales", "eic_popl", "VARCHAR DEFAULT ''"),
        ("sales", "id_provozovny", "VARCHAR DEFAULT '11'"),
        ("sales", "id_pokl", "VARCHAR DEFAULT '1'"),
        ("sales", "is_sent_to_eet", "BOOLEAN DEFAULT 1"),
        ("sales", "eet_retry_count", "INTEGER DEFAULT 0"),
        ("sales", "is_refund", "BOOLEAN DEFAULT 0"),
        ("sales", "original_receipt_number", "VARCHAR DEFAULT ''"),
        ("sales", "refund_reason", "VARCHAR DEFAULT ''"),
        ("sales", "refund_status", "VARCHAR DEFAULT 'NONE'"),
        ("sales", "refunded_amount", "FLOAT DEFAULT 0"),
        ("sale_items", "discount_percent", "FLOAT DEFAULT 0"),
        ("catalog_presets", "is_open_price", "BOOLEAN DEFAULT 0"),
        ("catalog_presets", "color", "VARCHAR DEFAULT '#3b82f6'"),
        ("catalog_presets", "sort_order", "INTEGER DEFAULT 0"),
        ("presets", "stock_quantity", "INTEGER DEFAULT 0"),
        ("presets", "track_stock", "BOOLEAN DEFAULT 0"),
        ("presets", "min_stock_alert", "INTEGER DEFAULT 5"),
        ("presets", "barcode", "VARCHAR DEFAULT ''"),
        ("presets", "is_general", "BOOLEAN DEFAULT 0"),
    ]
    from sqlalchemy import text
    with engine.connect() as conn:
        for table, col, col_type in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass


init_db_schema()


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def atomic_transaction(db):
    """Context manager for atomic DB transactions with auto-rollback on error."""
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


def check_db_integrity():
    """Runs PRAGMA quick_check to verify database file health."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA quick_check;")).scalar()
            if res != "ok":
                logger.critical(f"SQLite PRAGMA quick_check failed: {res}")
                return False
            return True
    except Exception as e:
        logger.error(f"Error checking database integrity: {e}")
        return False


def run_wal_checkpoint():
    """Executes PRAGMA wal_checkpoint(PASSIVE) to keep WAL log sizes optimal."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(PASSIVE);"))
            conn.commit()
            logger.debug("Executed SQLite PRAGMA wal_checkpoint(PASSIVE)")
    except Exception as e:
        logger.warning(f"Error running WAL checkpoint: {e}")


