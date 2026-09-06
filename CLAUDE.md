# VoltFlow POS — Project Memory & Architecture Context

## Core Technologies
- **Desktop Shell**: Tauri v2 (`src-tauri`) with Rust sidecar process management, system tray, kiosk mode, and native customer display window.
- **Frontend**: React 19 + Vite + Vanilla CSS (No Tailwind). Multi-language (CZ, VI, EN).
- **Backend**: Python FastAPI (`backend/main.py`) + SQLite (`database.py`, `models.py`) with freeze-safe paths.
- **Standalone Packaging**: PyInstaller single-file backend (`pos-backend-standalone`) and NSIS installer (`build_windows_release.bat`).
- **Hardware**: ČSOB Ingenico Move 3500 terminal TCP API, USB/Serial ESC/POS receipt printing, customer LCD display WebSocket.
- **Fiscalization**: Czech EET 2.0 PKCS#12 XML signing & SOAP playground/production communication.

## Architectural Components

### 1. Desktop Integration (Tauri v2 & IPC Bridge)
- `src-tauri/src/lib.rs`: Manages sidecar startup on port 8000, background health checks, tray menu, and clean child termination on exit.
- `src/hooks/useTauri.js`: React IPC bridge with transparent fallback to browser APIs when running on the web.

### 2. Standalone PyInstaller Freeze
- `backend/pos_backend.spec`: Supports both `--onefile` (`PYINSTALLER_ONEFILE=1`) and `--onedir` modes.
- `scripts/prepare_sidecar.py`: Automates target-triple binary detection and staging for Tauri bundling.
- Unified zero-dependency starters: `start.sh` (Linux) and `start.bat` (Windows).

### 3. Payment Integrations & Cashier Ergonomics
- Cash payment with RJ11 drawer pulse and change calculations.
- ČSOB Ingenico Move 3500 terminal TCP client and manual card fallback.
- QR payment verification via IMAP bank notification listener (`email_payment_listener.py`).
- 4x4 keypad, category presets, and barcode scanner auto-focus.

### 4. Quality Gates & Testing
- Frontend unit tests: `npm run test` (Vitest, 78 tests passing).
- Frontend linter: `npm run lint` (Oxlint, 0 errors, 0 warnings).
- Frontend production build: `npm run build` (Vite to `dist/`).
- Backend unit tests: `python -m unittest discover -s backend/tests -p "test_*.py"` (45 tests passing).

## Mandatory Agent Discipline
- **Implementation Planning First**: Create phased `implementation_plan.md` + get approval before multi-file/feature code changes.
- **Serena Memory & Codegraph (Autonomous)**: Full autonomous authority to read, query, edit, and sync `.serena/memories/` and `.codegraph/` without asking. Keep memories in sync.
