# Open-price modal P3 — keyboard leak in other modals, then strings and accessibility

Source: open-price audit (2026-11-20), P3 list, plus the stale projectmem note `evt_b1d400228f6340e3b188` ("window keydown listeners fire for every open modal and the register hook"). P1 = 353916b, P2 = 012dcb9.

## Part A — keydown listeners (separate commit)

### What I found (live, 3-column layout, cart with one item)

The note is still true. P1 gated three modals through `keyboardOwner`; PaymentModal has its own gate. Everything else still lets the register shortcuts run behind it.

- **Price check modal** (Cenovka): typed `7`, the pad showed `7`; Enter added the checked item **and** a `7 Kč` custom line (cart 1 → 3 lines). The modal itself adds on Enter, the hook adds again.
- **Discount modal**: typed `7`, pad showed `7`; Enter added a `7 Kč` custom line behind the open modal (cart 3 → 4 lines).
- By code the same applies to every other `.modal-overlay` without an owner: refund, receipt, parked-carts drawer, cash movement, Z report, unsent/sync/shutdown, calendars, category/preset managers. Only text inputs are safe (the hook skips them). Pressing Enter with a modal open and items in the cart can also open the cash payment modal.

### Why not copy `useOwnKeyboard` into ~14 modals

Opt-in leaves every new modal leaking by default. Also two modals must keep receiving scans: price check (consecutive scans replace the shown item) and the unknown-barcode flow. Blanket "block everything" would break them.

### Change

- In `usePosKeyboardShortcuts`, after the barcode-scan block and before the pad shortcuts (digits, `.`, `-`, `+`, arrows, `c`, `x`, Backspace, Escape/Delete, Enter): return early when a modal is on screen (`document.querySelector('.modal-overlay')`). Scans still work as today; the pad and Enter-adds-or-pays no longer fire behind a modal. Exclusive owners (open-price, custom item, weight, payment) keep ignoring scans too.
- One line plus a comment naming the convention (a modal uses `.modal-overlay`). `ConfirmContext` and the lock screen use it as well, so they are covered.
- Not covered: the cart item inspector (a popover, not an overlay). Reported only.
- After the fix: retire the stale note with a projectmem decision that supersedes it.

### Tests

- Hook test: an element with class `modal-overlay` in the document → digit, `.`, Enter do nothing; remove it → they work. A scan (fast keys + Enter) still adds the item with the overlay present.
- Component-level: price check modal open → Enter adds the item once, pad untouched.

## Part B — P3: strings, emoji, accessible names

### Change

1. **Shared display card.** `CustomItemModal` and `OpenPriceModal` carry two copies of the amount display (hardcoded Czech header, `↩️`/`⚡` pill, locale-grouped total in the custom-item copy). Extract `KeypadAmountDisplay` (props: `isReturn`, `hasValidAmount`, `multiplier`, `amountStr`, `rejected`, `testId`) and use it in both.
2. **Strings.** New `keypad` keys in CZ/VI/EN: `price_prompt` ("Zadejte cenu za jednotku (Kč)"), `return_price_prompt` ("Cena pro vrácení"), and `custom_item.clear_name`. The return pill reuses `keypad.return_pill`.
3. **No emoji in the keypad family.** Pill `⚡ 3×` / `↩️ -3×` → plain `3×` / `-3×` (colour already carries the mode, like the pad). Stepper badge `↩️ -1×` → `-1×`. `keypad.add_return_item` loses the emoji in CZ/VI/EN, and the `|| '↩️ …'` fallbacks in code go. Refund titles elsewhere in the app keep their emoji (browser UI, not part of this audit).
4. **Accessible names.** Close button in `OpenPriceModal` gets `aria-label={t('common.close')}`. `CustomItemModal`: `aria-label="Clear name"` → `t('custom_item.clear_name')`.
5. **`CustomItemModal` cleanup.** Remove the locale-grouped `Celkem` line (the Add button already shows the total) and the second, inline backspace (same decision as the pad: one backspace, in the grid). Drops `total_return_preview` from the three language blocks if nothing else uses it.

### Out of scope

Shared key reducer (`applyKey`), `WeightEntryModal` audit, backend price/total cap, comma format, cart item inspector keyboard.

### Tests

- Both modals in EN: no Czech header text (`Zadejte`, `Cena pro`, `VRATKA` only via the EN pill `RETURN`), no `↩️`/`⚡` in the modal text.
- Every button in both modals has an accessible name (text or `aria-label`).
- `CustomItemModal`: exactly one backspace; no `Celkem` line; existing tests that used the inline backspace switch to the grid key.
- `KeypadAmountDisplay` renders the header for sale and return and the `×` pill only when the quantity is not 1.

## Phases and checks

1. Part A: hook gate and tests. Check: full test run, live check (price check modal and discount modal: `7` and Enter change nothing; a scan during price check still updates the modal). `/code-review high` (shared hook, sale lines). Commit.
2. Part B: `KeypadAmountDisplay`, keys, emoji, aria, `CustomItemModal` cleanup, tests. Check: full test run, live look at both modals in CZ/EN at 1366x768. `/code-review medium` (display only). Commit.
3. Gates both times: `npm run test`, `npm run lint`, `npm run build`.
