# Launch & Environment Guide

Operational execution scripts, test suites, and environment setup.

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
  Compiles React bundle into `dist/` with code-split chunks.

## Automated Testing & Quality Gates
- **Frontend Financial Unit Tests**:
  ```bash
  npm run test
  ```
  Runs `vitest` unit tests covering VAT multi-tier splits, cart discount distribution, and `roundCZK` invariants.
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