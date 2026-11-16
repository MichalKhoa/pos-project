# Batch B: Counter Safety — Implementation Plan

Status: APPROVED with defaults. All three phases done (see results below). F-022 hardware checks still open.
Source: [`docs/audit/FINDINGS.md`](../audit/FINDINGS.md) and [`docs/audit/FIX_RECOMMENDATIONS.md`](../audit/FIX_RECOMMENDATIONS.md) section 3.3 and 3.4.
Covers findings: F-002, F-003, F-005, F-022, F-008, F-004, F-021.

## 1. Goal

A mis-scan, a wrong unit or a stray Enter cannot record money that was not taken.

| Repro | Today | Target |
| --- | --- | --- |
| Scan a barcode while the cash payment modal is open | tendered becomes 8 593 001 234 567 Kč, Enter completes the sale | scan is ignored with a warning, the cart and the amount do not change |
| Press Enter in card, QR or split mode | sale recorded as paid | Enter does nothing outside cash |
| Manual card mode, one tap on "Dokončit" | recorded as card-paid with no check | extra step "Terminál potvrdil platbu X Kč?" |
| Tap outside the modal during a terminal charge | modal closes, sale completes later from a stale closure | modal cannot close while charging or completing |
| Weight modal, type 3-5-0 | 350 kg = 14 700 Kč, enabled | entry in grams, 350 g = 0,350 kg; weights over the limit need a second tap |
| Z-report | counted cash pre-filled with the expected amount | starts empty, close disabled until counted |

## 2. Facts from the code that shape the plan

1. **Two window listeners react to the same keystrokes.** `PaymentModal.jsx` (L178) turns digits into tendered cash and Enter into `handleComplete`. `usePosKeyboardShortcuts.js` also runs while the modal is open: it recognises the scan (keys under 70 ms apart, then Enter within 100 ms) and **adds the scanned item to the cart under the open payment modal**. `paymentModalMethod` is passed to the hook but is only used for the "Enter opens payment" shortcut. So F-002 has two halves: the amount is corrupted, and the cart changes during payment.
2. **Enter in `PaymentModal` has no guard for non-cash methods** (`else { handleComplete(); }`). Card, QR and split complete on Enter.
3. **`handleTerminalPay` builds its own payload** (no `paymentMethod`, `tenderedAmount`, `printReceipt`) from a 1 s `setTimeout`, separate from `handleComplete`. Both overlay click and the ✕ call `onClose` at any time.
4. **`WeightEntryModal` takes kilograms**, three decimals, up to 8 characters; tare buttons are grams. The scanner path (`parseScaleBarcode`) already yields kg.
5. **The undo toast is `z-index: 9998`, fixed, bottom centre**, rendered in `AppModals` for every state.
6. **`ZReportModal` L38-41 pre-fills `actualCashStr`.** `canClose` already requires a non-empty count, so emptying the prefill is enough.
7. **The cart summary adds quantities** (`Cart.jsx` L196-199), so 350 kg + 3.5 items reads "351 položek". `item_count` in translations is not used elsewhere.

## 3. Decisions needed from you (defaults in bold)

