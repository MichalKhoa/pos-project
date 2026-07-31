# 🔒 Himmel POS — Security, Stability & Edge Case Audit

**Date:** 2026-07-30
**Scope:** Full-stack audit — Python FastAPI backend + React/Vite frontend
**Auditor:** Automated static analysis + manual code review

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 2 | 1 Resolved ✅ / 1 Pending |
| 🟠 HIGH | 5 | 5 Resolved ✅ |
| 🟡 MEDIUM | 7 | 7 Resolved ✅ |
| 🔵 LOW | 4 | 4 Resolved ✅ |

---

## 🔴 CRITICAL

### C1. No Authentication on Any API Endpoint (PENDING)

**Files:** All routers in `backend/routers/` — `sales.py`, `config.py`, `printer.py`, `eet.py`, `catalog.py`

**Issue:** Zero authentication or authorization on all API endpoints. Any process or device with network access to port 8000 can create sales, modify store config, upload certificates, delete transactions, and trigger EET submissions.

**Impact:** On a shared network, a malicious actor can fabricate sales, alter tax IDs (IČO/DIČ), steal EET certificates, or delete transaction history — all without credentials.

**Mitigating factor:** The shutdown endpoint (`POST /api/v1/system/shutdown`) and sale deletion (`DELETE /api/v1/sales/{id}`) do enforce localhost-only access. However, all other endpoints are completely open.

**Recommended Fix:**
1. **Minimum (local POS kiosk):** Keep backend bound to `127.0.0.1`. Add shared API key via `X-API-Key` header if exposing on LAN.
2. **Better:** Add session-based auth with the cashier PIN — require PIN verification via API before sensitive operations.
3. **Best:** JWT token auth with role-based access (cashier vs admin).

*See full multi-device scaling and security roadmap in [SCALING_AND_NETWORK_SECURITY.md](file:///home/misko/Documents/pos-eet-himmel/SCALING_AND_NETWORK_SECURITY.md).*

---

### C2. ~~XSS via HTML Injection in Receipt Print Popup~~ ✅ RESOLVED

**File:** `src/components/ReceiptModal.jsx`

**Fix Applied:** Added `escapeHtml()` utility sanitizing all user-controlled data (`item.name`, `storeConfig` properties, receipt numbers, refund reasons) before template literal HTML string interpolation.

---

## 🟠 HIGH

### H1. ~~Hardcoded Fernet Encryption Seed~~ ✅ RESOLVED

**File:** `backend/services/security_utils.py`

**Fix Applied:** Auto-generates a secure 32-byte key persisted to `.secret_key` on first launch when `APP_SECRET_KEY` env var is missing.

---

### H2. ~~Lock Screen is Client-Side Only — Trivially Bypassable~~ ✅ RESOLVED

**Files:** `src/components/LockScreenModal.jsx`, `src/App.jsx`, `backend/routers/config.py`, `src/api/posApi.js`

**Fix Applied:** Server-side SHA-256 PIN verification endpoint `POST /api/v1/config/verify-pin`.

---

### H3. ~~Missing React Error Boundary~~ ✅ RESOLVED

**Files:** `src/components/ErrorBoundary.jsx`, `src/main.jsx`

**Fix Applied:** Added `ErrorBoundary` class component wrapping application root in `main.jsx`.

---

### H4. ~~Cashier PIN Stored in Plain Text in localStorage~~ ✅ RESOLVED

**File:** `src/App.jsx`

**Fix Applied:** Stripped `cashierPin` from `storeConfig` object when serializing to `localStorage`.

---

### H5. ~~Floating-Point Currency Precision Errors~~ ✅ RESOLVED

**Files:** `src/App.jsx`, `src/components/Cart.jsx`

**Fix Applied:** Implemented `roundCZK()` (2 decimal places rounding) for all gross, net, tax, and cart-level discount calculations.

---

## 🟡 MEDIUM

### M1. ~~Potential Duplicate Receipt Numbers~~ ✅ RESOLVED

**Files:** `backend/models.py`, `backend/routers/sales.py`, `src/App.jsx`

**Fix Applied:** Implemented `ReceiptSequenceModel` table and `generate_next_receipt_number()` atomic helper in Python backend. On `POST /api/v1/sales`, backend assigns sequence number atomically inside SQLite transaction. Exposed `GET /api/v1/sales/next-receipt-number` preview endpoint.

---

### M2. ~~Multi-Tab State Overwrite Race Condition~~ ✅ RESOLVED

**File:** `src/App.jsx`

**Fix Applied:** Added window `storage` event listener to reactively update React state across tabs when `localStorage` keys change, plus window `focus` event backend DB re-fetch.

---

### M3. ~~No Rate Limiting on PIN Attempts~~ ✅ RESOLVED

**File:** `src/components/LockScreenModal.jsx`

**Fix Applied:** Exponential rate-limiting lockout timer (5s after 3 attempts, 15s after 5, 60s after 6+) added.

---

### M4. ~~`get_czech_now()` Missing Import~~ ✅ RESOLVED

**File:** `backend/services/security_utils.py`

**Fix Applied:** Module-level `datetime` and `timezone` imports added.

---

### M5. ~~Unbounded Cart Quantity Increment~~ ✅ RESOLVED

**Files:** `src/App.jsx`, `src/components/Cart.jsx`

**Fix Applied:** Cart item quantity clamped to maximum 9,999.

---

### M6. ~~Certificate Upload — No File Size Limit~~ ✅ RESOLVED

**File:** `backend/routers/eet.py`

**Fix Applied:** Enforced 2MB file size limit on `.p12`/`.pfx` uploads returning 413 Payload Too Large.

---

### M7. ~~Raw SQL in Auto-Migration Engine~~ ✅ RESOLVED

**File:** `backend/main.py`

**Fix Applied:** Added invariant code comment ensuring safety of hardcoded tuple constants.

---

## 🔵 LOW

### L1. ~~CORS Allows Credentials with Wildcard Methods/Headers~~ ✅ RESOLVED

**File:** `backend/main.py`

**Fix Applied:** Restricted CORS to explicit HTTP methods and allowed headers.

---

### L2. ~~Shutdown Endpoint Executes Shell Commands~~ ✅ RESOLVED

**File:** `backend/main.py`

**Fix Applied:** Replaced `shell=True` string commands with `shell=False` argument lists for `taskkill`.

---

### L3. ~~`decrypt_secret()` Silently Returns Ciphertext on Failure~~ ✅ RESOLVED

**File:** `backend/services/security_utils.py`

**Fix Applied:** Added warning logging on decryption failure fallback.

---

### L4. Printer Device Discovery — `lpstat` Subprocess is Safe ✅

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
