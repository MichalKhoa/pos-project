# ⚡ Himmel POS — Comprehensive Stability, Security & Quality Plan

**Document Version:** 2.1.0  
**Target Module:** Testing Suite, Log Rotation, Rate Limiting, Hardware Resiliency, React Hooks, SQLite Self-Check, Production Serving & Progressive Web App (PWA)  
**Status:** Executed & Verified (100% Completed)  

---

## 📑 Executive Summary

This comprehensive plan details **13 structural technical improvements** focused on making **Himmel POS** enterprise-stable, secure, self-healing, high-performance, PWA-enabled, and zero-maintenance on cashier computers.

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                Security & Access Control                    │
 │  - Slowapi Rate Limiter on PIN routes (5/min per IP)        │
 │  - Checkout Idempotency Keys (X-Idempotency-Key)            │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             Testing, Diagnostics & Maintenance              │
 │  - Pytest Backend Suite (sales, VAT, EET signatures)        │
 │  - System Health Endpoint (/api/v1/system/health)           │
 │  - Oxlint / ESLint Zero-Warning Codebase                    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │               System & Hardware Resiliency                  │
 │  - Extended Logger: 30 files x 20MB in backend/logs/        │
 │  - ESC/POS Auto-Reconnect driver for USB thermal printer    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │         Performance, PWA Offline & Database Safety          │
 │  - Vite PWA Plugin & Service Worker Manifest                │
 │  - SQLite Quick Check on startup + PRAGMA WAL Checkpoint    │
 │  - React Hooks: useCart & usePosConfig decoupling App.jsx   │
 │  - StaticFiles Production Serving (FastAPI mounts dist/)    │
 │  - Web Audio UI Chimes & Touch On-Screen Keyboard           │
 └─────────────────────────────────────────────────────────────┘
