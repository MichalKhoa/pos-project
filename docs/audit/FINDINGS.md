# VoltFlow POS — UI/UX/Workflow Audit: Findings Log

Plan: [`docs/plans/UI_UX_WORKFLOW_AUDIT_PLAN.md`](../plans/UI_UX_WORKFLOW_AUDIT_PLAN.md)
Started: 2026-11-16. Environment: Linux, Vite dev (localhost:5173), FastAPI backend with throwaway data dir, built-in browser at 1366x768 (no real touch, no hardware).

Severity: S1 blocker (money/data loss, wrong amount), S2 major, S3 minor, S4 polish.
Status per finding: VERIFIED (reproduced live), CODE (seen in code only, not reproduced), HW (needs real hardware/device).
"Recommendation" lines are suggested fix approaches for the later fix plan; no code was changed.

---

## Phase log

### P0 Setup and baseline — DONE
- `npm ci` OK. `npm run lint` clean (0 warnings). `npm run test`: 33 files, 216 tests pass. (CLAUDE.md still says 78 tests; stale.)
- Backend venv created in `backend/venv` (gitignored), requirements install OK on Python 3.15. `unittest discover`: 186 tests pass. (CLAUDE.md says 45; stale.)
- Backend run with `POS_DATA_DIR` pointing to a scratch folder, so no real store data touched. Vite dev server on :5173.
- Side effect: `.gitignore` shows modified and `.projectmem/` untracked; both come from the projectmem hook, not from this audit.

### Phase status summary
| Phase | Status | Result |
| --- | --- | --- |
| P0 Setup | DONE | Environment and baselines recorded above |
| P1 Flow mapping | DONE (critical flows) | [`flow-maps.md`](flow-maps.md); coverage list shows what was not mapped |
| P2 Live walkthrough, critical flows | DONE for W2, W3, W5 (manual mode), W11 (popover), W14 (open and inspect) | F-001 to F-004, F-008, F-015, F-016, F-021, F-022 |
| P3 Live walkthrough, other screens | PARTIAL: Katalog, Historie, Nastavení, navigation, 1024 and 375 px layouts | F-007, F-017, F-018, F-020 |
| P4 Failure paths | PARTIAL: backend down during a sale; no printer, terminal or scanner hardware | F-014 |
| P5 Static and visual | DONE for i18n parity, missing keys, hard-coded text, inline styles, a11y counts | F-009, F-019, F-023, F-024 |
| P6 Synthesis | DONE | [`FIX_RECOMMENDATIONS.md`](FIX_RECOMMENDATIONS.md) |
| Batch A planning and Phase 0 | DONE | F-027, F-028 found while building the shared sale fixtures; both are covered by known-bug markers in the tests |
| Batch A fixes (branch `fix/batch-a-sale-integrity`) | DONE | F-001, F-012, F-014, F-015, F-026, F-027, F-028 fixed with tests; see the Batch A plan for the results and what stays open |
| Batch B fixes (same branch) | DONE | F-002, F-003, F-004, F-005, F-008, F-021, F-022 fixed with tests; see the Batch B plan |
| Batch C fixes (branch `fix/batch-c-receipt-text`) | DONE | F-016, F-019, F-011 fixed with tests; see the Batch C plan |
| Batch G security (branch `fix/batch-g-security`) | DONE | No default PIN, two toggleable locks, recovery code instead of PUK, master key only from the environment; audit item C1 stays open; see the Batch G plan |
| Batch D fixes (same branch) | PARTIAL | F-017, F-029, F-030 fixed with tests (Batch D and D2 plans); F-031 and F-032 are layout findings left for Batch E |
| Batch F fixes (same branch) | PARTIAL | F-010, F-013 (navbar), F-024 (button types, dialog guard), F-025 fixed with tests; F-009 and F-023 only for the dialog screens; see the Batch F plan |
| Batch E fixes (same branch) | DONE | F-007, F-018, F-020, F-031, F-032 fixed with tests; touch PC only, see the Batch E plan |
| P7 Owner review | PENDING | Needs the owner, see open questions in the plan |

