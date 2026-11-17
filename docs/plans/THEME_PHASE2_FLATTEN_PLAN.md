# Theme Phase 2: Flatten

Source: `docs/audit/THEME_DESIGN_AUDIT.md` (E2 to E6, C6). Builds on `THEME_PHASE1_TOKENS_PLAN.md` (committed first). Goal: remove gradients, blur and decorative motion. No colour or layout redesign here (phases 3 and 5).

## Rules

- Gradient becomes a flat fill of its darker end colour (keeps contrast of white text).
- Hover scale, lift and rotate effects are removed. Press feedback stays (`button:active` darken in `tokens.css`).
- Entrance animations (slide, fade, pop) stay but shorten or simplify only where they use bounce or scale. Status pulses stop.
- Everything honours `prefers-reduced-motion`.

## Changes by file

1. **`notifications.css` (C6).** 7 gradients at lines 73 to 143 become flat fills with the same colours. `flashPop` and `scaleIn`-style bounce: replace with a plain fade. Line 288 `scale(1.04)` removed.
2. **`modals.css`.** Gradients at 138, 152 (indigo tint) become flat tint of `--accent-highlight` at low alpha. 373, 378 purple button: flat `--accent-purple`. 512 to 562 banknote buttons: flat darker end colour (colours themselves change in phase 3). 468 white sheen overlay: remove. 614 to 632 coin gradients: flat colour. Line 9 modal overlay `blur(6px)`: remove, keep the dim colour. Lines 69, 155, 475, 641: remove rotate and lift.
3. **`register.css`.** Gradients at 422, 459 (catalog card tint): flat `--bg-card` (stripe stays). 1156, 1166, 2145 to 2169 (pay buttons): flat fills. 2061, 2073: flat tint. 227 divider fade: keep (not decorative). Remove blur at 475. Remove hover scale/lift at 111, 220, 672, 682, 686, 724, 748, 951, 1699, 1721, 1774, 2013. Stop `pulse-trash` at 668.
4. **`layout.css`.** Remove blur at 61 and 422 (navbar and cart column): use opaque `--bg-card`. Remove scale at 187, 248, 391, 751 and lift at 1252. Stop pulses at 101, 113, 152, 194 (static dot, colour still shows state).
5. **`history.css`.** 3 bar gradients at 435 to 443 become flat. Remove lift at 135 and 364.
6. **`customer-display.css`.** Gradient and glow background at 229 and 422 become flat `#0f172a`. Remove `pulseDot` at 411 and bounce at 432. (Screen redesign is phase 5.)
7. **`tokens.css`.** Remove `pulseDot` use on `.latency-dot-online`. Flatten `--shadow-key` and `--shadow-key-pressed` to a 1 px border-style shadow (3 users). Add at the end:
   `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }`
8. **`border-radius` (E6).** Not touched: needs the design decision in phase 3. Listed here so it is not forgotten.

## Not changed

Colours of buttons, banknotes, categories, toasts (phase 3). Font sizes and weights (phase 4). Layout (phase 5). Any JSX, except inline `style` objects found to carry gradients or transforms: grep `src/components` for `gradient|scale\(|rotate\(` first, fix those found in the same pass.

## Verify

- `npm run test`, `npm run lint`, `npm run build`. Tests asserting class names or inline gradients are updated only where they fail. Known flaky: `app_unsent_sales.test.jsx` (fails about 1 in 3 runs on baseline too).
- `grep -c gradient src/styles/*.css`: only the `register.css:227` divider remains.
- Visual check at 1366x768, light and dark: register with cart, cash/card/QR payment tabs, history, settings, a toast, the customer display (`/?display` or its window), pressing a button shows darken only.
- `/code-review` at medium effort before commit.

## Risk

Low to medium. Removing blur on the navbar can reveal content scrolling under it if the bar was relying on translucency: confirm it has an opaque background token. Flat button fills need a visible border or contrast against cards: spot check pay buttons and toasts. Several flat fills lose depth cues, so check disabled versus enabled states on pay buttons.

## Order inside the phase

1. `tokens.css` reduced-motion rule and key shadows. 2. Motion removal (all files). 3. Gradients to flat. 4. Blur. 5. Component inline-style grep. Run tests after steps 2 and 5.
