# VoltFlow POS — Backend Audit Report
**Scope**: `backend/` · **Date**: 2026-09-11 · **Domains**: Financial, EET, SQLite, ESC/POS

---

## Antigravity Fix Workflow

### Recommended Models

| Task | Model | Reason |
|---|---|---|
| EET-C1 (xmlsec rewrite) | **Claude Sonnet 4.6 Thinking** | Complex multi-step crypto + XML spec reasoning |
| FIN-C1 (VAT recalc) | **Claude Sonnet 4.6 Thinking** | Financial invariant correctness needs deep reasoning |
| P1 batch (DB/EET small fixes) | **Claude Sonnet 4.5** | Surgical edits, well-scoped |
| P2 batch (encoding, cash, printer) | **Claude Sonnet 4.5** | Contained, independently testable |
| P3 micro-fixes | **Gemini Flash** | Trivial validators, index additions |

Switch model via Antigravity model selector before starting each phase.

---

### Execution Order

#### Phase 1 — Legal Blockers (P0)
> Use `/boost` then prompt: *"Fix EET-C1 from `docs/backend_audit_2026-09-11.md`"*

- **EET-C1**: Replace f-string XML construction in `services/eet_soap.py` with `lxml` + `xmlsec` for correct W3C Exclusive C14N XML-DSig. This is the highest legal exposure — MFCR rejects every submission until fixed.
- **FIN-C1**: Server-side VAT recalculation in `routers/sales.py:create_sale`. Use `/grill-me` first to lock the recalculation spec (gross-down vs net-up, per-item rounding, discount timing). Then implement.

#### Phase 2 — Data Integrity (P1)
> Use `phase-plan` skill: *"Fix all P1 issues from `docs/backend_audit_2026-09-11.md` using phase-plan"*

- **DB-C1**: Merge sequence increment + sale insert into single atomic transaction (`routers/sales.py`)
- **EET-C2**: Add `cert.not_valid_after_utc` check after PKCS#12 load (`services/eet_crypto.py`)
- **DB-H1/H2**: Replace read-modify-write stock decrements with atomic SQL `UPDATE … SET qty = qty - ?` (`routers/sales.py`, `routers/stock.py`)
- **FIN-H1**: Change `Float` → `Numeric(10,2)` on all monetary columns + migration (`models.py`, `migrations.py`)

#### Phase 3 — Correctness (P2)
> Use `phase-plan` skill: *"Fix all P2 issues from `docs/backend_audit_2026-09-11.md` using phase-plan"*

