# VoltFlow POS — Python FastAPI Backend & Hardware Services

The `backend/` directory houses the production-ready **FastAPI Hardware & Fiscal Service** for VoltFlow POS. It provides persistent SQLite storage, ESC/POS thermal printing, Czech EET 2.0 PKI signing and SOAP dispatch, WebSocket streaming to customer LCD displays, ČSOB payment terminal communication, and real-time bank IMAP QR payment verification.

---

## 📁 Directory Architecture

```
backend/
├── build_standalone.py        # PyInstaller packaging automation script
├── pos_backend.spec           # Spec file supporting single-file & bundle modes
├── certs/                     # PKCS#12 (.p12 / .pfx) EET certificates
├── database.py                # SQLite engine, session maker, freeze-safe path resolution
├── migrations.py              # Automatic schema auto-migration manager
├── main.py                    # FastAPI entrypoint, lifespan, static mounting, routers
├── models.py                  # SQLAlchemy ORM models (see docs/ARCHITECTURE.md#5-data-model)
├── requirements.txt           # Python dependencies
├── routers/                   # REST API & WebSocket endpoints (all under /api/v1)
│   ├── cash.py                # Shifts, cash movements, Z-report
│   ├── catalog.py             # Categories, presets, barcode lookup
│   ├── config.py              # Store configuration, PIN checks, health, backup status
│   ├── display.py             # WebSocket customer display streaming
│   ├── eet.py                 # EET status, certificate upload, offline queue, resend
│   ├── payments.py            # Czech SPD QR, QR verification, card terminal
│   ├── printer.py             # ESC/POS print jobs, drawer pulse, reports
│   ├── qr.py                  # Offline QR generator
│   ├── reports.py             # Tax statement and VAT overview
│   ├── sales.py               # Sales ledger, transactions, refunds, Pohoda export
│   ├── stock.py               # Inventory ledger, write-offs, audits, deposits
│   ├── system.py              # Diagnostics, backups, restore, ARES, shutdown
│   └── updater.py             # Update status and apply
├── services/                  # Hardware drivers & business logic
│   ├── backup_service.py      # Hourly zip backups
│   ├── cloud_sync_service.py  # Cloud backup upload
│   ├── csob_terminal_service.py # ČSOB Ingenico Move 3500 terminal TCP client
│   ├── eet_crypto.py          # PKCS#12 parser, PKP RSA-SHA256, BKP SHA-1
│   ├── eet_resend_daemon.py   # Background daemon retrying offline EET receipts
│   ├── eet_service.py         # High-level EET manager
│   ├── eet_soap.py            # WS-Security 1.0 SOAP envelope builder
│   ├── email_payment_listener.py # IMAP listener for instant QR payment verification
│   ├── escpos_service.py      # ESC/POS hardware printer driver (USB/Serial/TCP)
│   ├── hardware_display_service.py # Line-display serial drivers
│   ├── hardware_profile.py    # RAM tier -> SQLite cache and prewarm sizing
│   ├── pin_auth.py            # PIN, recovery code and master key checks
│   ├── pohoda_export.py       # Pohoda XML export
│   ├── printer_discovery.py   # Connected printer detection
│   ├── qr_bank_service.py     # SPD QR payload
│   ├── rate_limiter.py        # Per-IP attempt limiter
│   ├── remote_staging_sync.py # Pulls staged batches from the cloud API
│   └── security_utils.py      # Certificate password encryption helpers
└── tests/                     # Automated Python unittest suite
```

---

## ❄️ Standalone Freezing & Freeze-Safe Paths

The backend is engineered for zero-dependency standalone execution via PyInstaller:

### Path Resolution Strategy (`database.py` & `main.py`)
- **Database Path**: Resolves to `POS_DATA_DIR` (if set in environment), or `os.path.dirname(sys.executable)` when frozen. The ephemeral `sys._MEIPASS` folder is **never** used for SQLite data to prevent database loss on app restarts.
- **Static Assets**: When compiled, static frontend assets (`dist/`) are served directly by FastAPI from `sys._MEIPASS/dist` or the executable directory.
- **Server Startup**: In frozen mode, `uvicorn.run(app, ...)` receives the direct FastAPI `app` instance (avoiding import string lookup errors).

