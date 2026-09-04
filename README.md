# VoltFlow POS — Modern Touchscreen Point of Sale System

**VoltFlow POS** (`pos-eet-himmel`) is an enterprise-grade, touch-optimized Point of Sale (POS) system engineered for retail, grocery, and hospitality businesses. It bridges a high-performance **React 19** touchscreen UI with a resilient **Python FastAPI** hardware backend, wrapped in a lightweight **Tauri v2** native desktop shell or deployable as a zero-dependency standalone server.

---

## 🌟 Key Features

### 🖥️ Native Desktop Shell & Kiosk Mode (Tauri v2)
- **Zero-Dependency Native Shell**: Packaged with Tauri v2 and Rust, eliminating browser chrome and command prompts.
- **Embedded Process Lifecycle**: Spawns and manages the frozen FastAPI backend as a managed sidecar process with clean SIGTERM shutdown on app exit.
- **System Tray Integration**: Native tray menu for quick status monitoring, window focus, and one-click backend service restart.
- **Dual-Screen Customer Display**: Native command to launch and position a secondary customer-facing display window (`/#/customer-display`) on secondary monitors.

### 🧾 Cashier Touch Ergonomics & UI
- **Touch-First Register**: Optimized for 1024x768 and 1280x800 touch monitors with strict 40–44px minimum touch targets and non-wrapping action chips.
- **Catalog & Keypad Workflow**: 4x4 numeric keypad with ± Vratka (return) toggle, quick Czech VAT selector (21%, 12%, 0%), product presets with category filtering, and instant barcode/SKU scanner capture.
- **Thermal Receipt Preview & Auto-Print**: Top-mounted direct print actions, customizable margins, cut commands, and automatic printing on transaction completion.
- **Multi-Language (i18n)**: Seamless instant switching between **Czech (cs)**, **Vietnamese (vi)**, and **English (en)**.

### 💳 Payments & Hardware Drivers
- **Cash**: Instant change calculation and automated RJ11 cash drawer solenoid kick pulse via ESC/POS.
- **Payment Terminal (ČSOB)**: Direct TCP IP protocol integration with ČSOB Ingenico Move 3500 terminals, plus manual card fallback.
- **Czech SPD QR Code**: Instant Short Payment Descriptor QR generation with real-time IMAP bank email listener verifying incoming bank transfers in 2–4 seconds.
- **Split Payments**: Flexible tender splitting across Cash, Card, and QR in a single sale.
- **ESC/POS Thermal Printers**: Native USB, Serial (RS-232), and Network (TCP/IP) printing for 80mm and 58mm paper formats via `python-escpos`.

### 🇨🇿 Czech EET 2.0 Fiscalization
- **Cryptographic Signing**: PKCS#12 (`.p12` / `.pfx`) certificate parsing, RSA-SHA256 PKP taxpayer signature computation, and SHA-1 BKP security code hashing.
- **Resilient SOAP Dispatcher**: WS-Security 1.0 SOAP envelope transmission to Finanční správa ČR with automated background retry daemon for offline resilience.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri v2 Desktop Shell                          │
│   (Native Window, System Tray, Process Lifecycle, Customer Display)    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
     ┌─────────────────────────────┐   ┌─────────────────────────────┐
     │     React 19 + Vite UI      │   │  PyInstaller Frozen Backend │
     │  (Touch Register, Catalog,  │   │   (FastAPI REST + SQLite +  │
     │   Settings, Sales History)  │   │    Hardware Drivers & EET)  │
     └──────────────┬──────────────┘   └─────────────┬───────────────┘
                    │                                │
                    └────── HTTP REST / WebSockets ──┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
   │ SQLite Store  │         │ ESC/POS Print │         │ ČSOB Terminal │
   │ (pos_store.db)│         │ & RJ11 Drawer │         │ & EET 2.0 SOAP│
   └───────────────┘         └───────────────┘         └───────────────┘
```

---

## 🚀 Runtime & Deployment Modes

VoltFlow POS supports three flexible deployment modes:

### Mode 1: Native Desktop App (Recommended for POS Terminals)
Run the native desktop shell with managed sidecar backend:
```bash
# Development desktop mode:
npm run tauri dev

