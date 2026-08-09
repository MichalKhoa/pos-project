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
    """Dynamically detects & auto-migrates any missing table columns in SQLite database on startup."""
    from sqlalchemy import inspect, text
    Base.metadata.create_all(bind=engine)

    try:
        inspector = inspect(engine)
        with engine.connect() as conn:
            for table_name, table in Base.metadata.tables.items():
                if inspector.has_table(table_name):
                    existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            col_type = col.type.compile(engine.dialect)
                            default_clause = ""
                            if col.default is not None and hasattr(col.default, 'arg'):
                                default_val = col.default.arg
                                if isinstance(default_val, bool):
                                    default_clause = f" DEFAULT {1 if default_val else 0}"
                                elif isinstance(default_val, (int, float)):
                                    default_clause = f" DEFAULT {default_val}"
                                elif isinstance(default_val, str):
                                    default_clause = f" DEFAULT '{default_val}'"

                            alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"
                            try:
                                conn.execute(text(alter_stmt))
                                conn.commit()
                                logger.info(f"Auto-migrated missing column: {table_name}.{col.name} ({col_type})")
                            except Exception as e:
                                logger.warning(f"Could not auto-migrate column {table_name}.{col.name}: {e}")
    except Exception as e:
        logger.error(f"Error during dynamic DB schema migration: {e}")


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


