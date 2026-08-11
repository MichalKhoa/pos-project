# Himmel POS - Modern Touchscreen Point of Sale System

**Himmel POS** (`pos-eet-himmel`) is a production-ready, full-stack Point of Sale (POS) system designed for retail, grocery, and hospitality operations. It combines a modern React 19 touchscreen UI with a robust Python FastAPI hardware backend, offering Czech EET 2.0 fiscal signature support, ESC/POS thermal receipt printing, ČSOB Ingenico payment terminal integration, real-time QR payment email verification, and background Windows Service execution via NSSM.

---

## 🌟 Key Features

- 🖥️ **Touchscreen Cashier Register**: Optimized responsive UI supporting category quick-presets, fast search, barcode/SKU scanner input, and manual custom item entry. Includes **High-Legibility Mode** for enhanced visibility and touch performance.
- 🖨️ **Streamlined Receipt Print Modal & Auto-Print**:
  - **Top-Mounted Action Buttons**: Print buttons (`⚡ Přímý Tisk Účtenky`, `Nový Prodej`) positioned at the top of the receipt modal for fast, single-tap operation.
  - **Auto-Print on Finish**: Configurable setting to automatically dispatch receipts to connected ESC/POS thermal printers immediately upon sale completion.
- 🛒 **Cart & Discount Management**: Per-item custom discounts, cart-level percentage/amount discounts, quantity toggles, and multi-tax CZ VAT calculations (21%, 12%, 0%).
- 💳 **Flexible Payment Methods**:
  - **Cash**: Automated change calculation and RJ11 cash drawer kick pulse.
  - **Card**: ČSOB Ingenico Move 3500 terminal TCP API integration & manual card fallbacks.
  - **Czech QR Code (SPD)**: Standardized Czech Short Payment Descriptor QR code with real-time IMAP bank email listener verification (2–4 seconds).
  - **Split Payment**: Split total amounts across Cash and Card seamlessly.
- 🇨🇿 **Czech EET 2.0 Fiscalization**: PKCS#12 (`.p12`) certificate signing, RSA-SHA256 PKP generation, SHA-1 BKP security codes, and WS-Security 1.0 SOAP envelope dispatch with offline queue resilience.
- 🖨️ **ESC/POS Hardware Thermal Printing**: Native USB, Serial, and Network thermal receipt printing (80mm & 58mm paper formats, plus A4 invoice fallback) using `python-escpos`.
- 📺 **WebSocket Customer Display**: Real-time streaming of items, total amounts, and OLED auto-standby power management for external customer-facing LCD monitors.
- 📊 **Sales Ledger & Reporting**: Local SQLite database storing complete transaction history with date filters, storno/refund management, receipt viewing, and CSV backup/restore.
- ⚙️ **Windows Background Service (NSSM)**: Run backend silently as an auto-restarting Windows System Service on system boot.

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
            │ (Sales, Items, Config)│ │ (ESC/POS, CSOB, SOAP) │
            └───────────────────────┘ └───────────────────────┘
