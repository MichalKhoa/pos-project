# Batch A: Sale Integrity — Implementation Plan

Status: DRAFT, awaiting approval. No code has been changed.
Source: [`docs/audit/FINDINGS.md`](../audit/FINDINGS.md) and [`docs/audit/FIX_RECOMMENDATIONS.md`](../audit/FIX_RECOMMENDATIONS.md).
Covers findings: F-027 (new), F-028 (new, minor), F-001, F-014, F-015, F-026, F-012. F-006 was lowered to S3 and is only handled where it falls out of Phase 3.

## 1. Goal

A sale the cashier sees as "paid" is either stored correctly on the server or is visibly marked as not stored, and every screen reads the same totals.

Done means these audit repros no longer fail:

| Repro | Today | Target |
| --- | --- | --- |
| 0.35 kg x 42 Kč, cash | stored as total 0, quantity 0 | stored 14.70, quantity 0.35, stock reduced |
| 11.50 Kč basket, cash | HTTP 422, UI says success, sale lost | accepted, total 11.50, `cash_rounding` +0.50, drawer +12 |
| Backend down during a sale | sale never sent, no badge | marked unsent, badge visible, resent when backend returns |
| Shift widget vs Z-report vs Historie | 14 716 / 0 / 0 | same numbers from one source |
| Quick storno on an unsent sale | silent failure | blocked with a clear message |
| Lock screen with backend down | accepts default PIN 1234 | no unlock without server verification |

## 2. Findings that shape the plan (new facts from reading the code)

1. **New S1, F-027: fractional quantities become 0.** `parseInt` in `src/utils/tax.js:13-16` (`calculateItemLineGross`) and in `normalizeSale` (`src/api/posApi.js`). The server recomputes from the same zero quantity, so it agrees and stores 0. Verified by replaying the client pipeline against the real backend. This goes first because it loses money silently on the weighed-item flow.
2. **The payload already carries `cashRounding`** (the client sends it), but `CreateSaleSchema` ignores it and `SaleModel` has no column. The Z-report (`backend/routers/cash.py` `_calculate_shift_metrics`) sums `total_amount` for the cash drawer, so once cash totals are stored exact, expected drawer cash would drift by up to 0.50 per sale unless the rounding is stored and added.
3. **"Offline" here means the local backend process is down or restarting**, because the backend is a sidecar on the same PC (`src-tauri/src/lib.rs`). That removes the need for a heavy queue store. localStorage already keeps pending sales without trimming (only the latest 50 completed ones are trimmed in `App.jsx`). I am dropping the IndexedDB idea from the audit recommendations.
4. **Existing sync code is EET-only.** `useOfflineSync.js` counts `pending_offline_sales` from `/eet/status` and only when EET is enabled. EET is disabled by default (the live run returned `eet_status: DISABLED`). The unsent-sale queue must be separate from the EET queue, and must not reuse `eet_status` (today `normalizeSale` defaults it to `'EVD_OK'`, which is how lost sales look healthy).
5. **Idempotency is already by sale id** in the DB (`ALREADY_EXISTS` path in `create_sale`), so replays are safe. The in-memory `idempotency_cache` (1 000 entries, 300 s) is only an extra layer. The client sends no `X-Idempotency-Key`; it is not needed if the sale id is stable, so I will not add it.
6. **The printed receipt number is the server's number when online** (print happens after the POST resolves), which is why F-006 dropped to S3.

## 3. Decisions needed from you before Phase 2 (defaults in bold)

