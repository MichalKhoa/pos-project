# Theme Phase 4: Type and Density

Source: `docs/audit/THEME_DESIGN_AUDIT.md` (T1, T3, T4, T5). Builds on phase 3 (`0401937`). Mechanical edits in CSS and inline JSX styles. No layout or colour change.

## Measured now

- CSS `font-weight`: 800 or 900 in 103 of 172 declarations. Inline JSX `fontWeight` 800/900: 404.
- Inter is loaded only up to 800 (`index.html:10`), so every 900 already renders as 800. Weight 900 is a fake.
- CSS `font-size` below 0.8 rem: about 45. Inline JSX sizes below 0.8 rem: about 255. Root is 18 px at the default `lg`, so 0.8 rem is 14.4 px.
- `text-transform: uppercase`: 14 CSS rules (4 on the customer display).
- `--font-mono` (JetBrains Mono): 28 CSS uses, 22 inline literals, loaded from Google Fonts.

## Changes

1. **Weight scale (T3).** Three weights only: 400 body, 600 labels and buttons, 700 prices, totals, headings.
   - CSS and inline: 900 and 800 become 700. 500 becomes 400 or 600 by nearest use (3 declarations, check each). Body text with no weight stays 400.
   - Scripted regex pass, then read the diff of the files with the most changes.
2. **Size floor (T1).** Every font size below 0.8 rem becomes 0.8 rem (14.4 px at `lg`, 12.8 px at `sm`). CSS and inline. Exempt: `.receipt-paper`, `.printable-receipt`, `.thermal-receipt-paper` (fixed px on purpose), the customer display (own root) and icon-only badge counters (note any such found, keep at 0.7 rem).
   - Risk: tight chips and badges may wrap or overflow. Spot check at 1366x768.
3. **No uppercase (T4).** Remove `text-transform: uppercase` and the wide `letter-spacing` next to it from the 10 cashier-side rules (history, modals, settings, register). Customer display keeps its 4 (phase 5 owns that screen). Czech labels already carry their own capitalisation in the translation files, so no text edits.
4. **No monospace on prices (T5).** `tokens.css`: `--font-mono: var(--font-main)` and `font-variant-numeric: tabular-nums` on the rules that use it (add to `body`; digits align without the code look). Inline `'monospace'`/`JetBrains` literals in 22 places change to `var(--font-main)` with `fontVariantNumeric: 'tabular-nums'`. Remove the JetBrains Mono family from the `index.html` font link (one less download; app works offline in a shop, so keep Inter bundled behaviour as is).
   - Excluded: receipt preview paper, which must stay monospace to match thermal print width. Keep its font.
5. **Not touched.** Layout and density of the top bar, sidebar, catalog cards (phase 5). Customer display type (phase 5). Radii (E6, undecided).

## Verify

- `npm run test`, `npm run lint`, `npm run build`. Known flaky: `app_unsent_sales.test.jsx`. Tests asserting inline styles (`fontWeight`, `fontSize`) updated only where they fail.
- `grep -c "font-weight: *[89]00" src/styles/*.css` is 0 (except customer display).
- Visual at 1366x768, light and dark: register, catalog, cart, cash modal, history, settings, a receipt preview (unchanged). Check no chip or badge wraps badly.
- `/code-review` at medium effort before commit.

## Risk

Medium for look, low for logic. Raising 255 small inline sizes may crowd tight rows (cart line detail, history table, status pills); fix by shortening gaps, not by lowering the floor. Replacing 800 with 700 in 400+ places is visible but uniform. Receipt preview and print paths are excluded so printed output cannot change.

## Open questions (defaults chosen)

1. Floor 0.8 rem (14.4 px at default) versus 0.875 rem (15.75 px): chosen 0.8, raise later if still too small.
2. Drop JetBrains Mono entirely (chosen) versus keep it for the receipt preview only.
