# Himmel POS - Modern Touchscreen Point of Sale System

**Himmel POS** (`pos-eet-himmel`) is a production-ready, full-stack Point of Sale (POS) system designed for retail and hospitality operations. It combines a modern React 19 touchscreen UI with a robust Python FastAPI hardware backend, offering Czech EET 2.0 fiscal signature support, ESC/POS 80mm thermal receipt printing, real-time customer LCD display via WebSockets, and QR bank payment verification.

---

## 🌟 Key Features

- 🖥️ **Touchscreen Cashier Register**: Optimized responsive UI supporting category quick-presets, fast search, barcode/SKU input, and manual custom entry.
- 🛒 **Cart & Discount Management**: Per-item custom discounts, cart-level percentage discounts, quantity toggling, and multi-tax VAT calculations (21%, 12%, 0%).
- 💳 **Flexible Payment Methods**:
  - **Cash**: Automated change calculation and cash drawer kick pulse.
  - **Card**: Instant card terminal workflow integration.
  - **Czech QR Code (SPD)**: Generates standardized Czech Short Payment Descriptor QR codes for direct bank transfer.
  - **Split Payment**: Split totals across Cash and Card seamlessly.
- 🇨🇿 **Czech EET 2.0 Fiscalization**: PKCS#12 (`.p12`) certificate signing, RSA-SHA256 PKP generation, SHA-1 BKP security codes, and WS-Security 1.0 SOAP envelope dispatch with offline queue resilience.
- 🖨️ **ESC/POS Hardware Thermal Printing**: Native USB, Serial, and Network thermal receipt printing using `python-escpos` with customizable header/footer.
- 📺 **WebSocket Customer Display**: Real-time streaming of items and totals to external customer-facing LCD display monitors.
- 📊 **Sales Ledger & Reporting**: Local SQLite database storing complete transaction history with date filters, status tracking, receipt viewing, and CSV export.
- ⚙️ **Product & Category Management**: Dynamic preset catalog management with custom colors, VAT rates, and LocalStorage backup/restore capabilities.
- 🚀 **One-Click Windows Launchers**: Pre-configured batch files for instant desktop register startup or full-screen kiosk execution.

---

## 🏗️ System Architecture & Tech Stack

```
                     ┌────────────────────────────────────────┐
                     │          React 19 + Vite UI            │
                     │  (Register, Catalog, Sales, Settings)  │
                     └───────────────────┬────────────────────┘
                                         │
                                   REST / WebSockets
                                         │
                     ┌───────────────────▼────────────────────┐
                     │         Python FastAPI Backend         │
                     └───────┬───────────────┬────────────────┘
                             │               │
            ┌────────────────┴──────┐ ┌──────┴────────────────┐
            │   SQLite DB Storage   │ │   Hardware & EET      │
            │ (Sales, Items, Config)│ │ (ESC/POS, Crypto/SOAP)│
            └───────────────────────┘ └───────────────────────┘
```

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Lucide Icons, Vanilla CSS | Fast, responsive single-page touchscreen register UI |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy | REST API for register operations, hardware, and EET signing |
| **Database** | SQLite (`pos_store.db`) | Local persistence for completed sales and store configurations |
| **Fiscal Engine**| PyCryptodome, Cryptography, Requests | Czech EET 2.0 PKI signing and WS-Security 1.0 SOAP client |
| **Hardware** | `python-escpos`, WebSockets | USB/Serial/Network thermal printers and dual-screen customer LCD |

---

## 📁 Repository Structure

```
pos-project-himmel/
├── backend/                  # Python FastAPI Backend & Hardware Services
│   ├── certs/                # Directory for EET PKCS#12 (.p12) certificates
│   ├── database.py           # SQLAlchemy database connection setup
│   ├── main.py               # FastAPI application entry point & router mounting
│   ├── models.py             # SQLAlchemy models (SaleModel, SaleItemModel, StoreConfigModel)
│   ├── requirements.txt      # Python dependencies
│   ├── routers/              # API endpoints (sales, printer, eet, payments, display)
│   └── services/             # Core business logic (eet_crypto, eet_soap, escpos_service)
├── docs/                     # Specifications, EET guides, PDF-to-Markdown tools
│   ├── convert_pdf_to_md.py  # Utility to convert official EET PDFs to Markdown
│   └── eet_docs/             # Stored EET spec documents
├── src/                      # React 19 Frontend Web Application
│   ├── api/                  # API client layer (posApi.js)
│   ├── components/           # React UI components (Cart, PaymentModal, Register, etc.)
│   ├── data/                 # Default seed data and constants
│   ├── App.jsx               # Root application component and state router
│   ├── App.css               # Application layout styling
│   └── index.css             # Design tokens and theme system
├── Himmel_POS.bat            # Windows 1-click desktop register launcher
├── Himmel_POS_Kiosk.bat      # Windows 1-click full-screen kiosk mode launcher
├── index.html                # Vite main HTML entry point
├── package.json              # Frontend npm dependencies and scripts
└── vite.config.js            # Vite configuration
```

---

## ⚡ Quick Start

### Option 1: Automated Launch on Windows (Recommended)

Simply double-click either launcher script in the root directory:
- **`Himmel_POS.bat`**: Starts the Python backend and Vite web server silently, then opens Himmel POS in an Edge Desktop Window.
- **`Himmel_POS_Kiosk.bat`**: Starts all services and opens the POS application in full-screen Kiosk mode.

---

### Option 2: Manual Installation & Running

#### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend
python main.py
```
The backend API server will run at **`http://localhost:8000`** with OpenAPI docs at **`http://localhost:8000/docs`**.

#### 2. Frontend Setup (React + Vite)

```bash
# In project root directory
npm install

# Start Vite development server
npm run dev
```
The register application will open at **`http://localhost:5173`**.

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API status check |
| `GET` | `/api/v1/sales/` | Fetch sales ledger transaction history |
| `POST` | `/api/v1/sales/` | Save new transaction and trigger EET signing |
| `DELETE` | `/api/v1/sales/{id}` | Delete transaction (Admin mode) |
| `POST` | `/api/v1/printer/print` | Trigger physical ESC/POS receipt thermal printing |
| `GET` | `/api/v1/eet/status` | Query EET 2.0 connection and certificate status |
| `POST` | `/api/v1/eet/resend/{id}` | Manually re-send offline/pending transaction to EET |
| `POST` | `/api/v1/payments/generate-qr-string` | Generate Czech SPD bank QR payload |
| `POST` | `/api/v1/payments/verify-qr` | Verify bank QR payment arrival |
| `WS` | `/api/v1/ws/customer-display` | Real-time WebSocket stream for external Customer LCD screen |

---

## 🇨🇿 EET 2.0 Fiscalization Setup

1. Place your official `.p12` certificate file inside the `backend/certs/` folder.
2. In the **Nastavení (Settings)** view of the frontend app, specify:
   - Path to `.p12` file (e.g., `certs/eet_test.p12`)
   - Certificate Password
   - Environment mode (`Playground` or `Production`)
   - Business Premises ID (`id_provozovny`) and Register ID (`id_pokl`)
3. When sales are completed, Himmel POS automatically generates PKP and BKP codes. If online connection to Finanční správa ČR fails, the transaction is marked as `OFFLINE_PENDING` and can be re-sent later from the Sales History view.

---

## 📄 License & Documentation

- See [`src/README.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/README.md) for detailed frontend documentation.
- See [`backend/README.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/README.md) for backend service details.
- See [`docs/README.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/README.md) for Czech EET specification details.
