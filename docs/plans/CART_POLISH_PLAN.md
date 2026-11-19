# Cart polish plan (audit items 4, 7, 9, 10, 11)

Item 12 (cash rounding hint) is left out on request.
Files: `src/components/Cart.jsx`, `src/components/cart/CartItemInspector.jsx`, `src/i18n/translations.js`, `src/styles/register.css`, one new util, tests.
No backend, sale payload, VAT or EET code is touched. Review: `/code-review medium`.

## Phase 1: translations (item 4)
Hardcoded Czech that bypasses `t()` today, and the key to use:

| Where | Today | Key |
| --- | --- | --- |
| cart header (refund) | `↩️ Vratka / Vrácení Zboží` | `cart.refund_title` (exists in cs, vi, en) |
| refund pay buttons | `Vrátit Hotovost`, `Vrátit na Kartu` | `cart.refund_cash`, `cart.refund_card` (exist) |
| refund line badge | `↩️ VRATKA` | new `cart.return_badge` |
| refund total label | `↩️ K VRÁCENÍ` | new `cart.refund_total` |
| row delete tooltip | `Smazat položku` | `inspector.delete_item` (exists) |
| row tooltip | `Kliknutím upravíte...` | new `cart.edit_hint` |
| inspector total | `Celkem za položku:` | new `inspector.line_total` |
| last-receipt payment | `💵 Hotovost`, `💳 Karta` | `payment.cash`, `payment.card` (exist; emoji dropped) |
| cleared-cart banner | `Košík byl vysypán`, `N položek v paměti (8s)`, `Obnovit košík` | new `cart.cleared_title`, `cart.cleared_sub`, `cart.restore_cart` |

New keys are added to cs, vi and en. The existing `translation_keys.test.js` already checks that every literal `t()` key exists and that the three languages match. New test: an EN refund cart shows no Czech refund text.

## Phase 2: accessible names (item 10)
`aria-label` on every icon-only control in the cart column, from `t()`:
- row stepper minus, plus and delete (new `cart.decrease_qty`, `cart.increase_qty`; delete reuses `inspector.delete_item`);
- inspector stepper buttons, close button, quantity input, custom discount input, price input (reuse `inspector.*` keys);
- header buttons get theirs in phase 3.
Test: the buttons are found by role and name.

## Phase 3: header declutter (item 7)
Header today: title, count badge, parked restore, park, discount, clear, all with text labels; the title truncates first.
- Park, discount and clear become icon-only (38 px square, `title` and `aria-label` kept). Discount shows `-N%` next to the icon when a cart discount is active (that text is information, not a label).
- The parked restore button keeps its text, because it carries the count.
Risk: icon-only clear is less obvious. It is the last button, red on hover, and the 8-second restore banner still covers a mistap.

## Phase 4: price commit (item 9)
Today the price override commits only on blur (`handleCustomPriceBlur`), so Escape or an outside tap can drop it.
- Enter blurs the field (commits).
- Escape, outside tap and the close button commit a pending valid price before closing, through a ref that always holds the latest handler.
Test: type a price, press Escape, the cart line has the new price; invalid text is discarded without changing the price.

## Phase 5: money format (item 11)
Add `formatKc(n)` in `src/utils/money.js`: always two decimals, thousands grouped with a non-breaking space, dot decimal kept. Use it for every amount in the cart column (rows, inspector, summary, total). This fixes the unreadable `12345.00 Kč` and matches the payment modal's decimal style.
Decision for you: a Czech comma (`12 345,50 Kč`) would be more natural, but the payment modal, history and inventory all use the dot, so switching only the cart would make the same total look different one tap later. I recommend the comma as a separate app-wide pass.
Test: `formatKc(12345.5)` gives `12 345.50`, negatives and zero.

## Gates
`npm run test`, `npm run lint`, `npm run build`, `/code-review medium`, then a browser check in EN: refund cart, header at 800 px width, price override with Escape, a large total.

## Out of scope
Item 12, the custom-item `id` collision, the `selectedItemId` rename, the last-receipt chip row, the double trash icon.
