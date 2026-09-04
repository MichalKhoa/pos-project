# Backend Core

Python FastAPI backend structure located in `/backend`.

## Core Files
- `main.py`: Application entry point with modern `lifespan` context manager, CORS middleware, router registration, and static asset serving. Supports direct `app` instance execution for PyInstaller frozen mode.
- `paths.py`: Centralized freeze-safe path resolution (`DATA_DIR`, `DB_PATH`, `LOGS_DIR`, `CERTS_DIR`, `get_dist_dir()`). In frozen mode, resolves persistent data to per-user application storage (`%APPDATA%` on Windows, `~/.local/share` on Linux) to prevent permission crashes when installed in Program Files.
- `pos_backend.spec` & `build_standalone.py`: PyInstaller freeze automation for zero-dependency standalone backend packaging.
- `migrations.py`: Schema migrations runner (`run_schema_migrations`) isolating dynamic column alterations and index migrations.
- `database.py`: SQLAlchemy engine (SQLite WAL mode, `PRAGMA busy_timeout=15000`, `foreign_keys=ON`), session maker (`SessionLocal`), and `get_db()` dependency. Persistent `DATA_DIR` from `paths.py`.
- `models.py`: Database tables (`SaleModel` with compound indexes on `timestamp` and `payment_method`, `SaleItemModel`, `StoreConfigModel`, `PresetModel`, `ReceiptSequenceModel`).

## Routers (`/backend/routers`)
- `system.py`: System endpoints (`/api/v1/system/litestream-status`, `/api/v1/system/backup-status`, `/api/v1/system/trigger-backup`, `/api/v1/system/shutdown` with loopback check, offline EET flush, and graceful termination).
- `sales.py`: Transaction creation with thread-safe `BoundedTTLIdempotencyCache`, paginated sales history retrieval with default limit (50, capped at 500), `doc_type` ('sales' | 'refunds'), `include_items` (noload support), text search (receipt number, original receipt number, item name), date/payment filtering (`X-Total-Count` header), aggregation endpoints (`GET /api/v1/sales/stats/daily`, `GET /api/v1/sales/stats/shift`), admin deletion, EET signing, and refund status updates.
- `config.py`: Store configuration GET/POST API endpoints (`/api/v1/config`) for full SQLite database persistence.
- `printer.py`: Hardware device discovery (`/api/v1/printer/devices`) and ESC/POS thermal print triggers.
- `eet.py`: Certificate validation, status check, manual payload test, PKCS#12 upload.
- `payments.py`: Czech Short Payment Descriptor (SPD) QR code generation, verification, and ČSOB payment terminal integration.
- `qr.py`: Offline PNG QR image generator (`GET /api/v1/qr/generate` and `GET /api/v1/qr/spd`) using Python `qrcode` + `Pillow` libraries.
- `display.py`: WebSocket connection manager for customer display.
- `catalog.py`: Preset categories and product catalog management.

## Services (`/backend/services`)
- Security & Cryptography: `security_utils.py` (Fernet password encryption, timezone-aware ISO parser, `Decimal` currency rounding).
- Czech EET 2.0 signing and SOAP transmission: `mem:backend/eet`
- ESC/POS printing: `escpos_service.py` with `_hardware_printer_lock` (`threading.RLock`) for thread-safe serialized printing and cash drawer kicks.
- Hardware discovery, QR payment generation, WS customer display: `mem:backend/hardware`