import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_DIR = os.getenv("DATA_DIR", DEFAULT_DATA_DIR)
SNAPSHOT_DB_PATH = os.path.join(DATA_DIR, "snapshot", "pos_store.db")
STAGING_DB_PATH = os.path.join(DATA_DIR, "pending_staging_queue.db")

from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, DateTime, Integer

# Models will inherit from this
Base = declarative_base()

class StagedIntakeModel(Base):
    __tablename__ = "staged_intakes"

    id = Column(String, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    supplier_name = Column(String, default="")
    supplier_ico = Column(String, default="")
    supplier_dic = Column(String, default="")
    invoice_number = Column(String, default="")
    issue_date = Column(String, default="")
    due_date = Column(String, default="")
    status = Column(String, default="PENDING_REVIEW") # PENDING_REVIEW, DRAFT, PENDING_STORE_SYNC, COMMITTED, REJECTED
    source = Column(String, default="MANUAL") # ISDOC, OCR, MANUAL, EMAIL
    total_ex_vat = Column(Float, default=0.0)
    total_inc_vat = Column(Float, default=0.0)
    items_json = Column(Text, default="[]")
    raw_payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    applied_at = Column(DateTime, nullable=True)

class StagedPriceChangeModel(Base):
    __tablename__ = "staged_price_changes"

    id = Column(String, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    ean = Column(String, index=True)
    product_name = Column(String, default="")
    old_retail_price = Column(Float, default=0.0)
    new_retail_price = Column(Float, default=0.0)
    status = Column(String, default="PENDING_STORE_SYNC") # PENDING_STORE_SYNC, COMMITTED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


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