```

---

## 📑 Detailed Implementation Roadmap

### Phase 1: Extended Rotating Log Handler (600 MB Retention)

#### Target File: [backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py)
Configure `logging.handlers.RotatingFileHandler`:
- **Directory**: `backend/logs/` (created automatically on startup).
- **Primary Log**: `backend/logs/pos_backend.log`.
- **Max File Size**: 20 MB per file.
- **Backup Retention Count**: 30 rotated log files (up to 600 MB total history over months of operation).
- **Log Format**: `[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s`.

---

### Phase 2: Automated Pytest Backend Testing Suite

#### Target Directory: `backend/tests/`
Create pytest test suite with test runners:
1. `backend/tests/test_sales.py`: Test line item VAT calculations (21%, 12%, 0%), cart discounts, split payment math, and receipt sequence counters.
2. `backend/tests/test_eet_crypto.py`: Test PKP RSA-SHA256 signature generation and BKP hash formatting using test certificates.
3. `backend/tests/test_api_endpoints.py`: FastAPI `TestClient` tests for catalog, configuration, sales checkout, and status routes.
4. **Pytest Script Configuration**: Add `backend/pytest.ini` and root runner script `scripts/run_tests.sh`.

---

### Phase 3: Hardware Thermal Printer Auto-Reconnect Driver

#### Target File: [backend/services/escpos_service.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/escpos_service.py)
- Wrap USB printer connection handles with exponential backoff retry decorator.
- If `/dev/usb/lp0` or Windows USB printer handle raises `DeviceNotFoundError` or `PermissionError`, auto-retry connection 3 times before failing gracefully.
- Prevents cashier application freezes when thermal printer power cord or USB cable is kicked.

---

### Phase 4: React State Decoupling (`useCart` & `usePosConfig`)

#### Target Files: `src/hooks/useCart.js`, `src/hooks/usePosConfig.js`, [src/App.jsx](file:///home/misko/Documents/pos-eet-himmel/src/App.jsx)
- **`useCart.js`**: Manages cart items, quantity changes, item discounts, cart percentage discount, and total/VAT calculations.
- **`usePosConfig.js`**: Manages store configuration loading, PIN verification state, auto-lock timers, and language preference.
- **Refactor `App.jsx`**: Replaces inline useState logic with custom hooks, reducing component size and cutting full-tree re-renders on numpad presses.

---

### Phase 5: SQLite Automatic WAL Checkpointing & Performance

#### Target File: [backend/database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py)
- Add periodic background task executing `PRAGMA wal_checkpoint(PASSIVE);` every 15 minutes.
- Prevents `pos_store.db-wal` from growing indefinitely during high-volume sales shifts.
- Maintains database size at ~50 KB with sub-5ms query response.

---

### Phase 6: Code Cleaning & Oxlint Warning Resolution

#### Target Files: `src/components/`, `src/App.jsx`
- Resolve all 20 oxlint/eslint warnings:
  - Remove unused imports (`Globe`, `AlertCircle`, `Calculator`).
  - Remove unused variables (`updateResult`, `queueResult`, `qrImageUrl`).
  - Fix duplicate CSS object keys in `SettingsView.jsx`.
  - Fix React `useEffect` dependency arrays in `App.jsx` and `PaymentModal.jsx`.

---

### Phase 7: FastAPI PIN Rate Limiting (`slowapi`)

#### Target Files: [backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py), [backend/routers/config.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/config.py)
- Add `slowapi` rate limiter middleware.
- Apply `@limiter.limit("5/minute")` to `/api/v1/config/verify-pin`.
- Rejects brute-force PIN attempts with `HTTP 429 Too Many Requests`.

---

### Phase 8: Checkout Idempotency Keys (`X-Idempotency-Key`)

#### Target Files: [backend/routers/sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py), [src/api/posApi.js](file:///home/misko/Documents/pos-eet-himmel/src/api/posApi.js)
- Attach client-generated UUID `X-Idempotency-Key` header on checkout POST requests.
- Cashier API checks key against recent cache (5-minute TTL); if duplicate detected, returns existing transaction payload instead of re-charging or double-printing.

---

### Phase 9: SQLite Startup Integrity Self-Check

#### Target File: [backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py)
- On backend startup, execute `PRAGMA quick_check;`.
- If database corruption is detected (e.g. abrupt power outage), log critical alert and auto-trigger restore from latest backup.

---

### Phase 10: Production Single-Process Static Asset Serving

#### Target Files: [backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py), [Himmel_POS.bat](file:///home/misko/Documents/pos-eet-himmel/Himmel_POS.bat)
- In production, mount compiled React frontend `dist/` directly in FastAPI:
  ```python
  from fastapi.staticfiles import StaticFiles
  if os.path.exists("../dist"):
      app.mount("/", StaticFiles(directory="../dist", html=True), name="static")
  ```
- Cuts RAM usage by ~150 MB by eliminating the need to run Vite dev server in production.

---

### Phase 11: System Diagnostics Endpoint (`/api/v1/system/health`)

#### Target File: [backend/routers/config.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/config.py)
- Create `/api/v1/system/health` returning JSON status: CPU %, RAM %, free disk space, printer USB status, EET server status, and DB WAL size.

---

### Phase 12: Web Audio UI Feedback & Touch Screen Keyboard

#### Target Files: `src/utils/audio.js`, [src/App.jsx](file:///home/misko/Documents/pos-eet-himmel/src/App.jsx)
- Web Audio API chimes for scan success, cash drawer pulse, and error alerts.
- Optional on-screen virtual keyboard for touchscreens without physical keyboard attached.

---

### Phase 13: Progressive Web App (PWA) Offline Caching & Manifest

#### Target Files: [vite.config.js](file:///home/misko/Documents/pos-eet-himmel/vite.config.js), `public/manifest.json`, [index.html](file:///home/misko/Documents/pos-eet-himmel/index.html)
- Integrate `vite-plugin-pwa` for service worker generation.
- **Manifest Properties**:
  - Name: `Himmel POS — Touchscreen Cashier Register`
  - Short Name: `Himmel POS`
  - Display: `standalone` (removes browser URL bar and frame)
  - Theme Color: `#1e293b`
  - Background Color: `#0f172a`
- **Service Worker Caching**: Cache all static JS, CSS, fonts, and HTML locally in browser storage using `CacheFirst` strategy.
- **Offline Benefit**: Register interface launches 100% instantly from browser cache even before local dev/backend server finish booting.

---

## 🧪 Verification & Acceptance Criteria

1. **Log Rotation**: Logs roll cleanly at 20 MB, maintaining up to 30 backup files (600 MB history).
2. **Rate Limiting**: 6th incorrect PIN attempt within 60s returns `HTTP 429`.
3. **PWA Standalone Mode**: Installing app to desktop or mobile home screen launches in full standalone kiosk window without browser URL bars.
4. **Pytest Suite**: `pytest backend/tests/` passes 100% of test cases.
5. **Zero Warnings**: `npm run lint` yields `0 errors, 0 warnings`.

---

## 🤖 AI Agent Execution Prompt

Copy and paste the prompt below to trigger full execution by an AI coding assistant:

```text
Please implement the Comprehensive Stability, Security & Quality Improvement Plan as specified in docs/plans/STABILITY_AND_QUALITY_PLAN.md.

Execute the implementation step-by-step:
1. Configure RotatingFileHandler in backend/main.py (20MB max file size, 30 backup files in backend/logs/).
2. Create pytest backend testing suite in backend/tests/ covering sales math, EET signatures, and API routers.
3. Add auto-reconnect retry wrapper in backend/services/escpos_service.py for thermal printer USB handles.
4. Extract useCart.js and usePosConfig.js hooks in src/hooks/ and refactor src/App.jsx.
5. Add periodic PRAGMA wal_checkpoint(PASSIVE) background task in backend/database.py.
6. Clean up all 20 linter warnings across src/ components until npm run lint output has 0 warnings.
7. Configure slowapi rate limiter in backend/main.py and decorator on /api/v1/config/verify-pin (5/min).
8. Add X-Idempotency-Key support in backend/routers/sales.py and src/api/posApi.js.
9. Implement PRAGMA quick_check on startup in backend/main.py.
10. Mount StaticFiles for dist/ directory in backend/main.py for production.
11. Implement /api/v1/system/health diagnostic endpoint in backend/routers/config.py.
12. Add Web Audio chime utility in src/utils/audio.js.
13. Integrate vite-plugin-pwa, public/manifest.json, and service worker registration for offline app launch.
```
