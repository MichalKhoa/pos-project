# Himmel POS — Active Feature Roadmap for Mixed Retail Shop

**Target Audience:** Parents' Mixed Retail & Convenience Store (Smíšené zboží / Večerka)  
**Date:** 2026-09-03  
**Status:** Approved for Implementation

---

## 🎯 High-Priority Selected Features

| ID | Feature Name | Description | Benefit for Parents |
| :--- | :--- | :--- | :--- |
| **RET-01** | **Global USB Barcode Scanner Hook** | Captures fast scanner keystrokes (<50ms ending in Enter), resolves EAN to preset, and adds to cart with multiplier support (e.g. `6 * [scan]` = 6x). | Fixes current bug where scanning types 13 digits into keypad and adds fake multi-billion Kč item. |
| **RET-02** | **Unknown Barcode Quick-Add Modal** | When an unscanned/new product is scanned, shows an instant 5-second popup on the register: name, price, 1-tap "Save & Add to Cart". | No need to leave sales screen or navigate complex inventory menus when suppliers deliver new goods. |
| **RET-03** | **Fast Banknote Tender & Huge Change Display** | 1-tap banknote buttons (`100`, `200`, `500`, `1000`, `2000`, `5000 Kč`, `Přesně`), paired with massive high-contrast **VRÁTIT / TRẢ LẠI: XXX Kč** display (48px+). | Eliminates mental arithmetic errors on cash-heavy retail shifts. |
| **RET-04** | **1-Click Thermal Daily Summary Slip** | Single button in Top Bar: "Vytisknout denní tržbu". Thermal printer spits out compact 80mm/58mm ticket with Total, Cash in drawer, Card total, and customer count. | Reconciles the cash drawer at 9 PM closing in 2 minutes without confusing accounting terminology. |
| **RET-05** | **Audio Feedback & Distinct Tone Engine** | Pleasant positive beep on valid scan, loud error buzz on unknown barcode/issue, distinct cash drawer bell chime. | Immediate sensory confirmation so cashiers don't need to stare at screen during checkout. |

---

## 🔍 Detailed Specifications

### RET-01: Global USB Barcode Scanner Hook & Multiplier Resolution

#### Problem
In [`src/hooks/usePosKeyboardShortcuts.js`](file:///home/misko/Documents/pos-eet-himmel/src/hooks/usePosKeyboardShortcuts.js), all numeric keystrokes from USB barcode scanners (which emulate HID keyboards typing ~20-40ms per character followed by Enter) leak directly into the manual price input buffer. Scanning a barcoded product creates a fake "Volný prodej" item with an astronomical price (e.g. 8,594,001,234,567 Kč) instead of resolving the actual item.

#### Solution
- Implement dedicated `useBarcodeScanner` hook:
  - Buffer characters when elapsed time between keystrokes is `< 50ms`.
  - When Enter is pressed and buffer length is `>= 6` characters:
    - Prevent default keypad entry.
    - Query `presets` by `barcode` (EAN-13, EAN-8, UPC).
    - If found:
      - Quantity = `itemMultiplier || 1`.
      - Play positive audio chime (`playSuccessBeep()`).
      - Add item to cart and reset multiplier.
    - If not found:
      - Play alert buzzer (`playErrorBuzz()`).
      - Trigger `RET-02` (Unknown Barcode Quick-Add Modal).

---

### RET-02: Unknown Barcode Quick-Add Modal

#### Problem
When suppliers deliver a new beverage, snack, or household item, scanning the barcode currently fails or does nothing. Parents have to open Settings -> Inventory, manually create a preset, and return to Register.

#### Solution
- When an unrecognized barcode is scanned on the register:
  - Pop a lightweight modal directly over the register screen:
    - **Scanned Barcode:** e.g. `8594001234567` (read-only)
    - **Item Name:** Autofocused text input (e.g. "Kofola 0.5L")
    - **Selling Price:** Numeric keypad / input (e.g. "25")
    - **Default VAT:** 21% / 12% selector
    - **Action Button:** `Uložit & do košíku / Lưu & thêm vào giỏ`
  - Instantly issues `POST /api/v1/catalog/presets`, updates catalog state, and inserts item into active cart. Total transaction interruption: < 10 seconds.

---

### RET-03: Fast Banknote Tender & Huge Change Display

#### Problem
Mixed retail shops process high cash volumes (often 70-80% of sales). Tired cashiers making mental calculations for change from 500, 1000, or 2000 Kč notes frequently make change errors.

#### Solution
- In [`PaymentModal.jsx`](file:///home/misko/Documents/pos-eet-himmel/src/components/PaymentModal.jsx) / Cash payment panel:
  - Prominent quick-cash chips: `100 Kč`, `200 Kč`, `500 Kč`, `1000 Kč`, `2000 Kč`, `5000 Kč`, and `Přesně (Exact)`.
  - Massive, high-contrast, uncluttered change banner:
    ```
    ┌──────────────────────────────────────────────┐
    │  VRÁTIT / TRẢ LẠI:                  145 Kč   │
    └──────────────────────────────────────────────┘
    ```
  - Optional coin breakdown hint: `(1x 100 Kč, 2x 20 Kč, 1x 5 Kč)`.

---

### RET-04: 1-Click Thermal Daily Summary Slip

#### Problem
Parents do not want or need complex accounting software, export menus, or multi-step closure wizards. At the end of the day, they need to count the cash drawer and match it against receipts.

#### Solution
- Add a direct `Vytisknout denní tržbu` button in Navbar / Top Bar (or Cash Drawer quick menu).
- Backend endpoint: `POST /api/v1/printer/print-daily-summary` (or client format):
  - Queries today's sales from midnight to current time.
  - Formats clean 80mm/58mm thermal receipt:
    ```
    ================================================
              DENNÍ PŘEHLED TRŽEB (DNEŠEK)
              Datum: 03.09.2026 - 21:05
    ================================================
    Celková tržba (Total):              18 450 Kč
    ------------------------------------------------
    Hotovost v pokladně (Cash):         14 200 Kč
    Platby kartou (Card):                4 250 Kč
    Počet nákupů (Transactions):              142
    Průměrný nákup (Avg Sale):             130 Kč
    ================================================
    ```
  - Printer immediately cuts receipt paper; drawer kicks open for counting.

---

### RET-05: Audio Feedback & Distinct Tone Engine

#### Problem
In a busy convenience store, cashiers look at customers, cash, or the counter while scanning. If a barcode scan fails to register, the cashier may bag the item without knowing it wasn't added.

#### Solution
- Upgrade [`usePosAudio.js`](file:///home/misko/Documents/pos-eet-himmel/src/hooks/usePosAudio.js) / Web Audio API synth:
  - **Success Scan**: Short, pleasant high-frequency chime (`880Hz -> 1760Hz`, 80ms).
  - **Unknown Barcode / Error**: Double low-frequency buzz (`220Hz -> 180Hz`, 200ms) that is distinctly audible.
  - **Cash Drawer Open**: Crisp mechanical bell chime (`1200Hz`, decaying envelope).
  - Works offline with zero audio file dependencies via Web Audio synthesizer.
