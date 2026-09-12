import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATA_DIR = os.getenv("DATA_DIR", "/app/data")
SNAPSHOT_DB_PATH = os.path.join(DATA_DIR, "snapshot", "pos_store.db")
STAGING_DB_PATH = os.path.join(DATA_DIR, "pending_staging_queue.db")

# Models will inherit from this
Base = declarative_base()

def get_snapshot_engine():
    """
    Returns an SQLAlchemy engine connected to the read-only SQLite snapshot.
    Uses immutable=1 to bypass locking for performance on read-only files.
    """
    if not os.path.exists(SNAPSHOT_DB_PATH):
        # Fallback to an empty in-memory DB or raise exception, for now create empty file if not exists
        # In a real scenario, this is downloaded from Cloudflare R2
        os.makedirs(os.path.dirname(SNAPSHOT_DB_PATH), exist_ok=True)
        conn = sqlite3.connect(SNAPSHOT_DB_PATH)
        conn.close()

    db_uri = f"sqlite:///file:{SNAPSHOT_DB_PATH}?mode=ro&uri=true"
    return create_engine(db_uri, connect_args={"check_same_thread": False})

def get_staging_engine():
    """
    Returns an SQLAlchemy engine for the writeable staging queue.
    """
    db_uri = f"sqlite:///{STAGING_DB_PATH}"
    return create_engine(db_uri, connect_args={"check_same_thread": False})

SnapshotSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_snapshot_engine())
StagingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_staging_engine())

def get_snapshot_db():
    db = SnapshotSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_staging_db():
    db = StagingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_staging_db():
    engine = get_staging_engine()
    Base.metadata.create_all(bind=engine)
