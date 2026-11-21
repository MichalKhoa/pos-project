# Keypad P3 — accessibility and i18n plan

Source: keypad audit (2026-11-20), P3 list plus the i18n finding deferred from the P2 review. P2 landed in 7e1b5b8.

## Problem

Keypad strings are hardcoded Czech (or English) in `ManualKeypad.jsx`, `KeypadNumberGrid.jsx`, `KeypadStepperBar.jsx`, `KeypadVatSelector.jsx`, so VI and EN users see Czech. 17 of 17 grid buttons have no `aria-label` (icon-only backspace has only an English `title`). Disabled Enter is 65% opacity on muted text.

## In scope

1. **Translate UI strings** into the existing `keypad` block (CZ, VI, EN in `src/i18n/translations.js`). New keys: `backspace_title` (exists, reuse), `clear_title`, `sign_title`, `multiply_title`, `step_down`, `step_up`, `step_down_title`, `vat_label` (`DPH`/`VAT`/`VAT`), `return_pill` (`VRATKA`), `currency` stays `Kč`, `total_label` (`Celkem`), `cash_movement_title`. Czech values equal the current strings, so existing tests keep passing.
2. **Accessible names.** `aria-label` on the icon-only keys (backspace, clear, ±, ×), stepper buttons use translated labels, inline backspace gets one too. Digit keys already have their digit as name.
3. **Disabled Enter contrast.** Keep the "not ready" look but raise it to readable contrast: opacity 0.65 → 1, with a flatter muted background and `--text-secondary` text. Check both themes in the browser.
4. **One test** in `ui_hygiene.test.jsx` style: every keypad `<button>` has a text or `aria-label`, and rendering with EN/VI shows no Czech keypad strings (`DPH`, `VRATKA`, `Násobit`).

## Decisions for you (defaults chosen)

- **Persisted custom item names** (`Volný prodej`, `↩️ Vratka / Vrácené zboží`, used in `ManualKeypad`, `CustomItemModal`, `usePosKeyboardShortcuts`): default **keep Czech and drop only the emoji** (`Vratka / Vrácené zboží`). Reason: they go into sales, history and the receipt; the thermal path encodes to cp852/ASCII with `errors='replace'`, so the emoji prints as `?`. Translating them would split history by language. Say "translate" if you want them to follow the UI language.
- **Subtotal format** (`= Celkem 37,5 Kč` uses Czech grouping, rest of the pad uses dot decimals): default **switch to `formatKc`** so one total never shows two styles. The Czech comma stays deferred app-wide.

## Out of scope

- `WeightEntryModal.jsx:200,242` calling the undefined `soundFx.playErrorTone()` (separate bug, will report as its own fix).
- Stepper/`×` merge, second backspace removal.

## Phases and checks

1. Translations + `t()` wiring + `aria-label`s (4 keypad components, `translations.js`). Check: existing keypad and modal tests pass; new hygiene test passes.
2. Disabled Enter contrast, emoji removal from default names, `formatKc` subtotal (`register.css`, three name sites). Check: tests asserting the old emoji name updated; live check in light and dark theme.
3. Gates: `npm run test`, `npm run lint`, `npm run build`, `/code-review medium`.
