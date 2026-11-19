# Cart open items plan

Five leftovers from the cart audit. Item 12 is now included (it was excluded earlier).

## Phase 1: rename and double trash icon (small)
- `Cart.jsx`: rename `selectedItemId` / `setSelectedItemId` to `selectedLineKey` / `setSelectedLineKey` (it holds a line key since the lineId fix).
- Double trash icon: at the last unit the minus button shows a trash icon next to the separate delete button. Replace it: the minus keeps its minus icon and gets an `is-last` class with a rose tint, so it still signals "this removes the line" without a duplicate icon. Behaviour is unchanged (quantity 0 removes the line, undo toast stays).
- Tests: update the existing trash-icon test to check the minus icon plus `is-last`.

## Phase 2: cash rounding hint (item 12)
Cash totals round to whole koruna (`roundCashTotal` in `src/utils/tax.js`), but the cashier only sees the rounded amount in the payment modal.
- In the total card, the `N položek` badge line gets a suffix when the cash amount differs from the total: `6 položek · hotově 367 Kč`. No extra row, so no height cost.
- Shown only when the cart is not empty and the rounded amount differs from `finalGrandTotal`. Refund carts use the absolute amount.
- New key `cart.cash_short` (`hotově {amount} Kč`, VI, EN) with `formatKc`.
- Tests: hint appears for 3.50, is absent for 4.00 and for an empty cart, shows the absolute value in a refund.

## Phase 3: unique custom item ids (sale payload)
Custom items use `custom-${Date.now()}` in three places (`ManualKeypad.jsx`, `CustomItemModal.jsx`, `usePosKeyboardShortcuts.js`). Two added in the same millisecond share an `id`. The sale payload sends it as `item_id`, and the backend matches refunds by `item_id` (`backend/routers/sales.py`, `refunded_by_item_id`), so a refund of one custom line could be counted against the other.
- New `newCustomItemId()` in `src/utils/customItemId.js`: `custom-<time>-<counter>`. Keeps the `custom-` prefix.
- The three sites call it. `CustomItemModal` keeps `id ||` for edits.
- Test: 1000 calls give 1000 unique ids, prefix kept.
- Review runs at `high` because a sale payload field is touched.

## Phase 4: compact last-receipt chip
The chip row takes about 45 px above the list at all times.
- With items in the cart the chip becomes compact: 32 px high, shows only `Poslední: 5 Kč (10:49)` (no count badge). With an empty cart it keeps the full look.
- Popover and its actions are unchanged.
- Alternative not chosen: hide the chip while the cart has items. It saves the most but removes quick reprint during a sale.

## Gates
`npm run test`, `npm run lint`, `npm run build`, `/code-review` (`high` for phase 3, `medium` otherwise; one `high` run over the whole diff covers it), then a browser check at 800x540: rounding hint with 3.50 and 4.00 items, minus at last unit, compact chip, list height.

## Out of scope
Czech comma app-wide, a unit label in stepper aria-labels.
