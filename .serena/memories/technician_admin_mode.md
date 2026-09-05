# Technician Admin Mode Architecture & Implementation Specification

## Overview
Overhaul of Admin Mode into a dedicated **Technician Diagnostic & Maintenance Suite**.
Intended audience: Installers, service technicians, and system administrators. General staff/manager roles deferred.

## Design Decisions (Grill-Me Alignment)
1. **Target Role:** Dedicated Technician / Super-Admin.
2. **Settings UI Gating:**
   - Public/Cashier: General store details (name, address, receipt footer, paper width).
   - Gated/Technician: EET certificates & secrets, payment gateway IPs, backup/reset, and the new Technician Diagnostics tab.
3. **Technician Toolset:**
   - System & DB Health: Database file size, `PRAGMA integrity_check`, `VACUUM` / optimize, Tauri sidecar/process uptime, EET cert validity & expiry date.
   - Live Log Viewer: Tail recent backend log lines, filter errors, export diagnostic bundle.
   - Database Snapshot: Direct SQLite file download & safe restore with rollback.
4. **Session Security & Auto-Lock:**
   - 10-minute inactivity timer auto-locks session back to cashier mode.
   - High-visibility amber/red status badge in top navbar with countdown and quick-exit.
5. **Backend Authentication:**
   - Verification dependency `verify_technician_auth` checks `X-Admin-PIN` against stored SHA-256 PIN hash OR optional `POS_MASTER_ADMIN_KEY` from `.env`.
   - Loopback restriction on sensitive endpoints.

## Implementation Progress
- [x] **Phase 1: Backend Technician API & Diagnostics Endpoints**
  - Added `admin_pin` to `StoreConfigModel` (`backend/models.py`, `backend/migrations.py`).
  - Added `verify-admin-pin` endpoint and `adminPin` support to `backend/routers/config.py`.
  - Updated `_verify_admin_sales_override` in `backend/routers/sales.py`.
  - Added `verify_technician_auth` security dependency to `backend/routers/system.py`.
  - Implemented `/diagnostics`, `/db/vacuum`, `/logs`, `/db/backup`, `/db/restore`, and `/export-bundle` in `backend/routers/system.py`.
  - Created test suite `backend/tests/test_system_diagnostics.py` (51/51 tests pass).
- [x] **Phase 2: Frontend Technician Session & Settings Gate**
  - Added `verifyAdminPinBackend(pin)` to `src/api/posApi.js`.
  - StoreConfigContext 10-minute inactivity auto-lock (`TECHNICIAN_SESSION_TIMEOUT_SECONDS = 600`) with user activity listeners and 1s countdown tick.
  - Navbar persistent status badge in desktop and mobile drawer with Wrench icon, countdown timer, visual warning under 60s, and quick-lock button.
  - SettingsView tab gating (public tabs: store, layout, hardware, receipt; gated technician tabs: terminal, security, system, diagnostics).
  - AdminPinModal integration with backend verification fallback.
  - Comprehensive unit test suite `src/__tests__/technician_session.test.jsx` (15 test files, 95 tests pass).
  - Lint clean (0 errors, 0 warnings) and production build verified.
- [x] **Phase 3: Technician Diagnostics UI & Live Log Viewer**
  - Added technician API client methods (`fetchSystemDiagnostics`, `triggerDbVacuum`, `fetchSystemLogs`, `downloadDatabaseSnapshot`, `restoreDatabaseSnapshot`, `downloadDiagnosticBundle`) to `src/api/posApi.js`.
  - Created `TechnicianTab.jsx` component (`src/components/settings/TechnicianTab.jsx` + re-export `src/components/TechnicianTab.jsx`) with:
    - System & DB Health cards (SQLite metrics, `PRAGMA integrity_check`, process uptime, CPU, RAM, Disk, EET cert expiry, Litestream status).
    - Database maintenance & `VACUUM` trigger with result banners.
    - Live Log Viewer with level filtering (`ALL`, `INFO`, `WARNING`, `ERROR`, `DEBUG`), keyword search, lines selector (50-1000), auto-refresh (3s), and dark terminal log console.
    - Snapshot backup (.zip download) & safe restore (.db / .zip upload) with safety confirmation modal.
    - One-click Diagnostic Bundle export (.zip).
  - Integrated into `SettingsView.jsx` diagnostics sub-tab with segmented switcher (`[Servisní diagnostika]` vs `[Náhled & Periferie]`).
  - Added full translation dictionary across `cs`, `vi`, and `en` in `src/i18n/translations.js`.
  - Comprehensive unit test suite `src/__tests__/technician_tab.test.jsx` (16 test files, 102 tests pass).
  - Lint clean (0 errors, 0 warnings) and production build verified.
- [x] **Phase 4: Verification & Hardening**
  - Loopback caller restrictions and remote `Origin` 403 enforcement consolidated via `_enforce_loopback_and_origin` in `backend/routers/system.py` across all technician and maintenance endpoints (`/diagnostics`, `/db/vacuum`, `/logs`, `/db/backup`, `/db/restore`, `/export-bundle`, `/trigger-backup`, `/restore`, `/shutdown`).
  - Added simulated DB corruption validation in `backend/routers/system.py` and `backend/tests/test_system_diagnostics.py` (corrupt files, invalid ZIPs, corrupt SQLite pages return 400 Bad Request; valid DB snapshots restore with rollback protection).
  - Implemented Tauri sidecar backend restart and cold-start reconnect polling flow in `TechnicianTab.jsx` with real-time feedback banner and reconnection retry loop.
  - Added multi-lingual localization across `cs`, `vi`, and `en` in `src/i18n/translations.js`.
  - Comprehensive unit testing:
    - Frontend vitest: 16 test files, 104/104 tests pass.
    - Backend unittest: 8 test files, 55/55 tests pass.
    - Oxlint: 0 errors, 0 warnings.
    - Vite production build: builds cleanly in 247ms.

