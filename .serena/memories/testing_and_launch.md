# Launch & Environment Guide

Operational execution scripts and environment setup.

## Windows One-Click Launchers
- `Himmel_POS.bat`: Silent startup for backend and frontend dev server, opens Microsoft Edge app window.
- `Himmel_POS_Kiosk.bat`: Starts services and launches Microsoft Edge in `--kiosk` full-screen register mode.

## Manual Launch Commands
- Backend:
  ```bash
  cd backend
  source venv/bin/activate
  python main.py
  ```
  Runs FastAPI on port 8000 with auto-reloading.
- Frontend:
  ```bash
  npm run dev
  ```
  Runs Vite dev server on port 5173.

## Environment Dependencies
- Python 3.10+, `uv` package manager installed (`~/.local/bin/uv`).
- Node.js & npm for React frontend.
- PKCS#12 certificates placed in `backend/certs/`.

## Related Memories
- Core overview: `mem:core`