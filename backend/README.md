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
├── models.py                  # SQLAlchemy ORM models (Sale, Item, Preset, StoreConfig)
├── requirements.txt           # Python dependencies
├── routers/                   # REST API & WebSocket endpoints
│   ├── config.py              # Store configuration & hardware setup
│   ├── display.py             # WebSocket customer LCD display streaming
│   ├── eet.py                 # EET status checks & manual retry triggers
│   ├── inventory.py           # Product inventory, stock ledger, categories
│   ├── payments.py            # Czech SPD QR generator & email verification
│   ├── printer.py             # ESC/POS print jobs & cash drawer pulse
│   └── sales.py               # Sales ledger, transactions, returns/refunds
├── services/                  # Hardware drivers & business logic
│   ├── csob_connector.py      # ČSOB Ingenico Move 3500 terminal TCP client
│   ├── eet_crypto.py          # PKCS#12 parser, PKP RSA-SHA256, BKP SHA-1
│   ├── eet_resend_daemon.py   # Background daemon retrying offline EET receipts
│   ├── eet_service.py         # High-level EET manager
│   ├── eet_soap.py            # WS-Security 1.0 SOAP envelope builder
│   ├── email_payment_listener.py # IMAP listener for instant QR payment verification
│   ├── escpos_service.py      # ESC/POS hardware printer driver (USB/Serial/TCP)
│   └── hardware_display_service.py # Line-display serial drivers
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
| `GET` | `/` | Service health status and version metadata |
| `GET` | `/api/v1/sales/` | Paginated sales ledger transactions |
| `POST` | `/api/v1/sales/` | Record new sale, calculate taxes, dispatch EET signing |
| `GET` | `/api/v1/sales/{id}` | Fetch individual sale details |
| `DELETE` | `/api/v1/sales/{id}` | Storno / refund reverse transaction |
| `GET` | `/api/v1/inventory/` | Product catalog, stock levels, barcodes |
| `POST` | `/api/v1/inventory/` | Create or update inventory item |
| `POST` | `/api/v1/printer/print` | Dispatch ESC/POS thermal receipt print job |
| `POST` | `/api/v1/printer/drawer` | Send pulse to open cash drawer via RJ11 |
| `GET` | `/api/v1/eet/status` | Certificate validity and Finanční správa connectivity |
| `POST` | `/api/v1/eet/resend/{id}` | Re-queue offline transaction to EET SOAP server |
| `POST` | `/api/v1/payments/generate-qr-string` | Generate Czech SPD bank QR payload string |
| `POST` | `/api/v1/payments/verify-qr` | Verify bank transfer arrival via IMAP cache |
| `GET` | `/api/v1/config/` | Retrieve active store and hardware configuration |
| `PUT` | `/api/v1/config/` | Update store settings, printer addresses, EET certs |
| `WS` | `/api/v1/ws/customer-display` | WebSocket channel for real-time customer LCD updates |

Interactive OpenAPI documentation is available at:
👉 **`http://localhost:8000/docs`**

---

## 🔌 Hardware Services & Integrations

### 1. ESC/POS Thermal Printing (`services/escpos_service.py`)
- Direct hardware communication via `python-escpos`.
- Supports **USB** (`vendor_id`, `product_id`), **Serial** (`COM1`, `/dev/ttyUSB0`), and **Network** (TCP/IP e.g. `192.168.1.200:9100`).
- Configurable top/bottom feed margins, diacritics stripping (CP852 / UTF-8), and cutter control.

### 2. ČSOB Payment Terminal (`services/csob_connector.py`)
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
