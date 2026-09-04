# Launch & Environment Guide

Operational execution scripts, test suites, and environment setup.

## Launchers & Production Serving
- **Single-Process Production Mode**: FastAPI mounts compiled `dist/` static files on port 8000, eliminating Node/Vite dev server overhead in production (~150MB RAM savings).
- `Himmel_POS_Install.bat`: 1-Click complete installer for Python venv, dependencies, npm build, and Windows Firewall.
- `Himmel_POS.bat`: Fast production launcher with native port detection and Phone Customer Display QR/URL display.
- `Himmel_POS_Debug.bat`: Developer debug mode launching FastAPI (`:8000`) and Vite dev server (`:5173`) in visible windows with hot reloading.
- `Himmel_POS_Kiosk.bat`: Full-screen touch kiosk mode using Microsoft Edge `--kiosk`.
- `Himmel_POS_Customer_Display.bat`: Dedicated customer display launcher (`:8000/#/customer-display`).
- `Himmel_POS_Service_Install.bat`: Native Windows Task auto-boot service manager (install/uninstall menu).
- `Himmel_POS_Stop.bat`: Gracefully stops all POS processes and frees ports 8000 and 5173.
- `Himmel_POS_Update.bat`: 1-Click Git pull, package update, and UI re-compiler.
- **Linux Shell Scripts (`*.sh`)**:
  - `himmel_pos.sh`: Standard Linux production launcher (builds UI bundle, starts FastAPI on port 8000, opens Chrome/Chromium).
  - `himmel_pos_debug.sh`: Linux debug launcher with hot-reloading (`ENV=development`) on port 8000 and Vite dev server on port 5173.
  - `himmel_pos_kiosk.sh`: Full-screen touch kiosk launcher via Chrome/Chromium `--kiosk`.
  - `himmel_pos_mobile_launcher.sh`: Phone / LAN launcher displaying network IP addresses.
  - `himmel_pos_enable_lan.sh`: Configures UFW firewall and local binding.
  - `himmel_pos_stop.sh`: Linux service shutdown script (`pkill` backend, vite, litestream).
  - `himmel_pos_update.sh`: Automated git pull on active branch, venv update, DB schema migration, and UI rebuild.
  - `himmel_backend_settings.sh`: Launches Python pywebview desktop settings GUI.
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