# VoltFlow POS — Remaining Tasks

_Last updated: 2026-09-04 (Audit & Resolution Complete)_

---

## Status: All Remaining Tasks Resolved ✅

All previously identified translation gaps, receipt preview formatting, and diagnostics detail string localizations have been audited, implemented across `cs`, `vi`, and `en`, and verified with quality gates.

---

## Completed Tasks

### i18n — Settings Translation Parity (`src/i18n/translations.js`)
- [x] **StoreProfileSection keys** (`cs`, `vi`, `en`): `store_info`, `store_profile_desc`, `store_address_title`, `store_address_desc`, `store_finance_title`, `store_finance_desc`, `store_iban_desc`, `store_lang_desc`, `store_vat_21`, `store_vat_12`, `store_vat_0`.
- [x] **LayoutSection keys** (`cs`, `vi`, `en`): `preset_size_compact`, `preset_size_standard`, `preset_size_large`, `high_legibility_desc`.
- [x] **DiagnosticsSection keys** (`cs`, `vi`, `en`): `backend_restart_success`, `diag_printer_width`, `diag_terminal_manual_detail`, `diag_eet_mode`, `diag_eet_off_detail`, `diag_test_print_success`, `diag_drawer_open_success`, `diag_daily_summary_success`.
- [x] **TerminalSection keys** (`cs`, `vi`, `en`): `csob_manual_desc`, `csob_auto_desc`.

### Receipt Preview & Hardware
- [x] **Receipt Preview bold formatting** (`src/components/receipt/ReceiptPreviewPaper.jsx`): Conditional bold CSS applied to store name, item names, prices, total, and footer lines matching ESC/POS hardware flags (`receipt_bold_store_name`, `receipt_bold_item_names`, `receipt_bold_prices`, `receipt_bold_total`, `receipt_bold_footer`).
- [x] **Receipt QR default**: Default set to none, removed from receipt clutter.
- [x] **Store logo upload**: Canvas resize, base64 encoding, toggle, preview, Replace/Delete actions.
- [x] **ESC/POS logo printing**: Backend Pillow Lanczos scaling + 1-bit Floyd-Steinberg dithering.

### Minor Cleanup & JSX Hookup
- [x] **DiagnosticsSection.jsx**: Replaced hardcoded Czech strings (`šířka`, `Ruční zadávání částky`, `Provozní režim`, `Vypnuto`) with localized `t()` calls and fallbacks.
- [x] **DiagnosticsSection.jsx**: Localized action toast messages for test print, drawer pulse, and daily shift report.
- [x] **Quality Gates**: Frontend tests passing (80/80), ESLint clean (0 errors, 0 warnings), frontend build clean, backend unittests passing (45/45).
