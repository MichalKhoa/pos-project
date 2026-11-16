# Batch C: Receipt and Text Correctness — Implementation Plan

Status: APPROVED with defaults. Phases 1 and 2 done (see results below); Phase 3 open.
Source: [`docs/audit/FINDINGS.md`](../audit/FINDINGS.md) and [`docs/audit/FIX_RECOMMENDATIONS.md`](../audit/FIX_RECOMMENDATIONS.md).
Covers findings: F-016, F-019, F-011. One small add-on (section 5, item 3): the Czech plural on the history header.

## 1. Goal

What the customer reads, on paper and on screen, matches what was charged, and no screen shows a raw translation key.

| Repro | Today | Target |
| --- | --- | --- |
| Card sale of 3.50 Kč, receipt preview or HTML print | item line "4 Kč", total "CELKEM K ÚHRADĚ 4 Kč", VAT recap says 3,50 | item line and total show 3,50 Kč |
| Cash sale of 11.50 Kč | total "12 Kč", no rounding line, no exact subtotal | exact subtotal 11,50, line "Zaokrouhlení +0,50", total 12 |
| Split sale, tendered, change | whole koruna | 2 decimals when not whole |
| Backend down, header chip | `backend_status_connecting`, later `offline` | translated text |
| Keypad custom item modal | 5 raw keys as button titles and labels | translated text |
| Sale paid with "no print" | banner "Zaplaceno!" in both cases | banner says the receipt was not printed |

## 2. Facts from the code that shape the plan

1. **Three renderers print a receipt, and only two are wrong.** `ReceiptPreviewPaper.jsx` (L455, 482, 499 to 516) and `receiptHtmlGenerator.js` (L438 to 455) use `toFixed(0)`. The ESC/POS path in `backend/services/escpos_service.py` (L732, L765, L781 to 795) already prints 2 decimals when an amount is not whole. So the physical thermal receipt is mostly right today; the preview, the browser print and the PDF are not. The ESC/POS path still lacks the rounding line.
2. **Cash sales carry two different shapes.** The local sale (built by `buildSalePayload`) has `totalAmount` = whole koruna and `cashRounding` = difference. A sale read back from the server has `total_amount` = exact total and `cash_rounding` = difference (Batch A contract). `normalizeSale` does not touch `cashRounding`, so a receipt cannot read it today. One helper must turn either shape into `{ exact, rounding, payable }`.
3. **The Czech VAT recap is exact.** Only the lines above it round, which is why the receipt contradicts itself.
4. **`t()` returns the key string for a missing key**, so every `t('x') || 'Fallback'` in the code is dead. Changing `t()` to return `undefined` would blank other labels; adding the keys is smaller and safer.
5. **A scan of `t('…')` literals finds 13 missing keys** (the audit said 13, the count still holds): `backend_connecting`, `backend_status_connecting`, `offline` (Navbar), `keypad.return_title`, `keypad.unclassified_item`, `keypad.backspace_title`, `keypad.total_return_preview`, `keypad.total_preview` (CustomItemModal), `common.optional` (PresetModal), `common.clear` (QuickPresetGrid), `common.saving` (BarcodeLabelModal, InventoryImportModal), `common.loading` (SupplierPriceHistoryModal), `tech_logs_refresh_btn` (BackupSection; TechnicianTab already uses `settings.tech_logs_refresh_btn`). `calendar.weekdays` and `calendar.months` are arrays and exist.
6. **The success banner** (`App.jsx` L930 to 934) has `printReceipt ? 'Zaplaceno!' : 'Zaplaceno!'`. Banner `type` is `'SUCCESS'` in the banner code but `'success'` in toasts and sync messages; `CheckoutFlashBanner` only treats `'SUCCESS'` as success, so a lowercase `'success'` banner renders as an error. The strings "Zaplaceno!", "✓ Účtenka #… vytištěna" and "Zavřít" are hard-coded Czech.

## 3. Decisions needed from you (defaults in bold)

