# VoltFlow POS — Active Task List

_Last updated: 2026-09-10_
_Master Roadmap: [`docs/ROADMAP.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/ROADMAP.md)_  
_Target User: Parents' Mixed Retail & Convenience Store (Smíšené zboží / Večerka)_

---

## 🎯 Immediate Priority Tasks (Real Counter Features for Parents' Večerka)

- [x] **1. 🧾 Poslední účtenka: Rychlý dotisk & Storno (Last Receipt Quick Actions)**:
  - Top bar / cart header quick chip `[🧾 Poslední: 145 Kč (12:34)]` with 1-tap popover for instant re-print and storno refund.
- [x] **2. 🔍 Kontrola ceny / Cenovka (Price Check Mode)**:
  - 1-tap toggle `[🔍 Kontrola ceny]` + `F2` shortcut displaying high-contrast price & stock modal without inserting into active cart.
- [x] **3. 🖨️ 1-Tap Tisk účtenky v pokladně ("Účtenku nechci" / Print On Demand)**:
  - 1-tap dual action buttons in `PaymentModal`: `[ ⚡ Dokončit bez tisku ]` vs `[ 🖨️ Dokončit a vytisknout ]` saving paper rolls and queue speed.
- [x] **4. 🏷️ Tisk regálových cenovek na termotiskárně (Thermal Shelf Price Tag Generator)**:
  - 1-click in Sklad / Katalog: print 80mm/58mm shelf price label on thermal printer (large bold price, name, EAN).
- [x] **5. ⚠️ Vizuální upozornění na nízké zásoby na dlaždicích (Low-Stock Badges on Presets)**:
  - Corner badges on preset tiles when stock = `0 ks` (red) or `<= 5 ks` (amber).
- [x] **6. 📝 Vlastní text v zápatí účtenky a otevírací doba (Custom Receipt Footer Notes)**:
  - Settings field for store opening hours or custom note printed on receipts.

---

- [x] **7. 2-Sloupcové rozložení dlaždic a dotykový vlastní prodej (2-Column Wide Presets & Touch Custom Item Modal)**:
  - Konfigurovatelné 2-sloupcové rozložení pokladny (65–70% šířka) a dotykový dialog volného prodeje s virtuální klávesnicí.

---

## 💳 Close Future Features (Payment Terminals & Returns)

- [x] **Receipt Barcode Scanner & Line-Item Return (`Vratka ze záznamu`)**:
  - Thermal receipt Code128 scanner integration, quantity-capped line return modal (`ReceiptReturnModal.jsx`), and automatic reverse refund transaction linkage.
- [ ] **ČSOB Terminal Automated Reversals / Refunds**:
  - Automated TCP card refund/reversal command dispatch to Ingenico Move 3500 terminal.
- [ ] **SumUp Terminal Integration (SumUp Air / Solo)**:
  - Bluetooth / Cloud REST API connection for mobile or backup card acceptance.

---

## 🚀 Expansion Roadmap (Multi-Customer & Enterprise Scale)

All multi-cashier RBAC, Czech bottle deposit returns, B2B invoicing with ARES lookup, stock intake wizards, embedded scale barcodes, multi-store cloud sync, and loyalty CRM are documented in [`docs/ROADMAP.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/ROADMAP.md).

---

## ✅ Completed & Verified Capabilities

- **1-Tap Print on Demand**: Live in `PaymentModal.jsx` (`CashPaymentPanel`, `CardPaymentPanel`, `QrPaymentPanel`, `SplitPaymentPanel`).
- **Thermal Shelf Price Tags**: Live in `BarcodeLabelModal.jsx` and thermal ESC/POS label generator.
- **Custom Receipt Footer**: Live in Settings and thermal receipt print layout.
- **2-Column Wide Presets Layout**: Live in `pos-layout-two-column` and `QuickPresetGrid.jsx`.
- **Touch Custom Item Modal**: Live in `CustomItemModal.jsx` with touch numpad and Czech virtual keyboard.
- **Low-Stock Badges on Presets**: Live in `PresetTileCard.jsx` with red `out-of-stock` and amber `low-stock` chips.
- **Receipt Barcode Return Scanner**: Live in `ReceiptReturnModal.jsx` and `GET /api/v1/sales/by-receipt/{receipt_number}`.
- **Native Python Cloud Sync (S3/R2)**: Live in `cloud_sync.py` with automatic scheduler and technician diagnostics.
- **Technician Diagnostic Mode**: Live in `DiagnosticModal.jsx` and `/api/v1/system/diagnostics`.
- **Park Sale / Hold Cart (`Odložit nákup`)**: Live in `ParkedCartsDrawer.jsx`.
- **Direct Cash Drawer Button (`Otevřít zásuvku`)**: Live in `Navbar.jsx` with `CashDrawerIcon`.
- **Shift Stats & Daily Summary Widget**: Live in `ShiftStatsWidget.jsx` + 1-click daily summary print.
- **Catalog Fast Search**: Live in `QuickPresetGrid.jsx` (`.preset-search-bar`).
- **Fast Banknote & Coin Breakdown Tender**: Live in `CashPaymentPanel.jsx`.
- **EET 2.0 Hardening, SQLite Safety, Inventory Ledger, Ergonomics**: Verified passing 100% quality gates (129 frontend tests, 86 backend tests, 0 lint errors).