1. **Scan while a payment modal is open (F-002).** **Warn and ignore:** the scan adds nothing, a red banner "Sken během platby ignorován" shows, the amount is untouched. Alternative: add the item and close the modal. I recommend warn and ignore, because adding an item changes the amount due mid-payment.
2. **Weight unit (F-003).** **A g / kg toggle on the modal, default grams, last choice remembered on this device, plus a limit: above 25 kg the add button asks "Opravdu 350 kg?" once.** Alternatives: grams only (simplest, no kg for bulk) or kilograms only with the limit (keeps today's habit, still allows a typo up to 25 kg). The limit is a constant now; a per-item `maxWeightKg` is Batch F material.
3. **Scanner hardware.** Timing detection (50 to 70 ms) is the same heuristic the register already uses, so no new assumption. I cannot test a real scanner here. **Please check what your scanner sends (prefix, suffix, Enter or Tab, speed)** before release; it does not block the work.

Everything below uses the defaults.

## 4. Phases

Each phase is one commit with its tests. Tests first (write the failing repro, then the fix). Stop after each phase for review. The `/code-review` gate runs at `high` effort (payment and sale paths).

### Phase 1: Payment modal safety (F-002, F-022, F-005, F-008, F-004)
Files: `src/components/PaymentModal.jsx`, `src/components/payment/CardPaymentPanel.jsx`, `SplitPaymentPanel.jsx`, `CashPaymentPanel.jsx`, `src/hooks/usePosKeyboardShortcuts.js`, `src/components/app/AppModals.jsx`, `src/App.jsx`, `src/i18n/translations.js` (cs, vi, en).

1. **Scan burst detection in `PaymentModal`.** Keys under 50 ms apart count as a burst; digits in a burst never reach the tendered or split amount. Enter within 100 ms of a burst of 3+ keys is never a completion. The modal shows a warning line.
2. **`usePosKeyboardShortcuts` ignores scans while `paymentModalMethod` is set** and calls a new `onScanDuringPayment` callback; `App` shows the flash banner. The cart is not changed.
3. **Enter completes only cash, and only with an explicit amount** (tendered above 0, including after the "Přesně" button). Card, QR and split: Enter does nothing.
4. **Cap on the amount:** at most 6 digits (999 999 Kč) for tendered and split cash; the numpad stops accepting more.
5. **Escape closes the modal** (while idle) instead of clearing the amount; the "C" key still clears.
6. **F-005, busy state.** `isBusy = termLoading || completing`. While busy: overlay click, ✕, Escape and the method tabs are disabled. After an approved charge the sale is completed straight from the result handler (no 1 s timeout), through the same `handleComplete` path so the payload has `paymentMethod`, `tenderedAmount`, `printReceipt`, auth code and mask. Not in scope: a "cancel charge" action (needs a terminal cancel call; see section 6).
7. **F-022, manual card confirmation.** In manual mode (no terminal configured) and in the manual card part of split: first tap shows "Terminál potvrdil platbu {amount} Kč?" with a large "Ano, zaplaceno" and "Ne"; only "Ano" completes.
8. **F-008, cash shows the exact amount.** The "Přijato" field shows the exact amount in grey with the label "Přesně" while nothing is typed; completing with the exact amount needs one tap on "Přesně" or a typed value (see item 3).
9. **F-004, toast.** `AppModals` passes no `undoToast` while a payment modal is open.

Tests (`src/__tests__/payment_modal_safety.test.jsx`, new):
- A burst of digits plus Enter does not change the tendered amount and does not call `onCompleteSale`.
- Enter in card, QR and split does not call `onCompleteSale`; Enter in cash with a typed amount does.
- Manual card: first tap does not complete; confirm completes with `paymentMethod: 'card'`.
- While `payWithTerminal` is pending: overlay click, ✕ and Escape do not call `onClose`. After approval `onCompleteSale` is called once with the full payload.
- The keyboard hook does not call `handleAddToCart` while `paymentModalMethod` is set, and calls `onScanDuringPayment`.
- Existing payment tests in `App.test.jsx`, `receipt_return_scanner.test.jsx` and `modals.test.jsx` are updated where they relied on Enter completing a card sale.

Verify: `npx vitest run`, `npm run lint`, `npm run build`. Live: replay the F-002 repro in the browser pane (digits then Enter, fast) and confirm the sale is not completed.

### Phase 2: Weight entry (F-003)
Files: `src/components/presets/WeightEntryModal.jsx`, `src/components/Cart.jsx`, `src/i18n/translations.js`, `src/__tests__/WeightEntryModal.test.jsx`.

1. Entry unit toggle g / kg, default g, remembered in `localStorage` (wrapped in try/catch). In g the comma key is disabled and the result shows as `0,350 kg` next to the entered value. The quantity passed to the cart is still kg with 3 decimals (`toQty` rules).
2. Sanity limit: above 25 kg the add button changes to "Opravdu {n} kg? Klepněte znovu" and needs a second tap; any edit resets it.
3. Show the unit on the digit display and on the key labels.
4. Cart summary: count lines, not summed quantity ("3 položky"); weighed items count as one line. Czech plural via `Intl.PluralRules`, reusing the pattern from `ShiftStatsWidget`.

Tests: 350 in g gives quantity 0.35 and total 14.70 at 42 Kč/kg; 350 in kg gives the confirm step and does not add on the first tap; the second tap adds; toggling the unit keeps the entered number meaning right; cart summary of one weighed line plus one piece reads 2 lines.

### Phase 3: Z-report count (F-021)
Files: `src/components/cash/ZReportModal.jsx`, `src/__tests__/cash_shift.test.jsx`.

1. Counted cash starts empty. The expected cash is shown but not entered. Exception: when expected cash is 0, the field starts at 0 so a closed, empty drawer is one tap.
2. Receipt count uses the plural rule from Phase 4 of Batch A ("2 účtenky").
3. Not changed: the denomination counter helper (`utils/currencyBreakdown.js`) as an input method. It is a feature, not a fix; offered in section 6.

Tests: modal opens with an empty field and a disabled close button; typing a count enables it; zero-expected opens at 0 and is closable.

## 5. Risks

- **Scan detection can swallow a fast human.** A cashier typing 3+ digits at under 50 ms per key is not realistic on a touchscreen, but a keyboard macro or a stuck key could trigger it. The warning line tells the cashier what happened, and the touch numpad is unaffected (it does not go through keydown).
- **Behaviour changes cashiers will notice:** Enter no longer finishes card sales; Escape closes the payment modal; weight entry is grams. I will list them in the commit messages and in a short note for the shop.
- **Existing tests that relied on Enter completing a card payment** need updating; each such edit is called out in the phase result.
- **Real scanner and terminal were not tested.** Same limit as Batch A.

## 6. Left out on purpose

- A "cancel charge" action for the card terminal: needs a cancel call in the ČSOB client; separate change.
- Per-item `maxWeightKg`: Batch F.
- Denomination counter as the Z-report input helper.
- Scans while other modals are open (discount, weight, custom item) behave as today.
- A "change due too large" confirm (F-002 recommendation): the 6-digit cap and scan blocking remove the repro; a confirm dialog waits for the shared `ConfirmModal` (F-010, Batch F).
- F-011 (Batch C) and F-010 are not touched.

## Phase 1 result (done)

Files changed: `src/components/PaymentModal.jsx`, `src/components/payment/CashPaymentPanel.jsx`, `src/components/app/AppModals.jsx`, `src/hooks/usePosKeyboardShortcuts.js`, `src/i18n/translations.js` (cs, vi, en), `src/utils/scanBurst.js` (new), `src/__tests__/payment_modal_safety.test.jsx` (new, 27 tests), `src/__tests__/modals.test.jsx` (card test now confirms).

What differs from the plan:
- **No `onScanDuringPayment` callback and no flash banner.** The modal itself shows the red warning line (and plays the error chime once) because it already detects the burst; `usePosKeyboardShortcuts` just returns early while `paymentModalMethod` is set. That also stops digits typed during payment from landing in the register keypad (`keypadAmount`), a side effect the plan did not list.
- **Enter in a form field is ignored** by the payment modal (IČO field Enter used to finish a cash sale). Found while reading the listener.
- **Manual card confirmation also applies after a declined terminal charge** (any card or split-card completion without `termResult.success`), not only with no terminal configured.
- **Refund by card** shows the same wording ("Terminál potvrdil platbu"). Acceptable, not reworded.
- **Handoff failure** after an approved charge unlocks the modal and shows the error, so the cashier is not stuck.

Verified: 312 frontend tests pass (22 of the 27 new tests fail on the old code), lint clean, build ok. Live in the browser pane against a scratch backend: 13 digits plus Enter during cash payment left the modal open with the warning, the amount unchanged (greyed "4 Kč Přesně") and no sale; Enter in card mode did nothing; "Dokončit bez tisku" opened "Terminál potvrdil platbu 3.50 Kč?". Not tested: real scanner, real terminal charge (mocked in tests).

## Phase 2 result (done)

Files changed: `src/components/presets/WeightEntryModal.jsx`, `src/components/Cart.jsx`, `src/utils/cartCount.js` (new), `src/i18n/translations.js` (cs, vi, en), `src/__tests__/WeightEntryModal.test.jsx` (existing tests now opt in to kg entry; 11 new grams and limit tests), `src/__tests__/cart_count.test.js` (new, 5 tests).

- **Entry unit:** g / kg toggle next to the weight, default grams, last choice stored on the device (`weight_entry_unit`). In grams the comma key is disabled, at most 6 digits, and the converted weight shows as `= 0.350 kg`. Switching unit keeps the same weight on screen. The quantity sent to the cart is still kg (0.35).
- **Limit:** above 25 kg an amber line says to check the unit, and the add button needs a second tap ("Opravdu 350 kg? Klepněte znovu"). Editing the weight or tare asks again. Enter follows the same two steps. Exactly 25 kg needs no confirmation.
- **Not per kg:** items whose unit is not `kg` (litres and so on) keep plain decimal entry with no toggle.
- **Cart label:** pieces count by quantity, a weighed line counts as one item (`countCartItems`), so a mistyped 350 kg no longer reads "351 položek". The label uses `Intl.PluralRules` with new `cart.items_*` keys (the old text was hard-coded Czech).
- Deviation: the dot is used as the decimal mark in the kg display, as elsewhere in the modal, not a comma.

Verified: 328 frontend tests pass, lint clean, build ok. Live in the browser pane: 350 g showed `= 0.350 kg` and 14.70 Kč; after switching to kg (remembered on reopen), 350 showed the over-25 kg line, the first tap kept the modal open and relabelled the button, and the cart read "1 položka". Not tested: a real scale or touch screen.

## Phase 3 result (done)

Files changed: `src/components/cash/ZReportModal.jsx`, `src/i18n/translations.js` (cs, vi, en: `z_report.count_prompt`), `src/__tests__/cash_shift.test.jsx`.

- **Counted cash starts empty.** The expected amount is shown, but nothing is entered, and "Provést Z-Uzávěrku" stays disabled until a count is typed. Until then the banner reads "Spočítejte hotovost v zásuvce a zadejte částku." instead of a verdict, and "Fyzicky spočteno" shows a dash (it used to read "V pořádku" or "Manko -5000" on an empty field).
- **Exception:** when the expected cash is 0 the field starts at 0, so an empty drawer closes in one tap.
- **Plural:** nothing to change in the Z-report. It shows no receipt count; the "2 účtenek" the audit saw was the shift widget, fixed in Batch A. `SalesHistoryView` still prints `{n} účtenek celkem` without plural forms; not touched here.
- Existing Z-report tests now type the count first; two new tests cover the empty start and the zero-expected case.

Verified: 330 frontend tests pass, lint clean, build ok. Live against a scratch backend: with 500 Kč expected the count started blank and the close button was disabled; with an empty drawer the field started at 0 and "V pořádku (0 Kč)" showed. Not covered: the denomination counter helper (left out on purpose).

## Batch B status

All seven findings (F-002, F-003, F-004, F-005, F-008, F-021, F-022) are fixed on branch `fix/batch-a-sale-integrity`. Still open from this batch: testing with the real scanner (what it sends, how fast) and a real card terminal charge and decline.
