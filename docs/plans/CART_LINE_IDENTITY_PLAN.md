# Cart line identity plan (audit item 3)

## Problem
Cart lines are addressed by product `id`, but a cart can hold two lines with the same `id`:
`addToCart` merges only when `id` AND `price` match. So these flows create duplicates:
- override a line's price in the inspector, then add the same product at catalog price;
- sell a product and return it (negative price) in one cart.

All line operations look up the line with `prev.findIndex(i => i.id === identifier)` (first match):
`updateQuantity`, `updateItemDiscount`, `updateItemDetails`, `removeItem` in `src/hooks/useCart.js`.
The UI passes `item.id` from `src/components/Cart.jsx` and `src/components/cart/CartItemInspector.jsx`;
`selectedItemId` in `Cart.jsx` is also an `id`.
Result: +, minus, delete and the inspector on the second line act on the first line (wrong quantity or wrong line removed in a sale).

Catalog ids are strings, so the legacy "numeric index" branch in these functions is only reached by tests, not by the UI.
Sale payload (`buildSalePayload.js`) copies named fields only, so a new `lineId` field does not reach the backend.

## Design
- New field `lineId` on each cart line, assigned in `addToCart` (`line-<base36 time>-<counter>`). `id` keeps its meaning (product id, used in the sale payload and stock).
- One helper `findLineIndex(items, identifier)` in `useCart.js`, used by the four operations. Order: `lineId` match, then legacy product `id` match (first line), then legacy numeric index. This keeps old callers and tests working.
- Lines restored from `localStorage` parked carts without `lineId` get one in `restoreParkedCart` (backfill). Undo/clear snapshots hold the same line objects, so they need nothing.
- UI passes `item.lineId ?? item.id`.

## Phases

### Phase 1: failing test first
`src/__tests__/useCart.test.js`: add `p1` at 100, override the price to 80 through `updateItemDetails`, add `p1` at 100 again (2 lines, same `id`).
Assert: `updateQuantity(lineId of line 2, 5)` changes only line 2; `removeItem(lineId of line 2)` removes only line 2; `updateItemDiscount(lineId of line 2, 10)` touches only line 2. Fails on current code.

### Phase 2: hook change
`src/hooks/useCart.js`: `lineId` in `addToCart`, `findLineIndex` helper replacing the duplicated lookup in the four operations, backfill in `restoreParkedCart`. Existing id and index tests must still pass.

### Phase 3: UI wiring
- `Cart.jsx`: `selectedLineId` replaces `selectedItemId`; `key={item.lineId ?? ...}`; stepper, delete and inspector use `item.lineId ?? item.id`.
- `CartItemInspector.jsx`: `onUpdateDetails` and `onRemoveItem` use `item.lineId ?? item.id`.
- `App.jsx` `handleApplyCustomDiscount`: `targetItem.lineId ?? targetItem.id`.
- Cart test: two same-product lines, tap + on line 2, only line 2 changes.

### Phase 4: gates and check
`npm run test`, `npm run lint`, `npm run build`, `/code-review medium` (no EET, VAT, refund or payload code touched; if the review finds payload impact, rerun at `high`), then repro in the browser: price override, add same product again, use + and delete on line 2.

## Out of scope
- Merge rule (id + price) is unchanged; a merged line keeps the first line's discount.
- Custom items use `custom-${Date.now()}` as `id`; two added in the same millisecond share an `id` in the sale payload. `lineId` makes the cart safe; payload id uniqueness is a separate issue.
