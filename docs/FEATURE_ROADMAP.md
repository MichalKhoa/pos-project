# Himmel POS — Future Feature Roadmap & Architecture Specifications

**Date:** 2026-09-03  
**Status:** Proposals & Architectural Blueprints  
**Target:** Retail, Hospitality & Czech Accounting Compliance Enhancements

---

## 📋 Feature Overview Matrix

| ID | Feature Name | Category | Priority | Complexity | Czech Compliance Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-01** | Cash Float Management (Vklad a Výběr) | Accounting / Cash Drawer | `P1 (High)` | Low | Critical for drawer reconciliation |
| **FEAT-02** | Shift Closures & Thermal Z-Report / X-Report | Fiscal Reports | `P1 (High)` | Medium | Official daily closure requirement |
| **FEAT-03** | B2B Full Tax Invoice Mode & ARES Lookup | Invoicing / B2B | `P2 (Medium)` | Medium | Mandatory for transactions > 10,000 Kč |
| **FEAT-04** | Embedded Price/Weight Barcode Parser (EAN-13) | Retail / Scanner | `P2 (Medium)` | Low | Standard for butcher/bakery/scales |
| **FEAT-05** | Customer Display Idle Promotional Carousel | Customer Experience | `P3 (Low)` | Low | Merchant branding / upsell |
| **FEAT-06** | 1-Click Database Restore & Snapshot Rollback | System Stability | `P2 (Medium)` | Low | Disaster recovery |

---

## 🔍 Detailed Specifications

### FEAT-01: Cash Float Management (Pokladní operace — Vklad a Výběr)

#### Problem & Context
Currently, cash sales increment running cash totals, but there is no mechanism to record:
1. **Initial Cash Float (Počáteční stav pokladny)**: The starting change placed in the drawer at the beginning of the shift.
2. **Cash In (Vklad do pokladny)**: Adding extra cash float during the day.
3. **Cash Out (Výběr z pokladny / Odvod tržby)**: Mid-day cash drops to safe or paying a delivery supplier from the drawer.
Without cash movements, the cashier cannot reconcile the actual physical cash drawer count against expected cash at the end of the day.

#### Proposed Architecture
- **Database Model**: `CashMovementModel` (`cash_movements` table)
  - `id`: String (UUID)
  - `timestamp`: DateTime
  - `type`: String (`FLOAT_INIT`, `CASH_IN`, `CASH_OUT`)
  - `amount`: Float (always positive Decimal rounded to 2 places)
  - `note`: String (e.g. "Drobné do pokladny", "Platba dodavateli pečiva")
  - `cashier_name`: String
- **API Endpoints**:
  - `POST /api/v1/cash/movement`: Record cash in, cash out, or opening float. Automatically triggers printer drawer kick.
  - `GET /api/v1/cash/summary?date=YYYY-MM-DD`: Returns:
    - `opening_float`
    - `total_cash_sales`
    - `total_cash_refunds`
    - `total_cash_in`
    - `total_cash_out`
    - `expected_cash_drawer_total`
- **Hardware Integration**:
  - Automatically prints a 58mm/80mm receipt voucher for the cashier/manager to sign and leave in the drawer.

---

### FEAT-02: Shift Closures & Thermal Z-Report / X-Report (Denní uzávěrka)

#### Problem & Context
In Czech retail operations, daily fiscal closing is standard:
- **X-Report (Průběžná uzávěrka)**: Non-destructive mid-shift snapshot of revenue, tax tiers, payment methods, and cash status.
- **Z-Report (Denní uzávěrka / Konec směny)**: Official end-of-day closure that prints a comprehensive physical thermal report, archives sales stats, and marks the shift as closed.

#### Proposed Architecture
- **Database Model**: `DailyClosingModel` (`daily_closings` table)
  - `id`: String (UUID)
  - `closing_number`: Integer (incremental sequence, e.g. Z-0001)
  - `opened_at`: DateTime
  - `closed_at`: DateTime
  - `total_revenue`: Float
  - `cash_total`: Float
  - `card_total`: Float
  - `qr_total`: Float
  - `vat_21_base`, `vat_21_tax`
  - `vat_12_base`, `vat_12_tax`
  - `vat_0_base`
  - `total_sales_count`: Integer
  - `total_refunds_count`: Integer
  - `cash_drawer_expected`: Float
  - `cash_drawer_actual`: Float (entered by cashier)
  - `discrepancy`: Float (actual - expected)
