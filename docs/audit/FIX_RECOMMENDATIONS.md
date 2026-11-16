# Audit: prioritized fixes and where more thought is needed

Source: [`FINDINGS.md`](FINDINGS.md) (28 findings, F-001 to F-028). This file orders the work, groups it into fix batches, and marks the parts where the fix approach needs a decision or more investigation before coding. The audit itself changed no code; Batch A Phase 0 (tests and a pure payload builder, no behavior change) is done, see the Batch A plan.

## 1. Priority order

| Rank | Finding | Severity | Effort | Batch |
| --- | --- | --- | --- | --- |
| 0 | F-027 fractional quantity truncated to 0 (0.35 kg stored as 0 Kč) | S1 | S | A |
| 1 | F-001 cash total mismatch -> sale rejected, UI says success | S1 | S (server tolerance + client error path) | A |
| 2 | F-014 offline sales never resent | S1 | M | A |
| 3 | F-002 scanner or Enter completes payment | S1 | S | B |
| 4 | F-003 weight entry 350 kg | S1/S2 | S | B |
| 5 | F-015 shift widget vs Z-report disagree | S1/S2 | M | A |
| 6 | F-016 receipt prints whole koruna | S2 | S | C |
| 7 | F-005 payment modal closes mid terminal charge | S2 | S | B |
| 8 | F-017 Sklad view unreachable | S2 | S (once decided) | D |
| 9 | F-021 Z-report prefilled count | S3 | S | B |
| 10 | F-019 missing translation keys | S2 | S | C |
| 11 | F-018 mobile/tablet layout | S2 | M-L | E |
| 12 | F-020 touch targets and text size | S2 | M | E |
| 13 | F-022, F-004, F-008, F-011, F-025 | S2-S3 | S each | B/C |
| 14 | F-006, F-012, F-026 | S2-S3 | M | A |
| 14a | F-028 server and client VAT split differ by 0.01 Kč | S3 | S (Decimal division on the server) | A |
| 15 | F-009, F-010, F-023, F-024, F-013 | S2-S4 | L (spread out) | F |

## 2. Fix batches

**Batch A: Sale integrity (DONE, see `docs/plans/BATCH_A_SALE_INTEGRITY_PLAN.md`).** F-027, F-001, F-014, F-015, F-006, F-026, F-012, F-028.
Goal: a sale shown as "paid" is either recorded on the server or visibly queued, and every screen reads the same totals.
Order inside the batch: (1) server accepts the cash-rounded total; (2) client distinguishes 4xx (rejected, show error) from network error (queue as `OFFLINE_PENDING`); (3) retry queue on `pos:backend-online`; (4) shift widget from a server summary; (5) server-assigned receipt numbers.

**Batch B: Counter safety (DONE, see `docs/plans/BATCH_B_COUNTER_SAFETY_PLAN.md`).** F-002, F-003, F-005, F-021, F-022, F-004, F-008.
Goal: a mis-scan, a wrong unit or a stray Enter cannot record money that was not taken.

**Batch C: Receipt and text correctness (DONE, see `docs/plans/BATCH_C_RECEIPT_TEXT_PLAN.md`).** F-016, F-019, F-011.

**Batch D: Stock access (F-017 DONE, see `docs/plans/BATCH_D_STOCK_ACCESS_PLAN.md`).** New findings F-029 to F-032 from the first look at the stock screens are open.

**Batch E: Layout and touch ergonomics.** F-018, F-020, F-007.

**Batch F: Hygiene, ongoing.** F-009, F-010, F-023, F-024, F-013, F-025.

## 3. Where I have more recommendations (approach, trade-offs, open questions)

### 3.1 F-001 / F-014: what should the contract be for cash rounding?
Three options; I recommend option 2.
1. Client sends the exact total and the server applies rounding. Cleanest for the ledger, but the client already shows and prints the rounded amount, and the change calculation happens on the client.
2. Client sends exact total in `totalAmount` and the rounded amount in a new field (`cashRoundedTotal`, with `cashRounding` already present). Server validates `computed == totalAmount` and `cashRoundedTotal == round(computed)` for cash only, stores both. Receipts and Z-report use the rounded value for the cash drawer and the exact value for VAT.
3. Keep the current client behaviour and loosen the server check to `abs(client - server) <= 0.5` for cash. Smallest change, but it weakens the FIN-C1 tamper check the team added on purpose.
Open question: how do the Z-report and the VAT summary treat the rounding today (accounting treatment of "haléřové vyrovnání")? Ask the accountant before choosing between 1 and 2.
Also needed: a regression test on both sides with a basket of 11.50 Kč, and a decision on what happens to sales already stranded in localStorage on the cashier PC (a one-time recovery button "Odeslat neodeslané prodeje" that replays local sales missing in the backend by receipt number).

