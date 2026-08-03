# Launch & Environment Guide

Operational execution scripts and environment setup.

## Launchers & Production Serving
- **Single-Process Production Mode**: FastAPI mounts compiled `dist/` static files on port 8000, eliminating Node/Vite dev server overhead in production (~150MB RAM savings).
- `Himmel_POS.bat`: Silent startup for backend and frontend, opens Microsoft Edge app window.
- `Himmel_POS_Kiosk.bat`: Starts services and launches Microsoft Edge in `--kiosk` full-screen register mode.

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
  Compiles React bundle into `dist/`.

## Environment Dependencies
- Python 3.10+ & Node.js 18+.
- PKCS#12 certificates placed in `backend/certs/`.

## Automated Testing & Quality
- **Automated Test Suite**:
  ```bash
  python scripts/run_tests.py
  ```
  Executes all 24 unit & integration tests (`test_sales.py`, `test_eet_crypto.py`, `test_api_endpoints.py`, `test_business_logic.py`).
- **Code Linter**:
  ```bash
  npm run lint
  ```
  Enforces zero-error and zero-warning standard.

## Related Memories
- Core overview: `mem:core`
