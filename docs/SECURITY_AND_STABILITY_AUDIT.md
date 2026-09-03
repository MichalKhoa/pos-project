# Himmel POS — Security & Stability Audit Report

**Date:** 2026-09-03  
**Status:** Resolved (All SEC-01..05 & STAB-01..06 implemented & verified)  
**Scope:** Backend API, Database, Concurrency, Hardware Services, Authentication, and Networking (Excludes Frontend UI Overhaul).

---

## 🛡️ 1. Security Vulnerabilities

### SEC-01: Critical — Unauthenticated Sales Ledger Purge via Spoofed Header
- **Severity:** `CRITICAL`
- **Location:** [`backend/routers/sales.py:500-530`](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py#L500-L530)
- **Vulnerability:**
  Endpoints `DELETE /api/v1/sales/` and `DELETE /api/v1/sales/{sale_id}` verify administrative rights using only a client-supplied HTTP header:
  ```python
  admin_header = request.headers.get("X-Admin-Override", "")
  if admin_header.lower() != "true":
      raise HTTPException(status_code=401, detail="...")
  ```
  Any device on the local network (e.g. mobile phone connected to Wi-Fi) can issue a simple curl/fetch request with `X-Admin-Override: true` and erase all sales history and line items.
- **Compliance Impact:**
  Direct violation of the Czech Accounting Act (Zákon o účetnictví č. 563/1991 Sb.) and EET immutability standards. Sales records must be immutable once created.
- **Remediation:**
  1. Remove bulk delete (`DELETE /api/v1/sales/`) entirely from production builds.
  2. Protect single transaction deletion with password/PIN hash verification, or restrict to test environments (`ENV=test`).
  3. Enforce that real customer returns/corrections occur via reverse refund transactions (`refund_status`, `refunded_amount`, `is_refund=True`).

---

### SEC-02: High — Man-in-the-Middle QR Payment Hijacking
- **Location:** [`backend/routers/qr.py:58-71`](file:///home/misko/Documents/pos-eet-himmel/backend/routers/qr.py#L58-L71)
- **Severity:** `HIGH`
- **Vulnerability:**
  In `GET /api/v1/qr/spd`, the merchant IBAN is read directly from user query parameters:
  ```python
  if not target_iban or target_iban.startswith("CZ000000"):
      # fallback to store config
  ```
  If a client passes `?iban=CZ...`, the backend generates a valid Czech Banking Association (ČBA) SPD QR code using the supplied IBAN rather than the merchant's configured account.
- **Impact:**
  An attacker on LAN or malicious browser script can alter payment QR codes displayed on customer screen, diverting customer bank payments to an attacker's account.
- **Remediation:**
  Always ignore client-supplied `iban` parameters. Read the merchant IBAN strictly from `StoreConfigModel` in the SQLite database.

---

### SEC-03: High — Encryption Key Desynchronization via Relative Path
- **Location:** [`backend/services/security_utils.py:9-35`](file:///home/misko/Documents/pos-eet-himmel/backend/services/security_utils.py#L9-L35)
- **Severity:** `HIGH`
- **Vulnerability:**
  `SECRET_KEY_FILE = ".secret_key"` uses a relative path. If the application is launched from the root directory (`./himmel_pos.sh`), the secret key is read/written to `./.secret_key`. If launched from `backend/` (`cd backend && python main.py`), it creates a different key file `backend/.secret_key`.
- **Impact:**
  EET certificate passwords encrypted under one key become indecipherable when started from another directory, causing EET fiscal signing failures in production.
- **Remediation:**
  Anchor `SECRET_KEY_FILE` to an absolute path inside the protected data directory:
  ```python
  SECRET_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", ".secret_key")
  ```

---

### SEC-04: Medium — Permissive CORS Wildcard with Credentials
- **Location:** [`backend/main.py:120-126`](file:///home/misko/Documents/pos-eet-himmel/backend/main.py#L120-L126)
- **Severity:** `MEDIUM`
- **Vulnerability:**
  FastAPI CORS middleware is configured with `allow_origins=["*"]` alongside `allow_credentials=True`.
- **Impact:**
  Violates W3C CORS specification. Modern browsers reject cross-origin requests when wildcard origins are used with credentials.
- **Remediation:**
  Use `allow_origin_regex` to match loopback (`localhost`, `127.0.0.1`) and local RFC-1918 LAN subnets (`192.168.*`, `10.*`, `172.16-31.*`).

---

### SEC-05: Medium — Unauthenticated Remote System Update & Process Termination
- **Location:** [`backend/routers/updater.py:71-100`](file:///home/misko/Documents/pos-eet-himmel/backend/routers/updater.py#L71-L100) & [`backend/routers/system.py:64-74`](file:///home/misko/Documents/pos-eet-himmel/backend/routers/system.py#L64-L74)
- **Severity:** `MEDIUM`
- **Vulnerability:**
  `POST /api/v1/update/apply` does not require authentication or admin PIN. Anyone on the local network can remotely trigger a git pull, background process kill, and POS restart mid-transaction.
- **Remediation:**
  Require cashier PIN verification and loopback caller restriction (`request.client.host in ("127.0.0.1", "::1")`).

---

## ⚡ 2. Stability & Concurrency Issues

### STAB-01: High — 60-Second Network Printer Timeout Freezes Entire POS
- **Location:** [`backend/services/escpos_service.py:53,98`](file:///home/misko/Documents/pos-eet-himmel/backend/services/escpos_service.py#L53)
- **Severity:** `HIGH`
- **Root Cause:**
  `python-escpos` `Network(self.address, port=9100)` defaults to a 60-second socket timeout. The printing pipeline holds a global re-entrant thread lock:
  ```python
  with _hardware_printer_lock:
      return self._do_print_receipt(...)
  ```
  If a network thermal printer is powered off or disconnected from Ethernet, the call hangs for 60 seconds. During this window, all cash drawer kicks, receipt print jobs, and cashier actions requiring the printer lock are completely blocked.
- **Remediation:**
  Pass an explicit socket timeout: `Network(self.address, port=9100, timeout=3.0)` and fail gracefully to print simulation.

---

### STAB-02: High — Unbounded Batch Query in Offline EET Resend Daemon
- **Location:** [`backend/services/eet_resend_daemon.py:24-26`](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_resend_daemon.py#L24-L26)
- **Severity:** `HIGH`
- **Root Cause:**
  The background daemon queries all offline pending sales at once:
  ```python
  pending_sales = db.query(SaleModel).filter(...).all()
  ```
  If network connectivity has been interrupted for days and accumulated hundreds of transactions, the daemon attempts to submit them sequentially in a single loop. If the Finanční správa SOAP endpoint times out on each attempt (3–6s), the loop can monopolize the background thread and hold a database session for tens of minutes.
- **Remediation:**
  Limit query batches to `20` records per run (`.limit(20)`) and incorporate exponential backoff upon repeated SOAP server errors.

---

### STAB-03: Medium — Aggressive IMAP Reconnect Triggers Mailbox Bans
- **Location:** [`backend/services/email_payment_listener.py:115-153`](file:///home/misko/Documents/pos-eet-himmel/backend/services/email_payment_listener.py#L115-L153)
- **Severity:** `MEDIUM`
- **Root Cause:**
  The background email payment listener thread performs a complete SSL TCP handshake, authentication (`mail.login`), inbox search, and connection teardown (`mail.logout`) every 2 to 3 seconds:
  ```python
  mail = imaplib.IMAP4_SSL(self.imap_server)
  mail.login(self.username, self.password)
  ...
  mail.close()
  mail.logout()
  time.sleep(self.interval)
  ```
  Mail providers (e.g. Seznam.cz, Gmail) actively throttle or temporarily ban IP addresses exhibiting multiple SSL handshakes per second.
- **Remediation:**
  Keep the IMAP connection open between checks using `NOOP` polling or `IMAP IDLE` (RFC 2177) push notifications, with reconnect logic only on socket error.

---

### STAB-04: Medium — Partial Frame Reads on ČSOB Ingenico Move 3500 Terminal
- **Location:** [`backend/services/csob_terminal_service.py:171`](file:///home/misko/Documents/pos-eet-himmel/backend/services/csob_terminal_service.py#L171)
- **Severity:** `MEDIUM`
- **Root Cause:**
  Payment processing uses a single `sock.recv(4096)` call. The GPE / B-POST protocol can fragment long responses (especially those containing customer receipt text).
- **Remediation:**
  Implement framed stream reading that buffers received chunks until the framing delimiter (`ETX + LRC`) is received or the transaction timeout expires.

---

### STAB-05: Medium — Cross-Platform Updater Crash on Linux
- **Location:** [`backend/routers/updater.py:94`](file:///home/misko/Documents/pos-eet-himmel/backend/routers/updater.py#L94)
- **Severity:** `MEDIUM`
- **Root Cause:**
  On Linux, `apply_system_update()` executes `subprocess.Popen(["bash", script_path])` where `script_path` is hardcoded to `update_process.bat`. Running a Windows batch file with `bash` fails with syntax errors.
- **Remediation:**
  Dispatch `himmel_pos_update.sh` on Linux and `update_process.bat` on Windows.

---

### STAB-06: Low — Database Backup Created Without Restore Mechanism
- **Location:** [`backend/services/backup_service.py:14-67`](file:///home/misko/Documents/pos-eet-himmel/backend/services/backup_service.py#L14-L67)
- **Severity:** `LOW`
- **Root Cause:**
  Backups are compressed into `backend/backups/pos_backup_*.zip`, but no automated function or API exists to restore a database from backup. Restoring currently requires manual file copying while stopping processes.
- **Remediation:**
  Implement an atomic restore endpoint with automatic pre-restore safety snapshotting.
