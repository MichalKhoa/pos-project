# VoltFlow POS — Remaining Tasks

_Last updated: 2026-09-04_

---

## i18n — Translation gaps (low priority, fallbacks cover UI)

These keys are used in JSX with || 'Czech fallback' guards but have no entry in cs, vi, or en blocks.
All three language blocks need these added.

### StoreProfileSection keys (src/i18n/translations.js)
- store_info
- store_profile_desc
- store_address_title
- store_address_desc
- store_finance_title
- store_finance_desc
- store_iban_desc
- store_lang_desc

### LayoutSection keys
- preset_size_compact / preset_size_standard / preset_size_large
- high_legibility_desc

### DiagnosticsSection keys
- backend_restart_success

### TerminalSection keys missing from vi + en (exist in cs)
- csob_manual_desc
- csob_auto_desc

---

## Receipt Preview — bold formatting

src/components/receipt/ReceiptPreviewPaper.jsx does not apply bold CSS based on
receipt_bold_store_name / receipt_bold_item_names / receipt_bold_prices / receipt_bold_total / receipt_bold_footer flags.
ESC/POS already uses these. The live HTML preview needs conditional fontWeight: 800.

---

## Minor cleanup

- DiagnosticsSection.jsx: detail strings for offline terminal mode and EET disabled still hardcoded Czech (non-critical).
- TerminalSection: csob_manual_desc / csob_auto_desc missing from vi and en blocks.

---

## Completed (this session)

- [x] Receipt QR default none, removed from receipt
- [x] Store logo upload (canvas resize, base64, toggle, preview, Replace/Delete)
- [x] ESC/POS logo printing (Pillow Lanczos + 1-bit dither)
- [x] cs/vi/en settings: added ~68 new keys (backup, litestream, updates, terminal, diag, layout)
- [x] TerminalSection, BackupSection, DiagnosticsSection, StoreProfileSection, LayoutSection: full t() hookup
- [x] DiagnosticsSection: added useTranslation import
- [x] PrinterSection, SecuritySection, SettingsView SUBTABS: t() hookup (prior session)
- [x] lint 0, 80 frontend tests pass, 45 backend tests pass, build clean
- [x] Committed 66d94e5, pushed master