### Freezing Commands
```bash
# Build standalone backend:
python backend/build_standalone.py

# Build single-file executable for Tauri sidecar:
PYINSTALLER_ONEFILE=1 python backend/build_standalone.py
```

Output: `backend/dist_standalone/pos-backend-standalone` (or `.exe` on Windows).

---

## 📡 REST API & WebSocket Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/status` | Health probe and hardware tier |
| `GET` | `/api/v1/sales/` | Sales ledger |
| `POST` | `/api/v1/sales/` | Record sale: server VAT recalculation, EET signing, stock deduction (idempotent) |
| `GET` | `/api/v1/sales/{id}` | Single sale |
| `GET` | `/api/v1/sales/by-receipt/{number}` | Look up a sale for refund |
| `PUT` | `/api/v1/sales/{id}/refund-status` | Mark refund status and optional restock |
| `GET` | `/api/v1/catalog/presets` | Product presets |
| `GET` | `/api/v1/catalog/barcode/{code}` | Barcode lookup |
| `POST` | `/api/v1/inventory/intake` | Stock intake |
| `GET` | `/api/v1/cash/current-shift` | Open shift state |
| `POST` | `/api/v1/cash/close-shift` | Close shift and Z-report |
| `POST` | `/api/v1/printer/print` | ESC/POS receipt print job |
| `POST` | `/api/v1/printer/open-drawer` | RJ11 drawer pulse |
| `GET` | `/api/v1/eet/status` | EET status and pending offline count |
| `POST` | `/api/v1/eet/process-queue` | Resend offline EET receipts |
| `POST` | `/api/v1/eet/force-resend` | Force resend |
| `POST` | `/api/v1/payments/generate-qr-string` | Czech SPD QR payload |
| `POST` | `/api/v1/payments/verify-qr` | Verify bank transfer via IMAP cache |
| `POST` | `/api/v1/payments/terminal/pay` | Card payment on the ČSOB terminal |
| `GET` / `POST` | `/api/v1/config` | Read or update store and hardware configuration |
| `WS` | `/api/v1/ws/customer-display` | Customer display channel |

The full route list per router is in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#42-routers-and-endpoints).

Interactive OpenAPI documentation is available at:
👉 **`http://localhost:8000/docs`**

---

## 🔌 Hardware Services & Integrations

### 1. ESC/POS Thermal Printing (`services/escpos_service.py`)
- Direct hardware communication via `python-escpos`.
- Supports **USB** (`vendor_id`, `product_id`), **Serial** (`COM1`, `/dev/ttyUSB0`), and **Network** (TCP/IP e.g. `192.168.1.200:9100`).
- Configurable top/bottom feed margins, diacritics stripping (CP852 / UTF-8), and cutter control.

### 2. ČSOB Payment Terminal (`services/csob_terminal_service.py`)
- TCP IP communication with ČSOB Ingenico Move 3500 payment terminals.
- Automated amount passing, currency coding, and receipt authorization printing.

### 3. Czech EET 2.0 Engine (`services/eet_crypto.py` & `eet_soap.py`)
- PKCS#12 parsing of merchant `.p12` certificates.
- RSA-SHA256 signature generation producing PKP (Taxpayer Signature Code).
- SHA-1 hashing producing BKP (Taxpayer Security Code).
- WS-Security 1.0 SOAP envelope dispatch with fallback to offline queue managed by `eet_resend_daemon.py`.

### 4. IMAP Bank Payment Listener (`services/email_payment_listener.py`)
- Background SSL IMAP listener (e.g. `imap.seznam.cz`, `imap.gmail.com`).
- Regex parsing of incoming bank notification emails for Variable Symbol (VS) and CZK amount.
- In-memory thread-safe `PaymentCache` allowing cashier UI to auto-complete sales within 2–4 seconds of customer scanning QR code.

---

## 🧪 Testing Backend Services

Run the complete backend test suite:
```bash
python -m unittest discover -s backend/tests -p "test_*.py"
```

Covers:
- `test_sales.py`: Sales ledger creation, item association, tax tier breakdowns.
- `test_eet_crypto.py`: PKCS#12 signing, canonical seed building, PKP/BKP invariants.
- `test_api_endpoints.py`: REST endpoint contracts and HTTP responses.
- `test_business_logic.py`: Cash change math and split tender consistency.
