# Keypad P2 — UX plan

Source: keypad audit (2026-11-20), P2 list. P1 landed in 29a4676.

## In scope

1. **Visible rejection for `×`.** When `applyMultiply` returns `null` (decimal, zero, empty, >99), the `×` key and the amount display shake once (CSS keyframes, ~300 ms, disabled under `prefers-reduced-motion`) in addition to the error tone. Applies to `ManualKeypad`, `CustomItemModal` and the keyboard `*` path via a shared `rejectKey` flag in the two components; the keyboard path only plays the tone (no component state there).
2. **Add button shows what will be added.** Second line under the label: `3 × 125 = 375 Kč · DPH 21%` (return: `-375 Kč`). Needs two new grid props: `selectedVat`, `lineTotal` text. Format uses the existing `formatKc` so it matches the cart (dot decimal; see the recorded decision to defer the Czech comma).
3. **VAT choice resets after adding.** After a successful add, `selectedVat` returns to the store default. Reason: a one-off 12% line must not leak into the next sale. The VAT rate is visible on the Add button (item 2), so the cashier sees it before committing.
4. **Stepper colours.** `−1` and `+1` become neutral key style (same as `key-btn`); red stays reserved for return mode. The centre badge keeps its amber/red states.
5. **Return display decluttered.** Header becomes `Částka` plus a small `VRATKA` pill (no emoji, no wrap); multiplier pill drops `⚡`; empty return with multiplier shows `-1 × ___ Kč` (no double minus).

## Decisions for you (defaults chosen)

- Resetting VAT after add (item 3): default **yes**. Say no if shops set a VAT per shift and expect it to stick.
- **Not doing now**: merging stepper and `×` (design change), removing the second backspace (display one is hidden when empty and cheap), the Czech comma/number format (deferred app-wide), translating strings / aria-labels (P3).

## Phases and checks

1. Add-button summary + VAT reset + stepper colours (`KeypadNumberGrid`, `KeypadStepperBar`, `ManualKeypad`, `CustomItemModal`). Check: new tests in `keypad_input_wiring.test.jsx` and `CustomItemModal.test.jsx` (summary text, VAT reset, return summary).
2. Shake + display declutter (`register.css`, `ManualKeypad`). Check: test that a rejected `×` sets the shake class; existing tests stay green.
3. Gates: `npm run test`, `npm run lint`, `npm run build`, live check in the browser (3-column layout, screenshot), `/code-review medium`.