# Build native Windows installer (.exe / .msi):
build_windows_release.bat
```

### Mode 2: Standalone Web POS (Zero-Dependency Launcher)
Runs the standalone frozen PyInstaller backend on port `8000` and opens the browser:
- **Windows**: Double-click `start.bat` (or `start_pos.bat`)
- **Linux**: Execute `./start.sh` (or `./start_pos.sh`)

### Mode 3: Developer / Debug Mode (Live Hot Reload)
One command to run both Vite dev server (:5173) and FastAPI backend (:8000) with hot reloading and clean Ctrl+C shutdown:
- **Linux / macOS**: `./debug.sh`
- **Windows**: `debug.bat`

---

## 📁 Repository Structure

```
pos-project-himmel/
├── backend/                       # Python FastAPI Backend
│   ├── build_standalone.py        # PyInstaller freezing script
│   ├── pos_backend.spec           # PyInstaller spec configuration (onefile & onedir)
│   ├── database.py                # SQLite connection & auto-migrations
│   ├── models.py                  # SQLAlchemy ORM models (Sale, Item, Preset, Config)
│   ├── routers/                   # REST endpoints (sales, inventory, eet, printer, payments)
│   ├── services/                  # Business logic (eet_crypto, escpos, email_listener)
│   └── tests/                     # Python unittest test suite
├── src/                           # React 19 Touchscreen Frontend
│   ├── App.jsx                    # POS register shell & view router
│   ├── api/posApi.js              # HTTP client API wrapper
│   ├── components/                # Modular UI components (Cart, Keypad, Modals, Settings)
│   ├── hooks/                     # Custom hooks (useCart, useRegisterKeypad, useTauri)
│   ├── i18n/translations.js       # Localization dictionary (cs, vi, en)
│   └── utils/                     # Tax invariants, roundCZK, currency math
├── src-tauri/                     # Tauri v2 Desktop Wrapper
│   ├── src/lib.rs                 # Rust sidecar management, tray menu, window lifecycle
│   ├── capabilities/default.json  # Tauri v2 security capabilities
│   └── tauri.conf.json            # Desktop window & bundle configuration
├── scripts/
│   ├── build/                     # Standalone & release build scripts (Linux/Windows)
│   ├── tools/                     # Auxiliary scripts (kiosk, LAN, updater, stop, nssm)
│   └── prepare_sidecar.py         # Stages backend binary for Tauri bundling
├── install.sh / install.bat       # One-click project setup
├── start.sh / start.bat           # Production launcher (:8000)
├── debug.sh / debug.bat           # Hot-reload debug launcher (Vite :5173 + FastAPI :8000)
├── backend_settings.sh / .bat     # Backend settings GUI (.env, DB, EET certs, hardware)
├── .github/workflows/             # GitHub Actions CI for Windows installers
└── docs/                          # Detailed architecture guides & specifications
```

---

## 🛠️ Build & Packaging Guide

### 1. Build Standalone Backend
Freezes the backend into a standalone executable containing all dependencies:
- **Linux**: `./scripts/build/build_standalone.sh`
- **Windows**: `scripts\build\build_standalone.bat`

Output: `backend/dist_standalone/pos-backend-standalone` and staged into `src-tauri/binaries/`.

### 2. Build Windows Release Installer
To generate a production `.exe` NSIS installer for Windows POS terminals:
```cmd
scripts\build\build_windows_release.bat
```
Output:
- `src-tauri\target\release\bundle\nsis\VoltFlow-POS-Setup.exe`
- `src-tauri\target\release\bundle\msi\VoltFlow-POS.msi`

### 3. Automated GitHub Actions Builds
The repository includes [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml). Pushing a release tag (e.g. `v1.0.0`) or triggering the workflow manually on GitHub compiles the Windows installer on a cloud runner and attaches the binaries to the release.

---

## 🧪 Quality Gates & Verification

All code changes must pass the automated quality gates:

```bash
# 1. Frontend Unit Tests (78 tests covering VAT, currency, keypad, modals, useTauri)
npm run test

# 2. Frontend Linter (0 errors, 0 warnings)
npm run lint

# 3. Production UI Build
npm run build

# 4. Backend Unit Tests (45 tests covering sales, EET crypto, API, models)
python -m unittest discover -s backend/tests -p "test_*.py"
```

---

## 📖 Additional Guides & Documentation

- [Master Product & Architecture Roadmap](docs/ROADMAP.md)
- [Cashier Setup & Touch Operations Guide](docs/guides/CASHIER_SETUP_GUIDE.md)
- [ČSOB Ingenico Move 3500 Terminal Integration](docs/guides/CSOB_TERMINAL_GUIDE.md)
- [Real-Time QR Payment Bank Email Listener Guide](docs/guides/REALTIME_QR_EMAIL_VERIFICATION_GUIDE.md)
- [Database Safety & Auto-Migration System](docs/plans/archive/DONE_DATABASE_SAFETY_PLAN.md)
- [EET 2.0 Legal & Cryptographic Specifications](docs/README.md)
- [Token Optimization & Context Shielding Measures](docs/TOKEN_SAVING_MEASURES.md)
- [Token Usage & Cloud Cost Tracking Guide](docs/TOKEN_TRACKING.md)