1. **Cash rounding accounting.** Proposed: server stores the exact total in `total_amount` and the rounding in a new `cash_rounding` column; VAT stays on the exact amount; the drawer and "Hotovost" in the Z-report use exact + rounding; the Z-report shows a separate "Zaokrouhlení" line. **Confirm with your accountant** that this matches how you want the books. If the accountant prefers the stored total to be the rounded amount, only Phase 2 step 2.3 changes.
2. **What the cashier sees when the server rejects a sale (4xx).** **Blocking dialog with the error code, the amount, a "Zkusit znovu" button and a note to call the administrator; the sale stays in a "Neuložené prodeje" list.** Alternative: non-blocking banner only. I recommend blocking, since the customer has already paid.
3. **Stranded sales already on the cashier PC** (made before this fix, shown as normal in the browser but missing in the DB). **Run a one-time check at startup that lists sales present locally and missing on the server, and offers "Odeslat" per sale; never auto-send sales that contain a zero quantity (F-027), those need a manual review.**

## 4. Phases

Each phase is one commit with its tests; stop after each for review. Tests first in each phase (write the failing repro, then the fix).

### Phase 0: Golden fixtures and failing tests (no behaviour change)
Files: `backend/tests/fixtures/sales/*.json` (new), `backend/tests/test_sale_contract.py` (new), `src/__tests__/sale_payload.test.js` (new).
- Extract the pure part of `handleCompleteSale` (totals, rounding, item mapping, `normalizeSale`) into `src/utils/buildSalePayload.js` so it is testable without rendering `App`. `App.jsx` calls it; behaviour unchanged.
- Fixtures: cash 11.50; cash 0.35 kg; card 3.50; split 100 / 50; refund of the cash 11.50 sale; cash 12.00 with 21% and 12% VAT mix; cart discount 10%.
- Frontend test: builder output equals the fixture. Backend test: POST fixture returns 201 and stored values match the expected columns.
- Expected at the end of the phase: new tests FAIL for 0.35 kg and 11.50 cash (proof of the bugs), all existing tests still pass.
Verify: `npm run test`, `python -m unittest discover -s backend/tests -p "test_*.py"`.

### Phase 0 result (done, uncommitted on branch `fix/batch-a-sale-integrity`)
- `src/utils/buildSalePayload.js` (new) holds the sale-building logic moved unchanged out of `App.jsx` `handleCompleteSale`; `App.jsx` now calls it.
- 8 golden fixtures in `backend/tests/fixtures/sales/` (cash 12, cash 11.50, card 3.50, card 0.35 kg, cash 0.35 kg, split 100+50, cart discount 10%, refund). Each has the payload, the expected stored values, and `knownBugs` markers.
- `src/__tests__/sale_payload.test.js` and `backend/tests/test_sale_contract.py` (new). Known bugs are asserted as expected failures (`it.fails`, `assertRaises`), so the suites stay green and a fix makes the test say "bug fixed, remove the marker". Probed that the expected failures fail for the intended reason (client quantity 0, total 0; server 422 TOTAL_MISMATCH).
- Results: lint clean; frontend 222 passed + 2 expected failures (was 216); backend 187 passed (was 186).
- Deviation from the plan: the fixtures exposed a new minor bug, F-028 (VAT split differs by 0.01 between server and client). It is added to Phase 1 as step 1.4. Fixture tax numbers come from an independent exact-decimal reference, not from the server function.
- Not covered by Phase 0: the refund fixture is backend-only because the storno payload is still built inline in `handleProcessRefund`; Phase 5 can extract a builder for it.

### Phase 1: Fractional quantity (F-027)
Files: `src/utils/tax.js`, `src/api/posApi.js` (`normalizeSale`), `backend/routers/sales.py`, tests.
1.1 Replace the three `parseInt` quantity reads with a shared `toQty()` (`parseFloat`, round to 3 decimals, NaN -> 1). Same for `remainingQuantity` and `refundedQuantity`. Check `RefundModal.jsx` and `SalesLedgerTable` for the same pattern (grep `parseInt(.*quantity`).
1.2 Server guards in `create_sale`: reject a line with `quantity == 0` (422 `ZERO_QUANTITY`); reject a non-refund sale where computed total is 0 and `tenderedAmount > 0` (422 `ZERO_TOTAL`). These make the server refuse silent zero sales even if a client bug returns.
1.3 Read-only report script `backend/scripts/find_zero_sales.py` listing stored sales with `total_amount = 0` or item `quantity = 0` (for the owner to review; it changes nothing).
1.4 (F-028) In `recalculate_sale_totals` compute net as `Decimal(str(gross)) / (1 + Decimal(rate) / 100)` and quantize half-up, so the stored VAT split matches the client and the exact math. Remove the `backendTaxSummary` markers from the four fixtures.
Tests: 0.35 kg, 1.250 kg, scale barcode weight basket, 3 x 0.333 kg; refund of a fractional line; the two server guards; stored `tax_summary` equals the fixture for all fixtures.
Verify: Phase 0 fractional fixture now passes; live replay of the audit repro stores 14.70 and reduces stock.

