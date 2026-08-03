# 🛡️ Himmel POS — EET 2.0 Fiscalization Hardening Plan

**Document Version:** 1.0.0  
**Target Module:** EET 2.0 Fiscalization Engine, Offline Resend Daemon, Certificate Security & Legal Compliance Audit  
**Status:** Executed & Verified (100% Completed)  

---

## 📑 Executive Summary

This plan details the full technical roadmap for hardening the **Czech EET 2.0 Fiscalization System** in Himmel POS to ensure 100% legal compliance, zero sales data loss, Fernet AES-256 certificate security, an automated 60s background retry daemon for offline sales, and immutable audit logging.

---

## 🏗️ Design Decisions & Architecture

| Component | Decisions Agreed |
|-----------|------------------|
| **Cert Security** | Fernet AES-256 encrypted `.p12` password stored in SQLite `store_config` with `.secret_key` OS protection. |
| **Offline Resilience** | Automatic background daemon (`services/eet_resend_daemon.py`) retrying failed/offline sales every 60 seconds. |
| **Legal Receipts** | Online mode prints **FIK + BKP + QR**; Offline mode prints **PKP + BKP + Offline Warning**. |
| **Audit Compliance** | Immutable SQLite table `eet_audit_logs` tracking all SOAP XML request/response hashes and status codes. |

