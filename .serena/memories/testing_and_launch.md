# Launch & Environment Guide

Operational execution scripts, test suites, and environment setup.

## Launchers & Production Serving
- **Root Scripts**:
  - `debug.sh` / `debug.bat`: Developer debug mode launching FastAPI (`:8000`) and Vite dev server (`:5173`) with live hot reloading and clean Ctrl+C teardown.
  - `install.sh` / `install.bat`: 1-Click complete installer for Python venv, requirements, DB migrations, npm install, and production build.
  - `start.sh` / `start.bat`: Production launcher serving compiled frontend from FastAPI on port 8000.
  - `start_pos.sh` / `start_pos.bat`: Comprehensive production launcher with native port detection and Customer Display QR/URL display.
  - `backend_settings.sh` / `backend_settings.bat`: GUI for setting up backend `.env` variables, database config, EET certs, and payment terminals.
- **Build Scripts (`scripts/build/`)**:
  - `scripts/build/build_standalone.sh` / `scripts/build/build_standalone.bat`: PyInstaller standalone bundle generator.
  - `scripts/build/build_windows_release.bat`: 1-Click native Windows release installer build script (`.exe` NSIS & `.msi`).
- **Auxiliary Tools (`scripts/tools/`)**:
  - `himmel_pos_kiosk.sh` / `Himmel_POS_Kiosk.bat`: Full-screen touch kiosk mode.
  - `himmel_pos_mobile_launcher.sh`: Phone / LAN launcher displaying network IP addresses.
  - `himmel_pos_enable_lan.sh`: Configures UFW firewall and local binding.
  - `himmel_pos_stop.sh` / `Himmel_POS_Stop.bat`: Graceful service shutdown script.
  - `himmel_pos_update.sh` / `Himmel_POS_Update.bat`: Git pull, package update, and UI re-compiler.
  - `Himmel_POS_Customer_Display.bat`: Dedicated customer display launcher.
  - `Himmel_POS_Service_Install.bat`: Windows auto-boot service manager (uses `nssm.exe`).
- **Tauri Native Shell**:
  - `scripts/prepare_sidecar.py`: Builds PyInstaller standalone binary and stages it to `src-tauri/binaries/pos-backend-<target-triple>`.
  - `npm run tauri dev`: Launches desktop app in development mode with hot reload.
  - `npm run tauri build`: Compiles production native desktop bundle / installer.

## Manual Commands
- Backend:
  ```bash
  python backend/main.py
  ```
  Runs FastAPI on port 8000.
- Frontend Dev Server:
  ```bash
  npm run dev
  ```
  Runs Vite dev server on port 5173.
- Production Frontend Build:
  ```bash
  npm run build
  ```
  Compiles React bundle into `dist/` with code-split chunks.

## Automated Testing & Quality Gates
- **Frontend Test Suite (Vitest + jsdom + React Testing Library)**:
  ```bash
  npm run test
  ```
  Runs 30+ automated tests across 5 suites:
  - `taxCalculations.test.js`: Czech multi-tier VAT (21%, 12%, 0%), base + VAT invariants.
  - `currency.test.js`: Financial `roundCZK`, string formatting, change due.
  - `App.test.jsx`: Full App shell mounting, view routing (Register, Catalog, Inventory, History, Settings), customer display mode.
  - `modals.test.jsx`: Payment modal (Cash, Card, QR, Split), thermal receipt paper, preset editor, discount modal, admin PIN keypad.
  - `keypad_cart_presets.test.jsx`: 4x4 numeric keypad, ± Vratka sign toggle, Czech VAT chips, product grid category filtering, cart quantity steppers.
- **Frontend Code Linter**:
  ```bash
  npm run lint
  ```
  Runs `oxlint` enforcing zero-error and zero-warning standard.
- **Backend Unit Tests**:
  ```bash
  python -m unittest discover -s backend/tests -p "test_*.py"
  ```
  Executes all 25 unit & integration tests (`test_sales.py`, `test_eet_crypto.py`, `test_api_endpoints.py`, `test_business_logic.py`).

## Related Memories
- Core overview: `mem:core`
- Tech stack: `mem:tech_stack`
- Project instructions: `AGENTS.md`