Not tested: real touch input, real hardware, W4, W6 to W10, W12, W13, W16 to W18, W20 to W22.

### P1 Flow mapping from code
Read: `App.jsx` (state, checkout, refund, sync), `PaymentModal.jsx` + panels list, `usePosKeyboardShortcuts.js`, `useAutoLock.js`, `LockScreenModal.jsx` (partial), `Navbar.jsx` (action scan), `posApi.createSaleBackend`.

Checkout flow as implemented (W2):
1. Tap preset / scan -> `handleAddToCart` -> cart state.
2. Tap Hotovost or Karta/QR -> `PaymentModal`.
3. `handleComplete` -> `App.handleCompleteSale`: assigns receipt number CLIENT-side, builds sale, clears the cart and shows "Zaplaceno!" immediately (optimistic), then POSTs to `/sales/` in the background.
4. Backend result only enriches the sale (FIK/PKP). On failure there is only a `console.warn`; the UI shows success either way.
5. Receipt prints directly, or falls back to the preview modal.

---

## Findings

### F-001 [S1] Every non-integer cash sale is rejected by the backend, and the UI hides it — VERIFIED
- Where: `src/App.jsx` `handleCompleteSale` (cash rounding), `backend/routers/sales.py` ~L939 (FIN-C1 total check), `src/api/posApi.js` `createSaleBackend`.
- Repro: add items totalling 11.50 Kč, pay cash. Client sends `totalAmount: 12` (rounded to whole koruna, `cashRounding: 0.5`); server recomputes 11.50 and returns `422 TOTAL_MISMATCH {client_total: 12, server_total: 11.5}`. `createSaleBackend` catches it and returns `null`. UI still shows "Prodej Dokončen", prints a "DAŇOVÝ DOKLAD č. 2026-00000x", clears the cart.
- Effect: the sale never reaches the DB, Z-report, stock, EET or cloud sync. It lives only in the browser's localStorage (last 50). No pending-sync badge appeared. Every cash sale with a fractional total (most real baskets, e.g. 42 Kč x 0.35 kg) is affected. Backend log showed two 422s in two cash sales.
- Why tests missed it: backend tests send consistent totals; frontend tests mock the API.
- Recommendation (two parts, both needed):
  1. Contract fix: server must accept `client_total == round(server_total)` when `paymentMethod == cash` (or accept `cashRounding` and compare `client_total - cashRounding`), and store both the exact total and the rounding. Add a backend test for 11.50 -> 12.
  2. Failure handling: never show success on a rejected sale. Treat 4xx as "sale not recorded": keep the cart (or restore it), show a blocking error with a retry, or mark the sale `FAILED_SYNC` and surface it in the sync badge. Only network errors should go to the offline queue.

### F-002 [S1] Barcode scan while the payment modal is open writes the barcode into the cash amount and Enter completes the sale — VERIFIED
- Where: `PaymentModal.jsx` global `keydown` listener (digits -> `handleNumpadKey`, Enter -> `handleComplete`); scanner detection in `usePosKeyboardShortcuts.js` is skipped or bypassed for this case.
- Repro: open cash payment, simulate scanner (digits `8593001234567` then Enter). Tendered became 8 593 001 234 567 Kč, change due 8 593 001 219 863 Kč, sale completed, receipt printed with those values.
- Same listener makes Enter complete card, QR and split sales with no terminal approval (the card panel has a "manual card" completion path, so Enter = "card paid").
- Recommendation: in the modal, ignore key events arriving faster than ~50 ms apart (scanner burst) or route them to a "scan during payment" warning; cap tendered amount (e.g. <= 10x total, max 6 digits) and block completion when change due exceeds a sane limit with a confirm; Enter completes only in cash with an explicit tendered value, never for card/QR/split; Escape should close or cancel, not clear the amount.

