# Flow maps (P1)

Maps of how each audited workflow works today, with tap counts measured at 1366x768 in the built-in browser. Legend: [OK] works as intended, [RISK] see finding. Workflows not listed here were not mapped in detail; see "Coverage" at the end.

## W2 Scan or tap item, pay cash, receipt (critical)

Tap-count baseline (preset item, exact cash, no extra options):
1. Tap tile (1).
2. Tap "Hotovost" (2).
3. Press Enter or tap "Dokončit bez tisku" or "Dokončit a vytisknout" (3).
Result: 3 taps, meets the target of 3 or fewer. [OK]

Decision points and states:
- Tile tap -> weighed item opens WeightEntryModal [RISK F-003].
- Barcode scan: handled by `usePosKeyboardShortcuts` only on the register tab and only when focus is not in an input. Scan during a modal is not routed [RISK F-002].
- "Hotovost" -> PaymentModal, tendered defaults to 0 which means exact [RISK F-008].
- Complete -> `handleCompleteSale`: client builds sale and receipt number, clears cart, banner "Zaplaceno!", POST in background [RISK F-001, F-006, F-014].
- Receipt: direct print, else preview modal [RISK F-016 amounts].

## W5 Card payment

1. "Karta / QR" -> PaymentModal on tab "Karta".
2. Terminal configured: "Zaplatit na terminálu" -> `payWithTerminal` -> result -> 1 s timer -> `onCompleteSale` [RISK F-005].
3. No terminal (manual mode): instruction text, then "Dokončit" records a card sale at once [RISK F-022].
4. Enter key completes the sale for card, QR and split without a terminal result [RISK F-002].

## W11 Last receipt, reprint, quick storno

1. Chip "Poslední: 12 Kč (19:45)" in the cart header -> popover with amount, date, payment, items.
2. "Vytisknout znovu" -> `handleReprintSale` (prints, else opens preview) [OK].
3. "Rychlé storno" -> RefundModal. Not walked through live. [RISK F-026]

## W14 End of day: Z-report

1. Shift widget (collapsed) -> expand -> "Z-Uzávěrka" (2 taps).
2. ZReportModal: expected cash, counted cash field pre-filled, keypad, note, "Provést Z-Uzávěrku a vytisknout" [RISK F-021].
3. Totals come from the backend while the widget totals come from browser state [RISK F-015].
4. Closing prints and triggers cloud snapshot (not exercised).

## W1 Start of day and lock

- App starts on Pokladna with no explicit "open shift" prompt; shift state is fetched in the background (`fetchShiftData`). The first screen does not show whether a shift is open [RISK, not verified further].
- Auto-lock after N minutes of no input (`useAutoLock`, default 15). PIN keypad verifies on the backend; offline falls back to a default PIN [RISK F-012].

## W19 Offline and sync

- Navbar chip shows "DEV / Online / offline" with a coloured dot.
- Sales made offline are not marked pending and are never resent [RISK F-014].
- The sync modal and badge count only sales that the backend itself reports as pending EET [OK for EET, blind to F-014].

## W3 Preset tile, weight item

- Tile -> cart (1 tap). Weighed tile -> WeightEntryModal with keypad and tare buttons -> "Vložit do košíku" (about 5 taps for 350 g).
- Unit is kg on the entry display but tare is in g [RISK F-003].

## Navigation

- Navbar: Pokladna, Katalog, Historie, Analytika, Nastavení. Sklad has no entry [RISK F-017].
- At 1024 px the navbar collapses to a hamburger; at 375 px the mobile tab bar has no styling [RISK F-018].

## Coverage

Mapped from code and exercised live: W1 (partly), W2, W3, W5 (manual mode), W11 (popover only), W14 (open and inspect), W19, navigation, Settings overview, Katalog list, Historie empty state.
Not exercised live (need more seed data or hardware): W4 keypad/custom item, W6 QR with email verification, W7 split, W8 discounts, W9 park cart, W10 price check, W12 refund and receipt-scan return, W13 cash movement, W15 stock flows (unreachable per F-017), W16 drag and drop, W17 analytics, W18 settings forms, W20 language switch rendering, W21 customer display, W22 technician session.
