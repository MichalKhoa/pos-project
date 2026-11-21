# Cart footer compaction plan (audit item 6)

## Problem
The cart footer ([Cart.jsx](../../src/components/Cart.jsx), `.cart-footer` in `src/styles/register.css`) stacks six blocks under the item list:
tax base row, VAT row, total card, cash and card buttons, split button, drawer button.
Rough height at default size: about 360 px. In the browser at a 540 px-high window the item list was only 67 px tall (about one line).
The drawer button is built from inline styles with JS hover handlers, unlike the other footer buttons.

## Goal
Give the item list about 95 px more room at default size, without shrinking the payment buttons (touch targets stay 44 px or larger) and without new features.

## Changes
1. **One tax line.** Replace the two `.summary-row` lines (base, VAT) with one muted line: `Základ 303.53 Kč · DPH 63.17 Kč` (labels from existing `cart.tax_base` and `cart.tax_total` keys, trailing colons dropped). The cart discount row stays separate. Saves about 30 px.
2. **Drawer button joins the split row.** New `.cart-secondary-actions` flex row:
   - items in cart: split button (flex 1) plus a 44 px square icon-only drawer button (`aria-label` and `title` from `cart.open_drawer`);
   - empty cart: the drawer button alone, full width with its label (today's look), because split is hidden when the cart is empty.
   The inline styles and hover handlers move into a `.cart-drawer-btn` CSS class. Saves about 57 px.
3. **Tighter spacing.** `.cart-footer` gap 0.75rem to 0.5rem, remove the extra `margin-top` on `.total-hero-card`. Saves about 10 px.
4. **Short windows.** New `@media (max-height: 720px)` block reuses the compact values that already exist for small widths: footer padding, hero amount 1.6rem, pay buttons 48 px. Split and drawer stay 44 px.

Not changed: total card, pay buttons order and labels, refund colours, last-receipt chip row (a possible later item: it takes about 45 px above the list).

## Phases
1. **Markup and CSS** in `Cart.jsx` and `register.css` (changes 1 to 4).
2. **Tests** in `src/__tests__/cart_inspector_qty.test.jsx` (Cart section): one summary line shows both base and VAT values; drawer button calls `onOpenCashDrawer` with items in the cart and with an empty cart; split still calls `onOpenPayment('split')`; drawer button has an accessible name.
3. **Gates:** `npm run test`, `npm run lint`, `npm run build`, then `/code-review medium` (no EET, VAT math, refund or payload code touched; the tax line only changes display of `totalNet` and `totalTax`).
4. **Browser check:** 800x540 window, compare `.cart-items-container` height (67 px before). Also check an empty cart, a refund cart (rose total card), a cart discount row, and dark theme.

## Risk
Icon-only drawer button is less discoverable than the labelled one. Mitigation: amber `CashDrawerIcon` unchanged, `title` tooltip kept, and the labelled version stays for the empty cart. If you prefer a label, the fallback is a short "Zásuvka" label that costs about 60 px of width in the split row.