```
 ┌─────────────────────────────────────────────────────────────┐
 │                       Sales Checkout                        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    EET Fiscalization Engine                  │
│  1. Compute SHA-256 PKP (RSA Signature) & BKP (Hash)         │
│  2. Sign WS-Security SOAP XML                                │
└──────────────┬────────────────────────────────┬──────────────┘
               │ Online                         │ Offline / Timeout
               ▼                                ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│ Financial Administration API │ │   Offline Queue (`sales`)   │
│  - Returns FIK               │ │   - Status: OFFLINE_PENDING │
└──────────────┬───────────────┘ └──────────────┬──────────────┘
               │                                │
               │                                ▼
               │                ┌──────────────────────────────┐
               │                │ Background 60s Retry Daemon  │
               │                │  - Resends pending sales     │
               │                │  - Updates FIK upon success  │
               │                └──────────────┬───────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│                  Immutable Audit Logger                      │
│  - Logs to `eet_audit_logs` (XML hash, timestamp, status)    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📑 Detailed Implementation Roadmap

### Phase 1: Security & Certificate Protection

#### 1. Fernet AES-256 Key & Cert Password Security ([backend/services/security_utils.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/security_utils.py))
- Ensure `.secret_key` is generated with 600 (read/write owner only) permissions.
- Encrypt EET certificate password before saving to `store_config.eet_cert_password`.
- Provide `get_decrypted_cert_password()` helper method in `StoreConfigModel`.

#### 2. Auto-Migration & Models ([backend/models.py](file:///home/misko/Documents/pos-eet-himmel/backend/models.py))
- `SaleModel`: Ensure fields `fik_code`, `bkp_code`, `pkp_code`, `eet_status`, `is_sent_to_eet`, `eet_retry_count` exist.
- Add `EetAuditLogModel` table:
  ```python
  class EetAuditLogModel(Base):
      __tablename__ = "eet_audit_logs"
      id = Column(Integer, primary_key=True, autoincrement=True)
      sale_id = Column(String, ForeignKey("sales.id"), nullable=False)
      timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
      action = Column(String, nullable=False) # 'FIRST_SEND', 'RETRY_SEND', 'VERIFY'
      status = Column(String, nullable=False) # 'EVD_OK', 'OFFLINE_PENDING', 'ERROR'
      bkp = Column(String, nullable=True)
      fik = Column(String, nullable=True)
      request_hash = Column(String, nullable=True)
      error_message = Column(String, nullable=True)
  ```

---

### Phase 2: Automatic Offline Resend Daemon

#### 1. Background Retry Service ([backend/services/eet_resend_daemon.py](file:///home/misko/Documents/pos-eet-himmel/backend/services/eet_resend_daemon.py))
- Create background daemon loop running every 60 seconds:
  ```python
  def run_eet_resend_loop():
      while True:
          resend_pending_offline_sales()
          time.sleep(60)
  ```
- Queries `SaleModel` where `is_sent_to_eet == False` or `eet_status == 'OFFLINE_PENDING'`.
- Attempts SOAP submission to Financial Administration API.
- Upon success (`EVD_OK`), sets `fik_code`, sets `is_sent_to_eet = True`, updates `eet_status = 'EVD_OK'`, and records entry in `eet_audit_logs`.

#### 2. Startup Registration ([backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py))
- Launch `run_eet_resend_loop` in daemon thread on FastAPI startup (`@app.on_event("startup")`).

---

### Phase 3: Legal Receipt Formatting & Fallback Rules

#### 1. Receipt Modal Legal Layout ([src/components/ReceiptModal.jsx](file:///home/misko/Documents/pos-eet-himmel/src/components/ReceiptModal.jsx))
- **Online Mode (`fik` present)**:
  - Display **FIK**: `FIK: 12345678-abcd-1234-abcd-123456789abc-01`
  - Display **BKP**: `BKP: 12345678-12345678-12345678-12345678-12345678`
  - Display **QR Verification Code**.
- **Offline Mode (`fik` missing, `pkp` present)**:
  - Display **PKP**: `PKP: 12345678...` (first 16 chars + SHA)
  - Display **BKP**: `BKP: 12345678-12345678-12345678-12345678-12345678`
  - Display Notice: `Vystaveno ve zjednodušeném (neonline) režimu EET`

#### 2. ESC/POS Direct Thermal Printer Integration ([backend/routers/printer.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/printer.py))
- Format receipt ESC/POS text blocks with exact legal required fields (DIC, Provozovna, Pokladna, Dat_trzby, FIK/PKP, BKP).

---

### Phase 4: Verification & Audit Logging API

#### 1. EET Audit Endpoint ([backend/routers/eet.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/eet.py))
- `GET /api/v1/eet/audit-logs`: Fetch audit history for fiscal verification.
- `GET /api/v1/eet/offline-queue`: List all pending offline sales.
- `POST /api/v1/eet/force-resend`: Manual trigger for resending offline queue immediately.

---

## 🧪 Verification & Compliance Checklist

1. **Certificate Protection**: `.p12` passwords are saved encrypted and decrypted only during signing.
2. **Offline Resilience**: Disconnecting internet allows sales to complete instantly in offline mode with PKP/BKP.
3. **Daemon Auto-Sync**: Reconnecting internet triggers background daemon within 60s, acquiring FIK code and updating sales ledger.
4. **Audit Trail**: Every attempt creates an immutable entry in `eet_audit_logs`.
5. **Zero Lint Errors**: `npm run lint` and Python test pass cleanly.

---

## 🤖 AI Agent Execution Prompt

Copy and paste the prompt below to trigger full execution by an AI coding assistant:

```text
Please implement the EET 2.0 Fiscalization Hardening feature as specified in docs/EET_HARDENING_PLAN.md.

Execute the implementation step-by-step:
1. Extend models in backend/models.py with EetAuditLogModel and sale EET fields.
2. Add non-breaking auto-migration rules in backend/main.py MIGRATIONS array for eet_audit_logs.
3. Update backend/services/security_utils.py for Fernet AES-256 certificate password encryption.
4. Create background resend daemon in backend/services/eet_resend_daemon.py and launch on FastAPI startup in main.py.
5. Update backend/routers/eet.py with /api/v1/eet/audit-logs and /api/v1/eet/force-resend endpoints.
6. Update src/components/ReceiptModal.jsx and backend/routers/printer.py to format FIK+BKP (Online) vs PKP+BKP (Offline).
7. Verify zero linter errors with npm run lint.
```