1. **Amount format on the receipt.** **Same rule as the thermal printer: whole amounts without decimals ("12 Kč"), others with two ("3,50 Kč").** Alternative: always two decimals ("12,00 Kč"). The default keeps paper and screen identical to what the printer already does. Czech comma on screen and in HTML; the ESC/POS printer keeps its current format.
2. **Cash receipt layout.** **Lines at exact prices, then "Mezisoučet 11,50", "Zaokrouhlení +0,50", "CELKEM K ÚHRADĚ 12 Kč".** The rounding line and the subtotal appear only when the rounding is not zero. Please confirm with your accountant that this wording is acceptable on a tax receipt (open item from Batch A).
3. **Branch.** PR 12 (Batch B) is still open. **Default: new branch `fix/batch-c-receipt-text` cut from the current branch, PR targeting `fix/batch-a-sale-integrity`; retarget to `master` once PR 12 merges.** Alternative: add the commits to PR 12 (larger PR, one merge).

## 4. Phases

Each phase is one commit with its tests. Tests first. Stop after each phase for review. The `/code-review` gate runs at `high` effort (Phase 1 touches receipt totals and the cash rounding amounts).

### Phase 1: Receipt amounts (F-016)

- New `src/utils/receiptAmounts.js`:
  - `formatReceiptMoney(n)`: whole amounts without decimals, others with two, Czech comma.
  - `receiptTotals(sale)`: returns `{ exact, rounding, payable }` from either sale shape. For card, QR and split: `payable = exact`, `rounding = 0`. For cash: `payable` is the whole-koruna amount (`roundCashTotal` from `tax.js`), `rounding = payable - exact`, with `exact` read from `cashRounding` or `cash_rounding` when the stored total is already whole. Refunds use the same rule with the sign kept.
- `ReceiptPreviewPaper.jsx` and `receiptHtmlGenerator.js`: item lines, total, split parts, tendered and change use the helpers; add the subtotal and rounding lines for cash.
- `escpos_service.py`: add the same subtotal and rounding lines for cash (Python mirror of the helper, a small function with a unit test). Item and total formats stay as they are.
- Tests: `receiptAmounts.test.js` (both sale shapes, cash 11.50, 3.50 card, 12.00 cash with no rounding, a cash refund, split); render tests for the preview and the HTML generator (card 3.50, cash 11.50, split); a backend test for the rounding line.
- Live check: preview a 3.50 card receipt and an 11.50 cash receipt in the browser pane; print path with the thermal printer stays untested (no hardware).

### Phase 2: Missing translation keys (F-019)

- Add the 13 keys in cs, vi and en (`common.*`, `keypad.*`, top-level `backend_connecting`, `backend_status_connecting`, `offline`, `tech_logs_refresh_btn`). Point `BackupSection.jsx` at `settings.tech_logs_refresh_btn` instead of adding a duplicate.
- Drop the dead `|| 'fallback'` text where the key now exists, only on the lines touched.
- New Vitest `src/__tests__/translation_keys.test.js`: scans `src/**/*.jsx?` for `t('literal')` calls, ignores `${}` and non-literal keys, and fails on any key missing from `translations.cs`; a second test checks cs, vi and en hold the same key set. Both fail on today's code.
- Tests also cover the Navbar chip text in the offline and connecting states.

### Phase 3: Checkout banner (F-011) and plural header

- `App.jsx`: one banner enum (`'SUCCESS'`, `'WARNING'`, `'ERROR'`, uppercase), message from `t('payment.paid')` or `t('payment.paid_no_print')` ("Zaplaceno, účtenka se netiskne"), the printed-receipt message through `t()` too. `CheckoutFlashBanner` reads the same enum and translates its two default texts and the close title.
- Unify the lowercase `'success'` banner calls in `App.jsx` and `useOfflineSync.js` that go through `setFlashBanner` (toasts with their own enum stay as they are; the audit trail in the test list confirms which is which).
- Add-on: `SalesHistoryView.jsx` L348 uses the `cart.items_*` plural pattern for "účtenka / účtenky / účtenek celkem" (new keys `shift_stats.receipts_one/few/many/other`).
- Tests: banner text for print and no-print, `'success'` banner renders as success, plural forms for 1, 2, 5, 11.

## 5. Risks and what stays out

