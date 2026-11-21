# Open-price modal P1 — wrong money and keyboard leak

Source: audit of `OpenPriceModal` (2026-11-20). P1 = items that put a wrong line in the cart. P2 (shared entry rules, `×` meaning, formatting) and P3 (i18n, emoji, aria) come later.

## Findings reproduced live (1366x768, 3-column layout)

1. **Return sign lost on open.** Main pad in return mode (`−1`), tap an open-price tile: modal shows `1×` and the sale header. Type 50, Add: cart gets `Vratka: Oblečení −50.00`.
   - Cause: `QuickPresetGrid.handleCardClick` opens the modal with `setOpenPriceQty(Math.max(1, Math.abs(m)))` (sign dropped). `handleOpenPriceSubmit` then recomputes `isReturn` from the pad (`itemMultiplier < 0`, `keypadAmount` starts with `-`), so the modal display and the result disagree. The same terms also make the modal's own `±` unable to turn a return back into a sale.
2. **Physical keyboard leaks to the pad behind the modal.** `usePosKeyboardShortcuts` only stops for payment modals. With the modal open, typing `77` fills the main pad; Enter then adds `Volný prodej 77 Kč` to the cart under the modal. Esc does nothing.
   - The same leak exists for `CustomItemModal` (only Esc handled) and `WeightEntryModal` (handles its own keys, but the hook also fires).
3. **No cap.** Quantity went to `152×` (pad caps at 99). Price allows 10 characters (pad: 8), so a line total of 19 012 345 506 Kč is possible.

## Changes

1. **Open in the right mode (fix 1).**
   - `handleCardClick`: open with a signed quantity: `isReturn ? -q : q` where `q = max(1, abs(multiplier))` and `isReturn` is the value already computed on that line (multiplier < 0 or keypad starts with `-`).
   - `handleOpenPriceSubmit`: `isReturn = openPriceQty < 0` only. The modal is the single source of truth after it opens. Pad state is still cleared on submit, as now.
2. **One place decides who owns the keyboard (fix 2).**
   - New `src/utils/keyboardOwner.js`: a counter with `acquireKeyboard()` / `releaseKeyboard()` / `isKeyboardOwned()`, plus a `useOwnKeyboard(isOpen)` hook (acquire in an effect, release in the cleanup, so StrictMode and unmount are safe).
   - `usePosKeyboardShortcuts` returns early when `isKeyboardOwned()`, right after the existing `paymentModalMethod` check. No prop drilling.
   - `OpenPriceModal`, `CustomItemModal`, `WeightEntryModal` call `useOwnKeyboard(isOpen)`.
   - `OpenPriceModal` gets an Escape handler that closes it. Physical digit entry into this modal is P2 (needs the shared helper); until then digits are ignored, not leaked.
   - Behavior change to note: a barcode scan while one of these three modals is open is now ignored (it used to add the item behind the modal). Same rule as payment modals (F-002).
3. **Caps (fix 3).**
   - Quantity in the modal clamps to `±MAX_MULTIPLIER` (99) for `+1`, `−1` and `×`.
   - Price length uses `MAX_AMOUNT_CHARS` (8) in `handleDigit` / `handleDoubleZero` instead of the literals 10 and 9. Largest line becomes 99,999,999 × 99, same as the pad. Leading zeros and decimal rules stay for P2.

## Out of scope (P2 / P3)

Shared `keypadInput` helper, `×` as multiply, `00`/leading zeros, `formatKc` preview, Add-button summary, duplicate backspace, strings, emoji, aria-labels, stepper colours. `WeightEntryModal` audit. Backend price/total cap.

## Tests

- `QuickPresetGrid` render test: pad multiplier `−1`, tap an open-price tile → modal shows return (`-1×`); type 50, Add → `onAddToCart` with `price: -50, quantity: 1`. Pad `−3` → quantity 3. Pressing `±` in the modal turns it into a sale (`price: 50`) even though the pad was in return mode. Pad in sale mode stays a sale.
- `keyboardOwner` unit test: nested acquire/release, never negative.
- Hook test: digit and Enter ignored while owned, work again after release.
- `OpenPriceModal` test: renders with the hook → pad digit not typed; Esc calls `onClose`; `+1` stops at 99, `−1` stops at −99; 9th digit rejected.
- Same "pad digit not typed" check for `CustomItemModal` and `WeightEntryModal`.

## Phases and checks

1. `keyboardOwner.js`, hook gate, three modals call it, Esc in `OpenPriceModal`. Check: new hook tests pass; existing hook and modal tests unchanged.
2. Signed open, submit rule, caps. Check: new grid and modal tests pass. Live check at 1366x768: reproduce items 1–3 and confirm each is gone (display matches the cart line; `77` + Enter behind the modal changes nothing; Esc closes).
3. Gates: `npm run test`, `npm run lint`, `npm run build`, then `/code-review high` (touches sale line sign and the shared keyboard hook).
