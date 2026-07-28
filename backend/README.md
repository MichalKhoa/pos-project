# Himmel POS - Python FastAPI Backend & Hardware Integration

This directory contains the production-ready **Python FastAPI Backend Service** for `pos-eet-himmel`. It handles persistent SQLite transaction storage, physical ESC/POS receipt thermal printing, Czech EET 2.0 PKI signing and WS-Security SOAP communication, WebSocket streaming to customer LCD display panels, and Czech SPD QR payment code generation.

---

## 📁 Directory Architecture

```
backend/
├── certs/                      # Directory for PKCS#12 (.p12) EET certificates
├── database.py                 # SQLAlchemy engine, session maker, and Base model setup
├── main.py                     # FastAPI app initializer, CORS middleware, and router mounts
├── models.py                   # SQLAlchemy ORM models (SaleModel, SaleItemModel, StoreConfigModel)
├── pos_store.db                # SQLite database file (created automatically on startup)
├── requirements.txt            # Python package dependencies
├── routers/                    # REST API routes and WebSocket endpoints
│   ├── display.py              # WebSocket customer LCD display router
│   ├── eet.py                  # EET fiscal status check & manual retry endpoints
│   ├── payments.py             # Czech SPD QR string & payment verification endpoints
│   ├── printer.py              # ESC/POS hardware thermal print execution endpoint
│   └── sales.py                # Sales ledger CRUD & transaction recording endpoint
└── services/                   # Business logic and hardware hardware drivers
    ├── eet_crypto.py           # PKCS#12 (.p12) parser, PKP RSA signing & BKP SHA-1 hashing
    ├── eet_service.py          # Unified EET manager & transaction sign wrapper
    ├── eet_soap.py             # WS-Security 1.0 SOAP envelope builder & HTTP SOAP client
    ├── escpos_service.py       # ESC/POS driver interface (USB, Serial, Network, Cash Drawer)
    └── qr_bank_service.py      # Czech SPD (Short Payment Descriptor) QR payload generator
```

---

## 🗄️ Database Schemas (`models.py`)

### 1. `sales` (`SaleModel`)
Stores completed sales transactions and fiscal attributes.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Unique transaction ID (e.g. `sale-1722200000000`) |
| `receipt_number` | String | Formatted receipt number (e.g. `2026-0001`) |
| `timestamp` | DateTime | Transaction UTC timestamp |
| `total_amount` | Float | Final monetary total after discounts |
| `cart_discount_percent` | Float | Applied global cart discount percentage |
| `payment_method` | String | Payment mode (`cash`, `card`, `qr`, `split`) |
| `split_details` | JSON | Split payment amounts e.g., `{"cash": 500, "card": 1000}` |
| `tendered_amount` | Float | Cash tendered by customer |
| `change_due` | Float | Cash change returned to customer |
| `tax_summary` | JSON | Grouped VAT breakdown array (rates, base amounts, tax amounts) |
| `fik_code` | String | Czech EET Fiscal Identification Code (FIK) returned by FS ČR |
| `bkp_code` | String | Czech EET Security Code (BKP) |
| `pkp_code` | String | Czech EET Taxpayer Signature Code (PKP) |
| `eet_status` | String | EET status (`EVD_OK`, `OFFLINE_PENDING`, `VERIFIED_ONLY`, `ERROR`) |
| `id_provozovny` | String | Business Premises ID |
| `id_pokl` | String | Cash Register ID |
| `is_sent_to_eet` | Boolean | Flag indicating successful EET transmission |

### 2. `sale_items` (`SaleItemModel`)
Stores line items associated with sales.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Auto-incrementing primary key |
| `sale_id` | String (FK) | Foreign key referencing `sales.id` |
| `name` | String | Item name |
| `price` | Float | Unit price |
| `quantity` | Integer | Quantity purchased |
| `vat` | Integer | VAT rate percentage (21, 12, 0) |
| `discount_percent` | Float | Per-item custom discount percentage |

### 3. `store_config` (`StoreConfigModel`)
Stores register metadata, hardware setup, and EET parameters.

---

## 🛠️ Core Services Deep Dive

### 1. EET Cryptography (`services/eet_crypto.py`)
- **PKCS#12 Certificate Loading**: Reads `.p12` / `.pfx` certificate files using `cryptography.hazmat.primitives.serialization.pkcs12`.
- **PKP Calculation**: Computes RSA-SHA256 signature over standardized canonical seed string:
  `{eic_popl}|{id_jednotky}|{id_pokl}|{porad_cis}|{dat_trzby}|{celk_trzba}`.
- **BKP Calculation**: Computes SHA-1 hash of the raw PKP signature bytes and formats as a 5-group hex string (e.g. `12345678-9ABCDEF0-12345678-9ABCDEF0-12345678`).

### 2. EET SOAP Engine (`services/eet_soap.py`)
- **WS-Security 1.0 XML Generation**: Assembles SOAP 1.1 envelopes compliant with Finanční správa ČR EET v4.1 technical specification.
- **Endpoints**:
  - Playground: `https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`
  - Production: `https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`
- **Error & FIK Parsing**: Parses XML SOAP responses to extract FIK codes or error warning codes.

### 3. ESC/POS Receipt Printing (`services/escpos_service.py`)
- Interfaces with physical 80mm thermal receipt printers via `python-escpos`.
- Supports **USB** (`vendor_id`, `product_id`, `in_ep`, `out_ep`), **Serial** (`COM1`, `/dev/ttyUSB0`), and **Network** (TCP IP `192.168.1.200:9100`).
- Triggers automatic receipt paper cutting (`printer.cut()`) and sends solenoid voltage pulse pin signal to open the cash drawer.

### 4. Czech SPD QR Code Generator (`services/qr_bank_service.py`)
- Formats payment data into standard Czech **Short Payment Descriptor (SPD)** format:
  `SPD*1.0*ACC:CZ6508000000001234567890*AM:1250.00*CC:CZK*MSG:Himmel POS 2026-0001`
- Compatible with all major Czech banking mobile applications (ČSOB, KB, Česká spořitelna, Air Bank, Fio).

---

## 📡 Complete REST API Endpoint Documentation

| Method | Endpoint | Request Body | Response Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | None | API status check & version info |
| `GET` | `/api/v1/sales/` | Query params: `limit`, `offset` | List of all completed sales ledger transactions |
| `POST` | `/api/v1/sales/` | `SaleCreateSchema` | Save new sale, record items, and perform EET signing |
| `DELETE` | `/api/v1/sales/{id}` | None | Delete transaction (Admin mode) |
| `POST` | `/api/v1/printer/print` | `PrintRequestSchema` | Execute physical ESC/POS thermal receipt print job |
| `GET` | `/api/v1/eet/status` | None | Check EET certificate status & server connectivity |
| `POST` | `/api/v1/eet/resend/{id}` | None | Re-send offline/pending transaction to EET SOAP service |
| `POST` | `/api/v1/payments/generate-qr-string` | `QRPaymentRequestSchema` | Generate Czech SPD bank QR payload |
| `POST` | `/api/v1/payments/verify-qr` | `QRVerifyRequestSchema` | Verify arrival of bank transfer payment |
| `WS` | `/api/v1/ws/customer-display` | WebSocket Frame | Live WebSocket stream for Customer LCD display panel |

---

## 🖥️ Running the Backend Server

```bash
# 1. Active virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate # Or .\venv\Scripts\Activate.ps1 on Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
python main.py
```

Interactive OpenAPI documentation is available at:
👉 **`http://localhost:8000/docs`**