1. **Reprints of old sales.** Sales saved before this change have whole-koruna `totalAmount` for cash with no `cashRounding` stored locally; the helper then shows no rounding line (it cannot know the exact total). That is the same as today, not worse.
2. **Receipts already printed stay as they were.** Nothing here changes stored data.
3. **Left out:** the rest of F-023 (hard-coded Czech in `ReceiptPreviewPaper.jsx` labels, tax report and inventory modals; Batch F), the whole-koruna amounts in `RefundModal`, `Cart` last-receipt chip, `DiscountModal` and `CustomerDisplayView` (display only, not a document; list them as a follow-up if you want them aligned), the ESC/POS item and total format (already correct), and a lint rule against new missing keys beyond the test.
4. **Not testable here:** a real thermal printer and paper width. The ESC/POS change is covered by a unit test of the text it writes, not by paper.

## 6. Phase 1 result

Done on branch `fix/batch-c-receipt-text`.

- New `src/utils/receiptAmounts.js` (`formatReceiptMoney`, `receiptTotals`) and its Python mirror `receipt_totals` in `escpos_service.py`.
- `ReceiptPreviewPaper.jsx` and `receiptHtmlGenerator.js` (80 mm and 58 mm roll): item lines, total, split parts, tendered and change use the helper. Cash sales with a non-zero rounding get "Mezisoučet" and "Zaokrouhlení" lines above the total; the total is what the customer pays.
- ESC/POS prints the same two lines for cash and now prints the payable total for a sale in the server shape (exact total plus `cash_rounding`), which it would have shown as 11.50 instead of 12.
- Added beyond the plan: the cart's "Poslední: 4 Kč" chip and the last-receipt item rows used `toFixed(0)` too, so a 3.50 Kč sale read "4 Kč" on the register screen. They use the helper now.
- Tests: `receipt_amounts.test.js` (14 tests with the preview file), `receipt_preview_amounts.test.jsx`, a chip test in `price_check_and_last_receipt.test.jsx`, `backend/tests/test_receipt_totals.py` (9 tests). The new render tests failed before the change.
- Live check in the browser pane: a 3.50 Kč card sale shows 3,50 Kč on the line and the total. The cash layout with a rounding line is covered by render tests only, not looked at on screen.
- Gates: 345 frontend tests, lint, build and 213 backend tests pass.
- Review (high): one finding fixed (a trivial `_money` wrapper). One skipped: the A4 invoice total (`receiptHtmlGenerator.js`, A4 branch) still prints `totalAmount.toFixed(2)`, so a cash A4 invoice shows 12.00 above lines summing to 11.50 with no rounding line. Open for a decision, because an invoice may need different wording than a receipt.
- Known, not mine: `cash_shift.test.jsx` has an unhandled error (`closedReport.shift.expected_cash` undefined in the test mock). It also occurs without this change.
- Not tested: real thermal printer and paper width.

## 7. Phase 2 result

Done on branch `fix/batch-c-receipt-text`.

- New `src/__tests__/translation_keys.test.js`: every literal `t('…')` key in `src/` must exist in Czech, and cs, vi and en must hold the same keys. The first test failed on 16 call sites before the fix.
- Seven of the 13 keys already existed under another path, so the call sites changed instead of adding duplicates: Navbar now uses `settings.backend_connecting`, `settings.backend_status_connecting` and `nav.offline`; BackupSection uses `settings.tech_logs_refresh_btn`.
- New keys in cs, vi and en: `keypad.backspace_title`, `keypad.total_preview`, `keypad.total_return_preview`, `common.optional`, `common.clear`, `common.loading`, and `common.processing` (replaces `common.saving` in the label print and import buttons, which meant "working", not "saving").
- A custom keypad item added without a name was stored in the cart as the raw key `keypad.unclassified_item`. The name is saved with the sale and printed on the Czech receipt, so it is now the plain Czech text "Volný prodej" (and "Vratka / Vrácené zboží" for a return), not a translated key.
- The dead `|| 'fallback'` text is removed on the touched lines only; other dead fallbacks on keys that exist stay.
- Live check: the header chip reads "Připojování..." while connecting and "Offline" afterwards, with matching tooltips.
- Gates: 347 frontend tests, lint and build pass. Review (high): no findings. The `cash_shift.test.jsx` unhandled error from Phase 1 is still there and unrelated.
- Not covered: keys built from a variable or template string (`t(\`a.${x}\`)`) are not scanned.