- **PRN-C1**: Replace ASCII transliteration with codepage-aware encoding (CP852 Czech, CP1258 Vietnamese) in `services/escpos_service.py`
- **PRN-C2**: Raise (don't swallow) on codepage command failure
- **PRN-H1**: Apply `@with_printer_reconnect` decorator to all print methods
- **PRN-H2**: Add CP1258 selection for Vietnamese locale
- **FIN-H2**: Replace `sum(float(...))` with `sum(Decimal(...))` in `routers/cash.py`
- **EET-H2**: Add exponential backoff + jitter to resend daemon (`services/eet_resend_daemon.py`)
- **FIN-M1**: Assert `refunded_amount <= total_amount` in refund status update
- **DB-M1/M2**: Wrap bare `db.commit()` calls in try/finally rollback guards

#### Phase 4 — Hardening (P3)
> Inline: *"Fix all P3 issues from `docs/backend_audit_2026-09-11.md`"*

- **FIN-L1**: Pydantic validator `vat in {0, 12, 21}` on `SaleItemSchema`
- **EET-M1**: Raise on network failure even in non-prod when `offline_mode=False`
- **EET-L1**: Raise on missing DIC config instead of fallback to test value
- **PRN-H3**: Cap logo base64 size before decode
- **DB-L1**: Add index on `sales.timestamp` in `migrations.py`

---

### Context Longevity — Cavecrew

For long sessions, use cavecrew to keep main context lean:
- **Investigator** → *"use cavecrew investigator: where is stock_quantity written across all routers"*
- **Builder** → *"use cavecrew builder: fix FIN-L1 from the audit doc"*
- **Reviewer** → *"use cavecrew reviewer: review the diff for Phase 2"*

### Verification Gates (run between phases)

```bash
# Backend
python -m unittest discover -s backend/tests -p "test_*.py"

# Frontend
npm run test
npm run lint
npm run build
```

EET-C1 additionally needs a new integration test against a mock MFCR SOAP endpoint — flag this when starting Phase 1.

---

---

## Executive Summary

| Severity | Count | Domains |
|---|---|---|
| 🔴 CRITICAL | 7 | Financial×2, EET×2, DB×1, Printer×2 |
| 🟠 HIGH | 7 | Financial×2, EET×2, DB×2, Printer×3 |
| 🟡 MEDIUM | 7 | Financial×2, EET×2, DB×2, Printer×2 |
| 🔵 LOW | 5 | Financial×1, EET×2, DB×1, Printer×1 |

**Top risk**: EET XML signing is non-compliant with Czech spec (string interpolation, no exc-c14n). Financial totals are trusted from client without server recalculation. Both are legal exposure.

---

## 🔴 CRITICAL

### FIN-C1 — Client-supplied totals stored without server recalculation
**File**: [`routers/sales.py:849–873`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L849-L873)

Backend persists `totalAmount` and `taxSummary` verbatim from client payload. No server-side verification that `Σ(base_price + vat_amount) == totalAmount` per Czech VAT law.

```python
db_sale = SaleModel(
    total_amount=round_currency(sale.totalAmount),  # ← trusted from client
    tax_summary=sale.taxSummary,                    # ← trusted from client
    ...
)
```

**Risk**: Client can submit any total amount. Tampered fiscal records, VAT underpayment.

---

### FIN-C2 — Completed sales directly deletable/mutable
**File**: [`routers/sales.py:1054–1067`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L1054-L1067) · [`routers/sales.py:940–949`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L940-L949)

`DELETE /api/v1/sales/{sale_id}` hard-deletes a completed fiscal sale. `PUT …/refund-status` mutates `total_amount` path in-place. Violates ledger immutability — corrections must be reverse refund transactions only.

```python
db.delete(sale)   # destroys fiscal record permanently
db.commit()
```

**Risk**: Audit trail destruction, tax fraud vector even behind admin PIN.

---

### EET-C1 — XML built via f-string interpolation (injection + invalid C14N)
**File**: [`services/eet_soap.py:55–93`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_soap.py#L55-L93)

SOAP envelope, `SignedInfo`, and `Trzba` payload assembled with Python f-strings. W3C Exclusive C14N (required by EET spec) is not applied — the signed byte stream is implementation-defined, not canonical. Any special char in store name or receipt number breaks XML.

```python
body_xml_content = (
    f'<v4:Trzba>'
    f'<v4:Hlavicka {hlavicka_attr_str}></v4:Hlavicka>'  # ← unescaped attrs
    f'<v4:Data {data_attr_str}></v4:Data>'
    f'</v4:Trzba>'
)
```

**Risk**: MFCR signature validation rejects every submission. Legal non-compliance.

---

### EET-C2 — No certificate expiration check before signing
**File**: [`services/eet_crypto.py:30–52`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_crypto.py#L30-L52) · [`services/eet_service.py:49–57`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_service.py#L49-L57)

`pkcs12.load_key_and_certificates()` succeeds for expired certs. No `not_valid_after_utc` guard after load.

```python
private_key, cert, additional_certs = pkcs12.load_key_and_certificates(
    p12_data, pwd_bytes
)
# ← no: if cert.not_valid_after_utc < datetime.now(UTC): raise
```

**Risk**: Expired-cert submissions rejected silently. Sales recorded in DB as successful while MFCR has no record.

---

### DB-C1 — Receipt sequence incremented and committed before sale insert
**File**: [`routers/sales.py:47–49`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L47-L49)

Sequence counter commit is a separate transaction from sale creation. Crash between the two leaves a permanent gap; repeated crash = replay assigns duplicate numbers to different sales.

```python
seq_obj.last_seq += 1
next_num = seq_obj.last_seq
db.commit()          # ← committed; sale insert follows in separate tx
```

**Risk**: Non-consecutive receipt numbers (illegal for EET), or duplicate numbers on retry.

---

### PRN-C1 — Czech/Vietnamese chars silently dropped (lossy ASCII transliteration)
**File**: [`services/escpos_service.py:95–114`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L95-L114)

The text sanitizer normalises to NFKD then encodes to ASCII with `ignore`, stripping all diacritics.

```python
clean = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
```

`Číšník` → `Cisnik`. Vietnamese: `Phở` → `Ph`. All diacritics silently lost on receipt.

**Risk**: Garbled receipts. Customer names, product names, VAT labels mutilated. Legal receipt requirement potentially unmet.

---

### PRN-C2 — Codepage command silently swallowed on Win32Raw/File drivers
**File**: [`services/escpos_service.py:225–229`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L225-L229)

```python
try:
    if hasattr(printer, 'charcode'):
        printer.charcode(...)
except Exception:
    pass              # ← silent; printer uses power-on default codepage
```

If the codepage ESC/POS command fails (common on Win32Raw), printer falls back to firmware default (often PC437/USA). All Czech text prints as mojibake.

**Risk**: Every Czech receipt garbled on Windows USB printers without any error signal.

---

## 🟠 HIGH

### FIN-H1 — Monetary columns declared as SQLAlchemy `Float`
**File**: [`models.py:14–19`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/models.py#L14-L19) · [models.py:51–54](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/models.py#L51-L54) · [models.py:211,218,225,263,276–279](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/models.py#L211)

```python
total_amount      = Column(Float, nullable=False)
tendered_amount   = Column(Float, default=0.0)
change_due        = Column(Float, default=0.0)
refunded_amount   = Column(Float, default=0.0)
opening_cash      = Column(Float, ...)
```

SQLite stores `Float` as IEEE 754 double. `func.sum()` aggregations drift. Must be `Numeric(precision=10, scale=2)` (maps to `DECIMAL` in SQLite) to guarantee exact storage.

---

### FIN-H2 — `sum(float(...))` accumulation in shift metrics
**File**: [`routers/cash.py:69–71`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/cash.py#L69-L71)

```python
float_in   = sum(float(m.amount) for m in movements if m.movement_type == "FLOAT_IN")
payouts    = sum(float(m.amount) for m in movements if m.movement_type == "PAYOUT")
safe_drops = sum(float(m.amount) for m in movements if m.movement_type == "SAFE_DROP")
```

Converts to float then sums. With many movements, 0.1 + 0.2 drift accumulates. Fix: `sum(Decimal(str(m.amount)) for m in ...)`.

---

### EET-H1 — Private key + plaintext password live in RAM indefinitely
**File**: [`services/eet_crypto.py:20–45`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_crypto.py#L20-L45)

```python
self.password    = password      # cleartext string in heap
self.private_key = private_key   # unzeroized RSA key object
```

Python GC doesn't zero memory. Under process crash or memory dump, key material is recoverable.

---

### EET-H2 — Static 60s retry interval, no backoff/jitter
**File**: [`services/eet_resend_daemon.py:117–125`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_resend_daemon.py#L117-L125)

```python
def run_eet_resend_loop(interval_seconds: int = 60):
    ...
    time.sleep(interval_seconds)
```

During MFCR outage, all offline POS terminals hammer the server simultaneously every 60s. No exponential backoff, no jitter.

---

### DB-H1 — Stock decrement is read-modify-write without lock
**File**: [`routers/sales.py:893–895`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L893-L895)

```python
preset = db.query(PresetModel).filter(...).first()
if preset and preset.track_stock:
    preset.stock_quantity = round((preset.stock_quantity or 0.0) - item.quantity, 3)
```

Two concurrent sales of the same item both read the same qty, both write `qty - 1`. Net effect: one decrement lost. Fix: `UPDATE presets SET stock_quantity = stock_quantity - ? WHERE id = ?`.

---

### DB-H2 — VAP/cost weighted-average update same race condition
**File**: [`routers/stock.py:71–88`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/stock.py#L71-L88)

Same read-then-write pattern on `preset.stock_quantity` and WAC calculation during stock intake. Concurrent intake of same item = inventory phantom.

---

### PRN-H1 — `@with_printer_reconnect` decorator defined but never applied
**File**: [`services/escpos_service.py:15–32`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L15-L32)

Reconnect decorator exists but is not applied to any print method. On USB disconnect mid-print, the job fails with an unhandled exception and no retry. Sale is already committed.

---

### PRN-H2 — Vietnamese requires CP1258; only CP852/CP1250 configured
**File**: [`services/escpos_service.py:227`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L227)

Language switch doesn't select CP1258 for Vietnamese. Vietnamese diacritics will be wrong characters or stripped, even if PRN-C1 is fixed.

---

### PRN-H3 — Unbounded base64 logo decode, no size cap
**File**: [`services/escpos_service.py:62–63`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L62-L63)

```python
img_bytes = base64.b64decode(raw_b64)
```

No max-size check before decode. A malformed/large logo in config can OOM the sidecar process.

---

## 🟡 MEDIUM

### FIN-M1 — `refunded_amount` not bounds-checked against `total_amount`
**File**: [`routers/sales.py:940–948`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L940-L948)

```python
sale.refund_status    = data.refund_status
sale.refunded_amount  = data.refunded_amount   # ← can exceed total_amount
```

No `assert refunded_amount <= total_amount`. Over-refunding silently recorded.

---

### FIN-M2 — Pohoda VAT export: unknown rates silently treated as 0%
**File**: [`services/pohoda_export.py:134–135`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/pohoda_export.py#L134-L135)

```python
else:
    price_none += gross    # fallthrough: any rate ≠ 21% and ≠ 12% → 0% VAT
```

Future rate (e.g. 10%) would be exported as exempt. Pohoda XML would be wrong.

---

### EET-M1 — Playground mode silently fakes success on network failure
**File**: [`services/eet_soap.py:256–270`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_soap.py#L256-L270)

```python
if self.environment != "production":
    return {"status": "EVD_OK", "pok": simulated_pok, ...}
```

Misconfigured prod deployment in "playground" mode: network errors return fake `EVD_OK`. Sales marked as sent; MFCR has no record.

---

### EET-M2 — XML attribute values not entity-escaped
**File**: [`services/eet_soap.py:55–86`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_soap.py#L55-L86)

```python
hlavicka_attr_str = " ".join([f'{k}="{v}"' for k, v in sorted(hlavicka_attrs.items())])
```

Store names or receipt numbers containing `&`, `<`, `"` break XML parsing. Should use `xml.sax.saxutils.escape()`.

---

### DB-M1 — Refund status update lacks try/except rollback
**File**: [`routers/sales.py:974`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L974)

Bare `db.commit()` without rollback guard. Partial write on exception leaves DB in inconsistent state.

---

### DB-M2 — Sale delete/purge lacks rollback guard
**File**: [`routers/sales.py:1047, 1067`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L1047)

Same pattern — `db.commit()` without `try/finally: db.rollback()`.

---

### PRN-M1 — No connection timeout on Serial/USB interfaces
**File**: [`services/escpos_service.py:207–209`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L207-L209)

Missing `timeout=` on Serial and Win32Raw constructors. A stalled printer hangs the worker thread indefinitely, blocking subsequent API calls.

---

### PRN-M2 — No printer status polling (paper out / cover open)
**File**: [`services/escpos_service.py:531–532`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L531-L532)

No DLE EOT or GS a status read before printing. Job fails mid-print with no structured error. User sees generic exception.

---

## 🔵 LOW

### FIN-L1 — VAT rate not validated against statutory tiers
**File**: [`routers/sales.py:59`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L59) · [`models.py:53`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/models.py#L53)

`vat: int = 21` accepts any integer. Add Pydantic validator: `assert vat in {0, 12, 21}`.

---

### EET-L1 — Hardcoded fallback DIC `"CZ00000019"` masks misconfiguration
**File**: [`services/eet_service.py:32`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_service.py#L32) · [`services/eet_resend_daemon.py:34`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/eet_resend_daemon.py#L34)

Missing config should raise, not silently use test DIC.

---

### EET-L2 — EET test coverage: only `_format_bkp` tested
**File**: [`tests/test_eet_crypto.py`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/tests/test_eet_crypto.py)

PKP generation, seed string, SOAP assembly, response parsing — all untested.

---

### DB-L1 — No covering index on `sales.timestamp` date range
**File**: [`routers/sales.py:582, 650`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/routers/sales.py#L582)

`func.date(SaleModel.timestamp)` filters cause full table scans. Add index on `timestamp` in migrations.

---

### PRN-L1 — ESC @ init command missing at print job start
**File**: [`services/escpos_service.py:223–229`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/backend/services/escpos_service.py#L223-L229)

No `printer.init()` (ESC @) to reset printer state before each receipt. A prior stuck job leaves printer in undefined state (bold/double-width/etc).

---

## ✅ Clean (No Issues)

| Area | Status |
|---|---|
| WAL mode, busy_timeout, foreign_keys, check_same_thread | ✅ Correctly configured in `database.py` |
| SQL injection / parameterization | ✅ All ORM, no raw f-string queries |
| Migration idempotency | ✅ `IF NOT EXISTS` throughout |
| `round_currency` / Decimal utility | ✅ `ROUND_HALF_UP`, 2 decimal places |
| EET PKP algorithm (RSA-SHA256) | ✅ Correct — `PKCS1v15` + `SHA256` |
| EET BKP format (SHA-1 of PKP → 5×8 hex) | ✅ Correct — spec-required SHA-1 |
| EET seed string format | ✅ Matches EET v4.1 spec exactly |
| EET network timeouts | ✅ `timeout=3.0` on SOAP |
| EET offline queue + FIK audit log | ✅ `is_sent_to_eet`, `EetAuditLogModel` |
| Pohoda VAT export Decimal math | ✅ `Decimal` + `ROUND_HALF_UP` |
| Printer column width enforcement | ✅ 32/48/80 char per paper format |
| VFD LCD encoding | ✅ CP852 with error replacement |
| Printer concurrency lock | ✅ `_hardware_printer_lock = RLock()` |
| QR bank code (SPD) | ✅ IBAN, CZK, variable symbol correct |

---

## Prioritized Fix List

| Priority | Issue | File | Effort |
|---|---|---|---|
| **P0** | EET-C1: Replace f-string XML with `lxml` + `xmlsec` exc-c14n | `eet_soap.py` | Large |
| **P0** | FIN-C1: Server-side VAT recalculation on sale create | `routers/sales.py` | Medium |
| **P0** | PRN-C1: Use ESC/POS codepage-aware encoding (CP852/CP1258), remove ASCII stripping | `escpos_service.py` | Medium |
| **P0** | PRN-C2: Raise on codepage command failure; log + alert | `escpos_service.py` | Small |
| **P1** | DB-C1: Wrap seq increment + sale insert in single atomic tx | `routers/sales.py` | Small |
| **P1** | EET-C2: Check `cert.not_valid_after_utc` after PKCS#12 load | `eet_crypto.py` | Small |
| **P1** | DB-H1/H2: Atomic SQL `UPDATE … SET qty = qty - ?` for stock | `routers/sales.py`, `stock.py` | Medium |
| **P1** | FIN-H1: Change Float → `Numeric(10,2)` in `models.py` + migration | `models.py`, `migrations.py` | Medium |
| **P2** | FIN-H2: Replace `sum(float(...))` with `sum(Decimal(...))` | `routers/cash.py` | Small |
| **P2** | PRN-H1: Apply `@with_printer_reconnect` to all print methods | `escpos_service.py` | Small |
| **P2** | PRN-H2: Add CP1258 selection for Vietnamese locale | `escpos_service.py` | Small |
| **P2** | EET-H2: Add exponential backoff + jitter to resend daemon | `eet_resend_daemon.py` | Small |
| **P2** | FIN-M1: Assert `refunded_amount <= total_amount` | `routers/sales.py` | Tiny |
| **P2** | DB-M1/M2: Wrap bare commits in try/finally rollback | `routers/sales.py` | Tiny |
| **P3** | EET-M1: Raise on network failure even in non-prod if `offline_mode=False` | `eet_soap.py` | Small |
| **P3** | FIN-L1: Pydantic validator `vat in {0, 12, 21}` | `routers/sales.py` | Tiny |
| **P3** | PRN-H3: Cap logo base64 size before decode | `escpos_service.py` | Tiny |
| **P3** | DB-L1: Add index on `sales.timestamp` | `migrations.py` | Tiny |