### F-003 [S1/S2] Weight entry accepts 350 kg when the cashier means 350 g — VERIFIED
- Where: `WeightEntryModal.jsx` (digit entry is in kg, tare buttons are in g).
- Repro: tap a weighed item, type 3-5-0. Shows `350 kg`, price 14 700,00 Kč, "Vložit do košíku" is enabled, item added, cart total 14 703,50 Kč, cart label reads "351 položek".
- Recommendation: switch to grams as the entry unit (display `0,350 kg` as the result), or add a sanity guard (e.g. confirm above 20 kg or above a per-item max weight); show the unit on the key labels; do not count kilograms as "položek" in the cart summary.

### F-004 [S2] Undo toast covers the payment buttons — VERIFIED
- After adding an item, the "Přidáno: … ZPĚT" toast stays on top of the payment modal and overlaps the "Dokončit bez tisku" button for several seconds.
- Recommendation: dismiss the toast when a modal opens, or give modals a higher z-index and offset toasts.

### F-005 [S2] Payment modal closes on outside tap, including while a card terminal charge is running — CODE
- `PaymentModal.jsx`: overlay `onClick={onClose}`; `handleTerminalPay` then calls `onCompleteSale` from a 1 s `setTimeout` on a possibly unmounted modal with a stale cart closure.
- Recommendation: disable overlay-close and the X while `termLoading` or after a successful charge; complete the sale from the result handler without the 1 s delay, or keep the modal in a "completing" state; add a "cancel charge" action with clear outcome.

### F-006 [S3] Sale numbering proposed in the browser — CODE (severity lowered after reading the code again during Batch A planning)
- `handleCompleteSale` computes the next receipt number from local `salesHistory` + localStorage. When the backend is reachable, the receipt is printed AFTER the POST returns and carries the server's number, so the earlier worry (printed number differs from stored number) only applies to the offline path: an offline sale prints the client number, and on replay the server reassigns it only if it collides with an existing one.
- Recommendation: let the server assign the number before printing (await the POST, print the number the server returned), with an offline fallback prefix that is reconciled later.

### F-007 [S2] Cart summary and header are too tight at 1366x768 — VERIFIED
- Cart title collapses to "N" with the count badge ("351"), the item row for a weighed item wraps the price to two lines, and the first screen shows eight icon-only navbar buttons with tooltips only (tooltips do not exist on touch).
- Recommendation: give the cart column a minimum width or reduce padding; put labels under the primary navbar actions or group the secondary ones into one labelled "Více" menu.

### F-008 [S3] Cash panel shows "Přijato 0 Kč / Vrátit 0 Kč" and still lets you complete — VERIFIED
- Completing with no amount entered silently means "exact amount". Fast, but the screen never says so.
- Recommendation: pre-fill the exact amount in the "Přijato" field (grey), or show "Přesně" as the active state.

### F-009 [S2] Hard-coded Czech text outside the translation system — CODE
- Counts of `t('…')` calls are low in several files (e.g. `App.jsx` 4, `InventoryView.jsx` 6, `PaymentModal.jsx` 8). Examples: mobile tab labels "Klávesy / Produkty / Košík", all `flashBanner` messages, B2B form labels, navbar tooltips, `window.confirm` and `alert` strings (17 call sites).
- The store languages are CZ, VI and EN; the VI cashier sees Czech in these places.
- Recommendation: run a string-extraction pass: lint rule or a script that flags Czech diacritics in JSX outside `translations.js`; migrate by screen starting with Register and Payment.

### F-010 [S2] Native `window.confirm` / `alert` for destructive and error actions — CODE
- 17 call sites (delete preset, delete sale, delete ALL sales, reset data, CSV errors, refund validation). Native dialogs look foreign in kiosk mode, are tiny on touch, cannot be translated by the app, and the browser can suppress them.
- `handleClearAllTestSales` calls `purgeAllSalesBackend()` behind a single `confirm`; check it is gated by admin and hidden in production (see P3).
- Recommendation: one shared `ConfirmModal` with large buttons, a typed word for irreversible actions ("SMAZAT"), and an undo toast where possible.

### F-011 [S3] Dead ternary and inconsistent banner types — CODE
- `message: printReceipt ? 'Zaplaceno!' : 'Zaplaceno!'` (same text both ways) and banner `type` mixes `'SUCCESS'` and `'success'`.
- Recommendation: unify type enum, and show "Zaplaceno, bez tisku" when printing was skipped so the cashier knows.

