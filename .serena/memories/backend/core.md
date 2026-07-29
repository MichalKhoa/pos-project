# Backend Core

Python FastAPI backend structure located in `/backend`.

## Core Files
- [main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py): Application entry point, CORS middleware, router registration, database table auto-creation.
- [database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py): SQLAlchemy engine, session maker (`SessionLocal`), and `get_db()` dependency.
- [models.py](file:///home/misko/Documents/pos-eet-himmel/backend/models.py): Database tables (`SaleModel`, `SaleItemModel`, `StoreConfigModel`, `CatalogPresetModel`).

## Routers (`/backend/routers`)
- `sales.py`: Transaction creation, retrieval with date filters, admin deletion, EET resend.
- `printer.py`: Triggers ESC/POS thermal printing for receipts.
- `eet.py`: Certificate validation, status check, manual payload test.
- `payments.py`: Czech Short Payment Descriptor (SPD) QR code generation and verification.
- `display.py`: WebSocket connection manager for customer display.
- `catalog.py`: Preset categories and product catalog management.

## Services (`/backend/services`)
- Security & Cryptography: `security_utils.py` (Fernet password encryption, timezone-aware ISO parser, `Decimal` currency rounding).
- Czech EET 2.0 signing and SOAP transmission: `mem:backend/eet`
- ESC/POS printing, QR payment generation, WS customer display: `mem:backend/hardware`