# Theme Phase 3: Colour Reduction

Source: `docs/audit/THEME_DESIGN_AUDIT.md` (C2, C3, C4, L4, plus glow leftovers from E1). Builds on phases 1 and 2 (commit `872879f`). CSS and one data file. No JSX logic.

Rule: a colour means one thing. Green = paid/success, red = delete/refund/error, amber = warning. Everything else is neutral or the single accent (graphite).

## Changes

1. **Leftover hard-coded glows (E1).** Phase 1 zeroed the tokens, but 14 literal `box-shadow: 0 0 Npx rgba(...)` remain. Remove or replace with a 2 px solid outline in the accent: `modals.css:273, 513-563` (active banknote), `register.css:218, 663, 675, 684, 688`, `layout.css:683`, `customer-display.css:346` (phase 5 owns that screen's design, but remove the glow now).
2. **Banknote buttons (C3).** `modals.css:436-565`. One neutral style for all six: `--bg-card` fill, 1.5 px `--border-subtle` border, denomination in `--text-primary`, no text-shadow, no 3 D bottom edge. Note colour survives only as the existing 7 px left strip (`::before`), at its current hue. Active tender: border `--accent-highlight` 2 px. Mono font stays until phase 4.
3. **One primary action colour (C4).** Cash, Card, QR pay buttons (`register.css:2129-2165`, `modals.css:369-380`) and payment tabs (`modals.css:262-275`) all use `--accent-highlight` (graphite) with `--accent-highlight-text`. Cash/Card/QR differ by label and icon. Success green stays only for the final "Dokoncit" confirm (check which class it uses; keep as is). Drop 3 px under-edge and coloured shadows. Disabled state stays 0.4 opacity.
4. **Total box (L4).** `register.css:2045-2095`. Neutral: `--bg-card`, 1 px `--border-color`, no shadow. Amount and title in `--text-primary`. Refund variant keeps red text and a red border.
5. **Purple VAT amount.** `grep accent-purple`: only `modals.css:271` remains in CSS. Check JSX for inline purple on VAT lines; change to `--text-secondary`.
6. **Catalog category colour (C2).** `register.css:361-500`. Keep the 4.5 px left stripe (colour still identifies group). Remove the coloured hover border/tint (368-370, 458-460, 465), the tinted icon backgrounds (377, 433, 450, 479, 492) so icons sit on a neutral `--bg-input` chip. Stripe and icon glyph keep the card colour.
7. **Colour picker palette (C2).** `src/data/initialData.js` `COLOR_OPTIONS`: 28 reduced to 10 muted tones: slate `#475569`, graphite `#1e293b`, blue `#1d4ed8`, teal `#0f766e`, green `#15803d`, olive `#4d7c0f`, ochre `#b45309`, rust `#c2410c`, wine `#9f1239`, brown `#78350f`. Existing presets keep whatever colour they stored. Check tests that assert the list length or default colours.
8. **Toasts (C6 colour part).** `notifications.css` 73-143: flat tint (`color-mix` 14% of status colour on `--bg-card`), 4 px left border in status colour, text `--text-primary`, icon in status colour. Success/error/warning/info keep their hues because they carry meaning.

## Not changed

Status colours on stock, cash-drawer, shift and history pills (they carry meaning). Border radius (E6), still undecided. Font sizes, weights, mono font (phase 4). Layout (phase 5). Dark theme values (the accent already flips to near-white there; spot check only).

## Verify

- `npm run test`, `npm run lint`, `npm run build`. Known flaky: `app_unsent_sales.test.jsx`.
- `grep -n "box-shadow: 0 0 [0-9]" src/styles/*.css` returns nothing.
- Visual at 1366x768, light and dark: register with cart and catalog, cash/card/QR/split tabs, a toast of each kind, a refund total.
- Contrast: white on graphite buttons >= 15:1; strip colours are decorative only.
- `/code-review` at medium effort before commit.

## Risk

Low. Main risk: removing the colour tint on catalog cards may make groups harder to scan. The stripe stays; fall back to restoring a 6% tint if it looks flat. Existing installs keep stored preset colours, so only newly picked colours are muted.

## Open questions (defaults chosen, tell me to change)

1. Banknote buttons neutral with a note-colour strip (chosen) versus fully coloured as today.
2. Pay buttons all graphite (chosen) versus Cash keeps green.
3. Muted 10-colour picker (chosen) versus removing category colour entirely.