### F-012 [S2] Lock screen falls back to default PIN `1234` when the backend is unreachable — CODE
- `LockScreenModal.jsx`: `storeConfig?.cashierPin || '1234'`; `cashierPin` is stripped from localStorage on save, so the fallback is effectively always the default.
- Recommendation: when the backend is offline, keep the last verified PIN hash locally (not the raw PIN) and verify against it; never fall back to a fixed default.

### F-013 [S3] No tooltips on touch; many icon-only buttons — CODE/VERIFIED
- Navbar uses `title=` for the meaning of most buttons (theme, font size, sound, print daily summary, lock). Only ~41 `aria-`/`role=` hits across all components.
- Recommendation: accessible names on all icon buttons (`aria-label`), visible labels on the five most used.

### F-014 [S1] A sale made while the backend is down is never sent later — VERIFIED (root cause 2 of F-001)
- Where: `src/api/posApi.js` `normalizeSale` (defaults `eet_status` to `'EVD_OK'`), `src/hooks/useOfflineSync.js` L72 (retries only sales with `OFFLINE_PENDING` or `is_sent_to_eet === false`), `App.handleCompleteSale` (a `null` response from `createSaleBackend` changes nothing).
- Repro: stop the backend, sell a 3.50 Kč item by card. Receipt "DAŇOVÝ DOKLAD č. 2026-000003" prints/previews, header shows a small "offline" chip, no pending badge, sale stored locally as `EVD_OK`. Restart backend: 0 POSTs, DB still empty. The sale is only in the browser's localStorage, and localStorage keeps just the latest 50.
- Recommendation: when `createSaleBackend` returns `null` (network error) mark the sale `OFFLINE_PENDING` before it enters history; retry on `pos:backend-online` with the idempotency key already used by the backend; show "Uloženo offline – čeká na odeslání" in the success banner and keep a persistent badge (count) on the navbar. Persist the queue in IndexedDB rather than the 50-item localStorage window. Add a frontend test: POST fails -> sale appears in pending queue -> backend returns -> sale is sent once.

### F-015 [S1/S2] Two sources of truth for the day's revenue — VERIFIED
- Register shift widget read "Tržba 14 716 Kč, 2 účtenky" (from browser state) while Z-report showed "Tržba v hotovosti +0 Kč" and Historie showed "Tržba 0,00 Kč, 0 účtenek" (from the backend). A cashier would close the shift against a Z-report that omits those sales.
- A direct effect of F-001/F-014, but the design problem stays after those are fixed: UI aggregates from `salesHistory` in React state, Z-report from the DB.
- Recommendation: make the shift widget read a server summary endpoint (same query as the Z-report) and refresh after each sale; show an "unsynced: N sales, X Kč" line separately. Block Z-report closing while unsynced sales exist (or list them in the report).

### F-016 [S2] Receipt shows whole-koruna amounts for item lines and totals — VERIFIED (preview), CODE
- `ReceiptPreviewPaper.jsx` L455/482 and `receiptHtmlGenerator.js` L438+ use `toFixed(0)`. A 3.50 Kč roll shows "4 Kč" per line and "CELKEM K ÚHRADĚ 4 Kč" on a card payment where 3.50 Kč was charged, while the VAT recap on the same receipt says "Brutto 3,50". A fiscal receipt with inconsistent totals is a compliance and customer-dispute risk.
- Recommendation: show 2 decimals everywhere except the explicit "Zaokrouhlení" line for cash; the printed total for cash = rounded amount, plus the exact subtotal and the rounding line. Add a snapshot test per payment type (card 3.50, cash 11.50, split).

