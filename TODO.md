# VoltFlow POS — Active Task List

_Last updated: 2026-09-05_  
_Master Roadmap: [`docs/ROADMAP.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/ROADMAP.md)_  
_Target User: Parents' Mixed Retail & Convenience Store (Smíšené zboží / Večerka)_

---

## 🎯 Immediate Priority Tasks (Real Counter Features for Parents' Večerka)

- [ ] **1. 🧾 Poslední účtenka: Rychlý dotisk & Storno (Last Receipt Quick Actions)**:
  - Top bar chip / cart footer button: `[🧾 Poslední: 145 Kč (12:34)]`.
  - 1-tap touch popover with instant `[🖨️ Vytisknout znovu]` and `[↩️ Rychlé storno]`.
- [ ] **2. 🔍 Kontrola ceny / Cenovka (Price Check Mode)**:
  - 1-tap toggle `[🔍 Kontrola ceny]` on register.
  - Scanning barcode displays large price popup with product details without inserting into active cart.
- [ ] **3. 🖨️ 1-Tap Tisk účtenky v pokladně ("Účtenku nechci" Toggle / Print On Demand)**:
  - 1-tap toggle in `PaymentModal` and register settings: `[🖨️ Tisk účtenky: ANO / NE]` to save paper rolls.
- [ ] **4. ⚡ Rychlé násobiče množství pro basy a kartony (Quick Multiplier Chips: 2×, 4×, 6×, 10×, 20×)**:
  - Quick chips above presets/keypad: 1 tap sets multiplier (e.g. `6×`), scan bottle, auto-adds 6 units and resets.
- [ ] **5. 🥖 Rychlý "Volný prodej" přímo s DPH (`+ 12% Potraviny`, `+ 21% Zboží`)**:
  - Keypad quick buttons to immediately add typed price into cart with correct VAT tier without opening modals.
- [ ] **6. 🏷️ Tisk regálových cenovek na termotiskárně (Thermal Shelf Price Tag Generator)**:
  - 1-click in Sklad / Katalog: print 80mm/58mm shelf price label on thermal printer (large bold price, name, EAN).
- [ ] **7. ⚠️ Vizuální upozornění na nízké zásoby na dlaždicích (Low-Stock Badges on Presets)**:
  - Corner badges on preset tiles when stock = `0 ks` (red) or `<= 3 ks` (orange).
- [ ] **8. 📝 Vlastní text v zápatí účtenky a otevírací doba (Custom Receipt Footer Notes)**:
  - Settings field for store opening hours or custom note printed on receipts.

---

## 💳 Close Future Features (Payment Terminals)

- [ ] **ČSOB Terminal Automated Reversals / Refunds**:
  - Automated TCP card refund/reversal command dispatch to Ingenico Move 3500 terminal.
- [ ] **SumUp Terminal Integration (SumUp Air / Solo)**:
  - Bluetooth / Cloud REST API connection for mobile or backup card acceptance.

---

## 🚀 Expansion Roadmap (Multi-Customer & Enterprise Scale)

All multi-cashier RBAC, Czech bottle deposit returns, B2B invoicing with ARES lookup, stock intake wizards, embedded scale barcodes, multi-store cloud sync, and loyalty CRM are documented in [`docs/ROADMAP.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/ROADMAP.md).

---

## ✅ Completed & Verified Capabilities

- **Park Sale / Hold Cart (`Odložit nákup`)**: Live in `ParkedCartsDrawer.jsx`.
- **Direct Cash Drawer Button (`Otevřít zásuvku`)**: Live in `Navbar.jsx` with `CashDrawerIcon`.
- **Shift Stats & Daily Summary Widget**: Live in `ShiftStatsWidget.jsx` + 1-click daily summary print.
- **Catalog Fast Search**: Live in `QuickPresetGrid.jsx` (`.preset-search-bar`).
- **Fast Banknote & Coin Breakdown Tender**: Live in `CashPaymentPanel.jsx`.
- **EET 2.0 Hardening, SQLite Safety, Inventory Ledger, Ergonomics**: Verified passing 100% quality gates (80 frontend tests, 45 backend tests, 0 lint errors).