- **API Endpoints**:
  - `GET /api/v1/reports/x-report`: Generates current non-destructive report payload.
  - `POST /api/v1/reports/z-report`: Commits the closure, locks current shift records, generates sequential Z-number, and dispatches print job.
- **Hardware Output**:
  - Formatted thermal printout with VAT breakdown, transaction counts, EET status summary, and drawer count verification.

---

### FEAT-03: B2B Full Tax Invoice Mode & ARES Lookup (Daňový doklad s IČO)

#### Problem & Context
Under Czech VAT law (§ 28 ZDPH):
- Sales up to 10,000 Kč can be issued as a Simplified Tax Document (*Zjednodušený daňový doklad*).
- Sales exceeding 10,000 Kč or upon customer request require a Full Tax Document (*Běžný daňový doklad*), which must include the customer's legal company name, address, IČO, and DIČ.

#### Proposed Architecture
- **ARES Public API Integration**:
  - Endpoint: `GET /api/v1/ares/{ico}`
  - Calls official Czech Business Register: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`.
  - Cashier enters 8-digit IČO; backend auto-fetches company name, billing address, and VAT number (`dic`), caching results in SQLite to minimize external latency.
- **Database Model Updates**:
  - Add customer fields to `SaleModel`:
    - `customer_ico`: String (optional)
    - `customer_dic`: String (optional)
    - `customer_name`: String (optional)
    - `customer_address`: String (optional)
- **Receipt Template**:
  - Automatically expands receipt header to include customer's billing credentials whenever `customer_ico` is present.

---

### FEAT-04: Embedded Price/Weight Barcode Parser (Váhové čárové kódy EAN-13)

#### Problem & Context
Retail scales (used for fruit, cheese, meat, and weighed goods) print standard GS1/EAN-13 barcodes with prefixes `28` or `29`:
- Structure: `28 I I I I I P P P P P K`
  - `28` / `29`: Standard in-store price/weight prefix.
  - `IIIII`: 5-digit item identification code (PLU).
  - `PPPPP`: 5-digit price or weight (e.g. `00150` = 150g or 15.00 Kč).
  - `K`: Checksum digit.

#### Proposed Architecture
- **Barcode Resolver Utility**:
  - When scanner inputs an EAN-13 starting with `28` or `29`:
    1. Extract the 5-digit item identifier (`item_sku`).
    2. Lookup product in `PresetModel` / `catalog_presets`.
    3. Parse the embedded value (either calculated quantity = `weight / 1000` or calculated price).
    4. Automatically insert into cart with parsed quantity or price without requiring manual cashier weight entry.

---

### FEAT-05: Customer Display Idle Promotional Carousel

#### Problem & Context
When the register is between sales, the secondary customer display monitor currently shows a blank screen or a single static welcome greeting.

#### Proposed Architecture
- **Configurable Slide Deck**:
  - Add `customer_display_slides` table or JSON configuration in `StoreConfigModel`.
  - Merchants can configure image URLs or text announcement cards (e.g., "Dnes čerstvé zákusky", "Akce: Káva + Croissant 79 Kč").
- **WebSocket Synchronization**:
  - When cart is idle for > 30 seconds (`CART_CLEAR`), secondary screen transitions into carousel mode.
  - As soon as the cashier scans the first item (`CART_UPDATE`), carousel instantly fades out and displays active cart items and totals.

---

### FEAT-06: 1-Click Database Restore & Snapshot Rollback

#### Problem & Context
The system currently creates automated zip backups in `backend/backups/`, but restoring requires manual terminal operations. In case of accidental data corruption or hardware swap, a 1-click restore mechanism is critical.

#### Proposed Architecture
- **API Endpoints**:
  - `GET /api/v1/system/backups`: Returns list of available backup archives with date, size, and integrity check.
  - `POST /api/v1/system/restore`:
    1. Validates admin PIN.
    2. Takes an immediate pre-restore safety snapshot of the current DB.
    3. Closes active SQLite engine connections.
    4. Extracts selected ZIP file onto `backend/data/pos_store.db`.
    5. Runs `PRAGMA integrity_check`.
    6. Re-opens connection and returns status.