### F-017 [S2] Inventory ("Sklad") view is unreachable — CODE + VERIFIED (navbar has 5 tabs)
- `App.jsx` still renders `InventoryView` for `activeTab === 'inventory'`, but nothing calls `setActiveTab('inventory')`; the navbar tab was removed in commit `73f37c9` ("streamline navbar tabs"). Stock intake, write-off, physical inventory, CSV import, deposit packaging, stock ledger, tax reports all live only there.
- Roadmap lists these as done, but a cashier/owner cannot open them.
- Recommendation: decide intentionally: (a) restore a "Sklad" tab (admin-gated), or (b) move the entry points into Katalog as a toolbar ("Příjem", "Inventura", "Odpis") and delete the orphan route. Add a test that every top-level view is reachable from the navbar.

### F-018 [S2] Mobile and tablet layouts are broken or clipped — VERIFIED
- 375x812: cart and catalog are both visible and clipped on the right (total and "Karta" button cut off); the tab bar (`.mobile-pos-tabs`, `.mobile-pos-tab`) has no CSS at all, so "Produkty / Košík" render as raw default buttons at the top right. `.mobile-hidden` is styled only for `.pos-col-left/center/right` (three-column mode), not for the default two-column `pos-col-presets/pos-col-cart`.
- 1024x768: catalog toolbar overflows (search field hidden, "Kontrola ceny" cut off), horizontal scrollbar inside the presets box; cart title shrinks to "N…".
- `index.html` viewport meta disables zoom (`maximum-scale=1, user-scalable=no`), an accessibility issue for low-vision users.
- Recommendation: decide the supported device matrix first (open question 1 in the plan). If tablets are supported: add the missing CSS, extend `.mobile-hidden` to the two-column classes, wrap the catalog toolbar, and allow zoom. If mobile is not supported: remove the mobile mode code and tab bar.

### F-019 [S2] 13 translation keys used in code do not exist; one leaks to the screen — VERIFIED
- `t('backend_status_connecting')` and `t('offline')` in `Navbar.jsx` (no namespace) return the raw key; the `|| 'Připojování...'` fallback never fires because `t` returns the key string. Seen live: header chip read `backend_status_connecting`, later lowercase `offline`.
- Other missing keys: `keypad.return_title`, `keypad.unclassified_item`, `keypad.backspace_title`, `keypad.total_return_preview`, `keypad.total_preview` (CustomItemModal), `common.optional`, `common.clear`, `common.saving`, `common.loading`, `tech_logs_refresh_btn`.
- Good news: CZ, VI and EN each hold exactly 1 251 keys with no gaps between them.
- Recommendation: add the 13 keys; make `t()` return `undefined`/log in dev for a missing key so fallbacks work; add a Vitest that scans `t('…')` literals against `translations.cs` (the script used here is a 10-line starting point).

### F-020 [S2] Touch targets and text size below POS guidelines — VERIFIED (measured at 1366x768)
- Navbar tabs are 34 px high (target >= 48). On the Historie tab 26 interactive elements are under 40 px; the language selector is 32 px; clock and status text are 8.7 to 10.4 px.
- Recommendation: raise the navbar tab height to 48 px, set a global minimum `min-height: 44px` on `button` in touch mode (tokens.css), keep 12 px as the lowest text size, and use the existing A+ font-size cycle (`cycleFontSize`) as default "L" for a counter screen.

### F-021 [S3] Z-report closing: counted cash is pre-filled and closing has no second check — CODE + VERIFIED
- `ZReportModal.jsx` L36 pre-fills the counted amount with the expected amount "for 1-tap confirmation", so a cashier can close the shift without counting and the report shows "V pořádku". One blue button then closes and prints.
- Recommendation: start empty, disable the close button until a count is entered (the button already supports this at L524), and offer the denomination counter (`utils/currencyBreakdown.js` exists) as the count helper. Keep the one-tap path only for a zero-expected drawer.
- Related polish: "2 účtenek" should be "2 účtenky" (Czech plural rules; use `Intl.PluralRules`), the "Zrušit" button uses a monospace font unlike other buttons.

### F-022 [S3] Card payment in manual mode: a single tap records "paid by card" — CODE + VERIFIED
- With no terminal configured the panel explains "zadejte částku ručně na terminálu" and offers "Dokončit". Nothing asks whether the terminal approved. Combined with F-002 (Enter key), a sale can be recorded as card-paid with no payment.
- Recommendation: in manual mode show a confirmation step "Terminál potvrdil platbu 3,50 Kč?" with a large Yes and No; optionally store a manual reference number.

