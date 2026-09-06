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

## 💻 Windows POS Installation & Deployment Guide

VoltFlow POS can be deployed on a Windows POS terminal using either a **zero-dependency native installer** (recommended for production terminals) or **one-click script setup** from source.

---

### 📋 Prerequisites & Compatibility

- **Operating System**: Windows 10 / Windows 11 (64-bit) or Windows 10 IoT Enterprise.
- **Display**: Minimum 1024x768 touch monitor (1280x800 or 1920x1080 recommended).
- **WebView2 Runtime**: Included by default in Windows 10/11. If missing on older Windows IoT builds, install the [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

### Option A: Native Desktop Installer (Recommended — Zero Dependencies)

Best for standalone POS terminals. **Does not require Python, Node.js, or Git installed on the POS device.**

1. **Download Installer**:
   - Download `VoltFlow-POS-Setup.exe` (or `.msi`) from the repository [GitHub Releases](../../releases).
   - *(Optional dev build)*: Generate the installer from source using:
     ```cmd
     scripts\build\build_windows_release.bat
     ```
     Binary output: `src-tauri\target\release\bundle\nsis\VoltFlow-POS-Setup.exe`.

2. **Run Installation**:
   - Double-click `VoltFlow-POS-Setup.exe` and follow on-screen prompts.
   - The installer sets up the Tauri v2 desktop shell, bundles the frozen backend sidecar, and creates a desktop shortcut.

3. **Launch & Run**:
   - Double-click the **VoltFlow POS** desktop icon.
   - The app runs in a chromeless native window with system tray controls and automatic backend process management.

---

### Option B: One-Click Script Installation (From Source / Git)

Best for maintenance setups, automatic Git updates, and local customizations.

#### Step 1: Install Software Prerequisites
1. **Python 3.10+ (64-bit)**: Download from [python.org](https://www.python.org/downloads/).
   - ⚠️ **CRITICAL**: Check **"Add python.exe to PATH"** during installation.
2. **Node.js LTS (18+)**: Download from [nodejs.org](https://nodejs.org/).
3. **Git for Windows**: Download from [git-scm.com](https://git-scm.com/).

#### Step 2: Clone or Copy the Repository
```cmd
git clone https://github.com/MichalKhoa/pos-project-himmel.git C:\VoltFlow_POS
cd C:\VoltFlow_POS
```

#### Step 3: Run Automated Installer
Double-click `install.bat` (or execute from Command Prompt):
```cmd
install.bat
```
This automated script will:
- Verify Python and Node.js in `PATH`.
- Create a dedicated virtual environment (`backend\venv`).
- Install Python backend dependencies (`requirements.txt`).
- Run database migrations (`backend\migrations.py` -> `pos_store.db`).
- Generate default environment configuration (`backend\.env`).
- Install frontend dependencies (`npm install`) and compile the production bundle (`npm run build`).

---

### 🚀 Daily Launching Modes (Windows POS)

Once installed, use the following shortcuts depending on your setup:

| Launch Script | Description | Recommended For |
| :--- | :--- | :--- |
| **`start.bat`** | Launches backend (:8000) and opens Microsoft Edge in dedicated chromeless App mode (`--app=...`). | **Standard POS cashiers** |
| **`scripts\tools\Himmel_POS_Kiosk.bat`** | Launches backend and opens fullscreen locked Touch Kiosk mode (`--kiosk`). | **Public / Locked POS terminals** |
| **`scripts\tools\Himmel_POS_Service_Install.bat`** | Installs backend as an auto-starting Windows Service (NSSM) or Scheduled Task that starts with Windows boot. | **Unattended terminal servers** |
| **`debug.bat`** | Launches hot-reload Vite server (:5173) + FastAPI (:8000). | **Developers / Diagnostics** |
| **`scripts\tools\Himmel_POS_Stop.bat`** | Cleanly terminates all backend processes and browser windows. | **Closing shift / Shutdown** |

---

### 🖨️ Hardware Configuration & Diagnostics

1. **Run Hardware Diagnostic Audit**:
   ```cmd
   scripts\tools\hardware_preflight.bat
   ```
   Audits thermal printers (USB/Network), serial COM ports, RJ11 drawer pulse lines, and local network ports.

2. **Configure Hardware Settings**:
   - **GUI Utility**: Run `backend_settings.bat` to manage `.env`, database paths, and hardware bindings.
   - **In-App Settings**: Open POS register -> Click **Nastavení (Settings)**:
     - **ESC/POS Thermal Printer**: Choose USB (Vendor/Product ID), Serial (COM Port, Baud Rate 9600/115200), or Network TCP/IP (`192.168.x.x:9100`).
     - **Cash Drawer**: Set RJ11 kick pulse pin (Pin 2 / Pin 5).
     - **ČSOB Card Terminal**: Enter Ingenico Move 3500 terminal IP address and port (default `20002`).
     - **EET 2.0**: Upload `.p12`/`.pfx` certificate file, enter passphrase, and configure VAT ID (DIČ).

3. **Customer Display Screen (Dual Monitor / Tablet)**:
   - On a secondary monitor attached to the POS PC, run:
     ```cmd
     scripts\tools\Himmel_POS_Customer_Display.bat
     ```
   - On a mobile phone or tablet on the same Wi-Fi, open:
     ```
     http://<POS_LOCAL_IP>:8000/#/customer-display
     ```
   *(Scan the QR code printed in the terminal console when running `start.bat`)*.
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
