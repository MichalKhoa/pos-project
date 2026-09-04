# Security, PIN Authentication & Recovery Architecture

Security practices, authentication workflows, cryptographic hashing, and PIN recovery mechanisms in VoltFlow POS.

## 🔑 Cashier PIN Authentication & Hashing
- **PIN Length:** Supports variable length PINs from 4 to 8 digits.
- **Server-Side Hashing:** Cashier PINs are stored as SHA-256 hex digests in the SQLite database (`store_config.cashier_pin`).
- **Endpoint:** `POST /api/v1/config/verify-pin` compares SHA-256 hashes server-side.
- **Privacy:** `GET /api/v1/config` never returns `cashierPin` in payload—only a `hasPin` boolean. `cashierPin` is excluded from localStorage serialization.
- **Rate Limiting:** Lockout penalty starts after 5 failed attempts (30s penalty, 60s for 8+ attempts) with live visual countdown banner on lock screen.
- **Auto-Migration:** Plaintext PINs in legacy databases are automatically hashed on first successful verification.
- **Offline Fallback:** If Python backend is unreachable, lock screen falls back to localStorage PIN comparison.

## 🛑 Lock Screen & Input Isolation
- `LockScreenModal.jsx` handles PIN input.
- Uses capture phase listener (`window.addEventListener('keydown', handleKeyDown, true)`) and `e.stopImmediatePropagation()` to isolate physical keyboard events.
- Prevents PIN digits from leaking into underlying register inputs (`ManualKeypad.jsx`, `App.jsx`).

## 🛡️ Encryption, XSS & Transport Safety
- **Secret Key Handling:** Fernet encryption derives key from `APP_SECRET_KEY` env var or auto-generates persistent 32-byte secret key in `backend/data/.secret_key` (`0o600` permissions), with automatic migration from legacy root paths.
- **Wi-Fi / LAN Endpoint Hardening:**
  - `DELETE /api/v1/sales/` and `DELETE /api/v1/sales/{id}`: Strictly restricted to loopback callers (`127.0.0.1`, `::1`); remote Wi-Fi callers are blocked with `403 Forbidden`. Requires `X-Admin-PIN` matching stored hashed PIN.
  - `GET /api/v1/qr/spd` & `POST /api/v1/payments/generate-qr-string`: Enforces merchant IBAN strictly from `StoreConfigModel` in database. Client-supplied overrides and fake placeholder fallbacks are rejected with `400 Bad Request` to prevent payment hijacking.
  - `POST /api/v1/update/apply` & `POST /api/v1/system/shutdown` & `POST /api/v1/system/trigger-backup`: Enforce loopback caller restriction.
- **Path Traversal Protection:** SPA static file server (`serve_spa` in `backend/main.py`) strictly enforces `os.path.commonpath([abs_dist, file_path]) == abs_dist`, rejecting any directory traversal attempts with `403 Forbidden`.
- **CORS Hardening:** Wildcard with credentials eliminated. Uses regex permitting only loopback (`localhost`, `127.0.0.1`) and RFC-1918 private LAN ranges (`192.168.*`, `10.*`, `172.16-31.*`).
- **XSS Prevention:** `escapeHtml()` helper sanitizes all user-controlled catalog/store/receipt fields before rendering debug HTML print preview windows.
- **Upload Hardening:** Certificate uploads (`.p12`/`.pfx`) restricted to max 2 MB.

## 🔑 PIN Recovery Mechanisms (PUK & Local Script)
1. **Master Recovery Code (PUK):**
   - In-app unlock on lock screen via `POST /api/v1/config/verify-puk`.
   - Format: `VOLTFLOW-<ICO>-MASTER` or universal fallback `VOLTFLOW-RECOVERY-99` (with backward compatibility for `HIMMEL-*`).
   - Resets stored PIN to default `1234` and unlocks the screen.
2. **Local Terminal Script:**
   - `VoltFlow_POS_Reset_PIN.bat` directly executes an SQLite update in `pos_store.db` to set PIN hash to `1234`.

## 🚀 Execution & Launcher Scripts
- **Production Silent Mode (`VoltFlow_POS.bat`):** Runs FastAPI backend, Litestream, and Vite in background with no terminal windows; opens Edge POS app.
- **Debug Mode (`VoltFlow_POS_Debug.bat`):** Launches dedicated terminal windows for backend, frontend, and litestream with Edge DevTools auto-opened.
- **Windows Service (`WINDOWS_SERVICE_SETUP.md`):** Complete guide for setting up FastAPI backend via NSSM as a native Windows service starting at boot.
