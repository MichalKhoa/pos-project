# Backend Core

Python FastAPI backend structure located in `/backend`.

## Core Files
- [main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py): Application entry point, CORS middleware, router registration, database table auto-creation.
- [database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py): SQLAlchemy engine, session maker (`SessionLocal`), and `get_db()` dependency.
- [models.py](file:///home/misko/Documents/pos-eet-himmel/backend/models.py): Database tables (`SaleModel`, `SaleItemModel`, `StoreConfigModel`, `CatalogPresetModel`).

## Routers (`/backend/routers`)
- `sales.py`: Transaction creation, retrieval with date filters, admin deletion, EET resend, refund status updates.
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
- ESC/POS printing, hardware discovery, QR payment generation, WS customer display: `mem:backend/hardware`