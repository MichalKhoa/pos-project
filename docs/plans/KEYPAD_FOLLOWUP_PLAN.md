# Keypad follow-up plan (leftovers 1, 2, 3, 5, 7, 8, 10)

Source: keypad audit leftovers after P1–P3 (29a4676, 7e1b5b8, 6f13bc2). Decision from the owner: cashiers mostly use the stepper, `×` stays as a typing shortcut.

## Findings from the read-only checks

- **Item 8 is bigger than the emoji in two modals.** `App.jsx:628-630` (`handleAddToCart`) prefixes every return line with `↩️ ` unless the name already contains `Vratka`/`VRATKA`/`↩️`. The prefixed name goes into the cart, the sale payload, the DB and the receipt. A returned preset or a custom return named "Káva" is stored as `↩️ Káva`. The thermal path (`escpos_service.write_receipt_text`) falls back to cp852 with `errors='replace'`, so the emoji prints as `?` (or is dropped when diacritics are stripped). Nothing in the backend or the cart UI matches on the emoji. The default name I changed in P3 avoids the prefix only because it contains `Vratka`.
- **Item 10:** the backend has no maximum on price or total. `SaleItemSchema.price` is a plain `float`; the DB column is `Numeric(10, 2)` (SQLite does not enforce it); the only guard is `ZERO_TOTAL`. The pad is bounded (8 characters, quantity ≤ 99), so the largest line is about 99,999,999 × 99.
- **Item 7:** `keypad.return_item_default` has no users anywhere in `src` or `backend`.

## Changes

1. **Default names as constants (5).** `DEFAULT_ITEM_NAME` and `DEFAULT_RETURN_ITEM_NAME` exported from `src/utils/customItemId.js` (already imported by all three sites: `ManualKeypad`, `CustomItemModal`, `usePosKeyboardShortcuts`).
2. **Remove the unused `return_item_default` key (7)** from the CZ, VI and EN blocks.
3. **Return prefix without emoji (8).** In `App.jsx` the prefix becomes `Vratka: ` (Czech, like the default names; stored names are data, not UI language). The "already marked" check keeps `↩️` so old parked carts do not get a double prefix. Existing sales keep their stored names. Tests that expect `↩️ name` are updated.
4. **Label for `×` (2).** A small caption under the `×` glyph (`keypad.multiply_hint`: `množství` / `số lượng` / `qty`), absolutely positioned so key size does not change; tooltip stays.
5. **Remove the in-display backspace (3).** Delete the inline backspace button and its `useHoldBackspace` instance in `ManualKeypad`. The grid backspace stays with hold-to-clear. Tests that use the inline button (if any) switch to the grid one.
6. **Item 10: no code change.** Reported only. A server-side price/total cap changes the sale contract, so it needs its own decision and a `high` review; not bundled here.

## Out of scope

- Item 4 (comma format) and item 9 (3-column scrolling) stay deferred.
- Item 6 (small glue duplication).
- HTML receipt title `↩️ STORNO DOKLAD` (`receiptHtmlGenerator.js:349`): the browser/PDF receipt renders the emoji; the thermal path does not use that file.

## Phases and checks

1. Constants, key removal, `App.jsx` prefix, test updates. Check: unit test for `handleAddToCart` naming (preset return gets `Vratka: …`, already-marked names untouched, `↩️`-marked parked names untouched).
2. `×` caption and inline backspace removal. Check: render test for the caption in EN/VI; no inline backspace button remains; live look at compact (800x600) and 1366x768.
3. Gates: `npm run test`, `npm run lint`, `npm run build`, `/code-review medium`. Item 8 touches stored sale item names, so I will run the review at `high`.