### 3.2 F-014: offline queue storage (REVISED during Batch A planning)
Earlier version recommended IndexedDB. After reading the code that is not needed: the backend is a local sidecar, so "offline" means the process is down or restarting; the app already keeps every non-completed sale in localStorage without trimming (only the latest 50 completed ones are trimmed). The backend `idempotency_cache` is in-memory (1 000 entries, 300 s) but the DB check on sale id (`ALREADY_EXISTS`) makes replays safe. So keep localStorage, add a `syncState` field and a quota-error banner. See `docs/plans/BATCH_A_SALE_INTEGRITY_PLAN.md`.

### 3.3 F-002: how to tell a scanner from a human
A timing heuristic (keys under about 50 ms apart) works for most scanners, but the audit could not test a real device. Needs hardware: record what the store's actual scanner sends (prefix/suffix, speed, Enter or Tab). Alternative that avoids timing: configure the scanner for a prefix character and route anything starting with it. Please check the scanner's programming sheet.
Also decide the policy for scans while a payment modal is open: ignore, warn, or add item and close the modal. I suggest "warn and ignore", because adding an item to a cart that is mid-payment changes the amount due.

### 3.4 F-003: grams versus kilograms
Cashiers and scales think in grams for fruit and in kilograms for bulk. A unit toggle on the modal (g / kg, remembered per item) with a sanity limit per item (`maxWeightKg`, default 25) is better than a single fixed unit. More investigation: how does the connected scale (if any) feed weight today; the barcode path (`parseScaleBarcode`) already yields kg, so the manual path should end up in the same unit and limit checks.

### 3.5 F-015: one source for the day's totals
Prefer a single `GET /shift/summary` used by the widget, Z-report and Historie header, instead of three client-side aggregations. Needs a decision on what "today" means across midnight (shift-based, not date-based). The Z-report already uses shifts; the widget and Historie use the calendar date.

### 3.6 F-017: where should stock management live?
Options: (a) new "Sklad" tab, (b) section inside Katalog, (c) Settings > Sklad. Ask the owner how often stock intake happens: daily deliveries argue for a visible tab; weekly argue for a Katalog sub-menu. I could not test the stock screens because they are unreachable; once reachable they need their own audit pass (W15), especially CSV import and physical inventory on touch.

### 3.7 F-018: supported devices
Before touching layout, settle the device matrix: fixed touch PC (1366x768 or 1920x1080), a tablet at the counter, and a phone for the owner. The existing `web/` cloud dashboard might be the better place for the phone use case, which would let the main app drop mobile mode entirely and remove a block of CSS and state (`isMobile`, `mobilePosTab`).

### 3.8 F-020: touch ergonomics need a real-user test
Measured sizes show clear misses (34 px tabs), but finger accuracy, glove use and hand position cannot be judged from the browser pane. Plan a 15-minute observation with the actual cashier on the actual screen (plan section 7), and let that test set the final minimum sizes.

### 3.9 F-010 / F-021: shared confirmation component
One `ConfirmModal` with variants: normal, destructive (red, typed word), and "count first" (Z-report). Replacing 17 native dialogs in one sweep is mechanical, but each message needs a Vietnamese translation; batch it with Batch F, not earlier.

### 3.10 Testing gaps to close alongside the fixes
- Frontend tests mock the API, so F-001 passed 216 tests. Add one contract test that runs the real `calculateCartTotals` + `handleCompleteSale` payload against the FastAPI app (TestClient) for cash, card, split and refund.
- Add a test that scans `t('…')` literals against `translations.cs` (F-019) and one that checks every view is reachable from the navbar (F-017).
- `CLAUDE.md` quality-gate numbers are stale (78 frontend and 45 backend tests listed, 216 and 186 actual).

## 4. Not covered, suggested next audit passes
- W4, W6 to W10, W12, W13, W16 to W18, W20 to W22 (see `flow-maps.md` coverage list) need seed data, a second display and hardware.
- The cloud `web/` dashboard.
- Security items found in passing: default PIN fallback (F-012). `docs/guides/SECURITY_AUDIT.md` already exists; cross-check before planning.
- Real-hardware pass: printer paper-out, drawer pulse, terminal decline and cancel, scanner behaviour.