```

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Lucide Icons, Vanilla CSS | Fast, responsive single-page touchscreen register UI |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy | REST API for register operations, hardware, and EET signing |
| **Database** | SQLite (`pos_store.db`) | Local persistence for completed sales and store configurations |
| **Service Engine**| NSSM (Non-Sucking Service Manager) | Runs backend automatically as a silent background Windows Service |
| **Fiscal Engine**| PyCryptodome, Cryptography, Requests | Czech EET 2.0 PKI signing and WS-Security 1.0 SOAP client |
| **Hardware** | `python-escpos`, WebSockets, PySerial | USB/Serial/Network thermal printers and dual-screen customer LCD |

---

## 📁 Repository Structure

```
pos-project-himmel/
├── backend/                  # Python FastAPI Backend & Hardware Services
│   ├── certs/                # Directory for EET PKCS#12 (.p12) certificates
│   ├── database.py           # SQLAlchemy database connection setup
│   ├── logs/                 # Backend runtime & NSSM service logs (nssm_err.log, nssm_out.log)
│   ├── main.py               # FastAPI application entry point & router mounting
│   ├── models.py             # SQLAlchemy DB schemas (SaleModel, StoreConfigModel, etc.)
│   ├── requirements.txt      # Python dependencies
│   ├── routers/              # API endpoints (sales, printer, eet, payments, config, display)
│   └── services/             # Business logic (eet_crypto, eet_soap, escpos_service, email_listener)
├── docs/                     # Documentation, guides, and implementation plans
├── nssm.exe                  # Windows Service Manager executable
├── src/                      # React 19 Frontend Web Application
│   ├── api/                  # API client layer (posApi.js)
│   ├── components/           # React UI components (Cart, ReceiptModal, SettingsView, etc.)
│   ├── data/                 # Default seed data and constants (initialData.js)
│   ├── App.jsx               # Root application component and state router
│   └── index.css             # Design tokens and theme system
├── Himmel_POS_Install.bat    # 1-Click Installer (Winget auto-install, venv, build & shortcut)
├── Himmel_POS_NSSM_Install.bat # Registers Python backend as background Windows Service via NSSM
├── Himmel_POS.bat            # Standard Cashier & Customer Display launcher
├── Himmel_POS_Debug.bat      # Debug mode launcher (live logging windows & dev server)
├── Himmel_POS_Kiosk.bat      # Full-screen touch kiosk mode launcher
├── Himmel_POS_Mobile_Launcher.bat # Mobile phone / LAN launcher (displays network URLs)
├── Himmel_POS_Customer_Display.bat # Dedicated secondary monitor customer screen launcher
├── Himmel_POS_Standalone_Server.bat # Headless server launcher for dedicated POS server node
├── Himmel_POS_Enable_LAN.bat # Configures Windows Defender Firewall rules & LAN access
├── Himmel_POS_Service_Stop.bat # Stops and unregisters Windows background service
├── Himmel_POS_Stop.bat       # Stops all running Himmel POS processes and browser windows
├── Himmel_POS_Update.bat     # Pulls latest code, updates venv, migrates DB & rebuilds UI
├── Himmel_Backend_Settings.bat # Desktop GUI configuration utility
├── package.json              # Frontend npm dependencies and scripts
└── vite.config.js            # Vite configuration
```

---

## ⚡ Quick Start Instructions

### Option 1: Automated Installation & Windows Launchers (Recommended)

1. **1-Click System Setup**: Run `Himmel_POS_Install.bat`.
   - Automatically detects Python 3.10+ and Node.js. Offers auto-install via Winget if missing.
   - Sets up Python virtual environment (`backend/venv`), installs packages, runs `npm install`, compiles production frontend (`npm run build`), and places a desktop shortcut.
2. **Launch Application**:
   - **`Himmel_POS.bat`**: Standard cashier register app.
   - **`Himmel_POS_Kiosk.bat`**: Full-screen touch kiosk mode.
   - **`Himmel_POS_Customer_Display.bat`**: Secondary screen customer display.
   - **`Himmel_POS_Mobile_Launcher.bat`**: Smartphone / tablet register & customer display access.

---

### Option 2: Running the Backend with NSSM (Windows Service)

To run the backend silently in the background so it automatically starts on Windows boot and auto-restarts on crashes:

1. **Install Service**: Right-click `Himmel_POS_NSSM_Install.bat` and select **"Run as administrator"**.
2. **Restarting the NSSM Service** (when backend code changes):
   - **Via Command Line** (Administrator PowerShell / CMD):
     ```powershell
     .\nssm.exe restart HimmelPOSBackend
     ```
   - **Via Windows Service Commands**:
     ```powershell
     Restart-Service HimmelPOSBackend
     ```
     *or in CMD:*
     ```cmd
     net stop HimmelPOSBackend
     net start HimmelPOSBackend
     ```
3. **Viewing Service Logs**:
   - Errors: [`backend/logs/nssm_err.log`](file:///c:/Users/PC/Documents/GitHub/pos-project-himmel/backend/logs/nssm_err.log)
   - Output: [`backend/logs/nssm_out.log`](file:///c:/Users/PC/Documents/GitHub/pos-project-himmel/backend/logs/nssm_out.log)

---

### Option 3: Manual Developer Start

#### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend
python main.py
```
The API server will run at **`http://localhost:8000`** (OpenAPI docs at `http://localhost:8000/docs`).

#### 2. Frontend Setup (React + Vite)

```bash
# In project root directory
npm install

# Start Vite development server
npm run dev

# Or build production bundle
cmd /c npx vite build
```
The register application will open at **`http://localhost:5173`**.

---

## ⚙️ Configuration & Features Guide

### 🖨️ Receipt Printing & Auto-Print Setup
- Open **Nastavení (Settings) -> Tiskárna & Periferie**:
  - **Printer Selection**: Choose USB (`/dev/usb/lp0`), Serial, or Network IP printer.
  - **Paper Format**: Select `80 mm` (72mm head, 48 chars/line), `58 mm` (48mm head, 32 chars/line), or `A4`.
  - **Auto-Print Toggle**: Turn **ON** `Automatický tisk účtenky při dokončení prodeje (Auto-Print)` to print receipts automatically on sale finish without clicking print.
- **Top Print Buttons**: The receipt completion modal displays **⚡ Přímý Tisk Účtenky** and **Nový Prodej** right at the top for immediate access.

### 🇨🇿 Czech EET 2.0 Setup
1. Place your official `.p12` certificate file inside `backend/certs/`.
2. In **Nastavení (Settings) -> EET**, specify:
   - Certificate file path and password
   - Environment (`Playground` or `Production`)
   - Business Premises ID (`id_provozovny`) and Register ID (`id_pokl`)
3. When sales complete, FIK/BKP/PKP codes are calculated. If offline, sales are queued as `OFFLINE_PENDING` and auto-sent when internet is restored.

---

## 📄 Documentation Links

- Frontend Details: [`src/README.md`](file:///c:/Users/PC/Documents/GitHub/pos-project-himmel/src/README.md)
- Backend API & Service Details: [`backend/README.md`](file:///c:/Users/PC/Documents/GitHub/pos-project-himmel/backend/README.md)
- ČSOB & Email Integration Manuals: [`docs/`](file:///c:/Users/PC/Documents/GitHub/pos-project-himmel/docs/)
