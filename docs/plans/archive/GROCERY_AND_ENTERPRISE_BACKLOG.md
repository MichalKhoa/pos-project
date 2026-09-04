# Himmel POS — Future Industry & Specialized Grocery Backlog

**Scope:** Advanced Supermarket, Deli, Bakery & B2B Industry Features  
**Audience:** For future public release / commercial multi-store packaging  
**Date:** 2026-09-03  
**Status:** Backlog (Archived for future multi-tenant or food store deployment)

---

## 🏬 Specialized Grocery & Food Store Features

### 1. Vratné lahve & přepravky (Bottle & Crate Deposit Return)
- **Industry Context:** Czech beverage and beer retail with glass bottle return programs (standard Czech 3 Kč beer bottle deposit, 100 Kč beer crate deposit).
- **Functionality:**
  - Dedicated 1-tap register buttons: `Vratná láhev (-3 Kč)` and `Přepravka (-100 Kč)`.
  - Negative line items on fiscal receipt.
  - Supports cash payout when customer only returns empty glass without buying other goods.

### 2. Embedded Weight/Price Barcode Parser (Váhové čárové kódy EAN-13)
- **Industry Context:** Butcher shops, deli counters, and produce markets with counter scales printing EAN-13 barcodes starting with prefix `28` or `29`.
- **Functionality:**
  - Structure: `28 IIIII PPPPP K` (5-digit PLU identifier + 5-digit price or weight).
  - Automatically parses weight or price from barcode string without cashier manual weight entry.

### 3. Pinned Quick-Pick Fast Bar for Non-Barcode Bakery Goods
- **Industry Context:** Bakeries and pastry shops selling loose unpackaged baked goods (Rohlíky, Housky, Chléb, Koblihy).
- **Functionality:**
  - Pinned top-shelf bar with 6–10 giant photo/color tiles for instant 1-tap cart additions.

### 4. Tobacco Fixed Price Protection (Zákaz slev na cigarety)
- **Industry Context:** Regulated Czech tobacco market (§ 103 Zákona o spotřebních daních) forbidding discounts below or above the state tobacco stamp (kolek) price.
- **Functionality:**
  - `is_tobacco` preset flag exempting line items from cart-level percentage discounts.

---

## 🏢 Enterprise & Commercial POS Features

### 5. B2B Full Tax Invoice Mode & ARES REST Lookup
- **Industry Context:** Commercial suppliers and merchants issuing formal tax invoices (*Běžný daňový doklad*) over 10 000 Kč.
- **Functionality:**
  - Auto-fetches corporate billing data (company name, address, DIČ) from official Czech Business Register (`ares.gov.cz`) by 8-digit IČO.
  - Generates extended receipt header with buyer details.

### 6. Cash Float Management (Pokladní operace — Vklad a Výběr)
- **Industry Context:** Multi-employee shifts requiring strict cash drawer accountability.
- **Functionality:**
  - Opening cash float (`FLOAT_INIT`), mid-day cash in (`CASH_IN`), and bank drops/safe transfers (`CASH_OUT`).
  - Cash discrepancy calculation (manko / přebytek).

### 7. Formal Shift Closures & Z-Report / X-Report Ledger
- **Industry Context:** Accounting firms requiring formal fiscal closing sequences.
- **Functionality:**
  - Mid-shift non-destructive preview (X-Report).
  - Official end-of-shift archive locking records with sequential closing numbers (Z-0001, Z-0002...).

### 8. Customer Display Dual-Screen Idle Promotional Carousel
- **Industry Context:** Supermarket checkouts with customer-facing secondary monitors.
- **Functionality:**
  - Idle slideshow showing rotating promotional banners and specials between customer transactions.
