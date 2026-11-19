# Keypad P1 fixes — implementation plan

Source: keypad audit (2026-11-20), items P1.1–P1.4.

## Problem

Three copies of the amount-entry rules exist and disagree:

| Copy | File | Limit | `00` | Leading zero | `×` |
|---|---|---|---|---|---|
| On-screen keypad | `ManualKeypad.jsx` `handleKeyPress` | 10 chars | falls into digit path (matches `'.00'`, key sends `'00'`) → `1.500` | `005` allowed | in `KeypadNumberGrid.jsx`, 1–99, drops return sign, wipes amount on toggle-off |
| Custom item modal | `CustomItemModal.jsx` `handleKeyPress` | 10 chars | own rules | only `'0'` replaced | same `KeypadNumberGrid` |
| Physical keyboard | `usePosKeyboardShortcuts.js` | 8 chars | none | `005` allowed | own copy, −999..999, keeps amount |

## Design

New pure module `src/utils/keypadInput.js` (no React):

- `appendDigit(str, key)` — `key` is `'0'`–`'9'` or `'00'`. Sign (`-`) is ignored for counting. Rules:
  - max 8 characters excluding the sign (digits and the dot count);
  - max 2 decimals;
  - leading zero: `0` + non-zero digit replaces the zero; `0` + `0`/`00` is unchanged; empty + `00` gives `0`;
  - `00` appends as many zeros as fit (limit and decimals), never exceeds.
- `appendDecimal(str)` — `0.` on empty or `-`, no second dot.
- `applyMultiply(amountStr, itemMultiplier)` returns `{ amountStr, itemMultiplier }` or `null` (rejected):
  - multiplier already ≠ 1 → reset to 1, keep the typed amount (the keyboard behaviour, not destructive);
  - otherwise amount must be an integer 1–99 (sign allowed); result quantity keeps return mode: a `-` prefix or a negative current multiplier gives `-q`, else `q`;
  - anything else → `null`.

Wiring (all three call the module):

1. `ManualKeypad.handleKeyPress`: digit, `00`, `.` use the helpers. New `handleMultiply` plays `soundFx.playError()` on `null`. `KeypadNumberGrid` gets an `onMultiply` prop (replaces the inline `×` logic and the `setItemMultiplier`/`setAmountStr` props it only used for that).
2. `CustomItemModal`: same helpers and its own `onMultiply`; delete its local digit/`00`/dot branches.
3. `usePosKeyboardShortcuts`: digit, `.`/`,`, and `*`/`x` branches use the helpers (keyboard limit becomes 8 everywhere; on-screen drops from 10 to 8).

Out of scope (P2/P3): shake/visual rejection, aria-labels, i18n of strings, VAT reset, Add-button summary, number format.

## Phases and checks

1. **Helper + unit tests** — `src/utils/keypadInput.test.js`: leading zeros, `00` on empty / after `.5` / after `.50`, 8-char cap with and without sign, third decimal, `×` accept/reject cases incl. return-mode preserved (`-1` stepper then `5` then `×` → `-5`), toggle-off keeps amount. Check: tests fail on current logic semantics, pass after.
2. **Wire ManualKeypad + KeypadNumberGrid + CustomItemModal** — extend `keypad_cart_presets.test.jsx` and `CustomItemModal.test.jsx` (`1,5` + `00` shows `1.50`; `005` shows `5`; return `×` stays return). Check: existing keypad tests still pass.
3. **Wire keyboard shortcuts** — extend its existing test (or add one) for the 8-char cap and `*` in return mode.
4. **Gates** — `npm run test`, `npm run lint`, `npm run build`, then `/code-review medium`. Live re-check in the browser (3-column layout).

## Notes

- `WeightEntryModal.jsx:200,242` calls `soundFx.playErrorTone()`, which `audio.js` does not define (it has `playError()`), so those paths throw a TypeError. Separate bug, not part of this plan; I use `playError()` here and report the other one.
- Behaviour changes users will see: on-screen max drops 10 → 8 characters; `×` no longer clears the typed amount when toggling off.
