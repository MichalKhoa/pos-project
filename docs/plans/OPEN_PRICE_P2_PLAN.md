# Open-price modal P2 — same entry rules as the pad

Source: open-price audit (2026-11-20), P2 list. P1 landed in 353916b.

## Problem

`OpenPriceModal` hand-copies the keypad grid, the stepper bar and the entry logic. Result, all reproduced live:

- `×` is a second `+1`: type `3`, press `×` → price 3, quantity 2. On the pad it makes the typed number the quantity.
- `005` and `05` are accepted; `1,5` then `00` stays `1.5` (pad: `1.50`).
- Preview uses Czech grouping (`19 012 345 506 Kč`) while everything else uses `formatKc`; the Add button shows no total.
- Duplicate backspace inside the display; red/green stepper colours the pad dropped; no shake on a rejected `×`.
- A physical keyboard types nothing (P1 stopped the leak into the pad but left the modal deaf).
- The stepper on the main pad and the `+`/`ArrowUp` keys have no quantity cap either (the `×` key caps at 99, the stepper does not).

## Approach: reuse, do not patch

`openPriceQty` is the same thing as `itemMultiplier` (signed quantity). So `CustomItemModal` already shows the shape: header, display card, `KeypadStepperBar`, `KeypadNumberGrid`, Cancel. The open-price modal does the same instead of keeping a second copy.

## Changes

1. **`stepQty(current, delta)` in `keypadInput.js`** (pure): the 1 ↔ −1 jump over zero, clamped to ±`MAX_MULTIPLIER`. Used by `KeypadStepperBar` and by `+`/`ArrowUp`/`ArrowDown` in `usePosKeyboardShortcuts`. Fixes the uncapped stepper on the pad and in `CustomItemModal` too. P1's local `clampQty` goes away.
2. **`useRejectFlash()` hook** (`src/hooks/useRejectFlash.js`): returns `[rejectKey, flash]`, owns the 350 ms timer and its cleanup. Third copy of this glue (`ManualKeypad`, `CustomItemModal`, now this modal), so extract; the first two switch to it.
3. **`OpenPriceModal` rewritten on the shared parts.**
   - `KeypadStepperBar` (`itemMultiplier = openPriceQty`) and `KeypadNumberGrid` (`amountStr = enteredOpenPrice`, no `selectedVat`, so no VAT text in the summary, `onAddCustomItem = onSubmit`).
   - Key handling through `appendDigit` / `appendDecimal` / `applyMultiply`. `C` clears the price and resets the quantity to 1 (same as the custom-item modal). `±` flips the sign of `openPriceQty`. `BACK` drops the last character.
   - Display card keeps its header text (strings and emoji are P3). Removed: inline backspace, the `Celkem` preview line (the Add button now shows `3 × 125.00 = 375.00 Kč`).
   - Outer `<form>` becomes a `div`; Enter and the Add button call `onSubmit`. `handleOpenPriceSubmit` accepts a missing event.
4. **Physical keyboard in the modal.** Digits, `.`/`,`, Backspace, `Delete`/`c`, `-` (sign), `+`/`ArrowUp`, `ArrowDown`, `*`/`x`, Enter (submit when valid), Esc (close). Same scanner guard as the shared hook: a key within 70 ms of the previous one is dropped, and Enter within 100 ms of the previous key is dropped. A scan can leave one stray digit in the price but never submits a line.

## Out of scope (P3)

Hardcoded Czech strings and emoji in the display card, the close button `aria-label`, the `toLocaleString` preview in `CustomItemModal`, WeightEntryModal audit, backend cap.

## Tests

- `keypadInput.test.js`: `stepQty` over zero and at ±99.
- Hook test: `+`/`ArrowUp` stop at 99.
- `KeypadStepperBar` (via the pad harness): stepper stops at 99.
- `open_price_modal.test.jsx` (P1 tests adjusted: submit is the grid Add button): `3` then `×` → quantity 3 and price field empty; rejected `×` on `2.5` shakes; `005` → `5`; `1,5` + `00` → `1.50`; Add button text `3 × 125.00 = 375.00 Kč`; return pad → negative total; exactly one backspace button; no `19 012…`-style locale preview line.
- Keyboard entry: digits type; Enter submits only when valid; a burst of keys 10 ms apart is ignored and does not submit; Esc closes.
- `useRejectFlash`: flag on, off after 350 ms, timer cleared on unmount.

## Phases and checks

1. `stepQty`, stepper bar, shortcuts hook, `useRejectFlash` and its two existing users. Check: existing keypad, custom-item and hook tests unchanged and green.
2. `OpenPriceModal` rewrite and keyboard entry. Check: updated and new modal tests; live at 1366x768 and 800x600 (modal height with the taller Enter row).
3. Gates: `npm run test`, `npm run lint`, `npm run build`, `/code-review high` (sale line quantity and sign).
