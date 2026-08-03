# 🔒 Himmel POS — Database Safety & Security Plan

**Document Version:** 1.0.0  
**Target Module:** Database Hardening, Transaction Integrity, Foreign Keys, Backup & Disaster Recovery  
**Status:** Approved Specification — Pending Execution  

---

## 📑 Executive Summary

This plan details the full technical roadmap for hardening the **SQLite Database Layer (`pos_store.db`)** in Himmel POS to ensure 100% transaction integrity, zero data loss, real-time S3 streaming backup via Litestream, PRAGMA foreign key enforcement, and SQL injection prevention.

---

## 🏗️ Design Decisions & Architecture

| Component | Decisions Agreed |
|-----------|------------------|
| **File Protection** | DB relocated to `backend/data/pos_store.db` with restricted OS permissions (`chmod 600` / NTFS ACL restricted to POS process). |
| **Disaster Recovery** | Litestream real-time streaming to S3/Cloudflare R2 + automated daily local ZIP snapshots in `backend/backups/`. |
| **Integrity & WAL** | `PRAGMA foreign_keys = ON;`, `PRAGMA journal_mode = WAL;`, and atomic transaction context managers (`db.commit()` / `db.rollback()`). |
| **SQL Security** | 100% parameterized ORM queries, zero raw string interpolation, and static security linting rules. |

```
┌──────────────────────────────────────────────────────────────┐
│                    FastAPI API Routers                       │
│  - Parameterized ORM queries (SQLAlchemy)                    │
│  - Strict atomic transaction blocks (commit / rollback)      │
└──────────────┬───────────────────────────────────────────────┘
               │ Session Local (db)
               ▼
┌──────────────────────────────────────────────────────────────┐
│            SQLite Engine (backend/database.py)               │
│  - PRAGMA journal_mode = WAL                                 │
│  - PRAGMA synchronous = NORMAL                               │
│  - PRAGMA foreign_keys = ON                                  │
│  - Timeout = 15.0s (No locks)                                │
└──────────────┬───────────────────────────────────────────────┘
               │ Physical Files (backend/data/)
               ▼
┌──────────────────────────────────────────────────────────────┐
│                backend/data/pos_store.db                      │
│  - Restricted OS ACL (chmod 600 / Owner only)                │
└──────────────┬───────────────────────────────┬───────────────┘
               │ Real-Time Stream              │ Daily Snapshot
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│ Litestream Replication (S3)  │ │ Local ZIP Snapshot Backup   │
│  - Continuous point-in-time  │ │  - Saved to `backend/       │
│    cloud backup              │ │    backups/daily_*.zip`     │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 📑 Detailed Implementation Roadmap

### Phase 1: Database Location & OS File Protection

#### 1. Relocate Database Directory ([backend/database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py))
- Move `pos_store.db` to protected subdirectory `backend/data/pos_store.db`.
- Ensure directory `backend/data/` is auto-created on startup with restricted file permissions (`0o700` on Linux/macOS, owner ACL on Windows).
- Update `.gitignore` to ensure `backend/data/` and `backend/backups/` are never committed to git.

#### 2. PRAGMA & Connection Settings ([backend/database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py))
Update connection event listener:
```python
@event.listens_for(engine, "connect")
def set_sqlite_pragmas(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA busy_timeout=15000;")
    cursor.close()
```

---

### Phase 2: Transaction Integrity & Atomic Rollbacks

#### 1. Atomic Transaction Decorator & Context Manager ([backend/database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py))
Provide a transaction wrapper helper:
```python
from contextlib import contextmanager

@contextmanager
def atomic_transaction(db):
    """Context manager for atomic DB transactions with auto-rollback on error."""
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
```

#### 2. Apply Atomic Transactions in Routers ([backend/routers/sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py))
- Wrap multi-table updates (creating sale + creating line items + deducting stock + updating EET status) inside `atomic_transaction(db)`.
- Prevents partial checkout state or orphaned records if a crash or network error occurs mid-checkout.

---

### Phase 3: Backup & Disaster Recovery Automation

#### 1. Local Snapshot Backup Service ([backend/services/backup_service.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/backup_service.py))
- Implement SQLite backup API (`sqlite3.Connection.backup()`) to take clean snapshot backups while database is actively running in WAL mode without locking readers/writers.
- Save daily compressed backups to `backend/backups/pos_backup_YYYY-MM-DD.zip`.
- Auto-purge local snapshot files older than 30 days.

#### 2. Litestream Streaming Replication Config ([backend/litestream.yml](file:///home/misko/Documents/pos-eet-himmel/backend/litestream.yml))
- Configure Litestream to replicate `backend/data/pos_store.db` to S3 / Cloudflare R2:
```yaml
dbs:
  - path: ./backend/data/pos_store.db
    replicas:
      - type: s3
        bucket: $LITESTREAM_BUCKET
        path: pos_store.db
        endpoint: $LITESTREAM_ENDPOINT
```

#### 3. Backup Status Endpoint ([backend/routers/config.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/config.py))
- `GET /api/v1/system/backup-status`: Returns last backup timestamp, database file size, WAL size, and Litestream sync health.
- `POST /api/v1/system/trigger-backup`: Manual 1-click snapshot trigger from Settings UI.

---

### Phase 4: SQL Injection Prevention Audit

#### 1. Audit All Raw Queries ([backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py))
- Verify all string formatting in `MIGRATIONS` uses hardcoded tuple constants only.
- Audit all `text(...)` queries in routers to enforce bound parameters (`text("SELECT * FROM sales WHERE id = :id")`, `{"id": sale_id}`).

---

## 🧪 Verification & Acceptance Criteria

1. **Foreign Keys Enforced**: Inserting a `SaleItemModel` with a non-existent `sale_id` fails with `IntegrityError`.
2. **Atomic Rollback**: Intentionally raising an exception inside `create_sale` rolls back both the sale header and all line items cleanly.
3. **Snapshot Verification**: Running `POST /api/v1/system/trigger-backup` creates a valid, uncorrupted SQLite database file in `backend/backups/`.
4. **Litestream Health**: Litestream status endpoint reports active replication status.
5. **Zero Lint Errors**: `npm run lint` and Python test suite pass cleanly.

---

## 🤖 AI Agent Execution Prompt

Copy and paste the prompt below to trigger full execution by an AI coding assistant:

```text
Please implement the Database Safety & Security Hardening feature as specified in docs/DATABASE_SAFETY_PLAN.md.

Execute the implementation step-by-step:
1. Relocate database file to backend/data/pos_store.db in backend/database.py and enforce PRAGMA foreign_keys = ON and busy_timeout = 15000.
2. Add atomic_transaction context manager in backend/database.py and apply in backend/routers/sales.py.
3. Create SQLite snapshot backup service in backend/services/backup_service.py and add backup endpoints in backend/routers/config.py.
4. Update backend/litestream.yml to target backend/data/pos_store.db.
5. Audit raw text() SQL queries across all routers to guarantee 100% bound parameter sanitization.
6. Verify zero linter errors with npm run lint.
```