### F-023 [S3] Hard-coded Czech is concentrated in specific files — CODE (extends F-009)
- Files with many diacritic lines and few `t()` calls: `ReceiptPreviewPaper.jsx` (56 lines / 1 call), `TaxReportsModal.jsx` (42 / 2), `PhysicalInventoryModal.jsx` (36 / 2), `DepositPackagingModal.jsx` (35 / 3).
- Recommendation: migrate these first; they sit in flows the VI-speaking cashier may use.

### F-024 [S4] Styling debt makes consistent UI hard — CODE
- 2 553 inline `style={{…}}` objects in components, 315 hard-coded hex colors in JSX despite `tokens.css`, 489 `<button>` without `type`, and 41 `aria-`/`role` attributes total. Examples of the cost: the B2B bar in the payment modal uses inline styles with 40 px inputs while the rest of the modal uses classes.
- Recommendation: do not rewrite. Add an Oxlint rule or a CI grep that blocks new hex colors and new inline styles in components; fix the buttons' `type` with a codemod; apply tokens when touching a file.

### F-025 [S3] B2B invoice fields have no on-screen keyboard — CODE
- IČO, name, DIČ and address are plain text inputs in `PaymentModal.jsx`. Cash entry has a numpad, but a touchscreen kiosk without a physical keyboard has no way to type these. ARES lookup helps only after the IČO is typed.
- Recommendation: reuse the existing touch keypad for IČO (digits only) and the Windows touch keyboard hint (`inputmode="numeric"` for IČO); move B2B out of the payment bar into a "Faktura / IČO" button that opens a dedicated step.

### F-026 [S3] Refund of a sale that never reached the backend — CODE (depends on F-001/F-014)
- `handleProcessRefund` updates the original sale's refund status on the backend by id. Sales lost per F-001/F-014 do not exist there, so storno/refund can fail silently, and `createSaleBackend(stornoSale)` result is only used if `SUCCESS`.
- Recommendation: after F-001/F-014 are fixed, show backend errors in the refund flow and block "Rychlé storno" for sales that are not yet confirmed by the backend.

### F-027 [S1] Fractional quantities are truncated to 0, so a 0.35 kg sale is recorded as 0 Kč — VERIFIED (found while planning Batch A)
- Where: `src/utils/tax.js` `calculateItemLineGross` uses `parseInt(item.quantity)`; `src/api/posApi.js` `normalizeSale` uses `parseInt(item.quantity)` (also `remainingQuantity`, `refundedQuantity`). The cart itself keeps floats (`useCart.js` rounds to 3 decimals), so the cashier sees and charges 14.70 Kč.
- Repro (replayed the exact client pipeline in Node and POSTed it to the real backend): cart `Jablka Gala 42 Kč x 0.35 kg` -> client `finalGrandTotal 0`, item `quantity 0` -> backend answers `SUCCESS` (server recomputes 0, so no mismatch) -> DB row has `total_amount 0.0`, item `quantity 0.0`, stock not deducted. The customer paid 14.70 Kč and the ledger, Z-report, VAT and stock all say 0.
- This is the main use case of the weighed-item feature (anything under 1 kg, and every scale barcode). It is separate from F-001 and is not caught by the server check because both sides use the same wrong quantity.
- Why tests missed it: `tax_calculations.test.js` uses integer quantities; the backend decimal-quantity tests send fractional quantities directly.
- Recommendation: replace `parseInt` with `parseFloat` (round to 3 decimals) in the three places; add tests with 0.35 kg, 1.250 kg and a scale-barcode basket on both sides. Server guard: reject a sale line with `quantity == 0`, and reject a non-refund sale with total 0 and positive `tenderedAmount` ("ZERO_TOTAL"). Add a one-time check for already stored sales with `total_amount = 0` or item `quantity = 0` (list them for the owner; do not auto-fix).

