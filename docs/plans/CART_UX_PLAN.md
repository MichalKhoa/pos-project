# Cart column UX plan (audit items 1, 2, 5, 8)

Scope: four small UI/UX fixes in the cashier cart. No new features, no backend change, no sale payload change.
Files: `src/components/Cart.jsx`, `src/components/cart/CartItemInspector.jsx`, `src/styles/register.css`, one new test file.
Review: `/code-review` at `medium` after the quality gates (no EET, VAT, refund or payload code touched).

## Phase 1: Quantity field accepts typing (item 2)

Problem: the inspector quantity input is controlled by `item.quantity`; `handleQtyChange` ignores empty/NaN and clamps on each keystroke. Backspace on "1" does nothing; "0.5" cannot be typed for weighed items.

Change in `CartItemInspector.jsx`:
- Add local string state `qtyText`, initialised from `item.quantity`.
- `onChange` only updates `qtyText`; if it parses to a valid number inside the allowed range, also call `handleQtyChange` (live update keeps the cart total current). Empty or partial text ("", "0", "0.") is allowed to sit in the field.
- On blur and on Enter: clamp via `handleQtyChange`, then reset `qtyText` to the committed quantity.
- `useEffect` on `item.quantity`: sync `qtyText` when the quantity changes from the stepper or chips (skip while the field has focus).

Verify: new test `src/__tests__/cart_inspector_qty.test.jsx`: clear field and type "12" gives 12; weighed item types "0.5" gives 0.5; empty field then blur restores the last valid quantity; stepper and chips still work.

## Phase 2: Row text trimmed and minus becomes trash at quantity 1 (items 5, 8)

Change in `Cart.jsx` item row:
- Remove `(DPH N%)` from both row-2 variants (inspector subtitle already shows VAT).
- Weighed variant: show `0.350 kg × 120.00 Kč` only, without `= line total` (the total is already on the right).
- Minus button: when `item.quantity <= step`, render the `Trash2` icon, title "Smazat položku" instead of `Minus`. Behaviour is unchanged (`onUpdateQty` with 0 already removes and shows the undo toast).
- Remove now-unused `itemVat` variable and `t('cart.vat')` use only if nothing else needs them.

Verify: extend tests: row shows no "DPH"; minus shows trash icon at quantity 1, minus icon at quantity 2.

## Phase 3: Auto-scroll and flash on changed line (item 1)

Change:
- `Cart.jsx`: ref on `.cart-items-container`. `useEffect` on `cartItems` compares with the previous render (ref) and finds the line that was added or whose quantity changed (first match, last wins). Then `scrollIntoView({ block: 'nearest' })` on that card (found by `data-line-index`) and sets `flashIndex`, cleared after about 600 ms.
- Skip when a line was removed, on first render, and when only price, discount or note changed.
- `register.css`: `.cart-item-card.is-flash` short background pulse (about 0.6 s, uses existing tokens). Honour `prefers-reduced-motion` by showing a static tint only.

Verify: test with jsdom (`scrollIntoView` mocked): adding a line scrolls that card; quantity bump on an existing line scrolls and flashes; removal does not scroll.

## Quality gates (after each phase, full set at the end)
- `npm run test`, `npm run lint`, `npm run build`
- Backend tests unchanged, not run
- `/code-review medium`
- Browser check with the dev server: add 10 items, scroll behaviour; type "0.5" kg in the inspector

## Out of scope (left for later)
Items 3, 4, 6, 7, 9 to 12 of the audit.
