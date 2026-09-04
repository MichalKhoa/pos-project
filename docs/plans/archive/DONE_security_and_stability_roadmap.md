# Security & Stability Roadmap — Himmel POS

Document generated from codebase audit on 2026-07-29.

---

## 1. Security Recommendations

### 1.1 Unrestricted Network Binding & Missing Auth [COMPLETED]
- **Location**: [main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py#L78)
- **Status**: FIXED — Host binding updated to `127.0.0.1` by default (configurable via `HOST` env var).
- **Risk**: FastAPI previously bound to `0.0.0.0:8000` with no authentication middleware.
- **Action**: Bound server to `127.0.0.1` by default.


### 1.2 Invalid CORS Origin Configuration [COMPLETED]
- **Location**: [main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py#L20-L30)
- **Status**: FIXED — Removed wildcard origin `["*"]` when `allow_credentials=True`. Configured explicit local origins `["http://localhost:5173", "http://127.0.0.1:5173"]` (configurable via `ALLOWED_ORIGINS` env var).
- **Risk**: Wildcard origin with credentials violates CORS specs and allows cross-origin web exploitation.
- **Action**: Restricted allowed origins to explicit local frontend URLs.

### 1.3 Unauthenticated System Shutdown & Shell Execution [COMPLETED]
- **Location**: [main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py#L54-L115)
- **Status**: FIXED — Restricted endpoint caller to loopback (`127.0.0.1`/`::1`), added automatic flushing of pending offline EET sales before exit, and removed indiscriminate `taskkill /F /IM node.exe` system process kills.
- **Risk**: Remote execution of process termination without caller check or pending task completion.
- **Action**: Enforced loopback check, auto-flushed pending sales, and targeted POS-specific window handles.


### 1.4 Path Traversal in Certificate Upload [COMPLETED]
- **Location**: [eet.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/eet.py#L80-L86)
- **Status**: FIXED — Filename now sanitized using `os.path.basename(file.filename)` before constructing target save path.
- **Risk**: Filename containing relative directory components (`../../`) could write files outside `CERTS_DIR`.
- **Action**: Applied `os.path.basename` sanitization and lowercased extension check.


### 1.5 Plain Text Cryptographic Password Storage [COMPLETED]
- **Location**: [security_utils.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/security_utils.py), [models.py](file:///home/misko/Documents/pos-eet-himmel/backend/models.py#L79-L88)
- **Status**: FIXED — Encrypts `eet_cert_password` before storing in SQLite using Fernet symmetric encryption key derived from system secret seed; decrypts transparently on retrieval with legacy plain text fallback.
- **Risk**: Storing raw merchant certificate passwords in SQLite database files.
- **Action**: Added symmetric encryption helper and updated ORM model accessor methods.


### 1.6 Unauthenticated Sales Ledger Hard Deletion [COMPLETED]
- **Location**: [sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py#L150-L170)
- **Status**: FIXED — Protected deletion route by enforcing loopback caller check (`127.0.0.1`) and requiring explicit `X-Admin-Override: true` authorization header.
- **Risk**: Unauthenticated deletion of transaction accounting records.
- **Action**: Added caller IP loopback validation and admin header check.


---

## 2. Stability & Resilience Recommendations

### 2.1 SQLite Database Locking Under Concurrency [COMPLETED]
- **Location**: [database.py](file:///home/misko/Documents/pos-eet-himmel/backend/database.py#L7-L20)
- **Status**: FIXED — Configured `PRAGMA journal_mode=WAL;`, `PRAGMA synchronous=NORMAL;`, and set `timeout=15.0` in connection arguments to eliminate concurrent database lock errors.
- **Risk**: Database write locking during concurrent API requests.
- **Action**: Added event listener for WAL pragma and increased busy timeout.


### 2.2 Unverified FIK Code Generation on Queue Flush [COMPLETED]
- **Location**: [eet.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/eet.py#L148-L156)
- **Status**: FIXED — Only updates transaction status to `EVD_OK` and sets FIK when the SOAP response confirms successful EET fiscal submission (`eet_status == "EVD_OK"`).
- **Risk**: Failed queue retries were previously assigning fake synthetic FIK UUIDs and marking failed sales as sent.
- **Action**: Added status check before modifying database record.


### 2.3 ISO Timestamp Parsing & Czech Timezone Handling [COMPLETED]
- **Location**: [security_utils.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/security_utils.py#L38-L70), [sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py#L80-L86), [eet_service.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_service.py#L43-L47)
- **Status**: FIXED — Replaced raw `fromisoformat()` with `parse_iso_timestamp()` helper that safely catches parsing errors and defaults to Czech local time (`Europe/Prague` / `ZoneInfo`).
- **Risk**: Uncaught ISO parsing `ValueError` crashing sale endpoint; timezone offset mismatch on EET fiscal signatures.
- **Action**: Implemented robust Czech-timezone-aware ISO parser and updated sales & EET fiscal services.


### 2.4 Floating-Point Currency Arithmetic [COMPLETED]
- **Location**: [security_utils.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/security_utils.py#L72-L85), [sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py#L80-L115), [eet_crypto.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_crypto.py#L65-L68), [eet_soap.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_soap.py#L68-L82)
- **Status**: FIXED — Implemented `round_currency()` helper using `Decimal` with `ROUND_HALF_UP` precision to eliminate binary floating-point representation drift across ledger storage, EET canonical seed generation, and SOAP payloads.
- **Risk**: IEEE 754 floating-point inaccuracies producing fractional haléře discrepancies in tax/EET totals.
- **Action**: Applied exact 2-decimal half-up quantization across database persistence and cryptographic signing routines.