### Phase 1 result (done)
- 1.1 `toQty()` in `src/utils/tax.js` replaces `parseInt` on sold, refunded and remaining quantities (`tax.js`, `normalizeSale`, `ReceiptInspectorPanel`). Remaining `parseInt` hits are stock counts and the customer display, which are whole pieces by design.
- 1.2 Server guards: 422 `ZERO_QUANTITY` and 422 `ZERO_TOTAL` (tendered > 0, non-refund). A free sale with nothing tendered still passes.
- 1.3 `backend/scripts/find_zero_sales.py` (read-only report). It found 0 rows on the scratch DB; run it against the store DB.
- 1.4 Server nets VAT with `Decimal`. The client had the same tie bug (14.70 / 1.12 = 13.1249999), so it now uses integer-cent `netFromGross` too. This went beyond "keep the client as is", because the fractional fixtures showed it.
- Known-bug markers for F-027 and F-028 removed from the fixtures; only the F-001 `backend` marker remains (Phase 2). The generator no longer emits an empty `knownBugs`.
- Tests: frontend 230, backend 191, lint clean.

### Phase 2: Cash rounding contract (F-001)
Files: `backend/routers/sales.py`, `backend/models.py`, `backend/routers/cash.py`, `backend/migrations.py` (check only), `src/App.jsx`/`buildSalePayload.js`, tests.
2.1 Schema: add `cashRounding: float = 0.0` to `CreateSaleSchema`; add `cash_rounding = Column(Numeric(10, 2), default=0.0)` to `SaleModel` (`run_schema_migrations` adds missing model columns automatically; confirm with `test_migrations.py` on a copy of an old DB).
2.2 Validation in `create_sale`: for `paymentMethod == 'cash'` accept `client_total` when it is a whole number and `abs(client_total - computed_total) <= 0.50`; otherwise keep the strict equality check. This avoids a JS `Math.round(-x.5)` versus Python rounding mismatch on negatives. Non-cash and split stay strict.
2.3 Storage: `total_amount = computed_total` (exact, as FIN-C1 requires), `cash_rounding = client_total - computed_total` for cash.
2.4 `cash.py` `_calculate_shift_metrics`: `cash_part = amt + cash_rounding` for cash sales; expose `cash_rounding_total` in the metrics and in `_build_shift_dict`; Z-report print and modal show a "Zaokrouhlení" line. Refunds: unchanged (client does not round them).
2.5 EET payload: keep what is sent today (`sale_payload` carries the client's rounded `totalAmount`); note for the accountant, since EET is disabled by default this is low priority.
Tests: 11.50 cash accepted with +0.50; 11.49 accepted with -0.49; 12.00 exact; 11.50 with client total 13 rejected (422); card 11.50 with client total 12 rejected; Z-report expected cash includes rounding over 10 mixed sales; old-DB migration adds the column.
Verify: audit repro 2 (11.50 basket) completes and appears in Historie, Z-report cash is 12.

### Phase 2 result (done, default rounding contract)
- 2.1 `cashRounding` in `CreateSaleSchema`; `SaleModel.cash_rounding` column (auto-migrated; `test_migrations.py` covers an old `sales` table).
- 2.2 Cash only: accept a whole-number client total within 0.50 of the exact total, never for refunds, card, QR or split. The server derives `cash_rounding` itself and ignores the client's value. Anything else is still 422 `TOTAL_MISMATCH`.
- 2.3 `total_amount` stays the exact server total; the difference goes to `cash_rounding`.
- 2.4 `_calculate_shift_metrics`: cash part = exact + rounding, so expected drawer cash matches the real till. New `cash_rounding_total` in the shift data, a "z toho zaokrouhlení" line in the Z-report modal and the printed Z-report. Revenue totals stay exact.
- 2.5 EET payload unchanged (still carries the client's rounded total). EET is off by default; the accountant should confirm before EET is enabled.
- Not changed: the daily summary `cash_total` in `sales.py` (history screen) still sums exact `total_amount`, so it can differ from the Z-report by the rounding. Cover it in Phase 4 (one source for shift totals).
- The client was not changed: it already sent the rounded total and `cashRounding`.
- Tests: backend 200, frontend 230, lint clean. Not yet checked live in the browser (audit repro 2).

### Phase 3: Truthful completion and unsent queue (F-001 part 2, F-014)
Files: `src/api/posApi.js`, `src/App.jsx`, `src/hooks/useOfflineSync.js`, `src/components/Navbar.jsx` (badge), new `src/components/UnsentSalesModal.jsx`, `src/utils/storage.js` (quota guard), translations (CZ, VI, EN), tests.
3.1 `createSaleBackend` returns: the JSON on 2xx; `{ status: 'REJECTED', httpStatus, code, detail }` on 4xx (parsing `detail.code` such as `TOTAL_MISMATCH`); `null` on network error or 5xx (retryable). Existing callers and mocks that treat `null` as "failed" keep working.
3.2 New local field `syncState` on a sale: `SYNCED`, `PENDING`, `REJECTED`. It is separate from `eet_status`; remove the `'EVD_OK'` default from `normalizeSale` (use the server's value or `undefined`). Strip `syncState` before POST.
3.3 `handleCompleteSale`: set `PENDING` before POST. Result handling: success -> `SYNCED`, then refresh shift data; `null` -> stay `PENDING`, banner "Uložení čeká na server" (warning style); `REJECTED` -> `REJECTED`, blocking dialog per decision 2, no fiscal receipt printed for the unrecorded sale (the printed "DAŇOVÝ DOKLAD" must not exist for a sale that is not recorded; offer "Vytisknout potvrzení bez čísla" only if you want it).
3.4 Queue: in `useOfflineSync`, `unsentSales = salesHistory.filter(syncState === 'PENDING')`; flush sequentially on the `pos:backend-online` event, on the existing 30 s interval, and on the manual button. Success -> `SYNCED`; 4xx -> `REJECTED` (stop retrying, show in the list); network error -> keep `PENDING`. Flush is idempotent because the server answers `ALREADY_EXISTS` for a known sale id.
3.5 UI: navbar badge shows unsent count (separate colour from the EET badge); `UnsentSalesModal` lists receipt number, time, amount, state, error code, with "Odeslat znovu".
3.6 Persistence: `App.jsx` already keeps all non-`SYNCED` sales plus the latest 50. Update the filter to use `syncState`, and make `setStorageItem` failures (quota) raise a visible banner instead of being swallowed.
3.7 Stranded-sale recovery (decision 3): on startup after the first successful backend contact, fetch the receipt ids from the backend and mark local sales that are missing there as `PENDING`, except sales with any zero quantity or zero total, which are shown as `REJECTED` with reason `NEEDS_REVIEW`.
Tests: backend 422 -> `REJECTED` + dialog; network error -> `PENDING` + badge; backend returns -> exactly one POST per sale, state `SYNCED`; restart with local sale missing on server -> recovered; quota error -> banner.
Verify: repeat audit repro 3 (stop backend, sell, restart backend): badge shows 1, then sale appears in Historie, DB has one row.

### Phase 3 result (done)
- 3.1 `createSaleBackend` returns the JSON on 2xx, `{ status: 'REJECTED', httpStatus, code, detail }` on 4xx (not 408, 425, 429), and `null` on network errors, 5xx and those retryable codes. It strips `syncState` and `syncError` before the POST.
- 3.2 `syncState` is `PENDING`, `STRANDED`, `REJECTED` or `SYNCED` (none means synced). Logic lives in `src/utils/saleSync.js`. Deviation: I did **not** remove the `'EVD_OK'` default of `eet_status` in `normalizeSale`, because receipts and the EET badge read it and `syncState` is now the truth about "is it on the server". Revisit with the Batch C receipt work.
- 3.3 `handleCompleteSale` saves the sale as `PENDING` and still shows "Zaplaceno!" at once. A 4xx marks it `REJECTED`, opens the blocking list dialog, shows an error banner and prints no receipt. A network error keeps it `PENDING` and shows a warning banner. Refunds (storno) use the same states.
- 3.4 `useUnsentSales` resends `PENDING` sales oldest first, one at a time, on `pos:backend-online`, every 30 s and on demand. It stops at the first unreachable result. A 4xx becomes `REJECTED` and is not retried.
- 3.5 Red navbar badge with the unsent count and `UnsentSalesModal` (receipt, time, amount, state, error code, "Odeslat", "Odeslat vše"). Strings are in CZ, VI and EN (1 273 keys each, no gaps).
- 3.6 Local storage never trims unsent sales. `setStorageItem` now returns false on failure and a quota error shows a banner.
- 3.7 Restart recovery: after the first backend contact, local sales without `syncState` that the server lacks become `STRANDED`. Decision 3 asked for manual sending, so they are **not** resent automatically (the plan text said PENDING; I used a separate state). Zero-quantity or zero-total sales become `REJECTED` with `NEEDS_REVIEW`. Sales older than a full backend page are not judged.
- Tests: `sale_sync.test.js` (19) and `app_unsent_sales.test.jsx` (3). Frontend 252, backend 200, lint clean, build OK.
- Live check (backend and Vite on a scratch DB): a 3.50 cash sale stored 3.50 with `cash_rounding` 0.50 and Z-report cash 4. Then with the backend stopped, a sale showed the warning and badge 1; after the backend restarted, one POST, the DB had both rows and the badge was gone.
- Not covered: real printer behaviour, a 5xx loop while the backend is half-up (it just retries every 30 s), and the daily-total mismatch in Historie (Phase 4).

### Phase 4: One source for shift totals (F-015)
Files: `backend/routers/cash.py` (`_build_shift_dict`), `src/components/keypad/ShiftStatsWidget.jsx`, `src/App.jsx`, `src/components/cash/ZReportModal.jsx`, tests `shift_stats_widget.test.jsx`, `cash_shift.test.jsx`.
4.1 Backend: add `total_revenue`, `card_sales`, `qr_sales`, `receipts_count`, `refunds_count`, `cash_rounding_total` to `_build_shift_dict` (the numbers already exist in `metrics`).
4.2 Frontend: the widget reads `currentShift` (already in `App.jsx` state) instead of aggregating `salesHistory`. Refresh `currentShift` after every sale resolves (Phase 3 hook point) and after queue flush. When `currentShift` is missing, show "—" rather than a locally computed figure.
4.3 Show a separate amber line "Neuloženo: N prodejů, X Kč" from the unsent queue; it is never added into the main totals.
4.4 Z-report modal: if unsent sales exist, show a warning with count and amount and require an extra confirmation to close the shift.
4.5 Fix the Czech plural in the widget (`Intl.PluralRules`, "1 účtenka / 2 účtenky / 5 účtenek"); it is in the file already being edited.
Tests: widget renders backend numbers, ignores local-only sales, shows the unsent line; Z-report warns when unsent > 0.
Verify: repeat audit repro 4; the three screens agree.

### Phase 5: Refund guards (F-026)
Files: `src/App.jsx` (`handleProcessRefund`), `src/components/Cart.jsx` (last-receipt chip), `src/components/RefundModal.jsx`, `src/components/SalesHistoryView.jsx`, tests `receipt_return_scanner.test.jsx`, `price_check_and_last_receipt.test.jsx`.
5.1 Disable "Rychlé storno" and refund entry points for a sale whose `syncState !== 'SYNCED'`, with the reason shown ("Prodej ještě není uložen na serveru").
5.2 `handleProcessRefund`: create the storno sale first; call `updateSaleRefundStatusBackend` only after a success result; handle `REJECTED` and `null` as in Phase 3 (the storno joins the same queue; the status update runs after it syncs). Check the result of `updateSaleRefundStatusBackend` and show an error if it fails.
Tests: refund blocked for `PENDING`; storno rejected -> visible error and original sale unchanged; status update failure shown.

### Phase 6: Lock screen without default PIN (F-012)
Files: `src/components/LockScreenModal.jsx`, translations, test `technician_session.test.jsx` plus a new lock test.
6.1 When `verifyPinBackend` returns `valid: null`, do not compare with a local PIN. Show "Server se spouští, zkouším znovu…", retry with a short backoff, keep the keypad usable once the server answers. Remove `|| '1234'`.
6.2 Out of scope but recorded: the backend still defaults PINs to `1234` (`config.py`, `migrations.py`), the PUK flow resets to `1234`, and `verify-admin-pin` has a default master key string in code (`POS_MASTER_ADMIN_KEY` fallback). Propose a separate security batch: force PIN change on first run, no code default for the master key. Cross-check with `docs/guides/SECURITY_AUDIT.md` before planning it.
Tests: backend unreachable -> no unlock with 1234, message shown, unlock after backend returns with the correct PIN.

## 5. Cross-cutting

- **Order and dependencies:** 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6. Phase 1 and 2 touch the same payload code, so keep them sequential. Phase 6 is independent and can move earlier or run in a second session.
- **Translations:** every new string goes into CZ, VI and EN in the same commit; the audit found 1 251 keys in all three languages with no gaps, and Phase 3 should keep it that way. Run the key-usage script from the audit as a check.
- **Data safety:** Phase 2 adds a column to the production DB. Take a backup first (`BackupSection`), test the migration on a copy of the cashier DB, and ship through the existing updater. No data is rewritten.
- **Backward compatibility:** one app and one backend ship together, so no versioned API. New payload field `cashRounding` is optional with default 0.
- **Quality gates after each phase:** `npm run lint`, `npm run test`, backend unittest, and the matching live repro from section 1.
- **After the batch:** update `CLAUDE.md` quality-gate numbers (216 frontend and 186 backend tests today), record decisions in projectmem, and update the status lines in `docs/audit/FINDINGS.md`.

## 6. Effort and risk

| Phase | Size | Risk |
| --- | --- | --- |
| 0 fixtures | S | low; one refactor of `handleCompleteSale` into a pure builder |
| 1 quantity | S | low; broad grep for other `parseInt` on quantities |
| 2 rounding | M | medium; accounting rule (decision 1) and Z-report change |
| 3 queue | M-L | medium; most new UI and state; needs careful tests |
| 4 shift totals | S-M | low-medium; widget tests change |
| 5 refunds | S | low |
| 6 lock | S | low; could lock out a cashier if the backend never answers, so keep the retry message clear |

About 4 to 5 working days for one person, review stops included.

## 7. Not in this batch
F-002, F-003, F-005, F-021, F-022 (Batch B), receipt amount format F-016 (Batch C), all layout and touch items (Batch E). F-027 shows that fractional quantities also deserve a look at the weight-entry unit problem F-003 in Batch B, since both live in the same flow.

## 8. Approval

Reply "approved" (and answer the three decisions or accept the defaults) and I will start with Phase 0. I will stop after each phase for review.