### F-028 [S3] Server and client disagree by 0.01 Kč on VAT split for some prices — VERIFIED (found while building Phase 0 fixtures)
- Where: `backend/routers/sales.py` `recalculate_sale_totals` divides in binary floating point (`3.5 / 1.12 = 3.1249999999999996`), then `round_currency` rounds half-up on that value, giving net 3.12 / tax 0.38. The client (`src/utils/tax.js`, `roundCZK` with `+ EPSILON`) gives net 3.13 / tax 0.37, which is the correct half-up result of 3.125.
- Effect: the VAT recap printed on the receipt differs by one haléř from the stored `tax_summary` (and from what EET/Pohoda export read) for prices such as 3.50 Kč and 14.70 Kč at 12%. The sale total is not affected. Four of the eight shared fixtures show it.
- Recommendation: do the division in `Decimal` on the server (`Decimal(str(gross)) / (1 + Decimal(rate)/100)`), then quantize half-up; keep the client as is. Covered by the `backendTaxSummary` known-bug marker in the fixtures; Batch A Phase 1 step 1.4.

### F-029 [S2] Stock list shows the old stock for up to 5 minutes after an intake or write-off — VERIFIED (Batch D Phase 3), FIXED in Batch D2
- Where: `submitStockIntake` and the write-off call in `src/api/posApi.js` invalidate the cache tag `presets`, but `fetchPresetsBackend` caches the list under the tag `catalog` (5 minutes). The refresh that `InventoryView` runs after saving therefore returns the cached list.
- Seen live: intake of 100 pieces of "Rohlík tukový" returned 201 and the server stock became 250, but the Sklad table still showed 150.
- Effect: the cashier thinks the intake failed and enters it again, which doubles the stock.
- Recommendation: invalidate `catalog` after intake, write-off, physical audit and deposit movements (one line each, or have those calls invalidate both tags). Add a test that the list refetches after an intake.

### F-030 [S2] Tax reports, deposits and physical inventory call relative `/api/v1/...` URLs — VERIFIED in dev, CODE for Tauri (Batch D Phase 3), FIXED in Batch D2
- Where: `TaxReportsModal.jsx` (3 calls), `DepositPackagingModal.jsx` (2), `PhysicalInventoryModal.jsx` (2). Every other call uses `API_BASE_URL` (`http://<host>:8000/api/v1`).
- Seen live on the Vite dev server: the tax modal shows "Unexpected token '<', "<!doctype "... is not valid JSON". The same URLs return 200 when called on port 8000. The deposits modal swallows the same error and shows an empty book with 0.00 Kč.
- Effect: these screens work only when the page itself is served by the backend. When the app is loaded from the Tauri window or the Vite dev server, they fail. I could not run the packaged Tauri app, so that case is inferred.
- Recommendation: use `API_BASE_URL` through helpers in `posApi.js`; show the error in the deposits modal.

### F-031 [S3] Stock intake modal clips its item table — VERIFIED (Batch D Phase 3)
- The table is 898 px wide inside an 813 px modal. The "Nová prodejní cena" column is cut off and the row's delete button is not visible without scrolling.
- Recommendation: let the table scroll horizontally or narrow the columns. Part of Batch E.

### F-032 [S4] Write-off modal: narrow product select and default warning — VERIFIED (Batch D Phase 3)
- The product select is about 50 px wide ("-- Vyberte pro..."). The red "Nedaňové manko" notice shows by default with reason "Exspirace" and no item.
- Recommendation: widen the select and show the tax notice only after an item is chosen.

## What works well (keep)
- Payment modal: clear tabs, large total, banknote buttons, "Přesně", two completion buttons (with/without print). Fast for the common case.
- "Poslední účtenka" chip with reprint and quick storno; undo toast "ZPĚT" after cart changes; price check mode; shift widget collapsed by default.
- Settings: grouped by task, admin-locked sections marked with a lock icon, descriptive subtitles.
- Translation completeness: 1 251 keys in each of CZ, VI and EN with zero gaps.
- Lock screen: failed-attempt lockout exists; recovery was by PUK at the time of the audit and is now a one-time recovery code (Batch G).
- Test suites: 216 frontend and 186 backend tests pass, lint is clean.
